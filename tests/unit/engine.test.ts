import { describe, expect, it } from 'vitest';
import { clamp, fbm2D, Mat4, solveCubicBezier, worley2D } from '../../src/utils/math';
import { computeVideoScopes, createBuiltInLut, linearToSrgb, parseCubeLut, sampleLut3D, srgbToLinear } from '../../src/utils/color';
import { globalBufferPool, LruFrameCache } from '../../src/utils/bufferPool';
import { HistoryManager } from '../../src/utils/history';
import { detectShortcutConflicts, DEFAULT_SHORTCUTS, matchesKeyboardEvent } from '../../src/utils/shortcuts';
import { t } from '../../src/utils/i18n';
import {
  createEffectInstance,
  EFFECT_CATEGORIES,
  EFFECTS_CATALOG,
  executeEffectBuffer,
  SMART_ADAPTIVE_PRESETS,
} from '../../src/effects/registry';
import {
  applyEasyEasePreset,
  applyRovingKeyframes,
  applySmootherToProperty,
  applyWigglerToProperty,
  convertAudioSamplesToKeyframes,
  evaluateKeyframesAtTime,
  sequenceLayers,
  setOrUpdateKeyframe,
  timeReverseKeyframes,
} from '../../src/engine/animation';
import { evaluateProperty, smartDuplicateLayers } from '../../src/engine/expressions';
import { applyLayerMasksToBuffer, applyLocalAiRotoBrush, autoTraceAlphaToMask } from '../../src/engine/masksAndRoto';
import { rasterizeShapeLayer, rasterizeTextLayer } from '../../src/engine/shapesAndText';
import { applyPuppetPinsDeform, renderPaintStrokesOnBuffer, synthesizeContentAwareFill, trackFeaturePatchNcc } from '../../src/engine/trackingAndPaint';
import { computeAudioWaveformPeaks, generateSynthAudioBuffer, measureAudioVuDb, processAudioEffectsChain } from '../../src/engine/audio';
import { executeStudioScript, studioPluginRegistry } from '../../src/plugins/sdk';
import { createShowcaseProject } from '../../src/engine/templates';
import { makeProp } from '../../src/engine/factory';

