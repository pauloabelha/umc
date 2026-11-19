import test from 'node:test';
import assert from 'node:assert/strict';
import {logicGates} from '../src/logic/gates.js';
import {makeLogicExperiment} from '../src/logic/circuit.js';
import {createLogicSession} from '../src/logic/session.js';
const reference={buffer:a=>a,not:a=>1-a,and:(a,b)=>a&b,or:(a,b)=>a|b,nand:(a,b)=>1-(a&b),nor:(a,b)=>1-(a|b),xor:(a,b)=>a^b,xnor:(a,b)=>1-(a^b)};
for(const spec of [...logicGates,{id:'half-adder',inputs:2}])test(`${spec.id}: every input repeats through the closed primitive circuit`,async()=>{
 for(const a of [0,1])for(const b of (spec.inputs===1?[0]:[0,1])) {
  const e=makeLogicExperiment({gate:spec.id,a,b});
  assert.deepEqual(e.circuit.elevationIssues,[]);assert.equal(e.circuit.physicalSupported,true);
  assert.equal(e.circuit.composition.instances.length,e.circuit.instances.length);
  assert.equal(e.circuit.level,3);
  const s=await createLogicSession(e,'semantic');
  try {
   let state;
   for(let step=0;step<300;step++){state=await s.step();if(state.current.laps===5)break;}
   assert.equal(state.current.laps,5);
   for(const lap of state.logic.completed)for(const [id,o] of Object.entries(lap.outputs)) {
    assert.equal(o.value,reference[id](a,b));assert.deepEqual(o.inputs,spec.inputs===1?[a]:[a,b]);
   }
   if(e.half)for(const lap of state.logic.completed)assert.equal(lap.outputs.xor.value+2*lap.outputs.and.value,a+b);
   assert.equal((await s.step()).result,null);
  }finally{await s.dispose();}
 }
});
test('logic rejects invalid input and unknown examples',()=>{
 for(const a of [-1,2,NaN,true])assert.throws(()=>makeLogicExperiment({a}),/0 or 1/);
 assert.throws(()=>makeLogicExperiment({gate:'unknown'}),/Unknown/);
});
