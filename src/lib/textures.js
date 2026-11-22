// camera/lib/textures.js — Procedural surface textures (synthesised in a job queue after a build; cached per page): pebble-grain leatherette, brushed metal, rubber knurl and grips, carbon twill, waffle rubber.
// (moved verbatim from camera503.js in Phase 0: the modelling vocabulary every camera shares)
import * as THREE from 'three';
import { lerp, noise1, rng } from './util.js';

// ───────── Procedural textures (cached per page) ─────────
// Heavy texture synthesis runs in a job queue right after the build returns
// (the textures start as flat placeholders), so createCamera503 stays fast.
export const TEX = {};

export const JOBS = [];

export let jobTimer = 0;

export function defer(fn) { JOBS.push(fn); if (!jobTimer) jobTimer = setTimeout(runJobs, 0); }

export function runJobs() {
  jobTimer = 0;
  const t = performance.now();
  while (JOBS.length && performance.now() - t < 14) JOBS.shift()();
  if (JOBS.length) jobTimer = setTimeout(runJobs, 0);
}

/** Run every pending texture job now (e.g. before a capture). */
export function flushCameraTextures() { while (JOBS.length) JOBS.shift()(); }

export function dataTexture(data, w, h, { srgb = false, aniso = 8 } = {}) {
  const t = new THREE.DataTexture(data, w, h, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = aniso;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.needsUpdate = true;
  return t;
}

/** Tileable height field → tangent-space normal map (RGBA8). */
export function normalFromHeight(h, S, strength) {
  const out = new Uint8Array(S * S * 4);
  for (let y = 0; y < S; y++) {
    const ym = ((y - 1 + S) % S) * S, yp = ((y + 1) % S) * S, yc = y * S;
    for (let x = 0; x < S; x++) {
      const xm = (x - 1 + S) % S, xp = (x + 1) % S;
      const dx = (h[yc + xp] - h[yc + xm]) * strength, dy = (h[yp + x] - h[ym + x]) * strength;
      const l = 1 / Math.sqrt(dx * dx + dy * dy + 1), k = (yc + x) * 4;
      out[k] = (-dx * l * 0.5 + 0.5) * 255; out[k + 1] = (-dy * l * 0.5 + 0.5) * 255; out[k + 2] = (l * 0.5 + 0.5) * 255; out[k + 3] = 255;
    }
  }
  return out;
}


/** Pebble-grain leatherette: Worley cells ~0.6–1.2 mm on a 20 mm tile. */
export function leatherMaps() {
  if (TEX.leather) return TEX.leather;
  const S = 512, M = 128;
  const nd = new Uint8Array(S * S * 4), rd = new Uint8Array(S * S * 4), md = new Uint8Array(M * M * 4);
  for (let i = 0; i < S * S; i++) { nd[i * 4] = nd[i * 4 + 1] = 128; nd[i * 4 + 2] = 255; nd[i * 4 + 3] = 255; rd[i * 4] = rd[i * 4 + 1] = rd[i * 4 + 2] = 190; rd[i * 4 + 3] = 255; }
  md.fill(230);
  const nrm = dataTexture(nd, S, S, { aniso: 8 }), rgh = dataTexture(rd, S, S), mac = dataTexture(md, M, M);
  nrm.repeat.set(1 / 20, 1 / 20); rgh.repeat.set(1 / 20, 1 / 20); mac.repeat.set(1 / 53, 1 / 53);
  defer(() => { leatherSynth(S, M, nd, rd, md); nrm.needsUpdate = rgh.needsUpdate = mac.needsUpdate = true; });
  return (TEX.leather = { nrm, rgh, mac });
}

export function leatherSynth(S, M, nd, rd, md) {
  const cells = 26, r = rng(11);
  const px = new Float32Array(cells * cells), py = new Float32Array(cells * cells), ph = new Float32Array(cells * cells), pw = new Float32Array(cells * cells);
  for (let i = 0; i < cells * cells; i++) { px[i] = r(); py[i] = r(); ph[i] = 0.6 + 0.4 * r(); pw[i] = 1 / Math.pow(0.7 + 0.6 * r(), 2); }
  const h = new Float32Array(S * S), k = cells / S;
  for (let y = 0; y < S; y++) {
    const fy = (y + 0.5) * k, cy = Math.floor(fy);
    for (let x = 0; x < S; x++) {
      const fx = (x + 0.5) * k, cx = Math.floor(fx);
      let d1 = 9, d2 = 9, c1 = 0;
      for (let j = -2; j <= 2; j++) {
        const yy = cy + j, wy = (yy + cells) % cells;
        for (let i = -2; i <= 2; i++) {
          const xx = cx + i, c = wy * cells + ((xx + cells) % cells);
          const dx = xx + px[c] - fx, dy = yy + py[c] - fy, d = (dx * dx + dy * dy) * pw[c];
          if (d < d1) { d2 = d1; d1 = d; c1 = c; } else if (d < d2) d2 = d;
        }
      }
      const e = Math.sqrt(d2) - Math.sqrt(d1), f1 = Math.sqrt(d1);
      // rounded pebble of its own height: a dome over the cell centre blended with a soft
      // valley at the cell border (no flat plateaus), fine grain on top
      const dome = Math.sqrt(Math.max(0, 1 - d1 * 1.25));
      h[y * S + x] = ph[c1] * (0.3 + 0.7 * dome) * (0.62 + 0.38 * (1 - Math.exp(-e * 5))) + 0.015 * (r() - 0.5);
    }
  }
  // soften the valleys (separable 3-tap blur, wrapped, two passes)
  const tmp = new Float32Array(S * S);
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) tmp[y * S + x] = (h[y * S + ((x + S - 1) % S)] + 2 * h[y * S + x] + h[y * S + ((x + 1) % S)]) / 4;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) h[y * S + x] = (tmp[((y + S - 1) % S) * S + x] + 2 * tmp[y * S + x] + tmp[((y + 1) % S) * S + x]) / 4;
  }
  nd.set(normalFromHeight(h, S, 1.2));
  const rough = rd;
  for (let i = 0; i < S * S; i++) { const v = (0.78 + 0.3 * (1 - Math.min(1, h[i]))) * 200; rough[i * 4] = rough[i * 4 + 1] = rough[i * 4 + 2] = v; rough[i * 4 + 3] = 255; }
  // macro variation (albedo), on its own scale so the tile never shows
  const mr = rng(5), g = new Float32Array(16 * 16);
  for (let i = 0; i < g.length; i++) g[i] = mr();
  const macro = md;
  for (let y = 0; y < M; y++) for (let x = 0; x < M; x++) {
    const fx = x / M * 16, fy = y / M * 16, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
    const s = (a, b) => g[((b + 16) % 16) * 16 + ((a + 16) % 16)];
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    const v = lerp(lerp(s(ix, iy), s(ix + 1, iy), sx), lerp(s(ix, iy + 1), s(ix + 1, iy + 1), sx), sy);
    const c = (0.86 + 0.14 * v + 0.04 * (mr() - 0.5)) * 255, kk = (y * M + x) * 4;
    macro[kk] = macro[kk + 1] = macro[kk + 2] = c; macro[kk + 3] = 255;
  }
}


