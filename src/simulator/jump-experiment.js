import {Circuit} from '../circuit.js';
import {makeLatticeExperiment} from './lattice-experiment.js';

// Instruction addresses are names for physical locations, not spatial order.
// Reuse the validated two-branch lattice layout; every jump has a joined path.
export function makeJumpExperiment(entry,options={}) {
  const layout=makeLatticeExperiment({...entry,closed:true},options);
  const ids={gate:'i1',merge:'i2','left-return':'i3',elevator:'i4','right-return':'i5'};
  const instances=layout.circuit.instances.map(({id,component,position,yaw})=>component.instantiate(ids[id],{position,yaw}));
  const endpoint=({component,port})=>({component:ids[component],port});
  const circuit=new Circuit(instances,{scale:layout.circuit.scale,speed:layout.circuit.speed,
    cellSize:layout.circuit.lattice.cellSize,
    connections:layout.circuit.connections.map(({from,to})=>({from:endpoint(from),to:endpoint(to)}))});
  const instance=instances.find(i=>i.id==='i1'),input=circuit.port(instance.id,'in');
  const position=input.position.map((v,i)=>v/circuit.scale+input.up[i]*(layout.marble.radius+.002));
  return {...layout,circuit,instance,marble:{...layout.marble,position},end:position,lapComponent:'i4',
    pathLabel:'1 → 3 → 2 → 4 → 1 · then 1 → 5 → 2 → 4 → 1',
    program:[
      {id:'i1',address:1,operation:'Toggle; JUMP 3 if old bit = 0, otherwise JUMP 5',mechanism:'T-gate',targets:[3,5]},
      {id:'i2',address:2,operation:'JUMP 4',mechanism:'Merge into elevator',targets:[4]},
      {id:'i3',address:3,operation:'JUMP 2',mechanism:'Left return track',targets:[2]},
      {id:'i4',address:4,operation:'LIFT; JUMP 1',mechanism:'Two-level elevator',targets:[1]},
      {id:'i5',address:5,operation:'JUMP 2',mechanism:'Right return track',targets:[2]},
    ]};
}
