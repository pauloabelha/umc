import {TRACK_FRICTION} from '../materials.js';
import {channel} from './channel.js';
import {Component} from '../component.js';

// All dimensions are research parameters in metres, not VTech measurements.
export function straightTrack({length = 0.30, drop = 0, width = 0.06,
  wallHeight = 0.04, thickness = 0.005, expectedDuration = 1, smoothEnds = false} = {}) {
  const dimensions = {length, drop, width, wallHeight, thickness};
  if (drop!==0)throw new Error('Straight tracks stay level; use a ramp to descend');
  if (![length,width,wallHeight,thickness].every(v => Number.isFinite(v) && v > 0)) {
    throw new Error('Track dimensions must be positive and finite');
  }
  if (smoothEnds) return channel({name:'StraightTrack',expectedDuration,width,wallHeight,thickness,dimensions,
    points:Array.from({length:13},(_,i)=>[length*i/12,-drop*i/12,0])});
  const angle = Math.atan2(-drop, length), c = Math.cos(angle), s = Math.sin(angle);
  const up = [-s, c, 0], forward = [c, s, 0];
  const ports = {
    in: {direction: 'input', position: [0, 0, 0], normal: forward.map(v => -v), up},
    out: {direction: 'output', position: [length, -drop, 0], normal: forward, up},
  };
  return new Component({
    name: 'StraightTrack', ports, expectedDuration,
    evidence: {
      status: 'approximate',
      source: 'references/vtech/ultimate-xl100e-build.pdf, PDF page 2, T-06/T-07',
      scope: 'Stock straight-track vocabulary; channel geometry, dimensions and materials are unmeasured. No connector replica.',
      dimensions,
    },
    semantic({input, marble}) {
      if (input !== 'in') throw new Error('StraightTrack accepts only its in port');
      if (typeof marble?.id !== 'string' || !marble.id) throw new Error('Marble needs an ID');
      return {output: 'out', marble: structuredClone(marble)};
    },
    physical(instanceId) {
      const rotation = [0, 0, Math.sin(angle / 2), Math.cos(angle / 2)];
      const center = [length / 2, -drop / 2, 0];
      const box = (name, height, side, size) => ({
        id: `${instanceId}/${name}`, motion: 'fixed', shape: {kind: 'box', size},
        position: center.map((v, i) => v + up[i] * height + (i === 2 ? side : 0)),
        rotation, color: name==='floor'?'#147bc5':'#258bd6', friction: TRACK_FRICTION, restitution: 0,
      });
      const run = Math.hypot(length, drop);
      return {units: 'm-kg-s', gravity: [0, -9.81, 0], bodies: [
        box('floor', -thickness / 2, 0, [run, thickness, width + 2 * thickness]),
        box('left-wall', wallHeight / 2, -(width + thickness) / 2, [run, wallHeight, thickness]),
        box('right-wall', wallHeight / 2, (width + thickness) / 2, [run, wallHeight, thickness]),
      ]};
    },
  });
}
