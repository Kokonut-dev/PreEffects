import { BlendMode } from './types';
import { clamp, mulberry32 } from '../utils/math';
import { hslToRgb, rgbToHsl } from '../utils/color';

export function blendChannel38(mode: BlendMode, s: number, d: number): number {
  switch (mode) {
    case 'normal': return s;
    case 'darken': return Math.min(s, d);
    case 'multiply': return s * d;
    case 'color-burn': return s <= 0.0001 ? 0 : 1 - Math.min(1, (1 - d) / s);
    case 'linear-burn': return clamp(s + d - 1, 0, 1);
    case 'add':
    case 'linear-dodge': return clamp(s + d, 0, 1);
    case 'lighten': return Math.max(s, d);
    case 'screen': return 1 - (1 - s) * (1 - d);
    case 'color-dodge': return s >= 0.9999 ? 1 : Math.min(1, d / (1 - s));
    case 'overlay': return d < 0.5 ? 2 * s * d : 1 - 2 * (1 - s) * (1 - d);
    case 'soft-light': return s < 0.5 ? d - (1 - 2 * s) * d * (1 - d) : d + (2 * s - 1) * (Math.sqrt(d) - d);
    case 'hard-light': return s < 0.5 ? 2 * s * d : 1 - 2 * (1 - s) * (1 - d);
    case 'vivid-light': return s < 0.5
      ? (s <= 0.0001 ? 0 : 1 - Math.min(1, (1 - d) / (2 * s)))
      : (s >= 0.9999 ? 1 : Math.min(1, d / (2 * (1 - s))));
    case 'linear-light': return clamp(d + 2 * s - 1, 0, 1);
    case 'pin-light': return s < 0.5 ? Math.min(d, 2 * s) : Math.max(d, 2 * (s - 0.5));
    case 'hard-mix': return s + d >= 1 ? 1 : 0;
    case 'difference': return Math.abs(d - s);
    case 'exclusion': return s + d - 2 * s * d;
    case 'subtract': return clamp(d - s, 0, 1);
    case 'divide': return s <= 0.001 ? 1 : clamp(d / s, 0, 1);
    default: return s;
  }
}

