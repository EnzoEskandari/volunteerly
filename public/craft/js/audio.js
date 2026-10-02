// Tiny synthesized sound effects (no audio files needed).

let ctx = null;
let master = null;
let noiseBuf = null;
export const audio = { volume: 0.6 };

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = audio.volume;
  master.connect(ctx.destination);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}

export function setVolume(v) {
  audio.volume = v;
  if (master) master.gain.value = v;
}

function env(g, t, a, peak, dec) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
}

function noise(freq, q, dur, vol, type = 'bandpass', vol2) {
  if (!ctx || !audio.volume) return;
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.playbackRate.value = 0.8 + Math.random() * 0.4;
  const f = ctx.createBiquadFilter();
  f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain();
  env(g, t, 0.005, vol, dur);
  src.connect(f); f.connect(g); g.connect(master);
  src.start(t, Math.random() * 0.5, dur + 0.05);
}

function tone(f0, f1, dur, vol, type = 'sine', delay = 0) {
  if (!ctx || !audio.volume) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const g = ctx.createGain();
  env(g, t, 0.01, vol, dur);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + dur + 0.05);
}

const MATERIAL = {
  stone: [900, 1.2, 0.12, 0.5],
  wood: [500, 2.5, 0.12, 0.6],
  grass: [2500, 0.8, 0.12, 0.35],
  gravel: [1400, 0.7, 0.14, 0.45],
  sand: [3200, 0.6, 0.12, 0.3],
  snow: [2800, 0.5, 0.14, 0.3],
  wool: [700, 0.5, 0.1, 0.3],
  glass: [3800, 6, 0.18, 0.4],
};

export const sfx = {
  dig(mat) { const m = MATERIAL[mat] || MATERIAL.stone; noise(m[0], m[1], m[2] * 1.3, m[3]); },
  hit(mat) { const m = MATERIAL[mat] || MATERIAL.stone; noise(m[0] * 1.2, m[1], 0.05, m[3] * 0.35); },
  place(mat) { const m = MATERIAL[mat] || MATERIAL.stone; noise(m[0] * 0.8, m[1], m[2], m[3] * 0.9); },
  step(mat) { const m = MATERIAL[mat] || MATERIAL.stone; noise(m[0], m[1], 0.06, m[3] * 0.18); },
  glass() { noise(4000, 8, 0.3, 0.5); tone(2400, 1800, 0.15, 0.08, 'triangle'); },
  pop() { tone(500 + Math.random() * 300, 1400, 0.08, 0.15); },
  hurt() { tone(320, 180, 0.18, 0.3, 'square'); },
  mobHurt(type) {
    const p = { pig: 500, cow: 160, sheep: 420, chicken: 900, zombie: 130, skeleton: 700, creeper: 260, spider: 300 }[type] || 300;
    tone(p, p * 0.6, 0.18, 0.18, type === 'skeleton' ? 'square' : 'sawtooth');
  },
  mobSay(type) {
    const p = { pig: 420, cow: 110, sheep: 380, chicken: 1100, zombie: 95, skeleton: 600, spider: 220 }[type];
    if (!p) return;
    const d = type === 'cow' ? 0.6 : type === 'zombie' ? 0.7 : 0.3;
    tone(p, p * 0.85, d, 0.06, type === 'sheep' || type === 'cow' ? 'sawtooth' : 'triangle');
  },
  hiss() { noise(5000, 0.5, 1.4, 0.25, 'highpass'); },
  explode() { noise(140, 0.6, 1.4, 1.0, 'lowpass'); noise(600, 0.5, 0.6, 0.6); },
  eat() { for (let i = 0; i < 3; i++) setTimeout(() => noise(1800, 1, 0.07, 0.3), i * 120); },
  burp() { tone(140, 90, 0.25, 0.25, 'sawtooth'); },
  bow() { noise(1200, 2, 0.2, 0.3); },
  click() { tone(900, 900, 0.04, 0.1, 'square'); },
  splash() { noise(1500, 0.4, 0.4, 0.4); },
  levelup() { tone(523, 523, 0.1, 0.1, 'triangle'); tone(784, 784, 0.15, 0.1, 'triangle', 0.1); },
};
