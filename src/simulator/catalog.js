import {MARBLE_FRICTION} from '../materials.js';
import {Composition} from '../composition.js';
import {makeLatticeMachineExperiment} from '../machine/lattice-machine.js';
import {makeSharedRegisterExperiment} from '../machine/shared-register.js';
import {makeIncrementExperiment} from '../machine/increment-register.js';
import {makeJumpExperiment} from './jump-experiment.js';
import {makeCounterExperiment} from './counter-experiment.js';
import {makeLatticeExperiment} from './lattice-experiment.js';
import {makeFerrisGateLoop} from './ferris-gate-loop.js';
import {straightTrack} from '../components/straight-track.js';
import {curveTrack} from '../components/curve-track.js';
import {ramp} from '../components/ramp.js';
import {ferry} from '../components/ferry.js';
import {Circuit} from '../circuit.js';
import {add,yawVector} from '../geometry/transforms.js';

export const componentCatalog = Object.freeze([
  {id:'seven-instruction-lattice',label:'Seven-instruction machine',kind:'Assembly',count:113,description:'Shared INC registers, explicit JUMP tracks, Ferris wheels and T-gates. Finite registers stop on overflow.'},
  {id:'shared-register',label:'INC · collector and return',kind:'Instruction assembly',count:15,modes:['semantic'],description:'All successful carry paths collect into one return T-gate. Proposed lattice routing for shared register a.'},
  {id:'inc-register',label:'INC · four-bit register',kind:'Instruction assembly',count:7,description:'Four physical seesaws with level carry curves. Watch 7 become 8; the final right exit reports overflow.'},
  {id:'jump-machine',label:'Five-address routing demo',kind:'Archived concept',count:5,closed:true,modes:['semantic'],description:'Routing addresses, not INC/JUMP instructions. Uses an abstract lift; not VTech-buildable.'},
  {id:'two-bit-counter',label:'Two-bit counter',kind:'Abstract wiring',count:9,closed:true,modes:['semantic'],description:'Count 00 → 01 → 10 → 11 → 00. Uses an abstract return lift; not a physical VTech assembly.'},
  {id:'t-gate',label:'T-gate · two-level seesaw',kind:'Component',count:1,description:'A passive seesaw and divider alternate the lower exits. Occupies two levels; descends one level.'},
  {id:'toggle-loop',label:'Ferris wheel + T-gate loop',kind:'Assembly',count:16,closed:true,description:'Real wheel mechanism raises one level; seesaw lowers one level. Both branches return on level tracks.'},
  {id:'straight-track',label:'Straight track',kind:'Component',count:1,description:'Level track; requires incoming momentum.'},
  {id:'curve-track',label:'90° curve',kind:'Component',count:1,description:'A level quarter turn; requires incoming momentum.'},
  {id:'ferry',label:'Ferris elevator',kind:'Prototype',count:1,description:'A continuously rotating eight-pocket wheel lifts and releases marbles.'},
  {id:'ramp',label:'Ramp',kind:'Component',count:1,description:'A descending channel with smooth entry and exit.'},
  {id:'two-tracks',label:'Two connected tracks',kind:'Assembly',count:2,description:'Two instances joined at their ports. One continuous path.'},
  {id:'closed-loop',label:'Ferris wheel · ramp circuit',kind:'Assembly',count:9,closed:true,description:'An elevator, four bends, three tracks, and a ramp return the marble to the start.'},
]);

export const catalog = Object.freeze(['closed-loop', 'toggle-loop', 'seven-instruction-lattice'].map(id => componentCatalog.find(entry => entry.id === id)));

