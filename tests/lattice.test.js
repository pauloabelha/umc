import test from 'node:test';
import assert from 'node:assert/strict';
import {Circuit} from '../src/circuit.js';
import {CELL_SIZE, placeOnLattice, latticeComponent} from '../src/lattice.js';
import {tGate} from '../src/components/t-gate.js';
import {SemanticExecution} from '../src/simulator/semantic-execution.js';
import {makeExperiment, experimentScene} from '../src/simulator/catalog.js';
import {createSession} from '../src/simulator/session.js';
import {physicalWorld} from '../src/backends/physical.js';
import {gpuClient} from '../src/backends/gpu.js';

const gateCircuit=(options={})=>new Circuit([placeOnLattice(tGate(options),'gate')],{cellSize:CELL_SIZE});
const marble=id=>({marble:{id},component:'gate'});

test('reintroducing an exited marble retains gate memory, time, identity and history',async()=>{
  const session=await createSession(makeExperiment({component:'t-gate'}),'semantic');
  assert.throws(()=>session.reenterMarble(),/exited/);
  for(let i=0;i<10;i++) {
    const snapshot=await session.step();
    assert.equal(snapshot.result.output,i%2?'right':'left');
    assert.equal(snapshot.current.time,i+1);
    assert.equal(session.marbleHistory('marble').length,i+1);
    const reset=session.reenterMarble();
    assert.equal(reset.result,null);
    assert.equal(reset.current.component,'gate');
    assert.equal(reset.current.id,'marble');
    assert.deepEqual(session.occupants('gate'),['marble']);
  }
  await session.dispose();assert.throws(()=>session.reenterMarble(),/closed/);
});

test('T-gate preserves 100 marble identities and alternates from either initial state at every scale and speed',()=>{
  for(const initialState of ['left','right'])for(const scale of [.25,1,2])for(const speed of [.5,4]) {
    const circuit=new Circuit([placeOnLattice(tGate({initialState,expectedDuration:2}),'gate')],{cellSize:CELL_SIZE,scale,speed});
    const execution=new SemanticExecution(circuit,Array.from({length:100},(_,i)=>marble(`ball-${i}`)));
    for(let i=0;i<100;i++) {
      const snapshot=execution.step(),result=snapshot.results.at(-1);
      const output=i%2?(initialState==='left'?'right':'left'):initialState;
      assert.equal(result.marble.id,`ball-${i}`);
      assert.equal(result.output,output);
      assert.equal(snapshot.time,(i+1)*2/speed);
      assert.equal(snapshot.componentStates.gate,output==='left'?'right':'left');
      assert.equal(execution.occupants('gate').length,99-i);
    }
    assert.equal(execution.nextEventTime,null);
    assert.equal(execution.componentState('gate'),initialState);
  }
});

test('T-gate footprint and both exits descend exactly one shared cell',()=>{
  const gate=tGate();
  assert.deepEqual(gate.lattice.size,[3,2,3]);
  for(const scale of [.25,.5,1,2]) {
    const circuit=new Circuit([placeOnLattice(gate,'gate',[2,3,-1],1)],{cellSize:CELL_SIZE,scale});
    for(const output of ['left','right'])assert.ok(Math.abs(circuit.port('gate','in').position[1]-circuit.port('gate',output).position[1]-CELL_SIZE*scale)<1e-10);
  }
});

test('lattice rejects fractional placements, mixed units, overlaps, and invalid port faces',()=>{
  assert.throws(()=>placeOnLattice(tGate(),'g',[.5,0,0]),/integer/);
  assert.throws(()=>new Circuit([tGate().instantiate('g',{yaw:.1})],{cellSize:CELL_SIZE}),/lattice/);
  assert.throws(()=>new Circuit([placeOnLattice(tGate(),'g')],{cellSize:.1}),/lattice/);
  assert.throws(()=>new Circuit([placeOnLattice(tGate(),'a'),placeOnLattice(tGate(),'b',[1,0,0])],{cellSize:CELL_SIZE}),/overlap/);
  assert.throws(()=>latticeComponent({size:[1,1,1],ports:{in:{position:[.5,0,.5],normal:[1,0,0]}}}),/boundary/);
});

test('queued gate passages alternate deterministically; state commits only at completion',()=>{
  const execution=new SemanticExecution(gateCircuit(),[marble('a'),marble('b'),marble('c')]);
  assert.equal(execution.componentState('gate'),'left');
  assert.equal(execution.occupants('gate').length,3);
  for(const [time,output,state] of [[1,'left','right'],[2,'right','left'],[3,'left','right']]) {
    const snapshot=execution.step();
    assert.equal(snapshot.time,time);
    assert.equal(snapshot.results.at(-1).output,output);
    assert.equal(execution.componentState('gate'),state);
  }
  assert.equal(execution.componentState('gate'),'right','state persists with no marbles');
  execution.step();assert.equal(execution.componentState('gate'),'right');
  assert.match(execution.traceText(),/TGate.gate \[left\].*state left → right/);
  assert.equal(new SemanticExecution(gateCircuit(),[marble('reset')]).componentState('gate'),'left');
});

test('separate instances and executions never share gate memory',()=>{
  const gate=tGate(), circuit=new Circuit([placeOnLattice(gate,'a'),placeOnLattice(gate,'b',[3,0,0])],{cellSize:CELL_SIZE});
  const execution=new SemanticExecution(circuit,[{marble:{id:'m'},component:'a'}]);
  execution.step();assert.equal(execution.componentState('a'),'right');assert.equal(execution.componentState('b'),'left');
  const fresh=new SemanticExecution(circuit,[]);assert.equal(fresh.componentState('a'),'left');
  const right=new SemanticExecution(gateCircuit({initialState:'right'}),[marble('r')]);
  assert.equal(right.step().results[0].output,'right');
});

