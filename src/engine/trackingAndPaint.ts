import { PaintStroke, PuppetPin } from './types';
import { clamp, lerp } from '../utils/math';
import { parseHexColor } from '../utils/color';
import { globalBufferPool } from '../utils/bufferPool';

// Non-destructive timeline-recorded Brush, Clone Stamp, and Eraser engine
export function renderPaintStrokesOnBuffer(
  buf: Uint8ClampedArray,
  w: number,
  h: number,
  strokes: PaintStroke[],
  time: number,
  fps: number,
  scaleFactor = 1,
): void {
  if (strokes.length === 0) return;
  const frameDur = 1 / Math.max(1, fps);
  const needsClone = strokes.some((s) => s.tool === 'clone');
  let sourceSnapshot: Uint8ClampedArray | null = null;
  if (needsClone) {
    sourceSnapshot = globalBufferPool.acquire(buf.length, false);
    sourceSnapshot.set(buf);
  }

  for (const st of strokes) {
    if (time < st.startTime) continue;
    if (st.durationMode === 'single-frame' && time >= st.startTime + frameDur * 1.1) continue;
    if (st.durationMode === 'custom' && time > st.startTime + st.duration) continue;

    let revealRatio = 1;
    if (st.durationMode === 'write-on') {
      revealRatio = clamp((time - st.startTime) / Math.max(0.05, st.duration || 1), 0, 1);
    }

    const pts = st.points;
    if (pts.length === 0) continue;
    const endIdx = Math.max(1, Math.ceil(pts.length * revealRatio));
    const [cr, cg, cb] = parseHexColor(st.color);
    const rad = Math.max(1, st.radius * scaleFactor);
    const radSq = rad * rad;
    const op = clamp(st.opacity / 100, 0, 1);
    const hardFill = st.hardness >= 95;
    const hardExp = 1.5 - st.hardness / 100;

    const stampAt = (cx: number, cy: number) => {
      const x0 = Math.max(0, Math.floor(cx - rad));
      const x1 = Math.min(w - 1, Math.ceil(cx + rad));
      const y0 = Math.max(0, Math.floor(cy - rad));
      const y1 = Math.min(h - 1, Math.ceil(cy + rad));
      for (let y = y0; y <= y1; y++) {
        const dy = y - cy;
        const dySq = dy * dy;
        for (let x = x0; x <= x1; x++) {
          const dx = x - cx;
          const dSq = dx * dx + dySq;
          if (dSq > radSq) continue;
          const falloff = hardFill ? 1 : Math.pow(clamp(1 - Math.sqrt(dSq) / rad, 0, 1), hardExp);
          const strength = falloff * op;
          const o = (y * w + x) * 4;
          if (st.tool === 'eraser') {
            buf[o + 3] = Math.round(buf[o + 3] * (1 - strength));
          } else if (st.tool === 'clone' && sourceSnapshot) {
            const ox = Math.round((st.cloneOffset?.[0] ?? 24) * scaleFactor);
            const oy = Math.round((st.cloneOffset?.[1] ?? 0) * scaleFactor);
            const sx = clamp(x + ox, 0, w - 1);
            const sy = clamp(y + oy, 0, h - 1);
            const sp = (sy * w + sx) * 4;
            const srcA = (sourceSnapshot[sp + 3] / 255) * strength;
            const dstA = buf[o + 3] / 255;
            const outA = srcA + dstA * (1 - srcA);
            if (outA > 1e-4) {
              buf[o] = Math.round((sourceSnapshot[sp] * srcA + buf[o] * dstA * (1 - srcA)) / outA);
              buf[o + 1] = Math.round((sourceSnapshot[sp + 1] * srcA + buf[o + 1] * dstA * (1 - srcA)) / outA);
              buf[o + 2] = Math.round((sourceSnapshot[sp + 2] * srcA + buf[o + 2] * dstA * (1 - srcA)) / outA);
              buf[o + 3] = Math.round(outA * 255);
            }
          } else {
            const dstA = buf[o + 3] / 255;
            const outA = strength + dstA * (1 - strength);
            if (outA > 1e-4) {
              buf[o] = Math.round((cr * strength + buf[o] * dstA * (1 - strength)) / outA);
              buf[o + 1] = Math.round((cg * strength + buf[o + 1] * dstA * (1 - strength)) / outA);
              buf[o + 2] = Math.round((cb * strength + buf[o + 2] * dstA * (1 - strength)) / outA);
              buf[o + 3] = Math.round(outA * 255);
            }
          }
        }
      }
    };

    if (endIdx === 1) {
      stampAt(pts[0][0] * scaleFactor, pts[0][1] * scaleFactor);
    } else {
      for (let i = 0; i < endIdx - 1; i++) {
        const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
        const seg = Math.hypot((x1 - x0) * scaleFactor, (y1 - y0) * scaleFactor);
        const steps = Math.max(1, Math.ceil(seg / Math.max(1, rad * 0.4)));
        for (let s = 0; s <= steps; s++) {
          stampAt(lerp(x0, x1, s / steps) * scaleFactor, lerp(y0, y1, s / steps) * scaleFactor);
        }
      }
    }
  }

  if (sourceSnapshot) {
    globalBufferPool.release(sourceSnapshot);
  }
}

