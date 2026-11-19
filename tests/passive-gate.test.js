import test from 'node:test';
import assert from 'node:assert/strict';
import {probePassiveGate} from '../experiments/passive-gate.js';

test('experimental rocker reproduces its coarse-tolerance centered baseline (not qualification)',async()=>{
  for(const initial of [-1,1]) {
    const result=await probePassiveGate({initial,count:8,lengthUnit:1});
    assert.equal(result.alternating,true);
    assert.ok(result.events.every(e=>e.contacts>0));
    assert.ok(result.events.every(e=>Math.abs(e.after)>.59));
    result.events.forEach((event,index)=>assert.equal(event.exit.side,(index%2===0)===(initial===-1)?'left':'right'));
  }
});

test('experimental physics rejects invalid probes',async()=>{
  await assert.rejects(probePassiveGate({timestep:0}),/Invalid/);
  await assert.rejects(probePassiveGate({initial:0}),/Invalid/);
});


test('inlet and solver parameters are validated',async()=>{
  await assert.rejects(probePassiveGate({lengthUnit:0}),/Invalid/);
  await assert.rejects(probePassiveGate({guide:{throat:.005}}),/Invalid inlet/);
  const report=await probePassiveGate({lengthUnit:.1,guide:{},count:2});
  assert.equal(typeof report.alternating,'boolean');
  assert.equal(report.events.length,2);
  assert.ok(report.events.every(e=>Number.isFinite(e.after)&&Number.isInteger(e.contacts)));
});
