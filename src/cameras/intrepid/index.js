// The camera: an Intrepid 4×5 Mk5 field camera in birch plywood with black bellows (docs/PLAYBOOK.md), with a 150 mm lens in a No. 0 leaf shutter, on the same carbon tripod and 3-way head as
// the 503CX. Every part procedural, in millimetres, from the shared modelling library (lib/). No maker's marks: the
// board carries no logo, the shutter no maker's name.
//
// Model axes, as for the 503CX and the M6: lens axis along −Z, +X = the photographer's right (standing behind the
// camera), +Y up. Origin: the lens axis on the film plane (the ground glass's ground face), with every movement at zero.
//
// Where the numbers come from (SPEC.md has each with its source). Intrepid publishes no dimensioned
// drawing, so the model is measured off its photographs:
// - Intrepid's product photograph DSCF8423 (3000 px; measurement only, never shipped), its camera solved from the lens
//   board's four corners (96 × 99 mm, the Technika size) and the carriage's edges (scratch/intrepid/dwg/cam8423.py:
//   f = 9322 px, the principal point raised to row 322 — the photograph's verticals were straightened — the
//   photographer 1.11 m away, 42° to the camera's left, level with the board; corners fit to ±1.6 px). Each part is then
//   read on its own plane, the photograph resampled onto that plane in millimetres (rect.py): the front standard on the
//   board's plane, the rear frame on its own, the uprights, the frame's side and the arm on theirs.
// - Intrepid's line drawings (the comparison page: a near front view, a side view, a three-quarter view), traced from
//   photographs or renders: proportions and the construction, not millimetres.
// - Intrepid's specification: folded 180 × 180 × 97 mm (the rear frame, 177.5 × 179.5, is that 180 square); bellows
//   75–300 mm; the board 96 × 99; rise 42, fall 30, shift ±30, front tilt and swing ±45°, rear tilt ±30°.
// Read this way the numbers hold to about ±1 mm on the front standard and ±1.5 mm further back (SPEC-INTREPID.md).
//
// API: the contract (docs/CONTRACT.md) — root, setAim, bodyCenter, worldToBody, ringAxisWorld, lensPose,
// filmOffset, setRings, swapLens, setHood, hoodOn, hasHood, setFilter, update, pickables, setHover, ringAngle,
// ringValueAt, fire, setExploded, setCutaway, labelAt, labelFocus, updateLabels — and, for the ground glass seen from
// behind (cameras.js): ggPose(), setScreenTexture(tex, shape); the movements: setMovements({ rise, shift, tilt, swing,
// rearTilt, backRot }), lensMovements() (for the lens view), turnBack(portrait), turnCover(); the dark cloth:
// setCloth(on), setUnderCloth(on), clothOn, glassSeen(view); the loupe: setLoupe(up), loupeUp, loupeAt(), moveLoupe(x, y),
// glassPoint(world), loupeDrag(dx, dy, view, h), loupeCentre(), setLoupeTexture(tex, crop, shape); the shutter held open
// and the film holder: shutterHeld, holdOpen(open), holder { insert(side, shown), remove(), pull(), push(exposedOut),
// fresh(), state }; folding: fold(on), folded.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { addScrew, revolve, rrPath, rbox, slab } from '../../lib/geometry.js';
import { MatLib, baseMaterials } from '../../lib/materials.js';
import { Kit, foldSiblings, mergeStaticRigid, prep } from '../../lib/mesh.js';
import { computeIrisSpec, createIrisDiaphragm, createLeafShutter, createClearFrontGlass, buildSteppedBaffleTube } from '../../lib/diaphragm.js';
import { buildHead, buildTripod } from '../../lib/rig.js';
import { DEG, FONT, T, TAU, easeInOut, lerp } from '../../lib/util.js';
import { lensOpticsFor, filterOpticsFor } from '../../optics.js';
import { createBellows } from './bellows.js';
import { createDarkCloth } from './darkcloth.js';
import { HOLDER, buildHolder } from './holder.js';
export { flushCameraTextures } from '../../lib/textures.js';

// ───────── Dimensions (mm) ─────────
// The rear standard and the base in the model's frame. The front standard in its own frame F: the lens axis on the
// board's front face, its axes the model's when every movement is zero. (In the photograph the board's face is 198 mm in
// front of the film: model Z = the photograph's plane-frame Z − 198.)
export const DIM = {
  tripod: { apex: 1180, spread: 560 },
  // ── rear standard (at zero tilt). The frame: birch ply, 177.5 wide, 179.5 tall, its front 23 mm in front of the
  // film, 15 thick; a narrow border (6 mm) round a pillow-shaped opening whose sides bow out 2 mm (the photograph,
  // Intrepid's front drawing)
  frame: { w: 177.5, yT: 89.3, yB: -90.2, zF: -23, zB: -8, r: 3.5, open: { w: 165, yT: 83, yB: -85, r: 9, bulge: 2 }, step: -14, light: { w: 128, h: 128, r: 8 } },
  // the bellows' rear plate, inside the opening, set 2 mm back; four screws hold the bellows to it (Intrepid's guide)
  plate: { w: 160, yT: 80, yB: -82, r: 7, z: -21, t: 1.5, screws: [[76, 76.5], [76, -78.5]] },
  // the back behind the frame: 177.5 × 148 in landscape, turning a full turn on its magnets within the frame's square;
  // 12.5 deep with the ground glass's frame on it; the ground glass's ground face is the film plane
  // (in landscape, the notch end at −X: the photographer's left, where a holder goes in — Intrepid's guide)
  // the birch plate 2.5 thick to the seat (5 in front of the film, as a holder's face is: ANSI's 0.197 in), a channel
  // 121 wide along it, its rails 3.2 proud; the ground glass's frame in the channel on the seat: black, printed, 167 ×
  // 120.6, 10 thick, a notch 38 × 14 in its notch end, the glass 127 × 101.6 (its corners clipped 5) dropped into it
  // from behind and held by a T-clip at each end, its ground face the film plane; a flat spring each long side (birch
  // near the far end to a lug on the frame's side) and a Graflok bar on the notch half (Intrepid's DSCF8432 and its
  // guide's animations; local reference notes)
  back: { w: 177.5, h: 148, zF: -7.5, zB: 5, r: 6, seat: -5, rail: -1.8, channel: 121, gg: { w: 127, h: 101.6, clip: 5, t: 2.5 }, image: { w: 120, h: 96 }, window: { w: 121, h: 97 },
    frame: { l: 167, w: 120.6, r: 3, rear: { w: 128, h: 102.6 }, notch: { w: 38, d: 14 } } },
  // black aluminium side plates on the frame's sides, low down, carrying the pivot and the lock knob; the L-arms outside
  // (the arm and its knob read on their own planes: the pivot 12 mm in front of the frame, the knob 23.7 above it and
  // 13° forward; the arm 42 wide at the foot)
  sidePlate: { x: 88.75, t: 2.5, z0: -50, z1: -20, y0: -91, y1: -47 },
  // (the slot runs from 8° behind the vertical through the pivot to 104° in front of it: the knob sits 13° forward
  // with the standard upright, 103° when it is folded flat — Intrepid's unfolding animation, the knob just in front of
  // the pivot and a little below it)
  arm: { x: 91.25, t: 5, zF: -66.3, zB: -24.7, top: -44, pivot: { y: -80.3, z: -35 }, knob: { y: -57.2, z: -40.5, r: 10.5, len: 8, slotR: 23.7 }, slot: [-8, 104] },
  rearLevel: { x0: 52, x1: 79, z: -15.5 },
  // ── front standard (frame F)
  board: { w: 96, h: 99, t: 2.5, r: 1 },
  // birch ply 9 mm: 120 wide, notched each side (±55) where the black side blocks sit; its face 1 mm proud of the board
  panel: { w: 120, yT: 58.8, yB: -56.7, z0: -1, z1: 8, r: 2, notch: { x: 55, y0: -26, y1: 18 }, recess: { w: 96.6, h: 99.6 }, hole: 89 },
  clip: { w: 70, y0: 49.6, y1: 60.6, z0: -3, ears: 20, screws: 16 },
  lip: { w: 86, y0: -57.2, y1: -49.4, z0: -3, screws: 33 },
  sideBlock: { x0: 55, x1: 61.5, y0: -26, y1: 18 },
  // the U-frame: two slotted uprights (black aluminium, 6 × 20) standing at the ends of a bottom channel
  // (their front edges flush with the panel's face — the near one hides behind the panel's corner in the photograph,
  // the far one's edge lands there — 14 wide above the panel's bottom, 23 below, as in Intrepid's side drawing; the
  // slot 6.7 wide, 7.5 behind the front edge)
  upright: { x0: 60.5, x1: 66.5, z0: -1, z1: 13, z1Low: 22, yLow: -47, yT: 59.5, yB: -99.5, slot: { w: 6.7, z: 6.5, y0: -58, y1: 52 } },
  // the dual controls on the tilt axis: a spacer, the knurled rise lock, the five-lobed tilt lock outside it (Intrepid's
  // front drawing, on the knobs' own plane: the tilt lock's face 88.4 from the axis; Ø 21.6 ring, Ø 27 lobes)
  knob: { y: -7, z: 6.5, spacer: [66.5, 72.6, 8.5], ring: [72.6, 81.4, 10.8], flower: [81.4, 88.4, 13.4, 9] },
  channel: { x: 60.5, yT: -85, yB: -99.5, z0: -10, z1: 26, t: 4 },
  wing: { x: 0, z: 10 },
  // the carriage: birch ply 15.5 mm, only 58 wide (its front face in the photograph, 2 mm behind the board), 170 long,
  // on two guide blocks 51 apart; the lead screw down its middle, the focus wheel on its back end; brass inserts along
  // its top, the front standard's mounts (one per range of focal lengths)
  carriage: { w: 58, y0: -115, y1: -99.5, z0: -2, z1: 168, inserts: [8, 46, 84, 122] },
  // ── base (model frame): black aluminium plate, 4 mm, its front 10 mm ahead of the board in the photograph; the two
  // linear guides on it; two windows outside them toward the back
  base: { y0: -125.5, y1: -121.5, zF: -208, zB: -14, wF: 120, rF: 28, wB: 193, flare: [-150, -102], win: { x0: 36, x1: 86, z0: -112, z1: -30, r: 8 } },
  rails: { x: 25.5, w: 7, h: 4.8, z0: -210, z1: -22 },
  blocks: { w: 17, h: 6.5, len: 30 },
  lead: { x: 0, y: -111, r: 3, stud: -12 },
  wheel: { r: 12, len: 10 },
  socket: { x: 0, z: -110 },
};
const F = DIM, PN = F.panel, UP = F.upright, KB = F.knob;
const FOCUS_PITCH = 8;   // the lead screw's lead: mm per turn of the focus wheel

// ───────── Plates and slabs ─────────
const shapeXY = (poly) => new THREE.Shape(poly.map(([x, y]) => new THREE.Vector2(x, y)));
/** A plate in the XY plane (model coordinates), z0 → z0 + t. */
function xyPlate(shape, z0, t, b = 0.3, wear = 0.4) { const g = slab(shape, t, b, 24, wear, 3); g.translate(0, 0, z0); return g; }
/** A plate in the YZ plane, X from x0 to x0 + t; its shape drawn in (u = Z, v = Y). */
function yzPlate(shape, x0, t, b = 0.3, wear = 0.4) {
  const g = slab(shape, t, b, 24, wear, 3);
  g.applyMatrix4(new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 1, 0), new THREE.Vector3(-1, 0, 0)));
  g.translate(x0 + t, 0, 0);
  return g;
}
/** A plate in the XZ plane, Y from y0 to y0 + t; its shape drawn in plan (u = X, v = −Z: the front up). */
function xzPlate(shape, y0, t, b = 0.3, wear = 0.4) {
  const g = slab(shape, t, b, 24, wear, 3);
  g.applyMatrix4(new THREE.Matrix4().makeBasis(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 1, 0)));
  g.translate(0, y0, 0);
  return g;
}
/** Plywood: a slab's faces and its edges, each to its own Kit (the face veneer; the edge's plies). */
function birch(kitFace, matFace, kitEdge, matEdge, g, axis = 'z', m) {
  const nor = g.attributes.normal, idx = g.index.array, get = axis === 'x' ? 'getX' : axis === 'y' ? 'getY' : 'getZ';
  const faces = [], edges = [];
  for (let i = 0; i < idx.length; i += 3) {
    const n = Math.abs(nor[get](idx[i])) + Math.abs(nor[get](idx[i + 1])) + Math.abs(nor[get](idx[i + 2]));
    (n > 2.4 ? faces : edges).push(idx[i], idx[i + 1], idx[i + 2]);
  }
  const part = (list) => { const p = g.clone(); p.setIndex(list); return p; };
  if (faces.length) kitFace.add(part(faces), matFace, m);
  if (edges.length) kitEdge.add(part(edges), matEdge, m);
}
const circle = (x, y, r, hole = false) => { const p = hole ? new THREE.Path() : new THREE.Shape(); p.absarc(x, y, r, 0, TAU, hole); return p; };
/** A rounded rectangle whose sides bow out by `bulge` at their middles (the rear frame's opening). */
function pillow(w, y0, y1, r, bulge, hole = false) {
  const p = hole ? new THREE.Path() : new THREE.Shape(), x0 = -w / 2, x1 = w / 2;
  const n = 18, pts = [];
  const edge = (ax, ay, bx, by, ox, oy) => { for (let i = 0; i < n; i++) { const t = i / n, s = Math.sin(Math.PI * t) * bulge; pts.push([lerp(ax, bx, t) + ox * s, lerp(ay, by, t) + oy * s]); } };
  const arc = (cx, cy, a0) => { for (let i = 0; i < 14; i++) { const a = a0 + (i / 14) * (Math.PI / 2); pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } };
  edge(x0 + r, y0, x1 - r, y0, 0, -1); arc(x1 - r, y0 + r, -Math.PI / 2);
  edge(x1, y0 + r, x1, y1 - r, 1, 0); arc(x1 - r, y1 - r, 0);
  edge(x1 - r, y1, x0 + r, y1, 0, 1); arc(x0 + r, y1 - r, Math.PI / 2);
  edge(x0, y1 - r, x0, y0 + r, -1, 0); arc(x0 + r, y0 + r, Math.PI);
  if (hole) pts.reverse();
  p.moveTo(pts[0][0], pts[0][1]); pts.slice(1).forEach(([x, y]) => p.lineTo(x, y)); p.closePath();
  return p;
}
/** A cylinder along X (a knob's axis), from x0 to x1, radius r, centred at (y, z). */
function xCyl(r, x0, x1, y, z, segs = 32) {
  const g = revolve([[0, 0], [r, 0, 0.6], [r, x1 - x0, 0.6], [0, x1 - x0]], { segs });
  g.applyMatrix4(new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0)));
  g.translate(x0, y, z);
  return g;
}

