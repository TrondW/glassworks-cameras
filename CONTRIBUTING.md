# Add a camera

Every camera here is built in code, from measurements. You don't need 3D software or a scan. You need a real camera to
look at, its manual, a ruler, and an AI coding agent. You can also write the code yourself.

Cameras that pass the checks below join this repository and can appear on
[glass-works.ai/cameras](https://glass-works.ai/cameras). Lenses for the cameras already here, and fixes to them, are
welcome too: the same steps apply, starting at step 4.

**Expect real work.** A camera takes an agent many rounds. Your part is choosing the exact model, photographing and
measuring it well, and telling the agent what looks wrong.

## What you need

- A camera you can hold, or a full set of square-on pictures of one exact version of it
- Its instruction manual (the maker's site, [cameramanuals.org](https://www.cameramanuals.org) or a paper copy)
- Calipers or a ruler, in millimeters
- [Node.js](https://nodejs.org) 20 or later, Google Chrome, Git, and Python 3 with Pillow (`python3 -m pip install pillow`)
- An AI coding agent that can read files, run commands and look at pictures, such as Claude Code, Codex, Cursor or
  Gemini CLI

## 1. Claim the camera

Open a [camera request](https://github.com/TrondW/glassworks-cameras/issues/new?template=camera-request.yml) with the
exact model, year and finish, and tick the box that says you'll build it. It stops two people building the same one.
Check the [open issues](https://github.com/TrondW/glassworks-cameras/issues) first.

Be exact. Versions of one camera differ in their dials, levers and trim, and a mix of two matches neither.

## 2. Photograph and measure it

Fork and clone the repository, then make a folder for your reference. `<kind>` is a short name for the camera, in
lower-case letters and numbers, such as `k1000`.

```bash
npm install
```

```bash
mkdir -p scratch/ref-<kind>
```

**`scratch/` is ignored by Git, so your photographs and the manual stay on your computer.** Never commit them.

Photograph it on a plain background, in even light, with the camera level and the lens pointing straight at the middle of
each side. Use a long lens from a distance, or the phone's 2× or longer, so the edges don't bend. Put a ruler in the
picture, in line with the surface you're measuring.

| Take | Show |
|---|---|
| Front | Body with the lens on, and the bare mount with it off |
| Back | Closed, with any charts, doors and the eyepiece |
| Left and right | Straight on |
| Top | Every dial, with the numbers readable |
| Bottom | Tripod socket, latch, feet |
| Inside | Back open, empty, and loaded with film if you can |
| Close up | Name badge, each dial and lever, the leather, knurling, the front and rear of each lens |
| Moving parts | A short video of winding, firing, opening the back and loading |

Write down the width, height and depth, the thickness of the body without the lens mount, and the diameter and position
of each control. A tenth of a millimeter is ideal.

Pictures from dealers or archives are fine to look at for views you can't take. They stay in `scratch/` too.

## 3. Start your agent

Open your agent in the repository folder and give it this, with your own details filled in:

```text
Build a new camera for this repository: <exact model, year, finish>. Use the kind id "<kind>".

Read AGENTS.md first, then skills/camera-builder/SKILL.md, docs/PLAYBOOK.md and docs/CONTRACT.md, and follow the
playbook's stages 0 to 7 in order. Do not skip a stage's gate.

My photographs, measurements and the manual are in scratch/ref-<kind>/. Look at every one of them. Never commit
anything from scratch/. Where my pictures and your memory of this camera disagree, trust the pictures. Where you
can't tell, ask me for another photograph or measurement instead of guessing.

Include these lenses: <list them>.

Stop after stage 1 and show me SPEC.md with every measurement and where it came from. Once I agree, build the
camera. After each stage, show me the rendered pictures next to my photographs and tell me what still differs.
```

Check `SPEC.md` against your camera before you let it go on. Every later stage is built from those numbers.

## 4. Look at it

```bash
npm run dev
```

Open <http://127.0.0.1:4173/viewer/> and compare it with the camera in your hand. Turn it, fire it, change lenses, open
the back, take it apart. Tell the agent what's wrong in plain words: "the rewind knob is too tall", "the wind lever
swings the wrong way". Add a photograph when words aren't enough.

## 5. Run the checks

```bash
npm run audit -- --camera <kind> --out .audit-out/<kind> --lineup --spec-dims <width>,<height>,<depth>
```

It has to end with `[MACHINE_PASS]`, no vetoes and no warnings. It also draws five sheets of pictures in
`.audit-out/<kind>/`. If anything in `src/lib/` changed, check the other cameras as well:

```bash
npm run audit:quick
```

Then start a **new** session with your agent, so that it hasn't seen the work, and give it this:

```text
Review the camera "<kind>" in this repository as an independent critic. Read skills/camera-critic/SKILL.md and
docs/CRITIC.md and follow them. Compare every sheet in .audit-out/<kind>/ with the photographs in
scratch/ref-<kind>/. Do not change any files. Report the score and every defect.
```

Take its list back to the first session, fix the defects, and repeat until it scores 96 or more out of 100 with nothing
serious left.

## 6. Send it

Commit only these, and open a pull request:

- `src/cameras/<kind>/` with `SPEC.md`, `index.js`, `lenses.js` and any helpers
- the lines that register it in `src/cameras.js`, `src/formats.js`, `src/shutters.js` and `viewer/review-dev.js`

Drag the five picture sheets into the pull request and fill in the form. The checks run again there. Then I look at it
against the references you list, and may ask for changes.

## Rules

- **Built in code only.** No model files (`.glb`, `.obj`, `.fbx`) and no photographs used as textures.
- **No one else's material.** No photographs, manuals, scans or logos in the repository, even your own photographs of
  them.
- **No makers' names on the camera.** Where the maker's name is engraved, it reads `GLASS WORKS` or `GW`. Model numbers,
  scales and markings stay true to the original. On glass-works.ai, cameras go by their number, such as M6 or K1000.
- **You must have the right to give it.** Your contribution is published under the [MIT licence](LICENSE), for anyone to
  use.
- **It's fine that an AI wrote it.** Say which one in the pull request. You are responsible for what you send.

## Where things are

| | |
|---|---|
| [`docs/PLAYBOOK.md`](docs/PLAYBOOK.md) | How a camera is built, stage by stage, and the 30 rules learned so far |
| [`docs/CONTRACT.md`](docs/CONTRACT.md) | What a camera's code has to provide |
| [`docs/CRITIC.md`](docs/CRITIC.md) | How a camera is judged |
| [`skills/camera-builder`](skills/camera-builder/SKILL.md), [`skills/camera-critic`](skills/camera-critic/SKILL.md) | The same, written for agents |
| [`src/cameras/m6`](src/cameras/m6) | A finished camera to look at |

Questions? Ask in your camera's issue.
