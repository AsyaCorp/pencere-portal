import { BALL_R, PULL_R, STAR_R, circleFits } from '../game.js';
import { BG, RED, blink, brackets, ink, pad, redA, text } from './style.js';

const PREDICT_STEP = 6;
const PREDICT_MAX = 3000;

// Dashed trail, oldest point first. The dash pattern starts at the oldest
// point, which every window shares, so the dashes line up across windows.
export function drawTrail(ctx, trail, hair) {
  if (trail.length < 2) return;
  ctx.lineWidth = hair * 2;
  ctx.setLineDash([5, 5]);
  const half = Math.floor(trail.length / 2);
  for (const [from, to, alpha] of [
    [0, half, 0.22],
    [half, trail.length - 1, 0.6],
  ]) {
    ctx.beginPath();
    ctx.moveTo(trail[from][0], trail[from][1]);
    for (let i = from + 1; i <= to; i++) ctx.lineTo(trail[i][0], trail[i][1]);
    ctx.strokeStyle = ink(alpha);
    ctx.stroke();
  }
  ctx.setLineDash([]);
}

// Straight line along the heading until the probe would leave the windows,
// i.e. up to the next bounce.
export function predictEnd(rects, b) {
  const s = Math.hypot(b.vx, b.vy);
  if (s < 1e-3) return null;
  const ux = b.vx / s;
  const uy = b.vy / s;
  let d = 0;
  while (d < PREDICT_MAX && circleFits(rects, b.x + ux * (d + PREDICT_STEP), b.y + uy * (d + PREDICT_STEP), BALL_R)) d += PREDICT_STEP;
  return { x: b.x + ux * d, y: b.y + uy * d };
}

export function drawPrediction(ctx, b, end, hair) {
  if (!end) return;
  ctx.lineWidth = hair * 2;
  ctx.lineCap = 'round';
  ctx.setLineDash([0.5, 7]);
  ctx.beginPath();
  ctx.moveTo(b.x, b.y);
  ctx.lineTo(end.x, end.y);
  ctx.strokeStyle = ink(0.5);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.lineCap = 'butt';
  ctx.lineWidth = hair;
  ctx.beginPath();
  ctx.arc(end.x, end.y, 3.5, 0, Math.PI * 2);
  ctx.strokeStyle = ink(0.55);
  ctx.stroke();
}

// Line-art rocket pointing along +x, about 28px long, centred on the probe.
function drawRocket(ctx, active, t, hair) {
  const lw = Math.max(hair * 1.5, 1);
  ctx.lineWidth = lw;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = ink(0.97);
  ctx.fillStyle = BG;

  ctx.beginPath();
  ctx.moveTo(-4, -4);
  ctx.lineTo(-11, -9);
  ctx.lineTo(-11, -4);
  ctx.moveTo(-4, 4);
  ctx.lineTo(-11, 9);
  ctx.lineTo(-11, 4);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(15, 0);
  ctx.quadraticCurveTo(10, -4, 4, -4);
  ctx.lineTo(-10, -4);
  ctx.lineTo(-10, 4);
  ctx.lineTo(4, 4);
  ctx.quadraticCurveTo(10, 4, 15, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(-10, -2.5);
  ctx.lineTo(-13, -3.5);
  ctx.lineTo(-13, 3.5);
  ctx.lineTo(-10, 2.5);
  ctx.moveTo(5, -4);
  ctx.lineTo(5, 4);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(0, 0, 1.6, 0, Math.PI * 2);
  ctx.lineWidth = hair * 2;
  ctx.stroke();

  if (!active) return;
  const flick = 0.75 + 0.25 * Math.sin(t * 47) * Math.sin(t * 31);
  ctx.lineWidth = hair * 2;
  ctx.beginPath();
  ctx.moveTo(-14, 0);
  ctx.lineTo(-14 - 11 * flick, 0);
  ctx.moveTo(-14, -2);
  ctx.lineTo(-14 - 6 * flick, -2.5);
  ctx.moveTo(-14, 2);
  ctx.lineTo(-14 - 6 * flick, 2.5);
  ctx.strokeStyle = ink(0.6);
  ctx.stroke();
}

export function drawProbe(ctx, b, t, hair) {
  const a = Math.atan2(b.vy, b.vx);
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(b.active ? a : -Math.PI / 2);
  drawRocket(ctx, b.active, t, hair);
  ctx.restore();

  const speed = Math.hypot(b.vx, b.vy);
  const hdg = ((Math.atan2(b.vx, -b.vy) / Math.PI) * 180 + 360) % 360;
  const lx = b.x + 30;
  const ly = b.y - 34;
  ctx.lineWidth = hair;
  ctx.beginPath();
  ctx.moveTo(b.x + 7, b.y - 7);
  ctx.lineTo(lx, ly + 4);
  ctx.lineTo(lx + 74, ly + 4);
  ctx.strokeStyle = ink(0.5);
  ctx.stroke();
  text(ctx, 'PRB-1', lx + 2, ly - 22, { size: 10, weight: 500, color: ink(0.95) });
  if (b.active) {
    text(ctx, `SPD ${pad(speed, 4)}`, lx + 2, ly - 11, { size: 9, color: ink(0.7) });
    text(ctx, `HDG ${pad(hdg, 3)}°`, lx + 2, ly, { size: 9, color: ink(0.7) });
  } else if (blink(t, 1.5)) {
    text(ctx, 'STBY', lx + 2, ly - 11, { size: 9, color: ink(0.7) });
  }
}

// Red docking reticle. Its corner brackets close in as the probe approaches.
export function drawDock(ctx, dock, b, t, appearAge, hair, flip = false) {
  if (appearAge < 0.4 && !blink(appearAge, 10)) return;
  const dist = b && b.active ? Math.hypot(b.x - dock.x, b.y - dock.y) : null;
  const locked = !!(b && b.locked);
  const closeK = locked ? Math.min(1, Math.max(0, 1 - dist / PULL_R)) : 0;
  const r = STAR_R;
  const corner = 44 - 20 * closeK;

  ctx.strokeStyle = RED;
  ctx.lineWidth = Math.max(hair, 1);
  ctx.beginPath();
  ctx.arc(dock.x, dock.y, r, 0, Math.PI * 2);
  for (const [dx, dy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]) {
    ctx.moveTo(dock.x + dx * (r - 6), dock.y + dy * (r - 6));
    ctx.lineTo(dock.x + dx * (r + 14), dock.y + dy * (r + 14));
  }
  ctx.stroke();
  ctx.fillStyle = RED;
  ctx.fillRect(dock.x - 1, dock.y - 1, 2, 2);
  brackets(ctx, dock.x, dock.y, corner, 9);

  const tx = flip ? dock.x - corner - 10 : dock.x + corner + 10;
  const align = flip ? 'right' : 'left';
  text(ctx, 'DOCK', tx, dock.y - corner + 8, { size: 10, weight: 500, color: RED, align });
  text(ctx, `DST ${dist === null ? '----' : pad(dist, 4)}`, tx, dock.y - corner + 21, { size: 9, color: redA(0.8), align });
  if (locked && blink(t, 3)) text(ctx, 'LOCK', tx, dock.y + corner, { size: 10, weight: 500, color: RED, align });

  if (locked) {
    ctx.setLineDash([3, 4]);
    ctx.lineWidth = hair * 2;
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(dock.x, dock.y);
    ctx.strokeStyle = redA(0.7);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}