// ───────── Textures ─────────
const tex = (cv, srgb = true) => { const t = new THREE.CanvasTexture(cv); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function noiseSeed(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
/** Birch veneer, rotary cut and oiled: honey-pale, with the broad wandering figure a peeled log gives (growth rings
 *  met at a shallow angle: wide flowing bands, never straight stripes), fine pores along the grain, a few pin knots and
 *  mineral flecks (the photographs). The grain runs along u. 1024 px for 160 mm, tiling; with it a height map of the
 *  grain (the pores and the rings' hard edges stand a hair proud after sanding). */
let _birchFaceCache = null;
let _birchEdgeCache = null;
function birchFaceTex() {
  if (_birchFaceCache) return _birchFaceCache;
  const N = 1024, invN = 1 / N, cv = canvas(N, N), g = cv.getContext('2d'), img = g.createImageData(N, N), d = img.data;
  const cb = canvas(N, N), gb = cb.getContext('2d'), imb = gb.createImageData(N, N), db = imb.data;
  const rnd = noiseSeed(11), G = 512, lat = new Float32Array(G * G);
  for (let i = 0; i < G * G; i++) lat[i] = rnd();
  // Precompute per-column (u) lattice indices & smoothstep weights for the 7 noise octaves
  const mkX = (px) => {
    const x0 = new Uint16Array(N), x1 = new Uint16Array(N), sx = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const x = i * invN * px, xi = x | 0, fx = x - xi;
      x0[i] = xi % px; x1[i] = (xi + 1) % px; sx[i] = fx * fx * (3 - 2 * fx);
    }
    return [x0, x1, sx];
  };
  const [x0_2, x1_2, sx_2] = mkX(2);
  const [x0_3, x1_3, sx_3] = mkX(3);
  const [x0_5, x1_5, sx_5] = mkX(5);
  const [x0_9, x1_9, sx_9] = mkX(9);
  const [x0_12, x1_12, sx_12] = mkX(12);
  const [x0_40, x1_40, sx_40] = mkX(40);
  const sampleRow = (v, py) => {
    const y = v * py, yi = y | 0, fy = y - yi;
    return [(yi % py) * G, ((yi + 1) % py) * G, fy * fy * (3 - 2 * fy)];
  };
  for (let j = 0; j < N; j++) {
    const v = j * invN;
    const [r0_3, r1_3, sy_3] = sampleRow(v, 3);
    const [r0_4, r1_4, sy_4] = sampleRow(v, 4);
    const [r0_9, r1_9, sy_9] = sampleRow(v, 9);
    const [r0_31, r1_31, sy_31] = sampleRow(v, 31);
    const [r0_160, r1_160, sy_160] = sampleRow(v, 160);
    const [r0_420, r1_420, sy_420] = sampleRow(v, 420);
    const [r0_512, r1_512, sy_512] = sampleRow(v, 512);
    const v9 = v * 9, rowOff = j * N * 4;
    for (let i = 0; i < N; i++) {
      let a, b, c, e, s;
      s = sx_2[i]; a = lat[r0_3 + x0_2[i]]; b = lat[r0_3 + x1_2[i]]; c = lat[r1_3 + x0_2[i]]; e = lat[r1_3 + x1_2[i]];
      const n1 = a + (b - a) * s + (c - a + (a - b - c + e) * s) * sy_3;
      s = sx_5[i]; a = lat[r0_9 + x0_5[i]]; b = lat[r0_9 + x1_5[i]]; c = lat[r1_9 + x0_5[i]]; e = lat[r1_9 + x1_5[i]];
      const n2 = a + (b - a) * s + (c - a + (a - b - c + e) * s) * sy_9;
      s = sx_9[i]; a = lat[r0_31 + x0_9[i]]; b = lat[r0_31 + x1_9[i]]; c = lat[r1_31 + x0_9[i]]; e = lat[r1_31 + x1_9[i]];
      const n3 = a + (b - a) * s + (c - a + (a - b - c + e) * s) * sy_31;
      const f = v9 + 2.6 * n1 + 0.9 * n2 + 0.25 * n3, r = f - Math.floor(f);
      const late = Math.exp(-((r - 0.86) * (r - 0.86)) / 0.012);
      const early = 0.5 - 0.5 * Math.cos(r * TAU);
      s = sx_3[i];
      a = lat[r0_160 + x0_3[i]]; b = lat[r0_160 + x1_3[i]]; c = lat[r1_160 + x0_3[i]]; e = lat[r1_160 + x1_3[i]];
      const streak = a + (b - a) * s + (c - a + (a - b - c + e) * s) * sy_160 - 0.5;
      a = lat[r0_4 + x0_3[i]]; b = lat[r0_4 + x1_3[i]]; c = lat[r1_4 + x0_3[i]]; e = lat[r1_4 + x1_3[i]];
      const blotch = a + (b - a) * s + (c - a + (a - b - c + e) * s) * sy_4 - 0.5;
      s = sx_12[i]; a = lat[r0_420 + x0_12[i]]; b = lat[r0_420 + x1_12[i]]; c = lat[r1_420 + x0_12[i]]; e = lat[r1_420 + x1_12[i]];
      const fibre = a + (b - a) * s + (c - a + (a - b - c + e) * s) * sy_420 - 0.5;
      s = sx_40[i]; a = lat[r0_512 + x0_40[i]]; b = lat[r0_512 + x1_40[i]]; c = lat[r1_512 + x0_40[i]]; e = lat[r1_512 + x1_40[i]];
      const pore = (a + (b - a) * s + (c - a + (a - b - c + e) * s) * sy_512) > 0.9 ? 1 : 0;
      const k = 1 + 0.05 * early - 0.13 * late + 0.07 * streak + 0.05 * fibre + 0.09 * blotch - 0.09 * pore;
      const o = rowOff + i * 4;
      const c0 = 221 * k, c1 = 171 * (k - 0.03 * late + 0.012 * blotch), c2 = 108 * (k - 0.07 * late - 0.02 * blotch);
      d[o] = c0 > 255 ? 255 : c0; d[o + 1] = c1 > 255 ? 255 : c1; d[o + 2] = c2 > 255 ? 255 : c2; d[o + 3] = 255;
      const hgt = 150 + 40 * streak + 30 * fibre + 26 * late - 70 * pore;
      db[o] = db[o + 1] = db[o + 2] = hgt < 0 ? 0 : (hgt > 255 ? 255 : hgt); db[o + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0); gb.putImageData(imb, 0, 0);
  // pin knots and mineral flecks
  for (let i = 0; i < 7; i++) {
    const x = rnd() * N, y = rnd() * N, r = 2 + rnd() * 3.5, gr = g.createRadialGradient(x, y, 0, x, y, r * 2.2);
    gr.addColorStop(0, 'rgba(92,58,34,0.75)'); gr.addColorStop(0.45, 'rgba(140,92,52,0.35)'); gr.addColorStop(1, 'rgba(160,110,64,0)');
    g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, r * 3.2, r * 1.5, 0, 0, TAU); g.fill();
  }
  for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(112,74,44,${0.12 + rnd() * 0.2})`; g.fillRect(rnd() * N, rnd() * N, 3 + rnd() * 9, 1); }
  const t = tex(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1 / 160, 1 / 160);
  const bump = tex(cb, false); bump.wrapS = bump.wrapT = THREE.RepeatWrapping; bump.repeat.set(1 / 160, 1 / 160);
  t.userData.bump = bump;
  t.userData.shared = true; bump.userData.shared = true;
  if (t.source) (t.source.userData ||= {}).shared = true;
  if (bump.source) (bump.source.userData ||= {}).shared = true;
  return (_birchFaceCache = t);
}
/** The plies seen on an edge: birch layers 1.35 mm thick, alternately long grain (pale) and end grain (darker: it
 *  drinks the oil and takes the laser's scorch), a thin dark glue line between, all browned by the laser that cut them
 *  (the photographs of the frame's side and the base's). v in mm across the thickness. */
function birchEdgeTex() {
  if (_birchEdgeCache) return _birchEdgeCache;
  const cv = canvas(128, 256), g = cv.getContext('2d'), rnd = noiseSeed(5);
  const P = 128;   // px per ply (two plies in the texture's height)
  for (let k = 0; k < 2; k++) {
    g.fillStyle = k ? '#8a5c34' : '#cf9a5c'; g.fillRect(0, k * P, 128, P);
    for (let i = 0; i < 70; i++) { g.fillStyle = k ? `rgba(60,36,20,${0.06 + rnd() * 0.12})` : `rgba(140,95,60,${0.04 + rnd() * 0.07})`; g.fillRect(rnd() * 128, k * P + rnd() * P, k ? 1 + rnd() * 2 : 128, k ? 4 + rnd() * 20 : 1 + rnd() * 3); }
    g.fillStyle = 'rgba(58,34,20,0.85)'; g.fillRect(0, k * P, 128, 7);
  }
  // the scorch: uneven along the cut
  for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(70,40,20,${0.03 + rnd() * 0.07})`; g.fillRect(rnd() * 128, 0, 2 + rnd() * 14, 256); }
  const t = tex(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1 / 30, 1 / 2.7);
  t.userData.shared = true;
  if (t.source) (t.source.userData ||= {}).shared = true;
  return (_birchEdgeCache = t);
}
/** The shutter's front face inside the speed ring (the photograph): its speeds 9.5° apart round the upper left, 500 at the lower
 *  left to T at one o'clock (B red, T green), white; the shutter's size, "No. 0", at the bottom. 1024 px across 58 mm,
 *  seen from the front. */
const SPEED_A0 = -68, SPEED_DA = 9.5;
function speedFaceTex(sizeLabel = 'No. 0', ringR = 28.8) {
  const span = 2 * (ringR + 0.2);
  const cv = canvas(1024, 1024), g = cv.getContext('2d'), c = 512, k = 1024 / span;
  g.fillStyle = '#121112'; g.fillRect(0, 0, 1024, 1024);
  { const rr = noiseSeed(3); g.lineWidth = 1; for (let r = 300; r < 520; r += 1.5) { const a = rr() * 0.07; g.strokeStyle = rr() < 0.5 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a * 2})`; g.beginPath(); g.arc(c, c, r, 0, TAU); g.stroke(); } }
  const speeds = [sizeLabel === 'No. 1' ? '400' : '500', '250', '125', '60', '30', '15', '8', '4', '2', '1', 'B', 'T'];
  const rSpeed = ringR - 3.2, rLabel = ringR - 3.4;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  speeds.forEach((s, i) => {
    const a = (SPEED_A0 + i * SPEED_DA) * DEG;
    g.save(); g.translate(c + Math.sin(a) * rSpeed * k, c - Math.cos(a) * rSpeed * k); g.rotate(a);
    g.fillStyle = s === 'B' ? '#e23a22' : s === 'T' ? '#3fb36a' : '#efede4';
    g.font = `500 ${2.5 * k}px ${FONT}`; g.fillText(s, 0, 0); g.restore();
  });
  const txt = sizeLabel;
  g.fillStyle = '#efede4'; g.font = `500 ${2.4 * k}px ${FONT}`;
  [...txt].forEach((ch, i) => { const a = Math.PI + (i - (txt.length - 1) / 2) * -0.085; g.save(); g.translate(c + Math.sin(a) * rLabel * k, c - Math.cos(a) * rLabel * k); g.rotate(a + Math.PI); g.fillText(ch, 0, 0); g.restore(); });
  return tex(cv);
}
/** The front cell's bevel: dynamically scaled to every lens's exact Fr.r & Fr.bevel (Law #27 — fixes /48 clipping on 75/90/210/300 mm!). */
function nameRingTex(lens) {
  const def = lensDef(lens), Fr = def.front;
  const cv = canvas(1024, 1024), g = cv.getContext('2d'), c = 512;
  g.fillStyle = '#0c0c0e'; g.fillRect(0, 0, 1024, 1024);
  const pxR = (r) => 512 * (r / Fr.r);
  const rInner = Fr.bevel + 0.35, rOuter = Fr.r - 0.9;
  g.strokeStyle = 'rgba(255,255,255,0.14)'; g.lineWidth = 3;
  g.beginPath(); g.arc(c, c, pxR(rInner), 0, TAU); g.stroke();
  g.beginPath(); g.arc(c, c, pxR(rOuter), 0, TAU); g.stroke();
  const R = pxR((rInner + rOuter) / 2);
  const bandPx = Math.max(26, pxR(rOuter - rInner));
  const fSize = Math.min(40, Math.max(24, Math.round(bandPx * 0.44)));
  const drawArc = (str, aMid, color, weight = 600, inward = false) => {
    g.save(); g.font = `${weight} ${fSize}px ${FONT}`; g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle';
    const ch = [...str], w = ch.map((chx) => g.measureText(chx).width), tot = w.reduce((s, v) => s + v, 0);
    let cur = -tot / 2;
    ch.forEach((chx, i) => {
      const a = aMid + (inward ? -1 : 1) * (cur + w[i] / 2) / R; cur += w[i];
      g.save(); g.translate(c + Math.sin(a) * R, c - Math.cos(a) * R); g.rotate(a + (inward ? Math.PI : 0));
      g.fillText(chx, 0, 0); g.restore();
    });
    g.restore();
  };
  drawArc(`GLASS WORKS  ${def.title || 'SYMMAR'}`, -0.62, '#efede4', 700, false);
  drawArc(`${lens.focalLength}mm  1:${lens.maxAperture}  MC`, 0.78, '#efede4', 600, false);
  drawArc(`Ø${lens.filterSize || 40.5}mm   ${def.serial || '1402819'}`, Math.PI, '#d2d0c8', 600, true);
  return tex(cv);
}
/** The aperture scale's sector: dynamically scaled to Copal No. 0 (ringR=28.8) & Copal No. 1 (ringR=34.0)! */
function apScaleTex(stops, ringR = 28.8) {
  const span = 2 * (ringR + 7.2);
  const cv = canvas(512, 512), g = cv.getContext('2d'), c = 256, k = 512 / span;
  g.fillStyle = '#121112'; g.fillRect(0, 0, 512, 512);
  g.fillStyle = '#efede4'; g.font = `600 ${2.0 * k}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  const rTick = ringR + 1.0, rNum = ringR + 3.4;
  stops.forEach((N, i) => {
    const a = AP_PHI0 + (i / (stops.length - 1)) * AP_ARC;
    g.save(); g.translate(c + Math.sin(a) * rNum * k, c - Math.cos(a) * rNum * k); g.rotate(a + Math.PI); g.fillText(String(N), 0, 0); g.restore();
    g.fillRect(c + Math.sin(a) * rTick * k - 1.5, c - Math.cos(a) * rTick * k - 1.5, 3, 3);
  });
  return tex(cv);
}
/** The ruled zeroing guides on the channel's front: 30 mm of millimetre ticks, every fifth long, a zero mark. */
function ruleTex() {
  const cv = canvas(1024, 128), g = cv.getContext('2d'), k = 1024 / 32;
  g.clearRect(0, 0, 1024, 128); g.fillStyle = '#f2f0e8';
  for (let i = 0; i <= 30; i++) { const x = (1 + i) * k, h = i % 5 === 0 ? 70 : 42; g.fillRect(x - 2, 128 - h, 4, h); }
  g.beginPath(); g.moveTo(0.4 * k, 20); g.lineTo(1.6 * k, 20); g.lineTo(k, 64); g.closePath(); g.fill();
  const t = tex(cv); return t;
}
/** Vertical rise/fall millimetre teaching scale engraved along front uprights (+30 .. 0 .. -20 mm), ticks pointing inward toward the zeroing flag. */
function riseScaleTex(ticksOnRight = false) {
  const cv = canvas(160, 1024), g = cv.getContext('2d');
  g.clearRect(0, 0, 160, 1024); g.fillStyle = '#f2f0e8';
  for (let mm = -25; mm <= 30; mm += 1) {
    const y = 512 - mm * 14.5;
    if (y < 24 || y > 1000) continue;
    const maj = mm % 10 === 0, mid = mm % 5 === 0;
    const w = mm === 0 ? 72 : maj ? 50 : mid ? 34 : 20;
    const h = mm === 0 ? 5.5 : maj ? 3.8 : 2.2;
    const x0 = ticksOnRight ? 150 - w : 10;
    g.fillRect(x0, y - h / 2, w, h);
    if (maj && mm !== 0) {
      g.font = `700 28px ${FONT}`;
      g.textAlign = ticksOnRight ? 'right' : 'left';
      g.textBaseline = 'middle';
      g.fillText(`${mm > 0 ? '+' : ''}${mm}`, ticksOnRight ? 92 : 68, y);
    }
  }
  return tex(cv);
}
/** The ground glass's ½-inch grid and the 4×5 frame lines, dark lines on clear (the glass itself is the image plane). */
function ggGridTex(w, h) {
  const cv = canvas(1280, 1024), g = cv.getContext('2d'), kx = 1280 / w, ky = 1024 / h;
  g.clearRect(0, 0, 1280, 1024); g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = 1.6;
  for (let x = -6; x <= 6; x++) { const X = 640 + x * 12.7 * kx; g.beginPath(); g.moveTo(X, 0); g.lineTo(X, 1024); g.stroke(); }
  for (let y = -5; y <= 5; y++) { const Y = 512 + y * 12.7 * ky; g.beginPath(); g.moveTo(0, Y); g.lineTo(1280, Y); g.stroke(); }
  const t = tex(cv); return t;
}

// ───────── The base: plate, guides, lead screw, rear arms ─────────
function buildBase(lib, hov) {
  const group = new THREE.Group(); group.name = 'intrepidBase';
  const kit = new Kit(), shiny = new Kit();
  const anod = lib.get('anod'), steel = lib.get('steel'), chrome = lib.get('chrome'), dark = lib.get('anod');
  const B = DIM.base;
  // the plate in plan (u = X, v = −Z): narrow at the front under the carriage, flaring to the arms
  const fz = -B.zF, bz = -B.zB, hf = B.wF / 2, hb = B.wB / 2, [f0, f1] = B.flare.map((z) => -z);
  const n = 24, outline = [];
  const corner = (cx, cy, r, a0, a1) => { for (let i = 0; i <= n; i++) { const a = lerp(a0, a1, i / n); outline.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } };
  // (anticlockwise in (u, v): the front edge's right end, round the front, down the left side to the back)
  corner(hf - B.rF, fz - B.rF, B.rF, 0, Math.PI / 2);
  corner(-hf + B.rF, fz - B.rF, B.rF, Math.PI / 2, Math.PI);
  for (let i = 0; i <= n; i++) { const t = i / n, s = (1 - Math.cos(Math.PI * t)) / 2; outline.push([-lerp(hf, hb, s), lerp(f0, f1, t)]); }
  corner(-hb + 9, bz + 9, 9, Math.PI, Math.PI * 1.5);
  corner(hb - 9, bz + 9, 9, Math.PI * 1.5, TAU);
  for (let i = 0; i <= n; i++) { const t = 1 - i / n, s = (1 - Math.cos(Math.PI * t)) / 2; outline.push([lerp(hf, hb, s), lerp(f0, f1, t)]); }
  const sh = shapeXY(outline);
  for (const s of [-1, 1]) sh.holes.push(rrPath(s > 0 ? B.win.x0 : -B.win.x1, -B.win.z1, s > 0 ? B.win.x1 : -B.win.x0, -B.win.z0, B.win.r, new THREE.Path()));
  kit.add(xzPlate(sh, B.y0, B.y1 - B.y0, 0.5, 0.7), anod);
  // the two linear guides: hardened steel rails screwed to the plate
  const R = DIM.rails;
  for (const s of [-1, 1]) {
    const rail = rbox(R.w, R.h, R.z1 - R.z0, 0.3, 1);
    shiny.add(rail, steel, T(s * R.x, B.y1 + R.h / 2, (R.z0 + R.z1) / 2));
    for (let z = R.z0 + 10; z < R.z1; z += 20) kit.add(revolve([[0, 0], [1.5, 0], [1.5, 0.3], [0, 0.4]], { segs: 24 }), dark, T(s * R.x, B.y1 + R.h + 0.01, z, -Math.PI / 2));
  }
  // (the lead screw's nut is fixed to the plate under the carriage, between the guides: hidden)
  // tripod bushes underneath: ¼″ at the balance point, ⅜″ behind it
  for (const [z, r] of [[DIM.socket.z, 3.2], [DIM.socket.z - 40, 4.8]]) {
    shiny.add(revolve([[r + 2.4, -0.3], [r + 2.4, 0.4, 0.6], [r, 0.4]], { segs: 36 }), lib.get('brass'), T(0, B.y0, z, Math.PI / 2));
    shiny.add(revolve([[r, 0.35], [0, 0.35]], { segs: 28 }), lib.get('flock'), T(0, B.y0, z, Math.PI / 2));
  }
  // ── the L-arms: 5 mm CNC-milled black aluminium with smooth compound Bezier sweep down the front edge (ZERO polygon kinks!)
  const A = DIM.arm, P = A.pivot;
  const armShape = () => {
    const cz = A.knob.z + 3, r = 12.5, cy = A.top - r;
    const s = new THREE.Shape();
    s.moveTo(A.zF + 3, B.y1);
    s.lineTo(A.zB, B.y1);
    s.lineTo(A.zB, -66);
    s.absarc(cz, cy, r, -0.25, -0.25 + Math.PI * 0.95, false);
    // Smooth CNC-milled compound S-curve flowing tangentially off the upper boss past the tilt slot to the rounded foot!
    s.bezierCurveTo(-55.5, -52.5, -62.5, -59.5, A.zF, -69.5);
    s.lineTo(A.zF, B.y1 + 3);
    s.quadraticCurveTo(A.zF, B.y1, A.zF + 3, B.y1);
    return s;
  };
  for (const s of [-1, 1]) {
    const shp = armShape();
    // the slot: an arc of the knob's radius about the pivot, smoothly sampled (36 arc / 14 cap steps!)
    const slotPts = [], ro = A.knob.slotR + 3.2, ri = A.knob.slotR - 3.2, a0 = A.slot[0] * DEG, a1 = A.slot[1] * DEG;
    for (let i = 0; i <= 36; i++) { const a = lerp(a0, a1, i / 36); slotPts.push([P.z - Math.sin(a) * ro, P.y + Math.cos(a) * ro]); }
    for (let i = 0; i <= 14; i++) { const a = a1 + (i / 14) * Math.PI; const c = [P.z - Math.sin(a1) * A.knob.slotR, P.y + Math.cos(a1) * A.knob.slotR]; slotPts.push([c[0] - Math.sin(a) * 3.2, c[1] + Math.cos(a) * 3.2]); }
    for (let i = 36; i >= 0; i--) { const a = lerp(a0, a1, i / 36); slotPts.push([P.z - Math.sin(a) * ri, P.y + Math.cos(a) * ri]); }
    for (let i = 0; i <= 14; i++) { const a = a0 + Math.PI + (i / 14) * Math.PI; const c = [P.z - Math.sin(a0) * A.knob.slotR, P.y + Math.cos(a0) * A.knob.slotR]; slotPts.push([c[0] - Math.sin(a) * 3.2, c[1] + Math.cos(a) * 3.2]); }
    const hole = new THREE.Path(); hole.moveTo(slotPts[0][0], slotPts[0][1]); slotPts.slice(1).forEach(([u, v]) => hole.lineTo(u, v)); hole.closePath();
    shp.holes.push(hole);
    kit.add(yzPlate(shp, s > 0 ? A.x : -A.x - A.t, A.t, 0.5, 0.8), anod);
    // the pivot: a socket-head screw through the arm into the frame's side plate
    const hx = s * (A.x + A.t);
    shiny.add(xCyl(4.4, 0, 3.2, 0, 0, 36), chrome, new THREE.Matrix4().makeTranslation(hx + (s < 0 ? -3.2 : 0), P.y, P.z));
    kit.add(xCyl(1.9, 0, 0.4, 0, 0, 6), lib.get('flock'), new THREE.Matrix4().makeTranslation(hx + s * 3.0 + (s < 0 ? -0.4 : 0), P.y, P.z));
  }
  kit.build(group); shiny.build(group);
  return { group };
}

// ───────── The carriage: plywood on the guides' blocks, the brass mounts, the focus wheel ─────────
function buildCarriage(lib, hov, mats) {
  const group = new THREE.Group(); group.name = 'intrepidCarriage';
  const kit = new Kit(), kF = new Kit(), kE = new Kit();
  const C = DIM.carriage, Bk = DIM.blocks, R = DIM.rails, L = DIM.lead, W = DIM.wheel;
  // (frame F: the carriage moves with the front standard)
  const g = xzPlate(rrPath(-C.w / 2, -C.z1, C.w / 2, -C.z0, 1.2), C.y0, C.y1 - C.y0, 0.6, 0.6);
  birch(kF, mats.birchFaceH, kE, mats.birchEdge, g, 'y');
  // brass threaded inserts along the centre line: the front standard's mount positions (Intrepid's guide: one per range
  // of focal lengths)
  for (const z of C.inserts) {
    kit.add(revolve([[4.2, -0.2], [4.2, 0.15, 0.5], [2.6, 0.15]], { segs: 36 }), lib.get('brass'), T(0, C.y1, z, -Math.PI / 2));
    kit.add(revolve([[2.6, 0.12], [0, 0.12]], { segs: 28 }), lib.get('flock'), T(0, C.y1, z, -Math.PI / 2));
  }
  // the guides' blocks under its front, each with its two end screws
  for (const s of [-1, 1]) {
    kit.add(rbox(Bk.w, Bk.h - R.h * 0.55, Bk.len, 0.8, 2), lib.get('anod'), T(s * R.x, C.y0 - (Bk.h - R.h * 0.55) / 2, C.z0 + Bk.len / 2));
    kit.add(rbox(Bk.w - 1, 2, 1.6, 0.4, 1), lib.get('rubber'), T(s * R.x, C.y0 - 3, C.z0 - 0.8));
    for (const dx of [-5, 5]) addScrew(kit, lib.get('chrome'), kit, lib.get('flock'), T(s * R.x + dx, C.y0 - 2.4, C.z0 - 1.6, 0, Math.PI, 0), 1.0, false);
  }
  // the lead screw down the carriage's middle, its front end a stud out of the carriage's face (the photograph), and
  // the focus wheel on its back end: a knurled drum
  const stud = revolve([[0, 0], [L.r, 0, 0.4, 1], [L.r, 7, 0.4, 1], [L.r + 0.6, 7], [L.r + 0.6, 10.5], [0, 10.5]], { segs: 128, ribs: { n: 16, depth: 0.25, groove: 0.5, edge: 0.15 } });
  kit.add(stud, lib.get('steel'), T(L.x, L.y, L.stud));
  const wheel = new THREE.Group(); wheel.position.set(L.x, L.y, C.z1 + 1);
  const wk = new Kit();
  wk.add(revolve([[0, 0], [W.r - 0.6, 0], [W.r, 0.6, 0.6, 1], [W.r, W.len - 0.6, 0.6, 1], [W.r - 0.6, W.len], [3.4, W.len], [3.4, W.len + 3]], { segs: 480, ribs: { n: 60, depth: 0.45, groove: 0.5, edge: 0.2 } }), lib.get('petg', { hover: hov.focus }));
  const wheelMeshes = wk.build(wheel, 'focus');
  group.add(wheel);
  kit.build(group); kF.build(group); kE.build(group);
  return { group, wheel, wheelMeshes };
}

// ───────── The front standard ─────────
function buildFrontStandard(lib, hov, mats) {
  const group = new THREE.Group(); group.name = 'intrepidFront';
  // swing: about the mount screw's vertical axis; shift: along the channel's slot; rise: the panel up the slots; tilt:
  // about the knobs' axis (an axis tilt, 6 mm below the lens axis)
  const swingG = new THREE.Group(); swingG.position.set(F.wing.x, 0, F.wing.z); group.add(swingG);
  const shiftG = new THREE.Group(); shiftG.position.set(-F.wing.x, 0, -F.wing.z); swingG.add(shiftG);
  const uframe = new THREE.Group(); shiftG.add(uframe);
  const riseG = new THREE.Group(); shiftG.add(riseG);
  const tiltG = new THREE.Group(); tiltG.position.set(0, KB.y, KB.z); riseG.add(tiltG);
  const panelG = new THREE.Group(); panelG.position.set(0, -KB.y, -KB.z); tiltG.add(panelG);
  const anod = lib.get('anod'), petg = lib.get('petg'), chrome = lib.get('chrome'), flock = lib.get('flock');
  // ── the U-frame
  const uk = new Kit(), us = new Kit();
  const CH = F.channel;
  for (const s of [-1, 1]) {
    // an upright: smoothly curved CNC-milled S-shoulder & circular top (ZERO sharp diagonal jog!), plus long rise/fall slot
    const hw = (UP.z1 - UP.z0) / 2;
    const sh = new THREE.Shape();
    sh.moveTo(UP.z0, UP.yB);
    sh.lineTo(UP.z1Low, UP.yB);
    sh.lineTo(UP.z1Low, UP.yLow - 6);
    sh.bezierCurveTo(UP.z1Low, UP.yLow - 0.5, UP.z1, UP.yLow + 0.5, UP.z1, UP.yLow + 6);
    sh.lineTo(UP.z1, UP.yT - hw);
    sh.absarc(UP.z0 + hw, UP.yT - hw, hw, 0, Math.PI, false);
    sh.lineTo(UP.z0, UP.yB);
    sh.holes.push(rrPath(UP.slot.z - UP.slot.w / 2, UP.slot.y0, UP.slot.z + UP.slot.w / 2, UP.slot.y1, UP.slot.w / 2 - 0.01, new THREE.Path()));
    uk.add(yzPlate(sh, s > 0 ? UP.x0 : -UP.x1, UP.x1 - UP.x0, 0.5, 0.8), anod);
    // Engraved millimetre rise/fall teaching scale on the front face of each upright beside the zeroing flag (unmirrored text on both sides!)
    const rScaleMat = new THREE.MeshStandardMaterial({ name: `intrepidRiseScale_${s > 0 ? 'R' : 'L'}`, map: s > 0 ? mats.riseScaleR : mats.riseScaleL, transparent: true, alphaTest: 0.25, roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const rsGeo = new THREE.PlaneGeometry(5.6, 62);
    rsGeo.rotateY(Math.PI);
    rsGeo.translate(s * (UP.x0 + 3.0), KB.y + 9, UP.z0 - 0.03);
    uframe.add(new THREE.Mesh(rsGeo, rScaleMat));
    // two socket screws joining it to the channel, a larger one below (the photographs)
    const ox = s * UP.x1;
    for (const z of [5, 16]) addScrew(us, chrome, us, flock, T(ox, -72, z, 0, s * Math.PI / 2, 0), 1.7, false);
    addScrew(us, lib.get('anod'), us, flock, T(ox, -93, 10, 0, s * Math.PI / 2, 0), 2.6, true);
  }
  // the channel: a plate across the carriage between the uprights, its front lip carrying the ruled guides, its slot
  // for the mount screw (shift)
  const chTop = rrPath(-CH.x, -CH.z1, CH.x, -CH.z0, 1);
  chTop.holes.push(rrPath(-30, -F.wing.z - 3, 30, -F.wing.z + 3, 2.99, new THREE.Path()));
  uk.add(xzPlate(chTop, CH.yT - CH.t, CH.t, 0.4, 0.7), anod);
  uk.add(xyPlate(rrPath(-CH.x, CH.yB, CH.x, CH.yT, 0.8), CH.z0, CH.t, 0.4, 0.8), anod);
  uk.add(xzPlate(rrPath(-CH.x, -CH.z1, CH.x, -CH.z0 - CH.t, 0.6), CH.yB, 3, 0.3, 0.5), anod);
  // small brackets at the uprights' feet, each with two screws (below the panel the photograph shows the background:
  // no plate between them)
  for (const s of [-1, 1]) {
    uk.add(xyPlate(rrPath(s > 0 ? 33 : -UP.x0, CH.yT, s > 0 ? UP.x0 : -33, -64, 1.5), CH.z0, 3, 0.4, 0.7), anod);
    for (const x of [37.5, 45.5]) addScrew(us, chrome, us, flock, T(s * x, -72, CH.z0 - 0.01, 0, Math.PI, 0), 1.6, false);
  }
  // the ruled guides, white on the lip's front: zero marks 30 mm either side of the axis
  const rule = new THREE.MeshStandardMaterial({ name: 'intrepidRule', map: mats.rule, transparent: true, alphaTest: 0.3, roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const ruleGeos = [-1, 1].map((s) => {
    const pg = new THREE.PlaneGeometry(32, 4); pg.rotateY(Math.PI);
    if (s < 0) { const uv = pg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i)); }
    pg.translate(s * (30 + 15), CH.yB + 2.1, CH.z0 - 0.02);
    return pg;
  });
  const ruleGeo = mergeGeometries(ruleGeos);
  for (const g of ruleGeos) g.dispose();
  const m = new THREE.Mesh(ruleGeo, rule); uframe.add(m);
  // the mount screw's ergonomic curved wing knob on the channel (PETG): screws through the slot into a brass insert
  const wing = new THREE.Group(); wing.position.set(F.wing.x, CH.yT, F.wing.z);
  const wk = new Kit();
  wk.add(revolve([[0, 0], [6, 0], [6, 3, 0.4], [4.2, 3.6], [0, 3.6]], { segs: 36 }), petg, T(0, 0, 0, -Math.PI / 2));
  const wingShape = new THREE.Shape();
  wingShape.moveTo(-4.8, 3.0);
  wingShape.lineTo(4.8, 3.0);
  wingShape.bezierCurveTo(6.8, 3.2, 9.2, 5.2, 9.0, 8.2);
  wingShape.bezierCurveTo(8.8, 10.6, 6.2, 11.4, 3.6, 11.1);
  wingShape.quadraticCurveTo(0, 10.6, -3.6, 11.1);
  wingShape.bezierCurveTo(-6.2, 11.4, -8.8, 10.6, -9.0, 8.2);
  wingShape.bezierCurveTo(-9.2, 5.2, -6.8, 3.2, -4.8, 3.0);
  wk.add(xyPlate(wingShape, -3.2, 6.4, 1.0, 0.3), petg);
  wk.build(wing); uframe.add(wing);
  uk.build(uframe); us.build(uframe);
  // ── the panel: birch ply with the board's recess and the round opening behind it; the black side blocks in its notches
  const kF = new Kit(), kE = new Kit(), pk = new Kit(), ps = new Kit();
  const N = PN.notch, hw = PN.w / 2;
  const outline = [[-hw, PN.yB], [hw, PN.yB], [hw, N.y0], [N.x, N.y0], [N.x, N.y1], [hw, N.y1], [hw, PN.yT], [-hw, PN.yT], [-hw, N.y1], [-N.x, N.y1], [-N.x, N.y0], [-hw, N.y0]];
  const face = shapeXY(outline);
  face.holes.push(rrPath(-PN.recess.w / 2, -PN.recess.h / 2, PN.recess.w / 2, PN.recess.h / 2, 1.2, new THREE.Path()));
  const recessDepth = 1 + DIM.board.t;
  birch(kF, mats.birchFace, kE, mats.birchEdge, xyPlate(face, PN.z0, recessDepth, 0.4, 0.4));
  const back = shapeXY(outline); back.holes.push(circle(0, 0, PN.hole / 2, true));
  birch(kF, mats.birchFace, kE, mats.birchEdge, xyPlate(back, PN.z0 + recessDepth, PN.z1 - PN.z0 - recessDepth, 0.4, 0.4));
  for (const s of [-1, 1]) {
    const SB = F.sideBlock;
    pk.add(xyPlate(rrPath(s > 0 ? SB.x0 : -SB.x1, SB.y0, s > 0 ? SB.x1 : -SB.x0, SB.y1, 1.2), PN.z0, PN.z1 - PN.z0, 0.6, 0.3), petg);
    // the zeroing notch: a small flag on the block's front face, lined up with one on the upright (Intrepid's guide)
    pk.add(rbox(2.2, 6, 1.0, 0.3, 1), lib.get('white'), T(s * (SB.x1 - 1.6), KB.y + 9, PN.z0 - 0.4));
  }
  // the board clip across the top (it slides up to free the board; two screws in slanted slots, two ears over the top)
  const CL = F.clip;
  pk.add(xyPlate(rrPath(-CL.w / 2, CL.y0, CL.w / 2, CL.y1, 1.5), CL.z0, 2, 0.4, 0.8), anod);
  for (const s of [-1, 1]) {
    addScrew(ps, chrome, ps, flock, T(s * CL.screws, (CL.y0 + CL.y1) / 2, CL.z0 - 0.01, 0, Math.PI, 0), 2.1, false, 0.6);
    const ear = rbox(7, 2, 9, 0.6, 1); pk.add(ear, anod, T(s * CL.ears, CL.y1 + 1, CL.z0 + 3.5));
  }
  // the lip under the board, two screws
  const LP = F.lip;
  pk.add(xyPlate(rrPath(-LP.w / 2, LP.y0, LP.w / 2, LP.y1, 1.2), LP.z0, 2, 0.4, 0.8), anod);
  for (const s of [-1, 1]) addScrew(ps, chrome, ps, flock, T(s * LP.screws, (LP.y0 + LP.y1) / 2 - 0.4, LP.z0 - 0.01, 0, Math.PI, 0), 1.6, false);
  // the level on the panel's top, near the left (as seen from the front: the camera's right)
  const level = (kit, x0, x1, y, z) => {
    const L = x1 - x0, cx = (x0 + x1) / 2;
    kit.add(rbox(L, 3.4, 6, 1.2, 3), petg, T(cx, y + 1.7, z));
    kit.add(revolve([[0, 0], [2.1, 0], [2.1, L - 6], [0, L - 6]], { segs: 32 }), lib.get('levelLiquid'), T(cx - (L - 6) / 2, y + 3.6, z, 0, Math.PI / 2, 0));
    kit.add(new THREE.SphereGeometry(1.6, 18, 12), lib.get('levelBubble'), T(cx, y + 4.1, z));
  };
  level(pk, 29, 56, PN.yT, (PN.z0 + PN.z1) / 2);
  kF.build(panelG); kE.build(panelG); pk.build(panelG); ps.build(panelG);
  // the board (black, no logo) in its recess: the lens comes off on it (boardG)
  const boardG = new THREE.Group(); boardG.name = 'intrepidBoard'; panelG.add(boardG);
  const bk = new Kit();
  const bsh = rrPath(-DIM.board.w / 2, -DIM.board.h / 2, DIM.board.w / 2, DIM.board.h / 2, DIM.board.r);
  bsh.holes.push(circle(0, 0, 17.3, true));
  bk.add(xyPlate(bsh, 0, DIM.board.t, 0.3, 0.5), lib.get('anod'));
  bk.build(boardG);
  // ── the dual controls each side, on the tilt axis (they ride up the slots with the panel)
  // (each lock knob is its own group on that axis, so it can turn: loosened while its movement is being set)
  const kk = new Kit(), locks = { rise: [], tilt: [] };
  const knobs = new THREE.Group(); riseG.add(knobs);
  const lockKnob = (list, s, geo, mat, m) => { const gk = new THREE.Group(); gk.position.set(0, KB.y, KB.z); gk.userData.side = s; knobs.add(gk); const q = new Kit(); q.add(geo, mat, m); q.build(gk); list.push(gk); };
  for (const s of [-1, 1]) {
    const [a0, a1, rs] = KB.spacer, [b0, b1, rr] = KB.ring, [c0, c1, R, r] = KB.flower;
    const X = (x) => s * x;
    kk.add(xCyl(rs, Math.min(X(a0), X(a1)), Math.max(X(a0), X(a1)), KB.y, KB.z), anod);
    // the knurled rise lock
    const ring = revolve([[0, 0], [rr - 0.6, 0], [rr, 0.6, 0.5, 1], [rr, b1 - b0 - 0.6, 0.5, 1], [rr - 0.6, b1 - b0], [0, b1 - b0]], { segs: 448, ribs: { n: 56, depth: 0.5, groove: 0.5, edge: 0.2 } });
    ring.applyMatrix4(new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0)));
    lockKnob(locks.rise, s, ring, petg, s > 0 ? T(b0, 0, 0) : T(-b0, 0, 0, 0, Math.PI, 0));
    // the tilt lock: five lobes (PETG), a bolt head in its middle
    const lobes = [];
    for (let i = 0; i <= 100; i++) { const a = (i / 100) * TAU, rad = r + (R - r) * Math.pow(0.5 + 0.5 * Math.cos(5 * a), 1.3); lobes.push([Math.cos(a) * rad, Math.sin(a) * rad]); }
    const fs = shapeXY(lobes); fs.holes.push(circle(0, 0, 3.0, true));
    const fl = slab(fs, c1 - c0, 1.2, 12, 0.3, 2);
    fl.applyMatrix4(new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 1, 0), new THREE.Vector3(-1, 0, 0)));
    lockKnob(locks.tilt, s, fl, petg, s > 0 ? T(c1, 0, 0) : T(-c1, 0, 0, 0, Math.PI, 0));
    kk.add(xCyl(3.5, Math.min(X(c0 + 2), X(c1 - 1)), Math.max(X(c0 + 2), X(c1 - 1)), KB.y, KB.z, 6), chrome);
  }
  kk.build(knobs);
  // the lens mount: the board's face (on the board); the lens's axis where the board's face sits in the panel (the
  // optics go by it, board or no board)
  const lensMount = new THREE.Group(); boardG.add(lensMount);
  const lensAxis = new THREE.Object3D(); panelG.add(lensAxis);
  // the bellows' front frame: on the panel's back
  const bellowsFront = new THREE.Object3D(); bellowsFront.position.set(0, 0, PN.z1 + 0.5); panelG.add(bellowsFront);
  return { group, swingG, shiftG, riseG, tiltG, panelG, uframe, boardG, lensMount, lensAxis, bellowsFront, wing, locks };
}

