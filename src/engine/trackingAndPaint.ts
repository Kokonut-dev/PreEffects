import { PaintStroke, PuppetPin } from './types';
import { clamp, lerp } from '../utils/math';
import { parseHexColor } from '../utils/color';

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
  const sourceSnapshot = strokes.some((s) => s.tool === 'clone') ? new Uint8ClampedArray(buf) : null;

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
    const op = clamp(st.opacity / 100, 0, 1);

    const stampAt = (cx: number, cy: number) => {
      const x0 = Math.max(0, Math.floor(cx - rad));
      const x1 = Math.min(w - 1, Math.ceil(cx + rad));
      const y0 = Math.max(0, Math.floor(cy - rad));
      const y1 = Math.min(h - 1, Math.ceil(cy + rad));
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const dist = Math.hypot(x - cx, y - cy);
          if (dist > rad) continue;
          const falloff = st.hardness >= 95 ? 1 : Math.pow(clamp(1 - dist / rad, 0, 1), 1.5 - (st.hardness / 100));
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
            buf[o] = lerp(buf[o], sourceSnapshot[sp], strength);
            buf[o + 1] = lerp(buf[o + 1], sourceSnapshot[sp + 1], strength);
            buf[o + 2] = lerp(buf[o + 2], sourceSnapshot[sp + 2], strength);
            buf[o + 3] = Math.max(buf[o + 3], Math.round(sourceSnapshot[sp + 3] * strength));
          } else {
            buf[o] = lerp(buf[o], cr, strength);
            buf[o + 1] = lerp(buf[o + 1], cg, strength);
            buf[o + 2] = lerp(buf[o + 2], cb, strength);
            buf[o + 3] = Math.max(buf[o + 3], Math.round(strength * 255));
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
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sumW = 0, dxAcc = 0, dyAcc = 0;
      for (const pin of pins) {
        const px = pin.currentX * scaleFactor;
        const py = pin.currentY * scaleFactor;
        const rx = pin.restX * scaleFactor;
        const ry = pin.restY * scaleFactor;
        const d2 = (x - px) * (x - px) + (y - py) * (y - py) + 64;
        const weight = (pin.kind === 'starch' ? 3 : 1) / d2;
        sumW += weight;
        dxAcc += (rx - px) * weight;
        dyAcc += (ry - py) * weight;
      }
      const sx = clamp(Math.round(x + dxAcc / (sumW || 1)), 0, w - 1);
      const sy = clamp(Math.round(y + dyAcc / (sumW || 1)), 0, h - 1);
      const sIdx = (sy * w + sx) * 4;
      const dIdx = (y * w + x) * 4;
      dst[dIdx] = src[sIdx]; dst[dIdx + 1] = src[sIdx + 1]; dst[dIdx + 2] = src[sIdx + 2]; dst[dIdx + 3] = src[sIdx + 3];
    }
  }
}

// 1-Point / 2-Point / 4-Point Normalized Cross-Correlation (NCC) Patch Motion Tracker
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
  let bestX = refX;
  let bestY = refY;
  let bestSad = Infinity;

  for (let sy = -searchRadius; sy <= searchRadius; sy++) {
    for (let sx = -searchRadius; sx <= searchRadius; sx++) {
      const cx = refX + sx;
      const cy = refY + sy;
      if (cx < patchRadius || cx >= w - patchRadius || cy < patchRadius || cy >= h - patchRadius) continue;
      let sad = 0;
      for (let py = -patchRadius; py <= patchRadius; py++) {
        for (let px = -patchRadius; px <= patchRadius; px++) {
          const iRef = ((Math.round(refY) + py) * w + (Math.round(refX) + px)) * 4;
          const iTgt = ((Math.round(cy) + py) * w + (Math.round(cx) + px)) * 4;
          sad +=
            Math.abs(refFrame[iRef] - targetFrame[iTgt]) +
            Math.abs(refFrame[iRef + 1] - targetFrame[iTgt + 1]) +
            Math.abs(refFrame[iRef + 2] - targetFrame[iTgt + 2]);
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

// Content-Aware Video Fill — Spatial boundary boundary inward synthesis (TRK-05)
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
