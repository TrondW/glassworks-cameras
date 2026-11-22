# The Intrepid 4×5 model: measurements and their sources

Started 2026-11-08. The plan's §5 camera: the Mk5, in birch plywood with black bellows (the recommended choice in plan
§7, decision 3). The model is `src/cameras//index.js`; its numbers are `DIM` there.

It follows the M6's method (docs/camera/SPEC-M6.md): every dimension carries its source, and anything not measured is
marked **UNVERIFIED**. Intrepid publishes no dimensioned drawing. The owner chose (2026-11-08) to build it from
Intrepid's product photographs rather than a camera in hand, so the numbers hold to about **±1 mm on the front
standard and ±1.5–2 mm further back**, not the M6's ±0.1 mm.

## Sources

1. **Intrepid's product photograph DSCF8423** (the birch camera with a 150 lens, 3000 × 3000 px), and its siblings in
   the same studio pose: DSCF8417–8424 (bellows colours), the black edition 6–11 and the hardwood edition. Saved in
   `scratch/ref-intrepid/full/`, measurement only, never in a repo.
2. **Intrepid's line drawings** on its comparison page (a near front view, a side view, a three-quarter view;
   `scratch/ref-intrepid/guide/4x5_{11,6,5}.png`). They are traced from photographs or renders. The front one is a
   perspective from about 1 m: the rear frame comes out at 85 % of its size. They give the construction and the
   proportions within a part, not millimetres.
3. **Intrepid's specification and setup guide** (`local reference notes): the board 96 × 99 mm; folded
   180 × 180 × 97 mm; bellows 75–300 mm; rise 42, fall 30, shift ±30, front tilt and swing ±45°, rear tilt ±30°; the
   parts' names; the bellows magnetic at the front and screwed at the back.
4. **Intrepid's square-on photograph of the recessed lens board** (P4090118): the board 1364 × 1404 px, so 96 wide
   by 99 tall (1.029, against 99/96 = 1.031). Its No. 0 hole measures 33.9 mm against the standard 34.6, consistent
   with a recess floor 13 mm behind the face seen from about 0.65 m.

## Method: the photograph's camera, then each part on its own plane

The board is a known 96 × 99 rectangle. Its four corners stand clear of the clip and the lip as feet (the board
photograph shows the notched bottom edge), at (628, 946), (1231.5, 934), (628.5, 1767) and (1232, 1797.5).

The photographer's camera was solved from those corners plus eight long edges along the carriage's side, which run
front to back (`scratch/intrepid/dwg/cam8423.py`):
- f = 9322 px;
- the principal point at (1500, 322): the photograph's verticals were straightened, which moves the principal point
  up;
- the camera 1.11 m away, 42° to the Intrepid's left, level with the board;
- residuals within ±1.6 px.

Each part is then read on its own plane. The photograph is resampled onto that plane in millimetres
(`rect.py`: the board's plane, the rear frame's, the uprights', the arm's). Single features are back-projected onto
the plane they lie on (`bp.py`). A feature read on the wrong plane moves in depth by about 1.2 mm per millimetre of
error in the plane. The first readings of the arm's knob and pivot were 10–17 mm off for that reason, and were
corrected on their own faces.

**Check:** the model rendered through the solved camera, one flat colour per part, its part boundaries drawn over the
photograph (`scratch/intrepid/shots.mjs ids`, `idover.py`). The board, panel, clip, lip, uprights, knobs, lens,
carriage, rear frame, back, arm, lock knob and pivot all land on the photograph's edges.

## Dimensions (mm)

Model frame: the lens axis on the film plane, −Z forward, +X the photographer's right, +Y up. In the photograph the
board's face is 198 mm in front of the film.

### Front standard (its own frame: the board's face, on the lens axis)

