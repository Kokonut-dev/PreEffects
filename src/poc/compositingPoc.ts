// POC 1: Multi-Layer Compositing + O(1) Sliding-Window Blur + Blend Pipeline
export interface PocLayer {
  width: number;
  height: number;
  pixels: Uint8ClampedArray;
  opacity: number;
  blendMode: 'normal' | 'add' | 'multiply' | 'screen';
  blurRadius?: number;
}

export function fastHorizontalBoxBlur(
  src: Uint8ClampedArray,
  dst: Uint8ClampedArray,
  w: number,
  h: number,
  radius: number,
): void {
  const r = Math.max(1, Math.floor(radius));
  const diam = r * 2 + 1;
  for (let y = 0; y < h; y++) {
    let sr = 0, sg = 0, sb = 0, sa = 0;
    const row = y * w;
    for (let i = -r; i <= r; i++) {
      const x = Math.min(w - 1, Math.max(0, i));
      const idx = (row + x) * 4;
      sr += src[idx]; sg += src[idx + 1]; sb += src[idx + 2]; sa += src[idx + 3];
    }
    for (let x = 0; x < w; x++) {
      const out = (row + x) * 4;
      dst[out] = sr / diam;
      dst[out + 1] = sg / diam;
      dst[out + 2] = sb / diam;
      dst[out + 3] = sa / diam;
      const removeX = Math.max(0, x - r);
      const addX = Math.min(w - 1, x + r + 1);
      const rIdx = (row + removeX) * 4;
      const aIdx = (row + addX) * 4;
      sr += src[aIdx] - src[rIdx];
      sg += src[aIdx + 1] - src[rIdx + 1];
      sb += src[aIdx + 2] - src[rIdx + 2];
      sa += src[aIdx + 3] - src[rIdx + 3];
    }
  }
}

export function compositePocStack(w: number, h: number, layers: PocLayer[]): Uint8ClampedArray {
  const out = new Uint8ClampedArray(w * h * 4);
  const scratch = new Uint8ClampedArray(w * h * 4);
  for (let li = layers.length - 1; li >= 0; li--) {
    const layer = layers[li];
    let src = layer.pixels;
    if (layer.blurRadius && layer.blurRadius > 0) {
      fastHorizontalBoxBlur(src, scratch, w, h, layer.blurRadius);
      src = scratch;
    }
    const op = layer.opacity;
    for (let i = 0; i < out.length; i += 4) {
      const sa = (src[i + 3] / 255) * op;
      if (sa <= 0) continue;
      const da = out[i + 3] / 255;
      for (let c = 0; c < 3; c++) {
        const s = src[i + c] / 255;
        const d = out[i + c] / 255;
        let b = s;
        if (layer.blendMode === 'add') b = Math.min(1, s + d);
        else if (layer.blendMode === 'multiply') b = s * d;
        else if (layer.blendMode === 'screen') b = 1 - (1 - s) * (1 - d);
        const res = b * sa + d * (1 - sa);
        out[i + c] = Math.round(res * 255);
      }
      out[i + 3] = Math.round((sa + da * (1 - sa)) * 255);
    }
  }
  return out;
}
