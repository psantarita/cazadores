'use strict';
/* Simulación: cómo se mueve cada radiación, qué traza deja en la cámara de niebla,
   y cuándo cruza un escudo o llega a la célula.

   - Alfa: pesada, recta, ioniza muchísimo y cada vez más al frenarse (pico de Bragg).
   - Beta: ligera, cambia de dirección al rebotar con los átomos (dispersión múltiple).
   - Gamma: fotón sin carga; casi no deja traza, sólo electrones sueltos (Compton).
   - Neutrón: sin carga, invisible; sólo se ven los núcleos que golpea (protones de retroceso).
   - Muón cósmico: muy rápido y penetrante, traza larga y delgada que lo atraviesa todo. */

const World = {
  W: 1920, H: 1080, cx: 960, cy: 545,
  R: 255,       // radio del anillo de escudos
  cellR: 108,   // radio de la célula
  nucR: 54,     // radio del núcleo celular
  particles: [], sources: [],
  real: false,  // visión real: todas las trazas blancas
  mode: 'demo', // 'demo' (pantalla de título) o 'game'
  hooks: { click() {}, emitted() {}, shield() {}, cell() {} },
  resize(W, H) { this.W = W; this.H = H; this.cx = W / 2; this.cy = H / 2 + 5; },
  clear() { this.particles.length = 0; this.sources.length = 0; },
};

const trackColor = type => (World.real ? T.real : PTYPES[type].color);

function spawn(type, x, y, dir, o = {}) {
  const def = PTYPES[type] || {};
  const p = {
    type, x, y, dir,
    speed: (o.speed || def.speed || 200) * rand(0.92, 1.08),
    tx: o.tx ?? null, ty: o.ty ?? null,
    range: o.range || Infinity, traveled: 0, energy: 1,
    color: o.color || trackColor(type),
    threat: !!THREAT[type] && World.mode === 'game' && !o.harmless,
    crossed: !!o.inside, hitCell: false,
    prevD: Math.hypot(x - World.cx, y - World.cy),
    acc: Math.random() * 4, nextEv: expRand(type === 'neutron' ? 110 : 150),
    wob: 0, age: 0, alive: true, phase: Math.random() * TAU,
  };
  World.particles.push(p);
  return p;
}

function advance(p, d) {
  p.x += Math.cos(p.dir) * d;
  p.y += Math.sin(p.dir) * d;
  p.traveled += d;
}

// Deja gotitas a lo largo del segmento recorrido
function trail(p, ox, oy, spacing, rMin, rMax, jitter, life, alpha) {
  const dx = p.x - ox, dy = p.y - oy, L = Math.hypot(dx, dy);
  if (L <= 0) return;
  p.acc += L;
  const nx = -dy / L, ny = dx / L;
  while (p.acc >= spacing) {
    p.acc -= spacing;
    const t = clamp(1 - p.acc / L, 0, 1);
    const j = (Math.random() - 0.5) * 2 * jitter;
    Drops.add(ox + dx * t + nx * j, oy + dy * t + ny * j, rand(rMin, rMax), p.color, life * rand(0.8, 1.2), alpha);
  }
}

// Pico de Bragg: la alfa suelta toda su energía restante en un punto
function braggBurst(x, y, color) {
  for (let i = 0; i < 16; i++) Drops.add(x + randn() * 4.5, y + randn() * 4.5, rand(3, 5.5), color, rand(2, 3), 0.5);
  Rings.add(x, y, 3, 26, 0.35, color, 3);
}

// Un gamma le cede energía a un electrón (efecto Compton): aparece una trazita suelta
function comptonKick(p) {
  const side = Math.random() < 0.5 ? -1 : 1;
  spawn('electron', p.x, p.y, p.dir + side * rand(0.35, 1.2), { range: rand(22, 70), color: p.color, speed: 260 });
  Rings.add(p.x, p.y, 2, 14, 0.3, p.color, 2);
  World.hooks.click(0.3);
}

