import './style.css';
import { createSync, readRect } from './sync.js';
import { createState, launch, reset, update } from './game.js';
import { createScene } from './scene.js';
import { COLLAPSE } from './world/effects.js';

// A fresh window listens for a moment before it may lead, so it picks up the
// running game instead of broadcasting a brand new one over it.
const WARMUP_MS = 400;
const PERSIST_KEY = 'pencere-portal:state';
const PERSIST_MAX_AGE = 3000;
const BOUNCE_FX_GAP = 90;
const MAX_EXTRAPOLATE_MS = 34;

const levelEl = document.getElementById('level');
const flashEl = document.getElementById('flash');
const scene = createScene(document.getElementById('c'));
const sync = createSync(onMessage);
const bootAt = Date.now();

let state = loadPersisted();
const world = { rects: [], home: null, screen: null, owner: null };
let lastBounceFx = 0;
let lastPersist = 0;

function screenBounds() {
  const s = window.screen;
  return { x: s.availLeft ?? 0, y: s.availTop ?? 0, w: s.availWidth, h: s.availHeight };
}

function isLeader() {
  return Date.now() - bootAt > WARMUP_MS && sync.leaderId() === sync.id;
}

function loadPersisted() {
  try {
    const saved = JSON.parse(localStorage.getItem(PERSIST_KEY));
    if (saved && Date.now() - saved.at < PERSIST_MAX_AGE) return saved.state;
  } catch {
    // Corrupt or missing: start fresh.
  }
  return null;
}

function onMessage(msg) {
  if (msg.type === 'state') {
    if (msg.from === sync.leaderId()) state = msg.state;
  } else if (msg.type === 'cmd') {
    if (isLeader()) runCommand(msg.cmd);
  } else if (msg.type === 'fx') {
    showFx(msg.fx);
  }
}

function showFx(fx) {
  scene.addFx(fx);
  if (fx.kind === 'win') {
    const anim = flashEl.animate([{ opacity: 0.85 }, { opacity: 0 }], {
      duration: 650,
      delay: COLLAPSE * 1000,
      easing: 'ease-out',
    });
    anim.currentTime = Math.max(0, Date.now() - fx.t);
  }
}

function emitFx(fx) {
  fx.t = Date.now();
  sync.send({ type: 'fx', fx });
  showFx(fx);
}

function runCommand(cmd) {
  const home = readRect();
  if (!state) state = createState(screenBounds(), home);
  if (cmd === 'launch') launch(state, home);
  else if (cmd === 'reset') reset(state, screenBounds(), home);
  world.owner = null;
}

function command(cmd) {
  if (isLeader()) runCommand(cmd);
  else sync.send({ type: 'cmd', cmd });
}

function openWindow() {
  const x = window.screenX + 80 + Math.round(Math.random() * 120);
  const y = window.screenY + 60 + Math.round(Math.random() * 120);
  window.open(location.href, '_blank', `popup,width=500,height=400,left=${x},top=${y}`);
}

window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (e.code === 'Space') {
    e.preventDefault();
    command('launch');
  } else if (e.code === 'KeyR') {
    command('reset');
  } else if (e.code === 'KeyN') {
    openWindow();
  }
});

// Followers draw the leader's last state, nudged forward by the time since it
// was sent so motion stays smooth between messages.
function viewOf(now, leader) {
  if (!state || leader || !state.ball.active) return state;
  const e = Math.min(Math.max(now - state.t, 0), MAX_EXTRAPOLATE_MS) / 1000;
  const b = state.ball;
  const x = b.x + b.vx * e;
  const y = b.y + b.vy * e;
  return { ...state, ball: { ...b, x, y }, trail: [...state.trail.slice(0, -1), [x, y]] };
}

let prevFrame = performance.now();
let wasLeader = false;

function frame(t) {
  const dt = Math.min((t - prevFrame) / 1000, 1 / 20);
  prevFrame = t;
  const now = Date.now();
  const rect = readRect();
  sync.beat(rect);
  sync.prune();

  const leader = isLeader();
  if (leader) {
    if (!state) state = createState(screenBounds(), rect);
    if (!wasLeader) world.owner = null;
    world.rects = sync.rects();
    world.home = rect;
    world.screen = screenBounds();
    for (const fx of update(state, world, dt)) {
      if (fx.kind === 'bounce') {
        if (now - lastBounceFx < BOUNCE_FX_GAP) continue;
        lastBounceFx = now;
      }
      emitFx(fx);
    }
    state.t = now;
    sync.send({ type: 'state', state });
    if (now - lastPersist > 500) {
      lastPersist = now;
      localStorage.setItem(PERSIST_KEY, JSON.stringify({ at: now, state }));
    }
  }
  wasLeader = leader;

  scene.render(rect, viewOf(now, leader), now, sync.rects());
  levelEl.textContent = state ? String(state.level) : '';
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
