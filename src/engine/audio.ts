import { EffectInstance } from './types';
import { clamp } from '../utils/math';

export function generateSynthAudioBuffer(durationSec = 10, sampleRate = 48000, bpm = 124): Float32Array {
  const safeRate = Math.max(1000, Number.isFinite(sampleRate) && sampleRate > 0 ? sampleRate : 48000);
  const safeDur = Math.max(0, Number.isFinite(durationSec) ? durationSec : 0);
  const safeBpm = Math.max(1, Number.isFinite(bpm) && bpm > 0 ? bpm : 124);
  const total = Math.floor(safeDur * safeRate);
  const samples = new Float32Array(total);
  const beatPeriod = 60 / safeBpm;
  for (let i = 0; i < total; i++) {
    const t = i / safeRate;
    const beatPhase = (t % beatPeriod) / beatPeriod;
    const kickEnv = Math.exp(-beatPhase * 8.5);
    const kickFreq = 52 + 95 * Math.exp(-beatPhase * 22);
    const sub = Math.sin(2 * Math.PI * kickFreq * t) * kickEnv * 0.65;
    const pad = (Math.sin(2 * Math.PI * 220 * t) + Math.sin(2 * Math.PI * 329.63 * t) * 0.6) * 0.14;
    samples[i] = clamp(sub + pad, -1, 1);
  }
  return samples;
}

export function processAudioEffectsChain(
  input: Float32Array,
  sampleRate: number,
  effects: EffectInstance[],
  gainDb = 0,
): Float32Array {
  let buf = new Float32Array(input);
  const linearGain = Math.pow(10, gainDb / 20);
  if (gainDb !== 0) {
    for (let i = 0; i < buf.length; i++) buf[i] = clamp(buf[i] * linearGain, -1, 1);
  }

  for (const fx of effects) {
    if (!fx.enabled) continue;
    const gainParam = Number(fx.params.gainDb?.value ?? 0);
    const freqParam = Number(fx.params.frequency?.value ?? 880);
    const fbParam = clamp(Number(fx.params.feedback?.value ?? 35) / 100, 0, 0.92);

    if (fx.effectId === 'audio-backwards') {
      buf.reverse();
    } else if (fx.effectId === 'audio-delay' || fx.effectId === 'audio-reverb' || fx.effectId === 'audio-flange-chorus') {
      const delaySamples = Math.max(64, Math.floor((fx.effectId === 'audio-flange-chorus' ? 0.015 : 0.18) * sampleRate));
      const out = new Float32Array(buf.length);
      for (let i = 0; i < buf.length; i++) {
        const delayed = i >= delaySamples ? out[i - delaySamples] : 0;
        out[i] = clamp(buf[i] + delayed * fbParam, -1, 1);
      }
      buf = out;
    } else if (fx.effectId === 'audio-tone') {
      for (let i = 0; i < buf.length; i++) {
        buf[i] = clamp(buf[i] * 0.5 + Math.sin((2 * Math.PI * freqParam * i) / sampleRate) * 0.35, -1, 1);
      }
    } else if (fx.effectId === 'audio-modulator') {
      for (let i = 0; i < buf.length; i++) {
        buf[i] = buf[i] * Math.sin((2 * Math.PI * Math.max(2, freqParam * 0.05) * i) / sampleRate);
      }
    } else if (fx.effectId.startsWith('audio-')) {
      // Bass/Treble, High-Low Pass, Parametric EQ, Stereo Mixer one-pole filter + gain trim
      const alpha = clamp((2 * Math.PI * freqParam) / (sampleRate + 2 * Math.PI * freqParam), 0.01, 0.99);
      const boost = Math.pow(10, gainParam / 20);
      let prev = 0;
      for (let i = 0; i < buf.length; i++) {
        prev = prev + alpha * (buf[i] - prev);
        buf[i] = clamp((prev * boost + buf[i] * 0.5) * 0.75, -1, 1);
      }
    }
  }
  return buf;
}

export function computeAudioWaveformPeaks(samples: Float32Array, buckets = 160): Float32Array {
  const out = new Float32Array(buckets);
  if (samples.length === 0) return out;
  const step = Math.max(1, Math.floor(samples.length / buckets));
  for (let b = 0; b < buckets; b++) {
    let peak = 0;
    const start = b * step;
    for (let i = 0; i < step && start + i < samples.length; i++) {
      const a = Math.abs(samples[start + i]);
      if (a > peak) peak = a;
    }
    out[b] = peak;
  }
  return out;
}

export function measureAudioVuDb(samples: Float32Array, timeSec: number, sampleRate = 48000): { rmsDb: number; peakDb: number } {
  const idx = Math.floor(timeSec * sampleRate);
  const window = Math.floor(sampleRate * 0.04);
  let sumSq = 0, peak = 0, count = 0;
  for (let i = idx; i < idx + window && i < samples.length; i++) {
    if (i < 0) continue;
    const a = Math.abs(samples[i]);
    sumSq += a * a;
    if (a > peak) peak = a;
    count++;
  }
  const rms = count > 0 ? Math.sqrt(sumSq / count) : 0;
  const toDb = (v: number) => (v <= 1e-5 ? -60 : clamp(20 * Math.log10(v), -60, 6));
  return { rmsDb: toDb(rms), peakDb: toDb(peak) };
}
