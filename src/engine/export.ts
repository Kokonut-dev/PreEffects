import { Composition, Project, RenderQueueItem } from './types';
import { renderCompositionFrame } from './compositor';
import { generateSynthAudioBuffer, processAudioEffectsChain } from './audio';
import { createBuiltInLut, sampleLut3D } from '../utils/color';

// Lossless RIFF WAV 16-bit PCM Encoder
export function encodeWavPcm16(samples: Float32Array, sampleRate = 48000): Uint8Array {
  const byteData = samples.length * 2;
  const buf = new ArrayBuffer(44 + byteData);
  const v = new DataView(buf);
  const wr = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
  };
  wr(0, 'RIFF');
  v.setUint32(4, 36 + byteData, true);
  wr(8, 'WAVE');
  wr(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  wr(36, 'data');
  v.setUint32(40, byteData, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Uint8Array(buf);
}

// TrueVision TGA 32-bit BGRA Frame Encoder (supports straight RGBA alpha!)
export function encodeTgaRgba(rgba: Uint8ClampedArray, w: number, h: number): Uint8Array {
  const out = new Uint8Array(18 + w * h * 4);
  out[2] = 2; // Uncompressed True-Color
  out[12] = w & 0xff;
  out[13] = (w >> 8) & 0xff;
  out[14] = h & 0xff;
  out[15] = (h >> 8) & 0xff;
  out[16] = 32; // 32-bit BGRA
  out[17] = 0x28; // top-left origin + 8-bit alpha
  let p = 18;
  for (let i = 0; i < rgba.length; i += 4) {
    out[p++] = rgba[i + 2];
    out[p++] = rgba[i + 1];
    out[p++] = rgba[i];
    out[p++] = rgba[i + 3];
  }
  return out;
}

// Portable Pixmap PPM Encoder
export function encodePpmFrame(rgba: Uint8ClampedArray, w: number, h: number): Uint8Array {
  const hdr = new TextEncoder().encode(`P6\n${w} ${h}\n255\n`);
  const out = new Uint8Array(hdr.length + w * h * 3);
  out.set(hdr, 0);
  let p = hdr.length;
  for (let i = 0; i < rgba.length; i += 4) {
    out[p++] = rgba[i]; out[p++] = rgba[i + 1]; out[p++] = rgba[i + 2];
  }
  return out;
}

// Radiance HDR / OpenEXR Float Scanline Package Encoder
export function encodeHdrFloatFrame(rgba: Uint8ClampedArray, w: number, h: number): Uint8Array {
  const hdr = new TextEncoder().encode(`#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y ${h} +X ${w}\n`);
  const out = new Uint8Array(hdr.length + w * h * 4);
  out.set(hdr, 0);
  let p = hdr.length;
  for (let i = 0; i < rgba.length; i += 4) {
    out[p++] = rgba[i];
    out[p++] = rgba[i + 1];
    out[p++] = rgba[i + 2];
    out[p++] = 128; // Exponent 2^0 = 1.0
  }
  return out;
}

// Animated GIF89a Uncompressed LZW-Clear Encoder — Pre-Allocated Zero-Boxed-Array Streaming Writer
export function encodeAnimatedGif(frames: Uint8ClampedArray[], w: number, h: number, fps: number): Uint8Array {
  const numPixels = w * h;
  const codesPerFrame = numPixels + Math.ceil(numPixels / 120) + 4;
  const subBlockOverhead = Math.ceil(codesPerFrame / 250) + 24;
  const maxBytes = 512 + frames.length * (codesPerFrame + subBlockOverhead);
  const out = new Uint8Array(maxBytes);
  const frameStream = new Uint8Array(codesPerFrame);
  let ptr = 0;

  const pushStr = (s: string) => { for (let i = 0; i < s.length; i++) out[ptr++] = s.charCodeAt(i); };
  const pushU16 = (n: number) => { out[ptr++] = n & 0xff; out[ptr++] = (n >> 8) & 0xff; };

  pushStr('GIF89a');
  pushU16(w);
  pushU16(h);
  out[ptr++] = 0xf6; out[ptr++] = 0; out[ptr++] = 0; // Global 128-color table (2^7 = 128 entries -> 7-bit min code size!)

  // 128-entry 5x5x5 quantized palette
  for (let idx = 0; idx < 128; idx++) {
    if (idx < 125) {
      out[ptr++] = Math.min(255, ((idx / 25) | 0) * 63);
      out[ptr++] = Math.min(255, (((idx / 5) | 0) % 5) * 63);
      out[ptr++] = Math.min(255, (idx % 5) * 63);
    } else {
      out[ptr++] = 0; out[ptr++] = 0; out[ptr++] = 0;
    }
  }

  // Netscape 2.0 Infinite Loop Application Extension
  out[ptr++] = 0x21; out[ptr++] = 0xff; out[ptr++] = 0x0b;
  pushStr('NETSCAPE2.0');
  out[ptr++] = 0x03; out[ptr++] = 0x01; out[ptr++] = 0x00; out[ptr++] = 0x00; out[ptr++] = 0x00;

  const delayCs = Math.max(2, Math.round(100 / Math.max(1, fps)));
  const CLEAR = 128;
  const EOI = 129;

  for (let f = 0; f < frames.length; f++) {
    const rgba = frames[f];
    // Graphic Control Extension
    out[ptr++] = 0x21; out[ptr++] = 0xf9; out[ptr++] = 0x04; out[ptr++] = 0x00;
    pushU16(delayCs);
    out[ptr++] = 0x00; out[ptr++] = 0x00;

    // Image Descriptor
    out[ptr++] = 0x2c;
    pushU16(0); pushU16(0); pushU16(w); pushU16(h);
    out[ptr++] = 0x00;
    out[ptr++] = 7; // LZW Minimum Code Size = 7

    let sLen = 0;
    let countSinceClear = 0;
    frameStream[sLen++] = CLEAR;
    for (let i = 0; i < rgba.length; i += 4) {
      const ri = ((rgba[i] + 32) >> 6) > 4 ? 4 : ((rgba[i] + 32) >> 6);
      const gi = ((rgba[i + 1] + 32) >> 6) > 4 ? 4 : ((rgba[i + 1] + 32) >> 6);
      const bi = ((rgba[i + 2] + 32) >> 6) > 4 ? 4 : ((rgba[i + 2] + 32) >> 6);
      frameStream[sLen++] = ri * 25 + gi * 5 + bi;
      if (++countSinceClear >= 120) {
        frameStream[sLen++] = CLEAR;
        countSinceClear = 0;
      }
    }
    frameStream[sLen++] = EOI;

    for (let offset = 0; offset < sLen; offset += 250) {
      const chunkLen = Math.min(250, sLen - offset);
      out[ptr++] = chunkLen;
      out.set(frameStream.subarray(offset, offset + chunkLen), ptr);
      ptr += chunkLen;
    }
    out[ptr++] = 0x00;
  }

  out[ptr++] = 0x3b;
  return out.subarray(0, ptr);
}

// RIFF AVI Uncompressed 24-bit BGR Video Container Encoder
export function encodeUncompressedAvi(frames: Uint8ClampedArray[], w: number, h: number, fps: number): Uint8Array {
  const rowStride = Math.ceil((w * 3) / 4) * 4;
  const frameSize = rowStride * h;
  const moviPayload = frames.length * (8 + frameSize);
  const totalSize = 220 + moviPayload;
  const buf = new ArrayBuffer(totalSize);
  const v = new DataView(buf);
  const out = new Uint8Array(buf);
  const wr = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };

  wr(0, 'RIFF');
  v.setUint32(4, totalSize - 8, true);
  wr(8, 'AVI ');
  wr(12, 'LIST');
  v.setUint32(16, 192, true);
  wr(20, 'hdrl');
  wr(24, 'avih');
  v.setUint32(28, 56, true);
  v.setUint32(32, Math.round(1_000_000 / Math.max(1, fps)), true); // microSecPerFrame
  v.setUint32(48, frames.length, true);
  v.setUint32(56, 1, true); // streams
  v.setUint32(60, frameSize, true);
  v.setUint32(64, w, true);
  v.setUint32(68, h, true);

  wr(88, 'LIST');
  v.setUint32(92, 116, true);
  wr(96, 'strl');
  wr(100, 'strh');
  v.setUint32(104, 56, true);
  wr(108, 'vids');
  wr(112, 'DIB ');
  v.setUint32(128, 1, true);
  v.setUint32(132, Math.round(fps), true);
  v.setUint32(140, frames.length, true);
  v.setUint32(144, frameSize, true);

  wr(164, 'strf');
  v.setUint32(168, 40, true);
  v.setUint32(172, 40, true);
  v.setInt32(176, w, true);
  v.setInt32(180, h, true);
  v.setUint16(184, 1, true);
  v.setUint16(186, 24, true);
  v.setUint32(192, frameSize, true);

  wr(208, 'LIST');
  v.setUint32(212, 4 + moviPayload, true);
  wr(216, 'movi');

  let ptr = 220;
  for (const rgba of frames) {
    wr(ptr, '00db');
    v.setUint32(ptr + 4, frameSize, true);
    ptr += 8;
    for (let y = h - 1; y >= 0; y--) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        out[ptr + x * 3] = rgba[i + 2];
        out[ptr + x * 3 + 1] = rgba[i + 1];
        out[ptr + x * 3 + 2] = rgba[i];
      }
      ptr += rowStride;
    }
  }
  return out;
}

