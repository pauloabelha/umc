import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {catalog,makeExperiment} from '../src/simulator/catalog.js';
import {createSession} from '../src/simulator/session.js';
import {gpuClient} from '../src/backends/gpu.js';
import {IncJumpMachine} from '../src/machine/inc-jump.js';
import {registerValue} from '../src/machine/increment-register.js';
const args=Object.fromEntries(process.argv.slice(2).map(arg=>arg.replace(/^--/,'').split('=')));
const modes=args.mode?[args.mode]:['cpu','gpu'];
const entries=args.component?catalog.filter(e=>e.id===args.component):catalog;
const scales=(args.scales??'1').split(',').map(Number),bits=Number(args.bits??4),laps=Number(args.laps??5);
assert.ok(entries.length&&modes.every(m=>['cpu','gpu'].includes(m))&&scales.every(s=>s>0));
const client=gpuClient({baseUrl:args['base-url']??'http://127.0.0.1:8792'}),results=[];
await mkdir('artifacts',{recursive:true});
const reportPath=args.report??'artifacts/physical-assemblies.json';
for(const mode of modes)for(const entry of entries)for(const scale of scales) {
  const experiment=makeExperiment({component:entry.id,scale,bits}),reference=new IncJumpMachine(),checks=[];
  let session,snapshot,cursor=0,lastComponent,lastProgress=0;
  try {
    assert.deepEqual(experiment.circuit.elevationIssues,[]);
    session=await createSession(experiment,mode,{client});
    const budget=entry.closed?7200:60000;
    for(let step=0;step<budget;step++) {
      snapshot=await session.step();
      assert.equal(snapshot.current.id,'marble');
      assert.ok(snapshot.current.position.every(Number.isFinite));
      assert.ok(Math.hypot(...snapshot.current.velocity)<5*Math.sqrt(scale),'Unphysical launch velocity');
      if(lastComponent!==snapshot.current.component){lastComponent=snapshot.current.component;lastProgress=snapshot.current.time;}
      assert.ok(snapshot.current.time-lastProgress<45*Math.sqrt(scale),`Stalled in ${lastComponent}`);
      while(cursor<(experiment.transitions?.length??0)) {
        const transition=experiment.transitions[cursor++];
        if(/^i[1-7]$/.test(transition.to??'')) {
          const expected=reference.step();
          const registers=Object.fromEntries(['a','b'].map(name=>[name,registerValue(experiment.registerBanks[name],snapshot.componentStates).toString()]));
          assert.equal(transition.to,`i${expected.pc}`);
          assert.deepEqual(registers,expected.registers);
          checks.push({instruction:expected.steps,time:transition.time,pc:expected.pc,registers});
        }
      }
      if(step%600===0)console.log(`${mode}/${entry.id}/${scale}: ${snapshot.current.time.toFixed(1)} s, ${entry.closed?`${snapshot.current.laps??0} laps`:`${checks.length} instructions`}, ${snapshot.current.component}`);
      if(snapshot.result||snapshot.current.laps>=laps)break;
    }
    if(entry.closed) {
      assert.equal(snapshot.result,null);assert.ok(snapshot.current.laps>=laps,'Insufficient laps');
      if(entry.id==='toggle-loop')assert.equal(snapshot.componentStates.gate,laps%2?'right':'left');
      assert.equal((await session.step()).result,null);
    } else {
      assert.equal(snapshot.result?.status,'exited','Machine did not reach overflow');
      const expected=reference.snapshot(),instruction=expected.instructions[expected.pc-1];
      assert.equal(instruction.op,'INC');assert.equal(BigInt(expected.registers[instruction.register]),(1n<<BigInt(bits))-1n);
      assert.equal(snapshot.result.component,`${instruction.register}-bit-${bits-1}`);assert.equal(snapshot.result.output,'right');
    }
    results.push({component:entry.id,mode,scale,bits,passed:true,time:snapshot.current.time,laps:snapshot.current.laps??0,instructions:checks.length,checks});
  } catch(error) {
    results.push({component:entry.id,mode,scale,bits,passed:false,error:error.message,current:snapshot?.current,checks});
  } finally {
    try{await session?.dispose();}catch(error){results.push({component:entry.id,mode,scale,passed:false,error:`Cleanup: ${error.message}`});}
    await writeFile(reportPath,JSON.stringify({passed:results.every(r=>r.passed),results},null,2));
    console.log(JSON.stringify({...results.at(-1),checks:undefined,current:undefined}));
  }
}
if(results.some(r=>!r.passed))process.exitCode=1;
