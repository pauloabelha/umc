import test from 'node:test';
import assert from 'node:assert/strict';
import {instructionTriad} from '../src/simulator/instruction-triad.js';
import {sevenInstructionProgram} from '../src/machine/inc-jump.js';
const program=sevenInstructionProgram.map((item,index)=>({...item,id:`i${index+1}`,address:index+1}));
test('instruction triad follows jumps and preserves observed predecessor',()=>{
  assert.equal(instructionTriad(program,'i1').previous,undefined);
  assert.equal(instructionTriad(program,'i1').next.id,'i2');
  const jump=instructionTriad(program,'i2','i1');
  assert.equal(jump.previous.id,'i1');assert.equal(jump.current.id,'i2');assert.equal(jump.next.id,'i5');
  assert.equal(instructionTriad(program,'i1','i7').previous.id,'i7');
  assert.equal(instructionTriad(program,'i5','i2',true).next,undefined);
});
