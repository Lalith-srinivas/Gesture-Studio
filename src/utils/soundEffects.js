// Web Audio API Sound Effects Synthesizer
let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function resumeAudio() {
  const ctx = getAudioContext();
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
}

// ── FRUIT NINJA SOUNDS ──
export function playSliceSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  
  // Whoosh filter noise
  const bufferSize = ctx.sampleRate * 0.15;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(1400, now);
  filter.frequency.exponentialRampToValueAtTime(300, now + 0.12);
  filter.Q.setValueAtTime(3, now);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.4, now);
  gain.gain.exponentialRampToValueAtTime(0.01, now + 0.14);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  // High pitch blade swoosh tone
  const osc = ctx.createOscillator();
  const oscGain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(900, now);
  osc.frequency.exponentialRampToValueAtTime(320, now + 0.12);

  oscGain.gain.setValueAtTime(0.25, now);
  oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);

  osc.connect(oscGain);
  oscGain.connect(ctx.destination);

  noise.start(now);
  noise.stop(now + 0.15);
  osc.start(now);
  osc.stop(now + 0.13);
}

export function playBombSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  
  // Low explosion rumble
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(160, now);
  osc.frequency.exponentialRampToValueAtTime(30, now + 0.6);

  gain.gain.setValueAtTime(0.7, now);
  gain.gain.exponentialRampToValueAtTime(0.01, now + 0.65);

  osc.connect(gain);
  gain.connect(ctx.destination);

  // Noise explosion blast
  const bufferSize = ctx.sampleRate * 0.7;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(800, now);
  filter.frequency.exponentialRampToValueAtTime(80, now + 0.6);

  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.8, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.7);

  noise.connect(filter);
  filter.connect(noiseGain);
  noiseGain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.65);
  noise.start(now);
  noise.stop(now + 0.7);
}

// ── CRAZY ROAD (HILL CLIMB) SOUNDS ──
let engineOsc = null;
let engineGain = null;

export function startCarEngineSound() {
  const ctx = getAudioContext();
  if (!ctx || engineOsc) return;

  const now = ctx.currentTime;
  engineOsc = ctx.createOscillator();
  engineGain = ctx.createGain();

  engineOsc.type = 'sawtooth';
  engineOsc.frequency.setValueAtTime(65, now);

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(260, now);

  engineGain.gain.setValueAtTime(0.1, now);

  engineOsc.connect(filter);
  filter.connect(engineGain);
  engineGain.connect(ctx.destination);

  engineOsc.start();
}

export function updateCarEnginePitch(speedRatio = 0) {
  if (!engineOsc || !audioCtx) return;
  const targetFreq = 65 + Math.min(speedRatio, 2.5) * 60;
  engineOsc.frequency.setTargetAtTime(targetFreq, audioCtx.currentTime, 0.08);
}

export function stopCarEngineSound() {
  if (engineOsc) {
    try {
      engineOsc.stop();
      engineOsc.disconnect();
    } catch {}
    engineOsc = null;
    engineGain = null;
  }
}

export function playDashSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(320, now);
  osc.frequency.exponentialRampToValueAtTime(1100, now + 0.28);

  gain.gain.setValueAtTime(0.35, now);
  gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.3);
}

export function playCrashSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'square';
  osc.frequency.setValueAtTime(140, now);
  osc.frequency.exponentialRampToValueAtTime(35, now + 0.4);

  gain.gain.setValueAtTime(0.5, now);
  gain.gain.exponentialRampToValueAtTime(0.01, now + 0.42);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.42);
}

// ── MOB CONTROL SOUNDS ──
export function playPlusSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  // Ascending cheerful chime arpeggio
  const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now + i * 0.05);

    gain.gain.setValueAtTime(0.28, now + i * 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.05 + 0.18);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now + i * 0.05);
    osc.stop(now + i * 0.05 + 0.2);
  });
}

export function playFightSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  
  // Punchy impact hit
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(220, now);
  osc.frequency.exponentialRampToValueAtTime(55, now + 0.08);

  gain.gain.setValueAtTime(0.4, now);
  gain.gain.exponentialRampToValueAtTime(0.01, now + 0.09);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.09);
}

// ── FLAPPY BIRD SOUNDS ──
export function playPinchSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(360, now);
  osc.frequency.exponentialRampToValueAtTime(740, now + 0.11);

  gain.gain.setValueAtTime(0.3, now);
  gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.12);
}

export function playFailSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  
  // Descending sad buzzer
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(380, now);
  osc.frequency.linearRampToValueAtTime(210, now + 0.22);
  osc.frequency.linearRampToValueAtTime(95, now + 0.45);

  gain.gain.setValueAtTime(0.35, now);
  gain.gain.exponentialRampToValueAtTime(0.01, now + 0.48);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.5);
}
