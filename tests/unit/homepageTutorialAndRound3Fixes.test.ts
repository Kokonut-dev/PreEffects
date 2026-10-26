import { describe, expect, it } from 'vitest';
import { INTERACTIVE_TUTORIAL_STEPS } from '../../src/renderer/data/studioGuideData';
import { DEFAULT_SHORTCUTS, detectShortcutConflicts, matchShortcutEvent } from '../../src/utils/shortcuts';
import { createEffectInstance, executeEffectBuffer } from '../../src/effects/registry';
import { renderPaintStrokesOnBuffer, trackFeaturePatchNcc } from '../../src/engine/trackingAndPaint';
import { applyLayerMasksToBuffer, autoTraceAlphaToMask } from '../../src/engine/masksAndRoto';
import { renderCompositionFrame, renderIsolatedLayerFrame, studioRamCache } from '../../src/engine/compositor';
import { createShowcaseProject } from '../../src/engine/templates';
import { buildDefaultLayerForComp, createId } from '../../src/engine/factory';
import { parseWavPcmBuffer } from '../../src/renderer/state/StudioContext';
import { executeRenderQueueJob } from '../../src/engine/export';
import { buildNodeGraphFromComp } from '../../src/engine/nodeGraph';
import { LruFrameCache } from '../../src/utils/bufferPool';
import { deserializePrexProject, serializeProjectToPrex } from '../../src/engine/serializer';
import { cloneHistoryState, HistoryManager } from '../../src/utils/history';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { App } from '../../src/renderer/App';

describe('Homepage & 10-Module Interactive Tutorial Coverage', () => {
  it('renders the PreEffects Application Homepage & StudioProvider cleanly via SSR smoke check', () => {
    const html = renderToStaticMarkup(React.createElement(App));
    expect(html).toContain('PreEffects');
    expect(html).toContain('v1.0.4');
    expect(html).toContain('data-testid="preeffects-homepage"');
    expect(html).toContain('Interactive Tutorial');
    expect(html).toContain('100% Offline');
  });
  it('defines 10 unique interactive tutorial modules covering every main studio feature', () => {
    expect(INTERACTIVE_TUTORIAL_STEPS).toHaveLength(10);
    const seenIds = new Set<string>();
    const categories = new Set<string>();
    INTERACTIVE_TUTORIAL_STEPS.forEach((mod, idx) => {
      expect(mod.stepIndex).toBe(idx);
      expect(seenIds.has(mod.moduleId)).toBe(false);
      seenIds.add(mod.moduleId);
      categories.add(mod.category);
      expect(mod.handsOnChallenge.length).toBeGreaterThan(15);
      expect(mod.handsOnTip.length).toBeGreaterThan(15);
    });
    expect(categories).toEqual(
      new Set(['Foundations', 'Animation & Rigging', 'VFX & 3D', 'Pipeline & Export']),
    );
  });

  it('registers conflict-free Alt+H (Home Hub) and F2 (Interactive Tutorial) shortcuts', () => {
    expect(detectShortcutConflicts(DEFAULT_SHORTCUTS)).toHaveLength(0);
    const homeHit = matchShortcutEvent(
      { key: 'h', ctrlKey: false, metaKey: false, shiftKey: false, altKey: true },
      DEFAULT_SHORTCUTS,
    );
    expect(homeHit?.id).toBe('goHome');

    const tutHit = matchShortcutEvent(
      { key: 'F2', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false },
      DEFAULT_SHORTCUTS,
    );
    expect(tutHit?.id).toBe('openTutorial');
  });
});

