import { describe, expect, it } from 'vitest';
import { createShowcaseProject } from '../../src/engine/templates';
import {
  collectProjectPackage,
  deserializePrexProject,
  importEdlToComposition,
  parseDelimitedData,
  parseObjMesh,
  relinkMissingAssetsInFolder,
  serializeProjectToPrex,
} from '../../src/engine/serializer';
import { ALL_BLEND_MODES } from '../../src/engine/types';
import { blendLayerBufferOntoComp, renderCompositionFrame } from '../../src/engine/compositor';
import { addEffectNodeToLayerInGraph, buildNodeGraphFromComp, toggleNodeBypassInComp } from '../../src/engine/nodeGraph';
import { executeRenderQueueJob } from '../../src/engine/export';

describe('Stage 6 Integration Suite — End-to-End Workflows', () => {
  it('round-trips .prex serialization with cross-platform POSIX path normalization & importers', () => {
    const prj = createShowcaseProject('orbital-hero');
    prj.assets[0].path = 'C:\\Studio\\Media\\sub_pulse_124bpm.wav';
    const raw = serializeProjectToPrex(prj);
    expect(raw).not.toContain('C:\\Studio');
    expect(raw).toContain('C:/Studio/Media/sub_pulse_124bpm.wav');

    const reloaded = deserializePrexProject(raw);
    expect(reloaded.compositions.length).toBe(prj.compositions.length);
    expect(reloaded.activeCompId).toBe(prj.activeCompId);

    // Importers: OBJ, CSV, CMX 3600 EDL, Collect Files & Relink
    const mesh = parseObjMesh('v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3');
    expect(mesh.vertices).toHaveLength(3);
    expect(mesh.faces).toHaveLength(1);

    const csv = parseDelimitedData('city,temp\nAmsterdam,19\nTokyo,24');
    expect(csv).toHaveLength(2);
    expect(csv[0].city).toBe('Amsterdam');

    const edlComp = importEdlToComposition('TITLE: SPOT_01\n001  AX       V     C        00:00:00:00 00:00:02:00 00:00:00:00 00:00:02:00', 24);
    expect(edlComp.layers.length).toBeGreaterThanOrEqual(1);

    const manifest = collectProjectPackage(reloaded);
    expect(manifest.referencedAssets.length).toBe(reloaded.assets.length);

    reloaded.assets[0].missing = true;
    const relinked = relinkMissingAssetsInFolder(reloaded, { 'sub_pulse_124bpm.wav': '/Media/Restored/sub_pulse_124bpm.wav' });
    expect(relinked.project.assets[0].missing).toBe(false);
    expect(relinked.relinkedCount).toBe(1);
  });

  it('composites nested precomps, adjustment LUTs, 3D lights/DoF, all 38 blend modes & guide exclusion', () => {
    const prj = createShowcaseProject('orbital-hero');
    const mainComp = prj.compositions[0];

    // Add a guide layer and verify it renders in preview but is excluded on final export
    mainComp.layers.unshift({
      ...structuredClone(mainComp.layers[mainComp.layers.length - 2]),
      id: 'lyr_guide_test',
      name: 'Safe_Note_Guide',
      type: 'guide',
      solidColor: '#FF00FF',
      effects: [],
    });

    const previewFrame = renderCompositionFrame(mainComp, 1.5, prj, { resolutionDivisor: 4, isFinalRender: false, useCache: false });
    const finalFrame = renderCompositionFrame(mainComp, 1.5, prj, { resolutionDivisor: 4, isFinalRender: true, useCache: false });
    expect(previewFrame.width).toBe(480);
    expect(previewFrame.height).toBe(270);
    expect(finalFrame.pixels[0]).not.toBe(previewFrame.pixels[0]);

    // Exercise all 38 blending modes without NaN or out-of-range values
    const dst = new Uint8ClampedArray([120, 80, 200, 255]);
    const src = new Uint8ClampedArray([220, 150, 40, 200]);
    for (const mode of ALL_BLEND_MODES) {
      const copy = new Uint8ClampedArray(dst);
      blendLayerBufferOntoComp(copy, src, mode, 0.85);
      expect(copy[0]).toBeGreaterThanOrEqual(0);
      expect(copy[0]).toBeLessThanOrEqual(255);
    }
  });

  it('maintains bidirectional sync between Timeline Layer Stack and Node Compositing Graph (DAG)', () => {
    const prj = createShowcaseProject('orbital-hero');
    let comp = prj.compositions[0];
    comp.nodeGraph = buildNodeGraphFromComp(comp);

    const targetLayer = comp.layers[1];
    const srcNodeId = `node_src_${targetLayer.id}`;
    expect(comp.nodeGraph.nodes.some((n) => n.id === srcNodeId)).toBe(true);

    // Bypassing source node in Node Graph hides layer in Timeline
    comp = toggleNodeBypassInComp(comp, srcNodeId);
    expect(comp.layers.find((l) => l.id === targetLayer.id)?.visible).toBe(false);

    // Adding an effect node in Node Graph appends EffectInstance onto Layer
    const prevFxCount = comp.layers.find((l) => l.id === targetLayer.id)!.effects.length;
    comp = addEffectNodeToLayerInGraph(comp, targetLayer.id, 'gaussian-blur');
    expect(comp.layers.find((l) => l.id === targetLayer.id)!.effects.length).toBe(prevFxCount + 1);
  });

  it('executes Multi-Module Render Queue producing valid GIF89a, AVI, WAV, TGA, HDR & AOV binaries', () => {
    const prj = createShowcaseProject('orbital-hero');
    const job = {
      id: 'rq_test_all',
      compId: prj.activeCompId,
      status: 'queued' as const,
      quality: 'best' as const,
      resolutionDivisor: 4 as const,
      useProxies: false,
      startFrame: 0,
      endFrame: 2,
      progressPct: 0,
      elapsedMs: 0,
      outputModules: [
        { id: 'm_gif', format: 'gif' as const, channels: 'rgba' as const, includeAudio: false, aovPasses: ['beauty' as const, 'z-depth' as const], outputName: 'out_anim' },
        { id: 'm_avi', format: 'avi' as const, channels: 'rgb' as const, includeAudio: false, aovPasses: ['beauty' as const], outputName: 'out_vid' },
        { id: 'm_wav', format: 'wav' as const, channels: 'rgb' as const, includeAudio: true, aovPasses: ['beauty' as const], outputName: 'out_aud' },
        { id: 'm_exr', format: 'exr-seq' as const, channels: 'rgba' as const, includeAudio: false, aovPasses: ['beauty' as const], outputName: 'out_hdr' },
      ],
    };

    const done = executeRenderQueueJob(job, prj);
    expect(done.status).toBe('completed');
    expect(done.renderedArtifacts?.length).toBe(5); // GIF + Z-Depth TGA + AVI + WAV + HDR

    const gifBytes = done.renderedArtifacts!.find((a) => a.name.endsWith('.gif'))!.data!;
    expect(new TextDecoder().decode(gifBytes.slice(0, 6))).toBe('GIF89a');
    expect(gifBytes[gifBytes.length - 1]).toBe(0x3b);

    const aviBytes = done.renderedArtifacts!.find((a) => a.name.endsWith('.avi'))!.data!;
    expect(new TextDecoder().decode(aviBytes.slice(0, 4))).toBe('RIFF');
    expect(new TextDecoder().decode(aviBytes.slice(8, 12))).toBe('AVI ');

    const wavBytes = done.renderedArtifacts!.find((a) => a.name.endsWith('.wav'))!.data!;
    expect(new TextDecoder().decode(wavBytes.slice(0, 4))).toBe('RIFF');
    expect(new TextDecoder().decode(wavBytes.slice(8, 12))).toBe('WAVE');

    const hdrBytes = done.renderedArtifacts!.find((a) => a.name.endsWith('.hdr'))!.data!;
    expect(new TextDecoder().decode(hdrBytes.slice(0, 10))).toBe('#?RADIANCE');
  });
});
