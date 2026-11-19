import test from 'node:test';
import assert from 'node:assert/strict';
import {MarbleTracker} from '../src/simulator/marble-tracker.js';
import {makeExperiment} from '../src/simulator/catalog.js';
import {createSession} from '../src/simulator/session.js';

const visit = (component, time = 0, duration = 1) => ({component, input: 'in', output: 'out', time, duration, from: [0, 0, 0], to: [1, 0, 0]});

test('multiple marble identities have independent occupancy records', () => {
  const tracker = new MarbleTracker();
  tracker.enter('red', visit('track-a'));
  tracker.enter('blue', visit('track-b', 0.2, 2));
  tracker.advanceTo(0.5);
  assert.equal(tracker.locate('red').component, 'track-a');
  assert.equal(tracker.locate('blue').component, 'track-b');
  assert.equal(tracker.locate('blue', 0.1).status, 'not-entered');
  assert.equal(tracker.all().length, 2);
  assert.throws(() => tracker.enter('red', visit('other', 0.5)), /already occupies/);
  assert.throws(() => tracker.locate('unknown'), /Unknown/);
  assert.throws(() => tracker.locate('red', 0.6), /outside recorded/);
  const history = tracker.history('red'); history[0].component = 'changed';
  assert.equal(tracker.locate('red').component, 'track-a');
});

test('semantic history resolves both sides of a handoff and final exit', async () => {
  const session = await createSession(makeExperiment({component: 'two-tracks'}), 'semantic');
  assert.equal(session.locateMarble('marble').component, 'track-1');
  assert.equal(session.snapshot().marbles[0].component, 'track-1');
  assert.equal(session.marbleHistory('marble')[0].exitedAt, null);
  await session.step();
  assert.equal(session.locateMarble('marble').component, 'track-2');
  assert.equal(session.locateMarble('marble', 0.999).component, 'track-1');
  assert.equal(session.locateMarble('marble', 1).component, 'track-2');
  assert.equal(session.locateMarble('marble', 1).elapsed, 0);
  assert.throws(() => session.locateMarble('marble', 1.5), /outside recorded/);
  const before = session.snapshot();
  session.locateMarble('marble', 0.3);
  assert.deepEqual(session.snapshot(), before, 'inspection must not rewind execution');
  await session.step();
  const end = session.locateMarble('marble');
  assert.equal(end.status, 'exited'); assert.equal(end.component, null);
  assert.equal(end.lastComponent, 'track-2');
  assert.equal(session.snapshot().current.component, null);
  assert.deepEqual(session.marbleHistory('marble').map(v => [v.enteredAt, v.exitedAt]), [[0, 1], [1, 2]]);
  await session.dispose();
  assert.equal(session.locateMarble('marble', 0.5).component, 'track-1', 'history survives disposal');
});

test('speed changes recorded timestamps while scale does not', async () => {
  const session = await createSession(makeExperiment({component: 'two-tracks', scale: 0.5, speed: 4}), 'semantic');
  try {
    await session.step();
    await session.step();
    assert.equal(session.locateMarble('marble', 0.249).component, 'track-1');
    assert.equal(session.locateMarble('marble', 0.25).component, 'track-2');
    assert.equal(session.locateMarble('marble', 0.5).status, 'exited');
  } finally {await session.dispose();}
});

test('discrete execution indexes multiple marbles and batches simultaneous transfers', async () => {
  const {SemanticExecution} = await import('../src/simulator/semantic-execution.js');
  const e = makeExperiment({component: 'two-tracks'});
  const execution = new SemanticExecution(e.circuit, ['red', 'blue'].map(id => ({marble: {id}, component: 'track-1'})));
  assert.deepEqual(execution.occupants('track-1'), ['red', 'blue']);
  const start = execution.locateMarble('red').position;
  execution.step();
  assert.equal(execution.time, 1);
  assert.deepEqual(execution.occupants('track-1'), []);
  assert.deepEqual(execution.occupants('track-2'), ['red', 'blue']);
  assert.deepEqual(execution.locateMarble('red', 0.9).position, start, 'no interpolated movement between events');
  execution.step();
  assert.equal(execution.time, 2);
  assert.deepEqual(execution.occupants('track-2'), []);
  assert.equal(execution.snapshot().results.length, 2);
});

test('event queue orders differing deadlines and stable ties', async () => {
  const {EventQueue} = await import('../src/simulator/event-queue.js');
  const queue = new EventQueue();
  for (const [time, id] of [[3, 'c'], [1, 'a'], [2, 'b'], [1, 'd'], [0, 'z']]) queue.push({time, id});
  assert.deepEqual(Array.from({length: 5}, () => queue.pop().id), ['z', 'a', 'd', 'b', 'c']);
  assert.equal(queue.pop(), null);
});

test('computation trace matches discrete transitions and keeps full precision in events',async()=>{
  const session=await createSession(makeExperiment({component:'two-tracks'}),'semantic');
  try{
    assert.equal(session.traceText(),'t=0.000  marble: StraightTrack.track-1 [in]');
    await session.step();
    assert.equal(session.traceEvents().at(-1).to.component,session.locateMarble('marble').component);
    await session.step();
    assert.equal(session.traceText(),'t=0.000  marble: StraightTrack.track-1 [in]\nt=1.000  marble: StraightTrack.track-1 [out] → StraightTrack.track-2 [in]\nt=2.000  marble: StraightTrack.track-2 [out] → EXIT');
    assert.equal(session.traceEvents({limit:1}).length,1);
    assert.equal(session.traceEvents().at(-1).to,null);
  }finally{await session.dispose();}
});
