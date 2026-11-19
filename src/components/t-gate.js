import {latticeComponent, CELL_SIZE, inMetres} from '../lattice.js';
import {channel} from './channel.js';
import {tGateMechanism} from './t-gate-mechanism.js';

export const latticePort = (direction, position, normal) => ({direction, position, normal, up:[0,1,0]});

// These bodies are a layout preview, not a collision-based switching mechanism.
export function previewChannels(id, paths, cellSize, color = '#9b59c7') {
  return paths.flatMap((points, i) => channel({name:'Preview', points:points.map(p=>inMetres(p,cellSize)),
    width:cellSize*.7, wallHeight:cellSize*.35, thickness:cellSize*.06, color}).physical(`${id}/path-${i}`).bodies);
}

export function tGate({cellSize = CELL_SIZE, expectedDuration = 1, initialState = 'left'} = {}) {
  if (!['left','right'].includes(initialState)) throw new Error('Invalid T-gate initial state');
  return latticeComponent({name:'TGate',elevation:'fall',size:[3,2,3],cellSize,initialState,expectedDuration,physicalSupported:true,
    ports:{in:latticePort('input',[1.5,1,0],[0,0,-1]),
      left:latticePort('output',[0,0,1.5],[-1,0,0]),right:latticePort('output',[3,0,1.5],[1,0,0])},
    evidence:{status:'approximate',scope:'User-proposed passive seesaw with divider, upper inlet and two lower outlets. Two-level footprint; estimated geometry, not measured VTech dimensions.'},
    semantic({input,marble,state}) {
      if(input!=='in'||!marble?.id||!['left','right'].includes(state)) throw new Error('Invalid T-gate passage');
      return {marble:structuredClone(marble),output:state,state:state==='left'?'right':'left'};
    },
    physical(id) {return tGateMechanism(id,{unit:cellSize,initialState});},
  });
}
