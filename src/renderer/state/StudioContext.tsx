import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  AnimatableProperty,
  Composition,
  EffectInstance,
  Layer,
  LayerType,
  PaintStroke,
  Project,
  StudioPreferences,
  ToolId,
  WorkspaceId,
} from '../../engine/types';
import { buildDefaultLayerForComp, createDefaultTransform, createId, makeProp } from '../../engine/factory';
import { createShowcaseProject, DEFAULT_PREFERENCES } from '../../engine/templates';
import { HistoryManager } from '../../utils/history';
import { CompositeFrameResult, renderCompositionFrame, studioRamCache } from '../../engine/compositor';
import { ViewportSnapshotFrame } from '../../engine/webglBackend';
import { createEffectInstance, SMART_ADAPTIVE_PRESETS } from '../../effects/registry';
import { buildNodeGraphFromComp, toggleNodeBypassInComp } from '../../engine/nodeGraph';
import {
  collectProjectPackage,
  deserializePrexProject,
  importEdlToComposition,
  parseDelimitedData,
  parseObjMesh,
  serializeProjectToPrex,
} from '../../engine/serializer';
import { evaluateProperty, smartDuplicateLayers } from '../../engine/expressions';
import { applyEasyEasePreset, sequenceLayers, timeReverseKeyframes } from '../../engine/animation';
import { executeRenderQueueJob } from '../../engine/export';
import { ShortcutBinding, DEFAULT_SHORTCUTS, matchShortcutEvent } from '../../utils/shortcuts';
import { createNullsFromMaskVertices } from '../../utils/qolHelpers';
import { pickAccessibleOnAccent } from '../../utils/contrastMath';
import { GuideTryActionId, INTERACTIVE_TUTORIAL_STEPS } from '../data/studioGuideData';

export type BottomViewMode = 'timeline' | 'graph' | 'nodes' | 'render-queue';
export type LeftTabId = 'project' | 'effects' | 'library';
export type RightTabId = 'inspector' | 'scopes' | 'tracker' | 'scripting';
export type ModalId =
  | 'none'
  | 'welcome'
  | 'guide'
  | 'onboarding'
  | 'command-palette'
  | 'comp-settings'
  | 'preferences'
  | 'shortcuts'
  | 'history'
  | 'new-comp';

export type ActiveAppView = 'home' | 'studio';

export interface VaultProjectEntry {
  id: string;
  name: string;
  updatedAt: number;
  compCount: number;
  layerCount: number;
  resolutionLabel: string;
  fps: number;
  filePath?: string;
  serializedJson: string;
}

export interface DesktopAppRuntimeInfo {
  name: string;
  version: string;
  platform: string;
  arch: string;
  electronVersion: string;
  isPackaged: boolean;
  isDesktopApp: boolean;
}

export type ChannelViewId = 'rgb' | 'red' | 'green' | 'blue' | 'alpha' | 'alpha-boundary';
export type AovViewId = 'beauty' | 'z-depth' | 'normals' | 'object-id' | 'motion-vectors';

/**
 * BUG-R3-08 Fixed: Dynamic RIFF WAVE chunk parser supporting arbitrary JUNK/LIST/bext chunks,
 * 8/16/24/32-bit PCM & 32-bit IEEE Float (formatTag 1 or 3), multi-channel to mono downmix, and real sampleRate.
 */
export function parseWavPcmBuffer(ab: ArrayBuffer): { samples: Float32Array; sampleRate: number; durationSec: number } {
  if (ab.byteLength < 44) {
    return { samples: new Float32Array(0), sampleRate: 48000, durationSec: 0 };
  }
  const dv = new DataView(ab);
  const readFourCC = (off: number) =>
    String.fromCharCode(dv.getUint8(off), dv.getUint8(off + 1), dv.getUint8(off + 2), dv.getUint8(off + 3));

  if (readFourCC(0) !== 'RIFF' || readFourCC(8) !== 'WAVE') {
    const count = Math.min(262144, Math.floor(ab.byteLength / 2));
    const samples = new Float32Array(count);
    for (let i = 0; i < count; i++) samples[i] = dv.getInt16(i * 2, true) / 32768;
    return { samples, sampleRate: 44100, durationSec: count / 44100 };
  }

  let audioFormat = 1;
  let numChannels = 1;
  let sampleRate = 48000;
  let bitsPerSample = 16;
  let dataOffset = -1;
  let dataSize = 0;

  let offset = 12;
  while (offset + 8 <= ab.byteLength) {
    const chunkId = readFourCC(offset);
    const chunkSize = dv.getUint32(offset + 4, true);
    const bodyOffset = offset + 8;
    if (chunkId === 'fmt ' && chunkSize >= 16 && bodyOffset + 16 <= ab.byteLength) {
      audioFormat = dv.getUint16(bodyOffset, true);
      numChannels = Math.max(1, dv.getUint16(bodyOffset + 2, true));
      sampleRate = Math.max(8000, dv.getUint32(bodyOffset + 4, true));
      bitsPerSample = dv.getUint16(bodyOffset + 14, true);
    } else if (chunkId === 'data') {
      dataOffset = bodyOffset;
      dataSize = Math.min(chunkSize, ab.byteLength - bodyOffset);
      break;
    }
    offset = bodyOffset + chunkSize + (chunkSize & 1);
  }

  if (dataOffset < 0 || dataSize <= 0) {
    return { samples: new Float32Array(0), sampleRate, durationSec: 0 };
  }

  const bytesPerSample = Math.max(1, bitsPerSample >> 3);
  const frameStride = bytesPerSample * numChannels;
  const totalFrames = Math.floor(dataSize / frameStride);
  const cappedFrames = Math.min(totalFrames, sampleRate * 60);
  const mono = new Float32Array(cappedFrames);

  for (let f = 0; f < cappedFrames; f++) {
    let sum = 0;
    const base = dataOffset + f * frameStride;
    for (let ch = 0; ch < numChannels; ch++) {
      const p = base + ch * bytesPerSample;
      if (audioFormat === 3 && bitsPerSample === 32) {
        sum += dv.getFloat32(p, true);
      } else if (bitsPerSample === 8) {
        sum += (dv.getUint8(p) - 128) / 128;
      } else if (bitsPerSample === 16) {
        sum += dv.getInt16(p, true) / 32768;
      } else if (bitsPerSample === 24) {
        const b0 = dv.getUint8(p);
        const b1 = dv.getUint8(p + 1);
        const b2 = dv.getInt8(p + 2);
        sum += ((b2 << 16) | (b1 << 8) | b0) / 8388608;
      } else if (bitsPerSample === 32) {
        sum += dv.getInt32(p, true) / 2147483648;
      }
    }
    mono[f] = Math.max(-1, Math.min(1, sum / numChannels));
  }

  return {
    samples: mono,
    sampleRate,
    durationSec: totalFrames / sampleRate,
  };
}

export interface StudioContextValue {
  activeView: ActiveAppView;
  setActiveView: (v: ActiveAppView) => void;
  desktopAppInfo: DesktopAppRuntimeInfo;
  recentProjects: VaultProjectEntry[];
  saveCurrentToVault: (filePath?: string) => void;
  openVaultProject: (vaultId: string) => void;
  deleteVaultProject: (vaultId: string) => void;
  openProjectFileLocal: () => Promise<void>;

  project: Project;
  activeComp: Composition;
  selectedLayerIds: string[];
  selectedLayer: Layer | undefined;
  currentTime: number;
  isPlaying: boolean;
  shuttleSpeed: number;
  loopPlayback: boolean;
  activeTool: ToolId;
  activeWorkspace: WorkspaceId;
  bottomMode: BottomViewMode;
  leftTab: LeftTabId;
  rightTab: RightTabId;
  activeModal: ModalId;
  preferences: StudioPreferences;
  shortcuts: ShortcutBinding[];
  resolutionDivisor: 1 | 2 | 3 | 4;
  channelView: ChannelViewId;
  aovView: AovViewId;
  zoomPct: number;
  viewportPan: [number, number];
  showSafeZones: boolean;
  showGrid: boolean;
  checkerboard: boolean;
  snapshotFrame: ViewportSnapshotFrame | null;
  wipeSplit01: number;
  lastFrameResult: CompositeFrameResult | null;
  statusMessage: string;
  undoEntries: Array<{ id: string; label: string; timestamp: number }>;
  undoCount: number;
  historyIndex: number;
  redoCount: number;
  whatsThisMode: boolean;
  activeHelpId: string | null;
  tourStep: number | null;
  activeSpotlightRegion: 'chrome' | 'left-dock' | 'viewport' | 'right-dock' | 'bottom-dock' | null;
  completedTutorialModules: string[];
  hasRecoverableAutosave: boolean;

  setWhatsThisMode: (v: boolean) => void;
  setActiveHelpId: (id: string | null) => void;
  setTourStep: (step: number | null) => void;
  startInteractiveTour: () => void;
  startInteractiveTutorialModule: (stepIndex?: number) => void;
  markTutorialModuleCompleted: (moduleId: string) => void;
  resetTutorialProgress: () => void;
  finishInteractiveTour: () => void;
  runGuideTryAction: (actionId: GuideTryActionId) => void;
  restoreRecoverableAutosave: () => void;
  dismissRecoverableAutosave: () => void;
  createNullsFromSelectedMask: () => void;
  exportCollectFilesManifest: () => void;
  setCurrentTime: (t: number | ((prev: number) => number)) => void;
  setIsPlaying: (playing: boolean | ((p: boolean) => boolean)) => void;
  setLoopPlayback: (v: boolean) => void;
  setActiveTool: (tool: ToolId) => void;
  setActiveWorkspace: (ws: WorkspaceId) => void;
  setBottomMode: (m: BottomViewMode) => void;
  setLeftTab: (t: LeftTabId) => void;
  setRightTab: (t: RightTabId) => void;
  setActiveModal: (m: ModalId) => void;
  setSelectedLayerIds: (ids: string[]) => void;
  setResolutionDivisor: (d: 1 | 2 | 3 | 4) => void;
  setChannelView: (c: ChannelViewId) => void;
  setAovView: (aov: AovViewId) => void;
  setZoomPct: (z: number) => void;
  setViewportPan: (pan: [number, number]) => void;
  setShowSafeZones: (v: boolean) => void;
  setShowGrid: (v: boolean) => void;
  setCheckerboard: (v: boolean) => void;
  takeSnapshot: () => void;
  setWipeSplit01: (v: number) => void;
  updatePreferences: (patch: Partial<StudioPreferences>) => void;
  updateShortcuts: (next: ShortcutBinding[]) => void;
  notify: (msg: string) => void;

