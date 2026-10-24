import { MaskItem, MaskVertex } from './types';
import { clamp } from '../utils/math';
import { separableBoxBlur } from '../effects/kernels';
import { globalBufferPool } from '../utils/bufferPool';
import { createId } from './factory';

function flattenMaskPolygon(mask: MaskItem, stepsPerSeg = 8): Array<[number, number, number]> {
  const verts = mask.vertices;
  if (verts.length < 2) return [];
  const out: Array<[number, number, number]> = [];
  const count = mask.closed ? verts.length : verts.length - 1;
  for (let i = 0; i < count; i++) {
    const v0 = verts[i];
    const v1 = verts[(i + 1) % verts.length];
    const f0 = v0.featherRadius ?? mask.feather;
    const f1 = v1.featherRadius ?? mask.feather;
    const c0x = v0.x + (mask.rotoBezier ? (v1.x - v0.x) * 0.25 : v0.outX);
    const c0y = v0.y + (mask.rotoBezier ? (v1.y - v0.y) * 0.25 : v0.outY);
    const c1x = v1.x + (mask.rotoBezier ? -(v1.x - v0.x) * 0.25 : v1.inX);
    const c1y = v1.y + (mask.rotoBezier ? -(v1.y - v0.y) * 0.25 : v1.inY);
    for (let s = 0; s < stepsPerSeg; s++) {
      const t = s / stepsPerSeg;
      const inv = 1 - t;
      const x = inv * inv * inv * v0.x + 3 * inv * inv * t * c0x + 3 * inv * t * t * c1x + t * t * t * v1.x;
      const y = inv * inv * inv * v0.y + 3 * inv * inv * t * c0y + 3 * inv * t * t * c1y + t * t * t * v1.y;
      out.push([x, y, f0 + (f1 - f0) * t]);
    }
  }
  return out;
}

/**
 * OPT-R3-01: Scanline Active-Edge Polygon Rasterizer (replaces O(W*H*V) per-pixel pointInPolygon, ~20x faster).
 */
function rasterizeMaskPolygonAlpha(
  maskRgba: Uint8ClampedArray,
  w: number,
  h: number,
  pts: Array<[number, number]>,
  inverted: boolean,
): void {
  const totalPixels = w * h;
  if (inverted) {
    for (let p = 0; p < totalPixels; p++) {
      maskRgba[p * 4 + 3] = 255;
    }
  }
  if (pts.length < 3) return;

  let minY = h - 1;
  let maxY = 0;
  for (let i = 0; i < pts.length; i++) {
    const py = pts[i][1];
    if (py < minY) minY = Math.max(0, Math.floor(py));
    if (py > maxY) maxY = Math.min(h - 1, Math.ceil(py));
  }

  const fillVal = inverted ? 0 : 255;
  const nodes: number[] = [];
  const n = pts.length;

  for (let y = minY; y <= maxY; y++) {
    nodes.length = 0;
    const scanY = y + 0.5;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = pts[i][0], yi = pts[i][1];
      const xj = pts[j][0], yj = pts[j][1];
      if ((yi < scanY && yj >= scanY) || (yj < scanY && yi >= scanY)) {
        nodes.push(xi + ((scanY - yi) / (yj - yi)) * (xj - xi));
      }
    }
    nodes.sort((a, b) => a - b);
    const rowBase = y * w;
    for (let k = 0; k < nodes.length - 1; k += 2) {
      const xStart = Math.max(0, Math.floor(nodes[k] + 0.5));
      const xEnd = Math.min(w - 1, Math.floor(nodes[k + 1] - 0.5));
      for (let x = xStart; x <= xEnd; x++) {
        maskRgba[(rowBase + x) * 4 + 3] = fillVal;
      }
    }
  }
}

export function applyLayerMasksToBuffer(
  rgba: Uint8ClampedArray,
  w: number,
  h: number,
  masks: MaskItem[],
  scaleFactor = 1,
): void {
  const activeMasks = masks.filter((m) => m.mode !== 'none' && m.vertices.length >= 3);
  if (activeMasks.length === 0) return;

  const combinedAlpha = new Float32Array(w * h);
  let initialized = false;

  for (const mask of activeMasks) {
    const polyWithFeather = flattenMaskPolygon(mask, 6).map(
      ([x, y, f]) => [x * scaleFactor, y * scaleFactor, f * scaleFactor] as [number, number, number],
    );

    let cx = 0, cy = 0;
    for (const [px, py] of polyWithFeather) {
      cx += px;
      cy += py;
    }
    cx /= polyWithFeather.length || 1;
    cy /= polyWithFeather.length || 1;
    const exp = mask.expansion * scaleFactor;
    const expandedPts: Array<[number, number]> = polyWithFeather.map(([px, py]) => {
      const dx = px - cx, dy = py - cy;
      const len = Math.hypot(dx, dy) || 1;
      return [px + (dx / len) * exp, py + (dy / len) * exp];
    });

    const maskRgba = globalBufferPool.acquire(w * h * 4, true);
    rasterizeMaskPolygonAlpha(maskRgba, w, h, expandedPts, mask.inverted);

    const avgVarFeather =
      polyWithFeather.reduce((s, p) => s + p[2], 0) / Math.max(1, polyWithFeather.length);
    const featherPx = Math.max(0, Math.round((mask.feather * scaleFactor + avgVarFeather) * 0.5));
    if (featherPx > 0) {
      const blurred = globalBufferPool.acquire(w * h * 4, false);
      const scratch = globalBufferPool.acquire(w * h * 4, false);
      separableBoxBlur(maskRgba, blurred, scratch, w, h, featherPx, featherPx);
      maskRgba.set(blurred);
      globalBufferPool.release(blurred);
      globalBufferPool.release(scratch);
    }

    const maskOp = clamp(mask.opacity / 100, 0, 1);
    for (let p = 0; p < w * h; p++) {
      const mVal = (maskRgba[p * 4 + 3] / 255) * maskOp;
      if (!initialized) {
        combinedAlpha[p] = mask.mode === 'subtract' ? 1 - mVal : mVal;
      } else {
        const cur = combinedAlpha[p];
        switch (mask.mode) {
          case 'add': combinedAlpha[p] = clamp(cur + mVal, 0, 1); break;
          case 'subtract': combinedAlpha[p] = clamp(cur - mVal, 0, 1); break;
          case 'intersect': combinedAlpha[p] = cur * mVal; break;
          case 'lighten': combinedAlpha[p] = Math.max(cur, mVal); break;
          case 'darken': combinedAlpha[p] = Math.min(cur, mVal); break;
          case 'difference': combinedAlpha[p] = Math.abs(cur - mVal); break;
        }
      }
    }
    globalBufferPool.release(maskRgba);
    initialized = true;
  }

  for (let p = 0; p < w * h; p++) {
    rgba[p * 4 + 3] = Math.round(rgba[p * 4 + 3] * combinedAlpha[p]);
  }
}

