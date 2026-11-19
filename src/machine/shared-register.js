import {Composition} from '../composition.js';
import {Circuit} from '../circuit.js';
import {CELL_SIZE,placeOnLattice} from '../lattice.js';
import {tGate,latticePort as port} from '../components/t-gate.js';
import {transport} from '../components/lattice-transport.js';
import {incrementRegister} from './increment-register.js';

// Spatial completion collector for the fixed program's shared INC(a).
// The return gate's phase alternates continuation 2 / 6. No caller metadata.
export function sharedRegister({bits=4,value=7n,returnState='left',scale=1,speed=1,expectedDuration=1}={}) {
  const register=incrementRegister({bits,value,scale,speed,expectedDuration});
  const instances=register.circuit.instances.map(({component,id,position,yaw})=>
    component.instantiate(id,{position:position.map((v,i)=>v+(i===1?2*CELL_SIZE:0)),yaw}));
  const connections=[...register.circuit.connections];
  const connect=(from,output,to,input='in')=>connections.push({from:{component:from,port:output},to:{component:to,port:input}});
  for(let bit=0;bit<bits;bit++) {
    const ports={branch:port('input',[3,1,1.5],[1,0,0]),out:port('output',[1.5,0,3],[0,0,1])};
    const paths=[[[3,1,1.5],[2, .8,1.5],[1.5,.3,2.5],[1.5,0,3]]];
    if(bit>0) {
      ports.in=port('input',[1.5,1,0],[0,0,-1]);
      paths.push([[1.5,1,0],[1.5,.8,1.5],[1.5,.3,2.5],[1.5,0,3]]);
    }
    const merge=transport({name:'CompletionMerge',size:[3,1,3],ports,paths,cellSize:CELL_SIZE,expectedDuration,color:'#e7a82a'});
    instances.push(placeOnLattice(merge,`collect-${bit}`,[-3,bits-bit,3*bit]));
    if(bit===0)connect('bit-0','left','collect-0','branch');
    else {
      const length=3*bit;
      const branch=transport({name:'CompletionTrack',size:[length,1,3],cellSize:CELL_SIZE,expectedDuration:expectedDuration*bit,color:'#269eaa',
        ports:{in:port('input',[length,1,1.5],[1,0,0]),out:port('output',[0,1,1.5],[-1,0,0])},
        paths:[[[length,1,1.5],[0,1,1.5]]]});
      instances.push(placeOnLattice(branch,`completion-${bit}`,[0,bits-bit,3*bit]));
      connect(`bit-${bit}`,'left',`completion-${bit}`);
      connect(`completion-${bit}`,'out',`collect-${bit}`,'branch');
      connect(`collect-${bit-1}`,'out',`collect-${bit}`);
    }
  }
  instances.push(placeOnLattice(tGate({expectedDuration,initialState:returnState}),'return',[-3,0,3*bits]));
  connect(`collect-${bits-1}`,'out','return');
  const composition = new Composition('Shared register', [
    Composition.fromInstances('Increment register', instances.filter(i => /^(bit|carry)-/.test(i.id))),
    Composition.fromInstances('Completion collector', instances.filter(i => /^(collect|completion)-/.test(i.id))),
    Composition.leaf(instances.find(i => i.id === 'return')),
  ]);
  return {circuit:new Circuit(instances,{cellSize:CELL_SIZE,scale,speed,connections,composition}),bitIds:register.bitIds,
    completionPorts:[{component:'return',port:'left',instruction:2},{component:'return',port:'right',instruction:6}],
    overflowPort:register.overflowPort};
}

export function makeSharedRegisterExperiment(entry,options={}) {
  const {circuit,bitIds}=sharedRegister(options),instance=circuit.instances[0],radius=.011;
  const input=circuit.port(instance.id,'in');
  const position=input.position.map((v,i)=>v/circuit.scale+input.up[i]*(radius+.002));
  return {entry,circuit,instance,registerBits:bitIds,returnGate:'return',
    marble:{id:'marble',position,radius,mass:.005},end:position,
    expectedDuration:(options.expectedDuration??1)*(3*bitIds.length)/(options.speed??1),
    pathLabel:'INC(a): carry → completion collector → return gate · left: instruction 2 · right: instruction 6',
    observe(){throw new Error('Physical shared register switching is not implemented');}};
}
