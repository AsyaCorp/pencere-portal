// Ense Avı: the leader's simulation. Levi flies on ODM gear between hooks
// that only catch on things visible inside a window; titans walk the ground
// that windows provide and can't cross the chasms between them. Slash five
// napes, then reach the Colossal's before it blasts the city.

import { hitSolid, inRects, spanAt, walkSpans } from './world.js';

export const KILLS_TO_COLOSSAL = 5;
export const LIVES = 3;
export const TITAN_HEIGHTS = [0.46, 0.38, 0.55, 0.42];
export const LEVI_H = 0.065;
export const COLOSSAL_MS = 25000;
export const COLOSSAL_READY_MS = 3500;
export const END_MS = 7000;
export const GRAB_MS = 650;

const MAX_TITANS = 3;
const G = 1900;
const HOOK_RANGE = 0.6;
const REEL = 1400;
const PULL = 4200;
const KICK = 520;
const GAS = 620;
const GAS_COOLDOWN = 450;
const AIR_STEER = 520;
const WALK = 280;
const MAX_SPEED = 1700;
const ORBIT_DAMP = 3.5;
const SLASH_SPEED = 320;
const SLOW_MS = 700;
const RESPAWN_MS = 1600;
const SPAWN_GRACE_MS = 1800;
const DYING_MS = 2600;
const SPAWN_GAP_MS = 1800;

export function createTitanState() {
  return {
    phase: 'ready',
    phaseAt: Date.now(),
    levi: { x: 0, y: 0, vx: 0, vy: 0, dir: 1, mode: 'ground', placed: false, hook: null, gasAt: 0, slashAt: 0, deadAt: 0, grabbedBy: -1 },
    input: { x: 0, y: 0, down: false, move: 0, hookReq: null, gasReq: false },
    titans: [],
    kills: 0,
    lives: LIVES,
    nextId: 1,
    spawnAt: 0,
    slowUntil: 0,
    colossalAt: 0,
    endAt: 0,
    endKind: '',
  };
}

export function titanCommand(state, cmd) {
  if (cmd === 'reset' || cmd?.kind === 'reset') {
    Object.assign(state, createTitanState());
    return;
  }
  const inp = state.input;
  switch (cmd?.kind) {
    case 'aim':
      inp.x = cmd.x;
      inp.y = cmd.y;
      break;
    case 'hook':
      inp.x = cmd.x ?? inp.x;
      inp.y = cmd.y ?? inp.y;
      inp.down = cmd.down;
      if (cmd.down) inp.hookReq = { x: inp.x, y: inp.y };
      break;
    case 'gas':
      inp.x = cmd.x ?? inp.x;
      inp.y = cmd.y ?? inp.y;
      inp.gasReq = true;
      break;
    case 'move':
      inp.move = cmd.dir;
      break;
  }
}

const titanH = (L, t) => t.hf * L.screen.h;
export const napeOf = (L, t) => {
  const h = titanH(L, t);
  return { x: t.x - t.dir * h * 0.06, y: L.groundY - h * 0.85, r: Math.max(48, h * 0.12) };
};
const bodyHit = (L, t, x, y) => {
  const h = titanH(L, t);
  return Math.abs(x - t.x) < h * 0.15 && y > L.groundY - h && y < L.groundY;
};
const colossalUp = (state, now) => state.phase === 'colossal' && now - state.colossalAt > COLOSSAL_READY_MS;

// What a hook fired at (x, y) would catch, or null. Shared with renderers so
// the crosshair can show whether a click will hold.
export function hookTarget(state, L, rects, x, y, now = Date.now()) {
  const lv = state.levi;
  if (!inRects(rects, x, y)) return null;
  if (Math.hypot(x - lv.x, y - lv.y) > L.screen.h * HOOK_RANGE) return null;
  for (const t of state.titans) {
    if (t.mode !== 'dying' && bodyHit(L, t, x, y)) return { tid: t.id, ox: x - t.x, oy: y - L.groundY };
  }
  if (colossalUp(state, now)) {
    const c = L.colossal;
    if (Math.abs(x - c.x) < L.screen.w * 0.3 && y > c.napeY - L.screen.h * 0.25 && y < L.wall.crestY) return { tid: 0, x, y };
  }
  if (hitSolid(L, x, y)) return { tid: 0, x, y };
  return null;
}

