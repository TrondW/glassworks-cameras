// The camera: a 503CX-style body, A12 magazine, waist-level finder and eleven
// individually modelled CF lenses, on a 4-section carbon tripod with a 3-way
// pan/tilt head — every part procedural, in millimetres (lathe profiles,
// rounded-rect lofts, bevelled extrusions with analytic edge normals), with
// procedural textures (pebble-grain leatherette, brushed chrome, rubber knurl,
// carbon twill) and scales engraved to canvas.
// Moving parts: finder hood + magnifier, bayonet lens swap, exploded view, and
// the V-system firing cycle (leaf shutter closes → mirror up → auxiliary
// shutter opens → leaf opens for the exposure → closes; winding resets all),
// shown in a cutaway with solid section faces.
// Model axes: lens axis along −Z (like a three.js camera), +X = photographer's right.
//
// API (createCamera503 → object): root, opticsMoving, cutSide, setAim, bodyCenter,
// worldToBody, setScreenTexture, setRings, lensPose, lookDownPose, setFinderOpen,
// setExploded, swapLens, fire, update, updateLabels — plus:
//   pickables            { focus, aperture, shutter, crank, release, finder } → Mesh[]
//                         (arrays are refreshed in place after a lens swap; mesh.userData.part is set)
//   setHover(part|null)  warm edge glow on one control
//   ringAxisWorld(v)     lens axis in world space, pointing out of the front of the lens
//   ringAngle(part)      current ring angle (rad), right-handed about ringAxisWorld()
//   ringValueAt(part, a) focus → metres (10000 = ∞); aperture / shutter → fractional index
// setRings accepts s.aperture (f-number, half-stops fine) or a fractional s.apertureIdx.
// Heavy textures are synthesised right after the build in a small job queue;
// flushCameraTextures() forces them (e.g. before a capture).
import * as THREE from 'three';
import { decalAtlas } from '../../lib/decals.js';
import { INK, PAINT_BG, fmtN } from '../../lib/engrave.js';
import { addScrew, atlasRow, boxUV, capFromLoop, carve, decalUV, loft, offsetLine, radialT, rbox, revolve, rrPath, rrPoly, sectionPair, shapeFrom, slab } from '../../lib/geometry.js';
import { MatLib, baseMaterials } from '../../lib/materials.js';
import { Kit, fastMerge, foldSiblings, mergeStaticRigid, prep } from '../../lib/mesh.js';
import { buildHead, buildTripod } from '../../lib/rig.js';
export { flushCameraTextures } from '../../lib/textures.js';   // (the film stage flushes them before a capture)
import { DEG, FONT, T, TAU, clamp01, easeInOut, easeOutBack, lerp, phase, snapOpen, snapUp } from '../../lib/util.js';
import { SHUTTER_SPEEDS, lensOpticsFor, helicoidExtensionMm, fleIndexFor, filterOpticsFor } from '../../optics.js';

// ───────── Dimensions (mm) ─────────
// From the 503CX instruction manual's dimension drawing, the CF lens datasheets and, for the body's proportions,
// photographs of a chrome 503CX from every side (Wikimedia Commons 503cx-07…18; a KEH body-only listing): the body
// is nearly a cube — its side as deep as ~0.9 of its height — the lens seating deep in a throat behind a mount ring
// that stands ~1.5 mm proud of the front. Origin = lens axis, z = 0 at the old (71.4 mm) body's centre plane: the
// rear (and so the magazine, the screen and the mirror) stay where they were; the front came forward 12.6 mm.
export const DIM = {
  // (87 wide: flush with the A12, whose published 98 includes its crank and key — every photo's ratios agree:
  //  depth/width 0.97, depth/height 0.91, the front face square)
  body: { w: 87, front: 80, top: 49, bottom: -43, zFront: -48.3, zBack: 35.7 },
  foot: 3,                   // quick-coupling foot under the body (axis is 46 above its base)
  footZ: -17.6,              // the tripod socket: 30.7 behind the front, in the coupling plate (the bottom view)
  footPlate: { w: 36.5, l: 70.5, z0: 3.5 },   // the quick-coupling plate: 36.5 across, 70.5 long, meeting the rear hinge bracket
  mountR: 42.0,              // the mount ring's bright front face, R 37.7 → 41.9 (Commons 12: 0.964 of the face's width), all but touching the sides
  flange: -49.8,             // where the lens seats (the mount ring's front face) — its rear barrel enters the throat
  mountThroat: 36.5,
  magazine: { w: 87, h: 92, d: 49 },
  finder: { w: 71.4, d: 75, z: -1.6, y: 44 },   // (its base; the lid 68 wide — top-view photographs)
  screen: 58, screenY: 40, screenZ: 1.8,
  crank: { r: 26.0, y: 15, z: -17 },   // the black disc (Ø52), forward of the side's middle (photos)
  mirror: { y: 28.0, z: 29.5, w: 61, len: 65.0 },
  tripod: { apex: 1210, spread: 560 },
};
const FRONT = DIM.body.zFront, BACK = DIM.body.zBack, TOP = DIM.body.top, BOT = DIM.body.bottom;
// the mount ring's profile [r, z from the front face, smoothing]: the throat lip, the wide bright face 1.5 mm proud
// (the lens's seat), its rounded outer edge down to the front plate
const MOUNT_PROFILE = [[35.2, 1.9, 0], [35.2, -0.6, 0.4], [35.6, -1.5, 0.9], [36.3, -1.5, 1], [39.6, -1.5, 1], [40.1, -1.15, 0.8], [40.25, -0.45, 0.4], [40.45, 0.1, 0]];
const HW = DIM.body.w / 2;

// Ring scales: the value at the top index is brought there by turning the ring.
const FOCUS_THROW = 280 * DEG;   // ∞ → closest focus
// Aperture and speed scales run in opposite directions with the same pitch per stop,
// so the orange EV numerals on the speed ring, read against the red index on the
// aperture ring, always show log2(N²/t) — the CF lenses' EV system.
const EV_STEP = 7.2 * DEG;       // one stop on either ring (the CF 80 on a 500C/M from above: 1 s → 1/500 over ~65°)
const SH_STEP = EV_STEP;
/** Stops from full aperture for each engraved f-number. */
const apStops = (lens) => lens.apertureStops.map((N) => 2 * Math.log2(N / lens.apertureStops[0]));
const COC = 0.05;                // mm, circle of confusion for 6×6

function focusK(lens) { return FOCUS_THROW * lens.minFocusDistance; }   // φ(d) = −k/d  (rad·m)
function dofDelta(lens, N) { const f = lens.focalLength / 1000; return (N * COC / 1000) / (f * f); } // Δ(1/d) in 1/m
// On a CF lens the speed scale and the aperture scale are both set against the central index
// (read along its meridian); the orange EV numerals follow the speeds on the speed ring and are
// read against a red index on the aperture ring, round on its right-hand side.
const EV_INDEX = 86 * DEG;   // (the △ at f/2,8: on the crank side, the EV numerals running on from 1/500 — CF 80 side view)

/**
 * One 4096×1024 atlas (8 rows × 128) holds every engraved band of a lens. `bands[row] = [length, radius]`
 * (mm) lets each row draw its glyphs at a true aspect ratio and a size given in millimetres, since
 * every band maps its own length onto the same 128-pixel row.
 */
