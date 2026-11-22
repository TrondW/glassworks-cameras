// The Intrepid 4×5's lenses, as the engine's lens records. Large-format lenses are mounted in their own leaf shutter
// (Copal No. 0 or No. 1), on a 96 × 99 mm Technika-size board; they have no focusing mount: the bellows focuses them.
// Six classic 4×5 lenses spanning 75 mm super-wide to 300 mm long-focus, with authentic image circles (constraining
// rise, shift, tilt and swing in lensview.js) and datasheet optical prescriptions.
import { registerLensOptics } from '../../optics.js';

const STOPS_56_45 = [5.6, 8, 11, 16, 22, 32, 45];
const STOPS_56_64 = [5.6, 8, 11, 16, 22, 32, 45, 64];
const STOPS_63_45 = [6.3, 8, 11, 16, 22, 32, 45];
const STOPS_9_64  = [9, 11, 16, 22, 32, 45, 64];

/** A lens record in the app's shape (data.js), with the fields the engine asks of every lens (cameras.js). */
function lens(o) {
  return {
    minAperture: o.apertureStops[o.apertureStops.length - 1],
    transmissionFactor: 0.93, halationIntensity: 0.15, vignetteIntensity: 0.2,
    system: 'large-format', projection: 'rectilinear',
    ...o,
  };
}

export const INTREPID_LENSES = [
  lens({
    id: 'lf-75-5.6',
    name: '75 mm ƒ/5.6 Super-Wide',
    kind: 'Wide',
    focalLength: 75, maxAperture: 5.6, apertureStops: STOPS_56_45,
    angleOfView: 92, fov: 77,
    minFocusDistance: 0.35, filterSize: 67,
    shutter: 'copal-0',
    imageCircle: 198,
    flangeFocal: 82,
    transmissionFactor: 0.90, vignetteIntensity: 0.45,
    use: 'Super-wide: dramatic architecture and sweeping landscapes',
    shade: 'screw-in',
    shadeName: 'Wide-angle lens shade',
  }),
  lens({
    id: 'lf-90-5.6',
    name: '90 mm ƒ/5.6 Wide',
    kind: 'Wide',
    focalLength: 90, maxAperture: 5.6, apertureStops: STOPS_56_45,
    angleOfView: 81, fov: 67,
    minFocusDistance: 0.42, filterSize: 82,
    shutter: 'copal-0',
    imageCircle: 235,
    flangeFocal: 98,
    transmissionFactor: 0.91, vignetteIntensity: 0.36,
    use: 'Wide: generous 235 mm image circle for architectural rise and shift',
    shade: 'screw-in',
    shadeName: 'Wide-angle lens shade',
  }),
  lens({
    id: 'lf-135-5.6',
    name: '135 mm ƒ/5.6 Moderate Wide',
    kind: 'Wide',
    focalLength: 135, maxAperture: 5.6, apertureStops: STOPS_56_64,
    angleOfView: 60, fov: 48,
    minFocusDistance: 0.56, filterSize: 40.5,
    shutter: 'copal-0',
    imageCircle: 208,
    flangeFocal: 130,
    transmissionFactor: 0.93, vignetteIntensity: 0.24,
    use: 'Moderate wide: compact 6-element Plasmat for field landscapes',
    shade: 'screw-in',
    shadeName: 'Standard lens shade',
  }),
  lens({
    id: 'lf-150-6.3',
    name: '150 mm ƒ/6.3 Standard',
    kind: 'Standard',
    focalLength: 150, maxAperture: 6.3, apertureStops: STOPS_63_45,
    // (4×5's 120 × 96 mm frame: 44° across, 54° corner to corner)
    angleOfView: 54, fov: 44,
    // (0.62 m from the film: 104 mm of extension beyond infinity, about 1:1.4; the 300 mm bellows has more in hand)
    minFocusDistance: 0.62, filterSize: 40.5,
    shutter: 'copal-0',
    imageCircle: 210,
    // (the board's face to the film at infinity: the rear principal point taken at the iris, 7 mm in front of the board)
    flangeFocal: 143,
    use: 'Standard: about what the eye sees',
    shade: 'screw-in',
    shadeName: 'Standard lens shade',
  }),
  lens({
    id: 'lf-210-5.6',
    name: '210 mm ƒ/5.6 Portrait',
    kind: 'Portrait',
    focalLength: 210, maxAperture: 5.6, apertureStops: STOPS_56_64,
    angleOfView: 40, fov: 32,
    minFocusDistance: 0.88, filterSize: 72,
    shutter: 'copal-1',
    imageCircle: 301,
    flangeFocal: 201,
    transmissionFactor: 0.93, vignetteIntensity: 0.16,
    use: 'Portrait & studio: huge 301 mm image circle for extreme movements',
    shade: 'screw-in',
    shadeName: 'Telephoto lens shade',
  }),
  lens({
    id: 'lf-300-9',
    name: '300 mm ƒ/9 Long Focus',
    kind: 'Tele',
    focalLength: 300, maxAperture: 9, apertureStops: STOPS_9_64,
    angleOfView: 29, fov: 23,
    minFocusDistance: 1.50, filterSize: 52,
    shutter: 'copal-1',
    imageCircle: 325,
    flangeFocal: 290,
    transmissionFactor: 0.95, halationIntensity: 0.12, vignetteIntensity: 0.12,
    use: 'Long focus: compact Tessar-type lens for compressed distant vistas',
    shade: 'screw-in',
    shadeName: 'Deep telephoto shade',
  }),
];

