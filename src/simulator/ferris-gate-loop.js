import {TRACK_FRICTION} from '../materials.js';
import {Composition} from '../composition.js';
import {Component} from '../component.js';
import {Circuit} from '../circuit.js';
import {ferry} from '../components/ferry.js';
import {tGate} from '../components/t-gate.js';
import {straightTrack} from '../components/straight-track.js';
import {curveTrack} from '../components/curve-track.js';
import {add,yawVector,yawRotation} from '../geometry/transforms.js';

function returnJunction(expectedDuration) {
 const port=(direction,position,normal)=>({direction,position,normal,up:[0,1,0]});
 return new Component({name:'ReturnJunction',expectedDuration,
  ports:{left:port('input',[0,0,.06],[-1,0,0]),right:port('input',[0,0,-.06],[-1,0,0]),out:port('output',[.12,0,0],[1,0,0])},
  evidence:{status:'approximate',scope:'Passive flat return junction; estimated receiving-track geometry, not an identified stock connector.'},
  semantic({input,marble}){if(!['left','right'].includes(input)||!marble?.id)throw new Error('Invalid return entry');return {output:'out',marble:structuredClone(marble)};},
  physical(id){const bodies=[{id:`${id}/floor`,motion:'fixed',position:[.06,-.002,0],rotation:[0,0,0,1],shape:{kind:'box',size:[.12,.004,.2]},color:'#258bd6',friction:TRACK_FRICTION,restitution:0}];
   for(const side of [-1,1])bodies.push({id:`${id}/wall-${side}`,motion:'fixed',position:[.06,.025,side*.064],rotation:yawRotation(side*Math.atan2(.064,.12)),shape:{kind:'box',size:[Math.hypot(.12,.064),.05,.004]},color:'#258bd6',friction:TRACK_FRICTION,restitution:0});
   return {bodies};}
 });
}
export function makeFerrisGateLoop(entry,{scale=1,speed=1,expectedDuration=1,initialState='left'}={}) {
 const instances=[],connections=[];
 const place=(id,component,position,yaw=0)=>{const instance=component.instantiate(id,{position,yaw});instances.push(instance);return instance;};
 const localPort=(instance,name)=>add(instance.position,yawVector(instance.component.ports[name].position,instance.yaw));
 const connect=(a,output,b,input='in')=>connections.push({from:{component:a.id,port:output},to:{component:b.id,port:input}});
 const attach=(previous,output,id,component,yaw=0)=>{
   const position=add(localPort(previous,output),yawVector(component.ports.in.position,yaw).map(v=>-v));
   const next=place(id,component,position,yaw);connect(previous,output,next);return next;
 };
 const wheel=place('elevator',ferry({expectedDuration:expectedDuration*5}),[0,0,0]);
 const top=attach(wheel,'out','top-track',straightTrack({length:.12,expectedDuration}));
 const gate=attach(top,'out','gate',tGate({expectedDuration,initialState}),Math.PI/2);
 const junction=place('merge',returnJunction(expectedDuration),[-.12,0,0]);
 for(const side of ['left','right']) {
   const sign=side==='left'?1:-1,turn=sign*90;
   let last=gate,output=side;
   const path=[
    ['entry',straightTrack({length:.06,expectedDuration}),-sign*Math.PI/2],
    ['bend-1',curveTrack({radius:.06,turn,expectedDuration}),-sign*Math.PI/2],
    ['back',straightTrack({length:.45,expectedDuration}),-Math.PI],
    ['bend-2',curveTrack({radius:.06,turn,expectedDuration}),-Math.PI],
    ['return',straightTrack({length:.03,expectedDuration}),sign*Math.PI/2],
    ['bend-3',curveTrack({radius:.06,turn,expectedDuration}),sign*Math.PI/2],
   ];
   for(const [label,component,yaw] of path){last=attach(last,output,`${side}-${label}`,component,yaw);output='out';}
   connect(last,'out',junction,side);
 }
 connect(junction,'out',wheel);
 const composition=new Composition(entry.label,[
   ...instances.filter(i=>!i.id.startsWith('left-')&&!i.id.startsWith('right-')).map(Composition.leaf),
   ...['left','right'].map(side=>Composition.fromInstances(`${side} return`,instances.filter(i=>i.id.startsWith(`${side}-`)))),
 ]);
 const circuit=new Circuit(instances,{scale,speed,connections,composition});
 let active=wheel.id,laps=0;
 const observe=(previous,current)=>{
   const definition=instances.find(i=>i.id===active).component;
   for(const [name,p] of Object.entries(definition.ports)) {
     if(p.direction!=='output')continue;
     const port=circuit.port(active,name),distance=point=>point.reduce((sum,v,i)=>sum+(v-port.position[i])*port.normal[i],0);
     if(distance(previous.position)<0&&distance(current.position)>=0){
       const side=[-port.normal[2],0,port.normal[0]],delta=current.position.map((v,i)=>v-port.position[i]);
       const lateral=Math.abs(delta.reduce((sum,v,i)=>sum+v*side[i],0));
       if(lateral>.022*scale||delta[1]<.003*scale||delta[1]>.06*scale)continue;
       if(active==='merge')laps++;
       active=circuit.next(active,name).component;break;
     }
   }
   current.component=active;current.laps=laps;
   if(current.position[1]<-.1*scale)return {status:'escaped',output:null,...current};
   return null;
 };
 return {entry,circuit,instance:wheel,marble:{id:'marble',position:[.02,.012,0],radius:.011,mass:.005},lapComponent:'merge',observe,
   expectedDuration:14*expectedDuration/speed,end:[0,0,0],pathLabel:'Ferris wheel ↑ 1 → level track → seesaw ↓ 1 → left / right level return → pickup'};
}
