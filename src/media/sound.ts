// Short synthesized sound effects (Web Audio). No audio files to download.

export type SoundName = 'card' | 'chip' | 'win' | 'lose' | 'blackjack' | 'flip' | 'shuffle';

let ctx: AudioContext | null = null;
let enabled = true;

export function setSoundEnabled(on: boolean): void {
  enabled = on;
}

function audio(): AudioContext | null {
  if (!enabled) return null;
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(ac: AudioContext, freq: number, start: number, dur: number, type: OscillatorType = 'sine', gain = 0.12) {
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0, ac.currentTime + start);
  g.gain.linearRampToValueAtTime(gain, ac.currentTime + start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + start + dur);
  osc.connect(g).connect(ac.destination);
  osc.start(ac.currentTime + start);
  osc.stop(ac.currentTime + start + dur + 0.02);
}

function noise(ac: AudioContext, dur: number, gain = 0.15, start = 0, highpass = 1500) {
  const len = Math.floor(ac.sampleRate * dur);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ac.createBufferSource();
  src.buffer = buf;
  const f = ac.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = highpass;
  const g = ac.createGain();
  g.gain.value = gain;
  src.connect(f).connect(g).connect(ac.destination);
  src.start(ac.currentTime + start);
}

export function playSound(name: SoundName): void {
  const ac = audio();
  if (!ac) return;
  switch (name) {
    case 'card':
      noise(ac, 0.07, 0.18, 0, 2500);
      break;
    case 'flip':
      noise(ac, 0.05, 0.14, 0, 1800);
      noise(ac, 0.05, 0.1, 0.06, 2200);
      break;
    case 'shuffle':
      for (let i = 0; i < 6; i++) noise(ac, 0.05, 0.1, i * 0.05, 2000);
      break;
    case 'chip':
      tone(ac, 2400, 0, 0.05, 'triangle', 0.08);
      tone(ac, 3100, 0.03, 0.06, 'triangle', 0.06);
      break;
    case 'win':
      [523, 659, 784].forEach((f, i) => tone(ac, f, i * 0.09, 0.22, 'triangle'));
      break;
    case 'blackjack':
      [523, 659, 784, 1047, 1319].forEach((f, i) => tone(ac, f, i * 0.08, 0.3, 'triangle'));
      break;
    case 'lose':
      [392, 330, 262].forEach((f, i) => tone(ac, f, i * 0.12, 0.25, 'sine', 0.09));
      break;
  }
}