| Part | Value | Source |
|---|---|---|
| Board | 96 × 99 × 2.5, black, no logo | spec; board photograph |
| Panel | birch ply 9; 120 wide; Y −56.7 to +58.8; face 1 proud of the board; notched to ±55 from Y −26 to +18 for the side blocks | rectified photograph |
| Opening behind the board | Ø 89 | front drawing at the board's scale (8.574 px/mm) |
| Clip | 70 wide, Y +49.6 to +60.6; two screws in slanted slots; two ears over the top | rectified photograph |
| Lip | 86 wide, Y −57.2 to −49.4; two screws | rectified photograph |
| Uprights | black aluminium 6 thick at X ±60.5 to ±66.5; front edge flush with the panel's face; 14 wide above Y −47, 23 below; top Y +59.5; slot 6.7 wide | photograph (the near one hidden behind the panel's corner, the far one's edge); side drawing's proportions |
| Dual controls | on the tilt axis Y −7, 6.5 behind the face: spacer to X 72.6, knurled rise lock Ø 21.6 to 81.4, five-lobed tilt lock Ø 27 to 88.4 | front drawing at the board's scale |
| Channel | Y −99.5 to −85; its front lip ruled 30 mm either side with zero marks | rectified photograph |
| Carriage | birch 15.5 thick, **58 wide**, 170 long; front 2 behind the board; on two guide blocks 51 apart; lead-screw stud out of its front; focus wheel Ø 24 on its back end | back-projected corners and blocks |

### Rear standard

| Part | Value | Source |
|---|---|---|
| Frame | birch 177.5 × 179.5 (Y −90.2 to +89.3), 15 thick, front 23 in front of the film | rectangle at unknown depth, solved from its corners (centred); side face rectified; **folded 180 × 180** agrees |
| Opening | pillow-shaped 165 × 168, sides bowed 2 | rectified photograph; front drawing |
| Back | birch 177.5 × 148 landscape behind the frame, 12.5 deep with the ground glass's frame on it (the plate 2.5 to the seat, rails 3.2, the frame 10: "The film holder, the back" below); turns within the frame's square | side face rectified; DSCF8432 |
| Pivot | Y −80.3, 12 in front of the frame | back-projected on its own plane |
| Lock knob | Ø 21, 23.7 above the pivot, 13° forward; runs in the arm's slot (forward to fold, 21° back) | back-projected on its own plane |
| L-arms | 5 thick at X ±91.25; 42 wide at the foot (Z −66 to −25) | rectified on the arm's face |

### Base

| Part | Value | Source |
|---|---|---|
| Plate | black aluminium 4; top at Y −121.5 (the arms' feet); front 10 ahead of the board in the photograph, rounded r 28 | back-projected edge; overlay |
| Guides | two rails 51 apart | blocks back-projected |
| Windows | two, outside the guides toward the back | three-quarter drawing |

### Lens

The lens in Intrepid's birch photographs is a compact 150 mm ƒ/6.3 triplet in a No. 0 shutter, not the plan's ƒ/5.6
plasmat. The model follows the photographs:
- speed ring Ø 58, its face 12.5 proud of the board;
- front cell Ø 47, its rim 17.5 out;
- each depth read from that ring's parallax against the board.

No maker's names.

## Not settled

- **Bellows extension.** On the carriage, base and guides as measured, the front standard reaches about 240 mm.
  Intrepid says 300. The model lets the carriage run forward past the plate to make up the difference. Either the
  guides or the carriage let it reach further than the photographs show, or the plate is longer. **UNVERIFIED.**
- **Mount inserts.** Four brass inserts 38 apart: the count and the spacing are **UNVERIFIED**. The three-quarter
  drawing shows three on the carriage's back half.
- **Rear tilt.** The arm's slot as photographed allows about 21° back and a forward fold. Intrepid's "±30°" is
  **UNVERIFIED**.
- **The 150's flange focal distance:** 143, **UNVERIFIED**. (Chosen so the rear principal point sits at the iris,
  7 mm in front of the board: the lens view's film distance then equals the thin lens's image distance, 150 mm at
  infinity.)
- Not modelled yet:
  - the Graflok clips' exact form;
  - the back's magnets and click stops;
  - the second level on each standard;
  - the front standard's zeroing notches beyond a flag;
  - the focus wheel's position against the lead screw (the wheel is on the carriage's centre line).