/** Satin-chrome roughness: fine streaks along u (grooves along the brushing). */
export function brushedMap() {
  if (TEX.brushed) return TEX.brushed;
  const W = 256, H = 256, out = new Uint8Array(W * H * 4).fill(220);
  const t = dataTexture(out, W, H);
  t.repeat.set(1 / 40, 1 / 9);
  defer(() => { brushedSynth(W, H, out); t.needsUpdate = true; });
  return (TEX.brushed = t);
}

export function brushedSynth(W, H, out) {
  const r = rng(3), row = new Float32Array(H);
  for (let y = 0; y < H; y++) row[y] = r();
  const n1 = noise1(9, 6);
  for (let y = 0; y < H; y++) {
    const base = (row[y] * 0.5 + row[(y + 1) % H] * 0.3 + row[(y + H - 1) % H] * 0.2);
    for (let x = 0; x < W; x++) {
      const v = 0.92 + 0.1 * base + 0.03 * n1(x / W + row[y] * 0.3) + 0.04 * (r() - 0.5);
      const k = (y * W + x) * 4;
      out[k] = out[k + 1] = out[k + 2] = Math.min(255, v * 200); out[k + 3] = 255;
    }
  }
}


/** Diamond cross-hatch for tripod twist locks (one cell per tile). */
export function knurlMap() {
  if (TEX.knurl) return TEX.knurl;
  const S = 64, h = new Float32Array(S * S);
  const tri = (t) => 1 - 2 * Math.abs(t - 0.5);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = (x + 0.5) / S, v = (y + 0.5) / S;
    h[y * S + x] = Math.min(1, Math.min(tri((u + v + 0.5) % 1), tri((u - v + 1.5) % 1)) * 2.6);
  }
  return (TEX.knurl = dataTexture(normalFromHeight(h, S, 1.4), S, S, { aniso: 8 }));
}


