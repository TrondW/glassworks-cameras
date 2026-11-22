# Specification: 1976 Olympus OM-1 MD (`?camera=om1`)

> **Variant Locked**: 1974–1978 Yoshihisa Maitani Satin Silver Chrome & Black Pebbled Leatherette **Olympus OM-1 MD** (clean bare sculptural peaked pentaprism with rear Shoe 1 mounting socket, square silver-bordered `MD` lower-left front badge, top-left engraved `OM-1`, concentric lens-mount shutter speed ring) + **F.Zuiko Auto-S 50mm f/1.8** (default) and 7-lens OM-mount Zuiko manual prime lineup.
> **Axes**: `-Z` forward out taking lens, `+X` photographer's right, `+Y` up, `(0, 0, 0)` = optical axis on the 35 mm film plane.
> **Neutral Branding**: `GLASS WORKS` / `GW` in place of manufacturer trademarks; historic model badges **`OM-1`** (vector-traced geometric sans on top-left deck) and **`MD`** (square silver-bordered front badge) preserved.

## 1. Shell vs. Overall Envelope (`mm`)
- **Official Factory Manual Spec (`p-07`)**:
  - Body only: **`136.0 × 83.0 × 50.0 mm`** (`510 g`), `flange = -46.0 mm`.
  - With F.Zuiko Auto-S 50mm f/1.8 (`L = 31.0 mm`, `49 mm` filter): **`136.0 × 83.0 × 81.0 mm`** (`680 g`).
- **Flat Chassis Shell (calibrated directly to `commons_om1_mount_front.jpg` at `s = 8.006 px/mm`, `ox = 629.5, oy = 548.0`)**:
  - Width: `x0 = -62.2`, `x1 = +70.8` (`133.0 mm` satin-chrome shell locking both flanks `< 0.5 mm` on front overlay; `~137.4 mm` across front-corner strap lugs & angled chrome triangular D-rings).
  - Vertical: `y0 = -26.8` (bottom satin-chrome baseplate), `baseY = -22.5` (baseplate seam), `seamY = +19.8` (top of black leatherette), `trimY = +22.8` (upper glossy-black collar top -> bottom of satin-chrome top plate), `deck = +35.5` (flat satin-chrome top plate), `prismY = +55.5` (razor-crisp bare Maitani pyramid peak -> **`55.5 - (-26.8) = 82.3 mm` body**, `~85.0 mm` w/ 59 mm Zuiko lens overhang).
  - Depth: `zF = -29.0` (flat front leatherette), `zB = +4.0` (rear door face -> ultra-slim **`33.0 mm`** Maitani body shell!); stepped glossy-black & tapered satin-chrome mirror-box apron reaches `z = -41.5`, concentric silver shutter-speed ring sits at `z = -41.0..-45.4`, brushed stainless OM bayonet flange (`OD = 58.0 mm`, `ID = 46.0 mm`, 3 Phillips screws, red dot at `9:30`) at **`z = -46.0 mm`** (`50.0 mm` exact body depth!).
- **Plan Contour & Maitani Stepped Cassette Rear Lip**:
  - Clean softly rounded rectangular ends (`rEnd = 6.2 mm` front & rear), subtle crisp flat flanks (`ks_om1b_02/03/04.jpg`).
  - Rear door top & bottom edges step gracefully around the taller left (`-X`) film cassette chamber (`ks_om1b_02/07.jpg` & manual `p-05`).

