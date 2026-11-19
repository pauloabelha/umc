import test from 'node:test';
import assert from 'node:assert/strict';
import {straightTrack} from '../src/components/straight-track.js';
import {Circuit} from '../src/circuit.js';
import {makeExperiment, experimentScene} from '../src/simulator/catalog.js';
import {createSession} from '../src/simulator/session.js';

const connection = {from: {component: 'a', port: 'out'}, to: {component: 'b', port: 'in'}};
test('connections require aligned ports and never duplicate a marble', () => {
  const track = straightTrack(), a = track.instantiate('a');
  const b = track.instantiate('b', {position: track.ports.out.position});
  const circuit = new Circuit([a, b], {connections: [connection]});
  assert.deepEqual(circuit.port('a', 'out').position, circuit.port('b', 'in').position);
  assert.deepEqual(circuit.next('a', 'out'), connection.to);
  assert.throws(() => new Circuit([a, track.instantiate('b')], {connections: [connection]}), /must meet/);
  assert.throws(() => new Circuit([a, b], {connections: [connection, connection]}), /duplicate/);
  assert.throws(() => new Circuit([a, b], {connections: [{from: connection.to, to: connection.from}]}), /output to an input/);
});

test('semantic handoff consumes both durations and preserves the same marble', async () => {
  const e = makeExperiment({component: 'two-tracks', speed: 2});
  const s = await createSession(e, 'semantic');
  try {
    const halfway = await s.step();
    assert.equal(halfway.result, null);
    assert.equal(halfway.current.component, 'track-2');
    const join = e.circuit.port('track-2', 'in');
    assert.deepEqual(halfway.current.position, join.position.map((v, i) => v + join.up[i] * e.marble.radius));
    const completed = await s.step();
    assert.equal(completed.result.time, 1);
    assert.deepEqual(completed.result.visits.map(v => v.component), ['track-1', 'track-2']);
    assert.deepEqual(completed.result.visits.map(v => v.marble.id), ['marble', 'marble']);
    assert.deepEqual(completed.current.position, e.end);
  } finally {await s.dispose();}
});

test('two discrete semantic steps traverse two components', async () => {
  const s = await createSession(makeExperiment({component: 'two-tracks'}), 'semantic');
  try {assert.equal((await s.step()).result, null); assert.equal((await s.step()).result.time, 2);} finally {await s.dispose();}
});

test('two physical track instances form a continuous path at every offered scale', async () => {
  for (const scale of [0.25, 0.5, 1, 2]) {
    const e = makeExperiment({component: 'two-tracks', scale});
    const scene = experimentScene(e);
    assert.equal(scene.bodies.length, 7);
    assert.equal(new Set(scene.bodies.map(b => b.id)).size, 7);
    const s = await createSession(e, 'cpu');
    try {
      let previous = s.snapshot().current, crossedJoin = false, result;
      for (let i = 0; i < 300; i++) {
        const snapshot = await s.step();
        const current = snapshot.current;
        assert.ok(current.position[0] >= previous.position[0] - 1e-6);
        assert.ok(current.position[0] - previous.position[0] < 0.04 * Math.sqrt(scale));
        if (previous.position[0] < 0.3 * scale && current.position[0] >= 0.3 * scale) crossedJoin = true;
        previous = current; result = snapshot.result;
        if (result) break;
      }
      assert.ok(crossedJoin, `join at scale ${scale}`);
      assert.equal(result?.status, 'exited', `exit at scale ${scale}`);
      assert.ok(result.position[0] >= 0.6 * scale);
    } finally {await s.dispose();}
  }
});
