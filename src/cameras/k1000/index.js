// The camera: a 1976 Asahi Pentax K1000 all-mechanical satin-chrome 35 mm SLR with K-mount SMC-M lenses, on the shared
// carbon tripod and 3-way head. Built strictly to SPEC.md & PLAYBOOK.md (23 Engineering Laws).
// Neutral GLASS WORKS legends; historic vector-traced 1976 split-stem K1000 model badge preserved.
//
// Model axes (CONTRACT.md): lens axis along -Z, +X = photographer's right, +Y up. Origin: lens axis on the film plane.
// Pentax K-mount flange focal distance: 45.46 mm in front of the film (z = -45.46).
import * as THREE from 'three';
import { INK, PAINT_BG } from '../../lib/engrave.js';
import { addScrew, radialT, rbox, revolve, rrPath, slab } from '../../lib/geometry.js';
import { MatLib, baseMaterials } from '../../lib/materials.js';
import { Kit, mergeStaticRigid, prep } from '../../lib/mesh.js';
import { buildHead, buildTripod } from '../../lib/rig.js';
import { beadBlastMaps, vulcaniteMaps } from '../../lib/textures.js';
import { DEG, FONT, T, TAU, easeInOut, lerp } from '../../lib/util.js';
import { lensOpticsFor, helicoidExtensionMm, filterOpticsFor } from '../../optics.js';
export { flushCameraTextures } from '../../lib/textures.js';

export const DIM = {
  flange: -45.46,
  // Calibrated to Pentax_K1000_by-RaBoe-001.jpg & factory manual p-08 (143.0 × 91.4 × 83.0 mm w/ 50mm f/2):
  // Shell x0=-53.2..+83.0 (136.2 mm shell -> ~143.8 mm across eyelets & triangular D-rings!); y0=-28.4..prismY=60.4.
  body: { x0: -53.2, x1: 83.0, y0: -28.4, baseY: -24.0, seamY: 27.0, trimY: 30.2, deck: 42.1, prismY: 60.4, zF: -30.5, zB: 3.5 },
  eyepiece: { x: 0, y: 37.6, z: 5.2, w: 17.6, h: 13.4 },
  dial: { x: 41.4, z: -13.5, r: 10.6, h: 6.7 },
  release: { x: 53.6, z: -20.5, r: 4.5 },
  lever: { x: 66.2, z: -11.5, r: 10.2 },
  rewind: { x: -41.2, z: -11.5, r: 9.6 },
  socket: { x: -4.0, z: -14.0 },
  tripod: { apex: 1210, spread: 560 },
};
const B = DIM.body;
const AP_STEP = 16.5 * DEG;
const DIAL_STEP = TAU / 12;
const DIAL_LABELS = ['B', '1', '2', '4', '8', '15', '30', '60X', '125', '250', '500', '1000'];
const COC = 1 / 30;
const LEVER_STROKE = 155 * DEG; // Factory manual p-08: 160° throw + 10° play

function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function tex(cv) { const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
function arcText(g, str, cx, cy, R, a, size, color, weight = 600, inward = false) {
  g.save(); g.font = `${weight} ${size}px ${FONT}`; g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle';
  const ch = [...str], w = ch.map((c) => g.measureText(c).width), tot = w.reduce((s, v) => s + v, 0);
  let cur = -tot / 2;
  ch.forEach((c, i) => {
    const phi = a + (inward ? 1 : -1) * (cur + w[i] / 2) / R; cur += w[i];
    g.save(); g.translate(cx + Math.cos(phi) * R, cy - Math.sin(phi) * R); g.rotate(-phi + (inward ? -Math.PI / 2 : Math.PI / 2));
    g.fillText(c, 0, 0); g.restore();
  });
  g.restore();
}

// ───────── SMC Pentax-M Compact K-Mount Lens Definitions & Cutaway Prescriptions ─────────
const LENS_DEFS = {
  'k-28-2.8':  { L: 31.5, focusPitch: 52 * DEG, blades: 5, rFront: 28.4, thread: 24.5, glassR: 14.6, rFocus: 30.8, rAp: 30.2, rMount: 30.5, funnelPad: 1.6, serial: '7142815', profile: 'compact',  hoodStyle: 'screw', hoodLen: 14.0 },
  'k-35-2':    { L: 42.0, focusPitch: 40 * DEG, blades: 6, rFront: 28.4, thread: 24.5, glassR: 16.8, rFocus: 31.6, rAp: 30.2, rMount: 30.5, funnelPad: 1.2, serial: '7483029', profile: 'stepped',  hoodStyle: 'screw', hoodLen: 17.0 },
  'k-50-2':    { L: 31.0, focusPitch: 31 * DEG, blades: 6, rFront: 27.8, thread: 24.5, glassR: 13.0, rFocus: 30.8, rAp: 30.2, rMount: 30.5, funnelPad: 3.0, serial: '8251980', profile: 'standard', hoodStyle: 'screw', hoodLen: 18.0 },
  'k-50-1.7':  { L: 31.5, focusPitch: 31 * DEG, blades: 6, rFront: 28.6, thread: 24.5, glassR: 17.4, rFocus: 31.2, rAp: 30.2, rMount: 30.5, funnelPad: 0.6, serial: '7910442', profile: 'fast50',   hoodStyle: 'screw', hoodLen: 18.0 },
  'k-85-2':    { L: 46.0, focusPitch: 24 * DEG, blades: 6, rFront: 29.6, thread: 24.5, glassR: 19.6, rFocus: 32.0, rAp: 30.4, rMount: 30.5, funnelPad: 0.4, serial: '6835291', profile: 'portrait', hoodStyle: 'screw', hoodLen: 26.0 },
  'k-135-3.5': { L: 66.0, focusPitch: 17 * DEG, blades: 6, rFront: 28.4, thread: 24.5, glassR: 19.2, rFocus: 31.2, rAp: 30.4, rMount: 30.5, funnelPad: 0.5, serial: '7209468', profile: 'tele',     builtInHood: true, hoodStyle: 'slide', hoodLen: 30.0, hoodSlide: 28.0 },
};

const K1000_OPTICS = {
  'k-28-2.8': [
    [0.09, 0.94, 2.8, 1.5, -1.0], [0.24, 0.80, 2.2, 2.4, -1.2], [0.39, 0.70, 3.4, 1.7, 3.6],
    [0.56, 0.62, 1.8, -1.6, -4.4], [0.68, 0.68, 3.2, -4.4, 1.9], [0.82, 0.74, 2.4, 3.0, -2.8], [0.94, 0.78, 2.2, -2.6, 3.8],
  ],
  'k-35-2': [
    [0.08, 0.94, 3.0, 1.8, -2.2], [0.22, 0.84, 3.2, 1.9, -2.5], [0.38, 0.72, 2.0, 2.2, -1.6],
    [0.56, 0.66, 1.8, -1.6, 3.2], [0.68, 0.74, 3.6, 3.2, -2.0], [0.82, 0.80, 2.6, 2.8, -3.4], [0.94, 0.84, 2.6, 3.2, -2.8],
  ],
  'k-50-2': [
    [0.12, 0.96, 3.2, 2.0, -3.8], [0.32, 0.84, 3.0, 1.7, -1.6], [0.58, 0.76, 1.8, -1.5, 3.4],
    [0.74, 0.86, 3.4, 3.4, -2.2], [0.91, 0.90, 2.8, 2.8, -3.4],
  ],
  'k-50-1.7': [
    [0.10, 0.96, 3.6, 2.0, -3.6], [0.27, 0.86, 3.2, 1.8, -2.4], [0.43, 0.74, 1.8, 3.0, -1.4],
    [0.62, 0.74, 1.8, -1.45, 3.2], [0.74, 0.84, 3.8, 3.2, -2.0], [0.92, 0.88, 2.8, 3.0, -3.2],
  ],
  'k-85-2': [
    [0.09, 0.96, 4.4, 1.9, -3.6], [0.28, 0.86, 3.6, 1.8, -2.6], [0.46, 0.74, 2.0, -2.2, 1.7],
    [0.68, 0.78, 3.8, 3.2, -2.2], [0.90, 0.84, 3.0, 2.8, -3.4],
  ],
  'k-135-3.5': [
    [0.08, 0.96, 4.6, 2.0, -4.2], [0.24, 0.86, 2.6, -2.6, 2.0], [0.42, 0.74, 3.6, 2.6, -3.0],
    [0.68, 0.68, 2.4, -2.2, 2.8], [0.88, 0.64, 2.8, 3.0, -2.8],
  ],
};

const lensDef = (lens) => LENS_DEFS[lens.id] || LENS_DEFS['k-50-2'];
const focusPitch = (lens) => lensDef(lens).focusPitch;
const focusAngle = (lens, d) => -focusPitch(lens) * helicoidExtensionMm(lens, d);
function distanceAt(lens, angle) {
  const ext = Math.max(0, angle) / focusPitch(lens);
  if (ext < 1e-4) return 10000;
  let lo = lens.minFocusDistance, hi = 10000;
  for (let i = 0; i < 40; i++) { const mid = Math.sqrt(lo * hi); if (helicoidExtensionMm(lens, mid) > ext) lo = mid; else hi = mid; }
  return Math.sqrt(lo * hi);
}

// ───────── Engraved Atlases & Sub-Pixel Vector-Traced 1976 Split-Stem K1000 Badge ─────────
function k1000BadgeTex() {
  // Exact 1976 Asahi K1000 logotype traced directly from Pentax_K1000_by-RaBoe-001.jpg (_badge_k1000_grid.png):
  // Signature split-stem K (detached left vertical serif bar + right chevron w/ horizontal flags) + condensed square-stadium 1000!
  const W = 1024, H = 256, cv = canvas(W, H), g = cv.getContext('2d');
  g.clearRect(0, 0, W, H);
  const s = W / 112.0; // maps design X=[41..153] -> [0..1024], Y=[4..32] -> [0..256]
  const tx = (x) => (x - 41.0) * s;
  const ty = (y) => (y - 18.0) * s + H / 2;
  g.fillStyle = '#111215';
  const fillPoly = (pts) => {
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(tx(x), ty(y)) : g.moveTo(tx(x), ty(y))));
    g.closePath();
    g.fill();
  };
  // 1. Detached vertical serif stem of 'K'
  fillPoly([[44, 7], [55, 7], [55, 31.5], [44, 31.5], [44, 29.0], [49.5, 29.0], [49.5, 9.5], [44, 9.5]]);
  // 2. Detached chevron '<' arm of 'K' (2-unit air gap between x=55 and x=57!)
  fillPoly([[57, 19.0], [71, 6.2], [87.5, 6.2], [87.5, 9.2], [74.5, 9.2], [63.5, 19.0], [74.5, 28.4], [87.5, 28.4], [87.5, 31.4], [70.5, 31.4]]);
  // 3. Condensed serif '1' (slightly bolder stroke matching _badge_k1000.png!)
  fillPoly([[91.5, 13.0], [100.8, 13.0], [100.8, 28.4], [104.0, 28.4], [104.0, 31.4], [91.5, 31.4], [91.5, 28.4], [96.0, 28.4], [96.0, 16.4], [91.5, 16.4]]);
  // 4. Three condensed rounded-corner stadium '0's
  [106.5, 122.0, 137.5].forEach((x0) => {
    g.beginPath();
    g.roundRect(tx(x0), ty(12.8), 12.2 * s, 18.6 * s, 3.6 * s);
    g.fill();
    g.globalCompositeOperation = 'destination-out';
    g.beginPath();
    g.roundRect(tx(x0 + 3.6), ty(16.0), 5.0 * s, 12.2 * s, 1.3 * s);
    g.fill();
    g.globalCompositeOperation = 'source-over';
  });
  const t = tex(cv); t.anisotropy = 8;
  return t;
}

function prismFrontTex() {
  // Neutral GLASS WORKS + subtle geometric crest on satin-chrome K1000 pentaprism (ASAHI PENTAX layout!)
  const cv = canvas(512, 256), g = cv.getContext('2d');
  g.clearRect(0, 0, 512, 256);
  // Subtle geometric hexagonal GW emblem at upper prism face
  g.strokeStyle = '#383b40'; g.lineWidth = 5;
  g.beginPath();
  [[256, 20], [302, 50], [290, 92], [222, 92], [210, 50]].forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath(); g.stroke();
  g.fillStyle = '#383b40'; g.font = `700 34px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('GW', 256, 60);
  // Bold crisp black enamel wordmark across lower prism brow (matches ASAHI PENTAX visual weight!)
  g.fillStyle = '#0c0d10';
  g.font = `700 34px ${FONT}`; g.fillText('OPTICAL', 256, 146);
  g.font = `900 66px ${FONT}`; g.fillText('GLASS WORKS', 256, 208);
  return tex(cv);
}

function rearTopEngraveTex() {
  const cv = canvas(320, 64), g = cv.getContext('2d');
  g.clearRect(0, 0, 320, 64);
  g.fillStyle = '#686b70'; g.font = `600 28px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('GLASS WORKS CO.', 160, 32);
  return tex(cv);
}

function drawSpeedDial(cv, iso = 400) {
  // Authentic K1000 shutter speed / ASA dial (ks_k1000_unit_04.jpg):
  // Deep jet-black satin face, bold white 1000..1, orange 60X, green B, orange ASA & recessed white ASA window, silver cap!
  const g = cv.getContext('2d');
  g.fillStyle = '#050507'; g.fillRect(0, 0, 512, 512);
  g.strokeStyle = '#36383e'; g.lineWidth = 6; g.beginPath(); g.arc(256, 256, 244, 0, TAU); g.stroke();
  // Recessed white ASA speed readout window + orange 'ASA' legend (updates dynamically from film ISO!)
  g.save();
  g.translate(345, 256); g.rotate(Math.PI / 2);
  g.fillStyle = '#f2efe8'; g.fillRect(-38, -22, 76, 44);
  g.strokeStyle = '#4a4c52'; g.lineWidth = 3; g.strokeRect(-38, -22, 76, 44);
  g.fillStyle = '#111216'; g.font = `800 30px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(String(Math.round(iso || 400)), 0, 2);
  g.restore();
  g.save(); g.translate(296, 256); g.rotate(Math.PI / 2);
  g.fillStyle = '#e86824'; g.font = `700 22px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('ASA', 0, 0); g.restore();
  DIAL_LABELS.forEach((lbl, i) => {
    const a = Math.PI - i * DIAL_STEP;
    const col = lbl === 'B' ? '#3ac768' : lbl === '60X' ? '#eb6826' : '#f4f2ec';
    arcText(g, lbl, 256, 256, 198, a, lbl.length > 3 ? 28 : 34, col, 700);
  });
  // Center silver machined cap screw
  g.fillStyle = '#cfd3d8'; g.beginPath(); g.arc(256, 256, 54, 0, TAU); g.fill();
  g.strokeStyle = '#40444a'; g.lineWidth = 4; g.stroke();
}

function rewindTopTex() {
  // Smooth glossy-black K1000 rewind drum top w/ green 'R' & curved white rewind arrow (ks_k1000_unit_04.jpg!)
  const cv = canvas(256, 256), g = cv.getContext('2d');
  g.fillStyle = '#0c0c0f'; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = '#36383e'; g.lineWidth = 5; g.beginPath(); g.arc(128, 128, 120, 0, TAU); g.stroke();
  // Green 'R' at top & crisp white curved arrow at bottom
  g.fillStyle = '#3dc96c'; g.font = `700 32px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('R', 128, 44);
  g.strokeStyle = '#d8dce2'; g.lineWidth = 4;
  g.beginPath(); g.arc(128, 128, 86, 0.35, 2.55); g.stroke();
  g.fillStyle = '#d8dce2';
  g.beginPath(); g.moveTo(198, 166); g.lineTo(212, 146); g.lineTo(188, 152); g.closePath(); g.fill();
  return tex(cv);
}

function batteryCapTex() {
  const cv = canvas(256, 256), g = cv.getContext('2d');
  g.fillStyle = '#cfd2d6'; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = '#80848a'; g.lineWidth = 5; g.beginPath(); g.arc(128, 128, 120, 0, TAU); g.stroke();
  arcText(g, 'BATTERY', 128, 128, 84, Math.PI / 2, 24, '#60646a', 600);
  arcText(g, 'OPEN', 128, 128, 84, -Math.PI / 2, 24, '#60646a', 600, true);
  return tex(cv);
}

function bottomSerialTex() {
  const cv = canvas(320, 80), g = cv.getContext('2d');
  g.clearRect(0, 0, 320, 80);
  g.fillStyle = '#565a60'; g.font = `500 44px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('6 6 2 2 3 0 0', 160, 42);
  return tex(cv);
}