function lensAtlas(lens, def, bands) {
  // (globalThis.GW_ATLAS_SCALE: the film stage draws it at twice the size for 4K close-ups; the site keeps 4096 × 1024)
  const AS = globalThis.GW_ATLAS_SCALE || 1, W = 4096 * AS, RH = 128 * AS, cv = document.createElement('canvas');
  cv.width = W; cv.height = RH * 8;
  const g = cv.getContext('2d');
  g.fillStyle = PAINT_BG; g.fillRect(0, 0, W, cv.height);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const X = (phi) => ((((0.5 + phi / TAU) % 1) + 1) % 1) * W;
  const at = (phi, fn) => { const x = X(phi); fn(x); if (x < 160 * AS) fn(x + W); if (x > W - 160 * AS) fn(x - W); };
  // mm per pixel across (around the circumference) and along (the band's length) a row
  const vx = (row) => (TAU * (bands[row]?.[1] ?? 37)) / W, vy = (row) => (bands[row]?.[0] ?? 5) / RH;
  const text = (row, phi, str, y, mmH, color, weight = 600, mirror = false) => at(phi, (x) => {
    const size = Math.min(RH * 0.9, mmH / vy(row));
    g.save(); g.translate(x, row * RH + y * RH); g.scale((mirror ? -1 : 1) * (vy(row) / vx(row)), 1);
    g.font = `${weight} ${size}px ${FONT}`; g.fillStyle = color; g.fillText(str, 0, 0); g.restore();
  });
  const tick = (row, phi, y0, y1, wMM, color) => at(phi, (x) => { const w = Math.max(2, wMM / vx(row)); g.fillStyle = color; g.fillRect(x - w / 2, row * RH + y0 * RH, w, (y1 - y0) * RH); });
  const tri = (row, phi, hMM, color, y = 0) => at(phi, (x) => { const h = Math.min(RH * 0.5, hMM / vy(row)), w = (hMM * 0.9) / vx(row); g.fillStyle = color; g.beginPath(); g.moveTo(x - w / 2, row * RH + y * RH); g.lineTo(x + w / 2, row * RH + y * RH); g.lineTo(x, row * RH + y * RH + h); g.closePath(); g.fill(); });
  // an outlined △, apex toward the front, centred at y (the CF EV index: ~3.5 mm, orange, CF 80 side view)
  const triOutline = (row, phi, hMM, color, yc, lineMM) => at(phi, (x) => {
    const h = Math.min(RH * 0.8, hMM / vy(row)), w = (hMM * 1.1) / vx(row), y0 = row * RH + yc * RH;
    g.strokeStyle = color; g.lineWidth = lineMM / vy(row); g.lineJoin = 'miter';
    g.beginPath(); g.moveTo(x, y0 - h / 2); g.lineTo(x + w / 2, y0 + h / 2); g.lineTo(x - w / 2, y0 + h / 2); g.closePath(); g.stroke();
  });
  const k = focusK(lens);
  // row 0 — distance scale on the focusing ring: metres in white (front row), feet in orange (rear row)
  const metres = [Infinity, 100, 50, 30, 20, 15, 12, 10, 8, 7, 6, 5, 4, 3.5, 3, 2.5, 2.2, 2, 1.8, 1.7, 1.6, 1.5, 1.4, 1.3, 1.2, 1.1, 1, 0.9, 0.8, 0.7, 0.65, 0.6, 0.55, 0.5, 0.45, 0.4, 0.35, 0.3];
  const useInches = lens.focalLength === 50;
  const feet = [200, 100, 50, 30, 25, 20, 15, 12, 10, 8, 7, 6.5, 6, 5.5, 5, 4.5, 4, 3.5, 3, 2.5, ...(useInches ? [] : [2, 1.75, 1.5, 1.25, 1])];
  const scale = (list, toM, y, color, mmH, minSepDeg = 8.5) => {
    let last = -1e9;
    list.forEach((d) => {
      const dm = d * toM;
      if (dm < lens.minFocusDistance - 1e-6) return;
      const phi = isFinite(d) ? -k / dm : 0;
      if (Math.abs(phi - last) < minSepDeg * DEG && isFinite(d)) return;
      if (phi < -FOCUS_THROW - 1e-6) return;
      last = phi;
      const s = isFinite(d) ? String(d).replace('.', ',') : '∞';   // (decimal commas, as engraved: 0,9 · 1,1 · 2,5)
      text(0, phi, s, y, isFinite(d) ? mmH : mmH * 1.2, color, 600);
    });
  };
  scale(metres, 1, 0.34, INK.white, 2.3, 8.2);
  scale(feet, 0.3048, 0.76, INK.orange, 1.8, 8.2);
  if (useInches) {
    // CF 50 FLE close-focus inches markings at the near end of the orange feet row (cf50/01, SPEC §3)
    let lastIn = -1e9;
    [[26, '26"'], [24, '24"'], [22, '22"'], [21, '21"'], [20, '20"'], [19.685, '19"']].forEach(([inch, lbl]) => {
      const dm = inch * 0.0254;
      if (dm < lens.minFocusDistance - 1e-3) return;
      const phi = -k / dm;
      if (Math.abs(phi - lastIn) < 7.2 * DEG || phi < -FOCUS_THROW - 1e-4) return;
      lastIn = phi;
      text(0, phi, lbl, 0.76, 1.55, INK.orange, 600);
    });
  }
  text(0, -FOCUS_THROW - 9 * DEG, 'm', 0.34, 2.3, INK.white, 600); text(0, -FOCUS_THROW - 9 * DEG, 'ft', 0.76, 1.8, INK.orange, 600);   // (the units, past the near end)
  // row 1 — fixed ring: depth-of-field pairs from Δ(1/d) = N·c/f² beside the white central index
  //         (rear half, against the distance scale), red IR index, focal length on the right
  tick(1, 0, 0.12, 1.0, 0.5, INK.white);
  let lastPhi = 0;
  lens.apertureStops.slice(1).forEach((N) => {
    const phi = k * dofDelta(lens, N);
    if (phi < 4.5 * DEG || phi > 150 * DEG || phi - lastPhi < 4.2 * DEG) return;
    lastPhi = phi;
    [-1, 1].forEach((sg) => { tick(1, sg * phi, 0.84, 1.0, 0.22, INK.white); text(1, sg * phi, fmtN(N), 0.6, 1.7, INK.white, 600); });
  });
  const irPhi = k * (1 / (400 * lens.focalLength / 1000));        // IR focuses ≈ f/400 further out
  if (irPhi > 2.2 * DEG && irPhi < 30 * DEG) tick(1, irPhi, 0.7, 1.0, 0.25, INK.red);
  // (past the DOF scale on the crank side, as on the CF barrels: a pale-blue "CF", the focal length, then the maker's
  //  name in spaced italic capitals; on the underside at 180°, the two-line country-of-origin mark)
  const nameAt = Math.max(lastPhi, 30 * DEG);
  text(1, nameAt + 9 * DEG, 'CF', 0.42, 2.1, INK.blue, 700);
  text(1, nameAt + 21 * DEG, `${lens.focalLength}mm`, 0.42, 2.1, INK.white, 700);
  text(1, nameAt + 56 * DEG, 'G L A S S   W O R K S', 0.42, 2.3, INK.white, 'italic 600');
  text(1, Math.PI, 'LENS MADE IN', 0.34, 1.18, INK.white, 600);
  text(1, Math.PI, 'WEST GERMANY', 0.72, 1.18, INK.white, 600);
  // row 3 — aperture ring: white f-numbers (larger to the left), red EV index at its front edge
  const stops = apStops(lens);
  lens.apertureStops.forEach((N, i) => text(3, -stops[i] * EV_STEP, fmtN(N).replace('.', ','), 0.52, 2.3, INK.white, 600));
  triOutline(3, EV_INDEX, 3.2, INK.orange, 0.5, 0.32);   // (the orange outline △: the EV index)
  // row 5 — speed ring: white speeds (faster to the right) with B and F beyond 1 s, red marks at
  //         1, ½ and ¼ s; orange EV numerals continue past 1/500 (EV0 = log2(N0²) at the index)
  SHUTTER_SPEEDS.forEach((sp, i) => {
    const phi = i * SH_STEP;
    text(5, phi, sp.label.replace('1/', '').replace('s', ''), 0.5, 2.2, INK.white, 600);
  });
  // (a thin orange-red bar over 1, 2 and 4: hold the release at these slow speeds — CF 80 from above)
  { const i0 = SHUTTER_SPEEDS.findIndex((sp) => sp.t <= 1 + 1e-9), i1 = SHUTTER_SPEEDS.findIndex((sp) => sp.t <= 1 / 4 + 1e-9);
    if (i0 >= 0 && i1 >= i0) for (let a = (i0 - 0.35) * SH_STEP; a <= (i1 + 0.35) * SH_STEP; a += 0.4 * DEG) at(a, (x) => { g.fillStyle = INK.red; g.fillRect(x - 3, 5 * RH + 0.1 * RH, 6, 0.35 / vy(5)); }); }
  text(5, -SH_STEP, 'B', 0.5, 2.2, INK.white, 700);
  text(5, -2 * SH_STEP, 'F', 0.5, 2.2, INK.green, 700);
  const ev0 = 2 * Math.log2(lens.apertureStops[0]);
  for (let ev = Math.ceil(ev0) - 1; ev <= 21; ev++) text(5, EV_INDEX + (ev - ev0) * EV_STEP, String(ev), 0.52, 1.7, INK.orange, 600);
  // row 6 — the engraved annulus inside the filter bore (or front barrel ring on 30/500): readable from the front.
  // As on a CF lens mounted on the camera (CF 80, 150 and 50 front views), letter tops outward, running clockwise:
  // design family + specification upright across the top, T* coating mark in red-orange at ~2 o'clock,
  // 7-digit serial number down the right, and GLASS WORKS round the lower left.
  { const w6 = bands[6]?.[0] ?? 6;
    const radialFace = def?.front !== 'fisheye' && def?.front !== 'long';
    const h6 = radialFace ? Math.min(3.0, Math.max(2.0, w6 * 0.43)) : Math.min(3.5, Math.max(2.4, w6 * 0.52));
    const y6 = radialFace ? 0.58 : 0.5;
    const designName = lensOpticsFor(lens).design;
    const spec = `${designName} ${fmtN(lens.maxAperture).replace('.', ',')}/${lens.focalLength}`;
    const sn = def?.sn || String(7386000 + lens.focalLength * 13 + 71);
    // Crisp concentric machined hairline bezel rules framing the front Carl Zeiss CF optical nameplate
    if (radialFace) {
      g.fillStyle = 'rgba(228,230,238,0.22)';
      g.fillRect(0, 6 * RH + 0.10 * RH, W, 3);
      g.fillRect(0, 6 * RH + 0.90 * RH, W, 3);
    }
    g.save(); g.letterSpacing = `${(0.08 * h6) / vx(6)}px`;
    text(6, 4 * DEG, spec, y6, h6 * 0.92, INK.white, 500, radialFace);
    text(6, -58 * DEG, 'T*', y6, h6 * 0.98, INK.red, 700, radialFace);
    text(6, -122 * DEG, sn, y6, h6 * 0.88, INK.white, 500, radialFace);
    text(6, -232 * DEG, 'GLASS WORKS', y6, h6 * 0.88, INK.white, 500, radialFace);
    g.restore(); }
  // row 7 — floating-element ring (click-stop ranges on CF 40 FLE & CF 50 FLE, cf50/01 & cf50/03) or Makro reproduction ratios
  if (def?.fle) {
    const stepA = 16 * DEG;
    def.fle.forEach(([, t], i) => {
      const phi = i * stepA;
      text(7, phi, t, 0.66, 1.85, INK.white, 600);
    });
  } else if (def?.makro) {
    // magnification at each distance: m ≈ f / (d − f)
    const f = lens.focalLength / 1000;
    [[1 / 20, '1:20'], [1 / 12, '1:12'], [1 / 8, '1:8'], [1 / 6, '1:6'], [1 / 5, '1:5'], [1 / 4.5, '1:4,5']].forEach(([m, t]) => {
      const d = f + f / m;
      if (d < lens.minFocusDistance - 1e-3) return;
      const phi = -k / d;
      text(7, phi, t, 0.52, 1.65, INK.orange, 600); tick(7, phi, 0.0, 0.2, 0.22, INK.orange);
    });
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 16;
  t.wrapS = THREE.RepeatWrapping;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

// ───────── Body ─────────
function bodySections() {
  const secs = [];
  const zs = new Set();
  for (let i = 0; i <= 14; i++) zs.add(+(FRONT + 7.0 * Math.pow(i / 14, 1.5)).toFixed(3));
  [-40, -32, -24, -16, -8, 0, 8, 16, 24, 26.2, 26.55, 26.95, 27.35, 27.7, 31, 34.5, 34.75, 35.05, 35.35, 35.58, 35.7].forEach((z) => zs.add(z));
  const list = [...zs].sort((a, b) => a - b);
  const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k / 4; };
  list.forEach((z) => {
    // (the front edge: a quarter-round of r 3.5 into the side — the real body is a box, not tapered)
    const tF = clamp01((z - FRONT) / 3.5);
    let hw = HW - 3.5 + 3.5 * Math.sqrt(1 - (1 - tF) * (1 - tF));
    let top = smin(TOP, 44.3 + (z - FRONT) * 1.0, 0.9);
    const tb = clamp01((z - FRONT) / 2.5);
    let bot = BOT + 2.5 - 2.5 * Math.sqrt(1 - (1 - tb) * (1 - tb));
    const rr = z - (BACK - 1);
    if (rr > 0) { const d = 1 - Math.sqrt(Math.max(0, 1 - rr * rr)); hw -= d; top -= d; bot += d; }
    secs.push({ z, hw, top, bot, r: 3, wear: z < FRONT + 1.2 ? 0.7 * (1 - (z - FRONT) / 1.2) : 0 });
  });
  return secs;
}

function frontLeatherPolys() {
  // the leatherette's rounded rectangle on the front frame, less the mount ring (cut just outside it): the ring
  // nearly touches the frame all round, so four corner pieces remain (at the top the strip ends where it would thin
  // below 1.5 mm; at the bottom the ring cuts through it)
  const X = HW - 4.9, YT = 42.7, YB = -39.0, R = DIM.mountR + 0.4, rc = 2.2, minT = 1.5;
  const arc = (a0, a1, pts) => { const n = Math.ceil(Math.abs(a1 - a0) / (1.2 * DEG)); for (let i = 0; i <= n; i++) { const a = lerp(a0, a1, i / n); pts.push([R * Math.cos(a), R * Math.sin(a)]); } };
  const ySide = Math.sqrt(R * R - X * X);
  const piece = (Y, sy) => {
    // where the horizontal edge meets the circle (or where the strip gets too thin to keep)
    const reach = Math.abs(Y) - minT;
    const xc = Math.abs(Y) < R ? Math.sqrt(R * R - Y * Y) : Math.sqrt(Math.max(0, R * R - reach * reach));
    const yc = Math.abs(Y) < R ? Y : sy * reach;
    const pts = [];
    if (Math.abs(Y) >= R) pts.push([xc, Y]);
    pts.push([xc, Y === yc ? Y : Y], [X - rc, Y]);
    for (let i = 1; i < 6; i++) { const a = sy * (Math.PI / 2 - (i / 6) * Math.PI / 2); pts.push([X - rc + rc * Math.cos(a), Y - sy * rc + rc * Math.sin(a)]); }
    pts.push([X, sy * ySide]);
    arc(Math.atan2(sy * ySide, X), Math.atan2(yc, xc), pts);
    // (de-duplicate the start: the edge point and the circle point coincide where the circle cuts the edge)
    return pts.filter((p, k) => k === 0 || Math.hypot(p[0] - pts[k - 1][0], p[1] - pts[k - 1][1]) > 1e-3);
  };
  const top = piece(YT, 1), bot = piece(YB, -1);
  const mirror = (p) => p.map(([x, y]) => [-x, y]).reverse();
  return { TR: top, TL: mirror(top), BR: bot, BL: mirror(bot) };   // (the windings as before: the slab sorts them out)
}

function buildBody(lib, hov) {
  const g = new THREE.Group();
  g.name = 'body';
  const kit = new Kit();
  const chrome = lib.get('chrome'), bright = lib.get('chromeBright'), leather = lib.get('leather'), anod = lib.get('anod'), flock = lib.get('flock');
  const satinBlack = lib.get('satinBlack'), paint = lib.get('paint'), rubber = lib.get('rubber');
  // outer chrome skin, open at the top under the finder
  const fz0 = DIM.finder.z - 32.7, fz1 = DIM.finder.z + 32.7, fx = 34.3;
  const secs = bodySections();
  const { geo: skin, loops } = loft(secs, {
    xBreak: fx, nTop: 4, nTop2: 3, nC: 10, nSide: 12, edgeWear: 0.85,
    skip: (a, b, z0, z1) => z0 >= fz0 - 1e-3 && z1 <= fz1 + 1e-3 && Math.abs(a[1] - b[1]) < 1e-4 && a[1] > 45 && Math.abs(a[0]) <= fx + 1e-3 && Math.abs(b[0]) <= fx + 1e-3,
  });
  kit.add(skin, chrome);
  // front plate (behind the leatherette) with the mount opening
  kit.add(capFromLoop(loops[0].pts, [(f) => new THREE.Path().absarc(0, 0, DIM.mountR - 3.0, 0, TAU, true)], true), chrome, T(0, 0, FRONT));   // (under the ring; inside the face: a hole crossing its edge drops out of the triangulation)
  // the rear (KEH, the body without its magazine): black anodised, a raised frame round the 56 mm opening where the
  // auxiliary shutter's two cloth blinds meet; the magazine's two top hooks, its signal slider in a slot on the right;
  // the serial number and the maker engraved below the opening — built lazily when magazine detaches / explodes / cutaway
  const rearFace = new THREE.Group(); rearFace.visible = false; g.add(rearFace);
  const rearLoopPts = loops[loops.length - 1].pts.map((p) => p.slice());
  let rearFaceBuilt = false;
  const ensureRearFace = () => {
    if (rearFaceBuilt) return false;
    rearFaceBuilt = true;
    const rfk = new Kit(), Da = decalAtlas(), inkW = lib.get('inkWhite');
    rfk.add(capFromLoop(rearLoopPts, [(f) => rrPath(-28, -28, 28, 28, 1.5, new THREE.Path())], false), anod, T(0, 0, BACK));
    const gateFrame = rrPath(-37.5, -37.5, 37.5, 37.5, 3.2); gateFrame.holes.push(rrPath(-31.2, -31.2, 31.2, 31.2, 2.0, new THREE.Path()));
    rfk.add(slab(gateFrame, 0.9, 0.3, 12, 0.6), anod, T(0, 0, BACK - 0.35));
    const inner = rrPath(-31.3, -31.3, 31.3, 31.3, 2.0); inner.holes.push(rrPath(-28, -28, 28, 28, 1.5, new THREE.Path()));
    rfk.add(slab(inner, 0.45, 0.15, 12, 0.5), satinBlack, T(0, 0, BACK - 0.3));
    [-1, 1].forEach((sx) => rfk.add(rbox(6.0, 1.8, 1.8, 0.5, 2, 0.8), bright, T(sx * 15.3, 42.3, BACK + 0.9)));
    rfk.add(rbox(2.4, 19.6, 0.4, 0.4, 1), flock, T(41.6, 11.9, BACK + 0.2));
    rfk.add(rbox(1.3, 14, 1.0, 0.4, 1, 0.6), bright, T(41.6, 11.0, BACK + 0.5));
    for (let i = 0; i < 4; i++) rfk.add(rbox(1.2, 0.55, 0.38, 0.1, 1), bright, T(41.6, 7.2 + i * 2.5, BACK + 0.88));
    rfk.add(rbox(0.8, 2.8, 0.3, 0.2, 1), flock, T(41.6, -25.3, BACK + 0.12));
    rfk.add(revolve([[0.42, 0], [0.42, 0.65, 0.5], [0, 0.75]], { segs: 14 }), bright, T(41.6, -25.3, BACK + 0.15));
    rfk.add(decalUV(new THREE.PlaneGeometry(24, 2.4), Da.bodySerial), inkW, T(0, -34.3, BACK + 1.0));
    rfk.add(decalUV(new THREE.PlaneGeometry(34, 2.2), Da.maker), inkW, T(0, -40.5, BACK + 0.02));
    rfk.build(rearFace);
    return true;
  };
  // finder well: short walls down to the screen frame, rails either side
  kit.add(rbox(0.8, 5.4, fz1 - fz0, 0.3), anod, T(-fx - 0.4, TOP - 2.7, DIM.finder.z));
  kit.add(rbox(0.8, 5.4, fz1 - fz0, 0.3), anod, T(fx + 0.4, TOP - 2.7, DIM.finder.z));
  kit.add(rbox(2 * fx, 5.4, 0.8, 0.3), anod, T(0, TOP - 2.7, fz1 + 0.4));
  kit.add(rbox(2 * fx, 3.4, 0.8, 0.3), anod, T(0, TOP - 3.7, fz0 - 0.2));
  [-1, 1].forEach((sx) => kit.add(rbox(3, 1.2, fz1 - fz0 - 2, 0.4, 2, 0.6), bright, T(sx * (fx - 1.5), TOP - 5.2, DIM.finder.z)));
  // screen frame
  const frame = rrPath(-33, -33, 33, 33, 2); frame.holes.push(rrPath(-29.4, -29.4, 29.4, 29.4, 1.2, new THREE.Path()));
  kit.add(slab(frame, 4.4, 0.4), anod, T(0, DIM.screenY - 0.4, DIM.screenZ, Math.PI / 2, 0, 0));
  // leatherette: four corner pieces on the front, both side panels
  const fl = frontLeatherPolys();
  const rel = [[33.6, -35.6, 5.7], [-35.3, -35.2, 5.7]];   // (the releases, Commons 12)
  for (const key of ['TR', 'TL', 'BR', 'BL']) {
    const holes = [];
    let poly = fl[key];
    rel.forEach(([x, y, r]) => { poly = carve(poly, x, y, r, holes); });
    const geo = slab(shapeFrom(poly, holes, true), 0.9, 0.3, 12, 0.9);
    geo.rotateY(Math.PI);
    kit.add(geo, leather, T(0, 0, FRONT + 0.05));
  }
  const cr = DIM.crank;
  // positions measured off the chrome body's side photographs (KEH, Commons 09/10): strap lugs behind the middle at
  // mid-height, the ISO dial in a black plate high toward the rear of the left side, the accessory rail ahead of the
  // lug, the flash connector low at the front; on the right the signal window low at the rear
  const LUG = { zR: 23, yR: 1.5, zL: 18.8, yL: 3.0 }, ISO = { z: 6.1, y: 26.5 }, FC = { z: -27.5, y: -32.7 }, RAIL = { z: -16.4, y: 3.0 };
  const SIDE = { z0: FRONT + 2.6, z1: BACK - 2.0, y0: -40.4, y1: 46.4 };
  [-1, 1].forEach((sx) => {
    // the side's leatherette, edge to edge (shape x = body z for the left panel, −z for the right)
    const poly = rrPoly(SIDE.z0, SIDE.y0, SIDE.z1, SIDE.y1, 2.4, 1.5);
    const geo = slab(shapeFrom(poly.map(([z, y]) => [sx > 0 ? -z : z, y])), 0.9, 0.3, 12, 0.9);
    geo.rotateY(sx * Math.PI / 2);
    kit.add(geo, leather, T(sx * (HW - 0.1), 0, 0));
  });
  // the right side's raised plate (the winding mechanism's cover): leatherette on a polished edge — along the top,
  // round the front of the crank disc, back under it, then down to the bottom, so the signal window sits in its tail
  {
    const Ra = cr.r + 1.2, zc = cr.z, yc = cr.y, zv = 22, rv = 5;
    const outline = (d) => {
      const pts = [], R = Ra + d, yT = yc + R, yB = yc - R;
      pts.push([SIDE.z1 + d, yT]);
      for (let i = 0; i <= 36; i++) { const a = Math.PI / 2 + (i / 36) * Math.PI; pts.push([zc + R * Math.cos(a), yc + R * Math.sin(a)]); }
      // (the concave corner where the lower edge turns down: a fillet centred outside the plate, r shrinking as it grows)
      const cz = zv - rv, cy = yc - Ra - rv, rf = rv - d;
      for (let i = 0; i <= 8; i++) { const a = Math.PI / 2 - (i / 8) * Math.PI / 2; pts.push([cz + rf * Math.cos(a), cy + rf * Math.sin(a)]); }
      pts.push([zv - d, SIDE.y0 - d], [SIDE.z1 + d, SIDE.y0 - d]);
      return pts;
    };
    const shp = (d) => shapeFrom(outline(d).map(([z, y]) => [-z, y]));
    const chromeEdge = slab(shp(0.9), 1.5, 0.55, 12, 0.6); chromeEdge.rotateY(Math.PI / 2);
    kit.add(chromeEdge, bright, T(HW + 0.05, 0, 0));
    const face = slab(shp(0), 0.9, 0.3, 12, 0.9); face.rotateY(Math.PI / 2);
    kit.add(face, leather, T(HW + 0.75, 0, 0));
  }
  // the top: leatherette round the finder (front and side margins — the finder runs to the seam at the rear) and
  // over the front chamfer; on the chamfer the maker's nameplate (a black plate in a polished rim, raised chrome
  // letters), on the top margins the model plates (black lozenges, silver letters) a third of the way back
  const D = decalAtlas();
  {
    const X = HW - 3.6, Z0 = FRONT + 5.2, Zr = BACK - 1.6, xi = DIM.finder.w / 2 - 0.6, zi = DIM.finder.z - DIM.finder.d / 2 + 0.6, rc = 2.0;
    const U = new THREE.Shape();
    U.moveTo(-X, -Zr); U.lineTo(-X, -(Z0 + rc)); U.absarc(-X + rc, -(Z0 + rc), rc, Math.PI, Math.PI / 2, true);
    U.lineTo(X - rc, -Z0); U.absarc(X - rc, -(Z0 + rc), rc, Math.PI / 2, 0, true); U.lineTo(X, -Zr);
    U.lineTo(xi, -Zr); U.lineTo(xi, -zi); U.lineTo(-xi, -zi); U.lineTo(-xi, -Zr); U.lineTo(-X, -Zr);
    const top = slab(U, 0.8, 0.3, 8, 0.9); top.rotateX(-Math.PI / 2);
    kit.add(top, leather, T(0, TOP - 0.05, 0));
    // the chamfer: 45° from the front face's top (y 44.3) back to the top (y 49)
    // (a frame on the chamfer: x across reading from the front, y up the slope, z its outward normal)
    const cham = T(0, 44.3 + 2.35, FRONT + 2.35, -Math.PI / 4, Math.PI, 0, 1, 'YXZ');
    kit.add(slab(rrPath(-X, -2.95, X, 2.95, 0.8), 0.7, 0.25, 8, 0.9), leather, cham.clone().multiply(T(0, 0, -0.15)));
    // (the nameplate, Commons 12: 41.5 across, 4.4 up the slope, its raised letters filling most of its height)
    kit.add(slab(rrPath(-21.3, -2.55, 21.3, 2.55, 1.6), 0.55, 0.25, 12, 0.6), bright, cham.clone().multiply(T(0, 0, 0.4)));
    kit.add(slab(rrPath(-20.75, -2.2, 20.75, 2.2, 1.3), 0.6, 0.2, 12, 0.6), satinBlack, cham.clone().multiply(T(0, 0, 0.5)));
    kit.add(decalUV(new THREE.PlaneGeometry(39.5, 3.6), D.chamfer), lib.get('inkChrome', { clip: true }), cham.clone().multiply(T(0, 0, 1.12)));
    // the model plates, reading from either side
    [-1, 1].forEach((sx) => {
      const at = T(sx * (HW - 5.5), TOP + 0.75, FRONT + 4.7 + 27.5, -Math.PI / 2, 0, sx > 0 ? Math.PI / 2 : -Math.PI / 2);
      kit.add(slab(rrPath(-9.2, -1.35, 9.2, 1.35, 1.35), 0.35, 0.15, 12, 0.6), satinBlack, at);
      const p = decalUV(new THREE.PlaneGeometry(14.5, 2.3), D.plate);
      kit.add(p, lib.get('inkChrome', { clip: true }), at.clone().multiply(T(0, 0, 0.37)));
    });
  }
  // bayonet mount (Commons 12): a satin-turned ring, 3.5 wide on its face (R 37.7 → 41.9), black inside it, red index
  const F = FRONT, MR = DIM.mountR;
  kit.add(revolve([[37.4, F + 0.6, 0], [37.4, F - 1.15, 0.4], [37.75, F - 1.5, 0.8], [41.25, F - 1.5, 1], [41.7, F - 1.15, 0.8], [41.85, F - 0.45, 0.4], [42.0, F + 0.1, 0]], { segs: 180, crease: 50 }), lib.get('turned'));
  kit.add(revolve([[35.2, F + 1.9, 0], [35.2, F - 0.6, 0.4], [35.6, F - 1.3, 0.9], [37.45, F - 1.3, 0], [37.45, F + 0.6, 0]], { segs: 120, crease: 30 }), satinBlack);
  // the throat (Commons 12): past the bayonet a dark wall closes it, the mirror box's rounded opening in it (48 square,
  // from 24.3 below the axis to 23.8 above); a groove behind the bayonet lugs takes the lens's lugs
  {
    const prof = [[35.2, F + 1.9], [36.4, F + 2.2], [36.4, F + 7.0], [33.8, F + 7.6], [33.8, F + 10.6]];
    kit.add(revolve(prof, { segs: 96 }), anod); kit.add(revolve(prof.slice().reverse(), { segs: 96 }), anod);
    const wall = new THREE.Shape().absarc(0, 0, 33.9, 0, TAU, false);
    wall.holes.push(rrPath(-24, -24.3, 24, 23.8, 3.5, new THREE.Path()));
    kit.add(new THREE.ShapeGeometry(wall, 64), anod, T(0, 0, F + 10.6, 0, Math.PI, 0));
  }
  // the body's coupling shaft at the bottom of the throat, where the lens's coupling key engages it: a satin slotted
  // steel disc in a recessed bore on a black bridge, flanked by a 3D red enamel dot & silver stop pins (503cx-12, KEH k02)
  {
    const cz = F + 10.0, cy = -27.2;   // (just behind the lens's coupling key: flange + 11; below the opening, Commons 12)
    kit.add(rbox(27, 6.4, 2.0, 0.6, 1), satinBlack, T(0, cy, cz + 1.0));
    kit.add(rbox(10, 13.2, 2.0, 0.6, 1), satinBlack, T(0, cy - 7.2, cz + 1.0));
    kit.add(revolve([[3.4, -0.1, 0], [3.4, 0.2, 0.3], [3.15, 0.2, 0]], { segs: 40 }), flock, T(0, cy, cz, 0, Math.PI, 0));
    kit.add(revolve([[3.1, -0.6, 0], [3.1, 0.12, 0.4], [2.75, 0.48, 0.6], [0, 0.52, 0]], { segs: 48 }), lib.get('turned'), T(0, cy, cz, 0, Math.PI, 0));
    kit.add(rbox(5.9, 0.82, 0.55, 0.1, 1), flock, T(0, cy, cz - 0.32, 0, 0, 0.6));
    kit.add(revolve([[0.65, 0], [0.65, 0.25, 0.4], [0, 0.28]], { segs: 16 }), lib.get('steel'), T(0, cy, cz - 0.26, 0, Math.PI, 0));
    // 3D red enamel index dot + flanking turned steel stop/rivet pins (Commons 12, KEH k02)
    kit.add(revolve([[0.76, 0], [0.76, 0.22, 0.5], [0, 0.3]], { segs: 20 }), lib.get('red'), T(-4.7, cy, cz - 0.02, 0, Math.PI, 0));
    kit.add(revolve([[0.52, -0.1], [0.52, 0.48, 0.5], [0.36, 0.65, 0.6], [0, 0.7]], { segs: 16 }), lib.get('steel'), T(-6.8, cy, cz - 0.02, 0, Math.PI, 0));
    kit.add(revolve([[0.48, -0.1], [0.48, 0.38, 0.5], [0, 0.48]], { segs: 16 }), lib.get('steel'), T(5.4, cy, cz - 0.02, 0, Math.PI, 0));
    kit.add(new THREE.CircleGeometry(0.55, 16), flock, T(-9.6, cy, cz - 0.02, 0, Math.PI, 0));
  }
  kit.add(revolve([[32.2, 0], [35.2, 0]], { segs: 96 }), satinBlack, T(0, 0, F + 1.9, 0, Math.PI, 0));
  for (let i = 0; i < 3; i++) {
    const lug = revolve([[32.0, F + 2.3, 0.5], [35.3, F + 2.3, 0.5], [35.3, F + 4.3, 0.3], [32.0, F + 4.3, 0.5], [32.0, F + 2.3, 0.5]], { segs: 16, phi0: (i * 120 - 38) * DEG, phiLen: 76 * DEG, crease: 30 });
    kit.add(lug, satinBlack);
  }
  // (the lens index: a red boss at 12 o'clock on the throat wall just below the top bayonet flange, Commons 12 & KEH k02)
  kit.add(revolve([[1.15, 0], [1.15, 0.25, 0.5], [0, 0.35]], { segs: 20 }), lib.get('red'), T(0, 29.8, F + 10.55, 0, Math.PI, 0));
  // mirror-box lining (Palpas micro-crinkle anti-reflection elastomer), open to the screen well and the gate
  const liner = new Kit();
  const palpas = lib.get('palpas');
  const box = { x: 40, y0: -38, y1: 38.2, z0: FRONT + 1.5, z1: 34.2 };
  liner.add(new THREE.PlaneGeometry(box.z1 - box.z0, box.y1 - box.y0), palpas, T(-box.x, (box.y0 + box.y1) / 2, (box.z0 + box.z1) / 2, 0, Math.PI / 2, 0));
  liner.add(new THREE.PlaneGeometry(box.z1 - box.z0, box.y1 - box.y0), palpas, T(box.x, (box.y0 + box.y1) / 2, (box.z0 + box.z1) / 2, 0, -Math.PI / 2, 0));
  liner.add(new THREE.PlaneGeometry(2 * box.x, box.z1 - box.z0), palpas, T(0, box.y0, (box.z0 + box.z1) / 2, -Math.PI / 2, 0, 0));
  const ceil = rrPath(-box.x, box.z0, box.x, box.z1, 0.1); ceil.holes.push(rrPath(-30, DIM.screenZ - 30, 30, DIM.screenZ + 30, 1, new THREE.Path()));
  liner.add(new THREE.ShapeGeometry(ceil, 4), palpas, T(0, box.y1, 0, Math.PI / 2, 0, 0));
  const fw = rrPath(-box.x, box.y0, box.x, box.y1, 0.1); fw.holes.push(new THREE.Path().absarc(0, 0, 33.2, 0, TAU, true));
  liner.add(new THREE.ShapeGeometry(fw, 48), palpas, T(0, 0, box.z0));
  const rw = rrPath(-box.x, box.y0, box.x, box.y1, 0.1); rw.holes.push(rrPath(-30.5, -30.5, 30.5, 30.5, 2, new THREE.Path()));
  liner.add(new THREE.ShapeGeometry(rw, 8), palpas, T(0, 0, box.z1, 0, Math.PI, 0));
  liner.add(revolve([[33.2, FRONT + 1.4], [33.2, FRONT + 1.9]], { segs: 64 }), palpas);
  // light baffle ribs on the floor + front mirror-rest damper cradle & camera-left catch tab (503cx-12, KEH k02/k06)
  for (let i = 0; i < 5; i++) liner.add(rbox(76, 1.4, 0.9, 0.25, 1), palpas, T(0, box.y0 + 0.7, -24 + i * 11));
  const innerFloor = new THREE.Group(); g.add(innerFloor);
  {
    const ifk = new Kit();
    ifk.add(rbox(54, 1.8, 3.6, 0.5, 1), anod, T(0, box.y0 + 0.9, -18.2));
    [-21, 21].forEach((xx) => ifk.add(rbox(6.4, 2.4, 4.4, 0.5, 1), rubber, T(xx, box.y0 + 1.6, -18.2)));
    ifk.add(rbox(0.5, 9.2, 2.8, 0.2, 1), flock, T(-box.x + 0.2, -10.5, -14.5));
    ifk.add(rbox(1.6, 4.4, 1.8, 0.3, 1), lib.get('steel'), T(-box.x + 0.7, -10.5, -14.5));
    ifk.build(innerFloor);
  }
  const [linerMesh] = liner.build(g);
  // shutter release (front, lower right): its chrome locking collar, Ø11, with a tongue up and a little out to a
  // recessed red enamel dot, the Time-exposure ("T" / "O") lock lever (Commons 11/12, KEH k02/k06)
  kit.add(revolve([[3.3, -4.4, 0.5], [4.6, -4.4, 1], [5.1, -3.9, 1], [5.1, -1.2, 0.4], [5.4, -0.4, 0.1], [5.5, 0, 0]], { segs: 48 }), bright, T(33.6, -35.6, FRONT - 0.05));
  { const a = Math.atan2(1.9, 7.5);
    kit.add(slab(rrPath(-1.35, 3.6, 1.35, 9.1, 1.35), 0.75, 0.28, 10, 0.6), bright, T(33.6, -35.6, FRONT - 1.55, 0, 0, -a));
    kit.add(revolve([[0.86, 0], [0.86, 0.16, 0.3], [0.74, 0.16]], { segs: 20 }), satinBlack, T(33.6 + 7.7 * Math.sin(a), -35.6 + 7.7 * Math.cos(a), FRONT - 1.58, 0, Math.PI, 0));
    kit.add(revolve([[0.72, 0], [0.72, 0.22, 0.5], [0, 0.28]], { segs: 20 }), lib.get('red'), T(33.6 + 7.7 * Math.sin(a), -35.6 + 7.7 * Math.cos(a), FRONT - 1.56, 0, Math.PI, 0)); }
  // lens release (front, lower left): stepped chrome collar, fine axial knurled barrel (segs = 8*44 = 352!), and concentric turned face grooves
  kit.add(revolve([[0, -3.6, 0.2], [1.4, -3.55, 0.3], [1.6, -3.62, 0.4], [2.6, -3.55, 0.3], [2.8, -3.62, 0.4], [3.2, -3.6, 0.6], [3.75, -3.1, 1, 1], [3.85, -1.3, 0.5, 1], [4.9, -0.4, 0.2], [5.4, 0, 0]], { segs: 352, crease: 30, ribs: { n: 44, depth: 0.11, groove: 0.48 } }), bright, T(-35.3, -35.2, FRONT - 0.05));
  // right side: pre-release, winding index, status window, strap lug (the crank itself is built below)
  const PL = HW + 1.65;   // the raised plate's face
  // the pre-release: a small black ribbed lever hanging below the plate's lower edge, under the crank, with 3 silver-highlighted grip ridges (KEH k05)
  const preRelease = new THREE.Group();
  {
    const pk = new Kit(), yPR = cr.y - cr.r - 1.2 - 4.6;
    pk.add(rbox(1.6, 3.0, 9, 0.6, 2, 0.8), satinBlack, T(HW + 1.0, yPR + 1.4, 1.7));
    pk.add(rbox(3.0, 5.0, 8.4, 0.8, 2, 1), satinBlack, T(HW + 2.2, yPR - 1.6, 1.7, 0, 0, -0.08));
    for (let k = 0; k < 3; k++) {
      const yy = yPR - 3.2 + k * 1.35;
      pk.add(rbox(0.55, 0.68, 7.6, 0.2, 1, 1), satinBlack, T(HW + 3.75, yy, 1.7));
      pk.add(rbox(0.18, 0.42, 7.3, 0.08, 1, 0.8), lib.get('steel'), T(HW + 4.02, yy, 1.7));
    }
    pk.build(preRelease);
  }
  g.add(preRelease);
  // winding index: a red dot on the plate where its top edge meets the arc round the disc
  kit.add(revolve([[0, 0], [0.75, 0]], { segs: 12 }), lib.get('red'), T(PL + 0.05, cr.y + cr.r + 1.4, cr.z + 1.0, 0, Math.PI / 2, 0));
  // camera status indicator: a small round window in a turned bezel, low in the plate's tail (white wound, red fired)
  const ST = { y: -29.6, z: 29.5 };   // (Commons 503cx-09, overlaid)
  kit.add(revolve([[2.9, -0.2, 0], [2.9, 0.45, 0.5], [2.6, 0.8, 0.8], [2.1, 0.85, 0.5], [1.95, 0.6, 0]], { segs: 40 }), bright, T(PL, ST.y, ST.z, 0, Math.PI / 2, 0));
  const status = new THREE.Mesh(prep(new THREE.CircleGeometry(1.95, 32)), lib.prepare(new THREE.MeshStandardMaterial({ color: 0xf2f2ec, roughness: 0.5 }), { clip: true }));
  status.position.set(PL + 0.45, ST.y, ST.z); status.rotation.y = Math.PI / 2;
  g.add(status);
  kit.add(new THREE.CircleGeometry(2.0, 32), lib.get('windowGlass'), T(PL + 0.6, ST.y, ST.z, 0, Math.PI / 2, 0));
  // strap buttons: a polished dome on a short neck (the strap's clip locks under the dome)
  const lug = (sx, x0, y, z) => kit.add(revolve([[5.4, -0.2, 0], [5.4, 0.4, 0.5], [5.0, 0.9, 0.8], [2.6, 1.1, 0.3], [2.3, 1.5], [2.3, 2.5], [4.6, 2.8, 0.4], [5.3, 3.5, 0.9], [5.1, 4.6, 1], [3.8, 5.6, 0.8], [0, 5.9, 0.3]], { segs: 48, crease: 34 }), bright, T(sx * x0, y, z, 0, sx * Math.PI / 2, 0));
  lug(1, PL - 0.2, LUG.yR, LUG.zR); lug(-1, HW + 0.6, LUG.yL, LUG.zL);
  // left side: the TTL flash's ISO dial in a black plate printed with its scale, high toward the rear
  const dial = {};
  {
    // (after the Commons 503CX, close up: the plate 35 mm wide, square across the top and round at the bottom about
    //  the dial; the dial's knob a 26.6 mm black ring with six U-shaped finger notches (none at the top, where the
    //  index sits under the printed "•"), a leatherette-inlaid hub with turned rings, and an 8.4 mm dark-brass slotted screw)
    const y1 = SIDE.y1 - 0.2, PR = 17.2, cy = y1 - 17.8, zc = ISO.z;
    const dArch = (i) => {
      const r = PR - i, topY = y1 - i, rc = Math.max(0.6, 2.6 - i * 0.6), s = new THREE.Shape();
      s.moveTo(zc - r, cy); s.lineTo(zc - r, topY - rc); s.absarc(zc - r + rc, topY - rc, rc, Math.PI, Math.PI / 2, true);
      s.lineTo(zc + r - rc, topY); s.absarc(zc + r - rc, topY - rc, rc, Math.PI / 2, 0, true);
      s.lineTo(zc + r, cy); s.absarc(zc, cy, r, 0, -Math.PI, true);
      return s;
    };
    const ps = dArch(0);
    const plate = slab(ps, 0.7, 0.25, 24, 0.6); plate.rotateY(-Math.PI / 2);
    kit.add(plate, satinBlack, T(-HW - 0.75, 0, 0));
    const rimS = dArch(0); rimS.holes.push(dArch(0.85));
    const rimG = slab(rimS, 0.32, 0.12, 24, 0.7); rimG.rotateY(-Math.PI / 2);
    kit.add(rimG, satinBlack, T(-HW - 1.38, 0, 0));
    // the printing: the flash bolt and "ISO" fixed; between them the scale, which turns with the knob, showing the
    // speeds either side of the setting against a fixed index (manual p. 26). Drawn by setDial(iso).
    dial.cv = document.createElement('canvas'); dial.cv.width = 1024; dial.cv.height = 340;
    dial.tex = new THREE.CanvasTexture(dial.cv); dial.tex.colorSpace = THREE.SRGBColorSpace; dial.tex.anisotropy = 8;
    const print = new THREE.Mesh(prep(new THREE.PlaneGeometry(34, 11.3)), lib.prepare(new THREE.MeshStandardMaterial({ map: dial.tex, roughness: 0.5, alphaTest: 0.4, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), { clip: true }));
    print.position.set(-HW - 1.48, y1 - 6.2, zc); print.rotation.y = -Math.PI / 2;
    g.add(print);
    dial.geom = { y1, cy, top: y1 - 0.55 };
    // the knob: a ring, its outline notched six times (centres every 60°, from 30° off the top)
    const ko = new THREE.Shape(), RO = 13.3, RN = 10.2, W = 0.145, N = 360;
    for (let i = 0; i <= N; i++) {
      const b = (i / N) * TAU; let dmin = 9;
      for (let k = 0; k < 6; k++) { const c = (30 + 60 * k) * Math.PI / 180; dmin = Math.min(dmin, Math.abs(Math.atan2(Math.sin(b - c), Math.cos(b - c)))); }
      const r = dmin < W ? (dmin < W * 0.52 ? RN : RN + (RO - RN) * ((dmin - W * 0.52) / (W * 0.48)) ** 2.4) : RO;
      const z = zc + r * Math.sin(b), y = cy + r * Math.cos(b);
      i ? ko.lineTo(z, y) : ko.moveTo(z, y);
    }
    ko.holes.push(new THREE.Path().absarc(zc, cy, 9.1, 0, TAU, true));
    // (the knob turns: built about its own axis, in a group at the dial's centre)
    const knob = slab(ko, 2.35, 0.45, 12, 0.65); knob.translate(-zc, -cy, 0); knob.rotateY(-Math.PI / 2);
    const dk2 = new Kit(); dk2.add(knob, satinBlack);
    dial.knob = new THREE.Group(); dial.knob.position.set(-HW - 1.4, cy, zc); dk2.build(dial.knob); g.add(dial.knob);
    const KD = T(-HW - 1.4, cy, zc, 0, -Math.PI / 2, 0);
    kit.add(revolve([[9.1, 0.0, 0], [9.1, 1.5, 0], [8.5, 1.85, 0.4], [8.1, 1.85, 0.3], [7.9, 1.55, 0], [4.55, 1.55, 0], [4.4, 1.9, 0.4], [4.25, 1.6, 0]], { segs: 96 }), satinBlack, KD);
    // Pebbled leatherette inlay ring inside the ISO dial hub (503cx-10, KEH k03)
    { const hubInlay = new THREE.RingGeometry(4.55, 7.95, 64); boxUV(hubInlay); kit.add(hubInlay, leather, KD.clone().multiply(T(0, 0, 1.62))); }
    // Center slotted dark-brass/gunmetal retention screw with machined slot
    kit.add(revolve([[4.25, 1.6, 0], [4.2, 2.1, 0.5], [3.8, 2.32, 0.4], [0, 2.38, 0]], { segs: 48 }), lib.get('brass'), KD);
    kit.add(rbox(0.55, 7.6, 0.8, 0.15, 1, 1), flock, T(-HW - 1.4 - 2.25, cy, zc, -0.7, 0, 0));
  }
  // accessory rail: a long slot in a polished rounded frame, ahead of the lug
  {
    // (KEH's left side: a thin polished frame, square-ended with small corners, leatherette inside it)
    const fr = rrPath(-19.1, -4.45, 19.1, 4.45, 1.6); fr.holes.push(rrPath(-18.2, -3.55, 18.2, 3.55, 0.9, new THREE.Path()));
    const fg = slab(fr, 1.1, 0.3, 16, 0.6); fg.rotateY(-Math.PI / 2);
    kit.add(fg, bright, T(-HW - 0.7, RAIL.y, RAIL.z));
    kit.add(rbox(0.6, 7.3, 36.6, 0.3, 1), leather, T(-HW - 0.75, RAIL.y, RAIL.z));
  }
  // dedicated (SCA / TTL) 6-pin DIN flash connector: polished outer shell, inner shield sleeve with top keyway, and 5 arc pins + 1 centre pin (503cx-10, KEH k03)
  kit.add(revolve([[4.8, -0.2, 0], [4.8, 0.65, 0.5], [4.35, 1.15, 0.8], [3.25, 1.3, 0.5], [3.0, 0.6, 0]], { segs: 64 }), bright, T(-HW - 0.7, FC.y, FC.z, 0, -Math.PI / 2, 0));
  kit.add(revolve([[2.65, 0.5], [2.65, 1.12, 0.4], [2.42, 1.12, 0.3], [2.42, 0.5]], { segs: 48 }), lib.get('steel'), T(-HW - 0.7, FC.y, FC.z, 0, -Math.PI / 2, 0));
  kit.add(new THREE.CircleGeometry(2.95, 32), flock, T(-HW - 1.32, FC.y, FC.z, 0, -Math.PI / 2, 0));
  kit.add(rbox(0.6, 0.95, 0.75, 0.15, 1), flock, T(-HW - 1.62, FC.y + 2.35, FC.z));
  for (let k = -2; k <= 2; k++) {
    const a = (k * 60) * DEG, py = -1.55 * Math.cos(a), pz = 1.55 * Math.sin(a);
    kit.add(revolve([[0.28, 0], [0.28, 0.82, 0.5], [0, 0.88]], { segs: 12 }), lib.get('brass'), T(-HW - 1.32, FC.y + py, FC.z + pz, 0, -Math.PI / 2, 0));
  }
  kit.add(revolve([[0.28, 0], [0.28, 0.82, 0.5], [0, 0.88]], { segs: 12 }), lib.get('brass'), T(-HW - 1.32, FC.y, FC.z, 0, -Math.PI / 2, 0));
  // the bottom (Commons 13, 12-oncam-bottom): leatherette inside a thin chrome rim; the quick-coupling plate — a U-shaped
  // brushed metal perimeter rail (chamfered front corners, open at rear) standing proud of a recessed black anodized
  // centre plate with two longitudinal polished runner strips, stepped 3/8" tripod socket with two spanner notches, four
  // countersunk black slotted screws; and at the rear the magazine's T-bracket with two upturned support hooks
  const under = (y, z = 0) => T(0, y, z, Math.PI / 2, 0, 0);
  kit.add(slab(rrPath(-(HW - 3.2), FRONT + 3.0, HW - 3.2, BACK - 2.2, 2.0), 0.85, 0.3, 12, 0.9), leather, under(BOT + 0.05));
  const FP = DIM.footPlate, pz0 = FRONT + FP.z0, pz1 = pz0 + FP.l;
  const plateShape = (i) => {
    const w = FP.w / 2 - i, z0 = pz0 + i, z1 = pz1 - i, c = 3.2 - i * 0.4, r = 2.2 - i * 0.5;
    const s = new THREE.Shape();
    s.moveTo(-w + c, z0); s.lineTo(w - c, z0); s.lineTo(w, z0 + c); s.lineTo(w, z1 - r); s.quadraticCurveTo(w, z1, w - r, z1);
    s.lineTo(-w + r, z1); s.quadraticCurveTo(-w, z1, -w, z1 - r); s.lineTo(-w, z0 + c); s.closePath();
    return s;
  };
  const alu = lib.get('alu');
  // Recessed black anodized center plate + raised U-shaped brushed metal perimeter rail (open at the rear)
  kit.add(slab(plateShape(0.3), DIM.foot - 0.35, 0.35, 12, 0.6), anod, under(BOT + 0.25));
  {
    const wO = FP.w / 2, wI = wO - 2.35, z0O = pz0, z0I = pz0 + 2.35, z1O = pz1, cO = 3.2, cI = 2.2;
    const uRail = new THREE.Shape();
    uRail.moveTo(-wO + cO, z0O); uRail.lineTo(wO - cO, z0O); uRail.lineTo(wO, z0O + cO);
    uRail.lineTo(wO, z1O); uRail.lineTo(wI, z1O); uRail.lineTo(wI, z0I + cI);
    uRail.lineTo(wI - cI, z0I); uRail.lineTo(-wI + cI, z0I); uRail.lineTo(-wI, z0I + cI);
    uRail.lineTo(-wI, z1O); uRail.lineTo(-wO, z1O); uRail.lineTo(-wO, z0O + cO); uRail.closePath();
    kit.add(slab(uRail, DIM.foot + 0.35, 0.45, 12, 0.85), alu, under(BOT + 0.25));
  }
  [-9.3, 9.3].forEach((x) => kit.add(slab(rrPath(x - 0.8, pz0 + 10.0, x + 0.8, pz0 + 55.0, 0.78), 0.28, 0.08, 6), alu, under(BOT - DIM.foot + 0.55)));
  // the socket: a polished bushing round a 3/8" thread with two opposing spanner slots & internal thread rings (Commons 13)
  kit.add(revolve([[4.6, -0.2, 0], [4.6, 0.55, 0.6], [4.1, 0.8, 0.5], [3.3, 0.8, 0.3], [3.1, 0.35, 0, 1], [3.1, -2.5, 0, 1], [0, -2.5]], { segs: 48 }), bright, T(0, BOT - DIM.foot + 0.45, DIM.footZ, Math.PI / 2, 0, 0));
  [-3.85, 3.85].forEach((sx) => kit.add(rbox(1.5, 0.35, 0.9, 0.08, 1), flock, T(sx, BOT - DIM.foot - 0.25, DIM.footZ)));
  kit.add(new THREE.CircleGeometry(3.1, 32), flock, T(0, BOT - DIM.foot + 2.2, DIM.footZ, Math.PI / 2, 0, 0));
  const scr = new Kit();
  [[-12.2, 10.5], [12.2, 10.5], [-12.2, 58.5], [12.2, 58.5]].forEach(([x, z], i) => {
    kit.add(revolve([[1.65, 0], [2.1, 0]], { segs: 24 }), flock, T(x, BOT - DIM.foot + 0.58, pz0 + z, Math.PI / 2, 0, 0));
    addScrew(kit, satinBlack, scr, flock, T(x, BOT - DIM.foot + 0.56, pz0 + z, Math.PI / 2, 0, 0), 1.65, false, i * 0.9 + 0.3);
  });
  // hinge bracket: 66 across, meeting the rear of the quick-coupling foot, with two outer magazine-catch hooks curling up over the seam
  {
    const bz0 = pz1 - 0.5, bz1 = BACK + 2.8, bzMid = BACK - 0.2;
    const bs = new THREE.Shape(), w = 33, n = 23.8;
    bs.moveTo(-w, bz0); bs.lineTo(w, bz0); bs.lineTo(w, bz1); bs.lineTo(n, bz1); bs.lineTo(n, bzMid); bs.lineTo(-n, bzMid); bs.lineTo(-n, bz1); bs.lineTo(-w, bz1); bs.closePath();
    kit.add(slab(bs, 1.6, 0.35, 8, 0.7), alu, under(BOT - 0.4));
    [[-28.5, 0], [28.5, 0]].forEach(([x]) => {
      kit.add(revolve([[1.4, -0.1, 0.3], [1.4, 0.25, 0.5], [0, 0.35]], { segs: 20 }), alu, T(x, BOT - 2.0, bz0 + 5.2, Math.PI / 2, 0, 0));
      // Upturned rear magazine-support hook ear (Commons 13, 12-oncam-bottom)
      kit.add(rbox(5.6, 2.4, 1.4, 0.45, 2, 0.8), alu, T(x, BOT - 0.4, bz1 + 0.3));
    });
    [[-11.5, 0], [10.5, 0]].forEach(([x], i) => addScrew(kit, bright, scr, flock, T(x, BOT - 2.02, bz0 + 5.2, Math.PI / 2, 0, 0), 1.65, false, 0.8 + i * 0.6));
  }
  scr.build(g);
  kit.build(g);
  // cutaway sections of the shell, front plate, mount ring, rear frame and foot
  {
    const topAt = (z) => secs.reduce((best, sc) => (Math.abs(sc.z - z) < Math.abs(best.z - z) ? sc : best)).top;
    const topPts = secs.filter((sc) => sc.z <= fz0 + 1e-3).map((sc) => [sc.z, sc.top]);
    const botPts = secs.map((sc) => [sc.z, sc.bot]);
    const rearTop = secs.filter((sc) => sc.z >= fz1 - 1e-3).map((sc) => [sc.z, sc.top]);
    const band = (pts, d) => [...pts, ...offsetLine(pts, d).reverse()];
    const polys = [
      band(topPts, -2.2), band(botPts.slice().reverse(), -2.2), band(rearTop, -2.2),
      [[FRONT, 38.4], [FRONT, topPts[0][1]], [FRONT + 2.2, topPts[0][1] - 0.2], [FRONT + 2.2, 38.4]],
      [[FRONT, -38.4], [FRONT + 2.2, -38.4], [FRONT + 2.2, botPts[0][1] + 1.4], [FRONT, botPts[0][1]]],
      [[BACK - 3.2, 31], [BACK - 3.2, topAt(BACK) - 1.5], [BACK, topAt(BACK) - 0.6], [BACK, 31]],
      [[BACK - 3.2, -31], [BACK, -31], [BACK, BOT + 0.8], [BACK - 3.2, BOT + 1.5]],
      [[FRONT + DIM.footPlate.z0, BOT - DIM.foot], [FRONT + DIM.footPlate.z0 + DIM.footPlate.l, BOT - DIM.foot], [FRONT + DIM.footPlate.z0 + DIM.footPlate.l, BOT], [FRONT + DIM.footPlate.z0, BOT]],
    ];
    const ring = [...MOUNT_PROFILE.map(([r, z]) => [r, FRONT + z]), [35.2, FRONT + 1.9]];
    polys.push(ring.map(([r, z]) => [z, r]), ring.map(([r, z]) => [z, -r]).reverse());   // (the mount ring's section)
    g.userData.sectionPolys = polys;
  }

  // ─ moving parts ─
  // shutter release button (pickable): stepped chrome plunger with a fine axial knurled mid-band & recessed threaded brass cable socket
  const release = new THREE.Group(); release.position.set(33.6, -35.6, FRONT - 0.05);
  const rk = new Kit(), relMat = lib.get('chromeBright', { hover: hov.release });
  rk.add(revolve([[1.5, -5.4, 0], [1.5, -7.45, 0.3], [2.65, -7.45, 0.9], [3.1, -6.95, 1], [3.1, -6.2, 0.6], [3.15, -6.1, 0.5, 1], [3.15, -4.3, 0.5, 1], [3.1, -4.2, 0.4], [3.1, -3.6, 0.3]], { segs: 384, crease: 30, ribs: { n: 48, depth: 0.12, groove: 0.48 } }), relMat);
  // (the cable-release socket in its end: brass, with concentric internal female thread rings & dark bore floor)
  rk.add(revolve([[1.5, -7.4, 0], [1.42, -7.1, 0.4], [1.28, -6.85, 0.4], [1.4, -6.6, 0.4], [1.25, -6.35, 0.4], [1.38, -6.1, 0.4], [1.22, -5.85, 0.4], [1.0, -5.5, 0]], { segs: 36, crease: 25 }), lib.get('brass', { hover: hov.release }));
  rk.add(revolve([[0, -5.5], [1.02, -5.5]], { segs: 24 }), lib.get('flock', { hover: hov.release }));
  const releaseMeshes = rk.build(release, 'release');
  g.add(release);
  // winding crank (pickable): as on the chrome 503CX in the photographs — black. It stands ~19 off the side (KEH front
  // view, Commons 07 and 13, from above and below): a polished collar on the raised plate, a black drum Ø52 with a
  // raised rim and a leatherette face, the lever on that face; the lever lies across it from upper-rear to lower-front,
  // two distinct ribbed grip banks along its upper edge separated by a smooth bridge, a brushed-chrome bayonet latch
  // near its rear end, the folded fluted handle overhanging at the front; a moulded triangle on the drum aligns with the red dot above it
  const crank = new THREE.Group(); crank.position.set(PL, cr.y, cr.z);
  const ck = new Kit(), cBl = lib.get('satinBlack', { hover: hov.crank }), cBr = lib.get('chromeBright', { hover: hov.crank }), cLe = lib.get('leather', { hover: hov.crank });
  const rotX = T(0, 0, 0, 0, Math.PI / 2, 0);
  const DR = cr.r;
  const CZ = 3.0, FZ = 9.0;   // (the collar's height; the drum's face)
  ck.add(revolve([[DR - 1.2, -0.1, 0], [DR - 0.6, 0.3, 0.5], [DR - 0.6, CZ - 0.4, 0.5], [DR - 0.9, CZ, 0.3]], { segs: 180, crease: 30 }), cBr, rotX);
  ck.add(revolve([[DR - 0.9, CZ, 0], [DR - 0.3, CZ + 0.4, 0.6], [DR, CZ + 1.2, 0.6], [DR, FZ - 0.6, 0.6], [DR - 0.5, FZ, 0.9], [DR - 1.5, FZ, 0.6], [DR - 1.9, FZ - 0.5, 0.2]], { segs: 180 }), cBl, rotX);
  { const face = new THREE.CircleGeometry(DR - 1.8, 96); boxUV(face); ck.add(face, cLe, rotX.clone().multiply(T(0, 0, FZ - 0.6))); }
  ck.add(revolve([[0, 0], [DR - 1.7, 0]], { segs: 96 }), cBl, rotX.clone().multiply(T(0, 0, FZ - 1.0)));
  // Moulded index triangle on the upper rim of the crank drum aligned with the red dot on the side plate (503cx-09, KEH k05)
  { const tri = new THREE.Shape(); tri.moveTo(0, 1.2); tri.lineTo(-0.85, -0.4); tri.lineTo(0.85, -0.4); tri.closePath();
    ck.add(slab(tri, 0.22, 0.06, 4, 0.8), cBl, T(FZ - 0.8, DR - 0.7, -1.0, 0, Math.PI / 2, 0)); }
  // the lever: 57 long, a deep block tapering from ~25 across at its foot to 15 across its top, ~10 high, its centre a
  // little toward the handle end; the upper sloping side knurled in two distinct banks separated by a smooth centre bridge
  const LV = { len: 57, foot: 12.5, top: 7.5, h: 11, a: -40 * DEG, off: 4.0 };
  const lever = rotX.clone().multiply(T(0, 0, FZ - 0.4)).multiply(T(0, 0, 0, 0, 0, LV.a)).multiply(T(LV.off, 0, 0));
  {
    const sec = new THREE.Shape();
    sec.moveTo(-LV.foot, 0); sec.lineTo(LV.foot, 0); sec.lineTo(LV.top + 0.6, LV.h - 0.3); sec.quadraticCurveTo(LV.top, LV.h, LV.top - 0.8, LV.h);
    sec.lineTo(-LV.top + 0.8, LV.h); sec.quadraticCurveTo(-LV.top, LV.h, -LV.top - 0.6, LV.h - 0.3); sec.lineTo(-LV.foot, 0);
    const basis = new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0));
    ck.add(slab(sec, LV.len, 1.6, 12, 0.9), cBl, lever.clone().multiply(T(-LV.len / 2, 0, 0)).multiply(basis));
    // (the knurl: two distinct transverse-ribbed grip zones across the upper slope, separated by a smooth central bridge)
    const dy = LV.top - LV.foot, dz = LV.h, sl = Math.hypot(dy, dz), rx = Math.atan2(dz / sl, dy / sl), nY = dz / sl, nZ = -dy / sl;
    for (let x = -LV.len / 2 + 2.6; x < LV.len / 2 - 2.6; x += 0.88) {
      const inBridge = Math.abs(x + 1.5) < 4.2;
      const inLatch = Math.abs(x - (-LV.len / 2 + 9.2)) < 2.8;
      if (!inBridge && !inLatch)
        ck.add(rbox(0.36, sl - 1.5, 0.34, 0.1, 1), cBl, lever.clone().multiply(T(x, (LV.foot + LV.top) / 2 + 0.14 * nY, LV.h / 2 + 0.14 * nZ, rx, 0, 0)));
    }
  }
  // the latch: a recessed dark pocket and brushed-chrome release bar near the rear end (press it and turn the crank back to take it off)
  ck.add(rbox(5.2, 2.3, 0.5, 0.3, 1), lib.get('flock', { hover: hov.crank }), lever.clone().multiply(T(-LV.len / 2 + 9.2, -0.4, LV.h - 0.02)));
  ck.add(rbox(4.6, 1.85, 0.72, 0.32, 2, 0.9), cBr, lever.clone().multiply(T(-LV.len / 2 + 9.2, -0.4, LV.h + 0.14)));
  // the hinged handle at the front end: folded flat at rest, flips out 90° while winding, with an axially fluted rotating grip cylinder
  const crankArm = new THREE.Group(); crankArm.applyMatrix4(lever); crank.add(crankArm);
  const crankHandle = new THREE.Group(); crankHandle.position.set(LV.len / 2 - 1.2, 0, LV.h + 0.4); crankArm.add(crankHandle);
  const chk = new Kit();
  chk.add(rbox(10, 2 * LV.top - 1.2, 2.6, 1.8, 2, 0.9), cBl, T(-4.8, 0, 0.7));
  chk.add(revolve([[0.65, -(LV.top - 0.8)], [0.65, LV.top - 0.8]], { segs: 12 }), cBr, T(0, 0, 0, Math.PI / 2, 0, 0));
  chk.add(revolve([[1.5, 0], [1.5, -1.0, 0.3], [2.35, -1.2, 0.6, 1], [2.35, -8.8, 0.6, 1], [1.9, -9.2, 0.4], [0, -9.3]], { segs: 192, ribs: { n: 24, depth: 0.16, groove: 0.48 } }), cBl, T(0, 0, -0.8, 0, Math.PI / 2, 0));
  chk.add(revolve([[0.75, 0], [0.75, 0.2, 0.4], [0, 0.25]], { segs: 16 }), cBr, T(-9.32, 0, -0.8, 0, -Math.PI / 2, 0));
  const crankMeshes = [...ck.build(crank, 'crank'), ...chk.build(crankHandle, 'crank')];
  g.add(crank);
  return { group: g, crank, crankHandle, status, release, releaseMeshes, crankMeshes, preRelease, dial, rearFace, ensureRearFace, innerFloor, linerMesh };
}

