// Lean interactive studio viewer for glassworks-cameras.
// Drag to orbit, scroll to zoom, switch any of the 8 cameras / 53 lenses, and inspect
// cutaways, exploded views, open backs, loaded film paths, and shutter release cycles.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CAMERAS, createCamera, cameraKind } from '../src/cameras.js';
import { flushCameraTextures } from '../src/lib/textures.js';

const canvas = document.getElementById('stage');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, logarithmicDepthBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.toneMapping = THREE.AgXToneMapping;
renderer.toneMappingExposure = 1.25;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.localClippingEnabled = true;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8d9096);

// Studio softbox lighting environment
const env = new THREE.Scene();
env.add(new THREE.Mesh(new THREE.SphereGeometry(60, 48, 24), new THREE.ShaderMaterial({
  side: THREE.BackSide,
  vertexShader: 'varying vec3 p; void main() { p = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: 'varying vec3 p; void main() { float y = p.y; vec3 c = mix(vec3(0.16), vec3(0.34), smoothstep(-0.2, 0.9, y)); c = mix(vec3(0.42, 0.41, 0.40), c, smoothstep(-0.25, -0.05, y)); gl_FragColor = vec4(c, 1.0); }',
})));
const addBox = (x, y, z, w, h, k) => {
  const b = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(k, k, k), side: THREE.DoubleSide }));
  b.position.set(x, y, z);
  b.lookAt(0, 0, 0);
  env.add(b);
};
addBox(4, 34, -14, 34, 26, 5.5);
addBox(-38, 12, -18, 10, 34, 3.2);
addBox(36, 8, 6, 10, 30, 1.6);
addBox(0, 14, 40, 22, 8, 1.2);
const pm = new THREE.PMREMGenerator(renderer);
scene.environment = pm.fromScene(env, 0.012).texture;

const key = new THREE.DirectionalLight(0xfff6ea, 1.7);
key.position.set(-480, 920, -680);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -320, right: 320, top: 320, bottom: -320, near: 10, far: 3000 });
key.shadow.bias = -0.0003;
key.shadow.normalBias = 0.25;
key.shadow.radius = 4;
scene.add(key, key.target);

