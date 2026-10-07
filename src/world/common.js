import * as THREE from 'three';

THREE.ColorManagement.enabled = false;

// Every animation runs on the wall clock (shared by all windows), wrapped to a
// day so it fits float precision in shaders.
export const sharedTime = (now) => (now % 86_400_000) / 1000;

export function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash3(a, b, c) {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// Premultiplied alpha: alpha 0 with colour = additive glow, alpha 1 = opaque.
export const premultiplied = {
  transparent: true,
  depthTest: false,
  depthWrite: false,
  side: THREE.DoubleSide,
  blending: THREE.CustomBlending,
  blendSrc: THREE.OneFactor,
  blendDst: THREE.OneMinusSrcAlphaFactor,
  blendSrcAlpha: THREE.OneFactor,
  blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
};

export const quadGeo = new THREE.PlaneGeometry(1, 1);

export const QUAD_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const NOISE_GLSL = /* glsl */ `
  float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash12(i), hash12(i + vec2(1, 0)), u.x),
               mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    mat2 r = mat2(0.8, -0.6, 0.6, 0.8);
    for (int i = 0; i < 5; i++) { v += a * vnoise(p); p = r * p * 2.03 + 17.0; a *= 0.5; }
    return v;
  }
  float hash13(vec3 p3) {
    p3 = fract(p3 * 0.1031);
    p3 += dot(p3, p3.zyx + 31.32);
    return fract((p3.x + p3.y) * p3.z);
  }
  float vnoise3(vec3 p) {
    vec3 i = floor(p), f = fract(p);
    vec3 u = f * f * (3.0 - 2.0 * f);
    float a = mix(mix(hash13(i), hash13(i + vec3(1,0,0)), u.x), mix(hash13(i + vec3(0,1,0)), hash13(i + vec3(1,1,0)), u.x), u.y);
    float b = mix(mix(hash13(i + vec3(0,0,1)), hash13(i + vec3(1,0,1)), u.x), mix(hash13(i + vec3(0,1,1)), hash13(i + vec3(1,1,1)), u.x), u.y);
    return mix(a, b, u.z);
  }
  float fbm3(vec3 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * vnoise3(p); p = p * 2.07 + 11.0; a *= 0.5; }
    return v;
  }
`;

// Layout of the shared world, derived only from the screen so every window
// agrees on it. Three.js space is (x, -y) of screen pixels.
export function worldLayout(screen) {
  const R = screen.w * 0.225;
  const roll = (-16 * Math.PI) / 180;
  const ny = 0.96;
  const nz = 0.28;
  const ringNormal = new THREE.Vector3(-Math.sin(roll) * ny, Math.cos(roll) * ny, nz).normalize();
  return {
    screen,
    planet: { x: screen.x + screen.w * 0.5, y: screen.y + screen.h * 0.53, R },
    ringNormal,
    ringRange: [1.28, 2.05],
    sun: new THREE.Vector3(-0.72, 0.5, 0.48).normalize(),
    galaxy: { x: screen.x + screen.w * 0.83, y: screen.y + screen.h * 0.2, size: Math.min(screen.w, screen.h) * 0.22 },
  };
}
