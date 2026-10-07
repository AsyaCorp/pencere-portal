import { mesh } from 'topojson-client';
import land from 'world-atlas/land-110m.json';
import { ink, text } from './style.js';

const DEG = Math.PI / 180;
const AXIAL_TILT = 23.4 * DEG;
const VIEW_TILT = 16 * DEG;
const SPIN_PERIOD = 150;

const toUnit = (lon, lat) => [Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon)];

function graticule() {
  const lines = [];
  for (let lat = -75; lat <= 75; lat += 15) {
    const l = [];
    for (let lon = -180; lon <= 180; lon += 3) l.push(toUnit(lon * DEG, lat * DEG));
    lines.push(l);
  }
  for (let lon = -180; lon < 180; lon += 15) {
    const l = [];
    for (let lat = -90; lat <= 90; lat += 3) l.push(toUnit(lon * DEG, lat * DEG));
    lines.push(l);
  }
  return lines;
}

const GRATICULE = graticule();
const COAST = mesh(land, land.objects.land).coordinates.map((line) => line.map(([lon, lat]) => toUnit(lon * DEG, lat * DEG)));

const ORBITS = [
  { r: 1.3, inc: 52, node: 25, sats: [{ id: 'SAT-03', phase: 0.3, period: 70 }, { id: 'SAT-11', phase: 3.4, period: 70 }] },
  { r: 1.62, inc: 78, node: -40, sats: [{ id: 'SAT-07', phase: 1.9, period: 110 }] },
  { r: 1.98, inc: 64, node: 70, sats: [{ id: 'SAT-14', phase: 4.6, period: 160 }, { id: 'SAT-22', phase: 1.0, period: 160 }] },
];

// Row-major 3x3 rotations.
const rotX = (a) => [1, 0, 0, 0, Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a)];
const rotY = (a) => [Math.cos(a), 0, Math.sin(a), 0, 1, 0, -Math.sin(a), 0, Math.cos(a)];
const rotZ = (a) => [Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a), 0, 0, 0, 1];
function mul(a, b) {
  const m = new Array(9);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) m[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j];
  return m;
}
const apply = (m, v) => [
  m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
  m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
  m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
];

const FRAME = mul(rotX(VIEW_TILT), rotZ(-AXIAL_TILT));

export function earthLayout(screen) {
  return { x: screen.x + screen.w / 2, y: screen.y + screen.h / 2, R: Math.min(screen.w, screen.h) * 0.3 };
}

// Strokes the front-facing parts of unit-sphere polylines.
function strokeFront(ctx, lines, m, e) {
  ctx.beginPath();
  for (const line of lines) {
    let prev = null;
    for (const v of line) {
      const p = apply(m, v);
      if (p[2] >= 0) {
        const sx = e.x + p[0] * e.R;
        const sy = e.y - p[1] * e.R;
        if (prev) ctx.lineTo(sx, sy);
        else ctx.moveTo(sx, sy);
        prev = p;
      } else {
        prev = null;
      }
    }
  }
  ctx.stroke();
}

const hidden = (p) => p[2] < 0 && p[0] * p[0] + p[1] * p[1] < 1;

export function drawEarth(ctx, e, t, hair) {
  const spin = mul(FRAME, rotY((t / SPIN_PERIOD) * Math.PI * 2));
  ctx.lineWidth = hair;
  ctx.strokeStyle = ink(0.13);
  strokeFront(ctx, GRATICULE, spin, e);
  ctx.strokeStyle = ink(0.78);
  strokeFront(ctx, COAST, spin, e);

  ctx.beginPath();
  ctx.arc(e.x, e.y, e.R, 0, Math.PI * 2);
  ctx.strokeStyle = ink(0.5);
  ctx.stroke();

  const pole = apply(spin, [0, 1, 0]);
  ctx.beginPath();
  ctx.moveTo(e.x + pole[0] * e.R * 1.08, e.y - pole[1] * e.R * 1.08);
  ctx.lineTo(e.x + pole[0] * e.R * 1.2, e.y - pole[1] * e.R * 1.2);
  ctx.strokeStyle = ink(0.45);
  ctx.stroke();
  text(ctx, 'N', e.x + pole[0] * e.R * 1.25 - 3, e.y - pole[1] * e.R * 1.25, { size: 9, color: ink(0.6) });
  text(ctx, 'EARTH  ECI J2000  R 6371 KM', e.x + e.R * 0.75, e.y - e.R * 0.75 - 10, { size: 9, color: ink(0.45) });

  for (const orbit of ORBITS) {
    const m = mul(FRAME, mul(rotY(orbit.node * DEG), rotX(orbit.inc * DEG)));
    const at = (a) => apply(m, [Math.cos(a) * orbit.r, 0, Math.sin(a) * orbit.r]);
    ctx.beginPath();
    let drawing = false;
    for (let i = 0; i <= 240; i++) {
      const p = at((i / 240) * Math.PI * 2);
      if (hidden(p)) {
        drawing = false;
        continue;
      }
      const sx = e.x + p[0] * e.R;
      const sy = e.y - p[1] * e.R;
      if (drawing) ctx.lineTo(sx, sy);
      else ctx.moveTo(sx, sy);
      drawing = true;
    }
    ctx.strokeStyle = ink(0.3);
    ctx.stroke();

    for (const sat of orbit.sats) {
      const p = at(sat.phase + (t / sat.period) * Math.PI * 2);
      if (hidden(p)) continue;
      const sx = e.x + p[0] * e.R;
      const sy = e.y - p[1] * e.R;
      ctx.fillStyle = ink(0.95);
      ctx.fillRect(sx - 2, sy - 2, 4, 4);
      ctx.beginPath();
      ctx.moveTo(sx + 3, sy - 3);
      ctx.lineTo(sx + 10, sy - 10);
      ctx.strokeStyle = ink(0.45);
      ctx.stroke();
      text(ctx, sat.id, sx + 12, sy - 11, { size: 9, color: ink(0.7) });
    }
  }
}
