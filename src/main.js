import * as THREE from 'three';

import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';


let container;
let camera, scene, renderer;
const splineHelperObjects = [];
let splinePointsLength = 4;
const positions = [];
const point = new THREE.Vector3();
let originalPositions = [];
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const onUpPosition = new THREE.Vector2();
const onDownPosition = new THREE.Vector2();

const points = [];
const pointMaterial = new THREE.PointsMaterial({ color: 0xfff, size: 2 });
const lineMaterial = new THREE.LineBasicMaterial({ color: 0x00ff00 }); // 线条的材质

const geometry = new THREE.BoxGeometry(3, 3, 3);
console.log(geometry)
let transformControl;
const ARC_SEGMENTS = 200;

const splines = {};

const params = {
  uniform: true,
  tension: 0.5,
  centripetal: true,
  chordal: true,
  addPoint: addPoint,
  removePoint: removePoint,
  exportSpline: exportSpline
};

init();

function init() {

  container = document.getElementById('container');

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf0f0f0);

  camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 1, 10000);
  camera.position.set(0, 250, 1000);
  scene.add(camera);

  scene.add(new THREE.AmbientLight(0xf0f0f0, 3));
  const light = new THREE.SpotLight(0xffffff, 4.5);
  light.position.set(0, 1500, 200);
  light.angle = Math.PI * 0.2;
  light.decay = 0;
  light.castShadow = true;
  light.shadow.camera.near = 200;
  light.shadow.camera.far = 2000;
  light.shadow.bias = - 0.000222;
  light.shadow.mapSize.width = 1024;
  light.shadow.mapSize.height = 1024;
  scene.add(light);

  const planeGeometry = new THREE.PlaneGeometry(2000, 2000);
  planeGeometry.rotateX(- Math.PI / 2);
  const planeMaterial = new THREE.ShadowMaterial({ color: 0x000000, opacity: 0.2 });

  const plane = new THREE.Mesh(planeGeometry, planeMaterial);
  plane.position.y = - 200;
  plane.receiveShadow = true;
  scene.add(plane);

  const helper = new THREE.GridHelper(2000, 100);
  helper.position.y = - 199;
  helper.material.opacity = 0.25;
  helper.material.transparent = true;
  scene.add(helper);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  container.appendChild(renderer.domElement);

  const gui = new GUI();

  gui.add(params, 'uniform').onChange(render);
  gui.add(params, 'tension', 0, 1).step(0.01).onChange(function (value) {

    splines.uniform.tension = value;
    updateSplineOutline();
    render();

  });
  gui.add(params, 'centripetal').onChange(render);
  gui.add(params, 'chordal').onChange(render);
  gui.add(params, 'addPoint');
  gui.add(params, 'removePoint');
  gui.add(params, 'exportSpline');
  gui.open();

  // Controls
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.damping = 0.2;
  controls.addEventListener('change', render);

  transformControl = new TransformControls(camera, renderer.domElement);
  transformControl.addEventListener('change', render);
  transformControl.addEventListener('dragging-changed', function (event) {

    controls.enabled = !event.value;

  });
  scene.add(transformControl.getHelper());

  transformControl.addEventListener('objectChange', function () {

    updateSplineOutline();

  });

  document.addEventListener('pointerdown', onPointerDown);
  document.addEventListener('pointerup', onPointerUp);
  document.addEventListener('pointermove', onPointerMove);
  window.addEventListener('resize', onWindowResize);

  /*******
   * Curves
   *********/

  for (let i = 0; i < splinePointsLength; i++) {
    const position = new THREE.Vector3();
    positions.push(position);
    addSplineObject(position);

  }

  positions.length = 0;

  for (let i = 0; i < splinePointsLength; i++) {

    positions.push(splineHelperObjects[i].position);

  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(ARC_SEGMENTS * 3), 3));

  let curve = new THREE.CatmullRomCurve3(positions);
  curve.curveType = 'catmullrom';
  curve.mesh = new THREE.Line(geometry.clone(), new THREE.LineBasicMaterial({
    color: 0xff0000,
    opacity: 0.35
  }));
  curve.mesh.castShadow = true;
  splines.uniform = curve;

  curve = new THREE.CatmullRomCurve3(positions);
  curve.curveType = 'centripetal';
  curve.mesh = new THREE.Line(geometry.clone(), new THREE.LineBasicMaterial({
    color: 0x00ff00,
    opacity: 0.35
  }));
  curve.mesh.castShadow = true;
  splines.centripetal = curve;

  curve = new THREE.CatmullRomCurve3(positions);
  curve.curveType = 'chordal';
  curve.mesh = new THREE.Line(geometry.clone(), new THREE.LineBasicMaterial({
    color: 0x0000ff,
    opacity: 0.35
  }));
  curve.mesh.castShadow = true;
  splines.chordal = curve;

  for (const k in splines) {

    const spline = splines[k];
    scene.add(spline.mesh);

  }

  load([new THREE.Vector3(289.76843686945404, 452.51481137238443, 56.10018915737797),
  new THREE.Vector3(- 53.56300074753207, 171.49711742836848, - 14.495472686253045),
  new THREE.Vector3(- 91.40118730204415, 176.4306956436485, - 6.958271935582161),
  new THREE.Vector3(- 383.785318791128, 491.1365363371675, 47.869296953772746)]);

  render();

}

