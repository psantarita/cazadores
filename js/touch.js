'use strict';
/* Celulares y tabletas: botones en pantalla, diseño compacto (letras y botones más grandes)
   y aviso para girar el teléfono. Se activa sólo en pantallas táctiles;
   ?tactil=1 lo fuerza (para probarlo con el ratón) y ?tactil=0 lo apaga.
   Controles: mantener las flechas de la izquierda gira el escudo; los botones de la derecha eligen el material. */

const Touch = (() => {
  const q = new URLSearchParams(location.search).get('tactil');
  const on = q === '1' || (q !== '0' && !!window.matchMedia && matchMedia('(hover: none) and (pointer: coarse)').matches);
  const COL = 340;                  // columna de cada lado para los botones (con su margen)
  const MIN_W = 1600, MIN_H = 820;  // pantalla lógica mínima: en un celular todo se ve más grande
  const TYPES = ['alpha', 'beta', 'gamma', 'neutron'];

  const pts = new Map(); // dedos sobre la pantalla
  let taps = [];         // toques nuevos desde el último cuadro

  const portrait = () => window.innerWidth < window.innerHeight;
  function toGame(e) {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width * World.W, y: (e.clientY - r.top) / r.height * World.H };
  }
  const inRect = (p, r, m = 0) => p.x >= r.x - m && p.x <= r.x + r.w + m && p.y >= r.y - m && p.y <= r.y + r.h + m;

  // ─── Dónde está cada botón (coordenadas del juego) ───
  function rects() {
    const W = World, w = COL - 20, gap = 12, ch = 140, cw = (w - gap) / 2;
    const xl = 20, xr = W.W - COL, bottom = W.H - 20, top = bottom - 2 * ch - gap;
    return {
      split: xl + w / 2,
      spin: [{ x: xl, y: top, w: cw, h: bottom - top, v: -1 }, { x: xl + cw + gap, y: top, w: cw, h: bottom - top, v: 1 }],
      mats: [0, 1, 2, 3].map(i => ({ x: xr + (i % 2) * (cw + gap), y: top + (i >> 1) * (ch + gap), w: cw, h: ch })),
      pause: { x: W.W - 20 - 52, y: 16 + 55, r: 40 },
      resume: { x: W.W / 2 - 270, y: W.H / 2 + 10, w: 540, h: 110 },
      exit: { x: W.W / 2 - 210, y: W.H / 2 + 150, w: 420, h: 84 },
    };
  }

  // Qué hace un toque nuevo según lo que hay en pantalla
  function hit(p) {
    const G = Game;
    if (portrait()) return { kind: 'none' };
    if (G.state !== 'play' || G.card || G.ending) return { kind: 'ok' };
    const R = rects();
    if (G.paused) return { kind: inRect(p, R.resume, 10) ? 'resume' : inRect(p, R.exit, 10) ? 'exit' : 'none' };
    if (Math.hypot(p.x - R.pause.x, p.y - R.pause.y) < R.pause.r + 16) return { kind: 'pause' };
    const i = R.mats.findIndex(r => inRect(p, r, 8));
    if (i >= 0) return { kind: 'mat', i };
    if (p.x < COL + 40 && p.y > 210) return { kind: 'spin' };
    return { kind: 'ok' };
  }

  if (on) {
    window.addEventListener('pointerdown', e => {
      const p = toGame(e), h = hit(p);
      pts.set(e.pointerId, { x: p.x, y: p.y, spin: h.kind === 'spin' });
      taps.push(h);
    });
    window.addEventListener('pointermove', e => {
      const d = pts.get(e.pointerId);
      if (d) Object.assign(d, toGame(e));
    });
    const up = e => pts.delete(e.pointerId);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    window.addEventListener('blur', () => pts.clear());
    // que el navegador no haga zoom ni mueva la página al tocar
    for (const ev of ['touchstart', 'touchmove', 'gesturestart', 'dblclick']) {
      document.addEventListener(ev, e => e.preventDefault(), { passive: false });
    }
  }

  // Llena el estado del dispositivo 'touch' (mismo formato que los controles y el teclado)
  function poll(s) {
    let spin = 0, mat = -1, ok = false, start = false, exit = false;
    for (const h of taps) {
      if (h.kind === 'ok') ok = true;
      else if (h.kind === 'mat') mat = h.i;
      else if (h.kind === 'pause' || h.kind === 'resume') start = true;
      else if (h.kind === 'exit') exit = true;
    }
    const split = rects().split;
    for (const d of pts.values()) if (d.spin) spin += d.x < split ? -1 : 1;
    s.dir = null;
    s.spin = clamp(spin, -1, 1);
    s.ok = ok;
    s.mat = mat;
    s.cycle = 0;
    s.down = {};
    s.pressed = { start, exit };
    s.active = pts.size > 0 || taps.length > 0;
    taps = [];
  }

  // ─── Dibujo ───

  // Flecha curva: dir -1 gira contra el reloj (↺), +1 a favor del reloj (↻)
  function arrow(ctx, x, y, r, dir, color) {
    const a0 = Math.PI * 0.8, a1 = Math.PI * 2.2, end = dir > 0 ? a1 : a0;
    const ex = x + Math.cos(end) * r, ey = y + Math.sin(end) * r;
    const tx = dir > 0 ? -Math.sin(end) : Math.sin(end), ty = dir > 0 ? Math.cos(end) : -Math.cos(end);
    const hs = r * 0.42;
    ctx.save();
    ctx.strokeStyle = color; ctx.fillStyle = color;
    ctx.lineWidth = r * 0.24; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(x, y, r, a0 + (dir < 0 ? 0.25 : 0), a1 - (dir > 0 ? 0.25 : 0)); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(ex + tx * hs, ey + ty * hs);
    ctx.lineTo(ex - tx * hs * 0.6 - ty * hs, ey - ty * hs * 0.6 + tx * hs);
    ctx.lineTo(ex - tx * hs * 0.6 + ty * hs, ey - ty * hs * 0.6 - tx * hs);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function drawControls(ctx, G) {
    const R = rects(), pl = G.players[0], col = pl ? pl.color : PLAYER_COLORS[0];
    const held = { '-1': false, '1': false };
    for (const d of pts.values()) if (d.spin) held[d.x < R.split ? -1 : 1] = true;
    for (const b of R.spin) {
      const lit = held[b.v];
      panel(ctx, b.x, b.y, b.w, b.h, { r: 28, fill: lit ? rgba(col, 0.35) : T.panelStrong, stroke: lit ? col : T.panelStroke, lw: lit ? 4 : 2 });
      arrow(ctx, b.x + b.w / 2, b.y + b.h / 2, 42, b.v, lit ? col : T.text);
    }
    R.mats.forEach((b, i) => {
      const m = MATERIALS[i], c = XBOX[m.btn], sel = !!pl && pl.mat === i;
      const pressed = [...pts.values()].some(d => !d.spin && inRect(d, b, 8));
      ctx.save();
      if (pressed) {
        ctx.translate(b.x + b.w / 2, b.y + b.h / 2); ctx.scale(0.94, 0.94); ctx.translate(-b.x - b.w / 2, -b.y - b.h / 2);
      }
      panel(ctx, b.x, b.y, b.w, b.h, { r: 22, fill: T.panelStrong, stroke: sel ? col : rgba(c, 0.8), lw: sel ? 6 : 3 });
      rrect(ctx, b.x + 5, b.y + 5, b.w - 10, b.h - 10, 18);
      ctx.fillStyle = rgba(c, sel ? 0.9 : 0.22); ctx.fill();
      btn(ctx, m.btn, b.x + 30, b.y + 30, 18);
      const ty = PTYPES[TYPES[i]];
      txt(ctx, ty.sym, b.x + b.w - 28, b.y + 32, { size: 34, weight: 900, align: 'center', base: 'middle', color: ty.color, stroke: T.outline, strokeW: 5 });
      txt(ctx, m.name, b.x + b.w / 2, b.y + b.h - 32, {
        size: 26, weight: 900, align: 'center', base: 'middle', color: sel ? (m.btn === 'Y' ? '#2a2200' : '#ffffff') : T.text,
      });
      ctx.restore();
    });
  }

  function drawHUD(ctx, G, t) {
    const W = World, pl = G.players[0], R = rects(), x = 20, w = COL - 20;
    // oleada, arriba al centro
    const wave = WAVES[G.waveIdx];
    if (wave) {
      txt(ctx, `OLEADA ${G.waveIdx + 1}/${WAVES.length} · ${wave.title}`, W.W / 2, 44, {
        size: 28, weight: 800, align: 'center', color: T.text, stroke: T.outline, strokeW: 6,
      });
      const bw = 300, prog = clamp(G.waveT / wave.duration, 0, 1);
      rrect(ctx, W.W / 2 - bw / 2, 58, bw, 7, 3.5); ctx.fillStyle = T.track; ctx.fill();
      rrect(ctx, W.W / 2 - bw / 2, 58, bw * prog, 7, 3.5); ctx.fillStyle = T.info; ctx.fill();
    }
    // puntos e integridad del ADN
    if (pl) {
      const h = G.dna / 100, dc = h > 0.6 ? T.good : h > 0.3 ? T.gold : T.bad;
      const blink = h <= 0.3 ? 0.6 + 0.4 * Math.sin(t * 10) : 1;
      panel(ctx, x, 16, w, 190, { stroke: rgba(pl.color, 0.5) });
      txt(ctx, 'PUNTOS', x + 22, 52, { size: 22, weight: 800, color: T.muted });
      if (pl.combo >= 2) txt(ctx, `COMBO x${pl.combo}`, x + w - 20, 52, { size: 22, weight: 900, align: 'right', color: T.gold });
      txt(ctx, fmt(pl.score), x + 22, 104, { size: 50, weight: 900, color: T.text });
      txt(ctx, 'ADN', x + 22, 146, { size: 22, weight: 800, color: T.muted });
      txt(ctx, `${Math.ceil(G.dna)}%`, x + w - 20, 148, { size: 28, weight: 900, align: 'right', color: dc, alpha: blink });
      rrect(ctx, x + 22, 162, w - 44, 24, 12); ctx.fillStyle = T.track; ctx.fill();
      if (h > 0) { rrect(ctx, x + 22, 162, (w - 44) * h, 24, 12); ctx.fillStyle = dc; ctx.fill(); }
    }
    // contador Geiger y botón de pausa
    const gx = W.W - COL;
    panel(ctx, gx, 16, w, 110);
    txt(ctx, 'GEIGER', gx + 22, 52, { size: 22, weight: 800, color: T.muted });
    ctx.beginPath(); ctx.arc(gx + 128, 45, 8, 0, TAU);
    ctx.fillStyle = G.geigerLed > 0 ? `rgba(255,90,70,${0.3 + 0.7 * G.geigerLed})` : 'rgba(255,90,70,0.2)'; ctx.fill();
    const n = `${Math.round(G.geiger)}`;
    txt(ctx, n, gx + 22, 104, { size: 40, weight: 900, color: T.text });
    txt(ctx, 'cuentas/s', gx + 30 + textW(ctx, n, 40, 900), 102, { size: 20, weight: 700, color: T.muted });
    const p = R.pause;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU);
    ctx.fillStyle = T.panelStrong; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = T.panelStroke; ctx.stroke();
    ctx.fillStyle = T.text;
    rrect(ctx, p.x - 14, p.y - 16, 10, 32, 3); ctx.fill();
    rrect(ctx, p.x + 4, p.y - 16, 10, 32, 3); ctx.fill();
    drawControls(ctx, G);
  }

  function drawPause(ctx) {
    const W = World, R = rects(), r1 = R.resume, r2 = R.exit;
    ctx.fillStyle = `rgba(${T.dim},0.75)`;
    ctx.fillRect(-40, -40, W.W + 80, W.H + 80);
    txt(ctx, 'PAUSA', W.W / 2, W.H / 2 - 60, { size: 100, weight: 900, align: 'center' });
    panel(ctx, r1.x, r1.y, r1.w, r1.h, { r: 32, fill: T.good, stroke: T.good, lw: 3 });
    const tx = r1.x + r1.w / 2 - 120, ty = r1.y + r1.h / 2;
    ctx.beginPath(); ctx.moveTo(tx - 14, ty - 20); ctx.lineTo(tx + 20, ty); ctx.lineTo(tx - 14, ty + 20); ctx.closePath();
    ctx.fillStyle = '#ffffff'; ctx.fill();
    txt(ctx, 'Continuar', tx + 44, ty + 2, { size: 46, weight: 900, base: 'middle', color: '#ffffff' });
    panel(ctx, r2.x, r2.y, r2.w, r2.h, { r: 28, fill: T.panelStrong });
    txt(ctx, 'Salir al inicio', W.W / 2, r2.y + r2.h / 2 + 2, { size: 32, weight: 800, align: 'center', base: 'middle', color: T.text });
  }

  // Aviso para jugar con el teléfono acostado
  function drawRotate(ctx, t) {
    const W = World, cx = W.W / 2, cy = W.H / 2, s = W.W / 1000;
    Decor.draw(ctx); // fondo opaco: el juego queda escondido detrás
    const k = clamp((Math.sin(t * 2.2) + 1) / 2 * 1.5 - 0.25, 0, 1);
    ctx.save();
    ctx.translate(cx, cy - 140 * s);
    ctx.rotate(-Math.PI / 2 * easeOut(k));
    rrect(ctx, -105 * s, -190 * s, 210 * s, 380 * s, 34 * s);
    ctx.fillStyle = T.panelStrong; ctx.fill();
    ctx.lineWidth = 12 * s; ctx.strokeStyle = T.text; ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, 50 * s, 0, TAU); ctx.lineWidth = 8 * s; ctx.strokeStyle = PLAYER_COLORS[0]; ctx.stroke();
    ctx.restore();
    txt(ctx, 'Gira tu teléfono', cx, cy + 210 * s, { size: 92 * s, weight: 900, align: 'center', color: T.text });
    txt(ctx, 'El juego es en horizontal', cx, cy + 310 * s, { size: 54 * s, weight: 700, align: 'center', color: T.soft });
  }

  function drawTitle(ctx, G, t) {
    const W = World, cx = W.W / 2, oy = Math.max(0, (W.H - MIN_H) / 2);
    txt(ctx, 'CAZADORES', cx, oy + 100, { size: 96, weight: 900, align: 'center', color: T.title, glow: T.glow, blur: 30 });
    txt(ctx, 'DE LO INVISIBLE', cx, oy + 160, { size: 52, weight: 800, align: 'center', color: T.title2, glow: T.glow, blur: 18 });
    txt(ctx, 'Descubre cómo interactúa la radiación ionizante con la materia', cx, oy + 204, { size: 26, weight: 600, align: 'center', color: T.soft });
    const pw = Math.min(1180, W.W - 80), ph = 380, py = oy + 228;
    drawInfoPanel(ctx, G, t, cx - pw / 2, py, pw, ph);
    const by = py + ph + 20;
    if (!G.lobby.length) {
      const bw = 600, bh = 96, a = 0.75 + 0.25 * Math.sin(t * 4);
      panel(ctx, cx - bw / 2, by, bw, bh, { r: 48, fill: rgba(PLAYER_COLORS[0], 0.9), stroke: PLAYER_COLORS[0], lw: 3 });
      txt(ctx, 'Toca para jugar', cx, by + bh / 2 + 2, { size: 46, weight: 900, align: 'center', base: 'middle', color: '#ffffff', alpha: a });
    } else {
      txt(ctx, `¡Comienza en ${Math.max(1, Math.ceil(G.countdown))}!`, cx, by + 46, { size: 46, weight: 900, align: 'center', color: T.gold });
      txt(ctx, 'Toca otra vez para empezar ya', cx, by + 88, { size: 26, weight: 700, align: 'center', color: T.soft });
    }
    txt(ctx, 'IFUNAM · Día de Puertas Abiertas', 30, W.H - 18, { size: 22, weight: 700, color: T.muted });
    if (G.record.score > 0) txt(ctx, `Récord de hoy: ${fmt(G.record.score)}`, W.W - 30, W.H - 18, { size: 22, weight: 800, align: 'right', color: T.gold });
  }

  function drawResults(ctx, G, t) {
    const W = World, r = G.results, cx = W.W / 2, oy = Math.max(0, (W.H - MIN_H) / 2), p = r.players[0];
    const a = clamp(r.t / 0.6, 0, 1);
    ctx.save();
    ctx.fillStyle = `rgba(${T.dim},${0.6 * a})`;
    ctx.fillRect(-40, -40, W.W + 80, W.H + 80);
    ctx.globalAlpha = a;
    txt(ctx, r.success ? '¡CÉLULA A SALVO!' : 'LA CÉLULA RECIBIÓ DEMASIADA RADIACIÓN', cx, oy + 82, {
      size: r.success ? 66 : 46, weight: 900, align: 'center', color: r.success ? T.good : T.bad, glow: r.success ? T.good : T.bad, blur: 24,
    });
    txt(ctx, 'Rango:', cx, oy + 126, { size: 24, weight: 700, align: 'center', color: T.muted });
    txt(ctx, r.rank, cx, oy + 172, { size: 44, weight: 900, align: 'center', color: T.gold });
    const avail = Math.min(W.W - 80, 1500), cw = 460, rowH = 360, x0 = cx - avail / 2, y0 = oy + 204;
    if (p) {
      const col = PLAYER_COLORS[p.slot];
      panel(ctx, x0, y0, cw, rowH, { stroke: rgba(col, 0.6), lw: 3 });
      txt(ctx, 'TUS PUNTOS', x0 + 28, y0 + 42, { size: 22, weight: 900, color: col });
      txt(ctx, fmt(p.final), x0 + 28, y0 + 110, { size: 60, weight: 900 });
      [['Partículas cazadas', p.blocks], ['Con el material ideal', p.perfect], ['Se te escaparon', p.leaks], ['Mejor combo', 'x' + p.bestCombo]]
        .forEach(([k, v], j) => {
          txt(ctx, k, x0 + 28, y0 + 168 + j * 46, { size: 26, weight: 600, color: T.soft });
          txt(ctx, String(v), x0 + cw - 28, y0 + 168 + j * 46, { size: 26, weight: 800, align: 'right' });
        });
    }
    const px = x0 + cw + 30, pw = avail - cw - 30;
    panel(ctx, px, y0, pw, rowH, { fill: T.panel });
    txt(ctx, 'LO QUE APRENDISTE', px + pw / 2, y0 + 38, { size: 24, weight: 900, align: 'center', color: T.muted });
    drawPenetration(ctx, px + 40, y0 + 50, pw - 80, rowH - 62, TYPES, t, 'touch');
    txt(ctx, `ADN restante: ${r.dna}%  ·  bono +${fmt(r.dnaBonus)}`, cx, y0 + rowH + 48, { size: 30, weight: 800, align: 'center', color: T.good });
    if (r.newRecord) txt(ctx, '¡NUEVO RÉCORD DEL DÍA!', cx, y0 + rowH + 92, { size: 32, weight: 900, align: 'center', color: T.gold, alpha: 0.6 + 0.4 * Math.sin(t * 6) });
    if (r.t > 3) txt(ctx, 'Toca para volver al inicio', cx, Math.min(W.H - 30, oy + 790), { size: 32, weight: 800, align: 'center', alpha: 0.6 + 0.4 * Math.sin(t * 4) });
    ctx.restore();
  }

  return {
    on, COL, MIN_W, MIN_H, portrait, poll, arrow,
    drawHUD, drawPause, drawRotate, drawTitle, drawResults,
  };
})();
