// camera/lib/mesh.js — Mesh tools: geometry prep (attributes, smooth tangents), merging, and Kit — one mesh per material from many placed geometries — with foldSiblings.
// (moved verbatim from camera503.js in Phase 0: the modelling vocabulary every camera shares)
import * as THREE from 'three';

// ───────── Geometry helpers ─────────
export const KEEP = new Set(['position', 'normal', 'uv', 'wear', 'tangent']);

export function computeSmoothTangents(g) {
  const pos = g.attributes.position.array, nor = g.attributes.normal.array, uv = g.attributes.uv.array, idx = g.index.array;
  const n = g.attributes.position.count, m = g.index.count;
  const tan = new Float32Array(n * 4);
  for (let k = 0; k < m; k += 3) {
    const i0 = idx[k], i1 = idx[k + 1], i2 = idx[k + 2];
    const p0x = pos[i0 * 3], p0y = pos[i0 * 3 + 1], p0z = pos[i0 * 3 + 2];
    const dx1 = pos[i1 * 3] - p0x, dy1 = pos[i1 * 3 + 1] - p0y, dz1 = pos[i1 * 3 + 2] - p0z;
    const dx2 = pos[i2 * 3] - p0x, dy2 = pos[i2 * 3 + 1] - p0y, dz2 = pos[i2 * 3 + 2] - p0z;
    const du1 = uv[i1 * 2] - uv[i0 * 2], dv1 = uv[i1 * 2 + 1] - uv[i0 * 2 + 1];
    const du2 = uv[i2 * 2] - uv[i0 * 2], dv2 = uv[i2 * 2 + 1] - uv[i0 * 2 + 1];
    const det = du1 * dv2 - du2 * dv1;
    if (Math.abs(det) < 1e-10) continue;
    const inv = 1 / det;
    const tx = (dv2 * dx1 - dv1 * dx2) * inv, ty = (dv2 * dy1 - dv1 * dy2) * inv, tz = (dv2 * dz1 - dv1 * dz2) * inv;
    tan[i0 * 4] += tx; tan[i0 * 4 + 1] += ty; tan[i0 * 4 + 2] += tz;
    tan[i1 * 4] += tx; tan[i1 * 4 + 1] += ty; tan[i1 * 4 + 2] += tz;
    tan[i2 * 4] += tx; tan[i2 * 4 + 1] += ty; tan[i2 * 4 + 2] += tz;
  }
  for (let i = 0; i < n; i++) {
    const nx = nor[i * 3], ny = nor[i * 3 + 1], nz = nor[i * 3 + 2];
    let tx = tan[i * 4], ty = tan[i * 4 + 1], tz = tan[i * 4 + 2];
    const dot = tx * nx + ty * ny + tz * nz;
    tx -= nx * dot; ty -= ny * dot; tz -= nz * dot;
    let l = Math.hypot(tx, ty, tz);
    if (l < 1e-5) {
      if (Math.abs(ny) < 0.9) { tx = nz; ty = 0; tz = -nx; }
      else { tx = 0; ty = -nz; tz = ny; }
      l = Math.hypot(tx, ty, tz) || 1;
    }
    tan[i * 4] = tx / l; tan[i * 4 + 1] = ty / l; tan[i * 4 + 2] = tz / l; tan[i * 4 + 3] = 1;
  }
  g.setAttribute('tangent', new THREE.BufferAttribute(tan, 4));
}

export function prep(g) {
  if (!g.index) {
    const n = g.attributes.position.count, idx = new (n > 65535 ? Uint32Array : Uint16Array)(n);
    for (let i = 0; i < n; i++) idx[i] = i;
    g.setIndex(new THREE.BufferAttribute(idx, 1));
  }
  if (!g.attributes.normal) g.computeVertexNormals();
  const n = g.attributes.position.count;
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  if (!g.attributes.wear) g.setAttribute('wear', new THREE.BufferAttribute(new Float32Array(n), 1));
  if (!g.attributes.tangent) computeSmoothTangents(g);
  for (const k of Object.keys(g.attributes)) if (!KEEP.has(k)) g.deleteAttribute(k);
  g.morphAttributes = {};
  g.clearGroups();
  return g;
}


