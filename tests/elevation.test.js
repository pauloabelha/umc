import test from 'node:test';
import assert from 'node:assert/strict';
import {catalog,makeExperiment} from '../src/simulator/catalog.js';
import {straightTrack} from '../src/components/straight-track.js';
import {curveTrack} from '../src/components/curve-track.js';
import {elevationIssues} from '../src/elevation.js';

test('every primitive in each active assembly obeys the elevation contract',()=>{
  for(const entry of catalog)for(const scale of [.25,1,2]) {
    const {circuit}=makeExperiment({component:entry.id,scale});
    assert.deepEqual(circuit.elevationIssues,[],entry.id);
    for(const {component} of circuit.instances) {
      if(component.elevation==='rise')assert.equal(component.name,'FerryElevator');
      if(component.elevation==='fall')assert.ok(['Ramp','TGate'].includes(component.name));
    }
  }
});

test('tracks reject explicit drops and internal hidden height changes are audited',()=>{
  for(const factory of [straightTrack,curveTrack])for(const drop of [-.06,.06,NaN])assert.throws(()=>factory({drop}),/stay level/);
  const ports={in:{direction:'input',position:[0,0,0]},out:{direction:'output',position:[1,0,0]}};
  const issues=elevationIssues({name:'Track',ports,evidence:{path:[[0,0,0],[.5,-.1,0],[1,0,0]]}});
  assert.equal(issues.length,1);assert.match(issues[0].reason,/internal path/);
});
