import test from 'node:test';
import assert from 'node:assert/strict';
import {GateMachine} from '../src/machine/gate-machine.js';
import {IncJumpMachine} from '../src/machine/inc-jump.js';

test('gate wiring refines all seven instructions against the reference model until capacity',()=>{
  for(const bits of [1,2,4,8])for(const speed of [1,4]) {
    const gates=new GateMachine({bits,speed}),reference=new IncJumpMachine({speed});
    const limit=2n**BigInt(bits)-1n;
    for(let instruction=0;instruction<2000;instruction++) {
      const before=reference.snapshot(),operation=before.instructions[before.pc-1];
      const overflow=operation.op==='INC'&&BigInt(before.registers[operation.register])===limit;
      const state=gates.step();
      if(overflow) {
        assert.match(state.halt,/overflow/);
        assert.equal(state.steps,before.steps);
        assert.equal(state.pc,before.pc);
        assert.deepEqual(gates.step(),state,'overflow cannot silently continue');
        break;
      }
      const expected=reference.step();
      assert.equal(state.halt,null);
      assert.equal(state.pc,expected.pc);
      assert.deepEqual(state.registers,expected.registers);
      assert.deepEqual(state.instructions,expected.instructions);
      assert.deepEqual(gates.trace(1)[0].before,reference.trace(1)[0].before);
    }
  }
});

test('two callers use one register bank and a visible alternating return gate',()=>{
  const machine=new GateMachine();
  const topology=machine.topology();
  assert.equal(topology.find(n=>n.id==='i1').routes.out,'a-bit-0');
  assert.equal(topology.find(n=>n.id==='i5').routes.out,'a-bit-0');
  assert.deepEqual(topology.find(n=>n.id==='a-return').routes,{left:'i2',right:'i6'});
  for(let i=0;i<14;i++)machine.step();
  const returns=machine.componentTrace().filter(e=>e.from==='a-return');
  assert.deepEqual(returns.map(e=>e.to),['i2','i6','i2','i6']);
  assert.ok(machine.componentTrace().every(e=>e.marble==='marble'));
  assert.deepEqual(machine.snapshot().registers,{a:'4',b:'2'});
});

test('component stepping exposes partial carries without prematurely completing INC',()=>{
  const machine=new GateMachine();
  machine.step();machine.step(); // i5, a = 1
  assert.equal(machine.snapshot().pc,5);
  machine.stepComponent(); // entry to a bit 0
  const low=machine.stepComponent(); // clear a bit 0, carry
  assert.equal(low.pc,5);assert.equal(low.registers.a,'0');assert.equal(low.steps,2);
  assert.equal(low.location,'a-bit-1');
  assert.equal(low.instructions[4].status,'executing');
  const high=machine.stepComponent();assert.equal(high.registers.a,'2');assert.equal(high.pc,5);
  const complete=machine.stepComponent();assert.equal(complete.pc,6);assert.equal(complete.steps,3);
  const copy=machine.snapshot();copy.gates['a-return']='bad';
  assert.notEqual(machine.snapshot().gates['a-return'],'bad');
});
