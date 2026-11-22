// Picture formats, as data: the frame on the film (mm, landscape: w ≥ h), the circle of confusion that depth of field
// is reckoned with, and how many exposures a load holds. A camera names its format (cameras.js). The lens view, prints
// and contact sheets take their shape from it.
//
// 6×6 is the 503CX's, and its numbers are the ones the engine has always used (optics.js FORMAT_MM, COC_MM). The
// others are here for the cameras the plan adds (docs/PLAYBOOK.md); each is checked again in its
// camera's own phase.
export const FORMATS = {
  // 120 roll film in the A12: twelve 56 × 56 frames (the nominal side; the app's medium-format CoC)
  '6x6': { id: '6x6', name: '6×6', film: '120', w: 56, h: 56, coc: 0.05, frames: 12 },
  // 135 in the M6: 24 × 36 frames, the 35 mm CoC (1/1442 of the diagonal, the usual 0.03), 36 to a cassette
  '135': { id: '135', name: '24×36', film: '135', w: 36, h: 24, coc: 0.03, frames: 36 },
  // 4×5 sheet film (102 × 127 mm sheets): the image a standard double holder frames is about 96 × 120 mm (to confirm on
  // the holders themselves); the large-format CoC; two sheets to a holder, one each side
  '4x5': { id: '4x5', name: '4×5', film: 'sheet', w: 120, h: 96, coc: 0.1, frames: 2 },
};

/** The frame's long side over its short side (1 for square). */
export const aspectOf = (f) => f.w / f.h;
