import {channel,smooth} from './channel.js';
export function ramp({length=.4,drop=.18,expectedDuration=1}={}) {
  if(![length,drop].every(v=>Number.isFinite(v)&&v>0))throw new Error('Ramp dimensions must be positive');
  return channel({name:'Ramp',color:'#f5be24',expectedDuration,points:Array.from({length:17},(_,i)=>[length*i/16,-drop*smooth(i/16),0]),dimensions:{length,drop},
    source:'references/vtech/ultimate-xl100e-build.pdf, PDF page 2, M-06',
    scope:'Yellow descending ramp vocabulary. Smooth channel is a simulation approximation, not a replica of the M-06 wedge or its connectors.'});
}
