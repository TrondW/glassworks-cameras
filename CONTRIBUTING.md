# Contributing to `glassworks-cameras`

We welcome community contributions of new historic film cameras, additional lenses for existing mounts, mechanical interlocks, and improvements to the procedural CAD engine!

Because every camera lives in its own self-contained folder (`src/cameras/<kind>/`), you can build and submit a complete camera system with almost zero merge-conflict risk.

---

## Building a New Camera (Human or AI-Assisted)

Whether you author geometry by hand or work alongside an AI coding agent (such as Gemini in Antigravity, Gemini CLI, Codex, or Cursor), follow the exact 8-stage engineering workflow in **[`docs/PLAYBOOK.md`](docs/PLAYBOOK.md)** and **[`skills/camera-builder/SKILL.md`](skills/camera-builder/SKILL.md)**.

### Quick Checklist

1. **Open or claim a camera issue** using the [Camera Request template](.github/ISSUE_TEMPLATE/camera-request.md) so two contributors don't build the same model at once.
2. **Lock one exact variant (Stage 0)** — Pick one specific year, finish, and serial range. Collect your factory manual PDF and dead-square studio reference photos into `./scratch/ref-<kind>/` (**gitignored — never commit reference photos or manuals!**).
3. **Write `src/cameras/<kind>/SPEC.md` (Stage 1)** — Document sub-mm body envelope, corner radii, control coordinates `(X, Y, Z, R, H)`, finder angles, and full lens lineup dimensions.
4. **Register data & optical prescriptions (Stage 2)** — Add any new film format or shutter table to `src/formats.js` / `src/shutters.js` and register every lens in `src/cameras/<kind>/lenses.js` via `registerLensOptics()`.
5. **Model exterior, full lens collection, hollow interior & animations (Stages 3–5)** — Build `src/cameras/<kind>/index.js` using `src/lib/` adhering to all 30 Laws in `docs/PLAYBOOK.md` and the runtime interface in `docs/CONTRACT.md`. Wire the camera into `src/cameras.js` and `viewer/review-dev.js`.
6. **Pass the Automated Machine Audit (Stage 6)**:
   ```bash
   npm install
   npm run audit -- --camera <kind> --out .audit-out/<kind> --lineup --spec-dims W,H,D
   ```
   Require **`[MACHINE_PASS]`**, `0` vetoes, and `0` warnings.
   If you edited anything under `src/lib/`, also run `npm run audit:quick` to verify zero regressions across all cameras.
7. **Run an Independent Adversarial Critic Pass (Stage 7)** — Inspect all 5 generated plates (`ortho_4view.png`, `ortho_top_bottom.png`, `macro_grid.png`, `states_grid.png`, `lenses_grid.png`) against [`skills/camera-critic/SKILL.md`](skills/camera-critic/SKILL.md) and [`docs/CRITIC.md`](docs/CRITIC.md). Fix every P0/P1 defect until the camera clears **`>= 96 / 100` (`APPROVED — DELIGHTED`)**.
8. **Open a Pull Request** — Attach the 5 rendered Evidence Pack plates in your PR description (not committed to git) along with the `audit_report.json` summary. GitHub Actions CI will automatically re-run the headless WebGL audit on your PR.

---

## Trademark & Copyright Hygiene

- **Never commit** third-party photographs, scanned manuals, or copyrighted logos into the repository. Keep all reference materials strictly inside gitignored `./scratch/`.
- Keep neutral **`GLASS WORKS` / `GW`** maker engravings where manufacturer logos appear on original hardware, while preserving historically authentic model names, control layouts, and mechanical specifications.
- All code and documentation contributed to this repository is licensed under the [MIT License](LICENSE).