test('both branches close through merge and elevator for 100 laps at multiple scales and speeds',async()=>{
  for(const scale of [.25,1,2])for(const speed of [1,4]) {
    const experiment=makeExperiment({component:'toggle-loop',scale,speed});
    const session=await createSession(experiment,'semantic');
    try {
      let snapshot;
      for(let i=0;i<1000;i++) {
        snapshot=await session.step();
        assert.equal(snapshot.result,null);
        assert.equal(snapshot.marbles.length,1);
        assert.equal(session.occupants(snapshot.current.component).length,1);
      }
      assert.equal(snapshot.current.laps,100);
      assert.equal(snapshot.current.time,1400/speed);
      assert.equal(snapshot.componentStates.gate,'left');
      const turns=session.traceEvents().filter(e=>e.from?.component==='gate');
      assert.equal(turns.length,100);
      turns.forEach((event,i)=>assert.equal(event.to.component,i%2?'right-entry':'left-entry'));
      const first=turns[0];
      assert.equal(session.locateMarble('marble',first.time).component,'left-entry');
      assert.equal(session.locateMarble('marble',first.time-1e-5).component,'gate');
      assert.equal((await session.step()).result,null);
    } finally {await session.dispose();}
  }
});

test('unimplemented physical mechanisms cannot silently execute as passive geometry',async()=>{
  const experiment=makeExperiment({component:'two-bit-counter'});
  for(const mode of ['cpu','gpu'])await assert.rejects(createSession(experiment,mode),/semantic execution only/);
  await assert.rejects(physicalWorld(experiment.circuit),/not implemented/);
  await assert.rejects(gpuClient({fetchImpl:()=>assert.fail('must not send preview to GPU')}).create(experimentScene(experiment)),/not implemented/);
});

test('two-bit counter carries only on A overflow and counts modulo four for 100 laps',async()=>{
  for(const scale of [.25,1,2])for(const speed of [1,4]) {
    const experiment=makeExperiment({component:'two-bit-counter',scale,speed});
    const session=await createSession(experiment,'semantic');
    try {
      assert.equal(experiment.circuit.instances.length,9);
      let snapshot=session.snapshot(), steps=0;
      for(let lap=1;lap<=100;lap++) {
        while((snapshot.current.laps??0)<lap) {
          snapshot=await session.step();
          assert.ok(++steps<=600,'counter must return to elevator');
          assert.equal(snapshot.result,null);
          assert.equal(session.occupants(snapshot.current.component).length,1);
        }
        const a=Number(snapshot.componentStates['gate-a']==='right');
        const b=Number(snapshot.componentStates['gate-b']==='right');
        assert.equal(2*b+a,lap%4);
        assert.equal(snapshot.current.component,'elevator');
        assert.equal(snapshot.current.time,(Math.ceil(lap/2)*9+Math.floor(lap/2)*11)/speed);
      }
      const events=session.traceEvents();
      const a=events.filter(e=>e.from?.component==='gate-a');
      a.forEach((e,i)=>assert.equal(e.to.component,i%2?'carry-track':'bypass'));
      assert.equal(a.length,100);
      assert.equal(events.filter(e=>e.from?.component==='gate-b').length,50);
      assert.equal(events.filter(e=>e.from?.component==='bypass').length,50);
      const carry=events.find(e=>e.from?.component==='gate-b');
      assert.equal(session.locateMarble('marble',carry.time-1e-5).component,'gate-b');
      assert.equal(session.locateMarble('marble',carry.time).component,carry.to.component);
    } finally {await session.dispose();}
    const reset=await createSession(experiment,'semantic');
    assert.equal(reset.componentState('gate-a'),'left');assert.equal(reset.componentState('gate-b'),'left');
    await reset.dispose();
    for(const mode of ['cpu','gpu'])await assert.rejects(createSession(experiment,mode),/semantic execution only/);
  }
});

test('five-instruction jump machine follows wired targets and retains indexed instruction history',async()=>{
  for(const scale of [.25,1,2])for(const speed of [1,4]) {
    const experiment=makeExperiment({component:'jump-machine',scale,speed,expectedDuration:2});
    const session=await createSession(experiment,'semantic');
    try {
      assert.equal(experiment.program.length,5);
      assert.equal(session.snapshot().current.component,'i1');
      const visited=new Set(['i1']);
      for(let lap=0;lap<100;lap++) {
        for(const id of [lap%2?'i5':'i3','i2','i4','i1']) {
          const previous=session.snapshot().current.component;
          const snapshot=await session.step();
          assert.equal(snapshot.current.component,id);
          assert.ok(experiment.program.find(i=>i.id===previous).targets.includes(Number(id.slice(1))));
          assert.equal(session.occupants(id).length,1);
          assert.equal(session.locateMarble('marble',snapshot.current.time).component,id);
          assert.equal(session.locateMarble('marble',snapshot.current.time-1e-6).component,previous);
          visited.add(id);
        }
        assert.equal(session.snapshot().current.laps,lap+1);
        assert.equal(session.snapshot().current.time,(lap+1)*16/speed);
      }
      assert.equal(visited.size,5);
      assert.equal(session.componentState('i1'),'left');
      assert.match(session.traceText(),/TGate.i1.*ReturnTrack.i5/);
    } finally {await session.dispose();}
    const reset=await createSession(experiment,'semantic');
    assert.equal(reset.snapshot().current.component,'i1');assert.equal(reset.componentState('i1'),'left');
    await reset.dispose();
    for(const mode of ['cpu','gpu'])await assert.rejects(createSession(experiment,mode),/semantic execution only/);
  }
});