// ───────── Mirror box ─────────
function buildMirrorBox(lib) {
  const g = new THREE.Group();
  const m = DIM.mirror;
  // mirror: hinged at the top rear, 45° at rest; its black back faces the lens when up
  const mirrorPivot = new THREE.Group();
  mirrorPivot.position.set(0, m.y, m.z);
  const mk = new Kit();
  const blade = lib.get('blade', { clip: false }), mir = lib.get('mirror', { clip: false }), steel = lib.get('steel', { clip: false }), brass = lib.get('brass', { clip: false });
  mk.add(rbox(64, 1.6, m.len + 1, 0.6, 2, 0.4), blade, T(0, -1.1, -m.len / 2));
  mk.add(rbox(m.w, 0.6, m.len - 2, 0.2, 1), mir, T(0, -0.05, -m.len / 2 - 0.5));
  // Central front retaining clip + stamped underside stiffening ribs on mirror tray (503cx-12, KEH k06)
  mk.add(rbox(5.6, 0.75, 2.4, 0.2, 1), blade, T(0, 0.16, -m.len + 0.35));
  [-18, 0, 18].forEach((xx) => mk.add(rbox(2.4, 0.6, m.len - 10, 0.2, 1), blade, T(xx, -2.0, -m.len / 2)));
  const mirrorPins = new THREE.Group();
  const mpk = new Kit();
  [-1, 1].forEach((sx) => {
    mpk.add(revolve([[1.2, 31], [1.2, 34]], { segs: 16 }), steel, T(0, 0, 0, 0, sx * Math.PI / 2, 0));
    mk.add(rbox(1.2, 4, 8, 0.4, 1), blade, T(sx * 32.4, -1.4, -3));
    mk.add(rbox(2.8, 0.7, 2.2, 0.2, 1), blade, T(sx * (m.w / 2 - 2.4), 0.15, -m.len + 0.4));
  });
  mpk.build(mirrorPins);
  mirrorPivot.add(mirrorPins);
  mk.build(mirrorPivot);
  // Live reflex mirror bounce: reflects the live ground-glass / scene texture across the 45° mirror face
  const mirrorLiveMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const mirrorLiveMesh = new THREE.Mesh(prep(new THREE.PlaneGeometry(m.w - 1.6, m.len - 3.2)), mirrorLiveMat);
  mirrorLiveMesh.rotation.x = -Math.PI / 2;
  mirrorLiveMesh.position.set(0, 0.27, -m.len / 2 - 0.5);
  mirrorLiveMesh.userData.noShadow = true;
  mirrorPivot.add(mirrorLiveMesh);
  g.add(mirrorPivot);
  // focusing screen (58 mm Acute-Matte) with the ground-glass image on top, 4 corner clips, Fresnel underside, and 3D prism relief
  const screen = new THREE.Group();
  screen.position.set(0, DIM.screenY, DIM.screenZ);
  const screenMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  const img = new THREE.Mesh(prep(new THREE.PlaneGeometry(DIM.screen, DIM.screen)), screenMat);
  img.rotation.x = -Math.PI / 2; img.position.y = 3.98;
  screen.add(img);
  const sk = new Kit();
  const edgeMat = lib.prepare(new THREE.MeshPhysicalMaterial({ color: 0x9fb8b0, roughness: 0.25, transparent: true, opacity: 0.55, metalness: 0 }), { clip: false });
  edgeMat.userData.single = true;
  const ring = rrPath(-29, -29, 29, 29, 0.6); ring.holes.push(rrPath(-28.6, -28.6, 28.6, 28.6, 0.4, new THREE.Path()));
  sk.add(slab(ring, 3.9, 0.15), edgeMat, T(0, 0, 0, -Math.PI / 2, 0, 0).multiply(T(0, 0, 0)));
  // Brushed steel Acute-Matte perimeter frame + 4 corner metal retaining clips + side clip recesses & 6×4.5 bezel crop ticks (503cx-18)
  const frameRing = rrPath(-29.7, -29.7, 29.7, 29.7, 0.9); frameRing.holes.push(rrPath(-28.4, -28.4, 28.4, 28.4, 0.5, new THREE.Path()));
  sk.add(slab(frameRing, 0.45, 0.12), steel, T(0, 3.85, 0, -Math.PI / 2, 0, 0));
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
    sk.add(rbox(6.2, 0.36, 2.4, 0.15, 1, 0.5), steel, T(sx * 26.2, 4.18, sz * 28.4));
    sk.add(rbox(2.4, 0.36, 6.2, 0.15, 1, 0.5), steel, T(sx * 28.4, 4.18, sz * 26.2));
    // Side retaining clip recesses along left/right frame rails (503cx-18)
    sk.add(rbox(1.5, 0.42, 4.8, 0.12, 1, 0.4), blade, T(sx * 29.05, 4.22, sz * 15.5));
    // 6×4.5 format crop ticks along all four inner bezel edges (±21 mm from center)
    sk.add(rbox(0.32, 0.42, 1.35, 0.05, 1), blade, T(sx * 21.0, 4.22, sz * 28.85));
    sk.add(rbox(1.35, 0.42, 0.32, 0.05, 1), blade, T(sx * 28.85, 4.22, sz * 21.0));
  });
  // Underside of the screen (Fresnel condenser lens side, visible from below when exploded): fine micro-groove bump
  const fresnelCv = document.createElement('canvas'); fresnelCv.width = fresnelCv.height = 256;
  {
    const fg = fresnelCv.getContext('2d'), imgD = fg.createImageData(256, 256), d = imgD.data;
    for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
      const r = Math.hypot(x - 128, y - 128);
      const v = Math.round(128 + 60 * Math.sin(r * 3.2));
      const idx = (y * 256 + x) * 4;
      d[idx] = d[idx + 1] = d[idx + 2] = v; d[idx + 3] = 255;
    }
    fg.putImageData(imgD, 0, 0);
  }
  const fresnelTex = new THREE.CanvasTexture(fresnelCv);
  const fresnelMat = lib.prepare(new THREE.MeshStandardMaterial({ color: 0x434846, roughness: 0.42, metalness: 0.12, bumpMap: fresnelTex, bumpScale: 0.12 }), { clip: false });
  sk.add(new THREE.PlaneGeometry(58, 58), fresnelMat, T(0, 0.02, 0, Math.PI / 2, 0, 0));
  sk.build(screen);
  g.add(screen);
  // 503CX OTF-TTL flash sensor assembly on mirror-box floor (hidden under lowered mirror; built lazily when mirror up / open / cutaway)
  const ttl = new THREE.Group(); ttl.visible = false; g.add(ttl);
  let ttlBuilt = false;
  const ensureTtl = () => {
    if (ttlBuilt) return false;
    ttlBuilt = true;
    const tk = new Kit();
    const ttlAt = T(-26.5, -34.2, 6.0, -0.28, 0.42, 0);
    tk.add(rbox(7.6, 4.8, 8.8, 0.8, 2, 0.6), lib.get('satinBlack', { clip: false }), ttlAt);
    tk.add(revolve([[2.2, 0], [2.2, 1.4, 0.5], [1.7, 1.6, 0.4], [1.6, 0.8]], { segs: 24 }), steel, ttlAt.clone().multiply(T(0, 0.3, 4.1)));
    tk.add(revolve([[0, 1.35], [1.1, 1.25], [1.6, 0.95]], { segs: 20 }), lib.get('innerGlass', { clip: false }), ttlAt.clone().multiply(T(0, 0.3, 4.1)));
    tk.build(ttl);
    return true;
  };
  // Cutaway internal clockwork: mirror drive cam arm, helical return spring, and rear auxiliary shutter vertical linkage bar (built lazily on first cutaway)
  const mechCam = new THREE.Group(); mechCam.position.set(34.2, 6.0, 18.0); mechCam.visible = false;
  const mechSpring = new THREE.Group(); mechSpring.position.set(34.8, -28.0, 9.5); mechSpring.visible = false;
  const auxRod = new THREE.Group(); auxRod.position.set(34.6, 0, 28.4); auxRod.visible = false;
  g.add(mechCam, mechSpring, auxRod);
  let cutMechBuilt = false;
  const ensureCutMech = () => {
    if (cutMechBuilt) return false;
    cutMechBuilt = true;
    const ck2 = new Kit();
    ck2.add(rbox(1.2, 3.6, 26, 0.5, 1, 0.6), steel, T(0, 0, -11));
    ck2.add(revolve([[1.6, -1.2], [1.6, 1.2]], { segs: 16 }), brass, T(0, 0, 0, 0, Math.PI / 2, 0));
    ck2.add(revolve([[1.3, -1.0], [1.3, 1.0]], { segs: 16 }), brass, T(0, 1.2, -22, 0, Math.PI / 2, 0));
    ck2.build(mechCam);
    const spk2 = new Kit();
    for (let i = 0; i < 12; i++) spk2.add(new THREE.TorusGeometry(1.7, 0.32, 6, 16), steel, T(0, i * 1.6, 0, Math.PI / 2 + 0.12, 0, 0));
    spk2.build(mechSpring);
    const ark = new Kit();
    ark.add(rbox(1.1, 52, 2.2, 0.3, 1, 0.5), steel, T(0, 0, 0));
    [-24, 24].forEach((yy) => ark.add(revolve([[1.2, -0.9], [1.2, 0.9]], { segs: 14 }), brass, T(0, yy, 0, 0, Math.PI / 2, 0)));
    ark.build(auxRod);
    return true;
  };
  // auxiliary shutter: two black pebbled-vinyl/leatherette-covered barn doors (built lazily when mirror/lens/mag open or cutaway)
  const auxTop = new THREE.Group(); auxTop.position.set(0, 31, 29); auxTop.visible = false;
  const auxBot = new THREE.Group(); auxBot.position.set(0, -31, 33.5); auxBot.visible = false;
  g.add(auxTop, auxBot);
  let auxBuilt = false;
  const ensureAux = () => {
    if (auxBuilt) return false;
    auxBuilt = true;
    const flapLeather = lib.get('leather', { clip: false }), flapPalpas = lib.get('palpas', { clip: false });
    const flap = (len, dir) => {
      const k = new Kit();
      k.add(rbox(58.6, len, 0.75, 0.35, 1, 0.4), blade, T(0, dir * len / 2, 0));
      const inset = boxUV(rbox(53.6, len - 4.2, 0.35, 0.25, 1, 0.5));
      k.add(inset, flapLeather, T(0, dir * len / 2, 0.32));
      const backInset = boxUV(rbox(54.0, len - 3.6, 0.25, 0.2, 1, 0.3));
      k.add(backInset, flapPalpas, T(0, dir * len / 2, -0.32));
      k.add(rbox(58.6, 1.4, 1.05, 0.4, 1), blade, T(0, dir * 0.7, 0));
      k.add(rbox(58.6, dir < 0 ? 3.2 : 1.2, 1.35, 0.4, 1, 0.6), blade, T(0, dir * (len - (dir < 0 ? 1.6 : 0.6)), 0.12));
      return k;
    };
    const ft = flap(32.0, -1); ft.add(revolve([[1, -30], [1, 30]], { segs: 12 }), steel, T(0, 0, 0, 0, Math.PI / 2, 0));
    ft.build(auxTop);
    const fb = flap(30.5, 1); fb.add(revolve([[1, -30], [1, 30]], { segs: 12 }), steel, T(0, 0, 0, 0, Math.PI / 2, 0));
    fb.build(auxBot);
    return true;
  };
  g.name = 'mirrorBox';
  return { group: g, mirrorPivot, mirrorPins, mirrorLiveMesh, mirrorLiveMat, screen, screenImg: img, screenMat, ttl, ensureTtl, mechCam, mechSpring, auxRod, ensureCutMech, auxTop, auxBot, ensureAux };
}

// ───────── 120 roll film ─────────
// The spool (ISO 732, as Wikipedia gives it): flanges Ø25.1 × 1.52 mm, core Ø11.9; the film ~61 mm wide and 820–850 mm
// long on backing paper a little wider (62.5) and longer. A full roll of paper and film comes to about Ø20.
const SPOOL = { flangeR: 12.55, flangeT: 1.52, coreR: 5.95, half: 31.4, paperHalf: 31.25, fullR: 10.0 };
// How a roll looks out of its foil: backing paper (outside: colour, lettering), the seal that holds a fresh roll
// closed, the paper's inside, the emulsion. Per type when the stock is unknown; per stock from photographs of the rolls.
const ROLL_TYPE = {
  c41: { paper: '#e3b532', paperInk: '#1a1a1a', band: '#b5261d', bandInk: '#fbf3df', bandStyle: 'band', inner: '#0c0c0c', emulsion: '#4b3a3d' },
  bw: { paper: '#e8e5dc', paperInk: '#161616', band: '#1b1b1b', bandInk: '#f0eee6', bandStyle: 'band', inner: '#0c0c0c', emulsion: '#4a4a52' },
  e6: { paper: '#2c58a6', paperInk: '#f1efe7', band: '#f1efe7', bandInk: '#2c58a6', bandStyle: 'band', inner: '#0c0c0c', emulsion: '#373b47' },
};
// Per stock, from photographs of the unwrapped rolls (research notes and sources: GlassMeter-scratch/ref503/filmrolls/
// rolls.json, 2026-10). Five layouts: Kodak (white paper since ~2021, edge zones coloured by process — dark for colour
// negative, pale grey for black and white, blue for E100 — the film name large, a printed yellow panel under the yellow
// "Kodak Professional 120" band, barcode stripes); Ilford (plain white paper, a white band with the film's logo in its
// colour and its ISO); Fuji (coloured stripes along both edges, "FUJIFILM" between, a coloured block on the seal); Fuji
// Acros II (made by Harman: white, black lettering, a grey bar on the band); CineStill (white, a coloured block on the band).
// Names in plain type; no logos.
const KODAK = (name, edge, extra = {}) => ({ fam: 'kodak', name, edge, paper: '#ecebe8', paperInk: '#1c1c1c', block: '#f0b02c', band: '#f4b50c', bandInk: '#2a2420', accent: '#d9252a', ...extra });
const ILFORD = (name, accent, suffix, iso) => ({ fam: 'ilford', name, accent, suffix, iso, paper: '#f1f1ef', paperInk: '#111111', band: '#f7f7f5', bandInk: '#111111' });
const FUJI = (name, iso, edge, band, line = 'FUJICHROME PROFESSIONAL') => ({ fam: 'fuji', name, iso, edge, band, line, paper: '#f2f1ef', paperInk: '#141414', bandInk: '#ffffff' });
const CINE = (name, band) => ({ fam: 'cinestill', name, band, paper: '#ebe9e8', paperInk: '#1a1a1a', bandInk: '#ffffff' });
const ROLL_LOOKS = {
  'kodak-portra-160': KODAK('PORTRA 160', '#2f2e2c'), 'kodak-portra-400': KODAK('PORTRA 400', '#2f2e2c'), 'kodak-portra-800': KODAK('PORTRA 800', '#2f2e2c'),
  'kodak-ektar-100': KODAK('EKTAR 100', '#2f2e2c'), 'kodak-gold-200': KODAK('GOLD 200', '#2f2e2c', { brand: 'Kodak', emulsion: '#33261f' }),
  'kodak-trix-400-v2': KODAK('400TX', '#cbcdca'), 'kodak-tmax-100-v2': KODAK('100TMX', '#cbcdca'), 'kodak-tmax-400-v2': KODAK('400TMY', '#cbcdca'),
  'kodak-ektachrome-e100': KODAK('E100', '#0250b8'),
  'ilford-hp5-400-v2': ILFORD('HP5', '#0bb046', 'PLUS', 'ISO 400/27°'), 'ilford-fp4-125-v2': ILFORD('FP4', '#107cd0', 'PLUS', 'ISO 125/22°'),
  'ilford-delta-100-v2': ILFORD('DELTA', '#2f8fd0', '100', 'ISO 100/21°'), 'ilford-delta-400': ILFORD('DELTA', '#23ac53', '400', 'ISO 400/27°'),
  'ilford-delta-3200-v2': ILFORD('DELTA', '#6a50a0', '3200', 'EI 3200/36°'), 'ilford-panf-50': ILFORD('PAN F', '#f7a51a', 'PLUS', 'ISO 50/18°'),
  'ilford-xp2-super-400': ILFORD('XP2', '#e6281b', 'super 400', 'ISO 400/27°'),
  'fuji-velvia-50': FUJI('Velvia 50', 'ISO 50/18°  DAYLIGHT', '#05a3b8', '#3a72cf'), 'fuji-velvia-100': FUJI('Velvia 100', 'ISO 100/21°  DAYLIGHT', '#05a3b8', '#3a72cf'),
  'fuji-provia-100f': FUJI('PROVIA 100F', 'ISO 100/21°  DAYLIGHT', '#4326b0', '#6a58dc'),
  'fuji-pro-400h': FUJI('PRO 400H', 'ISO 400/27°  DAYLIGHT', '#66103f', '#8a6a2a', 'FUJICOLOR PROFESSIONAL'),
  'fuji-acros-100-ii': { fam: 'acros', name: 'ACROS II', paper: '#efece9', paperInk: '#1a1a1a', band: '#faf7f5', bandInk: '#ffffff', accent: '#7a7473' },
  'cinestill-800t': CINE('800T', '#c83a38'), 'cinestill-50d': CINE('50D', '#3a78e0'), 'cinestill-400d': CINE('400D', '#662885'),
};
/** Paint a roll's paper: u (x) round the roll, twice over; v (y) across the paper's width. sealed: with its seal band. */
function paintRoll(g, W, H, k, sealed) {
  const rep = (fn) => { for (let i = 0; i < 2; i++) fn(i * W / 2 + W / 4); };
  const txt = (s, x, y, font, col, max) => { g.font = font; g.fillStyle = col; g.fillText(s, x, y, max); };
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = k.paper; g.fillRect(0, 0, W, H);
  if (k.fam === 'kodak') {
    g.fillStyle = k.edge; g.fillRect(0, 0, W, 18); g.fillRect(0, H - 18, W, 18);
    rep((x) => txt(k.name, x, 52, `300 38px ${FONT}`, k.paperInk, 240));
    g.fillStyle = k.block; g.fillRect(0, 88, W, 82);
    g.fillStyle = '#121212'; [176, 182, 190, 194, 203, 210, 214, 222, 229].forEach((y, i) => g.fillRect(0, y, W, [3, 2, 5, 1, 4, 2, 6, 1, 3][i]));
    if (sealed) {
      g.fillStyle = k.band; g.fillRect(0, 84, W, 90);
      rep((x) => {
        if (k.brand) txt(k.brand, x, 102, `800 18px ${FONT}`, k.accent);
        else { txt('Kodak', x - 52, 102, `800 18px ${FONT}`, k.accent); txt('Professional', x + 28, 102, `500 17px ${FONT}`, k.bandInk); }
        txt('120', x, 132, `800 36px ${FONT}`, k.bandInk);
        txt('Remove this band entirely.', x, 160, `500 11px ${FONT}`, k.bandInk);
      });
    }
  } else if (k.fam === 'fuji') {
    g.fillStyle = k.edge; g.fillRect(0, 0, W, 34); g.fillRect(0, H - 34, W, 34);
    rep((x) => { txt('120   120   120', x, 17, `700 18px ${FONT}`, '#ffffff', 240); txt(k.line, x, H - 17, `700 15px ${FONT}`, '#ffffff', 240); txt('FUJIFILM', x + 64, 70, `800 22px ${FONT}`, k.paperInk); });
    if (sealed) {
      g.fillStyle = '#fbfbf9'; g.fillRect(0, 92, W, 92);
      g.fillStyle = k.band; g.fillRect(0, 92, W, 56);
      rep((x) => { txt(k.name, x, 112, `700 26px ${FONT}`, k.bandInk, 230); txt(k.iso, x, 137, `600 12px ${FONT}`, k.bandInk); txt('LOAD IN SUBDUED LIGHT · 6×6cm 12EXP.', x, 166, `600 11px ${FONT}`, '#141414', 236); });
    }
  } else if (k.fam === 'acros') {
    rep((x) => { txt('FUJIFILM', x, 40, `800 20px ${FONT}`, k.paperInk); txt('120', x + 70, 214, `800 30px ${FONT}`, k.paperInk);
      g.strokeStyle = k.paperInk; g.lineWidth = 2; g.strokeRect(x - 100, 196, 120, 34); txt('NEOPAN 100 ACROS II', x - 40, 213, `700 11px ${FONT}`, k.paperInk, 112); });
    if (sealed) {
      g.fillStyle = k.band; g.fillRect(0, 88, W, 80);
      g.fillStyle = k.accent; g.fillRect(0, 98, W, 30);
      rep((x) => { txt('NEOPAN 100', x, 113, `800 18px ${FONT}`, k.bandInk); g.strokeStyle = k.accent; g.lineWidth = 2; g.strokeRect(x - 60, 136, 120, 24); txt('ACROS II', x, 148, `700 15px ${FONT}`, k.accent); });
    }
  } else if (k.fam === 'ilford' || k.fam === 'cinestill') {
    if (sealed && k.fam === 'ilford') {
      g.fillStyle = k.band; g.fillRect(0, 83, W, 90);
      g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = 1; g.strokeRect(-2, 83, W + 4, 90);
      rep((x) => {
        txt('ILFORD', x, 98, `800 14px ${FONT}`, k.bandInk);
        txt(k.name, x, 124, `900 30px ${FONT}`, k.accent);
        g.fillStyle = '#111'; g.fillRect(x - 46, 141, 92, 18);
        txt(k.suffix, x, 150, `800 13px ${FONT}`, '#ffffff');
        g.save(); g.translate(x + 92, 128); g.rotate(Math.PI / 2); txt(k.iso, 0, 0, `700 10px ${FONT}`, k.bandInk); g.restore();
      });
    } else if (sealed) {
      g.fillStyle = '#f7f6f4'; g.fillRect(0, 87, W, 82);
      g.fillStyle = k.band; g.fillRect(0, 97, W, 62);
      rep((x) => { txt('CineStill', x - 8, 124, `italic 800 28px ${FONT}`, k.bandInk); txt('film', x + 74, 126, `600 11px ${FONT}`, k.bandInk); txt(k.name, x, 150, `800 13px ${FONT}`, k.bandInk); });
    }
  }
  g.textAlign = 'left';
}
/** Paint the leader: u from its tip back along the paper (the tip tapered), v across the paper. */
function paintLeader(g, LW, LH, px, k) {
  g.clearRect(0, 0, LW, LH); g.fillStyle = k.paper;
  g.beginPath(); g.moveTo(0, LH * 0.3); g.lineTo(22 * px, 0); g.lineTo(LW, 0); g.lineTo(LW, LH); g.lineTo(22 * px, LH); g.lineTo(0, LH * 0.7); g.closePath(); g.fill();
  g.save(); g.clip();
  g.textBaseline = 'middle';
  const stripe = k.fam === 'kodak' ? 9 : k.fam === 'fuji' ? 17 : 0;
  if (stripe) { g.fillStyle = k.edge; g.fillRect(0, 0, LW, stripe); g.fillRect(0, LH - stripe, LW, stripe); }
  g.fillStyle = k.paperInk;
  if (k.fam === 'kodak') { g.font = `300 34px ${FONT}`; [30, 140, 250, 360].forEach((mm) => g.fillText(k.name, mm * px, LH / 2)); }
  else if (k.fam === 'fuji') { g.font = `800 20px ${FONT}`; [40, 160, 280].forEach((mm) => g.fillText('FUJIFILM', mm * px, LH / 2)); g.fillStyle = '#fff'; g.font = `700 11px ${FONT}`; [30, 120, 210, 300].forEach((mm) => g.fillText('120   120', mm * px, stripe / 2)); }
  else if (k.fam === 'acros') { g.font = `800 18px ${FONT}`; [40, 200].forEach((mm) => g.fillText('FUJIFILM', mm * px, LH / 2)); }
  g.restore();
}
const ROLL_AREA = Math.PI * (SPOOL.fullR ** 2 - SPOOL.coreR ** 2);   // (the roll's cross-section: paper and film, mm²)
const rollR = (area) => Math.sqrt(SPOOL.coreR ** 2 + Math.max(0, area) / Math.PI);
/** A black plastic 120 spool along x: slotted core (the paper's tongue goes in the slot), flanges, the drive slot in each
 *  end. Returned as a group, so it can spin and travel; `roll` is its paper, sized with setR(). */
function buildSpool(lib, mats) {
  const g = new THREE.Group(), k = new Kit(), X = T(0, 0, 0, 0, Math.PI / 2, 0);
  const { coreR: c, flangeR: f, flangeT: ft, half: h } = SPOOL;
  k.add(revolve([[0, -h - ft + 3.5], [2.6, -h - ft + 3.5], [2.6, -h - ft], [c, -h - ft], [c, h + ft], [2.6, h + ft], [2.6, h + ft - 3.5], [0, h + ft - 3.5]], { segs: 32 }), mats.plastic, X);
  [-1, 1].forEach((sx) => {
    const prof = sx < 0 ? [[c, -h - ft], [f, -h - ft, 0.3], [f, -h, 0.3], [c, -h]] : [[c, h], [f, h, 0.3], [f, h + ft, 0.3], [c, h + ft]];
    k.add(revolve(prof, { segs: 56 }), mats.plastic, X);
    k.add(rbox(0.3, 5.2, 1.3, 0.1, 1), mats.slot, T(sx * (h + ft + 0.02), 0, 0));   // (the drive slot across the end)
  });
  k.add(rbox(2 * h - 4, 1.0, 0.6, 0.1, 1), mats.slot, T(0, c - 0.15, 0));         // the slot along the core
  k.build(g);
  // the paper: a cylinder between the flanges, and its two edges (the wound edge of the paper, paler)
  const roll = new THREE.Mesh(prep(new THREE.CylinderGeometry(1, 1, 2 * SPOOL.paperHalf, 64, 1, true)), mats.rollOpen);
  roll.rotation.z = Math.PI / 2;
  const endsK = new Kit();
  [-1, 1].forEach((sx) => endsK.add(new THREE.CircleGeometry(1, 48), mats.edge, T(sx * SPOOL.paperHalf, 0, 0, 0, sx * Math.PI / 2, 0)));
  const [ends] = endsK.build(g);
  g.add(roll);
  g.userData.setR = (r) => {
    const on = r > c + 0.05;
    roll.visible = on; ends.visible = on; ends.scale.set(1, r, r);
    roll.scale.set(r, 1, r);
    g.userData.r = r;
  };
  g.userData.setSealed = (b) => { roll.material = b ? mats.rollSealed : mats.rollOpen; };
  g.userData.setR(c);
  return g;
}
/** A belt through circles in the holder's z–y plane, each {z, y, r} with r signed (+ counterclockwise, z toward y):
 *  from the first circle's departure point, around the ones between, to the last one's arrival point. */
function beltPath(cs, step = 1.0) {
  const tang = (a, b) => {
    const dz = b.z - a.z, dy = b.y - a.y, L = Math.hypot(dz, dy), uz = dz / L, uy = dy / L, h = (a.r - b.r) / L, q = Math.sqrt(Math.max(0, 1 - h * h));
    for (const sg of [1, -1]) {
      const nz = h * uz - sg * q * uy, ny = h * uy + sg * q * uz;
      if (-ny * dz + nz * dy > 0) return [[a.z + a.r * nz, a.y + a.r * ny], [b.z + b.r * nz, b.y + b.r * ny]];
    }
    return [[a.z, a.y], [b.z, b.y]];
  };
  const T_ = cs.slice(1).map((b, i) => tang(cs[i], b)), pts = [];
  const line = (p, q) => { const n = Math.max(1, Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) / step)); for (let i = 0; i < n; i++) pts.push([p[0] + (q[0] - p[0]) * i / n, p[1] + (q[1] - p[1]) * i / n]); };
  T_.forEach(([p, q], i) => {
    line(p, q);
    const c = cs[i + 1];
    if (i + 1 < cs.length - 1) {   // around an intermediate circle, to the next tangent's departure point
      const p2 = T_[i + 1][0], a0 = Math.atan2(q[1] - c.y, q[0] - c.z);
      let da = Math.atan2(p2[1] - c.y, p2[0] - c.z) - a0;
      if (c.r > 0) { while (da < 0) da += TAU; } else { while (da > 0) da -= TAU; }
      const R = Math.abs(c.r), n = Math.max(2, Math.ceil(Math.abs(da) * R / step));
      for (let k = 0; k < n; k++) { const a = a0 + da * k / n; pts.push([c.z + R * Math.cos(a), c.y + R * Math.sin(a)]); }
    } else pts.push(q);
  });
  let s = 0;
  return pts.map((p, i) => { if (i) s += Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]); return { z: p[0], y: p[1], s }; });
}

