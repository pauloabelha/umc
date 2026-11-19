import {latticeComponent} from '../lattice.js';
import {previewChannels} from './t-gate.js';

export function transport({name,size,ports,paths,cellSize,expectedDuration,color}) {
  return latticeComponent({name,size,ports,cellSize,expectedDuration,physicalSupported:false,
    evidence:{paths:paths.map(path=>path.map(point=>point.map(n=>n*cellSize))),status:'concept',scope:'Lattice layout preview; physical transport not qualified.'},
    semantic({input,marble}) {
      if(ports[input]?.direction!=='input'||!marble?.id)throw new Error('Invalid transport input');
      return {output:'out',marble:structuredClone(marble)};
    },
    physical(id){
      const bodies=previewChannels(id,paths,cellSize,color);
      return {bodies};
    },
  });
}
