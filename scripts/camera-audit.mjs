#!/usr/bin/env node
// GlassWorks Automated Camera Audit Harness & Standardized Visual Evidence Pack Generator
// Enforces docs/PLAYBOOK.md, docs/CONTRACT.md, and docs/CRITIC.md Hard Veto Gates (V1–V7).
//
// Usage:
//   node scripts/camera-audit.mjs --camera rolleiflex [--out .audit-out/rolleiflex] [--lineup]
//   node scripts/camera-audit.mjs --camera ae1 --spec-dims 147,96,74 --overlay ./scratch/ref-ae1/front.jpg:front:671:470:7.67:false
//   node scripts/camera-audit.mjs --all [--quick] [--lineup]
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createStaticServer, REPO_ROOT } from './dev-server.mjs';
import { openPage, sleep } from './chrome.mjs';

// ───────── CLI Argument Parsing ─────────
const argv = process.argv.slice(2);
const opts = { camera: null, all: false, out: null, quick: false, lineup: false, specDims: null, overlays: [] };
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--camera' && argv[i + 1]) opts.camera = argv[++i];
  else if (a === '--all') opts.all = true;
  else if (a === '--out' && argv[i + 1]) opts.out = resolve(argv[++i]);
  else if (a === '--quick') opts.quick = true;
  else if (a === '--lineup') opts.lineup = true;
  else if (a === '--spec-dims' && argv[i + 1]) opts.specDims = argv[++i].split(',').map(Number);
  else if (a === '--overlay' && argv[i + 1]) opts.overlays.push(argv[++i]);
}
if (!opts.camera && !opts.all) {
  console.error('Usage: node scripts/camera-audit.mjs --camera <kind> [--out <dir>] [--quick] [--lineup] [--spec-dims W,H,D] [--overlay path:dir:ox:oy:s[:lens]]');
  console.error('   or: node scripts/camera-audit.mjs --all [--quick] [--lineup]');
  process.exit(1);
}

const AUDIT_BASE = join(REPO_ROOT, '.audit-out');

// ───────── Part A: Static Source Linter (Catches Knurling, Transmission & CAD Shortcuts) ─────────
function sourcePathFor(kind) {
  const p = join(REPO_ROOT, 'src', 'cameras', kind, 'index.js');
  return existsSync(p) ? p : null;
}

