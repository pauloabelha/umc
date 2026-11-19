"""Minimal CUDA physics: fixed boxes and dynamic spheres, in SI units."""
import math
import copy


def number(value, label, positive=False):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        raise ValueError(f'{label} must be finite')
    if positive and value <= 0:
        raise ValueError(f'{label} must be positive')
    return value


def vector(value, size):
    if not isinstance(value, list) or len(value) != size:
        raise ValueError('Invalid vector')
    return [number(v, 'coordinate') for v in value]


def validate(scene):
    if scene.get('format') != 'umc-scene' or scene.get('version') != 1:
        raise ValueError('Unsupported scene')
    if not 1/2000 <= number(scene.get('timestep'), 'timestep') <= 1/120:
        raise ValueError('Timestep outside supported range')
    vector(scene.get('gravity'), 3)
    bodies = scene.get('bodies')
    if not isinstance(bodies, list) or not 1 <= len(bodies) <= 512:
        raise ValueError('Expected 1–512 bodies')
    ids = set()
    for body in bodies:
        name = body.get('id')
        if not isinstance(name, str) or not name or name in ids:
            raise ValueError('Invalid or duplicate body ID')
        ids.add(name)
        vector(body.get('position'), 3)
        if 'velocity' in body: vector(body['velocity'],3)
        q = vector(body.get('rotation'), 4)
        if abs(sum(v*v for v in q) - 1) > 1e-5:
            raise ValueError('Rotation must be a unit quaternion')
        shape = body.get('shape', {})
        motion = body.get('motion')
        if motion not in ('fixed', 'kinematic', 'dynamic'): raise ValueError('Invalid motion')
        pieces = shape.get('children', []) if shape.get('kind') == 'compound' else [dict(shape=shape)]
        if not 1 <= len(pieces) <= 256: raise ValueError('Invalid shape count')
        for piece in pieces:
            primitive = piece['shape']
            vector(piece.get('position', [0,0,0]), 3)
            vector(piece.get('rotation', [0,0,0,1]), 4)
            if primitive.get('kind') == 'box' and (motion != 'dynamic' or body.get('hinge')):
                for v in vector(primitive.get('size'), 3): number(v, 'box size', True)
            elif primitive.get('kind') == 'trimesh' and motion == 'fixed':
                verts, indices = primitive.get('vertices'), primitive.get('indices')
                if not isinstance(verts,list) or not 9 <= len(verts) <= 30000 or len(verts)%3: raise ValueError('Invalid vertices')
                vector(verts,len(verts))
                if not isinstance(indices,list) or not indices or len(indices)%3 or any(type(i) is not int or i<0 or i>=len(verts)//3 for i in indices): raise ValueError('Invalid triangles')
            elif primitive.get('kind') == 'sphere' and motion == 'dynamic':
                number(primitive.get('radius'), 'radius', True)
                number(body.get('mass'), 'mass', True)
            else: raise ValueError('Unsupported shape/motion combination')
        if body.get('motion') == 'kinematic':
            drive = body.get('drive', {})
            if drive.get('kind') != 'rotation': raise ValueError('Expected continuous rotation drive')
            vector(drive.get('position'),3)
            q = vector(drive.get('rotation'),4)
            if abs(sum(v*v for v in q)-1)>1e-5: raise ValueError('Invalid drive rotation')
            number(drive.get('angularSpeed'), 'motor speed')
        if body.get('hinge'):
            hinge=body['hinge']
            if motion!='dynamic' or shape.get('kind')!='compound': raise ValueError('Hinge needs a dynamic compound')
            axis=vector(hinge.get('axis'),3)
            if abs(sum(v*v for v in axis)-1)>1e-5: raise ValueError('Hinge axis must be normalized')
            lo,hi=vector(hinge.get('limits'),2)
            if not lo<hi or not lo<=number(hinge.get('angle'),'hinge angle')<=hi: raise ValueError('Invalid hinge limits')
            number(body.get('mass'),'hinge mass',True)
            fractions=[number(p.get('massFraction'),'mass fraction',True) for p in pieces]
            if abs(sum(fractions)-1)>1e-6: raise ValueError('Mass fractions must sum to one')
        if number(body.get('friction'), 'friction') < 0 or not 0 <= number(body.get('restitution'), 'restitution') <= 1:
            raise ValueError('Invalid material')
    if not any(b['motion'] == 'dynamic' for b in bodies):
        raise ValueError('Scene needs a dynamic sphere')
    return scene


class World:
    def __init__(self, scene):
        validate(scene)
        self.output_scale = number(scene.get('scale', 1), 'scale', True)
        self.time_scale = math.sqrt(self.output_scale)
        scene = copy.deepcopy(scene)
        scene['timestep'] /= self.time_scale
        def scale_shape(shape):
            if shape['kind']=='compound':
                for child in shape['children']:
                    child['position']=[v/self.output_scale for v in child['position']]
                    scale_shape(child['shape'])
            elif shape['kind']=='trimesh': shape['vertices']=[v/self.output_scale for v in shape['vertices']]
            elif shape['kind']=='box': shape['size']=[v/self.output_scale for v in shape['size']]
            else: shape['radius']/=self.output_scale
        for body in scene['bodies']:
            body['position']=[v/self.output_scale for v in body['position']]
            scale_shape(body['shape'])
            if 'mass' in body: body['mass']/=self.output_scale**3
            if 'velocity' in body: body['velocity']=[v/self.time_scale for v in body['velocity']]
            if 'drive' in body:
                body['drive']['position']=[v/self.output_scale for v in body['drive']['position']]
                body['drive']['angularSpeed']*=self.time_scale
        self.scene = scene
        import newton
        import warp as wp
        self.wp = wp
        device = wp.get_device('cuda:0')
        if not device.is_cuda:
            raise RuntimeError('CUDA is required')
        newton.use_coord_layout_targets = True
        builder = newton.ModelBuilder(up_axis=newton.Axis.Y, gravity=tuple(scene['gravity']))
        self.ids = []
        self.mechanisms = []
        self.driven = []
        for b in scene['bodies']:
            pose = wp.transform(wp.vec3(*b['position']), wp.quat(*b['rotation']))
            dynamic = b['motion'] == 'dynamic'
            kinematic = b['motion'] == 'kinematic'
            hinge=b.get('hinge')
            if hinge:
                index=builder.add_link(xform=pose,label=b['id'])
                joint=builder.add_joint_revolute(-1,index,parent_xform=pose,axis=wp.vec3(*hinge['axis']),limit_lower=hinge['limits'][0],limit_upper=hinge['limits'][1],target_ke=0,target_kd=0,damping=0)
                builder.add_articulation([joint])
                builder.joint_q[builder.joint_q_start[joint]]=hinge['angle']
                self.mechanisms.append((b['id'],index))
            else:
                index = builder.add_body(xform=pose, label=b['id'], is_kinematic=kinematic) if dynamic or kinematic else -1
            if kinematic: self.driven.append((index, b['drive']))
            shape = b['shape']
            density = b['mass'] / (4 * math.pi * shape['radius']**3 / 3) if dynamic and not hinge else 1
            cfg = builder.ShapeConfig(density=density, mu=b['friction'], restitution=b['restitution'], margin=0, gap=0, mu_rolling=0, mu_torsional=0)
            pieces=shape['children'] if shape['kind']=='compound' else [dict(shape=shape)]
            for piece in pieces:
                primitive=piece['shape']
                if hinge: cfg=newton.ModelBuilder.ShapeConfig(density=b['mass']*piece['massFraction']/math.prod(primitive['size']),mu=b['friction'],restitution=b['restitution'],margin=0,gap=0)
                local=wp.transform(wp.vec3(*piece.get('position',[0,0,0])),wp.quat(*piece.get('rotation',[0,0,0,1])))
                xform=local if dynamic or kinematic else wp.transform_multiply(pose,local)
                args=dict(body=index,xform=xform,cfg=cfg)
                if primitive['kind']=='sphere': builder.add_shape_sphere(**args,radius=primitive['radius'])
                elif primitive['kind']=='trimesh':
                    vertices=[primitive['vertices'][i:i+3] for i in range(0,len(primitive['vertices']),3)]
                    builder.add_shape_mesh(**args,mesh=newton.Mesh(vertices,primitive['indices'],compute_inertia=False))
                else:
                    x,y,z=primitive['size'];builder.add_shape_box(**args,hx=x/2,hy=y/2,hz=z/2)
            if dynamic and not hinge: self.ids.append((b['id'],index))
        self.model = builder.finalize(device=device)
        # Gentle contact corrections avoid launch impulses at a rotating pocket
        # with several simultaneous contacts. Extra iterations recover convergence.
        self.solver = newton.solvers.SolverXPBD(self.model, iterations=20, rigid_contact_relaxation=.25, enable_restitution=True)
        self.state, self.next_state = self.model.state(), self.model.state()
        if self.mechanisms: newton.eval_fk(self.model,self.model.joint_q,self.model.joint_qd,self.state)
        velocities=self.state.body_qd.numpy()
        initial={b['id']:b.get('velocity',[0,0,0]) for b in scene['bodies']}
        for name,index in self.ids: velocities[index,:3]=initial[name]
        self.state.body_qd.assign(velocities)
        self.control = self.model.control()
        self.pipeline = newton.CollisionPipeline(self.model, broad_phase='explicit')
        self.contacts = self.pipeline.contacts()
        self.ticks = 0
        if self.driven:
            from drives import MotorDrives
            self.motors = MotorDrives(wp, device, self.driven)

        # Capture both ping-pong directions. Motor poses are supplied before
        # each launch; the graph contains the same collision/solver operations.
        self.graphs=[]
        for source,target in [(self.state,self.next_state),(self.next_state,self.state)]:
            with wp.ScopedCapture(device=device) as capture:
                source.clear_forces()
                self.pipeline.collide(source,self.contacts)
                self.solver.step(source,target,self.control,self.contacts,self.scene['timestep'])
            self.graphs.append(capture.graph)

    def snapshot(self):
        poses, velocities = self.state.body_q.numpy(), self.state.body_qd.numpy()
        return dict(time=self.ticks*self.scene['timestep']*self.time_scale, mechanisms=[dict(id=name,position=(poses[i,:3]*self.output_scale).tolist(),rotation=poses[i,3:].tolist()) for name,i in self.mechanisms], bodies=[dict(
            id=name, position=(poses[i, :3]*self.output_scale).tolist(), rotation=poses[i, 3:].tolist(),
            velocity=(velocities[i, :3]*self.time_scale).tolist()) for name, i in self.ids])

    def release_marble(self, name, position, velocity=None):
        position=vector(position,3)
        velocity=vector([0,0,0] if velocity is None else velocity,3)
        index=next((i for key,i in self.ids if key==name),None)
        if index is None: raise ValueError('Unknown marble')
        poses,velocities=self.state.body_q.numpy(),self.state.body_qd.numpy()
        poses[index,:3]=[v/self.output_scale for v in position]
        poses[index,3:]=[0,0,0,1]
        velocities[index]=0
        velocities[index,:3]=[v/self.time_scale for v in velocity]
        self.state.body_q.assign(poses);self.state.body_qd.assign(velocities)
        return self.snapshot()

    def step(self, observe=True):
        self.state.clear_forces()
        if self.driven: self.motors.apply(self.state, self.ticks*self.scene['timestep'], self.scene['timestep'])
        self.wp.capture_launch(self.graphs[self.ticks%2])
        self.state, self.next_state = self.next_state, self.state
        self.ticks += 1
        if self.driven: self.motors.apply(self.state, self.ticks*self.scene['timestep'], self.scene['timestep'])
        return self.snapshot() if observe else None
