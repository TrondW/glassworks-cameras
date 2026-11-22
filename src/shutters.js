// Shutters, as data: the speeds each one has (full stops, as engraved), whether it has B and T, its kind, and which part
// of the camera carries the speed control — a ring on the lens (a leaf shutter in each lens) or a dial on the body.
// A camera names its shutter (cameras.js); with leaf shutters, each lens may name its own (a 4×5's Copal 0 or Copal 1).
// T and B are states, not speeds: B stays open while the release is held, T opens at one press and closes at the next.
const SPEEDS = (list) => list.map(([t, label]) => ({ t, label }));

export const SHUTTERS = {
  // The CF lenses' Prontor leaf shutter: 1 s – 1/500 in full stops, and B (the speed ring's own detent past 1 s).
  // These are the engine's speeds since the start (optics.js SHUTTER_SPEEDS).
  'prontor-cf': {
    id: 'prontor-cf', name: 'Prontor CF', kind: 'leaf', control: 'lens-ring', bulb: true, time: false,
    speeds: SPEEDS([[1, '1s'], [1 / 2, '1/2'], [1 / 4, '1/4'], [1 / 8, '1/8'], [1 / 15, '1/15'], [1 / 30, '1/30'], [1 / 60, '1/60'], [1 / 125, '1/125'], [1 / 250, '1/250'], [1 / 500, '1/500']]),
  },
  // The M6's horizontally running cloth focal-plane shutter: B, 1 s – 1/1000 in full stops, and 1/50 marked with the
  // flash symbol (electronic flash synchronises at 1/50 and slower). The dial on the top plate. Source: the M6
  // instructions (local reference notes "Shutter speeds from 1 to 1/1000 sec"; flash 1 – 1/50).
  'leica-m6': {
    id: 'leica-m6', name: 'M6 cloth focal plane', kind: 'focal-plane', control: 'body-dial', bulb: true, time: false, sync: 1 / 50,
    speeds: SPEEDS([[1, '1s'], [1 / 2, '1/2'], [1 / 4, '1/4'], [1 / 8, '1/8'], [1 / 15, '1/15'], [1 / 30, '1/30'], [1 / 50, '1/50'], [1 / 60, '1/60'], [1 / 125, '1/125'], [1 / 250, '1/250'], [1 / 500, '1/500'], [1 / 1000, '1/1000']]),
  },
  // Copal leaf shutters for large-format lenses: T, B, 1 s – 1/500 (No. 0) and 1 s – 1/400 (No. 1), set on the
  // shutter's own speed ring; the aperture on its scale beside it. (To confirm against Copal's data in the Intrepid
  // phase.)
  'copal-0': {
    id: 'copal-0', name: 'Copal No. 0', kind: 'leaf', control: 'lens-ring', bulb: true, time: true,
    speeds: SPEEDS([[1, '1s'], [1 / 2, '1/2'], [1 / 4, '1/4'], [1 / 8, '1/8'], [1 / 15, '1/15'], [1 / 30, '1/30'], [1 / 60, '1/60'], [1 / 125, '1/125'], [1 / 250, '1/250'], [1 / 500, '1/500']]),
  },
  'copal-1': {
    id: 'copal-1', name: 'Copal No. 1', kind: 'leaf', control: 'lens-ring', bulb: true, time: true,
    speeds: SPEEDS([[1, '1s'], [1 / 2, '1/2'], [1 / 4, '1/4'], [1 / 8, '1/8'], [1 / 15, '1/15'], [1 / 30, '1/30'], [1 / 60, '1/60'], [1 / 125, '1/125'], [1 / 250, '1/250'], [1 / 400, '1/400']]),
  },
  // Canon AE-1 electronically controlled cloth focal-plane shutter: B, 2 s – 1/1000 in full stops; 1/60 flash sync.
  'canon-ae1': {
    id: 'canon-ae1', name: 'AE-1 electronic cloth focal plane', kind: 'focal-plane', control: 'body-dial', bulb: true, time: false, sync: 1 / 60,
    speeds: SPEEDS([[2, '2s'], [1, '1s'], [1 / 2, '1/2'], [1 / 4, '1/4'], [1 / 8, '1/8'], [1 / 15, '1/15'], [1 / 30, '1/30'], [1 / 60, '1/60'], [1 / 125, '1/125'], [1 / 250, '1/250'], [1 / 500, '1/500'], [1 / 1000, '1/1000']]),
  },
  // Rolleiflex 2.8F Synchro-Compur MXV leaf shutter: B, 1 s – 1/500 in full stops, controlled by the front right thumbwheel.
  'synchro-compur': {
    id: 'synchro-compur', name: 'Synchro-Compur MXV', kind: 'leaf', control: 'body-dial', bulb: true, time: false,
    speeds: SPEEDS([[1, '1s'], [1 / 2, '1/2'], [1 / 4, '1/4'], [1 / 8, '1/8'], [1 / 15, '1/15'], [1 / 30, '1/30'], [1 / 60, '1/60'], [1 / 125, '1/125'], [1 / 250, '1/250'], [1 / 500, '1/500']]),
  },
  // Pentax K1000 all-mechanical horizontal rubberized-silk focal-plane shutter: B, 1 s – 1/1000 in full stops; 1/60 X-sync.
  'pentax-k1000': {
    id: 'pentax-k1000', name: 'K1000 mechanical cloth focal plane', kind: 'focal-plane', control: 'body-dial', bulb: true, time: false, sync: 1 / 60,
    speeds: SPEEDS([[1, '1s'], [1 / 2, '1/2'], [1 / 4, '1/4'], [1 / 8, '1/8'], [1 / 15, '1/15'], [1 / 30, '1/30'], [1 / 60, '1/60'], [1 / 125, '1/125'], [1 / 250, '1/250'], [1 / 500, '1/500'], [1 / 1000, '1/1000']]),
  },
  // Nikon F3HP quartz-timed horizontal quilted-titanium focal-plane shutter: T, B, 8 s – 1/2000 in full stops; 1/80 X-sync (+ 1/60 mechanical backup).
  'nikon-f3': {
    id: 'nikon-f3', name: 'F3 titanium focal plane', kind: 'focal-plane', control: 'body-dial', bulb: true, time: true, sync: 1 / 80,
    speeds: SPEEDS([[8, '8s'], [4, '4s'], [2, '2s'], [1, '1s'], [1 / 2, '1/2'], [1 / 4, '1/4'], [1 / 8, '1/8'], [1 / 15, '1/15'], [1 / 30, '1/30'], [1 / 60, '1/60'], [1 / 80, '1/80'], [1 / 125, '1/125'], [1 / 250, '1/250'], [1 / 500, '1/500'], [1 / 1000, '1/1000'], [1 / 2000, '1/2000']]),
  },
  // Olympus OM-1 MD horizontal rubberized-cloth focal-plane shutter controlled by the iconic concentric ring around the OM lens mount!
  'olympus-om1': {
    id: 'olympus-om1', name: 'OM-1 cloth focal plane', kind: 'focal-plane', control: 'lens-ring', bulb: true, time: false, sync: 1 / 60,
    speeds: SPEEDS([[1, '1s'], [1 / 2, '1/2'], [1 / 4, '1/4'], [1 / 8, '1/8'], [1 / 15, '1/15'], [1 / 30, '1/30'], [1 / 60, '1/60'], [1 / 125, '1/125'], [1 / 250, '1/250'], [1 / 500, '1/500'], [1 / 1000, '1/1000']]),
  },
};
