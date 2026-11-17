// All sound is synthesized with WebAudio — no audio files, no network.
// Gunshots, explosions, pickup chimes, a two-tone police siren, an engine hum
// whose pitch follows speed, and a simple bassline loop. Everything is guarded
// so a browser without audio (or a headless screenshot run) just stays silent.

export function createAudio() {
  let context = null;
  let master = null;
  let muted = false;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let musicTimer = null;
  let musicStep = 0;

  /** Must be called from a user gesture at least once; safe to call any time. */
  function ensure() {
    if (context) {
      if (context.state === 'suspended') context.resume().catch(() => {});
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      context = new AC();
      master = context.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(context.destination);
      startEngine();
      startSiren();
      startMusic();
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!context || muted) return;
    try {
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = type || 'square';
      osc.frequency.setValueAtTime(freq, context.currentTime);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), context.currentTime + dur);
      gain.gain.setValueAtTime(vol, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start();
      osc.stop(context.currentTime + dur + 0.02);
    } catch { /* silent */ }
  }

  function noise(dur, vol, lowFreq) {
    if (!context || muted) return;
    try {
      const len = Math.max(1, Math.floor(context.sampleRate * dur));
      const buffer = context.createBuffer(1, len, context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = context.createBufferSource();
      src.buffer = buffer;
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = lowFreq || 1200;
      const gain = context.createGain();
      gain.gain.value = vol;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      src.start();
    } catch { /* silent */ }
  }

  function startEngine() {
    try {
      engineOsc = context.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineGain = context.createGain();
      engineGain.gain.value = 0;
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 500;
      engineOsc.connect(filter);
      filter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
    } catch { /* silent */ }
  }

  function startSiren() {
    try {
      sirenOsc = context.createOscillator();
      sirenOsc.type = 'sine';
      sirenOsc.frequency.value = 700;
      sirenGain = context.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
    } catch { /* silent */ }
  }

  // Bassline loop: A minor groove, one note every 0.22 s.
  const BASSLINE = [55, 0, 55, 65.41, 0, 55, 82.41, 0, 49, 0, 49, 58.27, 0, 73.42, 65.41, 0];
  function startMusic() {
    musicTimer = window.setInterval(() => {
      if (!context || muted) return;
      const note = BASSLINE[musicStep % BASSLINE.length];
      musicStep += 1;
      if (note > 0) tone(note, 0.2, 'triangle', 0.16);
      if (musicStep % 32 === 0) tone(220, 0.1, 'square', 0.03);
    }, 220);
  }

  /** Called every frame with the player's speed and wanted level. */
  function update(speed, wanted, driving) {
    if (!context) return;
    try {
      if (engineGain) engineGain.gain.value = driving && !muted ? 0.05 + Math.min(0.09, Math.abs(speed) / 9000) : 0;
      if (engineOsc) engineOsc.frequency.value = 50 + Math.abs(speed) * 0.22;
      if (sirenGain) sirenGain.gain.value = wanted > 0 && !muted ? 0.045 : 0;
      if (sirenOsc && wanted > 0) {
        const t = context.currentTime;
        sirenOsc.frequency.setTargetAtTime((Math.floor(t * 1.6) % 2 === 0) ? 660 : 880, t, 0.05);
      }
    } catch { /* silent */ }
  }

  function setMuted(value) {
    muted = value;
    if (master && context) master.gain.value = muted ? 0 : 0.5;
    return muted;
  }

  return {
    ensure,
    update,
    setMuted,
    isMuted() { return muted; },
    shot() { noise(0.12, 0.5, 2400); tone(180, 0.08, 'square', 0.25, 60); },
    punch() { noise(0.08, 0.3, 800); },
    explosion() { noise(0.7, 0.9, 500); tone(70, 0.6, 'sine', 0.5, 30); },
    pickup() { tone(660, 0.1, 'sine', 0.25); tone(990, 0.16, 'sine', 0.25); },
    cash() { tone(880, 0.09, 'sine', 0.22); tone(1174, 0.09, 'sine', 0.22); tone(1568, 0.18, 'sine', 0.22); },
    mission() { tone(523, 0.12, 'triangle', 0.25); tone(659, 0.12, 'triangle', 0.25); tone(784, 0.24, 'triangle', 0.25); },
    busted() { tone(440, 0.3, 'sawtooth', 0.25, 220); tone(330, 0.5, 'sawtooth', 0.25, 165); },
    crash() { noise(0.25, 0.5, 700); },
    door() { tone(140, 0.07, 'square', 0.2, 90); },
  };
}
