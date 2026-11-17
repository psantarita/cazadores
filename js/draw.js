'use strict';
/* Dibujo: fondo, célula con ADN, fuentes, partículas, escudos, HUD,
   tarjetas educativas y pantallas de título y resultados. */

// ─── Ayudas de dibujo ───

function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else {
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
}

function panel(ctx, x, y, w, h, o = {}) {
  rrect(ctx, x, y, w, h, o.r ?? 16);
  ctx.fillStyle = o.fill || T.panel;
  ctx.fill();
  ctx.lineWidth = o.lw || 2;
  ctx.strokeStyle = o.stroke || T.panelStroke;
  ctx.stroke();
}

function txt(ctx, s, x, y, o = {}) {
  ctx.font = `${o.weight || 700} ${o.size || 26}px ${FONT}`;
  ctx.textAlign = o.align || 'left';
  ctx.textBaseline = o.base || 'alphabetic';
  const prev = ctx.globalAlpha;
  if (o.alpha !== undefined) ctx.globalAlpha = prev * o.alpha;
  if (o.glow) { ctx.shadowColor = o.glow; ctx.shadowBlur = o.blur || 18; }
  if (o.stroke) { ctx.lineJoin = 'round'; ctx.lineWidth = o.strokeW || 6; ctx.strokeStyle = o.stroke; ctx.strokeText(s, x, y); }
  ctx.fillStyle = o.color || T.text;
  ctx.fillText(s, x, y);
  ctx.shadowBlur = 0;
  ctx.shadowColor = 'transparent';
  ctx.globalAlpha = prev;
}

function textW(ctx, s, size, weight = 700) {
  ctx.font = `${weight} ${size}px ${FONT}`;
  return ctx.measureText(s).width;
}

function wrap(ctx, s, maxW, size, weight = 600) {
  ctx.font = `${weight} ${size}px ${FONT}`;
  const words = s.split(' '), lines = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? cur + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = w; } else cur = test;
  }
  if (cur) lines.push(cur);
  return lines;
}

// Botón del control de Xbox (círculo de color con su letra)
function btn(ctx, letter, x, y, r = 18, alpha = 1) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fillStyle = XBOX[letter];
  ctx.fill();
  ctx.lineWidth = Math.max(2, r * 0.12);
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.stroke();
  txt(ctx, letter, x, y + r * 0.06, { size: r * 1.15, weight: 900, align: 'center', base: 'middle', color: letter === 'Y' ? '#2a2200' : '#fff' });
  ctx.restore();
}

// Tecla del teclado (cuadro redondeado con su etiqueta)
function keyW(ctx, label, r) { return Math.max(r * 2, textW(ctx, label, r * 1.0, 900) + r * 0.9); }
function keycap(ctx, label, color, x, y, r = 18, alpha = 1) {
  const w = keyW(ctx, label, r), h = r * 2;
  ctx.save();
  ctx.globalAlpha *= alpha;
  rrect(ctx, x - w / 2, y - h / 2 + r * 0.14, w, h, r * 0.38);
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fill();
  rrect(ctx, x - w / 2, y - h / 2, w, h, r * 0.38);
  ctx.fillStyle = color; ctx.fill();
  ctx.lineWidth = Math.max(2, r * 0.12); ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.stroke();
  txt(ctx, label, x, y + r * 0.06, { size: r * 1.0, weight: 900, align: 'center', base: 'middle', color: color === XBOX.Y ? '#2a2200' : '#fff' });
  ctx.restore();
}

// Botón o tecla de un material según con qué juega cada quien ('pad', 'kbm', 'kb2')
function matGlyph(ctx, kind, i, x, y, r = 18) {
  const m = MATERIALS[i];
  if (KEY_LABELS[kind]) keycap(ctx, KEY_LABELS[kind][i], XBOX[m.btn], x, y, r);
  else btn(ctx, m.btn, x, y, r);
}

// Partes para "aceptar": el botón A, el clic o la tecla Z
function okParts(kinds) {
  const parts = [];
  kinds.forEach((k, i) => {
    if (i) parts.push('o');
    parts.push(k === 'kbm' ? { key: 'Clic' } : k === 'kb2' ? { key: 'Z' } : { btn: 'A' });
  });
  return parts;
}

// "Presiona [A] para continuar" o, en el celular, "Toca para continuar"
function okLine(kinds, what) {
  return kinds.includes('touch') ? [`Toca para ${what.toLowerCase()}`] : [...okParts(kinds), what];
}

const KEY_GREY = '#3c4d6b';

// Texto con botones y teclas incrustados: "Presiona [A] para jugar"
function richLine(ctx, parts, x, y, size, o = {}) {
  const r = size * 0.62, gap = size * 0.28;
  const partW = p => (p.btn ? r * 2 : p.key ? keyW(ctx, p.key, r) : textW(ctx, p, size, o.weight || 700));
  let w = 0;
  for (const p of parts) w += partW(p) + gap;
  w -= gap;
  let cx = o.align === 'center' ? x - w / 2 : o.align === 'right' ? x - w : x;
  for (const p of parts) {
    if (p.btn) { btn(ctx, p.btn, cx + r, y, r, o.alpha ?? 1); cx += r * 2 + gap; }
    else if (p.key) { const kw = keyW(ctx, p.key, r); keycap(ctx, p.key, p.color || KEY_GREY, cx + kw / 2, y, r, o.alpha ?? 1); cx += kw + gap; }
    else {
      txt(ctx, p, cx, y, { size, weight: o.weight || 700, base: 'middle', color: o.color || T.text, alpha: o.alpha });
      cx += textW(ctx, p, size, o.weight || 700) + gap;
    }
  }
}

function trefoil(ctx, x, y, r) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#ffd21f';
  ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
  ctx.fillStyle = '#141414';
  for (let i = 0; i < 3; i++) {
    const a = Math.PI / 2 + i * TAU / 3;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, r * 0.86, a - Math.PI / 6, a + Math.PI / 6); ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = '#ffd21f';
  ctx.beginPath(); ctx.arc(0, 0, r * 0.3, 0, TAU); ctx.fill();
  ctx.fillStyle = '#141414';
  ctx.beginPath(); ctx.arc(0, 0, r * 0.17, 0, TAU); ctx.fill();
  ctx.restore();
}

function symbolCircle(ctx, type, x, y, r, white = false) {
  const col = white ? T.real : PTYPES[type].color;
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU);
  ctx.fillStyle = rgba(col, 0.16); ctx.fill();
  ctx.lineWidth = 2.5; ctx.strokeStyle = col; ctx.stroke();
  txt(ctx, PTYPES[type].sym, x, y + r * 0.04, { size: r * 1.15, weight: 800, align: 'center', base: 'middle', color: col });
}

// ─── Fondo ───

let _bg = null;
function drawBackground(ctx) {
  const W = World;
  if (!_bg || _bg.w !== W.W || _bg.h !== W.H || _bg.theme !== T) {
    const big = Math.max(W.W, W.H);
    const v = ctx.createRadialGradient(W.cx, W.cy, W.H * 0.38, W.cx, W.cy, big * 0.78);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, T.vig);
    _bg = { w: W.W, h: W.H, v, theme: T };
  }
  Decor.draw(ctx);
  Fog.draw(ctx);
}
function drawVignette(ctx) {
  ctx.fillStyle = _bg.v;
  ctx.fillRect(-40, -40, World.W + 80, World.H + 80);
}

// ─── Célula y ADN ───

