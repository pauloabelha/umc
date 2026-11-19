import * as THREE from 'three';

export function latticeView(lattice, scale) {
  const group=new THREE.Group(), unit=lattice.cellSize*scale;
  const min=[0,1,2].map(i=>Math.min(...lattice.bounds.map(b=>b.min[i])));
  const max=[0,1,2].map(i=>Math.max(...lattice.bounds.map(b=>b.max[i])));
  const vertices=[];
  for(let y=min[1];y<=max[1];y++) {
    for(let x=min[0];x<=max[0];x++) vertices.push(x*unit,y*unit,min[2]*unit,x*unit,y*unit,max[2]*unit);
    for(let z=min[2];z<=max[2];z++) vertices.push(min[0]*unit,y*unit,z*unit,max[0]*unit,y*unit,z*unit);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  group.add(new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color:'#667d8e',transparent:true,opacity:.16})));
  for(const bounds of lattice.bounds) {
    const size=bounds.max.map((n,i)=>(n-bounds.min[i])*unit);
    const box=new THREE.BoxGeometry(...size);
    const edges=new THREE.EdgesGeometry(box);box.dispose();
    const outline=new THREE.LineSegments(edges,new THREE.LineBasicMaterial({color:bounds.id==='gate'?'#8646b2':'#5c7e91',transparent:true,opacity:.45}));
    outline.position.fromArray(bounds.min.map((n,i)=>n*unit+size[i]/2));group.add(outline);
    if(bounds.id.startsWith('wire-'))continue;
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=96;
    const context=canvas.getContext('2d');context.font='600 32px sans-serif';context.textAlign='center';context.fillStyle='#243b4c';
    context.fillText(bounds.id,256,58);
    const texture=new THREE.CanvasTexture(canvas);
    const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthTest:false}));
    sprite.position.set(outline.position.x,bounds.max[1]*unit+.45*unit,outline.position.z);
    sprite.scale.set(3*unit,.5625*unit,1);group.add(sprite);
  }
  return group;
}
