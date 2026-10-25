import { Composition, Project, RenderQueueItem } from './types';
import { renderCompositionFrame } from './compositor';
import { generateSynthAudioBuffer, processAudioEffectsChain } from './audio';
import { createBuiltInLut, sampleLut3D } from '../utils/color';
import { clamp } from '../utils/math';

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c = CRC32_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function adler32(bytes: Uint8Array): number {
  let a = 1;
  let b = 0;
  const MOD = 65521;
  let i = 0;
  while (i < bytes.length) {
    const end = Math.min(bytes.length, i + 5552);
    while (i < end) {
      a += bytes[i++];
      b += a;
    }
    a %= MOD;
    b %= MOD;
  }
  return ((b << 16) | a) >>> 0;
}

function makePngChunk(typeAscii: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length, false);
  for (let i = 0; i < 4; i++) out[4 + i] = typeAscii.charCodeAt(i);
  out.set(data, 8);
  const crc = crc32(out.subarray(4, 8 + data.length));
  dv.setUint32(8 + data.length, crc, false);
  return out;
}

/**
 * QOL-R4-08: Pure-TypeScript RFC-2083 32-bit RGBA PNG Encoder (lossless straight RGBA + alpha).
 * Uses valid RFC-1950 zlib stream with stored DEFLATE blocks so it works deterministically
 * offline in both Chromium/Electron and headless Node/Vitest without native addons.
 */
export function encodePngRgba(rgba: Uint8ClampedArray, w: number, h: number): Uint8Array {
  const stride = w * 4 + 1; // 1 filter byte (0 = None) + RGBA scanline
  const raw = new Uint8Array(stride * h);
  for (let y = 0; y < h; y++) {
    const dstRow = y * stride;
    raw[dstRow] = 0;
    const srcOff = y * w * 4;
    raw.set(rgba.subarray(srcOff, srcOff + w * 4), dstRow + 1);
  }

  const maxBlock = 65535;
  const numBlocks = Math.max(1, Math.ceil(raw.length / maxBlock));
  const zlibData = new Uint8Array(2 + numBlocks * 5 + raw.length + 4);
  zlibData[0] = 0x78; // CMF: Deflate, 32K window
  zlibData[1] = 0x01; // FLG: FCHECK valid ((0x78*256 + 0x01) % 31 === 0)
  let zOff = 2;
  let rOff = 0;
  for (let b = 0; b < numBlocks; b++) {
    const len = Math.min(maxBlock, raw.length - rOff);
    const isFinal = b === numBlocks - 1 ? 1 : 0;
    zlibData[zOff++] = isFinal;
    zlibData[zOff++] = len & 0xff;
    zlibData[zOff++] = (len >>> 8) & 0xff;
    const nlen = (~len) & 0xffff;
    zlibData[zOff++] = nlen & 0xff;
    zlibData[zOff++] = (nlen >>> 8) & 0xff;
    zlibData.set(raw.subarray(rOff, rOff + len), zOff);
    zOff += len;
    rOff += len;
  }
  const adler = adler32(raw);
  new DataView(zlibData.buffer).setUint32(zOff, adler, false);

  const ihdr = new Uint8Array(13);
  const ihdrDv = new DataView(ihdr.buffer);
  ihdrDv.setUint32(0, w, false);
  ihdrDv.setUint32(4, h, false);
  ihdr[8] = 8; // 8-bit per channel
  ihdr[9] = 6; // Color type 6: Truecolor with Alpha (RGBA)
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrChunk = makePngChunk('IHDR', ihdr);
  const idatChunk = makePngChunk('IDAT', zlibData);
  const iendChunk = makePngChunk('IEND', new Uint8Array(0));

  const png = new Uint8Array(sig.length + ihdrChunk.length + idatChunk.length + iendChunk.length);
  let p = 0;
  png.set(sig, p); p += sig.length;
  png.set(ihdrChunk, p); p += ihdrChunk.length;
  png.set(idatChunk, p); p += idatChunk.length;
  png.set(iendChunk, p);
  return png;
}

/**
 * QOL-R4-08: Pure-TypeScript PKZIP 2.0 archive encoder for lossless PNG sequence bundles (`png-seq-zip`).
 */
