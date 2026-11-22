# GlassWorks 3D Camera Modeling & Simulation Playbook

> **Standard Operating Procedure** for authoring museum-grade, optically exact, mechanically operational 3D camera models in GlassWorks (`src/cameras/`).
> **Companion Audit Spec**: [CRITIC.md](./CRITIC.md) · **Engine Contract**: [CONTRACT.md](./CONTRACT.md) · **Automated Auditor**: `node scripts/camera-audit.mjs`

**Guarantee**: A camera model built strictly through Stages 0–7 below — and cleared by both the automated machine harness (`scripts/camera-audit.mjs`, exit code `0`) and the independent `camera-critic` subagent (`APPROVED — DELIGHTED`, `>= 96 / 100`, `0` vetoes) — is trustworthy as a teaching instrument for photography optics, film loading, winding mechanics, and real-world operation.

---

## Pipeline Overview (Hard Stage Gates)

Never skip a stage. Every stage has a **hard exit gate** that must pass before advancing.

| Stage | Goal | Required Deliverable | Hard Exit Gate |
| :---: | :--- | :--- | :--- |
| **0** | Single-variant reference lock | `./scratch/ref-<kind>/refs.json` + photos + factory manual | 1 exact variant/serial locked; `>= 8` views; zero sibling-model photo mixing |
| **1** | Sub-mm specification lock | `src/cameras/<kind>/SPEC.md` | Flat shell vs. overall `Box3` separated; every control `(X, Y, Z, R, H)`, corner radius `R`, & hood tilt angle tabulated |
| **2** | Format, shutter & exact optics | `formats.js`, `shutters.js`, `<kind>/lenses.js` | Every lens `fallbackUsed === false`, `s_min > 4·f_cal`, `extErrMm <= 0.0005` |
| **3** | Curved CAD, PBR, lenses & badges | `src/cameras/<kind>/index.js` (exterior + full lens lineup) | Zero straight-line shortcuts; asymmetric stamped-brass radii (Law #26); bare-metal `beadBlastMaps()` chrome & `vulcaniteMaps()` leatherette (Law #25); dual-end `rib=1` knurling (`segs >= 6·n`, `8·n` primary); vector-traced iconic badges; full sculpted lens collection w/ 3D grips, front micro-jewelry & 3D rear bayonets (Laws #27–#30) |
| **4** | Hollow interior & film mechanics | `src/cameras/<kind>/index.js` (open back, shutter, film path) | Split/hollow shell; dead-flat `0x020203` (`specularIntensity: 0.0`) interior black isolated from exterior parts; zero closed-door light leaks; cumulative arc-length `SplineCurve` film web; manual-verified kinematics |
| **5** | Cutaway, accessories & contract | `cameras.js`, `review-dev.js`, lazy cutaway/hood/filter/rear | Full `CONTRACT.md` + `labelAt()` coverage; `LENS_GLASS_GLSL` local-origin; `0` `transmission > 0`; `applyPose()` mid-cutaway & mid-explode lens-swap sync (Law #29); layer-1 isolation & tripod aim (Law #24) |
| **6** | Automated machine audit & plates | `node scripts/camera-audit.mjs --camera <kind>` | Exit code `0`, `0` console/WebGL errors, `0` machine vetoes, `0` warnings, full Evidence Pack including `lenses_grid.png` |
| **7** | Independent adversarial critic | `camera-critic` subagent verdict (`CRITIC.md`) | `APPROVED — DELIGHTED`: Total `>= 96/100`, every dimension `>= 90%`, `0` vetoes, `0` P0/P1 defects |

---

## Stage 0 — Single-Variant Reference Hygiene

**Never model from memory and never mix sibling variants.** Mixing a 1950s unmetered model into a 1960s metered model (e.g., Rolleiflex 3.5B/2.8E into 2.8F K7F) injects wrong dials, charts, and levers.

1. Choose **one exact model, generation, finish, and serial range** (e.g., *All-Black 1976 Canon AE-1*, *Rolleiflex 2.8F K7F White/Black Face*).
2. Collect into `./scratch/ref-<kind>/` (never commit third-party photos to git):
   - **Official factory instruction manual PDF** (e.g., `cameramanuals.org` — authoritative source for every kinematic motion arrow, winding cycle, peep-window color, and cutaway diagram).
   - **Dead-square studio reference photos** from one consistent multi-angle set (e.g., Kamerastore, Seawood Photo, KEH, Wikimedia Commons) covering **all 8 mandatory views**:
     1. Dead-square Front (body + lens, plus bare mount if interchangeable)
     2. Dead-square Back (showing charts, doors, clasps, eyepiece)
     3. Left flank & Right flank (dead-square or low-distortion 3/4)
     4. Top deck (dials, screens, windows) & Bottom baseplate (tripod socket, latch, feet)
     5. Open film back (empty AND loaded if available)
     6. Macro closeups of lenses, iconic front badges/plaques, and knurling/dials
   - **Walkthrough video verification** (when available) for surface gloss, crank/lever swing arcs, and loading sequence.
3. Write `./scratch/ref-<kind>/refs.json` recording `{ model, variant, serialRange, manualPath, photos: { front, back, left, right, top, bottom, interior, macro } }`.

---

## Stage 1 — Sub-Millimeter `SPEC-<KIND>.md` Lock

Before writing geometry, measure directly off calibrated pixel grids over the dead-square photos and lock every number in `src/cameras/<kind>/SPEC.md`:

- **Universal Axes (`mm`, scaled by `0.001` at `mm`)**:
  - `-Z` = optical axis pointing forward out of taking lens
  - `+X` = photographer's right (standing behind camera)
  - `+Y` = up
  - `(0, 0, 0)` = taking lens optical axis **on the film plane**
- **Mandatory Separation**: Record BOTH **flat chassis shell dimensions** (`x0..x1`, `y0..y1`, `zF..zB`) AND **overall closed envelope** (`W × H × D` including protruding mirror box, knobs, strap lugs, closed hood). Never extrude a flat body to the brochure's overall depth.
- **Mandatory Shape & Angle Table** (eliminates the #1 cause of visual mismatch):
  - Every major corner radius (e.g., Rolleiflex lower-rear `R = 16.5 mm` rolled L-bend, AE-1 front chamfers)
  - Every non-vertical structural slant (e.g., Rolleiflex open hood `+7.2°` backward tilt, AE-1 prism brow angles)
  - Exact physical `W × H` and aspect ratio of every rear chart, nameplate, and iconic model badge
  - Exact optical clear aperture diameter (`~f / N_max + 2 mm`) vs. outer bayonet diameter so lenses never look oversized or bug-eyed
  - Complete control table (`name`, `flank`, `X`, `Y`, `Z`, `radius/dims`, `knurl teeth N`, `motion axis & travel`)
- **Neutral Branding Law**: Engrave neutral `GLASS WORKS` / `GW` in place of third-party manufacturer trademarks, while keeping historic model designations (`AE-1`, `2.8F`, `503`, `M6`, `4×5`) authentic.

---

## Stage 2 — Data-Driven Formats, Shutters & Exact Optical Math

Register declaratively in `formats.js`, `shutters.js`, and `src/cameras/<kind>/lenses.js` using `registerLensOptics()` from `src/optics.js`. Never branch on focal length inside engine code.

### Mandatory Optical-Math Invariants (Automated Veto Gate)

1. **Exact Thin-Lens Conjugate Extension (Unit-Focusing Lenses)**:
   For calibrated focal length `f_cal` (mm) and minimum focus distance `s_min = minFocusDistance * 1000` (mm), enforce `s_min > 4 * f_cal` and set `maxExtMm` to the exact analytical root (to `0.001 mm`):
   ```
   v(s_min) = (s_min - sqrt(s_min^2 - 4 * f_cal * s_min)) / 2
   maxExtMm = v(s_min) - f_cal
   ```
   **Tolerance**: `|sp.maxExtMm - exact| <= 0.0005 mm` across every unit-focusing lens in the system.
2. **Supplementary Close-Up Diopters (`+D`, e.g., Rolleinar 1/2/3)**:
   `f_eff = 1000 / (1000 / f_0 + D)`. Register exact optical `maxExtMm` for `f_eff`, while clamping *only* the physical mechanical rack translation to the camera's real rail travel (`min(ext, railMaxMm)`).
3. **Exact Parallax Mask / Frame Coupling**:
   For TLR / RF viewing baselines `B` (mm), compute `Δz = (ext / f_cal) * B` using calibrated `f_cal` (not nominal `f`). Tolerance: `<= 0.001 mm`.
4. **Optically-Coupled Mechanical DoF Indicators**:
   Drive mechanical DoF bands/pointers directly from `dofLimits(d, f_cal, N, coc)` mapped through `FOCUS_PITCH` — never paint static fake DoF wedges.
5. **Complete Prescription, Zero Fallbacks**:
   Register full `design`, `elements`, `groups`, `focalCalMm`, `entrancePupilMm`, `pupilMag`, `maxExtMm`, `transmission`, `k1`, `k2`, `caLat`, `caLong`, `saGlow`, `catsEye`, `astig`, `coma`, `fieldCurv`, `vigOpen/Stop/Exp`, `mtf*`, `cciTint`, `ghostTintA/B`. Assert `fallbackUsed === false`.

---

## Stage 3 — Curved-Surface Procedural CAD, Materials & Badges

Build strictly with `src/lib/` (`revolve`, `slab`, `rbox`, `Kit`, `mergeStaticRigid`, `MatLib`, `baseMaterials`).

### Zero Straight-Line Shortcuts, Deep-Drawn Brass Radii & Exact Geometry Rules
- **Deep-drawn stamped brass plates (Law #26)**: Top decks and baseplates MUST use asymmetric `slab(shape, h, [bBot, bTop], 36+, 0.72, 6+)` rolling shoulders (`~0.45 mm` crisp waist seam vs. `2.0–2.5 mm` deep rolled top/bottom shoulder, `bs >= 6`), softened plan corner fillets, and curved Bezier mirror-box aprons — never uniform `0.85 mm` sharp box chamfers.
- **Die-cast housings & pentaprisms (Law #26)**: Multi-ring rounded-ridge lofts (`>= 10` height rings, `ARC >= 10` corner steps, `2.0–3.2 mm` metallic ridge fillets) with smooth vertex normals and **true millimeter perimeter arc-length UVs `(sMm, yMm)`** — never flat un-beveled polyhedra or shrunk planar UVs.
- **Rolled sheet-metal doors & corners**: Single continuous `absarc` cross-section `slab(..., 28..36)` matching recessed body cheeks — never two boxes glued at 90°.
- **Levers, cranks, rewind arms, paddles & clasps**: Continuous `bezierCurveTo` / `quadraticCurveTo` profiles (`cs = 24..32`, `bs = 3..4`) — never pointed polygon beaks or 4-vertex trapezoids.
- **Flexible leaf springs & film webs**: Real Euler-Bernoulli cantilever beam curves and `THREE.SplineCurve.getSpacedPoints(48..64)` ribbons — never rigid `BoxGeometry` sticks.
- **Exterior cylinders & caps (Law #23)**: `segs >= 28` minimum (`48–108` on primary barrels and dials); terminate every circular button, coin cap, plunger, or rivet `revolve()` at `[0, zEnd]` so it never vanishes head-on.

### Machined Knurling & 3D Tactile Focus-Grip Invariant (Automated Linter Gate)
In `revolve(prof, { segs, ribs: { n, depth, groove, edge } })`:
1. Set the 4th profile flag `rib = 1` on **BOTH** the start AND end vertices of every fluted cylinder or multi-row waffle band:
   ```js
   [[rBase, z0], [rTip, z0 + 0.35, 0.3, 1], [rTip, z1 - 0.35, 0.3, 1], [rBase, z1]]
   ```
   *(Putting `rib = 1` on only one vertex tapers the flutes diagonally into sawtooth mush!)*
2. Set **`segs >= 8 * n`** on primary dials (`n <= 60`) and **`segs >= 6 * n`** minimum on every knurled ring (`e.g., n = 48 -> segs = 384`, `n = 72 -> segs = 432..576`) so every tooth has crisp flat crests and shadowed U-grooves with zero moiré aliasing.
3. **Brand-Authentic 3D Focusing Grips (Law #30)**: Slice vertical ribs with 2–4 recessed dark circumferential lathe channels (`rib = 0` valleys between dual-end `rib = 1` bands) to create genuine 3D checkerboard/diamond waffle rubber blocks (Canon FD, Nikkor AI-S, Pentax SMC-M, Zeiss CF), OR use machined all-metal scalloped anodized aluminum (`lensBlack`, zero rubber) where historically accurate (Olympus OM Zuiko, Leica M).

### Iconic Badges, Dynamic Scales & Lens Optics Rules
- **Bespoke Model Badges**: Never approximate iconic camera model logotypes (`AE-1` hollow slab-serif, `K1000`, `F3`, `OM-1`, `Rolleiflex`-style arched Art-Deco brow) with system fonts. Trace every glyph's exact vector polygons (`moveTo`/`lineTo`/`closePath`, `lineJoin = 'miter'`) onto a high-res (`1024 px` wide) canvas, keep letter interiors transparent (`depthWrite: false`) over glossy lacquer, match `PlaneGeometry(w, h)` 1:1 to canvas aspect ratio, and verify pixel lock via Red(3D)/Cyan(Photo) anaglyph overlay.
- **Left/Right Paired Scales & Multi-Size Dynamic UVs (Laws #14 & #29)**: Generate dedicated unmirrored left and right canvas textures (never mirror numbered rulers with `scale(-1, 1, 1)`). Compute canvas pixel scales (`k = px / (2 * spanMm)`) and geometry UV divisors (`/ (2 * spanMm)`) **dynamically** from each lens/shutter's actual radius — never hardcode `/ 48`, `/ 58`, or `/ 72` across multi-size Copal shutters or lens filter bores!
- **Authentic Lens Lineup, Front Face Jewelry & Rear Bayonet Hardware (Laws #16, #27, #28, #30)**:
  - Individually sculpt EVERY lens in the system (distinct wide/standard/portrait/telephoto profiles, deep stepped baffles on small-glass primes, concave front meniscus where historic, permanently-parked telescoping metal hoods on `built-in` telephotos, hourglass/trumpet front cells clearing Copal shutters on large-format lenses, or individually sculpted progressive engraved close-up pairs like Bay III Rolleinar/Rolleipark 1/2/3 on fixed-lens TLRs).
  - Size clear front glass radius to true entrance pupil (`r_glass ≈ f / (2·N_max) + 1 mm`), trace `revolve()` front glass `r` **ascending** (`0 -> rGlass` -> outward `-Z`), recess cleanly inside an outward-sloping conical engraved beauty ring (`>= 2.4 mm` radial width on EVERY lens, `+Z` offset before `rotateY(Math.PI)`).
  - Dress every front optical face with **unique per-lens period serial numbers**, filter `Ø`, **fine concentric machined hairline rules**, an **exposed bright steel filter-mouth rim chamfer**, **dual opposing retaining-ring spanner-wrench notches (`180°` apart)**, **raised red IR focus dots**, **miniature slotted barrel grub screws (`±90°`)**, and brand micro-hardware (FD green AE-lock collar, K-mount chrome bump collar, AI-S orange min-aperture lock tab, OM dark recessed button collars, M-mount brass RF cam, Copal exposed grooved brass M39/M42 threads + 6-slot steel retaining jam-nut).
  - Build lazy 3D stainless rear bayonet hardware (`ensureRear()`, `toLayer(rearMount)`, watertight beveled `slab()` locking lugs over a `>= 1.2 mm` dark undercut throat, flange screws, stop-down/meter couplers, and **outward-wound `r` descending `rGlass -> 0`** glossy multi-coated convex rear meniscus glass backed by a dark light-trap baffle).
  - For square bayonet lens shades (Hasselblad B60, Rollei Bay III), loft a smooth `14×96` round-to-square transition shell closed by a watertight beveled front rim and lined with dead-flat flocked interior walls.
- **Material Tier Discipline (Laws #18, #25 & #29)**:
  - **Satin silver chrome**: True bare metal (`metalness: 1.0`, `clearcoat: 0.0`, `beadBlastMaps()` `roughnessMap` + micro-peen `normalMap`, `wear: 'chrome'`) — NEVER `metalness < 1.0` with `clearcoat > 0`!
  - **Baked black brass lacquer / piano enamel**: `0x050507..0x0d0d10`, `beadBlastMaps()` micro-grain, `wear: 'blackChrome'`, `roughness: 0.13–0.26`, `clearcoat: 0.65–1.0` (never flat `metalness: 0.04` plastic!).
  - **High-relief vulcanite leatherette**: `vulcaniteMaps()` (`color <= 0x0a0a0c`, `normalScale >= 1.75`, glossy pebble crowns + matte valleys, `sheen <= 0.10`).
  - **Machined controls & shadow collars**: `chromeBright` / `turned` / `steel` framed by recessed dark anodized/flocked shadow collars (`anod` / `flock`) where each control emerges from chrome or leatherette.
  - **Interior anti-reflection black (`interiorBlack` / `palpas`)**: **`0x020203`, `metalness: 0.0`, `roughness: 0.98`, `specularIntensity: 0.0`, `envMapIntensity: 0.04`** — strictly isolated to interior baffles, chamber walls, and inner door faces (NEVER reuse `palpas` on exterior vulcanite/rubber controls like wind-lever thumb tips!).

---

## Stage 4 — Hollow Chassis, Open-Door Film Chamber & Manual-Verified Kinematics

Every camera must open cleanly for photography instruction:
1. **Hollow Chassis & Open Throat**: Split body wings around the mirror box / bellows / taking baffle tunnel; punch true circular mount throats.
2. **Dead-Flat Black Interior Liner**: Line inner chamber walls, tapered baffles, mirror-box tunnel, AND the inside face of every openable door with `interiorBlack` (`0x020203`), letting only chrome guide rails, rollers, tension springs, and spool keys catch specular highlights.
3. **Zero Closed-Door Light Leaks**: Verify mathematically and on closed-back overlays that the closed door overlaps the body cavity on all 4 edges (`doorLeft < cavL`, `doorRight > cavR`), and verify open-door swing arcs clear adjacent mounts/rings.
4. **Cumulative Arc-Length Film Path**: Sample 35 mm / 120 film webs with `THREE.SplineCurve.getSpacedPoints(48..64)` and compute UVs from cumulative 3D chord arc-length so perforations and frame numbers never stretch or clip rollers.
5. **Shutter Rest-State & Exposure Physics**:
   - **Focal-plane SLRs / RFs**: Independent opening & closing curtains with rigid steel laths forming a true traveling slit at fast speeds (`< X-sync`), plus a matte-black internal rear lens baffle preventing `DoubleSide` cutaway backface bleed.
   - **TLR taking lenses**: Overlapping curved crescent blades strictly **closed at rest (`restLeafK = 0`)** and after cocking, opening only during exposure.
   - **SLR leaf shutters**: Open at rest (`leafK = 1`) for viewing, closing before mirror flip and opening during exposure.
6. **Factory-Manual Kinematic Polarity**: Verify crank fold hinge axis, wind/return ratchet direction, rewind fork retraction on door open, double-exposure unlock, and coaxial stationary subassemblies (e.g., stationary Gossen meter inside rotating focusing knob) directly against the factory manual.
7. **Standard Teaching API**: Expose `setDoorOpen(on)`, `setFilmLoaded(on)`, and (where applicable) `setBatteryDoorOpen(on)`, `setFinderOpen(on)`, `setMagnifier(on)`, `setSportsfinder(on)`, `doubleExposeCock()`.

---

## Stage 5 — Cutaways, Lazy Accessories, `CONTRACT.md` & New-Camera Wiring Blueprint

1. **Lazy Instantiation & Mid-State Lens-Swap Sync (Law #29)**: Build `inner` (multi-element curved lens cutaway), `hoodGroup`, `filterGroup`, `rearMount`, and `rolleinarGroup` only on first demand (`ensureInner()`, etc.). Inside `applyPose()`, dynamically sync BOTH `if (cutaway && L.ensureInner()) toLayer(L.inner); L.inner.visible = cutaway;` AND `if (showRear && L.ensureRear()) toLayer(L.rearMount); L.rearMount.visible = showRear;` so swapping lenses while cutaway or exploded is active NEVER leaves the newly mounted lens hollow or missing its rear mount!
2. **Standardized Cutaway Clipping**: Pass every ground glass, Fresnel, and magnifier material through `lib.prepare(..., {})`, and orient `clipPlane` along `new THREE.Vector3(-api.cutSide, 0, 0)` transformed by `mm`'s world quaternion.
3. **`LENS_GLASS_GLSL` Local-Origin Invariant (Law #17)**: Every mesh using `lensGlass` MUST keep its vertices centered at local `(0, 0)` (position off-axis lenses via `.position.set(...)` and add the mesh to `dyn` so `mergeStaticRigid` never bakes an offset into vertices!).
4. **Hard Performance & Layer-1 Gates (Laws #22 & #24)**:
   - **ZERO `transmission > 0`** on any material anywhere (triggers full opaque-scene second render pass every frame!).
   - Merge all rigid static meshes by material via `mergeStaticRigid(root, { dynamic: dyn, lists })`, keeping `mm, head.yawMM, head.pitchMM, head.rollMM, head.bubble, blob` in `camDyn` so `setAim()` moves the tripod head cleanly.
   - Run `toLayer(root)` (setting `o.layers.set(1)`, bitmask `=== 2`) on initial build AND on every lazily-instantiated or lens-swapped subtree so the camera body NEVER photobombs its own taking lens view on layer 0.
   - Keep folding magnifiers parented inside the closing hood lid so invisible children never inflate closed `Box3` bounds.
5. **Exact New-Camera Wiring Blueprint (Files to Create / Register)**:
   | File | Purpose |
   | :--- | :--- |
   | `src/cameras/<kind>/SPEC.md` | Sub-mm body, control, radii, slant, badge, and full lens-lineup specification |
   | `src/formats.js` & `shutters.js` | Add film format & shutter speed table (if not already present) |
   | `src/cameras/<kind>/lenses.js` | Register all lenses + exact thin-lens prescriptions via `registerLensOptics()` |
   | `src/cameras/<kind>/index.js` | Full procedural camera + sculpted lens collection adhering to Laws #1–#30 & `CONTRACT.md` |
   | `src/cameras.js` | Register `CAMERAS[<kind>]` metadata, `viewing()`, `mechanism()`, and lazy `load()` |
   | `viewer/review-dev.js` | Add neutral default `STATE[<kind>]` for deterministic `camera-audit.mjs` studio captures |
   | `scripts/camera-audit.mjs` | Add `<kind>` to tabletop `bench` lineup array if applicable |

---

## Stage 6 & 7 — Automated Machine Audit & Independent Adversarial Critic Loop

1. Run the automated auditor from the repository root:
   ```bash
   node scripts/camera-audit.mjs --camera <kind> --out .audit-out/<kind> --lineup \
     [--spec-dims W,H,D] \
     [--overlay ./scratch/ref-<kind>/front.jpg:front:ox:oy:s:false]
   ```
   Fix **every** machine veto AND warning (`exit code === 0`, `vetoes === 0`, `warnings === 0`), and visually inspect ALL rendered PNGs (`ortho_4view.png`, `ortho_top_bottom.png`, `macro_grid.png`, `states_grid.png`, `lenses_grid.png`, plus overlays) yourself via `read_file` BEFORE calling the critic.
2. Invoke an **independent `camera-critic` subagent** (read-only tools + `skills/camera-critic/SKILL.md` + [CRITIC.md](./CRITIC.md)), passing the generated Evidence Pack (`.audit-out/<kind>/`), the source file, AND the real reference photographs (`./scratch/ref-<kind>/`).
3. **Iterate ruthlessly**: Apply every P0/P1 (and actionable P2) fix ticket from the critic, re-run `camera-audit.mjs`, visually confirm every fix yourself, and re-submit to `camera-critic` until it returns **`APPROVED — DELIGHTED`** (`>= 96 / 100`, every dimension `>= 90%`, `0` vetoes, `0` P0/P1 defects).
4. After modifying any shared library (`lib/materials.js`, `lib/geometry.js`, `camera-audit.mjs`), run `node scripts/camera-audit.mjs --all --quick` to verify zero regressions across all 8 cameras.

---

## Quick-Reference: The 30 Engineering Laws (Gotcha Lookup)

| # | Subsystem | Law (Never Violate) |
| :-: | :--- | :--- |
| 1 | **Refs** | **Single-Variant Hygiene**: Lock 1 exact variant/serial + official manual in `refs.json`; never mix sibling models. |
| 2 | **Specs** | **Shell vs. Envelope**: Never extrude flat chassis shell thickness to the overall brochure depth. |
| 3 | **Specs** | **Level-Horizon Calibration**: Calibrate depth-separated controls only on dead-level photos; low-angle shots shift rear parts `8–10 mm`. |
| 4 | **Transforms** | **`slab()` vs. `ExtrudeGeometry` Height**: `slab(shape, t, b)` spans exact `z ∈ [0, t]`; `THREE.ExtrudeGeometry` adds `bevelThickness` on both ends — verify deck Z/Y before placing decals! |
| 5 | **Transforms** | **`slab()` Rotation Axes**: `rx = -PI/2` maps `+Y -> -Z`; `ry = +PI/2` maps `+X -> -Z` (`-X -> +Z` rear) and extrusion `+Z -> +X`. |
| 6 | **Transforms** | **`revolve()` Seam Orientation**: Default `phi0 = -PI` places `u = 0.50` at 12 o'clock (`+Y`), `0.25` front (`-Z`), `0.75` rear (`+Z`), `v = 1` at vertex 0. |
| 7 | **Transforms** | **`CylinderGeometry` UVs**: `u = 0.5` faces `-Z` (front: `rotateY(0)` for front labels; `rotateY(PI)` for rear-open cassette labels). |
| 8 | **Transforms** | **Conical `RingGeometry` Sign**: Apply `+Z` conical offset *before* `rotateY(PI)` so the face ends up facing outward (`-Z`), not flipped backward. |
| 9 | **Transforms** | **`RingGeometry` Text Radius**: UVs map `[-rOuter, +rOuter]`; place `arcText` at `R = 512 * (rInner + rOuter) / (2 * rOuter)`. |
| 10 | **Transforms** | **Flip-Up Lid Crests**: Hinged at `-Z` and flipped `-90°` around `X` turns top decals upside-down (`rz = PI` restores upright front view). |
| 11 | **Knurling** | **Dual-End `rib=1` & `segs >= 6·n` (`8·n` primary)**: Set `rib=1` on BOTH start and end vertices of fluted cylinders and `segs >= 6·n` on EVERY ring (`8·n` on primary dials). |
| 12 | **Curves** | **Zero Straight-Line Shortcuts**: Use multi-ring rounded lofts, `absarc` rolled doors, Bezier levers/cranks, and Hermite leaf springs (`segs >= 28`). |
| 13 | **Badges** | **Vector-Traced Iconic Typography**: Trace bespoke badges as miter-joined `1024 px` vector paths with transparent interior & 1:1 `PlaneGeometry` aspect. |
| 14 | **Scales** | **Unmirrored Paired Rulers**: Never mirror numbered scales with `scale(-1, 1, 1)`; generate dedicated left/right textures. |
| 15 | **Optics** | **Exact Thin-Lens Conjugate Math**: Every unit-focusing lens satisfies `|maxExtMm - exact| <= 0.0005 mm` and `fallbackUsed === false`. |
| 16 | **Optics** | **True Clear Front Aperture**: Size front glass to `~f / (2·N_max) + 1 mm` recessed behind bayonet flange inside a wide conical beauty ring. |
| 17 | **Optics** | **`LENS_GLASS_GLSL` Local-Origin**: Every `lensGlass` mesh stays centered at local `(0, 0)` and registered in `dyn` (never baked off-axis!). |
| 18 | **Interior** | **Dead-Flat Light-Trap Black (`specularIntensity: 0`)**: Line all baffles, chamber walls/dividers, and inner door faces with `0x020203`, `roughness 0.98`, `metalness 0`, `specularIntensity 0.0`, `envMapIntensity 0.04` (kills Three.js 4% dielectric Fresnel grey glare!). |
| 19 | **Interior** | **Light-Seal Overlap & Rear Baffle**: Closed doors must overlap cavity edges on all 4 sides; add rear lens baffles to block `DoubleSide` cutaway bleed. |
| 20 | **Interior** | **Cumulative Arc-Length Film Web**: Sample 35 mm / 120 film webs via `SplineCurve.getSpacedPoints(48..64)` with arc-length UVs (zero stretch/clip). |
| 21 | **Mechanics** | **Coaxial Decoupling & Shutter Rest**: Separate stationary instruments from rotating coaxial drums; keep TLR taking leaf shutters closed at rest (`restLeafK = 0`); parent folding magnifiers inside the lid for accurate `Box3`. |
| 22 | **Perf** | **Zero `transmission > 0` & Cutaway Prep**: Never use `transmission > 0`; pass every ground glass & magnifier through `lib.prepare()` for clipping; statically merge rigid meshes. |
| 23 | **Lathe Caps** | **Close Flat `revolve()` End-Caps to `r = 0`**: Every circular button, baseplate coin cap, clutch plunger, rivet, or contact built with `revolve()` MUST terminate at `[0, zEnd]` — otherwise it is a hollow open cylinder that vanishes head-on! |
| 24 | **Live-App Layer 1 & Tripod Rig** | **Isolate All Camera Meshes on Layer 1 & Keep Tripod Head Dynamic**: After `mergeStaticRigid(root, ...)`, call `toLayer(root)` setting `o.layers.set(1)` (bitmask `=== 2`) plus `castShadow`/`receiveShadow` on every mesh (and on lazy hood/filter/cutaway/lens-swap meshes) so the 3D camera body NEVER photobombs its own taking lens view on layer 0. Always include `mm, head.yawMM, head.pitchMM, head.rollMM, head.bubble, blob` in `camDyn` so `setAim(pan, tilt, roll)` moves the camera and tripod head cleanly! |
| 25 | **True Bare-Metal & Vulcanite PBR** | **Zero Clearcoated Plastic Chrome or Dusty-Grey Rubber**: Satin silver chrome MUST be true bare metal (`metalness: 1.0`, `clearcoat: 0.0`, `beadBlastMaps()` `roughnessMap` + micro-peen `normalMap`, `wear: 'chrome'`) — NEVER `metalness < 1.0` with `clearcoat > 0` and no surface maps! Baked black brass lacquer MUST carry `beadBlastMaps()` micro-grain + `wear: 'blackChrome'` (never `metalness: 0.04` flat plastic!). Vintage SLR leatherette MUST use high-relief jet-black `vulcaniteMaps()` (`color <= 0x0a0a0c`, `normalScale >= 1.75`, glossy pebble crowns + matte valleys, `sheen <= 0.10`), while machined controls use `turned` / `chromeBright` / `steel` with recessed dark shadow collars (`anod` / `flock`) where each control emerges from metal or leatherette! |
| 26 | **Deep-Drawn Stamped Brass Radii & mm Loft UVs** | **Asymmetric Rolling Shoulders & Physical-Scale Loft UVs**: Stamped brass top decks and baseplates MUST use asymmetric `slab(shape, h, [bBot, bTop], 36+, 0.72, 6+)` rolling shoulders (`~0.45 mm` crisp waist seam vs. `2.0–2.5 mm` rolled top/bottom shoulder, `bs >= 6`), softened plan corner fillets, and curved Bezier mirror-box aprons — never `0.85 mm` uniform sharp box chamfers! Every custom pentaprism/finder loft MUST use `>= 10` height rings, `ARC >= 10` corner segments, smooth `2.0–3.2 mm` metallic ridge fillets, and **true millimeter perimeter arc-length UVs `(sMm, yMm)`** (NEVER `px * 0.05` shrunk planar UVs!). |
| 27 | **Lens Collection Craftsmanship & Audit** | **Per-Lens Silhouettes, 3D Rear Bayonet Hardware, Built-In Sliding Telephoto Hoods & `lenses_grid.png`**: Every interchangeable lens in a camera's lineup MUST be individually sculpted and visually audited — never a stretched cylinder copy of the 50 mm default! (1) Give wide, standard, fast-fifty, portrait, telephoto, and large-format lenses their true distinct barrel silhouettes (flared retrofocus bells, hourglass/trumpet Copal cells, deep stepped anti-reflection funnels on small-glass primes, concave front meniscus where historic such as FD 35/2, stepped portrait waists, chrome optical-head waist collars such as 135/4 Tele-Elmar, and Silver-Nose stainless front rims on classic early Zuikos). (2) Guarantee EVERY lens's front engraved nameplate beauty ring has radial width `>= 2.4 mm` (`>= 2.2 mm` hard machine veto) with centered arc typography — never hardcode a single-lens funnel pad that squishes large-glass lenses! (3) Telephoto lenses with `shade: 'built-in'` MUST carry a real telescoping anodized metal hood sleeve permanently parked flush over the front barrel (`hoodGroup.visible = true` inside `[-L, 0]`, leaving the aperture ring unobstructed!) that glides smoothly forward when `hoodOn = true` (never popping in/out from thin air!). (4) Build a lazy 3D stainless rear bayonet or Copal rear-cell assembly (`ensureRear()`, `toLayer(rearMount)`, visible when `explodeK > 0 || lensOut > 0`) with authentic locking lugs, flange screws, coupler levers / brass rangefinder cam / 6-slot steel jam-nut + grooved brass M39/M42 threads, and rear optical glass. (5) Inspect the full `lenses_grid.png` contact sheet (every lens at uniform 1:1 scale + detached rear bayonet / twin-optics macro + hood extended) during Stage 6 & 7 critic review! |
| 28 | **`revolve()` Winding & Watertight Solids** | **Outward Glass Normals & Watertight `slab()` Bayonets / Lofted Hoods**: `revolve()` outward normal is `(nr, nz) = (dz, -dr)`. Trace **front glass (`-Z`)** with `r` **ascending** (`0 -> rGlass`), and **rear meniscus glass (`+Z`)** with `r` **descending** (`rGlass -> 0`) using a dedicated glossy coated opaque-core material (`clearcoat: 1.0`, `envMapIntensity >= 1.6`) backed by a dark light-trap disc — NEVER back-face-culled (`dr > 0`) or washed-out transparent! Build bayonet locking ears, rear guard fins, and coupling ridges as **watertight beveled `slab(arcSector(...))`** solids over a `>= 1.2 mm` dark undercut throat (never hollow open-ended partial `revolve()` slices!), and loft square bayonet shades (B60, Bay III) smoothly round-to-square with a watertight beveled front rim and flocked inner wall. |
| 29 | **Dynamic UVs, Swap Sync & Material Scope** | **Zero Hardcoded Multi-Size UVs, Mid-Cutaway Swap Sync & Interior-Black Isolation**: (1) Compute canvas scale `k = px / (2 * spanMm)` and geometry UV divisor `/ (2 * spanMm)` dynamically from each lens/shutter's exact radius (e.g., Copal No. 0 `28.8 mm` `1/500` vs. Copal No. 1 `34.0 mm` `1/400` and aperture sectors) — never hardcode `/ 48`, `/ 58`, or `/ 72`! (2) Sync `L.ensureInner()` + `L.inner.visible = cutaway` AND `L.ensureRear()` + `L.rearMount.visible = showRear` inside `applyPose()` every frame so mid-cutaway or mid-explode lens swaps never render hollow or bare! (3) Strictly isolate dead-flat `palpas` / `interiorBlack` (`specularIntensity: 0.0`) to interior light-traps — never assign them to exterior matte vulcanite parts (e.g., wind-lever thumb tips), which require dedicated exterior plastic/rubber materials. |
| 30 | **Lens Micro-Jewelry & 3D Tactile Grips** | **Brand-Authentic 3D Grips, Front Face Jewelry, Unique Serials & Progressive TLR Attachments**: (1) Build real 3D multi-row circumferential grooves slicing vertical ribs (`waffleProfile`, dual-end `rib = 1` per band, `segs >= 6·n`) for checkerboard/diamond vulcanized rubber focusing grips (Canon FD, Nikkor AI-S, Pentax SMC-M, Zeiss CF), and machined all-metal twin-band scalloped anodized aluminum (`lensBlack`, zero rubber) where historically accurate (Olympus OM Zuiko, Leica M). (2) Give EVERY lens an exposed bright machined steel filter-mouth rim chamfer, dual opposing front retaining-ring spanner-wrench notches (`180°` apart), fine concentric hairline bezel rules, unique per-lens period serial numbers + filter `Ø`, raised red IR (`R`) focus index dots, miniature slotted barrel alignment grub screws (`±90°`), and iconic brand micro-hardware (FD green AE-lock collar, K-mount chrome bump collar, AI-S orange min-aperture lock tab + silver button, OM dark recessed button collars). (3) On fixed-lens TLRs, sculpt each close-up attachment pair (`Rolleinar/Rolleipark 1/2/3`) individually with progressive cell depth, stepped chrome diopter rings, clear dark multi-coated curved meniscus glass (zero pale haze), engraved `GW ROLLEIPARK/ROLLEINAR 1/2/3` bezels, and raised red 12-o'clock parallax alignment dots! |