## The movements in the picture (plan §5.5), 2026-11-08

`lensview.js` takes a view camera's movements (`movements: true` on the camera; the variant is made by rewrites of the
non-square shaders, so the 503's and the M6's sources are unchanged: the fingerprint regression `runs/MvAfter`
matches `IntrepidAfter` on all 18 Yosemite and 4 School shots).

- **The picture is the film's.** `lensPose` gives the lens's position and the film's orientation (the back's frame), so
  the rear's tilt reshapes the picture as a tilted film does and the lens's own tilt does not.
  `lensMovements()` gives, in the film's frame, the lens's distance D along the film's normal, where it stands over the
  film's centre (ox, oy), and its axis.
- **Rise, fall and shift:** the frustum is moved off-axis by ox/D, oy/D (`place`), so verticals stay vertical.
  - Every radial term is centred where the lens's axis meets the film rather than on the frame's centre: the fall-off,
    the field curvature, astigmatism and coma, distortion, the MTF's field, the ghosts' line.
  - The polariser's sky band takes each pixel's ray from the shifted frame (`uFrameTan`).
  - The frame darkens and softens outside the lens's image circle: the record's 210 mm at ƒ/22, 0.88 of it wide open,
    the light gone by 1.16 of the radius.
- **Tilt and swing (Scheimpflug):** a thin lens with its axis a (toward the film) at D from the film is in focus where
  P·(f·ẑ − D·a) = D·f. Along a pixel's ray, 1/t = 1/f − 1/D − (a·r + 1)/f, linear in the place in the frame.
  - The CoC pass measures each point's blur from that plane (`uFocusPlane`: 1/t at the centre and across and up the
    frame). The centre's term is taken from the focus itself, so square to the axis the blur is as before.
  - Checked at Cook's Meadow, ƒ/6.3, the lens 1.43 m above the grass, aimed 9° down: tilted forward by
    asin(f·cos φ / h) = 5.9° and focused so the plane lies on the ground, the grass at the lens's feet and the treeline
    across the meadow are both sharp; without the tilt, focused at 8 m, the near grass is a smear
    (`scratch/intrepid/mv/`, `mv2.json`).
- **The ground glass:** the hot spot moves to where the line from the eye (0.26 m behind) through the lens crosses the
  glass.
- **Signs** (`setMovements`): rise + up; shift + to the right; tilt + the lens's top forward (it looks down); swing + the
  lens looks to the right; rearTilt + the back's top back.
- **On the page:** a Movements panel (R) with strips for rise, shift, tilt, swing and the back's tilt, Zero, and
  Portrait / Landscape.