/** Orthogonal truncated square-pyramid rubber waffle for CF lens focusing & FLE rings (SPEC §10). */
export function cfGripMaps() {
  if (TEX.cfGrip) return TEX.cfGrip;
  const S = 64, h = new Float32Array(S * S), rg = new Uint8Array(S * S * 4), r = rng(43);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = (x + 0.5) / S, v = (y + 0.5) / S;
    const du = 1 - 2 * Math.abs(u - 0.5), dv = 1 - 2 * Math.abs(v - 0.5);
    const p = Math.min(du, dv);
    // Crisp V-groove floor (0..0.11), 45° pyramid flank (0.11..0.66), flat-crowned square plateau (0.66..1.0)
    let z = p < 0.11 ? (p / 0.11) * 0.08 : p < 0.66 ? 0.08 + ((p - 0.11) / 0.55) * 0.84 : 0.92 + 0.08 * Math.sin(((p - 0.66) / 0.34) * (Math.PI / 2));
    z += 0.018 * (r() - 0.5);
    h[y * S + x] = z;
    const k = (y * S + x) * 4;
    const rv = Math.round((0.86 - 0.20 * z + 0.03 * (r() - 0.5)) * 255);
    rg[k] = rg[k + 1] = rg[k + 2] = rv; rg[k + 3] = 255;
  }
  const nrm = dataTexture(normalFromHeight(h, S, 1.75), S, S, { aniso: 16 });
  const rgh = dataTexture(rg, S, S, { aniso: 8 });
  return (TEX.cfGrip = { nrm, rgh });
}


/** 2×2 twill carbon weave: normal + anisotropy direction maps (8.8 mm tile). */
export function carbonMaps() {
  if (TEX.carbon) return TEX.carbon;
  const S = 128, tow = S / 4, h = new Float32Array(S * S), an = new Uint8Array(S * S * 4), rg = new Uint8Array(S * S * 4), r = rng(21);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = Math.floor(x / tow), j = Math.floor(y / tow), lu = (x % tow + 0.5) / tow, lv = (y % tow + 0.5) / tow;
    const warp = ((i + j) & 3) < 2;              // fibres along v on top
    const across = warp ? lu : lv, along = warp ? ((j + (i & 1)) % 2 + lv) / 2 : ((i + (j & 1)) % 2 + lu) / 2;
    h[y * S + x] = Math.pow(Math.sin(Math.PI * across), 0.45) * (0.75 + 0.25 * Math.sin(Math.PI * along)) + 0.04 * r();
    const k = (y * S + x) * 4;
    an[k] = warp ? 255 : 128; an[k + 1] = warp ? 128 : 255; an[k + 2] = 255; an[k + 3] = 255;
    const rv = (warp ? 0.9 : 1.05) * 170 + 12 * r();
    rg[k] = rg[k + 1] = rg[k + 2] = rv; rg[k + 3] = 255;
  }
  const nrm = dataTexture(normalFromHeight(h, S, 0.9), S, S), ani = dataTexture(an, S, S), rgh = dataTexture(rg, S, S);
  [nrm, ani, rgh].forEach((t) => t.repeat.set(1 / 8.8, 1 / 8.8));
  ani.magFilter = THREE.NearestFilter;
  return (TEX.carbon = { nrm, ani, rgh });
}


