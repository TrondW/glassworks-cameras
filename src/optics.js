// Pure camera & lens optical mathematics, prescription registry, helicoid extension,
// depth-of-field limits, MTF/vignette profiles, and physical filter appearances.
// Decoupled from any rendering engine so every camera system in glassworks-cameras
// shares one single source of optical truth.

import { SHUTTERS } from './shutters.js';

export const FORMAT_MM = 56;        // 6×6 nominal image side (default CoC/FoV reference)
export const COC_MM = 0.05;         // medium-format circle of confusion default

// Hasselblad CF leaf-shutter speeds (Prontor/Compur): 1 s – 1/500, full stops.
export const SHUTTER_SPEEDS = SHUTTERS['prontor-cf'].speeds;

export const log2 = Math.log2;
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Nearest shutter speed index for a target exposure time (seconds). */
export function nearestShutterIndex(seconds, speeds = SHUTTER_SPEEDS) {
  let best = 0, bestDiff = Infinity;
  speeds.forEach((s, i) => {
    const d = Math.abs(log2(seconds / s.t));
    if (d < bestDiff) { bestDiff = d; best = i; }
  });
  return best;
}

/** Nearest aperture stop index on a lens for a target f-number. */
export function nearestApertureIndex(stops, fNumber) {
  let best = 0, bestDiff = Infinity;
  stops.forEach((n, i) => {
    const d = Math.abs(log2((fNumber * fNumber) / (n * n)));
    if (d < bestDiff) { bestDiff = d; best = i; }
  });
  return best;
}

/** Hyperfocal distance in metres: H = f² / (N · c) + f. */
export function hyperfocal(focalMm, aperture, coc = COC_MM) {
  if (!Number.isFinite(focalMm) || focalMm <= 0) return 0;
  if (!Number.isFinite(aperture) || aperture <= 0 || !Number.isFinite(coc) || coc <= 0) return Infinity;
  return ((focalMm * focalMm) / (aperture * coc) + focalMm) / 1000;
}

/**
 * Near/far DoF limits in metres from the film plane; far = Infinity past the hyperfocal point.
 * Exact thin-lens formulation: focused at `distance`, the lens stands v from the film and
 * u = distance − v from the subject, so close-up limits remain accurate down to macro ratios.
 */
export function dofLimits(distance, focalMm, aperture, coc = COC_MM) {
  const f = focalMm;
  if (!Number.isFinite(f) || f <= 0) return { near: 0, far: Infinity };
  if (distance == null || Number.isNaN(distance) || distance >= 1e5) return { near: hyperfocal(f, aperture, coc), far: Infinity };
  const s = Math.max(distance * 1000, 4.01 * f);
  const v = (s - Math.sqrt(s * s - 4 * f * s)) / 2, u = s - v;
  if (!Number.isFinite(aperture) || aperture <= 0 || !Number.isFinite(coc) || coc <= 0) return { near: s / 1000, far: s / 1000 };
  const k = (aperture * coc) / (f * v);
  const near = (1 / (1 / u + k) + v) / 1000;
  const inv = 1 / u - k;
  const far = inv <= 1e-9 ? Infinity : (1 / inv + v) / 1000;
  return { near, far };
}

/**
 * Blur scale: CoC diameter on film (mm) per unit |1/s − 1/d| (m⁻¹) measured from the entrance pupil.
 * Exact for the paraxial thick lens: c = (f_cal · v_eff / N) · |1/s − 1/d|.
 */
export function cocScaleMm(lens, aperture, focusM) {
  const focalMm = focalOf(lens), spec = lensOpticsFor(lens);
  const f = spec?.focalCalMm || focalMm;
  if (!Number.isFinite(aperture) || aperture <= 0) return 0;
  return (f * effectiveFocalMm(lens, focusM)) / aperture / 1000;
}

