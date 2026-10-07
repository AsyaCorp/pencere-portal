import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import './style.css';
import { createSync, readRect } from './sync.js';
import { createState, launch, reset, update } from './game.js';
import { createScene } from './scene.js';
import { createTitanState, titanCommand, updateTitan } from './titan/game.js';
import { createTitanView } from './titan/view3d.js';

// A fresh window listens for a moment before it may lead, so it picks up the
// running game instead of broadcasting a brand new one over it.
const WARMUP_MS = 400;
const PERSIST_KEY = 'pencere-portal:state';
const PERSIST_MAX_AGE = 3000;
const BOUNCE_FX_GAP = 90;
const MAX_EXTRAPOLATE_MS = 34;

const MODE_KEY = 'pencere-portal:mode';

const canvas = document.getElementById('c');
const scene = createScene(canvas);
const titanRoot = document.getElementById('titan');
const titanScene = createTitanView(document.getElementById('g'), document.getElementById('tlabel'), document.getElementById('tflash'));
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

let titan = createTitanState();
const titanWorld = { layout: titanScene.layout, rects: [], home: null };

// The newest mode change wins, whether it came from a key press, the URL or
// a leader's state message.
const urlMode = new URLSearchParams(location.search).get('mod');
let mode = loadMode();
if (urlMode === 'titan' || urlMode === 'hud') {
  setMode({ name: urlMode, at: Date.now() });
  sync.send({ type: 'mode', mode });
}

function loadMode() {
  try {
    const saved = JSON.parse(localStorage.getItem(MODE_KEY));
    if (saved && (saved.name === 'hud' || saved.name === 'titan')) return saved;
  } catch {
    // Corrupt or missing: default to the HUD.
  }
  return { name: 'hud', at: 0 };
}

function setMode(next) {
  if (!next || next.at < mode?.at) return;
  mode = { name: next.name, at: next.at };
  localStorage.setItem(MODE_KEY, JSON.stringify(mode));
}

function toggleMode() {
  setMode({ name: mode.name === 'titan' ? 'hud' : 'titan', at: Date.now() });
  sync.send({ type: 'mode', mode });
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
    setMode(msg.mode);
  } else if (msg.type === 'tstate') {
    if (msg.from === sync.leaderId()) titan = msg.state;
    setMode(msg.mode);
  } else if (msg.type === 'mode') {
    setMode(msg.mode);
  } else if (msg.type === 'cmd') {
    if (isLeader()) runCommand(msg.cmd);
  } else if (msg.type === 'fx') {
    showFx(msg.fx);
  }
}

function showFx(fx) {
  if (mode.name === 'titan') titanScene.addFx(fx);
  else scene.addFx(fx);
}

function emitFx(fx) {
  fx.t = Date.now();
  sync.send({ type: 'fx', fx });
  showFx(fx);
}

function runCommand(cmd) {
  if (mode.name === 'titan') {
    titanCommand(titan, cmd);
    return;
  }
  const home = readRect();
  if (!state) state = createState(screenBounds(), home);
  if (cmd === 'launch') launch(state, home);
  else if (cmd === 'reset') reset(state, screenBounds(), home);
  world.owner = null;
  world.sinceHandoff = 0;
}

function command(cmd) {
  if (isLeader()) runCommand(cmd);
  else sync.send({ type: 'cmd', cmd });
}

function openWindow() {
  const x = window.screenX + 80 + Math.round(Math.random() * 120);
  const y = window.screenY + 60 + Math.round(Math.random() * 120);
  window.open(`${location.pathname}?mod=${mode.name}`, '_blank', `popup,width=500,height=400,left=${x},top=${y}`);
}

// Titan mode: the mouse aims and fires hooks in screen coordinates, so a
// click in any window reaches the same world.
let mouse = null;
const MOVE_KEYS = { KeyA: -1, ArrowLeft: -1, KeyD: 1, ArrowRight: 1 };
const held = new Set();
function screenPoint(e) {
  const r = readRect();
  return { x: r.x + e.clientX, y: r.y + e.clientY };
}
titanRoot.addEventListener('pointermove', (e) => {
  mouse = screenPoint(e);
  command({ kind: 'aim', ...mouse });
});
titanRoot.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  mouse = screenPoint(e);
  titanRoot.setPointerCapture(e.pointerId);
  command({ kind: 'hook', down: true, ...mouse });
});
titanRoot.addEventListener('pointerup', (e) => {
  if (e.button !== 0) return;
  command({ kind: 'hook', down: false });
});
titanRoot.addEventListener('pointerleave', () => {
  mouse = null;
});
window.addEventListener('blur', () => {
  if (mode.name !== 'titan') return;
  held.clear();
  command({ kind: 'hook', down: false });
  command({ kind: 'move', dir: 0 });
});
function sendMove() {
  let dir = 0;
  for (const k of held) dir += MOVE_KEYS[k];
  command({ kind: 'move', dir: Math.sign(dir) });
}
window.addEventListener('keyup', (e) => {
  if (held.delete(e.code)) sendMove();
});

window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (mode.name === 'titan' && MOVE_KEYS[e.code]) {
    held.add(e.code);
    sendMove();
    return;
  }
  if (mode.name === 'titan' && e.code === 'Space') {
    e.preventDefault();
    command({ kind: 'gas', ...(mouse ?? {}) });
    return;
  }
  if (e.code === 'Space') {
    e.preventDefault();
    command('launch');
  } else if (e.code === 'KeyR') {
    command('reset');
  } else if (e.code === 'KeyN') {
    openWindow();
  } else if (e.code === 'KeyT') {
    toggleMode();
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
  titanRoot.hidden = mode.name !== 'titan';
  canvas.hidden = mode.name === 'titan';
  if (mode.name === 'titan') {
    if (leader) {
      titanWorld.rects = sync.rects();
      titanWorld.home = rect;
      for (const fx of updateTitan(titan, titanWorld, dt, now)) emitFx(fx);
      sync.send({ type: 'tstate', state: titan, mode });
    }
    wasLeader = leader;
    titanScene.render(rect, titan, now, sync.rects(), mouse);
    requestAnimationFrame(frame);
    return;
  }
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
    sync.send({ type: 'state', state, mode });
    if (now - lastPersist > 500) {
      lastPersist = now;
      localStorage.setItem(PERSIST_KEY, JSON.stringify({ at: now, state }));
    }
  }
  wasLeader = leader;

  scene.render(rect, viewOf(now, leader), now, sync.rects(), sync.id);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
