import { Composition, Layer, LayerType, Project } from './types';
import { clamp, degToRad } from '../utils/math';
import { parseHexColor } from '../utils/color';
import { fnv1aHash, globalBufferPool, LruFrameCache } from '../utils/bufferPool';
import { evaluateProperty } from './expressions';
import { executeEffectBuffer, EvaluatedParams } from '../effects/registry';
import { applyLayerMasksToBuffer, applyLocalAiRotoBrush } from './masksAndRoto';
import { rasterizeShapeLayer, rasterizeTextLayer } from './shapesAndText';
import { applyCameraDepthOfField, compute3DLightingFactor, computeLayerWorldMatrix, rasterizeObjMesh3D } from './threeD';
import { applyPuppetPinsDeform, renderPaintStrokesOnBuffer } from './trackingAndPaint';
import { blendChannel38, blendLayerBufferOntoComp, drawSmpteMissingBars } from './blendModes';

export { blendChannel38, blendLayerBufferOntoComp };

export interface EffectTimingItem {
  effectInstanceId: string;
  effectName: string;
  layerId: string;
  layerName: string;
  durationMs: number;
}

export interface LayerTimingItem {
  layerId: string;
  layerName: string;
  durationMs: number;
}

export interface CompositeFrameResult {
  width: number;
  height: number;
  pixels: Uint8ClampedArray;
  fromCache: boolean;
  totalTimeMs: number;
  layerTimings: LayerTimingItem[];
  effectTimings: EffectTimingItem[];
  expressionErrors: Array<{ layerId: string; layerName: string; message: string }>;
}

export interface RenderFrameOptions {
  resolutionDivisor?: 1 | 2 | 3 | 4;
  isFinalRender?: boolean;
  useCache?: boolean;
  channelView?: 'rgb' | 'red' | 'green' | 'blue' | 'alpha' | 'alpha-boundary';
  roi?: { x: number; y: number; width: number; height: number } | null;
  aovPass?: 'beauty' | 'z-depth' | 'normals' | 'object-id' | 'motion-vectors';
}

export const studioRamCache = new LruFrameCache(512);
void (null as unknown as LayerType);

