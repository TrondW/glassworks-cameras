// The camera: the owner's Leica M6 — an early "classic" from the Wetzlar production, black chrome, 0.72× finder —
// with the owner's third Summicron 50 mm f/2, on the same carbon tripod and 3-way head as the 503CX. Every part
// procedural, in millimetres, from the shared modelling library (lib/). Neutral GLASS WORKS legends where the maker's
// are; no red dot; no maker's names on the lens (docs/PLAYBOOK.md).
//
// Model axes, as for the 503CX: lens axis along −Z, +X = the photographer's right, +Y up. Origin: the lens axis on the
// film plane. The M bayonet's seating face is 27.8 mm in front of the film.
//
// Where the numbers come from (SPEC.md has every dimension with its source):
// - Leica's dimensioned drawing of the M6 (technical data pm-14029, October 2022, page 1 — the reissue keeps the
//   classic's body): front, back, end and bottom views, read from the vector PDF to ~0.1 mm. 138.6 mm long, the lens
//   axis 79.2 mm from the right end and 59.4 from the left, 33.5 above the bottom; the deck 72 and the finder housing
//   78 above the bottom; 32.2 / 34.5 / 40 deep (body, top plate, overall); the eyepiece 67.4 up and 23.2 in; the
//   film-speed dial 29.7 up and 68.3 from the right end; the tripod bush 15.2 from the right end (the
//   bottom photographs: the bush under the lettering's end, the baseplate's key under the rewind's).
// - The top: square-on photographs of two early Wetzlar M6 bodies (eBay listings 204646186575 and 357306606738,
//   measurement only), calibrated on the lens axis and on features the drawing fixes.
// - Leica's 1989 handbook, p. 4-8 to 4-10: the meter's 12 mm white spot, the shutter, the wind lever's 120° stroke,
//   the angled rewind crank; the zinc top and the brass baseplate.
// Still to confirm on the owner's camera (plan §4.2): the rewind knob's exact tilt and size, the wind lever's
// thickness, the eyepiece window.
//
// API: the contract (docs/CONTRACT.md) — root, setAim, bodyCenter, worldToBody, ringAxisWorld, lensPose,
// filmOffset, setRings, swapLens, setHood, hoodOn, hasHood, setFilter, update, pickables, setHover, ringAngle,
// ringValueAt, fire, setExploded, setCutaway, labelAt, labelFocus, updateLabels — and, for the rangefinder viewing
// (cameras.js): finderPose(), FINDER.
import * as THREE from 'three';
import { INK, PAINT_BG } from '../../lib/engrave.js';
import { addScrew, decalUV, pointInPoly, radialT, rbox, revolve, rrPath, slab } from '../../lib/geometry.js';
import { MatLib, baseMaterials } from '../../lib/materials.js';
import { defer } from '../../lib/textures.js';
import { Kit, foldSiblings, mergeStaticRigid, prep } from '../../lib/mesh.js';
import { buildHead, buildTripod } from '../../lib/rig.js';
import { DEG, FONT, T, TAU, easeInOut, lerp } from '../../lib/util.js';
import { lensOpticsFor, helicoidExtensionMm, filterOpticsFor } from '../../optics.js';
import { FINDER } from './finder.js';
export { FINDER };
export { flushCameraTextures } from '../../lib/textures.js';

// ───────── Dimensions (mm) ─────────
export const DIM = {
  flange: -27.8,
  // the body under the top plate: leatherette from the seam down to the baseplate; a stadium in plan (its ends half
  // rounds of the depth). Depth 32.2: the front 3.1 mm behind the bayonet's face, the back 7.5 behind the film.
  body: { x0: -59.4, x1: 79.2, zF: -24.7, zB: 7.5, bottom: -33.5, seam: 20.3 },
  // the baseplate band, 5.5 mm high
  base: { top: -28.0 },
  // the top plate, 34.5 deep (0.45 proud at the front, 1.85 at the back): the deck, the finder housing over the left,
  // the step between them; its front stepped back 0.5 mm below the shoulder line (26.09; 23.29 under the finder, the
  // step between them hidden behind the bayonet's top, at X 0: the drawing's lines stop at the ring); its left
  // end a facet falling at ~44.5° from the housing's top to the end, the rewind crank on it
  top: { x0: -59.6, x1: 79.4, zF: -25.15, zB: 9.35, deck: 38.5, housing: 44.45, step: 18.6, shoulder: 26.09, shoulderLow: 23.29, shoulderX: 0, facetX: -47.5, facetSlope: 0.983, rL: 10.3, rR: 17.25, inset: 0.5 },
  // the shoe's notch in the housing's back corner (at the deck's level)
  notch: { x0: -3.4, z0: -9.5 },
  // the speed dial: its off-centre screw beside the B
  dial: { x: 27.4, z: -8.75, r: 8.83, base: 38.87, top: 43.3, screw: [-4.4, 0.0] },
  // the wind lever's hub (the drawing's front and back views, their vector lines; the photographs): the base disc on the
  // deck to 39.51, a groove to 40.1, the lever's own ring to 42.09, the release's collar to 43.8; the button's top 44.47
  hub: { x: 53.6, z: -14.15, r: 8.4, groove: 39.51, ring: 40.1, ringTop: 42.09, top: 43.8 },
  release: { r: 3.95, top: 44.47 },
  // the frame counter: X from the drawing's front view (its dome, 68.1) and the top photograph (68.8)
  counter: { x: 68.4, z: -13.9, recess: 6.0, dome: 4.4, top: 39.34 },
  // the rewind knob: the centre of its top (the folded crank's face), the lean of its axis out toward −X, its radius
  // and its height to that face (the drawing's front view)
  rewind: { x: -56.9, y: 41.8, z: -7.4, tilt: 33.7, r: 7.95, h: 6.9 },
  eyepiece: { x: -36.2, y: 33.84 },
  // the flash socket: where the drawing (of the reissue, which has none) puts its round boss, r 4.07; the back photograph
  pc: { x: 8.48, y: 32.27, r: 4.07 },
  // the back door (the drawing's back view, its vector lines): the frame, the leatherette inset, the rails each side
  // from the baseplate to the seam, the two screws
  door: { x0: -35.04, x1: 54.9, y0: -25.41, y1: 19.69, inset: [-29.29, 49.14, -21.03, 13.40], rails: [[-38.05, -35.04], [54.9, 57.87]], railY: [-27.6, 20.5], screws: [[-31.6, 15.8], [51.4, 15.8]] },
  iso: { x: 10.9, y: -3.82, r: 15.78 },
  lugs: { y: 15.45, z: -14.3, x: [80.5, -60.8] },
  front: {
    release: { x: 30.4, y: 0, rOuter: 5.1, rStep: 4.45, rRing: 3.85, rButton: 3.49, latch: [21.2, 25.9, -1.7, 1.25] },
    selector: { x: -31.6, y: 0, r: 4.25, tilt: 29.5, len: 17.5, w: 7.0 },
    battery: { x: 42.79, y: -10.01, r: 8.79, face: 6.8 },
    rLever: { x0: 43.6, x1: 47.6, top: 25.5, foot: [45.6, 19.21, 2.83], knob: [45.58, 23.69, 1.5], screw: [45.6, 19.21, 1.6] },
  },
  // the tripod bush 15.2 from the right end (the drawing; the bottom photographs put it at the right, under the
  // lettering), the baseplate's locking key under the rewind end (the photographs)
  socket: { x: 64.0, z: -9.0 },
  key: { x: -45.1, z: -8.6 },
  tripod: { apex: 1210, spread: 560 },
};
const B = DIM.body, TP = DIM.top;

// ───────── The lens's rings (measured off a square-on side view of an 11817, scaled by its 42 mm front) ─────────
// The aperture ring: one stop every 18.2°, f/2 toward −X. The focusing ring: the distance scale laid out by the
// helicoid's travel, 58.9° of turn for every millimetre the lens moves out (∞ → 0.7 m is ~265°); its depth-of-field
// marks then fall at ±58.9° × N × 0.03 mm, as engraved.
// (the body covering's grain: finer than the 503's pebble — its tile, mm)
const VULC_TILE = 13;
const AP_STEP = 18.2 * DEG;
// (the focus ring's turn per mm of helicoid travel: 50mm f/2 III is 58.9°/mm → 265° for 4.5 mm; other lenses scale by their own throw)
const FOCUS_C = 58.9 * DEG;
const COC = 1 / 30;
const DIAL_STEP = TAU / 13;
const DIAL_LABELS = ['B', '1', '2', '4', '8', '15', '30', '⚡', '60', '125', '250', '500', '1000'];
const LEVER_OUT = 30 * DEG, LEVER_STROKE = 120 * DEG;
const ISO_STEPS = [6, 8, 10, 12, 16, 20, 25, 32, 40, 50, 64, 80, 100, 125, 160, 200, 250, 320, 400, 500, 640, 800, 1000, 1250, 1600, 2000, 2500, 3200, 4000, 5000, 6400];
const focusPitch = (lens) => (LENS_DEFS[lens.id]?.focusPitch ?? FOCUS_C);
const focusAngle = (lens, d) => -focusPitch(lens) * helicoidExtensionMm(lens, d);
/** the distance a focus angle (as ringAngle gives it, positive) shows */
function distanceAt(lens, angle) {
  const ext = Math.max(0, angle) / focusPitch(lens);
  if (ext < 1e-4) return 10000;
  let lo = lens.minFocusDistance, hi = 10000;
  for (let i = 0; i < 40; i++) { const mid = Math.sqrt(lo * hi); if (helicoidExtensionMm(lens, mid) > ext) lo = mid; else hi = mid; }
  return Math.sqrt(lo * hi);
}

// ───────── Outlines ─────────
/** Round each corner of a closed polygon [[x, y], …] with a fillet of radius r (a number, or one per corner). */
function roundPoly(pts, radii, seg = 14) {
  const n = pts.length, out = [];
  for (let i = 0; i < n; i++) {
    const P = pts[i], A = pts[(i + n - 1) % n], C = pts[(i + 1) % n];
    const r = Array.isArray(radii) ? radii[i] : radii;
    if (!r) { out.push(P); continue; }
    const la = Math.hypot(A[0] - P[0], A[1] - P[1]), lc = Math.hypot(C[0] - P[0], C[1] - P[1]);
    const ux = (A[0] - P[0]) / la, uy = (A[1] - P[1]) / la, vx = (C[0] - P[0]) / lc, vy = (C[1] - P[1]) / lc;
    const th = Math.acos(Math.max(-1, Math.min(1, ux * vx + uy * vy)));
    // (an edge shared with another fillet gives each half of it; an edge whose other end is sharp, all of it)
    const rA = Array.isArray(radii) ? radii[(i + n - 1) % n] : radii, rC = Array.isArray(radii) ? radii[(i + 1) % n] : radii;
    const t = Math.min(r / Math.tan(th / 2), la * (rA ? 0.5 : 1) - 1e-4, lc * (rC ? 0.5 : 1) - 1e-4), rr = t * Math.tan(th / 2);
    let bx = ux + vx, by = uy + vy; const bl = Math.hypot(bx, by) || 1; bx /= bl; by /= bl;
    const d = rr / Math.sin(th / 2), cx = P[0] + bx * d, cy = P[1] + by * d;
    const a1 = Math.atan2(P[1] + uy * t - cy, P[0] + ux * t - cx), a2 = Math.atan2(P[1] + vy * t - cy, P[0] + vx * t - cx);
    let da = a2 - a1; while (da > Math.PI) da -= TAU; while (da < -Math.PI) da += TAU;
    for (let k = 0; k <= seg; k++) { const a = a1 + (da * k) / seg; out.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]); }
  }
  return out;
}
const shapeXY = (poly) => new THREE.Shape(poly.map(([x, y]) => new THREE.Vector2(x, y)));
/** A plan outline [[x, z], …] extruded upward from y0 by h, its edges rounded b: plates seen from above. */
function vslab(polyXZ, y0, h, b = 0.4, wear = 0.6) {
  const g = slab(shapeXY(polyXZ.map(([x, z]) => [x, -z])), h, b, 20, wear, 3);
  g.rotateX(-Math.PI / 2); g.translate(0, y0, 0);
  return g;
}
/** A slab without its top (sy 1) or bottom (sy -1) face, for a piece whose end is buried in the piece above: a buried
 *  face that ends in a wall's plane fights that wall for the pixels along its edge, and shows there as a dashed line. */
function uncap(g, sy = 1) {
  const n = g.attributes.normal, ix = g.index.array, keep = [];
  for (let i = 0; i < ix.length; i += 3) {
    if (n.getY(ix[i]) * sy > 0.99 && n.getY(ix[i + 1]) * sy > 0.99 && n.getY(ix[i + 2]) * sy > 0.99) continue;
    keep.push(ix[i], ix[i + 1], ix[i + 2]);
  }
  g.setIndex(keep);
  return g;
}
/** The same for the faces that look along any axis direction (x, y, z: -1, 0 or 1), several at once: strip(g, [1, 0, 0], [0, 1, 0]). */
function strip(g, ...dirs) {
  const n = g.attributes.normal, ix = g.index.array, keep = [];
  const along = (i, d) => n.getX(i) * d[0] + n.getY(i) * d[1] + n.getZ(i) * d[2] > 0.99;
  for (let i = 0; i < ix.length; i += 3) {
    if (dirs.some((d) => along(ix[i], d) && along(ix[i + 1], d) && along(ix[i + 2], d))) continue;
    keep.push(ix[i], ix[i + 1], ix[i + 2]);
  }
  g.setIndex(keep);
  return g;
}
const rect = (x0, x1, z0, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
/** A flat plate in the front (or back) plane: shape in (x, y), from z0 to z0 + t. */
function zslab(shape, z0, t, b = 0.2, wear = 0.4) { const g = slab(shape, t, b, 20, wear, 3); g.translate(0, 0, z0); return g; }
const rrShape = (x0, y0, x1, y1, r, holes = []) => { const s = rrPath(x0, y0, x1, y1, r); holes.forEach((h) => s.holes.push(h)); return s; };
const circlePath = (x, y, r) => { const p = new THREE.Path(); p.absarc(x, y, r, 0, TAU, true); return p; };
/** A lathe turned to stand on the body's top (its axis along +Y, z of the profile becoming height). */
const upright = (g) => { g.rotateX(-Math.PI / 2); return g; };
/** A stadium-like plan [[x, z], …]: x0…x1, z0…z1, its left and right ends rounded rL and rR (rR = half the depth
 *  makes a half round). */
function plan(x0, x1, z0, z1, rL, rR, seg = 24) { return roundPoly(rect(x0, x1, z0, z1), [rL, rR, rR, rL], seg); }
/** Sutherland–Hodgman: the part of a polygon [[x, z], …] on one side of a line: axis 0 (x) or 1 (z), keep ≥ v (sign 1)
 *  or ≤ v (sign −1). */
function clip(poly, axis, v, sign) {
  const out = [], inside = (p) => sign * (p[axis] - v) >= -1e-9;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], ia = inside(a), ib = inside(b);
    if (ia) out.push(a);
    if (ia !== ib) { const t = (v - a[axis]) / (b[axis] - a[axis]); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
  }
  return out;
}

/** Insert points [[x, z], …] into the edges of a polygon that they lie on. */
function splitEdges(poly, pts) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    out.push(a);
    const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz;
    pts.map((p) => ({ p, t: ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / l2 }))
      .filter(({ p, t }) => t > 1e-6 && t < 1 - 1e-6 && Math.abs((p[0] - a[0]) * dz - (p[1] - a[1]) * dx) / Math.sqrt(l2) < 1e-6)
      .sort((u, v) => u.t - v.t).forEach(({ p }) => out.push(p));
  }
  return out;
}

/** A − B for two outlines [[x, z], …] whose boundaries cross twice (B bitten out of A's edge): A's boundary outside B,
 *  then B's inside A. A unchanged if they don't cross so. */
function cutBy(A, B) {
  const cross = (p, q, r, s) => {
    const d = (q[0] - p[0]) * (s[1] - r[1]) - (q[1] - p[1]) * (s[0] - r[0]);
    if (Math.abs(d) < 1e-12) return null;
    const t = ((r[0] - p[0]) * (s[1] - r[1]) - (r[1] - p[1]) * (s[0] - r[0])) / d, u = ((r[0] - p[0]) * (q[1] - p[1]) - (r[1] - p[1]) * (q[0] - p[0])) / d;
    return t >= 0 && t < 1 && u >= 0 && u < 1 ? { t, u } : null;
  };
  const n = A.length, m = B.length, hits = [];
  for (let i = 0; i < n; i++) {
    const p = A[i], q = A[(i + 1) % n];
    for (let j = 0; j < m; j++) { const h = cross(p, q, B[j], B[(j + 1) % m]); if (h) hits.push({ i, t: h.t, j, pt: [p[0] + (q[0] - p[0]) * h.t, p[1] + (q[1] - p[1]) * h.t] }); }
  }
  if (hits.length !== 2) return A;
  const after = (h) => { const p = A[h.i], q = A[(h.i + 1) % n], t = Math.min(1, h.t + 1e-4); return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]; };
  const exit = pointInPoly(...after(hits[0]), B) ? hits[1] : hits[0], entry = exit === hits[0] ? hits[1] : hits[0];
  const out = [exit.pt];
  let steps = (entry.i - exit.i + n) % n;
  if (steps === 0 && entry.t < exit.t) steps = n;
  for (let c = 0, k = (exit.i + 1) % n; c < steps; c++, k = (k + 1) % n) out.push(A[k]);
  out.push(entry.pt);
  if (pointInPoly(...B[(entry.j + 1) % m], A)) for (let c = 0, j = (entry.j + 1) % m, cnt = (exit.j - entry.j + m) % m; c < cnt; c++, j = (j + 1) % m) out.push(B[j]);
  else for (let c = 0, j = entry.j, cnt = (entry.j - exit.j + m) % m; c < cnt; c++, j = (j - 1 + m) % m) out.push(B[j]);
  return out;
}

/**
 * A raised part of the top plate, built as the camera's is: its plan outline [[x, z], …], raised to H (a number, or a
 * function of x for the rewind facet). edge(m) gives each edge, by its midpoint m, its top edge's radius b and its
 * wall's foot (null: the edge is shared with a neighbouring part, no wall). The top edges are rounded by a quarter
 * round (worn bright where they stand proud); the walls stand straight. Returns { top, band, walls } geometries.
 */
