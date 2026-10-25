import { MaskItem, ShapeContent, TextAnimatorSelector, TextLayerData } from './types';
import { clamp, degToRad, fbm2D, lerp } from '../utils/math';
import { hslToRgb, parseHexColor, rgbToHsl } from '../utils/color';

function plotDisc(
  buf: Uint8ClampedArray,
  w: number,
  h: number,
  cx: number,
  cy: number,
  radius: number,
  r: number,
  g: number,
  b: number,
  alpha01: number,
): void {
  const rad = Math.max(0.6, radius);
  const outerR = rad + 0.75;
  const outerRSq = outerR * outerR;
  const innerR = Math.max(0, rad - 0.25);
  const innerRSq = innerR * innerR;
  const x0 = Math.max(0, Math.floor(cx - outerR));
  const x1 = Math.min(w - 1, Math.ceil(cx + outerR));
  const y0 = Math.max(0, Math.floor(cy - outerR));
  const y1 = Math.min(h - 1, Math.ceil(cy + outerR));
  for (let y = y0; y <= y1; y++) {
    const dy = y - cy;
    const dySq = dy * dy;
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx;
      const dSq = dx * dx + dySq;
      if (dSq > outerRSq) continue;
      const cov = (dSq <= innerRSq ? 1 : clamp(outerR - Math.sqrt(dSq), 0, 1)) * alpha01;
      const o = (y * w + x) * 4;
      const da = buf[o + 3] / 255;
      const outA = cov + da * (1 - cov);
      if (outA > 0) {
        buf[o] = ((r * cov + buf[o] * da * (1 - cov)) / outA + 0.5) | 0;
        buf[o + 1] = ((g * cov + buf[o + 1] * da * (1 - cov)) / outA + 0.5) | 0;
        buf[o + 2] = ((b * cov + buf[o + 2] * da * (1 - cov)) / outA + 0.5) | 0;
        buf[o + 3] = (outA * 255 + 0.5) | 0;
      }
    }
  }
}

