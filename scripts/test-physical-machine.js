import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {makeExperiment} from '../src/simulator/catalog.js';
import {createSession} from '../src/simulator/session.js';
import {IncJumpMachine} from '../src/machine/inc-jump.js';
import {registerValue} from '../src/machine/increment-register.js';
const results=[];
for(const mode of ['cpu','gpu']){
 const experiment=makeExperiment({component:'seven-instruction-lattice',bits:2});
 const session=await createSession(experiment,mode),reference=new IncJumpMachine();
 let seen=0,snapshot;const instructions=[];
 try{
  for(let step=0;step<18000;step++){
   snapshot=await session.step();
   for(const event of experiment.transitions.slice(seen)){
    if(!/^i[1-7]$/.test(event.to??''))continue;
    const expected=reference.step();
    assert.equal(event.to,`i${expected.pc}`,`${mode} wrong instruction`);
    for(const name of ['a','b'])assert.equal(registerValue(experiment.registerBanks[name],snapshot.componentStates).toString(),expected.registers[name],`${mode} register ${name}`);
    instructions.push({instruction:expected.pc,time:event.time,registers:expected.registers});
    console.log(mode,JSON.stringify(instructions.at(-1)));
   }
   seen=experiment.transitions.length;
   if(snapshot.result)break;
  }
  assert.equal(snapshot.result?.status,'exited');
  assert.equal(snapshot.result.output,'right');
  assert.equal(snapshot.result.component,'a-bit-1');
  assert.ok(instructions.some(e=>e.instruction===7),'must complete the whole seven-instruction cycle');
  assert.equal(reference.snapshot().registers.a,'3');
  results.push({mode,passed:true,time:snapshot.current.time,instructions});
 }catch(error){results.push({mode,passed:false,error:error.message,current:snapshot?.current,instructions});console.error(error.message);process.exitCode=1;}
 finally{await session.dispose();await mkdir('artifacts',{recursive:true});await writeFile('artifacts/physical-machine-results.json',JSON.stringify({passed:results.every(r=>r.passed),results},null,2));}
}
