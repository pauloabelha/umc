import test from 'node:test';
import assert from 'node:assert/strict';
import {physicalMachine} from '../src/machine/physical-machine.js';
import {SemanticExecution} from '../src/simulator/semantic-execution.js';
import {IncJumpMachine} from '../src/machine/inc-jump.js';
import {registerValue} from '../src/machine/increment-register.js';

test('seven-instruction construction terminates in allowed physical primitives',()=>{
  const a=physicalMachine(),allowed=new Set(['StraightTrack','Curve90','FerryElevator','TGate','MergeTrack','Ramp']);
  assert.equal(a.circuit.level,3);
  assert.deepEqual(a.circuit.elevationIssues,[]);
  assert.equal(a.circuit.physicalSupported,true);
  assert.ok(a.circuit.instances.every(i=>allowed.has(i.component.name)));
  const count=name=>a.circuit.instances.filter(i=>i.component.name===name).length;
  assert.equal(count('FerryElevator'),10);assert.equal(count('TGate'),9);
  assert.equal(a.circuit.composition.instances.length,a.circuit.instances.length);
});

test('primitive machine implements the reference instructions through finite-register overflow',()=>{
  for(const bits of [1,2,4]) {
    const a=physicalMachine({bits}),execution=new SemanticExecution(a.circuit,[{marble:{id:'marble'},component:'i1'}]),reference=new IncJumpMachine();
    let halted=false,instructions=0;
    for(let step=0;step<30000;step++) {
      execution.step();const state=execution.snapshot(),event=execution.traceEvents({limit:1})[0];
      if(state.results.length) {
        const before=reference.snapshot(),instruction=before.instructions[before.pc-1];
        assert.equal(instruction.op,'INC');
        assert.equal(BigInt(before.registers[instruction.register]),(1n<<BigInt(bits))-1n);
        assert.equal(state.results[0].component,`${instruction.register}-bit-${bits-1}`);
        halted=true;break;
      }
      if(/^i[1-7]$/.test(event.to.component)) {
        const expected=reference.step();instructions++;
        assert.equal(event.to.component,`i${expected.pc}`);
        for(const register of ['a','b'])assert.equal(registerValue(a.registers[register],state.componentStates).toString(),expected.registers[register]);
      }
    }
    assert.equal(halted,true);assert.ok(instructions>0);
  }
});
