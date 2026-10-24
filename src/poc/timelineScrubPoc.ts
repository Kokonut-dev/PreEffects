// POC 3: High-Speed 100+ Layer Timeline Scrubbing & Newton-Raphson Cubic Bezier Solver
export interface PocKeyframe {
  time: number;
  value: number;
  outX: number;
  outY: number;
  inX: number;
  inY: number;
}

export function solveCubicBezier1D(x: number, x1: number, y1: number, x2: number, y2: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  let u = x;
  for (let i = 0; i < 5; i++) {
    const inv = 1 - u;
    const bx = 3 * inv * inv * u * x1 + 3 * inv * u * u * x2 + u * u * u - x;
    if (Math.abs(bx) < 1e-6) break;
    const dbx = 3 * inv * inv * x1 + 6 * inv * u * (x2 - x1) + 3 * u * u * (1 - x2);
    if (Math.abs(dbx) < 1e-6) break;
    u = Math.max(0, Math.min(1, u - bx / dbx));
  }
  const inv = 1 - u;
  return 3 * inv * inv * u * y1 + 3 * inv * u * u * y2 + u * u * u;
}

export function sampleKeyframeTrack(kfs: PocKeyframe[], t: number): number {
  if (kfs.length === 0) return 0;
  if (t <= kfs[0].time) return kfs[0].value;
  const last = kfs[kfs.length - 1];
  if (t >= last.time) return last.value;
  let lo = 0, hi = kfs.length - 1;
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1;
    if (kfs[mid].time <= t) lo = mid;
    else hi = mid;
  }
  const a = kfs[lo], b = kfs[hi];
  const u = (t - a.time) / (b.time - a.time || 1);
  const eased = solveCubicBezier1D(u, a.outX, a.outY, b.inX, b.inY);
  return a.value + (b.value - a.value) * eased;
}

export function scrubMultiLayerTimeline(tracks: PocKeyframe[][], t: number): Float64Array {
  const res = new Float64Array(tracks.length);
  for (let i = 0; i < tracks.length; i++) {
    res[i] = sampleKeyframeTrack(tracks[i], t);
  }
  return res;
}