  commitProjectChange: (label: string, mutator: (draft: Project) => void, coalesceKey?: string) => void;
  undo: () => void;
  redo: () => void;
  jumpToHistoryIndex: (idx: number) => void;
  loadTemplateProject: (tpl: 'orbital-hero' | 'kinetic-lower-third' | 'vfx-keying' | 'blank') => void;
  openActiveComp: (compId: string) => void;
  createNewComposition: (name: string, width: number, height: number, fps: number, duration: number, bgColor?: string) => void;
  addLayerOfType: (type: LayerType, initialPos?: [number, number]) => string;
  deleteSelectedLayers: () => void;
  duplicateSelectedLayers: (smart?: boolean) => void;
  splitSelectedLayersAtPlayhead: () => void;
  precomposeSelectedLayers: (name?: string) => void;
  applyEffectToSelectedLayer: (effectId: string) => void;
  applySmartPresetToSelectedLayer: (presetId: string) => void;
  toggleKeyframeOnTransform: (propKey: keyof Layer['transform']) => void;
  applyKeyframeAssistant: (kind: 'easy-ease' | 'easy-ease-in' | 'easy-ease-out' | 'reverse' | 'sequence') => void;
  recordPaintStroke: (layerId: string, stroke: PaintStroke) => void;
  toggleNodeBypass: (nodeId: string) => void;
  addCurrentCompToRenderQueue: () => void;
  runAllQueuedRenders: () => void;
  saveProjectFileLocal: () => Promise<void>;
  importLocalFileContent: (fileName: string, textOrBytes: string | ArrayBuffer) => void;
  importLocalFile: (file: File) => Promise<void>;
  triggerImportDialog: () => void;
  commitGitSnapshot: (message: string) => void;
  purgeRamCache: () => void;
}

const StudioContext = createContext<StudioContextValue | null>(null);

const AUTOSAVE_KEY = 'preeffects.autosave.v1';
const PREFS_KEY = 'preeffects.preferences.v1';
const SHORTCUTS_KEY = 'preeffects.shortcuts.v2';
const TOUR_SEEN_KEY = 'preeffects.tour_seen.v1';
const VAULT_PROJECTS_KEY = 'preeffects.recentProjects.v1';
const TUTORIAL_COMPLETED_KEY = 'preeffects.tutorial.completed.v1';

function decodeImageFileToRgba(file: File): Promise<{ width: number; height: number; rgba: Uint8ClampedArray }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const w = Math.max(1, Math.min(4096, img.naturalWidth || img.width || 512));
        const h = Math.max(1, Math.min(4096, img.naturalHeight || img.height || 512));
        const cnv = document.createElement('canvas');
        cnv.width = w;
        cnv.height = h;
        const ctx = cnv.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(url);
          reject(new Error('Canvas2D context unavailable'));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        const data = ctx.getImageData(0, 0, w, h).data;
        URL.revokeObjectURL(url);
        resolve({ width: w, height: h, rgba: new Uint8ClampedArray(data) });
      } catch (err) {
        URL.revokeObjectURL(url);
        reject(err);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Image decode failed'));
    };
    img.src = url;
  });
}

