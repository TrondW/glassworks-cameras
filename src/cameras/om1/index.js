// The camera: a 1976 Yoshihisa Maitani Olympus OM-1 MD ultra-compact 35 mm SLR in satin silver chrome & black leatherette,
// featuring the iconic concentric lens-mount shutter speed ring, bare sculptural peaked pentaprism, front-mounted Zuiko
// aperture ring w/ barrel DoF preview button, air-damper reflex mirror cutaway, and 7-lens OM-mount Zuiko prime lineup.
// Built strictly to SPEC.md & PLAYBOOK.md (24 Engineering Laws). Neutral GLASS WORKS legends; historic
// vector-traced OM-1 & MD model badges preserved.
//
// Model axes (CONTRACT.md): lens axis along -Z, +X = photographer's right, +Y up. Origin: lens axis on the film plane.
// Olympus OM-mount flange focal distance: 46.0 mm in front of the film (z = -46.0).
import * as THREE from 'three';
import { INK, PAINT_BG } from '../../lib/engrave.js';
import { addScrew, radialT, rbox, revolve, rrPath, slab } from '../../lib/geometry.js';
import { MatLib, baseMaterials } from '../../lib/materials.js';
import { Kit, mergeStaticRigid, prep } from '../../lib/mesh.js';
import { buildHead, buildTripod } from '../../lib/rig.js';
import { beadBlastMaps, brushedMap, vulcaniteMaps } from '../../lib/textures.js';
import { DEG, FONT, T, TAU, easeInOut, lerp } from '../../lib/util.js';
import { lensOpticsFor, helicoidExtensionMm, filterOpticsFor } from '../../optics.js';
export { flushCameraTextures } from '../../lib/textures.js';

export const DIM = {
  flange: -46.0,
  // Calibrated pixel-for-pixel to commons_om1_mount_front.jpg (s = 8.006 px/mm) & factory manual p-07 (136 × 83 × 81 mm w/ 50/1.8):
  // Shell x0=-62.2..+70.8 (133.0 mm chrome shell locking both flanks < 0.5 mm on overlay -> ~137.4 mm across front-corner D-rings); y0=-26.8..prismY=+55.5 = 82.3 mm body!
  body: { x0: -62.2, x1: 70.8, y0: -26.8, baseY: -22.5, seamY: 19.8, trimY: 22.8, deck: 35.5, prismY: 55.5, zF: -29.0, zB: 4.0 },
  eyepiece: { x: 0, y: 31.8, z: 5.0, w: 16.4, h: 12.2 },
  asa: { x: 26.0, z: -11.5, r: 10.6, h: 7.0 },
  release: { x: 43.2, z: -18.5, r: 5.4 },
  lever: { x: 54.8, z: -10.0, r: 9.4 },
  rewind: { x: -43.2, z: -12.0, r: 9.8 },
  socket: { x: 2.5, z: -14.0 },
  tripod: { apex: 1210, spread: 560 },
};
const B = DIM.body;
const AP_STEP = 16.5 * DEG;
const SHUTTER_LABELS = ['B', '1', '2', '4', '8', '15', '30', '60', '125', '250', '500', '1000'];
const SHUTTER_STEP = 10.5 * DEG; // 12 stops spaced cleanly across the top 115° arc of the concentric lens-mount ring!
const COC = 1 / 30;
const LEVER_STROKE = 150 * DEG; // Factory manual p-07: 150° wind stroke

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

// ───────── Olympus OM-Mount Zuiko Lens Definitions & Cutaway Prescriptions (manual p-37/38!) ─────────
const LENS_DEFS = {
  'zuiko-24-2.8':  { L: 31.0, focusPitch: 56 * DEG, blades: 6, rFront: 28.6, thread: 24.5, glassR: 16.6, rFocus: 29.0, rMount: 29.0, funnelPad: 0.7, silverNose: true,  serial: '184920',  profile: 'flare',    hoodStyle: 'screw', hoodLen: 12.5, prefix: 'H.ZUIKO AUTO-W' },
  'zuiko-28-3.5':  { L: 31.0, focusPitch: 50 * DEG, blades: 6, rFront: 28.2, thread: 24.5, glassR: 14.4, rFocus: 29.0, rMount: 29.0, funnelPad: 2.2, silverNose: true,  serial: '294612',  profile: 'compact',  hoodStyle: 'screw', hoodLen: 14.0, prefix: 'G.ZUIKO AUTO-W' },
  'zuiko-35-2.8':  { L: 33.0, focusPitch: 40 * DEG, blades: 6, rFront: 28.4, thread: 24.5, glassR: 16.2, rFocus: 29.2, rMount: 29.0, funnelPad: 1.4, silverNose: false, serial: '412809',  profile: 'stepped',  hoodStyle: 'slide', hoodLen: 16.0, prefix: 'G.ZUIKO AUTO-W' },
  'zuiko-50-1.8':  { L: 31.0, focusPitch: 32 * DEG, blades: 6, rFront: 28.2, thread: 24.5, glassR: 17.8, rFocus: 29.0, rMount: 29.0, funnelPad: 0.3, silverNose: false, serial: '3205879', profile: 'standard', hoodStyle: 'slide', hoodLen: 19.0, prefix: 'F.ZUIKO AUTO-S' },
  'zuiko-50-1.4':  { L: 36.0, focusPitch: 32 * DEG, blades: 8, rFront: 29.2, thread: 24.5, glassR: 19.6, rFocus: 30.0, rMount: 29.4, funnelPad: 0.3, silverNose: true,  serial: '1094582', profile: 'fast50',   hoodStyle: 'slide', hoodLen: 20.0, prefix: 'G.ZUIKO AUTO-S' },
  'zuiko-85-2':    { L: 46.0, focusPitch: 25 * DEG, blades: 8, rFront: 29.4, thread: 24.5, glassR: 19.8, rFocus: 30.2, rMount: 29.4, funnelPad: 0.3, silverNose: false, serial: '248195',  profile: 'portrait', hoodStyle: 'screw', hoodLen: 26.0, prefix: 'F.ZUIKO AUTO-T' },
  'zuiko-135-3.5': { L: 73.0, focusPitch: 19 * DEG, blades: 8, rFront: 28.4, thread: 24.5, glassR: 19.8, rFocus: 29.8, rMount: 29.4, funnelPad: 0.3, silverNose: true,  serial: '362418',  profile: 'tele',     builtInHood: true, hoodStyle: 'slide', hoodLen: 30.5, hoodSlide: 30.0, prefix: 'E.ZUIKO AUTO-T' },
};

const OM1_OPTICS = {
  'zuiko-24-2.8': [
    [0.08, 0.96, 2.6, 1.5, -1.0], [0.22, 0.80, 2.0, 2.3, -1.1], [0.36, 0.68, 3.2, 1.7, 3.6], [0.50, 0.58, 1.6, -2.0, 2.8],
    [0.62, 0.60, 1.6, -1.6, -4.4], [0.72, 0.68, 3.2, -4.4, 1.85], [0.84, 0.76, 2.2, 3.0, -2.8], [0.95, 0.82, 2.2, 3.4, -2.6],
  ],
  'zuiko-28-3.5': [
    [0.08, 0.94, 2.4, 1.6, -1.05], [0.23, 0.78, 2.0, 2.4, -1.2], [0.38, 0.68, 3.0, 1.8, 3.4], [0.54, 0.62, 1.6, -1.8, 2.8],
    [0.68, 0.66, 2.8, -4.0, 1.9], [0.82, 0.74, 2.2, 3.0, -2.6], [0.94, 0.80, 2.2, -2.6, 3.8],
  ],
  'zuiko-35-2.8': [
    [0.08, 0.94, 2.6, -2.0, -1.15], [0.24, 0.82, 2.8, 1.9, -2.4], [0.40, 0.72, 2.0, 2.4, -1.5], [0.58, 0.66, 1.6, -1.7, -4.4],
    [0.69, 0.74, 3.2, -4.4, 1.85], [0.83, 0.80, 2.4, 3.0, -3.2], [0.94, 0.86, 2.4, 3.4, -2.8],
  ],
  // Iconic F.Zuiko Auto-S 50mm f/1.8 (6 elements in 5 groups!)
  'zuiko-50-1.8': [
    [0.12, 0.95, 3.2, 2.1, -3.8], [0.32, 0.84, 2.8, 1.8, -2.6], [0.46, 0.72, 1.5, 3.2, -1.5],
    [0.64, 0.74, 1.5, -1.5, 3.2], [0.76, 0.84, 3.4, 3.2, -2.1], [0.92, 0.88, 2.6, 2.8, -3.4],
  ],
  // G.Zuiko Auto-S 50mm f/1.4 (7 elements in 6 groups double-Gauss!)
  'zuiko-50-1.4': [
    [0.10, 0.96, 3.6, 2.0, -3.8], [0.26, 0.86, 3.0, 1.8, -2.6], [0.40, 0.74, 1.7, 3.0, -1.4],
    [0.58, 0.74, 1.7, -1.45, 3.2], [0.68, 0.84, 3.6, 3.2, -2.0], [0.83, 0.88, 2.6, 2.6, -3.8], [0.94, 0.90, 2.8, 3.2, -3.0],
  ],
  'zuiko-85-2': [
    [0.09, 0.96, 4.0, 1.9, -3.6], [0.26, 0.86, 3.4, 1.8, -2.6], [0.44, 0.74, 1.8, -2.2, 1.7],
    [0.60, 0.76, 3.2, 3.0, -2.2], [0.78, 0.82, 2.8, 2.6, -3.4], [0.92, 0.84, 2.6, 3.0, -3.2],
  ],
  'zuiko-135-3.5': [
    [0.08, 0.96, 4.6, 2.0, -4.2], [0.24, 0.86, 2.4, -2.6, 2.0], [0.46, 0.74, 3.6, 2.6, -3.0],
    [0.70, 0.68, 2.2, -2.2, 2.8], [0.88, 0.64, 2.6, 3.0, -2.8],
  ],
};

const lensDef = (lens) => LENS_DEFS[lens.id] || LENS_DEFS['zuiko-50-1.8'];
const focusPitch = (lens) => lensDef(lens).focusPitch;
const focusAngle = (lens, d) => -focusPitch(lens) * helicoidExtensionMm(lens, d);
function distanceAt(lens, angle) {
  const ext = Math.max(0, angle) / focusPitch(lens);
  if (ext < 1e-4) return 10000;
  let lo = lens.minFocusDistance, hi = 10000;
  for (let i = 0; i < 40; i++) { const mid = Math.sqrt(lo * hi); if (helicoidExtensionMm(lens, mid) > ext) lo = mid; else hi = mid; }
  return Math.sqrt(lo * hi);
}

// ───────── Vector-Traced Historic OM-1 Top-Deck Engraving & Square MD Front Badge ─────────
function om1TopBadgeTex() {
  // Crisp geometric bold 'OM-1' engraved in satin-black on the -X satin-chrome top deck (ks_om1b_03.jpg & manual p-04!)
  const W = 768, H = 256, cv = canvas(W, H), g = cv.getContext('2d');
  g.clearRect(0, 0, W, H);
  g.fillStyle = '#111215';
  g.strokeStyle = '#111215';
  // Vector-traced geometric 'O' (wide rounded stadium ring!)
  g.lineWidth = 34;
  g.beginPath(); g.ellipse(158, 128, 78, 72, 0, 0, TAU); g.stroke();
  // Vector-traced geometric 'M' (crisp flat apexes & deep center V!)
  g.beginPath();
  g.moveTo(278, 200); g.lineTo(278, 56); g.lineTo(318, 56); g.lineTo(382, 152);
  g.lineTo(446, 56); g.lineTo(486, 56); g.lineTo(486, 200); g.lineTo(448, 200);
  g.lineTo(448, 114); g.lineTo(394, 194); g.lineTo(370, 194); g.lineTo(316, 114);
  g.lineTo(316, 200); g.closePath(); g.fill();
  // Bold horizontal hyphen '-'
  g.fillRect(522, 112, 54, 30);
  // Iconic square-shouldered geometric '1' w/ angled upper serif spur
  g.beginPath();
  g.moveTo(604, 88); g.lineTo(648, 56); g.lineTo(682, 56); g.lineTo(682, 200);
  g.lineTo(644, 200); g.lineTo(644, 96); g.lineTo(604, 118); g.closePath(); g.fill();
  const t = tex(cv); t.anisotropy = 8;
  return t;
}

function mdBadgeTex() {
  // Iconic square silver-bordered matte-black 'MD' badge on lower-left (-X) front leatherette (ks_om1b_01/05.jpg!)
  const W = 256, H = 224, cv = canvas(W, H), g = cv.getContext('2d');
  g.fillStyle = '#0e0f12'; g.fillRect(0, 0, W, H);
  g.strokeStyle = '#e8eaee'; g.lineWidth = 14; g.strokeRect(10, 10, W - 20, H - 20);
  g.fillStyle = '#eceef2'; g.font = `700 116px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('MD', W / 2, H / 2 + 4);
  const t = tex(cv); t.anisotropy = 8;
  return t;
}

function prismBrowTex() {
  // Neutral GLASS WORKS bold wide-tracked jet-black engraving on arched OM-1 silver lower brow (matching OLYMPUS contrast on _grid_front.png!)
  const cv = canvas(1024, 192), g = cv.getContext('2d');
  g.clearRect(0, 0, 1024, 192);
  g.fillStyle = '#030406'; g.font = `800 132px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('GLASS WORKS', 512, 100);
  const t = tex(cv); t.anisotropy = 8;
  return t;
}

function rLabelTex() {
  // Front upper-right 'R -' (black 'R' + crisp red dash beside the rewind release knob, _grid_front.png!)
  const cv = canvas(192, 96), g = cv.getContext('2d');
  g.clearRect(0, 0, 192, 96);
  g.fillStyle = '#141518'; g.font = `700 66px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('R', 54, 48);
  g.fillStyle = '#d93022'; g.fillRect(106, 40, 48, 16);
  return tex(cv);
}

function onOffDeckTex() {
  // Left-deck curved ON / OFF meter power markings cleanly clear of switch boss, prism wall & rewind collar (manual p-04 & ks_om1b_03!)
  const cv = canvas(256, 256), g = cv.getContext('2d');
  g.clearRect(0, 0, 256, 256);
  g.fillStyle = '#0b0c10'; g.font = `800 36px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('ON', 208, 58);
  g.fillText('OFF', 48, 208);
  g.strokeStyle = '#0b0c10'; g.lineWidth = 6;
  g.beginPath(); g.arc(128, 128, 76, -0.78, 0.42); g.stroke();
  return tex(cv);
}

function asaDialTex() {
  // Authentic Olympus OM-1 right-deck ASA 25..1600 matte-black scale with white numerals & center release button (manual p-04 & ks_om1b_03!)
  const cv = canvas(512, 512), g = cv.getContext('2d');
  g.fillStyle = '#090a0c'; g.fillRect(0, 0, 512, 512);
  g.strokeStyle = '#c8ccd2'; g.lineWidth = 10; g.beginPath(); g.arc(256, 256, 244, 0, TAU); g.stroke();
  const vals = ['25', '32', '40', '50', '64', '80', '100', '125', '160', '200', '250', '320', '400', '500', '640', '800', '1000', '1250', '1600'];
  vals.forEach((v, i) => {
    const a = Math.PI * 0.62 - (i / vals.length) * TAU * 0.88;
    arcText(g, v, 256, 256, 192, a, v.length > 3 ? 22 : 25, '#f2f0ea', 700);
  });
  arcText(g, 'A S A', 256, 256, 132, Math.PI * 0.35, 24, '#f2f0ea', 700);
  // Recessed matte-black center release button
  g.fillStyle = '#141518'; g.beginPath(); g.arc(256, 256, 74, 0, TAU); g.fill();
  g.strokeStyle = '#3c4048'; g.lineWidth = 5; g.stroke();
  return tex(cv);
}

