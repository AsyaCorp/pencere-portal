const CHANNEL = 'pencere-portal';
export const STALE_MS = 2000;

// Content area of this window in screen pixels. screenX/Y point at the outer
// frame, so the browser toolbar (and side borders, if any) must be skipped.
export function readRect() {
  const border = Math.max(0, (window.outerWidth - window.innerWidth) / 2);
  const top = Math.max(0, window.outerHeight - window.innerHeight - border);
  return {
    x: window.screenX + border,
    y: window.screenY + top,
    w: window.innerWidth,
    h: window.innerHeight,
  };
}

function createTransport(receive) {
  if ('BroadcastChannel' in window) {
    const bc = new BroadcastChannel(CHANNEL);
    bc.onmessage = (e) => receive(e.data);
    return (msg) => bc.postMessage(msg);
  }
  window.addEventListener('storage', (e) => {
    if (e.key === CHANNEL && e.newValue) receive(JSON.parse(e.newValue));
  });
  return (msg) => {
    // 'storage' only fires when the value changes, hence the nonce.
    localStorage.setItem(CHANNEL, JSON.stringify({ ...msg, nonce: Math.random() }));
  };
}

export function createSync(onMessage) {
  const id = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  const created = Date.now();
  const windows = new Map();

  const post = createTransport((msg) => {
    if (!msg || msg.from === id) return;
    if (msg.type === 'win') {
      windows.set(msg.from, {
        id: msg.from,
        created: msg.created,
        rect: msg.rect,
        visible: msg.visible,
        seen: Date.now(),
      });
    } else if (msg.type === 'bye') {
      windows.delete(msg.from);
    } else {
      onMessage(msg);
    }
  });

  function send(msg) {
    msg.from = id;
    post(msg);
  }

  function beat(rect) {
    const visible = document.visibilityState === 'visible';
    windows.set(id, { id, created, rect, visible, seen: Date.now() });
    send({ type: 'win', created, rect, visible });
  }

  function prune() {
    const now = Date.now();
    for (const w of windows.values()) {
      if (w.id !== id && now - w.seen > STALE_MS) windows.delete(w.id);
    }
  }

  // Hidden or minimized windows are not on screen, so they neither carry the
  // ball nor lead the physics.
  function visibleWindows() {
    return [...windows.values()].filter((w) => w.visible);
  }

  function leaderId() {
    let list = visibleWindows();
    if (!list.length) list = [...windows.values()];
    list.sort((a, b) => a.created - b.created || (a.id < b.id ? -1 : 1));
    return list[0]?.id ?? id;
  }

  function rects() {
    return visibleWindows().map((w) => ({ id: w.id, ...w.rect }));
  }

  const bye = () => send({ type: 'bye' });
  window.addEventListener('pagehide', bye);
  window.addEventListener('beforeunload', bye);
  document.addEventListener('visibilitychange', () => beat(readRect()));

  // rAF stops in hidden windows; keep their heartbeat alive so they are not
  // dropped and can rejoin instantly when shown again.
  setInterval(() => {
    if (document.visibilityState !== 'visible') beat(readRect());
  }, 250);

  return { id, send, beat, prune, leaderId, rects, count: () => windows.size };
}
