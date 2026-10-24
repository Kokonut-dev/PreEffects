// Transaction-coalesced Undo/Redo History Manager + Structural Binary Sharing + Visual Diff

export interface HistoryEntry<T> {
  id: string;
  label: string;
  timestamp: number;
  txKey?: string;
  state: T;
}

/**
 * Clones project/document state while preserving immutable heavy TypedArray binary payloads
 * (ProjectAsset.rgbaBuffer, ProjectAsset.audioSamples, RenderQueueItem.renderedArtifacts[].data)
 * by reference — eliminating multi-gigabyte memory duplication across 200 Undo snapshots (OPT-R3-04).
 */
export function cloneHistoryState<T>(state: T): T {
  if (!state || typeof state !== 'object') {
    return structuredClone(state);
  }
  const rec = state as Record<string, unknown>;
  if (!Array.isArray(rec.assets) && !Array.isArray(rec.renderQueue)) {
    return structuredClone(state);
  }

  const savedAssetBuffers: Array<{ rgba?: unknown; audio?: unknown }> = [];
  const strippedAssets = Array.isArray(rec.assets)
    ? (rec.assets as Array<Record<string, unknown>>).map((a, idx) => {
        savedAssetBuffers[idx] = { rgba: a.rgbaBuffer, audio: a.audioSamples };
        if (a.rgbaBuffer !== undefined || a.audioSamples !== undefined) {
          return { ...a, rgbaBuffer: undefined, audioSamples: undefined };
        }
        return a;
      })
    : undefined;

  const savedArtifactData: Array<Array<unknown> | undefined> = [];
  const strippedQueue = Array.isArray(rec.renderQueue)
    ? (rec.renderQueue as Array<Record<string, unknown>>).map((job, jIdx) => {
        if (Array.isArray(job.renderedArtifacts)) {
          const arts = job.renderedArtifacts as Array<Record<string, unknown>>;
          savedArtifactData[jIdx] = arts.map((art) => art.data);
          return {
            ...job,
            renderedArtifacts: arts.map((art) => ({ ...art, data: undefined })),
          };
        }
        return job;
      })
    : undefined;

  const shellClone = structuredClone({
    ...rec,
    ...(strippedAssets !== undefined ? { assets: strippedAssets } : {}),
    ...(strippedQueue !== undefined ? { renderQueue: strippedQueue } : {}),
  });

  if (Array.isArray(shellClone.assets)) {
    (shellClone.assets as Array<Record<string, unknown>>).forEach((a, idx) => {
      const saved = savedAssetBuffers[idx];
      if (saved?.rgba !== undefined) a.rgbaBuffer = saved.rgba;
      if (saved?.audio !== undefined) a.audioSamples = saved.audio;
    });
  }
  if (Array.isArray(shellClone.renderQueue)) {
    (shellClone.renderQueue as Array<Record<string, unknown>>).forEach((job, jIdx) => {
      const savedArts = savedArtifactData[jIdx];
      if (savedArts && Array.isArray(job.renderedArtifacts)) {
        (job.renderedArtifacts as Array<Record<string, unknown>>).forEach((art, aIdx) => {
          if (savedArts[aIdx] !== undefined) art.data = savedArts[aIdx];
        });
      }
    });
  }

  return shellClone as unknown as T;
}

export class HistoryManager<T> {
  private stack: HistoryEntry<T>[] = [];
  private index = -1;
  private maxEntries: number;
  private coalesceWindowMs = 260;

  constructor(initialState: T, maxEntries = 200) {
    this.maxEntries = maxEntries;
    this.reset(initialState, 'Initial Project State');
  }

  reset(state: T, label = 'Load Project'): void {
    this.stack = [
      {
        id: `hist_${Date.now()}_0`,
        label,
        timestamp: Date.now(),
        state: cloneHistoryState(state),
      },
    ];
    this.index = 0;
  }

  setMaxEntries(max: number): void {
    this.maxEntries = Math.max(10, max);
  }

  push(nextState: T, label: string, txKey?: string): void {
    const now = Date.now();
    if (this.index < this.stack.length - 1) {
      this.stack = this.stack.slice(0, this.index + 1);
    }

    const head = this.stack[this.index];
    if (txKey && head && head.txKey === txKey && now - head.timestamp <= this.coalesceWindowMs) {
      head.state = cloneHistoryState(nextState);
      head.timestamp = now;
      head.label = label;
      return;
    }

    this.stack.push({
      id: `hist_${now}_${this.stack.length}`,
      label,
      timestamp: now,
      txKey,
      state: cloneHistoryState(nextState),
    });
    if (this.stack.length > this.maxEntries) {
      this.stack.shift();
    }
    this.index = this.stack.length - 1;
  }

  canUndo(): boolean {
    return this.index > 0;
  }

  canRedo(): boolean {
    return this.index < this.stack.length - 1;
  }

  undo(): T | null {
    if (!this.canUndo()) return null;
    this.index--;
    return cloneHistoryState(this.stack[this.index].state);
  }

  redo(): T | null {
    if (!this.canRedo()) return null;
    this.index++;
    return cloneHistoryState(this.stack[this.index].state);
  }

  jumpTo(targetIndex: number): T | null {
    if (targetIndex < 0 || targetIndex >= this.stack.length) return null;
    this.index = targetIndex;
    return cloneHistoryState(this.stack[this.index].state);
  }

  getEntries(): { entries: Array<Omit<HistoryEntry<T>, 'state'>>; currentIndex: number } {
    return {
      entries: this.stack.map(({ id, label, timestamp, txKey }) => ({ id, label, timestamp, txKey })),
      currentIndex: this.index,
    };
  }
}

export interface ProjectDiffItem {
  kind: 'added' | 'removed' | 'modified';
  scope: 'composition' | 'layer' | 'effect' | 'asset' | 'setting';
  path: string;
  before?: string;
  after?: string;
}

export function diffObjectsSummary(
  prevCompLayers: Array<{ id: string; name: string; effectsCount: number; blendMode: string }>,
  nextCompLayers: Array<{ id: string; name: string; effectsCount: number; blendMode: string }>,
): ProjectDiffItem[] {
  const diffs: ProjectDiffItem[] = [];
  const prevMap = new Map(prevCompLayers.map((l) => [l.id, l]));
  const nextMap = new Map(nextCompLayers.map((l) => [l.id, l]));

  for (const [id, nl] of nextMap) {
    const pl = prevMap.get(id);
    if (!pl) {
      diffs.push({ kind: 'added', scope: 'layer', path: nl.name, after: `${nl.blendMode} (${nl.effectsCount} fx)` });
    } else if (pl.name !== nl.name || pl.effectsCount !== nl.effectsCount || pl.blendMode !== nl.blendMode) {
      diffs.push({
        kind: 'modified',
        scope: 'layer',
        path: nl.name,
        before: `${pl.name} [${pl.blendMode}, ${pl.effectsCount} fx]`,
        after: `${nl.name} [${nl.blendMode}, ${nl.effectsCount} fx]`,
      });
    }
  }
  for (const [id, pl] of prevMap) {
    if (!nextMap.has(id)) {
      diffs.push({ kind: 'removed', scope: 'layer', path: pl.name, before: `${pl.blendMode}` });
    }
  }
  return diffs;
}
