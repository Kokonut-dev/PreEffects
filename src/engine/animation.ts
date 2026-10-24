import { AnimatableProperty, Keyframe, KeyframeInterpolation, Layer } from './types';
import { clamp, evalSpatialBezier3D, lerp, mulberry32, solveCubicBezier } from '../utils/math';
import { createId } from './factory';

function interpolateValues<T>(a: T, b: T, t: number): T {
  if (typeof a === 'number' && typeof b === 'number') {
    return (a + (b - a) * t) as unknown as T;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length === 3 && typeof a[0] === 'number') {
      return [
        a[0] + ((b[0] ?? a[0]) - a[0]) * t,
        a[1] + ((b[1] ?? a[1]) - a[1]) * t,
        a[2] + ((b[2] ?? a[2]) - a[2]) * t,
      ] as unknown as T;
    }
    return a.map((av, idx) => {
      const bv = b[idx] ?? av;
      return typeof av === 'number' && typeof bv === 'number' ? av + (bv - av) * t : av;
    }) as unknown as T;
  }
  return t < 0.5 ? a : b;
}

export function evaluateKeyframesAtTime<T>(prop: AnimatableProperty<T>, time: number): T {
  const kfs = prop.keyframes;
  if (!prop.animated || !kfs || kfs.length === 0) return prop.value;
  if (kfs.length === 1 || time <= kfs[0].time) return kfs[0].value;
  const last = kfs[kfs.length - 1];
  if (time >= last.time) return last.value;

  // Binary search segment
  let lo = 0;
  let hi = kfs.length - 1;
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1;
    if (kfs[mid].time <= time) lo = mid;
    else hi = mid;
  }
  const k0 = kfs[lo];
  const k1 = kfs[hi];
  if (k0.interpolation === 'hold') return k0.value;

  const span = Math.max(1e-6, k1.time - k0.time);
  const rawU = clamp((time - k0.time) / span, 0, 1);

  let easedU = rawU;
  if (k0.interpolation === 'bezier' || k0.interpolation === 'auto-bezier' || k0.interpolation === 'continuous-bezier') {
    const x1 = clamp(k0.outInfluence ?? (k0.interpolation === 'auto-bezier' ? 0.33 : 0.42), 0.01, 0.99);
    const x2 = clamp(1 - (k1.inInfluence ?? (k1.interpolation === 'auto-bezier' ? 0.33 : 0.42)), 0.01, 0.99);
    const y1 = clamp(k0.outSlope ?? 0, -0.5, 1.5);
    const y2 = clamp(1 - (k1.inSlope ?? 0), -0.5, 1.5);
    easedU = solveCubicBezier(rawU, x1, y1, x2, y2);
  }

  // Spatial Bezier support for 3D tuples
  if (
    Array.isArray(k0.value) &&
    Array.isArray(k1.value) &&
    k0.value.length === 3 &&
    (k0.spatialTangentOut || k1.spatialTangentIn)
  ) {
    const p0 = k0.value as unknown as [number, number, number];
    const p1 = k1.value as unknown as [number, number, number];
    const tOut = k0.spatialTangentOut ?? [0, 0, 0];
    const tIn = k1.spatialTangentIn ?? [0, 0, 0];
    const c0: [number, number, number] = [p0[0] + tOut[0], p0[1] + tOut[1], p0[2] + tOut[2]];
    const c1: [number, number, number] = [p1[0] + tIn[0], p1[1] + tIn[1], p1[2] + tIn[2]];
    return evalSpatialBezier3D(p0, c0, c1, p1, easedU) as unknown as T;
  }

  return interpolateValues(k0.value, k1.value, easedU);
}

