// Coordinates are unscaled metres. A level is structural depth elsewhere;
// here we validate actual inlet/outlet elevations and internal channel paths.
export function elevationIssues({name,ports,elevation='level',evidence}) {
  const issues=[],epsilon=1e-9;
  const inputs=Object.entries(ports).filter(([,p])=>p.direction==='input');
  const outputs=Object.entries(ports).filter(([,p])=>p.direction==='output');
  const allowed=delta=>elevation==='rise'?delta>epsilon:elevation==='fall'?delta < -epsilon:Math.abs(delta)<=epsilon;
  for(const [input,a] of inputs)for(const [output,b] of outputs) {
    const delta=b.position[1]-a.position[1];
    if(!allowed(delta))issues.push({component:name,input,output,delta,reason:`${name} declares ${elevation} transport but changes height by ${delta} m`});
  }
  for(const path of evidence?.paths??(evidence?.path?[evidence.path]:[])) {
    for(let i=1;i<path.length;i++) {
      const delta=path[i][1]-path[i-1][1];
      if(elevation==='level'?Math.abs(delta)>epsilon:elevation==='rise'?delta < -epsilon:delta>epsilon) {
        issues.push({component:name,reason:`${name} has an internal path that violates ${elevation} transport`});break;
      }
    }
  }
  return issues;
}