export function waffleMaps() {
  if (TEX.waffle) return TEX.waffle;
  const S = 64, h = new Float32Array(S * S), rg = new Uint8Array(S * S * 4);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = (x + 0.5) / S, v = (y + 0.5) / S;
    const d = Math.min(1 - 2 * Math.abs(u - 0.5), 1 - 2 * Math.abs(v - 0.5));
    // Raised grid ribs around a recessed square waffle dimple
    const z = d < 0.22 ? 1.0 : d < 0.38 ? 1.0 - (d - 0.22) / 0.16 : 0.0;
    h[y * S + x] = z;
    const k = (y * S + x) * 4, rv = Math.round((0.46 + 0.22 * (1 - z)) * 255);
    rg[k] = rg[k + 1] = rg[k + 2] = rv; rg[k + 3] = 255;
  }
  const nrm = dataTexture(normalFromHeight(h, S, 1.65), S, S, { aniso: 8 });
  const rgh = dataTexture(rg, S, S, { aniso: 8 });
  nrm.repeat.set(1 / 1.85, 1 / 1.85);
  rgh.repeat.set(1 / 1.85, 1 / 1.85);
  return (TEX.waffle = { nrm, rgh });
}

/** Fine glass-bead-blasted satin metal grain (~0.12 mm micro-peen on a 12 mm tile): kills plastic-chrome look on satin brass/chrome & baked enamel. */
export function beadBlastMaps() {
  if (TEX.beadBlast) return TEX.beadBlast;
  const S = 256;
  const nd = new Uint8Array(S * S * 4), rd = new Uint8Array(S * S * 4);
  for (let i = 0; i < S * S; i++) {
    nd[i * 4] = nd[i * 4 + 1] = 128; nd[i * 4 + 2] = 255; nd[i * 4 + 3] = 255;
    rd[i * 4] = rd[i * 4 + 1] = rd[i * 4 + 2] = 210; rd[i * 4 + 3] = 255;
  }
  const nrm = dataTexture(nd, S, S, { aniso: 8 }), rgh = dataTexture(rd, S, S, { aniso: 8 });
  nrm.repeat.set(1 / 12, 1 / 12); rgh.repeat.set(1 / 12, 1 / 12);
  defer(() => {
    const r = rng(73), h = new Float32Array(S * S), low = new Float32Array(16 * 16);
    for (let i = 0; i < low.length; i++) low[i] = r();
    const sLow = (fx, fy) => {
      const ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
      const g = (a, b) => low[((b + 16) % 16) * 16 + ((a + 16) % 16)];
      const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
      return lerp(lerp(g(ix, iy), g(ix + 1, iy), sx), lerp(g(ix, iy + 1), g(ix + 1, iy + 1), sx), sy);
    };
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      // Fine isotropic bead-peen sparkles + subtle long-wave satin-plating variation (no directional plastic streaks)
      const micro = (r() + r() - 1.0) * 0.55;
      const macro = sLow((x / S) * 16, (y / S) * 16);
      h[y * S + x] = 0.5 + 0.34 * micro + 0.16 * (macro - 0.5);
    }
    // Single light 3-tap blur so normals represent real rounded glass-bead micro-dimples (not aliased static)
    const tmp = new Float32Array(S * S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) tmp[y * S + x] = (h[y * S + ((x + S - 1) % S)] + 2 * h[y * S + x] + h[y * S + ((x + 1) % S)]) * 0.25;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) h[y * S + x] = (tmp[((y + S - 1) % S) * S + x] + 2 * tmp[y * S + x] + tmp[((y + 1) % S) * S + x]) * 0.25;
    nd.set(normalFromHeight(h, S, 0.95));
    for (let i = 0; i < S * S; i++) {
      // Micro-sparkle roughness modulation (0.76..1.04 of base roughness)
      const rv = Math.max(150, Math.min(255, Math.round((0.86 + 0.24 * (h[i] - 0.5) + 0.08 * (r() - 0.5)) * 230)));
      rd[i * 4] = rd[i * 4 + 1] = rd[i * 4 + 2] = rv; rd[i * 4 + 3] = 255;
    }
    nrm.needsUpdate = rgh.needsUpdate = true;
  });
  return (TEX.beadBlast = { nrm, rgh });
}

