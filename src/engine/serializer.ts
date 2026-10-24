import { Composition, Layer, ObjMeshData, Project, ProjectAsset } from './types';
import { createDefaultTransform, createId, makeProp } from './factory';

export function normalizePosixPath(p: string): string {
  return p.replace(/\\/g, '/');
}

export function serializeProjectToPrex(project: Project): string {
  const sanitized = {
    ...project,
    assets: project.assets.map((a) => {
      const expectedBytes = (a.width ?? 0) * (a.height ?? 0) * 4;
      const keepFullRgba = a.rgbaBuffer && expectedBytes > 0 && a.rgbaBuffer.length === expectedBytes && expectedBytes <= 262144;
      return {
        ...a,
        path: normalizePosixPath(a.path),
        rgbaBuffer: keepFullRgba ? Array.from(a.rgbaBuffer!) : undefined,
        audioSamples: a.audioSamples && a.audioSamples.length <= 16384 ? Array.from(a.audioSamples) : undefined,
      };
    }),
    renderQueue: project.renderQueue.map((rq) => ({
      ...rq,
      renderedArtifacts: undefined,
    })),
  };
  return JSON.stringify(sanitized, null, 2);
}

export function deserializePrexProject(rawJson: string): Project {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(rawJson);
  } catch (e) {
    throw new Error(`Invalid .prex project file: JSON syntax error (${e instanceof Error ? e.message : String(e)})`);
  }
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.compositions)) {
    throw new Error('Invalid .prex schema: missing compositions array');
  }
  const migrated = parsed as unknown as Project;
  migrated.schemaVersion = '1.0.0';
  migrated.assets = (migrated.assets ?? []).map((a) => {
    const rawArr = Array.isArray(a.rgbaBuffer) ? new Uint8ClampedArray(a.rgbaBuffer) : undefined;
    const expected = (a.width ?? 0) * (a.height ?? 0) * 4;
    return {
      ...a,
      path: normalizePosixPath(a.path || ''),
      rgbaBuffer: rawArr && expected > 0 && rawArr.length === expected ? rawArr : undefined,
      audioSamples: Array.isArray(a.audioSamples) ? new Float32Array(a.audioSamples) : undefined,
    };
  });
  return migrated;
}

// Parse Wavefront .OBJ 3D geometry (supporting both positive 1-based and negative relative face indices!)
export function parseObjMesh(objSource: string): ObjMeshData {
  const vertices: Array<[number, number, number]> = [];
  const faces: Array<number[]> = [];
  for (const raw of objSource.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith('v ')) {
      const [, xs, ys, zs] = line.split(/\s+/);
      vertices.push([parseFloat(xs) || 0, parseFloat(ys) || 0, parseFloat(zs) || 0]);
    } else if (line.startsWith('f ')) {
      const indices = line
        .slice(2)
        .trim()
        .split(/\s+/)
        .map((tok) => {
          const rawIdx = parseInt(tok.split('/')[0], 10);
          if (!Number.isFinite(rawIdx) || rawIdx === 0) return -1;
          return rawIdx > 0 ? rawIdx - 1 : vertices.length + rawIdx;
        })
        .filter((idx) => idx >= 0 && idx < vertices.length);
      if (indices.length >= 3) faces.push(indices);
    }
  }
  return { vertices, faces };
}

function splitDelimitedLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      cells.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  cells.push(cur.trim());
  return cells;
}

// Parse CSV / TSV Data-Driven Animation table (RFC-4180 quote-aware)
export function parseDelimitedData(text: string, delimiter = ','): Array<Record<string, string | number>> {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = splitDelimitedLine(lines[0], delimiter);
  return lines.slice(1).map((line) => {
    const cols = splitDelimitedLine(line, delimiter);
    const row: Record<string, string | number> = {};
    headers.forEach((h, idx) => {
      const val = cols[idx] ?? '';
      const num = Number(val);
      row[h] = val !== '' && Number.isFinite(num) ? num : val;
    });
    return row;
  });
}