## 2. Sculptural Pyramid Pentaprism, Concentric Shutter Ring & Badges
- **Bare Maitani Pyramid Pentaprism**: Arched wide satin-chrome lower brow (`y = 34.8..41.5`, carrying bold tracked `GLASS WORKS`), rising as a razor-crisp steep triangular pyramid to a sleek narrow rounded spine at **`y = 55.5`** (`x = ±2.8`), with the recessed chrome threaded **Shoe 1 mounting socket** on the rear slope (`Y = 44.0, Z = +1.8`) — zero bulky add-on hot shoe.
- **Concentric Lens-Mount Shutter Speed Ring (`z = -41.0..-45.4`, `r = 29.8 mm`)**:
  - Satin-silver rotating ring surrounding the OM bayonet throat with **two opposite knurled silver finger-grip tabs** (`3 o'clock` & `9 o'clock`, `X = ±31.2, Y = 0`), top band engraved **`B  1  2  4  8  15  30  60`** (blue) **`125  250  500  1000`** (black), aligned against a crisp red index mark on the bayonet bezel.
- **Iconic Badges**:
  - **`OM-1`** (`X = -28.6, Y = deck + 0.08, Z = -22.2`): High-resolution vector-traced 1973 bold geometric `OM-1` engraved black upright on the left satin-chrome top deck.
  - **`MD`** (`X = -40.5, Y = -11.5, Z = zF - 0.35`): Square matte-black inset framed by crisp silver border (`7.6 × 6.8 mm`) on lower-left front leatherette.

## 3. Control Inventory (`mm`, per Factory Manual `p-03..05` & `_grid_front.png`)
| Control | Flank | X | Y | Z | Dims / Teeth | Kinematics |
| :--- | :--- | :---: | :---: | :---: | :--- | :--- |
| Concentric Shutter Speed Ring | Front Mount | 0.0 | 0.0 | -43.2 | `r = 29.8, w = 4.4`, twin knurled tabs `±31.2` | Rotates around `-Z` (`st.dialT = (shI - 7) * SHUTTER_STEP`) across `B, 1..1000` (`1/60` X-sync) |
| Rewind Release Knob (`R`) | Front `+X` | +38.0 | +25.5 | -29.2 | `r = 4.6` silver dial w/ vertical thumb ridge, red index dot & `R -` | Turns `90°` to disengage sprocket clutch |
| Mirror Lock-Up Knob (`MLU`) | Front `+X` Apron | +28.2 | +18.2 | -34.2 | `r = 3.7` angled slotted chrome rotary knob | Rotates `90°` to lock reflex mirror up |
| Self-Timer Lever | Front `+X` | +38.5 | -7.0 | -29.2 | `r = 6.8` chrome/black hub + vertical chrome-striped arm (`Y = -1..+11.2`) | Winds `180°` counter-clockwise (`4–12 s` delay) |
| FP / X Flash Sync & PC Socket | Front `-X` Apron | -28.4 | +18.5 | -34.2 | concentric chrome PC terminal + knurled FP/X collar w/ red dot | Switches FP / X flash sync |
| `MD` Square Front Badge | Front `-X` | -40.5 | -11.5 | -29.3 | `7.6 × 6.8 mm` silver-bordered black `MD` emblem | Static |
| ASA / ISO Film Speed Dial | Top `+X` | +26.0 | 35.5 | -11.5 | `r = 10.6, h = 7.0`, `n = 44` (`segs = 352`) diamond silver rim + black center release button + front lock pin | `ASA 25–1600` (static on exposure) |
| Shutter Release Button | Top `+X` | +43.2 | 35.5 | -18.5 | conical black/chrome collar `r = 5.4`, threaded chrome plunger `h = 7.2` | Depresses `-1.6 mm` on fire |
| Rapid-Wind Lever + Counter | Top `+X` | +54.8 | 35.5 | -10.0 | black-topped chrome-rimmed hub `r = 9.4`, flat angled silver blade + matte-black rear thumb pad; tiny recessed `S/1..36` window at `(+66.0, -10.5)` initialized to `'1'` at boot | `150°` wind stroke (`-st.lever`) |
| Meter `ON / OFF` Switch | Top `-X` | -29.2 | 35.5 | -8.4 | low-profile black/chrome toggle lever + `ON` / `OFF` deck engraving (`10.6 × 10.6 mm`) 100% clear of prism & rewind collar | CdS meter power switch |
| Rewind Knob & Folding Crank | Top `-X` | -43.2 | 35.5 | -12.0 | `r = 9.8, h = 6.6` horizontally-grooved chrome drum + flush folding straight silver crank | Lifts `+11.0 mm` & unfolds on `doorK = 1` |
| Front-Corner Strap Eyelets | Front `±X` | `-60.9 / +69.5` | +19.5 | -25.5 | front-edge chrome posts + angled triangular chrome D-rings | Static (`~137 mm` overall span) |
| Rear Eyepiece | Back | 0.0 | +31.8 | +5.0 | deeply recessed rectangular black rubber frame + dark blue-violet curved multi-coated ocular glass | `0.92×` wide-vision pentaprism (`eyePose()`) |
| Zuiko Lens Collar Buttons | Lens Rear Collar | `142°` / `-38°` | — | -49.2 | chrome lens-release button at `142°` (`10:30` front); chrome DoF preview button at `-38°` (`4:30` rear / `7:30` front) | DoF button depresses radially `-1.2 mm` on `dofK` |
| Bottom Baseplate (`p-05`) | Bottom | `-58..+67.5` | -26.8 | -13.5 | recessed-bezel `PX625` battery cap (`+55.8, -11.5, r=7.6`) + clear guide pin hole (`+57.4, -23.6`, `3.0 mm` bridge), recessed-bezel MD cap (`+36.8, -13.5, r=7.0`), tripod bush (`+2.5`) w/ flanking screws (`-2.7, +7.7`), `MADE IN JAPAN` (`-13.2`), twin gold MD contacts pill (`-24.5`), serial `560716` (`-39.5`) — ALL capped `[0, zEnd]`! | Static |

