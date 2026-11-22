// The camera: an all-black 1976 Canon AE-1 35 mm SLR with breech-lock FD S.S.C. lenses, on the shared carbon tripod
// and 3-way head. Every part procedural, in millimetres, from lib/. Neutral GLASS WORKS legends; no maker's logos.
//
// Model axes (CONTRACT.md): lens axis along −Z, +X = photographer's right, +Y up. Origin: lens axis on the film plane.
// FD flange focal distance: 42.0 mm in front of the film (z = −42.0).
//
// Body dimensions (mm): 141.0 wide (−70.5..+70.5), 87.0 tall (bottom −38.5, top deck +24.5, pentaprism peak +48.5),
// 47.5 deep (front z = −35.5, back door z = +12.0).
import * as THREE from 'three';
import { INK, PAINT_BG } from '../../lib/engrave.js';
import { addScrew, radialT, rbox, revolve, rrPath, slab } from '../../lib/geometry.js';
import { MatLib, baseMaterials } from '../../lib/materials.js';
import { Kit, mergeStaticRigid, prep } from '../../lib/mesh.js';
import { buildHead, buildTripod } from '../../lib/rig.js';
import { DEG, FONT, T, TAU, easeInOut, lerp } from '../../lib/util.js';
import { lensOpticsFor, helicoidExtensionMm, filterOpticsFor } from '../../optics.js';
export { flushCameraTextures } from '../../lib/textures.js';

export const DIM = {
  flange: -42.0,
  // Calibrated directly to 5 mm grid measurements on Canon_AE-1_{front,top,back,bottom}.jpg (0.2 mm tolerance):
  // Chassis shell 140.0 mm wide (-65.2..+74.8), sleek 31.8 mm body (-28.4..+3.4) + protruding mirror box to FD flange -42.0.
  body: { x0: -65.2, x1: 74.8, y0: -30.8, baseY: -25.0, seamY: 16.4, deck: 37.5, prismY: 55.5, zF: -28.4, zB: 3.4 },
  eyepiece: { x: 0, y: 34.8, z: 5.4, w: 17.5, h: 12.0 },
  // Coaxial large r=14.0 mm low-profile silver-knurled shutter-speed/ASA dial & swept rear-edge crescent wind lever on +X
  dial: { x: 59.5, z: -12.0, r: 14.0, h: 3.6 },
  lever: { x: 59.5, z: -12.0, len: 35.0 },
  // Inboard shutter release + A/L/S collar
  release: { x: 38.2, z: -18.5, r: 7.8 },
  rewind: { x: -49.0, z: -11.5, r: 10.2 },
  socket: { x: 5.8, z: -17.5 },
  tripod: { apex: 1210, spread: 560 },
};
const B = DIM.body;
const AP_STEP = 16.5 * DEG;
const DIAL_STEP = TAU / 13;
const DIAL_LABELS = ['B', '2', '1', '2', '4', '8', '15', '30', '60', '125', '250', '500', '1000'];
const COC = 1 / 30;
const LEVER_STROKE = 120 * DEG;

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

// ───────── FD Breech-Lock S.S.C. Lens Definitions & Cutaway Prescriptions ─────────
const LENS_DEFS = {
  'fd-24-2.8':  { L: 53.0, focusPitch: 56 * DEG, blades: 6, rFront: 32.6, thread: 27.5, glassR: 20.2, rFocus: 32.0, rAp: 31.4, rBreech: 32.2, profile: 'flare',    coat: 'S.S.C.', serial: '148295', funnelPad: 0.4, hoodStyle: 'bay',   hoodLen: 14.0 },
  'fd-28-2.8':  { L: 49.0, focusPitch: 44 * DEG, blades: 5, rFront: 30.8, thread: 27.5, glassR: 16.8, rFocus: 32.2, rAp: 31.6, rBreech: 32.2, profile: 'compact',  coat: 'S.C.',   serial: '295841', funnelPad: 2.2, hoodStyle: 'bay',   hoodLen: 15.0 },
  'fd-35-2':    { L: 60.0, focusPitch: 36 * DEG, blades: 8, rFront: 31.6, thread: 27.5, glassR: 19.6, rFocus: 33.2, rAp: 31.8, rBreech: 32.2, profile: 'stepped',  coat: 'S.S.C.', serial: '104926', funnelPad: 0.4, concave: true, hoodStyle: 'bay', hoodLen: 18.0 },
  'fd-50-1.4':  { L: 49.0, focusPitch: 31 * DEG, blades: 8, rFront: 31.5, thread: 27.5, glassR: 21.0, rFocus: 32.8, rAp: 32.0, rBreech: 32.2, profile: 'standard', coat: 'S.S.C.', serial: '684219', funnelPad: 0.2, hoodStyle: 'bay',   hoodLen: 22.0 },
  'fd-85-1.8':  { L: 57.0, focusPitch: 24 * DEG, blades: 8, rFront: 32.8, thread: 27.5, glassR: 22.4, rFocus: 34.0, rAp: 31.6, rBreech: 32.2, profile: 'portrait', coat: 'S.S.C.', serial: '219408', funnelPad: 0.2, hoodStyle: 'bay',   hoodLen: 30.0 },
  'fd-135-2.8': { L: 88.0, focusPitch: 16 * DEG, blades: 6, rFront: 31.2, thread: 27.5, glassR: 22.4, rFocus: 33.0, rAp: 31.6, rBreech: 32.2, profile: 'tele',     coat: 'S.C.',   serial: '376512', funnelPad: 0.2, builtInHood: true, hoodStyle: 'slide', hoodLen: 37.5, hoodSlide: 34.0 },
};

const AE1_OPTICS = {
  'fd-24-2.8': [
    [0.07, 0.96, 3.2, 1.4, -0.95], [0.19, 0.80, 2.2, 2.2, -1.05], [0.32, 0.68, 4.2, 1.7, 3.8], [0.45, 0.58, 2.0, -2.1, 2.6],
    [0.58, 0.58, 1.8, -1.5, -4.4], [0.66, 0.64, 3.8, -4.4, 1.85], [0.78, 0.72, 2.6, 3.0, -2.8], [0.89, 0.78, 2.8, -2.4, 3.6], [0.96, 0.82, 2.6, 3.8, -3.0],
  ],
  'fd-28-2.8': [
    [0.08, 0.94, 3.0, 1.5, -1.0], [0.23, 0.78, 2.2, 2.5, -1.15], [0.38, 0.68, 4.0, 1.7, 3.6],
    [0.56, 0.62, 1.8, -1.6, -4.5], [0.65, 0.68, 3.6, -4.5, 1.9], [0.80, 0.74, 2.8, 3.2, -2.6], [0.93, 0.80, 2.6, -2.8, 4.0],
  ],
  'fd-35-2': [
    [0.08, 0.94, 2.6, -2.2, -1.1], [0.20, 0.84, 3.4, 1.9, -2.4], [0.34, 0.74, 2.8, 2.2, -1.5], [0.46, 0.66, 1.8, -1.8, 3.0],
    [0.60, 0.66, 1.8, -1.6, -4.8], [0.68, 0.72, 3.8, -4.8, 1.8], [0.79, 0.78, 2.8, 3.0, -3.2], [0.89, 0.82, 2.6, 2.4, -3.0], [0.96, 0.86, 2.8, 3.4, -2.8],
  ],
  'fd-50-1.4': [
    [0.09, 0.96, 4.4, 2.0, -3.6], [0.26, 0.86, 3.4, 1.8, -2.6], [0.41, 0.74, 1.8, 3.0, -1.4],
    [0.60, 0.74, 1.8, -1.45, 3.2], [0.675, 0.84, 4.2, 3.2, -2.0], [0.84, 0.88, 3.0, 2.6, -4.0], [0.94, 0.90, 3.2, 3.2, -3.0],
  ],
  'fd-85-1.8': [
    [0.08, 0.96, 4.8, 1.9, -3.8], [0.26, 0.86, 3.8, 1.8, -2.8], [0.42, 0.74, 2.0, -2.4, 1.6],
    [0.62, 0.72, 2.0, -1.7, 3.4], [0.76, 0.80, 4.0, 3.4, -2.2], [0.92, 0.84, 3.4, 2.8, -3.6],
  ],
  'fd-135-2.8': [
    [0.07, 0.96, 5.0, 2.0, -4.2], [0.18, 0.88, 2.6, -2.6, 1.9], [0.33, 0.76, 3.8, 2.6, -3.0],
    [0.54, 0.68, 2.2, -2.2, 2.6], [0.72, 0.64, 3.4, 3.0, -2.8], [0.88, 0.60, 2.8, -2.6, 3.4],
  ],
};

const lensDef = (lens) => LENS_DEFS[lens.id] || LENS_DEFS['fd-50-1.4'];
const focusPitch = (lens) => lensDef(lens).focusPitch;
const focusAngle = (lens, d) => -focusPitch(lens) * helicoidExtensionMm(lens, d);
function distanceAt(lens, angle) {
  const ext = Math.max(0, angle) / focusPitch(lens);
  if (ext < 1e-4) return 10000;
  let lo = lens.minFocusDistance, hi = 10000;
  for (let i = 0; i < 40; i++) { const mid = Math.sqrt(lo * hi); if (helicoidExtensionMm(lens, mid) > ext) lo = mid; else hi = mid; }
  return Math.sqrt(lo * hi);
}

// ───────── Engraved Atlases ─────────
function drawSpeedDial(cv, iso = 400) {
  const g = cv.getContext('2d');
  g.fillStyle = '#070709'; g.fillRect(0, 0, 512, 512);
  g.strokeStyle = '#d4d8de'; g.lineWidth = 7; g.beginPath(); g.arc(256, 256, 244, 0, TAU); g.stroke();
  // Recessed curved ASA cutout window positioned at 3 o'clock (+X, unobstructed by wind lever — matches Canon_AE-1_top.jpg!)
  g.save();
  g.translate(410, 256); g.rotate(Math.PI / 2);
  g.fillStyle = '#040405'; g.fillRect(-48, -25, 96, 50);
  g.strokeStyle = '#4c5058'; g.lineWidth = 3; g.strokeRect(-48, -25, 96, 50);
  g.fillStyle = '#3ad474'; g.font = `700 ${String(iso).length > 3 ? 28 : 34}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(String(iso), 0, 2);
  g.restore();
  DIAL_LABELS.forEach((lbl, i) => {
    const a = Math.PI / 2 - i * DIAL_STEP;
    const isSlow2 = lbl === '2' && i === 1;
    // AE-1 manual & Canon_AE-1_top.jpg: B and 2 s in orange; 1/60 X-sync and all other speeds in crisp white!
    const col = lbl === 'B' || isSlow2 ? '#f0942c' : '#fbfaf6';
    arcText(g, lbl, 256, 256, 192, a, lbl.length > 3 ? 30 : 36, col, 700);
  });
}

function speedDialTex(iso = 400) {
  const cv = canvas(512, 512);
  drawSpeedDial(cv, iso);
  const t = tex(cv);
  return { cv, tex: t };
}

function serialTex() {
  // Authentic crisp silver 7-digit top-left deck serial number (Canon_AE-1_top.jpg!)
  const cv = canvas(384, 96), g = cv.getContext('2d');
  g.clearRect(0, 0, 384, 96);
  g.fillStyle = '#d4d6dc'; g.font = `500 62px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('2811233', 192, 50);
  return tex(cv);
}

function selfTimerSTex() {
  const cv = canvas(96, 96), g = cv.getContext('2d');
  g.clearRect(0, 0, 96, 96);
  g.fillStyle = '#f2efe6'; g.font = `700 64px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('S', 48, 52);
  return tex(cv);
}

function bottomEmbossTex() {
  // Subtle debossed GLASS WORKS / JAPAN molding on bottom plate (Canon_AE-1_bottom.jpg!)
  const cv = canvas(320, 140), g = cv.getContext('2d');
  g.clearRect(0, 0, 320, 140);
  g.fillStyle = '#5a5e66'; g.font = `700 40px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('GLASS WORKS', 160, 44);
  g.font = `600 36px ${FONT}`; g.fillText('JAPAN', 160, 98);
  return tex(cv);
}