/** Merge prepared geometries (position/normal/uv/wear/tangent + index) with typed-array copies. */
export function fastMerge(list) {
  let nv = 0, ni = 0;
  for (const g of list) { nv += g.attributes.position.count; ni += g.index.count; }
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), wr = new Float32Array(nv), tan = new Float32Array(nv * 4);
  const idx = new (nv > 65535 ? Uint32Array : Uint16Array)(ni);
  let v = 0, i = 0;
  for (const g of list) {
    const a = g.attributes, n = a.position.count;
    pos.set(a.position.array.subarray(0, n * 3), v * 3); nor.set(a.normal.array.subarray(0, n * 3), v * 3);
    uv.set(a.uv.array.subarray(0, n * 2), v * 2); wr.set(a.wear.array.subarray(0, n), v);
    if (a.tangent) tan.set(a.tangent.array.subarray(0, n * 4), v * 4);
    const src = g.index.array, m = g.index.count;
    for (let k = 0; k < m; k++) idx[i + k] = src[k] + v;
    v += n; i += m;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setAttribute('wear', new THREE.BufferAttribute(wr, 1));
  out.setAttribute('tangent', new THREE.BufferAttribute(tan, 4));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}

export const KIT_MESHES = new WeakSet();   // (meshes a Kit built: nothing moves or hides one on its own — foldSiblings may merge them)

/** Collects geometries per material and merges them into one mesh per material. */
export class Kit {
  constructor() { this.map = new Map(); }
  add(geo, mat, m) {
    prep(geo);
    if (m) geo.applyMatrix4(m);
    let l = this.map.get(mat);
    if (!l) this.map.set(mat, (l = []));
    l.push(geo);
    return this;
  }
  build(parent, part = null) {
    const out = [];
    for (const [mat, list] of this.map) {
      const geo = list.length > 1 ? fastMerge(list) : list[0];
      geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, mat);
      if (part) mesh.userData.part = part;
      parent.add(mesh);
      KIT_MESHES.add(mesh);
      out.push(mesh);
    }
    this.map.clear();
    return out;
  }
}

function remapLists(lists, into) {
  if (!into.size) return;
  for (const l of lists) if (l) {
    const kept = [...new Set(l.map((m) => into.get(m) || m))];
    l.length = 0; l.push(...kept);
  }
}

/** Several Kits built into one group leave a mesh each per material they share (a part's screws, its trim): fold those
 *  into one — a draw call less in every view. Pick lists in `lists` are rewritten to the meshes that remain. */
export function foldSiblings(root, lists = []) {
  const into = new Map();
  root.traverse((p) => {
    const sets = new Map();
    for (const o of p.children) if (KIT_MESHES.has(o)) {
      const k = `${o.material.uuid}|${o.userData.part || ''}`;
      (sets.get(k) || sets.set(k, []).get(k)).push(o);
    }
    for (const list of sets.values()) if (list.length > 1) {
      const keep = list[0];
      keep.geometry = fastMerge(list.map((o) => o.geometry));
      keep.geometry.computeBoundingSphere();
      for (const o of list.slice(1)) { p.remove(o); into.set(o, keep); }
    }
  });
  remapLists(lists, into);
  return into.size;
}

const isIdentityMatrix = (m) => {
  const e = m.elements;
  return e[0] === 1 && e[1] === 0 && e[2] === 0 && e[3] === 0 && e[4] === 0 && e[5] === 1 && e[6] === 0 && e[7] === 0
    && e[8] === 0 && e[9] === 0 && e[10] === 1 && e[11] === 0 && e[12] === 0 && e[13] === 0 && e[14] === 0 && e[15] === 1;
};