export function setOrUpdateKeyframe<T>(
  prop: AnimatableProperty<T>,
  time: number,
  value: T,
  interpolation: KeyframeInterpolation = 'bezier',
): AnimatableProperty<T> {
  const nextKfs = [...prop.keyframes];
  const existingIdx = nextKfs.findIndex((k) => Math.abs(k.time - time) < 0.0005);
  const entry: Keyframe<T> = existingIdx >= 0
    ? { ...nextKfs[existingIdx], value }
    : {
        id: createId('kf'),
        time,
        value,
        interpolation,
        outInfluence: 0.42,
        outSlope: 0,
        inInfluence: 0.42,
        inSlope: 0,
      };
  if (existingIdx >= 0) nextKfs[existingIdx] = entry;
  else nextKfs.push(entry);
  nextKfs.sort((a, b) => a.time - b.time);
  return {
    ...prop,
    value,
    animated: true,
    keyframes: nextKfs,
  };
}

export function applyEasyEasePreset<T>(
  prop: AnimatableProperty<T>,
  preset: 'easy-ease' | 'ease-in' | 'ease-out' | 'linear' | 'hold' | 'overshoot',
): AnimatableProperty<T> {
  return {
    ...prop,
    keyframes: prop.keyframes.map((kf) => {
      if (preset === 'linear') return { ...kf, interpolation: 'linear' };
      if (preset === 'hold') return { ...kf, interpolation: 'hold' };
      if (preset === 'ease-in') return { ...kf, interpolation: 'bezier', inInfluence: 0.72, inSlope: 0, outInfluence: 0.16, outSlope: 0.16 };
      if (preset === 'ease-out') return { ...kf, interpolation: 'bezier', outInfluence: 0.72, outSlope: 0, inInfluence: 0.16, inSlope: 0.16 };
      if (preset === 'overshoot') return { ...kf, interpolation: 'bezier', outInfluence: 0.34, outSlope: -0.18, inInfluence: 0.66, inSlope: -0.22 };
      return { ...kf, interpolation: 'bezier', outInfluence: 0.65, outSlope: 0, inInfluence: 0.65, inSlope: 0 };
    }),
  };
}

// Roving Spatial Keyframes — redistribute intermediate keyframe times proportionally to spatial chord length
export function applyRovingKeyframes(
  prop: AnimatableProperty<[number, number, number]>,
): AnimatableProperty<[number, number, number]> {
  if (prop.keyframes.length < 3) return prop;
  const kfs = prop.keyframes.map((k) => ({ ...k }));
  const dists: number[] = [0];
  let totalDist = 0;
  for (let i = 1; i < kfs.length; i++) {
    const a = kfs[i - 1].value;
    const b = kfs[i].value;
    totalDist += Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    dists.push(totalDist);
  }
  if (totalDist <= 1e-6) return prop;
  const tStart = kfs[0].time;
  const tSpan = kfs[kfs.length - 1].time - tStart;
  for (let i = 1; i < kfs.length - 1; i++) {
    kfs[i].time = tStart + (dists[i] / totalDist) * tSpan;
    kfs[i].roving = true;
  }
  return { ...prop, keyframes: kfs };
}

// Time-Reverse Keyframes Assistant
export function timeReverseKeyframes<T>(prop: AnimatableProperty<T>): AnimatableProperty<T> {
  if (prop.keyframes.length < 2) return prop;
  const times = prop.keyframes.map((k) => k.time);
  const reversedValues = [...prop.keyframes].reverse();
  return {
    ...prop,
    keyframes: reversedValues.map((k, idx) => ({ ...k, time: times[idx] })),
  };
}

// Sequence Layers Assistant
export function sequenceLayers(layers: Layer[], overlapSec = 0): Layer[] {
  let cursor = 0;
  return layers.map((layer) => {
    const dur = Math.max(0.05, layer.outPoint - layer.inPoint);
    const updated: Layer = {
      ...layer,
      startTime: cursor,
      inPoint: cursor,
      outPoint: cursor + dur,
    };
    cursor = Math.max(0, cursor + dur - overlapSec);
    return updated;
  });
}

