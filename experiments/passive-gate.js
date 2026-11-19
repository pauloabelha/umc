import RAPIER from '@dimforge/rapier3d-compat';
let initialized;

// Contact-only rocking V gate: no motors, timers, marble-dependent impulses or
// semantic state updates. Experimental mechanism, not a measured VTech replica.
export async function probePassiveGate({angle=.6,wingAngle=.2,height=.012,length=.045,mass=.001,
  ballMass=.005,ballRadius=.011,drop=.13,offset=0,timestep=1/480,count=6,damping=.1,initial=-1,lengthUnit=1,guide=null,shape='v'}={}) {
  if(![angle,wingAngle,height,length,mass,ballMass,ballRadius,drop,timestep,lengthUnit].every(n=>Number.isFinite(n)&&n>0)||!Number.isFinite(offset)||!Number.isFinite(damping)||damping<0||!Number.isInteger(count)||count<1||![-1,1].includes(initial))throw new Error('Invalid passive gate experiment');
  await(initialized??=RAPIER.init());
  const world=new RAPIER.World({x:0,y:-9.81,z:0});world.timestep=timestep;
  world.numSolverIterations=12;
  world.integrationParameters.lengthUnit=lengthUnit;
  try {
    const anchor=world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    if(guide) {
      const {top=.12,neck=.06,bottom=.04,wide=.025,throat=.0115}=guide;
      if(!(top>neck&&neck>bottom&&wide>throat&&throat>ballRadius))throw new Error('Invalid inlet guide');
      for(const sign of [-1,1]) {
        const points=[[sign*wide,top],[sign*throat,neck],[sign*throat,bottom]];
        for(let i=0;i<2;i++) {
          const a=points[i],b=points[i+1],dx=b[0]-a[0],dy=b[1]-a[1],theta=Math.atan2(dy,dx);
          // Thin wall is offset away from the desired inner guide surface.
          const normal=[sign*Math.abs(dy)/Math.hypot(dx,dy),sign*dx/Math.hypot(dx,dy)];
          world.createCollider(RAPIER.ColliderDesc.cuboid(Math.hypot(dx,dy)/2,.001,.025)
            .setTranslation((a[0]+b[0])/2+normal[0]*.001,(a[1]+b[1])/2+normal[1]*.001,0)
            .setRotation({x:0,y:0,z:Math.sin(theta/2),w:Math.cos(theta/2)})
            .setFriction(.15).setRestitution(0),anchor);
        }
      }
    }

    const rocker=world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setCanSleep(false).setCcdEnabled(true).setAngularDamping(damping));
    const wings=[];
    if(shape==='inverted-t') {
      wings.push(world.createCollider(RAPIER.ColliderDesc.cuboid(length,.002,.025)
        .setMass(mass*.2).setFriction(.2).setRestitution(0),rocker));
      wings.push(world.createCollider(RAPIER.ColliderDesc.cuboid(.002,height/2,.025)
        .setTranslation(0,height/2,0).setMass(mass*.8).setFriction(.2).setRestitution(0),rocker));
    } else if(shape==='t') {
      wings.push(world.createCollider(RAPIER.ColliderDesc.cuboid(length,.002,.025)
        .setTranslation(0,height,0).setMass(mass*.9).setFriction(.2).setRestitution(0),rocker));
      wings.push(world.createCollider(RAPIER.ColliderDesc.cuboid(.002,height/2,.025)
        .setTranslation(0,height/2,0).setMass(mass*.1).setFriction(.2).setRestitution(0),rocker));
    } else {
    for(const sign of [-1,1]) {
      const a=sign*wingAngle;
      wings.push(world.createCollider(RAPIER.ColliderDesc.cuboid(length/2,.002,.025)
        .setTranslation(sign*length/2*Math.cos(wingAngle),height+length/2*Math.sin(wingAngle),0)
        .setRotation({x:0,y:0,z:Math.sin(a/2),w:Math.cos(a/2)})
        .setMass(mass/2).setFriction(.2).setRestitution(0),rocker));
    }
    }
    const joint=world.createImpulseJoint(RAPIER.JointData.revolute({x:0,y:0,z:0},{x:0,y:0,z:0},{x:0,y:0,z:1}),anchor,rocker,true);
    joint.setLimits(-angle,angle);
    rocker.setRotation({x:0,y:0,z:Math.sin(initial*angle/2),w:Math.cos(initial*angle/2)},true);
    const orientation=()=>{const q=rocker.rotation();return 2*Math.atan2(q.z,q.w);};
    const events=[];
    for(let i=0;i<Math.ceil(.5/timestep);i++)world.step();
    for(let i=0;i<count;i++) {
      const before=orientation();
      const ball=world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(offset,drop,0).setCcdEnabled(true).setCanSleep(false));
      const ballCollider=world.createCollider(RAPIER.ColliderDesc.ball(ballRadius).setMass(ballMass).setFriction(.2).setRestitution(0),ball);
      let exit=null,contacts=0;
      for(let tick=0;tick<Math.ceil(3/timestep);tick++) {
        world.step();const p=ball.translation();
        for(const wing of wings)world.contactPair(wing,ballCollider,manifold=>{if(manifold.numContacts()>0)contacts++;});
        if(Math.abs(p.x)>.075||p.y<-.08){exit={side:Math.abs(p.x)>.075?(p.x<0?'left':'right'):null,position:[p.x,p.y,p.z],time:(tick+1)*timestep};break;}
      }
      const finalPosition=Object.values(ball.translation());
      world.removeRigidBody(ball);
      for(let tick=0;tick<Math.ceil(.5/timestep);tick++)world.step();
      events.push({before,after:orientation(),contacts,exit,finalPosition});
    }
    return {events,alternating:events.every((e,i)=>e.contacts>0&&e.exit&&e.exit.side===(initial<0?(i%2?'right':'left'):(i%2?'left':'right'))&&Math.sign(e.after)===-Math.sign(e.before)&&Math.abs(e.after)>.95*angle)};
  } finally {world.free();}
}
