'use strict';
/* ==========================================================
   CAZADORES DE LO INVISIBLE — configuración, física y textos
   IFUNAM · Día de Puertas Abiertas
   ========================================================== */

const FONT = '"Avenir Next", "Segoe UI", "Helvetica Neue", Helvetica, Arial, sans-serif';

// Colores de los botones del control de Xbox
const XBOX = { A: '#5ec424', B: '#e8382c', X: '#2f7fe6', Y: '#f5c400' };
const PLAYER_COLORS = ['#22e3ff', '#ff4fd8']; // los cambia el tema
const PLAYER_NAMES = ['JUGADOR 1', 'JUGADOR 2'];

// Teclas de material para quien juega con teclado (en el orden de MATERIALS)
const KEY_LABELS = { kbm: ['1', '2', '3', '4'], kb2: ['Z', 'X', 'C', 'V'] };
const joinOr = arr => arr.filter(Boolean).join(' o ');
// Pistas que dependen de con qué juega cada quien ('pad', 'kbm', 'kb2', 'touch')
const HINTS = {
  aim: kinds => `Gira tu escudo hacia la fuente con ${joinOr(kinds.map(k => ({ pad: 'el stick ← →', kbm: 'el ratón o las flechas ← →', kb2: 'A / D', touch: 'las flechas de la izquierda' })[k]))}`,
  switch: kinds => `Cambia de material con ${joinOr(kinds.map(k => ({ pad: 'A B X Y', kbm: 'las teclas 1 2 3 4 o el clic', kb2: 'Z X C V', touch: 'los botones de la derecha' })[k]))}`,
};

// Velocidad de giro del escudo (radianes por segundo) con el material más ligero.
// SHIELD_SPIN: stick, cruceta o flechas a fondo (7 rad/s = media vuelta en ~0.45 s).
// SHIELD_TURN: qué tan rápido alcanza al ratón cuando se apunta con él.
const SHIELD_SPIN = 7;
const SHIELD_TURN = 12;

// Materiales de blindaje.
// speed: fracción de SHIELD_SPIN / SHIELD_TURN (los materiales pesados hacen el escudo un poco más lento).
const MATERIALS = [
  { id: 'papel',    name: 'Papel',    btn: 'A', speed: 1.00, thick: 9,  fill: '#f1e7cc' },
  { id: 'aluminio', name: 'Aluminio', btn: 'B', speed: 0.86, thick: 13, fill: '#c3ccd8' },
  { id: 'plomo',    name: 'Plomo',    btn: 'X', speed: 0.62, thick: 21, fill: '#5a6274' },
  { id: 'agua',     name: 'Agua',     btn: 'Y', speed: 0.74, thick: 17, fill: '#2d8cff' },
];