function anchorOf(state, L, hook) {
  if (!hook.tid) return hook;
  const t = state.titans.find((q) => q.id === hook.tid);
  if (!t || t.mode === 'dying') return null;
  return { x: t.x + hook.ox, y: L.groundY + hook.oy };
}

function homeSpan(spans, home) {
  return spanAt(spans, home.x + home.w / 2) ?? spans[0] ?? null;
}

function placeLevi(state, L, spans, home) {
  const sp = homeSpan(spans, home);
  const lv = state.levi;
  Object.assign(lv, { vx: 0, vy: 0, mode: 'ground', hook: null, grabbedBy: -1, dir: 1, placed: !!sp });
  lv.x = sp ? sp.a + Math.min(90, (sp.b - sp.a) * 0.2) : L.screen.x + L.screen.w * 0.2;
  lv.y = L.groundY;
}

function spawnTitan(state, L, spans, now) {
  const used = new Set(state.titans.map((t) => t.slot));
  const slot = [0, 1, 2, 3].find((s) => !used.has(s));
  if (slot === undefined || !spans.length) return;
  const lv = state.levi;
  // Enter from the span edge farthest from Levi, on a random span.
  const sp = spans[Math.floor(Math.random() * spans.length)];
  const left = Math.abs(lv.x - sp.a) > Math.abs(lv.x - sp.b);
  const hf = TITAN_HEIGHTS[slot];
  const h = hf * L.screen.h;
  state.titans.push({
    id: state.nextId++,
    slot,
    hf,
    x: left ? sp.a + h * 0.12 : sp.b - h * 0.12,
    dir: left ? 1 : -1,
    mode: 'walk',
    at: now,
    runUntil: 0,
    speed: 46 + h * 0.06,
  });
}

function killLevi(state, now, fx, kind) {
  const lv = state.levi;
  if (lv.mode === 'dead') return;
  lv.mode = 'dead';
  lv.hook = null;
  lv.deadAt = now;
  state.lives -= 1;
  fx.push({ kind, x: lv.x, y: lv.y });
}

function endGame(state, now, kind, fxKind, fx) {
  state.phase = kind;
  state.endAt = now;
  state.endKind = fxKind;
  fx.push({ kind: fxKind, x: state.levi.x, y: state.levi.y });
}

