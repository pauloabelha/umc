import test from 'node:test';
import assert from 'node:assert/strict';
import {straightTrack} from '../src/components/straight-track.js';
import {passSemantically} from '../src/backends/semantic.js';
import {runTrack} from '../examples/straight-track.js';

test('semantic passage preserves the marble and rejects an exit used as an entrance', () => {
  const track = straightTrack().instantiate('a'), marble = {id: 'm', color: 'blue'};
  const result = passSemantically(track, marble);
  assert.equal(result.output, 'out'); assert.deepEqual(result.marble, marble);
  assert.throws(() => passSemantically(track, marble, 'out'), /in port/);
  assert.throws(() => straightTrack({drop: .01}), /stay level/);
});

for (const timestep of [1 / 240, 1 / 480]) {
  test(`incoming momentum carries a marble along a level track at dt=${timestep}`, async () => {
    const result = await runTrack({timestep});
    assert.equal(result.physical.status, 'exited');
    assert.equal(result.physical.output, result.semantic.output);
    assert.equal(result.physical.id, result.semantic.marble.id);
    assert.ok(result.physical.time > 0 && result.physical.time < 5);
    assert.ok(result.physical.velocity[0] > 0);
  });
}

 test('shared scale preserves passage while semantic speed controls duration', async () => {
  const normal = await runTrack();
  const small = await runTrack({scale: 0.5, speed: 4});
  assert.equal(small.physical.status, 'exited');
  assert.equal(small.semantic.duration, normal.semantic.duration / 4);
  assert.equal(small.semantic.output, normal.semantic.output);
  assert.ok(small.physical.time < normal.physical.time);
});
