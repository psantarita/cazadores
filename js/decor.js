'use strict';
/* Fondo decorado y animado (al estilo de Super Hexagon): rayos de color que giran desde la célula,
   hexágonos que salen del centro como en un detector y laten con el bombo de la música,
   y símbolos de física flotando. Cada oleada tiene su propio color. */

const Decor = (() => {
  const RAYS = 12;
  const SYMBOLS = ['α', 'β', 'γ', 'n', 'μ', 'e⁻', 'p⁺', 'ν', 'E = mc²', '⁴He', '²⁴¹Am', '¹³⁷Cs', '⁶⁰Co', '⁹⁰Sr',
    'ħ', 'λ', 'atomo', 'atomo', 'trebol', 'hex'];
  let rot = 0, ringT = 0, pulse = 0, cur = null, doodles = [];

  const css = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

  function hexPath(ctx, x, y, r, a) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const t = a + i * TAU / 6;
      if (i) ctx.lineTo(x + Math.cos(t) * r, y + Math.sin(t) * r); else ctx.moveTo(x + Math.cos(t) * r, y + Math.sin(t) * r);
    }
    ctx.closePath();
  }

  function reset() {
    const W = World;
    doodles = SYMBOLS.map((kind, i) => ({
      kind, x: rand(0, W.W), y: rand(0, W.H), vx: rand(-14, 14), vy: rand(-10, 10),
      rot: rand(-0.4, 0.4), vr: rand(-0.25, 0.25), size: rand(30, 62), color: i % 4,
    }));
  }

  // key: 'titulo' o la radiación de la oleada ('alpha', 'beta', 'gamma', 'neutron', 'real')
  function update(dt, key, wave) {
    const target = (T.decor[key] || T.decor.titulo).map(hexRgb);
    if (!cur || cur.theme !== T) { cur = target.map(c => c.slice()); cur.theme = T; }
    const k = 1 - Math.exp(-dt * 2.2); // cambio de color suave entre oleadas
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) cur[i][j] += (target[i][j] - cur[i][j]) * k;
    rot += dt * (0.05 + 0.015 * wave);
    ringT += dt;
    pulse = Music.pulse();
    const W = World;
    if (!doodles.length) reset();
    for (const d of doodles) {
      d.x += d.vx * dt; d.y += d.vy * dt; d.rot += d.vr * dt;
      if (d.x < -90) d.x = W.W + 90; else if (d.x > W.W + 90) d.x = -90;
      if (d.y < -90) d.y = W.H + 90; else if (d.y > W.H + 90) d.y = -90;
    }
  }

  function drawDoodles(ctx) {
    const W = World, cols = [PTYPES.alpha.color, PTYPES.beta.color, PTYPES.gamma.color, PTYPES.neutron.color];
    const s = 1 + 0.06 * pulse;
    for (const d of doodles) {
      // se desvanecen cerca de la zona de juego para no confundirse con las partículas
      const a = T.doodleAlpha * clamp((Math.hypot(d.x - W.cx, d.y - W.cy) - W.R - 70) / 140, 0, 1);
      if (a <= 0.01) continue;
      const col = cols[d.color], r = d.size * 0.5;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(d.x, d.y);
      ctx.rotate(d.rot);
      ctx.scale(s, s);
      ctx.strokeStyle = col;
      ctx.fillStyle = col;
      ctx.lineWidth = 3;
      if (d.kind === 'atomo') {
        ctx.beginPath(); ctx.arc(0, 0, r * 0.22, 0, TAU); ctx.fill();
        for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.36, i * Math.PI / 3, 0, TAU); ctx.stroke(); }
      } else if (d.kind === 'trebol') {
        for (let i = 0; i < 3; i++) {
          const b = Math.PI / 2 + i * TAU / 3;
          ctx.beginPath();
          ctx.arc(0, 0, r, b - Math.PI / 6, b + Math.PI / 6);
          ctx.arc(0, 0, r * 0.32, b + Math.PI / 6, b - Math.PI / 6, true);
          ctx.closePath();
          ctx.fill();
        }
        ctx.beginPath(); ctx.arc(0, 0, r * 0.18, 0, TAU); ctx.fill();
      } else if (d.kind === 'hex') {
        hexPath(ctx, 0, 0, r, 0);
        ctx.stroke();
      } else {
        ctx.font = `800 ${d.size}px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(d.kind, 0, 0);
      }
      ctx.restore();
    }
  }

  function draw(ctx) {
    const W = World, cx = W.cx, cy = W.cy, big = Math.hypot(W.W, W.H);
    if (!cur) update(0, 'titulo', 0);
    ctx.fillStyle = css(cur[0]);
    ctx.fillRect(-40, -40, W.W + 80, W.H + 80);
    // rayos que giran desde la célula
    ctx.fillStyle = css(cur[1]);
    ctx.beginPath();
    for (let i = 0; i < RAYS; i += 2) {
      const a0 = rot + i * TAU / RAYS, a1 = a0 + TAU / RAYS;
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a0) * big, cy + Math.sin(a0) * big);
      ctx.lineTo(cx + Math.cos(a1) * big, cy + Math.sin(a1) * big);
      ctx.closePath();
    }
    ctx.fill();
    // hexágonos que salen del centro y laten con el bombo
    const spacing = 170, off = (ringT * 26) % spacing;
    ctx.lineJoin = 'round';
    for (let r = W.R + 50 + off; r < big * 0.6; r += spacing) {
      const fade = clamp(1 - (r - W.R) / (big * 0.55), 0, 1) * clamp((r - W.R - 50) / 80, 0, 1);
      ctx.strokeStyle = css(cur[2], (0.22 + 0.25 * pulse) * fade);
      ctx.lineWidth = 3 + 5 * pulse;
      hexPath(ctx, cx, cy, r * (1 + 0.02 * pulse), rot * 0.5);
      ctx.stroke();
    }
    // zona de juego más limpia alrededor de la célula
    const rr = W.R + 170, g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rr);
    g.addColorStop(0, css(cur[0], 0.95));
    g.addColorStop(0.75, css(cur[0], 0.6));
    g.addColorStop(1, css(cur[0], 0));
    ctx.fillStyle = g;
    ctx.fillRect(cx - rr, cy - rr, rr * 2, rr * 2);
    drawDoodles(ctx);
  }

  return { update, draw, reset, get pulse() { return pulse; } };
})();
