import { DOCK_HOLD } from './game.js';
import { drawEarth, earthLayout } from './view/earth.js';
import { createFx } from './view/fx.js';
import { drawHud } from './view/hud.js';
import { drawMap } from './view/map.js';
import { drawDock, drawPrediction, drawProbe, drawTrail, predictEnd } from './view/probe.js';
import { BG, pad, sharedTime } from './view/style.js';

function screenBounds() {
  const s = window.screen;
  return { x: s.availLeft ?? 0, y: s.availTop ?? 0, w: s.availWidth, h: s.availHeight };
}

export function createScene(canvas) {
  const ctx = canvas.getContext('2d');
  const screen = screenBounds();
  const earth = earthLayout(screen);
  const fx = createFx();
  let names = new Map();
  let size = { w: 0, h: 0, dpr: 0 };

  const nameOf = (id) => names.get(id) ?? 'TRK-??';

  function resize(w, h, dpr) {
    size = { w, h, dpr };
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
  }

  // World layers are drawn in screen coordinates (translated by the window's
  // position), the monitor chrome in window coordinates on top.
  function render(rect, view, now, rects, selfId) {
    const dpr = window.devicePixelRatio || 1;
    if (rect.w !== size.w || rect.h !== size.h || dpr !== size.dpr) resize(rect.w, rect.h, dpr);
    const sorted = [...rects].sort((a, b) => a.created - b.created || (a.id < b.id ? -1 : 1));
    names = new Map(sorted.map((r, i) => [r.id, `TRK-${pad(i + 1, 2)}`]));
    const t = sharedTime(now);
    const hair = 1 / dpr;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.setTransform(dpr, 0, 0, dpr, -rect.x * dpr, -rect.y * dpr);
    drawMap(ctx, rect, screen, hair);
    drawEarth(ctx, earth, t, hair);
    let contact = 'NO CONTACT';
    if (view) {
      const b = view.ball;
      const dockAge = (now - fx.lastDock()) / 1000 - DOCK_HOLD;
      if (dockAge >= 0) {
        const s = view.star;
        const home = rects.find((r) => s.x >= r.x && s.x <= r.x + r.w && s.y >= r.y && s.y <= r.y + r.h) ?? rect;
        drawDock(ctx, s, b, t, dockAge, hair, home.x + home.w - s.x < 130);
      }
      if (b.active) {
        drawTrail(ctx, view.trail, hair);
        if (!b.locked && !(view.hold > 0)) drawPrediction(ctx, b, predictEnd(rects.length ? rects : [rect], b), hair);
      }
      drawProbe(ctx, b, t, hair);
      if (b.x >= rect.x && b.x <= rect.x + rect.w && b.y >= rect.y && b.y <= rect.y + rect.h) contact = 'PRB-1 IN VIEW';
    }
    fx.drawWorld(ctx, now, rect, screen, hair);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawHud(ctx, { w: rect.w, h: rect.h, rect, screen, name: nameOf(selfId), t, level: view ? view.level : 1, contact, hair });
    fx.drawScreen(ctx, now, rect.w, rect.h);
  }

  return { render, addFx: (f) => fx.add(f, nameOf) };
}
