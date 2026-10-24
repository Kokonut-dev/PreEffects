import { createShowcaseProject } from '../src/engine/templates';
import { createDefaultTransform } from '../src/engine/factory';
import { renderCompositionFrame, studioRamCache } from '../src/engine/compositor';
import { createEffectInstance, searchEffects } from '../src/effects/registry';
import { encodeAnimatedGif, encodeUncompressedAvi } from '../src/engine/export';
import { Composition, Layer } from '../src/engine/types';

export interface BenchmarkMetrics {
  showcaseRenderMs: number;
  hundredLayersMs: number;
  twentyEffectsMs: number;
  lutGradeMs: number;
  gifEncodeMs: number;
  effectSearchUs: number;
}

export function runQuantitativeBenchmarks(): BenchmarkMetrics {
  studioRamCache.purgeAll();

  // 1. Showcase Full Pipeline Render (Nested Precomp + Text + Shape + 3D + ACES LUT Adj) @ 480x270
  const showcase = createShowcaseProject('orbital-hero');
  renderCompositionFrame(showcase.compositions[0], 1.2, showcase, { resolutionDivisor: 4, useCache: false });
  const nShowcase = 8;
  const tShow0 = performance.now();
  for (let i = 0; i < nShowcase; i++) {
    renderCompositionFrame(showcase.compositions[0], 0.5 + i * 0.2, showcase, { resolutionDivisor: 4, useCache: false });
  }
  const showcaseRenderMs = (performance.now() - tShow0) / nShowcase;

  // 2. 100-Layer Composition Scrubbing (Half-res 320x180 -> 160x90)
  const layers100: Layer[] = Array.from({ length: 100 }, (_, i) => ({
    id: `b_lyr_${i}`,
    name: `Layer_${i}`,
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
      ...createDefaultTransform(160 + (i % 3) * 4, 90, 160, 90), // includes non-identity transforms!
      opacity: { value: 40, animated: false, keyframes: [] },
    },
    masks: [],
    effects: [],
    paintStrokes: [],
    puppetPins: [],
    markers: [],
    solidColor: i % 2 === 0 ? '#1E3A8A' : '#E89B3C',
  }));
  const comp100: Composition = {
    id: 'c100',
    name: 'Comp100',
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
    layers: layers100,
  };
  renderCompositionFrame(comp100, 0.5, undefined, { resolutionDivisor: 2, useCache: false });
  const n100 = 12;
  const t100 = performance.now();
  for (let i = 0; i < n100; i++) {
    renderCompositionFrame(comp100, i * 0.1, undefined, { resolutionDivisor: 2, useCache: false });
  }
  const hundredLayersMs = (performance.now() - t100) / n100;

  // 3. 20-Effect Stack Evaluation
  const blank = createShowcaseProject('blank');
  const fxComp = blank.compositions[0];
  fxComp.width = 480;
  fxComp.height = 270;
  fxComp.layers.push({
    id: 'fx20',
    name: 'FX20',
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
    effects: Array.from({ length: 20 }, (_, k) =>
      createEffectInstance(k % 4 === 0 ? 'gaussian-blur' : k % 4 === 1 ? 'curves' : k % 4 === 2 ? 'glow' : 'apply-colour-lut'),
    ),
    paintStrokes: [],
    puppetPins: [],
    markers: [],
    solidColor: '#3B82F6',
  });
  renderCompositionFrame(fxComp, 0.2, blank, { resolutionDivisor: 2, useCache: false });
  const nFx = 8;
  const tFx = performance.now();
  for (let i = 0; i < nFx; i++) {
    renderCompositionFrame(fxComp, 0.3 + i * 0.1, blank, { resolutionDivisor: 2, useCache: false });
  }
  const twentyEffectsMs = (performance.now() - tFx) / nFx;

  // 4. Dedicated 3D LUT Color Grade Pass (480x270)
  const lutComp = createShowcaseProject('blank').compositions[0];
  lutComp.width = 480;
  lutComp.height = 270;
  lutComp.layers.push({
    ...fxComp.layers[0],
    id: 'lut_only',
    effects: [createEffectInstance('apply-colour-lut')],
  });
  renderCompositionFrame(lutComp, 0.1, undefined, { resolutionDivisor: 1, useCache: false });
  const nLut = 10;
  const tLut = performance.now();
  for (let i = 0; i < nLut; i++) {
    renderCompositionFrame(lutComp, 0.2, undefined, { resolutionDivisor: 1, useCache: false });
  }
  const lutGradeMs = (performance.now() - tLut) / nLut;

  // 5. Animated GIF89a + AVI Multi-Frame Encoding (8 frames @ 320x180)
  const rawFrames = Array.from({ length: 8 }, (_, f) => {
    const arr = new Uint8ClampedArray(320 * 180 * 4);
    arr.fill((f * 29) & 0xff);
    return arr;
  });
  encodeAnimatedGif(rawFrames.slice(0, 2), 320, 180, 24);
  const tGif = performance.now();
  encodeAnimatedGif(rawFrames, 320, 180, 24);
  encodeUncompressedAvi(rawFrames, 320, 180, 24);
  const gifEncodeMs = performance.now() - tGif;

  // 6. Fuzzy Effect Catalog Search (microseconds per query)
  searchEffects('blur');
  const nSearch = 500;
  const tSrch = performance.now();
  for (let i = 0; i < nSearch; i++) {
    searchEffects('chroma key');
  }
  const effectSearchUs = ((performance.now() - tSrch) / nSearch) * 1000;

  return {
    showcaseRenderMs: Number(showcaseRenderMs.toFixed(3)),
    hundredLayersMs: Number(hundredLayersMs.toFixed(3)),
    twentyEffectsMs: Number(twentyEffectsMs.toFixed(3)),
    lutGradeMs: Number(lutGradeMs.toFixed(3)),
    gifEncodeMs: Number(gifEncodeMs.toFixed(3)),
    effectSearchUs: Number(effectSearchUs.toFixed(2)),
  };
}

function median(vals: number[]): number {
  const s = [...vals].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

export function runMedianSuite(trials = 5): BenchmarkMetrics & { compositeScoreMs: number } {
  // Warm up V8 TurboFan across all paths first
  runQuantitativeBenchmarks();
  const samples: BenchmarkMetrics[] = [];
  for (let t = 0; t < trials; t++) {
    samples.push(runQuantitativeBenchmarks());
  }
  const m: BenchmarkMetrics = {
    showcaseRenderMs: Number(median(samples.map((x) => x.showcaseRenderMs)).toFixed(3)),
    hundredLayersMs: Number(median(samples.map((x) => x.hundredLayersMs)).toFixed(3)),
    twentyEffectsMs: Number(median(samples.map((x) => x.twentyEffectsMs)).toFixed(3)),
    lutGradeMs: Number(median(samples.map((x) => x.lutGradeMs)).toFixed(3)),
    gifEncodeMs: Number(median(samples.map((x) => x.gifEncodeMs)).toFixed(3)),
    effectSearchUs: Number(median(samples.map((x) => x.effectSearchUs)).toFixed(2)),
  };
  const compositeScoreMs = Number(
    (m.showcaseRenderMs + m.hundredLayersMs + m.twentyEffectsMs + m.lutGradeMs + m.gifEncodeMs).toFixed(3),
  );
  return { ...m, compositeScoreMs };
}

if (process.env.PRINT_PERF === '1') {
  console.log('PERF_MEDIAN_JSON=' + JSON.stringify(runMedianSuite(5)));
}
