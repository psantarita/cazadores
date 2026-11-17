'use strict';
/* Sonido sintetizado con Web Audio: no necesita archivos de audio.
   Los navegadores sólo permiten sonido después de un clic o tecla
   (o si Chrome se abre con --autoplay-policy=no-user-gesture-required). */

const Sfx = (() => {
  let ctx = null, out = null, noise = null, pulse = null, muted = false, lastTick = 0, lastTry = -10;
  // Música: sintes (se "agachan" con cada bombo) + batería → filtro (apaga la música en tarjetas y pausa)
  let musSynth = null, musDuck = null, musLead = null, musDrums = null, musFilter = null, musOut = null;

  function init() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    // iPhone: que suene aunque el teléfono esté en modo silencio
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* no disponible */ }
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    out = ctx.createGain();
    out.gain.value = 0.9;
    out.connect(comp).connect(ctx.destination);
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // onda de pulso al 25 % (el sonido típico de las consolas viejas)
    const n = 32, re = new Float32Array(n), im = new Float32Array(n);
    for (let k = 1; k < n; k++) re[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * 0.25);
    pulse = ctx.createPeriodicWave(re, im);

    musOut = ctx.createGain();
    musOut.gain.value = 0.7;
    musOut.connect(out);
    musFilter = ctx.createBiquadFilter();
    musFilter.type = 'lowpass';
    musFilter.frequency.value = 16000;
    musFilter.connect(musOut);
    musDuck = ctx.createGain();
    musDuck.connect(musFilter);
    musSynth = ctx.createGain();
    musSynth.connect(musDuck);
    musDrums = ctx.createGain();
    musDrums.connect(musFilter);
    // la melodía lleva un eco
    musLead = ctx.createGain();
    musLead.connect(musSynth);
    const delay = ctx.createDelay(1), fb = ctx.createGain(), wet = ctx.createGain();
    delay.delayTime.value = 0.28;
    fb.gain.value = 0.32;
    wet.gain.value = 0.3;
    musLead.connect(delay);
    delay.connect(fb).connect(delay);
    delay.connect(wet).connect(musSynth);
    return ctx;
  }

  function unlock() {
    if (!init()) return;
    if (ctx.state !== 'running') ctx.resume().catch(() => {});
  }

  // Intento periódico (funciona si Chrome se abrió con la bandera de autoplay)
  function tryUnlock(now) {
    if (running() || now - lastTry < 1.5) return;
    lastTry = now;
    unlock();
  }

  const running = () => !!ctx && ctx.state === 'running';

  function env(g, t0, attack, peak, dur) {
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  }

  function tone(freq, dur, { type = 'sine', vol = 0.2, slide = null, attack = 0.005, delay = 0, at = null, dest = null } = {}) {
    if (!running() || muted) return;
    const t0 = at ?? ctx.currentTime + delay;
    const o = ctx.createOscillator(), g = ctx.createGain();
    if (type === 'pulse') o.setPeriodicWave(pulse); else o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t0 + dur);
    env(g, t0, attack, vol, dur);
    o.connect(g).connect(dest || out);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  function hiss(dur, { vol = 0.2, type = 'bandpass', freq = 2000, q = 1, slide = null, attack = 0.003, delay = 0, at = null, dest = null } = {}) {
    if (!running() || muted) return;
    const t0 = at ?? ctx.currentTime + delay;
    const s = ctx.createBufferSource();
    s.buffer = noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t0);
    f.Q.value = q;
    if (slide) f.frequency.exponentialRampToValueAtTime(slide, t0 + dur);
    const g = ctx.createGain();
    env(g, t0, attack, vol, dur);
    s.connect(f).connect(g).connect(dest || out);
    s.start(t0, Math.random() * 0.5);
    s.stop(t0 + dur + 0.05);
  }

  // El "clic" de un contador Geiger
  function tick(vol = 0.3) {
    if (!running() || muted) return;
    const t = ctx.currentTime;
    if (t - lastTick < 0.014) return;
    lastTick = t;
    const s = ctx.createBufferSource();
    s.buffer = noise;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 1600;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.007);
    s.connect(f).connect(g).connect(out);
    s.start(t, Math.random() * 0.9);
    s.stop(t + 0.015);
  }

  // Efecto "pumping": los sintes bajan de golpe con cada bombo y vuelven a subir
  function duck(t) {
    if (!musDuck) return;
    const g = musDuck.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(0.35, t);
    g.linearRampToValueAtTime(1, t + 0.16);
  }

  // Música apagada (como bajo el agua) durante tarjetas y pausa
  function muffle(on) {
    if (!musFilter) return;
    musFilter.frequency.setTargetAtTime(on ? 650 : 16000, ctx.currentTime, 0.12);
  }

  return {
    unlock, tryUnlock, running, tick, tone, hiss, duck, muffle,
    get ctx() { return ctx; },
    get music() { return { synth: musSynth, lead: musLead, drums: musDrums }; },
    get muted() { return muted; },
    toggleMute() { muted = !muted; if (out) out.gain.value = muted ? 0 : 0.9; return muted; },
    material(i) { tone([660, 880, 330, 520][i], 0.09, { type: 'square', vol: 0.07, slide: [990, 1320, 250, 780][i] }); },
    block(id) {
      if (id === 'papel') { hiss(0.12, { freq: 3200, q: 0.8, vol: 0.28 }); tone(320, 0.06, { vol: 0.1 }); }
      else if (id === 'aluminio') { [1830, 2770, 4170].forEach((f, i) => tone(f, 0.4 - i * 0.1, { vol: 0.07 })); }
      else if (id === 'plomo') { tone(120, 0.32, { vol: 0.35, slide: 50 }); hiss(0.12, { type: 'lowpass', freq: 500, vol: 0.25 }); }
      else { tone(720, 0.14, { vol: 0.2, slide: 180 }); tone(950, 0.12, { vol: 0.12, slide: 260, delay: 0.08 }); }
    },
    perfect() { tone(1046, 0.12, { type: 'triangle', vol: 0.1 }); tone(1568, 0.18, { type: 'triangle', vol: 0.1, delay: 0.06 }); },
    pass() { hiss(0.3, { type: 'highpass', freq: 500, slide: 5000, vol: 0.16 }); },
    hit() { tone(150, 0.5, { type: 'sawtooth', vol: 0.2, slide: 38 }); hiss(0.35, { type: 'lowpass', freq: 900, vol: 0.3 }); },
    brems() { tone(2600, 0.25, { type: 'sawtooth', vol: 0.05, slide: 500 }); },
    join() { tone(523, 0.1, { type: 'square', vol: 0.08 }); tone(784, 0.16, { type: 'square', vol: 0.08, delay: 0.08 }); },
    select() { tone(700, 0.06, { type: 'square', vol: 0.06 }); },
    wave() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.22, { type: 'triangle', vol: 0.11, delay: i * 0.09 })); },
    card() { [392, 494, 587].forEach(f => tone(f, 1.2, { vol: 0.05, attack: 0.08 })); },
    cleared() { [784, 988, 1175].forEach((f, i) => tone(f, 0.25, { type: 'triangle', vol: 0.1, delay: i * 0.07 })); },
    alarm() { tone(880, 0.12, { type: 'square', vol: 0.05 }); tone(660, 0.12, { type: 'square', vol: 0.05, delay: 0.14 }); },
    win() { [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.32, { type: 'triangle', vol: 0.11, delay: i * 0.11 })); },
    lose() { [440, 370, 311, 262].forEach((f, i) => tone(f, 0.36, { type: 'triangle', vol: 0.11, delay: i * 0.16 })); },
  };
})();
