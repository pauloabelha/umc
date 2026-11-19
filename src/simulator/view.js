import {latticeView} from './lattice-view.js';
import {cellWireframe} from './cell-wireframe.js';
import {pocketWheel,motorBase} from './wheel-model.js';
import {drivePose} from '../geometry/transforms.js';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';

export function createView(host) {
  const renderer = new THREE.WebGLRenderer({antialias: true});
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor('#edf2f5');
  host.append(renderer.domElement);
  const halo = document.createElement('div');
  halo.className = 'marble-halo';
  halo.setAttribute('aria-hidden', 'true');
  halo.hidden = true;
  host.append(halo);
  renderer.domElement.setAttribute('aria-label', '3D component view. Drag to orbit; scroll to zoom.');
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x607080, 3));
  const light = new THREE.DirectionalLight(0xffffff, 3);
  light.position.set(-1, 3, 2); scene.add(light);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.001, 100);
  const controls = new OrbitControls(camera, renderer.domElement);
  let fitWideScene=false,aspectFit=1;
  const group = new THREE.Group(); scene.add(group);
  const decorations = new THREE.Group(); scene.add(decorations);
  const cells = new THREE.Group(); cells.visible=false; scene.add(cells);
  const cellToggle=document.createElement('button');
  cellToggle.id='toggle-cells';cellToggle.type='button';cellToggle.className='viewport-toggle';
  cellToggle.innerHTML='<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><path d="m12 2 9 5v10l-9 5-9-5V7Z M3 7l9 5 9-5 M12 12v10 M7.5 4.5l9 5v10 M16.5 4.5l-9 5v10 M3 12l9 5 9-5"/></svg>';
  function updateCellToggle() {
    cellToggle.setAttribute('aria-pressed',String(cells.visible));
    cellToggle.setAttribute('aria-label','Cell wireframe');
    cellToggle.title=`${cells.visible?'Hide':'Show'} cell wireframe · 60 mm cells at reference scale`;
  }
  updateCellToggle();
  cellToggle.onclick=()=>{cells.visible=!cells.visible;updateCellToggle();render();};
  host.append(cellToggle);
  let marble;
  let driven=[];
  let stateIndicators=[];
  const mechanismMeshes=new Map();
  const componentMeshes = new Map(), baseMaterials = new Map();
  const accent = new THREE.Color('#48e5ff');
  const outlineMaterial = new THREE.LineBasicMaterial({color:'#00c9f4', transparent:true, opacity:.85, depthTest:false, depthWrite:false});
  let activeComponent = null, outlines = [];
  function clearOutlines() {
    for (const outline of outlines) {outline.removeFromParent(); outline.geometry.dispose();}
    outlines = [];
  }
  function setHighlight(component) {
    component ??= null;
    if (component === activeComponent) return;
    clearOutlines();
    for (const mesh of componentMeshes.get(activeComponent) ?? []) {
      const base = baseMaterials.get(mesh.material);
      mesh.material.color.copy(base.color);
      mesh.material.emissive.copy(base.emissive);
      mesh.material.emissiveIntensity = base.intensity;
    }
    activeComponent = component;
    host.dataset.activeComponent = component ?? '';
    for (const mesh of componentMeshes.get(component) ?? []) {
      const base = baseMaterials.get(mesh.material);
      mesh.material.color.copy(base.color).lerp(accent, .25);
      mesh.material.emissive.copy(accent);
      mesh.material.emissiveIntensity = .55;
      const outline = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, 30), outlineMaterial);
      outline.renderOrder = 20;
      mesh.add(outline); outlines.push(outline);
    }
  }
  const projected = new THREE.Vector3(), cameraPosition = new THREE.Vector3();
  function render() {
    renderer.render(scene, camera);
    if (!marble) {halo.hidden = true; return;}
    marble.getWorldPosition(projected);
    cameraPosition.copy(projected).applyMatrix4(camera.matrixWorldInverse);
    projected.project(camera);
    halo.hidden = cameraPosition.z >= 0 || projected.z < -1 || projected.z > 1;
    if (halo.hidden) return;
    const {width, height} = host.getBoundingClientRect();
    const pixelsPerMetre = height / (2 * -cameraPosition.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
    const diameter = Math.max(36, marble.geometry.parameters.radius * pixelsPerMetre * 2.8);
    halo.style.width = halo.style.height = `${diameter}px`;
    halo.style.left = `${(projected.x + 1) * width / 2}px`;
    halo.style.top = `${(1 - projected.y) * height / 2}px`;
  }
  controls.addEventListener('change', render);
  const resize = new ResizeObserver(() => {
    const {width, height} = host.getBoundingClientRect();
    renderer.setSize(width, height); camera.aspect = width / height; camera.updateProjectionMatrix(); render();
    if(fitWideScene) {
      const next=Math.max(1,1.6/camera.aspect);
      camera.position.sub(controls.target).multiplyScalar(next/aspectFit).add(controls.target);
      aspectFit=next;controls.update();render();
    }
  });
  resize.observe(host);
  return {
    load(description) {
      clearOutlines(); activeComponent = null;
      host.dataset.activeComponent = '';
      componentMeshes.clear(); baseMaterials.clear();
      marble = null;
      driven=[];
      stateIndicators=[];
      mechanismMeshes.clear();
      decorations.traverse(object=>{object.geometry?.dispose();object.material?.map?.dispose();object.material?.dispose();});
      decorations.clear();
      if(description.lattice)decorations.add(latticeView(description.lattice,description.scale));
      for(const visual of description.visuals??[]) {
        const model=motorBase(visual.size);model.position.fromArray(visual.position);model.quaternion.fromArray(visual.rotation);decorations.add(model);
      }
      for(const label of description.labels??[]) {
        const canvas=document.createElement('canvas');canvas.width=512;canvas.height=96;
        const context=canvas.getContext('2d');
        context.fillStyle='#fffffff0';context.fillRect(0,0,512,96);
        context.fillStyle='#183f50';context.font='600 44px sans-serif';context.textAlign='center';context.fillText(label.text,256,64);
        const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(canvas),depthTest:false}));
        sprite.position.fromArray(label.position);sprite.scale.set(.22*(description.scale??1),.04125*(description.scale??1),1);
        decorations.add(sprite);
      }
      group.traverse(child=>{child.geometry?.dispose();child.material?.dispose();});group.clear();
      for (const body of description.bodies) {
        const sphere = body.shape.kind === 'sphere';
        let mesh;
        if(body.visual?.kind==='pocket-wheel')mesh=pocketWheel(body.visual);
        else if(body.shape.kind==='compound') {
          mesh=new THREE.Group();
          for(const piece of body.shape.children) {
            const part=new THREE.Mesh(new THREE.BoxGeometry(...piece.shape.size),new THREE.MeshStandardMaterial({color:body.color,roughness:.4}));
            part.position.fromArray(piece.position);part.quaternion.fromArray(piece.rotation);mesh.add(part);
          }
        } else {
          let geometry;
          if(body.shape.kind==='trimesh'){geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(body.shape.vertices,3));geometry.setIndex(body.shape.indices);geometry.computeVertexNormals();}
          else geometry=sphere?new THREE.SphereGeometry(body.shape.radius,32,24):new THREE.BoxGeometry(...body.shape.size);
          const material=new THREE.MeshStandardMaterial({color:body.color??(sphere?'#ffb72b':body.id.startsWith('track-2/')?'#648fcb':body.id.includes('floor')?'#147c89':'#32a5b0'),roughness:.4,metalness:sphere?.25:0});
          if(body.id.endsWith('/retainer')){material.transparent=true;material.opacity=.15;material.depthWrite=false;}
          mesh=new THREE.Mesh(geometry,material);
        }
        mesh.position.fromArray(body.position); mesh.quaternion.fromArray(body.rotation);
        mesh.userData.component = sphere ? null : body.id.split('/')[0];
        if(body.hinge)mechanismMeshes.set(body.id,mesh);
        if(body.stateVisual) {
          const indicator={mesh,base:mesh.quaternion.clone(),...body.stateVisual};
          stateIndicators.push(indicator);
          mesh.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(...indicator.axis),indicator.angles[indicator.initialState]));
        }
        if (!sphere) mesh.traverse(part=>{
          if (!part.isMesh || !part.material?.emissive) return;
          if (!baseMaterials.has(part.material)) baseMaterials.set(part.material, {
            color:part.material.color.clone(), emissive:part.material.emissive.clone(), intensity:part.material.emissiveIntensity,
          });
          const id = mesh.userData.component;
          if (!componentMeshes.has(id)) componentMeshes.set(id, []);
          componentMeshes.get(id).push(part);
        });
        if(body.drive)driven.push({mesh,drive:body.drive});
        group.add(mesh); if (sphere) marble = mesh;
      }
      const box = new THREE.Box3().setFromObject(group).union(new THREE.Box3().setFromObject(decorations)), center = box.getCenter(new THREE.Vector3());
      cells.traverse(object=>{object.geometry?.dispose();object.material?.dispose();});
      cells.clear();
      if(!box.isEmpty())cells.add(cellWireframe(box,(description.lattice?.cellSize??.06)*(description.scale??1)));
      const size = box.getSize(new THREE.Vector3()).length();
      controls.target.copy(center);
      fitWideScene=Boolean(description.cameraOffset);aspectFit=fitWideScene?Math.max(1,1.6/camera.aspect):1;
      camera.position.copy(center).add(new THREE.Vector3(...(description.cameraOffset??[-0.9,0.8,1.1])).multiplyScalar(size*aspectFit));
      controls.update(); render();
    },
    highlight(component) {
      if ((component ?? null) !== activeComponent) {setHighlight(component); render();}
    },
    update(snapshot) {
      for(const {mesh,base,axis,angles} of stateIndicators) {
        const state=snapshot.componentStates?.[mesh.userData.component];
        if(state in angles)mesh.quaternion.copy(base).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(...axis),angles[state]));
      }
      for(const {mesh,drive} of driven) {const pose=drivePose(drive,snapshot.time);mesh.position.fromArray(pose.position);mesh.quaternion.fromArray(pose.rotation);}
      for(const pose of snapshot.mechanisms??[]) {
        const mesh=mechanismMeshes.get(pose.id);
        if(mesh){mesh.position.fromArray(pose.position);mesh.quaternion.fromArray(pose.rotation);}
      }
      marble.position.fromArray(snapshot.position);
      if (snapshot.rotation) marble.quaternion.fromArray(snapshot.rotation);
      if ('component' in snapshot) setHighlight(snapshot.component);
      render();
    },
    dispose() {resize.disconnect(); controls.dispose(); clearOutlines(); outlineMaterial.dispose(); cells.traverse(object=>{object.geometry?.dispose();object.material?.dispose();});cellToggle.remove(); halo.remove(); renderer.dispose();},
  };
}