/** Field of view (degrees) of a lens across a frame side (mm). */
export function fovDegrees(focalMm, sideMm = FORMAT_MM) {
  if (!Number.isFinite(focalMm) || focalMm <= 0 || !Number.isFinite(sideMm) || sideMm <= 0) return 0;
  return (2 * Math.atan(sideMm / 2 / focalMm) * 180) / Math.PI;
}

export function formatAperture(n) {
  return `ƒ/${Number.isInteger(n) ? n : n >= 10 ? Math.round(n) : n.toFixed(1)}`;
}

export function formatDistance(m) {
  if (!isFinite(m) || m >= 100) return '∞';
  if (m >= 10) return `${m.toFixed(0)} m`;
  return `${m.toFixed(m < 1 ? 2 : 1)} m`;
}

/**
 * Lens optical prescriptions registry.
 * Pre-populated with the 11 Hasselblad V (CF) lenses; every other camera system registers its
 * lens table at import time via `registerLensOptics()`.
 */
export const LENS_OPTICS = {
  'zeiss-distagon-3.5-30': {
    design: 'F-Distagon', elements: 8, groups: 7, focalCalMm: 30.1, maxAperture: 3.5, minFocusM: 0.3,
    transmission: 0.90, entrancePupilMm: 14.0,
    k1: -0.22, k2: 0.045, caLat: 0.0024, caLong: 0.18, saGlow: 0.20, catsEye: 0.42,
    astig: 0.24, coma: 0.18, fieldCurv: 0.16, vigOpen: 0.54, vigStop: 0.22, vigExp: 2.1,
    mtfCenterOpen: 0.62, mtfCornerOpen: 0.28, mtfCenterStop: 0.76, mtfCornerStop: 0.52, mtfAstig: 0.24,
    cciTint: [1.018, 1.004, 0.976],
    pupilMag: 1.42, maxExtMm: 3.2, hoodType: 'integral',
    ghostTintA: [0.38, 0.22, 0.88], ghostTintB: [0.18, 0.82, 0.55],
  },
  'zeiss-distagon-4-40': {
    design: 'Distagon', elements: 11, groups: 9, focalCalMm: 40.7, maxAperture: 4.0, minFocusM: 0.5,
    transmission: 0.90, entrancePupilMm: 22.0,
    k1: -0.026, k2: 0.004, caLat: 0.0019, caLong: 0.16, saGlow: 0.18, catsEye: 0.54,
    astig: 0.22, coma: 0.16, fieldCurv: 0.08, vigOpen: 0.72, vigStop: 0.34, vigExp: 2.0,
    mtfCenterOpen: 0.64, mtfCornerOpen: 0.26, mtfCenterStop: 0.78, mtfCornerStop: 0.54, mtfAstig: 0.22,
    cciTint: [1.022, 1.005, 0.972],
    pupilMag: 1.34, maxExtMm: 3.8, hoodType: 'integral',
    fleStops: [Infinity, 2.0, 0.9, 0.5],
    fleLabels: ['∞', '2', '0.9', '0.5'],
    fleAngles: [-14, -4, 7, 18],
    ghostTintA: [0.45, 0.20, 0.85], ghostTintB: [0.85, 0.52, 0.16],
  },
  'zeiss-distagon-4-50': {
    design: 'Distagon', elements: 9, groups: 8, focalCalMm: 51.4, maxAperture: 4.0, minFocusM: 0.5,
    transmission: 0.94, entrancePupilMm: 24.5,
    k1: -0.019, k2: 0.003, caLat: 0.0016, caLong: 0.15, saGlow: 0.20, catsEye: 0.52,
    astig: 0.20, coma: 0.15, fieldCurv: 0.07, vigOpen: 0.68, vigStop: 0.30, vigExp: 1.95,
    mtfCenterOpen: 0.66, mtfCornerOpen: 0.32, mtfCenterStop: 0.80, mtfCornerStop: 0.58, mtfAstig: 0.18,
    cciTint: [1.016, 1.003, 0.980],
    pupilMag: 1.28, maxExtMm: 5.8, hoodType: 'b60-wide',
    fleStops: [Infinity, 4.0, 1.2, 0.8, 0.5],
    fleLabels: ['∞–4', '4–1.2', '1.2–0.8', '0.8–0.5'],
    fleAngles: [-18, -9, 1, 11, 21],
    ghostTintA: [0.42, 0.22, 0.86], ghostTintB: [0.16, 0.78, 0.52],
  },
  'zeiss-distagon-3.5-60': {
    design: 'Distagon', elements: 7, groups: 7, focalCalMm: 60.2, maxAperture: 3.5, minFocusM: 0.6,
    transmission: 0.94, entrancePupilMm: 26.0,
    k1: -0.013, k2: 0.002, caLat: 0.0012, caLong: 0.16, saGlow: 0.24, catsEye: 0.48,
    astig: 0.18, coma: 0.16, fieldCurv: 0.22, vigOpen: 0.65, vigStop: 0.26, vigExp: 1.9,
    mtfCenterOpen: 0.65, mtfCornerOpen: 0.34, mtfCenterStop: 0.81, mtfCornerStop: 0.62, mtfAstig: 0.16,
    cciTint: [1.012, 1.002, 0.985],
    pupilMag: 1.18, maxExtMm: 8.2, hoodType: 'b60-wide',
    ghostTintA: [0.52, 0.22, 0.82], ghostTintB: [0.20, 0.76, 0.50],
  },
  'zeiss-planar-2.8-80': {
    design: 'Planar', elements: 7, groups: 5, focalCalMm: 80.1, maxAperture: 2.8, minFocusM: 0.9,
    transmission: 0.95, entrancePupilMm: 31.0,
    k1: -0.007, k2: 0.001, caLat: 0.0009, caLong: 0.28, saGlow: 0.34, catsEye: 0.58,
    astig: 0.24, coma: 0.26, fieldCurv: 0.24, vigOpen: 0.70, vigStop: 0.22, vigExp: 1.85,
    mtfCenterOpen: 0.62, mtfCornerOpen: 0.30, mtfCenterStop: 0.84, mtfCornerStop: 0.66, mtfAstig: 0.20,
    cciTint: [1.008, 1.001, 0.990],
    pupilMag: 0.96, maxExtMm: 7.8, hoodType: 'b60-80',
    ghostTintA: [0.58, 0.20, 0.86], ghostTintB: [0.88, 0.56, 0.18],
  },
  'zeiss-planar-3.5-100': {
    design: 'Planar', elements: 5, groups: 4, focalCalMm: 100.4, maxAperture: 3.5, minFocusM: 0.9,
    transmission: 0.95, entrancePupilMm: 36.0,
    k1: -0.0008, k2: 0.0, caLat: 0.00045, caLong: 0.10, saGlow: 0.12, catsEye: 0.44,
    astig: 0.08, coma: 0.08, fieldCurv: 0.09, vigOpen: 0.52, vigStop: 0.15, vigExp: 1.9,
    mtfCenterOpen: 0.78, mtfCornerOpen: 0.62, mtfCenterStop: 0.88, mtfCornerStop: 0.76, mtfAstig: 0.06,
    cciTint: [1.002, 1.000, 0.998],
    pupilMag: 0.94, maxExtMm: 12.5, hoodType: 'b60-80',
    ghostTintA: [0.46, 0.24, 0.88], ghostTintB: [0.18, 0.80, 0.56],
  },
  'zeiss-makro-planar-4-120': {
    design: 'Makro-Planar', elements: 6, groups: 4, focalCalMm: 120.2, maxAperture: 4.0, minFocusM: 0.8,
    transmission: 0.95, entrancePupilMm: 44.0,
    k1: 0.0012, k2: 0.0, caLat: 0.0005, caLong: 0.09, saGlow: 0.14, catsEye: 0.42,
    astig: 0.07, coma: 0.07, fieldCurv: 0.02, vigOpen: 0.50, vigStop: 0.14, vigExp: 1.9,
    mtfCenterOpen: 0.76, mtfCornerOpen: 0.60, mtfCenterStop: 0.87, mtfCornerStop: 0.75, mtfAstig: 0.05,
    cciTint: [1.004, 1.000, 0.996],
    pupilMag: 0.91, maxExtMm: 22.0, hoodType: 'b60-tele',
    ghostTintA: [0.50, 0.22, 0.84], ghostTintB: [0.22, 0.78, 0.52],
  },
  'zeiss-sonnar-4-150': {
    design: 'Sonnar', elements: 5, groups: 3, focalCalMm: 150.1, maxAperture: 4.0, minFocusM: 1.4,
    transmission: 0.95, entrancePupilMm: 58.0,
    k1: 0.013, k2: -0.0015, caLat: 0.0013, caLong: 0.32, saGlow: 0.28, catsEye: 0.56,
    astig: 0.20, coma: 0.20, fieldCurv: 0.20, vigOpen: 0.58, vigStop: 0.16, vigExp: 2.0,
    mtfCenterOpen: 0.68, mtfCornerOpen: 0.40, mtfCenterStop: 0.82, mtfCornerStop: 0.64, mtfAstig: 0.16,
    cciTint: [1.008, 1.001, 0.990],
    pupilMag: 0.72, maxExtMm: 18.2, hoodType: 'b60-tele',
    ghostTintA: [0.62, 0.22, 0.78], ghostTintB: [0.86, 0.54, 0.18],
  },
  'zeiss-sonnar-4-180': {
    design: 'Sonnar', elements: 5, groups: 4, focalCalMm: 179.4, maxAperture: 4.0, minFocusM: 1.55,
    transmission: 0.95, entrancePupilMm: 68.0,
    k1: 0.011, k2: -0.001, caLat: 0.0009, caLong: 0.22, saGlow: 0.18, catsEye: 0.52,
    astig: 0.12, coma: 0.12, fieldCurv: 0.12, vigOpen: 0.54, vigStop: 0.14, vigExp: 2.0,
    mtfCenterOpen: 0.76, mtfCornerOpen: 0.56, mtfCenterStop: 0.86, mtfCornerStop: 0.72, mtfAstig: 0.09,
    cciTint: [1.005, 1.001, 0.994],
    pupilMag: 0.70, maxExtMm: 23.5, hoodType: 'b60-tele',
    ghostTintA: [0.56, 0.20, 0.82], ghostTintB: [0.20, 0.80, 0.54],
  },
  'zeiss-sonnar-5.6-250': {
    design: 'Sonnar', elements: 4, groups: 3, focalCalMm: 248.4, maxAperture: 5.6, minFocusM: 2.5,
    transmission: 0.96, entrancePupilMm: 88.0,
    k1: 0.016, k2: -0.0018, caLat: 0.0018, caLong: 0.36, saGlow: 0.24, catsEye: 0.60,
    astig: 0.18, coma: 0.18, fieldCurv: 0.16, vigOpen: 0.48, vigStop: 0.12, vigExp: 2.1,
    mtfCenterOpen: 0.69, mtfCornerOpen: 0.44, mtfCenterStop: 0.81, mtfCornerStop: 0.64, mtfAstig: 0.15,
    cciTint: [1.004, 1.000, 0.996],
    pupilMag: 0.64, maxExtMm: 27.5, hoodType: 'b60-tele',
    ghostTintA: [0.64, 0.24, 0.76], ghostTintB: [0.88, 0.58, 0.20],
  },
  'zeiss-tele-apotessar-8-500': {
    design: 'Tele-Apotessar', elements: 5, groups: 4, focalCalMm: 492.0, maxAperture: 8.0, minFocusM: 5.0,
    transmission: 0.96, entrancePupilMm: 165.0,
    k1: 0.010, k2: -0.001, caLat: 0.00035, caLong: 0.02, saGlow: 0.12, catsEye: 0.58,
    astig: 0.08, coma: 0.06, fieldCurv: 0.06, vigOpen: 0.42, vigStop: 0.10, vigExp: 2.2,
    mtfCenterOpen: 0.77, mtfCornerOpen: 0.61, mtfCenterStop: 0.85, mtfCornerStop: 0.73, mtfAstig: 0.05,
    cciTint: [0.998, 1.001, 1.002],
    pupilMag: 0.58, maxExtMm: 31.0, hoodType: 'none',
    ghostTintA: [0.54, 0.24, 0.82], ghostTintB: [0.24, 0.76, 0.52],
  },
};

