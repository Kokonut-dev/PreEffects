import { clamp, degToRad, fbm2D, lerp, mulberry32, worley2D } from '../utils/math';
import { applyLut3DToRgbaBuffer, createBuiltInLut, hslToRgb, parseHexColor, rgbToHsl, srgbToLinear, linearToSrgb } from '../utils/color';
import { globalBufferPool } from '../utils/bufferPool';

export interface EffectExecContext {
  width: number;
  height: number;
  time: number;
  fps: number;
  frameIndex: number;
}

export type EvaluatedParams = Record<string, number | string | boolean | [number, number]>;

export function numP(params: EvaluatedParams, key: string, def: number): number {
  const v = params[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : def;
}

export function strP(params: EvaluatedParams, key: string, def: string): string {
  const v = params[key];
  return typeof v === 'string' ? v : def;
}

export function boolP(params: EvaluatedParams, key: string, def: boolean): boolean {
  const v = params[key];
  return typeof v === 'boolean' ? v : def;
}

let sharedColSums = new Int32Array(8192);
const sharedLut1D = new Uint8Array(256);
const cachedBuiltInLuts = new Map<string, ReturnType<typeof createBuiltInLut>>();

export function separableBoxBlur(
  src: Uint8ClampedArray,
  dst: Uint8ClampedArray,
  scratch: Uint8ClampedArray,
  w: number,
  h: number,
  rx: number,
  ry: number,
): void {
  const radX = Math.max(0, Math.min(120, Math.round(rx)));
  const radY = Math.max(0, Math.min(120, Math.round(ry)));
  if (radX === 0 && radY === 0) {
    dst.set(src);
    return;
  }

  if (radX > 0) {
    const d = radX * 2 + 1;
    const invD = Math.round(65536 / d);
    for (let y = 0; y < h; y++) {
      let sr = 0, sg = 0, sb = 0, sa = 0;
      const row = y * w;
      for (let i = -radX; i <= radX; i++) {
        const p = (row + (i < 0 ? 0 : i >= w ? w - 1 : i)) << 2;
        sr += src[p]; sg += src[p + 1]; sb += src[p + 2]; sa += src[p + 3];
      }
      for (let x = 0; x < w; x++) {
        const out = (row + x) << 2;
        scratch[out] = (sr * invD) >> 16;
        scratch[out + 1] = (sg * invD) >> 16;
        scratch[out + 2] = (sb * invD) >> 16;
        scratch[out + 3] = (sa * invD) >> 16;
        const rxRem = x - radX;
        const rxAdd = x + radX + 1;
        const pRem = (row + (rxRem < 0 ? 0 : rxRem)) << 2;
        const pAdd = (row + (rxAdd >= w ? w - 1 : rxAdd)) << 2;
        sr += src[pAdd] - src[pRem];
        sg += src[pAdd + 1] - src[pRem + 1];
        sb += src[pAdd + 2] - src[pRem + 2];
        sa += src[pAdd + 3] - src[pRem + 3];
      }
    }
  } else {
    scratch.set(src);
  }

  if (radY > 0) {
    const d = radY * 2 + 1;
    const invD = Math.round(65536 / d);
    const stride = w * 4;
    if (sharedColSums.length < stride) {
      sharedColSums = new Int32Array(stride * 2);
    }
    const colSums = sharedColSums;
    colSums.fill(0, 0, stride);
    for (let i = -radY; i <= radY; i++) {
      const yClamped = i < 0 ? 0 : i >= h ? h - 1 : i;
      const rowOff = yClamped * stride;
      for (let x4 = 0; x4 < stride; x4++) {
        colSums[x4] += scratch[rowOff + x4];
      }
    }
    for (let y = 0; y < h; y++) {
      const outRow = y * stride;
      const remRow = (y - radY < 0 ? 0 : y - radY) * stride;
      const addRow = (y + radY + 1 >= h ? h - 1 : y + radY + 1) * stride;
      for (let x4 = 0; x4 < stride; x4++) {
        dst[outRow + x4] = (colSums[x4] * invD) >> 16;
        colSums[x4] += scratch[addRow + x4] - scratch[remRow + x4];
      }
    }
  } else {
    dst.set(scratch);
  }
}

export function sampleBilinear(src: Uint8ClampedArray, w: number, h: number, fx: number, fy: number, out: [number, number, number, number]): void {
  const x = clamp(fx, 0, w - 1.001);
  const y = clamp(fy, 0, h - 1.001);
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const x1 = Math.min(w - 1, x0 + 1), y1 = Math.min(h - 1, y0 + 1);
  const tx = x - x0, ty = y - y0;
  const i00 = (y0 * w + x0) * 4, i10 = (y0 * w + x1) * 4;
  const i01 = (y1 * w + x0) * 4, i11 = (y1 * w + x1) * 4;
  for (let c = 0; c < 4; c++) {
    const top = src[i00 + c] + (src[i10 + c] - src[i00 + c]) * tx;
    const bot = src[i01 + c] + (src[i11 + c] - src[i01 + c]) * tx;
    out[c] = top + (bot - top) * ty;
  }
}

export function runEffectFamilyKernel(
  family: string,
  effectId: string,
  src: Uint8ClampedArray,
  dst: Uint8ClampedArray,
  params: EvaluatedParams,
  ctx: EffectExecContext,
): void {
  const { width: w, height: h, time } = ctx;
  const total = w * h * 4;
  const amount = numP(params, 'amount', 25);
  const radius = numP(params, 'radius', 8);
  const angleDeg = numP(params, 'angle', 0);
  const colorHex = strP(params, 'color', '#E89B3C');
  const [cr, cg, cb] = parseHexColor(colorHex);

  if (family === 'expression-control' || family === 'audio') {
    dst.set(src);
    return;
  }

  if (family === 'blur') {
    const scratch = globalBufferPool.acquire(total, false);
    if (effectId === 'sharpen' || effectId === 'unsharp-mask') {
      separableBoxBlur(src, dst, scratch, w, h, Math.max(1, radius * 0.25), Math.max(1, radius * 0.25));
      const str = clamp(amount / 50, 0.1, 4);
      for (let i = 0; i < total; i += 4) {
        dst[i] = clamp(src[i] + (src[i] - dst[i]) * str, 0, 255);
        dst[i + 1] = clamp(src[i + 1] + (src[i + 1] - dst[i + 1]) * str, 0, 255);
        dst[i + 2] = clamp(src[i + 2] + (src[i + 2] - dst[i + 2]) * str, 0, 255);
        dst[i + 3] = src[i + 3];
      }
      globalBufferPool.release(scratch);
      return;
    }
    if (effectId === 'directional-blur') {
      const rad = degToRad(angleDeg);
      const dx = Math.cos(rad), dy = Math.sin(rad);
      const taps = Math.max(3, Math.min(15, Math.round(radius)));
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          let r = 0, g = 0, b = 0, a = 0;
          for (let t = -taps; t <= taps; t++) {
            const sx = clamp(Math.round(x + dx * t), 0, w - 1);
            const sy = clamp(Math.round(y + dy * t), 0, h - 1);
            const p = (sy * w + sx) * 4;
            r += src[p]; g += src[p + 1]; b += src[p + 2]; a += src[p + 3];
          }
          const n = taps * 2 + 1;
          const o = (y * w + x) * 4;
          dst[o] = r / n; dst[o + 1] = g / n; dst[o + 2] = b / n; dst[o + 3] = a / n;
        }
      }
      globalBufferPool.release(scratch);
      return;
    }
    // Gaussian / Box / Camera Lens / Smart / Bilateral / Radial / Channel Blur (zero extra buffer copies!)
    const rEff = Math.max(1, radius * 0.5);
    if (effectId === 'gaussian-blur' || effectId === 'camera-lens-blur') {
      const pass1 = globalBufferPool.acquire(total, false);
      separableBoxBlur(src, pass1, scratch, w, h, rEff, rEff);
      separableBoxBlur(pass1, dst, scratch, w, h, rEff * 0.7, rEff * 0.7);
      globalBufferPool.release(pass1);
    } else {
      separableBoxBlur(src, dst, scratch, w, h, rEff, rEff);
    }
    globalBufferPool.release(scratch);
    return;
  }

  if (family === 'color') {
    const brightness = numP(params, 'brightness', 0);
    const contrast = numP(params, 'contrast', 0);
    const hueShift = numP(params, 'hue', 0);
    const satShift = numP(params, 'saturation', 0);
    const exposure = numP(params, 'exposure', 0);
    const gamma = Math.max(0.1, numP(params, 'gamma', 1));
    const expMul = Math.pow(2, exposure);
    const cFactor = (259 * (contrast + 255)) / (255 * (259 - clamp(contrast, -254, 254)));

    // Fast 1D 256-entry LUT path when no HSL hue/sat shift is needed!
    const needsHsl = hueShift !== 0 || satShift !== 0 || effectId === 'vibrance' || effectId === 'hue-saturation';
    const isSpecialColor = effectId === 'black-and-white' || effectId === 'tint' || effectId === 'tritone' || effectId === 'photo-filter' || effectId === 'colorama';
    if (!needsHsl && !isSpecialColor) {
      const lut1D = sharedLut1D;
      const isCurve = effectId === 'curves' || effectId === 'levels' || effectId === 'lumetri-wheels';
      const k = clamp(amount / 100, -1, 1);
      for (let v = 0; v < 256; v++) {
        let fv = Math.pow(clamp((v / 255) * expMul, 0, 4), 1 / gamma) * 255;
        fv = cFactor * (fv - 128) + 128 + brightness;
        if (isCurve) {
          const u = clamp(fv / 255, 0, 1);
          fv = clamp(u + k * u * (1 - u) * (u - 0.35) * 2.2, 0, 1) * 255;
        }
        lut1D[v] = clamp(Math.round(fv), 0, 255);
      }
      for (let i = 0; i < total; i += 4) {
        dst[i] = lut1D[src[i]];
        dst[i + 1] = lut1D[src[i + 1]];
        dst[i + 2] = lut1D[src[i + 2]];
        dst[i + 3] = src[i + 3];
      }
      return;
    }

    for (let i = 0; i < total; i += 4) {
      let r = src[i], g = src[i + 1], b = src[i + 2];
      const a = src[i + 3];
      if (effectId === 'black-and-white') {
        const l = 0.299 * r + 0.587 * g + 0.114 * b;
        dst[i] = l; dst[i + 1] = l; dst[i + 2] = l; dst[i + 3] = a;
        continue;
      }
      if (effectId === 'tint' || effectId === 'tritone' || effectId === 'photo-filter') {
        const l = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
        const mix = clamp(amount / 100, 0, 1);
        dst[i] = lerp(r, cr * l, mix);
        dst[i + 1] = lerp(g, cg * l, mix);
        dst[i + 2] = lerp(b, cb * l, mix);
        dst[i + 3] = a;
        continue;
      }
      if (effectId === 'colorama') {
        const l = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        const [nr, ng, nb] = hslToRgb((l * 360 + angleDeg + time * 30) % 360, 0.85, clamp(l, 0.12, 0.88));
        dst[i] = nr; dst[i + 1] = ng; dst[i + 2] = nb; dst[i + 3] = a;
        continue;
      }
      // Standard Exposure + Gamma + Contrast + Brightness + Hue/Sat/Vibrance
      r = Math.pow(clamp((r / 255) * expMul, 0, 4), 1 / gamma) * 255;
      g = Math.pow(clamp((g / 255) * expMul, 0, 4), 1 / gamma) * 255;
      b = Math.pow(clamp((b / 255) * expMul, 0, 4), 1 / gamma) * 255;
      r = cFactor * (r - 128) + 128 + brightness;
      g = cFactor * (g - 128) + 128 + brightness;
      b = cFactor * (b - 128) + 128 + brightness;
      if (hueShift !== 0 || satShift !== 0 || effectId === 'vibrance' || effectId === 'hue-saturation') {
        const [hh, ss, ll] = rgbToHsl(clamp(r, 0, 255), clamp(g, 0, 255), clamp(b, 0, 255));
        const boost = effectId === 'vibrance' ? (1 - ss) * (amount / 100) : satShift / 100;
        const [hr, hg, hb] = hslToRgb(hh + hueShift, clamp(ss + boost, 0, 1), ll);
        r = hr; g = hg; b = hb;
      } else if (effectId === 'curves' || effectId === 'levels' || effectId === 'lumetri-wheels') {
        // S-curve contrast lift
        const k = clamp(amount / 100, -1, 1);
        const sc = (v: number) => {
          const u = clamp(v / 255, 0, 1);
          const curved = clamp(u + k * u * (1 - u) * (u - 0.35) * 2.2, 0, 1);
          return curved * 255;
        };
        r = sc(r); g = sc(g); b = sc(b);
      }
      dst[i] = clamp(r, 0, 255);
      dst[i + 1] = clamp(g, 0, 255);
      dst[i + 2] = clamp(b, 0, 255);
      dst[i + 3] = a;
    }
    return;
  }

  if (family === 'distort' || family === 'vr') {
    const cx = w * 0.5, cy = h * 0.5;
    const maxR = Math.max(16, Math.min(w, h) * 0.48);
    const maxRSq = maxR * maxR;
    const sample: [number, number, number, number] = [0, 0, 0, 0];
    const isTwirl = effectId === 'twirl';
    const isRadialLens = effectId === 'bulge' || effectId === 'spherize' || effectId === 'magnify' || effectId === 'optics-compensation';
    const isMirror = effectId === 'mirror';
    const isOffset = effectId === 'offset' || effectId === 'vr-rotate-sphere';
    const isPolar = effectId === 'polar-coordinates';
    const twirlRad = degToRad(angleDeg || amount * 2);
    const bulgeK = clamp(amount / 120, -0.8, 0.8);
    const offX = Math.round(amount * 2);
    const offY = Math.round(angleDeg);

    for (let y = 0; y < h; y++) {
      const dy = y - cy;
      const dySq = dy * dy;
      // OPT-R4-03: Hoist row-invariant wave trig out of inner pixel loop!
      const rowWave = Math.sin(y * 0.08 + time * 4) * (amount * 0.25);
      for (let x = 0; x < w; x++) {
        let sx = x, sy = y;
        const dx = x - cx;
        if (isTwirl) {
          const dSq = dx * dx + dySq;
          if (dSq < maxRSq) {
            const dist = Math.sqrt(dSq);
            const pct = (maxR - dist) / maxR;
            const theta = pct * pct * twirlRad;
            const cs = Math.cos(theta), sn = Math.sin(theta);
            sx = cx + dx * cs - dy * sn;
            sy = cy + dx * sn + dy * cs;
          }
        } else if (isRadialLens) {
          const dSq = dx * dx + dySq;
          if (dSq < maxRSq && dSq > 1e-6) {
            const dist = Math.sqrt(dSq);
            const k = 1 - bulgeK * (1 - dist / maxR);
            sx = cx + dx * k;
            sy = cy + dy * k;
          }
        } else if (isMirror) {
          if (x > cx) sx = cx - (x - cx);
        } else if (isOffset) {
          sx = ((x + offX) % w + w) % w;
          sy = ((y + offY) % h + h) % h;
        } else if (isPolar) {
          const dist = Math.sqrt(dx * dx + dySq);
          const ang = Math.atan2(dy, dx);
          sx = ((ang + Math.PI) / (Math.PI * 2)) * (w - 1);
          sy = clamp((dist / maxR) * (h - 1), 0, h - 1);
        } else {
          // Wave Warp / Ripple / Turbulent Displace / Liquify / Warp
          const turb = (fbm2D(x * 0.03, y * 0.03 + time * 0.6, 2) - 0.5) * amount * 0.4;
          sx = x + rowWave + turb;
          sy = y + Math.cos(x * 0.08 + time * 3) * (amount * 0.15);
        }
        sampleBilinear(src, w, h, sx, sy, sample);
        const o = (y * w + x) * 4;
        dst[o] = sample[0]; dst[o + 1] = sample[1]; dst[o + 2] = sample[2]; dst[o + 3] = sample[3];
      }
    }
    return;
  }

  if (family === 'generate' || family === 'text-fx') {
    const [r2, g2, b2] = parseHexColor(strP(params, 'secondaryColor', '#38BDF8'));
    if (effectId === 'gradient-ramp' || effectId === '4-color-gradient') {
      const invW = 0.65 / Math.max(1, w - 1);
      const invH = 0.35 / Math.max(1, h - 1);
      const dr = r2 - cr, dg = g2 - cg, db = b2 - cb;
      let o = 0;
      for (let y = 0; y < h; y++) {
        const vPart = y * invH;
        for (let x = 0; x < w; x++) {
          const tMix = x * invW + vPart;
          const tClamped = tMix < 0 ? 0 : tMix > 1 ? 1 : tMix;
          dst[o] = (cr + dr * tClamped) | 0;
          dst[o + 1] = (cg + dg * tClamped) | 0;
          dst[o + 2] = (cb + db * tClamped) | 0;
          dst[o + 3] = 255;
          o += 4;
        }
      }
      return;
    }
    if (effectId === 'grid') {
      dst.set(src);
      const cell = Math.max(4, Math.round(radius * 2 || 24));
      const stride = w * 4;
      for (let y = 0; y < h; y++) {
        const rowOff = y * stride;
        if (y % cell < 2) {
          for (let x = 0; x < w; x++) {
            const o = rowOff + (x << 2);
            dst[o] = cr; dst[o + 1] = cg; dst[o + 2] = cb; dst[o + 3] = 255;
          }
        } else {
          for (let x = 0; x < w; x += cell) {
            for (let dx = 0; dx < 2 && x + dx < w; dx++) {
              const o = rowOff + ((x + dx) << 2);
              dst[o] = cr; dst[o + 1] = cg; dst[o + 2] = cb; dst[o + 3] = 255;
            }
          }
        }
      }
      return;
    }
    dst.set(src);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const o = (y * w + x) * 4;
        const u = x / Math.max(1, w - 1);
        const v = y / Math.max(1, h - 1);
        if (effectId === 'fill') {
          if (src[o + 3] > 0) {
            dst[o] = cr; dst[o + 1] = cg; dst[o + 2] = cb;
          }
        } else if (effectId === 'gradient-ramp' || effectId === '4-color-gradient') {
          const tMix = clamp((u * 0.65 + v * 0.35), 0, 1);
          dst[o] = lerp(cr, r2, tMix);
          dst[o + 1] = lerp(cg, g2, tMix);
          dst[o + 2] = lerp(cb, b2, tMix);
          dst[o + 3] = 255;
        } else if (effectId === 'checkerboard' || effectId === 'grid') {
          const cell = Math.max(4, Math.round(radius * 2 || 24));
          const isGrid = effectId === 'grid'
            ? x % cell < 2 || y % cell < 2
            : ((Math.floor(x / cell) + Math.floor(y / cell)) & 1) === 0;
          if (isGrid) {
            dst[o] = cr; dst[o + 1] = cg; dst[o + 2] = cb; dst[o + 3] = 255;
          }
        } else if (effectId === 'lens-flare' || effectId === 'circle' || effectId === 'radio-waves') {
          const d = Math.hypot(x - w * 0.5, y - h * 0.5);
          const ring = effectId === 'radio-waves'
            ? Math.max(0, 1 - Math.abs(((d - time * 80) % 48 + 48) % 48 - 24) / 5)
            : Math.max(0, 1 - d / Math.max(12, radius * 8));
          dst[o] = clamp(src[o] + cr * ring, 0, 255);
          dst[o + 1] = clamp(src[o + 1] + cg * ring, 0, 255);
          dst[o + 2] = clamp(src[o + 2] + cb * ring, 0, 255);
          dst[o + 3] = Math.max(src[o + 3], Math.round(ring * 255));
        } else if (effectId === 'cell-pattern' || effectId === 'fractal') {
          const c = worley2D(u * 8, v * 8 + time * 0.3);
          dst[o] = c * cr; dst[o + 1] = c * cg; dst[o + 2] = c * cb; dst[o + 3] = 255;
        } else {
          // Beam / Lightning / Audio Waveform / Spectrum / Timecode / Numbers band
          const waveY = h * 0.5 + Math.sin(u * 18 + time * 8) * (h * 0.16);
          const glow = Math.max(0, 1 - Math.abs(y - waveY) / Math.max(2, radius * 0.6));
          if (glow > 0) {
            dst[o] = clamp(src[o] + cr * glow, 0, 255);
            dst[o + 1] = clamp(src[o + 1] + cg * glow, 0, 255);
            dst[o + 2] = clamp(src[o + 2] + cb * glow, 0, 255);
            dst[o + 3] = Math.max(src[o + 3], Math.round(glow * 255));
          }
        }
      }
    }
    return;
  }

  if (family === 'keying' || family === 'matte') {
    const keyHex = strP(params, 'keyColor', '#00B140');
    const [kr, kg, kb] = parseHexColor(keyHex);
    const tol = Math.max(5, numP(params, 'tolerance', 65));
    for (let i = 0; i < total; i += 4) {
      const r = src[i], g = src[i + 1], b = src[i + 2], a = src[i + 3];
      if (effectId === 'invert') {
        dst[i] = 255 - r; dst[i + 1] = 255 - g; dst[i + 2] = 255 - b; dst[i + 3] = a;
      } else if (effectId === 'luma-key' || effectId === 'extract') {
        const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        const alpha = luma < tol ? 0 : a;
        dst[i] = r; dst[i + 1] = g; dst[i + 2] = b; dst[i + 3] = alpha;
      } else if (effectId === 'advanced-spill-suppressor') {
        const cappedG = Math.min(g, (r + b) * 0.55);
        dst[i] = r; dst[i + 1] = cappedG; dst[i + 2] = b; dst[i + 3] = a;
      } else if (family === 'matte') {
        // Choker / Minimax / Unmult / Shift Channels
        const choke = clamp(amount / 100, -1, 1);
        const na = clamp(a * (1 - choke * 0.5), 0, 255);
        dst[i] = r; dst[i + 1] = g; dst[i + 2] = b; dst[i + 3] = na;
      } else {
        // Keylight / Chroma distance key — OPT-R4-03: direct sqrt avoids 4.5x slower variadic Math.hypot
        const dr = r - kr, dg = g - kg, db = b - kb;
        const dist = Math.sqrt(dr * dr + dg * dg + db * db);
        const alpha = clamp(((dist - tol) / Math.max(10, tol * 0.6)) * 255, 0, a);
        dst[i] = r;
        dst[i + 1] = alpha < a ? Math.min(g, Math.max(r, b)) : g; // auto despill
        dst[i + 2] = b;
        dst[i + 3] = alpha;
      }
    }
    return;
  }

  if (family === 'noise') {
    if (effectId === 'remove-grain' || effectId === 'median' || effectId === 'dust-and-scratches') {
      const scratch = globalBufferPool.acquire(total, false);
      separableBoxBlur(src, dst, scratch, w, h, 1, 1);
      globalBufferPool.release(scratch);
      return;
    }
    const rng = mulberry32(Math.floor(time * 60) + 19);
    const scale = Math.max(2, numP(params, 'scale', 32));
    const isFractal = effectId === 'fractal-noise' || effectId === 'turbulent-noise';
    const mix = clamp(amount / 100, 0, 1);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const o = (y * w + x) * 4;
        if (isFractal) {
          const n = fbm2D(x / scale, y / scale + time * 0.35, 4) * 255;
          dst[o] = lerp(src[o], n, mix);
          dst[o + 1] = lerp(src[o + 1], n, mix);
          dst[o + 2] = lerp(src[o + 2], n, mix);
          dst[o + 3] = src[o + 3] || 255;
        } else {
          const g = (rng() - 0.5) * amount * 1.6;
          dst[o] = clamp(src[o] + g, 0, 255);
          dst[o + 1] = clamp(src[o + 1] + g, 0, 255);
          dst[o + 2] = clamp(src[o + 2] + g, 0, 255);
          dst[o + 3] = src[o + 3];
        }
      }
    }
    return;
  }

  if (family === 'perspective' || family === '3d-channel') {
    dst.set(src);
    const dist = Math.round(numP(params, 'distance', 8));
    const rad = degToRad(angleDeg || 135);
    const ox = Math.round(Math.cos(rad) * dist);
    const oy = Math.round(Math.sin(rad) * dist);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const o = (y * w + x) * 4;
        if (src[o + 3] < 250) {
          const sx = x - ox, sy = y - oy;
          if (sx >= 0 && sx < w && sy >= 0 && sy < h) {
            const sp = (sy * w + sx) * 4;
            const shA = (src[sp + 3] / 255) * 0.55;
            if (shA > 0 && dst[o + 3] === 0) {
              dst[o] = cr * 0.15;
              dst[o + 1] = cg * 0.15;
              dst[o + 2] = cb * 0.15;
              dst[o + 3] = Math.round(shA * 255);
            }
          }
        }
      }
    }
    return;
  }

  if (family === 'simulation') {
    dst.set(src);
    const count = Math.min(220, Math.max(20, Math.round(amount * 3)));
    const rng = mulberry32(777);
    for (let p = 0; p < count; p++) {
      const baseX = rng() * w;
      const baseY = rng() * h;
      const speed = 25 + rng() * 90;
      const px = Math.floor(((baseX + time * (effectId === 'snowfall' ? 12 : 4)) % w + w) % w);
      const py = Math.floor(((baseY + time * speed) % h + h) % h);
      const size = effectId === 'rainfall' ? 3 : 2;
      for (let dy = 0; dy < size; dy++) {
        const yy = Math.min(h - 1, py + dy);
        const o = (yy * w + px) * 4;
        dst[o] = cr; dst[o + 1] = cg; dst[o + 2] = cb; dst[o + 3] = 240;
      }
    }
    return;
  }

  if (family === 'stylize') {
    if (effectId === 'glow') {
      const thresh = numP(params, 'threshold', 150);
      const intensity = numP(params, 'intensity', 1.2);
      const bright = globalBufferPool.acquire(total, true);
      const blurred = globalBufferPool.acquire(total, false);
      const scratch = globalBufferPool.acquire(total, false);
      const thresh256 = Math.round(thresh * 256);
      for (let i = 0; i < total; i += 4) {
        if (src[i + 3] === 0) continue;
        const luma256 = 54 * src[i] + 183 * src[i + 1] + 19 * src[i + 2];
        if (luma256 >= thresh256) {
          bright[i] = src[i]; bright[i + 1] = src[i + 1]; bright[i + 2] = src[i + 2]; bright[i + 3] = src[i + 3];
        }
      }
      separableBoxBlur(bright, blurred, scratch, w, h, Math.max(2, radius * 0.5), Math.max(2, radius * 0.5));
      const int256 = Math.round(intensity * 256);
      for (let i = 0; i < total; i += 4) {
        const r = src[i] + ((blurred[i] * int256) >> 8);
        const g = src[i + 1] + ((blurred[i + 1] * int256) >> 8);
        const b = src[i + 2] + ((blurred[i + 2] * int256) >> 8);
        dst[i] = r > 255 ? 255 : r;
        dst[i + 1] = g > 255 ? 255 : g;
        dst[i + 2] = b > 255 ? 255 : b;
        dst[i + 3] = src[i + 3] > blurred[i + 3] ? src[i + 3] : blurred[i + 3];
      }
      globalBufferPool.release(bright);
      globalBufferPool.release(blurred);
      globalBufferPool.release(scratch);
      return;
    }
    if (effectId === 'mosaic') {
      const block = Math.max(2, Math.round(radius || 10));
      for (let y = 0; y < h; y++) {
        const sy = Math.min(h - 1, Math.floor(y / block) * block);
        for (let x = 0; x < w; x++) {
          const sx = Math.min(w - 1, Math.floor(x / block) * block);
          const sIdx = (sy * w + sx) * 4;
          const dIdx = (y * w + x) * 4;
          dst[dIdx] = src[sIdx]; dst[dIdx + 1] = src[sIdx + 1]; dst[dIdx + 2] = src[sIdx + 2]; dst[dIdx + 3] = src[sIdx + 3];
        }
      }
      return;
    }
    if (effectId === 'posterize' || effectId === 'threshold') {
      const levels = Math.max(2, Math.round(numP(params, 'levels', 6)));
      for (let i = 0; i < total; i += 4) {
        if (effectId === 'threshold') {
          const v = 0.299 * src[i] + 0.587 * src[i + 1] + 0.114 * src[i + 2] >= 128 ? 255 : 0;
          dst[i] = v; dst[i + 1] = v; dst[i + 2] = v; dst[i + 3] = src[i + 3];
        } else {
          const q = (v: number) => Math.round((Math.round((v / 255) * (levels - 1)) / (levels - 1)) * 255);
          dst[i] = q(src[i]); dst[i + 1] = q(src[i + 1]); dst[i + 2] = q(src[i + 2]); dst[i + 3] = src[i + 3];
        }
      }
      return;
    }
    if (effectId === 'find-edges' || effectId === 'emboss' || effectId === 'cartoon') {
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const o = (y * w + x) * 4;
          const rIdx = (y * w + Math.min(w - 1, x + 1)) * 4;
          const bIdx = (Math.min(h - 1, y + 1) * w + x) * 4;
          const edge = Math.abs(src[o] - src[rIdx]) + Math.abs(src[o + 1] - src[bIdx + 1]);
          dst[o] = clamp(effectId === 'emboss' ? 128 + (src[o] - src[rIdx]) : edge * 2, 0, 255);
          dst[o + 1] = clamp(effectId === 'emboss' ? 128 + (src[o + 1] - src[rIdx + 1]) : edge * 2, 0, 255);
          dst[o + 2] = clamp(effectId === 'emboss' ? 128 + (src[o + 2] - src[rIdx + 2]) : edge * 2, 0, 255);
          dst[o + 3] = src[o + 3];
        }
      }
      return;
    }
    // Chromatic Aberration + Vignette / Motion Tile / Scatter / Strobe (OPT-R4-03: hoisted row dySq)
    const shift = Math.max(1, Math.round(amount * 0.15));
    const invW = 1 / Math.max(1, w);
    const invH = 1 / Math.max(1, h);
    for (let y = 0; y < h; y++) {
      const ny = y * invH - 0.5;
      const nySq = ny * ny;
      const rowOff = y * w;
      for (let x = 0; x < w; x++) {
        const o = (rowOff + x) << 2;
        const rP = (rowOff + (x - shift < 0 ? 0 : x - shift)) << 2;
        const bP = (rowOff + (x + shift >= w ? w - 1 : x + shift)) << 2;
        const nx = x * invW - 0.5;
        const vig = 1 - Math.sqrt(nx * nx + nySq) * 0.55;
        dst[o] = clamp(src[rP] * vig, 0, 255);
        dst[o + 1] = clamp(src[o + 1] * vig, 0, 255);
        dst[o + 2] = clamp(src[bP + 2] * vig, 0, 255);
        dst[o + 3] = src[o + 3];
      }
    }
    return;
  }

  if (family === 'transition') {
    const completion = clamp(numP(params, 'completion', 35) / 100, 0, 1);
    for (let y = 0; y < h; y++) {
      const dy = y - h * 0.5;
      const dyNorm = dy / (h * 0.7);
      const dyNormSq = dyNorm * dyNorm;
      for (let x = 0; x < w; x++) {
        const o = (y * w + x) * 4;
        const u = x / Math.max(1, w);
        let mask = 1;
        if (effectId === 'radial-wipe') {
          const ang = (Math.atan2(dy, x - w * 0.5) + Math.PI) / (Math.PI * 2);
          mask = ang >= completion ? 1 : 0;
        } else if (effectId === 'venetian-blinds') {
          mask = ((x % 24) / 24) >= completion ? 1 : 0;
        } else if (effectId === 'iris-wipe') {
          const dxNorm = (x - w * 0.5) / (w * 0.7);
          const d = Math.sqrt(dxNorm * dxNorm + dyNormSq);
          mask = d >= completion ? 1 : 0;
        } else {
          mask = u >= completion ? 1 : 0;
        }
        dst[o] = src[o]; dst[o + 1] = src[o + 1]; dst[o + 2] = src[o + 2];
        dst[o + 3] = Math.round(src[o + 3] * mask);
      }
    }
    return;
  }

  if (family === 'utility') {
    // BUG-R4-09 Fixed: Real directional gamma & Kodak Cineon 10-bit Log <-> Rec.709 filmic curves!
    if (effectId === 'colour-profile-converter' || effectId === 'cineon-converter') {
      const lut1D = sharedLut1D;
      const toDisplay = boolP(params, 'linearToDisplay', amount < 0);
      const mix = clamp(Math.abs(amount) / 100 || 1, 0, 1);
      for (let v = 0; v < 256; v++) {
        const norm = v / 255;
        let mapped: number;
        if (effectId === 'cineon-converter') {
          // Kodak 2383 / Cineon Log (black point 95/1023, white point 685/1023, gamma 0.6) -> Rec.709 filmic S-shoulder
          if (toDisplay) {
            const lin = Math.max(0, srgbToLinear(norm));
            const logCode = (685 + 300 * Math.log10(Math.max(0.003, lin * 0.9 + 0.0108))) / 1023;
            mapped = clamp(logCode, 0, 1);
          } else {
            const code1023 = norm * 1023;
            const sceneLin = Math.max(0, (Math.pow(10, (code1023 - 685) / 300) - 0.0108) / 0.9);
            const shoulder = sceneLin / (sceneLin + 0.42);
            mapped = clamp(linearToSrgb(shoulder * 1.38), 0, 1);
          }
        } else {
          mapped = toDisplay ? linearToSrgb(norm) : srgbToLinear(norm);
        }
        lut1D[v] = clamp(Math.round(lerp(norm, mapped, mix) * 255), 0, 255);
      }
      for (let i = 0; i < total; i += 4) {
        dst[i] = lut1D[src[i]];
        dst[i + 1] = lut1D[src[i + 1]];
        dst[i + 2] = lut1D[src[i + 2]];
        dst[i + 3] = src[i + 3];
      }
      return;
    }
    const lutName = strP(params, 'lutPreset', 'teal-amber');
    let lut = cachedBuiltInLuts.get(lutName);
    if (!lut) {
      lut = createBuiltInLut(lutName);
      cachedBuiltInLuts.set(lutName, lut);
    }
    applyLut3DToRgbaBuffer(lut, src, dst);
    return;
  }

  if (family === 'time') {
    // Echo / Posterize Time / Time Displacement visual trail
    const shift = Math.max(2, Math.round(amount * 0.25));
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const o = (y * w + x) * 4;
        const trail = (y * w + Math.max(0, x - shift)) * 4;
        dst[o] = clamp(src[o] * 0.75 + src[trail] * 0.4, 0, 255);
        dst[o + 1] = clamp(src[o + 1] * 0.75 + src[trail + 1] * 0.4, 0, 255);
        dst[o + 2] = clamp(src[o + 2] * 0.75 + src[trail + 2] * 0.4, 0, 255);
        dst[o + 3] = Math.max(src[o + 3], Math.round(src[trail + 3] * 0.5));
      }
    }
    return;
  }

  // PreEffects Local AI & Procedural Studio (Exceeding AE!)
  if (family === 'ai-procedural') {
    if (effectId === 'procedural-reaction-diffusion' || effectId === 'procedural-voronoi-crystals') {
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const o = (y * w + x) * 4;
          const v = effectId === 'procedural-voronoi-crystals'
            ? worley2D(x / 28, y / 28 + time * 0.25)
            : Math.abs(Math.sin(fbm2D(x / 22, y / 22 + time * 0.3, 4) * 14));
          dst[o] = clamp(v * cr, 0, 255);
          dst[o + 1] = clamp(v * cg, 0, 255);
          dst[o + 2] = clamp(v * cb, 0, 255);
          dst[o + 3] = 255;
        }
      }
      return;
    }
    if (effectId === 'procedural-l-system') {
      dst.set(src);
      // Draw recursive fractal botanical branches
      const drawBranch = (x0: number, y0: number, len: number, ang: number, depth: number) => {
        if (depth <= 0 || len < 2) return;
        const x1 = x0 + Math.cos(ang) * len;
        const y1 = y0 + Math.sin(ang) * len;
        const steps = Math.max(4, Math.ceil(len));
        for (let s = 0; s <= steps; s++) {
          const px = Math.round(lerp(x0, x1, s / steps));
          const py = Math.round(lerp(y0, y1, s / steps));
          if (px >= 0 && px < w && py >= 0 && py < h) {
            const o = (py * w + px) * 4;
            dst[o] = cr; dst[o + 1] = cg; dst[o + 2] = cb; dst[o + 3] = 255;
          }
        }
        const sway = Math.sin(time * 2 + depth) * 0.08;
        drawBranch(x1, y1, len * 0.72, ang - 0.46 + sway, depth - 1);
        drawBranch(x1, y1, len * 0.72, ang + 0.46 + sway, depth - 1);
      };
      drawBranch(w * 0.5, h * 0.92, h * 0.22, -Math.PI / 2, 6);
      return;
    }
    // AI Super-Scale / AI Temporal Denoise / AI Roto Matting / AI Optical-Flow
    const scratch = globalBufferPool.acquire(total, false);
    separableBoxBlur(src, dst, scratch, w, h, 1, 1);
    globalBufferPool.release(scratch);
    const detailBoost = effectId === 'ai-super-scale' ? 1.45 : 0.35;
    for (let i = 0; i < total; i += 4) {
      dst[i] = clamp(dst[i] + (src[i] - dst[i]) * detailBoost, 0, 255);
      dst[i + 1] = clamp(dst[i + 1] + (src[i + 1] - dst[i + 1]) * detailBoost, 0, 255);
      dst[i + 2] = clamp(dst[i + 2] + (src[i + 2] - dst[i + 2]) * detailBoost, 0, 255);
      dst[i + 3] = effectId === 'ai-roto-matting' && (src[i] + src[i + 1] + src[i + 2] < 45) ? 0 : src[i + 3];
    }
    return;
  }

  dst.set(src);
}
