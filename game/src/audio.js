// Sound, all synthesised with the Web Audio API: no audio files, nothing to load. An engine
// hum follows the player's speed, a two-tone siren follows the nearest police car, and one-shot
// blips cover gunfire, crashes, pickups and mission jingles. Everything is guarded so a browser
// with no audio (or audio not yet unlocked by a gesture) simply plays silent.
const SIREN_NOTES = [660, 880];

export function createAudio() {
  let context = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenStep = 0;
  let sirenTimer = 0;
  let muted = false;

  function ensure() {
    if (context) return true;
    if (typeof window === 'undefined') return false;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = 0.5;
      master.connect(context.destination);
      return true;
    } catch {
      return false;
    }
  }

  /** Call on the first user gesture: browsers keep audio locked until one. */
  function unlock() {
    if (!ensure()) return;
    if (context.state === 'suspended') context.resume().catch(() => {});
  }

  function tone(frequency, duration, type, volume, slideTo) {
    if (!ensure() || muted || context.state !== 'running') return;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(frequency, context.currentTime);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, context.currentTime + duration);
    gain.gain.setValueAtTime(volume, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start();
    osc.stop(context.currentTime + duration + 0.02);
  }

  function noise(duration, volume, lowpass) {
    if (!ensure() || muted || context.state !== 'running') return;
    const length = Math.max(1, Math.floor(context.sampleRate * duration));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const gain = context.createGain();
    gain.gain.value = volume;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass || 1200;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start();
  }

  return {
    unlock,
    setMuted(value) {
      muted = value;
      if (master) master.gain.value = muted ? 0 : 0.5;
    },
    isMuted() { return muted; },

    /** The engine hum, called every frame with the player's speed (0 when on foot). */
    engine(speed01) {
      if (!ensure() || muted || context.state !== 'running') {
        if (engineGain) engineGain.gain.value = 0;
        return;
      }
      if (!engineOsc) {
        engineOsc = context.createOscillator();
        engineOsc.type = 'sawtooth';
        engineGain = context.createGain();
        engineGain.gain.value = 0;
        const filter = context.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 400;
        engineOsc.connect(filter);
        filter.connect(engineGain);
        engineGain.connect(master);
        engineOsc.start();
      }
      engineOsc.frequency.value = 55 + speed01 * 110;
      engineGain.gain.value = speed01 > 0.02 ? 0.04 + speed01 * 0.05 : 0;
    },

    /** The siren, called every frame with whether any police car is near. */
    siren(active, dt) {
      if (!ensure() || muted || context.state !== 'running' || !active) {
        if (sirenGain) sirenGain.gain.value = 0;
        return;
      }
      if (!sirenOsc) {
        sirenOsc = context.createOscillator();
        sirenOsc.type = 'triangle';
        sirenGain = context.createGain();
        sirenGain.gain.value = 0;
        sirenOsc.connect(sirenGain);
        sirenGain.connect(master);
        sirenOsc.start();
      }
      sirenTimer -= dt;
      if (sirenTimer <= 0) {
        sirenTimer = 0.45;
        sirenStep = 1 - sirenStep;
        sirenOsc.frequency.value = SIREN_NOTES[sirenStep];
      }
      sirenGain.gain.value = 0.05;
    },

    shot() { noise(0.12, 0.5, 2400); tone(180, 0.08, 'square', 0.2, 60); },
    crash() { noise(0.25, 0.5, 700); tone(90, 0.2, 'sine', 0.4, 40); },
    explosion() { noise(0.7, 0.7, 500); tone(60, 0.6, 'sine', 0.5, 30); },
    pickup() { tone(880, 0.1, 'sine', 0.3); tone(1320, 0.14, 'sine', 0.25); },
    cash() { tone(1046, 0.08, 'sine', 0.3); tone(1318, 0.08, 'sine', 0.3); tone(1568, 0.16, 'sine', 0.3); },
    mission() { tone(523, 0.12, 'triangle', 0.3); tone(659, 0.12, 'triangle', 0.3); tone(784, 0.12, 'triangle', 0.3); tone(1046, 0.24, 'triangle', 0.35); },
    fail() { tone(392, 0.2, 'triangle', 0.3, 330); tone(330, 0.3, 'triangle', 0.3, 262); },
    sirenBlip() { tone(880, 0.12, 'triangle', 0.2); },
    door() { tone(220, 0.06, 'square', 0.15, 160); },
  };
}