export function encodeZipArchive(entries: Array<{ name: string; data: Uint8Array }>): Uint8Array {
  const enc = new TextEncoder();
  const prepared = entries.map((e) => ({
    nameBytes: enc.encode(e.name),
    data: e.data,
    crc: crc32(e.data),
    localOffset: 0,
  }));

  let localTotal = 0;
  let centralTotal = 0;
  for (const item of prepared) {
    item.localOffset = localTotal;
    localTotal += 30 + item.nameBytes.length + item.data.length;
    centralTotal += 46 + item.nameBytes.length;
  }

  const out = new Uint8Array(localTotal + centralTotal + 22);
  const dv = new DataView(out.buffer);
  let p = 0;

  for (const item of prepared) {
    dv.setUint32(p, 0x04034b50, true);
    dv.setUint16(p + 4, 20, true);
    dv.setUint16(p + 6, 0x0800, true);
    dv.setUint16(p + 8, 0, true);
    dv.setUint16(p + 10, 0, true);
    dv.setUint16(p + 12, 0x21, true);
    dv.setUint32(p + 14, item.crc, true);
    dv.setUint32(p + 18, item.data.length, true);
    dv.setUint32(p + 22, item.data.length, true);
    dv.setUint16(p + 26, item.nameBytes.length, true);
    dv.setUint16(p + 28, 0, true);
    p += 30;
    out.set(item.nameBytes, p);
    p += item.nameBytes.length;
    out.set(item.data, p);
    p += item.data.length;
  }

  const centralStart = p;
  for (const item of prepared) {
    dv.setUint32(p, 0x02014b50, true);
    dv.setUint16(p + 4, 20, true);
    dv.setUint16(p + 6, 20, true);
    dv.setUint16(p + 8, 0x0800, true);
    dv.setUint16(p + 10, 0, true);
    dv.setUint16(p + 12, 0, true);
    dv.setUint16(p + 14, 0x21, true);
    dv.setUint32(p + 16, item.crc, true);
    dv.setUint32(p + 20, item.data.length, true);
    dv.setUint32(p + 24, item.data.length, true);
    dv.setUint16(p + 28, item.nameBytes.length, true);
    dv.setUint16(p + 30, 0, true);
    dv.setUint16(p + 32, 0, true);
    dv.setUint16(p + 34, 0, true);
    dv.setUint16(p + 36, 0, true);
    dv.setUint32(p + 38, 0, true);
    dv.setUint32(p + 42, item.localOffset, true);
    p += 46;
    out.set(item.nameBytes, p);
    p += item.nameBytes.length;
  }

  dv.setUint32(p, 0x06054b50, true);
  dv.setUint16(p + 4, 0, true);
  dv.setUint16(p + 6, 0, true);
  dv.setUint16(p + 8, prepared.length, true);
  dv.setUint16(p + 10, prepared.length, true);
  dv.setUint32(p + 12, centralTotal, true);
  dv.setUint32(p + 16, centralStart, true);
  dv.setUint16(p + 20, 0, true);

  return out;
}

