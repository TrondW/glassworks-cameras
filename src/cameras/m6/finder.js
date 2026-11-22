// The M6's finder windows and rangefinder, as data: the model draws them, the page's viewing reads them (cameras.js,
// viewing/rangefinder.js). Millimetres from the lens axis, in the body's axes (+X the photographer's right, +Y up).
// The windows from Leica's dimensioned drawing of the M6 (technical data pm-14029, front view, read from the vector
// PDF's lines and corner arcs): each as [x0, x1, y0, y1], its black bezel and the glass inside it. The finder's axis is the eyepiece's, 67.4 mm
// above the bottom and 23.2 mm in from the left end (the drawing's back view). The base and the magnification from
// Leica's 1989 handbook p. 4-8 (the windows' centres on the drawing are 68.2 mm apart; the base is measured between the
// optical axes of the rangefinder's mirror and its prism, inside).
export const FINDER = {
  x: -36.2, y: 33.84,                // the finder's axis (the eyepiece's centre), from the lens axis
  window: [-45.91, -25.33, 26.30, 40.32],
  windowStrip: 27.91,                // the top of the strip along the window's foot (the drawing's line)
  patchMirror: [-35.0, 33.9],        // the rangefinder's patch mirror, seen through the window (the photographs)
  windowBezel: [-46.63, -24.65, 25.58, 40.99],
  frosted: [-16.90, -1.53, 29.16, 40.11],
  frostedBezel: [-17.88, -0.55, 28.16, 41.16],
  rf: [28.41, 36.71, 30.96, 36.12],
  rfBezel: [27.73, 37.43, 30.24, 36.84],
  base: 69.25,                       // the handbook's rangefinder base (mm)
  magnification: 0.72,
};