function prismBadgeTex() {
  const cv = canvas(512, 160), g = cv.getContext('2d');
  g.clearRect(0, 0, 512, 160);
  g.fillStyle = '#e8e6de'; g.font = `700 62px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('GLASS WORKS', 256, 82);
  return tex(cv);
}

function modelBadgeTex() {
  // Exact 1976 Canon AE-1 hollow-outlined Egyptian slab-serif logotype traced to sub-pixel precision
  // from Canon_AE-1_front.jpg (native lettering aspect 3.79:1, uniform 40-unit cap height y=13.5..53.5).
  const W = 1024, H = 288, cv = canvas(W, H), g = cv.getContext('2d');
  g.clearRect(0, 0, W, H);
  const s = W / 166.5; // maps design X=[7.0..173.5] -> [0..1024], Y=[10.08..56.92] -> [0..288]
  const tx = (x) => (x - 7.0) * s;
  const ty = (y) => (y - 33.5) * s + H / 2;
  const xAo = (y) => 34.4 - 0.478 * (y - 13.5);
  const xAi = (y) => xAo(y) + 12.65;
  const glyphs = [
    // Asymmetric slab-serif 'A': slanted left leg w/ wide foot serif, dead-vertical right pillar w/ top & bottom right serifs
    [[xAo(13.5), 13.5], [65.2, 13.5], [65.2, 19.7], [60.5, 19.7], [60.5, 47.3], [65.2, 47.3], [65.2, 53.5],
      [48.5, 53.5], [48.5, 38.6], [xAi(38.6), 38.6], [xAi(47.3), 47.3], [37.2, 47.3], [37.2, 53.5],
      [10.5, 53.5], [10.5, 47.3], [xAo(47.3), 47.3]],
    // Right-angled trapezoidal counter of 'A' (collinear left slope with lower inner leg)
    [[xAi(19.7), 19.7], [48.5, 19.7], [48.5, 31.2], [xAi(31.2), 31.2]],
    // Heavy slab-serif 'E' w/ overhanging left serifs, opposing top/bottom right vertical spurs, square middle bar
    [[76.2, 13.5], [118.2, 13.5], [118.2, 23.2], [112.0, 23.2], [112.0, 19.7], [93.0, 19.7], [93.0, 30.0],
      [104.3, 30.0], [104.3, 36.8], [93.0, 36.8], [93.0, 47.3], [112.0, 47.3], [112.0, 43.2], [118.2, 43.2],
      [118.2, 53.5], [76.2, 53.5], [76.2, 47.3], [81.0, 47.3], [81.0, 19.7], [76.2, 19.7]],
    // Outlined rectangular hyphen '-' centered on E's middle bar
    [[124.5, 29.8], [138.3, 29.8], [138.3, 37.2], [124.5, 37.2]],
    // Slab-serif '1' w/ flat top-left flag serif and wide symmetric rectangular base slab
    [[142.0, 13.5], [163.0, 13.5], [163.0, 47.3], [170.0, 47.3], [170.0, 53.5], [141.2, 53.5],
      [141.2, 47.3], [148.6, 47.3], [148.6, 19.8], [142.0, 19.8]],
  ];
  g.strokeStyle = '#f2efe4';
  g.lineWidth = 3.15 * s;
  g.lineJoin = 'miter';
  g.miterLimit = 6;
  glyphs.forEach((pts) => {
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(tx(x), ty(y)) : g.moveTo(tx(x), ty(y))));
    g.closePath();
    g.stroke();
  });
  const t = tex(cv);
  t.anisotropy = 8;
  return t;
}

function lensAtlas(lens, def) {
  const W = 4096, RH = 128, cv = canvas(W, RH * 4), g = cv.getContext('2d');
  g.fillStyle = PAINT_BG; g.fillRect(0, 0, W, cv.height);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const X = (phi) => ((((0.5 + phi / TAU) % 1) + 1) % 1) * W;
  const text = (row, phi, str, y, size, color, weight = 600) => {
    g.save(); g.translate(X(phi), row * RH + y * RH); g.scale(0.55, 1);
    g.font = `${weight} ${size}px ${FONT}`; g.fillStyle = color; g.textAlign = 'center'; g.fillText(str, 0, 0); g.restore();
  };
  const tick = (row, phi, y0, y1, wPx, color) => { g.fillStyle = color; g.fillRect(X(phi) - wPx / 2, row * RH + y0 * RH, wPx, (y1 - y0) * RH); };
  const ORANGE = '#e69a2b', GREEN = '#36b368';
  // Row 0: distance scale (feet orange top, metres white bottom)
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
  scale([Infinity, 30, 15, 10, 7, 5, 3.5, 2.5, 2, 1.5, 1.2, 1], 0.3048, 0.3, GREEN);
  scale([Infinity, 10, 5, 3, 2, 1.5, 1, 0.8, 0.6, 0.45, 0.3], 1, 0.72, INK.white);
  // Row 1: DoF index & stops
  const pitch = focusPitch(lens);
  tick(1, 0, 0.05, 0.85, 6, '#e04832');
  lens.apertureStops.filter((N) => N >= 4 && N <= 22).slice(0, 4).forEach((N) => {
    const a = Math.min(36 * DEG, pitch * N * COC);
    [-1, 1].forEach((s) => { tick(1, s * a, 0.08, 0.50, 4, INK.white); text(1, s * a, String(N), 0.76, 32, INK.white, 500); });
  });
  // Row 2: Aperture scale + green 'A' AE mark
  text(2, -AP_STEP * 1.15, 'A', 0.5, 50, GREEN, 800);
  lens.apertureStops.forEach((N, i) => text(2, i * AP_STEP, String(N), 0.5, 44, INK.white, 600));
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
  g.fillStyle = PAINT_BG; g.fillRect(0, 0, 1024, 1024);
  const rInner = Math.min(def.thread - 3.6, def.glassR + (def.funnelPad ?? 0.2));
  const rInPx = 512 * rInner / (def.thread - 0.2);
  const R = (rInPx + 506) / 2;
  // Crisp concentric machined hairline bezel rules framing the FD nameplate text
  g.strokeStyle = 'rgba(225,228,236,0.22)'; g.lineWidth = 2.5;
  [rInPx + 10, 496].forEach((rr) => { g.beginPath(); g.arc(512, 512, rr, 0, TAU); g.stroke(); });
  arcText(g, 'GLASS WORKS FD', 512, 512, R, Math.PI / 2 + 0.65, 38, INK.white, 600);
  arcText(g, `${lens.focalLength}mm 1:${lens.maxAperture}`, 512, 512, R, Math.PI / 2 - 0.65, 38, INK.white, 600);
  const coat = def.coat || 'S.S.C.';
  arcText(g, `${coat}   Ø${Math.round(def.thread * 2)}mm   ${def.serial || '684219'}`, 512, 512, R, -Math.PI / 2, 34, coat === 'S.S.C.' ? '#e69a2b' : '#dfe2e8', 600, true);
  return tex(cv);
}

// ───────── Smoothly Filleted Stadium-Chamfered Plan Shape (Canon_AE-1_top.jpg & Canon_AE-1_bottom.jpg 5 mm grids) ─────────
// Note: slab rotated by rx = -PI/2 maps shape (x, y) -> world (x, z = -y), so yFront = -zF, yBack = -zB.
function ae1PlanShape(x0, x1, zF, zB, inset = 0) {
  const lx = x0 + inset, rx = x1 - inset, yF = -zF - inset, yB = -zB + inset;
  const fChamXL = 11.2, fChamXR = 13.0, fChamY = 8.4; // exact asymmetric ~35° front corner chamfers
  const rBack = 13.5, rf = 2.4;                        // smooth stadium rear corners + softly filleted front chamfer transitions!
  const s = new THREE.Shape();
  s.moveTo(lx + rBack, yB);
  s.lineTo(rx - rBack, yB);
  s.quadraticCurveTo(rx, yB, rx, yB + rBack);
  s.lineTo(rx, yF - fChamY - rf);
  s.quadraticCurveTo(rx, yF - fChamY, rx - rf * 0.82, yF - fChamY + rf * 0.56);
  s.lineTo(rx - fChamXR + rf * 0.82, yF - rf * 0.56);
  s.quadraticCurveTo(rx - fChamXR, yF, rx - fChamXR - rf, yF);
  s.lineTo(lx + fChamXL + rf, yF);
  s.quadraticCurveTo(lx + fChamXL, yF, lx + fChamXL - rf * 0.82, yF - rf * 0.56);
  s.lineTo(lx + rf * 0.82, yF - fChamY + rf * 0.56);
  s.quadraticCurveTo(lx, yF - fChamY, lx, yF - fChamY - rf);
  s.lineTo(lx, yB + rBack);
  s.quadraticCurveTo(lx, yB, lx + rBack, yB);
  return s;
}

// ───────── Smoothly Filleted Die-Cast Canon AE-1 Pentaprism (read off front/top/back 5 mm grids!) ─────────
// Continuous multi-ring rounded-ridge loft: softly filleted cheek ridges (r≈1.8 mm), brow crease (Y=46.2) & flat crown shoulder (Y=55.5)
// so glossy black enamel catches continuous realistic studio specular highlights instead of sharp faceted polygon seams!
function buildAE1PrismGeo() {
  // Levels: [y, xFront, xRear, zFront, zRear, cornerR, wear]
  const levels = [
    [37.3,  23.95, 23.15, -35.80, 3.00, 1.8, 0.25],
    [45.35, 16.58, 16.75, -31.02, 2.35, 1.8, 0.45],
    [46.20, 15.80, 16.05, -30.50, 2.28, 1.9, 0.65], // softly filleted horizontal brow crease
    [47.15, 15.16, 15.42, -29.58, 2.20, 1.9, 0.50],
    [54.25, 10.35, 10.60, -22.70, 1.62, 1.7, 0.65],
    [55.12,  9.76, 10.02, -21.84, 1.54, 1.4, 0.82], // softly rounded crown shoulder fillet
    [55.50,  9.15,  9.45, -21.15, 1.48, 1.1, 0.85], // sleek flat top crown edge
  ];
  const ARC = 6; // 6 steps per rounded corner -> 28 smooth perimeter points per ring
  const ringPts = (xF, xR, zF, zR, r) => {
    const pts = [];
    const corners = [
      // Ordered CCW looking down from +Y (so outward normals point away from prism core):
      [ xF - r, zF + r, -Math.PI / 2, 0],            // front-right
      [ xR - r, zR - r, 0,            Math.PI / 2],  // rear-right
      [-xR + r, zR - r, Math.PI / 2,  Math.PI],      // rear-left
      [-xF + r, zF + r, Math.PI,      Math.PI * 1.5],// front-left
    ];
    for (const [cx, cz, a0, a1] of corners) {
      for (let k = 0; k <= ARC; k++) {
        const a = lerp(a0, a1, k / ARC);
        pts.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]);
      }
    }
    return pts;
  };
  const rings = levels.map(([y, xF, xR, zF, zR, r, w]) => ({ y, w, pts: ringPts(xF, xR, zF, zR, r) }));
  const N = rings[0].pts.length, R = rings.length;
  const pos = [], uv = [], wear = [], idx = [];
  for (let i = 0; i < R; i++) {
    const rg = rings[i];
    for (let j = 0; j < N; j++) {
      const [px, pz] = rg.pts[j];
      pos.push(px, rg.y, pz);
      uv.push(px * 0.05, rg.y * 0.05);
      wear.push(rg.w);
    }
  }
  for (let i = 0; i < R - 1; i++) {
    for (let j = 0; j < N; j++) {
      const jn = (j + 1) % N;
      const a = i * N + j, b = i * N + jn, c = (i + 1) * N + j, d = (i + 1) * N + jn;
      idx.push(a, c, b, b, c, d);
    }
  }
  // Flat top crown cap (with clean upward-facing normals) & bottom cap
  const topC = pos.length / 3;
  const topL = rings[R - 1], botL = rings[0];
  pos.push(0, topL.y, -9.8); uv.push(0, 0); wear.push(0.5);
  const topRingBase = pos.length / 3;
  for (let j = 0; j < N; j++) { const [px, pz] = topL.pts[j]; pos.push(px, topL.y, pz); uv.push(px * 0.05, pz * 0.05); wear.push(0.75); }
  for (let j = 0; j < N; j++) { const jn = (j + 1) % N; idx.push(topC, topRingBase + jn, topRingBase + j); }
  const botC = pos.length / 3;
  pos.push(0, botL.y, -16.0); uv.push(0, 0); wear.push(0.2);
  for (let j = 0; j < N; j++) { const jn = (j + 1) % N; idx.push(botC, j, jn); }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('wear', new THREE.Float32BufferAttribute(wear, 1));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function buildOpticalPentaprismGeo() {
  // True optical roof-pentaprism glass block seated inside pentaprism cavity (width ±9.5 mm — ZERO cheek poke-through!)
  const s = new THREE.Shape();
  s.moveTo(-28.0, 22.5); // bottom front above focusing screen
  s.lineTo(-10.0, 22.5); // bottom rear
  s.lineTo(-4.0, 30.0);  // rear exit face lower edge
  s.lineTo(-4.0, 44.0);  // rear exit face upper edge (faces eyepiece!)
  s.lineTo(-17.0, 50.5); // upper roof peak
  s.lineTo(-29.5, 36.0); // angled front mirror face
  s.closePath();
  // Extrude cleanly inside X = -9.5..+9.5 mm (well inside tapered outer shell ±12.9 mm at Y=50.5!)
  const g = new THREE.ExtrudeGeometry(s, { depth: 19.0, bevelEnabled: false });
  g.rotateY(-Math.PI / 2); // maps shape X -> Z, shape Y -> Y, extrude Z -> -X
  g.translate(9.5, 0, 0);
  return prep(g);
}

function filmStripTex() {
  // Authentic translucent warm-amber 35 mm film strip with rectangular sprocket perforations & edge frame numbers
  const W = 1024, H = 350, cv = canvas(W, H), g = cv.getContext('2d');
  g.fillStyle = 'rgba(138, 78, 34, 0.78)'; g.fillRect(0, 0, W, H);
  // Subtle frame borders (24×36 mm active area inside 35 mm strip)
  g.strokeStyle = 'rgba(65, 34, 14, 0.55)'; g.lineWidth = 4;
  for (let x = 24; x < W; x += 380) g.strokeRect(x, 56, 360, 238);
  // Exact 35 mm KS rectangular sprocket perforations (pitch 4.75 mm -> 8 per frame)
  g.globalCompositeOperation = 'destination-out';
  for (let x = 14; x < W - 14; x += 47.5) {
    g.beginPath(); g.roundRect(x, 18, 20, 28, 5); g.fill();
    g.beginPath(); g.roundRect(x, H - 46, 20, 28, 5); g.fill();
  }
  g.globalCompositeOperation = 'source-over';
  // Edge markings ("GW 400  1A  2  2A ...")
  g.fillStyle = '#f6c86e'; g.font = `700 13px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let i = 0; i < 6; i++) {
    g.fillText(`GW 400`, 80 + i * 190, 9);
    g.fillText(`${i + 1}A`, 175 + i * 190, H - 8);
  }
  const t = tex(cv); t.wrapS = THREE.RepeatWrapping; return t;
}

function cassetteTex() {
  // Classic 35 mm metallic film cartridge label (neutral GLASS WORKS 400 · 36 EXP)
  const cv = canvas(512, 512), g = cv.getContext('2d');
  g.fillStyle = '#d4961a'; g.fillRect(0, 0, 512, 512);
  g.fillStyle = '#18181b'; g.fillRect(0, 0, 512, 130); g.fillRect(0, 410, 512, 102);
  g.fillStyle = '#f4f1e8'; g.font = `800 54px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('GW 400', 256, 240);
  g.fillStyle = '#141416'; g.font = `700 32px ${FONT}`;
  g.fillText('35mm · 36 EXP', 256, 320);
  g.fillStyle = '#e8e4d8'; g.font = `600 26px ${FONT}`;
  g.fillText('GLASS WORKS FILM', 256, 68);
  return tex(cv);
}

function focusScreenTex() {
  // Canon AE-1 Laser Matte Fresnel focusing screen with central split-image prism & microprism collar
  const cv = canvas(512, 342), g = cv.getContext('2d');
  g.fillStyle = 'rgba(220, 226, 224, 0.38)'; g.fillRect(0, 0, 512, 342);
  // Concentric Fresnel rings
  g.strokeStyle = 'rgba(180, 188, 186, 0.25)'; g.lineWidth = 1.5;
  for (let r = 56; r < 290; r += 12) { g.beginPath(); g.arc(256, 171, r, 0, TAU); g.stroke(); }
  // Microprism ring + central horizontal split-image rangefinder circle
  g.strokeStyle = 'rgba(40, 44, 48, 0.65)'; g.lineWidth = 3;
  g.beginPath(); g.arc(256, 171, 44, 0, TAU); g.stroke();
  g.beginPath(); g.arc(256, 171, 24, 0, TAU); g.stroke();
  g.beginPath(); g.moveTo(232, 171); g.lineTo(280, 171); g.stroke();
  return tex(cv);
}

function batteryTex() {
  // 4LR44 / PX28 6V silver-oxide battery graphic inside front battery well
  const cv = canvas(256, 256), g = cv.getContext('2d');
  g.fillStyle = '#1b1d22'; g.fillRect(0, 0, 256, 256);
  g.fillStyle = '#c89b2c'; g.fillRect(0, 0, 256, 76);
  g.fillStyle = '#f2efe6'; g.font = `800 36px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('4LR44', 128, 145);
  g.font = `700 28px ${FONT}`; g.fillText('6V', 128, 195);
  return tex(cv);
}

// ───────── Split Hollow Left/Right Chassis Wings (100% OPEN Central FD Mirror-Box Tunnel + 35 mm Film Chamber + Front 4LR44 Battery Well!) ─────────
function ae1LeftWingPlan(x0, zF, zB, inset = 0) {
  const lx = x0 + inset, yF = -zF - inset, yB = -zB + inset;
  const fChamXL = 11.2, fChamY = 8.4, rBack = 13.5, rf = 2.4, cavL = -60.8;
  const s = new THREE.Shape();
  s.moveTo(-21.5, yF);
  s.lineTo(lx + fChamXL + rf, yF);
  s.quadraticCurveTo(lx + fChamXL, yF, lx + fChamXL - rf * 0.82, yF - rf * 0.56);
  s.lineTo(lx + rf * 0.82, yF - fChamY + rf * 0.56);
  s.quadraticCurveTo(lx, yF - fChamY, lx, yF - fChamY - rf);
  s.lineTo(lx, yB + rBack);
  s.quadraticCurveTo(lx, yB, cavL, yB);
  // Open rear left cassette well (X=-60.8..-34.0, z=-24.5..+3.4) + mirror-box left wall (-21.5)
  s.lineTo(cavL, 24.5);
  s.lineTo(-34.0, 24.5);
  s.lineTo(-34.0, 4.5);
  s.lineTo(-21.5, 4.5);
  s.closePath();
  return s;
}
function ae1RightWingPlan(x1, zF, zB, inset = 0, withBatWell = false) {
  const rx = x1 - inset, yF = -zF - inset, yB = -zB + inset;
  const fChamXR = 13.0, fChamY = 8.4, rBack = 13.5, rf = 2.4, cavR = 64.5;
  const s = new THREE.Shape();
  s.moveTo(cavR, yB);
  s.quadraticCurveTo(rx, yB, rx, yB + rBack);
  s.lineTo(rx, yF - fChamY - rf);
  s.quadraticCurveTo(rx, yF - fChamY, rx - rf * 0.82, yF - fChamY + rf * 0.56);
  s.lineTo(rx - fChamXR + rf * 0.82, yF - rf * 0.56);
  s.quadraticCurveTo(rx - fChamXR, yF, rx - fChamXR - rf, yF);
  if (withBatWell) {
    // Recessed front 4LR44 6V battery well (X=+33.2..+48.4, z=-28.4..-15.6) hidden cleanly behind hinged batDoorPivot
    s.lineTo(48.4, yF);
    s.lineTo(48.4, 15.6);
    s.lineTo(33.2, 15.6);
    s.lineTo(33.2, yF);
  }
  s.lineTo(21.5, yF);
  s.lineTo(21.5, 4.5);
  s.lineTo(30.0, 4.5);
  s.lineTo(30.0, 14.5);
  s.lineTo(44.5, 14.5);
  s.lineTo(44.5, 19.0);
  s.lineTo(cavR, 19.0);
  s.closePath();
  return s;
}

