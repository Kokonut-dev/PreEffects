import { clamp, lerp } from './math';

export type RGBA = [number, number, number, number]; // 0..255 or float 0..1 depending on context
export type WorkingColorSpace = 'srgb' | 'linear-srgb' | 'rec709' | 'display-p3' | 'acescg';

const HEX_COLOR_CACHE = new Map<string, RGBA>();

export function parseHexColor(hex: string): RGBA {
  const hit = HEX_COLOR_CACHE.get(hex);
  if (hit) return hit;
  const clean = hex.replace('#', '').trim();
  let out: RGBA;
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    out = [r || 0, g || 0, b || 0, 255];
  } else {
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    const a = clean.length >= 8 ? parseInt(clean.slice(6, 8), 16) : 255;
    out = [
      Number.isFinite(r) ? r : 0,
      Number.isFinite(g) ? g : 0,
      Number.isFinite(b) ? b : 0,
      Number.isFinite(a) ? a : 255,
    ];
  }
  if (HEX_COLOR_CACHE.size < 1024) HEX_COLOR_CACHE.set(hex, out);
  return out;
}

export function rgbaToHex(r: number, g: number, b: number): string {
  const h = (v: number) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

export function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

export function linearToSrgb(c: number): number {
  if (c <= 0) return 0;
  return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn: h = (gn - bn) / d + (gn < bn ? 6 : 0); break;
      case gn: h = (bn - rn) / d + 2; break;
      default: h = (rn - gn) / d + 4; break;
    }
    h /= 6;
  }
  return [h * 360, s, l];
}

export function hslToRgb(hDeg: number, s: number, l: number): [number, number, number] {
  const h = (((hDeg % 360) + 360) % 360) / 360;
  if (s <= 0) {
    const v = Math.round(clamp(l, 0, 1) * 255);
    return [v, v, v];
  }
  const hue2rgb = (p: number, q: number, t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, h) * 255),
    Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  ];
}

export interface Lut3D {
  title: string;
  size: number;
  data: Float32Array; // size^3 * 3
}

export function parseCubeLut(cubeText: string): Lut3D {
  const lines = cubeText.split(/\r?\n/);
  let title = 'Custom LUT';
  let size = 0;
  const values: number[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    if (line.startsWith('TITLE')) {
      title = line.replace(/^TITLE\s*"?|"?$/g, '').trim();
      continue;
    }
    if (line.startsWith('LUT_3D_SIZE')) {
      size = parseInt(line.split(/\s+/)[1], 10) || 0;
      continue;
    }
    if (/^[A-Z_]/.test(line)) continue;
    const parts = line.split(/\s+/).map(Number);
    if (parts.length >= 3 && parts.every(Number.isFinite)) {
      values.push(parts[0], parts[1], parts[2]);
    }
  }
  if (size < 2) size = Math.round(Math.cbrt(values.length / 3)) || 2;
  return { title, size, data: new Float32Array(values) };
}

const BUILT_IN_LUT_CACHE = new Map<string, Lut3D>();