// ───────── A12 magazine ─────────
function buildMagazine(lib) {
  const g = new THREE.Group();
  g.name = 'magazine';
  const kit = new Kit(), D = decalAtlas();
  const chrome = lib.get('chrome'), bright = lib.get('chromeBright'), leather = lib.get('leather'), anod = lib.get('anod'), flock = lib.get('flock');
  const satinBlack = lib.get('satinBlack');
  const d = DIM.magazine.d, H = DIM.magazine.h / 2;
  // shell: straight sides; the rear corners rounded r 14 top and bottom (the side's "D": Commons 503cx-09 and -10, a
  // straight side view of an A12, all scaled by the magazine's 92 mm height) and r 4 at the sides (the top view)
  const secs = [], RR = 14, RX = 4;
  [3.2, 3.5, 3.9, 4.3, 4.7, 5.1, 12, 22, 32, d - RR].forEach((z) => {
    const gr = 1 - Math.min(1, Math.abs(z - 4.3) / 0.6);
    secs.push({ z, hw: HW - 0.25 * gr, top: H - 0.25 * gr, bot: -H + 0.25 * gr, r: 3 });
  });
  for (let i = 1; i <= 20; i++) {
    const a = (i / 20) * Math.PI / 2, z = d - RR + RR * Math.sin(a), inset = RR * (1 - Math.cos(a));
    const zx = z - (d - RX), insetX = zx > 0 ? RX - Math.sqrt(Math.max(0, RX * RX - zx * zx)) : 0;
    secs.push({ z, hw: HW - insetX, top: H - inset, bot: -H + inset, r: 3 + Math.min(insetX, inset) * 0.6, wear: 0.6 * Math.sin(a * 2) });
  }
  // the left side is open where the film insert slides in (its end plate is that wall): the shell's flat left face is
  // left out from behind the front frame to where the rear rounding passes the end plate; a chrome frame (below, once
  // the end plate's shape is known) closes the rest round an opening of that shape. Drawn out, the dark inside shows.
  const OZ0 = 5.1, OZ1 = secs.find((s) => s.z >= d - 5.0 - 1e-6).z;
  const { geo, loops } = loft(secs, { xBreak: 10, nTop: 3, nTop2: 5, nC: 10, nSide: 12, edgeWear: 0.6,
    skip: (p, q, z0, z1) => z0 >= OZ0 - 1e-6 && z1 <= OZ1 + 1e-6 && p[0] < -HW + 0.05 && q[0] < -HW + 0.05 });
  kit.add(geo, chrome);
  kit.add(capFromLoop(loops[loops.length - 1].pts, [], false), chrome, T(0, 0, d));
  // front frame and the dark-slide slot along the left edge
  const ff = rrPath(-HW, -H, HW, H, 3); ff.holes.push(rrPath(-30, -30, 30, 30, 2, new THREE.Path()));
  kit.add(slab(ff, 3.2, 0.35, 12, 0.6), chrome, T(0, 0, 0));
  kit.add(rbox(0.8, 84, 0.9, 0.2, 1), flock, T(-HW + 0.3, 0, 1.6));
  // coverings: black leatherette over nearly all of both side panels and the rear panel;
  // chrome shows only on the frames, the rounded rear edges, top and bottom
  const SZ0 = 5.4, SZ1 = d - 2.6, SY = 42.4, SRR = 12.4;     // side panel: leather to 2.6 from the back (Commons 503cx-10); rear corners follow the shell's
  // right-side layout after the manual (pp. 2, 4): fold-out film crank toward the rear below centre, the circled
  // "12" designation high by the front edge, frame counter and magazine status window low
  // (positions from the Commons 503CX's magazine: crank toward the rear just below centre, a tall black plate by the
  //  front edge printed with the "12", the maker and the film-plane mark, frame counter and signal low at the front)
  const CR = { z: 30.0, y: -3.0 }, CT = { z: 19.3, y: -36.2 }, SG = { z: 8.3, y: -33.0 }, BD = { z: 9.6, y: -2.0 };   // (re-measured on Commons 503cx-09)
  const panelShape = (x0, x1, y0, y1, rF, rR, flip) => {
    // (x0 front, x1 rear in panel coordinates; flip mirrors x for the right side)
    const s = new THREE.Shape(), f = (x) => (flip ? -x : x), pts = [];
    const corner = (cx, cy, r, a0, a1) => { for (let i = 0; i <= 8; i++) { const a = a0 + (a1 - a0) * i / 8; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } };
    corner(x0 + rF, y0 + rF, rF, Math.PI, 1.5 * Math.PI); corner(x1 - rR, y0 + rR, rR, 1.5 * Math.PI, 2 * Math.PI);
    corner(x1 - rR, y1 - rR, rR, 0, 0.5 * Math.PI); corner(x0 + rF, y1 - rF, rF, 0.5 * Math.PI, Math.PI);
    const q = flip ? pts.map(([x, y]) => [f(x), y]).reverse() : pts;
    s.moveTo(q[0][0], q[0][1]); q.slice(1).forEach(([x, y]) => s.lineTo(x, y)); s.closePath();
    return s;
  };
  // body-facing magazine front face, gate frame, screws, engravings & interior shell liner (built lazily when detached/open/cutaway)
  const frontFace = new THREE.Group(); frontFace.visible = false; g.add(frontFace);
  let frontBuilt = false;
  const ensureFrontFace = () => {
    if (frontBuilt) return false;
    frontBuilt = true;
    const fk = new Kit(), scr = new Kit(), inkW = lib.get('inkWhite');
    const gate = rrPath(-31.5, -31.5, 31.5, 31.5, 2); gate.holes.push(rrPath(-28, -28, 28, 28, 1, new THREE.Path()));
    fk.add(slab(gate, 0.8, 0.2), satinBlack, T(0, 0, -0.3));
    fk.add(new THREE.PlaneGeometry(58, 58), flock, T(0, 0, 3.1));
    const fp = rrPath(-HW + 0.8, -H + 0.8, HW - 0.8, H - 0.8, 2.4); fp.holes.push(rrPath(-30, -30, 30, 30, 2, new THREE.Path()));
    fk.add(slab(fp, 0.5, 0.15, 12, 0.6), anod, T(0, 0, -0.42));
    [-1, 1].forEach((sx) => fk.add(rbox(5.6, 1.7, 0.6, 0.3, 1), flock, T(sx * 15.3, 39.3, -0.5)));
    fk.add(rbox(2.4, 19.6, 0.6, 0.4, 1), flock, T(41.0, 8.9, -0.5));
    fk.add(rbox(1.5, 13.5, 0.8, 0.4, 1), satinBlack, T(41.0, 8.4, -0.55));
    for (let i = 0; i < 5; i++) fk.add(rbox(1.3, 0.45, 0.3, 0.1, 1), bright, T(41.0, 3.4 + i * 2.5, -0.95));
    fk.add(rbox(0.8, 2.6, 0.6, 0.2, 1), flock, T(41.0, -28.3, -0.5));
    [[-40.4, 40.6], [40.4, 40.6], [-4.0, 41.4], [41.0, -5.5], [-41.0, 4.0], [-40.4, -40.6], [40.4, -40.6], [7.5, -41.4]].forEach(([x, y], i) => addScrew(fk, anod, scr, flock, T(x, y, -0.45, 0, Math.PI, 0), 1.05, false, i * 0.7));
    fk.add(decalUV(new THREE.PlaneGeometry(16, 2.0), D.magSerial), inkW, T(0, -29.75, -0.56, 0, Math.PI, 0));
    fk.add(decalUV(new THREE.PlaneGeometry(28, 1.8), D.maker), inkW, T(0, -34.2, -0.46, 0, Math.PI, 0));
    const linerShape = panelShape(3.4, d - 1.6, -(H - 1.6), H - 1.6, 0.6, RR - 1.6, false);
    linerShape.holes.push(panelShape(4.2, d - 2.4, -(H - 2.4), H - 2.4, 0.4, RR - 2.4, false));
    const liner = slab(linerShape, HW * 2 - 3, 0.1, 16, 0);
    liner.rotateY(-Math.PI / 2);
    fk.add(boxUV(liner), flock, T(HW - 1.5, 0, 0));
    fk.add(new THREE.ShapeGeometry(panelShape(3.4, d - 1.6, -(H - 1.6), H - 1.6, 0.6, RR - 1.6, false), 16), flock, T(HW - 1.6, 0, 0, 0, -Math.PI / 2, 0));
    scr.build(frontFace);
    fk.build(frontFace);
    return true;
  };
  // the frame round the insert's opening: the shell's left face between the sections the loft left out, less the end
  // plate's shape (a little inside it, so the plate covers the edge when the insert is home)
  { const sp = secs.filter((s) => s.z >= OZ0 - 1e-6 && s.z <= OZ1 + 1e-6), fr = new THREE.Shape();
    sp.forEach((s, i) => (i ? fr.lineTo(s.z, s.top - s.r) : fr.moveTo(s.z, s.top - s.r)));
    sp.slice().reverse().forEach((s) => fr.lineTo(s.z, s.bot + s.r));
    fr.lineTo(sp[0].z, sp[0].top - sp[0].r);
    fr.holes.push(panelShape(SZ0 + 0.8, Math.min(SZ1, OZ1) - 0.8, -SY + 0.8, SY - 0.8, 1.8, SRR - 0.8, false));
    kit.add(slab(fr, 1.0, 0.2, 16, 0.6), chrome, T(-HW + 1.0, 0, 0, 0, -Math.PI / 2, 0)); }
  const sidePanel = (holes) => {
    const sh = panelShape(SZ0, SZ1, -SY, SY, 2.4, SRR, true);   // shape x = −z (right side, rotated +90° about y)
    holes.forEach((h) => sh.holes.push(h));
    return sh;
  };
  {
    const holes = [
      new THREE.Path().absarc(-CR.z, CR.y, 15.75, 0, TAU, true),
      new THREE.Path().absarc(-CT.z, CT.y, 4.9, 0, TAU, true),
      new THREE.Path().absarc(-SG.z, SG.y, 2.8, 0, TAU, true),
    ];
    kit.add(slab(sidePanel(holes), 0.9, 0.3, 16, 0.9), leather, T(HW - 0.1, 0, 0, 0, Math.PI / 2, 0));
  }
  // the back (pre-1997 magazines, before the dark-slide holder): leatherette edge to edge between the side rims, and
  // in its centre the film-tab holder — a chrome-framed square, a black textured panel and a turning speed dial whose
  // toothed round window shows the box-end tab, a tab above the window printed with the ASA, one below with the DIN
  // (one continuous covering: top, rounded rear corners, back, and bottom, all XL either side of centre)
  const XL = HW - RX - 0.1;
  {
    const uStrap = new THREE.Shape(), tL = 0.75, bF = 0.25;
    uStrap.moveTo(SZ0, H - 0.05);
    uStrap.lineTo(SZ0, H + tL - bF);
    uStrap.absarc(SZ0 + bF, H + tL - bF, bF, Math.PI, Math.PI / 2, true);
    uStrap.lineTo(d - RR, H + tL);
    uStrap.absarc(d - RR, H - RR, RR + tL, Math.PI / 2, 0, true);
    uStrap.lineTo(d + tL, -(H - RR));
    uStrap.absarc(d - RR, -(H - RR), RR + tL, 0, -Math.PI / 2, true);
    uStrap.lineTo(SZ0 + bF, -(H + tL));
    uStrap.absarc(SZ0 + bF, -(H + tL - bF), bF, -Math.PI / 2, -Math.PI, true);
    uStrap.lineTo(SZ0, -(H - 0.05));
    uStrap.lineTo(d - RR, -(H - 0.05));
    uStrap.absarc(d - RR, -(H - RR), RR - 0.05, -Math.PI / 2, 0, false);
    uStrap.lineTo(d - 0.05, H - RR);
    uStrap.absarc(d - RR, H - RR, RR - 0.05, 0, Math.PI / 2, false);
    uStrap.closePath();
    kit.add(slab(uStrap, 2 * XL, 0.25, 28, 0.85), leather, T(XL, 0, 0, 0, -Math.PI / 2, 0));
  }
  const PY = 0.5, WR = 10.4;   // (holder centre; the dial's window radius)
  // Cushion-curved square chrome memo holder frame, open at the top middle for sliding in the film-box flap (503cx-11, a12/a05, commons_a12_back)
  {
    const fO = 21, fI = 18.4, rO = 5.5, rI = 4.0, slotX = 13.6, y0O = PY - fO, y1O = PY + fO, y0I = PY - fI, y1I = PY + fI, rc = 0.65;
    const uFrame = new THREE.Shape();
    uFrame.moveTo(-slotX - rc, y1O);
    uFrame.lineTo(-fO + rO, y1O); uFrame.absarc(-fO + rO, y1O - rO, rO, Math.PI / 2, Math.PI, false);
    uFrame.lineTo(-fO, y0O + rO); uFrame.absarc(-fO + rO, y0O + rO, rO, Math.PI, Math.PI * 1.5, false);
    uFrame.lineTo(fO - rO, y0O); uFrame.absarc(fO - rO, y0O + rO, rO, Math.PI * 1.5, TAU, false);
    uFrame.lineTo(fO, y1O - rO); uFrame.absarc(fO - rO, y1O - rO, rO, 0, Math.PI / 2, false);
    uFrame.lineTo(slotX + rc, y1O);
    uFrame.quadraticCurveTo(slotX, y1O, slotX, y1O - rc);
    uFrame.lineTo(slotX, y1I + rc);
    uFrame.quadraticCurveTo(slotX, y1I, slotX + rc, y1I);
    uFrame.lineTo(fI - rI, y1I); uFrame.absarc(fI - rI, y1I - rI, rI, Math.PI / 2, 0, true);
    uFrame.lineTo(fI, y0I + rI); uFrame.absarc(fI - rI, y0I + rI, rI, TAU, Math.PI * 1.5, true);
    uFrame.lineTo(-fI + rI, y0I); uFrame.absarc(-fI + rI, y0I + rI, rI, Math.PI * 1.5, Math.PI, true);
    uFrame.lineTo(-fI, y1I - rI); uFrame.absarc(-fI + rI, y1I - rI, rI, Math.PI, Math.PI / 2, true);
    uFrame.lineTo(-slotX - rc, y1I);
    uFrame.quadraticCurveTo(-slotX, y1I, -slotX, y1I + rc);
    uFrame.lineTo(-slotX, y1O - rc);
    uFrame.quadraticCurveTo(-slotX, y1O, -slotX - rc, y1O);
    uFrame.closePath();
    kit.add(slab(uFrame, 1.55, 0.45, 12, 0.9), bright, T(0, 0, d + 0.7));
  }
  const backing = rrPath(-19.2, PY - 19.2, 19.2, PY + 19.2, 4.4); backing.holes.push(new THREE.Path().absarc(0, PY, WR + 0.5, 0, TAU, true));
  kit.add(slab(backing, 0.5, 0.15, 12, 0.6), satinBlack, T(0, 0, d + 0.7));
  const panel = rrPath(-18.6, PY - 18.6, 18.6, PY + 18.6, 4); panel.holes.push(new THREE.Path().absarc(0, PY, 12.4, 0, TAU, true));
  kit.add(slab(panel, 0.5, 0.15, 12, 0.6), leather, T(0, 0, d + 1.2));
  // the dial: a black ring, its 3D knurled metal inner edge round the window, the two printed tabs
  kit.add(revolve([[12.4, -0.2, 0], [12.4, 0.6, 0.4], [12.0, 1.0, 0.5], [WR + 0.6, 1.0, 0.3], [WR + 0.6, 0.2, 0]], { segs: 72 }), satinBlack, T(0, PY, d + 1.2));
  {
    const teeth = new THREE.Shape(); teeth.absarc(0, 0, WR + 0.75, 0, TAU, false);
    const h = new THREE.Path(), N = 54;
    for (let i = 0; i <= N * 2; i++) { const a = -(i / (N * 2)) * TAU, r = i % 2 ? WR - 0.52 : WR + 0.12; i ? h.lineTo(r * Math.cos(a), r * Math.sin(a)) : h.moveTo(r * Math.cos(a), r * Math.sin(a)); }
    teeth.holes.push(h);
    const tGeo = new THREE.ExtrudeGeometry(teeth, { depth: 0.38, bevelEnabled: false, curveSegments: 48 });
    kit.add(tGeo, lib.get('turned'), T(0, PY, d + 1.88));
  }
  [1, -1].forEach((sy) => kit.add(rbox(5.4, 6.2, 1.0, 0.5, 2, 0.4), satinBlack, T(0, PY + sy * 15.2, d + 2.0)));
  const isoCv = document.createElement('canvas'); isoCv.width = 64; isoCv.height = 384;
  const isoTex = new THREE.CanvasTexture(isoCv); isoTex.colorSpace = THREE.SRGBColorSpace; isoTex.anisotropy = 8;
  const isoMat = lib.prepare(new THREE.MeshStandardMaterial({ map: isoTex, roughness: 0.5, transparent: true, alphaTest: 0.3, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), { clip: true });
  const isoMesh = new THREE.Mesh(prep(new THREE.PlaneGeometry(6, 36)), isoMat);
  isoMesh.position.set(0, PY, d + 2.52);
  g.add(isoMesh);
  const cardCv = document.createElement('canvas'); cardCv.width = 320; cardCv.height = 224;
  const cardTex = new THREE.CanvasTexture(cardCv); cardTex.colorSpace = THREE.SRGBColorSpace; cardTex.anisotropy = 8;
  const card = new THREE.Mesh(prep(new THREE.PlaneGeometry(29.7, 20.8)), lib.prepare(new THREE.MeshStandardMaterial({ map: cardTex, roughness: 0.62 }), { clip: true }));
  card.position.set(0, PY, d + 0.9);   // behind the panel (d + 1.2), seen through the dial's round window
  g.add(card);
  // right side: the film crank (a black disc with leatherette side inlays and two parallel guide ribs in a polished ring,
  // its black lever folded flat toward the rear), the round frame counter and signal window low at the front
  const R = (y, z, x = 0) => T(HW + x, y, z, 0, Math.PI / 2, 0);
  kit.add(revolve([[15.8, -0.3, 0], [15.8, 0.5, 0.6], [15.3, 1.0, 0.9], [14.4, 1.0, 0.4], [14.4, -1.2, 0], [0, -1.2, 0]], { segs: 96, crease: 30 }), bright, R(CR.y, CR.z));
  const magCrank = new THREE.Group(); magCrank.position.set(HW - 0.2, CR.y, CR.z); magCrank.rotation.y = Math.PI / 2;
  const magCrankArm = new THREE.Group(); magCrankArm.position.set(9.5, 0, 0.9);
  const magCrankDot = new THREE.Mesh(revolve([[0.65, 0], [0.65, 0.15, 0.4], [0, 0.18]], { segs: 16 }), lib.get('white'));
  magCrankDot.position.set(10.5, 0, 3.4); magCrankDot.visible = false;
  magCrank.add(magCrankDot);
  {
    // the lever, folded: 38 long and 11 wide, flanked by two raised parallel guide ribs on the disc (Commons 503cx-09, a12/a03)
    const mck = new Kit(), mcak = new Kit();
    mck.add(new THREE.CircleGeometry(14.45, 64), satinBlack, T(0, 0, 0.35));
    // Pebbled leatherette side inlays + two parallel raised guide ribs flanking the lever channel
    [-1, 1].forEach((sy) => {
      mck.add(rbox(24.5, 1.1, 0.9, 0.32, 1, 0.7), satinBlack, T(-1.2, sy * 6.1, 0.65));
      const seg = new THREE.Shape(), a0 = Math.asin(6.85 / 13.6);
      seg.absarc(0, 0, 13.6, sy > 0 ? a0 : Math.PI + a0, sy > 0 ? Math.PI - a0 : TAU - a0, false);
      seg.closePath();
      const sGeo = slab(seg, 0.36, 0.1, 16, 0.6); boxUV(sGeo);
      mck.add(sGeo, leather, T(0, 0, 0.38));
    });
    mck.add(rbox(9, 10.6, 3.4, 1.6, 2, 0.8), satinBlack, T(9.5, 0, 1.7));
    mck.build(magCrank);
    const arm = rrPath(-14, -5.5, 24, 5.5, 4.6);
    mcak.add(slab(arm, 2.4, 0.7, 16, 0.9), satinBlack, T(-9.5, 0, 0).multiply(T(0, 0, 0, 0, 0, Math.PI)));
    mcak.add(rbox(10, 10.2, 2.0, 1.4, 2, 0.8), satinBlack, T(-28.0, 0, 2.2));   // (the handle's grip, a step proud of the arm)
    for (let k = -2; k <= 2; k++) mcak.add(rbox(0.4, 7.6, 0.3, 0.1, 1), satinBlack, T(-28.0 + k * 1.4, 0, 3.25));
    mcak.build(magCrankArm);
    magCrank.add(magCrankArm);
    g.add(magCrank);
  }
  // frame counter: a round window in a turned bezel (the number is drawn on its card)
  kit.add(revolve([[4.9, -0.2, 0], [4.9, 0.6, 0.5], [4.5, 1.1, 0.8], [3.6, 1.15, 0.5], [3.3, 0.8, 0]], { segs: 48 }), bright, T(HW - 0.1, CT.y, CT.z, 0, Math.PI / 2, 0));
  kit.add(new THREE.CircleGeometry(3.4, 32), satinBlack, T(HW + 0.05, CT.y, CT.z, 0, Math.PI / 2, 0));
  const ctrCv = document.createElement('canvas'); ctrCv.width = 128; ctrCv.height = 96;
  const ctrTex = new THREE.CanvasTexture(ctrCv); ctrTex.colorSpace = THREE.SRGBColorSpace;
  // (a disc showing the middle of the counter card: the numeral sits centred in the round window)
  const ctrGeo = new THREE.CircleGeometry(3.2, 32);
  { const uv = ctrGeo.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setXY(k, 0.5 + (uv.getX(k) - 0.5) * 6.4 / 8.2, 0.5 + (uv.getY(k) - 0.5) * 6.4 / 6.1); }
  const counter = new THREE.Mesh(prep(ctrGeo), lib.prepare(new THREE.MeshStandardMaterial({ map: ctrTex, roughness: 0.6 }), { clip: true }));
  counter.position.set(HW + 0.4, CT.y, CT.z); counter.rotation.y = Math.PI / 2;
  g.add(counter);
  kit.add(new THREE.CircleGeometry(3.4, 32), lib.get('windowGlass'), T(HW + 0.75, CT.y, CT.z, 0, Math.PI / 2, 0));
  // signal window: small and round, beside the counter
  kit.add(revolve([[2.8, -0.2, 0], [2.8, 0.45, 0.5], [2.5, 0.8, 0.8], [2.0, 0.85, 0.5], [1.85, 0.6, 0]], { segs: 32 }), bright, T(HW - 0.1, SG.y, SG.z, 0, Math.PI / 2, 0));
  const signal = new THREE.Mesh(prep(new THREE.CircleGeometry(1.85, 24)), lib.prepare(new THREE.MeshStandardMaterial({ color: 0xf2f2ec, roughness: 0.5 }), { clip: true }));
  signal.position.set(HW + 0.55, SG.y, SG.z); signal.rotation.y = Math.PI / 2;
  g.add(signal);
  // the plate: black, 8.5 × 54, by the front edge — a circled "12" at the top, the maker's name, the film-plane mark
  // (the real A12 prints these on a black plate by the front edge; here they are laser-etched into the leatherette,
  //  matte and a shade lighter, set back from the edge and clear of the counter and signal windows)
  kit.add(decalUV(new THREE.PlaneGeometry(40, 5.0), D.magPlate), lib.get('inkEtch'), T(HW + 0.82, BD.y, BD.z, 0, Math.PI / 2, 0).multiply(T(0, 0, 0, 0, 0, Math.PI / 2)));
  // left side: the film insert's chrome end plate, leatherette inlay, fold-flat key (insert slides out this way)
  const ins = new THREE.Group();
  const ik = new Kit();
  const KY = { z: 29.3, y: -1.6 };   // (the film key: a Ø31 chrome dish toward the rear, a little below centre — Commons 503cx-10, an A12's straight side view)
  ik.add(slab(panelShape(SZ0, SZ1, -SY, SY, 2.4, SRR, false), 1.2, 0.4, 16, 0.9), bright, T(-HW + 0.3, 0, 0, 0, -Math.PI / 2, 0));
  { const inl = panelShape(SZ0 + 1.0, SZ1 - 1.0, -SY + 1.0, SY - 1.0, 1.6, SRR - 1.0, false);   // (a thin chrome edge, as on the real end plate) inl.holes.push(new THREE.Path().absarc(KY.z, KY.y, 16.2, 0, TAU, true));
    ik.add(slab(inl, 0.8, 0.28, 16, 0.9), leather, T(-HW - 0.85, 0, 0, 0, -Math.PI / 2, 0)); }
  // the key: a polished dish notched at 3 o'clock for the finger tab, a turned inner ring, a black centre with a
  // glass-covered white/red crescent indicator, and the key's folding D-ring wing (503cx-10, a12/a06)
  const keyG = new THREE.Group(), tabG = new THREE.Group(), kk = new Kit(), tk = new Kit();
  keyG.position.set(-HW, KY.y, KY.z);
  const KX = T(-0.9, 0, 0, 0, -Math.PI / 2, 0), FACE = -1.86, flat = (geo, mat, x = FACE) => kk.add(geo, mat, T(x, 0, 0, 0, -Math.PI / 2, 0));
  // Outer chrome bezel ring with a cutout notch at 3 o'clock (rear, phi = +90°) where the folding key tab sits
  kk.add(revolve([[15.6, -0.3, 0], [15.6, 0.5, 0.6], [15.25, 0.95, 0.9], [14.0, 1.0, 0.3], [13.85, 0.85, 0]], { segs: 96, phi0: 102 * DEG, phiLen: 336 * DEG, crease: 30 }), bright, KX);
  kk.add(revolve([[13.85, 0.8, 0], [13.6, 0.8, 0]], { segs: 96 }), satinBlack, KX);
  // the turned face: a full ring inside the groove (r 7.35–9.3) and, outside it, the half-ring toward the front; the
  // other half-ring is the wing (below)
  const RG = 9.3, RO = 13.6, WX = -2.0, yG = Math.sqrt(RG * RG - WX * WX), yO = Math.sqrt(RO * RO - WX * WX);
  const aG = Math.atan2(yG, WX), aO = Math.atan2(yO, WX);
  const halfRing = (rear) => {   // the band RG–RO on one side of the hinge line z = WX (shape x = z, shape y = y)
    const sh = new THREE.Shape();
    sh.moveTo(WX, yO);
    if (rear) { sh.absarc(0, 0, RO, aO, -aO, true); sh.lineTo(WX, -yG); sh.absarc(0, 0, RG, -aG, aG, false); }
    else { sh.absarc(0, 0, RO, aO, TAU - aO, false); sh.lineTo(WX, -yG); sh.absarc(0, 0, RG, TAU - aG, aG, true); }
    sh.closePath();
    return sh;
  };
  kk.add(revolve([[RG, 0.85, 0], [RG - 0.15, 0.95, 0.3], [7.6, 0.95, 0.2], [7.35, 0.8, 0]], { segs: 96 }), lib.get('turned'), KX);
  flat(new THREE.ShapeGeometry(halfRing(false), 24), lib.get('turned'));
  // the wing's seat, seen when it stands: black anodised metal, just proud of the end plate's leatherette (whose face
  // is at −1.65 here), under the wing's 0.9 mm plate (hidden while the wing rests flush)
  const keySeat = new THREE.Mesh(prep(new THREE.ShapeGeometry(halfRing(true), 24)), anod);
  keySeat.position.x = -1.69; keySeat.rotation.y = -Math.PI / 2; keySeat.visible = false;
  keyG.add(keySeat);
  { // the wing's groove, a 0.35 mm line: down from the bezel's groove, round the rear at r 9.3, back out
    const X = WX, yA = yG, a0 = aG, pts = [[X, RO], [X, yA]];
    for (let i = 1; i < 48; i++) { const a = a0 - (2 * a0) * i / 48; pts.push([RG * Math.cos(a), RG * Math.sin(a)]); }
    pts.push([X, -yA], [X, -13.6]);
    const sh = new THREE.Shape(), L = [], Rr = [], w = 0.18;
    pts.forEach((p, i) => {
      const q = pts[Math.min(i + 1, pts.length - 1)], o = pts[Math.max(i - 1, 0)], dx = q[0] - o[0], dy = q[1] - o[1], l = Math.hypot(dx, dy) || 1;
      L.push([p[0] - dy / l * w, p[1] + dx / l * w]); Rr.push([p[0] + dy / l * w, p[1] - dx / l * w]);
    });
    L.forEach(([x, y], i) => (i ? sh.lineTo(x, y) : sh.moveTo(x, y))); Rr.reverse().forEach(([x, y]) => sh.lineTo(x, y));
    flat(new THREE.ShapeGeometry(sh, 2), satinBlack, FACE - 0.03);
  }
  flat(new THREE.CircleGeometry(7.35, 48), satinBlack, -1.80);
  // the exposure window: an arc band about the centre, round-ended, with recessed dark rim & windowGlass cover
  const ARC = { c: -0.3, r: 4.7, w: 0.85, a: 52 * Math.PI / 180 };
  const arcBand = (a0, a1, wMul = 1) => {
    const sh = new THREE.Shape(), n = 28, w = ARC.w * wMul, P = (a, rr) => [ARC.c + rr * Math.cos(a), rr * Math.sin(a)];
    for (let i = 0; i <= n; i++) { const [x, y] = P(a0 + (a1 - a0) * i / n, ARC.r + w); i ? sh.lineTo(x, y) : sh.moveTo(x, y); }
    { const [cx, cy] = P(a1, ARC.r); sh.absarc(cx, cy, w, a1, a1 + Math.PI * Math.sign(a1 - a0 || 1), a1 < a0); }
    for (let i = n; i >= 0; i--) { const [x, y] = P(a0 + (a1 - a0) * i / n, ARC.r - w); sh.lineTo(x, y); }
    { const [cx, cy] = P(a0, ARC.r); sh.absarc(cx, cy, w, a0 + Math.PI * Math.sign(a1 - a0 || 1), a0, a1 < a0); }
    return new THREE.ShapeGeometry(sh, 8);
  };
  flat(arcBand(ARC.a + 0.04, -ARC.a - 0.04, 1.22), flock, -1.81);
  flat(arcBand(ARC.a, -ARC.a), lib.get('white'), -1.82);
  flat(arcBand(ARC.a, -ARC.a), lib.get('windowGlass'), -1.86);
  const smile = new THREE.Mesh(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([], 3)), lib.get('red'));
  smile.position.set(-1.84, 0, 0); smile.rotation.y = -Math.PI / 2;
  smile.userData.k = -1; smile.visible = false;
  smile.userData.set = (k) => {   // k: the fraction of the roll's exposures taken; red grows from the top end
    k = Math.max(0, Math.min(1, k));
    if (Math.abs(k - smile.userData.k) < 1e-3) return;
    smile.userData.k = k; smile.visible = k > 0.01;
    if (!smile.visible) return;
    smile.geometry.dispose(); smile.geometry = prep(arcBand(ARC.a, ARC.a - 2 * ARC.a * k));
  };
  // the wing: the rear half-ring as a 0.9 mm plate whose face sits flush with the turned face, and its tab at three
  // o'clock through the bezel's notch, one piece; hinged on the line across the dish's middle (z = WX, at the plate's
  // back), it flips out to stand square to the dish
  const WT = 0.9;
  tabG.position.set(FACE + WT, 0, WX);
  tk.add(slab(halfRing(true), WT, 0.25, 24, 0.9), lib.get('turned'), T(0, 0, -WX, 0, -Math.PI / 2, 0));
  tk.add(rbox(1.2, 6.0, 4.4, 0.6, 2, 0.9), lib.get('turned'), T(-0.85 - FACE - WT - 0.75, 0, 12.1 - WX + 2.6));   // (6 tall, standing ~1.3 past the bezel)
  kk.build(keyG); tk.build(tabG); keyG.add(tabG, smile); ins.add(keyG);
  // (Only seen with the insert drawn out, taken apart or cut away — built lazily on first reveal)
  const inner = new THREE.Group(); inner.visible = false; ins.add(inner);
  const SPY = 31, SPZ = 30, ROL = { y: 34.6, z: 7.3, r: 3 }, FZ = 4.2, IDX_Y = -SPY;
  const film = { SPY, SPZ, ROL, FZ, IDX_Y, LEAD: 400 };
  let innerBuilt = false;
  const ensureInner = () => {
    if (innerBuilt) return false;
    innerBuilt = true;
    const nk = new Kit(), steel = lib.get('steel');
    const FAR = 35;   // the far plate's inner face (the spools' far ends sit at x ±32.9)
    nk.add(rbox(76, 66, 3.0, 0.8, 2, 0.6), anod, T(-2.5, 0, 6.9));                              // support: front plate
    nk.add(rbox(76, 17, 36, 1.2, 2, 0.6), anod, T(-2.5, 0, 8.4 + 18));                          // support: central web
    [-1, 1].forEach((sy) => {
      nk.add(revolve([[ROL.r, -32.4, 0.3], [ROL.r, 32.4, 0.3]], { segs: 28 }), satinBlack, T(0, sy * ROL.y, ROL.z, 0, Math.PI / 2, 0));   // rollers
      nk.add(revolve([[1.2, -40.5], [1.2, FAR]], { segs: 12 }), steel, T(0, sy * ROL.y, ROL.z, 0, Math.PI / 2, 0));                          // their journals
      nk.add(revolve([[4.2, -41.6], [4.2, -34.6, 0.3], [2.4, -34.6], [2.4, -33.0]], { segs: 32 }), anod, T(0, sy * SPY, SPZ, 0, Math.PI / 2, 0));   // hubs at the key end
      nk.add(revolve([[2.4, 33.0], [2.4, 34.0], [3.6, 34.0, 0.3], [3.6, FAR]], { segs: 32 }), steel, T(0, sy * SPY, SPZ, 0, Math.PI / 2, 0));     // spool centres, far end
    });
    // the far end plate, satin steel: notched at the rear between the spools
    { const fp = new THREE.Shape();
      fp.moveTo(4.2, -40.5); fp.lineTo(44, -40.5); fp.lineTo(44, -14); fp.absarc(44, 0, 14, -Math.PI / 2, Math.PI / 2, true); fp.lineTo(44, 40.5); fp.lineTo(4.2, 40.5); fp.lineTo(4.2, -40.5);
      // (laid out in z–y; turned so the shape's x runs along z and its thickness toward −x, from FAR + 1.4 to FAR)
      const sl = slab(fp, 1.4, 0.35, 16, 0.6); sl.rotateY(-Math.PI / 2); nk.add(sl, steel, T(FAR + 1.4, 0, 0));
    }
    // the spool clamp bar along the spool axes, and its splined knob on the take-up's axis
    nk.add(rbox(1.2, 2 * SPY + 9, 8.5, 0.5, 2, 0.8), steel, T(FAR + 2.0, 0, SPZ));
    const knob = new THREE.Group(); knob.position.set(FAR + 2.6, SPY, SPZ);
    { const kk2 = new Kit(); kk2.add(revolve([[2.2, -0.2], [2.2, 0.4], [4.6, 0.6, 0.3], [4.6, 3.4, 0.3, 1], [4.0, 3.9, 0.4], [0, 4.0]], { segs: 48 }), lib.get('steelKnurl'), T(0, 0, 0, 0, Math.PI / 2, 0)); kk2.build(knob); }
    inner.add(knob);
    // the bar's ends: a round cap over each spool centre; on the lower one, beside the supply roll, the red triangle the
    // paper's start arrow is wound round to (manual p. 19, fig. 6)
    [-1, 1].forEach((sy) => nk.add(revolve([[5.2, 0, 0.3], [5.2, 1.3, 0.4], [0, 1.4]], { segs: 40 }), steel, T(FAR + 2.4, sy * SPY, SPZ, 0, Math.PI / 2, 0)));
    { const tri = new THREE.Shape(); tri.moveTo(0, 1.9); tri.lineTo(-1.4, -0.9); tri.lineTo(1.4, -0.9); tri.lineTo(0, 1.9);
      nk.add(new THREE.ShapeGeometry(tri), lib.get('red'), T(FAR + 3.82, -SPY, SPZ + 2.6, 0, Math.PI / 2, 0).multiply(T(0, 0, 0, 0, 0, -Math.PI / 2))); }
    // the name plate on the web's back, and the holder's number at its end
    nk.add(rbox(68, 12, 0.6, 0.3, 1), satinBlack, T(-2, 0, 44.6));
    nk.add(decalUV(new THREE.PlaneGeometry(36, 3.0), D.chamfer), lib.get('inkWhite'), T(-8, 0, 44.95));
    nk.add(decalUV(new THREE.PlaneGeometry(9, 4.5), D.insertNum), lib.get('inkWhite'), T(28, 0, 44.97));
    nk.build(inner);
    // the pressure plate: black, its face dimpled all over (a fine grid of small domes)
    const dimCv = document.createElement('canvas'); dimCv.width = dimCv.height = 32;
    { const dg = dimCv.getContext('2d'), gr = dg.createRadialGradient(16, 16, 1, 16, 16, 11); gr.addColorStop(0, '#fff'); gr.addColorStop(1, '#000');
      dg.fillStyle = '#000'; dg.fillRect(0, 0, 32, 32); dg.fillStyle = gr; dg.beginPath(); dg.arc(16, 16, 11, 0, TAU); dg.fill(); }
    const dimTex = new THREE.CanvasTexture(dimCv); dimTex.wrapS = dimTex.wrapT = THREE.RepeatWrapping; dimTex.repeat.set(42, 43);
    { const m = new THREE.Mesh(prep(new THREE.PlaneGeometry(60, 62)), lib.prepare(new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.55, bumpMap: dimTex, bumpScale: 1.4 }), { clip: true }));
      m.position.set(0, 0, 5.3); m.rotation.y = Math.PI; inner.add(m); }
    // the film clamp's lip: a thin steel bar in front of the film across the foot of the pressure plate
    const clamp = new THREE.Group(); clamp.position.set(0, -31.0, FZ - 0.5);
    { const ck = new Kit(); ck.add(rbox(60, 1.8, 0.5, 0.2, 1, 0.5), steel, T(0, 0, 0)); [-1, 1].forEach((sx) => ck.add(rbox(2.2, 4.4, 2.6, 0.5, 2, 0.6), steel, T(sx * 31.4, -1.2, 1.1))); ck.build(clamp); }
    inner.add(clamp);
    // the film: three spools (two in the holder, the third coming or going while you load), the web between them
    const filmMats = {
      plastic: lib.prepare(new THREE.MeshStandardMaterial({ color: 0x0e0e0f, roughness: 0.42 }), { clip: true }),
      slot: lib.prepare(new THREE.MeshStandardMaterial({ color: 0x030303, roughness: 0.9 }), { clip: true }),
      rollOpen: null, rollSealed: null, edge: lib.prepare(new THREE.MeshStandardMaterial({ color: 0x9a948a, roughness: 0.85 }), { clip: true }),
    };
    const rollCvs = [0, 1].map(() => { const c = document.createElement('canvas'); c.width = 512; c.height = 256; return c; });
    const rollTexs = rollCvs.map((c) => { const x = new THREE.CanvasTexture(c); x.colorSpace = THREE.SRGBColorSpace; x.anisotropy = 4; return x; });
    filmMats.rollOpen = lib.prepare(new THREE.MeshStandardMaterial({ map: rollTexs[0], roughness: 0.72 }), { clip: true });
    filmMats.rollSealed = lib.prepare(new THREE.MeshStandardMaterial({ map: rollTexs[1], roughness: 0.72 }), { clip: true });
    const spools = [0, 1, 2].map(() => { const s = buildSpool(lib, filmMats); inner.add(s); return s; });
    const leadCv = document.createElement('canvas'); leadCv.width = 1024; leadCv.height = 128;
    const leadTex = new THREE.CanvasTexture(leadCv); leadTex.colorSpace = THREE.SRGBColorSpace; leadTex.wrapS = THREE.RepeatWrapping; leadTex.anisotropy = 4;
    const paperMat = lib.prepare(new THREE.MeshStandardMaterial({ map: leadTex, roughness: 0.7, alphaTest: 0.5 }), { clip: true });
    const paperBack = lib.prepare(new THREE.MeshStandardMaterial({ color: 0x0c0c0c, roughness: 0.8, side: THREE.BackSide }), { clip: true });
    const filmMat = lib.prepare(new THREE.MeshStandardMaterial({ color: 0x3a2f33, roughness: 0.3, side: THREE.DoubleSide }), { clip: true });
    const web = new THREE.Mesh(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([], 3)), paperMat), webBack = new THREE.Mesh(web.geometry, paperBack);
    web.add(webBack); web.visible = false;
    inner.add(web);
    const arrow = new THREE.Group();
    { const sh = new THREE.Shape(); sh.moveTo(26, 0); sh.lineTo(19, 3.6); sh.lineTo(19, 1.3); sh.lineTo(4, 1.3); sh.lineTo(4, -1.3); sh.lineTo(19, -1.3); sh.lineTo(19, -3.6); sh.lineTo(26, 0);
      const m = new THREE.Mesh(prep(new THREE.ShapeGeometry(sh)), lib.prepare(new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2 }), { clip: true }));
      m.name = 'arrowMark'; arrow.add(m); }
    web.visible = webBack.visible = arrow.visible = false;
    Object.assign(film, { spools, web, webBack, knob, arrow, paperMat, filmMat, rollCvs, rollTexs, leadCv, leadTex, clamp });
    return true;
  };
  ins.add(inner);
  ik.build(ins);
  g.add(ins);
  // the catch (manual p. 4, #32): a polished plate set in the top at the front edge, its round button a black disc
  // printed "12" in a turned ring — press it to tip the magazine back off
  const CC = { z: 7.1 };
  // (the tongue: shape y runs to −z under this rotation, so −13.8…0.4 lands on the magazine, front edge to 13.8 back)
  kit.add(slab(rrPath(-10.2, -13.8, 10.2, 0.4, 2.6), 1.1, 0.45, 12, 0.7), bright, T(0, H + 0.15, 0, -Math.PI / 2, 0, 0));
  kit.add(revolve([[5.9, -0.2, 0], [5.9, 0.7, 0.6], [5.4, 1.3, 0.9], [4.6, 1.35, 0.5], [4.3, 1.0, 0]], { segs: 64 }), bright, T(0, H + 1.2, CC.z, -Math.PI / 2, 0, 0));
  kit.add(new THREE.CircleGeometry(4.3, 40), satinBlack, T(0, H + 2.25, CC.z, -Math.PI / 2, 0, 0));
  kit.add(new THREE.RingGeometry(3.4, 3.7, 48), lib.get('inkWhite'), T(0, H + 2.27, CC.z, -Math.PI / 2, 0, 0));
  kit.add(decalUV(new THREE.PlaneGeometry(4.8, 2.4), D.twelve), lib.get('inkWhite'), T(0, H + 2.28, CC.z, -Math.PI / 2, 0, Math.PI / 2));
  kit.build(g);
  // dark slide: 0.3 mm spring steel; built lazily when inserted/exploded
  const slide = new THREE.Group();
  slide.position.set(0, 0, 1.6);
  slide.visible = false;
  g.add(slide);
  let slideBuilt = false;
  const ensureSlide = () => {
    if (slideBuilt) return false;
    slideBuilt = true;
    const dk = new Kit();
    dk.add(rbox(82, 86, 0.4, 0.18, 1), lib.get('steel'), T(0, 0, 0));
    {
      const loop = new THREE.CurvePath(), v = (y, z) => new THREE.Vector3(0, y, z), r = 3.0, Y = 27.8, Z0 = -8.6, Z1 = 0.0, YC = -2.0;
      loop.add(new THREE.QuadraticBezierCurve3(v(-Y + r, Z0), v(0, Z0 + 0.85), v(Y - r, Z0)));
      loop.add(new THREE.QuadraticBezierCurve3(v(Y - r, Z0), v(Y, Z0), v(Y, Z0 + r)));
      loop.add(new THREE.LineCurve3(v(Y, Z0 + r), v(Y, Z1 - r)));
      loop.add(new THREE.QuadraticBezierCurve3(v(Y, Z1 - r), v(Y, Z1), v(Y - r, Z1)));
      loop.add(new THREE.LineCurve3(v(Y - r, Z1), v(-Y + r, Z1)));
      loop.add(new THREE.QuadraticBezierCurve3(v(-Y + r, Z1), v(-Y, Z1), v(-Y, Z1 - r)));
      loop.add(new THREE.LineCurve3(v(-Y, Z1 - r), v(-Y, Z0 + r)));
      loop.add(new THREE.QuadraticBezierCurve3(v(-Y, Z0 + r), v(-Y, Z0), v(-Y + r, Z0)));
      dk.add(new THREE.TubeGeometry(loop, 240, 0.6, 12, true), bright, T(-41.7, YC, 0));
      dk.add(rbox(1.0, 2 * Y, 3.2, 0.3, 1), lib.get('steel'), T(-41.3, YC, 0.4));
      for (let i = 0; i < 7; i++) dk.add(revolve([[0.2, -Y + 0.8], [0.2, Y - 0.8]], { segs: 8 }), lib.get('steel'), T(-41.82, YC, -1.0 + i * 0.45, Math.PI / 2, 0, 0));
    }
    dk.add(revolve([[1.2, -38], [1.2, 38]], { segs: 12, phi0: Math.PI, phiLen: Math.PI / 2 }), lib.get('steel'), T(-45, 0, 1.2, Math.PI / 2, 0, 0));
    dk.build(slide);
    return true;
  };
  return { group: g, slide, ensureSlide, insert: ins, insertInner: inner, ensureInner, innerReady: () => innerBuilt, frontFace, ensureFrontFace, keyG, tabG, keySeat, magCrank, magCrankArm, magCrankDot, smile, film, cardCv, cardTex, isoCv, isoTex, ctrCv, ctrTex, signal, marks: { CR, CT, SG, BD, KY, H, d } };
}

// ───────── Waist-level finder ─────────
function buildFinder(lib, hov) {
  const g = new THREE.Group();
  g.name = 'finder';
  const H = { hover: hov.finder };
  const anod = lib.get('anod', H), flock = lib.get('flock', H), leather = lib.get('leather', H), bright = lib.get('chromeBright', H), chrome = lib.get('chrome', H);
  const w = DIM.finder.w, d = DIM.finder.d;
  // (the lid 68 wide over a 71.4 base, from just behind the base's front edge to its rear; walls and hinge follow)
  const wallH = 56, baseH = 8, hingeY = 13, lidW = 68.2, lidLen = d - 1.6, hx = lidW / 2 - 1.6;
  // base frame: slides into the body's rails; chrome runners along its lower edges
  const bk = new Kit(), rkRails = new Kit(), rails = new THREE.Group(); rails.visible = false;
  const base = rrPath(-w / 2, -d / 2, w / 2, d / 2, 2.5); base.holes.push(rrPath(-29.4, -28.8, 29.4, 28.8, 1.5, new THREE.Path()));
  bk.add(slab(base, baseH, 0.6, 12, 0.8), anod, T(0, 0, 0, -Math.PI / 2, 0, 0));
  [-1, 1].forEach((sx) => rkRails.add(rbox(1.6, 2.2, d - 4, 0.5, 2, 0.8), chrome, T(sx * (w / 2 - 0.2), 1.3, 0)));
  bk.add(rbox(w, hingeY - baseH + 0.4, 2.0, 0.6, 2, 0.8), anod, T(0, (baseH + hingeY) / 2 - 0.2, -d / 2 + 1.0));
  const scr = new Kit();
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b], i) => addScrew(bk, bright, scr, flock, T(a * (w / 2 - 4.7), baseH + 0.02, b * (d / 2 - 2.7), -Math.PI / 2, 0, 0), 1.05, true, i * 0.8));
  const baseFlock = scr.build(g, 'finder');
  const meshes = [...bk.build(g, 'finder'), ...rkRails.build(rails, 'finder')];
  g.add(rails);
  // lid: hinged at the front edge, lifted by a tab at its rear edge; leatherette top
  const lid = new THREE.Group(); lid.position.set(0, hingeY, -d / 2);
  const lk = new Kit();
  const lidUp = T(0, 0, 0, Math.PI / 2, 0, 0);
  lk.add(slab(rrPath(-lidW / 2, 0.2, lidW / 2, lidLen, 2.5), 1.2, 0.45, 12, 0.9), bright, lidUp.clone().multiply(T(0, 0, -1.2)));
  lk.add(slab(rrPath(-lidW / 2 + 1.6, 1.8, lidW / 2 - 1.6, lidLen - 1.6, 1.6), 0.8, 0.28, 12, 0.9), leather, T(0, 1.2, 0, Math.PI / 2, 0, 0).multiply(T(0, 0, -0.8)));
  [-1, 1].forEach((sx) => lk.add(rbox(1.1, 3.4, lidLen - 3.5, 0.45, 2, 0.8), bright, T(sx * (lidW / 2 - 0.55), -1.4, lidLen / 2 + 1.2)));
  lk.add(rbox(lidW - 2, 3.4, 1.1, 0.45, 2, 0.8), bright, T(0, -1.4, lidLen - 0.55));
  {
    // the raised inner panel: straight front edge, its long sides drawing in and flaring out to the rear edge
    const z0 = lidLen * 0.165, z1 = lidLen - 1.2, a = lidW * 0.255, b = lidW * 0.19;
    // (sides parallel for three quarters of its length, then drawing in to meet the rear edge either side of the catch)
    const zs = lidLen * 0.78;
    const P = (o) => { const s = new THREE.Shape(); s.moveTo(-a - o + 3, z0 - o); s.lineTo(a + o - 3, z0 - o); s.quadraticCurveTo(a + o, z0 - o, a + o, z0 - o + 3);
      s.lineTo(a + o, zs); s.bezierCurveTo(a + o, zs + 5, b + o, z1 - 4, b + o, z1 + o); s.lineTo(-b - o, z1 + o);
      s.bezierCurveTo(-b - o, z1 - 4, -a - o, zs + 5, -a - o, zs); s.lineTo(-a - o, z0 - o + 3); s.quadraticCurveTo(-a - o, z0 - o, -a - o + 3, z0 - o); return s; };
    // (the lid's top is y 2.0: the outline stands to 2.6, the panel's leatherette to 2.75)
    lk.add(slab(P(1.7), 1.1, 0.5, 24, 0.7), bright, lidUp.clone().multiply(T(0, 0, -2.6)));   // (a round polished bead ~2 mm wide, KEH and the CF 80 kit)
    lk.add(slab(P(0), 0.8, 0.25, 24, 0.9), leather, lidUp.clone().multiply(T(0, 0, -2.75)));
    // the black catch at the rear edge, in the panel's mouth
    // (its tail stands a little proud of the rear edge, tipped up for a fingernail — KEH top view, Commons 07)
    lk.add(rbox(lidW * 0.36, 1.4, 11.2, 0.5, 2, 0.8), lib.get('satinBlack', H), T(0, 3.0, lidLen - 4.0, -0.22, 0, 0));
  }
  // hinge: internal pin tucked under the front lip
  lk.add(revolve([[0.75, -hx], [0.75, hx]], { segs: 16 }), anod, T(0, -0.35, 0.6, 0, Math.PI / 2, 0));
  lk.add(new THREE.PlaneGeometry(lidW - 4, lidLen - 4), flock, T(0, -0.05, lidLen / 2 + 1, Math.PI / 2, 0, 0));
  const oval = new THREE.Shape(); oval.absellipse(0, 0, 1.5, 3.2, 0, TAU, false);
  lk.add(slab(oval, 1.1, 0.4, 16, 0.9), bright, T(lidW / 2 - 4.4, -0.05, lidLen * 0.57, Math.PI / 2, 0, 0));
  const lidMeshes = lk.build(lid, 'finder');
  meshes.push(...lidMeshes);
  // 4.5× magnifier: stowed under the lid, flips out over the screen near the top of the hood
  const mag = new THREE.Group(); mag.position.set(0, -0.4, lidLen - 9);
  const mk = new Kit();
  const mf = rrPath(-26.5, -50.2, 26.5, -0.5, 3); mf.holes.push(new THREE.Path().absarc(0, -26, 22.2, 0, TAU, true));
  mk.add(slab(mf, 1.6, 0.45, 40, 0.7), anod, T(0, 0, 0, Math.PI / 2, 0, 0));
  mk.add(revolve([[22.25, 0.0, 0.5], [22.25, -1.6, 0.5]], { segs: 96 }), bright, T(0, 0, -26, -Math.PI / 2, 0, 0));
  [-1, 1].forEach((sx) => mk.add(rbox(3.2, 3.2, 6, 1.1, 2, 0.6), anod, T(sx * 23.5, -0.8, -2.5)));
  mk.add(rbox(10, 1.0, 3.0, 0.45, 2, 1), bright, T(0, -1.4, -51.2));
  mk.build(mag, 'finder');
  // the lens: a faint reflective surface over an image disc that shows what the magnifier shows (the disc shares the
  // ground-glass material; in the top-down view the lens view renders the magnified centre of the screen into it).
  // Refraction through a transmission material only blurred a low-resolution copy of the screen.
  const magGlass = new THREE.Mesh(prep(revolve([[0, -1.1], [21.6, -1.1], [21.6, 0.2], [17, 0.9], [9.5, 1.5], [0, 1.7]], { segs: 72, crease: 40 })),
    lib.prepare(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.1, depthWrite: false }), { clip: false }));
  magGlass.material.userData.single = true;
  magGlass.rotation.x = -Math.PI / 2; magGlass.position.set(0, -1.0, -26);
  mag.add(magGlass);
  const magView = new THREE.Mesh(new THREE.CircleGeometry(21.4, 72), new THREE.MeshBasicMaterial({ color: 0x111111 }));
  magView.position.set(0, 0, 1.45);   // revolve() turns its profile about local z: the lens axis
  // (its texture coordinates are aligned to the screen's once the magnifier is up — alignMagnifier())
  magView.userData.noShadow = true;
  magGlass.add(magView);
  lid.add(mag);
  // walls: rear (smooth matte anodized with stiffening rib) and sides (smooth perimeter frame around recessed
  // waffle-dimpled panel, plus 3-knuckle vertical piano hinge down the centre fold — 503cx-09, 503cx-17, SPEC §6)
  const hoodWall = lib.get('hoodWall', H);
  const rear = new THREE.Group(); rear.position.set(0, baseH, d / 2 - 1.4);
  const rk = new Kit();
  const rw = w / 2 - 4.2;
  rk.add(slab(rrPath(-rw, 0, rw, wallH, 2), 0.9, 0.3, 8, 0.8), anod, T(0, 0, -0.45));
  rk.add(rbox(2 * rw - 5, 0.8, 0.35, 0.2, 1, 0.6), anod, T(0, wallH - 4.5, 0.48));
  rk.add(revolve([[0.75, -rw + 1, 0.6], [0.75, rw - 1, 0.6]], { segs: 12 }), anod, T(0, wallH - 0.5, 0, 0, Math.PI / 2, 0));
  rk.add(new THREE.PlaneGeometry(2 * rw - 2, wallH - 3), flock, T(0, wallH / 2, -0.5, 0, Math.PI, 0));
  meshes.push(...rk.build(rear, 'finder'));
  const side = (sx) => {
    const grp = new THREE.Group(); grp.position.set(sx * (w / 2 - 1.2), baseH, 0);
    const halves = [-1, 1].map((sz) => {
      const h = new THREE.Group();
      const k = new Kit();
      const len = (d - 3.8) / 2;
      const z0 = sz > 0 ? 0.3 : -len, z1 = sz > 0 ? len : -0.3;
      const rotSide = T(0, 0, 0, 0, sx > 0 ? -Math.PI / 2 : Math.PI / 2, 0);
      // Smooth black anodized perimeter leaf + inset waffle-dimpled outer panel
      k.add(slab(rrPath(z0, 0, z1, wallH - 1.5, 1.6), 0.78, 0.28, 8, 0.8), anod, rotSide.clone().multiply(T(0, 0, -0.45)));
      const waf = boxUV(slab(rrPath(z0 + 1.8, 2.0, z1 - 1.8, wallH - 4.0, 0.9), 0.28, 0.1, 6, 0.5));
      k.add(waf, hoodWall, rotSide.clone().multiply(T(0, 0, sx > 0 ? -0.52 : 0.28)));
      k.add(revolve([[0.7, 0.4, 0.6], [0.7, len - 0.4, 0.6]], { segs: 12 }), anod, T(0, wallH - 2.1, 0, sz > 0 ? 0 : Math.PI, 0, 0));
      k.add(new THREE.PlaneGeometry(len - 1, wallH - 4), flock, T(-sx * 0.5, wallH / 2, sz * len / 2, 0, -sx * Math.PI / 2, 0));
      meshes.push(...k.build(h, 'finder'));
      grp.add(h);
      return h;
    });
    // 3-knuckle vertical piano hinge along the centre fold crease between the front & back half-leaves (503cx-09, 503cx-17)
    const hk = new Kit();
    [10, 26.5, 43].forEach((hy) => hk.add(revolve([[0.68, -2.8, 0.5], [0.68, 2.8, 0.5]], { segs: 14 }), anod, T(sx * 0.15, hy, 0, Math.PI / 2, 0, 0)));
    meshes.push(...hk.build(grp, 'finder'));
    g.add(grp);
    return { grp, front: halves[0], back: halves[1] };
  };
  const left = side(-1), right = side(1);
  g.add(lid, rear);
  const innerFlock = [
    ...baseFlock,
    ...lidMeshes.filter((m) => m.isMesh && m.material === anod),
    ...[lid, rear, left.front, left.back, right.front, right.back].flatMap((p) => p.children.filter((m) => m.isMesh && m.material === flock)),
  ];
  return { group: g, lid, rear, left, right, mag, magGlass, magView, rails, meshes, innerFlock };
}

