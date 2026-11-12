'use strict';
/* Música chiptune estilo arcade (al estilo de Super Hexagon): arpegios rápidos en semicorcheas,
   bajo saltando de octava, bombo en cada tiempo y "pumping" (los sintes bajan con cada bombo).
   Composición original. Cada canción se arma con una progresión de acordes (un acorde por compás),
   un patrón de arpegio y una melodía en corcheas ("-" sostiene la nota, "." es silencio).
   El secuenciador está basado en el de "Salto Cuántico". */

const SONGS = {
  // Pantalla de título: misma energía pero más relajada
  titulo: {
    bpm: 132,
    chords: ['A3m', 'A3m', 'F3', 'F3', 'C3', 'C3', 'G3', 'E3'],
    arp: [0, 2, 4, 2, 1, 3, 5, 3, 0, 2, 4, 6, 4, 2, 1, 2],
    lead: ['E5 - - - A5 - - -', 'C6 - - - A5 - G5 -', 'E5 - - - G5 - - -', 'D5 - - - B4 - D5 -',
           'E5 - - - A5 - C6 -', 'F5 - - - A5 - C6 -', 'B5 - - - D6 - - -', 'G#5 - - - - - - -'],
    form: [{ drums: 'light' }, { drums: 'light', lead: true }],
  },
  // Oleadas 1 a 4: acelera un poco en cada oleada
  juego: {
    bpm: 160,
    chords: ['A3m', 'F3', 'C3', 'G3', 'A3m', 'F3', 'G3', 'E3'],
    arp: [0, 1, 2, 3, 4, 3, 2, 1, 0, 2, 4, 5, 6, 5, 4, 2],
    lead: ['A5 . E5 A5 C6 . B5 A5', 'C6 . A5 F5 A5 . G5 F5', 'E5 . G5 C6 E6 . D6 C6', 'B5 . D6 B5 G5 . A5 B5',
           'C6 - B5 A5 E5 - A5 C6', 'F6 - E6 C6 A5 - C6 F6', 'D6 - B5 G5 D6 - E6 F6', 'E6 - - - G#5 - B5 D6'],
    form: [{}, { lead: true }, { lead: true, hats16: true, arpOct: 12 }],
  },
  // Oleada final (visión real): más rápida y más oscura
  final: {
    bpm: 172,
    chords: ['E3m', 'C3', 'D3', 'B2', 'E3m', 'C3', 'D3', 'B2'],
    arp: [0, 3, 1, 4, 2, 5, 3, 6, 0, 3, 1, 4, 2, 5, 6, 4],
    lead: ['E5 G5 B5 E6 D6 B5 G5 B5', 'C6 . G5 E5 C6 . E6 G6', 'F#6 . D6 A5 F#5 A5 D6 F#6', 'D#6 - B5 F#5 B5 - D#6 F#6',
           'G6 - E6 B5 G5 - B5 E6', 'E6 - C6 G5 E5 - G5 C6', 'D6 - A5 F#5 A5 D6 F#6 A6', 'B5 - - - D#6 - F#6 -'],
    form: [{ hats16: true }, { lead: true, hats16: true }, { lead: true, hats16: true, arpOct: 12 }],
  },
};