/** Merge rigid static meshes within each rigid owner (root or a node in `dynamic`) across static unreferenced
 *  descendants, baking local transforms when needed and rewriting pick lists in `lists`. */
export function mergeStaticRigid(root, { dynamic = new Set(), lists = [] } = {}) {
  root.updateMatrixWorld(true);
  const invCache = new Map();
  const invOf = (o) => {
    let m = invCache.get(o);
    if (!m) invCache.set(o, (m = o.matrixWorld.clone().invert()));
    return m;
  };
  const buckets = new Map();
  const walk = (node, owner, visRel) => {
    if (node.isMesh) {
      if (node !== root && dynamic.has(node)) return;
      if (node.isInstancedMesh || node.isSkinnedMesh || node.children.length) return;
      const g = node.geometry, a = g?.attributes;
      if (!a?.position?.count || !node.material || Array.isArray(node.material)) return;
      if (typeof node.userData.set === 'function') return;
      for (const k of Object.keys(a)) if (!KEEP.has(k)) return;
      const key = `${owner.uuid}|${node.material.uuid}|${visRel ? 1 : 0}|${node.castShadow ? 1 : 0}|${node.receiveShadow ? 1 : 0}|${node.frustumCulled ? 1 : 0}|${node.renderOrder}|${node.layers.mask}|${node.userData.part || ''}|${node.userData.pick || ''}|${node.userData.cutSide ?? ''}|${node.userData.noShadow ? 1 : 0}`;
      let list = buckets.get(key);
      if (!list) buckets.set(key, (list = []));
      list.push({ mesh: node, owner, visRel });
      return;
    }
    for (const c of node.children) {
      const nextOwner = dynamic.has(c) ? c : owner;
      const nextVis = nextOwner === c ? true : visRel && c.visible;
      walk(c, nextOwner, nextVis);
    }
  };
  walk(root, root, true);
  const into = new Map(), oldGeos = new Set();
  for (const list of buckets.values()) {
    if (list.length < 2) continue;
    const owner = list[0].owner, invOwner = invOf(owner);
    const keepEntry = list.find((e) => e.mesh.parent === owner) || list[0];
    const keep = keepEntry.mesh;
    const geos = [];
    for (const { mesh } of list) {
      oldGeos.add(mesh.geometry);
      const gc = prep(mesh.geometry.clone());
      const rel = invOwner.clone().multiply(mesh.matrixWorld);
      if (!isIdentityMatrix(rel)) {
        gc.applyMatrix4(rel);
        if (rel.determinant() < 0) {
          const ia = gc.index.array;
          for (let k = 0; k < ia.length; k += 3) { const tmp = ia[k + 1]; ia[k + 1] = ia[k + 2]; ia[k + 2] = tmp; }
        }
      }
      geos.push(gc);
    }
    keep.geometry = fastMerge(geos);
    keep.geometry.computeBoundingSphere();
    keep.visible = keepEntry.visRel;
    if (keep.parent !== owner) {
      keep.parent?.remove(keep);
      owner.add(keep);
    }
    keep.position.set(0, 0, 0); keep.rotation.set(0, 0, 0); keep.scale.set(1, 1, 1); keep.updateMatrix();
    for (const { mesh } of list) {
      if (mesh === keep) continue;
      mesh.parent?.remove(mesh);
      into.set(mesh, keep);
    }
  }
  if (into.size) {
    const alive = new Set();
    root.traverse((o) => { if (o.isMesh && o.geometry) alive.add(o.geometry); });
    for (const g of oldGeos) if (!alive.has(g)) g.dispose();
    const prune = (node) => {
      for (const c of [...node.children]) prune(c);
      if (node !== root && node.isGroup && !node.name && !dynamic.has(node) && node.children.length === 0 && !Object.keys(node.userData).length) {
        node.parent?.remove(node);
      }
    };
    prune(root);
    remapLists(lists, into);
  }
  return into.size;
}
