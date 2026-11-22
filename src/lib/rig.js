// camera/lib/rig.js — The support every camera stands on: a 4-section carbon tripod and a 3-way pan/tilt head (built once, shared by every camera).
// (moved verbatim from camera503.js in Phase 0: the modelling vocabulary every camera shares)
import * as THREE from 'three';
import { decalAtlas } from './decals.js';
import { rbox, revolve, slab } from './geometry.js';
import { Kit, fastMerge, prep } from './mesh.js';
import { T, lerp } from './util.js';

// ───────── Tripod: 4-section carbon legs, centre column, 3-way pan/tilt head ─────────
// A plausible series-2 class landscape support: 28 → 17.5 mm carbon tubes with a
// visible 2×2 twill under a clear coat, knurled rubber twist locks, spring-loaded
// leg-angle selectors at the spider, treaded rubber feet, a centre column with a
// knurled lock collar and a hook, a graduated panning base.
export const TRI = { apexTop: 12, panH: 18, legTubes: [[14, -60, -432], [12.25, -468, -792], [10.5, -827, -1093], [8.75, -1126, null]] };


export function buildTripod(lib, dims = { apex: 1210, spread: 560 }) {
  const g = new THREE.Group();
  g.name = 'tripod';
  const mm = new THREE.Group(); mm.scale.setScalar(0.001); g.add(mm);
  const NC = { clip: false };
  const kit = new Kit();
  const anod = lib.get('anod', NC), steel = lib.get('steel', NC), rubber = lib.get('rubber', NC), carbon = lib.get('carbon', NC);
  const rKnurl = lib.get('rubberKnurl', NC), sKnurl = lib.get('steelKnurl', NC), bright = lib.get('chromeBright', NC), flock = lib.get('flock', NC);
  const { apex, spread } = dims;
  const up = T(0, 0, 0, -Math.PI / 2, 0, 0);          // lathe +Z → +Y
  const A = (y) => T(0, apex + y, 0).multiply(up);
  // spider casting: top plate, hub, underside webbing
  kit.add(revolve([[17, -30, 0], [22, -29, 0.3], [27, -24, 0.3], [31, -16, 0.4], [36.5, -8.5, 0.6], [39, -5.5, 0.9], [39, 5.2, 0.9], [37.6, 7.6, 1], [16, 8, 0.5], [15.2, 7.4, 0.3], [15.2, 0]], { segs: 96, crease: 32 }), anod, A(0));
  // centre column (lowered), its top plate, knurled lock collar under the hub, hook at the bottom
  kit.add(revolve([[14, -300, 0.5], [14, TRI.apexTop - 4, 0.2]], { segs: 48, rRef: 14 }), carbon, A(0));
  kit.add(revolve([[14.8, TRI.apexTop - 4.5, 0.4], [30, TRI.apexTop - 4.5, 0.4], [31.2, TRI.apexTop - 3.2, 0.9], [31.2, TRI.apexTop - 0.8, 0.9], [30.4, TRI.apexTop, 0.7], [8, TRI.apexTop]], { segs: 96, crease: 30 }), anod, A(0));
  kit.add(revolve([[19, -52, 0.4], [23.5, -51, 0.7], [24.5, -49, 0.6], [24.5, -34, 0.6], [23.5, -32, 0.7], [19, -31, 0.3]], { segs: 96, crease: 30 }), rKnurl, A(0));
  kit.add(revolve([[14.4, -58, 0.3], [18.5, -56, 0.6], [19, -52, 0.4]], { segs: 64 }), anod, A(0));
  kit.add(revolve([[14.4, -306, 0.4], [15.4, -304, 0.8], [15.4, -296, 0.6], [14, -294]], { segs: 48 }), anod, A(0));
  kit.add(new THREE.TorusGeometry(7, 1.7, 12, 32, Math.PI * 1.35), steel, T(0, apex - 314, 0, 0, Math.PI / 5, Math.PI * 0.82));
  kit.add(revolve([[2.2, -12], [2.2, 0]], { segs: 16 }), steel, T(0, apex - 306, 0).multiply(up));
  // three legs: one leg (and its pair of spider ears) is built in its own frame,
  // merged per material, then placed three times
  const legKit = new Kit(), earKit = new Kit();
  {
    const dir = new THREE.Vector3(1, 0, 0), tangent = new THREE.Vector3(0, 0, 1);
    [-1, 1].forEach((s) => {
      const c = dir.clone().multiplyScalar(46).addScaledVector(tangent, s * 11.2);
      // right-handed frame (x = tangent, y = up, z = x × y = −radial): a mirrored basis would flip the winding
      const m = new THREE.Matrix4().makeBasis(tangent, new THREE.Vector3(0, 1, 0), dir.clone().negate()).setPosition(c.x, apex - 9, c.z);
      earKit.add(rbox(4.6, 25, 22, 1.8, 2, 0.9), anod, m);
      for (let n = 0; n < 3; n++) earKit.add(rbox(4.8, 1.8, 1.8, 0.5, 1), flock, m.clone().multiply(T(0, -6 - n * 4.4, -10.6)));
    });
    const pivot = dir.clone().multiplyScalar(52).setY(apex - 12);
    const foot = dir.clone().multiplyScalar(spread).setY(0);
    const ld = foot.clone().sub(pivot), len = ld.length();
    ld.normalize();
    const yAxis = ld.clone().negate(), xAxis = tangent.clone(), zAxis = new THREE.Vector3().crossVectors(xAxis, yAxis);
    const B = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis).setPosition(pivot);
    const at = (m) => B.clone().multiply(m);
    const kit = legKit;
    // pivot bolt with knurled caps
    kit.add(revolve([[3.6, -16.4], [3.6, 16.4]], { segs: 24 }), steel, at(T(0, 0, 0, 0, Math.PI / 2, 0)));
    [-1, 1].forEach((s) => kit.add(revolve([[3.8, -0.1, 0.3], [6.8, -0.1, 0.7], [7.2, 0.4, 0.9], [7.2, 2.6, 0.9], [6.4, 3.4, 0.9], [2.5, 3.5, 0.3], [0, 3.1]], { segs: 32, crease: 30 }), sKnurl, at(T(s * 13.9, 0, 0, 0, s * Math.PI / 2, 0))));
    // leg-top casting (knuckle + socket) and the spring-loaded angle selector on its outer face
    kit.add(rbox(16.8, 30, 26, 6, 3, 0.8), anod, at(T(0, -4, 0)));
    kit.add(revolve([[17.6, -70, 0.7], [18.6, -68, 1], [18.6, -34, 0.6], [16.4, -22, 0.3], [11, -14], [8, -12]], { segs: 40, crease: 30 }), anod, at(up));
    kit.add(rbox(8, 20, 4.2, 1.8, 2, 0.9), steel, at(T(0, -30, -17.6)));
    for (let n = 0; n < 4; n++) kit.add(rbox(8.4, 0.8, 1.0, 0.3, 1), steel, at(T(0, -23 - n * 3, -19.9)));
    // carbon sections with twist locks
    const tubes = TRI.legTubes.map(([r, z0, z1]) => [r, z0, z1 ?? -(len - 36)]);
    tubes.forEach(([r, z0, z1], i) => kit.add(revolve([[r, z1], [r, z0]], { segs: 48, rRef: r, seed: 7 + i }), carbon, at(up)));
    const lock = (z, r, h) => {
      kit.add(revolve([[r - 3.4, z - h, 0.3], [r - 0.8, z - h, 0.8], [r, z - h + 1.4, 0.8], [r, z - 5, 0.4], [r - 0.7, z - 3.2, 0.7], [r - 1.4, z - 2.6, 0.5]], { segs: 48, crease: 30, rRef: r }), rKnurl, at(up));
      kit.add(revolve([[r - 1.4, z - 2.6, 0.5], [r - 1.4, z - 0.6, 0.7], [r - 2.6, z + 0.4, 0.8], [r - 4.2, z + 0.6, 0.4]], { segs: 36, crease: 30 }), anod, at(up));
      kit.add(revolve([[r - 3.2, z - h - 2.5, 0.4], [r - 3.2, z - h - 0.2, 0.6], [r - 3.4, z - h, 0.3]], { segs: 32 }), anod, at(up));
    };
    lock(tubes[0][2], 17.8, 44); lock(tubes[1][2], 15.6, 41); lock(tubes[2][2], 13.5, 37);
    // rubber foot with a treaded sole
    const f = -len;
    kit.add(revolve([[0, f], [4.6, f, 0.2], [5.0, f + 0.8], [6.2, f + 0.8], [6.6, f, 0.3], [9.4, f, 0.3], [9.8, f + 0.8], [11, f + 0.8], [11.4, f, 0.4], [12.8, f + 0.3, 0.7], [13.8, f + 2.2, 0.9], [14, f + 5, 0.5, 1], [14, f + 21, 0.4, 1], [12.4, f + 27, 0.3], [9.6, f + 28.5]], { segs: 64, crease: 34, ribs: { n: 16, depth: 0.7, groove: 0.34 } }), rubber, at(up));
    kit.add(revolve([[9.4, f + 28, 0.4], [10.2, f + 29, 0.8], [10.2, f + 34, 0.6], [8.75, f + 36]], { segs: 32 }), anod, at(up));
  }
  const legAngles = [Math.PI, Math.PI / 3, -Math.PI / 3];
  for (const k of [legKit, earKit]) {
    for (const [mat, list] of k.map) {
      const merged = fastMerge(list);
      legAngles.forEach((a) => kit.add(merged.clone(), mat, new THREE.Matrix4().makeRotationY(-a)));
      merged.dispose();
    }
    k.map.clear();
  }
  // panning base (fixed) with its degree scale and a knurled pan lock
  const D = decalAtlas();
  kit.add(revolve([[31.5, 0, 0.3], [31.5, 13.4, 0.5], [31.1, 17.4, 0.9], [29.8, 18, 0.6], [22, 18]], { segs: 128, crease: 30 }), anod, A(TRI.apexTop));
  const ring = revolve([[31.56, 8.6], [31.56, 14.2]], { segs: 160, uv: 'band' });
  { const uv = ring.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, lerp(D.pan.u0, D.pan.u1, uv.getX(i)), lerp(D.pan.v0, D.pan.v1, uv.getY(i))); }
  kit.add(ring, lib.get('inkWhite', NC), A(TRI.apexTop));
  const ka = Math.PI * 0.62;
  kit.add(revolve([[3.4, -0.2, 0.2], [3.4, 1.6, 0.4], [7.6, 2.2, 0.8], [8, 3, 0.9], [8, 10.6, 0.9], [7.2, 11.6, 1], [0, 11.8, 0.3]], { segs: 96, crease: 30 }), sKnurl, T(31 * Math.sin(ka), apex + TRI.apexTop + 7, 31 * Math.cos(ka), 0, ka, 0));
  kit.build(mm);
  return { group: g, mm, top: (apex + TRI.apexTop + TRI.panH) / 1000 };
}


