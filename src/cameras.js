// Canonical camera registry & loader.
// Each entry describes a camera system declaratively: format, shutter, lenses, viewing mode,
// interactive controls, and lazy model builder. See docs/CONTRACT.md for the runtime API.

import { CF_LENSES } from './cameras/503cx/lenses.js';
import { M6_LENSES } from './cameras/m6/lenses.js';
import { FINDER } from './cameras/m6/finder.js';
import { INTREPID_LENSES } from './cameras/intrepid/lenses.js';
import { AE1_LENSES } from './cameras/ae1/lenses.js';
import { ROLLEIFLEX_LENSES } from './cameras/rolleiflex/lenses.js';
import { K1000_LENSES } from './cameras/k1000/lenses.js';
import { F3_LENSES } from './cameras/f3/lenses.js';
import { OM1_LENSES } from './cameras/om1/lenses.js';
import { FORMATS } from './formats.js';
import { SHUTTERS } from './shutters.js';
import { createCamera503 } from './cameras/503cx/index.js';

// ───────── Viewing adapters ─────────

function waistLevel(cam) {
  return {
    id: 'waist-level', name: 'Waist-level finder', image: 'ground-glass',
    open: (on) => cam.setFinderOpen(on),
    eyePose: () => cam.lookDownPose(),
    setImage: (tex) => cam.setScreenTexture(tex),
    loupe: {
      power: 4.5,
      crop: 0.17,
      set: (up) => cam.setMagnifier(up),
      get up() { return cam.magnifierUp; },
      setImage: (tex, crop) => cam.setLoupeTexture(tex, crop),
    },
  };
}

function rangefinder(cam) {
  return {
    id: 'rangefinder', name: 'Rangefinder viewfinder', image: 'finder',
    magnification: FINDER.magnification, base: FINDER.base, window: { x: FINDER.x, y: FINDER.y },
    open: async () => {},
    eyePose: () => cam.finderPose(),
  };
}

function groundGlassBack(cam) {
  return {
    id: 'ground-glass-back', name: 'Ground glass', image: 'ground-glass',
    labels: { open: 'Dark cloth', close: 'Cloth off' },
    stayLooking: true, follow: true,
    open: (on) => cam.setCloth(on),
    under: (on) => cam.setUnderCloth(on),
    glassSeen: (view) => cam.glassSeen(view),
    eyePose: () => cam.ggPose(),
    setImage: (tex, shape) => cam.setScreenTexture(tex, shape),
    loupe: {
      label: 'Loupe', power: 6, needsLook: true, follows: true,
      crop: 0.35,
      set: (up) => cam.setLoupe(up),
      get up() { return cam.loupeUp; },
      setImage: (tex, crop, shape) => cam.setLoupeTexture(tex, crop, shape),
      centre: () => cam.loupeCentre(),
      at: () => cam.loupeAt(),
      moveTo: (x, y) => cam.moveLoupe(x, y),
      glassPoint: (world) => cam.glassPoint(world),
      drag: (dx, dy, view, heightPx) => cam.loupeDrag(dx, dy, view, heightPx),
    },
  };
}

function pentaprism(cam) {
  return {
    id: 'pentaprism', name: 'Pentaprism viewfinder', image: 'ground-glass',
    open: async () => {},
    eyePose: () => cam.eyePose(),
    setImage: (tex) => cam.setScreenTexture(tex),
  };
}

function removablePentaprism(cam) {
  return {
    id: 'pentaprism', name: 'DE-3 HP finder', image: 'ground-glass',
    labels: { open: 'Remove prism', close: 'Attach prism' },
    open: (on) => cam.setFinderOpen(on),
    eyePose: () => cam.eyePose(),
    setImage: (tex) => cam.setScreenTexture(tex),
  };
}

// ───────── Camera Registry ─────────

