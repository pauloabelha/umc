import test from 'node:test';
import assert from 'node:assert/strict';
import {LatticeMachineExecution} from '../src/machine/lattice-execution.js';
import {IncJumpMachine} from '../src/machine/inc-jump.js';

test('full lattice machine executes seven instructions on shared banks until explicit overflow',()=>{
  for(const bits of [1,2,4]) {
    const machine=new LatticeMachineExecution({bits}),reference=new IncJumpMachine();
    assert.equal(machine.assembly.program.length,7);
    assert.deepEqual(machine.assembly.circuit.elevationIssues,[]);
    let halted=false;
    for(let step=0;step<100;step++) {
      const before=reference.snapshot(),instruction=before.instructions[before.pc-1];
      const expectedOverflow=instruction.op==='INC'&&BigInt(before.registers[instruction.register])===(1n<<BigInt(bits))-1n;
      const actual=machine.step();
      if(expectedOverflow) {
        assert.match(actual.halt,/overflow/);assert.equal(actual.steps,before.steps);
        assert.deepEqual(machine.step(),actual);halted=true;break;
      }
      const expected=reference.step();
      assert.equal(actual.halt,null);assert.equal(actual.pc,expected.pc);
      assert.deepEqual(actual.registers,expected.registers);
      assert.deepEqual(actual.instructions,expected.instructions);
      assert.deepEqual(machine.trace(1)[0].before,reference.trace(1)[0].before);
    }
    assert.equal(halted,true);
    const routes=machine.componentTrace();
    assert.ok(routes.some(e=>e.from.startsWith('wire-')));
    assert.ok(routes.some(e=>e.from==='a-return'));
  }
});

test('transport time, scales, and instruction observation never replace marble routing',()=>{
  for(const scale of [.25,1,2]) {
    const machine=new LatticeMachineExecution({bits:2,scale,speed:4});
    const initial=machine.snapshot();assert.equal(initial.location,'i1');
    const first=machine.stepComponent();
    assert.equal(first.pc,1);assert.equal(first.steps,0);
    assert.equal(first.location,'a-entry');assert.deepEqual(first.registers,{a:'0',b:'0'});
    const complete=machine.step();assert.equal(complete.pc,2);assert.deepEqual(complete.registers,{a:'1',b:'0'});
    assert.ok(complete.time>1,'transport costs are included');
    for(const event of machine.componentTrace().slice(1)) {
      assert.equal(machine.locateMarble(event.time).component,event.to);
      assert.equal(machine.locateMarble(event.time-1e-7).component,event.from);
    }
  }
});

test('machine routing expands in the plane using real primitive transfers',()=>{
  for(const bits of [1,2,4,8]) {
    const {circuit,registers}=new LatticeMachineExecution({bits}).assembly;
    assert.deepEqual(circuit.elevationIssues,[]);
    assert.equal(circuit.level,3);
    assert.ok(circuit.instances.some(i=>i.component.name==='FerryElevator'));
    assert.ok(circuit.instances.every(i=>Object.values(i.component.ports).every(p=>Math.abs(p.position[1])<=.06+1e-9)));
    assert.equal(registers.a.length,bits);assert.equal(registers.b.length,bits);
    assert.equal(circuit.physicalSupported,true);
  }
});