//平面的实现。。？
{
  // const meshMaterial = new THREE.MeshLambertMaterial({
  //   color: 0xffffff,
  //   opacity: 0.5,
  //   side: THREE.DoubleSide,
  //   transparent: true
  // });

  // import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
  // import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';

  // let dodecahedronGeometry = new THREE.DodecahedronGeometry( 10 );

  // // if normal and uv attributes are not removed, mergeVertices() can't consolidate indentical vertices with different normal/uv data

  // dodecahedronGeometry.deleteAttribute( 'normal' );
  // dodecahedronGeometry.deleteAttribute( 'uv' );
  // dodecahedronGeometry = BufferGeometryUtils.mergeVertices( dodecahedronGeometry );

  // const vertices = [];
  // 				const positionAttribute = dodecahedronGeometry.getAttribute( 'position' );

  // 				for ( let i = 0; i < positionAttribute.count; i ++ ) {

  // 					const vertex = new THREE.Vector3();
  // 					vertex.fromBufferAttribute( positionAttribute, i );
  // 					vertices.push( vertex );

  // 				}

  // const meshGeometry = new ConvexGeometry(vertices);
  // const mesh = new THREE.Mesh(meshGeometry, meshMaterial);

  // let originalPositions = [];
  // let group;
  // group = new THREE.Group();
  // scene.add( group );
  // group.add(mesh);
}


// function addSplineObject(position, y = 200) {
//   const material = new THREE.MeshLambertMaterial({ color: 0xfff });
//   const object = new THREE.Mesh(geometry, material);

//   if (position) {
//     object.position.copy(position);
//     originalPositions.push(position.clone());
//   } else {
//     object.castShadow = true;
//     object.receiveShadow = true;
//     scene.add(object);
//     splineHelperObjects.push(object);
//     console.log('111');
//     console.log(originalPositions);
//     return object;
//   }
// }

function addSplineObject(position) {
  if (!position || !(position instanceof THREE.Vector3)) {
    console.error('Invalid position:', position);
    return;
  }

  const pointGeometry = new THREE.BufferGeometry().setFromPoints([position]);
  const point = new THREE.Points(pointGeometry, pointMaterial);
  scene.add(point);

  originalPositions.push(position.clone());
  splineHelperObjects.push(point);
  return point;
}




//之前的方块定义
// function addPoint() {
//   const gridSize = 60;
//   const spacing = 3;
//   const halfGridSize = gridSize / 2;

//   let positions = [];
//   splinePointsLength = 0;

//   let y = 200;
//   for (let i = 0; i < gridSize; i++) {
//     for (let j = 0; j < gridSize; j++) {
//       const x = (i - halfGridSize) * spacing;
//       const z = (j - halfGridSize) * spacing;
//       const position = new THREE.Vector3(x, y, z);

//       addSplineObject(position);
//       positions.push(position.clone());
//     }
//   }
//   updateSplineOutline();
//   render();
// }


function addPoint() {
  const gridSize = 10;
  const spacing = 10;

  for (let i = -gridSize; i <= gridSize; i++) {
    for (let j = -gridSize; j <= gridSize; j++) {
      const x = i * spacing;
      const z = j * spacing;
      let y = 200;

      const position = new THREE.Vector3(x, y, z);
      positions.push(position);
      scene.add(new THREE.Points(new THREE.BufferGeometry().setFromPoints([position]), pointMaterial));
    }
  }
  
  createLines();  
  updateSplineOutline();  
  render();
}



const lineMesh = new THREE.LineSegments(geometry, lineMaterial);
lineMesh.name = 'lines';
scene.add(lineMesh);


