// The Pentax K-mount manual prime lineup for the 1976 Asahi Pentax K1000 (35 mm SLR, 45.46 mm flange focal distance).
// Six classic SMC Pentax-M compact manual primes spanning 28 mm wide to 135 mm telephoto with exact thin-lens conjugate math.
import { registerLensOptics } from '../../optics.js';

const STOPS_17_22 = [1.7, 2.8, 4, 5.6, 8, 11, 16, 22];
const STOPS_2_22  = [2, 2.8, 4, 5.6, 8, 11, 16, 22];
const STOPS_28_22 = [2.8, 4, 5.6, 8, 11, 16, 22];
const STOPS_35_32 = [3.5, 4, 5.6, 8, 11, 16, 22, 32];

function lens(o) {
  return {
    minAperture: o.apertureStops[o.apertureStops.length - 1],
    transmissionFactor: 0.94, halationIntensity: 0.18, vignetteIntensity: 0.28,
    system: 'pentax-k', projection: 'rectilinear', shutter: null, filterSize: 49,
    ...o,
  };
}

export const K1000_LENSES = [
  lens({
    id: 'k-28-2.8',
    name: '28 mm ƒ/2.8 Wide',
    kind: 'Wide',
    focalLength: 28, maxAperture: 2.8, apertureStops: STOPS_28_22,
    angleOfView: 75, fov: 65,
    minFocusDistance: 0.30,
    transmissionFactor: 0.93, vignetteIntensity: 0.34,
    use: 'Wide: ultra-compact 49 mm retrofocus wide angle for street and documentary',
    shade: 'RH-RA49', shadeName: 'RH-RA49 rectangular shade',
    shadeNote: 'Compact wide-angle slip-on metal shade for 28 mm K-mount lenses',
  }),
  lens({
    id: 'k-35-2',
    name: '35 mm ƒ/2 Wide',
    kind: 'Wide',
    focalLength: 35, maxAperture: 2, apertureStops: STOPS_2_22,
    angleOfView: 63, fov: 54,
    minFocusDistance: 0.30,
    transmissionFactor: 0.94, vignetteIntensity: 0.30,
    use: 'Reportage: fast SMC 35 mm classic with crisp micro-contrast',
    shade: 'PH-S49', shadeName: 'PH-S49 clip-on shade',
    shadeNote: 'Clip-on metal hood for 35 mm ƒ/2',
  }),
  lens({
    id: 'k-50-2',
    name: '50 mm ƒ/2 Standard',
    kind: 'Standard',
    focalLength: 50, maxAperture: 2, apertureStops: STOPS_2_22,
    angleOfView: 47, fov: 40,
    minFocusDistance: 0.45,
    transmissionFactor: 0.94, halationIntensity: 0.18, vignetteIntensity: 0.28,
    use: 'Standard: the iconic 31 mm compact K1000 classroom prime — crisp, simple, and distortion-free',
    shade: 'RH-A49', shadeName: 'RH-A49 clip-on shade',
    shadeNote: 'Standard 49 mm metal lens shade for 50 mm primes',
  }),
  lens({
    id: 'k-50-1.7',
    name: '50 mm ƒ/1.7 Standard',
    kind: 'Standard',
    focalLength: 50, maxAperture: 1.7, apertureStops: STOPS_17_22,
    angleOfView: 47, fov: 40,
    minFocusDistance: 0.45,
    transmissionFactor: 0.95, halationIntensity: 0.20, vignetteIntensity: 0.30,
    use: 'Standard: legendary 6-element SMC 50 mm ƒ/1.7 — benchmark sharpness across the frame',
    shade: 'RH-A49', shadeName: 'RH-A49 clip-on shade',
    shadeNote: 'Standard 49 mm metal lens shade',
  }),
  lens({
    id: 'k-85-2',
    name: '85 mm ƒ/2 Portrait',
    kind: 'Portrait',
    focalLength: 85, maxAperture: 2, apertureStops: STOPS_2_22,
    angleOfView: 28.5, fov: 24,
    minFocusDistance: 0.85,
    transmissionFactor: 0.95, halationIntensity: 0.15, vignetteIntensity: 0.22,
    use: 'Portrait: featherweight 5-element Sonnar-derivative portrait telephoto',
    shade: 'MH-RB49', shadeName: 'MH-RB49 deep shade',
    shadeNote: 'Deep metal portrait shade',
  }),
  lens({
    id: 'k-135-3.5',
    name: '135 mm ƒ/3.5 Tele',
    kind: 'Tele',
    focalLength: 135, maxAperture: 3.5, apertureStops: STOPS_35_32,
    angleOfView: 18, fov: 15,
    minFocusDistance: 1.50,
    transmissionFactor: 0.94, halationIntensity: 0.14, vignetteIntensity: 0.18,
    use: 'Telephoto: pocket-sized 135 mm with integrated telescopic sliding shade',
    shade: 'built-in', shadeName: 'Built-in sliding hood',
    shadeNote: 'Telescopic anodized metal hood built into the 135 mm barrel',
  }),
];

