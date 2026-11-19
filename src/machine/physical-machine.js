import {Circuit} from '../circuit.js';
import {Composition} from '../composition.js';
import {straightTrack} from '../components/straight-track.js';
import {curveTrack} from '../components/curve-track.js';
import {ferry} from '../components/ferry.js';
import {ramp} from '../components/ramp.js';
import {tGate} from '../components/t-gate.js';
import {mergeTrack} from '../components/merge-track.js';
import {add,yawVector} from '../geometry/transforms.js';
import {sevenInstructionProgram} from './inc-jump.js';

// A planar embedding of the fixed seven-instruction program. Every bit has a
// real motorized wheel at its inlet. All other routing stays at y=0.
export function physicalMachine({bits=4,scale=1,speed=1,expectedDuration=1}={}) {
  if(!Number.isInteger(bits)||bits<1||bits>8)throw new Error('Machine supports 1–8 bits');
  const instances=[],connections=[],registers={},groups=[];
  const line=length=>straightTrack({length,expectedDuration});
  const bend=(radius,turn)=>curveTrack({radius,turn,expectedDuration});
  const wheel=()=>ferry({expectedDuration:5*expectedDuration});
  const gate=()=>tGate({expectedDuration});
  const place=(id,definition,position,yaw=0)=>{const i=definition.instantiate(id,{position,yaw});instances.push(i);return i;};
  const port=(i,name)=>add(i.position,yawVector(i.component.ports[name].position,i.yaw));
  const join=(from,output,to,input='in')=>connections.push({from:{component:from.id,port:output},to:{component:to.id,port:input}});
  const attach=(from,output,id,definition,yaw)=>{
    const position=add(port(from,output),yawVector(definition.ports.in.position,yaw).map(n=>-n));
    const i=place(id,definition,position,yaw);join(from,output,i);return i;
  };
  const chain=(from,output,prefix,specs)=>{
    let last=from;const parts=[];
    specs.forEach(([definition,yaw,id],index)=>{last=attach(last,index?'out':output,id??`${prefix}-${index}`,definition,yaw);parts.push(last);});
    if(parts.length)groups.push(Composition.fromInstances(prefix,parts));
    return last;
  };
  const banks={};
  for(const [register,center] of [['a',0],['b',1.2]]) {
    const start=instances.length;
    const inlet=place(`${register}-wheel-0`,wheel(),[center,0,-.18],-Math.PI/2);
    const bitGates=Array.from({length:bits},(_,bit)=>place(`${register}-bit-${bit}`,gate(),[center-.09,0,.6*bit]));
    registers[register]=bitGates.map(i=>i.id);join(inlet,'out',bitGates[0]);
    let previousMerge;
    const bankGroups=[];
    for(let bit=0;bit<bits;bit++) {
      const bitGate=bitGates[bit],z=.6*bit;
      if(bit<bits-1) {
        const nextWheel=chain(bitGate,'right',`${register}-carry-${bit}`,[
          [bend(.06,90),0],[line(.12),-Math.PI/2],[bend(.06,90),-Math.PI/2],
          [bend(.09,-90),Math.PI],[wheel(),-Math.PI/2,`${register}-wheel-${bit+1}`],
        ]);
        bankGroups.push(groups.pop());join(nextWheel,'out',bitGates[bit+1]);
      }
      const merge=place(`${register}-collect-${bit}`,mergeTrack({expectedDuration,outputOffset:.03}),[center-.30,0,z+.18],-Math.PI/2);
      const branch=chain(bitGate,'left',`${register}-completion-${bit}`,[
        [line(.12),Math.PI],[bend(.06,-90),Math.PI],[line(.03),-Math.PI/2],
      ]);
      bankGroups.push(groups.pop());join(branch,'out',merge,'right');
      if(previousMerge) {
        const collector=attach(previousMerge,'out',`${register}-collector-link-${bit}`,line(.48),-Math.PI/2);
        join(collector,'out',merge,'left');
      }
      previousMerge=merge;
    }
    const assigned=new Set(bankGroups.flatMap(g=>g.instances));
    const bankInstances=instances.slice(start);
    groups.push(new Composition(`Register ${register}`, [...bankGroups,...bankInstances.filter(i=>!assigned.has(i)).map(Composition.leaf)]));
    banks[register]={inlet,outlet:previousMerge};
  }
  const entry=place('a-entry',mergeTrack({expectedDuration}),[0,0,-.30],-Math.PI/2);
  join(entry,'out',banks.a.inlet);
  const i1=place('i1',line(.06),[.03,0,-.36],-Math.PI/2),i5=place('i5',line(.06),[-.03,0,-.36],-Math.PI/2);
  join(i1,'out',entry,'right');join(i5,'out',entry,'left');
  const returnWheel=attach(banks.a.outlet,'out','a-return-wheel',wheel(),-Math.PI/2);
  const returnGate=attach(returnWheel,'out','a-return',gate(),0);
  const lastZ=.6*(bits-1);
  const left=chain(returnGate,'left','wire-a-to-i5',[
    [line(.12),Math.PI,'i2'],[bend(.12,90),Math.PI],
    [line(lastZ+.81),Math.PI/2],[bend(.12,90),Math.PI/2],
    [line(.39),0],[bend(.12,90),0],
  ]);join(left,'out',i5);
  const right=chain(returnGate,'right','wire-a-to-b',[
    [line(.12),0,'i6'],[line(.60),0],[bend(.12,-90),0],
    [line(lastZ+.81),Math.PI/2],[bend(.12,90),Math.PI/2],
    [line(.36),0],[bend(.12,90),0],[line(.18),-Math.PI/2,'i3'],
  ]);join(right,'out',banks.b.inlet);
  const bReturn=chain(banks.b.outlet,'out','wire-b-to-i1',[
    [line(.12),-Math.PI/2,'b-return'],[wheel(),-Math.PI/2,'b-return-wheel'],
    [ramp({length:.18,drop:.06,expectedDuration}),-Math.PI/2,'b-return-ramp'],
    [line(.12),-Math.PI/2,'i4'],[line(.24),-Math.PI/2],
    [bend(.12,-90),-Math.PI/2],[line(.69),0],[bend(.12,-90),0],
    [line(.12),Math.PI/2,'i7'],[line(lastZ+1.86),Math.PI/2],[bend(.12,-90),Math.PI/2],
    [line(1.29),Math.PI],[bend(.12,-90),Math.PI],[line(.24),-Math.PI/2],
    [bend(.12,90),-Math.PI/2],[bend(.12,-90),Math.PI],
  ]);join(bReturn,'out',i1);
  const assigned=new Set(groups.flatMap(g=>g.instances));
  const composition=new Composition('Seven-instruction machine',[...groups,...instances.filter(i=>!assigned.has(i)).map(Composition.leaf)]);
  const circuit=new Circuit(instances,{scale,speed,connections,composition});
  return {circuit,registers,program:sevenInstructionProgram.map((instruction,index)=>({...instruction,id:`i${index+1}`,address:index+1})),
    overflowPorts:['a','b'].map(register=>({component:`${register}-bit-${bits-1}`,port:'right'}))};
}