const DIM_BACK_WINDOW = DIM.back.window;

// ───────── Under the dark cloth, and the glass's own light ─────────
// Looking in under the cloth the only light is the ground glass's: the lens's image on it is about 1/110 as bright as
// the scene (a ground glass's gain ~1.6, the lens's transmission 0.9, over 4N² at the working f-number), and what it
// lights round it — the back's wood, the cloth's inside — falls off within a few centimetres. Every material of the
// camera multiplies its light by gwClothShade: 1 out in the daylight, and under the cloth that faint glow (from about
// a twentieth of a percent next to the glass to a fiftieth of that a hand's breadth away). The eye adapts to the glass
// (main.js's exposure), so the image is bright and everything round it nearly black, as under a real cloth.
const CLOTH_SHADE_GLSL = /* glsl */`
  uniform float gwUnder; uniform vec3 gwGlassPos;
  float gwClothShade(vec3 p) { return mix(1.0, 0.00005 + 0.001 * exp(-distance(p, gwGlassPos) / 0.08), gwUnder); }`;
/** The ground glass's picture (main.js: lensview.js's ground-glass pass, tone-mapped) back to its light: the inverse of
 *  that pass's curve, so the glass can glow at its real brightness in the scene's units. */
const GLASS_LINEAR_GLSL = /* glsl */`
  vec3 glassLinear(vec3 y) {
    y = clamp(y, 0.0, 0.995);
    vec3 a = 2.51 - 2.43 * y, b = 0.03 - 0.59 * y;
    return (-b + sqrt(max(b * b + 0.56 * a * y, 0.0))) / (2.0 * a) / 0.9;
  }`;