function drawDNA(ctx, cx, cy, L, t, rungs, health) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.5);
  const n = rungs.length, A = 13, k = TAU * 1.6 / (2 * L), ph = t * 1.6;
  const breaks = Math.floor((1 - health) * 6);
  const breakAt = i => { for (let b = 0; b < breaks; b++) if (i === (b * 7 + 3) % n) return true; return false; };
  for (let i = 0; i < n; i++) {
    const x = -L + (i + 0.5) * (2 * L / n);
    const y1 = A * Math.sin(k * x + ph), y2 = -y1;
    const depth = 0.55 + 0.45 * Math.abs(Math.cos(k * x + ph));
    const dmg = rungs[i];
    ctx.lineWidth = 3;
    if (dmg > 0.02) {
      const gap = 4 + dmg * 6, mid = (y1 + y2) / 2;
      ctx.strokeStyle = rgba(T.bad, 0.5 + 0.5 * dmg);
      ctx.beginPath();
      ctx.moveTo(x, y1); ctx.lineTo(x - dmg * 3, mid - Math.sign(y1 - y2 || 1) * gap);
      ctx.moveTo(x, y2); ctx.lineTo(x + dmg * 3, mid + Math.sign(y1 - y2 || 1) * gap);
      ctx.stroke();
    } else {
      ctx.strokeStyle = rgba(i % 2 ? T.rungA : T.info, depth);
      ctx.beginPath(); ctx.moveTo(x, y1); ctx.lineTo(x, y2); ctx.stroke();
    }
  }
  for (const s of [1, -1]) {
    ctx.beginPath();
    let pen = false;
    for (let x = -L; x <= L; x += 3) {
      const i = Math.floor((x + L) / (2 * L) * n);
      if (breakAt(i) && s > 0 === (i % 2 === 0)) { pen = false; continue; }
      const y = s * A * Math.sin(k * x + ph);
      if (pen) ctx.lineTo(x, y); else { ctx.moveTo(x, y); pen = true; }
    }
    ctx.strokeStyle = s > 0 ? T.dna1 : T.dna2;
    ctx.lineWidth = 3.2;
    ctx.stroke();
  }
  ctx.restore();
}

function cellPath(ctx, cx, cy, R, t) {
  ctx.beginPath();
  for (let i = 0; i <= 72; i++) {
    const a = i / 72 * TAU;
    const r = R * (1 + 0.03 * Math.sin(3 * a + t * 1.2) + 0.02 * Math.sin(5 * a - t * 0.8));
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
    if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
  }
  ctx.closePath();
}

