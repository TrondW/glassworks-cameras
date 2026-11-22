// The Leica M system's lenses for the M6, as the engine's lens records. The owner's own lens comes first: the third
// Summicron 50 mm f/2 (Leitz code 11817, black anodised, 1969–1979, engraved Germany), alongside five classic M lenses
// covering all three bright-line frame pairs in the 0.72× finder (28+90, 35+135, 50+75).
//
// Sources: local reference notes, Leica 1989 Dealer Handbook, Erwin Puts (Leica Lens Compendium).
import { registerLensOptics } from '../../optics.js';

const STOPS_14 = [1.4, 2, 2.8, 4, 5.6, 8, 11, 16];
const STOPS_2  = [2, 2.8, 4, 5.6, 8, 11, 16];
const STOPS_28 = [2.8, 4, 5.6, 8, 11, 16, 22];
const STOPS_4  = [4, 5.6, 8, 11, 16, 22];

/** A lens record in the app's shape (data.js), with the fields the engine asks of every lens (cameras.js). */
function lens(o) {
  return {
    minAperture: o.apertureStops[o.apertureStops.length - 1],
    transmissionFactor: 0.92, halationIntensity: 0.2, vignetteIntensity: 0.3,
    system: 'leica-m', projection: 'rectilinear', shutter: null,
    ...o,
  };
}

export const M6_LENSES = [
  lens({
    id: 'leica-elmarit-2.8-28',
    name: '28 mm ƒ/2.8 Wide',
    kind: 'Wide',
    focalLength: 28, maxAperture: 2.8, apertureStops: STOPS_28,
    angleOfView: 75, fov: 65,
    minFocusDistance: 0.7, filterSize: 46,
    transmissionFactor: 0.91, vignetteIntensity: 0.42,
    use: 'Wide: street scenes and architecture, crisp across the frame',
    frames: [28, 90],
    shade: '12536',
    shadeName: '12536 rectangular hood',
    shadeNote: 'Clip-on rectangular shade; keeps stray side light off the wide front element',
  }),
  lens({
    id: 'leica-summicron-2-35',
    name: '35 mm ƒ/2 Wide',
    kind: 'Wide',
    focalLength: 35, maxAperture: 2, apertureStops: STOPS_2,
    angleOfView: 63, fov: 54,
    minFocusDistance: 0.7, filterSize: 39,
    transmissionFactor: 0.93, vignetteIntensity: 0.34,
    use: 'Reportage: the classic 35 mm street and environmental lens',
    frames: [35, 135],
    shade: '12524',
    shadeName: '12524 vented hood',
    shadeNote: 'Compact vented rectangular shade with finder cut-out',
  }),
  lens({
    id: 'leica-summicron-2-50-iii',
    name: '50 mm ƒ/2 Standard',
    kind: 'Standard',
    focalLength: 50, maxAperture: 2, apertureStops: STOPS_2,
    // (24 × 36: 27° high, 40° across, 47° corner to corner)
    angleOfView: 47, fov: 40,
    minFocusDistance: 0.7, filterSize: 39,
    use: 'Standard: about what the eye sees',
    // the bright-line frames it brings up in the finder (the 50 and the 75 together)
    frames: [50, 75],
    // its shade: the 12585 clips over the 42 mm front ring (the page's hood sheet and toasts read these)
    shade: '12585',
    shadeName: '12585 metal hood',
    shadeNote: 'Clips over the lens front; keeps a low sun off the front glass',
  }),
  lens({
    id: 'leica-summilux-1.4-50',
    name: '50 mm ƒ/1.4 Fast Standard',
    kind: 'Standard',
    focalLength: 50, maxAperture: 1.4, apertureStops: STOPS_14,
    angleOfView: 47, fov: 40,
    minFocusDistance: 1.0, filterSize: 43,
    transmissionFactor: 0.91, halationIntensity: 0.28, vignetteIntensity: 0.38,
    use: 'Low light: luminous wide-open glow at ƒ/1.4, razor sharp by ƒ/4',
    frames: [50, 75],
    shade: '12586',
    shadeName: '12586 vented hood',
    shadeNote: 'Vented cylindrical shade for the ƒ/1.4 front barrel',
  }),
  lens({
    id: 'leica-elmarit-2.8-90',
    name: '90 mm ƒ/2.8 Portrait',
    kind: 'Portrait',
    focalLength: 90, maxAperture: 2.8, apertureStops: STOPS_28,
    angleOfView: 27, fov: 23,
    minFocusDistance: 1.0, filterSize: 46,
    transmissionFactor: 0.94, halationIntensity: 0.14, vignetteIntensity: 0.22,
    use: 'Portrait: clean subject separation and crisp edge-to-edge contrast',
    frames: [90, 28],
    shade: 'built-in',
    shadeName: 'Built-in telescopic hood',
    shadeNote: 'Slides forward off the front barrel to shield the 90 mm objective',
  }),
  lens({
    id: 'leica-tele-elmar-4-135',
    name: '135 mm ƒ/4 Tele',
    kind: 'Tele',
    focalLength: 135, maxAperture: 4, apertureStops: STOPS_4,
    angleOfView: 18, fov: 15,
    minFocusDistance: 1.5, filterSize: 39,
    transmissionFactor: 0.95, halationIntensity: 0.12, vignetteIntensity: 0.18,
    use: 'Telephoto: pulls distant details close with near-apochromatic clarity',
    frames: [135, 35],
    shade: '12575',
    shadeName: '12575 metal hood',
    shadeNote: 'Deep clip-on telephoto shade',
  }),
];

