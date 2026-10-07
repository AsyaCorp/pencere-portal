import * as THREE from 'three';
import { NOISE_GLSL, QUAD_VERT, mulberry32, premultiplied, quadGeo } from './common.js';

const NEBULA_VERT = /* glsl */ `
  varying vec2 vWorld;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = vec2(w.x, -w.y);
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const NEBULA_FRAG = /* glsl */ `
  varying vec2 vWorld;
  uniform vec2 uOff;
  uniform float uTime;
  uniform vec4 uGal;
  ${NOISE_GLSL}

  vec3 galaxy(vec2 w) {
    vec2 g = (w - uGal.xy) / uGal.z;
    float ca = cos(0.55), sa = sin(0.55);
    g = mat2(ca, -sa, sa, ca) * g;
    g.y /= 0.42;
    float r = length(g);
    if (r > 1.3) return vec3(0.0);
    float a = atan(g.y, g.x) + uTime * 0.004;
    float arm = pow(0.5 + 0.5 * cos(2.0 * a - 7.0 * log(r + 0.04)), 3.0);
    float clump = fbm(g * 7.0 + 3.0);
    float disk = exp(-r * 3.2);
    vec3 col = vec3(1.0, 0.88, 0.7) * exp(-r * r * 90.0) * 0.8;
    col += vec3(0.55, 0.68, 1.0) * arm * disk * (0.2 + 0.6 * clump);
    col += vec3(0.65, 0.5, 0.85) * disk * 0.22;
    return col * smoothstep(1.3, 0.5, r);
  }

  void main() {
    vec2 w = vWorld + uOff;
    vec2 p = w / 820.0;
    float t = uTime * 0.012;
    vec2 q = vec2(fbm(p + vec2(0.0, t)), fbm(p + vec2(5.2, 1.3) - t));
    vec2 r = vec2(fbm(p + 3.0 * q + vec2(1.7, 9.2) + 0.5 * t), fbm(p + 3.0 * q + vec2(8.3, 2.8)));
    float f = fbm(p + 2.4 * r);

    vec3 base = vec3(0.030, 0.026, 0.085);
    vec3 col = base;
    col = mix(col, vec3(0.34, 0.11, 0.58), smoothstep(0.3, 0.8, f) * 0.9);
    col = mix(col, vec3(0.85, 0.16, 0.52), smoothstep(0.5, 0.9, r.x) * f * 0.9);
    col = mix(col, vec3(0.06, 0.55, 0.72), smoothstep(0.55, 0.95, q.y) * f * 0.85);
    float lanes = smoothstep(0.25, 0.7, fbm(p * 2.6 + r * 1.5));
    col *= 0.45 + 0.75 * lanes;
    col = col * 0.62 + base * 0.5;
    col += galaxy(w);
    gl_FragColor = vec4(col, 1.0);
  }