function shutterRingBandTex() {
  // Iconic OM-1 satin-silver concentric shutter-speed ring around lens mount (manual p-04 & ks_om1b_01/03!)
  // B..60 in deep Olympus cobalt blue (#0d4282), 125..1000 in crisp jet black (#060709) on non-glaring satin silver!
  const W = 4096, H = 256, cv = canvas(W, H), g = cv.getContext('2d');
  g.fillStyle = '#c4c9d0'; g.fillRect(0, 0, W, H);
  // Subtle brushed aluminum sheen streaks
  g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(0, 0, W, 34);
  g.fillStyle = 'rgba(0,0,0,0.10)'; g.fillRect(0, H - 30, W, 30);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const X = (phi) => ((((0.5 + phi / TAU) % 1) + 1) % 1) * W;
  // Center 1/125 at phi = 0 (12 o'clock top of lens mount!), spanning cleanly from B (-8) to 1000 (+3)
  SHUTTER_LABELS.forEach((lbl, i) => {
    const phi = (i - 8) * SHUTTER_STEP;
    const isBlue = i <= 7; // B, 1, 2, 4, 8, 15, 30, 60 in signature Olympus blue!
    g.save();
    g.translate(X(phi), H * 0.54);
    g.scale(0.62, 1.0);
    g.font = `800 ${lbl.length > 3 ? 76 : 88}px ${FONT}`;
    g.fillStyle = isBlue ? '#0d4282' : '#060709';
    g.fillText(lbl, 0, 0);
    g.restore();
  });
  const t = tex(cv); t.wrapS = THREE.RepeatWrapping; t.anisotropy = 8;
  return t;
}

function bottomLabelTex(str, w = 256) {
  const cv = canvas(w, 64), g = cv.getContext('2d');
  g.clearRect(0, 0, w, 64);
  g.fillStyle = '#383a40'; g.font = `600 30px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(str, w / 2, 34);
  return tex(cv);
}

function lensAtlas(lens) {
  // Authentic Zuiko Auto-S OM-mount barrel atlas (ks_zuiko50_01.jpg & manual p-04!):
  // Row 0: Orange ft (top) + Crisp white m (bottom) distance scale
  // Row 1: Bright satin-silver DoF collar (16 8 4 [red dot + red tick] 4 8 16)
  // Row 2: Front-mounted black aperture scale (16 11 8 5.6 4 2.8 1.8 + signature GREEN '50mm'!)
  const W = 4096, RH = 128, cv = canvas(W, RH * 4), g = cv.getContext('2d');
  g.fillStyle = PAINT_BG; g.fillRect(0, 0, W, cv.height);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const X = (phi) => ((((0.5 + phi / TAU) % 1) + 1) % 1) * W;
  const text = (row, phi, str, y, size, color, weight = 600) => {
    g.save(); g.translate(X(phi), row * RH + y * RH); g.scale(0.56, 1);
    g.font = `${weight} ${size}px ${FONT}`; g.fillStyle = color; g.textAlign = 'center'; g.fillText(str, 0, 0); g.restore();
  };
  const tick = (row, phi, y0, y1, wPx, color) => { g.fillStyle = color; g.fillRect(X(phi) - wPx / 2, row * RH + y0 * RH, wPx, (y1 - y0) * RH); };
  const ORANGE = '#f08624', GREEN = '#46c660';
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
  scale([Infinity, 30, 12, 8, 6, 4, 3, 2, 1.5], 0.3048, 0.28, ORANGE);
  scale([Infinity, 10, 5, 3, 2, 1.5, 1, 0.7, 0.5, 0.45, 0.3, 0.25], 1, 0.72, INK.white);
  text(0, 46 * DEG, 'ft', 0.28, 36, ORANGE, 700);
  text(0, 38 * DEG, 'm', 0.72, 36, INK.white, 700);
  // Row 1: Bright satin-silver Zuiko DoF collar w/ iconic red index dot + tick & symmetrical 4 8 16 curves!
  g.fillStyle = '#cfd3d9'; g.fillRect(0, RH, W, RH);
  tick(1, 0, 0.08, 0.72, 9, '#d82e20');
  g.fillStyle = '#d82e20'; g.beginPath(); g.arc(X(0), RH + 0.72 * RH, 16, 0, TAU); g.fill();
  const pitch = focusPitch(lens);
  [4, 8, 16].forEach((N) => {
    const a = Math.min(34 * DEG, pitch * N * COC);
    [-1, 1].forEach((s) => {
      tick(1, s * a, 0.08, 0.38, 6, '#14161a');
      text(1, s * a, String(N), 0.72, 42, '#14161a', 700);
    });
  });
  // Row 2: Iconic Zuiko FRONT aperture scale (maxAperture at phi=0 so default rotation is 0°, smaller stops sweep left + bright green '50mm' right!)
  lens.apertureStops.forEach((N, i) => {
    text(2, -i * AP_STEP, String(N), 0.54, 46, INK.white, 700);
  });
  text(2, 1.85 * AP_STEP, `${lens.focalLength}mm`, 0.54, 44, GREEN, 700);
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
  g.fillStyle = '#07080a'; g.fillRect(0, 0, 1024, 1024);
  // Subtle concentric anti-reflection baffle grooves + hairline bezel framing rules
  g.strokeStyle = '#15171c'; g.lineWidth = 3;
  for (let r = 340; r <= 470; r += 16) { g.beginPath(); g.arc(512, 512, r, 0, TAU); g.stroke(); }
  const rInner = Math.min(def.thread - 3.6, def.glassR + (def.funnelPad ?? 0.3));
  const rInPx = 512 * rInner / (def.thread - 0.2);
  const R = (rInPx + 506) / 2;
  g.strokeStyle = 'rgba(228,230,238,0.22)'; g.lineWidth = 2.5;
  [rInPx + 10, 496].forEach((rr) => { g.beginPath(); g.arc(512, 512, rr, 0, TAU); g.stroke(); });
  arcText(g, `OM-SYSTEM  ${def.prefix}`, 512, 512, R, Math.PI * 0.66, 36, '#f0eee6', 700);
  arcText(g, `${lens.focalLength}mm  1:${lens.maxAperture}`, 512, 512, R, Math.PI * 0.08, 38, '#f0eee6', 700);
  arcText(g, `GLASS WORKS   Ø${Math.round(def.thread * 2)}mm   ${def.serial || '3205879'}`, 512, 512, R, -Math.PI * 0.54, 32, '#f0eee6', 600, true);
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
  g.fillStyle = '#24588a'; g.fillRect(0, 0, 512, 512);
  g.fillStyle = '#121418'; g.fillRect(0, 0, 512, 128); g.fillRect(0, 408, 512, 104);
  g.fillStyle = '#f4f2ea'; g.font = `800 54px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('GW 400', 256, 236);
  g.fillStyle = '#d4e6f6'; g.font = `700 30px ${FONT}`;
  g.fillText('OM 35mm · 36', 256, 316);
  g.fillStyle = '#f0eee6'; g.font = `600 26px ${FONT}`; g.fillText('GLASS WORKS FILM', 256, 66);
  return tex(cv);
}

function focusScreenTex() {
  // Olympus OM-1 Type 1-13 interchangeable focusing screen: microprism collar + horizontal split-image + left-side +/- CdS meter needle (manual p-08!)
  const cv = canvas(512, 342), g = cv.getContext('2d');
  g.fillStyle = 'rgba(222, 228, 226, 0.40)'; g.fillRect(0, 0, 512, 342);
  g.strokeStyle = 'rgba(170, 178, 176, 0.25)'; g.lineWidth = 1.5;
  for (let r = 52; r < 290; r += 12) { g.beginPath(); g.arc(256, 171, r, 0, TAU); g.stroke(); }
  g.strokeStyle = 'rgba(38, 42, 46, 0.65)'; g.lineWidth = 3;
  g.beginPath(); g.arc(256, 171, 38, 0, TAU); g.stroke();
  g.beginPath(); g.arc(256, 171, 20, 0, TAU); g.stroke();
  g.beginPath(); g.moveTo(236, 171); g.lineTo(276, 171); g.stroke();
  // Signature left-edge OM-1 match-needle CdS bracket (+ / - on viewer's left!)
  g.fillStyle = 'rgba(26, 28, 32, 0.74)'; g.fillRect(26, 118, 14, 108);
  g.fillStyle = 'rgba(242, 242, 238, 0.85)'; g.fillRect(20, 168, 26, 8);
  return tex(cv);
}

// ───────── Ultra-Compact Maitani OM-1 Plan Shapes (Graceful Rounded Brass Ends r=8.4 mm + Stepped -X Rear Cassette Notch! ks_om1b_02/03/04/07!) ─────────
// slab rotated by rx = -PI/2 maps shape (x, y) -> world (x, z = -y), so yFront = -zF, yBack = -zB.
function om1PlanShape(x0, x1, zF, zB, inset = 0) {
  const lx = x0 + inset, rx = x1 - inset, yF = -zF - inset, yB = -zB + inset;
  const r = 8.4, rBL = 6.6;
  const s = new THREE.Shape();
  s.moveTo(lx + r, yF);
  s.lineTo(rx - r, yF);
  s.quadraticCurveTo(rx, yF, rx, yF - r);
  s.lineTo(rx, yB + r);
  s.quadraticCurveTo(rx, yB, rx - r, yB);
  s.lineTo(lx + rBL, yB);
  s.quadraticCurveTo(lx, yB, lx, yB + rBL);
  s.lineTo(lx, yF - r);
  s.quadraticCurveTo(lx, yF, lx + r, yF);
  s.closePath();
  return s;
}

// Single-piece seamless top/bottom plate plan with ONLY the rear -X cassette bay recessed forward 1.9 mm for Maitani's stepped door!
function om1NotchedPlanShape(x0, x1, zF, zB, inset = 0) {
  const lx = x0 + inset, rx = x1 - inset, yF = -zF - inset, yB = -zB + inset;
  const r = 8.4, rBL = 6.6, yNotch = yB + 1.9;
  const s = new THREE.Shape();
  s.moveTo(lx + r, yF);
  s.lineTo(rx - r, yF);
  s.quadraticCurveTo(rx, yF, rx, yF - r);
  s.lineTo(rx, yB + r);
  s.quadraticCurveTo(rx, yB, rx - r, yB);
  // Rear edge running from +X to -X with clean machined pocket at X = -29.5..-55.0
  s.lineTo(-29.5, yB);
  s.lineTo(-31.8, yNotch);
  s.lineTo(-55.2, yNotch);
  s.lineTo(-55.2, yB);
  s.lineTo(lx + rBL, yB);
  s.quadraticCurveTo(lx, yB, lx, yB + rBL);
  s.lineTo(lx, yF - r);
  s.quadraticCurveTo(lx, yF, lx + r, yF);
  s.closePath();
  return s;
}

// Stepped Maitani rear film door contour (local to doorPivot: diagonal step up +2.4 mm & down -1.8 mm over -X cassette bay! ks_om1b_02/07!)
function om1DoorShape(xL, xR, yB, yT, stepX0, stepX1, stepTop, stepBot, r = 0.6) {
  const s = new THREE.Shape();
  s.moveTo(xL + r, yB - stepBot);
  s.lineTo(stepX0, yB - stepBot);
  s.lineTo(stepX1, yB);
  s.lineTo(xR - r, yB);
  s.quadraticCurveTo(xR, yB, xR, yB + r);
  s.lineTo(xR, yT - r);
  s.quadraticCurveTo(xR, yT, xR - r, yT);
  s.lineTo(stepX1, yT);
  s.lineTo(stepX0, yT + stepTop);
  s.lineTo(xL + r, yT + stepTop);
  s.quadraticCurveTo(xL, yT + stepTop, xL, yT + stepTop - r);
  s.lineTo(xL, yB - stepBot + r);
  s.quadraticCurveTo(xL, yB - stepBot, xL + r, yB - stepBot);
  s.closePath();
  return s;
}

function om1LeftWingPlan(x0, zF, zB, inset = 0) {
  const lx = x0 + inset, yF = -zF - inset, yB = -zB + inset;
  const r = 8.4, rBL = 6.6, cavL = -53.2;
  const s = new THREE.Shape();
  s.moveTo(-21.5, yF);
  s.lineTo(lx + r, yF);
  s.quadraticCurveTo(lx, yF, lx, yF - r);
  s.lineTo(lx, yB + rBL);
  s.quadraticCurveTo(lx, yB, cavL, yB);
  s.lineTo(cavL, 23.0);
  s.lineTo(-32.0, 23.0);
  s.lineTo(-32.0, 4.5);
  s.lineTo(-21.5, 4.5);
  s.closePath();
  return s;
}

function om1RightWingPlan(x1, zF, zB, inset = 0) {
  const rx = x1 - inset, yF = -zF - inset, yB = -zB + inset;
  const r = 8.4, cavR = 62.2;
  const s = new THREE.Shape();
  s.moveTo(cavR, yB);
  s.quadraticCurveTo(rx, yB, rx, yB + r);
  s.lineTo(rx, yF - r);
  s.quadraticCurveTo(rx, yF, rx - r, yF);
  s.lineTo(21.5, yF);
  s.lineTo(21.5, 4.5);
  s.lineTo(31.0, 4.5);
  s.lineTo(31.0, 14.5);
  s.lineTo(44.0, 14.5);
  s.lineTo(44.0, 19.0);
  s.lineTo(cavR, 19.0);
  s.closePath();
  return s;
}

// ───────── Iconic Bare Sculptural Deep-Drawn Maitani Pyramid Pentaprism Loft (true mm arc-length UVs + smooth 2.4 mm fillets!) ─────────
function buildOM1PrismGeo() {
  // Arched wide lower satin-chrome brow (y=34.8..41.5 carrying GLASS WORKS) climbing smoothly as a sculptural pyramid peak to Y=+55.5 mm!
  // Levels: [y, xFront, xRear, zFront, zRear, cornerR, wear]
  const levels = [
    [34.6, 22.2, 19.4, -36.5,  3.2, 2.2, 0.25],
    [37.4, 20.9, 18.5, -35.3,  3.1, 2.3, 0.35],
    [39.8, 19.6, 17.6, -34.2,  3.0, 2.4, 0.48],
    [41.5, 17.8, 16.0, -32.6,  2.6, 2.5, 0.65], // crisp upper edge of front GLASS WORKS brow!
    [43.8, 15.4, 14.1, -31.0,  1.8, 2.6, 0.56],
    [46.5, 12.6, 11.7, -29.1,  0.6, 2.6, 0.58],
    [49.6,  9.3,  9.0, -26.9, -0.9, 2.5, 0.66],
    [52.4,  6.2,  6.4, -25.0, -2.6, 2.2, 0.74],
    [54.2,  4.1,  4.5, -23.8, -4.0, 1.8, 0.82],
    [55.1,  2.9,  3.3, -22.9, -5.0, 1.4, 0.88],
    [55.5,  2.1,  2.5, -22.1, -5.9, 1.1, 0.92], // iconic softly-rounded Maitani pyramid spine!
  ];
  const ARC = 10;
  const ringPts = (xF, xR, zF, zR, r) => {
    const pts = [];
    const rr = Math.min(r, xF * 0.85, (zR - zF) * 0.4);
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
      // True millimeter arc-length UVs so beadBlastMaps() tiles seamlessly at physical scale!
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
  pos.push(0, topL.y, -14.0); uv.push(0, -14.0); wear.push(0.5);
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
  // Large 0.92x wide-vision OM-1 silvered roof pentaprism nestled cleanly inside the pyramid shell!
  const s = new THREE.Shape();
  s.moveTo(-28.0, 22.0);
  s.lineTo(-3.5, 22.0);
  s.lineTo(-3.5, 42.0);
  s.lineTo(-15.5, 51.5);
  s.lineTo(-29.0, 36.0);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 18.0, bevelEnabled: false });
  g.rotateY(-Math.PI / 2);
  g.translate(9.0, 0, 0);
  return prep(g);
}

