// Observe crossings only. This never moves a marble or changes a mechanism.
export function physicalObserver(circuit,initialComponent,{radius=.011,closed=false,lapComponent=null}={}) {
 const exits=new Map(circuit.instances.map(i=>[i.id,Object.entries(i.component.ports).filter(([,p])=>p.direction==='output').map(([name])=>({name,...circuit.port(i.id,name)}))]));
  const bottom=Math.min(...circuit.instances.flatMap(i=>Object.keys(i.component.ports).map(name=>circuit.port(i.id,name).position[1])));
 let active=initialComponent,laps=0,startedAt=0;
 const observe=(previous,current)=>{
  for(const port of exits.get(active)) {
   const distance=point=>point.reduce((sum,v,i)=>sum+(v-port.position[i])*port.normal[i],0);
   if(distance(previous.position)>=0||distance(current.position)<0)continue;
   const delta=current.position.map((v,i)=>v-port.position[i]),side=[-port.normal[2],0,port.normal[0]];
   const lateral=Math.abs(delta.reduce((sum,v,i)=>sum+v*side[i],0));
   if(lateral>.022*circuit.scale||delta[1]<radius*circuit.scale/3||delta[1]>.06*circuit.scale)continue;
   const next=circuit.next(active,port.name);
   if(!next)return {status:'exited',output:port.name,component:active,...current};
   if(active===lapComponent)laps++;
   active=next.component;break;
  }
  current.component=active;current.laps=laps;
  if(current.position[1]<bottom-.1*circuit.scale)return {status:'escaped',output:null,...current};
  if(!closed&&current.time-startedAt>30*Math.sqrt(circuit.scale))return {status:'timeout',output:null,...current};
  return null;
 };
 observe.reset=time=>{active=initialComponent;startedAt=time;};
 return observe;
}
