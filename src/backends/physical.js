import {MARBLE_FRICTION} from '../materials.js';
import {drivePose,scaleShape,multiply} from '../geometry/transforms.js';
import RAPIER from '@dimforge/rapier3d-compat';

let initialization;
export async function physicalWorld(circuit, {timestep = 1 / 240} = {}) {
  if (!circuit.physicalSupported) throw new Error('Physical mechanism not implemented for this lattice prototype');
  if (!Number.isFinite(timestep) || timestep <= 0 || timestep > 1 / 30) throw new Error('Invalid timestep');
  await (initialization ??= RAPIER.init());
  const world = new RAPIER.World({x: 0, y: -9.81, z: 0});
  world.timestep = timestep / Math.sqrt(circuit.scale);
  world.integrationParameters.lengthUnit = .1;
  world.numSolverIterations = 12;
  const {scale} = circuit;
  const timeScale = Math.sqrt(scale);
  const driven = [];
  const mechanisms=new Map();
  try {
    for (const source of circuit.bodies()) {
      const body = {...source,position:source.position.map(v=>v/scale),shape:scaleShape(source.shape,1/scale)};
      if(source.drive?.kind==='rotation')body.drive={...source.drive,position:source.drive.position.map(v=>v/scale),angularSpeed:source.drive.angularSpeed*timeScale};
      else if(source.drive)body.drive={period:source.drive.period/timeScale,frames:source.drive.frames.map(f=>({...f,time:f.time/timeScale,position:f.position.map(v=>v/scale)}))};
      if (!['fixed','kinematic','dynamic'].includes(body.motion) || !['box','compound','trimesh'].includes(body.shape.kind)) throw new Error('Unsupported physical body');
      const angle=body.hinge?.angle??0,axis=body.hinge?.axis??[0,0,1];
      const [x, y, z, w] = multiply(body.rotation,[...axis.map(v=>v*Math.sin(angle/2)),Math.cos(angle/2)]);
      const descriptor = body.motion === 'dynamic' ? RAPIER.RigidBodyDesc.dynamic().setCanSleep(false).setCcdEnabled(true).setAngularDamping(.1) : body.motion === 'kinematic' ? RAPIER.RigidBodyDesc.kinematicPositionBased() : RAPIER.RigidBodyDesc.fixed();
      const rigid = world.createRigidBody(descriptor
        .setTranslation(...body.position).setRotation({x, y, z, w}));
      if(body.drive) driven.push({rigid,drive:body.drive});
      if(body.hinge) {
        const [x,y,z,w]=body.rotation;
        const anchor=world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(...body.position).setRotation({x,y,z,w}));
        const [ax,ay,az]=body.hinge.axis;
        const joint=world.createImpulseJoint(RAPIER.JointData.revolute({x:0,y:0,z:0},{x:0,y:0,z:0},{x:ax,y:ay,z:az}),anchor,rigid,true);
        joint.setLimits(...body.hinge.limits);mechanisms.set(body.id,rigid);
      }
      const pieces=body.shape.kind==='compound'?body.shape.children:[{position:[0,0,0],rotation:[0,0,0,1],shape:body.shape}];
      for(const piece of pieces) {
        const [x,y,z,w]=piece.rotation;
        const collider=piece.shape.kind==='trimesh'?RAPIER.ColliderDesc.trimesh(new Float32Array(piece.shape.vertices),new Uint32Array(piece.shape.indices),RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES):RAPIER.ColliderDesc.cuboid(...piece.shape.size.map(v=>v/2));
        if(body.motion==='dynamic')collider.setMass(body.mass/scale**3*(piece.massFraction??1/pieces.length));
        world.createCollider(collider
          .setTranslation(...piece.position).setRotation({x,y,z,w}).setFriction(body.friction).setRestitution(body.restitution),rigid);
      }
    }
    if(mechanisms.size){world.numSolverIterations=12;world.integrationParameters.lengthUnit=.1;}
    const marbles = new Map();
    let ticks = 0;
    return {
      mechanismSnapshot() {return [...mechanisms].map(([id,body])=>{const p=body.translation(),q=body.rotation();return {id,position:[p.x*scale,p.y*scale,p.z*scale],rotation:[q.x,q.y,q.z,q.w]};});},
      addMarble({id, position, radius = 0.011, mass = 0.005,velocity=[0,0,0]}) {
        if (typeof id !== 'string' || !id || marbles.has(id)) throw new Error('Invalid or duplicate marble ID');
        if (!Array.isArray(position) || position.length !== 3 || !position.every(Number.isFinite) ||
            ![radius, mass].every(v => Number.isFinite(v) && v > 0)) throw new Error('Invalid marble');
        if(!Array.isArray(velocity)||velocity.length!==3||!velocity.every(Number.isFinite))throw new Error('Invalid marble velocity');
        const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setCanSleep(false).setTranslation(...position).setCcdEnabled(true));
        body.setLinvel({x:velocity[0],y:velocity[1],z:velocity[2]},true);
        world.createCollider(RAPIER.ColliderDesc.ball(radius).setMass(mass).setFriction(MARBLE_FRICTION).setRestitution(0), body);
        marbles.set(id, body);
      },
      releaseMarble(id,position,velocity=[0,0,0]) {
        const body=marbles.get(id);
        if(!body||!Array.isArray(position)||position.length!==3||!position.every(Number.isFinite)||!Array.isArray(velocity)||velocity.length!==3||!velocity.every(Number.isFinite))throw new Error('Invalid marble release');
        body.setTranslation({x:position[0],y:position[1],z:position[2]},true);
        body.setLinvel({x:velocity[0],y:velocity[1],z:velocity[2]},true);body.setAngvel({x:0,y:0,z:0},true);
        return this.snapshot(id);
      },
      step() {
        for(const {rigid,drive} of driven) {
          const pose=drivePose(drive,(ticks+1)*timestep/timeScale),[x,y,z,w]=pose.rotation;
          rigid.setNextKinematicTranslation({x:pose.position[0],y:pose.position[1],z:pose.position[2]});
          rigid.setNextKinematicRotation({x,y,z,w});
        }
        world.step(); ticks++;
      },
      snapshot(id) {
        const body = marbles.get(id);
        if (!body) throw new Error('Unknown marble');
        const p = body.translation(), v = body.linvel();
        return {id, time: ticks * timestep, position: [p.x*scale, p.y*scale, p.z*scale], velocity: [v.x*timeScale, v.y*timeScale, v.z*timeScale],mechanisms:this.mechanismSnapshot()};
      },
      dispose() { world.free(); },
    };
  } catch (error) { world.free(); throw error; }
}
