import {Circuit} from '../circuit.js';
import {CELL_SIZE, placeOnLattice} from '../lattice.js';
import {tGate, latticePort as port} from '../components/t-gate.js';
import {transport} from '../components/lattice-transport.js';

// Left = 0, right = 1. A's old 1 carries into B; old 0 bypasses B.
export function makeCounterExperiment(entry,{scale=1,speed=1,expectedDuration=1}={}) {
  const cellSize=CELL_SIZE, instances=[], connections=[];
  const add=(id,name,size,origin,ports,paths,color='#269eaa',duration=expectedDuration)=>{
    instances.push(placeOnLattice(transport({name,size,ports,paths,color,cellSize,expectedDuration:duration}),id,origin));
  };
  add('elevator','LatticeElevator',[3,3,3],[0,0,-6],{
    in:port('input',[1.5,0,3],[0,0,1]),out:port('output',[1.5,3,3],[0,0,1]),
  },[[[1.5,0,3],[1.5,0,1],[1.5,3,1],[1.5,3,3]]],'#076cc0',expectedDuration*5);
  add('top-track','Track',[3,1,3],[0,2,-3],{
    in:port('input',[1.5,1,0],[0,0,-1]),out:port('output',[1.5,1,3],[0,0,1]),
  },[[[1.5,1,0],[1.5,1,3]]]);
  const gate=tGate({cellSize,expectedDuration});
  instances.push(placeOnLattice(gate,'gate-a',[0,2,0]),placeOnLattice(gate,'gate-b',[6,1,3],1));
  add('bypass','Bypass',[3,2,3],[-3,0,0],{
    in:port('input',[3,2,1.5],[1,0,0]),out:port('output',[3,0,1.5],[1,0,0]),
  },[[[3,2,1.5],[.5,2,1.5],[.5,0,1.5],[3,0,1.5]]],'#e7a82a');
  add('carry-track','Track',[3,1,3],[3,1,0],{
    in:port('input',[0,1,1.5],[-1,0,0]),out:port('output',[3,1,1.5],[1,0,0]),
  },[[[0,1,1.5],[3,1,1.5]]]);
  for(const side of ['left','right']) {
    const front=side==='left',z=front?0:3;
    add(`${side}-return`,'ReturnTrack',[3,1,3],[6,0,front?3:-3],{
      in:port('input',[1.5,1,z],[0,0,front?-1:1]),out:port('output',[0,0,1.5],[-1,0,0]),
    },[[[1.5,1,z],[1.5,.5,1.5],[0,0,1.5]]]);
  }
  add('merge','Merge',[6,1,9],[0,0,-3],{
    bypass:port('input',[0,0,4.5],[-1,0,0]),
    left:port('input',[6,0,7.5],[1,0,0]),right:port('input',[6,0,1.5],[1,0,0]),
    out:port('output',[1.5,0,0],[0,0,-1]),
  },[[[0,0,4.5],[1.5,0,4.5],[1.5,0,0]],[[6,0,7.5],[1.5,0,7.5],[1.5,0,0]],[[6,0,1.5],[1.5,0,1.5],[1.5,0,0]]],'#e7a82a');
  const connect=(from,output,to,input='in')=>connections.push({from:{component:from,port:output},to:{component:to,port:input}});
  connect('elevator','out','top-track');connect('top-track','out','gate-a');
  connect('gate-a','left','bypass');connect('bypass','out','merge','bypass');
  connect('gate-a','right','carry-track');connect('carry-track','out','gate-b');
  for(const side of ['left','right']) {connect('gate-b',side,`${side}-return`);connect(`${side}-return`,'out','merge',side);}
  connect('merge','out','elevator');
  const circuit=new Circuit(instances,{connections,cellSize,scale,speed}),instance=instances[0];
  const radius=.011,input=circuit.port(instance.id,'in');
  const position=input.position.map((v,i)=>v/scale+input.up[i]*(radius+.002));
  return {entry,circuit,instance,marble:{id:'marble',position,radius,mass:.005},lapComponent:'merge',
    expectedDuration:expectedDuration*11/speed,
    pathLabel:'elevator → A → bypass / (carry → B) → merge → elevator · bits B A',
    end:position,observe(){throw new Error('Physical lattice mechanism not implemented');}};
}
