// The Canon FD system's lenses for the all-black AE-1 (35 mm SLR, 42.0 mm flange focal distance).
// Six classic breech-lock S.S.C. lenses spanning 24 mm wide to 135 mm telephoto, with datasheet optical prescriptions.
import { registerLensOptics } from '../../optics.js';

const STOPS_14_16 = [1.4, 2, 2.8, 4, 5.6, 8, 11, 16];
const STOPS_18_16 = [1.8, 2.8, 4, 5.6, 8, 11, 16];
const STOPS_2_16  = [2, 2.8, 4, 5.6, 8, 11, 16];
const STOPS_28_16 = [2.8, 4, 5.6, 8, 11, 16];
const STOPS_28_22 = [2.8, 4, 5.6, 8, 11, 16, 22];

function lens(o) {
  return {
    minAperture: o.apertureStops[o.apertureStops.length - 1],
    transmissionFactor: 0.93, halationIntensity: 0.2, vignetteIntensity: 0.28,
    system: 'canon-fd', projection: 'rectilinear', shutter: null, filterSize: 55,
    ...o,
  };
}

export const AE1_LENSES = [
  lens({
    id: 'fd-24-2.8',
    name: '24 mm ƒ/2.8 Wide',
    kind: 'Wide',
    focalLength: 24, maxAperture: 2.8, apertureStops: STOPS_28_16,
    angleOfView: 84, fov: 74,
    minFocusDistance: 0.3,
    transmissionFactor: 0.91, vignetteIntensity: 0.40,
    use: 'Wide: floating-element retrofocus wide angle for sweeping scenes',
    shade: 'BW-55A', shadeName: 'BW-55A bayonet hood',
    shadeNote: 'Wide-angle bayonet shade for 24–28 mm FD lenses',
  }),
  lens({
    id: 'fd-28-2.8',
    name: '28 mm ƒ/2.8 Wide',
    kind: 'Wide',
    focalLength: 28, maxAperture: 2.8, apertureStops: STOPS_28_22,
    angleOfView: 75, fov: 65,
    minFocusDistance: 0.3,
    transmissionFactor: 0.92, vignetteIntensity: 0.34,
    use: 'Wide: crisp everyday street and landscape focal length',
    shade: 'BW-55A', shadeName: 'BW-55A bayonet hood',
    shadeNote: 'Wide-angle bayonet shade',
  }),
  lens({
    id: 'fd-35-2',
    name: '35 mm ƒ/2 Wide',
    kind: 'Wide',
    focalLength: 35, maxAperture: 2, apertureStops: STOPS_2_16,
    angleOfView: 63, fov: 54,
    minFocusDistance: 0.3,
    transmissionFactor: 0.91, vignetteIntensity: 0.32,
    use: 'Reportage: high-contrast concave-front 35 mm S.S.C. classic',
    shade: 'BW-55B', shadeName: 'BW-55B bayonet hood',
    shadeNote: 'Bayonet shade for the 35 mm ƒ/2',
  }),
  lens({
    id: 'fd-50-1.4',
    name: '50 mm ƒ/1.4 Standard',
    kind: 'Standard',
    focalLength: 50, maxAperture: 1.4, apertureStops: STOPS_14_16,
    angleOfView: 47, fov: 40,
    minFocusDistance: 0.45,
    transmissionFactor: 0.93, halationIntensity: 0.24, vignetteIntensity: 0.34,
    use: 'Standard: the flagship S.S.C. 50 mm — luminous at ƒ/1.4, razor sharp by ƒ/4',
    shade: 'BS-55', shadeName: 'BS-55 bayonet hood',
    shadeNote: 'Standard bayonet hood for the 50 mm ƒ/1.4 S.S.C.',
  }),
  lens({
    id: 'fd-85-1.8',
    name: '85 mm ƒ/1.8 Portrait',
    kind: 'Portrait',
    focalLength: 85, maxAperture: 1.8, apertureStops: STOPS_18_16,
    angleOfView: 28.5, fov: 24,
    minFocusDistance: 0.85,
    transmissionFactor: 0.94, halationIntensity: 0.16, vignetteIntensity: 0.22,
    use: 'Portrait: fast short telephoto with smooth background separation',
    shade: 'BT-55', shadeName: 'BT-55 bayonet hood',
    shadeNote: 'Deep bayonet portrait shade',
  }),
  lens({
    id: 'fd-135-2.8',
    name: '135 mm ƒ/2.8 Tele',
    kind: 'Tele',
    focalLength: 135, maxAperture: 2.8, apertureStops: STOPS_28_22,
    angleOfView: 18, fov: 15,
    minFocusDistance: 1.3,
    transmissionFactor: 0.94, halationIntensity: 0.14, vignetteIntensity: 0.18,
    use: 'Telephoto: crisp compressed perspective with built-in sliding shade',
    shade: 'built-in', shadeName: 'Built-in sliding hood',
    shadeNote: 'Telescopic metal shade built onto the 135 mm barrel',
  }),
];