/** Mix all active audio-enabled layers in a composition into mono PCM float32 [-1..1] */
export function mixCompositionAudioSamples(
  project: Project,
  comp: Composition,
  startSec: number,
  durationSec: number,
  sampleRate = 48000,
): Float32Array {
  const count = Math.max(1, Math.floor(durationSec * sampleRate));
  const mix = new Float32Array(count);
  let mixedAny = false;

  for (const layer of comp.layers) {
    if (!layer.audioEnabled || !layer.assetId) continue;
    const asset = project.assets.find((a) => a.id === layer.assetId);
    if (!asset?.audioSamples || asset.audioSamples.length === 0) continue;
    const srcSamples = asset.audioSamples;
    const srcRate = asset.audioSampleRate || srcSamples.length / Math.max(0.05, asset.duration || comp.duration);
    const stretch = Math.max(0.05, (layer.stretchPct || 100) / 100);
    const layerBuf = new Float32Array(count);
    let layerHasSamples = false;

    for (let i = 0; i < count; i++) {
      const compT = startSec + i / sampleRate;
      if (compT < layer.inPoint || compT > layer.outPoint) continue;
      const localT = (compT - layer.startTime) / stretch;
      if (localT < 0) continue;
      const sIdx = Math.floor(localT * srcRate);
      if (sIdx >= 0 && sIdx < srcSamples.length) {
        layerBuf[i] = srcSamples[sIdx];
        layerHasSamples = true;
      }
    }

    if (layerHasSamples) {
      const processed = processAudioEffectsChain(layerBuf, sampleRate, layer.effects, layer.audioGainDb ?? 0);
      for (let i = 0; i < count; i++) mix[i] += processed[i];
      mixedAny = true;
    }
  }

  if (!mixedAny) {
    const audioLayer = comp.layers.find((l) => l.type === 'audio' && l.audioEnabled);
    const synth = generateSynthAudioBuffer(durationSec, sampleRate);
    return processAudioEffectsChain(synth, sampleRate, audioLayer?.effects ?? [], audioLayer?.audioGainDb ?? 0);
  }

  for (let i = 0; i < count; i++) {
    mix[i] = clamp(mix[i], -1, 1);
  }
  return mix;
}

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
  out[ptr++] = 0xf6; out[ptr++] = 0; out[ptr++] = 0;

  for (let idx = 0; idx < 128; idx++) {
    if (idx < 125) {
      out[ptr++] = Math.min(255, ((idx / 25) | 0) * 63);
      out[ptr++] = Math.min(255, (((idx / 5) | 0) % 5) * 63);
      out[ptr++] = Math.min(255, (idx % 5) * 63);
    } else {
      out[ptr++] = 0; out[ptr++] = 0; out[ptr++] = 0;
    }
  }

  out[ptr++] = 0x21; out[ptr++] = 0xff; out[ptr++] = 0x0b;
  pushStr('NETSCAPE2.0');
  out[ptr++] = 0x03; out[ptr++] = 0x01; out[ptr++] = 0x00; out[ptr++] = 0x00; out[ptr++] = 0x00;

  const delayCs = Math.max(2, Math.round(100 / Math.max(1, fps)));
  const CLEAR = 128;
  const EOI = 129;

  for (let f = 0; f < frames.length; f++) {
    const rgba = frames[f];
    out[ptr++] = 0x21; out[ptr++] = 0xf9; out[ptr++] = 0x04; out[ptr++] = 0x00;
    pushU16(delayCs);
    out[ptr++] = 0x00; out[ptr++] = 0x00;

    out[ptr++] = 0x2c;
    pushU16(0); pushU16(0); pushU16(w); pushU16(h);
    out[ptr++] = 0x00;
    out[ptr++] = 7;

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
  v.setUint32(32, Math.round(1_000_000 / Math.max(1, fps)), true);
  v.setUint32(48, frames.length, true);
  v.setUint32(56, 1, true);
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

/**
 * Browser/Electron hardware-accelerated MediaRecorder video encoder (.webm VP9/VP8 or .mp4 H.264/AVC).
 * Returns null in headless Node environments where `MediaRecorder` / `captureStream` are unavailable.
 */
export async function encodeMediaRecorderVideo(
  frames: Uint8ClampedArray[],
  w: number,
  h: number,
  fps: number,
  preferMp4: boolean,
): Promise<{ bytes: Uint8Array; extension: 'mp4' | 'webm' } | null> {
  if (typeof document === 'undefined' || typeof MediaRecorder === 'undefined' || frames.length === 0) {
    return null;
  }

  const candidates: Array<{ mime: string; ext: 'mp4' | 'webm' }> = preferMp4
    ? [
        { mime: 'video/mp4;codecs=avc1.42E01E', ext: 'mp4' },
        { mime: 'video/mp4', ext: 'mp4' },
        { mime: 'video/webm;codecs=vp9', ext: 'webm' },
        { mime: 'video/webm;codecs=vp8', ext: 'webm' },
        { mime: 'video/webm', ext: 'webm' },
      ]
    : [
        { mime: 'video/webm;codecs=vp9', ext: 'webm' },
        { mime: 'video/webm;codecs=vp8', ext: 'webm' },
        { mime: 'video/webm', ext: 'webm' },
        { mime: 'video/mp4', ext: 'mp4' },
      ];

  const chosen = candidates.find((c) => {
    try {
      return MediaRecorder.isTypeSupported(c.mime);
    } catch {
      return false;
    }
  });
  if (!chosen) return null;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx || typeof canvas.captureStream !== 'function') return null;

  const stream = canvas.captureStream(fps);
  const chunks: BlobPart[] = [];
  const recorder = new MediaRecorder(stream, {
    mimeType: chosen.mime,
    videoBitsPerSecond: Math.max(2_500_000, w * h * 8),
  });

  recorder.ondataavailable = (ev) => {
    if (ev.data && ev.data.size > 0) chunks.push(ev.data);
  };

  const stopped = new Promise<Uint8Array>((resolve, reject) => {
    recorder.onerror = () => reject(new Error('MediaRecorder encoding error'));
    recorder.onstop = async () => {
      try {
        const blob = new Blob(chunks, { type: chosen.mime });
        const ab = await blob.arrayBuffer();
        resolve(new Uint8Array(ab));
      } catch (err) {
        reject(err);
      }
    };
  });

  recorder.start();
  const imgData = ctx.createImageData(w, h);
  const frameDelayMs = Math.max(12, Math.round(1000 / Math.max(1, fps)));
  const videoTrack = stream.getVideoTracks()[0] as MediaStreamTrack & { requestFrame?: () => void };

  for (let i = 0; i < frames.length; i++) {
    imgData.data.set(frames[i]);
    ctx.putImageData(imgData, 0, 0);
    videoTrack?.requestFrame?.();
    await new Promise((r) => setTimeout(r, frameDelayMs));
  }

  recorder.stop();
  stream.getTracks().forEach((t) => t.stop());
  const bytes = await stopped;
  if (bytes.length < 32) return null;
  return { bytes, extension: chosen.ext };
}

