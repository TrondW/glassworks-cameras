// Shared 3D physical optical diaphragm, overlapping 5-blade leaf shutter, cutaway iris jaws,
// and clear multicoated front glass helpers for real optical light simulation across all 8 camera systems.
import * as THREE from 'three';
import { fastMerge, prep } from './mesh.js';
import { revolve } from './geometry.js';
import { TAU, lerp } from './util.js';

const _irisGeoCache = new Map();
const _shutterGeoCache = new Map();
let _jawBoxGeo = null;

/**
 * Compute light-tight geometric parameters for an n-blade (5..10) tangent-polygon iris diaphragm.
 * Caps rMax relative to rOut by blade count so blades stay 100% light-tight around the outer rim at every f-stop
 * while never protruding outside rOut.
 */
export function computeIrisSpec({ blades = 6, rOut = 24, glassR = 14, rMinScale = 0.072 } = {}) {
  const n = Math.max(5, Math.min(10, Math.round(blades)));
  // Fundamental straight-edge pivoting-blade theorem: rMin + (rOut - rMax) >= rFixed requires rMax <= ~0.505 * rOut
  // so blade backs remain 100% sealed behind fixedIris all the way down to f/22 with zero perimeter notches.
  const maxRatio = 0.505;
  const rMax = Math.min(glassR * 0.90, rOut * maxRatio);
  const rFixed = rMax + 0.15;
  const rPlateOut = rOut + 0.15;
  const rPin = Math.min(rOut - 1.8, Math.max(rMax + 3.4, (rMax + rOut) * 0.62));
  const rMin = Math.max(0.75, rMax * rMinScale);
  return { n, rPin, rOut, rPlateOut, rMin, rMax, rFixed, thick: 1.8 };
}

function getIrisLeafPair(spec) {
  const key = `${spec.n}|${spec.rPin.toFixed(2)}|${spec.rOut.toFixed(2)}|${spec.rMin.toFixed(2)}|${spec.rMax.toFixed(2)}`;
  if (_irisGeoCache.has(key)) return _irisGeoCache.get(key);
  const cols = 48;
  const minChord = Math.sqrt(Math.max(1, spec.rPin * spec.rPin - spec.rMax * spec.rMax))
    + Math.sqrt(Math.max(1, spec.rOut * spec.rOut - spec.rMax * spec.rMax));
  const xMin = -(minChord - 0.75);
  const xSpan = 1.25 - xMin;
  const xs = Array.from({ length: cols }, (_, i) => xMin + (xSpan * i) / (cols - 1));
  const y0s = xs.map(() => 0);
  const yMaxBound = Math.max(7.5, spec.rOut * 0.58);
  const y1s = xs.map(() => yMaxBound);
  for (let k = 0; k <= 28; k++) {
    const r = spec.rMin + ((spec.rMax - spec.rMin) * k) / 28;
    const b = -Math.asin(Math.min(0.96, r / spec.rPin));
    const c = Math.cos(b), s = Math.sin(b);
    for (let j = 0; j < cols; j++) {
      const x = xs[j];
      for (let y = 0; y <= yMaxBound; y += 0.12) {
        if (Math.hypot(spec.rPin + c * x - s * y, s * x + c * y) > spec.rOut) {
          y1s[j] = Math.min(y1s[j], Math.max(0, y - 0.12));
          break;
        }
      }
    }
  }
  const wB = 0.28, tipThresh = 0.36;
  const vCount = cols * 4;
  const pos = new Float32Array(vCount * 3);
  const nor = new Float32Array(vCount * 3);
  const uv = new Float32Array(vCount * 2);
  const wr = new Float32Array(vCount);
  for (let j = 0; j < cols; j++) {
    const x = xs[j], lo = y0s[j], hi = y1s[j], h = hi - lo, mid = (lo + hi) * 0.5;
    const tipW = h < tipThresh ? 1 : 0;
    const rowsY = [lo, Math.min(mid - 0.01, lo + wB), Math.max(mid + 0.01, hi - wB), hi];
    const rowsW = [1, tipW, tipW, 1];
    for (let r = 0; r < 4; r++) {
      const vi = j * 4 + r;
      pos[vi * 3] = x; pos[vi * 3 + 1] = rowsY[r]; pos[vi * 3 + 2] = 0;
      nor[vi * 3] = 0; nor[vi * 3 + 1] = 0; nor[vi * 3 + 2] = -1;
      uv[vi * 2] = (x - xMin) / Math.max(1e-3, xSpan);
      uv[vi * 2 + 1] = rowsY[r] / Math.max(1, yMaxBound);
      wr[vi] = rowsW[r];
    }
  }
  const idx = [];
  for (let j = 0; j < cols - 1; j++) {
    if (y1s[j] - y0s[j] <= 1e-3 && y1s[j + 1] - y0s[j + 1] <= 1e-3) continue;
    for (let r = 0; r < 3; r++) {
      const b0 = j * 4 + r, b1 = (j + 1) * 4 + r;
      idx.push(b0, b1 + 1, b1, b0, b0 + 1, b1 + 1);
    }
  }
  const leaf = new THREE.BufferGeometry();
  leaf.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  leaf.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  leaf.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  leaf.setAttribute('wear', new THREE.BufferAttribute(wr, 1));
  leaf.setIndex(idx);
  leaf.applyMatrix4(new THREE.Matrix4().makeRotationX(0.048));
  prep(leaf);
  const pinR = Math.min(0.6, Math.max(0.35, spec.rOut * 0.022));
  const pin = prep(new THREE.CylinderGeometry(pinR, pinR, 0.6, 10).rotateX(Math.PI / 2));
  pin.attributes.wear.array.fill(0.35);
  const bladeGeo = fastMerge([leaf, pin]);
  bladeGeo.computeBoundingSphere();
  const fixedGeo = prep(new THREE.RingGeometry(spec.rFixed, spec.rPlateOut, 64, 1));
  fixedGeo.rotateY(Math.PI);
  const pair = { bladeGeo, fixedGeo };
  _irisGeoCache.set(key, pair);
  return pair;
}