describe('Round-3 P0/P1 Bug Fixes & Engine Optimisations', () => {
  it('BUG-R3-01: resolves prefixed fx-* and aliased effect IDs without throwing', () => {
    const legacyIds = [
      'fx-gaussian-blur',
      'fx-lumetri',
      'fx-glow',
      'fx-keylight',
      'fx-fractal-noise',
      'fx-warp-stabilizer',
    ];
    for (const id of legacyIds) {
      const inst = createEffectInstance(id);
      expect(inst.effectId.startsWith('fx-')).toBe(false);
      const src = new Uint8ClampedArray(16 * 16 * 4).fill(128);
      const dst = new Uint8ClampedArray(16 * 16 * 4);
      executeEffectBuffer(id, src, dst, { radius: 4, amount: 25 }, { width: 16, height: 16, time: 0, fps: 30, frameIndex: 0 });
      expect(dst.length).toBe(src.length);
    }
  });

  it('BUG-R3-02 & OPT-R3-05: renders vivid opaque paint strokes and fast branch-and-bound NCC tracking', () => {
    const w = 64, h = 64;
    const buf = new Uint8ClampedArray(w * h * 4);
    renderPaintStrokesOnBuffer(
      buf,
      w,
      h,
      [
        {
          id: 'stk_test',
          tool: 'brush',
          color: '#FF8800',
          radius: 8,
          hardness: 85,
          opacity: 100,
          startTime: 0,
          durationMode: 'constant',
          duration: 5,
          points: [[32, 32], [40, 32]],
        },
      ],
      0.5,
      30,
      1,
    );
    const centerIdx = (32 * w + 32) * 4;
    expect(buf[centerIdx]).toBeGreaterThan(240);
    expect(buf[centerIdx + 3]).toBeGreaterThan(240);

    // Branch-and-bound NCC feature tracking check
    const ref = new Uint8ClampedArray(w * h * 4);
    const tgt = new Uint8ClampedArray(w * h * 4);
    const stampFeature = (arr: Uint8ClampedArray, fx: number, fy: number) => {
      for (let dy = -3; dy <= 3; dy++) {
        for (let dx = -3; dx <= 3; dx++) {
          const i = ((fy + dy) * w + (fx + dx)) * 4;
          arr[i] = 240 - Math.abs(dx) * 30;
          arr[i + 1] = 80 + dy * 20;
          arr[i + 2] = 200;
          arr[i + 3] = 255;
        }
      }
    };
    stampFeature(ref, 24, 24);
    stampFeature(tgt, 29, 21);
    const solved = trackFeaturePatchNcc(ref, tgt, w, h, 24, 24, 4, 10);
    expect(solved.x).toBe(29);
    expect(solved.y).toBe(21);
    expect(solved.confidence).toBeGreaterThan(0.95);
  });

  it('BUG-R3-05: traces isolated layer alpha in exact composition coordinates rather than opaque background', () => {
    const proj = createShowcaseProject('blank');
    const comp = proj.compositions[0];
    comp.width = 400;
    comp.height = 300;
    const shape = buildDefaultLayerForComp('shape', comp, 'lyr_shape_trace');
    shape.shapeContent!.width = 100;
    shape.shapeContent!.height = 80;
    comp.layers.push(shape);

    const isolated = renderIsolatedLayerFrame(comp, shape.id, 0, proj, 2);
    // Corner pixel of isolated render must be transparent (0), NOT comp background 255!
    expect(isolated.pixels[3]).toBe(0);
    const mask = autoTraceAlphaToMask(isolated.pixels, isolated.width, isolated.height, 32, 2);
    const xs = mask.vertices.map((v) => v.x);
    const ys = mask.vertices.map((v) => v.y);
    // Shape is centered around (200, 150) with size ~100x80 — NOT (0..400, 0..300)
    expect(Math.min(...xs)).toBeGreaterThan(120);
    expect(Math.max(...xs)).toBeLessThan(280);
    expect(Math.min(...ys)).toBeGreaterThan(80);
    expect(Math.max(...ys)).toBeLessThan(220);
  });

  it('BUG-R3-06 & BUG-R3-13: renders true transparency in Alpha & Alpha-Boundary channel views', () => {
    const proj = createShowcaseProject('blank');
    const comp = proj.compositions[0];
    comp.width = 120;
    comp.height = 90;
    const shape = buildDefaultLayerForComp('shape', comp, 'lyr_alpha_test');
    shape.shapeContent!.width = 40;
    shape.shapeContent!.height = 40;
    comp.layers.push(shape);

    const alphaView = renderCompositionFrame(comp, 0, proj, {
      resolutionDivisor: 1,
      channelView: 'alpha',
      useCache: false,
    });
    // Top-left corner (0,0) has no layer -> alpha channel visualization must be black (0), not 255!
    expect(alphaView.pixels[0]).toBe(0);
    // Center (60,45) has opaque shape -> alpha channel visualization must be > 200
    const center = (45 * 120 + 60) * 4;
    expect(alphaView.pixels[center]).toBeGreaterThan(200);

    const boundaryView = renderCompositionFrame(comp, 0, proj, {
      resolutionDivisor: 1,
      channelView: 'alpha-boundary',
      useCache: false,
    });
    expect(boundaryView.pixels[3]).toBe(255);
  });

  it('BUG-R3-07: invalidates studioRamCache when scale/rotation keyframes or mask vertices change', () => {
    studioRamCache.purgeAll();
    const proj = createShowcaseProject('blank');
    const comp = proj.compositions[0];
    comp.width = 120;
    comp.height = 90;
    const shape = buildDefaultLayerForComp('shape', comp, 'lyr_kf_cache');
    shape.transform.scale.animated = true;
    shape.transform.scale.keyframes = [
      { id: 'k1', time: 0, value: [100, 100, 100], interpolation: 'linear', inInfluence: 0.33, outInfluence: 0.33 },
    ];
    comp.layers.push(shape);

    const r1 = renderCompositionFrame(comp, 0, proj, { resolutionDivisor: 1, useCache: true });
    expect(r1.fromCache).toBe(false);
    const r2 = renderCompositionFrame(comp, 0, proj, { resolutionDivisor: 1, useCache: true });
    expect(r2.fromCache).toBe(true);

    // Mutate only keyframe value (keeping keyframes.length === 1)
    shape.transform.scale.keyframes[0].value = [25, 25, 100];
    const r3 = renderCompositionFrame(comp, 0, proj, { resolutionDivisor: 1, useCache: true });
    expect(r3.fromCache).toBe(false);
  });

  it('BUG-R3-08: parses RIFF WAV files with JUNK chunks, custom sample rates, and stereo PCM', () => {
    // Construct a 48kHz stereo 16-bit WAV with an 8-byte JUNK chunk before fmt & data
    const frames = 64;
    const dataBytes = frames * 2 * 2; // 64 stereo 16-bit frames
    const totalLen = 12 + (8 + 8) + (8 + 16) + (8 + dataBytes);
    const ab = new ArrayBuffer(totalLen);
    const dv = new DataView(ab);
    const writeStr = (off: number, s: string) => {
      for (let i = 0; i < s.length; i++) dv.setUint8(off + i, s.charCodeAt(i));
    };
    writeStr(0, 'RIFF');
    dv.setUint32(4, totalLen - 8, true);
    writeStr(8, 'WAVE');
    // JUNK chunk (offset 12..28)
    writeStr(12, 'JUNK');
    dv.setUint32(16, 8, true);
    // fmt chunk (offset 28..52)
    writeStr(28, 'fmt ');
    dv.setUint32(32, 16, true);
    dv.setUint16(36, 1, true); // PCM
    dv.setUint16(38, 2, true); // Stereo
    dv.setUint32(40, 48000, true); // 48kHz
    dv.setUint32(44, 48000 * 4, true);
    dv.setUint16(48, 4, true);
    dv.setUint16(50, 16, true); // 16-bit
    // data chunk (offset 52..)
    writeStr(52, 'data');
    dv.setUint32(56, dataBytes, true);
    for (let f = 0; f < frames; f++) {
      dv.setInt16(60 + f * 4, 16384, true); // +0.5 L
      dv.setInt16(60 + f * 4 + 2, 16384, true); // +0.5 R
    }

    const res = parseWavPcmBuffer(ab);
    expect(res.sampleRate).toBe(48000);
    expect(res.samples.length).toBe(frames);
    expect(res.samples[0]).toBeCloseTo(0.5, 2);
  });

  it('BUG-R3-10 & BUG-R3-11: avoids overlapping Node DAG columns for >=4 effects and avoids wasted single-frame renders', () => {
    const proj = createShowcaseProject('blank');
    const comp = proj.compositions[0];
    const lyr = buildDefaultLayerForComp('solid', comp, 'lyr_many_fx');
    lyr.effects = [
      createEffectInstance('gaussian-blur'),
      createEffectInstance('glow'),
      createEffectInstance('lumetri-wheels'),
      createEffectInstance('curves'),
    ];
    comp.layers.push(lyr);
    const dag = buildNodeGraphFromComp(comp);
    const fxNodes = dag.nodes.filter((n) => n.kind === 'effect');
    const mergeNode = dag.nodes.find((n) => n.kind === 'merge')!;
    const outNode = dag.nodes.find((n) => n.kind === 'output')!;
    const maxFxX = Math.max(...fxNodes.map((n) => n.x));
    expect(mergeNode.x).toBeGreaterThan(maxFxX + 180);
    expect(outNode.x).toBeGreaterThan(mergeNode.x + 180);

    // Single-frame TGA module renders rapidly without wasting 20 unused frames
    const progressFrames: number[] = [];
    const job = executeRenderQueueJob(
      {
        id: createId('rq'),
        compId: comp.id,
        status: 'queued',
        quality: 'draft',
        resolutionDivisor: 4,
        useProxies: false,
        startFrame: 0,
        endFrame: 20,
        progressPct: 0,
        elapsedMs: 0,
        outputModules: [
          {
            id: createId('om'),
            format: 'tga-seq',
            channels: 'rgba',
            includeAudio: false,
            aovPasses: ['beauty'],
            outputName: 'still_test',
          },
        ],
      },
      proj,
      (_pct, f) => progressFrames.push(f),
    );
    expect(job.status).toBe('completed');
    expect(progressFrames).toHaveLength(1);
  });

  it('BUG-R3-12, BUG-R3-14 & OPT-R3-04: clears evicted MRU cache key, persists HD RGBA in .prex, and shares binary buffers across Undo', () => {
    // BUG-R3-12: LruFrameCache clears lastMruKey on eviction
    const cache = new LruFrameCache(0.001); // ~1 KB budget
    cache.set({
      key: 'big_frame',
      compId: 'c1',
      frameIndex: 0,
      width: 32,
      height: 32,
      pixels: new Uint8ClampedArray(32 * 32 * 4), // 4 KB > 1 KB -> evicted immediately
      renderTimeMs: 1,
    });
    expect(cache.get('big_frame')).toBeUndefined();

    // BUG-R3-14: Full >256KB RGBA buffer round-trips cleanly via compact Base64 in .prex
    const proj = createShowcaseProject('blank');
    const bigRgba = new Uint8ClampedArray(320 * 240 * 4); // 307,200 bytes (> 262,144!)
    bigRgba[0] = 42;
    bigRgba[1] = 199;
    bigRgba[3] = 255;
    const audio = new Float32Array([0.25, -0.5, 0.75, -0.25]);
    proj.assets.push({
      id: 'ast_hd_img',
      name: 'plate.png',
      folder: '01_Footage',
      kind: 'image',
      path: 'plate.png',
      width: 320,
      height: 240,
      rgbaBuffer: bigRgba,
      audioSamples: audio,
    });
    const prexJson = serializeProjectToPrex(proj);
    const restored = deserializePrexProject(prexJson);
    const restoredAsset = restored.assets.find((a) => a.id === 'ast_hd_img')!;
    expect(restoredAsset.rgbaBuffer?.length).toBe(320 * 240 * 4);
    expect(restoredAsset.rgbaBuffer?.[0]).toBe(42);
    expect(restoredAsset.rgbaBuffer?.[1]).toBe(199);
    expect(restoredAsset.audioSamples?.[2]).toBeCloseTo(0.75, 4);

    // OPT-R3-04: Structural binary sharing in HistoryManager
    const cloned = cloneHistoryState(proj);
    expect(cloned.assets[0].rgbaBuffer).toBe(bigRgba);
    const hist = new HistoryManager(proj, 60);
    const t0 = performance.now();
    for (let i = 0; i < 40; i++) {
      hist.push({ ...proj, name: `Edit_${i}` }, `Edit ${i}`);
    }
    const elapsed = performance.now() - t0;
    expect(elapsed).toBeLessThan(150);
    const undone = hist.undo()!;
    expect(undone.assets[0].rgbaBuffer).toBe(bigRgba);

    // OPT-R3-01: Scanline active-edge polygon rasterizer test
    const maskBuf = new Uint8ClampedArray(100 * 100 * 4).fill(255);
    applyLayerMasksToBuffer(maskBuf, 100, 100, [
      {
        id: 'm1',
        name: 'Box',
        mode: 'add',
        inverted: false,
        locked: false,
        rotoBezier: false,
        closed: true,
        feather: 0,
        opacity: 100,
        expansion: 0,
        vertices: [
          { x: 25, y: 25, inX: 0, inY: 0, outX: 0, outY: 0 },
          { x: 75, y: 25, inX: 0, inY: 0, outX: 0, outY: 0 },
          { x: 75, y: 75, inX: 0, inY: 0, outX: 0, outY: 0 },
          { x: 25, y: 75, inX: 0, inY: 0, outX: 0, outY: 0 },
        ],
      },
    ]);
    expect(maskBuf[(10 * 100 + 10) * 4 + 3]).toBe(0);
    expect(maskBuf[(50 * 100 + 50) * 4 + 3]).toBe(255);
  });
});
