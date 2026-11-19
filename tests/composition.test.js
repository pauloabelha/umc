import test from 'node:test';
import assert from 'node:assert/strict';
import {Composition} from '../src/composition.js';
import {Circuit} from '../src/circuit.js';
import {straightTrack} from '../src/components/straight-track.js';
import {catalog,makeExperiment} from '../src/simulator/catalog.js';

test('composition depth is recursive and independent of elevation or scale',()=>{
  const track=straightTrack(),a=track.instantiate('a',{position:[0,12,0]}),b=track.instantiate('b');
  assert.equal(track.level,0);
  const branch=Composition.fromInstances('branch',[a]);
  const root=new Composition('root',[branch,Composition.leaf(b)]);
  assert.equal(branch.level,1);assert.equal(root.level,2);
  assert.deepEqual(root.instances,[a,b]);
  assert.equal(new Circuit([a,b],{composition:root,scale:2}).level,2);
  assert.throws(()=>new Circuit([a],{composition:root}),/every circuit instance/);
  assert.throws(()=>new Composition('duplicate',[branch,Composition.leaf(a)]),/twice/);
});

test('gallery contains exactly the requested top-level assemblies',()=>{
  assert.deepEqual(catalog.map(e=>e.id),['closed-loop','toggle-loop','seven-instruction-lattice']);
  for(const entry of catalog) {
    const {circuit}=makeExperiment({component:entry.id});
    assert.deepEqual(new Set(circuit.composition.instances),new Set(circuit.instances));
    assert.equal(circuit.level,1+Math.max(...circuit.composition.children.map(c=>c.level)));
  }
});

test('the composed T-gate loop preserves the requested initial gate state',()=>{
  for(const state of ['left','right']) {
    const {circuit}=makeExperiment({component:'toggle-loop',initialState:state});
    assert.equal(circuit.initialState('gate'),state);
    assert.equal(circuit.pass('gate',{id:'marble'}).output,state);
  }
});