function hotShoeTopTex() {
  const cv = canvas(128, 128), g = cv.getContext('2d');
  g.clearRect(0, 0, 128, 128);
  g.fillStyle = '#d93826'; g.font = `800 58px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('X', 64, 66);
  return tex(cv);
}

function lensAtlas(lens) {
  // Authentic SMC Pentax-M lens engravings (ks_pentax_m50_01.jpg):
  // Row 0: Distance scale (blue/amber ft top, crisp white m bottom)
  // Row 1: DoF scale + red diamond index + chrome collar band
  // Row 2: Aperture scale (22..2, blue/white stops)
  const W = 4096, RH = 128, cv = canvas(W, RH * 4), g = cv.getContext('2d');
  g.fillStyle = PAINT_BG; g.fillRect(0, 0, W, cv.height);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const X = (phi) => ((((0.5 + phi / TAU) % 1) + 1) % 1) * W;
  const text = (row, phi, str, y, size, color, weight = 600) => {
    g.save(); g.translate(X(phi), row * RH + y * RH); g.scale(0.56, 1);
    g.font = `${weight} ${size}px ${FONT}`; g.fillStyle = color; g.textAlign = 'center'; g.fillText(str, 0, 0); g.restore();
  };
  const tick = (row, phi, y0, y1, wPx, color) => { g.fillStyle = color; g.fillRect(X(phi) - wPx / 2, row * RH + y0 * RH, wPx, (y1 - y0) * RH); };
  const BLUE = '#4a9ce8', ORANGE = '#e88b2a';
  const scale = (list, toM, y, color) => {
    let last = 1e9;
    list.forEach((d) => {
      const phi = isFinite(d) ? focusAngle(lens, d * toM) : 0;
      if (isFinite(d) && d * toM < lens.minFocusDistance - 1e-6) return;
      if (Math.abs(phi - last) < 7 * DEG && isFinite(d)) return;
      last = phi;
      text(0, phi, isFinite(d) ? String(d) : '∞', y, 42, color);
    });
  };
  scale([Infinity, 30, 15, 10, 7, 5, 3.5, 2.5, 2, 1.5, 1.2], 0.3048, 0.30, BLUE);
  scale([Infinity, 10, 5, 3, 2, 1.5, 1, 0.8, 0.6, 0.45, 0.3], 1, 0.72, INK.white);
  const pitch = focusPitch(lens);
  // Central red index diamond & symmetrical DoF color ticks
  tick(1, 0, 0.08, 0.88, 8, '#e23b28');
  lens.apertureStops.filter((N) => N >= 4 && N <= 22).slice(0, 4).forEach((N) => {
    const a = Math.min(36 * DEG, pitch * N * COC);
    const col = N === 22 ? ORANGE : N === 16 ? BLUE : INK.white;
    [-1, 1].forEach((s) => { tick(1, s * a, 0.12, 0.52, 4, col); text(1, s * a, String(N), 0.76, 30, col, 600); });
  });
  lens.apertureStops.forEach((N, i) => {
    const col = N === 22 ? ORANGE : N === 16 ? BLUE : INK.white;
    text(2, i * AP_STEP, String(N), 0.52, 46, col, 600);
  });
  const t = tex(cv); t.wrapS = THREE.RepeatWrapping;
  return t;
}

function bandRow(g, row, phi0 = -Math.PI, phiLen = TAU) {
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) { uv.setX(i, 0.5 + (phi0 + uv.getX(i) * phiLen) / TAU); uv.setY(i, 1 - (row + 1) / 4 + uv.getY(i) / 4); }
  return g;
}

function frontRingTex(lens, def) {
  // Authentic SMC Pentax-M front beauty ring (ks_pentax_m50_03.jpg!): neutral GLASS WORKS-M (Law #27 >= 3.6 mm ring width!)
  const cv = canvas(1024, 1024), g = cv.getContext('2d');
  g.fillStyle = '#08080a'; g.fillRect(0, 0, 1024, 1024);
  const rInner = Math.min(def.thread - 3.6, def.glassR + (def.funnelPad ?? 0.6));
  const rInPx = 512 * rInner / (def.thread - 0.2);
  const R = (rInPx + 506) / 2;
  // Crisp concentric machined hairline bezel rules framing the SMC nameplate
  g.strokeStyle = 'rgba(225,228,236,0.22)'; g.lineWidth = 2.5;
  [rInPx + 10, 496].forEach((rr) => { g.beginPath(); g.arc(512, 512, rr, 0, TAU); g.stroke(); });
  arcText(g, `SMC GLASS WORKS-M 1:${lens.maxAperture} ${lens.focalLength}mm`, 512, 512, R, Math.PI * 0.72, 36, '#eeece4', 600);
  arcText(g, `${def.serial || '8251980'}   Ø${Math.round(def.thread * 2)}mm   OPTICAL CO.`, 512, 512, R, -Math.PI * 0.42, 34, '#eeece4', 600, true);
  return tex(cv);
}

function filmStripTex() {
  const W = 1024, H = 350, cv = canvas(W, H), g = cv.getContext('2d');
  g.fillStyle = 'rgba(138, 78, 34, 0.78)'; g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(65, 34, 14, 0.55)'; g.lineWidth = 4;
  for (let x = 24; x < W; x += 380) g.strokeRect(x, 56, 360, 238);
  g.globalCompositeOperation = 'destination-out';
  for (let x = 14; x < W - 14; x += 47.5) {
    g.beginPath(); g.roundRect(x, 18, 20, 28, 5); g.fill();
    g.beginPath(); g.roundRect(x, H - 46, 20, 28, 5); g.fill();
  }
  g.globalCompositeOperation = 'source-over';
  g.fillStyle = '#f6c86e'; g.font = `700 13px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let i = 0; i < 6; i++) {
    g.fillText('GW 400', 80 + i * 190, 9);
    g.fillText(`${i + 1}A`, 175 + i * 190, H - 8);
  }
  const t = tex(cv); t.wrapS = THREE.RepeatWrapping; return t;
}

