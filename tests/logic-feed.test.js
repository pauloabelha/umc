import test from 'node:test';
import assert from 'node:assert/strict';
import {feedGuide} from '../src/logic/routing.js';
import {Circuit} from '../src/circuit.js';
import {physicalWorld} from '../src/backends/physical.js';

test('passive feed centers off-axis marbles without lifting or accelerating them',async()=>{
 const circuit=new Circuit([feedGuide().instantiate('feed')]);
 assert.deepEqual(circuit.elevationIssues,[]);
 for(const z of [-.018,0,.018]) {
  const world=await physicalWorld(circuit,{timestep:1/960});
  try {
   world.addMarble({id:'marble',position:[.002,.013,z],velocity:[.4,0,0],radius:.011,mass:.005});
   let state;
   for(let i=0;i<960;i++) {
    world.step();state=world.snapshot('marble');
    assert.ok(Math.hypot(...state.velocity)<.46,'Guide cannot supply energy');
    if(state.position[0]>=.18)break;
   }
   assert.ok(state.position[0]>=.18,'Marble clears the throat');
   assert.ok(Math.abs(state.position[2])<.002,'Marble arrives on centerline');
   assert.ok(Math.abs(state.position[1]-.011)<.001,'Track remains level');
  }finally{world.dispose();}
 }
});