function applyChannelPolicy(frames: Uint8ClampedArray[], channels: 'rgb' | 'rgba' | 'alpha'): Uint8ClampedArray[] {
  if (channels === 'rgba') return frames;
  return frames.map((src) => {
    const dst = new Uint8ClampedArray(src.length);
    if (channels === 'alpha') {
      for (let i = 0; i < src.length; i += 4) {
        const a = src[i + 3];
        dst[i] = a; dst[i + 1] = a; dst[i + 2] = a; dst[i + 3] = 255;
      }
    } else {
      for (let i = 0; i < src.length; i += 4) {
        dst[i] = src[i]; dst[i + 1] = src[i + 1]; dst[i + 2] = src[i + 2]; dst[i + 3] = 255;
      }
    }
    return dst;
  });
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
    m.format === 'png-seq-zip' ||
    m.format === 'webm' ||
    m.format === 'mp4-ffmpeg' ||
    m.format === 'prores-ffmpeg',
  );
  const needsAlphaBg = job.outputModules.some((m) => m.channels === 'rgba' || m.channels === 'alpha');
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
        transparentBackground: needsAlphaBg,
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
    let modFrames = applyChannelPolicy(beautyFrames, mod.channels);
    if (mod.lutPreset) {
      const lut = createBuiltInLut(mod.lutPreset);
      modFrames = modFrames.map((src) => {
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
    } else if (mod.format === 'png-frame') {
      const png = encodePngRgba(modFrames[0], frameW, frameH);
      artifacts.push({
        name: `${mod.outputName}_${String(startF).padStart(4, '0')}.png`,
        mimeType: 'image/png',
        byteLength: png.byteLength,
        data: png,
      });
    } else if (mod.format === 'png-seq-zip') {
      const entries = modFrames.map((frm, idx) => ({
        name: `${mod.outputName}_${String(startF + idx).padStart(5, '0')}.png`,
        data: encodePngRgba(frm, frameW, frameH),
      }));
      const zip = encodeZipArchive(entries);
      artifacts.push({
        name: `${mod.outputName}_png_seq.zip`,
        mimeType: 'application/zip',
        byteLength: zip.byteLength,
        data: zip,
      });
    } else if (mod.format === 'avi' || mod.format === 'webm' || mod.format === 'mp4-ffmpeg' || mod.format === 'prores-ffmpeg') {
      const avi = encodeUncompressedAvi(modFrames, frameW, frameH, comp.fps);
      const ext = mod.format === 'avi' ? 'avi' : `${mod.format.replace('-ffmpeg', '')}.avi`;
      artifacts.push({ name: `${mod.outputName}.${ext}`, mimeType: 'video/x-msvideo', byteLength: avi.byteLength, data: avi });
    } else if (mod.format === 'wav') {
      const mixed = mixCompositionAudioSamples(
        project,
        comp,
        startF / comp.fps,
        totalFrames / comp.fps,
        project.audioSampleRate,
      );
      const wav = encodeWavPcm16(mixed, project.audioSampleRate);
      artifacts.push({ name: `${mod.outputName}.wav`, mimeType: 'audio/wav', byteLength: wav.byteLength, data: wav });
    } else if (mod.format === 'tga-seq') {
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
      const pngAov = encodePngRgba(aovFrame.pixels, aovFrame.width, aovFrame.height);
      artifacts.push({
        name: `${mod.outputName}_${aov}_0001.png`,
        mimeType: 'image/png',
        byteLength: pngAov.byteLength,
        data: pngAov,
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

/**
 * QOL-R4-08: Async Render Queue job runner used by the Studio UI.
 * Upgrades `webm` and `mp4-ffmpeg` output modules to genuine browser/Electron `MediaRecorder`
 * `.webm` (VP9/VP8) / `.mp4` (H.264) files when available, falling back to `executeRenderQueueJob` otherwise.
 */
export async function executeRenderQueueJobAsync(
  job: RenderQueueItem,
  project: Project,
  onProgress?: (pct: number, currentFrame: number) => void,
): Promise<RenderQueueItem> {
  const baseResult = executeRenderQueueJob(job, project, onProgress);
  if (
    baseResult.status !== 'completed' ||
    !baseResult.renderedArtifacts ||
    !job.outputModules.some((m) => m.format === 'webm' || m.format === 'mp4-ffmpeg')
  ) {
    return baseResult;
  }

  const comp = project.compositions.find((c) => c.id === job.compId) ?? project.compositions[0];
  if (!comp) return baseResult;

  const startF = Math.max(0, job.startFrame);
  const endF = Math.max(startF, job.endFrame);
  const frames: Uint8ClampedArray[] = [];
  let frameW = Math.max(16, Math.round(comp.width / job.resolutionDivisor));
  let frameH = Math.max(16, Math.round(comp.height / job.resolutionDivisor));
  for (let f = startF; f <= endF; f++) {
    const res = renderCompositionFrame(comp, f / comp.fps, project, {
      resolutionDivisor: job.resolutionDivisor,
      isFinalRender: true,
      useCache: true,
    });
    frameW = res.width;
    frameH = res.height;
    frames.push(res.pixels);
  }

  const upgradedArtifacts = [...baseResult.renderedArtifacts];
  for (const mod of job.outputModules) {
    if (mod.format !== 'webm' && mod.format !== 'mp4-ffmpeg') continue;
    try {
      const encoded = await encodeMediaRecorderVideo(frames, frameW, frameH, comp.fps, mod.format === 'mp4-ffmpeg');
      if (encoded) {
        const expectedFallbackName = `${mod.outputName}.${mod.format.replace('-ffmpeg', '')}.avi`;
        const idx = upgradedArtifacts.findIndex((a) => a.name === expectedFallbackName);
        const nextArtifact = {
          name: `${mod.outputName}.${encoded.extension}`,
          mimeType: encoded.extension === 'mp4' ? 'video/mp4' : 'video/webm',
          byteLength: encoded.bytes.byteLength,
          data: encoded.bytes,
        };
        if (idx >= 0) upgradedArtifacts[idx] = nextArtifact;
        else upgradedArtifacts.push(nextArtifact);
      }
    } catch {
      // Keep deterministic RIFF AVI artifact on MediaRecorder error
    }
  }

  return {
    ...baseResult,
    renderedArtifacts: upgradedArtifacts,
  };
}
