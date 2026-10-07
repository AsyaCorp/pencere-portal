import * as THREE from 'three';
import { BALL_R, TRAIL_LEN } from '../game.js';
import { QUAD_VERT, hash3, premultiplied, quadGeo } from './common.js';

export const GLOW_FRAG = /* glsl */ `
  varying vec2 vUv;
  uniform vec3 uColor;
  uniform float uPow;
  void main() {
    float d = length(vUv - 0.5) * 2.0;
    float a = pow(max(0.0, 1.0 - d), uPow);
    gl_FragColor = vec4(uColor * a, 0.0);
  }
`;

const RIBBON_VERT = /* glsl */ `
  attribute float aAlpha;
  attribute float aSide;
  varying float vAlpha;
  varying float vSide;
  void main() {
    vAlpha = aAlpha;
    vSide = aSide;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const RIBBON_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uTip;
  varying float vAlpha;
  varying float vSide;
  void main() {
    float edge = exp(-vSide * vSide * 2.5);
    vec3 col = mix(uTip, uColor, vAlpha);
    gl_FragColor = vec4(col * vAlpha * edge, 0.0);
  }
`;

export const SPARK_VERT = /* glsl */ `
  attribute float aSize;
  attribute vec3 aColor;
  uniform float uPR;
  varying vec3 vColor;
  void main() {
    vColor = aColor;
    gl_PointSize = aSize * uPR;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const SPARK_FRAG = /* glsl */ `
  varying vec3 vColor;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float a = pow(max(0.0, 1.0 - d), 1.8);
    gl_FragColor = vec4(vColor * a, 0.0);
  }
