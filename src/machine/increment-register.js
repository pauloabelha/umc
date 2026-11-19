import {Circuit} from '../circuit.js';
import {CELL_SIZE, placeOnLattice, latticeComponent} from '../lattice.js';
import {tGate, latticePort as port} from '../components/t-gate.js';
import {curveTrack} from '../components/curve-track.js';
import {physicalObserver} from '../simulator/physical-observer.js';

// A finite ripple-carry register. Each left exit completes INC; the last right
// exit signals overflow. Completion routes are deliberately not merged yet.
export function incrementRegister({bits=4,value=7n,scale=1,speed=1,expectedDuration=1}={}) {
  if(!Number.isInteger(bits)||bits<1||bits>64)throw new Error('Register width must be 1–64 bits');
  if(typeof value!=='bigint'||value<0n||value>=2n**BigInt(bits))throw new Error('Value does not fit register');
  const instances=[],connections=[],bitIds=[];
  for(let bit=0;bit<bits;bit++) {
    const id=`bit-${bit}`;bitIds.push(id);
    const gate=tGate({expectedDuration,initialState:(value>>BigInt(bit))&1n?'right':'left'});
    instances.push(placeOnLattice(gate,id,[3*bit,bits-bit-1,3*bit]));
    if(bit<bits-1) {
      const curve=curveTrack({radius:1.5*CELL_SIZE,expectedDuration});
      const carry=latticeComponent({name:'Curve90',size:[3,1,3],cellSize:CELL_SIZE,expectedDuration,
        ports:{in:port('input',[0,0,1.5],[-1,0,0]),out:port('output',[1.5,0,3],[0,0,1])},
        evidence:curve.evidence,semantic:curve.semantic,
        physical(id){return {bodies:curve.physical(id).bodies.map(body=>({...body,position:body.position.map((v,i)=>v+(i===2?1.5*CELL_SIZE:0))}))};}});
      instances.push(placeOnLattice(carry,`carry-${bit}`,[3*bit+3,bits-bit-1,3*bit]));
      connections.push({from:{component:id,port:'right'},to:{component:`carry-${bit}`,port:'in'}},
        {from:{component:`carry-${bit}`,port:'out'},to:{component:`bit-${bit+1}`,port:'in'}});
    }
  }
  return {circuit:new Circuit(instances,{cellSize:CELL_SIZE,scale,speed,connections}),bitIds,
    completionPorts:bitIds.map(component=>({component,port:'left'})),
    overflowPort:{component:bitIds.at(-1),port:'right'}};
}

export function registerValue(bitIds,states) {
  return bitIds.reduce((value,id,bit)=>{
    if(!['left','right'].includes(states[id]))throw new Error('Missing register bit state');
    return value|(states[id]==='right'?1n<<BigInt(bit):0n);
  },0n);
}

export function makeIncrementExperiment(entry,options={}) {
  const {circuit,bitIds}=incrementRegister(options),instance=circuit.instances[0],radius=.011;
  const input=circuit.port(instance.id,'in');
  const position=input.position.map((v,i)=>v/circuit.scale+input.up[i]*(radius+.002)-input.normal[i]*.005);
  return {entry,circuit,instance,registerBits:bitIds,
    marble:{id:'marble',position,radius,mass:.005},end:position,
    expectedDuration:(options.expectedDuration??1)*(2*bitIds.length-1)/(options.speed??1),
    pathLabel:'INC: 0111 → 1000 · right = carry · left = complete · final right = overflow',
    observe:physicalObserver(circuit,instance.id,{radius})};
}
