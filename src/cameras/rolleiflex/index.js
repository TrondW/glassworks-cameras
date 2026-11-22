// The camera: a Rolleiflex 2.8F (K7F) 6×6 Twin-Lens Reflex (TLR) with matched 80 mm f/2.8 Heidosmat viewing lens and
// 5-element 80 mm f/2.8 Planar taking lens in a Synchro-Compur MXV leaf shutter, coupled selenium exposure meter,
// expanding white DoF band, lower-rear ASA/DIN & filter-factor dial, bottom-front 120 supply bay & Automatik feeler rollers,
// on the shared carbon tripod and 3-way head. Every part procedural, in millimetres, from lib/. Neutral GLASS WORKS legends.
//
// Model axes (CONTRACT.md): lower taking lens axis along −Z, +X = photographer's right (crank side), +Y up.
// Origin: taking lens axis on the 6×6 film plane (z = 0). Upper viewing lens axis sits at y = +46.3 mm (exact Bay III TLR pitch).
//
// Calibrated directly to 32 Kamerastore studio photos (k7f_a_01..10, k7f_b_01..09, wf_01..05) + Wikimedia 2.8F references:
// Closed envelope: ~112 W × 148 H × 104 D mm (77.5 W × 73.0 D chassis cube + front focusing board & Bay III barrels + closed hood).
import * as THREE from 'three';
import { INK, PAINT_BG } from '../../lib/engrave.js';
import { addScrew, radialT, rbox, revolve, rrPath, slab } from '../../lib/geometry.js';
import { MatLib, baseMaterials } from '../../lib/materials.js';
import { Kit, mergeStaticRigid, prep } from '../../lib/mesh.js';
import { buildHead, buildTripod } from '../../lib/rig.js';
import { brushedMap } from '../../lib/textures.js';
import { DEG, T, TAU, easeInOut, easeOutBack, lerp, phase } from '../../lib/util.js';
import { lensOpticsFor, helicoidExtensionMm, filterOpticsFor, dofLimits } from '../../optics.js';
export { flushCameraTextures } from '../../lib/textures.js';

// Authentic German geometric Art-Deco / DIN sans-serif typography (light stroke, wide tracking — never chunky bold Arial!)
const ROLLEI_FONT = '"Futura", "Avenir Next", "DIN Alternate", "Helvetica Neue", sans-serif';

export const DIM = {
  // Exact Rolleiflex 2.8F (K7F) chassis cube: 77.5 mm wide × 73.0 mm deep (zF=-67..zB=+6) × 128.5 mm shell (y0=-42.5..y1=+86.0)
  // Plus ~2.6 mm bottom chrome feet (-45.1) and ~15.5 mm closed two-tier hood (+101.5) -> 146.6 mm closed height (spec 148 mm).
  body: { hw: 38.75, y0: -42.5, y1: 86.0, zF: -67.0, zB: 6.0 },
  boardZ: -74.0,
  takeY: 0,
  viewY: 46.3, // Exact Bay III 2.8F vertical lens axis pitch (outer Bay III flanges kiss cleanly!)
  screenY: 86.2,
  screenZ: -30.5,
  screen: 56.0,
  // Left flank (-X): calibrated directly to k7f_a_01, k7f_a_04, k7f_a_05, k7f_b_04, k7f_b_05!
  knob: { x: -38.8, y: 17.5, z: -40.5, r: 20.8 },      // Focusing knob sits forward of center & above mid-height
  asaDial: { x: -38.8, y: -15.5, z: -20.0, r: 14.4 },  // Large ASA/DIN & Filter-Factor dial sits LOWER-REAR, tucked below-rear of focusing knob!
  spoolLow: { y: -30.5, z: -51.5, r: 6.4 },            // Lower 120 supply spool knob sits at BOTTOM-FRONT (coaxial with front-bottom 120 supply chamber!)
  spoolHigh: { y: 45.5, z: -10.5, r: 6.4 },            // Upper 120 take-up spool knob sits at UPPER-REAR (coaxial with upper-rear take-up chamber!)
  // Right flank (+X): calibrated directly to k7f_a_02, k7f_a_03, k7f_b_02, k7f_b_03, wf_02!
  crank: { x: 38.8, y: 8.0, z: -32.0, r: 24.4, len: 42.5 }, // Huge 3-ring concentric bullseye spanning ~70% of right flank; arm sweeps down-rearward (+Z)!
  counter: { y: 37.5, z: -50.5 },                      // Frame counter eyelet tucked closely above-front of bullseye rim (zoom_08!)
  socket: { x: 0, z: -30.5 },
  tripod: { apex: 1210, spread: 560 },
};
const B = DIM.body;
const FOCUS_PITCH = 28.0 * DEG; // ~246° knob rotation for 8.801 mm Planar focus travel (∞ -> 0.9 m)
const AP_STEP = 18 * DEG;
const SH_STEP = 18 * DEG;

function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function tex(cv) { const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
function trackedText(g, str, cx, cy, track = 0) {
  const ch = [...str], ws = ch.map((c) => g.measureText(c).width);
  const tot = ws.reduce((s, v) => s + v, 0) + track * Math.max(0, ch.length - 1);
  let x = cx - tot / 2;
  ch.forEach((c, i) => { g.fillText(c, x + ws[i] / 2, cy); x += ws[i] + track; });
}
function arcText(g, str, cx, cy, R, a, size, color, weight = 400, inward = false, track = 0) {
  g.save(); g.font = `${weight} ${size}px ${ROLLEI_FONT}`; g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle';
  const ch = [...str], w = ch.map((c) => g.measureText(c).width + track);
  const tot = w.reduce((s, v) => s + v, 0) - track;
  let cur = -tot / 2;
  ch.forEach((c, i) => {
    const phi = a + (inward ? 1 : -1) * (cur + (w[i] - track) / 2) / R; cur += w[i];
    g.save(); g.translate(cx + Math.cos(phi) * R, cy - Math.sin(phi) * R); g.rotate(-phi + (inward ? -Math.PI / 2 : Math.PI / 2));
    g.fillText(c, 0, 0); g.restore();
  });
  g.restore();
}

const focusAngle = (lens, d) => -FOCUS_PITCH * helicoidExtensionMm(lens, d);
function distanceAt(lens, angle) {
  const ext = Math.max(0, angle) / FOCUS_PITCH;
  if (ext < 1e-4) return 10000;
  let lo = lens.minFocusDistance, hi = 10000;
  for (let i = 0; i < 40; i++) { const mid = Math.sqrt(lo * hi); if (helicoidExtensionMm(lens, mid) > ext) lo = mid; else hi = mid; }
  return Math.sqrt(lo * hi);
}

// ───────── Authentic Rolleiflex 2.8F Procedural Textures & Typography ─────────
function browFrontTex() {
  // Authentic K7F straight-sided gently-crowned Art-Deco brow plaque (k7f_a_01, k7f_a_02, k7f_a_09, Rolleiflex_F2-8-f_right.jpg):
  // Finely textured dark-charcoal ground, crisp thin raised silver border hugging tight around the subtle top crown,
  // vertical sides & lower corner rivet ears, with tall slightly-condensed thin-stroke GLASS WORKS riding along the gentle crown arc!
  const W = 1024, H = 240, cv = canvas(W, H), g = cv.getContext('2d');
  g.fillStyle = '#111215'; g.fillRect(0, 0, W, H);
  // Subtle micro-pebble grain matching cast matte-black brow inlay
  for (let i = 0; i < 4200; i++) {
    const x = (i * 197.3) % W, y = (i * 89.7) % H;
    g.fillStyle = i % 2 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.08)';
    g.fillRect(x, y, 2.2, 2.2);
  }
  // Crisp bright-silver continuous perimeter shield border: gentle subtle top crown arch, straight vertical sides, hugging the 2 corner rivets!
  g.strokeStyle = '#e6e9ed'; g.lineWidth = 9; g.lineJoin = 'round';
  g.beginPath();
  g.moveTo(114, 24);
  g.quadraticCurveTo(W / 2, 4, W - 114, 24);
  g.quadraticCurveTo(W - 86, 28, W - 86, 56);
  g.lineTo(W - 86, 174);
  g.quadraticCurveTo(W - 86, 218, W - 124, 222);
  g.quadraticCurveTo(W - 156, 224, W - 166, 200);
  g.quadraticCurveTo(W / 2, 176, 166, 200);
  g.quadraticCurveTo(156, 224, 124, 222);
  g.quadraticCurveTo(86, 218, 86, 174);
  g.lineTo(86, 56);
  g.quadraticCurveTo(86, 28, 114, 24);
  g.closePath();
  g.stroke();
  // Tall, slim, subtly-arched Art-Deco geometric GLASS WORKS lettering (matching exact height/weight/gentle curve of ROLLEIFLEX in k7f_a_01!)
  g.save();
  g.fillStyle = '#eef1f4';
  g.font = `300 96px ${ROLLEI_FONT}`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const chars = [...'GLASS WORKS'];
  const widths = chars.map((c) => (c === ' ' ? 26 : g.measureText(c).width * 0.86));
  const track = 14;
  const tot = widths.reduce((a, b) => a + b, 0) + track * (chars.length - 1);
  let curX = (W - tot) / 2;
  chars.forEach((c, i) => {
    const cx = curX + widths[i] / 2;
    curX += widths[i] + track;
    if (c === ' ') return;
    const u = (cx - W / 2) / (W * 0.42); // -1..+1 across nameplate
    const archY = 86 + u * u * 13.5;     // gentle +0.85 mm crown arch matching the top border & selenium bar!
    const slope = u * 0.068;
    g.save();
    g.translate(cx, archY);
    g.rotate(slope);
    g.scale(0.84, 1.04); // authentic tall condensed geometric Rollei proportions!
    g.fillText(c, 0, 0);
    g.restore();
  });
  g.restore();
  // Flush recessed translucent silver-crystal faceted honeycomb selenium diffuser prism strip inside arched silver rim (cmp_09 left!)
  g.save();
  g.beginPath();
  g.moveTo(174, 152);
  g.quadraticCurveTo(W / 2, 134, W - 174, 152);
  g.lineTo(W - 174, 206);
  g.quadraticCurveTo(W / 2, 188, 174, 206);
  g.closePath();
  g.fillStyle = '#38404c';
  g.fill();
  g.clip();
  // Continuous 16-cell crystalline honeycomb lenticular prism pattern catching bright silver-white diagonal glints
  const nCells = 16, cx0 = 174, cw = (W - 348) / nCells;
  for (let i = 0; i < nCells; i++) {
    const x = cx0 + i * cw;
    const gr = g.createLinearGradient(x, 140, x + cw, 204);
    gr.addColorStop(0.0, '#46505e');
    gr.addColorStop(0.24, '#b8c3d0');
    gr.addColorStop(0.46, '#edf2f8');
    gr.addColorStop(0.68, '#7a8796');
    gr.addColorStop(0.92, '#2d3540');
    gr.addColorStop(1.0, '#1e242c');
    g.fillStyle = gr;
    g.fillRect(x, 132, cw - 1.5, 80);
    // Horizontal diamond/honeycomb facet cross-bevel mid-height
    g.fillStyle = 'rgba(255,255,255,0.28)';
    g.beginPath();
    g.moveTo(x + cw * 0.5, 146); g.lineTo(x + cw * 0.85, 172);
    g.lineTo(x + cw * 0.5, 196); g.lineTo(x + cw * 0.15, 172);
    g.closePath(); g.fill();
  }
  g.restore();
  g.strokeStyle = '#e0e4ea'; g.lineWidth = 6;
  g.beginPath();
  g.moveTo(174, 152);
  g.quadraticCurveTo(W / 2, 134, W - 174, 152);
  g.lineTo(W - 174, 206);
  g.quadraticCurveTo(W / 2, 188, 174, 206);
  g.closePath();
  g.stroke();
  return tex(cv);
}

