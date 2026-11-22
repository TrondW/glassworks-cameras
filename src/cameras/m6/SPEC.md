# The Leica M6 model: dimensions and their sources

The owner's camera is an early "classic" M6. It is black chrome, from the Wetzlar production (engraved ERNST LEITZ
WETZLAR GMBH), code 10404, with the 0.72× finder. The lens is the third Summicron 50 mm f/2: code 11817, black,
1969–79, E39, engraved Germany. The model is `src/cameras//index.js`, and the finder's data is in
`src/cameras//`.

The model has neutral GLASS WORKS legends where the maker's names are. It has no red dot, and none of the owner's
serial numbers or personal engraving.

**Axes** (the same as the 503CX). Millimetres, measured from the lens axis on the film plane:
- +X is the photographer's right.
- +Y is up.
- −Z is toward the subject.

The M bayonet's seating face is at Z −27.8.

## Sources, in order of authority

1. **Leica's dimensioned drawing of the M6.** Technical data pm-14029, October 2022, page 1. The 2022 reissue keeps
   the classic's body.
   - Edges come from the PDF's own vector paths (`p1_paths.json`): line segments, and the corner arcs' and circles'
     centres and radii.
   - The outlines are drawn with a thick stroke lying outside the edge, so reading pixels gives edges ~0.3 mm too
     far out. The first pass did that; the vector values replaced it.
   - The drawing's bayonet and its screws sit 0.38 mm right of its own lens axis. The dimension lines and the meter
     spot are on the axis, so the model keeps the mount concentric.
   - We read the vector PDF's paths directly, at 1.05743 pt/mm.
   - Front view: X = (281.98 − x_pt)/S and Y = (583.738 − y_pt)/S.
   - Back view: X = (x_pt − 447.53)/S and Y = (585.01 − y_pt)/S.
   - The dimension lines confirm the mapping: the bottom is at −33.49, the deck at 38.50 and the housing top at 44.45.
   - Copies are in `scratch/ref-m6/leica-m6-2022-technical-data/` (measurement only, not in the repo).
2. **Square-on photographs of early Wetzlar M6 bodies** (eBay listings, measurement only, never textures):
   - 204646186575 (Fotopia): front, back, top and close-ups.
   - 357306606738.
   - 116740915362.

   The top views are perspective shots at about 65 cm. They are calibrated on the lens axis and on features the
   drawing fixes, never on the plate's ends: the left end has the sloped facet and the right end has a lug.
3. **Leica's 1989 handbook, pp. 4-8 to 4-10.**
   - The finder: 0.72×, a base of 69.25 mm, and frames for 28/90, 35/135 and 50/75. The frames show 23 × 35 mm at
     the closest distance.
   - The meter's 12 mm white spot.
   - The 120° lever stroke.
4. **The lens: a square-on side photograph of an 11817** focused at ∞ (eBay 257780502497, photo 7).
   - Silhouette widths were measured row by row: 10.45 px/mm, set by the 42 mm front.
   - The camera stood about 4° behind square. So a mark on the near side sits 0.07 × its radius lower than the
     silhouette's edges, and the measurements are corrected for that.

## Body

