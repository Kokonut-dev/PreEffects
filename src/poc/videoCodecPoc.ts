// POC 4: Zero-Dependency Audio WAV + Image PPM Frame Sequence Encoder/Decoder Pipeline
export function encodePcmToWav(samples: Float32Array, sampleRate = 48000): Uint8Array {
  const dataBytes = samples.length * 2;
  const buf = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buf);
  const writeStr = (off: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, dataBytes, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Uint8Array(buf);
}

export function encodeFrameToPpm(rgba: Uint8ClampedArray, w: number, h: number): Uint8Array {
  const header = `P6\n${w} ${h}\n255\n`;
  const hdrBytes = new TextEncoder().encode(header);
  const out = new Uint8Array(hdrBytes.length + w * h * 3);
  out.set(hdrBytes, 0);
  let p = hdrBytes.length;
  for (let i = 0; i < rgba.length; i += 4) {
    out[p++] = rgba[i];
    out[p++] = rgba[i + 1];
    out[p++] = rgba[i + 2];
  }
  return out;
}
