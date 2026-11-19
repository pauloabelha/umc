import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
import {feedGuide} from '../src/logic/routing.js';
import {Circuit} from '../src/circuit.js';
import {createSession} from '../src/simulator/session.js';
import {physicalObserver} from '../src/simulator/physical-observer.js';
const results=[];
for(const mode of ['cpu','gpu'])for(const z of [-.018,0,.018]) {
 const instance=feedGuide().instantiate('feed'),circuit=new Circuit([instance]);
 const e={entry:{closed:false},instance,circuit,marble:{id:'marble',position:[.002,.013,z],velocity:[.4,0,0],radius:.011,mass:.005},observe:physicalObserver(circuit,'feed')};
 const session=await createSession(e,mode);let state;
 try{
  for(let i=0;i<120;i++){state=await session.step();assert.ok(Math.hypot(...state.current.velocity)<.46);if(state.result)break;}
  assert.equal(state.result?.status,'exited');assert.ok(Math.abs(state.current.position[2])<.002);assert.ok(Math.abs(state.current.position[1]-.011)<.001);
  results.push({mode,inputOffset:z,passed:true,exit:state.current});console.log(mode,z,'centered');
 }finally{await session.dispose();}
}
await mkdir('artifacts',{recursive:true});await writeFile('artifacts/logic-feed.json',JSON.stringify({passed:true,results},null,2));
