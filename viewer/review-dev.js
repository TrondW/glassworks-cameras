// Deterministic product-studio render harness used by scripts/camera-audit.mjs:
//   /viewer/review.html?camera=503cx|m6|intrepid|ae1|rolleiflex|k1000|f3|om1[&lens=<id>]
// Exposes window.__dev.{ shot, ortho, set, cam, scene, THREE, renderer, STATE, bb }.
import * as THREE from 'three';
import { CAMERAS, createCamera, cameraKind } from '../src/cameras.js';
import { flushCameraTextures } from '../src/lib/textures.js';

const q = new URLSearchParams(location.search);
const kind = cameraKind(q.get('camera'));
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, logarithmicDepthBuffer: true });
renderer.setPixelRatio(1);
renderer.toneMapping = THREE.AgXToneMapping;
renderer.toneMappingExposure = 1.25;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.localClippingEnabled = true;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8d9096);

// Studio environment: soft overhead bank, right-front key strip, opposite fill strip, rear kicker, pale floor
const env = new THREE.Scene();
env.add(new THREE.Mesh(new THREE.SphereGeometry(60, 48, 24), new THREE.ShaderMaterial({
  side: THREE.BackSide,
  vertexShader: 'varying vec3 p; void main() { p = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: 'varying vec3 p; void main() { float y = p.y; vec3 c = mix(vec3(0.16), vec3(0.34), smoothstep(-0.2, 0.9, y)); c = mix(vec3(0.42, 0.41, 0.40), c, smoothstep(-0.25, -0.05, y)); gl_FragColor = vec4(c, 1.0); }',
})));
const box = (x, y, z, w, h, k) => {
  const b = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(k, k, k), side: THREE.DoubleSide }));
  b.position.set(x, y, z);
  b.lookAt(0, 0, 0);
  env.add(b);
};
box(4, 34, -14, 34, 26, 5.5);
box(-38, 12, -18, 10, 34, 3.2);
box(36, 8, 6, 10, 30, 1.6);
box(0, 14, 40, 22, 8, 1.2);
const pm = new THREE.PMREMGenerator(renderer);
scene.environment = pm.fromScene(env, 0.012).texture;

const key = new THREE.DirectionalLight(0xfff6ea, 1.7);
key.castShadow = true;
key.shadow.mapSize.set(4096, 4096);
Object.assign(key.shadow.camera, { left: -420, right: 420, top: 420, bottom: -420, near: 10, far: 4000 });
key.shadow.bias = -0.0003;
key.shadow.normalBias = 0.25;
key.shadow.radius = 5;
scene.add(key, key.target);

const desc = CAMERAS[kind];
const lensId = q.get('lens') || desc.defaultLens;
const cam = await createCamera(kind, { lens: desc.lenses.find((l) => l.id === lensId) || desc.lenses[0] });
const { mm } = cam.parts;
mm.parent.remove(mm);
mm.position.set(0, 0, 0);
mm.rotation.set(0, 0, 0);
mm.scale.setScalar(1);
scene.add(mm);

const dress = () => mm.traverse((o) => { if (o.isMesh) { o.castShadow = !o.material.transparent; o.receiveShadow = true; } });
const STATE = {
  '503cx': { lens: cam.parts.lens?.lens, focus: 5, apertureIdx: 3, shutterIdx: 7, film: { type: 'c41', iso: 400, name: 'Portra 400' }, frame: 3 },
  m6: { focus: 10000, aperture: 2, shutterIdx: 7, frame: 1, film: { iso: 400 } },
  intrepid: { focus: 10000, aperture: 5.6, shutterIdx: 7, frame: 1, film: { iso: 100 } },
  ae1: { focus: 10000, aperture: 1.4, shutterIdx: 8, frame: 1, film: { iso: 400 } },
  rolleiflex: { focus: 10000, aperture: 2.8, shutterIdx: 7, frame: 1, film: { iso: 400 } },
  k1000: { focus: 10000, aperture: 2.0, shutterIdx: 7, frame: 1, film: { iso: 400 } },
  f3: { focus: 10000, aperture: 1.4, shutterIdx: 11, frame: 1, film: { iso: 400 } },
  om1: { focus: 10000, aperture: 1.8, shutterIdx: 7, frame: 1, film: { iso: 400 } },
}[kind] || { focus: 10000, aperture: desc.lenses[0]?.maxAperture ?? 2.8, shutterIdx: 7, frame: 1, film: { iso: 400 } };

if (cam.st) cam.st.snapRings = true;
cam.setState(STATE);
cam.update(0.016);
flushCameraTextures();
dress();

