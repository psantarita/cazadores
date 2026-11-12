'use strict';
/* Lógica principal: estados (título → juego → resultados), oleadas,
   escudos de los jugadores, puntuación y bucle de animación. */

const canvas = document.getElementById('juego');
const ctx = canvas.getContext('2d');
let VIEW_SCALE = 1;

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  const maxPx = 2560 * 1440;
  if (w * h * dpr * dpr > maxPx) dpr = Math.sqrt(maxPx / (w * h));
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const aspect = w / h;
  const LW = aspect >= 4 / 3 ? 1080 * aspect : 1440;
  const LH = aspect >= 4 / 3 ? 1080 : 1440 / aspect;
  VIEW_SCALE = canvas.width / LW;
  World.resize(LW, LH);
  Fog.init(LW, LH);
  Decor.reset();
}

const today = () => new Date().toDateString();
function loadRecord() {
  try {
    const r = JSON.parse(localStorage.getItem('cazadores-record') || 'null');
    if (r && r.day === today()) return r;
  } catch (e) { /* sin almacenamiento */ }
  return { day: today(), score: 0 };
}
function saveRecord(r) {
  try { localStorage.setItem('cazadores-record', JSON.stringify(r)); } catch (e) { /* sin almacenamiento */ }
}

const Game = {
  state: 'title', time: 0, titleT: 0,
  // título
  lobby: [], lobbyT: {}, countdown: 0, demoT: 0, panel: 0, panelT: 0, panelDur: 9,
  // partida
  players: [], waveIdx: 0, waveT: 0, spawnT: 0, muonT: 6, cleared: false, clearT: 0,
  dna: 100, lastHit: 99, cellFlash: 0, rungs: new Array(16).fill(0), alarmT: 0,
  card: null, banner: null, toastCur: null, toasts: [], seen: new Set(), factT: 14, factIdx: 0,
  paused: false, ending: null, idleT: 0, backHold: 0,
  stats: { emitted: 0, hits: 0 },
  geiger: 0, geigerLed: 0,
  results: null, record: loadRecord(),

  geigerClick(v = 1) {
    this.geiger += 1;
    this.geigerLed = 1;
    Sfx.tick((this.state === 'play' ? 0.14 : 0.07) + 0.22 * v);
  },

  // ─── Estados ───

  toTitle() {
    this.state = 'title';
    this.titleT = 0;
    this.lobby = []; this.lobbyT = {}; this.countdown = 0;
    this.paused = false; this.card = null; this.ending = null; this.banner = null;
    this.toastCur = null; this.toasts = [];
    this.panel = 0; this.panelT = 0;
    Music.play('titulo');
    Music.tempo = 1;
    Sfx.muffle(false);
    World.mode = 'demo'; World.real = false;
    World.sources.length = 0;
    for (const p of World.particles) p.threat = false;
  },

  startGame() {
    World.clear(); clearFx();
    World.mode = 'game'; World.real = false;
    this.players = [];
    this.lobby.forEach(id => this.addPlayer(id, true));
    this.lobby = [];
    this.dna = 100; this.lastHit = 99; this.cellFlash = 0; this.rungs.fill(0);
    this.stats = { emitted: 0, hits: 0 };
    this.seen = new Set(); this.toasts = []; this.toastCur = null;
    this.factT = 14; this.factIdx = randInt(0, FACTS.length - 1);
    this.paused = false; this.ending = null; this.idleT = 0; this.backHold = 0;
    this.muonT = rand(5, 9); this.waveIdx = 0; this.waveT = 0;
    this.state = 'play';
    this.showCard(WAVES[0].intro, () => this.startWave(0));
  },

  addPlayer(dev, silent) {
    const slot = this.players.length, other = this.players[0];
    const angle = other ? other.angle + Math.PI : -Math.PI / 2;
    this.players.push({
      slot, dev, kind: Input.get(dev)?.kind || 'pad', color: PLAYER_COLORS[slot], angle, target: angle, mat: 0, halfW: 0.6,
      score: 0, combo: 0, bestCombo: 0, blocks: 0, perfect: 0, leaks: 0, matFlash: 0, flash: 0,
    });
    const hw = this.players.length > 1 ? 0.5 : 0.62;
    this.players.forEach(p => (p.halfW = hw));
    if (!silent) { this.event('p2join'); Sfx.join(); Input.rumble(dev, 0.3, 0.3, 150); }
  },

  startWave(i) {
    const w = WAVES[i];
    this.waveIdx = i;
    this.waveT = 0;
    this.spawnT = 1.4;
    this.cleared = false;
    this.clearT = 0;
    World.real = !!w.real;
    // música: más rápida en cada oleada; la oleada final tiene su propia canción
    Music.play(w.real ? 'final' : 'juego');
    Music.tempo = w.real ? 1 : 1 + i * 0.03;
    const hint = HINTS[w.hint] ? HINTS[w.hint](this.kinds()) : w.hint;
    this.banner = { text: `OLEADA ${i + 1}`, sub: w.title, hint, t: 0, dur: 2.8 };
    Sfx.wave();
  },

  showCard(id, then) {
    this.card = { id, t: 0, auto: 16, then };
    Sfx.card();
    Sfx.muffle(true);
  },

  finish(success) {
    const dnaBonus = Math.round(this.dna) * 20;
    const players = this.players.map(p => ({
      slot: p.slot, blocks: p.blocks, perfect: p.perfect, leaks: p.leaks, bestCombo: p.bestCombo, final: p.score + dnaBonus,
    }));
    const perfect = this.players.reduce((s, p) => s + p.perfect, 0);
    const rating = 0.65 * Math.min(1, perfect / Math.max(1, this.stats.emitted)) + 0.35 * (this.dna / 100);
    const rank = RANKS.find(r => rating >= r.min).name;
    const best = Math.max(...players.map(p => p.final));
    const newRecord = best > this.record.score;
    if (newRecord) { this.record = { day: today(), score: best }; saveRecord(this.record); }
    this.results = { success, players, dna: Math.round(this.dna), dnaBonus, rank, newRecord, t: 0 };
    this.state = 'results';
    this.card = null; this.banner = null; this.ending = null; this.toastCur = null;
    World.sources.length = 0;
    World.mode = 'demo';
    World.real = false;
    for (const p of World.particles) p.threat = false;
    Music.stop();
    Sfx.muffle(false);
    if (success) Sfx.win(); else Sfx.lose();
  },

  // ─── Actualización ───

  update(dt) {
    this.time += dt;
    Sfx.tryUnlock(this.time);
    Music.update();
    const wave = WAVES[this.waveIdx];
    Decor.update(dt, this.state === 'play' && wave ? wave.intro : 'titulo', this.state === 'play' ? this.waveIdx : 0);
    Fog.update(dt, World.W, World.H);
    Shake.update(dt);
    if (this.state === 'title') this.updateTitle(dt);
    else if (this.state === 'play') this.updatePlay(dt);
    else this.updateResults(dt);
    // con ratón en el juego se oculta el cursor del sistema y se dibuja una mira
    document.body.classList.toggle('playcursor', this.state === 'play' && this.players.some(p => p.kind === 'kbm'));
    this.geiger *= Math.exp(-dt);
    this.geigerLed = Math.max(0, this.geigerLed - dt * 8);
  },

  updateTitle(dt) {
    this.titleT += dt;
    this.demoT -= dt;
    if (this.demoT <= 0) { demoSpawn(); this.demoT = rand(0.2, 0.6); }
    updateParticles(dt);
    stepFx(dt);
    this.panelT += dt;
    if (this.panelT > this.panelDur) { this.panelT = 0; this.panel = (this.panel + 1) % 3; }
    if (this.titleT < 0.8) return;
    for (const s of Input.all()) {
      if (!s.ok) continue;
      if (this.lobby.includes(s.id)) {
        // presionar A otra vez empieza de inmediato
        if (this.titleT - this.lobbyT[s.id] > 0.6) { this.startGame(); return; }
      } else if (this.lobby.length < 2) {
        this.lobby.push(s.id);
        this.lobbyT[s.id] = this.titleT;
        this.countdown = this.lobby.length === 1 ? 6 : Math.min(this.countdown, 3);
        Sfx.join();
        Input.rumble(s.id, 0.3, 0.3, 150);
      }
    }
    if (this.lobby.length) {
      this.countdown -= dt;
      if (this.countdown <= 0 || this.lobby.some(id => Input.get(id)?.pressed.start)) this.startGame();
    }
  },

  updatePlay(dt) {
    const devs = this.players.map(p => Input.get(p.dev)).filter(Boolean);
    // unirse a media partida
    if (this.players.length < 2 && !this.ending) {
      for (const s of Input.all()) {
        if (s.ok && !this.players.some(p => p.dev === s.id)) { this.addPlayer(s.id); break; }
      }
    }
    // pausa, inactividad y salida
    if (!this.card && !this.ending && devs.some(s => s.pressed.start)) { this.paused = !this.paused; Sfx.select(); Sfx.muffle(this.paused); }
    if (devs.some(s => s.active)) this.idleT = 0; else this.idleT += dt;
    if (this.idleT > 40) { this.toTitle(); return; }
    if (devs.some(s => s.down.back)) { this.backHold += dt; if (this.backHold > 1.5) { this.toTitle(); return; } }
    else this.backHold = 0;
    if (this.paused) return;

    if (this.card) {
      this.card.t += dt;
      if ((this.card.t > 1.4 && devs.some(s => s.ok)) || this.card.t > this.card.auto) {
        const then = this.card.then;
        this.card = null;
        Sfx.muffle(false);
        then();
      }
      return;
    }

    let sdt = dt;
    if (this.ending) {
      this.ending.t += dt;
      sdt = dt * 0.3;
      if (this.ending.t > 2.4) { this.finish(false); return; }
    }
    for (const pl of this.players) this.updatePlayer(pl, dt);
    this.updateWave(sdt);
    updateSources(sdt);
    updateParticles(sdt);
    stepFx(sdt);
    this.updateCell(sdt);
    this.updateToasts(dt);
    if (this.banner) { this.banner.t += dt; if (this.banner.t > this.banner.dur) this.banner = null; }
  },

  updatePlayer(pl, dt) {
    const s = Input.get(pl.dev), speed = MATERIALS[pl.mat].speed;
    if (s && !this.ending) {
      // izquierda/derecha giran el escudo directo, sin inercia; el ratón marca hacia dónde apuntar
      if (s.spin) { pl.angle += s.spin * SHIELD_SPIN * speed * dt; pl.target = pl.angle; }
      else if (s.dir !== null) pl.target = s.dir;
      let m = s.mat >= 0 ? s.mat : pl.mat;
      if (s.cycle) m = (m + s.cycle + 4 * 10) % 4;
      if (m !== pl.mat) { pl.mat = m; pl.matFlash = 1; Sfx.material(m); }
    }
    const rate = SHIELD_TURN * speed;
    pl.angle = angDiff(pl.angle + clamp(angDiff(pl.target, pl.angle), -rate * dt, rate * dt), 0);
    pl.matFlash = Math.max(0, pl.matFlash - dt * 3);
    pl.flash = Math.max(0, pl.flash - dt * 3);
  },

  updateWave(dt) {
    const w = WAVES[this.waveIdx];
    if (!w || this.ending) return;
    this.waveT += dt;
    const two = this.players.length > 1;
    if (this.waveT < w.duration) {
      this.spawnT -= dt;
      if (this.spawnT <= 0 && World.sources.length < w.maxActive + (two ? 1 : 0)) {
        spawnSource(pick(w.pool));
        this.spawnT = rand(w.gap[0], w.gap[1]) * (two ? 0.85 : 1);
      }
    } else if (!World.sources.length && !World.particles.some(p => p.threat)) {
      if (!this.cleared) {
        this.cleared = true;
        this.dna = Math.min(100, this.dna + 15);
        this.banner = { text: '¡OLEADA SUPERADA!', sub: 'La célula se recupera: +15 % de ADN', t: 0, dur: 2.2, color: T.good };
        Sfx.cleared();
      }
      this.clearT += dt;
      if (this.clearT > 2.3) {
        const next = this.waveIdx + 1;
        if (next < WAVES.length) this.showCard(WAVES[next].intro, () => this.startWave(next));
        else this.finish(true);
      }
    }
    this.muonT -= dt;
    if (this.muonT <= 0) {
      spawnMuon();
      this.muonT = rand(6, 12);
      this.event(this.seen.has('muon') ? 'muon2' : 'muon');
    }
  },

  updateCell(dt) {
    this.lastHit += dt;
    this.cellFlash = Math.max(0, this.cellFlash - dt * 2.5);
    for (let i = 0; i < this.rungs.length; i++) this.rungs[i] = Math.max(0, this.rungs[i] - dt * 0.1);
    if (this.ending) return;
    if (this.lastHit > 3 && this.dna < 100) {
      this.dna = Math.min(100, this.dna + dt * 1.5);
      if (this.dna < 85) this.event('repair');
    }
    if (this.dna < 30) {
      this.alarmT -= dt;
      if (this.alarmT <= 0) { Sfx.alarm(); this.alarmT = 1.4; }
    }
  },

  // con qué juega cada quien: 'pad', 'kbm' o 'kb2' (para mostrar los botones o teclas correctos)
  kinds() {
    const k = [...new Set(this.players.map(p => p.kind))];
    return k.length ? k : ['pad'];
  },

  // ─── Mensajes ───

  toast(text, kind = 'dato') {
    if (kind === 'dato' && this.toasts.length > 1) return;
    this.toasts.push({ text, kind });
  },

  event(key) {
    if (this.seen.has(key) || !EVENTS[key]) return;
    this.seen.add(key);
    const kind = key.startsWith('pass') || key === 'brems' || key === 'firstHit' || key === 'heavy' ? 'ojo'
      : key.startsWith('muon') ? 'dato' : 'bien';
    this.toast(EVENTS[key], kind);
    // un aviso importante interrumpe un dato curioso
    if (this.toastCur && this.toastCur.kind === 'dato') this.toastCur.t = Math.max(this.toastCur.t, this.toastCur.dur - 0.3);
  },

  updateToasts(dt) {
    if (this.toastCur) {
      this.toastCur.t += dt;
      if (this.toastCur.t > this.toastCur.dur) this.toastCur = null;
      return;
    }
    if (this.toasts.length) {
      const t = this.toasts.shift();
      this.toastCur = { ...t, t: 0, dur: clamp(2.5 + t.text.length / 20, 4.5, 8) };
      return;
    }
    this.factT -= dt;
    if (this.factT <= 0) {
      this.factT = 16;
      this.toast(FACTS[this.factIdx++ % FACTS.length]);
    }
  },

  // ─── Interacciones (las llama la simulación) ───

  onShield(p, hx, hy, theta) {
    for (const pl of this.players) {
      if (Math.abs(angDiff(theta, pl.angle)) > pl.halfW + 0.035) continue;
      const mat = MATERIALS[pl.mat];
      if (Math.random() < STOP[p.type][mat.id]) {
        p.alive = false;
        this.blocked(pl, p, mat, hx, hy, theta);
        return;
      }
      this.penetrated(pl, p, mat, hx, hy, theta);
    }
  },

  blocked(pl, p, mat, hx, hy, theta) {
    const W = World, ideal = PTYPES[p.type].ideal === mat.id;
    pl.blocks++;
    let pts = 40;
    if (ideal) {
      pl.combo++;
      pl.perfect++;
      pl.bestCombo = Math.max(pl.bestCombo, pl.combo);
      pts = Math.round(100 * (1 + Math.min(pl.combo - 1, 10) * 0.1));
    }
    pl.score += pts;
    pl.flash = 1;
    const ox = W.cx + Math.cos(theta) * (W.R + 78), oy = W.cy + Math.sin(theta) * (W.R + 78);
    Texts.add('+' + pts, ox, oy, { color: pl.color, size: ideal ? 36 : 26 });
    if (ideal) Texts.add(pl.combo >= 3 ? `¡PERFECTO! x${pl.combo}` : '¡PERFECTO!', ox, oy - 34, { color: T.gold, size: 24, life: 1.1 });
    else if (p.type !== 'xray') { Texts.add('Material muy pesado', ox, oy - 30, { color: T.soft, size: 19, life: 1.1 }); this.event('heavy'); }
    this.interactionFX(p, mat, hx, hy);
    Sfx.block(mat.id);
    if (ideal) Sfx.perfect();
    Input.rumble(pl.dev, p.type === 'alpha' || mat.id === 'plomo' ? 0.5 : 0.15, 0.4, 90);
    this.geigerClick(0.6);
    this.event('firstBlock');
  },

  // Lo que pasa físicamente cuando la radiación se frena en el material
  interactionFX(p, mat, hx, hy) {
    const W = World, inward = Math.atan2(W.cy - hy, W.cx - hx);
    const label = (s, c = p.color) => Texts.add(s, hx - Math.cos(inward) * 34, hy - Math.sin(inward) * 34 + 26, { color: c, size: 19, life: 1.4, vy: -20 });
    Rings.add(hx, hy, 4, 36, 0.4, p.color, 4);
    if (p.type === 'alpha') {
      braggBurst(hx, hy, p.color);
      label('Ionización intensa');
    } else if (p.type === 'beta') {
      Sparks.burst(hx, hy, 6, p.color, 140, 0.5, 3);
      if (mat.id === 'plomo' && Math.random() < BREMS_CHANCE) {
        // radiación de frenado: el electrón frenado por núcleos pesados emite rayos X
        spawn('xray', hx + Math.cos(inward) * 14, hy + Math.sin(inward) * 14, inward + randn() * 0.15,
          { inside: true, tx: W.cx + randn() * 20, ty: W.cy + randn() * 20 });
        label('¡Rayos X de frenado!', PTYPES.xray.color);
        Sfx.brems();
        this.event('brems');
      } else label('Ionización');
    } else if (p.type === 'gamma' || p.type === 'xray') {
      if (Math.random() < 0.55) {
        label('Efecto fotoeléctrico');
        spawn('electron', hx, hy, inward + Math.PI + randn() * 0.6, { range: rand(25, 50), color: p.color, speed: 260 });
        Rings.add(hx, hy, 2, 50, 0.5, T.flash, 2);
      } else {
        label('Efecto Compton');
        spawn('electron', hx, hy, inward + Math.PI + rand(0.4, 1.0), { range: rand(25, 50), color: p.color, speed: 260 });
        spawn('photon', hx, hy, inward + Math.PI - rand(0.3, 1.0), { range: rand(60, 110), color: p.color });
      }
    } else if (p.type === 'neutron') {
      // moderación: choques sucesivos con protones (hidrógeno) hasta frenarse y ser capturado
      for (let i = 0; i < 5; i++) {
        const ex = hx + randn() * 9, ey = hy + randn() * 9;
        spawn('proton', ex, ey, rand(0, TAU), { range: rand(8, 18), color: p.color, speed: 120 });
      }
      label(mat.id === 'agua' ? 'Moderación por hidrógeno' : 'Captura');
    }
  },

  penetrated(pl, p, mat, hx, hy, theta) {
    const W = World;
    pl.combo = 0;
    pl.leaks++;
    Texts.add(`¡Atravesó el ${mat.name.toLowerCase()}!`, W.cx + Math.cos(theta) * (W.R + 80), W.cy + Math.sin(theta) * (W.R + 80) - 20,
      { color: T.bad, size: 22, life: 1.4 });
    Rings.add(hx, hy, 4, 28, 0.35, T.bad, 3);
    Sfx.pass();
    if (p.type === 'beta') this.event('pass_beta_papel');
    else if (p.type === 'gamma') this.event(mat.id === 'plomo' ? 'pass_gamma_plomo' : 'pass_gamma');
    else if (p.type === 'neutron') this.event('pass_neutron');
  },

  onCell(p) {
    const W = World;
    if (this.ending) return;
    const dmg = PTYPES[p.type].damage * (this.players.length > 1 ? 0.75 : 1);
    this.dna = Math.max(0, this.dna - dmg);
    this.lastHit = 0;
    this.cellFlash = 1;
    this.stats.hits++;
    for (let k = 0; k < (p.type === 'alpha' ? 3 : 2); k++) this.rungs[randInt(0, this.rungs.length - 1)] = 1;
    // ionización: electrones arrancados de las moléculas de la célula
    for (let i = 0; i < 9; i++) {
      const a = rand(0, TAU), v = rand(90, 220);
      Sparks.add(p.x, p.y, Math.cos(a) * v, Math.sin(a) * v, T.info, rand(0.6, 1), 3, i < 2 ? 'e⁻' : null);
    }
    Texts.add(this.stats.hits <= 3 ? '¡Ionización del ADN!' : `-${Math.round(dmg)} ADN`, W.cx, W.cy - W.cellR - 40, { color: T.bad, size: 26 });
    if (p.type === 'alpha' || p.type === 'beta') {
      braggBurst(p.x, p.y, p.color);
      p.alive = false;
    } else {
      // gamma y neutrones siguen de largo
      p.tx = p.x + Math.cos(p.dir) * 4000;
      p.ty = p.y + Math.sin(p.dir) * 4000;
    }
    Sfx.hit();
    Shake.add(8);
    this.players.forEach(pl => Input.rumble(pl.dev, 0.8, 0.5, 220));
    this.geigerClick(1);
    this.event('firstHit');
    if (this.dna <= 0) {
      this.ending = { t: 0 };
      Music.stop();
      this.banner = { text: '¡EL ADN NO RESISTIÓ!', sub: 'Demasiada ionización en la célula', t: 0, dur: 2.4, color: T.bad };
      Sfx.lose();
    }
  },

  updateResults(dt) {
    const r = this.results;
    r.t += dt;
    if (r.t > 3) Music.play('titulo');
    this.demoT -= dt;
    if (this.demoT <= 0) { demoSpawn(); this.demoT = rand(0.5, 1.2); }
    updateParticles(dt);
    stepFx(dt);
    if ((r.t > 3 && Input.all().some(s => s.ok)) || r.t > 30) this.toTitle();
  },

  // ─── Dibujo ───

  render() {
    const W = World, sh = Shake.offset(), t = this.time;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#02050b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(VIEW_SCALE, 0, 0, VIEW_SCALE, sh.x * VIEW_SCALE, sh.y * VIEW_SCALE);
    drawBackground(ctx);
    if (this.state === 'play') {
      drawRingGuide(ctx, t);
      Drops.draw(ctx);
      drawCell(ctx, t, this.dna, this.cellFlash, this.rungs);
      drawSources(ctx, t);
      drawParticles(ctx, t);
      for (const pl of this.players) drawShield(ctx, pl, t);
      const mp = this.players.find(p => p.kind === 'kbm'), mouse = Input.mouse();
      if (mp && mouse.aim) drawCrosshair(ctx, mouse.x, mouse.y, mp.color);
      Rings.draw(ctx);
      Sparks.draw(ctx);
      Texts.draw(ctx);
      drawVignette(ctx);
      drawHUD(ctx, this, t);
      drawToast(ctx, this.toastCur);
      drawBanner(ctx, this.banner);
      if (this.ending) {
        ctx.fillStyle = `rgba(120,0,0,${0.25 * clamp(this.ending.t, 0, 1)})`;
        ctx.fillRect(-40, -40, W.W + 80, W.H + 80);
      }
      if (this.card) drawCard(ctx, this.card);
      if (this.paused) drawPause(ctx);
    } else {
      Drops.draw(ctx);
      drawParticles(ctx, t);
      Rings.draw(ctx);
      drawVignette(ctx);
      if (this.state === 'title') drawTitle(ctx, this, t);
      else drawResults(ctx, this, t);
    }
  },
};

