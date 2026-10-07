import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { GRAB_MS } from './game.js';
import { Z_COLOSSAL } from './world.js';

export const Z_TITAN = 12;
export const Z_LEVI = 60;
const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();

export async function loadModels() {
  const loader = new GLTFLoader();
  const names = ['Soldier', 'Xbot', 'Levi', 'Smiler', 'Colossal'];
  const [soldier, xbot, levi, smiler, colossal] = await Promise.all(names.map((n) => loader.loadAsync(`/models/${n}.glb`)));
  return { soldier, xbot, levi, smiler, colossal };
}

// In-place clips that only rotate bones, so bone lengths can be edited.
function prepClips(clips) {
  const out = {};
  for (const clip of clips) {
    const c = clip.clone();
    c.tracks = c.tracks.filter((tr) => !tr.name.endsWith('.scale') && (!tr.name.endsWith('.position') || tr.name.includes('Hips')));
    for (const tr of c.tracks) {
      if (!tr.name.endsWith('.position')) continue;
      const v = tr.values;
      for (let i = 0; i < v.length; i += 3) {
        v[i] = v[0];
        v[i + 2] = v[2];
      }
    }
    out[c.name.toLowerCase()] = c;
  }
  return out;
}

// Fresnel rim light so backlit silhouettes keep a hot edge.
function withRim(mat, color, strength) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uRim = { value: new THREE.Color(color).multiplyScalar(strength) };
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uRim;')
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        float rimK = pow(1.0 - saturate(dot(normalize(vNormal), normalize(vViewPosition))), 2.2);
        totalEmissiveRadiance += uRim * rimK;`,
      );
  };
  return mat;
}

// One bone vocabulary (Mixamo's) for Mixamo, Sketchfab-suffixed Mixamo
// ("mixamorig_Hips_01") and 3ds Max Biped ("Bip001_L_Thigh_3") rigs.
const BIPED = { Pelvis: 'Hips', Spine: 'Spine', Spine1: 'Spine1', Spine2: 'Spine2', Neck: 'Neck', Head: 'Head' };
const BIPED_SIDE = { Clavicle: 'Shoulder', UpperArm: 'Arm', Forearm: 'ForeArm', Hand: 'Hand', Thigh: 'UpLeg', Calf: 'Leg', Foot: 'Foot', Toe0: 'ToeBase' };
function canonical(name) {
  const bip = /^Bip001[_ ](?:([LR])[_ ])?([A-Za-z]+\d?)(?:_\d+)?$/.exec(name);
  if (bip) {
    if (!bip[1]) return BIPED[bip[2]] ?? name;
    const part = BIPED_SIDE[bip[2]];
    return part ? (bip[1] === 'L' ? 'Left' : 'Right') + part : name;
  }
  return name.replace(/^mixamorig[:_]?/, '').replace(/_\d+$/, '');
}

function bones(root) {
  const map = {};
  root.traverse((o) => {
    if (!o.isBone) return;
    const n = canonical(o.name);
    if (!map[n]) map[n] = o;
  });
  return map;
}

// Rotates a bone (in world space) so its child points along dir.
function aim(bone, child, dir, k = 1) {
  bone.updateWorldMatrix(true, true);
  const from = child.getWorldPosition(_v).sub(bone.getWorldPosition(_w)).normalize();
  _q.setFromUnitVectors(from, dir.clone().normalize());
  bone.getWorldQuaternion(_q2);
  const target = _q.multiply(_q2);
  const parentQ = bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
  const local = parentQ.multiply(target);
  bone.quaternion.slerp(local, k);
  bone.updateWorldMatrix(false, true);
}

function heightOf(obj) {
  obj.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(obj);
  return box.max.y - box.min.y;
}

class Actor {
  constructor(gltf, clips, height) {
    this.holder = new THREE.Group();
    this.model = SkeletonUtils.clone(gltf.scene);
    this.holder.add(this.model);
    const h0 = heightOf(this.model);
    this.model.scale.setScalar(height / h0);
    this.bones = bones(this.model);
    this.mixer = new THREE.AnimationMixer(this.model);
    this.actions = {};
    for (const [name, clip] of Object.entries(clips)) this.actions[name] = this.mixer.clipAction(clip);
    this.current = null;
    this.model.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.frustumCulled = false;
      }
    });
  }

  play(name, timeScale = 1, fade = 0.25) {
    const next = this.actions[name];
    if (!next) return;
    next.timeScale = timeScale;
    if (this.current === next) return;
    next.reset().play();
    if (this.current) next.crossFadeFrom(this.current, fade, false);
    this.current = next;
  }

  // Attach a mesh built in world space (bind pose) to a bone.
  attach(boneName, mesh) {
    this.model.updateMatrixWorld(true);
    this.bones[boneName].attach(mesh);
  }
}

const CABLE_GEO = new THREE.CylinderGeometry(1, 1, 1, 5, 1, true).translate(0, 0.5, 0);

export class Levi extends Actor {
  constructor(gltf, clips, scene, h) {
    super(gltf, clips, h);
    this.h = h;
    this.lean = 0;
    this.model.traverse((o) => {
      if (!o.isMesh) return;
      // The rig's own cloak can't flutter; the procedural cape replaces it.
      if (o.material.name.includes('Cloak')) {
        o.visible = false;
        return;
      }
      o.material = withRim(o.material.clone(), 0xffa060, 1.1);
    });
    const capeMat = withRim(new THREE.MeshStandardMaterial({ color: 0x2d4a2a, roughness: 0.9, side: THREE.DoubleSide }), 0xff9050, 1.1);
    this.capeGeo = new THREE.PlaneGeometry(1, 1, 3, 6);
    this.cape = new THREE.Mesh(this.capeGeo, capeMat);
    this.cape.frustumCulled = false;
    this.cape.castShadow = true;
    const cableMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 1.4, 1.3), toneMapped: false });
    this.cables = [0, 1].map(() => {
      const m = new THREE.Mesh(CABLE_GEO, cableMat);
      m.frustumCulled = false;
      m.visible = false;
      scene.add(m);
      return m;
    });
    scene.add(this.holder, this.cape);
    this.play('idle');
  }

  setCable(m, from, to, r) {
    const d = _v.copy(to).sub(from);
    const len = d.length();
    m.position.copy(from);
    m.quaternion.setFromUnitVectors(_w.set(0, 1, 0), d.normalize());
    m.scale.set(r, len, r);
    m.visible = true;
  }

  // lv: Levi's state; anchor: screen point of the live hook or null.
  update(lv, anchor, L, now, t, dt, fx) {
    const shown = lv.placed && lv.mode !== 'dead';
    this.holder.visible = this.cape.visible = shown;
    for (const c of this.cables) c.visible = false;
    if (!shown) return;
    const z = Z_LEVI;
    const w = L.view.toWorld(lv.x, lv.y, z);
    const dir = lv.dir || 1;
    const air = lv.mode !== 'ground';
    const grabbed = lv.mode === 'grabbed' || lv.mode === 'grabbed-done';
    this.holder.position.set(w.x, w.y, z);
    this.model.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2;

    // Body axis: toward the hook while reeling, into the airflow otherwise.
    let target = 0;
    let aw = null;
    if (anchor) {
      aw = L.view.toWorld(anchor.x, anchor.y, z);
      target = Math.max(-1.3, Math.min(1.3, Math.atan2(-(aw.x - w.x), aw.y - (w.y + this.h * 0.5))));
    } else if (air) target = Math.max(-0.9, Math.min(0.9, -lv.vx / 1400));
    this.lean += (target - this.lean) * Math.min(1, dt * 10);
    let spin = 0;
    const sAge = (now - lv.slashAt) / 1000;
    if (sAge < 0.45) spin = -dir * (1 - (1 - sAge / 0.45) ** 2) * Math.PI * 4;
    this.holder.rotation.set(0, 0, this.lean + spin);

    let pose = 'idle';
    if (grabbed) pose = 'flail';
    else if (air) pose = 'fly';
    else if (Math.abs(lv.vx) > 30) pose = 'run';
    if (pose === 'run') this.play('run', 1.3);
    else if (pose === 'fly' || pose === 'flail') {
      this.play('run', 0);
      this.current.time = 0.18;
    } else this.play('idle', 1);
    this.mixer.update(dt);
    this.model.updateMatrixWorld(true);

    const B = this.bones;
    if (aw) {
      const d = new THREE.Vector3(aw.x - w.x, aw.y - (w.y + this.h * 0.6), 0).normalize();
      aim(B.RightArm, B.RightForeArm, d.clone().add(new THREE.Vector3(0, 0, 0.15)));
      aim(B.LeftArm, B.LeftForeArm, d.clone().add(new THREE.Vector3(0, 0, -0.15)));
    } else if (pose === 'fly') {
      aim(B.RightArm, B.RightForeArm, new THREE.Vector3(-dir * 0.8, -0.5, 0.3));
      aim(B.LeftArm, B.LeftForeArm, new THREE.Vector3(-dir * 0.8, -0.5, -0.3));
    } else if (pose === 'flail') {
      aim(B.RightArm, B.RightForeArm, new THREE.Vector3(dir * 0.3 + Math.sin(t * 22) * 0.6, 1, 0.2));
      aim(B.LeftArm, B.LeftForeArm, new THREE.Vector3(-dir * 0.3 - Math.sin(t * 19) * 0.6, 1, -0.2));
    }
    this.model.updateMatrixWorld(true);
    const speed = Math.hypot(lv.vx, lv.vy);
    this.updateCape(dir, air ? Math.min(1.5, 0.3 + speed / 900) : Math.abs(lv.vx) > 30 ? 0.9 : 0.12, air || Math.abs(lv.vx) > 30, t, z);

    const hip = B.Hips.getWorldPosition(new THREE.Vector3());
    if (aw) {
      this.cables.forEach((c, k) => this.setCable(c, hip.clone().add(new THREE.Vector3(0, 0, k ? 3 : -3)), new THREE.Vector3(aw.x + (k ? 5 : -5), aw.y, z - 4), 0.9));
      if (Math.random() < dt * 14) fx.steam.push(hip.x - dir * 6, hip.y - 4, z - 1, 10, 0.4, 0.95, 0.94, 0.92);
    }
    const gAge = (now - lv.gasAt) / 1000;
    if (gAge < 0.5) {
      for (let k = 0; k < 4; k++) {
        const a = gAge - k * 0.05;
        if (a < 0) continue;
        fx.steam.push(hip.x - lv.vx * a * 0.08, hip.y + lv.vy * a * 0.08, z - 1, 12 + a * 70, 0.6 * (1 - a / 0.5), 0.96, 0.95, 0.93);
      }
    }
  }

  // A cloak in the screen plane: hangs from the shoulders, streams back with speed.
  updateCape(dir, base, fast, t, z) {
    const sh = this.bones.Spine2.getWorldPosition(new THREE.Vector3());
    const len = this.h * 0.55;
    const tilt = this.holder.rotation.z;
    const pos = this.capeGeo.attributes.position;
    const cols = 4;
    const rows = 7;
    for (let r = 0; r < rows; r++) {
      const k = r / (rows - 1);
      const a = base + Math.sin(t * (fast ? 15 : 3) + k * 2.5) * (fast ? 0.18 : 0.06) * k + tilt * -dir;
      for (let c = 0; c < cols; c++) {
        const u = c / (cols - 1);
        const across = (u - 0.6) * this.h * (0.12 + k * 0.12);
        const x = sh.x - dir * this.h * 0.05 + dir * across * Math.cos(a) * 0.4 - dir * Math.sin(a) * len * k;
        const y = sh.y + this.h * 0.06 - Math.cos(a) * len * k + across * Math.sin(a) * 0.3;
        pos.setXYZ(r * cols + c, x, y, z - 3 + u * 0.5);
      }
    }
    pos.needsUpdate = true;
    this.capeGeo.computeVertexNormals();
  }
}

// Rotates a bone about a world-space axis, on top of its animated pose.
function turnWorld(bone, axis, angle) {
  const pw = bone.parent.getWorldQuaternion(new THREE.Quaternion());
  const w = pw.clone().multiply(bone.quaternion);
  w.premultiply(_q.setFromAxisAngle(axis, angle));
  bone.quaternion.copy(pw.invert().multiply(w));
  bone.updateWorldMatrix(false, true);
}

const AX_Y = new THREE.Vector3(0, 1, 0);
const AX_Z = new THREE.Vector3(0, 0, 1);
const TINT = [0xffffff, 0xf2d6c8, 0xffe8dc, 0xe6c2b0];
const HEAD = [1.0, 0.82, 1.18, 1.32];

// Pure titans: the grinning fan model, varied by height, tint and head size.
export class Titan extends Actor {
  constructor(gltf, clips, scene, i, h) {
    super(gltf, clips, h);
    this.i = i;
    this.h = h;
    const mats = new Map();
    this.model.traverse((o) => {
      if (!o.isMesh) return;
      if (!mats.has(o.material)) {
        const m = withRim(o.material.clone(), 0xff9a5a, 0.8);
        m.color = new THREE.Color(TINT[i % TINT.length]);
        mats.set(o.material, m);
      }
      o.material = mats.get(o.material);
    });
    const B = this.bones;
    for (const side of ['Left', 'Right']) {
      B[`${side}ForeArm`]?.position.multiplyScalar(1.15);
      B[`${side}Hand`]?.position.multiplyScalar(1.15);
    }
    B.Head.scale.setScalar(HEAD[i % HEAD.length]);
    this.jaw = B.xiaba ?? null;
    scene.add(this.holder);
    this.play('idle', 0.6 + i * 0.05);
  }

  // Returns true on a footfall, for the footstep sound.
  update(ti, L, now, t, dt, leviW) {
    this.holder.visible = !!ti;
    if (!ti) return false;
    const w = L.view.toWorld(ti.x, L.groundY, Z_TITAN);
    const f = ti.dir;
    const age = (now - ti.at) / 1000;
    let shake = 0;
    let lean = 0;
    let bob = 0;
    let sink = 0;
    const phase0 = this.current ? this.current.time / this.current.getClip().duration : 0;
    if (ti.mode === 'walk') {
      this.play('walk', ti.speed / (this.h * 0.42));
      bob = Math.abs(Math.sin(phase0 * Math.PI * 2)) * this.h * 0.015;
    } else if (ti.mode === 'run') {
      this.play('run', (150 + this.h * 0.1) / (this.h * 0.95));
      lean = 0.12;
      bob = Math.abs(Math.sin(phase0 * Math.PI * 2)) * this.h * 0.03;
    } else if (ti.mode === 'dying') {
      this.play('idle', 0.2);
      const e = Math.min(1, age / 0.9);
      lean = e * e * 1.45;
      sink = Math.max(0, age - 1.1) * this.h * 0.25;
    } else if (ti.mode === 'grab') {
      this.play('idle', 0.7);
      const k = Math.min(1, age / (GRAB_MS / 1000));
      lean = k < 0.6 ? -0.08 * (k / 0.6) : 0.35 * ((k - 0.6) / 0.4);
    } else this.play('idle', 0.7);
    if (ti.mode === 'edge') {
      shake = Math.sin(t * 21 + this.i) * this.h * 0.012;
      lean = 0.22 + Math.sin(t * 17 + this.i) * 0.06;
    }
    this.holder.position.set(w.x + shake, w.y + bob - sink, Z_TITAN - this.i * 20);
    this.holder.rotation.set(0, 0, -f * lean);
    this.model.rotation.y = f > 0 ? Math.PI / 2 : -Math.PI / 2;
    this.mixer.update(dt);
    this.model.updateMatrixWorld(true);
    const phase1 = this.current.time / this.current.getClip().duration;
    const moving = ti.mode === 'walk' || ti.mode === 'run';
    const step = moving && Math.floor(phase0 * 2) !== Math.floor(phase1 * 2);
    const B = this.bones;
    if (ti.mode === 'dying') {
      this.model.updateMatrixWorld(true);
      return false;
    }
    if (ti.mode === 'grab' && leviW) {
      const k = Math.min(1, age / (GRAB_MS / 1000));
      const sh = B.RightArm.getWorldPosition(new THREE.Vector3());
      const to = new THREE.Vector3(leviW.x - sh.x, leviW.y - sh.y, 0.3 * this.h).normalize();
      const wind = new THREE.Vector3(-f * 0.4, 1, 0.2);
      const d = k < 0.6 ? wind : wind.lerp(to, (k - 0.6) / 0.4);
      aim(B.RightArm, B.RightForeArm, d);
      aim(B.RightForeArm, B.RightHand, d);
      aim(B.LeftArm, B.LeftForeArm, d.clone().add(new THREE.Vector3(0, -0.3, -0.4)));
    }
    // The vacant stare: head lolls and turns toward the viewer.
    turnWorld(B.Head, AX_Y, -f * 0.6);
    turnWorld(B.Head, new THREE.Vector3(f, 0, 0), Math.sin(t * 0.7 + this.i * 2) * 0.2);
    if (this.jaw) {
      const chomp = ti.mode === 'edge' || ti.mode === 'run' ? 0.5 + 0.5 * Math.sin(t * (ti.mode === 'edge' ? 9 : 5) + this.i) : 0.15;
      turnWorld(this.jaw, AX_Z, -f * chomp * 0.35);
    }
    if (ti.mode === 'edge') {
      aim(B.RightArm, B.RightForeArm, new THREE.Vector3(f, -0.15 + Math.sin(t * 9 + this.i) * 0.2, 0.25));
      aim(B.RightForeArm, B.RightHand, new THREE.Vector3(f * 0.6, -1, 0.2));
      aim(B.LeftArm, B.LeftForeArm, new THREE.Vector3(f * 0.8, 0.1 + Math.sin(t * 7 + this.i) * 0.25, -0.25));
    }
    this.model.updateMatrixWorld(true);
    return step;
  }

  vents() {
    const head = this.bones.Head.getWorldPosition(new THREE.Vector3());
    const f = this.model.rotation.y > 0 ? 1 : -1;
    return {
      mouth: head.clone().add(new THREE.Vector3(f * this.h * 0.06, this.h * 0.03, 2)),
      nape: head.clone().add(new THREE.Vector3(-f * this.h * 0.05, -this.h * 0.02, 0)),
    };
  }
}

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.18, 'rgba(255,200,180,0.9)');
  grd.addColorStop(0.45, 'rgba(255,80,40,0.35)');
  grd.addColorStop(1, 'rgba(255,40,20,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

// The Colossal: the skinless fan model rising behind the Wall, screaming.
export class Colossal extends Actor {
  constructor(gltf, clips, scene, L) {
    super(gltf, clips, 1);
    this.model.traverse((o) => {
      if (o.isMesh) {
        o.material = withRim(o.material.clone(), 0xff6a3a, 1.2);
        o.castShadow = false;
      }
    });
    this.clip = Object.keys(clips)[0];
    this.play(this.clip, 0);
    this.mixer.update(0);
    this.model.updateMatrixWorld(true);
    const B = this.bones;
    const k = L.view.D / (L.view.D - Z_COLOSSAL);
    const headWorld = (L.screen.h * 0.3) / k;
    this.model.scale.multiplyScalar(headWorld * 7.5);
    this.model.updateMatrixWorld(true);
    this.armSide = Math.sign(B.LeftArm.getWorldPosition(new THREE.Vector3()).x - B.Hips.getWorldPosition(new THREE.Vector3()).x) || 1;
    this.poseArms();
    const neck = B.Neck.getWorldPosition(new THREE.Vector3());
    const head0 = B.Head.getWorldPosition(new THREE.Vector3());
    this.baseY = L.wall.top - neck.y + headWorld * 0.1;
    this.headWorld = headWorld;
    this.holder.position.set(-head0.x, this.baseY, Z_COLOSSAL);

    this.eyeMat = new THREE.SpriteMaterial({
      map: glowTexture(),
      color: 0xff3a1a,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      fog: false,
      toneMapped: false,
      opacity: 0,
    });
    const head = B.Head.getWorldPosition(new THREE.Vector3());
    const hs = B.HeadTop_End.getWorldPosition(new THREE.Vector3()).distanceTo(head);
    for (const s of [-1, 1]) {
      const e = new THREE.Sprite(this.eyeMat);
      e.position.copy(head).add(new THREE.Vector3(s * hs * 0.2, hs * 0.42, hs * 0.5));
      e.scale.setScalar(hs * 0.22);
      scene.add(e);
      B.Head.attach(e);
    }
    this.holder.visible = false;
    scene.add(this.holder);
  }

  update(rise, glow, age) {
    this.holder.visible = rise > 0;
    if (!this.holder.visible) return;
    const e = 1 - (1 - Math.min(1, rise)) ** 3;
    this.holder.position.y = this.baseY - (1 - e) * this.headWorld * 2.6;
    const a = this.actions[this.clip];
    a.time = Math.min(a.getClip().duration - 0.01, Math.max(0, age) * 0.8);
    this.mixer.update(0);
    this.model.updateMatrixWorld(true);
    this.poseArms();
    this.eyeMat.opacity = glow;
    this.eyeMat.color.setRGB(1, 0.22, 0.1).multiplyScalar(1 + glow * 2);
    this.model.updateMatrixWorld(true);
  }

  // Arms hang behind the Wall; only head, neck and shoulders clear it.
  poseArms() {
    const B = this.bones;
    for (const [side, s] of [
      ['Left', this.armSide],
      ['Right', -this.armSide],
    ]) {
      aim(B[`${side}Arm`], B[`${side}ForeArm`], new THREE.Vector3(s * 0.35, -1, -0.1));
      aim(B[`${side}ForeArm`], B[`${side}Hand`], new THREE.Vector3(s * 0.1, -1, 0.05));
    }
    this.model.updateMatrixWorld(true);
  }

  center() {
    return this.bones.Head.getWorldPosition(new THREE.Vector3());
  }

  vents() {
    const B = this.bones;
    return ['Head', 'HeadTop_End', 'Neck', 'LeftShoulder', 'RightShoulder', 'LeftArm', 'RightArm', 'Spine2'].map((n) => B[n].getWorldPosition(new THREE.Vector3()));
  }
}

const PRIMARY_CHILD = /^(Spine|Neck|Head|HeadTop_End|LeftHandMiddle1|RightHandMiddle1|(Left|Right)(ForeArm|Hand|Leg|Foot|ToeBase))$/;

// World-space retarget between rigs whose bone frames, names and rest poses
// differ (Mixamo vs. 3ds Max Biped): each target bone first has its rest
// direction swung onto the source's, then receives the source bone's
// world-space delta from rest. Root motion is dropped.
function retargetClips(src, dst, clips) {
  const srcRoot = SkeletonUtils.clone(src.scene);
  const dstRoot = SkeletonUtils.clone(dst.scene);
  const sb = bones(srcRoot);
  const db = bones(dstRoot);
  srcRoot.updateMatrixWorld(true);
  dstRoot.updateMatrixWorld(true);
  const order = [];
  dstRoot.traverse((o) => {
    if (!o.isBone) return;
    const n = canonical(o.name);
    if (sb[n] && db[n] === o) order.push(n);
  });
  const rest = {};
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  for (const n of order) {
    const Rs = sb[n].getWorldQuaternion(new THREE.Quaternion());
    const Rt = db[n].getWorldQuaternion(new THREE.Quaternion());
    const kids = db[n].children.filter((c) => c.isBone && sb[canonical(c.name)]);
    const kid = kids.find((c) => PRIMARY_CHILD.test(canonical(c.name))) ?? kids[0];
    const A = new THREE.Quaternion();
    if (kid) {
      const dt = kid.getWorldPosition(a).sub(db[n].getWorldPosition(b)).normalize().clone();
      const ds = sb[canonical(kid.name)].getWorldPosition(a).sub(sb[n].getWorldPosition(b)).normalize();
      A.setFromUnitVectors(dt, ds);
    }
    rest[n] = { invRs: Rs.invert(), RtA: A.multiply(Rt), parentW: db[n].parent.getWorldQuaternion(new THREE.Quaternion()) };
  }

  const mixer = new THREE.AnimationMixer(srcRoot);
  const out = [];
  const q = new THREE.Quaternion();
  for (const clip of clips) {
    const action = mixer.clipAction(clip);
    action.play();
    const times = clip.tracks.find((tr) => tr.name.endsWith('.quaternion')).times;
    const vals = Object.fromEntries(order.map((n) => [n, new Float32Array(times.length * 4)]));
    const W = new Map();
    times.forEach((time, f) => {
      mixer.setTime(time);
      srcRoot.updateMatrixWorld(true);
      for (const n of order) {
        const w = sb[n].getWorldQuaternion(new THREE.Quaternion()).multiply(rest[n].invRs).multiply(rest[n].RtA);
        W.set(db[n], w);
        const pw = W.get(db[n].parent) ?? rest[n].parentW;
        q.copy(pw).invert().multiply(w);
        q.toArray(vals[n], f * 4);
      }
    });
    action.stop();
    mixer.uncacheAction(clip);
    const tracks = order.map((n) => new THREE.QuaternionKeyframeTrack(`${db[n].name}.quaternion`, times, vals[n]));
    out.push(new THREE.AnimationClip(clip.name, clip.duration, tracks));
  }
  return out;
}

export function makeClips(models) {
  const moves = (g) => g.animations.filter((c) => ['idle', 'walk', 'run'].includes(c.name.toLowerCase()));
  return {
    levi: prepClips(retargetClips(models.soldier, models.levi, moves(models.soldier))),
    titan: prepClips(retargetClips(models.xbot, models.smiler, moves(models.xbot))),
    colossal: prepClips(
      models.colossal.animations.map((c) => {
        const k = c.clone();
        k.tracks = k.tracks.filter((tr) => /^(Spine|Spine1|Spine2|Neck|Head)$/.test(canonical(tr.name.split('.')[0])));
        return k;
      }),
    ),
  };
}
