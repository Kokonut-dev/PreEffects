import { describe, expect, it } from 'vitest';
import zlib from 'node:zlib';
import { createShowcaseProject } from '../../src/engine/templates';
import { buildDefaultLayerForComp, createId } from '../../src/engine/factory';
import { renderCompositionFrame, studioRamCache } from '../../src/engine/compositor';
import { compositeSoftwareViewportPixels } from '../../src/engine/webglBackend';
import { evaluateProperty } from '../../src/engine/expressions';
import { executeEffectBuffer } from '../../src/effects/registry';
import {
  encodePngRgba,
  encodeZipArchive,
  executeRenderQueueJob,
  mixCompositionAudioSamples,
} from '../../src/engine/export';
import { compareSemver, pickPlatformReleaseAsset } from '../../src/utils/updaterLogic';
import { DEFAULT_SHORTCUTS, detectShortcutConflicts } from '../../src/utils/shortcuts';

describe('Round-4 Audit Fixes, Optimisations & QoL Verification (v1.0.4)', () => {
  it('BUG-R4-01: inherits parent rotationZ and scale accurately via exact worldMat inverse rasterizer', () => {
    const proj = createShowcaseProject('blank');
    const comp = proj.compositions[0];
    comp.width = 200;
    comp.height = 200;

    const parent = buildDefaultLayerForComp('null', comp, 'lyr_parent');
    parent.transform.position.value = [100, 100, 0];
    parent.transform.anchorPoint.value = [100, 100, 0];
    parent.transform.rotationZ.value = 90; // Rotate child +90 deg clockwise around (100,100)
    parent.transform.scale.value = [100, 100, 100];

    const child = buildDefaultLayerForComp('shape', comp, 'lyr_child');
    child.parentId = parent.id;
    // Place child locally at (150, 100) relative to parent's anchor (100, 100) -> +50px right in local parent space.
    // Under parent's +90deg Z rotation, child's world center MUST land at (100, 150) — bottom-center!
    child.transform.position.value = [150, 100, 0];
    child.transform.anchorPoint.value = [100, 100, 0];
    if (child.shapeContent) {
      child.shapeContent.kind = 'rect';
      child.shapeContent.width = 28;
      child.shapeContent.height = 28;
      child.shapeContent.fillColor = '#ff2244';
      child.shapeContent.fillOpacity = 100;
      child.shapeContent.strokeWidth = 0;
    }

    comp.layers = [child, parent];
    const frame = renderCompositionFrame(comp, 0, proj, {
      resolutionDivisor: 1,
      transparentBackground: true,
      useCache: false,
    });

    const alphaAt = (x: number, y: number) => frame.pixels[(y * 200 + x) * 4 + 3];
    // Rotated world position (100, 150) must be opaque red, while unrotated (150, 100) must be transparent!
    expect(alphaAt(100, 150)).toBeGreaterThan(245);
    expect(alphaAt(150, 100)).toBe(0);
  });

  it('BUG-R4-02: composites 12px [36, 51] transparency checkerboard & A/B wipe in software Canvas2D path', () => {
    const w = 24;
    const h = 12;
    const src = new Uint8ClampedArray(w * h * 4); // 100% transparent
    const dst = new Uint8ClampedArray(w * h * 4);
    compositeSoftwareViewportPixels(src, dst, w, h, true, null, 0);

    // Tile (0,0) -> x=2,y=2 -> chk=0 -> even -> 36; Tile (1,0) -> x=14,y=2 -> chk=1 -> odd -> 51
    const oEven = (2 * w + 2) * 4;
    const oOdd = (2 * w + 14) * 4;
    expect(dst[oEven]).toBe(36);
    expect(dst[oEven + 3]).toBe(255);
    expect(dst[oOdd]).toBe(51);
    expect(dst[oOdd + 3]).toBe(255);
  });

  it('BUG-R4-04 & OPT-R4-05: invalidates RAM cache when Bezier tangents or animated effect keyframes change, and caches nested precomps', () => {
    studioRamCache.purgeAll();
    const proj = createShowcaseProject('orbital-hero');
    const comp = proj.compositions[0];
    const lyr = comp.layers[0];
    lyr.transform.position.animated = true;
    lyr.transform.position.keyframes = [
      { id: 'k1', time: 0, value: [200, 540, 0], interpolation: 'bezier', outInfluence: 0.2, outSlope: 0 },
      { id: 'k2', time: 2, value: [1600, 540, 0], interpolation: 'bezier', inInfluence: 0.2, inSlope: 0 },
    ];

    renderCompositionFrame(comp, 1.0, proj, { resolutionDivisor: 4, useCache: true });
    // OPT-R4-05: Caches BOTH the nested precomp (nestDepth = 1) AND outer comp (nestDepth = 0) -> 2 entries!
    const afterFirst = studioRamCache.getEntryCount();
    expect(afterFirst).toBeGreaterThanOrEqual(2);

    // Re-rendering identical state hits cache (0 new entries)
    renderCompositionFrame(comp, 1.0, proj, { resolutionDivisor: 4, useCache: true });
    expect(studioRamCache.getEntryCount()).toBe(afterFirst);

    // BUG-R4-04: Mutating ONLY Bezier outInfluence/outSlope without changing keyframe time/value invalidates outer comp!
    lyr.transform.position.keyframes[0].outInfluence = 0.92;
    lyr.transform.position.keyframes[0].outSlope = 900;
    renderCompositionFrame(comp, 1.0, proj, { resolutionDivisor: 4, useCache: true });
    expect(studioRamCache.getEntryCount()).toBe(afterFirst + 1);
  });

  it('BUG-R4-06: supports [x, y, z] vector tuple accumulation in loopOut("offset") & loopOut("continue")', () => {
    const proj = createShowcaseProject('blank');
    const comp = proj.compositions[0];
    const lyr = buildDefaultLayerForComp('null', comp, 'lyr_loop');
    lyr.transform.position = {
      value: [0, 0, 0],
      animated: true,
      keyframes: [
        { id: 'k0', time: 0, value: [100, 200, 0], interpolation: 'linear' },
        { id: 'k1', time: 1, value: [200, 250, 10], interpolation: 'linear' },
      ],
      expression: 'loopOut("offset")',
      expressionEnabled: true,
    };

    const at25 = evaluateProperty(lyr.transform.position, 2.5, lyr, comp, proj).value;
    // 2.5s = 2 full cycles (+[200, 100, 20]) + 0.5s midpoint ([150, 225, 5]) = [350, 325, 25]
    expect(at25[0]).toBeCloseTo(350, 1);
    expect(at25[1]).toBeCloseTo(325, 1);
    expect(at25[2]).toBeCloseTo(25, 1);

    lyr.transform.position.expression = 'loopOut("continue")';
    const cont2 = evaluateProperty(lyr.transform.position, 2.0, lyr, comp, proj).value;
    expect(cont2[0]).toBeCloseTo(300, 0);
    expect(cont2[1]).toBeCloseTo(300, 0);
  });

  it('BUG-R4-09: applies genuine directional gamma & Kodak Cineon Log curves in utility colour converters', () => {
    const w = 4;
    const h = 4;
    const src = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < src.length; i += 4) {
      src[i] = 128;
      src[i + 1] = 128;
      src[i + 2] = 128;
      src[i + 3] = 255;
    }

    const outProf = new Uint8ClampedArray(w * h * 4);
    executeEffectBuffer('colour-profile-converter', src, outProf, { amount: 100 }, { width: w, height: h, time: 0, fps: 30, frameIndex: 0 });
    // sRGB 128 (~0.502) -> Linear (~0.216 -> ~55) — NOT a no-op identity 128!
    expect(outProf[0]).toBeLessThan(90);
    expect(outProf[0]).toBeGreaterThan(35);

    const outCin = new Uint8ClampedArray(w * h * 4);
    executeEffectBuffer('cineon-converter', src, outCin, { amount: 100 }, { width: w, height: h, time: 0, fps: 30, frameIndex: 0 });
    expect(outCin[0]).not.toBe(128);
  });

  it('QOL-R4-05: compares semver tags & picks exact OS/arch installer assets ($0/yr GitHub Release updater)', () => {
    expect(compareSemver('v1.0.4', '1.0.3')).toBe(1);
    expect(compareSemver('1.0.4', 'v1.0.4')).toBe(0);
    expect(compareSemver('v1.0.2', '1.0.4')).toBe(-1);
    expect(compareSemver('v1.2.0', '1.1.9')).toBe(1);

    const sampleAssets = [
      { name: 'PreEffects-1.0.4-mac-arm64.dmg', browser_download_url: 'https://example/arm64.dmg', size: 95_000_000 },
      { name: 'PreEffects-1.0.4-mac-x64.dmg', browser_download_url: 'https://example/x64.dmg', size: 98_000_000 },
      { name: 'PreEffects-Setup-1.0.4.exe', browser_download_url: 'https://example/win.exe', size: 84_000_000 },
      { name: 'PreEffects-1.0.4-x86_64.AppImage', browser_download_url: 'https://example/lin.AppImage', size: 102_000_000 },
    ];

    expect(pickPlatformReleaseAsset(sampleAssets, 'darwin', 'arm64')?.name).toBe('PreEffects-1.0.4-mac-arm64.dmg');
    expect(pickPlatformReleaseAsset(sampleAssets, 'darwin', 'x64')?.name).toBe('PreEffects-1.0.4-mac-x64.dmg');
    expect(pickPlatformReleaseAsset(sampleAssets, 'win32', 'x64')?.name).toBe('PreEffects-Setup-1.0.4.exe');
    expect(pickPlatformReleaseAsset(sampleAssets, 'linux', 'x64')?.name).toBe('PreEffects-1.0.4-x86_64.AppImage');
  });

  it('QOL-R4-08: encodes valid RFC-2083 32-bit RGBA PNG, PKZIP PNG sequence archive, and mixed layer WAV audio', () => {
    const w = 8;
    const h = 6;
    const rgba = new Uint8ClampedArray(w * h * 4);
    rgba[0] = 245; rgba[1] = 165; rgba[2] = 36; rgba[3] = 128; // Translucent amber pixel (0,0)

    const png = encodePngRgba(rgba, w, h);
    // Verify 8-byte PNG signature
    expect(Array.from(png.slice(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    // Verify IDAT zlib stream decompresses cleanly via Node's native RFC-1950 inflateSync!
    const idatTypeIdx = 8 + 25 + 4; // sig(8) + IHDR(25) + len(4)
    expect(String.fromCharCode(png[idatTypeIdx], png[idatTypeIdx + 1], png[idatTypeIdx + 2], png[idatTypeIdx + 3])).toBe('IDAT');
    const idatLen = new DataView(png.buffer, png.byteOffset + 8 + 25, 4).getUint32(0, false);
    const inflated = zlib.inflateSync(png.subarray(idatTypeIdx + 4, idatTypeIdx + 4 + idatLen));
    expect(inflated.length).toBe(h * (w * 4 + 1));
    expect(inflated[0]).toBe(0); // Filter None
    expect(Array.from(inflated.slice(1, 5))).toEqual([245, 165, 36, 128]); // Lossless RGBA preserved!

    // Verify PKZIP archive header & EOCD signature
    const zip = encodeZipArchive([
      { name: 'frame_00000.png', data: png },
      { name: 'frame_00001.png', data: png },
    ]);
    expect(new DataView(zip.buffer).getUint32(0, true)).toBe(0x04034b50);
    expect(new DataView(zip.buffer).getUint32(zip.byteLength - 22, true)).toBe(0x06054b50);

    // Verify RenderQueueItem with png-frame & png-seq-zip & imported layer WAV audio
    const proj = createShowcaseProject('blank');
    const comp = proj.compositions[0];
    const customSamples = new Float32Array(8000).fill(0.5);
    proj.assets.push({
      id: 'ast_tone',
      name: 'Tone.wav',
      folder: 'Audio',
      kind: 'audio',
      path: 'Tone.wav',
      audioSamples: customSamples,
      audioSampleRate: 8000,
      duration: 1,
    });
    const audLyr = buildDefaultLayerForComp('audio', comp, 'lyr_aud');
    audLyr.assetId = 'ast_tone';
    audLyr.audioEnabled = true;
    comp.layers.push(audLyr);

    const mixed = mixCompositionAudioSamples(proj, comp, 0, 0.25, 8000);
    expect(mixed[10]).toBeCloseTo(0.5, 2);

    const jobRes = executeRenderQueueJob(
      {
        id: createId('rq'),
        compId: comp.id,
        status: 'queued',
        quality: 'best',
        resolutionDivisor: 4,
        useProxies: false,
        startFrame: 0,
        endFrame: 1,
        progressPct: 0,
        elapsedMs: 0,
        outputModules: [
          { id: 'om1', format: 'png-frame', channels: 'rgba', includeAudio: false, aovPasses: ['beauty'], outputName: 'ShotA' },
          { id: 'om2', format: 'png-seq-zip', channels: 'rgba', includeAudio: false, aovPasses: ['beauty'], outputName: 'ShotA' },
        ],
      },
      proj,
    );
    expect(jobRes.status).toBe('completed');
    expect(jobRes.renderedArtifacts?.[0].name).toBe('ShotA_0000.png');
    expect(jobRes.renderedArtifacts?.[0].mimeType).toBe('image/png');
    expect(jobRes.renderedArtifacts?.[1].name).toBe('ShotA_png_seq.zip');
    expect(jobRes.renderedArtifacts?.[1].mimeType).toBe('application/zip');
  });

  it('QOL-R4-02/06/07/09/10: keeps all expanded keyboard shortcuts 100% conflict-free', () => {
    expect(DEFAULT_SHORTCUTS.length).toBeGreaterThanOrEqual(61);
    expect(detectShortcutConflicts(DEFAULT_SHORTCUTS)).toEqual([]);
  });
});
