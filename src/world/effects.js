import * as THREE from 'three';
import { QUAD_VERT, hash3, mulberry32, premultiplied, quadGeo } from './common.js';
import { GLOW_FRAG, makeSparks } from './comet.js';

// The swallow plays in two beats: light collapses into the hole for
// COLLAPSE seconds, then the shock wave, flash and shake follow.
export const COLLAPSE = 0.45;
const SHOCK_DUR = 1.7;
const SHAKE_DUR = 0.55;

const RING_FRAG = /* glsl */ `
  varying vec2 vUv;
  uniform vec3 uColor;
  uniform float uRadius;
  uniform float uWidth;
  uniform float uSize;
  void main() {
    float d = length(vUv - 0.5) * uSize;
    float k = (d - uRadius) / uWidth;
    gl_FragColor = vec4(uColor * exp(-k * k), 0.0);
  }
`;

const easeOut = (k) => 1 - (1 - k) ** 3;
const clamp01 = (v) => Math.min(1, Math.max(0, v));

function ringMesh() {
  const m = new THREE.Mesh(
    quadGeo,
    new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Vector3() },
        uRadius: { value: 0 },
        uWidth: { value: 4 },
        uSize: { value: 1 },
      },
      vertexShader: QUAD_VERT,
      fragmentShader: RING_FRAG,
      ...premultiplied,
    }),
  );
  m.frustumCulled = false;
  return m;
}

function setRing(m, x, y, radius, width, r, g, b) {
  const size = 2 * (radius + width * 4);
  const u = m.material.uniforms;
  u.uRadius.value = radius;
  u.uWidth.value = width;
  u.uSize.value = size;
  u.uColor.value.set(r, g, b);
  m.position.set(x, -y, 0);
  m.scale.set(size, size, 1);
}

function flareMesh() {
  const m = new THREE.Mesh(
    quadGeo,
    new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Vector3() }, uPow: { value: 2.0 } },
      vertexShader: QUAD_VERT,
      fragmentShader: GLOW_FRAG,
      ...premultiplied,
    }),
  );
  m.frustumCulled = false;
  return m;
}

