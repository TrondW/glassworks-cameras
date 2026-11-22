// The Olympus OM-mount Zuiko manual prime lineup for the 1976 Olympus OM-1 MD (35 mm SLR, 46.0 mm flange focal distance).
// Seven ultra-compact Maitani-era Zuiko primes spanning 24 mm wide to 135 mm telephoto with exact thin-lens conjugate math.
import { registerLensOptics } from '../../optics.js';

const STOPS_14_16 = [1.4, 2, 2.8, 4, 5.6, 8, 11, 16];
const STOPS_18_16 = [1.8, 2.8, 4, 5.6, 8, 11, 16];
const STOPS_2_16  = [2, 2.8, 4, 5.6, 8, 11, 16];
const STOPS_28_16 = [2.8, 4, 5.6, 8, 11, 16];
const STOPS_35_16 = [3.5, 4, 5.6, 8, 11, 16];
const STOPS_35_22 = [3.5, 4, 5.6, 8, 11, 16, 22];

function lens(o) {
  return {
    minAperture: o.apertureStops[o.apertureStops.length - 1],
    transmissionFactor: 0.94, halationIntensity: 0.17, vignetteIntensity: 0.28,
    system: 'olympus-om', projection: 'rectilinear', shutter: null, filterSize: 49,
    ...o,
  };
}

export const OM1_LENSES = [
  lens({
    id: 'zuiko-24-2.8',
    name: '24 mm ƒ/2.8 Wide',
    kind: 'Wide',
    focalLength: 24, maxAperture: 2.8, apertureStops: STOPS_28_16,
    angleOfView: 84, fov: 74,
    minFocusDistance: 0.25,
    transmissionFactor: 0.93, vignetteIntensity: 0.36,
    use: 'Wide: ultra-compact 31 mm long H.Zuiko Auto-W 24 mm with floating close-range correction',
    shade: '49mm wide', shadeName: '49 mm screw-in wide shade',
    shadeNote: 'Compact anodized aluminum 49 mm wide-angle lens hood',
  }),
  lens({
    id: 'zuiko-28-3.5',
    name: '28 mm ƒ/3.5 Wide',
    kind: 'Wide',
    focalLength: 28, maxAperture: 3.5, apertureStops: STOPS_35_16,
    angleOfView: 75, fov: 65,
    minFocusDistance: 0.30,
    transmissionFactor: 0.94, vignetteIntensity: 0.30,
    use: 'Wide: featherweight 7-element G.Zuiko Auto-W street & landscape lens',
    shade: '49mm wide', shadeName: '49 mm screw-in shade',
    shadeNote: 'Compact 49 mm screw-in metal hood for 28 mm',
  }),
  lens({
    id: 'zuiko-35-2.8',
    name: '35 mm ƒ/2.8 Wide',
    kind: 'Wide',
    focalLength: 35, maxAperture: 2.8, apertureStops: STOPS_28_16,
    angleOfView: 63, fov: 54,
    minFocusDistance: 0.30,
    transmissionFactor: 0.94, vignetteIntensity: 0.28,
    use: 'Reportage: classic pocketable G.Zuiko documentary prime',
    shade: '51mm slide', shadeName: '51 mm slide-on shade',
    shadeNote: 'Slide-on metal hood for 35 mm Zuiko',
  }),
  lens({
    id: 'zuiko-50-1.8',
    name: '50 mm ƒ/1.8 Standard',
    kind: 'Standard',
    focalLength: 50, maxAperture: 1.8, apertureStops: STOPS_18_16,
    angleOfView: 47, fov: 40,
    minFocusDistance: 0.45,
    transmissionFactor: 0.95, halationIntensity: 0.19, vignetteIntensity: 0.26,
    use: 'Standard: iconic 31 mm long 6-element F.Zuiko Auto-S paired with the OM-1 MD',
    shade: '51mm slide', shadeName: '51 mm slide-on rubber/metal shade',
    shadeNote: 'Reversible 51 mm slide-on hood for 50 mm ƒ/1.8',
  }),
  lens({
    id: 'zuiko-50-1.4',
    name: '50 mm ƒ/1.4 Fast Standard',
    kind: 'Standard',
    focalLength: 50, maxAperture: 1.4, apertureStops: STOPS_14_16,
    angleOfView: 47, fov: 40,
    minFocusDistance: 0.45,
    transmissionFactor: 0.94, halationIntensity: 0.22, vignetteIntensity: 0.31,
    use: 'Low-light standard: fast 7-element double-Gauss G.Zuiko Auto-S 50 mm ƒ/1.4',
    shade: '51mm slide', shadeName: '51 mm slide-on shade',
    shadeNote: 'Slide-on shade for 50 mm ƒ/1.4',
  }),
  lens({
    id: 'zuiko-85-2',
    name: '85 mm ƒ/2 Portrait',
    kind: 'Portrait',
    focalLength: 85, maxAperture: 2, apertureStops: STOPS_2_16,
    angleOfView: 29, fov: 24,
    minFocusDistance: 0.85,
    transmissionFactor: 0.95, halationIntensity: 0.15, vignetteIntensity: 0.22,
    use: 'Portrait: remarkably tiny 46 mm long F.Zuiko Auto-T short telephoto with silky bokeh',
    shade: '49mm tele', shadeName: '49 mm screw-in portrait shade',
    shadeNote: 'Deep 49 mm screw-in portrait hood',
  }),
  lens({
    id: 'zuiko-135-3.5',
    name: '135 mm ƒ/3.5 Tele',
    kind: 'Tele',
    focalLength: 135, maxAperture: 3.5, apertureStops: STOPS_35_22,
    angleOfView: 18, fov: 15,
    minFocusDistance: 1.50,
    transmissionFactor: 0.94, halationIntensity: 0.14, vignetteIntensity: 0.18,
    use: 'Telephoto: crisp 5-element E.Zuiko Auto-T with built-in telescopic sliding shade',
    shade: 'built-in', shadeName: 'Built-in sliding hood',
    shadeNote: 'Integrated retractable anodized metal lens shade',
  }),
];