function getJawBoxGeo() {
  if (!_jawBoxGeo) _jawBoxGeo = prep(new THREE.BoxGeometry(1, 1, 1));
  return _jawBoxGeo;
}

/**
 * Create a physical 3D n-blade spring-steel iris diaphragm with stationary baffle ring
 * and live cutaway cross-section jaws (matching the Hasselblad 503CX section style).
 */
export function createIrisDiaphragm(lib, spec, {
  matName = 'irisBlade',
  color = 0x5c636d,
  metalness = 0.48,
  roughness = 0.38,
  envMapIntensity = 1.45,
  intMat = null,
  clip = true,
  withJaws = true,
} = {}) {
  const matKey = `${matName}|${clip ? 1 : 0}`;
  let bladeMat = lib.cache.get(matKey);
  if (!bladeMat) {
    bladeMat = lib.prepare(new THREE.MeshStandardMaterial({
      name: matName, color, metalness, roughness, envMapIntensity, side: THREE.DoubleSide,
    }), { clip, wear: 'irisBlade' });
    lib.cache.set(matKey, bladeMat);
  }
  let jawMat = lib.cache.get('irisJaw|0');
  if (!jawMat) {
    jawMat = lib.prepare(new THREE.MeshStandardMaterial({
      name: 'irisJaw', color: 0xc6c9cc, metalness: 0.25, roughness: 0.54,
    }), { clip: false });
    lib.cache.set('irisJaw|0', jawMat);
  }

  const { bladeGeo, fixedGeo } = getIrisLeafPair(spec);
  const group = new THREE.Group();
  const ringMat = intMat || lib.get('flock');
  const fixedIris = new THREE.Mesh(fixedGeo, ringMat);
  fixedIris.position.z = -0.62;
  fixedIris.userData.noReceive = true;
  fixedIris.userData.noShadow = true;
  group.add(fixedIris);

  const irisInst = new THREE.InstancedMesh(bladeGeo, bladeMat, spec.n);
  irisInst.boundingBox = new THREE.Box3(
    new THREE.Vector3(-spec.rOut, -spec.rOut, -1.6),
    new THREE.Vector3(spec.rOut, spec.rOut, 1.6),
  );
  irisInst.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), spec.rOut + 1.6);
  irisInst.userData.noReceive = true;
  irisInst.userData.noShadow = true;
  group.add(irisInst);

  let jawInst = null;
  if (withJaws) {
    jawInst = new THREE.InstancedMesh(getJawBoxGeo(), jawMat, 2);
    jawInst.boundingBox = new THREE.Box3(
      new THREE.Vector3(-0.5, -spec.rOut, -1.5),
      new THREE.Vector3(0.5, spec.rOut, 1.5),
    );
    jawInst.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), spec.rOut + 1.5);
    jawInst.visible = false;
    jawInst.userData.noReceive = true;
    jawInst.userData.noShadow = true;
    group.add(jawInst);
  }

  const _obj = new THREE.Object3D();
  let lastR = -1, lastCut = false, curR = spec.rMax;
  const dzStep = Math.min(0.16, 1.1 / spec.n);

  const sync = (rIris, isCut = false) => {
    const r = THREE.MathUtils.clamp(rIris, spec.rMin, spec.rMax);
    curR = r;
    const rChanged = Math.abs(r - lastR) > 1e-4;
    if (rChanged) {
      lastR = r;
      const turn = Math.asin(Math.min(0.96, r / spec.rPin));
      for (let i = 0; i < spec.n; i++) {
        const a = (i / spec.n) * TAU;
        _obj.position.set(spec.rPin * Math.cos(a), spec.rPin * Math.sin(a), (i - (spec.n - 1) / 2) * dzStep);
        _obj.rotation.set(0, 0, a - turn);
        _obj.scale.set(1, 1, 1);
        _obj.updateMatrix();
        irisInst.setMatrixAt(i, _obj.matrix);
      }
      irisInst.instanceMatrix.needsUpdate = true;
    }
    if (jawInst) {
      jawInst.visible = Boolean(isCut);
      if (isCut && (rChanged || !lastCut)) {
        const turn = Math.asin(Math.min(0.96, r / spec.rPin));
        for (let k = 0; k < 2; k++) {
          const side = k === 0 ? 1 : -1;
          let s = spec.rOut;
          for (let i = 0; i < spec.n; i++) {
            const ny = Math.sin((i / spec.n) * TAU - turn + Math.PI / 2) * side;
            if (ny > 1e-3) s = Math.min(s, r / ny);
          }
          const h = Math.max(0.01, spec.rOut - s);
          _obj.position.set(0, side * (s + h * 0.5), 0);
          _obj.rotation.set(0, 0, 0);
          _obj.scale.set(0.38, h, spec.thick);
          _obj.updateMatrix();
          jawInst.setMatrixAt(k, _obj.matrix);
        }
        jawInst.instanceMatrix.needsUpdate = true;
      }
    }
    lastCut = Boolean(isCut);
  };

  sync(spec.rMax, false);
  return { group, fixedIris, irisInst, jawInst, spec, sync, currentRadius: () => curR };
}