`;

const STAR_VERT = /* glsl */ `
  attribute float aSize;
  attribute vec3 aColor;
  attribute float aPhase;
  attribute float aSpike;
  uniform vec2 uOff;
  uniform float uTime;
  uniform float uPR;
  varying vec3 vColor;
  varying float vSpike;
  void main() {
    vec3 pos = position + vec3(uOff.x, -uOff.y, 0.0);
    float tw = 0.7 + 0.3 * sin(uTime * (1.2 + aPhase * 2.5) + aPhase * 40.0);
    vColor = aColor * tw;
    vSpike = aSpike;
    gl_PointSize = aSize * uPR;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const STAR_FRAG = /* glsl */ `
  uniform float uSharp;
  varying vec3 vColor;
  varying float vSpike;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d2 = dot(c, c);
    float a = exp(-d2 * uSharp) + exp(-d2 * uSharp * 0.2) * 0.18;
    float sx = exp(-abs(c.x) * 70.0) * exp(-abs(c.y) * 6.0);
    float sy = exp(-abs(c.y) * 70.0) * exp(-abs(c.x) * 6.0);
    a += vSpike * (sx + sy) * 0.7;
    gl_FragColor = vec4(vColor * a, 0.0);
  }
`;

const RING_GLSL = /* glsl */ `
  uniform vec2 uRing;
  float ringDensity(float rho) {
    float x = (rho - uRing.x) / (uRing.y - uRing.x);
    if (x < 0.0 || x > 1.0) return 0.0;
    float d = 0.45 + 0.35 * vnoise(vec2(rho * 38.0, 0.5)) + 0.25 * vnoise(vec2(rho * 140.0, 2.5));
    d *= smoothstep(0.0, 0.06, x) * smoothstep(1.0, 0.9, x);
    d *= 1.0 - 0.85 * smoothstep(0.03, 0.0, abs(x - 0.62));
    d *= 1.0 - 0.5 * smoothstep(0.015, 0.0, abs(x - 0.84));
    return clamp(d, 0.0, 1.0);
  }
`;

const PLANET_FRAG = /* glsl */ `
  varying vec2 vUv;
  uniform float uTime;
  uniform float uS;
  uniform vec3 uN;
  uniform vec3 uL;
  ${NOISE_GLSL}
  ${RING_GLSL}

  vec3 bands(float v) {
    vec3 cream = vec3(0.98, 0.88, 0.70);
    vec3 orange = vec3(0.92, 0.52, 0.22);
    vec3 brown = vec3(0.42, 0.24, 0.13);
    float s = 0.5 + 0.5 * sin(v);
    float s2 = 0.5 + 0.5 * sin(v * 2.3 + 1.7);
    return mix(mix(brown, orange, smoothstep(0.1, 0.7, s)), cream, smoothstep(0.6, 0.95, s2) * 0.55);
  }

  void main() {
    vec2 p = (vUv - 0.5) * 2.0 * uS;
    float r2 = dot(p, p);
    float r = sqrt(r2);
    float fw = fwidth(p.x);
    vec3 e1 = normalize(cross(uN, vec3(0.0, 0.0, 1.0)));
    vec3 e2 = cross(uN, e1);
    vec3 col = vec3(0.0);
    float alpha = 0.0;

    if (r < 1.0 + fw) {
      vec3 N = vec3(p, sqrt(max(0.0, 1.0 - r2)));
      float lat = dot(N, uN);
      float a = uTime * 0.018;
      float x1 = dot(N, e1), x2 = dot(N, e2);
      vec3 q = vec3(x1 * cos(a) - x2 * sin(a), x1 * sin(a) + x2 * cos(a), lat);
      float turb = fbm3(q * vec3(2.2, 2.2, 7.0) + vec3(0.0, 0.0, uTime * 0.004));
      float swirl = fbm3(q * 6.0 + turb * 2.0);
      float v = lat * 13.0 + turb * 3.2 + swirl * 0.8;
      vec3 surf = bands(v);
      surf *= 0.85 + 0.3 * swirl;

      float ndl = dot(N, uL);
      float day = smoothstep(-0.12, 0.45, ndl);
      float shadow = 1.0;
      float tp = -dot(N, uN) / dot(uL, uN);
      if (tp > 0.0) shadow -= 0.75 * ringDensity(length(N + uL * tp));
      float rim = pow(1.0 - N.z, 2.5);
      col = surf * (0.07 * vec3(0.55, 0.6, 1.0) + 0.78 * day * shadow);
      col = mix(col, vec3(0.5, 0.74, 1.0) * (0.18 + 0.7 * day), rim * 0.6);
      alpha = clamp((1.0 - r) / fw + 0.5, 0.0, 1.0);
      col *= alpha;
    }

    float halo = exp(-max(r - 1.0, 0.0) * 22.0) * smoothstep(1.0 - fw, 1.0 + fw, r);
    vec2 sunDir = normalize(uL.xy);
    float lit = 0.35 + 0.65 * smoothstep(-0.6, 0.8, dot(normalize(p), sunDir));
    col += vec3(0.45, 0.7, 1.0) * halo * lit * 0.45;
    gl_FragColor = vec4(col, alpha);
  }
`;

const RING_FRAG = /* glsl */ `
  varying vec2 vUv;
  uniform float uS;
  uniform vec3 uN;
  uniform vec3 uL;
  uniform float uFront;
  ${NOISE_GLSL}
  ${RING_GLSL}

  void main() {
    vec2 p = (vUv - 0.5) * 2.0 * uS;
    float z = -(p.x * uN.x + p.y * uN.y) / uN.z;
    if ((z > 0.0) != (uFront > 0.5)) discard;
    vec3 X = vec3(p, z);
    float rho = length(X);
    float d = ringDensity(rho);
    if (d <= 0.0) discard;
    float b = dot(X, uL);
    float c = dot(X, X) - 1.0;
    float lit = (b < 0.0 && b * b - c > 0.0) ? 0.2 : 1.0;
    float x = (rho - uRing.x) / (uRing.y - uRing.x);
    vec3 tint = mix(vec3(0.95, 0.86, 0.72), vec3(0.72, 0.6, 0.48), vnoise(vec2(rho * 17.0, 7.0)));
    tint = mix(tint, vec3(0.85, 0.9, 1.0), smoothstep(0.75, 1.0, x) * 0.5);
    vec3 col = tint * (0.25 + 0.6 * abs(dot(uN, uL))) * lit;
    float a = d * 0.72;
    gl_FragColor = vec4(col * a, a);
  }
`;

const DUST_VERT = /* glsl */ `
  attribute vec4 aOrbit;
  uniform float uTime;
  uniform float uR;
  uniform vec2 uC;
  uniform vec3 uE1;
  uniform vec3 uE2;
  uniform vec3 uN;
  uniform float uPR;
  varying float vAlpha;
  varying float vGlint;
  void main() {
    float rho = aOrbit.x;
    float th = aOrbit.y + uTime * 0.06 * pow(rho, -1.5);
    vec3 X = rho * (cos(th) * uE1 + sin(th) * uE2) + uN * aOrbit.z;
    float hidden = (X.z < 0.0 && length(X.xy) < 1.0) ? 0.0 : 1.0;
    vGlint = step(0.93, fract(aOrbit.w * 13.7)) * (0.5 + 0.5 * sin(uTime * 3.0 + aOrbit.w * 50.0));
    vAlpha = hidden * (0.35 + 0.65 * fract(aOrbit.w * 7.3));
    gl_PointSize = (1.2 + 2.2 * fract(aOrbit.w * 3.1) + vGlint * 3.0) * uPR;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(uC + X.xy * uR, 0.0, 1.0);
  }
`;

const DUST_FRAG = /* glsl */ `
  varying float vAlpha;
  varying float vGlint;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float a = pow(max(0.0, 1.0 - d), 2.0) * vAlpha;
    vec3 col = mix(vec3(0.75, 0.82, 0.95) * 0.55, vec3(1.6, 1.8, 2.0), vGlint);
    gl_FragColor = vec4(col * a, 0.0);
  }
`;

const METEOR_FRAG = /* glsl */ `
  varying vec2 vUv;
  uniform float uAlpha;
  void main() {
    float along = vUv.x;
    float across = (vUv.y - 0.5) * 2.0;
    float a = pow(along, 2.5) * exp(-across * across * 4.0) * uAlpha;
    float head = exp(-pow((1.0 - along) * 40.0, 2.0)) * exp(-across * across * 2.0);
    vec3 col = mix(vec3(0.5, 0.75, 1.0), vec3(1.0), along) * (a * 1.6 + head * 2.5 * uAlpha);
    gl_FragColor = vec4(col, 0.0);
  }
`;

function starLayer(prU, rand, box, count, sizeMin, sizeMax, bright, spikeRatio, sharp) {
  const pos = new Float32Array(count * 3);
  const size = new Float32Array(count);
  const color = new Float32Array(count * 3);
  const phase = new Float32Array(count);
  const spike = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = box.x + rand() * box.w;
    pos[i * 3 + 1] = -(box.y + rand() * box.h);
    const s = rand();
    size[i] = sizeMin + (sizeMax - sizeMin) * s * s;
    const tint = rand();
    const c = tint < 0.15 ? [1.0, 0.8, 0.6] : tint < 0.45 ? [0.7, 0.82, 1.0] : [0.92, 0.95, 1.0];
    const k = bright * (0.4 + 0.6 * rand());
    color.set([c[0] * k, c[1] * k, c[2] * k], i * 3);
    phase[i] = rand();
    spike[i] = rand() < spikeRatio ? 1 : 0;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  geo.setAttribute('aColor', new THREE.BufferAttribute(color, 3));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
  geo.setAttribute('aSpike', new THREE.BufferAttribute(spike, 1));
  const pts = new THREE.Points(
    geo,
    new THREE.ShaderMaterial({
      uniforms: {
        uOff: { value: new THREE.Vector2() },
        uTime: { value: 0 },
        uPR: prU,
        uSharp: { value: sharp },
      },
      vertexShader: STAR_VERT,
      fragmentShader: STAR_FRAG,
      ...premultiplied,
    }),
  );
  pts.frustumCulled = false;
  return pts;
}

function rockGeometry(seed) {
  const g = new THREE.IcosahedronGeometry(1, 1);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const f =
      1 +
      0.22 * Math.sin(v.x * 3.1 + seed) * Math.cos(v.y * 2.7 + seed * 2) +
      0.12 * Math.sin(v.z * 5.3 + seed * 3);
    v.multiplyScalar(f);
    v.y *= 0.75;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

// prU: shared { value } uniform holding the render pixel ratio.
export function createSpace(scene, layout, prU) {
  const { screen, planet, ringNormal, ringRange, sun, galaxy } = layout;
  const rand = mulberry32(20261007);
  const pad = 420;
  const box = { x: screen.x - pad, y: screen.y - pad, w: screen.w + pad * 2, h: screen.h + pad * 2 };
  const areaScale = (screen.w * screen.h) / (1710 * 986);

  const nebula = new THREE.Mesh(
    quadGeo,
    new THREE.ShaderMaterial({
      uniforms: {
        uOff: { value: new THREE.Vector2() },
        uTime: { value: 0 },
        uGal: { value: new THREE.Vector4(galaxy.x, galaxy.y, galaxy.size, 0) },
      },
      vertexShader: NEBULA_VERT,
      fragmentShader: NEBULA_FRAG,
      depthTest: false,
      depthWrite: false,
    }),
  );
  nebula.renderOrder = 0;
  nebula.frustumCulled = false;
  scene.add(nebula);

  const layers = [
    { pts: starLayer(prU, rand, box, Math.round(1800 * areaScale), 1.5, 3.2, 0.9, 0, 30), parallax: 0.05 },
    { pts: starLayer(prU, rand, box, Math.round(600 * areaScale), 2.5, 5, 1.4, 0, 22), parallax: 0.0 },
    { pts: starLayer(prU, rand, box, Math.round(100 * areaScale), 14, 34, 2.6, 0.45, 90), parallax: -0.06 },
  ];
  layers.forEach((l, i) => {
    l.pts.renderOrder = 1 + i * 0.1;
    scene.add(l.pts);
  });

  const meteors = [0, 1].map(() => {
    const m = new THREE.Mesh(
      quadGeo,
      new THREE.ShaderMaterial({
        uniforms: { uAlpha: { value: 0 } },
        vertexShader: QUAD_VERT,
        fragmentShader: METEOR_FRAG,
        ...premultiplied,
      }),
    );
    m.renderOrder = 1.5;
    m.frustumCulled = false;
    scene.add(m);
    return m;
  });

  const S = 1.12;
  const ringS = ringRange[1] + 0.05;
  const planetUniforms = {
    uTime: { value: 0 },
    uS: { value: S },
    uN: { value: ringNormal },
    uL: { value: sun },
    uRing: { value: new THREE.Vector2(...ringRange) },
  };
  const ringMat = (front) =>
    new THREE.ShaderMaterial({
      uniforms: { ...planetUniforms, uS: { value: ringS }, uFront: { value: front } },
      vertexShader: QUAD_VERT,
      fragmentShader: RING_FRAG,
      ...premultiplied,
    });
  const ringBack = new THREE.Mesh(quadGeo, ringMat(0));
  const ringFront = new THREE.Mesh(quadGeo, ringMat(1));
  const planetMesh = new THREE.Mesh(
    quadGeo,
    new THREE.ShaderMaterial({
      uniforms: planetUniforms,
      vertexShader: QUAD_VERT,
      fragmentShader: PLANET_FRAG,
      ...premultiplied,
    }),
  );
  for (const [m, s, order] of [
    [ringBack, ringS, 2],
    [planetMesh, S, 3],
    [ringFront, ringS, 4],
  ]) {
    m.position.set(planet.x, -planet.y, 0);
    m.scale.set(2 * s * planet.R, 2 * s * planet.R, 1);
    m.renderOrder = order;
    m.frustumCulled = false;
    scene.add(m);
  }

  const e1 = new THREE.Vector3().crossVectors(ringNormal, new THREE.Vector3(0, 0, 1)).normalize();
  const e2 = new THREE.Vector3().crossVectors(ringNormal, e1);
  const dustCount = Math.round(1600 * areaScale);
  const orbit = new Float32Array(dustCount * 4);
  for (let i = 0; i < dustCount; i++) {
    const inRing = rand() < 0.7;
    const rho = inRing ? ringRange[0] + rand() * (ringRange[1] - ringRange[0]) : 1.1 + rand() * 1.6;
    orbit.set([rho, rand() * Math.PI * 2, (rand() - 0.5) * (inRing ? 0.02 : 0.12), rand()], i * 4);
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(dustCount * 3), 3));
  dustGeo.setAttribute('aOrbit', new THREE.BufferAttribute(orbit, 4));
  const dust = new THREE.Points(
    dustGeo,
    new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uR: { value: planet.R },
        uC: { value: new THREE.Vector2(planet.x, -planet.y) },
        uE1: { value: e1 },
        uE2: { value: e2 },
        uN: { value: ringNormal },
        uPR: prU,
      },
      vertexShader: DUST_VERT,
      fragmentShader: DUST_FRAG,
      ...premultiplied,
    }),
  );
  dust.renderOrder = 5;
  dust.frustumCulled = false;
  scene.add(dust);

  // Asteroid clusters drifting across the screen.
  const light = new THREE.DirectionalLight(0xfff1dd, 2.6);
  light.position.copy(sun);
  scene.add(light, new THREE.AmbientLight(0x6a5a90, 0.35));
  const clusters = [];
  const rocksPerCluster = 9;
  const clusterCount = 4;
  const rockGeo = rockGeometry(3.7);
  const rocks = new THREE.InstancedMesh(
    rockGeo,
    new THREE.MeshLambertMaterial({ color: 0x9a8a7c, flatShading: true, transparent: true }),
    clusterCount * rocksPerCluster,
  );
  rocks.renderOrder = 6;
  rocks.frustumCulled = false;
  scene.add(rocks);
  for (let c = 0; c < clusterCount; c++) {
    const a = rand() * Math.PI * 2;
    const speed = 5 + rand() * 7;
    const members = [];
    for (let i = 0; i < rocksPerCluster; i++) {
      const axis = new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize();
      members.push({
        ox: (rand() - 0.5) * 160,
        oy: (rand() - 0.5) * 110,
        size: 3 + rand() * rand() * 12,
        axis,
        spin: 0.15 + rand() * 0.5,
        phase: rand() * 10,
      });
    }
    clusters.push({ x: box.x + rand() * box.w, y: box.y + rand() * box.h, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, members });
  }
  const dummy = new THREE.Object3D();
  const wrap = (v, lo, size) => lo + ((((v - lo) % size) + size) % size);

  function updateMeteors(t) {
    const slotLen = 4;
    const k = Math.floor(t / slotLen);
    meteors.forEach((m, i) => {
      const slot = k - i;
      const r = mulberry32(slot * 7919 + 13);
      const show = r() < 0.75;
      const start = slot * slotLen + r() * 2.5;
      const dur = 1.0 + r() * 0.5;
      const x0 = screen.x + r() * screen.w;
      const y0 = screen.y - 60 + r() * screen.h * 0.45;
      let ang = Math.PI * (0.12 + r() * 0.25);
      if (r() < 0.5) ang = Math.PI - ang;
      const speed = 900 + r() * 500;
      const age = t - start;
      if (!show || age < 0 || age > dur) {
        m.visible = false;
        return;
      }
      m.visible = true;
      const len = 280;
      const dx = Math.cos(ang);
      const dy = Math.sin(ang);
      const hx = x0 + dx * speed * age;
      const hy = y0 + dy * speed * age;
      m.position.set(hx - (dx * len) / 2, -(hy - (dy * len) / 2), 0);
      m.rotation.z = -ang;
      m.scale.set(len, 4, 1);
      m.material.uniforms.uAlpha.value = Math.min(1, age / 0.15) * Math.min(1, (dur - age) / 0.3);
    });
  }

  // view: world rect the camera shows; offset: shared parallax reference.
  function update(view, t, offset) {
    nebula.position.set(view.x + view.w / 2, -(view.y + view.h / 2), 0);
    nebula.scale.set(view.w, view.h, 1);
    nebula.material.uniforms.uTime.value = t;
    nebula.material.uniforms.uOff.value.set(offset.x * 0.08, offset.y * 0.08);
    for (const l of layers) {
      l.pts.material.uniforms.uTime.value = t;
      l.pts.material.uniforms.uOff.value.set(offset.x * l.parallax, offset.y * l.parallax);
    }
    planetUniforms.uTime.value = t;
    dust.material.uniforms.uTime.value = t;
    updateMeteors(t);

    let n = 0;
    for (const c of clusters) {
      const cx = wrap(c.x + c.vx * t, box.x, box.w);
      const cy = wrap(c.y + c.vy * t, box.y, box.h);
      for (const r of c.members) {
        const sway = Math.sin(t * 0.2 + r.phase) * 6;
        dummy.position.set(cx + r.ox + sway, -(cy + r.oy + sway * 0.5), 0);
        dummy.quaternion.setFromAxisAngle(r.axis, t * r.spin + r.phase);
        dummy.scale.setScalar(r.size);
        dummy.updateMatrix();
        rocks.setMatrixAt(n++, dummy.matrix);
      }
    }
    rocks.instanceMatrix.needsUpdate = true;
  }

  return { update };
}
