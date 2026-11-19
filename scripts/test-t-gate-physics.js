import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
import {makeExperiment} from '../src/simulator/catalog.js';
import {createSession} from '../src/simulator/session.js';
import {gpuClient} from '../src/backends/gpu.js';
const client=gpuClient({baseUrl:process.env.UMC_GPU_URL??'http://127.0.0.1:8792'});
const results=[];
for(const mode of ['cpu','gpu'])for(const scale of [.25,.5,1,2])for(const initialState of ['left','right']){
 const e=makeExperiment({component:'t-gate',scale,initialState}),s=await createSession(e,mode,{client});
 try{
 for(let pass=0;pass<8;pass++){
  let state;
  for(let i=0;i<600;i++){state=await s.step();if(state.result)break;}
  assert.equal(state.result?.status,'exited',`${mode}/${scale}/${pass}: ${state.result?.status}`);
  const expected=(pass+(initialState==='right'?1:0))%2?'right':'left';
  assert.equal(state.result.output,expected);
  assert.equal(state.componentStates.gate,expected==='left'?'right':'left');
  results.push({mode,scale,initialState,pass,output:state.result.output,time:state.current.time});
  console.log(JSON.stringify(results.at(-1)));
  if(pass<7)await s.reenterMarble();
 }
 }finally{await s.dispose();}
}
await mkdir('artifacts',{recursive:true});await writeFile('artifacts/t-gate-physics.json',JSON.stringify({passed:true,results},null,2));
