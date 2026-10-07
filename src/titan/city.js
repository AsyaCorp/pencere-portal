import * as THREE from 'three';

// Procedural textures and merged geometry for the walled city.

const TILE = 64;

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvasTexture(w, h, draw, srgb = true) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function speckle(g, w, h, rand, n, colors, size = 2) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = colors[(rand() * colors.length) | 0];
    g.fillRect(rand() * w, rand() * h, size * rand() + 0.5, size * rand() + 0.5);
  }
}

// Four half-timbered bays (one bay = TILE world units square), plus a
// matching emissive map with a few windows lit for dusk.
function timberTextures() {
  const rand = rng(11);
  const lit = [];
  const map = canvasTexture(1024, 256, (g, w, h) => {
    g.fillStyle = '#c4a983';
    g.fillRect(0, 0, w, h);
    speckle(g, w, h, rand, 9000, ['#b89d78', '#cdb38e', '#a98f6c', '#d6bf9a'], 3);
    for (let b = 0; b < 4; b++) {
      const x0 = b * 256;
      g.fillStyle = '#3a271a';
      g.fillRect(x0, 0, 16, h);
      g.fillRect(x0, 0, 256, 14);
      g.fillRect(x0, 124, 256, 12);
      g.fillRect(x0 + 120, 136, 14, 120);
      g.lineWidth = 12;
      g.strokeStyle = '#3a271a';
      g.beginPath();
      if (b % 2) {
        g.moveTo(x0 + 16, 136);
        g.lineTo(x0 + 120, 250);
        g.moveTo(x0 + 256, 136);
        g.lineTo(x0 + 134, 250);
      } else {
        g.moveTo(x0 + 16, 250);
        g.lineTo(x0 + 120, 136);
      }
      g.stroke();
      const on = rand() < 0.45;
      lit.push(on);
      g.fillStyle = '#2b1c13';
      g.fillRect(x0 + 74, 34, 108, 72);
      g.fillStyle = on ? '#6b4320' : '#140d09';
      g.fillRect(x0 + 82, 40, 92, 60);
      g.fillStyle = '#2b1c13';
      g.fillRect(x0 + 125, 40, 6, 60);
      g.fillRect(x0 + 82, 67, 92, 5);
      if (b % 2 === 0) {
        g.fillStyle = '#140d09';
        g.fillRect(x0 + 170, 160, 50, 86);
      }
    }
    g.globalAlpha = 0.25;
    speckle(g, w, h, rand, 600, ['#2a1d14'], 6);
    g.globalAlpha = 1;
  });
  const emissive = canvasTexture(1024, 256, (g, w, h) => {
    g.fillStyle = '#000';
    g.fillRect(0, 0, w, h);
    for (let b = 0; b < 4; b++) {
      if (!lit[b]) continue;
      const x0 = b * 256;
      const grad = g.createLinearGradient(0, 40, 0, 100);
      grad.addColorStop(0, '#ffb35c');
      grad.addColorStop(1, '#d9672a');
      g.fillStyle = grad;
      g.fillRect(x0 + 82, 40, 92, 60);
      g.fillStyle = '#000';
      g.fillRect(x0 + 125, 40, 6, 60);
      g.fillRect(x0 + 82, 67, 92, 5);
    }
  });
  map.repeat.set(1 / 4, 1);
  emissive.repeat.set(1 / 4, 1);
  return { map, emissive };
}

function roofTexture() {
  const rand = rng(23);
  return canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = '#5c2416';
    g.fillRect(0, 0, w, h);
    const rows = 12;
    const rh = h / rows;
    for (let r = 0; r < rows; r++) {
      const off = (r % 2) * 11;
      for (let x = -off; x < w; x += 22) {
        const k = rand();
        g.fillStyle = k < 0.3 ? '#8e3a22' : k < 0.7 ? '#a3472a' : k < 0.9 ? '#7a311d' : '#6b5a3a';
        g.beginPath();
        g.roundRect(x + 1, r * rh + 1, 20, rh - 1, [0, 0, 7, 7]);
        g.fill();
        g.fillStyle = 'rgba(0,0,0,0.28)';
        g.fillRect(x + 1, r * rh + rh - 4, 20, 3);
      }
    }
    g.globalAlpha = 0.2;
    speckle(g, w, h, rand, 500, ['#2b1a10', '#3e4a2a'], 8);
  });
}