export function generateShapeVertices(shape: ShapeContent, cx: number, cy: number, scale: number, time: number): Array<[number, number]> {
  const hw = (shape.width * scale) / 2;
  const hh = (shape.height * scale) / 2;
  let pts: Array<[number, number]> = [];

  if (shape.kind === 'ellipse') {
    const segs = 64;
    for (let i = 0; i <= segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      pts.push([cx + Math.cos(a) * hw, cy + Math.sin(a) * hh]);
    }
  } else if (shape.kind === 'polystar') {
    const spikes = Math.max(3, Math.round(shape.points ?? 5));
    const outer = (shape.outerRadius ?? Math.min(shape.width, shape.height) * 0.5) * scale;
    const inner = (shape.innerRadius ?? outer * 0.48 / scale) * scale;
    const total = spikes * 2;
    for (let i = 0; i <= total; i++) {
      const a = (i / total) * Math.PI * 2 - Math.PI / 2;
      const rad = i % 2 === 0 ? outer : inner;
      pts.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]);
    }
  } else if (shape.kind === 'path' && shape.vertices && shape.vertices.length >= 2) {
    pts = shape.vertices.map((v) => [cx + v.x * scale, cy + v.y * scale]);
    pts.push(pts[0]);
  } else {
    // Rectangle (with optional Round Corners)
    const segs = 48;
    for (let i = 0; i <= segs; i++) {
      const u = i / segs;
      if (u < 0.25) pts.push([lerp(cx - hw, cx + hw, u * 4), cy - hh]);
      else if (u < 0.5) pts.push([cx + hw, lerp(cy - hh, cy + hh, (u - 0.25) * 4)]);
      else if (u < 0.75) pts.push([lerp(cx + hw, cx - hw, (u - 0.5) * 4), cy + hh]);
      else pts.push([cx - hw, lerp(cy + hh, cy - hh, (u - 0.75) * 4)]);
    }
  }

  // Apply non-destructive Shape Operators (Offset, Pucker/Bloat, Wiggle Paths, Zig Zag, Trim Paths)
  for (const op of shape.operators) {
    if (!op.enabled) continue;
    if (op.type === 'offset-paths') {
      const amt = Number(op.params.amount ?? 8) * scale;
      pts = pts.map(([px, py]) => {
        const dx = px - cx, dy = py - cy;
        const l = Math.hypot(dx, dy) || 1;
        return [px + (dx / l) * amt, py + (dy / l) * amt];
      });
    } else if (op.type === 'pucker-bloat') {
      const amt = Number(op.params.amount ?? 25) / 100;
      pts = pts.map(([px, py], idx) => {
        const f = idx % 2 === 0 ? 1 + amt * 0.35 : 1 - amt * 0.35;
        return [cx + (px - cx) * f, cy + (py - cy) * f];
      });
    } else if (op.type === 'wiggle-paths' || op.type === 'zig-zag') {
      const size = Number(op.params.size ?? 8) * scale;
      pts = pts.map(([px, py], idx) => {
        const n = op.type === 'zig-zag'
          ? (idx % 2 === 0 ? 1 : -1) * size
          : (fbm2D(idx * 0.35, time * 2, 2) - 0.5) * 2 * size;
        const dx = px - cx, dy = py - cy;
        const l = Math.hypot(dx, dy) || 1;
        return [px + (dx / l) * n, py + (dy / l) * n];
      });
    } else if (op.type === 'round-corners') {
      // Chaikin corner-cutting smoothing pass
      const smoothed: Array<[number, number]> = [];
      for (let i = 0; i < pts.length - 1; i++) {
        const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
        smoothed.push([0.75 * x0 + 0.25 * x1, 0.75 * y0 + 0.25 * y1]);
        smoothed.push([0.25 * x0 + 0.75 * x1, 0.25 * y0 + 0.75 * y1]);
      }
      if (smoothed.length > 2) pts = smoothed;
    } else if (op.type === 'trim-paths') {
      const startPct = clamp(Number(op.params.start ?? 0), 0, 100) / 100;
      const endPct = clamp(Number(op.params.end ?? 100), 0, 100) / 100;
      const offsetDeg = Number(op.params.offset ?? 0);
      const shift = (((offsetDeg / 360) % 1) + 1) % 1;
      const n = pts.length;
      if (n > 2 && endPct > startPct) {
        const outTrim: Array<[number, number]> = [];
        const sIdx = Math.floor(startPct * (n - 1));
        const eIdx = Math.max(sIdx + 1, Math.ceil(endPct * (n - 1)));
        for (let i = sIdx; i <= eIdx; i++) {
          outTrim.push(pts[(i + Math.floor(shift * n)) % n]);
        }
        pts = outTrim;
      }
    }
  }
  return pts;
}

