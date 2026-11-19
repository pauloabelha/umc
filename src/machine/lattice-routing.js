import {CELL_SIZE,placeOnLattice} from '../lattice.js';
import {transport} from '../components/lattice-transport.js';
import {latticePort as port} from '../components/t-gate.js';

// Share overhead levels when paths do not intersect. Lift/drop columns remain
// explicit, unqualified mechanisms; spatial routing does not establish physics.
export function routeLattice(base,links,{expectedDuration=1}={}) {
  const instances=[],connections=[],occupied=new Set();
  if(!links.length)return {instances,connections};
  const key=(x,y,z)=>`${x},${y},${z}`,planar=p=>p.join(',');
  const reserve=(min,size,id)=>{
    for(let x=min[0];x<min[0]+size[0];x++)for(let y=min[1];y<min[1]+size[1];y++)for(let z=min[2];z<min[2]+size[2];z++) {
      const k=key(x,y,z);if(occupied.has(k))throw new Error(`Routing overlap at ${k}: ${id}`);occupied.add(k);
    }
  };
  for(const b of base.lattice.bounds)reserve(b.min,b.max.map((n,i)=>n-b.min[i]),b.id);
  const top=Math.max(...base.lattice.bounds.map(b=>b.max[1]));
  const endpoint=e=>{
    const p=base.port(e.component,e.port),point=p.position.map(n=>Math.round(n/CELL_SIZE*2)/2);
    const cell=point.map((n,i)=>i===1?n-1:Math.floor(n)+(p.normal[i]===-1?-1:0));
    return {point,cell,normal:p.normal};
  };
  const planned=links.map((link,index)=>({link,index,ends:[endpoint(link.from),endpoint(link.to)]}));
  // Reserve column footprints and their access cells on every candidate plane.
  // Shortening a column after routing can only release space, not create collisions.
  const columnCells=new Set(),accessCells=new Set();
  for(const plan of planned)for(const {cell} of plan.ends) {
    const id=planar([cell[0],cell[2]]);
    if(columnCells.has(id))throw new Error('Routing endpoints require distinct columns');
    columnCells.add(id);accessCells.add(planar([cell[0],cell[2]+1]));
  }
  const xs=planned.flatMap(p=>p.ends.map(e=>e.cell[0])),zs=planned.flatMap(p=>p.ends.map(e=>e.cell[2]));
  const bounds=[Math.min(...xs)-5,Math.max(...xs)+5,Math.min(...zs)-5,Math.max(...zs)+5];
  const tracks=new Set();
  function findPath(start,end,height) {
    const blocked=p=>columnCells.has(planar(p))||tracks.has(key(p[0],height-1,p[1]))||
      (accessCells.has(planar(p))&&planar(p)!==planar(start)&&planar(p)!==planar(end));
    if(blocked(start)||blocked(end))return null;
    const queue=[start],previous=new Map([[planar(start),null]]);
    for(let cursor=0;cursor<queue.length&&!previous.has(planar(end));cursor++) {
      const p=queue[cursor];
      for(const [dx,dz] of [[1,0],[0,1],[-1,0],[0,-1]]) {
        const q=[p[0]+dx,p[1]+dz];
        if(q[0]<bounds[0]||q[0]>bounds[1]||q[1]<bounds[2]||q[1]>bounds[3]||previous.has(planar(q))||blocked(q))continue;
        previous.set(planar(q),p);queue.push(q);
      }
    }
    if(!previous.has(planar(end)))return null;
    const path=[];for(let p=end;p;p=previous.get(planar(p)))path.push(p);return path.reverse();
  }
  for(const plan of planned) {
    const [start,end]=plan.ends.map(e=>[e.cell[0],e.cell[2]+1]);
    for(let layer=0;layer<links.length;layer++) {
      const height=top+3+layer*2,path=findPath(start,end,height);
      if(path){Object.assign(plan,{height,path});for(const p of path)tracks.add(key(p[0],height-1,p[1]));break;}
    }
    if(!plan.path)throw new Error(`No lattice route for wire ${plan.index}`);
  }
  const add=(id,name,min,size,ports,paths,color,duration)=>{
    reserve(min,size,id);
    instances.push(placeOnLattice(transport({name,size,ports,paths,cellSize:CELL_SIZE,color,expectedDuration:duration}),id,min));
  };
  const join=(from,output,to,input='in')=>connections.push({from:{component:from,port:output},to:{component:to,port:input}});
  for(const {link,index,height,ends,path} of planned) {
    const columns=ends.map((end,side)=>{
      const min=end.cell,size=[1,height-min[1],1],local=end.point.map((n,i)=>n-min[i]);
      const upper=[.5,size[1],1],id=`wire-${index}-${side?'drop':'lift'}`;
      const ports=side?{in:port('input',upper,[0,0,1]),out:port('output',local,end.normal.map(n=>-n))}
        :{in:port('input',local,end.normal.map(n=>-n)),out:port('output',upper,[0,0,1])};
      const center=[.5,.5,.5],high=[.5,size[1]-.5,.5];
      add(id,side?'RoutingDrop':'RoutingLift',min,size,ports,[side?[upper,high,center,local]:[local,center,high,upper]],side?'#f5be24':'#076cc0',expectedDuration*size[1]);
      return id;
    });
    join(link.from.component,link.from.port,columns[0]);join(columns[1],'out',link.to.component,link.to.port);
    const frames=path.map((p,i)=>{
      const before=i?path[i-1]:[p[0],p[1]-1],after=i+1<path.length?path[i+1]:[p[0],p[1]-1];
      const incoming=[before[0]-p[0],0,before[1]-p[1]],outgoing=[after[0]-p[0],0,after[1]-p[1]];
      return {p,incoming,outgoing,turn:incoming.some((n,j)=>n!==-outgoing[j])};
    });
    let previousId=columns[0],segment=0;
    for(let i=0;i<frames.length;) {
      const first=frames[i];let end=i;
      if(!first.turn)while(end+1<frames.length&&!frames[end+1].turn&&frames[end+1].outgoing.every((n,j)=>n===first.outgoing[j]))end++;
      const last=frames[end],min=[Math.min(first.p[0],last.p[0]),height-1,Math.min(first.p[1],last.p[1])];
      const size=[Math.abs(first.p[0]-last.p[0])+1,1,Math.abs(first.p[1]-last.p[1])+1];
      const point=(frame,normal)=>[frame.p[0]+.5+normal[0]/2-min[0],1,frame.p[1]+.5+normal[2]/2-min[2]];
      const a=point(first,first.incoming),b=point(last,last.outgoing),id=`wire-${index}-track-${segment++}`;
      add(id,first.turn?'RoutingCurve':'RoutingTrack',min,size,
        {in:port('input',a,first.incoming),out:port('output',b,last.outgoing)},
        [first.turn?[a,[.5,1,.5],b]:[a,b]],first.turn?'#e33438':'#269eaa',expectedDuration*(end-i+1));
      join(previousId,'out',id);previousId=id;i=end+1;
    }
    join(previousId,'out',columns[1]);
  }
  return {instances,connections};
}