// Normalized 5-blade overlapping curved leaf shutter geometry (exact Hasselblad/Compur/Copal sweep ratios)
const LEAF_BASE_OUT = 29.0;
const LEAF_BASE_PIN = 22.0;
const LEAF_SWING = -1.35;

function getNormalizedLeafBladeGeo() {
  if (_shutterGeoCache.has('leaf5')) return _shutterGeoCache.get('leaf5');
  const cols = 48;
  const xs = [], y0s = [], y1s = [];
  for (let i = 0; i < cols; i++) {
    const x = -3.5 + (36.0 * i) / (cols - 1);
    let lo = Infinity, hi = -Infinity;
    for (let y = -28; y <= 28; y += 0.1) {
      const dx = -x, dy = -y;
      const ox = LEAF_BASE_PIN + dx * Math.cos(LEAF_SWING) - dy * Math.sin(LEAF_SWING);
      const oy = dx * Math.sin(LEAF_SWING) + dy * Math.cos(LEAF_SWING);
      if (Math.hypot(ox, oy) < 16.15) continue;
      let ok = true;
      for (let t = 0; t <= 1.001; t += 0.125) {
        const a = LEAF_SWING * t;
        const tx = LEAF_BASE_PIN + dx * Math.cos(a) - dy * Math.sin(a);
        const ty = dx * Math.sin(a) + dy * Math.cos(a);
        if (Math.hypot(tx, ty) > LEAF_BASE_OUT) { ok = false; break; }
      }
      if (ok) {
        if (y < lo) lo = y;
        if (y > hi) hi = y;
      }
    }
    if (hi > lo + 0.05) { xs.push(x); y0s.push(lo); y1s.push(hi); }
  }
  const nCols = xs.length;
  const wB = 0.32, tipThresh = 0.4;
  const vCount = nCols * 4;
  const pos = new Float32Array(vCount * 3);
  const nor = new Float32Array(vCount * 3);
  const uv = new Float32Array(vCount * 2);
  const wr = new Float32Array(vCount);
  const xMin = xs[0], xSpan = Math.max(1e-3, xs[nCols - 1] - xMin);
  for (let j = 0; j < nCols; j++) {
    const x = xs[j], lo = y0s[j], hi = y1s[j], h = hi - lo, mid = (lo + hi) * 0.5;
    const tipW = h < tipThresh ? 1 : 0;
    const rowsY = [lo, Math.min(mid - 0.01, lo + wB), Math.max(mid + 0.01, hi - wB), hi];
    const rowsW = [1, tipW, tipW, 1];
    for (let r = 0; r < 4; r++) {
      const vi = j * 4 + r;
      pos[vi * 3] = x; pos[vi * 3 + 1] = rowsY[r]; pos[vi * 3 + 2] = 0;
      nor[vi * 3] = 0; nor[vi * 3 + 1] = 0; nor[vi * 3 + 2] = 1;
      uv[vi * 2] = (x - xMin) / xSpan; uv[vi * 2 + 1] = rowsY[r] / 28;
      wr[vi] = rowsW[r];
    }
  }
  const idx = [];
  for (let j = 0; j < nCols - 1; j++) {
    if (y1s[j] - y0s[j] <= 1e-3 && y1s[j + 1] - y0s[j + 1] <= 1e-3) continue;
    for (let r = 0; r < 3; r++) {
      const b0 = j * 4 + r, b1 = (j + 1) * 4 + r;
      idx.push(b0, b1, b1 + 1, b0, b1 + 1, b0 + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('wear', new THREE.BufferAttribute(wr, 1));
  g.setIndex(idx);
  g.applyMatrix4(new THREE.Matrix4().makeRotationX(-0.008));
  prep(g);
  g.computeBoundingSphere();
  _shutterGeoCache.set('leaf5', g);
  return g;
}

/**
 * Create a light-tight 3D 5-blade overlapping blued-steel leaf shutter (Synchro-Compur / Copal / Prontor).
 * leafK = 0 is 100% light-tight closed (5-blade star seam); leafK = 1 is fully retracted outside rClear.
 */
export function createLeafShutter(lib, {
  rOut = 23.0,
  matName = 'leafShutterBlade',
  color = 0x262a30,
  metalness = 0.44,
  roughness = 0.40,
  envMapIntensity = 1.45,
  clip = true,
} = {}) {
  const matKey = `${matName}|${clip ? 1 : 0}`;
  let bladeMat = lib.cache.get(matKey);
  if (!bladeMat) {
    bladeMat = lib.prepare(new THREE.MeshStandardMaterial({
      name: matName, color, metalness, roughness, envMapIntensity, side: THREE.DoubleSide,
    }), { clip, wear: 'irisBlade' });
    lib.cache.set(matKey, bladeMat);
  }

  const scale = rOut / LEAF_BASE_OUT;
  const rPin = LEAF_BASE_PIN * scale;
  const rClear = 15.8 * scale;
  const geo = getNormalizedLeafBladeGeo();
  const inst = new THREE.InstancedMesh(geo, bladeMat, 5);
  inst.boundingBox = new THREE.Box3(
    new THREE.Vector3(-rOut, -rOut, -1.2),
    new THREE.Vector3(rOut, rOut, 1.2),
  );
  inst.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), rOut + 1.2);
  inst.userData.noReceive = true;
  inst.userData.noShadow = true;

  const base = Array.from({ length: 5 }, (_, i) => {
    const a = (i / 5) * TAU;
    return { x: Math.cos(a) * rPin, y: Math.sin(a) * rPin, z: (i - 2) * 0.10, rot: a + Math.PI };
  });

  const _obj = new THREE.Object3D();
  let lastK = -1;
  const sync = (leafK) => {
    const k = THREE.MathUtils.clamp(leafK, 0, 1);
    if (Math.abs(k - lastK) < 1e-4) return;
    lastK = k;
    const swing = LEAF_SWING * k;
    for (let i = 0; i < 5; i++) {
      const b = base[i];
      _obj.position.set(b.x, b.y, b.z);
      _obj.rotation.set(0, 0, b.rot + swing);
      _obj.scale.set(scale, scale, 1);
      _obj.updateMatrix();
      inst.setMatrixAt(i, _obj.matrix);
    }
    inst.instanceMatrix.needsUpdate = true;
  };

  sync(0);
  return { inst, rOut, rPin, rClear, sync, currentOpen: () => Math.max(0, lastK) };
}

/**
 * Create a clear multi-coated optical glass material (Law #2 compliant: transmission === 0!)
 * that reveals real 3D stepped baffles, animated iris diaphragms, and leaf shutters inside.
 */
export function createClearFrontGlass(lib, {
  name = 'clearFrontGlass',
  color = 0x05080b,
  opacity = 0.11,
  iridescence = 0.78,
  iridescenceIOR = 1.38,
  thicknessMin = 250,
  thicknessMax = 520,
  clip = true,
} = {}) {
  const key = `${name}|${clip ? 1 : 0}`;
  let mat = lib.cache.get(key);
  if (!mat) {
    mat = lib.prepare(new THREE.MeshPhysicalMaterial({
      name, color, metalness: 0, roughness: 0.025, ior: 1.62, specularIntensity: 0.85,
      transparent: true, opacity, iridescence, iridescenceIOR,
      iridescenceThicknessMinimum: thicknessMin, iridescenceThicknessMaximum: thicknessMax,
      depthWrite: false, side: THREE.FrontSide,
    }), { clip });
    mat.userData.single = true;
    lib.cache.set(key, mat);
  }
  return mat;
}

/**
 * Build a hollow stepped matte-black anti-reflection inner optical barrel connecting
 * the front glass cell cleanly down to the iris/shutter chamber.
 */
export function buildSteppedBaffleTube(rFront, zFront, rBack, zBack, steps = 4) {
  // Runs rear -> front (dz < 0 -> inward normal nr = -1; dr > 0 -> forward-facing step nz = -1!)
  const prof = [[rBack, zBack]];
  for (let i = 0; i < steps; i++) {
    const t0 = i / steps, t1 = (i + 1) / steps;
    const za = lerp(zBack, zFront, t0);
    const zb = lerp(zBack, zFront, t1);
    const ra = lerp(rBack, rFront + 0.15, t0);
    const rb = lerp(rBack, rFront + 0.15, t1);
    prof.push([ra, zb + 0.18], [Math.max(1.5, ra - 0.25), zb + 0.12], [rb, zb]);
  }
  return revolve(prof, { segs: 64, crease: 20 });
}
