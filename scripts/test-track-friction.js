import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {straightTrack} from '../src/components/straight-track.js';
import {Circuit} from '../src/circuit.js';
import {physicalWorld} from '../src/backends/physical.js';
import {gpuClient} from '../src/backends/gpu.js';
import {MARBLE_FRICTION} from '../src/materials.js';

// A level track must preserve momentum without adding gravitational energy.
const circuit=new Circuit([straightTrack({length:2}).instantiate('track')]);
const marble={id:'m',position:[.05,.011,0],velocity:[.4,0,0],radius:.011,mass:.005};
const results=[];
for(const mode of ['cpu','gpu']){
 let world;
 try{
  let final;
  if(mode==='cpu'){
   world=await physicalWorld(circuit);world.addMarble(marble);
   for(let i=0;i<480;i++)world.step();
   final=world.snapshot(marble.id);
  }else{
   world=await gpuClient().create({format:'umc-scene',version:1,units:'m-kg-s',scale:1,timestep:1/240,gravity:[0,-9.81,0],bodies:[...circuit.bodies(),
    {id:marble.id,motion:'dynamic',position:marble.position,velocity:marble.velocity,rotation:[0,0,0,1],shape:{kind:'sphere',radius:marble.radius},mass:marble.mass,friction:MARBLE_FRICTION,restitution:0}]});
   for(let i=0;i<30;i++)final=(await world.advance(16,{sampleEvery:16})).at(-1).bodies[0];
  }
  assert.ok(final.velocity[0]>.36,`${mode}: lost more than 10% speed`);
  assert.ok(final.velocity[0]<=.401,`${mode}: gained energy on a flat track`);
  assert.ok(final.position[0]>.80&&final.position[0]<.86,`${mode}: unexpected distance`);
  assert.ok(Math.abs(final.position[1]-.011)<.002,`${mode}: left the track`);
  results.push({mode,seconds:2,initialSpeed:.4,finalSpeed:final.velocity[0],distance:final.position[0]-.05});
  console.log(JSON.stringify(results.at(-1)));
 }finally{await world?.dispose();}
}
await mkdir('artifacts',{recursive:true});
await writeFile('artifacts/track-friction.json',JSON.stringify({checkedAt:new Date().toISOString(),results},null,2));
