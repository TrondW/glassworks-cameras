// camera/lib/geometry.js — Geometry builders in millimetres: lathe profiles (revolve), rounded-rect lofts (loft), bevelled extrusions with analytic edge normals (slab), rounded boxes, carved outlines, screws, decal UVs and cutaway section faces.
// (moved verbatim from camera503.js in Phase 0: the modelling vocabulary every camera shares)
import * as THREE from 'three';
import { prep } from './mesh.js';
import { DEG, TAU, lerp, noise1 } from './util.js';

/** Planar box-projected UVs in millimetres (so textures keep one scale everywhere). */
export function boxUV(g) {
  const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv || new THREE.BufferAttribute(new Float32Array(p.count * 2), 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    if (ax >= ay && ax >= az) uv.setXY(i, p.getZ(i), p.getY(i));
    else if (ay >= az) uv.setXY(i, p.getX(i), p.getZ(i));
    else uv.setXY(i, p.getX(i), p.getY(i));
  }
  g.setAttribute('uv', uv);
  return g;
}

/** Rounded box (all edges radius r) — a bevelled slab of a rounded rectangle, centred. */
export function rbox(w, h, d, r, segs = 2, wear = 0) {
  r = Math.max(0, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001));
  const g = slab(rrPath(-w / 2, -d / 2, w / 2, d / 2, r), h, r, Math.max(2, segs + 1), wear, Math.max(1, segs));
  g.translate(0, 0, -h / 2);
  g.rotateX(-Math.PI / 2);
  return g;
}


/**
 * Lathe around the Z axis. prof = [[r, z, wear?, rib?], …] ordered around the outside
 * (front → back for a barrel) so the normal (dz, −dr) points outward. φ is measured
 * from +Y toward +X. uv: 'mm' (u = arc length around at rRef, v = profile length),
 * 'band' (u 0‥1 with the top at 0.5, v = 1 at the first profile point) or 'bandOut'.
 */