registerLensOptics({
  // FD 24mm f/2.8 S.S.C. (9 elements in 8 groups, floating rear group)
  'fd-24-2.8': {
    design: 'FD 24 S.S.C. (9/8)', elements: 9, groups: 8, focalCalMm: 24.4, maxAperture: 2.8, minFocusM: 0.3,
    transmission: 0.91, entrancePupilMm: 18.0,
    k1: -0.018, k2: 0.002, caLat: 0.0014, caLong: 0.16, saGlow: 0.18, catsEye: 0.46,
    astig: 0.20, coma: 0.22, fieldCurv: 0.14, vigOpen: 0.88, vigStop: 0.38, vigExp: 2.2,
    mtfCenterOpen: 0.70, mtfCornerOpen: 0.40, mtfCenterStop: 0.83, mtfCornerStop: 0.64, mtfAstig: 0.18,
    cciTint: [1.006, 1.001, 0.992],
    pupilMag: 1.72, maxExtMm: 2.393, hoodType: 'bayonet',
    ghostTintA: [0.36, 0.68, 0.44], ghostTintB: [0.68, 0.28, 0.56],
  },
  // FD 28mm f/2.8 S.C. (7 elements in 7 groups)
  'fd-28-2.8': {
    design: 'FD 28 S.C. (7/7)', elements: 7, groups: 7, focalCalMm: 28.3, maxAperture: 2.8, minFocusM: 0.3,
    transmission: 0.92, entrancePupilMm: 19.0,
    k1: -0.012, k2: 0.001, caLat: 0.0012, caLong: 0.15, saGlow: 0.16, catsEye: 0.44,
    astig: 0.18, coma: 0.20, fieldCurv: 0.16, vigOpen: 0.80, vigStop: 0.32, vigExp: 2.1,
    mtfCenterOpen: 0.71, mtfCornerOpen: 0.44, mtfCenterStop: 0.83, mtfCornerStop: 0.66, mtfAstig: 0.16,
    cciTint: [1.005, 1.001, 0.994],
    pupilMag: 1.56, maxExtMm: 3.336, hoodType: 'bayonet',
    ghostTintA: [0.34, 0.66, 0.48], ghostTintB: [0.66, 0.30, 0.54],
  },
  // FD 35mm f/2 S.S.C. (9 elements in 8 groups, concave front, warm lanthanum/thorium glass)
  'fd-35-2': {
    design: 'FD 35/2 S.S.C. (9/8)', elements: 9, groups: 8, focalCalMm: 35.4, maxAperture: 2, minFocusM: 0.3,
    transmission: 0.91, entrancePupilMm: 22.0,
    k1: -0.009, k2: 0.001, caLat: 0.0010, caLong: 0.18, saGlow: 0.22, catsEye: 0.48,
    astig: 0.16, coma: 0.22, fieldCurv: 0.12, vigOpen: 0.82, vigStop: 0.30, vigExp: 2.0,
    mtfCenterOpen: 0.74, mtfCornerOpen: 0.48, mtfCenterStop: 0.86, mtfCornerStop: 0.70, mtfAstig: 0.14,
    cciTint: [1.022, 1.008, 0.962],
    pupilMag: 1.38, maxExtMm: 5.605, hoodType: 'bayonet',
    ghostTintA: [0.38, 0.70, 0.42], ghostTintB: [0.72, 0.42, 0.22],
  },
  // FD 50mm f/1.4 S.S.C. (7 elements in 6 groups): iconic 70s Double-Gauss standard
  'fd-50-1.4': {
    design: 'FD 50/1.4 S.S.C. (7/6)', elements: 7, groups: 6, focalCalMm: 50.6, maxAperture: 1.4, minFocusM: 0.45,
    transmission: 0.93, entrancePupilMm: 25.0,
    k1: -0.005, k2: 0, caLat: 0.0009, caLong: 0.28, saGlow: 0.44, catsEye: 0.58,
    astig: 0.26, coma: 0.34, fieldCurv: 0.18, vigOpen: 0.84, vigStop: 0.24, vigExp: 1.95,
    mtfCenterOpen: 0.62, mtfCornerOpen: 0.28, mtfCenterStop: 0.85, mtfCornerStop: 0.64, mtfAstig: 0.22,
    cciTint: [1.010, 1.002, 0.988],
    pupilMag: 1.02, maxExtMm: 7.502, hoodType: 'bayonet',
    ghostTintA: [0.32, 0.72, 0.46], ghostTintB: [0.68, 0.26, 0.58],
  },
  // FD 85mm f/1.8 S.S.C. (6 elements in 4 groups): classic portrait lens
  'fd-85-1.8': {
    design: 'FD 85/1.8 S.S.C. (6/4)', elements: 6, groups: 4, focalCalMm: 85.2, maxAperture: 1.8, minFocusM: 0.85,
    transmission: 0.94, entrancePupilMm: 34.0,
    k1: 0.002, k2: 0, caLat: 0.0008, caLong: 0.26, saGlow: 0.28, catsEye: 0.54,
    astig: 0.16, coma: 0.20, fieldCurv: 0.12, vigOpen: 0.64, vigStop: 0.20, vigExp: 1.85,
    mtfCenterOpen: 0.72, mtfCornerOpen: 0.50, mtfCenterStop: 0.85, mtfCornerStop: 0.72, mtfAstig: 0.14,
    cciTint: [1.008, 1.001, 0.992],
    pupilMag: 0.86, maxExtMm: 10.855, hoodType: 'bayonet',
    ghostTintA: [0.34, 0.68, 0.50], ghostTintB: [0.64, 0.30, 0.56],
  },
  // FD 135mm f/2.8 S.C. (6 elements in 5 groups)
  'fd-135-2.8': {
    design: 'FD 135/2.8 S.C. (6/5)', elements: 6, groups: 5, focalCalMm: 135.0, maxAperture: 2.8, minFocusM: 1.3,
    transmission: 0.94, entrancePupilMm: 48.0,
    k1: 0.004, k2: 0, caLat: 0.0009, caLong: 0.22, saGlow: 0.14, catsEye: 0.48,
    astig: 0.12, coma: 0.14, fieldCurv: 0.08, vigOpen: 0.50, vigStop: 0.18, vigExp: 1.8,
    mtfCenterOpen: 0.74, mtfCornerOpen: 0.56, mtfCenterStop: 0.84, mtfCornerStop: 0.72, mtfAstig: 0.11,
    cciTint: [1.004, 1.000, 0.996],
    pupilMag: 0.76, maxExtMm: 18.009, hoodType: 'integral',
    ghostTintA: [0.36, 0.62, 0.58], ghostTintB: [0.66, 0.36, 0.44],
  },
});