/** The CF lenses by focal length: a bare number maps to the Hasselblad V system. */
export const CF_LENS_BY_FOCAL = {
  30: 'zeiss-distagon-3.5-30',
  40: 'zeiss-distagon-4-40',
  50: 'zeiss-distagon-4-50',
  60: 'zeiss-distagon-3.5-60',
  80: 'zeiss-planar-2.8-80',
  100: 'zeiss-planar-3.5-100',
  120: 'zeiss-makro-planar-4-120',
  150: 'zeiss-sonnar-4-150',
  180: 'zeiss-sonnar-4-180',
  250: 'zeiss-sonnar-5.6-250',
  500: 'zeiss-tele-apotessar-8-500',
};

const focalOf = (lens) => (lens == null ? 80 : typeof lens === 'number' ? lens : lens.focalLength || 80);

/** Register a camera system's lens optical prescriptions by lens id. */
export function registerLensOptics(table) { Object.assign(LENS_OPTICS, table); }

const warned = new Set();

/**
 * Look up a lens's optical prescription by lens record, id string, or (CF legacy) focal length.
 * Unknown lens ids emit a one-time warning and fall back to the CF 80 so pages remain resilient.
 */
export function lensOpticsFor(lens) {
  if (typeof lens === 'number' || /^\d+$/.test(lens ?? '')) return LENS_OPTICS[CF_LENS_BY_FOCAL[+lens]] || LENS_OPTICS[CF_LENS_BY_FOCAL[80]];
  const id = typeof lens === 'string' ? lens : lens?.id;
  const spec = LENS_OPTICS[id] || (typeof lens === 'object' && lens?.optics);
  if (spec) return spec;
  if (!warned.has(id)) { warned.add(id); console.warn(`[optics] no optics for lens ${id}`); }
  return LENS_OPTICS[CF_LENS_BY_FOCAL[80]];
}

