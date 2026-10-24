import { describe, expect, it } from 'vitest';
import { compositePocStack } from '../../src/poc/compositingPoc';
import { evaluatePocExpression } from '../../src/poc/expressionPoc';
import { scrubMultiLayerTimeline } from '../../src/poc/timelineScrubPoc';
import { encodeFrameToPpm, encodePcmToWav } from '../../src/poc/videoCodecPoc';
import { evaluateTextAnimatorPoc } from '../../src/poc/textAnimatorPoc';
import { loadSandboxedPluginPoc } from '../../src/poc/pluginSandboxPoc';
import { topologicalSortDag } from '../../src/poc/nodeGraphPoc';

describe('Stage 5 Technical Proof of Concepts', () => {
  it('POC 1: composites multi-layer stack with separable O(1) blur', () => {
    const bg = new Uint8ClampedArray(16 * 16 * 4).fill(40);
    for (let i = 3; i < bg.length; i += 4) bg[i] = 255;
    const fg = new Uint8ClampedArray(16 * 16 * 4);
    fg[(8 * 16 + 8) * 4] = 250;
    fg[(8 * 16 + 8) * 4 + 3] = 255;

    const out = compositePocStack(16, 16, [
      { width: 16, height: 16, pixels: fg, opacity: 1, blendMode: 'add', blurRadius: 2 },
      { width: 16, height: 16, pixels: bg, opacity: 1, blendMode: 'normal' },
    ]);
    expect(out[(8 * 16 + 8) * 4]).toBeGreaterThan(40);
    expect(out[(8 * 16 + 7) * 4]).toBeGreaterThan(40); // spread by blur
  });

  it('POC 2: evaluates sandboxed AE expressions and stops infinite loops', () => {
    const res = evaluatePocExpression('wiggle(2, 15)', {
      time: 1.25,
      value: [960, 540],
      fps: 60,
      index: 1,
    });
    expect(res.ok).toBe(true);
    expect(Array.isArray(res.value)).toBe(true);

    const infinite = evaluatePocExpression('while (true) { } return 1;', {
      time: 0,
      value: 42,
      fps: 60,
      index: 1,
    });
    expect(infinite.ok).toBe(false);
    expect(infinite.value).toBe(42); // graceful fallback
  });

  it('POC 3: scrubs 120 keyframed layer tracks in under 5ms', () => {
    const tracks = Array.from({ length: 120 }, (_, i) => [
      { time: 0, value: 0, outX: 0.42, outY: 0, inX: 0.58, inY: 1 },
      { time: 5, value: 100 + i, outX: 0.42, outY: 0, inX: 0.58, inY: 1 },
      { time: 10, value: 50, outX: 0.42, outY: 0, inX: 0.58, inY: 1 },
    ]);
    const t0 = performance.now();
    const out = scrubMultiLayerTimeline(tracks, 2.5);
    const dt = performance.now() - t0;
    expect(out.length).toBe(120);
    expect(out[0]).toBeGreaterThan(20);
    expect(dt).toBeLessThan(5);
  });

  it('POC 4: encodes lossless WAV audio and PPM image frames', () => {
    const wav = encodePcmToWav(new Float32Array([0, 0.5, -0.5, 1]), 48000);
    expect(String.fromCharCode(wav[0], wav[1], wav[2], wav[3])).toBe('RIFF');
    const ppm = encodeFrameToPpm(new Uint8ClampedArray([255, 128, 64, 255]), 1, 1);
    expect(ppm.length).toBeGreaterThan(10);
  });

  it('POC 5: evaluates Text Range Selector per-character 3D poses', () => {
    const glyphs = evaluateTextAnimatorPoc('PREEFFECTS', 40, 2, 0, 60, 0, {
      dy: -30,
      dz: 50,
      opacity: 0.2,
      scale: 1.4,
      rotation: 15,
    });
    expect(glyphs).toHaveLength(10);
    expect(glyphs[2].y).toBeLessThan(0);
    expect(glyphs[9].y).toBe(0);
  });

  it('POC 6: isolates plugins from global/network objects', () => {
    const good = loadSandboxedPluginPoc(`
      preeffects.registerEffect({ id: 'gain2x', name: 'Gain 2x', apply: (v) => v * 2 });
      preeffects.log('loaded:' + typeof fetch);
    `);
    expect(good.effects).toHaveLength(1);
    expect(good.effects[0].apply(5)).toBe(10);
    expect(good.logs[0]).toBe('loaded:undefined');
  });

  it('POC 7: topologically orders DAG nodes and detects cycles', () => {
    const valid = topologicalSortDag([
      { id: 'read1', kind: 'source', inputs: [] },
      { id: 'glow1', kind: 'effect', inputs: ['read1'] },
      { id: 'out', kind: 'output', inputs: ['glow1'] },
    ]);
    expect(valid.hasCycle).toBe(false);
    expect(valid.order).toEqual(['read1', 'glow1', 'out']);

    const cyclic = topologicalSortDag([
      { id: 'a', kind: 'effect', inputs: ['b'] },
      { id: 'b', kind: 'effect', inputs: ['a'] },
    ]);
    expect(cyclic.hasCycle).toBe(true);
  });
});