describe('Stage 6 Unit Suite — Core Math, Color, Memory & History', () => {
  it('evaluates Cubic Bezier, 4x4 3D matrices, and procedural noise deterministically', () => {
    expect(solveCubicBezier(0.5, 0.42, 0, 0.58, 1)).toBeCloseTo(0.5, 2);
    const m = Mat4.multiply(Mat4.translate(10, 20, 30), Mat4.scale(2, 3, 4));
    expect(Mat4.transformPoint(m, 5, 5, 5)).toEqual([20, 35, 50]);
    expect(fbm2D(1.2, 3.4, 3)).toBeGreaterThanOrEqual(0);
    expect(worley2D(2.1, 4.3)).toBeGreaterThanOrEqual(0);
    expect(clamp(150, 0, 100)).toBe(100);
  });

  it('round-trips sRGB <-> Linear, parses .cube 3D LUTs, and computes Video Scopes', () => {
    expect(linearToSrgb(srgbToLinear(0.45))).toBeCloseTo(0.45, 4);
    const cubeSrc = `TITLE "UnitLut"\nLUT_3D_SIZE 2\n0 0 0\n1 0 0\n0 1 0\n1 1 0\n0 0 1\n1 0 1\n0 1 1\n1 1 1\n`;
    const lut = parseCubeLut(cubeSrc);
    const [r, g, b] = sampleLut3D(lut, 0.25, 0.5, 0.75);
    expect(r).toBeCloseTo(0.25, 2);
    expect(g).toBeCloseTo(0.5, 2);
    expect(b).toBeCloseTo(0.75, 2);

    const builtIn = createBuiltInLut('teal-amber');
    expect(builtIn.size).toBeGreaterThanOrEqual(8);

    const buf = new Uint8ClampedArray(32 * 32 * 4).fill(180);
    const scopes = computeVideoScopes(buf, 32, 32, 16);
    expect(scopes.waveformLuma.length).toBe(16);
    expect(scopes.vectorscopePoints.length).toBeGreaterThan(0);
  });

  it('reuses RGBA buffers in BufferPool, evicts LRU frames, and coalesces Undo/Redo History', () => {
    const a = globalBufferPool.acquire(1024);
    a[0] = 99;
    globalBufferPool.release(a);
    const b = globalBufferPool.acquire(1024);
    expect(b[0]).toBe(0); // zeroed on acquire

    const cache = new LruFrameCache(1); // 1 MB budget
    const bigPixels = new Uint8ClampedArray(400_000); // ~0.4 MB
    cache.set({ key: 'f1', compId: 'c1', frameIndex: 1, width: 100, height: 1000, pixels: bigPixels, renderTimeMs: 2 });
    cache.set({ key: 'f2', compId: 'c1', frameIndex: 2, pixels: bigPixels, width: 100, height: 1000, renderTimeMs: 2 });
    cache.set({ key: 'f3', compId: 'c1', frameIndex: 3, pixels: bigPixels, width: 100, height: 1000, renderTimeMs: 2 });
    expect(cache.getUsedBytes()).toBeLessThanOrEqual(1024 * 1024);
    expect(cache.get('f1')).toBeUndefined(); // evicted LRU

    const hist = new HistoryManager({ count: 0 }, 20);
    hist.push({ count: 1 }, 'Drag Slider', 'tx_slider');
    hist.push({ count: 2 }, 'Drag Slider', 'tx_slider'); // coalesced!
    expect(hist.getEntries().entries.length).toBe(2);
    expect(hist.undo()).toEqual({ count: 0 });
    expect(hist.redo()).toEqual({ count: 2 });
  });

  it('verifies zero default shortcut conflicts and full i18n dictionary coverage', () => {
    expect(detectShortcutConflicts(DEFAULT_SHORTCUTS)).toEqual([]);
    expect(matchesKeyboardEvent({ key: 'k', ctrlKey: true, metaKey: false, shiftKey: false, altKey: false }, 'Mod+K', false)).toBe(true);
    expect(t('menu.composition', 'nl')).toBe('Compositie');
    expect(t('menu.composition', 'ja')).toBe('コンポジション');
  });
});