export function createBuiltInLut(preset: string): Lut3D {
  const cached = BUILT_IN_LUT_CACHE.get(preset);
  if (cached) return cached;
  const size = 9;
  const data = new Float32Array(size * size * size * 3);
  let ptr = 0;
  for (let bi = 0; bi < size; bi++) {
    for (let gi = 0; gi < size; gi++) {
      for (let ri = 0; ri < size; ri++) {
        let r = ri / (size - 1);
        let g = gi / (size - 1);
        let b = bi / (size - 1);
        const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        if (preset === 'teal-amber') {
          r = clamp(r * 1.08 + luma * 0.06, 0, 1);
          g = clamp(g * 0.99, 0, 1);
          b = clamp(b * 0.92 + (1 - luma) * 0.12, 0, 1);
        } else if (preset === 'kodak-2383') {
          r = clamp(Math.pow(r, 0.95) * 1.03, 0, 1);
          g = clamp(Math.pow(g, 1.02), 0, 1);
          b = clamp(Math.pow(b, 1.08) * 0.96, 0, 1);
        } else if (preset === 'bleach-bypass') {
          r = lerp(r, luma, 0.55);
          g = lerp(g, luma, 0.55);
          b = lerp(b, luma, 0.55);
          r = clamp((r - 0.5) * 1.28 + 0.5, 0, 1);
          g = clamp((g - 0.5) * 1.28 + 0.5, 0, 1);
          b = clamp((b - 0.5) * 1.28 + 0.5, 0, 1);
        } else if (preset === 'noir-silver') {
          const s = clamp((luma - 0.5) * 1.35 + 0.5, 0, 1);
          r = s; g = s; b = clamp(s * 1.03, 0, 1);
        } else if (preset === 'cyber-neon') {
          r = clamp(r * 1.15 + b * 0.12, 0, 1);
          g = clamp(g * 0.92 + b * 0.08, 0, 1);
          b = clamp(b * 1.22, 0, 1);
        }
        data[ptr++] = r;
        data[ptr++] = g;
        data[ptr++] = b;
      }
    }
  }
  const created: Lut3D = { title: preset, size, data };
  BUILT_IN_LUT_CACHE.set(preset, created);
  return created;
}

// Zero-allocation batch 3D LUT trilinear evaluator directly over RGBA buffers
export function applyLut3DToRgbaBuffer(lut: Lut3D, src: Uint8ClampedArray, dst: Uint8ClampedArray): void {
  const s = lut.size;
  const s2 = s * s;
  const n = s - 1;
  const scale = n / 255;
  const data = lut.data;
  const len = src.length;

  for (let i = 0; i < len; i += 4) {
    const rx = src[i] * scale;
    const gx = src[i + 1] * scale;
    const bx = src[i + 2] * scale;
    const r0 = rx | 0, r1 = r0 < n ? r0 + 1 : n, fr = rx - r0;
    const g0 = gx | 0, g1 = g0 < n ? g0 + 1 : n, fg = gx - g0;
    const b0 = bx | 0, b1 = b0 < n ? b0 + 1 : n, fb = bx - b0;

    const i000 = ((b0 * s2 + g0 * s + r0) * 3);
    const i100 = ((b0 * s2 + g0 * s + r1) * 3);
    const i010 = ((b0 * s2 + g1 * s + r0) * 3);
    const i110 = ((b0 * s2 + g1 * s + r1) * 3);
    const i001 = ((b1 * s2 + g0 * s + r0) * 3);
    const i101 = ((b1 * s2 + g0 * s + r1) * 3);
    const i011 = ((b1 * s2 + g1 * s + r0) * 3);
    const i111 = ((b1 * s2 + g1 * s + r1) * 3);

    for (let c = 0; c < 3; c++) {
      const c00 = data[i000 + c] + (data[i100 + c] - data[i000 + c]) * fr;
      const c10 = data[i010 + c] + (data[i110 + c] - data[i010 + c]) * fr;
      const c01 = data[i001 + c] + (data[i101 + c] - data[i001 + c]) * fr;
      const c11 = data[i011 + c] + (data[i111 + c] - data[i011 + c]) * fr;
      const c0 = c00 + (c10 - c00) * fg;
      const c1 = c01 + (c11 - c01) * fg;
      dst[i + c] = ((c0 + (c1 - c0) * fb) * 255 + 0.5) | 0;
    }
    dst[i + 3] = src[i + 3];
  }
}

