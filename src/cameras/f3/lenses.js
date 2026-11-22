// The Nikon F-mount AI-S manual prime lineup for the 1982 Nikon F3HP (35 mm SLR, 46.5 mm flange focal distance).
// Seven legendary AI-S Nikkors spanning 24 mm wide to 135 mm telephoto with exact thin-lens conjugate math.
import { registerLensOptics } from '../../optics.js';

const STOPS_14_16 = [1.4, 2, 2.8, 4, 5.6, 8, 11, 16];
const STOPS_2_22  = [2, 2.8, 4, 5.6, 8, 11, 16, 22];
const STOPS_25_22 = [2.5, 2.8, 4, 5.6, 8, 11, 16, 22];
const STOPS_28_22 = [2.8, 4, 5.6, 8, 11, 16, 22];
const STOPS_28_32 = [2.8, 4, 5.6, 8, 11, 16, 22, 32];

function lens(o) {
  return {
    minAperture: o.apertureStops[o.apertureStops.length - 1],
    transmissionFactor: 0.94, halationIntensity: 0.18, vignetteIntensity: 0.28,
    system: 'nikon-f', projection: 'rectilinear', shutter: null, filterSize: 52,
    ...o,
  };
}

export const F3_LENSES = [
  lens({
    id: 'ais-24-2.8',
    name: '24 mm ƒ/2.8 Wide',
    kind: 'Wide',
    focalLength: 24, maxAperture: 2.8, apertureStops: STOPS_28_22,
    angleOfView: 84, fov: 74,
    minFocusDistance: 0.30,
    transmissionFactor: 0.93, vignetteIntensity: 0.38,
    use: 'Wide: Close-Range Correction (CRC) floating-element photojournalism wide angle',
    shade: 'HN-1', shadeName: 'HN-1 screw-in shade',
    shadeNote: '52 mm wide-angle anodized metal screw-in hood',
  }),
  lens({
    id: 'ais-28-2.8',
    name: '28 mm ƒ/2.8 Wide',
    kind: 'Wide',
    focalLength: 28, maxAperture: 2.8, apertureStops: STOPS_28_22,
    angleOfView: 74, fov: 64,
    minFocusDistance: 0.20,
    transmissionFactor: 0.94, vignetteIntensity: 0.32,
    use: 'Wide: legendary 8-element CRC 28 mm focusing down to 0.20 m with near-zero distortion',
    shade: 'HN-2', shadeName: 'HN-2 screw-in shade',
    shadeNote: '52 mm wide-angle metal screw-in hood',
  }),
  lens({
    id: 'ais-35-2',
    name: '35 mm ƒ/2 Wide',
    kind: 'Wide',
    focalLength: 35, maxAperture: 2, apertureStops: STOPS_2_22,
    angleOfView: 62, fov: 53,
    minFocusDistance: 0.30,
    transmissionFactor: 0.94, vignetteIntensity: 0.30,
    use: 'Reportage: 8-element multi-coated workhorse documentary prime',
    shade: 'HN-3', shadeName: 'HN-3 screw-in shade',
    shadeNote: '52 mm metal screw-in hood for 35 mm',
  }),
  lens({
    id: 'ais-50-1.4',
    name: '50 mm ƒ/1.4 Standard',
    kind: 'Standard',
    focalLength: 50, maxAperture: 1.4, apertureStops: STOPS_14_16,
    angleOfView: 46, fov: 39.6,
    minFocusDistance: 0.45,
    transmissionFactor: 0.94, halationIntensity: 0.22, vignetteIntensity: 0.32,
    use: 'Standard: flagship 7-element double-Gauss 50 mm ƒ/1.4 AI-S paired with the F3HP',
    shade: 'HS-9', shadeName: 'HS-9 snap-on shade',
    shadeNote: 'Classic spring-clip 52 mm metal lens hood for the 50 mm ƒ/1.4 AI-S',
  }),
  lens({
    id: 'ais-85-2',
    name: '85 mm ƒ/2 Portrait',
    kind: 'Portrait',
    focalLength: 85, maxAperture: 2, apertureStops: STOPS_2_22,
    angleOfView: 28.5, fov: 24,
    minFocusDistance: 0.85,
    transmissionFactor: 0.95, halationIntensity: 0.15, vignetteIntensity: 0.22,
    use: 'Portrait: compact 5-element short telephoto with creamy out-of-focus rendering',
    shade: 'HS-10', shadeName: 'HS-10 snap-on shade',
    shadeNote: 'Deep 52 mm snap-on portrait hood',
  }),
  lens({
    id: 'ais-105-2.5',
    name: '105 mm ƒ/2.5 Portrait',
    kind: 'Portrait',
    focalLength: 105, maxAperture: 2.5, apertureStops: STOPS_25_22,
    angleOfView: 23.3, fov: 19.5,
    minFocusDistance: 1.00,
    transmissionFactor: 0.95, halationIntensity: 0.14, vignetteIntensity: 0.19,
    use: 'Portrait: iconic 5-element Xenotar-type 105 mm with built-in telescopic hood',
    shade: 'built-in', shadeName: 'Built-in sliding hood',
    shadeNote: 'Integrated retractable anodized metal shade',
  }),
  lens({
    id: 'ais-135-2.8',
    name: '135 mm ƒ/2.8 Tele',
    kind: 'Tele',
    focalLength: 135, maxAperture: 2.8, apertureStops: STOPS_28_32,
    angleOfView: 18, fov: 15,
    minFocusDistance: 1.30,
    transmissionFactor: 0.94, halationIntensity: 0.14, vignetteIntensity: 0.18,
    use: 'Telephoto: crisp 5-element compressed telephoto with built-in sliding hood',
    shade: 'built-in', shadeName: 'Built-in sliding hood',
    shadeNote: 'Integrated retractable anodized metal shade',
  }),
];

