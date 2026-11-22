// The Intrepid 4×5's bellows, as a pleat-ring rig (docs/PLAYBOOK.md): a tapered
// bellows of N pleats between the rear standard's frame and the front standard's, which keeps its cloth as the standards
// move. Each half-pleat is a strip of cloth `fold` mm wide, so where the two frames are s apart along the bellows per
// half-pleat, the pleat stands d = √(fold² − s²) proud: deep and close together when the bellows is racked in, nearly
// flat when it is racked out to its 300 mm. With a tilt or swing, s and so d vary round the bellows (pinched on one
// side, opened on the other), as cloth does. The rings run straight from frame to frame, a few spaced unevenly (no
// bellows is folded quite evenly), and the bellows sags a little in the middle when it is long.
//
// Units: millimetres. The frames are given as matrices placing each frame's rectangle (centred, in its local XY, its
// opening facing along local −Z) in the bellows' parent space.
import * as THREE from 'three';

/** A rounded rectangle's outline, w × h with corners r: points, outward normals, and which way each point's side
 *  runs (0 on the top and bottom, 1 on the left and right, between round a corner), anticlockwise from the middle of
 *  the right side; every outline made with the same (S, C) has the same count, point for point. */
function outline(w, h, r, S, C) {
  const pts = [], nrm = [], vert = [], hw = w / 2, hh = h / 2;
  const side = (x0, y0, x1, y1, nx, ny) => { for (let i = 0; i < S; i++) { const t = i / S; pts.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t]); nrm.push([nx, ny]); vert.push(Math.abs(nx)); } };
  const arc = (cx, cy, a0) => { for (let i = 0; i < C; i++) { const a = a0 + (i / C) * (Math.PI / 2); pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); nrm.push([Math.cos(a), Math.sin(a)]); vert.push(Math.cos(a) ** 2); } };
  side(hw, 0, hw, hh - r, 1, 0); arc(hw - r, hh - r, 0);
  side(hw - r, hh, -(hw - r), hh, 0, 1); arc(-(hw - r), hh - r, Math.PI / 2);
  side(-hw, hh - r, -hw, -(hh - r), -1, 0); arc(-(hw - r), -(hh - r), Math.PI);
  side(-(hw - r), -hh, hw - r, -hh, 0, -1); arc(hw - r, -(hh - r), 1.5 * Math.PI);
  side(hw, -(hh - r), hw, 0, 1, 0);
  // (the last side's half: the first point was the side's middle, so the loop starts and ends there)
  return { pts: pts.slice(0, pts.length), nrm, vert };
}

/**
 * front, rear: { w, h, r } the bellows' ends (outer size at the frames); pleats: ridges; fold: a half-pleat's cloth
 * width (mm); sag: the droop at the middle, mm, at full extension. Returns { mesh, update(rearMatrix, frontMatrix) }.
 */
