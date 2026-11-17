'use strict';
/* Efectos visuales: gotitas de condensación (las trazas), chispas, textos flotantes,
   destellos, sacudida de pantalla y la niebla de fondo. */

// Sprite de brillo por color. Tema oscuro: centro blanco que suma luz.
// Tema claro: centro más oscuro que mancha el fondo como tinta (mezcla 'multiply').
const Sprites = {
  cache: new Map(),
  glow(color) {
    const key = T.blend + color;
    let c = this.cache.get(key);
    if (c) return c;
    c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, T.blend === 'lighter' ? 'rgba(255,255,255,1)' : mixHex(color, '#000000', 0.3));
    grd.addColorStop(0.2, rgba(color, 0.95));
    grd.addColorStop(0.5, rgba(color, 0.3));
    grd.addColorStop(1, rgba(color, 0));
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    this.cache.set(key, c);
    return c;
  },
};

function glow(ctx, x, y, r, color, a = 1) {
  const prev = ctx.globalAlpha;
  ctx.globalAlpha = prev * a;
  const s = r * 2.2;
  ctx.drawImage(Sprites.glow(color), x - s, y - s, s * 2, s * 2);
  ctx.globalAlpha = prev;
}

// Gotitas: cada ion que deja una partícula se vuelve una gotita de alcohol que cae y se evapora
const Drops = {
  list: [],
  add(x, y, r, color, life, a = 0.8) {
    if (this.list.length > (Touch.on ? 5000 : 9000)) return; // menos gotitas en el celular
    this.list.push({ x, y, r, color, life, max: life, a, vx: (Math.random() - 0.5) * 5, vy: 2 + Math.random() * 6 });
  },
  update(dt) {
    const L = this.list;
    for (let i = L.length - 1; i >= 0; i--) {
      const d = L[i];
      d.life -= dt;
      if (d.life <= 0) { L[i] = L[L.length - 1]; L.pop(); continue; }
      d.x += d.vx * dt;
      d.y += d.vy * dt;
    }
  },
  draw(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = T.blend;
    for (const d of this.list) {
      const age = d.max - d.life;
      const grow = age < 0.15 ? 0.35 + 0.65 * (age / 0.15) : 1;
      ctx.globalAlpha = d.a * Math.min(1, d.life / (d.max * 0.6));
      const s = d.r * 2.2 * grow;
      ctx.drawImage(Sprites.glow(d.color), d.x - s, d.y - s, s * 2, s * 2);
    }
    ctx.restore();
  },
  clear() { this.list.length = 0; },
};

// Chispas: electrones arrancados, salpicaduras de energía
const Sparks = {
  list: [],
  add(x, y, vx, vy, color, life = 0.8, size = 3, label = null) {
    this.list.push({ x, y, vx, vy, color, life, max: life, size, label });
  },
  burst(x, y, n, color, speed = 160, life = 0.7, size = 3) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), v = speed * rand(0.35, 1);
      this.add(x, y, Math.cos(a) * v, Math.sin(a) * v, color, life * rand(0.7, 1.2), size * rand(0.7, 1.2));
    }
  },
  update(dt) {
    const L = this.list, k = Math.exp(-2.5 * dt);
    for (let i = L.length - 1; i >= 0; i--) {
      const s = L[i];
      s.life -= dt;
      if (s.life <= 0) { L[i] = L[L.length - 1]; L.pop(); continue; }
      s.x += s.vx * dt; s.y += s.vy * dt;
      s.vx *= k; s.vy *= k;
    }
  },
  draw(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = T.blend;
    for (const s of this.list) {
      const a = Math.min(1, s.life / (s.max * 0.5));
      glow(ctx, s.x, s.y, s.size, s.color, a);
    }
    ctx.globalCompositeOperation = 'source-over';
    for (const s of this.list) {
      if (!s.label) continue;
      txt(ctx, s.label, s.x + 7, s.y - 7, { size: 18, weight: 800, color: s.color, alpha: Math.min(1, s.life / (s.max * 0.5)) });
    }
    ctx.restore();
  },
  clear() { this.list.length = 0; },
};

