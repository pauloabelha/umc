import {latticeMachine} from './lattice-machine.js';
import {SemanticExecution} from '../simulator/semantic-execution.js';
import {registerValue} from './increment-register.js';

// Observes instruction boundaries; all movement and state mutation belong to
// SemanticExecution and the connected Circuit, never to the displayed PC.
export class LatticeMachineExecution {
  #assembly; #execution; #pc=1; #steps=0; #visits=Array(7).fill(0); #trace=[]; #before={a:'0',b:'0'};
  constructor(options={}) {
    this.#assembly=latticeMachine(options);
    this.#execution=new SemanticExecution(this.#assembly.circuit,[{marble:{id:'marble'},component:'i1'}]);
  }
  get assembly(){return this.#assembly;}
  snapshot() {
    const state=this.#execution.snapshot(),current=state.marbles[0];
    const registers=Object.fromEntries(Object.entries(this.#assembly.registers).map(([name,ids])=>[name,registerValue(ids,state.componentStates).toString()]));
    const overflow=state.results[0];
    const halt=overflow?`Register ${overflow.component[0]} overflow: add capacity and reset. INC did not complete.`:null;
    return {pc:this.#pc,time:state.time,steps:this.#steps,registers,halt,
      location:current.component??`${overflow.component}-overflow`,
      gates:Object.fromEntries(Object.entries(state.componentStates).filter(([,value])=>value!==null)),
      instructions:this.#assembly.program.map((instruction,index)=>({op:instruction.op,...(instruction.op==='INC'?{register:instruction.register}:{target:instruction.target}),address:index+1,
        status:index+1===this.#pc?(halt?'overflow':current.component===`i${this.#pc}`?'active':'executing'):'ready',executions:this.#visits[index]}))};
  }
  trace(limit=Infinity){return structuredClone(limit===Infinity?this.#trace:this.#trace.slice(-limit));}
  componentTrace(limit=Infinity) {
    return this.#execution.traceEvents({limit}).map(e=>({time:e.time,marble:e.marble,from:e.from?.component??'START',
      output:e.from?.port??'in',to:e.to?.component??'OVERFLOW',transition:e.transition??null}));
  }
  locateMarble(time){return this.#execution.locateMarble('marble',time);}
  stepComponent() {
    if(this.#execution.nextEventTime===null)return this.snapshot();
    this.#execution.step();
    const event=this.#execution.traceEvents({limit:1})[0];
    if(event.to&&/^i[1-7]$/.test(event.to.component)) {
      const next=Number(event.to.component.slice(1)),instruction=this.#assembly.program[this.#pc-1];
      const after=this.snapshot().registers;
      this.#steps++;this.#visits[this.#pc-1]++;
      this.#trace.push({step:this.#steps,time:event.time,instruction:this.#pc,op:instruction.op,
        ...(instruction.op==='INC'?{register:instruction.register}:{target:instruction.target}),next,before:this.#before,after});
      this.#before={...after};this.#pc=next;
    }
    return this.snapshot();
  }
  step() {
    const initial=this.#steps;
    for(let i=0;i<=this.#assembly.circuit.instances.length&&this.#steps===initial&&this.#execution.nextEventTime!==null;i++)this.stepComponent();
    if(this.#steps===initial&&this.#execution.nextEventTime!==null)throw new Error('Instruction did not reach a continuation');
    return this.snapshot();
  }
}