// ───────── CF lenses ─────────
// Every CF barrel shares one shutter/focusing unit. Its stations are measured off the dimension
// drawings in the Zeiss/Hasselblad CF lens datasheets (mm forward of the flange, 74.9 to film):
//   collar  fixed mount collar (lens index dot)
//   helic   longer lenses: a raised rim and a plain helicoid band at the rear of the focusing ring
//   grip    checkered focusing grip          scale  distance-scale band (metres white, feet orange)
//   big     500 only: the foot section between focusing ring and shutter
//   fixed   fixed ring: depth-of-field scale, central index, IR index; flash terminal and the
//           depth-of-field preview tab on the left
//   ap      recessed aperture ring (EV cross-coupling button on the right, finger lug underneath)
//   spd     speed-ring scale band (speeds, then the orange EV numerals)   ribs  its ribbed grip
// In front of that unit each lens has its own optics housing:
//   tube      plain B60 tube / front ring (60, 80, 100, 120, 150, 180, 250)
//   fle       plain band, checkered floating-element ring, front tube (50) or, on the 40, a cone
//             out to the Ø90 B93 front mount
//   fisheye   knurled removable front component (its filters sit in its rear), Ø110 hood with
//             four notches cut at the diagonals
//   long      slim tube, cone and a two-section Ø90 shade (the 500), quick-coupling foot under
//             the foot section
const LENS_DEFS = {
  'zeiss-distagon-3.5-30': { L: 113.4, collar: 9.9,  helic: 11.3, grip: 14.8, gripRows: 8,  gripR: 41.0,  scale: 9.3,  fixed: 7.6, ap: 5.6, spd: 4.9, ribs: 5.8, optics: 30,  front: 'fisheye', frontR: 54.5, glassR: 34.0, rearR: 12.2, rearType: 'wide',   sn: '7194022' },
  'zeiss-distagon-4-40': { L: 95.2,  collar: 14.5, grip: 11.0,  gripRows: 6,  gripR: 41.25, scale: 6.9,  fixed: 8.5, ap: 5.5, spd: 3.8, ribs: 7.1, optics: 40,  front: 'fle',     tubeR: 36.2, flePlain: 7.4, fleLen: 11.6, fleRows: 4, fleR: 38.5, cone: [77.3, 86.9], frontR: 45.0, glassR: 36.0, clearR: 35.0, aIn: 38.4, deep: 1.6, rc: 1.6,  rearR: 12.2, rearType: 'wide',   sn: '7412890', fle: [[Infinity, '∞'], [2, '2'], [0.9, '0,9'], [0.5, '0,5m']] },
  'zeiss-distagon-4-50': { L: 88.8,  collar: 8.8,  grip: 10.6,  gripRows: 6,  gripR: 41.25, scale: 7.4,  fixed: 8.5, ap: 6.0, spd: 4.6, ribs: 6.5, optics: 50,  front: 'fle',     tubeR: 35.8, flePlain: 7.6, fleLen: 11.1, fleRows: 4, fleR: 38.0, frontR: 35.8, glassR: 28.5, clearR: 25.0, aIn: 26.8, deep: 1.0, rc: 1.45, rearR: 12.5, rearType: 'wide',   sn: '7434016', fle: [[Infinity, '∞'], [4, '4'], [1.2, '1,2'], [0.8, '0,8'], [0.5, '0,5m']] },
  'zeiss-distagon-3.5-60': { L: 76.5,  collar: 9.8,  grip: 10.5,  gripRows: 6,  gripR: 41.25, scale: 7.0,  fixed: 8.7, ap: 6.0, spd: 3.6, ribs: 7.0, optics: 60,  front: 'tube',    frontR: 36.3, glassR: 28.0, clearR: 23.4, aIn: 26.6, deep: 2.4, rc: 1.9,  rearR: 13.0, rearType: 'wide',   sn: '7281405' },
  'zeiss-planar-2.8-80': { L: 58.6,  collar: 8.5,  grip: 10.4,  gripRows: 6,  gripR: 41.25, scale: 7.6,  fixed: 8.7, ap: 5.6, spd: 5.6, ribs: 5.8, optics: 80,  front: 'tube',    frontR: 36.4, glassR: 23.5, clearR: 18.0, aIn: 23.4, deep: 6.6, rc: 2.4,  rearR: 14.4, rearType: 'planar', sn: '7387091' },
  'zeiss-planar-3.5-100': { L: 69.5,  collar: 9.6,  helic: 10.8, grip: 10.3, gripRows: 6,  gripR: 40.75, scale: 7.8,  fixed: 8.5, ap: 6.0, spd: 4.4, ribs: 5.1, optics: 100, front: 'tube',    frontR: 36.4, glassR: 23.0, clearR: 17.0, aIn: 23.2, deep: 6.8, rc: 2.4,  rearR: 13.8, rearType: 'planar', sn: '7351908' },
  'zeiss-makro-planar-4-120': { L: 93.1,  collar: 10.6, helic: 11.1, grip: 28.3, gripRows: 16, gripR: 40.75, scale: 12.3, fixed: 7.9, ap: 6.0, spd: 3.8, ribs: 5.7, optics: 120, front: 'tube',    frontR: 36.4, glassR: 23.0, makro: true, clearR: 16.0, aIn: 23.2, deep: 7.2, rc: 2.6, rearR: 12.6, rearType: 'tele', sn: '7408312' },
  'zeiss-sonnar-4-150': { L: 94.7,  collar: 9.7,  helic: 11.5, grip: 23.0, gripRows: 14, gripR: 40.75, scale: 9.8,  fixed: 7.4, ap: 6.5, spd: 4.4, ribs: 5.9, optics: 150, front: 'tube',    frontR: 36.2, glassR: 25.0, clearR: 20.5, aIn: 23.6, deep: 5.2, rc: 2.6,  rearR: 13.2, rearType: 'tele',   sn: '7115715' },
  'zeiss-sonnar-4-180': { L: 125.7, collar: 11.4, helic: 10.8, grip: 28.4, gripRows: 16, gripR: 40.75, scale: 12.4, fixed: 7.7, ap: 6.0, spd: 3.8, ribs: 6.2, optics: 180, front: 'tube',    frontR: 36.2, glassR: 26.0, clearR: 23.0, aIn: 25.2, deep: 4.4, rc: 2.8,  rearR: 13.2, rearType: 'tele',   sn: '7462109' },
  'zeiss-sonnar-5.6-250': { L: 157.9, collar: 12.5, helic: 10.6, grip: 47.1, gripRows: 26, gripR: 40.75, scale: 9.5,  fixed: 8.0, ap: 5.8, spd: 3.7, ribs: 6.8, optics: 250, front: 'tube',    frontR: 36.9, glassR: 27.0, clearR: 23.5, aIn: 25.4, deep: 4.2, rc: 3.0,  rearR: 12.8, rearType: 'tele',   sn: '7189403' },
  'zeiss-tele-apotessar-8-500': { L: 321.0, collar: 14.0, helic: 10.4, grip: 48.4, gripRows: 27, gripR: 41.3,  scale: 9.4,  scaleR: 40.5, big: 42.8, fixed: 8.5, fixedR: 38.2, ap: 6.0, spd: 4.0, ribs: 7.1, optics: 500, front: 'long', tubeR: 35.5, cone: [253, 270], frontR: 45.0, glassR: 33.0, rearR: 12.6, rearType: 'tele', foot: true, sn: '7042188' },
};
/** A CF lens's geometry, by its id (cameras.js): only V-system lenses mount on the 503CX. */
function lensDef(lens) {
  const def = LENS_DEFS[lens.id];
  if (!def) throw new Error(`the 503CX has no geometry for lens ${lens.id}`);
  return def;
}
/** The front's filter bore (B60: Ø62; the 40's B93 front: just inside its lip) and the engraved annulus's inner edge. */
function frontBore(def) {
  const fR = def.frontR > 40 ? def.frontR - 1.6 : 31.0;
  return { fR, aIn: Math.min(fR - 4.2, def.aIn ?? def.glassR + 3.2) };   // (≥ 4.2 wide: room for its lettering)
}
/** Axial stations of the shared unit (z, negative forward of the flange). */
function lensStations(def) {
  let z = 0;
  const s = (len) => (z -= len || 0);
  return { zC: s(def.collar), zH: s(def.helic), zG: s(def.grip), zD: s(def.scale), zB: s(def.big), zFix: s(def.fixed), zAp: s(def.ap), zSp: s(def.spd), zSh: s(def.ribs) };
}

/**
 * Optical layouts for the cutaway across all 11 Carl Zeiss CF lenses
 * (per element: [t 0‥1 in group, radius factor, centre thickness mm, R1/r, R2/r, gapAfter?]).
 * Positive surface radius = convex toward front (-Z); gapAfter < 0.2 indicates a cemented doublet interface.
 */
const OPTICS = {
  // 30mm f/3.5 F-Distagon Fisheye: 8 elements in 7 groups (+ internal 26mm filter slot)
  30: {
    front: [[0.0, 1.0, 3.2, 1.35, -0.82], [0.26, 0.72, 2.8, 1.6, -0.92], [0.54, 0.56, 2.8, 2.2, -1.15], [0.80, 0.46, 6.2, 1.5, 3.2]],
    rear:  [[0.08, 0.62, 2.0, -1.4, -5.5, 0.08], [0.16, 0.66, 4.8, -5.5, 1.75], [0.56, 0.70, 3.8, 3.2, 1.85], [0.90, 0.72, 3.8, 4.8, 2.3]],
  },
  // 40mm f/4 Distagon FLE: 11 elements in 9 groups (floating front group + main group)
  40: {
    front: [[0.0, 1.0, 3.6, 1.45, -0.92], [0.18, 0.84, 2.4, 2.4, -1.05], [0.36, 0.74, 2.4, 3.0, -1.2], [0.54, 0.68, 4.6, 1.7, 4.2], [0.74, 0.62, 2.2, -2.5, 2.8], [0.90, 0.60, 3.8, 2.2, -3.6]],
    rear:  [[0.06, 0.62, 2.2, -1.8, 3.4], [0.26, 0.68, 1.8, -1.4, -5.5, 0.08], [0.34, 0.70, 4.6, -5.5, 1.7], [0.66, 0.74, 2.0, -3.2, -6.0, 0.08], [0.76, 0.76, 4.2, -6.0, 2.1]],
  },
  // 50mm f/4 Distagon FLE: 9 elements in 8 groups
  50: {
    front: [[0.0, 1.0, 3.8, 1.5, -0.95], [0.28, 0.80, 2.6, 2.8, -1.1], [0.56, 0.68, 5.4, 1.65, 3.8], [0.82, 0.62, 2.6, -2.4, 2.6]],
    rear:  [[0.06, 0.64, 4.0, 3.0, 1.85], [0.28, 0.68, 1.8, -1.35, -5.8, 0.08], [0.36, 0.70, 4.8, -5.8, 1.75], [0.66, 0.74, 2.2, -2.6, 4.2], [0.90, 0.76, 3.8, 5.5, 2.2]],
  },
  // 60mm f/3.5 Distagon: 7 elements in 7 groups
  60: {
    front: [[0.0, 1.0, 3.8, 1.55, -0.98], [0.36, 0.78, 3.0, 3.0, -1.12], [0.72, 0.64, 7.2, 1.6, 4.0]],
    rear:  [[0.06, 0.64, 2.2, -1.8, 3.2], [0.32, 0.68, 4.4, 3.2, -2.2], [0.62, 0.72, 2.4, -1.5, 4.5], [0.88, 0.78, 4.0, 5.2, -3.0]],
  },
  // 80mm f/2.8 Planar: 7 elements in 5 groups (classic Double-Gauss with cemented rear doublet)
  80: {
    front: [[0.0, 1.0, 3.2, 2.4, -3.0], [0.42, 0.88, 3.0, 2.3, -3.2], [0.78, 0.78, 1.6, 3.6, -2.5]],
    rear:  [[0.05, 0.82, 1.6, -2.4, 3.5, 0.08], [0.16, 0.86, 4.2, 3.5, 2.4], [0.58, 0.90, 3.8, -5.0, 2.4], [0.90, 0.92, 3.8, 3.6, -4.5]],
  },
  // 100mm f/3.5 Planar: 5 elements in 4 groups
  100: {
    front: [[0.0, 1.0, 3.6, 2.2, -3.4], [0.55, 0.84, 4.6, 1.9, -1.6]],
    rear:  [[0.10, 0.80, 1.8, -1.7, 3.6, 0.08], [0.22, 0.84, 4.6, 3.6, -2.6], [0.82, 0.88, 4.0, 4.2, -3.8]],
  },
  // 120mm f/4 Makro-Planar: 6 elements in 4 symmetric Double-Gauss groups (two cemented doublets)
  120: {
    front: [[0.0, 1.0, 3.2, 2.3, -3.5], [0.44, 0.86, 4.2, 2.1, -3.2, 0.08], [0.64, 0.80, 1.8, -3.2, 1.8]],
    rear:  [[0.08, 0.80, 1.8, -1.8, 3.2, 0.08], [0.20, 0.86, 4.2, 3.2, -2.1], [0.78, 0.90, 3.4, 3.5, -2.3]],
  },
  // 150mm f/4 Sonnar: 5 elements in 3 groups (front singlet, thick cemented doublet, rear meniscus + rear singlet)
  150: {
    front: [[0.0, 1.0, 6.2, 2.2, 12.0], [0.34, 0.92, 6.8, 2.4, -3.0, 0.08], [0.56, 0.86, 2.4, -3.0, -2.2]],
    rear:  [[0.22, 0.74, 2.6, -2.2, -7.5], [0.86, 0.78, 4.2, 9.5, 2.8]],
  },
  // 180mm f/4 Sonnar: 5 elements in 4 groups
  180: {
    front: [[0.0, 1.0, 6.8, 2.3, 10.0], [0.28, 0.90, 2.6, -3.2, 2.4], [0.58, 0.84, 5.8, 2.2, -3.4]],
    rear:  [[0.20, 0.74, 2.6, -2.0, -6.5], [0.78, 0.78, 4.4, 8.5, 2.8]],
  },
  // 250mm f/5.6 Sonnar: 4 elements in 3 groups (front singlet, cemented doublet, rear singlet)
  250: {
    front: [[0.0, 1.0, 6.4, 2.4, 14.0], [0.32, 0.92, 6.6, 2.5, -3.2, 0.08], [0.46, 0.88, 2.4, -3.2, -2.4]],
    rear:  [[0.62, 0.76, 4.2, 8.0, 2.9]],
  },
  // 500mm f/8 Tele-Apotessar: 4 elements in 4 groups (apochromatic front doublet + rear field-corrector pair)
  500: {
    front: [[0.0, 1.0, 8.8, 2.6, -6.0], [0.14, 0.96, 3.8, -5.2, 8.0]],
    rear:  [[0.24, 0.62, 2.6, -2.4, 5.5], [0.68, 0.68, 4.2, 6.5, -3.4]],
  },
};

