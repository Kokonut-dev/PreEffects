import { describe, expect, it } from 'vitest';
import {
  createNullsFromMaskVertices,
  evaluateNumericMathInput,
  GUIDED_TOUR_STEPS,
  mapColorBlindSafeSwatch,
  OKABE_ITO_SWATCHES,
  WHATS_THIS_HELP_DB,
} from '../../src/utils/qolHelpers';
import { diffObjectsSummary } from '../../src/utils/history';
import { createShowcaseProject } from '../../src/engine/templates';

describe('Stage 7 QoL Suite — Inline Math, Nulls from Paths, Accessibility & Help', () => {
  it('evaluates inline math expressions and relative operators safely without eval', () => {
    expect(evaluateNumericMathInput('1920/2', 0)).toBe(960);
    expect(evaluateNumericMathInput('(1080 - 120) / 2', 0)).toBe(480);
    expect(evaluateNumericMathInput('+45', 100)).toBe(145);
    expect(evaluateNumericMathInput('*1.5', 200)).toBe(300);
    expect(evaluateNumericMathInput('invalid_input', 42)).toBe(42);
    expect(evaluateNumericMathInput('100/0', 77)).toBe(77);
  });

  it('generates Null control rigs from Bezier Mask vertices (COMP-19)', () => {
    const prj = createShowcaseProject('orbital-hero');
    const comp = prj.compositions[0];
    const target = comp.layers[1];
    target.masks.push({
      id: 'm_path_1',
      name: 'QuadMask',
      mode: 'add',
      inverted: false,
      locked: false,
      rotoBezier: false,
      closed: true,
      feather: 4,
      expansion: 0,
      opacity: 100,
      vertices: [
        { x: 100, y: 120, inX: 0, inY: 0, outX: 0, outY: 0 },
        { x: 300, y: 120, inX: 0, inY: 0, outX: 0, outY: 0 },
        { x: 300, y: 260, inX: 0, inY: 0, outX: 0, outY: 0 },
      ],
    });
    const nulls = createNullsFromMaskVertices(comp, target.id, 'm_path_1');
    expect(nulls).toHaveLength(3);
    expect(nulls[0].type).toBe('null');
    expect(nulls[0].parentId).toBe(target.id);
    expect(nulls[0].transform.position.value[0]).toBe(100);
  });

  it('maps color-blind safe Okabe-Ito swatches, diff summaries, tour steps & contextual help DB', () => {
    const mapped = mapColorBlindSafeSwatch('#E89B3C', 0);
    expect(OKABE_ITO_SWATCHES).toContain(mapped);
    expect(GUIDED_TOUR_STEPS).toHaveLength(5);
    expect(Object.keys(WHATS_THIS_HELP_DB).length).toBeGreaterThanOrEqual(5);

    const diffs = diffObjectsSummary(
      [{ id: 'l1', name: 'Hero', effectsCount: 1, blendMode: 'normal' }],
      [
        { id: 'l1', name: 'Hero', effectsCount: 2, blendMode: 'screen' },
        { id: 'l2', name: 'GlowPlate', effectsCount: 0, blendMode: 'add' },
      ],
    );
    expect(diffs).toHaveLength(2);
  });
});
