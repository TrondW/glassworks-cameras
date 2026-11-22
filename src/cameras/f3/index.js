// The camera: a 1982 Giorgetto Giugiaro Nikon F3HP professional 35 mm SLR with removable DE-3 High-Eyepoint finder,
// signature red front-grip stripe, quilted titanium focal-plane shutter, dual-mirror SPD metering cutaway, and AI-S lenses.
// Built strictly to SPEC.md & PLAYBOOK.md (23 Engineering Laws). Neutral GLASS WORKS legends; historic
// vector-traced hollow serif F3 & HP badges preserved.
//
// Model axes (CONTRACT.md): lens axis along -Z, +X = photographer's right, +Y up. Origin: lens axis on the film plane.
// Nikon F-mount flange focal distance: 46.5 mm in front of the film (z = -46.5).
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
  flange: -46.5,
  // Calibrated pixel-for-pixel to Nikon_F3_HP.JPG (s = 12.345 px/mm) & factory spec 148.5 × 101.5 × 69.0 mm (body w/ DE-3 HP):
  // Body shell x0=-55.8..+84.4 (140.2 mm shell -> ~149.8 mm across eyelets & triangular D-rings!); y0=-32.6..prismY=+68.9 = 101.5 mm EXACT!
  body: { x0: -55.8, x1: 84.4, y0: -32.6, baseY: -28.0, seamY: 23.7, deck: 35.2, prismY: 68.9, zF: -31.5, zB: 4.5 },
  eyepiece: { x: 0, y: 46.2, z: 16.0, r: 9.6 },
  dial: { x: 36.2, z: -13.5, r: 10.8, h: 8.4 },
  lever: { x: 59.8, z: -12.0, r: 10.5 },
  rewind: { x: -40.8, z: -12.0, r: 9.8 },
  socket: { x: -3.0, z: -14.0 },
  tripod: { apex: 1210, spread: 560 },
};
const B = DIM.body;
const AP_STEP = 15.5 * DEG;
const DIAL_LABELS = ['A', '2000', '1000', '500', '250', '125', '60', '30', '15', '8', '4', '2', '1', '2', '4', '8', 'B', 'T', 'X'];
const DIAL_STEP = TAU / DIAL_LABELS.length;
const COC = 1 / 30;
const LEVER_STROKE = 140 * DEG;

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

// ───────── Nikon AI-S F-Mount Lens Definitions & Cutaway Prescriptions ─────────
const LENS_DEFS = {
  'ais-24-2.8':  { L: 46.0, focusPitch: 54 * DEG, blades: 7, rFront: 31.2, thread: 26.0, glassR: 18.2, rFocus: 31.2, rAp: 31.0, rMount: 31.4, funnelPad: 0.6, serial: '724819',  profile: 'flare',    hoodStyle: 'screw', hoodLen: 14.0 },
  'ais-28-2.8':  { L: 44.5, focusPitch: 46 * DEG, blades: 7, rFront: 29.8, thread: 26.0, glassR: 16.6, rFocus: 32.0, rAp: 31.2, rMount: 31.4, funnelPad: 1.8, serial: '682914',  profile: 'crc28',    hoodStyle: 'screw', hoodLen: 15.0 },
  'ais-35-2':    { L: 51.5, focusPitch: 38 * DEG, blades: 7, rFront: 30.2, thread: 26.0, glassR: 17.4, rFocus: 31.8, rAp: 31.4, rMount: 31.4, funnelPad: 1.4, serial: '258403',  profile: 'stepped',  hoodStyle: 'screw', hoodLen: 18.0 },
  'ais-50-1.4':  { L: 40.0, focusPitch: 31 * DEG, blades: 7, rFront: 30.5, thread: 26.0, glassR: 19.2, rFocus: 32.0, rAp: 31.4, rMount: 31.4, funnelPad: 0.3, serial: '5176453', profile: 'standard', hoodStyle: 'snap',  hoodLen: 21.0 },
  'ais-85-2':    { L: 52.5, focusPitch: 24 * DEG, blades: 7, rFront: 31.2, thread: 26.0, glassR: 20.6, rFocus: 32.6, rAp: 31.4, rMount: 31.4, funnelPad: 0.3, serial: '341892',  profile: 'portrait', hoodStyle: 'snap',  hoodLen: 28.0 },
  'ais-105-2.5': { L: 69.5, focusPitch: 20 * DEG, blades: 7, rFront: 30.2, thread: 26.0, glassR: 21.0, rFocus: 32.2, rAp: 31.4, rMount: 31.4, funnelPad: 0.3, serial: '924610',  profile: 'tele105',  builtInHood: true, hoodStyle: 'slide', hoodLen: 32.0, hoodSlide: 30.0 },
  'ais-135-2.8': { L: 83.5, focusPitch: 16 * DEG, blades: 7, rFront: 30.4, thread: 26.0, glassR: 21.4, rFocus: 32.4, rAp: 31.4, rMount: 31.4, funnelPad: 0.3, serial: '884215',  profile: 'tele135',  builtInHood: true, hoodStyle: 'slide', hoodLen: 38.0, hoodSlide: 35.0 },
};

const F3_OPTICS = {
  'ais-24-2.8': [
    [0.07, 0.96, 3.0, 1.4, -0.95], [0.19, 0.80, 2.2, 2.2, -1.05], [0.32, 0.68, 3.8, 1.7, 3.8], [0.45, 0.58, 1.8, -2.1, 2.6],
    [0.58, 0.58, 1.8, -1.5, -4.4], [0.66, 0.64, 3.6, -4.4, 1.85], [0.78, 0.72, 2.4, 3.0, -2.8], [0.88, 0.78, 2.6, -2.4, 3.6], [0.96, 0.82, 2.4, 3.6, -3.0],
  ],
  'ais-28-2.8': [
    [0.08, 0.94, 2.8, 1.5, -1.0], [0.21, 0.80, 2.2, 2.5, -1.15], [0.35, 0.70, 3.6, 1.7, 3.6], [0.48, 0.62, 1.8, -1.8, 2.8],
    [0.60, 0.62, 1.8, -1.6, -4.5], [0.70, 0.68, 3.4, -4.5, 1.9], [0.83, 0.76, 2.6, 3.2, -2.6], [0.94, 0.82, 2.4, -2.8, 4.0],
  ],
  'ais-35-2': [
    [0.08, 0.94, 2.8, -2.0, -1.1], [0.21, 0.84, 3.2, 1.9, -2.4], [0.35, 0.74, 2.6, 2.2, -1.5], [0.48, 0.66, 1.8, -1.8, 3.0],
    [0.62, 0.66, 1.8, -1.6, -4.6], [0.71, 0.74, 3.6, -4.6, 1.8], [0.83, 0.80, 2.6, 3.0, -3.2], [0.94, 0.86, 2.6, 3.4, -2.8],
  ],
  // Matched directly to Nikon_F3_and_50mm_lens_cutaway_at_Nikon_Museum.jpg (7/6 double-Gauss!)
  'ais-50-1.4': [
    [0.10, 0.96, 4.0, 2.0, -3.8], [0.26, 0.86, 3.2, 1.8, -2.6], [0.40, 0.74, 1.8, 3.0, -1.4],
    [0.58, 0.74, 1.8, -1.45, 3.2], [0.68, 0.84, 4.0, 3.2, -2.0], [0.83, 0.88, 2.8, 2.6, -3.8], [0.94, 0.90, 3.0, 3.2, -3.0],
  ],
  'ais-85-2': [
    [0.09, 0.96, 4.4, 1.9, -3.6], [0.28, 0.86, 3.6, 1.8, -2.6], [0.46, 0.74, 2.0, -2.2, 1.7],
    [0.68, 0.78, 3.8, 3.2, -2.2], [0.90, 0.84, 3.0, 2.8, -3.4],
  ],
  'ais-105-2.5': [
    [0.08, 0.96, 4.8, 1.9, -3.8], [0.26, 0.86, 3.8, 1.8, -2.6], [0.44, 0.74, 2.0, -2.4, 1.6],
    [0.68, 0.78, 4.0, 3.4, -2.2], [0.90, 0.84, 3.2, 2.8, -3.6],
  ],
  'ais-135-2.8': [
    [0.08, 0.96, 5.0, 2.0, -4.2], [0.24, 0.86, 2.6, -2.6, 2.0], [0.44, 0.74, 3.8, 2.6, -3.0],
    [0.68, 0.68, 2.4, -2.2, 2.8], [0.88, 0.64, 2.8, 3.0, -2.8],
  ],
};

const lensDef = (lens) => LENS_DEFS[lens.id] || LENS_DEFS['ais-50-1.4'];
const focusPitch = (lens) => lensDef(lens).focusPitch;
const focusAngle = (lens, d) => -focusPitch(lens) * helicoidExtensionMm(lens, d);
function distanceAt(lens, angle) {
  const ext = Math.max(0, angle) / focusPitch(lens);
  if (ext < 1e-4) return 10000;
  let lo = lens.minFocusDistance, hi = 10000;
  for (let i = 0; i < 40; i++) { const mid = Math.sqrt(lo * hi); if (helicoidExtensionMm(lens, mid) > ext) lo = mid; else hi = mid; }
  return Math.sqrt(lo * hi);
}

// ───────── Sub-Pixel Vector-Traced Iconic 1980 Giugiaro Hollow-Outlined F3 Serif Badge ─────────
function f3BadgeTex() {
  // Exact pixel-traced polygon outlines read directly from Nikon_F3_HP.JPG (_badge_f3_grid.png):
  // Hollow-outlined Egyptian slab-serif 'F' (w/ drooping upper-right spur) + geometric square-shouldered '3', transparent interior!
  const W = 1024, H = 600, cv = canvas(W, H), g = cv.getContext('2d');
  g.clearRect(0, 0, W, H);
  const s = W / 116.0; // design X=[78..194] -> [0..1024], Y=[100..168] -> [0..600]
  const tx = (x) => (x - 78.0) * s;
  const ty = (y) => (y - 134.5) * s + H / 2;
  const glyphs = [
    // Hollow slab-serif 'F' w/ classic top-right drooping serif spur & stepped middle bar serifs
    [[84, 104], [138, 104], [138, 130], [128, 130], [128, 118], [122, 114], [107, 114],
      [107, 130], [113, 130], [113, 124], [122, 124], [122, 146], [113, 146], [113, 140],
      [107, 140], [107, 155], [113, 155], [113, 165], [84, 165], [84, 155], [91, 155],
      [91, 114], [84, 114]],
    // Hollow geometric square-shouldered '3'
    [[151, 105], [180, 105], [187, 111], [187, 127], [180, 133], [187, 139], [187, 158],
      [180, 165], [150, 165], [143, 158], [143, 143], [159, 143], [159, 154], [171, 154],
      [171, 139], [160, 139], [160, 128], [171, 128], [171, 115], [159, 115], [159, 123],
      [143, 123], [143, 111]],
  ];
  g.strokeStyle = '#f4f2ec';
  g.lineWidth = 4.6 * s;
  g.lineJoin = 'miter';
  g.miterLimit = 6;
  glyphs.forEach((pts) => {
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(tx(x), ty(y)) : g.moveTo(tx(x), ty(y))));
    g.closePath();
    g.stroke();
  });
  const t = tex(cv); t.anisotropy = 8;
  return t;
}

function prismBadgeTex() {
  // Neutral GLASS WORKS bold geometric sans on DE-3 front slanted brow (Nikon_F3_HP.JPG layout!)
  const cv = canvas(512, 160), g = cv.getContext('2d');
  g.clearRect(0, 0, 512, 160);
  g.fillStyle = '#f6f4ee'; g.font = `800 66px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('GLASS WORKS', 256, 82);
  return tex(cv);
}

function hpBadgeTex() {
  const cv = canvas(160, 96), g = cv.getContext('2d');
  g.clearRect(0, 0, 160, 96);
  g.fillStyle = '#f2f0ea'; g.font = `700 60px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('H P', 80, 50);
  return tex(cv);
}

function rearSerialTex() {
  const cv = canvas(384, 64), g = cv.getContext('2d');
  g.clearRect(0, 0, 384, 64);
  g.fillStyle = '#dcdad2'; g.font = `600 34px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('GLASS WORKS   1850792', 192, 34);
  return tex(cv);
}

function speedDialTex() {
  // Authentic Nikon F3 shutter speed dial (MAN p. 18 & ks_f3c_07.jpg):
  // Green A, white 2000..125, RED 60, white 30..2, ORANGE slow speeds 1 2 4 8, white B T X, center silver lock button!
  // Zero angle (-PI/2) aligns index 0 ('A') dead-center with the rear white index mark at 6 o'clock (+Z)!
  const cv = canvas(512, 512), g = cv.getContext('2d');
  g.fillStyle = '#09090b'; g.fillRect(0, 0, 512, 512);
  g.strokeStyle = '#32343a'; g.lineWidth = 6; g.beginPath(); g.arc(256, 256, 244, 0, TAU); g.stroke();
  DIAL_LABELS.forEach((lbl, i) => {
    const a = -Math.PI / 2 - i * DIAL_STEP;
    const isSlow = i >= 12 && i <= 15; // 1, 2, 4, 8 s orange!
    const col = lbl === 'A' ? '#36c968' : lbl === '60' ? '#e63c2c' : isSlow ? '#ee7a28' : '#f4f2ec';
    arcText(g, lbl, 256, 256, 198, a, lbl.length > 3 ? 24 : lbl.length > 2 ? 28 : 34, col, 700);
  });
  // Center silver A/T lock plunger
  g.fillStyle = '#d4d8de'; g.beginPath(); g.arc(256, 256, 52, 0, TAU); g.fill();
  g.strokeStyle = '#484c52'; g.lineWidth = 4; g.stroke();
  return tex(cv);
}

function expCompScaleTex() {
  // Authentic left-deck Exposure Compensation (+2..+1..0..-1..-2) arc on F3 top plate (ks_f3c_07.jpg!)
  const cv = canvas(160, 320), g = cv.getContext('2d');
  g.clearRect(0, 0, 160, 320);
  const marks = [['+2', 42, '#f2f0ea'], ['+1', 100, '#f2f0ea'], ['0', 160, '#e63c2c'], ['-1', 220, '#f2f0ea'], ['-2', 278, '#f2f0ea']];
  g.font = `700 32px ${FONT}`; g.textAlign = 'left'; g.textBaseline = 'middle';
  marks.forEach(([txt, y, col]) => {
    const dx = Math.cos(((y - 160) / 140) * 0.85) * 30;
    g.fillStyle = col;
    g.beginPath(); g.arc(38 + dx, y, txt === '0' ? 6 : 4, 0, TAU); g.fill();
    g.fillText(txt, 56 + dx, y);
  });
  return tex(cv);
}

function asaCollarTex() {
  // Cylindrical ASA/ISO markings around left rewind collar (ks_f3hp_02 & 05!)
  const cv = canvas(1024, 96), g = cv.getContext('2d');
  g.fillStyle = '#0c0c0f'; g.fillRect(0, 0, 1024, 96);
  const vals = ['25', '50', '100', '200', '400', '800', '1600', '3200', '6400'];
  g.fillStyle = '#f2f0ea'; g.font = `700 34px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  vals.forEach((v, i) => {
    const x = 60 + i * 112;
    g.fillText(v, x, 42);
    g.fillRect(x - 16, 74, 5, 10); g.fillRect(x - 2, 74, 5, 10); g.fillRect(x + 12, 74, 5, 10);
  });
  const t = tex(cv); t.wrapS = THREE.RepeatWrapping; return t;
}

function titaniumCurtainTex() {
  // Authentic Nikon F3 vertically-corrugated quilted matte-black titanium foil shutter curtain (ks_f3hp_05.jpg!)
  const cv = canvas(512, 256), g = cv.getContext('2d');
  g.fillStyle = '#0a0a0c'; g.fillRect(0, 0, 512, 256);
  for (let x = 0; x < 512; x += 6) {
    g.fillStyle = '#15161a'; g.fillRect(x, 0, 2, 256);
    g.fillStyle = '#060608'; g.fillRect(x + 2, 0, 4, 256);
  }
  const t = tex(cv); t.wrapS = THREE.RepeatWrapping; return t;
}

