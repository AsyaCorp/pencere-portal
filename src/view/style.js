export const BG = '#07080a';
export const RED = '#ff3b1f';
export const redA = (a) => `rgba(255, 59, 31, ${a})`;
export const ink = (a) => `rgba(236, 238, 240, ${a})`;

const FAMILY = '"IBM Plex Mono", ui-monospace, Menlo, monospace';

export function text(ctx, str, x, y, { size = 10, weight = 400, color = ink(0.85), align = 'left', spacing = 0.14 } = {}) {
  ctx.font = `${weight} ${size}px ${FAMILY}`;
  ctx.letterSpacing = `${spacing}em`;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
}

export function measure(ctx, str, { size = 10, weight = 400, spacing = 0.14 } = {}) {
  ctx.font = `${weight} ${size}px ${FAMILY}`;
  ctx.letterSpacing = `${spacing}em`;
  return ctx.measureText(str).width;
}

export const pad = (n, len) => {
  const v = Math.round(Math.abs(n)).toString().padStart(len, '0');
  return n < 0 ? `-${v}` : v;
};

// Wall clock shared by every window, so blinking and motion stay in step.
export const sharedTime = (now) => (now % 86_400_000) / 1000;
export const blink = (t, hz, duty = 0.5) => (t * hz) % 1 < duty;

// L-shaped corner brackets around (x, y) at half-size s with arm length a.
export function brackets(ctx, x, y, s, a) {
  ctx.beginPath();
  for (const [dx, dy] of [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ]) {
    const cx = x + dx * s;
    const cy = y + dy * s;
    ctx.moveTo(cx - dx * a, cy);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx, cy - dy * a);
  }
  ctx.stroke();
}
