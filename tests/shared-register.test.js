import test from 'node:test';
import assert from 'node:assert/strict';
import {sharedRegister} from '../src/machine/shared-register.js';
import {registerValue} from '../src/machine/increment-register.js';
import {SemanticExecution} from '../src/simulator/semantic-execution.js';

function run(options) {
  const assembly=sharedRegister(options);
  const execution=new SemanticExecution(assembly.circuit,[{marble:{id:'m'},component:'bit-0'}]);
  let snapshot=execution.snapshot(),steps=0;
  while(!snapshot.results.length){snapshot=execution.step();assert.ok(++steps<100);}
  return {...assembly,execution,snapshot,result:snapshot.results[0]};
}

test('every completion exit reaches the shared return gate with either continuation phase',()=>{
  for(const bits of [1,2,4,6])for(let value=0n;value<2n**BigInt(bits);value++)for(const returnState of ['left','right']) {
    const {snapshot,result,bitIds,execution,circuit}=run({bits,value,returnState});
    const overflow=value===2n**BigInt(bits)-1n;
    assert.ok(circuit.lattice);assert.equal(circuit.instances.length,4*bits-1);
    assert.equal(registerValue(bitIds,snapshot.componentStates),(value+1n)%(2n**BigInt(bits)));
    assert.equal(result.component,overflow?`bit-${bits-1}`:'return');
    assert.equal(result.output,overflow?'right':returnState);
    assert.equal(snapshot.componentStates.return,overflow?returnState:returnState==='left'?'right':'left');
    assert.equal(execution.traceEvents().filter(e=>e.from?.component==='return').length,overflow?0:1);
  }
});

test('collector has aligned geometry, explicit time cost, height budget and indexed transfers',()=>{
  for(const scale of [.25,1,2])for(const speed of [1,4]) {
    const {circuit,snapshot,execution}=run({bits:4,value:7n,scale,speed});
    assert.equal(snapshot.time,12/speed); // 7 carry passages + length-3 branch + merge + return
    const input=circuit.port('bit-0','in'),output=circuit.port('return','left');
    assert.ok(Math.abs(input.position[1]-output.position[1]-6*.06*scale)<1e-10);
    for(const event of execution.traceEvents().slice(1)) {
      assert.equal(execution.locateMarble('m',event.time-1e-8).component,event.from.component);
      assert.equal(execution.locateMarble('m',event.time).component,event.to?.component??null);
    }
  }
});