export function revolve(prof0, o = {}) {
  const segs = o.segs ?? 96, phi0 = o.phi0 ?? -Math.PI, phiLen = o.phiLen ?? TAU;
  // keep edge wear on the edges: long spans get zero-wear points 0.5 mm in from worn ends
  const prof = [];
  const band = o.wearBand ?? 0.3;
  for (let i = 0; i < prof0.length; i++) {
    const p = prof0[i], q = prof0[i + 1];
    prof.push(p);
    if (!q) break;
    const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (len > Math.max(band * 2.4, 1.4) && ((p[2] || 0) > 0 || (q[2] || 0) > 0)) {
      const rib = (p[3] || 0) && (q[3] || 0) ? p[3] : 0;
      const a = band / len;
      if ((p[2] || 0) > 0) prof.push([lerp(p[0], q[0], a), lerp(p[1], q[1], a), 0, rib]);
      if ((q[2] || 0) > 0) prof.push([lerp(p[0], q[0], 1 - a), lerp(p[1], q[1], 1 - a), 0, rib]);
    }
  }
  const creaseCos = Math.cos((o.crease ?? 38) * DEG);
  const n = prof.length, seg = [];
  for (let i = 0; i < n - 1; i++) {
    const dr = prof[i + 1][0] - prof[i][0], dz = prof[i + 1][1] - prof[i][1], l = Math.hypot(dr, dz) || 1e-6;
    seg.push([dz / l, -dr / l, l]);
  }
  const rows = [];
  let s = 0;
  for (let i = 0; i < n; i++) {
    const p = prof[i];
    if (i) s += seg[i - 1][2];
    const a = seg[i - 1], b = seg[i];
    const base = { r: p[0], z: p[1], w: p[2] || 0, rib: p[3] || 0, s };
    if (a && b && a[0] * b[0] + a[1] * b[1] < creaseCos) {
      rows.push({ ...base, nr: a[0], nz: a[1] }, { ...base, nr: b[0], nz: b[1], split: true });
    } else {
      let nr, nz;
      if (a && b) { nr = a[0] + b[0]; nz = a[1] + b[1]; const l = Math.hypot(nr, nz) || 1; nr /= l; nz /= l; } else [nr, nz] = a || b;
      rows.push({ ...base, nr, nz });
    }
  }
  const sTot = s || 1, cols = segs + 1, R = rows.length;
  const pos = new Float32Array(R * cols * 3), nor = new Float32Array(R * cols * 3), uv = new Float32Array(R * cols * 2), wear = new Float32Array(R * cols), tan = new Float32Array(R * cols * 4);
  const ribs = o.ribs, wn = noise1(o.seed ?? 7, o.wearCells ?? 19), rRef = o.rRef ?? Math.max(...prof.map((p) => p[0]));
  const ribW = (phi) => {
    const t = (((phi * ribs.n) / TAU + (ribs.phase || 0)) % 1 + 1) % 1, gr = ribs.groove ?? 0.5, e = ribs.edge ?? 0.14;
    return t > gr ? 0 : Math.min(1, t / e, (gr - t) / e);
  };
  for (let j = 0; j < cols; j++) {
    const t = j / segs, phi = phi0 + phiLen * t, sp = Math.sin(phi), cp = Math.cos(phi);
    let w = 0, dw = 0;
    if (ribs) { const h = 1e-3; w = ribW(phi); dw = (ribW(phi + h) - ribW(phi - h)) / (2 * h); }
    const wmod = 0.35 + 1.0 * wn(t);
    for (let k = 0; k < R; k++) {
      const row = rows[k];
      let r = row.r, tx = 0;
      if (ribs && row.rib) {
        r -= ribs.depth * row.rib * w;
        tx = ((ribs.depth * row.rib * dw) / Math.max(r, 1e-3)) * row.nr;
      }
      let nx = row.nr * sp + tx * cp, ny = row.nr * cp - tx * sp, nz = row.nz;
      const l = 1 / (Math.hypot(nx, ny, nz) || 1);
      nx *= l; ny *= l; nz *= l;
      const vi = k * cols + j;
      pos[vi * 3] = r * sp; pos[vi * 3 + 1] = r * cp; pos[vi * 3 + 2] = row.z;
      nor[vi * 3] = nx; nor[vi * 3 + 1] = ny; nor[vi * 3 + 2] = nz;
      const dot = cp * nx - sp * ny;
      let ux = cp - dot * nx, uy = -sp - dot * ny, uz = -dot * nz;
      const ul = 1 / (Math.hypot(ux, uy, uz) || 1);
      tan[vi * 4] = ux * ul; tan[vi * 4 + 1] = uy * ul; tan[vi * 4 + 2] = uz * ul; tan[vi * 4 + 3] = 1;
      if (o.uv === 'band') { uv[vi * 2] = t; uv[vi * 2 + 1] = 1 - row.s / sTot; }
      else if (o.uv === 'bandOut') { uv[vi * 2] = t; uv[vi * 2 + 1] = row.s / sTot; }
      else { uv[vi * 2] = (phi - phi0) * rRef; uv[vi * 2 + 1] = row.s; }
      wear[vi] = Math.min(1, row.w * wmod);
    }
  }
  const idx = [];
  for (let k = 0; k < R - 1; k++) {
    if (rows[k + 1].split) continue;
    for (let j = 0; j < segs; j++) {
      const a = k * cols + j, b = a + cols, c = a + 1, d = b + 1;
      idx.push(a, b, c, b, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('wear', new THREE.BufferAttribute(wear, 1));
  g.setAttribute('tangent', new THREE.BufferAttribute(tan, 4));
  g.setIndex(idx);
  return g;
}

/** Remap a band's v (0‥1) into row `row` of an 8-row atlas. */
export function atlasRow(g, row, rows = 8) {
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - (row + 1) / rows + uv.getY(i) / rows);
  return g;
}

/** Map UVs of a planar decal geometry (0‥1) into an atlas rect. */
export function decalUV(g, rect) {
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, lerp(rect.u0, rect.u1, uv.getX(i)), lerp(rect.v0, rect.v1, uv.getY(i)));
  return g;
}


export function rrPath(x0, y0, x1, y1, r, path = new THREE.Shape()) {
  r = Math.max(0, Math.min(r, (x1 - x0) / 2 - 1e-3, (y1 - y0) / 2 - 1e-3));
  if (r < 1e-3) { path.moveTo(x0, y0); path.lineTo(x1, y0); path.lineTo(x1, y1); path.lineTo(x0, y1); path.lineTo(x0, y0); return path; }
  path.moveTo(x0 + r, y0);
  path.lineTo(x1 - r, y0); path.absarc(x1 - r, y0 + r, r, -Math.PI / 2, 0, false);
  path.lineTo(x1, y1 - r); path.absarc(x1 - r, y1 - r, r, 0, Math.PI / 2, false);
  path.lineTo(x0 + r, y1); path.absarc(x0 + r, y1 - r, r, Math.PI / 2, Math.PI, false);
  path.lineTo(x0, y0 + r); path.absarc(x0 + r, y0 + r, r, Math.PI, Math.PI * 1.5, false);
  return path;
}

export function rrPoly(x0, y0, x1, y1, r, step = 2) {
  const pts = [], add = (x, y) => pts.push([x, y]);
  const edge = (ax, ay, bx, by) => { const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / step)); for (let i = 0; i < n; i++) add(lerp(ax, bx, i / n), lerp(ay, by, i / n)); };
  const arc = (cx, cy, a0) => { for (let i = 0; i < 8; i++) { const a = a0 + (i / 8) * (Math.PI / 2); add(cx + r * Math.cos(a), cy + r * Math.sin(a)); } };
  edge(x0 + r, y0, x1 - r, y0); arc(x1 - r, y0 + r, -Math.PI / 2);
  edge(x1, y0 + r, x1, y1 - r); arc(x1 - r, y1 - r, 0);
  edge(x1 - r, y1, x0 + r, y1); arc(x0 + r, y1 - r, Math.PI / 2);
  edge(x0, y1 - r, x0, y0 + r); arc(x0 + r, y0 + r, Math.PI);
  return pts;
}