registerLensOptics({
  // AI-S 24mm f/2.8 (9/9 CRC; exact thin-lens ext at 0.30 m = 2.415 mm)
  'ais-24-2.8': {
    design: 'AI-S 24/2.8 CRC (9/9)', elements: 9, groups: 9, focalCalMm: 24.5, maxAperture: 2.8, minFocusM: 0.30,
    transmission: 0.93, entrancePupilMm: 18.5,
    k1: -0.016, k2: 0.002, caLat: 0.0012, caLong: 0.15, saGlow: 0.16, catsEye: 0.44,
    astig: 0.17, coma: 0.19, fieldCurv: 0.13, vigOpen: 0.86, vigStop: 0.36, vigExp: 2.2,
    mtfCenterOpen: 0.72, mtfCornerOpen: 0.44, mtfCenterStop: 0.85, mtfCornerStop: 0.68, mtfAstig: 0.16,
    cciTint: [1.003, 1.002, 0.995],
    pupilMag: 1.68, maxExtMm: 2.415, hoodType: 'screw',
    ghostTintA: [0.32, 0.72, 0.48], ghostTintB: [0.76, 0.46, 0.24],
  },
  // AI-S 28mm f/2.8 (8/8 CRC; exact thin-lens ext at 0.20 m = 5.873 mm)
  'ais-28-2.8': {
    design: 'AI-S 28/2.8 CRC (8/8)', elements: 8, groups: 8, focalCalMm: 28.4, maxAperture: 2.8, minFocusM: 0.20,
    transmission: 0.94, entrancePupilMm: 19.0,
    k1: -0.007, k2: 0.001, caLat: 0.0009, caLong: 0.12, saGlow: 0.13, catsEye: 0.40,
    astig: 0.14, coma: 0.15, fieldCurv: 0.11, vigOpen: 0.78, vigStop: 0.30, vigExp: 2.1,
    mtfCenterOpen: 0.77, mtfCornerOpen: 0.54, mtfCenterStop: 0.89, mtfCornerStop: 0.76, mtfAstig: 0.12,
    cciTint: [1.002, 1.001, 0.997],
    pupilMag: 1.54, maxExtMm: 5.873, hoodType: 'screw',
    ghostTintA: [0.30, 0.74, 0.46], ghostTintB: [0.78, 0.44, 0.26],
  },
  // AI-S 35mm f/2 (8/6; exact thin-lens ext at 0.30 m = 5.605 mm)
  'ais-35-2': {
    design: 'AI-S 35/2 (8/6)', elements: 8, groups: 6, focalCalMm: 35.4, maxAperture: 2, minFocusM: 0.30,
    transmission: 0.94, entrancePupilMm: 21.5,
    k1: -0.011, k2: 0.001, caLat: 0.0010, caLong: 0.14, saGlow: 0.18, catsEye: 0.44,
    astig: 0.16, coma: 0.20, fieldCurv: 0.14, vigOpen: 0.82, vigStop: 0.30, vigExp: 2.1,
    mtfCenterOpen: 0.74, mtfCornerOpen: 0.46, mtfCenterStop: 0.86, mtfCornerStop: 0.70, mtfAstig: 0.15,
    cciTint: [1.004, 1.001, 0.995],
    pupilMag: 1.30, maxExtMm: 5.605, hoodType: 'screw',
    ghostTintA: [0.34, 0.70, 0.48], ghostTintB: [0.74, 0.48, 0.28],
  },
  // AI-S 50mm f/1.4 (7/6 double-Gauss; exact thin-lens ext at 0.45 m = 7.855 mm)
  'ais-50-1.4': {
    design: 'AI-S 50/1.4 (7/6)', elements: 7, groups: 6, focalCalMm: 51.6, maxAperture: 1.4, minFocusM: 0.45,
    transmission: 0.94, entrancePupilMm: 24.5,
    k1: -0.009, k2: 0.001, caLat: 0.0008, caLong: 0.14, saGlow: 0.22, catsEye: 0.48,
    astig: 0.14, coma: 0.22, fieldCurv: 0.12, vigOpen: 0.82, vigStop: 0.26, vigExp: 2.0,
    mtfCenterOpen: 0.74, mtfCornerOpen: 0.46, mtfCenterStop: 0.89, mtfCornerStop: 0.76, mtfAstig: 0.13,
    cciTint: [1.004, 1.001, 0.994],
    pupilMag: 1.02, maxExtMm: 7.855, hoodType: 'snap',
    ghostTintA: [0.32, 0.74, 0.48], ghostTintB: [0.80, 0.46, 0.24],
  },
  // AI-S 85mm f/2 (5/5; exact thin-lens ext at 0.85 m = 10.913 mm)
  'ais-85-2': {
    design: 'AI-S 85/2 (5/5)', elements: 5, groups: 5, focalCalMm: 85.4, maxAperture: 2, minFocusM: 0.85,
    transmission: 0.95, entrancePupilMm: 30.0,
    k1: 0.004, k2: 0.0, caLat: 0.0008, caLong: 0.14, saGlow: 0.16, catsEye: 0.36,
    astig: 0.11, coma: 0.14, fieldCurv: 0.10, vigOpen: 0.66, vigStop: 0.22, vigExp: 1.9,
    mtfCenterOpen: 0.78, mtfCornerOpen: 0.56, mtfCenterStop: 0.88, mtfCornerStop: 0.78, mtfAstig: 0.11,
    cciTint: [1.003, 1.000, 0.996],
    pupilMag: 0.90, maxExtMm: 10.913, hoodType: 'snap',
    ghostTintA: [0.34, 0.72, 0.46], ghostTintB: [0.78, 0.46, 0.26],
  },
  // AI-S 105mm f/2.5 (5/4 Xenotar; exact thin-lens ext at 1.00 m = 14.211 mm)
  'ais-105-2.5': {
    design: 'AI-S 105/2.5 (5/4)', elements: 5, groups: 4, focalCalMm: 105.0, maxAperture: 2.5, minFocusM: 1.00,
    transmission: 0.95, entrancePupilMm: 32.0,
    k1: 0.003, k2: 0.0, caLat: 0.0006, caLong: 0.12, saGlow: 0.12, catsEye: 0.32,
    astig: 0.09, coma: 0.10, fieldCurv: 0.08, vigOpen: 0.60, vigStop: 0.20, vigExp: 1.8,
    mtfCenterOpen: 0.84, mtfCornerOpen: 0.66, mtfCenterStop: 0.91, mtfCornerStop: 0.82, mtfAstig: 0.09,
    cciTint: [1.002, 1.001, 0.997],
    pupilMag: 0.85, maxExtMm: 14.211, hoodType: 'slide',
    ghostTintA: [0.30, 0.74, 0.48], ghostTintB: [0.76, 0.48, 0.26],
  },
  // AI-S 135mm f/2.8 (5/4; exact thin-lens ext at 1.30 m = 18.071 mm)
  'ais-135-2.8': {
    design: 'AI-S 135/2.8 (5/4)', elements: 5, groups: 4, focalCalMm: 135.2, maxAperture: 2.8, minFocusM: 1.30,
    transmission: 0.94, entrancePupilMm: 34.0,
    k1: 0.006, k2: 0.0, caLat: 0.0009, caLong: 0.16, saGlow: 0.14, catsEye: 0.30,
    astig: 0.10, coma: 0.12, fieldCurv: 0.09, vigOpen: 0.56, vigStop: 0.18, vigExp: 1.8,
    mtfCenterOpen: 0.80, mtfCornerOpen: 0.62, mtfCenterStop: 0.89, mtfCornerStop: 0.80, mtfAstig: 0.10,
    cciTint: [1.003, 1.000, 0.996],
    pupilMag: 0.78, maxExtMm: 18.071, hoodType: 'slide',
    ghostTintA: [0.32, 0.72, 0.48], ghostTintB: [0.76, 0.46, 0.26],
  },
});