/** A camera material's light scaled by gwClothShade (idempotent: wraps whatever patch it already has). */
function shadeUnderCloth(mat, shade) {
  if (!mat || mat.userData.clothShade) return;
  if (!(mat.isMeshStandardMaterial || mat.isMeshBasicMaterial || mat.isMeshLambertMaterial || mat.isMeshPhongMaterial)) return;
  mat.userData.clothShade = true;
  const prev = mat.onBeforeCompile, prevKey = mat.customProgramCacheKey.bind(mat);
  mat.onBeforeCompile = (sh, r) => {
    prev?.call(mat, sh, r);
    Object.assign(sh.uniforms, shade);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vGwWorld;')
      .replace('#include <project_vertex>', '#include <project_vertex>\n  vGwWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\nvarying vec3 vGwWorld;\n${CLOTH_SHADE_GLSL}`)
      .replace('#include <opaque_fragment>', 'outgoingLight *= gwClothShade(vGwWorld);\n  #include <opaque_fragment>');
  };
  mat.customProgramCacheKey = () => `${prevKey()}|cloth`;
  mat.needsUpdate = true;
}
/** The frame's square light window as it shades the glass (camera-intrepid buildRearStandard: occ's uniforms). */
const WINDOW_LIGHT_GLSL = /* glsl */`
  uniform vec2 uTurn; uniform vec3 uLens; uniform float uLift, uPupil, uHolder; uniform vec4 uWin;
  float windowLight(vec2 P, float d) {
    vec2 Q = uLens.xy + (P - uLens.xy) * (uLens.z - d) / (uLens.z + uLift);
    vec2 e = abs(Q) - vec2(uWin.x - uWin.y);
    float sd = length(max(e, 0.0)) + min(max(e.x, e.y), 0.0) - uWin.y;
    float pen = 0.5 * uPupil * (d + uLift) / (uLens.z + uLift) + 0.25;
    return 1.0 - smoothstep(-pen, pen, sd);
  }
  vec2 glassToFrame(vec2 g) { return vec2(g.x * uTurn.x - g.y * uTurn.y, g.x * uTurn.y + g.y * uTurn.x); }
  // (a film holder sliding in under the glass from its −x side: its leading edge at uHolder, the glass dark behind it)
  float holderLight(vec2 g) { return smoothstep(uHolder - 0.8, uHolder + 0.8, g.x); }`;

// ───────── The focusing loupe ─────────
// A 6× loupe for the ground glass, a common power for 4×5: its skirt sits on the glass, its eyepiece 66 mm above;
// it shows a 28 mm circle of the glass at an apparent field of 37° (the eyepiece's 30 mm clear seen from 45 mm). Black,
// no markings. The eyepiece shows the loupe's own lens view (main.js), mapped to the place on the glass it stands on.
export const LOUPE = { power: 6, field: 28, skirt: 22.5, top: 66, eyeR: 15, eyeRelief: 45 };
function buildLoupe(lib, occ) {
  const g = new THREE.Group(); g.name = 'intrepidLoupe';
  const k = new Kit(), body = lib.get('anod'), cup = lib.get('petg');
  // the body: the skirt on the glass, the barrel, the knurled focusing ring, the eyecup (profile r, z about local z)
  k.add(revolve([[0, 0.4], [LOUPE.skirt - 0.6, 0.4], [LOUPE.skirt, 1.2, 0.6], [LOUPE.skirt - 0.8, 14], [19.5, 16.5, 0.6], [19.5, 40], [0, 40]], { segs: 72 }), body);
  k.add(revolve([[19.5, 40], [21, 40.5, 0.6, 1], [21, 54, 0.6, 1], [19.8, 55], [19.5, 55]], { segs: 480, ribs: { n: 60, depth: 0.45, groove: 0.5, edge: 0.2 } }), body);
  k.add(revolve([[19.5, 55], [22.5, 57, 0.4], [23.5, 63, 0.6], [22.5, LOUPE.top + 1.5, 0.6], [LOUPE.eyeR + 2, LOUPE.top + 1.2], [LOUPE.eyeR + 0.5, LOUPE.top], [0, LOUPE.top]], { segs: 72 }), cup);
  k.build(g);
  // the eyepiece: the glass magnified (a disc the eye looks into); honors map.repeat & map.offset UV transform!
  const discU = {
    uLoupeC: { value: new THREE.Vector2() }, uLoupeNow: { value: new THREE.Vector2() },
    uLoupeFrame: { value: new THREE.Vector2(1, 1) }, uLoupeK: { value: 0 },
    uMapRepeat: { value: new THREE.Vector2(1, 1) }, uMapOffset: { value: new THREE.Vector2(0, 0) },
  };
  // (a black placeholder until its lens view's first picture: the program never changes — AGENTS.md, defines recompile)
  const blank = new THREE.DataTexture(new Uint8Array(4), 1, 1); blank.needsUpdate = true;
  const discMat = new THREE.MeshBasicMaterial({ color: 0xffffff, map: blank, toneMapped: false });
  discMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, occ, discU);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vDisc;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n  vDisc = position.xy;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec2 vDisc;
      uniform vec2 uLoupeC, uLoupeNow, uLoupeFrame, uMapRepeat, uMapOffset; uniform float uLoupeK;
      ${GLASS_LINEAR_GLSL}
      ${WINDOW_LIGHT_GLSL}`)
      .replace('#include <map_fragment>', `
      // the place on the glass this point of the eyepiece shows (the glass's frame, mm), and in the loupe's picture
      vec2 gl = uLoupeNow + vDisc * ${(LOUPE.field / 2 / LOUPE.eyeR).toFixed(5)};
      vec2 F = glassToFrame(gl), Fc = glassToFrame(uLoupeC);
      vec2 luv = vec2(0.5 + (F.x - Fc.x) / uLoupeFrame.x, 0.5 - (F.y - Fc.y) / uLoupeFrame.y);
      #ifdef USE_MAP
        vec2 suv = clamp(luv, 0.0, 1.0) * uMapRepeat + uMapOffset;
        vec3 img = glassLinear(texture2D(map, suv).rgb) * uLoupeK * windowLight(F, uWin.z) * windowLight(F, uWin.w) * holderLight(gl);
      #else
        vec3 img = vec3(0.0);
      #endif
      // the glass's own frame round the image; the ½-inch grid etched on it; the eyepiece's field stop
      vec2 w = vec2(${(DIM_BACK_WINDOW.w / 2).toFixed(2)}, ${(DIM_BACK_WINDOW.h / 2).toFixed(2)});
      img *= step(abs(gl.x), w.x) * step(abs(gl.y), w.y);
      vec2 gq = abs(fract(gl / 12.7 + 0.5) - 0.5) * 12.7, aa = fwidth(gl) * 0.8;
      float line = max(1.0 - smoothstep(0.07, 0.07 + aa.x, gq.x), 1.0 - smoothstep(0.07, 0.07 + aa.y, gq.y));
      img *= 1.0 - 0.55 * line;
      img *= 1.0 - smoothstep(0.93, 1.0, length(vDisc) / ${LOUPE.eyeR.toFixed(1)});
      diffuseColor.rgb = img;`);
  };
  discMat.customProgramCacheKey = () => 'intrepid-loupe';
  const disc = new THREE.Mesh(new THREE.CircleGeometry(LOUPE.eyeR + 0.5, 72), discMat);
  disc.position.z = LOUPE.top + 0.05; disc.userData.noShadow = true; g.add(disc);
  g.visible = false;
  return { group: g, disc, discMat, discU, blank };
}

// ───────── The rear standard ─────────
function buildRearStandard(lib, hov, mats) {
  const P = DIM.arm.pivot, FR = DIM.frame, PL = DIM.plate, BK = DIM.back, SP = DIM.sidePlate, A = DIM.arm;
  const pivot = new THREE.Group(); pivot.name = 'intrepidRear'; pivot.position.set(0, P.y, P.z);
  const g = new THREE.Group(); g.position.set(0, -P.y, -P.z); pivot.add(g);
  const kF = new Kit(), kE = new Kit(), k = new Kit(), ks = new Kit();
  const anod = lib.get('anod'), chrome = lib.get('chrome'), flock = lib.get('flock'), petg = lib.get('petg');
  // the frame: birch, stepped — its front plies a narrow border round the bowed opening the bellows' plate sits in, its
  // back plies a square window for the light, which the back covers in either orientation
  const fr = rrPath(-FR.w / 2, FR.yB, FR.w / 2, FR.yT, FR.r);
  fr.holes.push(pillow(FR.open.w, FR.open.yB, FR.open.yT, FR.open.r, FR.open.bulge, true));
  birch(kF, mats.birchFace, kE, mats.birchEdge, xyPlate(fr, FR.zF, FR.step - FR.zF, 0.6, 0.6), 'z');
  const fr2 = rrPath(-FR.w / 2, FR.yB, FR.w / 2, FR.yT, FR.r);
  fr2.holes.push(rrPath(-FR.light.w / 2, -FR.light.h / 2, FR.light.w / 2, FR.light.h / 2, FR.light.r, new THREE.Path()));
  birch(kF, mats.birchFace, kE, mats.birchEdge, xyPlate(fr2, FR.step, FR.zB - FR.step, 0.3, 0.4), 'z');
  // the bellows' rear plate inside it (the bellows' end on its front), its four screws
  const pl = pillow(FR.open.w + 0.2, FR.open.yB - 0.1, FR.open.yT + 0.1, FR.open.r, FR.open.bulge);
  pl.holes.push(rrPath(-PL.w / 2 + 9, PL.yB + 9, PL.w / 2 - 9, PL.yT - 9, 5, new THREE.Path()));
  k.add(xyPlate(pl, PL.z, PL.t, 0.3, 0.4), anod);
  for (const [x, y] of PL.screws) for (const s of [-1, 1]) addScrew(ks, chrome, ks, flock, T(s * x, y, PL.z - 0.01, 0, Math.PI, 0), 1.5, true);
  // the side plates low on the frame's sides, carrying the pivot and the lock knob (the knob its own group: it turns)
  const locks = [];
  for (const s of [-1, 1]) {
    k.add(yzPlate(rrPath(SP.z0, SP.y0, SP.z1, SP.y1, 3), s > 0 ? SP.x : -SP.x - SP.t, SP.t, 0.4, 0.6), anod);
    for (const z of [-27, -22]) addScrew(ks, chrome, ks, flock, T(s * (SP.x + SP.t), SP.y1 - 4, z, 0, s * Math.PI / 2, 0), 1.1, false);
    // the lock knob: knurled, through the arm's slot into the side plate
    const kn = revolve([[0, 0], [A.knob.r - 0.8, 0], [A.knob.r, 0.8, 0.5, 1], [A.knob.r, A.knob.len - 1.2, 0.5, 1], [A.knob.r - 1.4, A.knob.len], [0, A.knob.len]], { segs: 432, ribs: { n: 54, depth: 0.5, groove: 0.5, edge: 0.2 } });
    kn.applyMatrix4(new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0)));
    { const gk = new THREE.Group(); gk.position.set(0, A.knob.y, A.knob.z); gk.userData.side = s; g.add(gk); locks.push(gk);
      const q = new Kit(); q.add(kn, petg, s > 0 ? T(A.x + A.t + 0.4, 0, 0) : T(-(A.x + A.t + 0.4), 0, 0, 0, Math.PI, 0)); q.build(gk); }
    k.add(xCyl(3, Math.min(s * SP.x, s * (A.x + A.t + 0.5)), Math.max(s * SP.x, s * (A.x + A.t + 0.5)), A.knob.y, A.knob.z, 12), chrome);
  }
  // the level on the frame's top
  const L = DIM.rearLevel, Lw = L.x1 - L.x0;
  const lc = (L.x0 + L.x1) / 2;
  k.add(rbox(Lw, 3.4, 6, 1.2, 3), petg, T(lc, FR.yT + 1.7, L.z));
  k.add(revolve([[0, 0], [2.1, 0], [2.1, Lw - 6], [0, Lw - 6]], { segs: 32 }), lib.get('levelLiquid'), T(lc - (Lw - 6) / 2, FR.yT + 3.6, L.z, 0, Math.PI / 2, 0));
  k.add(new THREE.SphereGeometry(1.6, 18, 12), lib.get('levelBubble'), T(lc, FR.yT + 4.1, L.z));
  kF.build(g); kE.build(g); k.build(g); ks.build(g);
  // ── the back: turns about the lens axis on its magnets
  const backRot = new THREE.Group(); g.add(backRot);
  const bF = new Kit(), bE = new Kit(), bk = new Kit(), bs = new Kit();
  // the birch plate to the seat (a hole for the light), its two rails either side of the holder's channel
  const bsh = rrPath(-BK.w / 2, -BK.h / 2, BK.w / 2, BK.h / 2, BK.r);
  bsh.holes.push(rrPath(-BK.gg.w / 2 - 1, -BK.gg.h / 2 - 1, BK.gg.w / 2 + 1, BK.gg.h / 2 + 1, 2, new THREE.Path()));
  birch(bF, mats.birchFace, bE, mats.birchEdge, xyPlate(bsh, BK.zF, BK.seat - BK.zF, 0.4, 0.6));
  for (const s of [-1, 1]) {
    const y0 = s > 0 ? BK.channel / 2 : -BK.h / 2, y1 = s > 0 ? BK.h / 2 : -BK.channel / 2;
    birch(bF, mats.birchFace, bE, mats.birchEdge, xyPlate(rrPath(-BK.w / 2, y0, BK.w / 2, y1, 3), BK.seat, BK.rail - BK.seat, 0.4, 0.6));
  }
  // the ground glass in its frame, in the channel on the seat (ggG: lifted back on its springs by a holder)
  const ggG = new THREE.Group(); ggG.name = 'groundGlass'; backRot.add(ggG);
  const gk = new Kit(), FM = BK.frame, x0 = -FM.l / 2, x1 = FM.l / 2, yh = FM.w / 2, nw = FM.notch.w / 2, nd = FM.notch.d, fR = FM.r;
  const frameOutline = () => {
    const p = new THREE.Shape();
    p.moveTo(x0 + fR, -yh); p.lineTo(x1 - fR, -yh); p.quadraticCurveTo(x1, -yh, x1, -yh + fR); p.lineTo(x1, yh - fR); p.quadraticCurveTo(x1, yh, x1 - fR, yh);
    p.lineTo(x0 + fR, yh); p.quadraticCurveTo(x0, yh, x0, yh - fR);
    // (the notch in the notch end)
    p.lineTo(x0, nw + 1.5); p.quadraticCurveTo(x0, nw, x0 + 1.5, nw); p.lineTo(x0 + nd - 1.5, nw); p.quadraticCurveTo(x0 + nd, nw, x0 + nd, nw - 1.5);
    p.lineTo(x0 + nd, -nw + 1.5); p.quadraticCurveTo(x0 + nd, -nw, x0 + nd - 1.5, -nw); p.lineTo(x0 + 1.5, -nw); p.quadraticCurveTo(x0, -nw, x0, -nw - 1.5);
    p.lineTo(x0, -yh + fR); p.quadraticCurveTo(x0, -yh, x0 + fR, -yh);
    return p;
  };
  // (its front lip round the image, the glass's well behind it)
  const lip = frameOutline(); lip.holes.push(rrPath(-BK.window.w / 2, -BK.window.h / 2, BK.window.w / 2, BK.window.h / 2, 1, new THREE.Path()));
  gk.add(xyPlate(lip, BK.seat, -BK.seat, 0.3, 0.3), petg);
  const well = frameOutline(); well.holes.push(rrPath(-FM.rear.w / 2, -FM.rear.h / 2, FM.rear.w / 2, FM.rear.h / 2, 2, new THREE.Path()));
  gk.add(xyPlate(well, 0, BK.zB, 0.3, 0.6), petg);
  // the glass round the image (its clipped corners show in the well; the image itself is the screen, below)
  const GG = BK.gg, gc = GG.clip, gw = GG.w / 2, gh = GG.h / 2;
  const glassRing = shapeXY([[-gw + gc, -gh], [gw - gc, -gh], [gw, -gh + gc], [gw, gh - gc], [gw - gc, gh], [-gw + gc, gh], [-gw, gh - gc], [-gw, -gh + gc]]);
  glassRing.holes.push(rrPath(-BK.window.w / 2, -BK.window.h / 2, BK.window.w / 2, BK.window.h / 2, 1, new THREE.Path()));
  gk.add(xyPlate(glassRing, 0, GG.t, 0.15, 0), lib.prepare(new THREE.MeshPhysicalMaterial({ name: 'ggEdge', color: 0x2a2e2c, roughness: 0.35, metalness: 0, specularIntensity: 0.8 })));
  // a smoothly filleted T-clip at each end over the glass's edge, screwed to the frame
  for (const s of [-1, 1]) {
    const tc = new THREE.Shape();
    const xI = s * (gw - 1.8), xM = s * (gw + 2.2), xO = s * (gw + 8.5), rc = 1.1;
    const pts = s > 0
      ? [[xI, -16], [xM, -16], [xM, -3.5], [xO, -3.5], [xO, 3.5], [xM, 3.5], [xM, 16], [xI, 16]]
      : [[xI, 16], [xM, 16], [xM, 3.5], [xO, 3.5], [xO, -3.5], [xM, -3.5], [xM, -16], [xI, -16]];
    for (let i = 0; i < pts.length; i++) {
      const P0 = pts[(i + pts.length - 1) % pts.length], P1 = pts[i], P2 = pts[(i + 1) % pts.length];
      const d1 = Math.hypot(P1[0] - P0[0], P1[1] - P0[1]), d2 = Math.hypot(P2[0] - P1[0], P2[1] - P1[1]);
      const rr = Math.min(rc, d1 * 0.4, d2 * 0.4);
      const ax = P1[0] - ((P1[0] - P0[0]) / d1) * rr, ay = P1[1] - ((P1[1] - P0[1]) / d1) * rr;
      const bx = P1[0] + ((P2[0] - P1[0]) / d2) * rr, by = P1[1] + ((P2[1] - P1[1]) / d2) * rr;
      if (i === 0) tc.moveTo(ax, ay); else tc.lineTo(ax, ay);
      tc.quadraticCurveTo(P1[0], P1[1], bx, by);
    }
    tc.closePath();
    gk.add(xyPlate(tc, BK.zB, 0.8, 0.22, 0.3), anod);
    addScrew(gk, chrome, gk, flock, T(s * (gw + 5.6), 0, BK.zB + 0.81), 1.1, true);
  }
  // the springs' lugs on the frame's long sides, at the middle
  for (const s of [-1, 1]) gk.add(rbox(10, 4, 5.5, 0.8, 2), petg, T(2, s * (yh + 1.6), BK.zB - 3.2));
  // ── DYNAMIC ELASTICALLY-BOWED CURVED LEAF SPRINGS (real Euler-Bernoulli cantilever beam curve, NOT a stiff straight stick!)
  const springs = [];
  const springMat = anod;
  const SP_SEG = 26, SP_HW = 3.8, SP_HT = 0.46; // 7.6 × 0.92 mm spring-steel ribbon
  const makeCurvedSpringMesh = () => {
    // 4-vertex rectangular cross-section swept along (SP_SEG + 1) stations + closed end caps
    const vCount = (SP_SEG + 1) * 4;
    const pos = new Float32Array(vCount * 3);
    const uv = new Float32Array(vCount * 2);
    const idx = [];
    for (let i = 0; i <= SP_SEG; i++) {
      const u = i / SP_SEG;
      for (let c = 0; c < 4; c++) { uv[(i * 4 + c) * 2] = u; uv[(i * 4 + c) * 2 + 1] = c / 3; }
      if (i < SP_SEG) {
        const b = i * 4, n = (i + 1) * 4;
        for (let c = 0; c < 4; c++) {
          const cn = (c + 1) % 4;
          idx.push(b + c, n + c, b + cn, b + cn, n + c, n + cn);
        }
      }
    }
    // End caps
    idx.push(0, 2, 1, 0, 3, 2);
    const e = SP_SEG * 4;
    idx.push(e, e + 1, e + 2, e, e + 2, e + 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.setAttribute('wear', new THREE.BufferAttribute(new Float32Array(vCount).fill(0.35), 1));
    return new THREE.Mesh(g, springMat);
  };
  for (const s of [-1, 1]) {
    const y = s * (BK.channel / 2 + 6.5);
    bk.add(rbox(16, 0.9, 8, 0.4, 2), springMat, T(72, y, BK.rail + 0.45));
    for (const x of [67, 77]) addScrew(bs, chrome, bs, flock, T(x, y, BK.rail + 0.91), 1.1, true);
    const arm = makeCurvedSpringMesh();
    backRot.add(arm);
    springs.push({ arm, a: new THREE.Vector3(64.5, y, BK.rail + 0.45), b: new THREE.Vector3(2, s * (yh + 1.6 + 0.4), BK.zB + 0.15) });
    // (the arm's end screwed to the lug)
    addScrew(gk, chrome, gk, flock, T(2, s * (yh + 1.6), BK.zB + 0.6), 1.0, true);
    bk.add(rbox(76, 1.4, 7, 0.4, 2), anod, T(-46, y, BK.rail + 0.7));
    for (const x of [-82, -10]) bk.add(rbox(4.5, 5.5, 3.5, 0.5, 2), anod, T(x, s * (BK.channel / 2 + 4.6), BK.rail + 2.9));
    for (const x of [-62, -30]) addScrew(bs, chrome, bs, flock, T(x, y, BK.rail + 1.41), 1.0, true);
  }
  gk.build(ggG);
  bF.build(backRot); bE.build(backRot); bk.build(backRot); bs.build(backRot);
  /** Dynamically flexes the curved cantilever leaf springs between clamped rail mount `a` and lifted frame lug `b`. */
  const setSprings = (lift) => springs.forEach(({ arm, a, b }) => {
    const pos = arm.geometry.attributes.position;
    const bz = b.z + lift;
    const arch = Math.max(0.8, 2.2 - lift * 0.08); // smooth tempered preload bow that flattens gently under film-holder load!
    for (let i = 0; i <= SP_SEG; i++) {
      const u = i / SP_SEG;
      // Cubic Hermite clamped cantilever curve: flat tangent at clamped end (u=0) & smooth seat onto lug (u=1)
      const h = u * u * (3 - 2 * u);
      const dh = 6 * u * (1 - u);
      const cx = lerp(a.x, b.x, u);
      const cy = lerp(a.y, b.y, h);
      const cz = lerp(a.z, bz, h) + arch * Math.sin(Math.PI * u);
      const dx = b.x - a.x;
      const dz = (bz - a.z) * dh + arch * Math.PI * Math.cos(Math.PI * u);
      const inv = 1 / Math.hypot(dx, dz);
      // Normal perpendicular to spring centerline in XZ plane (points +Z when dx < 0)
      const nx = dz * inv, nz = -dx * inv;
      const k = i * 4;
      // 4 corners around cross-section: (-y, -t), (+y, -t), (+y, +t), (-y, +t)
      pos.setXYZ(k + 0, cx - nx * SP_HT, cy - SP_HW, cz - nz * SP_HT);
      pos.setXYZ(k + 1, cx - nx * SP_HT, cy + SP_HW, cz - nz * SP_HT);
      pos.setXYZ(k + 2, cx + nx * SP_HT, cy + SP_HW, cz + nz * SP_HT);
      pos.setXYZ(k + 3, cx + nx * SP_HT, cy - SP_HW, cz + nz * SP_HT);
    }
    pos.needsUpdate = true;
    arm.geometry.computeVertexNormals();
  });
  setSprings(0);
  // the image: the lens's picture on the ground face, seen through the glass from behind (main.js's ground-glass
  // render, flipped top to bottom: upside down and reversed, as a view camera shows it); the ½-inch grid etched on it
  // The light reaches the glass through the frame's square window (128 × 128, its back face 8 mm in front of the film):
  // square to it, either way round, the frame clears it; turned between the two, the glass's corners swing past the
  // window's shadow and go dark. Each point of the glass is lit where the line from the lens to it clears the window's
  // back and front faces, the edge soft by the lens's pupil (penumbra = pupil × gap / distance).
  const occ = {
    uTurn: { value: new THREE.Vector2(1, 0) },          // the back's turn: cos, sin
    uLens: { value: new THREE.Vector3(0, 0, 150) },     // the lens over the frame (x, y) and its distance in front of the film, mm
    uLift: { value: 0 },                                // the glass behind the film plane (the back lifted to turn), mm
    uPupil: { value: 24 },                              // the lens's pupil wide open, mm
    uWin: { value: new THREE.Vector4(FR.light.w / 2, FR.light.r, -FR.zB, -FR.step) },   // half-width, corner radius, faces' depths
    uHolder: { value: -1e4 },                           // a film holder's leading edge under the glass (the back's x, mm)
  };
  // The glass is a matte surface and a glowing picture at once: daylight on its ground face (a few percent of it
  // scattered back) and the lens's image coming through it, at its real brightness (glassK: lensview.js ggShown.lum,
  // set by setScreenTexture). Out in the daylight the first swamps the second — the image is a ghost; under the cloth
  // (gwClothShade) only the image is left.
  const glassK = { value: 0 };
  const screenMat = new THREE.MeshStandardMaterial({ name: 'groundGlass', color: new THREE.Color(0.06, 0.06, 0.06), roughness: 0.95, metalness: 0, emissive: 0xffffff, toneMapped: false });
  screenMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, occ, mats.shade, { uGlassK: glassK });
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vGlass;\nvarying vec3 vGwWorld;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n  vGlass = position.xy;')
      .replace('#include <project_vertex>', '#include <project_vertex>\n  vGwWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec2 vGlass; varying vec3 vGwWorld;
      uniform float uGlassK;
      ${CLOTH_SHADE_GLSL}
      ${GLASS_LINEAR_GLSL}
      ${WINDOW_LIGHT_GLSL}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      vec2 P = glassToFrame(vGlass);
      totalEmissiveRadiance = glassLinear(totalEmissiveRadiance) * uGlassK * windowLight(P, uWin.z) * windowLight(P, uWin.w) * holderLight(vGlass);`)
      .replace('#include <opaque_fragment>', `outgoingLight = (outgoingLight - totalEmissiveRadiance) * gwClothShade(vGwWorld) + totalEmissiveRadiance;
      #include <opaque_fragment>`);
  };
  screenMat.customProgramCacheKey = () => 'intrepid-glass';
  mats.glassMat = screenMat;
  // (the render holds the 120 × 96 frame, stretched the hair to fill the back's window: no clamped edge shows)
  const ig = new THREE.PlaneGeometry(BK.window.w + 2, BK.window.h + 2);
  const uv = ig.attributes.uv, gp = ig.attributes.position;
  /** The picture on the glass with the back turned by theta: the lens's image stays where it is while the back turns
   *  (its mapping turns the other way), and the render is the frame on end (portrait) or not, taking in crop times the
   *  frame (wider while the back turns). Seen from behind, a point (X, Y) of the glass shows the render at
   *  (0.5 + X / w, 0.5 − Y / h) of the ground-glass picture (laterally reversed already): turned 180°, as a view camera
   *  shows it. */
  const mapScreen = (theta, portrait, crop = 1) => {
    const c = Math.cos(theta), sn = Math.sin(theta), fw = crop * (portrait ? BK.window.h : BK.window.w), fh = crop * (portrait ? BK.window.w : BK.window.h);
    const cl = (x) => Math.min(1, Math.max(0, x));
    for (let i = 0; i < gp.count; i++) {
      const x = gp.getX(i), y = gp.getY(i), X = x * c - y * sn, Y = x * sn + y * c;
      uv.setXY(i, cl(0.5 + X / fw), cl(0.5 - Y / fh));
    }
    uv.needsUpdate = true;
  };
  mapScreen(0, false);
  const screen = new THREE.Mesh(ig, screenMat); screen.position.z = 0.05; screen.userData.noShadow = true;
  ggG.add(screen);
  const grid = new THREE.Mesh(new THREE.PlaneGeometry(BK.gg.w, BK.gg.h), new THREE.MeshBasicMaterial({ map: ggGridTex(BK.gg.w, BK.gg.h), transparent: true, depthWrite: false, toneMapped: false }));
  grid.position.z = 0.1; grid.userData.noShadow = true; ggG.add(grid);
  // (no cover glass: you look at the ground glass's back, which shows no reflections worth drawing under the cloth)
  // the bellows' rear frame: on the plate's front
  const bellowsRear = new THREE.Object3D(); bellowsRear.position.set(0, (PL.yT + PL.yB) / 2, PL.z - 0.6); g.add(bellowsRear);
  return { pivot, frameG: g, backRot, ggG, setSprings, springMeshes: springs.map((s) => s.arm), screen, screenMat, occ, glassK, bellowsRear, mapScreen, locks };
}

// ───────── The lenses: 75–300 mm in Copal No. 0 / No. 1 shutters (frame F: board face at z = 0, lens along −Z) ─────────
const LENS_DEFS = {
  'lf-75-5.6': {
    L: 36.0, title: 'SUPER-WIDE', serial: '1418204', stripe: 0xd4a438, trumpet: true,
    shutter: { r: 25.4, ring: 28.8, ringZ: [-7.4, -12.5], front: -12.5 },
    front: { r: 35.0, neckR: 18.2, z: -36.0, bevel: 27.5, bore: 21.0, glassZ: -26.5 },
    rear: { r: 27.0, neckR: 17.5, z: 30.0, retainer: 21.5, trumpet: true }, iris: -7, hoodLen: 12.0,
  },
  'lf-90-5.6': {
    L: 40.0, title: 'WIDE-FIELD', serial: '1429518', stripe: 0xd4a438, trumpet: true,
    shutter: { r: 25.4, ring: 28.8, ringZ: [-7.4, -12.5], front: -12.5 },
    front: { r: 42.0, neckR: 18.8, z: -40.0, bevel: 34.0, bore: 26.0, glassZ: -29.0 },
    rear: { r: 30.0, neckR: 18.0, z: 32.0, retainer: 21.5, trumpet: true }, iris: -7, hoodLen: 14.0,
  },
  'lf-135-5.6': {
    L: 22.5, title: 'PLASMAT-W', serial: '1384712', stripe: 0x2fa85a, trumpet: false,
    shutter: { r: 25.4, ring: 28.8, ringZ: [-7.4, -12.5], front: -12.5 },
    front: { r: 22.5, neckR: 17.8, z: -22.5, bevel: 17.5, bore: 13.0, glassZ: -14.2 },
    rear: { r: 19.5, neckR: 17.2, z: 19.0, retainer: 21.5, trumpet: false }, iris: -7, hoodLen: 18.0,
  },
  'lf-150-6.3': {
    L: 17.5, title: 'COMPACT-T', serial: '1402819', stripe: 0xc8ccd2, trumpet: false,
    shutter: { r: 25.4, ring: 28.8, ringZ: [-7.4, -12.5], front: -12.5 },
    front: { r: 21.8, neckR: 17.8, z: -17.5, bevel: 16.0, bore: 11.5, glassZ: -10.0 },
    rear: { r: 18.0, neckR: 16.8, z: 20.5, retainer: 21.5, trumpet: false }, iris: -7, hoodLen: 20.0,
  },
  'lf-210-5.6': {
    // Copal No. 1 shutter (Ø 68 mm speed ring) + 72 mm hourglass Plasmat front cell
    L: 38.0, title: 'PLASMAT-W', serial: '1441093', stripe: 0x2fa85a, trumpet: true,
    shutter: { r: 30.2, ring: 34.0, ringZ: [-8.2, -14.2], front: -14.2 },
    front: { r: 37.5, neckR: 22.4, z: -38.0, bevel: 30.8, bore: 24.0, glassZ: -26.8 },
    rear: { r: 29.0, neckR: 21.5, z: 30.0, retainer: 25.0, trumpet: true }, iris: -8, hoodLen: 26.0,
  },
  'lf-300-9': {
    // Copal No. 1 shutter + compact 52 mm Apo-Tessar cell
    L: 27.0, title: 'APO-TESSAR', serial: '1456327', stripe: 0xc83228, trumpet: true,
    shutter: { r: 30.2, ring: 34.0, ringZ: [-8.2, -14.2], front: -14.2 },
    front: { r: 27.5, neckR: 21.2, z: -27.0, bevel: 22.0, bore: 17.0, glassZ: -18.5 },
    rear: { r: 23.0, neckR: 20.5, z: 23.0, retainer: 25.0, trumpet: false }, iris: -8, hoodLen: 32.0,
  },
};