export function rasterizeShapeLayer(
  buf: Uint8ClampedArray,
  w: number,
  h: number,
  shape: ShapeContent,
  scaleFactor: number,
  time: number,
): void {
  const repeater = shape.operators.find((o) => o.enabled && o.type === 'repeater');
  const copies = repeater ? Math.max(1, Math.min(24, Math.round(Number(repeater.params.copies ?? 4)))) : 1;
  const repRotDeg = repeater ? Number(repeater.params.rotation ?? 30) : 0;
  const repOffsetX = repeater ? Number(repeater.params.offsetX ?? 0) * scaleFactor : 0;
  const repOffsetY = repeater ? Number(repeater.params.offsetY ?? 0) * scaleFactor : 0;

  const [fr, fg, fb] = parseHexColor(shape.fillColor);
  const [er, eg, eb] = parseHexColor(shape.fillColorEnd ?? '#38BDF8');
  const [sr, sg, sb] = parseHexColor(shape.strokeColor);
  const fillAlpha = clamp((shape.fillOpacity ?? 100) / 100, 0, 1);
  const basePts = generateShapeVertices(shape, w / 2, h / 2, scaleFactor, time);

  const hasTrim = shape.operators.some((o) => o.enabled && o.type === 'trim-paths' && (Number(o.params.end ?? 100) - Number(o.params.start ?? 0) < 99.5));

  for (let c = 0; c < copies; c++) {
    const ang = degToRad(c * repRotDeg);
    const cos = Math.cos(ang), sin = Math.sin(ang);
    const pts: Array<[number, number]> = basePts.map(([px, py]) => {
      const dx = px - w / 2, dy = py - h / 2;
      return [
        w / 2 + dx * cos - dy * sin + c * repOffsetX,
        h / 2 + dx * sin + dy * cos + c * repOffsetY,
      ];
    });

    // Scanline polygon fill (when fillType !== 'none' and path is closed)
    if (shape.fillType !== 'none' && !hasTrim && pts.length >= 3) {
      let minY = h - 1, maxY = 0, minX = w - 1, maxX = 0;
      for (const [px, py] of pts) {
        if (py < minY) minY = Math.max(0, Math.floor(py));
        if (py > maxY) maxY = Math.min(h - 1, Math.ceil(py));
        if (px < minX) minX = Math.max(0, Math.floor(px));
        if (px > maxX) maxX = Math.min(w - 1, Math.ceil(px));
      }
      for (let y = minY; y <= maxY; y++) {
        const nodes: number[] = [];
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
          const [xi, yi] = pts[i], [xj, yj] = pts[j];
          if ((yi < y + 0.5 && yj >= y + 0.5) || (yj < y + 0.5 && yi >= y + 0.5)) {
            nodes.push(xi + ((y + 0.5 - yi) / (yj - yi)) * (xj - xi));
          }
        }
        nodes.sort((a, b) => a - b);
        for (let k = 0; k < nodes.length - 1; k += 2) {
          const xStart = Math.max(0, Math.ceil(nodes[k]));
          const xEnd = Math.min(w - 1, Math.floor(nodes[k + 1]));
          for (let x = xStart; x <= xEnd; x++) {
            let r = fr, g = fg, b = fb;
            if (shape.fillType === 'linear-gradient') {
              const u = clamp((x - minX) / Math.max(1, maxX - minX), 0, 1);
              r = lerp(fr, er, u); g = lerp(fg, eg, u); b = lerp(fb, eb, u);
            } else if (shape.fillType === 'radial-gradient') {
              const u = clamp(Math.hypot(x - w / 2, y - h / 2) / Math.max(8, (maxX - minX) * 0.55), 0, 1);
              r = lerp(fr, er, u); g = lerp(fg, eg, u); b = lerp(fb, eb, u);
            }
            const o = (y * w + x) * 4;
            buf[o] = r; buf[o + 1] = g; buf[o + 2] = b; buf[o + 3] = Math.round(fillAlpha * 255);
          }
        }
      }
    }

    // Anti-aliased Stroke along polyline
    const sw = (shape.strokeWidth ?? 0) * scaleFactor * 0.5;
    if (sw > 0.1 && pts.length >= 2) {
      let distAcc = 0;
      const dash = (shape.strokeDash ?? 0) * scaleFactor;
      for (let i = 0; i < pts.length - 1; i++) {
        const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
        const segLen = Math.hypot(x1 - x0, y1 - y0);
        const steps = Math.max(1, Math.ceil(segLen / Math.max(0.8, sw * 0.65)));
        for (let s = 0; s <= steps; s++) {
          const curDist = distAcc + (s / steps) * segLen;
          if (dash > 1 && Math.floor(curDist / dash) % 2 === 1) continue;
          plotDisc(buf, w, h, lerp(x0, x1, s / steps), lerp(y0, y1, s / steps), sw, sr, sg, sb, 1);
        }
        distAcc += segLen;
      }
    }
  }
}