// Tipos de radiación. El color de la traza coincide con el botón del material ideal.
// damage: daño al ADN si llega a la célula (las alfa y los neutrones dañan más: factor de ponderación).
const PTYPES = {
  alpha:   { sym: 'α', name: 'Alfa',    color: '#86ff4d', speed: 175,  damage: 6, ideal: 'papel' },
  beta:    { sym: 'β', name: 'Beta',    color: '#ff6252', speed: 330,  damage: 4, ideal: 'aluminio' },
  gamma:   { sym: 'γ', name: 'Gamma',   color: '#5aa9ff', speed: 470,  damage: 4, ideal: 'plomo' },
  neutron: { sym: 'n', name: 'Neutrón', color: '#ffd34d', speed: 210,  damage: 6, ideal: 'agua' },
  xray:    { sym: 'X', name: 'Rayos X', color: '#c7a8ff', speed: 470,  damage: 2, ideal: 'plomo' },
  muon:    { sym: 'μ', name: 'Muón',    color: '#ffffff', speed: 1500, damage: 0 },
};
// ─── Temas de color ───
// "claro": para salones con luz (proyector): fondo claro y trazas que manchan como tinta.
// "oscuro": para cuartos oscuros: fondo negro y trazas que brillan.
// blend: cómo se dibujan las gotitas ('multiply' oscurece, 'lighter' suma luz).
// dim, band y drop son "r,g,b" para usarlos con distintas transparencias.
const THEMES = {
  claro: {
    blend: 'multiply',
    bg: ['#f7fafe', '#e6eef8', '#cddbeb'], vig: 'rgba(90,120,165,0.28)', fog: '#7f9cc4', mist: '#8aa0bd',
    text: '#0f1d33', soft: '#2f4766', muted: '#5a7190', title: '#0b2a4a', title2: '#0a6fa8', glow: 'rgba(0,140,220,0.35)',
    gold: '#b87800', good: '#0e9a52', bad: '#d1302a', warn: '#d97000', info: '#0b86c4',
    outline: 'rgba(255,255,255,0.9)',
    panel: 'rgba(255,255,255,0.88)', panelStrong: 'rgba(255,255,255,0.96)', panelStroke: 'rgba(30,60,110,0.22)',
    card: 'rgba(255,255,255,0.97)', sample: '#f6f9fd', dim: '214,226,240', band: '235,242,250',
    track: 'rgba(20,45,90,0.12)', ring: 'rgba(30,70,130,0.28)', drop: '90,140,200',
    memb: '#0f9e84', nucleus: '#6a4fd8', dna1: '#5b3fc4', dna2: '#0b7fb0', rungA: '#d39200',
    organelle: 'rgba(225,120,30,0.35)', flash: '#5a6f8f', shieldEdge: 'rgba(25,35,55,0.6)',
    real: '#1e2a38', players: ['#008fc2', '#cc1d9b'],
    tracks: { alpha: '#2fa800', beta: '#dc2a1d', gamma: '#1b62dc', neutron: '#df9000', xray: '#7a3fdc', muon: '#3a4656' },
    // fondo decorado: [base, rayos, acento] para el título y cada oleada
    decor: {
      titulo: ['#eef5ff', '#dce9fb', '#7fa6e0'], alpha: ['#f0fbf1', '#d9f2de', '#6cc27c'],
      beta: ['#fff3f0', '#fcdcd4', '#ea8a7b'], gamma: ['#eef3ff', '#d8e3fd', '#7f9feb'],
      neutron: ['#fff9ea', '#fbe8bb', '#e0b24a'], real: ['#f4f0fe', '#e2d8fb', '#9a83e0'],
    },
    doodleAlpha: 0.2,
  },
  oscuro: {
    blend: 'lighter',
    bg: ['#0e1f36', '#07111f', '#020509'], vig: 'rgba(0,0,0,0.6)', fog: '#96c3ff', mist: '#cfe3ff',
    text: '#ffffff', soft: '#cfe0f5', muted: '#8fb3d9', title: '#eaf6ff', title2: '#7fe3ff', glow: '#3fd0ff',
    gold: '#ffd34d', good: '#5df2a0', bad: '#ff6b5c', warn: '#ff9f43', info: '#5ad1ff',
    outline: 'rgba(0,0,0,0.65)',
    panel: 'rgba(6,14,28,0.8)', panelStrong: 'rgba(4,10,22,0.92)', panelStroke: 'rgba(130,180,255,0.22)',
    card: 'rgba(7,15,30,0.96)', sample: 'rgba(2,8,18,0.9)', dim: '2,6,14', band: '4,10,22',
    track: 'rgba(255,255,255,0.1)', ring: 'rgba(150,200,255,0.18)', drop: '200,230,255',
    memb: '#6fe6c9', nucleus: '#a68cff', dna1: '#d6c7ff', dna2: '#9fe7ff', rungA: '#ffcf5a',
    organelle: 'rgba(255,190,120,0.32)', flash: '#ffffff', shieldEdge: 'rgba(0,0,0,0.35)',
    real: '#e9f3ff', players: ['#22e3ff', '#ff4fd8'],
    tracks: { alpha: '#86ff4d', beta: '#ff6252', gamma: '#5aa9ff', neutron: '#ffd34d', xray: '#c7a8ff', muon: '#ffffff' },
    decor: {
      titulo: ['#07101d', '#0b1729', '#2a4a7a'], alpha: ['#06120b', '#0a1c11', '#2f6a3c'],
      beta: ['#140909', '#1e0e0e', '#7a3530'], gamma: ['#070e1d', '#0c162c', '#2c4c8a'],
      neutron: ['#120e05', '#1c160a', '#7a6125'], real: ['#0d0918', '#160f26', '#55407e'],
    },
    doodleAlpha: 0.12,
  },
};
let T = THEMES.claro;
function applyTheme(name) {
  T = THEMES[name] || THEMES.claro;
  T.name = THEMES[name] ? name : 'claro';
  for (const k in T.tracks) PTYPES[k].color = T.tracks[k];
  T.players.forEach((c, i) => (PLAYER_COLORS[i] = c));
}

// Radiación que amenaza a la célula (las demás son trazas secundarias, solo visuales)
const THREAT = { alpha: 1, beta: 1, gamma: 1, neutron: 1, xray: 1 };

