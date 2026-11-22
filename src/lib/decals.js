// camera/lib/decals.js — The decal sheet: white marks on black, an alpha map for engraved and painted marks — the 503CX body's and magazine's legends and the head's panning scale (a new camera draws its own sheet).
// (moved verbatim from camera503.js in Phase 0: the modelling vocabulary every camera shares)
import * as THREE from 'three';
import { TEX, defer } from './textures.js';
import { FONT, TAU } from './util.js';

/** Decal atlas: white glyphs on black, used as alphaMap for engraved/painted marks. */
export function decalAtlas() {
  if (TEX.decal) return TEX.decal;
  const AS = globalThis.GW_ATLAS_SCALE || 1;
  const W = 2048, H = 1024, cv = document.createElement('canvas');
  cv.width = W * AS; cv.height = H * AS;
  const t = new THREE.CanvasTexture(cv);
  t.anisotropy = 16; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
  defer(() => { drawDecals(cv); t.needsUpdate = true; });
  const rect = (x, y, w, h) => ({ u0: x / W, v0: 1 - (y + h) / H, u1: (x + w) / W, v1: 1 - y / H });
  return (TEX.decal = {
    tex: t, W, H,
    chamfer: rect(0, 0, 1536, 128), plate: rect(1536, 0, 512, 128), twelve: rect(0, 128, 256, 128),
    filmPlane: rect(256, 128, 128, 128), pan: rect(0, 256, 2048, 64), iso: rect(0, 384, 512, 512), isoPlate: rect(512, 384, 1536, 512),
    magPlate: rect(384, 128, 1024, 128),
    maker: rect(0, 896, 1024, 66), bodySerial: rect(1024, 896, 1024, 102), magSerial: rect(1408, 128, 640, 80),
    insertNum: rect(0, 320, 128, 64),
  });
}

export function drawDecals(cv) {
  const W = 2048, H = 1024, g = cv.getContext('2d');
  g.save();
  g.scale(cv.width / W, cv.height / H);
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#fff'; g.strokeStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const spaced = (text, x, y, size, weight, spacing) => {
    g.font = `${weight} ${size}px ${FONT}`;
    if ('letterSpacing' in g) { g.letterSpacing = `${spacing}px`; g.fillText(text, x + spacing / 2, y); g.letterSpacing = '0px'; } else g.fillText(text, x, y);
  };
  // A: chamfer mark (1536×128 at 0,0)
  g.font = `italic 800 100px ${FONT}`; spaced('GLASS WORKS', 768, 70, 100, '800', 30);
  // B: model plate (512×128 at 1536,0)
  g.textAlign = 'right'; g.font = `italic 800 108px ${FONT}`; g.fillText('503', 1820, 70);
  g.textAlign = 'left'; g.font = `italic 700 72px ${FONT}`; g.fillText('GW', 1834, 80); g.textAlign = 'center';
  // C: "12" plate (256×128 at 0,128)
  spaced('12', 128, 194, 92, 700, 4);
  // D: film-plane mark (128×128 at 256,128)
  g.lineWidth = 9; g.beginPath(); g.arc(320, 192, 34, 0, TAU); g.stroke(); g.fillRect(262, 188, 116, 9);
  // F: tripod pan scale (2048×64 at 0,256): ticks every 5°, numbers every 30°
  for (let d = 0; d < 360; d += 5) {
    const x = (d / 360) * W, long = d % 30 === 0;
    g.fillRect(x - 2, 256, 4, long ? 34 : 18);
    if (long) { g.font = `600 24px ${FONT}`; g.fillText(String(d), x + (d === 0 ? 14 : 0), 304); }
  }
  // G: ISO dial (512×512 at 0,384): numbers around the rim
  const isos = ['25', '50', '100', '200', '400', '800', '1600', '12'];
  isos.forEach((t, i) => {
    const a = (i / isos.length) * TAU;
    g.save(); g.translate(256 + Math.sin(a) * 196, 640 - Math.cos(a) * 196); g.rotate(a);
    g.font = `700 52px ${FONT}`; g.fillText(t, 0, 0); g.restore();
  });
  g.beginPath(); g.arc(256, 640, 238, 0, TAU); g.lineWidth = 6; g.stroke();
  // I: the magazine's plate (1024×128 at 384,128, read along it): a circled "12", the maker, the film-plane mark
  g.lineWidth = 6; g.beginPath(); g.arc(1320, 192, 46, 0, TAU); g.stroke();
  g.font = `700 58px ${FONT}`; g.fillText('12', 1320, 196);
  g.font = `600 44px ${FONT}`; g.fillText('MADE BY', 900, 166); g.fillText('GLASS WORKS', 900, 218);
  g.lineWidth = 6; g.beginPath(); g.arc(470, 192, 22, 0, TAU); g.stroke(); g.fillRect(400, 189, 140, 6);
  // H: the ISO dial's plate (1536×512 at 512,384): a flash bolt, "64 • 100" following the dial's arc, "ISO"
  {
    const cx = 1280, cy = 384 + 1200, R = 1040;   // (the dial's centre, far below: the numbers sit on its arc)
    g.save(); g.translate(560, 470); g.beginPath(); g.moveTo(40, 0); g.lineTo(0, 92); g.lineTo(34, 92); g.lineTo(10, 176); g.lineTo(78, 64); g.lineTo(42, 64); g.lineTo(64, 0); g.closePath(); g.fill(); g.restore();
    [['64', -0.14], ['•', -0.035], ['100', 0.085]].forEach(([s, a]) => { g.save(); g.translate(cx + Math.sin(a) * R, cy - Math.cos(a) * R); g.rotate(a); g.font = `600 ${s === '•' ? 110 : 150}px ${FONT}`; g.fillText(s, 0, 0); g.restore(); });
    g.font = `600 150px ${FONT}`; g.fillText('ISO', 1880, 520);
  }
  // J: body & magazine engraved legends packed into free atlas bands (saves 4 bespoke 1024px textures + materials)
  spaced('MADE BY GLASS WORKS', 512, 896 + 36, 53, 500, 8);
  spaced('12GW00503', 1536, 896 + 55, 82, 500, 16);
  spaced('GW4120503', 1728, 128 + 43, 64, 500, 9.6);
  spaced('012', 64, 320 + 34, 42, 700, 2);
  g.restore();
}
