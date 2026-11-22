// The dark cloth: a black focusing cloth for the Intrepid (SPEC.md, "The dark cloth and the
// loupe"). It is draped once, by a small position-based cloth simulation, in two arrangements over the rear standard:
//   folded  folded in half and laid over the back between looks: over the frame's top and the bellows, the rest hanging
//           down behind the glass and at the sides, clear of the tripod's legs at any pan (they start 600 mm below the
//           frame; the cloth stops above 450)
//   over    open, over the photographer's head and shoulders while looking in: a tent from the rear standard to the
//           head, the sides falling round, open underneath as a real one is
// The page shows a blend of the two as you go under it and come out (set()), and lays it on or lifts it off (on()).
// Its coordinates are the rear standard's (frameG), in mm, gravity down its −Y: it tilts with the rear standard.
import * as THREE from 'three';

// the cloth: 900 × 1140 mm (about 36 × 45 in, a common size), a node every 30 mm; folded, half that length
const H = 30, NX = 31, NY = 39, NY_FOLD = 20;

// ───────── Colliders: signed distance and outward normal, in mm; R bounds the shape (a quick reject) ─────────
function roundBox(cx, cy, cz, hx, hy, hz, r) {
  return {
    cx, cy, cz, R: Math.sqrt(hx * hx + hy * hy + hz * hz),
    sd(x, y, z, n) {
      const dx = x - cx, dy = y - cy, dz = z - cz;
      const qx = Math.abs(dx) - hx + r, qy = Math.abs(dy) - hy + r, qz = Math.abs(dz) - hz + r;
      const mx = qx > 0 ? qx : 0, my = qy > 0 ? qy : 0, mz = qz > 0 ? qz : 0, L = Math.sqrt(mx * mx + my * my + mz * mz);
      if (L > 0) { n[0] = Math.sign(dx) * mx / L; n[1] = Math.sign(dy) * my / L; n[2] = Math.sign(dz) * mz / L; return L - r; }
      if (qx >= qy && qx >= qz) { n[0] = Math.sign(dx); n[1] = 0; n[2] = 0; return qx - r; }
      if (qy >= qz) { n[0] = 0; n[1] = Math.sign(dy); n[2] = 0; return qy - r; }
      n[0] = 0; n[1] = 0; n[2] = Math.sign(dz); return qz - r;
    },
  };
}
function ellipsoid(cx, cy, cz, rx, ry, rz) {
  return {
    cx, cy, cz, R: Math.max(rx, ry, rz),
    sd(x, y, z, n) {
      const px = (x - cx) / rx, py = (y - cy) / ry, pz = (z - cz) / rz;
      const k0 = Math.sqrt(px * px + py * py + pz * pz), gx = px / rx, gy = py / ry, gz = pz / rz, k1 = Math.sqrt(gx * gx + gy * gy + gz * gz) || 1;
      n[0] = gx / k1; n[1] = gy / k1; n[2] = gz / k1;
      return (k0 * (k0 - 1)) / k1;
    },
  };
}
function capsule(ax, ay, az, bx, by, bz, r) {
  const ux = bx - ax, uy = by - ay, uz = bz - az, uu = ux * ux + uy * uy + uz * uz;
  return {
    cx: (ax + bx) / 2, cy: (ay + by) / 2, cz: (az + bz) / 2, R: Math.sqrt(uu) / 2 + r,
    sd(x, y, z, n) {
      let t = ((x - ax) * ux + (y - ay) * uy + (z - az) * uz) / uu; t = t < 0 ? 0 : t > 1 ? 1 : t;
      const dx = x - ax - t * ux, dy = y - ay - t * uy, dz = z - az - t * uz, L = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
      n[0] = dx / L; n[1] = dy / L; n[2] = dz / L;
      return L - r;
    },
  };
}

/** The camera as the cloth meets it (frameG mm; from the model's DIM): the rear frame and back, the bellows in front
 *  of it, the arms and side plates, the base plate, the head's handle knob behind; looking in, a head and shoulders
 *  (the eye 260 mm behind the glass, inside the head). */