/** High-relief Japanese vulcanite leatherette (K1000, Nikon F3, Olympus OM-1): sharp deep pebble valleys + glossy satin crowns (~0.55–0.9 mm pebbles on 17 mm tile). */
export function vulcaniteMaps() {
  if (TEX.vulcanite) return TEX.vulcanite;
  const S = 512, M = 128;
  const nd = new Uint8Array(S * S * 4), rd = new Uint8Array(S * S * 4), md = new Uint8Array(M * M * 4);
  for (let i = 0; i < S * S; i++) { nd[i * 4] = nd[i * 4 + 1] = 128; nd[i * 4 + 2] = 255; nd[i * 4 + 3] = 255; rd[i * 4] = rd[i * 4 + 1] = rd[i * 4 + 2] = 165; rd[i * 4 + 3] = 255; }
  md.fill(235);
  const nrm = dataTexture(nd, S, S, { aniso: 16 }), rgh = dataTexture(rd, S, S, { aniso: 8 }), mac = dataTexture(md, M, M);
  nrm.repeat.set(1 / 17, 1 / 17); rgh.repeat.set(1 / 17, 1 / 17); mac.repeat.set(1 / 48, 1 / 48);
  defer(() => {
    const cells = 28, r = rng(29);
    const px = new Float32Array(cells * cells), py = new Float32Array(cells * cells), ph = new Float32Array(cells * cells), pw = new Float32Array(cells * cells);
    for (let i = 0; i < cells * cells; i++) { px[i] = r(); py[i] = r(); ph[i] = 0.68 + 0.32 * r(); pw[i] = 1 / Math.pow(0.66 + 0.68 * r(), 2); }
    const h = new Float32Array(S * S), k = cells / S;
    for (let y = 0; y < S; y++) {
      const fy = (y + 0.5) * k, cy = Math.floor(fy);
      for (let x = 0; x < S; x++) {
        const fx = (x + 0.5) * k, cx = Math.floor(fx);
        let d1 = 9, d2 = 9, c1 = 0;
        for (let j = -2; j <= 2; j++) {
          const yy = cy + j, wy = (yy + cells) % cells;
          for (let i = -2; i <= 2; i++) {
            const xx = cx + i, c = wy * cells + ((xx + cells) % cells);
            // Subtle vertical grain stretch (1.18x) matching real stamped Japanese SLR leatherette
            const dx = (xx + px[c] - fx) * 1.12, dy = (yy + py[c] - fy) * 0.92, d = (dx * dx + dy * dy) * pw[c];
            if (d < d1) { d2 = d1; d1 = d; c1 = c; } else if (d < d2) d2 = d;
          }
        }
        const e = Math.sqrt(d2) - Math.sqrt(d1);
        const dome = Math.pow(Math.max(0, 1 - d1 * 1.15), 0.42);
        // Deep crisp valley crevices between plump rounded vulcanite islands
        const crevice = 1 - Math.exp(-e * 8.5);
        h[y * S + x] = ph[c1] * (0.18 + 0.82 * dome) * (0.28 + 0.72 * crevice) + 0.012 * (r() - 0.5);
      }
    }
    const tmp = new Float32Array(S * S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) tmp[y * S + x] = (h[y * S + ((x + S - 1) % S)] + 2 * h[y * S + x] + h[y * S + ((x + 1) % S)]) * 0.25;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) h[y * S + x] = (tmp[((y + S - 1) % S) * S + x] + 2 * tmp[y * S + x] + tmp[((y + 1) % S) * S + x]) * 0.25;
    nd.set(normalFromHeight(h, S, 2.35));
    for (let i = 0; i < S * S; i++) {
      // Glossy satin pebble crowns (~0.42) vs dead-matte deep valleys (~0.96) for authentic specular contrast!
      const z = Math.min(1, Math.max(0, h[i]));
      const rv = Math.round((0.96 - 0.52 * z * z) * 255);
      rd[i * 4] = rd[i * 4 + 1] = rd[i * 4 + 2] = rv; rd[i * 4 + 3] = 255;
    }
    const mr = rng(19), g = new Float32Array(16 * 16);
    for (let i = 0; i < g.length; i++) g[i] = mr();
    for (let y = 0; y < M; y++) for (let x = 0; x < M; x++) {
      const fx = x / M * 16, fy = y / M * 16, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
      const s = (a, b) => g[((b + 16) % 16) * 16 + ((a + 16) % 16)];
      const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
      const v = lerp(lerp(s(ix, iy), s(ix + 1, iy), sx), lerp(s(ix, iy + 1), s(ix + 1, iy + 1), sx), sy);
      const c = (0.82 + 0.18 * v) * 255, kk = (y * M + x) * 4;
      md[kk] = md[kk + 1] = md[kk + 2] = c; md[kk + 3] = 255;
    }
    nrm.needsUpdate = rgh.needsUpdate = mac.needsUpdate = true;
  });
  return (TEX.vulcanite = { nrm, rgh, mac });
}
