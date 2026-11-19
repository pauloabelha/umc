import {EventQueue} from './event-queue.js';
import {MarbleTracker} from './marble-tracker.js';

export class SemanticExecution {
  #events = new EventQueue();
  #tracker = new MarbleTracker();
  #completed = new Map();
  #visits = new Map();
  #time = 0;
  #trace = [];
  #circuit;
  #radii = new Map();
  #states = new Map();
  #plannedStates = new Map();
  #readyTimes = new Map();
  #completionCounts = new Map();

  constructor(circuit, marbles) {
    this.#circuit = circuit;
    for (const {id} of circuit.instances) {
      this.#states.set(id, circuit.initialState(id));
      this.#plannedStates.set(id, circuit.initialState(id));
    }
    for (const {marble, component, input = 'in', radius = 0.011} of marbles) {
      if (this.#radii.has(marble.id)) throw new Error('Duplicate marble ID');
      this.#radii.set(marble.id, radius);
      this.#visits.set(marble.id, []);
      this.#schedule(component, input, marble);
      this.#trace.push({time:0,marble:marble.id,from:null,to:{component,name:this.#circuit.componentName(component),port:input}});
    }
  }

  #schedule(component, input, marble) {
    const before = this.#plannedStates.get(component);
    const passage = this.#circuit.pass(component, marble, input, before);
    if (before !== null) {
      if (passage.state === undefined) throw new Error('Stateful passage must return its next state');
      const startsAt = Math.max(this.#time, this.#readyTimes.get(component) ?? 0);
      passage.transition = {before: structuredClone(before), after: structuredClone(passage.state)};
      passage.wait = startsAt - this.#time;
      passage.duration += passage.wait;
      this.#readyTimes.set(component, this.#time + passage.duration);
      this.#plannedStates.set(component, structuredClone(passage.state));
    }
    if (passage.marble.id !== marble.id) throw new Error('A passage must preserve marble identity');
    const position = port => port.position.map((v, i) => v + port.up[i] * this.#radii.get(marble.id) * this.#circuit.scale);
    this.#tracker.enter(marble.id, {component, input, output: passage.output, time: this.#time,
      duration: passage.duration, from: position(this.#circuit.port(component, input)),
      to: position(this.#circuit.port(component, passage.output))});
    this.#events.push({time: this.#time + passage.duration, passage});
  }

  reenterMarble(id, component, input = 'in') {
    const completed=this.#completed.get(id);
    if(!completed)throw new Error('Only an exited marble can be reintroduced');
    this.#schedule(component,input,completed.marble);
    this.#completed.delete(id);
    this.#trace.push({time:this.#time,marble:id,from:null,to:{component,name:this.#circuit.componentName(component),port:input}});
    return this.snapshot();
  }

  traceEvents({limit=Infinity}={}) {return structuredClone(this.#trace.slice(limit===Infinity?0:-limit));}
  traceText(options) {
    return this.traceEvents(options).map(event=>{
      const from=event.from?`${event.from.name}.${event.from.component} [${event.from.port}] → `:'';
      const to=event.to?`${event.to.name}.${event.to.component} [${event.to.port}]`:'EXIT';
      return `t=${event.time.toFixed(3)}  ${event.marble}: ${from}${to}${event.transition ? ` | state ${event.transition.before} → ${event.transition.after}` : ''}`;
    }).join('\n');
  }
  componentState(id) {
    if (!this.#states.has(id)) throw new Error('Unknown component');
    return structuredClone(this.#states.get(id));
  }
  completedPassages(id, component) {return this.#completionCounts.get(id)?.get(component) ?? 0;}
  completedVisitCount(id) {return this.#visits.get(id)?.length ?? 0;}
  get time() {return this.#time;}
  get nextEventTime() {return this.#events.peek()?.time ?? null;}
  locateMarble(id, time) {return this.#tracker.locate(id, time);}
  marbleHistory(id) {return this.#tracker.history(id);}
  occupants(component) {return this.#tracker.occupants(component);}
  snapshot() {
    return {componentStates: structuredClone(Object.fromEntries(this.#states)), time: this.#time, nextEventTime: this.nextEventTime, marbles: this.#tracker.all(),
      results: structuredClone([...this.#completed.values()])};
  }

  step() {
    if (!this.#events.peek()) return this.snapshot();
    this.#time = this.#events.peek().time;
    let processed = 0;
    // All events at the same virtual timestamp form one atomic step.
    while (this.#events.peek()?.time === this.#time) {
      if (++processed > 10000) throw new Error('Zero-duration event cycle');
      const {passage} = this.#events.pop(), id = passage.marble.id;
      if (passage.transition) this.#states.set(passage.component, structuredClone(passage.state));
      if (!this.#completionCounts.has(id)) this.#completionCounts.set(id, new Map());
      const counts = this.#completionCounts.get(id);
      counts.set(passage.component, (counts.get(passage.component) ?? 0) + 1);
      this.#tracker.exit(id, this.#time);
      this.#visits.get(id).push({...passage, time: this.#time});
      const next = this.#circuit.next(passage.component, passage.output);
      this.#trace.push({time:this.#time,marble:id,duration:passage.duration,...(passage.transition?{transition:structuredClone(passage.transition)}:{}),from:{component:passage.component,name:this.#circuit.componentName(passage.component),port:passage.output},to:next?{...next,name:this.#circuit.componentName(next.component)}:null});
      if (next) this.#schedule(next.component, next.port, passage.marble);
      else this.#completed.set(id, {...passage, status: 'exited', time: this.#time,
        duration: this.#time, visits: [...this.#visits.get(id)]});
    }
    this.#tracker.advanceTo(this.#time);
    return this.snapshot();
  }
}