// Wiggler Assistant — injects procedural noise keyframes between first and last keyframes
export function applyWigglerToProperty(
  prop: AnimatableProperty<number>,
  frequencyPerSec = 4,
  magnitude = 15,
  seed = 101,
): AnimatableProperty<number> {
  const start = prop.keyframes[0]?.time ?? 0;
  const end = prop.keyframes[prop.keyframes.length - 1]?.time ?? 4;
  const step = 1 / Math.max(1, frequencyPerSec * 2);
  const rng = mulberry32(seed);
  const nextKfs: Keyframe<number>[] = [];
  for (let t = start; t <= end + 1e-5; t += step) {
    const base = evaluateKeyframesAtTime(prop, t);
    const offset = (rng() * 2 - 1) * magnitude;
    nextKfs.push({
      id: createId('kf'),
      time: Number(t.toFixed(4)),
      value: base + offset,
      interpolation: 'auto-bezier',
    });
  }
  return { ...prop, animated: true, keyframes: nextKfs };
}

// Smoother Assistant — Moving-average + tolerance decimation on dense keyframes
export function applySmootherToProperty(
  prop: AnimatableProperty<number>,
  tolerance = 2.0,
): AnimatableProperty<number> {
  if (prop.keyframes.length <= 3) return prop;
  const src = prop.keyframes;
  const smoothed = src.map((kf, i) => {
    if (i === 0 || i === src.length - 1) return kf;
    const avg = (src[i - 1].value + kf.value * 2 + src[i + 1].value) / 4;
    return { ...kf, value: avg };
  });
  const kept: Keyframe<number>[] = [smoothed[0]];
  for (let i = 1; i < smoothed.length - 1; i++) {
    const prev = kept[kept.length - 1];
    const next = smoothed[smoothed.length - 1];
    const expected = lerp(prev.value, next.value, (smoothed[i].time - prev.time) / Math.max(1e-5, next.time - prev.time));
    if (Math.abs(smoothed[i].value - expected) >= tolerance) {
      kept.push(smoothed[i]);
    }
  }
  kept.push(smoothed[smoothed.length - 1]);
  return { ...prop, keyframes: kept };
}

// Convert Audio Amplitude to Keyframes Assistant
export function convertAudioSamplesToKeyframes(
  samples: Float32Array,
  sampleRate: number,
  fps: number,
  duration: number,
  scaleFactor = 100,
): AnimatableProperty<number> {
  const totalFrames = Math.max(1, Math.floor(duration * fps));
  const samplesPerFrame = Math.max(1, Math.floor(sampleRate / fps));
  const keyframes: Keyframe<number>[] = [];
  for (let f = 0; f < totalFrames; f++) {
    const startIdx = f * samplesPerFrame;
    let sumSq = 0;
    let count = 0;
    for (let s = 0; s < samplesPerFrame && startIdx + s < samples.length; s++) {
      const v = samples[startIdx + s];
      sumSq += v * v;
      count++;
    }
    const rms = count > 0 ? Math.sqrt(sumSq / count) : 0;
    keyframes.push({
      id: createId('kf'),
      time: f / fps,
      value: Number((rms * scaleFactor).toFixed(3)),
      interpolation: 'linear',
    });
  }
  return {
    value: keyframes[0]?.value ?? 0,
    animated: true,
    keyframes,
  };
}

// Sample Graph Editor Value & Speed Curves
export function sampleGraphCurve(
  prop: AnimatableProperty<number | [number, number, number]>,
  startTime: number,
  endTime: number,
  samplesCount = 120,
  dimensionIndex = 0,
): Array<{ time: number; value: number; speed: number }> {
  const pts: Array<{ time: number; value: number; speed: number }> = [];
  const dt = Math.max(0.001, (endTime - startTime) / Math.max(1, samplesCount));
  const extract = (v: number | [number, number, number]) => (Array.isArray(v) ? v[dimensionIndex] ?? 0 : v);
  for (let i = 0; i <= samplesCount; i++) {
    const t = startTime + i * dt;
    const v0 = extract(evaluateKeyframesAtTime(prop, t));
    const v1 = extract(evaluateKeyframesAtTime(prop, t + 0.008));
    const speed = (v1 - v0) / 0.008;
    pts.push({ time: t, value: v0, speed });
  }
  return pts;
}