World.hooks = {
  click: v => Game.geigerClick(v),
  emitted: () => { Game.stats.emitted++; Game.geigerClick(0.4); },
  shield: (p, hx, hy, theta) => Game.onShield(p, hx, hy, theta),
  cell: p => Game.onCell(p),
};

// ─── Arranque ───

let firstClick = true;
function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  else document.documentElement.requestFullscreen?.().catch(() => {});
}
window.addEventListener('pointerdown', () => {
  if (!Sfx.running()) Input.discardClicks(); // ese clic sólo activa el sonido
  Sfx.unlock();
  if (firstClick) { firstClick = false; if (!document.fullscreenElement) toggleFullscreen(); }
});
window.addEventListener('keydown', e => {
  Sfx.unlock();
  if (e.code === 'KeyF') toggleFullscreen();
  if (e.code === 'KeyM') Sfx.toggleMute();
  if (e.code === 'KeyT') setTheme(T.name === 'claro' ? 'oscuro' : 'claro');
  // Shift+R en la pantalla de título: borrar el récord del día
  if (e.code === 'KeyR' && e.shiftKey && Game.state === 'title') { Game.record = { day: today(), score: 0 }; saveRecord(Game.record); }
});
// ocultar el cursor si no se mueve el ratón
let cursorT = null;
window.addEventListener('mousemove', () => {
  document.body.classList.remove('nocursor');
  clearTimeout(cursorT);
  cursorT = setTimeout(() => document.body.classList.add('nocursor'), 2000);
});
window.addEventListener('resize', resize);

// Tema de color: claro (salón con luz) u oscuro (cuarto oscuro). Tecla T para cambiarlo.
function setTheme(name) {
  applyTheme(name);
  Game.players.forEach(p => (p.color = PLAYER_COLORS[p.slot]));
  try { localStorage.setItem('cazadores-tema', T.name); } catch (e) { /* sin almacenamiento */ }
}
(() => {
  let name = new URLSearchParams(location.search).get('tema');
  try { name = name || localStorage.getItem('cazadores-tema'); } catch (e) { /* sin almacenamiento */ }
  applyTheme(name || 'claro');
})();

resize();
Game.toTitle();
let lastFrame = performance.now();
function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - lastFrame) / 1000));
  lastFrame = now;
  Input.poll();
  Game.update(dt);
  Game.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
