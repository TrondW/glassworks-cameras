# Specification: 1976 Asahi Pentax K1000 (`?camera=k1000`)

> **Variant Locked**: 1976–1978 Japan all-metal Satin Silver Chrome & Black Pebbled Vulcanite Pentax K1000 + **SMC Pentax-M 50mm f/2** (default) and 6-lens K-mount manual prime lineup.
> **Axes**: `-Z` forward out taking lens, `+X` photographer's right, `+Y` up, `(0, 0, 0)` = optical axis on the 35 mm film plane.
> **Neutral Branding**: `GLASS WORKS` / `GW` in place of manufacturer trademarks; historic model badge **`K1000`** preserved in custom vector-traced 1976 split-stem slab typography.

## 1. Shell vs. Overall Envelope (`mm`)
- **Official Factory Manual Spec (`p-08`)**: `143.0 × 91.4 × 83.0 mm` (body + SMC Pentax-M 50mm f/2); body depth `49.5 mm` (`flange = -45.46 mm`).
- **Flat Chassis Shell**:
  - Width: `x0 = -53.2`, `x1 = +83.0` (`136.2 mm` shell; `~143.8 mm` across chrome strap eyelets & triangular D-rings — authentic Spotmatic/K-series leftward optical-axis offset!).
  - Vertical: `y0 = -28.4` (bottom plate), `baseY = -24.0` (baseplate seam), `seamY = +27.0` (top of black vulcanite), `trimY = +30.2` (black collar seam), `deck = +42.1` (satin silver top deck), `prismY = +60.4` (pentaprism peak -> total `~91.8 mm` w/ hot shoe).
  - Depth: `zF = -30.5` (flat front leatherette), `zB = +3.5` (rear door face -> sleek `34.0 mm` chassis shell); protruding mirror-box apron reaches `z = -43.0`, stainless K-mount bayonet flange at **`z = -45.46 mm`**.
- **Plan Contour (Signature 45° Octagonal Chamfers)**:
  - Both front AND rear end corners chamfered at `45°` (`fCham = 8.6 mm`, `rCham = 8.4 mm`, vertex fillet `rf = 1.6 mm`) — NEVER rounded semicircular ends!

## 2. Structural Shapes, Angles & Badges
- **Pentaprism**: Crisp faceted trapezoid loft (`y = 41.8..60.4`), horizontal brow crease at `y = 44.8`, front slanted face carrying neutral geometric `GW` crest + `GLASS WORKS` (`ASAHI PENTAX` layout), rear sloped face carrying a **matte-black raised hot-shoe base pedestal** + satin chrome X-sync hot shoe (`central brass pin + red 'X'`).
- **Iconic `K1000` Front Badge (`X = +51.8, Y = +34.8, Z = zF - 0.12`)**:
  - Vector-traced 1976 **split-stem `K`** (detached vertical serif bar + right chevron with horizontal flag arms) + condensed square-cornered **`1000`** (`22.2 × 5.6 mm`, black enamel fill on satin chrome deck).
- **Front Purity Rule**: **ZERO self-timer lever and ZERO DoF preview lever** on the K1000 front face (signature minimalist classroom K1000!). Only the lower-left (`-X`) X-flash PC sync socket (`X = -38.0, Y = -15.0`) and lower-right (`+X`) black textured plastic K-mount lens release tab (`X = +27.8, Y = -7.5`).

## 3. Control Inventory (`mm`)
| Control | Flank | X | Y | Z | Dims / Teeth | Kinematics |
| :--- | :--- | :---: | :---: | :---: | :--- | :--- |
| Shutter Speed / ASA Dial | Top `+X` | +41.4 | 42.1 | -13.5 | `r = 10.6, h = 6.7`, `n = 48` (`segs = 384`) | Rotates across `B, 1..1000` (`60X` orange, `B` green, `ASA` window); red index triangle on silver deck at `X = +27.0` |
| Shutter Release + "Cocked" Dot | Top `+X` | +53.6 | 42.1 | -20.5 | collar `r = 4.5, h = 3.5`; chrome button `r = 3.7, h = 7.5` | Depresses `-1.6 mm` on fire; tiny cocked dot at `(+57.6, 42.1, -21.2)` |
| Rapid-Wind Lever + Counter | Top `+X` | +66.2 | 42.1 | -11.5 | black counter drum `r = 9.8, h = 6.0` w/ red window; swept silver arm + sculpted black rear thumb tip | `155°` wind stroke (`+st.lever`, CCW outward right) |
| Film Rewind Knob & Crank | Top `-X` | -41.2 | 42.1 | -11.5 | conical black base `r = 12.2, h = 2.2`, smooth black drum `r = 9.7, h = 5.3` (green `R` + arrow), flush straight silver crank bar | Lifts `+11.0 mm` & unfolds when `doorK = 1` |
| Strap Eyelets & D-Rings | `±X` | `-53.2 / +83.0` | +34.2 | -16.5 | silver posts + triangular chrome D-rings hanging to `Y = +23.0` | Static |
| Rear Eyepiece | Back | 0.0 | +37.6 | +5.2 | `17.6 × 13.4 mm` black rubber-rimmed square frame | Upright laterally-correct pentaprism finder (`eyePose()`) |
| Bottom Battery Cap (`LR44`) | Bottom `-X` | -19.0 | -28.4 | -14.5 | `r = 9.0` coin-slotted satin chrome disc (capped `[0, 0.44]`) | Static |
| Tripod Socket (`1/4"-20`) | Bottom | -4.0 | -28.4 | -14.0 | `r = 4.6` chrome threaded collar + adjacent screw | Tripod mount anchor |
| Rewind Release Button | Bottom `+X` | +42.0 | -28.4 | -8.5 | recessed `r = 4.2` bezel + `r = 2.5` chrome plunger (capped!) | Static |

## 4. Hollow 35 mm Film Chamber & Shutter
- Dead-flat `interiorBlack` (`0x020203, roughness: 0.98, specularIntensity: 0.0, envMapIntensity: 0.04`) across chamber walls, mirror box, gate, cassette well, and inner door liner.
- Horizontal rubberized matte-black silk two-curtain focal-plane shutter (`1s..1/1000s + B`, `1/60s` X-sync), twin pairs of gleaming stainless film rails, 8-tooth black sprocket shaft, glossy multi-slotted take-up spool, pull-up rewind shaft/fork, dimpled satin-matte black pressure plate, cumulative arc-length translucent `GW 400` film web.

## 5. K-Mount Teaching Lens Lineup (`flange = -45.46 mm`, `49 mm` filter)
| ID | Focal / Max | Elements/Groups | `focalCalMm` | `minFocusM` | Exact `maxExtMm` | Barrel `L` | `glassR` |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| `k-28-2.8` | 28 mm f/2.8 | 7/7 | 28.4 | 0.30 | `3.363` | 31.5 | 14.5 |
| `k-35-2` | 35 mm f/2 | 7/7 | 35.4 | 0.30 | `5.605` | 42.0 | 16.5 |
| `k-50-2` *(default)* | 50 mm f/2 | 5/5 | 51.2 | 0.45 | `7.713` | 31.0 | 13.0 |
| `k-50-1.7` | 50 mm f/1.7 | 6/5 | 51.4 | 0.45 | `7.784` | 31.5 | 16.0 |
| `k-85-2` | 85 mm f/2 | 5/4 | 85.2 | 0.85 | `10.855` | 46.0 | 20.5 |
| `k-135-3.5` | 135 mm f/3.5 | 5/5 | 134.8 | 1.50 | `14.950` | 66.0 | 19.5 |
