import {Component} from '../component.js';
import {channel} from '../components/channel.js';
import {inputBit} from './gates.js';

export function offsetTrack({offset,length=.24,color='#258bd6'}={}) {
  const points=[[0,0,0]];
  for(let i=0;i<=24;i++) {
    const t=i/24;
    points.push([.015+(length-.03)*t,0,offset*t*t*(3-2*t)]);
  }
  points.push([length,0,offset]);
  return channel({name:'OffsetTrack',points,color,scope:'Estimated level S-bend routing track; not measured stock geometry.'});
}

// A manually configured piece of track, not a memory bit or an automatic actuator.
// Only the selected channel is installed. Changing an input rebuilds the stopped circuit.
export function inputSwitch({value,spread=.14,length=.24}={}) {
  inputBit(value);
  const routes=[offsetTrack({offset:-spread,length}),offsetTrack({offset:spread,length})];
  const ports={in:routes[0].ports.in,zero:routes[0].ports.out,one:routes[1].ports.out};
  return new Component({name:'InputTrackSwitch',ports,expectedDuration:1,initialState:value,
    evidence:{status:'approximate',scope:'Manual level input track: 0/1 selects a fixed S-bend before running. No in-flight switching.',paths:routes.map(r=>r.evidence.path)},
    semantic({input,marble}) {
      if(input!=='in'||!marble?.id)throw new Error('Invalid switch entry');
      return {output:value?'one':'zero',state:value,marble:structuredClone(marble)};
    },
    physical(id){return routes[value].physical(id);},
  });
}