// Fresh per-side triangular Olympus chrome wire strap D-ring (NEVER share BufferGeometry across Kit.add!)
function makeTriDRing(w = 10.6, h = 11.4, r = 0.78) {
  const hw = w * 0.5;
  const pts = [
    new THREE.Vector3(0, 0.25, 0),
    new THREE.Vector3(0, -1.5, hw * 0.44),
    new THREE.Vector3(0, -h * 0.56, hw * 0.94),
    new THREE.Vector3(0, -h, hw * 0.72),
    new THREE.Vector3(0, -h - 0.2, 0),
    new THREE.Vector3(0, -h, -hw * 0.72),
    new THREE.Vector3(0, -h * 0.56, -hw * 0.94),
    new THREE.Vector3(0, -1.5, -hw * 0.44),
  ];
  return prep(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true, 'centripetal', 0.45), 56, r, 14, true));
}

// ───────── 1976 Satin-Chrome Olympus OM-1 MD Body Builder ─────────
function buildBody(lib, hov) {
  const chr = lib.get('satinChrome'), bright = lib.get('chromeBright'), turned = lib.get('turned'), bk = lib.get('blackEnamel');
  const leather = lib.get('leather'), rubber = lib.get('rubber'), steel = lib.get('steel'), anod = lib.get('anod');
  const flock = lib.get('flock'), brass = lib.get('brass'), red = lib.get('red');
  const intBlk = lib.get('interiorBlack'), pPlate = lib.get('pressurePlate');

  const core = new THREE.Group(), top = new THREE.Group(), bottom = new THREE.Group(), doorPivot = new THREE.Group();
  const ck = new Kit(), tk = new Kit(), btk = new Kit(), dk = new Kit();
  const zShellBack = B.zB;

  // Hollow split pebbled black leatherette chassis wings (Y = -23.0 .. +19.8)
  const leftW = om1LeftWingPlan(B.x0, B.zF, zShellBack, 0.2);
  const rightW = om1RightWingPlan(B.x1, B.zF, zShellBack, 0.2);
  ck.add(slab(leftW, B.seamY - (B.baseY + 1.2), 0.45, 28, 0.4, 3), leather, T(0, B.baseY + 1.2, 0, -Math.PI / 2, 0, 0));
  ck.add(slab(rightW, B.seamY - (B.baseY + 1.2), 0.45, 28, 0.4, 3), leather, T(0, B.baseY + 1.2, 0, -Math.PI / 2, 0, 0));
  // Crisp glossy-black lower & upper body collar trim bands framing leatherette (ks_om1b_01/02!)
  const trimL = om1LeftWingPlan(B.x0 + 0.1, B.zF, zShellBack, 0.05);
  const trimR = om1RightWingPlan(B.x1 - 0.1, B.zF, zShellBack, 0.05);
  ck.add(slab(trimL, 1.3, 0.2, 24), bk, T(0, B.baseY, 0, -Math.PI / 2, 0, 0));
  ck.add(slab(trimR, 1.3, 0.2, 24), bk, T(0, B.baseY, 0, -Math.PI / 2, 0, 0));
  ck.add(slab(trimL, B.trimY - B.seamY, 0.25, 24), bk, T(0, B.seamY, 0, -Math.PI / 2, 0, 0));
  ck.add(slab(trimR, B.trimY - B.seamY, 0.25, 24), bk, T(0, B.seamY, 0, -Math.PI / 2, 0, 0));
  // Dead-flat matte black interior chamber floor & ceiling strictly inside body flanks (Law #18!)
  ck.add(rbox(113.0, 1.8, 22.0, 0.2, 1), intBlk, T(4.3, B.baseY + 0.9, -10.5));
  ck.add(rbox(113.0, 1.6, 22.0, 0.2, 1), intBlk, T(4.3, 20.6, -10.5));

  // ───────── Smooth Continuous Cubic-Bezier Glossy-Black + Tapered Satin-Chrome Mirror-Box Apron (_grid_front.png & ks_om1b_01/04!) ─────────
  const blkApron = new THREE.Shape();
  blkApron.moveTo(-19.5, -27.2);
  blkApron.bezierCurveTo(-24.6, -27.0, -26.5, -23.5, -28.0, -16.0);
  blkApron.bezierCurveTo(-30.5, -4.5, -30.8, 5.5, -28.0, 17.5);
  blkApron.bezierCurveTo(-26.0, 26.5, -24.4, 33.8, -19.2, 33.8);
  blkApron.lineTo(19.2, 33.8);
  blkApron.bezierCurveTo(24.4, 33.8, 26.0, 26.5, 28.0, 17.5);
  blkApron.bezierCurveTo(30.8, 5.5, 30.5, -4.5, 28.0, -16.0);
  blkApron.bezierCurveTo(26.5, -23.5, 24.6, -27.0, 19.5, -27.2);
  blkApron.closePath();
  blkApron.holes.push(new THREE.Path().absarc(0, 0, 23.0, 0, TAU, true));
  ck.add(slab(blkApron, 9.2, 1.4, 36, 0.55, 5), bk, T(0, 0, -37.8));

  // Smoothly Swept Forward Tapered Satin-Chrome Mirror-Box Bezel (z = -37.2 .. -41.5)
  const chrApron = new THREE.Shape();
  chrApron.moveTo(-17.8, -27.6);
  chrApron.bezierCurveTo(-23.0, -27.4, -24.8, -23.8, -26.4, -16.2);
  chrApron.bezierCurveTo(-29.2, -4.5, -29.4, 5.5, -26.4, 17.2);
  chrApron.bezierCurveTo(-24.4, 25.8, -22.8, 32.2, -18.0, 32.2);
  chrApron.lineTo(18.0, 32.2);
  chrApron.bezierCurveTo(22.8, 32.2, 24.4, 25.8, 26.4, 17.2);
  chrApron.bezierCurveTo(29.4, 5.5, 29.2, -4.5, 26.4, -16.2);
  chrApron.bezierCurveTo(24.8, -23.8, 23.0, -27.4, 17.8, -27.6);
  chrApron.closePath();
  chrApron.holes.push(new THREE.Path().absarc(0, 0, 23.0, 0, TAU, true));
  ck.add(slab(chrApron, 4.4, [1.2, 0.9], 36, 0.65, 5), chr, T(0, 0, -41.5));

  // Turned Stainless OM Bayonet Flange (OD 58.0, ID 46.0 at exact z = -46.0!) + 3 Phillips screws + Red Alignment Dot (9:30, _grid_front.png!)
  ck.add(revolve([[29.0, -44.8], [29.0, DIM.flange, 0.4], [23.0, DIM.flange], [23.0, -41.0]], { segs: 96, crease: 30 }), turned);
  [90, 210, 330].forEach((a) => {
    const rad = a * DEG;
    addScrew(ck, steel, ck, flock, T(Math.cos(rad) * 26.2, Math.sin(rad) * 26.2, DIM.flange - 0.08, 0, Math.PI, 0), 1.05, true, 0.3);
  });
  ck.add(new THREE.SphereGeometry(1.05, 16, 12), red, T(Math.cos(162 * DEG) * 26.2, Math.sin(162 * DEG) * 26.2, DIM.flange - 0.1));
  // Stationary red shutter-speed index dot on top of mirror-box chrome bezel
  ck.add(rbox(1.1, 2.2, 0.8, 0.2, 1), red, T(0, 30.8, -41.2));

  // ───────── AUTHENTIC MACHINED FRONT CONTROLS PER MANUAL p-03 & ks_om1b_05.jpg ─────────
  // 1. Animatable Rewind Release Turned-Metal Rotary Knob ('R -') w/ recessed shadow ring (X=+38.0, Y=+25.5!)
  ck.add(revolve([[5.0, 0], [5.0, 0.3], [0, 0.3]], { segs: 40 }), anod, T(38.0, 25.5, B.zF - 0.04, Math.PI, 0, 0));
  const rKnob = new THREE.Group(); rKnob.position.set(38.0, 25.5, B.zF - 0.1);
  {
    const rk = new Kit();
    rk.add(revolve([[4.6, 0.2], [4.6, 2.0, 0.4], [4.0, 2.6, 0.55], [0, 2.6]], { segs: 44 }), turned, T(0, 0, 0, Math.PI, 0, 0));
    rk.add(rbox(1.7, 8.2, 2.2, 0.45, 3, 0.6), bright, T(0, 0, -2.3));
    rk.add(new THREE.SphereGeometry(0.62, 12, 8), red, T(0, 3.6, -2.55));
    rk.build(rKnob);
  }
  core.add(rKnob);
  // 2. Animatable Mirror Lock-Up Turned-Chrome Rotary Knob on +X sloped black mirror-box side (X=+28.2, Y=+18.2, Z=-34.2, ks_om1b_03!)
  ck.add(revolve([[4.1, 0], [4.1, 0.4], [0, 0.4]], { segs: 36 }), flock, T(28.2, 18.2, -34.0, 0, 1.25, 0));
  const mluKnob = new THREE.Group(); mluKnob.position.set(28.2, 18.2, -34.2); mluKnob.rotation.set(0, 1.25, 0);
  {
    const mk2 = new Kit();
    mk2.add(revolve([[3.7, 0.2], [3.7, 2.4, 0.45], [3.2, 3.0, 0.55], [0, 3.0]], { segs: 40 }), turned);
    mk2.add(rbox(1.3, 6.2, 1.6, 0.35, 3, 0.55), bright, T(0, 0, 3.0, 0, 0, 0.15));
    mk2.build(mluKnob);
  }
  core.add(mluKnob);
  // 3. Iconic Vertical Self-Timer Lever on +X front vulcanite w/ twin spanner pinholes + turned bevel collar + recessed shadow bezel (ks_om1b_05!)
  const selfTimer = new THREE.Group(); selfTimer.position.set(38.5, -7.0, B.zF - 0.2);
  {
    const stk = new Kit();
    stk.add(revolve([[7.2, 0], [7.2, 0.45], [0, 0.45]], { segs: 48 }), flock, T(0, 0, 0.15, Math.PI, 0, 0));
    stk.add(revolve([[6.8, 0], [6.8, 1.8, 0.45], [6.1, 2.4, 0.55], [0, 2.4]], { segs: 48 }), bk, T(0, 0, 0, Math.PI, 0, 0));
    stk.add(revolve([[5.5, 2.2], [5.5, 3.2, 0.4], [4.6, 3.7, 0.55], [0, 3.7]], { segs: 48 }), turned, T(0, 0, 0, Math.PI, 0, 0));
    stk.add(revolve([[4.3, 3.5], [4.3, 4.0, 0.25], [3.95, 4.2], [0, 4.2]], { segs: 44 }), bk, T(0, 0, 0, Math.PI, 0, 0));
    // Authentic twin spanner wrench pinholes on OM-1 self-timer hub center cap (ks_om1b_05.jpg!)
    [-1.55, 1.55].forEach((px) => stk.add(revolve([[0.48, 0], [0.48, 0.25], [0, 0.25]], { segs: 16 }), flock, T(px, 0, -4.18, Math.PI, 0, 0)));
    // Vertical contoured black arm rising from hub (Y=0..+18.2) with gleaming chamfered chrome center rib (_grid_front.png & ks_om1b_05!)
    stk.add(rbox(3.4, 17.5, 2.6, 0.95, 4, 0.35), bk, T(0, 9.6, -2.5));
    stk.add(rbox(1.2, 16.5, 0.85, 0.3, 2, 0.65), bright, T(0, 9.8, -3.75));
    stk.build(selfTimer);
  }
  core.add(selfTimer);
  // 4. Animatable FP / X Flash Sync Selector & Concentric Turned-Chrome PC Sync Terminal on -X sloped mirror-box wall (X=-28.4, Y=+18.5, Z=-34.2!)
  const syncSwitch = new THREE.Group(); syncSwitch.position.set(-28.4, 18.5, -34.2); syncSwitch.rotation.set(0, -1.25, 0);
  {
    const syk = new Kit();
    syk.add(revolve([[4.6, 0], [4.6, 2.8, 0.4], [4.0, 3.2], [0, 3.2]], { segs: 36 }), bk);
    syk.add(revolve([[3.4, 2.6], [3.4, 4.6, 0.4], [2.4, 4.6], [2.4, 3.0], [0, 3.0]], { segs: 36 }), turned);
    syk.add(revolve([[0.75, 2.8], [0.75, 4.4], [0, 4.4]], { segs: 20 }), brass);
    syk.add(new THREE.SphereGeometry(0.55, 12, 8), red, T(0, -2.3, 3.0));
    syk.build(syncSwitch);
  }
  core.add(syncSwitch);
  // 5. Iconic Square Silver-Bordered 'MD' Front Badge on lower-left (-X) front vulcanite (X=-40.5, Y=-11.5, ks_om1b_01/05!)
  ck.add(rbox(7.8, 7.0, 0.9, 0.3, 2, 0.5), bright, T(-40.5, -11.5, B.zF - 0.15));
  ck.add(new THREE.PlaneGeometry(7.6, 6.8), lib.prepare(new THREE.MeshPhysicalMaterial({ map: mdBadgeTex(), roughness: 0.42, metalness: 0.25 }), {}), T(-40.5, -11.5, B.zF - 0.64, 0, Math.PI, 0));

  // ───────── ICONIC CONCENTRIC OM-1 SHUTTER SPEED RING AROUND THE LENS MOUNT (turned silver alloy! rotates around -Z on st.dial!) ─────────
  const shutterRing = new THREE.Group();
  const srK = new Kit(), srMat = lib.get('turned', { hover: hov.shutter });
  srK.add(revolve([[29.8, -41.0], [29.8, -45.2, 0.45], [29.1, -45.5], [29.1, -41.0]], { segs: 96, crease: 30 }), srMat);
  srK.add(revolve([[29.88, -45.1], [29.88, -41.1]], { segs: 96, uv: 'band' }), lib.prepare(new THREE.MeshPhysicalMaterial({ name: 'om1ShutterRingScale', map: shutterRingBandTex(), roughness: 0.44, roughnessMap: brushedMap(), metalness: 0.36, envMapIntensity: 0.45 }), { hover: hov.shutter }));
  // Twin opposite knurled silver finger-grip tabs at 3 o'clock (+X) & 9 o'clock (-X) (_grid_front.png & ks_om1b_01/03!)
  [-1, 1].forEach((sx) => {
    const tab = new THREE.Shape();
    tab.absarc(0, 0, 32.0, -0.34, 0.34, false);
    tab.absarc(0, 0, 29.0, 0.34, -0.34, true);
    tab.closePath();
    srK.add(slab(tab, 3.8, 0.35, 24, 0.5, 2), srMat, T(0, 0, -45.2, 0, 0, sx > 0 ? 0 : Math.PI));
    for (let k = -5; k <= 5; k++) {
      const a = (sx > 0 ? 0 : Math.PI) + k * 0.055;
      srK.add(rbox(0.55, 0.55, 3.6, 0.1, 1), bright, T(Math.cos(a) * 32.15, Math.sin(a) * 32.15, -43.3, 0, 0, a));
    }
  });
  const shutterMeshes = srK.build(shutterRing, 'shutter');
  core.add(shutterRing);

  // Open Dead-Flat Black Mirror-Box Tunnel + Maitani Bottom Air-Damper Shock Cylinder + Type 1-13 Focusing Screen
  const throatTube = new THREE.CylinderGeometry(22.8, 22.8, 39.0, 48, 1, true);
  throatTube.rotateX(Math.PI / 2); throatTube.translate(0, 0, -23.5);
  ck.add(throatTube, lib.prepare(new THREE.MeshPhysicalMaterial({ name: 'om1InteriorThroat', color: 0x020203, roughness: 0.98, metalness: 0.0, specularIntensity: 0.0, envMapIntensity: 0.04, side: THREE.BackSide }), {}));
  [-20.5, 20.5].forEach((mx) => ck.add(rbox(1.6, 35.0, 32.0, 0.2, 1), intBlk, T(mx, 0, -21.0)));
  ck.add(rbox(40.0, 2.0, 32.0, 0.2, 1), intBlk, T(0, -18.5, -21.0));
  ck.add(rbox(36.0, 2.4, 4.0, 0.4, 1), lib.get('felt'), T(0, 18.6, -36.5));
  // Schematic cutaway representation of Maitani's pneumatic air-damper cylinder (reduces mirror slap; Olympus docs confirm air damper)
  ck.add(revolve([[3.4, -10.0], [3.4, 10.0, 0.3], [0, 10.0]], { segs: 28 }), brass, T(0, -21.0, -20.5));
  ck.add(revolve([[1.2, -14.0], [1.2, -8.0], [0, -8.0]], { segs: 20 }), steel, T(0, -21.0, -20.5));
  // Interchangeable Type 1-13 Focusing Screen (hinged frame drops & slides out through open OM mount on st.screenDropK — manual p-07!)
  const focusScreen = new THREE.Group(); focusScreen.position.set(0, 20.4, -9.0);
  {
    const fsk = new Kit();
    fsk.add(new THREE.PlaneGeometry(36.0, 24.0), lib.prepare(new THREE.MeshPhysicalMaterial({ map: focusScreenTex(), transparent: true, roughness: 0.35, metalness: 0.05, side: THREE.DoubleSide }), {}), T(0, 0, -12.0, -Math.PI / 2, 0, 0));
    fsk.add(rbox(36.8, 0.7, 1.4, 0.15, 1), anod, T(0, -0.1, -24.2));
    fsk.build(focusScreen);
  }
  core.add(focusScreen);

  // ───────── Open-Back 35 mm Film Compartment (ks_om1b_07.jpg & manual p-05!) ─────────
  const gate = rrPath(-29.5, -19.0, 29.5, 19.0, 0.8); gate.holes.push(rrPath(-18.0, -12.0, 18.0, 12.0, 0.25, new THREE.Path()));
  ck.add(slab(gate, 2.2, 0.2), intBlk, T(0, 0, -2.6));
  [-12.4, 12.4].forEach((ry) => ck.add(rbox(59.0, 1.9, 1.0, 0.15, 1, 0.75), bright, T(0, ry, -0.3)));
  [-17.4, 17.4].forEach((ry) => ck.add(rbox(56.0, 1.4, 1.4, 0.15, 1, 0.75), bright, T(0, ry, -0.1)));
  // Twin left chrome film guide pins (manual p-05 & ks_om1b_07!)
  [-15.2, 15.2].forEach((py) => ck.add(revolve([[1.1, 0], [1.1, 1.4], [0, 1.4]], { segs: 20 }), bright, T(-30.2, py, -0.4)));

  // Left (-X) open-backed cassette well (centered at X=-44.5, r=12.2 clears B.x0=-60.5 by 3.8 mm!) + GW 400 film cartridge
  const cassWell = new THREE.CylinderGeometry(12.2, 12.2, 40.5, 28, 1, true, Math.PI * 0.55, Math.PI * 0.90);
  cassWell.translate(DIM.rewind.x, -1.0, DIM.rewind.z);
  ck.add(cassWell, lib.prepare(new THREE.MeshPhysicalMaterial({ name: 'om1InteriorCassWell', color: 0x020203, roughness: 0.98, metalness: 0.0, specularIntensity: 0.0, envMapIntensity: 0.04, side: THREE.BackSide }), {}));
  const filmCart = new THREE.Group(); filmCart.position.set(DIM.rewind.x, -1.0, DIM.rewind.z);
  {
    const fc = new Kit();
    const cCyl = new THREE.CylinderGeometry(11.4, 11.4, 38.0, 36, 1, true);
    cCyl.rotateY(Math.PI);
    fc.add(cCyl, lib.prepare(new THREE.MeshPhysicalMaterial({ map: cassetteTex(), roughness: 0.32, metalness: 0.24 }), {}));
    [-19.2, 19.2].forEach((cy) => fc.add(revolve([[11.8, -1.0], [11.8, 1.0, 0.35], [5.4, 1.2], [0, 1.2]], { segs: 36 }), bk, T(0, cy, 0, Math.PI / 2, 0, 0)));
    fc.add(rbox(6.2, 35.0, 4.2, 0.6, 1), lib.get('felt'), T(10.6, 0, 8.0));
    fc.build(filmCart);
  }
  core.add(filmCart);

  // Cumulative Arc-Length 35 mm Translucent Perforated Film Web (Law #20!)
  const filmTex = filmStripTex();
  const filmStripMat = lib.prepare(new THREE.MeshPhysicalMaterial({ map: filmTex, transparent: true, roughness: 0.22, metalness: 0.08, side: THREE.DoubleSide }), {});
  const filmStrip = new THREE.Group();
  {
    const spline = new THREE.SplineCurve([
      new THREE.Vector2(-34.0, -2.5), new THREE.Vector2(-29.0, -0.2), new THREE.Vector2(-21.0, 0.25),
      new THREE.Vector2(0.0, 0.25), new THREE.Vector2(29.0, 0.25),
      new THREE.Vector2(35.0, 0.1), new THREE.Vector2(41.0, -0.7),
      new THREE.Vector2(48.0, -2.5), new THREE.Vector2(54.5, -4.5),
    ]);
    const pts = spline.getSpacedPoints(56);
    const pos = [], uvs = [], idx = [];
    const lens = [0];
    for (let i = 1; i < pts.length; i++) lens.push(lens[i - 1] + pts[i].distanceTo(pts[i - 1]));
    const tot = lens[lens.length - 1] || 1;
    pts.forEach((p, i) => {
      const u = (lens[i] / tot) * 2.45;
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

  // Rotating 8-Tooth Black Dual Sprocket Drum (X=+36.5) + Multi-Slotted Take-Up Spool (X=+53.5)
  const sprocket = new THREE.Group(); sprocket.position.set(36.5, -1.0, -5.5);
  {
    const sk = new Kit();
    sk.add(revolve([[5.0, -18.8], [5.0, 18.8, 0.3]], { segs: 36 }), bk, T(0, 0, 0, Math.PI / 2, 0, 0));
    [-13.8, 13.8].forEach((ty) => {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU;
        sk.add(rbox(1.1, 1.4, 2.1, 0.2, 1), bk, T(Math.cos(a) * 5.4, ty, Math.sin(a) * 5.4, 0, -a, 0));
      }
    });
    sk.build(sprocket);
  }
  core.add(sprocket);

  const takeup = new THREE.Group(); takeup.position.set(53.5, -1.0, -9.2);
  {
    const tk2 = new Kit();
    tk2.add(revolve([[5.4, -18.0], [5.4, 18.0]], { segs: 36 }), intBlk, T(0, 0, 0, Math.PI / 2, 0, 0));
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      tk2.add(rbox(2.0, 33.0, 4.2, 0.45, 2, 0.3), bk, T(Math.cos(a) * 6.4, 0, Math.sin(a) * 6.4, 0, -a, 0));
    }
    tk2.add(revolve([[8.6, -19.2], [8.9, -18.9, 0.3, 1], [8.9, -16.6, 0.3, 1], [8.4, -16.4]], { segs: 256, ribs: { n: 32, depth: 0.32 } }), anod, T(0, 0, 0, Math.PI / 2, 0, 0));
    tk2.add(revolve([[8.4, 16.4], [8.4, 18.6, 0.3], [0, 18.6]], { segs: 36 }), bk, T(0, 0, 0, Math.PI / 2, 0, 0));
    tk2.build(takeup);
  }
  core.add(takeup);

  // Iconic Front-Corner Chrome Strap Eyelets (X=-60.9 / +69.5, Y=+19.5, Z=-25.5!) + Fresh Per-Side Triangular Chrome D-Rings (ks_om1b_01!)
  [[B.x0 + 1.3, -1], [B.x1 - 1.3, 1]].forEach(([ex, sx]) => {
    ck.add(revolve([[2.3, -1.4], [2.3, 2.2, 0.4], [1.8, 2.5], [0, 2.5]], { segs: 36 }), bright, T(ex, 19.5, B.zF + 3.5, 0, sx * Math.PI * 0.42, 0));
    ck.add(makeTriDRing(9.6, 10.6, 0.76), bright, T(ex + sx * 1.4, 19.2, B.zF + 3.2, 0, 0, sx * 0.14));
  });
  ck.build(core);

  // Oversize Instant-Return 45° Reflex Mirror
  const mirrorPivot = new THREE.Group(); mirrorPivot.position.set(0, 16.2, -11.5);
  {
    const mk = new Kit();
    mk.add(rbox(31.0, 1.2, 26.8, 0.25, 1), intBlk, T(0, -0.7, -13.6));
    [-16.0, 16.0].forEach((mx) => mk.add(rbox(1.3, 2.6, 25.0, 0.25, 1), steel, T(mx, -0.8, -13.0)));
    const mirMat = lib.prepare(new THREE.MeshPhysicalMaterial({ name: 'om1ReflexMirror', map: focusScreenTex(), color: 0xadb7bc, metalness: 0.78, roughness: 0.08, clearcoat: 1.0, clearcoatRoughness: 0.04 }), {});
    mk.add(new THREE.PlaneGeometry(29.2, 25.0), mirMat, T(0, 0.02, -13.6, -Math.PI / 2, 0, 0));
    mk.build(mirrorPivot);
  }
  core.add(mirrorPivot);

  // Horizontal Rubberized-Cloth Focal-Plane Shutter Curtains + Steel Laths (1/60 s X-sync!)
  const curtain1Cloth = new THREE.Mesh(prep(new THREE.PlaneGeometry(37.0, 24.4)), lib.get('curtain'));
  curtain1Cloth.position.set(0, 0, -1.9);
  const curtain1Lath = new THREE.Mesh(prep(rbox(1.3, 24.4, 0.4, 0.1, 1)), steel);
  curtain1Lath.position.set(-18.5, 0, -1.75);
  const curtain2Cloth = new THREE.Mesh(prep(new THREE.PlaneGeometry(37.0, 24.4)), lib.get('curtain'));
  curtain2Cloth.position.set(-18.5, 0, -1.55); curtain2Cloth.scale.x = 0.001;
  const curtain2Lath = new THREE.Mesh(prep(rbox(1.3, 24.4, 0.4, 0.1, 1)), steel);
  curtain2Lath.position.set(-18.5, 0, -1.4);
  core.add(curtain1Cloth, curtain1Lath, curtain2Cloth, curtain2Lath);

  // ───────── Monolithic Deep-Drawn Stamped Satin Silver Chrome Top Plate ([0.0, 2.2] seamless upper cap + [0.45, 0.0] notched Maitani rear cassette skirt!) ─────────
  const topUpper = om1PlanShape(B.x0 + 0.2, B.x1 - 0.2, B.zF, zShellBack, 0);
  const topLower = om1NotchedPlanShape(B.x0 + 0.2, B.x1 - 0.2, B.zF, zShellBack, 0);
  tk.add(slab(topUpper, B.deck - (B.trimY + 2.5), [0.0, 2.2], 40, 0.72, 6), chr, T(0, B.trimY + 2.5, 0, -Math.PI / 2, 0, 0));
  tk.add(slab(topLower, 2.5, [0.45, 0.0], 40, 0.45, 3), chr, T(0, B.trimY, 0, -Math.PI / 2, 0, 0));
  tk.add(buildOM1PrismGeo(), chr);
  // Neutral GLASS WORKS bold wide-tracked jet-black engraving (zero specular glare!) + crisp dark horizontal brow crease seam (_grid_front.png & ks_om1b_01!)
  const browTilt = Math.atan2(2.3, 5.0);
  tk.add(new THREE.PlaneGeometry(33.2, 5.4), lib.prepare(new THREE.MeshPhysicalMaterial({ map: prismBrowTex(), transparent: true, depthWrite: false, roughness: 0.92, metalness: 0.0, specularIntensity: 0.0, envMapIntensity: 0.04 }), {}), T(0, 37.39, -35.56, browTilt, Math.PI, 0));
  tk.add(rbox(35.8, 0.58, 0.68, 0.12, 1), bk, T(0, 40.15, -34.05, browTilt, 0, 0));
  // Front upper-right 'R -' engraving beside rewind release knob (_grid_front.png!)
  tk.add(new THREE.PlaneGeometry(7.2, 3.6), lib.prepare(new THREE.MeshPhysicalMaterial({ map: rLabelTex(), transparent: true, depthWrite: false, roughness: 0.88, specularIntensity: 0.0 }), {}), T(43.2, 25.5, B.zF - 0.1, 0, Math.PI, 0));
  // Iconic vector-traced 'OM-1' model engraving UPRIGHT on left (-X) satin-chrome top deck (ks_om1b_03.jpg & manual p-04!)
  tk.add(new THREE.PlaneGeometry(11.4, 3.8), lib.prepare(new THREE.MeshPhysicalMaterial({ map: om1TopBadgeTex(), transparent: true, depthWrite: false, roughness: 0.88, specularIntensity: 0.0 }), {}), T(-28.6, B.deck + 0.08, -22.2, -Math.PI / 2, 0, 0));
  // Animatable Left-deck Meter ON / OFF toggle switch + chrome top rib + crisp ON/OFF markings 100% clear of switch boss, prism wall & rewind collar (ks_om1b_03 & p-04!)
  tk.add(new THREE.PlaneGeometry(12.0, 12.0), lib.prepare(new THREE.MeshPhysicalMaterial({ map: onOffDeckTex(), transparent: true, depthWrite: false, roughness: 0.88, specularIntensity: 0.0 }), {}), T(-29.0, B.deck + 0.07, -8.2, -Math.PI / 2, 0, 0));
  tk.add(revolve([[3.2, 0], [3.2, 0.2], [0, 0.2]], { segs: 36 }), flock, T(-29.0, B.deck, -8.2, -Math.PI / 2, 0, 0));
  const meterSwitch = new THREE.Group(); meterSwitch.position.set(-29.0, B.deck, -8.2);
  {
    const msk = new Kit();
    msk.add(revolve([[2.9, 0.1], [2.9, 1.3, 0.3], [2.6, 1.6], [0, 1.6]], { segs: 36 }), bk, T(0, 0, 0, -Math.PI / 2, 0, 0));
    msk.add(rbox(1.9, 2.2, 8.2, 0.55, 3, 0.3), rubber, T(0, 2.0, 0.2, 0, 0.14, 0));
    msk.add(rbox(0.8, 0.45, 7.4, 0.15, 1, 0.65), bright, T(0, 3.15, 0.2, 0, 0.14, 0));
    msk.build(meterSwitch);
  }
  top.add(meterSwitch);

  // Iconic Recessed Threaded Chrome Shoe 1 Mounting Socket on Rear Prism Slope (NO bulky hot shoe! ks_om1b_02/03 & manual p-04!)
  const rearSlopeTilt = -Math.atan2(6.6, 10.5);
  tk.add(revolve([[2.8, 0], [2.8, 0.9, 0.25], [1.6, 0.9], [1.6, -0.6], [0, -0.6]], { segs: 32 }), turned, T(0, 44.8, 1.35, rearSlopeTilt, 0, 0));
  // Tiny recessed rectangular 'S / 1..36' Frame Counter Window at outer +X rear shoulder (ks_om1b_03 & manual p-04!)
  const ctrCv = canvas(128, 128), ctrTex = tex(ctrCv);
  tk.add(rbox(5.6, 0.4, 3.8, 0.4, 2), anod, T(66.0, B.deck + 0.02, -10.5));
  tk.add(new THREE.PlaneGeometry(4.6, 3.0), lib.prepare(new THREE.MeshBasicMaterial({ map: ctrTex }), {}), T(66.0, B.deck + 0.26, -10.5, -Math.PI / 2, 0, 0));

  // Solid Optical Roof Pentaprism Glass Block (visible in cutaway!)
  top.add(new THREE.Mesh(buildOpticalPentaprismGeo(), lib.get('innerGlass')));

  // Deeply Recessed Matte-Rubber Rectangular Eyepiece w/ Dark Blue-Violet Multi-Coated Ocular Glass (ks_om1b_02/07!)
  const E = DIM.eyepiece;
  const eyeFrame = rrPath(-E.w / 2 - 2.4, -E.h / 2 - 2.2, E.w / 2 + 2.4, E.h / 2 + 2.2, 2.4);
  eyeFrame.holes.push(rrPath(-E.w / 2, -E.h / 2, E.w / 2, E.h / 2, 1.3, new THREE.Path()));
  tk.add(slab(eyeFrame, 3.6, [0.4, 0.85], 24, 0.35, 4), rubber, T(E.x, E.y, E.z - 3.2));
  const eyeBaseCv = canvas(256, 192), ebg = eyeBaseCv.getContext('2d');
  ebg.fillStyle = '#04060a'; ebg.fillRect(0, 0, 256, 192);
  ebg.fillStyle = '#09101a'; ebg.fillRect(28, 24, 200, 144);
  ebg.strokeStyle = 'rgba(70, 105, 145, 0.16)'; ebg.lineWidth = 2;
  ebg.strokeRect(30, 26, 196, 140); ebg.beginPath(); ebg.arc(128, 96, 18, 0, TAU); ebg.stroke();
  const screenMat = lib.prepare(new THREE.MeshBasicMaterial({ map: tex(eyeBaseCv), color: 0xffffff, toneMapped: false }), {});
  const eyeScreen = new THREE.Mesh(prep(new THREE.PlaneGeometry(E.w, E.h)), screenMat);
  eyeScreen.scale.x = -1;
  // Clear of top-plate rear wall (zShellBack=+4.0) while recessed 1.28 mm inside the +5.4 rubber eyepiece frame!
  eyeScreen.position.set(E.x, E.y, zShellBack + 0.12);
  eyeScreen.userData.part = 'finder'; eyeScreen.userData.noShadow = true;
  top.add(eyeScreen);
  // Deeply recessed domed dark blue-violet multi-coated ocular glass (1.0 mm recessed inside rubber frame! ks_om1b_02/07!)
  const omOcularMat = lib.prepare(new THREE.MeshPhysicalMaterial({
    name: 'om1OcularGlass', color: 0x0e1c30, emissive: 0x040b18, emissiveIntensity: 0.10, roughness: 0.03, metalness: 0.16,
    clearcoat: 1.0, clearcoatRoughness: 0.02, iridescence: 0.85, iridescenceIOR: 1.38,
    opacity: 0.42, transparent: true, depthWrite: false,
  }), {});
  const domeGeo = new THREE.PlaneGeometry(E.w - 0.3, E.h - 0.3, 16, 12);
  {
    const p = domeGeo.attributes.position, hw = (E.w - 0.3) * 0.5, hh = (E.h - 0.3) * 0.5;
    for (let i = 0; i < p.count; i++) {
      const u = p.getX(i) / hw, v = p.getY(i) / hh;
      p.setZ(i, 0.48 * Math.max(0, 1 - 0.55 * (u * u + v * v)));
    }
    domeGeo.computeVertexNormals();
  }
  tk.add(prep(domeGeo), omOcularMat, T(E.x, E.y, zShellBack + 0.40));
  const eyepieceMeshes = [eyeScreen];
  tk.build(top);

  // ───────── Right-Deck Diamond-Knurled Turned-Silver ASA/ISO Dial + Recessed Shadow Base (X=+26.0, r=10.6, h=7.0, n=44, segs=352!) ─────────
  const asaDial = new THREE.Group(); asaDial.position.set(DIM.asa.x, B.deck, DIM.asa.z);
  {
    const ak2 = new Kit();
    ak2.add(revolve([[DIM.asa.r - 0.1, 0], [DIM.asa.r - 0.1, 0.28], [0, 0.28]], { segs: 48 }), flock, T(0, 0, 0, -Math.PI / 2, 0, 0));
    ak2.add(revolve([[DIM.asa.r - 0.8, 0.15], [DIM.asa.r - 0.8, 1.4, 0.25], [DIM.asa.r, 1.8, 0.35, 1], [DIM.asa.r, DIM.asa.h - 0.4, 0.35, 1], [DIM.asa.r - 0.7, DIM.asa.h]], { segs: 352, ribs: { n: 44, depth: 0.38, groove: 0.48, edge: 0.16 } }), turned, T(0, 0, 0, -Math.PI / 2, 0, 0));
    ak2.add(new THREE.CircleGeometry(DIM.asa.r - 0.8, 56), lib.prepare(new THREE.MeshPhysicalMaterial({ map: asaDialTex(), roughness: 0.44, metalness: 0.06, envMapIntensity: 0.22 }), {}), T(0, DIM.asa.h + 0.05, 0, -Math.PI / 2, 0, 0));
    // Recessed matte-black center release button (capped [0, zEnd]!) + tiny silver lock pin beside dial
    ak2.add(revolve([[3.2, 0], [3.2, 0.65, 0.2], [2.9, 0.8], [0, 0.8]], { segs: 32 }), rubber, T(0, DIM.asa.h, 0, -Math.PI / 2, 0, 0));
    ak2.add(revolve([[1.1, 0], [1.1, 1.5, 0.25], [0.9, 1.7], [0, 1.7]], { segs: 24 }), bright, T(11.6, 0, -5.2, -Math.PI / 2, 0, 0));
    ak2.build(asaDial);
  }
  top.add(asaDial);

  // Gleaming Conical Black/Turned-Chrome Shutter Release Button + Shadow Base Collar (X=+43.2, Z=-18.5 — ks_om1b_01/03!)
  const release = new THREE.Group(); release.position.set(DIM.release.x, B.deck, DIM.release.z);
  const relK = new Kit(), rMat = lib.get('chromeBright', { hover: hov.release });
  relK.add(revolve([[DIM.release.r + 0.4, 0], [DIM.release.r + 0.4, 0.28], [0, 0.28]], { segs: 48 }), flock, T(0, 0, 0, -Math.PI / 2, 0, 0));
  relK.add(revolve([[DIM.release.r, 0.15], [DIM.release.r, 1.2, 0.25], [DIM.release.r + 0.4, 3.8, 0.35], [DIM.release.r - 0.3, 4.4], [0, 4.4]], { segs: 48 }), bk, T(0, 0, 0, -Math.PI / 2, 0, 0));
  relK.add(revolve([[DIM.release.r + 0.35, 3.8], [DIM.release.r + 0.35, 4.5, 0.25], [4.2, 4.6], [4.2, 3.6]], { segs: 48 }), turned, T(0, 0, 0, -Math.PI / 2, 0, 0));
  relK.add(revolve([[3.6, 4.2], [3.6, 6.8, 0.4], [3.2, 7.2, 0.6], [1.35, 7.2], [1.35, 4.5]], { segs: 48 }), rMat, T(0, 0, 0, -Math.PI / 2, 0, 0));
  relK.add(new THREE.CircleGeometry(1.3, 28), flock, T(0, 7.16, 0, -Math.PI / 2, 0, 0));
  const releaseMeshes = relK.build(release, 'release');
  top.add(release);

  // Rapid-Wind Lever (flat angled satin-chrome blade + matte bead-blasted hub w/ turned chrome rim + tactile rubber Maitani thumb pad! ks_om1b_02/03!)
  const lever = new THREE.Group(); lever.position.set(DIM.lever.x, B.deck, DIM.lever.z);
  const levK = new Kit(), lMat = lib.get('satinChrome', { hover: hov.crank });
  const hubCapMat = lib.prepare(new THREE.MeshPhysicalMaterial({ name: 'om1WindHubCap', color: 0x07080a, roughness: 0.64, roughnessMap: beadBlastMaps().rgh, normalMap: beadBlastMaps().nrm, normalScale: new THREE.Vector2(0.18, 0.18), metalness: 0.04, specularIntensity: 0.24, envMapIntensity: 0.24 }), { hover: hov.crank });
  levK.add(revolve([[DIM.lever.r + 0.4, 0], [DIM.lever.r + 0.4, 0.28], [0, 0.28]], { segs: 56 }), flock, T(0, 0, 0, -Math.PI / 2, 0, 0));
  levK.add(revolve([[DIM.lever.r, 0.15], [DIM.lever.r, 5.2, 0.35], [DIM.lever.r - 0.8, 5.7], [0, 5.7]], { segs: 56 }), bk, T(0, 0, 0, -Math.PI / 2, 0, 0));
  levK.add(revolve([[DIM.lever.r + 0.2, 5.0], [DIM.lever.r + 0.2, 5.7, 0.3], [DIM.lever.r - 0.9, 5.9, 0.5], [DIM.lever.r - 1.1, 5.5]], { segs: 56 }), turned, T(0, 0, 0, -Math.PI / 2, 0, 0));
  levK.add(new THREE.CircleGeometry(DIM.lever.r - 1.0, 48), hubCapMat, T(0, 5.76, 0, -Math.PI / 2, 0, 0));
  // Sleek flat angled silver blade curving rearward (ks_om1b_02/03!)
  const armSh = new THREE.Shape();
  armSh.moveTo(-4.0, 2.0);
  armSh.bezierCurveTo(2.0, 3.8, 7.0, 1.5, 5.5, -4.0);
  armSh.bezierCurveTo(3.2, -10.5, -5.0, -13.5, -14.5, -14.0);
  armSh.bezierCurveTo(-16.5, -14.0, -16.5, -10.8, -14.2, -10.2);
  armSh.bezierCurveTo(-7.0, -9.0, -3.5, -4.5, -4.0, 2.0);
  levK.add(slab(armSh, 2.0, 0.45, 32, 0.55, 4), lMat, T(0, 0.6, 0, -Math.PI / 2, 0, 0));
  // Iconic Maitani crisp sculpted tactile rubber rear thumb pad (ks_om1b_02/03!)
  const tipSh = new THREE.Shape();
  tipSh.moveTo(-12.5, -14.5);
  tipSh.lineTo(-31.5, -14.2);
  tipSh.quadraticCurveTo(-33.5, -14.0, -33.5, -11.5);
  tipSh.lineTo(-33.5, -9.5);
  tipSh.quadraticCurveTo(-33.5, -8.2, -31.0, -8.4);
  tipSh.lineTo(-13.2, -10.0);
  tipSh.closePath();
  levK.add(slab(tipSh, 5.6, 1.1, 28, 0.4, 4), rubber, T(0, 0.2, 0, -Math.PI / 2, 0, 0));
  const leverMeshes = levK.build(lever, 'crank');
  top.add(lever);

  // Left-side Horizontally-Grooved Turned-Chrome Rewind Knob + Flush Folding Straight Silver Crank (X=-43.2, r=9.8 — ks_om1b_01/03!)
  const rwBase = new THREE.Group(); rwBase.position.set(DIM.rewind.x, B.deck, DIM.rewind.z);
  {
    const rbk = new Kit();
    rbk.add(revolve([[11.1, 0], [11.1, 0.25], [0, 0.25]], { segs: 56 }), flock, T(0, 0, 0, -Math.PI / 2, 0, 0));
    rbk.add(revolve([[10.7, 0.12], [10.4, 1.0, 0.25], [10.0, 1.5], [0, 1.5]], { segs: 56 }), bk, T(0, 0, 0, -Math.PI / 2, 0, 0));
    rbk.build(rwBase);
  }
  top.add(rwBase);

  const rwSpin = new THREE.Group(); rwSpin.position.set(DIM.rewind.x, B.deck + 1.4, DIM.rewind.z);
  {
    const rwK = new Kit();
    // Signature Olympus OM-1 horizontally-grooved turned-chrome rewind drum (4 crisp concentric lathe rings w/ dark groove channels!)
    const grov = [[9.8, 0]];
    for (let i = 0; i < 4; i++) {
      const y0 = 0.45 + i * 1.08;
      grov.push([9.8, y0], [9.0, y0 + 0.30], [9.8, y0 + 0.62]);
    }
    grov.push([9.8, 4.9, 0.4], [9.0, 5.2, 0.6], [0, 5.2]);
    rwK.add(revolve(grov, { segs: 64, crease: 25 }), turned, T(0, 0, 0, -Math.PI / 2, 0, 0));
    rwK.add(rbox(17.8, 0.55, 4.4, 0.2, 1), anod, T(0, 5.08, 0));
    rwK.add(revolve([[2.8, -24.0], [2.8, 1.5]], { segs: 32 }), turned, T(0, 0, 0, -Math.PI / 2, 0, 0));
    [-1.7, 1.7].forEach((fx) => rwK.add(rbox(1.1, 7.0, 1.3, 0.25, 2), bright, T(fx, -21.5, 0)));
    rwK.build(rwSpin);
  }
  const rwCrankPivot = new THREE.Group(); rwCrankPivot.position.set(7.4, 5.2, 0.0);
  {
    const rck = new Kit();
    const rcS = rrPath(-15.6, -2.1, 1.6, 2.1, 1.1);
    rck.add(slab(rcS, 1.1, 0.28, 20, 0.55, 3), turned, T(0, -0.35, 0, -Math.PI / 2, 0, 0));
    rck.build(rwCrankPivot);
  }
  const rwTipPivot = new THREE.Group(); rwTipPivot.position.set(-14.0, 0.35, 0.0);
  {
    const rtk = new Kit();
    rtk.add(revolve([[1.3, 0], [1.55, 0.2, 0.25, 1], [1.55, 3.6, 0.25, 1], [1.3, 3.8], [0, 3.8]], { segs: 160, ribs: { n: 20, depth: 0.14 } }), bright, T(0, 0, 0, -Math.PI / 2, 0, 0));
    rtk.build(rwTipPivot);
  }
  rwCrankPivot.add(rwTipPivot);
  rwSpin.add(rwCrankPivot);
  top.add(rwSpin);

  // ───────── Monolithic Deep-Drawn Stamped Satin Silver Chrome Bottom Baseplate ([2.0, 0.0] seamless lower rim + [0.0, 0.45] notched Maitani cassette lip!) ─────────
  const botLower = om1PlanShape(B.x0, B.x1, B.zF, zShellBack, 0);
  const botUpper = om1NotchedPlanShape(B.x0, B.x1, B.zF, zShellBack, 0);
  btk.add(slab(botLower, (B.baseY - 1.9) - B.y0, [2.0, 0.0], 40, 0.72, 6), chr, T(0, B.y0, 0, -Math.PI / 2, 0, 0));
  btk.add(slab(botUpper, 1.9, [0.0, 0.45], 40, 0.45, 3), chr, T(0, B.baseY - 1.9, 0, -Math.PI / 2, 0, 0));
  // 1. Large coin-slotted PX625 Battery Chamber Cap (+X outer corner, X=+55.8, Z=-11.5, r=7.6) + recessed dark perimeter seam + clear Guide Pin Hole (X=+57.4, Z=-23.6, 3.0 mm bridge!)
  btk.add(revolve([[8.0, 0], [8.0, 0.14], [7.6, 0.14], [0, 0.14]], { segs: 56 }), anod, T(55.8, B.y0 - 0.01, -11.5, Math.PI / 2, 0, 0));
  btk.add(revolve([[7.6, 0], [7.6, 0.36, 0.2], [7.2, 0.44], [0, 0.44]], { segs: 56 }), chr, T(55.8, B.y0 - 0.02, -11.5, Math.PI / 2, 0, 0));
  btk.add(rbox(9.2, 0.35, 1.35, 0.15, 1), anod, T(55.8, B.y0 - 0.45, -11.5, 0, 0.65, 0));
  btk.add(revolve([[1.35, 0], [1.35, 0.28], [0.85, 0.28], [0.85, -1.5], [0, -1.5]], { segs: 24 }), anod, T(57.4, B.y0 - 0.02, -23.6, Math.PI / 2, 0, 0));
  // 2. Slightly smaller coin-slotted Motor Drive Socket Cap (+X inboard, X=+36.8, Z=-13.5, r=7.0) + recessed dark perimeter seam
  btk.add(revolve([[7.4, 0], [7.4, 0.14], [7.0, 0.14], [0, 0.14]], { segs: 56 }), anod, T(36.8, B.y0 - 0.01, -13.5, Math.PI / 2, 0, 0));
  btk.add(revolve([[7.0, 0], [7.0, 0.36, 0.2], [6.6, 0.44], [0, 0.44]], { segs: 56 }), chr, T(36.8, B.y0 - 0.02, -13.5, Math.PI / 2, 0, 0));
  btk.add(rbox(8.2, 0.35, 1.3, 0.15, 1), anod, T(36.8, B.y0 - 0.45, -13.5, 0, -0.25, 0));
  // 3. Bright chrome 1/4"-20 Tripod Socket (X=+2.5) + twin tight flanking Phillips screws (-2.7, +7.7 — zero overlap w/ MADE IN JAPAN!)
  btk.add(revolve([[4.4, 0], [4.4, 0.55, 0.2], [2.8, 0.55], [2.8, -3.2], [0, -3.2]], { segs: 40 }), bright, T(DIM.socket.x, B.y0 - 0.02, DIM.socket.z, Math.PI / 2, 0, 0));
  [DIM.socket.x - 5.2, DIM.socket.x + 5.2].forEach((sx) => addScrew(btk, steel, btk, flock, T(sx, B.y0 - 0.05, DIM.socket.z, Math.PI / 2, 0, 0), 1.05, true, 0.3));
  // 4. Signature OM-1 MD Recessed Black Oval Pill w/ Twin Gold Motor Coupling Terminals (X=-24.5, Z=-13.5, ks_om1b_04 & p-05!)
  btk.add(rbox(4.8, 0.35, 9.2, 1.8, 3), bk, T(-24.5, B.y0 - 0.08, -13.5));
  [-15.8, -11.2].forEach((gz) => btk.add(revolve([[1.25, 0], [1.25, 0.32], [0, 0.32]], { segs: 24 }), brass, T(-24.5, B.y0 - 0.24, gz, Math.PI / 2, 0, 0)));
  // 5. Engraved 'MADE IN JAPAN' (X=-13.2, 3.0 mm clear of left tripod screw!) & serial '560716' (X=-39.5) cleanly flanking twin gold MD terminals (ks_om1b_04!)
  btk.add(new THREE.PlaneGeometry(15.0, 3.8), lib.prepare(new THREE.MeshPhysicalMaterial({ map: bottomLabelTex('MADE IN JAPAN', 320), transparent: true, alphaTest: 0.08, roughness: 0.55 }), {}), T(-13.2, B.y0 - 0.08, -13.5, Math.PI / 2, 0, Math.PI));
  btk.add(new THREE.PlaneGeometry(11.2, 3.8), lib.prepare(new THREE.MeshPhysicalMaterial({ map: bottomLabelTex('560716', 192), transparent: true, alphaTest: 0.08, roughness: 0.55 }), {}), T(-39.5, B.y0 - 0.08, -13.5, Math.PI / 2, 0, Math.PI));
  [[67.5, -13.5], [-58.0, -13.5]].forEach(([sx, sz]) => addScrew(btk, steel, btk, flock, T(sx, B.y0 - 0.05, sz, Math.PI / 2, 0, 0), 1.25, true, 0.4));
  btk.build(bottom);

  // ───────── Hinged +X Removable Rear Film Door w/ Authentic Maitani Diagonal Stepped -X Cassette Contour (ks_om1b_02/07!) ─────────
  const doorW = 117.0, doorH = (B.trimY - B.baseY) + 0.6, doorCX = 4.3, doorCY = (B.trimY + B.baseY) / 2, hingeX = doorCX + doorW / 2 + 0.3;
  doorPivot.position.set(hingeX, doorCY, zShellBack - 0.2);
  const dx = doorCX - hingeX;
  const xL = dx - doorW / 2, xR = dx + doorW / 2, yB = -doorH / 2, yT = doorH / 2;
  const stepX0 = -32.2 - hingeX, stepX1 = -29.2 - hingeX;
  // Sculpted stepped black enamel door shell + matching stepped pebbled black leatherette panel (ks_om1b_02!)
  dk.add(slab(om1DoorShape(xL, xR, yB, yT, stepX0, stepX1, 2.3, 1.8, 0.65), 1.0, 0.32, 20, 0.4, 2), bk, T(0, 0, -0.5));
  dk.add(slab(om1DoorShape(xL + 2.0, xR - 2.0, yB + 2.0, yT - 2.0, stepX0 - 0.6, stepX1 - 0.6, 2.3, 1.8, 0.45), 0.55, 0.22, 16, 0.2, 2), leather, T(0, 0, 0.18));
  dk.add(revolve([[1.2, -doorH / 2 + 0.8], [1.2, doorH / 2 - 0.8, 0.3]], { segs: 28 }), bk, T(0, 0, -0.2, Math.PI / 2, 0, 0));
  // Dead-flat black inner door backing liner + light-trap flange (Law #18!)
  dk.add(rbox(doorW - 2.0, doorH - 2.0, 0.35, 0.2, 1), intBlk, T(dx, 0, -0.58));
  const trap = rrPath(dx - doorW / 2 + 1.4, -doorH / 2 + 1.4, dx + doorW / 2 - 1.4, doorH / 2 - 1.4, 0.8);
  trap.holes.push(rrPath(dx - doorW / 2 + 4.4, -doorH / 2 + 4.2, dx + doorW / 2 - 4.4, doorH / 2 - 4.2, 0.5, new THREE.Path()));
  dk.add(slab(trap, 1.8, 0.2, 16), intBlk, T(0, 0, -2.2));
  // Spring-mounted satin-matte black pressure plate (50×33 mm) + capped rivets + cassette leaf spring (manual p-05!)
  dk.add(rbox(50.0, 33.0, 1.1, 0.35, 2, 0.0), pPlate, T(-hingeX, -doorCY, -2.3));
  [-12.5, 12.5].forEach((py) => dk.add(revolve([[1.4, 0], [1.4, 0.55], [0, 0.55]], { segs: 28 }), steel, T(-hingeX, -doorCY + py, -2.9, Math.PI, 0, 0)));
  [-17.0, 17.0].forEach((px) => dk.add(rbox(14.0, 2.2, 0.7, 0.15, 1), steel, T(-hingeX + px, -doorCY, -1.3)));
  dk.add(rbox(12.0, 22.0, 0.6, 0.2, 1), anod, T(-44.0 - hingeX, -doorCY, -1.6));
  dk.add(rbox(3.0, 14.0, 2.6, 0.3, 1), intBlk, T(dx - doorW / 2 + 2.0, 0, -1.8));
  dk.build(doorPivot);

  return {
    core, top, bottom, door: doorPivot, doorRestZ: zShellBack - 0.2, mirrorPivot, selfTimer,
    rKnob, mluKnob, syncSwitch, focusScreen, meterSwitch, asaDial,
    shutterRing, shutterMeshes,
    curtain1Cloth, curtain1Lath, curtain2Cloth, curtain2Lath,
    sprocket, takeup, filmCart, filmStrip, filmTex,
    release, releaseMeshes, lever, leverMeshes, rwSpin, rwCrankPivot, rwTipPivot,
    screenMat, eyeScreen, eyepieceMeshes, ctrCv, ctrTex,
  };
}

// ───────── Olympus OM-Mount Zuiko Lens Builder (Rear Chrome DoF Collar + Twin Chrome Buttons + FRONT Aperture Ring! ks_zuiko50_01!) ─────────
function buildLens(lib, lens, hov) {
  const def = lensDef(lens), group = new THREE.Group();
  const bk = lib.get('lensBlack'), chrome = lib.get('chromeBright'), chr = lib.get('satinChrome'), steel = lib.get('steel'), intBlk = lib.get('interiorBlack'), flock = lib.get('flock');
  const atlas = lensAtlas(lens);
  const eng = (h) => lib.prepare(new THREE.MeshPhysicalMaterial({ name: `om1LensEng_${lens.id}`, color: 0xffffff, map: atlas, metalness: 0.14, roughness: 0.40 }), { hover: h, wear: 'paint' });
  const oSpec = lensOpticsFor(lens);
  const lensGlassU = {
    blades: def.blades || 6,
    optics: { value: new THREE.Vector4(Math.min(14.5, def.glassR * 0.86), 1.0, def.glassR, 12.0) },
    state: { value: new THREE.Vector4(0, oSpec.pupilMag ?? 1.0, 0, 0) },
    ghostA: { value: new THREE.Color(...(oSpec.ghostTintA || [0.32, 0.74, 0.52])) },
    ghostB: { value: new THREE.Color(...(oSpec.ghostTintB || [0.78, 0.48, 0.26])) },
  };
  const glassMat = lib.prepare(lib.base.glass.clone(), { lensGlass: lensGlassU });

  const L = def.L;
  const maxExt = helicoidExtensionMm(lens, lens.minFocusDistance || 0.45);
  const zF0 = -5.6;
  const zF1 = def.builtInHood ? -(L - def.hoodLen - 10.5) : -Math.max(19.5, L - 10.2);
  const zA0 = zF1;
  const zA1 = def.builtInHood ? -(L - def.hoodLen - 1.2) : -(L - 3.2);
  const rApRing = def.builtInHood ? def.rFocus - 0.45 : def.rFront;
  const rInnerFixed = Math.min(def.rMount - 1.8, def.rFocus - 0.85);
  const rSleeve = Math.min(def.rFront - 0.8, rApRing - 0.45, def.rFocus - 1.6, rInnerFixed - 0.4);
  const zSleeveBack = Math.min(-2.5, Math.max(zF1 + maxExt + 5.0, zF1 + 8.0));
  const fixed = new Kit();
  // Continuous matte-black inner stationary barrel housing sealing mount/focus seams
  fixed.add(revolve([[rInnerFixed, zF1 + 0.6], [rInnerFixed, -1.6]], { segs: 84 }), lib.get('anod'));
  // Gleaming satin-chrome rear OM bayonet & DoF collar (0 .. -5.6 mm, ks_zuiko50_01.jpg!)
  fixed.add(revolve([[def.rMount - 2.0, 0], [def.rMount, -0.6, 0.3], [def.rMount, -5.6, 0.25], [def.rMount - 0.5, -5.8]], { segs: 96, crease: 30 }), chr);
  fixed.add(bandRow(revolve([[def.rMount + 0.08, -5.5], [def.rMount + 0.08, -1.0]], { segs: 96, uv: 'band' }), 1), eng(null));
  // Iconic Zuiko Chrome Lens Mount Release Button at 142° + recessed dark collar surround + red mounting & IR focus dots!
  const relA = 142 * DEG;
  fixed.add(rbox(2.0, 6.2, 5.4, 0.55, 2), bk, T(Math.cos(relA) * (def.rMount - 0.1), Math.sin(relA) * (def.rMount - 0.1), -3.2, 0, 0, relA));
  fixed.add(rbox(2.2, 5.2, 4.4, 0.5, 2, 0.55), chrome, T(Math.cos(relA) * (def.rMount + 0.5), Math.sin(relA) * (def.rMount + 0.5), -3.2, 0, 0, relA));
  // Recessed dark collar around DoF preview button (-38°) + raised red bayonet mounting dot (0°) & IR focus dot (7.5°)
  const dofColA = -38 * DEG;
  fixed.add(rbox(2.0, 6.2, 5.4, 0.55, 2), bk, T(Math.cos(dofColA) * (def.rMount - 0.1), Math.sin(dofColA) * (def.rMount - 0.1), -3.2, 0, 0, dofColA));
  fixed.add(new THREE.SphereGeometry(0.68, 12, 10), lib.get('red'), radialT(0, def.rMount + 0.08, -1.6));
  fixed.add(new THREE.SphereGeometry(0.50, 12, 10), lib.get('red'), radialT(7.5 * DEG, def.rMount + 0.08, -4.6));
  const rearBaf = new THREE.RingGeometry(14.0, def.rMount - 2.2, 48); rearBaf.translate(0, 0, -1.6);
  fixed.add(rearBaf, intBlk);
  fixed.add(new THREE.CircleGeometry(14.5, 48), intBlk, T(0, 0, -4.4));
  fixed.add(revolve([[0, -1.8], [7.8, -2.3], [14.0, -3.4]], { segs: 40 }), lib.get('innerGlass'));
  fixed.build(group);

  // Iconic Zuiko Chrome DoF Preview Button at -38° (+X lower-right, ~4:30 viewed from rear / 7:30 front, depressing radially on dofK! ks_om1b_05 & p-03!)
  const dofA = -38 * DEG;
  const dofButton = new THREE.Group();
  dofButton.position.set(Math.cos(dofA) * (def.rMount + 0.5), Math.sin(dofA) * (def.rMount + 0.5), -3.2);
  dofButton.rotation.z = dofA;
  {
    const dk2 = new Kit();
    dk2.add(rbox(2.2, 5.2, 4.4, 0.5, 2, 0.55), chrome, T(0, 0, 0));
    dk2.build(dofButton);
  }
  group.add(dofButton);

  // Authentic Yoshihisa Maitani All-Metal Machined Twin-Band Scalloped Aluminum Focusing Grip (NO rubber! n=48, segs=384!)
  const focus = new THREE.Group(); group.add(focus);
  const fk = new Kit(), fMat = lib.get('lensBlack', { hover: hov.focus });
  fk.add(bandRow(revolve([[def.rFocus - 0.4, zF0 - 4.4], [def.rFocus - 0.4, zF0]], { segs: 120, uv: 'band' }), 0), eng(hov.focus));
  const zW0 = zF0 - 4.4, wSpan = zW0 - zF1, wRows = wSpan > 15.0 ? 3 : 2;
  const wProf = [[def.rFocus - 0.3, zW0]];
  for (let b = 0; b < wRows; b++) {
    const zb0 = lerp(zW0, zF1, b / wRows), zb1 = lerp(zW0, zF1, (b + 1) / wRows);
    wProf.push([def.rFocus + 0.45, zb0 - (b === 0 ? 0.52 : 0.34), 0.35, 1], [def.rFocus + 0.45, zb1 + (b === wRows - 1 ? 0.52 : 0.34), 0.35, 1]);
    if (b < wRows - 1) wProf.push([def.rFocus - 0.22, zb1, 0.16]);
  }
  wProf.push([def.rFocus - 0.3, zF1]);
  fk.add(revolve(wProf, { segs: 384, ribs: { n: 48, depth: 0.44, groove: 0.56, edge: 0.16 } }), fMat);
  // Crisp hairline machined bright trim ring + forward-facing front seal flange (dr > 0 -> nz < 0!)
  fk.add(revolve([[rSleeve + 0.15, zF1 - 0.55], [def.rFocus - 0.25, zF1 - 0.55], [def.rFocus + 0.08, zF1 - 0.45], [def.rFocus + 0.08, zF1 + 0.05], [def.rFocus - 0.25, zF1 + 0.25]], { segs: 96, crease: 26 }), steel);
  const focusMeshes = fk.build(focus, 'focus');

  // Extending Front Barrel (carries Zuiko's ICONIC FRONT-MOUNTED APERTURE RING + Silver-Nose / Black-Nose rim + 49 mm threads! Law #27!)
  const ext = new THREE.Group(); group.add(ext);
  // Iconic Front-Mounted Aperture Ring (sits right behind the parked sliding hood on 135/3.5 so stops are NEVER covered!)
  const aperture = new THREE.Group(); ext.add(aperture);
  const ak = new Kit(), aMat = lib.get('lensBlack', { hover: hov.aperture });
  ak.add(bandRow(revolve([[rApRing + 0.15, zA0 - 3.8], [rApRing + 0.15, zA0]], { segs: 96, uv: 'band' }), 2), eng(hov.aperture));
  ak.add(revolve([[rSleeve, zA1], [rApRing - 0.1, zA1], [rApRing + 0.42, zA1 + 0.4, 0.3, 1], [rApRing + 0.42, zA0 - 4.2, 0.3, 1], [rApRing - 0.1, zA0 - 3.8]], { segs: 480, ribs: { n: 80, depth: 0.24, groove: 0.48, edge: 0.16 } }), aMat);
  ak.add(revolve([[rApRing + 0.15, zA0], [rSleeve, zA0]], { segs: 96 }), aMat);
  const apertureMeshes = ak.build(aperture, 'aperture');

  const ek = new Kit();
  const rInnerFace = Math.min(def.thread - 3.6, def.glassR + (def.funnelPad ?? 0.3));
  // Outer front barrel sleeve & iconic early-OM brushed stainless "Silver-Nose" front rim on classic 24/28/50 f/1.4/135 Zuikos!
  if (def.silverNose && !def.builtInHood) {
    // Gleaming brushed stainless Silver-Nose front collar (z = -L .. -L + 3.2 mm) + black inner structural nose!
    ek.add(revolve([[def.thread, -L], [def.rFront - 0.65, -L, 0.4], [def.rFront, -L + 0.75, 0.4], [def.rFront, -L + 3.2, 0.25], [def.rFront - 0.7, -L + 3.4]], { segs: 96, crease: 28 }), chrome);
    ek.add(revolve([[def.rFront - 0.7, -L + 3.2], [def.rFront - 0.7, zA1 + 0.4], [rSleeve, zA1 + 1.0]], { segs: 96, crease: 30 }), bk);
  } else if (def.profile === 'portrait') {
    // 85mm f/2 sculpted Maitani portrait taper
    ek.add(revolve([
      [def.thread, -L], [def.rFront - 0.9, -L, 0.5], [def.rFront - 0.2, -L + 0.9, 0.5], [def.rFront - 0.2, zA1 + 0.4],
      [rSleeve, zA1 + 1.0],
    ], { segs: 96, crease: 30 }), bk);
  } else if (def.profile === 'stepped') {
    // 35mm f/2.8 crisp conical step nose
    ek.add(revolve([
      [def.thread, -L], [def.rFront - 1.1, -L, 0.45], [def.rFront - 0.4, -L + 1.0, 0.45], [def.rFront - 0.4, zA1 + 0.4],
      [rSleeve, zA1 + 1.0],
    ], { segs: 96, crease: 30 }), bk);
  } else {
    // 50mm f/1.8 (locked exact envelope!) & 135mm f/3.5 inner barrel (clad by Silver-Nose sliding hood!)
    ek.add(revolve([[def.thread, -L], [def.rFront - 1.2, -L, 0.45], [def.rFront - 0.6, -L + 0.8, 0.45], [def.rFront - 0.6, zA1 + 0.4], [rSleeve, zA1 + 1.0]], { segs: 96, crease: 30 }), bk);
  }
  // Continuous machined black-anodized telescoping helicoid sleeve (runs behind front aperture ring into focus barrel across full focus travel!)
  ek.add(revolve([[rSleeve, zA1 + 0.4], [rSleeve, zSleeveBack + 0.4, 0.2], [rSleeve - 1.0, zSleeveBack]], { segs: 96, crease: 28 }), lib.get('anod'));
  // Exposed bright machined filter-mouth rim chamfer (on black-nose lenses) + stepped 49 mm internal filter threads
  if (!def.silverNose || def.builtInHood) {
    ek.add(revolve([[def.thread - 0.08, -L + 0.22], [def.thread + 0.32, -L + 0.02]], { segs: 96 }), steel);
  }
  const thrProf = [];
  for (let i = 0; i < 6; i++) {
    const zt = -L + 0.5 + i * 0.48;
    thrProf.push([def.thread, zt], [def.thread - 0.34, zt + 0.22], [def.thread, zt + 0.44]);
  }
  ek.add(revolve(thrProf, { segs: 84, crease: 20 }), intBlk);
  if (!def.builtInHood) {
    const rScrew = def.silverNose ? def.rFront - 0.04 : def.rFront - 0.62;
    [-90, 90].forEach((a) => addScrew(ek, steel, ek, flock, radialT(a * DEG, rScrew, -L + 2.2), 0.64, false, 0.2));
  }
  const ring = new THREE.RingGeometry(rInnerFace, def.thread + 0.08, 84); ring.rotateY(Math.PI);
  const rPos = ring.attributes.position;
  for (let i = 0; i < rPos.count; i++) {
    const r = Math.hypot(rPos.getX(i), rPos.getY(i));
    const u = Math.max(0, Math.min(1, (r - rInnerFace) / Math.max(0.1, def.thread + 0.08 - rInnerFace)));
    rPos.setZ(i, lerp(-L + 3.6, -L + 1.9, u));
  }
  ring.computeVertexNormals();
  ek.add(ring, lib.prepare(new THREE.MeshPhysicalMaterial({ name: `om1Front_${lens.id}`, map: frontRingTex(lens, def), metalness: 0.14, roughness: 0.38 }), {}));
  // Stepped matte-black anti-reflection funnel on smaller-glass compact wides (28/3.5 & 35/2.8!) vs crisp retaining bevel on bright eyes
  const funnelGap = rInnerFace - def.glassR;
  const zGlassEdge = funnelGap >= 1.1 ? -L + 5.7 : -L + 3.8;
  if (funnelGap >= 1.1) {
    const bafProf = [];
    for (let i = 0; i < 3; i++) {
      const rA = lerp(rInnerFace + 0.12, def.glassR + 0.2, i / 3), rB = lerp(rInnerFace + 0.12, def.glassR + 0.2, (i + 1) / 3);
      const zA = lerp(-L + 3.55, zGlassEdge, i / 3), zB = lerp(-L + 3.55, zGlassEdge, (i + 1) / 3);
      bafProf.push([rB, zB], [rA - 0.26, zB], [rA, zA]);
    }
    ek.add(revolve(bafProf.reverse(), { segs: 72, crease: 20 }), intBlk);
  } else {
    ek.add(revolve([[def.glassR - 0.1, zGlassEdge], [def.glassR + 0.35, -L + 3.3, 0.15], [rInnerFace + 0.12, -L + 3.55]], { segs: 84 }), bk);
  }
  // Dual opposing front retaining-ring spanner-wrench notches (180° apart!)
  [-1, 1].forEach((s) => ek.add(rbox(1.4, 0.54, 0.50, 0.08, 1), intBlk, T(s * (rInnerFace + 0.42), 0, -L + 3.42)));
  ek.add(new THREE.CircleGeometry(def.glassR + 0.3, 48), intBlk, T(0, 0, zGlassEdge + 0.8, 0, Math.PI, 0));
  ek.build(ext);
  // Standalone local-origin glass mesh (Law #17: LENS_GLASS_GLSL local-origin invariant!)
  const glassMesh = new THREE.Mesh(prep(revolve([[0, zGlassEdge - 1.5], [def.glassR * 0.45, zGlassEdge - 1.1], [def.glassR * 0.8, zGlassEdge - 0.5], [def.glassR + 0.2, zGlassEdge]], { segs: 64 })), glassMat);
  ext.add(glassMesh);

  // Lazy 3D Stainless Olympus OM-Mount Rear Bayonet Hardware (built when detached / exploded — Law #27!)
  const rearMount = new THREE.Group(); rearMount.visible = false; group.add(rearMount);
  let rearBuilt = false;
  const ensureRear = () => {
    if (rearBuilt) return false;
    rearBuilt = true;
    const rk = new Kit(), steel = lib.get('steel'), flock = lib.get('flock'), anod = lib.get('anod');
    const rearGlassMat = lib.prepare(new THREE.MeshPhysicalMaterial({ name: `om1RearGlass_${lens.id}`, color: 0x0c1a22, metalness: 0.14, roughness: 0.03, clearcoat: 1.0, clearcoatRoughness: 0.02, specularIntensity: 1.0, envMapIntensity: 1.75 }), {});
    const arcSector = (rIn, rOut, a0, a1) => {
      const s = new THREE.Shape(); s.absarc(0, 0, rOut, a0, a1, false); s.absarc(0, 0, rIn, a1, a0, true); s.closePath(); return s;
    };
    // Bright machined stainless OM bayonet flange plate (z = 0..+1.35 mm) + 4 stainless Phillips flange screws!
    rk.add(revolve([[20.4, 0.0], [28.2, 0.0], [28.2, 1.15, 0.25], [27.4, 1.35], [20.6, 1.35], [20.6, 0.2]], { segs: 84, crease: 28 }), steel);
    [32, 122, 212, 302].forEach((a) => addScrew(rk, chrome, rk, flock, T(Math.cos(a * DEG) * 26.0, Math.sin(a * DEG) * 26.0, 1.38), 0.90, true, 0.3));
    // Undercut bayonet throat + 3 wide watertight beveled stainless OM bayonet locking wings (z = +2.8..+4.45 mm w/ 1.45 mm shadow gap!)
    rk.add(revolve([[20.2, 1.3], [21.3, 1.3], [21.3, 2.95], [20.2, 2.95]], { segs: 72, crease: 26 }), anod);
    [8, 128, 248].forEach((a0) => {
      rk.add(slab(arcSector(20.4, 24.6, a0 * DEG, (a0 + 52) * DEG), 1.65, 0.22, 24, 0.45, 2), chrome, T(0, 0, 2.8));
    });
    // Matte-black inner rear shroud + watertight curved rear-element protective baffle fin
    rk.add(revolve([[14.4, 0.2], [20.4, 0.2], [20.4, 4.6, 0.3], [15.0, 5.2], [14.0, 4.2]], { segs: 72, crease: 28 }), intBlk);
    rk.add(slab(arcSector(14.8, 17.4, -148 * DEG, -48 * DEG), 3.6, 0.25, 24, 0.4, 2), intBlk, T(0, 0, 4.3));
    // Twin iconic Olympus OM rear mechanical linkages: stop-down diaphragm lug (-102°) + meter-coupling prong (+52°)
    const levA = -102 * DEG;
    rk.add(rbox(1.4, 4.4, 6.2, 0.35, 2), chrome, T(Math.cos(levA) * 18.6, Math.sin(levA) * 18.6, 4.6, 0, 0, levA));
    const metA = 52 * DEG;
    rk.add(rbox(1.4, 4.0, 5.2, 0.35, 2), steel, T(Math.cos(metA) * 18.8, Math.sin(metA) * 18.8, 4.1, 0, 0, metA));
    // Outward-facing (+Z) glossy multi-coated convex rear Zuiko optical element (r descending -> nz > 0!)
    rk.add(revolve([[14.6, 2.6], [13.8, 2.9], [13.8, 2.0]], { segs: 48 }), anod);
    rk.add(new THREE.CircleGeometry(14.0, 48), intBlk, T(0, 0, 1.3));
    rk.add(revolve([[14.0, 2.2], [12.2, 2.85], [7.2, 4.05], [0, 4.55]], { segs: 48 }), rearGlassMat);
    rk.build(rearMount);
    return true;
  };

  // Lazy cutaway optical elements (OM1_OPTICS)
  const inner = new THREE.Group(); inner.visible = false; ext.add(inner);
  let innerBuilt = false;
  const ensureInner = () => {
    if (innerBuilt) return false;
    innerBuilt = true;
    const ik = new Kit(), spec = OM1_OPTICS[lens.id] || OM1_OPTICS['zuiko-50-1.8'];
    const gInner = lib.get('innerGlass'), rimBlack = lib.get('anod');
    const zStart = -L + 4.8, zEnd = -3.6;
    spec.forEach(([zf, rf, th, R1, R2]) => {
      const z0 = lerp(zStart, zEnd, zf), r = Math.max(6.2, def.glassR * rf);
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

  // Lens hood: REAL permanently-parked Silver-Nose telescoping metal sleeve on E.Zuiko 135/3.5 (slides forward on hoodOn!), lazy 49 mm hood on shorter primes!
  const hoodGroup = new THREE.Group(); hoodGroup.visible = Boolean(def.builtInHood); ext.add(hoodGroup);
  let hoodBuilt = false;
  const ensureHood = () => {
    if (hoodBuilt) return false;
    hoodBuilt = true;
    const hk = new Kit(), hl = def.hoodLen || 19.0;
    if (def.builtInHood) {
      const rOut = def.rFront + 1.6, rIn = def.rFront + 0.25;
      const zBack = -L + hl, zFront = -L + 0.4;
      // Iconic E.Zuiko 135/3.5 Silver-Nose telescoping metal hood w/ gleaming brushed stainless front collar + ribbed matte black body!
      hk.add(revolve([
        [rIn, zFront], [rOut - 0.45, zFront, 0.35], [rOut, zFront + 0.55, 0.35], [rOut, zFront + 2.8, 0.2], [rOut - 0.2, zFront + 3.0],
      ], { segs: 96, crease: 28 }), chrome);
      hk.add(revolve([
        [rOut - 0.15, zFront + 2.8], [rOut + 0.25, zFront + 3.2, 0.3, 1], [rOut + 0.25, zFront + 8.4, 0.3, 1],
        [rOut, zFront + 9.0, 0.3], [rOut, zBack - 0.5, 0.35], [rIn, zBack],
      ], { segs: 480, crease: 28, ribs: { n: 80, depth: 0.34, groove: 0.48, edge: 0.16 } }), bk);
      hk.add(revolve([[rIn, zBack], [rIn, zFront + 0.5]], { segs: 84 }), intBlk);
    } else {
      const rB = def.rFront + 0.4, rT = rB + hl * 0.24;
      hk.add(revolve([[rT - 0.6, -L - hl], [rT, -L - hl + 0.5, 0.5], [rB + 0.4, -L + 2.0], [rB - 0.8, -L + 2.0], [rT - 1.2, -L - hl + 0.8], [rT - 0.6, -L - hl]], { segs: 84, crease: 30 }), lib.get('anod'));
    }
    hk.build(hoodGroup);
    return true;
  };
  if (def.builtInHood) ensureHood();

  // Lazy 49 mm screw-in optical filter (n=64, segs=512!)
  const filterGroup = new THREE.Group(); filterGroup.visible = false; ext.add(filterGroup);
  const filterMat = new THREE.MeshPhysicalMaterial({ name: `om1Filter_${lens.id}`, color: 0xffffff, roughness: 0.03, transparent: true, opacity: 0.34, depthWrite: false });
  lib.prepare(filterMat, {});
  const filterMeshes = [];
  let filterBuilt = false;
  const ensureFilter = () => {
    if (filterBuilt) return false;
    filterBuilt = true;
    const flk = new Kit(), ft = def.thread;
    flk.add(revolve([[ft - 0.6, -L - 4.6], [ft + 1.0, -L - 4.6, 0.4, 1], [ft + 1.0, -L - 0.4, 0.4, 1], [ft - 0.6, -L], [ft - 0.6, -L + 1.2]], { segs: 512, crease: 30, ribs: { n: 64, depth: 0.22 } }), lib.get('anod', { hover: hov.filter }));
    flk.add(new THREE.CircleGeometry(ft - 1.0, 48), filterMat, T(0, 0, -L - 2.8, 0, Math.PI, 0));
    filterMeshes.push(...flk.build(filterGroup, 'filter'));
    return true;
  };

  return { group, lens, def, L, lensGlassU, glassMesh, rearMount, dofButton, pupilMag: oSpec.pupilMag ?? 1.0, focalMm: oSpec.focalCalMm || lens.focalLength || 50, focus, aperture, ext, inner, hoodGroup, filterGroup, filterMat, ensureRear, ensureInner, ensureHood, ensureFilter, focusMeshes, apertureMeshes, filterMeshes };
}

// ───────── The Camera Factory ─────────
const PARTS = ['focus', 'aperture', 'shutter', 'filter', 'crank', 'release', 'finder', 'aim', 'roll'];

export function createCameraOM1({ lens }) {
  const t0 = performance.now();
  const clipPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 1e7);
  const base = baseMaterials();
  const P = (o) => new THREE.MeshPhysicalMaterial(o);
  const BB = beadBlastMaps(), VL = vulcaniteMaps();
  // True bare-metal 1976 Olympus glass-bead-blasted satin silver chrome over brass (metalness: 1.0, ZERO plastic clearcoat!)
  base.satinChrome = P({ name: 'om1SatinChrome', color: 0xd0d4da, metalness: 1.0, roughness: 0.28, roughnessMap: BB.rgh, normalMap: BB.nrm, normalScale: new THREE.Vector2(0.15, 0.15), anisotropy: 0.12, envMapIntensity: 0.96 });
  base.satinChrome.userData.wear = 'chrome';
  // High-relief jet-black stamped Japanese vulcanite leatherette (deep crevices + glossy pebble crowns, zero dusty-grey wash!)
  base.leather = P({ name: 'om1Vulcanite', color: 0x09090b, map: VL.mac, roughness: 0.45, diffuseRoughness: 0.44, roughnessMap: VL.rgh, normalMap: VL.nrm, normalScale: new THREE.Vector2(1.85, 1.85), specularIntensity: 0.68, sheen: 0.08, sheenRoughness: 0.65, sheenColor: 0x16161a });
  base.leather.userData.wear = 'leather';
  base.blackEnamel = P({ name: 'om1BlackEnamel', color: 0x050507, metalness: 0.22, roughness: 0.20, roughnessMap: BB.rgh, normalMap: BB.nrm, normalScale: new THREE.Vector2(0.08, 0.08), clearcoat: 0.56, clearcoatRoughness: 0.16, envMapIntensity: 0.78 });
  base.blackEnamel.userData.wear = 'blackChrome';
  // Tactile matte vulcanized rubber (eyepiece surround, wind-lever thumb pad, meter switch)
  base.rubber = P({ name: 'om1Rubber', color: 0x0b0b0e, metalness: 0.0, roughness: 0.76, roughnessMap: BB.rgh, normalMap: BB.nrm, normalScale: new THREE.Vector2(0.28, 0.28), specularIntensity: 0.30 });
  // Law #18: Dead-flat light-absorbing interior black (specularIntensity: 0.0!)
  base.interiorBlack = P({ name: 'om1InteriorBlack', color: 0x020203, metalness: 0.0, roughness: 0.98, specularIntensity: 0.0, envMapIntensity: 0.04 });
  base.curtain = P({ name: 'om1ShutterCloth', color: 0x050506, roughness: 0.96, metalness: 0.0, specularIntensity: 0.02, envMapIntensity: 0.06, side: THREE.DoubleSide });
  base.pressurePlate = P({ name: 'om1PressurePlate', color: 0x060608, roughness: 0.72, metalness: 0.04, clearcoat: 0.0, specularIntensity: 0.14, envMapIntensity: 0.16 });
  const lib = new MatLib(base, [clipPlane]);
  const hov = {};
  PARTS.forEach((name) => { hov[name] = { name, amount: { value: 0 }, color: { value: new THREE.Color(1.0, 0.82, 0.5).multiplyScalar(0.28) }, target: 0 }; });

  const root = new THREE.Group();
  root.name = 'camera503';
  root.userData.kind = 'om1';
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
  const lensDyn = (Lx) => [Lx.group, Lx.focus, Lx.ext, Lx.aperture, Lx.dofButton, Lx.inner, Lx.hoodGroup, Lx.filterGroup, Lx.glassMesh, Lx.rearMount].filter(Boolean);
  const camDyn = [
    mm, body.core, body.top, body.bottom, body.door, body.mirrorPivot, body.selfTimer, body.shutterRing,
    body.rKnob, body.mluKnob, body.syncSwitch, body.focusScreen, body.meterSwitch, body.asaDial,
    body.curtain1Cloth, body.curtain1Lath, body.curtain2Cloth, body.curtain2Lath,
    body.sprocket, body.takeup, body.filmCart, body.filmStrip,
    body.release, body.lever, body.rwSpin, body.rwCrankPivot, body.rwTipPivot,
    body.eyeScreen, lensMount, head.yawMM, head.pitchMM, head.rollMM, head.bubble, blob, ...lensDyn(L),
  ];
  const camLists = [body.shutterMeshes, body.releaseMeshes, body.leverMeshes, body.eyepieceMeshes, head.aimMeshes, head.rollMeshes, ...lensLists(L)];
  mergeStaticRigid(root, { dynamic: new Set(camDyn), lists: camLists });
  // Law #24: All live-app camera meshes MUST live strictly on layer 1 (never photobomb taking lens on layer 0)!
  const toLayer = (obj) => obj.traverse((o) => { if (!o.isMesh) return; o.layers.set(1); o.castShadow = !o.userData.noShadow && !o.material.transparent; o.receiveShadow = !o.userData.noShadow; });
  toLayer(root);

  const pickables = {};
  const refreshPickables = () => {
    Object.assign(pickables, {
      focus: L.focusMeshes, aperture: L.apertureMeshes, shutter: body.shutterMeshes,
      filter: L.filterMeshes, crank: body.leverMeshes, release: body.releaseMeshes,
      finder: body.eyepieceMeshes, aim: head.aimMeshes, roll: head.rollMeshes,
    });
  };
  refreshPickables();

  const st = {
    focusRot: 0, focusT: 0, ext: 0, extT: 0, apRot: 0, apT: 0, dial: 0, dialT: 0,
    dofK: 0, dofT: 0, stopDown: 0, lever: 0, press: 0, mirrorK: 0, curtain1: 0, curtain2: 0,
    doorK: 0, filmLoaded: true, filmPhase: 0, rewind: 0, crankOpen: 0,
    meterSwitch: 0, isoRot: 0, rLeverK: 0, mluK: 0, syncK: 0, selfTimerK: 0, screenDropK: 0,
    explodeK: 0, lensOut: 0, lensTwist: 0, hoodOn: false, filterId: 'none', polAngle: 90, snapRings: false,
  };
  let live = null, cutaway = false, lastCtr = null;

  function drawCounter(s) {
    // OM-1 manual p-07: opening the camera back resets the frame counter automatically to 'S'!
    const f = st.doorK > 0.15 ? 0 : (s?.frame ?? 1);
    if (f === lastCtr) return;
    lastCtr = f;
    const g = body.ctrCv.getContext('2d');
    g.fillStyle = '#0e1014'; g.fillRect(0, 0, 128, 128);
    g.fillStyle = f <= 0 ? '#e87028' : '#f2f0ea';
    g.font = `800 78px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(f <= 0 ? 'S' : String(f), 64, 68);
    body.ctrTex.needsUpdate = true;
  }

  function ringTargets(s) {
    if (!s) return;
    const d = s.focus ?? 10000;
    st.focusT = focusAngle(L.lens, d);
    st.extT = helicoidExtensionMm(L.lens, d);
    // rotation.z = +theta maps engraved label phi -> phi - theta, so aligning phi_label to 12 o'clock requires theta = +phi_label!
    const ap = L.lens.apertureStops, last = ap.length - 1;
    let N = typeof s.aperture === 'number' && s.aperture > 0 ? s.aperture : ap[0];
    N = Math.min(ap[last], Math.max(ap[0], N));
    let ai = last;
    for (let i = 0; i < last; i++) if (N <= ap[i + 1]) { ai = i + Math.log(N / ap[i]) / Math.log(ap[i + 1] / ap[i]); break; }
    st.apT = -ai * AP_STEP;
    const shI = s.shutterIdx ?? 7; // 1/125 s -> index 7 in SHUTTERS['olympus-om1'] -> label index 8 ('125', phi = 0)!
    st.dialT = (shI - 7) * SHUTTER_STEP;
    st.dofT = s.stopDown ? 1 : 0;
    const iso = s.film?.iso ?? s.iso;
    if (typeof iso === 'number' && iso > 0) st.isoRot = Math.log2(iso / 400) * (TAU * 0.88 / 6.33);
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
    body.top.position.set(0, 38 * e, 0);
    body.bottom.position.set(0, -32 * e, 0);
    body.door.position.z = body.doorRestZ + 28 * e;
    body.door.rotation.y = lerp(0, 1.85, st.doorK);
    lensMount.position.z = DIM.flange - 54 * e - 34 * st.lensOut;
    lensMount.rotation.z = st.lensTwist * 1.22; // 70° OM bayonet rotation angle (manual p-07!)
    L.focus.rotation.z = st.focusRot;
    L.ext.position.z = -st.ext;
    L.aperture.rotation.z = st.apRot;
    if (L.dofButton) {
      const dofR = L.def.rMount + 0.5 - 1.2 * st.dofK;
      L.dofButton.position.set(Math.cos(-38 * DEG) * dofR, Math.sin(-38 * DEG) * dofR, -3.2);
    }
    // Automatic Zuiko OM diaphragm: wide open at rest for bright viewing; stops smoothly down on DoF button (st.dofK) or exposure (st.mirrorK)!
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
      L.hoodGroup.position.z = st.hoodOn ? -(L.def.hoodSlide || 30.0) : 0;
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
    // Iconic OM-1 concentric lens-mount shutter speed ring rotates around -Z!
    body.shutterRing.rotation.z = st.dial;
    body.lever.rotation.y = st.lever;
    body.release.position.y = B.deck - 1.6 * st.press;
    // Animatable OM-1 body controls (meter switch, ASA dial, R clutch, MLU knob, FP/X sync, self-timer, through-mount focusing screen!)
    body.meterSwitch.rotation.y = -0.68 * (st.meterSwitch || 0);
    body.asaDial.rotation.y = st.isoRot || 0;
    body.rKnob.rotation.z = -1.57 * (st.rLeverK || 0);
    body.mluKnob.rotation.z = -1.57 * (st.mluK || 0);
    body.syncSwitch.rotation.z = 0.78 * (st.syncK || 0);
    body.selfTimer.rotation.z = -1.75 * (st.selfTimerK || 0);
    const sd = Math.max(0, Math.min(1, st.screenDropK || 0));
    body.focusScreen.rotation.x = -0.72 * smoothstep(sd, 0, 0.55);
    body.focusScreen.position.set(0, 20.4 - 6.0 * smoothstep(sd, 0.45, 1.0), -9.0 - 28.0 * smoothstep(sd, 0.45, 1.0));
    const crankK = Math.max(st.doorK, st.crankOpen || 0);
    body.rwSpin.rotation.y = st.rewind;
    body.rwSpin.position.y = B.deck + 1.4 + 11.0 * st.doorK;
    body.rwCrankPivot.rotation.z = -0.62 * crankK;
    body.rwTipPivot.rotation.z = lerp(-Math.PI / 2, 0.0, crankK);
    body.mirrorPivot.rotation.x = lerp(-Math.PI / 4, 0, Math.max(st.mirrorK, st.mluK || 0));
    // Horizontal rubberized-cloth focal-plane shutter curtains (1/60 s X-sync!)
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
      anchor(lensMount, 0, 35, -L.L / 2, 'OM-Mount Zuiko Lens', `${L.lens.focalLength} mm ƒ/${L.lens.maxAperture} · front aperture ring & barrel DoF button`),
      anchor(body.shutterRing, 0, 34, -43, 'Concentric Shutter Ring', 'Maitani mount-mounted shutter control · 1 s – 1/1000 s + B (1/60 X)'),
      anchor(body.top, 0, B.prismY + 6, -14, '0.92× Bare Pyramid Finder', '97% wide-vision silvered pentaprism · Type 1-13 split-image screen'),
      anchor(body.mirrorPivot, 0, -6, -12, 'Air-Damper Reflex Mirror', 'pneumatic shock-damped oversize mirror + horizontal cloth shutter'),
      anchor(body.door, 0, 0, B.zB + 8, 'Removable 35 mm Back', 'stepped cassette contour, guide pins & dual sprocket transport'),
    ];
  }
  buildLabels();

  const tmpQ = new THREE.Quaternion();
  const api = {
    root, parts: { mm, body, lensMount, get lens() { return L; } }, opticsMoving: false, cutSide: 1, pickables, buildMs: 0, st, timeScale: 1, applyPose,
    setAim(pan, tilt, roll = 0) { yaw.rotation.y = -Math.PI / 2 + pan; pitch.rotation.x = tilt; rollG.rotation.z = roll; root.updateMatrixWorld(true); },
    bodyCenter(v) { return mm.localToWorld(v.set(4, 4, -12)); },
    worldToBody(v) { return mm.worldToLocal(v); },
    setScreenTexture(texObj) { body.screenMat.map = texObj; body.screenMat.color.setScalar(0.95); body.screenMat.needsUpdate = true; },
    eyePose() {
      const q = rollG.getWorldQuaternion(new THREE.Quaternion());
      const E = DIM.eyepiece;
      return {
        eye: mm.localToWorld(new THREE.Vector3(E.x, E.y, E.z + 22.0)),
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
      if (L.def.builtInHood) { L.hoodGroup.visible = true; L.hoodGroup.position.z = st.hoodOn ? -(L.def.hoodSlide || 30.0) : 0; }
      else { if (st.hoodOn && L.ensureHood?.()) toLayer(L.hoodGroup); L.hoodGroup.visible = st.hoodOn; L.hoodGroup.position.z = 0; }
    },
    setFilter(filterId, polAngle = st.polAngle) { st.filterId = filterId || 'none'; st.polAngle = polAngle; if (live) { live.filter = st.filterId; live.polAngle = polAngle; } if (st.filterId !== 'none' && L.ensureFilter?.()) { toLayer(L.filterGroup); refreshPickables(); } },
    get hoodOn() { return Boolean(st.hoodOn); },
    get hasHood() { return true; },
    filmOffset() {
      const ep = lensOpticsFor(L.lens).entrancePupilMm || 22.0;
      return mm.localToWorld(new THREE.Vector3(0, 0, DIM.flange - L.L - st.ext + ep)).distanceTo(mm.localToWorld(new THREE.Vector3(0, 0, 0)));
    },
    lensPose(pos, quat) {
      const ep = lensOpticsFor(L.lens).entrancePupilMm || 22.0;
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
      if (part === 'shutter') return 7 - angle / SHUTTER_STEP;
      return 0;
    },
    setHover(part) { PARTS.forEach((p) => { hov[p].target = p === part ? 1 : 0; }); },
    setDoorOpen(on) { return animate('doorK', on ? 1 : 0, 0.55); },
    setFilmLoaded(on) { st.filmLoaded = Boolean(on); applyPose(); },
    async setExploded(on) { setCutaway(false); await animate('explodeK', on ? 1 : 0, 1.3); },
    async swapLens(next, onSwap, immediate = false) {
      const vis = root.visible && !immediate;
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
    async fire({ seconds = 1 / 125, side = 1, onMirror = () => {}, onExpose = () => {}, onSound = () => {}, cutaway: cut = false, wind = true }) {
      api.cutSide = side;
      if (cut) setCutaway(true);
      await animate('press', 1, 0.08);
      onSound('release');
      onMirror(true);
      await animate('mirrorK', 1, 0.05);
      const travelSec = 0.033; // Horizontal cloth curtains (1/60 s X-sync!)
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
      if (wind) {
        onSound('wind');
        const startPhase = st.filmPhase;
        await tween(0.28, (k) => {
          st.lever = LEVER_STROKE * k;
          st.curtain1 = 1 - k;
          st.curtain2 = 1 - k;
          st.filmPhase = startPhase + k;
        }, easeInOut, 'wind');
        await animate('lever', 0, 0.18);
      }
      if (cut) setCutaway(false);
    },
    setCutaway(on, side = 1) { api.cutSide = side; setCutaway(on); },
    labelAt(obj) {
      let cur = obj;
      while (cur) {
        if (cur === lensMount) return { text: 'OM-Mount Zuiko Lens', sub: `${L.lens.focalLength} mm ƒ/${L.lens.maxAperture} · front aperture ring & barrel DoF button` };
        if (cur === body.shutterRing) return { text: 'Concentric Shutter Speed Ring', sub: '1 s – 1/1000 s + B around OM mount · twin finger tabs' };
        if (cur === body.lever) return { text: 'Maitani Rapid-Wind Lever', sub: '150° ratchet advance cocks horizontal cloth curtains & film' };
        if (cur === body.release) return { text: 'Threaded Shutter Release', sub: 'conical collar release button with cable socket' };
        if (cur === body.rwSpin) return { text: 'Film Rewind Crank', sub: 'horizontally-grooved chrome drum · lifts to release removable back' };
        if (cur === body.selfTimer) return { text: 'Mechanical Self-Timer', sub: '4–12 s variable delay lever with chrome center rib' };
        if (cur === body.mirrorPivot) return { text: 'Air-Damper Reflex Mirror', sub: 'pneumatic shock-damped oversize mirror + horizontal cloth shutter' };
        if (cur === body.door) return { text: 'Removable 35 mm Film Back', sub: 'stepped cassette contour, pressure plate & cartridge leaf spring' };
        if (cur === body.top) return { text: 'OM-1 Top Deck & Pyramid Finder', sub: '0.92× bare peaked prism, ASA 25–1600 dial, ON/OFF switch & counter' };
        if (cur === body.bottom) return { text: 'MD Baseplate & Contacts', sub: 'PX625 battery lid, MD coupling cap, tripod bush & twin gold terminals' };
        if (cur === body.core) return { text: 'Ultra-Compact OM-1 MD Chassis', sub: '136 × 83 × 50 mm · 46.0 mm OM mount, R clutch, MLU & FP/X sync' };
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
  drawCounter({ frame: 1 });
  applyPose();
  api.buildMs = performance.now() - t0;
  return api;
}
