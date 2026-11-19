// Occupancy is discrete. Live queries use maps; past queries binary-search visits.
export class MarbleTracker {
  #visits = new Map();
  #latest = new Map();
  #occupants = new Map();
  #time = 0;

  advanceTo(time) {
    if (!Number.isFinite(time) || time < this.#time) throw new Error('Tracking time must move forward');
    this.#time = time;
  }

  enter(id, {component, input, output, time, duration, from, to}) {
    if (typeof id !== 'string' || !id || typeof component !== 'string' || !component ||
        !Number.isFinite(time) || time < this.#time || !Number.isFinite(duration) || duration < 0 ||
        ![from, to].every(p => Array.isArray(p) && p.length === 3 && p.every(Number.isFinite))) {
      throw new Error('Invalid marble visit');
    }
    const visits = this.#visits.get(id) ?? [];
    const previous = visits.at(-1);
    if (previous && (previous.exitedAt === null || time < previous.exitedAt)) throw new Error('Marble already occupies a component');
    const visit = {component, input, output, enteredAt: time, expectedExitAt: time + duration,
      exitedAt: null, from: [...from], to: [...to]};
    visits.push(visit);
    this.#visits.set(id, visits);
    this.#latest.set(id, visit);
    if (!this.#occupants.has(component)) this.#occupants.set(component, new Set());
    this.#occupants.get(component).add(id);
  }

  exit(id, time) {
    const visit = this.#latest.get(id);
    if (!visit || visit.exitedAt !== null || time !== visit.expectedExitAt) throw new Error('Invalid marble exit');
    visit.exitedAt = time;
    const residents = this.#occupants.get(visit.component);
    residents.delete(id);
    if (!residents.size) this.#occupants.delete(visit.component);
  }

  occupants(component) {return [...(this.#occupants.get(component) ?? [])];}

  locate(id, time = this.#time) {
    if (!Number.isFinite(time) || time < 0 || time > this.#time) throw new Error('Time is outside recorded execution');
    const visits = this.#visits.get(id);
    if (!visits) throw new Error('Unknown marble');
    let visit;
    if (time === this.#time) visit = this.#latest.get(id); // O(1) live lookup
    else {
      let low = 0, high = visits.length;
      while (low < high) {
        const mid = (low + high) >>> 1;
        if (visits[mid].enteredAt <= time) low = mid + 1;
        else high = mid;
      }
      visit = visits[low - 1];
    }
    if (!visit || visit.enteredAt > time) return {id, time, status: 'not-entered', component: null};
    const exited = visit.exitedAt !== null && time >= visit.exitedAt;
    return {id, time, status: exited ? 'exited' : 'inside', component: exited ? null : visit.component,
      lastComponent: visit.component, input: visit.input, output: visit.output,
      enteredAt: visit.enteredAt, expectedExitAt: visit.expectedExitAt,
      elapsed: Math.min(time, visit.expectedExitAt) - visit.enteredAt,
      position: [...(exited ? visit.to : visit.from)]};
  }

  all(time = this.#time) {return [...this.#visits.keys()].map(id => this.locate(id, time));}
  history(id) {
    if (!this.#visits.has(id)) throw new Error('Unknown marble');
    return structuredClone(this.#visits.get(id));
  }
}