function stoneTexture(seed, base, block = [64, 32]) {
  const rand = rng(seed);
  return canvasTexture(512, 512, (g, w, h) => {
    g.fillStyle = '#4a443c';
    g.fillRect(0, 0, w, h);
    const [bw, bh] = block;
    for (let y = 0; y < h; y += bh) {
      const off = ((y / bh) % 2) * (bw / 2);
      for (let x = -off; x < w; x += bw) {
        const v = (rand() - 0.5) * 22;
        g.fillStyle = `rgb(${base[0] + v}, ${base[1] + v}, ${base[2] + v * 0.8})`;
        g.fillRect(x + 2, y + 2, bw - 3, bh - 3);
        g.fillStyle = 'rgba(255,240,220,0.06)';
        g.fillRect(x + 2, y + 2, bw - 3, 3);
      }
    }
    speckle(g, w, h, rand, 6000, ['rgba(40,34,28,0.35)', 'rgba(200,190,170,0.2)'], 3);
    for (let i = 0; i < 40; i++) {
      const x = rand() * w;
      const grad = g.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, 'rgba(30,24,18,0.0)');
      grad.addColorStop(0.3 + rand() * 0.4, 'rgba(30,24,18,0.22)');
      grad.addColorStop(1, 'rgba(30,24,18,0.0)');
      g.fillStyle = grad;
      g.fillRect(x, 0, 4 + rand() * 14, h);
    }
  });
}

function cobbleTexture() {
  const rand = rng(41);
  return canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = '#1d1712';
    g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 18) {
      const off = ((y / 18) % 2) * 12;
      for (let x = -off; x < w; x += 24) {
        const v = rand() * 26;
        g.fillStyle = `rgb(${62 + v}, ${54 + v}, ${46 + v})`;
        g.beginPath();
        g.ellipse(x + 12, y + 9, 10.5, 7.5, 0, 0, Math.PI * 2);
        g.fill();
      }
    }
  });
}

// Builds flat-shaded boxes with gable roofs into two merged geometries.
class GeoBuilder {
  constructor() {
    this.pos = [];
    this.nrm = [];
    this.uv = [];
  }
  tri(a, b, c, n, uva, uvb, uvc) {
    this.pos.push(...a, ...b, ...c);
    this.nrm.push(...n, ...n, ...n);
    this.uv.push(...uva, ...uvb, ...uvc);
  }
  // Quad a-b-c-d counter-clockwise seen from the normal side. UVs come from
  // the face's own axes (u along a->b, v along a->d) in TILE units.
  quad(a, b, c, d, n, u0 = 0, v0 = 0) {
    const lu = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / TILE;
    const lv = Math.hypot(d[0] - a[0], d[1] - a[1], d[2] - a[2]) / TILE;
    const A = [u0, v0];
    const B = [u0 + lu, v0];
    const C = [u0 + lu, v0 + lv];
    const Dd = [u0, v0 + lv];
    this.tri(a, b, c, n, A, B, C);
    this.tri(a, c, d, n, A, C, Dd);
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.computeBoundingSphere();
    return g;
  }
}

function house(walls, roofs, b, Yg) {
  const x0 = b.x - b.w / 2;
  const x1 = b.x + b.w / 2;
  const zf = b.z;
  const zb = b.z - b.d;
  const y0 = Yg;
  const y1 = Yg + b.h;
  const u0 = Math.floor(b.seed * 4);
  walls.quad([x0, y0, zf], [x1, y0, zf], [x1, y1, zf], [x0, y1, zf], [0, 0, 1], u0);
  walls.quad([x1, y0, zf], [x1, y0, zb], [x1, y1, zb], [x1, y1, zf], [1, 0, 0], u0 + 1);
  walls.quad([x0, y0, zb], [x0, y0, zf], [x0, y1, zf], [x0, y1, zb], [-1, 0, 0], u0 + 2);
  walls.quad([x1, y0, zb], [x0, y0, zb], [x0, y1, zb], [x1, y1, zb], [0, 0, -1], u0 + 3);
  const top = y1 + b.roof;
  const o = 4;
  if (b.gableFront) {
    const xm = b.x;
    walls.tri([x0, y1, zf], [x1, y1, zf], [xm, top, zf], [0, 0, 1], [0, 0], [b.w / TILE, 0], [b.w / TILE / 2, b.roof / TILE]);
    walls.tri([x1, y1, zb], [x0, y1, zb], [xm, top, zb], [0, 0, -1], [0, 0], [b.w / TILE, 0], [b.w / TILE / 2, b.roof / TILE]);
    const nl = new THREE.Vector3(-b.roof, b.w / 2, 0).normalize().toArray();
    const nr = new THREE.Vector3(b.roof, b.w / 2, 0).normalize().toArray();
    roofs.quad([x0 - o, y1 - 2, zb - o], [x0 - o, y1 - 2, zf + o], [xm, top, zf + o], [xm, top, zb - o], nl);
    roofs.quad([x1 + o, y1 - 2, zf + o], [x1 + o, y1 - 2, zb - o], [xm, top, zb - o], [xm, top, zf + o], nr);
  } else {
    const zm = (zf + zb) / 2;
    walls.tri([x1, y1, zf], [x1, y1, zb], [x1, top, zm], [1, 0, 0], [0, 0], [b.d / TILE, 0], [b.d / TILE / 2, b.roof / TILE]);
    walls.tri([x0, y1, zb], [x0, y1, zf], [x0, top, zm], [-1, 0, 0], [0, 0], [b.d / TILE, 0], [b.d / TILE / 2, b.roof / TILE]);
    const nf = new THREE.Vector3(0, b.d / 2, b.roof).normalize().toArray();
    const nb = new THREE.Vector3(0, b.d / 2, -b.roof).normalize().toArray();
    roofs.quad([x0 - o, y1 - 2, zf + o], [x1 + o, y1 - 2, zf + o], [x1 + o, top, zm], [x0 - o, top, zm], nf);
    roofs.quad([x1 + o, y1 - 2, zb - o], [x0 - o, y1 - 2, zb - o], [x0 - o, top, zm], [x1 + o, top, zm], nb);
  }
  if (!b.spire && b.seed > 0.55) {
    const cx = x0 + b.w * (0.25 + b.seed * 0.4);
    const cz = zf - b.d * 0.4;
    const ch = b.roof * 0.9;
    walls.quad([cx - 5, y1, cz + 5], [cx + 5, y1, cz + 5], [cx + 5, y1 + ch, cz + 5], [cx - 5, y1 + ch, cz + 5], [0, 0, 1], 0.4, 0.7);
  }
}