export function executeRenderQueueJob(
  job: RenderQueueItem,
  project: Project,
  onProgress?: (pct: number, currentFrame: number) => void,
): RenderQueueItem {
  const t0 = performance.now();
  const comp = project.compositions.find((c) => c.id === job.compId) ?? project.compositions[0];
  if (!comp) {
    return { ...job, status: 'failed' };
  }

  const startF = Math.max(0, job.startFrame);
  const endF = Math.max(startF, job.endFrame);
  const totalFrames = endF - startF + 1;
  const needsMultiFrame = job.outputModules.some((m) =>
    m.format === 'gif' ||
    m.format === 'avi' ||
    m.format === 'webm' ||
    m.format === 'mp4-ffmpeg' ||
    m.format === 'prores-ffmpeg',
  );
  const needsAnyVideoFrame = job.outputModules.some((m) => m.format !== 'wav' || m.aovPasses.some((p) => p !== 'beauty'));
  const renderEndF = needsMultiFrame ? endF : startF;
  const renderTotal = Math.max(1, renderEndF - startF + 1);
  const beautyFrames: Uint8ClampedArray[] = [];
  let frameW = Math.max(16, Math.round(comp.width / job.resolutionDivisor));
  let frameH = Math.max(16, Math.round(comp.height / job.resolutionDivisor));

  if (needsAnyVideoFrame) {
    for (let f = startF; f <= renderEndF; f++) {
      const res = renderCompositionFrame(comp, f / comp.fps, project, {
        resolutionDivisor: job.resolutionDivisor,
        isFinalRender: true,
        useCache: false,
      });
      frameW = res.width;
      frameH = res.height;
      beautyFrames.push(res.pixels);
      onProgress?.(Math.round(((f - startF + 1) / renderTotal) * 100), f);
    }
  } else {
    onProgress?.(100, startF);
  }

  const artifacts: NonNullable<RenderQueueItem['renderedArtifacts']> = [];

  for (const mod of job.outputModules) {
    // Optional output LUT pass
    let modFrames = beautyFrames;
    if (mod.lutPreset) {
      const lut = createBuiltInLut(mod.lutPreset);
      modFrames = beautyFrames.map((src) => {
        const dst = new Uint8ClampedArray(src.length);
        for (let i = 0; i < src.length; i += 4) {
          const [lr, lg, lb] = sampleLut3D(lut, src[i] / 255, src[i + 1] / 255, src[i + 2] / 255);
          dst[i] = Math.round(lr * 255);
          dst[i + 1] = Math.round(lg * 255);
          dst[i + 2] = Math.round(lb * 255);
          dst[i + 3] = src[i + 3];
        }
        return dst;
      });
    }

    if (mod.format === 'gif') {
      const gif = encodeAnimatedGif(modFrames, frameW, frameH, comp.fps);
      artifacts.push({ name: `${mod.outputName}.gif`, mimeType: 'image/gif', byteLength: gif.byteLength, data: gif });
    } else if (mod.format === 'avi' || mod.format === 'webm' || mod.format === 'mp4-ffmpeg' || mod.format === 'prores-ffmpeg') {
      const avi = encodeUncompressedAvi(modFrames, frameW, frameH, comp.fps);
      const ext = mod.format === 'avi' ? 'avi' : `${mod.format.replace('-ffmpeg', '')}.avi`;
      artifacts.push({ name: `${mod.outputName}.${ext}`, mimeType: 'video/x-msvideo', byteLength: avi.byteLength, data: avi });
    } else if (mod.format === 'wav') {
      const audioLayer = comp.layers.find((l) => l.type === 'audio' && l.audioEnabled);
      const rawSamples = generateSynthAudioBuffer(totalFrames / comp.fps, project.audioSampleRate);
      const processed = processAudioEffectsChain(rawSamples, project.audioSampleRate, audioLayer?.effects ?? [], audioLayer?.audioGainDb ?? 0);
      const wav = encodeWavPcm16(processed, project.audioSampleRate);
      artifacts.push({ name: `${mod.outputName}.wav`, mimeType: 'audio/wav', byteLength: wav.byteLength, data: wav });
    } else if (mod.format === 'tga-seq' || mod.format === 'png-frame') {
      const tga = encodeTgaRgba(modFrames[0], frameW, frameH);
      artifacts.push({ name: `${mod.outputName}_0001.tga`, mimeType: 'image/x-tga', byteLength: tga.byteLength, data: tga });
    } else if (mod.format === 'exr-seq') {
      const hdr = encodeHdrFloatFrame(modFrames[0], frameW, frameH);
      artifacts.push({ name: `${mod.outputName}_0001.hdr`, mimeType: 'image/vnd.radiance', byteLength: hdr.byteLength, data: hdr });
    } else {
      const ppm = encodePpmFrame(modFrames[0], frameW, frameH);
      artifacts.push({ name: `${mod.outputName}_0001.ppm`, mimeType: 'image/x-portable-pixmap', byteLength: ppm.byteLength, data: ppm });
    }

    // Multi-pass AOV sidecars
    for (const aov of mod.aovPasses) {
      if (aov === 'beauty') continue;
      const aovFrame = renderCompositionFrame(comp, startF / comp.fps, project, {
        resolutionDivisor: job.resolutionDivisor,
        isFinalRender: true,
        useCache: false,
        aovPass: aov,
      });
      const tgaAov = encodeTgaRgba(aovFrame.pixels, aovFrame.width, aovFrame.height);
      artifacts.push({
        name: `${mod.outputName}_${aov}_0001.tga`,
        mimeType: 'image/x-tga',
        byteLength: tgaAov.byteLength,
        data: tgaAov,
      });
    }
  }

  return {
    ...job,
    status: 'completed',
    progressPct: 100,
    elapsedMs: performance.now() - t0,
    renderedArtifacts: artifacts,
  };
}
