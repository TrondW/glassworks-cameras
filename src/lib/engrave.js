// camera/lib/engrave.js — Engraving and paint inks for scales and legends drawn to canvas.
// (moved verbatim from camera503.js in Phase 0: the modelling vocabulary every camera shares)
import * as THREE from 'three';

// ───────── Engravings ─────────
export function fmtN(n) { return Number.isInteger(n) ? String(n) : n.toFixed(1); }

export const INK = { white: '#efede4', yellow: '#e9c23a', orange: '#f08a26', red: '#e23a22', green: '#3fb36a', blue: '#5d9be0' };

export const PAINT_BG = '#0e0e0e';