function plateRegion(poly, H, edge, segs = 3) {
  let P = poly.map(([x, z]) => [x, -z]);
  const area = P.reduce((s, p, i) => { const q = P[(i + 1) % P.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0);
  if (area < 0) P = P.reverse();
  const n = P.length, Hf = typeof H === 'function' ? H : () => H;
  const E = [];
  for (let i = 0; i < n; i++) {
    const a = P[i], c = P[(i + 1) % n], dx = c[0] - a[0], dy = c[1] - a[1], l = Math.hypot(dx, dy) || 1;
    const e = edge([(a[0] + c[0]) / 2, -(a[1] + c[1]) / 2]);
    E.push({ d: [dx / l, dy / l], nIn: [-dy / l, dx / l], b: e.b, foot: e.foot, l });
  }
  // the inset outline: each edge moved in by its own radius, the corners where those lines meet
  const inset = [], bv = [];
  for (let i = 0; i < n; i++) {
    const e0 = E[(i + n - 1) % n], e1 = E[i], p = P[i];
    bv.push(Math.max(e0.b, e1.b));
    const o0 = [p[0] + e0.nIn[0] * e0.b, p[1] + e0.nIn[1] * e0.b], o1 = [p[0] + e1.nIn[0] * e1.b, p[1] + e1.nIn[1] * e1.b];
    const cr = e0.d[0] * e1.d[1] - e0.d[1] * e1.d[0];
    // (two edges in line: where a rounded edge meets a shared one, the inset keeps to the shared edge's line, so the
    // neighbouring part's top meets this one's with no gap; the rounding runs out over the edge)
    if (Math.abs(cr) < 0.05) { inset.push(e0.b <= e1.b ? o0 : o1); continue; }
    const t = ((o1[0] - o0[0]) * e1.d[1] - (o1[1] - o0[1]) * e1.d[0]) / cr;
    inset.push([o0[0] + e0.d[0] * t, o0[1] + e0.d[1] * t]);
  }
  const V = (x, y, z) => [x, y, -z];
  // the top
  const tv = [], tw = [];
  inset.forEach(([x, y]) => { tv.push(...V(x, Hf(x), y)); tw.push(0); });
  const faces = THREE.ShapeUtils.triangulateShape(inset.map(([x, y]) => new THREE.Vector2(x, y)), []);
  // (each triangle counter-clockwise in plan, so that it faces up)
  const ti = [];
  faces.forEach(([a, b, c]) => {
    const A = inset[a], Bq = inset[b], Cq = inset[c];
    const ccw = (Bq[0] - A[0]) * (Cq[1] - A[1]) - (Bq[1] - A[1]) * (Cq[0] - A[0]) > 0;
    if (ccw) ti.push(a, b, c); else ti.push(a, c, b);
  });
  const top = new THREE.BufferGeometry();
  top.setAttribute('position', new THREE.Float32BufferAttribute(tv, 3)); top.setAttribute('wear', new THREE.Float32BufferAttribute(tw, 1));
  top.setAttribute('uv', new THREE.Float32BufferAttribute(inset.flatMap(([x, y]) => [x, y]), 2));
  top.setIndex(ti); top.computeVertexNormals();
  // the rounded band: rows from the outline (k = 0) to the inset (k = segs) along a quarter round
  const bp = [], bw = [], buv = [], bi = [];
  for (let i = 0; i < n; i++) {
    for (let k = 0; k <= segs; k++) {
      const th = (k / segs) * Math.PI / 2, f = 1 - Math.cos(th);
      const x = P[i][0] + (inset[i][0] - P[i][0]) * f, y = P[i][1] + (inset[i][1] - P[i][1]) * f;
      bp.push(...V(x, Hf(x) - bv[i] * (1 - Math.sin(th)), y)); bw.push(k < segs ? 0.9 : 0); buv.push(x, y + k);
    }
  }
  for (let i = 0; i < n; i++) {
    if (E[i].b <= 0) continue;
    const j = (i + 1) % n;
    for (let k = 0; k < segs; k++) {
      const a = i * (segs + 1) + k, b = j * (segs + 1) + k;
      bi.push(a, b, b + 1, a, b + 1, a + 1);
    }
  }
  const band = new THREE.BufferGeometry();
  band.setAttribute('position', new THREE.Float32BufferAttribute(bp, 3)); band.setAttribute('wear', new THREE.Float32BufferAttribute(bw, 1));
  band.setAttribute('uv', new THREE.Float32BufferAttribute(buv, 2));
  band.setIndex(bi); band.computeVertexNormals();
  // the walls, straight down to each edge's foot; smooth across the shallow turns of the rounded ends
  const wp = [], wn = [], wuv = [], wi = [];
  let s = 0;
  for (let i = 0; i < n; i++) {
    const e = E[i];
    if (e.foot == null) { s += e.l; continue; }
    const j = (i + 1) % n, ePrev = E[(i + n - 1) % n], eNext = E[j];
    const nOut = [-e.nIn[0], -e.nIn[1]];
    const smooth = (o) => o.foot != null && (o.d[0] * e.d[0] + o.d[1] * e.d[1]) > Math.cos(35 * DEG);
    const avg = (o) => { const x = -(o.nIn[0] + e.nIn[0]), y = -(o.nIn[1] + e.nIn[1]), l = Math.hypot(x, y) || 1; return [x / l, y / l]; };
    const n0 = smooth(ePrev) ? avg(ePrev) : nOut, n1 = smooth(eNext) ? avg(eNext) : nOut;
    const b0 = wp.length / 3, pa = P[i], pb = P[j];
    const ya = Hf(pa[0]) - bv[i], yb = Hf(pb[0]) - bv[j];
    wp.push(...V(pa[0], ya, pa[1]), ...V(pb[0], yb, pb[1]), ...V(pb[0], e.foot, pb[1]), ...V(pa[0], e.foot, pa[1]));
    wn.push(n0[0], 0, -n0[1], n1[0], 0, -n1[1], n1[0], 0, -n1[1], n0[0], 0, -n0[1]);
    wuv.push(s, ya, s + e.l, yb, s + e.l, e.foot, s, e.foot);
    s += e.l;
    wi.push(b0, b0 + 3, b0 + 1, b0 + 1, b0 + 3, b0 + 2);
  }
  const walls = new THREE.BufferGeometry();
  walls.setAttribute('position', new THREE.Float32BufferAttribute(wp, 3)); walls.setAttribute('normal', new THREE.Float32BufferAttribute(wn, 3));
  walls.setAttribute('uv', new THREE.Float32BufferAttribute(wuv, 2)); walls.setAttribute('wear', new THREE.Float32BufferAttribute(new Array(wp.length / 3).fill(0), 1));
  walls.setIndex(wi);
  return { top, band, walls };
}

// ───────── Engraving ─────────
const tex = (cv, srgb = true) => { const t = new THREE.CanvasTexture(cv); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
/** Text along an arc (a ring's flat face, a dial's top): centred on angle a (canvas math angle, y up), tops outward. */
function arcText(g, str, cx, cy, R, a, size, color, weight = 600, inward = false) {
  g.save(); g.font = `${weight} ${size}px ${FONT}`; g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle';
  const w = g.measureText(str).width, span = w / R;
  let ang = a + (inward ? -span / 2 : span / 2);
  for (const ch of str) {
    const cw = g.measureText(ch).width, da = cw / R;
    ang += inward ? da / 2 : -da / 2;
    g.save(); g.translate(cx + R * Math.cos(ang), cy - R * Math.sin(ang)); g.rotate(Math.PI / 2 - ang + (inward ? Math.PI : 0)); g.fillText(ch, 0, 0); g.restore();
    ang += inward ? da / 2 : -da / 2;
  }
  g.restore();
}
/** Engraving, filled white: text laid out on a canvas region and placed as a decal plane (w × h mm). */
function engraver() {
  const W = 2048, Hh = 512, cv = canvas(W, Hh), g = cv.getContext('2d');
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
  let x = 0, y = 0, rowH = 0;
  const items = [];
  return {
    cv,
    /** reserve a region of pw × ph px and draw into it: fn(g, cx, cy); returns its uv rectangle */
    add(pw, ph, fn) {
      if (x + pw > W) { x = 0; y += rowH + 4; rowH = 0; }
      const r = { u0: x / W, u1: (x + pw) / W, v0: 1 - (y + ph) / Hh, v1: 1 - y / Hh };
      g.save(); fn(g, x + pw / 2, y + ph / 2); g.restore();
      x += pw + 4; rowH = Math.max(rowH, ph); items.push(r);
      return r;
    },
  };
}

// ───────── The body ─────────
function buildBody(lib, hov) {
  const core = new THREE.Group(), top = new THREE.Group(), base = new THREE.Group(), door = new THREE.Group();
  const leather = lib.get('vulcanite'), bc = lib.get('blackChrome'), steel = lib.get('steel'), bright = lib.get('chromeBright'), flock = lib.get('flock');
  const glassDark = lib.get('finderGlass'), frosted = lib.get('frosted');
  const ck = new Kit(), tk = new Kit(), bk = new Kit(), dk = new Kit();
  const yLo = DIM.base.top, rB = (B.zB - B.zF) / 2;

  // ── the leatherette: front and back panels between the half-round ends, and the ends
  // (the front panel stops round the bayonet, whose ring reaches above the leatherette's top edge to the plate)
  const RM = 25.85, xm = Math.sqrt(RM * RM - B.seam * B.seam), a0 = Math.atan2(B.seam, xm), frontPanel = [[B.x0 + rB, yLo], [B.x1 - rB, yLo], [B.x1 - rB, B.seam]];
  for (let k = 0; k <= 72; k++) { const a = a0 - (k / 72) * (Math.PI + 2 * a0); frontPanel.push([RM * Math.cos(a), RM * Math.sin(a)]); }
  frontPanel.push([B.x0 + rB, B.seam]);
  // (one sheet wrapped round the shell: the grain runs unbroken from the front, round each end, across the back and
  // the door — u the distance round the body's outline, a whole number of the grain's tiles to the lap; v the height)
  const zc = (B.zF + B.zB) / 2, xL = B.x0 + rB, xR = B.x1 - rB, lapW = xR - xL, lap = 2 * lapW + TAU * rB, lapK = Math.round(lap / VULC_TILE) * VULC_TILE / lap;
  const wrapUV = (g) => {
    const p = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      let s;
      if (x > xR) s = lapW + rB * Math.atan2(x - xR, zc - z);
      else if (x < xL) s = 2 * lapW + Math.PI * rB + rB * Math.atan2(xL - x, z - zc);
      else s = z < zc ? x - xL : lapW + Math.PI * rB + (xR - x);
      uv.setXY(i, s * lapK, p.getY(i));
    }
    return g;
  };
  // (only the faces that show: a buried face ending in its neighbour's surface shows there as a dashed line)
  ck.add(wrapUV(strip(zslab(shapeXY(frontPanel), B.zF, 1.6, 0, 0), [0, 0, 1], [1, 0, 0], [-1, 0, 0], [0, 1, 0])), leather);
  // Punch open rear back-door aperture behind the hinged M6 back flap so lifting doorK exposes the 24×36 mm film gate & twin curtains!
  const DR0 = DIM.door;
  const backPanelShape = rrShape(B.x0 + rB, yLo, B.x1 - rB, B.seam, 0, [
    rrPath(DR0.x0 + 1.4, DR0.y0 + 1.4, DR0.x1 - 1.4, DR0.y1 - 1.4, 0.8, new THREE.Path()),
  ]);
  ck.add(wrapUV(strip(zslab(backPanelShape, B.zB - 1.6, 1.6, 0, 0), [0, 0, -1], [1, 0, 0], [-1, 0, 0], [0, 1, 0])), leather);
  // Matte-black internal rear film-plane apron around the 24×36 mm open gate + polished steel film guide rails (visible when hinged back flap lifts!)
  ck.add(zslab(rrShape(DR0.x0 + 1.0, DR0.y0 + 1.0, DR0.x1 - 1.0, DR0.y1 - 1.0, 0.6, [
    rrPath(-18.0, -12.0, 18.0, 12.0, 0.3, new THREE.Path()),
  ]), -0.4, 2.2, 0.1), lib.get('satinBlack'));
  [-12.6, 12.6].forEach((ry) => ck.add(rbox(56.0, 1.6, 0.9, 0.15, 1), bright, T(0, ry, 2.0)));
  [-17.6, 17.6].forEach((ry) => ck.add(rbox(54.0, 1.2, 1.2, 0.15, 1), bright, T(0, ry, 2.2)));
  // Recessed matte-black battery chamber + twin stacked silver-oxide cells behind removable front battery cap!
  const BT0 = DIM.front.battery;
  ck.add(revolve([[BT0.r - 1.2, 0], [BT0.r - 1.2, 8.5], [0, 8.5]], { segs: 40 }), flock, T(BT0.x, BT0.y, B.zF));
  ck.add(revolve([[BT0.r - 2.4, 1.2], [BT0.r - 2.4, 6.2, 0.3], [0, 6.2]], { segs: 36 }), bright, T(BT0.x, BT0.y, B.zF + 0.6));
  ck.add(wrapUV(strip(vslab(roundPoly(rect(B.x1 - rB, B.x1, B.zF, B.zB), [0, rB, rB, 0], 18), yLo, B.seam - yLo, 0, 0), [-1, 0, 0], [0, 1, 0])), leather);
  ck.add(wrapUV(strip(vslab(roundPoly(rect(B.x0, B.x0 + rB, B.zF, B.zB), [rB, 0, 0, rB], 18), yLo, B.seam - yLo, 0, 0), [1, 0, 0], [0, 1, 0])), leather);
  // the chassis decks, seen when the plates come off
  [B.seam - 1.6, yLo].forEach((y) => ck.add(vslab(plan(B.x0 + 0.8, B.x1 - 0.8, B.zF + 0.8, B.zB - 0.8, rB - 0.8, rB - 0.8), y, 1.4, 0.3, 0.2), lib.get('satinBlack')));

  // ── the bayonet: a bright steel ring 3.1 mm proud of the leatherette (its face the lens's seat), six cross-head
  //    screws on a 23.7 mm circle; the throat behind it, flocked, back to the shutter
  ck.add(revolve([[21.3, DIM.flange, 0.2], [25.4, DIM.flange, 0.6], [25.81, DIM.flange + 0.4, 0.5], [25.81, B.zF]], { segs: 128, crease: 30 }), steel);
  ck.add(revolve([[21.3, -1.0], [21.3, DIM.flange]], { segs: 96 }), flock);
  const scrH = new Kit(), scrT = new Kit();
  for (let k = 0; k < 6; k++) {
    const a = (30 + 60 * k) * DEG;
    addScrew(ck, steel, scrH, flock, T(23.7 * Math.cos(a), 23.7 * Math.sin(a), DIM.flange, 0, Math.PI, 0), 1.3, true);
  }
  // the film gate as it shows through the mount (its rounded opening) + live focus-coupled rangefinder roller arm at top!
  ck.add(zslab(rrShape(-21.2, -21.2, 21.2, 21.2, 0, [rrPath(-16.65, -12.1, 17.4, 11.9, 2.0, new THREE.Path())]), -3.0, 0.6, 0), flock);
  const rfRoller = new THREE.Group(); rfRoller.position.set(7.4, 18.4, -24.0); core.add(rfRoller);
  {
    const rfk = new Kit();
    rfk.add(new THREE.CylinderGeometry(1.25, 1.25, 2.2, 28).rotateZ(Math.PI / 2), bright);
    rfk.add(rbar(3.2, 2.4, 1.2), bc, T(0, -1.6, 0, Math.PI / 2, 0, 0));
    rfk.build(rfRoller);
  }
  // True two-curtain horizontal rubberised-cloth focal-plane shutter (M6 1/50 s X-sync; traveling slit above 1/50 s!):
  // curtain 1 carries the 12 mm white TTL metering spot; curtain 2 follows behind it across the 24×36 mm gate!
  const curtain = new THREE.Group(); curtain.position.z = -1.75; core.add(curtain);
  const curtain1Cloth = new THREE.Mesh(prep(new THREE.PlaneGeometry(37.0, 24.8)), lib.get('curtain'));
  curtain1Cloth.rotation.y = Math.PI;
  const curtain1Lath = new THREE.Mesh(prep(rbox(1.1, 24.8, 0.35, 0.1, 1)), steel);
  curtain1Lath.position.set(18.5, 0, -0.1);
  const meterSpot = new THREE.Mesh(prep(new THREE.CircleGeometry(6, 48)), lib.get('meterSpot'));
  meterSpot.rotation.y = Math.PI; meterSpot.position.z = -0.06;
  const curtain2Cloth = new THREE.Mesh(prep(new THREE.PlaneGeometry(37.0, 24.8)), lib.get('curtain'));
  curtain2Cloth.rotation.y = Math.PI; curtain2Cloth.position.set(18.5, 0, 0.25); curtain2Cloth.scale.x = 0.001;
  const curtain2Lath = new THREE.Mesh(prep(rbox(1.1, 24.8, 0.35, 0.1, 1)), steel);
  curtain2Lath.position.set(18.5, 0, 0.32);
  curtain.add(curtain1Cloth, curtain1Lath, meterSpot, curtain2Cloth, curtain2Lath);
  // the meter cell, at about 11 o'clock in the open mount (the manual)
  ck.add(revolve([[0, -1.2], [1.6, -0.6], [1.6, 0]], { segs: 32 }), glassDark, T(19.0 * Math.sin(30 * DEG), 19.0 * Math.cos(30 * DEG), -20));

  // ── front fittings on the leatherette (the drawing's front view)
  const F = DIM.front;
  // the lens release (the drawing): a housing r 5.1 stepped at 4.45, a raised black ring r 3.72 round the animatable bright button
  // r 3.4 with its red index; the latch it works shows in the bayonet's face at 3 o'clock
  const LR = F.release, lr = (prof, mat) => ck.add(revolve(prof, { segs: 56, crease: 30 }), mat, T(LR.x, LR.y, B.zF));
  lr([[LR.rStep, -1.6, 0.4], [LR.rOuter - 0.35, -1.6, 0.5], [LR.rOuter, -1.2, 0.6], [LR.rOuter, 0]], bc);
  lr([[LR.rRing, -1.9], [LR.rStep - 0.2, -1.9, 0.3], [LR.rStep, -1.6, 0.4]], bc);
  lr([[LR.rButton + 0.05, -2.3], [LR.rRing - 0.2, -2.3, 0.4], [LR.rRing, -2.1, 0.5], [LR.rRing, -1.9]], bc);
  const lensRelBtn = new THREE.Group(); lensRelBtn.position.set(LR.x, LR.y, B.zF); core.add(lensRelBtn);
  {
    const lrk = new Kit();
    lrk.add(revolve([[0, -3.1], [LR.rButton - 0.5, -3.1, 0.3], [LR.rButton, -2.75, 0.5], [LR.rButton, -2.2]], { segs: 56, crease: 30 }), bright);
    lrk.add(new THREE.CircleGeometry(0.95, 24), lib.get('red'), T(0, 0, -3.11, 0, Math.PI, 0));
    lrk.build(lensRelBtn);
  }
  ck.add(zslab(rrShape(LR.latch[0], LR.latch[2], LR.latch[1], LR.latch[3], 0.6), DIM.flange - 0.02, 0.5, 0.12), lib.get('chrome'));
  // the battery cap (unscrewable on st.batCapK!): knurled rim, flat face with its coin slot
  const BT = F.battery;
  const batCap = new THREE.Group(); batCap.position.set(BT.x, BT.y, B.zF); core.add(batCap);
  {
    const bck = new Kit();
    bck.add(revolve([[BT.face, -1.7, 0.3, 1], [BT.r - 0.3, -1.7, 0.4, 1], [BT.r, -1.4, 0.5, 1], [BT.r, -0.3, 0.3, 1], [BT.r + 0.4, 0]], { segs: 540, crease: 30, ribs: { n: 90, depth: 0.22 } }), bc);
    bck.add(revolve([[0, -1.55], [BT.face - 0.3, -1.55], [BT.face, -1.7]], { segs: 64, crease: 8 }), bc);
    bck.add(rbar(7.5, 0.9, 0.5), flock, T(0, 0, -1.62, Math.PI / 2, 0, 0));
    bck.build(batCap);
  }
  // the rewind lever R (the drawing): a stem 4 mm wide, rounded at 25.5 just under the shoulder line, on a disc r 2.83
  // round its slotted screw; its knob near the top. It lies on the band and the leatherette
  const RL = F.rLever, rlF = B.zF - 1.0, rlPoly = [];
  { const [fx, fy, fr] = RL.foot, hw = (RL.x1 - RL.x0) / 2, aJ = Math.asin(hw / fr);
    for (let k = 0; k <= 40; k++) { const a = Math.PI / 2 + aJ + (k / 40) * (TAU - 2 * aJ); rlPoly.push([fx + fr * Math.cos(a), fy + fr * Math.sin(a)]); }
    for (let k = 0; k <= 16; k++) { const a = (k / 16) * Math.PI; rlPoly.push([fx + hw * Math.cos(a), RL.top - hw + hw * Math.sin(a)]); } }
  // (its own group, turning on its screw: swung over toward the R to free the film for rewinding)
  const rl = new THREE.Group(); rl.position.set(RL.screw[0], RL.screw[1], 0); core.add(rl);
  const rlk = new Kit(), rlHome = T(-RL.screw[0], -RL.screw[1], 0);
  rlk.add(zslab(shapeXY(rlPoly), rlF, 1.0, 0.3), bc, rlHome);
  rlk.add(revolve([[0, -1.9], [RL.knob[2] - 0.4, -1.9, 0.3], [RL.knob[2], -1.6, 0.5], [RL.knob[2], -1.0]], { segs: 32, crease: 30 }), bc, T(RL.knob[0] - RL.screw[0], RL.knob[1] - RL.screw[1], rlF + 1.0));
  addScrew(rlk, bc, rlk, flock, T(0, 0, rlF, 0, Math.PI, 0), RL.screw[2], false, 45 * DEG);
  rlk.build(rl);
  // the frame preselector: sculpted ergonomic curved Leica M6 paddle with tangent circular boss, curved waist & tactile ribbed window
  const SL = F.selector;
  const sel = new THREE.Group(); sel.position.set(SL.x, SL.y, B.zF); core.add(sel);
  const sk = new Kit(), selMat = lib.get('blackChrome', { hover: hov.preview });
  sk.add(revolve([[SL.r - 0.8, -2.0, 0.4], [SL.r, -1.6, 0.6], [SL.r, 0]], { segs: 56, crease: 30 }), selMat);
  sk.add(new THREE.CircleGeometry(SL.r - 0.8, 48), selMat, T(0, 0, -2.0, 0, Math.PI, 0));
  const arm = new THREE.Shape();
  const hw0 = SL.w / 2;
  arm.moveTo(-hw0, 0);
  arm.bezierCurveTo(-hw0, SL.len * 0.35, -(hw0 - 0.55), SL.len * 0.68, -(hw0 - 0.45), SL.len - 2.4);
  arm.quadraticCurveTo(-(hw0 - 0.45), SL.len, 0, SL.len + 0.35);
  arm.quadraticCurveTo(hw0 - 0.45, SL.len, hw0 - 0.45, SL.len - 2.4);
  arm.bezierCurveTo(hw0 - 0.55, SL.len * 0.68, hw0, SL.len * 0.35, hw0, 0);
  arm.closePath();
  arm.holes.push(rrPath(-1.75, SL.len - 9.0, 1.75, SL.len - 1.8, 0.95, new THREE.Path()));
  sk.add(slab(arm, 1.65, 0.45, 24, 0.45, 3), selMat, T(0, 0, -2.0));
  sk.add(new THREE.PlaneGeometry(3.5, 7.2), flock, T(0, SL.len - 5.4, -0.6, 0, Math.PI, 0));
  for (let gy = SL.len - 8.0; gy <= SL.len - 2.6; gy += 1.35) sk.add(rbox(2.8, 0.45, 0.55, 0.12, 1), selMat, T(0, gy, -0.72));
  const selMeshes = sk.build(sel, 'preview');
  // the strap lugs: smooth circular-head stainless eyelets with curved root fillets & flush anti-rub collar washers!
  DIM.lugs.x.forEach((x, i) => {
    const s = i === 0 ? 1 : -1, dzc = DIM.lugs.z - (B.zF + rB), xe = s > 0 ? B.x1 - rB + Math.sqrt(rB * rB - dzc * dzc) : B.x0 + rB - Math.sqrt(rB * rB - dzc * dzc);
    const reach = Math.abs(x - xe) + 0.6;
    const tongue = new THREE.Shape();
    const rHead = 2.65;
    tongue.moveTo(0, -3.4);
    tongue.bezierCurveTo(reach * 0.45, -3.3, reach * 0.72, -rHead, reach, -rHead);
    tongue.absarc(reach, 0, rHead, -Math.PI / 2, Math.PI / 2, false);
    tongue.bezierCurveTo(reach * 0.72, rHead, reach * 0.45, 3.3, 0, 3.4);
    tongue.closePath();
    tongue.holes.push(circlePath(reach, 0, 1.5));
    ck.add(slab(tongue, 2.4, 0.55, 24, 0.6, 3), steel, T(xe - s * 0.6, DIM.lugs.y, DIM.lugs.z + (s > 0 ? -1.2 : 1.2), 0, s > 0 ? 0 : Math.PI, 0));
    ck.add(revolve([[3.7, 0], [3.7, 0.65, 0.25], [3.1, 0.75]], { segs: 36 }), bc, T(xe - s * 0.2, DIM.lugs.y, DIM.lugs.z, 0, s * Math.PI / 2, 0));
  });

  // ── the top plate: the deck, the finder housing in two parts round the shoe's notch, the facet at the left end,
  //    and below them the band stepped back at the front under the shoulder line
  const outline = plan(TP.x0, TP.x1, TP.zF, TP.zB, TP.rL, TP.rR, 18);
  const N = DIM.notch;
  const near = (a, b) => Math.abs(a - b) < 1e-4;
  const OUT = 0.9;
  const edgeOf = (raised) => ([x, z]) => {
    if (near(x, TP.facetX)) return { b: 0, foot: null };
    if (onRim([x, z])) return { b: 0.35, foot: null };
    if (near(x, TP.step)) return raised && z < N.z0 ? { b: 0.6, foot: TP.deck } : { b: 0, foot: null };
    if (near(z, N.z0) && x > N.x0) return raised ? { b: 0.6, foot: TP.deck } : { b: 0, foot: null };
    if (near(z, N.z0)) return { b: 0, foot: null };
    if (near(x, N.x0) && z > N.z0) return raised ? { b: 0.6, foot: TP.deck } : { b: 0, foot: null };
    if (near(x, N.x0)) return { b: 0, foot: null };
    // (the straight front of the housing and of the deck: built below, with the windows' openings in it)
    if (near(z, TP.zF) && x > TP.facetX && x < TP.x1 - TP.rR) return { b: OUT, foot: null };
    return { b: OUT, foot: TP.shoulder };
  };
  const facetH = (x) => TP.housing - (TP.facetX - x) * TP.facetSlope;
  const add = (r) => { tk.add(r.top, bc); tk.add(r.band, bc); tk.add(r.walls, bc); };
  // the well the rewind knob stands in (the photographs: the plate's end is cut round it): a cylinder about the knob's
  // axis, 0.7 wider than the knob, from just under its seat up to the plate's surface; its rim, in plan, is bitten out
  // of the facet
  const RW = DIM.rewind, tilt = RW.tilt * DEG, axis = new THREE.Vector3(-Math.sin(tilt), Math.cos(tilt), 0);
  const rwBase = new THREE.Vector3(RW.x, RW.y, RW.z).addScaledVector(axis, -RW.h);
  const WR = RW.r + 0.7, wellSide = new THREE.Vector3(Math.cos(tilt), Math.sin(tilt), 0), surfH = (x) => (x < TP.facetX ? facetH(x) : TP.housing);
  const wellLines = [];
  for (let k = 0; k < 72; k++) {
    const ph = (k / 72) * TAU, p0 = rwBase.clone().addScaledVector(wellSide, WR * Math.cos(ph)).add(new THREE.Vector3(0, 0, WR * Math.sin(ph))).addScaledVector(axis, -0.4);
    let lo = 0, hi = 30;
    for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2, p = p0.clone().addScaledVector(axis, mid); if (p.y > surfH(p.x)) hi = mid; else lo = mid; }
    wellLines.push([p0, p0.clone().addScaledVector(axis, hi)]);
  }
  const rim = wellLines.map(([, t]) => [t.x, t.z]);
  const onRim = ([x, z]) => rim.some((a, i) => {
    const b = rim[(i + 1) % rim.length], dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / l2));
    return Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t) < 0.02;
  });
  const left = clip(outline, 0, TP.facetX, -1), mid = clip(clip(outline, 0, TP.facetX, 1), 0, TP.step, -1), right = clip(outline, 0, TP.step, 1);
  add(plateRegion(cutBy(left, rim), facetH, edgeOf(true)));
  // the well's wall, where it runs inside the plate, its floor under the knob (clipped to the plate outline),
  // and the continuous outer left wall closing the top plate cleanly under the tilted rewind pocket
  {
    const wp = [], wi = [], inward = (k) => { const ph = (k / 72) * TAU; return wellSide.clone().multiplyScalar(-Math.cos(ph)).add(new THREE.Vector3(0, 0, -Math.sin(ph))); };
    const inside = (v) => pointInPoly(v.x, v.z, outline);
    const rwFloor = rwBase.clone().addScaledVector(axis, -0.4);
    const yFloorAt = (x) => rwFloor.y + (x - rwFloor.x) * Math.tan(tilt);
    const yCylAt = (x, z) => {
      const v = z - rwBase.z;
      const u = -Math.sqrt(Math.max(0, WR * WR - v * v));
      return rwBase.y + (u - (x - rwBase.x) * Math.cos(tilt)) / Math.sin(tilt);
    };
    const clipLineInside = (a, b) => {
      const ia = inside(a), ib = inside(b);
      if (ia && ib) return [a, b];
      if (!ia && !ib) return null;
      let lo = 0, hi = 1;
      for (let i = 0; i < 24; i++) {
        const m = (lo + hi) * 0.5;
        const p = new THREE.Vector3().lerpVectors(a, b, m);
        if (inside(p) === ia) lo = m; else hi = m;
      }
      const cut = new THREE.Vector3().lerpVectors(a, b, (lo + hi) * 0.5);
      return ia ? [a, cut] : [cut, b];
    };
    for (let k = 0; k < 72; k++) {
      const sA = clipLineInside(wellLines[k][0], wellLines[k][1]);
      const sB = clipLineInside(wellLines[(k + 1) % 72][0], wellLines[(k + 1) % 72][1]);
      if (!sA || !sB) continue;
      const [a0, a1] = sA, [b0, b1] = sB;
      const base = wp.length / 3;
      wp.push(a0.x, a0.y, a0.z, b0.x, b0.y, b0.z, b1.x, b1.y, b1.z, a1.x, a1.y, a1.z);
      // (wound to face the knob)
      const n = new THREE.Vector3().subVectors(b0, a0).cross(new THREE.Vector3().subVectors(a1, a0));
      if (n.dot(inward(k)) > 0) wi.push(base, base + 1, base + 2, base, base + 2, base + 3); else wi.push(base, base + 2, base + 1, base, base + 3, base + 2);
    }
    const wg = new THREE.BufferGeometry();
    wg.setAttribute('position', new THREE.Float32BufferAttribute(wp, 3)); wg.setAttribute('uv', new THREE.Float32BufferAttribute(new Array((wp.length / 3) * 2).fill(0), 2));
    wg.setIndex(wi); wg.computeVertexNormals(); tk.add(wg, bc);
    // Clipped well floor (never protrudes past the left outer wall of the top plate) + solid underside closure
    const floor = new THREE.CircleGeometry(WR, 64); floor.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), axis));
    floor.translate(rwFloor.x, rwFloor.y, rwFloor.z);
    const fPos = floor.attributes.position;
    for (let i = 0; i < fPos.count; i++) {
      const vx = fPos.getX(i), vy = fPos.getY(i), vz = fPos.getZ(i);
      if (pointInPoly(vx, vz, outline)) continue;
      let lo = 0, hi = 1;
      for (let it = 0; it < 24; it++) {
        const m = (lo + hi) * 0.5;
        if (pointInPoly(lerp(rwFloor.x, vx, m), lerp(rwFloor.z, vz, m), outline)) lo = m; else hi = m;
      }
      fPos.setXYZ(i, lerp(rwFloor.x, vx, lo), lerp(rwFloor.y, vy, lo), lerp(rwFloor.z, vz, lo));
    }
    floor.computeVertexNormals();
    tk.add(floor, flock);
    // Close the bitten-out outer left vertical wall of the top plate from TP.shoulder up to the exact tilted pocket lip
    // (eliminates the rectangular cutout gap below the angled rewind crank while preserving the scooped top shoulder)
    const crossSeg = (p, q, r, s) => {
      const d = (q[0] - p[0]) * (s[1] - r[1]) - (q[1] - p[1]) * (s[0] - r[0]);
      if (Math.abs(d) < 1e-12) return null;
      const t = ((r[0] - p[0]) * (s[1] - r[1]) - (r[1] - p[1]) * (s[0] - r[0])) / d;
      const u = ((r[0] - p[0]) * (q[1] - p[1]) - (r[1] - p[1]) * (q[0] - p[0])) / d;
      return t >= 0 && t < 1 && u >= 0 && u < 1 ? { t, u } : null;
    };
    const ln = left.length, rn = rim.length, hits = [];
    for (let i = 0; i < ln; i++) {
      const p = left[i], q = left[(i + 1) % ln];
      for (let j = 0; j < rn; j++) {
        const h = crossSeg(p, q, rim[j], rim[(j + 1) % rn]);
        if (h) hits.push({ i, t: h.t, pt: [p[0] + (q[0] - p[0]) * h.t, p[1] + (q[1] - p[1]) * h.t] });
      }
    }
    if (hits.length === 2) {
      const afterPt = (h) => { const p = left[h.i], q = left[(h.i + 1) % ln], t = Math.min(1, h.t + 1e-4); return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]; };
      const entry = pointInPoly(...afterPt(hits[0]), rim) ? hits[0] : hits[1];
      const exit = entry === hits[0] ? hits[1] : hits[0];
      const arc = [entry.pt];
      let steps = (exit.i - entry.i + ln) % ln;
      if (steps === 0 && exit.t < entry.t) steps = ln;
      for (let c = 0, k = (entry.i + 1) % ln; c < steps; c++, k = (k + 1) % ln) arc.push(left[k]);
      arc.push(exit.pt);
      // Subdivide arc finely so the curved cylinder-lip silhouette follows yCylAt / yFloorAt smoothly
      const fine = [];
      for (let i = 0; i < arc.length - 1; i++) {
        const a = arc[i], b = arc[i + 1], sub = Math.max(2, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.6));
        for (let s = 0; s < sub; s++) fine.push([lerp(a[0], b[0], s / sub), lerp(a[1], b[1], s / sub)]);
      }
      fine.push(arc[arc.length - 1]);
      const yTopAt = (x, z) => Math.max(yFloorAt(x) + 0.05, Math.min(facetH(x) - OUT, yCylAt(x, z)));
      const owP = [], owN = [], owUV = [], owI = [];
      const shP = [], shI = [];
      const inCenter = [rwFloor.x, rwFloor.y, rwFloor.z];
      for (let i = 0; i < fine.length - 1; i++) {
        const [ax, az] = fine[i], [bx, bz] = fine[i + 1];
        const dx = bx - ax, dz = bz - az, l = Math.hypot(dx, dz) || 1;
        // Outward normal on left side of top plate points toward -X / outward from center (x=-50, z=-7.4)
        let nx = -dz / l, nz = dx / l;
        if (nx * ((ax + bx) * 0.5 + 50) + nz * ((az + bz) * 0.5 + 7.4) < 0) { nx = -nx; nz = -nz; }
        const ya = yTopAt(ax, az), yb = yTopAt(bx, bz), yBot = TP.shoulder - 0.15;
        const base = owP.length / 3;
        owP.push(ax, ya, az, bx, yb, bz, bx, yBot, bz, ax, yBot, az);
        owN.push(nx, 0, nz, nx, 0, nz, nx, 0, nz, nx, 0, nz);
        owUV.push(i, ya, i + 1, yb, i + 1, yBot, i, yBot);
        const e1 = new THREE.Vector3(bx - ax, yb - ya, bz - az), e2 = new THREE.Vector3(0, yBot - ya, 0);
        if (e1.cross(e2).dot(new THREE.Vector3(nx, 0, nz)) > 0) owI.push(base, base + 1, base + 2, base, base + 2, base + 3);
        else owI.push(base, base + 2, base + 1, base, base + 3, base + 2);
        // Upward-facing matte sealed pocket shelf bridging the outer wall top inward to the well floor
        const sb = shP.length / 3;
        shP.push(ax, ya, az, bx, yb, bz, inCenter[0], inCenter[1], inCenter[2]);
        const s1 = new THREE.Vector3(bx - ax, yb - ya, bz - az), s2 = new THREE.Vector3(inCenter[0] - ax, inCenter[1] - ya, inCenter[2] - az);
        if (s1.cross(s2).dot(axis) > 0) shI.push(sb, sb + 1, sb + 2); else shI.push(sb, sb + 2, sb + 1);
      }
      const owG = new THREE.BufferGeometry();
      owG.setAttribute('position', new THREE.Float32BufferAttribute(owP, 3));
      owG.setAttribute('normal', new THREE.Float32BufferAttribute(owN, 3));
      owG.setAttribute('uv', new THREE.Float32BufferAttribute(owUV, 2));
      owG.setIndex(owI);
      tk.add(owG, bc);
      const shG = new THREE.BufferGeometry();
      shG.setAttribute('position', new THREE.Float32BufferAttribute(shP, 3));
      shG.setAttribute('uv', new THREE.Float32BufferAttribute(new Array((shP.length / 3) * 2).fill(0), 2));
      shG.setIndex(shI); shG.computeVertexNormals();
      tk.add(shG, flock);
    }
  }
  // (the housing's front part meets the notch's corner partway along its back edge: split the edge there)
  add(plateRegion(splitEdges(clip(mid, 1, N.z0, -1), [[N.x0, N.z0]]), TP.housing, edgeOf(true)));
  add(plateRegion(clip(clip(mid, 1, N.z0, 1), 0, N.x0, -1), TP.housing, edgeOf(true)));
  add(plateRegion(clip(clip(mid, 1, N.z0, 1), 0, N.x0, 1), TP.deck, edgeOf(false)));
  add(plateRegion(right, TP.deck, edgeOf(false)));
  // below the shoulder line: the band, its front set back 0.5 mm, down to the leatherette; under the finder the plate
  // comes down 2.8 mm further at its full depth (the skirt), its end a small step at X −12.5
  // (the band stands a hair proud of the leatherette, never behind it: a lip of leatherette would catch the light as a line;
  // and each piece runs on a little way inside the one above, so that no joint between them can open to the background)
  const under = lib.get('blackChromeUnder');
  const band = outline.map(([x, z]) => [x, Math.max(z, Math.min(TP.zF + TP.inset, B.zF - 0.04))]);
  // (sharp-edged, so that at the back and the ends their walls run on from the plate's without a seam; a thin cap at
  // the full outline closes the underside of the overhang at the front)
  // (no edge wear on these: their rims lie in the plate's walls, where a rubbed edge would draw a line; and the cap is
  // only the front strip, so that none of its walls lies in the band's)
  tk.add(uncap(uncap(vslab(clip(band, 0, TP.shoulderX, 1), B.seam - 0.42, TP.shoulder - B.seam + 0.82, 0, 0)), -1), bc);
  tk.add(uncap(uncap(vslab(clip(band, 0, TP.shoulderX, -1), B.seam - 0.42, TP.shoulderLow - B.seam + 0.82, 0, 0)), -1), bc);
  tk.add(uncap(uncap(vslab(clip(outline, 0, TP.shoulderX, -1), TP.shoulderLow, TP.shoulder - TP.shoulderLow + 0.4, 0, 0)), -1), bc);
  tk.add(uncap(vslab(clip(clip(outline, 0, TP.shoulderX, -1), 1, TP.zF + TP.inset + 0.02, -1), TP.shoulderLow, 0.4, 0, 0)), under);
  tk.add(uncap(vslab(clip(clip(outline, 0, TP.shoulderX, 1), 1, TP.zF + TP.inset + 0.02, -1), TP.shoulder - 0.06, 0.4, 0, 0)), under);

  // the plate's straight front, the housing's and the deck's, with the three windows' openings
  const frontWall = (x0, x1, y1, holes) => {
    const sh = rrPath(-x1, TP.shoulder, -x0, y1, 0);
    holes.forEach(([a, b, c, d, r]) => sh.holes.push(rrPath(-b, c, -a, d, r, new THREE.Path())));
    const g = new THREE.ShapeGeometry(sh, 18); g.rotateY(Math.PI); g.translate(0, 0, TP.zF); tk.add(g, bc);
  };
  frontWall(TP.facetX, TP.step, TP.housing - OUT, [[...FINDER.window, 0.3], [...FINDER.frosted, 0.3]]);
  frontWall(TP.step, TP.x1 - TP.rR, TP.deck - OUT, [[...FINDER.rf, 0.3]]);
  // the three windows in the housing's front (the drawing's front view): each a black bezel round a clear pane, and
  // what shows through it — the finder window's nested frames, the strip along its foot (the drawing's line at 27.7)
  // and, in the middle, the rangefinder's bright patch mirror; the rangefinder window's dark prism; the illumination
  // window's eleven frosted ribs at 1.4 mm
  const paneMat = lib.get('m6pane'), cavity = lib.get('flock');
  const frontPlane = (x0, x1, y0, y1, r, z) => { const g = new THREE.ShapeGeometry(rrPath(-x1, y0, -x0, y1, r), 18); g.rotateY(Math.PI); g.translate(0, 0, z); return g; };
  const win = (bz, gl, rb, rg, depth) => {
    tk.add(zslab(rrShape(bz[0], bz[2], bz[1], bz[3], rb, [rrPath(gl[0], gl[2], gl[1], gl[3], rg, new THREE.Path())]), TP.zF - 0.35, 0.35, 0.12), bc);
    // the well behind the pane: its four walls, open to the front
    const [x0, x1, y0, y1] = gl, z0 = TP.zF - 0.02, z1 = TP.zF + depth;
    [[x0, y0, x1, y0], [x1, y0, x1, y1], [x1, y1, x0, y1], [x0, y1, x0, y0]].forEach(([ax, ay, bx, by]) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute([ax, ay, z0, bx, by, z0, bx, by, z1, ax, ay, z1], 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
      g.setIndex([0, 2, 1, 0, 3, 2]); g.computeVertexNormals(); tk.add(g, cavity);
    });
    tk.add(frontPlane(x0, x1, y0, y1, rg, TP.zF - 0.05), paneMat);
    return [x0, x1, y0, y1, z1];
  };
  {
    const [x0, x1, y0, y1, zb] = win(FINDER.windowBezel, FINDER.window, 0.51, 0.3, 7.0);
    tk.add(frontPlane(x0, x1, y0, y1, 0.3, zb), glassDark);
    // the frame mask's surround, a step in, and the strip at the foot
    tk.add(zslab(rrShape(x0 + 0.3, y0 + 1.9, x1 - 0.3, y1 - 0.3, 0.6, [rrPath(x0 + 1.6, y0 + 3.0, x1 - 1.9, y1 - 1.6, 0.5, new THREE.Path())]), TP.zF + 1.2, 0.3, 0), lib.get('m6maskWarm'));
    tk.add(frontPlane(x0 + 0.2, x1 - 0.2, y0 + 0.2, FINDER.windowStrip, 0.3, TP.zF + 0.6), lib.get('m6maskWarm'));
    // the patch mirror, barrel-shaped, on the finder's axis
    const pm = []; for (let k = 0; k <= 32; k++) { const a = (k / 32) * TAU; pm.push([FINDER.patchMirror[0] + 2.95 * Math.sign(Math.cos(a)) * Math.pow(Math.abs(Math.cos(a)), 0.45), FINDER.patchMirror[1] + 2.4 * Math.sign(Math.sin(a)) * Math.pow(Math.abs(Math.sin(a)), 0.3)]); }
    const pg = new THREE.ShapeGeometry(shapeXY(pm.map(([x, y]) => [-x, y])), 6); pg.rotateY(Math.PI); pg.translate(0, 0, TP.zF + 5.0);
    tk.add(pg, lib.get('m6patch'));
  }
  {
    const [x0, x1, y0, y1, zb] = win(FINDER.rfBezel, FINDER.rf, 0.5, 0.3, 5.0);
    tk.add(frontPlane(x0, x1, y0, y1, 0.3, zb), glassDark);
    tk.add(frontPlane(x0 + 1.2, x1 - 1.8, y0 + 0.9, y1 - 1.0, 0.4, zb - 0.6), lib.get('m6maskWarm'));
  }
  {
    const [x0, x1, y0, y1, zb] = win(FINDER.frostedBezel, FINDER.frosted, 0.6, 0.3, 0.8);
    tk.add(frontPlane(x0, x1, y0, y1, 0.3, zb - 0.3), frosted);
    const n = 11, w = (x1 - x0) / n, R = 1.0, half = Math.asin(w / 2 / R);
    for (let i = 0; i < n; i++) {
      const g = new THREE.CylinderGeometry(R, R, y1 - y0, 10, 1, true, Math.PI - half, 2 * half);
      g.translate(x0 + w * (i + 0.5), (y0 + y1) / 2, TP.zF - 0.22 + R);
      tk.add(g, frosted);
    }
  }
  // the eyepiece behind the finder window (the drawing's back view; the photographs): a black metal ring stepped out in
  // two, fine grooves round its face, the clear rounded-square window lit by the finder
  const E = DIM.eyepiece;
  const eyepiece = new Kit(), eyeMat = lib.get('blackChrome', { hover: hov.finder });
  eyepiece.add(revolve([[9.1, 0, 0.2], [9.1, 0.9, 0.4], [8.85, 1.2, 0.5], [8.6, 1.2], [8.5, 1.06], [8.4, 1.2], [8.2, 1.2], [8.1, 1.06], [8.0, 1.2], [7.8, 1.2, 0.3],
    [7.8, 2.2, 0.4], [7.6, 2.4], [7.5, 2.4], [7.5, 2.75, 0.5], [7.3, 2.9, 0.6], [6.6, 2.9, 0.5], [6.3, 2.75, 0.4], [6.0, 1.6], [0, 1.6]], { segs: 96, crease: 30 }), eyeMat, T(E.x, E.y, TP.zB));
  eyepiece.add(new THREE.ShapeGeometry(rrPath(-4.3, -4.0, 4.3, 4.0, 1.3), 18), lib.get('m6eyeWindow'), T(E.x, E.y, TP.zB + 1.63));
  // the flash socket (the back photograph): a black collar r 4.07, the bright socket in it with its ridges, the pin
  const PC = DIM.pc, pcT = T(PC.x, PC.y, TP.zB);
  tk.add(revolve([[PC.r, 0, 0.2], [PC.r, 0.45, 0.4], [PC.r - 0.35, 0.7, 0.4], [3.3, 0.7]], { segs: 56, crease: 30 }), bc, pcT);
  tk.add(revolve([[3.3, 0.4], [3.3, 0.95, 0.3], [3.0, 1.15, 0.5], [2.7, 1.15], [2.6, 1.05], [2.3, 1.15], [1.6, 1.15, 0.3], [1.35, 0.95], [1.0, 0.95]], { segs: 56, crease: 30 }), bright, pcT);
  tk.add(new THREE.CircleGeometry(1.0, 28), flock, T(PC.x, PC.y, TP.zB + 0.9));
  tk.add(new THREE.CylinderGeometry(0.35, 0.35, 0.6, 20).rotateX(Math.PI / 2), bright, T(PC.x, PC.y, TP.zB + 1.15));

  // ── the hot shoe in its notch (the photographs): the base, the two black rails (the left one's front corner cut), the
  //    keyhole contact in its black plastic insert running to the back edge, the small screw at the front
  const sx0 = N.x0 + 0.4, sx1 = TP.step - 0.4, sz0 = N.z0 + 0.3, sz1 = TP.zB - 0.3;
  tk.add(vslab(roundPoly(rect(sx0, sx1, sz0, sz1), 0.6), TP.deck - 0.1, 40.7 - TP.deck + 0.1, 0.2), bc);
  tk.add(vslab(roundPoly([[sx0, sz0 + 2.5], [sx0 + 2.5, sz0], [sx0 + 4.6, sz0], [sx0 + 4.6, sz1], [sx0, sz1]], 0.3), 40.6, 3.4, 0.3), bc);
  tk.add(vslab(roundPoly(rect(sx0 + 4.6, sx0 + 5.6, sz0 + 1.0, sz1), 0.2), 42.7, 1.3, 0.15), bc);
  tk.add(vslab(roundPoly(rect(sx1 - 4.2, sx1, sz0 + 1.0, sz1), 0.4), 40.6, 3.4, 0.3, 1.0), bc);
  tk.add(vslab(roundPoly(rect(sx1 - 5.2, sx1 - 4.2, sz0 + 1.0, sz1), 0.2), 42.7, 1.3, 0.15), bc);
  // (a keyhole: a round head toward the front, its tail running back — in plan, as a shape whose −y is +Z)
  const keyholeShape = (r, hw, tail) => {
    const a0 = Math.atan2(-Math.sqrt(r * r - hw * hw), hw), pts = [];
    for (let k = 0; k <= 36; k++) { const a = a0 + (k / 36) * (Math.PI - 2 * a0 + 0); pts.push([r * Math.cos(a), r * Math.sin(a)]); }
    pts.push([-hw, -tail], [hw, -tail]);
    return shapeXY(pts);
  };
  const KH = [7.65, 0.1];
  tk.add(slab(keyholeShape(3.4, 2.7, sz1 - 0.15 - KH[1]), 0.12, 0).rotateX(-Math.PI / 2), lib.get('palpas'), T(KH[0], 40.62, KH[1]));
  tk.add(slab(keyholeShape(2.0, 1.2, 3.9), 0.4, 0.12).rotateX(-Math.PI / 2), bright, T(KH[0], 40.62, KH[1]));
  addScrew(tk, bc, scrT, flock, T(7.4, 40.7, -8.0, -Math.PI / 2, 0, 0), 0.9);

  // ── the rewind knob in its well in the facet, its axis leaning 33.7° out over the end (the drawing's front view): a
  //    plain cylinder r 7.2, knurled round its foot; the crank folded flat across its top, its little knurled handle
  //    hanging down the inner side (the photographs)
  const rewind = new THREE.Group(); rewind.position.copy(rwBase); rewind.rotation.z = tilt; top.add(rewind);
  const rwSpin = new THREE.Group(); rewind.add(rwSpin);
  tk.add(upright(revolve([[RW.r - 0.5, -4.0], [RW.r - 0.5, 0.3], [RW.r - 1.4, 0.6], [0, 0.6]], { segs: 64, crease: 30 })).applyMatrix4(new THREE.Matrix4().makeRotationZ(tilt)).translate(rwBase.x, rwBase.y, rwBase.z), bc);
  const rk = new Kit(), kt = RW.h - 1.0, rc = RW.r - 0.25, beta = -28 * DEG, hw2 = 1.8;
  rk.add(upright(revolve([[RW.r - 0.5, 0.6, 0.3, 1], [RW.r, 1.1, 0.5, 1], [RW.r, 2.6, 0.3, 1], [RW.r, 2.8], [RW.r, kt - 0.55, 0.5], [RW.r - 0.25, kt - 0.1, 0.6], [RW.r - 0.55, kt], [0, kt]], { segs: 384, crease: 30, ribs: { n: 64, depth: 0.2 } })), bc);
  rk.build(rwSpin);
  // Animatable unfolding Leica M6 rewind crank bar + knurled grip handle (unfolds cleanly on st.crankOpen!)
  const toXZ = ([u, v]) => [u * Math.cos(beta) + v * Math.sin(beta), -u * Math.sin(beta) + v * Math.cos(beta)], ue = Math.sqrt(rc * rc - hw2 * hw2);
  const earR = 1.65, earCx = rc + 1.55;
  const pivXZ = toXZ([-rc + 1.2, 0]);
  const rwCrankPivot = new THREE.Group(); rwCrankPivot.position.set(pivXZ[0], kt, pivXZ[1]); rwSpin.add(rwCrankPivot);
  {
    const rck = new Kit();
    const barPoly = [[ue, -hw2]];
    for (let k = 0; k <= 20; k++) { const a = -Math.PI * 0.56 + (k / 20) * (Math.PI * 1.12); barPoly.push([earCx + earR * Math.cos(a), earR * Math.sin(a)]); }
    barPoly.push([ue, hw2]);
    for (let k = 0; k <= 20; k++) { const v = hw2 - (2 * hw2 * k) / 20; barPoly.push([-Math.sqrt(rc * rc - v * v), v]); }
    rck.add(vslab(barPoly.map(toXZ).map(([x, z]) => [x - pivXZ[0], z - pivXZ[1]]), 0, 1.0, 0.38, 0.8), bc);
    const hp = toXZ([earCx, 0]);
    rck.add(upright(revolve([[1.25, -3.2, 0.3, 1], [1.4, -3.0, 0.4, 1], [1.4, -0.3, 0.3, 1], [1.2, 0]], { segs: 160, crease: 30, ribs: { n: 20, depth: 0.15 } })), bc, T(hp[0] - pivXZ[0], 0.2, hp[1] - pivXZ[1]));
    rck.build(rwCrankPivot);
  }

  // ── the shutter-speed dial: knurled, its speeds on its top round an off-centre screw, read against the index
  const D = DIM.dial;
  const dial = new THREE.Group(); dial.position.set(D.x, TP.deck, D.z); top.add(dial);
  const dialMat = lib.get('blackChrome', { hover: hov.shutter });
  const dkit = new Kit();
  dkit.add(upright(revolve([[D.r - 1.2, 0], [D.r - 1.2, D.base - TP.deck], [D.r - 0.3, D.base - TP.deck, 0.3, 1], [D.r, D.base - TP.deck + 0.4, 0.4, 1], [D.r, D.top - TP.deck - 0.6, 0.5, 1], [D.r - 0.45, D.top - TP.deck, 0.6], [0, D.top - TP.deck]], { segs: 352, crease: 30, ribs: { n: 44, depth: 0.42, groove: 0.42, edge: 0.2 } })), dialMat);
  // (the speeds as the photographs show them: B toward −X with the dial at rest, the rest anticlockwise from it seen
  // from above — 1, 2, 4 … 60, the flash setting, 125 … 1000 — 13 stops round the dial, each number reading inward
  // from the rim; B and the flash sign in orange)
  const dialCv = canvas(1024, 1024), dg = dialCv.getContext('2d'), DPX = 512 / (D.r - 0.45);
  dg.fillStyle = '#0d0d0e'; dg.fillRect(0, 0, 1024, 1024);
  DIAL_LABELS.forEach((lb, p) => {
    const th = Math.PI + p * DIAL_STEP, orange = lb === 'B' || lb === '⚡';
    dg.save(); dg.fillStyle = orange ? '#e9a72a' : INK.white; dg.strokeStyle = dg.fillStyle;
    const capH = 1.2 * DPX;
    dg.font = `700 ${capH / 0.72}px ${FONT}`; dg.textAlign = 'center'; dg.textBaseline = 'middle';
    const w = lb === '⚡' ? 1.6 * DPX : dg.measureText(lb).width, R = 0.93 * 512 - w / 2;
    dg.translate(512 + R * Math.cos(th), 512 - R * Math.sin(th)); dg.rotate(Math.PI - th);
    if (lb === '⚡') {
      // the flash sign: a bolt with its arrowhead pointing out to the rim
      dg.lineWidth = 0.22 * DPX; dg.lineJoin = 'miter';
      dg.beginPath(); dg.moveTo(0.8 * DPX, -0.25 * DPX); dg.lineTo(0, 0.25 * DPX); dg.lineTo(0, -0.25 * DPX); dg.lineTo(-0.7 * DPX, 0.2 * DPX); dg.stroke();
      dg.beginPath(); dg.moveTo(-1.0 * DPX, 0.38 * DPX); dg.lineTo(-0.48 * DPX, 0.36 * DPX); dg.lineTo(-0.7 * DPX, -0.02 * DPX); dg.closePath(); dg.fill();
    } else dg.fillText(lb, 0, capH * 0.04);
    dg.restore();
  });
  const dialFace = new THREE.MeshPhysicalMaterial({ name: 'dialFace', map: tex(dialCv), metalness: 0.5, roughness: 0.36, clearcoat: 0.3, clearcoatRoughness: 0.3 });
  lib.prepare(dialFace, { hover: hov.shutter, wear: null });
  dkit.add(new THREE.CircleGeometry(D.r - 0.45, 72).rotateX(-Math.PI / 2), dialFace, T(0, D.top - TP.deck + 0.01, 0));
  addScrew(dkit, dialMat, dkit, lib.get('flock'), T(D.screw[0], D.top - TP.deck + 0.02, D.screw[1], -Math.PI / 2, 0, 0), 1.25);
  const dialMeshes = dkit.build(dial, 'shutter');

  // ── the wind lever's hub (the drawing's front view, the photographs): the base disc on the deck, a groove, the
  //    lever's own ring (it turns), the release's collar above it with its rounded top, the bright button in the middle
  const Hb = DIM.hub, RLs = DIM.release, hy = (y) => y - TP.deck, ht = hy(Hb.top);
  tk.add(upright(revolve([[Hb.r - 0.2, 0], [Hb.r, 0.2, 0.3], [Hb.r, hy(Hb.groove) - 0.15, 0.4], [Hb.r - 0.3, hy(Hb.groove)], [7.6, hy(Hb.groove)], [7.6, hy(Hb.ring) + 0.05]], { segs: 96, crease: 30 })), bc, T(Hb.x, TP.deck, Hb.z));
  tk.add(upright(revolve([[7.7, hy(Hb.ringTop) + 0.05], [8.0, hy(Hb.ringTop) + 0.05], [8.2, hy(Hb.ringTop) + 0.25, 0.3], [8.2, ht - 0.65, 0.5], [8.11, ht - 0.33, 0.7], [7.87, ht - 0.09, 0.8], [7.55, ht, 0.6], [RLs.r + 0.45, ht, 0.3], [RLs.r + 0.2, ht - 0.4]], { segs: 96, crease: 34 })), bc, T(Hb.x, TP.deck, Hb.z));
  const release = new THREE.Group(); release.position.set(Hb.x, Hb.top, Hb.z); top.add(release);
  const relK = new Kit(), relMat = lib.get('chromeBright', { hover: hov.release }), rt = RLs.top - Hb.top;
  relK.add(upright(revolve([[RLs.r, -0.8], [RLs.r, rt - 0.45, 0.4], [RLs.r - 0.18, rt - 0.12, 0.6], [RLs.r - 0.5, rt, 0.5], [1.5, rt, 0.3], [1.05, rt - 0.3], [1.05, rt - 2.0]], { segs: 64, crease: 34 })), relMat);
  relK.add(new THREE.CircleGeometry(1.05, 20).rotateX(-Math.PI / 2), lib.get('flock'), T(0, rt - 1.9, 0));
  const releaseMeshes = relK.build(release, 'release');
  // the lever at rest: sculpted continuous Bezier S-curved black-chrome arm + hinged ergonomic curved plastic tip with machined pivot pin!
  // Note: slab rotated rx=-PI/2 maps (sx, sy) -> local (x = sx, z = -sy), relative to hub (Hb.x=53.6, Hb.z=-14.15)
  const lever = new THREE.Group(); lever.position.set(Hb.x, Hb.ring, Hb.z); top.add(lever);
  const lk = new Kit(), leverMat = lib.get('blackChrome', { hover: hov.crank }), tipMat = lib.get('leverTip', { hover: hov.crank });
  const rh = Hb.ringTop - Hb.ring;
  lk.add(upright(revolve([[7.5, 0], [7.85, 0], [8.0, 0.15, 0.4], [8.0, rh - 0.15, 0.4], [7.85, rh], [7.5, rh]], { segs: 96, crease: 30 })), leverMat);
  const m6Arm = new THREE.Shape();
  // Smooth S-swept metal arm emerging tangentially off hub & curving rearward to the hinged tip knuckle (world X=40.6, Z=+5.6)
  m6Arm.moveTo(4.0, -1.6);
  m6Arm.bezierCurveTo(7.4, -3.4, 7.6, -6.2, 5.2, -9.8);
  m6Arm.bezierCurveTo(1.8, -14.8, -2.4, -20.8, -7.8, -22.5);
  m6Arm.bezierCurveTo(-11.2, -23.0, -13.6, -21.8, -13.6, -18.5);
  m6Arm.bezierCurveTo(-13.6, -14.8, -13.4, -12.6, -11.4, -10.8);
  m6Arm.bezierCurveTo(-8.2, -8.0, -5.2, -6.0, -3.4, -1.8);
  m6Arm.closePath();
  lk.add(slab(m6Arm, 1.9, 0.65, 32, 0.65, 3), leverMat, T(0, 0.1, 0, -Math.PI / 2, 0, 0));
  // Articulated ergonomic curved plastic thumb tip: smooth convex rear cheek + concave thumb cradle + rounded finger end
  const m6Tip = new THREE.Shape();
  m6Tip.moveTo(-12.2, -22.5);
  m6Tip.bezierCurveTo(-19.5, -23.2, -28.0, -23.1, -34.0, -22.4);
  m6Tip.bezierCurveTo(-36.0, -22.0, -36.2, -19.2, -35.6, -17.6);
  m6Tip.bezierCurveTo(-34.8, -15.8, -32.2, -15.4, -27.5, -14.6);
  m6Tip.bezierCurveTo(-21.2, -13.6, -16.0, -12.2, -12.6, -11.4);
  m6Tip.bezierCurveTo(-10.8, -11.8, -10.6, -21.8, -12.2, -22.5);
  lk.add(slab(m6Tip, DIM.top.housing - Hb.ring, 1.25, 32, 0.5, 4), tipMat, T(0, 0, 0, -Math.PI / 2, 0, 0));
  // Subtle machined stainless articulation hinge pin at the metal-to-plastic joint
  lk.add(upright(revolve([[1.25, 0], [1.25, DIM.top.housing - Hb.ring + 0.12, 0.25], [0, DIM.top.housing - Hb.ring + 0.16]], { segs: 28 })), steel, T(-13.2, 0, 17.5));
  const leverMeshes = lk.build(lever, 'crank');

  // ── the frame counter under its magnifier
  const C = DIM.counter;
  tk.add(upright(revolve([[C.recess, -0.4], [C.recess, 0.02], [C.dome + 0.3, 0.02], [C.dome + 0.3, -0.4]], { segs: 64 })), flock, T(C.x, TP.deck, C.z));
  const ctrCv = canvas(256, 256), ctrTex = tex(ctrCv);
  const counterDisc = new THREE.Mesh(prep(new THREE.CircleGeometry(C.dome - 0.3, 48).rotateX(-Math.PI / 2)), lib.prepare(new THREE.MeshStandardMaterial({ name: 'm6counter', map: ctrTex, roughness: 0.5, metalness: 0, emissive: 0xffffff, emissiveMap: ctrTex, emissiveIntensity: 0.1 }), {}));
  counterDisc.position.set(C.x, TP.deck + 0.06, C.z); top.add(counterDisc);
  tk.add(upright(revolve([[C.dome + 0.3, 0], [C.dome, 0.3, 0.3], [C.dome - 1.2, C.top - TP.deck - 0.05], [0, C.top - TP.deck]], { segs: 48 })), lib.get('m6dome'), T(C.x, TP.deck, C.z));

  // ── engravings filled white: GLASS / WORKS where the front lettering is, GLASS WORKS where the Wetzlar engraving
  //    is on top, the R by the rewind lever, the dial's index
  // (each laid out to the box it fills: its letters' cap height to the box's height; spaced across its width, as the
  // maker's front lettering is, when a width is given)
  const eg = engraver(), PXMM = 40;
  const letters = (txt, wMM, hMM, { weight = 500, sx = 1.2, spaced = true } = {}) => {
    const hp = Math.round(hMM * PXMM), probe = eg.cv.getContext('2d');
    probe.save(); probe.textBaseline = 'alphabetic'; probe.font = `${weight} 100px ${FONT}`;
    const cap = probe.measureText('H').actualBoundingBoxAscent, size = (100 * hp) / cap;
    probe.font = `${weight} ${size}px ${FONT}`;
    const glyphs = [...txt].map((ch) => ({ ch, w: probe.measureText(ch).width * sx }));
    probe.restore();
    const natural = glyphs.reduce((t, gl) => t + gl.w, 0);
    const wp = wMM ? Math.round(wMM * PXMM) : Math.round(natural);
    const gap = spaced && glyphs.length > 1 ? (wp - natural) / (glyphs.length - 1) : 0;
    const r = eg.add(wp, hp, (g, cx, cy) => {
      g.font = `${weight} ${size}px ${FONT}`; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
      let x = cx - wp / 2;
      glyphs.forEach(({ ch, w }) => { g.save(); g.translate(x, cy + hp / 2); g.scale(sx, 1); g.fillText(ch, 0, 0); g.restore(); x += w + gap; });
    });
    return { r, w: wp / PXMM, h: hMM };
  };
  const rGlass = letters('GLASS', 18.6, 3.2), rWorks = letters('WORKS', 17.0, 2.8, { sx: 1.1 });
  const rTop = letters('GLASS WORKS', null, 2.0, { sx: 1.0, spaced: false }), rR = letters('R', null, 2.1, { sx: 1.0 });
  const rIdx = eg.add(24, 128, (g, cx, cy) => { g.fillRect(cx - 9, cy - 56, 18, 112); });
  const rFill = eg.add(16, 16, (g, cx, cy) => { g.fillRect(cx - 8, cy - 8, 16, 16); });
  const rMade = letters('MADE IN GERMANY', 30.0, 2.3, { weight: 500, sx: 1.0 });
  const decTex = tex(eg.cv, false);
  const ink = lib.prepare(new THREE.MeshStandardMaterial({ name: 'm6ink', color: 0xe8e6de, roughness: 0.5, alphaMap: decTex, alphaTest: 0.5, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), {});
  const inkDim = lib.prepare(new THREE.MeshStandardMaterial({ name: 'm6inkDim', color: 0x34322f, roughness: 0.75, alphaMap: decTex, alphaTest: 0.5, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), {});
  const decal = (w, h, r, m, kit = tk, mat = ink) => { const g = new THREE.PlaneGeometry(w, h); decalUV(g, r); kit.add(g, mat, m); };
  const front = (cx, cy, z = TP.zF - 0.02) => T(cx, cy, z, 0, Math.PI, 0);
  // (GLASS across the maker's name, X 39.9–58.5; WORKS under it, ending where the model's name ends, at X 39.9)
  decal(rGlass.w, rGlass.h, rGlass.r, front(49.2, 34.3));
  decal(rWorks.w, rWorks.h, rWorks.r, front(39.9 + rWorks.w / 2, 29.6));
  decal(rTop.w, rTop.h, rTop.r, T(-27.0, TP.housing + 0.02, 5.0, -Math.PI / 2, 0, 0));
  decal(rR.w, rR.h, rR.r, T(38.55, 21.85, B.zF - 0.02, 0, Math.PI, 0));
  // (the speed index: a line on the housing's top at its corner by the dial, X 13.4–17.3, the top photograph)
  decal(0.6, 4.45, rIdx, T(15.35, TP.housing + 0.02, D.z - 0.3, -Math.PI / 2, 0, Math.PI / 2));
  // the origin, pressed into the leatherette right of the back door in a ruled box (the drawing's back view)
  const MB = [61.84, 65.78, -20.03, 12.92], mbX = (MB[0] + MB[1]) / 2, mbY = (MB[2] + MB[3]) / 2;
  decal(rMade.w, rMade.h, rMade.r, T(mbX, mbY, B.zB + 0.02, 0, 0, -Math.PI / 2), ck, inkDim);
  [[MB[0], MB[2], MB[0] + 0.16, MB[3]], [MB[1] - 0.16, MB[2], MB[1], MB[3]], [MB[0], MB[2], MB[1], MB[2] + 0.16], [MB[0], MB[3] - 0.16, MB[1], MB[3]]]
    .forEach(([a, b, c, d]) => decal(c - a, d - b, rFill, T((a + c) / 2, (b + d) / 2, B.zB + 0.02), ck, inkDim));

  // ── the baseplate (satin black: the photographs): its locking key under the rewind end, a black disc r 5.45 lying
  //    flush in its ring with the folded flap's slot across it; the tripod bush near the right end, a thin black ring
  //    round the 1/4" thread
  const bcs = lib.get('blackChromeSatin'), down = (x, z) => T(x, B.bottom, z, Math.PI / 2, 0, 0);
  bk.add(vslab(plan(B.x0 - 0.15, B.x1 + 0.15, B.zF - 0.15, B.zB + 0.15, rB + 0.15, rB + 0.15), B.bottom, yLo - B.bottom + 0.1, 1.6, 0.9), bcs);
  const K = DIM.key, S = DIM.socket;
  bk.add(new THREE.RingGeometry(5.45, 6.3, 64).rotateX(Math.PI / 2), flock, T(K.x, B.bottom - 0.02, K.z));
  // Animatable baseplate locking key (rotates from CLOSE to OPEN on st.baseKey, folding D-ring handle swings down on st.baseKeyLift!)
  const baseKeySpin = new THREE.Group(); baseKeySpin.position.set(K.x, B.bottom, K.z); base.add(baseKeySpin);
  {
    const bkk = new Kit();
    bkk.add(revolve([[5.45, 0.02], [5.45, 0.1, 0.3], [5.2, 0.25, 0.5], [0, 0.25]], { segs: 64, crease: 30 }), bcs, T(0, 0, 0, Math.PI / 2, 0, 0));
    bkk.add(rbar(8.4, 0.35, 0.06), flock, T(0, -0.31, 1.2));
    bkk.build(baseKeySpin);
  }
  const baseKeyFlip = new THREE.Group(); baseKeyFlip.position.set(0, -0.4, 1.2); baseKeySpin.add(baseKeyFlip);
  { const g = new THREE.TorusGeometry(4.1, 0.42, 8, 40, Math.PI).rotateX(-Math.PI / 2); g.scale(1, 0.55, 1); const fk2 = new Kit(); fk2.add(g, bcs); fk2.build(baseKeyFlip); }
  {
    const cv = canvas(1024, 384), g = cv.getContext('2d'), cx = 512, cy = -188, R = 376, a0 = Math.PI / 2 - 0.87, a1 = Math.PI / 2 + 0.87;
    g.strokeStyle = '#fff'; g.fillStyle = '#fff'; g.lineWidth = 9; g.lineCap = 'butt';
    g.beginPath(); g.arc(cx, cy, R, a0 + 0.05, a1 - 0.05); g.stroke();
    [[a0, -1], [a1, 1]].forEach(([a, sg]) => {
      const px = cx + R * Math.cos(a), py = cy + R * Math.sin(a), tx = -Math.sin(a) * sg, ty = Math.cos(a) * sg, nx = Math.cos(a), ny = Math.sin(a);
      g.beginPath(); g.moveTo(px + tx * 8, py + ty * 8); g.lineTo(px - tx * 30 + nx * 17, py - ty * 30 + ny * 17); g.lineTo(px - tx * 30 - nx * 17, py - ty * 30 - ny * 17); g.closePath(); g.fill();
    });
    g.font = `500 54px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('OPEN', cx - 205, 236); g.fillText('CLOSE', cx + 205, 236);
    const keyInk = lib.prepare(new THREE.MeshStandardMaterial({ name: 'm6keyInk', color: 0xe8e6de, roughness: 0.5, alphaMap: tex(cv, false), alphaTest: 0.5, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), {});
    bk.add(new THREE.PlaneGeometry(25.6, 9.6), keyInk, T(K.x, B.bottom - 0.02, K.z + 9.5, Math.PI / 2, 0, Math.PI));
  }
  bk.add(revolve([[3.7, 0], [3.7, 0.1, 0.3], [3.5, 0.18, 0.4], [3.15, 0.18]], { segs: 48, crease: 30 }), bcs, down(S.x, S.z));
  bk.add(new THREE.RingGeometry(2.4, 3.15, 40).rotateX(Math.PI / 2), lib.get('satinBlack'), T(S.x, B.bottom - 0.17, S.z));
  bk.add(new THREE.CircleGeometry(2.4, 32).rotateX(Math.PI / 2), flock, T(S.x, B.bottom - 0.16, S.z));

  // ── the hinged back door: fixed side rails stay on body core; hinged flap pivots upward along top edge (y=DR.y1, z=B.zB+0.5) on st.doorK!
  const DR = DIM.door;
  DR.rails.forEach(([x0, x1]) => ck.add(zslab(rrShape(x0, DR.railY[0], x1, DR.railY[1], 0.8), B.zB, 0.6, 0.2), bc));
  const doorHingeY = DR.y1, doorHingeZ = B.zB + 0.5;
  door.position.set(0, doorHingeY, doorHingeZ);
  const dOff = T(0, -doorHingeY, -doorHingeZ);
  dk.add(zslab(rrShape(DR.x0, DR.y0, DR.x1, DR.y1, 1.5), B.zB, 1.0, 0.35), bc, dOff);
  dk.add(wrapUV(zslab(rrShape(DR.inset[0], DR.inset[2], DR.inset[1], DR.inset[3], 0.51), B.zB + 0.9, 0.4, 0.12)), leather, dOff);
  // Spring-mounted matte-black inner film pressure plate on inside of swinging M6 back flap!
  dk.add(rbox(46.0, 32.0, 1.0, 0.3, 2), lib.get('satinBlack'), T(0, -doorHingeY, B.zB - 0.6 - doorHingeZ));
  DR.screws.forEach(([x, y]) => dk.add(revolve([[1.65, 0, 0.3], [1.65, 0.25, 0.5], [1.2, 0.5, 0.6], [0, 0.55]], { segs: 36, crease: 30 }), bc, T(x, y - doorHingeY, B.zB + 1.0 - doorHingeZ)));
  // the TTL meter film-speed dial (M6 manual p. 20; Leica handbook 1989 p. 4-9): sets the TTL meter's film speed
  // (ISO 6–6400 on lower half, DIN 9°–39° on upper half, 1/3-stop detents; inner ribbed ring aligns both triangles)
  const I = DIM.iso, isoCv = canvas(1024, 1024);
  drawIsoScale(isoCv, 512 / 15.21);
  const isoFace = lib.prepare(new THREE.MeshPhysicalMaterial({ name: 'isoFace', map: tex(isoCv), metalness: 0.35, roughness: 0.45 }), {});
  dk.add(revolve([[I.r, 0, 0.4], [I.r, 1.0, 0.6], [I.r - 0.4, 1.5, 0.5], [15.21, 1.5]], { segs: 96, crease: 30 }), bc, T(I.x, I.y - doorHingeY, B.zB + 0.9 - doorHingeZ));
  dk.add(new THREE.RingGeometry(8.1, 15.21, 96, 1), isoFace, T(I.x, I.y - doorHingeY, B.zB + 2.4 - doorHingeZ));
  const isoRing = new THREE.Group(); isoRing.position.set(I.x, I.y - doorHingeY, B.zB + 0.9 - doorHingeZ); door.add(isoRing);
  const ik = new Kit();
  ik.add(revolve([[8.1, 1.4], [8.1, 1.85, 0.3], [7.85, 2.0, 0.4], [5.4, 2.0]], { segs: 72, crease: 30 }), bc);
  const triCv = canvas(256, 256), tg = triCv.getContext('2d'), TPX = 128 / 7.85;
  tg.strokeStyle = '#fff'; tg.lineWidth = 0.16 * TPX; tg.lineJoin = 'round';
  [0, Math.PI].forEach((a) => {
    tg.save(); tg.translate(128, 128); tg.rotate(a);
    tg.beginPath(); tg.moveTo(0, -7.35 * TPX); tg.lineTo(-0.62 * TPX, -6.3 * TPX); tg.lineTo(0.62 * TPX, -6.3 * TPX); tg.closePath(); tg.stroke();
    tg.restore();
  });
  const triMat = lib.prepare(new THREE.MeshStandardMaterial({ name: 'm6isoTri', color: 0xe8e6de, roughness: 0.5, alphaMap: tex(triCv, false), alphaTest: 0.5, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), {});
  ik.add(new THREE.CircleGeometry(7.85, 72), triMat, T(0, 0, 2.01));
  ik.add(revolve([[5.23, 2.0, 0.3], [5.23, 2.9, 0.5], [4.9, 3.2, 0.6], [0, 3.2]], { segs: 72, crease: 30 }), bc);
  for (let k = 0; k < 12; k++) ik.add(rbox(3.4, 0.55, 0.45, 0.2, 2), bc, T(Math.cos(k * TAU / 12) * 2.9, Math.sin(k * TAU / 12) * 2.9, 3.4, 0, 0, k * TAU / 12));
  ik.build(isoRing);

  ck.build(core); tk.build(top); bk.build(base); dk.build(door);
  // (the screws' slots, after every screw is in)
  scrH.build(core); scrT.build(top);
  const eyepieceMeshes = eyepiece.build(top, 'finder');
  return {
    core, top, base, door, doorHingeY, doorHingeZ,
    curtain, curtain1Cloth, curtain1Lath, meterSpot, curtain2Cloth, curtain2Lath,
    rfRoller, lensRelBtn, batCap, rwCrankPivot, baseKeySpin, baseKeyFlip,
    rl, sel, selMeshes, dial, dialMeshes, lever, leverMeshes, release, releaseMeshes, rwSpin, counterDisc, ctrCv, ctrTex, isoRing, eyepieceMeshes,
  };
}
/** A small bar, centred, flat in the XZ plane (the baseplate key's wing). */
function rbar(w, d, t) { const g = slab(rrPath(-w / 2, -d / 2, w / 2, d / 2, Math.min(d / 2 - 0.01, 1.0)), t, 0.3); g.rotateX(-Math.PI / 2); return g; }
/** The TTL meter film-speed dial's fixed scale, seen from the back (k px a millimetre, the canvas's centre the dial's): ISO
 *  v at 180° + 15°·log₂(v / 200) clockwise from the top, DIN d at (d − 24)·5°; the numbers turned from the tangent
 *  toward level at the sides, so that each reads the right way up, as engraved. */
function drawIsoScale(cv, k) {
  const g = cv.getContext('2d'), c = cv.width / 2;
  g.fillStyle = '#121214'; g.fillRect(0, 0, cv.width, cv.height);
  const at = (a, r) => [c + r * k * Math.sin(a), c - r * k * Math.cos(a)];
  const tick = (a, r0, r1, w) => { const [x0, y0] = at(a, r0), [x1, y1] = at(a, r1); g.lineWidth = w * k; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); };
  const label = (a, r, str, hMM) => {
    const up = Math.cos(a) >= 0, tan = up ? a : a - Math.PI, rot = Math.atan2(Math.sin(tan), Math.cos(tan)) * Math.cos(a) ** 2;
    const [x, y] = at(a, r);
    g.save(); g.translate(x, y); g.rotate(rot); g.font = `600 ${(hMM * k) / 0.72}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(str, 0, 0); g.restore();
  };
  g.strokeStyle = g.fillStyle = INK.white;
  const isoA = (v) => Math.PI + 15 * DEG * Math.log2(v / 200), dinA = (d) => (d - 24) * 5 * DEG;
  for (let i = -15; i <= 15; i++) { const a = isoA(200 * 2 ** (i / 3)); tick(a, 9.3, i % 3 === 0 ? 10.5 : 10.0, 0.16); }
  for (let d = 9; d <= 39; d++) tick(dinA(d), 9.3, d % 3 === 0 ? 10.5 : 10.0, 0.16);
  [6, 12, 25, 50, 100, 200, 400, 800, 1600, 3200, 6400].forEach((v) => label(isoA(v), 12.3, String(v), 1.25));
  for (let d = 9; d <= 39; d += 3) label(dinA(d), 12.3, `${d}°`, 1.25);
  label(Math.PI / 2, 12.3, 'ISO', 1.35); label(-Math.PI / 2, 12.3, 'ISO', 1.35);
  g.lineWidth = 0.14 * k; g.beginPath(); g.arc(c, c, 14.25 * k, 0, TAU); g.stroke();
}

// ───────── The lens ─────────
// The Summicron 50 f/2 (III), from its front: the front ring (its rim flared a little at its back), a groove, the band
// with the aperture's index dot, a groove, the aperture ring (knurled round the back of the lens, smooth where its
// f-numbers are), the tube the helicoid carries out, the focusing ring (a fine-ribbed grip, then the distance scale:
// feet in orange over metres in white), the fixed depth-of-field ring (53 mm, the widest: knurled for taking the lens
// off, smooth where its scale and the red mount dot are), the bright bayonet. The front ring, the band, the aperture
// ring and the tube are the unit the helicoid carries forward.
// Measured row by row off the silhouette of a square-on photograph of an 11817 focused at ∞ (eBay 257780502497, photo
// 7, 10.45 px/mm by its 42 mm front; the camera ~4° behind square, so marks on the near side sit 0.07 × their radius
// lower than the silhouette's edges, as corrected here); the profile then 44.4 mm from the front to the bayonet's seat.
const LENS_DEFS = {
  'leica-elmarit-2.8-28': {
    L: 40.5, focusPitch: 64 * DEG, blades: 10, hoodStyle: 'rect', hoodLen: 16.5, focusTab: true,
    title: 'ELMARIT-M', serial: '3348210', funnelPad: 1.5, profile: 'flare',
    front: { z0: -40.5, r: 24.8, lip: [-37.4, -36.6, 25.3], groove: [-36.4, -35.9, 24.1], band: [-35.7, -33.6], groove2: [-33.4, -33.0, 23.8], thread: 23.0, recess: 2.8, glassR: 15.6, dot: -35.3 },
    ap: { z0: -32.9, flat: [-31.8, -28.6], z1: -27.8, r: 25.4, patch: [-14, 123], knurl: 108 },
    tube: { z0: -27.8, z1: -19.5, r: 23.2, screws: [57, -88] },
    focus: { z0: -25.2, flat: [-23.8, -15.4], r: 25.8, scale: [-15.1, -9.2], rs: 24.8, ribs: 140 },
    dof: { z0: -9.0, flat: [-8.2, -3.0], z1: -1.9, r: 26.5, patch: 42, dot: 70, knurl: 96 },
    bay: { r0: 20.0, r1: 21.4, rear: 17.5 },
  },
  'leica-summicron-2-35': {
    L: 34.5, focusPitch: 52 * DEG, blades: 10, hoodStyle: 'rect', hoodLen: 15.0, focusTab: true,
    title: 'SUMMICRON-M', serial: '3219405', funnelPad: 1.5, profile: 'compact',
    front: { z0: -34.5, r: 21.0, lip: [-31.8, -31.1, 21.4], groove: [-30.9, -30.4, 20.6], band: [-30.2, -28.2], groove2: [-28.0, -27.6, 20.5], thread: 19.5, recess: 2.6, glassR: 12.6, dot: -29.8 },
    ap: { z0: -27.5, flat: [-26.4, -23.2], z1: -22.5, r: 23.6, patch: [-14, 123], knurl: 96 },
    tube: { z0: -22.5, z1: -16.5, r: 21.0, screws: [57, -88] },
    focus: { z0: -20.8, flat: [-19.6, -13.2], r: 24.4, scale: [-13.0, -8.2], rs: 23.8, ribs: 132 },
    dof: { z0: -8.0, flat: [-7.2, -2.8], z1: -1.9, r: 26.5, patch: 42, dot: 70, knurl: 96 },
    bay: { r0: 20.0, r1: 21.4, rear: 16.5 },
  },
  'leica-summicron-2-50-iii': {
    L: 44.4, focusPitch: FOCUS_C, blades: 10, hoodStyle: 'round', hoodLen: 20.5,
    title: 'SUMMICRON-M', serial: '2864192', funnelPad: 0.5, profile: 'standard',
    front: { z0: -44.4, r: 20.9, lip: [-41.3, -40.6, 21.3], groove: [-40.4, -39.9, 20.5], band: [-39.8, -37.5], groove2: [-37.3, -36.9, 20.4], thread: 19.5, recess: 3.0, glassR: 13.3, dot: -39.4 },
    ap: { z0: -36.85, flat: [-35.6, -32.2], z1: -31.5, r: 23.35, patch: [-14, 123], knurl: 96 },
    tube: { z0: -31.5, z1: -21.0, r: 20.8, screws: [57, -88] },
    focus: { z0: -27.6, flat: [-26.0, -16.8], r: 24.1, scale: [-16.5, -9.9], rs: 23.6, ribs: 132 },
    dof: { z0: -9.7, flat: [-8.8, -3.1], z1: -1.9, r: 26.5, patch: 42, dot: 70, knurl: 96 },
    bay: { r0: 20.0, r1: 21.4, rear: 16.9 },
  },
  'leica-summilux-1.4-50': {
    L: 47.0, focusPitch: 45 * DEG, blades: 10, hoodStyle: 'round', hoodLen: 21.0, focusTab: true,
    title: 'SUMMILUX-M', serial: '3402718', funnelPad: 0.3, profile: 'fast50',
    front: { z0: -47.0, r: 23.4, lip: [-43.8, -43.0, 23.9], groove: [-42.8, -42.3, 22.8], band: [-42.1, -39.6], groove2: [-39.4, -39.0, 22.7], thread: 21.5, recess: 3.2, glassR: 16.8, dot: -41.6 },
    ap: { z0: -38.9, flat: [-37.6, -34.0], z1: -33.2, r: 25.4, patch: [-14, 132], knurl: 104 },
    tube: { z0: -33.2, z1: -22.5, r: 22.8, screws: [57, -88] },
    focus: { z0: -29.2, flat: [-27.6, -17.5], r: 26.0, scale: [-17.2, -10.2], rs: 25.2, ribs: 140 },
    dof: { z0: -10.0, flat: [-9.0, -3.1], z1: -1.9, r: 26.8, patch: 42, dot: 70, knurl: 96 },
    bay: { r0: 20.0, r1: 21.4, rear: 17.8 },
  },
  'leica-elmarit-2.8-90': {
    L: 73.0, focusPitch: 22 * DEG, blades: 9, builtInHood: true, hoodStyle: 'slide', hoodLen: 26.5, hoodSlide: 25.5,
    title: 'ELMARIT-M', serial: '3519084', funnelPad: 0.4, profile: 'tele90',
    front: { z0: -73.0, r: 24.4, lip: [-69.5, -68.8, 24.6], groove: [-68.6, -68.0, 24.1], band: [-67.8, -46.8], groove2: [-46.6, -46.0, 24.1], thread: 23.0, recess: 3.6, glassR: 17.6, dot: -46.3 },
    ap: { z0: -45.8, flat: [-44.6, -40.2], z1: -39.4, r: 26.2, patch: [-14, 123], knurl: 104 },
    tube: { z0: -39.4, z1: -24.0, r: 23.6, screws: [57, -88] },
    focus: { z0: -37.5, flat: [-36.0, -20.0], r: 25.8, scale: [-19.6, -11.4], rs: 24.8, ribs: 140 },
    dof: { z0: -11.2, flat: [-10.2, -3.2], z1: -1.9, r: 26.5, patch: 42, dot: 70, knurl: 96 },
    bay: { r0: 20.0, r1: 21.4, rear: 16.4 },
  },
  'leica-tele-elmar-4-135': {
    L: 98.0, focusPitch: 16 * DEG, blades: 10, hoodStyle: 'round', hoodLen: 34.0,
    title: 'TELE-ELMAR', serial: '2918436', funnelPad: 0.7, profile: 'tele135',
    front: { z0: -98.0, r: 22.0, lip: [-94.5, -93.8, 22.5], groove: [-93.6, -93.0, 21.6], band: [-92.8, -89.5], groove2: [-89.3, -88.8, 21.5], thread: 19.5, recess: 4.2, glassR: 15.8, dot: -91.8 },
    ap: { z0: -88.7, flat: [-87.4, -83.4], z1: -82.6, r: 24.4, patch: [-14, 123], knurl: 96 },
    tube: { z0: -82.6, z1: -36.0, r: 22.4, screws: [57, -88] },
    focus: { z0: -52.0, flat: [-50.0, -23.0], r: 25.4, scale: [-22.6, -12.0], rs: 24.4, ribs: 140 },
    dof: { z0: -11.8, flat: [-10.8, -3.2], z1: -1.9, r: 26.5, patch: 42, dot: 70, knurl: 96 },
    bay: { r0: 20.0, r1: 21.4, rear: 15.8 },
  },
};

/** Cutaway optical element prescriptions for every M lens ([zFrac 0..1 from front to rear, rFrac, thickMm, R1, R2]). */
const M6_OPTICS = {
  'leica-elmarit-2.8-28': [
    [0.08, 0.96, 2.8, 1.5, -1.1], [0.22, 0.78, 2.0, 2.6, -1.0], [0.38, 0.66, 3.8, 1.8, 3.6], [0.52, 0.56, 2.2, -2.0, 2.4],
    [0.66, 0.58, 1.8, -1.6, -4.5], [0.74, 0.62, 3.6, -4.5, 1.9], [0.86, 0.72, 2.8, 3.2, -2.6], [0.95, 0.80, 2.4, -2.8, 4.2],
  ],
  'leica-summicron-2-35': [
    [0.09, 0.94, 3.2, 1.8, -2.4], [0.26, 0.80, 2.2, 2.4, -1.2], [0.42, 0.68, 1.6, -1.6, 3.0],
    [0.62, 0.66, 1.6, -2.2, -4.8], [0.70, 0.72, 3.4, -4.8, 1.8], [0.84, 0.78, 2.6, 3.0, -3.4], [0.94, 0.84, 2.8, 2.2, -2.8],
  ],
  'leica-summicron-2-50-iii': [
    [0.10, 0.96, 3.6, 2.2, -3.8], [0.28, 0.84, 3.0, 1.9, -2.6], [0.43, 0.72, 1.8, 3.2, -1.5],
    [0.62, 0.74, 1.8, -1.6, 3.4], [0.74, 0.82, 3.8, 3.4, -2.2], [0.91, 0.88, 3.4, 2.8, -3.6],
  ],
  'leica-summilux-1.4-50': [
    [0.09, 0.98, 4.2, 2.0, -3.6], [0.25, 0.88, 3.2, 1.8, -2.8], [0.40, 0.76, 1.8, 3.0, -1.4],
    [0.60, 0.76, 1.8, -1.5, 3.2], [0.71, 0.84, 4.0, 3.2, -2.0], [0.84, 0.88, 2.8, 2.6, -4.2], [0.94, 0.90, 3.2, 3.0, -3.2],
  ],
  'leica-elmarit-2.8-90': [
    [0.08, 0.96, 4.4, 2.0, -4.2], [0.24, 0.84, 2.4, -2.6, 1.8], [0.46, 0.72, 3.6, 2.8, -3.0], [0.82, 0.66, 3.0, -3.2, 2.4],
  ],
  'leica-tele-elmar-4-135': [
    [0.07, 0.96, 4.8, 2.2, -4.8], [0.19, 0.86, 2.4, -2.8, 1.9], [0.36, 0.72, 3.2, 3.0, -3.4], [0.78, 0.58, 2.6, -2.4, 3.2],
  ],
};

function lensDef(lens) {
  const d = LENS_DEFS[lens.id];
  if (!d) throw new Error(`the M6 has no geometry for lens ${lens.id}`);
  return d;
}
/** The rings' engraving: one atlas, a row per ring (0 the distance scale, 1 depth of field, 2 apertures). */
function lensAtlas(lens, def) {
  const W = 4096, RH = 128, cv = canvas(W, RH * 4), g = cv.getContext('2d');
  g.fillStyle = PAINT_BG; g.fillRect(0, 0, W, cv.height);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const X = (phi) => ((((0.5 + phi / TAU) % 1) + 1) % 1) * W;
  const rows = [[def.focus.scale[1] - def.focus.scale[0], def.focus.rs], [def.dof.flat[1] - def.dof.flat[0], def.dof.r], [def.ap.flat[1] - def.ap.flat[0], def.ap.r]];
  const vx = (row) => (TAU * rows[row][1]) / W, vy = (row) => rows[row][0] / RH;
  const text = (row, phi, str, y, mmH, color, weight = 600) => {
    g.save(); g.font = `${weight} 100px ${FONT}`; g.textBaseline = 'alphabetic';
    const cap = g.measureText('8').actualBoundingBoxAscent, size = (100 * mmH / vy(row)) / cap;
    g.translate(X(phi), row * RH + y * RH); g.scale(vy(row) / vx(row), 1);
    g.font = `${weight} ${size}px ${FONT}`; g.fillStyle = color; g.textAlign = 'center'; g.fillText(str, 0, (mmH / vy(row)) / 2); g.restore();
  };
  const tick = (row, phi, y0, y1, wMM, color) => { const w = Math.max(2, wMM / vx(row)); g.fillStyle = color; g.fillRect(X(phi) - w / 2, row * RH + y0 * RH, w, (y1 - y0) * RH); };
  const ORANGE = '#e69a2b';
  // row 0: feet (front line, orange) and metres (rear line, white), each where the helicoid puts it
  const scale = (list, toM, y, color, mmH) => {
    let last = 1e9;
    list.forEach((d) => {
      const phi = isFinite(d) ? focusAngle(lens, d * toM) : 0;
      if (isFinite(d) && d * toM < lens.minFocusDistance - 1e-6) return;
      if (Math.abs(phi - last) < 6.5 * DEG && isFinite(d)) return;
      last = phi;
      text(0, phi, isFinite(d) ? String(d).replace('.', ',') : '∞', y, isFinite(d) ? mmH : mmH * 0.8, color);
    });
  };
  scale([Infinity, 50, 25, 15, 10, 8, 6, 5, 4, 3.5, 3, 2.5], 0.3048, 0.3, ORANGE, 1.6);
  scale([Infinity, 20, 10, 5, 3, 2, 1.5, 1.2, 1, 0.9, 0.8, 0.7], 1, 0.72, INK.white, 1.6);
  text(0, 34 * DEG, 'feet', 0.3, 1.45, ORANGE, 600);
  text(0, 29 * DEG, 'm', 0.72, 1.2, INK.white, 600);
  // row 1: the index (a line in its little bracket) and the depth-of-field marks either side
  const pitch = focusPitch(lens);
  tick(1, 0, 0.0, 0.42, 0.28, INK.white);
  tick(1, 0, 0.36, 0.42, 1.3, INK.white);
  [-1, 1].forEach((s) => tick(1, s * 0.65 * DEG, 0.22, 0.42, 0.2, INK.white));
  const dofStops = lens.apertureStops.filter((N) => N >= 4 && N <= 22).slice(0, 4);
  dofStops.forEach((N) => {
    const a = Math.min(38 * DEG, pitch * N * COC);
    [-1, 1].forEach((s) => { tick(1, s * a, 0.0, N >= 8 ? 0.4 : 0.32, 0.22, INK.white); text(1, s * a, String(N), 0.7, 1.3, INK.white, 500); });
  });
  text(1, 0, String(lens.maxAperture), 0.7, 1.3, INK.white, 500);
  // row 2: the f-numbers, each at its stop, maxAperture toward −X
  lens.apertureStops.forEach((N, i) => text(2, i * AP_STEP, String(N), 0.5, 1.75, INK.white, 500));
  const t = tex(cv); t.wrapS = THREE.RepeatWrapping;
  return t;
}
/** Band UVs into a row of the 4-row atlas (v = 1 at the band's front edge); u kept to the ring's angle when the band
 *  is a part of the ring (from phi0 through phiLen). */
function bandRow(g, row, phi0 = -Math.PI, phiLen = TAU) {
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) { uv.setX(i, 0.5 + (phi0 + uv.getX(i) * phiLen) / TAU); uv.setY(i, 1 - (row + 1) / 4 + uv.getY(i) / 4); }
  return g;
}
function frontRing(lens, def) {
  const cv = canvas(1024, 1024), g = cv.getContext('2d');
  g.fillStyle = '#0a0a0c'; g.fillRect(0, 0, 1024, 1024);
  const rInner = Math.min(def.front.thread - 3.2, def.front.glassR + (def.funnelPad ?? 0.5));
  const rOuter = def.front.thread + 0.08;
  const pxR = (r) => 512 * (r / rOuter);
  // Subtle machined concentric hairline rules framing the Leica-style optical engraving
  g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = 3;
  g.beginPath(); g.arc(512, 512, pxR(rInner + 0.35), 0, TAU); g.stroke();
  g.beginPath(); g.arc(512, 512, pxR(def.front.thread - 0.45), 0, TAU); g.stroke();
  const R = pxR((rInner + rOuter) / 2);
  arcText(g, `GLASS WORKS  ${def.title || 'M-OPTIK'}`, 512, 512, R, Math.PI * 0.68, 36, INK.white, 600);
  arcText(g, `1:${lens.maxAperture}/${lens.focalLength}`, 512, 512, R, Math.PI * 0.14, 38, INK.white, 700);
  arcText(g, `E${lens.filterSize || 39}   ${def.serial || '2864192'}`, 512, 512, R, -Math.PI * 0.50, 34, '#d8d6ce', 600, true);
  return tex(cv);
}
function buildLens(lib, lens, hov) {
  const def = lensDef(lens), group = new THREE.Group();
  const bk = lib.get('lensBlack'), steel = lib.get('steel'), chrome = lib.get('chrome'), brass = lib.get('brass'), flock = lib.get('flock'), anod = lib.get('anod');
  const atlas = lensAtlas(lens, def);
  const eng = (h) => lib.prepare(new THREE.MeshPhysicalMaterial({ name: `m6lensEng_${lens.id}`, color: 0xffffff, map: atlas, metalness: 0.12, roughness: 0.46, specularIntensity: 0.62 }), { hover: h, wear: 'paint' });
  const fixed = new Kit(), Fr = def.front, A = def.ap, F = def.focus, Dd = def.dof, Bay = def.bay;
  const knurl = (kit, mat, r, z0, z1, n, a0, a1) => kit.add(revolve([[r, z0, 0.4, 1], [r, z1, 0.4, 1]], { segs: Math.max(12, Math.round(n * (a1 - a0) / 360) * 6), phi0: a0 * DEG, phiLen: (a1 - a0) * DEG, ribs: { n, depth: 0.34, groove: 0.46, edge: 0.18 } }), mat);
  // the bayonet flange seat stays visible at the seam; 6-screw 3-lug M bayonet, brass rangefinder cam & outward multi-coated rear glass build lazily when detached/exploded
  fixed.add(revolve([[Bay.r1, Dd.z1], [Bay.r1, 0, 0.3], [Bay.r0, 0]], { segs: 96, crease: 30 }), steel);
  const oSpec = lensOpticsFor(lens);
  const lensGlassU = { blades: def.blades || 10,
    optics: { value: new THREE.Vector4(13, 1.0, Fr.glassR, 12.6) }, state: { value: new THREE.Vector4(0, oSpec.pupilMag ?? 1.0, 0, 0) },
    ghostA: { value: new THREE.Color(...(oSpec.ghostTintA || [0.6, 0.4, 0.25])) }, ghostB: { value: new THREE.Color(...(oSpec.ghostTintB || [0.3, 0.55, 0.42])) } };
  const glassMat = lib.prepare(lib.base.glass.clone(), { lensGlass: lensGlassU });
  const rearMount = new THREE.Group(); rearMount.visible = false; group.add(rearMount);
  let rearBuilt = false;
  const ensureRear = () => {
    if (rearBuilt) return false;
    rearBuilt = true;
    const rk = new Kit(), intBlk = lib.get('palpas');
    const rearGlassMat = lib.prepare(new THREE.MeshPhysicalMaterial({ name: `m6RearGlass_${lens.id}`, color: 0x160e1f, metalness: 0.14, roughness: 0.03, clearcoat: 1.0, clearcoatRoughness: 0.02, specularIntensity: 1.0, envMapIntensity: 1.75 }), {});
    const arcSector = (rIn, rOut, a0, a1) => {
      const s = new THREE.Shape(); s.absarc(0, 0, rOut, a0, a1, false); s.absarc(0, 0, rIn, a1, a0, true); s.closePath(); return s;
    };
    // Precision chrome-over-brass Leica M rear bayonet flange (z = 0..+1.35 mm) + 6 countersunk stainless Phillips screws!
    rk.add(revolve([[Bay.r0 - 0.4, 0.0], [26.2, 0.0], [26.2, 1.1, 0.25], [25.5, 1.35], [Bay.r0 - 0.2, 1.35], [Bay.r0 - 0.2, 0.2]], { segs: 84, crease: 28 }), steel);
    [22, 82, 142, 202, 262, 322].forEach((a) => addScrew(rk, chrome, rk, flock, T(Math.cos(a * DEG) * 23.6, Math.sin(a * DEG) * 23.6, 1.37), 0.78, true, 0.28));
    // Dark undercut cylindrical throat + 3 watertight beveled stainless Leica M bayonet wings (z = +2.6..+4.15 mm w/ crisp shadow gap!)
    rk.add(revolve([[Bay.r0 - 0.5, 1.3], [Bay.r0 + 0.5, 1.3], [Bay.r0 + 0.5, 2.75], [Bay.r0 - 0.5, 2.75]], { segs: 72, crease: 26 }), anod);
    [-26, 94, 214].forEach((a0, idx) => {
      // Frame-selector cam ear (idx=1) is authentically slightly shorter/stepped per focal pair!
      const span = idx === 1 ? 46 : 56;
      rk.add(slab(arcSector(Bay.r0 - 0.3, 23.2, a0 * DEG, (a0 + span) * DEG), 1.55, 0.2, 24, 0.45, 2), chrome, T(0, 0, 2.6));
    });
    // Matte-black inner rear optical tube + precision-lapped gleaming brass rangefinder roller-coupling cam ring (z = +5.2..+7.1 mm)!
    rk.add(revolve([[12.8, 0.2], [Bay.r0 - 0.3, 0.2], [Bay.rear + 0.4, 2.4, 0.3], [Bay.rear + 0.4, 5.4], [13.2, 5.8]], { segs: 72, crease: 28 }), intBlk);
    rk.add(revolve([[Bay.rear - 1.2, 5.2], [Bay.rear + 0.1, 5.2, 0.25], [Bay.rear + 0.1, 7.1, 0.25], [Bay.rear - 1.3, 7.1], [Bay.rear - 1.3, 5.4]], { segs: 72, crease: 26 }), brass);
    // Outward-facing (+Z) glossy multi-coated convex rear Leica optical meniscus (r descending -> nz > 0!)
    rk.add(revolve([[13.2, 5.6], [12.5, 5.9], [12.5, 4.8]], { segs: 48 }), anod);
    rk.add(new THREE.CircleGeometry(12.6, 48), intBlk, T(0, 0, 4.4));
    rk.add(revolve([[12.6, 5.2], [10.6, 5.8], [6.2, 6.65], [0, 7.05]], { segs: 48 }), rearGlassMat);
    rk.build(rearMount);
    return true;
  };
  // the depth-of-field ring (fixed): its chamfers, the smooth front with the scale, the knurl round the rest (a smooth
  // spot for the red mount dot), the face down to the bayonet + authentic red IR focus pip!
  const maxExt = helicoidExtensionMm(lens, lens.minFocusDistance || 0.7);
  const rCore = Math.min(def.tube.r - 0.15, Fr.groove2[2] - 0.25, 19.6);
  const rInnerFixed = Math.min(def.tube.r + 0.35, 22.4);
  fixed.add(revolve([[rCore + 0.3, Dd.z0], [24.4, Dd.z0 + 0.1], [Dd.r, Dd.flat[0], 0.6]], { segs: 160, crease: 30 }), bk);
  fixed.add(revolve([[Dd.r, Dd.flat[1], 0.6], [Dd.r - 0.6, Dd.flat[1] + 0.6, 0.4], [23.0, Dd.z1], [Bay.r1, Dd.z1]], { segs: 160, crease: 30 }), bk);
  fixed.add(bandRow(revolve([[Dd.r, Dd.flat[0]], [Dd.r, Dd.flat[1]]], { segs: 48, uv: 'band', phi0: -Dd.patch * DEG, phiLen: 2 * Dd.patch * DEG }), 1, -Dd.patch * DEG, 2 * Dd.patch * DEG), eng(null));
  fixed.add(revolve([[Dd.r, Dd.flat[0]], [Dd.r, Dd.flat[1]]], { segs: 16, phi0: (Dd.dot - 7) * DEG, phiLen: 14 * DEG }), bk);
  knurl(fixed, bk, Dd.r, Dd.flat[0], Dd.flat[1], Dd.knurl, Dd.patch, Dd.dot - 7);
  knurl(fixed, bk, Dd.r, Dd.flat[0], Dd.flat[1], Dd.knurl, Dd.dot + 7, 360 - Dd.patch);
  fixed.add(new THREE.SphereGeometry(0.92, 20, 14), lib.get('red'), T(Dd.r * Math.sin(Dd.dot * DEG), Dd.r * Math.cos(Dd.dot * DEG), (Dd.flat[0] + Dd.flat[1]) / 2));
  // Tiny red Infrared (R) index dot on the DoF collar just right of the 12 o'clock focus index!
  fixed.add(new THREE.SphereGeometry(0.42, 14, 10), lib.get('red'), T(Dd.r * Math.sin(-8.5 * DEG), Dd.r * Math.cos(-8.5 * DEG), Dd.flat[0] + 1.1));
  // Continuous matte-black inner stationary housing sleeve sealing the DoF/focus/mount core against oblique light leaks
  fixed.add(revolve([[rInnerFixed, F.z0 + 0.6], [rInnerFixed, -1.9]], { segs: 84 }), anod);
  fixed.build(group);
  // the focusing ring: crisp machined fine-ribbed grip (segs = 6*n -> zero moiré!), distance scale & concave focusing tab on 28/35/50 f/1.4
  const focus = new THREE.Group(); group.add(focus);
  const fk = new Kit(), fMat = lib.get('lensBlack', { hover: hov.focus });
  fk.add(revolve([[rCore + 0.15, F.z0], [23.9, F.flat[0] - 0.4, 0.4], [F.r, F.flat[0], 0.5, 1], [F.r, F.flat[1], 0.5, 1], [F.rs, F.scale[0]]], { segs: F.ribs * 6, crease: 30, ribs: { n: F.ribs, depth: 0.30, groove: 0.5, edge: 0.2 } }), fMat);
  fk.add(bandRow(revolve([[F.rs, F.scale[0]], [F.rs, F.scale[1]]], { segs: 160, uv: 'band' }), 0), eng(hov.focus));
  fk.add(revolve([[F.rs, F.scale[1]], [F.rs - 0.5, F.scale[1] + 0.2], [Math.min(23.0, rInnerFixed), Dd.z0 + 0.4]], { segs: 128 }), fMat);
  if (def.focusTab) {
    // Iconic sculpted concave curved ergonomic Leica M focusing tab at 6 o'clock (rotates physically with focus ring!)
    const tabS = new THREE.Shape();
    const rBase = F.r - 0.4, rTip = F.r + 7.6;
    tabS.moveTo(-10.5, -rBase + 2.2);
    tabS.bezierCurveTo(-11.2, -rBase - 3.6, -7.8, -rTip - 0.4, -4.4, -rTip + 0.2);
    tabS.bezierCurveTo(-1.8, -rTip + 2.6, 1.8, -rTip + 2.6, 4.4, -rTip + 0.2); // ergonomic concave finger saddle!
    tabS.bezierCurveTo(7.8, -rTip - 0.4, 11.2, -rBase - 3.6, 10.5, -rBase + 2.2);
    tabS.quadraticCurveTo(0, -rBase + 3.2, -10.5, -rBase + 2.2);
    fk.add(slab(tabS, 5.4, 1.1, 28, 0.5, 3), fMat, T(0, 0, (F.flat[0] + F.flat[1]) / 2 - 2.7));
  }
  const focusMeshes = fk.build(focus, 'focus');
  // the unit the helicoid moves forward: the tube (with micro screws + 135/4 optical-head bayonet collar!), aperture ring, sculpted front
  const ext = new THREE.Group(); group.add(ext);
  const ek = new Kit(), Tb = def.tube;
  const zTubeBack = Math.min(-2.8, Math.max(Tb.z1, F.z0 + maxExt + 4.5));
  ek.add(revolve([[Tb.r, Tb.z0], [Tb.r, Math.min(Dd.z0 - 0.5, zTubeBack)]], { segs: 96 }), bk);
  // Telescoping black-anodized inner helicoid barrel sealing aperture/tube/focus across full close-focus extension
  ek.add(revolve([[rCore, Fr.z0 + Fr.recess], [rCore, zTubeBack]], { segs: 84 }), anod);
  Tb.screws.forEach((a) => addScrew(ek, steel, ek, flock, radialT(a * DEG, Tb.r + 0.02, (A.z1 + F.z0) / 2), 0.58, false));
  if (def.profile === 'tele135') {
    // Signature Tele-Elmar 135/4 bright machined chrome removable optical-head seam collar at mid-barrel!
    ek.add(revolve([[Tb.r, -64.0], [Tb.r + 0.45, -64.3, 0.2], [Tb.r + 0.45, -66.0, 0.2], [Tb.r, -66.3]], { segs: 96, crease: 26 }), chrome);
  }
  const aperture = new THREE.Group(); ext.add(aperture);
  const ak = new Kit(), aMat = lib.get('lensBlack', { hover: hov.aperture });
  ak.add(revolve([[rCore, A.z0], [21.8, A.z0, 0.4], [A.r, A.flat[0], 0.6]], { segs: 160, crease: 30 }), aMat);
  ak.add(revolve([[A.r, A.flat[1], 0.6], [22.4, A.z1, 0.4], [rCore, A.z1]], { segs: 160, crease: 30 }), aMat);
  ak.add(bandRow(revolve([[A.r, A.flat[0]], [A.r, A.flat[1]]], { segs: 64, uv: 'band', phi0: A.patch[0] * DEG, phiLen: (A.patch[1] - A.patch[0]) * DEG }), 2, A.patch[0] * DEG, (A.patch[1] - A.patch[0]) * DEG), eng(hov.aperture));
  knurl(ak, aMat, A.r, A.flat[0], A.flat[1], A.knurl, A.patch[1], 360 + A.patch[0]);
  const apertureMeshes = ak.build(aperture, 'aperture');
  // the front: sculpted per-lens rim, exposed machined filter-lip chamfer, stepped filter threads, conical beauty ring & spanner-notched retaining bezel!
  const zF = Fr.z0;
  ek.add(revolve([[Fr.thread, zF], [Fr.r - 0.4, zF, 0.6], [Fr.r, zF + 0.4, 0.6], [Fr.r, Fr.lip[0] - 0.1, 0.2], [Fr.lip[2], Fr.lip[0] + 0.2, 0.4], [Fr.lip[2], Fr.lip[1], 0.4],
    [Fr.groove[2], Fr.groove[0]], [Fr.groove[2], Fr.groove[1]], [Fr.r, Fr.band[0], 0.3], [Fr.r, Fr.band[1], 0.3], [Fr.groove2[2], Fr.groove2[0]], [Fr.groove2[2], A.z0], [rCore, A.z0 + 0.2]], { segs: 128, crease: 30 }), bk);
  // Subtle exposed machined bright-aluminum chamfer right at the filter mouth rim (catches studio highlight like real Leica brass/aluminum!)
  ek.add(revolve([[Fr.thread - 0.04, zF + 0.22], [Fr.thread + 0.22, zF - 0.02]], { segs: 96 }), steel);
  if (def.profile === 'fast50') {
    // Summilux 50/1.4 sleek hairline chrome accent ring at the front barrel step
    ek.add(revolve([[Fr.r + 0.04, Fr.band[1] + 0.2], [Fr.r + 0.22, Fr.band[1] + 0.4, 0.15], [Fr.r + 0.22, Fr.band[1] + 1.0, 0.15], [Fr.r - 0.05, Fr.band[1] + 1.2]], { segs: 96 }), chrome);
  }
  ek.add(new THREE.SphereGeometry(0.5, 12, 8), lib.get('white'), T(0, Fr.r - 0.2, Fr.dot));
  ek.add(revolve([[Fr.thread, zF + Fr.recess + 0.8], [Fr.thread, zF]], { segs: 96 }), flock);
  for (let k = 0; k < 5; k++) ek.add(new THREE.TorusGeometry(Fr.thread - 0.05, 0.12, 4, 96), flock, T(0, 0, zF + 0.4 + k * 0.5));
  const rInnerFace = Math.min(Fr.thread - 3.2, Fr.glassR + (def.funnelPad ?? 0.5));
  const rOuterFace = Fr.thread + 0.08;
  // Conical outward-facing engraved front beauty ring tucked seamlessly inside the filter thread bore (zero perimeter light leak!)
  const ring = new THREE.RingGeometry(rInnerFace, rOuterFace, 96); ring.rotateY(Math.PI);
  const rPos = ring.attributes.position;
  for (let i = 0; i < rPos.count; i++) {
    const r = Math.hypot(rPos.getX(i), rPos.getY(i));
    const u = Math.max(0, Math.min(1, (r - rInnerFace) / Math.max(0.1, rOuterFace - rInnerFace)));
    rPos.setZ(i, lerp(zF + Fr.recess + 0.4, zF + Fr.recess - 0.7, u));
  }
  ring.computeVertexNormals();
  ek.add(ring, lib.prepare(new THREE.MeshPhysicalMaterial({ name: `m6front_${lens.id}`, map: frontRing(lens, def), metalness: 0.14, roughness: 0.40 }), {}));
  // Stepped matte-black anti-reflection inner funnel for smaller-glass lenses (28/2.8, 35/2, 135/4!)
  const funnelGap = rInnerFace - Fr.glassR;
  const zGlassEdge = funnelGap >= 1.0 ? zF + Fr.recess + 2.1 : zF + Fr.recess + 0.5;
  if (funnelGap >= 1.0) {
    const bafProf = [];
    for (let i = 0; i < 3; i++) {
      const rA = lerp(rInnerFace + 0.12, Fr.glassR + 0.2, i / 3), rB = lerp(rInnerFace + 0.12, Fr.glassR + 0.2, (i + 1) / 3);
      const zA = lerp(zF + Fr.recess + 0.35, zGlassEdge, i / 3), zB = lerp(zF + Fr.recess + 0.35, zGlassEdge, (i + 1) / 3);
      bafProf.push([rB, zB], [rA - 0.22, zB], [rA, zA]);
    }
    ek.add(revolve(bafProf.reverse(), { segs: 72, crease: 20 }), flock);
  }
  // Machined forward-facing front glass retaining lock-ring (dr > 0 -> nz < 0!) + iconic DUAL OPPOSING SPANNER-WRENCH NOTCHES (180° apart!)
  ek.add(revolve([[Fr.glassR - 0.1, zGlassEdge + 0.05], [Fr.glassR + 0.15, zGlassEdge - 0.42, 0.12], [Math.max(Fr.glassR + 0.65, rInnerFace + 0.12), zGlassEdge - 0.1]], { segs: 96 }), bk);
  [-1, 1].forEach((s) => ek.add(rbox(1.5, 0.55, 0.45, 0.08, 1), flock, T(s * (Fr.glassR + 0.32), 0, zGlassEdge - 0.35)));
  ek.add(new THREE.CircleGeometry(Fr.glassR + 0.4, 48), flock, T(0, 0, zGlassEdge + 0.45, 0, Math.PI, 0));
  ek.build(ext);
  // Standalone local-origin front meniscus glass (Law #17!)
  const glassMesh = new THREE.Mesh(prep(revolve([[0, zGlassEdge - 1.15], [Fr.glassR * 0.45, zGlassEdge - 0.9], [Fr.glassR * 0.8, zGlassEdge - 0.42], [Fr.glassR + 0.1, zGlassEdge]], { segs: 64 })), glassMat);
  ext.add(glassMesh);
  // Multi-element optical cutaway inside the lens barrel (built lazily when cutaway is enabled)
  const inner = new THREE.Group(); inner.visible = false; ext.add(inner);
  let innerBuilt = false;
  const ensureInner = () => {
    if (innerBuilt) return false;
    innerBuilt = true;
    const ik = new Kit();
    const spec = M6_OPTICS[lens.id] || M6_OPTICS['leica-summicron-2-50-iii'];
    const zStart = zF + Fr.recess + 1.4, zEnd = -3.0;
    const gInner = lib.get('innerGlass');
    const rimBlack = lib.get('anod');
    spec.forEach(([zf, rf, th, R1, R2]) => {
      const z0 = lerp(zStart, zEnd, zf), r = Math.max(5.5, Fr.glassR * rf);
      const sag1 = (r * r) / (2 * R1 * r * 1.45), sag2 = (r * r) / (2 * R2 * r * 1.45);
      const prof = [];
      for (let i = 0; i <= 8; i++) { const u = i / 8, rr = r * u; prof.push([rr, z0 - th * 0.5 + sag1 * u * u]); }
      for (let i = 8; i >= 0; i--) { const u = i / 8, rr = r * u; prof.push([rr, z0 + th * 0.5 + sag2 * u * u]); }
      ik.add(revolve(prof, { segs: 48 }), gInner);
      ik.add(revolve([[r, z0 - th * 0.5 + sag1], [r + 0.65, z0 - th * 0.5 + sag1], [r + 0.65, z0 + th * 0.5 + sag2], [r, z0 + th * 0.5 + sag2]], { segs: 48 }), rimBlack);
    });
    // Internal brass helicoid sleeve & diaphragm stop plate
    const zIris = lerp(zStart, zEnd, 0.51);
    ik.add(revolve([[Fr.glassR * 0.42, zIris - 0.5], [Fr.glassR * 0.96, zIris - 0.5], [Fr.glassR * 0.96, zIris + 0.5], [Fr.glassR * 0.42, zIris + 0.5]], { segs: 48 }), lib.get('blade'));
    ik.build(inner);
    return true;
  };
  // Lens hood: REAL permanently-parked Leica telescopic metal hood sleeve on 90/2.8 Elmarit-M (slides smoothly forward on hoodOn!), lazy rect/round hoods on others!
  const hoodGroup = new THREE.Group(); hoodGroup.visible = Boolean(def.builtInHood); ext.add(hoodGroup);
  let hoodBuilt = false;
  const ensureHood = () => {
    if (hoodBuilt) return false;
    hoodBuilt = true;
    const hk = new Kit(), hl = def.hoodLen || 20.5, hr = Fr.r + 1.2;
    if (def.builtInHood) {
      const rOut = Fr.r + 1.45, rIn = Fr.r + 0.22;
      const zBack = zF + hl, zFront = zF + 0.35;
      // Authentic Leica Elmarit-M 90/2.8 telescoping brass hood sleeve parked flush over front barrel w/ knurled front pull band + chrome hairline!
      hk.add(revolve([
        [rIn, zFront], [rOut - 0.45, zFront, 0.35], [rOut, zFront + 0.55, 0.35],
        [rOut + 0.25, zFront + 1.1, 0.3, 1], [rOut + 0.25, zFront + 5.6, 0.3, 1],
        [rOut, zFront + 6.2, 0.3], [rOut, zBack - 0.5, 0.35], [rIn, zBack],
      ], { segs: 480, crease: 28, ribs: { n: 80, depth: 0.32, groove: 0.48, edge: 0.16 } }), bk);
      hk.add(revolve([[rIn, zBack], [rIn, zFront + 0.4]], { segs: 84 }), flock);
      hk.add(revolve([[rOut + 0.04, zFront + 0.35], [rOut + 0.14, zFront + 0.55, 0.15], [rOut + 0.14, zFront + 0.95, 0.15], [rOut, zFront + 1.1]], { segs: 84 }), chrome);
    } else if (def.hoodStyle === 'rect') {
      const rw = hr + 6.5, rh = hr + 2.5;
      const sh = rrPath(-rw, -rh, rw, rh, 3.5);
      sh.holes.push(rrPath(-rw + 1.4, -rh + 1.4, rw - 1.4, rh - 1.4, 2.5, new THREE.Path()));
      hk.add(slab(sh, hl, 0.4, 12, 0.5), lib.get('anod'), T(0, 0, zF - hl));
      hk.add(revolve([[hr - 0.2, zF - 1.5], [hr + 1.0, zF - 1.5], [hr + 1.0, zF + 3.0], [hr - 1.2, zF + 3.0]], { segs: 72 }), lib.get('anod'));
    } else {
      const rTip = hr + 3.6;
      hk.add(revolve([[rTip - 0.5, zF - hl], [rTip, zF - hl + 0.4, 0.6], [rTip, zF - hl + 1.1, 0.4], [hr + 0.2, zF + 1.0], [hr + 0.2, zF + 3.2], [hr - 1.1, zF + 3.2], [hr - 1.1, zF + 1.4], [rTip - 0.8, zF - hl + 1.1], [rTip - 0.8, zF - hl], [rTip - 0.5, zF - hl]], { segs: 96, crease: 30 }), lib.get('anod'));
    }
    hk.build(hoodGroup);
    return true;
  };
  if (def.builtInHood) ensureHood();
  // Filter screwed into the front thread (E39 / E43 / E46, segs = 8*64 = 512 -> zero moiré!)
  const filterGroup = new THREE.Group(); filterGroup.visible = false; ext.add(filterGroup);
  const filterMat = new THREE.MeshPhysicalMaterial({ name: `m6filter_${lens.id}`, color: 0xffffff, roughness: 0.03, transparent: true, opacity: 0.35, depthWrite: false });
  lib.prepare(filterMat, {});
  const filterMeshes = [];
  let filterBuilt = false;
  const ensureFilter = () => {
    if (filterBuilt) return false;
    filterBuilt = true;
    const flk = new Kit(), ft = Fr.thread;
    flk.add(revolve([[ft - 0.5, zF - 4.6], [ft + 0.9, zF - 4.6, 0.5, 1], [ft + 0.9, zF - 0.4, 0.5, 1], [ft - 0.5, zF], [ft - 0.5, zF + 1.2]], { segs: 512, crease: 30, ribs: { n: 64, depth: 0.22 } }), lib.get('anod', { hover: hov.filter }));
    flk.add(new THREE.CircleGeometry(ft - 0.9, 48), filterMat, T(0, 0, zF - 3.0, 0, Math.PI, 0));
    filterMeshes.push(...flk.build(filterGroup, 'filter'));
    return true;
  };
  return { group, lens, def, L: def.L, lensGlassU, glassMesh, pupilMag: oSpec.pupilMag ?? 1.0, focalMm: oSpec.focalCalMm || lens.focalLength || 50, focus, aperture, ext, inner, hoodGroup, filterGroup, rearMount, ensureInner, ensureHood, ensureFilter, ensureRear, filterMat, focusMeshes, apertureMeshes, filterMeshes };
}