function colliders(D, over) {
  const fr = D.frame, B = D.base, armX = D.arm.x + D.arm.t + D.arm.knob.len + 2;
  const list = [
    // (rounded well past the wood's own 3.5 mm: a node every 30 mm folds over a sharp edge in a kink, and the flat
    //  triangles each side of it cut the corner — the frame's corner and the level showed through)
    roundBox(0, (fr.yT + 6 + B.y1) / 2, -6, armX + 3, (fr.yT + 6 - B.y1) / 2 + 3, 22, 18),         // frame and back: z −28 … +16
    roundBox(0, -5, -110, 82, 84, 88, 22),                                                        // the bellows
    roundBox(0, -85, -45, armX - 4, 42, 26, 6),                                                   // the arms, the side plates
    roundBox(0, (B.y0 + B.y1) / 2, (B.zF + B.zB) / 2, B.wB / 2, 2, (B.zB - B.zF) / 2, 2),        // the base plate
    ellipsoid(76, -250, 56, 22, 22, 22),                                                          // the head's handle knob
  ];
  if (over) list.push(
    ellipsoid(0, 25, 345, 78, 112, 100),                                                          // the head
    capsule(0, -90, 352, 0, -10, 345, 52),                                                        // the neck
    capsule(-185, -178, 362, 185, -178, 362, 66),                                                 // the shoulders
  );
  return list;
}

/** Drape a sheet nx × ny (spacing H), laid flat at height y0 from z0 back, centred across: position-based dynamics
 *  (Müller et al. 2007) — stretch, shear and a soft bend, gravity, damping, colliders with friction. A generator: it
 *  yields every few steps (the page spreads the work over idle frames) and returns the positions. */