function stepParticle(p, dt) {
  p.age += dt;
  const ox = p.x, oy = p.y;
  switch (p.type) {
    case 'alpha': {
      p.energy = Math.max(0.05, 1 - p.traveled / p.range);
      const e = p.energy;
      advance(p, p.speed * (0.5 + 0.5 * e) * dt);
      // más lenta → más ionización por unidad de camino
      trail(p, ox, oy, 1.6 + 2.2 * e, 2.4 + 2.6 * (1 - e), 3.6 + 3 * (1 - e), 2.2, 2.6, 0.55);
      if (p.traveled >= p.range) { braggBurst(p.x, p.y, p.color); p.alive = false; }
      break;
    }
    case 'beta':
    case 'electron': {
      if (p.tx !== null) {
        const want = Math.atan2(p.ty - p.y, p.tx - p.x);
        p.dir += angDiff(want, p.dir) * Math.min(1, 1.9 * dt);
      }
      const isBeta = p.type === 'beta';
      p.wob = p.wob * Math.exp(-3 * dt) + randn() * Math.sqrt(dt) * (isBeta ? 4.2 : 9);
      p.dir += p.wob * dt;
      if (Math.random() < (isBeta ? 0.8 : 2) * dt) p.dir += (Math.random() < 0.5 ? -1 : 1) * rand(0.25, 0.7);
      advance(p, p.speed * dt);
      trail(p, ox, oy, isBeta ? 7 : 5, 1.2, 2.1, 0.5, 2.3, 0.8);
      if (p.traveled >= p.range) p.alive = false;
      break;
    }
    case 'gamma':
    case 'xray': {
      advance(p, p.speed * dt);
      p.nextEv -= p.speed * dt;
      if (p.nextEv <= 0) { p.nextEv = expRand(p.type === 'gamma' ? 160 : 230); comptonKick(p); }
      if (p.traveled >= p.range) p.alive = false;
      break;
    }
    case 'photon': { // gamma dispersado: sólo visual
      advance(p, p.speed * dt);
      if (p.traveled >= p.range) p.alive = false;
      break;
    }
    case 'neutron': {
      advance(p, p.speed * dt);
      p.nextEv -= p.speed * dt;
      if (p.nextEv <= 0) {
        // choque elástico con un núcleo: el núcleo sale disparado y ése sí ioniza
        p.nextEv = expRand(115);
        spawn('proton', p.x, p.y, p.dir + rand(-1.3, 1.3), { range: rand(18, 34), color: p.color, speed: 150 });
        if (p.tx !== null && !p.hitCell) p.dir = Math.atan2(p.ty - p.y, p.tx - p.x) + randn() * 0.2;
        else p.dir += randn() * 0.45;
        World.hooks.click(0.25);
      }
      break;
    }
    case 'proton': {
      advance(p, p.speed * dt);
      trail(p, ox, oy, 1.8, 2.0, 3.0, 1.2, 2.2, 0.6);
      if (p.traveled >= p.range) p.alive = false;
      break;
    }
    case 'muon': {
      advance(p, p.speed * dt);
      trail(p, ox, oy, 5, 1.0, 1.6, 0.4, 3.2, 0.7);
      break;
    }
  }
  const W = World;
  if (p.x < -160 || p.x > W.W + 160 || p.y < -160 || p.y > W.H + 160 || p.age > 15) { p.alive = false; return; }
  if (p.threat && p.alive) checkTargets(p, ox, oy);
}

function checkTargets(p, ox, oy) {
  const W = World;
  const d = Math.hypot(p.x - W.cx, p.y - W.cy);
  if (!p.crossed && p.prevD >= W.R && d < W.R) {
    p.crossed = true;
    const t = (p.prevD - W.R) / Math.max(1e-6, p.prevD - d);
    const hx = ox + (p.x - ox) * t, hy = oy + (p.y - oy) * t;
    W.hooks.shield(p, hx, hy, Math.atan2(hy - W.cy, hx - W.cx));
    if (!p.alive) return;
  }
  if (!p.hitCell && d < W.cellR * 0.92) {
    p.hitCell = true;
    W.hooks.cell(p);
  }
  p.prevD = d;
}

function updateParticles(dt) {
  const L = World.particles;
  for (let i = L.length - 1; i >= 0; i--) {
    const p = L[i];
    if (p.alive) stepParticle(p, dt);
    if (!p.alive) { L[i] = L[L.length - 1]; L.pop(); }
  }
}