export function updateTitan(state, world, dtRaw, now) {
  const fx = [];
  const L = world.layout;
  const spans = walkSpans(world.rects, L.groundY);
  const dt = now < state.slowUntil ? dtRaw * 0.3 : dtRaw;
  const lv = state.levi;
  const inp = state.input;

  if (state.phase === 'won' || state.phase === 'lost') {
    if (now - state.endAt > END_MS) Object.assign(state, createTitanState());
    return fx;
  }
  if (!lv.placed || (state.phase === 'ready' && lv.mode === 'ground' && !spanAt(spans, lv.x))) placeLevi(state, L, spans, world.home);

  // Levi's death and respawn.
  if (lv.mode === 'grabbed') {
    const t = state.titans.find((q) => q.id === lv.grabbedBy);
    if (t) {
      const h = titanH(L, t);
      lv.x = t.x + t.dir * h * 0.08;
      lv.y = L.groundY - h * 0.8;
    }
    if (now - lv.deadAt > 1100) {
      lv.mode = 'grabbed-done';
      killLevi(state, now, fx, 'eaten');
    }
  }
  if (lv.mode === 'dead' && now - lv.deadAt > RESPAWN_MS) {
    if (state.lives <= 0) {
      endGame(state, now, 'lost', 'over', fx);
      return fx;
    }
    placeLevi(state, L, spans, world.home);
  }

  const alive = lv.mode !== 'dead' && lv.mode !== 'grabbed' && lv.mode !== 'grabbed-done';
  if (!alive) inp.hookReq = null;
  if (alive) {
    if (inp.hookReq) {
      const tg = hookTarget(state, L, world.rects, inp.hookReq.x, inp.hookReq.y, now);
      if (tg && inp.down) {
        const a = anchorOf(state, L, tg);
        const d0 = Math.hypot(a.x - lv.x, a.y - lv.y) || 1;
        lv.hook = { ...tg, len: d0, at: now };
        lv.vx += ((a.x - lv.x) / d0) * KICK;
        lv.vy += ((a.y - lv.y) / d0) * KICK;
        lv.mode = 'air';
        fx.push({ kind: 'hook', x: a.x, y: a.y });
        if (state.phase === 'ready') {
          state.phase = 'hunt';
          state.phaseAt = now;
          state.spawnAt = now + 600;
        }
      } else fx.push({ kind: 'miss', x: inp.hookReq.x, y: inp.hookReq.y, fx: lv.x, fy: lv.y });
      inp.hookReq = null;
    }
    if (!inp.down) lv.hook = null;
    if (inp.gasReq) {
      inp.gasReq = false;
      if (now - lv.gasAt > GAS_COOLDOWN) {
        const dx = inp.x - lv.x;
        const dy = inp.y - lv.y;
        const d = Math.hypot(dx, dy) || 1;
        lv.vx += (dx / d) * GAS;
        lv.vy += (dy / d) * GAS;
        lv.gasAt = now;
        lv.mode = 'air';
        fx.push({ kind: 'gas', x: lv.x, y: lv.y, dx: dx / d, dy: dy / d });
      }
    }

    const a = lv.hook ? anchorOf(state, L, lv.hook) : null;
    if (lv.hook && !a) lv.hook = null;
    if (lv.mode === 'ground') {
      lv.vx = inp.move * WALK;
      lv.vy = 0;
    } else {
      lv.vy += G * dt;
      lv.vx += inp.move * AIR_STEER * dt;
    }
    if (a) {
      const dx = a.x - lv.x;
      const dy = a.y - lv.y;
      const d = Math.hypot(dx, dy) || 1;
      lv.hook.len = Math.max(36, Math.min(lv.hook.len, d) - REEL * dt);
      lv.vx += (dx / d) * PULL * dt;
      lv.vy += (dy / d) * PULL * dt;
      // Bleed sideways speed so a reel zips into the anchor instead of orbiting it.
      const side = (lv.vx * -dy + lv.vy * dx) / d;
      const k = Math.min(1, ORBIT_DAMP * dt);
      lv.vx -= (side * -dy * k) / d;
      lv.vy -= (side * dx * k) / d;
      lv.mode = 'air';
    }
    const sp = Math.hypot(lv.vx, lv.vy);
    if (sp > MAX_SPEED) {
      lv.vx *= MAX_SPEED / sp;
      lv.vy *= MAX_SPEED / sp;
    }
    lv.x += lv.vx * dt;
    lv.y += lv.vy * dt;
    if (a) {
      const dx = lv.x - a.x;
      const dy = lv.y - a.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d > lv.hook.len) {
        lv.x = a.x + (dx / d) * lv.hook.len;
        lv.y = a.y + (dy / d) * lv.hook.len;
        const out = (lv.vx * dx + lv.vy * dy) / d;
        if (out > 0) {
          lv.vx -= (out * dx) / d;
          lv.vy -= (out * dy) / d;
        }
      }
    }
    if (Math.abs(lv.vx) > 40) lv.dir = Math.sign(lv.vx);

    const S = L.screen;
    if (lv.x < S.x + 10 || lv.x > S.x + S.w - 10) {
      lv.x = Math.min(S.x + S.w - 10, Math.max(S.x + 10, lv.x));
      lv.vx *= -0.4;
    }
    if (lv.y < S.y + 10) {
      lv.y = S.y + 10;
      lv.vy = Math.max(0, lv.vy);
    }
    const ground = spanAt(spans, lv.x);
    if (ground && lv.y >= L.groundY && lv.y - lv.vy * dt <= L.groundY + 2 && !a) {
      lv.y = L.groundY;
      lv.vy = 0;
      lv.vx *= 0.3;
      lv.mode = 'ground';
    } else if (lv.mode === 'ground' && !ground) lv.mode = 'air';
    if (lv.y > S.y + S.h + 80) killLevi(state, now, fx, 'fall');

    // Nape strikes.
    const speed = Math.hypot(lv.vx, lv.vy);
    if (speed > SLASH_SPEED) {
      for (const t of state.titans) {
        if (t.mode === 'dying') continue;
        const n = napeOf(L, t);
        if (Math.hypot(lv.x - n.x, lv.y - n.y) < n.r) {
          t.mode = 'dying';
          t.at = now;
          state.kills += 1;
          state.slowUntil = now + SLOW_MS;
          lv.slashAt = now;
          lv.vy = Math.min(lv.vy, -320);
          if (lv.hook?.tid === t.id) lv.hook = null;
          fx.push({ kind: 'kill', x: n.x, y: n.y, id: t.id });
        }
      }
      if (colossalUp(state, now) && Math.hypot(lv.x - L.colossal.x, lv.y - L.colossal.napeY) < 70) {
        lv.slashAt = now;
        state.slowUntil = now + 1400;
        endGame(state, now, 'won', 'slain', fx);
        return fx;
      }
    }
  }

  // Titans.
  for (const t of state.titans) {
    const h = titanH(L, t);
    if (t.mode === 'dying') continue;
    let sp = spanAt(spans, t.x);
    if (!sp) {
      // Its window moved away: drop it onto the nearest ground.
      let best = null;
      for (const s of spans) {
        const x = Math.min(s.b - h * 0.12, Math.max(s.a + h * 0.12, t.x));
        if (!best || Math.abs(x - t.x) < Math.abs(best - t.x)) best = x;
      }
      if (best === null) continue;
      t.x = best;
      sp = spanAt(spans, t.x);
    }
    const dx = lv.x - t.x;
    const lift = L.groundY - lv.y;
    const levi = alive;
    if (t.mode === 'grab') {
      if (now - t.at > GRAB_MS) {
        // A fast-moving Levi slips through the fingers.
        const slips = Math.hypot(lv.vx, lv.vy) > SLASH_SPEED * 1.6;
        const inReach = levi && !slips && Math.abs(dx) < h * 0.42 && lift < h * 1.05 && Math.sign(dx || 1) === t.dir;
        if (inReach) {
          lv.mode = 'grabbed';
          lv.grabbedBy = t.id;
          lv.hook = null;
          lv.deadAt = now;
          fx.push({ kind: 'caught', x: lv.x, y: lv.y });
        }
        t.mode = 'walk';
        t.at = now;
      }
      continue;
    }
    if (lv.mode === 'grabbed' && lv.grabbedBy === t.id) continue;
    if (levi && Math.abs(dx) > 8) t.dir = Math.sign(dx);
    const grace = lv.deadAt && now - lv.deadAt < RESPAWN_MS + SPAWN_GRACE_MS;
    if (levi && !grace && Math.abs(dx) < h * 0.38 && lift < h * 1.0 && now - t.at > 900) {
      t.mode = 'grab';
      t.at = now;
      fx.push({ kind: 'reach', id: t.id });
      continue;
    }
    if (levi && Math.abs(dx) < h * 2.2 && now > t.runUntil + 5000 && Math.random() < dtRaw * 0.35) t.runUntil = now + 2000;
    const run = now < t.runUntil;
    const v = (run ? 150 + h * 0.1 : t.speed) * dt;
    const want = levi ? t.x + t.dir * v : t.x;
    const lo = sp.a + h * 0.12;
    const hi = sp.b - h * 0.12;
    t.x = Math.min(hi, Math.max(lo, want));
    const blocked = levi && ((t.dir > 0 && want > hi && lv.x > hi) || (t.dir < 0 && want < lo && lv.x < lo));
    t.mode = blocked ? 'edge' : !levi || Math.abs(dx) < 4 ? 'idle' : run ? 'run' : 'walk';
  }
  state.titans = state.titans.filter((t) => t.mode !== 'dying' || now - t.at < DYING_MS);

  if (state.phase === 'hunt') {
    const living = state.titans.filter((t) => t.mode !== 'dying').length;
    if (living < MAX_TITANS && state.kills + living < KILLS_TO_COLOSSAL && now > state.spawnAt) {
      spawnTitan(state, L, spans, now);
      state.spawnAt = now + SPAWN_GAP_MS;
    }
    if (state.kills >= KILLS_TO_COLOSSAL && !state.titans.length) {
      state.phase = 'colossal';
      state.colossalAt = now;
      fx.push({ kind: 'colossal' });
    }
  } else if (state.phase === 'colossal' && now - state.colossalAt > COLOSSAL_MS) {
    if (alive) killLevi(state, now, fx, 'blast');
    state.lives = 0;
    endGame(state, now, 'lost', 'shock', fx);
  }
  return fx;
}
