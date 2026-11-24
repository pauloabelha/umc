import test from 'node:test';
import assert from 'node:assert/strict';
import {physicalCatalog,benchCatalog,makeExperiment} from '../src/simulator/catalog.js';
import {browserItems} from '../src/simulator/component-browser.js';
import {makeLogicExperiment} from '../src/logic/circuit.js';
test('every runnable catalog entry has physical geometry and a CPU link',()=>{
 assert.equal(physicalCatalog.length,10);assert.equal(browserItems.length,7);
 for(const item of browserItems) {
  const url=new URL(item.href,'http://localhost');
  assert.equal(url.searchParams.get('mode'),'cpu');
  const experiment=url.searchParams.has('gate')?makeLogicExperiment({gate:url.searchParams.get('gate')}):makeExperiment({component:item.id});
  assert.equal(experiment.circuit.physicalSupported,true,item.id);
  assert.deepEqual(experiment.circuit.elevationIssues,[],item.id);
 }
});

test('public bench contains only parts and the basic loop, ordered by depth',()=>{
 assert.deepEqual(new Set(browserItems.map(i=>i.id)),new Set(benchCatalog.map(i=>i.id)));
 for(const id of ['seven-instruction-lattice','inc-register','shared-register','toggle-loop','half-adder','and','jump-machine'])assert.ok(!browserItems.some(i=>i.id===id));
 for(let i=1;i<browserItems.length;i++)assert.ok(browserItems[i-1].level>=browserItems[i].level);
 assert.equal(browserItems[0].id,'closed-loop');
});
