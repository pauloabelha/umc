import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {logicGates} from '../src/logic/gates.js';
import {makeLogicExperiment} from '../src/logic/circuit.js';
import {createLogicSession} from '../src/logic/session.js';
import {gpuClient} from '../src/backends/gpu.js';
const args=Object.fromEntries(process.argv.slice(2).map(a=>a.replace(/^--/,'').split('=')));
const modes=(args.mode??'cpu,gpu').split(','),scales=(args.scales??'1').split(',').map(Number),laps=Number(args.laps??3);
const examples=[...logicGates,{id:'half-adder',inputs:2}].filter(g=>!args.gate||args.gate.split(',').includes(g.id));
const reference={buffer:a=>a,not:a=>1-a,and:(a,b)=>a&b,or:(a,b)=>a|b,nand:(a,b)=>1-(a&b),nor:(a,b)=>1-(a|b),xor:(a,b)=>a^b,xnor:(a,b)=>1-(a^b)};
const report=args.report??'artifacts/logic-physics.json',results=[],client=gpuClient({baseUrl:args['base-url']??'http://127.0.0.1:8792'});
assert.ok(examples.length&&modes.every(m=>['cpu','gpu'].includes(m))&&laps>0&&scales.every(s=>s>0));
await mkdir('artifacts',{recursive:true});
for(const mode of modes)for(const spec of examples)for(const scale of scales)for(const a of (args.a===undefined?[0,1]:[Number(args.a)]))for(const b of (args.b===undefined?(spec.inputs===1?[0]:[0,1]):[Number(args.b)])) {
 let session,state;
 try {
  const e=makeLogicExperiment({gate:spec.id,a,b,scale});assert.deepEqual(e.circuit.elevationIssues,[]);
  session=await createLogicSession(e,mode,{client});
  for(let i=0;i<18000;i++) {
   state=await session.step();
   assert.equal(state.current.id,'marble');assert.ok(state.current.position.every(Number.isFinite));
   assert.ok(Math.hypot(...state.current.velocity)<5*Math.sqrt(scale));
   if(state.current.laps>=laps)break;
  }
  assert.equal(state.current.laps,laps);
  for(const lap of state.logic.completed)for(const [id,output] of Object.entries(lap.outputs)){
   assert.equal(output.value,reference[id](a,b));assert.deepEqual(output.inputs,spec.inputs===1?[a]:[a,b]);
  }
  assert.equal((await session.step()).result,null);
  results.push({mode,gate:spec.id,scale,a,b,passed:true,laps,time:state.current.time,trace:state.logic.completed});
 }catch(error){results.push({mode,gate:spec.id,scale,a,b,passed:false,error:error.message,current:state?.current});}
 finally{
  try{await session?.dispose();}catch(error){results.push({mode,gate:spec.id,passed:false,error:`Cleanup: ${error.message}`});}
  console.log(JSON.stringify({...results.at(-1),trace:undefined}));
  await writeFile(report,JSON.stringify({passed:results.every(r=>r.passed),results},null,2));
 }
}
if(results.some(r=>!r.passed))process.exitCode=1;