// Punto en un borde de la pantalla, apuntando hacia el interior
function edgeStart() {
  const W = World, side = randInt(0, 3);
  let x, y;
  if (side === 0) { x = rand(0, W.W); y = -20; }
  else if (side === 1) { x = W.W + 20; y = rand(0, W.H); }
  else if (side === 2) { x = rand(0, W.W); y = W.H + 20; }
  else { x = -20; y = rand(0, W.H); }
  const tx = rand(W.W * 0.25, W.W * 0.75), ty = rand(W.H * 0.25, W.H * 0.75);
  return [x, y, Math.atan2(ty - y, tx - x)];
}

function spawnMuon() {
  const [x, y, dir] = edgeStart();
  spawn('muon', x, y, dir);
  World.hooks.click(0.5);
}

// Pantalla de título: una cámara de niebla con radiación de fondo al azar
function demoSpawn() {
  const W = World, r = Math.random();
  if (r < 0.3) {
    spawn('alpha', rand(80, W.W - 80), rand(80, W.H - 80), rand(0, TAU), { range: rand(110, 230) });
  } else if (r < 0.55) {
    const [x, y, dir] = edgeStart();
    spawn('beta', x, y, dir, { range: rand(500, 1400) });
  } else if (r < 0.75) {
    spawnMuon();
    return;
  } else if (r < 0.9) {
    const [x, y, dir] = edgeStart();
    spawn('gamma', x, y, dir);
  } else {
    const [x, y, dir] = edgeStart();
    spawn('neutron', x, y, dir);
  }
  World.hooks.click(0.4);
}

// ─── Fuentes radiactivas ───

function sourceColor(s) {
  if (World.real || s.def.emits.length > 1) return T.real;
  return PTYPES[s.def.emits[0]].color;
}

function spawnSource(id) {
  const W = World, def = SOURCES[id];
  let ang, tries = 0;
  do { ang = rand(0, TAU); tries++; }
  while (tries < 40 && W.sources.some(s => Math.abs(angDiff(s.ang, ang)) < 0.8));
  // en el celular las fuentes quedan entre las dos columnas de botones
  const rx = Touch.on ? Math.min(W.W / 2 - Touch.COL - 95, 800) : Math.min(W.W / 2 - 170, 800);
  const ry = Touch.on ? Math.min(W.H / 2 - 95, 330) : Math.min(W.H / 2 - 200, 330);
  const s = {
    id, def, ang,
    x: W.cx + Math.cos(ang) * rx, y: W.cy + Math.sin(ang) * ry,
    t: 0, warn: 1.4, left: randInt(def.count[0], def.count[1]), next: 0,
    state: 'warn', fade: 0, pulse: 0,
  };
  s.ang = Math.atan2(s.y - W.cy, s.x - W.cx);
  W.sources.push(s);
  return s;
}

function emitFrom(s) {
  const W = World;
  const type = pick(s.def.emits);
  const a = rand(0, TAU), rr = rand(0, W.nucR * 1.1);
  const tx = W.cx + Math.cos(a) * rr, ty = W.cy + Math.sin(a) * rr;
  const dir = Math.atan2(ty - s.y, tx - s.x);
  const x = s.x + Math.cos(dir) * 28, y = s.y + Math.sin(dir) * 28;
  const o = { tx, ty };
  if (type === 'alpha') o.range = Math.hypot(tx - x, ty - y) + 40;
  spawn(type, x, y, dir, o);
  s.pulse = 1;
  W.hooks.emitted(type);
}

function updateSources(dt) {
  const L = World.sources;
  for (let i = L.length - 1; i >= 0; i--) {
    const s = L[i];
    s.t += dt;
    s.pulse = Math.max(0, s.pulse - dt * 4);
    if (s.state === 'warn') {
      if (Math.random() < dt * (2 + 10 * s.t / s.warn)) World.hooks.click(0.2);
      if (s.t >= s.warn) { s.state = 'emit'; s.next = 0; }
    } else if (s.state === 'emit') {
      s.next -= dt;
      if (s.next <= 0) {
        emitFrom(s);
        s.left--;
        s.next = rand(0.55, 0.95);
        if (s.left <= 0) { s.state = 'fade'; s.fade = 0; }
      }
    } else {
      s.fade += dt;
      if (s.fade > 1.1) L.splice(i, 1);
    }
  }
}