function lensAtlas(lens) {
  // Authentic Nikon AI-S lens engravings (AI50F14S.JPG!):
  // Row 0: Orange ft top, crisp white m bottom
  // Row 1: Chrome DoF collar w/ color-coded DoF lines matching aperture colors
  // Row 2: Color-coded main AI-S aperture scale + miniature ADR rear aperture row!
  const W = 4096, RH = 128, cv = canvas(W, RH * 4), g = cv.getContext('2d');
  g.fillStyle = PAINT_BG; g.fillRect(0, 0, W, cv.height);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const X = (phi) => ((((0.5 + phi / TAU) % 1) + 1) % 1) * W;
  const text = (row, phi, str, y, size, color, weight = 600) => {
    g.save(); g.translate(X(phi), row * RH + y * RH); g.scale(0.55, 1);
    g.font = `${weight} ${size}px ${FONT}`; g.fillStyle = color; g.textAlign = 'center'; g.fillText(str, 0, 0); g.restore();
  };
  const tick = (row, phi, y0, y1, wPx, color) => { g.fillStyle = color; g.fillRect(X(phi) - wPx / 2, row * RH + y0 * RH, wPx, (y1 - y0) * RH); };
  const AP_COL = { 1.4: '#6cc8e8', 2: '#f4f2ec', 2.5: '#6cc8e8', 2.8: '#42cc6c', 4: '#f0cc38', 5.6: '#f4f2ec', 8: '#e87cb0', 11: '#4aa8f0', 16: '#f08228', 22: '#f0cc38', 32: '#42cc6c' };
  const ORANGE = '#f09428';
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
  scale([Infinity, 20, 10, 7, 5, 4, 3, 2.5, 2, 1.5, 1.2], 0.3048, 0.28, ORANGE);
  scale([Infinity, 5, 3, 2, 1.5, 1.2, 1, 0.8, 0.6, 0.45, 0.3, 0.2], 1, 0.72, INK.white);
  // Row 1: Bright machined silver AI-S DoF index ring w/ black central dot & color-coded DoF hash lines!
  g.fillStyle = '#c8ccd2'; g.fillRect(0, RH, W, RH);
  tick(1, 0, 0.14, 0.86, 8, '#141518');
  const pitch = focusPitch(lens);
  lens.apertureStops.filter((N) => N >= 4 && N <= 22).slice(0, 4).forEach((N) => {
    const a = Math.min(36 * DEG, pitch * N * COC);
    const col = AP_COL[N] || '#141518';
    [-1, 1].forEach((s) => tick(1, s * a, 0.18, 0.82, 6, col));
  });
  // Row 2: Main color-coded AI-S aperture scale (top) + miniature ADR rear aperture readout row (bottom)
  lens.apertureStops.forEach((N, i) => {
    const col = AP_COL[N] || INK.white;
    text(2, i * AP_STEP, String(N), 0.34, 46, col, 700);
    text(2, i * AP_STEP, String(N), 0.80, 26, col, 600);
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
  const cv = canvas(1024, 1024), g = cv.getContext('2d');
  g.fillStyle = '#08080a'; g.fillRect(0, 0, 1024, 1024);
  const rInner = Math.min(def.thread - 3.6, def.glassR + (def.funnelPad ?? 0.3));
  const rInPx = 512 * rInner / (def.thread - 0.2);
  const R = (rInPx + 506) / 2;
  // Crisp concentric machined hairline bezel rules framing the AI-S nameplate
  g.strokeStyle = 'rgba(228,230,238,0.22)'; g.lineWidth = 2.5;
  [rInPx + 10, 496].forEach((rr) => { g.beginPath(); g.arc(512, 512, rr, 0, TAU); g.stroke(); });
  arcText(g, 'GLASS WORKS', 512, 512, R, Math.PI * 0.72, 36, '#f0eee6', 700);
  arcText(g, `AI-S  ${lens.focalLength}mm  1:${lens.maxAperture}`, 512, 512, R, Math.PI * 0.16, 36, '#f0eee6', 600);
  arcText(g, `${def.serial || '5176453'}   Ø${Math.round(def.thread * 2)}mm`, 512, 512, R, -Math.PI * 0.50, 34, '#f0eee6', 600, true);
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
  g.fillStyle = '#c89422'; g.fillRect(0, 0, 512, 512);
  g.fillStyle = '#141518'; g.fillRect(0, 0, 512, 128); g.fillRect(0, 408, 512, 104);
  g.fillStyle = '#f4f2ea'; g.font = `800 54px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('GW 400', 256, 236);
  g.fillStyle = '#141416'; g.font = `700 30px ${FONT}`;
  g.fillText('PRO 35mm · 36', 256, 316);
  g.fillStyle = '#f0eee6'; g.font = `600 26px ${FONT}`; g.fillText('GLASS WORKS FILM', 256, 66);
  return tex(cv);
}

function focusScreenTex() {
  // Nikon F3 Type-K focusing screen: 12 mm center-weighted circle + 3 mm split-image + microprism + top-left LCD strip!
  const cv = canvas(512, 342), g = cv.getContext('2d');
  g.fillStyle = 'rgba(220, 226, 224, 0.42)'; g.fillRect(0, 0, 512, 342);
  g.strokeStyle = 'rgba(170, 178, 176, 0.24)'; g.lineWidth = 1.5;
  for (let r = 56; r < 290; r += 12) { g.beginPath(); g.arc(256, 171, r, 0, TAU); g.stroke(); }
  g.strokeStyle = 'rgba(38, 42, 46, 0.65)'; g.lineWidth = 3;
  g.beginPath(); g.arc(256, 171, 68, 0, TAU); g.stroke(); // iconic 12 mm 80/20 center-weighted circle!
  g.beginPath(); g.arc(256, 171, 36, 0, TAU); g.stroke();
  g.beginPath(); g.arc(256, 171, 20, 0, TAU); g.stroke();
  g.beginPath(); g.moveTo(236, 171); g.lineTo(276, 171); g.stroke();
  return tex(cv);
}

// ───────── Giugiaro Contoured Nikon F3HP Plan Shapes (with Sculpted Convex Right Front Grip! ks_f3hp_03 & 04!) ─────────
// slab rotated by rx = -PI/2 maps shape (x, y) -> world (x, z = -y), so yFront = -zF, yBack = -zB.
function f3PlanShape(x0, x1, zF, zB, inset = 0, withGrip = true) {
  const lx = x0 + inset, rx = x1 - inset, yF = -zF - inset, yB = -zB + inset;
  const rL = 11.2, rR = 13.5, gOut = withGrip ? 6.4 : 0.0;
  const s = new THREE.Shape();
  s.moveTo(lx + rL, yB);
  s.lineTo(rx - rR, yB);
  s.quadraticCurveTo(rx, yB, rx, yB + rR);
  // Swept convex Giugiaro right front finger grip bulging smoothly forward at X = +61.2..+84.4!
  if (withGrip) {
    s.lineTo(rx, yF + gOut - 8.5);
    s.bezierCurveTo(rx, yF + gOut + 0.5, rx - 11.5, yF + gOut + 1.0, 64.2, yF + gOut - 1.5);
    s.bezierCurveTo(61.4, yF + gOut - 2.6, 60.8, yF, 57.6, yF);
  } else {
    s.lineTo(rx, yF - 9.0);
    s.quadraticCurveTo(rx, yF, rx - 9.5, yF);
  }
  s.lineTo(lx + 9.5, yF);
  s.quadraticCurveTo(lx, yF, lx, yF - 9.5);
  s.lineTo(lx, yB + rL);
  s.quadraticCurveTo(lx, yB, lx + rL, yB);
  return s;
}

function f3LeftWingPlan(x0, zF, zB, inset = 0) {
  const lx = x0 + inset, yF = -zF - inset, yB = -zB + inset;
  const rL = 11.2, cavL = -44.6;
  const s = new THREE.Shape();
  s.moveTo(-22.0, yF);
  s.lineTo(lx + 9.5, yF);
  s.quadraticCurveTo(lx, yF, lx, yF - 9.5);
  s.lineTo(lx, yB + rL);
  s.quadraticCurveTo(lx, yB, cavL, yB);
  s.lineTo(cavL, 26.0);
  s.lineTo(-31.0, 26.0);
  s.lineTo(-31.0, 4.5);
  s.lineTo(-22.0, 4.5);
  s.closePath();
  return s;
}

function f3RightWingPlan(x1, zF, zB, inset = 0) {
  const rx = x1 - inset, yF = -zF - inset, yB = -zB + inset;
  const rR = 13.5, cavR = 71.0;
  const s = new THREE.Shape();
  s.moveTo(cavR, yB);
  s.quadraticCurveTo(rx, yB, rx, yB + rR);
  s.lineTo(rx, yF - 10.0);
  s.quadraticCurveTo(rx, yF, 62.0, yF);
  s.lineTo(22.0, yF);
  s.lineTo(22.0, 4.5);
  s.lineTo(31.0, 4.5);
  s.lineTo(31.0, 15.5);
  s.lineTo(48.0, 15.5);
  s.lineTo(48.0, 21.0);
  s.lineTo(cavR, 21.0);
  s.closePath();
  return s;
}

// ───────── Smoothly Deep-Drawn Removable DE-3 High-Eyepoint Pentaprism Loft (true mm arc-length UVs + generous 3.2 mm Giugiaro fillets!) ─────────
function buildDE3PrismGeo() {
  // Distinctive tall, bold stepped DE-3 HP trapezoidal silhouette reaching Y = +68.9 mm (total F3HP height = 101.5 mm EXACT!)
  // Levels: [y, xFront, xRear, zFront, zRear, cornerR, wear]
  const levels = [
    [35.0, 24.2, 24.0, -34.2,  9.5, 2.4, 0.25],
    [40.0, 24.1, 23.9, -34.2,  9.9, 2.5, 0.35],
    [44.8, 23.9, 23.8, -34.2, 10.2, 2.6, 0.48], // lower straight HP/ADR skirt
    [46.8, 22.8, 22.6, -33.2, 10.1, 2.8, 0.65], // crisp horizontal DE-3 step ledge above HP!
    [52.8, 20.5, 20.6, -31.0,  8.5, 3.0, 0.55],
    [59.0, 18.1, 18.5, -28.7,  6.7, 3.2, 0.58], // bold front slanted brow carrying GLASS WORKS
    [61.0, 17.2, 17.6, -27.2,  5.5, 3.2, 0.72], // softly filleted upper brow ridge
    [64.5, 15.6, 16.1, -24.5,  1.6, 3.0, 0.76],
    [67.2, 14.2, 14.8, -22.2, -1.8, 2.8, 0.80],
    [68.2, 13.4, 14.0, -21.0, -3.4, 2.3, 0.85],
    [68.9, 12.2, 12.8, -19.8, -4.8, 1.8, 0.90], // smoothly crowned Giugiaro DE-3 High-Eyepoint top!
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
      // True millimeter arc-length UVs so satin-black bead-blasted brass grain tiles cleanly around all faces!
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
  pos.push(0, botL.y, -12.0); uv.push(0, -12.0); wear.push(0.2);
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
  // Large DE-3 High-Eyepoint optical roof pentaprism nestled strictly INSIDE removable DE-3 shell (y = 36.4..64.5 mm!)
  const s = new THREE.Shape();
  s.moveTo(-27.0, 36.4);
  s.lineTo(-2.5, 36.4);
  s.lineTo(-2.5, 55.0);
  s.lineTo(-16.5, 64.5);
  s.lineTo(-29.0, 46.5);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 20.0, bevelEnabled: false });
  g.rotateY(-Math.PI / 2);
  g.translate(10.0, 0, 0);
  return prep(g);
}

// True rounded triangular Nikon chrome wire strap D-ring hanging naturally from the eyelet bore (Nikon_F3_HP.JPG!)
function buildTriangleDRing(w = 10.8, h = 11.8, r = 0.82) {
  const hw = w * 0.5;
  const pts = [
    new THREE.Vector3(0, 0.3, 0),
    new THREE.Vector3(0, -1.6, hw * 0.42),
    new THREE.Vector3(0, -h * 0.56, hw * 0.94),
    new THREE.Vector3(0, -h, hw * 0.74),
    new THREE.Vector3(0, -h - 0.2, 0),
    new THREE.Vector3(0, -h, -hw * 0.74),
    new THREE.Vector3(0, -h * 0.56, -hw * 0.94),
    new THREE.Vector3(0, -1.6, -hw * 0.42),
  ];
  const curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal', 0.45);
  return prep(new THREE.TubeGeometry(curve, 56, r, 14, true));
}

// ───────── 1982 Giugiaro Nikon F3HP Body Builder ─────────
function buildBody(lib, hov) {
  const bk = lib.get('blackEnamel'), satinBk = lib.get('satinBlackBody'), leather = lib.get('leather'), gripRub = lib.get('gripRubber');
  const bright = lib.get('chromeBright'), turned = lib.get('turned'), steel = lib.get('steel'), anod = lib.get('anod');
  const flock = lib.get('flock'), brass = lib.get('brass'), red = lib.get('giugiaroRed');
  const intBlk = lib.get('interiorBlack'), pPlate = lib.get('pressurePlate');

  const core = new THREE.Group(), top = new THREE.Group(), bottom = new THREE.Group(), doorPivot = new THREE.Group(), prismGroup = new THREE.Group();
  const ck = new Kit(), tk = new Kit(), btk = new Kit(), dk = new Kit(), pk = new Kit();
  const zShellBack = B.zB;

  // Hollow split vulcanite leatherette chassis wings (Y = -28.0 .. +23.7)
  const leftW = f3LeftWingPlan(B.x0, B.zF, zShellBack, 0.2);
  const rightW = f3RightWingPlan(B.x1, B.zF, zShellBack, 0.2);
  ck.add(slab(leftW, B.seamY - B.baseY, 0.55, 32, 0.45, 4), leather, T(0, B.baseY, 0, -Math.PI / 2, 0, 0));
  ck.add(slab(rightW, B.seamY - B.baseY, 0.55, 32, 0.45, 4), leather, T(0, B.baseY, 0, -Math.PI / 2, 0, 0));
  // Sculpted Smooth Vulcanized Rubber Giugiaro Right-Hand Ergonomic Front Grip (generous 1.8 mm smooth roll into top & base! ks_f3hp_03!)
  const gripS = new THREE.Shape();
  gripS.moveTo(62.0, -B.zF);
  gripS.bezierCurveTo(62.4, -B.zF + 5.8, 71.0, -B.zF + 6.8, 79.4, -B.zF + 5.2);
  gripS.quadraticCurveTo(B.x1, -B.zF + 3.2, B.x1, -B.zF - 6.0);
  gripS.lineTo(B.x1, -B.zF - 11.5);
  gripS.lineTo(62.0, -B.zF - 11.5);
  gripS.closePath();
  ck.add(slab(gripS, B.seamY - B.baseY + 0.2, 1.8, 36, 0.45, 6), gripRub, T(0, B.baseY, 0, -Math.PI / 2, 0, 0));
  // ICONIC VERTICAL GIUGIARO RED STRIPE recessed cleanly in a machined dark groove (X = +61.2, Y = -28.0..+23.7!)
  ck.add(rbox(2.5, B.seamY - B.baseY - 0.3, 1.2, 0.2, 1), flock, T(61.2, (B.seamY + B.baseY) / 2, B.zF - 0.15));
  ck.add(rbox(1.85, B.seamY - B.baseY - 0.6, 1.45, 0.35, 3), red, T(61.2, (B.seamY + B.baseY) / 2, B.zF - 0.38));
  // Dead-flat matte black interior chamber floor & ceiling (Law #18!)
  ck.add(rbox(128.0, 2.8, 28.0, 0.2, 1), intBlk, T(14.0, B.baseY + 1.4, -10.0));
  ck.add(rbox(128.0, 1.6, 28.0, 0.2, 1), intBlk, T(14.0, 22.0, -10.0));

  // Smoothly Forged Satin-Black Nikon F-Mount Mirror-Box Apron (generous rounded 5.2 mm lower corners & 1.8 mm rolled bevel! ks_f3hp_04!)
  const apron = new THREE.Shape();
  apron.moveTo(-26.0, -32.2);
  apron.quadraticCurveTo(0, -32.8, 26.0, -32.2);
  apron.bezierCurveTo(30.4, -32.0, 31.2, -29.2, 31.2, -25.0);
  apron.lineTo(31.2, 13.5);
  apron.bezierCurveTo(31.2, 18.5, 28.2, 29.0, 26.8, B.deck - 0.8);
  apron.quadraticCurveTo(25.8, B.deck + 0.5, 23.2, B.deck + 0.5);
  apron.lineTo(-23.2, B.deck + 0.5);
  apron.quadraticCurveTo(-25.8, B.deck + 0.5, -26.8, B.deck - 0.8);
  apron.bezierCurveTo(-28.2, 29.0, -31.2, 18.5, -31.2, 13.5);
  apron.lineTo(-31.2, -25.0);
  apron.bezierCurveTo(-31.2, -29.2, -30.4, -32.0, -26.0, -32.2);
  apron.holes.push(new THREE.Path().absarc(0, 0, 22.2, 0, TAU, true));
  ck.add(slab(apron, 11.8, [1.8, 1.0], 36, 0.65, 6), satinBk, T(0, 0, -43.0));
  ck.add(revolve([[29.6, -42.5], [29.6, -45.2, 0.5], [28.5, -45.6], [22.0, -45.6], [22.0, -42.5]], { segs: 96, crease: 30 }), satinBk);
  // Gleaming Turned Stainless Nikon F-Mount Flange + 4 Recessed Phillips Screws + White Mounting Dot + AI Coupling Tab (Nikon_F3_HP.JPG!)
  ck.add(revolve([[28.5, -45.0], [28.5, DIM.flange, 0.4], [22.0, DIM.flange], [22.0, -41.0]], { segs: 96, crease: 30 }), turned);
  [45, 135, 225, 315].forEach((a) => {
    const rad = a * DEG;
    addScrew(ck, steel, ck, flock, T(Math.cos(rad) * 25.4, Math.sin(rad) * 25.4, DIM.flange - 0.08, 0, Math.PI, 0), 1.1, true, 0.3);
  });
  ck.add(new THREE.SphereGeometry(0.95, 16, 12), lib.get('white'), T(-25.8, 11.8, -43.4)); // white lens mounting index dot (#18)
  ck.add(rbox(2.2, 4.2, 2.2, 0.35, 2), steel, T(-17.0, 23.6, DIM.flange - 0.5, 0, 0, 0.62)); // AI meter coupling tab (#21)

  // AUTHENTIC FRONT CONTROLS PER FACTORY MANUAL p-02 & ks_f3_01.jpg (machined stepped bezels + turned metal buttons!):
  // #5 Self-Timer LED window (deeply smoked near-black maroon ribbed square directly under F3, X=+53.5, Y=+14.8)
  ck.add(rbox(7.8, 8.4, 1.6, 0.6, 3), bk, T(53.5, 14.8, B.zF - 0.3));
  const ledMat = lib.prepare(new THREE.MeshPhysicalMaterial({ name: 'f3SelfTimerLed', color: 0x120303, emissive: 0xff2218, emissiveIntensity: 0.0, roughness: 0.14, clearcoat: 1.0, clearcoatRoughness: 0.08 }), {});
  ck.add(rbox(6.0, 6.6, 0.6, 0.25, 2), ledMat, T(53.5, 14.8, B.zF - 0.95));
  ck.add(rbox(6.2, 0.65, 0.4, 0.1, 1), bk, T(53.5, 14.8, B.zF - 1.25)); // crisp horizontal divider rib across smoked LED window
  // #2/#3 Coaxial Turned-Chrome DoF Preview Plunger inside Animatable Teardrop Black Mirror-Lock-Up Lever + Recessed Collar (ks_f3_01.jpg!)
  const mluLever = new THREE.Group(); mluLever.position.set(38.9, 15.8, B.zF - 3.6);
  {
    const mk2 = new Kit();
    const mluS = new THREE.Shape();
    mluS.absarc(0, 0, 6.2, -Math.PI * 0.85, Math.PI * 0.2, false);
    mluS.bezierCurveTo(5.8, 6.5, 3.2, 11.2, 0.8, 12.2);
    mluS.bezierCurveTo(-1.8, 12.8, -4.2, 10.6, -4.4, 7.2);
    mluS.closePath();
    mk2.add(slab(mluS, 3.6, 0.9, 28, 0.45, 4), bk);
    mk2.build(mluLever);
  }
  core.add(mluLever);
  ck.add(revolve([[4.6, 0], [4.6, 0.6], [0, 0.6]], { segs: 40 }), flock, T(38.9, 15.8, B.zF - 3.3, Math.PI, 0, 0));
  const dofButton = new THREE.Group(); dofButton.position.set(38.9, 15.8, B.zF - 3.2);
  {
    const dk2 = new Kit();
    dk2.add(revolve([[4.1, 0], [4.1, 1.9, 0.4], [3.65, 2.5, 0.6], [3.1, 2.6], [0, 2.52]], { segs: 44 }), turned, T(0, 0, 0, Math.PI, 0, 0));
    dk2.build(dofButton);
  }
  core.add(dofButton);
  // #6 Animatable Mechanical Backup Shutter Release Lever (slender vertical black flip-down lever w/ red dot beside mount, X=+34.5, Y=-8.0)
  const backupLever = new THREE.Group(); backupLever.position.set(34.5, -4.0, B.zF - 1.5);
  {
    const blk = new Kit();
    blk.add(rbox(2.6, 11.0, 2.4, 0.7, 3, 0.35), bk, T(0, -4.0, 0));
    blk.add(new THREE.SphereGeometry(0.65, 14, 10), red, T(0, 0.2, -1.15));
    blk.build(backupLever);
  }
  core.add(backupLever);
  // #7 Animatable Satin-Black Convex Exposure Memory Lock Button w/ recessed collar ring (X=+39.4, Y=-14.3)
  ck.add(revolve([[5.6, 0], [5.6, 0.6], [0, 0.6]], { segs: 40 }), anod, T(39.4, -14.3, B.zF - 0.1, Math.PI, 0, 0));
  const memLockBtn = new THREE.Group(); memLockBtn.position.set(39.4, -14.3, B.zF - 0.3);
  {
    const mlk = new Kit();
    mlk.add(revolve([[5.0, 0.3], [5.0, 2.2, 0.45], [4.2, 3.3, 0.45], [2.2, 4.1], [0, 4.3]], { segs: 44 }), bk, T(0, 0, 0, Math.PI, 0, 0));
    mlk.build(memLockBtn);
  }
  core.add(memLockBtn);
  // #17 Front-Left (-X) Concentric Chrome PC Flash Sync Socket w/ dark guard collar (X=-42.0, Y=+25.2)
  ck.add(revolve([[4.8, 0], [4.8, 0.5], [0, 0.5]], { segs: 40 }), anod, T(-42.0, 25.2, B.zF - 0.04, Math.PI, 0, 0));
  ck.add(revolve([[4.2, 0.2], [4.2, 2.4, 0.4], [3.2, 2.4], [3.2, 0.2], [0, 0.2]], { segs: 40 }), turned, T(-42.0, 25.2, B.zF - 0.1, Math.PI, 0, 0));
  ck.add(revolve([[2.0, 0.2], [2.0, 2.0], [1.3, 2.0], [1.3, 0.2]], { segs: 32 }), steel, T(-42.0, 25.2, B.zF - 0.1, Math.PI, 0, 0));
  ck.add(revolve([[0.7, 0.2], [0.7, 2.0], [0, 2.0]], { segs: 24 }), brass, T(-42.0, 25.2, B.zF - 0.1, Math.PI, 0, 0));
  // #19 Front-Left (-X) Turned-Chrome Lens Release Button inside Machined Black Guard Boss (ks_f3_01.jpg & ks_f3hp_04!)
  ck.add(revolve([[4.5, 0], [4.5, 1.4, 0.35], [4.0, 1.6], [0, 1.6]], { segs: 40 }), satinBk, T(-35.0, -0.8, B.zF - 0.1, Math.PI, 0, 0));
  ck.add(revolve([[3.5, 1.2], [3.5, 2.6, 0.45], [3.0, 3.0, 0.6], [0, 2.95]], { segs: 40 }), turned, T(-35.0, -0.8, B.zF - 0.4, Math.PI, 0, 0));

  // Open Dead-Flat Black Mirror-Box Tunnel + Nikon F3 Bottom-Floor SPD Condenser Meter Cell (Museum Cutaway!)
  const throatTube = new THREE.CylinderGeometry(21.8, 21.8, 39.0, 48, 1, true);
  throatTube.rotateX(Math.PI / 2); throatTube.translate(0, 0, -23.5);
  ck.add(throatTube, lib.prepare(new THREE.MeshPhysicalMaterial({ name: 'f3InteriorThroat', color: 0x020203, roughness: 0.98, metalness: 0.0, specularIntensity: 0.0, envMapIntensity: 0.04, side: THREE.BackSide }), {}));
  [-20.5, 20.5].forEach((mx) => ck.add(rbox(1.6, 36.0, 33.0, 0.2, 1), intBlk, T(mx, 0, -21.5)));
  ck.add(rbox(40.0, 2.2, 33.0, 0.2, 1), intBlk, T(0, -19.0, -21.5));
  ck.add(rbox(36.0, 2.6, 4.2, 0.4, 1), lib.get('felt'), T(0, 19.2, -37.0));
  // Bottom-floor tilted SPD Metering Condenser Lens + Photodiode Cell (visible in Cutaway — Nikon_F3_and_50mm_lens_cutaway_at_Nikon_Museum.jpg!)
  ck.add(revolve([[0, -1.2], [5.8, -0.6], [6.0, 0.6], [0, 1.2]], { segs: 32 }), lib.get('innerGlass'), T(0, -22.5, -18.0, 0.62, 0, 0));
  ck.add(rbox(11.0, 2.2, 8.0, 0.3, 1), anod, T(0, -25.2, -21.5, 0.62, 0, 0));

  // ───────── Open-Back 35 mm Film Compartment (ks_f3hp_05.jpg!) ─────────
  const gate = rrPath(-30.0, -19.5, 30.0, 19.5, 0.8); gate.holes.push(rrPath(-18.0, -12.0, 18.0, 12.0, 0.25, new THREE.Path()));
  ck.add(slab(gate, 2.2, 0.2), intBlk, T(0, 0, -2.8));
  [-12.4, 12.4].forEach((ry) => ck.add(rbox(60.0, 2.0, 1.0, 0.15, 1, 0.75), bright, T(0, ry, -0.35)));
  [-17.8, 17.8].forEach((ry) => ck.add(rbox(58.0, 1.5, 1.4, 0.15, 1, 0.75), bright, T(0, ry, -0.15)));
  // Signature full-height gleaming left stainless film-flattening roller (ks_f3hp_05.jpg!) + twin gold MF-14 data contacts!
  ck.add(revolve([[1.8, -21.5], [1.8, 21.5, 0.25]], { segs: 32 }), bright, T(-31.8, -1.0, -0.6, Math.PI / 2, 0, 0));
  [4.5, 10.5].forEach((gx) => ck.add(revolve([[1.1, 0], [1.1, 0.45], [0, 0.45]], { segs: 24 }), brass, T(gx, -22.2, 0.8)));

  // Left (-X) open-backed cassette well + GW 400 film cartridge
  const cassWell = new THREE.CylinderGeometry(12.6, 12.6, 42.0, 28, 1, true, Math.PI * 0.55, Math.PI * 0.90);
  cassWell.translate(DIM.rewind.x, -1.0, DIM.rewind.z);
  ck.add(cassWell, lib.prepare(new THREE.MeshPhysicalMaterial({ name: 'f3InteriorCassWell', color: 0x020203, roughness: 0.98, metalness: 0.0, specularIntensity: 0.0, envMapIntensity: 0.04, side: THREE.BackSide }), {}));
  const filmCart = new THREE.Group(); filmCart.position.set(DIM.rewind.x, -1.0, DIM.rewind.z);
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
      new THREE.Vector2(-32.5, -2.5), new THREE.Vector2(-29.0, -0.3), new THREE.Vector2(-22.0, 0.25),
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

  // Rotating 8-Tooth Black Sprocket Drum + Multi-Slotted Take-Up Spool
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

  const takeup = new THREE.Group(); takeup.position.set(60.5, -1.0, -9.8);
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

  // Side Chrome Strap Eyelets (Y=+26.5) + Black Nylon Lug Bumpers + Triangular Chrome Nikon D-Rings (ks_f3_01.jpg!)
  [[B.x0 + 0.1, -1], [B.x1 - 0.1, 1]].forEach(([ex, sx]) => {
    ck.add(revolve([[2.6, -1.4], [2.6, 1.6, 0.45], [1.9, 2.0], [0, 2.0]], { segs: 36 }), bright, T(ex, 26.5, -17.5, 0, sx * Math.PI / 2, 0));
    ck.add(rbox(1.2, 6.2, 5.4, 0.5, 2), gripRub, T(ex + sx * 1.1, 24.4, -17.5, 0, 0, sx * 0.2));
    ck.add(buildTriangleDRing(10.8, 11.8, 0.82), bright, T(ex + sx * 1.4, 26.2, -17.5, 0, 0, sx * 0.24));
  });
  ck.build(core);

  // Instant-Return 45° Micro-Perforated Main Reflex Mirror + Articulated Folding Secondary Sub-Mirror (for bottom SPD metering!)
  const mirrorPivot = new THREE.Group(); mirrorPivot.position.set(0, 16.5, -11.5);
  {
    const mk = new Kit();
    mk.add(rbox(31.0, 1.2, 26.8, 0.25, 1), intBlk, T(0, -0.7, -13.6));
    [-16.0, 16.0].forEach((mx) => mk.add(rbox(1.3, 2.8, 25.0, 0.25, 1), steel, T(mx, -0.8, -13.0)));
    const mirMat = lib.prepare(new THREE.MeshPhysicalMaterial({ name: 'f3ReflexMirror', map: focusScreenTex(), color: 0xb0babd, metalness: 0.78, roughness: 0.08, clearcoat: 1.0, clearcoatRoughness: 0.04 }), {});
    mk.add(new THREE.PlaneGeometry(29.2, 25.0), mirMat, T(0, 0.02, -13.6, -Math.PI / 2, 0, 0));
    mk.build(mirrorPivot);
  }
  // Articulated secondary sub-mirror hinged underneath main mirror — folds flat against main mirror as mirror rises (Nikon Museum cutaway!)
  const subMirrorPivot = new THREE.Group(); subMirrorPivot.position.set(0, -1.2, -12.8);
  {
    const smk = new Kit();
    smk.add(rbox(14.0, 0.8, 12.0, 0.15, 1), steel, T(0, -0.4, 5.8));
    smk.add(new THREE.PlaneGeometry(12.8, 10.8), lib.prepare(new THREE.MeshPhysicalMaterial({ name: 'f3SubMirror', color: 0x9aa6ac, metalness: 0.88, roughness: 0.06 }), {}), T(0, -0.82, 5.8, Math.PI / 2, 0, 0));
    smk.build(subMirrorPivot);
  }
  mirrorPivot.add(subMirrorPivot);
  core.add(mirrorPivot);

  // Quilted Vertically-Corrugated Titanium Foil Horizontal Focal-Plane Shutter Curtains + Steel Laths (ks_f3hp_05.jpg!)
  const curtain1Cloth = new THREE.Mesh(prep(new THREE.PlaneGeometry(37.0, 24.4)), lib.get('curtain'));
  curtain1Cloth.position.set(0, 0, -1.9);
  const curtain1Lath = new THREE.Mesh(prep(rbox(1.3, 24.4, 0.4, 0.1, 1)), steel);
  curtain1Lath.position.set(-18.5, 0, -1.75);
  const curtain2Cloth = new THREE.Mesh(prep(new THREE.PlaneGeometry(37.0, 24.4)), lib.get('curtain'));
  curtain2Cloth.position.set(-18.5, 0, -1.55); curtain2Cloth.scale.x = 0.001;
  const curtain2Lath = new THREE.Mesh(prep(rbox(1.3, 24.4, 0.4, 0.1, 1)), steel);
  curtain2Lath.position.set(-18.5, 0, -1.4);
  core.add(curtain1Cloth, curtain1Lath, curtain2Cloth, curtain2Lath);

  // ───────── Forged Lacquered-Brass Giugiaro Top Plate (asymmetric [0.45, 2.5] rolled shoulder, 7 segments!) + Type-K Screen Bay ─────────
  const topPlan = f3PlanShape(B.x0 + 0.3, B.x1 - 0.3, B.zF, zShellBack, 0, true);
  // Punch open central focusing-screen bay hole in top plate so removing DE-3 exposes the real Type-K focusing screen!
  topPlan.holes.push(rrPath(-21.5, -1.5, 21.5, 28.5, 1.4, new THREE.Path()));
  tk.add(slab(topPlan, B.deck - B.seamY, [0.45, 2.5], 40, 0.78, 7), satinBk, T(0, B.seamY, 0, -Math.PI / 2, 0, 0));
  // Interchangeable Type-K Focusing Screen inside its machined silver/black bay frame + front ADR/LCD optics deck (ks_f3c_07!)
  const bayRim = rrPath(-21.5, -15.5, 21.5, 15.5, 1.2); bayRim.holes.push(rrPath(-18.2, -12.2, 18.2, 12.2, 0.4, new THREE.Path()));
  tk.add(slab(bayRim, 1.6, 0.25, 16, 0.3, 2), anod, T(0, B.deck - 0.8, -14.0, -Math.PI / 2, 0, 0));
  tk.add(new THREE.PlaneGeometry(36.0, 24.0), lib.prepare(new THREE.MeshPhysicalMaterial({ map: focusScreenTex(), transparent: true, roughness: 0.30, metalness: 0.05, side: THREE.DoubleSide }), {}), T(0, B.deck - 0.3, -14.0, -Math.PI / 2, 0, 0));
  // Front prism-bay ADR & LCD optics block (visible when DE-3 is lifted — ks_f3c_07.jpg!)
  tk.add(rbox(42.0, 7.5, 9.0, 0.6, 2), bk, T(0, B.deck + 3.4, -31.0));
  tk.add(rbox(7.5, 2.2, 2.0, 0.2, 1), bright, T(-9.0, B.deck + 7.2, -31.0));
  // Animatable ribbed metallic side prism release locking latches (#31, ks_f3_01.jpg & ks_f3hp_03.jpg!)
  const finderLatches = new THREE.Group();
  {
    const flk = new Kit();
    [-24.2, 24.2].forEach((px) => {
      flk.add(rbox(2.2, 5.4, 9.4, 0.5, 2, 0.45), anod, T(px, B.deck + 2.8, -14.0));
      [-3.0, -1.0, 1.0, 3.0].forEach((rz) => flk.add(rbox(2.5, 4.4, 0.7, 0.15, 1), steel, T(px, B.deck + 2.8, -14.0 + rz)));
    });
    flk.build(finderLatches);
  }
  top.add(finderLatches);
  // Crisp white top-deck shutter-speed index line at 6 o'clock (+Z) behind the shutter dial!
  tk.add(rbox(1.1, 0.24, 3.2, 0.08, 1), lib.get('white'), T(DIM.dial.x, B.deck + 0.12, DIM.dial.z + DIM.dial.r + 1.8));
  // Iconic vector-traced hollow white F3 serif badge locked pixel-exact to Nikon_F3_HP.JPG (X=+54.0, Y=+29.0, 9.6×5.6 mm!)
  tk.add(new THREE.PlaneGeometry(9.6, 5.6), lib.prepare(new THREE.MeshPhysicalMaterial({ map: f3BadgeTex(), transparent: true, depthWrite: false, roughness: 0.28, metalness: 0.25 }), {}), T(54.0, 29.0, B.zF - 0.12, 0, Math.PI, 0));
  // Rear upper-right GLASS WORKS + 7-digit serial engraving (ks_f3hp_02.jpg!)
  tk.add(new THREE.PlaneGeometry(28.0, 4.6), lib.prepare(new THREE.MeshPhysicalMaterial({ map: rearSerialTex(), transparent: true, depthWrite: false, roughness: 0.35 }), {}), T(44.0, 29.2, zShellBack + 0.08));
  // Left-deck Exposure Compensation (+2..0..-2) scale & white-tipped locking button (#32/#38, ks_f3c_07.jpg!)
  tk.add(new THREE.PlaneGeometry(9.5, 19.0), lib.prepare(new THREE.MeshPhysicalMaterial({ map: expCompScaleTex(), transparent: true, alphaTest: 0.1, roughness: 0.35 }), {}), T(-27.2, B.deck + 0.1, -12.0, -Math.PI / 2, 0, 0));
  tk.add(revolve([[2.2, 0], [2.2, 1.4, 0.25], [1.6, 1.8], [0, 1.8]], { segs: 28 }), bright, T(-27.2, B.deck, -2.0, -Math.PI / 2, 0, 0));
  // Authentic Flush Recessed Curved Pie-Wedge Frame Counter Sector strictly inside outer +X shoulder (X=+71..76, ks_f3c_07.jpg!)
  const ctrCv = canvas(256, 256), ctrTex = tex(ctrCv);
  const wedgeBezel = new THREE.Shape();
  wedgeBezel.absarc(0, 0, 8.2, -0.58, 0.58, false);
  wedgeBezel.absarc(0, 0, 2.8, 0.58, -0.58, true);
  wedgeBezel.closePath();
  tk.add(slab(wedgeBezel, 0.45, 0.12, 28, 0.3, 2), anod, T(68.2, B.deck + 0.02, -10.5, -Math.PI / 2, 0, 0));
  const wedgeWin = new THREE.Shape();
  wedgeWin.absarc(0, 0, 7.6, -0.52, 0.52, false);
  wedgeWin.absarc(0, 0, 3.3, 0.52, -0.52, true);
  wedgeWin.closePath();
  const wedgeGeo = new THREE.ShapeGeometry(wedgeWin, 28);
  {
    // 1:1 un-sheared aspect-preserving planar UVs centered on sector midpoint (x=5.4, y=0) so numeral reads upright & crisp!
    const uv = wedgeGeo.attributes.uv, p = wedgeGeo.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.5 + (p.getX(i) - 5.4) / 9.2, 0.5 + p.getY(i) / 9.2);
  }
  tk.add(wedgeGeo, lib.prepare(new THREE.MeshBasicMaterial({ map: ctrTex }), {}), T(68.2, B.deck + 0.48, -10.5, -Math.PI / 2, 0, 0));
  // Film plane Φ indicator mark (#58)
  tk.add(revolve([[1.8, 0], [1.8, 0.25], [1.3, 0.25]], { segs: 28 }), bright, T(28.5, B.deck + 0.06, -0.5, -Math.PI / 2, 0, 0));
  tk.add(rbox(5.6, 0.22, 0.45, 0.08, 1), bright, T(28.5, B.deck + 0.12, -0.5));
  tk.build(top);

  // ───────── REMOVABLE DE-3 HIGH-EYEPOINT PENTAPRISM FINDER (lifts off cleanly on finderK = 1!) ─────────
  pk.add(buildDE3PrismGeo(), satinBk);
  // Front brow neutral GLASS WORKS + lower-left 'HP' badge + recessed ADR glass window + right-side red LCD illuminator button (#22/#47)!
  const browTilt = Math.atan2(4.6, 12.7);
  pk.add(new THREE.PlaneGeometry(31.0, 9.6), lib.prepare(new THREE.MeshPhysicalMaterial({ map: prismBadgeTex(), transparent: true, depthWrite: false, roughness: 0.30, metalness: 0.2 }), {}), T(0, 52.8, -31.1, browTilt, Math.PI, 0));
  pk.add(new THREE.PlaneGeometry(6.8, 4.0), lib.prepare(new THREE.MeshPhysicalMaterial({ map: hpBadgeTex(), transparent: true, depthWrite: false, roughness: 0.30 }), {}), T(-17.5, 43.0, -34.35, 0, Math.PI, 0));
  pk.add(rbox(7.4, 3.6, 1.2, 0.25, 1), lib.get('windowGlass'), T(-8.5, 38.2, -34.25));
  const illuminatorBtn = new THREE.Group(); illuminatorBtn.position.set(24.4, 40.2, -31.8);
  { const ik = new Kit(); ik.add(rbox(2.0, 2.8, 2.4, 0.35, 2), red); ik.build(illuminatorBtn); }
  prismGroup.add(illuminatorBtn);
  // Signature Pebbled Vulcanite Black Leatherette Panels on BOTH DE-3 Flat Top Crown AND Upper Rear Slope (ks_f3hp_02 & 03!)
  const de3TopPad = rrPath(-10.2, -5.8, 10.2, 5.8, 1.2);
  pk.add(slab(de3TopPad, 0.55, 0.22, 16, 0.25, 2), lib.get('de3Leather'), T(0, 68.72, -12.3, -Math.PI / 2, 0, 0));
  const de3Pad = new THREE.Shape();
  de3Pad.moveTo(-13.4, -4.6); de3Pad.lineTo(13.4, -4.6);
  de3Pad.lineTo(10.8, 4.4); de3Pad.lineTo(-10.8, 4.4); de3Pad.closePath();
  pk.add(slab(de3Pad, 0.72, 0.28, 16, 0.25, 3), lib.get('de3Leather'), T(0, 64.5, 1.72, -Math.atan2(8.0, 6.6), 0, 0));
  // Protruding Circular DE-3 High-Eyepoint Multi-Coated Meniscus Eyepiece + Animatable Eyepiece-Shutter Blind Lever (#40, ks_f3hp_02!)
  const E = DIM.eyepiece;
  pk.add(rbox(29.0, 22.0, 9.5, 3.2, 5, 0.5), satinBk, T(E.x, E.y - 1.5, E.z - 6.8));
  pk.add(revolve([[E.r + 2.2, 0], [E.r + 2.2, 4.2, 0.55], [E.r + 0.6, 4.8, 0.6], [E.r - 0.6, 4.8], [E.r - 0.6, 0.8]], { segs: 56 }), gripRub, T(E.x, E.y, E.z - 4.4));
  pk.add(revolve([[E.r - 0.5, 2.8], [E.r - 0.5, 3.5], [E.r - 1.1, 3.5], [E.r - 1.1, 2.8]], { segs: 48 }), steel, T(E.x, E.y, E.z - 4.4));
  const eyeShutterLever = new THREE.Group(); eyeShutterLever.position.set(-14.6, E.y + 1.2, E.z - 3.6);
  { const esk = new Kit(); esk.add(rbox(3.4, 7.6, 2.4, 1.1, 3, 0.35), bk, T(0, 2.8, 0, 0, 0, 0.22)); esk.build(eyeShutterLever); }
  prismGroup.add(eyeShutterLever);
  const eyeBlind = new THREE.Mesh(prep(new THREE.CircleGeometry(E.r - 0.9, 40)), intBlk);
  eyeBlind.position.set(E.x, E.y, E.z - 2.6); eyeBlind.visible = false;
  prismGroup.add(eyeBlind);
  const eyeBaseCv = canvas(256, 256), ebg = eyeBaseCv.getContext('2d');
  ebg.fillStyle = '#040609'; ebg.fillRect(0, 0, 256, 256);
  ebg.fillStyle = '#071016'; ebg.fillRect(46, 72, 164, 112); // deep dark internal 3:2 viewfinder mask frame
  ebg.strokeStyle = 'rgba(70, 120, 138, 0.14)'; ebg.lineWidth = 2;
  ebg.strokeRect(48, 74, 160, 108); ebg.beginPath(); ebg.arc(128, 128, 20, 0, TAU); ebg.stroke();
  const screenMat = lib.prepare(new THREE.MeshBasicMaterial({ map: tex(eyeBaseCv), color: 0xffffff, toneMapped: false }), {});
  const eyeScreen = new THREE.Mesh(prep(new THREE.CircleGeometry(E.r - 0.8, 48)), screenMat);
  eyeScreen.scale.x = -1;
  eyeScreen.position.set(E.x, E.y, E.z - 3.4);
  eyeScreen.userData.part = 'finder'; eyeScreen.userData.noShadow = true;
  prismGroup.add(eyeScreen);
  // Deeply recessed dark blue-green multi-coated HP ocular meniscus lens (kills bright flat grey-blue sticker look! ks_f3hp_02!)
  const hpOcularMat = lib.prepare(new THREE.MeshPhysicalMaterial({
    name: 'f3HpOcularGlass', color: 0x0e2836, emissive: 0x030e16, emissiveIntensity: 0.10, roughness: 0.03, metalness: 0.16,
    clearcoat: 1.0, clearcoatRoughness: 0.02, iridescence: 0.88, iridescenceIOR: 1.38,
    opacity: 0.44, transparent: true, depthWrite: false,
  }), {});
  pk.add(revolve([[E.r - 0.8, 0.0], [4.5, 0.62], [0, 0.95]], { segs: 48 }), hpOcularMat, T(E.x, E.y, E.z - 1.55));
  // Solid Optical Roof Pentaprism Glass Block inside DE-3 (lifts with DE-3 & visible in cutaway!)
  prismGroup.add(new THREE.Mesh(buildOpticalPentaprismGeo(), lib.get('innerGlass')));
  const prismMeshes = pk.build(prismGroup, 'finder');
  const eyepieceMeshes = [eyeScreen, ...prismMeshes];
  top.add(prismGroup);

  // ───────── Right-Deck Shutter Speed Dial (#57), Silver A/T Lock Button, Self-Timer Lever (#48), Shutter Release + Power Switch + Swept Giugiaro Wind Lever ─────────
  const dial = new THREE.Group(); dial.position.set(DIM.dial.x, B.deck, DIM.dial.z);
  const dialK = new Kit(), dMat = lib.get('blackEnamel', { hover: hov.shutter });
  dialK.add(revolve([[DIM.dial.r - 0.7, 0], [DIM.dial.r - 0.7, 2.4, 0.3], [DIM.dial.r, 2.8, 0.35, 1], [DIM.dial.r, DIM.dial.h - 0.5, 0.35, 1], [DIM.dial.r - 0.8, DIM.dial.h]], { segs: 320, ribs: { n: 40, depth: 0.42, groove: 0.48, edge: 0.16 } }), dMat, T(0, 0, 0, -Math.PI / 2, 0, 0));
  dialK.add(new THREE.CircleGeometry(DIM.dial.r - 0.85, 56), lib.prepare(new THREE.MeshPhysicalMaterial({ map: speedDialTex(), roughness: 0.38, metalness: 0.10, specularIntensity: 0.25, envMapIntensity: 0.24 }), { hover: hov.shutter }), T(0, DIM.dial.h + 0.05, 0, -Math.PI / 2, 0, 0));
  // Authentic 3D silver center A/T lock plunger on top of F3 shutter speed dial (ks_f3c_07.jpg & Nikon_F3_HP.JPG!)
  dialK.add(revolve([[2.2, 0], [2.2, 0.85, 0.25], [1.9, 1.05], [0, 1.05]], { segs: 32 }), bright, T(0, DIM.dial.h, 0, -Math.PI / 2, 0, 0));
  const dialMeshes = dialK.build(dial, 'shutter');
  top.add(dial);
  // Independent animatable black self-timer lever collar around base of shutter speed dial (#48 — stays fixed when speed dial rotates!)
  const selfTimerLever = new THREE.Group(); selfTimerLever.position.set(DIM.dial.x, B.deck, DIM.dial.z);
  { const stk = new Kit(); stk.add(rbox(3.4, 2.4, 4.4, 0.6, 2), bk, T(0, 1.4, -(DIM.dial.r + 1.2))); stk.build(selfTimerLever); }
  top.add(selfTimerLever);

  // Coaxial Swept Black Giugiaro Film-Advance Lever + Red-Dot Power Switch + Threaded Chrome Shutter Release (X=+60.5, Z=-12.0!)
  const lever = new THREE.Group(); lever.position.set(DIM.lever.x, B.deck, DIM.lever.z);
  const levK = new Kit(), lMat = lib.get('satinBlackBody', { hover: hov.crank });
  levK.add(revolve([[DIM.lever.r + 0.5, 0], [DIM.lever.r + 0.5, 2.4, 0.35], [DIM.lever.r - 0.4, 2.9]], { segs: 56 }), lMat, T(0, 0, 0, -Math.PI / 2, 0, 0));
  // Swept curved Giugiaro lever neck curving smoothly around rear into bold contoured thumb rest (ks_f3hp_02 & 03!)
  const armSh = new THREE.Shape();
  armSh.moveTo(-5.0, 2.8);
  armSh.bezierCurveTo(1.0, 5.5, 8.2, 3.0, 7.6, -3.5);
  armSh.bezierCurveTo(6.8, -10.5, -1.5, -16.2, -9.5, -17.2);
  armSh.bezierCurveTo(-12.2, -17.5, -12.6, -13.8, -9.8, -12.8);
  armSh.bezierCurveTo(-4.5, -11.2, -3.0, -4.5, -5.0, 2.8);
  levK.add(slab(armSh, 2.4, 0.55, 32, 0.45, 3), lMat, T(0, 0.4, 0, -Math.PI / 2, 0, 0));
  const tipSh = new THREE.Shape();
  tipSh.moveTo(-7.2, -17.0);
  tipSh.bezierCurveTo(-15.5, -18.8, -26.0, -18.4, -33.0, -16.4);
  tipSh.bezierCurveTo(-35.6, -15.6, -35.6, -12.2, -32.2, -11.4);
  tipSh.bezierCurveTo(-24.8, -9.8, -15.8, -10.0, -9.2, -12.0);
  tipSh.bezierCurveTo(-6.2, -12.8, -5.4, -16.0, -7.2, -17.0);
  levK.add(slab(tipSh, 6.2, 1.3, 32, 0.45, 4), bk, T(0, 0.2, 0, -Math.PI / 2, 0, 0));
  const leverMeshes = levK.build(lever, 'crank');
  top.add(lever);

  // Coaxial Shutter Release + Independently Animatable Power Switch Collar + Multiple Exposure Lever (#51/#52/#53 — ks_f3c_07!)
  const powerCollar = new THREE.Group(); powerCollar.position.set(DIM.lever.x, B.deck + 2.8, DIM.lever.z);
  {
    const pck = new Kit();
    pck.add(revolve([[9.6, 0], [9.6, 3.0, 0.4], [8.6, 3.5], [0, 3.5]], { segs: 56 }), bk, T(0, 0, 0, -Math.PI / 2, 0, 0));
    pck.add(new THREE.SphereGeometry(0.85, 14, 10), red, T(-2.5, 3.6, -7.8)); // Power ON red dot (#50)
    pck.build(powerCollar);
  }
  top.add(powerCollar);
  const multExpLever = new THREE.Group(); multExpLever.position.set(DIM.lever.x, B.deck + 2.8, DIM.lever.z);
  { const mek = new Kit(); mek.add(rbox(3.4, 2.2, 4.6, 0.6, 2), bk, T(8.5, -1.2, -7.5, 0, -0.45, 0)); mek.build(multExpLever); }
  top.add(multExpLever);
  const release = new THREE.Group(); release.position.set(DIM.lever.x, B.deck + 2.8, DIM.lever.z);
  const relK = new Kit(), rMat = lib.get('chromeBright', { hover: hov.release });
  relK.add(revolve([[4.6, 3.0], [4.6, 4.4, 0.3], [4.0, 4.8], [1.4, 4.8], [1.4, 2.2]], { segs: 48 }), rMat, T(0, 0, 0, -Math.PI / 2, 0, 0));
  relK.add(new THREE.CircleGeometry(1.35, 28), flock, T(0, 4.76, 0, -Math.PI / 2, 0, 0));
  const releaseMeshes = relK.build(release, 'release');
  top.add(release);

  // ───────── ICONIC F3 LEFT-SHOULDER ACCESSORY HOT SHOE + ROTATING ISO/COMP COLLAR + FOLDING REWIND CRANK (#34..#39, ks_f3hp_03 & ks_f3c_07!) ─────────
  const asaCollar = new THREE.Group(); asaCollar.position.set(DIM.rewind.x, B.deck, DIM.rewind.z);
  {
    const ack = new Kit();
    // Low-profile coaxial knurled ASA/ISO & Exposure Comp collar ring (h=2.8, n=48, segs=384!) with band-wrapped ASA numerals
    ack.add(revolve([[12.2, 0], [12.5, 0.3, 0.3, 1], [12.5, 2.5, 0.3, 1], [11.8, 2.8], [0, 2.8]], { segs: 384, ribs: { n: 48, depth: 0.26, groove: 0.48, edge: 0.16 } }), bk, T(0, 0, 0, -Math.PI / 2, 0, 0));
    ack.add(revolve([[12.0, 0.5], [12.0, 2.4]], { segs: 64, uv: 'band' }), lib.prepare(new THREE.MeshPhysicalMaterial({ map: asaCollarTex(), roughness: 0.35 }), {}), T(0, 0, 0, -Math.PI / 2, 0, 0));
    ack.build(asaCollar);
  }
  top.add(asaCollar);
  const rwBase = new THREE.Group(); rwBase.position.set(DIM.rewind.x, B.deck, DIM.rewind.z);
  {
    const rbk = new Kit();
    // Signature F3 Brushed-Silver Contoured U-Shaped Accessory Hot Shoe seated cleanly inside left shoulder + 3 Front Flash Contacts!
    [-9.6, 9.6].forEach((hx) => rbk.add(rbox(2.2, 1.4, 14.0, 0.35, 2, 0.5), bright, T(hx, 3.5, -0.5)));
    rbk.add(rbox(19.6, 1.1, 2.4, 0.35, 2, 0.4), bright, T(0, 3.3, -7.8));
    [-3.4, 0.0, 3.4].forEach((cx) => rbk.add(revolve([[0.9, 0], [0.9, 0.55], [0, 0.55]], { segs: 24 }), bright, T(cx, 3.7, -7.8, -Math.PI / 2, 0, 0)));
    rbk.build(rwBase);
  }
  top.add(rwBase);

  const rwSpin = new THREE.Group(); rwSpin.position.set(DIM.rewind.x, B.deck + 2.8, DIM.rewind.z);
  {
    const rwK = new Kit();
    // Authentic tall smooth black rewind drum rising cleanly above left hot-shoe rails (total 2.8 + 5.8 = 8.6 mm — Nikon_F3_HP.JPG!)
    rwK.add(revolve([[9.4, 0], [9.4, 5.2, 0.35], [8.7, 5.8], [0, 5.8]], { segs: 56 }), bk, T(0, 0, 0, -Math.PI / 2, 0, 0));
    rwK.add(rbox(16.6, 0.45, 4.2, 0.2, 1), intBlk, T(0, 5.68, 0));
    rwK.add(revolve([[2.8, -28.0], [2.8, 1.5]], { segs: 32 }), bright, T(0, 0, 0, -Math.PI / 2, 0, 0));
    [-1.7, 1.7].forEach((fx) => rwK.add(rbox(1.1, 7.2, 1.3, 0.25, 2), bright, T(fx, -25.0, 0)));
    rwK.build(rwSpin);
  }
  const rwCrankPivot = new THREE.Group(); rwCrankPivot.position.set(7.0, 5.7, 0.0);
  {
    const rck = new Kit();
    const rcS = rrPath(-15.8, -2.0, 1.6, 2.0, 1.2);
    rck.add(slab(rcS, 1.1, 0.22, 20, 0.45, 2), bright, T(0, -0.35, 0, -Math.PI / 2, 0, 0));
    rck.build(rwCrankPivot);
  }
  const rwTipPivot = new THREE.Group(); rwTipPivot.position.set(-14.2, 0.35, 0.0);
  {
    const rtk = new Kit();
    rtk.add(revolve([[1.3, 0], [1.55, 0.2, 0.25, 1], [1.55, 3.8, 0.25, 1], [1.3, 4.0], [0, 4.0]], { segs: 160, ribs: { n: 20, depth: 0.14 } }), bright, T(0, 0, 0, -Math.PI / 2, 0, 0));
    rtk.build(rwTipPivot);
  }
  rwCrankPivot.add(rwTipPivot);
  rwSpin.add(rwCrankPivot);
  top.add(rwSpin);

  // ───────── Deep-Drawn Lacquered-Brass Bottom Baseplate ([2.2, 0.45] rolled rim + recessed cap seams! ks_f3hp_04.jpg!) ─────────
  const botPlan = f3PlanShape(B.x0, B.x1, B.zF, zShellBack, 0, true);
  btk.add(slab(botPlan, B.baseY - B.y0, [2.2, 0.45], 40, 0.78, 7), satinBk, T(0, B.y0, 0, -Math.PI / 2, 0, 0));
  // #26 Black coin-slotted MD-4 motor drive coupling cover (-X corner, X=-43.5, r=8.2) + recessed perimeter groove
  btk.add(revolve([[8.6, 0], [8.6, 0.16], [8.2, 0.16], [0, 0.16]], { segs: 56 }), flock, T(-43.5, B.y0 - 0.01, -13.5, Math.PI / 2, 0, 0));
  btk.add(revolve([[8.2, 0], [8.2, 0.42, 0.25], [7.8, 0.5], [0, 0.5]], { segs: 56 }), bk, T(-43.5, B.y0 - 0.02, -13.5, Math.PI / 2, 0, 0));
  btk.add(rbox(10.5, 0.36, 1.4, 0.15, 1), flock, T(-43.5, B.y0 - 0.46, -13.5, 0, 0.48, 0));
  // #25 Bright-turned silver coin-slotted 2×SR44 / 1×CR-1/3N battery chamber lid (X=-16.5, r=7.6) + recessed perimeter groove
  btk.add(revolve([[8.0, 0], [8.0, 0.16], [7.6, 0.16], [0, 0.16]], { segs: 56 }), flock, T(-16.5, B.y0 - 0.01, -14.0, Math.PI / 2, 0, 0));
  btk.add(revolve([[7.6, 0], [7.6, 0.42, 0.25], [7.2, 0.5], [0, 0.5]], { segs: 56 }), turned, T(-16.5, B.y0 - 0.02, -14.0, Math.PI / 2, 0, 0));
  btk.add(rbox(9.6, 0.36, 1.4, 0.15, 1), anod, T(-16.5, B.y0 - 0.46, -14.0, 0, -0.35, 0));
  // #23 Bright-turned 1/4"-20 tripod socket collar (X=-3.0)
  btk.add(revolve([[4.6, 0], [4.6, 0.6, 0.25], [2.8, 0.6], [2.8, -3.2], [0, -3.2]], { segs: 40 }), turned, T(DIM.socket.x, B.y0 - 0.02, DIM.socket.z, Math.PI / 2, 0, 0));
  // #10 Turned Silver MD-4 motor drive coupling socket (X=+25.0) + recessed perimeter groove
  btk.add(revolve([[4.4, 0], [4.4, 0.16], [4.0, 0.16], [0, 0.16]], { segs: 36 }), flock, T(25.0, B.y0 - 0.01, -14.5, Math.PI / 2, 0, 0));
  btk.add(revolve([[4.0, 0], [4.0, 0.48, 0.25], [3.6, 0.55], [0, 0.55]], { segs: 36 }), turned, T(25.0, B.y0 - 0.02, -14.5, Math.PI / 2, 0, 0));
  btk.add(rbox(5.4, 0.35, 1.2, 0.15, 1), anod, T(25.0, B.y0 - 0.50, -14.5));
  // #12 Recessed bevelled chrome film-rewind release button (X=+41.0, Z=-7.5)
  btk.add(revolve([[4.4, 0], [4.2, 0.45, 0.25], [3.0, 0.45], [3.0, -1.2], [0, -1.2]], { segs: 36 }), flock, T(41.0, B.y0 - 0.02, -7.5, Math.PI / 2, 0, 0));
  btk.add(revolve([[2.5, 0], [2.5, 0.55, 0.25], [2.2, 0.62], [0, 0.62]], { segs: 32 }), turned, T(41.0, B.y0 - 0.04, -7.5, Math.PI / 2, 0, 0));
  // #11 Motor drive positioning bore (X=+58.0, Z=-12.5) + baseplate screws
  btk.add(revolve([[2.8, 0], [2.8, 0.45, 0.25], [1.8, 0.45], [1.8, -1.6], [0, -1.6]], { segs: 28 }), steel, T(58.0, B.y0 - 0.02, -12.5, Math.PI / 2, 0, 0));
  [[-51.5, -18.5], [-51.5, -6.5], [76.0, -18.5], [76.0, -6.5]].forEach(([sx, sz]) => addScrew(btk, anod, btk, flock, T(sx, B.y0 - 0.05, sz, Math.PI / 2, 0, 0), 1.25, true, 0.4));
  btk.build(bottom);

  // ───────── Hinged +X Removable Rear Film Door (Flush Inside Rounded Stadium Corners + Light-Tight Top/Bottom — ks_f3hp_02 & 05!) ─────────
  const doorW = 117.0, doorH = 52.4, doorCX = 13.3, doorCY = -2.15, hingeX = doorCX + doorW / 2 + 0.3;
  doorPivot.position.set(hingeX, doorCY, zShellBack - 0.2);
  const dx = doorCX - hingeX;
  dk.add(rbox(doorW, doorH, 1.0, 0.45, 2, 0.4), bk, T(dx, 0, 0));
  dk.add(rbox(doorW - 4.0, doorH - 4.0, 0.55, 0.35, 2), leather, T(dx, 0, 0.42));
  dk.add(revolve([[1.3, -25.0], [1.3, 25.0, 0.3]], { segs: 28 }), bk, T(0, 0, -0.2, Math.PI / 2, 0, 0));
  // Centered square matte-black metal film-box memo holder (#13, ks_f3hp_02.jpg!)
  const memo = rrPath(-20.5, -20.5, 20.5, 20.5, 1.0); memo.holes.push(rrPath(-16.0, -16.0, 16.0, 17.5, 0.6, new THREE.Path()));
  dk.add(slab(memo, 1.4, 0.25, 20, 0.35, 2), anod, T(-hingeX, -1.5 - doorCY, 0.65));
  // Dead-flat black inner door backing liner + light-trap flange (Law #18!)
  dk.add(rbox(doorW - 2.0, doorH - 2.0, 0.35, 0.2, 1), intBlk, T(dx, 0, -0.58));
  const trap = rrPath(dx - doorW / 2 + 1.4, -doorH / 2 + 1.4, dx + doorW / 2 - 1.4, doorH / 2 - 1.4, 0.8);
  trap.holes.push(rrPath(dx - doorW / 2 + 4.4, -doorH / 2 + 4.2, dx + doorW / 2 - 4.4, doorH / 2 - 4.2, 0.5, new THREE.Path()));
  dk.add(slab(trap, 1.8, 0.2, 16), intBlk, T(0, 0, -2.2));
  // Gleaming stainless sprocket roller + satin-matte black pressure plate (50×33 mm) + capped rivets!
  dk.add(revolve([[2.1, -18.0], [2.1, 18.0, 0.3]], { segs: 36 }), bright, T(42.0 - hingeX, 0, -2.4, Math.PI / 2, 0, 0));
  dk.add(rbox(50.0, 33.0, 1.1, 0.35, 2, 0.0), pPlate, T(-hingeX, -doorCY, -2.3));
  [-11.5, 11.5].forEach((py) => dk.add(revolve([[1.5, 0], [1.5, 0.55], [0, 0.55]], { segs: 28 }), steel, T(-hingeX, -doorCY + py, -2.9, Math.PI, 0, 0)));
  [-17.0, 17.0].forEach((px) => dk.add(rbox(14.0, 2.2, 0.7, 0.15, 1), steel, T(-hingeX + px, -doorCY, -1.3)));
  dk.add(rbox(3.0, 14.0, 2.6, 0.3, 1), intBlk, T(dx - doorW / 2 + 2.0, 0, -1.8));
  dk.build(doorPivot);

  return {
    core, top, bottom, door: doorPivot, doorRestZ: zShellBack - 0.2, prismGroup, dofButton, mirrorPivot, subMirrorPivot,
    mluLever, backupLever, memLockBtn, finderLatches, illuminatorBtn, eyeShutterLever, eyeBlind,
    selfTimerLever, powerCollar, multExpLever, asaCollar,
    curtain1Cloth, curtain1Lath, curtain2Cloth, curtain2Lath,
    sprocket, takeup, filmCart, filmStrip, filmTex, ledMat,
    dial, dialMeshes, release, releaseMeshes, lever, leverMeshes, rwSpin, rwCrankPivot, rwTipPivot,
    screenMat, eyeScreen, eyepieceMeshes, ctrCv, ctrTex,
  };
}

// ───────── Nikon AI-S F-Mount Lens Builder (with Rabbit-Ears Coupling Prong & Color-Coded Aperture Scale!) ─────────
function buildLens(lib, lens, hov) {
  const def = lensDef(lens), group = new THREE.Group();
  const bk = lib.get('lensBlack'), chrome = lib.get('chromeBright'), steel = lib.get('steel'), intBlk = lib.get('interiorBlack'), flock = lib.get('flock');
  const atlas = lensAtlas(lens);
  const eng = (h) => lib.prepare(new THREE.MeshPhysicalMaterial({ name: `f3LensEng_${lens.id}`, color: 0xffffff, map: atlas, metalness: 0.14, roughness: 0.40 }), { hover: h, wear: 'paint' });
  const oSpec = lensOpticsFor(lens);
  const lensGlassU = {
    blades: def.blades || 7,
    optics: { value: new THREE.Vector4(Math.min(15.0, def.glassR * 0.86), 1.0, def.glassR, 13.0) },
    state: { value: new THREE.Vector4(0, oSpec.pupilMag ?? 1.0, 0, 0) },
    ghostA: { value: new THREE.Color(...(oSpec.ghostTintA || [0.32, 0.74, 0.48])) },
    ghostB: { value: new THREE.Color(...(oSpec.ghostTintB || [0.80, 0.46, 0.24])) },
  };
  const glassMat = lib.prepare(lib.base.glass.clone(), { lensGlass: lensGlassU });

  const L = def.L;
  const fixed = new Kit();
  // Stainless F-mount rear ring + iconic scalloped silver mounting grip ring (n=36, segs=288!) + silver DoF band
  fixed.add(revolve([[def.rMount - 2.2, 0], [def.rMount - 0.6, -0.8, 0.3], [def.rMount - 0.6, -2.0]], { segs: 96, crease: 30 }), chrome);
  fixed.add(revolve([[def.rAp, -10.8], [def.rAp + 0.55, -11.2, 0.35, 1], [def.rAp + 0.55, -13.6, 0.35, 1], [def.rAp, -14.0]], { segs: 288, crease: 28, ribs: { n: 36, depth: 0.30, groove: 0.48, edge: 0.16 } }), chrome);
  fixed.add(bandRow(revolve([[def.rAp, -17.8], [def.rAp, -13.8]], { segs: 96, uv: 'band' }), 1), eng(null));
  // Raised red Infrared (R) focus index dot flanking the central DoF mark + black mounting dot on scalloped chrome grip
  fixed.add(new THREE.SphereGeometry(0.52, 12, 10), lib.get('red'), radialT(7.5 * DEG, def.rAp + 0.05, -16.8));
  fixed.add(new THREE.SphereGeometry(0.65, 12, 10), bk, radialT(0, def.rAp + 0.45, -12.4));
  const rearBaf = new THREE.RingGeometry(14.6, def.rMount - 2.4, 48); rearBaf.translate(0, 0, -1.8);
  fixed.add(rearBaf, intBlk);
  fixed.add(new THREE.CircleGeometry(15.0, 48), intBlk, T(0, 0, -4.6));
  fixed.add(revolve([[0, -2.0], [8.2, -2.5], [14.6, -3.6]], { segs: 40 }), lib.get('innerGlass'));
  fixed.build(group);

  // Color-Coded AI-S Aperture Ring + Signature Chrome "Rabbit-Ears" Meter Coupling Prong (AI50F14S.JPG!)
  const aperture = new THREE.Group(); group.add(aperture);
  const ak = new Kit(), aMat = lib.get('lensBlack', { hover: hov.aperture });
  ak.add(revolve([[def.rAp - 0.3, -2.0], [def.rAp + 0.35, -2.4, 0.35, 1], [def.rAp + 0.35, -4.8, 0.35, 1], [def.rAp, -5.2]], { segs: 480, ribs: { n: 60, depth: 0.30, groove: 0.48, edge: 0.16 } }), aMat);
  ak.add(bandRow(revolve([[def.rAp, -10.8], [def.rAp, -5.0]], { segs: 96, uv: 'band' }), 2), eng(hov.aperture));
  // Iconic stainless steel "rabbit ears" meter coupling shoe at 12 o'clock (with notched fork & 2 miniature Phillips screws!)
  const prong = new THREE.Shape();
  prong.moveTo(-6.0, 0); prong.lineTo(6.0, 0); prong.lineTo(5.2, 4.4);
  prong.lineTo(1.8, 4.4); prong.lineTo(1.2, 1.4); prong.lineTo(-1.2, 1.4);
  prong.lineTo(-1.8, 4.4); prong.lineTo(-5.2, 4.4); prong.closePath();
  ak.add(slab(prong, 1.1, 0.2, 16, 0.5, 2), chrome, T(0, def.rAp - 0.2, -6.5));
  [-3.4, 3.4].forEach((sx) => addScrew(ak, steel, ak, flock, T(sx, def.rAp + 1.0, -5.42, 0, 0, 0), 0.72, true, 0.25));
  // Signature Nikon AI-S miniature orange minimum-aperture lock tab + tiny silver release pin on aperture ring
  ak.add(rbox(2.2, 3.4, 0.9, 0.22, 2), lib.get('orange'), radialT(-132 * DEG, def.rAp + 0.12, -8.0));
  ak.add(revolve([[0.85, 0], [0.85, 0.75, 0.16], [0.55, 0.9], [0, 0.9]], { segs: 20 }), chrome, radialT(-125 * DEG, def.rAp + 0.05, -8.0));
  const apertureMeshes = ak.build(aperture, 'aperture');

  // Wide AI-S True 3D Multi-Row Checkerboard Waffle Rubber Focusing Ring (n=72, segs=576!) + Orange ft / White m Distance Scale
  const focus = new THREE.Group(); group.add(focus);
  const fk = new Kit(), fMat = lib.get('knurl', { hover: hov.focus });
  const zF0 = -18.0;
  const zF1 = def.builtInHood ? -(L - def.hoodLen - 1.2) : def.profile === 'flare' ? -(L - 12.0) : def.profile === 'stepped' ? -(L - 13.0) : -Math.max(30.0, L - 6.5);
  fk.add(bandRow(revolve([[def.rFocus - 0.5, zF0 - 5.6], [def.rFocus - 0.5, zF0]], { segs: 120, uv: 'band' }), 0), eng(hov.focus));
  const zW0 = zF0 - 5.6, wSpan = zW0 - zF1, wRows = wSpan > 16.0 ? 4 : wSpan > 9.5 ? 3 : 2;
  const wProf = [[def.rFocus - 0.3, zW0]];
  for (let b = 0; b < wRows; b++) {
    const zb0 = lerp(zW0, zF1, b / wRows), zb1 = lerp(zW0, zF1, (b + 1) / wRows);
    wProf.push([def.rFocus + 0.4, zb0 - (b === 0 ? 0.52 : 0.32), 0.35, 1], [def.rFocus + 0.4, zb1 + (b === wRows - 1 ? 0.52 : 0.32), 0.35, 1]);
    if (b < wRows - 1) wProf.push([def.rFocus - 0.25, zb1, 0.16]);
  }
  wProf.push([def.rFocus - 0.3, zF1]);
  fk.add(revolve(wProf, { segs: 576, ribs: { n: 72, depth: 0.46, groove: 0.46, edge: 0.18 } }), fMat);
  fk.add(revolve([[def.rFocus - 0.35, zW0 + 0.1], [def.rFocus - 0.02, zW0 - 0.05], [def.rFocus - 0.02, zW0 - 0.48], [def.rFocus - 0.35, zW0 - 0.58]], { segs: 96, crease: 26 }), bk);
  if (def.profile === 'portrait' || def.profile === 'tele135' || def.profile === 'stepped') {
    const rTrim = def.builtInHood ? def.rFocus - 0.35 : def.rFront + 0.25;
    fk.add(revolve([[rTrim, zF1 + 0.3], [rTrim + 0.35, zF1, 0.2], [rTrim + 0.35, zF1 - 1.1, 0.2], [rTrim - 0.1, zF1 - 1.3]], { segs: 96, crease: 26 }), chrome);
  }
  const focusMeshes = fk.build(focus, 'focus');

  // Extending Front Barrel, 52 mm Filter Threads, Per-Lens Sculpted Taper & NIC Multi-Coated Meniscus Front Glass (Law #27!)
  const ext = new THREE.Group(); group.add(ext);
  const ek = new Kit();
  const rInnerFace = Math.min(def.thread - 3.6, def.glassR + (def.funnelPad ?? 0.3));
  if (def.profile === 'flare') {
    // 24mm f/2.8 CRC narrow waist widening smoothly into a flared retrofocus bell w/ chrome accent ring
    ek.add(revolve([
      [def.thread, -L], [def.rFront - 0.7, -L, 0.5], [def.rFront, -L + 0.9, 0.5], [def.rFront, -L + 6.2, 0.35],
      [def.rFocus - 0.5, zF1 + 1.2, 0.45], [def.rFocus - 1.5, zF1 + 2.0],
    ], { segs: 96, crease: 30 }), bk);
    ek.add(revolve([[def.rFront + 0.05, -L + 6.0], [def.rFront + 0.28, -L + 6.3, 0.2], [def.rFront + 0.28, -L + 7.1, 0.2], [def.rFront - 0.15, -L + 7.4]], { segs: 96, crease: 26 }), chrome);
  } else if (def.profile === 'crc28') {
    // 28mm f/2.8 0.2m CRC broad rubber grip stepping cleanly inward into compact nose
    ek.add(revolve([
      [def.thread, -L], [def.rFront - 0.75, -L, 0.5], [def.rFront, -L + 0.9, 0.5], [def.rFront, zF1 + 1.2, 0.35],
      [def.rFocus - 0.6, zF1 + 2.0],
    ], { segs: 96, crease: 30 }), bk);
  } else if (def.profile === 'stepped') {
    // 35mm f/2 slender documentary two-step front barrel
    ek.add(revolve([
      [def.thread, -L], [def.rFront - 0.7, -L, 0.5], [def.rFront, -L + 0.9, 0.5], [def.rFront, -L + 7.5, 0.35],
      [def.rFront + 1.1, -L + 9.2, 0.4], [def.rFront + 1.1, zF1 + 0.8], [def.rFocus - 1.4, zF1 + 2.0],
    ], { segs: 96, crease: 30 }), bk);
  } else if (def.profile === 'portrait') {
    // 85mm f/2 compact portrait tapered bell + bold front chrome hairline trim
    ek.add(revolve([
      [def.thread, -L], [def.rFront - 0.75, -L, 0.55], [def.rFront, -L + 1.0, 0.55], [def.rFront, -L + 7.6, 0.4],
      [def.rFocus - 0.4, zF1 + 0.8, 0.4], [def.rFocus - 1.5, zF1 + 2.0],
    ], { segs: 96, crease: 30 }), bk);
  } else {
    // 50mm f/1.4 (locked exact envelope!), 105mm f/2.5 & 135mm f/2.8 inner barrels (clad by permanently-parked sliding hoods!)
    ek.add(revolve([[def.thread, -L], [def.rFront - 0.7, -L, 0.5], [def.rFront, -L + 0.9, 0.5], [def.rFront, zF1 + 1.0], [def.rFocus - 1.5, zF1 + 2.0]], { segs: 96, crease: 30 }), bk);
  }
  // Exposed bright machined aluminum filter-mouth rim chamfer + stepped 52 mm internal filter threads
  ek.add(revolve([[def.thread - 0.08, -L + 0.24], [def.thread + 0.34, -L + 0.02]], { segs: 96 }), steel);
  const thrProf = [];
  for (let i = 0; i < 6; i++) {
    const zt = -L + 0.6 + i * 0.52;
    thrProf.push([def.thread, zt], [def.thread - 0.35, zt + 0.24], [def.thread, zt + 0.48]);
  }
  ek.add(revolve(thrProf, { segs: 84, crease: 20 }), intBlk);
  if (!def.builtInHood) {
    [-90, 90].forEach((a) => addScrew(ek, steel, ek, flock, radialT(a * DEG, def.rFront - 0.04, -L + 3.2), 0.70, false, 0.2));
  }
  const ring = new THREE.RingGeometry(rInnerFace, def.thread - 0.2, 84); ring.rotateY(Math.PI);
  const rPos = ring.attributes.position;
  for (let i = 0; i < rPos.count; i++) {
    const r = Math.hypot(rPos.getX(i), rPos.getY(i));
    const u = Math.max(0, Math.min(1, (r - rInnerFace) / Math.max(0.1, def.thread - 0.2 - rInnerFace)));
    rPos.setZ(i, lerp(-L + 3.8, -L + 2.1, u));
  }
  ring.computeVertexNormals();
  ek.add(ring, lib.prepare(new THREE.MeshPhysicalMaterial({ name: `f3Front_${lens.id}`, map: frontRingTex(lens, def), metalness: 0.14, roughness: 0.38 }), {}));
  // Concentric stepped matte-black funnel on deeper-recessed wide lenses (28/2.8 CRC & 35/2!) vs crisp retaining bevel on luminous eyes
  const funnelGap = rInnerFace - def.glassR;
  const zGlassEdge = funnelGap >= 1.1 ? -L + 5.8 : -L + 4.0;
  if (funnelGap >= 1.1) {
    const bafProf = [];
    for (let i = 0; i < 3; i++) {
      const rA = lerp(rInnerFace, def.glassR + 0.2, i / 3), rB = lerp(rInnerFace, def.glassR + 0.2, (i + 1) / 3);
      const zA = lerp(-L + 3.8, zGlassEdge, i / 3), zB = lerp(-L + 3.8, zGlassEdge, (i + 1) / 3);
      bafProf.push([rA, zA], [rA - 0.28, zB], [rB, zB]);
    }
    ek.add(revolve(bafProf, { segs: 72, crease: 20 }), intBlk);
  } else {
    ek.add(revolve([[rInnerFace + 0.1, -L + 3.75], [def.glassR + 0.35, -L + 3.45, 0.15], [def.glassR + 0.1, zGlassEdge]], { segs: 84 }), bk);
  }
  // Dual opposing front retaining-ring spanner-wrench notches (180° apart!)
  [-1, 1].forEach((s) => ek.add(rbox(1.45, 0.56, 0.52, 0.08, 1), intBlk, T(s * (rInnerFace + 0.42), 0, -L + 3.60)));
  ek.add(new THREE.CircleGeometry(def.glassR + 0.3, 48), intBlk, T(0, 0, zGlassEdge + 0.9, 0, Math.PI, 0));
  ek.build(ext);
  // Standalone local-origin glass mesh (Law #17: LENS_GLASS_GLSL local-origin invariant!)
  const glassMesh = new THREE.Mesh(prep(revolve([[0, zGlassEdge - 1.5], [def.glassR * 0.45, zGlassEdge - 1.1], [def.glassR * 0.8, zGlassEdge - 0.5], [def.glassR + 0.2, zGlassEdge]], { segs: 64 })), glassMat);
  ext.add(glassMesh);

  // Lazy 3D Stainless Nikon F AI-S Rear Bayonet Hardware (built when detached / exploded — Law #27!)
  const rearMount = new THREE.Group(); rearMount.visible = false; group.add(rearMount);
  let rearBuilt = false;
  const ensureRear = () => {
    if (rearBuilt) return false;
    rearBuilt = true;
    const rk = new Kit(), steel = lib.get('steel'), flock = lib.get('flock'), anod = lib.get('anod');
    const rearGlassMat = lib.prepare(new THREE.MeshPhysicalMaterial({ name: `f3RearGlass_${lens.id}`, color: 0x0b1f1c, metalness: 0.14, roughness: 0.03, clearcoat: 1.0, clearcoatRoughness: 0.02, specularIntensity: 1.0, envMapIntensity: 1.75 }), {});
    const arcSector = (rIn, rOut, a0, a1) => {
      const s = new THREE.Shape(); s.absarc(0, 0, rOut, a0, a1, false); s.absarc(0, 0, rIn, a1, a0, true); s.closePath(); return s;
    };
    // Machined stainless Nikon F bayonet flange plate (z = 0..+1.4 mm) + 5 Phillips flange screws + signature AI-S scoop!
    rk.add(revolve([[20.8, 0.0], [29.2, 0.0], [29.2, 1.2, 0.25], [28.4, 1.4], [21.0, 1.4], [21.0, 0.2]], { segs: 84, crease: 28 }), steel);
    [18, 90, 162, 234, 306].forEach((a) => addScrew(rk, chrome, rk, flock, T(Math.cos(a * DEG) * 26.5, Math.sin(a * DEG) * 26.5, 1.42), 0.92, true, 0.3));
    // Signature Nikon AI-S milled semicircular focal-length/speed scoop notch at +54° on stainless flange
    const scA = 54 * DEG;
    rk.add(revolve([[2.1, 0], [2.1, 0.22], [0, 0.22]], { segs: 24 }), flock, T(Math.cos(scA) * 26.9, Math.sin(scA) * 26.9, 1.38));
    // Undercut bayonet throat + 3 wide watertight beveled stainless Nikon F bayonet wings (z = +2.85..+4.55 mm w/ 1.45 mm shadow gap!)
    rk.add(revolve([[20.6, 1.35], [21.6, 1.35], [21.6, 3.0], [20.6, 3.0]], { segs: 72, crease: 26 }), anod);
    [0, 120, 240].forEach((a0) => {
      rk.add(slab(arcSector(20.8, 25.2, (a0 - 27) * DEG, (a0 + 27) * DEG), 1.7, 0.22, 24, 0.45, 2), chrome, T(0, 0, 2.85));
    });
    // Black milled AI meter-coupling ridge step on outer rear aperture ring skirt (watertight slab arc!)
    rk.add(slab(arcSector(29.2, 31.0, 65 * DEG, 152 * DEG), 3.0, 0.2, 24, 0.4, 2), bk, T(0, 0, -1.8));
    // Matte-black inner rear shroud + watertight curved protective rear guard fin flanking the stop-down lever
    rk.add(revolve([[15.0, 0.2], [20.8, 0.2], [20.8, 4.6, 0.3], [15.6, 5.2], [14.6, 4.2]], { segs: 72, crease: 28 }), intBlk);
    rk.add(slab(arcSector(15.2, 17.8, -135 * DEG, -40 * DEG), 3.8, 0.25, 24, 0.4, 2), intBlk, T(0, 0, 4.3));
    // Protruding bright stainless Nikon F Stop-Down Aperture Coupler Lever (-88°, z = +1.6..+8.0 mm)
    const levA = -88 * DEG;
    rk.add(rbox(1.5, 4.8, 6.8, 0.35, 2), chrome, T(Math.cos(levA) * 19.0, Math.sin(levA) * 19.0, 4.9, 0, 0, levA));
    // Outward-facing (+Z) glossy NIC multi-coated convex rear optical element (r descending -> nz > 0!)
    rk.add(revolve([[15.2, 2.6], [14.4, 2.9], [14.4, 2.0]], { segs: 48 }), anod);
    rk.add(new THREE.CircleGeometry(14.6, 48), intBlk, T(0, 0, 1.3));
    rk.add(revolve([[14.6, 2.25], [12.8, 2.9], [7.5, 4.15], [0, 4.65]], { segs: 48 }), rearGlassMat);
    rk.build(rearMount);
    return true;
  };

  // Lazy cutaway optical elements (F3_OPTICS)
  const inner = new THREE.Group(); inner.visible = false; ext.add(inner);
  let innerBuilt = false;
  const ensureInner = () => {
    if (innerBuilt) return false;
    innerBuilt = true;
    const ik = new Kit(), spec = F3_OPTICS[lens.id] || F3_OPTICS['ais-50-1.4'];
    const gInner = lib.get('innerGlass'), rimBlack = lib.get('anod');
    const zStart = -L + 5.2, zEnd = -3.8;
    spec.forEach(([zf, rf, th, R1, R2]) => {
      const z0 = lerp(zStart, zEnd, zf), r = Math.max(6.5, def.glassR * rf);
      const sag1 = (r * r) / (2 * R1 * r * 1.45), sag2 = (r * r) / (2 * R2 * r * 1.45);
      const prof = [];
      for (let i = 0; i <= 8; i++) { const u = i / 8, rr = r * u; prof.push([rr, z0 - th * 0.5 + sag1 * u * u]); }
      for (let i = 8; i >= 0; i--) { const u = i / 8, rr = r * u; prof.push([rr, z0 + th * 0.5 + sag2 * u * u]); }
      ik.add(revolve(prof, { segs: 48 }), gInner);
      ik.add(revolve([[r, z0 - th * 0.5 + sag1], [r + 0.7, z0 - th * 0.5 + sag1], [r + 0.7, z0 + th * 0.5 + sag2], [r, z0 + th * 0.5 + sag2]], { segs: 48 }), rimBlack);
    });
    const zIris = lerp(zStart, zEnd, 0.50);
    ik.add(revolve([[def.glassR * 0.4, zIris - 0.5], [def.rFront - 2.0, zIris - 0.5], [def.rFront - 2.0, zIris + 0.5], [def.glassR * 0.4, zIris + 0.5]], { segs: 48 }), lib.get('blade'));
    ik.build(inner);
    return true;
  };

  // Lens hood: REAL permanently-parked telescoping metal sleeve on AI-S 105/2.5 & 135/2.8 (slides smoothly forward on hoodOn!), lazy 52 mm hood on shorter primes!
  const hoodGroup = new THREE.Group(); hoodGroup.visible = Boolean(def.builtInHood); ext.add(hoodGroup);
  let hoodBuilt = false;
  const ensureHood = () => {
    if (hoodBuilt) return false;
    hoodBuilt = true;
    const hk = new Kit(), hl = def.hoodLen || 21.0;
    if (def.builtInHood) {
      const rOut = def.rFront + 1.8, rIn = def.rFront + 0.25;
      const zBack = -L + hl, zFront = -L + 0.4;
      // Iconic Nikon AI-S sliding anodized metal hood w/ front knurled pull band, satin chrome accent & flocked matte inner baffle
      hk.add(revolve([
        [rIn, zFront], [rOut - 0.5, zFront, 0.35], [rOut, zFront + 0.6, 0.35],
        [rOut + 0.25, zFront + 1.2, 0.3, 1], [rOut + 0.25, zFront + 6.4, 0.3, 1],
        [rOut, zFront + 7.0, 0.3], [rOut, zBack - 0.6, 0.35], [rIn, zBack],
      ], { segs: 480, crease: 28, ribs: { n: 80, depth: 0.34, groove: 0.48, edge: 0.16 } }), bk);
      hk.add(revolve([[rIn, zBack], [rIn, zFront + 0.5]], { segs: 84 }), intBlk);
      hk.add(revolve([[rOut + 0.04, zFront + 0.4], [rOut + 0.14, zFront + 0.6, 0.15], [rOut + 0.14, zFront + 1.1, 0.15], [rOut, zFront + 1.25]], { segs: 84 }), chrome);
    } else {
      const rB = def.rFront + 0.6, rT = rB + hl * 0.25;
      hk.add(revolve([[rT - 0.6, -L - hl], [rT, -L - hl + 0.5, 0.5], [rB + 0.4, -L + 2.2], [rB - 0.8, -L + 2.2], [rT - 1.2, -L - hl + 0.8], [rT - 0.6, -L - hl]], { segs: 84, crease: 30 }), lib.get('anod'));
    }
    hk.build(hoodGroup);
    return true;
  };
  if (def.builtInHood) ensureHood();

  // Lazy 52 mm screw-in optical filter (n=64, segs=512!)
  const filterGroup = new THREE.Group(); filterGroup.visible = false; ext.add(filterGroup);
  const filterMat = new THREE.MeshPhysicalMaterial({ name: `f3Filter_${lens.id}`, color: 0xffffff, roughness: 0.03, transparent: true, opacity: 0.34, depthWrite: false });
  lib.prepare(filterMat, {});
  const filterMeshes = [];
  let filterBuilt = false;
  const ensureFilter = () => {
    if (filterBuilt) return false;
    filterBuilt = true;
    const flk = new Kit(), ft = def.thread;
    flk.add(revolve([[ft - 0.6, -L - 4.8], [ft + 1.0, -L - 4.8, 0.4, 1], [ft + 1.0, -L - 0.4, 0.4, 1], [ft - 0.6, -L], [ft - 0.6, -L + 1.2]], { segs: 512, crease: 30, ribs: { n: 64, depth: 0.22 } }), lib.get('anod', { hover: hov.filter }));
    flk.add(new THREE.CircleGeometry(ft - 1.0, 48), filterMat, T(0, 0, -L - 3.0, 0, Math.PI, 0));
    filterMeshes.push(...flk.build(filterGroup, 'filter'));
    return true;
  };

  return { group, lens, def, L, lensGlassU, glassMesh, rearMount, pupilMag: oSpec.pupilMag ?? 1.0, focalMm: oSpec.focalCalMm || lens.focalLength || 50, focus, aperture, ext, inner, hoodGroup, filterGroup, filterMat, ensureRear, ensureInner, ensureHood, ensureFilter, focusMeshes, apertureMeshes, filterMeshes };
}

// ───────── The Camera Factory ─────────
const PARTS = ['focus', 'aperture', 'shutter', 'filter', 'crank', 'release', 'finder', 'aim', 'roll'];

export function createCameraF3({ lens }) {
  const t0 = performance.now();
  const clipPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 1e7);
  const base = baseMaterials();
  const P = (o) => new THREE.MeshPhysicalMaterial(o);
  const BB = beadBlastMaps(), VL = vulcaniteMaps();
  // True 1982 Nikon F3 baked satin-black lacquer over forged copper-silumin/brass (deep jet black in top/bottom orthos + rich rolled brass specular in 3/4!)
  base.satinBlackBody = P({ name: 'f3SatinBlackBody', color: 0x030305, metalness: 0.14, roughness: 0.24, roughnessMap: BB.rgh, normalMap: BB.nrm, normalScale: new THREE.Vector2(0.09, 0.09), clearcoat: 0.36, clearcoatRoughness: 0.22, envMapIntensity: 0.54 });
  base.satinBlackBody.userData.wear = 'blackChrome';
  // High-relief jet-black pebbled Nikon vulcanite leatherette (deep matte crevices + glossy pebble tips, zero dusty-grey rubber wash!)
  base.leather = P({ name: 'f3Vulcanite', color: 0x08080a, map: VL.mac, roughness: 0.46, diffuseRoughness: 0.44, roughnessMap: VL.rgh, normalMap: VL.nrm, normalScale: new THREE.Vector2(1.90, 1.90), specularIntensity: 0.65, sheen: 0.06, sheenRoughness: 0.65, sheenColor: 0x16161a });
  base.leather.userData.wear = 'leather';
  base.de3Leather = base.leather.clone();
  base.de3Leather.name = 'f3De3Leather';
  base.de3Leather.color.setHex(0x050507);
  base.de3Leather.roughness = 0.56;
  base.de3Leather.envMapIntensity = 0.42;
  // Smooth satin-matte vulcanized Giugiaro front ergonomic grip rubber (tactile contrast vs lacquered brass & pebbled vulcanite!)
  base.gripRubber = P({ name: 'f3GripRubber', color: 0x0b0b0e, metalness: 0.0, roughness: 0.70, roughnessMap: BB.rgh, normalMap: BB.nrm, normalScale: new THREE.Vector2(0.24, 0.24), specularIntensity: 0.32 });
  base.blackEnamel = P({ name: 'f3BlackEnamel', color: 0x040406, metalness: 0.22, roughness: 0.16, roughnessMap: BB.rgh, normalMap: BB.nrm, normalScale: new THREE.Vector2(0.06, 0.06), clearcoat: 0.72, clearcoatRoughness: 0.14, envMapIntensity: 0.88 });
  base.blackEnamel.userData.wear = 'blackChrome';
  // Signature Giugiaro crimson-red inlaid grip accent stripe (#c8241c)
  base.giugiaroRed = P({ name: 'f3GiugiaroRed', color: 0xc8241c, metalness: 0.04, roughness: 0.26, clearcoat: 0.65, clearcoatRoughness: 0.14 });
  // Law #18: Dead-flat light-absorbing interior black (specularIntensity: 0.0!)
  base.interiorBlack = P({ name: 'f3InteriorBlack', color: 0x020203, metalness: 0.0, roughness: 0.98, specularIntensity: 0.0, envMapIntensity: 0.04 });
  // Quilted vertically-corrugated black titanium foil shutter curtain
  base.curtain = P({ name: 'f3TitaniumCurtain', map: titaniumCurtainTex(), roughness: 0.72, metalness: 0.25, specularIntensity: 0.08, envMapIntensity: 0.14, side: THREE.DoubleSide });
  base.pressurePlate = P({ name: 'f3PressurePlate', color: 0x060608, roughness: 0.72, metalness: 0.04, clearcoat: 0.0, specularIntensity: 0.14, envMapIntensity: 0.16 });
  const lib = new MatLib(base, [clipPlane]);
  const hov = {};
  PARTS.forEach((name) => { hov[name] = { name, amount: { value: 0 }, color: { value: new THREE.Color(1.0, 0.82, 0.5).multiplyScalar(0.28) }, target: 0 }; });

  const root = new THREE.Group();
  root.name = 'camera503';
  root.userData.kind = 'f3';
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
    mm, body.core, body.top, body.bottom, body.door, body.prismGroup, body.dofButton, body.mirrorPivot, body.subMirrorPivot,
    body.mluLever, body.backupLever, body.memLockBtn, body.finderLatches, body.illuminatorBtn, body.eyeShutterLever, body.eyeBlind,
    body.selfTimerLever, body.powerCollar, body.multExpLever, body.asaCollar,
    body.curtain1Cloth, body.curtain1Lath, body.curtain2Cloth, body.curtain2Lath,
    body.sprocket, body.takeup, body.filmCart, body.filmStrip,
    body.dial, body.release, body.lever, body.rwSpin, body.rwCrankPivot, body.rwTipPivot,
    body.eyeScreen, lensMount, head.yawMM, head.pitchMM, head.rollMM, head.bubble, blob, ...lensDyn(L),
  ];
  const camLists = [body.dialMeshes, body.releaseMeshes, body.leverMeshes, body.eyepieceMeshes, head.aimMeshes, head.rollMeshes, ...lensLists(L)];
  mergeStaticRigid(root, { dynamic: new Set(camDyn), lists: camLists });
  // Law #24: All live-app camera meshes MUST live strictly on layer 1 (never photobomb taking lens on layer 0)!
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
    dofK: 0, dofT: 0, stopDown: 0, lever: 0, press: 0, mirrorK: 0, curtain1: 0, curtain2: 0,
    finderK: 0, finderLatchK: 0, doorK: 0, filmLoaded: true, filmPhase: 0, rewind: 0, crankOpen: 0, ledGlow: 0,
    mluK: 0, backupK: 0, memLockK: 0, multExpK: 0, selfTimerK: 0, eyeShutterK: 0, illuminatorK: 0, powerK: 0,
    isoRot: 0, compEv: 0,
    explodeK: 0, lensOut: 0, lensTwist: 0, hoodOn: false, filterId: 'none', polAngle: 90, snapRings: false,
  };
  let live = null, cutaway = false, lastCtr = null;

  function drawCounter(s) {
    const f = st.doorK > 0.15 ? 0 : (s?.frame ?? 1);
    if (f === lastCtr) return;
    lastCtr = f;
    const g = body.ctrCv.getContext('2d');
    // Authentic F3 blue-grey graduated curved frame counter sector w/ crisp upright white numeral & orange ticks (ks_f3c_07.jpg!)
    g.fillStyle = '#5a7882'; g.fillRect(0, 0, 256, 256);
    g.strokeStyle = '#d4e0e4'; g.lineWidth = 4;
    for (let y = 32; y <= 224; y += 32) { g.beginPath(); g.moveTo(18, y); g.lineTo(54, y); g.stroke(); }
    g.fillStyle = '#e8682c'; g.beginPath(); g.moveTo(14, 128); g.lineTo(38, 118); g.lineTo(38, 138); g.closePath(); g.fill();
    g.fillStyle = '#f6f8fa'; g.font = `800 84px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(f <= 0 ? 'S' : String(f), 132, 132);
    body.ctrTex.needsUpdate = true;
  }

  // Exact mapping from shutters.js 'nikon-f3' indices (0='8s'..15='1/2000') + A/B/T/X to DIAL_LABELS index (0='A'..18='X')!
  const SHUTTER_TO_DIAL = [15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 18, 5, 4, 3, 2, 1];
  function dialIndexFor(s) {
    const mode = s.shutterMode ?? s.shutter;
    if (mode === 'A' || mode === 'a' || s.shutterIdx === 'A' || s.shutterIdx === -1) return 0;
    if (mode === 'B' || s.bulb) return 16;
    if (mode === 'T' || s.time) return 17;
    if (mode === 'X') return 18;
    const shI = Math.max(0, Math.min(SHUTTER_TO_DIAL.length - 1, Math.round(s.shutterIdx ?? 11)));
    return SHUTTER_TO_DIAL[shI];
  }

  function ringTargets(s) {
    if (!s) return;
    const d = s.focus ?? 10000;
    st.focusT = focusAngle(L.lens, d);
    st.extT = helicoidExtensionMm(L.lens, d);
    const ap = L.lens.apertureStops, last = ap.length - 1;
    let N = typeof s.aperture === 'number' && s.aperture > 0 ? s.aperture : ap[0];
    N = Math.min(ap[last], Math.max(ap[0], N));
    let ai = last;
    for (let i = 0; i < last; i++) if (N <= ap[i + 1]) { ai = i + Math.log(N / ap[i]) / Math.log(ap[i + 1] / ap[i]); break; }
    st.apT = -ai * AP_STEP;
    st.dialT = dialIndexFor(s) * DIAL_STEP;
    st.dofT = s.stopDown ? 1 : 0;
    const iso = s.film?.iso ?? s.iso;
    if (typeof iso === 'number' && iso > 0) st.isoRot = Math.log2(iso / 400) * (TAU / 9);
    if (typeof s.evComp === 'number') st.compEv = s.evComp;
  }

  const tweens = [];
  const tween = (dur, fn, ease = easeInOut, key = null) => new Promise((res) => {
    if (key) { const i = tweens.findIndex((x) => x.key === key); if (i >= 0) { tweens[i].res(); tweens.splice(i, 1); } }
    tweens.push({ t: 0, dur: Math.max(1e-3, dur), fn, ease, res, key });
  });
  const animate = (prop, to, dur, ease = easeInOut) => { const from = st[prop]; return tween(dur, (k) => { st[prop] = lerp(from, to, k); }, ease, prop); };
  const hold = (ms) => tween(Math.max(1e-3, ms / 1000), () => {}, (u) => u);
  const smoothstep = (x, a, b) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

  function applyPose() {
    const e = st.explodeK;
    const fk = cutaway ? 0 : st.finderK;
    body.top.position.set(0, 42 * e, 0);
    // Authentic DE-3 removal (MAN p. 37): release latches pull back, finder slides rearward (+Z) clearing front brow, then lifts completely free!
    const fSlide = smoothstep(fk, 0.0, 0.35), fLift = smoothstep(fk, 0.22, 1.0);
    body.finderLatches.position.z = 3.6 * Math.max(st.finderLatchK || 0, smoothstep(fk, 0.0, 0.25));
    body.prismGroup.position.set(0, 64 * fLift + 28 * e, 11 * fSlide);
    body.bottom.position.set(0, -34 * e, 0);
    body.door.position.z = body.doorRestZ + 28 * e;
    body.door.rotation.y = lerp(0, 1.85, st.doorK);
    lensMount.position.z = DIM.flange - 58 * e - 34 * st.lensOut;
    lensMount.rotation.z = st.lensTwist * 1.05;
    L.focus.rotation.z = st.focusRot;
    L.ext.position.z = -st.ext;
    L.aperture.rotation.z = st.apRot;
    // Live AI-S automatic diaphragm: wide open at rest for bright viewing; stops smoothly down to set aperture on DoF preview (MAN p. 26) or fire()!
    {
      const ap = L.lens.apertureStops, last = ap.length - 1;
      const ai = Math.min(last, Math.max(0, -st.apRot / AP_STEP)), i0 = Math.min(last - 1, Math.floor(ai));
      const Nwork = ap[i0] * Math.pow(ap[i0 + 1] / ap[i0], ai - i0);
      const stopK = Math.max(0, Math.min(1, Math.max(st.dofK, st.mirrorK, st.stopDown || 0)));
      const apN = ap[0] * Math.pow(Nwork / ap[0], stopK);
      const rIris = Math.min(L.def.glassR * 0.86, Math.max(1.4, (L.focalMm / (2 * apN)) / L.pupilMag));
      L.lensGlassU.optics.value.x = rIris;
      L.lensGlassU.optics.value.y = 1.0;
      L.lensGlassU.state.value.w = Math.min(1, e * 1.4 + st.lensOut);
    }
    const rearVis = e > 0.001 || st.lensOut > 0.001;
    if (rearVis && L.ensureRear?.()) toLayer(L.rearMount);
    if (L.rearMount) L.rearMount.visible = rearVis;
    if (cutaway && L.ensureInner?.()) toLayer(L.inner);
    if (L.inner) L.inner.visible = cutaway;
    if (L.def.builtInHood) {
      L.hoodGroup.visible = true;
      L.hoodGroup.position.z = st.hoodOn ? -(L.def.hoodSlide || 32.0) : 0;
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
    body.selfTimerLever.rotation.y = -0.52 * (st.selfTimerK || 0);
    body.lever.rotation.y = -st.lever;
    body.powerCollar.rotation.y = 0.45 * (st.powerK || 0);
    body.multExpLever.rotation.y = -0.52 * (st.multExpK || 0);
    body.release.position.y = B.deck + 2.8 - 1.5 * st.press;
    body.dofButton.position.z = B.zF - 3.2 + 1.5 * st.dofK;
    body.mluLever.rotation.z = -1.15 * (st.mluK || 0);
    body.backupLever.rotation.x = 0.78 * (st.backupK || 0);
    body.memLockBtn.position.z = B.zF - 0.3 + 1.5 * (st.memLockK || 0);
    body.illuminatorBtn.position.x = 24.4 - 1.2 * (st.illuminatorK || 0);
    body.eyeShutterLever.rotation.z = -1.35 * (st.eyeShutterK || 0);
    body.eyeBlind.visible = (st.eyeShutterK || 0) > 0.45;
    body.asaCollar.rotation.y = (st.isoRot || 0) + (st.compEv || 0) * 0.24;
    const crankK = Math.max(st.doorK, st.crankOpen || 0);
    body.rwSpin.rotation.y = st.rewind;
    body.rwSpin.position.y = B.deck + 2.8 + 11.5 * st.doorK;
    body.rwCrankPivot.rotation.z = -0.62 * crankK;
    body.rwTipPivot.rotation.z = lerp(-Math.PI / 2, 0.0, crankK);
    const mirUp = Math.max(st.mirrorK, st.mluK || 0);
    body.mirrorPivot.rotation.x = lerp(-Math.PI / 4, 0, mirUp);
    // Secondary metering sub-mirror folds flat up against main mirror as mirror rises (Nikon Museum cutaway!)
    body.subMirrorPivot.rotation.x = lerp(0.88, 0.04, mirUp);
    // Horizontal quilted titanium focal-plane shutter curtains (1/80 s X-sync!)
    const k1 = Math.max(0, Math.min(1, st.curtain1)), k2 = Math.max(0, Math.min(1, st.curtain2));
    const x1 = lerp(-18.5, 18.5, k1), x2 = lerp(-18.5, 18.5, k2);
    body.curtain1Cloth.scale.x = Math.max(0.001, 1 - k1);
    body.curtain1Cloth.position.x = (x1 + 18.5) * 0.5;
    body.curtain1Cloth.visible = k1 < 0.995;
    body.curtain1Lath.position.x = x1;
    body.curtain2Cloth.scale.x = Math.max(0, Math.min(1, k2)) || 0.001;
    body.curtain2Cloth.position.x = (-18.5 + x2) * 0.5;
    body.curtain2Cloth.visible = k2 > 0.005;
    body.curtain2Lath.position.x = x2;
    body.sprocket.rotation.y = -st.filmPhase * TAU;
    body.takeup.rotation.y = -st.filmPhase * 0.68 * TAU;
    body.filmTex.offset.x = -st.filmPhase * 0.37;
    const showFilm = Boolean(st.filmLoaded);
    body.filmCart.visible = showFilm;
    body.filmStrip.visible = showFilm;
    body.ledMat.emissiveIntensity = 2.6 * st.ledGlow;
    drawCounter(live);
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
      anchor(lensMount, 0, 38, -L.L / 2, 'AI-S F-Mount Lens', `${L.lens.focalLength} mm ƒ/${L.lens.maxAperture} · color-coded aperture & coupling prong`),
      anchor(body.prismGroup, 0, B.prismY + 8, -12, 'DE-3 High-Eyepoint Finder', 'removable 100% prism · 25 mm eye relief · ADR aperture window'),
      anchor(body.dial, 0, 14, 0, 'Quartz Shutter Dial', '8 s – 1/2000 s, A, X (1/80), B, T · quilted titanium foil curtains'),
      anchor(body.mirrorPivot, 0, -6, -12, 'Dual-Mirror SPD Metering', '8% micro-perforated main mirror + secondary sub-mirror to floor SPD'),
      anchor(body.door, 0, 0, B.zB + 8, 'Removable 35 mm Back', 'stainless guide roller, MF-14 contacts & film-box memo holder'),
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
    setFinderOpen(on) { return animate('finderK', on ? 1 : 0, 0.55); },
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
      if (st.snapRings) { st.focusRot = st.focusT; st.ext = st.extT; st.apRot = st.apT; st.dial = st.dialT; st.dofK = st.dofT; st.snapRings = false; }
    },
    setHood(on) {
      st.hoodOn = Boolean(on); if (live) live.hoodOn = st.hoodOn;
      if (L.def.builtInHood) { L.hoodGroup.visible = true; L.hoodGroup.position.z = st.hoodOn ? -(L.def.hoodSlide || 32.0) : 0; }
      else { if (st.hoodOn && L.ensureHood?.()) toLayer(L.hoodGroup); L.hoodGroup.visible = st.hoodOn; L.hoodGroup.position.z = 0; }
    },
    setFilter(filterId, polAngle = st.polAngle) { st.filterId = filterId || 'none'; st.polAngle = polAngle; if (live) { live.filter = st.filterId; live.polAngle = polAngle; } if (st.filterId !== 'none' && L.ensureFilter?.()) { toLayer(L.filterGroup); refreshPickables(); } },
    get hoodOn() { return Boolean(st.hoodOn); },
    get hasHood() { return true; },
    filmOffset() {
      const ep = lensOpticsFor(L.lens).entrancePupilMm || 24.5;
      return mm.localToWorld(new THREE.Vector3(0, 0, DIM.flange - L.L - st.ext + ep)).distanceTo(mm.localToWorld(new THREE.Vector3(0, 0, 0)));
    },
    lensPose(pos, quat) {
      const ep = lensOpticsFor(L.lens).entrancePupilMm || 24.5;
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
      if (part === 'aperture') return Math.max(0, angle / AP_STEP);
      if (part === 'shutter') {
        const di = ((Math.round(-angle / DIAL_STEP) % DIAL_LABELS.length) + DIAL_LABELS.length) % DIAL_LABELS.length;
        const shI = SHUTTER_TO_DIAL.indexOf(di);
        return shI >= 0 ? shI : 11;
      }
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
      onSound('release');
      onMirror(true);
      await animate('mirrorK', 1, 0.045);
      const travelSec = 0.028; // F3 high-speed quilted titanium foil curtains (1/80 s X-sync!)
      if (seconds < 1 / 80) {
        const slitDelay = Math.max(0.003, (seconds / (1 / 80)) * travelSec);
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
      }, easeInOut, 'wind');
      await animate('lever', 0, 0.18);
      if (cut) setCutaway(false);
    },
    setCutaway(on, side = 1) { api.cutSide = side; setCutaway(on); },
    labelAt(obj) {
      let cur = obj;
      while (cur) {
        if (cur === lensMount) return { text: 'AI-S F-Mount Lens', sub: `${L.lens.focalLength} mm ƒ/${L.lens.maxAperture} · color-coded aperture & rabbit-ears coupling` };
        if (cur === body.prismGroup) return { text: 'DE-3 High-Eyepoint Finder', sub: 'interchangeable 100% pentaprism · 25 mm eye relief · ADR readout' };
        if (cur === body.dial) return { text: 'Quartz Shutter Speed Dial', sub: '8 s – 1/2000 s, A, X (1/80 s), B & T · titanium focal-plane shutter' };
        if (cur === body.lever) return { text: 'Film Advance Lever', sub: '140° Giugiaro lever · single or multi-stroke · cocks titanium curtains' };
        if (cur === body.release) return { text: 'Electromagnetic Release & Power', sub: 'coaxial ON/OFF red-dot switch & multiple exposure lever' };
        if (cur === body.rwSpin) return { text: 'Left Hot Shoe & Rewind Crank', sub: 'F3 accessory shoe, ASA/ISO, ±2 EV compensation & back-door lock' };
        if (cur === body.mirrorPivot) return { text: 'Dual-Mirror SPD Metering', sub: 'micro-perforated main mirror + folding sub-mirror feeding floor SPD' };
        if (cur === body.dofButton) return { text: 'DoF Preview & Mirror Lock-Up', sub: 'coaxial stop-down plunger inside mirror lock-up collar' };
        if (cur === body.door) return { text: 'Removable 35 mm Film Back', sub: 'pressure plate, stainless roller & centered film-box memo holder' };
        if (cur === body.top) return { text: 'F3 Top Deck & Type-K Bay', sub: 'interchangeable focusing-screen bay, ADR optics & curved frame counter' };
        if (cur === body.bottom) return { text: 'Baseplate & MD-4 Coupler', sub: '2×SR44 / 1×CR-1/3N battery lid, MD-4 cover, tripod bush & rewind clutch' };
        if (cur === body.core) return { text: 'Giugiaro Die-Cast F3 Chassis', sub: '46.5 mm F-mount, sculpted red-stripe grip, mechanical backup & SPD cell' };
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
      st.dofK += (st.dofT - st.dofK) * a;
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
