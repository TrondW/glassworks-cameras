---
name: camera-builder
description: >-
  Use this skill whenever designing, modeling, upgrading, or troubleshooting any 3D camera
  or lens model in glassworks-cameras (`src/cameras/`). Enforces the 8-stage museum-grade
  camera playbook, optical mathematics invariants, hollow interior standards, automated
  machine auditing, and mandatory independent camera-critic sign-off.
---

# GlassWorks 3D Camera Builder

Every camera in `glassworks-cameras` is an **interactive teaching instrument** for optical mathematics, film loading, shutter physics, and real-world operation — never a static prop.

## Authoritative References (Read Before Modeling)
1. **Master Playbook (8-Stage Gated Workflow + 30 Laws)**: [PLAYBOOK.md](../../docs/PLAYBOOK.md)
2. **Engine & Viewing Contract**: [CONTRACT.md](../../docs/CONTRACT.md)
3. **Companion Critic Rubric & Veto Gates**: [CRITIC.md](../../docs/CRITIC.md)
4. **Automated Machine Auditor**: [camera-audit.mjs](../../scripts/camera-audit.mjs)

## Mandatory 8-Stage Build Execution

Follow every stage in order; **never skip a gate**:

1. **Stage 0 — Single-Variant Reference Lock**: Pick ONE exact model, finish, and serial range. Gather the official factory manual PDF + `>= 8` dead-square studio photos into `./scratch/ref-<kind>/` (gitignored — never commit reference photos or manuals!) and write `refs.json`. Never mix sibling variants.
2. **Stage 1 — `SPEC.md` Lock**: Create `src/cameras/<kind>/SPEC.md`. Measure flat chassis shell vs. overall closed `Box3`, every corner radius `R`, open hood/brow tilt angles, chart/badge aspect ratios, clear lens aperture diameters, and every control coordinate `(X, Y, Z, R, H, teeth)` to `0.1 mm`. Keep neutral `GLASS WORKS` / `GW` maker legends while preserving historic model badges.
3. **Stage 2 — Declarative Data & Exact Optical Math**: Register format, shutter, and all lenses in `src/formats.js`, `src/shutters.js`, and `src/cameras/<kind>/lenses.js` via `registerLensOptics()` from `../../optics.js`. Compute exact analytical `maxExtMm = (s - sqrt(s² - 4·f_cal·s))/2 - f_cal` (`<= 0.0005 mm` error, `fallbackUsed === false`), exact diopter `f_eff`, and exact parallax `Δz = (ext / f_cal) * B`.
4. **Stage 3 — Curved CAD, Deep-Drawn Brass Radii, Bare-Metal PBR, Badges & Full Lens Lineup (Laws #11–#17, #23, #25–#30)**:
   - **Deep-Drawn Stamped Brass & Loft Radii (Law #26)**: Use asymmetric rolling shoulders `slab(shape, h, [bBot, bTop], 36+, 0.72, 6+)` (`~0.45 mm` waist seam vs. `2.0–2.5 mm` rolled shoulder), curved Bezier mirror-box aprons/levers/cranks, `absarc` rolled doors, Hermite leaf springs, and `>= 10`-ring `ARC >= 10` pentaprism lofts with **true millimeter perimeter arc-length UVs `(sMm, yMm)`** (`segs >= 28`; terminate every circular cap `revolve()` at `[0, zEnd]`, Law #23).
   - **True Bare-Metal & Vulcanite PBR (Law #25)**: Satin silver chrome MUST be bare metal (`metalness: 1.0`, `clearcoat: 0.0`, `beadBlastMaps()`, `wear: 'chrome'` — NEVER plastic-chrome with `metalness < 1.0, clearcoat > 0`!). Baked black lacquer carries `beadBlastMaps()` + `wear: 'blackChrome'`. Leatherette uses high-relief jet-black `vulcaniteMaps()` (`color <= 0x0a0a0c`, `normalScale >= 1.75`, `sheen <= 0.10`). Frame every protruding control with a recessed dark shadow collar (`anod` / `flock`).
   - **Machined Knurling & 3D Focusing Grips (Laws #11 & #30)**: Set `rib = 1` on **BOTH** start and end vertices of every fluted cylinder/band and **`segs >= 6 * ribs.n`** (`8 * n` for `n <= 60`). Build genuine 3D multi-row waffle rubber focusing grips (recessed circumferential lathe channels slicing vertical ribs) OR machined all-metal scalloped aluminum grips where historic.
   - **Bespoke Badges & Dynamic Multi-Size UVs (Laws #13, #14 & #29)**: Trace iconic custom model badges as `1024 px` miter-joined vector paths with 1:1 `PlaneGeometry` aspect. Never mirror numbered rulers (`scale(-1, 1, 1)`). Compute canvas scales `k = px / (2 * spanMm)` and geometry UV divisors `/ (2 * spanMm)` dynamically for every lens diameter and shutter size.
   - **Full Lens Collection, Micro-Jewelry & 3D Rear Bayonets (Laws #27, #28 & #30)**:
     - Individually sculpt EVERY lens in the lineup (wide retrofocus bells, hourglass/trumpet Copal cells, stepped funnels, concave front meniscus where historic, Silver-Nose trims, chrome waist collars, permanently-parked telescoping metal telephoto hoods leaving the aperture ring unobstructed, lofted round-to-square bayonet shades, or progressive engraved close-up pairs on fixed-lens TLRs).
     - Front optical face jewelry on EVERY lens: clear aperture `~f/(2·N_max) + 1 mm` with `revolve()` `r` **ascending** (`-Z` normal), conical beauty ring `>= 2.4 mm` wide (`+Z` offset before `rotateY(Math.PI)`), unique per-lens period serial + filter `Ø`, fine concentric hairline rules, exposed bright steel filter-mouth chamfer, dual opposing spanner notches (`180°` apart), raised red IR focus dot, recessed slotted barrel grub screws (`±90°`), and mount-specific micro-hardware.
     - Lazy 3D stainless rear bayonet (`ensureRear()`, `toLayer(rearMount)`): watertight beveled `slab(arcSector(...))` locking lugs over `>= 1.2 mm` dark undercut throat, flange screws, stop-down/meter levers, and **outward-wound `r` descending** glossy coated convex rear meniscus glass backed by a dark light-trap disc.
5. **Stage 4 — Hollow Chassis, Flat-Black Interior & Operational Film Path (Laws #18–#21 & #29)**:
   - Split/hollow body shells with zero closed-door light leaks and a 100% unobstructed open-gate optical path (passes `V5(gate-clear)` raycast front↔back with lens off, mirror up, curtains open, and back open).
   - Line all baffles, chamber walls/dividers, and inner door faces with dead-flat anti-reflection black (`0x020203`, `roughness: 0.98`, `metalness: 0.0`, **`specularIntensity: 0.0`**, `envMapIntensity: 0.04`). **Isolate `palpas`/`interiorBlack` strictly to interior surfaces** — NEVER assign them to exterior rubber/vulcanite parts.
   - Sample film webs via `THREE.SplineCurve.getSpacedPoints(48..64)` with cumulative arc-length UVs; verify crank/lever/hinge polarity and shutter rest state (`restLeafK = 0` on TLRs; traveling slit on focal-plane SLRs) against the factory manual.
6. **Stage 5 — Cutaways, Mid-State Swap Sync, `CONTRACT.md` & Wiring (Laws #17, #22, #24 & #29)**:
   - Lazy-build cutaway stacks, hoods, filters, and rear bayonets; **sync `L.ensureInner()` + `L.inner.visible = cutaway` AND `L.ensureRear()` + `L.rearMount.visible = showRear` inside `applyPose()` every frame** so mid-cutaway / mid-explode lens swaps never render hollow.
   - Keep `LENS_GLASS_GLSL` meshes local-origin `(0, 0)` in `dyn`; pass ground glass/magnifiers through `lib.prepare()`; enforce **`0` `transmission > 0` materials**; isolate **every mesh on layer 1 (`o.layers.set(1)`)** and keep `mm, head.yawMM, head.pitchMM, head.rollMM, head.bubble, blob` in `camDyn` (Law #24).
   - **Wire all 6 touchpoints**: `src/cameras/<kind>/SPEC.md`, `src/formats.js`/`src/shutters.js`, `src/cameras/<kind>/lenses.js`, `src/cameras/<kind>/index.js`, `src/cameras.js`, `viewer/review-dev.js` (`STATE[<kind>]`), plus `scripts/camera-audit.mjs` lineup array if applicable.
7. **Stage 6 — Machine Audit & Self-Inspection of Visual Evidence Pack**:
   ```bash
   npm run audit -- --camera <kind> --out .audit-out/<kind> --lineup \
     --spec-dims W,H,D \
     --overlay ./scratch/ref-<kind>/front.jpg:front:ox:oy:s:false
   ```
   Resolve **every** machine veto AND warning (`exit code === 0`, `vetoes === 0`, `warnings === 0`), then visually inspect ALL rendered plates (`ortho_4view.png`, `ortho_top_bottom.png`, `macro_grid.png`, `states_grid.png`, `lenses_grid.png`, overlays) BEFORE calling the critic. After any shared `src/lib/` edit, also run `npm run audit:quick` across all cameras.
8. **Stage 7 — Independent Companion Critic Loop (`camera-critic`)**:
   - Invoke a fresh read-only independent **`camera-critic`** agent/reviewer following [skills/camera-critic/SKILL.md](../camera-critic/SKILL.md), passing `.audit-out/<kind>/`, `src/cameras/<kind>/index.js`, `src/cameras/<kind>/lenses.js`, and `./scratch/ref-<kind>/`.
   - **NEVER declare a camera complete** until `camera-critic` returns **`APPROVED — DELIGHTED`** (`>= 96 / 100`, every dimension `>= 90%`, `0` vetoes, `0` P0/P1 defects). Iterate fixes, re-run Stage 6, visually confirm, and re-submit until approved.