- **The back turned (portrait).** The back comes off its magnets and goes back a quarter turn round (`turnBack`: lifted
  9 mm, turned, set down, 0.8 s).
  - The lens view renders from the rear standard's frame, upright, so the frame stands on end (96 × 120) rather than
    lying on its side. `lensMovements().portrait` turns it (`lensview.js setPortrait`): its targets swap width and
    height, and passes compiled for that shape take over, sharing their uniforms. They are made with the others and
    warmed at load.
  - The phone's picture, the meter, the prints and the contact sheet read the frame's shape from the lens view, so they
    follow. A portrait print keeps its own proportions in the tray, the big print and the phone's contact grid.
  - The ground glass's mapping turns against the back, so the lens's image stays put while the frame turns around it,
    as on the camera.
  - (three's `setSize` does not resize a target's depth texture: `setPortrait` sizes it by hand. Left alone, the
    portrait picture rendered black.)
  - **On the way round, the corners go dark.** The light reaches the glass through the frame's square window
    (128 × 128 mm, r 8, its back face 8 mm in front of the film; the window is the model's, **UNVERIFIED**, sized so the
    back's 148 mm side covers it either way round). Square to it the frame clears the window; turned between the two,
    the glass's corners (its 121 × 97 window has a 155 mm diagonal) swing past the window's shadow. Each point of the
    glass is lit where the line from the lens to it clears the window's two faces, the edge soft by the lens's pupil
    (penumbra = pupil × gap / distance, about 1.3 mm at ƒ/6.3). At 45° the dark tips are about 5 mm deep.
  - So that the corners have picture where the window lets light through, while the back turns and the glass is in
    sight the lens view takes in a wider field (`turnCover`: the window's shadow's half-width, lifted, over the frame's
    height: 1.52 × the frame for the 150 at infinity) and keeps the shape it had; it takes the new shape when the back
    is down. The glass maps whatever picture it holds by the shape and field that picture was made with
    (`lensview.js ggShown`), and each shape has its own ground-glass target, so the glass never shows an empty or a
    mis-scaled picture at the switch (checked frame by frame through the turn: no dark frame).

Not done:
- **Image circles** come from each lens's record; the rest of the plan's lenses (§5.4) are not built.

## The dark cloth and the loupe, 2026-11-08

**The cloth** (`intrepid/darkcloth.js`): a black focusing cloth, 900 × 1140 mm, draped once by a small position-based
cloth simulation (stretch, shear and a soft bend; Coulomb friction, without which the hanging part drew the rest off
the top) over colliders standing for the camera: the rear frame and back, the bellows, the arms, the base plate, the
head's handle knob.
- **Folded** (W, or the Dark cloth button): folded in half and laid over the back, about 250 mm of it forward over the
  bellows and the rest hanging behind the glass and at the sides, to about 450 mm below the frame. The tripod's legs
  start 600 mm below it (measured in the page), so it clears them at any pan.
- **Over the head** (looking in): the whole cloth from the same front edge over a head and shoulders (the eye 260 mm
  behind the glass, inside the head), the sides falling round and open underneath, as a real one is. Going under and
  coming out blends the two drapes (the folded one's second half is the layer under the first).
- The two drapes take about half a second to simulate. They are made a few milliseconds at a time from the camera's
  update, starting three seconds after load, or at once if the cloth is wanted sooner.
- **The light under it.** The glass glows at its physical brightness. The image on it is the scene's luminance
  × 0.9 × 1.6 / 4N² (a ground glass's transmission and gain, N the working f-number at the bellows' extension): about
  1/110 of the scene at ƒ/6.3 (`lensview.js ggShown.lum`, with that pass's eye and screen scales undone, and its tone
  curve inverted on the camera's glass).
  - Its ground face also scatters back a few percent of the daylight on it (a matte 6 %). Out in the open that swamps
    the image, which shows as a ghost; that is why there is a cloth.
  - Under the cloth every material of the camera, and the cloth itself, is scaled to the glass's own glow:
    0.0005 × daylight next to the glass, falling off over 8 cm (`gwClothShade`). The page's eye adapts to the view,
    now mostly the glass, so the image is bright and everything round it nearly black. A sliver of daylight shows
    under the cloth's open bottom.
  - Taking the cloth off while looking in (W) leaves you looking, at the washed-out glass.
- From outside with the cloth off, behind the camera and near, the glass is kept live (`glassSeen`). With the cloth on
  it is covered, and only rendered while you look in.

**The loupe**: a 6× loupe for the ground glass (no markings).
- Its skirt (Ø 45) sits on the glass's rear face, its eyepiece 66 mm above. It shows a 28 mm circle of the glass at an
  apparent field of 37°: the eyepiece's 30 mm clear seen from the 45 mm eye relief, which fills the 40° view.
- Looking in, click the glass to set the loupe there (Z sets it where it was). Drag to slide the magnified glass about;
  the image follows the pointer, and the eye stays at the eyepiece. Click again, or Z, to lift it. It is kept to where
  its field still lies on the glass, and rides up onto the glass's frame near its edge.
- Its picture is a second lens view of that part of the frame: `lensview.js magCrop` 0.35 of the frame, centred where
  the loupe stands (`magCentre`). Every radial term (the axis, the hot spot, the image circle, the plane of focus, the
  polariser's rays) is seen from the crop's own centre, so the loupe shows the tilted plane of focus and the corners'
  fall-off as the glass has them.
- The eyepiece maps the picture made where the loupe stood when it was made, so a fast drag never shows the wrong part
  of the glass. On it are the ½-inch grid, the glass's frame past its edge, the window's shadow and a soft field stop.
- Stepping back picks the loupe up, and turning the back lifts it first.
- Checked: a click 120 px right and 60 up of the centre (a 600 × 400 view) set it 46.5 (the limit), 25 mm out; a drag
  100 px left and 50 down slid it 7.64 mm right and 3.82 up, exactly the pointer's travel at the eyepiece's scale.

The page also keeps the eye at the glass, or at the loupe, while the camera is aimed (`follow`); before, aiming while
looking in left the eye behind.

## The film holder, the back and the shutter's controls, 2026-11-08

Sources: Intrepid's photographs of the back (DSCF8432, rear three-quarter, portrait), its side views with and without
a holder, its setup guide's animations (a holder going in; the back turning), its own holders (DSCF8569/70 and the
shop's), Copal's dimension drawing of the No. 0 (via S.K. Grimes), the 4×5 holder standard (ANSI PH3.108's table).
Notes and every URL: `local reference notes; photographs for measurement only.

**The back** (landscape; the notch end at −X, the photographer's left):
- The birch plate 2.5 thick to the **seat, 5.0 in front of the film plane** (the standard's film depth, 0.197 in): a
  holder's face rests there, and so does the ground glass's frame. Two birch rails 3.2 proud either side of a channel
  121 wide that runs the back's length.
- **The ground glass's frame:** black, 3D-printed, 167 × 120.6 × 10, in the channel on the seat. A notch 38 × 14 in its
  notch end. The glass, 127 × 101.6 with its corners clipped 5, drops into the frame's well from behind, its ground
  face the film plane, held by a T-clip screwed at each end.
- **Springs:** a flat black strip each long side, screwed (two screws) to the rail near the far end and running to a lug
  on the middle of the frame's side. A holder lifts the frame straight back by its thickness, 13.6 over its ribs; the
  springs' arms follow. (Intrepid's animation reads about 10 ± 2: **UNVERIFIED**; a holder's thickness is the floor.)
- **Graflok bars:** a flat black bar on each long side over the notch half, a hook tab at each end (static).
- **Holders go in at the notch end** (Intrepid's animation: in portrait, pushed down from the top, flap first). The
  back's portrait turn is now clockwise seen from behind, so the notch end comes to the top.

**The holder** (`intrepid/holder.js`): Intrepid's own, 3D-printed, matte black.
- 177.5 × 120 × 13.2 (14 over the ribs; Intrepid's jig: "HOLDER ASSY 188 × 120 × 14" with the tab). Each sheet 5.0
  under its face.
- From the slide's end: the labels' strip 15 deep (a white label 31.3 × 12.1 each corner, seven ribs between); the
  ribbed band to 35 (13 ribs, a plain square 17 in the middle with a pale dot; no logo); the light-trap rib, its far side
  141.3 from the flap end (the standard). Ribbed rails 11.2 wide down the sides, six ribs each; the flap 13.5.
- The dark slides: 106 × 166 × 0.8. The tab 30 wide, 10 out past the end, a 23.8 × 5 slot, seven holes Ø 1.3 at 3
  pitch along its edge (Intrepid's straight-on photograph). One face of each slide is printed **EXPOSED** with a white
  dot by the tab; the other is plain. Two bronze wire slide locks stand off the end, 26.9 either side of the middle.
- Seated, the sheet's centre is on the lens's axis: the slide's end stands 13 past the back's edge.

**The shutter's controls** (corrected; Copal's No. 0 drawing and Intrepid's front photograph DSCF8409, the same
lens type). Seen from the front, clockwise from the top:
- the cocking lever at 12, a knurled disc travelling 45° clockwise as it is cocked (12 → 1:30). In the photograph the
  disc stands 28° clockwise of the release and clear of it; an earlier reading of the drawing (11:15 → 12:45) put the
  resting disc over the release cap. The 45° travel is Copal's; where it ends is **UNVERIFIED**;
- the speeds, fixed on the shutter's face: 500 … 1, B, T, 9.5° apart, from 500 at 68° anticlockwise of the top to T at 36.5°
  clockwise. The knurled ring carries a red ▼ on its front edge and turns to bring it to the speed wanted (at 125
  in the photograph, 49° anticlockwise of the top). T can be set;
- the release at 11, a pale cap with a red ▼;
- the flash contact at 2;
- **the press-focus lever at 3**: a black pointer, its tip 39 from the axis, swung 9° (tip up closed, down open), a red
  dot showing when it is open. Copal: it opens the blades "regardless of whether the shutter is charged or not"; only
  moving it back closes it; while it is open the release is locked. (The model had called it the release.) Which way
  it opens: **UNVERIFIED** (from the photograph's rest position);
- the cable socket at 9 (the model had it at half past one: that is the flash contact).

**Checked against traced rays, 2026-11-09** (`scratch/raytrace/README.md`). The 150's extension at its nearest focus
(0.62 m) is 104.3 mm, the thin lens's value (rays through a triplet stand-in: 98.6); it was 156. Corner illumination
stopped down is 0.64, the cos⁴ floor for 27° (it was 0.80); wide open it is 0.45, an estimate the tracing can't check.
Blur and the quoted depth of field are measured from the entrance pupil and agree with each other to 0.3%.

**The routine** (plan §5.6; main.js, gated on `controls: 'holder'`): X holds the shutter open or closes and cocks it;
J puts the holder in or takes it out; Shift+J pulls the slide or puts it back, EXPOSED out once that sheet has been
fired on; F fires. With no holder in, F does the whole routine and leaves the shutter as it found it. Out from under the
cloth first, and the cloth laid aside (folded over the back it is in the holder's way). Clicking the press-focus lever
works it; clicking the holder works its slide.
- The glass shows the lens's picture only while the blades are open (held open, or firing). A holder sliding under it
  shuts the light off behind its leading edge.
- The page keeps each sheet: two sides, each slide showing EXPOSED or not — what the photographer goes by, not what is on
  the sheet. A side whose slide shows EXPOSED is not put toward the lens; a fresh holder comes when both do.
- Nothing stops a mistake; the sheet records it, in light added (a screen: 1 − (1 − a)(1 − b)), and its print is made
  again: fire with the slide in and nothing reaches it; pull the slide with the shutter held open and it fogs for as
  many shutter-times as it lasts; pull a slide showing EXPOSED and fire, and two pictures lie on one sheet (turned
  across it if the back was turned between); take the holder out with its slide out and the sheet is light-struck.
- Prints carry the note (`2 exposures`, `fogged`, `light-struck`); the contact sheet groups sheets by holder.
- Checked (`scratch/intrepid/holder/p1.js`): two F's expose sides A and B of holder 1; then by hand, holder 2: fired
  with the slide in (no print), fogged ~1.5 s, a shot on top (`fogged`), slide back and out again and fired
  (`2 exposures, fogged`), out with the slide out (`light-struck`).

## Folding flat and setting up, 2026-11-09

**Sources.** Intrepid's 4×5 quickstart guide (December 2020, `scratch/intrepid/fold/qs/`), pages 4–7: "Setting up"
and "Packing away", seven steps each, drawn. Its setup guide's animations 1 (unfold) and 2 (base mount)
(`scratch/intrepid/fold/dl/`, three and two frames): the camera folded, the rear rising with the front lying flat and
the bellows fanned between them, the front being raised. Measurement and sequence only, never in a repo.

**Packing away** (the guide's order; the camera's `fold(true)`; the page's Fold up button, Shift+E):
1. The lens off. It comes away on its board: the board is drawn out of the panel's recess, then away.
2. The front standard unscrewed from the base. Its wing knob turns three turns and rises out of the carriage's
   insert.
3. Its movement controls loosened: every movement back to zero, the rear's tilt too.
4. The panel pushed down as far as it will go (the fall's 30 mm).
5. The front pushed back against the rear, with the bellows squeezed between them: its board's face 21.2 mm in front
   of the rear frame's face. At the same time the carriage is racked fully back (its front at the plate's rear limit).
6. Front and rear folded down together. The rear turns 90° forward about its pivot; the lock knob runs to the end of
   the arm's slot, now cut to 104° (103° in use, the knob just in front of the pivot and a little below it, as in the
   animation).
   - The front stays parallel to the rear and the same distance from it. It rocks on its foot, the channel's front
     edge, along the carriage's top: turned by θ, the foot is at z = pivot.z − h·cos θ / (1 + sin θ), with h the
     pivot's height above the carriage, 19.2.
   - That keeps it clear of the carriage the whole way. It slides 19 mm up the rear frame on the way down, so it
     lies with its top toward the rear frame's top.
   - (Turned rigidly with the rear about the pivot, its channel would dip 8 mm into the carriage at 45°.)

**Folded:** from the base up, the plate, the carriage, the front standard face down with its top forward (its level
at the front, its star knob near the rear), and the rear frame, back face up with the ground glass's frame and the
Graflok bars on top. That is the animation's first frame.
- The front's channel rests on the carriage. Its knobs clear the rear frame's face by 1.3 mm.
- The bellows are squeezed to 14.1 mm, their pleats 11 mm deep.
- From the plate's underside to the back's top is 85 mm; Intrepid's 97 includes what this model leaves out.

**Setting up** (the animations; `fold(false)`, the Set up button):
1. The rear raised while the front, still lying flat, is pulled forward: its foot from z −35 to −70. The bellows fan
   open between the two frames (`bellows.js` `update(…, fan)`).
   - Each point keeps its distance along the line where the frames' planes meet. Its radius from that line and its
     angle about it go from the rear's values to the front's.
   - The pleats' depth comes from the arc's length. Folds turned in toward the hinge are kept within the room there.
   - Blended in between 4° and 12° of angle between the frames. Only the fold uses the fan: tilts and swings keep
     straight bellows.
2. The panel pushed up again while the front still lies flat. The animation raises the front with the panel up.
3. The front raised, rocking up on its foot, and its controls tightened.
4. Slid forward over its mount (the insert for the lens) and screwed down.
5. Racked out to where the lens is focused.
6. The lens on.

Every movement is then zero, as the guide's "Check everything is zeroed" asks.

**Folded, nothing works but setting up:**
- The page disables firing, looking in, the cloth, the loupe, the movements, the holder buttons, taking apart and
  changing the lens. Only the head's handles can be picked.
- Folding with a holder in is refused ("Take the holder out first"). The cloth and the loupe are taken off first, and
  you step back.
- With the lens off, the glass has no picture, and it is never "seen" for the page to keep live.
- The optics follow the panel's lens axis (`lensAxis`), not the board, so taking the lens off changes nothing for them.

**Checked:**
- `scratch/intrepid/fold/f1.json`, `f2.json`: the two sequences, and the folded stack from the side, front, arm and
  underneath, against the animation's frames.
- `p1.js`: a holder in refuses; the cloth comes off; folding zeroes the movements; while folded every other control
  is refused and no print is made; setting up restores the focus with the lens on.

**Not settled:**
- The quickstart's "hold front and rear standards together" leaves open how far the front is held from the rear and
  where it lies on the folded rear. The model's 21.2 mm and 19 mm slide are what clears the carriage.
- The rear frame's bottom border and the front's channel overlap by about 5 mm when they are pressed together. The
  channel's 36 mm depth and the frame's height can't both be right; it is hidden inside the folded stack.
- The board clip doesn't slide up as the board comes out.
- The lock knobs turn 0.6 of a turn loose while their movement is being set and tighten 0.35 s after it stops (rise
  ring, tilt knob, rear knobs, and the wing nut for swing and shift). The 0.6 turn is a guess.

## The next engine work

- The cloth: a reversible silver side; the drapes follow the camera's tilt (they are made with the camera level).
