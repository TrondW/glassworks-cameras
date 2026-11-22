# The camera contract

What any host application (GlassWorks simulator, Studio, Camera School, or standalone Three.js scenes) may ask of a camera on the tripod. Every camera model meets this contract, so a page can drive any of them interchangeably. See [`PLAYBOOK.md`](./PLAYBOOK.md) for the full 8-stage authoring specification.

Hosts build a camera through `createCamera(kind, { lens })` in `src/cameras.js` (or `src/index.js`). `kind` is a key of `CAMERAS` (`'503cx'`, `'m6'`, `'intrepid'`, `'ae1'`, `'rolleiflex'`, `'k1000'`, `'f3'`, `'om1'`). `createCamera` builds the model and attaches the common members marked *(cameras.js)* below; everything else comes from the camera's own module (`src/cameras/<kind>/index.js`).

Units: the model is built in millimetres under a group scaled to metres. Its lens axis runs along −Z, as a three.js
camera's does, and +X is the photographer's right. World-space arguments and results are in metres.

## The description (`CAMERAS[kind]`, also `cam.desc`)

| Member | What it is |
|---|---|
| `kind`, `name`, `system` | The camera's key, its name on the page, and its lens mount (`'hasselblad-v'`). |
| `format` | A `FORMATS` entry (`formats.js`): `{ w, h }` of the frame in mm (landscape: w ≥ h), `coc`, `frames` per load. |
| `shutter` | A `SHUTTERS` entry (`shutters.js`): `speeds` `[{ t, label }]`, `bulb`, `time`, `kind` (`'leaf'` / `'focal-plane'`), `control` (`'lens-ring'` / `'body-dial'`). |
| `lenses`, `defaultLens` | The system's lens records and the id of the one fitted first. |
| `viewing(cam)` | Builds the camera's viewing mode (below). |
| `controls` | The page's camera controls this camera has: `'finder'`, `'look'`, `'loupe'`, `'stopDown'`, `'movements'`, `'holder'`, `'fold'`, `'explode'`. The page hides the rest (`'movements'`: a panel of strips for rise, shift, tilt, swing and the back's tilt, which the page makes only for a camera that has it; `'holder'`: the sheet-film routine's buttons and keys, below; `'fold'`: the Fold up / Set up button, Shift+E). |
| `screen` | *(optional)* `'plain'`: a view camera's bare ground glass (`lensview.js plainScreen`); otherwise the 503's screens. |
| `movements` | *(optional)* `true`: the lens view takes a view camera's movements (`lensview.js setMovements`), from the camera's `lensMovements()`. |
| `mechanism()` | Imports the hand-worked mechanism the Camera School drives (`mechanisms/<system>.js`). |
| `load()` | Imports the model's builder. |

## Lenses

A lens record is the app's (`data.js`: `id`, `focalLength`, `maxAperture`, `apertureStops`, `minFocusDistance`,
`fov`, …). When `cameras.js` is imported it annotates those shared records in place, for every module on the page,
with the fields the engine asks for, so nothing decides by focal length: `system`, `kind`, `projection`
(`'rectilinear'` / `'equisolid'`), `shade` (the bayonet shade it takes, or null), `shutter` (its leaf shutter's
`SHUTTERS` id, for leaf-shutter systems) and `use` (when to pick it, for the lens sheet). It also replaces `name` (the
app's maker's name) with the page's: focal length, speed and kind.

Everything per lens is keyed by `id`: the optics (`optics.js` `LENS_OPTICS`, `lensOpticsFor(lens)`) and the model's
geometry (`src/cameras/503cx/index.js` `LENS_DEFS`). Another system registers its optics with `registerLensOptics({ id: spec })`, or
its records carry `optics` themselves. Two lookups take more than an id:
- `lensFor(kind, key)` finds a lens of *that camera's* system by id, by its short key (`lensKey`: `"150"`, or `"50-1.4"`
  where the system has two of a focal length), or by a bare focal length: on the 503CX `lens=150` (old share links,
  the Studio's viewpoints, the School's assignments) is the CF 150; on another camera, its own lens of that length.
- `lensOpticsFor(number)` maps a bare focal length to the CF lens of that length (`CF_LENS_BY_FOCAL`), for the old
  callers that pass one. A lens record or id never falls back to another lens's optics.

## The model

