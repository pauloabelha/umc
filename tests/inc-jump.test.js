import test from 'node:test';
import assert from 'node:assert/strict';
import {IncJumpMachine} from '../src/machine/inc-jump.js';

test('seven real instructions increment shared registers and jump without modifying data',()=>{
  const machine=new IncJumpMachine();
  for(let cycle=0;cycle<100;cycle++) {
    for(const pc of [1,2,5,6,3,4,7]) {
      const before=machine.snapshot();assert.equal(before.pc,pc);
      const after=machine.step();
      if([2,4,6,7].includes(pc))assert.deepEqual(after.registers,before.registers);
      else {
        const register=pc===3?'b':'a',other=pc===3?'a':'b';
        assert.equal(BigInt(after.registers[register]),BigInt(before.registers[register])+1n);
        assert.equal(after.registers[other],before.registers[other]);
      }
      assert.equal(after.instructions.filter(i=>i.status==='active').length,1);
      assert.equal(after.instructions[pc-1].executions,cycle+1);
    }
    assert.equal(machine.snapshot().pc,1);
    assert.deepEqual(machine.snapshot().registers,{a:String(2*(cycle+1)),b:String(cycle+1)});
  }
  assert.equal(machine.trace().length,700);
  assert.equal(machine.snapshot().time,700);
});

test('integer precision, timing, state isolation and recorded transitions',()=>{
  const initial=2n**64n, machine=new IncJumpMachine({registers:{a:initial,b:0n},duration:2,speed:4});
  const snapshot=machine.step();
  assert.equal(snapshot.registers.a,String(initial+1n));assert.equal(snapshot.time,.5);
  snapshot.registers.a='bad';snapshot.instructions[0].op='bad';
  assert.equal(machine.snapshot().registers.a,String(initial+1n));
  const event=machine.trace()[0];assert.equal(event.before.a,String(initial));assert.equal(event.after.a,String(initial+1n));
  event.after.a='bad';assert.equal(machine.trace()[0].after.a,String(initial+1n));
  assert.deepEqual(new IncJumpMachine().snapshot().registers,{a:'0',b:'0'});
});

test('rejects programs with missing registers, invalid jumps and implicit fallthrough',()=>{
  for(const program of [[{op:'JUMP',target:0}],[{op:'JUMP',target:2}],[{op:'JUMP',target:1.5}],[{op:'INC',register:'a'}],[{op:'INC',register:'c'},{op:'JUMP',target:1}],[{op:'DEC',register:'a'}]])
    assert.throws(()=>new IncJumpMachine({program}));
  assert.throws(()=>new IncJumpMachine({speed:0}));
  assert.throws(()=>new IncJumpMachine({registers:{a:-1n,b:0n}}));
});
