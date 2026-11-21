// audio.js — every sound is synthesized with WebAudio: no audio files, no
// network. Nothing plays before the first user gesture; M toggles mute.
export function createAudio() {
  const audio = {
    ctx: null,
    muted: false,
    cricketTimer: null,
  };

  function ensure() {
    if (!audio.ctx) {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return null;
      audio.ctx = new Ctor();
    }
    if (audio.ctx.state === 'suspended') audio.ctx.resume();
    return audio.ctx;
  }

  function tone(freq, dur, type = 'sine', gain = 0.12, when = 0, slideTo = null) {
    const ctx = ensure();
    if (!ctx || audio.muted) return;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    amp.gain.setValueAtTime(0, t0);
    amp.gain.linearRampToValueAtTime(gain, t0 + 0.01);
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(amp);
    amp.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  function noiseTick(quiet) {
    const ctx = ensure();
    if (!ctx || audio.muted) return;
    const dur = 0.05;
    const t0 = ctx.currentTime;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = quiet ? 500 : 900;
    const amp = ctx.createGain();
    amp.gain.value = quiet ? 0.05 : 0.11;
    source.connect(filter);
    filter.connect(amp);
    amp.connect(ctx.destination);
    source.start(t0);
  }

  audio.unlock = function unlock() {
    ensure();
    if (audio.ctx && !audio.cricketTimer) {
      audio.cricketTimer = window.setInterval(() => {
        if (audio.muted || !audio.ctx) return;
        if (Math.random() < 0.6) {
          tone(4200 + Math.random() * 600, 0.05, 'sine', 0.015);
          tone(4200 + Math.random() * 600, 0.04, 'sine', 0.012, 0.09);
        }
      }, 2600);
    }
  };

  audio.toggleMute = function toggleMute() {
    audio.muted = !audio.muted;
    return audio.muted;
  };

  audio.footstep = function footstep(tiptoe) {
    noiseTick(tiptoe);
  };

  audio.pebblePing = function pebblePing() {
    tone(880, 0.15, 'sine', 0.12);
    tone(1320, 0.1, 'sine', 0.05, 0.05);
  };

  audio.pickup = function pickup() {
    tone(660, 0.12, 'sine', 0.12);
    tone(990, 0.18, 'sine', 0.12, 0.09);
  };

  audio.suspiciousBlip = function suspiciousBlip() {
    tone(440, 0.12, 'triangle', 0.09);
  };

  audio.alertSting = function alertSting() {
    tone(220, 0.18, 'sawtooth', 0.1);
    tone(165, 0.22, 'sawtooth', 0.1, 0.14);
  };

  audio.heartbeat = function heartbeat() {
    tone(70, 0.12, 'sine', 0.14);
    tone(60, 0.1, 'sine', 0.1, 0.16);
  };

  audio.winArpeggio = function winArpeggio() {
    [523, 659, 784, 1046].forEach((freq, i) => tone(freq, 0.22, 'sine', 0.12, i * 0.12));
  };

  audio.exitUnlocked = function exitUnlocked() {
    tone(784, 0.15, 'sine', 0.1);
    tone(1046, 0.25, 'sine', 0.1, 0.12);
  };

  return audio;
}