const floor = new THREE.Mesh(
  new THREE.CircleGeometry(3000, 64),
  new THREE.MeshStandardMaterial({ color: 0x8d9096, roughness: 0.92, metalness: 0 })
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

const viewCam = new THREE.PerspectiveCamera(24, window.innerWidth / window.innerHeight, 2, 15000);
viewCam.layers.enableAll();
const controls = new OrbitControls(viewCam, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;

const ui = {
  camSel: document.getElementById('camSel'),
  lensSel: document.getElementById('lensSel'),
  btnFinder: document.getElementById('btnFinder'),
  btnHood: document.getElementById('btnHood'),
  btnDoor: document.getElementById('btnDoor'),
  btnFilm: document.getElementById('btnFilm'),
  btnCutaway: document.getElementById('btnCutaway'),
  btnExplode: document.getElementById('btnExplode'),
  btnFire: document.getElementById('btnFire'),
  meta: document.getElementById('meta'),
};

for (const [k, d] of Object.entries(CAMERAS)) {
  const opt = document.createElement('option');
  opt.value = k;
  opt.textContent = `${d.name} (${d.format.name} · ${d.lenses.length} lenses)`;
  ui.camSel.appendChild(opt);
}

let activeCam = null;
let activeKind = null;
const flags = { finder: false, hood: false, door: false, film: false, cutaway: false, explode: false };

function syncButtons() {
  const st = activeCam?.st || {};
  const setBtn = (btn, supported, active) => {
    btn.disabled = !supported;
    btn.classList.toggle('active', Boolean(supported && active));
  };
  setBtn(ui.btnFinder, 'finderK' in st || typeof activeCam?.setFinderOpen === 'function', flags.finder);
  setBtn(ui.btnHood, Boolean(activeCam?.hasHood), flags.hood);
  setBtn(ui.btnDoor, 'doorK' in st, flags.door);
  setBtn(ui.btnFilm, typeof activeCam?.setFilmLoaded === 'function', flags.film);
  setBtn(ui.btnCutaway, typeof activeCam?.setCutaway === 'function', flags.cutaway);
  setBtn(ui.btnExplode, 'explodeK' in st || typeof activeCam?.setExploded === 'function', flags.explode);
}

function dress(root) {
  root.traverse((o) => {
    if (o.isMesh) { o.castShadow = !o.material?.transparent; o.receiveShadow = true; }
  });
}

async function mountCamera(kind, lensId = null) {
  if (activeCam?.parts?.mm) scene.remove(activeCam.parts.mm);
  Object.keys(flags).forEach((k) => { flags[k] = false; });

  activeKind = cameraKind(kind);
  const desc = CAMERAS[activeKind];
  const lens = desc.lenses.find((l) => l.id === (lensId || desc.defaultLens)) || desc.lenses[0];

  ui.camSel.value = activeKind;
  ui.lensSel.innerHTML = '';
  for (const l of desc.lenses) {
    const opt = document.createElement('option');
    opt.value = l.id;
    opt.textContent = l.name;
    ui.lensSel.appendChild(opt);
  }
  ui.lensSel.value = lens.id;

  activeCam = await createCamera(activeKind, { lens });
  const { mm } = activeCam.parts;
  mm.parent?.remove(mm);
  mm.position.set(0, 0, 0);
  mm.rotation.set(0, 0, 0);
  mm.scale.setScalar(1);
  scene.add(mm);

  if (activeCam.st) activeCam.st.snapRings = true;
  activeCam.setState({ lens, focus: 5, aperture: lens.maxAperture, shutterIdx: 7, film: { type: 'c41', iso: 400, name: 'Portra 400' }, frame: 1 });
  activeCam.update(0.016);
  flushCameraTextures();
  dress(mm);

  mm.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(mm);
  const center = bb.getCenter(new THREE.Vector3());
  const size = bb.getSize(new THREE.Vector3());
  const span = Math.max(size.x, size.y, size.z);
  floor.position.y = bb.min.y - 0.2;

  controls.target.copy(center);
  viewCam.position.set(center.x - span * 1.65, center.y + span * 0.72, center.z - span * 2.35);
  controls.update();

  ui.meta.innerHTML = `<strong>${desc.name}</strong> · ${desc.format.name} (${desc.format.film}) · ${desc.shutter.name}<br>Envelope: ${size.x.toFixed(1)} × ${size.y.toFixed(1)} × ${size.z.toFixed(1)} mm`;
  syncButtons();

  const u = new URL(location.href);
  u.searchParams.set('camera', activeKind);
  u.searchParams.set('lens', lens.id);
  history.replaceState(null, '', u);
}

ui.camSel.addEventListener('change', () => mountCamera(ui.camSel.value));
ui.lensSel.addEventListener('change', async () => {
  if (!activeCam) return;
  const desc = CAMERAS[activeKind];
  const lens = desc.lenses.find((l) => l.id === ui.lensSel.value);
  if (!lens) return;
  await activeCam.swapLens(lens, () => {});
  if (activeCam.setHood) activeCam.setHood(flags.hood);
  activeCam.setState({ lens, focus: 5, aperture: lens.maxAperture, shutterIdx: 7, frame: 1, film: { iso: 400 } });
  activeCam.update(0.016);
  flushCameraTextures();
  dress(activeCam.parts.mm);
  syncButtons();
});

ui.btnFinder.addEventListener('click', () => {
  flags.finder = !flags.finder;
  if (typeof activeCam?.setFinderOpen === 'function') activeCam.setFinderOpen(flags.finder);
  else if (activeCam?.st && 'finderK' in activeCam.st) activeCam.st.finderK = flags.finder ? 1 : 0;
  syncButtons();
});
ui.btnHood.addEventListener('click', () => {
  flags.hood = !flags.hood;
  activeCam?.setHood?.(flags.hood);
  syncButtons();
});
ui.btnDoor.addEventListener('click', () => {
  flags.door = !flags.door;
  if (activeCam?.st && 'doorK' in activeCam.st) activeCam.st.doorK = flags.door ? 1 : 0;
  syncButtons();
});
ui.btnFilm.addEventListener('click', () => {
  flags.film = !flags.film;
  activeCam?.setFilmLoaded?.(flags.film);
  syncButtons();
});
ui.btnCutaway.addEventListener('click', () => {
  flags.cutaway = !flags.cutaway;
  activeCam?.setCutaway?.(flags.cutaway);
  dress(activeCam.parts.mm);
  syncButtons();
});
ui.btnExplode.addEventListener('click', () => {
  flags.explode = !flags.explode;
  if (typeof activeCam?.setExploded === 'function') activeCam.setExploded(flags.explode);
  else if (activeCam?.st && 'explodeK' in activeCam.st) activeCam.st.explodeK = flags.explode ? 1 : 0;
  syncButtons();
});
ui.btnFire.addEventListener('click', () => {
  activeCam?.fire?.({ seconds: 1 / 125 });
});

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  viewCam.aspect = w / h;
  viewCam.updateProjectionMatrix();
  renderer.setSize(w, h, false);
}
window.addEventListener('resize', resize);
resize();

const params = new URLSearchParams(location.search);
await mountCamera(params.get('camera') || '503cx', params.get('lens'));

let prev = performance.now();
(function tick(now) {
  const dt = Math.min(0.05, (now - prev) / 1000);
  prev = now;
  controls.update();
  activeCam?.update(dt, viewCam);
  renderer.render(scene, viewCam);
  requestAnimationFrame(tick);
})(prev);