// Compact procedural vector 5x7 crisp glyph stroke/bitmap renderer for headless Node + Canvas2D live text fallback
const GLYPH_BITMAPS: Record<string, number[]> = {
  A: [0x0e,0x11,0x11,0x1f,0x11,0x11,0x11], B: [0x1e,0x11,0x11,0x1e,0x11,0x11,0x1e],
  C: [0x0e,0x11,0x10,0x10,0x10,0x11,0x0e], D: [0x1c,0x12,0x11,0x11,0x11,0x12,0x1c],
  E: [0x1f,0x10,0x10,0x1e,0x10,0x10,0x1f], F: [0x1f,0x10,0x10,0x1e,0x10,0x10,0x10],
  G: [0x0e,0x11,0x10,0x17,0x11,0x11,0x0f], H: [0x11,0x11,0x11,0x1f,0x11,0x11,0x11],
  I: [0x0e,0x04,0x04,0x04,0x04,0x04,0x0e], J: [0x07,0x02,0x02,0x02,0x12,0x12,0x0c],
  K: [0x11,0x12,0x14,0x18,0x14,0x12,0x11], L: [0x10,0x10,0x10,0x10,0x10,0x10,0x1f],
  M: [0x11,0x1b,0x15,0x15,0x11,0x11,0x11], N: [0x11,0x19,0x15,0x13,0x11,0x11,0x11],
  O: [0x0e,0x11,0x11,0x11,0x11,0x11,0x0e], P: [0x1e,0x11,0x11,0x1e,0x10,0x10,0x10],
  Q: [0x0e,0x11,0x11,0x11,0x15,0x12,0x0d], R: [0x1e,0x11,0x11,0x1e,0x14,0x12,0x11],
  S: [0x0f,0x10,0x10,0x0e,0x01,0x01,0x1e], T: [0x1f,0x04,0x04,0x04,0x04,0x04,0x04],
  U: [0x11,0x11,0x11,0x11,0x11,0x11,0x0e], V: [0x11,0x11,0x11,0x11,0x11,0x0a,0x04],
  W: [0x11,0x11,0x11,0x15,0x15,0x1b,0x11], X: [0x11,0x11,0x0a,0x04,0x0a,0x11,0x11],
  Y: [0x11,0x11,0x0a,0x04,0x04,0x04,0x04], Z: [0x1f,0x01,0x02,0x04,0x08,0x10,0x1f],
  '0': [0x0e,0x11,0x13,0x15,0x19,0x11,0x0e], '1': [0x04,0x0c,0x04,0x04,0x04,0x04,0x0e],
  '2': [0x0e,0x11,0x01,0x06,0x08,0x10,0x1f], '3': [0x1f,0x02,0x04,0x06,0x01,0x11,0x0e],
  '4': [0x02,0x06,0x0a,0x12,0x1f,0x02,0x02], '5': [0x1f,0x10,0x1e,0x01,0x01,0x11,0x0e],
  '6': [0x06,0x08,0x10,0x1e,0x11,0x11,0x0e], '7': [0x1f,0x01,0x02,0x04,0x08,0x08,0x08],
  '8': [0x0e,0x11,0x11,0x0e,0x11,0x11,0x0e], '9': [0x0e,0x11,0x11,0x0f,0x01,0x02,0x0c],
  '/': [0x01,0x02,0x02,0x04,0x08,0x08,0x10], ':': [0x00,0x04,0x04,0x00,0x04,0x04,0x00],
  '-': [0x00,0x00,0x00,0x1f,0x00,0x00,0x00], '.': [0x00,0x00,0x00,0x00,0x00,0x0c,0x0c],
  '_': [0x00,0x00,0x00,0x00,0x00,0x00,0x1f], '+': [0x00,0x04,0x04,0x1f,0x04,0x04,0x00],
};

function computeSelectorWeight(sel: TextAnimatorSelector, charIdx: number, totalChars: number, time: number): number {
  const posPct = ((charIdx + 0.5) / Math.max(1, totalChars)) * 100;
  if (sel.selectorType === 'wiggly') {
    const freq = sel.wigglesPerSecond ?? 3;
    return fbm2D(charIdx * 0.75, time * freq, 2);
  }
  const s = sel.start + sel.offset;
  const e = sel.end + sel.offset;
  if (posPct < s || posPct > e) return 0;
  const norm = clamp((posPct - s) / Math.max(0.001, e - s), 0, 1);
  switch (sel.shape) {
    case 'ramp-up': return norm;
    case 'ramp-down': return 1 - norm;
    case 'triangle': return 1 - Math.abs(norm * 2 - 1);
    case 'round':
    case 'smooth': return Math.sin(norm * Math.PI);
    default: return 1;
  }
}