### Placing it and reading it

| Member | |
|---|---|
| `root` | The `THREE.Group` holding tripod, head and camera (named for the camera: `'camera503'`). |
| `setAim(pan, tilt, roll = 0)` | Turns the head (radians). |
| `bodyCenter(v)`, `worldToBody(v)` | The body's centre in world space; a world point into the body's mm frame. |
| `ringAxisWorld(v)` | The lens axis in world space, pointing out of the front. |
| `lensPose(pos, quat)` | Where the lens view renders from (the entrance pupil) and its orientation. |
| `filmOffset()` | Metres from that pupil back to the film plane. |
| `lensMovements()` | *(a camera with `movements`)* In the film's frame (x right, y up, z back; mm): `D` the lens's distance in front of the film along its normal, `ox`, `oy` where it stands over the film's centre, `ax`, `ay`, `az` its axis toward the film, `eye` the viewer's distance behind the ground glass, `portrait` the back turned on end. Such a camera's `lensPose` gives the film's orientation (upright: the back's turn is `portrait`), not the lens's: the picture is the film's. |
| `turnBack(portrait)`, `turnCover()` | *(optional)* Turns the back (a promise; the page redraws the picture while it turns). While it turns, `turnCover()` is how much more of the lens's image than the frame the glass needs (its corners swing out past the frame): the page widens the lens view's field by it (`lensview.js magCrop` > 1) while the glass is in sight. |
| `setMovements(m)`, `st` | *(a camera with `movements`)* Sets `{ rise, shift, tilt, swing, rearTilt, backRot }` (mm, radians), clamped to the camera's travel; `st` holds the values as set. |
| `format`, `shutter`, `lenses` | *(cameras.js)* As in the description. |

### State

| Member | |
|---|---|
| `setState(s)` | *(cameras.js: the 503's `setRings`)* Shows the page's state on the camera: focus, aperture (`s.aperture`, or a fractional `s.apertureIdx`), speed, film, filter, the counter. Rings follow over a few frames unless `st.snapRings`. |
| `swapLens(lens, onSwap)` | Takes the lens off and puts `lens` on (animated if the camera is visible); `onSwap()` runs while it is off. |
| `setHood(on)`, `hoodOn`, `hasHood`, `setFilter(id, polAngle)` | The shade and the filter on the front of the lens. |
| `update(dt, view)` | Runs every frame: tweens, eased rings, hover glow, the cutaway's clip plane; `view` the page's eye (the Intrepid: whether it is under the dark cloth). `timeScale` slows it (the School's X-ray view). |

### Working it

| Member | |
|---|---|
| `pickables` | `{ focus, aperture, shutter, crank, release, finder, … }` → meshes; `mesh.userData.part` names the control. Arrays are refilled in place after a lens swap. |
| `setHover(part)` | A warm edge glow on one control (or none). |
| `ringAngle(part)`, `ringValueAt(part, angle)` | A ring's angle about `ringAxisWorld()`, and the value it shows at an angle: focus in metres (10000 = ∞), aperture and speed as fractional indices. |
| `fire({ seconds, side, onMirror, onExpose, onSound, cutaway })` | The whole firing cycle, wound on afterwards (`side`: the cutaway's side). |
| `setExploded(on)`, `setCutaway(on, side)`, `labelAt(obj)`, `updateLabels(cam, el, show)` | The exploded view with its labels, and the cutaway. |

### A view camera's film holder *(a camera with the `'holder'` control)*

The page runs the routine and keeps the sheets (main.js, "A view camera's film holders"); the camera shows it.

| Member | |
|---|---|
| `shutterHeld`, `holdOpen(open)` | The shutter held open by its press-focus lever (the glass lit), or closed — and cocked — for the film (a promise). While it is held open the page will not fire. |
| `holder.insert(side, shown)`, `holder.remove()` | The double holder in at the back with `side` (0, 1) toward the lens, `shown[i]`: slide i shows its EXPOSED face; out again. Promises. |
| `holder.pull()`, `holder.push(exposedOut)`, `holder.fresh()`, `holder.state` | The slide over the side facing the lens out, or back in (turned over first if `exposedOut` differs); a fresh holder; `{ in, side, out }`. |
| `fire(…)` | As above; a view camera cocks itself first if it is not cocked. |
| `pickables.pressFocus`, `pickables.slide` | The press-focus lever and the holder: a click works them. |

### Folding a field camera flat *(a camera with the `'fold'` control)*

The camera does each step of folding and setting up; the page takes off what is on it first (the loupe, the cloth,
the eye from under it), refuses while a holder is in, and while it is folded refuses everything but setting it up
(main.js, "Folding a field camera flat").

| Member | |
|---|---|
| `fold(on)` | Fold the camera flat, or set it up again, step by step as the maker's guide gives it (a promise). Its movements are zero afterwards. |
| `folded` | Folded, or being folded or set up. |

### Seeing through it: `viewing` *(cameras.js)*

One interface, an implementation per finder. The 503CX's is the waist-level finder: its screen shows the lens view's
ground-glass picture, and its 4.5× loupe magnifies the screen.

| Member | |
|---|---|
| `id`, `name` | `'waist-level'`, … |
| `image` | Which lens-view picture the finder shows: `'ground-glass'` (the lens view's `ggRT`; main.js hands it to `setImage`). |
| `open(on)` | Readies it to look through (the hood unfolds; a view camera's dark cloth goes on). `labels` *(optional)*: `{ open, close }` for its button. |
| `eyePose()` | `{ eye, target, up }`: where an eye goes to look through it. |
| `setImage(tex, shape)` | The picture where the finder shows it (the focusing screen). `shape` *(a camera with `movements`)*: what the picture holds, `lensview.js ggShown` — `{ portrait, crop, lum }`: its shape, the part of the lens's image it takes in, and the glass's real brightness (scene luminance per unit of the picture). The page passes it each time the glass is made, so the glass maps the picture it holds, through a turn. |
| `loupe` | `{ power, crop, set(up), up, setImage(tex, crop, shape) }`, or absent. `crop`: the part of the screen's width the loupe takes in (main.js renders the loupe's own lens view at that crop). A view camera's loupe also has `needsLook` (it stands on the glass: you look in first, and the eye goes to its eyepiece), `follows` (its picture handed over each time it is made), `centre()` (the crop's centre in the picture's uv: `lensview.js magCentre`), `at()`, `moveTo(x, y)`, `glassPoint(world)` and `drag(dx, dy, view, heightPx)`, and `label` for its button. |
| `stayLooking`, `follow`, `under(on)`, `glassSeen(view)` | *(optional; the Intrepid's)* `open(false)` leaves the eye where it is (the cloth comes off while you look); the page keeps the eye at `eyePose()` while the camera is aimed and the loupe moved; looking in goes under the cloth; and the glass is in sight from outside (no cloth, the eye behind it), so the page keeps it live. |

The M6's optical viewfinder (bright-line frames, the rangefinder patch) and the Intrepid's rear ground glass (seen
from behind, upside down and reversed, under a dark cloth, with a loupe) implement the same members (plan §4.5, §5.5).

### Camera-specific: reached explicitly

Anything else on the model belongs to that camera, and only code that knows the camera uses it. For the 503CX that is
the School's hand-worked V-system mechanism (`releaseCycle`, `preRelease`, `windTo`, `lensOff`, `setSlide`,
`setMagOff`, `setInsertOut`, `loadPhase`, `setRoll`, `setSignals`, `balk`, `st`, `parts`), the finder hood and loupe
behind `viewing` (`setFinderOpen`, `lookDownPose`, `setScreenTexture`, `setMagnifier`, `setLoupeTexture`), and
`opticsMoving`. The School runs it through `mechanisms/hasselblad-v.js`.

## The shared modelling library (`lib/`)

The 503CX's modelling vocabulary, moved out unchanged for the next cameras:

- `util.js`: angles, easing, seeded noise, `T`/`TS` matrices
- `textures.js`: leatherette, brushed metal, knurl, grips, carbon, waffle rubber; `flushCameraTextures`
- `materials.js`: base materials, edge wear, hover glow, the lens-glass trace; `MatLib`
- `mesh.js`: `prep`, `fastMerge`, `Kit`, `foldSiblings`
- `geometry.js`: `revolve`, `loft`, `slab`, `rbox`, `carve`, screws, decal UVs, section faces
- `engrave.js`: inks
- `decals.js`: the 503's decal sheet, including the head's panning scale
- `rig.js`: the tripod and the 3-way head