/** Datasheet-calibrated relative illuminance (corner falloff) for `lens` at `aperture` and `focusM`. */
export function lensVignetteFor(lens, aperture, focusM = Infinity) {
  const spec = lensOpticsFor(lens);
  const maxAp = spec.maxAperture || 2.8;
  const effAp = Math.max(aperture || maxAp, maxAp);
  const stopsDown = Math.max(0, Math.log2(effAp / maxAp));
  const stopK = clamp(stopsDown / 2.2, 0, 1);
  const m = magnificationAt(lens, focusM);
  const extRelief = 1 / Math.pow(1 + m / (spec.pupilMag || 1), 0.65);
  return (spec.vigOpen * (1 - stopK) + spec.vigStop * stopK) * extRelief;
}

/** 40 lp/mm Modulation Transfer Function (MTF) profile for `lens` at `aperture` and `focusM`. */
export function lensMtfFor(lens, aperture, focusM = Infinity) {
  const spec = lensOpticsFor(lens);
  const maxAp = spec.maxAperture || 2.8;
  const effAp = Math.max(aperture || maxAp, maxAp);
  const stopsDown = Math.max(0, Math.log2(effAp / maxAp));
  const stopK = clamp(stopsDown / 2.0, 0, 1);
  const m = magnificationAt(lens, focusM);
  const nEff = effAp * (1 + m / (spec.pupilMag || 1));
  const diffAtten = nEff > 11 ? Math.max(0.42, 1 - (nEff - 11) * 0.011) : 1.0;
  const closePenalty = (spec.fieldCurv || 0) * Math.min(1, m * 5.0) * 0.35;
  const center = ((spec.mtfCenterOpen || 0.65) * (1 - stopK) + (spec.mtfCenterStop || 0.82) * stopK) * diffAtten;
  const corner = Math.max(0.18, ((spec.mtfCornerOpen || 0.34) * (1 - stopK) + (spec.mtfCornerStop || 0.62) * stopK) * diffAtten - closePenalty);
  const sagTang = (spec.mtfAstig || 0.15) * (1 - 0.65 * stopK);
  return { center, corner, sagTang };
}

