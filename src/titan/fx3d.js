import * as THREE from 'three';

// Camera-facing instanced quads. The camera never rotates (the windows are
// portals), so quads in the xy plane always face it.

function puffTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  let s = 7;
  const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 14; i++) {
    const x = 64 + (rand() - 0.5) * 50;
    const y = 64 + (rand() - 0.5) * 50;
    const r = 22 + rand() * 30;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, 'rgba(255,255,255,0.32)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
  }
  const fade = g.createRadialGradient(64, 64, 30, 64, 64, 64);
  fade.addColorStop(0, 'rgba(0,0,0,0)');
  fade.addColorStop(1, 'rgba(0,0,0,1)');
  g.globalCompositeOperation = 'destination-out';
  g.fillStyle = fade;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  return t;
}

function dotTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.5)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}

const VERT = /* glsl */ `
  attribute vec3 iPos;
  attribute float iSize;
  attribute float iAlpha;
  attribute vec3 iColor;
  varying vec2 vUv;
  varying float vAlpha;
  varying vec3 vColor;
  varying float vDepth;
  void main() {
    vUv = uv;
    vAlpha = iAlpha;
    vColor = iColor;
    vec4 mv = viewMatrix * vec4(iPos + vec3(position.xy * iSize, 0.0), 1.0);
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAG = /* glsl */ `
  uniform sampler2D map;
  uniform vec3 fogColor;
  uniform float fogNear;
  uniform float fogFar;
  uniform float additive;
  varying vec2 vUv;
  varying float vAlpha;
  varying vec3 vColor;
  varying float vDepth;
  void main() {
    vec4 tex = texture2D(map, vUv);
    float f = smoothstep(fogNear, fogFar, vDepth);
    float a = tex.a * vAlpha;
    vec3 c = vColor;
    if (additive > 0.5) { a *= 1.0 - f * 0.8; }
    else { c = mix(c, fogColor, f * 0.85); }
    gl_FragColor = vec4(c, a);
  }
`;

export class Particles {
  constructor(cap, { additive = false, dot = false, fog }) {
    this.cap = cap;
    this.n = 0;
    const base = new THREE.PlaneGeometry(1, 1);
    const g = new THREE.InstancedBufferGeometry();
    g.index = base.index;
    g.setAttribute('position', base.getAttribute('position'));
    g.setAttribute('uv', base.getAttribute('uv'));
    this.pos = new Float32Array(cap * 3);
    this.size = new Float32Array(cap);
    this.alpha = new Float32Array(cap);
    this.color = new Float32Array(cap * 3);
    this.attrs = [
      ['iPos', this.pos, 3],
      ['iSize', this.size, 1],
      ['iAlpha', this.alpha, 1],
      ['iColor', this.color, 3],
    ].map(([name, arr, k]) => {
      const a = new THREE.InstancedBufferAttribute(arr, k);
      a.setUsage(THREE.DynamicDrawUsage);
      g.setAttribute(name, a);
      return a;
    });
    this.geo = g;
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        map: { value: dot ? dotTexture() : puffTexture() },
        fogColor: { value: fog.color },
        fogNear: { value: fog.near },
        fogFar: { value: fog.far },
        additive: { value: additive ? 1 : 0 },
      },
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = additive ? 3 : 2;
  }

  clear() {
    this.n = 0;
  }

  push(x, y, z, size, alpha, r, g, b) {
    if (this.n >= this.cap || alpha <= 0.002) return;
    const i = this.n++;
    this.pos[i * 3] = x;
    this.pos[i * 3 + 1] = y;
    this.pos[i * 3 + 2] = z;
    this.size[i] = size;
    this.alpha[i] = Math.min(1, alpha);
    this.color[i * 3] = r;
    this.color[i * 3 + 1] = g;
    this.color[i * 3 + 2] = b;
  }

  commit() {
    this.geo.instanceCount = this.n;
    for (const a of this.attrs) a.needsUpdate = true;
  }
}

const frac = (v) => v - Math.floor(v);

// A plume of puffs born at (x, y, z) that rise, drift and fade.
export function plume(p, x, y, z, t, seed, { size, rise, count = 7, rate = 0.5, drift = 0, alpha = 0.5, grow = 2.2, color = [0.95, 0.93, 0.9] }) {
  for (let k = 0; k < count; k++) {
    const age = frac(t * rate + k / count + seed);
    const sway = Math.sin(seed * 13.1 + k * 2.3 + t * 0.9) * size * 0.6 * age;
    p.push(
      x + drift * age * rise + sway,
      y + age * rise,
      z + k * 0.01,
      size * (0.6 + age * grow),
      alpha * (1 - age) * Math.min(1, age * 7),
      color[0],
      color[1],
      color[2],
    );
  }
}

export function ringMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uAlpha: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      uniform float uAlpha;
      varying vec2 vUv;
      void main() {
        float d = length(vUv - 0.5) * 2.0;
        float edge = smoothstep(0.78, 0.95, d) * (1.0 - smoothstep(0.95, 1.0, d));
        float inner = smoothstep(0.3, 0.95, d) * (1.0 - smoothstep(0.95, 1.0, d));
        vec3 c = mix(vec3(1.0, 0.45, 0.15) * 1.6, vec3(1.6, 1.5, 1.35), edge);
        gl_FragColor = vec4(c, (edge * 0.9 + inner * 0.25) * uAlpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
  });
}
