import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
export function pocketWheel({radius,pocketRadius,ringRadius,depth}) {
  const group=new THREE.Group(),shape=new THREE.Shape();
  shape.absarc(0,0,radius,0,Math.PI*2,false);
  for(let i=0;i<8;i++) {
    const a=i*Math.PI/4,hole=new THREE.Path();
    hole.absarc(ringRadius*Math.sin(a),-ringRadius*Math.cos(a),pocketRadius,0,Math.PI*2,true);shape.holes.push(hole);
  }
  const geometry=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelSize:depth*.035,bevelThickness:depth*.035,bevelSegments:3,curveSegments:24});
  geometry.translate(0,0,-depth/2);
  group.add(new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:'#076bc1',roughness:.3,metalness:.08})));
  const rim=new THREE.Mesh(new THREE.TorusGeometry(radius*.97,radius*.018,8,96),new THREE.MeshStandardMaterial({color:'#299ad9',roughness:.3}));rim.position.z=depth/2;group.add(rim);
  for(let i=0;i<8;i++) {
    const a=i*Math.PI/4+Math.PI/8,arrow=new THREE.Shape();
    const r=radius;
    arrow.moveTo(r*.22,0);arrow.lineTo(r*.40,r*.10);arrow.lineTo(r*.43,r*.045);arrow.lineTo(r*.68,r*.045);arrow.lineTo(r*.68,-r*.045);arrow.lineTo(r*.43,-r*.045);arrow.lineTo(r*.40,-r*.10);arrow.closePath();
    const mesh=new THREE.Mesh(new THREE.ShapeGeometry(arrow),new THREE.MeshStandardMaterial({color:i%2?'#fff4cf':'#d9fcff',roughness:.5,side:THREE.DoubleSide}));mesh.rotation.z=a;mesh.position.z=depth/2+depth*.05;group.add(mesh);
    for(let stripe=0;stripe<4;stripe++){
      const bar=new THREE.Mesh(new THREE.BoxGeometry(r*.018,r*.10,depth*.015),new THREE.MeshStandardMaterial({color:i%2?'#ffb34d':'#70d9ed'}));
      const d=r*(.7+stripe*.035);bar.position.set(d*Math.cos(a),d*Math.sin(a),depth/2+depth*.06);bar.rotation.z=a;group.add(bar);
    }
  }
  const hub=new THREE.Mesh(new THREE.CylinderGeometry(radius*.14,radius*.14,depth*1.1,32),new THREE.MeshStandardMaterial({color:'#045898',roughness:.4}));hub.rotation.x=Math.PI/2;group.add(hub);
  return group;
}
export function motorBase(size) {
  const group=new THREE.Group();
  const shell=new THREE.Mesh(new RoundedBoxGeometry(...size,4,Math.min(...size)*.12),new THREE.MeshStandardMaterial({color:'#ffc425',roughness:.35}));group.add(shell);
  for(const sign of [-1,1]) {
    const foot=new THREE.Mesh(new RoundedBoxGeometry(size[0]*.18,size[1]*.55,size[2]*.75,3,size[0]*.03),shell.material.clone());foot.position.set(sign*size[0]*.36,-size[1]*.5,0);group.add(foot);
  }
  const button=new THREE.Mesh(new THREE.CylinderGeometry(size[0]*.085,size[0]*.085,size[2]*.08,20),new THREE.MeshStandardMaterial({color:'#0870be'}));button.rotation.x=Math.PI/2;button.position.set(0,0,size[2]*.54);group.add(button);
  return group;
}