let sharedTextCanvas: HTMLCanvasElement | null = null;
let sharedTextCtx: CanvasRenderingContext2D | null = null;
const GLYPH_WIDTH_CACHE = new Map<string, number>();

function getSharedTextContext(w: number, h: number): CanvasRenderingContext2D | null {
  if (typeof document === 'undefined') return null;
  if (!sharedTextCanvas) {
    sharedTextCanvas = document.createElement('canvas');
    sharedTextCtx = sharedTextCanvas.getContext('2d', { willReadFrequently: true });
  }
  if (!sharedTextCanvas || !sharedTextCtx) return null;
  if (sharedTextCanvas.width !== w || sharedTextCanvas.height !== h) {
    sharedTextCanvas.width = w;
    sharedTextCanvas.height = h;
  } else {
    sharedTextCtx.clearRect(0, 0, w, h);
  }
  return sharedTextCtx;
}

export function rasterizeTextLayer(
  buf: Uint8ClampedArray,
  w: number,
  h: number,
  td: TextLayerData,
  masks: MaskItem[],
  scaleFactor: number,
  time: number,
): void {
  const rawText = td.allCaps ? td.text.toUpperCase() : td.text;
  const lines = rawText.split(/\r?\n/);
  const [baseR, baseG, baseB] = parseHexColor(td.fillColor);
  const fontPx = Math.max(6, td.fontSize * scaleFactor);
  const trackingPx = td.tracking * scaleFactor * 0.1;
  const lineH = Math.max(fontPx * 1.15, td.leading * scaleFactor);

  // OPT-R4-02: Reuse singleton Canvas2D ({ willReadFrequently: true }) + cached glyph advance widths!
  const ctx = getSharedTextContext(w, h);
  if (ctx) {
    const fontSpec = `${td.fontStyle} ${td.fontWeight} ${fontPx}px "${td.fontFamily}", Inter, sans-serif`;
    ctx.font = fontSpec;
    ctx.textBaseline = 'middle';
    const pathMask = td.pathMaskId ? masks.find((m) => m.id === td.pathMaskId) : undefined;
    let globalIdx = 0;
    const totalChars = Math.max(1, rawText.replace(/\n/g, '').length);

    lines.forEach((line, li) => {
      const chars = Array.from(line);
      const charWidths = chars.map((ch) => {
        const key = `${fontSpec}|${ch}`;
        let adv = GLYPH_WIDTH_CACHE.get(key);
        if (adv === undefined) {
          adv = ctx.measureText(ch).width;
          if (GLYPH_WIDTH_CACHE.size > 4096) GLYPH_WIDTH_CACHE.clear();
          GLYPH_WIDTH_CACHE.set(key, adv);
        }
        return adv + trackingPx;
      });
      const totalLineW = charWidths.reduce((a, b) => a + b, 0);
      let cursorX =
        td.align === 'center'
          ? (w - totalLineW) / 2
          : td.align === 'right'
            ? w - totalLineW - 24 * scaleFactor
            : 24 * scaleFactor;
      const baseY = h / 2 + (li - (lines.length - 1) / 2) * lineH;

      chars.forEach((ch, ci) => {
        let dx = 0, dy = 0, dz = 0, scX = 1, scY = 1, rot = 0, op = 1, hueShift = 0;
        for (const anim of td.animators) {
          const wt = computeSelectorWeight(anim, globalIdx, totalChars, time);
          if (wt !== 0) {
            dx += anim.positionOffset[0] * scaleFactor * wt;
            dy += anim.positionOffset[1] * scaleFactor * wt;
            dz += (anim.positionOffset[2] ?? 0) * scaleFactor * wt;
            scX += ((anim.scaleOffset[0] - 100) / 100) * wt;
            scY += ((anim.scaleOffset[1] - 100) / 100) * wt;
            rot += anim.rotationOffset * wt;
            op = clamp(op + (anim.opacityOffset / 100) * wt, 0, 1);
            cursorX += anim.trackingOffset * scaleFactor * 0.1 * wt;
            hueShift += (anim.fillHueShift ?? 0) * wt;
          }
        }

        let drawX = cursorX + charWidths[ci] * 0.5 + dx;
        let drawY = baseY + dy;
        if (pathMask && pathMask.vertices.length >= 2) {
          const u = clamp(globalIdx / Math.max(1, totalChars - 1), 0, 1);
          const segIdx = Math.min(pathMask.vertices.length - 2, Math.floor(u * (pathMask.vertices.length - 1)));
          const v0 = pathMask.vertices[segIdx], v1 = pathMask.vertices[segIdx + 1];
          const localT = u * (pathMask.vertices.length - 1) - segIdx;
          drawX = lerp(v0.x, v1.x, localT) * scaleFactor + dx;
          drawY = lerp(v0.y, v1.y, localT) * scaleFactor + dy;
        }
        if (td.perCharacter3D && dz !== 0) {
          const persp = 600 / Math.max(120, 600 + dz);
          scX *= persp; scY *= persp;
        }

        ctx.save();
        ctx.globalAlpha = op;
        ctx.translate(drawX, drawY);
        if (rot !== 0) ctx.rotate(degToRad(rot));
        ctx.scale(Math.max(0.05, scX), Math.max(0.05, scY));
        if (hueShift !== 0) {
          const [hh, ss, ll] = rgbToHsl(baseR, baseG, baseB);
          const [nr, ng, nb] = hslToRgb(hh + hueShift, ss, ll);
          ctx.fillStyle = `rgb(${nr},${ng},${nb})`;
        } else {
          ctx.fillStyle = td.fillColor;
        }
        if (td.strokeWidth > 0) {
          ctx.strokeStyle = td.strokeColor;
          ctx.lineWidth = td.strokeWidth * scaleFactor;
          ctx.strokeText(ch, -charWidths[ci] * 0.5, 0);
        }
        ctx.fillText(ch, -charWidths[ci] * 0.5, 0);
        ctx.restore();

        cursorX += charWidths[ci];
        globalIdx++;
      });
    });

    const img = ctx.getImageData(0, 0, w, h);
    buf.set(img.data);
    return;
  }

  // Headless Node software glyph rasterizer (used in unit/integration/perf tests!)
  const cellScale = Math.max(1, Math.round(fontPx / 7));
  const glyphW = 5 * cellScale + Math.round(trackingPx) + cellScale;
  let globalIdx = 0;
  const totalChars = Math.max(1, rawText.replace(/\n/g, '').length);

  lines.forEach((line, li) => {
    const upper = line.toUpperCase();
    const lineW = upper.length * glyphW;
    let startX = td.align === 'center' ? Math.round((w - lineW) / 2) : td.align === 'right' ? w - lineW - 12 : 12;
    const baseY = Math.round(h / 2 - (7 * cellScale) / 2 + (li - (lines.length - 1) / 2) * lineH);

    for (let ci = 0; ci < upper.length; ci++) {
      let dy = 0, op = 1;
      for (const anim of td.animators) {
        const wt = computeSelectorWeight(anim, globalIdx, totalChars, time);
        dy += anim.positionOffset[1] * scaleFactor * wt;
        op = clamp(op + (anim.opacityOffset / 100) * wt, 0, 1);
      }
      const rows = GLYPH_BITMAPS[upper[ci]];
      if (rows && op > 0.02) {
        for (let r = 0; r < 7; r++) {
          const bits = rows[r];
          for (let c = 0; c < 5; c++) {
            if ((bits >> (4 - c)) & 1) {
              for (let sy = 0; sy < cellScale; sy++) {
                for (let sx = 0; sx < cellScale; sx++) {
                  const px = startX + c * cellScale + sx;
                  const py = Math.round(baseY + dy) + r * cellScale + sy;
                  if (px >= 0 && px < w && py >= 0 && py < h) {
                    const o = (py * w + px) * 4;
                    buf[o] = baseR; buf[o + 1] = baseG; buf[o + 2] = baseB;
                    buf[o + 3] = Math.round(op * 255);
                  }
                }
              }
            }
          }
        }
      }
      startX += glyphW;
      globalIdx++;
    }
  });
}