/** Multi-element optical cutaway prescriptions ([zFrac 0..1 from front glass to rear glass, rFrac, thickMm, R1, R2]). */
const LF_OPTICS = {
  'lf-75-5.6': [
    [0.06, 0.96, 3.6, 1.35, -0.95], [0.18, 0.78, 2.2, 2.2, -1.1], [0.30, 0.62, 4.0, 1.6, 3.4], [0.40, 0.52, 2.0, 3.4, -2.2],
    [0.60, 0.52, 2.0, -2.2, 3.4], [0.70, 0.62, 4.0, 3.4, 1.6], [0.82, 0.78, 2.2, -1.1, 2.2], [0.94, 0.92, 3.6, -0.95, 1.35],
  ],
  'lf-90-5.6': [
    [0.06, 0.96, 4.0, 1.4, -0.95], [0.18, 0.80, 2.4, 2.3, -1.1], [0.30, 0.64, 4.2, 1.65, 3.6], [0.40, 0.54, 2.2, 3.6, -2.4],
    [0.60, 0.54, 2.2, -2.4, 3.6], [0.70, 0.64, 4.2, 3.6, 1.65], [0.82, 0.80, 2.4, -1.1, 2.3], [0.94, 0.94, 4.0, -0.95, 1.4],
  ],
  'lf-135-5.6': [
    [0.10, 0.95, 3.4, 2.0, -3.6], [0.26, 0.84, 2.8, 1.9, -2.4], [0.38, 0.74, 1.8, -2.4, 1.8],
    [0.62, 0.74, 1.8, 1.8, -2.4], [0.74, 0.84, 2.8, -2.4, 1.9], [0.90, 0.95, 3.4, -3.6, 2.0],
  ],
  'lf-150-6.3': [
    [0.12, 0.94, 3.6, 1.9, -3.2], [0.46, 0.72, 2.0, -2.0, 2.2], [0.88, 0.92, 3.4, -3.4, 2.0],
  ],
  'lf-210-5.6': [
    [0.09, 0.96, 4.4, 2.1, -3.8], [0.25, 0.86, 3.4, 1.95, -2.6], [0.37, 0.76, 2.0, -2.6, 1.85],
    [0.63, 0.76, 2.0, 1.85, -2.6], [0.75, 0.86, 3.4, -2.6, 1.95], [0.91, 0.96, 4.4, -3.8, 2.1],
  ],
  'lf-300-9': [
    [0.10, 0.94, 3.6, 2.0, -4.0], [0.34, 0.76, 2.0, -2.2, 2.4], [0.78, 0.82, 2.2, -3.0, -5.0], [0.88, 0.88, 3.8, -5.0, 2.2],
  ],
};

const lensDef = (lens) => LENS_DEFS[lens.id] || LENS_DEFS['lf-150-6.3'];
// the shutter's controls round its rim, seen from the front clockwise from the top (Copal's dimension drawing of the
// No. 0; Intrepid's front photograph of this lens in its No. 0, DSCF8409): the cocking lever at 12, its knurled disc
// travelling 45° clockwise as it is cocked (12 → 1:30: in the photograph it stands 28° clockwise of the release,
// clear of it); the release tab at 11 (a pale cap, a red ▼); the flash contact at 2; the press-focus lever at 3 (a
// black pointer, its tip 39 from the axis, swung 9°: up closed, down open, a red dot showing when it is open); the
// cable socket at 9; the aperture lever on its scale low down at 5.
// (A point at clock angle c is at(−c) below: phi counts the other way.)
const AP_ARC = 45 * DEG, AP_PHI0 = 118 * DEG;
const COCK_C = [0, 45], REL_C = -28, PF_C = 90, PF_SWING = 4.5, SYNC_C = 60, CABLE_C = 270;

function buildLens(lib, lens, hov, mats) {
  const def = lensDef(lens), S = def.shutter, Fr = def.front, Rr = def.rear;
  const group = new THREE.Group(); group.name = 'intrepidLens';
  const k = new Kit();
  const black = lib.get('lensBlack'), chrome = lib.get('chrome'), steel = lib.get('steel'), brass = lib.get('brass'), flock = lib.get('flock'), anod = lib.get('anod');
  const stripeMat = lib.prepare(new THREE.MeshPhysicalMaterial({ name: `lfStripe_${lens.id}`, color: def.stripe || 0xc8ccd2, metalness: 0.45, roughness: 0.28, clearcoat: 0.4 }), {});
  const rearGlassMat = createClearFrontGlass(lib, { name: 'lfRearGlass', color: 0x05090a, opacity: 0.11, iridescence: 0.78 });
  // ── 3D Copal Rear Mounting Threads + 6-Slot Spanner Retaining Jam-Nut + Sculpted Rear Optical Cell (Law #27!) ──
  const rThr = Rr.neckR || 17.5;
  // Machined finely grooved M39/M42 brass Copal shutter threads clearly visible emerging past the 6-slot steel jam-nut (z = 0..+6.4 mm)!
  const bThrProf = [[rThr - 0.5, 0], [rThr + 0.85, 0.2], [rThr + 0.85, 3.9]];
  for (let i = 0; i < 4; i++) {
    const zt = 4.0 + i * 0.58;
    bThrProf.push([rThr + 1.05, zt + 0.14], [rThr + 0.55, zt + 0.34], [rThr + 1.05, zt + 0.52]);
  }
  bThrProf.push([rThr + 0.85, 6.4], [rThr - 0.5, 6.6]);
  k.add(revolve(bThrProf, { segs: 72, crease: 22 }), brass);
  // Iconic 6-slot spanner-notched Copal retaining flange jam-nut clamping the shutter to the Technika board (z = +1.4..+3.8 mm)
  k.add(revolve([[rThr + 0.75, 1.4], [Rr.retainer + 1.8, 1.4, 0.25], [Rr.retainer + 1.8, 3.8, 0.25], [rThr + 0.75, 3.8]], { segs: 72, crease: 26 }), steel);
  for (let i = 0; i < 6; i++) {
    const a = (i * 60 + 15) * DEG;
    k.add(rbox(2.4, 1.6, 2.7, 0.15, 1), flock, T(Math.cos(a) * (Rr.retainer + 1.2), Math.sin(a) * (Rr.retainer + 1.2), 2.6, 0, 0, a));
  }
  // Sculpted rear optical cell: symmetrical flared Biogon/Plasmat rear trumpet on 75/90/210, compact cylinder on 135/150/300!
  const rRearGlass = Math.max(11.0, Math.min(Rr.r - 4.2, Fr.bore * 0.88));
  if (Rr.trumpet) {
    const zMidR = lerp(6.4, Rr.z, 0.42);
    k.add(revolve([
      [rThr - 0.4, 6.1], [rThr, 6.4], [rThr + 1.2, 9.0, 0.5], [Rr.r, zMidR, 0.6],
      [Rr.r, Rr.z - 1.4, 0.4], [Rr.r - 1.6, Rr.z], [rRearGlass + 0.8, Rr.z - 1.2], [rRearGlass, Rr.z - 0.8],
    ], { segs: 72, crease: 28 }), black);
  } else {
    k.add(revolve([
      [rThr - 0.4, 6.1], [Rr.r, 6.5, 0.4], [Rr.r, Rr.z - 1.4, 0.35], [Rr.r - 1.8, Rr.z], [rRearGlass + 0.8, Rr.z - 1.0], [rRearGlass, Rr.z - 0.7],
    ], { segs: 72, crease: 28 }), black);
  }
  // Rear cell retaining ring + clear multicoated convex rear meniscus glass (light passes straight through open Copal shutter!)
  k.add(revolve([[rRearGlass + 0.7, Rr.z - 0.6], [rRearGlass, Rr.z - 0.3], [rRearGlass, Rr.z - 1.2]], { segs: 48 }), anod);
  const rearGlassMesh = new THREE.Mesh(prep(revolve([[rRearGlass, Rr.z - 0.65], [rRearGlass * 0.74, Rr.z + 0.1], [rRearGlass * 0.38, Rr.z + 0.8], [0, Rr.z + 1.15]], { segs: 48 })), rearGlassMat);
  rearGlassMesh.renderOrder = 2;
  rearGlassMesh.userData.noShadow = true;
  group.add(rearGlassMesh);

  // Clear multicoated front glass revealing REAL 3D 5-blade Copal leaf shutter + 7/9-blade iris diaphragm inside!
  const oSpec = lensOpticsFor(lens);
  const glassMat = createClearFrontGlass(lib, { name: 'lfFrontGlass', color: 0x05080a, opacity: 0.11, iridescence: 0.78 });
  // the shutter's body; its speed ring (knurled rim segs=6*72=432!, a red ▼ on its front edge)
  const at = (phi, r, z) => T(Math.sin(phi) * r, Math.cos(phi) * r, z, 0, 0, -phi);
  k.add(revolve([[S.r - 0.4, S.ringZ[0]], [S.r, S.ringZ[0] + 0.4, 0.4], [S.r, 0, 0.3]], { segs: 72 }), black);
  const speed = new THREE.Group(); group.add(speed);
  const sk = new Kit();
  sk.add(revolve([[S.ring - 0.5, S.ringZ[1]], [S.ring, S.ringZ[1] + 0.5, 0.4, 1], [S.ring, S.ringZ[0] - 0.5, 0.4, 1], [S.ring - 0.5, S.ringZ[0]]], { segs: 432, ribs: { n: 72, depth: 0.42, groove: 0.5, edge: 0.2 } }), lib.get('lensBlack', { hover: hov.shutter }));
  const faceMat = lib.prepare(new THREE.MeshPhysicalMaterial({ name: `lfSpeedFace_${lens.shutter || 'copal-0'}`, map: lens.shutter === 'copal-1' ? mats.speedFace1 : mats.speedFace, roughness: 0.45, metalness: 0.1 }), { hover: hov.shutter });
  const neckR = Fr.neckR || 18.2;
  const faceSpan = 2 * (S.ring + 0.2);
  const face = new THREE.RingGeometry(Math.min(19.5, neckR - 0.4), S.ring - 1.7, 96, 1);
  { const p = face.attributes.position, uv = face.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, 0.5 + p.getX(i) / faceSpan, 0.5 + p.getY(i) / faceSpan); }
  face.rotateY(Math.PI);
  k.add(face, faceMat, T(0, 0, S.ringZ[1] - 0.01));
  sk.add(revolve([[S.ring - 1.7, S.ringZ[1]], [S.ring - 0.5, S.ringZ[1]]], { segs: 96 }), lib.get('lensBlack', { hover: hov.shutter }));
  sk.add(xyPlate(shapeXY([[-0.95, 0.75], [0.95, 0.75], [0, -0.75]]), -0.12, 0.12, 0, 0), lib.get('red'), at(0, S.ring - 0.95, S.ringZ[1] - 0.02));
  const speedMeshes = sk.build(speed, 'shutter');
  // the front plate inside the scale (sits strictly inside the Copal scale inner radius!)
  k.add(revolve([[19.5, S.ringZ[1] - 0.1], [neckR, S.ringZ[1] - 0.1]], { segs: 64 }), black);
  // ── Sculpted Large-Format Front Optical Cell: Hourglass/Trumpet Biogon & Plasmat Profiles Clearing the Copal Shutter! ──
  if (def.trumpet) {
    // Narrow neck leaving the entire Copal shutter face & controls unobstructed, flaring smoothly into a classic wide-field/Plasmat trumpet!
    const zClear = S.front - 4.2, zFlare = lerp(zClear, Fr.z, 0.52);
    k.add(revolve([
      [Fr.r - 0.8, Fr.z], [Fr.r, Fr.z + 0.8, 0.55], [Fr.r, zFlare, 0.6],
      [lerp(neckR, Fr.r, 0.35), zClear - 1.6, 0.55], [neckR, zClear, 0.4], [neckR, S.front],
    ], { segs: 96, crease: 28 }), black);
    // Iconic circumferential optical-line color stripe (gold on 75/90 Super-Wide, green on 210 Plasmat, crimson on 300 Apo-Tessar!)
    k.add(revolve([[Fr.r + 0.04, Fr.z + 3.2], [Fr.r + 0.14, Fr.z + 3.4, 0.15], [Fr.r + 0.14, Fr.z + 4.9, 0.15], [Fr.r + 0.04, Fr.z + 5.1]], { segs: 96 }), stripeMat);
  } else {
    // Compact stepped Plasmat (135/5.6) & Triplet (150/6.3) front barrels w/ crisp brand accent stripe
    k.add(revolve([[Fr.r - 0.7, Fr.z], [Fr.r, Fr.z + 0.7, 0.55], [Fr.r, S.front - 2.4, 0.4], [neckR, S.front - 0.4, 0.3], [neckR, S.front]], { segs: 96, crease: 28 }), black);
    k.add(revolve([[Fr.r + 0.04, Fr.z + 2.2], [Fr.r + 0.12, Fr.z + 2.4, 0.12], [Fr.r + 0.12, Fr.z + 3.3, 0.12], [Fr.r + 0.04, Fr.z + 3.5]], { segs: 96 }), stripeMat);
  }
  // Subtle exposed bright machined aluminum filter-mouth rim chamfer + stepped internal filter thread grooves
  k.add(revolve([[Fr.r - 0.85, Fr.z + 0.25], [Fr.r - 0.55, Fr.z - 0.02]], { segs: 96 }), steel);
  const lfThr = [];
  for (let i = 0; i < 4; i++) {
    const zt = Fr.z + 0.35 + i * 0.42;
    lfThr.push([Fr.r - 0.8, zt], [Fr.r - 1.1, zt + 0.2], [Fr.r - 0.8, zt + 0.4]);
  }
  k.add(revolve(lfThr, { segs: 84, crease: 20 }), flock);
  // Dynamically UV-scaled front engraved optical nameplate bevel (fixes /48 clipping on ALL 6 lenses!)
  const bevel = revolve([[Fr.bevel, Fr.z + 2.2], [Fr.r - 0.8, Fr.z + 0.35]], { segs: 96 });
  { const p = bevel.attributes.position, uv = bevel.attributes.uv, spanUv = 2 * Fr.r; for (let i = 0; i < p.count; i++) uv.setXY(i, 0.5 - p.getX(i) / spanUv, 0.5 + p.getY(i) / spanUv); }
  const nameMat = lib.prepare(new THREE.MeshPhysicalMaterial({ name: `lfNameRing_${lens.id}`, map: nameRingTex(lens), roughness: 0.35, metalness: 0.12 }), {});
  k.add(bevel, nameMat);
  const bore = [[Fr.bore, Fr.glassZ - 0.3]];
  for (let i = 0; i < 5; i++) { const t0 = i / 5, t1 = (i + 1) / 5, r0 = lerp(Fr.bore, Fr.bevel, t0), r1 = lerp(Fr.bore, Fr.bevel, t1), z0 = lerp(Fr.glassZ - 0.3, Fr.z + 2.2, t0), z1 = lerp(Fr.glassZ - 0.3, Fr.z + 2.2, t1); bore.push([r1 - 0.35, (z0 + z1) / 2], [r1, z1]); void r0; }
  k.add(revolve(bore.reverse(), { segs: 72 }), lib.get('lensBlack'));
  // Machined front-element retaining ring + dual opposing spanner-wrench notches (180° apart!)
  k.add(revolve([[Fr.bore + 0.5, Fr.glassZ - 0.75], [Fr.bore - 0.55, Fr.glassZ - 0.75, 0.15], [Fr.bore - 0.55, Fr.glassZ]], { segs: 72 }), black);
  [-1, 1].forEach((s) => k.add(rbox(1.6, 0.65, 0.5, 0.08, 1), flock, T(s * (Fr.bore + 0.1), 0, Fr.glassZ - 0.85)));
  // Hollow stepped anti-reflection inner optical barrel from front glass down to the Copal shutter & iris chamber
  const rCopalOut = Math.min(S.r - 1.6, Math.max(Fr.bore + 2.0, neckR - 0.8));
  const irisBlades = lens.shutter === 'copal-1' ? 9 : 7;
  const irisSpec = computeIrisSpec({ blades: irisBlades, rOut: rCopalOut, glassR: Math.min(Fr.bore, rCopalOut * 0.75), rMinScale: 0.055 });
  k.add(buildSteppedBaffleTube(Fr.bore - 0.1, Fr.glassZ, irisSpec.rFixed + 0.35, def.iris - 1.2, 4), flock);
  k.add(buildSteppedBaffleTube(irisSpec.rFixed + 0.35, def.iris + 1.4, rRearGlass - 0.1, Rr.z - 1.0, 3), flock);
  // Real 3D 5-blade Copal leaf shutter (CLOSED when Press-Focus is off; opens on Press-Focus or fire()!) + 7/9-blade iris diaphragm!
  const copalShutter = createLeafShutter(lib, { rOut: rCopalOut, matName: 'copalLeafBlade', color: 0x262a30, metalness: 0.46, roughness: 0.38 });
  const zShutter = def.iris - 0.85;
  copalShutter.inst.position.z = zShutter;
  group.add(copalShutter.inst);
  const iris = createIrisDiaphragm(lib, irisSpec, { matName: 'copalIrisBlade', color: 0x5c646f, metalness: 0.48, roughness: 0.38, intMat: flock });
  const { group: irisGroup, fixedIris, irisInst, jawInst } = iris;
  const zIris = def.iris + 0.85;
  irisGroup.position.z = zIris;
  group.add(irisGroup);
  const syncOptics = (rIris, leafK, isCut = false) => {
    copalShutter.sync(leafK);
    iris.sync(rIris, isCut);
  };
  syncOptics(irisSpec.rMax, 1, false);
  // Standalone local-origin front meniscus glass mesh (Law #17!)
  const glassMesh = new THREE.Mesh(prep(revolve([[0, Fr.glassZ - 1.8], [Fr.bore * 0.38, Fr.glassZ - 1.55], [Fr.bore * 0.72, Fr.glassZ - 0.95], [Fr.bore + 0.1, Fr.glassZ]], { segs: 64 })), glassMat);
  glassMesh.renderOrder = 2;
  glassMesh.userData.noShadow = true;
  group.add(glassMesh);
  // the cocking lever: a black arm out past the ring, a knurled chrome disc (segs = 8*30 = 240!) on its end facing forward
  const cock = new THREE.Group(); group.add(cock);
  const ck = new Kit();
  ck.add(xyPlate(rrPath(-4, S.r - 2, 4, S.ring + 8.5, 2.5), S.ringZ[0] + 0.2, 1.8, 0.4, 0.5), black);
  ck.add(revolve([[0, 0], [4.6, 0, 0.3, 1], [4.6, 7.8, 0.4, 1], [4.0, 8.6], [0, 8.6]], { segs: 240, ribs: { n: 30, depth: 0.3, groove: 0.5, edge: 0.15 } }), chrome, T(0, S.ring + 5.6, S.ringZ[0] - 0.2, Math.PI, 0, 0));
  ck.build(cock);
  // the release at 11: a short black arm, a sculpted curved pale cap with a red ▼ on it (pressed, it swings a few degrees)
  const rel = new THREE.Group(); group.add(rel);
  const rk = new Kit(), relM = lib.get('lensBlack', { hover: hov.release }), relAt = at(-REL_C * DEG, 0, 0);
  rk.add(xyPlate(rrPath(-2, S.r - 1, 2, S.ring + 3.5, 1.2), S.ringZ[0] - 0.3, 1.4, 0.35, 0.4), relM, relAt);
  rk.add(rbox(5.4, 5.8, 2.4, 1.2, 3), lib.get('white', { hover: hov.release }), relAt.clone().multiply(T(0, S.ring + 5.2, S.ringZ[0] - 0.6)));
  rk.add(xyPlate(shapeXY([[-1.3, 1.1], [1.3, 1.1], [0, -1.2]]), -0.2, 0.2, 0, 0), lib.get('red'), relAt.clone().multiply(T(0, S.ring + 5.4, S.ringZ[0] - 1.85)));
  const releaseMeshes = rk.build(rel, 'release');
  // the press-focus lever at 3: a housing on the body, a sculpted curved black pointer swung in front of it (NO flat 4-vertex trapezoid!)
  k.add(rbox(9, 7, 5, 1.2, 3), black, at(-PF_C * DEG, S.r + 1.5, S.ringZ[0] + 2.4));
  k.add(new THREE.CylinderGeometry(0.9, 0.9, 0.3, 28).rotateX(Math.PI / 2), lib.get('red'), at(-(PF_C - 7) * DEG, S.r + 3.1, S.ringZ[0] - 0.12));
  const pf = new THREE.Group(); group.add(pf);
  const pk = new Kit();
  const pfS = new THREE.Shape();
  pfS.moveTo(-4.4, 0);
  pfS.bezierCurveTo(-4.2, 3.6, -2.0, 7.6, -1.1, 10.6);
  pfS.quadraticCurveTo(0, 12.0, 1.1, 10.6);
  pfS.bezierCurveTo(2.0, 7.6, 4.2, 3.6, 4.4, 0);
  pfS.closePath();
  pk.add(xyPlate(pfS, -0.6, 1.2, 0.35, 0.4), lib.get('lensBlack', { hover: hov.pressFocus }), at(-PF_C * DEG, S.ring - 1, S.ringZ[0] - 1.0));
  const pressMeshes = pk.build(pf, 'pressFocus');
  // the flash contact at 2: a chrome pin on a black boss
  k.add(rbox(4.5, 4, 3, 1.0, 3), black, at(-SYNC_C * DEG, S.ring + 1.8, S.ringZ[0] + 0.8));
  k.add(revolve([[1.0, 0], [1.0, 3.6, 0.2], [0.6, 4], [0, 4]], { segs: 28 }), chrome, at(-SYNC_C * DEG, S.ring + 1.8, S.ringZ[0] - 0.7).multiply(T(0, 0, 0, Math.PI, 0, 0)));
  // the cable socket at 9, a threaded chrome post (segs = 8*20 = 160!) on a three-lobed plate, angled out and forward
  const lobes = []; for (let i = 0; i <= 72; i++) { const a = (i / 72) * TAU, r = 3.2 + 1.6 * Math.max(0, Math.cos(3 * a)) ** 2; lobes.push([Math.cos(a) * r, Math.sin(a) * r]); }
  k.add(xyPlate(shapeXY(lobes), -0.8, 0.8, 0.22, 0.4), chrome, at(-CABLE_C * DEG, S.ring + 2, S.ringZ[0] - 0.6));
  k.add(revolve([[2.3, 0, 0.25, 1], [2.3, 7, 0.3, 1], [1.6, 7.4], [1.0, 7.4], [1.0, 3]], { segs: 160, ribs: { n: 20, depth: 0.16, groove: 0.5, edge: 0.12 } }), chrome, at(-CABLE_C * DEG, S.ring + 2, S.ringZ[0] - 1.4).multiply(T(0, 0, 0, Math.PI * 0.75, 0, 0)));
  // the aperture scale on a sector low on the left (seen from the front: five o'clock), dynamically UV-scaled to Copal No. 0 & No. 1!
  const apSpan = 2 * (S.ring + 7.2);
  const sector = revolve([[S.ring + 6.5, S.ringZ[0] - 0.1], [S.ring - 0.3, S.ringZ[0] - 0.1]], { segs: 40, phi0: -(AP_PHI0 + AP_ARC + 6 * DEG), phiLen: AP_ARC + 12 * DEG });
  { const p = sector.attributes.position, uv = sector.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, 0.5 - p.getX(i) / apSpan, 0.5 + p.getY(i) / apSpan); }
  k.add(sector, lib.prepare(new THREE.MeshPhysicalMaterial({ name: 'lfApScale', map: apScaleTex(lens.apertureStops, S.ring), roughness: 0.45, metalness: 0.1 }), {}));
  k.add(revolve([[S.ring - 0.3, S.ringZ[0] + 1.5], [S.ring + 6.5, S.ringZ[0] + 1.5], [S.ring + 6.5, S.ringZ[0]], [S.ring - 0.3, S.ringZ[0]]].reverse(), { segs: 40, phi0: -(AP_PHI0 + AP_ARC + 6 * DEG), phiLen: AP_ARC + 12 * DEG }), black);
  const apLever = new THREE.Group(); group.add(apLever);
  const ak = new Kit();
  const apTab = new THREE.Shape();
  apTab.moveTo(-1.8, -5.2);
  apTab.bezierCurveTo(-2.1, -1.5, -2.3, 2.2, -1.6, 4.6);
  apTab.quadraticCurveTo(0, 5.8, 1.6, 4.6);
  apTab.bezierCurveTo(2.3, 2.2, 2.1, -1.5, 1.8, -5.2);
  apTab.quadraticCurveTo(0, -5.8, -1.8, -5.2);
  ak.add(xyPlate(apTab, S.ringZ[0] - 2.6, 2.4, 0.65, 0.45), lib.get('lensBlack', { hover: hov.aperture }), T(0, S.ring + 3.5, 0));
  ak.add(rbox(0.8, 3, 0.3, 0.1, 1), lib.get('white'), T(0, S.ring + 3.0, S.ringZ[0] - 2.65));
  addScrew(ak, chrome, ak, flock, T(0, S.ring + 6.3, S.ringZ[0] - 2.6, 0, Math.PI, 0), 1.3, false);
  const apertureMeshes = ak.build(apLever, 'aperture');
  k.build(group);
  // Multi-element optical cutaway inside the Copal shutter & lens cells (built lazily when cutaway is enabled)
  const inner = new THREE.Group(); inner.visible = false; group.add(inner);
  let innerBuilt = false;
  const ensureInner = () => {
    if (innerBuilt) return false;
    innerBuilt = true;
    const ik = new Kit();
    const spec = LF_OPTICS[lens.id] || LF_OPTICS['lf-150-6.3'];
    const gInner = lib.get('innerGlass');
    const rimBlack = lib.get('anod');
    const zStart = Fr.glassZ + 1.0, zEnd = Rr.z - 1.0;
    spec.forEach(([zf, rf, th, R1, R2]) => {
      const z0 = lerp(zStart, zEnd, zf), r = Math.max(6.0, Fr.bore * rf);
      const sag1 = (r * r) / (2 * R1 * r * 1.45), sag2 = (r * r) / (2 * R2 * r * 1.45);
      const prof = [];
      for (let i = 0; i <= 8; i++) { const u = i / 8, rr = r * u; prof.push([rr, z0 - th * 0.5 + sag1 * u * u]); }
      for (let i = 8; i >= 0; i--) { const u = i / 8, rr = r * u; prof.push([rr, z0 + th * 0.5 + sag2 * u * u]); }
      ik.add(revolve(prof, { segs: 48 }), gInner);
      ik.add(revolve([[r, z0 - th * 0.5 + sag1], [r + 0.7, z0 - th * 0.5 + sag1], [r + 0.7, z0 + th * 0.5 + sag2], [r, z0 + th * 0.5 + sag2]], { segs: 48 }), rimBlack);
    });
    ik.build(inner);
    return true;
  };
  // Screw-in lens shade (built lazily on first use, w/ internal light-trap ribs!)
  const hoodGroup = new THREE.Group(); hoodGroup.visible = false; group.add(hoodGroup);
  let hoodBuilt = false;
  const ensureHood = () => {
    if (hoodBuilt) return false;
    hoodBuilt = true;
    const hk = new Kit(), hl = def.hoodLen || 18, rBase = Fr.r - 0.5, rTip = rBase + hl * 0.34;
    hk.add(revolve([[rTip - 0.6, Fr.z - hl], [rTip, Fr.z - hl + 0.5, 0.5], [rBase + 0.4, Fr.z + 0.5], [rBase - 1.0, Fr.z + 0.5], [rTip - 1.2, Fr.z - hl + 0.8], [rTip - 0.6, Fr.z - hl]], { segs: 84, crease: 30 }), lib.get('anod'));
    hk.add(revolve([[rBase - 1.0, Fr.z + 0.4], [rTip - 1.25, Fr.z - hl + 0.9]], { segs: 72 }), flock);
    hk.build(hoodGroup);
    return true;
  };
  // Screw-in optical filter on the front cell (segs = 8*64 = 512 -> zero moiré!)
  const filterGroup = new THREE.Group(); filterGroup.visible = false; group.add(filterGroup);
  const filterMat = new THREE.MeshPhysicalMaterial({ name: `lfFilter_${lens.id}`, color: 0xffffff, roughness: 0.03, transparent: true, opacity: 0.34, depthWrite: false });
  lib.prepare(filterMat, {});
  const filterMeshes = [];
  let filterBuilt = false;
  const ensureFilter = () => {
    if (filterBuilt) return false;
    filterBuilt = true;
    const flk = new Kit(), ft = Fr.r - 0.7;
    flk.add(revolve([[ft - 0.8, Fr.z - 4.8], [ft + 0.8, Fr.z - 4.8, 0.4, 1], [ft + 0.8, Fr.z - 0.4, 0.4, 1], [ft - 0.8, Fr.z], [ft - 0.8, Fr.z + 1.2]], { segs: 512, crease: 30, ribs: { n: 64, depth: 0.22 } }), lib.get('anod', { hover: hov.filter }));
    flk.add(new THREE.CircleGeometry(ft - 1.1, 48), filterMat, T(0, 0, Fr.z - 3.0, 0, Math.PI, 0));
    filterMeshes.push(...flk.build(filterGroup, 'filter'));
    return true;
  };
  return { group, lens, def, L: def.L, irisSpec, irisGroup, irisInst, fixedIris, jawInst, shutterInst: copalShutter.inst, syncOptics, zIris, zShutter, glassMesh, rearGlassMesh, pupilMag: oSpec.pupilMag ?? 1.0, focalMm: oSpec.focalCalMm || lens.focalLength || 150, speed, apLever, cock, rel, pf, inner, hoodGroup, filterGroup, filterMat, ensureInner, ensureHood, ensureFilter, speedMeshes, apertureMeshes, releaseMeshes, pressMeshes, filterMeshes };
}