| Part | Value | Source |
|---|---|---|
| Length | X −59.4 … 79.2 (138.6) | drawing |
| Lens axis above bottom | 33.5 (bottom at Y −33.5) | drawing |
| Body (leatherette) depth | Z −24.7 … 7.5 (32.2), stadium plan, ends r 16.1 | drawing |
| Top plate depth | Z −25.15 … 9.35 (34.5) | drawing |
| Overall depth | 40 (with the eyepiece) | drawing |
| Seam (leatherette top) | Y 20.3 | drawing |
| Baseplate band | Y −33.5 … −28.0 | drawing |
| Deck | Y 38.5 (72 above the bottom) | drawing dimension |
| Finder housing top | Y 44.45 (78 above the bottom) | drawing dimension |
| Housing step | X 18.6 | drawing |
| Rewind facet | from X −47.5, falling ~44.5° to (−59.6, 32.6); the knob stands in a round well cut into it, 0.7 wider than the knob | drawing, photograph (Fotopia 9) |
| Top plate ends | left r 10.3, right r 17.25 (a half round) | drawing, photographs |
| Shoulder line (top plate's lower front edge) | Y 26.09; Y 23.29 under the finder; the step between them is hidden behind the bayonet's top (the lines stop at the ring, X 0.38 and −11.35) and modelled at X 0; the band below is set back 0.5 | drawing (vector lines) |
| Shoe notch | X −3.4 … 18.6, Z ≥ −9.5, at deck level | photographs |

### Front

| Part | Value | Source |
|---|---|---|
| Viewfinder window: bezel / glass | X −46.63…−24.65, Y 25.58…40.99 (corners r 0.51) / X −45.91…−25.33, Y 26.30…40.32; strip line at Y 27.91 | drawing (vector lines and corner arcs) |
| Illumination window: bezel / glass | X −17.88…−0.55, Y 28.16…41.16 (r 0.6) / X −16.90…−1.53, Y 29.16…40.11; 11 ribs at 1.397, their ends r 0.7 | drawing (vector) |
| Rangefinder window: bezel / glass | X 27.73…37.43, Y 30.24…36.84 / X 28.41…36.71, Y 30.96…36.12 | drawing (vector) |
| Maker's name → GLASS | X 39.9 … 58.5, Y 32.7 … 35.9 (letters spaced across it) | drawing |
| Model name → WORKS | ends at X 39.9, Y 28.2 … 31.0 | drawing |
| Bayonet | outer r 25.81; six cross-head screws on r 23.7 at 30° + k·60° | drawing |
| Lens release | centre (30.4, 0); housing r 5.1 stepped at 4.45; ring r 3.85; bright button r 3.49 with a red index; latch at X 21.2–25.9 | drawing (vector circles), photographs |
| Frame selector | boss (−31.6, 0) r 4.25; arm 7 wide leaning 29.5° toward −X, top at Y ~15, with a window | drawing |
| Battery cap | (42.79, −10.01), knurl r 8.79, face r 6.80 | drawing (vector circles) |
| Rewind lever R | a stem 4 wide (X 43.6–47.6) rounded at Y 25.5, on a disc r 2.83 round its screw (45.6, 19.21) r 1.6; knob (45.58, 23.69) r 1.5; "R" centred (38.55, 21.85), 2.1 high | drawing (vector circles) |
| Strap lugs | eyelets (80.5, 15.45) and (−60.8, 15.45), r 1.5, at Z ≈ −14.3 | drawing |
| Shutter opening (behind the mount) | X −16.65…17.4, Y −12.1…11.9, r 2 | drawing |

### Top

| Part | Value | Source |
|---|---|---|
| Speed dial | centre (27.4, Z −8.75), r 8.83, Y 38.87 … 43.3; screw 4.4 off centre beside the B | drawing, photographs |
| Speed dial layout | 13 stops round the dial: B (orange), 1 … 60, the flash sign (orange), 125 … 1000; anticlockwise from B seen from above; each number reads inward from the rim; the speed at −X is set | photograph (Fotopia 4) |
| Wind lever hub | centre (53.6, Z −14.15): base disc r 8.4 to Y 39.51, groove to 40.1, the lever's ring r 7.85–8.0 to 42.09, the release collar r 8.2 to 43.8 (its rounded edge's tangent at 43.41) | drawing front and back views (vector lines), photographs |
| Release button | r 3.95, top Y 44.47, bright, cable-release thread | drawing (vector lines), photographs |
| Wind lever | arm Y 40.1–42.0; plastic tip Y 40.0–44.45, ending at X 41.6; plan from the top views; stand-off 30°, stroke 120° | drawing, photographs, handbook |
| Frame counter | (68.4, Z −13.9): recess r 6.0, dome r 4.4 to Y 39.34 (X: 68.1 on the drawing's front view, 68.8 on the top photograph); a white disc with a tick a frame and black numbers, read under a fixed V at the front | photographs |
| Rewind knob | top-face centre (−56.9, 41.8, Z −7.4); axis leaning 33.7° toward −X; r 7.95; 6.9 high; plain, knurled at its foot; the crank folded flat across the top, its knurled handle hanging down the inner side | drawing front view, photographs |
| Hot shoe | in the notch; both rails black (the left one's front corner cut); keyhole contact (head r 2.0, tail 2.4 wide) in a black plastic insert running to the back; small screw at the front | photograph (Fotopia 4) |
| Housing engraving | GLASS WORKS, 2.0 high, centred (−27, Z 5.0), where ERNST LEITZ WETZLAR GMBH is | photographs |

### Back

| Part | Value | Source |
|---|---|---|
| Eyepiece | centre (−36.2, 33.84) (67.4 above the bottom, 23.2 in from the left end); rings r 9.1, 7.8, 7.5, 6.3, 6.0; protrudes 2.9 | drawing |
| Flash socket | (8.48, 32.27): a black collar r 4.07 (the drawing's boss, a logo on the reissue), the bright socket r 3.3 with its pin | drawing, back photograph |
| Back door | frame X −35.04…54.9, Y −25.41…19.69; leatherette inset X −29.29…49.14, Y −21.03…13.40 (r 0.51); rails X −38.05…−35.04 and 54.9…57.87, from the baseplate (Y −27.6) to the seam (20.5); screws (−31.59, 15.77), (51.43, 15.79) r 1.65 | drawing (vector lines and circles) |
| Film-speed reminder | centre (10.94, −3.82) (29.7 above the bottom, 68.3 from the right end); r 15.78; fixed scale (ISO lower half 6 → 6400 at 180° + 15°·log₂(ISO/200); DIN upper half 9° → 39° at (DIN − 24)·5°); the inner ring r 8.1 with two open triangles turns; knob r 5.23 with 12 ribs | drawing, photographs |
| Origin box | X 61.84…65.78, Y −20.03…12.92, MADE IN GERMANY reading down | drawing back view (vector) |

### Bottom

The tripod bush is at X 64.0, Z −9.0: 15.2 mm from the right end, by the drawing's dimension. The bottom photographs
put it under the lettering's end. The baseplate's locking key is at X −45.1, Z −8.6, under the rewind end
(photographs: Fotopia 5, eBay 357306606738 photo 9).

## Lens: Summicron 50 f/2 (III), 11817

The profile was measured at ∞ from the front (Z −44.4) to the bayonet's seat (Z 0).

| Part | Z | Radius |
|---|---|---|
| Front ring (filter thread E39 inside, r 19.5) | −44.4 … −41.3, rim flared to −40.6 | 20.9, flare 21.3 |
| Groove | −40.4 … −39.9 | 20.5 |
| Band with the aperture index dot (at −39.4) | −39.8 … −37.5 | 20.9 |
| Groove | −37.3 … −36.9 | 20.4 |
| Aperture ring: knurled except a smooth patch for the f-numbers (−14° … 123°) | −36.85 … −31.5 (flat −35.6 … −32.2) | 23.35 |
| Tube carried out by the helicoid (two screws at 57° and −88°) | −31.5 … −21 | 20.8 |
| Focusing grip: 180 fine ribs | −27.6 … −16.8 (flat from −26.0) | 24.1 |
| Distance scale (feet orange over metres white) | −16.5 … −9.9 | 23.6 |
| Depth-of-field ring: fixed; knurled for mounting except the scale (±42°) and the red dot (70°) | −9.7 … −1.9 (flat −8.8 … −3.1) | 26.5 |
| Bayonet (bright), lugs behind the seat, rear tube | −1.9 … 0 / 0 … 1.9 / to +6 | 21.4 / 21.3 / 16.9 |

**The rings' mechanics.**
- Aperture: 18.2° a stop. The f-numbers are at +stops × 18.2° from f/2, so f/16 lies toward +X. This was measured
  on the photograph at 18.0–20.5° per stop.
- Focus: the distance scale is laid out by the helicoid, at 58.9° of turn per millimetre of extension. With the
  engine's extension (4.5 mm at 0.7 m, the thin lens for f = 51.9 mm; a ray trace gives 4.4), ∞ → 0.7 m is 265°.
- Depth-of-field marks: ±58.9° × N/30 mm. On the photograph they are 7.8°, 15°, 20.8° and 32.8° for f/4, 8, 11 and
  16; the model has 7.9°, 15.7°, 21.6° and 31.4°.

## Optics, as checked

The checks are in `scratch/m6/verify/optics_check.mjs`, run in the page.

- **The lens view** uses the true focal length of 51.9 mm on 24 × 36. That gives 38.3° × 26.0° at ∞, and
  35.3° × 24.0° at 0.7 m, where the effective focal length is 56.5 mm.
- **The finder's frames** are drawn for 35 × 23 mm at 0.7 m with the lens's true focal length, as the lens view's
  field is. The 50 frame is 34.7° × 23.2°.
  - At ∞ it shows 90% × 89% of the film's width and height.
  - At 3 m it shows 92% × 90%.
  - At 0.7 m it shows 98% × 97%.

  This matches the manual: at a distance the film takes in a little more than the frame shows.
- **Parallax.** The frames move by the finder axis's offset over the distance focused: (+36.2, −33.84) mm / d, so
  they shift down and to the right as you focus close.
- **The rangefinder patch** is the second image, from 69.25 mm to the right. It is shifted by
  base × (1/z − 1/d_focus), where z is each point's depth from the film plane. It coincides at the distance focused,
  and the shots confirm this at ∞, 3 m and 0.7 m (`scratch/m6/shots/taa_look_*`).
- **The meter.** It reads the centre-weighted spot (2/3 of the frame's height across) through the lens at the
  working aperture. The LEDs follow the error in stops: ▶ alone means a stop or more under, and ◀ alone a stop or
  more over. Both lit with one brighter means within half a stop to a stop; both alike means correct. The LEDs go
  out 10 s after the last key, click or wheel and come back with the next. There is no battery to run down.
- **The end of the roll.** The release on frame 36 exposes it, then the page plays the reload: the R lever over
  (62° toward its R), the knob cranked 26 turns, the baseplate off — the counter springs back to its start, two
  ticks before 0 — the baseplate on, the lever back, and three strokes to frame 1. The film otherwise winds on by
  itself after each frame, as the 503CX's does on this page.
- **The frame preselector** (click it, or Q) leans toward the lens for 2.6 s and the finder shows the 28 and 90 mm
  frames; away from the lens is 35 and 135; upright, where it rests with the 50 mm lens on, 50 and 75.
- **The depth-of-field scale** agrees with thin-lens limits for c = 1/30 mm (f = 51.9 mm) to within 0.5% (the ring and the limits now come from the same thin lens):
  - f/8 at 3 m: 2.35–4.18 m on the scale, against 2.34–4.18 m thin-lens.
  - f/4 at 1 m: 0.96–1.04 m on the scale, against 0.96–1.04 m.

## Still to confirm on the owner's camera (plan §4.2)

- The rewind knob's exact lean and size: the drawing is of the 2022 reissue, whose rewind is the classic's.
- The wind lever's plan: it came from perspective photographs.
- The eyepiece window.
- The frame counter's numbering.
- The frame preselector's travel (±29.5° assumed) and the R lever's swing (62° assumed).
- The flash socket's position: the 2022 reissue has none.
- The lens's length from the front to the seat: 44.4 is measured, not published.
