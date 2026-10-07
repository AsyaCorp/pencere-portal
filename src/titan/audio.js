// Synthesized sound for Titan mode (no samples, no music). Only the focused
// window plays, so several open windows don't double every sound.

export function createAudio() {
  let ctx = null;
  let master = null;
  let noiseBuf = null;
  let reel = null;
  let drone = null;

  function unlock() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return;
    }
    ctx = new AudioContext();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    master = ctx.createGain();
    master.gain.value = 0.7;
    master.connect(comp).connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    reel = loopNoise('bandpass', 1400, 0);
    drone = makeDrone();
  }
  for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, unlock);

  const live = () => ctx && ctx.state === 'running' && document.hasFocus();

  function noise(dur, type, f0, f1, gain, at = 0, q = 0.8) {
    const t = ctx.currentTime + at;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const flt = ctx.createBiquadFilter();
    flt.type = type;
    flt.Q.value = q;
    flt.frequency.setValueAtTime(f0, t);
    flt.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + Math.min(0.02, dur * 0.2));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(flt).connect(g).connect(master);
    src.start(t, Math.random() * 1.5);
    src.stop(t + dur + 0.05);
  }

  function tone(dur, type, f0, f1, gain, at = 0) {
    const t = ctx.currentTime + at;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  function loopNoise(type, freq, gain) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const flt = ctx.createBiquadFilter();
    flt.type = type;
    flt.frequency.value = freq;
    flt.Q.value = 1.2;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(flt).connect(g).connect(master);
    src.start();
    return { g, flt };
  }

  // Low, slowly beating strings-like bed under everything.
  function makeDrone() {
    const flt = ctx.createBiquadFilter();
    flt.type = 'lowpass';
    flt.frequency.value = 260;
    const g = ctx.createGain();
    g.gain.value = 0;
    flt.connect(g).connect(master);
    for (const [f, det] of [
      [55, -6],
      [55, 7],
      [82.4, 3],
      [110, -4],
    ]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.detune.value = det;
      const og = ctx.createGain();
      og.gain.value = 0.25;
      o.connect(og).connect(flt);
      o.start();
    }
    const wind = loopNoise('lowpass', 500, 0);
    return { g, flt, wind };
  }

  const sounds = {
    hook() {
      noise(0.05, 'bandpass', 3200, 2000, 0.5);
      tone(0.05, 'square', 1900, 700, 0.12);
      noise(0.18, 'highpass', 5000, 2500, 0.18, 0.02);
    },
    miss() {
      noise(0.16, 'highpass', 4000, 1500, 0.12);
    },
    gas() {
      noise(0.45, 'lowpass', 7000, 800, 0.5);
      noise(0.3, 'bandpass', 1200, 400, 0.25);
    },
    kill() {
      noise(0.06, 'highpass', 6000, 3000, 0.7);
      tone(0.5, 'sine', 2600, 2500, 0.12);
      tone(0.6, 'sine', 3950, 3900, 0.08);
      noise(2.2, 'lowpass', 5000, 600, 0.55, 0.08);
      tone(1.2, 'sine', 70, 32, 0.8, 0.05);
    },
    reach() {
      tone(0.5, 'sawtooth', 90, 60, 0.12);
    },
    caught() {
      noise(0.25, 'lowpass', 900, 200, 0.9);
      tone(0.4, 'sine', 90, 40, 0.8);
    },
    eaten() {
      noise(0.5, 'lowpass', 600, 120, 0.7);
    },
    fall() {
      noise(0.9, 'bandpass', 900, 200, 0.3);
    },
    colossal() {
      tone(4.5, 'sine', 38, 30, 0.9);
      noise(4, 'lowpass', 200, 900, 0.6, 0.5);
      for (const [f, d] of [
        [55, 0],
        [58, 0.05],
        [82, 0.1],
      ]) tone(3.2, 'sawtooth', f, f * 0.8, 0.22, 3.0 + d);
      noise(3, 'bandpass', 400, 1600, 0.5, 3.0, 2);
    },
    shock() {
      tone(3, 'sine', 50, 22, 1.0);
      noise(3.5, 'lowpass', 3000, 150, 0.9);
    },
    slain() {
      noise(0.08, 'highpass', 7000, 3000, 0.8);
      tone(0.8, 'sine', 2600, 2500, 0.15);
      noise(5, 'lowpass', 6000, 300, 0.8, 0.1);
      tone(3, 'sine', 45, 25, 0.9, 0.1);
    },
    over() {
      tone(2.5, 'sawtooth', 110, 55, 0.12);
    },
    step(size) {
      tone(0.35, 'sine', 60 + 30 * (1 - size), 32, 0.25 + size * 0.35);
      noise(0.2, 'lowpass', 300, 80, 0.15 + size * 0.2);
    },
  };

  return {
    play(kind, ...args) {
      if (!live() || !sounds[kind]) return;
      sounds[kind](...args);
    },
    // Per-frame continuous layers: rope reel, wind with speed, tension bed.
    frame(reeling, speed, tension, on) {
      if (!ctx) return;
      const t = ctx.currentTime;
      const audible = on && live();
      reel.g.gain.setTargetAtTime(audible && reeling ? 0.12 : 0, t, 0.05);
      reel.flt.frequency.setTargetAtTime(900 + speed * 0.8, t, 0.1);
      drone.wind.g.gain.setTargetAtTime(audible ? Math.min(0.18, speed / 6000) : 0, t, 0.2);
      drone.g.gain.setTargetAtTime(audible ? 0.05 + tension * 0.08 : 0, t, 0.5);
      drone.flt.frequency.setTargetAtTime(240 + tension * 900, t, 0.8);
    },
  };
}
