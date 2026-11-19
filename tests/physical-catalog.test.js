import test from 'node:test';
import assert from 'node:assert/strict';
import {physicalCatalog,makeExperiment} from '../src/simulator/catalog.js';
import {browserItems} from '../src/simulator/component-browser.js';
import {makeLogicExperiment} from '../src/logic/circuit.js';
test('every runnable catalog entry has physical geometry and a CPU link',()=>{
 assert.equal(physicalCatalog.length,10);assert.equal(browserItems.length,19);
 for(const item of browserItems) {
  const url=new URL(item.href,'http://localhost');
  assert.equal(url.searchParams.get('mode'),'cpu');
  const experiment=url.searchParams.has('gate')?makeLogicExperiment({gate:url.searchParams.get('gate')}):makeExperiment({component:item.id});
  assert.equal(experiment.circuit.physicalSupported,true,item.id);
  assert.deepEqual(experiment.circuit.elevationIssues,[],item.id);
 }
});