`;

export function glow(color, size, pow = 2.2) {
  const m = new THREE.Mesh(
    quadGeo,
    new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Vector3(...color) }, uPow: { value: pow } },
      vertexShader: QUAD_VERT,
      fragmentShader: GLOW_FRAG,
      ...premultiplied,
    }),
  );
  m.scale.set(size, size, 1);
  m.frustumCulled = false;
  return m;
}

export function makeSparks(count, prU) {
  const pos = new Float32Array(count * 3);
  const color = new Float32Array(count * 3);
  const size = new Float32Array(count);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aColor', new THREE.BufferAttribute(color, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  const points = new THREE.Points(
    geo,
    new THREE.ShaderMaterial({
      uniforms: { uPR: prU },
      vertexShader: SPARK_VERT,
      fragmentShader: SPARK_FRAG,
      ...premultiplied,
    }),
  );
  points.frustumCulled = false;
  return {
    points,
    set(i, x, y, s, r, g, b) {
      pos[i * 3] = x;
      pos[i * 3 + 1] = -y;
      size[i] = s;
      color[i * 3] = r;
      color[i * 3 + 1] = g;
      color[i * 3 + 2] = b;
    },
    commit(n = count) {
      geo.setDrawRange(0, n);
      geo.attributes.position.needsUpdate = true;
      geo.attributes.aColor.needsUpdate = true;
      geo.attributes.aSize.needsUpdate = true;
    },
  };
}

function makeRibbon(color, tip) {
  const pos = new Float32Array(TRAIL_LEN * 2 * 3);
  const alpha = new Float32Array(TRAIL_LEN * 2);
  const side = new Float32Array(TRAIL_LEN * 2).map((_, i) => (i % 2 ? 1 : -1));
  const idx = [];
  for (let i = 0; i < TRAIL_LEN - 1; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1));
  geo.setAttribute('aSide', new THREE.BufferAttribute(side, 1));
  geo.setIndex(idx);
  const mesh = new THREE.Mesh(
    geo,
    new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Vector3(...color) }, uTip: { value: new THREE.Vector3(...tip) } },
      vertexShader: RIBBON_VERT,
      fragmentShader: RIBBON_FRAG,
      ...premultiplied,
    }),
  );
  mesh.frustumCulled = false;

  // pts: [{x, y, nx, ny, u}] head-first; width/alphaAt take u (0 head .. 1 tail).
  function draw(pts, widthAt, alphaAt) {
    const n = pts.length;
    if (n < 2) {
      geo.setDrawRange(0, 0);
      return;
    }
    for (let i = 0; i < n; i++) {
      const p = pts[i];
      const w = widthAt(p.u);
      pos.set([p.x + p.nx * w, -(p.y + p.ny * w), 0, p.x - p.nx * w, -(p.y - p.ny * w), 0], i * 6);
      alpha[i * 2] = alpha[i * 2 + 1] = alphaAt(p.u);
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.aAlpha.needsUpdate = true;
    geo.setDrawRange(0, (n - 1) * 6);
  }
  return { mesh, draw };
}

const PARTICLES_PER_POINT = 3;

export function createComet(scene, prU) {
  const ion = makeRibbon([0.25, 0.75, 1.6], [0.15, 0.2, 0.7]);
  const tail = makeRibbon([1.6, 2.4, 2.8], [0.2, 0.6, 1.4]);
  const sparks = makeSparks(TRAIL_LEN * PARTICLES_PER_POINT, prU);
  const head = new THREE.Group();
  head.add(glow([0.12, 0.45, 0.9], BALL_R * 12, 2.4), glow([0.7, 1.7, 2.3], BALL_R * 4, 2.6), glow([4, 4.4, 4.6], BALL_R * 1.9, 1.3));
  const all = [ion.mesh, sparks.points, tail.mesh, head];
  all.forEach((o, i) => {
    o.renderOrder = 20 + i;
    scene.add(o);
  });

  const pts = [];

  function update(view, t, hidden) {
    const show = !!view && !hidden;
    for (const o of all) o.visible = show;
    if (!show) return;
    const b = view.ball;
    head.position.set(b.x, -b.y, 0);
    head.scale.setScalar(b.active ? 1 : 1 + 0.12 * Math.sin(t * 4));

    // Head-first points with a gentle, time-driven curl that grows toward the tip.
    const trail = view.trail;
    const n = trail.length;
    pts.length = 0;
    let nx = 0;
    let ny = 1;
    for (let k = 0; k < n; k++) {
      const i = n - 1 - k;
      const p0 = trail[Math.min(n - 1, i + 1)];
      const p1 = trail[Math.max(0, i - 1)];
      const dx = p0[0] - p1[0];
      const dy = p0[1] - p1[1];
      const len = Math.hypot(dx, dy);
      if (len > 1e-3) {
        nx = -dy / len;
        ny = dx / len;
      }
      const u = n > 1 ? k / (n - 1) : 0;
      const curl = Math.sin(u * 9 - t * 6) * u * 9;
      pts.push({ x: trail[i][0] + nx * curl, y: trail[i][1] + ny * curl, nx, ny, u, raw: trail[i] });
    }
    ion.draw(pts, (u) => BALL_R * (2.2 - 1.2 * u), (u) => (1 - u) ** 2 * 0.3);
    tail.draw(pts, (u) => BALL_R * 0.85 * (1 - u) ** 0.9 + 0.8, (u) => (1 - u) ** 1.3);

    let m = 0;
    for (let k = 1; k < pts.length; k++) {
      const p = pts[k];
      const qx = Math.round(p.raw[0] * 4);
      const qy = Math.round(p.raw[1] * 4);
      for (let j = 0; j < PARTICLES_PER_POINT; j++) {
        const h1 = hash3(qx, qy, j);
        const h2 = hash3(qy, qx, j + 7);
        const spread = (h1 - 0.5) * 2 * (3 + p.u * 46);
        const fade = (1 - p.u) * (0.5 + 0.5 * h2);
        const white = h2 > 0.7;
        sparks.set(
          m++,
          p.x + p.nx * spread,
          p.y + p.ny * spread,
          1.5 + (1 - p.u) * 5 * h2,
          (white ? 1.6 : 0.4) * fade,
          (white ? 1.8 : 1.1) * fade,
          (white ? 2.0 : 1.9) * fade,
        );
      }
    }
    sparks.commit(m);
  }

  return { update };
}