/**
 * Physical helicoid forward extension Δz (in mm) when focused at `focusM` (metres from film).
 * Exact thin-lens Δz = v − f, scaled to the lens's mechanical travel (`maxExtMm` at `minFocusM`).
 */
export function helicoidExtensionMm(lens, focusM) {
  const focalMm = focalOf(lens);
  if (!isFinite(focusM) || focusM >= 200) return 0;
  const spec = lensOpticsFor(lens);
  const f = spec.focalCalMm || focalMm;
  const sMm = Math.max(focusM * 1000, spec.minFocusM * 1000);
  const minSMm = spec.minFocusM * 1000;
  const thin = (x) => { const q = Math.max(x, 4.01 * f); return (q - Math.sqrt(q * q - 4 * f * q)) / 2 - f; };
  const rawAtMin = thin(minSMm);
  const raw = thin(sMm);
  const scale = rawAtMin > 0 ? spec.maxExtMm / rawAtMin : 1;
  return clamp(raw * scale, 0, spec.maxExtMm);
}

/** Floating Lens Element (FLE) ring click stop index for `focusM`, or null if the lens has no FLE ring. */
export function fleIndexFor(lens, focusM) {
  const stops = lensOpticsFor(lens).fleStops;
  if (!stops) return null;
  let idx = 0;
  const d = isFinite(focusM) ? focusM : 1000;
  for (let i = 0; i < stops.length - 1; i++) {
    const hi = stops[i];
    const lo = stops[i + 1];
    const mid = isFinite(hi) ? Math.sqrt(hi * lo) : lo * 1.45;
    if (d < mid) idx = i + 1;
  }
  return idx;
}

