import {Circuit} from '../circuit.js';
import {Composition} from '../composition.js';
import {channel} from '../components/channel.js';
import {ferry} from '../components/ferry.js';
import {ramp} from '../components/ramp.js';
import {straightTrack} from '../components/straight-track.js';
import {curveTrack} from '../components/curve-track.js';
import {mergeTrack} from '../components/merge-track.js';
import {add,yawVector} from '../geometry/transforms.js';
import {physicalObserver} from '../simulator/physical-observer.js';
import {inputSwitch,offsetTrack} from './routing.js';
import {logicGates,inputBit} from './gates.js';

export function makeLogicExperiment({gate='and',a=0,b=0,scale=1}={}) {
  inputBit(a);inputBit(b);
  const half=gate==='half-adder',definition=logicGates.find(g=>g.id===gate);
  if(!half&&!definition)throw new Error('Unknown logic gate');
  const instances=[],connections=[],modules=[],outputRails={},labels=[];
  const place=(id,component,position,yaw=0)=>{const i=component.instantiate(id,{position,yaw});instances.push(i);return i;};
  const port=(i,name)=>add(i.position,yawVector(i.component.ports[name].position,i.yaw));
  const connect=(i,output,j,input='in')=>connections.push({from:{component:i.id,port:output},to:{component:j.id,port:input}});
  const attach=(i,output,id,component,yaw=0)=>{
    const j=place(id,component,add(port(i,output),yawVector(component.ports.in.position,yaw).map(v=>-v)),yaw);connect(i,output,j);return j;
  };
  const boost=(previous,prefix)=>{
    const wheel=previous?attach(previous,'out',`${prefix}-wheel`,ferry()):place(`${prefix}-wheel`,ferry(),[0,0,0]);
    return {wheel,end:attach(wheel,'out',`${prefix}-ramp`,ramp({length:.18,drop:.06}))};
  };
  const start=boost(null,'input');
  const mergePair=(ends,prefix)=>{
    const z=ends.map(i=>port(i,'out')[2]),center=(z[0]+z[1])/2;
    const paths=ends.map((i,n)=>attach(i,'out',`${prefix}-approach-${n}`,offsetTrack({offset:center+(n? .03:-.03)-z[n]})));
    const endpoint=port(paths[0],'out');
    const merge=place(`${prefix}-merge`,mergeTrack(),[endpoint[0],endpoint[1],center]);
    connect(paths[0],'out',merge,'right');connect(paths[1],'out',merge,'left');return merge;
  };
  function logicModule(previous,spec) {
    const first=instances.length,prefix=spec.id;
    const selector=attach(previous,'out',`${prefix}-A`,inputSwitch({value:a}));
    labels.push({text:`${spec.name} · A=${a}`,position:add(selector.position,[.08,.09,0])});
    const branches=[];
    for(let x=0;x<2;x++) {
      let source=selector;
      if(spec.inputs===2) {
        source=attach(selector,x?'one':'zero',`${prefix}-B-${x}`,inputSwitch({value:b,spread:.065}));
        labels.push({text:`B=${b}`,position:add(source.position,[.08,.09,0])});
      }
      const leaves=[];
      for(let y=0;y<(spec.inputs===2?2:1);y++) {
        const value=spec.rails[2*x+y],id=`${prefix}-rail-${x}${spec.inputs===2?y:''}`;
        const rail=attach(source,(spec.inputs===2?y:x)?'one':'zero',id,channel({name:'OutputTrack',points:[[0,0,0],[.12,0,0]],color:value?'#16a477':'#d17338'}));
        outputRails[id]={module:prefix,value,inputs:spec.inputs===2?[x,y]:[x]};
        labels.push({text:`${half?(prefix==='xor'?'S':'C'):'Y'}=${value}`,position:add(rail.position,[.06,.07,0])});
        leaves.push(rail);
      }
      branches.push(leaves.length===2?mergePair(leaves,`${prefix}-B-${x}`):leaves[0]);
    }
    const end=mergePair(branches,`${prefix}-A`);
    const members=instances.slice(first);
    modules.push(new Composition(spec.name,[
      Composition.fromInstances('Input routing',members.filter(i=>i.component.name==='InputTrackSwitch')),
      Composition.fromInstances('Output rails and level collectors',members.filter(i=>i.component.name!=='InputTrackSwitch')),
    ]));
    return end;
  }
  let last=logicModule(start.end,half?logicGates.find(g=>g.id==='xor'):definition);
  if(half)last=logicModule(boost(last,'carry').end,logicGates.find(g=>g.id==='and'));
  last=boost(last,'return-power').end;
  const endX=port(last,'out')[0],radius=.12,depth=.55;
  last=attach(last,'out','return-bend-1',curveTrack({radius}));
  last=attach(last,'out','return-side-1',straightTrack({length:depth-2*radius,smoothEnds:true}),-Math.PI/2);
  last=attach(last,'out','return-bend-2',curveTrack({radius}),-Math.PI/2);
  last=attach(last,'out','return-back',straightTrack({length:endX+.36,smoothEnds:true}),-Math.PI);
  last=attach(last,'out','return-bend-3',curveTrack({radius}),-Math.PI);
  last=attach(last,'out','return-side-2',straightTrack({length:depth-2*radius,smoothEnds:true}),-3*Math.PI/2);
  last=attach(last,'out','return-bend-4',curveTrack({radius}),-3*Math.PI/2);
  last=attach(last,'out','return-chicane-1',offsetTrack({offset:-.06,length:.18}));
  last=attach(last,'out','return-chicane-2',offsetTrack({offset:.06,length:.18}));
  connect(last,'out',start.wheel);
  const included=new Set(modules.flatMap(m=>m.instances));
  const composition=new Composition(half?'Half-adder closed circuit':`${definition.name} closed circuit`,[
    ...modules,Composition.fromInstances('Ferris supply and closed return',instances.filter(i=>!included.has(i))),
  ]);
  const circuit=new Circuit(instances,{scale,connections,composition});
  const observer=physicalObserver(circuit,start.wheel.id,{closed:true,lapComponent:'return-chicane-2'});
  const entry={id:gate,label:composition.name,closed:true};
  return {entry,circuit,instance:start.wheel,marble:{id:'marble',position:[.02,.012,0],radius:.011,mass:.005},
    lapComponent:'return-chicane-2',observe:observer,outputRails,labels,inputs:{a,b},half,
    expectedDuration:instances.length,end:[0,0,0]};
}