function transformLayerPixels2D3D(
  src: Uint8ClampedArray,
  dst: Uint8ClampedArray,
  w: number,
  h: number,
  layer: Layer,
  comp: Composition,
  activeCamera: Layer | undefined,
  time: number,
  scaleFactor: number,
  project?: Project,
): [number, number, number] {
  const worldMat = computeLayerWorldMatrix(layer, comp, time, project);
  const compCx = comp.width / 2;
  const compCy = comp.height / 2;
  const worldCenter = [worldMat[12], worldMat[13], worldMat[14]] as [number, number, number];

  // Camera perspective projection factor
  let perspScale = 1;
  let camOffsetX = 0;
  let camOffsetY = 0;
  if (layer.threeD && activeCamera?.cameraSettings) {
    const camPos = evaluateProperty(activeCamera.transform.position, time, activeCamera, comp, project).value;
    const focalPx = (activeCamera.cameraSettings.focalLengthMm / 36) * comp.width;
    const relZ = Math.max(80, worldCenter[2] - (camPos[2] || -focalPx));
    perspScale = focalPx / relZ;
    camOffsetX = (compCx - camPos[0]) * perspScale;
    camOffsetY = (compCy - camPos[1]) * perspScale;
  }

  const posX = (worldCenter[0] + camOffsetX) * scaleFactor;
  const posY = (worldCenter[1] + camOffsetY) * scaleFactor;
  const scl = evaluateProperty(layer.transform.scale, time, layer, comp, project).value;
  const rz = evaluateProperty(layer.transform.rotationZ, time, layer, comp, project).value;
  const sx = Math.max(0.02, (scl[0] / 100) * perspScale);
  const sy = Math.max(0.02, (scl[1] / 100) * perspScale);

  // Fast identity shortcut (most full-frame Solids, Footage, Precomps at [960,540], scale 100%, rot 0)
  if (
    Math.abs(posX - w / 2) < 0.75 &&
    Math.abs(posY - h / 2) < 0.75 &&
    Math.abs(sx - 1) < 0.005 &&
    Math.abs(sy - 1) < 0.005 &&
    Math.abs(rz % 360) < 0.05
  ) {
    dst.set(src);
    return worldCenter;
  }

  const rad = -degToRad(rz);
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const anc = evaluateProperty(layer.transform.anchorPoint, time, layer, comp, project).value;
  const ancX = anc[0] * scaleFactor;
  const ancY = anc[1] * scaleFactor;

  // Incremental inverse-affine scanline stepping + 32-bit word pixel moves + tight AABB scissor
  const dRxDx = cos / sx;
  const dRxDy = -sin / sx;
  const dRyDx = sin / sy;
  const dRyDy = cos / sy;

  // Forward-project the 4 source corners [0,0], [w,0], [0,h], [w,h] to scissor destination bounds
  const fCos = Math.cos(-rad);
  const fSin = Math.sin(-rad);
  const cCorners: Array<[number, number]> = [[0, 0], [w, 0], [0, h], [w, h]];
  let minX = w, maxX = 0, minY = h, maxY = 0;
  for (let c = 0; c < 4; c++) {
    const lx = (cCorners[c][0] - ancX) * sx;
    const ly = (cCorners[c][1] - ancY) * sy;
    const wx = posX + lx * fCos - ly * fSin;
    const wy = posY + lx * fSin + ly * fCos;
    if (wx < minX) minX = wx;
    if (wx > maxX) maxX = wx;
    if (wy < minY) minY = wy;
    if (wy > maxY) maxY = wy;
  }
  const x0 = Math.max(0, Math.floor(minX) - 1);
  const x1 = Math.min(w - 1, Math.ceil(maxX) + 1);
  const y0 = Math.max(0, Math.floor(minY) - 1);
  const y1 = Math.min(h - 1, Math.ceil(maxY) + 1);

  const src32 = new Uint32Array(src.buffer, src.byteOffset, w * h);
  const dst32 = new Uint32Array(dst.buffer, dst.byteOffset, w * h);

  for (let y = y0; y <= y1; y++) {
    const dy = y - posY;
    const dx0 = x0 - posX;
    let rx = dx0 * dRxDx + dy * dRxDy + ancX + 0.5;
    let ry = dx0 * dRyDx + dy * dRyDy + ancY + 0.5;
    const rowOff = y * w;
    for (let x = x0; x <= x1; x++) {
      const ix = rx | 0;
      const iy = ry | 0;
      if (ix >= 0 && ix < w && iy >= 0 && iy < h && rx >= 0 && ry >= 0) {
        const px = src32[iy * w + ix];
        if ((px >>> 24) !== 0) {
          dst32[rowOff + x] = px;
        }
      }
      rx += dRxDx;
      ry += dRyDx;
    }
  }
  return worldCenter;
}