function browTopTex() {
  // Delicate thin engraved top shoulder of brow (k7f_a_06, 16971406237.jpg: "GW     2,8 F  2438205     6×6")
  const cv = canvas(1024, 96), g = cv.getContext('2d');
  g.fillStyle = '#0d0d10'; g.fillRect(0, 0, 1024, 96);
  g.fillStyle = '#e4e6ea'; g.font = `300 32px ${ROLLEI_FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  trackedText(g, 'GW', 135, 50, 8);
  trackedText(g, '2,8 F  2438205', 512, 50, 5);
  trackedText(g, '6×6', 889, 50, 8);
  return tex(cv);
}

function thumbwheelFaceTex() {
  // Authentic Rolleiflex 2.8F Compur thumbwheel face (k7f_a_09, k7f_b_08!): matte-black pebbled center w/ crisp white ring!
  const cv = canvas(256, 256), g = cv.getContext('2d');
  g.fillStyle = '#111215'; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = '#eceee8'; g.lineWidth = 18; g.beginPath(); g.arc(128, 128, 60, 0, TAU); g.stroke();
  g.fillStyle = '#111215'; g.beginPath(); g.arc(128, 128, 49, 0, TAU); g.fill();
  return tex(cv);
}

function selfTimerFaceTex() {
  // Subtle diagonal black teardrop self-timer lever with crisp warm-ivory "← V" engraving (Manual p.25, k7f_a_09, k7f_b_08)
  const cv = canvas(128, 256), g = cv.getContext('2d');
  g.fillStyle = '#101114'; g.fillRect(0, 0, 128, 256);
  g.fillStyle = '#ebe6d6'; g.font = `400 44px ${ROLLEI_FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('←', 64, 120);
  g.fillText('V', 64, 178);
  return tex(cv);
}

function xmSyncIconsTex() {
  // Crisp tiny white ⚡ (X-contact) and flashbulb (M-contact) engraved on the upper-right front board above the lever (Manual p.25!)
  const cv = canvas(128, 64), g = cv.getContext('2d');
  g.clearRect(0, 0, 128, 64);
  g.strokeStyle = '#eceee8'; g.fillStyle = '#eceee8'; g.lineWidth = 4;
  // Lightning bolt ⚡ on left (+X outer side)
  g.beginPath(); g.moveTo(34, 10); g.lineTo(22, 34); g.lineTo(34, 34); g.lineTo(24, 54); g.stroke();
  // Flashbulb outline (M) on right (inner side toward lens)
  g.beginPath(); g.arc(92, 26, 12, 0, TAU); g.stroke();
  g.fillRect(86, 38, 12, 9);
  return tex(cv);
}

function filmReminderTex() {
  // Semicircular "pan" film-type reminder window below central knurled knob on black Gossen meter cap (Manual p.10 #3, p.30 #1!)
  const cv = canvas(128, 64), g = cv.getContext('2d');
  g.fillStyle = '#0e0f12'; g.fillRect(0, 0, 128, 64);
  g.fillStyle = '#e8e5dc'; g.beginPath(); g.roundRect(14, 10, 100, 44, 18); g.fill();
  g.strokeStyle = '#222428'; g.lineWidth = 4; g.stroke();
  g.fillStyle = '#121316'; g.font = `600 28px ${ROLLEI_FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('pan', 64, 33);
  return tex(cv);
}

function drawDofBand(cv, nearAng, farAng) {
  // Authentic K7F CONTINUOUS CURVED WHITE EXPANDING DoF BAND inside stationary knob base collar (Manual p.16–17, k7f_b_06!)
  // revolve() defaults phi0 = -PI -> u = 0.50 is EXACTLY 12 o'clock (+Y), u = 0.25 is FRONT (-Z), u = 0.75 is REAR (+Z)!
  const W = 1024, H = 64, g = cv.getContext('2d');
  g.fillStyle = '#0e0f12'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#24262b'; g.fillRect(0, 0, W, 6); g.fillRect(0, H - 6, W, 6);
  const xC = 0.50 * W;
  const x0 = Math.max(0, xC - (farAng / TAU) * W);
  const x1 = Math.min(W, xC + (nearAng / TAU) * W);
  // Solid continuous bright-white expanding DoF band centered dead-on 12 o'clock (u = 0.50)!
  g.fillStyle = '#f6f5ee';
  g.fillRect(x0, 9, Math.max(8, x1 - x0), H - 18);
  // Crisp thin black center focus-index line right at 12 o'clock (u = 0.50)
  g.fillStyle = '#101114';
  g.fillRect(xC - 2.5, 5, 5, H - 10);
}

function compurCollarTex() {
  // Authentic K7F brushed-silver SYNCHRO-COMPUR outer annulus (k7f_a_09, Rolleiflex_F2-8-f_right.jpg):
  // Gleaming silver band with 3 crisp thin concentric black grooves & delicate German DIN engraving!
  const cv = canvas(1024, 1024), g = cv.getContext('2d');
  g.fillStyle = '#0b0c0e'; g.fillRect(0, 0, 1024, 1024);
  g.fillStyle = '#e3e6ea'; g.beginPath(); g.arc(512, 512, 498, 0, TAU); g.fill();
  g.strokeStyle = '#111215'; g.lineWidth = 9; g.beginPath(); g.arc(512, 512, 495, 0, TAU); g.stroke();
  g.fillStyle = '#0e0f12'; g.beginPath(); g.arc(512, 512, 428, 0, TAU); g.fill();
  // Twin thin bright-silver concentric pinstripe grooves inside the black inner collar (zoom_04!)
  g.strokeStyle = '#dfe3e8'; g.lineWidth = 8; g.beginPath(); g.arc(512, 512, 412, 0, TAU); g.stroke();
  g.strokeStyle = '#dfe3e8'; g.lineWidth = 6; g.beginPath(); g.arc(512, 512, 396, 0, TAU); g.stroke();
  arcText(g, 'SYNCHRO-', 512, 512, 466, Math.PI, 30, '#0f1013', 500, false, 3);
  arcText(g, 'COMPUR', 512, 512, 466, 0, 30, '#0f1013', 500, false, 3);
  arcText(g, 'GLASS WORKS  ·  2.8F', 512, 512, 478, -Math.PI / 2, 26, '#0f1013', 500, true, 3);
  arcText(g, 'MADE IN GERMANY', 512, 512, 450, -Math.PI / 2, 15, '#0f1013', 500, true, 2);
  return tex(cv);
}

function lensFaceTex(title, sub, rText = 442) {
  // Delicate thin light-weight German DIN engraving centered in the wide recessed conical matte-black beauty ring (zoom_04!)
  const cv = canvas(1024, 1024), g = cv.getContext('2d');
  g.fillStyle = '#0c0c0f'; g.fillRect(0, 0, 1024, 1024);
  // Subtle micro-stepped glossy concentric retaining thread grooves + hairline bezel framing rules
  g.strokeStyle = 'rgba(255,255,255,0.06)'; g.lineWidth = 3;
  [378, 392, 406].forEach((r) => { g.beginPath(); g.arc(512, 512, r, 0, TAU); g.stroke(); });
  g.strokeStyle = 'rgba(232,236,244,0.22)'; g.lineWidth = 2.5;
  [rText - 42, 492].forEach((r) => { g.beginPath(); g.arc(512, 512, r, 0, TAU); g.stroke(); });
  arcText(g, title, 512, 512, rText, Math.PI / 2, 26, '#eceef2', 400, false, 5);
  arcText(g, sub, 512, 512, rText, -Math.PI / 2, 25, '#eceef2', 400, true, 5);
  return tex(cv);
}

function rolleinarFaceTex(title, sub, rText = 446) {
  // Crisp anodized black Bay III Rolleinar / Rolleipark close-up bezel ring w/ white DIN engraving & fine hairline rules
  const cv = canvas(1024, 1024), g = cv.getContext('2d');
  g.fillStyle = '#0a0b0e'; g.fillRect(0, 0, 1024, 1024);
  g.strokeStyle = 'rgba(232,236,244,0.24)'; g.lineWidth = 2.5;
  [394, 496].forEach((r) => { g.beginPath(); g.arc(512, 512, r, 0, TAU); g.stroke(); });
  arcText(g, title, 512, 512, rText, Math.PI / 2, 32, '#f2f3f6', 600, false, 4);
  arcText(g, sub, 512, 512, rText, -Math.PI / 2, 28, '#dfe3ea', 500, true, 4);
  return tex(cv);
}

function drawAsaDial(cv, iso = 400, filterStops = 0) {
  // Authentic K7F large lower-rear ASA/DIN & Filter-Factor dial (k7f_a_04, k7f_b_04, k7f_b_05!):
  // Outer matte-black face with crisp silver perimeter ring, ASA window (top), DIN window (bottom), filter-factor marks!
  const g = cv.getContext('2d');
  g.fillStyle = '#101114'; g.fillRect(0, 0, 512, 512);
  // Crisp thin bright-silver outer & inner divider rings
  g.strokeStyle = '#dde0e4'; g.lineWidth = 7;
  g.beginPath(); g.arc(256, 256, 240, 0, TAU); g.stroke();
  g.strokeStyle = '#9aa0a8'; g.lineWidth = 3;
  g.beginPath(); g.arc(256, 256, 134, 0, TAU); g.stroke();
  // ASA (upper arc) + white rectangular readout window
  const din = Math.round(1 + 10 * Math.log10(Math.max(6, iso)));
  arcText(g, 'ASA', 256, 256, 192, Math.PI * 0.66, 30, '#e8eaee', 400, false, 3);
  g.fillStyle = '#ece9df'; g.beginPath(); g.roundRect(244, 46, 90, 44, 6); g.fill();
  g.strokeStyle = '#18191c'; g.lineWidth = 3; g.stroke();
  g.fillStyle = '#121316'; g.font = `600 30px ${ROLLEI_FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(String(Math.round(iso)), 289, 69);
  // DIN (lower arc) + white rectangular readout window
  arcText(g, 'DIN', 256, 256, 192, -Math.PI * 0.34, 30, '#e8eaee', 400, true, 3);
  g.fillStyle = '#ece9df'; g.beginPath(); g.roundRect(178, 422, 74, 44, 6); g.fill();
  g.strokeStyle = '#18191c'; g.lineWidth = 3; g.stroke();
  g.fillStyle = '#121316'; g.font = `600 30px ${ROLLEI_FONT}`;
  g.fillText(String(din), 215, 445);
  // Filter-factor compensation index ticks on left/front perimeter (-0.5 .. -3)
  const ffMarks = [['0', 0], ['-1', 1], ['-2', 2], ['-3', 3]];
  ffMarks.forEach(([lbl, st]) => {
    const a = Math.PI * 0.14 - st * 0.34;
    arcText(g, lbl, 256, 256, 192, a, 26, Math.abs(filterStops - st) < 0.35 ? '#f5cf5b' : '#dfe2e6', 500);
  });
}

function filterFluteRimTex() {
  // Iconic black knurled outer cylinder with crisp white vertical flute stripes around the ASA/Filter dial (k7f_a_04, k7f_b_04!)
  const W = 1024, H = 96, cv = canvas(W, H), g = cv.getContext('2d');
  g.fillStyle = '#0f1013'; g.fillRect(0, 0, W, H);
  // White radial flutes on lower half + engraved -3 -2 -1 0 filter-factor index numerals on upper half
  const n = 48;
  for (let i = 0; i < n; i++) {
    g.fillStyle = i % 2 === 0 ? '#e4e6ea' : '#141518';
    g.fillRect((i / n) * W, 46, W / n * 0.42, 42);
  }
  g.fillStyle = '#eceae2'; g.font = `400 28px ${ROLLEI_FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  [['0', 0.16], ['-0.5', 0.28], ['-1', 0.40], ['-1.5', 0.52], ['-2', 0.64], ['-3', 0.78]].forEach(([t, u]) => g.fillText(t, u * W, 24));
  const t = tex(cv); t.wrapS = THREE.RepeatWrapping; return t;
}

function bullseyeTex() {
  // Huge right-flank 3-ring concentric bright-chrome & glossy-black crank escutcheon (zoom_08, zoom_09, Rolleiflex_F2-8-f_right.jpg!)
  const cv = canvas(512, 512), g = cv.getContext('2d');
  g.fillStyle = '#0b0c0f'; g.fillRect(0, 0, 512, 512);
  // Crisp outer black rim outside the 3 bright-chrome concentric rings matching zoom_08 proportions
  [218, 174, 130].forEach((r) => {
    g.strokeStyle = '#e3e6eb'; g.lineWidth = 15; g.beginPath(); g.arc(256, 256, r, 0, TAU); g.stroke();
  });
  return tex(cv);
}

function rearEvTableTex() {
  // Authentic Rolleiflex 2.8F COMPACT RECTANGULAR brushed-aluminum & black EV Matrix (47.5 W × 41.5 H, 1.14:1 aspect — zoom_02, zoom_03!)
  const W = 512, H = 448, cv = canvas(W, H), g = cv.getContext('2d');
  g.fillStyle = '#dfe2e6'; g.fillRect(0, 0, W, H);
  g.strokeStyle = '#9aa0a8'; g.lineWidth = 6; g.strokeRect(3, 3, W - 6, H - 6);
  // Black interior grid area (compact tight rows leaving generous black leatherette lower back panel below!)
  const x0 = 86, y0 = 54, gw = W - x0 - 12, gh = H - y0 - 12;
  g.fillStyle = '#111215'; g.fillRect(x0, y0, gw, gh);
  const fStops = ['2,8', '3,5', '4', '5,6', '8', '11', '16', '22'];
  const speeds = ['1sec', '1/2', '1/4', '1/8', '/15', '/30', '/60', '125', '250', '500'];
  const colW = gw / fStops.length, rowH = gh / speeds.length;
  g.fillStyle = '#121316'; g.font = `500 21px ${ROLLEI_FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('f:', 42, 30);
  fStops.forEach((f, ci) => g.fillText(f, x0 + (ci + 0.5) * colW, 30));
  speeds.forEach((sp, ri) => {
    const cy = y0 + (ri + 0.5) * rowH;
    g.fillStyle = '#121316'; g.font = `500 20px ${ROLLEI_FONT}`; g.fillText(sp, 44, cy);
    g.fillStyle = '#f2f2ee'; g.font = `400 20px ${ROLLEI_FONT}`;
    const offsets = [0, 0.5, 1, 2, 3, 4, 5, 6];
    offsets.forEach((off, ci) => {
      const ev = 3 + ri + off;
      const lbl = Number.isInteger(ev) ? String(ev) : `${Math.floor(ev)},5`;
      g.fillText(lbl, x0 + (ci + 0.5) * colW, cy);
    });
  });
  return tex(cv);
}

function pressurePlateTex() {
  // Authentic dead-flat matte-black 2-position sliding pressure plate with crisp warm-white 24×36mm / 6×6 format markings (zoom_10!)
  const S = 512, cv = canvas(S, S), g = cv.getContext('2d');
  g.fillStyle = '#070709'; g.fillRect(0, 0, S, S);
  g.strokeStyle = '#18191d'; g.lineWidth = 4; g.strokeRect(18, 18, S - 36, S - 36);
  g.fillStyle = '#d4cbb4'; g.font = `500 22px ${ROLLEI_FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('24×36 mm', 110, 44);
  g.fillText('6×6 cm', 402, 44);
  return tex(cv);
}

function bottomTripodPlateTex() {
  // Iconic circular brushed-chrome Rolleifix base plate with 2 concentric black rings & curved lock arrow (k7f_a_05, k7f_b_05, wf_05!)
  const cv = canvas(512, 512), g = cv.getContext('2d');
  g.fillStyle = '#e0e3e7'; g.fillRect(0, 0, 512, 512);
  g.strokeStyle = '#141518'; g.lineWidth = 22; g.beginPath(); g.arc(256, 256, 152, 0, TAU); g.stroke();
  g.lineWidth = 18; g.beginPath(); g.arc(256, 256, 98, 0, TAU); g.stroke();
  // Engraved curved directional arrow near front edge
  g.strokeStyle = '#141518'; g.lineWidth = 8;
  g.beginPath(); g.arc(256, 256, 206, -Math.PI * 0.62, -Math.PI * 0.38); g.stroke();
  g.fillStyle = '#141518';
  g.beginPath(); g.moveTo(175, 64); g.lineTo(196, 52); g.lineTo(192, 74); g.closePath(); g.fill();
  return tex(cv);
}

function gossenDialTex() {
  // Authentic K7F curved white Gossen exposure meter scale inside the clear acrylic top dome (k7f_a_06, k7f_b_06!)
  const W = 512, H = 192, cv = canvas(W, H), g = cv.getContext('2d');
  g.fillStyle = '#f2f1eb'; g.fillRect(0, 0, W, H);
  // Subtle red low-light warning zone at left/rear edge (matching k7f_b_06!)
  g.fillStyle = '#d43a24'; g.fillRect(22, 18, 66, 36);
  // Fine graduated scale ticks along the curved white dial
  g.strokeStyle = '#1a1b1e'; g.lineWidth = 3;
  for (let i = 0; i <= 18; i++) {
    const x = 36 + (i / 18) * (W - 72);
    const h = i % 3 === 0 ? 40 : 22;
    g.beginPath(); g.moveTo(x, 168); g.lineTo(x, 168 - h); g.stroke();
  }
  return tex(cv);
}

// Authentic Rolleiflex 2.8F filter compensating stops (Manual p.34!)
const FILTER_STOPS = { none: 0, uv: 0, yellow: 0.5, green: 1.5, orange: 1.5, red: 2.5, polarizer: 1.5, nd2: 1.0, nd4: 2.0, nd8: 3.0 };

function focusDrumTex(lens) {
  // Authentic K7F rotating glossy-black distance drum (k7f_a_06, k7f_b_06, Manual p.16!):
  // revolve() puts u = 0.0 at 12 o'clock (+Y), increasing u toward REAR (+Z), v = 1 (y=0) at body wall (RIGHT), v = 0 (y=H) at outer chrome ring (LEFT)!
  // Placing each distance at u(d) = +(FOCUS_PITCH * ext) / TAU brings d DEAD-CENTER to 12 o'clock (u=0) when knob.rotation.x = -FOCUS_PITCH * ext!
  // Rotating labels -Math.PI/2 makes yellow ft (LEFT, y=0.70*H) & white m (RIGHT, y=0.30*H) 100% UPRIGHT from photographer POV!
  const W = 2048, H = 256, cv = canvas(W, H), g = cv.getContext('2d');
  g.fillStyle = '#0e0f12'; g.fillRect(0, 0, W, H);
  const drawMark = (u, mLbl, ftLbl) => {
    const x = (((u % 1) + 1) % 1) * W;
    // Crisp white tick along inner body-wall edge (y=4..28, immediately adjacent to stationary white expanding DoF band at 12 o'clock!)
    g.fillStyle = '#ecebe4'; g.fillRect(x - 2, 4, 4, 24);
    g.save(); g.translate(x, H * 0.30); g.rotate(-Math.PI / 2);
    g.fillStyle = '#f2f1ea'; g.font = `400 34px ${ROLLEI_FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(mLbl, 0, 0);
    g.restore();
    if (ftLbl) {
      g.save(); g.translate(x, H * 0.70); g.rotate(-Math.PI / 2);
      g.fillStyle = '#e8c14e'; g.font = `400 32px ${ROLLEI_FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(ftLbl, 0, 0);
      g.restore();
    }
  };
  const pairs = [
    [10000, '∞', '∞'], [20, '20', '60'], [10, '10', '30'], [6, '6', '20'], [4, '4', '12'],
    [3, '3', '10'], [2.5, '2,5', '8'], [2, '2', '7'], [1.7, '1,7', '6'], [1.5, '1,5', '5'],
    [1.3, '1,3', '4½'], [1.2, '1,2', '4'], [1.1, '1,1', '3½'], [1.0, '1', '3¼'], [0.9, '0,9', '3'],
  ];
  pairs.forEach(([d, mLbl, ftLbl]) => {
    const ext = d >= 9999 ? 0 : helicoidExtensionMm(lens, d);
    // revolve() phi0=-PI -> u = 0.50 is EXACTLY 12 o'clock (+Y); increasing u steps rearward (+Z) matching k7f_a_06!
    const u = 0.50 + (FOCUS_PITCH * ext) / TAU;
    drawMark(u, mLbl, ftLbl);
  });
  // Unit tags "ft" (yellow, left) & "m" (white, right) right ahead of ∞ (u = 0.468, matching k7f_a_06!)
  const ux = 0.468 * W;
  g.save(); g.translate(ux, H * 0.70); g.rotate(-Math.PI / 2); g.fillStyle = '#e8c14e'; g.font = `400 28px ${ROLLEI_FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('ft', 0, 0); g.restore();
  g.save(); g.translate(ux, H * 0.30); g.rotate(-Math.PI / 2); g.fillStyle = '#f2f1ea'; g.font = `400 28px ${ROLLEI_FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('m', 0, 0); g.restore();
  const t = tex(cv); t.wrapS = THREE.RepeatWrapping; return t;
}

function groundGlassGridTex() {
  // Base Rolleiclear ground-glass diffuse matte tone (overlay grid & split-image wedge sit on a separate persistent layer!)
  const S = 512, cv = canvas(S, S), g = cv.getContext('2d');
  const gr = g.createRadialGradient(S / 2, S / 2, 18, S / 2, S / 2, S * 0.72);
  gr.addColorStop(0, '#c2c5ca'); gr.addColorStop(0.65, '#a8acb2'); gr.addColorStop(1, '#8c9096');
  g.fillStyle = gr; g.fillRect(0, 0, S, S);
  return tex(cv);
}

function groundGlassOverlayTex() {
  // Transparent Rolleiclear etched 4×4 grid, Fresnel rings & central split-image rangefinder wedge — persists over ANY setScreenTexture()!
  const S = 512, cv = canvas(S, S), g = cv.getContext('2d');
  g.clearRect(0, 0, S, S);
  g.strokeStyle = 'rgba(255,255,255,0.10)'; g.lineWidth = 1.5;
  for (let r = 36; r < S * 0.7; r += 16) { g.beginPath(); g.arc(S / 2, S / 2, r, 0, TAU); g.stroke(); }
  g.strokeStyle = 'rgba(255,255,255,0.42)'; g.lineWidth = 1.6;
  for (let i = 1; i <= 3; i++) {
    const p = (i / 4) * S;
    g.beginPath(); g.moveTo(p, 0); g.lineTo(p, S); g.stroke();
    g.beginPath(); g.moveTo(0, p); g.lineTo(S, p); g.stroke();
  }
  // Central split-image rangefinder prism circle + horizontal split seam (subtle dark hairline + bright rim for contrast on bright/dark photos)
  g.strokeStyle = 'rgba(12,14,18,0.55)'; g.lineWidth = 3.5; g.beginPath(); g.arc(S / 2, S / 2, 26, 0, TAU); g.stroke();
  g.beginPath(); g.moveTo(S / 2 - 26, S / 2); g.lineTo(S / 2 + 26, S / 2); g.stroke();
  g.strokeStyle = 'rgba(248,250,252,0.82)'; g.lineWidth = 1.8; g.beginPath(); g.arc(S / 2, S / 2, 26, 0, TAU); g.stroke();
  g.beginPath(); g.moveTo(S / 2 - 26, S / 2); g.lineTo(S / 2 + 26, S / 2); g.stroke();
  return tex(cv);
}

function rolleiFilmTex() {
  // Authentic 120 roll-film backing paper with exact 1:1 physical spacing along bottom-front -> Automatik -> gate -> upper-rear web!
  const W = 512, H = 1024, cv = canvas(W, H), g = cv.getContext('2d');
  g.fillStyle = '#ebe6d8'; g.fillRect(0, 0, W, H);
  g.strokeStyle = '#c8c0ac'; g.lineWidth = 4; g.strokeRect(18, 0, W - 36, H);
  g.fillStyle = '#18181b'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillRect(36, 118, W - 72, 10);
  g.font = `600 30px ${ROLLEI_FONT}`; g.fillText('◀  START · GW 400 · 120  ▶', W / 2, 82);
  [['1', 420], ['2', 820]].forEach(([num, y]) => {
    g.font = `700 84px ${ROLLEI_FONT}`; g.fillText(num, W / 2, y);
    g.font = `500 24px ${ROLLEI_FONT}`; g.fillText('GLASS WORKS 6×6 · 120', W / 2, y + 66);
    [y - 98, y - 72, y - 50].forEach((dy, di) => { g.beginPath(); g.arc(W / 2, dy, 10 - di * 2, 0, TAU); g.fill(); });
  });
  const t = tex(cv); t.wrapT = THREE.RepeatWrapping; return t;
}

function diamondCrestTex() {
  // Authentic curved-corner Rollei shield crest on sportsfinder flap (zoom_01_hood_frontR.png: rounded inverted shield w/ GW!)
  const cv = canvas(256, 256), g = cv.getContext('2d');
  g.clearRect(0, 0, 256, 256);
  g.fillStyle = '#121215';
  g.beginPath();
  g.moveTo(58, 62);
  g.quadraticCurveTo(128, 46, 198, 62);
  g.quadraticCurveTo(216, 68, 212, 92);
  g.quadraticCurveTo(194, 164, 140, 210);
  g.quadraticCurveTo(128, 220, 116, 210);
  g.quadraticCurveTo(62, 164, 44, 92);
  g.quadraticCurveTo(40, 68, 58, 62);
  g.closePath();
  g.fill();
  g.strokeStyle = '#e0e2e6'; g.lineWidth = 8; g.stroke();
  g.strokeStyle = 'rgba(224,226,230,0.45)'; g.lineWidth = 3;
  g.beginPath(); g.arc(128, 120, 56, -Math.PI * 0.85, -Math.PI * 0.15); g.stroke();
  g.fillStyle = '#eef0f4'; g.font = `500 44px ${ROLLEI_FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  trackedText(g, 'GW', 128, 116, 4);
  g.font = `400 22px ${ROLLEI_FONT}`;
  g.fillText('2.8F', 128, 158);
  return tex(cv);
}

// ───────── Twin-Lens Optical Prescriptions (Cutaway) ─────────
const PLANAR_5 = [
  [0.09, 0.97, 4.0, 2.0, -4.2], [0.28, 0.84, 3.8, 1.85, -2.6], [0.40, 0.74, 1.7, -2.6, 1.55],
  [0.64, 0.76, 1.7, -1.55, 3.0], [0.74, 0.84, 4.0, 3.0, -2.2],
];
const HEIDOSMAT_4 = [
  [0.11, 0.94, 3.6, 1.9, -3.6], [0.38, 0.72, 1.8, -1.9, 2.1],
  [0.72, 0.80, 1.7, -2.6, -4.4], [0.81, 0.86, 3.8, -4.4, 2.0],
];

// ───────── Curved Crescent Compur Leaf-Shutter Blade Shape (100% Light-Tight 5-Blade Seal!) ─────────
function compurPetalShape() {
  const s = new THREE.Shape();
  s.moveTo(0, -1.6);
  s.quadraticCurveTo(-7.5, -3.2, -16.2, -1.8);
  s.quadraticCurveTo(-18.0, 2.2, -15.6, 8.2);
  s.quadraticCurveTo(-8.5, 9.6, -2.5, 6.2);
  s.quadraticCurveTo(1.2, 3.0, 0, -1.6);
  return s;
}

// ───────── Hollow U-Plan for Open-Door 6×6 Chamber & Bottom-Front 120 Supply Bay (73 mm Cube!) ─────────
function rolleiHollowPlan() {
  const hw = B.hw, yF = -B.zF, yB = -B.zB, r = 3.8, t = 4.5;
  const s = new THREE.Shape();
  s.moveTo(hw - t, yB);
  s.lineTo(hw - r, yB); s.quadraticCurveTo(hw, yB, hw, yB + r);
  s.lineTo(hw, yF - r); s.quadraticCurveTo(hw, yF, hw - r, yF);
  s.lineTo(-hw + r, yF); s.quadraticCurveTo(-hw, yF, -hw, yF - r);
  s.lineTo(-hw, yB + r); s.quadraticCurveTo(-hw, yB, -hw + r, yB);
  s.lineTo(-hw + t, yB);
  s.lineTo(-hw + t, yF - 5.5);
  s.lineTo(hw - t, yF - 5.5);
  s.closePath();
  return s;
}

// ───────── Body, Front Board, Hood & Authentic K7F Controls ─────────
function buildRolleiBody(lib, hov, initialLens) {
  const bk = lib.get('blackEnamel'), bright = lib.get('chromeBright'), leather = lib.get('leather');
  const anod = lib.get('anod'), flock = lib.get('flock'), palpas = lib.get('palpas'), steel = lib.get('steel'), brass = lib.get('brass');
  const intBlk = lib.get('interiorBlack');

  const core = new THREE.Group(), backDoorPivot = new THREE.Group(), board = new THREE.Group();
  const ck = new Kit(), bkK = new Kit(), fk = new Kit();

  // Authentic 77.5 × 73.0 mm hollow-backed German TLR cube (hw=38.75, zF=-67..zB=+6, Y=-42.5..+86.0) wrapped in pebble leatherette
  // Signature Rolleiflex sweeping R=16.5 mm bottom-rear curved profile (k7f_a_03, k7f_a_04, k7f_a_05, Rolleiflex_F2-8-f_right.jpg!)
  const bodySolidPlan = rrPath(-B.hw, -B.zB, B.hw, -B.zF, 3.8);
  const bendRBody = 16.5;
  ck.add(slab(rolleiHollowPlan(), 68.5 - (B.y0 + bendRBody), 0.65, 24, 0.5, 3), leather, T(0, B.y0 + bendRBody, 0, -Math.PI / 2, 0, 0));
  ck.add(slab(bodySolidPlan, B.y1 - 68.5, 0.65, 24, 0.5, 3), leather, T(0, 68.5, 0, -Math.PI / 2, 0, 0));
  // Sweeping R=16.5 mm curved bottom-rear corner flank cheeks (Y = B.y0+1.4 .. B.y0+bendRBody+1.0) clearing the rolled L-door!
  {
    const cheekS = new THREE.Shape();
    // slab rotated ry=+PI/2 maps (sx, sy) -> world (z = -sx, y = sy), extruded +X
    const sxRear = -B.zB, sxFront = -B.zF, yLo = B.y0 + 1.4, yHi = B.y0 + bendRBody + 1.0, rc = bendRBody - 0.8;
    cheekS.moveTo(sxRear, yHi);
    cheekS.lineTo(sxRear, yLo + rc);
    cheekS.absarc(sxRear + rc, yLo + rc, rc, Math.PI, Math.PI * 1.5, false);
    cheekS.lineTo(sxFront - 3.8, yLo);
    cheekS.quadraticCurveTo(sxFront, yLo, sxFront, yLo + 3.8);
    cheekS.lineTo(sxFront, yHi);
    cheekS.closePath();
    [-1, 1].forEach((sx) => {
      const x0 = sx > 0 ? B.hw - 4.5 : -B.hw;
      ck.add(slab(cheekS, 4.5, 0.45, 32, 0.45, 2), leather, T(x0, 0, 0, 0, Math.PI / 2, 0));
    });
    // Lower front wall connecting left & right cheeks cleanly above bottom lip
    ck.add(rbox(B.hw * 2 - 6.0, bendRBody + 0.4, 5.5, 0.5, 2), leather, T(0, B.y0 + 1.4 + (bendRBody + 0.4) / 2, B.zF + 2.75));
  }
  // Razor-thin gleaming mirror-chrome hairline top trim (1.5 mm)
  {
    const trim = rrPath(-B.hw - 0.45, -(B.zB + 0.45), B.hw + 0.45, -(B.zF - 0.45), 4.0);
    trim.holes.push(rrPath(-B.hw + 1.2, -(B.zB - 1.2), B.hw - 1.2, -(B.zF + 1.2), 2.6, new THREE.Path()));
    ck.add(slab(trim, 1.5, 0.3, 24, 0.75, 2), bright, T(0, B.y1 - 1.5, 0, -Math.PI / 2, 0, 0));
  }
  // Vertical chrome corner rails (rear rail meets sweeping R=16.5 mm L-door rail!) + authentic 3-screw Rollei scissor-clip strap rail + wear disc + rear door hinge boss!
  [-1, 1].forEach((sx) => {
    ck.add(rbox(1.5, B.y1 - B.y0 - 2.4, 1.8, 0.45, 2, 0.75), bright, T(sx * (B.hw - 0.3), (B.y0 + B.y1) / 2, B.zF + 0.5));
    const rearRailH = B.y1 - (B.y0 + bendRBody) - 1.2;
    ck.add(rbox(1.5, rearRailH, 1.8, 0.45, 2, 0.75), bright, T(sx * (B.hw - 0.3), B.y0 + bendRBody + rearRailH / 2, B.zB - 0.5));
    // Authentic horizontal chrome strap mounting bar inlaid with black leatherette + 3 slotted screws (zoom_08, zoom_09!)
    const barOut = rrPath(-30.0, -3.2, 26.5, 3.2, 2.6);
    barOut.holes.push(rrPath(-26.5, -1.9, 23.0, 1.9, 1.4, new THREE.Path()));
    ck.add(slab(barOut, 1.6, 0.45, 20, 0.78, 2), bright, T(sx * (B.hw - 0.1), 77.6, DIM.screenZ + 1.5, 0, sx > 0 ? Math.PI / 2 : -Math.PI / 2, 0));
    // Raised twin-slotted chrome scissor-clip lug bridge centered over the bar (zoom_08, zoom_09!)
    const lugBridge = rrPath(-10.5, -3.4, 10.5, 3.4, 2.4);
    ck.add(slab(lugBridge, 3.4, 0.7, 20, 0.8, 3), bright, T(sx * (B.hw + 0.2), 77.6, DIM.screenZ - 1.5, 0, sx > 0 ? Math.PI / 2 : -Math.PI / 2, 0));
    ck.add(rbox(1.6, 1.1, 14.8, 0.35, 2, 0.3), intBlk, T(sx * (B.hw + 3.4), 78.8, DIM.screenZ - 1.5));
    ck.add(rbox(1.6, 1.1, 14.8, 0.35, 2, 0.3), intBlk, T(sx * (B.hw + 3.4), 76.4, DIM.screenZ - 1.5));
    // 3 tiny chrome slotted screws along the inlaid strap rail (front, inner-rear, outer-rear — zoom_08, zoom_09!)
    [-21.5, 13.0, 22.8].forEach((dz) => addScrew(ck, bright, ck, flock, T(sx * (B.hw + 1.55), 77.6, DIM.screenZ + dz, 0, sx * Math.PI / 2, 0), 1.45, false, 0.35));
    // Tiny chrome back-door hinge-pin end boss right under top-rear corner (zoom_08, zoom_09!)
    ck.add(revolve([[2.5, 0], [2.5, 1.8, 0.3], [1.6, 2.1]], { segs: 28 }), bright, T(sx * (B.hw - 0.1), 75.4, B.zB - 3.6, 0, sx * Math.PI / 2, 0));
    // Gleaming polished-chrome semicircular wear-guard disc directly below center of scissor lug
    ck.add(new THREE.CircleGeometry(10.6, 48, Math.PI, Math.PI), bright, T(sx * (B.hw + 0.28), 74.6, DIM.screenZ - 1.5, 0, sx * Math.PI / 2, 0));
  });

  // ───────── LEFT FLANK (-X): EXACT K7F LAYOUT, 48-FLUTE KNURLING & COMPACT GOSSEN POD (zoom_05, zoom_06, zoom_07!) ─────────
  // 1. Pull-out 120 spool knobs: stepped chrome base + twin dark neck grooves + 36-flute chrome barrel (rib=1 BOTH ends!) + recessed black leatherette cap!
  const spoolKnobs = new THREE.Group();
  {
    const sk = new Kit();
    [[DIM.spoolHigh.y, DIM.spoolHigh.z], [DIM.spoolLow.y, DIM.spoolLow.z]].forEach(([sy, sz]) => {
      // Mounting flange w/ tiny screw + twin dark recessed neck grooves (zoom_07!)
      sk.add(revolve([[8.2, 0], [8.2, 1.0, 0.3], [7.2, 1.3], [6.0, 1.3], [6.0, 4.4]], { segs: 48 }), bright, T(-B.hw, sy, sz, 0, -Math.PI / 2, 0));
      sk.add(revolve([[5.85, 1.9], [5.85, 2.5], [5.85, 3.2], [5.85, 3.8]], { segs: 40 }), intBlk, T(-B.hw, sy, sz, 0, -Math.PI / 2, 0));
      // Crisp 36-flute parallel machined chrome barrel (rib=1 on BOTH start & end vertices -> zero taper!)
      sk.add(revolve([[6.0, 4.3], [6.5, 4.6, 0.3, 1], [6.5, 8.2, 0.3, 1], [5.9, 8.6], [5.3, 8.6], [5.3, 8.1]], { segs: 288, ribs: { n: 36, depth: 0.38, groove: 0.48, edge: 0.14 } }), bright, T(-B.hw, sy, sz, 0, -Math.PI / 2, 0));
      sk.add(new THREE.CircleGeometry(5.25, 32), leather, T(-B.hw - 8.25, sy, sz, 0, -Math.PI / 2, 0));
    });
    sk.build(spoolKnobs);
  }
  core.add(spoolKnobs);

  // 2. LARGE FLUSH LOWER-REAR ASA/DIN & FILTER-FACTOR DIAL (Y=-15.5, Z=-20.0, r=14.4 — zoom_03, zoom_07!)
  const asaDialGroup = new THREE.Group(); asaDialGroup.position.set(DIM.asaDial.x, DIM.asaDial.y, DIM.asaDial.z);
  const filterRing = new THREE.Group();
  const asaCv = canvas(512, 512), asaTex = tex(asaCv);
  drawAsaDial(asaCv, 400, 0);
  {
    const fk2 = new Kit();
    // Flush outer black fluted filter-factor ring with crisp parallel 48-flute chrome teeth (rib=1 BOTH ends, segs=384!)
    fk2.add(revolve([[14.1, 0], [14.5, 0.4, 0.3, 1], [14.5, 3.6, 0.3, 1], [13.7, 4.0]], { segs: 384, uv: 'band', ribs: { n: 48, depth: 0.45, groove: 0.50, edge: 0.125 } }), lib.prepare(new THREE.MeshPhysicalMaterial({ map: filterFluteRimTex(), roughness: 0.24, metalness: 0.32 }), {}), T(0, 0, 0, 0, -Math.PI / 2, 0));
    fk2.build(filterRing);
    asaDialGroup.add(filterRing);
    const dk = new Kit();
    // Recessed glossy ASA/DIN face + sleek low-profile 28-flute chrome center setting hub (zoom_07!)
    dk.add(new THREE.CircleGeometry(13.5, 56), lib.prepare(new THREE.MeshPhysicalMaterial({ map: asaTex, roughness: 0.24, metalness: 0.24 }), {}), T(-4.05, 0, 0, 0, -Math.PI / 2, 0));
    dk.add(revolve([[4.6, 4.0], [5.0, 4.3, 0.3, 1], [5.0, 5.7, 0.3, 1], [4.4, 6.0]], { segs: 224, ribs: { n: 28, depth: 0.36, groove: 0.48, edge: 0.14 } }), bright, T(0, 0, 0, 0, -Math.PI / 2, 0));
    dk.add(new THREE.CircleGeometry(3.2, 28), bk, T(-6.05, 0, 0, 0, -Math.PI / 2, 0));
    dk.build(asaDialGroup);
  }
  core.add(asaDialGroup);

  // 3. FOCUSING KNOB ASSEMBLY (Y=+17.5, Z=-40.5 — zoom_05, zoom_06, zoom_07!):
  //    - Stationary inner base collar with CONTINUOUS CURVED WHITE EXPANDING DoF BAND (Manual p.16–17)
  //    - ROTATING glossy-black conical distance drum + RAZOR-CRISP 48-FLUTE PARALLEL CHROME GRIP RING + thick rounded black outer bezel (`knob`)
  //    - STATIONARY compact sleek D-shaped Gossen meter pod (`meterPod`): sculpted black lower wedge w/ star-knurled screw + hairline-rimmed clear acrylic upper dome + delicate dark needle & open-circle follow pointer!
  const knobBase = new THREE.Group(); knobBase.position.set(DIM.knob.x, DIM.knob.y, DIM.knob.z);
  const dofBandCv = canvas(1024, 64), dofBandTex = tex(dofBandCv);
  dofBandTex.wrapS = THREE.RepeatWrapping;
  drawDofBand(dofBandCv, 0.14, 0.14);
  {
    const kbk = new Kit();
    kbk.add(revolve([[22.0, 0], [22.0, 0.8, 0.3], [21.0, 1.1]], { segs: 72 }), bk, T(0, 0, 0, 0, -Math.PI / 2, 0));
    kbk.add(revolve([[20.9, 1.0], [20.5, 3.2]], { segs: 84, uv: 'band' }), lib.prepare(new THREE.MeshPhysicalMaterial({ map: dofBandTex, roughness: 0.22, metalness: 0.08 }), {}), T(0, 0, 0, 0, -Math.PI / 2, 0));
    kbk.build(knobBase);
  }
  const dofLeft = new THREE.Group(), dofRight = new THREE.Group();
  knobBase.add(dofLeft, dofRight);
  core.add(knobBase);

  // ROTATING focusing drum + TRUE 48-FLUTE PARALLEL FLAT-CRESTED CHROME GRIP RING (segs=384, rib=1 on BOTH ends -> zero taper, zero moiré!)
  const knob = new THREE.Group(); knob.position.set(DIM.knob.x, DIM.knob.y, DIM.knob.z);
  const kk = new Kit(), kMat = lib.get('blackEnamel', { hover: hov.focus });
  const fDrumMat = lib.prepare(new THREE.MeshPhysicalMaterial({ map: focusDrumTex(initialLens), roughness: 0.16, metalness: 0.22, clearcoat: 0.82 }), { hover: hov.focus });
  kk.add(revolve([[20.45, 3.1], [19.65, 11.7, 0.3]], { segs: 96, uv: 'band' }), fDrumMat, T(0, 0, 0, 0, -Math.PI / 2, 0));
  // Authentic proud 4.6 mm wide 48-flute parallel machined chrome grip ring (zoom_06, zoom_07!)
  kk.add(revolve([
    [19.7, 11.6], [21.05, 12.05, 0.32, 1], [21.05, 16.45, 0.32, 1], [19.75, 16.9],
  ], { segs: 384, ribs: { n: 48, depth: 0.96, groove: 0.50, edge: 0.125 } }), lib.get('chromeBright', { hover: hov.focus }), T(0, 0, 0, 0, -Math.PI / 2, 0));
  // Thick rounded-bevel glossy-black outer collar + recessed matte dish framing the compact Gossen meter pod (zoom_06, zoom_07!)
  kk.add(revolve([
    [19.75, 16.85], [19.75, 18.5, 0.35], [18.9, 19.55, 0.45], [17.4, 19.8], [15.4, 19.4], [14.2, 19.4],
  ], { segs: 72 }), kMat, T(0, 0, 0, 0, -Math.PI / 2, 0));
  const focusMeshes = kk.build(knob, 'focus');
  core.add(knob);

  // STATIONARY COMPACT SLEEK GOSSEN METER POD (zoom_05, zoom_06, zoom_07!):
  // Low-profile rounded-wedge glossy-black lower housing w/ star-knurled bright-chrome screw + crystal-clear hairline-trimmed acrylic upper D-dome!
  const meterPod = new THREE.Group(); meterPod.position.set(DIM.knob.x, DIM.knob.y, DIM.knob.z);
  {
    const mk = new Kit();
    // Recessed concentric black inner seat ring flush inside rotating outer collar
    mk.add(revolve([[15.2, 18.8], [15.2, 19.6, 0.25], [13.4, 19.7]], { segs: 56 }), bk, T(0, 0, 0, 0, -Math.PI / 2, 0));
    // Compact tapered rounded-wedge glossy-black lower cap covering lower half (-Y) tightly up to y=+0.8 (no white gap!)
    const shieldS = new THREE.Shape();
    shieldS.moveTo(-11.4, 0.9); shieldS.lineTo(11.4, 0.9);
    shieldS.bezierCurveTo(11.6, -5.6, 8.0, -10.2, 0, -11.0);
    shieldS.bezierCurveTo(-8.0, -10.2, -11.6, -5.6, -11.4, 0.9);
    mk.add(slab(shieldS, 3.6, 1.5, 24, 0.55, 4), bk, T(-23.2, -0.3, 0, 0, Math.PI / 2, 0));
    // Prominent bright-chrome 16-tooth star-knurled center film-reminder knob + subtle dark "pan" semicircular slot beside it (zoom_07!)
    mk.add(revolve([[2.2, 0], [2.55, 0.25, 0.35, 1], [2.55, 1.35, 0.35, 1], [1.85, 1.65]], { segs: 128, ribs: { n: 16, depth: 0.40, groove: 0.48, edge: 0.14 } }), bright, T(-24.4, -4.2, 0, 0, -Math.PI / 2, 0));
    mk.add(new THREE.PlaneGeometry(4.4, 2.0), lib.prepare(new THREE.MeshPhysicalMaterial({ map: filmReminderTex(), roughness: 0.35, metalness: 0.12 }), {}), T(-24.75, -7.6, 0, 0, -Math.PI / 2, 0));
    [-5.6, 5.6].forEach((sz) => addScrew(mk, steel, mk, flock, T(-24.25, -4.2, sz, 0, -Math.PI / 2, 0), 0.85, false, 0.3));
    // Upper half (+Y): crisp white curved meter dial cavity + low-profile crystal-clear acrylic D-dome wrapped by a RAZOR-THIN chrome wire rim!
    const whiteMat = lib.prepare(new THREE.MeshPhysicalMaterial({ color: 0xf2f1ec, roughness: 0.34, metalness: 0.04, side: THREE.DoubleSide }), {});
    mk.add(new THREE.CircleGeometry(10.4, 36, 0, Math.PI), whiteMat, T(-19.8, 0.8, 0, 0, -Math.PI / 2, 0));
    mk.add(rbox(4.2, 0.5, 20.6, 0.15, 1), whiteMat, T(-21.8, 0.9, 0));
    const dialGeo = prep(new THREE.CylinderGeometry(10.3, 10.3, 4.0, 36, 1, true, -Math.PI * 0.44, Math.PI * 0.88));
    dialGeo.rotateZ(Math.PI / 2);
    mk.add(dialGeo, lib.prepare(new THREE.MeshPhysicalMaterial({ map: gossenDialTex(), roughness: 0.28, metalness: 0.04, side: THREE.DoubleSide }), {}), T(-21.7, 0.8, 0));
    // Crystal-clear low-profile acrylic D-dome + thin bright-chrome outer perimeter hairline rim (zoom_06, zoom_07!)
    const acrylicMat = lib.prepare(new THREE.MeshPhysicalMaterial({ color: 0xf4f8fb, roughness: 0.03, metalness: 0.04, clearcoat: 1.0, transparent: true, opacity: 0.24, depthWrite: false, side: THREE.DoubleSide }), {});
    const rimGeo = prep(new THREE.CylinderGeometry(11.35, 11.35, 4.6, 40, 1, true, -Math.PI * 0.48, Math.PI * 0.96));
    rimGeo.rotateZ(Math.PI / 2);
    mk.add(rimGeo, acrylicMat, T(-22.0, 0.8, 0));
    mk.add(new THREE.CircleGeometry(11.35, 40, 0, Math.PI), acrylicMat, T(-24.3, 0.8, 0, 0, -Math.PI / 2, 0));
    mk.add(new THREE.TorusGeometry(11.4, 0.30, 12, 40, Math.PI), bright, T(-24.25, 0.8, 0, 0, -Math.PI / 2, 0));
    mk.add(rbox(4.8, 0.65, 22.8, 0.2, 2, 0.65), bk, T(-22.0, 0.65, 0));
    mk.build(meterPod);
  }
  // Exact Manual p.5 & zoom_06 pointers: slender dark-blue galvanometer needle + delicate dark-steel open-circle follow pointer!
  const meterNeedle = new THREE.Group(); meterNeedle.position.set(-21.6, 0.8, 0);
  {
    const mn = new Kit();
    mn.add(rbox(3.0, 9.9, 0.28, 0.06, 1), lib.get('blackEnamel'), T(0, 4.95, 0));
    mn.build(meterNeedle);
  }
  const followPointer = new THREE.Group(); followPointer.position.set(-21.6, 0.8, 0);
  {
    const fp = new Kit();
    const ptrMat = lib.prepare(new THREE.MeshPhysicalMaterial({ color: 0x262e3c, roughness: 0.28, metalness: 0.72 }), {});
    fp.add(rbox(0.38, 7.9, 0.30, 0.06, 1), ptrMat, T(-1.45, 3.95, 0));
    fp.add(revolve([[1.3, -0.2], [1.3, 0.2], [0.82, 0.2], [0.82, -0.2]], { segs: 32 }), ptrMat, T(-1.45, 8.95, 0, Math.PI / 2, 0, 0));
    fp.build(followPointer);
  }
  meterPod.add(meterNeedle, followPointer);
  core.add(meterPod);

  // ───────── RIGHT FLANK (+X): 3-RING BULLSEYE, CENTER-HINGED FORKED Y-CLEVIS CRANK, COUNTERSUNK COUNTER & PARKING GUSSET (zoom_08, zoom_09!) ─────────
  ck.add(revolve([[DIM.crank.r + 0.6, 0], [DIM.crank.r + 0.6, 1.5, 0.4], [DIM.crank.r - 0.3, 2.0]], { segs: 96 }), bk, T(B.hw, DIM.crank.y, DIM.crank.z, 0, Math.PI / 2, 0));
  ck.add(new THREE.CircleGeometry(DIM.crank.r - 0.4, 72), lib.prepare(new THREE.MeshPhysicalMaterial({ map: bullseyeTex(), roughness: 0.16, metalness: 0.68 }), {}), T(B.hw + 2.05, DIM.crank.y, DIM.crank.z, 0, Math.PI / 2, 0));
  // Deeply countersunk bright-chrome frame-counter eyelet tucked closely above-front of bullseye (Y=37.5, Z=-50.5 — zoom_08, zoom_09!)
  const ctrCv = canvas(128, 128), ctrTex = tex(ctrCv);
  ck.add(revolve([[4.7, 0], [4.7, 1.1, 0.35], [4.1, 1.8, 0.35], [2.9, 1.8], [2.6, 0.6]], { segs: 44 }), bright, T(B.hw, DIM.counter.y, DIM.counter.z, 0, Math.PI / 2, 0));
  ck.add(new THREE.CircleGeometry(2.65, 32), lib.prepare(new THREE.MeshBasicMaterial({ map: ctrTex }), {}), T(B.hw + 0.72, DIM.counter.y, DIM.counter.z, 0, Math.PI / 2, 0));
  ck.add(new THREE.CircleGeometry(2.75, 32), lib.get('windowGlass'), T(B.hw + 1.55, DIM.counter.y, DIM.counter.z, 0, Math.PI / 2, 0));
  // Flush matte-black upper-rear spool-axle button cap (Y=45.5, Z=-10.5 — NO shiny steel halo! zoom_08, zoom_09!)
  ck.add(revolve([[5.3, 0], [5.3, 1.8, 0.3], [4.8, 2.1]], { segs: 44 }), anod, T(B.hw, DIM.spoolHigh.y, DIM.spoolHigh.z, 0, Math.PI / 2, 0));
  // Compact authentic brushed-chrome bottom-rear crank parking catch (~11 mm bezel hugging R=16.5 mm trim — cmp_03 left!)
  {
    const gusS = new THREE.Shape();
    // slab rotated ry=+PI/2 maps (sx, sy) -> world (z = -sx, y = sy); parking slot sits at (sx=+15.2, sy=-29.8)
    gusS.moveTo(8.5, -26.0);
    gusS.bezierCurveTo(13.5, -24.8, 19.2, -26.2, 20.0, -30.2);
    gusS.bezierCurveTo(20.4, -33.6, 17.5, -37.2, 13.5, -39.4);
    gusS.lineTo(10.0, -40.8);
    gusS.absarc(10.0, -26.0, 14.8, Math.PI * 1.5, Math.PI * 1.32, true);
    gusS.closePath();
    ck.add(slab(gusS, 0.72, 0.2, 24, 0.75, 2), bright, T(B.hw - 0.52, 0, 0, 0, Math.PI / 2, 0));
    // Recessed dark parking cradle seated directly behind the folded crank tip (-29.8, -15.2)
    ck.add(revolve([[3.6, 0], [3.6, 0.9, 0.2], [2.8, 0.9]], { segs: 36 }), intBlk, T(B.hw - 0.15, -29.8, -15.2, 0, Math.PI / 2, 0));
  }

  // AUTHENTIC ROLLEIFLEX 2.8F CENTER-HINGED FORKED Y-CLEVIS FOLDING CRANK (seated tight against flank so tip nests visibly into pocket!)
  const crank = new THREE.Group(); crank.position.set(DIM.crank.x + 1.95, DIM.crank.y, DIM.crank.z);
  const crk = new Kit(), cMat = lib.get('chromeBright', { hover: hov.crank });
  crk.add(revolve([[10.8, 0], [10.8, 1.8, 0.35], [9.9, 2.2]], { segs: 64 }), cMat, T(0, 0, 0, 0, Math.PI / 2, 0));
  addScrew(crk, cMat, crk, flock, T(2.22, 5.2, -1.8, 0, Math.PI / 2, 0), 1.25, false, 0.35);
  crk.add(revolve([[1.35, 2.0], [1.35, 3.2, 0.3], [1.0, 3.4]], { segs: 28 }), cMat, T(0, 7.6, -2.2, 0, Math.PI / 2, 0));
  // Hinge tilt 24.0° aims local -Y (len 42.0) dead-center into parking slot (Y=8.8-38.4=-29.6, Z=-32.4+17.1=-15.3)
  const hingeTilt = 24.0 * DEG;
  const crankArmPivot = new THREE.Group();
  crankArmPivot.position.set(2.05, 0.8, -0.4);
  crankArmPivot.rotation.x = -hingeTilt;
  crk.add(revolve([[1.75, -5.6], [1.75, 5.6, 0.35]], { segs: 32 }), cMat, T(2.05, 0.8, -0.4, -hingeTilt, 0, 0));
  [-5.4, 5.4].forEach((dz) => {
    const sy = Math.sin(hingeTilt) * dz, sz = Math.cos(hingeTilt) * dz;
    crk.add(revolve([[1.45, 1.8], [1.45, 2.9, 0.25], [0, 2.9]], { segs: 24 }), cMat, T(0, 0.8 + sy, -0.4 + sz, 0, Math.PI / 2, 0));
  });
  const crankMeshes = crk.build(crank, 'crank');

  // Forked Y-Clevis Crank Arm w/ compact triangular throat, graceful S-bowed cast spine, riveted tip & inward parking stud seating into pocket!
  {
    const ak = new Kit();
    ak.add(revolve([[2.05, -4.3], [2.05, 4.3, 0.35]], { segs: 36 }), cMat, T(0.3, 0, 0));
    const armS = new THREE.Shape();
    armS.moveTo(-5.4, -0.5);
    armS.bezierCurveTo(-5.2, -5.0, -3.2, -9.8, -2.2, -17.5);
    armS.bezierCurveTo(-1.4, -24.5, -2.0, -32.2, -3.4, -37.8);
    armS.bezierCurveTo(-4.0, -40.8, -2.0, -43.0, 0.2, -43.0);
    armS.bezierCurveTo(2.7, -43.0, 4.1, -40.5, 3.5, -37.4);
    armS.bezierCurveTo(2.6, -31.8, 4.0, -23.0, 4.7, -14.8);
    armS.bezierCurveTo(5.2, -8.2, 5.6, -4.4, 5.4, -0.5);
    armS.closePath();
    const throat = new THREE.Path();
    throat.moveTo(-2.4, -2.2);
    throat.lineTo(2.4, -2.2);
    throat.quadraticCurveTo(0.8, -6.2, 0.0, -6.8);
    throat.quadraticCurveTo(-0.8, -6.2, -2.4, -2.2);
    armS.holes.push(throat);
    ak.add(slab(armS, 2.0, 0.65, 28, 0.85, 4), cMat, T(-0.5, 0, 0, 0, Math.PI / 2, 0));
    // Sculpted subtle central spine ridge running along outer face
    const ridgeS = new THREE.Shape();
    ridgeS.moveTo(-1.1, -8.0);
    ridgeS.quadraticCurveTo(0, -7.2, 1.1, -8.0);
    ridgeS.lineTo(0.85, -36.5);
    ridgeS.quadraticCurveTo(0, -37.6, -0.85, -36.5);
    ridgeS.closePath();
    ak.add(slab(ridgeS, 0.72, 0.36, 20, 0.9, 3), cMat, T(1.55, 0, 0, 0, Math.PI / 2, 0));
    // Flush circular riveted chrome swivel pin + inward parking stud seating directly into the dark body pocket!
    ak.add(revolve([[1.75, 0], [1.75, 0.6, 0.25], [1.05, 0.6]], { segs: 28 }), cMat, T(2.1, -39.5, 0, 0, Math.PI / 2, 0));
    ak.add(new THREE.CircleGeometry(0.9, 20), anod, T(2.72, -39.5, 0, 0, Math.PI / 2, 0));
    ak.add(revolve([[2.3, 0], [2.3, 2.8, 0.25]], { segs: 28 }), cMat, T(-3.2, -39.5, 0, 0, Math.PI / 2, 0));
    crankMeshes.push(...ak.build(crankArmPivot, 'crank'));
  }
  // Recessed folding fingertip handle tucked neatly along inner underside (+Y) of arm into parking pocket when closed; swings OUTWARD (+X via rotZ = -PI/2) when crankOpen=1!
  const crankHandle = new THREE.Group(); crankHandle.position.set(-1.0, -39.5, 0);
  {
    const hk = new Kit();
    hk.add(revolve([
      [1.65, 0], [2.15, 1.5, 0.25], [2.55, 4.2, 0.35], [2.55, 7.2, 0.45],
      [2.05, 8.9, 0.45], [1.1, 9.6, 0.35], [0, 9.8],
    ], { segs: 40, crease: 45 }), cMat, T(0, 0, 0, -Math.PI / 2, 0, 0));
    crankMeshes.push(...hk.build(crankHandle, 'crank'));
  }
  crankArmPivot.add(crankHandle);
  crank.add(crankArmPivot);
  core.add(crank);

  // ───────── OPEN-DOOR 6×6 INTERIOR (zoom_10, zoom_11): DEAD-FLAT MATTE-BLACK CHAMBER, CHROME LEAF SPRING, AUTOMATIK ROLLERS, BAFFLES & 5-PETAL COMPUR! ─────────
  // Full dead-flat matte-black inner cavity liner walls (strictly inside hollow body envelope Y=-39..+66 -> ZERO bottom poke-through!)
  ck.add(rbox(68.0, 2.8, 56.0, 0.3, 1), intBlk, T(0, 29.8, -35.0));
  [-33.8, 33.8].forEach((ix) => {
    ck.add(rbox(1.4, 91.0, 56.0, 0.2, 1), intBlk, T(ix, 19.5, -34.0));
    ck.add(rbox(1.4, 15.0, 36.0, 0.2, 1), intBlk, T(ix, -32.0, -42.5));
  });
  ck.add(rbox(67.0, 102.0, 1.8, 0.2, 1), intBlk, T(0, 13.0, B.zF + 5.6));
  ck.add(rbox(67.0, 1.8, 52.0, 0.2, 1), intBlk, T(0, 67.5, -34.0));
  ck.add(rbox(48.0, 1.2, 48.0, 0.2, 1), intBlk, T(0, 52.0, -40.0, -Math.PI / 4, 0, 0));
  ck.add(new THREE.PlaneGeometry(46.0, 46.0), lib.get('mirror'), T(0, 52.7, -40.7, -Math.PI * 0.75, 0, 0));
  // Machined 56×56 mm matte-black gate + gleaming polished-chrome vertical film guide rails (zoom_10, zoom_11!)
  const gateFrame = rrPath(-34.0, -29.8, 34.0, 30.8, 1.0); gateFrame.holes.push(rrPath(-28.0, -28.0, 28.0, 28.0, 0.6, new THREE.Path()));
  ck.add(slab(gateFrame, 3.0, 0.2), intBlk, T(0, 0, -4.6));
  [-29.8, 29.8].forEach((rx) => ck.add(rbox(2.4, 61.5, 1.4, 0.2, 1, 0.75), bright, T(rx, 0, -1.0)));
  // 4 Tapered dead-flat matte-black anti-reflection pyramid baffles clearing bottom-front supply spool cleanly (zoom_11!)
  [[27.2, 30.5, -11.0], [24.2, 27.5, -22.5], [21.0, 24.5, -34.0], [17.8, 21.5, -45.5]].forEach(([hs, out, bz]) => {
    const baf = rrPath(-out - 2.0, -out + 2.0, out + 2.0, out, 0.8); baf.holes.push(rrPath(-hs, -hs, hs, hs, 1.2, new THREE.Path()));
    ck.add(slab(baf, 2.4, 0.25), intBlk, T(0, 0, bz));
  });
  // Rear Planar matte-black shroud + gleaming rear meniscus + 5 overlapping curved crescent Compur blades (closed 100% light-tight at rest!)
  ck.add(revolve([[16.6, -59.0], [16.6, -45.5, 0.3], [14.8, -45.5], [14.8, -59.0]], { segs: 56 }), intBlk, T(0, 0, 0));
  ck.add(revolve([[13.8, -51.0], [13.8, -49.8], [12.4, -49.8]], { segs: 48 }), steel, T(0, 0, 0));
  ck.add(revolve([[0, -46.8], [7.0, -47.6], [12.2, -49.5]], { segs: 40 }), lib.get('innerGlass'), T(0, 0, 0));
  const petalGeo = prep(slab(compurPetalShape(), 0.24, 0.04, 10, 0.35));
  const rearBlades = [];
  for (let i = 0; i < 5; i++) {
    const piv = new THREE.Group();
    const a = (i / 5) * TAU;
    piv.position.set(Math.cos(a) * 14.2, Math.sin(a) * 14.2, -52.2 + i * 0.28);
    piv.rotation.z = a;
    piv.add(new THREE.Mesh(petalGeo, lib.get('blade')));
    core.add(piv);
    rearBlades.push(piv);
  }
  // Empty-bay coaxial 120 spool spindles & drive keys at TRUE positions: UPPER-REAR (45.5, -10.5) & BOTTOM-FRONT (-30.5, -51.5)!
  [[DIM.spoolHigh.y, DIM.spoolHigh.z], [DIM.spoolLow.y, DIM.spoolLow.z]].forEach(([sy, sz]) => {
    ck.add(revolve([[3.4, 0], [3.4, 3.2, 0.25]], { segs: 32 }), bright, T(33.2, sy, sz, 0, -Math.PI / 2, 0));
    ck.add(rbox(1.4, 6.2, 1.4, 0.2, 1), bright, T(29.8, sy, sz));
    ck.add(revolve([[2.2, 0], [2.2, 4.0, 0.25]], { segs: 28 }), bright, T(-33.2, sy, sz, 0, Math.PI / 2, 0));
  });
  // Iconic polished curved bowed chrome supply-spool tension leaf spring at bottom-front wall (clearly visible in zoom_10!)
  {
    const spArc = new THREE.Shape();
    spArc.moveTo(-1.0, -6.5);
    spArc.quadraticCurveTo(2.4, 0, -0.4, 6.5);
    spArc.lineTo(-1.3, 6.5);
    spArc.quadraticCurveTo(1.4, 0, -1.9, -6.5);
    spArc.closePath();
    ck.add(slab(spArc, 28.0, 0.25, 20, 0.78, 2), bright, T(-14.0, -31.5, -60.4, 0, Math.PI / 2, 0));
  }
  // Upper chrome guide roller + TWIN PARALLEL CHROME AUTOMATIK FEELER ROLLERS at bottom-rear corner (zoom_10, zoom_11!)
  ck.add(revolve([[2.1, -31.5], [2.1, 31.5, 0.3]], { segs: 32 }), bright, T(0, 31.8, -2.2, 0, Math.PI / 2, 0));
  ck.add(revolve([[2.3, -31.5], [2.3, 31.5, 0.3]], { segs: 36 }), bright, T(0, -34.2, -6.4, 0, Math.PI / 2, 0));
  ck.add(revolve([[2.2, -31.5], [2.2, 31.5, 0.3]], { segs: 36 }), bright, T(0, -31.6, -0.7, 0, Math.PI / 2, 0));
  // Tucked matte-black Automatik feeler sensing bracket (strictly inside R=16.5 mm curved cheek -> zero rear poke-through!)
  ck.add(rbox(1.8, 7.8, 3.8, 0.25, 1), intBlk, T(32.2, -31.5, -5.4));

  // Rotating Lower-Front 120 Supply Spool (0, -30.5, -51.5) & Upper-Rear Take-Up Spool (0, +45.5, -10.5) + Smooth Spline 120 Film Web!
  const make120Spool = (y, z, paperR) => {
    const sp = new THREE.Group(); sp.position.set(0, y, z);
    const sk = new Kit();
    sk.add(revolve([[paperR, -28.0], [paperR, 28.0]], { segs: 44, uv: 'band' }), lib.prepare(new THREE.MeshPhysicalMaterial({ color: 0xebe6d8, roughness: 0.65, metalness: 0.04 }), {}), T(0, 0, 0, 0, Math.PI / 2, 0));
    [-29.2, 29.2].forEach((sx) => sk.add(revolve([[10.2, -1.0], [10.2, 1.0, 0.3], [3.6, 1.2]], { segs: 44 }), bk, T(sx, 0, 0, 0, Math.PI / 2, 0)));
    sk.build(sp);
    core.add(sp);
    return sp;
  };
  const supplySpool = make120Spool(DIM.spoolLow.y, DIM.spoolLow.z, 8.0);
  const takeupSpool = make120Spool(DIM.spoolHigh.y, DIM.spoolHigh.z, 8.0);
  const filmTex = rolleiFilmTex();
  const filmWebMat = lib.prepare(new THREE.MeshPhysicalMaterial({ map: filmTex, roughness: 0.58, metalness: 0.04, side: THREE.DoubleSide }), {});
  const filmWeb = new THREE.Group();
  {
    const spline = new THREE.SplineCurve([
      new THREE.Vector2(-51.5, -38.7), new THREE.Vector2(-35.0, -38.5), new THREE.Vector2(-18.0, -37.8),
      new THREE.Vector2(-8.0, -36.5), new THREE.Vector2(-3.5, -32.9),
      new THREE.Vector2(-0.6, -29.5), new THREE.Vector2(0.5, -24.5), new THREE.Vector2(0.5, 0.0),
      new THREE.Vector2(0.5, 31.8), new THREE.Vector2(-0.4, 37.5), new THREE.Vector2(-3.2, 45.0),
    ]);
    const pts = spline.getSpacedPoints(64);
    let totalL = 0; const cumL = [0];
    for (let i = 1; i < pts.length; i++) { totalL += pts[i].distanceTo(pts[i - 1]); cumL.push(totalL); }
    const hw = 29.8, pos = [], uv = [], idx = [];
    pts.forEach((p, i) => {
      const v = cumL[i] / totalL;
      pos.push(-hw, p.y, p.x, hw, p.y, p.x);
      uv.push(0, v, 1, v);
      if (i > 0) { const a = (i - 1) * 2, b = a + 1, c = i * 2, d = c + 1; idx.push(a, b, c, b, d, c); }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals();
    filmWeb.add(new THREE.Mesh(prep(g), filmWebMat));
  }
  core.add(filmWeb);

  // ───────── ICONIC STRAIGHT-SIDED GENTLY-CROWNED ART-DECO BROW & 3D LENTICULAR SELENIUM CELL (zoom_01, zoom_05, Rolleiflex_F2-8-f_right.jpg!) ─────────
  const makeBrowShape = (hw, hh) => {
    const s = new THREE.Shape();
    const rT = 2.6, rB = 2.8;
    // Straight vertical outer edges, crisp rounded top corners, gentle +0.85 mm upward crown arch, gentle arched lower waist!
    s.moveTo(-hw + rT, hh - 0.6);
    s.quadraticCurveTo(0, hh + 0.85, hw - rT, hh - 0.6);
    s.quadraticCurveTo(hw, hh - 0.7, hw, hh - rT - 0.4);
    s.lineTo(hw, -hh + rB + 0.4);
    s.quadraticCurveTo(hw, -hh + 0.4, hw - rB, -hh + 0.1);
    s.quadraticCurveTo(0, -hh + 1.35, -hw + rB, -hh + 0.1);
    s.quadraticCurveTo(-hw, -hh + 0.4, -hw, -hh + rB + 0.4);
    s.lineTo(-hw, hh - rT - 0.4);
    s.quadraticCurveTo(-hw, hh - 0.7, -hw + rT, hh - 0.6);
    return s;
  };
  const browShape = makeBrowShape(33.8, 7.5);
  ck.add(slab(browShape, 10.6, 0.85, 28, 0.55, 3), bk, T(0, 77.6, B.zF - 9.8));
  // 4 authentic 3D glossy-black sculpted vertical flank ribs molded on left & right cheeks of the brow block (zoom_01, Rolleiflex_F2-8-f_right.jpg!)
  [-1, 1].forEach((side) => {
    for (let i = 0; i < 4; i++) {
      const rx = side * (32.0 - i * 1.1);
      const ryH = 12.6 - i * 0.15;
      ck.add(rbox(0.55, ryH, 0.95, 0.22, 2, 0.45), bk, T(rx, 77.5, B.zF - 10.55));
    }
  });
  {
    const bfShape = makeBrowShape(32.8, 7.0);
    const bfGeo = new THREE.ShapeGeometry(bfShape, 28);
    const bp = bfGeo.attributes.position, buv = bfGeo.attributes.uv;
    for (let i = 0; i < bp.count; i++) {
      buv.setXY(i, (bp.getX(i) + 32.8) / 65.6, (bp.getY(i) + 7.2) / 14.8);
    }
    bfGeo.rotateY(Math.PI);
    ck.add(bfGeo, lib.prepare(new THREE.MeshPhysicalMaterial({ map: browFrontTex(), roughness: 0.24, metalness: 0.45, clearcoat: 0.45 }), {}), T(0, 77.6, B.zF - 10.68));
  }
  // Flush curved clear crystal glass lens glazing over the faceted silver-crystal selenium honeycomb prism + 2 flush chrome corner rivets (cmp_09 left!)
  {
    const glassStripS = new THREE.Shape();
    glassStripS.moveTo(-20.4, -1.65);
    glassStripS.quadraticCurveTo(0, -0.55, 20.4, -1.65);
    glassStripS.lineTo(20.4, 1.45);
    glassStripS.quadraticCurveTo(0, 2.55, -20.4, 1.45);
    glassStripS.closePath();
    const glazeMat = lib.prepare(new THREE.MeshPhysicalMaterial({ color: 0xe6eef6, roughness: 0.04, metalness: 0.08, clearcoat: 1.0, transparent: true, opacity: 0.26, depthWrite: false }), {});
    ck.add(new THREE.ShapeGeometry(glassStripS, 24), glazeMat, T(0, 73.85, B.zF - 10.74, 0, Math.PI, 0));
    [-23.6, 23.6].forEach((rx) => {
      ck.add(revolve([[1.35, 0], [1.35, 0.45, 0.2], [0.85, 0.50], [0.6, 0.2]], { segs: 24 }), bright, T(rx, 72.85, B.zF - 10.68, Math.PI, 0, 0));
      ck.add(new THREE.CircleGeometry(0.6, 16), intBlk, T(rx, 72.85, B.zF - 11.02, 0, Math.PI, 0));
    });
  }
  // Delicate thin top-edge engraving ("GW   2,8 F  2438205   6×6") reading upright from the FRONT (deep matte black, low specular glare!)
  ck.add(new THREE.PlaneGeometry(60.0, 5.2), lib.prepare(new THREE.MeshPhysicalMaterial({ map: browTopTex(), roughness: 0.62, metalness: 0.06, specularIntensity: 0.14 }), {}), T(0, 85.45, B.zF - 4.6, -Math.PI / 2, 0, Math.PI));
  ck.build(core);

  // ───────── SEAMLESS SWEEPING R=16.5 mm CURVED L-BEND BACK + BOTTOM DOOR hinged at TOP-REAR (0, +84.5, +6.0) — zoom_02, zoom_03, zoom_10! ─────────
  const hingeY = B.y1 - 1.5, hingeZ = B.zB, depthTot = B.zB - B.zF;
  backDoorPivot.position.set(0, hingeY, hingeZ);
  bkK.add(revolve([[1.5, -34.0], [1.5, 34.0, 0.3]], { segs: 32 }), bright, T(0, 0, 0.2, 0, Math.PI / 2, 0));
  const doorH = hingeY - B.y0; // 127.0 mm
  // Signature sweeping R = 16.5 mm continuous rolled sheet-metal bottom-rear corner curve (zoom_02, zoom_03, Rolleiflex_F2-8-f_right.jpg!)
  const bendR = 16.5;
  const makeDoorLProfile = (zOut, yBot, tWall) => {
    const s = new THREE.Shape();
    const xOut = -zOut, xIn = xOut + tWall, xFront = depthTot - 0.8;
    const rO = bendR, rI = Math.max(2.0, bendR - tWall);
    s.moveTo(xOut, -0.6);
    s.lineTo(xOut, yBot + rO);
    s.absarc(xOut + rO, yBot + rO, rO, Math.PI, Math.PI * 1.5, false);
    s.lineTo(xFront, yBot);
    s.lineTo(xFront, yBot + tWall);
    s.lineTo(xOut + rO, yBot + tWall);
    s.absarc(xOut + rO, yBot + rO, rI, Math.PI * 1.5, Math.PI, true);
    s.lineTo(xIn, -0.6);
    s.closePath();
    return s;
  };
  // Continuous pebbled-leatherette outer L-bend door + dead-flat matte-black inner crinkle liner + sweeping R=16.5 mm chrome side U-rails!
  const doorLShape = makeDoorLProfile(1.0, -doorH, 2.0);
  bkK.add(slab(doorLShape, (B.hw - 0.8) * 2, 0.75, 36, 0.5, 3), leather, T(-(B.hw - 0.8), 0, 0, 0, Math.PI / 2, 0));
  // Dead-flat matte-black anti-reflection inner L-liner inside back & bottom door (eliminates greyish interior reflection in zoom_10!)
  const doorInLiner = makeDoorLProfile(-0.95, -doorH + 1.9, 0.65);
  bkK.add(slab(doorInLiner, (B.hw - 2.4) * 2, 0.15, 36, 0.0, 1), intBlk, T(-(B.hw - 2.4), 0, 0, 0, Math.PI / 2, 0));
  const chromeRailL = makeDoorLProfile(1.45, -doorH - 0.35, 2.4);
  [-1, 1].forEach((sx) => {
    const rx = sx > 0 ? B.hw - 1.9 : -B.hw + 0.1;
    bkK.add(slab(chromeRailL, 1.8, 0.32, 36, 0.78, 3), bright, T(rx, 0, 0, 0, Math.PI / 2, 0));
  });
  // Top-rear & front-bottom chrome hairline closing bars joining the two curved L-rails into one continuous frame!
  bkK.add(rbox(B.hw * 2 - 1.2, 1.8, 1.2, 0.35, 2, 0.78), bright, T(0, -1.2, 0.95));
  bkK.add(rbox(B.hw * 2 - 1.2, 1.8, 1.8, 0.45, 2, 0.78), bright, T(0, -doorH + 0.5, -depthTot + 0.6));
  // AUTHENTIC COMPACT RECTANGULAR 2.8F EV MATRIX TABLE (47.5 W × 41.5 H at Y=+45.5 — wider than tall, generous lower back panel below! zoom_02, zoom_03!)
  bkK.add(rbox(48.2, 42.2, 0.55, 0.3, 2, 0.6), bright, T(0, 45.5 - hingeY, 1.05));
  bkK.add(new THREE.PlaneGeometry(47.2, 41.2), lib.prepare(new THREE.MeshPhysicalMaterial({ map: rearEvTableTex(), roughness: 0.24, metalness: 0.45 }), {}), T(0, 45.5 - hingeY, 1.36));
  // Inside of rear door (zoom_10!): dead-flat matte-black 2-position sliding pressure plate w/ 24×36mm / 6×6 markings & twin leaf springs!
  bkK.add(rbox(61.0, 61.0, 1.5, 0.35, 2, 0.0), intBlk, T(0, -hingeY, -2.15));
  bkK.add(new THREE.PlaneGeometry(59.6, 59.6), lib.prepare(new THREE.MeshPhysicalMaterial({ name: 'rolleiInteriorPlate', map: pressurePlateTex(), roughness: 0.96, metalness: 0.0, specularIntensity: 0.0, envMapIntensity: 0.05 }), {}), T(0, -hingeY, -2.94, 0, Math.PI, 0));
  [-22.0, 22.0].forEach((px) => {
    bkK.add(rbox(2.6, 46.0, 0.8, 0.2, 1), intBlk, T(px, -hingeY, -1.3));
    [-16.0, 16.0].forEach((py) => bkK.add(revolve([[1.5, 0], [1.5, 0.45], [0, 0.45]], { segs: 24 }), bright, T(px * 0.65, -hingeY + py, -2.96, Math.PI, 0, 0)));
  });
  // Iconic LARGE Circular Rolleifix Concentric-Ring Tripod Plate centered on bottom (k7f_a_05, wf_05!)
  bkK.add(revolve([[19.8, 0], [19.8, 1.6, 0.4], [19.0, 1.9]], { segs: 64 }), bright, T(0, B.y0 - hingeY, DIM.socket.z - hingeZ, Math.PI / 2, 0, 0));
  bkK.add(new THREE.CircleGeometry(18.8, 56), lib.prepare(new THREE.MeshPhysicalMaterial({ map: bottomTripodPlateTex(), roughness: 0.20, metalness: 0.72 }), {}), T(0, B.y0 - 1.95 - hingeY, DIM.socket.z - hingeZ, Math.PI / 2, 0, 0));
  bkK.add(revolve([[4.8, 0], [4.8, 2.4]], { segs: 36 }), intBlk, T(0, B.y0 - hingeY, DIM.socket.z - hingeZ, Math.PI / 2, 0, 0));
  // Inside of bottom door (zoom_10!): gleaming machined silver tripod boss disc + matte-black supply-spool tension guide bar & twin rivets!
  bkK.add(new THREE.CircleGeometry(14.2, 44), bright, T(0, B.y0 + 2.65 - hingeY, DIM.socket.z - hingeZ, -Math.PI / 2, 0, 0));
  bkK.add(rbox(50.0, 2.2, 7.6, 0.4, 2), intBlk, T(0, B.y0 + 3.4 - hingeY, -42.5 - hingeZ));
  // 4 Authentic Domed Chrome Base Feet positioned cleanly forward of the sweeping R=16.5 mm rear bend (zoom_03, cmp_05!)
  [[-31.2, B.zF + 8.5], [31.2, B.zF + 8.5], [-31.2, B.zB - 17.5], [31.2, B.zB - 17.5]].forEach(([fx, fz]) => {
    bkK.add(revolve([[2.8, 0], [2.8, 1.4, 0.3], [2.3, 2.5, 0.45], [1.2, 3.1, 0.4], [0, 3.25]], { segs: 36, crease: 45 }), bright, T(fx, B.y0 - hingeY, fz - hingeZ, Math.PI / 2, 0, 0));
  });
  // Sculpted Curved Chrome Folding Back-Door Lock Latch + arched finger clasp wrapping front lip (k7f_a_05, wf_05!)
  bkK.add(rbox(14.5, 2.4, 12.0, 0.85, 3, 0.7), bright, T(0, B.y0 - 1.2 - hingeY, B.zF + 13.5 - hingeZ));
  bkK.add(rbox(7.8, 2.7, 6.2, 0.45, 2), anod, T(0, B.y0 - 1.4 - hingeY, B.zF + 13.5 - hingeZ));
  const latchPivot = new THREE.Group(); latchPivot.position.set(0, B.y0 - 1.8 - hingeY, B.zF + 7.5 - hingeZ);
  {
    const lk2 = new Kit();
    // Smoothly curved L-bent chrome clasp tongue wrapping gracefully upward over front chassis rim
    const claspProf = new THREE.Shape();
    claspProf.moveTo(-2.0, 1.1);
    claspProf.lineTo(10.0, 1.1);
    claspProf.quadraticCurveTo(12.2, 1.1, 12.2, 3.3);
    claspProf.lineTo(12.2, 5.2);
    claspProf.quadraticCurveTo(12.2, 6.2, 11.1, 6.2);
    claspProf.quadraticCurveTo(10.0, 6.2, 10.0, 5.0);
    claspProf.lineTo(10.0, 3.2);
    claspProf.quadraticCurveTo(10.0, 2.6, 9.2, 2.6);
    claspProf.lineTo(-2.0, 2.6);
    claspProf.closePath();
    lk2.add(slab(claspProf, 15.6, 0.55, 20, 0.78, 3), bright, T(-7.8, -1.6, 0, 0, Math.PI / 2, 0));
    lk2.add(rbox(10.8, 2.0, 9.8, 0.65, 2), leather, T(0, -0.35, -4.4));
    lk2.build(latchPivot);
  }
  backDoorPivot.add(latchPivot);
  bkK.build(backDoorPivot);

  // ───────── FRONT FOCUSING BOARD, BRIGHT SILVER-KNURLED THUMBWHEELS & K7F FRONT CONTROLS (k7f_a_01, k7f_a_09, k7f_b_08!) ─────────
  // Zero straight octagonal lines: continuous smooth compound Bezier curves hugging BOTH circular Bay III barrels!
  const makeBoardContour = (hw, yBot, yBotMid, yTopSide, yTopMid, r = 4.6) => {
    const s = new THREE.Shape();
    s.moveTo(-hw + r, yBot);
    s.bezierCurveTo(-hw * 0.45, yBotMid, hw * 0.45, yBotMid, hw - r, yBot);
    s.quadraticCurveTo(hw, yBot, hw, yBot + r);
    s.lineTo(hw, yTopSide - r);
    // Graceful continuous top arch hugging the circular upper Heidosmat lens (NO straight octagonal roof lines!)
    s.bezierCurveTo(hw, yTopSide + 1.8, hw * 0.62, yTopMid - 1.2, 15.5, yTopMid);
    s.quadraticCurveTo(0, yTopMid + 1.4, -15.5, yTopMid);
    s.bezierCurveTo(-hw * 0.62, yTopMid - 1.2, -hw, yTopSide + 1.8, -hw, yTopSide - r);
    s.lineTo(-hw, yBot + r);
    s.quadraticCurveTo(-hw, yBot, -hw + r, yBot);
    return s;
  };
  const boardShape = makeBoardContour(36.8, -40.5, -44.2, 59.8, 67.4, 5.0);
  fk.add(slab(boardShape, 13.0, 0.95, 32, 0.65, 3), bk, T(0, 0, DIM.boardZ));
  // Razor-thin mirror-chrome hairline pinstripe framing the pebbled leatherette front board
  const pinRim = makeBoardContour(35.0, -33.5, -40.6, 56.8, 64.4, 4.4);
  const pinHole = makeBoardContour(33.7, -32.3, -39.2, 55.5, 63.1, 3.8);
  pinRim.holes.push(new THREE.Path(pinHole.getPoints(96).reverse()));
  fk.add(slab(pinRim, 0.85, 0.2, 32, 0.78, 2), bright, T(0, 0, DIM.boardZ - 0.55));
  fk.add(slab(pinHole, 0.65, 0.18, 32, 0.4, 2), leather, T(0, 0, DIM.boardZ - 0.42));
  [-22.5, 22.5].forEach((rx) => fk.add(revolve([[1.4, 0], [1.4, 0.6, 0.25], [0, 0.6]], { segs: 28 }), bright, T(rx, -40.2, DIM.boardZ - 0.5, Math.PI, 0, 0)));
  // Nested matte-black focusing skirt behind front board (light-tight across full 12 mm rack travel)
  fk.add(rbox(70.0, 100.0, 14.0, 3.0, 2), anod, T(0, 14.0, DIM.boardZ + 12.0));

  // Sleek Recessed Peep-Window Crown Saddle hugging top of upper Heidosmat (k7f_a_06, k7f_b_06, 16971406237.jpg!)
  // Shows f: (front strip) & t (rear strip) 100% UPRIGHT from the photographer's waist-level POV!
  fk.add(rbox(20.0, 3.8, 10.6, 1.2, 3, 0.5), bk, T(0, DIM.viewY + 21.8, DIM.boardZ - 6.2));
  const evCv = canvas(256, 144), evTex = tex(evCv);
  fk.add(new THREE.PlaneGeometry(17.2, 9.2), lib.prepare(new THREE.MeshBasicMaterial({ map: evTex }), {}), T(0, DIM.viewY + 23.8, DIM.boardZ - 6.2, -Math.PI / 2, 0, 0));

  // BRIGHT POLISHED-SILVER 40-FLUTE KNURLED COMPUR THUMBWHEELS nestled tightly between twin barrels (zoom_04, zoom_05!)
  // Photographer's LEFT (-X) = Aperture wheel; Photographer's RIGHT (+X) = Shutter Speed wheel!
  const twFaceMat = lib.prepare(new THREE.MeshPhysicalMaterial({ map: thumbwheelFaceTex(), roughness: 0.36, metalness: 0.14 }), {});
  const makeThumbwheel = (x, hover, tag) => {
    const g = new THREE.Group(); g.position.set(x, 23.0, DIM.boardZ - 4.2);
    const wk = new Kit();
    // Crisp 40-flute parallel machined chrome knurling (rib=1 on BOTH start & end vertices -> zero taper, segs=320!)
    wk.add(revolve([
      [9.0, 0], [9.6, 0.35, 0.3, 1], [9.6, 3.85, 0.3, 1], [8.9, 4.3], [8.3, 4.3],
    ], { segs: 320, ribs: { n: 40, depth: 0.62, groove: 0.48, edge: 0.125 } }), lib.get('chromeBright', { hover }), T(0, 0, 0, Math.PI, 0, 0));
    wk.add(new THREE.CircleGeometry(8.2, 48), twFaceMat, T(0, 0, -4.34, 0, Math.PI, 0));
    return { group: g, meshes: wk.build(g, tag) };
  };
  const apW = makeThumbwheel(-23.6, hov.aperture, 'aperture');
  const shW = makeThumbwheel(23.6, hov.shutter, 'shutter');
  const apWheel = apW.group, shWheel = shW.group;
  var apertureMeshes = apW.meshes, shutterMeshes = shW.meshes;
  board.add(apWheel, shWheel);

  // Front Upper-Right (+X beside viewing lens): Crisp ⚡ (X) & bulb (M) icons + sculpted tapered teardrop M/X/V self-timer lever (Manual p.25, k7f_a_09!)
  fk.add(new THREE.PlaneGeometry(8.2, 4.1), lib.prepare(new THREE.MeshBasicMaterial({ map: xmSyncIconsTex(), transparent: true }), {}), T(28.6, 54.4, DIM.boardZ - 1.1, 0, Math.PI, 0));
  const selfTimerLever = new THREE.Group(); selfTimerLever.position.set(29.2, 50.4, DIM.boardZ - 1.2);
  {
    const stk = new Kit();
    const stDrop = new THREE.Shape();
    stDrop.moveTo(0, 3.1);
    stDrop.bezierCurveTo(3.2, 3.1, 3.3, -1.2, 2.3, -6.2);
    stDrop.bezierCurveTo(1.7, -9.8, 1.5, -11.6, 0, -11.6);
    stDrop.bezierCurveTo(-1.5, -11.6, -1.7, -9.8, -2.3, -6.2);
    stDrop.bezierCurveTo(-3.3, -1.2, -3.2, 3.1, 0, 3.1);
    stk.add(slab(stDrop, 2.1, 0.6, 24, 0.45, 3), bk, T(0, 0, -1.05));
    stk.add(new THREE.PlaneGeometry(3.6, 9.6), lib.prepare(new THREE.MeshPhysicalMaterial({ map: selfTimerFaceTex(), roughness: 0.25, metalness: 0.2 }), {}), T(0, -4.9, -1.12, 0, Math.PI, 0));
    stk.add(revolve([[2.5, 0], [2.8, 0.3, 0.35, 1], [2.8, 3.6, 0.35, 1], [2.3, 4.0]], { segs: 192, ribs: { n: 24, depth: 0.22 } }), bright, T(0, 0, 0, Math.PI, 0, 0));
    stk.add(new THREE.CircleGeometry(1.65, 28), bk, T(0, 0, -4.05, 0, Math.PI, 0));
    stk.build(selfTimerLever);
  }
  selfTimerLever.rotation.z = -0.42; // authentic diagonal sweep clear of upper viewing lens rim!
  board.add(selfTimerLever);

  // Front Lower-Left (-X corner): Coaxial chrome bayonet PC flash sync socket + teardrop plate & upper-right release button (k7f_a_09, k7f_b_08!)
  fk.add(revolve([[5.5, 0], [5.5, 2.8, 0.35], [4.0, 3.2], [2.8, 3.2]], { segs: 40 }), bright, T(-26.8, -28.6, DIM.boardZ - 0.8, Math.PI, 0, 0));
  fk.add(revolve([[2.3, 1.6], [2.3, 4.4]], { segs: 32 }), anod, T(-26.8, -28.6, DIM.boardZ - 0.8, Math.PI, 0, 0));
  fk.add(revolve([[0.75, 1.6], [0.75, 4.6]], { segs: 24 }), brass, T(-26.8, -28.6, DIM.boardZ - 0.8, Math.PI, 0, 0));
  fk.add(revolve([[2.35, 0], [2.6, 0.25, 0.35, 1], [2.6, 2.45, 0.35, 1], [2.3, 2.65], [0, 2.65]], { segs: 160, ribs: { n: 20, depth: 0.18 } }), bright, T(-31.2, -23.0, DIM.boardZ - 1.0, Math.PI, 0, 0));

  // Front Lower-Right (+X corner): Telescopic machined chrome shutter release + sculpted concentric curved safety-lock crescent guard (k7f_a_01, k7f_a_09!)
  const release = new THREE.Group(); release.position.set(27.8, -28.8, DIM.boardZ - 0.8);
  {
    const rk = new Kit();
    rk.add(revolve([[5.1, 0], [5.5, 0.3, 0.35, 1], [5.5, 3.4, 0.35, 1], [4.1, 3.9]], { segs: 256, ribs: { n: 32, depth: 0.24 } }), bright, T(0, 0, 0, Math.PI, 0, 0));
    const guardS = new THREE.Shape();
    guardS.absarc(0, 0, 6.9, -2.55, -0.75, false);
    guardS.quadraticCurveTo(4.2, -5.2, 2.8, -4.6);
    guardS.absarc(0, 0, 4.7, -0.82, -2.48, true);
    guardS.quadraticCurveTo(-5.8, -4.6, -5.7, -3.8);
    rk.add(slab(guardS, 2.0, 0.5, 24, 0.72, 3), bright, T(0, 0, -2.7));
    rk.add(revolve([[2.8, 0], [2.8, 8.6, 0.45], [1.3, 8.9]], { segs: 40 }), lib.get('chromeBright', { hover: hov.release }), T(0, 0, 0, Math.PI, 0, 0));
    rk.add(new THREE.CircleGeometry(1.2, 28), flock, T(0, 0, -8.95, 0, Math.PI, 0));
    var releaseMeshes = rk.build(release, 'release');
  }
  board.add(release);

  // ───────── TWIN KISSING BAY III LENSES (46.3 mm pitch, true 30 mm f/2.8 apertures, double-stepped Bay III flanges & deep conical beauty rings — zoom_04, zoom_05!) ─────────
  // LENS_GLASS_GLSL Local-Origin Invariant: BOTH front glass meshes stay standalone local-origin meshes in `dyn`!
  // Lower Planar 80/2.8: warm amber-gold Zeiss coating + closed 5-blade Compur star-seam at rest (gR = 15.4 mm!)
  // Upper Heidosmat 80/2.8: cool violet-lavender viewing coating + open viewing barrel depth (gR = 14.8 mm!)
  const takeGlassU = { blades: 5, optics: { value: new THREE.Vector4(14.3, 0.0, 15.4, 12.6) }, state: { value: new THREE.Vector4(0, 1.0, 0, 0) },
    ghostA: { value: new THREE.Color(1.30, 0.88, 0.40) }, ghostB: { value: new THREE.Color(0.92, 0.62, 0.36) } };
  const viewGlassU = { blades: 10, optics: { value: new THREE.Vector4(13.8, 1.0, 14.8, 12.2) }, state: { value: new THREE.Vector4(0.18, 1.0, 0, 0) },
    ghostA: { value: new THREE.Color(0.92, 0.56, 1.24) }, ghostB: { value: new THREE.Color(0.58, 0.70, 1.18) } };
  const takeGlassMat = lib.prepare(lib.base.glass.clone(), { lensGlass: takeGlassU });
  const viewGlassMat = lib.prepare(lib.base.glass.clone(), { lensGlass: viewGlassU });

  // Lower Planar brushed-silver SYNCHRO-COMPUR outer collar w/ unobstructed bottom legend, twin inner pinstripes & 4 recessed faceplate screws!
  {
    const z0 = DIM.boardZ;
    fk.add(revolve([[30.6, z0], [30.6, z0 - 5.4, 0.5], [29.4, z0 - 7.5, 0.4], [24.2, z0 - 7.5]], { segs: 96, crease: 28 }), bk, T(0, DIM.takeY, 0));
    const colRing = new THREE.RingGeometry(24.0, 30.4, 96); colRing.rotateY(Math.PI); colRing.translate(0, DIM.takeY, z0 - 7.6);
    fk.add(colRing, lib.prepare(new THREE.MeshPhysicalMaterial({ map: compurCollarTex(), roughness: 0.18, metalness: 0.84 }), {}));
    [42, 138, 222, 318].forEach((a) => {
      addScrew(fk, bright, fk, flock, T(Math.cos(a * DEG) * 27.6, DIM.takeY + Math.sin(a * DEG) * 27.6, z0 - 7.65, 0, Math.PI, 0), 0.72, false, 0.3);
    });
  }

  const addBarrel = (cy, glassMat, title, sub, outerR, gR, zStart) => {
    const z0 = zStart;
    // Sleek glossy-black stepped barrel base leading cleanly up to the bright-chrome Bay III twin bayonet ring
    fk.add(revolve([
      [outerR + 0.7, DIM.boardZ], [outerR + 0.7, z0 - 2.2, 0.4],
      [outerR + 0.1, z0 - 3.6], [outerR + 0.1, z0 - 9.8, 0.35],
    ], { segs: 96, crease: 28 }), bk, T(0, cy, 0));
    // DELICATE DOUBLE-STEPPED POLISHED-CHROME BAY III TWIN BAYONET FLANGE: slim 0.95 mm outer rim + wide 1.40 mm dark track + slim 0.70 mm inner lip (cmp_09 left!)
    const rMidOut = outerR - 0.95, rMidIn = outerR - 2.35, rInBay = outerR - 3.05;
    fk.add(revolve([
      [outerR, z0 - 9.6], [outerR, z0 - 12.8, 0.3], [outerR - 0.25, z0 - 13.15, 0.25],
      [rMidOut, z0 - 13.15, 0.25], [rMidOut, z0 - 11.2],
      [rMidIn, z0 - 11.2], [rMidIn, z0 - 12.75, 0.2], [rInBay, z0 - 12.75, 0.2],
      [rInBay, z0 - 10.6],
    ], { segs: 108, crease: 26 }), bright, T(0, cy, 0));
    // 3 authentic external Bay III stepped locking lugs + 3 inner Bay III bayonet tabs (zoom_04!)
    [30, 150, 270].forEach((a) => {
      fk.add(rbox(5.8, 0.95, 1.85, 0.25, 2), bright, T(0, cy, 0).multiply(radialT(a * DEG, outerR - 0.05, z0 - 11.6)));
      fk.add(rbox(5.0, 0.75, 1.15, 0.2, 2), bright, T(0, cy, 0).multiply(radialT((a + 60) * DEG, rInBay - 0.25, z0 - 11.9)));
    });
    // Wide deep matte-black channel floor inside the twin Bay III bayonet track (1.40 mm high-contrast dark groove!)
    fk.add(revolve([[rMidOut - 0.04, z0 - 11.25], [rMidIn + 0.04, z0 - 11.25]], { segs: 72 }), intBlk, T(0, cy, 0));
    // GENEROUS 5.0 mm WIDE RECESSED CONICAL MATTE-BLACK ENGRAVED BEAUTY RING (sloping smoothly inward toward recessed front glass — zoom_04!)
    const rText = Math.round(512 * ((gR + rInBay) * 0.52) / rInBay);
    const face = new THREE.RingGeometry(gR + 0.35, rInBay, 96, 2);
    // Set +Z BEFORE rotateY(Math.PI) so AFTER rotation it faces outward (-Z) at z0 - 9.0 (inner glass lip) .. z0 - 10.9 (outer Bay III edge)!
    const fp = face.attributes.position;
    for (let i = 0; i < fp.count; i++) {
      const rr = Math.hypot(fp.getX(i), fp.getY(i));
      const k = Math.max(0, Math.min(1, (rr - (gR + 0.35)) / Math.max(0.1, rInBay - (gR + 0.35))));
      fp.setZ(i, lerp(9.0, 10.95, k));
    }
    face.computeVertexNormals();
    face.rotateY(Math.PI); face.translate(0, cy, z0);
    fk.add(face, lib.prepare(new THREE.MeshPhysicalMaterial({ map: lensFaceTex(title, sub, rText), roughness: 0.30, metalness: 0.14 }), {}));
    // Crisp dark anodized inner lens-cell retaining lip + bright machined micro-chamfer + dual opposing spanner-wrench notches (180° apart!)
    fk.add(revolve([[gR + 0.45, z0 - 8.95], [gR + 0.45, z0 - 9.45, 0.2], [gR - 0.15, z0 - 9.45], [gR - 0.15, z0 - 7.8]], { segs: 72 }), bk, T(0, cy, 0));
    fk.add(revolve([[gR + 0.20, z0 - 9.46], [gR + 0.48, z0 - 9.40]], { segs: 72 }), lib.get('steel'), T(0, cy, 0));
    [-1, 1].forEach((s) => fk.add(rbox(1.25, 0.48, 0.44, 0.06, 1), intBlk, T(s * (gR + 0.35), cy, z0 - 9.48)));
    fk.add(new THREE.CircleGeometry(gR + 0.1, 48), intBlk, T(0, cy, z0 - 7.4, 0, Math.PI, 0));
    // Properly recessed convex front lanthanum-crown glass element (apex cleanly recessed ~1.8 mm behind Bay III rim -> ZERO bug-eyed bulge!)
    const glassMesh = new THREE.Mesh(prep(revolve([[0, z0 - 11.4], [gR * 0.45, z0 - 10.9], [gR * 0.8, z0 - 9.95], [gR, z0 - 9.0]], { segs: 64 })), glassMat);
    glassMesh.position.set(0, cy, 0);
    board.add(glassMesh);
    return glassMesh;
  };
  const viewGlass = addBarrel(DIM.viewY, viewGlassMat, 'Heidosmat  1:2,8/80', '892409', 23.0, 14.8, DIM.boardZ - 5.6);
  const takeGlass = addBarrel(DIM.takeY, takeGlassMat, 'Planar  1:2,8  f=80mm', 'GLASS WORKS  Nr 3939937', 23.6, 15.4, DIM.boardZ - 7.8);
  fk.build(board);

  // Lazy Cutaway Multi-Element Twin-Lens Optics (5-element Planar + 4-element Heidosmat)
  const inner = new THREE.Group(); inner.visible = false; board.add(inner);
  let innerBuilt = false;
  const ensureInner = () => {
    if (innerBuilt) return false;
    innerBuilt = true;
    const ik = new Kit(), gInner = lib.get('innerGlass'), rim = lib.get('anod');
    const buildStack = (cy, spec) => {
      const zStart = DIM.boardZ - 9.6, zEnd = DIM.boardZ + 21.6;
      spec.forEach(([zf, rf, th, R1, R2]) => {
        const z0 = lerp(zStart, zEnd, zf), r = 17.0 * rf;
        const sag1 = (r * r) / (2 * R1 * r * 1.45), sag2 = (r * r) / (2 * R2 * r * 1.45);
        const prof = [];
        for (let i = 0; i <= 8; i++) { const u = i / 8, rr = r * u; prof.push([rr, z0 - th * 0.5 + sag1 * u * u]); }
        for (let i = 8; i >= 0; i--) { const u = i / 8, rr = r * u; prof.push([rr, z0 + th * 0.5 + sag2 * u * u]); }
        ik.add(revolve(prof, { segs: 40 }), gInner, T(0, cy, 0));
        ik.add(revolve([[r, z0 - th * 0.5 + sag1], [r + 0.65, z0 - th * 0.5 + sag1], [r + 0.65, z0 + th * 0.5 + sag2], [r, z0 + th * 0.5 + sag2]], { segs: 40 }), rim, T(0, cy, 0));
      });
    };
    buildStack(DIM.takeY, PLANAR_5);
    buildStack(DIM.viewY, HEIDOSMAT_4);
    ik.build(inner);
    return true;
  };

  // Lazy Bay III Rolleinar + Rolleipark Close-Up Lens Pairs (3 genuinely distinct sculpted, engraved diopter pairs: +1 D, +2 D, +3 D!)
  const rolleinarGroup = new THREE.Group(); rolleinarGroup.visible = false; board.add(rolleinarGroup);
  const rolSets = {};
  const rolGlassMat = lib.prepare(new THREE.MeshPhysicalMaterial({
    name: 'rolleiCloseUpGlass', color: 0x09161b, metalness: 0.06, roughness: 0.025, clearcoat: 1.0, clearcoatRoughness: 0.02,
    specularIntensity: 1.0, envMapIntensity: 1.85, iridescence: 0.85, iridescenceIOR: 1.38,
    iridescenceThicknessMinimum: 260, iridescenceThicknessMaximum: 520, transparent: true, opacity: 0.32, depthWrite: false,
  }), {});
  const ensureRolleinar = (level = 1) => {
    const lv = Math.max(1, Math.min(3, level | 0));
    let created = false;
    if (!rolSets[lv]) {
      created = true;
      const gSet = new THREE.Group();
      const rk = new Kit(), steel = lib.get('steel');
      const hCell = [0, 5.4, 7.6, 10.0][lv];
      const sag = [0, 1.5, 2.5, 3.6][lv];
      const dStr = `+${lv} D   BAY III`;
      // Upper Rolleipark (viewing parallax-correcting wedge prism w/ raised red 12 o'clock alignment dot!) + Lower Rolleinar (taking meniscus)
      [
        { cy: DIM.viewY, z0: DIM.boardZ - 18.0, r0: 22.9, gR: 16.4, title: `GW  ROLLEIPARK ${lv}`, sub: dStr, isUpper: true },
        { cy: DIM.takeY, z0: DIM.boardZ - 20.2, r0: 23.6, gR: 17.0, title: `GW  ROLLEINAR ${lv}`,  sub: dStr, isUpper: false },
      ].forEach(({ cy, z0, r0, gR, title, sub, isUpper }) => {
        const zFront = z0 - hCell;
        // Bright chrome Bay III rear bayonet collar seating flush inside the lens's Bay III flange
        rk.add(revolve([[r0 - 2.1, z0 + 0.6], [r0 - 0.1, z0 + 0.4, 0.25], [r0 - 0.1, z0 - 1.3, 0.25], [r0 - 0.5, z0 - 1.5]], { segs: 96, crease: 26 }), bright, T(0, cy, 0));
        // Knurled black anodized grip collar (n = 60, segs = 480 -> zero aliasing!) w/ progressive stepped chrome accent ring on +2 D / +3 D
        const zKnurlEnd = lv >= 2 ? zFront + 2.4 : zFront + 1.1;
        rk.add(revolve([
          [r0 - 0.5, z0 - 1.4], [r0 + 0.55, z0 - 1.8, 0.35, 1], [r0 + 0.55, zKnurlEnd + 0.35, 0.35, 1], [r0 - 0.3, zKnurlEnd],
        ], { segs: 480, crease: 28, ribs: { n: 60, depth: 0.28, groove: 0.48, edge: 0.16 } }), bk, T(0, cy, 0));
        if (lv >= 2) {
          // Stepped gleaming satin-chrome diopter barrel extension ring distinguishing Rolleinar 2 & 3 at a glance!
          rk.add(revolve([
            [r0 - 0.3, zKnurlEnd], [r0 + 0.15, zKnurlEnd - 0.25, 0.2], [r0 + 0.15, zFront + 0.85, 0.2], [r0 - 0.35, zFront + 0.65],
          ], { segs: 96, crease: 26 }), bright, T(0, cy, 0));
        }
        // Machined front bezel lip + exposed bright steel micro-chamfer
        rk.add(revolve([[r0 - 0.35, zFront + 0.75], [r0 - 0.35, zFront + 0.15, 0.2], [r0 - 1.0, zFront, 0.25], [r0 - 1.4, zFront + 0.45]], { segs: 96, crease: 26 }), bk, T(0, cy, 0));
        rk.add(revolve([[r0 - 1.42, zFront + 0.45], [r0 - 1.0, zFront + 0.02]], { segs: 96 }), steel, T(0, cy, 0));
        // Engraved conical black beauty ring reading GW ROLLEIPARK 1/2/3 (upper) & GW ROLLEINAR 1/2/3 (lower) + dual spanner notches!
        const rInRing = gR + 0.35, rOutRing = r0 - 1.45;
        const rTextPx = Math.round(512 * ((rInRing + rOutRing) * 0.5) / rOutRing);
        const face = new THREE.RingGeometry(rInRing, rOutRing, 84, 2);
        const fp = face.attributes.position;
        for (let i = 0; i < fp.count; i++) {
          const rr = Math.hypot(fp.getX(i), fp.getY(i));
          const u = Math.max(0, Math.min(1, (rr - rInRing) / Math.max(0.1, rOutRing - rInRing)));
          fp.setZ(i, lerp(hCell - 1.35, hCell - 0.45, u));
        }
        face.computeVertexNormals();
        face.rotateY(Math.PI); face.translate(0, cy, z0);
        rk.add(face, lib.prepare(new THREE.MeshPhysicalMaterial({ name: `rolFace_${lv}_${isUpper ? 'u' : 'l'}`, map: rolleinarFaceTex(title, sub, rTextPx), roughness: 0.34, metalness: 0.14 }), {}));
        // Dual opposing retaining-ring spanner notches (180° apart!)
        [-1, 1].forEach((s) => rk.add(rbox(1.2, 0.48, 0.42, 0.06, 1), intBlk, T(s * (rInRing + 0.32), cy, zFront + 1.25)));
        // Iconic raised red 12 o'clock alignment index dot on upper Rolleipark parallax wedge (white mounting pip on lower Rolleinar!)
        rk.add(new THREE.SphereGeometry(isUpper ? 0.78 : 0.48, 14, 10), isUpper ? lib.get('red') : lib.get('white'), T(0, cy + r0 - 0.65, zFront - 0.02));
        // Clear dark multi-coated curved close-up meniscus glass (outward -Z normal, r ascending 0 -> gR!)
        rk.add(revolve([
          [0, zFront + 1.1 - sag], [gR * 0.45, zFront + 1.1 - sag * 0.72], [gR * 0.80, zFront + 1.1 - sag * 0.30], [gR + 0.15, zFront + 1.1],
        ], { segs: 64 }), rolGlassMat, T(0, cy, 0));
      });
      rk.build(gSet);
      rolleinarGroup.add(gSet);
      rolSets[lv] = gSet;
    }
    Object.entries(rolSets).forEach(([k, grp]) => { grp.visible = Number(k) === lv; });
    return created;
  };

  // Lazy Authentic Franke & Heidecke Bay III Round-to-Square Tapered Metal Hood on lower taking lens
  const hoodGroup = new THREE.Group(); hoodGroup.visible = false; board.add(hoodGroup);
  let hoodBuilt = false;
  const ensureHood = () => {
    if (hoodBuilt) return false;
    hoodBuilt = true;
    const hk = new Kit(), z0 = DIM.boardZ - 20.6, rBay = 24.1, zNeck = z0 - 5.0, zTip = z0 - 25.5;
    // Knurled Bay III bayonet locking collar (n = 48, segs = 384 -> zero aliasing!) + white alignment tick
    hk.add(revolve([[rBay - 0.9, z0 + 0.4], [rBay + 0.75, z0 - 0.2, 0.35, 1], [rBay + 0.75, zNeck + 0.5, 0.35, 1], [rBay - 0.3, zNeck]], { segs: 384, crease: 28, ribs: { n: 48, depth: 0.24, groove: 0.48, edge: 0.16 } }), bk, T(0, DIM.takeY, 0));
    hk.add(rbox(1.0, 2.2, 0.32, 0.08, 1), lib.get('white'), T(0, DIM.takeY + rBay + 0.78, (z0 + zNeck) / 2, Math.PI / 2, 0, 0));
    // Smooth lofted round-to-square tapered satin-black metal shade (14 rings × 96 segs, watertight lip + flocked light-trap interior!)
    const rings = 14, segs = 96;
    const buildShell = (inset, flip) => {
      const pos = [], idx = [];
      for (let j = 0; j <= rings; j++) {
        const t = j / rings, z = lerp(zNeck, zTip, t);
        const sqMix = THREE.MathUtils.smoothstep(t, 0.08, 0.85);
        const hw = lerp(rBay - 0.35, 27.6, t) - inset;
        const rc = lerp(hw * 0.96, 4.2, sqMix);
        for (let i = 0; i <= segs; i++) {
          const a = (i / segs) * TAU, ca = Math.cos(a), sa = Math.sin(a);
          const s = hw / Math.max(Math.abs(ca), Math.abs(sa), 1e-6);
          const sx = ca * s, sy = sa * s;
          const cx = Math.max(-(hw - rc), Math.min(hw - rc, sx)), cy2 = Math.max(-(hw - rc), Math.min(hw - rc, sy));
          const dx = sx - cx, dy = sy - cy2, dl = Math.hypot(dx, dy);
          const px = dl > 1e-5 ? cx + (dx / dl) * rc : sx;
          const py = dl > 1e-5 ? cy2 + (dy / dl) * rc : sy;
          pos.push(px, DIM.takeY + py, z);
        }
      }
      const stride = segs + 1;
      for (let j = 0; j < rings; j++) {
        for (let i = 0; i < segs; i++) {
          const a = j * stride + i, b = a + stride, c = b + 1, d = a + 1;
          if (!flip) idx.push(a, b, c, a, c, d);
          else idx.push(a, c, b, a, d, c);
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setIndex(idx);
      geo.computeVertexNormals();
      return geo;
    };
    hk.add(buildShell(0.0, false), bk);
    hk.add(buildShell(1.45, true), intBlk);
    // Watertight beveled square front rim collar closing outer & inner walls cleanly at zTip
    const lipS = rrPath(-27.6, -27.6, 27.6, 27.6, 4.2);
    lipS.holes.push(rrPath(-26.15, -26.15, 26.15, 26.15, 3.0, new THREE.Path()));
    hk.add(slab(lipS, 1.4, 0.35, 16, 0.45, 2), bk, T(0, DIM.takeY, zTip - 0.6));
    hk.build(hoodGroup);
    return true;
  };

  // Lazy Bay III Optical Filter on lower taking lens
  const filterGroup = new THREE.Group(); filterGroup.visible = false; board.add(filterGroup);
  const filterMat = new THREE.MeshPhysicalMaterial({ name: 'rolleiFilter', color: 0xffffff, roughness: 0.03, transparent: true, opacity: 0.34, depthWrite: false });
  lib.prepare(filterMat, {});
  const filterMeshes = [];
  let filterBuilt = false;
  const ensureFilter = () => {
    if (filterBuilt) return false;
    filterBuilt = true;
    const flk = new Kit(), z0 = DIM.boardZ - 21.0;
    flk.add(revolve([[21.0, z0 - 4.2], [23.0, z0 - 4.2, 0.4, 1], [23.0, z0 - 0.4, 0.4, 1], [21.0, z0]], { segs: 384, ribs: { n: 48, depth: 0.24 } }), lib.get('anod', { hover: hov.filter }), T(0, DIM.takeY, 0));
    flk.add(new THREE.CircleGeometry(20.6, 48), filterMat, T(0, DIM.takeY, z0 - 2.4, 0, Math.PI, 0));
    filterMeshes.push(...flk.build(filterGroup, 'filter'));
    return true;
  };

  // ───────── TOP ROLLEICLEAR GROUND GLASS (CLIPPED!) + REMOVABLE TWO-TIER HOOD WITH SPORTSFINDER & CORRUGATED SIDE WALLS (k7f_a_02..06, k7f_a_10!) ─────────
  const screenG = new THREE.Group(); screenG.position.set(0, DIM.screenY, DIM.screenZ);
  const defaultScreenTex = groundGlassGridTex();
  const screenMat = lib.prepare(new THREE.MeshBasicMaterial({ map: defaultScreenTex, color: 0xffffff, toneMapped: false }), {});
  const screenImg = new THREE.Mesh(prep(new THREE.PlaneGeometry(DIM.screen, DIM.screen)), screenMat);
  screenImg.rotation.x = -Math.PI / 2; screenImg.userData.noShadow = true; screenImg.userData.part = 'finder';
  screenG.add(screenImg);
  // Persistent transparent Rolleiclear grid & central split-image rangefinder wedge overlay (stays visible over ANY setScreenTexture()!)
  const screenOverlayMat = lib.prepare(new THREE.MeshBasicMaterial({
    map: groundGlassOverlayTex(), transparent: true, depthWrite: false, toneMapped: false,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
  }), {});
  const screenOverlay = new THREE.Mesh(prep(new THREE.PlaneGeometry(DIM.screen, DIM.screen)), screenOverlayMat);
  screenOverlay.rotation.x = -Math.PI / 2; screenOverlay.position.y = 0.04; screenOverlay.renderOrder = 2;
  screenOverlay.userData.noShadow = true; screenOverlay.userData.part = 'finder';
  screenG.add(screenOverlay);
  // Dead-flat jet-black crinkled focusing screen bezel + 2 corner screws + 2 matte-black side hood-retention clips (cmp_06 left!)
  {
    const sk = new Kit();
    const sRim = rrPath(-35.5, -34.0, 35.5, 34.0, 1.5); sRim.holes.push(rrPath(-28.0, -28.0, 28.0, 28.0, 0.5, new THREE.Path()));
    sk.add(slab(sRim, 1.4, 0.25, 10, 0.0), intBlk, T(0, -0.4, 0, -Math.PI / 2, 0, 0));
    [-26.0, 26.0].forEach((sz) => addScrew(sk, anod, sk, flock, T(-31.8, 1.05, sz, -Math.PI / 2, 0, 0), 1.3, false, 0.25));
    // Twin matte-black spring hood-retention clips flanking left & right screen rim (cmp_06 left!)
    [-34.6, 34.6].forEach((cx) => sk.add(rbox(2.8, 1.8, 9.2, 0.35, 2), intBlk, T(cx, 1.3, -10.0)));
    sk.build(screenG, 'finder');
  }
  // Exact focus-coupled sliding parallax mask bar: 6.0 mm deep, tucked cleanly UNDER front screen bezel at ∞ (0.0 mm blocked!) -> slides continuously to 5.08 mm at 0.9 m with ZERO front gap!
  const parallaxMask = new THREE.Mesh(prep(new THREE.PlaneGeometry(DIM.screen, 6.0)), intBlk);
  parallaxMask.rotation.x = -Math.PI / 2; parallaxMask.position.set(0, 0.08, -DIM.screen / 2 - 3.0); parallaxMask.userData.noShadow = true;
  screenG.add(parallaxMask);

  // Removable Two-Tier Waist-Level Hood: taller authentic stepped matte collar (9.2 mm) + sleek 5.4 mm beveled lid + +7.2° BACKWARD-SLANTED OPEN CHIMNEY (zoom_01, zoom_02, zoom_03!)
  const hoodMount = new THREE.Group(); hoodMount.position.set(0, DIM.screenY, DIM.screenZ);
  const hdZ = 35.6;
  const HOOD_SLANT = 7.2 * DEG;
  const hoodShearZ = (y) => y * Math.tan(HOOD_SLANT);
  {
    const baseCollar = rrPath(-38.0, -hdZ, 38.0, hdZ, 3.6);
    baseCollar.holes.push(rrPath(-30.0, -29.0, 30.0, 29.0, 1.8, new THREE.Path()));
    const upperCollar = rrPath(-37.2, -(hdZ - 0.8), 37.2, hdZ - 0.8, 3.2);
    upperCollar.holes.push(rrPath(-30.0, -29.0, 30.0, 29.0, 1.8, new THREE.Path()));
    const ck2 = new Kit();
    // Stepped matte-black textured removable-hood base skirt (zoom_01, zoom_02, zoom_03!)
    ck2.add(slab(baseCollar, 4.8, 0.45, 16, 0.35), leather, T(0, 0, 0, -Math.PI / 2, 0, 0));
    ck2.add(slab(upperCollar, 4.4, 0.4, 16, 0.45), bk, T(0, 4.6, 0, -Math.PI / 2, 0, 0));
    // Left & right serrated black removable-hood release latch buttons right above the front of the strap rails (zoom_01, zoom_08!)
    [-1, 1].forEach((sx) => {
      ck2.add(rbox(3.2, 4.8, 6.2, 0.45, 2), bk, T(sx * 38.3, 2.4, -18.0));
      for (let ry = 0.6; ry <= 4.2; ry += 0.9) ck2.add(rbox(3.6, 0.35, 5.4, 0.1, 1), anod, T(sx * 38.4, ry, -18.0));
    });
    ck2.build(hoodMount, 'finder');
  }
  const lid = new THREE.Group(); lid.position.set(0, 9.1, -hdZ);
  const sportsFlap = new THREE.Group(); sportsFlap.position.set(0, 5.3, hdZ - 20.5);
  {
    const lk = new Kit();
    // Sleek compact curved-crown glossy-black enamel hood lid (76.0 × 71.2 × 5.5 mm — keeps exact ~148 mm closed spec height!)
    lk.add(rbox(76.0, 5.5, hdZ * 2, 2.6, 5, 0.6), bk, T(0, 2.75, hdZ));
    lk.add(rbox(67.6, 0.45, hdZ * 2 - 8.4, 2.0, 3), leather, T(0, 5.38, hdZ));
    // Twin parallel bright silver trim bars on left & right of top rim (visible when open in k7f_a_10!)
    [-22.0, 22.0].forEach((tx) => [-1.4, 1.4].forEach((ty) => lk.add(rbox(18.0, 0.75, 0.4, 0.16, 2, 0.78), bright, T(tx, 2.75 + ty, hdZ * 2 + 0.1))));
    // Chrome sportsfinder frame + HOLLOW chrome side eyelet pins + top release stud (zoom_01!)
    const sf = rrPath(-20.8, -20.8, 20.8, 20.8, 2.6); sf.holes.push(rrPath(-19.4, -19.4, 19.4, 19.4, 1.8, new THREE.Path()));
    lk.add(slab(sf, 0.65, 0.16, 20, 0.75, 2), bright, T(0, 5.35, hdZ, -Math.PI / 2, 0, 0));
    [-26.6, 26.6].forEach((rx) => {
      lk.add(revolve([[2.2, 0], [2.2, 0.55, 0.2], [1.1, 0.55]], { segs: 28 }), bright, T(rx, 5.45, hdZ, -Math.PI / 2, 0, 0));
      lk.add(new THREE.CircleGeometry(1.05, 18), intBlk, T(rx, 6.02, hdZ, -Math.PI / 2, 0, 0));
    });
    lk.add(revolve([[1.9, 0], [1.9, 0.6, 0.2], [0, 0.6]], { segs: 28 }), bright, T(0, 5.45, hdZ * 2 - 6.8, -Math.PI / 2, 0, 0));
    var hoodMeshes = lk.build(lid, 'finder');
    // Push-in square sportsfinder flap carrying authentic curved shield GW crest + inner 45° eye-level reflex mirror
    const fk3 = new Kit();
    fk3.add(rbox(38.4, 0.6, 38.4, 1.8, 3), leather, T(0, 0.2, 20.5));
    fk3.add(new THREE.PlaneGeometry(16.5, 16.5), lib.prepare(new THREE.MeshPhysicalMaterial({ map: diamondCrestTex(), transparent: true, alphaTest: 0.12, roughness: 0.22, metalness: 0.6 }), {}), T(0, 0.56, 20.5, -Math.PI / 2, 0, Math.PI));
    fk3.add(new THREE.PlaneGeometry(24.0, 24.0), lib.get('mirror'), T(0, -0.22, 20.5, Math.PI / 2, 0, 0));
    hoodMeshes.push(...fk3.build(sportsFlap, 'finder'));
    lid.add(sportsFlap);
  }
  // Authentic smooth satin-black anodized metal hood walls (zoom_01, zoom_02, zoom_03!)
  const hoodMetal = lib.prepare(new THREE.MeshPhysicalMaterial({ name: 'rolleiHoodMetal', color: 0x131417, metalness: 0.34, roughness: 0.44, clearcoat: 0.18, clearcoatRoughness: 0.38 }), {});
  // Authentic Rear Hood Wall with full-width sweeping dome arch, raised sportsfinder peephole & circular eye-level magnifier (leans BACK +7.2° when open!)
  const rearWall = new THREE.Group(); rearWall.position.set(0, 8.6, 30.0);
  {
    const rk = new Kit();
    const rwS = new THREE.Shape();
    rwS.moveTo(-30.5, 0); rwS.lineTo(30.5, 0); rwS.lineTo(30.5, 39.0);
    rwS.bezierCurveTo(30.5, 45.8, 18.5, 49.0, 0, 49.4);
    rwS.bezierCurveTo(-18.5, 49.0, -30.5, 45.8, -30.5, 39.0);
    rwS.closePath();
    rwS.holes.push(rrPath(-5.2, 26.0, 5.2, 36.4, 1.2, new THREE.Path()));
    rk.add(slab(rwS, 1.8, 0.4, 28, 0.45, 3), hoodMetal, T(0, 0, -0.9));
    const phS = new THREE.Shape();
    phS.moveTo(-11.4, 4.0); phS.lineTo(-11.4, 38.0);
    phS.quadraticCurveTo(-11.4, 42.2, 0, 42.8);
    phS.quadraticCurveTo(11.4, 42.2, 11.4, 38.0);
    phS.lineTo(11.4, 4.0);
    phS.quadraticCurveTo(11.4, 2.0, 9.2, 2.0);
    phS.lineTo(-9.2, 2.0);
    phS.quadraticCurveTo(-11.4, 2.0, -11.4, 4.0);
    phS.holes.push(rrPath(-5.2, 26.0, 5.2, 36.4, 1.2, new THREE.Path()));
    rk.add(slab(phS, 2.2, 0.4, 24, 0.45, 3), hoodMetal, T(0, 0, 0.4));
    rk.add(revolve([[6.2, 0], [6.2, 1.3, 0.25], [5.4, 1.3]], { segs: 40 }), anod, T(0, 12.2, 2.2));
    // Authentic dark coated optical eye-level focus-check magnifier glass (cmp_03 left!)
    rk.add(new THREE.CircleGeometry(5.35, 36), lib.prepare(new THREE.MeshPhysicalMaterial({ color: 0x0c1018, roughness: 0.04, metalness: 0.14, clearcoat: 1.0, clearcoatRoughness: 0.04 }), {}), T(0, 12.2, 2.7));
    [-22.2, 22.2].forEach((bx) => rk.add(rbox(10.5, 22.0, 1.6, 0.65, 2), hoodMetal, T(bx, 11.5, 1.0)));
    hoodMeshes.push(...rk.build(rearWall, 'finder'));
  }
  // Authentic BACKWARD-SLANTED (+7.2°) Two-Leaf Corrugated Folding Side Walls matching lid & rearWall tilt (zoom_01, zoom_02, zoom_03!)
  const buildSideWall = (xPos) => {
    const g = new THREE.Group(); g.position.set(xPos, 8.6, 0);
    const wk = new Kit();
    // slab rotated ry=-PI/2 maps shape (sx, sy) -> local (z = sx, y = sy): +sx is REAR (+Z), -sx is FRONT (-Z)!
    const dzR = hoodShearZ(41.0), dzF = hoodShearZ(54.0);
    const sw = new THREE.Shape();
    sw.moveTo(-30.0, 0);
    sw.lineTo(30.0, 0);
    sw.lineTo(30.0 + dzR, 41.0);
    sw.quadraticCurveTo(30.0 + hoodShearZ(44.5), 44.5, 26.2 + hoodShearZ(45.2), 45.2);
    sw.bezierCurveTo(10.0 + hoodShearZ(48.0), 48.0, -10.0 + hoodShearZ(51.6), 51.6, -26.2 + hoodShearZ(53.6), 53.6);
    sw.quadraticCurveTo(-30.0 + dzF, 54.0, -30.0 + hoodShearZ(50.4), 50.4);
    sw.closePath();
    wk.add(slab(sw, 1.4, 0.3, 24, 0.4, 3), hoodMetal, T(0.7, 0, 0, 0, -Math.PI / 2, 0));
    // Backward-slanted (+7.2°) central folding-leaf vertical hinge seam + 22 crisp horizontal metal corrugation ribs!
    wk.add(revolve([[1.15, 0], [1.15, 49.0]], { segs: 24 }), bk, T(0, 0, 0, -Math.PI / 2 + HOOD_SLANT, 0, 0));
    for (let y = 3.0; y <= 41.5; y += 1.8) {
      wk.add(rbox(1.9, 0.55, 56.2, 0.14, 2), hoodMetal, T(0, y, hoodShearZ(y)));
    }
    hoodMeshes.push(...wk.build(g, 'finder'));
    return g;
  };
  const leftWall = buildSideWall(-31.2);
  const rightWall = buildSideWall(31.2);

  // Lid-parented 4.5× focusing magnifier (k7f_a_10, k7f_b_07: matte-black circular bezel + glass loupe, folds inside lid!)
  const mag = new THREE.Group(); mag.position.set(0, 1.4, 44.0);
  const magView = new THREE.Mesh(prep(new THREE.CircleGeometry(15.5, 48)), lib.prepare(new THREE.MeshBasicMaterial({ map: defaultScreenTex, color: 0xffffff, toneMapped: false, side: THREE.DoubleSide }), {}));
  magView.rotation.x = -Math.PI / 2; magView.position.set(0, 0, -24.0); magView.userData.noShadow = true;
  {
    const mk = new Kit();
    const mf = rrPath(-20, -40, 20, 3, 3); mf.holes.push(new THREE.Path().absarc(0, -24, 15.8, 0, TAU, true));
    mk.add(slab(mf, 1.6, 0.35, 24), anod, T(0, 0, 0, Math.PI / 2, 0, 0));
    mk.add(revolve([[17.4, -1.1], [17.4, 1.1, 0.35], [15.4, 1.3]], { segs: 48 }), bk, T(0, 0, -24.0, -Math.PI / 2, 0, 0));
    mk.build(mag, 'finder');
  }
  mag.add(magView);
  lid.add(mag);
  hoodMount.add(lid, rearWall, leftWall, rightWall);

  return {
    core, backDoor: backDoorPivot, latchPivot, hingeZ, board, screenG, hoodMount, lid, sportsFlap, rearWall, leftWall, rightWall, mag, magView,
    knob, knobBase, meterPod, meterNeedle, followPointer, dofLeft, dofRight, dofBandCv, dofBandTex,
    asaDialGroup, filterRing, asaCv, asaTex, spoolKnobs, supplySpool, takeupSpool, filmWeb, filmTex, rearBlades,
    crank, crankArmPivot, crankHandle, release, selfTimerLever, apWheel, shWheel, takeGlass, viewGlass, inner, rolleinarGroup, hoodGroup, filterGroup,
    takeGlassU, viewGlassU, screenMat, screenOverlay, parallaxMask, filterMat, ctrCv, ctrTex, evCv, evTex,
    ensureInner, ensureRolleinar, ensureHood, ensureFilter,
    focusMeshes, apertureMeshes, shutterMeshes, crankMeshes, releaseMeshes, hoodMeshes, filterMeshes,
  };
}

// ───────── The Camera Factory ─────────
const PARTS = ['focus', 'aperture', 'shutter', 'filter', 'crank', 'release', 'finder', 'aim', 'roll'];

export function createCameraRolleiflex({ lens }) {
  const t0 = performance.now();
  const clipPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 1e7);
  const base = baseMaterials();
  base.blackEnamel = new THREE.MeshPhysicalMaterial({ name: 'rolleiBlackEnamel', color: 0x09090b, metalness: 0.32, roughness: 0.13, clearcoat: 0.94, clearcoatRoughness: 0.09 });
  base.blackEnamel.userData.wear = 'blackChrome';
  base.chromeBright = new THREE.MeshPhysicalMaterial({ name: 'rolleiMirrorChrome', color: 0xeaebef, metalness: 0.96, roughness: 0.10, roughnessMap: brushedMap(), anisotropy: 0.22, anisotropyRotation: Math.PI / 2, clearcoat: 0.45, clearcoatRoughness: 0.07 });
  base.chromeBright.userData.wear = 'chrome';
  // Ultra-flat velvety dead-black anti-reflection interior paint (specularIntensity=0 kills overhead Fresnel grey glare completely! zoom_10, zoom_11!)
  base.interiorBlack = new THREE.MeshPhysicalMaterial({ name: 'rolleiInteriorBlack', color: 0x020203, metalness: 0.0, roughness: 0.98, specularIntensity: 0.0, envMapIntensity: 0.04 });
  base.palpas = new THREE.MeshPhysicalMaterial({ name: 'rolleiPalpasFlatBlack', color: 0x020203, metalness: 0.0, roughness: 0.98, specularIntensity: 0.0, envMapIntensity: 0.04 });
  const lib = new MatLib(base, [clipPlane]);
  const hov = {};
  PARTS.forEach((name) => { hov[name] = { name, amount: { value: 0 }, color: { value: new THREE.Color(1.0, 0.82, 0.5).multiplyScalar(0.28) }, target: 0 }; });

  const root = new THREE.Group();
  root.name = 'camera503';
  root.userData.kind = 'rolleiflex';
  const tripod = buildTripod(lib, DIM.tripod);
  root.add(tripod.group);
  const head = buildHead(lib, hov);
  const yaw = new THREE.Group(); yaw.position.y = tripod.top; yaw.add(head.yawMM);
  const pitch = new THREE.Group(); pitch.position.y = head.pitchY; pitch.add(head.pitchMM); yaw.add(pitch);
  const rollG = new THREE.Group(); rollG.position.y = head.rollY; head.rollMM.position.y = -head.rollY; rollG.add(head.rollMM); pitch.add(rollG);
  root.add(yaw);
  const mm = new THREE.Group(); mm.scale.setScalar(0.001); rollG.add(mm);

  let curLens = lens;
  const R = buildRolleiBody(lib, hov, curLens);
  mm.add(R.core, R.backDoor, R.board, R.screenG, R.hoodMount);
  mm.position.set(-DIM.socket.x / 1000, (head.plateTop - (B.y0 - 2.65)) / 1000 - head.rollY, -DIM.socket.z / 1000);

  const blobCv = canvas(128, 128), bg = blobCv.getContext('2d'), grad = bg.createRadialGradient(64, 64, 2, 64, 64, 64);
  grad.addColorStop(0, 'rgba(0,0,0,0.42)'); grad.addColorStop(0.5, 'rgba(0,0,0,0.16)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
  bg.fillStyle = grad; bg.fillRect(0, 0, 128, 128);
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(blobCv), transparent: true, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2; blob.position.y = 0.012; blob.renderOrder = -1; blob.userData.noShadow = true;
  root.add(blob);

  const dyn = new Set([
    mm, R.core, R.backDoor, R.latchPivot, R.board, R.screenG, R.hoodMount, R.lid, R.sportsFlap, R.rearWall, R.leftWall, R.rightWall, R.mag, R.magView,
    R.knob, R.knobBase, R.meterPod, R.meterNeedle, R.followPointer, R.dofLeft, R.dofRight,
    R.asaDialGroup, R.filterRing, R.spoolKnobs, R.supplySpool, R.takeupSpool, R.filmWeb, ...R.rearBlades,
    R.crank, R.crankArmPivot, R.crankHandle, R.release, R.selfTimerLever, R.apWheel, R.shWheel, R.takeGlass, R.viewGlass, R.inner, R.rolleinarGroup, R.hoodGroup, R.filterGroup, R.screenOverlay, R.parallaxMask,
    head.yawMM, head.pitchMM, head.rollMM, head.bubble, blob,
  ]);
  mergeStaticRigid(root, { dynamic: dyn, lists: [R.focusMeshes, R.apertureMeshes, R.shutterMeshes, R.crankMeshes, R.releaseMeshes, R.hoodMeshes, R.filterMeshes, head.aimMeshes, head.rollMeshes] });
  const toLayer = (obj) => obj.traverse((o) => { if (!o.isMesh) return; o.layers.set(1); o.castShadow = !o.userData.noShadow && !o.material.transparent; o.receiveShadow = !o.userData.noShadow; });
  toLayer(root);

  const pickables = {
    focus: R.focusMeshes, aperture: R.apertureMeshes, shutter: R.shutterMeshes, filter: R.filterMeshes,
    crank: R.crankMeshes, release: R.releaseMeshes, finder: R.hoodMeshes, aim: head.aimMeshes, roll: head.rollMeshes,
  };

  // Authentic TLR Synchro-Compur Leaf Shutter state: CLOSED (leafK = 0) at rest & after cocking — opens ONLY during exposure!
  const st = {
    focusRot: 0, focusT: 0, ext: 0, extT: 0, apRot: 0, apT: 0, shRot: 0, shT: 0,
    focusM: 10000, iso: 400, shutterSec: 1 / 125, sceneEv: 12,
    finderK: 0, magK: 0, sportsK: 0, hoodOff: 0, crank: 0, crankOpen: 0, press: 0, leafK: 0, selfTimerK: 0, xmSync: 0,
    doorK: 0, filmLoaded: true, filmPhase: 0, ctr: null,
    hoodOn: false, filterId: 'none', polAngle: 90, explodeK: 0, snapRings: true,
  };
  const tweens = [];
  const tween = (dur, fn, ease = easeInOut, key = null) => new Promise((res) => tweens.push({ t: 0, dur: Math.max(1e-3, dur), fn, ease, key, res }));
  const hold = (ms) => tween(Math.max(1e-3, ms / 1000), () => {}, (u) => u);
  const animate = (key, to, dur, ease) => {
    for (let i = tweens.length - 1; i >= 0; i--) if (tweens[i].key === key) { const [tw] = tweens.splice(i, 1); tw.res(); }
    const from = st[key];
    return tween(dur, (k) => { st[key] = lerp(from, to, k); }, ease, key);
  };

  let live = null, frameKey = -1, evKey = '', asaKey = '', dofKey = '';
  function ringTargets(s) {
    const d = Math.max(s.focus ?? 10000, curLens.minFocusDistance);
    st.focusM = d;
    st.focusT = d >= 9999 ? 0 : focusAngle(curLens, d);
    st.extT = helicoidExtensionMm(curLens, d);
    const ap = curLens.apertureStops, last = ap.length - 1;
    let N = typeof s.aperture === 'number' && s.aperture > 0 ? s.aperture : ap[0];
    N = Math.min(ap[last], Math.max(ap[0], N));
    let ai = last;
    for (let i = 0; i < last; i++) if (N <= ap[i + 1]) { ai = i + Math.log(N / ap[i]) / Math.log(ap[i + 1] / ap[i]); break; }
    st.apT = ai * AP_STEP;
    st.shT = ((s.shutterIdx ?? 7) + 1) * SH_STEP;
    st.shutterSec = s.shutter || 1 / 125;
    if (typeof s.iso === 'number' && s.iso > 0) st.iso = s.iso;
    if (s.hoodOn !== undefined) st.hoodOn = Boolean(s.hoodOn);
    if (s.filter !== undefined) st.filterId = (typeof s.filter === 'string' ? s.filter : s.filter?.id) || 'none';
    if (s.polAngle !== undefined) st.polAngle = s.polAngle ?? 90;
  }
  function drawDisplays(s) {
    const fr = Math.max(1, Math.min(12, Math.round(st.ctr ?? s?.frame ?? 1)));
    if (fr !== frameKey) {
      frameKey = fr;
      const g = R.ctrCv.getContext('2d');
      // Authentic K7F black counter wheel with crisp white numeral inside countersunk chrome eyelet (cmp_03 left!)
      g.fillStyle = '#0e0f12'; g.fillRect(0, 0, 128, 128);
      g.fillStyle = '#f2f1ea'; g.font = `600 66px ${ROLLEI_FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(String(fr), 64, 68);
      R.ctrTex.needsUpdate = true;
    }
    const isBulb = (s.shutterIdx ?? 7) < 0;
    const shSec = s.shutter || 1 / 125;
    const shLbl = isBulb ? (shSec >= 2 ? `${Math.round(shSec)}` : 'B') : (shSec >= 1 ? `${Math.round(shSec)}` : `${Math.round(1 / shSec)}`);
    const ap = curLens.apertureStops;
    const curAp = Number(s.aperture || 2.8);
    let bestI = 0;
    ap.forEach((v, i) => { if (Math.abs(v - curAp) < Math.abs(ap[bestI] - curAp)) bestI = i; });
    const fmtAp = (v) => (v == null ? '' : (v < 10 ? v.toFixed(1) : String(Math.round(v))).replace('.0', '').replace('.', ','));
    const apPrev = fmtAp(ap[bestI - 1]), apMid = fmtAp(ap[bestI]), apNext = fmtAp(ap[bestI + 1]);
    const k = `${shLbl}_${apMid}_${isBulb}`;
    if (k !== evKey) {
      evKey = k;
      const g = R.evCv.getContext('2d');
      // Exact Manual p.14 peep window (upright from photographer's waist-level POV):
      // Front/upper silver strip = 3 scrolling f-stops (e.g., 5,6 | 8 | 11) with "f:" + arrow on left;
      // Rear/lower silver window = shutter speed in RED (1/500..1s) or GREEN (time exposures >1s / B) with "t" on right!
      g.fillStyle = '#0c0d10'; g.fillRect(0, 0, 256, 144);
      g.fillStyle = '#eceee8'; g.font = `400 32px ${ROLLEI_FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('f:', 32, 42);
      g.fillText('t', 224, 104);
      // Tiny pointer triangle beside f:
      g.beginPath(); g.moveTo(46, 36); g.lineTo(58, 42); g.lineTo(46, 48); g.closePath(); g.fill();
      // Upper wide silver aperture window showing prev / active / next f-stop
      g.fillStyle = '#eae8e0';
      g.fillRect(66, 16, 132, 50);
      g.fillStyle = '#6c7076'; g.font = `500 24px ${ROLLEI_FONT}`;
      if (apPrev) g.fillText(apPrev, 88, 43);
      if (apNext) g.fillText(apNext, 176, 43);
      g.fillStyle = '#121316'; g.font = `600 34px ${ROLLEI_FONT}`;
      g.fillText(apMid, 132, 43);
      // Lower centered silver shutter speed window: RED for 1/500..1s, GREEN for B / time exposures (Manual p.14!)
      g.fillStyle = '#eae8e0';
      g.fillRect(88, 78, 88, 50);
      g.fillStyle = isBulb ? '#23783b' : '#c82a20';
      g.font = `600 36px ${ROLLEI_FONT}`;
      g.fillText(shLbl, 132, 105);
      R.evTex.needsUpdate = true;
    }
    const fStops = FILTER_STOPS[st.filterId] ?? filterOpticsFor(st.filterId)?.stops ?? 0;
    const ak = `${Math.round(st.iso)}_${fStops.toFixed(1)}`;
    if (ak !== asaKey) {
      asaKey = ak;
      drawAsaDial(R.asaCv, st.iso, fStops);
      R.asaTex.needsUpdate = true;
    }
  }

  let cutaway = false;
  function applyPose() {
    const e = easeInOut(st.explodeK);
    const f = st.finderK;
    // Authentic Rolleiflex 2.8F +7.2° BACKWARD-SLANTED open waist-level hood (front lid & rear wall lean smoothly toward photographer — zoom_01, zoom_02, zoom_03!)
    const hoodSlant = 7.2 * DEG;
    R.lid.rotation.x = -(Math.PI / 2 - hoodSlant) * easeOutBack(phase(f, 0, 0.45));
    // Sportsfinder panel clicks INWARD (+0.92 rad inside lid!) so its inner mirror reflects the ground glass to the circular eye-level magnifier (Manual p.22!)
    R.sportsFlap.rotation.x = 0.92 * easeInOut(st.sportsK);
    const pW = phase(f, 0.28, 0.78);
    R.rearWall.rotation.x = lerp(-Math.PI / 2, hoodSlant, easeOutBack(pW));
    R.leftWall.rotation.z = -(Math.PI / 2) * (1 - easeOutBack(pW));
    R.rightWall.rotation.z = (Math.PI / 2) * (1 - easeOutBack(pW));
    R.mag.visible = f > 0.25;
    R.mag.rotation.x = -(Math.PI / 2) * easeOutBack(st.magK);
    R.release.position.z = DIM.boardZ - 0.8 + 1.8 * st.press;
    // M/X/V sync & self-timer lever: xmSync (-0.35 = X, 0 = M) + selfTimerK (V countdown sweep)
    R.selfTimerLever.rotation.z = -0.42 + 0.32 * (st.xmSync || 0) + 0.65 * st.selfTimerK;

    // Exact thin-lens optical focal length & mechanical front-board rack travel
    const fCal = lensOpticsFor(curLens).focalCalMm || 80.2;
    const physExt = curLens.rolleinar ? Math.max(0, Math.min(8.801, st.ext - (80.2 - fCal) * 0.85)) : st.ext;
    R.board.position.z = -physExt - 58 * e;
    R.backDoor.position.z = R.hingeZ + 44 * e;
    R.backDoor.rotation.x = -st.doorK * 2.02;
    R.latchPivot.rotation.x = st.doorK * 1.35; // bottom chrome lock tab unfolds cleanly as door opens!
    R.spoolKnobs.position.x = -3.8 * st.doorK;
    R.hoodMount.position.y = DIM.screenY + 55 * e + 52 * (st.hoodOff || 0);
    R.screenG.position.y = DIM.screenY + 26 * e;
    // ONLY the focusing drum & 48-flute chrome grip rotate — stationary meter pod & DoF collar remain upright!
    R.knob.rotation.x = st.focusRot;
    R.apWheel.rotation.z = st.apRot;
    R.shWheel.rotation.z = st.shRot;
    // Exact 2.8F booklet crank kinematics: one forward-and-back swing advances 120 film, increments counter, and cocks the shutter!
    R.crank.rotation.x = st.crank * TAU;
    R.crankArmPivot.rotation.z = 0.16 * st.crankOpen;
    R.crankHandle.rotation.z = -(Math.PI / 2) * st.crankOpen;

    // Filter-factor outer fluted ring rotation on lower-rear ASA/DIN dial (Manual p.27 & p.34!)
    const filterStops = FILTER_STOPS[st.filterId] ?? filterOpticsFor(st.filterId)?.stops ?? 0;
    R.filterRing.rotation.x = filterStops * 0.34;

    // Live taking-lens iris, TRUE thin-lens optically-coupled CONTINUOUS WHITE DoF BAND & Gossen selenium match-needle!
    const ap = curLens.apertureStops, ai = Math.min(ap.length - 1, Math.max(0, st.apRot / AP_STEP)), i0 = Math.min(ap.length - 2, Math.floor(ai));
    const N = ap[i0] * Math.pow(ap[i0 + 1] / ap[i0], ai - i0), rIris = fCal / (2 * N);
    // Exact optical DoF spread mapped through FOCUS_PITCH around the 12-o'clock index (0.05 mm CoC for 6×6 — Manual p.16–17!)
    const dofRefM = Math.min(Math.max(st.focusM, curLens.minFocusDistance), 30);
    const dof = dofLimits(dofRefM, fCal, N, 0.05);
    const extHere = helicoidExtensionMm(curLens, dofRefM);
    const extNear = helicoidExtensionMm(curLens, Math.max(curLens.minFocusDistance * 0.5, dof.near));
    const extFar = Number.isFinite(dof.far) ? helicoidExtensionMm(curLens, dof.far) : 0;
    const nearAng = Math.min(1.05, Math.max(0.06, FOCUS_PITCH * Math.max(0.08, extNear - extHere)));
    const farAng = Math.min(1.05, Math.max(0.06, FOCUS_PITCH * Math.max(0.08, extHere - extFar)));
    const dofHalf = Math.min(1.04, Math.max((nearAng + farAng) * 0.5, FOCUS_PITCH * N * 0.05 * 2.1));
    R.dofLeft.rotation.x = -dofHalf;
    R.dofRight.rotation.x = dofHalf;
    const dk = dofHalf.toFixed(3);
    if (dk !== dofKey) {
      dofKey = dk;
      drawDofBand(R.dofBandCv, dofHalf, dofHalf);
      R.dofBandTex.needsUpdate = true;
    }

    // Coupled Gossen exposure meter: black needle tracks scene EV; circular follow-pointer tracks (aperture, shutter, ISO, filter factor)!
    const camEv100 = Math.log2((N * N) / Math.max(1 / 2000, st.shutterSec)) - Math.log2(st.iso / 100) + filterStops;
    const evToAngle = (ev) => Math.max(-0.68, Math.min(0.68, ((ev - 11) / 7) * 0.65));
    R.meterNeedle.rotation.x = evToAngle(st.sceneEv);
    R.followPointer.rotation.x = evToAngle(camEv100);

    // Rotating 120 spools & scrolling 120 backing paper web (driven ONLY on forward clockwise half of crank stroke!)
    R.takeupSpool.rotation.x = -st.filmPhase * TAU;
    R.supplySpool.rotation.x = -st.filmPhase * 0.85 * TAU;
    R.filmTex.offset.y = -st.filmPhase * 0.42;
    const show120 = Boolean(st.filmLoaded);
    R.supplySpool.visible = show120;
    R.takeupSpool.visible = show120;
    R.filmWeb.visible = show120;

    // Exact mathematical TLR parallax mask shift on 56×56 ground glass: rear edge starts flush under front bezel (-DIM.screen/2) at ∞ -> masks 5.0809 mm at 0.9 m with ZERO front gap!
    const parallaxShift = curLens.rolleinar ? (physExt / 80.2) * DIM.viewY * 0.25 : (st.ext / fCal) * DIM.viewY;
    R.parallaxMask.position.z = -DIM.screen / 2 - 3.0 + parallaxShift;

    R.takeGlassU.optics.value.set(rIris, st.leafK, 15.4, 12.6);
    R.takeGlassU.state.value.set((1 - Math.min(1, rIris / 15)) * 0.5, 1.0, physExt, e);
    R.viewGlassU.state.value.set(0.18, 1.0, physExt, e);
    // 5 curved overlapping blued-steel crescent Compur blades (0 = 100% light-tight closed at rest; 0.78 rad = open during exposure!)
    const bladeAngle = lerp(0.0, 0.78, st.leafK * Math.min(1, rIris / 14.3));
    R.rearBlades.forEach((b, i) => { b.rotation.z = (i / 5) * TAU + bladeAngle; });

    if (cutaway && R.ensureInner()) toLayer(R.inner);
    R.inner.visible = cutaway;
    const rolLv = curLens.rolleinar || 0;
    if (rolLv > 0 && R.ensureRolleinar(rolLv)) toLayer(R.rolleinarGroup);
    R.rolleinarGroup.visible = rolLv > 0;
    if (st.hoodOn && R.ensureHood()) toLayer(R.hoodGroup);
    R.hoodGroup.visible = Boolean(st.hoodOn);
    if (st.filterId !== 'none' && R.ensureFilter()) toLayer(R.filterGroup);
    R.filterGroup.visible = st.filterId !== 'none';
    if (R.filterGroup.visible) {
      const tint = filterOpticsFor(st.filterId)?.ggTint || [1, 1, 1];
      R.filterMat.color.setRGB(Math.min(1, tint[0]), Math.min(1, tint[1]), Math.min(1, tint[2]));
      R.filterGroup.rotation.z = st.filterId === 'polarizer' ? (st.polAngle ?? 90) * DEG : 0;
    }
  }

  function setCutaway(on) {
    cutaway = on;
    if (!on) clipPlane.set(new THREE.Vector3(0, 1, 0), 1e7);
    else if (R.ensureInner()) toLayer(R.inner);
    R.inner.visible = cutaway;
  }

  const anchor = (parent, x, y, z, text, sub, matchRoot) => { const o = new THREE.Object3D(); o.position.set(x, y, z); parent.add(o); return { o, text, sub, matchRoot }; };
  const labels = [
    anchor(R.board, 0, DIM.viewY + 12, DIM.boardZ - 14, 'Heidosmat 80 mm ƒ/2.8', 'upper viewing lens · matched TLR viewing axis', R.board),
    anchor(R.board, 0, DIM.takeY - 12, DIM.boardZ - 14, 'Planar 80 mm ƒ/2.8 · Synchro-Compur', '5-element taking lens · closed-at-rest leaf shutter', R.board),
    anchor(R.knobBase, -24, 6, 0, 'Focusing Knob, DoF Band & Exposure Meter', 'rotating distance drum · stationary coupled selenium meter', R.knob),
    anchor(R.asaDialGroup, -12, 0, 0, 'ASA/DIN & Filter-Factor Dial', 'lower-rear film speed & filter stop compensation', R.asaDialGroup),
    anchor(R.crank, 18, -12, 0, 'Advance & Cocking Crank', 'forward-and-back swing advances 120 film, increments counter & cocks shutter', R.crank),
    anchor(R.hoodMount, 0, 32, 0, 'Waist-Level Hood & Sportsfinder', 'parallax-compensated Rolleiclear screen + flip-up focusing magnifier', R.hoodMount),
    anchor(R.backDoor, 0, -64, 4, 'One-Piece L-Back & Automatik Rollers', 'bottom-front supply spool feeds through twin feeler rollers', R.backDoor),
  ];
  let labelEls = null;

  const tmpQ = new THREE.Quaternion();
  const api = {
    root, parts: { mm, body: R }, opticsMoving: false, cutSide: 1, labelFocus: -1, pickables, buildMs: 0, st, timeScale: 1, applyPose,
    setAim(pan, tilt, roll = 0) { yaw.rotation.y = -Math.PI / 2 + pan; pitch.rotation.x = tilt; rollG.rotation.z = roll; root.updateMatrixWorld(true); },
    bodyCenter(v) { return mm.localToWorld(v.set(0, 22, -28)); },
    worldToBody(v) { return mm.worldToLocal(v); },
    /** Assign a viewing texture to the Rolleiclear screen (grid & split-image wedge persist on overlay). `brightness` scales un-tonemapped luminance (default 0.84; raise under dark studio exposures). */
    setScreenTexture(tex, brightness = 0.84) {
      R.screenMat.map = tex; R.screenMat.color.setScalar(brightness); R.screenMat.needsUpdate = true;
      R.magView.material.map = tex; R.magView.material.color.setScalar(brightness); R.magView.material.needsUpdate = true;
    },
    setLoupeTexture(tex, brightness = 0.86) {
      R.magView.material.map = tex; R.magView.material.color.setScalar(brightness); R.magView.material.needsUpdate = true;
    },
    /** Deterministic time-parametric crank stroke pose for k in [0..1]: unfolds handle, advances film + increments counter on forward half, returns to cock shutter, folds flat. */
    crankPose(k, { startPhase = 0, startFrame = null, doubleExpose = false } = {}) {
      const u = Math.max(0, Math.min(1, k));
      if (doubleExpose) {
        st.crankOpen = u < 0.16 ? easeInOut(u / 0.16) : u > 0.84 ? easeInOut((1 - u) / 0.16) : 1;
        const sw = Math.max(0, Math.min(1, (u - 0.16) / 0.68));
        st.crank = -1.0 * easeInOut(sw);
      } else {
        st.crankOpen = u < 0.14 ? easeInOut(u / 0.14) : u > 0.86 ? easeInOut((1 - u) / 0.14) : 1;
        if (u <= 0.14) { st.crank = 0; st.filmPhase = startPhase; }
        else if (u <= 0.56) {
          const fw = easeInOut((u - 0.14) / 0.42);
          st.crank = 0.62 * fw;
          st.filmPhase = startPhase + fw;
          if (startFrame != null) st.ctr = startFrame + (fw >= 0.85 ? 1 : 0);
        } else if (u <= 0.86) {
          const bk = easeInOut((u - 0.56) / 0.30);
          st.crank = 0.62 * (1 - bk);
          st.filmPhase = startPhase + 1;
          if (startFrame != null) st.ctr = startFrame + 1;
        } else {
          st.crank = 0; st.filmPhase = startPhase + 1;
          if (startFrame != null) st.ctr = startFrame + 1;
        }
      }
      st.leafK = 0;
      if (startFrame != null) drawDisplays(live || { frame: st.ctr });
      applyPose();
    },
    setFinderOpen(on) { return animate('finderK', on ? 1 : 0, 0.55); },
    setMagnifier(up) { return animate('magK', up ? 1 : 0, 0.35); },
    setSportsfinder(on) { return animate('sportsK', on ? 1 : 0, 0.30); },
    setSelfTimer(on) { return animate('selfTimerK', on ? 1 : 0, 0.25); },
    get magnifierUp() { return st.magK > 0.5; },
    lookDownPose() {
      const q = rollG.getWorldQuaternion(new THREE.Quaternion());
      const target = mm.localToWorld(new THREE.Vector3(0, DIM.screenY, DIM.screenZ));
      const eye = mm.localToWorld(new THREE.Vector3(0, DIM.screenY + 185, DIM.screenZ + 18));
      const up = new THREE.Vector3(0, 0, -1).applyQuaternion(q);
      return { eye, target, up };
    },
    setRings(s) {
      live = s; ringTargets(s); drawDisplays(s);
      if (st.snapRings) { st.focusRot = st.focusT; st.ext = st.extT; st.apRot = st.apT; st.shRot = st.shT; st.snapRings = false; }
    },
    setHood(on) { st.hoodOn = Boolean(on); if (live) live.hoodOn = st.hoodOn; if (st.hoodOn && R.ensureHood()) toLayer(R.hoodGroup); R.hoodGroup.visible = st.hoodOn; },
    setFilter(filterId, polAngle = st.polAngle) { st.filterId = filterId || 'none'; st.polAngle = polAngle; if (live) { live.filter = st.filterId; live.polAngle = polAngle; } if (st.filterId !== 'none' && R.ensureFilter()) toLayer(R.filterGroup); },
    get hoodOn() { return Boolean(st.hoodOn); },
    get hasHood() { return true; },
    filmOffset() {
      const ep = lensOpticsFor(curLens).entrancePupilMm || 22;
      return mm.localToWorld(new THREE.Vector3(0, DIM.takeY, DIM.boardZ - 11 - st.ext + ep)).distanceTo(mm.localToWorld(new THREE.Vector3(0, 0, 0)));
    },
    lensPose(pos, quat) {
      const ep = lensOpticsFor(curLens).entrancePupilMm || 22;
      pos.copy(mm.localToWorld(new THREE.Vector3(0, DIM.takeY, DIM.boardZ - 11 - st.ext + ep)));
      rollG.getWorldQuaternion(quat);
    },
    // Exact CONTRACT.md lens axis pointing forward along -Z in world space!
    ringAxisWorld(target = new THREE.Vector3()) { return target.set(0, 0, -1).applyQuaternion(mm.getWorldQuaternion(tmpQ)).normalize(); },
    ringAngle(part) {
      if (part === 'focus') return -st.focusT;
      if (part === 'aperture') return st.apT;
      if (part === 'shutter') return st.shT;
      return 0;
    },
    ringValueAt(part, angle) {
      if (part === 'focus') return distanceAt(curLens, angle);
      if (part === 'aperture') return Math.max(0, angle / AP_STEP);
      if (part === 'shutter') return angle / SH_STEP - 1;
      return 0;
    },
    setHover(part) { PARTS.forEach((p) => { hov[p].target = p === part ? 1 : 0; }); },
    setDoorOpen(on) { return animate('doorK', on ? 1 : 0, 0.55); },
    setFilmLoaded(on) { st.filmLoaded = Boolean(on); applyPose(); },
    async setExploded(on) { setCutaway(false); await animate('explodeK', on ? 1 : 0, 1.3); },
    async swapLens(next, onSwap) {
      curLens = next;
      onSwap();
      if (live) { ringTargets(live); st.focusRot = st.focusT; st.ext = st.extT; }
      applyPose();
    },
    async fire({ seconds = 1 / 125, side = 1, onExpose = () => {}, onSound = () => {}, cutaway: cut = false }) {
      api.cutSide = side;
      if (cut) setCutaway(true);
      await animate('press', 1, 0.08);
      if (st.selfTimerK > 0.2) await animate('selfTimerK', 0, 0.45);
      // Leaf shutter whispers open and shut — ZERO mirror blackout on a TLR!
      onSound('release');
      st.leafK = 1;
      await onExpose();
      await hold(Math.min(Math.max(seconds * 1000, 14), 2500));
      st.leafK = 0;
      onSound('close');
      await animate('press', 0, 0.08);
      // Authentic 2.8F booklet crank cycle: unfold grip OUTWARD (+X), one forward-and-back swing advances 120 film, increments counter & cocks shutter, then folds flat!
      onSound('wind');
      await animate('crankOpen', 1, 0.12);
      const startPhase = st.filmPhase;
      await tween(0.36, (k) => {
        st.crank = 0.62 * k;
        st.filmPhase = startPhase + k;
      }, easeInOut, 'wind');
      await animate('crank', 0.0, 0.26);
      st.leafK = 0;
      await animate('crankOpen', 0, 0.14);
      if (cut) setCutaway(false);
    },
    // Manual p.26: intentional double-exposure cocking — one full BACKWARD revolution (-1.0 turn) cocks shutter WITHOUT advancing 120 film!
    async doubleExposeCock({ onSound = () => {} } = {}) {
      onSound('wind');
      await animate('crankOpen', 1, 0.12);
      await tween(0.42, (k) => { st.crank = -1.0 * k; }, easeInOut, 'wind');
      st.crank = 0;
      st.leafK = 0;
      await animate('crankOpen', 0, 0.14);
    },
    setCutaway(on, side = 1) { api.cutSide = side; setCutaway(on); },
    labelAt(obj) {
      for (let o = obj; o; o = o.parent) {
        const idx = labels.findIndex((l) => l.matchRoot === o);
        if (idx >= 0) return idx;
      }
      return -1;
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
        n.classList.toggle('is-focus', api.labelFocus === i);
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
      if (live) { ringTargets(live); drawDisplays(live); }
      const a = 1 - Math.exp(-dt * 16);
      st.focusRot += (st.focusT - st.focusRot) * a;
      st.ext += (st.extT - st.ext) * a;
      st.apRot += (st.apT - st.apRot) * a;
      st.shRot += (st.shT - st.shRot) * a;
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
