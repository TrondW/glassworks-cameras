## Summary

- **Camera / Component**: <!-- e.g., Nikon FM2n (`fm2n`), or shared `src/lib/` improvement -->
- **Variant & Serial Range Locked**: <!-- e.g., 1984 Chrome body, honeycombed titanium shutter -->
- **Lenses Included**: <!-- List all focal lengths & apertures -->

## Automated Machine Audit Gate (`npm run audit`)

- [ ] `npm run audit -- --camera <kind> --out .audit-out/<kind> --lineup` passed with **`[MACHINE_PASS]`**
- [ ] `0` hard vetoes (`V1`–`V7`, including `V5(gate-clear)` for focal-plane cameras)
- [ ] `0` warnings
- [ ] If shared `src/lib/` or core files were touched, `npm run audit:quick` passed across **all** cameras

```text
<!-- Paste the [MACHINE_PASS] summary line from camera-audit.mjs here -->
```

## Independent `camera-critic` Sign-Off (`docs/CRITIC.md`)

- [ ] Reviewed all 5 Evidence Pack plates (`ortho_4view.png`, `ortho_top_bottom.png`, `macro_grid.png`, `states_grid.png`, `lenses_grid.png`) against dead-square studio reference photos
- [ ] Rubric score **`>= 96.0 / 100`** with every dimension `>= 90%` and `0` P0/P1 defects

## Visual Evidence Pack

<!-- Drag and drop the rendered PNG plates directly into this PR description (do NOT commit reference photos or audit PNGs to git). -->

- `ortho_4view.png`:
- `ortho_top_bottom.png`:
- `macro_grid.png`:
- `states_grid.png`:
- `lenses_grid.png`:

## Hygiene Checklist

- [ ] No copyrighted reference photographs, manuals, or third-party assets committed
- [ ] Neutral `GLASS WORKS` / `GW` maker marks used where manufacturer logos sit
- [ ] `src/cameras/<kind>/SPEC.md` included with verified sub-mm dimensions
