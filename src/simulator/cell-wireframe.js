import * as THREE from 'three';

// A spatial reference grid, independent of structural composition levels.
export function cellWireframe(bounds, unit) {
  const min=bounds.min.toArray().map(v=>Math.floor(v/unit));
  const max=bounds.max.toArray().map((v,i)=>Math.max(min[i]+1,Math.ceil(v/unit)));
  const vertices=[];
  for(let axis=0;axis<3;axis++) {
    const a=(axis+1)%3,b=(axis+2)%3;
    for(let i=min[a];i<=max[a];i++)for(let j=min[b];j<=max[b];j++) {
      const start=[],end=[];
      start[axis]=min[axis]*unit;end[axis]=max[axis]*unit;
      start[a]=end[a]=i*unit;start[b]=end[b]=j*unit;
      vertices.push(...start,...end);
    }
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  return new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({
    color:'#49768a',transparent:true,opacity:.25,depthWrite:false,
  }));
}
