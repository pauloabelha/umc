import {Component} from '../component.js';
import {multiply,yawRotation} from '../geometry/transforms.js';
// Eight-pocket continuously driven rotor. Dimensions/contact geometry are estimates.
// Visual references: archived VTech Ultimate manual p.6 and images/wheel-closeup.jpg.
export function ferry({expectedDuration=5}={}) {
  const tilt=-.18,ringRadius=.055,pocketRadius=.016,outerRadius=.077,period=8;
  const baseRotation=multiply(yawRotation(-Math.PI/2),[Math.sin(tilt/2),0,0,Math.cos(tilt/2)]);
  const orient=p=>{
    const [x,y,z]=p,c=Math.cos(tilt),s=Math.sin(tilt);
    return [-s*y-c*z,c*y-s*z,x];
  };
  const input=orient([0,-ringRadius-pocketRadius,.075]);
  const world=p=>orient(p).map((v,i)=>v-input[i]);
  // One cubic lattice level of lift, and a three-cell forward reach.
  const target=[.18,.06,0],c=Math.cos(tilt),s=Math.sin(tilt);
  const discharge=[0,-ringRadius-pocketRadius-s*target[0]+c*target[1],.075-c*target[0]-s*target[1]];
  const out=target;
  const children=[];
  for(let pocket=0;pocket<8;pocket++) {
    const angle=pocket*Math.PI/4,center=[ringRadius*Math.sin(angle),-ringRadius*Math.cos(angle),0];
    for(let i=0;i<16;i++) {
      const a=2*Math.PI*i/16;
      children.push({position:[center[0]+(pocketRadius+.002)*Math.cos(a),center[1]+(pocketRadius+.002)*Math.sin(a),0],
        rotation:[0,0,Math.sin(a/2),Math.cos(a/2)],shape:{kind:'box',size:[.004,2*(pocketRadius+.002)*Math.tan(Math.PI/16)+.0005,.038]}});
    }
  }
  for(let i=0;i<8;i++) {
    const a=i*Math.PI/4+Math.PI/8;
    children.push({position:[.03*Math.cos(a),.03*Math.sin(a),0],rotation:[0,0,Math.sin(a/2),Math.cos(a/2)],shape:{kind:'box',size:[.06,.015,.038]}});
  }
  for(let i=0;i<48;i++) {
    const a=2*Math.PI*i/48;
    children.push({position:[.075*Math.cos(a),.075*Math.sin(a),0],rotation:[0,0,Math.sin(a/2),Math.cos(a/2)],shape:{kind:'box',size:[.004,2*.075*Math.tan(Math.PI/48)+.0003,.038]}});
  }
  const fixed=[];
  const box=(id,position,size,rotation=[0,0,0,1],color='#086bc1')=>fixed.push({id,position:world(position),rotation:multiply(baseRotation,rotation),motion:'fixed',shape:{kind:'box',size},friction:id.startsWith('in-')?.002:.25,restitution:0,color});
  // Rear retention plate stops below the top pockets, leaving the discharge open.
  box('retainer',[0,-.028,-.024],[.16,.092,.008],[0,0,0,1],'#f6bf26');
  // Lower feed chute approaches through the front face.
  box('in-floor',[0,-.075,.0375],[.076,.008,.075]);
  for(const side of [-1,1])box(`in-wall${side}`,[side*.026,-.053,.045],[.004,.044,Math.hypot(.06,.02)],yawRotation(side*Math.atan2(.02,.06)));
  // Broad rear catch tray, tapering to one standard-width outlet.
  const funnelLength=-.024-discharge[2],trayZ=(discharge[2]-.024)/2,wide=.065,narrow=.03;
  box('out-floor',[0,discharge[1]-.004,trayZ],[.13,.008,funnelLength]);
  for(const sign of [-1,1]) {
    const dx=sign*(narrow-wide),dz=-funnelLength,angle=Math.atan2(-dz,dx);
    box(`out-wall${sign}`,[sign*(wide+narrow)/2,discharge[1]+.025,trayZ],[Math.hypot(dx,dz),.05,.006],yawRotation(angle));
  }
  return new Component({name:'FerryElevator',expectedDuration,elevation:'rise',
    ports:{in:{direction:'input',position:[0,0,0],normal:[-1,0,0],up:[0,1,0]},out:{direction:'output',position:out,normal:[1,0,0],up:[0,1,0]}},
    evidence:{status:'approximate',source:'VTech Ultimate manual p.6; references/vtech/images/wheel-closeup.jpg',
      scope:'Eight-pocket blue rotor and yellow motor housing, continuously rotating. Estimated dimensions and retention/discharge geometry; not a measured replica.',
      dimensions:{length:out[0],drop:-out[1],width:.06,wallHeight:.06},path:[[0,0,0],out]},
    semantic({input,marble}) {if(input!=='in'||!marble?.id)throw new Error('Elevator accepts its in port');return {output:'out',marble:structuredClone(marble)};},
    physical(id) {
      const position=world([0,0,0]);
      const rotor={id:`${id}/rotor`,motion:'kinematic',position,rotation:baseRotation,shape:{kind:'compound',children},
        drive:{kind:'rotation',position,rotation:baseRotation,angularSpeed:-2*Math.PI/period},
        friction:.002,restitution:0,color:'#076cc0',visual:{kind:'pocket-wheel',radius:outerRadius,pocketRadius,ringRadius,depth:.038}};
      return {units:'m-kg-s',gravity:[0,-9.81,0],bodies:[rotor,...fixed.map(b=>({...b,id:`${id}/${b.id}`}))],
        visuals:[{kind:'motor-base',position:world([0,-.065,0]),rotation:baseRotation,size:[.095,.08,.075]}]};
    }});
}
