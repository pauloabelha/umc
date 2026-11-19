import {Component} from '../component.js';
import {channel} from '../components/channel.js';
import {inputBit} from './gates.js';
import {TRACK_FRICTION} from '../materials.js';
import {yawRotation} from '../geometry/transforms.js';

// A passive, level guide aligns a marble with the wheel's narrow pickup pocket.
export function feedGuide() {
  const port=(direction,x,normal)=>({direction,position:[x,0,0],normal:[normal,0,0],up:[0,1,0]});
  return new Component({name:'CenteringTrack',expectedDuration:1,
    ports:{in:port('input',0,-1),out:port('output',.18,1)},
    evidence:{status:'approximate',scope:'Level tapered feed guide; a 24 mm clear throat centers the 22 mm marble before wheel pickup.',path:[[0,0,0],[.18,0,0]]},
    semantic({input,marble}){if(input!=='in'||!marble?.id)throw new Error('Invalid feed entry');return {output:'out',marble:structuredClone(marble)};},
    physical(id){
      const body=(name,position,size,rotation=[0,0,0,1])=>({id:`${id}/${name}`,motion:'fixed',position,rotation,shape:{kind:'box',size},color:'#537f9c',friction:TRACK_FRICTION,restitution:0});
      const bodies=[body('floor',[.09,-.002,0],[.18,.004,.068])];
      for(const sign of [-1,1]) {
        bodies.push(body(`taper-${sign}`,[.06,.025,sign*.023],[Math.hypot(.12,.018)+.001,.05,.004],yawRotation(sign*Math.atan2(.018,.12))));
        bodies.push(body(`throat-${sign}`,[.15,.025,sign*.014],[.061,.05,.004]));
      }
      return {bodies};
    },
  });
}

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
