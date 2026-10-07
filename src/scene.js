import * as THREE from 'three';
import { BALL_R, STAR_R, TRAIL_LEN } from './game.js';

// World coordinates are screen pixels with y pointing down; Three.js gets
// (x, -y). Colors are used as raw values, no sRGB conversion.
THREE.ColorManagement.enabled = false;

const CYAN = new THREE.Color(0x22e6ff);
const GOLD = new THREE.Color(0xffc940);
const WHITE = new THREE.Color(0xffffff);

const QUAD_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const BG_FRAG = /* glsl */ `
  varying vec2 vWorld;
  uniform vec3 uBall;
  uniform vec3 uStar;

  float grid(vec2 p, float cell, float width) {
    vec2 d = abs(fract(p / cell + 0.5) - 0.5) * cell;
    float px = max(fwidth(p.x), 1e-3);
    return clamp(1.0 - (min(d.x, d.y) - width * 0.5) / px, 0.0, 1.0);
  }

  void main() {
    vec2 p = vWorld;
    vec3 col = vec3(0.010, 0.016, 0.040);
    float g = grid(p, 40.0, 1.0) * 0.35 + grid(p, 200.0, 1.0);
    col += vec3(0.07, 0.11, 0.22) * g;

    float db = distance(p, uBall.xy);
    col += vec3(0.0, 0.40, 0.55) * uBall.z * 0.20 * exp(-db / 160.0);
    col += vec3(0.25, 0.85, 1.0) * uBall.z * g * 0.55 * exp(-db / 260.0);

    float ds = distance(p, uStar.xy);
    col += vec3(0.55, 0.38, 0.05) * uStar.z * 0.16 * exp(-ds / 180.0);
    col += vec3(1.0, 0.8, 0.3) * uStar.z * g * 0.35 * exp(-ds / 240.0);

    gl_FragColor = vec4(col, 1.0);
  }
`;

const BG_VERT = /* glsl */ `
  varying vec2 vWorld;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = vec2(w.x, -w.y);
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const GLOW_FRAG = /* glsl */ `
  varying vec2 vUv;
  uniform vec3 uColor;
  uniform float uAlpha;
  void main() {
    float d = length(vUv - 0.5) * 2.0;
    float a = pow(max(0.0, 1.0 - d), 2.2) * uAlpha;
    gl_FragColor = vec4(uColor, a);
  }
`;

const RING_FRAG = /* glsl */ `
  varying vec2 vUv;
  uniform vec3 uColor;
  uniform float uAlpha;
  uniform float uRadius;
  uniform float uWidth;
  uniform float uSize;
  void main() {
    float d = length(vUv - 0.5) * uSize;
    float k = (d - uRadius) / uWidth;
    gl_FragColor = vec4(uColor, exp(-k * k) * uAlpha);
  }
`;

const TRAIL_VERT = /* glsl */ `
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

const TRAIL_FRAG = /* glsl */ `
  varying float vAlpha;
  varying float vSide;
  uniform vec3 uColor;
  void main() {
    float edge = 1.0 - vSide * vSide;
    gl_FragColor = vec4(uColor, vAlpha * edge);
  }
`;

const SPARK_VERT = /* glsl */ `
  attribute float aSize;
  attribute float aHue;
  uniform float uScale;
  uniform float uPR;
  varying float vHue;
  void main() {
    vHue = aHue;
    gl_PointSize = aSize * uScale * uPR;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SPARK_FRAG = /* glsl */ `
  varying float vHue;
  uniform float uAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float a = pow(max(0.0, 1.0 - d), 2.0) * uAlpha;
    vec3 col = mix(vec3(1.0, 0.82, 0.3), vec3(0.35, 0.95, 1.0), vHue);
    gl_FragColor = vec4(col, a);
  }
