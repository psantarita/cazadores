'use strict';
/* Utilidades matemáticas y de color */

const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const expRand = mean => -Math.log(1 - Math.random()) * mean;
const easeOut = t => 1 - Math.pow(1 - t, 3);
const easeOutBack = t => { const c = 1.6; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };

// Diferencia angular en (-π, π]
function angDiff(a, b) {
  let d = (a - b) % TAU;
  if (d > Math.PI) d -= TAU;
  else if (d < -Math.PI) d += TAU;
  return d;
}

// Número aleatorio con distribución normal (media 0, desviación 1)
function randn() {
  let u = 0;
  while (!u) u = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * Math.random());
}

const _rgbCache = {};
function hexRgb(hex) {
  if (_rgbCache[hex]) return _rgbCache[hex];
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const n = parseInt(h, 16);
  return (_rgbCache[hex] = [(n >> 16) & 255, (n >> 8) & 255, n & 255]);
}
function rgba(hex, a) {
  const [r, g, b] = hexRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}
function mixHex(a, b, t) {
  const A = hexRgb(a), B = hexRgb(b);
  const c = i => Math.round(lerp(A[i], B[i], clamp(t, 0, 1))).toString(16).padStart(2, '0');
  return '#' + c(0) + c(1) + c(2);
}

// Generador pseudoaleatorio con semilla (para dibujos que siempre se ven igual)
function seeded(seed) {
  return function () {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const fmt = n => Math.round(n).toLocaleString('es-MX');