// Probabilidad de que cada material frene cada radiación.
// Los gamma nunca se frenan al 100 %: su intensidad baja exponencialmente con el grosor.
const STOP = {
  alpha:   { papel: 1.00, aluminio: 1.00, plomo: 1.00, agua: 1.00 },
  beta:    { papel: 0.00, aluminio: 1.00, plomo: 1.00, agua: 1.00 },
  gamma:   { papel: 0.00, aluminio: 0.12, plomo: 0.90, agua: 0.20 },
  neutron: { papel: 0.00, aluminio: 0.05, plomo: 0.08, agua: 0.92 },
  xray:    { papel: 0.00, aluminio: 0.30, plomo: 0.95, agua: 0.40 },
};
const BREMS_CHANCE = 0.45; // beta frenada en plomo → rayos X de frenado

// Fuentes radiactivas (count: cuántas partículas emite cada aparición)
const SOURCES = {
  am241:  { short: 'Am-241', name: 'Americio-241',      emits: ['alpha'],                 count: [2, 3] },
  radon:  { short: 'Rn-222', name: 'Radón-222',         emits: ['alpha'],                 count: [2, 3] },
  sr90:   { short: 'Sr-90',  name: 'Estroncio-90',      emits: ['beta'],                  count: [2, 3] },
  cs137:  { short: 'Cs-137', name: 'Cesio-137',         emits: ['gamma'],                 count: [2, 3] },
  co60:   { short: 'Co-60',  name: 'Cobalto-60',        emits: ['gamma'],                 count: [2, 3] },
  ambe:   { short: 'Am-Be',  name: 'Fuente de neutrones', emits: ['neutron'],             count: [2, 3] },
  uranio: { short: 'Uranio', name: 'Mineral de uranio', emits: ['alpha', 'beta', 'gamma'], count: [3, 4] },
};

// Oleadas. maxActive: fuentes a la vez con un jugador (con dos jugadores hay una más y salen más seguido).
const WAVES = [
  { title: 'Partículas ALFA',  intro: 'alpha',   duration: 26, pool: ['am241'],                                   gap: [2.2, 3.0], maxActive: 1,
    hint: 'aim' },
  { title: 'Partículas BETA',  intro: 'beta',    duration: 28, pool: ['sr90', 'sr90', 'am241'],                   gap: [2.0, 2.8], maxActive: 2,
    hint: 'switch' },
  { title: 'Rayos GAMMA',      intro: 'gamma',   duration: 30, pool: ['cs137', 'co60', 'sr90', 'am241'],          gap: [2.2, 2.9], maxActive: 2,
    hint: 'El plomo es pesado: tu escudo girará más lento' },
  { title: 'NEUTRONES',        intro: 'neutron', duration: 30, pool: ['ambe', 'ambe', 'cs137', 'sr90', 'am241'],  gap: [2.1, 2.8], maxActive: 2,
    hint: 'Los neutrones atraviesan el plomo: usa agua' },
  { title: 'Visión real',      intro: 'real',    duration: 34, pool: ['uranio', 'radon', 'ambe', 'cs137', 'sr90', 'co60'], gap: [2.2, 2.8], maxActive: 2, real: true,
    hint: 'Reconoce cada radiación por la forma de su traza' },
];

// Tarjetas que presentan cada radiación
const CARDS = {
  alpha: {
    kicker: 'NUEVA RADIACIÓN', title: 'Partícula ALFA', sym: 'α', type: 'alpha', btn: 'A',
    lines: [
      'Es un núcleo de helio: 2 protones y 2 neutrones. ¡Pesada y con carga!',
      'Choca con muchísimos átomos y les arranca electrones: ioniza muy fuerte.',
      'Su traza es GRUESA, RECTA y CORTA. Suelta casi toda su energía al final.',
    ],
    stop: 'Se frena con una hoja de PAPEL (¡o con tu piel!)',
  },
  beta: {
    kicker: 'NUEVA RADIACIÓN', title: 'Partícula BETA', sym: 'β', type: 'beta', btn: 'B',
    lines: [
      'Es un electrón que sale disparado de un núcleo inestable.',
      'Es ligera y rápida: rebota con los átomos y cambia de dirección.',
      'Su traza es DELGADA y en ZIGZAG.',
      'Ojo: si la frenas con plomo se producen rayos X de frenado.',
    ],
    stop: 'La frenan unos milímetros de ALUMINIO',
  },
  gamma: {
    kicker: 'NUEVA RADIACIÓN', title: 'Rayo GAMMA', sym: 'γ', type: 'gamma', btn: 'X',
    lines: [
      'Es luz invisible de altísima energía: un fotón, sin masa ni carga.',
      'Casi no deja rastro: solo vemos los electrones que arranca de vez en',
      'cuando (efecto fotoeléctrico y efecto Compton).',
      'Es muy penetrante: unos pocos atraviesan incluso el plomo.',
    ],
    stop: 'Para frenarlo necesitas PLOMO',
  },
  neutron: {
    kicker: 'NUEVA RADIACIÓN', title: 'NEUTRÓN', sym: 'n', type: 'neutron', btn: 'Y',
    lines: [
      'No tiene carga eléctrica: no arranca electrones directamente. ¡Es invisible!',
      'Lo delatan los núcleos que golpea: trazas cortitas que aparecen de la nada.',
      'Atraviesa el plomo, pero el hidrógeno del agua lo frena choque a choque,',
      'como bolas de billar de la misma masa.',
    ],
    stop: 'Para frenarlo usa AGUA (rica en hidrógeno)',
  },
  real: {
    kicker: 'OLEADA FINAL', title: 'Visión real: cámara de niebla', sym: '◉', type: null, btn: null,
    lines: [
      'En una cámara de niebla de verdad todas las trazas son blancas.',
      'Ahora tendrás que reconocer cada radiación por la FORMA de su traza.',
      'El mineral de uranio emite α, β y γ: ¡cambia de escudo rápido!',
    ],
    stop: 'Las fuentes ya no dicen qué emiten: ¡fíjate en la traza!',
  },
};