registerLensOptics({
  // 75mm f/5.6 Biogon-type Super-Wide (8 elements in 4 groups): very low distortion, strong natural cos⁴ falloff
  'lf-75-5.6': {
    design: 'Super-Wide 75 (8/4)', elements: 8, groups: 4, focalCalMm: 75.2, maxAperture: 5.6, minFocusM: 0.35,
    transmission: 0.90, entrancePupilMm: 22,
    k1: -0.002, k2: 0, caLat: 0.0008, caLong: 0.12, saGlow: 0.14, catsEye: 0.15,
    astig: 0.18, coma: 0.14, fieldCurv: 0.14, vigOpen: 0.84, vigStop: 0.62, vigExp: 2.3,
    mtfCenterOpen: 0.68, mtfCornerOpen: 0.42, mtfCenterStop: 0.82, mtfCornerStop: 0.68, mtfAstig: 0.16,
    cciTint: [1.004, 1.000, 0.994],
    pupilMag: 1.05, maxExtMm: 34.188, hoodType: 'screw-in',
    ghostTintA: [0.46, 0.32, 0.68], ghostTintB: [0.30, 0.58, 0.46],
  },
  // 90mm f/5.6 Symmetrical Wide (8 elements in 4 groups): expansive 235 mm circle, zero distortion
  'lf-90-5.6': {
    design: 'Wide-Field 90 (8/4)', elements: 8, groups: 4, focalCalMm: 90.3, maxAperture: 5.6, minFocusM: 0.42,
    transmission: 0.91, entrancePupilMm: 24,
    k1: -0.001, k2: 0, caLat: 0.0007, caLong: 0.11, saGlow: 0.12, catsEye: 0.14,
    astig: 0.15, coma: 0.12, fieldCurv: 0.12, vigOpen: 0.74, vigStop: 0.52, vigExp: 2.2,
    mtfCenterOpen: 0.70, mtfCornerOpen: 0.46, mtfCenterStop: 0.84, mtfCornerStop: 0.72, mtfAstig: 0.14,
    cciTint: [1.004, 1.000, 0.995],
    pupilMag: 1.02, maxExtMm: 41.125, hoodType: 'screw-in',
    ghostTintA: [0.48, 0.34, 0.66], ghostTintB: [0.32, 0.56, 0.44],
  },
  // 135mm f/5.6 Symmetrical Plasmat (6 elements in 4 groups)
  'lf-135-5.6': {
    design: 'Plasmat 135 (6/4)', elements: 6, groups: 4, focalCalMm: 135.0, maxAperture: 5.6, minFocusM: 0.56,
    transmission: 0.93, entrancePupilMm: 14,
    k1: 0.001, k2: 0, caLat: 0.0005, caLong: 0.10, saGlow: 0.14, catsEye: 0.18,
    astig: 0.14, coma: 0.12, fieldCurv: 0.12, vigOpen: 0.56, vigStop: 0.34, vigExp: 1.9,
    mtfCenterOpen: 0.72, mtfCornerOpen: 0.48, mtfCenterStop: 0.85, mtfCornerStop: 0.74, mtfAstig: 0.12,
    cciTint: [1.002, 1.000, 0.998],
    pupilMag: 1.0, maxExtMm: 92.085, hoodType: 'screw-in',
    ghostTintA: [0.52, 0.38, 0.32], ghostTintB: [0.28, 0.54, 0.48],
  },
  // 150mm f/6.3 Compact Triplet (3 elements in 3 groups)
  'lf-150-6.3': {
    design: 'Triplet', elements: 3, groups: 3, focalCalMm: 150, maxAperture: 6.3, minFocusM: 0.62,
    transmission: 0.93,
    entrancePupilMm: 10,
    k1: 0.004, k2: 0, caLat: 0.0006, caLong: 0.16, saGlow: 0.22, catsEye: 0.2,
    astig: 0.3, coma: 0.22, fieldCurv: 0.28, vigOpen: 0.55, vigStop: 0.36, vigExp: 1.8,
    mtfCenterOpen: 0.6, mtfCornerOpen: 0.3, mtfCenterStop: 0.78, mtfCornerStop: 0.56, mtfAstig: 0.25,
    cciTint: [1.006, 1.0, 0.99],
    pupilMag: 1.0, maxExtMm: 104.322, hoodType: 'screw-in',
    ghostTintA: [0.5, 0.42, 0.3], ghostTintB: [0.3, 0.48, 0.42],
  },
  // 210mm f/5.6 Symmetrical Plasmat in Copal 1 (6 elements in 4 groups): reference large-format portrait & field lens
  'lf-210-5.6': {
    design: 'Plasmat 210 (6/4)', elements: 6, groups: 4, focalCalMm: 210.2, maxAperture: 5.6, minFocusM: 0.88,
    transmission: 0.93, entrancePupilMm: 22,
    k1: 0.001, k2: 0, caLat: 0.0004, caLong: 0.09, saGlow: 0.10, catsEye: 0.16,
    astig: 0.10, coma: 0.10, fieldCurv: 0.08, vigOpen: 0.42, vigStop: 0.22, vigExp: 1.8,
    mtfCenterOpen: 0.76, mtfCornerOpen: 0.60, mtfCenterStop: 0.86, mtfCornerStop: 0.78, mtfAstig: 0.10,
    cciTint: [1.002, 1.000, 0.998],
    pupilMag: 1.0, maxExtMm: 136.935, hoodType: 'screw-in',
    ghostTintA: [0.44, 0.36, 0.64], ghostTintB: [0.30, 0.56, 0.46],
  },
  // 300mm f/9 Compact Tessar / Process lens in Copal 1 (4 elements in 3 groups): ultra-flat field & apochromatic crispness
  'lf-300-9': {
    design: 'Tessar 300 (4/3)', elements: 4, groups: 3, focalCalMm: 299.5, maxAperture: 9, minFocusM: 1.50,
    transmission: 0.95, entrancePupilMm: 18,
    k1: 0.002, k2: 0, caLat: 0.0003, caLong: 0.04, saGlow: 0.06, catsEye: 0.14,
    astig: 0.08, coma: 0.08, fieldCurv: 0.05, vigOpen: 0.34, vigStop: 0.16, vigExp: 1.7,
    mtfCenterOpen: 0.78, mtfCornerOpen: 0.64, mtfCenterStop: 0.85, mtfCornerStop: 0.78, mtfAstig: 0.08,
    cciTint: [1.000, 1.000, 1.001],
    pupilMag: 0.96, maxExtMm: 113.974, hoodType: 'screw-in',
    ghostTintA: [0.40, 0.54, 0.68], ghostTintB: [0.60, 0.46, 0.30],
  },
});