// ───────── All-Black Canon AE-1 Body (Calibrated to 5 mm grids + Full Open-Back 35 mm Film Compartment + Open FD Mirror Box!) ─────────
function buildBody(lib, hov) {
  const bk = lib.get('blackEnamel'), leather = lib.get('leather'), chrome = lib.get('chrome'), bright = lib.get('chromeBright');
  const steel = lib.get('steel'), anod = lib.get('anod'), flock = lib.get('flock'), rubber = lib.get('rubber'), brass = lib.get('brass');
  const intBlk = lib.get('interiorBlack'), pPlate = lib.get('pressurePlate');

  const core = new THREE.Group(), top = new THREE.Group(), bottom = new THREE.Group(), doorPivot = new THREE.Group();
  const ck = new Kit(), tk = new Kit(), btk = new Kit(), dk = new Kit();

  const zShellBack = B.zB; // sleek 31.8 mm body box (-28.4 .. +3.4)!
  // Seamless full-height hollow left & right leatherette wings (Y = -25.0..+16.4) with ZERO bogus horizontal seam & 100% OPEN central mirror box!
  const leftW = ae1LeftWingPlan(B.x0, B.zF, zShellBack, 0.2);
  const rightW = ae1RightWingPlan(B.x1, B.zF, zShellBack, 0.2, true);
  ck.add(slab(leftW, B.seamY - B.baseY, 0.45, 28, 0.5, 3), leather, T(0, B.baseY, 0, -Math.PI / 2, 0, 0));
  ck.add(slab(rightW, B.seamY - B.baseY, 0.45, 28, 0.5, 3), leather, T(0, B.baseY, 0, -Math.PI / 2, 0, 0));
  // Flush lower leatherette fill below the battery door (Y=-25.0..-14.4) + planar world-UV front leatherette panels so pebble grain is uniform everywhere!
  ck.add(rbox(16.0, 10.6, 12.6, 0.15, 1), leather, T(40.8, -19.7, -21.9));
  ck.add(rbox(24.0, 40.6, 0.4, 0.1, 1), leather, T(-42.5, -4.3, B.zF + 0.08));
  ck.add(rbox(14.5, 40.6, 0.4, 0.1, 1), leather, T(56.0, -4.3, B.zF + 0.08));
  ck.add(rbox(16.5, 10.4, 0.4, 0.1, 1), leather, T(40.8, -19.5, B.zF + 0.08));
  // Dead-flat matte black interior liner floor & ceiling framing the open 35 mm film chamber (Y=-22.2..+19.8)
  ck.add(rbox(125.0, 2.8, 26.0, 0.2, 1), intBlk, T(2.0, B.baseY + 1.4, -10.0));
  ck.add(rbox(125.0, 1.4, 26.0, 0.2, 1), intBlk, T(2.0, 20.5, -10.0));

  // Glossy black lower fascia step (Y = +16.4..+21.5) — hollow behind rear door up to Y=+20.2 so top of 35 mm chamber clears cleanly!
  const stepL = ae1LeftWingPlan(B.x0 + 0.3, B.zF, zShellBack, 0.05);
  const stepR = ae1RightWingPlan(B.x1 - 0.3, B.zF, zShellBack, 0.05, false);
  const stepSolid = ae1PlanShape(B.x0 + 0.3, B.x1 - 0.3, B.zF, zShellBack, 0.05);
  ck.add(slab(stepL, 3.8, 0.45, 28, 0.6, 3), bk, T(0, B.seamY, 0, -Math.PI / 2, 0, 0));
  ck.add(slab(stepR, 3.8, 0.45, 28, 0.6, 3), bk, T(0, B.seamY, 0, -Math.PI / 2, 0, 0));
  ck.add(slab(stepSolid, 1.3, 0.35, 28, 0.6, 3), bk, T(0, 20.2, 0, -Math.PI / 2, 0, 0));

  // Protruding Mirror-Box & Lens-Mount Housing with smoothly filleted upper shoulders & OPEN 47.2 mm circular FD throat hole (Canon_AE-1_FD_mount.jpg!)
  const apron = new THREE.Shape();
  apron.moveTo(-22.0, -30.5); apron.quadraticCurveTo(0, -31.8, 22.0, -30.5);
  apron.quadraticCurveTo(29.0, -29.0, 29.0, -24.5);
  apron.lineTo(29.0, 23.0);
  apron.quadraticCurveTo(29.0, 26.2, 27.6, 29.4);
  apron.lineTo(25.1, B.deck - 2.2);
  apron.quadraticCurveTo(24.0, B.deck, 21.6, B.deck);
  apron.lineTo(-21.6, B.deck);
  apron.quadraticCurveTo(-24.0, B.deck, -25.1, B.deck - 2.2);
  apron.lineTo(-27.6, 29.4);
  apron.quadraticCurveTo(-29.0, 26.2, -29.0, 23.0);
  apron.lineTo(-29.0, -24.5); apron.quadraticCurveTo(-29.0, -29.0, -22.0, -30.5);
  apron.holes.push(new THREE.Path().absarc(0, 0, 23.8, 0, TAU, true)); // REAL OPEN FD THROAT!
  ck.add(slab(apron, 7.6, 1.0, 28, 0.65, 3), bk, T(0, 0, -35.8));
  ck.add(revolve([[29.2, -35.4], [29.2, -39.8, 0.55], [27.6, -40.4], [24.0, -40.4], [24.0, -35.4]], { segs: 96, crease: 30 }), bk);
  addScrew(ck, anod, ck, flock, T(0, -30.6, -36.5, Math.PI / 2, 0, 0), 1.0, true, 0.2);

  // Bright Chrome Canon FD Bayonet Flange (54.6 mm OD / 48.0 mm ID at z=-42.0) + exact FD mount details (Canon_AE-1_FD_mount.jpg!)
  ck.add(revolve([[27.3, -40.0], [27.3, DIM.flange, 0.45], [24.0, DIM.flange], [24.0, -36.5]], { segs: 96, crease: 30 }), bright);
  // 12 o'clock machined alignment notch, top black Phillips mount screw, 8 o'clock locating pin & 4 o'clock aperture pin bore!
  ck.add(rbox(2.6, 3.8, 1.6, 0.2, 1), anod, T(0, 25.8, DIM.flange - 0.1));
  addScrew(ck, anod, ck, flock, T(0, 30.8, -40.2, 0, Math.PI, 0), 1.45, true, 0.35);
  ck.add(revolve([[1.1, 0], [1.1, 1.4, 0.25]], { segs: 28 }), steel, T(22.2, -12.5, DIM.flange, Math.PI, 0, 0));
  ck.add(revolve([[1.6, 0], [1.6, 1.0, 0.25], [1.0, 1.0]], { segs: 28 }), brass, T(-17.8, -17.8, DIM.flange + 1.4, Math.PI, 0, 0));
  // Open matte-black mirror-box tunnel walls (inner lining, upper black foam mirror-damper strip, lower baffle floor & 6 o'clock slot!)
  const throatTube = new THREE.CylinderGeometry(23.5, 23.5, 36.0, 48, 1, true);
  throatTube.rotateX(Math.PI / 2); throatTube.translate(0, 0, -21.5);
  ck.add(throatTube, lib.prepare(new THREE.MeshPhysicalMaterial({ name: 'ae1InteriorThroat', color: 0x020203, roughness: 0.98, metalness: 0.0, specularIntensity: 0.0, envMapIntensity: 0.04, side: THREE.BackSide }), {}));
  // Rectangular inner mirror-box cheek baffles + bottom deck + black foam mirror-damper bumper!
  [-20.5, 20.5].forEach((mx) => ck.add(rbox(1.6, 36.0, 31.0, 0.2, 1), intBlk, T(mx, 0, -20.0)));
  ck.add(rbox(40.0, 2.2, 31.0, 0.2, 1), intBlk, T(0, -18.5, -20.0));
  ck.add(rbox(36.0, 2.8, 4.4, 0.4, 1), lib.get('felt'), T(0, 18.8, -33.2)); // authentic black foam mirror damper bumper!
  ck.add(rbox(16.0, 2.2, 1.8, 0.2, 1), intBlk, T(-3.0, -19.6, -35.8)); // 6 o'clock aperture-signal coupling slot
  // Laser Matte Fresnel + Split-Image / Microprism Focusing Screen horizontally above the 45° reflex mirror!
  ck.add(new THREE.PlaneGeometry(36.0, 24.0), lib.prepare(new THREE.MeshPhysicalMaterial({ map: focusScreenTex(), transparent: true, roughness: 0.35, metalness: 0.05, side: THREE.DoubleSide }), {}), T(0, 20.8, -21.0, -Math.PI / 2, 0, 0));

  // ───────── Open-Back 35 mm Film Compartment (Canon_AE-1_back_open.jpg!) ─────────
  // Machined 24×36 mm film gate + TWO PAIRS of gleaming polished stainless-steel film rails (inner ±12.4 mm, outer ±17.8 mm!)
  const gate = rrPath(-30.0, -19.5, 29.0, 19.5, 0.8); gate.holes.push(rrPath(-18.0, -12.0, 18.0, 12.0, 0.25, new THREE.Path()));
  ck.add(slab(gate, 2.2, 0.2), intBlk, T(0, 0, -2.8));
  [-12.4, 12.4].forEach((ry) => ck.add(rbox(58.0, 2.0, 1.0, 0.15, 1, 0.75), bright, T(0, ry, -0.35)));
  [-17.8, 17.8].forEach((ry) => ck.add(rbox(56.0, 1.5, 1.4, 0.15, 1, 0.75), bright, T(0, ry, -0.15)));
  // Left (-X) OPEN-BACKED semi-cylindrical cassette well (NEVER hides cassette or rewind fork!) + vibrant gold/black GW 400 cartridge!
  const cassWell = new THREE.CylinderGeometry(12.6, 12.6, 40.4, 28, 1, true, Math.PI * 0.55, Math.PI * 0.90);
  cassWell.translate(-49.0, -1.2, -11.5);
  ck.add(cassWell, lib.prepare(new THREE.MeshPhysicalMaterial({ name: 'ae1InteriorCassWell', color: 0x020203, roughness: 0.98, metalness: 0.0, specularIntensity: 0.0, envMapIntensity: 0.04, side: THREE.BackSide }), {}));
  const filmCart = new THREE.Group(); filmCart.position.set(-49.0, -1.2, -11.5);
  {
    const fc = new Kit();
    // Orient GW 400 graphic straight rearward (+Z) so it reads crisply when the door is open!
    const cCyl = new THREE.CylinderGeometry(11.8, 11.8, 39.0, 36, 1, true);
    cCyl.rotateY(Math.PI); // CylinderGeometry u=0.5 sits at -Z; rotateY(PI) aims GW 400 straight toward +Z!
    fc.add(cCyl, lib.prepare(new THREE.MeshPhysicalMaterial({ map: cassetteTex(), roughness: 0.32, metalness: 0.28 }), {}));
    [-19.8, 19.8].forEach((cy) => fc.add(revolve([[12.2, -1.0], [12.2, 1.0, 0.35], [5.4, 1.2]], { segs: 36 }), bk, T(0, cy, 0, Math.PI / 2, 0, 0)));
    fc.add(rbox(6.5, 36.0, 4.4, 0.6, 1), lib.get('felt'), T(11.0, 0, 8.2)); // black velvet light-trap lip facing film rails
    fc.build(filmCart);
  }
  core.add(filmCart);
  // Continuous Smooth-Spline 3D Perforated 35 mm Film Web emerging from GW 400 lip -> rails -> cleanly OVER sprocket shaft -> take-up spool!
  const filmTex = filmStripTex();
  const filmStripMat = lib.prepare(new THREE.MeshPhysicalMaterial({ map: filmTex, transparent: true, roughness: 0.22, metalness: 0.08, side: THREE.DoubleSide }), {});
  const filmStrip = new THREE.Group();
  {
    const spline = new THREE.SplineCurve([
      new THREE.Vector2(-37.5, -2.5), new THREE.Vector2(-33.0, -0.4), new THREE.Vector2(-28.0, 0.25),
      new THREE.Vector2(0.0, 0.25), new THREE.Vector2(29.0, 0.25),
      new THREE.Vector2(34.5, 0.32), new THREE.Vector2(36.4, 0.28), new THREE.Vector2(39.0, -0.35),
      new THREE.Vector2(41.5, -1.8), new THREE.Vector2(45.5, -2.4), new THREE.Vector2(51.0, -1.8), new THREE.Vector2(56.5, -3.6),
    ]);
    const pts = spline.getSpacedPoints(56);
    let totalL = 0;
    const cumL = [0];
    for (let i = 1; i < pts.length; i++) {
      totalL += pts[i].distanceTo(pts[i - 1]);
      cumL.push(totalL);
    }
    const hh = 17.3, pos = [], uv = [], idx = [];
    pts.forEach((p, i) => {
      const u = cumL[i] / totalL;
      pos.push(p.x, -hh, p.y, p.x, hh, p.y);
      uv.push(u, 0, u, 1);
      if (i > 0) { const a = (i - 1) * 2, b = a + 1, c = i * 2, d = c + 1; idx.push(a, c, b, b, c, d); }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals();
    filmStrip.add(new THREE.Mesh(prep(g), filmStripMat));
  }
  core.add(filmStrip);

  // Rotating 8-Tooth Stainless Sprocket Advance Drum (X=+36.0, Z=-5.4 so teeth engage 35 mm KS perforations!)
  const sprocket = new THREE.Group(); sprocket.position.set(36.0, -1.2, -5.4);
  {
    const sk = new Kit();
    sk.add(revolve([[5.0, -18.5], [5.0, 18.5, 0.35]], { segs: 32 }), anod, T(0, 0, 0, Math.PI / 2, 0, 0));
    [-14.2, 14.2].forEach((ty) => {
      sk.add(revolve([[5.3, -1.3], [5.3, 1.3, 0.2]], { segs: 32 }), bright, T(0, ty, 0, Math.PI / 2, 0, 0));
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU;
        sk.add(rbox(1.1, 1.5, 1.6, 0.2, 1), bright, T(Math.cos(a) * 5.6, ty, Math.sin(a) * 5.6, 0, -a, 0));
      }
    });
    sk.build(sprocket);
  }
  core.add(sprocket);

  // Rotating Canon Multi-Slotted Black Take-Up Spool (X=+53.0, Z=-9.5) with 6 deep vertical leader-catch slots & contrast ribs!
  const takeup = new THREE.Group(); takeup.position.set(53.0, -1.2, -9.5);
  {
    const tk2 = new Kit();
    tk2.add(revolve([[5.8, -18.2], [5.8, 18.2]], { segs: 36 }), flock, T(0, 0, 0, Math.PI / 2, 0, 0)); // dark inner core inside slots
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      tk2.add(rbox(2.2, 34.0, 4.6, 0.45, 2, 0.5), bk, T(Math.cos(a) * 6.8, 0, Math.sin(a) * 6.8, 0, -a, 0));
      tk2.add(rbox(0.5, 32.0, 1.0, 0.1, 1), steel, T(Math.cos(a + 0.34) * 7.6, 0, Math.sin(a + 0.34) * 7.6, 0, -(a + 0.34), 0)); // subtle slot edge catch lip!
    }
    tk2.add(revolve([[9.1, -19.5], [9.4, -19.3, 0.3, 1], [9.4, -17.0, 0.3, 1], [9.0, -16.8]], { segs: 256, ribs: { n: 32, depth: 0.35 } }), anod, T(0, 0, 0, Math.PI / 2, 0, 0));
    tk2.add(revolve([[9.0, 16.8], [9.0, 19.2, 0.3]], { segs: 36 }), bk, T(0, 0, 0, Math.PI / 2, 0, 0));
    tk2.build(takeup);
  }
  core.add(takeup);

  // Animated FD Auto-Diaphragm Stop-Down Lever (3 o'clock inside mirror box, -X) & Aperture-Signal Lever (6 o'clock slot)
  const stopDownPin = new THREE.Group(); stopDownPin.position.set(-20.4, 2.5, -35.0);
  { const k = new Kit(); k.add(rbox(4.8, 2.6, 5.2, 0.35, 1), steel); k.build(stopDownPin); }
  core.add(stopDownPin);
  const apSignalPin = new THREE.Group(); apSignalPin.position.set(-5.0, -19.6, -36.0);
  { const k = new Kit(); k.add(rbox(2.8, 5.2, 3.2, 0.35, 1), bright); k.build(apSignalPin); }
  core.add(apSignalPin);

  // Front-right (+X): Hinged 4LR44 6V Battery Door (X=+31.5..+50.0, Y=-14.5..+16.5 — ZERO top gap!) + recessed 6V cell!
  ck.add(rbox(15.2, 30.0, 0.8, 0.2, 1), flock, T(40.8, 1.0, -16.0));
  ck.add(rbox(15.2, 1.0, 12.6, 0.2, 1), anod, T(40.8, 15.8, -22.0)); // top ceiling of battery well
  ck.add(rbox(15.2, 1.0, 12.6, 0.2, 1), anod, T(40.8, -13.8, -22.0)); // bottom floor of battery well
  // Cylindrical 4LR44 6V silver-oxide battery (r=5.4, h=21.6 mm) with '4LR44 / 6V' facing straight forward (-Z) out the open battery door!
  const batCyl = new THREE.CylinderGeometry(5.4, 5.4, 21.6, 28, 1, true);
  batCyl.translate(40.8, 0.5, -22.2); // CylinderGeometry u=0.5 faces -Z straight out the open front door!
  ck.add(batCyl, lib.prepare(new THREE.MeshPhysicalMaterial({ map: batteryTex(), roughness: 0.32, metalness: 0.35 }), {}));
  [-11.5, 11.5].forEach((by) => ck.add(revolve([[0, -0.5], [3.8, -0.5], [3.8, 0.5], [0, 0.5]], { segs: 28 }), brass, T(40.8, 0.5 + by, -22.2, Math.PI / 2, 0, 0)));
  const batDoorPivot = new THREE.Group(); batDoorPivot.position.set(31.5, 1.0, B.zF);
  {
    const bdk = new Kit();
    bdk.add(rbox(18.6, 31.2, 2.4, 0.75, 3, 0.4), bk, T(9.3, 0, -0.9));
    bdk.add(rbox(10.8, 28.6, 0.8, 0.35, 2), leather, T(5.9, 0, -1.9));
    // Sculpted rounded D-profile ergonomic battery-door finger grip bar
    bdk.add(rbox(5.0, 29.4, 3.8, 1.8, 4, 0.45), bk, T(14.5, 0, -1.7));
    bdk.add(rbox(2.2, 6.2, 1.6, 0.4, 2), flock, T(17.3, -9.7, -2.8));
    bdk.build(batDoorPivot);
  }
  core.add(batDoorPivot);
  addScrew(ck, steel, ck, flock, T(48.5, 19.0, B.zF - 0.1, 0, Math.PI, 0), 1.1, true, 0.4);

  // Front-left (-X): Circular black PC flash sync cap (-41.0, +24.7), screw below, mirror-box side button block & sculpted DoF stop-down slide!
  ck.add(revolve([[4.4, 0], [4.4, 2.8, 0.45], [3.9, 3.2], [0, 3.2]], { segs: 36 }), anod, T(-41.0, 24.7, B.zF - 0.1, Math.PI, 0, 0));
  addScrew(ck, anod, ck, flock, T(-41.0, 18.2, B.zF - 0.1, 0, Math.PI, 0), 1.0, true, 0.3);
  ck.add(rbox(4.2, 23.0, 7.2, 1.0, 3, 0.4), bk, T(-30.5, 6.5, -32.0));
  ck.add(revolve([[2.6, 0], [2.6, 1.4, 0.3], [0, 1.4]], { segs: 32 }), bright, T(-32.6, 11.5, -32.5, 0, -Math.PI / 2, 0));
  const backlightBtn = new THREE.Group(); backlightBtn.position.set(-32.6, 11.5, -32.5);
  { const k = new Kit(); k.add(revolve([[2.0, 0], [2.0, 1.9, 0.35], [0, 1.9]], { segs: 32 }), bk, T(0, 0, 0, 0, -Math.PI / 2, 0)); k.build(backlightBtn); }
  core.add(backlightBtn);
  const previewBtn = new THREE.Group(); previewBtn.position.set(-32.6, 3.5, -32.5);
  { const k = new Kit(); k.add(revolve([[1.8, 0], [1.8, 1.8, 0.3], [0, 1.8]], { segs: 28 }), bright, T(0, 0, 0, 0, -Math.PI / 2, 0)); k.build(previewBtn); }
  core.add(previewBtn);
  addScrew(ck, anod, ck, flock, T(-32.6, -2.5, -32.5, 0, -Math.PI / 2, 0), 0.85, true, 0.3);
  ck.add(rbox(14.5, 8.7, 1.8, 0.75, 3), flock, T(-38.2, -9.8, B.zF - 0.4));
  const dofLever = new THREE.Group(); dofLever.position.set(-39.8, -9.8, B.zF - 2.1);
  {
    const lk = new Kit();
    lk.add(rbox(9.5, 6.8, 3.0, 1.1, 3, 0.45), bk);
    lk.add(rbox(2.2, 5.2, 0.9, 0.45, 2, 0.55), bk, T(-2.6, 0, -1.6));
    lk.build(dofLever);
  }
  core.add(dofLever);

  // Flush Side-Wall Strap Eyelets seated on upper glossy top-deck shoulder (Y=+26.8) + Authentic Hanging Chrome Split Rings (r=6.2 mm, top loops cleanly through eyelet bore!)
  [[B.x0 + 0.1, -1], [B.x1 - 0.1, 1]].forEach(([ex, sx]) => {
    ck.add(revolve([[2.4, -1.4], [2.4, 1.5, 0.4], [1.8, 1.9], [0, 1.9]], { segs: 36 }), bright, T(ex, 26.8, -18.5, 0, sx * Math.PI / 2, 0));
    const ring = new THREE.TorusGeometry(6.2, 0.85, 16, 48);
    ck.add(ring, bright, T(ex + sx * 1.45, 19.3, -18.5, 0, Math.PI / 2 - sx * 0.24, 0));
  });
  ck.build(core);

  // Instant-return 45° reflex mirror in stamped-steel frame with side damping arms (NORMAL FACING FORWARD+UPWARD -> visible in bare FD mount!)
  const mirrorPivot = new THREE.Group(); mirrorPivot.position.set(0, 16.5, -11.0);
  {
    const mk = new Kit();
    mk.add(rbox(31.0, 1.2, 26.8, 0.25, 1), anod, T(0, -0.7, -13.6));
    [-16.0, 16.0].forEach((mx) => mk.add(rbox(1.3, 2.8, 25.0, 0.25, 1), steel, T(mx, -0.8, -13.0)));
    // Front-surface silvered reflex mirror with subtle focusing-screen reflection sheen (facing +Y locally -> +Y/-Z at 45°!)
    const mirMat = lib.prepare(new THREE.MeshPhysicalMaterial({ name: 'ae1ReflexMirror', map: focusScreenTex(), color: 0xaab4b8, metalness: 0.78, roughness: 0.08, clearcoat: 1.0, clearcoatRoughness: 0.04 }), {});
    mk.add(new THREE.PlaneGeometry(29.2, 25.0), mirMat, T(0, 0.02, -13.6, -Math.PI / 2, 0, 0));
    mk.build(mirrorPivot);
  }
  core.add(mirrorPivot);

  // True Two-Curtain Horizontal Cloth Focal-Plane Shutter (non-clipping scaled silk cloths + rigid traveling steel laths!)
  const curtain1Cloth = new THREE.Mesh(prep(new THREE.PlaneGeometry(37.0, 24.4)), lib.get('curtain'));
  curtain1Cloth.position.set(0, 0, -1.9);
  const curtain1Lath = new THREE.Mesh(prep(rbox(1.3, 24.4, 0.4, 0.1, 1)), steel);
  curtain1Lath.position.set(-18.5, 0, -1.75);
  const curtain2Cloth = new THREE.Mesh(prep(new THREE.PlaneGeometry(37.0, 24.4)), lib.get('curtain'));
  curtain2Cloth.position.set(-18.5, 0, -1.55); curtain2Cloth.scale.x = 0.001;
  const curtain2Lath = new THREE.Mesh(prep(rbox(1.3, 24.4, 0.4, 0.1, 1)), steel);
  curtain2Lath.position.set(-18.5, 0, -1.4);
  core.add(curtain1Cloth, curtain1Lath, curtain2Cloth, curtain2Lath);

  // Glossy All-Black Top Plate (slab spans exact z ∈ [0, t] -> true top deck surface = B.deck = +37.5!) + Smoothly Filleted Pentaprism (+37.3..+55.5)
  const topPlan = ae1PlanShape(B.x0 + 0.8, B.x1 - 0.8, B.zF, zShellBack, 0);
  tk.add(slab(topPlan, B.deck - 21.5, 1.1, 28, 0.7, 3), bk, T(0, 21.5, 0, -Math.PI / 2, 0, 0));
  // Smoothly filleted die-cast Canon AE-1 pentaprism
  tk.add(buildAE1PrismGeo(), bk);
  // Crisp upright silver "GLASS WORKS" wordmark calibrated to Canon brow proportions (Y=40.3, w=32.5)
  const lowerTilt = Math.atan2(5.3, 8.6);
  tk.add(new THREE.PlaneGeometry(32.5, 8.2), lib.prepare(new THREE.MeshPhysicalMaterial({ map: prismBadgeTex(), transparent: true, alphaTest: 0.12, roughness: 0.22, metalness: 0.5 }), {}), T(0, 40.4, -34.7, lowerTilt, Math.PI, 0));
  tk.add(new THREE.SphereGeometry(0.85, 18, 12), lib.get('red'), T(0, 34.4, -36.1));
  // Outlined silver "AE-1" slab-serif badge calibrated to Canon_AE-1_front.jpg (X=+47.0, Y=+28.35, exact 1024:288 aspect)
  tk.add(new THREE.PlaneGeometry(21.8, 6.13), lib.prepare(new THREE.MeshPhysicalMaterial({ map: modelBadgeTex(), transparent: true, depthWrite: false, roughness: 0.28, metalness: 0.32 }), {}), T(47.0, 28.35, B.zF - 0.12, 0, Math.PI, 0));

  // Silver-railed Accessory Hot Shoe recessed cleanly toward rear of pentaprism crown (ae1_top_mmgrid.png: Z=-15.5..+2.0)
  const hsY = B.prismY - 0.2, hsZ = -6.75;
  tk.add(rbox(19.6, 1.0, 17.5, 0.45, 2, 0.5), bk, T(0, hsY + 0.5, hsZ));
  [-8.2, 8.2].forEach((hx) => {
    tk.add(rbox(3.4, 2.0, 17.2, 0.35, 2, 0.5), bright, T(hx, hsY + 1.5, hsZ));
    tk.add(rbox(4.2, 0.85, 17.2, 0.25, 2, 0.5), bright, T(hx - Math.sign(hx) * 0.6, hsY + 2.4, hsZ));
  });
  tk.add(rbox(12.2, 0.7, 14.5, 0.2, 1), anod, T(0, hsY + 1.1, hsZ));
  tk.add(revolve([[2.3, 0], [2.3, 0.65], [0, 0.65]], { segs: 28 }), bright, T(0, hsY + 1.5, hsZ - 0.6, -Math.PI / 2, 0, 0));
  [-3.2, 3.2].forEach((cx) => tk.add(revolve([[1.05, 0], [1.05, 0.6], [0, 0.6]], { segs: 24 }), bright, T(cx, hsY + 1.5, hsZ + 4.8, -Math.PI / 2, 0, 0)));

  // True solid Optical Roof-Pentaprism Glass Block seated above Fresnel focusing screen facing eyepiece (visible in cutaway!)
  const prismGlass = new THREE.Mesh(buildOpticalPentaprismGeo(), lib.get('innerGlass'));
  top.add(prismGlass);

  // Flush Rear Eyepiece seated at Y=+34.8 + clipped screenMat + reflective cover glass pane + 2 flanking Phillips screws!
  const E = DIM.eyepiece;
  const eyeFrame = rrPath(-E.w / 2 - 2.6, -E.h / 2 - 2.2, E.w / 2 + 2.6, E.h / 2 + 2.2, 1.8);
  eyeFrame.holes.push(rrPath(-E.w / 2, -E.h / 2, E.w / 2, E.h / 2, 0.9, new THREE.Path()));
  tk.add(slab(eyeFrame, 2.8, 0.45, 20, 0.4, 3), anod, T(E.x, E.y, E.z - 2.4));
  [-19.0, 18.2].forEach((sx) => addScrew(tk, anod, tk, flock, T(sx, 31.2, zShellBack + 0.08, 0, 0, 0), 1.05, true, 0.35));
  const screenMat = lib.prepare(new THREE.MeshBasicMaterial({ color: 0x111111, toneMapped: false }), {});
  const eyeScreen = new THREE.Mesh(prep(new THREE.PlaneGeometry(E.w, E.h)), screenMat);
  eyeScreen.scale.x = -1;
  eyeScreen.position.set(E.x, E.y, E.z - 1.1);
  eyeScreen.userData.part = 'finder'; eyeScreen.userData.noShadow = true;
  top.add(eyeScreen);
  tk.add(new THREE.PlaneGeometry(E.w, E.h), lib.get('windowGlass'), T(E.x, E.y, E.z - 0.25));
  const eyepieceMeshes = [eyeScreen];

  // Rectangular recessed Frame Counter window (ae1_top_mmgrid.png: X=+39.2, Z=-7.0, 6.0×7.0 mm)
  const ctrCv = canvas(128, 128), ctrTex = tex(ctrCv);
  tk.add(rbox(6.2, 0.6, 7.2, 0.3, 2), anod, T(39.2, B.deck + 0.1, -7.0));
  tk.add(new THREE.PlaneGeometry(5.2, 6.0), lib.prepare(new THREE.MeshBasicMaterial({ map: ctrTex }), {}), T(39.2, B.deck + 0.45, -7.0, -Math.PI / 2, 0, 0));

  // Authentic 1976 AE-1 red self-timer countdown LED seated inboard of the 'S' self-timer collar tab (AE-1 manual & Canon_AE-1_in_black.jpg!)
  const ledMat = lib.prepare(new THREE.MeshPhysicalMaterial({
    name: 'ae1SelfTimerLed', color: 0x5c0c0a, emissive: new THREE.Color(0xff1e16),
    emissiveIntensity: 0.08, roughness: 0.14, metalness: 0.04, clearcoat: 1.0, clearcoatRoughness: 0.05,
  }), {});
  tk.add(rbox(3.8, 2.2, 3.4, 0.45, 2), anod, T(26.8, B.deck + 1.15, -25.6));
  tk.add(revolve([[1.2, 0], [1.2, 0.65, 0.3], [0.85, 1.05], [0, 1.12]], { segs: 24 }), ledMat, T(26.8, B.deck + 1.8, -26.6, -0.68, Math.PI, 0));

  // Left-deck Animatable Battery-Check Button (-30.0, -4.5) + Crisp Engraved Serial Number (2811233 dead-on Canon_AE-1_top.jpg!) + Silver Φ Focal-Plane Mark!
  const batCheckBtn = new THREE.Group(); batCheckBtn.position.set(-30.0, B.deck, -4.5);
  { const bck = new Kit(); bck.add(revolve([[4.5, 0], [4.5, 1.5, 0.35], [3.8, 2.2, 0.4], [3.0, 2.4], [0, 2.4]], { segs: 36 }), bk, T(0, 0, 0, -Math.PI / 2, 0, 0)); bck.build(batCheckBtn); }
  top.add(batCheckBtn);
  tk.add(new THREE.PlaneGeometry(18.5, 4.6), lib.prepare(new THREE.MeshPhysicalMaterial({ map: serialTex(), transparent: true, alphaTest: 0.1, roughness: 0.25, metalness: 0.55 }), {}), T(-34.2, B.deck + 0.12, -23.0, -Math.PI / 2, 0, 0));
  tk.add(revolve([[2.2, 0], [2.2, 0.28], [1.65, 0.28]], { segs: 32 }), bright, T(-38.0, B.deck + 0.08, 0.0, -Math.PI / 2, 0, 0));
  tk.add(rbox(6.6, 0.25, 0.55, 0.1, 1), bright, T(-38.0, B.deck + 0.15, 0.0));
  tk.build(top);

  // Large Low-Profile Coaxial Shutter-Speed / ASA Dial (X=+59.5, Z=-12.0, r=14.0, h=2.6 mm, 42-tooth silver serrations — Canon_AE-1_top.jpg!)
  const dial = new THREE.Group(); dial.position.set(DIM.dial.x, B.deck, DIM.dial.z);
  const dialK = new Kit(), dMat = lib.get('chromeBright', { hover: hov.shutter });
  const { cv: dialCv, tex: dialTex } = speedDialTex(400);
  dialK.add(revolve([[DIM.dial.r - 0.8, 0], [DIM.dial.r - 0.8, DIM.dial.h - 1.5, 0.25]], { segs: 84 }), bk, T(0, 0, 0, -Math.PI / 2, 0, 0));
  dialK.add(revolve([[DIM.dial.r - 0.5, DIM.dial.h - 1.6], [DIM.dial.r, DIM.dial.h - 1.4, 0.3, 1], [DIM.dial.r, DIM.dial.h - 0.3, 0.3, 1], [DIM.dial.r - 0.8, DIM.dial.h]], { segs: 336, ribs: { n: 42, depth: 0.38, groove: 0.48, edge: 0.14 } }), dMat, T(0, 0, 0, -Math.PI / 2, 0, 0));
  dialK.add(new THREE.CircleGeometry(DIM.dial.r - 0.85, 56), lib.prepare(new THREE.MeshPhysicalMaterial({ map: dialTex, roughness: 0.32, metalness: 0.18 }), { hover: hov.shutter }), T(0, DIM.dial.h + 0.05, 0, -Math.PI / 2, 0, 0));
  const dialMeshes = dialK.build(dial, 'shutter');
  top.add(dial);

  // Coaxial Sculpted Compound-Curved Film-Advance Lever + Bold Ergonomic Crescent Thumb Rest (Canon_AE-1_top.jpg & Canon_AE-1_back.jpg!)
  const lever = new THREE.Group(); lever.position.set(DIM.lever.x, B.deck + DIM.dial.h + 0.04, DIM.lever.z);
  const levK = new Kit(), lMat = lib.get('blackEnamel', { hover: hov.crank });
  levK.add(revolve([[7.2, 0], [7.2, 2.75, 0.4], [6.2, 3.3], [0, 3.3]], { segs: 56 }), lMat, T(0, 0, 0, -Math.PI / 2, 0, 0));
  // Smooth swept curved lever neck flowing organically from round hub into crescent plastic tip
  const armSh = new THREE.Shape();
  armSh.moveTo(-4.8, 3.2);
  armSh.bezierCurveTo(-1.0, 6.2, 5.2, 4.4, 5.2, -0.4);
  armSh.bezierCurveTo(5.2, -5.8, 0.8, -11.6, -2.6, -15.6);
  armSh.bezierCurveTo(-4.4, -17.6, -7.8, -17.4, -9.2, -15.0);
  armSh.bezierCurveTo(-7.2, -9.6, -6.2, -2.4, -4.8, 3.2);
  levK.add(slab(armSh, 1.95, 0.5, 32, 0.55, 3), lMat, T(0, 0.75, 0, -Math.PI / 2, 0, 0));
  // Bold sculpted glossy-black ergonomic crescent thumb rest (matches rounded rear silhouette in Canon_AE-1_back.jpg!)
  const tipSh = new THREE.Shape();
  tipSh.moveTo(-3.4, -17.0);
  tipSh.bezierCurveTo(-11.0, -19.5, -23.5, -19.3, -32.2, -17.2);
  tipSh.bezierCurveTo(-34.6, -16.6, -34.8, -14.8, -32.0, -13.5);
  tipSh.bezierCurveTo(-24.2, -11.2, -14.8, -10.6, -7.8, -11.3);
  tipSh.bezierCurveTo(-3.6, -11.8, -1.8, -14.8, -3.4, -17.0);
  levK.add(slab(tipSh, 4.9, 1.15, 32, 0.55, 4), lMat, T(0, -1.6, 0, -Math.PI / 2, 0, 0));
  const leverMeshes = levK.build(lever, 'crank');
  top.add(lever);

  // Inboard Shutter Release + Independently Rotating A/L/S Collar w/ Forward-Pointing 'S' Self-Timer Tab (calibrated to overlay_0_front.png Y=44.5 mm!)
  const selfTimerCollar = new THREE.Group(); selfTimerCollar.position.set(DIM.release.x, B.deck, DIM.release.z);
  {
    const sck = new Kit();
    sck.add(revolve([[DIM.release.r + 0.2, 0], [DIM.release.r + 0.2, 3.55, 0.4], [DIM.release.r - 0.8, 4.0], [0, 4.0]], { segs: 56 }), bk, T(0, 0, 0, -Math.PI / 2, 0, 0));
    sck.add(rbox(3.8, 3.3, 4.6, 0.75, 3, 0.45), bk, T(-6.5, 2.05, -(DIM.release.r - 0.4)));
    sck.add(new THREE.PlaneGeometry(2.8, 2.8), lib.prepare(new THREE.MeshPhysicalMaterial({ map: selfTimerSTex(), transparent: true, alphaTest: 0.1, roughness: 0.3 }), {}), T(-6.5, 2.1, -(DIM.release.r + 1.98), 0, Math.PI, 0));
    sck.build(selfTimerCollar);
  }
  top.add(selfTimerCollar);
  const release = new THREE.Group(); release.position.set(DIM.release.x, B.deck, DIM.release.z);
  const relK = new Kit(), rMat = lib.get('blackEnamel', { hover: hov.release });
  relK.add(revolve([[DIM.release.r - 2.1, 0], [DIM.release.r - 2.1, 6.45, 0.45], [2.3, 7.0], [0, 7.0]], { segs: 48 }), rMat, T(0, 0, 0, -Math.PI / 2, 0, 0));
  relK.add(revolve([[2.2, 6.2], [2.2, 7.1, 0.25], [1.3, 7.1], [1.3, 4.4]], { segs: 36 }), bright, T(0, 0, 0, -Math.PI / 2, 0, 0));
  relK.add(new THREE.CircleGeometry(1.25, 28), flock, T(0, 7.06, 0, -Math.PI / 2, 0, 0));
  const releaseMeshes = relK.build(release, 'release');
  top.add(release);

  // Left-side Authentic 1976 Smooth Horizontally-Grooved Rewind Drum (h=6.9 mm -> Y=44.4 mm, NO vertical knurling!) + Flush Straight Brushed-Chrome Crank Bar (Canon_AE-1_top.jpg!)
  const rwSpin = new THREE.Group(); rwSpin.position.set(DIM.rewind.x, B.deck, DIM.rewind.z);
  {
    const rwK = new Kit();
    // Smooth glossy-black stepped mushroom drum with authentic single horizontal waist groove & capped flat top
    rwK.add(revolve([
      [11.0, 0], [11.0, 1.8, 0.3], [9.9, 2.5], [10.1, 4.3, 0.25],
      [9.4, 4.9], [10.1, 5.5, 0.25], [10.1, 6.6, 0.3], [9.3, 6.9], [0, 6.9],
    ], { segs: 64, crease: 28 }), bk, T(0, 0, 0, -Math.PI / 2, 0, 0));
    // Recessed diametral dark pocket housing the straight flush chrome crank bar
    rwK.add(rbox(18.0, 0.5, 4.8, 0.25, 1), intBlk, T(0, 6.75, 0));
    rwK.add(revolve([[3.0, -24.0], [3.0, 2.0]], { segs: 32 }), bright, T(0, 0, 0, -Math.PI / 2, 0, 0));
    [-1.8, 1.8].forEach((fx) => rwK.add(rbox(1.1, 7.5, 1.4, 0.25, 2), bright, T(fx, -21.5, 0)));
    rwK.build(rwSpin);
  }
  const rwCrankPivot = new THREE.Group(); rwCrankPivot.position.set(7.6, 6.8, 0.0);
  {
    const rck = new Kit();
    // Authentic straight brushed-chrome rectangular folding rewind crank bar (17.5 × 4.3 × 1.1 mm) recessed flush across the drum top!
    const rcS = rrPath(-16.2, -2.1, 1.6, 2.1, 1.4);
    rck.add(slab(rcS, 1.1, 0.25, 20, 0.45, 2), bright, T(0, -0.35, 0, -Math.PI / 2, 0, 0));
    rck.build(rwCrankPivot);
  }
  // Independently hinged folding fingertip spinner: folds flush horizontally at rest (doorK=0), flips upright when rewinding/open!
  const rwTipPivot = new THREE.Group(); rwTipPivot.position.set(-14.6, 0.4, 0.0);
  {
    const rtk = new Kit();
    rtk.add(revolve([[1.35, 0], [1.55, 0.2, 0.25, 1], [1.55, 3.6, 0.25, 1], [1.3, 3.8], [0, 3.8]], { segs: 160, ribs: { n: 20, depth: 0.14 } }), bright, T(0, 0, 0, -Math.PI / 2, 0, 0));
    rtk.build(rwTipPivot);
  }
  rwCrankPivot.add(rwTipPivot);
  rwSpin.add(rwCrankPivot);
  top.add(rwSpin);

  // All-Black Bottom Plate (Y = -30.8..-25.0) — 4 Phillips screws, capped 15.6 mm silver winder coin cap, oval clutch recess + chrome button, tripod collar & twin winder contacts!
  const botPlan = ae1PlanShape(B.x0, B.x1, B.zF, zShellBack, 0);
  btk.add(slab(botPlan, B.baseY - B.y0, 0.9, 28, 0.7, 3), bk, T(0, B.y0, 0, -Math.PI / 2, 0, 0));
  // 15.6 mm bright-chrome slotted power-winder coupler coin cap (properly capped with [0, 0.52]!)
  btk.add(revolve([[7.8, 0], [7.8, 0.45, 0.25], [7.3, 0.52], [0, 0.52]], { segs: 56 }), bright, T(59.0, B.y0 - 0.02, -13.5, Math.PI / 2, 0, 0));
  btk.add(rbox(11.4, 0.36, 1.5, 0.15, 1), anod, T(59.0, B.y0 - 0.46, -13.5, 0, -0.26, 0));
  // Sunken contoured oval rewind-clutch recess + capped bright chrome release button
  const clutchFrame = rrPath(-5.0, -5.8, 5.0, 5.8, 3.2); clutchFrame.holes.push(rrPath(-3.6, -4.4, 3.6, 4.4, 2.4, new THREE.Path()));
  btk.add(slab(clutchFrame, 0.75, 0.2, 20, 0.4, 2), anod, T(41.5, B.y0 - 0.04, -5.2, Math.PI / 2, 0, 0));
  btk.add(revolve([[2.3, 0], [2.3, 0.55, 0.25], [1.95, 0.65], [0, 0.65]], { segs: 36 }), bright, T(41.5, B.y0 - 0.06, -5.6, Math.PI / 2, 0, 0));
  // Subtle debossed GLASS WORKS / JAPAN marking matching Canon_AE-1_bottom.jpg!
  btk.add(new THREE.PlaneGeometry(17.0, 7.5), lib.prepare(new THREE.MeshPhysicalMaterial({ map: bottomEmbossTex(), transparent: true, alphaTest: 0.08, roughness: 0.45 }), {}), T(24.0, B.y0 - 0.08, -7.8, Math.PI / 2, 0, Math.PI));
  // Bright-chrome 1/4"-20 tripod socket collar (properly capped inner bore!)
  btk.add(revolve([[4.6, 0], [4.6, 0.62, 0.25], [2.8, 0.62], [2.8, -3.2], [0, -3.2]], { segs: 40 }), bright, T(DIM.socket.x, B.y0 - 0.02, DIM.socket.z, Math.PI / 2, 0, 0));
  // Twin silver power-winder electrical contacts in recessed oval insulator (-X corner, properly capped with [0, 0.55]!)
  btk.add(rbox(4.6, 0.45, 8.8, 1.7, 3), anod, T(-59.2, B.y0 - 0.04, -12.5));
  [-14.3, -10.7].forEach((cz) => btk.add(revolve([[1.4, 0], [1.4, 0.55, 0.15], [0, 0.55]], { segs: 32 }), bright, T(-59.2, B.y0 - 0.06, cz, Math.PI / 2, 0, 0)));
  // All 4 authentic baseplate Phillips screws (including front -X corner!)
  [[71.2, -17.5], [70.2, -7.0], [-63.0, -7.0], [-62.2, -17.2]].forEach(([sx, sz]) => addScrew(btk, anod, btk, flock, T(sx, B.y0 - 0.06, sz, Math.PI / 2, 0, 0), 1.3, true, 0.5));
  btk.build(bottom);

  // True +X Hinged Rear Film Door (hinged at X=+66.8, spans X=-62.1..+66.5 -> 100% light-tight seal over cavL=-60.8!)
  const doorW = 128.6, doorH = 42.5, doorCX = 2.2, doorCY = -1.2, hingeX = doorCX + doorW / 2 + 0.3;
  doorPivot.position.set(hingeX, doorCY, zShellBack - 0.2);
  const dx = doorCX - hingeX;
  dk.add(rbox(doorW, doorH, 1.0, 0.5, 2, 0.5), bk, T(dx, 0, 0));
  dk.add(rbox(doorW - 4.5, doorH - 3.6, 0.55, 0.35, 2), leather, T(dx, 0, 0.42));
  dk.add(revolve([[1.2, -21.0], [1.2, 21.0, 0.3]], { segs: 28 }), bk, T(0, 0, -0.2, Math.PI / 2, 0, 0));
  // Outer matte-black film-box memo holder DEAD-CENTERED on optical axis (X=0.0 -> local -hingeX) + 2 capped circular rivets!
  const memo = rrPath(-27.2, -18.5, 27.2, 16.5, 1.2); memo.holes.push(rrPath(-16.5, -13.2, 16.5, 12.2, 0.7, new THREE.Path()));
  dk.add(slab(memo, 1.5, 0.3, 20, 0.4, 2), anod, T(-hingeX, -2.1 - doorCY, 0.65));
  [-23.2, 23.2].forEach((rx) => dk.add(revolve([[1.9, 0], [1.9, 0.55], [0, 0.55]], { segs: 28 }), bk, T(rx - hingeX, 4.0 - doorCY, 2.05)));
  // INSIDE OF SWINGING REAR DOOR (Canon_AE-1_back_open.jpg!):
  // 0. Dead-flat black anti-reflection inner door backing liner
  dk.add(rbox(doorW - 2.0, doorH - 2.0, 0.35, 0.2, 1), intBlk, T(dx, 0, -0.58));
  // 1. Stepped recessed dead-flat black perimeter light-trap flange
  const trap = rrPath(dx - doorW / 2 + 1.4, -doorH / 2 + 1.4, dx + doorW / 2 - 1.4, doorH / 2 - 1.4, 0.8);
  trap.holes.push(rrPath(dx - doorW / 2 + 4.4, -doorH / 2 + 4.2, dx + doorW / 2 - 4.4, doorH / 2 - 4.2, 0.5, new THREE.Path()));
  dk.add(slab(trap, 1.8, 0.2, 16), intBlk, T(0, 0, -2.2));
  // 2. Gleaming vertical stainless film-guide roller pressing film onto the 8-tooth sprocket drum!
  dk.add(revolve([[2.2, -17.5], [2.2, 17.5, 0.3]], { segs: 36 }), bright, T(36.0 - hingeX, 0, -2.4, Math.PI / 2, 0, 0));
  // 3. Spring-mounted satin-matte black precision film pressure plate (48×32 mm) + twin capped bright chrome retaining studs + leaf springs!
  dk.add(rbox(48.0, 32.0, 1.1, 0.35, 2, 0.4), pPlate, T(-hingeX, -doorCY, -2.3));
  [-11.5, 11.5].forEach((py) => dk.add(revolve([[1.6, 0], [1.6, 0.6], [0, 0.6]], { segs: 28 }), bright, T(-hingeX, -doorCY + py, -2.9, Math.PI, 0, 0)));
  [-16.0, 16.0].forEach((px) => dk.add(rbox(14.0, 2.2, 0.7, 0.15, 1), steel, T(-hingeX + px, -doorCY, -1.3)));
  dk.add(rbox(3.0, 14.0, 2.6, 0.3, 1), intBlk, T(dx - doorW / 2 + 2.0, 0, -1.8));
  dk.build(doorPivot);

  return {
    core, top, bottom, door: doorPivot, doorRestZ: zShellBack - 0.2, batDoorPivot, mirrorPivot,
    curtain1Cloth, curtain1Lath, curtain2Cloth, curtain2Lath, dofLever,
    stopDownPin, apSignalPin, sprocket, takeup, filmCart, filmStrip, filmTex, ledMat,
    backlightBtn, previewBtn, batCheckBtn, selfTimerCollar,
    dial, dialCv, dialTex, dialMeshes, release, releaseMeshes, lever, leverMeshes, rwSpin, rwCrankPivot, rwTipPivot,
    screenMat, eyeScreen, eyepieceMeshes, ctrCv, ctrTex,
  };
}

