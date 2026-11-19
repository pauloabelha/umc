import {probePassiveGate} from '../experiments/passive-gate.js';
import {mkdir,writeFile} from 'node:fs/promises';
const results=[];
// This matrix is diagnostic, not a claim that every case passes. Persist both
// successes and failures; do not replace the production TGate based on one run.
for(const timestep of [1/240,1/480,1/960])for(const offset of [-.003,-.001,0,.001,.003])for(const initial of [-1,1]) {
  const options={timestep,offset,initial,count:8};
  results.push({options,...await probePassiveGate(options)});
}
await mkdir('artifacts',{recursive:true});
await writeFile('artifacts/passive-gate-contact-report.json',JSON.stringify({qualified:false,results},null,2));
console.log(`${results.filter(r=>r.alternating).length}/${results.length} cases alternated. Prototype remains unqualified. Full report: artifacts/passive-gate-contact-report.json`);