/** Build a removable B60 bayonet square lens shade (B60/50-60, B60/80, or B60/100-250), populated lazily on first display. */
function buildLensHood(lib, def, lens, zFrontFace) {
  const f = lens.focalLength;
  if (f < 50 || f > 250) return null;
  const g = new THREE.Group();
  g.name = 'lensHood';
  g.visible = false;
  let built = false;
  g.userData.ensure = () => {
    if (built) return false;
    built = true;
    const kh = new Kit();
    const satin = lib.get('lensBlack'), flock = lib.get('flock'), white = lib.get('white');
    const rBay = def.frontR + 0.9;
    const len = f <= 60 ? 24 : f <= 80 ? 38 : 62;
    const halfFront = f <= 60 ? 44 : f <= 80 ? 42 : 41;
    const z0 = zFrontFace + 2.8;
    const zNeck = zFrontFace - 5.5;
    const zTip = zFrontFace - len;
    kh.add(revolve([[rBay - 1.2, z0], [rBay + 0.8, z0 - 0.5, 0.5, 1], [rBay + 0.8, zNeck + 0.5, 0.5, 1], [rBay - 0.4, zNeck]], { segs: 432, crease: 30, ribs: { n: 72, depth: 0.22, groove: 0.45 } }), satin);
    kh.add(rbox(1.1, 2.4, 0.3, 0.1, 1), white, T(0, rBay + 0.85, (z0 + zNeck) / 2, Math.PI / 2, 0, 0));
    const rings = 14, segs = 96;
    const buildShell = (inset, mat, flip) => {
      const pos = [], idx = [];
      for (let j = 0; j <= rings; j++) {
        const t = j / rings;
        const z = lerp(zNeck, zTip, t);
        const sqMix = THREE.MathUtils.smoothstep(t, 0.05, 0.82);
        const rCirc = lerp(rBay - 0.6, halfFront, t) - inset;
        const hw = lerp(rBay - 0.6, halfFront, t) - inset;
        const rc = lerp(rCirc * 0.92, 9.5, sqMix);
        for (let i = 0; i <= segs; i++) {
          const a = (i / segs) * TAU;
          const ca = Math.cos(a), sa = Math.sin(a);
          const cx = ca * rCirc, cy = sa * rCirc;
          const inner = Math.max(2, hw - rc);
          const sx = Math.sign(ca) * inner + rc * Math.sign(ca) * Math.pow(Math.abs(ca), 0.45);
          const sy = Math.sign(sa) * inner + rc * Math.sign(sa) * Math.pow(Math.abs(sa), 0.45);
          pos.push(lerp(cx, sx, sqMix), lerp(cy, sy, sqMix), z);
        }
      }
      const stride = segs + 1;
      for (let j = 0; j < rings; j++) {
        for (let i = 0; i < segs; i++) {
          const a = j * stride + i, b = a + 1, c = a + stride, d = c + 1;
          if (flip) idx.push(a, c, b, b, c, d);
          else idx.push(a, b, c, b, d, c);
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setIndex(idx);
      geo.computeVertexNormals();
      kh.add(prep(geo), mat);
    };
    buildShell(0, satin, false);
    buildShell(1.1, flock, true);
    const lipShape = rrPath(-halfFront, -halfFront, halfFront, halfFront, 9.5);
    lipShape.holes.push(rrPath(-(halfFront - 1.2), -(halfFront - 1.2), halfFront - 1.2, halfFront - 1.2, 8.8, new THREE.Path()));
    kh.add(slab(lipShape, 1.2, 0.35, 16, 0.8), satin, T(0, 0, zTip));
    kh.build(g);
    return true;
  };
  return g;
}

/** Build a removable 3D B60 / B93 bayonet optical filter lazily when an active filter is selected. */
function buildLensFilter(lib, def, lens, zFrontFace, hov) {
  if (def.front === 'fisheye') return null;
  const g = new THREE.Group();
  g.name = 'lensFilter';
  g.visible = false;
  const rotGroup = new THREE.Group();
  rotGroup.name = 'filterRot';
  g.add(rotGroup);
  const meshes = [];
  let rimCv = null, rimTex = null, glassMat = null, lastFilterId = '', built = false;

  const ensure = () => {
    if (built) return false;
    built = true;
    const { fR } = frontBore(def);
    const rOuter = fR + 1.15;
    const rGlass = fR - 2.3;
    const zBack = zFrontFace + 1.8;
    const zMid = zFrontFace - 1.4;
    const zFront = zFrontFace - 4.4;

    const satin = lib.get('lensBlack', { hover: hov.filter });
    const bright = lib.get('chromeBright', { hover: hov.filter });
    const white = lib.get('white', { hover: hov.filter });

    rimCv = document.createElement('canvas');
    rimCv.width = 2048;
    rimCv.height = 64;
    rimTex = new THREE.CanvasTexture(rimCv);
    rimTex.wrapS = THREE.RepeatWrapping;
    rimTex.anisotropy = 8;
    rimTex.colorSpace = THREE.SRGBColorSpace;
    const rimMat = lib.prepare(new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: rimTex,
      roughness: 0.42,
      metalness: 0.08,
      bumpMap: rimTex,
      bumpScale: -0.5,
    }), { hover: hov.filter, clip: true });

    const kf = new Kit(), kr = new Kit();
    kf.add(revolve([
      [rGlass, zMid + 0.15, 0.3],
      [rOuter, zMid + 0.15, 0.8],
      [rOuter, zFrontFace - 0.25, 0.8],
      [rOuter - 0.3, zFrontFace, 0.6],
      [fR - 0.15, zFrontFace + 0.2, 0.3],
      [fR - 0.15, zBack, 0.3],
      [rGlass, zBack - 0.3],
    ], { segs: 128, crease: 30 }), satin);
    for (let i = 0; i < 3; i++) {
      kf.add(revolve([[fR - 0.1, zBack - 1.1, 0.5], [fR + 0.45, zBack - 1.1, 0.7], [fR + 0.45, zBack - 0.2, 0.7], [fR - 0.1, zBack - 0.2, 0.5]], {
        segs: 8, phi0: (i * 120 + 75) * DEG, phiLen: 12 * DEG, crease: 30,
      }), satin);
    }
    const rimGeo = revolve([[rOuter + 0.05, zMid + 0.18], [rOuter + 0.05, zFrontFace - 0.22]], { segs: 160, uv: 'band' });
    kf.add(rimGeo, rimMat);

    kr.add(revolve([
      [rGlass, zFront + 0.5, 0.4],
      [rGlass + 0.8, zFront, 0.6],
      [rOuter - 0.35, zFront, 0.9],
      [rOuter + 0.28, zFront + 0.35, 0.7, 1],
      [rOuter + 0.28, zMid - 0.25, 0.7, 1],
      [rOuter - 0.1, zMid, 0.5],
      [rGlass, zMid + 0.1],
    ], { segs: 720, crease: 30, ribs: { n: 120, depth: 0.22, groove: 0.45 } }), satin);
    kr.add(rbox(1.1, 2.2, 0.35, 0.1, 1), white, T(0, rOuter + 0.32, (zMid + zFront) / 2, Math.PI / 2, 0, 0));
    kr.add(revolve([[rGlass, zFront + 0.35], [rGlass + 0.55, zFront + 0.35], [rGlass + 0.55, zFront + 0.9]], { segs: 96 }), bright);

    const fixedMeshes = kf.build(g, 'filter');
    const rotMeshes = kr.build(rotGroup, 'filter');

    glassMat = lib.prepare(new THREE.MeshPhysicalMaterial({
      color: 0xffd21a,
      roughness: 0.04,
      metalness: 0.0,
      ior: 1.52,
      reflectivity: 0.9,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      iridescence: 0.48,
      iridescenceIOR: 1.38,
      transparent: true,
      opacity: 0.46,
      depthWrite: false,
      side: THREE.DoubleSide,
    }), { clip: true });
    const glassProf = [[0, zMid - 0.4], [rGlass * 0.6, zMid - 0.45], [rGlass + 0.1, zMid - 0.5], [rGlass + 0.1, zMid + 0.2], [0, zMid + 0.25]];
    const glassMesh = new THREE.Mesh(prep(revolve(glassProf, { segs: 96, crease: 45 })), glassMat);
    glassMesh.userData.part = 'filter';
    glassMesh.userData.noShadow = true;
    rotGroup.add(glassMesh);
    meshes.push(...fixedMeshes, ...rotMeshes, glassMesh);
    return true;
  };

  function setFilterState(filterId, polAngle = 90) {
    const id = filterId || 'none';
    const fOpt = filterOpticsFor(id);
    const active = (fOpt.glassOpacity ?? 0) > 0;
    g.visible = active;
    if (!active) return false;
    const justBuilt = ensure();
    rotGroup.rotation.z = fOpt.rotatable ? (polAngle - 90) * DEG : 0;
    if (id !== lastFilterId) {
      lastFilterId = id;
      glassMat.color.setHex(fOpt.glassColor ?? 0xe8c414);
      glassMat.opacity = fOpt.glassOpacity ?? 0.45;
      glassMat.needsUpdate = true;

      const ctx = rimCv.getContext('2d');
      ctx.fillStyle = '#141414';
      ctx.fillRect(0, 0, rimCv.width, rimCv.height);
      ctx.fillStyle = '#f0ede4';
      ctx.font = `700 36px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const mountTag = def.frontR > 40 ? 'Ø93' : 'B60';
      const text = (fOpt.code || '').replace('B60', mountTag);
      ctx.fillText(text, 1024, 33);
      ctx.fillText('MADE IN GERMANY', 380, 33);
      ctx.fillText(text, 1660, 33);
      rimTex.needsUpdate = true;
    }
    return justBuilt;
  }

  return {
    group: g,
    rotGroup,
    get glassMat() { return glassMat; },
    meshes,
    ensure,
    setFilterState,
  };
}

// 5-blade tangent-pentagon Zeiss diaphragm & Prontor leaf-shutter constants (mm)
const IRIS = { n: 5, rPin: 25, rOut: 29.3, rPlateOut: 30.2, rMin: 1.2, rMax: 15.2, rFixed: 15.6, thick: 2.0 };
const SHUTTER_PIN_R = 22;
const SHUTTER_SWING = -1.35;
let _irisOutline = null, _shutterOutline = null;
function getIrisOutline() {
  if (_irisOutline) return _irisOutline;
  const cols = 56;
  // Minimum chord from pin to rOut = 29.3 across r 1.2..15.2 is 44.9 mm; -44.2 mm fits inside the barrel while clearing rFixed = 15.6 (40.52 mm)
  const xs = Array.from({ length: cols }, (_, i) => -44.2 + (45.7 * i) / (cols - 1));
  const y0s = xs.map(() => 0);
  const y1s = xs.map(() => 13);
  for (let k = 0; k <= 32; k++) {
    const b = -Math.asin((IRIS.rMin + ((IRIS.rMax - IRIS.rMin) * k) / 32) / IRIS.rPin);
    const c = Math.cos(b), s = Math.sin(b);
    xs.forEach((x, j) => {
      for (let y = 0; y <= 13; y += 0.1) {
        if (Math.hypot(IRIS.rPin + c * x - s * y, s * x + c * y) > IRIS.rOut) {
          y1s[j] = Math.min(y1s[j], Math.max(0, y - 0.1));
          break;
        }
      }
    });
  }
  _irisOutline = { cols, xs, y0s, y1s };
  return _irisOutline;
}
function getShutterOutline() {
  if (_shutterOutline) return _shutterOutline;
  const cols = 48;
  const xs = [], y0s = [], y1s = [];
  for (let i = 0; i < cols; i++) {
    const x = -3.5 + (36.0 * i) / (cols - 1);
    let lo = Infinity, hi = -Infinity;
    for (let y = -28; y <= 28; y += 0.1) {
      const dx = -x, dy = -y;
      const ox = SHUTTER_PIN_R + dx * Math.cos(SHUTTER_SWING) - dy * Math.sin(SHUTTER_SWING);
      const oy = dx * Math.sin(SHUTTER_SWING) + dy * Math.cos(SHUTTER_SWING);
      if (Math.hypot(ox, oy) < 16.15) continue;
      let ok = true;
      for (let t = 0; t <= 1.001; t += 0.125) {
        const a = SHUTTER_SWING * t;
        const tx = SHUTTER_PIN_R + dx * Math.cos(a) - dy * Math.sin(a);
        const ty = dx * Math.sin(a) + dy * Math.cos(a);
        if (Math.hypot(tx, ty) > 29.0) { ok = false; break; }
      }
      if (ok) {
        if (y < lo) lo = y;
        if (y > hi) hi = y;
      }
    }
    if (hi > lo + 0.05) { xs.push(x); y0s.push(lo); y1s.push(hi); }
  }
  _shutterOutline = { cols: xs.length, xs, y0s, y1s };
  return _shutterOutline;
}
function buildLeafStrip({ cols, xs, y0s, y1s }, wB, tipThresh, tiltX) {
  const vCount = cols * 4;
  const pos = new Float32Array(vCount * 3);
  const nor = new Float32Array(vCount * 3);
  const uv = new Float32Array(vCount * 2);
  const wr = new Float32Array(vCount);
  const xMin = xs[0], xSpan = Math.max(1e-3, xs[cols - 1] - xMin);
  for (let j = 0; j < cols; j++) {
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
  for (let j = 0; j < cols - 1; j++) {
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
  if (tiltX) g.applyMatrix4(new THREE.Matrix4().makeRotationX(tiltX));
  return prep(g);
}
function diaphragmGeos(lib) {
  if (lib._diaphragmGeos) return lib._diaphragmGeos;
  const shBladeGeo = buildLeafStrip(getShutterOutline(), 0.32, 0.4, -0.008);
  shBladeGeo.computeBoundingSphere();
  const fixedIrisGeo = prep(new THREE.RingGeometry(IRIS.rFixed, IRIS.rPlateOut, 72, 1));
  const leafGeo = buildLeafStrip(getIrisOutline(), 0.32, 0.4, -0.03);
  const pinGeo = prep(new THREE.CylinderGeometry(0.7, 0.7, 0.7, 12).rotateX(Math.PI / 2));
  pinGeo.attributes.wear.array.fill(0.35);
  const irisBladeGeo = fastMerge([leafGeo, pinGeo]);
  irisBladeGeo.computeBoundingSphere();
  const jawBoxGeo = prep(new THREE.BoxGeometry(1, 1, 1));
  lib._diaphragmGeos = { shBladeGeo, fixedIrisGeo, irisBladeGeo, jawBoxGeo };
  return lib._diaphragmGeos;
}

function buildLens(lib, lens, hov) {
  const def = lensDef(lens), L = def.L;
  const g = new THREE.Group(); g.name = 'lens';
  // extGroup moves forward along -Z as the helicoid extends for close focus;
  // g holds the stationary rear mount collar, bayonet plate, lugs, and rear mechanical couplings.
  const extGroup = new THREE.Group(); extGroup.name = 'lensExt';
  const focus = new THREE.Group(), aperture = new THREE.Group(), shutter = new THREE.Group(), inner = new THREE.Group();
  const dofLever = new THREE.Group(), evBtn = new THREE.Group(), fleGroup = new THREE.Group(), fBtn = new THREE.Group();
  aperture.add(evBtn);
  shutter.add(fBtn);
  extGroup.add(focus, aperture, shutter, inner, dofLever, fleGroup);
  g.add(extGroup);
  const { zC, zH, zG, zD, zB, zFix, zAp, zSp, zSh } = lensStations(def);
  const gr = def.gripR, sR = def.scaleR ?? 39.4, fR = def.fixedR ?? 37.6, aR = 35.4, rR = 37.0, cR = 37.65;
  const mk = def.makro ? 4.6 : 0;                    // Makro: reproduction ratios behind the distance scale
  const zFb = def.big ? zB : zD;                     // rear edge of the fixed ring
  const { fR: fR0, aIn: aIn0 } = frontBore(def);
  const band6Spec = def.front === 'fisheye' ? [5.2, 40.9] : def.front === 'long' ? [6.0, def.frontR] : [fR0 - aIn0, (aIn0 + fR0) / 2];
  const atlas = lensAtlas(lens, def, {
    0: [zG - mk - zD - 0.3, sR], 1: [zFb - zFix - 0.35, fR], 3: [zFix - zAp - 0.55, aR], 5: [zAp - zSp - 0.3, aR],
    6: band6Spec, 7: def.fle ? [5.0, def.tubeR] : [mk || 4, sR],
  });
  const bandMat = (hover) => lib.prepare(new THREE.MeshPhysicalMaterial({
    color: 0xffffff, map: atlas, roughness: 0.55, metalness: 0, specularIntensity: 0.55, envMapIntensity: 0.85, bumpMap: atlas, bumpScale: -1.4,
  }), { hover, clip: true, wear: 'paint' });
  const band = { s: bandMat(null), f: bandMat(hov.focus), a: bandMat(hov.aperture), sh: bandMat(hov.shutter) };
  const paint = lib.get('paint'), paintF = lib.get('paint', { hover: hov.focus }), paintA = lib.get('paint', { hover: hov.aperture }), paintS = lib.get('paint', { hover: hov.shutter });
  const focusRubber = lib.get('rubber', { hover: hov.focus }), plainRubber = lib.get('rubber');
  const knurl = (hover, r = gr, cylLen = 0, rows = 0) => {
    const m = lib.prepare(lib.base.knurl.clone(), { hover, clip: true });
    const kn = m.normalMap = m.normalMap.clone();
    const around = Math.round((TAU * r) / 1.78);
    const repY = rows > 0 && cylLen > 0 ? rows / cylLen : 1 / 1.68;
    kn.repeat.set(around / (TAU * r), repY); kn.needsUpdate = true;
    if (m.roughnessMap) {
      const kr = m.roughnessMap = m.roughnessMap.clone();
      kr.repeat.set(around / (TAU * r), repY); kr.needsUpdate = true;
    }
    return m;
  };
  const gripCylLen = Math.max(2, (zH - 0.72) - (zG + 0.72));
  const knurlMat = knurl(hov.focus, gr, gripCylLen, def.gripRows || Math.round(gripCylLen / 1.55));
  const bright = lib.get('chromeBright'), flock = lib.get('flock'), satinBlack = lib.get('lensBlack'), red = lib.get('red');
  const zBl = zAp + 2.5;
  const rRear = def.rearR ?? 14.4;
  // Clear multicoated front/rear elements so the physical stepped baffles, Prontor shutter, and 5-blade iris read inside
  let glassMat = lib.cache.get('cfGlass|1');
  if (!glassMat) {
    glassMat = lib.prepare(new THREE.MeshPhysicalMaterial({
      name: 'cfGlass', color: 0x05080a, metalness: 0, roughness: 0.025, ior: 1.62, specularIntensity: 0.85,
      transparent: true, opacity: 0.14, iridescence: 0.72, iridescenceIOR: 1.38,
      iridescenceThicknessMinimum: 260, iridescenceThicknessMaximum: 520, depthWrite: false, side: THREE.FrontSide,
    }), { clip: true });
    glassMat.userData.single = true;
    lib.cache.set('cfGlass|1', glassMat);
  }
  const ksCollar = new Kit(), ks = new Kit(), kf = new Kit(), ka = new Kit(), ksh = new Kit(), ki = new Kit();
  const kdof = new Kit(), kev = new Kit(), kfle = new Kit(), kfbtn = new Kit();
  const SEG = 192;
  const sil = [];                                    // outer silhouette [z, r], for the cut section
  const ring = (kit, mat, prof, o = {}) => { const wm = o.wearMul ?? 0.6; kit.add(revolve(prof.map((q) => [q[0], q[1], (q[2] || 0) * wm, q[3] || 0]), { segs: SEG, crease: 30, ...o }), mat); return prof; };
  const bandRing = (kit, mat, r, z0, z1, row) => kit.add(atlasRow(revolve([[r, z0], [r, z1]], { segs: SEG, uv: 'band' }), row), mat);

  // ─ shutter / focusing unit, flange forward ─
  // mount collar with the lens index dot (stationary on g, plus inner helicoid sleeve so focus extension leaves no gap)
  ring(ksCollar, paint, [[36.2, zC - 12, 0.2], [36.2, zC, 0.3], [37.25, zC, 0.5], [cR, zC + 0.4, 0.6], [cR, -0.45, 1], [37.25, 0, 0.9], [33.6, 0, 0.2]], { seed: 3, wearMul: 1 });
  ksCollar.add(revolve([[0, 0], [1.05, 0]], { segs: 16 }), red, T(0, cR + 0.02, zC / 2, -Math.PI / 2, 0, 0));
  sil.push([0, 37.3], [-0.45, cR], [zC + 0.4, cR]);
  // focusing ring: (rim + plain helicoid band), checkered grip, distance scale (+ Makro ratios)
  if (def.helic) {
    const hr = gr - 0.45, rim = gr + 0.3, zR = zC - 3.3;
    ring(ksCollar, paint, [[hr, zH, 0.3], [hr, zR - 0.5, 0.3], [rim - 0.4, zR, 0.6], [rim, zR + 0.5, 0.9], [rim, zC - 0.6, 0.9], [rim - 0.6, zC, 0.7], [cR, zC, 0.2]], { seed: 6, wearMul: 1 });
    // Red side-mount index dot on rear helicoid rim (visible from camera-left when mounting longer CF lenses)
    ksCollar.add(revolve([[0, 0], [0.95, 0]], { segs: 16 }), red, radialT(-Math.PI / 2, rim + 0.02, (zC + zR) / 2, T(0, 0, 0, -Math.PI / 2, 0, 0)));
    sil.push([zC, rim - 0.6], [zC - 0.6, rim], [zR + 0.5, rim], [zR, rim - 0.4], [zR - 0.5, hr], [zH, hr]);
  }
  const gBack = def.helic ? gr - 0.45 : cR;
  // the helicoid sleeve: the inner barrel the focusing unit runs out on, nearly the ring's width (at 22–31 mm of travel
  // on the 120, 250 and 500 the gap had shown only the slim flocked tube). It sits in the stationary ring and is
  // stretched to the gap each frame (update()), so at rest — and on a lens off the camera — nothing new shows; the two
  // faces close the slot between it and the rings either side.
  const rS = gBack - 1.6;
  ring(ks, satinBlack, [[gBack, zH], [rS, zH]]);
  const helicSleeve = new THREE.Group();
  helicSleeve.name = 'helicSleeve'; helicSleeve.position.z = zH + 1; helicSleeve.scale.z = 1.5; helicSleeve.visible = false;
  g.add(helicSleeve);
  let helicCollar = null, sleeveBuilt = false;
  const ensureSleeve = () => {
    if (sleeveBuilt) return false;
    sleeveBuilt = true;
    const collar = new THREE.Mesh(revolve([[rS, zH], [gBack, zH]], { segs: SEG, crease: 30 }), satinBlack);
    collar.name = 'helicCollar';
    g.add(collar);
    helicCollar = collar;
    helicSleeve.add(new THREE.Mesh(revolve([[rS, -1], [rS, 0]], { segs: SEG }), satinBlack));
    return true;
  };
  // Smooth vulcanized rubber borders at front and rear of the focusing grip + true 3D multi-row Zeiss CF waffle blocks (exact gr envelope!)
  ring(kf, focusRubber, [[sR, zG, 0.3], [gr - 0.72, zG, 0.6], [gr, zG + 0.72, 0.45]], { seed: 5 });
  {
    const z0 = zG + 0.72, z1 = zH - 0.72;
    const rows = Math.max(3, Math.min(9, Math.round((def.gripRows || 6) * 0.55)));
    const wProf = [[gr - 0.32, z0, 0.25]];
    for (let b = 0; b < rows; b++) {
      const zb0 = lerp(z0, z1, b / rows), zb1 = lerp(z0, z1, (b + 1) / rows);
      wProf.push([gr, zb0 + 0.26, 0.3, 1], [gr, zb1 - 0.26, 0.3, 1]);
      if (b < rows - 1) wProf.push([gr - 0.38, zb1, 0.16]);
    }
    wProf.push([gr - 0.32, z1, 0.25]);
    ring(kf, focusRubber, wProf, { segs: 504, ribs: { n: 84, depth: 0.36, groove: 0.46, edge: 0.18 }, seed: 5 });
  }
  ring(kf, focusRubber, [[gr, zH - 0.72, 0.45], [gr - 0.72, zH, 0.6], [gBack, zH, 0.2]], { seed: 5 });
  sil.push([zH, gr - 0.72], [zH - 0.72, gr], [zG + 0.72, gr], [zG, gr - 0.72], [zG, sR]);
  bandRing(kf, band.f, sR, zD + 0.3, zG - mk, 0);
  if (mk) bandRing(kf, band.f, sR, zG - mk, zG, 7);
  ring(kf, paintF, [[def.big ? sR - 0.5 : fR + 0.2, zD, 0.2], [sR - 0.3, zD, 0.8], [sR, zD + 0.3, 1]], { seed: 8, wearMul: 1 });
  sil.push([zD + 0.3, sR], [zD, sR - 0.3]);
  // 500: fixed foot section between the focusing ring and the shutter
  if (def.big) {
    ring(ks, paint, [[fR + 0.2, zB, 0.3], [sR - 0.4, zB, 0.8], [sR, zB + 0.4, 0.9], [sR, zD - 0.4, 0.6], [sR - 0.5, zD, 0.4]], { seed: 4, wearMul: 1 });
    sil.push([zD - 0.4, sR], [zB + 0.4, sR], [zB, sR - 0.4]);
  }
  // fixed ring: depth-of-field scale + central index; flash terminal (upper left) and the
  // depth-of-field preview tab (left, pressed down with the thumb)
  const fixLen = zFb - zFix;
  bandRing(ks, band.s, fR, zFix + 0.35, zFb, 1);
  ring(ks, paint, [[aR + 0.2, zFix, 0.3], [fR - 0.35, zFix, 0.8], [fR, zFix + 0.35, 1]], { seed: 9 });
  sil.push([zFb, fR], [zFix + 0.35, fR], [zFix, fR - 0.35]);
  const zPC = zFix + fixLen * 0.5, phPC = -57 * DEG;
  ks.add(rbox(6.2, Math.min(6.4, fixLen - 1.4), 2.4, 1.0, 2, 0.8), satinBlack, radialT(phPC, fR + 0.3, zPC));
  // (the PC terminal: a black boss, a polished friction collar in its mouth round the silver centre pin — SPEC, photo 11)
  ks.add(revolve([[3.4, -0.2, 0.2], [3.4, 2.2, 0.6], [2.9, 2.8, 0.9], [2.1, 2.8, 0.5], [2.1, 1.6], [0, 1.6]], { segs: 28, crease: 30 }), satinBlack, radialT(phPC, fR + 1.5, zPC));
  ks.add(revolve([[2.0, 1.6], [2.0, 2.75, 0.4], [1.75, 3.0, 0.5], [1.25, 2.95, 0.3], [1.15, 2.0]], { segs: 24 }), bright, radialT(phPC, fR + 1.5, zPC));
  ks.add(revolve([[0.45, 1.5], [0.45, 2.6, 0.4], [0, 2.7]], { segs: 10 }), bright, radialT(phPC, fR + 1.5, zPC));
  {
    const zs0 = zFix + Math.min(2.2, fixLen * 0.25), zs1 = zFix + fixLen * 0.85, pr = fR + 1.3, half = 17 * DEG;
    kdof.add(revolve([[fR - 0.1, zs0, 0.2], [pr, zs0 + 0.3, 0.6, 1], [pr, zs1 - 0.3, 0.6, 1], [fR - 0.1, zs1, 0.2]], { segs: 720, phi0: -Math.PI / 2 - half, phiLen: 2 * half, crease: 30, ribs: { n: 120, depth: 0.35, groove: 0.45 }, rRef: pr }), satinBlack);
    [-1, 1].forEach((s) => kdof.add(rbox(0.8, zs1 - zs0, 1.5, 0.3, 1), satinBlack, radialT(-Math.PI / 2 + s * (half - 0.5 * DEG), fR + 0.6, (zs0 + zs1) / 2)));
    // Flush silver metallic latch cap at the upper end of the DoF preview rocker (503cx-15)
    kdof.add(rbox(0.9, (zs1 - zs0) * 0.82, 1.45, 0.25, 1), bright, radialT(-Math.PI / 2 + (half - 0.4 * DEG), fR + 0.62, (zs0 + zs1) / 2));
  }
  kdof.build(dofLever);
  // aperture ring: white f-numbers, red EV index; black cross-coupling button (ribbed end) on the
  // right, a finger lug underneath, and fine axial grip ribs on the un-numbered underside sector
  const apLen = zFix - zAp, zAm = (zAp + zFix) / 2;
  bandRing(ka, band.a, aR, zAp + 0.3, zFix - 0.25, 3);
  ring(ka, paintA, [[aR - 0.3, zAp, 0.3], [aR, zAp + 0.3, 0.6]]);
  ring(ka, paintA, [[aR, zFix - 0.25, 0.6], [aR - 0.25, zFix, 0.3]]);
  const btnMat = lib.get('lensBlack', { hover: hov.aperture });
  // Fine axial ribbed grip sector along the un-numbered half of the aperture ring (segs = 6*120 = 720!)
  ka.add(revolve([[aR - 0.05, zAp + 0.35, 0.2], [aR + 0.32, zAp + 0.55, 0.4, 1], [aR + 0.32, zFix - 0.5, 0.4, 1], [aR - 0.05, zFix - 0.3, 0.2]], { segs: 720, phi0: 118 * DEG, phiLen: 124 * DEG, crease: 30, ribs: { n: 120, depth: 0.24, groove: 0.45 }, rRef: aR + 0.3 }), btnMat);
  const phB = 16 * DEG, bw = 9, bl = apLen - 0.9;
  ka.add(rbox(bw + 0.9, bl + 0.4, 0.7, 0.3, 1, 0.6), btnMat, radialT(phB, aR + 0.15, zAm));
  kev.add(rbox(bw, bl, 4.4, 1.0, 2, 0.8), btnMat, radialT(phB, aR + 1.9, zAm));
  for (let n = 0; n < 5; n++) kev.add(rbox(0.45, bl * 0.82, 0.48, 0.12, 1), btnMat, radialT(phB, aR + 1.9, zAm, T(bw / 2 + 0.05, 0, -1.4 + n * 0.7)));
  const evMeshes = kev.build(evBtn, 'aperture');
  ka.add(rbox(7, apLen - 1.4, 2.4, 0.8, 2, 0.8), btnMat, radialT(Math.PI, aR + 0.9, zAm));
  // the two grip tabs either side of the EV index: raised blocks standing on the ring and reaching back over the fixed
  // band, ribbed across their rear ends
  [-22 * DEG, 22 * DEG].forEach((dph) => {
    const ph = EV_INDEX + dph, zr = zFix + 2.4;   // (2.4 over the band: clear of its engraving)
    ka.add(rbox(9, apLen - 0.6, fR + 1.6 - aR, 0.6, 2, 0.8), btnMat, radialT(ph, (aR + fR + 1.6) / 2, zAm));
    ka.add(rbox(9, zr - zAp - 0.3, 1.5, 0.6, 2, 0.8), btnMat, radialT(ph, fR + 0.95, (zAp + 0.3 + zr) / 2));
    for (let n = 0; n < 4; n++) ka.add(rbox(8.4, 0.45, 0.4, 0.12, 1), btnMat, radialT(ph, fR + 1.75, zr - 0.6 - n * 0.9));
  });
  // speed ring: scale band (speeds, EV numerals), 2-row split ribbed grip in front; counterbored green F-detent button
  const ribRubber = lib.get('rubber', { hover: hov.shutter });
  bandRing(ksh, band.sh, aR, zSp + 0.05, zAp - 0.3, 5);
  ring(ksh, paintS, [[aR, zAp - 0.3, 0.6], [aR - 0.3, zAp, 0.3]]);
  const zSpMid = (zSh + zSp) / 2;
  ring(ksh, ribRubber, [
    [35.9, zSh, 0.3],
    [rR - 0.3, zSh + 0.2, 0.3],
    [rR, zSh + 0.45, 0.3, 1],
    [rR, zSpMid - 0.24, 0.3, 1],
    [rR - 0.34, zSpMid - 0.06, 0.2],
    [rR - 0.34, zSpMid + 0.06, 0.2],
    [rR, zSpMid + 0.24, 0.3, 1],
    [rR, zSp - 0.45, 0.3, 1],
    [rR - 0.3, zSp - 0.2, 0.3],
    [aR + 0.05, zSp, 0.2],
  ], { segs: 648, ribs: { n: 108, depth: 0.38, groove: 0.45, edge: 0.18 } });
  const phFBtn = -2 * SH_STEP - 7 * DEG, zFBtn = (zAp + zSp) / 2;
  ksh.add(revolve([[1.65, -0.15, 0.2], [1.65, 0.32, 0.5], [1.32, 0.36, 0.4], [1.32, -0.1]], { segs: 20 }), paintS, radialT(phFBtn, aR - 0.05, zFBtn));
  kfbtn.add(revolve([[1.26, -0.2, 0.3], [1.26, 0.62, 0.6], [0.88, 1.12, 0.8], [0, 1.22]], { segs: 20 }), lib.get('green'), radialT(phFBtn, aR - 0.05, zFBtn));
  const fBtnMeshes = kfbtn.build(fBtn, 'shutter');
  sil.push([zFix, aR], [zSp, aR], [zSp - 0.2, rR - 0.3], [zSh + 0.5, rR], [zSh, 35.9]);

  // ─ optics housing in front of the shutter ─
  let mountPoint = null;                             // lens foot (500): where the tripod plate clamps
  const zFrontFace = -L;
  let rLip = def.frontR, glassZ = 0, glassR = def.glassR, zLipBack = zFrontFace + 3;
  if (def.front === 'tube') {
    const fr = def.frontR;
    ring(ks, paint, [[fr, zLipBack, 0.2], [fr, zSh - 0.4, 0.5], [fr - 0.4, zSh, 0.4]], { seed: 20 });
    sil.push([zSh, fr - 0.4], [zSh - 0.4, fr], [zLipBack, fr]);
  } else if (def.front === 'fle') {
    // plain band, a fixed white axial index, the floating-element ring (scale band at its rear at radius tr, 4-row checkered
    // pyramid grip at fr, rotating in fleGroup), then the front tube (50) or a cone out to the big front mount (40)
    const tr = def.tubeR, fr = def.fleR, zF0 = zSh - def.flePlain, zF1 = zF0 - def.fleLen, zfb = zF0 - 5.2;
    const fleCylLen = Math.max(2, (zfb - 0.55) - (zF1 + 0.55));
    const fk = knurl(null, fr, fleCylLen, def.fleRows || 4);
    ring(ks, paint, [[tr, zF0, 0.2], [tr, zSh - 0.4, 0.4], [tr - 0.4, zSh, 0.3]], { seed: 21 });
    ks.add(rbox(0.52, 2.5, 0.28, 0.08, 1), lib.get('white'), T(0, tr + 0.06, zF0 + 1.45));
    ring(kfle, plainRubber, [[tr, zF1, 0.3], [fr - 0.55, zF1, 0.6], [fr, zF1 + 0.55, 0.45]], { seed: 22 });
    ring(kfle, fk, [[fr, zF1 + 0.55, 0.3], [fr, zfb - 0.55, 0.3]], { rRef: fr, seed: 22, wearBand: 0.01 });
    ring(kfle, plainRubber, [[fr, zfb - 0.55, 0.45], [fr - 0.55, zfb, 0.5], [tr, zfb, 0.2]], { seed: 22 });
    bandRing(kfle, band.s, tr, zfb, zF0 - 0.15, 7);
    ring(kfle, paint, [[tr, zF0 - 0.15, 0.4], [tr - 0.22, zF0, 0.2]]);
    kfle.build(fleGroup);
    sil.push([zSh, tr - 0.4], [zF0, tr], [zfb, tr], [zfb - 0.55, fr], [zF1 + 0.55, fr], [zF1, tr]);
    if (def.cone) {
      const zc0 = -def.cone[0], zc1 = -def.cone[1];
      ring(ks, paint, [[rLip, zLipBack, 0.3], [rLip, zc1 - 0.6, 0.5], [rLip - 0.6, zc1, 0.5], [tr, zc0, 0.3], [tr, zF1, 0.2]], { seed: 23, crease: 25 });
      sil.push([zF1, tr], [zc0, tr], [zc1, rLip - 0.6], [zc1 - 0.6, rLip], [zLipBack, rLip]);
    } else {
      ring(ks, paint, [[tr, zLipBack, 0.3], [tr, zF1, 0.3]], { seed: 23 });
      sil.push([zF1, tr], [zLipBack, tr]);
    }
  } else if (def.front === 'fisheye') {
    // step, knurled removable front component (internal 26mm filter holder), then the hood: a steep cone and a Ø109 cylinder
    // with four trapezoidal notches (8.7 deep) cut at the diagonals
    const zk0 = zSh - 2.3, zk1 = -82.2, zc0 = -87.8, zc1 = -95.9, hr = def.frontR, kr = 41.7;
    const fkLen = Math.max(2, (zk0 - 0.6) - (zk1 + 0.6));
    const fk = knurl(null, kr, fkLen, 7);
    ring(ks, paint, [[36.0, zk0, 0.3], [36.0, zSh - 0.3, 0.4], [35.7, zSh, 0.2]], { seed: 24 });
    ring(ks, plainRubber, [[40.4, zk1, 0.4], [kr - 0.6, zk1, 0.6], [kr, zk1 + 0.6, 0.45]], { seed: 25 });
    ring(ks, fk, [[kr, zk1 + 0.6, 0.3], [kr, zk0 - 0.6, 0.3]], { rRef: kr, seed: 25, wearBand: 0.01 });
    ring(ks, plainRubber, [[kr, zk0 - 0.6, 0.45], [kr - 0.6, zk0, 0.6], [36.0, zk0, 0.3]], { seed: 25 });
    ks.add(rbox(0.55, 2.2, 0.3, 0.1, 1), lib.get('white'), T(-2.2, kr + 0.05, zk0 - 2.0));
    ring(ks, paint, [[40.9, zc0, 0.3], [40.9, zk1, 0.3], [40.4, zk1, 0.2]], { seed: 25 });
    bandRing(ks, band.s, 40.93, zc0 + 0.2, zk1 - 0.2, 6);
    const hood = revolve([[hr - 2.0, zFrontFace + 0.25, 0.4], [hr - 0.5, zFrontFace, 1], [hr, zFrontFace + 0.5, 1], [hr, zc1 - 0.5, 0.4], [hr - 0.6, zc1 + 0.2, 0.3], [40.9, zc0 - 0.2, 0.3], [40.9, zc0, 0.2]], { segs: 256, crease: 30 });
    const hoodIn = revolve([[38.6, zc0 - 0.8], [hr - 2.2, zc1 - 0.6], [hr - 2.0, zFrontFace + 0.25, 0.3]], { segs: 256, crease: 30 });
    const notch = (geo) => {
      const p2 = geo.attributes.position, lim = zFrontFace + 8.7;
      for (let i = 0; i < p2.count; i++) {
        const zz = p2.getZ(i); if (zz >= lim) continue;
        const a = Math.atan2(p2.getX(i), p2.getY(i)), ad = Math.abs((((a % (Math.PI / 2)) + Math.PI / 2) % (Math.PI / 2)) - Math.PI / 4);
        const dep = 8.7 * clamp01((19.5 * DEG - ad) / (8.5 * DEG));
        p2.setZ(i, Math.max(zz, zFrontFace + dep));
      }
    };
    notch(hood); notch(hoodIn);
    ks.add(hood, paint); ks.add(hoodIn, flock);
    sil.push([zk0, 36.0], [zk0 - 0.6, kr], [zk1 + 0.6, kr], [zk1, 40.9], [zc0 - 0.2, 40.9], [zc1 + 0.2, hr - 0.6], [zc1 - 0.5, hr], [zFrontFace + 0.5, hr], [zFrontFace, hr - 0.5]);
    zLipBack = zc0;
  } else if (def.front === 'long') {
    // slim tube, cone, two-section shade (the inner section holds a Series 93 filter)
    const tr = def.tubeR, zc0 = -def.cone[0], zc1 = -def.cone[1], hr = def.frontR, zSeam = zc1 - 16;
    ring(ks, paint, [[tr, zc0, 0.3], [tr, zSh - 0.4, 0.4], [tr - 0.4, zSh, 0.3]], { seed: 26 });
    ring(ks, paint, [[hr - 1.6, zFrontFace + 0.02, 0.4], [hr - 0.45, zFrontFace, 1], [hr, zFrontFace + 0.45, 1], [hr, zSeam - 0.3, 0.5], [hr - 0.35, zSeam, 0.4], [hr, zSeam + 0.35, 0.5], [hr, zc1 - 0.5, 0.5], [hr - 0.5, zc1 + 0.2, 0.4], [tr + 0.4, zc0 - 0.3, 0.3], [tr, zc0, 0.2]], { seed: 27, crease: 25 });
    bandRing(ks, band.s, hr + 0.03, zSeam + 2.0, zc1 - 2.0, 6);
    ks.add(revolve([[tr - 1.2, zc0 - 1.2], [hr - 1.6, zc1], [hr - 1.6, zFrontFace + 0.02, 0.3]], { segs: SEG }), flock);
    sil.push([zSh, tr - 0.4], [zc0, tr], [zc0 - 0.3, tr + 0.4], [zc1 + 0.2, hr - 0.5], [zc1 - 0.5, hr], [zFrontFace + 0.45, hr], [zFrontFace, hr - 0.45]);
    // Machined Hasselblad quick-coupling tripod foot with chrome dovetail U-rails, black center plate, 4 corner screws, and 3/8" spanner-notched socket
    const zf0 = zB + 1.0, zf1 = -62.4, zfMid = (zf0 + zf1) / 2, fLen = zD - zB - 3.0, yTop = -41.6, yBot = -45.6;
    ks.add(rbox(26, 5.4, zD - zB - 6, 1.8, 2, 0.8), satinBlack, T(0, -39.8, (zB + zD) / 2));
    ks.add(rbox(32, yTop - yBot, fLen, 1.4, 2, 0.6), lib.get('anod'), T(0, (yTop + yBot) / 2, zfMid));
    [-1, 1].forEach((sx) => {
      ks.add(rbox(4.2, 2.2, fLen - 1.2, 0.45, 2, 0.85), bright, T(sx * 18.2, yBot - 0.2, zfMid));
      ks.add(rbox(2.2, 1.1, fLen - 1.6, 0.3, 1, 0.7), bright, T(sx * 19.2, yBot - 1.15, zfMid));
    });
    const footUp = T(0, 0, 0, Math.PI / 2, 0, 0);
    [[-11.5, -fLen * 0.36], [11.5, -fLen * 0.36], [-11.5, fLen * 0.36], [11.5, fLen * 0.36]].forEach(([sx, sz]) => {
      ks.add(revolve([[1.4, 0], [1.4, 0.35, 0.4], [0, 0.38]], { segs: 16 }), lib.get('steel'), T(sx, yBot - 0.05, zfMid + sz).multiply(footUp));
      ks.add(rbox(2.1, 0.18, 0.32, 0.04, 1), flock, T(sx, yBot - 0.42, zfMid + sz));
    });
    ks.add(revolve([[3.2, -1.8], [3.2, 0.1], [6.2, 0.1, 0.5], [6.2, 0.45, 0.6], [3.4, 0.45]], { segs: 32, crease: 30 }), lib.get('steel'), T(0, yBot, zfMid).multiply(footUp));
    ks.add(revolve([[0, -1.8], [3.2, -1.8], [3.2, 0.05]], { segs: 24 }), flock, T(0, yBot, zfMid).multiply(footUp));
    [-1, 1].forEach((s) => ks.add(rbox(1.1, 0.45, 1.6, 0.08, 1), flock, T(s * 4.7, yBot - 0.35, zfMid)));
    mountPoint = { y: yBot - 1.2, z: zfMid };
    zLipBack = zc0;
  }
  // front: bayonet lip (B60 / B93) with the engraved front ring, retaining ring, front element
  let zRet;
  if (def.front === 'fisheye') {
    zRet = -88.4;
    ring(ks, satinBlack, [[glassR + 0.2, zRet, 0.3], [glassR + 1.8, zRet - 0.55, 0.6], [glassR + 3.4, zRet - 0.2, 0.5], [38.6, zRet]]);
    [35 * DEG, 215 * DEG].forEach((ph) => {
      const rSp = glassR + 1.7;
      ks.add(rbox(0.6, 1.4, 0.3, 0.05, 1), flock, T(rSp * Math.sin(ph), rSp * Math.cos(ph), zRet - 0.52, 0, 0, -ph));
    });
    const R = glassR * 1.06, rise = 14.6, prof = [], aMax = Math.asin(Math.min(0.999, glassR / R)), s0 = R * (1 - Math.cos(aMax));
    for (let i = 0; i <= 18; i++) { const a = (i / 18) * aMax; prof.push([R * Math.sin(a), zRet - rise + R * (1 - Math.cos(a)) * (rise / s0)]); }
    ks.add(revolve(prof, { segs: 128 }), glassMat);
    glassZ = zRet - rise;
  } else if (def.front === 'long') {
    zRet = -def.cone[0] - 1.2;
    ring(ks, satinBlack, [[glassR + 0.2, zRet, 0.3], [glassR + 1.2, zRet - 0.55, 0.6], [def.tubeR - 1.2, zRet - 0.4]]);
    [35 * DEG, 215 * DEG].forEach((ph) => {
      const rSp = glassR + 0.9;
      ks.add(rbox(0.55, 1.35, 0.3, 0.05, 1), flock, T(rSp * Math.sin(ph), rSp * Math.cos(ph), zRet - 0.52, 0, 0, -ph));
    });
    const Rc = glassR * 3, sag = Rc - Math.sqrt(Rc * Rc - glassR * glassR), prof = [];
    for (let i = 0; i <= 10; i++) { const r = (i / 10) * glassR; prof.push([r, zRet + 0.4 - sag + (Rc - Math.sqrt(Rc * Rc - r * r))]); }
    ks.add(revolve(prof, { segs: 128 }), glassMat);
    glassZ = zRet - sag;
  } else {
    // (after the CF 80, 150 and 50 from the front and at 3/4: the lip's narrow front face and its three hood lugs; the
    //  filter bore, Ø62 for B60, 3 deep, the filter bayonet's three slots in its wall; at its foot the flat engraved
    //  annulus; then a black cone of fine steps — the light baffles, each catching a thin rim of light — down to the
    //  retaining ring and the front element, deep-set and small on the long lenses, all but filling the bore on the
    //  wide ones)
    const { fR, aIn } = frontBore(def), cR = def.clearR ?? glassR, zA = zFrontFace + (def.front === 'fle' ? 2.4 : 3.0);
    const zG = zA + (def.deep ?? 4);
    ring(ks, satinBlack, [[fR + 0.5, zFrontFace + 0.02, 0.3], [rLip - 0.45, zFrontFace, 0.9], [rLip, zFrontFace + 0.45, 1], [rLip, zLipBack, 0.2]], { seed: 19, wearMul: 1 });
    sil.push([zLipBack, rLip], [zFrontFace + 0.45, rLip], [zFrontFace, rLip - 0.45]);
    for (let i = 0; i < 3; i++) ks.add(revolve([[rLip + 0.8, zFrontFace + 0.9, 0.7], [rLip + 0.8, zFrontFace + 2.4, 0.7]], { segs: 10, phi0: (i * 120 + 20) * DEG, phiLen: 24 * DEG }), satinBlack);
    // the bore: exposed bright machined steel inner chamfer at mouth, dark wall, filter bayonet's three slots (120°)
    ks.add(revolve([[fR - 0.02, zFrontFace + 0.30], [fR + 0.44, zFrontFace + 0.02]], { segs: 128 }), lib.get('steel'));
    ks.add(revolve([[fR, zA], [fR, zFrontFace + 0.5, 0.3], [fR + 0.5, zFrontFace + 0.02, 0.3]], { segs: 192, crease: 30 }), satinBlack);
    for (let i = 0; i < 3; i++) ks.add(revolve([[fR - 0.03, zFrontFace + 0.7], [fR - 0.03, zFrontFace + 1.9]], { segs: 6, phi0: (i * 120 + 75) * DEG, phiLen: 13 * DEG }), flock);
    // Miniature recessed slotted stainless barrel alignment grub screws on the front lens sleeve
    [-90, 90].forEach((a) => addScrew(ks, lib.get('steel'), ks, flock, radialT(a * DEG, rLip - 0.05, zFrontFace + 4.4), 0.75, false, 0.25));
    ks.add(atlasRow(revolve([[aIn, zA], [fR, zA]], { segs: 192, uv: 'bandOut' }), 6), band.s);
    ks.add(revolve([[fR, zA + 0.04], [aIn, zA + 0.04]], { segs: 96 }), flock);
    // the baffle cone: steps of ~0.8, a short wall and a ledge each, from the annulus down to the retaining ring
    { const n = Math.max(3, Math.round((aIn - cR - 1.6) / 0.8)), prof = [[aIn, zA + 0.02]];
      for (let i = 0; i < n; i++) {
        const r0 = aIn - ((aIn - cR - 1.6) * i) / n, r1 = aIn - ((aIn - cR - 1.6) * (i + 1)) / n, z0 = zA + ((zG - zA - 0.6) * i) / n, z1 = zA + ((zG - zA - 0.6) * (i + 1)) / n;
        prof.push([r0, z1 - 0.12], [r0 - 0.08, z1], [r1, z1]);
      }
      ks.add(revolve(prof, { segs: 192, crease: 30 }), satinBlack); }
    // the retaining ring: a narrow rounded lip over the element's edge + two opposing spanner wrench notches (01-3q-front-left.jpg)
    ring(ks, satinBlack, [[cR + 1.6, zG - 0.6, 0.3], [cR + 0.9, zG - 0.75, 0.5], [cR + 0.2, zG - 0.45, 0.4], [cR, zG]]);
    [35 * DEG, 215 * DEG].forEach((ph) => {
      const rSp = cR + 0.85;
      ks.add(rbox(0.55, 1.35, 0.28, 0.05, 1), flock, T(rSp * Math.sin(ph), rSp * Math.cos(ph), zG - 0.72, 0, 0, -ph));
    });
    zRet = zG;
    const gR = cR + 0.6, Rc = gR * (def.rc ?? 2.4), sag = Rc - Math.sqrt(Rc * Rc - gR * gR), prof = [];
    for (let i = 0; i <= 14; i++) { const r = (i / 14) * gR; prof.push([r, zG - sag + (Rc - Math.sqrt(Rc * Rc - r * r))]); }
    ks.add(revolve(prof, { segs: 128 }), glassMat);
    glassZ = zG - sag;
  }
  const hoodGroup = buildLensHood(lib, def, lens, zFrontFace);
  if (hoodGroup) extGroup.add(hoodGroup);
  const filterObj = buildLensFilter(lib, def, lens, zFrontFace, hov);
  if (filterObj) extGroup.add(filterObj.group);

  // ─ rear: bayonet lugs, rear element housing, cocking coupling (built lazily when dismounted / exploded / cutaway)
  const rearMount = new THREE.Group();
  rearMount.name = 'rearMount';
  rearMount.visible = false;
  g.add(rearMount);
  const CY = -27.2;
  const coupling = new THREE.Group(); coupling.position.set(0, CY, 9.0); coupling.rotation.z = 0.6;
  rearMount.add(coupling);
  let rearBuilt = false;
  const ensureRearMount = () => {
    if (rearBuilt) return false;
    rearBuilt = true;
    const krm = new Kit(), steel = lib.get('steel'), anod = lib.get('anod');
    const rearGlassMat = lib.prepare(new THREE.MeshPhysicalMaterial({ name: `cfRearGlass_${lens.id}`, color: 0x130b20, metalness: 0.14, roughness: 0.03, clearcoat: 1.0, clearcoatRoughness: 0.02, specularIntensity: 1.0, envMapIntensity: 1.75 }), {});
    const arcSector = (rIn, rOut, a0, a1) => {
      const s = new THREE.Shape(); s.absarc(0, 0, rOut, a0, a1, false); s.absarc(0, 0, rIn, a1, a0, true); s.closePath(); return s;
    };
    const rPlateIn = def.rearType === 'tele' ? 21.6 : 20.0;
    // Authentic gleaming machined stainless steel Hasselblad V-mount rear flange (z = 0..4.5) + dark undercut throat + matte-black rear baffle plate (z = 9.2)
    ring(krm, steel, [[33.6, 0, 0.3], [33.6, 4.3, 0.45], [32.9, 4.5, 0.4], [30.1, 4.5, 0.3]], { segs: 128 });
    ring(krm, anod, [[30.1, 4.45], [30.1, 8.85, 0.3], [27.6, 9.2, 0.2], [rPlateIn, 9.2]], { segs: 128 });
    // 3 watertight beveled gleaming stainless V-bayonet locking ears over dark undercut throat (z = 5.2..7.4 mm)
    for (let i = 0; i < 3; i++) {
      const a0 = (i * 120 + 50) * DEG;
      krm.add(slab(arcSector(30.0, 35.8, a0, a0 + 40 * DEG), 2.15, 0.24, 24, 0.45, 2), bright, T(0, 0, 5.25));
    }
    {
      const zRearGlass = def.rearType === 'tele' ? 8.3 : 10.0;
      const Rc = 42.0, sag = Rc - Math.sqrt(Rc * Rc - rRear * rRear), rProf = [];
      for (let i = 12; i >= 0; i--) { const r = (i / 12) * rRear; rProf.push([r, zRearGlass + sag - (Rc - Math.sqrt(Rc * Rc - r * r))]); }
      krm.add(new THREE.CircleGeometry(rRear + 0.1, 48), flock, T(0, 0, zRearGlass - 0.6));
      krm.add(revolve(rProf, { segs: 96 }), rearGlassMat);
    }
    const sint = lib.get('sintered');
    if (def.rearType === 'tele') {
      const bShape = new THREE.Shape().absarc(0, 0, 22.0, 0, TAU, false);
      bShape.holes.push(rrPath(-16.2, -16.2, 16.2, 16.2, 6.6, new THREE.Path()));
      krm.add(slab(bShape, 1.8, 0.4, 24, 0.8), sint, T(0, 0, 9.25, 0, 0, -12 * DEG));
      krm.add(revolve([[rRear, 8.3], [rRear, 9.15, 0.3], [rRear + 1.5, 9.3, 0.4], [rRear + 1.5, 8.85, 0.3], [rRear + 3.2, 9.0, 0.4], [22.0, 8.5]], { segs: 64, crease: 30 }), satinBlack);
      [25 * DEG, 205 * DEG].forEach((ph) => {
        const rSp = rRear + 0.8;
        krm.add(rbox(0.55, 1.4, 0.28, 0.05, 1), flock, T(rSp * Math.sin(ph), rSp * Math.cos(ph), 9.28, 0, 0, -ph));
      });
    } else if (def.rearType === 'wide') {
      const r1 = rRear + 2.3, r2 = rRear + 4.7;
      krm.add(revolve([[rRear, 10.0], [rRear, 11.4, 0.3], [r1 - 0.2, 11.55, 0.4], [r1, 11.15, 0.3], [r2 - 0.2, 11.2, 0.4], [r2, 10.8, 0.3], [r2, 9.2]], { segs: 64, crease: 30 }), satinBlack);
      [[25 * DEG, (rRear + r1) / 2, 11.53], [205 * DEG, (rRear + r1) / 2, 11.53], [115 * DEG, (r1 + r2) / 2, 11.18], [295 * DEG, (r1 + r2) / 2, 11.18]].forEach(([ph, rSp, zz]) => {
        krm.add(rbox(0.6, 1.55, 0.3, 0.05, 1), flock, T(rSp * Math.sin(ph), rSp * Math.cos(ph), zz, 0, 0, -ph));
      });
      krm.add(revolve([[r2, 9.2], [r2 + 0.3, 9.55, 0.4], [21.8, 9.55, 0.5], [22.2, 9.22]], { segs: 64, crease: 30 }), sint);
      [-35 * DEG, 145 * DEG].forEach((ph) => {
        const rSp = r2 + 1.1;
        krm.add(rbox(0.65, 1.65, 0.3, 0.05, 1), flock, T(rSp * Math.sin(ph), rSp * Math.cos(ph), 9.53, 0, 0, -ph));
      });
    } else {
      krm.add(revolve([[rRear, 10.0], [rRear, 11.3, 0.3], [rRear + 0.8, 11.6, 0.4], [19.0, 11.6, 0.4], [19.4, 11.2, 0.3], [19.4, 9.2]], { segs: 64, crease: 30 }), satinBlack);
      [25 * DEG, 205 * DEG].forEach((ph) => {
        const rSp = (rRear + 19.2) / 2;
        krm.add(rbox(0.65, 1.8, 0.32, 0.05, 1), flock, T(rSp * Math.sin(ph), rSp * Math.cos(ph), 11.58, 0, 0, -ph));
      });
      krm.add(revolve([[19.4, 9.25], [21.0, 9.45, 0.5], [22.8, 9.25]], { segs: 64 }), sint);
    }
    [[-30, 25.6], [-74, 25.0], [-122, 25.6], [58, 25.2], [104, 25.6], [140, 24.8], [205, 25.4], [-160, 25.0]].forEach(([a, r]) => {
      const ph = a * DEG, x = r * Math.sin(ph), y = r * Math.cos(ph);
      krm.add(revolve([[1.3, 9.15], [1.3, 9.4, 0.5], [0.8, 9.6, 0.5], [0, 9.65]], { segs: 16 }), lib.get('satinBlack'), T(x, y, 0));
      krm.add(rbox(1.8, 0.3, 0.2, 0.05, 1), flock, T(x, y, 9.65, 0, 0, ph + 0.4)); krm.add(rbox(0.3, 1.8, 0.2, 0.05, 1), flock, T(x, y, 9.65, 0, 0, ph + 0.4));
    });
    { const ph = -44 * DEG, r = 26.9, s = new THREE.Shape(), h = new THREE.Path();
      s.moveTo(0, 1.25); s.lineTo(1.15, -0.75); s.lineTo(-1.15, -0.75); s.lineTo(0, 1.25);
      h.moveTo(0, 0.7); h.lineTo(-0.68, -0.45); h.lineTo(0.68, -0.45); h.moveTo(0, 0.7); s.holes.push(h);
      krm.add(new THREE.ShapeGeometry(s), lib.get('orange'), T(r * Math.sin(ph), r * Math.cos(ph), 9.22, 0, 0, Math.PI + ph)); }
    krm.add(revolve([[3.4, -0.2, 0.2], [3.4, 0.85, 0.5], [2.45, 0.9, 0.3], [2.45, 0.0]], { segs: 24 }), lib.get('satinBlack'), T(0, CY, 9.0));
    const kc = new Kit();
    kc.add(revolve([[2.35, 0.0], [2.35, 1.62, 0.5], [1.95, 1.78, 0.4], [0, 1.78]], { segs: 24 }), lib.get('steel'));
    kc.add(rbox(4.75, 0.82, 0.58, 0.08, 1), flock, T(0, 0, 1.68));
    kc.build(coupling);
    const orange = lib.get('orange'), A0 = 0.6 * Math.PI, AL = 0.6 * Math.PI;
    krm.add(new THREE.TorusGeometry(4.8, 0.3, 6, 24, AL), orange, T(0, CY, 9.25, 0, 0, A0));
    { const ah = new THREE.Shape(); ah.moveTo(-1.0, 0); ah.lineTo(1.0, 0); ah.lineTo(0, 1.7); ah.lineTo(-1.0, 0); krm.add(new THREE.ShapeGeometry(ah), orange, T(4.8 * Math.cos(A0 + AL), CY + 4.8 * Math.sin(A0 + AL), 9.26, 0, 0, A0 + AL)); }
    krm.add(revolve([[0, 0], [0.7, 0]], { segs: 12 }), orange, T(6.3 * Math.cos(0.6), CY + 6.3 * Math.sin(0.6), 9.26, 0, Math.PI, 0));
    { const ph = 164 * DEG, x = 30.6 * Math.sin(ph), y = 30.6 * Math.cos(ph);
      krm.add(revolve([[2.5, 9.1], [2.5, 9.6, 0.4], [1.6, 9.7, 0.3], [1.5, 9.3]], { segs: 24 }), lib.get('brass'), T(x, y, 0));
      krm.add(rbox(1.0, 1.8, 1.2, 0.2, 1), lib.get('steel'), T(x, y, 9.8, 0, 0, ph)); }
    krm.build(rearMount);
    return true;
  };

  // ─ inside (cutaway): flocked tube, element cells, iris, Prontor leaf shutter
  const rWall = 30.2;
  ks.add(revolve([[rWall, -0.5], [rWall, Math.max(glassZ, zFrontFace + 6) + 4]], { segs: 96 }), flock);
  const opt = OPTICS[def.optics] || OPTICS[80];
  const sagFn = (R, r) => (Math.abs(R) < r ? 0 : Math.sign(R) * (Math.abs(R) - Math.sqrt(R * R - r * r)));
  const place = (list, z0, z1, rRef, first) => {
    let zPrevC = -Infinity, zPrevR = -Infinity;
    return list.map(([t, rf, th, R1, R2, gapAfter = 0.85], i) => {
      const skip = first && i === 0;
      const r = Math.min(rWall - 1.6, rRef * rf);
      const s1 = sagFn(R1 * r, r), s2 = sagFn(R2 * r, r);
      const z = Math.max(lerp(z0, z1, t), zPrevC, zPrevR - s1);
      zPrevC = z + th + gapAfter;
      zPrevR = z + th - s2 + gapAfter;
      return { z, r, th, R1, R2, skip };
    });
  };
  const frontStart = glassZ, frontEnd = zBl - 2.6;
  const els = [
    ...place(opt.front, frontStart, frontEnd - 1.8, Math.min(glassR, rWall - 1.6), true),
    ...place(opt.rear, zBl + 3.0, -6, 17.5, false),
  ];
  const secPolys = [], glassPolys = [];
  inner.visible = false;
  const cellSpans = [];
  els.forEach((e) => {
    const R1 = e.R1 * e.r, R2 = e.R2 * e.r;
    const s1Rim = sagFn(R1, e.r), s2Rim = sagFn(R2, e.r);
    const kSag = s1Rim + s2Rim > e.th - 1.0 ? Math.max(0.2, (e.th - 1.0) / (s1Rim + s2Rim)) : 1.0;
    const sag = (R, r) => kSag * sagFn(R, r);
    const gPoly = [];
    for (let i = -12; i <= 12; i++) { const y = (i / 12) * e.r; gPoly.push([e.z + sag(R1, Math.abs(y)), y]); }
    for (let i = 12; i >= -12; i--) { const y = (i / 12) * e.r; gPoly.push([e.z + e.th - sag(R2, Math.abs(y)), y]); }
    glassPolys.push(gPoly);
    if (e.skip) return;
    const za = e.z + sag(R1, e.r) - 0.4, zb = e.z + e.th - sag(R2, e.r) + 0.4;
    const z0 = Math.min(za, zb), z1 = Math.max(za, zb);
    cellSpans.push([e.r, z0, z1]);
    secPolys.push([[z0, e.r - 0.7], [z0, e.r + 1.2], [z1, e.r + 1.2], [z1, e.r + 0.3], [z0 + 0.6, e.r + 0.3], [z0 + 0.6, e.r - 0.7]]);
    if (rWall - (e.r + 1.2) > 1.2) secPolys.push([[z1 - 1.4, e.r + 1.2], [z1 - 1.4, rWall], [z1, rWall], [z1, e.r + 1.2]]);
  });
  if (def.front === 'fisheye') {
    const zFil = zBl - 4.2, rFil = 13.0;
    glassPolys.push([[zFil, -rFil], [zFil, rFil], [zFil + 1.1, rFil], [zFil + 1.1, -rFil]]);
    secPolys.push([[zFil - 0.3, rFil], [zFil - 0.3, rWall], [zFil + 1.4, rWall], [zFil + 1.4, rFil]]);
  }
  // Prontor leaf shutter + 5-blade tangent-pentagon Zeiss iris on extGroup (visible through front/rear glass and in cutaway)
  ks.add(revolve([[15.8, zBl - 0.32, 0.3], [16.3, zBl - 0.48, 0.4], [rWall, zBl - 0.48]], { segs: 96, crease: 30 }), satinBlack);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU;
    ks.add(revolve([[0.85, -0.45], [0.85, 0.58, 0.3], [0, 0.60]], { segs: 12 }), lib.get('brass'), T(Math.cos(a) * SHUTTER_PIN_R, Math.sin(a) * SHUTTER_PIN_R, zBl));
  }
  const { shBladeGeo, fixedIrisGeo, irisBladeGeo, jawBoxGeo } = diaphragmGeos(lib);
  let bladeMat = lib.cache.get('prontorBlade|1');
  if (!bladeMat) {
    bladeMat = lib.prepare(new THREE.MeshStandardMaterial({
      name: 'blade', color: 0x1f2124, metalness: 0.32, roughness: 0.48, side: THREE.DoubleSide,
    }), { clip: true, wear: 'irisBlade' });
    lib.cache.set('prontorBlade|1', bladeMat);
  }
  const blades = [0, 1, 2, 3, 4].map(() => ({ rotation: { z: SHUTTER_SWING } }));
  const bladeBase = Array.from({ length: 5 }, (_, i) => {
    const a = (i / 5) * TAU;
    return { pos: new THREE.Vector3(Math.cos(a) * SHUTTER_PIN_R, Math.sin(a) * SHUTTER_PIN_R, i * 0.12), rot: a + Math.PI };
  });
  const bladeInst = new THREE.InstancedMesh(shBladeGeo, bladeMat, 5);
  bladeInst.position.z = zBl;
  bladeInst.userData.noReceive = true;
  extGroup.add(bladeInst);

  let irisBladeMat = lib.cache.get('irisBlade|1');
  if (!irisBladeMat) {
    irisBladeMat = lib.prepare(new THREE.MeshStandardMaterial({
      name: 'irisBlade', color: 0x282a2e, metalness: 0.30, roughness: 0.50, side: THREE.DoubleSide,
    }), { clip: true, wear: 'irisBlade' });
    lib.cache.set('irisBlade|1', irisBladeMat);
  }
  const fixedIris = new THREE.Mesh(fixedIrisGeo, irisBladeMat);
  fixedIris.position.z = zBl + 0.65;
  fixedIris.userData.noReceive = true;
  extGroup.add(fixedIris);

  const zIris = zBl + 1.85;
  const irisInst = new THREE.InstancedMesh(irisBladeGeo, irisBladeMat, 5);
  irisInst.position.z = zIris;
  irisInst.userData.noReceive = true;
  extGroup.add(irisInst);

  let innerBuilt = false, jawInst = null, lastBladeRot = NaN, lastIrisR = -1, lastJawR = -1;
  const _bladeObj = new THREE.Object3D();
  const syncBlades = () => {
    const b0 = blades[0].rotation.z;
    if (Math.abs(b0 - lastBladeRot) < 1e-4) return;
    lastBladeRot = b0;
    for (let i = 0; i < 5; i++) {
      _bladeObj.position.copy(bladeBase[i].pos);
      _bladeObj.rotation.set(0, 0, bladeBase[i].rot + blades[i].rotation.z);
      _bladeObj.scale.set(1, 1, 1);
      _bladeObj.updateMatrix();
      bladeInst.setMatrixAt(i, _bladeObj.matrix);
    }
    bladeInst.instanceMatrix.needsUpdate = true;
  };
  const syncIris = (rIris, isCut) => {
    const r = THREE.MathUtils.clamp(rIris, IRIS.rMin, IRIS.rMax);
    const turn = Math.asin(r / IRIS.rPin);
    if (Math.abs(r - lastIrisR) > 1e-4) {
      lastIrisR = r;
      for (let i = 0; i < 5; i++) {
        const a = (i / IRIS.n) * TAU;
        _bladeObj.position.set(IRIS.rPin * Math.cos(a), IRIS.rPin * Math.sin(a), (i - (IRIS.n - 1) / 2) * 0.22);
        _bladeObj.rotation.set(0, 0, a - turn);
        _bladeObj.scale.set(1, 1, 1);
        _bladeObj.updateMatrix();
        irisInst.setMatrixAt(i, _bladeObj.matrix);
      }
      irisInst.instanceMatrix.needsUpdate = true;
    }
    if (isCut && jawInst && Math.abs(r - lastJawR) > 1e-4) {
      lastJawR = r;
      for (let k = 0; k < 2; k++) {
        const side = k === 0 ? 1 : -1;
        let s = IRIS.rOut;
        for (let i = 0; i < IRIS.n; i++) {
          const ny = Math.sin((i / IRIS.n) * TAU - turn + Math.PI / 2) * side;
          if (ny > 1e-3) s = Math.min(s, r / ny);
        }
        const h = IRIS.rOut - s;
        _bladeObj.position.set(0, side * (s + h / 2), zIris - 0.1);
        _bladeObj.rotation.set(0, 0, 0);
        _bladeObj.scale.set(0.4, Math.max(0.01, h), IRIS.thick);
        _bladeObj.updateMatrix();
        jawInst.setMatrixAt(k, _bladeObj.matrix);
      }
      jawInst.instanceMatrix.needsUpdate = true;
    }
  };
  const ensureInner = () => {
    if (innerBuilt) return false;
    innerBuilt = true;
    cellSpans.forEach(([r, z0, z1]) => {
      ki.add(revolve([[r + 1.2, z1], [r + 1.2, z0]], { segs: 48 }), flock);
      ki.add(revolve([[r - 0.7, z0], [r + 1.2, z0]], { segs: 48 }), flock);
    });
    ki.build(inner);
    const cutGlassMat = lib.prepare(new THREE.MeshPhysicalMaterial({
      color: 0xaad4de, roughness: 0.12, metalness: 0.04, ior: 1.62, transparent: true, opacity: 0.56,
      iridescence: 0.65, iridescenceIOR: 1.38, depthWrite: false,
    }), { clip: false });
    cutGlassMat.userData.single = true;
    inner.add(sectionPair(glassPolys, cutGlassMat));
    let jawMat = lib.cache.get('irisJaw|0');
    if (!jawMat) {
      jawMat = lib.prepare(new THREE.MeshStandardMaterial({
        name: 'irisJaw', color: 0xc6c9cc, metalness: 0.25, roughness: 0.54,
      }), { clip: false });
      lib.cache.set('irisJaw|0', jawMat);
    }
    jawInst = new THREE.InstancedMesh(jawBoxGeo, jawMat, 2);
    inner.add(jawInst);
    lastJawR = -1;
    syncIris(lastIrisR > 0 ? lastIrisR : 10, true);
    return true;
  };
  // cut section: barrel walls (outer silhouette down to the flocked tube), shutter housing, element cells
  {
    const outer = sil.slice().sort((a, b) => b[0] - a[0]);
    const zMin = outer[outer.length - 1][0];
    const wall = [];
    outer.forEach(([zz, r]) => wall.push([zz, r]));
    const inRad = (zz) => (zz > zBl - 2.2 && zz < zBl + 2.2 ? 26.5 : ((def.front === 'fle' && def.cone) || def.front === 'fisheye' || def.front === 'long') && zz < zSh - 2 ? Math.max(rWall, (outer.find((p) => p[0] <= zz) || outer[outer.length - 1])[1] - 3) : rWall);
    const zs = [zMin + 0.5, ...outer.map((p) => p[0]).filter((zz) => zz < -0.5 && zz > zMin + 0.5), zBl - 2.2, zBl - 2.19, zBl + 2.19, zBl + 2.2, -0.5].sort((a, b) => a - b);
    const innerLine = zs.map((zz) => [zz, Math.min(inRad(zz), (outer.find((p) => p[0] <= zz) || [0, 99])[1] - 1.2)]);
    const upper = [...wall, ...innerLine];
    const polys = [upper, upper.map(([zz, r]) => [zz, -r]).reverse()];
    secPolys.forEach((p) => { polys.push(p); polys.push(p.map(([zz, r]) => [zz, -r]).reverse()); });
    extGroup.userData.sectionPolys = polys;
  }
  // assemble
  ksCollar.build(g);
  ks.build(extGroup);
  syncBlades();
  syncIris(10, false);
  const focusMeshes = kf.build(focus, 'focus');
  const apertureMeshes = [...ka.build(aperture, 'aperture'), ...evMeshes];
  const shutterMeshes = [...ksh.build(shutter, 'shutter'), ...fBtnMeshes];
  return {
    group: g, extGroup, helicSleeve, get helicCollar() { return helicCollar; }, ensureSleeve,
    rearMount, ensureRearMount, inner, ensureInner, syncBlades, syncIris,
    lens, L, def, focus, aperture, shutter, dofLever, evBtn, fleGroup, fBtn, hoodGroup, filterObj,
    blades, zBl, atlas, focusMeshes, apertureMeshes, shutterMeshes, filterMeshes: filterObj ? filterObj.meshes : [], mountPoint, coupling,
  };
}

const PARTS = ['focus', 'aperture', 'shutter', 'filter', 'crank', 'release', 'finder', 'aim', 'roll'];

export function createCamera503({ lens, tripod: withTripod = true }) {
  const t0 = performance.now();
  const timing = {}; let tPrev = t0;
  const mark = (k) => { const t = performance.now(); timing[k] = +(t - tPrev).toFixed(1); tPrev = t; };
  const clipPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 1e7);
  const _lensPos = new THREE.Vector3(), _cutN = new THREE.Vector3(), _cutP = new THREE.Vector3();
  const base = baseMaterials();
  mark('textures');
  const lib = new MatLib(base, [clipPlane]);
  const hov = {};
  PARTS.forEach((name) => { hov[name] = { name, amount: { value: 0 }, color: { value: new THREE.Color(1.0, 0.82, 0.5).multiplyScalar(0.28) }, target: 0 }; });

  const root = new THREE.Group();
  root.name = 'camera503';
  // (tripod: false builds the camera on its head alone, for a bench that shows it off the tripod: about 90 ms less)
  const tripod = withTripod ? buildTripod(lib, DIM.tripod) : { group: null, top: 0 };
  mark('tripod');
  if (tripod.group) root.add(tripod.group);
  const head = buildHead(lib, hov);
  mark('head');
  const yaw = new THREE.Group(); yaw.position.y = tripod.top;
  yaw.add(head.yawMM);
  const pitch = new THREE.Group(); pitch.position.y = head.pitchY;
  pitch.add(head.pitchMM);
  yaw.add(pitch);
  // side tilt (roll) about the lens axis, pivoting on the head's side-tilt axle; the camera rides on it
  const rollG = new THREE.Group(); rollG.position.y = head.rollY;
  head.rollMM.position.y = -head.rollY;
  rollG.add(head.rollMM);
  pitch.add(rollG);
  root.add(yaw);
  // millimetres from here
  const mm = new THREE.Group();
  mm.scale.setScalar(0.001);
  rollG.add(mm);
  // where the camera sits on the head's plate (mm, pitch frame): under the body's foot, or —
  // for a lens with its own foot (the 500) — under the lens foot, body cantilevered behind
  const plateTop = head.plateTop;
  const mountOffset = (lensObj) => (lensObj.mountPoint
    ? new THREE.Vector2(plateTop - lensObj.mountPoint.y, -(DIM.flange + lensObj.mountPoint.z))
    : new THREE.Vector2(plateTop - (BOT - DIM.foot), -DIM.footZ));   // (the foot centred on the plate)
  const mountCur = new THREE.Vector2();

  const body = buildBody(lib, hov);
  mark('body');
  const box = buildMirrorBox(lib);
  mark('box');
  const mag = buildMagazine(lib);
  mark('magazine');
  const finder = buildFinder(lib, hov);
  /** The loupe shows the screen beneath it 4.5× larger: each vertex of its image disc maps to the point of the screen
   *  under the disc's centre plus a 4.5th of the vertex's own offset, in the screen's axes (its mirror included).
   *  It runs every frame the loupe is out, so the picture holds still on the screen while the lens swings over it,
   *  and fades as the lens tilts away. `crop` is the part of the screen the texture holds (while you look down
   *  through the loupe, the lens view renders only the centre of the screen, at full resolution). */
  const MAG = 4.5, _mc = new THREE.Vector3(), _mp = new THREE.Vector3(), _mu = new THREE.Vector3(), _mv = new THREE.Vector3(), _mn = new THREE.Vector3();
  let magRest = null;   // (the lowered loupe's offset from the screen's centre, in screen units: lowered, it shows the centre)
  function magOffset() {
    const disc = finder.magView, img = box.screenImg;
    disc.updateWorldMatrix(true, false); img.updateWorldMatrix(true, false);
    const e = img.matrixWorld.elements, scale = Math.hypot(e[0], e[1], e[2]);
    _mu.set(e[0], e[1], e[2]).normalize(); _mv.set(e[4], e[5], e[6]).normalize();
    _mc.setFromMatrixPosition(disc.matrixWorld);
    _mp.setFromMatrixPosition(img.matrixWorld).subVectors(_mc, _mp);
    return [_mp.dot(_mu) / scale, _mp.dot(_mv) / scale, scale];
  }
  function alignMagnifier(crop = 1) {
    const disc = finder.magView;
    if (!magRest) {   // measure it once, with the loupe swung fully down
      const rx = finder.mag.rotation.x;
      finder.mag.rotation.x = -Math.PI / 2;
      magRest = magOffset();
      finder.mag.rotation.x = rx;
    }
    const [ou, ov, scale] = magOffset(), d = disc.matrixWorld.elements;
    const span = DIM.screen * scale * crop;   // the width of screen the texture covers, in world units
    const cu = (ou - magRest[0]) * scale, cv = (ov - magRest[1]) * scale;
    const pos = disc.geometry.attributes.position, uv = disc.geometry.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      _mp.fromBufferAttribute(pos, i).applyMatrix4(disc.matrixWorld).sub(_mc);
      uv.setXY(i, 0.5 + (cu + _mp.dot(_mu) / MAG) / span, 0.5 + (cv + _mp.dot(_mv) / MAG) / span);
    }
    uv.needsUpdate = true;
    _mn.set(d[8], d[9], d[10]).normalize();
    const facing = Math.abs(_mn.dot(_mp.crossVectors(_mu, _mv)));
    disc.material.color?.setScalar(0.7 * THREE.MathUtils.smoothstep(facing, 0.55, 0.95));
  }
  mark('finder');
  mm.add(body.group, box.group);
  const magZ = BACK + 0.3;
  const magMount = new THREE.Group(); magMount.position.set(0, 3, magZ); magMount.add(mag.group); mm.add(magMount);
  const finderY = DIM.finder.y;
  const finderMount = new THREE.Group(); finderMount.position.set(0, finderY, DIM.finder.z); finderMount.add(finder.group); mm.add(finderMount);
  const lensMount = new THREE.Group(); lensMount.position.z = DIM.flange; mm.add(lensMount);
  let L = buildLens(lib, lens, hov);
  lensMount.add(L.group);
  mountCur.copy(mountOffset(L));
  mark('lens');

  // shadow blob under the tripod (soft contact shadow; never casts)
  const blobCv = document.createElement('canvas'); blobCv.width = blobCv.height = 128;
  const bg = blobCv.getContext('2d'), grad = bg.createRadialGradient(64, 64, 2, 64, 64, 64);
  grad.addColorStop(0, 'rgba(0,0,0,0.42)'); grad.addColorStop(0.5, 'rgba(0,0,0,0.16)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
  bg.fillStyle = grad; bg.fillRect(0, 0, 128, 128);
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(blobCv), transparent: true, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2; blob.position.y = 0.012; blob.renderOrder = -1;
  blob.userData.noShadow = true;
  if (withTripod) root.add(blob);

  const lensLists = (Lx) => [Lx.focusMeshes, Lx.apertureMeshes, Lx.shutterMeshes, Lx.filterMeshes];
  const lensDynNodes = (Lx) => [Lx.group, Lx.extGroup, Lx.helicSleeve, Lx.rearMount, Lx.coupling, Lx.inner, Lx.focus, Lx.aperture, Lx.shutter, Lx.dofLever, Lx.evBtn, Lx.fleGroup, Lx.fBtn, Lx.hoodGroup, Lx.filterObj?.group, Lx.filterObj?.rotGroup].filter(Boolean);
  const dynamicSet = (Lx) => new Set([
    mm, body.group, body.crank, body.crankHandle, body.release, body.preRelease, body.dial?.knob, body.status, body.rearFace, body.innerFloor, body.linerMesh,
    box.group, box.mirrorPivot, box.mirrorPins, box.mirrorLiveMesh, box.screen, box.ttl, box.mechCam, box.mechSpring, box.auxRod, box.auxTop, box.auxBot,
    magMount, mag.group, mag.slide, mag.insert, mag.insertInner, mag.frontFace, mag.keyG, mag.tabG, mag.keySeat, mag.magCrank, mag.magCrankArm, mag.magCrankDot, mag.smile, mag.signal,
    finderMount, finder.group, finder.lid, finder.rear, finder.left.grp, finder.left.front, finder.left.back, finder.right.grp, finder.right.front, finder.right.back, finder.mag, finder.magGlass, finder.magView, finder.rails,
    lensMount, ...lensDynNodes(Lx),
    head.yawMM, head.pitchMM, head.rollMM, head.aimG, head.lockG, head.tiltLever, head.rollLever, head.plateKnob, head.bubX, head.bubZ, head.bubble,
  ].filter(Boolean));
  const pickLists = (Lx) => [...lensLists(Lx), body.crankMeshes, body.releaseMeshes, finder.meshes, head.aimMeshes, head.rollMeshes];
  mergeStaticRigid(root, { dynamic: dynamicSet(L), lists: pickLists(L) });
  const toLayer = (obj) => obj.traverse((o) => {
    if (!o.isMesh) return;
    o.layers.set(1);
    const shadow = !o.userData.noShadow && o.material !== box.screenMat && !o.material.transparent;
    o.castShadow = shadow;
    o.receiveShadow = !o.userData.noShadow && !o.userData.noReceive && o.material?.name !== 'irisBlade';
  });
  toLayer(root);

  const pickables = { focus: [], aperture: [], shutter: [], filter: [], crank: [], release: [], finder: [], aim: head.aimMeshes, roll: head.rollMeshes };
  function refreshPickables() {
    const set = (k, list) => { pickables[k].length = 0; if (list) pickables[k].push(...list); };
    set('focus', L.focusMeshes); set('aperture', L.apertureMeshes); set('shutter', L.shutterMeshes);
    set('filter', L.filterMeshes);
    set('crank', body.crankMeshes); set('release', body.releaseMeshes); set('finder', finder.meshes);
  }
  refreshPickables();

  let screenLive = null;
  const st = {
    finderK: 0, magK: 0, screenCrop: 1, keyA: 0, keyTab: 0, loadK: 0, explodeK: 0, mirrorK: 0, leafK: 1, auxK: 0, crank: 0, crankOpen: 0, lensOut: 0, lensTwist: 0, press: 0,
    // (the Camera School's hand-worked parts: the dark slide out of the magazine, the magazine off the body, the film
    //  insert out of its shell, the lens's coupling slot turned off its red dot, the pre-release pushed)
    slideOut: 1, magOff: 0, insertOut: 0, coupling: 0, pre: 0,
    focusRot: 0, apRot: 0, shRot: 0, focusT: 0, apT: 0, shT: 0, iris: 10, irisT: 10, irisWorkT: 10,
    focusExt: 0, focusExtT: 0, fleRot: 0, fleRotT: 0, dofK: 0, dofT: 0, evK: 0, evT: 0, fBtnK: 0, fBtnT: 0,
    hoodOn: false, filterId: 'none', polAngle: 90, polAngleT: 90,
    snapRings: true,
  };
  const tweens = [];
  let labelsShown = null; const _labelV = new THREE.Vector3();
  const tween = (dur, fn, ease = easeInOut, key = null) => new Promise((res) => tweens.push({ t: 0, dur, fn, ease, res, key }));
  /** a pause on the camera's own clock (the frame's dt): the release sequence keeps its timing when frames are stepped */
  const hold = (ms) => tween(ms / 1000, () => {});
  /** Animate st[key] to `to`. A newer animation of the same key supersedes the running one (it resolves at once, from
   *  where it had got to) — tweens run newest-first, so the older used to write last and win (W W, E E pressed fast). */
  const animate = (key, to, dur, ease) => {
    for (let i = tweens.length - 1; i >= 0; i--) if (tweens[i].key === key) { const [tw] = tweens.splice(i, 1); tw.res(); }
    const from = st[key];
    return tween(dur, (k) => { st[key] = lerp(from, to, k); }, ease, key);
  };

  // ring targets from the live state
  let live = null, filmKey = '', frameKey = -1, lastFilmSpec = null;

  // ── the film in the holder: which spool is where, how much paper each carries, the web between them
  const F = mag.film;
  let rollState = null;              // { state: 'loaded' | 'ready' | 'done', frame } from Camera School; else frames as shot
  let roles = { top: 0, bot: 1, spare: 2 }, spins = [0, 0, 0], filmLook = '', webKey = '';
  const progressOf = (rs) => rs.state === 'done' ? 1 : rs.state === 'loaded' ? 0.03 : 0.1 + 0.85 * (Math.min(12, Math.max(1, rs.frame)) - 1) / 11;
  const pathFor = (botR, topR) => beltPath([
    { z: F.SPZ, y: -F.SPY, r: botR }, { z: F.ROL.z, y: -F.ROL.y, r: -(F.ROL.r + 0.05) },
    { z: F.ROL.z, y: F.ROL.y, r: -(F.ROL.r + 0.05) }, { z: F.SPZ, y: F.SPY, r: topR }]);
  /** the web as a ribbon along the path, up to `len` mm from the supply roll; u runs back from the leader's tip */
  function setWeb(path, len, paper) {
    const pts = path.filter((p) => p.s <= len + 1e-6);
    if (pts.length < 2) { F.web.visible = false; return; }
    const pos = [], uv = [], idx = [], hw = paper ? SPOOL.paperHalf : 30.5;
    pts.forEach((p, i) => {
      pos.push(-hw, p.y, p.z, hw, p.y, p.z); uv.push(-p.s / F.LEAD, 0, -p.s / F.LEAD, 1);
      if (i) { const a = 2 * i - 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
    g.computeVertexNormals();
    F.web.geometry.dispose(); F.web.geometry = prep(g); F.webBack.geometry = F.web.geometry;
    F.web.material = paper ? F.paperMat : F.filmMat; F.webBack.visible = paper;
    F.web.visible = true;
  }
  const placeAt = (sp, y, z) => sp.position.set(0, y, z);
  const LOAD_AT = { spools: 2.6, clamp: 3.0, leader: 4.4, aligned: 5.6, closed: 6.0 };   // (seconds into the 6 s load)
  const ADV = 1.25 * TAU * SPOOL.coreR;   // (the knob's turn and a quarter, after threading, brings the arrow round)
  /** the start arrow on a roll of radius r, at angle a round it (0: facing the back of the holder) */
  const putArrow = (sp, a) => { sp.add(F.arrow); F.arrow.visible = true; F.arrow.rotation.set(-a, 0, 0); F.arrow.children[0].position.set(0, 0, sp.userData.r + 0.06); };
  /** Lay the film out for the current state — or, while a roll is being loaded (st.loadK > 0), for that moment of it */
  function placeFilm() {
    const rs = rollState || { state: 'ready', frame: Math.max(1, live?.frame || 1) };
    const loading = st.loadK > 0 && st.loadK < 1;
    const key = loading ? `L${st.loadK.toFixed(4)}` : `${rs.state}|${rs.frame}|${roles.top}${roles.bot}`;
    if (key === webKey) return;
    webKey = key;
    const S = F.spools, top = S[roles.top], bot = S[roles.bot], spare = S[roles.spare];
    [top, bot, spare].forEach((s) => { s.visible = true; s.rotation.set(0, 0, 0); s.userData.setSealed(false); });
    F.arrow.visible = false;
    if (!loading) {
      const p = progressOf(rs), rT = rollR(p * ROLL_AREA), rB = rollR((1 - p) * ROLL_AREA);
      placeAt(top, F.SPY, F.SPZ); placeAt(bot, -F.SPY, F.SPZ); spare.visible = false;
      top.userData.setR(rT); bot.userData.setR(rB);
      top.rotation.x = spins[roles.top]; bot.rotation.x = spins[roles.bot];
      F.knob.rotation.x = spins[roles.top];
      if (rs.state === 'done') { F.web.visible = false; return; }
      const path = pathFor(rB, rT), L = path[path.length - 1].s;
      if (rs.state === 'loaded') {   // the leader threaded, the start arrow wound round to the triangle
        putArrow(bot, spins[roles.bot]);
        F.leadTex.offset.x = (L + ADV) / F.LEAD;
        setWeb(path, L, true);
      } else setWeb(path, L, false);
      return;
    }
    // loading (manual pp. 18–19), 6 s: the exposed roll out of the top; the empty spool from the bottom to the top; the
    // new roll in at the bottom, still sealed; the key turned clockwise opens the clamp; the leader drawn under the
    // clamp's lip, round the rollers and into the take-up's slot; the splined knob turned clockwise until the arrow on
    // the roll faces the red triangle; the key turned back
    const τ = st.loadK * 6, ph = (a, b) => smooth01((τ - a) / (b - a));
    const kA = ph(0, 0.9), kB = ph(0.7, 1.9), kC = ph(1.7, 2.6), kE = ph(3.0, 4.4), kF = ph(4.4, 5.6);
    const full = rollR(ROLL_AREA), core = SPOOL.coreR;
    top.userData.setR(full); placeAt(top, F.SPY + 14 * kA, F.SPZ + 40 * kA); top.visible = kA < 1;
    bot.userData.setR(core); placeAt(bot, lerp(-F.SPY, F.SPY, kB), F.SPZ + 30 * Math.sin(Math.PI * kB));
    spare.userData.setR(full); spare.visible = τ > 1.7; placeAt(spare, -F.SPY - 6 * (1 - kC), F.SPZ + 40 * (1 - kC));
    spare.userData.setSealed(τ < 3.0);
    st.keyA = τ < 2.6 ? -Math.PI / 2 : τ < 5.6 ? -Math.PI / 2 * (1 - ph(2.6, 3.0)) : -Math.PI / 2 * ph(5.6, 6.0);
    const path = pathFor(full, core), L = path[path.length - 1].s;
    const endSpin = -(L + ADV) / full;   // (where the supply roll will have turned to: the arrow is printed to face the back then)
    const drawn = L * kE, adv = ADV * kF;
    spare.rotation.x = -(drawn + adv) / full;
    if (τ > 3.0) putArrow(spare, endSpin);
    bot.rotation.x = -adv / core; F.knob.rotation.x = bot.rotation.x;
    if (τ < 3.0) { F.web.visible = false; return; }
    F.leadTex.offset.x = (drawn + adv) / F.LEAD;
    setWeb(path, Math.max(0.5, drawn), true);
    loadEnd = { endSpin, takeSpin: -ADV / core };
  }
  let loadEnd = null;
  const smooth01 = (k) => { k = Math.min(1, Math.max(0, k)); return k * k * (3 - 2 * k); };
  /** Print the roll and its leader for the film: the backing paper's colour and lettering; a fresh roll's seal band */
  function drawRolls(f) {
    // the stock's own roll where we know it (ROLL_LOOKS); else a plain roll of its type's colours
    const type = f?.type || 'c41', name = (f?.name || 'Colour negative').toUpperCase(), T0 = ROLL_TYPE[type] || ROLL_TYPE.c41;
    const look = ROLL_LOOKS[f?.id] ? { inner: '#121212', emulsion: T0.emulsion, ...ROLL_LOOKS[f.id] }
      : { fam: 'kodak', name, edge: T0.paper, paper: T0.paper, paperInk: T0.paperInk, block: T0.paper, band: T0.band, bandInk: T0.bandInk, accent: T0.bandInk, brand: name, inner: T0.inner, emulsion: T0.emulsion };
    F.rollCvs.forEach((cv, sealed) => { paintRoll(cv.getContext('2d'), cv.width, cv.height, look, !!sealed); F.rollTexs[sealed].needsUpdate = true; });
    paintLeader(F.leadCv.getContext('2d'), F.leadCv.width, F.leadCv.height, F.leadCv.width / F.LEAD, look);
    F.leadTex.needsUpdate = true;
    F.webBack.material.color.set(look.inner);
    F.filmMat.color.set(look.emulsion);
    webKey = '';
  }
  // the ISO selector, set to the loaded film: third stops from 16 to 1000 (manual p. 26); the knob turns 20° a third
  const ISO_STEPS = [16, 20, 25, 32, 40, 50, 64, 80, 100, 125, 160, 200, 250, 320, 400, 500, 640, 800, 1000];
  const ISO_LABEL = new Set([16, 25, 40, 64, 100, 200, 400, 800]);
  let dialIso = -1;
  function setDial(iso) {
    const dl = body.dial; if (!dl?.cv) return;
    let idx = 0; ISO_STEPS.forEach((v, i) => { if (Math.abs(Math.log(v / iso)) < Math.abs(Math.log(ISO_STEPS[idx] / iso))) idx = i; });
    if (idx === dialIso) return;
    dialIso = idx;
    const g2 = dl.cv.getContext('2d'), W = 1024, Hh = 340, px = W / 34, cx = W / 2, ccy = (dl.geom.top - dl.geom.cy) * px, STEP = 20 * Math.PI / 180;   // (a third of a stop: 64 · 100 either side of 80, as on the camera)
    g2.clearRect(0, 0, W, Hh); g2.fillStyle = '#ece9df'; g2.textAlign = 'center'; g2.textBaseline = 'middle';
    // the flash bolt and ISO
    g2.save(); g2.translate(46, 40); g2.scale(0.62, 0.62); g2.beginPath(); g2.moveTo(40, 0); g2.lineTo(0, 92); g2.lineTo(34, 92); g2.lineTo(10, 176); g2.lineTo(78, 64); g2.lineTo(42, 64); g2.lineTo(64, 0); g2.closePath(); g2.fill(); g2.restore();
    g2.font = `600 82px ${FONT}`; g2.fillText('ISO', 900, 96);
    // the scale, on an arc about the dial's centre (far below the print), the setting at the top
    const Rt = 14.6 * px;
    ISO_STEPS.forEach((v, i) => {
      const a = (i - idx) * STEP; if (Math.abs(a) > 0.66) return;
      g2.save(); g2.translate(cx + Math.sin(a) * Rt, ccy - Math.cos(a) * Rt); g2.rotate(a);
      if (ISO_LABEL.has(v)) { g2.font = `600 74px ${FONT}`; g2.fillText(String(v), 0, 0); } else { g2.beginPath(); g2.arc(0, 0, 9, 0, TAU); g2.fill(); }
      g2.restore();
    });
    // the fixed index, just above the knob
    const iy = ccy - 13.55 * px;
    g2.beginPath(); g2.moveTo(cx, iy - 22); g2.lineTo(cx - 16, iy + 6); g2.lineTo(cx + 16, iy + 6); g2.closePath(); g2.fill();
    dl.tex.needsUpdate = true;
    dl.knob.rotation.x = (idx - 7) * STEP;   // (the notches turn with the setting)
  }
  function ringTargets(s) {
    const ln = L.lens;
    const d = Math.max(s.focus ?? 10000, ln.minFocusDistance);
    st.focusT = d >= 9999 ? 0 : -focusK(ln) / d;
    st.focusExtT = helicoidExtensionMm(ln, d);
    st.fleRotT = (fleIndexFor(ln, d) ?? 0) * 16 * DEG;   // (a number, not a state object: this runs every frame)
    st.dofT = s.stopDown ? 1 : 0;
    st.evT = s.evLock ? 1 : 0;
    if (s.hoodOn !== undefined) st.hoodOn = Boolean(s.hoodOn);
    if (s.filter !== undefined) st.filterId = (typeof s.filter === 'string' ? s.filter : s.filter?.id) || 'none';
    if (s.polAngle !== undefined) st.polAngleT = s.polAngle ?? 90;
    // f-number: s.aperture when given (half-stops allowed), else interpolate a (fractional) apertureIdx
    const ap = ln.apertureStops, last = ap.length - 1;
    let N = typeof s.aperture === 'number' && s.aperture > 0 ? s.aperture : null;
    if (N == null) {
      const ai = Math.min(last, Math.max(0, s.apertureIdx ?? 0)), i0 = Math.min(last, Math.floor(ai)), i1 = Math.min(last, i0 + 1);
      N = ap[i0] * Math.pow(ap[i1] / ap[i0], ai - i0);
    }
    N = Math.min(ap[last], Math.max(ap[0], N));
    st.apT = -2 * Math.log2(N / ap[0]) * EV_STEP;
    const shIdx = s.shutterIdx ?? 7;
    st.shT = shIdx * SH_STEP;
    st.fBtnT = shIdx < 0 ? 1 : 0;
    const rMax = THREE.MathUtils.clamp(ln.focalLength / (2 * ln.maxAperture), 6, 15);
    const rWork = Math.max(1.2, rMax * (ln.maxAperture / N));
    st.irisWorkT = rWork;
    // True CF lens viewing mechanics: the diaphragm stays wide open for viewing/focusing unless
    // the DoF preview lever is latched (s.stopDown) or the shutter is in its firing/pre-released cycle.
    const stoppedDown = Boolean(s.stopDown) || st.leafK < 0.98 || st.mirrorK > 0.05 || st.pre > 0.05;
    st.irisT = stoppedDown ? rWork : rMax;
  }
  function drawFilm(s) {
    const key = `${s.film?.id}|${s.film?.type}|${s.film?.iso}|${s.film?.name}`;
    if (key !== filmKey) {
      filmKey = key;
      const type = s.film?.type || 'c41';
      // a torn box-end flap: printed card with a type colour band, speed, format and process
      const cg = mag.cardCv.getContext('2d'), W = 320, Hc = 224;
      const band = type === 'bw' ? '#1d1d1d' : type === 'e6' ? '#1f4f9c' : '#e2a320';
      cg.fillStyle = '#f1efe8'; cg.fillRect(0, 0, W, Hc);
      cg.fillStyle = band; cg.fillRect(0, 0, W, 78);
      cg.fillStyle = type === 'c41' ? '#b1261c' : type === 'e6' ? '#e8c440' : '#9a9a9a'; cg.fillRect(0, 78, W, 10);
      cg.textAlign = 'center'; cg.textBaseline = 'middle';
      cg.fillStyle = type === 'c41' ? '#1a1a1a' : '#ffffff';
      cg.font = `800 60px ${FONT}`; cg.fillText(String(s.film?.iso ?? 400), W / 2, 42);
      cg.fillStyle = '#1a1a1a';
      cg.font = `700 26px ${FONT}`; cg.fillText(type === 'bw' ? 'BLACK & WHITE' : type === 'e6' ? 'COLOUR REVERSAL' : 'COLOUR NEGATIVE', W / 2, 122);
      cg.font = `800 40px ${FONT}`; cg.fillText('120', W / 2 - 52, 172);
      cg.font = `700 26px ${FONT}`; cg.fillText(type === 'bw' ? 'ISO ' + (s.film?.iso ?? 400) : type === 'e6' ? 'E-6' : 'C-41', W / 2 + 56, 172);
      // torn top edge
      cg.fillStyle = 'rgba(0,0,0,0.25)'; for (let x = 0; x < W; x += 6) cg.fillRect(x, 0, 6, 2 + ((x * 7919) % 5));
      mag.cardTex.needsUpdate = true;
      // the holder's dial set to the film's speed: ASA above the window, DIN below
      const ig = mag.isoCv.getContext('2d'), iso = s.film?.iso ?? 400;
      ig.clearRect(0, 0, 64, 384); ig.fillStyle = '#e9e7df'; ig.textAlign = 'center'; ig.textBaseline = 'middle';
      ig.font = `700 15px ${FONT}`; ig.fillText(String(iso), 32, 30); ig.fillText(String(Math.round(10 * Math.log10(iso) + 1)), 32, 340);
      ig.font = `800 17px ${FONT}`; ig.fillText('ASA', 32, 50); ig.fillText('DIN', 32, 360);
      mag.isoTex.needsUpdate = true;
      lastFilmSpec = s.film || null;
      if (mag.innerReady()) drawRolls(s.film);
      setDial(s.film?.iso || 100);
    }
    const fr = s.frame ?? 1;
    if (fr !== frameKey) {
      frameKey = fr;
      const c = mag.ctrCv.getContext('2d');
      // (white figures on a black card, as in Commons 503cx-09's window)
      c.fillStyle = '#111111'; c.fillRect(0, 0, 128, 96);
      c.fillStyle = '#f2f0ea'; c.font = `700 66px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(String(fr), 64, 52);
      mag.ctrTex.needsUpdate = true;
    }
  }

  function applyPose() {
    // waist-level finder: lid lifts, side walls spring up, rear wall follows, magnifier last
    const f = st.finderK;
    finder.lid.rotation.x = -(Math.PI / 2 + 0.03) * easeOutBack(phase(f, 0, 0.42));
    // side and rear walls spring up together once the lid is clear
    const pS = phase(f, 0.3, 0.74), pR = phase(f, 0.32, 0.76);
    const sideA = (Math.PI / 2 - 0.02) * (1 - easeOutBack(pS));
    finder.left.grp.rotation.z = -sideA; finder.right.grp.rotation.z = sideA;
    finder.left.grp.position.y = 8 + lerp(1.0, 0, phase(f, 0.28, 0.4));
    finder.right.grp.position.y = 8 + lerp(1.9, 0, phase(f, 0.28, 0.4));
    const bend = 0.32 * Math.sin(Math.PI * pS);
    finder.left.front.rotation.y = -bend; finder.left.back.rotation.y = bend;
    finder.right.front.rotation.y = bend; finder.right.back.rotation.y = -bend;
    finder.rear.rotation.x = -(Math.PI / 2 - 0.01) * (1 - easeOutBack(pR));
    finder.rear.position.y = 8 + lerp(0.2, 0, pR);
    // the magnifier flips out only when raised (as on the real hood: a button inside the lid releases it)
    finder.mag.rotation.x = -(Math.PI / 2) * easeOutBack(phase(f, 0.78, 1) * st.magK);
    finder.mag.visible = f > 0.2;
    if (finder.mag.visible && st.magK > 0.001) alignMagnifier(st.screenCrop);

    mm.position.set(0, mountCur.x / 1000 - head.rollY, mountCur.y / 1000);
    const e = easeInOut(st.explodeK);
    // (the focusing screen and inward hood flock sit sealed inside the shut lid when not exploded/cutaway)
    const innerOpen = f > 0.005 || e > 0.005 || cutaway;
    box.screen.visible = innerOpen;
    finder.left.grp.visible = finder.right.grp.visible = finder.rear.visible = innerOpen;
    finder.rails.visible = e > 0.005 || cutaway;
    for (const m of finder.innerFlock) m.visible = innerOpen;
    if (innerOpen && box.ensureTtl()) toLayer(box.ttl);
    if (box.ttl) box.ttl.visible = innerOpen;
    if (box.mirrorPins) box.mirrorPins.visible = e > 0.005 || cutaway;
    lensMount.position.z = DIM.flange - 150 * e - 120 * st.lensOut;
    lensMount.rotation.z = -st.lensTwist * (36 * DEG);
    finderMount.position.y = finderY + 95 * e;
    box.screen.position.y = DIM.screenY + 55 * e;
    box.mirrorPivot.position.set(120 * e, lerp(DIM.mirror.y, 35.5, st.mirrorK), lerp(DIM.mirror.z, 31.5, st.mirrorK));
    box.auxTop.position.x = box.auxBot.position.x = -118 * e;
    // (the rear flaps are out of sight with the magazine on and the mirror down — it covers the gate from the lens —
    //  8 draws in every view; up, the lens or the magazine off, taken apart or cut away, they show.)
    const flapsHid = e === 0 && !cutaway && st.mirrorK === 0 && st.lensOut === 0 && st.magOff === 0 && st.insertOut === 0;
    if (!flapsHid && box.ensureAux()) { toLayer(box.auxTop); toLayer(box.auxBot); }
    box.auxTop.visible = box.auxBot.visible = !flapsHid;
    if (body.linerMesh) body.linerMesh.visible = !(flapsHid && f <= 0.005);
    const bodyBackExposed = e > 0.005 || cutaway || st.magOff > 0.005;
    if (bodyBackExposed && body.ensureRearFace()) toLayer(body.rearFace);
    body.rearFace.visible = bodyBackExposed;
    if (body.innerFloor) body.innerFloor.visible = e > 0.005 || cutaway || st.lensOut > 0.005 || st.mirrorK > 0.02 || st.auxK > 0.02;
    // Live reflex mirror bounce & filter tint
    if (box.mirrorLiveMesh) box.mirrorLiveMesh.visible = Boolean(screenLive) && st.mirrorK < 0.98 && innerOpen;
    if (box.mirrorLiveMat) {
      const fOpt = filterOpticsFor(st.filterId);
      const gt = fOpt.ggTint || [1, 1, 1];
      const vis = (1 - st.mirrorK * 0.9) * (0.2 + 0.8 * st.leafK) * (0.18 + 0.82 * Math.max(f, cutaway ? 0.35 : 0));
      box.mirrorLiveMat.color.setRGB(gt[0] * vis, gt[1] * vis, gt[2] * vis);
      box.mirrorLiveMat.opacity = screenLive ? 0.055 * vis : 0.03 * vis;
    }
    // Cutaway internal linkages (mirror drive cam arm, tension spring, auxiliary shutter pushrod)
    const cutS = -(api?.cutSide || 1);
    if (cutaway && box.ensureCutMech()) {
      toLayer(box.mechCam); toLayer(box.mechSpring); toLayer(box.auxRod);
    }
    if (box.mechCam) {
      box.mechCam.visible = cutaway;
      box.mechCam.position.x = cutS * 33.4;
      box.mechCam.rotation.x = 0.42 * st.mirrorK;
    }
    if (box.mechSpring) {
      box.mechSpring.visible = cutaway;
      box.mechSpring.position.x = cutS * 34.0;
      box.mechSpring.scale.y = 1 + 0.2 * st.mirrorK;
      box.mechSpring.position.y = -14.0;
    }
    if (box.auxRod) {
      box.auxRod.visible = cutaway;
      box.auxRod.position.x = cutS * 33.8;
      box.auxRod.position.y = 6.5 * st.auxK;
    }
    // (the magazine comes off as on the camera: its top tipped back off the catch, then lifted clear)
    const mo = st.magOff;
    magMount.position.set(0, 3 + 22 * Math.max(0, mo - 0.35) / 0.65, magZ + 120 * e + 95 * mo);
    magMount.rotation.x = -0.18 * Math.sin(Math.min(1, mo * 1.6) * Math.PI);
    const frontVis = !(e === 0 && !cutaway && st.magOff === 0 && st.insertOut === 0);
    if (frontVis && mag.ensureFrontFace()) toLayer(mag.frontFace);
    mag.frontFace.visible = frontVis;
    mag.keySeat.visible = st.keyTab > 0.01 || e > 0.005 || cutaway;
    const slideVis = e > 0.01 || st.slideOut < 0.995;
    if (slideVis && mag.ensureSlide()) toLayer(mag.slide);
    mag.slide.visible = slideVis;
    // (inserted, the slide's bent handle stands a few millimetres proud of the magazine's left side, to be gripped)
    mag.slide.position.x = -135 * e - (112 * st.slideOut + 3.5 * (1 - st.slideOut)) * (1 - e);
    const innerVis = e > 0.01 || cutaway || st.insertOut > 0.01;
    if (innerVis && mag.ensureInner()) {
      toLayer(mag.insertInner);
      if (lastFilmSpec) drawRolls(lastFilmSpec);
    }
    mag.insertInner.visible = innerVis;
    mag.insert.position.set(-150 * Math.max(e, st.insertOut), -8 * e, 0);
    // the key (its tab folded out to turn it) and the film clamp it opens once the holder is out
    mag.keyG.rotation.x = st.keyA;
    mag.tabG.rotation.y = -Math.PI / 2 * st.keyTab;
    if (F.clamp) { const lip = st.insertOut > 0.99 ? THREE.MathUtils.clamp(1 + st.keyA / (Math.PI / 2), 0, 1) : 0;
      F.clamp.position.z = F.FZ - 0.5 - 1.8 * lip; F.clamp.rotation.x = -0.3 * lip; }
    if (mag.insertInner.visible) placeFilm();
    // A12 magazine right-side fold-out film crank unfolds outward (+X) during film advance/loading
    if (mag.magCrankArm && mag.magCrank) {
      const magWind = st.loadK > 0.45 && st.loadK < 0.95 ? Math.sin(clamp01((st.loadK - 0.45) / 0.5) * Math.PI) : 0;
      mag.magCrankArm.rotation.z = -(Math.PI / 2) * magWind;
      mag.magCrank.rotation.x = F.knob ? F.knob.rotation.x : 0;
      if (mag.magCrankDot) mag.magCrankDot.visible = magWind > 0.02 || e > 0.005 || cutaway;
    }
    // the key's crescent: exposures used, of twelve (seen with the insert home)
    { const rs = rollState || { state: 'ready', frame: Math.max(1, live?.frame || 1) };
      mag.smile.userData.set(rs.state === 'done' ? 1 : rs.state === 'ready' ? (Math.min(12, Math.max(1, rs.frame)) - 1) / 12 : 0); }
    const rearOpen = st.lensOut > 0.005 || e > 0.005 || cutaway;
    if (rearOpen && L.ensureRearMount?.()) toLayer(L.rearMount);
    if (L.rearMount) L.rearMount.visible = rearOpen;
    if (L.coupling) L.coupling.rotation.z = 0.6 - st.coupling * 4.4;
    // mechanism
    box.mirrorPivot.rotation.x = lerp(-Math.PI / 4, 0, st.mirrorK);
    box.auxTop.rotation.x = (Math.PI / 2) * st.auxK;
    box.auxBot.rotation.x = -(Math.PI / 2) * st.auxK;
    if (cutaway && L.ensureInner?.()) { toLayer(L.inner); sectionsDirty = true; }
    if (L.inner) L.inner.visible = cutaway;
    const leafRot = SHUTTER_SWING * st.leafK;
    for (let i = 0; i < 5; i++) L.blades[i].rotation.z = leafRot;
    L.syncBlades();
    L.syncIris(st.iris, cutaway);
    body.crank.rotation.x = -st.crank * TAU;
    if (body.crankHandle) body.crankHandle.rotation.z = (Math.PI / 2) * st.crankOpen;
    body.release.position.z = FRONT - 0.05 + 1.6 * st.press;
    if (body.preRelease) body.preRelease.position.y = st.pre * 3;
    if (L.extGroup) L.extGroup.position.z = -st.focusExt;
    const sleeveOpen = st.focusExt > 0.02 || e > 0.005 || cutaway;
    if (sleeveOpen && L.ensureSleeve?.()) { toLayer(L.helicSleeve); if (L.helicCollar) toLayer(L.helicCollar); }
    if (L.helicSleeve) {
      L.helicSleeve.visible = sleeveOpen;
      L.helicSleeve.scale.z = st.focusExt + 1.5;   // (from its anchor in the stationary ring to 0.5 mm inside the moving unit)
    }
    if (L.helicCollar) L.helicCollar.visible = sleeveOpen;
    L.focus.rotation.z = st.focusRot;
    L.aperture.rotation.z = st.apRot;
    L.shutter.rotation.z = st.shRot;
    if (L.fleGroup) L.fleGroup.rotation.z = st.fleRot;
    if (L.dofLever) {
      L.dofLever.position.set(0.45 * st.dofK, -1.7 * st.dofK, 0);
      L.dofLever.rotation.z = 0.045 * st.dofK;
    }
    if (L.evBtn) {
      const phB = 16 * DEG;
      L.evBtn.position.set(-Math.sin(phB) * 0.95 * st.evK, -Math.cos(phB) * 0.95 * st.evK, 0);
    }
    if (L.fBtn) {
      const phF = -2 * SH_STEP - 7 * DEG;
      L.fBtn.position.set(-Math.sin(phF) * 0.75 * st.fBtnK, -Math.cos(phF) * 0.75 * st.fBtnK, 0);
    }
    if (L.hoodGroup) {
      const hon = Boolean(st.hoodOn);
      if (hon && L.hoodGroup.userData.ensure?.()) toLayer(L.hoodGroup);
      L.hoodGroup.visible = hon;
    }
    if (L.filterObj?.setFilterState(st.filterId, st.polAngle)) {
      toLayer(L.filterObj.group);
      refreshPickables();
    }
  }

  // ───────── Cutaway ─────────
  let cutaway = false, sections = [], sectionsDirty = true;
  function setCutaway(on) {
    cutaway = on;
    if (!on) clipPlane.set(new THREE.Vector3(0, 1, 0), 1e7);
    else {
      if (L.ensureInner?.()) toLayer(L.inner);
      // section faces are built on first use (body once, lens after each swap)
      root.traverse((o) => {
        if (!o.userData.sectionPolys) return;
        const sec = sectionPair(o.userData.sectionPolys, lib.get('cutMetal', { clip: false }));
        delete o.userData.sectionPolys;
        toLayer(sec);
        o.add(sec);
        sectionsDirty = true;
      });
    }
  }

  const lensCache = new Map();
  // labels for the exploded view
  const anchor = (parent, x, y, z, text, sub) => { const o = new THREE.Object3D(); o.position.set(x, y, z); parent.add(o); return { o, text, sub }; };
  let labels = [];
  let labelEls = null, dotEls = null;
  function buildLabels() {
    labels.forEach((l) => l.o.parent?.remove(l.o));
    labels = [
      anchor(lensMount, 0, 50, -L.L / 2, 'Lens', 'the shutter is inside it · 1 s–1/500'),
      anchor(finderMount, 0, 26, 0, 'Folding hood', 'you look down into it: upright, but left and right swapped'),
      anchor(box.screen, 0, 6, -8, 'Focusing screen', 'bright ground glass the lens projects onto'),
      anchor(box.mirrorPivot, 0, 18, -40, 'Mirror', 'swings up out of the way when you shoot'),
      anchor(box.auxTop, 0, 10, 0, 'Light baffles', 'keep the film dark while you compose'),
      anchor(body.group, 0, -58, 0, 'Body', 'no light meter, by design'),
      anchor(magMount, 0, 58, 24, 'Film back', '12 square pictures on a roll of 120 film'),
      anchor(mag.slide, -48, 46, 0, 'Dark slide', 'out to shoot, in to swap film mid-roll'),
      anchor(mag.insert, -46, 50, 24, 'Film insert', 'the roll winds across here'),
    ];
  }
  buildLabels();

  const tmpQ = new THREE.Quaternion();
  const api = {
    root,
    opticsMoving: false,
    cutSide: 1,
    pickables,
    st,
    buildMs: 0,
    setAim(pan, tilt, roll = 0) {
      yaw.rotation.y = -Math.PI / 2 + pan;
      pitch.rotation.x = tilt;
      rollG.rotation.z = roll;
      root.updateMatrixWorld(true);
    },
    bodyCenter(v) { return mm.localToWorld(v.set(0, 10, (FRONT + BACK) / 2)); },
    worldToBody(v) { return mm.worldToLocal(v); },
    setScreenTexture(tex) {
      screenLive = tex;
      box.screenMat.map = tex;
      box.screenMat.color.setScalar(0.7);
      box.screenMat.needsUpdate = true;
      if (box.mirrorLiveMat) {
        box.mirrorLiveMat.map = tex;
        box.mirrorLiveMat.opacity = 0.09;
        box.mirrorLiveMat.needsUpdate = true;
      }
      // the loupe's own material: the live screen, magnified (alignMagnifier), dimmed as it tilts away
      finder.magView.material = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, side: THREE.DoubleSide });
      finder.magView.material.color.setScalar(0.7);
    },
    setRings(s) {
      live = s;
      ringTargets(s);
      drawFilm(s);
      if (st.snapRings) {
        st.focusRot = st.focusT; st.apRot = st.apT; st.shRot = st.shT; st.iris = st.irisT;
        st.focusExt = st.focusExtT; st.fleRot = st.fleRotT; st.dofK = st.dofT; st.evK = st.evT;
        st.fBtnK = st.fBtnT; st.polAngle = st.polAngleT;
        st.snapRings = false;
      }
    },
    setHood(on) {
      st.hoodOn = Boolean(on);
      if (live) live.hoodOn = st.hoodOn;
      if (L.hoodGroup) {
        if (st.hoodOn && L.hoodGroup.userData.ensure?.()) toLayer(L.hoodGroup);
        L.hoodGroup.visible = st.hoodOn;
      }
    },
    setFilter(filterId, polAngle = st.polAngleT) {
      st.filterId = filterId || 'none';
      st.polAngleT = st.polAngle = polAngle;
      if (live) { live.filter = st.filterId; live.polAngle = polAngle; }
      if (L.filterObj?.setFilterState(st.filterId, st.polAngle)) {
        toLayer(L.filterObj.group);
        refreshPickables();
      }
    },
    get hoodOn() { return Boolean(st.hoodOn && L.hoodGroup); },
    get hasHood() { return Boolean(L.hoodGroup); },
    /** From the lens view's entrance pupil (lensPose) back to the film plane, in metres: the V system's flange distance is 74.9 mm. */
    filmOffset() {
      const ep = lensOpticsFor(L.lens).entrancePupilMm || 24;
      const a = mm.localToWorld(new THREE.Vector3(0, 0, DIM.flange - L.L - st.focusExt + ep)), b = mm.localToWorld(new THREE.Vector3(0, 0, DIM.flange + 74.9));
      return a.distanceTo(b);
    },
    lensPose(pos, quat) {
      const ep = lensOpticsFor(L.lens).entrancePupilMm || 24;
      _lensPos.set(0, 0, DIM.flange - L.L - st.focusExt + ep);
      mm.localToWorld(_lensPos);
      pos.copy(_lensPos);
      rollG.getWorldQuaternion(quat);
    },
    lookDownPose() {
      const q = rollG.getWorldQuaternion(new THREE.Quaternion());
      const target = box.screen.localToWorld(new THREE.Vector3(0, 4, 0));
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
      const back = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
      const eye = target.clone().addScaledVector(up, 0.2).addScaledVector(back, 0.012);
      // (the view's up: the camera's front — the top of the screen's picture — whatever the head's tilt; taken from the
      //  world's up, a camera pointed down had the look rolled half a turn, the picture upside down)
      return { eye, target: target.addScaledVector(back, -0.002), up: back.clone().negate() };
    },
    /** World-space lens axis, pointing out through the front of the lens. */
    ringAxisWorld(target = new THREE.Vector3()) {
      return target.set(0, 0, -1).applyQuaternion(mm.getWorldQuaternion(tmpQ)).normalize();
    },
    /** Current ring angle (rad), right-handed about ringAxisWorld(). */
    ringAngle(part) {
      if (part === 'focus') return -st.focusT;
      if (part === 'aperture') return -st.apT;
      if (part === 'shutter') return -st.shT;
      if (part === 'filter') return (st.polAngleT - 90) * DEG;
      return 0;
    },
    /** Value a ring shows at `angle` (same convention): focus → metres (10000 = ∞), aperture / shutter → fractional index. */
    ringValueAt(part, angle) {
      const ln = L.lens;
      if (part === 'focus') { const k = focusK(ln), a = Math.min(Math.max(angle, 0), k / ln.minFocusDistance); return a < 1e-4 ? 10000 : Math.min(10000, k / a); }
      if (part === 'aperture') {
        // angle = stops from full aperture × pitch; map back to a fractional stop index
        const stops = apStops(ln), sv = Math.max(0, angle / EV_STEP);
        for (let i = 0; i < stops.length - 1; i++) if (sv <= stops[i + 1]) return i + (sv - stops[i]) / (stops[i + 1] - stops[i]);
        return stops.length - 1;
      }
      if (part === 'shutter') return -angle / SH_STEP;
      if (part === 'filter') return ((Math.round(90 + angle / DEG) % 180) + 180) % 180;
      return 0;
    },
    _debugCut(on, side = 1) { api.cutSide = side; setCutaway(on); },
    setHover(part) { PARTS.forEach((p) => { hov[p].target = p === part ? 1 : 0; }); },
    /** Raise or stow the finder's 4.5× magnifier (it only shows with the hood open). */
    async setMagnifier(up) {
      await animate('magK', up ? 1 : 0, up ? 0.45 : 0.35, (k) => k);
    },
    /** The loupe's own image of the screen: the centre `crop` of it rendered at full resolution (main.js's loupe
     *  view, while you look through the raised loupe), or null for the screen's own texture, magnified. */
    setLoupeTexture(tex, crop = 1) { finder.magView.material.map = tex || screenLive; st.screenCrop = tex ? crop : 1; alignMagnifier(st.screenCrop); },   // (re-mapped at once: one frame on the old mapping showed the sharp image blown up)
    get magnifierUp() { return st.magK > 0.95 && st.finderK > 0.99; },
    async setFinderOpen(open) { await animate('finderK', open ? 1 : 0, open ? 1.0 : 0.75, (k) => k); },
    async setExploded(on) {
      setCutaway(false);
      await animate('explodeK', on ? 1 : 0, 1.3);
    },
    async swapLens(next, onSwap) {
      const vis = root.visible;
      if (vis) {
        await animate('lensTwist', 1, 0.35);
        await animate('lensOut', 1, 0.5);
      }
      lensMount.remove(L.group);
      // (lenses are kept once built, as a bag keeps them: building one is ~45 ms of geometry and engraving on the main
      //  thread — a hitch every swap. Kept, a swap back is just a re-parent; their GPU memory is a few MB each)
      lensCache.set(L.lens.id, L);
      const cached = lensCache.get(next.id);
      if (cached) L = cached;
      else { L = buildLens(lib, next, hov); mergeStaticRigid(L.group, { dynamic: new Set(lensDynNodes(L)), lists: lensLists(L) }); toLayer(L.group); }
      lensMount.add(L.group);
      refreshPickables();
      sectionsDirty = true;
      buildLabels(); labelEls?.forEach((el) => el.remove()); dotEls?.forEach((el) => el.remove()); labelEls = dotEls = null;
      onSwap();
      // re-seat the camera if the new lens mounts by its own foot (or no longer does)
      const mFrom = mountCur.clone(), mTo = mountOffset(L);
      if (vis && mFrom.distanceTo(mTo) > 0.01) await tween(0.6, (k) => mountCur.lerpVectors(mFrom, mTo, k));
      else mountCur.copy(mTo);
      if (live) {
        ringTargets(live);
        st.focusRot = st.focusT; st.apRot = st.apT; st.shRot = st.shT; st.iris = st.irisT;
        st.focusExt = st.focusExtT; st.fleRot = st.fleRotT; st.dofK = st.dofT; st.evK = st.evT;
        st.fBtnK = st.fBtnT; st.polAngle = st.polAngleT;
      }
      if (vis) {
        applyPose();
        await animate('lensOut', 0, 0.55);
        await animate('lensTwist', 0, 0.35);
      } else {
        st.lensOut = 0; st.lensTwist = 0;
        applyPose();
      }
    },
    /** The firing cycle. cutaway: open the body to show the mechanism (off by default — seen from outside, a camera
     *  that splits in half when you press the release just looks broken). */
    async fire({ seconds, side, onMirror, onExpose, onSound = () => {}, cutaway = false }) {
      if (cutaway) { api.cutSide = side; setCutaway(true); }
      await animate('press', 1, 0.09, (k) => k);
      onSound('release');
      await hold(120);
      body.status.material.color.set('#c8261e');
      mag.signal.material.color.set('#c8261e');
      await animate('leafK', 0, 0.12, (k) => k * k);          // leaf shutter closes
      onSound('leafClose');
      const slap = animate('mirrorK', 1, 0.16, snapUp);        // mirror slaps up
      hold(120).then(() => onSound('mirror'));
      await slap;
      onMirror(true);
      await animate('auxK', 1, 0.13, snapOpen);                // auxiliary flaps open
      onSound('leafOpen');
      await animate('leafK', 1, 0.07, (k) => k);               // the exposure
      const expose = onExpose();
      await Promise.all([hold(Math.max(seconds * 1000, 160)), expose]);
      onSound('leafClose');
      await animate('leafK', 0, 0.07, (k) => k);
      animate('press', 0, 0.2);
      await hold(500);                                          // dark until you wind on
      const wind = animate('crank', 1, 1.05);
      onSound('wind');
      await hold(200);
      await Promise.all([animate('auxK', 0, 0.26, easeInOut), animate('mirrorK', 0, 0.3, (k) => 1 - Math.pow(1 - k, 3))]);
      onMirror(false);
      onSound('mirrorDown');
      await animate('leafK', 1, 0.2);
      await wind;
      st.crank = 0;
      body.status.material.color.set('#f2f2ec');
      mag.signal.material.color.set('#f2f2ec');
      await hold(300);
      if (cutaway) setCutaway(false);
    },
    // ───── the Camera School's hand-worked mechanism (the other pages use fire(), which winds on by itself) ─────
    /** parts and their frames, for picking proxies and part cards */
    get parts() { return { mm, body, box, mag, magMount, lensMount, finderMount, finder, lens: L, head }; },
    st,
    opticalState() {
      const ap = L.lens.apertureStops || [2.8, 4, 5.6, 8, 11, 16, 22];
      const Nwork = live?.aperture ?? ap[0];
      const stopped = Boolean(st.dofK > 0.5 || st.leafK < 0.98 || st.mirrorK > 0.05 || st.pre > 0.05);
      const N = stopped ? Nwork : ap[0];
      const fCal = lensOpticsFor(L.lens).focalCalMm || L.lens.focalLength || 80;
      const lensOn = st.lensOut < 0.05 && st.explodeK < 0.05;
      const darkSlideOut = st.slideOut > 0.95;
      const filmPath = (lensOn && st.magOff < 0.05 && darkSlideOut) ? +(st.leafK * st.mirrorK * st.auxK).toFixed(4) : 0;
      return {
        shutterKind: 'leaf',
        blades: IRIS.n,
        shutterBlades: 5,
        fNumberSelected: +Nwork.toFixed(2),
        fNumberEffective: +N.toFixed(2),
        apertureMm: +(fCal / N).toFixed(2),
        irisRadiusMm: +THREE.MathUtils.clamp(st.iris, IRIS.rMin, IRIS.rMax).toFixed(2),
        shutterOpen: +st.leafK.toFixed(4),
        auxOpen: +st.auxK.toFixed(4),
        mirrorUp: +st.mirrorK.toFixed(4),
        darkSlideOut,
        lightReachesFilm: filmPath,
        lightReachesFinder: lensOn ? +(st.leafK * (1 - st.mirrorK)).toFixed(4) : 0,
        zIrisMm: +(DIM.flange + L.zBl + 1.85 - st.focusExt).toFixed(2),
        zShutterMm: +(DIM.flange + L.zBl - st.focusExt).toFixed(2),
        zFilmMm: 0,
        zFlangeMm: DIM.flange,
        focalMm: fCal,
        pupilMag: lensOpticsFor(L.lens).pupilMag ?? 1.0,
        focusExtMm: +st.focusExt.toFixed(3),
      };
    },
    /** the two signal windows: red (released / exposed) or white (wound) */
    setSignals(bodyRed, magRed) {
      body.status.material.color.set(bodyRed ? '#c8261e' : '#f2f2ec');
      mag.signal.material.color.set(magRed ? '#c8261e' : '#f2f2ec');
    },
    /** press the release and run the exposure; the camera is left released — mirror up, rear shutter open, dark in
     *  the finder — until it is wound. pre: already pre-released (the mirror is up: only the leaf opens and closes). */
    async releaseCycle({ seconds, onMirror = () => {}, onExpose = async () => {}, onSound = () => {}, pre = false, lens = true, cutaway = false, side = 1 }) {
      if (cutaway) { api.cutSide = side; setCutaway(true); }
      await animate('press', 1, 0.09, (k) => k);
      onSound('release');
      await hold(120);
      if (!pre) {
        if (lens) { await animate('leafK', 0, 0.12, (k) => k * k); onSound('leafClose'); }
        const slap = animate('mirrorK', 1, 0.16, snapUp);
        hold(120).then(() => onSound('mirror'));
        await slap;
        onMirror(true);
        await animate('auxK', 1, 0.13, snapOpen);
      }
      if (lens) {
        onSound('leafOpen');
        await animate('leafK', 1, 0.07, (k) => k);
        const expose = onExpose();
        await Promise.all([hold(Math.max(seconds * 1000, 160)), expose]);
        onSound('leafClose');
        await animate('leafK', 0, 0.07, (k) => k);
      } else await onExpose();
      animate('press', 0, 0.2);
      animate('pre', 0, 0.2);
      if (cutaway) { await hold(900); setCutaway(false); }
    },
    /** the pre-release: the leaf closes, the mirror rises, the rear shutter opens — the exposure itself comes later */
    async preRelease({ onMirror = () => {}, onSound = () => {}, lens = true } = {}) {
      await animate('pre', 1, 0.12, (k) => k);
      if (lens) { await animate('leafK', 0, 0.12, (k) => k * k); onSound('leafClose'); }
      const slap = animate('mirrorK', 1, 0.16, snapUp);
      hold(100).then(() => onSound('mirror'));
      await slap; onMirror(true);
      await animate('auxK', 1, 0.13, snapOpen);
    },
    /** the winding crank turned by hand, k = 0 … 1 of its turn: the rear shutter closes, the mirror comes down,
     *  the leaf opens for viewing (with a lens on) — each at its point in the turn */
    windTo(k, { lens = true, released = true } = {}) {
      st.crank = k;
      if (!released) return;
      const ph = (a, b) => clamp01((k - a) / (b - a));
      st.auxK = 1 - easeInOut(ph(0.15, 0.45));
      st.mirrorK = 1 - easeInOut(ph(0.25, 0.6));
      st.leafK = lens ? easeInOut(ph(0.6, 0.85)) : 0;
    },
    /** a full turn brings the crank round to where it started: it stops there (a whole turn is its rest position — it
     *  never runs back) */
    async crankHome() { st.crank = 0; },
    /** take the lens off (twist and draw it forward) or put it back (in, then twist home) */
    async lensOff(off) {
      if (off) { await animate('lensTwist', 1, 0.35); await animate('lensOut', 1, 0.55); }
      else { await animate('lensOut', 0, 0.55); await animate('lensTwist', 0, 0.35); }
    },
    /** a lens that won't go on: it is offered up and stops at the mount */
    async lensBalk() { await animate('lensOut', 0.25, 0.35); await hold(120); await animate('lensOut', 1, 0.3); },
    /** the slot on the lens's rear coupling: 0 = at the red dot (cocked), 1 = a turn away (fired) */
    async setCoupling(k, dur = 0.5) { await animate('coupling', k, dur); },
    async setSlide(out, dur = 0.7) { await animate('slideOut', out ? 1 : 0, dur); },
    async setMagOff(off, dur = 0.9) { await animate('magOff', off ? 1 : 0, dur); },
    /** Draw the film holder out of its shell or push it home: the key's tab folds out and the key turns
     *  counterclockwise to free it; pushed home, the key turns clockwise to lock it and the tab folds flat. */
    async setInsertOut(out, dur = 0.8) {
      if (out) {
        await animate('keyTab', 1, 0.25, (k) => k);
        await animate('keyA', -Math.PI / 2, 0.35, (k) => k);
        await animate('insertOut', 1, dur);
      } else {
        if (st.loadK > 0) await api.loadPhase('closed');   // (a load under way: the key turned back closes the clamp)
        else if (st.keyA > -Math.PI / 2 + 0.01) await animate('keyA', -Math.PI / 2, 0.3, (k) => k);
        await animate('insertOut', 0, dur);
        await animate('keyA', 0, 0.35, (k) => k);
        await animate('keyTab', 0, 0.25, (k) => k);
      }
    },
    /** The roll in the holder: 'loaded' (leader threaded, arrow at the triangle), 'ready' at a frame, or 'done'. */
    setRoll(state, frame = 1) { rollState = { state, frame }; webKey = ''; },
    /** Load a fresh roll into the drawn-out holder, as the manual shows it (pp. 18–19), up to a stage:
     *  'spools' (the exposed roll out, the empty spool up to the take-up, the new roll in below), 'clamp' (the key
     *  turned clockwise: the film clamp open), 'leader' (the paper drawn under the clamp's lip and into the take-up's
     *  slot), 'aligned' (the splined knob turned until the start arrow faces the red triangle), 'closed' (the key turned
     *  back: the roll is loaded). Stages already passed return at once; each runs from where the last one stopped. */
    async loadPhase(to = 'closed') {
      const at = LOAD_AT[to];
      if (at === undefined || st.insertOut < 0.99) return false;
      if (mag.ensureInner()) { toLayer(mag.insertInner); if (lastFilmSpec) drawRolls(lastFilmSpec); }
      if (!(st.loadK > 0)) { rollState = { state: 'done', frame: 12 }; webKey = ''; st.loadK = 0.0001; }
      const k = at / 6;
      if (st.loadK < k) await animate('loadK', k, (k - st.loadK) * 6, (x) => x);
      if (to === 'closed') {
        roles = { top: roles.bot, bot: roles.spare, spare: roles.top };
        spins = [0, 0, 0]; if (loadEnd) { spins[roles.bot] = loadEnd.endSpin; spins[roles.top] = loadEnd.takeSpin; }
        st.loadK = 0; st.keyA = -Math.PI / 2;
        rollState = { state: 'loaded', frame: 1 }; webKey = '';
      }
      return true;
    },
    /** The whole of it at once (about 6 s). */
    loadRoll() { return api.loadPhase('closed'); },
    /** Where a load has got to (null when none is under way). */
    get loadStage() { const τ = st.loadK * 6; return !(st.loadK > 0) ? null : Object.entries(LOAD_AT).filter(([, v]) => τ >= v - 1e-3).pop()?.[0] ?? 'started'; },
    /** a part that won't move: a small shake (a blocked interlock is felt, not read) */
    async balk(key = 'press', amt = 0.35) { const v = st[key]; await animate(key, v + amt, 0.07, (k) => k); await animate(key, v, 0.12); },
    setCutaway(on, side = 1) { api.cutSide = side; setCutaway(on); },
    /** the mechanism's clock against the page's: < 1 is slow motion (the Camera School's X-ray view of the cycle) */
    timeScale: 1,
    update(dt) {
      dt *= api.timeScale;
      for (let i = tweens.length - 1; i >= 0; i--) {
        const tw = tweens[i];
        tw.t += dt;
        const k = Math.min(1, tw.t / tw.dur);
        tw.fn(tw.ease(k));
        if (k >= 1) { tweens.splice(i, 1); tw.res(); }
      }
      if (live) { ringTargets(live); drawFilm(live); }
      const a = 1 - Math.exp(-dt * 16);
      st.focusRot += (st.focusT - st.focusRot) * a;
      st.apRot += (st.apT - st.apRot) * a;
      st.shRot += (st.shT - st.shRot) * a;
      st.focusExt += (st.focusExtT - st.focusExt) * a;
      st.fleRot += (st.fleRotT - st.fleRot) * a;
      st.dofK += (st.dofT - st.dofK) * a;
      st.evK += (st.evT - st.evK) * a;
      st.fBtnK += (st.fBtnT - st.fBtnK) * a;
      st.polAngle += (st.polAngleT - st.polAngle) * a;
      const crankTarget = st.crank > 0.005 && st.crank < 0.995 ? 1 : 0;
      st.crankOpen += (crankTarget - st.crankOpen) * (1 - Math.exp(-dt * 22));
      st.iris += (st.irisT - st.iris) * (1 - Math.exp(-dt * 12));
      const hA = 1 - Math.exp(-dt * 12);
      PARTS.forEach((p) => { const h = hov[p]; h.amount.value += (h.target - h.amount.value) * hA; });
      applyPose();
      // bullseye bubble floats toward the high side of the tilted head
      rollG.getWorldQuaternion(tmpQ).invert();
      const upL = (api._upL ||= new THREE.Vector3()).set(0, 1, 0).applyQuaternion(tmpQ);
      const off = (api._off ||= new THREE.Vector2()).set(upL.x, upL.z).multiplyScalar(57);
      if (off.length() > 3.4) off.setLength(3.4);
      head.bubble.position.set(head.bubbleHome.x + off.x, head.bubbleHome.y, head.bubbleHome.z + off.y);
      // (the vials: about 2 mm of travel a degree, to the ends of their tubes)
      head.bubX.position.x = head.bubXHome.x + THREE.MathUtils.clamp(upL.x * 115, -4, 4);
      head.bubZ.position.z = head.bubZHome.z + THREE.MathUtils.clamp(upL.z * 115, -4, 4);
      head.syncBubbles();
      if (sectionsDirty) { sections = []; root.traverse((o) => { if (o.userData.cutSide) sections.push(o); }); sectionsDirty = false; }
      sections.forEach((o) => { o.visible = cutaway && o.userData.cutSide === api.cutSide; });
      if (cutaway) {
        // cut away the half facing the viewer, through the lens axis
        mm.updateWorldMatrix(true, false);
        _cutN.set(-api.cutSide, 0, 0).transformDirection(mm.matrixWorld);
        clipPlane.setFromNormalAndCoplanarPoint(_cutN, mm.localToWorld(_cutP.set(0, 0, 0)));
      }
    },
    /** which exploded module a hit belongs to (its label's index), or −1 */
    labelAt(obj) {
      for (let o = obj; o; o = o.parent) { const i = labels.findIndex((l) => l.o.parent === o); if (i >= 0) return i; }
      return -1;
    },
    /** the one label shown in the exploded view (the module under the pointer); the rest are dots */
    labelFocus: -1,
    updateLabels(cam, container, show) {
      if (!labelEls) {
        labelEls = labels.map((l) => { const el = document.createElement('div'); el.className = 'part-label'; el.innerHTML = `${l.text}<small>${l.sub}</small>`; container.appendChild(el); return el; });
        dotEls = labels.map(() => { const d = document.createElement('i'); d.className = 'part-dot'; container.appendChild(d); return d; });
      }
      const on = show && st.explodeK > 0.85;
      // (off and already hidden: nothing to do — no layout reads every frame)
      if (!on && labelsShown === false) return;
      labelsShown = on;
      const w = container.clientWidth, h = container.clientHeight, v = _labelV;
      // (stacked clear of one another, top to bottom: at the default orbit six of the nine had overlapped)
      const P = [];
      labels.forEach((l, i) => {
        const el = labelEls[i], dot = dotEls[i];
        // (all nine at once had covered the camera they label: a dot each, the label of the one under the pointer)
        el.classList.toggle('on', on && i === api.labelFocus);
        dot.classList.toggle('on', on);
        if (!on) return;
        l.o.getWorldPosition(v).project(cam);
        dot.style.left = `${(v.x * 0.5 + 0.5) * w}px`; dot.style.top = `${(-v.y * 0.5 + 0.5) * h}px`;
        if (i !== api.labelFocus) return;
        P.push({ el, x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h - 14, w: el._w || (el._w = el.offsetWidth || 160), h: el._h || (el._h = el.offsetHeight || 30) });
      });
      P.sort((a, b) => a.y - b.y);
      P.forEach((p, k) => {
        for (let j = 0; j < k; j++) {
          const q = P[j];
          // (each box spans [y − h, y]: it stands above its anchor on a leader)
          if (Math.abs(p.x - q.x) < (p.w + q.w) / 2 + 6 && p.y - p.h < q.y + 4) p.y = q.y + p.h + 4;
        }
        p.el.style.left = `${p.x}px`; p.el.style.top = `${p.y}px`;
      });
    },
  };
  applyPose();
  api.buildMs = performance.now() - t0;
  api._timing = timing;
  return api;
}
