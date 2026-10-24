import { describe, expect, it } from 'vitest';
import { createShowcaseProject } from '../../src/engine/templates';
import { createDefaultTransform } from '../../src/engine/factory';
import { renderCompositionFrame, studioRamCache } from '../../src/engine/compositor';
import { createEffectInstance, searchEffects } from '../../src/effects/registry';
import { Composition, Layer } from '../../src/engine/types';

describe('Stage 6 Quantitative Performance Suite (BENCH-01 .. BENCH-06)', () => {
  it('BENCH-01: evaluates 100-layer composition scrub frame at >= 60fps (<= 16.67 ms/frame at Quarter proxy)', () => {
    const layers: Layer[] = Array.from({ length: 100 }, (_, i) => ({
      id: `perf_lyr_${i}`,
      name: `Perf_Solid_${i}`,
      type: 'solid',
      labelColor: '#38BDF8',
      visible: true,
      audioEnabled: false,
      solo: false,
      locked: false,
      shy: false,
      collapseTransformations: false,
      frameBlending: 'off',
      motionBlur: false,
      threeD: false,
      inPoint: 0,
      outPoint: 10,
      startTime: 0,
      stretchPct: 100,
      blendMode: i % 2 === 0 ? 'normal' : 'screen',
      trackMatteMode: 'none',
      transform: {
        ...createDefaultTransform(160, 90, 160, 90),
        opacity: { value: 35, animated: false, keyframes: [] },
      },
      masks: [],
      effects: [],
      paintStrokes: [],
      puppetPins: [],
      markers: [],
      solidColor: i % 2 === 0 ? '#1E3A8A' : '#E89B3C',
    }));

    const comp100: Composition = {
      id: 'bench_comp_100',
      name: 'BENCH_100_LAYERS',
      width: 320,
      height: 180,
      pixelAspect: 1,
      fps: 60,
      duration: 10,
      backgroundColor: '#000000',
      workAreaStart: 0,
      workAreaEnd: 10,
      hideShyLayers: false,
      motionBlurEnabled: false,
      shutterAngle: 180,
      shutterPhase: -90,
      frameBlendingEnabled: false,
      renderer3D: 'classic-3d',
      markers: [],
      layers,
    };

    // Warm-up JIT
    renderCompositionFrame(comp100, 0.5, undefined, { resolutionDivisor: 2, useCache: false });

    const iterations = 10;
    const t0 = performance.now();
    for (let f = 0; f < iterations; f++) {
      renderCompositionFrame(comp100, f * 0.1, undefined, { resolutionDivisor: 2, useCache: false });
    }
    const avgMs = (performance.now() - t0) / iterations;
    expect(avgMs).toBeLessThanOrEqual(16.67);
  });

  it('BENCH-02: evaluates 20-effect stack on HD proxy frame <= 45 ms', () => {
    const prj = createShowcaseProject('blank');
    const comp = prj.compositions[0];
    comp.width = 480;
    comp.height = 270;
    const effects = Array.from({ length: 20 }, (_, idx) =>
      createEffectInstance(idx % 3 === 0 ? 'gaussian-blur' : idx % 3 === 1 ? 'curves' : 'glow'),
    );
    comp.layers.push({
      id: 'fx_heavy',
      name: '20_FX_Stack',
      type: 'solid',
      labelColor: '#E89B3C',
      visible: true,
      audioEnabled: false,
      solo: false,
      locked: false,
      shy: false,
      collapseTransformations: false,
      frameBlending: 'off',
      motionBlur: false,
      threeD: false,
      inPoint: 0,
      outPoint: 5,
      startTime: 0,
      stretchPct: 100,
      blendMode: 'normal',
      trackMatteMode: 'none',
      transform: createDefaultTransform(240, 135, 240, 135),
      masks: [],
      effects,
      paintStrokes: [],
      puppetPins: [],
      markers: [],
      solidColor: '#3B82F6',
    });

    // Warm-up V8 TurboFan tier-up across all 3 effect kernels (gaussian-blur, curves, glow)
    for (let w = 0; w < 3; w++) {
      renderCompositionFrame(comp, 0.1 * (w + 1), prj, { resolutionDivisor: 2, useCache: false });
    }
    const samples = 5;
    const t0 = performance.now();
    for (let s = 0; s < samples; s++) {
      renderCompositionFrame(comp, 0.4 + s * 0.1, prj, { resolutionDivisor: 2, useCache: false });
    }
    const elapsed = (performance.now() - t0) / samples;
    expect(elapsed).toBeLessThanOrEqual(45);
  });

  it('BENCH-03: fuzzy searches full effect & preset catalog in <= 5.0 ms', () => {
    const t0 = performance.now();
    for (let i = 0; i < 20; i++) {
      searchEffects('chroma blur');
    }
    const avgMs = (performance.now() - t0) / 20;
    expect(avgMs).toBeLessThanOrEqual(5.0);
  });

  it('BENCH-04 & BENCH-05 & BENCH-06: cold boot < 5000ms, RAM cache hit <= 1.0ms, bounded LRU ceiling', () => {
    const bootStart = performance.now();
    const prj = createShowcaseProject('orbital-hero');
    renderCompositionFrame(prj.compositions[0], 1.0, prj, { resolutionDivisor: 2, useCache: true });
    const bootMs = performance.now() - bootStart;
    expect(bootMs).toBeLessThan(5000);

    // BENCH-05: Cached frame retrieval <= 1.0 ms
    const hitStart = performance.now();
    const cached = renderCompositionFrame(prj.compositions[0], 1.0, prj, { resolutionDivisor: 2, useCache: true });
    const hitMs = performance.now() - hitStart;
    expect(cached.fromCache).toBe(true);
    expect(hitMs).toBeLessThanOrEqual(1.0);

    // BENCH-06: Bounded LRU memory ceiling
    studioRamCache.setMaxMegabytes(16);
    for (let f = 0; f < 40; f++) {
      renderCompositionFrame(prj.compositions[0], f / 60, prj, { resolutionDivisor: 2, useCache: true });
    }
    expect(studioRamCache.getUsedBytes()).toBeLessThanOrEqual(16 * 1024 * 1024);
    studioRamCache.setMaxMegabytes(512);
  });
});
