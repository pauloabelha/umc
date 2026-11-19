import test from 'node:test';
import assert from 'node:assert/strict';
import {componentCatalog as catalog,makeExperiment} from '../src/simulator/catalog.js';
import {createSession} from '../src/simulator/session.js';
import {drivePose} from '../src/geometry/transforms.js';

for(const entry of catalog)for(const mode of (entry.modes ?? ['semantic','cpu']))test(`${entry.id} runs in ${mode}`,async()=>{
  const session=await createSession(makeExperiment({component:entry.id,...(entry.id==='seven-instruction-lattice'&&mode==='cpu'?{bits:2}:{})}),mode);
  try{
    let state;
    for(let i=0;i<(entry.id==='seven-instruction-lattice'?16000:5400);i++){state=await session.step();if(state.result||state.current.laps>=3)break;}
    if(entry.closed){assert.equal(state.result,null);assert.ok(state.current.laps>=3);assert.equal((await session.step()).result,null);}
    else {
      assert.equal(state.result?.status,'exited');
      if(entry.id==='seven-instruction-lattice'&&mode==='cpu')assert.equal(state.current.instruction,'i5');
    }
  }finally{await session.dispose();}
});

test('curves are red, ramps yellow, and the wheel motor rotates continuously',()=>{
  assert.equal(makeExperiment({component:'curve-track'}).circuit.bodies()[0].color,'#e33438');
  assert.equal(makeExperiment({component:'ramp'}).circuit.bodies()[0].color,'#f5be24');
  const {drive}=makeExperiment({component:'ferry'}).circuit.bodies().find(b=>b.drive);
  assert.equal(drive.kind,'rotation');assert.ok(drive.angularSpeed<0);
  for(const time of [0,1,5,9.99,10,100]){
    const a=drivePose(drive,time),b=drivePose(drive,time+.01);
    assert.notDeepEqual(a.rotation,b.rotation);
    assert.deepEqual(a.position,b.position,'axle stays fixed');
  }
});