// ───────── Canon FD Breech-Lock Lens Builder ─────────
function buildLens(lib, lens, hov) {
  const def = lensDef(lens), group = new THREE.Group();
  const bk = lib.get('lensBlack'), chrome = lib.get('chrome'), steel = lib.get('steel'), flock = lib.get('flock'), rubber = lib.get('rubber');
  const atlas = lensAtlas(lens, def);
  const eng = (h) => lib.prepare(new THREE.MeshPhysicalMaterial({ name: `ae1LensEng_${lens.id}`, color: 0xffffff, map: atlas, metalness: 0.12, roughness: 0.44 }), { hover: h, wear: 'paint' });
  const oSpec = lensOpticsFor(lens);
  const lensGlassU = {
    blades: def.blades || 8,
    optics: { value: new THREE.Vector4(15, 1.0, def.glassR, 14.0) },
    state: { value: new THREE.Vector4(0, oSpec.pupilMag ?? 1.0, 0, 0) },
    ghostA: { value: new THREE.Color(...(oSpec.ghostTintA || [0.34, 0.70, 0.46])) },
    ghostB: { value: new THREE.Color(...(oSpec.ghostTintB || [0.68, 0.28, 0.56])) },
  };
  const glassMat = lib.prepare(lib.base.glass.clone(), { lensGlass: lensGlassU });

  const L = def.L;
  // Iconic silver chrome FD breech-lock ring at rear (z = 0..-9.5) — rotates independently while lens barrel stays aligned!
  const breechRing = new THREE.Group(); group.add(breechRing);
  {
    const brk = new Kit();
    brk.add(revolve([[def.rBreech - 1.4, 0], [def.rBreech, -0.8, 0.5], [def.rBreech, -2.0, 0.3], [def.rBreech + 0.35, -2.4, 0.4, 1], [def.rBreech + 0.35, -7.2, 0.4, 1], [def.rBreech, -7.6, 0.3], [def.rBreech, -8.8, 0.45], [def.rBreech - 1.5, -9.5]], { segs: 224, crease: 30, ribs: { n: 28, depth: 0.34, groove: 0.46, edge: 0.18 } }), chrome);
    [-85, 95].forEach((a) => brk.add(rbox(2.6, 5.4, 7.6, 0.7, 2, 0.5), chrome, radialT(a * DEG, def.rBreech + 0.6, -4.8)));
    brk.add(new THREE.SphereGeometry(1.1, 14, 10), lib.get('red'), T(0, def.rBreech + 0.25, -4.8));
    brk.build(breechRing);
  }
  const fixed = new Kit();
  // Fixed DoF index band (z = -18.5..-25.5) with slim machined chrome accent collar + raised red IR index dot + baffled rear element seal
  fixed.add(revolve([[def.rAp + 0.15, -18.4], [def.rAp + 0.15, -19.2, 0.4], [def.rAp, -19.4]], { segs: 96, crease: 30 }), chrome);
  fixed.add(bandRow(revolve([[def.rAp, -25.5], [def.rAp, -19.4]], { segs: 96, uv: 'band' }), 1), eng(null));
  fixed.add(new THREE.SphereGeometry(0.55, 12, 10), lib.get('red'), radialT(7.5 * DEG, def.rAp + 0.05, -24.2));
  const rearBaf = new THREE.RingGeometry(15.2, def.rBreech - 1.6, 48); rearBaf.translate(0, 0, -2.0);
  fixed.add(rearBaf, flock);
  fixed.add(new THREE.CircleGeometry(15.6, 48), flock, T(0, 0, -5.5)); // light-tight internal baffle behind rear element
  fixed.add(revolve([[0, -2.2], [8.5, -2.6], [15.2, -3.8]], { segs: 40 }), lib.get('innerGlass')); // gleaming rear FD optical element facing mirror box!
  fixed.build(group);

  // Aperture ring (z = -9.5..-18.4) with crisp 72-tooth knurling (segs=8*72=576!), green 'A' auto mark & chrome AE-lock release pin w/ green bezel
  const aperture = new THREE.Group(); group.add(aperture);
  const ak = new Kit(), aMat = lib.get('lensBlack', { hover: hov.aperture });
  ak.add(revolve([[def.rAp - 0.3, -9.6], [def.rAp + 0.25, -10.1, 0.4, 1], [def.rAp + 0.25, -13.0, 0.4, 1], [def.rAp, -13.3]], { segs: 576, ribs: { n: 72, depth: 0.32, groove: 0.48, edge: 0.16 } }), aMat);
  ak.add(bandRow(revolve([[def.rAp, -18.4], [def.rAp, -13.2]], { segs: 96, uv: 'band' }), 2), eng(hov.aperture));
  // Iconic Canon FD chrome AE-lock pin seated inside a crisp green-anodized collar ring!
  ak.add(revolve([[1.95, 0], [1.95, 0.65, 0.18], [1.55, 0.72]], { segs: 28 }), lib.get('green'), radialT(-32 * DEG, def.rAp - 0.1, -11.5));
  ak.add(revolve([[1.42, 0.4], [1.42, 1.85, 0.32], [1.05, 2.15], [0, 2.15]], { segs: 28 }), chrome, radialT(-32 * DEG, def.rAp - 0.1, -11.5));
  const apertureMeshes = ak.build(aperture, 'aperture');

  // Focusing ring (true 3D multi-row Canon FD checkerboard waffle rubber grip, segs=6*84=504 + engraved green ft / white m distance scale)
  const focus = new THREE.Group(); group.add(focus);
  const fk = new Kit(), fMat = lib.get('knurl', { hover: hov.focus });
  const zF0 = -25.6;
  const zF1 = def.builtInHood ? -(L - def.hoodLen - 1.5) : def.profile === 'flare' ? -(L - 14.0) : -Math.max(36.5, L - 11.0);
  fk.add(bandRow(revolve([[def.rFocus - 0.4, zF0 - 7.5], [def.rFocus - 0.4, zF0]], { segs: 120, uv: 'band' }), 0), eng(hov.focus));
  const zW0 = zF0 - 7.5, wSpan = zW0 - zF1, wRows = wSpan > 11.5 ? 3 : 2;
  const wProf = [[def.rFocus - 0.3, zW0]];
  for (let b = 0; b < wRows; b++) {
    const zb0 = lerp(zW0, zF1, b / wRows), zb1 = lerp(zW0, zF1, (b + 1) / wRows);
    wProf.push([def.rFocus + 0.3, zb0 - (b === 0 ? 0.55 : 0.32), 0.35, 1], [def.rFocus + 0.3, zb1 + (b === wRows - 1 ? 0.55 : 0.32), 0.35, 1]);
    if (b < wRows - 1) wProf.push([def.rFocus - 0.25, zb1, 0.16]);
  }
  wProf.push([def.rFocus - 0.3, zF1]);
  fk.add(revolve(wProf, { segs: 504, ribs: { n: 84, depth: 0.44, groove: 0.46, edge: 0.18 } }), fMat);
  // Slim anodized metal retention cheeks framing the rubber waffle grip
  fk.add(revolve([[def.rFocus - 0.35, zW0 + 0.1], [def.rFocus - 0.05, zW0 - 0.05], [def.rFocus - 0.05, zW0 - 0.55], [def.rFocus - 0.35, zW0 - 0.65]], { segs: 96, crease: 26 }), bk);
  if (def.profile === 'portrait' || def.profile === 'tele') {
    fk.add(revolve([[def.rFocus - 0.2, zF1 + 0.2], [def.rFocus + 0.25, zF1 - 0.1, 0.2], [def.rFocus + 0.25, zF1 - 1.1, 0.2], [def.rFront, zF1 - 1.4]], { segs: 96, crease: 26 }), chrome);
  }
  const focusMeshes = fk.build(focus, 'focus');

  // Extending front barrel — individually sculpted per focal length (Law #27!)
  const ext = new THREE.Group(); group.add(ext);
  const ek = new Kit();
  const rInnerFace = Math.min(def.thread - 3.6, def.glassR + (def.funnelPad ?? 0.2));
  if (def.profile === 'flare') {
    // 24mm f/2.8 retrofocus flared wide bell widening from narrow focus waist to broad 55 mm nose
    ek.add(revolve([
      [def.thread, -L], [def.rFront - 0.7, -L, 0.55], [def.rFront, -L + 1.0, 0.55], [def.rFront, -L + 6.5, 0.4],
      [def.rFocus - 0.6, zF1 + 1.2, 0.45], [def.rFocus - 1.6, zF1 + 2.2],
    ], { segs: 96, crease: 30 }), bk);
    ek.add(revolve([[def.rFront + 0.08, -L + 6.4], [def.rFront + 0.25, -L + 6.8, 0.2], [def.rFront + 0.25, -L + 7.5, 0.2], [def.rFront - 0.2, -L + 7.8]], { segs: 96, crease: 26 }), chrome);
  } else if (def.profile === 'stepped') {
    // 35mm f/2 S.S.C. Concave taller stepped barrel with machined front collar
    ek.add(revolve([
      [def.thread, -L], [def.rFront - 0.7, -L, 0.5], [def.rFront, -L + 0.9, 0.5], [def.rFront, -L + 7.5, 0.35],
      [def.rFront + 0.9, -L + 9.2, 0.4], [def.rFront + 0.9, zF1 + 1.0], [def.rFocus - 1.5, zF1 + 2.0],
    ], { segs: 96, crease: 30 }), bk);
  } else if (def.profile === 'portrait') {
    // 85mm f/1.8 sculpted portrait taper with broad bright front barrel
    ek.add(revolve([
      [def.thread, -L], [def.rFront - 0.8, -L, 0.55], [def.rFront, -L + 1.1, 0.55], [def.rFront, -L + 8.0, 0.4],
      [def.rFocus - 0.4, zF1 + 0.6, 0.4], [def.rFocus - 1.6, zF1 + 2.0],
    ], { segs: 96, crease: 30 }), bk);
  } else if (def.profile === 'tele') {
    // 135mm f/2.8 slender inner telephoto barrel cleanly seated inside the permanently-parked sliding metal hood!
    ek.add(revolve([
      [def.thread, -L], [def.rFront - 0.6, -L, 0.45], [def.rFront, -L + 0.8, 0.45], [def.rFront, zF1 + 1.0],
      [def.rFocus - 1.5, zF1 + 2.0],
    ], { segs: 96, crease: 30 }), bk);
  } else {
    // 50mm f/1.4 (locked exact envelope) & compact 28mm f/2.8
    ek.add(revolve([[def.thread, -L], [def.rFront - 0.7, -L, 0.55], [def.rFront, -L + 0.9, 0.55], [def.rFront, zF1 + 1.0], [def.rFocus - 1.5, zF1 + 2.0]], { segs: 96, crease: 30 }), bk);
  }
  // Subtle exposed bright machined aluminum filter-mouth rim chamfer + stepped internal 55 mm filter thread grooves
  ek.add(revolve([[def.thread - 0.08, -L + 0.26], [def.thread + 0.36, -L + 0.02]], { segs: 96 }), steel);
  const thrProf = [];
  for (let i = 0; i < 6; i++) {
    const zt = -L + 0.6 + i * 0.55;
    thrProf.push([def.thread, zt], [def.thread - 0.35, zt + 0.25], [def.thread, zt + 0.5]);
  }
  ek.add(revolve(thrProf, { segs: 84, crease: 20 }), flock);
  // Recessed miniature slotted barrel alignment grub screws on the front extending skirt
  if (!def.builtInHood) {
    [-90, 90].forEach((a) => addScrew(ek, steel, ek, flock, radialT(a * DEG, def.rFront - 0.04, -L + 3.4), 0.72, false, 0.2));
  }
  // Forward-sloping conical FD S.S.C. nameplate bezel (ZERO occlusion by front meniscus glass!)
  const ring = new THREE.RingGeometry(rInnerFace, def.thread - 0.2, 84); ring.rotateY(Math.PI);
  const rPos = ring.attributes.position;
  for (let i = 0; i < rPos.count; i++) {
    const r = Math.hypot(rPos.getX(i), rPos.getY(i));
    const u = Math.max(0, Math.min(1, (r - rInnerFace) / Math.max(0.1, def.thread - 0.2 - rInnerFace)));
    rPos.setZ(i, lerp(-L + 3.6, -L + 2.1, u)); // slopes gently forward toward filter ring!
  }
  ring.computeVertexNormals();
  ek.add(ring, lib.prepare(new THREE.MeshPhysicalMaterial({ name: `ae1Front_${lens.id}`, map: frontRingTex(lens, def), metalness: 0.14, roughness: 0.40 }), {}));
  // Concentric stepped anti-reflection funnel for smaller-glass compact primes (28mm f/2.8!)
  const zGlassEdge = def.funnelPad >= 1.5 ? -L + 6.4 : -L + 3.7;
  if (rInnerFace - def.glassR > 0.6) {
    const bafProf = [];
    for (let i = 0; i < 4; i++) {
      const rA = lerp(rInnerFace, def.glassR + 0.2, i / 4), rB = lerp(rInnerFace, def.glassR + 0.2, (i + 1) / 4);
      const zA = lerp(-L + 3.6, zGlassEdge, i / 4), zB = lerp(-L + 3.6, zGlassEdge, (i + 1) / 4);
      bafProf.push([rA, zA], [rA - 0.28, zB], [rB, zB]);
    }
    ek.add(revolve(bafProf, { segs: 72, crease: 20 }), flock);
  } else {
    // Crisp machined retaining cell bevel hugging the front glass perimeter
    ek.add(revolve([[rInnerFace + 0.1, -L + 3.55], [def.glassR + 0.35, -L + 3.25, 0.15], [def.glassR + 0.1, -L + 3.7]], { segs: 84 }), bk);
  }
  // Dual opposing retaining-ring spanner-wrench notches (180° apart!)
  [-1, 1].forEach((s) => ek.add(rbox(1.5, 0.58, 0.55, 0.08, 1), flock, T(s * (rInnerFace + 0.42), 0, -L + 3.42)));
  ek.add(new THREE.CircleGeometry(def.glassR + 0.4, 48), flock, T(0, 0, zGlassEdge + 1.0, 0, Math.PI, 0));
  ek.build(ext);
  // Standalone local-origin front meniscus glass (Law #17!) — authentic CONCAVE front element on legendary FD 35mm f/2 S.S.C.!
  const glassProf = def.concave
    ? [[0, -L + 4.85], [def.glassR * 0.42, -L + 4.40], [def.glassR * 0.78, -L + 3.40], [def.glassR + 0.2, -L + 2.40]]
    : [[0, zGlassEdge - 1.3], [def.glassR * 0.45, zGlassEdge - 0.95], [def.glassR * 0.8, zGlassEdge - 0.4], [def.glassR + 0.2, zGlassEdge]];
  const glassMesh = new THREE.Mesh(prep(revolve(glassProf, { segs: 64 })), glassMat);
  ext.add(glassMesh);

  // Lazy 3D Canon FD Breech-Lock Rear Bayonet Hardware (built when detached / exploded — Law #27!)
  const rearMount = new THREE.Group(); rearMount.visible = false; group.add(rearMount);
  let rearBuilt = false;
  const ensureRear = () => {
    if (rearBuilt) return false;
    rearBuilt = true;
    const rk = new Kit(), intBlk = lib.get('interiorBlack'), anod = lib.get('anod');
    const rearGlassMat = lib.prepare(new THREE.MeshPhysicalMaterial({ name: `ae1RearGlass_${lens.id}`, color: 0x0b1f1a, metalness: 0.14, roughness: 0.03, clearcoat: 1.0, clearcoatRoughness: 0.02, specularIntensity: 1.0, envMapIntensity: 1.75 }), {});
    const arcSector = (rIn, rOut, a0, a1) => {
      const s = new THREE.Shape(); s.absarc(0, 0, rOut, a0, a1, false); s.absarc(0, 0, rIn, a1, a0, true); s.closePath(); return s;
    };
    // Machined stainless FD rear seating flange (z = 0..+1.5 mm) + 4 miniature flange screws
    rk.add(revolve([[20.8, 0.0], [29.4, 0.0], [29.4, 1.25, 0.3], [28.6, 1.5], [21.0, 1.5], [21.0, 0.2]], { segs: 84, crease: 28 }), steel);
    [25, 115, 205, 295].forEach((a) => addScrew(rk, chrome, rk, flock, T(Math.cos(a * DEG) * 26.4, Math.sin(a * DEG) * 26.4, 1.52), 0.95, true, 0.3));
    // Undercut dark anodized cylindrical throat + 3 watertight beveled stainless FD breech alignment wings (z = +2.9..+4.55 mm w/ 1.4 mm shadow gap!)
    rk.add(revolve([[20.6, 1.45], [21.4, 1.45], [21.4, 3.05], [20.4, 3.05]], { segs: 72, crease: 26 }), anod);
    [0, 120, 240].forEach((a0) => {
      rk.add(slab(arcSector(20.6, 25.0, (a0 - 22) * DEG, (a0 + 24) * DEG), 1.65, 0.22, 24, 0.45, 2), chrome, T(0, 0, 2.9));
    });
    // Matte-black inner rear shroud + watertight curved rear-element protective guard fin
    rk.add(revolve([[15.6, 0.2], [20.6, 0.2], [20.6, 4.6, 0.3], [16.2, 5.2], [15.4, 4.2]], { segs: 72, crease: 28 }), intBlk);
    rk.add(slab(arcSector(15.2, 17.6, 115 * DEG, 232 * DEG), 3.6, 0.25, 24, 0.4, 2), intBlk, T(0, 0, 4.3));
    // Iconic Canon FD Rear Linkages: curved chrome Auto-Diaphragm Stop-Down Lever (-112°), AE Signal Lever (-34° w/ red collar), & Full-Aperture Pin (+48° capped!)
    const levA = -112 * DEG;
    rk.add(rbox(1.5, 5.2, 6.8, 0.35, 2), chrome, T(Math.cos(levA) * 19.0, Math.sin(levA) * 19.0, 4.9, 0, 0, levA));
    const sigA = -34 * DEG;
    rk.add(rbox(1.4, 4.6, 6.0, 0.35, 2), steel, T(Math.cos(sigA) * 19.0, Math.sin(sigA) * 19.0, 4.5, 0, 0, sigA));
    rk.add(revolve([[1.3, 0], [1.3, 1.2, 0.2], [0, 1.2]], { segs: 24 }), lib.get('red'), T(Math.cos(sigA) * 19.0, Math.sin(sigA) * 19.0, 7.1));
    const pinA = 48 * DEG;
    rk.add(revolve([[1.35, 0], [1.35, 4.6, 0.25], [1.0, 5.0], [0, 5.0]], { segs: 24 }), chrome, T(Math.cos(pinA) * 23.2, Math.sin(pinA) * 23.2, 1.5));
    // Outward-facing (+Z) glossy multi-coated convex rear optical meniscus element (r descending -> nz > 0!)
    rk.add(revolve([[15.8, 2.6], [15.0, 2.9], [15.0, 2.0]], { segs: 48 }), anod);
    rk.add(new THREE.CircleGeometry(15.2, 48), intBlk, T(0, 0, 1.3));
    rk.add(revolve([[15.2, 2.25], [13.2, 2.95], [7.6, 4.15], [0, 4.65]], { segs: 48 }), rearGlassMat);
    rk.build(rearMount);
    return true;
  };

  // Lazy cutaway optical elements (AE1_OPTICS)
  const inner = new THREE.Group(); inner.visible = false; ext.add(inner);
  let innerBuilt = false;
  const ensureInner = () => {
    if (innerBuilt) return false;
    innerBuilt = true;
    const ik = new Kit(), spec = AE1_OPTICS[lens.id] || AE1_OPTICS['fd-50-1.4'];
    const gInner = lib.get('innerGlass'), rimBlack = lib.get('anod');
    const zStart = -L + 5.2, zEnd = -4.0;
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

  // Lens hood: REAL permanently-parked telescoping metal sleeve on built-in telephotos (slides forward on hoodOn!), lazy bayonet shade on shorter primes!
  const hoodGroup = new THREE.Group(); hoodGroup.visible = Boolean(def.builtInHood); ext.add(hoodGroup);
  let hoodBuilt = false;
  const ensureHood = () => {
    if (hoodBuilt) return false;
    hoodBuilt = true;
    const hk = new Kit(), hl = def.hoodLen || 22.0;
    if (def.builtInHood) {
      const rOut = def.rFront + 1.55, rIn = def.rFront + 0.25;
      const zBack = -L + hl, zFront = -L + 0.4;
      // Telescoping anodized sleeve parked flush over front barrel [-L+hl .. -L+0.4] w/ knurled front grip lip + inner flocked baffle
      hk.add(revolve([
        [rIn, zFront], [rOut - 0.5, zFront, 0.35], [rOut, zFront + 0.6, 0.35],
        [rOut + 0.25, zFront + 1.2, 0.3, 1], [rOut + 0.25, zFront + 6.2, 0.3, 1],
        [rOut, zFront + 6.8, 0.3], [rOut, zBack - 0.6, 0.35], [rIn, zBack],
      ], { segs: 480, crease: 28, ribs: { n: 80, depth: 0.34, groove: 0.48, edge: 0.16 } }), bk);
      hk.add(revolve([[rIn, zBack], [rIn, zFront + 0.5]], { segs: 84 }), flock);
      hk.add(revolve([[rOut + 0.04, zFront + 0.4], [rOut + 0.14, zFront + 0.6, 0.15], [rOut + 0.14, zFront + 1.1, 0.15], [rOut, zFront + 1.2]], { segs: 84 }), chrome);
    } else {
      const rB = def.rFront + 0.8, rT = rB + hl * 0.25;
      hk.add(revolve([[rT - 0.6, -L - hl], [rT, -L - hl + 0.5, 0.5], [rB + 0.5, -L + 2.5], [rB - 0.8, -L + 2.5], [rT - 1.2, -L - hl + 0.8], [rT - 0.6, -L - hl]], { segs: 84, crease: 30 }), lib.get('anod'));
    }
    hk.build(hoodGroup);
    return true;
  };
  if (def.builtInHood) ensureHood();

  // Lazy 55 mm screw-in filter
  const filterGroup = new THREE.Group(); filterGroup.visible = false; ext.add(filterGroup);
  const filterMat = new THREE.MeshPhysicalMaterial({ name: `ae1Filter_${lens.id}`, color: 0xffffff, roughness: 0.03, transparent: true, opacity: 0.34, depthWrite: false });
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

  return { group, lens, def, L, lensGlassU, glassMesh, rearMount, breechRing, pupilMag: oSpec.pupilMag ?? 1.0, focalMm: oSpec.focalCalMm || lens.focalLength || 50, focus, aperture, ext, inner, hoodGroup, filterGroup, filterMat, ensureRear, ensureInner, ensureHood, ensureFilter, focusMeshes, apertureMeshes, filterMeshes };
}

// ───────── The Camera Factory ─────────
const PARTS = ['focus', 'aperture', 'shutter', 'filter', 'crank', 'release', 'finder', 'aim', 'roll'];

export function createCameraAE1({ lens }) {
  const t0 = performance.now();
  const clipPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 1e7);
  const base = baseMaterials();
  const P = (o) => new THREE.MeshPhysicalMaterial(o);
  // Iconic 1976 All-Black Canon AE-1 deep piano-gloss black lacquer over brass (rich deep jet black w/ tight crisp highlights!)
  base.blackEnamel = P({ name: 'ae1BlackEnamel', color: 0x040406, metalness: 0.08, roughness: 0.12, clearcoat: 1.0, clearcoatRoughness: 0.06, envMapIntensity: 0.68 });
  base.blackEnamel.userData.wear = 'blackChrome';
  // Dead-flat light-absorbing interior paint (zero Fresnel glare under overhead studio lighting!)
  base.interiorBlack = P({ name: 'ae1InteriorBlack', color: 0x020203, metalness: 0.0, roughness: 0.98, specularIntensity: 0.0, envMapIntensity: 0.04 });
  base.curtain = P({ name: 'ae1Curtain', color: 0x040405, roughness: 0.96, metalness: 0.0, specularIntensity: 0.0, envMapIntensity: 0.04, side: THREE.DoubleSide });
  base.pressurePlate = P({ name: 'ae1PressurePlate', color: 0x060608, roughness: 0.72, metalness: 0.04, clearcoat: 0.0, specularIntensity: 0.15, envMapIntensity: 0.18 });
  const lib = new MatLib(base, [clipPlane]);
  const hov = {};
  PARTS.forEach((name) => { hov[name] = { name, amount: { value: 0 }, color: { value: new THREE.Color(1.0, 0.82, 0.5).multiplyScalar(0.28) }, target: 0 }; });

  const root = new THREE.Group();
  root.name = 'camera503';
  root.userData.kind = 'ae1';
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
  const lensDyn = (Lx) => [Lx.group, Lx.breechRing, Lx.focus, Lx.ext, Lx.aperture, Lx.inner, Lx.hoodGroup, Lx.filterGroup, Lx.glassMesh, Lx.rearMount].filter(Boolean);
  const camDyn = [
    mm, body.core, body.top, body.bottom, body.door, body.batDoorPivot, body.mirrorPivot,
    body.curtain1Cloth, body.curtain1Lath, body.curtain2Cloth, body.curtain2Lath,
    body.dofLever, body.stopDownPin, body.apSignalPin, body.sprocket, body.takeup, body.filmCart, body.filmStrip,
    body.backlightBtn, body.previewBtn, body.batCheckBtn, body.selfTimerCollar,
    body.dial, body.release, body.lever, body.rwSpin, body.rwCrankPivot, body.rwTipPivot, body.eyeScreen,
    lensMount, head.yawMM, head.pitchMM, head.rollMM, head.bubble, blob,
  ];
  mergeStaticRigid(root, { dynamic: new Set([...camDyn, ...lensDyn(L)]), lists: [...lensLists(L), body.dialMeshes, body.leverMeshes, body.releaseMeshes, body.eyepieceMeshes, head.aimMeshes, head.rollMeshes] });
  const toLayer = (obj) => obj.traverse((o) => { if (!o.isMesh) return; o.layers.set(1); o.castShadow = !o.userData.noShadow && !o.material.transparent; o.receiveShadow = !o.userData.noShadow; });
  toLayer(root);

  const pickables = { focus: [], aperture: [], shutter: body.dialMeshes, filter: [], crank: body.leverMeshes, release: body.releaseMeshes, finder: body.eyepieceMeshes, aim: head.aimMeshes, roll: head.rollMeshes };
  function refreshPickables() {
    const set = (k, list) => { pickables[k].length = 0; if (list) pickables[k].push(...list); };
    set('focus', L.focusMeshes); set('aperture', L.apertureMeshes); set('filter', L.filterMeshes);
  }
  refreshPickables();

  const st = {
    focusRot: 0, focusT: 0, ext: 0, extT: 0, apRot: 0, apT: 0, dial: 0, dialT: 0,
    lever: 0, press: 0, mirrorK: 0, curtain1: 0, curtain2: 0, rewind: 0, dofK: 0, dofT: 0,
    doorK: 0, batDoorK: 0, filmLoaded: true, filmPhase: 0, ledGlow: 0,
    aeMode: false, aeAperture: 0, stopDown: 0, asaLift: 0,
    selfTimerK: 0, lockK: 0, batCheckK: 0, backlightK: 0, previewK: 0, crankOpen: 0,
    hoodOn: false, filterId: 'none', polAngle: 90,
    lensOut: 0, lensTwist: 0, explodeK: 0, snapRings: true,
  };
  const tweens = [];
  const tween = (dur, fn, ease = easeInOut, key = null) => new Promise((res) => tweens.push({ t: 0, dur, fn, ease, key, res }));
  const hold = (ms) => tween(Math.max(1e-3, ms / 1000), () => {}, (u) => u);
  const animate = (key, to, dur, ease) => {
    for (let i = tweens.length - 1; i >= 0; i--) if (tweens[i].key === key) { const [tw] = tweens.splice(i, 1); tw.res(); }
    const from = st[key];
    return tween(dur, (k) => { st[key] = lerp(from, to, k); }, ease, key);
  };

  let live = null, frameKey = -999, isoKey = 400;
  function ringTargets(s) {
    const ln = L.lens;
    const d = Math.max(s.focus ?? 10000, ln.minFocusDistance);
    st.focusT = d >= 9999 ? 0 : focusAngle(ln, d);
    st.extT = helicoidExtensionMm(ln, d);
    const ap = ln.apertureStops, last = ap.length - 1;
    if (s.aperture === 'A' || s.aperture === 'a' || s.aeMode) {
      st.aeMode = true;
      st.apT = -AP_STEP * 1.15;
    } else {
      st.aeMode = false;
      let N = typeof s.aperture === 'number' && s.aperture > 0 ? s.aperture : ap[0];
      N = Math.min(ap[last], Math.max(ap[0], N));
      let ai = last;
      for (let i = 0; i < last; i++) if (N <= ap[i + 1]) { ai = i + Math.log(N / ap[i]) / Math.log(ap[i + 1] / ap[i]); break; }
      st.apT = ai * AP_STEP;
    }
    if (typeof s.aeAperture === 'number') st.aeAperture = s.aeAperture;
    st.dialT = -((s.shutterIdx ?? 8) + 1) * DIAL_STEP;
    st.dofT = s.stopDown ? 1 : 0;
    const iso = Math.round(s.film?.iso ?? s.iso ?? 400);
    if (iso > 0 && iso !== isoKey) { isoKey = iso; drawSpeedDial(body.dialCv, iso); body.dialTex.needsUpdate = true; }
    if (s.hoodOn !== undefined) st.hoodOn = Boolean(s.hoodOn);
    if (s.filter !== undefined) st.filterId = (typeof s.filter === 'string' ? s.filter : s.filter?.id) || 'none';
    if (s.polAngle !== undefined) st.polAngle = s.polAngle ?? 90;
  }
  function drawCounter(s) {
    // Authentic AE-1 additive counter: auto-resets to S when back opens; S, 0, dots for odd frames, even numbers 2..38 with 20 & 36 in orange (AE-1 manual)!
    const raw = st.doorK > 0.15 ? -2 : Math.max(-2, Math.min(38, Math.round(s?.frame ?? 1)));
    if (raw === frameKey) return;
    frameKey = raw;
    const g = body.ctrCv.getContext('2d');
    g.fillStyle = '#0e0e10'; g.fillRect(0, 0, 128, 128);
    // Fixed white right-hand index tick (matches Canon_AE-1_top.jpg!)
    g.fillStyle = '#e8e5dc'; g.fillRect(92, 60, 26, 8);
    const labelFor = (n) => (n <= -2 ? 'S' : n === -1 ? '•' : n === 0 ? '0' : (n % 2 === 0 ? String(n) : '•'));
    const colorFor = (n) => (n === 20 || n === 36 ? '#e87a24' : '#f2efe6');
    g.textAlign = 'center'; g.textBaseline = 'middle';
    [-1, 0, 1].forEach((off) => {
      const n = raw + off;
      if (n < -2 || n > 38) return;
      const lbl = labelFor(n);
      g.fillStyle = colorFor(n);
      g.font = `700 ${lbl === '•' ? 34 : 44}px ${FONT}`;
      g.fillText(lbl, 48, 64 + off * 46);
    });
    body.ctrTex.needsUpdate = true;
  }

  let cutaway = false;
  function applyPose() {
    const e = easeInOut(st.explodeK);
    lensMount.position.z = DIM.flange - 105 * e - 65 * st.lensOut;
    lensMount.rotation.z = 0; // Canon FD breech-lock: lens barrel slides straight in while ONLY silver breech-lock ring turns!
    if (L.breechRing) L.breechRing.rotation.z = -st.lensTwist * (45 * DEG);
    body.top.position.y = 48 * e;
    body.bottom.position.y = -38 * e;
    body.door.position.z = body.doorRestZ + 38 * e;
    body.door.rotation.y = st.doorK * 2.18; // swings open +125° on +X hinge revealing roller, pressure plate & light-seal channels!
    body.batDoorPivot.rotation.y = st.batDoorK * 1.48; // +85° authentic hinge stop swings outward clearing mounted FD breech-lock ring cleanly!
    L.focus.rotation.z = st.focusRot;
    L.aperture.rotation.z = st.apRot;
    L.ext.position.z = -st.ext;
    // Live iris in lens glass trace (wide open for SLR viewing; stops smoothly down to manual ring or shutter-priority AE camera-chosen aperture!)
    { const ap = L.lens.apertureStops, last = ap.length - 1;
      const inAE = st.aeMode || st.apRot < -AP_STEP * 0.5;
      let Nwork;
      if (inAE || st.aeAperture > 0) {
        const chosen = st.aeAperture > 0 ? st.aeAperture : (inAE ? 8 : ap[0]);
        Nwork = Math.min(ap[last], Math.max(ap[0], chosen));
      } else {
        const ai = Math.min(last, Math.max(0, st.apRot / AP_STEP)), i0 = Math.min(last - 1, Math.floor(ai));
        Nwork = ap[i0] * Math.pow(ap[i0 + 1] / ap[i0], ai - i0);
      }
      const stopK = Math.max(0, Math.min(1, Math.max(st.dofK, st.mirrorK, st.stopDown || 0)));
      const N = ap[0] * Math.pow(Nwork / ap[0], stopK);
      const rIris = L.focalMm / (2 * N) / L.pupilMag;
      L.lensGlassU.optics.value.set(rIris, 1.0, L.def.glassR, 14.0);
      L.lensGlassU.state.value.set((1 - Math.min(1, rIris / 16)) * 0.5, L.pupilMag, st.ext, Math.max(e, st.lensOut)); }
    const rearVis = e > 0.001 || st.lensOut > 0.001;
    if (rearVis && L.ensureRear?.()) toLayer(L.rearMount);
    if (L.rearMount) L.rearMount.visible = rearVis;
    if (cutaway && L.ensureInner?.()) toLayer(L.inner);
    if (L.inner) L.inner.visible = cutaway;
    if (L.def.builtInHood) {
      L.hoodGroup.visible = true;
      L.hoodGroup.position.z = st.hoodOn ? -(L.def.hoodSlide || 34.0) : 0;
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
    body.dial.position.y = B.deck + 1.6 * (st.asaLift || 0);
    body.lever.rotation.y = -st.lever;
    body.selfTimerCollar.rotation.y = -0.45 * (st.selfTimerK || 0) + 0.42 * (st.lockK || 0);
    body.release.position.y = B.deck - 1.4 * st.press;
    body.batCheckBtn.position.y = B.deck - 1.1 * (st.batCheckK || 0);
    body.backlightBtn.position.x = -32.6 + 1.4 * (st.backlightK || 0);
    body.previewBtn.position.x = -32.6 + 1.4 * (st.previewK || 0);
    // Pull-up rewind knob lifts, silver crank unfolds cleanly & fingertip spinner flips from flush horizontal to upright!
    const crankK = Math.max(st.doorK, st.crankOpen || 0);
    body.rwSpin.rotation.y = st.rewind;
    body.rwSpin.position.y = B.deck + 10.5 * st.doorK;
    body.rwCrankPivot.rotation.z = -0.62 * crankK;
    body.rwTipPivot.rotation.z = lerp(-Math.PI / 2, 0.0, crankK); // tucked 100% flush at rest -> exact 87.0 mm height!
    // Front DoF preview slide + internal FD auto-diaphragm stop-down pin & aperture-signal pin
    body.dofLever.position.x = -39.8 + 2.8 * st.dofK;
    body.stopDownPin.position.y = 2.5 - 4.2 * Math.max(st.dofK, st.mirrorK, st.stopDown || 0);
    body.apSignalPin.position.x = -5.0 + Math.max(0, st.apRot) * 3.0;
    body.mirrorPivot.rotation.x = lerp(-Math.PI / 4, 0, st.mirrorK);
    // True Two-Curtain Horizontal Cloth Focal-Plane Shutter (non-clipping cloths + rigid steel laths!)
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
    // Rotating 8-tooth sprocket drum + Canon multi-slotted take-up spool + scrolling 35 mm film strip!
    body.sprocket.rotation.y = -st.filmPhase * TAU;
    body.takeup.rotation.y = -st.filmPhase * 0.68 * TAU;
    body.filmTex.offset.x = -st.filmPhase * 0.37;
    const showFilm = Boolean(st.filmLoaded);
    body.filmCart.visible = showFilm;
    body.filmStrip.visible = showFilm;
    body.ledMat.emissiveIntensity = 0.08 + 2.8 * st.ledGlow;
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
  let labels = [], labelEls = null, dotEls = null;
  function buildLabels() {
    labels.forEach((l) => l.o.parent?.remove(l.o));
    labels = [
      anchor(lensMount, 0, 38, -L.L / 2, 'FD Breech-Lock Lens', `${L.lens.focalLength} mm ƒ/${L.lens.maxAperture} S.S.C. · silver lock ring`),
      anchor(body.top, 0, B.prismY + 8, -12, 'Pentaprism Finder', 'upright, laterally correct eye-level SLR view'),
      anchor(body.dial, 0, 12, 0, 'Shutter-Speed Dial', 'electronic cloth focal plane · 2 s to 1/1000'),
      anchor(body.mirrorPivot, 0, -6, -12, 'Instant-Return Mirror', 'swings up on release and drops back after exposure'),
      anchor(body.door, 0, 0, B.zB + 8, 'Film Back', '35 mm cassette · 36 frames of 24 × 36 mm'),
    ];
  }
  buildLabels();

  const tmpQ = new THREE.Quaternion();
  const api = {
    root, parts: { mm, body, lensMount, get lens() { return L; } }, opticsMoving: false, cutSide: 1, pickables, buildMs: 0, st, timeScale: 1, applyPose,
    setAim(pan, tilt, roll = 0) { yaw.rotation.y = -Math.PI / 2 + pan; pitch.rotation.x = tilt; rollG.rotation.z = roll; root.updateMatrixWorld(true); },
    bodyCenter(v) { return mm.localToWorld(v.set(0, 4, -12)); },
    worldToBody(v) { return mm.worldToLocal(v); },
    setScreenTexture(tex) {
      body.screenMat.map = tex;
      body.screenMat.color.setScalar(0.95);
      body.screenMat.needsUpdate = true;
    },
    eyePose() {
      const q = rollG.getWorldQuaternion(new THREE.Quaternion());
      const E = DIM.eyepiece;
      const eye = mm.localToWorld(new THREE.Vector3(E.x, E.y, E.z + 24.0));
      const target = mm.localToWorld(new THREE.Vector3(E.x, E.y, E.z - 2.0));
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
      return { eye, target, up };
    },
    setRings(s) {
      live = s; ringTargets(s); drawCounter(s);
      if (st.snapRings) { st.focusRot = st.focusT; st.ext = st.extT; st.apRot = st.apT; st.dial = st.dialT; st.dofK = st.dofT; st.snapRings = false; }
    },
    setHood(on) {
      st.hoodOn = Boolean(on); if (live) live.hoodOn = st.hoodOn;
      if (L.def.builtInHood) { L.hoodGroup.visible = true; L.hoodGroup.position.z = st.hoodOn ? -(L.def.hoodSlide || 34.0) : 0; }
      else { if (st.hoodOn && L.ensureHood?.()) toLayer(L.hoodGroup); L.hoodGroup.visible = st.hoodOn; L.hoodGroup.position.z = 0; }
    },
    setFilter(filterId, polAngle = st.polAngle) { st.filterId = filterId || 'none'; st.polAngle = polAngle; if (live) { live.filter = st.filterId; live.polAngle = polAngle; } if (st.filterId !== 'none' && L.ensureFilter?.()) { toLayer(L.filterGroup); refreshPickables(); } },
    get hoodOn() { return Boolean(st.hoodOn); },
    get hasHood() { return true; },
    filmOffset() {
      const ep = lensOpticsFor(L.lens).entrancePupilMm || 25;
      return mm.localToWorld(new THREE.Vector3(0, 0, DIM.flange - L.L - st.ext + ep)).distanceTo(mm.localToWorld(new THREE.Vector3(0, 0, 0)));
    },
    lensPose(pos, quat) {
      const ep = lensOpticsFor(L.lens).entrancePupilMm || 25;
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
    setBatteryDoorOpen(on) { return animate('batDoorK', on ? 1 : 0, 0.4); },
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
      // True horizontal focal-plane shutter physics: speeds > 1/60 s form a real traveling slit between curtains 1 & 2!
      const travelSec = 0.032; // illustrative slowed curtain transit for educational observation
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
      // Single-stroke 120° film advance lever cocks both shutter curtains & advances 35 mm film by 1 frame (8 perforations!)
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
        if (cur === lensMount) return { text: 'FD Breech-Lock Lens', sub: `${L.lens.focalLength} mm ƒ/${L.lens.maxAperture} S.S.C. · rotating silver breech lock ring` };
        if (cur === body.dial) return { text: 'Shutter-Speed & ASA Dial', sub: '2 s – 1/1000 s electronic cloth focal-plane shutter · ASA 25–3200' };
        if (cur === body.lever) return { text: 'Single-Stroke Film Advance', sub: '120° throw cocks both cloth curtains & advances 8 sprocket perforations' };
        if (cur === body.release) return { text: 'Electromagnetic Release', sub: 'A/L/S collar · 10 s electronic self-timer with blinking red LED' };
        if (cur === body.rwSpin) return { text: 'Rewind Crank & Door Latch', sub: 'pull upward to unlatch rear 35 mm film door and unload cassette' };
        if (cur === body.mirrorPivot) return { text: 'Instant-Return 45° Mirror', sub: 'flips up before first curtain & drops back immediately after exposure' };
        if (cur === body.door) return { text: 'Hinged 35 mm Film Back', sub: 'spring pressure plate, sprocket guide roller & film-box memo holder' };
        if (cur === body.batDoorPivot) return { text: '4LR44 6V Battery Door', sub: 'powers CPU shutter-priority AE metering & electromagnetic shutter' };
        if (cur === body.top) return { text: 'Pentaprism Top Deck', sub: 'solid optical roof pentaprism · upright, laterally correct SLR view' };
        if (cur === body.bottom) return { text: 'Baseplate & Winder Coupler', sub: '1/4″ tripod bush, rewind clutch button & Power Winder A drive slot' };
        if (cur === body.core) return { text: 'Die-Cast SLR Chassis', sub: '24 × 36 mm film gate, twin cloth curtains & open FD mirror box' };
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
