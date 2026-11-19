import {TRACK_FRICTION} from '../materials.js';
import {Component} from '../component.js';
import {yawRotation} from '../geometry/transforms.js';

// Two parallel level inlets converge into one track. This is estimated custom
// junction geometry, not a measured stock connector. One marble at a time.
export function mergeTrack({expectedDuration=1,outputOffset=0}={}) {
  if(![0,.03].includes(outputOffset))throw new Error('Invalid junction alignment');
  const port=(direction,position,normal)=>({direction,position,normal,up:[0,1,0]});
  return new Component({name:'MergeTrack',expectedDuration,
    ports:{left:port('input',[0,0,.03],[-1,0,0]),right:port('input',[0,0,-.03],[-1,0,0]),out:port('output',[.12,0,outputOffset],[1,0,0])},
    evidence:{status:'approximate',scope:'Custom level receiving junction; single-marble operation only.',dimensions:{width:.06,wallHeight:.05}},
    semantic({input,marble}) {if(!['left','right'].includes(input)||!marble?.id)throw new Error('Invalid merge input');return {output:'out',marble:structuredClone(marble)};},
    physical(id) {
      const bodies=[{id:`${id}/floor`,motion:'fixed',position:[.06,-.002,0],rotation:[0,0,0,1],shape:{kind:'box',size:[.12,.004,.124]},color:'#258bd6',friction:TRACK_FRICTION,restitution:0}];
      for(const sign of [-1,1]) {
        const start=sign*.062,end=outputOffset+sign*.032,delta=end-start;
        bodies.push({id:`${id}/wall-${sign}`,motion:'fixed',position:[.06,.025,(start+end)/2],rotation:yawRotation(-Math.atan2(delta,.12)),shape:{kind:'box',size:[Math.hypot(.12,delta),.05,.004]},color:'#258bd6',friction:TRACK_FRICTION,restitution:0});
      }
      return {bodies};
    }});
}
