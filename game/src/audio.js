// audio.js — every sound is synthesized with WebAudio, no audio files.
// Nothing plays before the first user gesture: the AudioContext is
// created lazily on that gesture and every call guards on it.
let ctx = null;
let muted = false;
let cricketTimer = null;

export function ensureAudio() {
  if (!ctx) {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) ctx = new AC();
    } catch (e) {
      ctx = null;
    }
  }
  if (ctx && ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function isMuted() {
  return muted;
}

export function toggleMute() {
  muted = !muted;
  return muted;
}

function tone(freq, duration, type, volume, when = 0, slideTo = null) {
  if (!ctx || muted) return;
  const t0 = ctx.currentTime + when;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + duration);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(volume, t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
}

function noiseTick(duration, volume, lowpassFreq) {
  if (!ctx || muted) return;
  const t0 = ctx.currentTime;
  const len = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = lowpassFreq;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(volume, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  src.start(t0);
}

// A soft step tick; tiptoe steps are quieter and lower.
export function playFootstep(tiptoe) {
  if (tiptoe) noiseTick(0.05, 0.05, 700);
  else noiseTick(0.05, 0.12, 1200);
}

// The pebble's landing ping.
export function playPebblePing() {
  tone(880, 0.15, 'sine', 0.16);
  tone(1320, 0.1, 'sine', 0.06, 0.02);
}

// Two rising notes when a Moonpetal seed is picked up.
export function playPickupChime() {
  tone(660, 0.14, 'sine', 0.18);
  tone(990, 0.22, 'sine', 0.18, 0.09);
}

// Two-note sawtooth sting when a guard becomes ALERTED.
export function playAlertSting() {
  tone(220, 0.16, 'sawtooth', 0.12, 0, 165);
  tone(165, 0.18, 'sawtooth', 0.12, 0.14);
}

// One soft triangle blip when a guard becomes SUSPICIOUS.
export function playSuspiciousBlip() {
  tone(440, 0.12, 'triangle', 0.1);
}

// Four notes up for the win screen.
export function playWinArpeggio() {
  [523, 659, 784, 1046].forEach((freq, i) => tone(freq, 0.28, 'sine', 0.16, i * 0.12));
}

// Soft cricket chirps in the background, very quiet, every 2-5 s.
export function startCrickets() {
  if (!ctx || cricketTimer !== null) return;
  const chirp = () => {
    if (!muted && ctx) {
      tone(4200 + Math.random() * 600, 0.05, 'sine', 0.02);
      tone(4200 + Math.random() * 600, 0.05, 'sine', 0.015, 0.08);
    }
    cricketTimer = setTimeout(chirp, 2000 + Math.random() * 3000);
  };
  cricketTimer = setTimeout(chirp, 1500);
}

// Stop the cricket loop (used when the game is torn down in tests).
export function stopCrickets() {
  if (cricketTimer !== null) {
    clearTimeout(cricketTimer);
    cricketTimer = null;
  }
}
