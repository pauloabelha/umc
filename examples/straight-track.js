import {makeExperiment} from '../src/simulator/catalog.js';
import {physicalWorld} from '../src/backends/physical.js';

export async function runTrack({timestep = 1 / 240, scale = 1, speed = 1} = {}) {
  const experiment = makeExperiment({scale, speed});
  const {instance, circuit, marble, observe} = experiment;
  const semantic = circuit.pass(instance.id, {id: marble.id});
  const world = await physicalWorld(circuit, {timestep});
  try {
    world.addMarble(marble);
    let previous = world.snapshot(marble.id);
    for (let i = 0; i <= Math.ceil(5 / timestep); i++) {
      world.step();
      const current = world.snapshot(marble.id);
      const result = observe(previous, current);
      if (result) return {semantic, physical: {mode: 'physical', component: instance.id, ...result},
        evidence: instance.component.evidence};
      previous = current;
    }
    throw new Error('Experiment exceeded its time limit');
  } finally {world.dispose();}
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file:').href) {
  const result = await runTrack();
  console.log(JSON.stringify(result, null, 2));
  if (result.physical.status !== 'exited') process.exitCode = 1;
}