const Music = (() => {
  const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const midi = n => {
    const m = /^([A-G])(#|b)?(\d)$/.exec(n);
    if (!m) return null;
    return NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (+m[3] + 1) * 12;
  };
  const hz = m => 440 * Math.pow(2, (m - 69) / 12);

  // Convierte cada canción en una lista de eventos por semicorchea
  function build(song) {
    const bars = song.chords.length, perSec = bars * 16;
    const steps = Array.from({ length: song.form.length * perSec }, () => []);
    song.form.forEach((sec, si) => {
      for (let b = 0; b < bars; b++) {
        const base = si * perSec + b * 16;
        const c = /^([A-G][#b]?\d)(m?)$/.exec(song.chords[b]);
        const root = midi(c[1]), third = c[2] ? 3 : 4;
        // escalera del acorde para el arpegio (dos octavas arriba del bajo)
        const r = root + 12 + (sec.arpOct || 0);
        const ladder = [r, r + third, r + 7, r + 12, r + 12 + third, r + 19, r + 24];
        for (let i = 0; i < 16; i++) {
          const at = steps[base + i];
          at.push({ ch: 'arp', m: ladder[song.arp[i]] });
          if (i % 2 === 0) at.push({ ch: 'bass', m: i % 4 === 0 ? root - 12 : root });
          // batería
          const lastBar = b === bars - 1;
          if (sec.drums === 'light') {
            if (i === 0 || i === 8) at.push({ ch: 'kick' });
            if (i % 4 === 2) at.push({ ch: 'hat' });
            if (lastBar && i >= 12 && i % 2 === 0) at.push({ ch: 'snare' });
          } else {
            if (i % 4 === 0) at.push({ ch: 'kick' });
            if (i === 4 || i === 12 || (lastBar && i >= 12)) at.push({ ch: 'snare' });
            if (i % 4 === 2) at.push({ ch: 'hat' });
            else if (sec.hats16 && i % 2 === 1) at.push({ ch: 'hat', soft: true });
          }
        }
        if (sec.lead) {
          const tok = song.lead[b].trim().split(/\s+/);
          tok.forEach((t, j) => {
            if (t === '-' || t === '.') return;
            let len = 1;
            while (tok[j + len] === '-') len++;
            steps[base + j * 2].push({ ch: 'lead', m: midi(t), len: len * 2 });
          });
        }
      }
    });
    song.steps = steps;
  }
  for (const k in SONGS) build(SONGS[k]);

  let cur = null, step = 0, nextT = 0, tempo = 1;
  const kicks = []; // momentos de los bombos ya programados (para que el fondo lata al ritmo)

  function play(name, restart = false) {
    if (cur === name && !restart) return;
    cur = name;
    step = 0;
    nextT = Sfx.ctx ? Sfx.ctx.currentTime + 0.08 : 0;
  }

  function schedule(ev, t, dt) {
    const bus = Sfx.music;
    switch (ev.ch) {
      case 'arp':
        Sfx.tone(hz(ev.m), dt * 0.9, { at: t, type: 'square', vol: 0.04, attack: 0.003, dest: bus.synth });
        break;
      case 'bass':
        Sfx.tone(hz(ev.m), dt * 1.7, { at: t, type: 'square', vol: 0.05, attack: 0.004, dest: bus.synth });
        Sfx.tone(hz(ev.m), dt * 1.8, { at: t, type: 'triangle', vol: 0.17, attack: 0.004, dest: bus.synth });
        break;
      case 'lead':
        Sfx.tone(hz(ev.m), ev.len * dt * 0.95, { at: t, type: 'pulse', vol: 0.07, attack: 0.01, dest: bus.lead });
        break;
      case 'kick':
        Sfx.tone(160, 0.14, { at: t, type: 'sine', vol: 0.6, slide: 42, dest: bus.drums });
        Sfx.duck(t);
        kicks.push(t);
        if (kicks.length > 16) kicks.shift();
        break;
      case 'snare':
        Sfx.hiss(0.11, { at: t, freq: 1900, q: 0.7, vol: 0.24, dest: bus.drums });
        Sfx.tone(210, 0.06, { at: t, type: 'triangle', vol: 0.12, slide: 120, dest: bus.drums });
        break;
      case 'hat':
        Sfx.hiss(ev.soft ? 0.02 : 0.035, { at: t, type: 'highpass', freq: 7500, vol: ev.soft ? 0.05 : 0.1, dest: bus.drums });
        break;
    }
  }

  // ahead: cuántos segundos programar por adelantado (más para grabar una muestra sin tiempo real)
  function update(ahead = 0.15) {
    const ctx = Sfx.ctx;
    if (!cur || !ctx || !Sfx.running() || Sfx.muted) return;
    const song = SONGS[cur];
    const dt = 60 / (song.bpm * tempo) / 4;
    if (nextT < ctx.currentTime - 0.3) nextT = ctx.currentTime + 0.05; // la pestaña estuvo oculta
    while (nextT < ctx.currentTime + ahead) {
      for (const ev of song.steps[step]) schedule(ev, nextT, dt);
      step = (step + 1) % song.steps.length;
      nextT += dt;
    }
  }

  // 1 justo en cada bombo y baja rápido; sin sonido sigue el pulso de la canción con el reloj
  function pulse() {
    const ctx = Sfx.ctx;
    if (cur && ctx && Sfx.running() && !Sfx.muted) {
      let last = -1;
      for (const k of kicks) if (k <= ctx.currentTime && k > last) last = k;
      return last < 0 ? 0 : Math.exp(-(ctx.currentTime - last) * 7);
    }
    const bpm = cur ? SONGS[cur].bpm * tempo : 120;
    return Math.exp(-((performance.now() / 1000 * bpm / 60) % 1) * 7);
  }

  return {
    play, update, pulse,
    stop() { cur = null; },
    get current() { return cur; },
    set tempo(v) { tempo = v; },
  };
})();