export function makeExperiment({component='straight-track',scale=1,speed=1,expectedDuration=1,initialState='left',bits=4}={}) {
  const entry=componentCatalog.find(item=>item.id===component);
  if(!entry)throw new Error('Unknown component');
  if(entry.id==='toggle-loop')return makeFerrisGateLoop(entry,{scale,speed,expectedDuration,initialState});
  if(entry.id==='seven-instruction-lattice')return makeLatticeMachineExperiment(entry,{scale,speed,expectedDuration,bits});
  if(entry.id==='shared-register')return makeSharedRegisterExperiment(entry,{scale,speed,expectedDuration});
  if(entry.id==='inc-register')return makeIncrementExperiment(entry,{scale,speed,expectedDuration});
  if(entry.id==='jump-machine')return makeJumpExperiment(entry,{scale,speed,expectedDuration});
  if(entry.id==='two-bit-counter')return makeCounterExperiment(entry,{scale,speed,expectedDuration});
  if(entry.modes||entry.id==='t-gate') return makeLatticeExperiment(entry,{scale,speed,expectedDuration,initialState});
  const instances=[],connections=[];
  if(entry.closed) {
    const elevator=ferry({expectedDuration:expectedDuration*5});
    const lift=elevator.ports.out.position[1],reach=elevator.ports.out.position[0];
    const definitions=[
      ['elevator',elevator,0],
      ['top-track',straightTrack({length:.06,smoothEnds:true,expectedDuration}),0],
      ['bend-1',curveTrack({radius:.06,expectedDuration}),0],
      ['ramp',ramp({length:.18,drop:lift,expectedDuration}),-Math.PI/2],
      ['bend-2',curveTrack({radius:.06,expectedDuration}),-Math.PI/2],
      ['back-track',straightTrack({length:.06+reach,smoothEnds:true,expectedDuration}),-Math.PI],
      ['bend-3',curveTrack({radius:.06,expectedDuration}),-Math.PI],
      ['return-track',straightTrack({length:.18,smoothEnds:true,expectedDuration}),-3*Math.PI/2],
      ['bend-4',curveTrack({radius:.06,expectedDuration}),-3*Math.PI/2],
    ];
    let end=[0,0,0];
    for(const [id,definition,yaw] of definitions) {
      const position=add(end,yawVector(definition.ports.in.position,yaw).map(v=>-v));
      instances.push(definition.instantiate(id,{position,yaw}));
      end=add(position,yawVector(definition.ports.out.position,yaw));
    }
  } else {
    const factory={'straight-track':straightTrack,'two-tracks':straightTrack,'curve-track':curveTrack,ramp,ferry}[component];
    const definition=factory({expectedDuration:component==='ferry'?expectedDuration*5:expectedDuration});
    instances.push(definition.instantiate(entry.count===2?'track-1':'component'));
    if(entry.count===2)instances.push(definition.instantiate('track-2',{position:definition.ports.out.position}));
  }
  for(let i=0;i<instances.length-(entry.closed?0:1);i++) connections.push({from:{component:instances[i].id,port:'out'},to:{component:instances[(i+1)%instances.length].id,port:'in'}});
  const composition=entry.closed?new Composition(entry.label,[Composition.leaf(instances[0]),Composition.fromInstances('Ramp and return tracks',instances.slice(1))]):Composition.fromInstances(entry.label,instances);
  const instance=instances[0],circuit=new Circuit(instances,{scale,speed,connections,composition});
  const radius=.011,definition=instance.component,up=definition.ports.in.up;
  let start;
  if(definition.name==='FerryElevator')start=[.02,.012,0];
  else if(definition.evidence.path) {
    const [a,b]=definition.evidence.path;start=a.map((v,i)=>v+(b[i]-v)*.5+up[i]*(radius+.002));
  } else {
    const {length,drop}=definition.evidence.dimensions;
    start=[length/15,-drop/15,0].map((v,i)=>v+up[i]*(radius+.002));
  }
  // Flat standalone tracks receive an incoming marble; gravity cannot start
  // a marble from rest on a level floor. This is an explicit inlet fixture.
  const velocity=['straight-track','two-tracks','curve-track'].includes(component)?[.4,0,0]:[0,0,0];
  const marble={id:'marble',position:start,radius,mass:.005,velocity};
  const finalPort=circuit.port(instances.at(-1).id,'out');
  const end=finalPort.position.map((v,i)=>v+finalPort.up[i]*radius*scale);
  let stage=0,laps=0,observationStart=0;
  function observe(previous,current) {
    const active=instances[stage],out=circuit.port(active.id,'out');
    const distance=p=>p.reduce((sum,v,i)=>sum+(v-out.position[i])*out.normal[i],0);
    if(distance(previous.position)<0&&distance(current.position)>=0) {
      const delta=current.position.map((v,i)=>v-out.position[i]);
      const height=delta.reduce((sum,v,i)=>sum+v*out.up[i],0);
      const side=[-out.normal[2],0,out.normal[0]];
      const lateral=Math.abs(delta.reduce((sum,v,i)=>sum+v*side[i],0));
      const {width,wallHeight}=active.component.evidence.dimensions;
      const inside=lateral<=(width/2-radius+.001)*scale && height>radius*scale/3 && height<wallHeight*scale;
      // A wheel can cross the outlet's vertical plane while still below its outlet.
      if(inside) {
        stage++;
        if(stage===instances.length) {
          laps++;
          if(!entry.closed)return {status:'exited',output:'out',...current};
          stage=0;
        }
      } else if(!entry.closed&&active.component.name!=='FerryElevator') return {status:'escaped',output:null,...current};
    }
    current.laps=laps;
    current.component=instances[stage].id;
    if(current.position[1]<-.25*scale)return {status:'escaped',output:null,...current};
    if(!entry.closed&&current.time-observationStart>=(definition.name==='FerryElevator'?20:8)*Math.sqrt(scale))return {status:'timeout',output:null,...current};
    return null;
  }
  return {instance,circuit,marble,end,observe,entry,resetObservation(time){stage=0;observationStart=time;},expectedDuration:instances.reduce((sum,i)=>sum+i.component.expectedDuration,0)/speed};
}

export function experimentScene({circuit,marble},timestep=1/240) {
  const {scale}=circuit;
  return {format:'umc-scene',version:1,scale,timestep,physicalSupported:circuit.physicalSupported,lattice:circuit.lattice,visuals:circuit.visuals(),gravity:[0,-9.81,0],bodies:[...circuit.bodies(),
    {id:marble.id,motion:'dynamic',shape:{kind:'sphere',radius:marble.radius*scale},position:marble.position.map(v=>v*scale),
      rotation:[0,0,0,1],mass:marble.mass*scale**3,velocity:(marble.velocity??[0,0,0]).map(v=>v*Math.sqrt(scale)),friction:MARBLE_FRICTION,restitution:0}]};
}
