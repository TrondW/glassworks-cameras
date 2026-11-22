// The 11 Hasselblad V (CF) lenses for the 503CX (6×6 medium format, Prontor CF leaf shutter).
// Optical prescriptions live in src/optics.js (LENS_OPTICS) keyed by lens id.

const CF_KIND = {
  30: 'Fisheye', 40: 'Wide', 50: 'Wide', 60: 'Wide',
  80: 'Standard', 100: 'Standard', 120: 'Macro',
  150: 'Portrait', 180: 'Tele', 250: 'Tele', 500: 'Super-tele',
};

const cfUse = (f) => (
  f <= 30 ? 'The whole sky, curved'
  : f <= 60 ? 'Wide: the whole scene, with room around it'
  : f <= 100 ? 'Standard: about what the eye sees'
  : f === 120 ? 'Close-ups: small things, details'
  : f <= 180 ? 'Portrait: frames one subject'
  : f <= 250 ? 'Telephoto: pulls a distant subject close'
  : 'Super-telephoto: the moon, faraway details'
);

const cfShade = (f) => (
  f < 50 || f > 250 ? null
  : f <= 60 ? 'B60/50–60'
  : f <= 80 ? 'B60/80'
  : 'B60/100–250'
);

const RAW_CF_LENSES = [
  { id: 'zeiss-distagon-3.5-30', focalLength: 30, maxAperture: 3.5, minAperture: 22, apertureStops: [3.5, 4, 5.6, 8, 11, 16, 22], angleOfView: 180, fov: 112, minFocusDistance: 0.3, filterSize: 26, transmissionFactor: 0.9, halationIntensity: 0.3, vignetteIntensity: 0.45714285714285713 },
  { id: 'zeiss-distagon-4-40', focalLength: 40, maxAperture: 4, minAperture: 22, apertureStops: [4, 5.6, 8, 11, 16, 22], angleOfView: 88, fov: 69, minFocusDistance: 0.5, filterSize: 93, transmissionFactor: 0.9, halationIntensity: 0.25, vignetteIntensity: 0.4 },
  { id: 'zeiss-distagon-4-50', focalLength: 50, maxAperture: 4, minAperture: 32, apertureStops: [4, 5.6, 8, 11, 16, 22, 32], angleOfView: 75, fov: 58, minFocusDistance: 0.5, filterSize: 60, transmissionFactor: 0.94, halationIntensity: 0.2, vignetteIntensity: 0.34 },
  { id: 'zeiss-distagon-3.5-60', focalLength: 60, maxAperture: 3.5, minAperture: 22, apertureStops: [3.5, 4, 5.6, 8, 11, 16, 22], angleOfView: 66, fov: 50, minFocusDistance: 0.6, filterSize: 60, transmissionFactor: 0.94, halationIntensity: 0.2, vignetteIntensity: 0.30714285714285716 },
  { id: 'zeiss-planar-2.8-80', focalLength: 80, maxAperture: 2.8, minAperture: 22, apertureStops: [2.8, 4, 5.6, 8, 11, 16, 22], angleOfView: 52, fov: 38, minFocusDistance: 0.9, filterSize: 60, transmissionFactor: 0.95, halationIntensity: 0.2, vignetteIntensity: 0.2714285714285714 },
  { id: 'zeiss-planar-3.5-100', focalLength: 100, maxAperture: 3.5, minAperture: 22, apertureStops: [3.5, 4, 5.6, 8, 11, 16, 22], angleOfView: 43, fov: 31, minFocusDistance: 0.9, filterSize: 60, transmissionFactor: 0.95, halationIntensity: 0.05, vignetteIntensity: 0.22714285714285715 },
  { id: 'zeiss-makro-planar-4-120', focalLength: 120, maxAperture: 4, minAperture: 32, apertureStops: [4, 5.6, 8, 11, 16, 22, 32], angleOfView: 36, fov: 26, minFocusDistance: 0.8, filterSize: 60, transmissionFactor: 0.95, halationIntensity: 0.1, vignetteIntensity: 0.2 },
  { id: 'zeiss-sonnar-4-150', focalLength: 150, maxAperture: 4, minAperture: 32, apertureStops: [4, 5.6, 8, 11, 16, 22, 32], angleOfView: 29, fov: 21, minFocusDistance: 1.4, filterSize: 60, transmissionFactor: 0.95, halationIntensity: 0.15, vignetteIntensity: 0.18 },
  { id: 'zeiss-sonnar-4-180', focalLength: 180, maxAperture: 4, minAperture: 32, apertureStops: [4, 5.6, 8, 11, 16, 22, 32], angleOfView: 24, fov: 17, minFocusDistance: 1.55, filterSize: 60, transmissionFactor: 0.95, halationIntensity: 0.1, vignetteIntensity: 0.16666666666666669 },
  { id: 'zeiss-sonnar-5.6-250', focalLength: 250, maxAperture: 5.6, minAperture: 45, apertureStops: [5.6, 8, 11, 16, 22, 32, 45], angleOfView: 18, fov: 13, minFocusDistance: 2.5, filterSize: 60, transmissionFactor: 0.96, halationIntensity: 0.25, vignetteIntensity: 0.148 },
  { id: 'zeiss-tele-apotessar-8-500', focalLength: 500, maxAperture: 8, minAperture: 64, apertureStops: [8, 11, 16, 22, 32, 45, 64], angleOfView: 9, fov: 7, minFocusDistance: 5.0, filterSize: 86, transmissionFactor: 0.96, halationIntensity: 0.2, vignetteIntensity: 0.124 },
];

export const CF_LENSES = RAW_CF_LENSES.map((l) => {
  const f = l.focalLength;
  return {
    ...l,
    system: 'hasselblad-v',
    kind: CF_KIND[f] || '',
    projection: f === 30 ? 'equisolid' : 'rectilinear',
    shade: cfShade(f),
    shutter: 'prontor-cf',
    use: cfUse(f),
    name: `${f} mm ƒ/${l.maxAperture} ${CF_KIND[f] || ''}`.trim(),
  };
});