export function createEffects(scene, prU) {
  const active = [];

  function bounce(fx) {
    const n = 22;
    const s = makeSparks(n, prU);
    const rand = mulberry32(Math.floor(hash3(fx.x * 10, fx.y * 10, fx.t % 1e6) * 1e9));
    const parts = Array.from({ length: n }, () => ({ a: rand() * Math.PI * 2, v: 90 + rand() * 260, s: 2 + rand() * 4 }));
    return {
      dur: 0.55,
      objects: [s.points],
      draw(age, k) {
        parts.forEach((p, i) => {
          const d = p.v * (1 - Math.exp(-4 * age)) / 4;
          const f = 1 - k;
          s.set(i, fx.x + Math.cos(p.a) * d, fx.y + Math.sin(p.a) * d, p.s * (0.4 + f), 1.6 * f, 2.0 * f, 2.4 * f);
        });
        s.commit();
      },
    };
  }

  // A small prism: offset RGB rings plus a cross-shaped flare.
  function ripple(fx) {
    const rings = [ringMesh(), ringMesh(), ringMesh()];
    const flares = [flareMesh(), flareMesh()];
    const tint = [
      [1.6, 0.15, 0.25],
      [0.2, 1.5, 0.4],
      [0.25, 0.4, 1.8],
    ];
    return {
      dur: 0.6,
      objects: [...rings, ...flares],
      draw(age, k) {
        const f = 1 - k;
        rings.forEach((m, i) => {
          const [r, g, b] = tint[i];
          setRing(m, fx.x, fx.y, easeOut(k) * (46 + i * 7), 3, r * f, g * f, b * f);
        });
        const len = 40 + 160 * easeOut(k);
        flares.forEach((m, i) => {
          m.position.set(fx.x, -fx.y, 0);
          m.scale.set(i ? 5 : len, i ? len * 0.6 : 5, 1);
          m.material.uniforms.uColor.value.set(1.8 * f, 2.2 * f, 2.6 * f);
        });
      },
    };
  }

  function win(fx) {
    const rand = mulberry32(fx.seed);
    const inN = 110;
    const outN = 170;
    const implode = makeSparks(inN, prU);
    const burst = makeSparks(outN, prU);
    const inParts = Array.from({ length: inN }, () => ({ a: rand() * Math.PI * 2, r: 160 + rand() * 520, s: 2 + rand() * 4 }));
    const outParts = Array.from({ length: outN }, () => ({ a: rand() * Math.PI * 2, v: 300 + rand() * 1300, s: 3 + rand() * 9, h: rand() }));
    const core = flareMesh();
    const shock = ringMesh();
    const shock2 = ringMesh();
    return {
      dur: COLLAPSE + SHOCK_DUR,
      win: true,
      objects: [implode.points, burst.points, core, shock, shock2],
      draw(age) {
        const c = clamp01(age / COLLAPSE);
        const after = age - COLLAPSE;
        inParts.forEach((p, i) => {
          const rr = p.r * (1 - c * c);
          const f = c < 1 ? Math.sin(c * Math.PI) : 0;
          implode.set(i, fx.x + Math.cos(p.a) * rr, fx.y + Math.sin(p.a) * rr, p.s, 1.8 * f, 1.2 * f, 0.6 * f);
        });
        implode.commit();

        const pop = after < 0 ? c * c * 70 : 70 + after * 900;
        const coreI = after < 0 ? 1 + 4 * c * c : Math.max(0, 5 * (1 - after / 0.35));
        core.position.set(fx.x, -fx.y, 0);
        core.scale.set(pop, pop, 1);
        core.material.uniforms.uColor.value.set(coreI, coreI * 0.92, coreI * 0.8);

        if (after < 0) {
          shock.visible = shock2.visible = burst.points.visible = false;
          return;
        }
        shock.visible = shock2.visible = burst.points.visible = true;
        const k = clamp01(after / SHOCK_DUR);
        const f = 1 - k;
        setRing(shock, fx.x, fx.y, easeOut(k) * 3400, 34 + 40 * k, 2.4 * f, 2.4 * f, 2.6 * f);
        const k2 = clamp01((after - 0.08) / (SHOCK_DUR * 0.8));
        setRing(shock2, fx.x, fx.y, easeOut(k2) * 2000, 12, 0.6 * (1 - k2), 1.4 * (1 - k2), 2.2 * (1 - k2));
        const travel = (1 - Math.exp(-2.2 * after)) / 2.2;
        outParts.forEach((p, i) => {
          const d = p.v * travel;
          const g = Math.max(0, 1 - after / 1.3);
          const gold = p.h < 0.6;
          burst.set(
            i,
            fx.x + Math.cos(p.a) * d,
            fx.y + Math.sin(p.a) * d,
            p.s * (0.3 + 0.7 * g),
            (gold ? 2.2 : 0.6) * g,
            (gold ? 1.5 : 1.6) * g,
            (gold ? 0.6 : 2.2) * g,
          );
        });
        burst.commit();
      },
    };
  }

  const builders = { bounce, ripple, win };

  function add(fx) {
    const e = builders[fx.kind]?.(fx);
    if (!e) return;
    e.fx = fx;
    e.objects.forEach((o) => {
      o.renderOrder = 30;
      scene.add(o);
    });
    active.push(e);
  }

  // Returns the post-processing state of the latest swallow, if one is playing.
  function update(now) {
    let swallow = null;
    for (let i = active.length - 1; i >= 0; i--) {
      const e = active[i];
      const age = (now - e.fx.t) / 1000;
      if (age >= e.dur) {
        for (const o of e.objects) {
          scene.remove(o);
          o.material.dispose();
          if (o.geometry !== quadGeo) o.geometry.dispose();
        }
        active.splice(i, 1);
        continue;
      }
      e.draw(Math.max(0, age), Math.max(0, age) / e.dur);
      if (e.win && !swallow) swallow = swallowState(e.fx, Math.max(0, age));
    }
    return swallow;
  }

  return { add, update };
}

function swallowState(fx, age) {
  const c = clamp01(age / COLLAPSE);
  const after = age - COLLAPSE;
  const shockK = clamp01(after / SHOCK_DUR);
  const shake = after > 0 && after < SHAKE_DUR ? 14 * (1 - after / SHAKE_DUR) ** 2 : 0;
  return {
    x: fx.x,
    y: fx.y,
    age,
    collapsing: after < 0,
    dark: after < 0 ? c : Math.max(0, 1 - after / 0.25),
    darkR: after < 0 ? 2600 * (1 - easeOut(c)) + 40 : 40,
    pinch: after < 0 ? 55 * c * c : 0,
    shockR: after > 0 ? easeOut(shockK) * 3400 : -1000,
    shockA: after > 0 ? 26 * (1 - shockK) : 0,
    shakeX: shake * Math.sin(age * 73.0) * Math.cos(age * 31.0),
    shakeY: shake * Math.cos(age * 67.0) * Math.sin(age * 41.0 + 1.0),
  };
}
