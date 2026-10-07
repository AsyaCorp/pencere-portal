import { ink, pad, text } from './style.js';

const MINOR = 50;
const MAJOR = 100;

// Coordinate grid and 3x3 sectors over the whole screen. Everything is anchored
// to absolute screen coordinates, so it continues seamlessly across windows.
// hair: one device pixel in CSS px; o: offset that centres it on a pixel.
export function drawMap(ctx, view, screen, hair) {
  const o = hair / 2;
  const x0 = Math.floor(view.x / MINOR) * MINOR;
  const y0 = Math.floor(view.y / MINOR) * MINOR;
  const x1 = view.x + view.w;
  const y1 = view.y + view.h;

  ctx.lineWidth = hair;
  for (const major of [false, true]) {
    ctx.beginPath();
    for (let x = x0; x <= x1; x += MINOR) {
      if ((x % MAJOR === 0) !== major) continue;
      ctx.moveTo(x + o, view.y);
      ctx.lineTo(x + o, y1);
    }
    for (let y = y0; y <= y1; y += MINOR) {
      if ((y % MAJOR === 0) !== major) continue;
      ctx.moveTo(view.x, y + o);
      ctx.lineTo(x1, y + o);
    }
    ctx.strokeStyle = ink(major ? 0.085 : 0.04);
    ctx.stroke();
  }

  const mx0 = Math.floor(view.x / MAJOR) * MAJOR;
  const my0 = Math.floor(view.y / MAJOR) * MAJOR;
  ctx.beginPath();
  for (let x = mx0; x <= x1; x += MAJOR) {
    for (let y = my0; y <= y1; y += MAJOR) {
      ctx.moveTo(x - 3, y + o);
      ctx.lineTo(x + 4, y + o);
      ctx.moveTo(x + o, y - 3);
      ctx.lineTo(x + o, y + 4);
    }
  }
  ctx.strokeStyle = ink(0.4);
  ctx.stroke();
  for (let x = mx0; x <= x1; x += MAJOR) {
    for (let y = my0; y <= y1; y += MAJOR) {
      text(ctx, `${pad(x / MAJOR, 2)}.${pad(y / MAJOR, 2)}`, x + 4, y + 11, { size: 8, color: ink(0.26), spacing: 0.08 });
    }
  }

  // Sector boundaries: dashes start at the screen edge so every window agrees.
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  for (let i = 1; i < 3; i++) {
    const x = Math.round(screen.x + (screen.w * i) / 3);
    const y = Math.round(screen.y + (screen.h * i) / 3);
    ctx.moveTo(x + o, screen.y);
    ctx.lineTo(x + o, screen.y + screen.h);
    ctx.moveTo(screen.x, y + o);
    ctx.lineTo(screen.x + screen.w, y + o);
  }
  ctx.strokeStyle = ink(0.2);
  ctx.stroke();
  ctx.setLineDash([]);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const x = Math.round(screen.x + (screen.w * c) / 3);
      const y = Math.round(screen.y + (screen.h * r) / 3);
      text(ctx, `SECTOR ${r * 3 + c + 1}`, x + 10, y + 46, { size: 10, color: ink(0.5), weight: 500 });
    }
  }
}

export function sectorOf(screen, x, y) {
  const c = Math.min(2, Math.max(0, Math.floor(((x - screen.x) / screen.w) * 3)));
  const r = Math.min(2, Math.max(0, Math.floor(((y - screen.y) / screen.h) * 3)));
  return r * 3 + c + 1;
}
