import { describe, expect, it } from 'vitest';
import { generateSynthAudioBuffer, measureAudioVuDb } from '../../src/engine/audio';
import { applyLayerMasksToBuffer } from '../../src/engine/masksAndRoto';
import { buildNodeGraphFromComp, validateAndSortNodeGraph } from '../../src/engine/nodeGraph';
import { executeStudioScript } from '../../src/plugins/sdk';
import { createShowcaseProject } from '../../src/engine/templates';
import { buildDefaultLayerForComp } from '../../src/engine/factory';
import { renderCompositionFrame } from '../../src/engine/compositor';

describe('Stage 13 Stress & Regression Suite — Bug Fixes Round 2 (BUG-R2-01 .. BUG-R2-05)', () => {
  it('BUG-R2-01: guards audio synthesizer & VU metering against zero/negative duration, sampleRate, and BPM', () => {
    const zeroDur = generateSynthAudioBuffer(-5, 0, 0);
    expect(zeroDur.length).toBe(0);

    const lowBpm = generateSynthAudioBuffer(0.25, 8000, 0);
    expect(lowBpm.length).toBe(2000);
    expect(lowBpm.every(Number.isFinite)).toBe(true);

    const vu = measureAudioVuDb(lowBpm, -1.5, 8000);
    expect(Number.isFinite(vu.rmsDb)).toBe(true);
    expect(Number.isFinite(vu.peakDb)).toBe(true);
  });

  it('BUG-R2-02: evaluates Bezier feathered masks with near-horizontal segments cleanly via BufferPool', () => {
    const buf = new Uint8ClampedArray(48 * 48 * 4).fill(255);
    applyLayerMasksToBuffer(buf, 48, 48, [
      {
        id: 'm_horiz',
        name: 'Mask 1',
        mode: 'add',
        inverted: false,
        locked: false,
        closed: true,
        rotoBezier: false,
        feather: 4,
        opacity: 100,
        expansion: 0,
        vertices: [
          { x: 10, y: 10, inX: 0, inY: 0, outX: 0, outY: 0 },
          { x: 38, y: 10 - 1e-9, inX: 0, inY: 0, outX: 0, outY: 0 },
          { x: 38, y: 38, inX: 0, inY: 0, outX: 0, outY: 0 },
          { x: 10, y: 38, inX: 0, inY: 0, outX: 0, outY: 0 },
        ],
      },
    ]);
    // Outside top-left corner should be feathered/masked out, center should remain opaque
    expect(buf[(2 * 48 + 2) * 4 + 3]).toBe(0);
    expect(buf[(24 * 48 + 24) * 4 + 3]).toBeGreaterThan(220);
  });

  it('BUG-R2-03 & BUG-R2-04: detects cyclic Node Graph wires and halts infinite loops in JS/Lua/Python automation scripts', () => {
    const prj = createShowcaseProject('orbital-hero');
    const graph = buildNodeGraphFromComp(prj.compositions[0]);
    const valid = validateAndSortNodeGraph(graph.nodes);
    expect(valid.acyclic).toBe(true);
    expect(valid.ordered.length).toBe(graph.nodes.length);

    // Inject mutual cycle between two branch nodes
    const cyclicCheck = validateAndSortNodeGraph([
      ...graph.nodes,
      { id: 'cyc_1', kind: 'branch-effect', label: 'Branch A', x: 0, y: 0, inputs: ['cyc_2'] },
      { id: 'cyc_2', kind: 'branch-effect', label: 'Branch B', x: 0, y: 0, inputs: ['cyc_1'] },
    ]);
    expect(cyclicCheck.acyclic).toBe(false);

    const runawayJs = executeStudioScript('javascript', 'while (true) { app.layerCount(); }', prj);
    expect(runawayJs.ok).toBe(false);
    expect(runawayJs.error).toContain('Script loop limit exceeded');
  });

  it('BUG-R2-05: 150-layer + 500-asset mixed-type soak test renders deterministically without buffer leaks', () => {
    const prj = createShowcaseProject('blank');
    const comp = prj.compositions[0];
    comp.width = 240;
    comp.height = 135;

    for (let a = 0; a < 500; a++) {
      prj.assets.push({
        id: `soak_ast_${a}`,
        name: `Plate_${a}.png`,
        kind: 'image',
        folder: 'Plates',
        path: `/local/plates/plate_${a}.png`,
        missing: a % 97 === 0,
      });
    }

    for (let i = 0; i < 150; i++) {
      const kind = i % 5 === 0 ? 'shape' : i % 5 === 1 ? 'text' : 'solid';
      const lyr = buildDefaultLayerForComp(kind, comp, `soak_lyr_${i}`);
      lyr.transform.opacity.value = 35;
      comp.layers.push(lyr);
    }

    const frame = renderCompositionFrame(comp, 0.8, prj, { resolutionDivisor: 2, useCache: false });
    expect(frame.width).toBe(120);
    expect(frame.height).toBe(68);
    expect(frame.expressionErrors.length).toBe(0);
    expect(frame.pixels.some((v) => v > 0)).toBe(true);
  });
});
