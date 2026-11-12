'use strict';
/* Entrada: controles de Xbox (Gamepad API, mapeo estándar), teclado y ratón.
   Cada dispositivo produce el mismo estado:
     spin    giro del escudo: -1 (izquierda, contra reloj) … +1 (derecha, a favor del reloj)
     dir     dirección absoluta a la que apuntar (sólo el ratón; si no, null)
     ok      se acaba de presionar "aceptar" (A, clic, Enter)
     mat     material elegido directamente este cuadro (0-3) o -1
     cycle   pasar al material siguiente (+1) o anterior (-1)
     active  hubo actividad (para detectar inactividad)
   Dispositivos: 'gp0'… (controles), 'kbm' (teclado y ratón), 'kb2' (segundo jugador con teclado). */

const Input = (() => {
  const keys = new Set();
  const PREVENT = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab', 'Backspace']);
  window.addEventListener('keydown', e => { keys.add(e.code); if (PREVENT.has(e.code)) e.preventDefault(); });
  window.addEventListener('keyup', e => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());

  // Ratón: posición normalizada (0-1), clics y rueda acumulados entre cuadros
  const mouse = { x: 0.5, y: 0.5, aim: false, moved: -1e9, left: 0, right: 0, wheel: 0, wheelAt: 0, stepAt: 0 };
  window.addEventListener('mousemove', e => {
    mouse.x = e.clientX / window.innerWidth;
    mouse.y = e.clientY / window.innerHeight;
    mouse.aim = true;
    mouse.moved = performance.now();
  });
  window.addEventListener('mousedown', e => { if (e.button === 0) mouse.left++; else if (e.button === 2) mouse.right++; });
  window.addEventListener('contextmenu', e => e.preventDefault());
  window.addEventListener('wheel', e => { mouse.wheel += e.deltaY; mouse.wheelAt = performance.now(); e.preventDefault(); }, { passive: false });

  // Botones del control de Xbox en el mapeo estándar
  const BTN = { a: 0, b: 1, x: 2, y: 3, lb: 4, rb: 5, back: 8, start: 9 };
  const STICK_DEAD = 0.18; // zona muerta del stick (ignora la deriva cuando está suelto)
  const PAD_MATS = ['a', 'b', 'x', 'y'];

  const KB = {
    kbm: { name: 'Teclado y ratón', left: ['ArrowLeft'], right: ['ArrowRight'],
      mats: [['Digit1', 'Numpad1'], ['Digit2', 'Numpad2'], ['Digit3', 'Numpad3'], ['Digit4', 'Numpad4']],
      ok: ['Enter', 'NumpadEnter', 'Space'], start: ['KeyP'], back: ['Backspace'] },
    kb2: { name: 'Teclado (A / D)', left: ['KeyA'], right: ['KeyD'],
      mats: [['KeyZ'], ['KeyX'], ['KeyC'], ['KeyV']],
      ok: ['KeyZ'], start: ['KeyP'], back: ['Backspace'] },
  };

  const states = new Map();
  const blank = (id, kind, name) => ({ id, kind, name, connected: true, dir: null, spin: 0, down: {}, pressed: {}, ok: false, mat: -1, cycle: 0, active: false });

  const shortName = s => (s.split('(')[0].trim() || 'Control').slice(0, 28);
  const btnDown = (gp, i) => { const b = gp.buttons[i]; return !!b && (b.pressed || b.value > 0.5); };

  // Guarda botones apretados y calcula los recién presionados
  function setButtons(s, down) {
    const pressed = {};
    for (const k in down) pressed[k] = down[k] && !s.down[k];
    s.down = down;
    s.pressed = pressed;
  }

  function pollPad(gp) {
    const id = 'gp' + gp.index;
    let s = states.get(id);
    if (!s) { s = blank(id, 'pad', shortName(gp.id)); states.set(id, s); }
    s.connected = true;
    const down = {};
    for (const k in BTN) down[k] = btnDown(gp, BTN[k]);
    setButtons(s, down);
    // Giro: sólo izquierda/derecha del stick más inclinado; poca inclinación = giro fino
    let x = 0;
    for (const ax of [0, 2]) { const v = gp.axes[ax] || 0; if (Math.abs(v) > Math.abs(x)) x = v; }
    let spin = 0;
    if (Math.abs(x) > STICK_DEAD) spin = Math.sign(x) * Math.pow((Math.abs(x) - STICK_DEAD) / (1 - STICK_DEAD), 1.5);
    // la cruceta y LB/RB giran a toda velocidad
    const digital = (btnDown(gp, 15) || down.rb ? 1 : 0) - (btnDown(gp, 14) || down.lb ? 1 : 0);
    if (digital) spin = digital;
    s.dir = null;
    s.spin = spin;
    s.ok = s.pressed.a;
    s.mat = PAD_MATS.findIndex(k => s.pressed[k]);
    s.cycle = 0;
    s.active = spin !== 0 || Object.values(down).some(Boolean);
    return id;
  }

  function pollKeyboard(id, now) {
    const map = KB[id];
    let s = states.get(id);
    if (!s) { s = blank(id, id, map.name); states.set(id, s); }
    const any = codes => codes.some(c => keys.has(c));
    const down = { ok: any(map.ok), start: any(map.start), back: any(map.back) };
    map.mats.forEach((codes, i) => (down['m' + i] = any(codes)));
    setButtons(s, down);
    const spin = (any(map.right) ? 1 : 0) - (any(map.left) ? 1 : 0);
    let dir = null;
    s.ok = s.pressed.ok;
    s.mat = [0, 1, 2, 3].findIndex(i => s.pressed['m' + i]);
    s.cycle = 0;
    s.spin = spin;
    let busy = Object.values(down).some(Boolean) || spin !== 0;
    if (id === 'kbm') {
      if (spin) mouse.aim = false; // las flechas mandan hasta que se vuelva a mover el ratón
      else if (mouse.aim) {
        const mx = mouse.x * World.W - World.cx, my = mouse.y * World.H - World.cy;
        if (Math.hypot(mx, my) > 20) dir = Math.atan2(my, mx);
      }
      // clic izquierdo: aceptar y material siguiente; clic derecho: material anterior
      if (mouse.left) s.ok = true;
      s.cycle = mouse.left - mouse.right;
      // rueda: un paso por gesto, sin dispararse con los trackpads
      if (Math.abs(mouse.wheel) >= 40 && now - mouse.stepAt > 160) {
        s.cycle += Math.sign(mouse.wheel);
        mouse.stepAt = now;
        mouse.wheel = 0;
      }
      if (now - mouse.wheelAt > 250) mouse.wheel = 0;
      busy = busy || mouse.left > 0 || mouse.right > 0 || now - mouse.moved < 500;
      mouse.left = mouse.right = 0;
    }
    s.dir = dir;
    s.active = busy;
  }

  function poll() {
    const now = performance.now();
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const seen = new Set();
    for (const gp of pads) if (gp && gp.connected) seen.add(pollPad(gp));
    for (const [id, s] of states) {
      if (s.kind === 'pad' && !seen.has(id) && s.connected) Object.assign(s, blank(id, 'pad', s.name), { connected: false });
    }
    for (const id in KB) pollKeyboard(id, now);
  }

  function rumble(id, strong, weak, ms) {
    if (!id || !id.startsWith('gp')) return;
    const gp = (navigator.getGamepads ? navigator.getGamepads() : [])[+id.slice(2)];
    const act = gp && gp.vibrationActuator;
    if (act && act.playEffect) {
      act.playEffect('dual-rumble', { startDelay: 0, duration: ms, weakMagnitude: weak, strongMagnitude: strong }).catch(() => {});
    }
  }

  return {
    poll, rumble,
    get: id => states.get(id),
    all: () => [...states.values()].filter(s => s.connected),
    padCount: () => [...states.values()].filter(s => s.kind === 'pad' && s.connected).length,
    // posición del ratón en coordenadas del juego (para dibujar la mira)
    mouse: () => ({ x: mouse.x * World.W, y: mouse.y * World.H, recent: performance.now() - mouse.moved < 3000, aim: mouse.aim }),
    // ignora el clic que sólo sirvió para activar el sonido
    discardClicks() { mouse.left = mouse.right = 0; },
  };
})();