// Parse CMX 3600 EDL timeline interchange into Composition
export function importEdlToComposition(edlText: string, fps = 24): Composition {
  const layers: Layer[] = [];
  const lines = edlText.split(/\r?\n/);
  let idx = 1;
  for (const line of lines) {
    const m = line.match(/^\d+\s+(\S+)\s+\S+\s+\S+\s+(\d\d):(\d\d):(\d\d):(\d\d)\s+(\d\d):(\d\d):(\d\d):(\d\d)/);
    if (m) {
      const reel = m[1];
      const inSec = Number(m[2]) * 3600 + Number(m[3]) * 60 + Number(m[4]) + Number(m[5]) / fps;
      const outSec = Number(m[6]) * 3600 + Number(m[7]) * 60 + Number(m[8]) + Number(m[9]) / fps;
      layers.push({
        id: createId('lyr'),
        name: `EDL_${idx}_${reel}`,
        type: 'solid',
        labelColor: '#4C8BF5',
        visible: true,
        audioEnabled: false,
        solo: false,
        locked: false,
        shy: false,
        collapseTransformations: false,
        frameBlending: 'off',
        motionBlur: false,
        threeD: false,
        inPoint: inSec,
        outPoint: Math.max(inSec + 0.5, outSec),
        startTime: inSec,
        stretchPct: 100,
        blendMode: 'normal',
        trackMatteMode: 'none',
        transform: createDefaultTransform(960, 540, 960, 540),
        masks: [],
        effects: [],
        paintStrokes: [],
        puppetPins: [],
        markers: [],
        solidColor: '#253952',
      });
      idx++;
    }
  }
  return {
    id: createId('comp'),
    name: 'Imported_EDL_Sequence',
    width: 1920,
    height: 1080,
    pixelAspect: 1,
    fps,
    duration: Math.max(10, ...layers.map((l) => l.outPoint)),
    backgroundColor: '#0B0F17',
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
}

// Collect Files / Package Project Report & Manifest
export function collectProjectPackage(project: Project): {
  projectPrex: string;
  reportTxt: string;
  referencedAssets: ProjectAsset[];
  missingAssets: ProjectAsset[];
} {
  const projectPrex = serializeProjectToPrex(project);
  const missingAssets = project.assets.filter((a) => a.missing);
  const reportLines = [
    `PreEffects Collect Files Report`,
    `Project: ${project.name}`,
    `Generated: ${new Date().toISOString()}`,
    `Schema Version: ${project.schemaVersion}`,
    `Bit Depth: ${project.bitDepth}-bpc (${project.workingColorSpace})`,
    `Compositions: ${project.compositions.length}`,
    `Total Assets: ${project.assets.length} (${missingAssets.length} missing)`,
    ``,
    `Compositions:`,
    ...project.compositions.map((c) => `  - ${c.name} (${c.width}x${c.height} @ ${c.fps}fps, ${c.layers.length} layers)`),
    ``,
    `Assets:`,
    ...project.assets.map((a) => `  - [${a.kind}] ${a.name} -> ${a.path}${a.missing ? ' (MISSING)' : ''}`),
  ];
  return {
    projectPrex,
    reportTxt: reportLines.join('\n'),
    referencedAssets: project.assets,
    missingAssets,
  };
}

export function relinkMissingAssetsInFolder(
  project: Project,
  availableFilesByName: Record<string, string>,
): { project: Project; relinkedCount: number } {
  let relinkedCount = 0;
  const nextAssets = project.assets.map((asset) => {
    if (!asset.missing) return asset;
    const baseName = normalizePosixPath(asset.path).split('/').pop() ?? asset.name;
    const replacement = availableFilesByName[baseName] ?? availableFilesByName[asset.name];
    if (replacement) {
      relinkedCount++;
      return { ...asset, path: normalizePosixPath(replacement), missing: false };
    }
    return asset;
  });
  return { project: { ...project, assets: nextAssets }, relinkedCount };
}
