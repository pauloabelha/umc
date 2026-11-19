import {transport} from '../components/lattice-transport.js';
import {Circuit} from '../circuit.js';
import {placeOnLattice, CELL_SIZE} from '../lattice.js';
import {tGate, latticePort as port} from '../components/t-gate.js';

export function makeLatticeExperiment(entry,{scale=1,speed=1,expectedDuration=1,initialState='left'}={}) {
  const cellSize=CELL_SIZE, instances=[], connections=[];
  const gate=tGate({cellSize,expectedDuration,initialState});
  if(!entry.closed)instances.push(placeOnLattice(gate,'gate'));
  else {
    const elevator=transport({name:'LatticeElevator',size:[3,2,3],cellSize,expectedDuration:expectedDuration*5,color:'#076cc0',
      ports:{in:port('input',[1.5,0,0],[0,0,-1]),out:port('output',[1.5,2,3],[0,0,1])},
      paths:[[[1.5,0,0],[1.5,0,.5],[1.5,.4,1],[1.5,1.6,2],[1.5,2,2.5],[1.5,2,3]]]});
    instances.push(placeOnLattice(elevator,'elevator',[0,0,-3]),placeOnLattice(gate,'gate',[0,1,0]));
    for(const side of ['left','right']) {
      const left=side==='left', edge=left?3:0, sign=left?-1:1;
      const route=transport({name:'ReturnTrack',size:[3,1,9],cellSize,expectedDuration,color:'#269eaa',
        ports:{in:port('input',[edge,1,7.5],[-sign,0,0]),out:port('output',[edge,0,1.5],[-sign,0,0])},
        paths:[[[edge,1,7.5],[edge+sign, .9,7.5],[edge+2.5*sign,.7,6],[edge+2.5*sign,.3,3],[edge+sign,.1,1.5],[edge,0,1.5]]]});
      instances.push(placeOnLattice(route,`${side}-return`,[left?-3:3,0,-6]));
    }
    const merge=transport({name:'Merge',size:[3,1,3],cellSize,expectedDuration,color:'#e7a82a',
      ports:{left:port('input',[0,0,1.5],[-1,0,0]),right:port('input',[3,0,1.5],[1,0,0]),out:port('output',[1.5,0,3],[0,0,1])},
      paths:[[[0,0,1.5],[.5,0,1.5],[1.5,0,2.5],[1.5,0,3]],[[3,0,1.5],[2.5,0,1.5],[1.5,0,2.5],[1.5,0,3]]]});
    instances.push(placeOnLattice(merge,'merge',[0,0,-6]));
    const connect=(from,output,to,input='in')=>connections.push({from:{component:from,port:output},to:{component:to,port:input}});
    connect('elevator','out','gate');
    for(const side of ['left','right']) {connect('gate',side,`${side}-return`);connect(`${side}-return`,'out','merge',side);}
    connect('merge','out','elevator');
  }
  const circuit=new Circuit(instances,{scale,speed,connections,cellSize}), instance=instances[0];
  const radius=.011, input=circuit.port(instance.id,'in');
  const position=input.position.map((v,i)=>v/scale+input.up[i]*(radius+.002)-input.normal[i]*.005);
  let observationStart=0;
  return {entry,instance,circuit,resetObservation(time){observationStart=time;},marble:{id:'marble',position,radius,mass:.005},lapComponent:'merge',
    expectedDuration:expectedDuration*(entry.closed?8:1)/speed,
    pathLabel:entry.closed?'elevator → gate → left / right return → merge → elevator':'in (level 1) → left / right (level 0)',
    end:position,observe(previous,current){
      if(entry.closed)throw new Error('Physical lattice mechanism not implemented');
      current.component=instance.id;
      for(const output of ['left','right']) {
        const port=circuit.port(instance.id,output);
        const distance=p=>p.reduce((sum,v,i)=>sum+(v-port.position[i])*port.normal[i],0);
        if(distance(previous.position)<0&&distance(current.position)>=0) {
          const inside=Math.abs(current.position[2]-port.position[2])<.025*scale&&current.position[1]>0&&current.position[1]<.05*scale;
          return {status:inside?'exited':'escaped',output:inside?output:null,...current};
        }
      }
      if(current.position[1]<-.05*scale)return {status:'escaped',output:null,...current};
      if(current.time-observationStart>8*Math.sqrt(scale))return {status:'timeout',output:null,...current};
      return null;
    }};
}