function drawCell(ctx, t, dna, flash, rungs) {
  // la célula "respira" con el bombo de la música
  const W = World, cx = W.cx, cy = W.cy, R = W.cellR * (1 + 0.025 * Decor.pulse), health = dna / 100;
  const memb = mixHex(T.memb, T.bad, Math.max(flash, (1 - health) * 0.8));
  ctx.save();
  cellPath(ctx, cx, cy, R, t);
  const g = ctx.createRadialGradient(cx, cy, 10, cx, cy, R);
  g.addColorStop(0, rgba(memb, 0.22)); g.addColorStop(1, rgba(memb, 0.08));
  ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = 12; ctx.strokeStyle = rgba(memb, 0.15); ctx.stroke();
  ctx.lineWidth = 3.5; ctx.strokeStyle = memb; ctx.stroke();
  // organelos
  for (let i = 0; i < 6; i++) {
    const a = i * 1.07 + t * 0.06, rr = R * (0.68 + 0.06 * Math.sin(i * 2.3 + t * 0.5));
    ctx.save();
    ctx.translate(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    ctx.rotate(a + 1.2);
    ctx.beginPath(); ctx.ellipse(0, 0, 13, 6, 0, 0, TAU);
    ctx.fillStyle = T.organelle; ctx.fill();
    ctx.restore();
  }
  // núcleo
  ctx.beginPath(); ctx.arc(cx, cy, W.nucR, 0, TAU);
  ctx.fillStyle = rgba(T.nucleus, 0.2); ctx.fill();
  ctx.lineWidth = 2.5; ctx.strokeStyle = T.nucleus; ctx.stroke();
  drawDNA(ctx, cx, cy, W.nucR * 0.86, t, rungs, health);
  if (flash > 0) {
    cellPath(ctx, cx, cy, R, t);
    ctx.fillStyle = `rgba(255,60,50,${0.35 * flash})`;
    ctx.fill();
  }
  // anillo de integridad del ADN
  const col = health > 0.6 ? T.good : health > 0.3 ? T.gold : T.bad;
  ctx.lineCap = 'round';
  ctx.lineWidth = 6; ctx.strokeStyle = T.track;
  ctx.beginPath(); ctx.arc(cx, cy, R + 20, 0, TAU); ctx.stroke();
  if (health > 0.002) {
    ctx.strokeStyle = col;
    ctx.beginPath(); ctx.arc(cx, cy, R + 20, -Math.PI / 2, -Math.PI / 2 + TAU * health); ctx.stroke();
  }
  txt(ctx, `ADN ${Math.ceil(dna)}%`, cx, cy + R + 50, { size: 20, weight: 800, align: 'center', color: col, stroke: T.outline, strokeW: 5 });
  ctx.restore();
}

// ─── Anillo de escudos, fuentes y partículas ───

function drawRingGuide(ctx, t) {
  const W = World;
  ctx.save();
  ctx.setLineDash([4, 14]);
  ctx.lineWidth = 2;
  ctx.strokeStyle = T.ring;
  ctx.beginPath(); ctx.arc(W.cx, W.cy, W.R, 0, TAU); ctx.stroke();
  ctx.setLineDash([]);
  // marca de alerta en el anillo, en dirección de cada fuente activa
  for (const s of W.sources) {
    if (s.state === 'fade') continue;
    const pulse = 0.5 + 0.5 * Math.sin(t * 10);
    const appear = clamp(s.t / 0.4, 0, 1);
    ctx.strokeStyle = rgba(sourceColor(s), (0.18 + 0.3 * pulse) * appear);
    ctx.lineWidth = 30;
    ctx.beginPath(); ctx.arc(W.cx, W.cy, W.R, s.ang - 0.13, s.ang + 0.13); ctx.stroke();
  }
  ctx.restore();
}

function drawSources(ctx, t) {
  const W = World;
  for (const s of W.sources) {
    const appear = clamp(s.t / 0.35, 0, 1), fade = s.state === 'fade' ? clamp(1 - s.fade / 1.1, 0, 1) : 1;
    const al = appear * fade;
    if (al <= 0) continue;
    const col = sourceColor(s);
    ctx.save();
    ctx.globalAlpha = al;
    ctx.translate(s.x, s.y);
    if (s.state === 'warn') {
      for (const off of [0, 0.5]) {
        const k = (s.t * 1.4 + off) % 1;
        ctx.strokeStyle = rgba(col, (1 - k) * 0.8);
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(0, 0, 34 + k * 55, 0, TAU); ctx.stroke();
      }
    }
    if (s.pulse > 0) {
      ctx.globalCompositeOperation = T.blend;
      glow(ctx, 0, 0, 30, col, s.pulse * 0.8);
      ctx.globalCompositeOperation = 'source-over';
    }
    rrect(ctx, -38, -25, 76, 50, 13);
    ctx.fillStyle = '#18212f'; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = col; ctx.stroke();
    trefoil(ctx, 0, 0, 17);
    // etiqueta del lado de afuera (en el celular, abajo, para dejar libres los lados)
    const below = Touch.on, right = s.x >= W.cx;
    const lx = below ? 0 : right ? 50 : -50, al2 = below ? 'center' : right ? 'left' : 'right';
    const ly1 = below ? 52 : -2, ly2 = below ? 80 : 26;
    txt(ctx, s.def.short, lx, ly1, { size: 24, weight: 800, align: al2, color: T.text, stroke: T.outline, strokeW: 5 });
    if (W.real) {
      txt(ctx, '¿ ? ?', lx, ly2, { size: 22, weight: 800, align: al2, color: T.muted });
    } else if (below) {
      const syms = s.def.emits.map(k => PTYPES[k]);
      const ws = syms.map(p => textW(ctx, p.sym, 26, 800));
      let x = -(ws.reduce((a, b) => a + b, 0) + 8 * (syms.length - 1)) / 2;
      syms.forEach((p, i) => {
        txt(ctx, p.sym, x, ly2, { size: 26, weight: 800, color: p.color, stroke: T.outline, strokeW: 5 });
        x += ws[i] + 8;
      });
    } else {
      const syms = s.def.emits;
      let x = lx;
      for (let i = 0; i < syms.length; i++) {
        const j = right ? i : syms.length - 1 - i;
        const sym = PTYPES[syms[j]].sym;
        txt(ctx, sym, x, 26, { size: 26, weight: 800, align: al2, color: PTYPES[syms[j]].color, stroke: T.outline, strokeW: 5 });
        x += (right ? 1 : -1) * (textW(ctx, sym, 26, 800) + 8);
      }
    }
    ctx.restore();
  }
}

function drawParticles(ctx, t) {
  const real = World.real;
  ctx.save();
  ctx.globalCompositeOperation = T.blend;
  for (const p of World.particles) {
    switch (p.type) {
      case 'alpha': glow(ctx, p.x, p.y, 9, p.color, real ? 0.6 : 1); break;
      case 'beta': glow(ctx, p.x, p.y, 6, p.color, real ? 0.5 : 0.9); break;
      case 'muon': glow(ctx, p.x, p.y, 4, p.color, 0.7); break;
      case 'gamma': case 'xray': case 'photon': {
        // paquete de onda: el fotón
        const L = 62, A = 6.5, c = Math.cos(p.dir), s = Math.sin(p.dir);
        ctx.strokeStyle = rgba(p.color, real ? 0.32 : p.type === 'photon' ? 0.45 : 0.9);
        ctx.lineWidth = 3;
        ctx.beginPath();
        for (let d = 0; d <= L; d += 2) {
          const off = Math.sin(d * 0.55 - t * 30) * A * Math.sin(Math.PI * d / L);
          const x = p.x - c * d - s * off, y = p.y - s * d + c * off;
          if (d) ctx.lineTo(x, y); else ctx.moveTo(x, y);
        }
        ctx.stroke();
        glow(ctx, p.x, p.y, 5, p.color, real ? 0.3 : 0.8);
        break;
      }
      case 'neutron': {
        // no ioniza: sólo un "fantasma" de dónde podría estar
        const pul = 0.5 + 0.5 * Math.sin(t * 9 + p.phase);
        ctx.strokeStyle = rgba(p.color, (real ? 0.22 : 0.7) * (0.6 + 0.4 * pul));
        ctx.lineWidth = 2.5;
        ctx.setLineDash([5, 6]);
        ctx.beginPath(); ctx.arc(p.x, p.y, 15 + pul * 4, 0, TAU); ctx.stroke();
        ctx.setLineDash([]);
        glow(ctx, p.x, p.y, 4, p.color, real ? 0.25 : 0.6);
        break;
      }
    }
  }
  ctx.restore();
}

function drawShield(ctx, pl, t) {
  const W = World, m = MATERIALS[pl.mat];
  const a0 = pl.angle - pl.halfW, a1 = pl.angle + pl.halfW;
  const arc = (r, lw, style, dash) => {
    ctx.lineWidth = lw; ctx.strokeStyle = style;
    if (dash) ctx.setLineDash(dash);
    ctx.beginPath(); ctx.arc(W.cx, W.cy, r, a0, a1); ctx.stroke();
    if (dash) ctx.setLineDash([]);
  };
  ctx.save();
  ctx.lineCap = 'round';
  // halo con el color del botón del material
  arc(W.R, m.thick + 14 + pl.matFlash * 12, rgba(XBOX[m.btn], 0.22 + 0.4 * pl.matFlash + 0.3 * pl.flash));
  // cuerpo del material, con un borde para que se distinga en cualquier fondo
  ctx.lineCap = 'butt';
  arc(W.R, m.thick + 4, T.shieldEdge);
  if (m.id === 'agua') {
    arc(W.R, m.thick, rgba(m.fill, 0.75));
    ctx.lineDashOffset = -t * 30;
    arc(W.R - 3, 3, 'rgba(220,245,255,0.7)', [6, 10]);
    ctx.lineDashOffset = t * 20;
    arc(W.R + 4, 2, 'rgba(220,245,255,0.45)', [3, 14]);
    ctx.lineDashOffset = 0;
  } else {
    arc(W.R, m.thick, m.fill);
    if (m.id === 'papel') arc(W.R, m.thick - 2, 'rgba(150,130,90,0.45)', [2, 9]);
    else if (m.id === 'aluminio') { arc(W.R - m.thick * 0.22, 2.5, 'rgba(255,255,255,0.85)'); arc(W.R + m.thick * 0.3, 2, 'rgba(90,100,120,0.6)'); }
    else { arc(W.R + m.thick * 0.22, m.thick * 0.35, '#3b414f'); arc(W.R - m.thick * 0.3, 2, 'rgba(200,210,230,0.5)'); }
  }
  // borde exterior con el color del jugador
  ctx.lineCap = 'round';
  arc(W.R + m.thick / 2 + 5, 3.5, pl.color);
  // insignia: botón del material y número de jugador
  const c = Math.cos(pl.angle), s = Math.sin(pl.angle);
  const br = W.R + m.thick / 2 + 30;
  matGlyph(ctx, pl.kind, pl.mat, W.cx + c * br, W.cy + s * br, 16);
  txt(ctx, 'J' + (pl.slot + 1), W.cx + c * (br + 30), W.cy + s * (br + 30), {
    size: 20, weight: 900, align: 'center', base: 'middle', color: pl.color, stroke: T.outline, strokeW: 5,
  });
  ctx.restore();
}

// ─── HUD ───

function hudSide() { return World.W >= 1800 ? 400 : 330; }

function drawPlayerPanel(ctx, pl, x, y, w) {
  const m = MATERIALS[pl.mat];
  panel(ctx, x, y, w, 104, { stroke: rgba(pl.color, 0.5) });
  rrect(ctx, x, y, 8, 104, [16, 0, 0, 16]);
  ctx.fillStyle = pl.color; ctx.fill();
  txt(ctx, PLAYER_NAMES[pl.slot], x + 26, y + 30, { size: 17, weight: 800, color: pl.color });
  txt(ctx, fmt(pl.score), x + 26, y + 82, { size: 46, weight: 900, color: T.text });
  if (pl.combo >= 2) txt(ctx, `COMBO x${pl.combo}`, x + 26 + textW(ctx, fmt(pl.score), 46, 900) + 16, y + 80, { size: 18, weight: 800, color: T.gold });
  matGlyph(ctx, pl.kind, pl.mat, x + w - 40, y + 44, 22);
  txt(ctx, m.name.toUpperCase(), x + w - 40, y + 88, { size: 15, weight: 800, align: 'center', color: T.soft });
}

function drawJoinPanel(ctx, x, y, w, t) {
  panel(ctx, x, y, w, 104, { stroke: 'rgba(255,79,216,0.35)', fill: T.panel });
  const a = 0.55 + 0.45 * Math.sin(t * 4);
  txt(ctx, '¿JUEGAN DOS?', x + w / 2, y + 34, { size: 17, weight: 800, align: 'center', color: PLAYER_COLORS[1], alpha: a });
  const kb = Game.players.some(p => p.kind === 'kbm') ? { key: 'Z' } : { key: 'Clic' };
  richLine(ctx, ['Únete con', { btn: 'A' }, 'o', kb], x + w / 2, y + 70, 24, { align: 'center', alpha: a });
}

function drawHUD(ctx, G, t) {
  const W = World, side = hudSide();
  // jugadores
  if (G.players[0]) drawPlayerPanel(ctx, G.players[0], 24, 20, side);
  if (G.players[1]) drawPlayerPanel(ctx, G.players[1], W.W - 24 - side, 20, side);
  else drawJoinPanel(ctx, W.W - 24 - side, 20, side, t);
  // oleada
  const wave = WAVES[G.waveIdx];
  if (wave) {
    txt(ctx, `OLEADA ${G.waveIdx + 1} DE ${WAVES.length}`, W.W / 2, 42, { size: 17, weight: 800, align: 'center', color: T.muted });
    txt(ctx, wave.title, W.W / 2, 80, { size: 32, weight: 800, align: 'center', color: T.text });
    const bw = 300, prog = clamp(G.waveT / wave.duration, 0, 1);
    rrect(ctx, W.W / 2 - bw / 2, 94, bw, 6, 3); ctx.fillStyle = T.track; ctx.fill();
    rrect(ctx, W.W / 2 - bw / 2, 94, bw * prog, 6, 3); ctx.fillStyle = T.info; ctx.fill();
  }
  const by = W.H - 24 - 86;
  // integridad del ADN
  const h = G.dna / 100, col = h > 0.6 ? T.good : h > 0.3 ? T.gold : T.bad;
  const blink = h <= 0.3 ? 0.6 + 0.4 * Math.sin(t * 10) : 1;
  panel(ctx, 24, by, side, 86, { stroke: rgba(col, 0.4) });
  txt(ctx, 'INTEGRIDAD DEL ADN', 44, by + 30, { size: 16, weight: 800, color: T.muted });
  txt(ctx, `${Math.ceil(G.dna)}%`, 24 + side - 20, by + 32, { size: 24, weight: 900, align: 'right', color: col, alpha: blink });
  rrect(ctx, 44, by + 48, side - 40, 20, 10); ctx.fillStyle = T.track; ctx.fill();
  if (h > 0) { rrect(ctx, 44, by + 48, (side - 40) * h, 20, 10); ctx.fillStyle = col; ctx.fill(); }
  // contador Geiger
  const gx = W.W - 24 - side;
  panel(ctx, gx, by, side, 86);
  txt(ctx, 'CONTADOR GEIGER', gx + 20, by + 30, { size: 16, weight: 800, color: T.muted });
  ctx.beginPath(); ctx.arc(gx + side - 30, by + 24, 8, 0, TAU);
  ctx.fillStyle = G.geigerLed > 0 ? `rgba(255,90,70,${0.3 + 0.7 * G.geigerLed})` : 'rgba(255,90,70,0.2)'; ctx.fill();
  txt(ctx, `${Math.round(G.geiger)}`, gx + 20, by + 74, { size: 34, weight: 900, color: T.text });
  txt(ctx, 'cuentas/s', gx + 22 + textW(ctx, `${Math.round(G.geiger)}`, 34, 900), by + 72, { size: 16, weight: 700, color: T.muted });
  const segs = 12, sx = gx + side - 20 - segs * 13, lit = Math.round(clamp(G.geiger / 30, 0, 1) * segs);
  for (let i = 0; i < segs; i++) {
    rrect(ctx, sx + i * 13, by + 52, 9, 20, 2);
    ctx.fillStyle = i < lit ? (i < 7 ? T.good : i < 10 ? T.gold : T.bad) : T.track;
    ctx.fill();
  }
  drawLegend(ctx, W.W / 2, W.H - 24 - 35, G.kinds());
}

// Leyenda: qué botón es qué material y qué radiación frena
function drawLegend(ctx, cx, cy, kinds) {
  const W = World, side = hudSide();
  const itemW = Math.min(205, (W.W - 2 * (side + 48)) / 4), tot = itemW * 4;
  panel(ctx, cx - tot / 2, cy - 35, tot, 70, { fill: T.panel });
  const types = ['alpha', 'beta', 'gamma', 'neutron'];
  MATERIALS.forEach((m, i) => {
    const x = cx - tot / 2 + i * itemW;
    const small = itemW < 195, two = kinds.length > 1;
    const r = two ? (small ? 13 : 15) : small ? 16 : 18;
    let gx = x + (small ? 10 : 14);
    for (const k of kinds) { matGlyph(ctx, k, i, gx + r, cy, r); gx += r * 2 + 5; }
    txt(ctx, m.name, gx + 3, cy, { size: small || two ? 17 : 21, weight: 800, base: 'middle', color: T.text });
    const ty = PTYPES[types[i]];
    txt(ctx, ty.sym, x + itemW - (small ? 16 : 22), cy + 1, { size: small ? 24 : 28, weight: 800, align: 'center', base: 'middle', color: ty.color });
    if (i) { ctx.fillStyle = T.track; ctx.fillRect(x, cy - 22, 1.5, 44); }
  });
}

function drawToast(ctx, toast) {
  if (!toast) return;
  const W = World, side = hudSide();
  const a = clamp(toast.t / 0.3, 0, 1) * clamp((toast.dur - toast.t) / 0.4, 0, 1);
  const kind = { ojo: ['¡OJO!', T.warn], bien: ['¡BIEN!', T.good], dato: ['DATO', T.info] }[toast.kind] || ['DATO', T.info];
  const kc = kind[1], k = Touch.on ? 1.25 : 1, fs = 23 * k, lh = 30 * k, pad = 140 * k;
  // en el celular, entre las dos columnas de botones
  const maxW = Touch.on ? W.W - 2 * (Touch.COL + 20) : Math.min(1150, W.W - 2 * (side + 48));
  const lines = wrap(ctx, toast.text, maxW - pad, fs, 600);
  const tw = Math.max(...lines.map(l => textW(ctx, l, fs, 600)));
  const w = Math.min(maxW, tw + pad), h = 22 * k + lines.length * lh;
  const x = W.W / 2 - w / 2;
  // abajo, salvo que tape una fuente; entonces arriba
  const covers = yy => World.sources.some(s => Math.abs(s.x - W.W / 2) < w / 2 + 60 && s.y + (Touch.on ? 100 : 40) > yy && s.y - 60 < yy + h);
  let y = Touch.on ? W.H - 20 - h : W.H - 24 - 70 - 14 - h;
  const top = Touch.on ? 76 : 118;
  if (covers(y) && !(Touch.on && covers(top))) y = top;
  ctx.save();
  ctx.globalAlpha = a;
  panel(ctx, x, y, w, h, { fill: T.panelStrong, stroke: rgba(kc, 0.65), r: 22 });
  rrect(ctx, x + 12, y + h / 2 - 16 * k, 90 * k, 32 * k, 16 * k); ctx.fillStyle = kc; ctx.fill();
  txt(ctx, kind[0], x + 12 + 45 * k, y + h / 2 + 1, { size: 17 * k, weight: 900, align: 'center', base: 'middle', color: '#08111f' });
  lines.forEach((l, i) => txt(ctx, l, x + 118 * k, y + 11 * k + lh / 2 + i * lh, { size: fs, weight: 600, base: 'middle', color: T.text }));
  ctx.restore();
}

function drawBanner(ctx, b) {
  if (!b) return;
  const W = World, a = clamp(b.t / 0.3, 0, 1) * clamp((b.dur - b.t) / 0.5, 0, 1);
  ctx.save();
  ctx.globalAlpha = a;
  const g = ctx.createLinearGradient(0, 0, W.W, 0);
  g.addColorStop(0, `rgba(${T.band},0)`); g.addColorStop(0.3, `rgba(${T.band},0.85)`);
  g.addColorStop(0.7, `rgba(${T.band},0.85)`); g.addColorStop(1, `rgba(${T.band},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, W.cy - 95, W.W, 190);
  const s = 0.85 + 0.15 * easeOutBack(clamp(b.t / 0.4, 0, 1));
  txt(ctx, b.text, W.W / 2, W.cy - 18, { size: 74 * s, weight: 900, align: 'center', color: b.color || T.text, glow: b.color || T.glow, blur: 24 });
  if (b.sub) txt(ctx, b.sub, W.W / 2, W.cy + 38, { size: Touch.on ? 38 : 34, weight: 800, align: 'center', color: T.soft });
  if (b.hint) txt(ctx, b.hint, W.W / 2, W.cy + (Touch.on ? 84 : 78), { size: Touch.on ? 30 : 24, weight: Touch.on ? 700 : 600, align: 'center', color: T.gold });
  ctx.restore();
}

// ─── Trazas de muestra (para las tarjetas y la pantalla de título) ───

const SampleTracks = {
  cache: {},
  get(type) {
    if (this.cache[type]) return this.cache[type];
    const rnd = seeded({ alpha: 11, beta: 23, gamma: 37, neutron: 41, muon: 53 }[type] || 7);
    const r = (a, b) => a + rnd() * (b - a);
    const pts = [], W = 480, H = 170;
    if (type === 'alpha') {
      // dos alfas que salen de la misma fuente
      for (const [dir, L] of [[-0.22, 330], [0.18, 290]]) {
        for (let s = 0; s < L; s += 2.2) {
          const e = 1 - s / L;
          pts.push({ x: 40 + Math.cos(dir) * s + (rnd() - 0.5) * 3, y: 90 + Math.sin(dir) * s + (rnd() - 0.5) * 4, r: 2.3 + 3.2 * (1 - e) });
        }
      }
    } else if (type === 'beta') {
      // camino en zigzag: muchos rebotes pequeños y algunos bruscos
      let x = 20, y = 85, dir = 0, w = 0;
      while (x < W - 20 && pts.length < 260) {
        w = w * 0.8 + (rnd() - 0.5) * 0.7;
        dir += w * 0.45;
        if (rnd() < 0.07) dir += (rnd() < 0.5 ? -1 : 1) * r(0.5, 0.9);
        dir = clamp(dir + (85 - y) * 0.004, -1.2, 1.2);
        x += Math.cos(dir) * 5; y += Math.sin(dir) * 5;
        pts.push({ x, y, r: r(1.3, 2.1) });
      }
    } else if (type === 'gamma') {
      for (let x = 20; x < W - 20; x += 4) {
        pts.push({ x, y: 85, r: 0.8, a: 0.12 });
        for (const ex of [90, 200, 310, 410]) {
          if (x > ex || x + 4 <= ex) continue;
          let px = ex, py = 85, dir = (rnd() < 0.5 ? -1 : 1) * r(0.5, 1.1), w = 0;
          const L = r(55, 85);
          for (let s = 0; s < L; s += 5) {
            w = w * 0.8 + (rnd() - 0.5) * 0.9; dir += w * 0.5;
            px += Math.cos(dir) * 5; py += Math.sin(dir) * 5;
            pts.push({ x: px, y: py, r: r(1.1, 1.7) });
          }
        }
      }
    } else if (type === 'neutron') {
      const hits = [[30, 95], [130, 75], [235, 112], [335, 68], [440, 102]];
      for (let h = 1; h < hits.length; h++) {
        const [x0, y0] = hits[h - 1], [x1, y1] = hits[h];
        for (let k = 0; k < 1; k += 0.08) pts.push({ x: lerp(x0, x1, k), y: lerp(y0, y1, k), r: 0.8, a: 0.12 });
        const d = r(-1.5, 1.5), L = r(24, 36);
        for (let s = 0; s < L; s += 1.8) pts.push({ x: x1 + Math.cos(d) * s + (rnd() - 0.5) * 2, y: y1 + Math.sin(d) * s, r: r(2.4, 3.4) });
      }
    } else {
      for (let x = 0; x < W; x += 5) pts.push({ x, y: 30 + x * 0.22 + (rnd() - 0.5), r: r(1, 1.5) });
    }
    return (this.cache[type] = { pts, W, H });
  },
};

function drawSample(ctx, type, x, y, w, h, prog, white) {
  const S = SampleTracks.get(type);
  const sc = Math.min(w / S.W, h / S.H);
  const ox = x + (w - S.W * sc) / 2, oy = y + (h - S.H * sc) / 2;
  const spr = Sprites.glow(white ? T.real : PTYPES[type].color);
  const n = Math.floor(S.pts.length * clamp(prog, 0, 1));
  ctx.save();
  ctx.globalCompositeOperation = T.blend;
  const dsc = Math.max(sc, 0.85); // las gotitas no se encogen tanto como el dibujo
  for (let i = 0; i < n; i++) {
    const p = S.pts[i], s = p.r * 2.2 * dsc;
    ctx.globalAlpha = p.a ?? 0.7;
    ctx.drawImage(spr, ox + p.x * sc - s, oy + p.y * sc - s, s * 2, s * 2);
  }
  ctx.restore();
}

// ─── Diagrama clásico de penetración: qué material frena a cada radiación ───

function drawPenetration(ctx, x, y, w, h, types, t, kind = 'pad') {
  const head = 62, rowH = (h - head) / types.length;
  const ax0 = x + 74, avail = x + w - ax0 - 8;
  const slabs = [{ w: 6, f: 0.22 }, { w: 16, f: 0.44 }, { w: 28, f: 0.66 }, { w: 46, f: 0.88 }];
  slabs.forEach((sl, i) => {
    sl.x = ax0 + avail * sl.f;
    const m = MATERIALS[i];
    matGlyph(ctx, kind, i, sl.x, y + 16, 14);
    txt(ctx, m.name, sl.x, y + 50, { size: 17, weight: 800, align: 'center', color: T.soft });
    rrect(ctx, sl.x - sl.w / 2, y + head, sl.w, h - head, 4);
    ctx.fillStyle = m.id === 'agua' ? rgba(m.fill, 0.5) : m.fill;
    ctx.fill();
    ctx.lineWidth = 1.5; ctx.strokeStyle = T.shieldEdge; ctx.stroke();
  });
  types.forEach((ty, i) => {
    const cy = y + head + rowH * (i + 0.5), col = PTYPES[ty].color;
    symbolCircle(ctx, ty, x + 26, cy, Math.min(20, rowH * 0.36));
    const si = { alpha: 0, beta: 1, gamma: 2, neutron: 3 }[ty], sl = slabs[si];
    const endX = ty === 'neutron' ? sl.x : sl.x - sl.w / 2;
    const yAt = xx => ty === 'beta' ? cy + Math.sin(xx * 0.09) * 6 + Math.sin(xx * 0.23) * 3
      : ty === 'gamma' ? cy + Math.sin(xx * 0.5) * 3 : cy;
    ctx.save();
    ctx.strokeStyle = col;
    ctx.lineWidth = ty === 'alpha' ? 7 : 3;
    if (ty === 'neutron') ctx.setLineDash([6, 6]);
    ctx.beginPath();
    for (let xx = ax0; xx <= endX; xx += 3) { if (xx === ax0) ctx.moveTo(xx, yAt(xx)); else ctx.lineTo(xx, yAt(xx)); }
    ctx.stroke();
    ctx.setLineDash([]);
    if (ty === 'gamma') { // unos pocos atraviesan el plomo
      ctx.globalAlpha = 0.3; ctx.lineWidth = 2;
      ctx.beginPath();
      for (let xx = sl.x + sl.w / 2; xx <= x + w - 4; xx += 3) { if (xx === sl.x + sl.w / 2) ctx.moveTo(xx, yAt(xx)); else ctx.lineTo(xx, yAt(xx)); }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.globalCompositeOperation = T.blend;
    glow(ctx, endX, cy, 10, col, 0.9);
    const k = (t * 0.45 + i * 0.27) % 1, px = lerp(ax0, endX, k);
    glow(ctx, px, yAt(px), 7, col, 1);
    ctx.restore();
  });
}

// ─── Animación: cómo la radiación ioniza un átomo y se forma una gotita ───

function drawIonization(ctx, x, y, w, h, t) {
  const P = 4.2, u = (t % P) / P, S = 1.55;
  const ax = x + w * 0.5, ay = y + (h - 80) * 0.5;
  const hitU = 0.32;
  const col = PTYPES.alpha.color;
  // partícula alfa que pasa cerca del átomo
  const px = lerp(x + 40, x + w - 40, clamp(u / 0.7, 0, 1)), py = ay - 70 * S;
  ctx.save();
  ctx.globalCompositeOperation = T.blend;
  for (let xx = x + 40; xx < px; xx += 3) glow(ctx, xx, py + Math.sin(xx) * 1.5, 3, col, 0.35);
  if (u < 0.7) glow(ctx, px, py, 12, col, 1);
  ctx.restore();
  if (u < 0.7) txt(ctx, 'α', px, py - 22, { size: 24, weight: 800, align: 'center', color: col });
  // núcleo del átomo
  for (let i = 0; i < 6; i++) {
    const a = i * TAU / 6;
    ctx.beginPath(); ctx.arc(ax + Math.cos(a) * 6 * S, ay + Math.sin(a) * 6 * S, 6 * S, 0, TAU);
    ctx.fillStyle = i % 2 ? '#ff7a5c' : '#9aa7ff'; ctx.fill();
  }
  // órbitas y electrones
  const orbits = [[44, 18, 0.4], [44, 18, -0.6], [62, 26, 1.4]];
  orbits.forEach(([rx, ry, rot], i) => {
    ctx.save();
    ctx.translate(ax, ay); ctx.rotate(rot);
    ctx.strokeStyle = T.ring; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(0, 0, rx * S, ry * S, 0, 0, TAU); ctx.stroke();
    if (!(i === 2 && u > hitU)) {
      const a = t * (2 + i) + i;
      ctx.globalCompositeOperation = T.blend;
      glow(ctx, Math.cos(a) * rx * S, Math.sin(a) * ry * S, 7, T.info, 1);
    }
    ctx.restore();
  });
  txt(ctx, 'átomo', ax - 112 * S, ay + 4, { size: 20, weight: 700, align: 'center', color: T.muted, alpha: u < hitU ? 1 : 0.3 });
  if (u > hitU) {
    // el electrón sale disparado y el átomo queda como ion positivo
    const k = (u - hitU) / (1 - hitU);
    const ex = ax + 50 * S + k * w * 0.28, ey = ay - 22 * S + k * 18;
    ctx.save(); ctx.globalCompositeOperation = T.blend;
    glow(ctx, ex, ey, 8, T.info, 1 - k * 0.4);
    ctx.restore();
    txt(ctx, 'e⁻ libre', ex + 14, ey - 10, { size: 22, weight: 800, color: T.info, alpha: 1 - k * 0.4 });
    txt(ctx, '+', ax - 30 * S, ay + 48 * S, { size: 40, weight: 900, color: T.gold });
    txt(ctx, 'ion', ax - 30 * S + 28, ay + 48 * S, { size: 20, weight: 800, color: T.gold });
  }
  // la gotita se forma sobre el ion
  if (u > 0.55) {
    const k = clamp((u - 0.55) / 0.3, 0, 1);
    ctx.beginPath(); ctx.arc(ax, ay, 72 * S * easeOut(k), 0, TAU);
    ctx.fillStyle = `rgba(${T.drop},${0.12 * k})`; ctx.fill();
    ctx.strokeStyle = `rgba(${T.drop},${0.5 * k})`; ctx.lineWidth = 2; ctx.stroke();
    txt(ctx, 'gotita de niebla', ax - 80 * S, ay - 40 * S, { size: 20, weight: 700, align: 'right', color: T.soft, alpha: k });
  }
  const lines = [
    'La radiación arranca electrones de los átomos: eso es IONIZAR.',
    'En la cámara de niebla, cada ion se vuelve una gotita... ¡y así vemos su camino!',
  ];
  lines.forEach((l, i) => txt(ctx, l, x + w / 2, y + h - 52 + i * 34, { size: 24, weight: 600, align: 'center', color: T.soft }));
}

// ─── Cómo se juega ───

function drawHowTo(ctx, x, y, w, h, t) {
  const cy = y + h * 0.42, col = w / 3;
  if (Touch.on) { drawHowToTouch(ctx, x, y, w, h, t, cy, col); return; }
  // stick
  const sx = x + col * 0.5;
  ctx.beginPath(); ctx.arc(sx, cy, 52, 0, TAU);
  ctx.fillStyle = '#1b2638'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#5b6f8f'; ctx.stroke();
  // el stick va a la izquierda y a la derecha, y el escudo gira con él
  const sw = Math.sin(t * 1.4), a = -Math.PI / 2 + Math.sin(t * 1.4 - 1.2) * 1.4;
  ctx.beginPath(); ctx.arc(sx + sw * 18, cy, 28, 0, TAU);
  ctx.fillStyle = '#3a4a66'; ctx.fill(); ctx.strokeStyle = '#8aa2c8'; ctx.stroke();
  txt(ctx, '←', sx - 72, cy, { size: 30, weight: 900, align: 'center', base: 'middle', color: sw < -0.3 ? T.gold : '#5b6f8f' });
  txt(ctx, '→', sx + 72, cy, { size: 30, weight: 900, align: 'center', base: 'middle', color: sw > 0.3 ? T.gold : '#5b6f8f' });
  ctx.strokeStyle = PLAYER_COLORS[0]; ctx.lineWidth = 8; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(sx, cy, 96, a - 0.45, a + 0.45); ctx.stroke(); ctx.lineCap = 'butt';
  txt(ctx, 'Gira tu escudo', sx, y + h - 50, { size: 26, weight: 800, align: 'center' });
  txt(ctx, 'stick o flechas ← →, o el ratón', sx, y + h - 20, { size: 22, weight: 600, align: 'center', color: T.soft });
  // botones
  const bx = x + col * 1.5, d = 50;
  const pos = { Y: [0, -d], X: [-d, 0], B: [d, 0], A: [0, d] };
  const mat = { A: 0, B: 1, X: 2, Y: 3 };
  const ty = ['alpha', 'beta', 'gamma', 'neutron'];
  for (const L of ['Y', 'X', 'B', 'A']) {
    const [dx, dy] = pos[L], m = MATERIALS[mat[L]], p = PTYPES[ty[mat[L]]];
    btn(ctx, L, bx + dx, cy + dy, 22);
    const lx = bx + dx * 1.6 + (dx ? Math.sign(dx) * 18 : 0), ly = cy + dy * 1.0 + (dy ? Math.sign(dy) * 2 : 0);
    const al = dx < 0 ? 'right' : dx > 0 ? 'left' : 'center';
    const oy = dy < 0 ? -34 : dy > 0 ? 40 : 6;
    txt(ctx, `${m.name} ${p.sym}`, dx ? lx : bx, dy ? ly + oy : ly + 6, { size: 19, weight: 800, align: al, color: p.color });
  }
  txt(ctx, 'Elige el material', bx, y + h - 50, { size: 26, weight: 800, align: 'center' });
  txt(ctx, 'A B X Y  o  teclas 1 2 3 4', bx, y + h - 20, { size: 22, weight: 600, align: 'center', color: T.soft });
  // célula
  const cx = x + col * 2.5;
  ctx.beginPath(); ctx.arc(cx, cy, 50, 0, TAU);
  ctx.fillStyle = rgba(T.memb, 0.15); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = T.memb; ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, 22, 0, TAU);
  ctx.fillStyle = rgba(T.nucleus, 0.3); ctx.fill(); ctx.strokeStyle = T.nucleus; ctx.lineWidth = 2; ctx.stroke();
  for (let i = 0; i < 7; i++) {
    const xx = cx - 15 + i * 5, yy = Math.sin(i + t * 2) * 7;
    ctx.strokeStyle = i % 2 ? T.rungA : T.info;
    ctx.beginPath(); ctx.moveTo(xx, cy + yy); ctx.lineTo(xx, cy - yy); ctx.stroke();
  }
  txt(ctx, 'Protege el ADN', cx, y + h - 50, { size: 26, weight: 800, align: 'center' });
  txt(ctx, 'de la célula', cx, y + h - 20, { size: 22, weight: 600, align: 'center', color: T.soft });
}

// Cómo se juega en el celular: flechas a la izquierda y botones de material a la derecha
function drawHowToTouch(ctx, x, y, w, h, t, cy, col) {
  const pc = PLAYER_COLORS[0];
  // flechas: se ilumina la que se está "apretando" y el escudo gira hacia ese lado
  const sx = x + col * 0.5, sw = Math.sin(t * 1.4), a = -Math.PI / 2 + Math.sin(t * 1.4 - 1.2) * 1.4;
  for (const v of [-1, 1]) {
    const on = v * sw > 0.3, bx = sx + v * 50 - 42, by = cy - 52;
    panel(ctx, bx, by, 84, 104, { r: 18, fill: on ? rgba(pc, 0.35) : T.panelStrong, stroke: on ? pc : T.panelStroke, lw: on ? 3 : 2 });
    Touch.arrow(ctx, bx + 42, by + 52, 24, v, on ? pc : T.text);
  }
  ctx.strokeStyle = pc; ctx.lineWidth = 8; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(sx, cy, 124, a - 0.4, a + 0.4); ctx.stroke(); ctx.lineCap = 'butt';
  txt(ctx, 'Gira tu escudo', sx, y + h - 50, { size: 26, weight: 800, align: 'center' });
  txt(ctx, 'mantén las flechas de la izquierda', sx, y + h - 20, { size: 22, weight: 600, align: 'center', color: T.soft });
  // botones de material
  const bx = x + col * 1.5, cw = 112, ch = 66, gap = 8;
  const ty = ['alpha', 'beta', 'gamma', 'neutron'];
  MATERIALS.forEach((m, i) => {
    const px = bx - cw - gap / 2 + (i % 2) * (cw + gap), py = cy - ch - gap / 2 + (i >> 1) * (ch + gap);
    const sel = Math.floor(t / 1.5) % 4 === i;
    panel(ctx, px, py, cw, ch, { r: 12, fill: rgba(XBOX[m.btn], sel ? 0.9 : 0.25), stroke: sel ? pc : rgba(XBOX[m.btn], 0.8), lw: sel ? 4 : 2 });
    const tc = sel ? (m.btn === 'Y' ? '#2a2200' : '#ffffff') : T.text;
    txt(ctx, m.name, px + cw / 2, py + 26, { size: 19, weight: 900, align: 'center', base: 'middle', color: tc });
    txt(ctx, PTYPES[ty[i]].sym, px + cw / 2, py + 50, { size: 20, weight: 900, align: 'center', base: 'middle', color: PTYPES[ty[i]].color, stroke: T.outline, strokeW: 4 });
  });
  txt(ctx, 'Elige el material', bx, y + h - 50, { size: 26, weight: 800, align: 'center' });
  txt(ctx, 'con los botones de la derecha', bx, y + h - 20, { size: 22, weight: 600, align: 'center', color: T.soft });
  // célula
  const cx = x + col * 2.5;
  ctx.beginPath(); ctx.arc(cx, cy, 50, 0, TAU);
  ctx.fillStyle = rgba(T.memb, 0.15); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = T.memb; ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, 22, 0, TAU);
  ctx.fillStyle = rgba(T.nucleus, 0.3); ctx.fill(); ctx.strokeStyle = T.nucleus; ctx.lineWidth = 2; ctx.stroke();
  for (let i = 0; i < 7; i++) {
    const xx = cx - 15 + i * 5, yy = Math.sin(i + t * 2) * 7;
    ctx.strokeStyle = i % 2 ? T.rungA : T.info;
    ctx.beginPath(); ctx.moveTo(xx, cy + yy); ctx.lineTo(xx, cy - yy); ctx.stroke();
  }
  txt(ctx, 'Protege el ADN', cx, y + h - 50, { size: 26, weight: 800, align: 'center' });
  txt(ctx, 'de la célula', cx, y + h - 20, { size: 22, weight: 600, align: 'center', color: T.soft });
}

// ─── Tarjeta educativa ───

function drawCard(ctx, card) {
  const W = World, c = CARDS[card.id];
  const appear = clamp(card.t / 0.45, 0, 1);
  ctx.save();
  ctx.fillStyle = `rgba(${T.dim},${0.72 * appear})`;
  ctx.fillRect(-40, -40, W.W + 80, W.H + 80);
  const w = Math.min(1260, W.W - 80), h = 760, x = (W.W - w) / 2, y = (W.H - h) / 2;
  ctx.globalAlpha = appear;
  ctx.translate(W.W / 2, W.H / 2);
  const s = 0.9 + 0.1 * easeOutBack(appear);
  ctx.scale(s, s);
  ctx.translate(-W.W / 2, -W.H / 2);
  const col = c.type ? PTYPES[c.type].color : T.real;
  panel(ctx, x, y, w, h, { stroke: rgba(col, 0.6), lw: 3, r: 26, fill: T.card });
  // encabezado
  ctx.beginPath(); ctx.arc(x + 120, y + 118, 76, 0, TAU);
  ctx.fillStyle = rgba(col, 0.14); ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = col; ctx.stroke();
  txt(ctx, c.sym, x + 120, y + 122, { size: 92, weight: 800, align: 'center', base: 'middle', color: col, glow: col, blur: 20 });
  txt(ctx, c.kicker, x + 230, y + 92, { size: 20, weight: 800, color: T.muted });
  txt(ctx, c.title, x + 230, y + 152, { size: 56, weight: 900, color: T.text });
  c.lines.forEach((l, i) => txt(ctx, l, x + 60, y + 252 + i * 42, { size: 27, weight: 600, color: T.soft }));
  const by = y + 260 + c.lines.length * 42;
  const bh = h - (by - y) - 110;
  if (c.type) {
    // muestra de la traza y diagrama de penetración
    const bw = (w - 160) / 2;
    panel(ctx, x + 60, by, bw, bh, { fill: T.sample });
    txt(ctx, 'Así se ve en la cámara de niebla:', x + 80, by + 32, { size: 19, weight: 700, color: T.muted });
    drawSample(ctx, c.type, x + 70, by + 44, bw - 20, bh - 54, card.t / 2.2, false);
    drawPenetration(ctx, x + 100 + bw, by + 4, bw - 20, bh - 8, [c.type], card.t, Game.kinds()[0]);
    // instrucción principal
    const kinds = Game.kinds(), mi = MATERIALS.findIndex(m => m.btn === c.btn);
    let gx = x + 90;
    for (const k of kinds) { matGlyph(ctx, k, mi, gx, y + h - 58, 28); gx += 64; }
    txt(ctx, c.stop, gx - 20, y + h - 56, { size: kinds.length > 1 ? 27 : 31, weight: 800, base: 'middle', color: T.text });
  } else {
    // visión real: las cuatro trazas en blanco
    const types = ['alpha', 'beta', 'gamma', 'neutron'];
    const labels = ['gruesa y corta', 'delgada en zigzag', 'electrones sueltos', 'golpes sin traza'];
    const bw = (w - 120 - 3 * 20) / 4, boxH = h - (by - y) - 100;
    types.forEach((ty, i) => {
      const bx = x + 60 + i * (bw + 20);
      panel(ctx, bx, by, bw, boxH, { fill: T.sample });
      drawSample(ctx, ty, bx + 6, by + 6, bw - 12, boxH - 62, card.t / 2.2 - i * 0.15, true);
      symbolCircle(ctx, ty, bx + 32, by + boxH - 30, 19);
      txt(ctx, labels[i], bx + 60, by + boxH - 28, { size: 19, weight: 700, base: 'middle', color: T.soft });
    });
    txt(ctx, c.stop, x + 60, y + h - 56, { size: 28, weight: 800, base: 'middle', color: T.text });
  }
  // continuar
  const ready = card.t > 1.4;
  const k = clamp(card.t / card.auto, 0, 1);
  richLine(ctx, okLine(Game.kinds(), 'Continuar'), x + w - 40, y + h - 58, 26,
    { align: 'right', alpha: ready ? 0.6 + 0.4 * Math.sin(card.t * 5) : 0.3 });
  // tiempo restante antes de continuar solo
  rrect(ctx, x + 40, y + h - 14, (w - 80) * (1 - k), 4, 2);
  ctx.fillStyle = T.track; ctx.fill();
  ctx.restore();
}

// ─── Pantalla de título ───

// Panel informativo que va cambiando (cómo se juega, cómo vemos lo invisible, qué frena a cada radiación)
function drawInfoPanel(ctx, G, t, px, py, pw, ph) {
  const cx = px + pw / 2;
  panel(ctx, px, py, pw, ph, { fill: T.panel });
  const fadeA = clamp(G.panelT / 0.4, 0, 1) * clamp((G.panelDur - G.panelT) / 0.4, 0, 1);
  ctx.save();
  ctx.globalAlpha = fadeA;
  const titles = ['¿CÓMO SE JUEGA?', '¿CÓMO VEMOS LO INVISIBLE?', '¿QUÉ FRENA A CADA RADIACIÓN?'];
  txt(ctx, titles[G.panel], cx, py + 46, { size: 28, weight: 900, align: 'center', color: T.gold });
  if (G.panel === 0) drawHowTo(ctx, px, py + 66, pw, ph - 86, t);
  else if (G.panel === 1) drawIonization(ctx, px, py + 60, pw, ph - 70, G.panelT);
  else drawPenetration(ctx, px + 70, py + 62, pw - 140, ph - 80, ['alpha', 'beta', 'gamma', 'neutron'], t, Touch.on ? 'touch' : 'pad');
  ctx.restore();
  for (let i = 0; i < 3; i++) {
    ctx.beginPath(); ctx.arc(cx - 20 + i * 20, py + ph - 14, 4, 0, TAU);
    ctx.fillStyle = i === G.panel ? T.gold : T.track; ctx.fill();
  }
}

function drawTitle(ctx, G, t) {
  if (Touch.on) { Touch.drawTitle(ctx, G, t); return; }
  const W = World, cx = W.W / 2;
  txt(ctx, 'CAZADORES', cx, 178, { size: 122, weight: 900, align: 'center', color: T.title, glow: T.glow, blur: 34 });
  txt(ctx, 'DE LO INVISIBLE', cx, 262, { size: 64, weight: 800, align: 'center', color: T.title2, glow: T.glow, blur: 20 });
  txt(ctx, 'Descubre cómo interactúa la radiación ionizante con la materia', cx, 318, { size: 28, weight: 500, align: 'center', color: T.soft });
  // panel informativo que va cambiando
  const pw = Math.min(1120, W.W - 120), ph = 390, px = cx - pw / 2, py = 352;
  drawInfoPanel(ctx, G, t, px, py, pw, ph);
  // lugares para jugadores
  const sw = 440, sh = 116, gap = 40, sy = 770;
  for (let i = 0; i < 2; i++) {
    const sx = cx - sw - gap / 2 + i * (sw + gap), id = G.lobby[i], col = PLAYER_COLORS[i];
    panel(ctx, sx, sy, sw, sh, { stroke: id ? col : T.panelStroke, lw: id ? 3 : 2, fill: id ? rgba(col, 0.12) : T.panel });
    txt(ctx, PLAYER_NAMES[i], sx + 26, sy + 36, { size: 19, weight: 900, color: col });
    if (id) {
      txt(ctx, '¡LISTO!', sx + 26, sy + 90, { size: 44, weight: 900, color: T.text });
      txt(ctx, Input.get(id)?.name || '', sx + sw - 22, sy + 36, { size: 15, weight: 700, align: 'right', color: T.muted });
    } else {
      const a = 0.55 + 0.45 * Math.sin(t * 4 + i);
      richLine(ctx, ['Presiona', { btn: 'A' }, 'para jugar'], sx + sw / 2, sy + 68, 30, { align: 'center', alpha: a, weight: 800 });
      const kb = G.lobby.includes('kbm') ? ['Teclado:', { key: 'Z' }, '(gira con A / D)'] : ['Teclado y ratón:', { key: 'Clic' }, 'o', { key: 'Enter' }];
      richLine(ctx, kb, sx + sw / 2, sy + 100, 17, { align: 'center', color: T.muted, alpha: a });
    }
  }
  if (G.lobby.length) {
    const n = Math.max(1, Math.ceil(G.countdown));
    txt(ctx, `¡Comienza en ${n}!`, cx, sy + sh + 54, { size: 34, weight: 900, align: 'center', color: T.gold });
    const other = G.lobby.includes('kbm') ? { key: 'Z' } : { key: 'Clic' };
    if (G.lobby.length < 2) richLine(ctx, ['¿Juegan dos? El otro presiona', { btn: 'A' }, 'o', other], cx, sy + sh + 92, 22, { align: 'center', color: T.soft });
  }
  // pie de página
  txt(ctx, 'IFUNAM · Día de Puertas Abiertas', 36, W.H - 30, { size: 20, weight: 700, color: T.muted });
  if (G.record.score > 0) txt(ctx, `Récord de hoy: ${fmt(G.record.score)}`, W.W - 36, W.H - 30, { size: 20, weight: 800, align: 'right', color: T.gold });
  const pads = Input.padCount();
  txt(ctx, pads ? `Controles conectados: ${pads}` : 'Sin control de Xbox: ¡juega con teclado y ratón!', cx, W.H - 30, {
    size: 18, weight: 600, align: 'center', color: pads ? T.muted : T.warn,
  });
  if (!Sfx.running()) txt(ctx, 'Haz clic en la pantalla para activar el sonido', cx, W.H - 58, { size: 18, weight: 700, align: 'center', color: T.warn });
}

// ─── Resultados ───

function drawResults(ctx, G, t) {
  if (Touch.on) { Touch.drawResults(ctx, G, t); return; }
  const W = World, r = G.results, cx = W.W / 2;
  const a = clamp(r.t / 0.6, 0, 1);
  ctx.save();
  ctx.fillStyle = `rgba(${T.dim},${0.6 * a})`;
  ctx.fillRect(-40, -40, W.W + 80, W.H + 80);
  ctx.globalAlpha = a;
  txt(ctx, r.success ? '¡CÉLULA A SALVO!' : 'LA CÉLULA RECIBIÓ DEMASIADA RADIACIÓN', cx, 110, {
    size: r.success ? 72 : 52, weight: 900, align: 'center', color: r.success ? T.good : T.bad, glow: r.success ? T.good : T.bad, blur: 24,
  });
  txt(ctx, 'Rango:', cx, 172, { size: 26, weight: 700, align: 'center', color: T.muted });
  txt(ctx, r.rank, cx, 220, { size: 46, weight: 900, align: 'center', color: T.gold });
  // jugadores
  const n = r.players.length, cw = 480, ch = 290, gap = 36;
  const sx = cx - (n * cw + (n - 1) * gap) / 2, sy = 262;
  r.players.forEach((p, i) => {
    const x = sx + i * (cw + gap), col = PLAYER_COLORS[p.slot];
    panel(ctx, x, sy, cw, ch, { stroke: rgba(col, 0.6), lw: 3 });
    txt(ctx, PLAYER_NAMES[p.slot], x + 28, sy + 40, { size: 20, weight: 900, color: col });
    txt(ctx, fmt(p.final), x + 28, sy + 104, { size: 58, weight: 900 });
    const rows = [
      ['Partículas cazadas', p.blocks],
      ['Con el material ideal', p.perfect],
      ['Se te escaparon', p.leaks],
      ['Mejor combo', 'x' + p.bestCombo],
    ];
    rows.forEach(([k, v], j) => {
      txt(ctx, k, x + 28, sy + 150 + j * 34, { size: 22, weight: 600, color: T.soft });
      txt(ctx, String(v), x + cw - 28, sy + 150 + j * 34, { size: 22, weight: 800, align: 'right' });
    });
  });
  txt(ctx, `ADN restante: ${r.dna}%  ·  bono de equipo +${fmt(r.dnaBonus)}`, cx, sy + ch + 44, { size: 26, weight: 800, align: 'center', color: T.good });
  if (r.newRecord) txt(ctx, '¡NUEVO RÉCORD DEL DÍA!', cx, sy + ch + 86, { size: 30, weight: 900, align: 'center', color: T.gold, alpha: 0.6 + 0.4 * Math.sin(t * 6) });
  // lo que aprendiste
  const pw = Math.min(1000, W.W - 120), ph = 290, px = cx - pw / 2, py = W.H - ph - 90;
  panel(ctx, px, py, pw, ph, { fill: T.panel });
  txt(ctx, 'LO QUE APRENDISTE', cx, py + 36, { size: 22, weight: 900, align: 'center', color: T.muted });
  drawPenetration(ctx, px + 50, py + 46, pw - 100, ph - 58, ['alpha', 'beta', 'gamma', 'neutron'], t, G.kinds()[0]);
  if (r.t > 3) richLine(ctx, okLine(G.kinds(), 'Volver al inicio'), cx, W.H - 44, 28, { align: 'center', alpha: 0.6 + 0.4 * Math.sin(t * 4) });
  ctx.restore();
}

function drawPause(ctx) {
  const W = World;
  ctx.fillStyle = `rgba(${T.dim},0.7)`;
  ctx.fillRect(-40, -40, W.W + 80, W.H + 80);
  txt(ctx, 'PAUSA', W.W / 2, W.H / 2 - 20, { size: 90, weight: 900, align: 'center' });
  txt(ctx, 'Start o P: continuar   ·   Mantén View o Backspace: salir', W.W / 2, W.H / 2 + 50, { size: 28, weight: 700, align: 'center', color: T.soft });
}

// Mira del ratón para quien apunta con él
function drawCrosshair(ctx, x, y, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(x, y, 13, 0, TAU); ctx.stroke();
  ctx.beginPath();
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { ctx.moveTo(x + dx * 7, y + dy * 7); ctx.lineTo(x + dx * 19, y + dy * 19); }
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(x, y, 2.5, 0, TAU); ctx.fill();
  ctx.restore();
}