// ───────── The camera ─────────
const PARTS = ['focus', 'aperture', 'shutter', 'filter', 'crank', 'release', 'preview', 'finder', 'aim', 'roll'];
// the frame preselector: where a lens of each frame pair leaves it (× DIM.front.selector.tilt, + away from the lens)
const SEL_AT = { 35: 1, 135: 1, 50: 0, 75: 0, 28: -1, 90: -1 }, SEL_PAIRS = { '1': [35, 135], '0': [50, 75], '-1': [28, 90] };
const R_SWING = 62 * DEG, REWIND_TURNS = 26;

export function createCameraM6({ lens }) {
  const t0 = performance.now();
  const clipPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 1e7);
  const base = baseMaterials();
  const P = (o) => new THREE.MeshPhysicalMaterial(o);
  // black chrome over the zinc top and the brass baseplate; the finder's dark glass; the frosted illumination window;
  // the shutter's rubberised cloth and its white metering spot
  // (black chrome is a matt charcoal, not a black mirror: it shows its form by a soft sheen along the edges)
  base.blackChrome = P({ name: 'blackChrome', color: 0x1d1d1f, metalness: 0.5, roughness: 0.47, clearcoat: 0.2, clearcoatRoughness: 0.46 });
  base.blackChrome.userData.wear = 'blackChrome';
  // Law #18: Dead-flat anti-reflection interior black for baffles/keyholes (kills overhead Fresnel grey sheen!)
  base.palpas = P({ name: 'palpas', color: 0x020203, metalness: 0.0, roughness: 0.98, specularIntensity: 0.0, envMapIntensity: 0.04 });
  // Exterior satin vulcanite plastic for the ergonomic wind-lever thumb tip (distinct from dead-flat interior palpas)
  base.leverTip = P({ name: 'leverTip', color: 0x18191c, metalness: 0.0, roughness: 0.56, clearcoat: 0.14, clearcoatRoughness: 0.46 });
  // (the baseplate's black chrome reads satin in the photographs)
  // (the undersides of the plate's overhangs, seen edge-on from above, would show through the wall along its foot)
  base.blackChromeUnder = base.blackChrome.clone(); base.blackChromeUnder.name = 'blackChromeUnder'; base.blackChromeUnder.userData = { ...base.blackChrome.userData, single: true };
  base.blackChromeSatin = base.blackChrome.clone(); base.blackChromeSatin.name = 'blackChromeSatin'; base.blackChromeSatin.roughness = 0.54; base.blackChromeSatin.clearcoat = 0.12; base.blackChromeSatin.userData = { ...base.blackChrome.userData };
  base.finderGlass = P({ name: 'finderGlass', color: 0x06080a, metalness: 0, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.03, specularIntensity: 1 });
  // the illumination window's frosted ribs (geometry: lit from behind, a little); inside the finder windows, the frame
  // mask's warm grey, the patch mirror's silvering; the eyepiece's window, bright with the finder's view
  base.frosted = P({ name: 'frosted', color: 0xb9bab5, roughness: 0.66, metalness: 0, emissive: 0x121211, sheen: 0.25, side: THREE.DoubleSide });
  base.m6maskWarm = P({ name: 'm6maskWarm', color: 0x161412, roughness: 0.6, metalness: 0.15 });
  // (the windows' panes: clear, so no white veil — only the glass's own reflections; blended, never transmissive)
  base.m6pane = P({ name: 'm6pane', color: 0x000000, metalness: 0, roughness: 0.02, transparent: true, opacity: 0.22, clearcoat: 1, clearcoatRoughness: 0.02, depthWrite: false });
  // the counter's magnifier: clear, so the disc reads through it; only its highlights show
  base.m6dome = P({ name: 'm6dome', color: 0x000000, metalness: 0, roughness: 0.02, transparent: true, opacity: 0.1, clearcoat: 1, clearcoatRoughness: 0.02, depthWrite: false });
  base.m6patch = P({ name: 'm6patch', color: 0xb9bcc0, roughness: 0.18, metalness: 0.75, emissive: 0x1e1f21 });
  base.m6eyeWindow = P({ name: 'm6eyeWindow', color: 0x08090a, roughness: 0.1, metalness: 0, emissive: 0xffffff, clearcoat: 1, clearcoatRoughness: 0.04 });
  {
    // (from behind, the eyepiece shows the finder's exit pupil: a small bright patch deep in dark glass, not a grey tile)
    const cv = canvas(128, 128), g = cv.getContext('2d'), gr = g.createRadialGradient(64, 60, 3, 64, 64, 78);
    gr.addColorStop(0, '#6f7377'); gr.addColorStop(0.3, '#34373a'); gr.addColorStop(0.62, '#121314'); gr.addColorStop(1, '#050506');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    const t = tex(cv); t.repeat.set(1 / 8.6, 1 / 8.6); t.offset.set(0.5, 0.5);
    base.m6eyeWindow.emissiveMap = t;
  }
  base.vulcanite = base.leather.clone(); base.vulcanite.name = 'vulcanite'; base.vulcanite.color.setHex(0x121212); base.vulcanite.roughness = 0.62; base.vulcanite.sheen = 0.18; base.vulcanite.sheenColor.setHex(0x1c1c1c); base.vulcanite.userData = { ...base.leather.userData };
  for (const k of ['map', 'normalMap', 'roughnessMap']) {
    const src = base.leather[k], t = src.clone();
    t.repeat.set(k === 'map' ? 1 / 53 : 1 / VULC_TILE, k === 'map' ? 1 / 53 : 1 / VULC_TILE); base.vulcanite[k] = t;
    // (the leather's maps are synthesised a moment after they are made: the copy follows them)
    defer(() => { t.needsUpdate = true; });
  }
  base.vulcanite.normalScale.set(0.95, 0.95);
  base.curtain = P({ name: 'curtain', color: 0x1c1c1d, roughness: 0.82, metalness: 0, sheen: 0.3, sheenColor: 0x2a2a2a, side: THREE.DoubleSide });
  base.meterSpot = P({ name: 'meterSpot', color: 0xd8d6cf, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1, side: THREE.DoubleSide });
  for (const k of ['finderGlass', 'meterSpot', 'm6patch', 'm6eyeWindow', 'm6pane', 'm6dome']) base[k].userData.single = true;
  const lib = new MatLib(base, [clipPlane]);
  const hov = {};
  PARTS.forEach((name) => { hov[name] = { name, amount: { value: 0 }, color: { value: new THREE.Color(1.0, 0.82, 0.5).multiplyScalar(0.28) }, target: 0 }; });

  const root = new THREE.Group();
  // (named as the 503's root is: the Studio finds the camera on its tripod by this name)
  root.name = 'camera503';
  root.userData.kind = 'm6';
  const tripod = buildTripod(lib, DIM.tripod);
  root.add(tripod.group);
  const head = buildHead(lib, hov);
  const yaw = new THREE.Group(); yaw.position.y = tripod.top; yaw.add(head.yawMM);
  const pitch = new THREE.Group(); pitch.position.y = head.pitchY; pitch.add(head.pitchMM); yaw.add(pitch);
  const rollG = new THREE.Group(); rollG.position.y = head.rollY; head.rollMM.position.y = -head.rollY; rollG.add(head.rollMM); pitch.add(rollG);
  root.add(yaw);
  const mm = new THREE.Group(); mm.scale.setScalar(0.001); rollG.add(mm);

  const body = buildBody(lib, hov);
  mm.add(body.core, body.top, body.base, body.door);
  const lensMount = new THREE.Group(); lensMount.position.z = DIM.flange; mm.add(lensMount);
  let L = buildLens(lib, lens, hov);
  lensMount.add(L.group);
  // on the head's plate by the tripod bush
  mm.position.set(-DIM.socket.x / 1000, (head.plateTop - B.bottom) / 1000 - head.rollY, -DIM.socket.z / 1000);

  // a soft contact shadow under the tripod
  const blobCv = canvas(128, 128), bg = blobCv.getContext('2d'), grad = bg.createRadialGradient(64, 64, 2, 64, 64, 64);
  grad.addColorStop(0, 'rgba(0,0,0,0.42)'); grad.addColorStop(0.5, 'rgba(0,0,0,0.16)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
  bg.fillStyle = grad; bg.fillRect(0, 0, 128, 128);
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(blobCv), transparent: true, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2; blob.position.y = 0.012; blob.renderOrder = -1; blob.userData.noShadow = true;
  root.add(blob);

  const lensLists = (Lx) => [Lx.focusMeshes, Lx.apertureMeshes, Lx.filterMeshes];
  const lensDyn = (Lx) => [Lx.group, Lx.focus, Lx.ext, Lx.aperture, Lx.inner, Lx.hoodGroup, Lx.filterGroup, Lx.glassMesh, Lx.rearMount].filter(Boolean);
  const camDyn = [
    mm, body.core, body.top, body.base, body.door,
    body.curtain, body.curtain1Cloth, body.curtain1Lath, body.meterSpot, body.curtain2Cloth, body.curtain2Lath,
    body.rfRoller, body.lensRelBtn, body.batCap, body.rwCrankPivot, body.baseKeySpin, body.baseKeyFlip,
    body.rl, body.sel, body.rwSpin,
    body.dial, body.release, body.lever, body.counterDisc, body.isoRing, lensMount,
    head.yawMM, head.pitchMM, head.rollMM, head.bubble, blob,
  ];
  const allDyn = () => new Set([...camDyn, ...lensDyn(L)]);
  mergeStaticRigid(root, { dynamic: allDyn(), lists: [...lensLists(L), body.dialMeshes, body.leverMeshes, body.releaseMeshes, body.selMeshes, body.eyepieceMeshes, head.aimMeshes, head.rollMeshes] });
  const toLayer = (obj) => obj.traverse((o) => {
    if (!o.isMesh) return;
    o.layers.set(1);
    o.castShadow = !o.userData.noShadow && !o.material.transparent; o.receiveShadow = !o.userData.noShadow;
  });
  toLayer(root);

  const pickables = { focus: [], aperture: [], shutter: body.dialMeshes, filter: [], crank: body.leverMeshes, release: body.releaseMeshes, preview: body.selMeshes, finder: body.eyepieceMeshes, aim: head.aimMeshes, roll: head.rollMeshes };
  function refreshPickables() {
    const set = (k, list) => { pickables[k].length = 0; if (list) pickables[k].push(...list); };
    set('focus', L.focusMeshes); set('aperture', L.apertureMeshes); set('filter', L.filterMeshes);
  }
  refreshPickables();

  const st = {
    focusRot: 0, focusT: 0, ext: 0, extT: 0, apRot: 0, apT: 0, dial: 0, dialT: 0, isoRot: 0, isoT: 0,
    lever: 0, press: 0, curtain1: 0, curtain2: 0, rewind: 0, crankOpen: 0,
    // the rewind lever (1 at R), baseplate off (1), baseplate key lift/turn, hinged back flap (doorK 0..1),
    // front lens-release button press (lensRelK), battery cap unscrew (batCapK),
    // frame preselector (−1 toward the lens … 1 away), counter override (ctr)
    rLever: 0, baseOff: 0, baseKey: 0, baseKeyLift: 0, doorK: 0, lensRelK: 0, batCapK: 0,
    sel: 0, selHold: null, ctr: null,
    lensOut: 0, lensTwist: 0, explodeK: 0, hoodOn: false, filterId: 'none', polAngle: 90, snapRings: true,
  };
  const tweens = [];
  const tween = (dur, fn, ease = easeInOut, key = null) => new Promise((res) => tweens.push({ t: 0, dur: Math.max(1e-3, dur), fn, ease, res, key }));
  const hold = (ms) => tween(Math.max(1e-3, ms / 1000), () => {}, (u) => u);
  const animate = (key, to, dur, ease) => {
    for (let i = tweens.length - 1; i >= 0; i--) if (tweens[i].key === key) { const [tw] = tweens.splice(i, 1); tw.res(); }
    const from = st[key];
    return tween(dur, (k) => { st[key] = lerp(from, to, k); }, ease, key);
  };

  let live = null, filmKey = '', frameKey = -1, ctrHeld = null;
  function ringTargets(s) {
    const ln = L.lens;
    const d = Math.max(s.focus ?? 10000, ln.minFocusDistance);
    st.focusT = d >= 9999 ? 0 : focusAngle(ln, d);
    st.extT = helicoidExtensionMm(ln, d);
    const ap = ln.apertureStops, last = ap.length - 1;
    let N = typeof s.aperture === 'number' && s.aperture > 0 ? s.aperture : null;
    if (N == null) {
      const ai = Math.min(last, Math.max(0, s.apertureIdx ?? 0)), i0 = Math.min(last, Math.floor(ai)), i1 = Math.min(last, i0 + 1);
      N = ap[i0] * Math.pow(ap[i1] / ap[i0], ai - i0);
    }
    N = Math.min(ap[last], Math.max(ap[0], N));
    // (the stop index, fractional between click stops: the engraved numbers are rounded, the stops a stop apart)
    let ai = last;
    for (let i = 0; i < last; i++) if (N <= ap[i + 1]) { ai = i + Math.log(N / ap[i]) / Math.log(ap[i + 1] / ap[i]); break; }
    st.apT = ai * AP_STEP;
    // the dial: the speed set (B = −1) brought round to the index on the housing, toward −X
    st.dialT = -((s.shutterIdx ?? 7) + 1) * DIAL_STEP;
    if (s.hoodOn !== undefined) st.hoodOn = Boolean(s.hoodOn);
    if (s.filter !== undefined) st.filterId = (typeof s.filter === 'string' ? s.filter : s.filter?.id) || 'none';
  }
  /** The counter's disc (0 to 38, the frame at the index) and the film-speed dial on the back door. */
  function drawFilm(s) {
    const fr = Math.round((st.ctr ?? s.frame ?? 1) * 20) / 20;
    if (fr !== frameKey) {
      frameKey = fr;
      // (the photographs: a white disc, a tick a frame round its rim, the numbers black, read under the fixed V at the
      // front; the disc turns a tick a frame)
      const g = body.ctrCv.getContext('2d'), c = 128;
      g.fillStyle = '#ecebe6'; g.fillRect(0, 0, 256, 256);
      g.strokeStyle = g.fillStyle = '#1a1a1a'; g.textAlign = 'center'; g.textBaseline = 'middle';
      for (let n = -3; n <= 40; n++) {
        const a = Math.PI / 2 - (n - fr) * 8.2 * DEG;
        if (Math.abs(n - fr) > 11) continue;
        const r1 = (n + 5) % 5 === 0 ? 92 : 100;
        g.lineWidth = 3; g.beginPath(); g.moveTo(c + Math.cos(a) * 112, c - Math.sin(a) * 112); g.lineTo(c + Math.cos(a) * r1, c - Math.sin(a) * r1); g.stroke();
        if (n >= 0 && n % 4 === 0) arcText(g, String(n), c, c, 70, a, 38, '#1a1a1a', 500);
      }
      g.lineWidth = 4; g.beginPath(); g.moveTo(c - 9, 6); g.lineTo(c, 26); g.lineTo(c + 9, 6); g.stroke();
      body.ctrTex.needsUpdate = true;
    }
    // the TTL meter film-speed dial: inner ring tweens smoothly so its lower triangle points at the film's ISO speed
    const iso = s.film?.iso ?? 400, key = String(iso);
    if (key !== filmKey) {
      filmKey = key;
      let idx = 0; ISO_STEPS.forEach((v, i) => { if (Math.abs(Math.log(v / iso)) < Math.abs(Math.log(ISO_STEPS[idx] / iso))) idx = i; });
      st.isoT = -15 * DEG * Math.log2(200 * 2 ** ((idx - ISO_STEPS.indexOf(200)) / 3) / 200);
    }
  }

  let selLast = null, selSeq = 0;
  const selRest = () => SEL_AT[L.lens.frames?.[0] ?? L.lens.focalLength] ?? 0;
  st.sel = selRest();

  function applyPose() {
    const e = easeInOut(st.explodeK);
    lensMount.position.z = DIM.flange - 110 * e - 70 * st.lensOut;
    lensMount.rotation.z = -st.lensTwist * (60 * DEG);
    body.top.position.y = 48 * e;
    body.base.position.y = -42 * e - 30 * st.baseOff;
    // Hinged back flap lifts upward around its top hinge independently on st.doorK (and translates back on explodeK!)
    body.door.position.set(0, body.doorHingeY, body.doorHingeZ + 34 * e);
    body.door.rotation.x = -st.doorK * (110 * DEG);
    body.isoRing.rotation.z = st.isoRot;
    // Baseplate locking key lifts & rotates toward OPEN; front lens-release button depresses; battery cap unscrews forward
    const keyLift = Math.max(st.baseKeyLift || 0, Math.min(1, (st.baseKey || 0) * 2.5));
    body.baseKeyFlip.rotation.x = keyLift * (Math.PI / 2);
    body.baseKeySpin.rotation.y = -(st.baseKey || 0) * (100 * DEG);
    body.lensRelBtn.position.z = B.zF + 1.4 * (st.lensRelK || 0);
    body.batCap.position.z = B.zF - 10.0 * (st.batCapK || 0);
    body.batCap.rotation.z = (st.batCapK || 0) * TAU * 1.5;
    // Live rangefinder roller arm inside open M-mount pushed rearward by the lens's focusing cam as focus moves close!
    body.rfRoller.position.z = -24.0 + st.ext * 0.45;
    L.focus.rotation.z = st.focusRot;
    L.aperture.rotation.z = st.apRot;
    L.ext.position.z = -st.ext;
    // the iris as the glass shows it: the ring's own position gives the stop, so the blades move with the ring
    { const ap = L.lens.apertureStops, ai = Math.min(ap.length - 1, Math.max(0, st.apRot / AP_STEP)), i0 = Math.min(ap.length - 2, Math.floor(ai));
      const N = ap[i0] * Math.pow(ap[i0 + 1] / ap[i0], ai - i0), rIris = L.focalMm / (2 * N) / L.pupilMag;
      L.lensGlassU.optics.value.set(rIris, 1.0, L.def.front.glassR, 12.6);
      L.lensGlassU.state.value.set((1 - Math.min(1, rIris / 13)) * 0.5, L.pupilMag, st.ext, Math.max(e, st.lensOut)); }
    const mountedOnly = e <= 0.005 && st.lensOut <= 0.005 && !cutaway;
    body.curtain.visible = !mountedOnly || st.doorK > 0.01;
    if (!mountedOnly && L.ensureRear?.()) { mergeStaticRigid(L.rearMount, { dynamic: new Set(), lists: [] }); toLayer(L.rearMount); }
    if (L.rearMount) L.rearMount.visible = !mountedOnly;
    if (cutaway && L.ensureInner?.()) toLayer(L.inner);
    if (L.inner) L.inner.visible = cutaway;
    if (L.def.builtInHood) {
      L.hoodGroup.visible = true;
      L.hoodGroup.position.z = st.hoodOn ? -(L.def.hoodSlide || 25.5) : 0;
    } else {
      if (st.hoodOn && L.ensureHood?.()) toLayer(L.hoodGroup);
      L.hoodGroup.visible = Boolean(st.hoodOn);
      L.hoodGroup.position.z = 0;
    }
    if (st.filterId !== 'none' && L.ensureFilter?.()) { toLayer(L.filterGroup); refreshPickables(); }
    L.filterGroup.visible = st.filterId !== 'none';
    if (L.filterGroup.visible) {
      const tint = filterOpticsFor(st.filterId)?.ggTint || [1, 1, 1];
      L.filterMat.color.setRGB(Math.min(1, tint[0]), Math.min(1, tint[1]), Math.min(1, tint[2]));
      L.filterGroup.rotation.z = st.filterId === 'polarizer' ? (st.polAngle ?? 90) * DEG : 0;
    }
    body.dial.rotation.y = st.dial;
    body.lever.rotation.y = st.lever;
    body.release.position.y = DIM.hub.top - 1.1 * st.press;
    body.rwSpin.rotation.y = st.rewind;
    body.rwCrankPivot.rotation.z = -(st.crankOpen || 0) * (108 * DEG);
    body.rl.rotation.z = R_SWING * st.rLever;
    body.sel.rotation.z = DIM.front.selector.tilt * DEG * st.sel;
    // True two-curtain horizontal focal-plane shutter (non-clipping cloths + laths; traveling slit above 1/50 s!)
    const k1 = Math.max(0, Math.min(1, st.curtain1)), k2 = Math.max(0, Math.min(1, st.curtain2));
    const x1 = lerp(18.5, -18.5, k1), x2 = lerp(18.5, -18.5, k2);
    body.curtain1Cloth.scale.x = Math.max(0.001, 1 - k1);
    body.curtain1Cloth.position.x = (-18.5 + x1) * 0.5;
    body.curtain1Cloth.visible = k1 < 0.995;
    body.curtain1Lath.position.x = x1;
    body.curtain1Lath.visible = k1 > 0.005 && k1 < 0.995;
    body.meterSpot.position.x = x1 - 18.5;
    body.meterSpot.visible = k1 < 0.34;
    body.curtain2Cloth.scale.x = Math.max(0.001, k2);
    body.curtain2Cloth.position.x = (x2 + 18.5) * 0.5;
    body.curtain2Cloth.visible = k2 > 0.005;
    body.curtain2Lath.position.x = x2;
    body.curtain2Lath.visible = k2 > 0.005 && k2 < 0.995;
  }

  // ───────── Cutaway ─────────
  let cutaway = false;
  function setCutaway(on) {
    cutaway = on;
    if (!on) clipPlane.set(new THREE.Vector3(0, 1, 0), 1e7);
    else if (L.ensureInner?.()) toLayer(L.inner);
    if (L.inner) L.inner.visible = cutaway;
  }

  const lensCache = new Map();
  const anchor = (parent, x, y, z, text, sub) => { const o = new THREE.Object3D(); o.position.set(x, y, z); parent.add(o); return { o, text, sub }; };
  let labels = [], labelEls = null, dotEls = null, labelsShown = null;
  const _labelV = new THREE.Vector3();
  function buildLabels() {
    labels.forEach((l) => l.o.parent?.remove(l.o));
    const mf = String(L.lens.minFocusDistance).replace('.', ',');
    labels = [
      anchor(lensMount, 0, 34, -L.L / 2, 'Lens', `focused by the rangefinder · ${mf} m to ∞`),
      // (one label to each part: labelAt finds a label by the part a pick lands on)
      anchor(body.top, FINDER.x, TP.housing + 6, -18, 'Viewfinder and rangefinder', '0.72×: frames for 28 + 90, 35 + 135, 50 + 75 mm · a 69.25 mm base'),
      anchor(body.dial, 0, DIM.dial.top - TP.deck + 4, 0, 'Shutter-speed dial', 'cloth focal-plane shutter · 1 s to 1/1000'),
      anchor(body.curtain, 0, -12, -6, 'Shutter', 'its first curtain\'s white spot is what the meter reads'),
      anchor(body.base, 0, B.bottom - 6, -8, 'Baseplate', 'comes off to load the film'),
      anchor(body.sel, 0, DIM.front.selector.len - 3, -3, 'Frame preselector', 'shows another lens\'s frames in the finder'),
      anchor(body.rl, 0, 5, B.zF - 3, 'Rewind lever', 'over to R to wind the film back'),
      anchor(body.door, 8.5, -3 - body.doorHingeY, B.zB + 8 - body.doorHingeZ, 'Back door', 'lifts to thread the film · TTL meter ISO/DIN dial'),
      anchor(body.core, -50, 0, -12, 'Body', '35 mm film: 36 pictures of 24 × 36 mm a roll'),
    ];
  }
  buildLabels();

  const tmpQ = new THREE.Quaternion();
  const api = {
    root, opticsMoving: false, cutSide: 1, pickables, buildMs: 0, st, timeScale: 1, applyPose,
    setDoorOpen(on) { return animate('doorK', on ? 1 : 0, 0.55); },
    setAim(pan, tilt, roll = 0) { yaw.rotation.y = -Math.PI / 2 + pan; pitch.rotation.x = tilt; rollG.rotation.z = roll; root.updateMatrixWorld(true); },
    bodyCenter(v) { return mm.localToWorld(v.set((B.x0 + B.x1) / 2, 10, (B.zF + B.zB) / 2)); },
    worldToBody(v) { return mm.worldToLocal(v); },
    setRings(s) {
      live = s; ringTargets(s); drawFilm(s);
      if (st.snapRings) { st.focusRot = st.focusT; st.ext = st.extT; st.apRot = st.apT; st.dial = st.dialT; st.isoRot = st.isoT; st.snapRings = false; }
    },
    setHood(on) {
      st.hoodOn = Boolean(on); if (live) live.hoodOn = st.hoodOn;
      if (L.def.builtInHood) { L.hoodGroup.visible = true; L.hoodGroup.position.z = st.hoodOn ? -(L.def.hoodSlide || 25.5) : 0; }
      else { if (st.hoodOn && L.ensureHood?.()) toLayer(L.hoodGroup); L.hoodGroup.visible = st.hoodOn; L.hoodGroup.position.z = 0; }
    },
    setFilter(filterId, polAngle = st.polAngle) { st.filterId = filterId || 'none'; st.polAngle = polAngle; if (live) { live.filter = st.filterId; live.polAngle = polAngle; } if (st.filterId !== 'none' && L.ensureFilter?.()) { toLayer(L.filterGroup); refreshPickables(); } },
    get hoodOn() { return Boolean(st.hoodOn); },
    get hasHood() { return true; },
    /** From the entrance pupil back to the film plane, in metres (the M flange is 27.8 mm from the film). */
    filmOffset() {
      const ep = lensOpticsFor(L.lens).entrancePupilMm || 23;
      const a = mm.localToWorld(new THREE.Vector3(0, 0, DIM.flange - L.L - st.ext + ep)), b = mm.localToWorld(new THREE.Vector3(0, 0, 0));
      return a.distanceTo(b);
    },
    lensPose(pos, quat) {
      const ep = lensOpticsFor(L.lens).entrancePupilMm || 23;
      pos.copy(mm.localToWorld(new THREE.Vector3(0, 0, DIM.flange - L.L - st.ext + ep)));
      rollG.getWorldQuaternion(quat);
    },
    /** The eye at the finder window, looking along the lens axis: the rangefinder's view (cameras.js viewing). */
    finderPose() {
      const q = rollG.getWorldQuaternion(new THREE.Quaternion());
      const eye = mm.localToWorld(new THREE.Vector3(FINDER.x, FINDER.y, TP.zF - 1.0));
      const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(q), up = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
      return { eye, target: eye.clone().addScaledVector(fwd, 1), up };
    },
    ringAxisWorld(target = new THREE.Vector3()) { return target.set(0, 0, -1).applyQuaternion(mm.getWorldQuaternion(tmpQ)).normalize(); },
    ringAngle(part) {
      if (part === 'focus') return -st.focusT;
      if (part === 'aperture') return -st.apT;
      if (part === 'shutter') return -st.dialT;
      return 0;
    },
    ringValueAt(part, angle) {
      const ln = L.lens;
      if (part === 'focus') return distanceAt(ln, angle);
      if (part === 'aperture') return Math.max(0, -angle / AP_STEP);
      if (part === 'shutter') return angle / DIAL_STEP - 1;
      return 0;
    },
    setHover(part) { PARTS.forEach((p) => { hov[p].target = p === part ? 1 : 0; }); },
    /** A finger on the frame preselector: the next pair of frames shown in the finder for a moment (toward the lens
     *  the 28 + 90, away from it the 35 + 135, upright the 50 + 75), then the lever springs back to the lens's own. */
    async previewLever(ms = 2600) {
      const rest = selRest(), others = [-1, 0, 1].filter((v) => v !== rest);
      const to = others[(others.indexOf(selLast) + 1) % others.length];
      selLast = to; st.selHold = to;
      const mine = ++selSeq;
      await hold(ms);
      if (mine === selSeq) st.selHold = null;
    },
    /** The frames the preselector is holding in the finder, or null while it rests where the lens leaves it. */
    get finderFrames() { return st.selHold != null && st.selHold !== selRest() ? SEL_PAIRS[st.selHold] : null; },
    async setExploded(on) { setCutaway(false); await animate('explodeK', on ? 1 : 0, 1.3); },
    async swapLens(next, onSwap) {
      const vis = root.visible;
      if (vis) { await animate('lensTwist', 1, 0.3); await animate('lensOut', 1, 0.45); }
      lensMount.remove(L.group);
      lensCache.set(L.lens.id, L);
      const cached = lensCache.get(next.id);
      if (cached) L = cached;
      else { L = buildLens(lib, next, hov); mergeStaticRigid(L.group, { dynamic: new Set(lensDyn(L)), lists: lensLists(L) }); toLayer(L.group); }
      lensMount.add(L.group);
      refreshPickables();
      buildLabels(); labelEls?.forEach((el) => el.remove()); dotEls?.forEach((el) => el.remove()); labelEls = dotEls = null;
      onSwap();
      if (live) { ringTargets(live); st.focusRot = st.focusT; st.ext = st.extT; st.apRot = st.apT; }
      if (vis) { applyPose(); await animate('lensOut', 0, 0.5); await animate('lensTwist', 0, 0.3); }
      else { st.lensOut = 0; st.lensTwist = 0; applyPose(); }
    },
    /** The firing cycle: the release pressed, the first curtain uncovers the film, the second covers it after the time
     *  set; then the lever's 120° stroke winds on — the counter moves on a frame and the rewind crank turns back
     *  (lastFrame: the roll is rewound and a fresh one loaded instead). A
     *  rangefinder has no mirror: the finder never goes dark (onMirror is not called). */
    async fire({ seconds, onExpose, onSound = () => {}, cutaway: cut = false, side = 1, lastFrame = false }) {
      if (cut) { api.cutSide = side; setCutaway(true); }
      await animate('press', 1, 0.08, (k) => k);
      onSound('release');
      onSound('leafOpen');
      // True horizontal cloth focal-plane shutter physics: speeds faster than 1/50 s X-sync form a real traveling slit!
      const travelSec = 0.022;
      if (seconds < 1 / 50) {
        const slitDelay = Math.max(0.003, (seconds / (1 / 50)) * travelSec);
        const total = travelSec + slitDelay;
        let exposeP = null;
        await tween(total, (k) => {
          const t = k * total;
          st.curtain1 = Math.min(1, t / travelSec);
          st.curtain2 = Math.max(0, Math.min(1, (t - slitDelay) / travelSec));
          if (!exposeP && t >= total * 0.5) exposeP = Promise.resolve(onExpose());
        }, (u) => u, 'slit');
        if (exposeP) await exposeP;
      } else {
        await animate('curtain1', 1, travelSec, (k) => k);
        const expose = onExpose();
        await Promise.all([hold(Math.max(seconds * 1000, 120)), expose]);
        await animate('curtain2', 1, travelSec, (k) => k);
      }
      onSound('leafClose');
      animate('press', 0, 0.16);
      await hold(380);
      // (the thumb takes the lever out to its 30° stand-off, winds through 120°, and lets it spring back)
      const from = st.lever, rw0 = st.rewind;
      const stroke = async (turn) => {
        await animate('lever', LEVER_OUT, 0.22);
        onSound('wind');
        st.curtain1 = 0; st.curtain2 = 0;
        await tween(0.42, (k) => { st.lever = LEVER_OUT + LEVER_STROKE * k; turn(k); });
        await animate('lever', from, 0.34, (k) => 1 - Math.pow(1 - k, 2));
      };
      if (!lastFrame) await stroke((k) => { st.rewind = rw0 - k * 2.4 * TAU / 3; });
      else {
        // the roll's last frame: the film will not wind on. The lever over to R, the film cranked back into its
        // cassette (the counter holds: it is not geared to the rewind), the baseplate off — which lets the counter
        // spring back to its start, two ticks before 0 — a fresh roll in, the baseplate on, the lever back, and the
        // leader wound on to frame 1 (the two blank releases of loading are not shown)
        const n = live?.frame ?? 36;
        st.ctr = n;
        await hold(250);
        await animate('rLever', 1, 0.3);
        await tween(4.2, (k) => { st.rewind = rw0 + k * REWIND_TURNS * TAU; }, (k) => k * k * (3 - 2 * k));
        st.rewind = rw0;
        await hold(250);
        await animate('baseOff', 1, 0.5);
        await tween(0.18, (k) => { st.ctr = lerp(n, -2, k); }, (k) => 1 - Math.pow(1 - k, 3));
        await hold(700);
        await animate('baseOff', 0, 0.5);
        await animate('rLever', 0, 0.25);
        for (let i = 0; i < 3; i++) { const c0 = -2 + i; await stroke((k) => { st.ctr = c0 + k; st.rewind = rw0 - k * 2.4 * TAU / 3; }); await hold(120); }
        ctrHeld = n;
      }
      await hold(150);
      if (cut) setCutaway(false);
    },
    setCutaway(on, side = 1) { api.cutSide = side; setCutaway(on); },
    update(dt) {
      dt *= api.timeScale;
      for (let i = tweens.length - 1; i >= 0; i--) {
        const tw = tweens[i]; tw.t += dt;
        const k = Math.min(1, tw.t / tw.dur); tw.fn(tw.ease(k));
        if (k >= 1) { tweens.splice(i, 1); tw.res(); }
      }
      if (ctrHeld != null && live && (live.frame !== ctrHeld || live.frame === 1)) { ctrHeld = null; st.ctr = null; }
      if (live) { ringTargets(live); drawFilm(live); }
      const a = 1 - Math.exp(-dt * 16);
      st.sel += ((st.selHold ?? selRest()) - st.sel) * a;
      st.focusRot += (st.focusT - st.focusRot) * a;
      st.ext += (st.extT - st.ext) * a;
      st.apRot += (st.apT - st.apRot) * a;
      st.dial += (st.dialT - st.dial) * a;
      st.isoRot += (st.isoT - st.isoRot) * a;
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
    get parts() { return { mm, body, lensMount, lens: L, head }; },
  };
  applyPose();
  api.buildMs = performance.now() - t0;
  return api;
}