/** 503CX non-gliding mirror finder cutoff fraction at the top of the screen (0..0.3). */
export function mirrorCutoffFactor(lens, focusM) {
  const focalMm = focalOf(lens);
  const ext = helicoidExtensionMm(lens, focusM);
  const base = focalMm > 100 ? Math.min(0.2, (focalMm - 100) / 1500) : 0;
  const close = focalMm >= 80 ? clamp((ext - 8) * 0.004, 0, 0.12) : 0;
  return clamp(base + close, 0, 0.3);
}

/** Paraxial magnification m = v₀ / f_cal − 1 at `focusM` (metres from film). */
export function magnificationAt(lens, focusM) {
  if (!lens || !Number.isFinite(focusM) || focusM >= 200) return 0;
  const focalMm = focalOf(lens);
  const spec = lensOpticsFor(lens);
  const f = spec.focalCalMm || focalMm;
  const sMm = Math.max(Math.min(Math.max(focusM, 0), 1e6) * 1000, 4.01 * f);
  const v0 = (sMm - Math.sqrt(sMm * sMm - 4 * f * sMm)) / 2;
  return Math.max(0, v0 / f - 1);
}

/** Effective exit-pupil-referenced focal distance v_eff (mm) focused at `focusM`. */
export function effectiveFocalMm(lens, focusM) {
  const focalMm = focalOf(lens);
  const spec = lensOpticsFor(lens);
  const f = spec.focalCalMm || focalMm;
  if (!lens || !Number.isFinite(focusM) || focusM >= 1e5) return f;
  const m = magnificationAt(lens, focusM);
  const p = spec.pupilMag || 1.0;
  return f * (1 + m / p);
}

/** Bellows extension exposure loss in stops: ΔEV = 2 · log2(1 + m / p). */
export function bellowsExposureStops(lens, focusM) {
  if (!lens || !Number.isFinite(focusM) || focusM <= 0) return 0;
  const m = magnificationAt(lens, focusM);
  if (m <= 0.015) return 0;
  const spec = lensOpticsFor(lens);
  const p = spec.pupilMag || 1.0;
  const raw = 2 * Math.log2(1 + m / p);
  return raw < 0.05 ? 0 : raw;
}

