import { sectorOf } from './map.js';
import { blink, ink, measure, pad, text } from './style.js';

// Per-window monitor chrome, drawn in window (CSS px) coordinates.
export function drawHud(ctx, { w, h, rect, screen, name, t, level, contact, hair }) {
  const o = hair / 2;
  ctx.lineWidth = hair;
  ctx.strokeStyle = ink(0.2);
  ctx.strokeRect(6 + o, 6 + o, w - 12, h - 12);

  ctx.lineWidth = 1;
  ctx.strokeStyle = ink(0.85);
  ctx.beginPath();
  for (const [x, y, dx, dy] of [
    [6, 6, 1, 1],
    [w - 6, 6, -1, 1],
    [w - 6, h - 6, -1, -1],
    [6, h - 6, 1, -1],
  ]) {
    ctx.moveTo(x + dx * 18, y + 0.5 * dy);
    ctx.lineTo(x + 0.5 * dx, y + 0.5 * dy);
    ctx.lineTo(x + 0.5 * dx, y + dy * 18);
  }
  ctx.stroke();

  const id = { size: 11, weight: 500 };
  text(ctx, name, 18, 26, { ...id, color: ink(0.97) });
  const lx = 18 + measure(ctx, name, id) + 14;
  if (blink(t, 1, 0.6)) {
    ctx.fillStyle = ink(0.95);
    ctx.beginPath();
    ctx.arc(lx + 2.5, 22.5, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  text(ctx, 'LIVE', lx + 10, 26, { size: 10, color: ink(0.75) });

  text(ctx, `X ${pad(rect.x, 4)}  Y ${pad(rect.y, 4)}`, w - 18, 26, { ...id, align: 'right', color: ink(0.97) });
  text(ctx, `W ${pad(rect.w, 4)}  H ${pad(rect.h, 4)}`, w - 18, 40, { size: 9, align: 'right', color: ink(0.45) });

  ctx.lineWidth = hair;
  ctx.strokeStyle = ink(0.18);
  ctx.beginPath();
  ctx.moveTo(18, h - 32 + o);
  ctx.lineTo(w - 18, h - 32 + o);
  ctx.stroke();
  const sector = sectorOf(screen, rect.x + rect.w / 2, rect.y + rect.h / 2);
  const cell = (v) => pad(Math.floor(v / 100), 2);
  const grid = `${cell(rect.x)}-${cell(rect.x + rect.w)} / ${cell(rect.y)}-${cell(rect.y + rect.h)}`;
  text(ctx, `SECTOR ${sector}   GRID ${grid}`, 18, h - 16, { size: 10, color: ink(0.6) });
  text(ctx, `MSN ${pad(level, 2)}   ${contact}`, w - 18, h - 16, { size: 10, align: 'right', color: ink(0.6) });
}
