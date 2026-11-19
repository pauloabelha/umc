import {TRACK_FRICTION} from '../materials.js';
import {Component} from '../component.js';
import {multiply,yawRotation,yawVector} from '../geometry/transforms.js';
export function channel({name, points, expectedDuration = 1, width = 0.06, wallHeight = 0.06, thickness = 0.005, color = '#258bd6', dimensions = {}, source, scope}) {
  const tangent = (a,b) => {const d=b.map((v,i)=>v-a[i]);const n=Math.hypot(d[0],d[2]);return [d[0]/n,0,d[2]/n];};
  const ports={in:{direction:'input',position:points[0],normal:tangent(points[0],points[1]).map(v=>-v),up:[0,1,0]},
    out:{direction:'output',position:points.at(-1),normal:tangent(points.at(-2),points.at(-1)),up:[0,1,0]}};
  // Curved paths supply exact endpoint headings instead of chord approximations.
  if (dimensions.turn) {ports.in.normal=[-1,0,0];ports.out.normal=[0,0,Math.sign(dimensions.turn)];}
  return new Component({name,ports,expectedDuration,elevation:name==='Ramp'?'fall':'level',
    evidence:{status:'approximate',source,scope:scope??'Unmeasured VTech-inspired channel geometry.',dimensions:{...dimensions,width,wallHeight,thickness},path:points},
    semantic({input,marble}) {if(input!=='in'||!marble?.id)throw new Error('Channel accepts an identified marble at its in port');return {output:'out',marble:structuredClone(marble)};},
    physical(id) {
      const vertices=[],indices=[];
      const children=[];
      for(let i=0;i<points.length-1;i++) {
        const a=points[i],b=points[i+1],delta=b.map((v,j)=>v-a[j]);
        const length=Math.hypot(...delta),horizontal=Math.hypot(delta[0],delta[2]);
        const yaw=Math.atan2(-delta[2],delta[0]),pitch=Math.atan2(delta[1],horizontal);
        const rotation=multiply(yawRotation(yaw),[0,0,Math.sin(pitch/2),Math.cos(pitch/2)]);
        const up=yawVector([-Math.sin(pitch),Math.cos(pitch),0],yaw),side=yawVector([0,0,1],yaw);
        const center=a.map((v,j)=>(v+b[j])/2);
        for(const [height,lateral,size] of [
          [-thickness/2,0,[length+.0005,thickness,width+2*thickness]],
          [wallHeight/2,-(width+thickness)/2,[length+.001,wallHeight,thickness]],
          [wallHeight/2,(width+thickness)/2,[length+.001,wallHeight,thickness]],
        ])children.push({position:center.map((v,j)=>v+up[j]*height+side[j]*lateral),rotation,shape:{kind:'box',size}});
      }
      const section=[[-width/2-thickness,-thickness],[width/2+thickness,-thickness],[width/2+thickness,wallHeight],
        [width/2,wallHeight],[width/2,0],[-width/2,0],[-width/2,wallHeight],[-width/2-thickness,wallHeight]];
      points.forEach((point,i)=>{
        let direction=i===0?ports.in.normal.map(v=>-v):i===points.length-1?ports.out.normal:tangent(points[i-1],points[i+1]);
        const side=[-direction[2],0,direction[0]];
        for(const [z,y] of section)vertices.push(point[0]+side[0]*z,point[1]+y,point[2]+side[2]*z);
      });
      for(let i=0;i<points.length-1;i++)for(let j=0;j<8;j++){
        const a=i*8+j,b=(i+1)*8+j,c=i*8+(j+1)%8,d=(i+1)*8+(j+1)%8;
        indices.push(a,b,c,b,d,c);
      }
      const bodies=[{id:`${id}/channel`,motion:'fixed',shape:{kind:'trimesh',vertices,indices},
        collisionShape:{kind:'compound',children},
        position:[0,0,0],rotation:[0,0,0,1],color,friction:TRACK_FRICTION,restitution:0}];
      return {units:'m-kg-s',gravity:[0,-9.81,0],bodies};
    }});
}
export const smooth = t => t*t*(3-2*t);