// Datos curiosos que aparecen durante el juego
const FACTS = [
  'Radiación ionizante: tiene energía suficiente para arrancar electrones de los átomos.',
  'En una cámara de niebla, los iones que deja una partícula se vuelven semillas de gotitas de alcohol.',
  'C. T. R. Wilson inventó la cámara de niebla y ganó el Nobel de Física en 1927.',
  'Henri Becquerel descubrió la radiactividad en 1896 con sales de uranio.',
  'Marie Curie acuñó la palabra "radiactividad" y ganó dos premios Nobel.',
  'Las alfa sueltan casi toda su energía al final de su camino: es el pico de Bragg.',
  'El pico de Bragg se aprovecha en la terapia con protones contra el cáncer.',
  'Muchos detectores de humo usan una pequeña fuente de americio-241, que emite alfas.',
  'El radón es un gas radiactivo que sale del suelo: es la mayor fuente de radiación natural.',
  'Recibimos en promedio unos 2.4 mSv al año de radiación natural.',
  'Tu cuerpo tiene potasio-40: unas 4,000 desintegraciones radiactivas por segundo.',
  'Los rayos gamma son luz: viajan a la velocidad de la luz y no tienen carga.',
  'El positrón, la antipartícula del electrón, se descubrió en 1932 en una cámara de niebla.',
  'Los muones viven 2.2 microsegundos: llegan al suelo gracias a la dilatación del tiempo de Einstein.',
  'El cobalto-60 se usa para esterilizar material médico y en radioterapia.',
  'Tus células tienen maquinaria para reparar el ADN dañado.',
];

// Mensajes que aparecen la primera vez que ocurre algo
const EVENTS = {
  firstBlock: '¡Bien! La partícula ionizó tu escudo en lugar de la célula.',
  heavy: 'Funciona, pero ese material es más pesado de lo necesario: tu escudo gira más lento.',
  pass_beta_papel: 'Las beta atraviesan el papel. ¡Usa ALUMINIO!',
  pass_gamma: 'Los gamma atraviesan casi todo. ¡Usa PLOMO!',
  pass_gamma_plomo: 'Ningún blindaje frena el 100 % de los gamma: el plomo solo reduce cuántos pasan.',
  pass_neutron: 'Los neutrones no tienen carga: ¡atraviesan hasta el plomo! Usa AGUA.',
  brems: '¡Rayos X de frenado (bremsstrahlung)! Para las beta es mejor el aluminio.',
  firstHit: '¡Impacto! La radiación ionizó el ADN: le arrancó electrones a sus moléculas.',
  muon: 'Esa traza larga fue un MUÓN cósmico: viene del espacio y lo atraviesa todo.',
  muon2: 'Al nivel del mar te atraviesa aproximadamente 1 muón por cm² cada minuto.',
  repair: 'Si la proteges, la célula repara su ADN poco a poco.',
  p2join: '¡Llegó refuerzo! El Jugador 2 se une a la cacería.',
};

// Rangos al final del juego (según qué tan bien se eligió el material y cuánto ADN quedó)
const RANKS = [
  { min: 0.82, name: '¡Leyenda de lo invisible!' },
  { min: 0.65, name: 'Mente cuántica' },
  { min: 0.48, name: 'Cámara de niebla viviente' },
  { min: 0.28, name: 'Contador Geiger' },
  { min: 0.00, name: 'Gotita de niebla' },
];
