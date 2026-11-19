import {SemanticExecution} from './semantic-execution.js';
import {gpuClient} from '../backends/gpu.js';
import {experimentScene} from './catalog.js';
import {multiply} from '../geometry/transforms.js';

export async function createSession(experiment, mode, {client = gpuClient()} = {}) {
  const {instance, circuit, marble, observe} = experiment;
  if (mode !== 'semantic' && !circuit.physicalSupported) throw new Error('This lattice prototype supports semantic execution only; its physical mechanism is not implemented');
  const subdivisions = circuit.instances.some(i=>['TGate','FerryElevator'].includes(i.component.name)) ? 16 : 4;
  const timestep = Math.sqrt(circuit.scale) / (60 * subdivisions);
  let current = {id: marble.id, time: 0, position: marble.position.map(v => v * circuit.scale)};
  let result = null, world = null, closed = false;
  if (mode === 'semantic') {
    const execution = new SemanticExecution(circuit, [{marble: {id: marble.id}, component: instance.id, radius: marble.radius}]);
    const snapshot = () => {
      const state = execution.snapshot();
      return {current: {...state.marbles[0],laps:experiment.entry.closed?execution.completedPassages(marble.id, experiment.lapComponent ?? circuit.instances.at(-1).id):0}, result: state.results[0] ?? null,
        componentStates: state.componentStates, marbles: state.marbles, nextEventTime: state.nextEventTime};
    };
    return {
      snapshot,
      reenterMarble() {
        if(closed)throw new Error('Session closed');
        execution.reenterMarble(marble.id,instance.id);
        return snapshot();
      },
      componentState: id=>execution.componentState(id),
      traceEvents: options=>execution.traceEvents(options),
      traceText: options=>execution.traceText(options),
      locateMarble: (id, time) => execution.locateMarble(id, time),
      marbleHistory: id => execution.marbleHistory(id),
      occupants: component => execution.occupants(component),
      async step() {
        if (closed) throw new Error('Session closed');
        execution.step(); return snapshot();
      },
      async dispose() {closed = true;},
    };
  }
  if (mode === 'cpu') {
    const {physicalWorld} = await import('../backends/physical.js');
    world = await physicalWorld(circuit, {timestep});
    world.addMarble(marble);
    current = world.snapshot(marble.id);
  } else if (mode === 'gpu') {
    await client.health();
    world = await client.create(experimentScene(experiment, timestep));
    current = {...world.initial.bodies[0], time: world.initial.time,mechanisms:world.initial.mechanisms};
  } else if (mode !== 'semantic') throw new Error('Unknown execution mode');
  current.component = instance.id;
  const hingeFrames=new Map(circuit.bodies().filter(b=>b.hinge).map(b=>[b.id,b]));
  const componentStates=()=>Object.fromEntries((current.mechanisms??[]).map(p=>{
    const body=hingeFrames.get(p.id),q=body.rotation;
    const local=multiply([-q[0],-q[1],-q[2],q[3]],p.rotation);
    const projection=body.hinge.axis.reduce((sum,v,i)=>sum+v*local[i],0);
    return [p.id.split('/')[0],projection>0?'right':'left'];
  }));
  return {
    async reenterMarble() {
      if(closed||result?.status!=='exited')throw new Error('Only an exited marble can be reintroduced');
      if(mode==='gpu') {
        const state=await world.releaseMarble(marble.id,marble.position.map(v=>v*circuit.scale),(marble.velocity??[0,0,0]).map(v=>v*Math.sqrt(circuit.scale)));
        current={...state.bodies[0],time:state.time,mechanisms:state.mechanisms};
      }else current=world.releaseMarble(marble.id,marble.position,marble.velocity);
      current.component=instance.id;result=null;
      if(experiment.resetObservation)experiment.resetObservation(current.time);
      else observe.reset?.(current.time);
      return this.snapshot();
    },
    snapshot: () => structuredClone({current, result, marbles: [], nextEventTime: null,
      componentStates:componentStates()}),
    async step() {
      if (closed) throw new Error('Session closed');
      if (result) return this.snapshot();
      let samples;
      if (mode === 'gpu') samples = (await world.advance(subdivisions,{sampleEvery:subdivisions===16?4:1})).map(s => ({...s.bodies[0], time: s.time,mechanisms:s.mechanisms}));
      else {
        samples = [];
        for (let i = 0; i < subdivisions; i++) {world.step(); samples.push(world.snapshot(marble.id));}
      }
      for (const sample of samples) {
        sample.component = current.component;
        result = observe(current, sample);
        if (result) sample.component = null;
        current = sample;
        if (result) break;
      }
      return this.snapshot();
    },
    async dispose() {if (!closed) {closed = true; await world?.dispose();}},
  };
}