registerLensOptics({
  // H.Zuiko Auto-W 24mm f/2.8 (8/7; exact thin-lens ext at 0.25 m = 3.032 mm)
  'zuiko-24-2.8': {
    design: 'H.Zuiko 24/2.8 (8/7)', elements: 8, groups: 7, focalCalMm: 24.5, maxAperture: 2.8, minFocusM: 0.25,
    transmission: 0.93, entrancePupilMm: 16.5,
    k1: -0.015, k2: 0.002, caLat: 0.0012, caLong: 0.14, saGlow: 0.15, catsEye: 0.42,
    astig: 0.16, coma: 0.18, fieldCurv: 0.12, vigOpen: 0.84, vigStop: 0.34, vigExp: 2.2,
    mtfCenterOpen: 0.74, mtfCornerOpen: 0.48, mtfCenterStop: 0.87, mtfCornerStop: 0.71, mtfAstig: 0.14,
    cciTint: [1.003, 1.001, 0.996],
    pupilMag: 1.62, maxExtMm: 3.032, hoodType: 'screw',
    ghostTintA: [0.32, 0.72, 0.50], ghostTintB: [0.76, 0.44, 0.26],
  },
  // G.Zuiko Auto-W 28mm f/3.5 (7/7; exact thin-lens ext at 0.30 m = 3.363 mm)
  'zuiko-28-3.5': {
    design: 'G.Zuiko 28/3.5 (7/7)', elements: 7, groups: 7, focalCalMm: 28.4, maxAperture: 3.5, minFocusM: 0.30,
    transmission: 0.94, entrancePupilMm: 17.5,
    k1: -0.009, k2: 0.001, caLat: 0.0010, caLong: 0.13, saGlow: 0.13, catsEye: 0.38,
    astig: 0.14, coma: 0.15, fieldCurv: 0.11, vigOpen: 0.74, vigStop: 0.28, vigExp: 2.1,
    mtfCenterOpen: 0.78, mtfCornerOpen: 0.56, mtfCenterStop: 0.89, mtfCornerStop: 0.76, mtfAstig: 0.12,
    cciTint: [1.002, 1.001, 0.997],
    pupilMag: 1.48, maxExtMm: 3.363, hoodType: 'screw',
    ghostTintA: [0.30, 0.74, 0.48], ghostTintB: [0.78, 0.46, 0.24],
  },
  // G.Zuiko Auto-W 35mm f/2.8 (7/6; exact thin-lens ext at 0.30 m = 5.605 mm)
  'zuiko-35-2.8': {
    design: 'G.Zuiko 35/2.8 (7/6)', elements: 7, groups: 6, focalCalMm: 35.4, maxAperture: 2.8, minFocusM: 0.30,
    transmission: 0.94, entrancePupilMm: 19.5,
    k1: -0.010, k2: 0.001, caLat: 0.0010, caLong: 0.13, saGlow: 0.15, catsEye: 0.40,
    astig: 0.14, coma: 0.17, fieldCurv: 0.12, vigOpen: 0.76, vigStop: 0.28, vigExp: 2.0,
    mtfCenterOpen: 0.76, mtfCornerOpen: 0.52, mtfCenterStop: 0.88, mtfCornerStop: 0.74, mtfAstig: 0.13,
    cciTint: [1.003, 1.001, 0.996],
    pupilMag: 1.26, maxExtMm: 5.605, hoodType: 'slide',
    ghostTintA: [0.34, 0.70, 0.52], ghostTintB: [0.74, 0.48, 0.28],
  },
  // F.Zuiko Auto-S 50mm f/1.8 (6/5; exact thin-lens ext at 0.45 m = 7.713 mm)
  'zuiko-50-1.8': {
    design: 'F.Zuiko 50/1.8 (6/5)', elements: 6, groups: 5, focalCalMm: 51.2, maxAperture: 1.8, minFocusM: 0.45,
    transmission: 0.95, entrancePupilMm: 22.0,
    k1: -0.008, k2: 0.001, caLat: 0.0008, caLong: 0.12, saGlow: 0.17, catsEye: 0.42,
    astig: 0.12, coma: 0.18, fieldCurv: 0.11, vigOpen: 0.76, vigStop: 0.24, vigExp: 2.0,
    mtfCenterOpen: 0.78, mtfCornerOpen: 0.54, mtfCenterStop: 0.91, mtfCornerStop: 0.79, mtfAstig: 0.11,
    cciTint: [1.003, 1.001, 0.996],
    pupilMag: 1.02, maxExtMm: 7.713, hoodType: 'slide',
    ghostTintA: [0.32, 0.74, 0.52], ghostTintB: [0.78, 0.48, 0.26],
  },
  // G.Zuiko Auto-S 50mm f/1.4 (7/6 double-Gauss; exact thin-lens ext at 0.45 m = 7.784 mm)
  'zuiko-50-1.4': {
    design: 'G.Zuiko 50/1.4 (7/6)', elements: 7, groups: 6, focalCalMm: 51.4, maxAperture: 1.4, minFocusM: 0.45,
    transmission: 0.94, entrancePupilMm: 24.0,
    k1: -0.009, k2: 0.001, caLat: 0.0009, caLong: 0.14, saGlow: 0.22, catsEye: 0.46,
    astig: 0.14, coma: 0.21, fieldCurv: 0.12, vigOpen: 0.82, vigStop: 0.26, vigExp: 2.0,
    mtfCenterOpen: 0.74, mtfCornerOpen: 0.47, mtfCenterStop: 0.89, mtfCornerStop: 0.76, mtfAstig: 0.13,
    cciTint: [1.004, 1.001, 0.995],
    pupilMag: 1.00, maxExtMm: 7.784, hoodType: 'slide',
    ghostTintA: [0.34, 0.72, 0.50], ghostTintB: [0.80, 0.46, 0.24],
  },
  // F.Zuiko Auto-T 85mm f/2 (6/4; exact thin-lens ext at 0.85 m = 10.913 mm)
  'zuiko-85-2': {
    design: 'F.Zuiko 85/2 (6/4)', elements: 6, groups: 4, focalCalMm: 85.4, maxAperture: 2, minFocusM: 0.85,
    transmission: 0.95, entrancePupilMm: 29.0,
    k1: 0.003, k2: 0.0, caLat: 0.0008, caLong: 0.13, saGlow: 0.16, catsEye: 0.36,
    astig: 0.11, coma: 0.14, fieldCurv: 0.10, vigOpen: 0.66, vigStop: 0.22, vigExp: 1.9,
    mtfCenterOpen: 0.78, mtfCornerOpen: 0.58, mtfCenterStop: 0.89, mtfCornerStop: 0.79, mtfAstig: 0.10,
    cciTint: [1.003, 1.000, 0.997],
    pupilMag: 0.90, maxExtMm: 10.913, hoodType: 'screw',
    ghostTintA: [0.32, 0.74, 0.48], ghostTintB: [0.76, 0.46, 0.26],
  },
  // E.Zuiko Auto-T 135mm f/3.5 (5/4; exact thin-lens ext at 1.50 m = 15.050 mm)
  'zuiko-135-3.5': {
    design: 'E.Zuiko 135/3.5 (5/4)', elements: 5, groups: 4, focalCalMm: 135.2, maxAperture: 3.5, minFocusM: 1.50,
    transmission: 0.94, entrancePupilMm: 33.0,
    k1: 0.005, k2: 0.0, caLat: 0.0008, caLong: 0.15, saGlow: 0.13, catsEye: 0.30,
    astig: 0.10, coma: 0.12, fieldCurv: 0.09, vigOpen: 0.54, vigStop: 0.18, vigExp: 1.8,
    mtfCenterOpen: 0.81, mtfCornerOpen: 0.64, mtfCenterStop: 0.90, mtfCornerStop: 0.81, mtfAstig: 0.09,
    cciTint: [1.002, 1.000, 0.997],
    pupilMag: 0.78, maxExtMm: 15.050, hoodType: 'slide',
    ghostTintA: [0.30, 0.72, 0.50], ghostTintB: [0.76, 0.48, 0.26],
  },
});
