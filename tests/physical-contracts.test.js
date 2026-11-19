import test from 'node:test';
import assert from 'node:assert/strict';
import {straightTrack} from '../src/components/straight-track.js';
import {curveTrack} from '../src/components/curve-track.js';
import {ferry} from '../src/components/ferry.js';
import {tGate} from '../src/components/t-gate.js';
import {Circuit} from '../src/circuit.js';
import {CELL_SIZE} from '../src/lattice.js';
import {physicalWorld} from '../src/backends/physical.js';
import {makeExperiment} from '../src/simulator/catalog.js';
import {makeIncrementExperiment,registerValue} from '../src/machine/increment-register.js';
import {createSession} from '../src/simulator/session.js';

test('flat tracks cannot manufacture gravity-driven motion',async()=>{
 for(const definition of [straightTrack(),curveTrack()]){
  assert.ok(Math.abs(definition.ports.in.position[1]-definition.ports.out.position[1])<1e-12);
  assert.ok(definition.physical('track').bodies.every(b=>b.friction<=.005));
 }
 assert.throws(()=>straightTrack({drop:.01}),/stay level/);
 assert.throws(()=>curveTrack({drop:.01}),/stay level/);
 const world=await physicalWorld(new Circuit([straightTrack().instantiate('track')]));
 try{
  world.addMarble({id:'m',position:[.1,.011,0]});
  for(let i=0;i<240;i++)world.step();
  assert.ok(Math.abs(world.snapshot('m').position[0]-.1)<1e-5);
 }finally{world.dispose();}
});

test('wheel and gate exchange exactly one level; loop has real mechanisms and level returns',()=>{
 const wheel=ferry(),gate=tGate();
 assert.equal(wheel.ports.out.position[1]-wheel.ports.in.position[1],CELL_SIZE);
 assert.equal(gate.lattice.size[1],2);
 for(const output of ['left','right'])assert.equal(gate.ports.in.position[1]-gate.ports[output].position[1],CELL_SIZE);
 const {circuit}=makeExperiment({component:'toggle-loop'});
 assert.equal(circuit.physicalSupported,true);
 assert.equal(circuit.instances.filter(i=>i.component.name==='FerryElevator').length,1);
 for(const {component} of circuit.instances){
  assert.ok(!/Lift|Drop|LatticeElevator/.test(component.name));
  if(['TGate','FerryElevator'].includes(component.name))continue;
  const heights=Object.values(component.ports).map(p=>p.position[1]);
  assert.ok(heights.every(y=>Math.abs(y-heights[0])<1e-9));
 }
});

test('four physical seesaws increment every four-bit value, including overflow',async()=>{
 for(let input=0;input<16;input++){
  const e=makeIncrementExperiment({id:'inc-register'},{bits:4,value:BigInt(input)});
  assert.equal(e.circuit.physicalSupported,true);
  const session=await createSession(e,'cpu');
  try{
   let snapshot;
   for(let step=0;step<600;step++){snapshot=await session.step();if(snapshot.result)break;}
   assert.equal(snapshot.result?.status,'exited',`input ${input}`);
   assert.equal(registerValue(e.registerBits,snapshot.componentStates),BigInt((input+1)%16));
   assert.equal(snapshot.result.output,input===15?'right':'left');
  }finally{await session.dispose();}
 }
});