// ───────── The camera ─────────
const PARTS = ['focus', 'aperture', 'shutter', 'filter', 'release', 'pressFocus', 'slide', 'finder', 'aim', 'roll'];

export function createCameraIntrepid({ lens }) {
  const t0 = performance.now();
  const clipPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 1e7);
  const base = baseMaterials();
  const P = (o) => new THREE.MeshPhysicalMaterial(o);
  // the materials: birch ply (oiled: a little sheen), the anodised black aluminium (matte, a soft edge), PETG printed
  // parts (black, faintly glossy), the bellows' black vinyl
  const faceTex = birchFaceTex(), edgeTex = birchEdgeTex();
  base.birchFace = P({ name: 'birchFace', color: 0xffffff, map: faceTex, bumpMap: faceTex.userData.bump, bumpScale: 0.35, roughness: 0.56, metalness: 0, clearcoat: 0.22, clearcoatRoughness: 0.42, sheen: 0.15, sheenColor: 0x6e5a40 });
  const faceTexH = faceTex.clone(); faceTexH.rotation = Math.PI / 2; faceTexH.needsUpdate = true;
  const bumpH = faceTex.userData.bump.clone(); bumpH.rotation = Math.PI / 2; bumpH.needsUpdate = true;
  base.birchFaceH = base.birchFace.clone(); base.birchFaceH.name = 'birchFaceH'; base.birchFaceH.map = faceTexH; base.birchFaceH.bumpMap = bumpH;
  base.birchEdge = P({ name: 'birchEdge', color: 0xffffff, map: edgeTex, roughness: 0.74, metalness: 0, clearcoat: 0.08, clearcoatRoughness: 0.6 });
  base.anod = P({ name: 'anod', color: 0x17171a, metalness: 0.45, roughness: 0.5, specularIntensity: 0.8 });
  base.anod.userData.wear = 'anodSatin';
  base.petg = P({ name: 'petg', color: 0x0d0d0e, metalness: 0, roughness: 0.38, specularIntensity: 0.6, clearcoat: 0.3, clearcoatRoughness: 0.35 });
  base.petg.userData.wear = 'print';
  base.bellows = P({ name: 'bellows', color: 0x121214, metalness: 0, roughness: 0.48, specularIntensity: 0.6, sheen: 0.5, sheenRoughness: 0.45, sheenColor: 0x3a3a3e, side: THREE.DoubleSide });
  const lib = new MatLib(base, [clipPlane]);
  const mats = {
    birchFace: lib.get('birchFace'), birchFaceH: lib.get('birchFaceH'), birchEdge: lib.get('birchEdge'),
    speedFace: speedFaceTex('No. 0', 28.8), speedFace1: speedFaceTex('No. 1', 34.0), nameRing: null, rule: ruleTex(),
    riseScaleR: riseScaleTex(true), riseScaleL: riseScaleTex(false),
    // (under the dark cloth: how far under, and where the glass is — CLOTH_SHADE_GLSL)
    shade: { gwUnder: { value: 0 }, gwGlassPos: { value: new THREE.Vector3() } },
  };
  const hov = {};
  PARTS.forEach((name) => { hov[name] = { name, amount: { value: 0 }, color: { value: new THREE.Color(1.0, 0.82, 0.5).multiplyScalar(0.28) }, target: 0 }; });

  const root = new THREE.Group();
  // (named as the 503's root is: the Studio finds the camera on its tripod by this name)
  root.name = 'camera503';
  root.userData.kind = 'intrepid';
  const tripod = buildTripod(lib, DIM.tripod);
  root.add(tripod.group);
  const head = buildHead(lib, hov);
  const yaw = new THREE.Group(); yaw.position.y = tripod.top; yaw.add(head.yawMM);
  const pitch = new THREE.Group(); pitch.position.y = head.pitchY; pitch.add(head.pitchMM); yaw.add(pitch);
  const rollG = new THREE.Group(); rollG.position.y = head.rollY; head.rollMM.position.y = -head.rollY; rollG.add(head.rollMM); pitch.add(rollG);
  root.add(yaw);
  const mm = new THREE.Group(); mm.scale.setScalar(0.001); rollG.add(mm);

  const baseP = buildBase(lib, hov);
  const carriage = buildCarriage(lib, hov, mats);
  const front = buildFrontStandard(lib, hov, mats);
  const rear = buildRearStandard(lib, hov, mats);
  // the carriage carries the front standard (frame F rides with it)
  const fFrame = new THREE.Group(); fFrame.name = 'intrepidF';
  fFrame.add(carriage.group, front.group);
  mm.add(baseP.group, fFrame, rear.pivot);
  mats.nameRing = nameRingTex(lens);
  let L = buildLens(lib, lens, hov, mats);
  front.lensMount.add(L.group);
  // the bellows between the panel's back and the rear plate: 14 pleats (the photographs), each half-pleat 11 mm of
  // cloth, so they lie nearly flat at the full 300 mm
  // (the ends inside the openings by a pleat's depth: the outer folds reach the rear frame's opening and the panel's
  // width, as in the photographs)
  const bellows = createBellows({ front: { w: 98, h: 98, r: 6 }, rear: { w: 146, h: 148, r: 9 }, pleats: 14, fold: 11, sag: 1.0, maxExt: 300, material: lib.get('bellows'), seed: 9 });
  bellows.mesh.name = 'intrepidBellows';
  mm.add(bellows.mesh);
  // the dark cloth: black, a soft sheen (draped over idle frames after load: darkcloth.js); the loupe, kept off the glass
  const clothMat = lib.prepare(new THREE.MeshPhysicalMaterial({ name: 'darkCloth', color: 0x0c0c0d, roughness: 0.9, metalness: 0, sheen: 0.8, sheenRoughness: 0.6, sheenColor: 0x2c2c30, specularIntensity: 0.3 }));
  const cloth = createDarkCloth(DIM, clothMat);
  rear.frameG.add(cloth.mesh);
  const loupe = buildLoupe(lib, rear.occ);
  rear.backRot.add(loupe.group);
  // a double film holder, built lazily when first inserted (rides on the back, turning with it)
  const holderGroup = new THREE.Group(); holderGroup.name = 'filmHolder'; holderGroup.visible = false;
  rear.backRot.add(holderGroup);
  const holder = { group: holderGroup, slides: [], built: false };
  // on the head's plate by the ¼″ bush
  mm.position.set(-DIM.socket.x / 1000, (head.plateTop - DIM.base.y0) / 1000 - head.rollY, -DIM.socket.z / 1000);

  // a soft contact shadow under the tripod
  const blobCv = canvas(128, 128), bg = blobCv.getContext('2d'), grad = bg.createRadialGradient(64, 64, 2, 64, 64, 64);
  grad.addColorStop(0, 'rgba(0,0,0,0.42)'); grad.addColorStop(0.5, 'rgba(0,0,0,0.16)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
  bg.fillStyle = grad; bg.fillRect(0, 0, 128, 128);
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(blobCv), transparent: true, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2; blob.position.y = 0.012; blob.renderOrder = -1; blob.userData.noShadow = true;
  root.add(blob);

  const lensLists = (Lx) => [Lx.speedMeshes, Lx.apertureMeshes, Lx.releaseMeshes, Lx.pressMeshes, Lx.filterMeshes];
  const lensDyn = (Lx) => [Lx.group, Lx.speed, Lx.apLever, Lx.cock, Lx.rel, Lx.pf, Lx.inner, Lx.hoodGroup, Lx.filterGroup, Lx.glassMesh, Lx.rearGlassMesh, Lx.irisGroup, Lx.irisInst, Lx.fixedIris, Lx.jawInst, Lx.shutterInst].filter(Boolean);
  const camDyn = [
    mm, baseP.group, fFrame, carriage.group, carriage.wheel,
    front.group, front.swingG, front.shiftG, front.riseG, front.tiltG, front.wing, front.boardG, front.lensMount,
    ...front.locks.rise, ...front.locks.tilt,
    rear.pivot, rear.backRot, rear.ggG, rear.screen, ...rear.locks, ...rear.springMeshes,
    cloth.mesh, loupe.group, holder.group,
    bellows.mesh, head.yawMM, head.pitchMM, head.rollMM, head.bubble, blob,
  ];
  mergeStaticRigid(root, { dynamic: new Set([...camDyn, ...lensDyn(L)]), lists: [...lensLists(L), carriage.wheelMeshes, head.aimMeshes, head.rollMeshes] });
  const toLayer = (obj) => obj.traverse((o) => {
    if (!o.isMesh) return;
    o.layers.set(1);
    o.castShadow = !o.userData.noShadow && !o.material.transparent; o.receiveShadow = !o.userData.noShadow;
  });
  toLayer(root);
  // every material of the camera dims under the cloth, but the glass's and the loupe's pictures (their own light)
  const shadeAll = () => root.traverse((o) => { if (o.isMesh && o.material !== rear.screenMat && o.material !== loupe.discMat) shadeUnderCloth(o.material, mats.shade); });
  shadeAll();

  const backMeshes = [rear.screen];
  // (the holder: anywhere on it works its dark slide; populated lazily when inserted)
  const holderMeshes = [];
  const ensureHolder = () => {
    if (holder.built) return false;
    holder.built = true;
    const h = buildHolder(lib);
    while (h.group.children.length) holder.group.add(h.group.children[0]);
    holder.slides = h.slides;
    holder.group.traverse((o) => {
      if (!o.isMesh) return;
      o.userData.part = 'slide';
      holderMeshes.push(o);
      shadeUnderCloth(o.material, mats.shade);
    });
    toLayer(holder.group);
    return true;
  };
  const pickables = { focus: carriage.wheelMeshes, aperture: [], shutter: [], filter: [], release: [], pressFocus: [], slide: holderMeshes, finder: backMeshes, aim: head.aimMeshes, roll: head.rollMeshes };
  function refreshPickables() {
    const set = (k, list) => { pickables[k].length = 0; if (list) pickables[k].push(...list); };
    set('aperture', L.apertureMeshes); set('shutter', L.speedMeshes); set('filter', L.filterMeshes); set('release', L.releaseMeshes); set('pressFocus', L.pressMeshes);
  }
  refreshPickables();

  const st = {
    ext: 0, extT: 0, ap: 0, apT: 0, sp: 0, spT: 0, wheel: 0, press: 0, cocked: 0,
    hoodOn: false, filterId: 'none', polAngle: 90,
    rise: 0, shift: 0, tilt: 0, swing: 0, rearTilt: 0, backRot: 0, backLift: 0, turning: false, turnFrom: false, turnCover: 1, insert: null,
    cloth: 0, clothOver: 0, under: 0, loupeK: 0, lx: 0, ly: 0, lxR: 0, lyR: 0,
    // the shutter held open for focusing (pf: its lever, pfT where it is going; firing opens the blades too) and the
    // film holder: hK in (0 out of the camera, 1 seated), its side toward the lens, each slide out (sK) and turned (sT)
    pf: 1, pfT: 1, firing: 0, hK: 0, side: 0, sK: [0, 0], sT: [0, 0], ggLift: 0, lumGlass: 0, lumLoupe: 0,
    lensOut: 0, explodeK: 0, snapRings: true,
    // folding (fold()): the lens off on its board (lensOff), the mount screw undone (wing); free: the front standard off
    // its mount, standing or lying on the carriage — turned forward by fTh, its foot (the channel's front edge) at fZc
    // along the carriage's top — and the carriage at cz; the rear folded forward by foldA (0 up, 1 flat); fanK: the
    // bellows drawn as a fan between frames at an angle
    lock: { rise: 0, tilt: 0, rear: 0, wing: 0 },
    lensOff: 0, wing: 0, free: false, fTh: 0, fZc: 0, cz: 0, foldA: 0, fanK: 0, folded: false, folding: false,
  };
  const tweens = [];
  const tween = (dur, fn, ease = easeInOut, key = null) => new Promise((res) => tweens.push({ t: 0, dur: Math.max(1e-3, dur), fn, ease, res, key }));
  const hold = (ms) => tween(Math.max(1e-3, ms / 1000), () => {}, (u) => u);
  const LOCK_TURN = 0.6 * TAU, lockHold = { rise: 0, tilt: 0, rear: 0, wing: 0 }, lockPrev = { rise: 0, tilt: 0, rear: 0, wing: 0 };
  const animate = (key, to, dur, ease) => {
    for (let i = tweens.length - 1; i >= 0; i--) if (tweens[i].key === key) { const [tw] = tweens.splice(i, 1); tw.res(); }
    const from = st[key];
    return tween(dur, (k) => { st[key] = lerp(from, to, k); }, ease, key);
  };

  /** The bellows' extension beyond infinity (mm) to focus at d metres from the film: the thin lens, exactly
   *  (v = (s − √(s² − 4fs)) / 2 with s the object-to-film distance; the extension v − f). */
  const extFor = (ln, d) => {
    if (!(d < 1000)) return 0;
    const f = lensOpticsFor(ln).focalCalMm || ln.focalLength, s = Math.max(d * 1000, 4.02 * f);
    return (s - Math.sqrt(s * s - 4 * f * s)) / 2 - f;
  };
  const distAt = (ln, ext) => {
    if (ext <= 0.02) return 10000;
    const f = lensOpticsFor(ln).focalCalMm || ln.focalLength, v = f + ext;
    return (f * v / (v - f) + v) / 1000;
  };
  let live = null;
  function ringTargets(s) {
    const ln = L.lens;
    const d = Math.max(s.focus ?? 10000, ln.minFocusDistance);
    st.extT = extFor(ln, d);
    const ap = ln.apertureStops, last = ap.length - 1;
    let N = typeof s.aperture === 'number' && s.aperture > 0 ? s.aperture : null;
    if (N == null) { const ai = Math.min(last, Math.max(0, s.apertureIdx ?? 0)), i0 = Math.floor(ai), i1 = Math.min(last, i0 + 1); N = ap[i0] * Math.pow(ap[i1] / ap[i0], ai - i0); }
    N = Math.min(ap[last], Math.max(ap[0], N));
    st.apT = Math.log2(N / ap[0]) / Math.log2(ap[last] / ap[0]);
    // the speed ring turns its ▼ (built at the top) to the speed set (the page's index j counts from 1 s, as the
    // shutter's speeds do; speed j is drawn at SPEED_A0 + SPEED_DA·(9 − j) degrees clockwise from the top)
    st.spT = (SPEED_A0 + SPEED_DA * (9 - (s.shutterIdx ?? 7))) * DEG;
  }

  // the front standard's place: its board's face the lens's flange focal distance plus the extension in front of the
  // film. It is screwed to the carriage at one of the brass inserts, chosen per lens so that at infinity the carriage
  // sits back under the rear standard with room to rack forward (Intrepid's guide: a mount per range of focal lengths)
  const flangeOf = (ln) => ln.flangeFocal ?? ln.focalLength;
  const CA = DIM.carriage, REAR_LIMIT = -14 - (CA.z1 - CA.z0) - DIM.wheel.len;
  const insertFor = (ln) => {
    // (with the standard on the insert d behind the front one, the carriage's front is at board + z0 − d: the nearest
    // insert that keeps the carriage on the plate at infinity, so it has the most room to rack forward)
    if (st.insert != null) return CA.inserts[st.insert] - CA.inserts[0];
    const zb = -flangeOf(ln);
    for (const d of CA.inserts) if (zb + CA.z0 - (d - CA.inserts[0]) <= REAR_LIMIT) return d - CA.inserts[0];
    return CA.inserts[CA.inserts.length - 1] - CA.inserts[0];
  };
  // ── folding (Intrepid's quickstart guide: "Packing away", "Setting up"; its unfolding animations) ──
  // Off its mount the front standard stands or lies on the carriage, rocking on its foot, the channel's front edge
  // (frame F: y CH.yB, z CH.z0). Turned forward by th with the foot at z on the carriage's top, frame F's origin is the
  // foot plus FOOT turned by −th. Packed away it is pressed to the rear with the bellows squeezed between them, its
  // board's face Z_UP: there, folded flat with the rear, its channel lies on the carriage. Folding, the two stay
  // parallel and that far apart while its foot rocks back along the carriage (FOLD_FOOT): it slides 19 mm up the rear
  // frame on the way down, as it must to clear the carriage.
  const CH = DIM.channel, PV = DIM.arm.pivot, Y_TOP = DIM.carriage.y1;
  const FOOT = { y: -CH.yB, z: -CH.z0 };
  const Z_UP = Y_TOP - PV.y - CH.z0 + PV.z;
  const FOLD_H = PV.y - Y_TOP;
  const FOLD_FOOT = (th) => PV.z - FOLD_H * Math.cos(th) / (1 + Math.sin(th));
  // the carriage racked right back (its front at REAR_LIMIT); the panel pushed down as far as it goes; where the front's
  // foot is pulled to while the rear comes up (the fan in Intrepid's animation: the bellows' far edge about as far
  // from the hinge as the rear's top)
  const C_REAR = REAR_LIMIT - CA.z0, FALL = -30, PULL = -70;
  const _m = new THREE.Matrix4(), _inv = new THREE.Matrix4(), _rM = new THREE.Matrix4(), _fM = new THREE.Matrix4();
  const _lp = new THREE.Vector3(), _lmP = new THREE.Vector3(), _lmA = new THREE.Vector3();
  const _lmQ1 = new THREE.Quaternion(), _lmQ2 = new THREE.Quaternion();
  const _ggBack = new THREE.Vector3(), _ggUp = new THREE.Vector3(), _ggQ = new THREE.Quaternion(), _ggQb = new THREE.Quaternion();
  const _ldQ = new THREE.Quaternion(), _ldR = new THREE.Vector3(), _ldU = new THREE.Vector3(), _cutNorm = new THREE.Vector3(0, 1, 0);
  // (the back on end: the film portrait — the lens view's frame and the glass's mapping turn at the same angle)
  // (through a turn the lens view keeps the shape it had — the wider field covers the glass either way — and takes the
  //  new one when the back is down)
  const isPortrait = () => (st.turning ? st.turnFrom : Math.abs(Math.sin(st.backRot)) > Math.SQRT1_2);
  let shownTurn = 0, turnId = 0, clothAge = 0;
  // (the glass's rear face, where the loupe's skirt sits: the ground face is the film plane, the glass 2.5 mm thick)
  const LOUPE_SEAT = 2.6;
  const _eye = new THREE.Vector3();
  // the holder in its seat: its face on the back's seat, FILM in front of its sheet, the sheet's centre (the window
  // between the flap and the band) on the lens's axis; out of the camera it stands clear of the back's side
  const HOLDER_Z = HOLDER.T / 2 - HOLDER.film;
  const HOLDER_SEAT_X = ((-HOLDER.L / 2 + HOLDER.flap) + (HOLDER.L / 2 - HOLDER.band)) / 2;
  const HOLDER_TRAVEL = DIM.back.w / 2 + HOLDER.L / 2 + HOLDER_SEAT_X + 25;
  const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
  // (what the glass's picture holds: its shape and the part of the lens's image it takes in — lensview.js ggShown)
  let shownShape = { portrait: false, crop: 1 };
  function applyPose() {
    const e = easeInOut(st.explodeK);
    const zBoard = -(flangeOf(L.lens) + st.ext), ins = insertFor(L.lens);
    // (the front standard at the board, screwed to the carriage, which sits behind it by the insert's distance; or off
    // its mount, on its foot — folding)
    fFrame.position.set(0, 0, -40 * e);
    if (st.free) {
      const c = Math.cos(st.fTh), s = Math.sin(st.fTh);
      front.group.position.set(0, Y_TOP + FOOT.y * c + FOOT.z * s, st.fZc - FOOT.y * s + FOOT.z * c);
      front.group.rotation.x = -st.fTh;
      carriage.group.position.z = st.cz;
    } else {
      front.group.position.set(0, 0, zBoard);
      front.group.rotation.x = 0;
      carriage.group.position.z = zBoard - ins;
    }
    front.swingG.rotation.y = -st.swing;   // (+ the lens looks to the right)
    front.shiftG.position.x = -DIM.wing.x + st.shift;
    front.riseG.position.y = st.rise;
    front.tiltG.rotation.x = -st.tilt;   // (+ the top forward: the lens looks down)
    // the mount screw undone (three turns, rising out of its insert); the lens off on its board: drawn out of the
    // panel's recess, then away
    front.wing.rotation.y = -(st.wing * 3 + st.lock.wing * 0.5) * TAU;
    front.wing.position.y = CH.yT + 1.2 * st.wing + 0.2 * st.lock.wing;
    // the lock knobs: slackened (a little over half a turn) while their movement is being set, nipped up after it
    for (const gk of front.locks.rise) gk.rotation.x = gk.userData.side * LOCK_TURN * st.lock.rise;
    for (const gk of front.locks.tilt) gk.rotation.x = gk.userData.side * LOCK_TURN * st.lock.tilt;
    for (const gk of rear.locks) gk.rotation.x = gk.userData.side * LOCK_TURN * st.lock.rear;
    const b1 = smooth(0, 0.3, st.lensOff), b2 = smooth(0.3, 1, st.lensOff);
    front.boardG.position.set(0, -50 * b2, -(8 * b1 + 170 * b2));
    front.boardG.visible = st.lensOff < 0.999;
    rear.pivot.rotation.x = st.rearTilt - (Math.PI / 2) * st.foldA;
    rear.backRot.rotation.z = st.backRot;
    rear.backRot.position.z = 30 * e + st.backLift;
    if (st.backRot !== shownTurn) { shownTurn = st.backRot; rear.mapScreen(st.backRot, shownShape.portrait, shownShape.crop); }
    rear.occ.uTurn.value.set(Math.cos(st.backRot), Math.sin(st.backRot));
    rear.occ.uLift.value = rear.backRot.position.z;
    // the loupe on the glass (set down from a little above; riding up onto the glass's frame near its edge)
    loupe.group.visible = st.loupeK > 0.001 && e < 0.5;
    if (loupe.group.visible) {
      const W2 = DIM.back.window.w / 2, H2 = DIM.back.window.h / 2, over = Math.max(Math.abs(st.lx) - (W2 - LOUPE.skirt), Math.abs(st.ly) - (H2 - LOUPE.skirt), 0);
      loupe.group.position.set(st.lx, st.ly, LOUPE_SEAT + (over > 0 ? DIM.back.zB - DIM.back.gg.t : 0) + 30 * (1 - st.loupeK) ** 2);
      loupe.discU.uLoupeNow.value.set(st.lx, st.ly);
    }
    L.group.position.z = -60 * e - 70 * st.lensOut;
    // (the focus wheel turns with the carriage: its lead screw's lead per turn)
    carriage.wheel.rotation.z = ((carriage.group.position.z + ins + flangeOf(L.lens)) / FOCUS_PITCH) * TAU;
    L.speed.rotation.z = st.sp;
    L.apLever.rotation.z = AP_PHI0 + st.ap * AP_ARC;
    L.rel.rotation.z = 6 * st.press * DEG;
    L.cock.rotation.z = lerp(COCK_C[0], COCK_C[1], st.cocked) * DEG;
    L.pf.rotation.z = (st.pf * 2 - 1) * PF_SWING * DEG;
    // the holder: brought up to the back's side, slid in along it to its seat (the sheet's centre on the axis), the
    // glass lifted back on its springs as the holder's end reaches it; each slide out and turned
    const holderVis = st.hK > 0.001 && e < 0.5;
    if (holderVis) ensureHolder();
    holder.group.visible = holderVis;
    if (holderVis) {
      const a = smooth(0, 0.3, st.hK), b = smooth(0.3, 1, st.hK);
      // (in at the notch end, −X: the slide's end trailing, the flap's leading; side B toward the lens: turned over)
      holder.group.position.set(HOLDER_SEAT_X - HOLDER_TRAVEL * (1 - b) - 40 * (1 - a), 0, HOLDER_Z + 80 * (1 - a) ** 2);
      holder.group.rotation.set(st.side ? Math.PI : 0, 0, Math.PI);
      holder.slides.forEach((sl, i) => { sl.out(st.sK[i]); sl.turn(st.sT[i]); });
      // (its leading end — the flap's — over the glass: the light shut off behind it)
      rear.occ.uHolder.value = holder.group.position.x + HOLDER.L / 2;
    } else rear.occ.uHolder.value = -1e4;
    const edge = holder.group.visible ? holder.group.position.x + HOLDER.L / 2 : -1e4;
    st.ggLift = (HOLDER.T + HOLDER.ridge.h) * smooth(-DIM.back.frame.l / 2 - 6, -DIM.back.frame.l / 2 + 3, edge);
    rear.ggG.position.z = st.ggLift;
    rear.setSprings(st.ggLift);
    rear.occ.uLift.value = rear.backRot.position.z + st.ggLift;
    // the bellows between the two frames (in the mm group's space)
    bellows.mesh.visible = e < 0.5;
    if (bellows.mesh.visible) {
      mm.updateMatrixWorld(true);
      _inv.copy(mm.matrixWorld).invert();
      _rM.copy(_inv).multiply(rear.bellowsRear.matrixWorld);
      _fM.copy(_inv).multiply(front.bellowsFront.matrixWorld);
      bellows.update(_rM, _fM, st.fanK);
      // (the lens over the frame, for the light window's shadow on the glass)
      const lp = rear.frameG.worldToLocal(front.lensAxis.localToWorld(_lp.set(0, 0, L.def.iris)));
      rear.occ.uLens.value.set(lp.x, lp.y, Math.max(-lp.z, 20));
      rear.occ.uPupil.value = L.lens.focalLength / L.lens.maxAperture;
    }
    if (cutaway && L.ensureInner?.()) toLayer(L.inner);
    if (L.inner) L.inner.visible = cutaway;
    if (st.hoodOn && L.ensureHood?.()) { toLayer(L.hoodGroup); shadeAll(); }
    if (L.hoodGroup) L.hoodGroup.visible = Boolean(st.hoodOn);
    if (st.filterId !== 'none' && L.ensureFilter?.()) { toLayer(L.filterGroup); shadeAll(); refreshPickables(); }
    if (L.filterGroup) {
      L.filterGroup.visible = st.filterId !== 'none';
      if (L.filterGroup.visible) {
        const tint = filterOpticsFor(st.filterId)?.ggTint || [1, 1, 1];
        L.filterMat.color.setRGB(Math.min(1, tint[0]), Math.min(1, tint[1]), Math.min(1, tint[2]));
        L.filterGroup.rotation.z = st.filterId === 'polarizer' ? (st.polAngle ?? 90) * DEG : 0;
      }
    }
    // Sync loupe texture UV transform, under-cloth dimming & glass/loupe brightness immediately on applyPose()!
    const lm = loupe.discMat.map;
    if (lm && lm !== loupe.blank) {
      loupe.discU.uMapRepeat.value.copy(lm.repeat);
      loupe.discU.uMapOffset.value.copy(lm.offset);
    } else {
      loupe.discU.uMapRepeat.value.set(1, 1);
      loupe.discU.uMapOffset.value.set(0, 0);
    }
    mats.shade.gwUnder.value = st.under < 0.001 ? 0 : st.under;
    rear.backRot.getWorldPosition(mats.shade.gwGlassPos.value);
    const leafOpen = Math.max(st.pf, st.firing);
    const blades = leafOpen * (1 - st.lensOff);
    {
      const stops = L.lens.apertureStops, N = stops[0] * (stops[stops.length - 1] / stops[0]) ** st.ap;
      const rIris = L.irisSpec.rMax * (stops[0] / Math.max(stops[0], N));
      L.syncOptics(rIris, leafOpen, cutaway);
    }
    rear.glassK.value = st.lumGlass * blades;
    loupe.discU.uLoupeK.value = st.lumLoupe * blades;
  }

  // ───────── Cutaway ─────────
  let cutaway = false;
  function setCutaway(on) {
    cutaway = on;
    if (!on) clipPlane.set(_cutNorm, 1e7);
    else if (L.ensureInner?.()) toLayer(L.inner);
    if (L.inner) L.inner.visible = cutaway;
  }

  const lensCache = new Map();
  const anchor = (parent, x, y, z, text, sub) => { const o = new THREE.Object3D(); o.position.set(x, y, z); parent.add(o); return { o, text, sub }; };
  let labels = [], labelEls = null, dotEls = null, labelsShown = null;
  const _labelV = new THREE.Vector3();
  function buildLabels() {
    labels.forEach((l) => l.o.parent?.remove(l.o));
    const shNo = L.lens.shutter === 'copal-1' ? 'No. 1' : 'No. 0';
    const shMax = L.lens.shutter === 'copal-1' ? '1/400' : '1/500';
    labels = [
      anchor(front.lensMount, 0, 36, -L.L / 2, 'Lens', `${L.lens.focalLength} mm in a ${shNo} leaf shutter · T, B, 1 s to ${shMax}`),
      anchor(front.uframe, 0, -80, 0, 'Front standard', 'rise 42 · fall 30 · shift ±30 · tilt and swing ±45°'),
      anchor(rear.frameG, 0, DIM.frame.yT + 8, -16, 'Rear standard', 'tilts ±30° · folds forward flat'),
      anchor(rear.backRot, 0, 40, 6, 'Ground glass', 'the picture upside down and reversed · a ½-inch grid'),
      anchor(baseP.group, 0, -124, -60, 'Base', 'linear guides · focused from the back'),
    ];
  }
  buildLabels();

  const tmpQ = new THREE.Quaternion();
  const api = {
    root, opticsMoving: false, cutSide: 1, pickables, buildMs: 0, st, timeScale: 1, applyPose,
    setAim(pan, tilt, roll = 0) { yaw.rotation.y = -Math.PI / 2 + pan; pitch.rotation.x = tilt; rollG.rotation.z = roll; root.updateMatrixWorld(true); },
    bodyCenter(v) { return mm.localToWorld(v.set(0, -10, -90)); },
    worldToBody(v) { return mm.worldToLocal(v); },
    setRings(s) {
      live = s; ringTargets(s);
      if (s.hoodOn !== undefined) st.hoodOn = Boolean(s.hoodOn);
      if (s.filter !== undefined) st.filterId = (typeof s.filter === 'string' ? s.filter : s.filter?.id) || 'none';
      if (s.polAngle !== undefined) st.polAngle = s.polAngle ?? 90;
      if (st.snapRings) { st.ext = st.extT; st.ap = st.apT; st.sp = st.spT; st.snapRings = false; }
    },
    /** The movements, in mm and radians: rise (+ up, − fall), shift (+ to the right), tilt (+ the top forward), swing
     *  (+ the lens looks to the right), rearTilt (+ the top back), backRot (0 landscape, π/2 portrait).
     *  Pass optional `dur > 0` seconds to smoothly tween movements instead of snapping immediately. */
    setMovements(m = {}, dur = 0) {
      const c = (v, a, b) => Math.min(b, Math.max(a, v));
      const targets = {};
      if (m.rise !== undefined) targets.rise = c(m.rise, -30, 42);
      if (m.shift !== undefined) targets.shift = c(m.shift, -30, 30);
      if (m.tilt !== undefined) targets.tilt = c(m.tilt, -45 * DEG, 45 * DEG);
      if (m.swing !== undefined) targets.swing = c(m.swing, -45 * DEG, 45 * DEG);
      // (the rear: forward until it folds flat, back as far as the arm's slot allows)
      if (m.rearTilt !== undefined) targets.rearTilt = c(m.rearTilt, -(DIM.arm.slot[1] - 13) * DEG, (DIM.arm.slot[0] * -1 + 13) * DEG);
      if (m.backRot !== undefined) targets.backRot = m.backRot;
      if (m.insert !== undefined) st.insert = m.insert;
      if (dur > 0) return Promise.all(Object.entries(targets).map(([k, v]) => animate(k, v, dur)));
      Object.assign(st, targets);
      applyPose();
    },
    setHood(on) { st.hoodOn = Boolean(on); if (live) live.hoodOn = st.hoodOn; if (st.hoodOn && L.ensureHood?.()) { toLayer(L.hoodGroup); shadeAll(); } if (L.hoodGroup) L.hoodGroup.visible = st.hoodOn; },
    setFilter(filterId, polAngle = st.polAngle) { st.filterId = filterId || 'none'; st.polAngle = polAngle; if (live) { live.filter = st.filterId; live.polAngle = polAngle; } if (st.filterId !== 'none' && L.ensureFilter?.()) { toLayer(L.filterGroup); shadeAll(); refreshPickables(); } },
    get hoodOn() { return Boolean(st.hoodOn); },
    get hasHood() { return true; },
    /** From the entrance pupil back to the film plane, in metres. */
    filmOffset() {
      const a = front.lensAxis.localToWorld(new THREE.Vector3(0, 0, L.def.iris)), b = mm.localToWorld(new THREE.Vector3(0, 0, 0));
      return a.distanceTo(b);
    },
    /** The lens view's eye at the lens, looking square out of the film: a view camera's picture is the film's, whatever
     *  the lens does (the rear's tilt changes it, the back's turn stands the frame on end; the lens's rise, shift, tilt
     *  and swing are lensMovements()). */
    lensPose(pos, quat) {
      front.lensAxis.updateWorldMatrix(true, false); rear.frameG.updateWorldMatrix(true, false);
      pos.copy(front.lensAxis.localToWorld(_lp.set(0, 0, L.def.iris)));
      // (upright: with the back turned, the frame is on end — lensMovements' portrait — not on its side)
      rollG.getWorldQuaternion(quat).multiply(rear.pivot.quaternion);
    },
    /** The movements in the film's frame, for the lens view (lensview.js setMovements): the lens's distance in front of
     *  the film along its normal, where it stands over the film's centre, its axis toward the film; mm. */
    lensMovements() {
      front.lensAxis.updateWorldMatrix(true, false); rear.frameG.updateWorldMatrix(true, false);
      const p = rear.frameG.worldToLocal(front.lensAxis.localToWorld(_lmP.set(0, 0, L.def.iris)));
      const a = _lmA.set(0, 0, 1)
        .applyQuaternion(front.lensAxis.getWorldQuaternion(_lmQ1))
        .applyQuaternion(rear.frameG.getWorldQuaternion(_lmQ2).invert());
      return { D: -p.z, ox: p.x, oy: p.y, ax: a.x, ay: a.y, az: a.z, eye: 260, portrait: isPortrait() };
    },
    /** Turn the back: lifted off its magnets, turned a quarter, set down again (the film portrait or landscape). */
    turnBack(portrait) {
      // (clockwise seen from behind: the notch end comes to the top, where a holder goes in — Intrepid's guide)
      const from = st.backRot, to = portrait ? -Math.PI / 2 : 0;
      if (from === to && !st.turning) return Promise.resolve();
      for (let i = tweens.length - 1; i >= 0; i--) if (tweens[i].key === 'backRot') { const [tw] = tweens.splice(i, 1); tw.res(); }
      // (on the way round the glass's corners leave the frame: the lens view takes in what the light window lets reach
      //  the glass — its shadow's half-width with the back lifted, mm — while the back turns, then the frame again)
      const m = this.lensMovements(), d = -DIM.frame.zB, lift = 9;
      const lit = (DIM.frame.light.w / 2 * (m.D + lift) + Math.hypot(m.ox, m.oy) * (d + lift)) / (m.D - d) + 2;
      st.turnCover = Math.max(1, (2 * lit) / Math.min(DIM.back.window.w, DIM.back.window.h));
      if (!st.turning) st.turnFrom = isPortrait();
      st.turning = true;
      const id = ++turnId;
      return tween(0.8, (k) => { st.backRot = lerp(from, to, k); st.backLift = 9 * Math.sin(Math.PI * k); }, easeInOut, 'backRot')
        .then(() => { if (id !== turnId) return; st.backLift = 0; st.turning = false; applyPose(); });
    },
    /** While the back turns: how much more of the lens's image than the frame the glass needs (lensview.js magCrop) */
    turnCover() { return st.turning ? st.turnCover : 1; },
    // ── the shutter held open, and the film holder (the page's holder routine: main.js) ──
    /** The press-focus lever holds the blades open: the picture on the glass. */
    get shutterHeld() { return st.pfT > 0.5; },
    /** Hold the shutter open to focus, or close it — and cock it, ready for the film. */
    async holdOpen(open) {
      st.pfT = open ? 1 : 0;
      await animate('pf', st.pfT, 0.22);
      if (!open && st.cocked < 0.5) await animate('cocked', 1, 0.35);
    },
    holder: {
      /** A fresh holder: both slides show their plain faces. */
      fresh() { st.sT = [0, 0]; },
      /** Put the holder in, side (0 A, 1 B) toward the lens; shown: which slides show their EXPOSED faces. */
      async insert(side, shown = [false, false]) {
        st.side = side; st.sK = [0, 0]; st.sT = shown.map((b) => (b ? 1 : 0));
        if (st.loupeK > 0) await api.setLoupe(false);
        await animate('hK', 1, 1.1);
      },
      /** Take it out (its slide, if out, back in your hand: pushed home once the holder is clear). */
      async remove() {
        await animate('hK', 0, 0.95);
        st.sK = [0, 0];
      },
      /** Draw the dark slide over the sheet facing the lens out of the holder. */
      pull() { const i = st.side, from = st.sK[i]; return tween(0.85, (k) => { st.sK[i] = lerp(from, 1, k); }); },
      /** Push it back: its EXPOSED face out or not (turned over in the hand first if need be). */
      async push(exposedOut) {
        const i = st.side, to = exposedOut ? 1 : 0, t0 = st.sT[i];
        if (t0 !== to) await tween(0.4, (k) => { st.sT[i] = lerp(t0, to, k); });
        const from = st.sK[i];
        await tween(0.75, (k) => { st.sK[i] = lerp(from, 0, k); });
      },
      get state() { return { in: st.hK > 0.5, side: st.side, out: st.sK[st.side] > 0.5 }; },
    },
    /** Behind the ground glass, looking square at it (cameras.js viewing); the head upright, whichever way the back
     *  is turned. With the loupe on the glass: over its eyepiece, at the eye relief at which the eyepiece fills the view
     *  (its 30 mm clear 37° across, the view 40° high). */
    ggPose() {
      rear.backRot.updateWorldMatrix(true, false);
      const q = rollG.getWorldQuaternion(_ggQ), qb = rear.backRot.getWorldQuaternion(_ggQb);
      const back = _ggBack.set(0, 0, 1).applyQuaternion(qb), up = _ggUp.set(0, 1, 0).applyQuaternion(q).clone();
      if (st.loupeK > 0.5) {
        const target = rear.backRot.localToWorld(new THREE.Vector3(st.lx, st.ly, LOUPE_SEAT + LOUPE.top));
        return { eye: target.clone().addScaledVector(back, LOUPE.eyeRelief / 1000), target, up };
      }
      const target = rear.backRot.localToWorld(new THREE.Vector3(0, 0, 0));
      return { eye: target.clone().addScaledVector(back, 0.26), target, up };
    },
    // ── the dark cloth ──
    /** Lay the cloth over the back (folded), or take it off. */
    setCloth(on) { return animate('cloth', on ? 1 : 0, on ? 0.6 : 0.5); },
    get clothOn() { return st.cloth > 0.5; },
    /** Under it (looking in): the cloth opens over the head; out again, it is laid folded over the back. */
    setUnderCloth(on) { return animate('clothOver', on ? 1 : 0, on ? 0.9 : 0.8); },
    /** The ground glass is in sight from outside: the cloth off, and the eye behind the back, near enough to see it. */
    glassSeen(view) {
      if (st.cloth > 0.5 || st.explodeK > 0.01 || st.free || st.lensOff > 0 || !view) return false;
      const e = rear.frameG.worldToLocal(_eye.copy(view.position));
      return e.z > 40 && e.z < 1300 && Math.hypot(e.x, e.y) < 700;
    },
    // ── the loupe ──
    setLoupe(up) { return animate('loupeK', up ? 1 : 0, up ? 0.35 : 0.3); },
    get loupeUp() { return st.loupeK > 0.95; },
    /** Where the loupe stands on the glass (mm, the back's frame seen from behind: + right, + up). */
    loupeAt() { return { x: st.lx, y: st.ly }; },
    /** Set it down at (x, y), kept to where its field still lies on the glass. */
    moveLoupe(x, y) {
      const W2 = DIM.back.window.w / 2 - LOUPE.field / 2, H2 = DIM.back.window.h / 2 - LOUPE.field / 2;
      st.lx = Math.min(W2, Math.max(-W2, x)); st.ly = Math.min(H2, Math.max(-H2, y));
      applyPose();
    },
    /** Where on the glass a world point is (the glass's frame, mm). */
    glassPoint(world) { const p = rear.backRot.worldToLocal(world.clone()); return { x: p.x, y: p.y }; },
    /** Slide the loupe as a pointer drags the magnified glass by (dx, dy) screen px (the image follows the pointer). */
    loupeDrag(dx, dy, view, heightPx) {
      const mmPerPx = LOUPE.field / (0.916 * heightPx);   // (the eyepiece fills 0.916 of the view's height)
      const qInv = rear.backRot.getWorldQuaternion(_ldQ).invert();
      const r = _ldR.set(1, 0, 0).applyQuaternion(view.quaternion).applyQuaternion(qInv);
      const u = _ldU.set(0, 1, 0).applyQuaternion(view.quaternion).applyQuaternion(qInv);
      api.moveLoupe(st.lx - (dx * r.x - dy * u.x) * mmPerPx, st.ly - (dx * r.y - dy * u.y) * mmPerPx);
    },
    /** The loupe's part of the picture, for its lens view (lensview.js magCentre): its centre in the picture's uv. (The
     *  place it was asked for is remembered: the eyepiece maps the picture made there — setLoupeTexture.) */
    loupeCentre() {
      st.lxR = st.lx; st.lyR = st.ly;
      const c = Math.cos(st.backRot), sn = Math.sin(st.backRot), X = st.lx * c - st.ly * sn, Y = st.lx * sn + st.ly * c;
      const p = isPortrait(), fw = p ? DIM.back.window.h : DIM.back.window.w, fh = p ? DIM.back.window.w : DIM.back.window.h;
      return { x: 0.5 - X / fw, y: 0.5 - Y / fh };
    },
    /** The loupe's picture (its lens view's ground glass): crop, the part of the frame it takes in; shape, what it holds
     *  (lensview.js ggShown: { portrait, lum }; defaults lum = 1.0 when a texture is given without shape.lum). Honors tex.repeat/offset! */
    setLoupeTexture(tex, crop = 1, shape) {
      loupe.discMat.map = tex || loupe.blank;
      if (tex) { loupe.discU.uMapRepeat.value.copy(tex.repeat); loupe.discU.uMapOffset.value.copy(tex.offset); }
      else { loupe.discU.uMapRepeat.value.set(1, 1); loupe.discU.uMapOffset.value.set(0, 0); }
      const p = !!shape?.portrait, fw = p ? DIM.back.window.h : DIM.back.window.w, fh = p ? DIM.back.window.w : DIM.back.window.h;
      loupe.discU.uLoupeFrame.value.set(crop * fw, crop * fh);
      loupe.discU.uLoupeC.value.set(st.lxR, st.lyR);
      st.lumLoupe = tex ? (shape?.lum ?? 1.0) : 0;
    },
    /** The ground glass's picture, and (shape) what it holds: { portrait, crop, lum } — defaults lum = 1.0 when a texture
     *  is supplied without shape.lum so standalone stages light the ground glass cleanly out-of-the-box. */
    setScreenTexture(t, shape) {
      // (the picture is the glass's own light: its emissive map; the daylight on it is its matte colour)
      const m = rear.screenMat;
      if (m.emissiveMap !== (t || null)) {
        if (!m.emissiveMap !== !t) m.needsUpdate = true;
        m.emissiveMap = t || null;
      }
      const p = !!shape?.portrait, c = shape?.crop ?? 1;
      if (p !== shownShape.portrait || c !== shownShape.crop) { shownShape = { portrait: p, crop: c }; rear.mapScreen(st.backRot, p, c); }
      st.lumGlass = t ? (shape?.lum ?? 1.0) : 0;
    },
    ringAxisWorld(target = new THREE.Vector3()) { return target.set(0, 0, -1).applyQuaternion(mm.getWorldQuaternion(tmpQ)).normalize(); },
    ringAngle(part) {
      if (part === 'focus') return -(st.extT / FOCUS_PITCH) * TAU;
      if (part === 'aperture') return -st.apT * AP_ARC;
      if (part === 'shutter') return -st.spT;
      return 0;
    },
    ringValueAt(part, angle) {
      if (part === 'focus') return distAt(L.lens, Math.max(0, -angle / TAU * FOCUS_PITCH));
      if (part === 'aperture') { const ap = L.lens.apertureStops; return Math.max(0, -angle / AP_ARC) * (ap.length - 1); }
      if (part === 'shutter') return (angle / DEG + SPEED_A0 + 9 * SPEED_DA) / SPEED_DA;
      return 0;
    },
    setHover(part) { PARTS.forEach((p) => { hov[p].target = p === part ? 1 : 0; }); },
    async setExploded(on) { setCutaway(false); await animate('explodeK', on ? 1 : 0, 1.3); },
    // ── folding ──
    /** Folded flat (or being folded or set up): no lens on, the standards down. */
    get folded() { return st.folded || st.folding; },
    /** Fold the camera flat, or set it up again, as Intrepid's quickstart guide gives it. Packing away: the lens off;
     *  the front standard unscrewed from its mount; its controls loosened (every movement back to zero) and the panel
     *  pushed down as far as it goes; pushed back against the rear, the bellows squeezed between them (the carriage
     *  racked right back); front and rear folded down together. Setting up (its animations): the rear raised while the
     *  front, lying flat, is pulled forward — the bellows fan open between them; the panel pushed up; the front raised,
     *  rocking up on its foot, its controls tightened; slid over its mount and screwed down; racked out to focus; the
     *  lens on. The cloth, the loupe and a holder must be off first (the page sees to it). */
    async fold(on) {
      if (on === st.folded || st.folding || st.explodeK > 0.01) return;
      st.folding = true;
      try {
        const ins = insertFor(L.lens);
        if (on) {
          await animate('lensOff', 1, 1.0);
          await animate('wing', 1, 0.8);
          const zB = -(flangeOf(L.lens) + st.ext);
          Object.assign(st, { free: true, fTh: 0, fZc: zB - FOOT.z, cz: zB - ins });
          await Promise.all(['shift', 'tilt', 'swing', 'rearTilt'].map((k) => animate(k, 0, 0.6)));
          await animate('rise', FALL, 0.7);
          const zc0 = st.fZc, cz0 = st.cz, zc1 = FOLD_FOOT(0);
          await tween(1.2, (k) => { st.fZc = lerp(zc0, zc1, k); st.cz = lerp(cz0, C_REAR, k); });
          await tween(2.0, (k) => { const th = k * Math.PI / 2; st.foldA = k; st.fTh = th; st.fZc = FOLD_FOOT(th); });
          st.folded = true;
        } else {
          st.fanK = 1;
          const zc0 = st.fZc;
          await tween(2.0, (k) => { st.foldA = 1 - k; st.fZc = lerp(zc0, PULL, k); });
          // (the panel pushed up again while the front still lies flat: the animation raises it with the panel up)
          await animate('rise', 0, 0.6);
          await tween(1.4, (k) => { st.fTh = (1 - k) * Math.PI / 2; });
          st.fanK = 0;
          const zc1 = st.fZc, zc2 = st.cz + ins - FOOT.z;
          await tween(1.0, (k) => { st.fZc = lerp(zc1, zc2, k); });
          await animate('wing', 0, 0.8);
          const cz0 = st.cz, cz1 = -(flangeOf(L.lens) + st.extT) - ins;
          await tween(1.0, (k) => { st.cz = lerp(cz0, cz1, k); st.fZc = st.cz + ins - FOOT.z; });
          st.ext = st.extT; st.free = false;
          await animate('lensOff', 0, 1.0);
          st.folded = false;
        }
      } finally { st.folding = false; applyPose(); }
    },
    async swapLens(next, onSwap) {
      const vis = root.visible;
      if (vis) await animate('lensOut', 1, 0.45);
      front.lensMount.remove(L.group);
      lensCache.set(L.lens.id, L);
      const cached = lensCache.get(next.id);
      if (cached) L = cached;
      else { mats.nameRing = nameRingTex(next); L = buildLens(lib, next, hov, mats); mergeStaticRigid(L.group, { dynamic: new Set(lensDyn(L)), lists: lensLists(L) }); toLayer(L.group); shadeAll(); }
      front.lensMount.add(L.group);
      refreshPickables();
      buildLabels(); labelEls?.forEach((el) => el.remove()); dotEls?.forEach((el) => el.remove()); labelEls = dotEls = null;
      onSwap();
      if (live) { ringTargets(live); st.ext = st.extT; st.ap = st.apT; st.sp = st.spT; }
      if (vis) { applyPose(); await animate('lensOut', 0, 0.5); }
      else { st.lensOut = 0; applyPose(); }
    },
    /** The firing cycle of a leaf shutter: the release pressed, the blades open for the time set and close; the cocking
     *  lever springs back (to be cocked again by hand before the next sheet). A view camera has no mirror: the ground
     *  glass is covered by the holder while the film is exposed. */
    async fire({ seconds, onExpose, onSound = () => {}, cutaway: cut = false, side = 1 }) {
      if (cut) { api.cutSide = side; setCutaway(true); }
      if (st.cocked < 0.5) await animate('cocked', 1, 0.3);   // (cocked by hand first)
      await animate('press', 1, 0.08, (k) => k);
      onSound('release');
      onSound('leafOpen');
      await animate('firing', 1, 0.018, (k) => k);
      const expose = onExpose();
      await Promise.all([hold(Math.max(seconds * 1000, 90)), expose]);
      await animate('firing', 0, 0.018, (k) => k);
      onSound('leafClose');
      await animate('cocked', 0, 0.06, (k) => k);
      animate('press', 0, 0.16);
      await hold(200);
      if (cut) setCutaway(false);
    },
    setCutaway(on, side = 1) { api.cutSide = side; setCutaway(on); },
    opticalState() {
      const stops = L.lens.apertureStops, N = stops[0] * (stops[stops.length - 1] / stops[0]) ** st.ap;
      const leafOpen = Math.max(st.pf, st.firing);
      const lensOn = st.lensOff < 0.05 && st.lensOut < 0.05 && st.explodeK < 0.05;
      const holderIn = st.hK > 0.5;
      const slideOut = !holderIn || st.sK[st.side] > 0.5;
      return {
        shutterKind: 'leaf',
        blades: L.irisSpec.n,
        shutterBlades: 5,
        fNumberSelected: +N.toFixed(2),
        fNumberEffective: +N.toFixed(2),
        apertureMm: +(L.focalMm / N).toFixed(2),
        irisRadiusMm: +(L.irisSpec.rMax * (stops[0] / Math.max(stops[0], N))).toFixed(2),
        shutterOpen: +leafOpen.toFixed(4),
        pressFocusOpen: st.pf > 0.5,
        mirrorUp: 1,
        darkSlideOut: slideOut,
        lightReachesFilm: lensOn && holderIn && slideOut ? +leafOpen.toFixed(4) : 0,
        lightReachesFinder: lensOn && !holderIn ? +leafOpen.toFixed(4) : 0,
        zIrisMm: +(-(flangeOf(L.lens) + st.ext) + L.zIris).toFixed(2),
        zShutterMm: +(-(flangeOf(L.lens) + st.ext) + L.zShutter).toFixed(2),
        zFilmMm: 0,
        zFlangeMm: +(-(flangeOf(L.lens) + st.ext)).toFixed(2),
        focalMm: L.focalMm,
        pupilMag: L.pupilMag,
        focusExtMm: +st.ext.toFixed(3),
      };
    },
    update(dt, view) {
      dt *= api.timeScale;
      for (let i = tweens.length - 1; i >= 0; i--) {
        const tw = tweens[i]; tw.t += dt;
        const k = Math.min(1, tw.t / tw.dur); tw.fn(tw.ease(k));
        if (k >= 1) { tweens.splice(i, 1); tw.res(); }
      }
      if (live) ringTargets(live);
      const a = 1 - Math.exp(-dt * 10);
      { const now = { rise: st.rise, tilt: st.tilt, rear: st.rearTilt, wing: st.shift + st.swing * 40 }, la = 1 - Math.exp(-dt * 9);
        for (const key in now) {
          lockHold[key] = Math.abs(now[key] - lockPrev[key]) > 1e-5 ? 0.35 : Math.max(0, lockHold[key] - dt);
          lockPrev[key] = now[key];
          st.lock[key] += ((lockHold[key] > 0 ? 1 : 0) - st.lock[key]) * la;
        } }
      st.ext += (st.extT - st.ext) * a;
      st.ap += (st.apT - st.ap) * (1 - Math.exp(-dt * 16));
      st.sp += (st.spT - st.sp) * (1 - Math.exp(-dt * 16));
      const hA = 1 - Math.exp(-dt * 12);
      PARTS.forEach((p) => { const h = hov[p]; h.amount.value += (h.target - h.amount.value) * hA; });
      applyPose();
      rollG.getWorldQuaternion(tmpQ).invert();
      const upL = (api._upL ||= new THREE.Vector3()).set(0, 1, 0).applyQuaternion(tmpQ);
      const off = (api._off ||= new THREE.Vector2()).set(upL.x, upL.z).multiplyScalar(57);
      if (off.length() > 3.4) off.setLength(3.4);
      head.bubble.position.set(head.bubbleHome.x + off.x, head.bubbleHome.y, head.bubbleHome.z + off.y);
      head.bubX.position.x = head.bubXHome.x + THREE.MathUtils.clamp(upL.x * 115, -4, 4);
      head.bubZ.position.z = head.bubZHome.z + THREE.MathUtils.clamp(upL.z * 115, -4, 4);
      head.syncBubbles();
      // the dark cloth: draped a little each frame once the page has settled (at once if it is wanted sooner); laid on,
      // over the head, off
      clothAge += dt;
      if (!cloth.ready && (st.cloth > 0 || clothAge > 3)) cloth.bakeSome(st.cloth > 0 ? Infinity : 4);
      cloth.on(st.cloth * (1 - easeInOut(st.explodeK))); cloth.set(st.clothOver); cloth.update();
      // under it: when `view` is passed, auto-detect whether the eye is inside the cloth tent; when omitted, preserve explicit `st.under`!
      if (view) {
        let inside = 0;
        if (st.cloth > 0.9 && st.clothOver > 0.8) {
          const ev = rear.frameG.worldToLocal(_eye.copy(view.position));
          inside = ev.z > 25 && ev.z < 430 && Math.abs(ev.x) < 240 && ev.y > -260 && ev.y < 170 ? 1 : 0;
        }
        st.under += (inside - st.under) * (1 - Math.exp(-dt / 0.12));
      }
      mats.shade.gwUnder.value = st.under < 0.001 ? 0 : st.under;
      rear.backRot.getWorldPosition(mats.shade.gwGlassPos.value);
      // the glass's light: the lens's picture only while the blades are open (held open to focus, or firing)
      // (and the lens on: off, there is no picture)
      const blades = Math.max(st.pf, st.firing) * (1 - st.lensOff);
      rear.glassK.value = st.lumGlass * blades;
      loupe.discU.uLoupeK.value = st.lumLoupe * blades;
      if (cutaway) {
        mm.updateWorldMatrix(true, false);
        const n = new THREE.Vector3(-api.cutSide, 0, 0).transformDirection(mm.matrixWorld);
        clipPlane.setFromNormalAndCoplanarPoint(n, mm.localToWorld(new THREE.Vector3(0, 0, 0)));
      }
    },
    labelAt(obj) {
      for (let o = obj; o; o = o.parent) { const i = labels.findIndex((l) => l.o.parent === o); if (i >= 0) return i; }
      return -1;
    },
    labelFocus: -1,
    updateLabels(cam, container, show) {
      if (!labelEls) {
        labelEls = labels.map((l) => { const el = document.createElement('div'); el.className = 'part-label'; el.innerHTML = `${l.text}<small>${l.sub}</small>`; container.appendChild(el); return el; });
        dotEls = labels.map(() => { const d = document.createElement('i'); d.className = 'part-dot'; container.appendChild(d); return d; });
      }
      const on = show && st.explodeK > 0.85;
      if (!on && labelsShown === false) return;
      labelsShown = on;
      const w = container.clientWidth, h = container.clientHeight, v = _labelV;
      labels.forEach((l, i) => {
        const el = labelEls[i], dot = dotEls[i];
        el.classList.toggle('on', on && i === api.labelFocus);
        dot.classList.toggle('on', on);
        if (!on) return;
        l.o.getWorldPosition(v).project(cam);
        const x = (v.x * 0.5 + 0.5) * w, y = (-v.y * 0.5 + 0.5) * h;
        dot.style.left = `${x}px`; dot.style.top = `${y}px`;
        if (i === api.labelFocus) { el.style.left = `${x}px`; el.style.top = `${y - 14}px`; }
      });
    },
    get parts() { return { mm, base: baseP, carriage, front, rear, lens: L, head, bellows, fFrame }; },
  };
  applyPose();
  api.buildMs = performance.now() - t0;
  return api;
}
