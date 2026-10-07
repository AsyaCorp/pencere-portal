import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { sectorOf } from '../view/map.js';
import { sharedTime } from '../view/style.js';
import { Colossal, Levi, Titan, Z_LEVI, Z_TITAN, loadModels, makeClips } from './actors.js';
import { createAudio } from './audio.js';
import { buildCity } from './city.js';
import { Particles, plume, ringMaterial } from './fx3d.js';
import { COLOSSAL_MS, COLOSSAL_READY_MS, END_MS, KILLS_TO_COLOSSAL, LEVI_H, LIVES, TITAN_HEIGHTS, hookTarget, napeOf } from './game.js';
import { titanLayout, Z_COLOSSAL } from './world.js';

const Z_SKY = -14000;

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smooth = (a, b, v) => {
  const k = clamp01((v - a) / (b - a));
  return k * k * (3 - 2 * k);
};
const frac = (v) => v - Math.floor(v);

function screenBounds() {
  const s = window.screen;
  return { x: s.availLeft ?? 0, y: s.availTop ?? 0, w: s.availWidth, h: s.availHeight };
}

const SKY_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uDark;
  uniform float uAspect;
  uniform vec2 uSun;
  uniform vec3 cZenith, cHigh, cLow, cHorizon, cSun, cCloudDark, cCloudLit;
  varying vec2 vUv;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + 11.7; a *= 0.5; }
    return v;
  }
  void main() {
    vec2 s = vec2(-0.2 + 1.4 * vUv.x, 1.2 - 1.4 * vUv.y);
    float y = s.y;
    vec3 col = mix(cZenith, cHigh, smoothstep(0.0, 0.22, y));
    col = mix(col, cLow, smoothstep(0.18, 0.36, y));
    col = mix(col, cHorizon, smoothstep(0.32, 0.48, y));
    vec2 d = vec2((s.x - uSun.x) * uAspect, s.y - uSun.y);
    float r = length(d);
    col += cSun * (exp(-r * 9.0) * 0.55 + exp(-r * 2.6) * 0.25) * (1.0 - uDark * 0.8);
    float disc = smoothstep(0.034, 0.03, r);
    vec2 cp = vec2(s.x * uAspect * 2.2 + uTime * 0.006, s.y * 9.0);
    float n = fbm(cp + vec2(fbm(cp * 0.5 + uTime * 0.01), 0.0) * 1.4);
    float band = smoothstep(0.02, 0.12, y) * (1.0 - smoothstep(0.38, 0.46, y));
    float cloud = smoothstep(0.52, 0.78, n) * band;
    float lit = exp(-r * 3.2) + smoothstep(0.25, 0.42, y) * 0.5;
    vec3 cc = mix(cCloudDark, cCloudLit, clamp(lit, 0.0, 1.0));
    col = mix(col, cc, cloud * (1.0 - disc * 0.7));
    col = mix(col, cSun * 2.6, disc * (1.0 - cloud * 0.6) * (1.0 - uDark * 0.75));
    vec3 darkCol = col * vec3(0.42, 0.2, 0.18);
    col = mix(col, darkCol, uDark);
    gl_FragColor = vec4(col, 1.0);
  }