mm.updateMatrixWorld(true);
const bb = new THREE.Box3().setFromObject(mm);
const floor = new THREE.Mesh(new THREE.CircleGeometry(4000, 64), new THREE.MeshStandardMaterial({ color: 0x8d9096, roughness: 0.92, metalness: 0 }));
floor.rotation.x = -Math.PI / 2;
floor.position.y = bb.min.y - 0.2;
floor.receiveShadow = true;
scene.add(floor);

window.__dev = {
  ready: true, kind, scene, cam, THREE, renderer, floor, key, STATE, bb: [bb.min.toArray(), bb.max.toArray()], dress,
  set(state) { cam.setState({ ...STATE, ...state }); },
  ortho({ dir = 'front', W = 1280, H = 774, ox = 640, oy = 387, s = 7.8, zAt = 0, lens = false, D = 0, plane = 0, bg = 0xffffff, exposure = 1.35 } = {}) {
    const lm = cam.parts.lensMount;
    const prevVis = lm ? lm.visible : true;
    if (lm) lm.visible = lens;
    floor.visible = false;
    cam.update(0.016);
    mm.updateMatrixWorld(true);
    dress();
    renderer.setSize(W, H, false);
    renderer.toneMappingExposure = exposure;
    scene.background.set(bg);
    const R = dir === 'front' || dir === 'bottom' ? new THREE.Vector3(-1, 0, 0) : dir === 'left' ? new THREE.Vector3(0, 0, 1) : dir === 'right' ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(1, 0, 0);
    const U = dir === 'top' || dir === 'bottom' ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(0, 1, 0);
    const N = dir === 'front' ? new THREE.Vector3(0, 0, -1) : dir === 'back' ? new THREE.Vector3(0, 0, 1) : dir === 'left' ? new THREE.Vector3(-1, 0, 0) : dir === 'right' ? new THREE.Vector3(1, 0, 0) : dir === 'bottom' ? new THREE.Vector3(0, -1, 0) : new THREE.Vector3(0, 1, 0);
    const P0 = dir === 'top' || dir === 'bottom' ? new THREE.Vector3(0, plane, zAt) : (dir === 'left' || dir === 'right') ? new THREE.Vector3(plane, 0, zAt) : new THREE.Vector3(0, 0, plane);
    let c;
    if (D > 0) {
      const C = P0.clone().addScaledVector(R, (W / 2 - ox) / s).addScaledVector(U, (oy - H / 2) / s);
      c = new THREE.PerspectiveCamera(2 * Math.atan((H / s / 2) / D) * 180 / Math.PI, W / H, 1, 20000);
      c.position.copy(C).addScaledVector(N, D); c.up.copy(U); c.lookAt(C);
    } else {
      c = new THREE.OrthographicCamera(-ox / s, (W - ox) / s, oy / s, -(H - oy) / s, 1, 5000);
      c.position.copy(P0).addScaledVector(N, 2000); c.up.copy(U); c.lookAt(P0);
    }
    c.layers.enableAll();
    key.position.copy(c.position).add(new THREE.Vector3(350, 600, 200));
    key.target.position.copy(P0); key.target.updateMatrixWorld();
    renderer.render(scene, c);
    const url = canvas.toDataURL('image/png');
    if (lm) lm.visible = prevVis;
    return url;
  },
  shot({ az = 35, el = 12, dist = 600, target = null, W = 1600, H = 1200, fov = 20, bg = 0x8d9096, exposure = 1.25, floorOn = true, keyAz = 38, keyEl = 52, dt = 0.016, view = null } = {}) {
    cam.update(dt, view);
    mm.updateMatrixWorld(true);
    dress();
    renderer.setSize(W, H, false);
    renderer.toneMappingExposure = exposure;
    scene.background.set(bg); floor.material.color.set(bg); floor.visible = floorOn;
    const t = target || bb.getCenter(new THREE.Vector3()).toArray();
    const c = new THREE.PerspectiveCamera(fov, W / H, 5, 20000);
    const a = az * Math.PI / 180, e = el * Math.PI / 180;
    c.position.set(t[0] - Math.sin(a) * Math.cos(e) * dist, t[1] + Math.sin(e) * dist, t[2] - Math.cos(a) * Math.cos(e) * dist);
    c.lookAt(...t); c.layers.enableAll();
    const ka = (az + keyAz) * Math.PI / 180, ke = keyEl * Math.PI / 180;
    key.position.set(t[0] - Math.sin(ka) * Math.cos(ke) * 1500, t[1] + Math.sin(ke) * 1500, t[2] - Math.cos(ka) * Math.cos(ke) * 1500);
    key.target.position.set(...t); key.target.updateMatrixWorld();
    renderer.render(scene, c);
    return canvas.toDataURL('image/png');
  },
};
