// The Rolleiflex 2.8F's fixed 80 mm f/2.8 Planar taking lens (5 elements in 4 groups, Synchro-Compur MXV leaf shutter)
// plus the three matched Bay III Rolleinar close-up lens pairs (taking meniscus + parallax-correcting viewing wedge).
import { registerLensOptics } from '../../optics.js';

const STOPS = [2.8, 4, 5.6, 8, 11, 16, 22];

function lens(o) {
  return {
    focalLength: 80, maxAperture: 2.8, minAperture: 22, apertureStops: STOPS,
    angleOfView: 52, fov: 38.5, filterSize: 39,
    transmissionFactor: 0.95, halationIntensity: 0.18, vignetteIntensity: 0.24,
    system: 'rolleiflex-tlr', projection: 'rectilinear', shutter: 'synchro-compur',
    shade: 'bay-iii', shadeName: 'Bay III square hood',
    shadeNote: 'Bayonet-III metal shade on the lower taking lens',
    ...o,
  };
}

export const ROLLEIFLEX_LENSES = [
  lens({
    id: 'rollei-planar-2.8-80',
    name: '80 mm ƒ/2.8 Standard',
    kind: 'Standard',
    minFocusDistance: 0.9,
    rolleinar: 0,
    use: 'Standard 6×6 TLR: the 5-element 80 mm ƒ/2.8 taking lens',
  }),
  lens({
    id: 'rollei-planar-80-r1',
    name: '80 mm ƒ/2.8 + close-up lens 1',
    kind: 'Close-up',
    minFocusDistance: 0.56,
    rolleinar: 1,
    transmissionFactor: 0.93,
    use: 'Close portrait: Bay III close-up lens 1 (+1 D) focuses from 1.0 m down to 0.56 m (film-to-subject)',
  }),
  lens({
    id: 'rollei-planar-80-r2',
    name: '80 mm ƒ/2.8 + close-up lens 2',
    kind: 'Close-up',
    minFocusDistance: 0.41,
    rolleinar: 2,
    transmissionFactor: 0.92,
    use: 'Detail: Bay III close-up lens 2 (+2 D) focuses from 0.50 m down to 0.41 m (film-to-subject)',
  }),
  lens({
    id: 'rollei-planar-80-r3',
    name: '80 mm ƒ/2.8 + close-up lens 3',
    kind: 'Macro',
    minFocusDistance: 0.33,
    rolleinar: 3,
    transmissionFactor: 0.91,
    use: 'Macro: Bay III close-up lens 3 (+3 D) focuses from 0.36 m down to 0.33 m (film-to-subject)',
  }),
];

registerLensOptics({
  // Rolleiflex 2.8F Planar 80mm f/2.8 (5 elements in 4 groups): famed micro-contrast, creamy bokeh, gentle wide-open glow
  'rollei-planar-2.8-80': {
    design: 'Planar 80/2.8 TLR (5/4)', elements: 5, groups: 4, focalCalMm: 80.2, maxAperture: 2.8, minFocusM: 0.9,
    transmission: 0.95, entrancePupilMm: 22.0,
    k1: -0.002, k2: 0, caLat: 0.0008, caLong: 0.24, saGlow: 0.30, catsEye: 0.48,
    astig: 0.18, coma: 0.22, fieldCurv: 0.16, vigOpen: 0.62, vigStop: 0.18, vigExp: 2.0,
    mtfCenterOpen: 0.68, mtfCornerOpen: 0.38, mtfCenterStop: 0.84, mtfCornerStop: 0.68, mtfAstig: 0.16,
    cciTint: [1.010, 1.002, 0.986],
    pupilMag: 1.0, maxExtMm: 8.801, hoodType: 'bayonet',
    ghostTintA: [0.58, 0.24, 0.78], ghostTintB: [0.84, 0.54, 0.20],
  },
  'rollei-planar-80-r1': {
    design: 'Planar 80 + Rolleinar 1 (+1 D)', elements: 6, groups: 5, focalCalMm: 74.24, maxAperture: 2.8, minFocusM: 0.56,
    transmission: 0.93, entrancePupilMm: 20.0,
    k1: -0.006, k2: 0.001, caLat: 0.0011, caLong: 0.28, saGlow: 0.34, catsEye: 0.50,
    astig: 0.24, coma: 0.26, fieldCurv: 0.26, vigOpen: 0.66, vigStop: 0.22, vigExp: 2.0,
    mtfCenterOpen: 0.64, mtfCornerOpen: 0.32, mtfCenterStop: 0.80, mtfCornerStop: 0.58, mtfAstig: 0.22,
    cciTint: [1.011, 1.002, 0.985],
    pupilMag: 1.0, maxExtMm: 13.860, hoodType: 'bayonet',
    ghostTintA: [0.58, 0.24, 0.78], ghostTintB: [0.84, 0.54, 0.20],
  },
  'rollei-planar-80-r2': {
    design: 'Planar 80 + Rolleinar 2 (+2 D)', elements: 6, groups: 5, focalCalMm: 69.11, maxAperture: 2.8, minFocusM: 0.41,
    transmission: 0.92, entrancePupilMm: 18.5,
    k1: -0.010, k2: 0.002, caLat: 0.0014, caLong: 0.32, saGlow: 0.40, catsEye: 0.52,
    astig: 0.30, coma: 0.30, fieldCurv: 0.34, vigOpen: 0.70, vigStop: 0.24, vigExp: 2.1,
    mtfCenterOpen: 0.60, mtfCornerOpen: 0.28, mtfCenterStop: 0.78, mtfCornerStop: 0.52, mtfAstig: 0.26,
    cciTint: [1.012, 1.002, 0.984],
    pupilMag: 1.0, maxExtMm: 18.886, hoodType: 'bayonet',
    ghostTintA: [0.58, 0.24, 0.78], ghostTintB: [0.84, 0.54, 0.20],
  },
  'rollei-planar-80-r3': {
    design: 'Planar 80 + Rolleinar 3 (+3 D)', elements: 6, groups: 5, focalCalMm: 64.65, maxAperture: 2.8, minFocusM: 0.33,
    transmission: 0.91, entrancePupilMm: 17.0,
    k1: -0.015, k2: 0.003, caLat: 0.0017, caLong: 0.36, saGlow: 0.46, catsEye: 0.54,
    astig: 0.36, coma: 0.34, fieldCurv: 0.42, vigOpen: 0.74, vigStop: 0.26, vigExp: 2.1,
    mtfCenterOpen: 0.56, mtfCornerOpen: 0.24, mtfCenterStop: 0.74, mtfCornerStop: 0.46, mtfAstig: 0.30,
    cciTint: [1.013, 1.002, 0.983],
    pupilMag: 1.0, maxExtMm: 23.600, hoodType: 'bayonet',
    ghostTintA: [0.58, 0.24, 0.78], ghostTintB: [0.84, 0.54, 0.20],
  },
});
