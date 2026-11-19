import {elevationIssues} from './elevation.js';
function freeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

// A reusable definition. Runtime state belongs to an execution, not this object.
export class Component {
  constructor({name, ports, evidence, expectedDuration, semantic, physical, initialState = null, lattice = null, physicalSupported = true, elevation = 'level'}) {
    if (!name || typeof semantic !== 'function' || typeof physical !== 'function') {
      throw new Error('Component requires a name and both implementations');
    }
    for (const port of Object.values(ports)) {
      if (!['input', 'output'].includes(port.direction) ||
          !Array.isArray(port.position) || port.position.length !== 3 ||
          !port.position.every(Number.isFinite)) throw new Error('Invalid port');
    }
    if (!Number.isFinite(expectedDuration) || expectedDuration < 0) throw new Error('Invalid expected duration');
    this.level = 0; // Primitive; assemblies derive their level from children.
    this.initialState = freeze(structuredClone(initialState));
    this.lattice = freeze(structuredClone(lattice));
    if (!['level','rise','fall'].includes(elevation)) throw new Error('Invalid elevation rule');
    this.elevation = elevation;
    this.elevationIssues = freeze(elevationIssues({name,ports,elevation,evidence}));
    this.physicalSupported = physicalSupported && this.elevationIssues.length === 0;
    this.expectedDuration = expectedDuration; // seconds at semantic speed 1
    this.name = name;
    this.ports = freeze(structuredClone(ports));
    this.evidence = freeze(structuredClone(evidence));
    this.semantic = semantic;
    this.physical = physical;
    Object.freeze(this);
  }

  instantiate(id, {position = [0, 0, 0], yaw = 0} = {}) {
    if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(id)) throw new Error('Invalid instance ID');
    if (!Array.isArray(position) || position.length !== 3 || !position.every(Number.isFinite)) throw new Error('Invalid instance position');
    if (!Number.isFinite(yaw)) throw new Error('Invalid yaw');
    return Object.freeze({id, component: this, yaw, position: Object.freeze([...position])});
  }
}