/** Physical 3D bayonet/screw filter appearances, rim engravings, and linear optical transmission tints. */
export const FILTER_OPTICS = {
  none: {
    code: '',
    glassColor: 0x1a242c,
    glassOpacity: 0.0,
    ggTint: [1.0, 1.0, 1.0],
    rotatable: false,
  },
  uv: {
    code: 'GLASS WORKS   B60   MULTICOATED   1×   UV-SKY   0',
    glassColor: 0xf6eedc,
    glassOpacity: 0.24,
    ggTint: [1.0, 1.0, 1.0],
    rotatable: false,
  },
  yellow: {
    code: 'GLASS WORKS   B60   MULTICOATED   1.5×   Y   -0.5',
    glassColor: 0xe8c414,
    glassOpacity: 0.52,
    ggTint: [1.04, 0.94, 0.22],
    rotatable: false,
  },
  green: {
    code: 'GLASS WORKS   B60   MULTICOATED   3×   G   -1.5',
    glassColor: 0x2ea038,
    glassOpacity: 0.56,
    ggTint: [0.42, 1.02, 0.32],
    rotatable: false,
  },
  orange: {
    code: 'GLASS WORKS   B60   MULTICOATED   3×   O   -1.5',
    glassColor: 0xe66212,
    glassOpacity: 0.58,
    ggTint: [1.12, 0.56, 0.10],
    rotatable: false,
  },
  red: {
    code: 'GLASS WORKS   B60   MULTICOATED   6×   R   -2.5',
    glassColor: 0xc81816,
    glassOpacity: 0.64,
    ggTint: [1.18, 0.16, 0.06],
    rotatable: false,
  },
  polarizer: {
    code: 'GLASS WORKS   B60   POL   2×   -1   LINEAR / CIRC',
    glassColor: 0x222930,
    glassOpacity: 0.48,
    ggTint: [0.94, 0.96, 0.98],
    rotatable: true,
  },
  cpl: {
    code: 'GLASS WORKS   B60   POL   2×   -1   LINEAR / CIRC',
    glassColor: 0x222930,
    glassOpacity: 0.48,
    ggTint: [0.94, 0.96, 0.98],
    rotatable: true,
  },
  '81a': {
    code: 'GLASS WORKS   B60   MULTICOATED   CR 1.5   81A',
    glassColor: 0xdca678,
    glassOpacity: 0.34,
    ggTint: [1.04, 0.96, 0.84],
    rotatable: false,
  },
  '85b': {
    code: 'GLASS WORKS   B60   MULTICOATED   CR 6   85B   -0.5',
    glassColor: 0xd88438,
    glassOpacity: 0.44,
    ggTint: [1.10, 0.88, 0.62],
    rotatable: false,
  },
  nd8: {
    code: 'GLASS WORKS   B60   ND 0.9   8×   -3',
    glassColor: 0x16181a,
    glassOpacity: 0.62,
    ggTint: [0.96, 0.96, 0.96],
    rotatable: false,
  },
  nd64: {
    code: 'GLASS WORKS   B60   ND 1.8   64×   -6',
    glassColor: 0x101214,
    glassOpacity: 0.78,
    ggTint: [0.94, 0.95, 0.96],
    rotatable: false,
  },
  nd1000: {
    code: 'GLASS WORKS   B60   ND 3.0   1000×   -10',
    glassColor: 0x0a0b0d,
    glassOpacity: 0.88,
    ggTint: [0.92, 0.94, 0.96],
    rotatable: false,
  },
};

export function filterOpticsFor(filterOrId) {
  const id = typeof filterOrId === 'string' ? filterOrId : (filterOrId?.id || 'none');
  return FILTER_OPTICS[id] || FILTER_OPTICS.none;
}