function extractBalanced(src, openIdx, openCh, closeCh) {
  let depth = 0, inStr = null, esc = false;
  for (let i = openIdx; i < src.length; i++) {
    const ch = src[i];
    if (inStr) {
      if (esc) { esc = false; continue; }
      if (ch === '\\') { esc = true; continue; }
      if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { inStr = ch; continue; }
    if (ch === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (ch === '/' && src[i + 1] === '*') { i += 2; while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++; i++; continue; }
    if (ch === openCh) depth++;
    else if (ch === closeCh && --depth === 0) return { text: src.slice(openIdx, i + 1), end: i };
  }
  return null;
}

function lineOf(src, idx) {
  let ln = 1;
  for (let i = 0; i < idx; i++) if (src[i] === '\n') ln++;
  return ln;
}

function lintCameraSource(kind) {
  const file = sourcePathFor(kind);
  const res = { file, vetoes: [], warnings: [], knurlChecks: 0 };
  if (!file) { res.warnings.push(`Source module not found for kind=${kind}`); return res; }
  const src = readFileSync(file, 'utf8');
  const label = `src/cameras/${kind}/${basename(file)}`;

  // 1. VETO V2: Literal non-zero transmission in material constructors
  const transRe = /Mesh(?:Physical|Standard)Material\s*\(\s*\{[^}]*\btransmission\s*:\s*([0-9.]+)/g;
  let m;
  while ((m = transRe.exec(src))) {
    if (parseFloat(m[1]) > 0) {
      res.vetoes.push(`V2(static): MeshPhysicalMaterial transmission=${m[1]} at ${label}:${lineOf(src, m.index)}`);
    }
  }

  // 2. VETO V5: revolve() & ring() knurling checks (dual-end rib=1 & segs >= 6*n)
  const revRe = /(?:\brevolve|\bring)\s*\(/g;
  while ((m = revRe.exec(src))) {
    const call = extractBalanced(src, m.index + m[0].length - 1, '(', ')');
    if (!call) continue;
    const body = call.text.slice(1, -1);
    if (!/\bribs\s*:/.test(body)) continue;
    res.knurlChecks++;
    const ln = lineOf(src, m.index);
    const segM = body.match(/\bsegs\s*:\s*(\d+)/);
    const nM = body.match(/\bribs\s*:\s*\{[^}]*\bn\s*:\s*(\d+)/);
    const segs = segM ? parseInt(segM[1], 10) : 96;
    const n = nM ? parseInt(nM[1], 10) : 0;
    if (n > 0 && segs < n * 6) {
      res.vetoes.push(`V5(knurl-alias): knurled revolve/ring ribs n=${n} with segs=${segs} (< 6*n=${n * 6} -> aliasing/moiré!) at ${label}:${ln}`);
    } else if (n > 0 && n <= 60 && segs < n * 8) {
      res.warnings.push(`knurl-res: knurled revolve/ring primary ribs n=${n} has segs=${segs} (recommended >= 8*n=${n * 8}) at ${label}:${ln}`);
    }
    const profStart = body.indexOf('[');
    if (profStart >= 0 && profStart < body.indexOf('{')) {
      const profBlock = extractBalanced(body, profStart, '[', ']');
      if (profBlock) {
        const inner = profBlock.text.slice(1, -1);
        let ribCount = 0;
        let idx = 0;
        while (idx < inner.length) {
          const s = inner.indexOf('[', idx);
          if (s < 0) break;
          const pt = extractBalanced(inner, s, '[', ']');
          if (!pt) break;
          idx = pt.end + 1;
          let d = 0, parts = [], cur = '';
          for (const ch of pt.text.slice(1, -1)) {
            if (ch === '(' || ch === '[') d++;
            else if (ch === ')' || ch === ']') d--;
            if (ch === ',' && d === 0) { parts.push(cur.trim()); cur = ''; } else cur += ch;
          }
          if (cur.trim()) parts.push(cur.trim());
          if (parts.length >= 4 && parts[3] !== '0') ribCount++;
        }
        if (ribCount === 1) {
          res.vetoes.push(`V5(knurl-taper): revolve() with ribs has rib=1 on ONLY 1 profile vertex (creates tapered sawtooth instead of parallel flutes!) at ${label}:${ln}`);
        }
      }
    }
  }

  // 3. Static check for thin uncapped 2-point revolve() discs/buttons/contacts (Law #23)
  const uncappedRe = /\brevolve\s*\(\s*\[\s*\[\s*([0-9.]+)\s*,\s*([0-9.-]+)(?:\s*,[^\]]*)?\]\s*,\s*\[\s*([0-9.]+)\s*,\s*([0-9.-]+)(?:\s*,[^\]]*)?\]\s*\]/g;
  while ((m = uncappedRe.exec(src))) {
    const r0 = parseFloat(m[1]), z0 = parseFloat(m[2]), r1 = parseFloat(m[3]), z1 = parseFloat(m[4]);
    if (r0 > 0.8 && Math.abs(r0 - r1) < 0.01 && Math.abs(z1 - z0) <= 1.2) {
      res.warnings.push(`cap-check: 2-point thin revolve([[${r0},${z0}],[${r1},${z1}]]) has no [0,${z1}] end-cap (Law #23 — vanishes head-on!) at ${label}:${lineOf(src, m.index)}`);
    }
  }

  // 4. Static Law #25 plastic-chrome check
  const chromeRe = /P\(\s*\{[^}]*name\s*:\s*['"`]([^'"`]*chrome[^'"`]*)['"`][^}]*\}\s*\)/gi;
  while ((m = chromeRe.exec(src))) {
    if (/black/i.test(m[1])) continue;
    const blk = m[0];
    const metM = blk.match(/\bmetalness\s*:\s*([0-9.]+)/);
    const ccM = blk.match(/\bclearcoat\s*:\s*([0-9.]+)/);
    const met = metM ? parseFloat(metM[1]) : 1.0;
    const cc = ccM ? parseFloat(ccM[1]) : 0.0;
    if (met < 0.85 && cc > 0.25) {
      res.warnings.push(`V6(plastic-chrome): silver chrome '${m[1]}' has metalness=${met} + clearcoat=${cc} (Law #25 bare-metal chrome trap!) at ${label}:${lineOf(src, m.index)}`);
    }
  }

  // 5. Warnings for known pitfalls
  if (/badgeTex[\s\S]{0,400}strokeText\s*\(/i.test(src)) {
    res.warnings.push(`V6(check): badge texture uses strokeText() — verify iconic model logotypes are vector-traced, not system fonts.`);
  }
  if (/\.scale\(\s*-1\s*,\s*1\s*,\s*1\s*\)/.test(src)) {
    res.warnings.push(`scale-mirror: .scale(-1, 1, 1) detected — verify no numbered scale/ruler texture is horizontally mirrored.`);
  }
  return res;
}

// ───────── Local Static HTTP Server ─────────
const server = createStaticServer();
await new Promise((r) => server.listen({ port: 0, host: '127.0.0.1', backlog: 1024 }, r));
const port = server.address().port;

const saveB64 = (dir, name, dataUrl) => writeFileSync(join(dir, name), Buffer.from(dataUrl.split(',')[1], 'base64'));

// ───────── Headless Chrome Session ─────────
const page = await openPage(`http://127.0.0.1:${port}/viewer/review.html?camera=503cx`, { width: 1280, height: 960, dsf: 1, timeout: 300, cache: true });

async function loadCamera(kind) {
  page.errors.length = 0;
  const url = `http://127.0.0.1:${port}/viewer/review.html?camera=${encodeURIComponent(kind)}`;
  await page.send('Page.navigate', { url });
  for (let i = 0; i < 240; i++) {
    if (page.errors.length) break;
    const ok = await page.evaluate(`Boolean(window.__dev && window.__dev.ready && window.__dev.kind === ${JSON.stringify(kind)})`);
    if (ok) break;
    await sleep(100);
  }
  await sleep(250);
}

let targetKinds = [opts.camera];
if (opts.all) {
  await loadCamera('503cx');
  targetKinds = await page.evaluate(`(async () => { const { CAMERAS } = await import('/src/cameras.js'); return Object.keys(CAMERAS); })()`);
}

const allReports = [];
let globalExit = 0;

for (const kind of targetKinds) {
  const outDir = opts.out && !opts.all ? opts.out : join(opts.out || AUDIT_BASE, kind);
  mkdirSync(outDir, { recursive: true });
  const staticLint = lintCameraSource(kind);
  await loadCamera(kind);

  const report = {
    camera: kind,
    timestamp: new Date().toISOString(),
    staticLint,
    runtime: null,
    vetoes: [...staticLint.vetoes],
    warnings: [...staticLint.warnings],
    artifacts: [],
  };

  if (page.errors.length) {
    report.vetoes.push(`V1(boot): ${page.errors.join(' | ')}`);
    report.verdict = 'MACHINE_VETO';
    writeFileSync(join(outDir, 'audit_report.json'), JSON.stringify(report, null, 2));
    allReports.push(report);
    globalExit = 2;
    continue;
  }

  // ───────── Part B: Live WebGL Runtime, Contract, Optics, Shader & Interior Material Audit ─────────
  const rt = await page.evaluate(`(async () => {
    const { cam, THREE, bb } = window.__dev;
    const { CAMERAS } = await import('/src/cameras.js');
    const optics = await import('/src/optics.js');
    const desc = CAMERAS[${JSON.stringify(kind)}];

    // 1. CONTRACT.md API surface check
    const reqMethods = ['setAim', 'bodyCenter', 'worldToBody', 'ringAxisWorld', 'lensPose', 'filmOffset', 'setState', 'swapLens', 'fire', 'setCutaway', 'setExploded', 'update'];
    const missingApi = reqMethods.filter((m) => typeof cam[m] !== 'function');
    if (!cam.root || !cam.pickables) missingApi.push('root/pickables');

    // 2. Scene graph traversal: mesh/tri budget, transmission > 0, local-origin LENS_GLASS_GLSL, interior flat-black reflectance, Law #24 layer-1 isolation
    let meshes = 0, triangles = 0;
    const mats = new Set(), transViol = [], offAxisGlass = [], greyInterior = [], wrongLayer = [];
    const checkLayers = (rootObj, label) => rootObj.traverse((o) => {
      if (!o.isMesh) return;
      if (o.layers.mask !== 2) wrongLayer.push({ where: label, name: o.name || o.material?.name || 'unnamed', mask: o.layers.mask });
    });
    checkLayers(cam.parts.mm, 'mm');
    checkLayers(cam.root, 'root');
    cam.parts.mm.traverse((o) => {
      if (!o.isMesh) return;
      meshes++;
      const g = o.geometry;
      if (g) triangles += g.index ? g.index.count / 3 : (g.attributes.position?.count || 0) / 3;
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      ms.forEach((m) => {
        if (!m) return;
        mats.add(m);
        if (m.transmission > 0) transViol.push(m.name || o.name || 'unnamed');
        const isGlass = Boolean(m.userData?.lensGlass || (m.name && /lensGlass/i.test(m.name)));
        if (isGlass && g) {
          g.computeBoundingBox();
          const c = g.boundingBox.getCenter(new THREE.Vector3());
          if (Math.hypot(c.x, c.y) > 2.5) offAxisGlass.push({ name: o.name || m.name, centerXY: [+c.x.toFixed(2), +c.y.toFixed(2)] });
        }
        if (m.name && /(interior|palpas|baffle)/i.test(m.name)) {
          const lum = m.map ? 0 : Math.max(m.color?.r ?? 0, m.color?.g ?? 0, m.color?.b ?? 0);
          const spec = m.specularIntensity ?? 1.0;
          const env = m.envMapIntensity ?? 1.0;
          if ((m.roughness ?? 0) < 0.85 || lum > 0.09 || spec > 0.05 || env > 0.15) {
            greyInterior.push({ name: m.name, roughness: m.roughness, maxChannel: +lum.toFixed(3), specularIntensity: spec, envMapIntensity: env });
          }
        }
      });
    });

    // 2b. Law #24 setAim() tripod rig non-merging check
    const q0 = new THREE.Quaternion(), q1 = new THREE.Quaternion(), pTmp = new THREE.Vector3();
    cam.setAim(0, 0, 0);
    cam.lensPose(pTmp, q0);
    const aimMesh = cam.pickables?.aim?.[0] || null;
    const rollMesh = cam.pickables?.roll?.[0] || null;
    const aq0 = aimMesh ? aimMesh.getWorldQuaternion(new THREE.Quaternion()) : null;
    const rq0 = rollMesh ? rollMesh.getWorldQuaternion(new THREE.Quaternion()) : null;
    cam.setAim(Math.PI / 2, 0.2, 0.12);
    cam.lensPose(pTmp, q1);
    const aq1 = aimMesh ? aimMesh.getWorldQuaternion(new THREE.Quaternion()) : null;
    const rq1 = rollMesh ? rollMesh.getWorldQuaternion(new THREE.Quaternion()) : null;
    const aimDelta = +q0.angleTo(q1).toFixed(4);
    const headAimDelta = aq0 && aq1 ? +aq0.angleTo(aq1).toFixed(4) : null;
    const headRollDelta = rq0 && rq1 ? +rq0.angleTo(rq1).toFixed(4) : null;
    cam.setAim(0, 0, 0);

    // 3. ringAxisWorld() orientation invariant
    cam.parts.mm.rotation.set(0, 0, 0);
    cam.parts.mm.updateMatrixWorld(true);
    const axis0 = cam.ringAxisWorld().toArray().map((x) => +x.toFixed(4));
    cam.parts.mm.rotation.set(0, Math.PI / 2, 0);
    cam.parts.mm.updateMatrixWorld(true);
    const axis90 = cam.ringAxisWorld().toArray().map((x) => +x.toFixed(4));
    cam.parts.mm.rotation.set(0, 0, 0);
    cam.parts.mm.updateMatrixWorld(true);

    // 4. Exact Optical Math audit across EVERY registered lens in this system
    const lensAudit = desc.lenses.map((l) => {
      const sp = optics.lensOpticsFor(l);
      const f = sp.focalCalMm;
      const s = l.minFocusDistance * 1000;
      const valid4f = s > 4 * f;
      const exact = valid4f ? (s - Math.sqrt(s * s - 4 * f * s)) / 2 - f : NaN;
      const extErrMm = Number.isFinite(exact) ? +Math.abs(sp.maxExtMm - exact).toFixed(5) : null;
      const isUnitFocus = l.projection !== 'equisolid' && !sp.internalFocus && ${JSON.stringify(kind)} !== '503cx';
      return { id: l.id, focalCalMm: f, minFocusM: l.minFocusDistance, maxExtMm: sp.maxExtMm, extErrMm, valid4f, fallbackUsed: Boolean(sp.fallbackUsed), isUnitFocus };
    });

    // 5. Closed Box3 envelope in mm
    cam.parts.mm.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(cam.parts.mm);
    const size = box.getSize(new THREE.Vector3()).toArray().map((v) => +v.toFixed(2));
    const center = box.getCenter(new THREE.Vector3()).toArray().map((v) => +v.toFixed(2));
    const minPt = box.min.toArray().map((v) => +v.toFixed(2));
    const maxPt = box.max.toArray().map((v) => +v.toFixed(2));

    // 6. Pickables & labelAt() coverage + mechanical state exercise
    const pickKeys = Object.keys(cam.pickables || {}).filter((k) => (cam.pickables[k] || []).length > 0);
    let labelHits = 0;
    if (typeof cam.labelAt === 'function') {
      const seen = new Set();
      cam.parts.mm.traverse((o) => {
        if (!o.isMesh) return;
        const r = cam.labelAt(o);
        if (r !== null && r !== undefined && r !== false && r !== -1) seen.add(typeof r === 'object' ? r.text : r);
      });
      labelHits = seen.size;
    }

    const restLeafK = cam.st && typeof cam.st.leafK === 'number' ? cam.st.leafK : null;
    cam.setCutaway(true); cam.update(0.016);
    checkLayers(cam.parts.mm, 'mm-cutaway');
    cam.setCutaway(false); cam.update(0.016);
    if (cam.st && 'explodeK' in cam.st) {
      cam.st.explodeK = 1; cam.update(0.016);
      checkLayers(cam.parts.mm, 'mm-explode');
      cam.st.explodeK = 0; cam.update(0.016);
    }

    // 7. Law #27 Per-Lens Collection Runtime Audit
    const lensCollectionAudit = [];
    const narrowFrontRings = [];
    const missingRearMounts = [];
    let midCutawaySwapSyncOk = true;
    const isInterchangeable = Boolean(cam.parts.lens?.group);
    const defLens = desc.lenses.find((x) => x.id === desc.defaultLens) || desc.lenses[0];
    const measureFrontRing = (rootObj) => {
      let minWidth = null;
      rootObj.traverse((o) => {
        if (!o.isMesh || !o.geometry) return;
        const m = Array.isArray(o.material) ? o.material[0] : o.material;
        if (!m?.name || !/(Front_|front_|lfNameRing_)/i.test(m.name)) return;
        const pos = o.geometry.attributes.position;
        if (!pos) return;
        let rMin = Infinity, rMax = 0;
        for (let i = 0; i < pos.count; i++) {
          const r = Math.hypot(pos.getX(i), pos.getY(i));
          if (r < rMin) rMin = r;
          if (r > rMax) rMax = r;
        }
        const w = +(rMax - rMin).toFixed(2);
        if (minWidth === null || w < minWidth) minWidth = w;
      });
      return minWidth;
    };
    if (desc.lenses.length > 1 && typeof cam.swapLens === 'function') {
      for (const l of desc.lenses) {
        cam.root.visible = false;
        await cam.swapLens(l, () => {});
        cam.root.visible = true;
        if (cam.setHood) cam.setHood(true);
        cam.setCutaway(true);
        if (cam.st && 'explodeK' in cam.st) cam.st.explodeK = 1;
        cam.update(0.016);
        checkLayers(cam.parts.mm, 'lens-' + l.id);
        const lRoot = cam.parts.lens?.group || cam.parts.lensMount || cam.parts.mm;
        const frontRingMm = measureFrontRing(lRoot);
        if (frontRingMm !== null && frontRingMm < 2.2) {
          narrowFrontRings.push({ id: l.id, frontRingMm });
        }
        let lMeshes = 0;
        lRoot.traverse((o) => {
          if (!o.isMesh) return;
          lMeshes++;
          const ms = Array.isArray(o.material) ? o.material : [o.material];
          ms.forEach((m) => {
            if (!m) return;
            if (m.transmission > 0 && !transViol.includes(m.name || o.name || l.id)) transViol.push(m.name || o.name || l.id);
            const isGlass = Boolean(m.userData?.lensGlass || (m.name && /lensGlass/i.test(m.name)));
            if (isGlass && o.geometry) {
              o.geometry.computeBoundingBox();
              const c = o.geometry.boundingBox.getCenter(new THREE.Vector3());
              if (Math.hypot(c.x, c.y) > 2.5) offAxisGlass.push({ name: l.id + ':' + (o.name || m.name), centerXY: [+c.x.toFixed(2), +c.y.toFixed(2)] });
            }
            if (m.name && /(interior|palpas|baffle)/i.test(m.name)) {
              const lum = m.map ? 0 : Math.max(m.color?.r ?? 0, m.color?.g ?? 0, m.color?.b ?? 0);
              const spec = m.specularIntensity ?? 1.0;
              const env = m.envMapIntensity ?? 1.0;
              if ((m.roughness ?? 0) < 0.85 || lum > 0.09 || spec > 0.05 || env > 0.15) {
                if (!greyInterior.some((g) => g.name === m.name)) {
                  greyInterior.push({ name: m.name, roughness: m.roughness, maxChannel: +lum.toFixed(3), specularIntensity: spec, envMapIntensity: env });
                }
              }
            }
          });
        });
        const hasRear = Boolean((cam.parts.lens?.rearMount && cam.parts.lens.rearMount.children.length > 0) || cam.parts.lens?.def?.rear);
        if (isInterchangeable && !hasRear) missingRearMounts.push(l.id);
        const builtInHood = Boolean(cam.parts.lens?.def?.builtInHood);
        const lensLenMm = cam.parts.lens?.L ?? null;
        lensCollectionAudit.push({ id: l.id, name: l.name, L: lensLenMm, meshes: lMeshes, frontRingMm, hasRear, builtInHood });
        if (cam.setHood) cam.setHood(false);
        cam.setCutaway(false);
        if (cam.st && 'explodeK' in cam.st) cam.st.explodeK = 0;
        cam.update(0.016);
      }
      // Law #29 Mid-Cutaway Lens-Swap Sync Check
      if (isInterchangeable && cam.parts.lens?.inner) {
        const altLens = desc.lenses.find((x) => x.id !== defLens.id) || desc.lenses[0];
        cam.setCutaway(true);
        cam.update(0.016);
        cam.root.visible = false;
        await cam.swapLens(altLens, () => {});
        cam.root.visible = true;
        cam.update(0.016);
        const inn = cam.parts.lens?.inner;
        if (inn && (!inn.visible || inn.children.length === 0)) midCutawaySwapSyncOk = false;
        cam.setCutaway(false);
        cam.update(0.016);
      }
      cam.root.visible = false;
      await cam.swapLens(defLens, () => {});
      cam.root.visible = true;
      if (cam.st) cam.st.snapRings = true;
      cam.setState(window.__dev.STATE);
      cam.update(0.016);
    }

    // 7b. Open-gate optical see-through raycast check for focal-plane cameras
    const openGateHits = [];
    if (desc.shutter?.kind === 'focal-plane' && cam.st && 'doorK' in cam.st && 'curtain1' in cam.st) {
      const saved = {
        lensVis: cam.parts.lensMount ? cam.parts.lensMount.visible : true,
        mirrorK: cam.st.mirrorK, curtain1: cam.st.curtain1, curtain2: cam.st.curtain2,
        doorK: cam.st.doorK, filmLoaded: cam.st.filmLoaded,
      };
      if (cam.parts.lensMount) cam.parts.lensMount.visible = false;
      if ('mirrorK' in cam.st) cam.st.mirrorK = 1;
      cam.st.curtain1 = 1; cam.st.curtain2 = 0; cam.st.doorK = 1;
      if ('filmLoaded' in cam.st) cam.st.filmLoaded = false;
      cam.update(0.016);
      cam.parts.mm.updateMatrixWorld(true);
      const bodyMeshes = [];
      cam.parts.mm.traverse((o) => {
        if (!o.isMesh || !o.visible) return;
        let cur = o;
        while (cur && cur !== cam.parts.mm) { if (!cur.visible) return; cur = cur.parent; }
        bodyMeshes.push(o);
      });
      const rc = new THREE.Raycaster(); rc.layers.enableAll();
      const mmQ = cam.parts.mm.getWorldQuaternion(new THREE.Quaternion());
      const mmScale = cam.parts.mm.getWorldScale(new THREE.Vector3()).z || 1;
      for (const [ox, oy] of [[0, 0], [-10, -6], [10, 6]]) {
        for (const [z0, dz, dirLbl] of [[-60, 1, 'front->back'], [25, -1, 'back->front']]) {
          const origW = cam.parts.mm.localToWorld(new THREE.Vector3(ox, oy, z0));
          const dirW = new THREE.Vector3(0, 0, dz).applyQuaternion(mmQ).normalize();
          rc.set(origW, dirW);
          const hits = rc.intersectObjects(bodyMeshes, false).filter((h) => h.distance < 85 * mmScale && h.object.material?.opacity !== 0);
          if (hits.length > 0) {
            const h = hits[0];
            const lp = cam.parts.mm.worldToLocal(h.point.clone());
            openGateHits.push({ ray: dirLbl + '@(' + ox + ',' + oy + ')', mat: h.object.material?.name || h.object.name || 'unnamed', z: +lp.z.toFixed(2) });
          }
        }
      }
      if (cam.parts.lensMount) cam.parts.lensMount.visible = saved.lensVis;
      if ('mirrorK' in cam.st) cam.st.mirrorK = saved.mirrorK;
      cam.st.curtain1 = saved.curtain1; cam.st.curtain2 = saved.curtain2; cam.st.doorK = saved.doorK;
      if ('filmLoaded' in cam.st) cam.st.filmLoaded = saved.filmLoaded;
      cam.update(0.016);
    }

    const capabilities = {
      finder: Boolean(cam.st && 'finderK' in cam.st),
      door: Boolean(cam.st && 'doorK' in cam.st),
      filmLoaded: typeof cam.setFilmLoaded === 'function',
      batteryDoor: Boolean(cam.st && 'batDoorK' in cam.st),
      movements: typeof cam.setMovements === 'function',
      explode: Boolean(cam.st && 'explodeK' in cam.st),
    };

    return {
      missingApi, meshes, triangles: Math.round(triangles), uniqueMaterials: mats.size,
      transViol, offAxisGlass, greyInterior, wrongLayerCount: wrongLayer.length, wrongLayerSample: wrongLayer.slice(0, 6),
      aimDelta, headAimDelta, headRollDelta, axis0, axis90, openGateHits,
      lensAudit, lensCollectionAudit, narrowFrontRings, missingRearMounts, midCutawaySwapSyncOk, envelopeMm: { size, center, min: minPt, max: maxPt },
      pickKeys, labelHits, restLeafK, capabilities,
      shutterKind: desc.shutter?.kind || null,
      viewingId: desc.viewing ? desc.viewing(cam).id : null,
      flangeZ: cam.parts.lensMount ? cam.parts.lensMount.position.z : -45,
      defaultLensId: defLens?.id || null,
    };
  })()`);

  report.runtime = rt;
  report.runtimeErrors = [...page.errors];

  // Evaluate Hard Veto Gates V1..V7
  if (page.errors.length > 0) report.vetoes.push(`V1(runtime): ${page.errors.length} console/page errors: ${page.errors.join(' | ')}`);
  if (rt.missingApi.length > 0) report.vetoes.push(`V1(contract): missing CONTRACT.md members: ${rt.missingApi.join(', ')}`);
  if (rt.wrongLayerCount > 0) report.vetoes.push(`V1(layer1): ${rt.wrongLayerCount} meshes not isolated on layer 1 (mask!==2, Law #24): ${JSON.stringify(rt.wrongLayerSample)}`);
  if (rt.aimDelta < 0.8 || (rt.headAimDelta !== null && rt.headAimDelta < 0.8) || (rt.headRollDelta !== null && rt.headRollDelta < 0.8)) {
    report.vetoes.push(`V1(setAim): tripod head/rollG failed to rotate under setAim() (aimDelta=${rt.aimDelta}, headAimDelta=${rt.headAimDelta}, headRollDelta=${rt.headRollDelta})`);
  }
  if (rt.transViol.length > 0) report.vetoes.push(`V2(transmission): ${rt.transViol.length} transmissive materials: ${rt.transViol.join(', ')}`);
  if (rt.offAxisGlass.length > 0) report.vetoes.push(`V5(glass-origin): off-axis LENS_GLASS_GLSL vertices baked: ${JSON.stringify(rt.offAxisGlass)}`);
  if (rt.openGateHits && rt.openGateHits.length > 0) report.vetoes.push(`V5(gate-clear): opaque geometry blocks open optical path (lens off, mirror up, curtains open, door open): ${JSON.stringify(rt.openGateHits.slice(0, 4))}`);
  if (rt.midCutawaySwapSyncOk === false) report.vetoes.push(`V5(swap-sync): swapping lenses mid-cutaway failed to populate/show L.inner (sync L.ensureInner() & L.inner.visible in applyPose()! Law #29)`);
  if (rt.greyInterior.length > 0) report.vetoes.push(`V6(interior-black): reflective/greyish interior material: ${JSON.stringify(rt.greyInterior)}`);
  if (rt.narrowFrontRings && rt.narrowFrontRings.length > 0) {
    report.vetoes.push(`V7(front-ring): squished front lens nameplate ring < 2.2 mm (Law #27): ${JSON.stringify(rt.narrowFrontRings)}`);
  }
  if (rt.missingRearMounts && rt.missingRearMounts.length > 0) {
    report.vetoes.push(`V7(rear-mount): interchangeable lenses missing 3D rear bayonet / rear cell (Law #27): ${rt.missingRearMounts.join(', ')}`);
  }

  const axis0Err = Math.hypot(rt.axis0[0], rt.axis0[1], rt.axis0[2] + 1);
  const axis90Err = Math.hypot(rt.axis90[0] + 1, rt.axis90[1], rt.axis90[2]);
  if (axis0Err > 0.02 || axis90Err > 0.02) {
    report.vetoes.push(`V5(axis): ringAxisWorld mismatch neutral=${JSON.stringify(rt.axis0)} pan90=${JSON.stringify(rt.axis90)}`);
  }

  for (const l of rt.lensAudit) {
    if (l.fallbackUsed) report.vetoes.push(`V3(fallback): lens ${l.id} fell back to default optics!`);
    if (!l.valid4f) report.vetoes.push(`V3(4f): lens ${l.id} violates s_min > 4*f_cal!`);
    if (l.isUnitFocus && l.extErrMm !== null && l.extErrMm > 0.0005) {
      report.vetoes.push(`V3(thin-lens): lens ${l.id} extErrMm=${l.extErrMm} > 0.0005 mm`);
    }
  }
  if (kind === 'rolleiflex' && rt.restLeafK !== 0) {
    report.vetoes.push(`V5(tlr-shutter): TLR taking leaf shutter must be closed at rest (restLeafK=${rt.restLeafK})`);
  }
  if (opts.specDims && opts.specDims.length === 3 && !opts.all) {
    const diffs = rt.envelopeMm.size.map((v, i) => +(v - opts.specDims[i]).toFixed(2));
    const maxDiff = Math.max(...diffs.map(Math.abs));
    report.specDimDiffMm = diffs;
    if (maxDiff > 6.0) report.vetoes.push(`V7(envelope): Box3 ${JSON.stringify(rt.envelopeMm.size)} differs from --spec-dims ${JSON.stringify(opts.specDims)} by ${JSON.stringify(diffs)} mm`);
    else if (maxDiff > 2.5) report.warnings.push(`envelope: Box3 differs from --spec-dims by ${JSON.stringify(diffs)} mm`);
  }

  // ───────── Part C: Auto-Framed Standardized Visual Evidence Pack ─────────
  if (!opts.quick) {
    const [W, H, D] = rt.envelopeMm.size;
    const [cx, cy, cz] = rt.envelopeMm.center;
    const span = Math.max(W, H, D);
    const tileW = 640, tileH = 640;
    const orthoS = +(Math.min(tileW, tileH) * 0.78 / span).toFixed(3);
    const dist = Math.round(span * 3.15);
    const macroDist = Math.round(span * 1.95);

    await page.evaluate(`{ const c=window.__dev.cam; if(c.st){ if('finderK' in c.st) c.st.finderK=0; if('doorK' in c.st) c.st.doorK=0; if('batDoorK' in c.st) c.st.batDoorK=0; if('explodeK' in c.st) c.st.explodeK=0; } c.setCutaway(false); c.update(0.016); }`);

    const oFront = await page.evaluate(`window.__dev.ortho({ dir:'front', W:${tileW}, H:${tileH}, ox:${tileW / 2 + cx * orthoS}, oy:${tileH / 2 + cy * orthoS}, s:${orthoS}, lens:true, bg:0xf6f6f7 })`);
    const oBack  = await page.evaluate(`window.__dev.ortho({ dir:'back',  W:${tileW}, H:${tileH}, ox:${tileW / 2 - cx * orthoS}, oy:${tileH / 2 + cy * orthoS}, s:${orthoS}, lens:true, bg:0xf6f6f7 })`);
    const oLeft  = await page.evaluate(`window.__dev.ortho({ dir:'left',  W:${tileW}, H:${tileH}, ox:${tileW / 2 - cz * orthoS}, oy:${tileH / 2 + cy * orthoS}, s:${orthoS}, zAt:0, lens:true, bg:0xf6f6f7 })`);
    const oRight = await page.evaluate(`window.__dev.ortho({ dir:'right', W:${tileW}, H:${tileH}, ox:${tileW / 2 + cz * orthoS}, oy:${tileH / 2 + cy * orthoS}, s:${orthoS}, zAt:0, lens:true, bg:0xf6f6f7 })`);
    const oTop   = await page.evaluate(`window.__dev.ortho({ dir:'top',   W:${tileW}, H:${tileH}, ox:${tileW / 2 - cx * orthoS}, oy:${tileH / 2 - cz * orthoS}, s:${orthoS}, zAt:0, lens:true, bg:0xf6f6f7 })`);
    const oBot   = await page.evaluate(`window.__dev.ortho({ dir:'bottom',W:${tileW}, H:${tileH}, ox:${tileW / 2 + cx * orthoS}, oy:${tileH / 2 - cz * orthoS}, s:${orthoS}, zAt:0, lens:true, bg:0xf6f6f7 })`);
    saveB64(outDir, '_o_front.png', oFront); saveB64(outDir, '_o_left.png', oLeft);
    saveB64(outDir, '_o_right.png', oRight); saveB64(outDir, '_o_back.png', oBack);
    saveB64(outDir, '_o_top.png', oTop);     saveB64(outDir, '_o_bot.png', oBot);

    const tStr = JSON.stringify([cx, cy, cz]);
    saveB64(outDir, '_m_1.png', await page.evaluate(`window.__dev.shot({ az:-14, el:8,   dist:${macroDist}, target:[${cx},${cy + H * 0.08},${cz - D * 0.28}], W:720, H:600, fov:21, bg:0xf2f3f5, floorOn:false })`));
    saveB64(outDir, '_m_2.png', await page.evaluate(`window.__dev.shot({ az:72,  el:12,  dist:${macroDist}, target:[${cx - W * 0.25},${cy},${cz}], W:720, H:600, fov:21, bg:0xf2f3f5, floorOn:false })`));
    saveB64(outDir, '_m_3.png', await page.evaluate(`window.__dev.shot({ az:-72, el:12,  dist:${macroDist}, target:[${cx + W * 0.25},${cy},${cz}], W:720, H:600, fov:21, bg:0xf2f3f5, floorOn:false })`));
    saveB64(outDir, '_m_4.png', await page.evaluate(`window.__dev.shot({ az:158, el:12,  dist:${macroDist}, target:[${cx},${cy},${cz + D * 0.22}], W:720, H:600, fov:21, bg:0xf2f3f5, floorOn:false })`));
    saveB64(outDir, '_m_5.png', await page.evaluate(`window.__dev.shot({ az:-18, el:68,  dist:${macroDist}, target:[${cx},${cy + H * 0.28},${cz}], W:720, H:600, fov:21, bg:0xf2f3f5, floorOn:false })`));
    saveB64(outDir, '_m_6.png', await page.evaluate(`window.__dev.shot({ az:36,  el:-44, dist:${macroDist}, target:[${cx},${cy - H * 0.25},${cz}], W:720, H:600, fov:21, bg:0xf2f3f5, floorOn:false })`));

    saveB64(outDir, '_s_1.png', await page.evaluate(`window.__dev.shot({ az:32,  el:14, dist:${dist}, target:${tStr}, W:720, H:600, fov:21, bg:0x9498a0, floorOn:true })`));
    await page.evaluate(`{ const c=window.__dev.cam; if(c.st && 'finderK' in c.st) c.st.finderK=1; c.update(0.016); }`);
    saveB64(outDir, '_s_2.png', await page.evaluate(`window.__dev.shot({ az:-36, el:14, dist:${Math.round(dist * 1.08)}, target:[${cx},${cy + (rt.capabilities.finder ? H * 0.12 : 0)},${cz}], W:720, H:600, fov:21, bg:0x9498a0, floorOn:true })`));
    await page.evaluate(`{ const c=window.__dev.cam; if(c.st && 'finderK' in c.st) c.st.finderK=0; c.update(0.016); }`);
    await page.evaluate(`{ const c=window.__dev.cam; if(c.st && 'doorK' in c.st) c.st.doorK=1; if(c.setFilmLoaded) c.setFilmLoaded(false); c.update(0.016); }`);
    saveB64(outDir, '_s_3.png', await page.evaluate(`window.__dev.shot({ az:145, el:16, dist:${dist}, target:${tStr}, W:720, H:600, fov:22, bg:0xf2f3f5, floorOn:false })`));
    await page.evaluate(`{ const c=window.__dev.cam; if(c.setFilmLoaded) c.setFilmLoaded(true); if(c.st && 'batDoorK' in c.st) c.st.batDoorK=1; c.update(0.016); }`);
    saveB64(outDir, '_s_4.png', await page.evaluate(`window.__dev.shot({ az:${rt.capabilities.door ? 152 : -148}, el:14, dist:${dist}, target:${tStr}, W:720, H:600, fov:22, bg:0xf2f3f5, floorOn:false })`));
    await page.evaluate(`{ const c=window.__dev.cam; if(c.st){ if('doorK' in c.st) c.st.doorK=0; if('batDoorK' in c.st) c.st.batDoorK=0; if('finderK' in c.st) c.st.finderK=1; } c.setCutaway(true); c.update(0.016); }`);
    saveB64(outDir, '_s_5.png', await page.evaluate(`window.__dev.shot({ az:-90, el:4, dist:${Math.round(dist * 0.96)}, target:${tStr}, W:720, H:600, fov:20, bg:0xf4f4f6, floorOn:false })`));
    await page.evaluate(`{ const c=window.__dev.cam; c.setCutaway(false); if(c.st){ if('finderK' in c.st) c.st.finderK=0; if('explodeK' in c.st) c.st.explodeK=1; } c.update(0.016); }`);
    saveB64(outDir, '_s_6.png', await page.evaluate(`window.__dev.shot({ az:34, el:16, dist:${Math.round(dist * 1.45)}, target:${tStr}, W:720, H:600, fov:22, bg:0x9498a0, floorOn:false })`));
    await page.evaluate(`{ const c=window.__dev.cam; if(c.st && 'explodeK' in c.st) c.st.explodeK=0; c.update(0.016); }`);

    // 3b. Law #27 Lens Collection Contact Sheet
    const lensGridFiles = [];
    const lensGridLabels = [];
    if (rt.lensCollectionAudit && rt.lensCollectionAudit.length > 1) {
      const isViewCam = Boolean(rt.capabilities.movements);
      const isFixedLens = await page.evaluate(`!(window.__dev.cam.parts.lens?.group || window.__dev.cam.parts.lensMount)`);
      const maxL = Math.max(45, ...rt.lensCollectionAudit.map((x) => x.L || 50));
      const lensDist = isViewCam ? 520 : maxL > 220 ? Math.round(Math.max(span * 2.2, (span * 0.7 + maxL * 0.85) * 2.0)) : Math.round(Math.max(span * 2.55, (span * 0.8 + maxL * 1.15) * 2.15));
      const baseTarget = [+(cx * 0.2).toFixed(1), +(cy + H * 0.04).toFixed(1), +(rt.flangeZ - Math.min(maxL, 180) * 0.34).toFixed(1)];
      for (let li = 0; li < rt.lensCollectionAudit.length; li++) {
        const entry = rt.lensCollectionAudit[li];
        const dynTarget = await page.evaluate(`(async () => {
          const { cam, THREE } = window.__dev;
          const { CAMERAS } = await import('/src/cameras.js');
          const { flushCameraTextures } = await import('/src/lib/textures.js');
          const l = CAMERAS[${JSON.stringify(kind)}].lenses[${li}];
          cam.root.visible = false; await cam.swapLens(l, () => {}); cam.root.visible = true;
          if (cam.setHood) cam.setHood(false);
          if (cam.st) { cam.st.snapRings = true; if ('explodeK' in cam.st) cam.st.explodeK = 0; if ('lensOut' in cam.st) cam.st.lensOut = 0; }
          cam.setState({ ...window.__dev.STATE, focus: 10000, aperture: l.maxAperture });
          cam.update(0.016); flushCameraTextures();
          cam.parts.mm.updateMatrixWorld(true);
          if (${isViewCam}) {
            const lObj = cam.parts.lens?.group || cam.parts.lensMount || cam.parts.mm;
            const b = new THREE.Box3().setFromObject(lObj);
            const c = b.getCenter(new THREE.Vector3());
            return [+c.x.toFixed(1), +c.y.toFixed(1), +(c.z + 22).toFixed(1)];
          }
          if (${maxL > 220}) {
            const b = new THREE.Box3().setFromObject(cam.parts.mm);
            const c = b.getCenter(new THREE.Vector3());
            return [+(c.x * 0.25).toFixed(1), +(c.y + 4).toFixed(1), +c.z.toFixed(1)];
          }
          return null;
        })()`);
        const tUse = dynTarget || baseTarget;
        const fn = `_l_${li}.png`;
        saveB64(outDir, fn, await page.evaluate(`window.__dev.shot({ az:${isViewCam ? -26 : -30}, el:13, dist:${lensDist}, target:${JSON.stringify(tUse)}, W:720, H:600, fov:21, bg:0xedeef2, floorOn:false })`));
        lensGridFiles.push(fn);
        lensGridLabels.push(`${li + 1}. ${entry.name.replace(/ƒ/g, 'f')} (${entry.L ? entry.L + 'mm' : entry.id})`);
      }

      const rearFramed = await page.evaluate(`(async () => {
        const { cam, THREE } = window.__dev;
        const { CAMERAS } = await import('/src/cameras.js');
        const { flushCameraTextures } = await import('/src/lib/textures.js');
        const desc = CAMERAS[${JSON.stringify(kind)}];
        const dl = desc.lenses.find((x) => x.id === desc.defaultLens) || desc.lenses[0];
        cam.root.visible = false; await cam.swapLens(dl, () => {}); cam.root.visible = true;
        if (cam.setHood) cam.setHood(false);
        if (${isFixedLens}) {
          if (cam.st) { cam.st.snapRings = true; if ('explodeK' in cam.st) cam.st.explodeK = 0; }
          cam.setState({ ...window.__dev.STATE, focus: 10000, aperture: dl.maxAperture, hoodOn: false });
          cam.update(0.016); flushCameraTextures();
          return window.__dev.shot({ az: -20, el: 8, dist: 310, target: [0, 23, -44], W: 720, H: 600, fov: 21, bg: 0xe3e6ec, floorOn: false });
        }
        if (cam.st) {
          if ('lensOut' in cam.st) cam.st.lensOut = 1;
          else if ('explodeK' in cam.st) cam.st.explodeK = 1;
        }
        cam.update(0.016); flushCameraTextures();
        const lObj = cam.parts.lens?.group || cam.parts.lensMount || cam.parts.mm;
        const keep = new Set();
        for (let cur = lObj; cur && cur !== cam.parts.mm.parent; cur = cur.parent) keep.add(cur);
        const hidden = [];
        const hideSiblings = (node) => {
          for (const ch of node.children) {
            if (keep.has(ch)) {
              if (ch !== lObj) hideSiblings(ch);
            } else if (ch.visible) {
              ch.visible = false; hidden.push(ch);
            }
          }
        };
        if (lObj !== cam.parts.mm) hideSiblings(cam.parts.mm);
        cam.parts.mm.updateMatrixWorld(true);
        const b = new THREE.Box3().setFromObject(lObj);
        const sz = b.getSize(new THREE.Vector3());
        const c = b.getCenter(new THREE.Vector3());
        const d = Math.max(sz.x, sz.y, sz.z) * 2.95;
        const _origUpdate = cam.update;
        cam.update = () => {};
        let png;
        try {
          png = window.__dev.shot({ az: 146, el: 15, dist: Math.round(d), target: [c.x, c.y, c.z + sz.z * 0.14], W: 720, H: 600, fov: 22, bg: 0xe3e6ec, floorOn: false });
        } finally {
          cam.update = _origUpdate;
        }
        for (const ch of hidden) ch.visible = true;
        if (cam.st) { if ('lensOut' in cam.st) cam.st.lensOut = 0; if ('explodeK' in cam.st) cam.st.explodeK = 0; }
        cam.update(0.016);
        return png;
      })()`);
      saveB64(outDir, '_l_rear.png', rearFramed);
      lensGridFiles.push('_l_rear.png');
      lensGridLabels.push(`${rt.lensCollectionAudit.length + 1}. ${isFixedLens ? 'TWIN BAY-III OPTICS MACRO' : isViewCam ? 'REAR CELL & COPAL MOUNT' : 'REAR BAYONET (DETACHED)'}`);

      let hoodIdx = isFixedLens ? 0 : rt.lensCollectionAudit.length - 1;
      if (!isFixedLens) {
        let foundBuiltIn = false;
        for (let i = rt.lensCollectionAudit.length - 1; i >= 0; i--) {
          if (rt.lensCollectionAudit[i].builtInHood) { hoodIdx = i; foundBuiltIn = true; break; }
        }
        if (!foundBuiltIn) {
          hoodIdx = await page.evaluate(`(async () => {
            const { cam } = window.__dev;
            const { CAMERAS } = await import('/src/cameras.js');
            const lenses = CAMERAS[${JSON.stringify(kind)}].lenses;
            for (let i = lenses.length - 1; i >= 0; i--) {
              cam.root.visible = false; await cam.swapLens(lenses[i], () => {}); cam.root.visible = true;
              if (cam.hasHood) return i;
            }
            return lenses.length - 1;
          })()`);
        }
      }
      const hoodEntry = rt.lensCollectionAudit[hoodIdx];
      const hoodTarget = await page.evaluate(`(async () => {
        const { cam, THREE } = window.__dev;
        const { CAMERAS } = await import('/src/cameras.js');
        const { flushCameraTextures } = await import('/src/lib/textures.js');
        const l = CAMERAS[${JSON.stringify(kind)}].lenses[${hoodIdx}];
        cam.root.visible = false; await cam.swapLens(l, () => {}); cam.root.visible = true;
        if (cam.setHood) cam.setHood(true);
        if (cam.st) cam.st.snapRings = true;
        cam.setState({ ...window.__dev.STATE, focus: 10000, aperture: l.maxAperture, hoodOn: true });
        cam.update(0.016); flushCameraTextures();
        cam.parts.mm.updateMatrixWorld(true);
        if (${isViewCam}) {
          const lObj = cam.parts.lens?.group || cam.parts.lensMount || cam.parts.mm;
          const b = new THREE.Box3().setFromObject(lObj);
          const c = b.getCenter(new THREE.Vector3());
          return [+c.x.toFixed(1), +c.y.toFixed(1), +(c.z + 12).toFixed(1)];
        }
        if (${maxL > 220}) {
          const b = new THREE.Box3().setFromObject(cam.parts.mm);
          const c = b.getCenter(new THREE.Vector3());
          return [+(c.x * 0.25).toFixed(1), +(c.y + 4).toFixed(1), +c.z.toFixed(1)];
        }
        return null;
      })()`);
      const hUse = hoodTarget || [baseTarget[0], baseTarget[1], +(baseTarget[2] - 14).toFixed(1)];
      const hDist = maxL > 220 ? Math.round(lensDist * 0.96) : Math.round(lensDist * 1.14);
      saveB64(outDir, '_l_hood.png', await page.evaluate(`window.__dev.shot({ az:${isViewCam ? -26 : -30}, el:13, dist:${hDist}, target:${JSON.stringify(hUse)}, W:720, H:600, fov:21, bg:0xedeef2, floorOn:false })`));
      lensGridFiles.push('_l_hood.png');
      lensGridLabels.push(`${rt.lensCollectionAudit.length + 2}. ${hoodEntry.name.replace(/ƒ/g, 'f')} HOOD EXTENDED`);

      await page.evaluate(`(async () => {
        const { cam } = window.__dev;
        const { CAMERAS } = await import('/src/cameras.js');
        const desc = CAMERAS[${JSON.stringify(kind)}];
        const dl = desc.lenses.find((x) => x.id === desc.defaultLens) || desc.lenses[0];
        cam.root.visible = false; await cam.swapLens(dl, () => {}); cam.root.visible = true;
        if (cam.setHood) cam.setHood(false);
        if (cam.st) cam.st.snapRings = true;
        cam.setState({ ...window.__dev.STATE, hoodOn: false });
        cam.update(0.016);
      })()`);
    }

    const overlaySpecs = [];
    for (let oi = 0; oi < opts.overlays.length; oi++) {
      const parts = opts.overlays[oi].split(':');
      if (parts.length < 5) continue;
      const [refPath, dir, oxS, oyS, sS, lensS] = parts;
      if (!existsSync(refPath)) { report.warnings.push(`overlay ref missing: ${refPath}`); continue; }
      const dims = execFileSync('python3', ['-c', `from PIL import Image; im=Image.open(${JSON.stringify(refPath)}); print(im.width, im.height)`]).toString().trim().split(' ').map(Number);
      const lensOn = lensS === 'true' || lensS === '1';
      const dataUrl = await page.evaluate(`window.__dev.ortho({ dir:${JSON.stringify(dir)}, W:${dims[0]}, H:${dims[1]}, ox:${Number(oxS)}, oy:${Number(oyS)}, s:${Number(sS)}, lens:${lensOn}, bg:0xe0e0e0 })`);
      const modPng = join(outDir, `_ov_mod_${oi}.png`);
      writeFileSync(modPng, Buffer.from(dataUrl.split(',')[1], 'base64'));
      overlaySpecs.push({ refPath, modPng, outPng: join(outDir, `overlay_${oi}_${dir}.png`) });
    }

    execFileSync('python3', ['-c', `
import os
from PIL import Image, ImageDraw, ImageFilter

OUT = ${JSON.stringify(outDir)}
def compose(files, cols, out_name, labels=None, bg=(235, 236, 240)):
    ims = [Image.open(os.path.join(OUT, f)).convert('RGB') for f in files]
    W, H = ims[0].size
    rows = (len(ims) + cols - 1) // cols
    pad = 10
    sheet = Image.new('RGB', (cols * W + (cols - 1) * pad, rows * H + (rows - 1) * pad), bg)
    draw = ImageDraw.Draw(sheet)
    for i, im in enumerate(ims):
        r, c = divmod(i, cols)
        x, y = c * (W + pad), r * (H + pad)
        sheet.paste(im, (x, y))
        if labels and i < len(labels):
            draw.rectangle([x + 8, y + 8, x + 8 + len(labels[i]) * 8 + 16, y + 32], fill=(18, 20, 24))
            draw.text((x + 16, y + 14), labels[i], fill=(242, 244, 248))
    sheet.save(os.path.join(OUT, out_name))
    for f in files:
        try: os.remove(os.path.join(OUT, f))
        except OSError: pass

compose(['_o_front.png', '_o_left.png', '_o_right.png', '_o_back.png'], 2, 'ortho_4view.png', ['FRONT (ORTHO)', 'LEFT FLANK (ORTHO)', 'RIGHT FLANK (ORTHO)', 'BACK (ORTHO)'])
compose(['_o_top.png', '_o_bot.png'], 2, 'ortho_top_bottom.png', ['TOP DECK (ORTHO)', 'BOTTOM BASEPLATE (ORTHO)'])
compose(['_m_1.png', '_m_2.png', '_m_3.png', '_m_4.png', '_m_5.png', '_m_6.png'], 3, 'macro_grid.png', ['1. FRONT / LENSES / BADGE', '2. LEFT FLANK / KNURLING', '3. RIGHT FLANK / CRANK', '4. REAR / CHART / DOOR', '5. TOP DECK / FINDER', '6. BOTTOM BASE / LATCH'])
compose(['_s_1.png', '_s_2.png', '_s_3.png', '_s_4.png', '_s_5.png', '_s_6.png'], 3, 'states_grid.png', ['1. HERO 3/4', '2. FINDER / HOOD OPEN', '3. OPEN BACK (EMPTY)', '4. OPEN BACK (LOADED)', '5. OPTICAL CUTAWAY', '6. EXPLODED VIEW'])
lens_files = ${JSON.stringify(lensGridFiles)}
lens_labels = ${JSON.stringify(lensGridLabels)}
if lens_files:
    lcols = 4 if len(lens_files) == 8 else 3
    compose(lens_files, lcols, 'lenses_grid.png', lens_labels)

for ov in ${JSON.stringify(overlaySpecs)}:
    ref = Image.open(ov['refPath']).convert('RGB')
    mod = Image.open(ov['modPng']).convert('RGB').resize(ref.size, Image.Resampling.LANCZOS)
    blend = Image.blend(ref, mod, 0.5)
    anaglyph = Image.merge('RGB', (mod.convert('L'), ref.convert('L'), ref.convert('L')))
    edges = mod.convert('L').filter(ImageFilter.FIND_EDGES)
    edge_ov = ref.copy()
    rp, ep = edge_ov.load(), edges.load()
    for yy in range(ref.height):
        for xx in range(ref.width):
            if ep[xx, yy] > 42:
                rp[xx, yy] = (255, 45, 45)
    W, H = ref.size
    tw = min(720, W); th = int(H * (tw / W))
    tiles = [im.resize((tw, th), Image.Resampling.LANCZOS) for im in (ref, mod, blend, anaglyph, edge_ov)]
    grid = Image.new('RGB', (tw * 2 + 10, th * 2 + 10), (20, 22, 26))
    for idx, im in enumerate((tiles[0], tiles[2], tiles[4], tiles[3])):
        grid.paste(im, ((idx % 2) * (tw + 10), (idx // 2) * (th + 10)))
    grid.save(ov['outPng'])
    try: os.remove(ov['modPng'])
    except OSError: pass
`]);
    report.artifacts.push(
      join(outDir, 'ortho_4view.png'),
      join(outDir, 'ortho_top_bottom.png'),
      join(outDir, 'macro_grid.png'),
      join(outDir, 'states_grid.png'),
      ...(lensGridFiles.length ? [join(outDir, 'lenses_grid.png')] : []),
      ...overlaySpecs.map((o) => o.outPng),
    );
  }

  if (page.errors.length > report.runtimeErrors.length) {
    const extra = page.errors.slice(report.runtimeErrors.length);
    report.runtimeErrors.push(...extra);
    report.vetoes.push(`V1(render): ${extra.length} runtime errors during state capture: ${extra.join(' | ')}`);
  }

  report.verdict = report.vetoes.length === 0 ? 'MACHINE_PASS' : 'MACHINE_VETO';
  if (report.verdict !== 'MACHINE_PASS') globalExit = 2;
  writeFileSync(join(outDir, 'audit_report.json'), JSON.stringify(report, null, 2));
  allReports.push(report);

  console.log(`\n[${report.verdict}] ${kind} — ${rt.meshes} meshes, ${rt.triangles} tris, envelope=${rt.envelopeMm.size.join('×')} mm, lenses=${rt.lensAudit.length}, labels=${rt.labelHits}, vetoes=${report.vetoes.length}, warnings=${report.warnings.length}`);
  if (report.vetoes.length) console.log('  VETOES:', report.vetoes);
  if (report.warnings.length) console.log('  WARNINGS:', report.warnings);
  if (report.artifacts.length) console.log('  ARTIFACTS:', report.artifacts.map((p) => basename(p)).join(', '), 'in', outDir);
}

// Optional 1:1 True-Scale Portfolio Bench Lineup
if (opts.lineup) {
  const lineupOut = opts.out && !opts.all ? opts.out : (opts.out || AUDIT_BASE);
  mkdirSync(lineupOut, { recursive: true });
  const bench = ['503cx', 'm6', 'ae1', 'rolleiflex', 'k1000', 'f3', 'om1', 'intrepid'];
  if (opts.camera && !bench.includes(opts.camera)) bench.push(opts.camera);
  const bFiles = [];
  for (const bk of bench) {
    await loadCamera(bk);
    const bb = await page.evaluate(`{ const b = new window.__dev.THREE.Box3().setFromObject(window.__dev.cam.parts.mm); ({ min: b.min.toArray(), max: b.max.toArray(), c: b.getCenter(new window.__dev.THREE.Vector3()).toArray() }); }`);
    const s = 2.6, tileH2 = 640, tileW2 = Math.max(380, Math.round((bb.max[0] - bb.min[0] + 36) * s));
    const ox = tileW2 / 2 + bb.c[0] * s;
    const oy = tileH2 - 48 + bb.min[1] * s;
    const png = await page.evaluate(`window.__dev.ortho({ dir:'front', W:${tileW2}, H:${tileH2}, ox:${ox}, oy:${oy}, s:${s}, lens:true, bg:0x8d9096 })`);
    const fn = `_lu_${bk}.png`;
    saveB64(lineupOut, fn, png);
    bFiles.push(fn);
  }
  execFileSync('python3', ['-c', `
import os
from PIL import Image
OUT = ${JSON.stringify(lineupOut)}
files = ${JSON.stringify(bFiles)}
ims = [Image.open(os.path.join(OUT, f)).convert('RGB') for f in files]
H = max(im.height for im in ims); W = sum(im.width for im in ims)
out = Image.new('RGB', (W, H), (141, 144, 150))
x = 0
for im in ims: out.paste(im, (x, H - im.height)); x += im.width
out.save(os.path.join(OUT, 'lineup_1to1_front.png'))
for f in files: os.remove(os.path.join(OUT, f))
`]);
  console.log(`\n[LINEUP] Wrote ${join(lineupOut, 'lineup_1to1_front.png')}`);
}

await page.close();
server.close();
process.exit(globalExit);
