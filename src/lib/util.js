// camera/lib/util.js — Small shared pieces: angles and easing, seeded noise, and matrix shorthands (T, TS).
// (moved verbatim from camera503.js in Phase 0: the modelling vocabulary every camera shares)
import * as THREE from 'three';

export const TAU = Math.PI * 2, DEG = Math.PI / 180;

export const lerp = THREE.MathUtils.lerp;

export const clamp01 = (x) => Math.min(1, Math.max(0, x));

export const FONT = '"DIN Alternate", "Helvetica Neue", Helvetica, Arial, sans-serif';


export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Periodic 1-D value noise on [0, 1). */
export function noise1(seed, cells) {
  const r = rng(seed), v = Array.from({ length: cells }, r);
  return (t) => {
    const x = (((t % 1) + 1) % 1) * cells, i = Math.floor(x), f = x - i, s = f * f * (3 - 2 * f);
    return v[i % cells] * (1 - s) + v[(i + 1) % cells] * s;
  };
}


export const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();

export function T(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = 1, order = 'XYZ') {
  return new THREE.Matrix4().compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz, order)), _s.set(s, s, s));
}

export const TS = (x, y, z, sx, sy, sz) => new THREE.Matrix4().compose(_p.set(x, y, z), _q.identity(), _s.set(sx, sy, sz));


// ───────── Easing & timing ─────────
export const easeInOut = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

export const easeOutBack = (k) => { const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); };

export const snapUp = (k) => { if (k < 0.82) { const t = k / 0.82; return t * t; } const t = (k - 0.82) / 0.18; return 1 - 0.06 * Math.sin(t * Math.PI); };

export const snapOpen = (k) => { const t = Math.min(1, k * 1.15); return 1 - Math.pow(1 - t, 3) + (k > 0.87 ? 0.04 * Math.sin(((k - 0.87) / 0.13) * Math.PI) : 0); };

export const phase = (k, a, b) => clamp01((k - a) / (b - a));
