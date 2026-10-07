export const BALL_R = 14;
export const STAR_R = 26;
export const TRAIL_LEN = 30;

const BOUNCE_DAMP = 0.9;
// After a damped bounce the ball eases back to its cruise speed, so it keeps
// gliding at a constant pace instead of slowly dying out.
const CRUISE_EASE = 0.8;

export function cruiseSpeed(level) {
  return Math.min(380 + (level - 1) * 70, 1100);
}

export function rectContains(r, x, y) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

function inUnion(rects, x, y) {
  for (const r of rects) if (rectContains(r, x, y)) return true;
  return false;
}

const RIM = Array.from({ length: 16 }, (_, i) => {
  const a = (i / 16) * Math.PI * 2;
  return [Math.cos(a), Math.sin(a)];
});

export function circleFits(rects, x, y, r = BALL_R) {
  if (!inUnion(rects, x, y)) return false;
  for (const [cx, cy] of RIM) if (!inUnion(rects, x + cx * r, y + cy * r)) return false;
  return true;
}

function nearestFit(rects, x, y, r = BALL_R) {
  let best = null;
  let bestD = Infinity;
  for (const rc of rects) {
    if (rc.w < 2 * r || rc.h < 2 * r) continue;
    const px = Math.min(Math.max(x, rc.x + r), rc.x + rc.w - r);
    const py = Math.min(Math.max(y, rc.y + r), rc.y + rc.h - r);
    const d = Math.hypot(px - x, py - y);
    if (d < bestD) {
      bestD = d;
      best = { x: px, y: py };
    }
  }
  return best;
}

export function placeStar(screen, avoid, prev) {
  const margin = 150;
  const jitter = 120;
  const pad = 60;
  let p = null;
  for (let i = 0; i < 40; i++) {
    const right = Math.random() < 0.5;
    const bottom = Math.random() < 0.5;
    p = {
      x: right ? screen.x + screen.w - margin - Math.random() * jitter : screen.x + margin + Math.random() * jitter,
      y: bottom ? screen.y + screen.h - margin - Math.random() * jitter : screen.y + margin + Math.random() * jitter,
    };
    if (prev && Math.hypot(p.x - prev.x, p.y - prev.y) < Math.min(screen.w, screen.h) * 0.4) continue;
    if (
      avoid &&
      p.x > avoid.x - pad &&
      p.x < avoid.x + avoid.w + pad &&
      p.y > avoid.y - pad &&
      p.y < avoid.y + avoid.h + pad
    ) {
      continue;
    }
    return p;
  }
  return p;
}

export function createState(screen, home) {
  return {
    level: 1,
    star: placeStar(screen, home, null),
    ball: { x: home.x + home.w / 2, y: home.y + home.h / 2, vx: 0, vy: 0, active: false },
    trail: [],
    t: Date.now(),
  };
}

export function launch(state, home) {
  const a = Math.random() * Math.PI * 2;
  const s = cruiseSpeed(state.level);
  state.ball = {
    x: home.x + home.w / 2,
    y: home.y + home.h / 2,
    vx: Math.cos(a) * s,
    vy: Math.sin(a) * s,
    active: true,
  };
  state.trail = [];
}

export function reset(state, screen, home) {
  Object.assign(state, createState(screen, home));
}

// Moves the ball by one small step; returns the wall normal on a bounce.
function stepBall(b, rects, h) {
  const nx = b.x + b.vx * h;
  const ny = b.y + b.vy * h;
  if (circleFits(rects, nx, ny)) {
    b.x = nx;
    b.y = ny;
    return null;
  }
  const okX = circleFits(rects, nx, b.y);
  const okY = circleFits(rects, b.x, ny);
  const hit = { nx: 0, ny: 0 };
  if (!okX || (okX && okY)) {
    hit.nx = Math.sign(b.vx);
    b.vx = -b.vx * BOUNCE_DAMP;
  }
  if (!okY || (okX && okY)) {
    hit.ny = Math.sign(b.vy);
    b.vy = -b.vy * BOUNCE_DAMP;
  }
  if (okX && !okY) b.x = nx;
  else if (okY && !okX) b.y = ny;
  return hit;
}

// world: { rects, home, screen, owner } — owner is the id of the window the
// ball currently lives in; it is kept between frames by the leader.
export function update(state, world, dt) {
  const events = [];
  const b = state.ball;
  const { rects } = world;

  if (!b.active) {
    b.x = world.home.x + world.home.w / 2;
    b.y = world.home.y + world.home.h / 2;
    state.trail.length = 0;
    return events;
  }

  // A window was dragged away or closed under the ball: pull it back inside.
  if (!circleFits(rects, b.x, b.y)) {
    const p = nearestFit(rects, b.x, b.y);
    if (p) {
      b.x = p.x;
      b.y = p.y;
    }
  }

  const speed = Math.hypot(b.vx, b.vy);
  const steps = Math.min(24, Math.max(1, Math.ceil((speed * dt) / (BALL_R * 0.5))));
  const h = dt / steps;

  for (let i = 0; i < steps; i++) {
    const hit = stepBall(b, rects, h);
    if (hit) events.push({ kind: 'bounce', x: b.x + hit.nx * BALL_R, y: b.y + hit.ny * BALL_R });

    const cur = rects.find((r) => r.id === world.owner);
    if (!cur || !rectContains(cur, b.x, b.y)) {
      const next = rects.find((r) => rectContains(r, b.x, b.y));
      if (next) {
        if (cur) {
          events.push({
            kind: 'ripple',
            x: Math.min(Math.max(b.x, cur.x), cur.x + cur.w),
            y: Math.min(Math.max(b.y, cur.y), cur.y + cur.h),
          });
        }
        world.owner = next.id;
      }
    }

    const star = state.star;
    if (Math.hypot(b.x - star.x, b.y - star.y) < BALL_R + STAR_R * 0.85) {
      state.level += 1;
      events.push({ kind: 'win', x: star.x, y: star.y, seed: (Math.random() * 2 ** 31) | 0, level: state.level });
      state.star = placeStar(world.screen, world.home, star);
      const k = cruiseSpeed(state.level) / (Math.hypot(b.vx, b.vy) || 1);
      b.vx *= k;
      b.vy *= k;
      break;
    }
  }

  const sp = Math.hypot(b.vx, b.vy);
  if (sp > 0) {
    const target = cruiseSpeed(state.level);
    const ns = sp + (target - sp) * Math.min(1, dt * CRUISE_EASE);
    b.vx *= ns / sp;
    b.vy *= ns / sp;
  }

  state.trail.push([b.x, b.y]);
  if (state.trail.length > TRAIL_LEN) state.trail.splice(0, state.trail.length - TRAIL_LEN);
  return events;
}