export function pointInPoly(x, y, poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

/** Cut a circle out of a polygon outline: a notch if it crosses the boundary, else a hole. */
export function carve(poly, cx, cy, R, holes) {
  const ins = poly.map(([x, y]) => (x - cx) ** 2 + (y - cy) ** 2 < R * R);
  if (!ins.some(Boolean)) {
    if (pointInPoly(cx, cy, poly)) holes.push([cx, cy, R]);
    return poly;
  }
  const n = poly.length;
  let start = ins.findIndex((v, i) => !v && ins[(i + 1) % n]);
  const out = [];
  const hit = (a, b) => {
    const dx = b[0] - a[0], dy = b[1] - a[1], fx = a[0] - cx, fy = a[1] - cy;
    const A = dx * dx + dy * dy, B = 2 * (fx * dx + fy * dy), C = fx * fx + fy * fy - R * R;
    const disc = Math.sqrt(Math.max(0, B * B - 4 * A * C));
    let t = (-B - disc) / (2 * A); if (t < 0 || t > 1) t = (-B + disc) / (2 * A);
    t = Math.min(1, Math.max(0, t));
    return [a[0] + dx * t, a[1] + dy * t];
  };
  for (let s = 0; s < n; s++) {
    const i = (start + 1 + s) % n, prev = (i - 1 + n) % n;
    if (!ins[i] && !ins[prev]) { out.push(poly[i]); continue; }
    if (ins[i] && !ins[prev]) {
      const p0 = hit(poly[prev], poly[i]);
      let k = i; while (ins[k]) k = (k + 1) % n;
      const p1 = hit(poly[(k - 1 + n) % n], poly[k]);
      let a0 = Math.atan2(p0[1] - cy, p0[0] - cx), a1 = Math.atan2(p1[1] - cy, p1[0] - cx);
      // choose the arc direction that runs inside the outline
      let d = a1 - a0; while (d <= -Math.PI) d += TAU; while (d > Math.PI) d -= TAU;
      const mid = a0 + d / 2;
      if (!pointInPoly(cx + R * Math.cos(mid), cy + R * Math.sin(mid), poly)) d = d > 0 ? d - TAU : d + TAU;
      out.push(p0);
      const steps = Math.max(2, Math.ceil(Math.abs(d) / (6 * DEG)));
      for (let q = 1; q < steps; q++) { const a = a0 + (d * q) / steps; out.push([cx + R * Math.cos(a), cy + R * Math.sin(a)]); }
      out.push(p1);
      s += (k - i + n) % n - 1;
      out.push(poly[k]);
      s++;
    }
  }
  return out;
}

export function shapeFrom(poly, holes = [], flipX = false) {
  const f = flipX ? -1 : 1;
  const sh = new THREE.Shape(poly.map(([x, y]) => new THREE.Vector2(x * f, y)));
  holes.forEach(([x, y, r]) => { const p = new THREE.Path(); p.absarc(x * f, y, r, 0, TAU, true); sh.holes.push(p); });
  return sh;
}

/** Bevelled plate from a shape, spanning z ∈ [0, t], UVs in mm, smooth bevels. */
/**
 * Bevelled plate from a shape, spanning z ∈ [0, t]: quarter-rounds of radius b (or asymmetric [bBot, bTop]
 * for deep-drawn stamped brass top/bottom plates!) run around every contour with analytic normals, flat caps,
 * UVs in mm, and `wear` on the rounded edges. Indexed.
 */
export function slab(shape, t, b = 0.3, cs = 12, wear = 0, bs = 2) {
  let b0 = Array.isArray(b) ? b[0] : b;
  let b1 = Array.isArray(b) ? b[1] : b;
  b0 = Math.max(0, b0); b1 = Math.max(0, b1);
  if (b0 + b1 > t - 0.04) { const sc = Math.max(0, (t - 0.04) / Math.max(1e-6, b0 + b1)); b0 *= sc; b1 *= sc; }
  if (b0 < 0.02) b0 = 0;
  if (b1 < 0.02) b1 = 0;
  const ex = shape.extractPoints(cs);
  const clean = (pts) => {
    const o = [];
    for (const p of pts) { const q = o[o.length - 1]; if (!q || Math.abs(p.x - q.x) + Math.abs(p.y - q.y) > 1e-4) o.push(p); }
    if (o.length > 2 && Math.abs(o[0].x - o[o.length - 1].x) + Math.abs(o[0].y - o[o.length - 1].y) < 1e-4) o.pop();
    return o;
  };
  const outer = clean(ex.shape);
  if (THREE.ShapeUtils.isClockWise(outer)) outer.reverse();
  const holes = ex.holes.map(clean).map((h) => (THREE.ShapeUtils.isClockWise(h) ? h : h.reverse()));
  const rows = [];                                   // [offset, z, nr, nz, wearFactor]
  if (b0 > 0) {
    for (let k = 0; k <= bs; k++) { const th = -Math.PI / 2 + (k / bs) * (Math.PI / 2); rows.push([-b0 + b0 * Math.cos(th), b0 + b0 * Math.sin(th), Math.cos(th), Math.sin(th), Math.sin(2 * Math.abs(th))]); }
  } else rows.push([0, 0, 1, 0, 0]);
  if (b1 > 0) {
    for (let k = 0; k <= bs; k++) { const th = (k / bs) * (Math.PI / 2); rows.push([-b1 + b1 * Math.cos(th), t - b1 + b1 * Math.sin(th), Math.cos(th), Math.sin(th), Math.sin(2 * th)]); }
  } else rows.push([0, t, 1, 0, 0]);
  const R = rows.length;
  const pos = [], nor = [], uv = [], wr = [], idx = [];
  const contour = (pts) => {
    const n = pts.length, cols = [];
    const en = [];
    for (let i = 0; i < n; i++) { const a = pts[i], c = pts[(i + 1) % n], dx = c.x - a.x, dy = c.y - a.y, l = Math.hypot(dx, dy) || 1; en.push([dy / l, -dx / l, l]); }
    let s = 0;
    for (let i = 0; i < n; i++) {
      const np = en[(i - 1 + n) % n], nn = en[i];
      let mx = np[0] + nn[0], my = np[1] + nn[1];
      const ml = Math.hypot(mx, my) || 1; mx /= ml; my /= ml;
      const miter = 1 / Math.max(0.35, mx * np[0] + my * np[1]);
      const sharp = np[0] * nn[0] + np[1] * nn[1] < 0.64;
      const normals = sharp ? [np, nn] : [[mx, my]];
      normals.forEach((nv, j) => cols.push({ x: pts[i].x, y: pts[i].y, mx: mx * miter, my: my * miter, nx: nv[0], ny: nv[1], s, seam: sharp && j === 1 }));
      s += nn[2];
    }
    cols.push({ ...cols[0], s, seam: false, close: true });
    const base = pos.length / 3;
    cols.forEach((c) => rows.forEach(([o, z, cr, sz, wf]) => {
      pos.push(c.x + c.mx * o, c.y + c.my * o, z);
      const l = Math.hypot(c.nx * cr, c.ny * cr, sz) || 1;
      nor.push((c.nx * cr) / l, (c.ny * cr) / l, sz / l);
      uv.push(c.s, z);
      wr.push(wear * wf);
    }));
    for (let i = 0; i < cols.length - 1; i++) {
      if (cols[i + 1].seam) continue;
      for (let k = 0; k < R - 1; k++) {
        const a = base + i * R + k, bq = base + (i + 1) * R + k, c = a + 1, d = bq + 1;
        idx.push(a, bq, c, bq, d, c);
      }
    }
    const offBot = rows[0][0], offTop = rows[R - 1][0];
    const bot = [], top = [];
    cols.forEach((c) => {
      if (!c.seam && !c.close) {
        bot.push(new THREE.Vector2(c.x + c.mx * offBot, c.y + c.my * offBot));
        top.push(new THREE.Vector2(c.x + c.mx * offTop, c.y + c.my * offTop));
      }
    });
    return { bot, top };
  };
  const o2 = contour(outer), h2 = holes.map(contour);
  // caps (independent bottom/top triangulation to support asymmetric stamped brass bevels!)
  const cap = (z, up, outPts, holePts) => {
    const faces = THREE.ShapeUtils.triangulateShape(outPts, holePts);
    const all = [outPts, ...holePts].flat();
    const base = pos.length / 3;
    all.forEach((p) => { pos.push(p.x, p.y, z); nor.push(0, 0, up ? 1 : -1); uv.push(p.x, p.y); wr.push(0); });
    faces.forEach(([a, bq, c]) => {
      const A = all[a], B = all[bq], C = all[c], ccw = (B.x - A.x) * (C.y - A.y) - (B.y - A.y) * (C.x - A.x) > 0;
      if (ccw === up) idx.push(base + a, base + bq, base + c); else idx.push(base + a, base + c, base + bq);
    });
  };
  cap(0, false, o2.bot, h2.map((h) => h.bot));
  cap(t, true, o2.top, h2.map((h) => h.top));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('wear', new THREE.Float32BufferAttribute(wr, 1));
  g.setIndex(idx);
  return g;
}

export function screwParts(r = 1.4, cross = false) {
  const head = revolve([[r, 0, 0.3], [r, 0.22, 0.6], [r - 0.22, 0.4, 0.8], [0, 0.42, 0.2]], { segs: 20, crease: 30 });
  const slots = [rbox(r * 1.7, r * 0.26, 0.2, 0.05, 1)];
  if (cross) slots.push(rbox(r * 0.26, r * 1.7, 0.2, 0.05, 1));
  slots.forEach((s) => s.translate(0, 0, 0.36));
  return { head, slots };
}

export function addScrew(kitHead, matHead, kitSlot, matSlot, m, r = 1.4, cross = false, rot = 0) {
  const s = screwParts(r, cross);
  const mr = m.clone().multiply(new THREE.Matrix4().makeRotationZ(rot));
  kitHead.add(s.head, matHead, mr);
  s.slots.forEach((g) => kitSlot.add(g, matSlot, mr));
}

/** Rotation that maps a part built along +Z onto the radial direction at φ, at radius r, axial z. */
export function radialT(phi, r, z, extra = null) {
  const m = new THREE.Matrix4().makeTranslation(r * Math.sin(phi), r * Math.cos(phi), z)
    .multiply(new THREE.Matrix4().makeRotationZ(-phi))
    .multiply(new THREE.Matrix4().makeRotationX(-Math.PI / 2));
  if (extra) m.multiply(extra);
  return m;
}


/** Rounded-rectangle cross-section loop (starts at top centre, runs toward +x). */
export function rrLoop(hw, top, bot, r, o) {
  const pts = [], flags = [];
  const run = (x0, y0, x1, y1, n) => { for (let i = 0; i < n; i++) { const t = i / n; pts.push([lerp(x0, x1, t), lerp(y0, y1, t)]); flags.push(0); } };
  const arc = (cx, cy, a0, a1, n) => { for (let i = 0; i < n; i++) { const a = lerp(a0, a1, i / n); pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); flags.push(i === 0 ? 0.5 : 1); } };
  const xb = Math.min(o.xBreak, hw - r - 0.5);
  run(0, top, xb, top, o.nTop); run(xb, top, hw - r, top, o.nTop2);
  arc(hw - r, top - r, Math.PI / 2, 0, o.nC);
  run(hw, top - r, hw, bot + r, o.nSide);
  arc(hw - r, bot + r, 0, -Math.PI / 2, o.nC);
  run(hw - r, bot, xb, bot, o.nTop2); run(xb, bot, -xb, bot, o.nTop * 2); run(-xb, bot, -(hw - r), bot, o.nTop2);
  arc(-(hw - r), bot + r, -Math.PI / 2, -Math.PI, o.nC);
  run(-hw, bot + r, -hw, top - r, o.nSide);
  arc(-(hw - r), top - r, Math.PI, Math.PI / 2, o.nC);
  run(-(hw - r), top, -xb, top, o.nTop2); run(-xb, top, 0, top, o.nTop);
  // start the loop at the bottom centre (texture seam out of sight under the camera)
  const k0 = o.nTop + o.nTop2 + o.nC + o.nSide + o.nC + o.nTop2 + o.nTop;
  const pr = pts.slice(k0).concat(pts.slice(0, k0)), fr = flags.slice(k0).concat(flags.slice(0, k0));
  pr.push(pr[0].slice()); fr.push(fr[0]);
  return { pts: pr, flags: fr };
}

