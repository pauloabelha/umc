// This initial runner models a completed passage, not continuous travel time.
export function passSemantically(instance, marble, input = 'in', {speed = 1, state = instance.component.initialState} = {}) {
  if (!Number.isFinite(speed) || speed <= 0) throw new Error('Invalid execution speed');
  const result = instance.component.semantic({input, marble, state: structuredClone(state)});
  if (instance.component.ports[result.output]?.direction !== 'output') throw new Error('Unknown output');
  return {mode: 'semantic', component: instance.id, input, duration: instance.component.expectedDuration / speed, ...result};
}