export function blendLayerBufferOntoComp(
  dst: Uint8ClampedArray,
  src: Uint8ClampedArray,
  mode: BlendMode,
  layerOpacity01: number,
  matteBuf?: Uint8ClampedArray,
  matteMode: 'none' | 'alpha' | 'alpha-inverted' | 'luma' | 'luma-inverted' = 'none',
  seed = 1,
): void {
  // Fast 8-bit integer & alpha-skip path for Normal / Screen / Add / Multiply without Track Matte
  if (!matteBuf && (mode === 'normal' || mode === 'screen' || mode === 'add' || mode === 'multiply')) {
    const op256 = Math.round(clamp(layerOpacity01, 0, 1) * 256);
    if (op256 <= 0) return;
    const len = dst.length;

    if (mode === 'normal') {
      for (let i = 0; i < len; i += 4) {
        const a = src[i + 3];
        if (a === 0) continue;
        const sa256 = (a * op256) >> 8;
        if (sa256 === 0) continue;
        if (sa256 >= 255) {
          dst[i] = src[i]; dst[i + 1] = src[i + 1]; dst[i + 2] = src[i + 2]; dst[i + 3] = 255;
        } else {
          const inv = 256 - sa256;
          dst[i] = (src[i] * sa256 + dst[i] * inv) >> 8;
          dst[i + 1] = (src[i + 1] * sa256 + dst[i + 1] * inv) >> 8;
          dst[i + 2] = (src[i + 2] * sa256 + dst[i + 2] * inv) >> 8;
          const outA = sa256 + ((dst[i + 3] * inv) >> 8);
          dst[i + 3] = outA > 255 ? 255 : outA;
        }
      }
      return;
    }
    if (mode === 'screen') {
      for (let i = 0; i < len; i += 4) {
        const a = src[i + 3];
        if (a === 0) continue;
        const sa256 = (a * op256) >> 8;
        if (sa256 === 0) continue;
        const inv = 256 - sa256;
        const br = 255 - (((255 - src[i]) * (255 - dst[i])) >> 8);
        const bg = 255 - (((255 - src[i + 1]) * (255 - dst[i + 1])) >> 8);
        const bb = 255 - (((255 - src[i + 2]) * (255 - dst[i + 2])) >> 8);
        dst[i] = (br * sa256 + dst[i] * inv) >> 8;
        dst[i + 1] = (bg * sa256 + dst[i + 1] * inv) >> 8;
        dst[i + 2] = (bb * sa256 + dst[i + 2] * inv) >> 8;
        const outA = sa256 + ((dst[i + 3] * inv) >> 8);
        dst[i + 3] = outA > 255 ? 255 : outA;
      }
      return;
    }
    if (mode === 'add') {
      for (let i = 0; i < len; i += 4) {
        const a = src[i + 3];
        if (a === 0) continue;
        const sa256 = (a * op256) >> 8;
        if (sa256 === 0) continue;
        const r = dst[i] + ((src[i] * sa256) >> 8);
        const g = dst[i + 1] + ((src[i + 1] * sa256) >> 8);
        const b = dst[i + 2] + ((src[i + 2] * sa256) >> 8);
        const outA = dst[i + 3] + sa256;
        dst[i] = r > 255 ? 255 : r;
        dst[i + 1] = g > 255 ? 255 : g;
        dst[i + 2] = b > 255 ? 255 : b;
        dst[i + 3] = outA > 255 ? 255 : outA;
      }
      return;
    }
    if (mode === 'multiply') {
      for (let i = 0; i < len; i += 4) {
        const a = src[i + 3];
        if (a === 0) continue;
        const sa256 = (a * op256) >> 8;
        if (sa256 === 0) continue;
        const inv = 256 - sa256;
        const br = (src[i] * dst[i]) >> 8;
        const bg = (src[i + 1] * dst[i + 1]) >> 8;
        const bb = (src[i + 2] * dst[i + 2]) >> 8;
        dst[i] = (br * sa256 + dst[i] * inv) >> 8;
        dst[i + 1] = (bg * sa256 + dst[i + 1] * inv) >> 8;
        dst[i + 2] = (bb * sa256 + dst[i + 2] * inv) >> 8;
        const outA = sa256 + ((dst[i + 3] * inv) >> 8);
        dst[i + 3] = outA > 255 ? 255 : outA;
      }
      return;
    }
  }

  const rng = mode === 'dissolve' ? mulberry32(seed) : null;
  for (let i = 0; i < dst.length; i += 4) {
    let sa = (src[i + 3] / 255) * layerOpacity01;
    if (matteBuf && matteMode !== 'none') {
      const ma = matteBuf[i + 3] / 255;
      const ml = ((0.2126 * matteBuf[i] + 0.7152 * matteBuf[i + 1] + 0.0722 * matteBuf[i + 2]) / 255) * ma;
      if (matteMode === 'alpha') sa *= ma;
      else if (matteMode === 'alpha-inverted') sa *= 1 - ma;
      else if (matteMode === 'luma') sa *= ml;
      else if (matteMode === 'luma-inverted') sa *= 1 - ml;
    }

    if (mode === 'stencil-alpha') {
      dst[i + 3] = Math.round(dst[i + 3] * sa);
      continue;
    }
    if (mode === 'silhouette-alpha') {
      dst[i + 3] = Math.round(dst[i + 3] * (1 - sa));
      continue;
    }
    if (mode === 'stencil-luma' || mode === 'silhouette-luma') {
      const sl = ((0.2126 * src[i] + 0.7152 * src[i + 1] + 0.0722 * src[i + 2]) / 255) * sa;
      dst[i + 3] = Math.round(dst[i + 3] * (mode === 'stencil-luma' ? sl : 1 - sl));
      continue;
    }
    if (sa <= 0.0005) continue;
    if (rng && rng() > sa) continue;
    if (mode === 'dissolve') sa = 1;

    const da = dst[i + 3] / 255;
    const sr = src[i] / 255, sg = src[i + 1] / 255, sb = src[i + 2] / 255;
    const dr = dst[i] / 255, dg = dst[i + 1] / 255, db = dst[i + 2] / 255;

    let br = sr, bg = sg, bb = sb;
    if (mode === 'darker-color') {
      const sL = 0.2126 * sr + 0.7152 * sg + 0.0722 * sb;
      const dL = 0.2126 * dr + 0.7152 * dg + 0.0722 * db;
      if (dL < sL) { br = dr; bg = dg; bb = db; }
    } else if (mode === 'lighter-color') {
      const sL = 0.2126 * sr + 0.7152 * sg + 0.0722 * sb;
      const dL = 0.2126 * dr + 0.7152 * dg + 0.0722 * db;
      if (dL > sL) { br = dr; bg = dg; bb = db; }
    } else if (mode === 'hue' || mode === 'saturation' || mode === 'color' || mode === 'luminosity') {
      const [sh, ss, sl] = rgbToHsl(src[i], src[i + 1], src[i + 2]);
      const [dh, ds, dl] = rgbToHsl(dst[i], dst[i + 1], dst[i + 2]);
      const [nr, ng, nb] = hslToRgb(
        mode === 'hue' || mode === 'color' ? sh : dh,
        mode === 'saturation' || mode === 'color' ? ss : ds,
        mode === 'luminosity' ? sl : dl,
      );
      br = nr / 255; bg = ng / 255; bb = nb / 255;
    } else {
      br = blendChannel38(mode, sr, dr);
      bg = blendChannel38(mode, sg, dg);
      bb = blendChannel38(mode, sb, db);
    }

    const outA = mode === 'alpha-add' ? clamp(sa + da, 0, 1) : sa + da * (1 - sa);
    if (outA > 0) {
      const mr = br * sa + dr * da * (1 - sa);
      const mg = bg * sa + dg * da * (1 - sa);
      const mb = bb * sa + db * da * (1 - sa);
      dst[i] = Math.round(clamp(mr / outA, 0, 1) * 255);
      dst[i + 1] = Math.round(clamp(mg / outA, 0, 1) * 255);
      dst[i + 2] = Math.round(clamp(mb / outA, 0, 1) * 255);
      dst[i + 3] = Math.round(outA * 255);
    }
  }
}

export function drawSmpteMissingBars(buf: Uint8ClampedArray, w: number, h: number): void {
  const bars: Array<[number, number, number]> = [
    [192, 192, 192], [192, 192, 0], [0, 192, 192], [0, 192, 0],
    [192, 0, 192], [192, 0, 0], [0, 0, 192],
  ];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const bi = Math.min(bars.length - 1, Math.floor((x / Math.max(1, w)) * bars.length));
      const [r, g, b] = bars[bi];
      const o = (y * w + x) * 4;
      buf[o] = r; buf[o + 1] = g; buf[o + 2] = b; buf[o + 3] = 255;
    }
  }
}
