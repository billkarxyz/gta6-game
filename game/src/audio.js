// audio.js — every sound in the game is synthesised with the WebAudio API:
// no audio files, no network. Engine hum, sirens, gunshots, explosions and
// pickup blips are all oscillators and filtered noise, built on the fly.
export function createAudio() {
  return {
    ctx: null,
    master: null,
    muted: false,
    engineOsc: null,
    engineGain: null,
    sirenOsc: null,
    sirenGain: null,
    sirenTimer: 0,
  };
}

// The context can only start after a user gesture, so main.js calls this on
// the first click or keypress.
export function initAudio(a) {
  if (a.ctx) return;
  try {
    a.ctx = new (window.AudioContext || window.webkitAudioContext)();
    a.master = a.ctx.createGain();
    a.master.gain.value = 0.5;
    a.master.connect(a.ctx.destination);
  } catch (e) {
    a.ctx = null;
  }
}

export function setMuted(a, muted) {
  a.muted = muted;
  if (a.master) a.master.gain.value = muted ? 0 : 0.5;
}

function noiseBuffer(ctx, seconds) {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function blip(a, freq, dur, type, vol, slideTo) {
  if (!a.ctx || a.muted) return;
  const t = a.ctx.currentTime;
  const osc = a.ctx.createOscillator();
  const gain = a.ctx.createGain();
  osc.type = type || 'sine';
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  gain.gain.setValueAtTime(vol || 0.2, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(gain).connect(a.master);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function noise(a, dur, vol, filterFreq) {
  if (!a.ctx || a.muted) return;
  const t = a.ctx.currentTime;
  const src = a.ctx.createBufferSource();
  src.buffer = noiseBuffer(a.ctx, dur);
  const filter = a.ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = filterFreq || 1200;
  const gain = a.ctx.createGain();
  gain.gain.setValueAtTime(vol || 0.3, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(filter).connect(gain).connect(a.master);
  src.start(t);
}

export const sfx = {
  shoot(a) { noise(a, 0.12, 0.35, 3000); blip(a, 160, 0.08, 'square', 0.12, 60); },
  explosion(a) { noise(a, 0.7, 0.6, 500); blip(a, 70, 0.5, 'sine', 0.5, 30); },
  crash(a) { noise(a, 0.25, 0.4, 900); },
  pickup(a) { blip(a, 660, 0.12, 'sine', 0.25); setTimeout(() => blip(a, 990, 0.14, 'sine', 0.25), 70); },
  cash(a) { blip(a, 880, 0.1, 'triangle', 0.25); setTimeout(() => blip(a, 1320, 0.16, 'triangle', 0.25), 80); },
  mission(a) {
    [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => blip(a, f, 0.22, 'triangle', 0.25), i * 110));
  },
  fail(a) { blip(a, 330, 0.25, 'sawtooth', 0.18, 220); setTimeout(() => blip(a, 220, 0.4, 'sawtooth', 0.18, 140), 200); },
  click(a) { blip(a, 800, 0.06, 'square', 0.1); },
  horn(a) { blip(a, 370, 0.25, 'square', 0.15); blip(a, 440, 0.25, 'square', 0.12); },
  door(a) { noise(a, 0.08, 0.2, 800); },
};

// The engine is a continuous sawtooth whose pitch follows the car's speed.
export function updateEngine(a, speed, driving) {
  if (!a.ctx) return;
  if (!driving || a.muted) {
    if (a.engineGain) a.engineGain.gain.value = 0;
    return;
  }
  if (!a.engineOsc) {
    a.engineOsc = a.ctx.createOscillator();
    a.engineOsc.type = 'sawtooth';
    a.engineGain = a.ctx.createGain();
    a.engineGain.gain.value = 0;
    const filter = a.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 500;
    a.engineOsc.connect(filter).connect(a.engineGain).connect(a.master);
    a.engineOsc.start();
  }
  const t = a.ctx.currentTime;
  a.engineOsc.frequency.setTargetAtTime(55 + Math.abs(speed) * 0.22, t, 0.05);
  a.engineGain.gain.setTargetAtTime(0.06 + Math.min(0.08, Math.abs(speed) * 0.0002), t, 0.1);
}

// The siren wails while any police car is near the player.
export function updateSiren(a, active, dt) {
  if (!a.ctx) return;
  if (!active || a.muted) {
    if (a.sirenGain) a.sirenGain.gain.value = 0;
    return;
  }
  if (!a.sirenOsc) {
    a.sirenOsc = a.ctx.createOscillator();
    a.sirenOsc.type = 'triangle';
    a.sirenGain = a.ctx.createGain();
    a.sirenGain.gain.value = 0;
    a.sirenOsc.connect(a.sirenGain).connect(a.master);
    a.sirenOsc.start();
  }
  a.sirenTimer += dt;
  const phase = (a.sirenTimer % 0.9) < 0.45 ? 700 : 950;
  a.sirenOsc.frequency.setTargetAtTime(phase, a.ctx.currentTime, 0.03);
  a.sirenGain.gain.setTargetAtTime(0.05, a.ctx.currentTime, 0.1);
}