// Anillos de destello
const Rings = {
  list: [],
  add(x, y, r0, r1, life, color, width = 3) { this.list.push({ x, y, r0, r1, life, max: life, color, width }); },
  update(dt) {
    const L = this.list;
    for (let i = L.length - 1; i >= 0; i--) { L[i].life -= dt; if (L[i].life <= 0) { L[i] = L[L.length - 1]; L.pop(); } }
  },
  draw(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = T.blend;
    for (const r of this.list) {
      const k = 1 - r.life / r.max;
      ctx.strokeStyle = rgba(r.color, (1 - k) * 0.9);
      ctx.lineWidth = r.width * (1 - k * 0.6);
      ctx.beginPath();
      ctx.arc(r.x, r.y, lerp(r.r0, r.r1, easeOut(k)), 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  },
  clear() { this.list.length = 0; },
};

// Textos flotantes (+100, ¡PERFECTO!, nombres de interacciones)
const Texts = {
  list: [],
  add(str, x, y, o = {}) {
    const life = o.life || 1.3;
    this.list.push({ str, x, y, color: o.color || '#fff', size: o.size || 26, life, max: life, vy: o.vy ?? -38, weight: o.weight || 800 });
  },
  update(dt) {
    const L = this.list;
    for (let i = L.length - 1; i >= 0; i--) {
      const t = L[i];
      t.life -= dt;
      if (t.life <= 0) { L.splice(i, 1); continue; }
      t.y += t.vy * dt;
    }
  },
  draw(ctx) {
    for (const t of this.list) {
      const age = t.max - t.life;
      const pop = age < 0.12 ? 0.6 + 0.4 * (age / 0.12) : 1;
      txt(ctx, t.str, t.x, t.y, {
        size: t.size * pop, weight: t.weight, align: 'center', base: 'middle', color: t.color,
        alpha: Math.min(1, t.life / 0.4), stroke: T.outline, strokeW: 6,
      });
    }
  },
  clear() { this.list.length = 0; },
};

const Shake = {
  mag: 0,
  add(m) { this.mag = Math.min(18, this.mag + m); },
  update(dt) { this.mag *= Math.exp(-7 * dt); if (this.mag < 0.1) this.mag = 0; },
  offset() { return this.mag ? { x: (Math.random() - 0.5) * 2 * this.mag, y: (Math.random() - 0.5) * 2 * this.mag } : { x: 0, y: 0 }; },
};

// Niebla de la cámara: nubes suaves y una llovizna de gotitas que cae lentamente
const Fog = {
  blobs: [], mist: [], sprite: null, spriteTheme: null,
  makeSprite() {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    grd.addColorStop(0, rgba(T.fog, 1));
    grd.addColorStop(1, rgba(T.fog, 0));
    g.fillStyle = grd;
    g.fillRect(0, 0, 256, 256);
    this.sprite = c;
    this.spriteTheme = T;
  },
  init(W, H) {
    this.blobs = Array.from({ length: 10 }, () => ({
      x: rand(0, W), y: rand(0, H), r: rand(300, 650), vx: rand(-12, 12), vy: rand(-5, 5), a: rand(0.025, 0.055),
    }));
    this.mist = Array.from({ length: 170 }, () => ({ x: rand(0, W), y: rand(0, H), vy: rand(6, 22), a: rand(0.08, 0.3), r: rand(0.6, 1.6) }));
  },
  update(dt, W, H) {
    for (const b of this.blobs) {
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.x < -b.r) b.x = W + b.r; if (b.x > W + b.r) b.x = -b.r;
      if (b.y < -b.r) b.y = H + b.r; if (b.y > H + b.r) b.y = -b.r;
    }
    for (const m of this.mist) { m.y += m.vy * dt; if (m.y > H + 4) { m.y = -4; m.x = rand(0, W); } }
  },
  draw(ctx) {
    if (this.spriteTheme !== T) this.makeSprite();
    ctx.save();
    for (const b of this.blobs) {
      ctx.globalAlpha = b.a;
      ctx.drawImage(this.sprite, b.x - b.r, b.y - b.r, b.r * 2, b.r * 2);
    }
    ctx.fillStyle = T.mist;
    for (const m of this.mist) {
      ctx.globalAlpha = m.a;
      ctx.fillRect(m.x, m.y, m.r, m.r * 2.2);
    }
    ctx.restore();
  },
};

function stepFx(dt) {
  Drops.update(dt);
  Sparks.update(dt);
  Rings.update(dt);
  Texts.update(dt);
}
function clearFx() {
  Drops.clear(); Sparks.clear(); Rings.clear(); Texts.clear();
}
