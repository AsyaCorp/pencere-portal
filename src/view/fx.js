import { DOCK_HOLD } from '../game.js';
import { blink, brackets, ink, measure, pad, text } from './style.js';

const SCAN_DUR = 0.8;
export const DOCKED_DUR = DOCK_HOLD;

// Effects are timed on the shared clock (fx.t), so every window plays the
// same frame at the same moment.
export function createFx() {
  const active = [];

  // labels: maps window id -> monitor name at the moment of the event.
  function add(fx, labels) {
    const dur = { bounce: 0.5, ripple: 1.4, win: DOCKED_DUR + 0.5 }[fx.kind];
    if (!dur) return;
    if (fx.kind === 'ripple') fx.label = `HANDOFF ${labels(fx.from)} > ${labels(fx.to)}`;
    active.push({ fx, dur });
  }

  function prune(now) {
    for (let i = active.length - 1; i >= 0; i--) {
      if ((now - active[i].fx.t) / 1000 >= active[i].dur) active.splice(i, 1);
    }
  }

  function drawWorld(ctx, now, view, screen, hair) {
    prune(now);
    for (const { fx } of active) {
      const age = Math.max(0, (now - fx.t) / 1000);
      if (fx.kind === 'bounce') {
        const f = 1 - age / 0.5;
        const s = 4 + age * 10;
        ctx.lineWidth = hair * 2;
        ctx.strokeStyle = ink(0.9 * f);
        ctx.beginPath();
        ctx.moveTo(fx.x - s, fx.y - s);
        ctx.lineTo(fx.x + s, fx.y + s);
        ctx.moveTo(fx.x + s, fx.y - s);
        ctx.lineTo(fx.x - s, fx.y + s);
        ctx.stroke();
      } else if (fx.kind === 'ripple') {
        const on = age < 0.6 ? blink(age, 7, 0.6) : true;
        const f = age < 0.9 ? 1 : 1 - (age - 0.9) / 0.5;
        if (!on) continue;
        ctx.lineWidth = Math.max(hair, 1);
        ctx.strokeStyle = ink(0.95 * f);
        brackets(ctx, fx.x, fx.y, 14, 6);
        text(ctx, fx.label, fx.x + 22, fx.y - 18, { size: 10, weight: 500, color: ink(0.95 * f) });
      } else if (fx.kind === 'win' && age < SCAN_DUR) {
        // Scanline sweeping down the whole screen, with a few fading rows behind it.
        const y = screen.y + (age / SCAN_DUR) * (screen.h + 40);
        ctx.lineWidth = hair;
        for (let i = 0; i < 6; i++) {
          ctx.beginPath();
          ctx.moveTo(view.x, y - i * 3);
          ctx.lineTo(view.x + view.w, y - i * 3);
          ctx.strokeStyle = ink(i === 0 ? 0.95 : 0.3 / i);
          ctx.stroke();
        }
      }
    }
  }

  // Screen-space "DOCKED" card, centred in every monitor.
  function drawScreen(ctx, now, w, h) {
    for (const { fx } of active) {
      if (fx.kind !== 'win') continue;
      const age = (now - fx.t) / 1000;
      if (age < 0.2 || age > DOCKED_DUR + 0.25) continue;
      const f = Math.min(1, (age - 0.2) / 0.1) * Math.min(1, (DOCKED_DUR + 0.25 - age) / 0.25);
      const cx = w / 2;
      const cy = h / 2;
      const title = { size: 44, weight: 500, spacing: 0.3 };
      const tw = measure(ctx, 'DOCKED', title);
      ctx.fillStyle = `rgba(7, 8, 10, ${0.75 * f})`;
      ctx.fillRect(cx - tw / 2 - 40, cy - 52, tw + 80, 92);
      text(ctx, 'DOCKED', cx + 6, cy, { ...title, align: 'center', color: ink(0.97 * f) });
      text(ctx, `MISSION ${pad(fx.level, 2)}`, cx + 2, cy + 24, { size: 11, align: 'center', color: ink(0.6 * f), spacing: 0.3 });
      ctx.lineWidth = 1;
      ctx.strokeStyle = ink(0.8 * f);
      ctx.beginPath();
      ctx.moveTo(cx - tw / 2 - 40, cy - 52);
      ctx.lineTo(cx - tw / 2 - 28, cy - 52);
      ctx.moveTo(cx - tw / 2 - 40, cy - 52);
      ctx.lineTo(cx - tw / 2 - 40, cy - 40);
      ctx.moveTo(cx + tw / 2 + 40, cy + 40);
      ctx.lineTo(cx + tw / 2 + 28, cy + 40);
      ctx.moveTo(cx + tw / 2 + 40, cy + 40);
      ctx.lineTo(cx + tw / 2 + 40, cy + 28);
      ctx.stroke();
    }
  }

  // Time of the latest dock, used to keep the next port hidden briefly.
  function lastDock() {
    let t = -Infinity;
    for (const { fx } of active) if (fx.kind === 'win') t = Math.max(t, fx.t);
    return t;
  }

  return { add, drawWorld, drawScreen, lastDock };
}
