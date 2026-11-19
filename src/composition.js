// Composition level is structural depth, never a spatial/elevation coordinate.
export class Composition {
  constructor(name, children) {
    if (!name || !Array.isArray(children) || !children.length) throw new Error('A composition requires named children');
    this.name = name;
    if(children.some(child => !(child instanceof Composition) && (!child?.instance || child.level !== child.instance.component?.level || !Number.isInteger(child.level) || child.level < 0))) throw new Error('Invalid composition child');
    this.children = Object.freeze(children.map(child => child instanceof Composition ? child : Composition.leaf(child.instance)));
    this.level = 1 + Math.max(...children.map(child => child.level));
    const ids = this.instances.map(i => i.id);
    if (new Set(ids).size !== ids.length) throw new Error('A component instance cannot occur twice in a composition');
    Object.freeze(this);
  }
  get instances() { return this.children.flatMap(child => child instanceof Composition ? child.instances : [child.instance]); }
  static leaf(instance) {
    if(!instance?.id || !instance.component || !Number.isInteger(instance.component.level)) throw new Error('Invalid component instance');
    return Object.freeze({name: instance.component.name, id: instance.id, level: instance.component.level, instance}); }
  static fromInstances(name, instances) { return new Composition(name, instances.map(Composition.leaf)); }
}
