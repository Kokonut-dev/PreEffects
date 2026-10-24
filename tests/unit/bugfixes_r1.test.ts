import { describe, expect, it } from 'vitest';
import { createShowcaseProject } from '../../src/engine/templates';
import { createDefaultTransform } from '../../src/engine/factory';
import { renderCompositionFrame, studioRamCache } from '../../src/engine/compositor';
import { evaluateProperty } from '../../src/engine/expressions';
import { createEffectInstance } from '../../src/effects/registry';
import { deserializePrexProject, parseDelimitedData, parseObjMesh, serializeProjectToPrex } from '../../src/engine/serializer';

describe('Stage 10 Regression Suite — Bug Fixes Round 1 (BUG-R1-01 .. BUG-R1-06)', () => {
  it('BUG-R1-01: invalidates RAM preview cache when effect params, solidColor, or scale change at identical playhead', () => {
    studioRamCache.purgeAll();
    const prj = createShowcaseProject('blank');
    const comp = prj.compositions[0];
    comp.width = 64;
    comp.height = 64;
    const fx = createEffectInstance('tint');
    comp.layers.push({
      id: 'l_cache_test',
      name: 'CacheTest',
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
      outPoint: 5,
      startTime: 0,
      stretchPct: 100,
      blendMode: 'normal',
      trackMatteMode: 'none',
      transform: createDefaultTransform(32, 32, 32, 32),
      masks: [],
      effects: [fx],
      paintStrokes: [],
      puppetPins: [],
      markers: [],
      solidColor: '#FF0000',
    });

    const f1 = renderCompositionFrame(comp, 0.5, prj, { useCache: true });
    expect(f1.fromCache).toBe(false);
    const f1Hit = renderCompositionFrame(comp, 0.5, prj, { useCache: true });
    expect(f1Hit.fromCache).toBe(true);

    // Mutate solidColor at the exact same playhead t=0.5 -> MUST invalidate cache!
    comp.layers[0].solidColor = '#00FF00';
    const f2 = renderCompositionFrame(comp, 0.5, prj, { useCache: true });
    expect(f2.fromCache).toBe(false);
    expect(f2.pixels[1]).not.toBe(f1.pixels[1]);

    // Mutate effect parameter at exact same playhead t=0.5 -> MUST invalidate cache!
    const firstKey = Object.keys(fx.params)[0];
    if (firstKey) {
      fx.params[firstKey].value = 0;
      const f3 = renderCompositionFrame(comp, 0.5, prj, { useCache: true });
      expect(f3.fromCache).toBe(false);
    }
  });

  it('BUG-R1-02 & BUG-R1-03: evaluates multi-statement AE expressions without explicit return and halts do/braceless infinite loops', () => {
    const prj = createShowcaseProject('orbital-hero');
    const comp = prj.compositions[0];
    const layer = comp.layers[2];

    const multiStmt = evaluateProperty(
      {
        value: 100,
        animated: false,
        keyframes: [],
        expressionEnabled: true,
        expression: 'const amp = 25; const boost = 15; value + amp + boost;',
      },
      1.0,
      layer,
      comp,
      prj,
    );
    expect(multiStmt.error).toBeUndefined();
    expect(multiStmt.value).toBe(140);

    const posterizeSnippet = evaluateProperty(
      {
        value: [100, 200, 0] as [number, number, number],
        animated: false,
        keyframes: [],
        expressionEnabled: true,
        expression: 'posterizeTime(12); wiggle(4, 20);',
      },
      0.73,
      layer,
      comp,
      prj,
    );
    expect(posterizeSnippet.error).toBeUndefined();
    expect(posterizeSnippet.value[0]).not.toBe(100);

    const doWhileTrap = evaluateProperty(
      {
        value: 50,
        animated: false,
        keyframes: [],
        expressionEnabled: true,
        expression: 'let k = 0; do { k++; } while (true); return k;',
      },
      0,
      layer,
      comp,
      prj,
    );
    expect(doWhileTrap.error).toContain('Infinite loop stopped by sandbox');

    const bracelessWhileTrap = evaluateProperty(
      {
        value: 50,
        animated: false,
        keyframes: [],
        expressionEnabled: true,
        expression: 'let k = 0; while (true) k++; return k;',
      },
      0,
      layer,
      comp,
      prj,
    );
    expect(bracelessWhileTrap.error).toContain('Infinite loop stopped by sandbox');
  });

  it('BUG-R1-04 & BUG-R1-06: supports negative relative .OBJ face indices, full small RGBA persistence, and RFC-4180 quoted CSV fields', () => {
    const obj = parseObjMesh(`
      v -1 -1 0
      v  1 -1 0
      v  1  1 0
      v -1  1 0
      f -4 -3 -2 -1
    `);
    expect(obj.vertices.length).toBe(4);
    expect(obj.faces.length).toBe(1);
    expect(obj.faces[0]).toEqual([0, 1, 2, 3]);

    const csv = parseDelimitedData('city,lat,lon\n"Amsterdam, NL",52.37,4.89\n"Tokyo ""Metro"", JP",35.68,139.76');
    expect(csv.length).toBe(2);
    expect(csv[0].city).toBe('Amsterdam, NL');
    expect(csv[0].lat).toBe(52.37);
    expect(csv[1].city).toBe('Tokyo "Metro", JP');

    const prj = createShowcaseProject('blank');
    prj.assets.push({
      id: 'a_plate',
      name: 'MiniPlate',
      kind: 'image',
      folder: 'Plates',
      path: 'C:\\Projects\\Plates\\mini.png',
      missing: false,
      width: 40,
      height: 40,
      rgbaBuffer: new Uint8ClampedArray(40 * 40 * 4).fill(210),
    });
    const roundtrip = deserializePrexProject(serializeProjectToPrex(prj));
    expect(roundtrip.assets[0].path).toBe('C:/Projects/Plates/mini.png');
    expect(roundtrip.assets[0].rgbaBuffer?.length).toBe(40 * 40 * 4);
    expect(roundtrip.assets[0].rgbaBuffer?.[6399]).toBe(210);
  });

  it('BUG-R1-05: handles cyclic precomps, self-referencing track mattes, and fps=0 without NaN or infinite recursion', () => {
    const prj = createShowcaseProject('blank');
    const compA = prj.compositions[0];
    compA.width = 64;
    compA.height = 64;
    compA.fps = 0; // degenerate zero FPS
    compA.motionBlurEnabled = true;

    const compB = structuredClone(compA);
    compB.id = 'comp_cycle_b';
    prj.compositions.push(compB);

    // Mutual precomp cycle: compA -> compB -> compA, plus self-referencing trackMatteLayerId!
    compA.layers.push({
      id: 'lyr_cyc_a',
      name: 'PrecompB',
      type: 'precomp',
      precompId: compB.id,
      labelColor: '#E89B3C',
      visible: true,
      audioEnabled: false,
      solo: false,
      locked: false,
      shy: false,
      collapseTransformations: false,
      frameBlending: 'off',
      motionBlur: true,
      threeD: false,
      inPoint: 0,
      outPoint: 5,
      startTime: 0,
      stretchPct: 100,
      blendMode: 'normal',
      trackMatteMode: 'alpha',
      trackMatteLayerId: 'lyr_cyc_a',
      transform: createDefaultTransform(32, 32, 32, 32),
      masks: [],
      effects: [],
      paintStrokes: [],
      puppetPins: [],
      markers: [],
    });
    compB.layers.push({
      ...compA.layers[0],
      id: 'lyr_cyc_b',
      precompId: compA.id,
      trackMatteMode: 'none',
    });

    const res = renderCompositionFrame(compA, 1.0, prj, { useCache: false });
    expect(res.width).toBe(64);
    expect(res.height).toBe(64);
    expect(Number.isFinite(res.totalTimeMs)).toBe(true);
  });
});