export function renderCompositionFrame(
  comp: Composition,
  time: number,
  project?: Project,
  options: RenderFrameOptions = {},
  nestDepth = 0,
  visitedComps?: Set<string>,
): CompositeFrameResult {
  const t0 = performance.now();
  const safeFps = Math.max(1, Number.isFinite(comp.fps) && comp.fps > 0 ? comp.fps : 24);
  const div = options.resolutionDivisor ?? 1;
  const scaleFactor = 1 / div;
  const w = Math.max(16, Math.round((comp.width || 16) * scaleFactor));
  const h = Math.max(16, Math.round((comp.height || 16) * scaleFactor));
  const frameIndex = Math.max(0, Math.round(time * safeFps));
  const aov = options.aovPass ?? 'beauty';
  const chView = options.channelView ?? 'rgb';
  const visitedSet = visitedComps ?? new Set<string>([comp.id]);

  // Comprehensive O(L) cache signature covering transforms, effects & params, masks, colors, and expressions
  let cacheKey = '';
  const shouldCache = options.useCache !== false && !options.roi && nestDepth === 0;
  if (shouldCache) {
    let sig = `${comp.id}|${frameIndex}|${div}|${aov}|${chView}|${comp.backgroundColor}|${comp.motionBlurEnabled ? 1 : 0}|${comp.shutterAngle}`;
    for (let i = 0; i < comp.layers.length; i++) {
      const l = comp.layers[i];
      const tr = l.transform;
      const asset = l.assetId ? project?.assets.find((a) => a.id === l.assetId) : undefined;
      sig += `;${l.id}:${l.visible ? 1 : 0}:${l.solo ? 1 : 0}:${l.threeD ? 1 : 0}:${l.motionBlur ? 1 : 0}:${l.inPoint}:${l.outPoint}:${l.startTime}:${l.stretchPct}:${l.parentId ?? ''}:${l.blendMode}:${l.trackMatteMode}:${l.trackMatteLayerId ?? ''}:${l.solidColor ?? ''}:${l.assetId ?? ''}:${asset?.missing ? 1 : 0}`;
      sig += `:${tr.anchorPoint.value[0]},${tr.anchorPoint.value[1]},${tr.anchorPoint.value[2]},${tr.anchorPoint.keyframes.length}`;
      sig += `:${tr.position.value[0]},${tr.position.value[1]},${tr.position.value[2]},${tr.position.keyframes.length}`;
      sig += `:${tr.scale.value[0]},${tr.scale.value[1]},${tr.scale.value[2]},${tr.scale.keyframes.length}`;
      sig += `:${tr.rotationX.value},${tr.rotationY.value},${tr.rotationZ.value},${tr.rotationZ.keyframes.length}`;
      sig += `:${tr.opacity.value},${tr.opacity.keyframes.length}`;
      sig += `:${tr.position.expressionEnabled ? tr.position.expression : ''}:${tr.opacity.expressionEnabled ? tr.opacity.expression : ''}`;
      if (tr.position.animated && tr.position.keyframes.length > 0) {
        for (let ki = 0; ki < tr.position.keyframes.length; ki++) {
          const kf = tr.position.keyframes[ki];
          sig += `@p${kf.time},${kf.value[0]},${kf.value[1]},${kf.interpolation}`;
        }
      }
      if (tr.opacity.animated && tr.opacity.keyframes.length > 0) {
        for (let ki = 0; ki < tr.opacity.keyframes.length; ki++) {
          const kf = tr.opacity.keyframes[ki];
          sig += `@o${kf.time},${kf.value},${kf.interpolation}`;
        }
      }
      if (l.textData) {
        sig += `:T(${l.textData.text}|${l.textData.fontSize}|${l.textData.tracking}|${l.textData.leading}|${l.textData.align}|${l.textData.fillColor}|${l.textData.strokeColor}|${l.textData.strokeWidth}|${l.textData.animators.length})`;
      }
      if (l.shapeContent) {
        sig += `:S(${l.shapeContent.kind}|${l.shapeContent.width}|${l.shapeContent.height}|${l.shapeContent.fillColor}|${l.shapeContent.strokeColor}|${l.shapeContent.strokeWidth}|${l.shapeContent.operators.length})`;
        for (let oi = 0; oi < l.shapeContent.operators.length; oi++) {
          const op = l.shapeContent.operators[oi];
          sig += `#${op.type}:${op.enabled ? 1 : 0}`;
        }
      }
      if (l.cameraSettings) {
        sig += `:C(${l.cameraSettings.focalLengthMm}|${l.cameraSettings.depthOfField ? 1 : 0}|${l.cameraSettings.focusDistance}|${l.cameraSettings.aperture})`;
      }
      if (l.lightSettings) {
        sig += `:L(${l.lightSettings.lightType}|${l.lightSettings.color}|${l.lightSettings.intensity})`;
      }
      sig += `:P(${l.paintStrokes.length}):PP(${l.puppetPins.length}):R(${l.rotoMatteEnabled ? 1 : 0},${l.rotoForegroundSeeds?.length ?? 0},${l.rotoBackgroundSeeds?.length ?? 0}):M(${l.masks.length})`;
      for (let psi = 0; psi < l.paintStrokes.length; psi++) {
        const ps = l.paintStrokes[psi];
        sig += `!${ps.tool}:${ps.color}:${ps.radius}:${ps.opacity}:${ps.points.length}`;
      }
      for (let pi = 0; pi < l.puppetPins.length; pi++) {
        const pin = l.puppetPins[pi];
        sig += `^${pin.currentX},${pin.currentY}`;
      }
      for (let mi = 0; mi < l.masks.length; mi++) {
        const m = l.masks[mi];
        sig += `~${m.mode}:${m.inverted ? 1 : 0}:${m.feather}:${m.opacity}:${m.expansion}:${m.vertices.length}`;
      }
      for (let fi = 0; fi < l.effects.length; fi++) {
        const fx = l.effects[fi];
        sig += `/${fx.id}:${fx.enabled ? 1 : 0}`;
        for (const pk in fx.params) {
          const pv = fx.params[pk];
          sig += `,${pk}=${String(pv.value)}:${pv.animated ? pv.keyframes.length : 0}:${pv.expressionEnabled ? pv.expression ?? '' : ''}`;
        }
      }
    }
    cacheKey = `${comp.id}_${frameIndex}_${div}_${fnv1aHash(sig)}`;
    const hit = studioRamCache.get(cacheKey);
    if (hit && hit.width === w && hit.height === h) {
      return {
        width: w,
        height: h,
        pixels: hit.pixels,
        fromCache: true,
        totalTimeMs: performance.now() - t0,
        layerTimings: [],
        effectTimings: [],
        expressionErrors: [],
      };
    }
  }

  const out = new Uint8ClampedArray(w * h * 4);
  const [bgR, bgG, bgB] = parseHexColor(comp.backgroundColor);
  if (nestDepth === 0 && aov === 'beauty') {
    for (let i = 0; i < out.length; i += 4) {
      out[i] = bgR; out[i + 1] = bgG; out[i + 2] = bgB; out[i + 3] = 255;
    }
  }

  const layerTimings: LayerTimingItem[] = [];
  const effectTimings: EffectTimingItem[] = [];
  const expressionErrors: Array<{ layerId: string; layerName: string; message: string }> = [];

  const anySolo = comp.layers.some((l) => l.solo);
  const activeCamera = comp.layers.find((l) => l.type === 'camera' && l.visible);
  const matteSourceLayerIds = new Set(
    comp.layers
      .filter((l) => l.trackMatteMode !== 'none' && l.trackMatteLayerId)
      .map((l) => l.trackMatteLayerId!),
  );

  const evaluatePreTransformLayer = (layer: Layer, sampleTime: number): Uint8ClampedArray => {
    const isFullFill = layer.type === 'solid' || layer.type === 'guide';
    let rawBuf = globalBufferPool.acquire(w * h * 4, !isFullFill);
    const stretch = Math.max(0.05, Math.abs(layer.stretchPct || 100) / 100);
    let localTime = (sampleTime - layer.startTime) / stretch;
    if (layer.timeRemap?.animated) {
      localTime = evaluateProperty(layer.timeRemap, sampleTime, layer, comp, project).value;
    }

    if (isFullFill) {
      const [sr, sg, sb] = parseHexColor(layer.solidColor ?? (layer.type === 'guide' ? '#38BDF8' : '#2A3448'));
      const fillAlpha = layer.type === 'guide' && !layer.solidColor ? 96 : 255;
      // Native SIMD 32-bit RGBA word fill (little-endian: A<<24 | B<<16 | G<<8 | R)
      const packed = ((fillAlpha << 24) | (sb << 16) | (sg << 8) | sr) >>> 0;
      new Uint32Array(rawBuf.buffer, rawBuf.byteOffset, w * h).fill(packed);
    } else if (layer.type === 'shape' && layer.shapeContent) {
      rasterizeShapeLayer(rawBuf, w, h, layer.shapeContent, scaleFactor, localTime);
    } else if (layer.type === 'text' && layer.textData) {
      rasterizeTextLayer(rawBuf, w, h, layer.textData, layer.masks, scaleFactor, localTime);
    } else if (layer.type === 'precomp' && layer.precompId && nestDepth < 6 && !visitedSet.has(layer.precompId)) {
      const subComp = project?.compositions.find((c) => c.id === layer.precompId);
      if (subComp) {
        const nextVisited = new Set(visitedSet);
        nextVisited.add(subComp.id);
        const subRes = renderCompositionFrame(subComp, localTime, project, { resolutionDivisor: div, useCache: false }, nestDepth + 1, nextVisited);
        if (subRes.width === w && subRes.height === h) {
          rawBuf.set(subRes.pixels);
        } else {
          for (let y = 0; y < h; y++) {
            const sy = Math.min(subRes.height - 1, Math.floor((y / h) * subRes.height));
            for (let x = 0; x < w; x++) {
              const sx = Math.min(subRes.width - 1, Math.floor((x / w) * subRes.width));
              const si = (sy * subRes.width + sx) * 4;
              const di = (y * w + x) * 4;
              rawBuf[di] = subRes.pixels[si];
              rawBuf[di + 1] = subRes.pixels[si + 1];
              rawBuf[di + 2] = subRes.pixels[si + 2];
              rawBuf[di + 3] = subRes.pixels[si + 3];
            }
          }
        }
      }
    } else if (layer.type === 'footage') {
      const asset = project?.assets.find((a) => a.id === layer.assetId);
      if (!asset || asset.missing) {
        drawSmpteMissingBars(rawBuf, w, h);
      } else if (asset.kind === 'mesh3d' && asset.mesh3D) {
        const rx = evaluateProperty(layer.transform.rotationX, sampleTime, layer, comp, project).value;
        const ry = evaluateProperty(layer.transform.rotationY, sampleTime, layer, comp, project).value;
        const rz = evaluateProperty(layer.transform.rotationZ, sampleTime, layer, comp, project).value;
        rasterizeObjMesh3D(rawBuf, w, h, asset.mesh3D, rx, ry + localTime * 25, rz, layer.labelColor);
      } else if (asset.rgbaBuffer && asset.width && asset.height) {
        for (let y = 0; y < h; y++) {
          const sy = Math.min(asset.height - 1, Math.floor((y / h) * asset.height));
          for (let x = 0; x < w; x++) {
            const sx = Math.min(asset.width - 1, Math.floor((x / w) * asset.width));
            const si = (sy * asset.width + sx) * 4;
            const di = (y * w + x) * 4;
            rawBuf[di] = asset.rgbaBuffer[si];
            rawBuf[di + 1] = asset.rgbaBuffer[si + 1];
            rawBuf[di + 2] = asset.rgbaBuffer[si + 2];
            rawBuf[di + 3] = asset.rgbaBuffer[si + 3];
          }
        }
      } else {
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const o = (y * w + x) * 4;
            rawBuf[o] = clamp(18 + (x / w) * 65, 0, 255);
            rawBuf[o + 1] = clamp(28 + (y / h) * 80, 0, 255);
            rawBuf[o + 2] = clamp(56 + Math.sin(localTime * 2 + x * 0.02) * 35, 0, 255);
            rawBuf[o + 3] = 255;
          }
        }
      }
    }

    if (layer.paintStrokes.length > 0) {
      renderPaintStrokesOnBuffer(rawBuf, w, h, layer.paintStrokes, sampleTime, comp.fps, scaleFactor);
    }

    if (layer.puppetPins.length > 0) {
      const deformed = globalBufferPool.acquire(w * h * 4);
      applyPuppetPinsDeform(rawBuf, deformed, w, h, layer.puppetPins, scaleFactor);
      rawBuf.set(deformed);
      globalBufferPool.release(deformed);
    }

    if (layer.masks.length > 0) {
      applyLayerMasksToBuffer(rawBuf, w, h, layer.masks, scaleFactor);
    }
    if (layer.rotoMatteEnabled) {
      applyLocalAiRotoBrush(rawBuf, w, h, layer.rotoForegroundSeeds ?? [[0.5, 0.5]], layer.rotoBackgroundSeeds ?? [[0.05, 0.05]]);
    }

    if (layer.type !== 'adjustment' && layer.effects.length > 0) {
      let fxDst = globalBufferPool.acquire(w * h * 4, false);
      for (const fx of layer.effects) {
        if (!fx.enabled) continue;
        const fxStart = performance.now();
        const evalParams: EvaluatedParams = {};
        for (const [k, prop] of Object.entries(fx.params)) {
          const res = evaluateProperty(prop, sampleTime, layer, comp, project);
          if (res.error) expressionErrors.push({ layerId: layer.id, layerName: layer.name, message: res.error });
          evalParams[k] = res.value;
        }
        executeEffectBuffer(fx.effectId, rawBuf, fxDst, evalParams, {
          width: w,
          height: h,
          time: sampleTime,
          fps: comp.fps,
          frameIndex,
        });
        const tmp = rawBuf;
        rawBuf = fxDst;
        fxDst = tmp;
        effectTimings.push({
          effectInstanceId: fx.id,
          effectName: fx.name,
          layerId: layer.id,
          layerName: layer.name,
          durationMs: performance.now() - fxStart,
        });
      }
      globalBufferPool.release(fxDst);
    }
    return rawBuf;
  };

  const applySpatialTransformAndShading = (
    layer: Layer,
    rawBuf: Uint8ClampedArray,
    sampleTime: number,
    releaseRaw: boolean,
  ): Uint8ClampedArray => {
    if (
      releaseRaw &&
      !layer.threeD &&
      !layer.parentId &&
      !layer.transform.position.animated &&
      !layer.transform.position.expressionEnabled &&
      !layer.transform.scale.animated &&
      !layer.transform.rotationZ.animated &&
      Math.abs(layer.transform.position.value[0] - comp.width / 2) < 0.75 &&
      Math.abs(layer.transform.position.value[1] - comp.height / 2) < 0.75 &&
      Math.abs(layer.transform.scale.value[0] - 100) < 0.1 &&
      Math.abs(layer.transform.scale.value[1] - 100) < 0.1 &&
      Math.abs(layer.transform.rotationZ.value % 360) < 0.05 &&
      aov === 'beauty'
    ) {
      return rawBuf;
    }

    const xformed = globalBufferPool.acquire(w * h * 4);
    const worldCenter = transformLayerPixels2D3D(rawBuf, xformed, w, h, layer, comp, activeCamera, sampleTime, scaleFactor, project);
    if (releaseRaw) globalBufferPool.release(rawBuf);

    if (layer.threeD) {
      const [lr, lg, lb] = compute3DLightingFactor(layer, comp, worldCenter, sampleTime, project);
      if (lr !== 1 || lg !== 1 || lb !== 1) {
        for (let i = 0; i < xformed.length; i += 4) {
          if (xformed[i + 3] === 0) continue;
          xformed[i] = clamp(xformed[i] * lr, 0, 255);
          xformed[i + 1] = clamp(xformed[i + 1] * lg, 0, 255);
          xformed[i + 2] = clamp(xformed[i + 2] * lb, 0, 255);
        }
      }
      applyCameraDepthOfField(xformed, w, h, worldCenter[2], activeCamera, comp, sampleTime, project);
    }

    if (aov !== 'beauty') {
      const layerIdx = comp.layers.indexOf(layer) + 1;
      for (let i = 0; i < xformed.length; i += 4) {
        if (xformed[i + 3] === 0) continue;
        if (aov === 'z-depth') {
          const depthByte = clamp(Math.round(180 - worldCenter[2] * 0.12), 0, 255);
          xformed[i] = depthByte; xformed[i + 1] = depthByte; xformed[i + 2] = depthByte;
        } else if (aov === 'normals') {
          xformed[i] = 128; xformed[i + 1] = 128; xformed[i + 2] = 255;
        } else if (aov === 'object-id') {
          xformed[i] = (layerIdx * 67) % 255;
          xformed[i + 1] = (layerIdx * 131) % 255;
          xformed[i + 2] = (layerIdx * 197) % 255;
        } else if (aov === 'motion-vectors') {
          xformed[i] = 128; xformed[i + 1] = 160; xformed[i + 2] = 0;
        }
      }
    }

    return xformed;
  };

  const evaluateSingleLayerBuffer = (layer: Layer, sampleTime: number): Uint8ClampedArray => {
    const rawBuf = evaluatePreTransformLayer(layer, sampleTime);
    return applySpatialTransformAndShading(layer, rawBuf, sampleTime, true);
  };

  // Bottom-to-top compositing loop
  for (let li = comp.layers.length - 1; li >= 0; li--) {
    const layer = comp.layers[li];
    if (layer.type === 'camera' || layer.type === 'light' || layer.type === 'null' || layer.type === 'audio') continue;
    if (options.isFinalRender && layer.type === 'guide') continue;
    if (matteSourceLayerIds.has(layer.id) && !layer.visible) {
      // Invisible matte source is evaluated on demand when referenced
      continue;
    }
    if (!layer.visible) continue;
    if (anySolo && !layer.solo) continue;
    if (time < layer.inPoint || time > layer.outPoint) continue;

    const layerStartMs = performance.now();
    const opEval = evaluateProperty(layer.transform.opacity, time, layer, comp, project);
    if (opEval.error) expressionErrors.push({ layerId: layer.id, layerName: layer.name, message: opEval.error });
    const opacity01 = clamp(opEval.value / 100, 0, 1);
    if (opacity01 <= 0) continue;

    if (layer.type === 'adjustment') {
      // Adjustment Layer applies its effect stack & masks onto a copy of the composite beneath it!
      if (layer.effects.length > 0) {
        const adjSrc = globalBufferPool.acquire(w * h * 4);
        const adjDst = globalBufferPool.acquire(w * h * 4);
        adjSrc.set(out);
        for (const fx of layer.effects) {
          if (!fx.enabled) continue;
          const fxStart = performance.now();
          const evalParams: EvaluatedParams = {};
          for (const [k, prop] of Object.entries(fx.params)) {
            evalParams[k] = evaluateProperty(prop, time, layer, comp, project).value;
          }
          executeEffectBuffer(fx.effectId, adjSrc, adjDst, evalParams, { width: w, height: h, time, fps: comp.fps, frameIndex });
          adjSrc.set(adjDst);
          effectTimings.push({
            effectInstanceId: fx.id,
            effectName: fx.name,
            layerId: layer.id,
            layerName: layer.name,
            durationMs: performance.now() - fxStart,
          });
        }
        if (layer.masks.length > 0) {
          applyLayerMasksToBuffer(adjSrc, w, h, layer.masks, scaleFactor);
        }
        blendLayerBufferOntoComp(out, adjSrc, layer.blendMode, opacity01);
        globalBufferPool.release(adjSrc);
        globalBufferPool.release(adjDst);
      }
      layerTimings.push({ layerId: layer.id, layerName: layer.name, durationMs: performance.now() - layerStartMs });
      continue;
    }

    // Shutter-Angle Multi-Subframe Motion Blur accumulation (rasterizes static pre-transform content once!)
    let layerBuf: Uint8ClampedArray;
    if (comp.motionBlurEnabled && layer.motionBlur && comp.shutterAngle > 0) {
      const subSamples = 3;
      const shutterSec = (comp.shutterAngle / 360) / safeFps;
      const phaseStart = (comp.shutterPhase / 360) / safeFps;
      layerBuf = globalBufferPool.acquire(w * h * 4, false);
      const accum = new Uint16Array(w * h * 4);
      const canReusePreRaster = layer.type !== 'precomp' && !layer.timeRemap?.animated;
      const sharedRaw = canReusePreRaster ? evaluatePreTransformLayer(layer, time) : null;
      for (let s = 0; s < subSamples; s++) {
        const subT = time + phaseStart + (s / (subSamples - 1)) * shutterSec;
        const subBuf = sharedRaw
          ? applySpatialTransformAndShading(layer, sharedRaw, subT, false)
          : evaluateSingleLayerBuffer(layer, subT);
        for (let i = 0; i < accum.length; i++) accum[i] += subBuf[i];
        globalBufferPool.release(subBuf);
      }
      if (sharedRaw) globalBufferPool.release(sharedRaw);
      for (let i = 0; i < layerBuf.length; i++) layerBuf[i] = ((accum[i] * 85 + 128) >> 8); // fast round(x / 3)
    } else {
      layerBuf = evaluateSingleLayerBuffer(layer, time);
    }

    // Track Matte Evaluation (referencing any other layer in the comp; guard self-reference!)
    let matteBuf: Uint8ClampedArray | undefined;
    if (layer.trackMatteMode !== 'none' && layer.trackMatteLayerId && layer.trackMatteLayerId !== layer.id) {
      const matteLayer = comp.layers.find((l) => l.id === layer.trackMatteLayerId);
      if (matteLayer) {
        matteBuf = evaluateSingleLayerBuffer(matteLayer, time);
      }
    }

    blendLayerBufferOntoComp(out, layerBuf, layer.blendMode, opacity01, matteBuf, layer.trackMatteMode, frameIndex + li);
    globalBufferPool.release(layerBuf);
    if (matteBuf) globalBufferPool.release(matteBuf);

    layerTimings.push({
      layerId: layer.id,
      layerName: layer.name,
      durationMs: performance.now() - layerStartMs,
    });
  }

  // Channel Viewer post-filter (Red / Green / Blue / Alpha / Alpha Boundary)
  if (chView !== 'rgb') {
    for (let i = 0; i < out.length; i += 4) {
      if (chView === 'red') { out[i + 1] = out[i]; out[i + 2] = out[i]; out[i + 3] = 255; }
      else if (chView === 'green') { out[i] = out[i + 1]; out[i + 2] = out[i + 1]; out[i + 3] = 255; }
      else if (chView === 'blue') { out[i] = out[i + 2]; out[i + 1] = out[i + 2]; out[i + 3] = 255; }
      else if (chView === 'alpha') { const a = out[i + 3]; out[i] = a; out[i + 1] = a; out[i + 2] = a; out[i + 3] = 255; }
    }
  }

  // Region of Interest (ROI) crop dimming outside ROI
  if (options.roi) {
    const rx0 = Math.round(options.roi.x * scaleFactor);
    const ry0 = Math.round(options.roi.y * scaleFactor);
    const rx1 = Math.round((options.roi.x + options.roi.width) * scaleFactor);
    const ry1 = Math.round((options.roi.y + options.roi.height) * scaleFactor);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (x < rx0 || x > rx1 || y < ry0 || y > ry1) {
          const o = (y * w + x) * 4;
          out[o] = out[o] >> 2; out[o + 1] = out[o + 1] >> 2; out[o + 2] = out[o + 2] >> 2;
        }
      }
    }
  }

  const totalTimeMs = performance.now() - t0;
  if (shouldCache) {
    studioRamCache.set({
      key: cacheKey,
      compId: comp.id,
      frameIndex,
      width: w,
      height: h,
      pixels: out,
      renderTimeMs: totalTimeMs,
    });
  }

  return {
    width: w,
    height: h,
    pixels: out,
    fromCache: false,
    totalTimeMs,
    layerTimings,
    effectTimings,
    expressionErrors,
  };
}