// Puppet Deform Inverse-Distance Mesh Warper (PNT-06)
export function applyPuppetPinsDeform(
  src: Uint8ClampedArray,
  dst: Uint8ClampedArray,
  w: number,
  h: number,
  pins: PuppetPin[],
  scaleFactor = 1,
): void {
  if (pins.length === 0) {
    dst.set(src);
    return;
  }
  const scaledPins = pins.map((pin) => ({
    px: pin.currentX * scaleFactor,
    py: pin.currentY * scaleFactor,
    dx: (pin.restX - pin.currentX) * scaleFactor,
    dy: (pin.restY - pin.currentY) * scaleFactor,
    k: pin.kind === 'starch' ? 3 : 1,
  }));
  const src32 = new Uint32Array(src.buffer, src.byteOffset, w * h);
  const dst32 = new Uint32Array(dst.buffer, dst.byteOffset, w * h);

  for (let y = 0; y < h; y++) {
    const rowOff = y * w;
    for (let x = 0; x < w; x++) {
      let sumW = 0, dxAcc = 0, dyAcc = 0;
      for (let i = 0; i < scaledPins.length; i++) {
        const p = scaledPins[i];
        const d2 = (x - p.px) * (x - p.px) + (y - p.py) * (y - p.py) + 64;
        const weight = p.k / d2;
        sumW += weight;
        dxAcc += p.dx * weight;
        dyAcc += p.dy * weight;
      }
      const invW = 1 / (sumW || 1);
      const sx = clamp(Math.round(x + dxAcc * invW), 0, w - 1);
      const sy = clamp(Math.round(y + dyAcc * invW), 0, h - 1);
      dst32[rowOff + x] = src32[sy * w + sx];
    }
  }
}

// 1-Point / 2-Point / 4-Point Patch Motion Tracker with Branch-and-Bound Early-Exit SAD Pruning (OPT-R3-05)
export function trackFeaturePatchNcc(
  refFrame: Uint8ClampedArray,
  targetFrame: Uint8ClampedArray,
  w: number,
  h: number,
  refX: number,
  refY: number,
  patchRadius = 5,
  searchRadius = 14,
): { x: number; y: number; confidence: number } {
  const rx = Math.round(refX);
  const ry = Math.round(refY);
  let bestX = rx;
  let bestY = ry;
  let bestSad = Infinity;

  for (let sy = -searchRadius; sy <= searchRadius; sy++) {
    const cy = ry + sy;
    if (cy < patchRadius || cy >= h - patchRadius) continue;
    for (let sx = -searchRadius; sx <= searchRadius; sx++) {
      const cx = rx + sx;
      if (cx < patchRadius || cx >= w - patchRadius) continue;
      let sad = 0;
      outerPatch: for (let py = -patchRadius; py <= patchRadius; py++) {
        const refRow = (ry + py) * w;
        const tgtRow = (cy + py) * w;
        for (let px = -patchRadius; px <= patchRadius; px++) {
          const iRef = (refRow + rx + px) * 4;
          const iTgt = (tgtRow + cx + px) * 4;
          sad +=
            Math.abs(refFrame[iRef] - targetFrame[iTgt]) +
            Math.abs(refFrame[iRef + 1] - targetFrame[iTgt + 1]) +
            Math.abs(refFrame[iRef + 2] - targetFrame[iTgt + 2]);
          if (sad >= bestSad) break outerPatch;
        }
      }
      if (sad < bestSad) {
        bestSad = sad;
        bestX = cx;
        bestY = cy;
      }
    }
  }
  const patchArea = (patchRadius * 2 + 1) ** 2 * 3 * 255;
  return {
    x: bestX,
    y: bestY,
    confidence: clamp(1 - bestSad / patchArea, 0, 1),
  };
}

// Content-Aware Video Fill — Spatial boundary inward synthesis (TRK-05)
export function synthesizeContentAwareFill(
  rgba: Uint8ClampedArray,
  w: number,
  h: number,
  holeBox: { x: number; y: number; width: number; height: number },
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(rgba);
  const x0 = clamp(Math.floor(holeBox.x), 1, w - 2);
  const y0 = clamp(Math.floor(holeBox.y), 1, h - 2);
  const x1 = clamp(Math.ceil(holeBox.x + holeBox.width), x0 + 1, w - 2);
  const y1 = clamp(Math.ceil(holeBox.y + holeBox.height), y0 + 1, h - 2);

  for (let y = y0; y <= y1; y++) {
    const v = (y - y0) / Math.max(1, y1 - y0);
    for (let x = x0; x <= x1; x++) {
      const u = (x - x0) / Math.max(1, x1 - x0);
      const pLeft = (y * w + (x0 - 1)) * 4;
      const pRight = (y * w + (x1 + 1)) * 4;
      const pTop = ((y0 - 1) * w + x) * 4;
      const pBot = ((y1 + 1) * w + x) * 4;
      const o = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) {
        const horiz = lerp(out[pLeft + c], out[pRight + c], u);
        const vert = lerp(out[pTop + c], out[pBot + c], v);
        out[o + c] = Math.round((horiz + vert) * 0.5);
      }
      out[o + 3] = 255;
    }
  }
  return out;
}