/** 3-way pan/tilt head: rotor + body (yaw), tilt cradle + side-tilt stage + clamp (pitch). */
export function buildHead(lib, hov) {
  const NC = { clip: false };
  const yawMM = new THREE.Group(); yawMM.scale.setScalar(0.001);
  const pitchMM = new THREE.Group(); pitchMM.scale.setScalar(0.001);
  // everything above the side-tilt axle (y = 28) turns with it: its own group, same millimetre coordinates
  const rollMM = new THREE.Group(); rollMM.scale.setScalar(0.001);
  const rk = new Kit();
  const anod = lib.get('anod', NC), steel = lib.get('steel', NC), rubber = lib.get('rubber', NC), sKnurl = lib.get('steelKnurl', NC), rKnurl = lib.get('rubberKnurl', NC);
  const flock = lib.get('flock', NC), white = lib.get('white', NC), bright = lib.get('chromeBright', NC);
  const up = T(0, 0, 0, -Math.PI / 2, 0, 0), alongX = T(0, 0, 0, 0, Math.PI / 2, 0);
  const AX = 46;                                    // tilt axle above the rotor
  const yk = new Kit();
  yk.add(revolve([[30.4, 0, 0.5], [30.4, 5.2, 0.8], [29.2, 7, 0.7], [21, 8.2, 0.3], [19, 10]], { segs: 128, crease: 30 }), anod, up);
  yk.add(rbox(1.2, 3.6, 2.6, 0.4, 1), white, T(0, 3.2, -30.4));            // pan index
  yk.add(revolve([[21, 8, 0.3], [18.5, 16, 0.2], [17, 26, 0.2]], { segs: 96 }), anod, up);
  yk.add(rbox(40, 26, 34, 9, 3, 0.7), anod, T(0, 30, 0));
  yk.add(revolve([[0, -30.5], [15, -30.5, 0.5], [18, -29, 0.9], [18, 29, 0.9], [15, 30.5, 0.5], [0, 30.5]], { segs: 96, crease: 30 }), anod, T(0, AX, 0).multiply(alongX));
  yk.build(yawMM);

  const pk = new Kit();
  // tilt cradle cheeks around the axle
  [-1, 1].forEach((sx) => {
    pk.add(revolve([[18.6, -3.4, 0.6], [20.4, -2.4, 0.9], [20.4, 2.4, 0.9], [18.6, 3.4, 0.6], [6, 3.4]], { segs: 96, crease: 30 }), anod, T(sx * 34.2, 0, 0).multiply(alongX));
    pk.add(rbox(6.8, 30, 32, 3, 3, 0.8), anod, T(sx * 34.2, 12, 0));
  });
  // side-tilt stage: axle along the lens axis, locked level
  pk.add(rbox(74, 9, 40, 3, 3, 0.8), anod, T(0, 22, 0));
  pk.add(revolve([[0, -34], [11, -34, 0.5], [13, -32.5, 0.9], [13, 32.5, 0.9], [11, 34, 0.5], [0, 34]], { segs: 72, crease: 30 }), anod, T(0, 28, 0));
  // platform, bullseye level, QR clamp with knob and safety pin, camera plate
  rk.add(rbox(66, 7, 74, 2.6, 3, 0.9), anod, T(0, 36.5, 4));
  rk.add(rbox(58, 10, 52, 2.4, 3, 0.9), anod, T(0, 45, 0));
  [-1, 1].forEach((sx) => rk.add(rbox(5.4, 4.2, 52, 1.1, 2, 0.9), steel, T(sx * 21.6, 51.6, 0)));
  rk.add(revolve([[4.2, -0.2, 0.2], [4.2, 2.5, 0.4], [9.4, 3, 0.8], [10, 4, 0.9], [10, 13, 0.9], [9, 14, 1], [0, 14.2, 0.3]], { segs: 96, crease: 30 }), sKnurl, T(29, 45, -6).multiply(alongX));
  rk.add(revolve([[1.3, 0, 0.3], [1.3, 2.4, 0.6], [0.9, 2.9, 0.8], [0, 3]], { segs: 16 }), steel, T(0, 50, 25).multiply(up));
  rk.add(rbox(4.4, 2.2, 3.2, 0.9, 2, 0.8), steel, T(0, 49.6, 24.6));
  // bullseye level (bubble moves with the tilt)
  const lv = T(0, 40, 33);
  rk.add(revolve([[8.4, 0, 0.4], [8.4, 2.4, 0.8], [7.6, 3.2, 0.9], [6.6, 3.2, 0.3], [6.6, 1]], { segs: 64, crease: 30 }), anod, lv.clone().multiply(up));
  rk.add(new THREE.CircleGeometry(6.6, 40), lib.get('levelFloor', NC), lv.clone().multiply(T(0, 1.05, 0, -Math.PI / 2, 0, 0)));
  rk.add(new THREE.TorusGeometry(2.6, 0.12, 6, 40), flock, lv.clone().multiply(T(0, 1.1, 0, Math.PI / 2, 0, 0)));
  rk.add(revolve([[0, 3.35], [4, 3.2], [6.6, 2.7]].reverse().reverse(), { segs: 48 }), lib.get('levelDome', NC), lv.clone().multiply(up));
  // two tube vials on the tilting platform (they tilt with it): across on its rear face, fore-and-aft on its left
  const vial = revolve([[0, -8.6], [2.3, -8.2], [2.5, -6.5], [2.5, 6.5], [2.3, 8.2], [0, 8.6]], { segs: 24 }), vial2 = vial.clone();
  const VX = { y: 36.9, z: 44.3 }, VZ = { x: -36.3, y: 36.9, z: 4 };
  rk.add(rbox(22, 7, 3.4, 1.6, 2, 0.8), anod, T(0, 36.5, 42.7));
  rk.add(vial, lib.get('levelLiquid', NC), T(0, VX.y, VX.z, 0, Math.PI / 2, 0));
  [-3.6, 3.6].forEach((x) => rk.add(rbox(0.5, 5.2, 0.4, 0.1, 1), flock, T(x, VX.y, VX.z + 2.6)));
  rk.add(rbox(3.4, 7, 22, 1.6, 2, 0.8), anod, T(-34.7, 36.5, VZ.z));
  rk.add(vial2, lib.get('levelLiquid', NC), T(VZ.x, VZ.y, VZ.z));   // (Kit.add transforms in place: clone first)
  [-3.6, 3.6].forEach((z) => rk.add(rbox(0.4, 5.2, 0.5, 0.1, 1), flock, T(VZ.x - 2.6, VZ.y, VZ.z + z)));
  // camera plate: 38 mm dovetail, rubber pad, D-ring screw head below
  const dv = new THREE.Shape();
  dv.moveTo(-17, 0); dv.lineTo(17, 0); dv.lineTo(19, 2); dv.lineTo(19, 4.6); dv.lineTo(16.5, 7.2); dv.lineTo(16.5, 9); dv.lineTo(-16.5, 9); dv.lineTo(-16.5, 7.2); dv.lineTo(-19, 4.6); dv.lineTo(-19, 2); dv.lineTo(-17, 0);
  rk.add(slab(dv, 66, 0.6, 1, 0.9), anod, T(0, 47.5, -33));
  rk.add(rbox(33, 0.8, 60, 0.35, 1), rubber, T(0, 56.9, 0));
  // handles: pan/tilt handle (right rear), side-tilt handle (left)
  // each handle its own kit so it can be picked and dragged (pan/tilt: the long one; roll: the side-tilt one)
  const handle = (kit, hover, hub, axis, len, dir) => {
    const sKnurl = lib.get('steelKnurl', { ...NC, hover }), steel = lib.get('steel', { ...NC, hover }), rKnurl = lib.get('rubberKnurl', { ...NC, hover });
    const pk = kit;
    const d = new THREE.Vector3(...dir).normalize();
    pk.add(revolve([[9.2, -0.4, 0.3], [12, 1.4, 0.8], [12.4, 3, 0.9], [12.4, 10.5, 0.9], [11, 12, 1], [5.5, 12.4, 0.4]], { segs: 96, crease: 30 }), sKnurl, T(...hub).multiply(axis));
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), d);
    const m = new THREE.Matrix4().compose(new THREE.Vector3(...hub).addScaledVector(new THREE.Vector3(0, 0, 0), 0), q, new THREE.Vector3(1, 1, 1));
    const m2 = T(...hub).multiply(axis).multiply(T(0, 0, 12.4));
    const start = new THREE.Vector3().setFromMatrixPosition(m2);
    m.setPosition(start.x, start.y, start.z);
    pk.add(revolve([[5.6, 0, 0.3], [5.6, len - 92, 0.3], [7, len - 90, 0.7]], { segs: 32 }), steel, m);
    pk.add(revolve([[9.6, len - 93, 0.4], [11, len - 90, 0.7], [11, len - 8, 0.6], [10, len - 2.5, 0.8], [7, len - 0.3, 0.6], [0, len]], { segs: 96, crease: 30, rRef: 11 }), rKnurl, m);
  };
  const aimK = new Kit(), rollK = new Kit();
  handle(aimK, hov.aim, [40.5, 0, 0], alongX, 180, [0.14, -0.3, 1]);
  handle(rollK, hov.roll, [0, 28, 34], T(), 125, [-0.8, -0.32, 0.55]);
  pk.build(pitchMM);
  rk.build(rollMM);
  const aimMeshes = aimK.build(pitchMM, 'aim'), rollMeshes = rollK.build(rollMM, 'roll');
  // the bullseye bubble is its own mesh so update() can let it float to the high side
  const bubble = new THREE.Mesh(prep(new THREE.SphereGeometry(1.9, 20, 12)), lib.get('levelBubble', NC));
  bubble.scale.set(1, 0.42, 1);
  bubble.position.set(0, 42.35, 33);
  rollMM.add(bubble);
  // (and the vials' bubbles, which run along their tubes — one instanced draw for both vials)
  const tubeGeo = prep(revolve([[0, -2.4], [1.6, -2.2], [1.8, 0], [1.6, 2.2], [0, 2.4]], { segs: 16 }));
  const bubInst = new THREE.InstancedMesh(tubeGeo, lib.get('levelBubble', NC), 2);
  rollMM.add(bubInst);
  const bubX = new THREE.Object3D(), bubZ = new THREE.Object3D();
  bubX.rotation.y = Math.PI / 2;
  bubX.scale.set(1, 0.55, 1); bubZ.scale.set(1, 0.55, 1);
  bubX.position.set(0, VX.y + 1.2, VX.z); bubZ.position.set(VZ.x, VZ.y + 1.2, VZ.z);
  const syncBubbles = () => {
    bubX.updateMatrix(); bubZ.updateMatrix();
    bubInst.setMatrixAt(0, bubX.matrix); bubInst.setMatrixAt(1, bubZ.matrix);
    bubInst.instanceMatrix.needsUpdate = true;
  };
  syncBubbles();
  bubInst.computeBoundingSphere();
  return { yawMM, pitchMM, rollMM, rollY: 28 / 1000, aimMeshes, rollMeshes, pitchY: AX / 1000, plateTop: 57.3, bubble, bubbleHome: bubble.position.clone(), bubX, bubZ, bubXHome: bubX.position.clone(), bubZHome: bubZ.position.clone(), syncBubbles };
}
