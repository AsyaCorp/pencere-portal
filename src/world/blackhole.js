import * as THREE from 'three';
import { STAR_R } from '../game.js';
import { NOISE_GLSL, QUAD_VERT, premultiplied, quadGeo } from './common.js';

const EXTENT = 4.4;

const HOLE_FRAG = /* glsl */ `
  varying vec2 vUv;
  uniform float uTime;
  uniform float uTop;
  ${NOISE_GLSL}

  vec4 over(vec4 top, vec4 under) { return top + under * (1.0 - top.a); }

  vec3 diskColor(vec2 e, float rho) {
    float ang = atan(e.y, e.x);
    float a2 = ang + uTime * 2.2 / (rho * sqrt(rho));
    float swirl = fbm3(vec3(cos(a2) * 2.5, sin(a2) * 2.5, rho * 2.2));
    float streak = vnoise3(vec3(cos(a2) * 9.0, sin(a2) * 9.0, rho * 6.0));
    float temp = smoothstep(3.9, 1.3, rho);
    vec3 col = mix(vec3(0.9, 0.28, 0.05), vec3(1.3, 1.05, 0.8), temp);
    col *= (0.25 + 0.95 * swirl + 0.3 * streak) * (0.45 + 1.1 * temp * temp);
    col *= 0.55 + 0.9 * smoothstep(1.0, -1.0, e.x / rho);
    return col;
  }

  void main() {
    vec2 p = (vUv - 0.5) * 2.0 * ${EXTENT.toFixed(2)};
    float r = length(p);
    float tilt = 0.22;
    vec2 q = mat2(cos(tilt), -sin(tilt), sin(tilt), cos(tilt)) * p;
    vec2 e = vec2(q.x, q.y / 0.2);
    float rho = length(e);
    float mask = smoothstep(1.3, 1.6, rho) * smoothstep(4.0, 3.0, rho);
    vec3 dc = mask > 0.0 ? diskColor(e, rho) * mask : vec3(0.0);

    float shadow = smoothstep(1.03, 0.97, r);
    if (uTop > 0.5) {
      vec4 top = vec4(0.0, 0.0, 0.0, shadow);
      if (q.y <= 0.0) top = over(vec4(dc * shadow * vec3(1.6, 1.2, 0.9), 0.0), top);
      gl_FragColor = top;
      return;
    }

    vec4 acc = vec4(0.0);
    acc.rgb += vec3(1.0, 0.45, 0.15) * exp(-r * 0.9) * 0.08;
    if (q.y > 0.0) acc.rgb += dc;

    float up = clamp(p.y / max(r, 1e-3), -1.0, 1.0);
    float photon = exp(-pow((r - 1.12) / 0.07, 2.0)) * (0.8 + 0.45 * up);
    float arc = exp(-pow((r - 1.45) / 0.28, 2.0)) * smoothstep(-0.2, 0.9, up);
    float arcLow = exp(-pow((r - 1.3) / 0.16, 2.0)) * smoothstep(0.2, -0.9, up) * 0.5;
    acc.rgb += vec3(1.4, 0.9, 0.5) * photon + diskColor(normalize(p) * 2.0, 2.0) * (arc + arcLow) * 0.45;

    acc = over(vec4(0.0, 0.0, 0.0, shadow), acc);
    if (q.y <= 0.0) acc = over(vec4(dc, 0.0), acc);
    gl_FragColor = acc;
  }
`;

export const HOLE_EXTENT = EXTENT;

// The shadow and the near half of the disk are drawn twice: once in the
// bloomed scene and again on top after bloom, so glow never fills the shadow.
export function createBlackHole(scene, topScene) {
  const meshes = [scene, topScene].map((target, i) => {
    const mesh = new THREE.Mesh(
      quadGeo,
      new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uTop: { value: i } },
        vertexShader: QUAD_VERT,
        fragmentShader: HOLE_FRAG,
        ...premultiplied,
      }),
    );
    mesh.renderOrder = 10;
    mesh.frustumCulled = false;
    target.add(mesh);
    return mesh;
  });

  // scale 0 hides the hole (while it collapses or before it appears).
  function update(x, y, scale, t) {
    const s = 2 * EXTENT * STAR_R * scale;
    for (const mesh of meshes) {
      mesh.visible = scale > 0.001;
      mesh.position.set(x, -y, 0);
      mesh.scale.set(s, s, 1);
      mesh.material.uniforms.uTime.value = t;
    }
  }

  return { update };
}
