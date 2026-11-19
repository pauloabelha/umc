import {createSession} from '../simulator/session.js';

// Read only actual output-track departures. No truth-table evaluation or forces.
export async function createLogicSession(experiment,mode,options) {
  const session=await createSession(experiment,mode,options);
  let previous=session.snapshot(),outputs={},completed=[],lastProgress=previous.current.time;
  const snapshot=()=>({...session.snapshot(),logic:{outputs:{...outputs},completed:structuredClone(completed)}});
  return {
    snapshot,
    async step() {
      const state=await session.step(),from=previous.current.component,to=state.current.component;
      if(from!==to) {
        lastProgress=state.current.time;
        const rail=experiment.outputRails[from];
        if(rail)outputs[rail.module]={value:rail.value,rail:from,inputs:[...rail.inputs]};
      }
      if(state.current.laps>previous.current.laps) {
        const modules=experiment.half?['xor','and']:[experiment.entry.id];
        if(modules.some(id=>!outputs[id]))throw new Error('Lap finished without crossing every output rail');
        completed.push({lap:state.current.laps,time:state.current.time,outputs:structuredClone(outputs)});
        if(completed.length>100)completed.shift();
        outputs={};
      }
      previous=state;
      if(state.result)throw new Error(`Marble ${state.result.status}; reset to retry`);
      if(state.current.time-lastProgress>45*Math.sqrt(experiment.circuit.scale))throw new Error(`Marble stalled in ${state.current.component}`);
      return snapshot();
    },
    dispose:()=>session.dispose(),
  };
}
