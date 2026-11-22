// Procedural audio with the Web Audio API: engine hum, gunshots, sirens, chimes.
// No audio files — every sound is synthesized. The context is created on the first
// user gesture (pressing ENTER), as browsers require.

let ctx = null;
let master = null;
let engineNodes = null;
let sirenTimer = 0;
let sirenOn = false;

export function initAudio() {
  if (ctx) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  } catch (err) { ctx = null; }
}

export function resumeAudio() { if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {}); }

function noiseBurst(dur, freq, gain, type = 'lowpass') {
  if (!ctx) return;
  const len = Math.floor(ctx.sampleRate * dur);
  const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = freq;
  const g = ctx.createGain();
  const t = ctx.currentTime;
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(filter).connect(g).connect(master);
  src.start(t);
  src.stop(t + dur);
}

function tone(freq, dur, gain, shape = 'sine', sweepTo = null) {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  const t = ctx.currentTime;
  osc.type = shape;
  osc.frequency.setValueAtTime(freq, t);
  if (sweepTo !== null) osc.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(g).connect(master);
  osc.start(t);
  osc.stop(t + dur);
}

export const audio = {
  init() { initAudio(); resumeAudio(); },
  // Engine: a sawtooth whose pitch tracks road speed. Started on entering a vehicle.
  startEngine() {
    if (!ctx || engineNodes) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = 60;
    g.gain.value = 0.05;
    osc.connect(g).connect(master);
    osc.start();
    engineNodes = { osc, g };
  },
  setEngine(speedFrac) {
    if (!engineNodes) return;
    const f = 55 + speedFrac * 170;
    engineNodes.osc.frequency.setTargetAtTime(f, ctx.currentTime, 0.08);
    engineNodes.g.gain.setTargetAtTime(0.035 + speedFrac * 0.045, ctx.currentTime, 0.1);
  },
  stopEngine() {
    if (!engineNodes) return;
    const { osc, g } = engineNodes;
    g.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
    osc.stop(ctx.currentTime + 0.4);
    engineNodes = null;
  },
  shot() { noiseBurst(0.14, 1600, 0.32, 'lowpass'); tone(180, 0.09, 0.18, 'square', 70); },
  punch() { tone(90, 0.12, 0.22, 'sine', 45); },
  hit() { noiseBurst(0.08, 900, 0.16); },
  explosion() { noiseBurst(0.5, 500, 0.4); tone(70, 0.4, 0.3, 'sine', 30); },
  chime() { tone(880, 0.12, 0.18, 'sine'); setTimeout(() => tone(1320, 0.16, 0.16, 'sine'), 110); },
  pickup() { tone(660, 0.1, 0.14, 'square', 990); },
  hurt() { noiseBurst(0.12, 500, 0.2); },
  siren(active) { sirenOn = active; },
  // Called every frame; schedules the two-tone sweep while the siren is active.
  update(dt) {
    if (!ctx || !sirenOn) { sirenTimer = 0; return; }
    sirenTimer -= dt;
    if (sirenTimer <= 0) {
      sirenTimer = 0.85;
      tone(720, 0.38, 0.09, 'sine', 520);
      setTimeout(() => tone(520, 0.38, 0.09, 'sine', 720), 420);
    }
  },
};
