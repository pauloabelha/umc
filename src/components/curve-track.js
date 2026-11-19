import {channel} from './channel.js';
export function curveTrack({radius=.12,drop=0,turn=90,expectedDuration=1}={}) {
  if(drop!==0)throw new Error('Curved tracks stay level; use a ramp to descend');
  if(!Number.isFinite(radius)||radius<=0)throw new Error('Curve dimensions must be positive');
  if(![90,-90].includes(turn))throw new Error('Curve must turn 90 degrees');
  const points=Array.from({length:17},(_,i)=>{const t=i/16,a=t*Math.PI/2;return [radius*Math.sin(a),-drop*t,Math.sign(turn)*radius*(1-Math.cos(a))];});
  return channel({name:'Curve90',color:'#e33438',points,expectedDuration,dimensions:{radius,drop,turn},
    source:'references/vtech/ultimate-xl100e-build.pdf, PDF page 2, T-04',
    scope:'Red quarter-turn track vocabulary. Radius, level channel and connectors are not measured VTech geometry.'});
}