function createLines() {
  const geometry = new THREE.BufferGeometry();
  let vertices = [];

  for (let i = 0; i < positions.length; i++) {
    vertices.push(positions[i].x, positions[i].y, positions[i].z);
    if (i < positions.length - 1) {
      vertices.push(positions[i + 1].x, positions[i + 1].y, positions[i + 1].z);
    } else {
      vertices.push(positions[0].x, positions[0].y, positions[0].z);
    }
  }

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  const lineMesh = new THREE.LineSegments(geometry, lineMaterial);
  lineMesh.name = 'lines';
  scene.add(lineMesh);
  

}

function createRippleEffect() {
  const centerX = 0;
  const centerZ = 0;
  const maxDrop = 3;
  const speed = 1;

  for (let i = 0; i < positions.length; i++) {
    const object = positions[i]; 
    const distance = Math.sqrt(
      Math.pow(object.x - centerX, 2) +
      Math.pow(object.z - centerZ, 2)
    );

    const dropAmount = Math.max(0, maxDrop * (1 - distance / 150));
    object.y -= speed * dropAmount; 
  }

  updateLines(); 
  render();
}


function updateLines() {
  const lineMesh = scene.getObjectByName('lines');
  const vertices = lineMesh.geometry.attributes.position.array;

  for (let i = 0; i < positions.length; i++) {
    vertices[i * 3 + 1] = positions[i].y;
  }

  lineMesh.geometry.attributes.position.needsUpdate = true;
}

// function createRippleEffect() {
//   const centerX = 0;
//   const centerZ = 0;
//   const maxDrop = 3;
//   const speed = 1;

//   for (let i = 0; i < splineHelperObjects.length; i++) {
//     const object = splineHelperObjects[i];
//     const distance = Math.sqrt(
//       Math.pow(object.position.x - centerX, 4) +
//       Math.pow(object.position.z - centerZ, 4)
//     );

//     const dropAmount = Math.max(0, maxDrop * (1 - distance / 11000));
//     object.position.y -= speed * dropAmount;
//   }
//   render();
// }


setInterval(createRippleEffect, 1000);




function removePoint() {

  if (splinePointsLength <= 4) {

    return;

  }

  const point = splineHelperObjects.pop();
  splinePointsLength--;
  positions.pop();

  if (transformControl.object === point) transformControl.detach();
  scene.remove(point);

  updateSplineOutline();

  render();

}

function updateSplineOutline() {

  for (const k in splines) {

    const spline = splines[k];

    const splineMesh = spline.mesh;
    const position = splineMesh.geometry.attributes.position;

    for (let i = 0; i < ARC_SEGMENTS; i++) {

      const t = i / (ARC_SEGMENTS - 1);
      spline.getPoint(t, point);
      position.setXYZ(i, point.x, point.y, point.z);

    }

    position.needsUpdate = true;

  }

}

function exportSpline() {

  const strplace = [];

  for (let i = 0; i < splinePointsLength; i++) {

    const p = splineHelperObjects[i].position;
    strplace.push(`new THREE.Vector3(${p.x}, ${p.y}, ${p.z})`);

  }

  console.log(strplace.join(',\n'));
  const code = '[' + (strplace.join(',\n\t')) + ']';
  prompt('copy and paste code', code);

}

function load(new_positions) {

  while (new_positions.length > positions.length) {

    addPoint();

  }

  while (new_positions.length < positions.length) {

    removePoint();

  }

  for (let i = 0; i < positions.length; i++) {

    positions[i].copy(new_positions[i]);

  }

  updateSplineOutline();

}

function render() {

  splines.uniform.mesh.visible = params.uniform;
  splines.centripetal.mesh.visible = params.centripetal;
  splines.chordal.mesh.visible = params.chordal;
  renderer.render(scene, camera);

}

function onPointerDown(event) {

  onDownPosition.x = event.clientX;
  onDownPosition.y = event.clientY;

}

function onPointerUp(event) {

  onUpPosition.x = event.clientX;
  onUpPosition.y = event.clientY;

  if (onDownPosition.distanceTo(onUpPosition) === 0) {

    transformControl.detach();
    render();

  }

}

function onPointerMove(event) {

  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = - (event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(pointer, camera);

  const intersects = raycaster.intersectObjects(splineHelperObjects, false);

  if (intersects.length > 0) {

    const object = intersects[0].object;

    if (object !== transformControl.object) {

      transformControl.attach(object);

    }

  }

}

function onWindowResize() {

  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);

  render();

}