export function sampleLut3D(lut: Lut3D, r01: number, g01: number, b01: number): [number, number, number] {
  const n = lut.size - 1;
  const rx = clamp(r01, 0, 1) * n;
  const gx = clamp(g01, 0, 1) * n;
  const bx = clamp(b01, 0, 1) * n;
  const r0 = Math.floor(rx), r1 = Math.min(n, r0 + 1), fr = rx - r0;
  const g0 = Math.floor(gx), g1 = Math.min(n, g0 + 1), fg = gx - g0;
  const b0 = Math.floor(bx), b1 = Math.min(n, b0 + 1), fb = bx - b0;
  const s = lut.size;
  const idx = (ri: number, gi: number, bi: number) => ((bi * s + gi) * s + ri) * 3;
  const out: [number, number, number] = [0, 0, 0];
  for (let c = 0; c < 3; c++) {
    const c000 = lut.data[idx(r0, g0, b0) + c];
    const c100 = lut.data[idx(r1, g0, b0) + c];
    const c010 = lut.data[idx(r0, g1, b0) + c];
    const c110 = lut.data[idx(r1, g1, b0) + c];
    const c001 = lut.data[idx(r0, g0, b1) + c];
    const c101 = lut.data[idx(r1, g0, b1) + c];
    const c011 = lut.data[idx(r0, g1, b1) + c];
    const c111 = lut.data[idx(r1, g1, b1) + c];
    const c00 = lerp(c000, c100, fr);
    const c10 = lerp(c010, c110, fr);
    const c01 = lerp(c001, c101, fr);
    const c11 = lerp(c011, c111, fr);
    out[c] = lerp(lerp(c00, c10, fg), lerp(c01, c11, fg), fb);
  }
  return out;
}

export interface VideoScopesData {
  histogramR: Uint32Array;
  histogramG: Uint32Array;
  histogramB: Uint32Array;
  histogramLuma: Uint32Array;
  waveformColumns: number;
  paradeR: Float32Array;
  paradeG: Float32Array;
  paradeB: Float32Array;
  waveformLuma: Float32Array;
  vectorscopePoints: Array<[number, number, string]>;
}

export function computeVideoScopes(rgba: Uint8ClampedArray, w: number, h: number, cols = 64): VideoScopesData {
  const histogramR = new Uint32Array(64);
  const histogramG = new Uint32Array(64);
  const histogramB = new Uint32Array(64);
  const histogramLuma = new Uint32Array(64);
  const paradeR = new Float32Array(cols);
  const paradeG = new Float32Array(cols);
  const paradeB = new Float32Array(cols);
  const waveformLuma = new Float32Array(cols);
  const counts = new Uint32Array(cols);
  const vectorscopePoints: Array<[number, number, string]> = [];

  const step = Math.max(1, Math.floor((w * h) / 2400));
  const totalPixels = w * h;
  for (let p = 0; p < totalPixels; p += step) {
    const i = p * 4;
    const r = rgba[i], g = rgba[i + 1], b = rgba[i + 2];
    const luma = Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);
    histogramR[r >> 2]++;
    histogramG[g >> 2]++;
    histogramB[b >> 2]++;
    histogramLuma[clamp(luma, 0, 255) >> 2]++;

    const x = p % w;
    const col = Math.min(cols - 1, Math.floor((x / Math.max(1, w)) * cols));
    paradeR[col] += r / 255;
    paradeG[col] += g / 255;
    paradeB[col] += b / 255;
    waveformLuma[col] += luma / 255;
    counts[col]++;

    if (vectorscopePoints.length < 280) {
      const cb = (-0.168736 * r - 0.331264 * g + 0.5 * b) / 128;
      const cr = (0.5 * r - 0.418688 * g - 0.081312 * b) / 128;
      vectorscopePoints.push([cb, cr, rgbaToHex(r, g, b)]);
    }
  }
  for (let c = 0; c < cols; c++) {
    const d = counts[c] || 1;
    paradeR[c] /= d;
    paradeG[c] /= d;
    paradeB[c] /= d;
    waveformLuma[c] /= d;
  }
  return {
    histogramR,
    histogramG,
    histogramB,
    histogramLuma,
    waveformColumns: cols,
    paradeR,
    paradeG,
    paradeB,
    waveformLuma,
    vectorscopePoints,
  };
}