export function buildCity(L) {
  const { Yg } = L;
  const timber = timberTextures();
  const roofMap = roofTexture();
  const stone = stoneTexture(5, [128, 118, 104]);
  const wallStone = stoneTexture(9, [140, 128, 112], [96, 40]);
  const cobble = cobbleTexture();

  const wallMat = new THREE.MeshStandardMaterial({
    map: timber.map,
    emissiveMap: timber.emissive,
    emissive: new THREE.Color(1.6, 0.9, 0.45),
    roughness: 0.92,
  });
  const roofMat = new THREE.MeshStandardMaterial({ map: roofMap, roughness: 0.75 });
  const group = new THREE.Group();

  for (const [list, shadows] of [
    [L.near, true],
    [L.mid, false],
  ]) {
    const walls = new GeoBuilder();
    const roofs = new GeoBuilder();
    for (const b of list) house(walls, roofs, b, Yg);
    const wm = new THREE.Mesh(walls.build(), wallMat);
    const rm = new THREE.Mesh(roofs.build(), roofMat);
    for (const m of [wm, rm]) {
      m.castShadow = shadows;
      m.receiveShadow = shadows;
      group.add(m);
    }
  }

  // The watchtower the soldiers race to.
  const T = L.towerW;
  const towerMat = new THREE.MeshStandardMaterial({ map: stone, roughness: 0.95 });
  const th = T.top - Yg;
  const towerGeo = new GeoBuilder();
  const box = (x0, x1, y0, y1, z0, z1) => {
    towerGeo.quad([x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [0, 0, 1]);
    towerGeo.quad([x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0], [1, 0, 0]);
    towerGeo.quad([x0, y0, z1], [x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [-1, 0, 0]);
    towerGeo.quad([x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], [0, 1, 0]);
  };
  const tx0 = T.xw - T.w / 2;
  const tx1 = T.xw + T.w / 2;
  box(tx0, tx1, Yg, T.top - 8, T.z, T.z - T.d);
  box(tx0 - 5, tx1 + 5, T.top - 8, T.top, T.z + 5, T.z - T.d - 5);
  for (let i = 0; i < 4; i++) {
    const x = tx0 - 5 + i * ((T.w + 10 - 8) / 3);
    box(x, x + 8, T.top, T.top + 9, T.z + 5, T.z + 1);
  }
  const towerMesh = new THREE.Mesh(towerGeo.build(), towerMat);
  towerMesh.castShadow = towerMesh.receiveShadow = true;
  group.add(towerMesh);

  // The Wall: a 50 m slab of weathered stone across the whole view.
  const W = L.wall;
  const wallH = W.top - Yg;
  const wallTex = wallStone.clone();
  wallTex.needsUpdate = true;
  wallTex.repeat.set((W.half * 2) / 512, wallH / 512);
  const slab = new THREE.Mesh(new THREE.PlaneGeometry(W.half * 2, wallH + 40), new THREE.MeshStandardMaterial({ map: wallTex, roughness: 1 }));
  slab.position.set(0, Yg + wallH / 2 - 20, W.z);
  group.add(slab);
  const lipTex = wallStone.clone();
  lipTex.needsUpdate = true;
  lipTex.repeat.set((W.half * 2) / 256, 0.12);
  const lip = new THREE.Mesh(new THREE.BoxGeometry(W.half * 2, 26, 60), new THREE.MeshStandardMaterial({ map: lipTex, roughness: 1 }));
  lip.position.set(0, W.top - 6, W.z + 24);
  group.add(lip);

  const cobbleTex = cobble.clone();
  cobbleTex.needsUpdate = true;
  const gw = L.wall.half * 2.2;
  const front = L.view.D + 100;
  const gd = front - L.wall.z + 100;
  cobbleTex.repeat.set(gw / TILE, gd / TILE);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(gw, gd), new THREE.MeshStandardMaterial({ map: cobbleTex, roughness: 0.95, color: 0x8a7a6a }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, Yg, front - gd / 2);
  ground.receiveShadow = true;
  group.add(ground);

  return group;
}