export function createBellows({ front, rear, pleats = 22, fold = 7.2, sag = 1.2, maxExt = 300, material, seed = 7 }) {
  const S = 8, C = 7;
  const R0 = outline(rear.w, rear.h, rear.r, S, C), F0 = outline(front.w, front.h, front.r, S, C);
  const M = R0.pts.length, K = 2 * pleats;
  // the rings' places along the bellows, 0 (rear) → 1 (front): even, then nudged a little, the ends fixed
  let a = seed >>> 0;
  const rnd = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const tk = [];
  for (let k = 0; k <= K; k++) tk.push(k === 0 || k === K ? k / K : (k + (rnd() - 0.5) * 0.35) / K);
  // a band of cloth between each pair of rings, with its own rows of vertices (a sharp crease at every ring)
  const cols = M + 1, nV = K * 2 * cols;
  const pos = new Float32Array(nV * 3), uv = new Float32Array(nV * 2), idx = [];
  for (let b = 0; b < K; b++) {
    for (let r = 0; r < 2; r++) for (let j = 0; j < cols; j++) { const v = (b * 2 + r) * cols + j; uv[v * 2] = j / M; uv[v * 2 + 1] = (b + r) / K; }
    for (let j = 0; j < M; j++) {
      const v0 = b * 2 * cols + j, v1 = v0 + cols;
      idx.push(v0, v0 + 1, v1, v1, v0 + 1, v1 + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(idx);
  const mesh = new THREE.Mesh(geo, material);
  mesh.frustumCulled = false;

  const vR = new THREE.Vector3(), vF = new THREE.Vector3(), nR = new THREE.Vector3(), nF = new THREE.Vector3(), p = new THREE.Vector3(), n = new THREE.Vector3();
  const qR = new THREE.Quaternion(), qF = new THREE.Quaternion(), sc = new THREE.Vector3(), down = new THREE.Vector3(0, -1, 0);
  const ring = Array.from({ length: K + 1 }, () => new Float32Array(cols * 3));
  // (the fan: the line the two frames' planes meet on, and each point about it)
  const zR = new THREE.Vector3(), zF = new THREE.Vector3(), cR = new THREE.Vector3(), cF = new THREE.Vector3(), ax = new THREE.Vector3(), hinge = new THREE.Vector3();
  const rhoR = new THREE.Vector3(), rhoF = new THREE.Vector3(), dir = new THREE.Vector3(), q = new THREE.Quaternion(), pf = new THREE.Vector3(), cr = new THREE.Vector3();
  return {
    mesh,
    /** Place the bellows between the two frames (matrices in the mesh's parent space). fan (0–1): where the frames
     *  stand at an angle (a camera being folded or set up) the rings fan out about the line their planes meet on, as
     *  an accordion opened on one side does, instead of running straight across. */
    update(rearM, frontM, fan = 0) {
      rearM.decompose(cR, qR, sc); frontM.decompose(cF, qF, sc);
      let w = 0;
      if (fan > 0) {
        zR.set(0, 0, 1).applyQuaternion(qR); zF.set(0, 0, 1).applyQuaternion(qF);
        const c = Math.min(1, Math.max(-1, zR.dot(zF)));
        ax.crossVectors(zR, zF);
        const sn = ax.length(), ang = Math.atan2(sn, Math.abs(c));
        w = fan * THREE.MathUtils.smoothstep(ang, 0.07, 0.21);
        if (w > 0) {
          ax.divideScalar(sn);
          const dR = zR.dot(cR), dF = zF.dot(cF), den = 1 - c * c;
          hinge.copy(zR).multiplyScalar((dR - dF * c) / den).addScaledVector(zF, (dF - dR * c) / den);
        }
      }
      let len = 0;
      for (let j = 0; j < M; j++) {
        vR.set(R0.pts[j][0], R0.pts[j][1], 0).applyMatrix4(rearM);
        vF.set(F0.pts[j][0], F0.pts[j][1], 0).applyMatrix4(frontM);
        nR.set(R0.nrm[j][0], R0.nrm[j][1], 0).applyQuaternion(qR);
        nF.set(F0.nrm[j][0], F0.nrm[j][1], 0).applyQuaternion(qF);
        let L = vR.distanceTo(vF);
        // (fanned: each point's distance along the hinge, its radius from it and its angle about it, from the rear's
        //  to the front's; the cloth's length the arc's)
        let xR = 0, xF = 0, rR = 0, rF = 0, phi = 0;
        if (w > 0) {
          rhoR.subVectors(vR, hinge); xR = rhoR.dot(ax); rhoR.addScaledVector(ax, -xR); rR = rhoR.length();
          rhoF.subVectors(vF, hinge); xF = rhoF.dot(ax); rhoF.addScaledVector(ax, -xF); rF = rhoF.length();
          phi = Math.atan2(cr.crossVectors(rhoR, rhoF).dot(ax), rhoR.dot(rhoF));
          rhoR.divideScalar(Math.max(rR, 1e-6));
          L += (Math.hypot(xF - xR, rF - rR, 0.5 * (rR + rF) * phi) - L) * w;
        }
        len += L / M;
        // the pleats' depth here: the cloth's half-pleat width against how far apart the rings are here
        const s = L / K, d = Math.sqrt(Math.max(0, fold * fold - s * s));
        // (a bellows' top and bottom fold half a pleat out of step with its sides: a ridge on the top meets a valley on
        // the side, and round each corner the cloth folds diagonally between them — the sawtooth along its edges)
        const v = R0.vert[j];
        for (let k = 0; k <= K; k++) {
          const t = tk[k];
          p.copy(vR).lerp(vF, t);
          n.copy(nR).lerp(nF, t).normalize();
          let dk = d;
          if (w > 0) {
            const r = rR + (rF - rR) * t;
            dir.copy(rhoR).applyQuaternion(q.setFromAxisAngle(ax, phi * t));
            pf.copy(hinge).addScaledVector(ax, xR + (xF - xR) * t).addScaledVector(dir, r);
            p.lerp(pf, w);
            // (folds turned in toward the hinge go no deeper than the cloth there is room for)
            const inward = -n.dot(dir);
            if (inward > 0.2) dk = Math.min(d, 0.6 * r / inward);
          }
          if (k > 0 && k < K) p.addScaledVector(n, dk * (k % 2 === 1 ? 1 - v : v));
          // (a little droop in the middle of a long bellows)
          p.addScaledVector(down, (1 - w) * sag * Math.sin(Math.PI * t) * Math.min(1, (L / maxExt) ** 2));
          ring[k].set([p.x, p.y, p.z], j * 3);
        }
      }
      for (let k = 0; k <= K; k++) ring[k].copyWithin(M * 3, 0, 3);
      for (let b = 0; b < K; b++) { pos.set(ring[b], b * 2 * cols * 3); pos.set(ring[b + 1], (b * 2 + 1) * cols * 3); }
      geo.attributes.position.needsUpdate = true;
      geo.computeVertexNormals();
      geo.computeBoundingSphere();
      return len;
    },
  };
}
