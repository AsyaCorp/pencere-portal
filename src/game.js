export const BALL_R = 14;
// The target is a docking port: STAR_R is its reticle radius, PULL_R the range
// at which it locks on, HORIZON the distance at which the probe docks.
export const STAR_R = 18;
export const PULL_R = 150;
const HORIZON = 10;
// A lock is kept until docking unless the probe drifts this far away.
const LOCK_RELEASE = 260;
export const DOCK_HOLD = 1.5;
export const TRAIL_LEN = 48;
// Launch and nudge headings keep this far from the axes, otherwise the probe
// can bounce along one line forever.
const MIN_AXIS_ANGLE = (15 * Math.PI) / 180;
const STUCK_AFTER = 20;

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
    hold: 0,
    t: Date.now(),
  };
}

function offAxis(a) {
  const q = Math.PI / 2;
  const tau = Math.PI * 2;
  const n = ((a % tau) + tau) % tau;
  const quadrant = Math.floor(n / q);
  const within = Math.min(Math.max(n - quadrant * q, MIN_AXIS_ANGLE), q - MIN_AXIS_ANGLE);
  return quadrant * q + within;
}

function randomHeading() {
  return Math.floor(Math.random() * 4) * (Math.PI / 2) + MIN_AXIS_ANGLE + Math.random() * (Math.PI / 2 - 2 * MIN_AXIS_ANGLE);
}

export function launch(state, home) {
  const a = randomHeading();
  const s = cruiseSpeed(state.level);
  state.ball = {
    x: home.x + home.w / 2,
    y: home.y + home.h / 2,
    vx: Math.cos(a) * s,
    vy: Math.sin(a) * s,
    active: true,
    locked: false,
  };
  state.trail = [];
  state.hold = 0;
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

// Once locked, the velocity eases toward a straight run at the port that slows
// down on final approach, which bends the path into a soft curve.
function approach(b, dock, h) {
  const dx = dock.x - b.x;
  const dy = dock.y - b.y;
  const d = Math.hypot(dx, dy);
  if (d < 1e-3) return;
  const k = 1 - Math.min(1, d / PULL_R);
  const speed = 110 + 300 * (1 - k);
  const blend = 1 - Math.exp(-h * (10 + 30 * k));
  b.vx += ((dx / d) * speed - b.vx) * blend;
  b.vy += ((dy / d) * speed - b.vy) * blend;
}

function nudge(b) {
  const s = Math.hypot(b.vx, b.vy);
  const turn = (Math.random() < 0.5 ? -1 : 1) * ((10 + Math.random() * 15) * Math.PI) / 180;
  const a = offAxis(Math.atan2(b.vy, b.vx) + turn);
  b.vx = Math.cos(a) * s;
  b.vy = Math.sin(a) * s;
}

// world: { rects, home, screen, owner, sinceHandoff } — owner is the id of the
// window the ball currently lives in; world is kept between frames by the leader.
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

  if (state.hold > 0) {
    state.hold = Math.max(0, state.hold - dt);
    return events;
  }

  world.sinceHandoff = (world.sinceHandoff ?? 0) + dt;
  if (world.sinceHandoff > STUCK_AFTER && !b.locked) {
    nudge(b);
    world.sinceHandoff = 0;
  }

  // A window was dragged away or closed under the ball: pull it back inside.
  if (!circleFits(rects, b.x, b.y)) {
    const p = nearestFit(rects, b.x, b.y);
    if (p) {
      b.x = p.x;
      b.y = p.y;
    }
  }

  const speed = Math.max(Math.hypot(b.vx, b.vy), cruiseSpeed(state.level) * 1.6);
  const steps = Math.min(32, Math.max(1, Math.ceil((speed * dt) / (BALL_R * 0.5))));
  const h = dt / steps;
  // The port only locks on while it is inside a window, so the approach is visible.
  const dockOpen = inUnion(rects, state.star.x, state.star.y);
  const dockDist = Math.hypot(state.star.x - b.x, state.star.y - b.y);
  if (!dockOpen || dockDist > LOCK_RELEASE) b.locked = false;
  else if (dockDist < PULL_R) b.locked = true;

  for (let i = 0; i < steps; i++) {
    if (b.locked) approach(b, state.star, h);
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
            from: cur.id,
            to: next.id,
          });
          world.sinceHandoff = 0;
        }
        world.owner = next.id;
      }
    }

    const star = state.star;
    if (Math.hypot(b.x - star.x, b.y - star.y) < HORIZON) {
      state.level += 1;
      events.push({ kind: 'win', x: star.x, y: star.y, seed: (Math.random() * 2 ** 31) | 0, level: state.level });
      state.star = placeStar(world.screen, world.home, star);
      const a = randomHeading();
      const s = cruiseSpeed(state.level);
      b.x = star.x;
      b.y = star.y;
      b.vx = Math.cos(a) * s;
      b.vy = Math.sin(a) * s;
      b.locked = false;
      state.hold = DOCK_HOLD;
      world.sinceHandoff = 0;
      break;
    }
  }

  const sp = Math.hypot(b.vx, b.vy);
  if (sp > 0 && !b.locked && state.hold === 0) {
    const target = cruiseSpeed(state.level);
    const ns = sp + (target - sp) * Math.min(1, dt * CRUISE_EASE);
    b.vx *= ns / sp;
    b.vy *= ns / sp;
  }

  state.trail.push([b.x, b.y]);
  if (state.trail.length > TRAIL_LEN) state.trail.splice(0, state.trail.length - TRAIL_LEN);
  return events;
}