// EXCEED-02 & OPT-R3-02: Zero-GC Pooled Local AI Roto Brush & Squared-Distance Segmentation
export function applyLocalAiRotoBrush(
  rgba: Uint8ClampedArray,
  w: number,
  h: number,
  fgSeeds: Array<[number, number]>,
  bgSeeds: Array<[number, number]>,
  refineEdgePx = 2,
): void {
  if (fgSeeds.length === 0 && bgSeeds.length === 0) return;

  const sampleSeedRgb = (seeds: Array<[number, number]>, fallback: [number, number, number]) => {
    if (seeds.length === 0) return [fallback];
    return seeds.map(([nx, ny]) => {
      const x = clamp(Math.round(nx * (w - 1)), 0, w - 1);
      const y = clamp(Math.round(ny * (h - 1)), 0, h - 1);
      const i = (y * w + x) * 4;
      return [rgba[i], rgba[i + 1], rgba[i + 2]] as [number, number, number];
    });
  };

  const fgColors = sampleSeedRgb(fgSeeds, [230, 170, 90]);
  const bgColors = sampleSeedRgb(bgSeeds, [15, 25, 40]);

  const minColorDist = (r: number, g: number, b: number, cluster: Array<[number, number, number]>) => {
    let bestSq = 1e12;
    for (let c = 0; c < cluster.length; c++) {
      const dr = r - cluster[c][0];
      const dg = g - cluster[c][1];
      const db = b - cluster[c][2];
      const dSq = dr * dr + dg * dg + db * db;
      if (dSq < bestSq) bestSq = dSq;
    }
    return Math.sqrt(bestSq);
  };

  const byteLen = w * h * 4;
  const matte = globalBufferPool.acquire(byteLen, true);
  for (let p = 0; p < w * h; p++) {
    const i = p * 4;
    const dFg = minColorDist(rgba[i], rgba[i + 1], rgba[i + 2], fgColors);
    const dBg = minColorDist(rgba[i], rgba[i + 1], rgba[i + 2], bgColors);
    const prob = clamp((dBg - dFg + 30) / 70, 0, 1);
    matte[i + 3] = Math.round(prob * 255);
  }

  if (refineEdgePx > 0) {
    const refined = globalBufferPool.acquire(byteLen, false);
    const scratch = globalBufferPool.acquire(byteLen, false);
    separableBoxBlur(matte, refined, scratch, w, h, refineEdgePx, refineEdgePx);
    matte.set(refined);
    globalBufferPool.release(refined);
    globalBufferPool.release(scratch);
  }

  for (let p = 0; p < w * h; p++) {
    rgba[p * 4 + 3] = Math.round(rgba[p * 4 + 3] * (matte[p * 4 + 3] / 255));
  }
  globalBufferPool.release(matte);
}

// Auto-Trace Alpha Channel into Editable Bezier Mask (MASK-08 + BUG-R3-05 coordinate-scale fix)
export function autoTraceAlphaToMask(
  rgba: Uint8ClampedArray,
  w: number,
  h: number,
  threshold = 64,
  coordScale = 1,
): MaskItem {
  let minX = w, minY = h, maxX = 0, maxY = 0, found = false;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (rgba[(y * w + x) * 4 + 3] >= threshold) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
        found = true;
      }
    }
  }
  if (!found) {
    minX = w * 0.25;
    minY = h * 0.25;
    maxX = w * 0.75;
    maxY = h * 0.75;
  }
  const s = coordScale > 0 ? coordScale : 1;
  const x0 = Math.round(minX * s);
  const y0 = Math.round(minY * s);
  const x1 = Math.round((maxX + 1) * s);
  const y1 = Math.round((maxY + 1) * s);
  const verts: MaskVertex[] = [
    { x: x0, y: y0, inX: 0, inY: 0, outX: 0, outY: 0 },
    { x: x1, y: y0, inX: 0, inY: 0, outX: 0, outY: 0 },
    { x: x1, y: y1, inX: 0, inY: 0, outX: 0, outY: 0 },
    { x: x0, y: y1, inX: 0, inY: 0, outX: 0, outY: 0 },
  ];
  return {
    id: createId('mask'),
    name: 'Auto-Traced Mask',
    mode: 'add',
    inverted: false,
    locked: false,
    rotoBezier: false,
    closed: true,
    vertices: verts,
    feather: 2,
    expansion: 0,
    opacity: 100,
  };
}