function* drape(nx, ny, y0, z0, cols, thick) {
  const n = nx * ny, P = new Float32Array(n * 3), Q = new Float32Array(n * 3);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const k = (j * nx + i) * 3;
    P[k] = (i - (nx - 1) / 2) * H; P[k + 1] = y0 + 0.002 * ((i * 7 + j * 13) % 5); P[k + 2] = z0 + j * H;
  }
  Q.set(P);
  const pairs = [], rest = [], stiff = [];
  const link = (a, b, s) => {
    const ka = a * 3, kb = b * 3, dx = P[kb] - P[ka], dy = P[kb + 1] - P[ka + 1], dz = P[kb + 2] - P[ka + 2];
    pairs.push(ka, kb); rest.push(Math.sqrt(dx * dx + dy * dy + dz * dz)); stiff.push(s * 0.5);
  };
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const a = j * nx + i;
    if (i + 1 < nx) link(a, a + 1, 1);
    if (j + 1 < ny) link(a, a + nx, 1);
    if (i + 1 < nx && j + 1 < ny) { link(a, a + nx + 1, 0.8); link(a + 1, a + nx, 0.8); }
    if (i + 2 < nx) link(a, a + 2, 0.06);
    if (j + 2 < ny) link(a, a + 2 * nx, 0.06);
  }
  const PR = Int32Array.from(pairs), RL = Float32Array.from(rest), ST = Float32Array.from(stiff), nc = RL.length;
  const nrm = [0, 0, 0], contact = new Float32Array(n * 3), depth = new Float32Array(n);
  const g = -9810 * (1 / 80) ** 2, damp = 0.98, muS = 0.9, muK = 0.6;
  for (let step = 0; step < 300; step++) {
    for (let k = 0; k < n * 3; k += 3) {
      const vx = (P[k] - Q[k]) * damp, vy = (P[k + 1] - Q[k + 1]) * damp, vz = (P[k + 2] - Q[k + 2]) * damp;
      Q[k] = P[k]; Q[k + 1] = P[k + 1]; Q[k + 2] = P[k + 2];
      P[k] += vx; P[k + 1] += vy + g; P[k + 2] += vz;
    }
    depth.fill(0);
    for (let it = 0; it < 8; it++) {
      for (let c = 0; c < nc; c++) {
        const ka = PR[c * 2], kb = PR[c * 2 + 1];
        const dx = P[kb] - P[ka], dy = P[kb + 1] - P[ka + 1], dz = P[kb + 2] - P[ka + 2], L = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
        const f = ((L - RL[c]) / L) * ST[c];
        P[ka] += dx * f; P[ka + 1] += dy * f; P[ka + 2] += dz * f;
        P[kb] -= dx * f; P[kb + 1] -= dy * f; P[kb + 2] -= dz * f;
      }
      for (let p = 0; p < n; p++) {
        const k = p * 3;
        for (let q = 0; q < cols.length; q++) {
          const o = cols[q], ex = P[k] - o.cx, ey = P[k + 1] - o.cy, ez = P[k + 2] - o.cz, lim = o.R + thick;
          if (ex * ex + ey * ey + ez * ez > lim * lim) continue;
          const d = o.sd(P[k], P[k + 1], P[k + 2], nrm);
          if (d < thick) {
            const push = thick - d;
            P[k] += nrm[0] * push; P[k + 1] += nrm[1] * push; P[k + 2] += nrm[2] * push;
            contact[k] = nrm[0]; contact[k + 1] = nrm[1]; contact[k + 2] = nrm[2]; depth[p] += push;
          }
        }
      }
    }
    // Coulomb friction (Macklin et al. 2014): a contact's slide this step is cancelled while it is less than μs times
    // how far the surface pushed back, and cut by μk times that beyond it (cloth catches on what it lies on)
    for (let p = 0; p < n; p++) {
      if (!depth[p]) continue;
      const k = p * 3, vx = P[k] - Q[k], vy = P[k + 1] - Q[k + 1], vz = P[k + 2] - Q[k + 2];
      const vn = vx * contact[k] + vy * contact[k + 1] + vz * contact[k + 2];
      const tx = vx - vn * contact[k], ty = vy - vn * contact[k + 1], tz = vz - vn * contact[k + 2];
      const tl = Math.sqrt(tx * tx + ty * ty + tz * tz), cut = tl < muS * depth[p] ? 1 : Math.min(1, (muK * depth[p]) / tl);
      P[k] -= tx * cut; P[k + 1] -= ty * cut; P[k + 2] -= tz * cut;
    }
    if (step % 6 === 5) yield;
  }
  return P;
}

/** A sheet's vertex normals (area weighted), into N. */
function normals(P, nx, ny, N) {
  N.fill(0);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
  for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const q = [j * nx + i, j * nx + i + 1, (j + 1) * nx + i + 1, (j + 1) * nx + i];
    for (const [i0, i1, i2] of [[q[0], q[3], q[1]], [q[1], q[3], q[2]]]) {
      a.fromArray(P, i0 * 3); b.fromArray(P, i1 * 3); c.fromArray(P, i2 * 3);
      e1.subVectors(b, a); e2.subVectors(c, a); e1.cross(e2);
      for (const v of [i0, i1, i2]) { N[v * 3] += e1.x; N[v * 3 + 1] += e1.y; N[v * 3 + 2] += e1.z; }
    }
  }
  for (let v = 0; v < N.length; v += 3) { const L = Math.hypot(N[v], N[v + 1], N[v + 2]) || 1; N[v] /= L; N[v + 1] /= L; N[v + 2] /= L; }
}

/** The cloth: { mesh, on(k), set(k), update() } — mesh in frameG's mm; on 0 … 1 lays it on, set 0 … 1 goes from
 *  folded to over the head. The two drapes are made a little at a time (bakeSome, from the camera's update) or at once
 *  when wanted sooner (bake(): about half a second). */
