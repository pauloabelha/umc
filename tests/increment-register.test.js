import test from 'node:test';
import assert from 'node:assert/strict';
import {incrementRegister,registerValue} from '../src/machine/increment-register.js';
import {SemanticExecution} from '../src/simulator/semantic-execution.js';

function execution(options) {
  const assembly=incrementRegister(options);
  return {...assembly,run:new SemanticExecution(assembly.circuit,[{marble:{id:'m'},component:'bit-0'}])};
}

test('INC register exhaustively increments all values through eight bits with explicit overflow',()=>{
  for(let bits=1;bits<=8;bits++)for(let value=0n;value<2n**BigInt(bits);value++) {
    const {run,bitIds,circuit}=execution({bits,value});
    assert.ok(circuit.lattice);assert.equal(circuit.physicalSupported,true);
    let snapshot=run.snapshot(),steps=0;
    while(!snapshot.results.length) {snapshot=run.step();assert.ok(++steps<=2*bits-1);}
    const modulus=2n**BigInt(bits),overflow=value===modulus-1n;
    assert.equal(registerValue(bitIds,snapshot.componentStates),(value+1n)%modulus);
    assert.equal(snapshot.results[0].output,overflow?'right':'left');
    const flips=run.traceEvents().filter(e=>e.transition);
    let expectedFlips=1;
    for(let n=value;(n&1n)&&expectedFlips<bits;n>>=1n)expectedFlips++;
    assert.equal(flips.length,expectedFlips);
    assert.equal(snapshot.time,2*expectedFlips-1);
    assert.equal(run.occupants('bit-0').length,0);
  }
});

test('carry changes one bit at a time and marble stays indexed across connecting tracks',()=>{
  for(const scale of [.25,1,2])for(const speed of [1,4]) {
    const {run,bitIds}=execution({bits:4,value:7n,scale,speed});
    const expected=[6n,6n,4n,4n,0n,0n,8n];
    for(const [index,value] of expected.entries()) {
      const snapshot=run.step();
      assert.equal(registerValue(bitIds,snapshot.componentStates),value);
      assert.equal(snapshot.time,(index+1)/speed);
      const marble=run.locateMarble('m');
      if(marble.component)assert.deepEqual(run.occupants(marble.component),['m']);
    }
    assert.equal(run.snapshot().results[0].component,'bit-3');
  }
});

test('register size/value validation and independent stored bits',()=>{
  assert.throws(()=>incrementRegister({bits:0}));
  assert.throws(()=>incrementRegister({bits:4,value:16n}));
  assert.throws(()=>incrementRegister({value:-1n}));
  const a=execution({value:7n}),b=execution({value:7n});a.run.step();
  assert.equal(registerValue(b.bitIds,b.run.snapshot().componentStates),7n);
});
