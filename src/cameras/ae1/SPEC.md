# The Canon AE-1 (All-Black, 1976) model: dimensions and their sources

The model is an all-black 1976 Canon AE-1 35 mm SLR with breech-lock Canon FD S.S.C. lenses (`src/cameras//index.js`, `src/cameras//`). Neutral `GLASS WORKS` legends replace maker trademarks; the model keeps the `AE-1` designation.

**Axes** (matching `CONTRACT.md` and `SPEC-M6.md`). Millimetres, measured from the lens axis on the film plane:
- `+X` is the photographer's right.
- `+Y` is up.
- `-Z` is toward the subject.

The Canon FD bayonet seating face is at `Z = -42.0`.

## Sources, in order of authority
1. **Canon official factory specifications (1976 AE-1 manual & service documentation)**:
   - Overall body-only dimensions: **141.0 mm wide × 87.0 mm tall × 47.5 mm deep** (including protruding mirror-box mount flange).
   - Canon FD flange focal distance: **42.0 mm**; bayonet outer flange diameter **54.5 mm** (`r = 27.25 mm`), inner throat **48.0 mm** (`r = 24.0 mm`).
2. **Dead-square orthographic studio photographs of an all-black Canon AE-1** (`scratch/ref-ae1/`):
   - `Canon_AE-1_front.jpg` (`1280×774`, calibrated at `7.823 px/mm` across the 141.0 mm chassis)
   - `Canon_AE-1_top.jpg` (`1280×569`, `7.865 px/mm` — confirms the engraved `Φ` film-plane mark at `Z = 0.0 mm`)
   - `Canon_AE-1_back.jpg` (`1280×832`, `8.262 px/mm`)
   - `Canon_AE-1_bottom.jpg` (`1280×536`, `7.957 px/mm`)
3. **Black Canon AE-1 walkthrough video** (`https://youtu.be/jeGOlSkFcIc`, close-up frames in browser evidence).

## Calibrated Body Coordinates (mm)

| Feature | Exact Value (mm) | Source |
| :--- | :--- | :--- |
| Width & lens-axis offset | `X = -65.8 .. +75.2` (`141.0` total; lens axis shifted `4.7 mm` toward `-X`) | `front.jpg`, `top.jpg`, `back.jpg` |
| Height | `Y = -30.9` (bottom) to `+55.5` (pentaprism crown; `+56.1` hot shoe) = `86.4–87.0 mm` | `front.jpg` |
| Baseplate band | `Y = -30.9 .. -25.6` (`5.3 mm` tall) | `front.jpg` |
| Leatherette body wrap | `Y = -25.6 .. +16.9` (`42.5 mm` tall) | `front.jpg` |
| Glossy top plate fascia & deck | `Y = +16.9 .. +38.1` (`69.0 mm` above bottom!) | `front.jpg` |
| Pentaprism height above deck | `Y = +38.1 .. +55.5` (`17.4 mm` above deck; lower badge face `+31..+44.7`, upper raked roof `+44.7..+55.5`) | `front.jpg`, `top.jpg` |
| Main body chassis depth (WITHOUT mount) | `Z = -27.9 .. +4.0` (`31.9 mm` sleek 35 mm body; rear door outer face `+5.5 mm`) | `bottom.jpg`, `top.jpg` |
| Protruding mirror-box & FD flange | Apron `Z = -27.9 .. -38.5`, mount collar `-38.5 .. -40.5`, chrome FD flange `-42.0` (`47.5 mm` total depth) | `bottom.jpg`, `top.jpg` |
| Plan-view end profile | Stadium-chamfered ends: flat front `-54..+63` chamfered ~35° to rounded corners; flat back `-48..+57` curved to `x0/x1` | `top.jpg`, `bottom.jpg` |
| Coaxial Shutter/ASA Dial & Wind Lever | Center `(+60.4, Z = -11.2)`, silver-knurled outer rim `r = 14.1 mm`; wind lever hub coaxial, arm curves back to `(+28, +11)` | `top.jpg`, video `step_57` |
| Inboard Shutter Release + A/L/S + Red LED | Center `(+38.1, Z = -19.1)`, boss `r = 8.4 mm`, front `S` tab at `(+42.5, -28.0)`, red LED at `(+26, -21)` | `top.jpg`, video `step_45` |
| Rectangular Frame Counter Window | Center `(+39.2, Z = -7.9)`, `5.8 × 7.4 mm` | `top.jpg` |
| Left Rewind Drum + Flush Silver Crank | Center `(-51.6, Z = -10.5)`, black drum `r = 11.4 mm`, bright satin-silver folding crank arm flush across top | `top.jpg` |
| Battery-Check Button & `Φ` Mark | Button `(-30.3, Z = -4.9, r = 4.6 mm)`; silver `Φ` mark at `(-38.1, Z = 0.0 mm)` | `top.jpg` |
| Hot Shoe | Centered `X = 0`, `Z = -15.3 .. +2.7`, `19.6 × 18.0 mm`, silver U-rails, center + 2 rear contacts | `top.jpg` |
| Front-Right `AE-1` Badge & Battery Door | `AE-1` at `(+45.8, +27.4)`; flush black battery door `X = +31.1..+49.0, Y = -14.1..+16.6` (no AE-1 Program grip) | `front.jpg` |
| Front-Left PC Cap, Side Block & Stop-Down | PC cap `(-41.3, +26.8, r = 4.6)`; stepped mirror-box side block with meter & `+1.5 EV` buttons; stop-down slide `(-38.0, -10.0)` | `front.jpg`, video `step_47` |
| Bottom Plate Hardware | Silver slotted winder coupler `(+54.5, -10.5, r = 9.5)`; rewind clutch well `(+36.0, -1.5)`; tripod socket `(+1.5, -15.5)`; twin silver contacts `(-59.5, -9.5)` | `bottom.jpg` |
