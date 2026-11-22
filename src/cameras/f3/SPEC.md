# Specification: 1982 Nikon F3HP (`?camera=f3`)

> **Variant Locked**: 1982 Giorgetto Giugiaro Satin-Matte Black **Nikon F3HP** with **DE-3 High-Eyepoint Removable Pentaprism Finder**, signature **red front-grip stripe**, and **Nikkor 50mm f/1.4 AI-S** (default) + 6-lens AI-S F-mount teaching lineup.
> **Axes**: `-Z` forward out taking lens, `+X` photographer's right, `+Y` up, `(0, 0, 0)` = optical axis on the 35 mm film plane.
> **Neutral Branding**: `GLASS WORKS` / `GW` in place of manufacturer trademarks; historic model badges **`F3`** (custom vector-traced hollow serif) and **`HP`** preserved.

## 1. Shell vs. Overall Envelope (`mm`)
- **Official Factory Manual Spec**: Body `148.5 × 101.5 × 69.0 mm` (w/ DE-3 HP finder & grip); with Nikkor 50mm f/1.4 AI-S (`L = 40.0 mm`, `flange = -46.5 mm`): `148.5 × 101.5 × 103.5 mm`.
- **Flat Chassis Shell (calibrated directly to `Nikon_F3_HP.JPG` at `s = 12.345 px/mm`)**:
  - Width: `x0 = -55.8`, `x1 = +84.4` (`140.2 mm` body shell; `~149.8 mm` across strap lugs & chrome triangular D-rings).
  - Vertical: `y0 = -32.6` (bottom plate), `baseY = -28.0` (baseplate seam), `seamY = +23.7` (top of black leatherette), `deck = +35.2` (top plate deck), `prismY = +68.9` (DE-3 HP peak -> exact `101.5 mm` total height!).
  - Depth: `zF = -31.5` (flat front leatherette), `zB = +4.5` (rear door face -> `36.0 mm` chassis shell); sculpted Giugiaro right front grip (`+X`, `x = +62.0..+84.4`) protrudes smoothly forward to `z = -38.0`; protruding mirror-box apron reaches `z = -43.0`, brushed stainless F-mount bayonet flange (`OD = 57.0 mm`, `ID = 44.0 mm`, 4 Phillips screws) at **`z = -46.5 mm`**.
- **Signature Giugiaro Contour & Red Stripe**:
  - Softly rounded stadium rear corners (`rBack = 11.5 mm`), sculpted convex smooth-black right-hand ergonomic finger grip (`X = +62.0..+84.4`, `Z = -31.5..-38.0`) bordered cleanly on its inboard vertical seam (`X = +61.2, Y = -28.0..+23.7`) by the razor-crisp **1.85 mm vertical Giugiaro red stripe (`#c8241c`)**!

## 2. Removable DE-3 High-Eyepoint Finder (`finderK = 0..1`)
- **Closed (`finderK = 0`)**: Tall, bold stepped DE-3 trapezoidal prism (`y = 35.0..68.9`, `w = 48.0 -> 34.0 mm`, `z = -34.5..+14.5`) with:
  - Slanted matte-black front brow carrying crisp white `GLASS WORKS` (`Nikon` layout), lower-left **`HP`** badge (`X = -17.5, Y = 43.2`), recessed lower **ADR aperture-direct-readout prism window** (`X = -8.5, Y = 37.5`), and tiny **red LCD illuminator push-button** on the right side (`X = +24.8, Y = 39.2`).
  - **Pebbled black leatherette trapezoidal inset panel** on the rear sloped roof of the DE-3 housing.
  - **Protruding circular coated High-Eyepoint glass eyepiece** (`r = 10.6 mm` bezel, `Z = +16.0`) with **teardrop eyepiece-shutter blind lever** on its left (`X = -14.8, Y = 45.2`).
  - **ZERO hot shoe on top of the DE-3 prism!** (F3 hot shoe sits on the left rewind shoulder!)
- **Removed (`finderK = 1`)**: Entire DE-3 prism lifts/removes cleanly off the body (`+Y`), exposing the **interchangeable Type-K split-image matte focusing screen** in its gleaming silver/black frame, twin side locking rails, and front ADR/LCD optics deck (`ks_f3c_07.jpg`)!

