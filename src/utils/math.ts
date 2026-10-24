// High-precision math, cubic/spatial Bezier, 4x4 3D matrices, deterministic noise, and expression math parser

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

export function solveCubicBezier(x: number, x1: number, y1: number, x2: number, y2: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  if (Math.abs(x1 - y1) < 1e-6 && Math.abs(x2 - y2) < 1e-6) return x;
  const cx1 = clamp(x1, 0, 1);
  const cx2 = clamp(x2, 0, 1);
  let u = x;
  for (let i = 0; i < 6; i++) {
    const inv = 1 - u;
    const bx = 3 * inv * inv * u * cx1 + 3 * inv * u * u * cx2 + u * u * u - x;
    if (Math.abs(bx) < 1e-6) break;
    const dbx = 3 * inv * inv * cx1 + 6 * inv * u * (cx2 - cx1) + 3 * u * u * (1 - cx2);
    if (Math.abs(dbx) < 1e-6) break;
    u = clamp(u - bx / dbx, 0, 1);
  }
  const inv = 1 - u;
  return 3 * inv * inv * u * y1 + 3 * inv * u * u * y2 + u * u * u;
}

export function evalSpatialBezier3D(
  p0: [number, number, number],
  c0: [number, number, number],
  c1: [number, number, number],
  p1: [number, number, number],
  t: number,
): [number, number, number] {
  const u = clamp(t, 0, 1);
  const inv = 1 - u;
  const b0 = inv * inv * inv;
  const b1 = 3 * inv * inv * u;
  const b2 = 3 * inv * u * u;
  const b3 = u * u * u;
  return [
    b0 * p0[0] + b1 * c0[0] + b2 * c1[0] + b3 * p1[0],
    b0 * p0[1] + b1 * c0[1] + b2 * c1[1] + b3 * p1[1],
    b0 * p0[2] + b1 * c0[2] + b2 * c1[2] + b3 * p1[2],
  ];
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2D(ix: number, iy: number, seed = 1337): number {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(seed, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

export function valueNoise2D(x: number, y: number, seed = 1337): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const n00 = hash2D(ix, iy, seed);
  const n10 = hash2D(ix + 1, iy, seed);
  const n01 = hash2D(ix, iy + 1, seed);
  const n11 = hash2D(ix + 1, iy + 1, seed);
  return lerp(lerp(n00, n10, ux), lerp(n01, n11, ux), uy);
}

export function fbm2D(x: number, y: number, octaves = 4, lacunarity = 2, gain = 0.5, seed = 1337): number {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise2D(x * freq, y * freq, seed + i * 97);
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return norm > 0 ? sum / norm : 0;
}

export function worley2D(x: number, y: number, seed = 42): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  let minDist = 8;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const cx = ix + dx + hash2D(ix + dx, iy + dy, seed);
      const cy = iy + dy + hash2D(ix + dx, iy + dy, seed + 7919);
      const dist = Math.hypot(x - cx, y - cy);
      if (dist < minDist) minDist = dist;
    }
  }
  return clamp(minDist, 0, 1);
}

// Column-major 4x4 matrix operations for 3D layers & cameras
export type Mat4Array = Float64Array;

export const Mat4 = {
  identity(): Mat4Array {
    const m = new Float64Array(16);
    m[0] = 1; m[5] = 1; m[10] = 1; m[15] = 1;
    return m;
  },
  multiply(a: Mat4Array, b: Mat4Array): Mat4Array {
    const out = new Float64Array(16);
    for (let col = 0; col < 4; col++) {
      for (let row = 0; row < 4; row++) {
        out[col * 4 + row] =
          a[0 * 4 + row] * b[col * 4 + 0] +
          a[1 * 4 + row] * b[col * 4 + 1] +
          a[2 * 4 + row] * b[col * 4 + 2] +
          a[3 * 4 + row] * b[col * 4 + 3];
      }
    }
    return out;
  },
  translate(tx: number, ty: number, tz: number): Mat4Array {
    const m = Mat4.identity();
    m[12] = tx; m[13] = ty; m[14] = tz;
    return m;
  },
  scale(sx: number, sy: number, sz: number): Mat4Array {
    const m = Mat4.identity();
    m[0] = sx; m[5] = sy; m[10] = sz;
    return m;
  },
  rotateX(rad: number): Mat4Array {
    const m = Mat4.identity();
    const c = Math.cos(rad), s = Math.sin(rad);
    m[5] = c; m[6] = s; m[9] = -s; m[10] = c;
    return m;
  },
  rotateY(rad: number): Mat4Array {
    const m = Mat4.identity();
    const c = Math.cos(rad), s = Math.sin(rad);
    m[0] = c; m[2] = -s; m[8] = s; m[10] = c;
    return m;
  },
  rotateZ(rad: number): Mat4Array {
    const m = Mat4.identity();
    const c = Math.cos(rad), s = Math.sin(rad);
    m[0] = c; m[1] = s; m[4] = -s; m[5] = c;
    return m;
  },
  transformPoint(m: Mat4Array, x: number, y: number, z: number): [number, number, number] {
    const nx = m[0] * x + m[4] * y + m[8] * z + m[12];
    const ny = m[1] * x + m[5] * y + m[9] * z + m[13];
    const nz = m[2] * x + m[6] * y + m[10] * z + m[14];
    const nw = m[3] * x + m[7] * y + m[11] * z + m[15] || 1;
    return [nx / nw, ny / nw, nz / nw];
  },
};

// Safe arithmetic parser for ScrubInputs (supports e.g. "1920/2", "100+24*2", "(540-20)")
export function evaluateNumericInput(raw: string, fallback: number): number {
  const cleaned = raw.trim();
  if (!cleaned) return fallback;
  if (!/^[0-9+\-*/().%\s]+$/.test(cleaned)) {
    const direct = Number(cleaned);
    return Number.isFinite(direct) ? direct : fallback;
  }
  try {
    const fn = new Function(`"use strict"; return (${cleaned});`);
    const v = Number(fn());
    return Number.isFinite(v) ? v : fallback;
  } catch {
    return fallback;
  }
}

export function formatTimecode(timeSec: number, fps: number, showFrames = false): string {
  const safeFps = Math.max(1, Math.round(fps));
  const totalFrames = Math.max(0, Math.floor(timeSec * fps + 1e-5));
  if (showFrames) return String(totalFrames).padStart(5, '0');
  const ff = totalFrames % safeFps;
  const totalSec = Math.floor(totalFrames / safeFps);
  const ss = totalSec % 60;
  const mm = Math.floor(totalSec / 60) % 60;
  const hh = Math.floor(totalSec / 3600);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}:${String(ff).padStart(2, '0')}`;
}
