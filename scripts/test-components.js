import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {physicalCatalog,makeExperiment} from '../src/simulator/catalog.js';
import {createSession} from '../src/simulator/session.js';

const args=Object.fromEntries(process.argv.slice(2).map(arg=>arg.replace(/^--/,'').split('=')));
const catalog=physicalCatalog;
const modes=(args.mode??'semantic,cpu,gpu').split(',');
assert.ok(modes.every(mode=>['semantic','cpu','gpu'].includes(mode)));
const scales=(args.scales??'1').split(',').map(Number);
assert.ok(scales.every(scale=>Number.isFinite(scale)&&scale>0));
const results=[];
for(const mode of modes)for(const entry of catalog)for(const scale of scales){
  if(entry.modes&&!entry.modes.includes(mode)){results.push({component:entry.id,mode,skipped:true,reason:'Semantic prototype; physical mechanism not implemented'});continue;}
  let session;
  try{
    const experiment=makeExperiment({component:entry.id,scale});
    assert.deepEqual(experiment.circuit.elevationIssues,[]);
    session=await createSession(experiment,mode);
    let snapshot=session.snapshot();
    for(let step=0;step<(entry.id==='seven-instruction-lattice'?60000:5400);step++){
      snapshot=await session.step();
      if(mode==='gpu'&&step%600===0)console.log(`GPU loop: ${snapshot.current.time.toFixed(2)} s, ${snapshot.current.laps??0} laps`);
      if(snapshot.result||snapshot.current.laps>=3)break;
    }
    if(entry.closed){
      assert.equal(snapshot.result,null,`${mode}/${entry.id}: loop must remain running`);
      assert.ok(snapshot.current.laps>=3,`${mode}/${entry.id}: expected 3 laps, got ${snapshot.current.laps} at ${snapshot.current.time}s`);
      const previous=snapshot.current.time;
      snapshot=await session.step();
      assert.equal(snapshot.result,null);
      assert.ok(snapshot.current.time>previous,'loop must continue after the test target');
    }else{
      assert.equal(snapshot.result?.status,'exited',`${mode}/${entry.id}: ${snapshot.result?.status??'stalled'}`);
      assert.ok(['out','left','right'].includes(snapshot.result.output));
    }
    if(entry.id==='inc-register') {
      assert.equal(snapshot.result.component,'bit-3');
      assert.equal(snapshot.result.output,'left');
      assert.deepEqual(['bit-0','bit-1','bit-2','bit-3'].map(id=>snapshot.componentStates[id]),['left','left','left','right']);
    }
    const result={component:entry.id,mode,scale,passed:true,time:snapshot.current.time,laps:snapshot.current.laps??0};
    results.push(result);console.log(JSON.stringify(result));
  }catch(error){
    const result={component:entry.id,mode,scale,passed:false,error:error.message};
    results.push(result);console.error(JSON.stringify(result));
  }finally{try{await session?.dispose();}catch(error){results.push({component:entry.id,mode,scale,passed:false,error:`Cleanup failed: ${error.message}`});}}
}
await mkdir('artifacts',{recursive:true});
const failed=results.filter(r=>r.passed===false).length;
await writeFile(args.report??'artifacts/component-results.json',JSON.stringify({checkedAt:new Date().toISOString(),passed:failed===0,fullyPhysical:!failed&&!results.some(r=>r.skipped),results},null,2));
console.log(`${results.filter(r=>r.passed).length} component/backend checks passed; ${failed} failed; ${results.filter(r=>r.skipped).length} unsupported prototype modes reported separately.`);
if(failed)process.exitCode=1;
