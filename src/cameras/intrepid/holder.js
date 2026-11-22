// A 4×5 double sheet-film holder with its two dark slides, as Intrepid's own holders look in its product photographs
// (scratch/ref-intrepid/full/Intrepid4x5Filmholders*.jpg; measurement only, never shipped): matte black and 3D-printed, a ribbed band
// across the slide's end with a white write-on label at each corner, ribbed rails down the sides, a hinged flap at the
// far end; each slide's pull tab has a slot and a row of seven holes, a bronze wire lock either side of it, and one face
// of each slide printed EXPOSED (turned out once that sheet is shot). No maker's mark.
//
// The numbers: SPEC.md "The film holder" (the standard's film depth, the photograph's proportions).
//
// The holder's own frame (mm): X along its length, the slide's end at +X; Y across; Z through it, side A's face at
// −T/2 and side B's at +T/2. Each sheet lies FILM below its own face.
import * as THREE from 'three';
import { rbox, rrPath, slab } from '../../lib/geometry.js';
import { Kit } from '../../lib/mesh.js';
import { FONT, T } from '../../lib/util.js';

export const HOLDER = {
  // the body: 120 wide, 177.5 long, 13.2 thick (14 over the ribs): Intrepid's jig, "HOLDER ASSY 188 × 120 × 14" with
  // the tab; the standard's 121 and 13.2 at most (ANSI PH3.108)
  L: 177.5, W: 120, T: 13.2,
  // the film plane below each face (ANSI PH1.37: 0.197 in) — the ground glass's ground face sits as far behind the
  // back's seat
  film: 5.0,
  // the raised layers on each face over the core (rails, the end band, the flap)
  skin: 1.0,
  // from the slide's end (the photograph, 0.1306 mm/px): the labels' strip 15 deep — a white label at each corner
  // 31.3 × 12.1, 1.6 in from the side and 2 from the end, seven ribs between them — then the ribbed band to 35 (13
  // ribs, a plain square 17 mm in its middle with a pale dot), then a plain strip to 39.5: the ridge that seats in the
  // back's light trap (the standard: its far side 141.3 from the flap end)
  band: 39.5, strip: 15, label: { w: 31.3, h: 12.1, inset: 1.6, from: 2 }, square: 17, ridge: { at: 37.7, w: 3, h: 0.4 },
  // the rails 11.2 wide, six ribs along each; the flap at the far end 13.5
  rail: 11.2, flap: 13.5,
  // the slide: 0.8 thick, 106 wide (97 of it showing between the rails), 166 long; its tab 30 wide, 10 out past the
  // end, a 23.8 × 5 slot 2.9 in from its edge and seven holes Ø 1.3 along the edge, 3 apart; a white dot on its EXPOSED
  // face by the tab
  slide: { t: 0.8, w: 106 }, tab: { w: 30, h: 10, slot: { w: 23.8, h: 5, from: 2.9 }, dots: 7, dotR: 0.65, dotFrom: 1.4, pitch: 3 },
  // the slide locks: bronze wire Ø 1 standing 3.9 off the end, 26.9 either side of the middle, bent out 8.5
  lock: { y: 26.9, up: 3.9, leg: 8.5, r: 0.5 },
};

