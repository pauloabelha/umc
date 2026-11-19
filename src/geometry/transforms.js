export const add = (a, b) => a.map((v, i) => v + b[i]);
export const yawVector = (p, yaw) => [Math.cos(yaw)*p[0]+Math.sin(yaw)*p[2], p[1], -Math.sin(yaw)*p[0]+Math.cos(yaw)*p[2]];
export function multiply(a,b) {
  const [x,y,z,w]=a, [u,v,s,t]=b;
  return [w*u+x*t+y*s-z*v,w*v-x*s+y*t+z*u,w*s+x*v-y*u+z*t,w*t-x*u-y*v-z*s];
}
export const yawRotation = yaw => [0,Math.sin(yaw/2),0,Math.cos(yaw/2)];
export function drivePose(drive, time) {
  if(drive.kind==='rotation') {
    const a=drive.angularSpeed*time/2;
    return {position:[...drive.position],rotation:multiply(drive.rotation,[0,0,Math.sin(a),Math.cos(a)])};
  }
  const t = time % drive.period, frames = drive.frames;
  let i = 0;
  while (i+1 < frames.length-1 && frames[i+1].time <= t) i++;
  const a = frames[i], b = frames[i+1], f=(t-a.time)/(b.time-a.time);
  const rotation=a.rotation.map((v,j)=>v+(b.rotation[j]-v)*f);
  const norm=Math.hypot(...rotation);
  return {position:a.position.map((v,j)=>v+(b.position[j]-v)*f),rotation:rotation.map(v=>v/norm)};
}

export function scaleShape(shape, scale) {
  if(shape.kind==='trimesh')return {...shape,vertices:shape.vertices.map(v=>v*scale)};
  if(shape.kind==='compound')return {...shape,children:shape.children.map(child=>({...child,position:child.position.map(v=>v*scale),shape:scaleShape(child.shape,scale)}))};
  return {...shape,size:shape.size.map(v=>v*scale)};
}
