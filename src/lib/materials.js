// camera/lib/materials.js — The material vocabulary: base PBR materials, edge wear and hover glow patched into the shaders, and the lens-glass trace (a CF lens's coated front element).
// (moved verbatim from camera503.js in Phase 0: the modelling vocabulary every camera shares)
import * as THREE from 'three';
import { decalAtlas } from './decals.js';
import { brushedMap, carbonMaps, cfGripMaps, knurlMap, leatherMaps, waffleMaps } from './textures.js';
import { T } from './util.js';

// ───────── Materials ─────────
export const NOISE_GLSL = /* glsl */`
float gwHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float gwNoise(vec3 x) {
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(gwHash(i), gwHash(i + vec3(1, 0, 0)), f.x), mix(gwHash(i + vec3(0, 1, 0)), gwHash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(gwHash(i + vec3(0, 0, 1)), gwHash(i + vec3(1, 0, 1)), f.x), mix(gwHash(i + vec3(0, 1, 1)), gwHash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float gwWear(float lo) {
  float n = gwNoise(vObjPos * 0.7) * 0.62 + gwNoise(vObjPos * 3.1) * 0.3 + gwNoise(vObjPos * 13.0) * 0.08;
  return smoothstep(lo, 1.0, vWear) * smoothstep(0.7, 0.86, n);
}`;

export const WEAR_GLSL = {
  // handled satin chrome: edges polished brighter
  chrome: 'float gw = gwWear(0.6); diffuseColor.rgb = mix(diffuseColor.rgb, min(diffuseColor.rgb * 1.16 + 0.04, vec3(1.0)), gw); roughnessFactor = mix(roughnessFactor, roughnessFactor * 0.35, gw);',
  // black enamel rubbed through to the alloy underneath
  paint: 'float gw = gwWear(0.86) * 0.85; diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.3, 0.3, 0.29), gw); metalnessFactor = mix(metalnessFactor, 1.0, gw); roughnessFactor = mix(roughnessFactor, 0.5, gw);',
  // anodising worn through at the edges
  anod: 'float gw = gwWear(0.8) * 0.7; diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.5, 0.5, 0.5), gw); metalnessFactor = mix(metalnessFactor, 1.0, gw); roughnessFactor = mix(roughnessFactor, 0.4, gw);',
  // leatherette polished by hands
  leather: 'float gw = gwWear(0.7); roughnessFactor = mix(roughnessFactor, roughnessFactor * 0.55, gw); diffuseColor.rgb *= 1.0 + 0.7 * gw;',
  // matte black anodising over a fine blast (the Intrepid's laser-cut aluminium): an uneven satin, grey at the worn edges
  anodSatin: 'float gw = gwWear(0.84) * 0.6; float gwSat = gwNoise(vObjPos * 17.0) * 0.55 + gwNoise(vObjPos * 47.0) * 0.45; roughnessFactor *= 0.86 + 0.28 * gwSat; diffuseColor.rgb *= 0.92 + 0.16 * gwSat; diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.42, 0.42, 0.43), gw); metalnessFactor = mix(metalnessFactor, 1.0, gw); roughnessFactor = mix(roughnessFactor, 0.36, gw);',
  // printed plastic: the layers, 0.2 mm, as fine lines of sheen (faded out once they are finer than a pixel)
  print: 'float gwLy = sin(vObjPos.y * 31.41593); float gwLf = clamp(1.0 - fwidth(vObjPos.y) * 7.0, 0.0, 1.0); roughnessFactor *= 1.0 + 0.3 * gwLy * gwLf; diffuseColor.rgb *= 1.0 + 0.22 * gwLy * gwLf;',
  // black chrome (the M6's top plate and baseplate): worn through at the edges to bright metal, not to brass
  // (and its satin: the plating follows a bead-blasted surface, so the sheen is finely uneven, never streaked)
  blackChrome: 'float gw = gwWear(0.9) * 0.45; float gwSat = gwNoise(vObjPos * 23.0) * 0.6 + gwNoise(vObjPos * 61.0) * 0.4; roughnessFactor *= 0.9 + 0.2 * gwSat; diffuseColor.rgb *= 0.96 + 0.08 * gwSat; diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.4, 0.4, 0.41), gw); metalnessFactor = mix(metalnessFactor, 1.0, gw); roughnessFactor = mix(roughnessFactor, 0.28, gw);',
  // blackened spring-steel diaphragm blades: fine dark edge border separating overlapping shingles on both faces
  irisBlade: 'float gw = smoothstep(0.15, 0.68, vWear); diffuseColor.rgb *= mix(1.0, 0.08, gw); roughnessFactor = mix(roughnessFactor, 0.78, gw);',
};