`;

// DoubleSide: flipping y reverses triangle winding for geometry built in world space.
const additive = {
  side: THREE.DoubleSide,
  transparent: true,
  depthTest: false,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
};

const quadGeo = new THREE.PlaneGeometry(1, 1);

function glow(color, alpha, size) {
  const m = new THREE.Mesh(
    quadGeo,
    new THREE.ShaderMaterial({
      uniforms: { uColor: { value: color }, uAlpha: { value: alpha } },
      vertexShader: QUAD_VERT,
      fragmentShader: GLOW_FRAG,
      ...additive,
    }),
  );
  m.scale.set(size, size, 1);
  return m;
}

function starShape(outer, inner) {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? inner : outer;
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  }
  s.closePath();
  return s;
}

function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x03050c, 1);
  renderer.setSize(window.innerWidth, window.innerHeight);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(0, 1, 0, -1, -100, 100);
  camera.position.z = 10;

  const bgMat = new THREE.ShaderMaterial({
    uniforms: { uBall: { value: new THREE.Vector3() }, uStar: { value: new THREE.Vector3() } },
    vertexShader: BG_VERT,
    fragmentShader: BG_FRAG,
    depthTest: false,
    depthWrite: false,
  });
  const bg = new THREE.Mesh(quadGeo, bgMat);
  bg.renderOrder = 0;
  scene.add(bg);

  // Trail: a tapered ribbon through the last TRAIL_LEN ball positions.
  const trailPos = new Float32Array(TRAIL_LEN * 2 * 3);
  const trailAlpha = new Float32Array(TRAIL_LEN * 2);
  const trailSide = new Float32Array(TRAIL_LEN * 2).map((_, i) => (i % 2 ? 1 : -1));
  const trailIdx = [];
  for (let i = 0; i < TRAIL_LEN - 1; i++) {
    const a = i * 2;
    trailIdx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const trailGeo = new THREE.BufferGeometry();
  trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
  trailGeo.setAttribute('aAlpha', new THREE.BufferAttribute(trailAlpha, 1));
  trailGeo.setAttribute('aSide', new THREE.BufferAttribute(trailSide, 1));
  trailGeo.setIndex(trailIdx);
  const trail = new THREE.Mesh(
    trailGeo,
    new THREE.ShaderMaterial({
      uniforms: { uColor: { value: CYAN } },
      vertexShader: TRAIL_VERT,
      fragmentShader: TRAIL_FRAG,
      ...additive,
    }),
  );
  trail.frustumCulled = false;
  trail.renderOrder = 1;
  scene.add(trail);

  const star = new THREE.Group();
  const starGlow = glow(GOLD, 0.55, STAR_R * 7);
  const starBody = new THREE.Mesh(
    new THREE.ShapeGeometry(starShape(STAR_R, STAR_R * 0.45)),
    new THREE.MeshBasicMaterial({ color: GOLD, depthTest: false, depthWrite: false, transparent: true }),
  );
  const starCore = new THREE.Mesh(
    starBody.geometry,
    new THREE.MeshBasicMaterial({ color: 0xfff3c4, depthTest: false, depthWrite: false, transparent: true }),
  );
  starCore.scale.setScalar(0.45);
  star.add(starGlow, starBody, starCore);
  star.renderOrder = 2;
  star.traverse((o) => (o.renderOrder = 2));
  scene.add(star);

  const ball = new THREE.Group();
  const ballCore = new THREE.Mesh(
    new THREE.CircleGeometry(BALL_R, 48),
    new THREE.MeshBasicMaterial({ color: 0xdffcff, depthTest: false, depthWrite: false, transparent: true }),
  );
  ball.add(glow(CYAN, 0.75, BALL_R * 11), glow(CYAN, 1.0, BALL_R * 3.6), ballCore);
  ball.traverse((o) => (o.renderOrder = 4));
  scene.add(ball);

  const effects = [];

  function ringMesh(color) {
    const m = new THREE.Mesh(
      quadGeo,
      new THREE.ShaderMaterial({
        uniforms: {
          uColor: { value: color },
          uAlpha: { value: 0 },
          uRadius: { value: 0 },
          uWidth: { value: 4 },
          uSize: { value: 1 },
        },
        vertexShader: QUAD_VERT,
        fragmentShader: RING_FRAG,
        ...additive,
      }),
    );
    m.renderOrder = 3;
    m.frustumCulled = false;
    return m;
  }

  function setRing(m, x, y, radius, width, alpha) {
    const size = 2 * (radius + width * 4);
    const u = m.material.uniforms;
    u.uRadius.value = radius;
    u.uWidth.value = width;
    u.uAlpha.value = alpha;
    u.uSize.value = size;
    m.position.set(x, -y, 0);
    m.scale.set(size, size, 1);
  }

  // Each effect: { t0, dur, objects, draw(age, k) } — age in seconds, k in 0..1.
  // Effects are timed on the shared wall clock so every window shows the same frame.
  function addFx(fx) {
    const easeOut = (k) => 1 - (1 - k) ** 3;
    let e;
    if (fx.kind === 'bounce') {
      const r = ringMesh(CYAN);
      e = { dur: 0.35, objects: [r], draw: (_, k) => setRing(r, fx.x, fx.y, 6 + easeOut(k) * 22, 2.5, 0.5 * (1 - k)) };
    } else if (fx.kind === 'ripple') {
      const a = ringMesh(CYAN);
      const b = ringMesh(WHITE);
      e = {
        dur: 0.7,
        objects: [a, b],
        draw: (age, k) => {
          setRing(a, fx.x, fx.y, easeOut(k) * 90, 5, 1.1 * (1 - k));
          const k2 = Math.min(1, Math.max(0, (age - 0.08) / 0.5));
          setRing(b, fx.x, fx.y, easeOut(k2) * 55, 2.5, k2 > 0 ? 0.9 * (1 - k2) : 0);
        },
      };
    } else if (fx.kind === 'win') {
      e = winFx(fx, easeOut);
    }
    if (!e) return;
    e.t0 = fx.t;
    for (const o of e.objects) scene.add(o);
    effects.push(e);
  }

  function winFx(fx, easeOut) {
    const rand = mulberry32(fx.seed);
    const n = 180;
    const dirs = [];
    const pos = new Float32Array(n * 3);
    const size = new Float32Array(n);
    const hue = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const a = rand() * Math.PI * 2;
      dirs.push([Math.cos(a), Math.sin(a), 250 + rand() * 900]);
      size[i] = 6 + rand() * 16;
      hue[i] = rand() < 0.35 ? 1 : rand() * 0.3;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    geo.setAttribute('aHue', new THREE.BufferAttribute(hue, 1));
    const sparks = new THREE.Points(
      geo,
      new THREE.ShaderMaterial({
        uniforms: { uScale: { value: 1 }, uAlpha: { value: 1 }, uPR: { value: renderer.getPixelRatio() } },
        vertexShader: SPARK_VERT,
        fragmentShader: SPARK_FRAG,
        ...additive,
      }),
    );
    sparks.frustumCulled = false;
    sparks.renderOrder = 3;

    // The big ring sweeps across the whole screen, so every window sees it.
    const wave = ringMesh(GOLD);
    const inner = ringMesh(WHITE);
    const drag = 2.4;
    return {
      dur: 1.8,
      objects: [sparks, wave, inner],
      draw: (age, k) => {
        const travel = (1 - Math.exp(-drag * age)) / drag;
        for (let i = 0; i < n; i++) {
          const [dx, dy, s] = dirs[i];
          pos[i * 3] = fx.x + dx * s * travel;
          pos[i * 3 + 1] = -(fx.y + dy * s * travel);
        }
        geo.attributes.position.needsUpdate = true;
        sparks.material.uniforms.uScale.value = 1 - k * 0.7;
        sparks.material.uniforms.uAlpha.value = 1 - k;
        setRing(wave, fx.x, fx.y, easeOut(k) * 3000, 22, 0.9 * (1 - k));
        const k2 = Math.min(1, age / 0.6);
        setRing(inner, fx.x, fx.y, easeOut(k2) * 260, 6, 1.2 * (1 - k2));
      },
    };
  }

  function drawEffects(now) {
    for (let i = effects.length - 1; i >= 0; i--) {
      const e = effects[i];
      const age = (now - e.t0) / 1000;
      if (age >= e.dur) {
        for (const o of e.objects) {
          scene.remove(o);
          o.material.dispose();
          if (o.geometry !== quadGeo) o.geometry.dispose();
        }
        effects.splice(i, 1);
        continue;
      }
      e.draw(Math.max(0, age), Math.max(0, age) / e.dur);
    }
  }

  function drawTrail(points) {
    const n = points.length;
    if (n < 2) {
      trailGeo.setDrawRange(0, 0);
      return;
    }
    let nx = 0;
    let ny = 1;
    for (let i = 0; i < n; i++) {
      const p0 = points[Math.max(0, i - 1)];
      const p1 = points[Math.min(n - 1, i + 1)];
      const dx = p1[0] - p0[0];
      const dy = p1[1] - p0[1];
      const len = Math.hypot(dx, dy);
      if (len > 1e-3) {
        nx = -dy / len;
        ny = dx / len;
      }
      const t = i / (n - 1);
      const w = BALL_R * (0.1 + 0.8 * t);
      const [x, y] = points[i];
      trailPos.set([x + nx * w, -(y + ny * w), 0, x - nx * w, -(y - ny * w), 0], i * 6);
      const a = t ** 1.6 * 0.6;
      trailAlpha[i * 2] = a;
      trailAlpha[i * 2 + 1] = a;
    }
    trailGeo.attributes.position.needsUpdate = true;
    trailGeo.attributes.aAlpha.needsUpdate = true;
    trailGeo.setDrawRange(0, (n - 1) * 6);
  }

  function render(rect, view, now) {
    if (renderer.domElement.clientWidth !== rect.w || renderer.domElement.clientHeight !== rect.h) {
      renderer.setSize(rect.w, rect.h);
    }
    camera.left = rect.x;
    camera.right = rect.x + rect.w;
    camera.top = -rect.y;
    camera.bottom = -(rect.y + rect.h);
    camera.updateProjectionMatrix();
    bg.position.set(rect.x + rect.w / 2, -(rect.y + rect.h / 2), 0);
    bg.scale.set(rect.w, rect.h, 1);

    const time = now / 1000;
    ball.visible = star.visible = !!view;
    if (view) {
      const b = view.ball;
      ball.position.set(b.x, -b.y, 0);
      ball.scale.setScalar(b.active ? 1 : 1 + 0.12 * Math.sin(time * 4));
      bgMat.uniforms.uBall.value.set(b.x, b.y, 1);

      star.position.set(view.star.x, -view.star.y, 0);
      star.rotation.z = time * 0.6;
      star.scale.setScalar(1 + 0.08 * Math.sin(time * 3));
      bgMat.uniforms.uStar.value.set(view.star.x, view.star.y, 1);
      drawTrail(view.trail);
    } else {
      bgMat.uniforms.uBall.value.z = 0;
      bgMat.uniforms.uStar.value.z = 0;
      drawTrail([]);
    }

    drawEffects(now);
    renderer.render(scene, camera);
  }

  return { render, addFx };
}