registerLensOptics({
  // SMC Pentax-M 28mm f/2.8 (7 elements in 7 groups; exact thin-lens ext at 0.30 m = 3.363 mm)
  'k-28-2.8': {
    design: 'SMC-M 28/2.8 (7/7)', elements: 7, groups: 7, focalCalMm: 28.4, maxAperture: 2.8, minFocusM: 0.30,
    transmission: 0.93, entrancePupilMm: 18.0,
    k1: -0.014, k2: 0.002, caLat: 0.0012, caLong: 0.14, saGlow: 0.15, catsEye: 0.42,
    astig: 0.18, coma: 0.19, fieldCurv: 0.15, vigOpen: 0.80, vigStop: 0.32, vigExp: 2.1,
    mtfCenterOpen: 0.72, mtfCornerOpen: 0.46, mtfCenterStop: 0.84, mtfCornerStop: 0.68, mtfAstig: 0.16,
    cciTint: [1.003, 1.001, 0.996],
    pupilMag: 1.54, maxExtMm: 3.363, hoodType: 'screw',
    ghostTintA: [0.46, 0.34, 0.74], ghostTintB: [0.36, 0.68, 0.56],
  },
  // SMC Pentax-M 35mm f/2 (7 elements in 7 groups; exact thin-lens ext at 0.30 m = 5.605 mm)
  'k-35-2': {
    design: 'SMC-M 35/2 (7/7)', elements: 7, groups: 7, focalCalMm: 35.4, maxAperture: 2, minFocusM: 0.30,
    transmission: 0.94, entrancePupilMm: 22.0,
    k1: -0.011, k2: 0.001, caLat: 0.0010, caLong: 0.14, saGlow: 0.18, catsEye: 0.46,
    astig: 0.17, coma: 0.21, fieldCurv: 0.14, vigOpen: 0.84, vigStop: 0.30, vigExp: 2.1,
    mtfCenterOpen: 0.73, mtfCornerOpen: 0.45, mtfCenterStop: 0.86, mtfCornerStop: 0.70, mtfAstig: 0.15,
    cciTint: [1.004, 1.001, 0.995],
    pupilMag: 1.32, maxExtMm: 5.605, hoodType: 'screw',
    ghostTintA: [0.44, 0.36, 0.76], ghostTintB: [0.34, 0.70, 0.54],
  },
  // SMC Pentax-M 50mm f/2 (5 elements in 5 groups; exact thin-lens ext at 0.45 m = 7.713 mm)
  'k-50-2': {
    design: 'SMC-M 50/2 (5/5)', elements: 5, groups: 5, focalCalMm: 51.2, maxAperture: 2, minFocusM: 0.45,
    transmission: 0.94, entrancePupilMm: 23.0,
    k1: -0.006, k2: 0.001, caLat: 0.0008, caLong: 0.12, saGlow: 0.16, catsEye: 0.38,
    astig: 0.14, coma: 0.16, fieldCurv: 0.12, vigOpen: 0.72, vigStop: 0.26, vigExp: 2.0,
    mtfCenterOpen: 0.78, mtfCornerOpen: 0.52, mtfCenterStop: 0.88, mtfCornerStop: 0.74, mtfAstig: 0.12,
    cciTint: [1.003, 1.001, 0.996],
    pupilMag: 1.06, maxExtMm: 7.713, hoodType: 'screw',
    ghostTintA: [0.48, 0.32, 0.78], ghostTintB: [0.38, 0.66, 0.58],
  },
  // SMC Pentax-M 50mm f/1.7 (6 elements in 5 groups Planar; exact thin-lens ext at 0.45 m = 7.784 mm)
  'k-50-1.7': {
    design: 'SMC-M 50/1.7 (6/5)', elements: 6, groups: 5, focalCalMm: 51.4, maxAperture: 1.7, minFocusM: 0.45,
    transmission: 0.95, entrancePupilMm: 24.0,
    k1: -0.005, k2: 0.001, caLat: 0.0007, caLong: 0.11, saGlow: 0.17, catsEye: 0.42,
    astig: 0.12, coma: 0.15, fieldCurv: 0.11, vigOpen: 0.76, vigStop: 0.24, vigExp: 2.0,
    mtfCenterOpen: 0.80, mtfCornerOpen: 0.56, mtfCenterStop: 0.90, mtfCornerStop: 0.78, mtfAstig: 0.10,
    cciTint: [1.002, 1.001, 0.997],
    pupilMag: 1.04, maxExtMm: 7.784, hoodType: 'screw',
    ghostTintA: [0.46, 0.34, 0.76], ghostTintB: [0.34, 0.70, 0.56],
  },
  // SMC Pentax-M 85mm f/2 (5 elements in 4 groups; exact thin-lens ext at 0.85 m = 10.855 mm)
  'k-85-2': {
    design: 'SMC-M 85/2 (5/4)', elements: 5, groups: 4, focalCalMm: 85.2, maxAperture: 2, minFocusM: 0.85,
    transmission: 0.95, entrancePupilMm: 30.0,
    k1: 0.004, k2: 0.0, caLat: 0.0008, caLong: 0.14, saGlow: 0.16, catsEye: 0.36,
    astig: 0.11, coma: 0.14, fieldCurv: 0.10, vigOpen: 0.66, vigStop: 0.22, vigExp: 1.9,
    mtfCenterOpen: 0.79, mtfCornerOpen: 0.58, mtfCenterStop: 0.89, mtfCornerStop: 0.78, mtfAstig: 0.11,
    cciTint: [1.003, 1.000, 0.996],
    pupilMag: 0.92, maxExtMm: 10.855, hoodType: 'screw',
    ghostTintA: [0.48, 0.36, 0.74], ghostTintB: [0.36, 0.68, 0.54],
  },
  // SMC Pentax-M 135mm f/3.5 (5 elements in 5 groups; exact thin-lens ext at 1.50 m = 14.950 mm)
  'k-135-3.5': {
    design: 'SMC-M 135/3.5 (5/5)', elements: 5, groups: 5, focalCalMm: 134.8, maxAperture: 3.5, minFocusM: 1.50,
    transmission: 0.94, entrancePupilMm: 34.0,
    k1: 0.006, k2: 0.0, caLat: 0.0010, caLong: 0.18, saGlow: 0.12, catsEye: 0.30,
    astig: 0.10, coma: 0.12, fieldCurv: 0.09, vigOpen: 0.54, vigStop: 0.18, vigExp: 1.8,
    mtfCenterOpen: 0.80, mtfCornerOpen: 0.62, mtfCenterStop: 0.88, mtfCornerStop: 0.79, mtfAstig: 0.10,
    cciTint: [1.004, 1.000, 0.995],
    pupilMag: 0.80, maxExtMm: 14.950, hoodType: 'slide',
    ghostTintA: [0.46, 0.38, 0.72], ghostTintB: [0.36, 0.66, 0.56],
  },
});
