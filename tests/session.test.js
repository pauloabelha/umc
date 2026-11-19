import test from 'node:test';
import assert from 'node:assert/strict';
import {makeExperiment, experimentScene} from '../src/simulator/catalog.js';
import {createSession} from '../src/simulator/session.js';
import {gpuClient} from '../src/backends/gpu.js';

test('semantic completion occurs at its deadline, independent of geometric scale', async () => {
  for (const scale of [0.25, 1, 2]) {
    const session = await createSession(makeExperiment({scale, speed: 4, expectedDuration: 2}), 'semantic');
    assert.equal(session.snapshot().current.time, 0);
    assert.equal(session.snapshot().result, null);
    const {result} = await session.step();
    assert.equal(result.output, 'out'); assert.equal(result.time, 0.5);
    await session.dispose();
    await assert.rejects(session.step(), /closed/);
  }
});

test('scene scales bodies, ports and marble coherently; mass follows volume', () => {
  const a = makeExperiment(), b = makeExperiment({scale: 0.5});
  const sa = experimentScene(a), sb = experimentScene(b);
  sa.bodies.forEach((body, i) => {
    assert.deepEqual(sb.bodies[i].position, body.position.map(v => v / 2));
    if (body.shape.size) assert.deepEqual(sb.bodies[i].shape.size, body.shape.size.map(v => v / 2));
  });
  assert.equal(sb.bodies.at(-1).mass, sa.bodies.at(-1).mass / 8);
  assert.equal(sb.bodies.at(-1).shape.radius, sa.bodies.at(-1).shape.radius / 2);
  assert.deepEqual(b.circuit.port('component', 'out').position, a.circuit.port('component', 'out').position.map(v => v/2));
  assert.throws(() => makeExperiment({scale: 0}), /positive/);
  assert.throws(() => makeExperiment({speed: -1}), /positive/);
  assert.throws(() => makeExperiment({component: 'imaginary'}), /Unknown/);
});

test('CPU session exits at all supported circuit scales', async () => {
  for (const scale of [0.25, 0.5, 1, 2]) {
    const session = await createSession(makeExperiment({scale}), 'cpu');
    try {
      let snapshot;
      for (let i = 0; i < 300; i++) {snapshot = await session.step(); if (snapshot.result) break;}
      assert.equal(snapshot.result?.status, 'exited', `scale ${scale}`);
      assert.equal(snapshot.result.output, 'out');
    } finally {await session.dispose();}
  }
});

test('observer rejects a marble crossing outside the outlet', () => {
  const e = makeExperiment();
  const result = e.observe({position: [0.29, 0, 1]}, {position: [0.4, 0, 1], time: 1});
  assert.equal(result.status, 'escaped'); assert.equal(result.output, null);
});

test('GPU connection failure never executes a CPU fallback', async () => {
  let requests = 0;
  const client = gpuClient({fetchImpl: async () => {requests++; throw new Error('offline');}});
  await assert.rejects(createSession(makeExperiment(), 'gpu', {client}), /offline/);
  assert.equal(requests, 1);
});

test('uncertain GPU step cannot be retried and its world can be released', async () => {
  const methods = [];
  const client = gpuClient({fetchImpl: async (url, options) => {
    methods.push(options.method);
    if (url.pathname.endsWith('/step')) throw new Error('connection lost');
    return {ok: true, json: async () => ({id: 'test-world', ticks: 0, snapshot: {time: 0, bodies: []}})};
  }});
  const world = await client.create({});
  await assert.rejects(world.advance(), /connection lost/);
  await assert.rejects(world.advance(), /closed/);
  await world.dispose();
  assert.deepEqual(methods, ['POST', 'POST', 'DELETE']);
});

test('physical reentry preserves identity and restores the level-track inlet fixture', async()=>{
  const session=await createSession(makeExperiment(),'cpu');
  try {
    let lastTime=0;
    for(let pass=0;pass<12;pass++) {
      let state;
      for(let step=0;step<600;step++){state=await session.step();if(state.result)break;}
      assert.equal(state.result?.status,'exited',`pass ${pass}`);
      assert.equal(state.result.id,'marble');assert.ok(state.current.time>lastTime);
      lastTime=state.current.time;
      if(pass<11) {
        const restarted=await session.reenterMarble();
        assert.equal(restarted.result,null);assert.equal(restarted.current.component,'component');
        assert.ok(restarted.current.velocity[0]>.39);
      }
    }
  } finally {await session.dispose();}
});

test('GPU reentry transmits its inlet velocity and keeps the server clock',async()=>{
  const requests=[];
  const client=gpuClient({fetchImpl:async(url,options)=>{
    const payload=options.body?JSON.parse(options.body):null;requests.push({path:url.pathname,payload});
    const body=url.pathname.endsWith('/step')?{ticks:4,samples:[]}:url.pathname.endsWith('/release')?{snapshot:{time:1,bodies:[]}}:{id:'fixture',ticks:0,snapshot:{time:0,bodies:[]}};
    return {ok:true,json:async()=>body};
  }});
  const world=await client.create({});
  try {
    await world.advance();await world.releaseMarble('marble',[0,.011,0],[.4,0,0]);
    assert.deepEqual(requests.at(-1),{path:'/worlds/fixture/release',payload:{id:'marble',position:[0,.011,0],velocity:[.4,0,0],expectedTicks:4}});
  } finally {await world.dispose();}
});
