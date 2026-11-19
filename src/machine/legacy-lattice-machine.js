import {Composition} from '../composition.js';
import {Circuit} from '../circuit.js';
import {CELL_SIZE,placeOnLattice} from '../lattice.js';
import {transport} from '../components/lattice-transport.js';
import {latticePort as port} from '../components/t-gate.js';
import {sharedRegister} from './shared-register.js';
import {routeLattice} from './lattice-routing.js';
import {sevenInstructionProgram} from './inc-jump.js';

export function latticeMachine({bits=4,scale=1,speed=1,expectedDuration=1}={}) {
  if(!Number.isInteger(bits)||bits<1||bits>8)throw new Error('Lattice prototype supports 1–8 bits');
  const instances=[],connections=[],registers={};
  const bOffset=bits*3+12;
  for(const register of ['a','b']) {
    const assembly=sharedRegister({bits,value:0n,expectedDuration});
    const offset=register==='a'?0:bOffset;
    for(const instance of assembly.circuit.instances) {
      let definition=instance.component;
      if(register==='b'&&instance.id==='return')definition=transport({name:'CompletionOutlet',size:[3,1,3],cellSize:CELL_SIZE,expectedDuration,color:'#e7a82a',
        ports:{in:port('input',[1.5,1,0],[0,0,-1]),out:port('output',[1.5,0,3],[0,0,1])},
        paths:[[[1.5,1,0],[1.5,.5,1.5],[1.5,0,3]]]});
      instances.push(definition.instantiate(`${register}-${instance.id}`,{position:instance.position.map((n,i)=>n+(i===0?offset*CELL_SIZE:0)),yaw:instance.yaw}));
    }
    const prefix=e=>({...e,component:`${register}-${e.component}`});
    connections.push(...assembly.circuit.connections.map(({from,to})=>({from:prefix(from),to:prefix(to)})));
    registers[register]=assembly.bitIds.map(id=>`${register}-${id}`);
  }
  const entryMerge=transport({name:'EntryMerge',size:[3,1,3],cellSize:CELL_SIZE,expectedDuration,color:'#e7a82a',
    ports:{left:port('input',[0,1,1.5],[-1,0,0]),right:port('input',[3,1,1.5],[1,0,0]),out:port('output',[1.5,1,3],[0,0,1])},
    paths:[[[0,1,1.5],[1.5,1,1.5],[1.5,1,3]],[[3,1,1.5],[1.5,1,1.5],[1.5,1,3]]]});
  instances.push(placeOnLattice(entryMerge,'a-entry',[0,bits+1,-3]));
  connections.push({from:{component:'a-entry',port:'out'},to:{component:'a-bit-0',port:'in'}});
  for(const [index,instruction] of sevenInstructionProgram.entries()) {
    const definition=transport({name:instruction.op==='INC'?'IncrementEntry':'Jump',size:[3,1,3],cellSize:CELL_SIZE,expectedDuration,color:instruction.op==='INC'?'#9b59c7':'#269eaa',
      ports:{in:port('input',[1.5,1,0],[0,0,-1]),out:port('output',[1.5,0,3],[0,0,1])},
      paths:[[[1.5,1,0],[1.5,.5,1.5],[1.5,0,3]]]});
    instances.push(placeOnLattice(definition,`i${index+1}`,[index*6,0,-15]));
  }
  const base=new Circuit(instances,{cellSize:CELL_SIZE,connections});
  const link=(from,out,to,input='in')=>({from:{component:from,port:out},to:{component:to,port:input}});
  const links=[link('i1','out','a-entry','left'),link('i5','out','a-entry','right'),link('i3','out','b-bit-0'),
    link('a-return','left','i2'),link('a-return','right','i6'),link('b-return','out','i4'),
    link('i2','out','i5'),link('i4','out','i7'),link('i6','out','i3'),link('i7','out','i1')];
  const routed=routeLattice(base,links,{expectedDuration});
  const banks = ['a','b'].map(register => new Composition(`Register ${register}`, [
    Composition.fromInstances('Increment register', instances.filter(i => i.id.startsWith(`${register}-bit-`) || i.id.startsWith(`${register}-carry-`))),
    Composition.fromInstances('Completion collector', instances.filter(i => i.id.startsWith(`${register}-collect-`) || i.id.startsWith(`${register}-completion-`))),
    Composition.leaf(instances.find(i => i.id === `${register}-return`)),
  ]));
  const routes = links.map((_,index) => Composition.fromInstances(`Connection ${index+1}`,routed.instances.filter(i => i.id.startsWith(`wire-${index}-`))));
  const composition = new Composition('Seven-instruction machine', [...banks,
    Composition.leaf(instances.find(i => i.id === 'a-entry')),
    Composition.fromInstances('Instruction entries',instances.filter(i => /^i[1-7]$/.test(i.id))),
    new Composition('Routing', routes)]);
  const circuit=new Circuit([...instances,...routed.instances],{cellSize:CELL_SIZE,scale,speed,composition,connections:[...connections,...routed.connections]});
  return {circuit,registers,program:sevenInstructionProgram.map((i,index)=>({...i,id:`i${index+1}`,address:index+1})),
    overflowPorts:['a','b'].map(register=>({component:`${register}-bit-${bits-1}`,port:'right'}))};
}

export function makeLatticeMachineExperiment(entry,options={}) {
  const assembly=latticeMachine(options),{circuit}=assembly;
  const instance=circuit.instances.find(i=>i.id==='i1'),radius=.011,input=circuit.port('i1','in');
  const position=input.position.map((v,i)=>v/circuit.scale+input.up[i]*(radius+.002));
  return {entry,circuit,instance,registerBanks:assembly.registers,overflowPorts:assembly.overflowPorts,
    marble:{id:'marble',position,radius,mass:.005},end:position,
    expectedDuration:circuit.instances.reduce((sum,i)=>sum+i.component.expectedDuration,0)/circuit.speed,
    targetLabel:'Sum of component durations',
    program:assembly.program.map(i=>({...i,operation:i.op==='INC'?`INC(${i.register})`:`JUMP(${i.target})`,mechanism:i.op==='INC'?`Shared register ${i.register}`:'Connected jump route'})),
    pathLabel:'1 → 2 → 5 → 6 → 3 → 4 → 7 → 1 · shared a/b · stop on overflow',
    observe(){throw new Error('Physical seven-instruction machine is not implemented');}};
}
