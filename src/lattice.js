import {Component} from './component.js';
import {yawVector} from './geometry/transforms.js';

// One shared cubic cell, in metres at scale 1. This is a design unit, not a VTech measurement.
export const CELL_SIZE = 0.06;
const integer = n => Math.abs(n - Math.round(n)) < 1e-8;
export const inMetres = (point, cellSize = CELL_SIZE) => point.map(n => n * cellSize);

export function latticeComponent({size, cellSize = CELL_SIZE, ports, ...definition}) {
  if (!Number.isFinite(cellSize) || cellSize <= 0 || size.length !== 3 ||
      !size.every(n => Number.isInteger(n) && n > 0)) throw new Error('Invalid lattice dimensions');
  for (const port of Object.values(ports)) {
    const axis = port.normal.findIndex(n => Math.abs(n) === 1);
    if (axis < 0 || port.normal.filter(n => n !== 0).length !== 1 ||
        port.position.length !== 3 || !port.position.every((n, i) => Number.isFinite(n) && integer(n * 2) && n >= 0 && n <= size[i]) ||
        port.position[axis] !== (port.normal[axis] < 0 ? 0 : size[axis])) {
      throw new Error('Lattice ports must lie on an outward-facing boundary, at whole or half-cell coordinates');
    }
  }
  return new Component({...definition, lattice: {size, cellSize, ports},
    ports: Object.fromEntries(Object.entries(ports).map(([name, port]) => [name, {...port, position: inMetres(port.position, cellSize)}]))});
}

export function placeOnLattice(component, id, cell = [0, 0, 0], quarterTurns = 0) {
  if (!component.lattice || !cell.every(Number.isInteger) || cell.length !== 3 || !Number.isInteger(quarterTurns)) {
    throw new Error('Lattice placement requires integer cells and quarter turns');
  }
  return component.instantiate(id, {position: inMetres(cell, component.lattice.cellSize), yaw: quarterTurns * Math.PI / 2});
}

export function validateLattice(instances, cellSize) {
  if (!Number.isFinite(cellSize) || cellSize <= 0) throw new Error('Invalid cell size');
  const occupied = new Map(), bounds = [];
  for (const instance of instances) {
    const lattice = instance.component.lattice;
    if (!lattice || lattice.cellSize !== cellSize || !integer(instance.yaw / (Math.PI / 2)) ||
        !instance.position.every(n => integer(n / cellSize))) throw new Error('All components must share the lattice and use integer placements');
    const origin = instance.position.map(n => n / cellSize), size = lattice.size;
    const corners = [];
    for (const x of [0, size[0]]) for (const y of [0, size[1]]) for (const z of [0, size[2]]) {
      corners.push(yawVector([x,y,z], instance.yaw).map((n,i) => Math.round(n + origin[i])));
    }
    const min = origin.map((_,i) => Math.min(...corners.map(c => c[i])));
    const max = origin.map((_,i) => Math.max(...corners.map(c => c[i])));
    for (let x=min[0]; x<max[0]; x++) for (let y=min[1]; y<max[1]; y++) for (let z=min[2]; z<max[2]; z++) {
      const key = `${x},${y},${z}`;
      if (occupied.has(key)) throw new Error(`Lattice overlap: ${occupied.get(key)} and ${instance.id}`);
      occupied.set(key, instance.id);
    }
    bounds.push(Object.freeze({id:instance.id, min:Object.freeze(min), max:Object.freeze(max)}));
  }
  return Object.freeze({cellSize, bounds:Object.freeze(bounds)});
}