/** Loft of rounded-rect sections along z (outer skin of the body / magazine). */
export function loft(secs, o) {
  const loops = secs.map((s) => rrLoop(s.hw, s.top, s.bot, s.r, o));
  const N = loops[0].pts.length, K = secs.length;
  const pos = new Float32Array(N * K * 3), uv = new Float32Array(N * K * 2), wear = new Float32Array(N * K), idx = [];
  secs.forEach((s, k) => {
    let acc = 0;
    const L = loops[k].pts;
    L.forEach(([x, y], i) => {
      if (i) acc += Math.hypot(x - L[i - 1][0], y - L[i - 1][1]);
      const vi = k * N + i;
      pos[vi * 3] = x; pos[vi * 3 + 1] = y; pos[vi * 3 + 2] = s.z;
      uv[vi * 2] = acc; uv[vi * 2 + 1] = s.z;
      wear[vi] = Math.max(loops[k].flags[i] * (o.edgeWear ?? 0.8), s.wear || 0);
    });
  });
  for (let k = 0; k < K - 1; k++) for (let i = 0; i < N - 1; i++) {
    if (o.skip && o.skip(loops[k].pts[i], loops[k].pts[i + 1], secs[k].z, secs[k + 1].z)) continue;
    const a = k * N + i, b = (k + 1) * N + i, c = a + 1, d = b + 1;
    idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('wear', new THREE.BufferAttribute(wear, 1));
  g.setIndex(idx);
  g.computeVertexNormals();
  const nr = g.attributes.normal;
  for (let k = 0; k < K; k++) {
    const a = k * N, b = k * N + N - 1;
    const x = nr.getX(a) + nr.getX(b), y = nr.getY(a) + nr.getY(b), z = nr.getZ(a) + nr.getZ(b), l = Math.hypot(x, y, z) || 1;
    nr.setXYZ(a, x / l, y / l, z / l); nr.setXYZ(b, x / l, y / l, z / l);
  }
  return { geo: g, loops };
}

/** Flat cap from a loop outline (+ holes), facing +z (or −z with front = true). */
export function capFromLoop(loop, holes, front) {
  const f = front ? -1 : 1;
  const sh = new THREE.Shape(loop.slice(0, -1).map(([x, y]) => new THREE.Vector2(x * f, y)));
  holes.forEach((h) => sh.holes.push(h(f)));
  const g = new THREE.ShapeGeometry(sh, 24);
  if (front) g.rotateY(Math.PI);
  return g;
}


/** Solid section faces for the cutaway: polygons in (z, y) lying in the plane x = 0,
 *  one mesh facing +X and one facing −X (shown for the matching cut side). */
export function sectionPair(polys, mat, holes = []) {
  const shapes = polys.map((poly, i) => {
    const sh = new THREE.Shape(poly.map(([z, y]) => new THREE.Vector2(z, y)));
    (holes[i] || []).forEach((h) => sh.holes.push(new THREE.Path(h.map(([z, y]) => new THREE.Vector2(z, y)))));
    return sh;
  });
  const base = new THREE.ShapeGeometry(shapes, 8);
  const pos = base.clone(), neg = base.clone();
  // shape (u = z, v = y): +X side needs u = −z before rotating, −X side uses u = z
  pos.scale(-1, 1, 1); pos.rotateY(Math.PI / 2);
  { const idx = pos.index.array; for (let i = 0; i < idx.length; i += 3) { const t = idx[i]; idx[i] = idx[i + 1]; idx[i + 1] = t; } }
  neg.rotateY(-Math.PI / 2);
  pos.computeVertexNormals(); neg.computeVertexNormals();
  const g = new THREE.Group();
  const mp = new THREE.Mesh(prep(pos), mat), mn = new THREE.Mesh(prep(neg), mat);
  mp.position.x = 0.03; mn.position.x = -0.03;
  mp.userData.cutSide = 1; mn.userData.cutSide = -1;
  mp.userData.noShadow = mn.userData.noShadow = true;
  mp.visible = mn.visible = false;
  g.add(mp, mn);
  g.userData.sections = [mp, mn];
  return g;
}

/** Offset a polyline [[z, y], …] by d along its left normal. */
export function offsetLine(pts, d) {
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const tz = b[0] - a[0], ty = b[1] - a[1], l = Math.hypot(tz, ty) || 1;
    return [p[0] - (ty / l) * d, p[1] + (tz / l) * d];
  });
}
