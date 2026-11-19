import {Composition} from './composition.js';
import {add, yawVector, yawRotation, multiply, scaleShape} from './geometry/transforms.js';
import {validateLattice} from './lattice.js';
import {passSemantically} from './backends/semantic.js';

// Definitions stay in real-size metres; this shared scale applies to all geometry.
export class Circuit {
  #instances;
  #routes;
  constructor(instances, {scale = 1, speed = 1, connections = [], cellSize = null, composition = null} = {}) {
    if (![scale, speed].every(v => Number.isFinite(v) && v > 0)) {
      throw new Error('Scale and speed must be positive and finite');
    }
    if (new Set(instances.map(i => i.id)).size !== instances.length) throw new Error('Duplicate component ID');
    this.instances = Object.freeze([...instances]);
    this.composition = composition ?? Composition.fromInstances('Circuit', instances);
    const leaves = this.composition.instances;
    if (leaves.length !== instances.length || leaves.some(i => !instances.includes(i))) throw new Error('Composition must contain every circuit instance exactly once');
    this.level = this.composition.level;
    this.#instances = new Map(instances.map(instance=>[instance.id,instance]));
    this.#routes = new Map();
    this.lattice = cellSize === null ? null : validateLattice(instances, cellSize);
    this.elevationIssues = Object.freeze(instances.flatMap(i => i.component.elevationIssues.map(issue => Object.freeze({...issue,instance:i.id}))));
    this.physicalSupported = instances.every(i => i.component.physicalSupported);
    this.scale = scale;
    this.speed = speed;
    this.connections = Object.freeze(connections.map(({from, to}) => Object.freeze({
      from: Object.freeze({...from}), to: Object.freeze({...to}),
    })));
    const outputs = new Set();
    for (const {from, to} of this.connections) {
      const a = this.port(from.component, from.port), b = this.port(to.component, to.port);
      if (a.direction !== 'output' || b.direction !== 'input') throw new Error('Connect an output to an input');
      const key = `${from.component}/${from.port}`;
      if (outputs.has(key)) throw new Error('An output cannot duplicate a marble');
      outputs.add(key);
      this.#routes.set(key,to);
      if (a.position.some((v, i) => Math.abs(v - b.position[i]) > 1e-9 * scale) ||
          a.normal.some((v, i) => Math.abs(v + b.normal[i]) > 1e-9) ||
          a.up.some((v, i) => Math.abs(v - b.up[i]) > 1e-9)) {
        throw new Error('Connected port frames must meet and face each other');
      }
    }
    Object.freeze(this);
  }

  componentName(id) {
    const instance=this.#instances.get(id);
    if(!instance)throw new Error('Unknown component');
    return instance.component.name;
  }

  initialState(id) {
    if (!this.#instances.has(id)) throw new Error('Unknown component');
    return structuredClone(this.#instances.get(id).component.initialState);
  }

  pass(id, marble, input = 'in', state = this.initialState(id)) {
    const instance = this.#instances.get(id);
    if (!instance) throw new Error('Unknown component');
    return passSemantically(instance, marble, input, {speed: this.speed, state});
  }

  next(component, port) {
    return this.#routes.get(`${component}/${port}`) ?? null;
  }

  bodies() {
    return this.instances.flatMap(instance => {
      const transform = frame => ({...frame,
        position: add(yawVector(frame.position, instance.yaw), instance.position).map(v=>v*this.scale),
        rotation: multiply(yawRotation(instance.yaw), frame.rotation)});
      return instance.component.physical(instance.id).bodies.map(body => ({...transform(body),
        shape: scaleShape(body.shape,this.scale),
        ...(body.mass?{mass:body.mass*this.scale**3}:{}),
        ...(body.collisionShape?{collisionShape:scaleShape(body.collisionShape,this.scale)}:{}),
        ...(body.visual?{visual:{...body.visual,radius:body.visual.radius*this.scale,pocketRadius:body.visual.pocketRadius*this.scale,ringRadius:body.visual.ringRadius*this.scale,depth:body.visual.depth*this.scale}}:{}),
        ...(body.drive?.kind==='rotation' ? {drive:{...transform(body.drive),angularSpeed:body.drive.angularSpeed/Math.sqrt(this.scale)}} : body.drive ? {drive:{period:body.drive.period*Math.sqrt(this.scale),frames:body.drive.frames.map(frame=>({...transform(frame),time:frame.time*Math.sqrt(this.scale)}))}} : {}),
      }));
    });
  }

  visuals() {
    return this.instances.flatMap(instance=>(instance.component.physical(instance.id).visuals??[]).map(visual=>({...visual,
      position:add(yawVector(visual.position,instance.yaw),instance.position).map(v=>v*this.scale),
      rotation:multiply(yawRotation(instance.yaw),visual.rotation),size:visual.size.map(v=>v*this.scale),
    })));
  }

  port(id, name) {
    const instance = this.#instances.get(id);
    const port = instance?.component.ports[name];
    if (!port) throw new Error('Unknown port');
    return {...port, position:add(yawVector(port.position,instance.yaw),instance.position).map(v=>v*this.scale),normal:yawVector(port.normal,instance.yaw),up:yawVector(port.up,instance.yaw)};
  }
}
