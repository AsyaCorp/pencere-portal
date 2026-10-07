// Titan-mode world layout, pure math so the leader's game logic and every
// window's renderer agree. The screen is one big portal: world units equal
// screen pixels on the z = 0 plane, the eye sits in front of it at the
// horizon line, and depth (negative z) shrinks things toward that eye.

export const Z_NEAR_ROW = -30;
export const Z_WALL = -2600;
export const Z_COLOSSAL = -3300;

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

export function makeView(screen) {
  const D = screen.h * 2.2;
  const cx = screen.x + screen.w / 2;
  const cy = screen.y + screen.h / 2;
  const eye = { x: 0, y: cy - (screen.y + screen.h * 0.62), z: D };
  const project = (X, Y, Z) => {
    const t = D / (D - Z);
    return { x: cx + eye.x + (X - eye.x) * t, y: cy - (eye.y + (Y - eye.y) * t) };
  };
  const toWorld = (sx, sy, Z) => {
    const t = D / (D - Z);
    return { x: eye.x + (sx - cx - eye.x) / t, y: eye.y + (cy - sy - eye.y) / t };
  };
  return { D, cx, cy, eye, project, toWorld };
}

export function titanLayout(screen) {
  const { x: X, y: Y, w: W, h: H } = screen;
  const view = makeView(screen);
  const rand = rng(0x7174a9);
  const groundY = Y + H * 0.8;
  const Yg = view.cy - groundY;

  const towerScreenX = X + W * 0.62;
  const towerTopScreen = Y + H * 0.38;
  const tw = 70;
  const tower = {
    xw: view.toWorld(towerScreenX, 0, Z_NEAR_ROW).x,
    top: view.toWorld(0, towerTopScreen, Z_NEAR_ROW).y,
    w: tw,
    d: tw,
    z: Z_NEAR_ROW,
  };

  const near = [];
  const span = view.toWorld(X + W * 1.08, 0, Z_NEAR_ROW).x;
  for (let x = -span; x < span; ) {
    const w = 110 + rand() * 90;
    const cxh = x + w / 2;
    if (Math.abs(cxh - tower.xw) < w / 2 + tw / 2 + 8) {
      x = tower.xw + tw / 2 + 8;
      continue;
    }
    near.push({ x: cxh, w, h: 150 + rand() * 100, d: 90 + rand() * 60, roof: w * (0.45 + rand() * 0.3), gableFront: rand() < 0.7, z: Z_NEAR_ROW, seed: rand() });
    x += w + 4 + rand() * 30;
  }

  const mid = [];
  for (let z = -260; z > Z_WALL + 220; z -= 170 + rand() * 70) {
    const half = view.toWorld(X + W * 1.1, 0, z).x;
    for (let x = -half; x < half; ) {
      const w = 90 + rand() * 90;
      const spire = rand() < 0.035;
      mid.push({
        x: x + w / 2,
        w: spire ? 70 : w,
        h: spire ? 260 + rand() * 80 : 100 + rand() * 110,
        d: 90 + rand() * 60,
        roof: spire ? 150 + rand() * 60 : w * (0.4 + rand() * 0.35),
        gableFront: rand() < 0.5,
        z,
        seed: rand(),
        spire,
      });
      x += w + rand() * 24;
    }
  }

  const smoke = mid
    .filter((m, i) => i % 23 === 7 && m.z < -600)
    .slice(0, 7)
    .map((m) => ({ x: m.x, y: Yg + m.h + m.roof * 0.5, z: m.z }));

  // Hookable surfaces in screen space: house bodies and roofs, the tower,
  // the Wall's crest.
  const solids = [];
  for (const b of near) {
    const a = view.project(b.x - b.w / 2, Yg, Z_NEAR_ROW);
    const c = view.project(b.x + b.w / 2, Yg + b.h, Z_NEAR_ROW);
    const ridge = view.project(b.x, Yg + b.h + (b.gableFront ? b.roof : b.roof * 0.6), Z_NEAR_ROW);
    solids.push({ x0: a.x, x1: c.x, y0: c.y, y1: a.y });
    solids.push({ x0: a.x + (c.x - a.x) * 0.2, x1: c.x - (c.x - a.x) * 0.2, y0: ridge.y, y1: c.y });
  }
  const t0 = view.project(tower.xw - tw / 2, Yg, Z_NEAR_ROW);
  const t1 = view.project(tower.xw + tw / 2, tower.top, Z_NEAR_ROW);
  solids.push({ x0: t0.x, x1: t1.x, y0: t1.y - 10, y1: t0.y });

  const wallTop = view.toWorld(0, Y + H * 0.34, Z_WALL).y;
  const wallHalf = view.toWorld(X + W * 1.4, 0, Z_WALL).x;
  solids.push({ x0: X, x1: X + W, y0: Y + H * 0.335, y1: Y + H * 0.36 });

  return {
    screen,
    view,
    groundY,
    Yg,
    near,
    mid,
    smoke,
    solids,
    towerW: tower,
    tower: { x: towerScreenX, top: towerTopScreen },
    wall: { z: Z_WALL, top: wallTop, half: wallHalf, crestY: Y + H * 0.34 },
    colossal: { x: X + W / 2, napeY: Y + H * 0.31 },
  };
}

export function hitSolid(L, x, y) {
  return L.solids.some((s) => x >= s.x0 && x <= s.x1 && y >= s.y0 && y <= s.y1);
}

// Ground exists only inside windows that contain the ground line; the union
// of their horizontal extents is walkable, gaps between are chasms.
export function walkSpans(rects, groundY) {
  const spans = rects
    .filter((r) => r.y + 20 <= groundY && r.y + r.h >= groundY + 6)
    .map((r) => ({ a: r.x, b: r.x + r.w }))
    .sort((p, q) => p.a - q.a);
  const out = [];
  for (const s of spans) {
    const last = out[out.length - 1];
    if (last && s.a <= last.b + 2) last.b = Math.max(last.b, s.b);
    else out.push({ ...s });
  }
  return out;
}

export const spanAt = (spans, x) => spans.find((s) => x >= s.a - 0.5 && x <= s.b + 0.5) ?? null;

export const inRects = (rects, x, y) => rects.some((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