export const CAMERAS = {
  '503cx': {
    kind: '503cx', name: '503CX', system: 'hasselblad-v',
    format: FORMATS['6x6'],
    shutter: SHUTTERS['prontor-cf'],
    lenses: CF_LENSES, defaultLens: 'zeiss-planar-2.8-80',
    viewing: waistLevel,
    controls: ['finder', 'look', 'loupe', 'stopDown', 'explode'],
    mechanism: () => import('./mechanisms/hasselblad-v.js'),
    load: async () => createCamera503,
  },
  m6: {
    kind: 'm6', name: 'M6', system: 'leica-m',
    format: FORMATS['135'],
    shutter: SHUTTERS['leica-m6'],
    lenses: M6_LENSES, defaultLens: 'leica-summicron-2-50-iii',
    viewing: rangefinder,
    controls: ['look', 'explode'],
    mechanism: null,
    load: async () => (await import('./cameras/m6/index.js')).createCameraM6,
  },
  intrepid: {
    kind: 'intrepid', name: '4×5 Field', system: 'large-format',
    format: FORMATS['4x5'],
    shutter: SHUTTERS['copal-0'],
    lenses: INTREPID_LENSES, defaultLens: 'lf-150-6.3',
    viewing: groundGlassBack,
    screen: 'plain',
    movements: true,
    controls: ['finder', 'look', 'loupe', 'movements', 'holder', 'fold', 'explode'],
    mechanism: null,
    load: async () => (await import('./cameras/intrepid/index.js')).createCameraIntrepid,
  },
  ae1: {
    kind: 'ae1', name: 'AE-1', system: 'canon-fd',
    format: FORMATS['135'],
    shutter: SHUTTERS['canon-ae1'],
    lenses: AE1_LENSES, defaultLens: 'fd-50-1.4',
    viewing: pentaprism,
    controls: ['look', 'stopDown', 'explode'],
    mechanism: null,
    load: async () => (await import('./cameras/ae1/index.js')).createCameraAE1,
  },
  rolleiflex: {
    kind: 'rolleiflex', name: '2.8F', system: 'rolleiflex-tlr',
    format: FORMATS['6x6'],
    shutter: SHUTTERS['synchro-compur'],
    lenses: ROLLEIFLEX_LENSES, defaultLens: 'rollei-planar-2.8-80',
    viewing: waistLevel,
    controls: ['finder', 'look', 'loupe', 'explode'],
    mechanism: null,
    load: async () => (await import('./cameras/rolleiflex/index.js')).createCameraRolleiflex,
  },
  k1000: {
    kind: 'k1000', name: 'K1000', system: 'pentax-k',
    format: FORMATS['135'],
    shutter: SHUTTERS['pentax-k1000'],
    lenses: K1000_LENSES, defaultLens: 'k-50-2',
    viewing: pentaprism,
    controls: ['look', 'explode'],
    mechanism: null,
    load: async () => (await import('./cameras/k1000/index.js')).createCameraK1000,
  },
  f3: {
    kind: 'f3', name: 'F3HP', system: 'nikon-f',
    format: FORMATS['135'],
    shutter: SHUTTERS['nikon-f3'],
    lenses: F3_LENSES, defaultLens: 'ais-50-1.4',
    viewing: removablePentaprism,
    controls: ['finder', 'look', 'stopDown', 'explode'],
    mechanism: null,
    load: async () => (await import('./cameras/f3/index.js')).createCameraF3,
  },
  om1: {
    kind: 'om1', name: 'OM-1 MD', system: 'olympus-om',
    format: FORMATS['135'],
    shutter: SHUTTERS['olympus-om1'],
    lenses: OM1_LENSES, defaultLens: 'zuiko-50-1.8',
    viewing: pentaprism,
    controls: ['look', 'stopDown', 'explode'],
    mechanism: null,
    load: async () => (await import('./cameras/om1/index.js')).createCameraOM1,
  },
};

export const DEFAULT_CAMERA = '503cx';

/** Resolve a camera kind string from a URL parameter or config (unknown values fall back to DEFAULT_CAMERA). */
export const cameraKind = (q) => (q && Object.hasOwn(CAMERAS, q) ? q : DEFAULT_CAMERA);

/** Look up a lens of a camera system by id, short key (`50-1.4`), or focal length (`50`). */
export function lensFor(kind, key) {
  const { lenses } = CAMERAS[kind];
  if (key == null || key === '') return null;
  const k = String(key), m = /^(\d+(?:\.\d+)?)(?:-(\d+(?:\.\d+)?))?$/.exec(k);
  return lenses.find((l) => l.id === k)
    || (m && lenses.find((l) => l.focalLength === +m[1] && (m[2] === undefined || l.maxAperture === +m[2]))) || null;
}

/** Short human-readable share key for a lens (`50` or `50-1.4` when focal lengths collide). */
export function lensKey(kind, lens) {
  const twins = CAMERAS[kind].lenses.filter((l) => l.focalLength === lens.focalLength).length > 1;
  return twins ? `${lens.focalLength}-${lens.maxAperture}` : String(lens.focalLength);
}

/** Build any registered 3D camera model with its standard contract wrapper (see docs/CONTRACT.md). */
export async function createCamera(kind, opts) {
  const desc = CAMERAS[kind];
  if (!desc) throw new Error(`no camera "${kind}"`);
  const cam = (await desc.load())(opts);
  cam.kind = kind;
  cam.desc = desc;
  cam.format = desc.format;
  cam.shutter = desc.shutter;
  cam.lenses = desc.lenses;
  cam.setState ||= cam.setRings;
  cam.viewing = desc.viewing(cam);
  return cam;
}
