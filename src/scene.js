import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { STAR_R } from './game.js';
import { sharedTime, worldLayout } from './world/common.js';
import { createSpace } from './world/space.js';
import { createComet } from './world/comet.js';
import { createBlackHole } from './world/blackhole.js';
import { COLLAPSE, createEffects } from './world/effects.js';

// The scene is rendered MARGIN px larger than the window on every side, so
// bloom, lensing and shake pull real content in from beyond the edges and the
// picture stays continuous across windows.
const MARGIN = 96;
// Internal render resolution steps down when a window cannot hold 60 fps
// (usually a very large window); the final pass upsamples to the canvas.
const QUALITY_STEPS = [1, 0.8, 0.65, 0.5];
const SLOW_FRAME_MS = 1000 / 56;
const LENS_RE = STAR_R * 2.5;
const APPEAR = 0.8;

const LensShader = {
  uniforms: {
    tDiffuse: { value: null },
    uView: { value: new THREE.Vector4() },
    uHole: { value: new THREE.Vector3() },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec4 uView;
    uniform vec3 uHole;
    varying vec2 vUv;
    void main() {
      vec2 p = uView.xy + vec2(vUv.x, 1.0 - vUv.y) * uView.zw;
      vec2 d = p - uHole.xy;
      float r = max(length(d), 1.0);
      float re = uHole.z;
      float soft = re * 0.6;
      float shift = re * re * r / (r * r + soft * soft) * smoothstep(re * 7.0, re * 2.0, r);
      vec2 src = p - d / r * shift;
      gl_FragColor = texture2D(tDiffuse, vec2((src.x - uView.x) / uView.z, 1.0 - (src.y - uView.y) / uView.w));
    }
  `,
};

const FINAL_FRAG = /* glsl */ `
  uniform sampler2D tScene;
  uniform vec4 uCrop;
  uniform vec4 uView;
  uniform float uTime;
  uniform vec2 uC;
  uniform float uDark;
  uniform float uDarkR;
  uniform float uPinch;
  uniform float uShockR;
  uniform float uShockA;
  varying vec2 vUv;

  float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  vec3 aces(vec3 x) {
    return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
  }

  void main() {
    vec2 p = uView.xy + vec2(vUv.x, 1.0 - vUv.y) * uView.zw;
    vec2 d = p - uC;
    float r = max(length(d), 1.0);
    vec2 dir = d / r;
    float disp = uPinch * smoothstep(0.0, 260.0, r);
    disp += uShockA * exp(-pow((r - uShockR) / 50.0, 2.0));
    vec2 src = p + dir * disp;
    vec2 uv = vec2((src.x - uView.x) / uView.z, 1.0 - (src.y - uView.y) / uView.w);
    vec3 col = texture2D(tScene, uCrop.xy + uv * uCrop.zw).rgb;

    col *= 1.0 - uDark * 0.92 * smoothstep(uDarkR * 0.5, uDarkR, r);
    col = aces(col * 1.1);

    vec2 q = vUv - 0.5;
    col *= 1.0 - 0.22 * pow(length(q) * 1.35, 2.4);
    float lum = dot(col, vec3(0.3, 0.59, 0.11));
    col += (hash12(gl_FragCoord.xy + fract(uTime * 7.3) * 500.0) - 0.5) * 0.045 * (1.0 - 0.5 * lum);
    gl_FragColor = vec4(col, 1.0);
  }
`;

function screenBounds() {
  const s = window.screen;
  return { x: s.availLeft ?? 0, y: s.availTop ?? 0, w: s.availWidth, h: s.availHeight };
}

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  const pixelRatio = Math.min(window.devicePixelRatio, 2);
  renderer.setPixelRatio(pixelRatio);
  const prU = { value: pixelRatio };
  renderer.setClearColor(0x000000, 1);

  const layout = worldLayout(screenBounds());
  const camera = new THREE.OrthographicCamera(0, 1, 0, -1, -100, 100);
  camera.position.z = 10;
  const bgScene = new THREE.Scene();
  const fgScene = new THREE.Scene();
  const topScene = new THREE.Scene();

  const space = createSpace(bgScene, layout, prU);
  const comet = createComet(fgScene, prU);
  const hole = createBlackHole(fgScene, topScene);
  const effects = createEffects(fgScene, prU);

  const composer = new EffectComposer(renderer);
  composer.renderToScreen = false;
  const fgPass = new RenderPass(fgScene, camera);
  fgPass.clear = false;
  const lensPass = new ShaderPass(LensShader);
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.7, 0.5, 0.95);
  composer.addPass(new RenderPass(bgScene, camera));
  composer.addPass(lensPass);
  composer.addPass(fgPass);
  composer.addPass(bloom);
  const topPass = new RenderPass(topScene, camera);
  topPass.clear = false;
  composer.addPass(topPass);

  const finalUniforms = {
    tScene: { value: null },
    uCrop: { value: new THREE.Vector4() },
    uView: { value: new THREE.Vector4() },
    uTime: { value: 0 },
    uC: { value: new THREE.Vector2() },
    uDark: { value: 0 },
    uDarkR: { value: 1 },
    uPinch: { value: 0 },
    uShockR: { value: -1000 },
    uShockA: { value: 0 },
  };
  const final = new FullScreenQuad(
    new THREE.ShaderMaterial({
      uniforms: finalUniforms,
      vertexShader: LensShader.vertexShader,
      fragmentShader: FINAL_FRAG,
      depthTest: false,
      depthWrite: false,
    }),
  );

  let size = { w: 0, h: 0 };
  let lastHole = null;
  let holeBornAt = 0;
  let quality = 0;
  let frames = [];
  let lastFrame = 0;
  let settleUntil = 0;

  function applyQuality() {
    prU.value = pixelRatio * QUALITY_STEPS[quality];
    composer.setPixelRatio(prU.value);
    composer.setSize(size.w + MARGIN * 2, size.h + MARGIN * 2);
  }

  function resize(w, h) {
    size = { w, h };
    renderer.setSize(w, h);
    quality = 0;
    applyQuality();
  }

  function adaptQuality() {
    const t = performance.now();
    if (lastFrame) frames.push(t - lastFrame);
    lastFrame = t;
    if (frames.length < 60) return;
    const avg = frames.reduce((a, b) => a + b, 0) / frames.length;
    frames = [];
    if (t > settleUntil && avg > SLOW_FRAME_MS && quality < QUALITY_STEPS.length - 1) {
      quality += 1;
      applyQuality();
      settleUntil = t + 1000;
    }
  }

  // rects: all visible windows; their centroid drives the star parallax, so
  // every window shifts the layers by the same amount.
  function render(rect, view, now, rects) {
    if (rect.w !== size.w || rect.h !== size.h) resize(rect.w, rect.h);
    adaptQuality();
    const t = sharedTime(now);
    const swallow = effects.update(now);

    const shakeX = swallow?.shakeX ?? 0;
    const shakeY = swallow?.shakeY ?? 0;
    const cam = {
      x: rect.x - MARGIN + shakeX,
      y: rect.y - MARGIN + shakeY,
      w: rect.w + MARGIN * 2,
      h: rect.h + MARGIN * 2,
    };
    camera.left = cam.x;
    camera.right = cam.x + cam.w;
    camera.top = -cam.y;
    camera.bottom = -(cam.y + cam.h);
    camera.updateProjectionMatrix();

    const list = rects.length ? rects : [rect];
    let cx = 0;
    let cy = 0;
    for (const r of list) {
      cx += r.x + r.w / 2;
      cy += r.y + r.h / 2;
    }
    const s = layout.screen;
    space.update(cam, t, { x: cx / list.length - (s.x + s.w / 2), y: cy / list.length - (s.y + s.h / 2) });

    // Hole: the old one shrinks during the collapse, the new one grows in after.
    let hx = 0;
    let hy = 0;
    let hs = 0;
    if (view) {
      const key = `${view.star.x},${view.star.y}`;
      if (key !== lastHole) {
        holeBornAt = lastHole === null ? now - APPEAR * 1000 : now;
        lastHole = key;
      }
      if (swallow?.collapsing) {
        hx = swallow.x;
        hy = swallow.y;
        hs = 1 - (swallow.age / COLLAPSE) ** 2;
      } else {
        let born = holeBornAt;
        if (swallow) born = Math.max(born, now - (swallow.age - COLLAPSE) * 1000);
        const k = Math.min(1, Math.max(0, (now - born) / 1000 / APPEAR));
        hx = view.star.x;
        hy = view.star.y;
        hs = k < 1 ? 1 - (1 - k) ** 3 : 1;
      }
    }
    hole.update(hx, hy, hs, t);
    comet.update(view, t, swallow?.collapsing);

    lensPass.uniforms.uView.value.set(cam.x, cam.y, cam.w, cam.h);
    lensPass.uniforms.uHole.value.set(hx, hy, LENS_RE * hs);
    composer.render();

    finalUniforms.tScene.value = composer.readBuffer.texture;
    finalUniforms.uCrop.value.set(MARGIN / cam.w, MARGIN / cam.h, rect.w / cam.w, rect.h / cam.h);
    finalUniforms.uView.value.set(rect.x, rect.y, rect.w, rect.h);
    finalUniforms.uTime.value = t;
    finalUniforms.uC.value.set(swallow?.x ?? 0, swallow?.y ?? 0);
    finalUniforms.uDark.value = swallow?.dark ?? 0;
    finalUniforms.uDarkR.value = swallow?.darkR ?? 1;
    finalUniforms.uPinch.value = swallow?.pinch ?? 0;
    finalUniforms.uShockR.value = swallow?.shockR ?? -1000;
    finalUniforms.uShockA.value = swallow?.shockA ?? 0;
    renderer.setRenderTarget(null);
    final.render(renderer);
  }

  return { render, addFx: effects.add };
}
