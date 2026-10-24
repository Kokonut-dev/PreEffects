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

export interface StudioContextValue {
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
  channelView: 'rgb' | 'red' | 'green' | 'blue' | 'alpha';
  aovView: 'beauty' | 'z-depth';
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
  hasRecoverableAutosave: boolean;

  // Navigation & UI state setters
  setWhatsThisMode: (v: boolean) => void;
  setActiveHelpId: (id: string | null) => void;
  setTourStep: (step: number | null) => void;
  startInteractiveTour: () => void;
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
  setChannelView: (c: 'rgb' | 'red' | 'green' | 'blue' | 'alpha') => void;
  setAovView: (aov: 'beauty' | 'z-depth') => void;
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

  // Core Project / Comp / Layer Mutators (Undoable!)
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

function parsePcm16WavSamples(buf: ArrayBuffer): Float32Array | undefined {
  if (buf.byteLength < 44) return undefined;
  const view = new DataView(buf);
  const riff = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
  if (riff !== 'RIFF') return undefined;
  const sampleCount = Math.min(240000, Math.floor((buf.byteLength - 44) / 2));
  if (sampleCount <= 0) return undefined;
  const out = new Float32Array(sampleCount);
  for (let i = 0; i < sampleCount; i++) {
    out[i] = view.getInt16(44 + i * 2, true) / 32768;
  }
  return out;
}

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
  const [activeModal, setActiveModal] = useState<ModalId>(() => {
    try {
      return localStorage.getItem(TOUR_SEEN_KEY) ? 'none' : 'onboarding';
    } catch {
      return 'none';
    }
  });
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
      return saved ? JSON.parse(saved) : DEFAULT_SHORTCUTS;
    } catch {
      return DEFAULT_SHORTCUTS;
    }
  });
  const [resolutionDivisor, setResolutionDivisor] = useState<1 | 2 | 3 | 4>(2);
  const [channelView, setChannelView] = useState<'rgb' | 'red' | 'green' | 'blue' | 'alpha'>('rgb');
  const [aovView, setAovView] = useState<'beauty' | 'z-depth'>('beauty');
  const [zoomPct, setZoomPct] = useState<number>(100);
  const [viewportPan, setViewportPan] = useState<[number, number]>([0, 0]);
  const [showSafeZones, setShowSafeZones] = useState<boolean>(true);
  const [showGrid, setShowGrid] = useState<boolean>(false);
  const [checkerboard, setCheckerboard] = useState<boolean>(false);
  const [snapshotFrame, setSnapshotFrame] = useState<ViewportSnapshotFrame | null>(null);
  const [wipeSplit01, setWipeSplit01] = useState<number>(0);
  const [lastFrameResult, setLastFrameResult] = useState<CompositeFrameResult | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('Ready — 100% Local Studio Mode (Zero Cloud / Offline)');
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

  // Re-evaluate composite frame whenever activeComp, playhead, or view options change
  useEffect(() => {
    if (!activeComp) return;
    const effectiveDiv: 1 | 2 | 3 | 4 =
      isPlaying && preferences.adaptiveScrubResolution && resolutionDivisor < 2 ? 2 : resolutionDivisor;
    const res = renderCompositionFrame(activeComp, currentTime, project, {
      resolutionDivisor: effectiveDiv,
      channelView,
      aovPass: aovView,
      useCache: true,
    });
    setLastFrameResult(res);
  }, [activeComp, currentTime, project, resolutionDivisor, channelView, aovView, isPlaying, preferences.adaptiveScrubResolution]);

  // 60fps requestAnimationFrame playback loop bounded to Work Area (supports J/K/L reverse/forward shuttle)
  useEffect(() => {
    if (!isPlaying || !activeComp) return;
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
  }, [isPlaying, activeComp, shuttleSpeed, loopPlayback]);

  // Periodic local-only Autosave
  useEffect(() => {
    if (!preferences.autoSaveEnabled) return;
    const timer = window.setInterval(() => {
      try {
        const serialized = serializeProjectToPrex(project);
        localStorage.setItem(AUTOSAVE_KEY, serialized);
        const desk = (window as unknown as { preEffectsDesktop?: { writeAutosave?: (id: string, c: string) => Promise<unknown> } }).preEffectsDesktop;
        void desk?.writeAutosave?.(project.id, serialized);
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
    setCurrentTime(1.2);
    setHistoryVersion((v) => v + 1);
    notify(`Loaded template: ${next.name}`);
  }, [notify]);

  const openActiveComp = useCallback((compId: string) => {
    setProject((prev) => ({
      ...prev,
      activeCompId: compId,
      openCompIds: prev.openCompIds.includes(compId) ? prev.openCompIds : [...prev.openCompIds, compId],
    }));
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
  }, [commitProjectChange]);

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
    const desk = (window as unknown as {
      preEffectsDesktop?: { saveProjectDialog?: (n: string, c: string) => Promise<{ filePath: string } | null> };
    }).preEffectsDesktop;
    if (desk?.saveProjectDialog) {
      const res = await desk.saveProjectDialog(project.name || 'Project.prex', json);
      if (res?.filePath) notify(`Saved to ${res.filePath}`);
      return;
    }
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = project.name.endsWith('.prex') ? project.name : `${project.name}.prex`;
    a.click();
    URL.revokeObjectURL(url);
    notify(`Downloaded local project file "${a.download}"`);
  }, [project, notify]);

  const importLocalFileContent = useCallback((fileName: string, textOrBytes: string | ArrayBuffer) => {
    const lower = fileName.toLowerCase();
    if (lower.endsWith('.prex') || (lower.endsWith('.json') && typeof textOrBytes === 'string' && textOrBytes.includes('"compositions"'))) {
      try {
        const loaded = deserializePrexProject(typeof textOrBytes === 'string' ? textOrBytes : new TextDecoder().decode(textOrBytes));
        historyRef.current.reset(loaded);
        studioRamCache.purgeAll();
        setProject(loaded);
        setHistoryVersion((v) => v + 1);
        notify(`Opened project "${fileName}"`);
        return;
      } catch (e) {
        notify(`Invalid .prex file: ${e instanceof Error ? e.message : String(e)}`);
        return;
      }
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
    });
    notify(`Imported local asset "${fileName}" into Project Bin`);
  }, [commitProjectChange, notify]);

  // BUG-P0-04 Fix: Full binary image / PCM WAV / 3D OBJ / CSV / LUT decoder
  const importLocalFile = useCallback(async (file: File) => {
    const lower = file.name.toLowerCase();
    if (
      lower.endsWith('.prex') ||
      lower.endsWith('.json') ||
      lower.endsWith('.obj') ||
      lower.endsWith('.csv') ||
      lower.endsWith('.tsv') ||
      lower.endsWith('.cube')
    ) {
      const text = await file.text();
      importLocalFileContent(file.name, text);
      return;
    }

    if (lower.endsWith('.wav')) {
      const buf = await file.arrayBuffer();
      const samples = parsePcm16WavSamples(buf);
      const assetId = createId('ast');
      const layerId = createId('lyr');
      commitProjectChange(`Import Audio "${file.name}"`, (draft) => {
        draft.assets.push({
          id: assetId,
          name: file.name,
          folder: '02_Audio',
          kind: 'audio',
          path: file.name,
          audioSamples: samples,
          audioSampleRate: 44100,
        });
        const comp = draft.compositions.find((c) => c.id === draft.activeCompId);
        if (comp) {
          const audLayer = buildDefaultLayerForComp('audio', comp, layerId);
          audLayer.name = file.name;
          audLayer.assetId = assetId;
          comp.layers.unshift(audLayer);
        }
      });
      setSelectedLayerIds([layerId]);
      notify(`Imported local audio "${file.name}"`);
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
      notify(`Added "${file.name}" to Project Bin`);
    }
  }, [commitProjectChange, importLocalFileContent, notify]);

  const triggerImportDialog = useCallback(() => {
    globalFileInputRef.current?.click();
  }, []);

  const commitGitSnapshot = useCallback((message: string) => {
    commitProjectChange(`Version Snapshot: ${message}`, (draft) => {
      const serializedProject = serializeProjectToPrex({ ...draft, versionCommits: [] });
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
    notify(`Saved in-project Git version commit: "${message}"`);
  }, [commitProjectChange, notify]);

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
      notify(`Recovered autosaved project "${loaded.name}"`);
    } catch {
      setHasRecoverableAutosave(false);
    }
  }, [notify]);

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
    a.click();
    URL.revokeObjectURL(url);
    notify(`Exported Collect Files manifest (${pkg.referencedAssets.length} assets)`);
  }, [project, notify]);

  // Interactive Spotlight Walkthrough Helpers
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

  const startInteractiveTour = useCallback(() => {
    setActiveModal('none');
    setTourStep(0);
    notify('Interactive Walkthrough active — explore each spotlighted studio panel');
  }, [notify, setTourStep]);

  const finishInteractiveTour = useCallback(() => {
    setTourStepState(null);
    try {
      localStorage.setItem(TOUR_SEEN_KEY, '1');
    } catch { /* ignore */ }
    notify('Tutorial complete — press F1 or click Guide anytime to reopen');
  }, [notify]);

  const runGuideTryAction = useCallback((actionId: GuideTryActionId) => {
    switch (actionId) {
      case 'open-command-palette':
        setActiveModal('command-palette');
        break;
      case 'create-new-comp':
        setActiveModal('new-comp');
        break;
      case 'add-shape-layer':
        addLayerOfType('shape');
        break;
      case 'add-text-layer':
        addLayerOfType('text');
        break;
      case 'apply-glow-effect':
        applyEffectToSelectedLayer('fx-glow');
        break;
      case 'keyframe-and-ease':
        toggleKeyframeOnTransform('position');
        applyKeyframeAssistant('easy-ease');
        setBottomMode('timeline');
        break;
      case 'open-graph-editor':
        setBottomMode('graph');
        break;
      case 'open-node-dag':
        setBottomMode('nodes');
        break;
      case 'open-scopes':
        applyEffectToSelectedLayer('fx-glow');
        setRightTab('scopes');
        break;
      case 'open-tracker':
        setRightTab('tracker');
        break;
      case 'take-ab-snapshot':
        takeSnapshot();
        break;
      case 'queue-gif-render':
        addCurrentCompToRenderQueue();
        break;
    }
  }, [
    addLayerOfType,
    applyEffectToSelectedLayer,
    toggleKeyframeOnTransform,
    applyKeyframeAssistant,
    takeSnapshot,
    addCurrentCompToRenderQueue,
  ]);

  // Complete Global Keyboard Shortcut Handler (BUG-P1-01 fixed: all 38 bindings wired!)
  useEffect(() => {
    const isMac = navigator.platform.toLowerCase().includes('mac');
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inInput = Boolean(
        target &&
          (target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.tagName === 'SELECT' ||
            target.isContentEditable),
      );

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setActiveModal((m) => (m === 'command-palette' ? 'none' : 'command-palette'));
        return;
      }
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

      const hit = matchShortcutEvent(e, shortcuts, isMac);
      if (!hit) return;
      e.preventDefault();
      switch (hit.id) {
        case 'cmdPalette': setActiveModal((m) => (m === 'command-palette' ? 'none' : 'command-palette')); break;
        case 'openGuide': setActiveModal((m) => (m === 'guide' ? 'none' : 'guide')); break;
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
    shortcuts, activeModal, whatsThisMode, activeHelpId, activeComp, currentTime, isPlaying,
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
    tourStep !== null ? INTERACTIVE_TUTORIAL_STEPS[tourStep]?.spotlightRegion ?? null : null;

  void makeProp;

  const value: StudioContextValue = {
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
    hasRecoverableAutosave,
    setWhatsThisMode,
    setActiveHelpId,
    setTourStep,
    startInteractiveTour,
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
        accept=".prex,.json,.png,.jpg,.jpeg,.webp,.gif,.bmp,.svg,.obj,.csv,.tsv,.cube,.wav"
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