## 4. Hollow 35 mm Film Chamber, Air-Damper Mirror & Cloth Shutter
- Dead-flat `interiorBlack` (`0x020203, roughness: 0.98, specularIntensity: 0.0, envMapIntensity: 0.04`) across chamber walls, mirror box, cassette well, and inner door.
- Horizontal rubberized-cloth focal-plane shutter (`1 s–1/1000 s + B`, `1/60 s` X-sync) + steel laths, gleaming chrome twin rails with left guide pins (`p-05`), 8-tooth black dual sprocket, multi-slotted take-up spool, pull-up chrome rewind fork, translucent perforated `GW 400` film web (`SplineCurve.getSpacedPoints`), and Maitani's signature bottom-mounted air-damper cylinder & oversized reflex mirror + Type `1-13` split-image screen + solid glass roof pentaprism visible in cutaway!

## 5. Olympus OM-Mount Zuiko Teaching Lens Lineup (`flange = -46.0 mm`, `49 mm` filter)
| ID | Focal / Max | Elements/Groups | `focalCalMm` | `minFocusM` | Exact `maxExtMm` | Barrel `L` | `glassR` |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| `zuiko-24-2.8` | 24 mm f/2.8 | 8/7 | 24.5 | 0.25 | `3.032` | 31.0 | 17.0 |
| `zuiko-28-3.5` | 28 mm f/3.5 | 7/7 | 28.4 | 0.30 | `3.363` | 31.0 | 15.8 |
| `zuiko-35-2.8` | 35 mm f/2.8 | 7/6 | 35.4 | 0.30 | `5.605` | 33.0 | 16.5 |
| `zuiko-50-1.8` *(default)* | 50 mm f/1.8 | 6/5 | 51.2 | 0.45 | `7.713` | 31.0 | 17.8 |
| `zuiko-50-1.4` | 50 mm f/1.4 | 7/6 | 51.4 | 0.45 | `7.784` | 36.0 | 19.2 |
| `zuiko-85-2` | 85 mm f/2 | 6/4 | 85.4 | 0.85 | `10.913` | 46.0 | 20.8 |
| `zuiko-135-3.5` | 135 mm f/3.5 | 5/4 | 135.2 | 1.50 | `15.050` | 73.0 | 21.0 |