export const LENS_GLASS_GLSL = /* glsl */`
vec3 gwTraceLens(vec3 objPos, vec3 localRay, vec4 opt, vec4 st, vec3 tintA, vec3 tintB, float envScale, out float alphaOut) {
  bool isFront = objPos.z < -2.0;
  float rSurf = max(isFront ? opt.z : opt.w, 1.0);
  vec2 p0 = objPos.xy / rSurf;
  float raySign = isFront ? 1.0 : -1.0;
  // Snell refraction at the curved lanthanum crown outer surface (n ≈ 1.72)
  vec2 slope = (localRay.xy / max(abs(localRay.z), 0.24)) * raySign - p0 * 0.28;

  // Deep matte-black barrel interior with micro-grooved baffle rings
  vec3 barrel = vec3(0.003, 0.0035, 0.0045);
  vec2 pWall = p0 + slope * 0.36;
  float rWall = length(pWall);
  float baffle = 0.5 + 0.5 * sin(rWall * 56.0);
  barrel += vec3(0.018, 0.019, 0.021) * smoothstep(0.68, 0.98, rWall) * baffle;

  // Multi-element Carl Zeiss T* internal spherical surface reflections (parallax-shifting)
  vec3 coatings = vec3(0.0);
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float depthT = 0.15 + fi * 0.22;
    // Alternating convex (+) and concave (-) internal surfaces shift in opposite parallax directions
    float curv = (i == 0 ? 0.72 : i == 1 ? -0.62 : i == 2 ? 0.52 : -0.78) * raySign;
    vec2 pk = p0 + slope * depthT * 0.85;
    float rk = length(pk);
    float inCell = 1.0 - smoothstep(0.88, 1.0, rk);
    vec2 rNorm = pk * curv + slope * 0.42;
    vec2 h1 = rNorm - vec2(-0.24 + fi * 0.06, 0.26 - fi * 0.05);
    vec2 h2 = rNorm - vec2(0.26 - fi * 0.05, -0.22 + fi * 0.04);
    float g1 = exp(-dot(h1, h1) * 34.0);
    float g2 = exp(-dot(h2, h2) * 52.0) * 0.65;
    float gwCr = (rk - (0.86 - fi * 0.05)) * 18.0;
    float cellRim = exp(-gwCr * gwCr) * 0.16;
    vec3 cTint = i == 0 ? tintA : i == 1 ? tintB : i == 2 ? mix(tintA, vec3(0.14, 0.68, 0.96), 0.6) : mix(tintB, vec3(0.92, 0.58, 0.16), 0.5);
    coatings += cTint * (g1 * 0.52 + g2 * 0.34 + cellRim) * inCell;
  }

  // Optically magnified Entrance/Exit Pupil at the Prontor diaphragm plane
  float pupilMag = isFront ? st.y : (1.0 / max(st.y, 0.4));
  vec2 pIrisMm = (p0 * rSurf + slope * (rSurf * 0.86)) / max(pupilMag, 0.5);
  float rIris = opt.x;
  float irisTwist = st.x;
  float angI = atan(pIrisMm.y, pIrisMm.x);
  float a5 = mod(angI - irisTwist + 0.62831853, 1.25663706) - 0.62831853;
  float polyK = clamp((11.5 - rIris) / 4.2, 0.0, 1.0);
  float effIrisR = rIris * mix(1.0, 0.885 / cos(a5 * 0.88), polyK);
  float rP = length(pIrisMm);
  float inIris = 1.0 - smoothstep(effIrisR - 0.32, effIrisR + 0.32, rP);
  float gwIe = (rP - effIrisR) * 2.4;
  float irisEdgeRim = exp(-gwIe * gwIe) * (1.0 - inIris * 0.5);

  // Overlapping 5-blade iris diaphragm outside the aperture opening
  float bladeSeam = smoothstep(0.0, 0.09, abs(sin((angI - irisTwist) * 2.5)));
  float bladeAniso = 0.5 + 0.5 * cos(angI * 2.0 - 0.7);
  vec3 irisBladeCol = vec3(0.045, 0.047, 0.052) * (0.55 + 0.65 * bladeAniso) * (0.62 + 0.38 * bladeSeam) + vec3(0.09, 0.095, 0.105) * irisEdgeRim;
  float onIrisRing = (1.0 - inIris) * (1.0 - smoothstep(16.5, 19.5, rP));

  // 5-blade Prontor leaf shutter inside the iris
  float leafOpen = opt.y;
  float effLeafR = effIrisR * leafOpen;
  float inLeaf = leafOpen > 0.98 ? 1.0 : (1.0 - smoothstep(effLeafR - 0.32, effLeafR + 0.32, rP));
  float starSeam = smoothstep(0.0, 0.07, abs(sin((angI + 0.35) * 2.5)));
  float leafAniso = 0.62 + 0.42 * cos(angI * 2.0 + 0.55);
  vec3 leafCol = vec3(0.095, 0.098, 0.108) * leafAniso * (0.58 + 0.42 * starSeam);

  // Ray passing completely through both iris, open shutter, and opposite clear aperture
  vec2 pFar = p0 + slope * 1.05;
  float clearFar = 1.0 - smoothstep(0.86, 1.02, length(pFar));
  float through = inIris * inLeaf * clearFar;

  // Inverted real-image refraction when detached/exploded, or subtle dark reflex mirror bounce when mounted
  vec2 invDir = -(p0 * 1.25 + slope * 0.55);
  float skyGrad = smoothstep(-0.35, 0.45, invDir.y);
  vec3 detachedEnv = mix(vec3(0.04, 0.036, 0.032), vec3(0.18, 0.22, 0.28), skyGrad);
  vec3 mountedBounce = vec3(0.004, 0.005, 0.007) * (0.4 + 0.6 * clamp(1.0 - length(pFar), 0.0, 1.0));
  vec3 pupilThrough = mix(mountedBounce, detachedEnv, st.w) * through;

  vec3 pupilCol = irisBladeCol * onIrisRing + leafCol * (inIris * (1.0 - inLeaf)) + pupilThrough;
  alphaOut = mix(0.92, 0.62, through * (0.35 + 0.65 * st.w));
  return (barrel + pupilCol + coatings) * envScale;
}
`;