export const StudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const initialProject = useMemo(() => createShowcaseProject('orbital-hero'), []);
  const historyRef = useRef(new HistoryManager<Project>(initialProject, 200));
  const globalFileInputRef = useRef<HTMLInputElement | null>(null);

  const [activeView, setActiveViewState] = useState<ActiveAppView>('home');
  const [desktopAppInfo, setDesktopAppInfo] = useState<DesktopAppRuntimeInfo>({
    name: 'PreEffects',
    version: '1.1.0',
    platform: typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform) ? 'darwin' : 'web',
    arch: 'arm64',
    electronVersion: '',
    isPackaged: false,
    isDesktopApp: typeof window !== 'undefined' && Boolean(window.preEffectsDesktop?.isDesktopApp),
  });

  const [recentProjects, setRecentProjects] = useState<VaultProjectEntry[]>(() => {
    try {
      const raw = localStorage.getItem(VAULT_PROJECTS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch { /* ignore */ }
    return [];
  });

  const [completedTutorialModules, setCompletedTutorialModules] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(TUTORIAL_COMPLETED_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch { /* ignore */ }
    return [];
  });

  const [project, setProject] = useState<Project>(initialProject);
  const [selectedLayerIds, setSelectedLayerIds] = useState<string[]>(['lyr_hero_title']);
  const [currentTime, setCurrentTime] = useState<number>(1.8);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [shuttleSpeed, setShuttleSpeed] = useState<number>(1);
  const [loopPlayback, setLoopPlayback] = useState<boolean>(true);
  const [activeTool, setActiveTool] = useState<ToolId>('selection');
  const [activeWorkspace, setActiveWorkspaceState] = useState<WorkspaceId>('standard');
  const [bottomMode, setBottomMode] = useState<BottomViewMode>('timeline');
  const [leftTab, setLeftTab] = useState<LeftTabId>('project');
  const [rightTab, setRightTab] = useState<RightTabId>('inspector');
  const [activeModal, setActiveModal] = useState<ModalId>('none');

  const [preferences, setPreferences] = useState<StudioPreferences>(() => {
    try {
      const saved = localStorage.getItem(PREFS_KEY);
      return saved ? { ...DEFAULT_PREFERENCES, ...JSON.parse(saved) } : DEFAULT_PREFERENCES;
    } catch {
      return DEFAULT_PREFERENCES;
    }
  });
  const [shortcuts, setShortcutsState] = useState<ShortcutBinding[]>(() => {
    try {
      const saved = localStorage.getItem(SHORTCUTS_KEY);
      if (saved) {
        const parsed: ShortcutBinding[] = JSON.parse(saved);
        const merged = [...DEFAULT_SHORTCUTS];
        for (const s of parsed) {
          const idx = merged.findIndex((d) => d.id === s.id);
          if (idx >= 0) merged[idx] = s;
        }
        return merged;
      }
    } catch { /* ignore */ }
    return DEFAULT_SHORTCUTS;
  });

  const [resolutionDivisor, setResolutionDivisor] = useState<1 | 2 | 3 | 4>(2);
  const [channelView, setChannelView] = useState<ChannelViewId>('rgb');
  const [aovView, setAovView] = useState<AovViewId>('beauty');
  const [zoomPct, setZoomPct] = useState<number>(100);
  const [viewportPan, setViewportPan] = useState<[number, number]>([0, 0]);
  const [showSafeZones, setShowSafeZones] = useState<boolean>(true);
  const [showGrid, setShowGrid] = useState<boolean>(false);
  const [checkerboard, setCheckerboard] = useState<boolean>(false);
  const [snapshotFrame, setSnapshotFrame] = useState<ViewportSnapshotFrame | null>(null);
  const [wipeSplit01, setWipeSplit01] = useState<number>(0);
  const [lastFrameResult, setLastFrameResult] = useState<CompositeFrameResult | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('Ready — 100% Local Studio Mode · Home (Alt+H) · Handbook (F1)');
  const [historyVersion, setHistoryVersion] = useState(0);
  const [whatsThisMode, setWhatsThisMode] = useState<boolean>(false);
  const [activeHelpId, setActiveHelpId] = useState<string | null>(null);
  const [tourStep, setTourStepState] = useState<number | null>(null);
  const [hasRecoverableAutosave, setHasRecoverableAutosave] = useState<boolean>(() => {
    try {
      return Boolean(localStorage.getItem(AUTOSAVE_KEY));
    } catch {
      return false;
    }
  });

  const activeComp = useMemo(
    () => project.compositions.find((c) => c.id === project.activeCompId) ?? project.compositions[0],
    [project],
  );

  const selectedLayer = useMemo(
    () => activeComp?.layers.find((l) => l.id === selectedLayerIds[0]),
    [activeComp, selectedLayerIds],
  );

  // Query desktop Electron runtime metadata (app version, OS, arch, packaging state)
  useEffect(() => {
    if (window.preEffectsDesktop?.getAppInfo) {
      window.preEffectsDesktop
        .getAppInfo()
        .then((info: Omit<DesktopAppRuntimeInfo, 'isDesktopApp'>) => {
          setDesktopAppInfo({
            ...info,
            isDesktopApp: true,
          });
        })
        .catch(() => { /* ignore */ });
    }
  }, []);

  // Sync theme attribute & mathematically verified custom accent contrast on document root
  useEffect(() => {
    const resolvedTheme =
      preferences.theme === 'light'
        ? 'light'
        : preferences.theme === 'high-contrast'
        ? 'high-contrast'
        : preferences.theme === 'graphite'
        ? 'graphite'
        : 'dark';
    document.documentElement.setAttribute('data-theme', resolvedTheme);
    document.documentElement.style.fontSize = `${(preferences.uiScalePct / 100) * 12}px`;
    if (preferences.theme === 'custom' && preferences.customThemeTokens) {
      for (const [k, v] of Object.entries(preferences.customThemeTokens)) {
        document.documentElement.style.setProperty(k, v);
      }
      const accentHex =
        preferences.customThemeTokens['--accent-amber'] ||
        preferences.customThemeTokens['--accent-primary'] ||
        '#f5a524';
      const onPrimary = pickAccessibleOnAccent(accentHex);
      document.documentElement.style.setProperty('--accent-amber', accentHex);
      document.documentElement.style.setProperty('--accent-on-primary', onPrimary);
    } else {
      document.documentElement.style.removeProperty('--accent-amber');
      document.documentElement.style.removeProperty('--accent-amber-hover');
      document.documentElement.style.removeProperty('--accent-on-primary');
      document.documentElement.style.removeProperty('--bg-panel');
    }
  }, [preferences.theme, preferences.uiScalePct, preferences.customThemeTokens]);

  const notify = useCallback((msg: string) => {
    setStatusMessage(msg);
  }, []);

  const setActiveView = useCallback((v: ActiveAppView) => {
    if (v === 'home') {
      setIsPlaying(false);
    } else {
      try {
        localStorage.setItem(TOUR_SEEN_KEY, '1');
      } catch { /* ignore */ }
    }
    setActiveViewState(v);
  }, []);

  // Save/update project inside the Local Project Vault (100% local offline persistence)
  const saveCurrentToVault = useCallback(
    (filePath?: string) => {
      try {
        const comp = project.compositions.find((c) => c.id === project.activeCompId) ?? project.compositions[0];
        const totalLayers = project.compositions.reduce((s, c) => s + c.layers.length, 0);
        const serializedJson = serializeProjectToPrex(project, { lightweightStorage: true });
        const entry: VaultProjectEntry = {
          id: project.id,
          name: project.name,
          updatedAt: Date.now(),
          compCount: project.compositions.length,
          layerCount: totalLayers,
          resolutionLabel: comp ? `${comp.width}×${comp.height}` : '1920×1080',
          fps: comp?.fps ?? 30,
          filePath,
          serializedJson,
        };
        setRecentProjects((prev) => {
          const filtered = prev.filter((p) => p.id !== entry.id && p.name !== entry.name);
          const next = [entry, ...filtered].slice(0, 8);
          try {
            localStorage.setItem(VAULT_PROJECTS_KEY, JSON.stringify(next));
          } catch { /* quota safe */ }
          return next;
        });
      } catch { /* ignore */ }
    },
    [project],
  );

  const openVaultProject = useCallback(
    (vaultId: string) => {
      const target = recentProjects.find((p) => p.id === vaultId);
      if (!target) return;
      try {
        const loaded = deserializePrexProject(target.serializedJson);
        historyRef.current.reset(loaded, `Open "${loaded.name}"`);
        studioRamCache.purgeAll();
        setProject(loaded);
        const firstComp = loaded.compositions.find((c) => c.id === loaded.activeCompId) ?? loaded.compositions[0];
        setSelectedLayerIds(firstComp?.layers[0] ? [firstComp.layers[0].id] : []);
        setCurrentTime(0);
        setHistoryVersion((v) => v + 1);
        setActiveView('studio');
        notify(`Opened project "${loaded.name}" from Local Vault`);
      } catch (err) {
        notify(`Could not open vault project: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
    [recentProjects, setActiveView, notify],
  );

  const deleteVaultProject = useCallback(
    (vaultId: string) => {
      setRecentProjects((prev) => {
        const next = prev.filter((p) => p.id !== vaultId);
        try {
          localStorage.setItem(VAULT_PROJECTS_KEY, JSON.stringify(next));
        } catch { /* ignore */ }
        return next;
      });
      notify('Removed project from Local Vault');
    },
    [notify],
  );

  const markTutorialModuleCompleted = useCallback((moduleId: string) => {
    setCompletedTutorialModules((prev) => {
      if (prev.includes(moduleId)) return prev;
      const next = [...prev, moduleId];
      try {
        localStorage.setItem(TUTORIAL_COMPLETED_KEY, JSON.stringify(next));
      } catch { /* ignore */ }
      return next;
    });
  }, []);

  const resetTutorialProgress = useCallback(() => {
    setCompletedTutorialModules([]);
    try {
      localStorage.removeItem(TUTORIAL_COMPLETED_KEY);
    } catch { /* ignore */ }
    notify('Reset interactive tutorial completion progress');
  }, [notify]);

  // OPT-R3-06 & BUG-R3-13: Render active frame ONLY when in Studio view (0% idle CPU on Home Hub) + pass transparentBackground
  useEffect(() => {
    if (!activeComp || activeView === 'home') return;
    const effectiveDiv: 1 | 2 | 3 | 4 =
      isPlaying && preferences.adaptiveScrubResolution && resolutionDivisor < 2 ? 2 : resolutionDivisor;
    const res = renderCompositionFrame(activeComp, currentTime, project, {
      resolutionDivisor: effectiveDiv,
      channelView,
      aovPass: aovView,
      transparentBackground: checkerboard,
      useCache: true,
    });
    setLastFrameResult(res);
  }, [
    activeComp,
    activeView,
    currentTime,
    project,
    resolutionDivisor,
    channelView,
    aovView,
    checkerboard,
    isPlaying,
    preferences.adaptiveScrubResolution,
  ]);

  // 60fps requestAnimationFrame playback loop bounded to Work Area (paused automatically on Home Hub)
  useEffect(() => {
    if (!isPlaying || !activeComp || activeView === 'home') return;
    let rafId = 0;
    let prevTs = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - prevTs) / 1000);
      prevTs = now;
      setCurrentTime((t) => {
        const next = t + dt * shuttleSpeed;
        const start = activeComp.workAreaStart;
        const end = Math.max(start + 0.1, activeComp.workAreaEnd || activeComp.duration);
        if (shuttleSpeed >= 0 && next > end) {
          if (loopPlayback) return start;
          setIsPlaying(false);
          return end;
        }
        if (shuttleSpeed < 0 && next < start) {
          if (loopPlayback) return end;
          setIsPlaying(false);
          return start;
        }
        return next;
      });
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, activeComp, shuttleSpeed, loopPlayback, activeView]);

  // Periodic local-only Autosave (lightweight storage safe)
  useEffect(() => {
    if (!preferences.autoSaveEnabled) return;
    const timer = window.setInterval(() => {
      try {
        const serialized = serializeProjectToPrex(project, { lightweightStorage: true });
        localStorage.setItem(AUTOSAVE_KEY, serialized);
        void window.preEffectsDesktop?.writeAutosaveSnapshot?.(project.id, serialized);
      } catch {
        // Quota full or private browsing — ignore silently
      }
    }, Math.max(15, preferences.autoSaveIntervalSec) * 1000);
    return () => window.clearInterval(timer);
  }, [project, preferences.autoSaveEnabled, preferences.autoSaveIntervalSec]);

  const commitProjectChange = useCallback((label: string, mutator: (draft: Project) => void, coalesceKey?: string) => {
    setProject((prev) => {
      const draft: Project = {
        ...prev,
        assets: prev.assets.map((a) => ({ ...a })),
        openCompIds: [...prev.openCompIds],
        compositions: structuredClone(prev.compositions),
        renderQueue: structuredClone(prev.renderQueue),
        favoriteEffectIds: [...prev.favoriteEffectIds],
        versionCommits: prev.versionCommits.map((c) => ({ ...c })),
      };
      mutator(draft);
      const activeOnly = draft.compositions.find((c) => c.id === draft.activeCompId);
      if (activeOnly) {
        activeOnly.nodeGraph = buildNodeGraphFromComp(activeOnly);
      }
      historyRef.current.push(draft, label, coalesceKey);
      setHistoryVersion((v) => v + 1);
      return draft;
    });
  }, []);

  const undo = useCallback(() => {
    const prev = historyRef.current.undo();
    if (prev) {
      setProject(prev);
      setHistoryVersion((v) => v + 1);
      notify('Undo applied');
    }
  }, [notify]);

  const redo = useCallback(() => {
    const next = historyRef.current.redo();
    if (next) {
      setProject(next);
      setHistoryVersion((v) => v + 1);
      notify('Redo applied');
    }
  }, [notify]);

  const jumpToHistoryIndex = useCallback((idx: number) => {
    const state = historyRef.current.jumpTo(idx);
    if (state) {
      setProject(state);
      setHistoryVersion((v) => v + 1);
    }
  }, []);

  const setActiveWorkspace = useCallback((ws: WorkspaceId) => {
    setActiveWorkspaceState(ws);
    if (ws === 'animation') setBottomMode('graph');
    else if (ws === 'effects') { setBottomMode('nodes'); setLeftTab('effects'); }
    else if (ws === 'color') { setRightTab('scopes'); setBottomMode('timeline'); }
    else if (ws === 'tracking') { setRightTab('tracker'); setBottomMode('timeline'); }
    else if (ws === 'paint') { setActiveTool('brush'); setBottomMode('timeline'); }
    else if (ws === 'text') { setActiveTool('text'); setRightTab('inspector'); }
    else setBottomMode('timeline');
  }, []);

  const updatePreferences = useCallback((patch: Partial<StudioPreferences>) => {
    setPreferences((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(PREFS_KEY, JSON.stringify(next));
      } catch { /* ignore */ }
      if (patch.maxRamCacheMb) studioRamCache.setMaxMegabytes(patch.maxRamCacheMb);
      return next;
    });
  }, []);

  const updateShortcuts = useCallback((next: ShortcutBinding[]) => {
    setShortcutsState(next);
    try {
      localStorage.setItem(SHORTCUTS_KEY, JSON.stringify(next));
    } catch { /* ignore */ }
  }, []);

  const takeSnapshot = useCallback(() => {
    if (lastFrameResult) {
      setSnapshotFrame({
        pixels: new Uint8ClampedArray(lastFrameResult.pixels),
        width: lastFrameResult.width,
        height: lastFrameResult.height,
      });
      setWipeSplit01((prev) => (prev < 0.05 ? 0.5 : prev));
      notify(`Viewport Snapshot captured (${lastFrameResult.width}×${lastFrameResult.height}) — drag A/B split slider to compare`);
    }
  }, [lastFrameResult, notify]);

  const loadTemplateProject = useCallback((tpl: 'orbital-hero' | 'kinetic-lower-third' | 'vfx-keying' | 'blank') => {
    const next = createShowcaseProject(tpl);
    historyRef.current.reset(next);
    studioRamCache.purgeAll();
    setProject(next);
    setSelectedLayerIds(next.compositions[0]?.layers[0] ? [next.compositions[0].layers[0].id] : []);
    setCurrentTime(tpl === 'blank' ? 0 : 1.2);
    setHistoryVersion((v) => v + 1);
    setActiveView('studio');
    notify(`Loaded template: ${next.name}`);
  }, [setActiveView, notify]);

  // BUG-R3-09 Fixed: Clamp playhead and select valid layer when switching active compositions
  const openActiveComp = useCallback((compId: string) => {
    setProject((prev) => {
      const targetComp = prev.compositions.find((c) => c.id === compId);
      if (targetComp) {
        setCurrentTime((t) => Math.max(0, Math.min(targetComp.duration, t)));
        setSelectedLayerIds((sel) => {
          const valid = sel.filter((id) => targetComp.layers.some((l) => l.id === id));
          return valid.length > 0 ? valid : targetComp.layers[0] ? [targetComp.layers[0].id] : [];
        });
      }
      return {
        ...prev,
        activeCompId: compId,
        openCompIds: prev.openCompIds.includes(compId) ? prev.openCompIds : [...prev.openCompIds, compId],
      };
    });
  }, []);

  const createNewComposition = useCallback((name: string, width: number, height: number, fps: number, duration: number, bgColor = '#0B0C0E') => {
    const newId = createId('comp');
    commitProjectChange(`New Composition "${name}"`, (draft) => {
      const c: Composition = {
        id: newId,
        name,
        width,
        height,
        pixelAspect: 1,
        fps,
        duration,
        backgroundColor: bgColor,
        workAreaStart: 0,
        workAreaEnd: duration,
        hideShyLayers: false,
        motionBlurEnabled: false,
        shutterAngle: 180,
        shutterPhase: -90,
        frameBlendingEnabled: false,
        renderer3D: 'classic-3d',
        markers: [],
        layers: [],
      };
      draft.compositions.push(c);
      draft.activeCompId = newId;
      draft.openCompIds.push(newId);
    });
    setCurrentTime(0);
    setSelectedLayerIds([]);
    setActiveView('studio');
  }, [commitProjectChange, setActiveView]);

  const addLayerOfType = useCallback((type: LayerType, initialPos?: [number, number]): string => {
    if (!activeComp) return '';
    const newId = createId('lyr');
    commitProjectChange(`Add ${type.toUpperCase()} Layer`, (draft) => {
      const comp = draft.compositions.find((c) => c.id === draft.activeCompId);
      if (!comp) return;
      const layer = buildDefaultLayerForComp(type, comp, newId);
      if (initialPos) {
        layer.transform.position.value = [Math.round(initialPos[0]), Math.round(initialPos[1]), layer.transform.position.value[2]];
      }
      comp.layers.unshift(layer);
    });
    setSelectedLayerIds([newId]);
    notify(`Created ${type} layer`);
    return newId;
  }, [activeComp, commitProjectChange, notify]);

  const deleteSelectedLayers = useCallback(() => {
    if (selectedLayerIds.length === 0) return;
    commitProjectChange('Delete Selected Layer(s)', (draft) => {
      const comp = draft.compositions.find((c) => c.id === draft.activeCompId);
      if (!comp) return;
      comp.layers = comp.layers.filter((l) => !selectedLayerIds.includes(l.id) || l.locked);
    });
    setSelectedLayerIds([]);
    notify('Deleted selected layer(s)');
  }, [selectedLayerIds, commitProjectChange, notify]);

  const duplicateSelectedLayers = useCallback((smart = false) => {
    if (selectedLayerIds.length === 0) return;
    commitProjectChange(smart ? 'Smart Duplicate Hierarchy' : 'Duplicate Layer(s)', (draft) => {
      const comp = draft.compositions.find((c) => c.id === draft.activeCompId);
      if (!comp) return;
      if (smart) {
        const selectedObjs = comp.layers.filter((l) => selectedLayerIds.includes(l.id));
        const clones = smartDuplicateLayers(selectedObjs);
        comp.layers.unshift(...clones);
      } else {
        const clones = comp.layers
          .filter((l) => selectedLayerIds.includes(l.id))
          .map((l) => ({ ...structuredClone(l), id: createId('lyr'), name: `${l.name} Copy` }));
        comp.layers.unshift(...clones);
      }
    });
    notify(smart ? 'Smart Duplicated hierarchy with relinked expressions' : 'Duplicated selected layer(s)');
  }, [selectedLayerIds, commitProjectChange, notify]);

  const splitSelectedLayersAtPlayhead = useCallback(() => {
    if (selectedLayerIds.length === 0) return;
    commitProjectChange('Split Layer at Playhead', (draft) => {
      const comp = draft.compositions.find((c) => c.id === draft.activeCompId);
      if (!comp) return;
      const nextLayers: Layer[] = [];
      for (const l of comp.layers) {
        if (selectedLayerIds.includes(l.id) && currentTime > l.inPoint + 0.02 && currentTime < l.outPoint - 0.02) {
          const upperHalf: Layer = { ...structuredClone(l), id: createId('lyr'), name: `${l.name} [Part 2]`, inPoint: currentTime };
          const lowerHalf: Layer = { ...l, outPoint: currentTime };
          nextLayers.push(upperHalf, lowerHalf);
        } else {
          nextLayers.push(l);
        }
      }
      comp.layers = nextLayers;
    });
    notify('Split layer at current time indicator');
  }, [selectedLayerIds, currentTime, commitProjectChange, notify]);

  const precomposeSelectedLayers = useCallback((customName?: string) => {
    if (selectedLayerIds.length === 0 || !activeComp) return;
    const preId = createId('comp');
    const preName = customName || `Precomp_${project.compositions.length + 1}_${selectedLayerIds.length}L`;
    commitProjectChange(`Pre-compose "${preName}"`, (draft) => {
      const comp = draft.compositions.find((c) => c.id === draft.activeCompId);
      if (!comp) return;
      const extracted = comp.layers.filter((l) => selectedLayerIds.includes(l.id));
      if (extracted.length === 0) return;
      const subComp: Composition = {
        ...structuredClone(comp),
        id: preId,
        name: preName,
        layers: extracted,
      };
      draft.compositions.push(subComp);
      const preLayer: Layer = {
        id: createId('lyr'),
        name: preName,
        type: 'precomp',
        precompId: preId,
        labelColor: '#B49BFF',
        visible: true,
        audioEnabled: true,
        solo: false,
        locked: false,
        shy: false,
        collapseTransformations: true,
        frameBlending: 'off',
        motionBlur: false,
        threeD: false,
        inPoint: Math.min(...extracted.map((e) => e.inPoint)),
        outPoint: Math.max(...extracted.map((e) => e.outPoint)),
        startTime: 0,
        stretchPct: 100,
        blendMode: 'normal',
        trackMatteMode: 'none',
        transform: createDefaultTransform(comp.width / 2, comp.height / 2, comp.width / 2, comp.height / 2),
        masks: [],
        effects: [],
        paintStrokes: [],
        puppetPins: [],
        markers: [],
      };
      comp.layers = [preLayer, ...comp.layers.filter((l) => !selectedLayerIds.includes(l.id))];
    });
    notify(`Pre-composed ${selectedLayerIds.length} layer(s) into "${preName}"`);
  }, [selectedLayerIds, activeComp, project.compositions.length, commitProjectChange, notify]);

  const applyEffectToSelectedLayer = useCallback((effectId: string) => {
    const targetLayer = selectedLayer ?? activeComp?.layers[0];
    if (!targetLayer) {
      notify('Add or select a layer first to apply an effect');
      return;
    }
    const inst: EffectInstance = createEffectInstance(effectId);
    commitProjectChange(`Apply Effect "${inst.name}"`, (draft) => {
      const comp = draft.compositions.find((c) => c.id === draft.activeCompId);
      const lyr = comp?.layers.find((l) => l.id === targetLayer.id);
      if (lyr) lyr.effects.push(inst);
    });
    setSelectedLayerIds([targetLayer.id]);
    setRightTab('inspector');
    notify(`Applied "${inst.name}" to ${targetLayer.name}`);
  }, [selectedLayer, activeComp, commitProjectChange, notify]);

  const applySmartPresetToSelectedLayer = useCallback((presetId: string) => {
    const preset = SMART_ADAPTIVE_PRESETS.find((p) => p.id === presetId);
    const targetLayer = selectedLayer ?? activeComp?.layers[0];
    if (!preset || !targetLayer || !activeComp) return;
    commitProjectChange(`Apply Smart Preset "${preset.name}"`, (draft) => {
      const comp = draft.compositions.find((c) => c.id === draft.activeCompId);
      const lyr = comp?.layers.find((l) => l.id === targetLayer.id);
      if (!lyr || !comp) return;
      lyr.effects.push(...preset.applyToCompScale(comp.width, comp.height));
    });
    setSelectedLayerIds([targetLayer.id]);
    setRightTab('inspector');
    notify(`Applied Smart Adaptive Preset "${preset.name}" (scaled to ${activeComp.width}×${activeComp.height})`);
  }, [selectedLayer, activeComp, commitProjectChange, notify]);

  const toggleKeyframeOnTransform = useCallback((propKey: keyof Layer['transform']) => {
    if (!selectedLayer || !activeComp) return;
    if (propKey === 'orientation') return;
    commitProjectChange(`Keyframe ${propKey}`, (draft) => {
      const comp = draft.compositions.find((c) => c.id === draft.activeCompId);
      const lyr = comp?.layers.find((l) => l.id === selectedLayer.id);
      if (!lyr || !comp) return;
      const prop = lyr.transform[propKey] as AnimatableProperty<number | [number, number, number]>;
      const existingIdx = prop.keyframes.findIndex((k) => Math.abs(k.time - currentTime) < 0.02);
      if (existingIdx >= 0) {
        prop.keyframes.splice(existingIdx, 1);
        if (prop.keyframes.length === 0) prop.animated = false;
      } else {
        const curVal = evaluateProperty(prop, currentTime, lyr, comp, draft).value;
        prop.animated = true;
        prop.keyframes.push({
          id: createId('kf'),
          time: Number(currentTime.toFixed(3)),
          value: structuredClone(curVal),
          interpolation: 'bezier',
          inInfluence: 0.5,
          outInfluence: 0.5,
        });
        prop.keyframes.sort((a, b) => a.time - b.time);
      }
    });
  }, [selectedLayer, activeComp, currentTime, commitProjectChange]);

  const applyKeyframeAssistant = useCallback((kind: 'easy-ease' | 'easy-ease-in' | 'easy-ease-out' | 'reverse' | 'sequence') => {
    commitProjectChange(`Keyframe Assistant: ${kind}`, (draft) => {
      const comp = draft.compositions.find((c) => c.id === draft.activeCompId);
      if (!comp) return;
      if (kind === 'sequence') {
        const sequenced = sequenceLayers(comp.layers.filter((l) => selectedLayerIds.includes(l.id)), 0.25);
        const byId = new Map(sequenced.map((l) => [l.id, l]));
        comp.layers = comp.layers.map((l) => byId.get(l.id) ?? l);
        return;
      }
      for (const lyr of comp.layers) {
        if (!selectedLayerIds.includes(lyr.id)) continue;
        const mode = kind === 'easy-ease-in' ? 'ease-in' : kind === 'easy-ease-out' ? 'ease-out' : 'easy-ease';
        if (lyr.transform.position.keyframes.length > 0) {
          lyr.transform.position = kind === 'reverse'
            ? timeReverseKeyframes(lyr.transform.position)
            : applyEasyEasePreset(lyr.transform.position, mode);
        }
        if (lyr.transform.scale.keyframes.length > 0) {
          lyr.transform.scale = kind === 'reverse'
            ? timeReverseKeyframes(lyr.transform.scale)
            : applyEasyEasePreset(lyr.transform.scale, mode);
        }
        if (lyr.transform.rotationZ.keyframes.length > 0) {
          lyr.transform.rotationZ = kind === 'reverse'
            ? timeReverseKeyframes(lyr.transform.rotationZ)
            : applyEasyEasePreset(lyr.transform.rotationZ, mode);
        }
        if (lyr.transform.opacity.keyframes.length > 0) {
          lyr.transform.opacity = kind === 'reverse'
            ? timeReverseKeyframes(lyr.transform.opacity)
            : applyEasyEasePreset(lyr.transform.opacity, mode);
        }
      }
    });
    notify(`Applied Keyframe Assistant (${kind})`);
  }, [selectedLayerIds, commitProjectChange, notify]);

  const recordPaintStroke = useCallback((layerId: string, stroke: PaintStroke) => {
    commitProjectChange(`Paint ${stroke.tool} Stroke`, (draft) => {
      const comp = draft.compositions.find((c) => c.id === draft.activeCompId);
      const lyr = comp?.layers.find((l) => l.id === layerId);
      if (lyr) lyr.paintStrokes.push(stroke);
    });
  }, [commitProjectChange]);

  const toggleNodeBypass = useCallback((nodeId: string) => {
    commitProjectChange('Toggle Node Bypass', (draft) => {
      const idx = draft.compositions.findIndex((c) => c.id === draft.activeCompId);
      if (idx >= 0) {
        draft.compositions[idx] = toggleNodeBypassInComp(draft.compositions[idx], nodeId);
      }
    });
  }, [commitProjectChange]);

  const addCurrentCompToRenderQueue = useCallback(() => {
    if (!activeComp) return;
    commitProjectChange('Add Composition to Render Queue', (draft) => {
      draft.renderQueue.push({
        id: createId('rq'),
        compId: activeComp.id,
        status: 'queued',
        quality: 'best',
        resolutionDivisor: 4,
        useProxies: false,
        startFrame: Math.round(activeComp.workAreaStart * activeComp.fps),
        endFrame: Math.min(Math.round(activeComp.workAreaStart * activeComp.fps) + 15, Math.round(activeComp.workAreaEnd * activeComp.fps)),
        progressPct: 0,
        elapsedMs: 0,
        outputModules: [
          {
            id: createId('om'),
            format: 'gif',
            channels: 'rgba',
            includeAudio: false,
            aovPasses: ['beauty', 'z-depth'],
            outputName: activeComp.name.replace(/\s+/g, '_'),
          },
        ],
      });
    });
    setBottomMode('render-queue');
    notify(`Added "${activeComp.name}" to Render Queue`);
  }, [activeComp, commitProjectChange, notify]);

  const runAllQueuedRenders = useCallback(() => {
    commitProjectChange('Execute Render Queue', (draft) => {
      draft.renderQueue = draft.renderQueue.map((item) =>
        item.status === 'queued' || item.status === 'failed'
          ? executeRenderQueueJob(item, draft)
          : item,
      );
    });
    notify('Render Queue batch finished — click Download on any output module');
  }, [commitProjectChange, notify]);

  const saveProjectFileLocal = useCallback(async () => {
    const json = serializeProjectToPrex(project);
    const defaultName = project.name.endsWith('.prex') ? project.name : `${project.name}.prex`;
    if (window.preEffectsDesktop?.saveProjectDialog) {
      const res = await window.preEffectsDesktop.saveProjectDialog(defaultName, json);
      if (!res.canceled && res.filePath) {
        saveCurrentToVault(res.filePath);
        notify(`Saved to ${res.filePath}`);
      }
      return;
    }
    saveCurrentToVault();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = defaultName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    notify(`Downloaded local project file "${a.download}"`);
  }, [project, saveCurrentToVault, notify]);

  const importLocalFileContent = useCallback((fileName: string, textOrBytes: string | ArrayBuffer) => {
    const lower = fileName.toLowerCase();
    if (lower.endsWith('.prex') || (lower.endsWith('.json') && typeof textOrBytes === 'string' && textOrBytes.includes('"compositions"'))) {
      try {
        const loaded = deserializePrexProject(typeof textOrBytes === 'string' ? textOrBytes : new TextDecoder().decode(textOrBytes));
        historyRef.current.reset(loaded);
        studioRamCache.purgeAll();
        setProject(loaded);
        const firstComp = loaded.compositions.find((c) => c.id === loaded.activeCompId) ?? loaded.compositions[0];
        setSelectedLayerIds(firstComp?.layers[0] ? [firstComp.layers[0].id] : []);
        setCurrentTime(0);
        setHistoryVersion((v) => v + 1);
        setActiveView('studio');
        notify(`Opened project "${fileName}"`);
        return;
      } catch (e) {
        notify(`Invalid .prex file: ${e instanceof Error ? e.message : String(e)}`);
        return;
      }
    }

    if (lower.endsWith('.edl')) {
      const asEdl = typeof textOrBytes === 'string' ? textOrBytes : new TextDecoder().decode(textOrBytes);
      const edlComp = importEdlToComposition(asEdl, 24);
      commitProjectChange(`Import EDL "${fileName}"`, (draft) => {
        draft.compositions.push(edlComp);
        draft.activeCompId = edlComp.id;
        draft.openCompIds.push(edlComp.id);
      });
      setActiveView('studio');
      notify(`Imported EDL timeline "${fileName}"`);
      return;
    }

    if (lower.endsWith('.wav') && textOrBytes instanceof ArrayBuffer) {
      const parsed = parseWavPcmBuffer(textOrBytes);
      const assetId = createId('ast');
      const layerId = createId('lyr');
      commitProjectChange(`Import Audio "${fileName}"`, (draft) => {
        draft.assets.push({
          id: assetId,
          name: fileName,
          folder: '02_Audio',
          kind: 'audio',
          path: fileName,
          audioSamples: parsed.samples,
          audioSampleRate: parsed.sampleRate,
          duration: parsed.durationSec || 5,
        });
        const comp = draft.compositions.find((c) => c.id === draft.activeCompId);
        if (comp) {
          const audLayer = buildDefaultLayerForComp('audio', comp, layerId);
          audLayer.name = fileName;
          audLayer.assetId = assetId;
          comp.layers.unshift(audLayer);
        }
      });
      setSelectedLayerIds([layerId]);
      setActiveView('studio');
      notify(`Imported local audio "${fileName}" (${parsed.sampleRate} Hz)`);
      return;
    }

    const asText = typeof textOrBytes === 'string' ? textOrBytes : new TextDecoder().decode(textOrBytes);
    const parsedMesh = lower.endsWith('.obj') ? parseObjMesh(asText) : undefined;
    const parsedData = lower.endsWith('.csv') ? parseDelimitedData(asText, ',') : lower.endsWith('.tsv') ? parseDelimitedData(asText, '\t') : undefined;
    const kind = lower.endsWith('.obj')
      ? 'mesh3d'
      : lower.endsWith('.wav') || lower.endsWith('.mp3')
      ? 'audio'
      : lower.endsWith('.csv') || lower.endsWith('.tsv')
      ? 'data'
      : lower.endsWith('.cube')
      ? 'lut'
      : 'image';

    const assetId = createId('ast');
    commitProjectChange(`Import Asset "${fileName}"`, (draft) => {
      draft.assets.push({
        id: assetId,
        name: fileName,
        folder: '01_Imported',
        kind,
        path: fileName,
        mesh3D: parsedMesh,
        structuredData: parsedData,
        cubeLutText: kind === 'lut' ? asText : undefined,
      });
      if (parsedMesh) {
        const comp = draft.compositions.find((c) => c.id === draft.activeCompId);
        if (comp) {
          const meshLyr = buildDefaultLayerForComp('footage', comp, createId('lyr'));
          meshLyr.name = fileName;
          meshLyr.assetId = assetId;
          meshLyr.threeD = true;
          comp.layers.unshift(meshLyr);
        }
      }
    });
    setActiveView('studio');
    notify(`Imported local asset "${fileName}" into Project Bin`);
  }, [commitProjectChange, setActiveView, notify]);

  const importLocalFile = useCallback(async (file: File) => {
    const lower = file.name.toLowerCase();
    if (
      lower.endsWith('.prex') ||
      lower.endsWith('.json') ||
      lower.endsWith('.obj') ||
      lower.endsWith('.csv') ||
      lower.endsWith('.tsv') ||
      lower.endsWith('.cube') ||
      lower.endsWith('.edl')
    ) {
      const text = await file.text();
      importLocalFileContent(file.name, text);
      return;
    }

    if (lower.endsWith('.wav')) {
      const buf = await file.arrayBuffer();
      importLocalFileContent(file.name, buf);
      return;
    }

    try {
      const decoded = await decodeImageFileToRgba(file);
      const assetId = createId('ast');
      const layerId = createId('lyr');
      commitProjectChange(`Import Image "${file.name}" (${decoded.width}×${decoded.height})`, (draft) => {
        draft.assets.push({
          id: assetId,
          name: file.name,
          folder: '01_Footage',
          kind: 'image',
          path: file.name,
          width: decoded.width,
          height: decoded.height,
          rgbaBuffer: decoded.rgba,
        });
        const comp = draft.compositions.find((c) => c.id === draft.activeCompId);
        if (comp) {
          const lyr = buildDefaultLayerForComp('footage', comp, layerId);
          lyr.name = file.name.replace(/\.[^.]+$/, '');
          lyr.assetId = assetId;
          comp.layers.unshift(lyr);
        }
      });
      setSelectedLayerIds([layerId]);
      setActiveView('studio');
      notify(`Imported image "${file.name}" (${decoded.width}×${decoded.height}) onto stage`);
    } catch {
      commitProjectChange(`Import Asset "${file.name}"`, (draft) => {
        draft.assets.push({
          id: createId('ast'),
          name: file.name,
          folder: '01_Imported',
          kind: 'image',
          path: file.name,
        });
      });
      setActiveView('studio');
      notify(`Added "${file.name}" to Project Bin`);
    }
  }, [commitProjectChange, importLocalFileContent, setActiveView, notify]);

  const triggerImportDialog = useCallback(() => {
    globalFileInputRef.current?.click();
  }, []);

  // BUG-R3-04 Fixed: Open local .prex project via native Electron file dialog on desktop, or file input on web
  const openProjectFileLocal = useCallback(async () => {
    if (window.preEffectsDesktop?.openProjectDialog) {
      const res = await window.preEffectsDesktop.openProjectDialog();
      if (!res.canceled && res.content) {
        const fileName = res.filePath.split(/[/\\]/).pop() || 'Project.prex';
        importLocalFileContent(fileName, res.content);
      }
      return;
    }
    globalFileInputRef.current?.click();
  }, [importLocalFileContent]);

  const commitGitSnapshot = useCallback((message: string) => {
    commitProjectChange(`Version Snapshot: ${message}`, (draft) => {
      const serializedProject = serializeProjectToPrex({ ...draft, versionCommits: [] }, { lightweightStorage: true });
      const active = draft.compositions.find((c) => c.id === draft.activeCompId) ?? draft.compositions[0];
      draft.versionCommits.unshift({
        id: createId('git'),
        timestamp: Date.now(),
        message: message || `Snapshot @ ${new Date().toISOString().slice(11, 19)}`,
        compSummary: (active?.layers ?? []).map((l) => ({
          id: l.id,
          name: l.name,
          effectsCount: l.effects.length,
          blendMode: l.blendMode,
        })),
        serializedProject,
      });
    });
    saveCurrentToVault();
    notify(`Saved in-project Git version commit: "${message}"`);
  }, [commitProjectChange, saveCurrentToVault, notify]);

  const purgeRamCache = useCallback(() => {
    studioRamCache.purgeAll();
    notify('Purged RAM Preview Cache');
  }, [notify]);

  const restoreRecoverableAutosave = useCallback(() => {
    try {
      const raw = localStorage.getItem(AUTOSAVE_KEY);
      if (!raw) return;
      const loaded = deserializePrexProject(raw);
      historyRef.current.reset(loaded, 'Recovered Autosave');
      studioRamCache.purgeAll();
      setProject(loaded);
      setHasRecoverableAutosave(false);
      setHistoryVersion((v) => v + 1);
      setActiveView('studio');
      notify(`Recovered autosaved project "${loaded.name}"`);
    } catch {
      setHasRecoverableAutosave(false);
    }
  }, [setActiveView, notify]);

  const dismissRecoverableAutosave = useCallback(() => {
    setHasRecoverableAutosave(false);
  }, []);

  const createNullsFromSelectedMask = useCallback(() => {
    if (!selectedLayer || !activeComp) return;
    commitProjectChange('Create Nulls From Mask Path', (draft) => {
      const comp = draft.compositions.find((c) => c.id === draft.activeCompId);
      if (!comp) return;
      const nulls = createNullsFromMaskVertices(comp, selectedLayer.id);
      comp.layers.unshift(...nulls);
    });
    notify(`Created Null rig controllers from "${selectedLayer.name}" mask vertices`);
  }, [selectedLayer, activeComp, commitProjectChange, notify]);

  const exportCollectFilesManifest = useCallback(() => {
    const pkg = collectProjectPackage(project);
    const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name.replace(/\s+/g, '_')}_CollectFiles_Manifest.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    notify(`Exported Collect Files manifest (${pkg.referencedAssets.length} assets)`);
  }, [project, notify]);

  // Interactive 10-Module Feature Tutorial Helpers
  const setTourStep = useCallback((step: number | null) => {
    setTourStepState(step);
    if (step !== null) {
      const def = INTERACTIVE_TUTORIAL_STEPS[step];
      if (def) {
        if (activeWorkspace === 'minimal') setActiveWorkspaceState('standard');
        if (def.autoFocusLeft) setLeftTab(def.autoFocusLeft);
        if (def.autoFocusRight) setRightTab(def.autoFocusRight);
        if (def.autoFocusBottom) setBottomMode(def.autoFocusBottom);
      }
    }
  }, [activeWorkspace]);

  const startInteractiveTutorialModule = useCallback(
    (stepIndex = 0) => {
      try {
        localStorage.setItem(TOUR_SEEN_KEY, '1');
      } catch { /* ignore */ }
      const clamped = Math.max(0, Math.min(INTERACTIVE_TUTORIAL_STEPS.length - 1, stepIndex));
      setActiveModal('none');
      setActiveView('studio');
      setTourStep(clamped);
      const mod = INTERACTIVE_TUTORIAL_STEPS[clamped];
      notify(`Tutorial ${mod.badge}: ${mod.title}`);
    },
    [setActiveView, setTourStep, notify],
  );

  const startInteractiveTour = useCallback(() => {
    startInteractiveTutorialModule(0);
  }, [startInteractiveTutorialModule]);

  const finishInteractiveTour = useCallback(() => {
    setTourStepState(null);
    try {
      localStorage.setItem(TOUR_SEEN_KEY, '1');
    } catch { /* ignore */ }
    notify('Tutorial paused — reopen anytime from Home (Alt+H), Tutorial button, or F2');
  }, [notify]);

  // Automatic Live Hands-On Challenge Completion Detector
  useEffect(() => {
    if (tourStep === null || activeView !== 'studio') return;
    const step = INTERACTIVE_TUTORIAL_STEPS[tourStep];
    if (!step) return;
    const layers = activeComp?.layers ?? [];
    let accomplished = false;
    switch (step.moduleId) {
      case 'mod-viewport-stage':
        accomplished = Boolean(snapshotFrame) || showGrid || checkerboard || channelView !== 'rgb' || aovView !== 'beauty';
        break;
      case 'mod-layers-blending':
        accomplished = layers.length > 4 || layers.some((l) => l.trackMatteMode !== 'none');
        break;
      case 'mod-keyframes-curves':
        accomplished = bottomMode === 'graph';
        break;
      case 'mod-expressions-rigging':
        accomplished = layers.some(
          (l) =>
            Boolean(l.transform.position.expressionEnabled && l.transform.position.expression) ||
            Boolean(l.transform.rotationZ.expressionEnabled && l.transform.rotationZ.expression) ||
            Boolean(l.transform.scale.expressionEnabled && l.transform.scale.expression),
        );
        break;
      case 'mod-effects-scopes':
        accomplished = rightTab === 'scopes' || layers.reduce((s, l) => s + l.effects.length, 0) >= 3;
        break;
      case 'mod-shapes-typography':
        accomplished = layers.some(
          (l) => (l.shapeContent?.operators.length ?? 0) > 1 || (l.textData?.animators.length ?? 0) > 0,
        );
        break;
      case 'mod-masks-paint-puppet':
        accomplished = layers.some((l) => l.masks.length > 0 || l.paintStrokes.length > 0 || l.puppetPins.length > 0);
        break;
      case 'mod-tracking-roto-fill':
        accomplished = layers.some(
          (l) =>
            Boolean(l.rotoMatteEnabled) ||
            l.name.includes('Track Null') ||
            l.name.includes('Clean Plate') ||
            l.effects.some((fx) => fx.effectId === 'warp-stabilizer-vfx'),
        );
        break;
      case 'mod-nodes-3d-stage':
        accomplished = bottomMode === 'nodes' || layers.some((l) => l.type === 'camera' || l.type === 'light');
        break;
      case 'mod-audio-script-render':
        accomplished = project.renderQueue.length > 0 || project.versionCommits.length > 0;
        break;
    }
    if (accomplished) {
      markTutorialModuleCompleted(step.moduleId);
    }
  }, [
    tourStep,
    activeView,
    activeComp,
    snapshotFrame,
    showGrid,
    checkerboard,
    channelView,
    aovView,
    bottomMode,
    rightTab,
    project.renderQueue.length,
    project.versionCommits.length,
    markTutorialModuleCompleted,
  ]);

  const runGuideTryAction = useCallback(
    (actionId: GuideTryActionId) => {
      setActiveView('studio');
      const matchingStep = INTERACTIVE_TUTORIAL_STEPS.find((s) => s.tryActionId === actionId);
      if (matchingStep) markTutorialModuleCompleted(matchingStep.moduleId);

      switch (actionId) {
        case 'open-command-palette':
          setActiveModal('command-palette');
          break;
        case 'create-new-comp':
          setActiveModal('new-comp');
          break;
        case 'add-shape-layer':
          addLayerOfType('shape');
          setRightTab('inspector');
          break;
        case 'add-text-layer':
          addLayerOfType('text');
          setRightTab('inspector');
          break;
        case 'apply-glow-effect':
          applyEffectToSelectedLayer('glow');
          break;
        case 'keyframe-and-ease':
          toggleKeyframeOnTransform('position');
          applyKeyframeAssistant('easy-ease');
          setBottomMode('graph');
          break;
        case 'open-graph-editor':
          setBottomMode('graph');
          break;
        case 'apply-wiggle-expression': {
          const targetId = selectedLayerIds[0] ?? activeComp?.layers[0]?.id;
          if (targetId) {
            commitProjectChange('Apply Wiggle Expression Demo', (draft) => {
              const lyr = draft.compositions.find((c) => c.id === draft.activeCompId)?.layers.find((l) => l.id === targetId);
              if (lyr) {
                lyr.transform.position.expression = 'wiggle(2.5, 22)';
                lyr.transform.position.expressionEnabled = true;
              }
            });
            setLeftTab('library');
            setBottomMode('timeline');
            notify('Applied live expression wiggle(2.5, 22) — press Space to preview motion!');
          }
          break;
        }
        case 'add-trim-paths-operator': {
          const shapeId = addLayerOfType('shape');
          if (shapeId) {
            commitProjectChange('Add Trim Paths + Repeater Demo', (draft) => {
              const lyr = draft.compositions.find((c) => c.id === draft.activeCompId)?.layers.find((l) => l.id === shapeId);
              if (lyr?.shapeContent) {
                lyr.shapeContent.kind = 'polystar';
                lyr.shapeContent.operators.push(
                  { id: createId('sop'), type: 'trim-paths', enabled: true, params: { start: 8, end: 82, offset: 15 } },
                  { id: createId('sop'), type: 'repeater', enabled: true, params: { copies: 4, rotation: 30 } },
                );
              }
            });
            setRightTab('inspector');
            notify('Created Polystar Vector Shape with Trim Paths + Repeater operators');
          }
          break;
        }
        case 'create-mask-and-stroke': {
          const targetId = selectedLayerIds[0] ?? activeComp?.layers[0]?.id;
          if (targetId && activeComp) {
            const cx = activeComp.width * 0.5;
            const cy = activeComp.height * 0.5;
            commitProjectChange('Add Feathered Bezier Mask & Write-On Stroke', (draft) => {
              const lyr = draft.compositions.find((c) => c.id === draft.activeCompId)?.layers.find((l) => l.id === targetId);
              if (lyr) {
                lyr.masks.push({
                  id: createId('mask'),
                  name: 'Feathered Spotlight Mask',
                  mode: 'add',
                  inverted: false,
                  locked: false,
                  rotoBezier: true,
                  closed: true,
                  feather: 18,
                  opacity: 100,
                  expansion: 0,
                  vertices: [
                    { x: cx - 320, y: cy - 180, inX: 0, inY: 0, outX: 0, outY: 0 },
                    { x: cx + 320, y: cy - 180, inX: 0, inY: 0, outX: 0, outY: 0 },
                    { x: cx + 320, y: cy + 180, inX: 0, inY: 0, outX: 0, outY: 0 },
                    { x: cx - 320, y: cy + 180, inX: 0, inY: 0, outX: 0, outY: 0 },
                  ],
                });
                lyr.paintStrokes.push({
                  id: createId('stk'),
                  tool: 'brush',
                  color: '#F5A524',
                  radius: 14,
                  hardness: 85,
                  opacity: 100,
                  durationMode: 'constant',
                  startTime: 0,
                  duration: Math.max(1, activeComp.duration),
                  points: [
                    [cx - 220, cy + 140],
                    [cx, cy + 115],
                    [cx + 220, cy + 140],
                  ],
                });
              }
            });
            setRightTab('inspector');
            notify('Added feathered Bezier Mask + live Brush accent stroke');
          }
          break;
        }
        case 'enable-3d-camera-rig':
          addLayerOfType('camera');
          setBottomMode('nodes');
          notify('Added 35mm Depth-of-Field 3D Camera & opened Bidirectional Node DAG');
          break;
        case 'open-node-dag':
          setBottomMode('nodes');
          break;
        case 'open-scopes':
          applyEffectToSelectedLayer('glow');
          setRightTab('scopes');
          break;
        case 'open-tracker':
          setRightTab('tracker');
          applyEffectToSelectedLayer('warp-stabilizer-vfx');
          break;
        case 'take-ab-snapshot':
          takeSnapshot();
          break;
        case 'queue-gif-render':
          addCurrentCompToRenderQueue();
          break;
      }
    },
    [
      setActiveView,
      markTutorialModuleCompleted,
      addLayerOfType,
      applyEffectToSelectedLayer,
      toggleKeyframeOnTransform,
      applyKeyframeAssistant,
      selectedLayerIds,
      activeComp,
      commitProjectChange,
      takeSnapshot,
      addCurrentCompToRenderQueue,
      notify,
    ],
  );

  // BUG-R3-04 Fixed: Subscribe to Native Electron Menu IPC actions
  useEffect(() => {
    if (!window.preEffectsDesktop?.onMenuAction) return;
    return window.preEffectsDesktop.onMenuAction((action: string) => {
      switch (action) {
        case 'view.home':
          setActiveViewState((v) => {
            if (v === 'studio') setIsPlaying(false);
            return v === 'home' ? 'studio' : 'home';
          });
          break;
        case 'file.new':
          loadTemplateProject('blank');
          break;
        case 'file.open':
          void openProjectFileLocal();
          break;
        case 'file.save':
          void saveProjectFileLocal();
          break;
        case 'edit.undo':
          undo();
          break;
        case 'edit.redo':
          redo();
          break;
        case 'comp.new':
          setActiveView('studio');
          setActiveModal('new-comp');
          break;
        case 'comp.addToQueue':
          setActiveView('studio');
          addCurrentCompToRenderQueue();
          break;
        case 'help.tutorial':
          startInteractiveTutorialModule(0);
          break;
        case 'help.guide':
          setActiveView('studio');
          setActiveModal('guide');
          break;
      }
    });
  }, [
    loadTemplateProject,
    openProjectFileLocal,
    saveProjectFileLocal,
    undo,
    redo,
    setActiveView,
    addCurrentCompToRenderQueue,
    startInteractiveTutorialModule,
  ]);

  // Global Customisable Keyboard Shortcut Dispatcher
  useEffect(() => {
    const isMac = /Mac|iPhone|iPad/i.test(navigator.platform);
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const inInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target as HTMLElement)?.isContentEditable;

      if (e.key === 'Escape') {
        if (activeModal !== 'none') {
          setActiveModal('none');
          return;
        }
        if (whatsThisMode || activeHelpId) {
          setWhatsThisMode(false);
          setActiveHelpId(null);
          return;
        }
      }
      if (!inInput && e.key === '?' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setActiveModal((m) => (m === 'guide' ? 'none' : 'guide'));
        return;
      }
      if (inInput) return;

      const hit = matchShortcutEvent(e, shortcuts, isMac);
      if (hit?.id === 'goHome') {
        e.preventDefault();
        setActiveView(activeView === 'home' ? 'studio' : 'home');
        return;
      }
      if (hit?.id === 'openTutorial') {
        e.preventDefault();
        startInteractiveTutorialModule(tourStep ?? 0);
        return;
      }
      if (hit?.id === 'openGuide') {
        e.preventDefault();
        setActiveModal((m) => (m === 'guide' ? 'none' : 'guide'));
        return;
      }
      if (hit?.id === 'cmdPalette') {
        e.preventDefault();
        setActiveModal((m) => (m === 'command-palette' ? 'none' : 'command-palette'));
        return;
      }

      if (activeView === 'home') return;

      if (e.key === 'Delete' && !e.ctrlKey && !e.metaKey && activeModal === 'none') {
        e.preventDefault();
        deleteSelectedLayers();
        return;
      }

      if (!e.ctrlKey && !e.metaKey && e.shiftKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight') && activeComp) {
        e.preventDefault();
        const dt = (e.key === 'ArrowRight' ? 10 : -10) / activeComp.fps;
        setCurrentTime((t) => Math.max(0, Math.min(activeComp.duration, t + dt)));
        return;
      }

      if (!hit) return;
      e.preventDefault();
      switch (hit.id) {
        case 'playPause': setShuttleSpeed(1); setIsPlaying((p) => !p); break;
        case 'shuttleRev': setShuttleSpeed(-1); setIsPlaying(true); break;
        case 'shuttleStop': setIsPlaying(false); setShuttleSpeed(1); break;
        case 'shuttleFwd': setShuttleSpeed((prev) => (isPlaying && prev > 0 ? Math.min(4, prev * 2) : 1)); setIsPlaying(true); break;
        case 'stepPrev':
          setIsPlaying(false);
          if (activeComp) setCurrentTime((t) => Math.max(0, t - 1 / activeComp.fps));
          break;
        case 'stepNext':
          setIsPlaying(false);
          if (activeComp) setCurrentTime((t) => Math.min(activeComp.duration, t + 1 / activeComp.fps));
          break;
        case 'goStart': setCurrentTime(0); break;
        case 'goEnd': if (activeComp) setCurrentTime(activeComp.duration); break;
        case 'setWorkIn':
          commitProjectChange('Set Work Area Start', (draft) => {
            const c = draft.compositions.find((x) => x.id === draft.activeCompId);
            if (c) c.workAreaStart = Math.min(currentTime, c.workAreaEnd - 1 / c.fps);
          });
          break;
        case 'setWorkOut':
          commitProjectChange('Set Work Area End', (draft) => {
            const c = draft.compositions.find((x) => x.id === draft.activeCompId);
            if (c) c.workAreaEnd = Math.max(currentTime, c.workAreaStart + 1 / c.fps);
          });
          break;
        case 'undo': undo(); break;
        case 'redo': redo(); break;
        case 'deleteLayer': deleteSelectedLayers(); break;
        case 'saveProject': void saveProjectFileLocal(); break;
        case 'importAsset': triggerImportDialog(); break;
        case 'newComp': setActiveModal('new-comp'); break;
        case 'newSolid': addLayerOfType('solid'); break;
        case 'newAdjustment': addLayerOfType('adjustment'); break;
        case 'toolSelect': setActiveTool('selection'); break;
        case 'toolHand': setActiveTool('hand'); break;
        case 'toolZoom': setActiveTool('zoom'); break;
        case 'toolRotate': setActiveTool('rotate'); break;
        case 'toolCamera': setActiveTool('camera'); break;
        case 'toolAnchor': setActiveTool('anchor'); break;
        case 'toolShape': setActiveTool('shape-rect'); break;
        case 'toolPen': setActiveTool('pen'); break;
        case 'toolText': setActiveTool('text'); break;
        case 'toolBrush': setActiveTool('brush'); break;
        case 'toolClone': setActiveTool('clone'); break;
        case 'toolEraser': setActiveTool('eraser'); break;
        case 'toolRoto': setActiveTool('roto-brush'); break;
        case 'toolPuppet': setActiveTool('puppet-pin'); break;
        case 'splitLayer': splitSelectedLayersAtPlayhead(); break;
        case 'duplicateLayer': duplicateSelectedLayers(false); break;
        case 'smartDuplicate': duplicateSelectedLayers(true); break;
        case 'precompose': precomposeSelectedLayers(); break;
        case 'easyEase': applyKeyframeAssistant('easy-ease'); break;
        case 'revealKeyframes': setBottomMode((m) => (m === 'graph' ? 'timeline' : 'graph')); break;
        case 'revealPos': toggleKeyframeOnTransform('position'); break;
        case 'revealScale': toggleKeyframeOnTransform('scale'); break;
        case 'revealRot': toggleKeyframeOnTransform('rotationZ'); break;
        case 'revealOpacity': toggleKeyframeOnTransform('opacity'); break;
        case 'toggleNodeView': setBottomMode((m) => (m === 'nodes' ? 'timeline' : 'nodes')); break;
        case 'addRenderQueue': addCurrentCompToRenderQueue(); break;
        case 'whatsThis': setWhatsThisMode((w) => !w); break;
        case 'takeSnapshot': takeSnapshot(); break;
        case 'toggleWipe': setWipeSplit01((w) => (w > 0.02 ? 0 : 0.5)); break;
        case 'maximizePanel': setActiveWorkspaceState((w) => (w === 'minimal' ? 'standard' : 'minimal')); break;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    shortcuts, activeView, activeModal, whatsThisMode, activeHelpId, activeComp, currentTime, isPlaying, tourStep,
    setActiveView, startInteractiveTutorialModule,
    undo, redo, deleteSelectedLayers, saveProjectFileLocal, triggerImportDialog, addLayerOfType,
    splitSelectedLayersAtPlayhead, duplicateSelectedLayers, precomposeSelectedLayers,
    applyKeyframeAssistant, toggleKeyframeOnTransform, addCurrentCompToRenderQueue, takeSnapshot,
    commitProjectChange,
  ]);

  const { undoEntries, undoCount, historyIndex, redoCount } = useMemo(() => {
    void historyVersion;
    const { entries, currentIndex } = historyRef.current.getEntries();
    return {
      undoEntries: entries.slice(0, currentIndex + 1),
      undoCount: Math.max(0, currentIndex),
      historyIndex: currentIndex,
      redoCount: Math.max(0, entries.length - 1 - currentIndex),
    };
  }, [historyVersion]);

  const activeSpotlightRegion =
    tourStep !== null && activeView === 'studio' ? INTERACTIVE_TUTORIAL_STEPS[tourStep]?.spotlightRegion ?? null : null;

  void makeProp;

  const value: StudioContextValue = {
    activeView,
    setActiveView,
    desktopAppInfo,
    recentProjects,
    saveCurrentToVault,
    openVaultProject,
    deleteVaultProject,
    openProjectFileLocal,
    project,
    activeComp,
    selectedLayerIds,
    selectedLayer,
    currentTime,
    isPlaying,
    shuttleSpeed,
    loopPlayback,
    activeTool,
    activeWorkspace,
    bottomMode,
    leftTab,
    rightTab,
    activeModal,
    preferences,
    shortcuts,
    resolutionDivisor,
    channelView,
    aovView,
    zoomPct,
    viewportPan,
    showSafeZones,
    showGrid,
    checkerboard,
    snapshotFrame,
    wipeSplit01,
    lastFrameResult,
    statusMessage,
    undoEntries,
    undoCount,
    historyIndex,
    redoCount,
    whatsThisMode,
    activeHelpId,
    tourStep,
    activeSpotlightRegion,
    completedTutorialModules,
    hasRecoverableAutosave,
    setWhatsThisMode,
    setActiveHelpId,
    setTourStep,
    startInteractiveTour,
    startInteractiveTutorialModule,
    markTutorialModuleCompleted,
    resetTutorialProgress,
    finishInteractiveTour,
    runGuideTryAction,
    restoreRecoverableAutosave,
    dismissRecoverableAutosave,
    createNullsFromSelectedMask,
    exportCollectFilesManifest,
    setCurrentTime,
    setIsPlaying,
    setLoopPlayback,
    setActiveTool,
    setActiveWorkspace,
    setBottomMode,
    setLeftTab,
    setRightTab,
    setActiveModal,
    setSelectedLayerIds,
    setResolutionDivisor,
    setChannelView,
    setAovView,
    setZoomPct,
    setViewportPan,
    setShowSafeZones,
    setShowGrid,
    setCheckerboard,
    takeSnapshot,
    setWipeSplit01,
    updatePreferences,
    updateShortcuts,
    notify,
    commitProjectChange,
    undo,
    redo,
    jumpToHistoryIndex,
    loadTemplateProject,
    openActiveComp,
    createNewComposition,
    addLayerOfType,
    deleteSelectedLayers,
    duplicateSelectedLayers,
    splitSelectedLayersAtPlayhead,
    precomposeSelectedLayers,
    applyEffectToSelectedLayer,
    applySmartPresetToSelectedLayer,
    toggleKeyframeOnTransform,
    applyKeyframeAssistant,
    recordPaintStroke,
    toggleNodeBypass,
    addCurrentCompToRenderQueue,
    runAllQueuedRenders,
    saveProjectFileLocal,
    importLocalFileContent,
    importLocalFile,
    triggerImportDialog,
    commitGitSnapshot,
    purgeRamCache,
  };

  return (
    <StudioContext.Provider value={value}>
      <input
        ref={globalFileInputRef}
        type="file"
        style={{ display: 'none' }}
        accept=".prex,.json,.png,.jpg,.jpeg,.webp,.gif,.bmp,.svg,.obj,.csv,.tsv,.cube,.wav,.edl"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (f) await importLocalFile(f);
          e.target.value = '';
        }}
      />
      {children}
    </StudioContext.Provider>
  );
};

export function useStudio(): StudioContextValue {
  const ctx = useContext(StudioContext);
  if (!ctx) throw new Error('useStudio must be used within StudioProvider');
  return ctx;
}
