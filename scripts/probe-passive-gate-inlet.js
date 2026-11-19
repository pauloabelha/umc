import {probePassiveGate} from '../experiments/passive-gate.js';
import {mkdir,writeFile} from 'node:fs/promises';
const results=[];
for(const lengthUnit of [1,.1,.01])for(const guide of [null,{}])for(const initial of [-1,1])for(const offset of [-.003,0,.003]) {
  const options={lengthUnit,guide,initial,offset,count:8};
  results.push({options,...await probePassiveGate(options)});
}
await mkdir('artifacts',{recursive:true});
await writeFile('artifacts/passive-gate-inlet-report.json',JSON.stringify({qualified:false,results},null,2));
for(const lengthUnit of [1,.1,.01])for(const guided of [false,true]) {
  const rows=results.filter(r=>r.options.lengthUnit===lengthUnit&&!!r.options.guide===guided);
  console.log(JSON.stringify({lengthUnit,guided,passed:rows.filter(r=>r.alternating).length,total:rows.length}));
}
console.log('Candidate remains unqualified; centered-drop success is not stable across solver tolerances.');