/** Shader extras: edge wear from the `wear` vertex attribute, a hover rim, the iris opening, and see-through lens optics. */
export function patchMaterial(mat, { wear = null, hover = null, iris = null, lensGlass = null } = {}) {
  // (a lens whose iris is not the 503's five blades gets the trace with its own blade count: a rewrite of the constants,
  //  so that the five-bladed source stays as it was)
  const blades = lensGlass?.blades && lensGlass.blades !== 5 ? lensGlass.blades : 0;
  const lensGlsl = blades ? LENS_GLASS_GLSL.replaceAll('0.62831853', (Math.PI / blades).toFixed(8)).replaceAll('1.25663706', (2 * Math.PI / blades).toFixed(8))
    .replace('float bladeSeam = smoothstep(0.0, 0.09, abs(sin((angI - irisTwist) * 2.5)));', `float bladeSeam = smoothstep(0.0, 0.09, abs(sin((angI - irisTwist) * ${(blades / 2).toFixed(1)})));`)
    .replace('0.885 / cos(a5 * 0.88)', `${(1 - 0.115 * 25 / (blades * blades)).toFixed(4)} / cos(a5 * 0.88)`) : LENS_GLASS_GLSL;
  const key = `gw|${wear || ''}|${hover ? 'h' : ''}|${iris ? 'i' : ''}|${lensGlass ? 'lg' : ''}${blades || ''}`;
  mat.onBeforeCompile = (sh) => {
    if (hover) { sh.uniforms.uHover = hover.amount; sh.uniforms.uHoverColor = hover.color; }
    if (iris) { sh.uniforms.uIris = iris.radius; sh.uniforms.uIrisTwist = iris.twist; }
    if (lensGlass) {
      sh.uniforms.uLensOptics = lensGlass.optics;
      sh.uniforms.uLensState = lensGlass.state;
      sh.uniforms.uGhostA = lensGlass.ghostA;
      sh.uniforms.uGhostB = lensGlass.ghostB;
    }
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
attribute float wear; varying float vWear; varying vec3 vObjPos;
${lensGlass ? 'varying vec3 vLensRay;' : ''}
${iris ? 'attribute float inner; uniform float uIris; uniform float uIrisTwist;' : ''}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vWear = wear; vObjPos = position;
${lensGlass ? 'vec3 gwWPos = (modelMatrix * vec4(transformed, 1.0)).xyz; vec3 gwWView = normalize(gwWPos - cameraPosition); vLensRay = normalize((vec4(gwWView, 0.0) * modelMatrix).xyz);' : ''}
${iris ? 'float gwA = uIrisTwist * inner; transformed.xy = mat2(cos(gwA), sin(gwA), -sin(gwA), cos(gwA)) * transformed.xy * mix(1.0, uIris, inner);' : ''}`);
    let fs = sh.fragmentShader.replace('#include <common>', `#include <common>
varying float vWear; varying vec3 vObjPos;
${NOISE_GLSL}
${hover ? 'uniform float uHover; uniform vec3 uHoverColor;' : ''}
${lensGlass ? `varying vec3 vLensRay; uniform vec4 uLensOptics; uniform vec4 uLensState; uniform vec3 uGhostA; uniform vec3 uGhostB; ${lensGlsl}` : ''}`);
    if (wear) fs = fs.replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
{ ${WEAR_GLSL[wear]} }`);
    if (hover) fs = fs.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
{ float gwRim = pow(1.0 - saturate(abs(dot(normal, normalize(vViewPosition)))), 4.0); totalEmissiveRadiance += uHoverColor * uHover * (0.02 + 0.8 * gwRim); }`);
    // (after the lights, before three sums them into outgoingLight: hooked at opaque_fragment, the trace was discarded)
    if (lensGlass) fs = fs.replace('#include <aomap_fragment>', `#include <aomap_fragment>
{
  vec3 gwSpec = reflectedLight.indirectSpecular + reflectedLight.directSpecular;
  float gwEnvScale = clamp(dot(gwSpec, vec3(0.333)) * 3.8 + dot(reflectedLight.indirectDiffuse + reflectedLight.directDiffuse, vec3(0.333)) * 1.4, 0.0015, 1.15);
  reflectedLight.indirectSpecular *= 0.34;
  reflectedLight.directSpecular *= 0.45;
  float gwAlpha = 0.88;
  totalEmissiveRadiance += gwTraceLens(vObjPos, normalize(vLensRay), uLensOptics, uLensState, uGhostA, uGhostB, gwEnvScale, gwAlpha);
  diffuseColor.a = gwAlpha;
}`);
    sh.fragmentShader = fs;
  };
  mat.customProgramCacheKey = () => key;
  return mat;
}


const _sharedMapsCache = new Map();
function sharedBaseMaps() {
  const sc = globalThis.GW_ATLAS_SCALE || 1;
  let b = _sharedMapsCache.get(sc);
  if (!b) {
    const L = leatherMaps(), B = brushedMap(), K = knurlMap(), CG = cfGripMaps(), C = carbonMaps(), D = decalAtlas(), W = waffleMaps();
    const Kr = K.clone(); Kr.repeat.set(1 / 1.35, 1 / 1.35); Kr.needsUpdate = true;
    const Ks = K.clone(); Ks.repeat.set(1 / 0.85, 1 / 0.85); Ks.needsUpdate = true;
    for (const t of [L.mac, L.rgh, L.nrm, B, K, Kr, Ks, CG.rgh, CG.nrm, C.rgh, C.nrm, C.ani, D.tex, W.rgh, W.nrm]) {
      if (!t) continue;
      (t.userData ||= {}).shared = true;
      if (t.source) (t.source.userData ||= {}).shared = true;
    }
    b = { L, B, K, Kr, Ks, CG, C, D, W };
    _sharedMapsCache.set(sc, b);
  }
  return b;
}

export function baseMaterials() {
  const { L, B, Kr, Ks, CG, C, D, W } = sharedBaseMaps();
  const P = (o) => new THREE.MeshPhysicalMaterial(o);
  const m = {
    chrome: P({ name: 'chrome', color: 0xc4c6c7, metalness: 1, roughness: 0.28, roughnessMap: B, anisotropy: 0.16, anisotropyRotation: Math.PI / 2 }),
    chromeBright: P({ name: 'chromeBright', color: 0xd6d8d9, metalness: 1, roughness: 0.13, roughnessMap: B, anisotropy: 0.2, anisotropyRotation: Math.PI / 2 }),
    turned: P({ name: 'turned', color: 0xcfd1d2, metalness: 1, roughness: 0.24, roughnessMap: B, anisotropy: 0.55, anisotropyRotation: Math.PI / 2 }),
    leather: P({ name: 'leather', color: 0x181818, map: L.mac, roughness: 0.58, diffuseRoughness: 0.55, roughnessMap: L.rgh, normalMap: L.nrm, normalScale: new THREE.Vector2(0.8, 0.8), sheen: 0.4, sheenRoughness: 0.5, sheenColor: 0x2e2e2e }),
    // Two-tone CF barrel finish (SPEC §10): smooth anodized aluminium rings have a subtle warm dark-aubergine sheen
    paint: P({ name: 'paint', color: 0x131013, metalness: 0.14, roughness: 0.48, specularIntensity: 0.62, envMapIntensity: 0.9, clearcoat: 0.14, clearcoatRoughness: 0.42 }),
    lensBlack: P({ name: 'lensBlack', color: 0x121012, metalness: 0.12, roughness: 0.46, specularIntensity: 0.62, envMapIntensity: 0.88 }),
    anod: P({ name: 'anod', color: 0x111112, metalness: 0.25, roughness: 0.5 }),
    hoodWall: P({ name: 'hoodWall', color: 0x111112, metalness: 0.22, roughness: 0.52, roughnessMap: W.rgh, normalMap: W.nrm, normalScale: new THREE.Vector2(1.15, 1.15) }),
    // Law #18: Dead-flat Palpas anti-reflection interior velvet coating (zero overhead Fresnel grey wash!)
    palpas: P({ name: 'palpas', color: 0x020203, metalness: 0, roughness: 0.98, diffuseRoughness: 0.95, specularIntensity: 0.0, envMapIntensity: 0.04, normalMap: L.nrm, normalScale: new THREE.Vector2(0.42, 0.42) }),
    sintered: P({ name: 'sintered', color: 0x2d2b29, metalness: 0.1, roughness: 0.88, diffuseRoughness: 0.75, normalMap: L.nrm, normalScale: new THREE.Vector2(0.35, 0.35) }),
    rubber: P({ name: 'rubber', color: 0x0f0f11, metalness: 0, roughness: 0.76, diffuseRoughness: 0.65, sheen: 0.38, sheenRoughness: 0.7, sheenColor: 0x1c1c1e }),
    knurl: P({ name: 'knurl', color: 0x101012, metalness: 0, roughness: 0.72, diffuseRoughness: 0.6, roughnessMap: CG.rgh, normalMap: CG.nrm, normalScale: new THREE.Vector2(1.35, 1.35), sheen: 0.32, sheenRoughness: 0.62, sheenColor: 0x1e1e22 }),
    flock: P({ name: 'flock', color: 0x050505, metalness: 0, roughness: 1, diffuseRoughness: 1 }),
    brass: P({ name: 'brass', color: 0xb9975b, metalness: 1, roughness: 0.3, roughnessMap: B }),
    alu: P({ name: 'alu', color: 0xb9bbbd, metalness: 1, roughness: 0.4, roughnessMap: B, anisotropy: 0.3, anisotropyRotation: 0 }),
    steel: P({ name: 'steel', color: 0xa9abad, metalness: 1, roughness: 0.26, roughnessMap: B, anisotropy: 0.5, anisotropyRotation: Math.PI / 2 }),
    satinBlack: P({ name: 'satinBlack', color: 0x161616, metalness: 0.6, roughness: 0.32 }),
    red: P({ name: 'red', color: 0xc3241b, roughness: 0.4 }),
    orange: P({ name: 'orange', color: 0xe0701c, roughness: 0.45 }),
    felt: P({ name: 'felt', color: 0x3a3733, metalness: 0, roughness: 1, diffuseRoughness: 1 }),
    green: P({ name: 'green', color: 0x2f8f4e, roughness: 0.35, clearcoat: 0.5 }),
    white: P({ name: 'white', color: 0xe8e6de, roughness: 0.45 }),
    mirror: new THREE.MeshStandardMaterial({ name: 'mirror', color: 0x24282c, metalness: 0.92, roughness: 0.04, envMapIntensity: 0.06 }),
    blade: P({ name: 'blade', color: 0x1a1a1c, metalness: 0.75, roughness: 0.3, side: THREE.DoubleSide }),
    glass: P({
      // (multicoated: a few per cent of the light comes back, tinted by the coating — violet, amber, green — and the
      //  rest goes in; the lens's internal elements, iris and leaf shutter show through)
      name: 'glass', color: 0x040506, metalness: 0, roughness: 0.02, ior: 1.7, specularIntensity: 0.52,
      iridescence: 1, iridescenceIOR: 1.38, iridescenceThicknessMinimum: 300, iridescenceThicknessMaximum: 560, transparent: true, opacity: 0.82, depthWrite: false,
    }),
    innerGlass: P({
      name: 'innerGlass', color: 0x9fc2cc, metalness: 0, roughness: 0.04, ior: 1.6, transparent: true, opacity: 0.32,
      iridescence: 0.7, iridescenceIOR: 1.4, iridescenceThicknessMinimum: 200, iridescenceThicknessMaximum: 480, side: THREE.DoubleSide, depthWrite: false,
    }),
    magGlass: P({
      name: 'magGlass', color: 0xffffff, metalness: 0, roughness: 0.015, ior: 1.52, transparent: true, opacity: 0.18, depthWrite: false,
      specularIntensity: 1, iridescence: 0.35, iridescenceIOR: 1.38, iridescenceThicknessMinimum: 240, iridescenceThicknessMaximum: 420,
    }),
    windowGlass: P({ name: 'windowGlass', color: 0xffffff, metalness: 0, roughness: 0.03, transparent: true, opacity: 0.12, clearcoat: 1, depthWrite: false }),
    carbon: P({
      name: 'carbon', color: 0x121314, metalness: 0.25, roughness: 0.34, roughnessMap: C.rgh, normalMap: C.nrm, normalScale: new THREE.Vector2(0.45, 0.45),
      anisotropy: 0.8, anisotropyMap: C.ani, clearcoat: 1, clearcoatRoughness: 0.07,
    }),
    cutMetal: P({ name: 'cutMetal', color: 0x8e9091, metalness: 1, roughness: 0.5 }),
    rubberKnurl: P({ name: 'rubberKnurl', color: 0x101010, metalness: 0, roughness: 0.74, normalMap: Kr, normalScale: new THREE.Vector2(1.0, 1.0), sheen: 0.3, sheenRoughness: 0.6, sheenColor: 0x202020 }),
    steelKnurl: P({ name: 'steelKnurl', color: 0xb4b6b8, metalness: 1, roughness: 0.28, normalMap: Ks, normalScale: new THREE.Vector2(1.2, 1.2) }),
    levelLiquid: P({ name: 'levelLiquid', color: 0xc9e24e, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.62, clearcoat: 1, depthWrite: false }),
    levelBubble: P({ name: 'levelBubble', color: 0xf4f7e8, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.85, clearcoat: 1, depthWrite: false }),
    levelFloor: P({ name: 'levelFloor', color: 0xcfe06a, roughness: 0.35, emissive: 0x2a3008 }),
    levelDome: P({ name: 'levelDome', color: 0xffffff, roughness: 0.02, metalness: 0, transparent: true, opacity: 0.14, clearcoat: 1, depthWrite: false }),
    inkBlack: new THREE.MeshStandardMaterial({ name: 'inkBlack', color: 0x0a0a0a, roughness: 0.3, alphaMap: D.tex, alphaTest: 0.5, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    inkChrome: new THREE.MeshStandardMaterial({ name: 'inkChrome', color: 0xdedfe0, metalness: 1, roughness: 0.22, alphaMap: D.tex, alphaTest: 0.5, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    // (laser-etched leatherette: the grain burnt flat, matte and a shade lighter than the black around it)
    inkEtch: new THREE.MeshStandardMaterial({ name: 'inkEtch', color: 0x3c3935, roughness: 0.95, alphaMap: D.tex, alphaTest: 0.5, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    inkWhite: new THREE.MeshStandardMaterial({ name: 'inkWhite', color: 0xe9e7df, roughness: 0.5, alphaMap: D.tex, alphaTest: 0.5, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
  };
  m.chrome.userData.wear = 'chrome'; m.turned.userData.wear = 'chrome'; m.chromeBright.userData.wear = 'chrome'; m.steel.userData.wear = 'chrome'; m.brass.userData.wear = 'chrome';
  m.paint.userData.wear = 'paint'; m.lensBlack.userData.wear = 'paint'; m.anod.userData.wear = 'anod'; m.hoodWall.userData.wear = 'anod'; m.leather.userData.wear = 'leather';
  m.satinBlack.userData.wear = 'anod'; m.steelKnurl.userData.wear = 'chrome'; m.rubberKnurl.userData.wear = 'leather';
  for (const k of ['glass', 'innerGlass', 'magGlass', 'windowGlass', 'inkBlack', 'inkEtch', 'inkWhite', 'inkChrome', 'mirror', 'levelLiquid', 'levelBubble', 'levelDome']) m[k].userData.single = true;
  return m;
}


/** Material variants per part group: hover rim + clipping share one program per variant. */
export class MatLib {
  constructor(base, planes) { this.base = base; this.planes = planes; this.cache = new Map(); }
  get(kind, { hover = null, clip = true } = {}) {
    const key = `${kind}|${hover ? hover.name : ''}|${clip ? 1 : 0}`;
    let m = this.cache.get(key);
    if (!m) {
      const src = this.base[kind];
      m = src.clone();
      m.userData = { ...src.userData };
      this.prepare(m, { hover, clip, wear: src.userData.wear });
      this.cache.set(key, m);
    }
    return m;
  }
  /** Wire up a one-off material (engraving bands, dynamic windows, lens glass). */
  prepare(m, { hover = null, clip = true, wear = m.userData.wear || null, iris = null, lensGlass = null } = {}) {
    if (wear || hover || iris || lensGlass) patchMaterial(m, { wear, hover, iris, lensGlass });
    if (clip) {
      m.clippingPlanes = this.planes;
      if (!m.userData.single && !m.transparent) m.side = THREE.DoubleSide;
    }
    return m;
  }
}