const tex = (cv) => { const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
/** EXPOSED in white on a clear ground: 36 × 6 mm across the slide, its letters 4.6 mm high. */
function exposedTex() {
  const cv = document.createElement('canvas'); cv.width = 768; cv.height = 128;
  const g = cv.getContext('2d');
  g.fillStyle = '#f2f1ec'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `500 98px ${FONT}`;
  g.fillText('EXPOSED', 384, 68);
  return tex(cv);
}

/**
 * Build the holder. Returns { group, slides: [A, B] — each { group, out(k), turned } }.
 * Each slide's group sits at its face; out(k) slides it out along +X (k = 1: clear of the holder, in the hand), and
 * group.rotation.x = π shows its EXPOSED face out.
 */
export function buildHolder(lib) {
  const H = HOLDER, L = H.L, W = H.W, S = H.skin, half = H.T / 2;
  const group = new THREE.Group(); group.name = 'filmHolder';
  const plastic = lib.prepare(new THREE.MeshPhysicalMaterial({ name: 'holderBody', color: 0x111113, roughness: 0.62, metalness: 0, specularIntensity: 0.5, clearcoat: 0.05 }));
  const slideMat = lib.prepare(new THREE.MeshPhysicalMaterial({ name: 'holderSlide', color: 0x0d0d0f, roughness: 0.45, metalness: 0, specularIntensity: 0.6 }));
  const white = lib.get('white'), wire = lib.get('brass');
  const k = new Kit();
  // the core: the septum and the two sheets' wells, the skins' faces left proud on each side
  k.add(rbox(L, W, H.T - 2 * S, 0.8), plastic);
  const xBand = L / 2 - H.band, xFlap = -L / 2 + H.flap;
  for (const sg of [-1, 1]) {
    const z = sg * (half - S / 2), zTop = sg * half;
    const at = (x, y, zz, rx = 0) => T(x, y, zz, rx, 0, 0);
    // the rails, their five grooves along them
    for (const s of [-1, 1]) {
      const y = s * (W / 2 - H.rail / 2);
      k.add(rbox(xBand - xFlap, S, H.rail, 0.4).rotateX(Math.PI / 2), plastic, at((xBand + xFlap) / 2, y, z));
      for (let i = 0; i < 6; i++) k.add(rbox(xBand - xFlap - 3, 0.22, 0.6, 0.1).rotateX(Math.PI / 2), plastic, at((xBand + xFlap) / 2, y + (i - 2.5) * 1.6, zTop + sg * 0.09));
    }
    // the band across the slide's end: the labels' strip (seven ribs between the labels), the ribbed band (a plain
    // square in its middle, a pale dot in it), the plain strip with the ridge
    k.add(rbox(H.band, S, W, 0.4).rotateX(Math.PI / 2), plastic, at(L / 2 - H.band / 2, 0, z));
    const LB = H.label, labelX = L / 2 - LB.from - LB.h / 2, inner = W / 2 - LB.inset - LB.w - 1.5;
    for (let i = 0; i < 7; i++) k.add(rbox(0.6, 0.22, 2 * inner, 0.1).rotateX(Math.PI / 2), plastic, at(L / 2 - 2.2 - i * 1.65, 0, zTop + sg * 0.09));
    const sq = H.square / 2;
    for (let i = 0; i < 13; i++) {
      const x = L / 2 - H.strip - 0.8 - i * 1.5;
      for (const s of [-1, 1]) k.add(rbox(0.6, 0.22, W / 2 - 1.5 - sq - 0.8, 0.1).rotateX(Math.PI / 2), plastic, at(x, s * (sq + 0.8 + (W / 2 - 1.5 - sq - 0.8) / 2), zTop + sg * 0.09));
    }
    k.add(new THREE.CylinderGeometry(1.65, 1.65, 0.16, 20).rotateX(Math.PI / 2), lib.get('white'), at(L / 2 - H.strip - 5.2, sq - 3.5, zTop + sg * 0.06));
    k.add(rbox(H.ridge.w, H.ridge.h, W - 4, 0.3).rotateX(Math.PI / 2), plastic, at(L / 2 - H.ridge.at, 0, zTop + sg * H.ridge.h / 2));
    // the white labels to write on
    for (const s of [-1, 1]) k.add(rbox(LB.h, 0.16, LB.w, 0.3).rotateX(Math.PI / 2), white, at(labelX, s * (W / 2 - LB.inset - LB.w / 2), zTop + sg * 0.08));
    // the flap, its hinge line a hairline short of the rails
    k.add(rbox(H.flap - 0.4, S * 0.92, W, 0.4).rotateX(Math.PI / 2), plastic, at(-L / 2 + H.flap / 2 - 0.2, 0, sg * (half - S * 0.46)));
    // the slide locks at the end, either side of the tab: bronze wire standing off the end, bent out to the side
    for (const s of [-1, 1]) {
      const K = H.lock, zz = zTop - sg * 1.2, p = (x, y) => new THREE.Vector3(x, y, zz);
      const path = new THREE.CurvePath();
      path.add(new THREE.LineCurve3(p(L / 2 - 1, s * K.y), p(L / 2 + K.up - 1.2, s * K.y)));
      path.add(new THREE.QuadraticBezierCurve3(p(L / 2 + K.up - 1.2, s * K.y), p(L / 2 + K.up, s * K.y), p(L / 2 + K.up, s * (K.y + 1.2))));
      path.add(new THREE.LineCurve3(p(L / 2 + K.up, s * (K.y + 1.2)), p(L / 2 + K.up, s * (K.y + K.leg))));
      k.add(new THREE.TubeGeometry(path, 16, K.r, 6, false), wire);
    }
  }
  k.build(group);
  // the slides: each at its face, between the rails and under the band, its tab out past the end
  const exposed = exposedTex();
  const decalMat = new THREE.MeshBasicMaterial({ name: 'holderExposed', map: exposed, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, toneMapped: true });
  const SL = H.slide, TB = H.tab, len = L - H.flap + 2.5, x0 = -L / 2 + H.flap - 2;
  const slides = [-1, 1].map((sg) => {
    const g = new THREE.Group(); g.name = 'darkSlide';
    const face = new THREE.Group(); face.position.z = sg * (half - S + SL.t / 2); g.add(face);
    const sk = new Kit();
    sk.add(rbox(len, SL.t, SL.w, 0.3).rotateX(Math.PI / 2), slideMat, T(x0 + len / 2, 0, 0));
    // the tab: a plate out past the end, its slot and seven holes through it
    const tabShape = rrPath(0, -TB.w / 2, TB.h, TB.w / 2, 1.5);
    tabShape.holes.push(rrPath(TB.h - TB.slot.from - TB.slot.h, -TB.slot.w / 2, TB.h - TB.slot.from, TB.slot.w / 2, 1.6, new THREE.Path()));
    for (let i = 0; i < TB.dots; i++) { const c = new THREE.Path(); c.absarc(TB.h - TB.dotFrom, (i - (TB.dots - 1) / 2) * TB.pitch, TB.dotR, 0, Math.PI * 2, true); tabShape.holes.push(c); }
    const tab = slab(tabShape, 1.4, 0.3, 8, 0, 2); tab.translate(0, 0, -0.7);
    sk.add(tab, slideMat, T(x0 + len - 0.5, 0, 0));
    sk.build(face);
    // EXPOSED on its inner face (out of sight until the slide is turned): across the slide, read from the tab's end
    const dec = new THREE.Mesh(new THREE.PlaneGeometry(36, 6), decalMat);
    dec.position.set((xFlap + xBand) / 2, 0, -sg * (SL.t / 2 + 0.02));
    dec.rotation.set(sg < 0 ? 0 : Math.PI, 0, -Math.PI / 2);   // (turned out, it reads across the slide, its top toward the tab)
    dec.userData.noShadow = true;
    face.add(dec);
    const dot = new THREE.Mesh(new THREE.CircleGeometry(1.6, 20), decalMat.clone());
    dot.material.map = null; dot.material.color.set(0xf2f1ec);
    dot.position.set(xBand - 6, 0, -sg * (SL.t / 2 + 0.02)); dot.rotation.x = sg < 0 ? 0 : Math.PI;
    face.add(dot);
    return {
      group: g, face, turned: false,
      /** out by k: 0 in the holder, 1 clear of its end by 12 mm */
      out(kk) { g.position.x = kk * (len + 12); },
      /** its EXPOSED face out (turned) or in, by k (a half-turn about its length, out in the hand) */
      turn(kk) { face.rotation.x = kk * Math.PI; },
    };
  });
  slides.forEach((s) => group.add(s.group));
  return { group, slides, len };
}