export function makePhysicalMachineExperiment(entry,options={}) {
  const assembly=physicalMachine(options),{circuit}=assembly,instance=circuit.instances.find(i=>i.id==='i1');
  const radius=.011,position=add(instance.position,yawVector([.015,radius+.002,0],instance.yaw));
  const transitions=[];
  let active=instance.id,instruction=instance.id;
  return {entry,circuit,instance,transitions,registerBanks:assembly.registers,overflowPorts:assembly.overflowPorts,
    marble:{id:'marble',position,radius,mass:.005,velocity:yawVector([.4,0,0],instance.yaw)},end:position,
    expectedDuration:circuit.instances.reduce((sum,i)=>sum+i.component.expectedDuration,0)/circuit.speed,
    targetLabel:'Sum of component durations',program:assembly.program.map(i=>({...i,operation:i.op==='INC'?`INC(${i.register})`:`JUMP(${i.target})`,mechanism:i.op==='INC'?`Shared register ${i.register}`:'Level return tracks'})),
    pathLabel:'1 → 2 → 5 → 6 → 3 → 4 → 7 → 1 · shared a/b · Ferris wheels at gate inputs',
    observe(previous,current) {
      current.instruction=instruction;
      const definition=circuit.instances.find(i=>i.id===active).component;
      for(const [name,p] of Object.entries(definition.ports)) {
        if(p.direction!=='output')continue;
        const out=circuit.port(active,name),distance=point=>point.reduce((sum,v,i)=>sum+(v-out.position[i])*out.normal[i],0);
        if(distance(previous.position)>=0||distance(current.position)<0)continue;
        const side=[-out.normal[2],0,out.normal[0]],delta=current.position.map((v,i)=>v-out.position[i]);
        const lateral=Math.abs(delta.reduce((sum,v,i)=>sum+v*side[i],0));
        if(lateral>.022*circuit.scale||delta[1]<.003*circuit.scale||delta[1]>.06*circuit.scale)continue;
        const next=circuit.next(active,name);transitions.push({from:active,output:name,to:next?.component??null,time:current.time});
        if(!next)return {status:'exited',output:name,component:active,...current};
        active=next.component;
        if(/^i[1-7]$/.test(active))instruction=active;
        current.instruction=instruction;break;
      }
      current.component=active;
      if(current.position[1]<-.25*circuit.scale)return {status:'escaped',output:null,...current};
      return null;
    }};
}