`;

const TOASTS = {
  hunt: ['ENSELERİ KES', `${KILLS_TO_COLOSSAL} TİTAN · HIZLA GEÇ`],
  caught: ['YAKALANDIN', ''],
  fall: ['DÜŞTÜN', 'pencereler arası boşluk'],
  colossal: ['KOLOSAL TİTAN', 'pencereleri üst üste diz · ensesine ulaş'],
  slain: ['İNSANLIK KAZANDI', 'kolosal titan düştü'],
  shock: ['DUVAR YIKILDI', 'çok geç kaldın'],
  over: ['ÖLDÜN', 'tekrar dene'],
};

export function createTitanView(canvas, labelEl, flashEl) {
  const screen = screenBounds();
  const L = titanLayout(screen);
  const { view } = L;
  const H = screen.h;
  const root = canvas.parentElement;
  const cross = Object.assign(document.createElement('div'), { id: 'tcross' });
  const toast = Object.assign(document.createElement('div'), { id: 'ttoast' });
  toast.innerHTML = '<b></b><span></span>';
  root.append(cross, toast);
  const audio = createAudio();

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  const fogBase = new THREE.Color(0xb4643c);
  const fogDark = new THREE.Color(0x3a1510);
  scene.fog = new THREE.Fog(fogBase.clone(), view.D + 200, view.D + 5200);

  const camera = new THREE.PerspectiveCamera();
  camera.matrixAutoUpdate = true;

  // Sky: a plane far behind everything, its uv mapped to screen fractions.
  const p0 = view.toWorld(screen.x - screen.w * 0.2, screen.y + screen.h * 1.2, Z_SKY);
  const p1 = view.toWorld(screen.x + screen.w * 1.2, screen.y - screen.h * 0.2, Z_SKY);
  const skyMat = new THREE.ShaderMaterial({
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: SKY_FRAG,
    uniforms: {
      uTime: { value: 0 },
      uDark: { value: 0 },
      uAspect: { value: screen.w / screen.h },
      uSun: { value: new THREE.Vector2(0.6, 0.31) },
      cZenith: { value: new THREE.Color(0x2b0f0e) },
      cHigh: { value: new THREE.Color(0x6a1c12) },
      cLow: { value: new THREE.Color(0xb8431c) },
      cHorizon: { value: new THREE.Color(0xf09048) },
      cSun: { value: new THREE.Color(0xffd6a0) },
      cCloudDark: { value: new THREE.Color(0x2c100c) },
      cCloudLit: { value: new THREE.Color(0xff9a58) },
    },
    depthWrite: false,
    fog: false,
  });
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(p1.x - p0.x, p1.y - p0.y), skyMat);
  sky.position.set((p0.x + p1.x) / 2, (p0.y + p1.y) / 2, Z_SKY);
  sky.renderOrder = -1;
  scene.add(sky);

  const hemi = new THREE.HemisphereLight(0xffb58c, 0x2a120c, 0.75);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffa868, 3.2);
  sun.position.set(screen.w * 0.12, L.Yg + 1500, -2400);
  sun.target.position.set(0, L.Yg, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -screen.w * 0.62, right: screen.w * 0.62, top: 900, bottom: -360, near: 100, far: 6000 });
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.6;
  scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight(0xff9a6a, 1.1);
  fill.position.set(-screen.w * 0.4, L.Yg + 600, 2500);
  scene.add(fill);

  scene.add(buildCity(L));

  const fogU = { color: scene.fog.color, near: scene.fog.near, far: scene.fog.far };
  const fx = {
    smoke: new Particles(220, { fog: fogU }),
    steam: new Particles(1400, { fog: fogU }),
    embers: new Particles(420, { additive: true, dot: true, fog: fogU }),
  };
  for (const p of Object.values(fx)) scene.add(p.mesh);
  const makeRing = () => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), ringMaterial());
    m.renderOrder = 10;
    m.frustumCulled = false;
    m.visible = false;
    scene.add(m);
    return m;
  };
  const ring = makeRing();
  const napeRings = [0, 1, 2, 3, 4].map(makeRing);

  let actors = null;
  loadModels().then((models) => {
    const clips = makeClips(models);
    actors = {
      levi: new Levi(models.levi, clips.levi, scene, LEVI_H * H),
      titans: TITAN_HEIGHTS.map((hf, i) => new Titan(models.smiler, clips.titan, scene, i, hf * H)),
      colossal: new Colossal(models.colossal, clips.colossal, scene, L),
    };
  });

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.5, 0.88);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  const DUR = { kill: 2.4, miss: 0.25, caught: 1.2, fall: 1.2, eaten: 1.2, blast: 1, hook: 0.3 };
  const active = [];
  let lastToast = null;
  let size = { w: 0, h: 0, dpr: 0 };
  let prev = performance.now();
  const trail = [];

  function addFx(f) {
    if (DUR[f.kind]) active.push({ fx: f, dur: DUR[f.kind] });
    if (TOASTS[f.kind] || f.kind === 'kill') lastToast = f;
    audio.play(f.kind);
  }

  function resize(w, h, dpr) {
    size = { w, h, dpr };
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    composer.setPixelRatio(dpr);
    composer.setSize(w, h);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
  }

  // Off-axis projection: this window is a hole in one big screen-sized portal.
  function project(rect, ox, oy) {
    const n = 20;
    const f = view.D + 20000;
    const ex = view.eye.x + ox;
    const ey = view.eye.y + oy;
    const ez = view.D;
    const xl = rect.x - view.cx + ox;
    const yt = view.cy - rect.y + oy;
    camera.position.set(ex, ey, ez);
    camera.quaternion.identity();
    camera.updateMatrixWorld(true);
    camera.projectionMatrix.makePerspective(((xl - ex) * n) / ez, ((xl + rect.w - ex) * n) / ez, ((yt - ey) * n) / ez, ((yt - rect.h - ey) * n) / ez, n, f);
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  }

  function emitAmbient(t, dark) {
    L.smoke.forEach((s, i) => {
      plume(fx.smoke, s.x, s.y, s.z, t, i * 0.37, { size: 60, rise: 900, count: 14, rate: 0.045, drift: 0.25, alpha: 0.55, grow: 3.2, color: [0.16, 0.12, 0.1] });
      const fl = 0.7 + 0.3 * Math.sin(t * 9 + i * 3) * Math.sin(t * 5.3 + i);
      fx.embers.push(s.x, s.y - 10, s.z + 5, 110 * fl, 0.55, 1.6, 0.55, 0.15);
    });
    for (let i = 0; i < 160; i++) {
      const h1 = frac(Math.sin(i * 91.7) * 4375.5);
      const h2 = frac(Math.sin(i * 47.3) * 9137.1);
      const h3 = frac(Math.sin(i * 13.9) * 2713.3);
      const z = 120 - h3 * 1400;
      const half = view.toWorld(screen.x + screen.w, 0, z).x;
      const x = -half + frac(h1 + t * (0.004 + h2 * 0.006)) * half * 2 + Math.sin(t * 0.8 + i) * 20;
      const y = L.Yg - 50 + frac(h2 + t * (0.03 + h1 * 0.04)) * screen.h * 1.1;
      const fl = 0.5 + 0.5 * Math.sin(t * 6 + i * 1.7);
      fx.embers.push(x, y, z, 2.5 + h3 * 3.5, (0.4 + 0.6 * fl) * (1 - dark * 0.3), 2.2, 0.75, 0.25);
    }
  }

  // The Colossal's timeline, derived from shared state so every window agrees.
  function colossalTimeline(state, now) {
    const c = { rise: 0, glow: 0, age: 0, dark: 0, shock: -1, slain: -1, amp: 0, heavy: 0 };
    if (!state || !state.colossalAt) return c;
    const a = (now - state.colossalAt) / 1000;
    const endE = END_MS / 1000;
    if (state.phase === 'colossal') {
      c.rise = (a - 0.8) / 3;
      c.glow = smooth(3.1, 3.9, a);
      c.age = a - 0.8;
      c.dark = smooth(0.3, 1.8, a);
      c.heavy = smooth(1.0, 3.0, a);
      c.amp = (a < 1.4 ? 3 * Math.sin((a / 1.4) * Math.PI) : 0) + (a > 0.8 && a < 3.8 ? 1.5 : 0);
      return c;
    }
    if (state.phase !== 'won' && state.phase !== 'lost') return c;
    const e = (now - state.endAt) / 1000;
    const atEnd = (state.endAt - state.colossalAt) / 1000;
    c.age = atEnd - 0.8 + e;
    const fade = 1 - smooth(endE - 0.9, endE, e);
    if (state.endKind === 'shock') {
      c.rise = 1;
      c.glow = 1 - smooth(endE - 1.2, endE - 0.4, e);
      c.dark = fade;
      c.heavy = fade;
      c.shock = e;
      c.amp = 18 * Math.exp(-e * 2.6);
    } else if (state.endKind === 'slain') {
      c.rise = 1 - e / 3;
      c.glow = 1 - smooth(0, 0.4, e);
      c.dark = 1 - smooth(0.6, 3.5, e);
      c.heavy = 1.6 * (1 - smooth(3, endE, e));
      c.slain = e;
      c.amp = 8 * Math.exp(-e * 1.4);
    } else {
      c.rise = 1 - e / 2;
      c.dark = fade * (1 - smooth(0, 2, e));
    }
    return c;
  }

  function anchorOf(state, hook) {
    if (!hook) return null;
    if (!hook.tid) return hook;
    const ti = state.titans.find((q) => q.id === hook.tid);
    return ti ? { x: ti.x + hook.ox, y: L.groundY + hook.oy } : null;
  }

  function render(rect, state, now, rects = [], mouse = null) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (rect.w !== size.w || rect.h !== size.h || dpr !== size.dpr) resize(rect.w, rect.h, dpr);
    const slow = state && now < state.slowUntil;
    const dt = Math.min(0.05, (performance.now() - prev) / 1000) * (slow ? 0.3 : 1);
    prev = performance.now();
    const t = sharedTime(now);
    for (let i = active.length - 1; i >= 0; i--) if ((now - active[i].fx.t) / 1000 >= active[i].dur) active.splice(i, 1);

    const C = colossalTimeline(state, now);
    let amp = C.amp;
    for (const { fx: f } of active) {
      const age = (now - f.t) / 1000;
      if (f.kind === 'kill') amp += 7 * Math.exp(-age * 5);
      if (f.kind === 'caught') amp += 4 * Math.exp(-age * 4);
    }
    project(rect, amp * Math.sin(t * 63.1) * Math.cos(t * 17.3), amp * Math.cos(t * 57.7) * Math.sin(t * 23.9));

    const dark = C.dark;
    skyMat.uniforms.uTime.value = t;
    skyMat.uniforms.uDark.value = dark;
    scene.fog.color.copy(fogBase).lerp(fogDark, dark);
    sun.intensity = 3.2 * (1 - dark * 0.7);
    hemi.intensity = 0.75 * (1 - dark * 0.5);

    for (const p of Object.values(fx)) p.clear();
    emitAmbient(t, dark);
    for (const r of napeRings) r.visible = false;
    let flash = 0;
    let tension = 0;

    const lv = state?.levi;
    const anchor = state && lv ? anchorOf(state, lv.hook) : null;
    if (actors && state) {
      actors.levi.update(lv, anchor, L, now, t, dt, fx);
      const leviW = view.toWorld(lv.x, lv.y - LEVI_H * H * 0.5, Z_TITAN);
      const bySlot = new Map(state.titans.map((ti) => [ti.slot, ti]));
      actors.titans.forEach((T, slot) => {
        const ti = bySlot.get(slot) ?? null;
        if (T.update(ti, L, now, t, dt, leviW)) audio.play('step', T.h / H);
        if (!ti) return;
        const v = T.vents();
        if (ti.mode === 'dying') {
          const age = (now - ti.at) / 1000;
          const k = Math.min(1, age * 2) * (1 - smooth(1.6, 2.6, age));
          const base = T.holder.position;
          for (let j = 0; j < 5; j++) {
            plume(fx.steam, base.x + (j - 2) * T.h * 0.12, base.y + T.h * (0.1 + j * 0.1), Z_TITAN + 4, t, slot + j * 0.21, { size: T.h * 0.14, rise: T.h * 0.9, count: 8, rate: 0.7, drift: 0.1, alpha: 0.7 * k, grow: 2.6 });
          }
          return;
        }
        plume(fx.steam, v.mouth.x, v.mouth.y, v.mouth.z, t, slot * 0.31, { size: T.h * 0.05, rise: T.h * 0.5, count: 7, rate: 0.6, drift: 0.2, alpha: 0.5 });
        plume(fx.steam, v.nape.x, v.nape.y, v.nape.z, t, slot * 0.53 + 0.4, { size: T.h * 0.05, rise: T.h * 0.55, count: 7, rate: 0.45, drift: -0.15, alpha: 0.42 });
        // The nape target, pulsing.
        const n = napeOf(L, ti);
        const r = n.r;
        const nw = view.toWorld(n.x, n.y, Z_TITAN + 30);
        const ring = napeRings[slot];
        const pulse = 1 + 0.12 * Math.sin(t * 7 + slot);
        ring.visible = true;
        ring.position.set(nw.x, nw.y, Z_TITAN + 30);
        ring.scale.set(r * 2 * pulse, r * 2 * pulse, 1);
        ring.material.uniforms.uAlpha.value = 0.4 + 0.2 * Math.sin(t * 7 + slot);
        if (lv.mode !== 'dead') tension = Math.max(tension, clamp01(1 - Math.abs(lv.x - ti.x) / (H * 0.9)));
      });

      // Blade streak when fast enough to cut.
      const speed = Math.hypot(lv.vx, lv.vy);
      if (lv.mode === 'air') trail.push({ x: lv.x, y: lv.y - LEVI_H * H * 0.5, fast: speed > 360 });
      else trail.length = 0;
      while (trail.length > 14) trail.shift();
      trail.forEach((p, k) => {
        if (!p.fast) return;
        const w = view.toWorld(p.x, p.y, Z_LEVI - 2);
        const a = (k + 1) / trail.length;
        fx.embers.push(w.x, w.y, Z_LEVI - 2, 6 + a * 10, a * 0.8, 1.8, 1.7, 1.5);
      });
    }

    for (const { fx: f } of active) {
      const age = (now - f.t) / 1000;
      if (f.kind === 'kill') {
        // Steam erupts from the cut nape, in every window at once.
        const c = view.toWorld(f.x, f.y, Z_TITAN + 20);
        for (let k = 0; k < 30; k++) {
          const ang = (k / 30) * Math.PI * 2 + k * 0.7;
          const d = (20 + (k % 4) * 30) * Math.sqrt(age) * 3;
          fx.steam.push(c.x + Math.cos(ang) * d, c.y + Math.sin(ang) * d * 0.7 + age * 120, Z_TITAN + 20, 40 + age * 160, 0.8 * (1 - age / 2.4), 0.97, 0.95, 0.93);
        }
        if (age < 0.5) {
          for (let k = 0; k < 18; k++) {
            const ang = (k / 18) * Math.PI * 2;
            const d = age * 900 * (0.6 + (k % 3) * 0.2);
            fx.embers.push(c.x + Math.cos(ang) * d, c.y + Math.sin(ang) * d, Z_TITAN + 25, 8, 1 - age * 2, 2, 1.6, 1.2);
          }
        }
        flash = Math.max(flash, Math.exp(-age * 8) * 0.35);
      } else if (f.kind === 'miss' && f.fx !== undefined) {
        const k = age / 0.25;
        const n = 10;
        for (let j = 0; j < n; j++) {
          const u = ((j + 1) / n) * Math.min(1, k * 2);
          const w = view.toWorld(f.fx + (f.x - f.fx) * u * 0.6, f.fy - LEVI_H * H * 0.5 + (f.y - f.fy) * u * 0.6, Z_LEVI);
          fx.embers.push(w.x, w.y, Z_LEVI, 4, 0.6 * (1 - k), 1.4, 1.3, 1.2);
        }
      } else if (f.kind === 'hook') {
        const w = view.toWorld(f.x, f.y, Z_LEVI - 4);
        fx.embers.push(w.x, w.y, Z_LEVI - 4, 30 * (1 - age / 0.3), 1 - age / 0.3, 2, 1.7, 1.3);
      } else if (f.kind === 'caught' || f.kind === 'eaten' || f.kind === 'fall') {
        flash = Math.max(flash, Math.exp(-age * 6) * 0.2);
      }
    }

    const col = actors?.colossal;
    if (col) col.update(C.rise, C.glow, C.age);
    ring.visible = false;
    if (col && C.rise > 0) {
      tension = 1;
      col.vents().forEach((p, i) => {
        plume(fx.steam, p.x, p.y, p.z + 60, t, i * 0.137, { size: 110 + (i % 3) * 40, rise: 1100, count: 9, rate: 0.22, drift: (i % 2 ? 1 : -1) * 0.35, alpha: Math.min(0.9, 0.45 * C.heavy), grow: 2.6 });
      });
      if (state.phase === 'colossal' && now - state.colossalAt > COLOSSAL_READY_MS) {
        const nw = view.toWorld(L.colossal.x, L.colossal.napeY, 40);
        const r = napeRings[4];
        const pulse = 1 + 0.15 * Math.sin(t * 9);
        r.visible = true;
        r.position.set(nw.x, nw.y, 40);
        r.scale.set(140 * pulse, 140 * pulse, 1);
        r.material.uniforms.uAlpha.value = 0.8;
      }
      if (C.shock >= 0) {
        const s = C.shock;
        const chin = col.center();
        const cs = view.project(chin.x, chin.y, Z_COLOSSAL);
        const c = view.toWorld(cs.x, cs.y, 200);
        const R = s * screen.w * 1.5;
        ring.visible = s < 1.5;
        ring.position.set(c.x, c.y, 200);
        ring.scale.set(R * 2, R * 2, 1);
        ring.material.uniforms.uAlpha.value = 1 - s / 1.5;
        const fog = (s < 0.25 ? s / 0.25 : 1) * (1 - smooth(0.7, 2.1, s));
        for (let k = 0; k < 30; k++) {
          const ang = (k / 30) * Math.PI * 2 + k * 0.37;
          const d = Math.min(1, s * 1.1) * screen.w * (0.15 + (k % 5) * 0.13);
          fx.steam.push(c.x + Math.cos(ang) * d, c.y + Math.sin(ang) * d * 0.5 + s * 40, 150, 220 + (k % 3) * 100 + s * 110, 0.3 * fog, 0.97, 0.92, 0.86);
        }
        flash = Math.max(flash, Math.exp(-s * 5.5) * 0.7);
      }
      if (C.slain >= 0) flash = Math.max(flash, Math.exp(-C.slain * 3) * 0.85);
    }
    flashEl.style.opacity = flash.toFixed(3);

    for (const p of Object.values(fx)) p.commit();
    composer.render();

    audio.frame(!!anchor, lv ? Math.hypot(lv.vx, lv.vy) : 0, tension, !!state);
    updateHud(rect, state, now, rects, mouse);
  }

  function updateHud(rect, state, now, rects, mouse) {
    const sector = sectorOf(screen, rect.x + rect.w / 2, rect.y + rect.h / 2);
    let line = '';
    if (state) {
      const lives = '●'.repeat(Math.max(0, state.lives)) + '○'.repeat(Math.max(0, LIVES - state.lives));
      if (state.phase === 'colossal') {
        const left = Math.max(0, Math.ceil((COLOSSAL_MS - (now - state.colossalAt)) / 1000));
        line = `<span>KOLOSAL <b>${left}s</b> · CAN ${lives}</span>`;
      } else line = `<span>TİTAN ${state.kills}/${KILLS_TO_COLOSSAL} · CAN ${lives}</span>`;
    }
    const label = `WALL ROSE &nbsp;SECTOR ${sector}<br>${line}`;
    if (labelEl.innerHTML !== label) labelEl.innerHTML = label;

    // Crosshair: bright when a hook fired here would hold.
    if (mouse && state) {
      const ok = !!hookTarget(state, L, rects, mouse.x, mouse.y, now);
      cross.style.transform = `translate(${mouse.x - rect.x}px, ${mouse.y - rect.y}px)`;
      cross.className = ok ? 'ok' : '';
      cross.hidden = false;
    } else cross.hidden = true;

    let head = '';
    let sub = '';
    let age = 0;
    if (state?.phase === 'ready') {
      head = 'KANCAYI AT';
      sub = 'tıkla & basılı tut · boşluk: gaz · A/D: yürü · pencereleri sürükle';
    } else if (lastToast && state) {
      age = (now - lastToast.t) / 1000;
      const k = lastToast.kind;
      const life = k === 'slain' || k === 'shock' || k === 'over' ? END_MS / 1000 : k === 'colossal' ? 5 : 1.6;
      if (age < life) {
        if (k === 'kill') {
          head = 'ENSE!';
          sub = `${state.kills}/${KILLS_TO_COLOSSAL}`;
        } else [head, sub] = TOASTS[k];
      }
    }
    if (state?.phase === 'hunt' && !head && now - state.phaseAt < 2500) [head, sub] = TOASTS.hunt;
    const b = toast.firstChild;
    if (b.textContent !== head) {
      b.textContent = head;
      toast.lastChild.textContent = sub;
      toast.classList.remove('pop');
      void toast.offsetWidth;
      if (head) toast.classList.add('pop');
    }
    toast.hidden = !head;
  }

  return { render, addFx, layout: L };
}