export function createDarkCloth(D, material) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(NX * NY * 3), nor = new Float32Array(NX * NY * 3), uv = new Float32Array(NX * NY * 2);
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) { const v = j * NX + i; uv[v * 2] = i / (NX - 1); uv[v * 2 + 1] = j / (NY - 1); }
  const idx = [];
  for (let j = 0; j < NY - 1; j++) for (let i = 0; i < NX - 1; i++) {
    const a = j * NX + i, b = a + 1, c = a + NX + 1, d = a + NX;
    idx.push(a, d, b, b, d, c);
  }
  geo.setIndex(idx);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  const mesh = new THREE.Mesh(geo, material);
  mesh.name = 'darkCloth'; mesh.visible = false; mesh.frustumCulled = false;
  let folded = null, over = null, kOn = 0, kOver = 0, shown = [-1, -1], job = null, ms = 0;

  function* bakeJob() {
    // folded: the half sheet, its front edge 250 mm in front of the back, over the bellows (laid on balanced: with most
    // of it behind, the hanging part drew the rest off the top); over the head, the whole sheet from the same edge
    const half = yield* drape(NX, NY_FOLD, D.frame.yT + 30, -250, colliders(D, false), 9);
    const full = yield* drape(NX, NY, D.frame.yT + 70, -250, colliders(D, true), 5);
    // the whole sheet folded: rows 0 … 19 the top layer as draped; rows 20 … 38 the layer under it, folded back at the
    // hanging edge, 3.5 mm in toward the camera
    const hn = new Float32Array(NX * NY_FOLD * 3); normals(half, NX, NY_FOLD, hn);
    const cx = 0, cy = -15, cz = -40;
    const fold = new Float32Array(NX * NY * 3);
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
      const src = (j < NY_FOLD ? j : 2 * NY_FOLD - 1 - j) * NX + i, k = src * 3, o = (j * NX + i) * 3;
      let nx = hn[k], ny = hn[k + 1], nz = hn[k + 2];
      if (nx * (half[k] - cx) + ny * (half[k + 1] - cy) + nz * (half[k + 2] - cz) < 0) { nx = -nx; ny = -ny; nz = -nz; }
      const inset = j < NY_FOLD ? 0 : 3.5;
      fold[o] = half[k] - nx * inset; fold[o + 1] = half[k + 1] - ny * inset; fold[o + 2] = half[k + 2] - nz * inset;
    }
    folded = fold; over = full;
    mesh.userData.bakeMs = Math.round(ms);
  }
  /** Drape it now, or (bakeSome) for up to `budget` ms of this frame: true once it is done. */
  function bakeSome(budget = Infinity) {
    if (folded) return true;
    job ||= bakeJob();
    const t0 = performance.now();
    let done = false;
    while (!done && performance.now() - t0 < budget) done = job.next().done;
    ms += performance.now() - t0;
    return done;
  }
  const bake = () => bakeSome();

  function update() {
    if (kOn <= 0.001) { mesh.visible = false; return; }
    bake();
    if (shown[0] === kOn && shown[1] === kOver) return;
    shown = [kOn, kOver];
    mesh.visible = true;
    // (laid on from above and a little behind: lifted off, it rises and draws back)
    const s = kOver * kOver * (3 - 2 * kOver), lift = 260 * (1 - kOn) ** 2, back = 120 * (1 - kOn) ** 2;
    for (let v = 0; v < NX * NY * 3; v += 3) {
      pos[v] = folded[v] + (over[v] - folded[v]) * s;
      pos[v + 1] = folded[v + 1] + (over[v + 1] - folded[v + 1]) * s + lift;
      pos[v + 2] = folded[v + 2] + (over[v + 2] - folded[v + 2]) * s + back;
    }
    normals(pos, NX, NY, nor);
    geo.attributes.position.needsUpdate = true; geo.attributes.normal.needsUpdate = true;
    geo.computeBoundingSphere();
  }

  return {
    mesh, bake, bakeSome, update,
    get ready() { return !!folded; },
    on(k) { kOn = k; },
    set(k) { kOver = k; },
    get kOn() { return kOn; },
    get kOver() { return kOver; },
  };
}