## 3. Iconic `F3` Badge & Front/Top/Bottom Control Inventory (`mm`, per Factory Manual `p-02`/`p-03`)
| Control | Flank | X | Y | Z | Dims / Teeth | Kinematics |
| :--- | :--- | :---: | :---: | :---: | :--- | :--- |
| Iconic Hollow `F3` Serif Badge | Front `+X` | +54.0 | +29.0 | -31.6 | `9.6 × 5.6 mm` vector-traced white outline, transparent interior | Static |
| Self-Timer LED Window (`#5`) | Front `+X` | +53.5 | +14.8 | -31.8 | `7.8 × 8.4 mm` deeply smoked dark-maroon ribbed window w/ center bar | Emissive glow on self-timer |
| DoF Preview + Mirror Lock-Up (`#2/#3`) | Front `+X` | +38.9 | +15.8 | -32.0 | chrome `r = 4.1` DoF plunger coaxial inside teardrop black MLU ring | Depresses on `dofK`; swings up on MLU |
| Mechanical Backup Lever (`#6`) | Front `+X` | +34.5 | -8.0 | -32.2 | slender vertical curved flip-down lever + red dot | `1/60s` mechanical backup |
| Exposure Memory Lock (`#7`) | Front `+X` | +39.4 | -14.3 | -32.2 | `r = 5.2` glossy-black convex round button | Push-in AE lock |
| PC Flash Sync Socket (`#17`) | Front `-X` | -42.0 | +25.2 | -31.8 | `r = 4.3` concentric chrome threaded socket | Static |
| Lens Release Button (`#19`) | Front `-X` | -35.0 | -0.8 | -32.2 | `r = 3.8` brushed-chrome plunger | Lens mount release |
| Shutter Speed Dial (`#57`) | Top `+X` | +36.2 | 35.2 | -13.5 | `r = 10.8, h = 8.4`, `n = 40` (`segs = 320`), 3D silver center A/T lock button, self-timer lever on front | `A(green), X, T, B, 8..1(orange), 2..30, 60(red), 125..2000` |
| Shutter Release + Power Switch + Wind Lever (`#51..55`) | Top `+X` | +59.8 | 35.2 | -12.0 | chrome threaded button `r = 4.6`, red-dot power collar, swept black Giugiaro lever + bold rear thumb rest, front ME lever, outer curved blue-grey frame counter sector | `140°` wind stroke; shutter press `-1.5 mm` |
| Left Hot Shoe + Rewind Crank + ISO/EC Dial (`#32..39`) | Top `-X` | -40.8 | 35.2 | -12.0 | silver contoured U-rail hot shoe w/ 3 front contacts wrapping collar (`h = 2.8`) + tall smooth black rewind drum (`h = 5.8`, total `8.6 mm`) + straight chrome crank | Lifts `+11.5 mm` & unfolds on `doorK = 1` |
| Bottom Baseplate (`#10..12, #23..26`) | Bottom | `-44..+62` | -32.6 | -14.0 | black coin MD-4 cover (`-43.5`), silver battery cap (`-16.5`), tripod socket (`-3.0`), silver MD coupler (`+25.0`), chrome rewind button (`+41.0`), positioning bore (`+58.0`) — ALL capped `[0, zEnd]`! | Static |

## 4. Hollow 35 mm Interior, Quilted Titanium Shutter & Dual-Mirror SPD Cutaway
- Dead-flat `interiorBlack` (`0x020203, roughness: 0.98, specularIntensity: 0.0, envMapIntensity: 0.04`) across chamber walls, gate, cassette well, inner door.
- **Horizontal Quilted Black Titanium Foil Shutter** (vertically micro-ribbed titanium texture + twin steel laths, `8s..1/2000s + B + T + X(1/80)`), gleaming left stainless vertical guide roller (`ks_f3hp_05.jpg`), twin stainless film rails, twin gold MF-14 data contacts, 8-tooth sprocket, multi-slotted take-up spool, pull-up rewind fork.
- **Nikon Museum Cutaway Feature**: Main semi-silvered 45° reflex mirror **PLUS hinged rear secondary sub-mirror & tilted bottom-floor SPD metering condenser lens assembly** (`Nikon_F3_and_50mm_lens_cutaway_at_Nikon_Museum.jpg`), solid roof pentaprism inside DE-3, and curved multi-element AI-S lens optics!

## 5. Nikon F-Mount AI-S Teaching Lens Lineup (`flange = -46.5 mm`, `52 mm` filter)
| ID | Focal / Max | Elements/Groups | `focalCalMm` | `minFocusM` | Exact `maxExtMm` | Barrel `L` | `glassR` |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| `ais-24-2.8` | 24 mm f/2.8 | 9/9 | 24.5 | 0.30 | `2.415` | 46.0 | 18.5 |
| `ais-28-2.8` | 28 mm f/2.8 | 8/8 | 28.4 | 0.20 | `5.873` | 44.5 | 17.5 |
| `ais-35-2` | 35 mm f/2 | 8/6 | 35.4 | 0.30 | `5.605` | 51.5 | 17.5 |
| `ais-50-1.4` *(default)* | 50 mm f/1.4 | 7/6 | 51.6 | 0.45 | `7.855` | 40.0 | 19.2 |
| `ais-85-2` | 85 mm f/2 | 5/5 | 85.4 | 0.85 | `10.913` | 52.5 | 21.5 |
| `ais-105-2.5` | 105 mm f/2.5 | 5/4 | 105.0 | 1.00 | `14.211` | 69.5 | 22.0 |
| `ais-135-2.8` | 135 mm f/2.8 | 5/4 | 135.2 | 1.30 | `18.071` | 83.5 | 23.0 |