function cassetteTex() {
  const cv = canvas(512, 512), g = cv.getContext('2d');
  g.fillStyle = '#266642'; g.fillRect(0, 0, 512, 512);
  g.fillStyle = '#141518'; g.fillRect(0, 0, 512, 128); g.fillRect(0, 408, 512, 104);
  g.fillStyle = '#f4f2ea'; g.font = `800 54px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('GW 400', 256, 236);
  g.fillStyle = '#e4e8dc'; g.font = `700 30px ${FONT}`;
  g.fillText('35mm · 36 EXP', 256, 316);
  g.font = `600 26px ${FONT}`; g.fillText('GLASS WORKS FILM', 256, 66);
  return tex(cv);
}

function focusScreenTex() {
  // K1000 cross-microprism + fine Fresnel ground glass (manual p-08)
  const cv = canvas(512, 342), g = cv.getContext('2d');
  g.fillStyle = 'rgba(222, 228, 226, 0.38)'; g.fillRect(0, 0, 512, 342);
  g.strokeStyle = 'rgba(170, 178, 176, 0.25)'; g.lineWidth = 1.5;
  for (let r = 52; r < 290; r += 12) { g.beginPath(); g.arc(256, 171, r, 0, TAU); g.stroke(); }
  g.strokeStyle = 'rgba(38, 42, 46, 0.65)'; g.lineWidth = 3;
  g.beginPath(); g.arc(256, 171, 42, 0, TAU); g.stroke();
  g.beginPath(); g.arc(256, 171, 22, 0, TAU); g.stroke();
  // Match-needle CdS meter scale on right side of finder (manual p-12!)
  g.fillStyle = 'rgba(28, 30, 34, 0.72)'; g.fillRect(468, 86, 12, 170);
  g.fillStyle = 'rgba(240, 240, 236, 0.85)'; g.fillRect(460, 166, 24, 10);
  return tex(cv);
}

// ───────── Signature Softly-Filleted 45° Octagonal-Chamfered Pentax K1000 Plan Shapes (ks_k1000_unit_03 & 04!) ─────────
// slab rotated by rx = -PI/2 maps shape (x, y) -> world (x, z = -y), so yFront = -zF, yBack = -zB.
function k1000PlanShape(x0, x1, zF, zB, inset = 0) {
  const lx = x0 + inset, rx = x1 - inset, yF = -zF - inset, yB = -zB + inset;
  const ch = 8.8, rf = 3.2;
  const s = new THREE.Shape();
  s.moveTo(lx + ch + rf, yB);
  s.lineTo(rx - ch - rf, yB);
  s.quadraticCurveTo(rx - ch, yB, rx - ch + rf * 0.7, yB + rf * 0.7);
  s.lineTo(rx - rf * 0.7, yB + ch - rf * 0.7);
  s.quadraticCurveTo(rx, yB + ch, rx, yB + ch + rf);
  s.lineTo(rx, yF - ch - rf);
  s.quadraticCurveTo(rx, yF - ch, rx - rf * 0.7, yF - ch + rf * 0.7);
  s.lineTo(rx - ch + rf * 0.7, yF - rf * 0.7);
  s.quadraticCurveTo(rx - ch, yF, rx - ch - rf, yF);
  s.lineTo(lx + ch + rf, yF);
  s.quadraticCurveTo(lx + ch, yF, lx + ch - rf * 0.7, yF - rf * 0.7);
  s.lineTo(lx + rf * 0.7, yF - ch + rf * 0.7);
  s.quadraticCurveTo(lx, yF - ch, lx, yF - ch - rf);
  s.lineTo(lx, yB + ch + rf);
  s.quadraticCurveTo(lx, yB + ch, lx + rf * 0.7, yB + ch - rf * 0.7);
  s.lineTo(lx + ch - rf * 0.7, yB + rf * 0.7);
  s.quadraticCurveTo(lx + ch, yB, lx + ch + rf, yB);
  return s;
}

function k1000LeftWingPlan(x0, zF, zB, inset = 0) {
  const lx = x0 + inset, yF = -zF - inset, yB = -zB + inset;
  const ch = 8.8, rf = 3.2, cavL = -42.2;
  const s = new THREE.Shape();
  s.moveTo(-21.5, yF);
  s.lineTo(lx + ch + rf, yF);
  s.quadraticCurveTo(lx + ch, yF, lx + ch - rf * 0.7, yF - rf * 0.7);
  s.lineTo(lx + rf * 0.7, yF - ch + rf * 0.7);
  s.quadraticCurveTo(lx, yF - ch, lx, yF - ch - rf);
  s.lineTo(lx, yB + ch + rf);
  s.quadraticCurveTo(lx, yB + ch, lx + rf * 0.7, yB + ch - rf * 0.7);
  s.lineTo(lx + ch - rf * 0.7, yB + rf * 0.7);
  s.quadraticCurveTo(lx + ch, yB, cavL, yB);
  s.lineTo(cavL, 24.5);
  s.lineTo(-29.0, 24.5);
  s.lineTo(-29.0, 4.5);
  s.lineTo(-21.5, 4.5);
  s.closePath();
  return s;
}

function k1000RightWingPlan(x1, zF, zB, inset = 0) {
  const rx = x1 - inset, yF = -zF - inset, yB = -zB + inset;
  const ch = 8.8, rf = 3.2, cavR = 71.8;
  const s = new THREE.Shape();
  s.moveTo(cavR, yB);
  s.quadraticCurveTo(rx - ch, yB, rx - ch + rf * 0.7, yB + rf * 0.7);
  s.lineTo(rx - rf * 0.7, yB + ch - rf * 0.7);
  s.quadraticCurveTo(rx, yB + ch, rx, yB + ch + rf);
  s.lineTo(rx, yF - ch - rf);
  s.quadraticCurveTo(rx, yF - ch, rx - rf * 0.7, yF - ch + rf * 0.7);
  s.lineTo(rx - ch + rf * 0.7, yF - rf * 0.7);
  s.quadraticCurveTo(rx - ch, yF, rx - ch - rf, yF);
  s.lineTo(21.5, yF);
  s.lineTo(21.5, 4.5);
  s.lineTo(31.0, 4.5);
  s.lineTo(31.0, 15.0);
  s.lineTo(48.0, 15.0);
  s.lineTo(48.0, 20.0);
  s.lineTo(cavR, 20.0);
  s.closePath();
  return s;
}

// ───────── Smoothly Deep-Drawn Satin-Chrome Pentax K1000 Pentaprism Loft (true mm arc-length UVs + generous 2.8 mm stamped fillets!) ─────────
function buildK1000PrismGeo() {
  // Levels: [y, xFront, xRear, zFront, zRear, cornerR, wear]
  const levels = [
    [41.4, 23.4, 23.0, -37.0,  2.8, 2.6, 0.25],
    [43.4, 21.6, 21.4, -35.6,  2.6, 2.7, 0.35],
    [44.8, 20.4, 20.3, -34.6,  2.4, 2.8, 0.50],
    [45.6, 19.6, 19.8, -33.7,  2.1, 2.9, 0.65], // crisp classic Spotmatic/K1000 brow step
    [46.8, 18.7, 19.1, -32.4,  1.8, 3.0, 0.52],
    [51.5, 15.4, 16.0, -28.4, -0.1, 3.0, 0.48],
    [56.2, 12.1, 12.9, -24.3, -1.9, 2.9, 0.58],
    [58.4, 10.6, 11.4, -22.4, -2.8, 2.6, 0.70],
    [59.4,  9.8, 10.7, -21.2, -3.6, 2.2, 0.80],
    [60.1,  8.9,  9.8, -20.1, -4.4, 1.8, 0.86],
    [60.4,  8.0,  8.9, -19.2, -5.1, 1.4, 0.90], // softly crowned deep-drawn brass trapezoid peak!
  ];
  const ARC = 10;
  const ringPts = (xF, xR, zF, zR, r) => {
    const pts = [];
    const rr = Math.min(r, xF * 0.85, (zR - zF) * 0.42);
    const corners = [
      [ xF - rr, zF + rr, -Math.PI / 2, 0],
      [ xR - rr, zR - rr, 0,            Math.PI / 2],
      [-xR + rr, zR - rr, Math.PI / 2,  Math.PI],
      [-xF + rr, zF + rr, Math.PI,      Math.PI * 1.5],
    ];
    for (const [cx, cz, a0, a1] of corners) {
      for (let k = 0; k <= ARC; k++) {
        const a = lerp(a0, a1, k / ARC);
        pts.push([cx + Math.cos(a) * rr, cz + Math.sin(a) * rr]);
      }
    }
    return pts;
  };
  const rings = levels.map(([y, xF, xR, zF, zR, r, w]) => ({ y, w, pts: ringPts(xF, xR, zF, zR, r) }));
  const N = rings[0].pts.length, R = rings.length;
  const pos = [], uv = [], wear = [], idx = [];
  for (let i = 0; i < R; i++) {
    const rg = rings[i];
    let sMm = 0;
    for (let j = 0; j < N; j++) {
      const [px, pz] = rg.pts[j];
      if (j > 0) { const [qx, qz] = rg.pts[j - 1]; sMm += Math.hypot(px - qx, pz - qz); }
      // True millimeter arc-length UVs so beadBlastMaps() & brushedMap() tile seamlessly at physical scale!
      pos.push(px, rg.y, pz); uv.push(sMm, rg.y); wear.push(rg.w);
    }
  }
  for (let i = 0; i < R - 1; i++) {
    for (let j = 0; j < N; j++) {
      const jn = (j + 1) % N;
      const a = i * N + j, b = i * N + jn, c = (i + 1) * N + j, d = (i + 1) * N + jn;
      idx.push(a, c, b, b, c, d);
    }
  }
  const topC = pos.length / 3, topL = rings[R - 1];
  pos.push(0, topL.y, -12.0); uv.push(0, -12.0); wear.push(0.5);
  const topBase = pos.length / 3;
  for (let j = 0; j < N; j++) { const [px, pz] = topL.pts[j]; pos.push(px, topL.y, pz); uv.push(px, pz); wear.push(0.8); }
  for (let j = 0; j < N; j++) { const jn = (j + 1) % N; idx.push(topC, topBase + jn, topBase + j); }
  const botC = pos.length / 3, botL = rings[0];
  pos.push(0, botL.y, -16.0); uv.push(0, -16.0); wear.push(0.2);
  for (let j = 0; j < N; j++) { const jn = (j + 1) % N; idx.push(botC, j, jn); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('wear', new THREE.Float32BufferAttribute(wear, 1));
  g.setIndex(idx);
  g.computeVertexNormals();
  return prep(g);
}

function buildOpticalPentaprismGeo() {
  const s = new THREE.Shape();
  s.moveTo(-29.0, 23.0);
  s.lineTo(-4.0, 23.0);
  s.lineTo(-4.0, 44.0);
  s.lineTo(-17.0, 54.0);
  s.lineTo(-30.0, 38.0);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 19.0, bevelEnabled: false });
  g.rotateY(-Math.PI / 2);
  g.translate(9.5, 0, 0);
  return prep(g);
}

// ───────── 1976 Satin-Chrome Pentax K1000 Body Builder ─────────
function buildBody(lib, hov) {
  const chr = lib.get('satinChrome'), bright = lib.get('chromeBright'), turned = lib.get('turned'), bk = lib.get('blackEnamel');
  const leather = lib.get('leather'), rubber = lib.get('rubber'), steel = lib.get('steel'), anod = lib.get('anod');
  const flock = lib.get('flock'), brass = lib.get('brass');
  const intBlk = lib.get('interiorBlack'), pPlate = lib.get('pressurePlate');

  const core = new THREE.Group(), top = new THREE.Group(), bottom = new THREE.Group(), doorPivot = new THREE.Group();
  const ck = new Kit(), tk = new Kit(), btk = new Kit(), dk = new Kit();
  const zShellBack = B.zB;

  // Hollow split vulcanite leatherette wings (Y = -24.6 .. +25.9) opening BOTH central K-mount mirror box & 35 mm film chamber!
  const leftW = k1000LeftWingPlan(B.x0, B.zF, zShellBack, 0.2);
  const rightW = k1000RightWingPlan(B.x1, B.zF, zShellBack, 0.2);
  ck.add(slab(leftW, B.seamY - (B.baseY + 1.2), 0.45, 28, 0.4, 3), leather, T(0, B.baseY + 1.2, 0, -Math.PI / 2, 0, 0));
  ck.add(slab(rightW, B.seamY - (B.baseY + 1.2), 0.45, 28, 0.4, 3), leather, T(0, B.baseY + 1.2, 0, -Math.PI / 2, 0, 0));
  // Lower & upper matte-black trim bands framing leatherette cleanly (ks_k1000_unit_01 & 05!)
  const trimL = k1000LeftWingPlan(B.x0 + 0.1, B.zF, zShellBack, 0.05);
  const trimR = k1000RightWingPlan(B.x1 - 0.1, B.zF, zShellBack, 0.05);
  ck.add(slab(trimL, 1.3, 0.2, 24), bk, T(0, B.baseY, 0, -Math.PI / 2, 0, 0));
  ck.add(slab(trimR, 1.3, 0.2, 24), bk, T(0, B.baseY, 0, -Math.PI / 2, 0, 0));
  ck.add(slab(trimL, B.trimY - B.seamY, 0.25, 24), bk, T(0, B.seamY, 0, -Math.PI / 2, 0, 0));
  ck.add(slab(trimR, B.trimY - B.seamY, 0.25, 24), bk, T(0, B.seamY, 0, -Math.PI / 2, 0, 0));
  // Dead-flat matte black interior chamber floor & ceiling strictly inside 45° rear chamfers (Law #18: specularIntensity: 0!)
  ck.add(rbox(112.0, 2.0, 24.0, 0.2, 1), intBlk, T(14.8, B.baseY + 1.0, -10.5));
  ck.add(rbox(112.0, 1.6, 24.0, 0.2, 1), intBlk, T(14.8, 22.8, -10.5));

  // Smoothly Swept Satin-Chrome Mirror-Box Apron + Rounded Glossy-Black Lower Chin + 100% Open 45.0 mm K-Mount Throat
  // Note: slab() insets outer cap by b0 and outsets hole cap by b0, so outer-to-hole clearance MUST exceed 2*b0 (2*0.9=1.8 mm)!
  const apron = new THREE.Shape();
  apron.moveTo(-21.2, -25.4);
  apron.lineTo(21.2, -25.4);
  apron.bezierCurveTo(25.2, -25.0, 26.0, -21.2, 26.0, -13.0);
  apron.lineTo(26.0, 24.5);
  apron.bezierCurveTo(26.0, 28.8, 24.4, 32.5, 22.6, B.deck - 1.5);
  apron.quadraticCurveTo(21.4, B.deck, 19.2, B.deck);
  apron.lineTo(-19.2, B.deck);
  apron.quadraticCurveTo(-21.4, B.deck, -22.6, B.deck - 1.5);
  apron.bezierCurveTo(-24.4, 32.5, -26.0, 28.8, -26.0, 24.5);
  apron.lineTo(-26.0, -13.0);
  apron.bezierCurveTo(-26.0, -21.2, -25.2, -25.0, -21.2, -25.4);
  apron.closePath();
  apron.holes.push(new THREE.Path().absarc(0, 0, 22.6, 0, TAU, true));
  ck.add(slab(apron, 13.0, [0.9, 0.7], 36, 0.72, 5), chr, T(0, 0, -43.0));
  // Smoothly curved glossy-black lower chin hugging strictly below the open r=22.6 K-mount bore (ks_k1000_unit_03!)
  const chin = rrPath(-25.6, -28.2, 25.6, -24.0, 1.9);
  ck.add(slab(chin, 12.6, [0.9, 0.7], 32, 0.55, 4), bk, T(0, 0, -42.6));
  // Animated body-side K-mount automatic-diaphragm stop-down lever inside the open bayonet throat!
  const stopDownLever = new THREE.Group(); stopDownLever.position.set(-19.4, -4.5, -39.2);
  { const slk = new Kit(); slk.add(rbox(2.2, 6.4, 4.6, 0.3, 1), steel); slk.build(stopDownLever); }
  core.add(stopDownLever);
  // Satin-chrome step bezel & Turned Stainless Pentax K-Mount Bayonet Flange (OD 54.4 mm, ID 45.0 mm at z = -45.46!)
  ck.add(revolve([[28.2, -42.4], [28.2, -44.2, 0.5], [27.2, -44.6], [22.6, -44.6], [22.6, -42.4]], { segs: 96, crease: 30 }), turned);
  ck.add(revolve([[27.0, -44.2], [27.0, DIM.flange, 0.4], [22.5, DIM.flange], [22.5, -40.5]], { segs: 96, crease: 30 }), bright);
  // 4 recessed K-mount flange screws + red alignment dot at 12 o'clock + ribbed black K-mount lens release lever (+X lower-right!)
  [45, 135, 225, 315].forEach((a) => {
    const rad = a * DEG;
    addScrew(ck, steel, ck, flock, T(Math.cos(rad) * 24.8, Math.sin(rad) * 24.8, DIM.flange - 0.08, 0, Math.PI, 0), 1.05, true, 0.3);
  });
  ck.add(new THREE.SphereGeometry(0.85, 16, 12), lib.get('red'), T(0, 25.0, DIM.flange - 0.1));
  ck.add(rbox(3.6, 9.2, 4.6, 0.9, 3, 0.35), rubber, T(27.8, -7.5, -39.5, 0, 0, 0.12));
  [-2.6, 0, 2.6].forEach((ry) => ck.add(rbox(3.9, 0.7, 3.8, 0.15, 1), anod, T(27.8, -7.5 + ry, -40.0, 0, 0, 0.12)));
  // Lower-left (-X) Machined Coaxial X-Flash PC Sync Socket w/ concentric chrome collar + recessed dark bore + brass center pin (ks_k1000_01.jpg!)
  ck.add(revolve([[3.7, 0], [3.7, 0.6], [3.3, 0.8], [0, 0.8]], { segs: 36 }), anod, T(-38.0, -15.0, B.zF - 0.05, Math.PI, 0, 0));
  ck.add(revolve([[3.1, 0.4], [3.1, 2.0, 0.35], [2.4, 2.2], [2.4, 0.6], [0, 0.6]], { segs: 36 }), bright, T(-38.0, -15.0, B.zF - 0.08, Math.PI, 0, 0));
  ck.add(revolve([[1.9, 0.6], [1.9, 1.8], [1.1, 1.8], [1.1, 0.6]], { segs: 28 }), flock, T(-38.0, -15.0, B.zF - 0.08, Math.PI, 0, 0));
  ck.add(revolve([[0.65, 0.6], [0.65, 1.9], [0, 1.9]], { segs: 20 }), brass, T(-38.0, -15.0, B.zF - 0.08, Math.PI, 0, 0));

  // Open Dead-Flat Black Mirror-Box Tunnel + Upper Foam Damper + Fresnel Focusing Screen
  const throatTube = new THREE.CylinderGeometry(22.4, 22.4, 38.0, 48, 1, true);
  throatTube.rotateX(Math.PI / 2); throatTube.translate(0, 0, -23.0);
  ck.add(throatTube, lib.prepare(new THREE.MeshPhysicalMaterial({ name: 'k1000InteriorThroat', color: 0x020203, roughness: 0.98, metalness: 0.0, specularIntensity: 0.0, envMapIntensity: 0.04, side: THREE.BackSide }), {}));
  [-20.5, 20.5].forEach((mx) => ck.add(rbox(1.6, 36.0, 32.0, 0.2, 1), intBlk, T(mx, 0, -21.0)));
  ck.add(rbox(40.0, 2.2, 32.0, 0.2, 1), intBlk, T(0, -18.5, -21.0));
  ck.add(rbox(36.0, 2.6, 4.2, 0.4, 1), lib.get('felt'), T(0, 18.8, -36.0));
  ck.add(new THREE.PlaneGeometry(36.0, 24.0), lib.prepare(new THREE.MeshPhysicalMaterial({ map: focusScreenTex(), transparent: true, roughness: 0.35, metalness: 0.05, side: THREE.DoubleSide }), {}), T(0, 21.0, -21.5, -Math.PI / 2, 0, 0));

  // ───────── Open-Back 35 mm Film Compartment (ks_k1000_unit_06.jpg!) ─────────
  const gate = rrPath(-30.0, -19.5, 30.0, 19.5, 0.8); gate.holes.push(rrPath(-18.0, -12.0, 18.0, 12.0, 0.25, new THREE.Path()));
  ck.add(slab(gate, 2.2, 0.2), intBlk, T(0, 0, -2.8));
  [-12.4, 12.4].forEach((ry) => ck.add(rbox(60.0, 2.0, 1.0, 0.15, 1, 0.75), bright, T(0, ry, -0.35)));
  [-17.8, 17.8].forEach((ry) => ck.add(rbox(58.0, 1.5, 1.4, 0.15, 1, 0.75), bright, T(0, ry, -0.15)));
  // Open-backed left (-X) cassette well + GW 400 film cartridge (centered at X=-39.2 so r=12.2 clears B.x0=-53.2 by 1.8 mm!)
  const cassWell = new THREE.CylinderGeometry(12.2, 12.2, 42.0, 28, 1, true, Math.PI * 0.55, Math.PI * 0.90);
  cassWell.translate(-39.2, -1.0, DIM.rewind.z);
  ck.add(cassWell, lib.prepare(new THREE.MeshPhysicalMaterial({ name: 'k1000InteriorCassWell', color: 0x020203, roughness: 0.98, metalness: 0.0, specularIntensity: 0.0, envMapIntensity: 0.04, side: THREE.BackSide }), {}));
  const filmCart = new THREE.Group(); filmCart.position.set(-39.2, -1.0, DIM.rewind.z);
  {
    const fc = new Kit();
    const cCyl = new THREE.CylinderGeometry(11.8, 11.8, 39.0, 36, 1, true);
    cCyl.rotateY(Math.PI);
    fc.add(cCyl, lib.prepare(new THREE.MeshPhysicalMaterial({ map: cassetteTex(), roughness: 0.32, metalness: 0.24 }), {}));
    [-19.8, 19.8].forEach((cy) => fc.add(revolve([[12.2, -1.0], [12.2, 1.0, 0.35], [5.4, 1.2], [0, 1.2]], { segs: 36 }), bk, T(0, cy, 0, Math.PI / 2, 0, 0)));
    fc.add(rbox(6.5, 36.0, 4.4, 0.6, 1), lib.get('felt'), T(11.0, 0, 8.2));
    fc.build(filmCart);
  }
  core.add(filmCart);

  // Cumulative Arc-Length 35 mm Translucent Perforated Film Web (Law #20!)
  const filmTex = filmStripTex();
  const filmStripMat = lib.prepare(new THREE.MeshPhysicalMaterial({ map: filmTex, transparent: true, roughness: 0.22, metalness: 0.08, side: THREE.DoubleSide }), {});
  const filmStrip = new THREE.Group();
  {
    const spline = new THREE.SplineCurve([
      new THREE.Vector2(-29.5, -2.5), new THREE.Vector2(-25.5, -0.3), new THREE.Vector2(-20.0, 0.25),
      new THREE.Vector2(0.0, 0.25), new THREE.Vector2(30.0, 0.25),
      new THREE.Vector2(38.5, 0.2), new THREE.Vector2(44.5, -0.5),
      new THREE.Vector2(54.0, -2.2), new THREE.Vector2(63.0, -4.5),
    ]);
    const pts = spline.getSpacedPoints(56);
    const pos = [], uvs = [], idx = [];
    const lens = [0];
    for (let i = 1; i < pts.length; i++) lens.push(lens[i - 1] + pts[i].distanceTo(pts[i - 1]));
    const tot = lens[lens.length - 1] || 1;
    pts.forEach((p, i) => {
      const u = (lens[i] / tot) * 2.55;
      pos.push(p.x, -17.4, p.y, p.x, 17.4, p.y);
      uvs.push(u, 0, u, 1);
      if (i < pts.length - 1) { const k = i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
    });
    const fg = new THREE.BufferGeometry();
    fg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    fg.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    fg.setIndex(idx); fg.computeVertexNormals();
    filmStrip.add(new THREE.Mesh(prep(fg), filmStripMat));
  }
  core.add(filmStrip);

  // Rotating 8-Tooth Black Sprocket Drum (X=+40.0) + Multi-Slotted Glossy Take-Up Spool (X=+61.0)
  const sprocket = new THREE.Group(); sprocket.position.set(40.0, -1.0, -5.8);
  {
    const sk = new Kit();
    sk.add(revolve([[5.2, -19.5], [5.2, 19.5, 0.3]], { segs: 36 }), bk, T(0, 0, 0, Math.PI / 2, 0, 0));
    [-13.8, 13.8].forEach((ty) => {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU;
        sk.add(rbox(1.1, 1.5, 2.2, 0.2, 1), bk, T(Math.cos(a) * 5.6, ty, Math.sin(a) * 5.6, 0, -a, 0));
      }
    });
    sk.build(sprocket);
  }
  core.add(sprocket);

  const takeup = new THREE.Group(); takeup.position.set(61.0, -1.0, -9.8);
  {
    const tk2 = new Kit();
    tk2.add(revolve([[5.8, -18.5], [5.8, 18.5]], { segs: 36 }), intBlk, T(0, 0, 0, Math.PI / 2, 0, 0));
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      tk2.add(rbox(2.2, 34.0, 4.6, 0.45, 2, 0.3), bk, T(Math.cos(a) * 6.8, 0, Math.sin(a) * 6.8, 0, -a, 0));
    }
    tk2.add(revolve([[9.2, -19.8], [9.5, -19.5, 0.3, 1], [9.5, -17.0, 0.3, 1], [9.0, -16.8]], { segs: 256, ribs: { n: 32, depth: 0.34 } }), anod, T(0, 0, 0, Math.PI / 2, 0, 0));
    tk2.add(revolve([[9.0, 16.8], [9.0, 19.2, 0.3], [0, 19.2]], { segs: 36 }), bk, T(0, 0, 0, Math.PI / 2, 0, 0));
    tk2.build(takeup);
  }
  core.add(takeup);

  // Side Chrome Strap Eyelets (Y=+34.2) + Fresh Per-Side Triangular Chrome D-Rings (NEVER share BufferGeometry across Kit.add!)
  const makeTriD = () => prep(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.2, 0), new THREE.Vector3(0, -1.5, 2.2), new THREE.Vector3(0, -7.8, 5.0),
    new THREE.Vector3(0, -10.8, 3.6), new THREE.Vector3(0, -11.0, 0),
    new THREE.Vector3(0, -10.8, -3.6), new THREE.Vector3(0, -7.8, -5.0), new THREE.Vector3(0, -1.5, -2.2),
  ], true, 'centripetal', 0.45), 56, 0.78, 14, true));
  [[B.x0 + 0.1, -1], [B.x1 - 0.1, 1]].forEach(([ex, sx]) => {
    ck.add(revolve([[2.5, -1.4], [2.5, 1.5, 0.4], [1.9, 1.9], [0, 1.9]], { segs: 36 }), bright, T(ex, 34.2, -16.5, 0, sx * Math.PI / 2, 0));
    ck.add(makeTriD(), bright, T(ex + sx * 1.4, 34.0, -16.5, 0, 0, sx * 0.16));
  });
  ck.build(core);

  // Instant-Return 45° Reflex Mirror
  const mirrorPivot = new THREE.Group(); mirrorPivot.position.set(0, 16.5, -11.5);
  {
    const mk = new Kit();
    mk.add(rbox(31.0, 1.2, 26.8, 0.25, 1), intBlk, T(0, -0.7, -13.6));
    [-16.0, 16.0].forEach((mx) => mk.add(rbox(1.3, 2.8, 25.0, 0.25, 1), steel, T(mx, -0.8, -13.0)));
    const mirMat = lib.prepare(new THREE.MeshPhysicalMaterial({ name: 'k1000ReflexMirror', map: focusScreenTex(), color: 0xaab4b8, metalness: 0.78, roughness: 0.08, clearcoat: 1.0, clearcoatRoughness: 0.04 }), {});
    mk.add(new THREE.PlaneGeometry(29.2, 25.0), mirMat, T(0, 0.02, -13.6, -Math.PI / 2, 0, 0));
    mk.build(mirrorPivot);
  }
  core.add(mirrorPivot);

  // Horizontal Rubberized-Silk Focal-Plane Shutter Curtains + Steel Laths
  const curtain1Cloth = new THREE.Mesh(prep(new THREE.PlaneGeometry(37.0, 24.4)), lib.get('curtain'));
  curtain1Cloth.position.set(0, 0, -1.9);
  const curtain1Lath = new THREE.Mesh(prep(rbox(1.3, 24.4, 0.4, 0.1, 1)), steel);
  curtain1Lath.position.set(-18.5, 0, -1.75);
  const curtain2Cloth = new THREE.Mesh(prep(new THREE.PlaneGeometry(37.0, 24.4)), lib.get('curtain'));
  curtain2Cloth.position.set(-18.5, 0, -1.55); curtain2Cloth.scale.x = 0.001;
  const curtain2Lath = new THREE.Mesh(prep(rbox(1.3, 24.4, 0.4, 0.1, 1)), steel);
  curtain2Lath.position.set(-18.5, 0, -1.4);
  core.add(curtain1Cloth, curtain1Lath, curtain2Cloth, curtain2Lath);

  // ───────── Deep-Drawn Stamped Satin Silver Chrome Top Plate + Rounded Pentaprism + Iconic K1000 Badge ─────────
  const topPlan = k1000PlanShape(B.x0 + 0.3, B.x1 - 0.3, B.zF, zShellBack, 0);
  // Asymmetric stamped-brass bevel [0.45 mm waist seam, 2.2 mm deep-drawn top shoulder, 6 analytic segments]!
  tk.add(slab(topPlan, B.deck - B.trimY, [0.45, 2.2], 36, 0.72, 6), chr, T(0, B.trimY, 0, -Math.PI / 2, 0, 0));
  tk.add(buildK1000PrismGeo(), chr);
  // Crisp bold black horizontal brow seam + zero-glare engraved neutral GLASS WORKS / GW prism lettering (ks_k1000_01.jpg!)
  const browTilt = Math.atan2(10.4, 12.2);
  tk.add(new THREE.PlaneGeometry(31.5, 15.6), lib.prepare(new THREE.MeshPhysicalMaterial({ map: prismFrontTex(), transparent: true, depthWrite: false, roughness: 0.90, metalness: 0.0, specularIntensity: 0.0, envMapIntensity: 0.04 }), {}), T(0, 51.2, -28.8, browTilt, Math.PI, 0));
  tk.add(rbox(40.2, 1.3, 1.2, 0.25, 2), bk, T(0, 44.8, -34.8));
  // Iconic vector-traced 1976 split-stem K1000 badge locked dead-on to overlay_0_front.png (X=+51.8, Y=+34.8, 22.2×5.6 mm!)
  tk.add(new THREE.PlaneGeometry(22.2, 5.6), lib.prepare(new THREE.MeshPhysicalMaterial({ map: k1000BadgeTex(), transparent: true, depthWrite: false, roughness: 0.88, metalness: 0.0, specularIntensity: 0.0, envMapIntensity: 0.04 }), {}), T(51.8, 34.8, B.zF - 0.12, 0, Math.PI, 0));
  // Subtle rear top-plate GLASS WORKS CO. engraving (ks_k1000_unit_05!)
  tk.add(new THREE.PlaneGeometry(24.0, 4.8), lib.prepare(new THREE.MeshPhysicalMaterial({ map: rearTopEngraveTex(), transparent: true, depthWrite: false, roughness: 0.85, specularIntensity: 0.0 }), {}), T(42.0, 35.8, zShellBack + 0.08));

  // Precision Machined Brushed-Steel Hot-Shoe Pedestal w/ Matte-Black Circular Insulator + Solid Brass X-Sync Contact (ks_k1000_unit_04!)
  const hsY = 53.0, hsZ = -9.5;
  tk.add(rbox(19.2, 7.6, 15.2, 1.3, 4, 0.35), rubber, T(0, hsY + 3.4, hsZ));
  [-8.0, 8.0].forEach((hx) => {
    tk.add(rbox(3.4, 2.2, 15.0, 0.4, 2, 0.6), steel, T(hx, hsY + 7.8, hsZ));
    tk.add(rbox(4.2, 0.9, 15.0, 0.3, 2, 0.65), bright, T(hx - Math.sign(hx) * 0.6, hsY + 8.8, hsZ));
  });
  tk.add(rbox(12.2, 0.7, 13.0, 0.2, 1), turned, T(0, hsY + 7.4, hsZ));
  tk.add(revolve([[4.0, 0], [4.0, 0.52, 0.15], [0, 0.52]], { segs: 36 }), rubber, T(0, hsY + 7.72, hsZ - 1.0, -Math.PI / 2, 0, 0));
  tk.add(revolve([[2.3, 0], [2.3, 0.68, 0.2], [2.0, 0.74], [0, 0.74]], { segs: 32 }), brass, T(0, hsY + 7.76, hsZ - 1.0, -Math.PI / 2, 0, 0));
  tk.add(new THREE.PlaneGeometry(3.8, 3.8), lib.prepare(new THREE.MeshPhysicalMaterial({ map: hotShoeTopTex(), transparent: true, alphaTest: 0.1, roughness: 0.5 }), {}), T(0, hsY + 7.82, hsZ + 4.4, -Math.PI / 2, 0, 0));

  // Solid Optical Roof Pentaprism Glass Block (visible in cutaway!)
  top.add(new THREE.Mesh(buildOpticalPentaprismGeo(), lib.get('innerGlass')));

  // Deeply Recessed Matte-Rubber Square Eyepiece w/ Domed Dark Blue-Coated Optical Ocular Glass (ks_k1000_unit_05!)
  const E = DIM.eyepiece;
  const eyeFrame = rrPath(-E.w / 2 - 2.6, -E.h / 2 - 2.2, E.w / 2 + 2.6, E.h / 2 + 2.2, 2.6);
  eyeFrame.holes.push(rrPath(-E.w / 2, -E.h / 2, E.w / 2, E.h / 2, 1.4, new THREE.Path()));
  tk.add(slab(eyeFrame, 3.8, [0.4, 0.9], 24, 0.35, 4), rubber, T(E.x, E.y, E.z - 2.6));
  const eyeBaseCv = canvas(256, 192), ebg = eyeBaseCv.getContext('2d');
  ebg.fillStyle = '#04060a'; ebg.fillRect(0, 0, 256, 192);
  ebg.fillStyle = '#091019'; ebg.fillRect(28, 24, 200, 144);
  ebg.strokeStyle = 'rgba(70, 105, 145, 0.16)'; ebg.lineWidth = 2;
  ebg.strokeRect(30, 26, 196, 140); ebg.beginPath(); ebg.arc(128, 96, 18, 0, TAU); ebg.stroke();
  const screenMat = lib.prepare(new THREE.MeshBasicMaterial({ map: tex(eyeBaseCv), color: 0xffffff, toneMapped: false }), {});
  const eyeScreen = new THREE.Mesh(prep(new THREE.PlaneGeometry(E.w, E.h)), screenMat);
  eyeScreen.scale.x = -1;
  eyeScreen.position.set(E.x, E.y, zShellBack + 0.14);
  eyeScreen.userData.part = 'finder'; eyeScreen.userData.noShadow = true;
  top.add(eyeScreen);
  const kOcularMat = lib.prepare(new THREE.MeshPhysicalMaterial({
    name: 'k1000OcularGlass', color: 0x0e1d30, emissive: 0x040b18, emissiveIntensity: 0.10, roughness: 0.03, metalness: 0.16,
    clearcoat: 1.0, clearcoatRoughness: 0.02, iridescence: 0.85, iridescenceIOR: 1.38, opacity: 0.42, transparent: true, depthWrite: false,
  }), {});
  const kDome = new THREE.PlaneGeometry(E.w - 0.3, E.h - 0.3, 16, 12);
  {
    const p = kDome.attributes.position, hw = (E.w - 0.3) * 0.5, hh = (E.h - 0.3) * 0.5;
    for (let i = 0; i < p.count; i++) { const u = p.getX(i) / hw, v = p.getY(i) / hh; p.setZ(i, 0.45 * Math.max(0, 1 - 0.55 * (u * u + v * v))); }
    kDome.computeVertexNormals();
  }
  tk.add(prep(kDome), kOcularMat, T(E.x, E.y, zShellBack + 0.42));
  const eyepieceMeshes = [eyeScreen];

  // Red Triangular Shutter-Speed Index on Satin-Chrome Deck + Tiny Recessed "Cocked" Indicator Dot
  const tri = new THREE.Shape(); tri.moveTo(0, 1.2); tri.lineTo(2.8, 0); tri.lineTo(0, -1.2); tri.closePath();
  tk.add(slab(tri, 0.25, 0.05, 8), lib.get('red'), T(27.0, B.deck + 0.05, DIM.dial.z, -Math.PI / 2, 0, 0));
  const cockedMat = lib.prepare(new THREE.MeshPhysicalMaterial({ name: 'k1000CockedDot', color: 0xd93826, roughness: 0.3 }), {});
  tk.add(revolve([[1.35, 0], [1.35, 0.2], [0, 0.2]], { segs: 24 }), anod, T(57.6, B.deck + 0.02, -21.2, -Math.PI / 2, 0, 0));
  tk.add(revolve([[1.05, 0], [1.05, 0.36], [0, 0.36]], { segs: 24 }), cockedMat, T(57.6, B.deck + 0.04, -21.2, -Math.PI / 2, 0, 0));
  tk.build(top);

  // Shutter Speed / ASA Dial (X=+41.4, Z=-13.5, r=10.6, h=6.7, recessed dark shadow base collar + 48-tooth knurling segs=384 + live ASA readout!)
  const dialCv = canvas(512, 512), dialTex = tex(dialCv);
  drawSpeedDial(dialCv, 400);
  const dial = new THREE.Group(); dial.position.set(DIM.dial.x, B.deck, DIM.dial.z);
  const dialK = new Kit(), dMat = lib.get('blackEnamel', { hover: hov.shutter });
  dialK.add(revolve([[DIM.dial.r - 0.2, 0], [DIM.dial.r - 0.2, 0.35], [0, 0.35]], { segs: 48 }), flock, T(0, 0, 0, -Math.PI / 2, 0, 0));
  dialK.add(revolve([[DIM.dial.r - 0.8, 0.2], [DIM.dial.r - 0.8, 1.4, 0.25], [DIM.dial.r, 1.7, 0.3, 1], [DIM.dial.r, DIM.dial.h - 0.4, 0.3, 1], [DIM.dial.r - 0.6, DIM.dial.h]], { segs: 384, ribs: { n: 48, depth: 0.34, groove: 0.48, edge: 0.16 } }), dMat, T(0, 0, 0, -Math.PI / 2, 0, 0));
  dialK.add(new THREE.CircleGeometry(DIM.dial.r - 0.65, 56), lib.prepare(new THREE.MeshPhysicalMaterial({ map: dialTex, roughness: 0.62, metalness: 0.04, specularIntensity: 0.14, envMapIntensity: 0.14 }), { hover: hov.shutter }), T(0, DIM.dial.h + 0.05, 0, -Math.PI / 2, 0, 0));
  const dialMeshes = dialK.build(dial, 'shutter');
  top.add(dial);

  // Gleaming Turned-Aluminum Shutter Release Guard Collar + Chamfered Chrome Plunger + Recessed Shadow Ring (ks_k1000_unit_04!)
  const release = new THREE.Group(); release.position.set(DIM.release.x, B.deck, DIM.release.z);
  const relK = new Kit(), rMat = lib.get('chromeBright', { hover: hov.release });
  relK.add(revolve([[DIM.release.r + 0.45, 0], [DIM.release.r + 0.45, 0.35], [0, 0.35]], { segs: 48 }), anod, T(0, 0, 0, -Math.PI / 2, 0, 0));
  relK.add(revolve([[DIM.release.r, 0.2], [DIM.release.r, 3.0, 0.4], [DIM.release.r - 0.45, 3.5, 0.5], [3.8, 3.5], [3.8, 2.2]], { segs: 48 }), turned, T(0, 0, 0, -Math.PI / 2, 0, 0));
  relK.add(revolve([[3.7, 3.0], [3.7, 7.0, 0.4], [3.2, 7.5, 0.6], [1.4, 7.5], [1.4, 4.4]], { segs: 48 }), rMat, T(0, 0, 0, -Math.PI / 2, 0, 0));
  relK.add(new THREE.CircleGeometry(1.35, 28), flock, T(0, 7.46, 0, -Math.PI / 2, 0, 0));
  const releaseMeshes = relK.build(release, 'release');
  top.add(release);

  // Rapid-Wind Lever (turned chrome hub collar + swept silver blade + tactile rubber ergonomic rear thumb tip) + Coaxial Frame Counter
  const lever = new THREE.Group(); lever.position.set(DIM.lever.x, B.deck, DIM.lever.z);
  const levK = new Kit(), lMat = lib.get('satinChrome', { hover: hov.crank });
  levK.add(revolve([[DIM.lever.r + 1.0, 0], [DIM.lever.r + 1.0, 0.3], [0, 0.3]], { segs: 56 }), anod, T(0, 0, 0, -Math.PI / 2, 0, 0));
  levK.add(revolve([[DIM.lever.r + 0.6, 0.2], [DIM.lever.r + 0.6, 1.8, 0.45], [DIM.lever.r, 2.2]], { segs: 56 }), turned, T(0, 0, 0, -Math.PI / 2, 0, 0));
  // Curved silver lever neck sweeping smoothly around the rear
  const armSh = new THREE.Shape();
  armSh.moveTo(-4.5, 2.5);
  armSh.bezierCurveTo(1.0, 5.0, 7.0, 2.5, 6.2, -3.5);
  armSh.bezierCurveTo(5.0, -9.8, -1.5, -14.8, -8.5, -15.8);
  armSh.bezierCurveTo(-11.0, -16.2, -11.5, -13.0, -9.0, -12.0);
  armSh.bezierCurveTo(-4.0, -10.5, -2.5, -4.5, -4.5, 2.5);
  levK.add(slab(armSh, 2.0, 0.55, 32, 0.55, 4), lMat, T(0, 0.5, 0, -Math.PI / 2, 0, 0));
  // Tactile matte-rubber sculpted ergonomic rear thumb tip (ks_k1000_unit_04 & 05!)
  const tipSh = new THREE.Shape();
  tipSh.moveTo(-6.5, -15.6);
  tipSh.bezierCurveTo(-14.5, -17.4, -24.5, -17.2, -31.5, -15.2);
  tipSh.bezierCurveTo(-34.2, -14.4, -34.2, -11.8, -31.0, -11.0);
  tipSh.bezierCurveTo(-24.0, -9.4, -15.0, -9.4, -8.5, -11.2);
  tipSh.bezierCurveTo(-5.5, -12.0, -4.8, -14.8, -6.5, -15.6);
  levK.add(slab(tipSh, 5.2, 1.5, 32, 0.45, 5), rubber, T(0, 0.1, 0, -Math.PI / 2, 0, 0));
  const leverMeshes = levK.build(lever, 'crank');
  top.add(lever);

  // Coaxial Glossy-Black Circular Frame Counter Disc w/ bright turned bezel rim sitting stationary on wind lever hub (ks_k1000_unit_04!)
  const ctrCv = canvas(256, 256), ctrTex = tex(ctrCv);
  const ctrG = new THREE.Group(); ctrG.position.set(DIM.lever.x, B.deck + 2.1, DIM.lever.z);
  {
    const ck3 = new Kit();
    ck3.add(revolve([[9.8, 0], [9.8, 3.2, 0.35], [9.3, 3.8, 0.45], [0, 3.8]], { segs: 56 }), bk, T(0, 0, 0, -Math.PI / 2, 0, 0));
    ck3.add(revolve([[9.4, 3.5], [9.4, 3.92, 0.3], [8.85, 3.92], [8.85, 3.5]], { segs: 56 }), turned, T(0, 0, 0, -Math.PI / 2, 0, 0));
    ck3.add(new THREE.CircleGeometry(8.8, 48), lib.prepare(new THREE.MeshBasicMaterial({ map: ctrTex }), {}), T(0, 3.96, 0, -Math.PI / 2, 0, 0));
    ck3.build(ctrG);
  }
  top.add(ctrG);

  // Left-side Conical Black Collar + Smooth Glossy-Black Rewind Drum (green 'R' & arrow) + Flush Turned-Silver Crank Bar (ks_k1000_unit_04!)
  const rwBase = new THREE.Group(); rwBase.position.set(DIM.rewind.x, B.deck, DIM.rewind.z);
  {
    const rbk = new Kit();
    rbk.add(revolve([[12.6, 0], [12.6, 0.25], [0, 0.25]], { segs: 56 }), flock, T(0, 0, 0, -Math.PI / 2, 0, 0));
    rbk.add(revolve([[12.2, 0.15], [11.6, 1.2, 0.35], [10.4, 2.2, 0.35], [0, 2.2]], { segs: 56 }), bk, T(0, 0, 0, -Math.PI / 2, 0, 0));
    rbk.build(rwBase);
  }
  top.add(rwBase);

  const rwSpin = new THREE.Group(); rwSpin.position.set(DIM.rewind.x, B.deck + 2.2, DIM.rewind.z);
  {
    const rwK = new Kit();
    rwK.add(revolve([[9.7, 0], [9.7, 4.7, 0.35], [9.0, 5.3, 0.45], [0, 5.3]], { segs: 56 }), bk, T(0, 0, 0, -Math.PI / 2, 0, 0));
    rwK.add(new THREE.CircleGeometry(8.8, 48), lib.prepare(new THREE.MeshPhysicalMaterial({ map: rewindTopTex(), roughness: 0.36, metalness: 0.12 }), {}), T(0, 5.36, 0, -Math.PI / 2, 0, 0));
    rwK.add(revolve([[2.8, -25.0], [2.8, 1.5]], { segs: 32 }), turned, T(0, 0, 0, -Math.PI / 2, 0, 0));
    [-1.7, 1.7].forEach((fx) => rwK.add(rbox(1.1, 7.2, 1.3, 0.25, 2), bright, T(fx, -22.5, 0)));
    rwK.build(rwSpin);
  }
  const rwCrankPivot = new THREE.Group(); rwCrankPivot.position.set(7.4, 5.45, 0.0);
  {
    const rck = new Kit();
    const rcS = rrPath(-15.6, -2.0, 1.6, 2.0, 1.2);
    rck.add(slab(rcS, 1.05, 0.28, 20, 0.55, 3), turned, T(0, -0.35, 0, -Math.PI / 2, 0, 0));
    rck.build(rwCrankPivot);
  }
  const rwTipPivot = new THREE.Group(); rwTipPivot.position.set(-14.0, 0.35, 0.0);
  {
    const rtk = new Kit();
    rtk.add(revolve([[1.3, 0], [1.5, 0.2, 0.25, 1], [1.5, 3.6, 0.25, 1], [1.25, 3.8], [0, 3.8]], { segs: 160, ribs: { n: 20, depth: 0.14 } }), bright, T(0, 0, 0, -Math.PI / 2, 0, 0));
    rtk.build(rwTipPivot);
  }
  rwCrankPivot.add(rwTipPivot);
  rwSpin.add(rwCrankPivot);
  top.add(rwSpin);

  // ───────── Deep-Drawn Stamped Satin Silver Chrome Bottom Baseplate (ks_k1000_unit_03.jpg — ALL circular parts capped with [0, zEnd]!) ─────────
  const botPlan = k1000PlanShape(B.x0, B.x1, B.zF, zShellBack, 0);
  // Asymmetric stamped-brass bevel [2.1 mm deep-drawn bottom edge, 0.45 mm waist seam, 6 analytic segments]!
  btk.add(slab(botPlan, B.baseY - B.y0, [2.1, 0.45], 36, 0.72, 6), chr, T(0, B.y0, 0, -Math.PI / 2, 0, 0));
  // Large satin-chrome coin-slotted LR44 battery cap (-X side, X=-19.0, r=9.0) + crisp recessed dark perimeter bezel!
  btk.add(revolve([[9.4, 0], [9.4, 0.16], [9.0, 0.16], [0, 0.16]], { segs: 56 }), anod, T(-19.0, B.y0 - 0.01, -14.5, Math.PI / 2, 0, 0));
  btk.add(revolve([[9.0, 0], [9.0, 0.38, 0.25], [8.6, 0.44], [0, 0.44]], { segs: 56 }), chr, T(-19.0, B.y0 - 0.02, -14.5, Math.PI / 2, 0, 0));
  btk.add(new THREE.CircleGeometry(8.4, 48), lib.prepare(new THREE.MeshPhysicalMaterial({ map: batteryCapTex(), roughness: 0.30, metalness: 0.90 }), {}), T(-19.0, B.y0 - 0.48, -14.5, Math.PI / 2, 0, 0));
  btk.add(rbox(9.2, 0.35, 1.5, 0.15, 1), anod, T(-19.0, B.y0 - 0.52, -14.5, 0, 0.65, 0));
  // 1/4"-20 turned chrome tripod socket collar + adjacent screw
  btk.add(revolve([[4.6, 0], [4.6, 0.55, 0.25], [2.8, 0.55], [2.8, -3.2], [0, -3.2]], { segs: 40 }), turned, T(DIM.socket.x, B.y0 - 0.02, DIM.socket.z, Math.PI / 2, 0, 0));
  addScrew(btk, steel, btk, flock, T(DIM.socket.x + 8.5, B.y0 - 0.05, DIM.socket.z, Math.PI / 2, 0, 0), 1.35, true, 0.35);
  // Deeply recessed bevelled circular chrome film-rewind release button (+X side, X=+42.0, ks_k1000_unit_03!)
  btk.add(revolve([[4.8, 0], [4.4, 0.35, 0.3], [3.0, 0.42], [3.0, -1.2], [0, -1.2]], { segs: 36 }), chr, T(42.0, B.y0 - 0.02, -8.5, Math.PI / 2, 0, 0));
  btk.add(revolve([[3.1, 0.25], [3.1, 0.45], [0, 0.45]], { segs: 32 }), flock, T(42.0, B.y0 - 0.03, -8.5, Math.PI / 2, 0, 0));
  btk.add(revolve([[2.4, 0], [2.4, 0.55, 0.25], [2.1, 0.62], [0, 0.62]], { segs: 32 }), bright, T(42.0, B.y0 - 0.04, -8.5, Math.PI / 2, 0, 0));
  // Engraved baseplate serial number + 3 authentic baseplate Phillips screws
  btk.add(new THREE.PlaneGeometry(18.0, 4.5), lib.prepare(new THREE.MeshPhysicalMaterial({ map: bottomSerialTex(), transparent: true, alphaTest: 0.08, roughness: 0.45 }), {}), T(30.0, B.y0 - 0.08, -24.5, Math.PI / 2, 0, Math.PI));
  [[78.5, -15.5], [-49.5, -14.0], [18.0, -6.5]].forEach(([sx, sz]) => addScrew(btk, steel, btk, flock, T(sx, B.y0 - 0.05, sz, Math.PI / 2, 0, 0), 1.3, true, 0.4));
  btk.build(bottom);

  // ───────── Hinged +X Rear Film Door (100% light-tight seal B.baseY..B.trimY + overlaps cavL/cavR while staying flush inside 45° rear chamfers!) ─────────
  const doorW = 115.6, doorH = (B.trimY - B.baseY) + 0.6, doorCX = 14.8, doorCY = (B.trimY + B.baseY) / 2, hingeX = doorCX + doorW / 2 + 0.3;
  doorPivot.position.set(hingeX, doorCY, zShellBack - 0.2);
  const dx = doorCX - hingeX;
  dk.add(rbox(doorW, doorH, 1.0, 0.45, 2, 0.4), bk, T(dx, 0, 0));
  dk.add(rbox(doorW - 4.0, doorH - 4.4, 0.55, 0.35, 2), leather, T(dx, 0, 0.42));
  dk.add(revolve([[1.2, -doorH / 2 + 0.8], [1.2, doorH / 2 - 0.8, 0.3]], { segs: 28 }), bk, T(0, 0, -0.2, Math.PI / 2, 0, 0));
  // Dead-flat black inner door backing liner + light-trap flange (Law #18!)
  dk.add(rbox(doorW - 2.0, doorH - 2.0, 0.35, 0.2, 1), intBlk, T(dx, 0, -0.58));
  const trap = rrPath(dx - doorW / 2 + 1.4, -doorH / 2 + 1.4, dx + doorW / 2 - 1.4, doorH / 2 - 1.4, 0.8);
  trap.holes.push(rrPath(dx - doorW / 2 + 4.4, -doorH / 2 + 4.2, dx + doorW / 2 - 4.4, doorH / 2 - 4.2, 0.5, new THREE.Path()));
  dk.add(slab(trap, 1.8, 0.2, 16), intBlk, T(0, 0, -2.2));
  // Vertical film-guide roller + spring-mounted satin-matte black pressure plate (50×33 mm) + capped rivets!
  dk.add(revolve([[2.1, -18.0], [2.1, 18.0, 0.3]], { segs: 36 }), bright, T(42.0 - hingeX, 0, -2.4, Math.PI / 2, 0, 0));
  dk.add(rbox(50.0, 33.0, 1.1, 0.35, 2, 0.0), pPlate, T(-hingeX, -doorCY, -2.3));
  [-11.5, 11.5].forEach((py) => dk.add(revolve([[1.5, 0], [1.5, 0.55], [0, 0.55]], { segs: 28 }), steel, T(-hingeX, -doorCY + py, -2.9, Math.PI, 0, 0)));
  [-17.0, 17.0].forEach((px) => dk.add(rbox(14.0, 2.2, 0.7, 0.15, 1), steel, T(-hingeX + px, -doorCY, -1.3)));
  dk.add(rbox(3.0, 14.0, 2.6, 0.3, 1), intBlk, T(dx - doorW / 2 + 2.0, 0, -1.8));
  dk.build(doorPivot);

  return {
    core, top, bottom, door: doorPivot, doorRestZ: zShellBack - 0.2, mirrorPivot,
    curtain1Cloth, curtain1Lath, curtain2Cloth, curtain2Lath, stopDownLever,
    sprocket, takeup, filmCart, filmStrip, filmTex,
    dial, dialMeshes, dialCv, dialTex, release, releaseMeshes, lever, leverMeshes, rwSpin, rwCrankPivot, rwTipPivot,
    screenMat, eyeScreen, eyepieceMeshes, ctrCv, ctrTex, cockedMat,
  };
}

// ───────── SMC Pentax-M Compact K-Mount Lens Builder ─────────
function buildLens(lib, lens, hov) {
  const def = lensDef(lens), group = new THREE.Group();
  const bk = lib.get('lensBlack'), chrome = lib.get('chromeBright'), steel = lib.get('steel'), intBlk = lib.get('interiorBlack'), flock = lib.get('flock');
  const atlas = lensAtlas(lens);
  const eng = (h) => lib.prepare(new THREE.MeshPhysicalMaterial({ name: `k1000LensEng_${lens.id}`, color: 0xffffff, map: atlas, metalness: 0.12, roughness: 0.42 }), { hover: h, wear: 'paint' });
  const oSpec = lensOpticsFor(lens);
  const lensGlassU = {
    blades: def.blades || 6,
    optics: { value: new THREE.Vector4(Math.min(12.5, def.glassR * 0.85), 1.0, def.glassR, 12.0) },
    state: { value: new THREE.Vector4(0, oSpec.pupilMag ?? 1.0, 0, 0) },
    ghostA: { value: new THREE.Color(...(oSpec.ghostTintA || [0.48, 0.32, 0.78])) },
    ghostB: { value: new THREE.Color(...(oSpec.ghostTintB || [0.38, 0.66, 0.58])) },
  };
  const glassMat = lib.prepare(lib.base.glass.clone(), { lensGlass: lensGlassU });

  const L = def.L;
  const fixed = new Kit();
  // Rear K-mount bayonet collar + Authentic SMC Pentax-M All-Black Lower Barrel + Raised White Tactile Mounting Bump (#13, ks_pentax_m50_01!)
  fixed.add(revolve([[def.rMount - 2.0, 0], [def.rMount - 0.5, -0.8, 0.3], [def.rMount - 0.5, -2.2]], { segs: 96, crease: 30 }), bk);
  fixed.add(revolve([[def.rAp, -8.5], [def.rAp + 0.15, -8.8, 0.25], [def.rAp + 0.15, -10.5, 0.25], [def.rAp, -10.8]], { segs: 96, crease: 28 }), bk);
  fixed.add(bandRow(revolve([[def.rAp, -15.6], [def.rAp, -10.8]], { segs: 96, uv: 'band' }), 1), eng(null));
  // Iconic Pentax K-mount raised white tactile lens-mounting alignment bump inside a crisp machined chrome collar + red IR index pip!
  fixed.add(revolve([[1.85, 0], [1.85, 0.45, 0.15], [1.45, 0.5]], { segs: 24 }), chrome, radialT(36 * DEG, def.rAp - 0.22, -12.0));
  fixed.add(new THREE.SphereGeometry(1.52, 18, 14), lib.get('white'), radialT(36 * DEG, def.rAp - 0.18, -12.0));
  fixed.add(new THREE.SphereGeometry(0.52, 12, 10), lib.get('red'), radialT(7.5 * DEG, def.rAp + 0.05, -14.5));
  // Rear optical baffle & rear glass element
  const rearBaf = new THREE.RingGeometry(13.8, def.rMount - 2.2, 48); rearBaf.translate(0, 0, -1.8);
  fixed.add(rearBaf, intBlk);
  fixed.add(new THREE.CircleGeometry(14.2, 48), intBlk, T(0, 0, -4.5));
  fixed.add(revolve([[0, -2.0], [7.5, -2.4], [13.8, -3.4]], { segs: 40 }), lib.get('innerGlass'));
  fixed.build(group);

  // Aperture ring (z = -2.2..-8.5, 60-tooth knurling segs=480!)
  const aperture = new THREE.Group(); group.add(aperture);
  const ak = new Kit(), aMat = lib.get('lensBlack', { hover: hov.aperture });
  ak.add(revolve([[def.rAp - 0.3, -2.2], [def.rAp + 0.3, -2.6, 0.35, 1], [def.rAp + 0.3, -4.4, 0.35, 1], [def.rAp, -4.7]], { segs: 480, ribs: { n: 60, depth: 0.28, groove: 0.48, edge: 0.16 } }), aMat);
  ak.add(bandRow(revolve([[def.rAp, -8.5], [def.rAp, -4.6]], { segs: 96, uv: 'band' }), 2), eng(hov.aperture));
  const apertureMeshes = ak.build(aperture, 'aperture');

  // Compact Focusing Ring (distance scale + true 3D multi-row diamond rubber waffle grip, n=72, segs=576 + thin front chrome hairline!)
  const focus = new THREE.Group(); group.add(focus);
  const fk = new Kit(), fMat = lib.get('knurl', { hover: hov.focus });
  const zF0 = -15.7;
  const zF1 = def.builtInHood ? -(L - def.hoodLen - 1.2) : def.profile === 'stepped' ? -(L - 10.5) : -Math.max(25.0, L - 5.2);
  fk.add(bandRow(revolve([[def.rFocus - 0.5, zF0 - 5.2], [def.rFocus - 0.5, zF0]], { segs: 120, uv: 'band' }), 0), eng(hov.focus));
  const zW0 = zF0 - 5.2, wSpan = zW0 - zF1, wRows = wSpan > 11.0 ? 3 : 2;
  const wProf = [[def.rFocus - 0.3, zW0]];
  for (let b = 0; b < wRows; b++) {
    const zb0 = lerp(zW0, zF1, b / wRows), zb1 = lerp(zW0, zF1, (b + 1) / wRows);
    wProf.push([def.rFocus + 0.4, zb0 - (b === 0 ? 0.48 : 0.30), 0.35, 1], [def.rFocus + 0.4, zb1 + (b === wRows - 1 ? 0.48 : 0.30), 0.35, 1]);
    if (b < wRows - 1) wProf.push([def.rFocus - 0.22, zb1, 0.16]);
  }
  wProf.push([def.rFocus - 0.3, zF1]);
  fk.add(revolve(wProf, { segs: 576, ribs: { n: 72, depth: 0.44, groove: 0.46, edge: 0.18 } }), fMat);
  fk.add(revolve([[def.rFocus - 0.35, zW0 + 0.1], [def.rFocus - 0.02, zW0 - 0.05], [def.rFocus - 0.02, zW0 - 0.45], [def.rFocus - 0.35, zW0 - 0.55]], { segs: 96, crease: 26 }), bk);
  // Signature SMC Pentax-M sleek hairline chrome accent ring right ahead of the waffle focus grip (slightly bolder on 50/1.7 & 85/2!)
  const chrW = (def.profile === 'fast50' || def.profile === 'portrait') ? 1.35 : 0.9;
  const chrR = def.builtInHood ? def.rFocus - 0.4 : def.rFront;
  fk.add(revolve([[chrR + 0.1, zF1 + 0.3], [chrR + 0.48, zF1, 0.2], [chrR + 0.48, zF1 - chrW, 0.2], [chrR, zF1 - chrW - 0.2]], { segs: 96, crease: 26 }), chrome);
  const focusMeshes = fk.build(focus, 'focus');

  // Extending Front Barrel, 49 mm Filter Threads, Per-Lens Sculpted Taper & Recessed Front Glass (Law #27!)
  const ext = new THREE.Group(); group.add(ext);
  const ek = new Kit();
  if (def.profile === 'stepped') {
    // 35mm f/2 two-step waist taper stepping cleanly inward ahead of the wide focus grip
    ek.add(revolve([
      [def.thread, -L], [def.rFront - 0.65, -L, 0.5], [def.rFront, -L + 0.9, 0.5], [def.rFront, -L + 6.5, 0.35],
      [def.rFront + 1.3, -L + 8.4, 0.4], [def.rFront + 1.3, zF1 + 0.8], [def.rFocus - 1.5, zF1 + 1.8],
    ], { segs: 96, crease: 30 }), bk);
  } else if (def.profile === 'portrait') {
    // 85mm f/2 compact portrait tapered bell w/ sculpted beveled nose
    ek.add(revolve([
      [def.thread, -L], [def.rFront - 0.8, -L, 0.55], [def.rFront, -L + 1.1, 0.55], [def.rFront, -L + 7.2, 0.4],
      [def.rFocus - 0.5, zF1 + 0.6, 0.4], [def.rFocus - 1.5, zF1 + 1.8],
    ], { segs: 96, crease: 30 }), bk);
  } else if (def.profile === 'compact') {
    // 28mm f/2.8 ultra-compact beveled front dish
    ek.add(revolve([
      [def.thread, -L], [def.rFront - 0.9, -L, 0.55], [def.rFront, -L + 1.2, 0.55], [def.rFront, zF1 + 0.8], [def.rFocus - 1.5, zF1 + 1.8],
    ], { segs: 96, crease: 30 }), bk);
  } else {
    // 50mm f/2 (locked exact envelope!), 50mm f/1.7 & 135mm f/3.5 inner barrel
    ek.add(revolve([[def.thread, -L], [def.rFront - 0.7, -L, 0.5], [def.rFront, -L + 0.9, 0.5], [def.rFront, zF1 + 1.0], [def.rFocus - 1.5, zF1 + 1.8]], { segs: 96, crease: 30 }), bk);
  }
  // Exposed bright machined aluminum filter-mouth rim chamfer + stepped 49 mm internal filter threads
  ek.add(revolve([[def.thread - 0.08, -L + 0.24], [def.thread + 0.34, -L + 0.02]], { segs: 96 }), steel);
  const thrProf = [];
  for (let i = 0; i < 6; i++) {
    const zt = -L + 0.6 + i * 0.52;
    thrProf.push([def.thread, zt], [def.thread - 0.35, zt + 0.24], [def.thread, zt + 0.48]);
  }
  ek.add(revolve(thrProf, { segs: 84, crease: 20 }), intBlk);
  if (!def.builtInHood) {
    [-90, 90].forEach((a) => addScrew(ek, steel, ek, flock, radialT(a * DEG, def.rFront - 0.04, -L + 3.0), 0.68, false, 0.2));
  }
  // Wide outward-facing conical engraved beauty ring (guaranteed >= 3.6 mm wide on ALL 6 K-mount primes — fixes k-85-2 squish!)
  const rInnerFace = Math.min(def.thread - 3.6, def.glassR + (def.funnelPad ?? 0.6));
  const ring = new THREE.RingGeometry(rInnerFace, def.thread - 0.2, 84); ring.rotateY(Math.PI);
  const rPos = ring.attributes.position;
  for (let i = 0; i < rPos.count; i++) {
    const r = Math.hypot(rPos.getX(i), rPos.getY(i));
    const u = Math.max(0, Math.min(1, (r - rInnerFace) / Math.max(0.1, def.thread - 0.2 - rInnerFace)));
    rPos.setZ(i, lerp(-L + 3.8, -L + 2.1, u));
  }
  ring.computeVertexNormals();
  ek.add(ring, lib.prepare(new THREE.MeshPhysicalMaterial({ name: `k1000Front_${lens.id}`, map: frontRingTex(lens, def), metalness: 0.14, roughness: 0.40 }), {}));
  // Concentric stepped matte-black anti-reflection funnel sized proportionally to each lens's glass clear aperture!
  const funnelGap = rInnerFace - def.glassR;
  const zGlassEdge = funnelGap >= 2.2 ? -L + 7.1 : funnelGap >= 0.9 ? -L + 5.4 : -L + 4.1;
  if (funnelGap >= 0.9) {
    const steps = funnelGap >= 2.2 ? 5 : 3;
    const bafProf = [];
    for (let i = 0; i < steps; i++) {
      const rA = lerp(rInnerFace, def.glassR + 0.2, i / steps), rB = lerp(rInnerFace, def.glassR + 0.2, (i + 1) / steps);
      const zA = lerp(-L + 3.8, zGlassEdge, i / steps), zB = lerp(-L + 3.8, zGlassEdge, (i + 1) / steps);
      bafProf.push([rA, zA], [rA - 0.28, zB], [rB, zB]);
    }
    ek.add(revolve(bafProf, { segs: 72, crease: 20 }), intBlk);
  } else {
    // Crisp machined retaining cell bevel for wide luminous eyes (50/1.7, 85/2, 135/3.5!)
    ek.add(revolve([[rInnerFace + 0.1, -L + 3.75], [def.glassR + 0.35, -L + 3.55, 0.15], [def.glassR + 0.1, zGlassEdge]], { segs: 84 }), bk);
  }
  // Dual opposing front retaining-ring spanner-wrench notches (180° apart!)
  [-1, 1].forEach((s) => ek.add(rbox(1.4, 0.55, 0.52, 0.08, 1), intBlk, T(s * (rInnerFace + 0.42), 0, -L + 3.60)));
  ek.add(new THREE.CircleGeometry(def.glassR + 0.3, 48), intBlk, T(0, 0, zGlassEdge + 0.9, 0, Math.PI, 0));
  ek.build(ext);
  // Standalone local-origin glass mesh (Law #17: LENS_GLASS_GLSL local-origin invariant!)
  const glassMesh = new THREE.Mesh(prep(revolve([[0, zGlassEdge - 1.5], [def.glassR * 0.45, zGlassEdge - 1.1], [def.glassR * 0.8, zGlassEdge - 0.5], [def.glassR + 0.2, zGlassEdge]], { segs: 64 })), glassMat);
  ext.add(glassMesh);

  // Lazy 3D Stainless Pentax K-Mount Rear Bayonet Hardware (built when detached / exploded — Law #27!)
  const rearMount = new THREE.Group(); rearMount.visible = false; group.add(rearMount);
  let rearBuilt = false;
  const ensureRear = () => {
    if (rearBuilt) return false;
    rearBuilt = true;
    const rk = new Kit(), steel = lib.get('steel'), flock = lib.get('flock'), anod = lib.get('anod');
    const rearGlassMat = lib.prepare(new THREE.MeshPhysicalMaterial({ name: `k1000RearGlass_${lens.id}`, color: 0x160e24, metalness: 0.14, roughness: 0.03, clearcoat: 1.0, clearcoatRoughness: 0.02, specularIntensity: 1.0, envMapIntensity: 1.75 }), {});
    const arcSector = (rIn, rOut, a0, a1) => {
      const s = new THREE.Shape(); s.absarc(0, 0, rOut, a0, a1, false); s.absarc(0, 0, rIn, a1, a0, true); s.closePath(); return s;
    };
    // Bright machined stainless K-mount flange plate (z = 0..+1.4 mm) + 5 authentic Phillips flange screws!
    rk.add(revolve([[20.4, 0.0], [28.6, 0.0], [28.6, 1.2, 0.25], [27.8, 1.4], [20.6, 1.4], [20.6, 0.2]], { segs: 84, crease: 28 }), steel);
    [15, 87, 159, 231, 303].forEach((a) => addScrew(rk, chrome, rk, flock, T(Math.cos(a * DEG) * 26.2, Math.sin(a * DEG) * 26.2, 1.42), 0.92, true, 0.3));
    // Undercut bayonet throat + 3 watertight beveled stainless Pentax K-bayonet locking wings (z = +2.85..+4.5 mm w/ 1.45 mm shadow gap!)
    rk.add(revolve([[20.2, 1.35], [21.3, 1.35], [21.3, 3.0], [20.2, 3.0]], { segs: 72, crease: 26 }), anod);
    [10, 130, 250].forEach((a0) => {
      rk.add(slab(arcSector(20.4, 24.8, a0 * DEG, (a0 + 52) * DEG), 1.65, 0.22, 24, 0.45, 2), chrome, T(0, 0, 2.85));
    });
    // Matte-black inner rear shroud + watertight curved K-mount protective rear guard fin flanking stop-down lever
    rk.add(revolve([[14.4, 0.2], [20.4, 0.2], [20.4, 4.6, 0.3], [15.0, 5.2], [14.0, 4.2]], { segs: 72, crease: 28 }), intBlk);
    rk.add(slab(arcSector(14.8, 17.4, -145 * DEG, -50 * DEG), 3.8, 0.25, 24, 0.4, 2), intBlk, T(0, 0, 4.3));
    // Protruding bright steel K-mount spring-loaded Stop-Down Aperture Lever (-96°) + black mechanical meter-coupling ridge (+55°)
    const levA = -96 * DEG;
    rk.add(rbox(1.5, 4.6, 6.8, 0.35, 2), chrome, T(Math.cos(levA) * 18.6, Math.sin(levA) * 18.6, 4.9, 0, 0, levA));
    const metA = 55 * DEG;
    rk.add(rbox(2.0, 6.4, 2.2, 0.35, 2), bk, T(Math.cos(metA) * 26.8, Math.sin(metA) * 26.8, 2.3, 0, 0, metA));
    // Outward-facing (+Z) glossy SMC multi-coated convex rear meniscus element (r descending -> nz > 0!)
    rk.add(revolve([[14.6, 2.6], [13.8, 2.9], [13.8, 2.0]], { segs: 48 }), anod);
    rk.add(new THREE.CircleGeometry(14.0, 48), intBlk, T(0, 0, 1.3));
    rk.add(revolve([[14.0, 2.2], [12.2, 2.85], [7.2, 4.05], [0, 4.55]], { segs: 48 }), rearGlassMat);
    rk.build(rearMount);
    return true;
  };

  // Lazy cutaway optical elements (K1000_OPTICS)
  const inner = new THREE.Group(); inner.visible = false; ext.add(inner);
  let innerBuilt = false;
  const ensureInner = () => {
    if (innerBuilt) return false;
    innerBuilt = true;
    const ik = new Kit(), spec = K1000_OPTICS[lens.id] || K1000_OPTICS['k-50-2'];
    const gInner = lib.get('innerGlass'), rimBlack = lib.get('anod');
    const zStart = -L + 8.0, zEnd = -3.6;
    spec.forEach(([zf, rf, th, R1, R2]) => {
      const z0 = lerp(zStart, zEnd, zf), r = Math.max(6.0, def.glassR * rf);
      const sag1 = (r * r) / (2 * R1 * r * 1.45), sag2 = (r * r) / (2 * R2 * r * 1.45);
      const prof = [];
      for (let i = 0; i <= 8; i++) { const u = i / 8, rr = r * u; prof.push([rr, z0 - th * 0.5 + sag1 * u * u]); }
      for (let i = 8; i >= 0; i--) { const u = i / 8, rr = r * u; prof.push([rr, z0 + th * 0.5 + sag2 * u * u]); }
      ik.add(revolve(prof, { segs: 48 }), gInner);
      ik.add(revolve([[r, z0 - th * 0.5 + sag1], [r + 0.7, z0 - th * 0.5 + sag1], [r + 0.7, z0 + th * 0.5 + sag2], [r, z0 + th * 0.5 + sag2]], { segs: 48 }), rimBlack);
    });
    const zIris = lerp(zStart, zEnd, 0.52);
    ik.add(revolve([[def.glassR * 0.4, zIris - 0.5], [def.rFront - 2.0, zIris - 0.5], [def.rFront - 2.0, zIris + 0.5], [def.glassR * 0.4, zIris + 0.5]], { segs: 48 }), lib.get('blade'));
    ik.build(inner);
    return true;
  };

  // Lens hood: REAL permanently-parked telescoping metal sleeve on built-in 135/3.5 telephoto (slides forward on hoodOn!), lazy 49 mm screw shade on shorter primes!
  const hoodGroup = new THREE.Group(); hoodGroup.visible = Boolean(def.builtInHood); ext.add(hoodGroup);
  let hoodBuilt = false;
  const ensureHood = () => {
    if (hoodBuilt) return false;
    hoodBuilt = true;
    const hk = new Kit(), hl = def.hoodLen || 18.0;
    if (def.builtInHood) {
      const rOut = def.rFront + 1.55, rIn = def.rFront + 0.22;
      const zBack = -L + hl, zFront = -L + 0.4;
      hk.add(revolve([
        [rIn, zFront], [rOut - 0.45, zFront, 0.35], [rOut, zFront + 0.55, 0.35],
        [rOut + 0.25, zFront + 1.1, 0.3, 1], [rOut + 0.25, zFront + 5.8, 0.3, 1],
        [rOut, zFront + 6.4, 0.3], [rOut, zBack - 0.5, 0.35], [rIn, zBack],
      ], { segs: 480, crease: 28, ribs: { n: 80, depth: 0.34, groove: 0.48, edge: 0.16 } }), bk);
      hk.add(revolve([[rIn, zBack], [rIn, zFront + 0.5]], { segs: 84 }), intBlk);
      hk.add(revolve([[rOut + 0.04, zFront + 0.4], [rOut + 0.14, zFront + 0.6, 0.15], [rOut + 0.14, zFront + 1.0, 0.15], [rOut, zFront + 1.15]], { segs: 84 }), chrome);
    } else {
      const rB = def.rFront + 0.5, rT = rB + hl * 0.28;
      hk.add(revolve([[rT - 0.6, -L - hl], [rT, -L - hl + 0.5, 0.5], [rB + 0.4, -L + 2.0], [rB - 0.8, -L + 2.0], [rT - 1.2, -L - hl + 0.8], [rT - 0.6, -L - hl]], { segs: 84, crease: 30 }), lib.get('anod'));
    }
    hk.build(hoodGroup);
    return true;
  };
  if (def.builtInHood) ensureHood();

  // Lazy 49 mm screw-in optical filter (n=64, segs=512!)
  const filterGroup = new THREE.Group(); filterGroup.visible = false; ext.add(filterGroup);
  const filterMat = new THREE.MeshPhysicalMaterial({ name: `k1000Filter_${lens.id}`, color: 0xffffff, roughness: 0.03, transparent: true, opacity: 0.34, depthWrite: false });
  lib.prepare(filterMat, {});
  const filterMeshes = [];
  let filterBuilt = false;
  const ensureFilter = () => {
    if (filterBuilt) return false;
    filterBuilt = true;
    const flk = new Kit(), ft = def.thread;
    flk.add(revolve([[ft - 0.6, -L - 4.6], [ft + 0.9, -L - 4.6, 0.4, 1], [ft + 0.9, -L - 0.4, 0.4, 1], [ft - 0.6, -L], [ft - 0.6, -L + 1.2]], { segs: 512, crease: 30, ribs: { n: 64, depth: 0.22 } }), lib.get('anod', { hover: hov.filter }));
    flk.add(new THREE.CircleGeometry(ft - 0.9, 48), filterMat, T(0, 0, -L - 2.8, 0, Math.PI, 0));
    filterMeshes.push(...flk.build(filterGroup, 'filter'));
    return true;
  };

  return { group, lens, def, L, lensGlassU, glassMesh, rearMount, pupilMag: oSpec.pupilMag ?? 1.0, focalMm: oSpec.focalCalMm || lens.focalLength || 50, focus, aperture, ext, inner, hoodGroup, filterGroup, filterMat, ensureRear, ensureInner, ensureHood, ensureFilter, focusMeshes, apertureMeshes, filterMeshes };
}

// ───────── The Camera Factory ─────────
const PARTS = ['focus', 'aperture', 'shutter', 'filter', 'crank', 'release', 'finder', 'aim', 'roll'];

export function createCameraK1000({ lens }) {
  const t0 = performance.now();
  const clipPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 1e7);
  const base = baseMaterials();
  const P = (o) => new THREE.MeshPhysicalMaterial(o);
  const BB = beadBlastMaps(), VL = vulcaniteMaps();
  // True bare-metal 1976 Asahi glass-bead-blasted satin silver chrome over brass (metalness: 1.0, ZERO plastic clearcoat!)
  base.satinChrome = P({ name: 'k1000SatinChrome', color: 0xd0d4da, metalness: 1.0, roughness: 0.28, roughnessMap: BB.rgh, normalMap: BB.nrm, normalScale: new THREE.Vector2(0.15, 0.15), anisotropy: 0.12, envMapIntensity: 0.96 });
  base.satinChrome.userData.wear = 'chrome';
  // High-relief jet-black stamped Japanese vulcanite leatherette (deep crevices + satin pebble crowns, zero dusty-grey sheen!)
  base.leather = P({ name: 'k1000Vulcanite', color: 0x09090b, map: VL.mac, roughness: 0.45, diffuseRoughness: 0.44, roughnessMap: VL.rgh, normalMap: VL.nrm, normalScale: new THREE.Vector2(1.85, 1.85), specularIntensity: 0.68, sheen: 0.08, sheenRoughness: 0.65, sheenColor: 0x16161a });
  base.leather.userData.wear = 'leather';
  // Baked gloss black brass enamel w/ subtle micro-grain + alloy edge wear
  base.blackEnamel = P({ name: 'k1000BlackEnamel', color: 0x050507, metalness: 0.22, roughness: 0.20, roughnessMap: BB.rgh, normalMap: BB.nrm, normalScale: new THREE.Vector2(0.08, 0.08), clearcoat: 0.56, clearcoatRoughness: 0.16, envMapIntensity: 0.78 });
  base.blackEnamel.userData.wear = 'blackChrome';
  // Tactile matte vulcanized rubber (eyepiece surround, wind thumb tip, K-mount release)
  base.rubber = P({ name: 'k1000Rubber', color: 0x0b0b0e, metalness: 0.0, roughness: 0.76, roughnessMap: BB.rgh, normalMap: BB.nrm, normalScale: new THREE.Vector2(0.28, 0.28), specularIntensity: 0.30 });
  // Law #18: Dead-flat light-absorbing interior black (specularIntensity: 0.0 kills overhead Fresnel grey glare!)
  base.interiorBlack = P({ name: 'k1000InteriorBlack', color: 0x020203, metalness: 0.0, roughness: 0.98, specularIntensity: 0.0, envMapIntensity: 0.04 });
  base.curtain = P({ name: 'k1000Curtain', color: 0x040405, roughness: 0.97, metalness: 0.0, specularIntensity: 0.0, envMapIntensity: 0.04, side: THREE.DoubleSide });
  base.pressurePlate = P({ name: 'k1000PressurePlate', color: 0x060608, roughness: 0.74, metalness: 0.04, clearcoat: 0.0, specularIntensity: 0.14, envMapIntensity: 0.16 });
  const lib = new MatLib(base, [clipPlane]);
  const hov = {};
  PARTS.forEach((name) => { hov[name] = { name, amount: { value: 0 }, color: { value: new THREE.Color(1.0, 0.82, 0.5).multiplyScalar(0.28) }, target: 0 }; });

  const root = new THREE.Group();
  root.name = 'camera503';
  root.userData.kind = 'k1000';
  const tripod = buildTripod(lib, DIM.tripod);
  root.add(tripod.group);
  const head = buildHead(lib, hov);
  const yaw = new THREE.Group(); yaw.position.y = tripod.top; yaw.add(head.yawMM);
  const pitch = new THREE.Group(); pitch.position.y = head.pitchY; pitch.add(head.pitchMM); yaw.add(pitch);
  const rollG = new THREE.Group(); rollG.position.y = head.rollY; head.rollMM.position.y = -head.rollY; rollG.add(head.rollMM); pitch.add(rollG);
  root.add(yaw);
  const mm = new THREE.Group(); mm.scale.setScalar(0.001); rollG.add(mm);

  const body = buildBody(lib, hov);
  mm.add(body.core, body.top, body.bottom, body.door);
  const lensMount = new THREE.Group(); lensMount.position.z = DIM.flange; mm.add(lensMount);
  let L = buildLens(lib, lens, hov);
  lensMount.add(L.group);
  mm.position.set(-DIM.socket.x / 1000, (head.plateTop - B.y0) / 1000 - head.rollY, -DIM.socket.z / 1000);

  const blobCv = canvas(128, 128), bg = blobCv.getContext('2d'), grad = bg.createRadialGradient(64, 64, 2, 64, 64, 64);
  grad.addColorStop(0, 'rgba(0,0,0,0.42)'); grad.addColorStop(0.5, 'rgba(0,0,0,0.16)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
  bg.fillStyle = grad; bg.fillRect(0, 0, 128, 128);
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(blobCv), transparent: true, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2; blob.position.y = 0.012; blob.renderOrder = -1; blob.userData.noShadow = true;
  root.add(blob);

  const lensLists = (Lx) => [Lx.focusMeshes, Lx.apertureMeshes, Lx.filterMeshes];
  const lensDyn = (Lx) => [Lx.group, Lx.focus, Lx.ext, Lx.aperture, Lx.inner, Lx.hoodGroup, Lx.filterGroup, Lx.glassMesh, Lx.rearMount].filter(Boolean);
  const camDyn = [
    mm, body.core, body.top, body.bottom, body.door, body.mirrorPivot,
    body.curtain1Cloth, body.curtain1Lath, body.curtain2Cloth, body.curtain2Lath, body.stopDownLever,
    body.sprocket, body.takeup, body.filmCart, body.filmStrip,
    body.dial, body.release, body.lever, body.rwSpin, body.rwCrankPivot, body.rwTipPivot,
    body.eyeScreen, lensMount, head.yawMM, head.pitchMM, head.rollMM, head.bubble, blob, ...lensDyn(L),
  ];
  const camLists = [body.dialMeshes, body.releaseMeshes, body.leverMeshes, body.eyepieceMeshes, head.aimMeshes, head.rollMeshes, ...lensLists(L)];
  mergeStaticRigid(root, { dynamic: new Set(camDyn), lists: camLists });
  // Law #24: Put every camera mesh strictly on layer 1 (prevents live-app lensview photobomb!) with proper shadow flags
  const toLayer = (obj) => obj.traverse((o) => { if (!o.isMesh) return; o.layers.set(1); o.castShadow = !o.userData.noShadow && !o.material.transparent; o.receiveShadow = !o.userData.noShadow; });
  toLayer(root);

  const pickables = {};
  const refreshPickables = () => {
    Object.assign(pickables, {
      focus: L.focusMeshes, aperture: L.apertureMeshes, shutter: body.dialMeshes,
      filter: L.filterMeshes, crank: body.leverMeshes, release: body.releaseMeshes,
      finder: body.eyepieceMeshes, aim: head.aimMeshes, roll: head.rollMeshes,
    });
  };
  refreshPickables();

  const st = {
    focusRot: 0, focusT: 0, ext: 0, extT: 0, apRot: 0, apT: 0, dial: 0, dialT: 0,
    lever: 0, press: 0, mirrorK: 0, curtain1: 0, curtain2: 0,
    cocked: 1, stopDown: 0, asaLift: 0,
    doorK: 0, filmLoaded: true, filmPhase: 0, rewind: 0,
    explodeK: 0, lensOut: 0, lensTwist: 0, hoodOn: false, filterId: 'none', polAngle: 90, snapRings: false,
  };
  let live = null, cutaway = false, lastCtr = null, lastIso = 400;

  function drawCounter(s) {
    const f = s?.frame ?? 1;
    if (f === lastCtr) return;
    lastCtr = f;
    const g = body.ctrCv.getContext('2d');
    g.fillStyle = '#0d0e11'; g.fillRect(0, 0, 256, 256);
    g.strokeStyle = '#383b42'; g.lineWidth = 6; g.beginPath(); g.arc(128, 128, 118, 0, TAU); g.stroke();
    // Classic K1000 curved top counter window arc (ks_k1000_unit_04.jpg!)
    g.save();
    g.beginPath(); g.arc(128, 128, 96, -Math.PI * 0.85, -Math.PI * 0.15); g.arc(128, 128, 52, -Math.PI * 0.15, -Math.PI * 0.85, true); g.closePath();
    g.fillStyle = '#181a1f'; g.fill();
    g.strokeStyle = '#4c5058'; g.lineWidth = 3; g.stroke();
    g.restore();
    // Red triangular index pointer at 12 o'clock + frame numeral
    g.fillStyle = '#e03e28';
    g.beginPath(); g.moveTo(128, 28); g.lineTo(118, 48); g.lineTo(138, 48); g.closePath(); g.fill();
    g.fillStyle = f <= 1 ? '#e03e28' : '#f4f2ec';
    g.font = `700 44px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(f === 0 ? 'S' : String(f), 128, 76);
    body.ctrTex.needsUpdate = true;
  }

  function ringTargets(s) {
    if (!s) return;
    const d = s.focus ?? 10000;
    st.focusT = focusAngle(L.lens, d);
    st.extT = helicoidExtensionMm(L.lens, d);
    const apI = Math.max(0, L.lens.apertureStops.indexOf(s.aperture ?? L.lens.maxAperture));
    st.apT = -apI * AP_STEP;
    const shI = s.shutterIdx ?? 7; // 1/125 s
    st.dialT = (shI + 1) * DIAL_STEP;
    const iso = s.film?.iso ?? 400;
    if (iso !== lastIso) { lastIso = iso; drawSpeedDial(body.dialCv, iso); body.dialTex.needsUpdate = true; }
  }

  const tweens = [];
  const tween = (dur, fn, ease = easeInOut, key = null) => new Promise((res) => {
    if (key) { const i = tweens.findIndex((x) => x.key === key); if (i >= 0) { tweens[i].res(); tweens.splice(i, 1); } }
    tweens.push({ t: 0, dur: Math.max(1e-3, dur), fn, ease, res, key });
  });
  const animate = (prop, to, dur, ease = easeInOut) => { const from = st[prop]; return tween(dur, (k) => { st[prop] = lerp(from, to, k); }, ease, prop); };
  const hold = (ms) => tween(Math.max(1e-3, ms / 1000), () => {}, (u) => u);

  function applyPose() {
    const e = st.explodeK;
    body.top.position.set(0, 48 * e, 0);
    body.bottom.position.set(0, -34 * e, 0);
    body.door.position.z = body.doorRestZ + 28 * e;
    body.door.rotation.y = lerp(0, 1.85, st.doorK);
    lensMount.position.z = DIM.flange - 58 * e - 34 * st.lensOut;
    lensMount.rotation.z = st.lensTwist * 1.05;
    L.focus.rotation.z = st.focusRot;
    L.ext.position.z = -st.ext;
    L.aperture.rotation.z = st.apRot;
    // Automatic K-mount diaphragm: wide open at rest for bright SLR viewing, smoothly stops down on exposure (mirrorK / stopDown)!
    const apStops = L.lens.apertureStops;
    const apIdx = Math.min(apStops.length - 1, Math.max(0, -st.apRot / AP_STEP));
    const i0 = Math.min(apStops.length - 2, Math.floor(apIdx));
    const apWork = apStops[i0] * Math.pow(apStops[i0 + 1] / apStops[i0], apIdx - i0);
    const stopK = Math.max(0, Math.min(1, Math.max(st.stopDown || 0, st.mirrorK)));
    const apN = apStops[0] * Math.pow(apWork / apStops[0], stopK);
    const rIris = Math.min(L.def.glassR * 0.86, Math.max(1.8, (L.focalMm / (2 * apN)) * 0.88));
    L.lensGlassU.optics.value.x = rIris;
    L.lensGlassU.optics.value.y = 1.0;
    L.lensGlassU.state.value.w = Math.min(1, e * 1.4 + st.lensOut);
    body.stopDownLever.position.y = -4.5 - 4.8 * stopK;
    // Cocked indicator dot: bright red only when shutter is cocked (K1000 manual!)
    body.cockedMat.color.setHex(st.cocked > 0.5 ? 0xd93826 : 0x161719);
    const rearVis = e > 0.001 || st.lensOut > 0.001;
    if (rearVis && L.ensureRear?.()) toLayer(L.rearMount);
    if (L.rearMount) L.rearMount.visible = rearVis;
    if (cutaway && L.ensureInner?.()) toLayer(L.inner);
    if (L.inner) L.inner.visible = cutaway;
    if (L.def.builtInHood) {
      L.hoodGroup.visible = true;
      L.hoodGroup.position.z = st.hoodOn ? -(L.def.hoodSlide || 28.0) : 0;
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
    body.dial.position.y = B.deck + 1.8 * (st.asaLift || 0);
    body.lever.rotation.y = -st.lever;
    body.release.position.y = B.deck - 1.6 * st.press;
    // Pull-up rewind knob lifts, straight chrome crank unfolds & spinner flips upright!
    body.rwSpin.rotation.y = st.rewind;
    body.rwSpin.position.y = B.deck + 2.2 + 11.0 * st.doorK;
    body.rwCrankPivot.rotation.z = -0.62 * st.doorK;
    body.rwTipPivot.rotation.z = lerp(-Math.PI / 2, 0.0, st.doorK);
    body.mirrorPivot.rotation.x = lerp(-Math.PI / 4, 0, st.mirrorK);
    // Two-curtain horizontal silk focal-plane shutter
    const k1 = Math.max(0, Math.min(1, st.curtain1)), k2 = Math.max(0, Math.min(1, st.curtain2));
    const x1 = lerp(-18.5, 18.5, k1), x2 = lerp(-18.5, 18.5, k2);
    body.curtain1Cloth.scale.x = Math.max(0.001, 1 - k1);
    body.curtain1Cloth.position.x = (x1 + 18.5) * 0.5;
    body.curtain1Cloth.visible = k1 < 0.995;
    body.curtain1Lath.position.x = x1;
    body.curtain2Cloth.scale.x = Math.max(0.001, k2);
    body.curtain2Cloth.position.x = (-18.5 + x2) * 0.5;
    body.curtain2Cloth.visible = k2 > 0.005;
    body.curtain2Lath.position.x = x2;
    body.sprocket.rotation.y = -st.filmPhase * TAU;
    body.takeup.rotation.y = -st.filmPhase * 0.68 * TAU;
    body.filmTex.offset.x = -st.filmPhase * 0.37;
    const showFilm = Boolean(st.filmLoaded);
    body.filmCart.visible = showFilm;
    body.filmStrip.visible = showFilm;
  }

  function setCutaway(on) {
    cutaway = on;
    if (!on) clipPlane.set(new THREE.Vector3(0, 1, 0), 1e7);
    else if (L.ensureInner?.()) toLayer(L.inner);
    if (L.inner) L.inner.visible = cutaway;
  }

  const lensCache = new Map();
  const anchor = (parent, x, y, z, text, sub) => { const o = new THREE.Object3D(); o.position.set(x, y, z); parent.add(o); return { o, text, sub }; };
  let labels = [], labelEls = null;
  function buildLabels() {
    labels.forEach((l) => l.o.parent?.remove(l.o));
    labels = [
      anchor(lensMount, 0, 36, -L.L / 2, 'SMC K-Mount Lens', `${L.lens.focalLength} mm ƒ/${L.lens.maxAperture} · 49 mm compact manual prime`),
      anchor(body.top, 0, B.prismY + 8, -12, 'Pentaprism & Zero-Method Meter', '0.88× eye-level SLR finder · center-weighted CdS zero-method needle'),
      anchor(body.dial, 0, 12, 0, 'Mechanical Shutter & ASA Dial', '1 s – 1/1000 s & B · mechanical cloth shutter (LR44/SR44 powers meter)'),
      anchor(body.mirrorPivot, 0, -6, -12, 'Instant-Return Mirror', 'flips up before exposure and drops back automatically'),
      anchor(body.door, 0, 0, B.zB + 8, '35 mm Film Back', '24 × 36 mm · pull rewind knob upward to unlatch'),
    ];
  }
  buildLabels();

  const tmpQ = new THREE.Quaternion();
  const api = {
    root, parts: { mm, body, lensMount, get lens() { return L; } }, opticsMoving: false, cutSide: 1, pickables, buildMs: 0, st, timeScale: 1, applyPose,
    setAim(pan, tilt, roll = 0) { yaw.rotation.y = -Math.PI / 2 + pan; pitch.rotation.x = tilt; rollG.rotation.z = roll; root.updateMatrixWorld(true); },
    bodyCenter(v) { return mm.localToWorld(v.set(14, 6, -12)); },
    worldToBody(v) { return mm.worldToLocal(v); },
    setScreenTexture(texObj) { body.screenMat.map = texObj; body.screenMat.color.setScalar(0.95); body.screenMat.needsUpdate = true; },
    eyePose() {
      const q = rollG.getWorldQuaternion(new THREE.Quaternion());
      const E = DIM.eyepiece;
      return {
        eye: mm.localToWorld(new THREE.Vector3(E.x, E.y, E.z + 24.0)),
        target: mm.localToWorld(new THREE.Vector3(E.x, E.y, E.z - 2.0)),
        up: new THREE.Vector3(0, 1, 0).applyQuaternion(q),
      };
    },
    setRings(s) {
      live = s; ringTargets(s); drawCounter(s);
      if (st.snapRings) { st.focusRot = st.focusT; st.ext = st.extT; st.apRot = st.apT; st.dial = st.dialT; st.snapRings = false; }
    },
    setHood(on) {
      st.hoodOn = Boolean(on); if (live) live.hoodOn = st.hoodOn;
      if (L.def.builtInHood) { L.hoodGroup.visible = true; L.hoodGroup.position.z = st.hoodOn ? -(L.def.hoodSlide || 28.0) : 0; }
      else { if (st.hoodOn && L.ensureHood?.()) toLayer(L.hoodGroup); L.hoodGroup.visible = st.hoodOn; L.hoodGroup.position.z = 0; }
    },
    setFilter(filterId, polAngle = st.polAngle) { st.filterId = filterId || 'none'; st.polAngle = polAngle; if (live) { live.filter = st.filterId; live.polAngle = polAngle; } if (st.filterId !== 'none' && L.ensureFilter?.()) { toLayer(L.filterGroup); refreshPickables(); } },
    get hoodOn() { return Boolean(st.hoodOn); },
    get hasHood() { return true; },
    filmOffset() {
      const ep = lensOpticsFor(L.lens).entrancePupilMm || 23;
      return mm.localToWorld(new THREE.Vector3(0, 0, DIM.flange - L.L - st.ext + ep)).distanceTo(mm.localToWorld(new THREE.Vector3(0, 0, 0)));
    },
    lensPose(pos, quat) {
      const ep = lensOpticsFor(L.lens).entrancePupilMm || 23;
      pos.copy(mm.localToWorld(new THREE.Vector3(0, 0, DIM.flange - L.L - st.ext + ep)));
      rollG.getWorldQuaternion(quat);
    },
    ringAxisWorld(target = new THREE.Vector3()) { return target.set(0, 0, -1).applyQuaternion(mm.getWorldQuaternion(tmpQ)).normalize(); },
    ringAngle(part) {
      if (part === 'focus') return -st.focusT;
      if (part === 'aperture') return -st.apT;
      if (part === 'shutter') return -st.dialT;
      return 0;
    },
    ringValueAt(part, angle) {
      if (part === 'focus') return distanceAt(L.lens, angle);
      if (part === 'aperture') return Math.max(0, -angle / AP_STEP);
      if (part === 'shutter') return angle / DIAL_STEP - 1;
      return 0;
    },
    setHover(part) { PARTS.forEach((p) => { hov[p].target = p === part ? 1 : 0; }); },
    setDoorOpen(on) { return animate('doorK', on ? 1 : 0, 0.55); },
    setFilmLoaded(on) { st.filmLoaded = Boolean(on); applyPose(); },
    async setExploded(on) { setCutaway(false); await animate('explodeK', on ? 1 : 0, 1.3); },
    async swapLens(next, onSwap) {
      const vis = root.visible;
      if (vis) { await animate('lensTwist', 1, 0.28); await animate('lensOut', 1, 0.42); }
      lensMount.remove(L.group);
      lensCache.set(L.lens.id, L);
      const cached = lensCache.get(next.id);
      if (cached) L = cached;
      else { L = buildLens(lib, next, hov); mergeStaticRigid(L.group, { dynamic: new Set(lensDyn(L)), lists: lensLists(L) }); toLayer(L.group); }
      lensMount.add(L.group);
      refreshPickables(); buildLabels();
      onSwap();
      if (live) { ringTargets(live); st.focusRot = st.focusT; st.ext = st.extT; st.apRot = st.apT; }
      if (vis) { applyPose(); await animate('lensOut', 0, 0.45); await animate('lensTwist', 0, 0.28); }
      else { st.lensOut = 0; st.lensTwist = 0; applyPose(); }
    },
    async fire({ seconds = 1 / 125, side = 1, onMirror = () => {}, onExpose = () => {}, onSound = () => {}, cutaway: cut = false }) {
      api.cutSide = side;
      if (cut) setCutaway(true);
      await animate('press', 1, 0.08);
      st.cocked = 0;
      onSound('release');
      onMirror(true);
      await animate('mirrorK', 1, 0.045);
      const travelSec = 0.032;
      if (seconds < 1 / 60) {
        const slitDelay = Math.max(0.004, (seconds / (1 / 60)) * travelSec);
        const total = travelSec + slitDelay;
        let exposed = false;
        await tween(total, (k) => {
          const t = k * total;
          st.curtain1 = Math.min(1, t / travelSec);
          st.curtain2 = Math.max(0, Math.min(1, (t - slitDelay) / travelSec));
          if (!exposed && t >= total * 0.5) { exposed = true; onExpose(); }
        }, (u) => u, 'slit');
      } else {
        await animate('curtain1', 1, travelSec);
        await onExpose();
        await hold(Math.min(Math.max(seconds * 1000, 18), 2500));
        await animate('curtain2', 1, travelSec);
      }
      onSound('close');
      await animate('mirrorK', 0, 0.055);
      onMirror(false);
      await animate('press', 0, 0.08);
      onSound('wind');
      const startPhase = st.filmPhase;
      await tween(0.28, (k) => {
        st.lever = LEVER_STROKE * k;
        st.curtain1 = 1 - k;
        st.curtain2 = 1 - k;
        st.filmPhase = startPhase + k;
        if (k >= 0.85) st.cocked = 1;
      }, easeInOut, 'wind');
      st.cocked = 1;
      await animate('lever', 0, 0.18);
      if (cut) setCutaway(false);
    },
    setCutaway(on, side = 1) { api.cutSide = side; setCutaway(on); },
    labelAt(obj) {
      let cur = obj;
      while (cur) {
        if (cur === lensMount) return { text: 'SMC K-Mount Lens', sub: `${L.lens.focalLength} mm ƒ/${L.lens.maxAperture} · 49 mm manual prime` };
        if (cur === body.dial) return { text: 'Mechanical Shutter & ASA Dial', sub: '1 s – 1/1000 s & B · 1/60 X-sync · mechanical shutter (LR44/SR44 powers meter)' };
        if (cur === body.lever) return { text: 'Rapid-Wind Film Advance', sub: '160° stroke cocks rubberized silk curtains & advances 35 mm film' };
        if (cur === body.release) return { text: 'Mechanical Shutter Release', sub: 'threaded cable-release socket & cocked-shutter indicator dot' };
        if (cur === body.rwSpin) return { text: 'Film Rewind Crank & Door Latch', sub: 'pull upward to open hinged 35 mm back and retract fork' };
        if (cur === body.mirrorPivot) return { text: 'Instant-Return 45° Mirror', sub: 'swings clear of film gate during exposure and returns immediately' };
        if (cur === body.door) return { text: 'Hinged 35 mm Film Back', sub: 'dimpled matte pressure plate & gleaming stainless guide roller' };
        if (cur === body.top) return { text: 'Satin-Chrome Pentaprism Deck', sub: 'solid optical roof pentaprism, hot shoe & match-needle CdS meter' };
        if (cur === body.bottom) return { text: 'Satin-Chrome Baseplate', sub: 'LR44 meter battery cap, 1/4″ tripod bush & rewind clutch button' };
        if (cur === body.core) return { text: 'Die-Cast K-Mount Chassis', sub: '45.46 mm K-mount bayonet, open mirror box & 24 × 36 mm film gate' };
        cur = cur.parent;
      }
      return null;
    },
    updateLabels(cam, el, show) {
      if (!el) return;
      if (!show) { if (labelEls) labelEls.forEach((n) => (n.hidden = true)); return; }
      if (!labelEls) {
        labelEls = labels.map((l) => { const d = document.createElement('div'); d.className = 'cam-label'; d.innerHTML = `<b>${l.text}</b><span>${l.sub}</span>`; el.appendChild(d); return d; });
      }
      const v = new THREE.Vector3();
      labels.forEach((l, i) => {
        l.o.getWorldPosition(v).project(cam);
        const n = labelEls[i];
        n.hidden = v.z > 1;
        n.style.left = `${(v.x * 0.5 + 0.5) * 100}%`;
        n.style.top = `${(-v.y * 0.5 + 0.5) * 100}%`;
      });
    },
    update(dt) {
      dt *= api.timeScale;
      for (let i = tweens.length - 1; i >= 0; i--) {
        const tw = tweens[i]; tw.t += dt;
        const k = Math.min(1, tw.t / tw.dur); tw.fn(tw.ease(k));
        if (k >= 1) { tweens.splice(i, 1); tw.res(); }
      }
      if (live) { ringTargets(live); drawCounter(live); }
      const a = 1 - Math.exp(-dt * 16);
      st.focusRot += (st.focusT - st.focusRot) * a;
      st.ext += (st.extT - st.ext) * a;
      st.apRot += (st.apT - st.apRot) * a;
      st.dial += (st.dialT - st.dial) * a;
      const hA = 1 - Math.exp(-dt * 12);
      PARTS.forEach((p) => { const h = hov[p]; h.amount.value += (h.target - h.amount.value) * hA; });
      applyPose();
      if (cutaway) {
        const n = new THREE.Vector3(-api.cutSide, 0, 0).applyQuaternion(mm.getWorldQuaternion(tmpQ)).normalize();
        const o = mm.localToWorld(new THREE.Vector3(0, 0, 0));
        clipPlane.setFromNormalAndCoplanarPoint(n, o);
      }
    },
  };
  applyPose();
  api.buildMs = performance.now() - t0;
  return api;
}
