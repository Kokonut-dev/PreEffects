// POC 5: Text Layout + Range Selector Per-Character 2D/3D Animator Engine
export interface GlyphPose {
  char: string;
  index: number;
  x: number;
  y: number;
  z: number;
  opacity: number;
  scale: number;
  rotation: number;
}

export function evaluateTextAnimatorPoc(
  text: string,
  fontSize: number,
  tracking: number,
  rangeStartPct: number,
  rangeEndPct: number,
  offsetPct: number,
  animDelta: { dy: number; dz: number; opacity: number; scale: number; rotation: number },
): GlyphPose[] {
  const chars = Array.from(text);
  const count = Math.max(1, chars.length);
  const start = rangeStartPct + offsetPct;
  const end = rangeEndPct + offsetPct;
  let cursorX = 0;

  return chars.map((ch, idx) => {
    const posPct = ((idx + 0.5) / count) * 100;
    let weight = 0;
    if (posPct >= start && posPct <= end) {
      const span = Math.max(0.001, end - start);
      const norm = (posPct - start) / span;
      // Smooth ramp bell weight
      weight = Math.sin(norm * Math.PI);
    }
    const pose: GlyphPose = {
      char: ch,
      index: idx,
      x: cursorX + 0,
      y: animDelta.dy * weight + 0,
      z: animDelta.dz * weight + 0,
      opacity: 1 + (animDelta.opacity - 1) * weight + 0,
      scale: 1 + (animDelta.scale - 1) * weight + 0,
      rotation: animDelta.rotation * weight + 0,
    };
    cursorX += fontSize * 0.6 + tracking;
    return pose;
  });
}