registerLensOptics({
  // 28mm f/2.8 Elmarit-M (v3/v4, 8 elements in 6 groups): retrofocus-lite symmetrical wide
  'leica-elmarit-2.8-28': {
    design: 'Elmarit-M 28', elements: 8, groups: 6, focalCalMm: 28.4, maxAperture: 2.8, minFocusM: 0.7,
    transmission: 0.91, entrancePupilMm: 16.5,
    k1: -0.008, k2: 0.001, caLat: 0.0012, caLong: 0.14, saGlow: 0.16, catsEye: 0.44,
    astig: 0.18, coma: 0.22, fieldCurv: 0.18, vigOpen: 0.92, vigStop: 0.42, vigExp: 2.1,
    mtfCenterOpen: 0.72, mtfCornerOpen: 0.44, mtfCenterStop: 0.84, mtfCornerStop: 0.68, mtfAstig: 0.18,
    cciTint: [1.008, 1.002, 0.990],
    pupilMag: 1.48, maxExtMm: 1.256, hoodType: 'clip-on',
    ghostTintA: [0.52, 0.36, 0.68], ghostTintB: [0.34, 0.62, 0.44],
  },
  // 35mm f/2 Summicron-M (v4 7-element "King of Bokeh", 7 elements in 5 groups)
  'leica-summicron-2-35': {
    design: 'Summicron-M 35 (IV)', elements: 7, groups: 5, focalCalMm: 35.6, maxAperture: 2, minFocusM: 0.7,
    transmission: 0.93, entrancePupilMm: 15.2,
    k1: -0.004, k2: 0.0005, caLat: 0.0009, caLong: 0.18, saGlow: 0.28, catsEye: 0.48,
    astig: 0.22, coma: 0.26, fieldCurv: 0.16, vigOpen: 0.86, vigStop: 0.34, vigExp: 2.0,
    mtfCenterOpen: 0.70, mtfCornerOpen: 0.38, mtfCenterStop: 0.85, mtfCornerStop: 0.64, mtfAstig: 0.20,
    cciTint: [1.010, 1.001, 0.988],
    pupilMag: 1.18, maxExtMm: 2.022, hoodType: 'clip-on',
    ghostTintA: [0.58, 0.40, 0.28], ghostTintB: [0.28, 0.56, 0.48],
  },
  // 50mm f/2 Summicron-M (v3 11817, 6 elements in 5 groups)
  'leica-summicron-2-50-iii': {
    design: 'Summicron (III)', elements: 6, groups: 5, focalCalMm: 51.9, maxAperture: 2, minFocusM: 0.7,
    transmission: 0.92, entrancePupilMm: 23.0,
    // zero distortion; little lateral colour; more spherical aberration (glow wide open) than the later 50s
    k1: 0, k2: 0, caLat: 0.0008, caLong: 0.22, saGlow: 0.42, catsEye: 0.5,
    // centre high, edges low, and the field barely improves stopped down
    astig: 0.3, coma: 0.3, fieldCurv: 0.2, vigOpen: 0.82, vigStop: 0.3, vigExp: 1.9,
    mtfCenterOpen: 0.66, mtfCornerOpen: 0.24, mtfCenterStop: 0.84, mtfCornerStop: 0.4, mtfAstig: 0.3,
    cciTint: [1.012, 1.002, 0.984],
    // a near-symmetric double-Gauss: pupils about equal; exact thin-lens travel to 0.7 m: 4.553 mm
    pupilMag: 0.98, maxExtMm: 4.553, hoodType: 'clip-on',
    ghostTintA: [0.62, 0.42, 0.24], ghostTintB: [0.3, 0.55, 0.42],
  },
  // 50mm f/1.4 Summilux-M (pre-ASPH 7 elements in 5 groups): luminous wide-open glow, classic portrait rendering
  'leica-summilux-1.4-50': {
    design: 'Summilux-M 50 (pre-ASPH)', elements: 7, groups: 5, focalCalMm: 51.6, maxAperture: 1.4, minFocusM: 1.0,
    transmission: 0.91, entrancePupilMm: 24.5,
    k1: -0.002, k2: 0, caLat: 0.0010, caLong: 0.32, saGlow: 0.56, catsEye: 0.62,
    astig: 0.34, coma: 0.38, fieldCurv: 0.22, vigOpen: 0.88, vigStop: 0.28, vigExp: 1.95,
    mtfCenterOpen: 0.56, mtfCornerOpen: 0.22, mtfCenterStop: 0.84, mtfCornerStop: 0.58, mtfAstig: 0.28,
    cciTint: [1.015, 1.003, 0.980],
    pupilMag: 0.96, maxExtMm: 2.979, hoodType: 'clip-on',
    ghostTintA: [0.66, 0.38, 0.22], ghostTintB: [0.28, 0.52, 0.62],
  },
  // 90mm f/2.8 Elmarit-M (4 elements in 4 groups): compact, ultra-crisp portrait telephoto
  'leica-elmarit-2.8-90': {
    design: 'Elmarit-M 90', elements: 4, groups: 4, focalCalMm: 90.0, maxAperture: 2.8, minFocusM: 1.0,
    transmission: 0.94, entrancePupilMm: 36.0,
    k1: 0.003, k2: 0, caLat: 0.0007, caLong: 0.16, saGlow: 0.14, catsEye: 0.46,
    astig: 0.12, coma: 0.12, fieldCurv: 0.10, vigOpen: 0.48, vigStop: 0.18, vigExp: 1.8,
    mtfCenterOpen: 0.76, mtfCornerOpen: 0.58, mtfCenterStop: 0.85, mtfCornerStop: 0.72, mtfAstig: 0.12,
    cciTint: [1.004, 1.000, 0.996],
    pupilMag: 0.82, maxExtMm: 10.000, hoodType: 'integral',
    ghostTintA: [0.44, 0.28, 0.68], ghostTintB: [0.30, 0.60, 0.46],
  },
  // 135mm f/4 Tele-Elmar (4 elements in 4 groups): legendary resolution & apochromatic-grade colour correction
  'leica-tele-elmar-4-135': {
    design: 'Tele-Elmar 135', elements: 4, groups: 4, focalCalMm: 135.4, maxAperture: 4, minFocusM: 1.5,
    transmission: 0.95, entrancePupilMm: 52.0,
    k1: 0.004, k2: 0, caLat: 0.0005, caLong: 0.08, saGlow: 0.08, catsEye: 0.40,
    astig: 0.08, coma: 0.08, fieldCurv: 0.06, vigOpen: 0.40, vigStop: 0.16, vigExp: 1.75,
    mtfCenterOpen: 0.78, mtfCornerOpen: 0.64, mtfCenterStop: 0.84, mtfCornerStop: 0.74, mtfAstig: 0.09,
    cciTint: [1.000, 1.000, 1.002],
    pupilMag: 0.72, maxExtMm: 15.100, hoodType: 'clip-on',
    ghostTintA: [0.38, 0.58, 0.72], ghostTintB: [0.64, 0.44, 0.28],
  },
});