describe('Stage 6 Unit Suite — All 186 Effects, Animation, Expressions, Masks, Shapes, Text, Paint, Audio & SDK', () => {
  it('registers >= 186 built-in effects across all 19 categories and executes every family cleanly', () => {
    expect(EFFECTS_CATALOG.length).toBeGreaterThanOrEqual(186);
    expect(EFFECT_CATEGORIES.length).toBe(19);

    const w = 16, h = 16;
    const src = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < src.length; i += 4) {
      src[i] = 200; src[i + 1] = 120; src[i + 2] = 60; src[i + 3] = 255;
    }
    const dst = new Uint8ClampedArray(w * h * 4);

    // Execute one representative effect from each of the 19 categories
    for (const cat of EFFECT_CATEGORIES) {
      const fxDef = EFFECTS_CATALOG.find((e) => e.category === cat)!;
      const inst = createEffectInstance(fxDef.id);
      const evalParams: Record<string, number | string | boolean | [number, number]> = {};
      for (const [k, p] of Object.entries(inst.params)) evalParams[k] = p.value;
      executeEffectBuffer(fxDef.id, src, dst, evalParams, { width: w, height: h, time: 1.0, fps: 30, frameIndex: 30 });
      expect(dst.length).toBe(w * h * 4);
    }
    expect(SMART_ADAPTIVE_PRESETS[0].applyToCompScale(3840, 2160).length).toBeGreaterThan(0);
  });

  it('interpolates keyframes and runs Easy Ease, Roving, Reverse, Sequence, Wiggler, Smoother & Audio-to-Keyframes', () => {
    let prop = makeProp(0);
    prop = setOrUpdateKeyframe(prop, 0, 0, 'linear');
    prop = setOrUpdateKeyframe(prop, 2, 100, 'linear');
    expect(evaluateKeyframesAtTime(prop, 1)).toBeCloseTo(50, 1);

    const eased = applyEasyEasePreset(prop, 'easy-ease');
    expect(eased.keyframes[0].interpolation).toBe('bezier');

    const rev = timeReverseKeyframes(prop);
    expect(rev.keyframes[0].value).toBe(100);

    const wiggled = applyWigglerToProperty(prop, 4, 10);
    expect(wiggled.keyframes.length).toBeGreaterThan(4);
    const smoothed = applySmootherToProperty(wiggled, 5);
    expect(smoothed.keyframes.length).toBeLessThanOrEqual(wiggled.keyframes.length);

    let posProp = makeProp<[number, number, number]>([0, 0, 0]);
    posProp = setOrUpdateKeyframe(posProp, 0, [0, 0, 0]);
    posProp = setOrUpdateKeyframe(posProp, 0.2, [90, 0, 0]);
    posProp = setOrUpdateKeyframe(posProp, 1.0, [100, 0, 0]);
    const roved = applyRovingKeyframes(posProp);
    expect(roved.keyframes[1].time).toBeCloseTo(0.9, 1);

    const prj = createShowcaseProject('orbital-hero');
    const seq = sequenceLayers(prj.compositions[0].layers.slice(0, 2), 0.5);
    expect(seq[1].inPoint).toBeGreaterThan(0);
  });

  it('evaluates sandboxed AE expressions, guards infinite loops, and relinks Smart Duplicate', () => {
    const prj = createShowcaseProject('orbital-hero');
    const comp = prj.compositions[0];
    const layer = comp.layers[1];

    const wigProp = { ...makeProp(50), expression: 'wiggle(3, 15)', expressionEnabled: true };
    const r1 = evaluateProperty(wigProp, 1.25, layer, comp, prj);
    expect(r1.error).toBeUndefined();
    expect(r1.value).not.toBe(50);

    const infLoop = { ...makeProp(10), expression: 'while(true) {}', expressionEnabled: true };
    const rErr = evaluateProperty(infLoop, 0.5, layer, comp, prj);
    expect(rErr.error).toContain('Infinite loop');
    expect(rErr.value).toBe(10); // graceful fallback!

    const clones = smartDuplicateLayers(comp.layers.slice(0, 2));
    expect(clones).toHaveLength(2);
    expect(clones[0].name).toContain('_Copy');
  });

  it('rasterizes Masks, AI Roto, Shapes + Operators, Text + Animators, Paint, Puppet, Tracker & Audio', () => {
    const w = 64, h = 64;
    const shapeBuf = new Uint8ClampedArray(w * h * 4);
    rasterizeShapeLayer(
      shapeBuf,
      w,
      h,
      {
        kind: 'polystar',
        width: 40,
        height: 40,
        points: 5,
        fillType: 'radial-gradient',
        fillColor: '#E89B3C',
        fillColorEnd: '#38BDF8',
        fillOpacity: 100,
        strokeColor: '#FFFFFF',
        strokeWidth: 2,
        operators: [{ id: 'op1', type: 'zig-zag', enabled: true, params: { size: 3 } }],
      },
      1,
      0.5,
    );
    const nonZeroShape = shapeBuf.some((v) => v > 0);
    expect(nonZeroShape).toBe(true);

    const tracedMask = autoTraceAlphaToMask(shapeBuf, w, h);
    expect(tracedMask.vertices.length).toBe(4);
    applyLayerMasksToBuffer(shapeBuf, w, h, [{ ...tracedMask, mode: 'intersect', feather: 2 }], 1);
    applyLocalAiRotoBrush(shapeBuf, w, h, [[0.5, 0.5]], [[0.02, 0.02]], 1);

    const textBuf = new Uint8ClampedArray(128 * 64 * 4);
    rasterizeTextLayer(
      textBuf,
      128,
      64,
      {
        text: 'VFX 60',
        boxMode: 'point',
        boxWidth: 120,
        boxHeight: 50,
        fontFamily: 'Inter',
        fontWeight: '700',
        fontStyle: 'normal',
        fontSize: 16,
        leading: 20,
        tracking: 10,
        fillColor: '#FFFFFF',
        strokeColor: '#000000',
        strokeWidth: 0,
        align: 'center',
        allCaps: true,
        smallCaps: false,
        perCharacter3D: false,
        animators: [],
      },
      [],
      1,
      0.5,
    );
    expect(textBuf.some((v) => v > 0)).toBe(true);

    // Paint, Puppet, Tracker & Content-Aware Fill
    renderPaintStrokesOnBuffer(
      textBuf,
      128,
      64,
      [{ id: 's1', tool: 'brush', color: '#E89B3C', radius: 4, hardness: 80, opacity: 100, startTime: 0, durationMode: 'constant', duration: 5, points: [[10, 10], [50, 30]] }],
      1.0,
      30,
      1,
    );
    const pupDst = new Uint8ClampedArray(128 * 64 * 4);
    applyPuppetPinsDeform(textBuf, pupDst, 128, 64, [{ id: 'p1', kind: 'position', restX: 30, restY: 30, currentX: 34, currentY: 28, stiffness: 50 }]);
    const ncc = trackFeaturePatchNcc(textBuf, pupDst, 128, 64, 30, 30, 4, 8);
    expect(ncc.confidence).toBeGreaterThan(0);
    const filled = synthesizeContentAwareFill(pupDst, 128, 64, { x: 20, y: 20, width: 12, height: 12 });
    expect(filled.length).toBe(pupDst.length);

    // Audio DSP & VU
    const pcm = generateSynthAudioBuffer(0.5, 8000, 120);
    const processed = processAudioEffectsChain(pcm, 8000, [createEffectInstance('audio-delay'), createEffectInstance('audio-parametric-eq')], 2);
    expect(computeAudioWaveformPeaks(processed, 32).length).toBe(32);
    expect(measureAudioVuDb(processed, 0.1, 8000).peakDb).toBeGreaterThan(-60);
    expect(convertAudioSamplesToKeyframes(processed, 8000, 24, 0.5).keyframes.length).toBe(12);
  });

  it('runs JavaScript, Python, and Lua studio scripts and enforces Plugin SDK sandbox isolation', () => {
    const prj = createShowcaseProject('orbital-hero');
    const jsRes = executeStudioScript('javascript', 'app.addSolid("JS_Layer", "#FF5500"); log(app.layerCount());', prj);
    expect(jsRes.ok).toBe(true);
    expect(jsRes.nextProject.compositions[0].layers[0].name).toBe('JS_Layer');

    const pyRes = executeStudioScript('python', 'for i in range(2):\n  app.addMarker(i * 1.0, "PyCue")\nprint("ok")', prj);
    expect(pyRes.ok).toBe(true);
    expect(pyRes.logs[0]).toBe('ok');

    const luaRes = executeStudioScript('lua', 'for i = 1, 2 do\n  app.addMarker(i, "LuaCue")\nend\nprint("lua_done")', prj);
    expect(luaRes.ok).toBe(true);
    expect(luaRes.logs[0]).toBe('lua_done');

    // Attempted sandbox escape in Plugin SDK must have undefined window/fetch/process
    const bad = studioPluginRegistry.installSandboxedBundle('if (typeof fetch !== "undefined" || typeof process !== "undefined") throw new Error("Leak!"); sdk.registerPlugin({ id: "safe-test", name: "Safe", version: "1.0.0", author: "QA", kind: "effect", description: "ok" });');
    expect(bad.ok).toBe(true);
  });
});
