# AGENTS.md — Working on `glassworks-cameras` with AI Coding Agents

This repository contains 100% procedural, millimeter-accurate Three.js 3D film camera and lens models, plus the cross-agent skills and automated headless WebGL audit harness used to author and verify them.

## Skills in This Repository

Use the standard cross-agent skills under `skills/`:

- **[`skills/camera-builder/SKILL.md`](skills/camera-builder/SKILL.md)** — Load this whenever designing, modeling, upgrading, or fixing a camera or lens under `src/cameras/`. Enforces the 8-stage workflow and all 30 engineering laws in [`docs/PLAYBOOK.md`](docs/PLAYBOOK.md).
- **[`skills/camera-critic/SKILL.md`](skills/camera-critic/SKILL.md)** — Load this in an independent read-only review pass to audit, score, and sign off on any camera before opening or merging a PR. Enforces the 7 Hard Veto Gates and 100-point rubric in [`docs/CRITIC.md`](docs/CRITIC.md).

## Core Commands

```bash
npm install                                      # Install Three.js devDependency
npm run dev                                      # Launch interactive studio viewer (http://127.0.0.1:4173/viewer/)
npm run audit -- --camera <kind> --lineup        # Run V1–V7 WebGL audit + generate 5-plate Evidence Pack
npm run audit:all                                # Full audit + plates across all registered cameras
npm run audit:quick                              # Fast runtime + math + lint gate across all cameras (no plates)
```

## Non-Negotiable Engineering Invariants

1. **100% procedural JavaScript in millimetres**: Every mesh, material map, engraving, badge, and scale is synthesized procedurally using `src/lib/`. Never commit `.glb`, `.obj`, `.fbx`, or raster photo textures.
2. **Zero external copyright pollution**: Reference photographs and factory manual PDFs belong strictly inside gitignored `./scratch/ref-<kind>/` during authoring. Never commit reference photos, copyrighted manuals, or third-party artwork.
3. **Neutral maker legends**: Keep neutral `GLASS WORKS` / `GW` maker marks where manufacturer trademarks sit, while preserving historically accurate model designations, serial ranges, and control scales.
4. **Zero `transmission > 0` materials**: Use the custom `LENS_GLASS_GLSL` / `lib.prepare()` shader pipeline; Three.js `transmission` causes opaque render-target artifacts on headless and mobile WebGL.
5. **Layer-1 isolation**: Every camera mesh (including lazy cutaway stacks, hoods, filters, and rear bayonets) MUST reside on Three.js layer `1` (`o.layers.set(1)`) so live taking-lens cameras on layer `0` never photobomb themselves.
6. **Exact optical math**: Unit-focus lenses must match analytical thin-lens helicoid extension `Δz = (s − √(s² − 4·f·s)) / 2 − f` within `<= 0.0005 mm` and pass `s_min > 4·f_cal`.
7. **Open-gate optical integrity**: Focal-plane SLRs and rangefinders must pass the `V5(gate-clear)` dual-direction raycast through the open lens throat, raised mirror, open curtains, and open film door with zero obstructing geometry.
8. **Mandatory automated + visual sign-off**: Never consider a camera complete until `npm run audit -- --camera <kind>` exits `0` (`MACHINE_PASS`, `0` vetoes, `0` warnings) AND every rendered plate (`ortho_4view.png`, `ortho_top_bottom.png`, `macro_grid.png`, `states_grid.png`, `lenses_grid.png`) has been visually verified against [`docs/CRITIC.md`](docs/CRITIC.md).

## Repository Map

- `src/cameras/<kind>/` — Self-contained folder per camera (`index.js`, `lenses.js`, `SPEC.md`, plus optional helper modules).
- `src/lib/` — Shared procedural CAD engine (`geometry.js`, `materials.js`, `textures.js`, `mesh.js`, `engrave.js`, `decals.js`, `rig.js`, `util.js`).
- `src/optics.js`, `src/formats.js`, `src/shutters.js`, `src/cameras.js` — Shared optical math, film formats, shutter tables, and camera registry.
- `viewer/` — Interactive studio viewer (`index.html`) and deterministic audit page (`review.html`).
- `docs/` — [`PLAYBOOK.md`](docs/PLAYBOOK.md), [`CRITIC.md`](docs/CRITIC.md), [`CONTRACT.md`](docs/CONTRACT.md).
- `scripts/` — `camera-audit.mjs`, `chrome.mjs`, `dev-server.mjs`.
