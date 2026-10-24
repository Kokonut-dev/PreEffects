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
import { createEffectInstance, SMART_ADAPTIVE_PRESETS } from '../../effects/registry';
import { buildNodeGraphFromComp, toggleNodeBypassInComp } from '../../engine/nodeGraph';
import { deserializePrexProject, serializeProjectToPrex } from '../../engine/serializer';
import { evaluateProperty, smartDuplicateLayers } from '../../engine/expressions';
import { applyEasyEasePreset, sequenceLayers, timeReverseKeyframes } from '../../engine/animation';
import { executeRenderQueueJob } from '../../engine/export';
import { ShortcutBinding, DEFAULT_SHORTCUTS, matchShortcutEvent } from '../../utils/shortcuts';
import { createNullsFromMaskVertices } from '../../utils/qolHelpers';
import { collectProjectPackage } from '../../engine/serializer';

export type BottomViewMode = 'timeline' | 'graph' | 'nodes' | 'render-queue';
export type LeftTabId = 'project' | 'effects' | 'library';
export type RightTabId = 'inspector' | 'scopes' | 'tracker' | 'scripting';
export type ModalId = 'none' | 'welcome' | 'command-palette' | 'comp-settings' | 'preferences' | 'history' | 'new-comp';

export interface StudioContextValue {
  project: Project;
  activeComp: Composition;
  selectedLayerIds: string[];
  selectedLayer: Layer | undefined;
  currentTime: number;
  isPlaying: boolean;
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
  zoomPct: number;
  showSafeZones: boolean;
  showGrid: boolean;
  checkerboard: boolean;
  snapshotBuffer: Uint8ClampedArray | null;
  wipeSplit01: number;
  lastFrameResult: CompositeFrameResult | null;
  statusMessage: string;
  undoEntries: Array<{ id: string; label: string; timestamp: number }>;
  redoCount: number;
  whatsThisMode: boolean;
  activeHelpId: string | null;
  tourStep: number | null;
  hasRecoverableAutosave: boolean;

  // Navigation & UI state setters
  setWhatsThisMode: (v: boolean) => void;
  setActiveHelpId: (id: string | null) => void;
  setTourStep: (step: number | null) => void;
  restoreRecoverableAutosave: () => void;
  dismissRecoverableAutosave: () => void;
  createNullsFromSelectedMask: () => void;
  exportCollectFilesManifest: () => void;
  setCurrentTime: (t: number | ((prev: number) => number)) => void;
  setIsPlaying: (playing: boolean | ((p: boolean) => boolean)) => void;
  setActiveTool: (tool: ToolId) => void;
  setActiveWorkspace: (ws: WorkspaceId) => void;
  setBottomMode: (m: BottomViewMode) => void;
  setLeftTab: (t: LeftTabId) => void;
  setRightTab: (t: RightTabId) => void;
  setActiveModal: (m: ModalId) => void;
  setSelectedLayerIds: (ids: string[]) => void;
  setResolutionDivisor: (d: 1 | 2 | 3 | 4) => void;
  setChannelView: (c: 'rgb' | 'red' | 'green' | 'blue' | 'alpha') => void;
  setZoomPct: (z: number) => void;
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
  createNewComposition: (name: string, width: number, height: number, fps: number, duration: number) => void;
  addLayerOfType: (type: LayerType) => void;
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
  commitGitSnapshot: (message: string) => void;
  purgeRamCache: () => void;
}

const StudioContext = createContext<StudioContextValue | null>(null);

const AUTOSAVE_KEY = 'preeffects.autosave.v1';
const PREFS_KEY = 'preeffects.preferences.v1';

export const StudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const initialProject = useMemo(() => createShowcaseProject('orbital-hero'), []);
  const historyRef = useRef(new HistoryManager<Project>(initialProject, 200));

  const [project, setProject] = useState<Project>(initialProject);
  const [selectedLayerIds, setSelectedLayerIds] = useState<string[]>(['lyr_hero_title']);
  const [currentTime, setCurrentTime] = useState<number>(1.8);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
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
  const [shortcuts, setShortcuts] = useState<ShortcutBinding[]>(DEFAULT_SHORTCUTS);
  const [resolutionDivisor, setResolutionDivisor] = useState<1 | 2 | 3 | 4>(2);
  const [channelView, setChannelView] = useState<'rgb' | 'red' | 'green' | 'blue' | 'alpha'>('rgb');
  const [zoomPct, setZoomPct] = useState<number>(100);
  const [showSafeZones, setShowSafeZones] = useState<boolean>(true);
  const [showGrid, setShowGrid] = useState<boolean>(false);
  const [checkerboard, setCheckerboard] = useState<boolean>(false);
  const [snapshotBuffer, setSnapshotBuffer] = useState<Uint8ClampedArray | null>(null);
  const [wipeSplit01, setWipeSplit01] = useState<number>(0);
  const [lastFrameResult, setLastFrameResult] = useState<CompositeFrameResult | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('Ready — 100% Local Studio Mode (Zero Cloud / Offline)');
  const [historyVersion, setHistoryVersion] = useState(0);
  const [whatsThisMode, setWhatsThisMode] = useState<boolean>(false);
  const [activeHelpId, setActiveHelpId] = useState<string | null>(null);
  const [tourStep, setTourStep] = useState<number | null>(null);
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

  // Sync theme attribute & optional custom CSS tokens on document root
  useEffect(() => {
    const resolvedTheme =
      preferences.theme === 'light'
        ? 'light'
        : preferences.theme === 'high-contrast'
          ? 'high-contrast'
          : 'dark';
    document.documentElement.setAttribute('data-theme', resolvedTheme);
    document.documentElement.style.fontSize = `${(preferences.uiScalePct / 100) * 12}px`;
    if (preferences.theme === 'custom' && preferences.customThemeTokens) {
      for (const [k, v] of Object.entries(preferences.customThemeTokens)) {
        document.documentElement.style.setProperty(k, v);
      }
    } else {
      document.documentElement.style.removeProperty('--accent-amber');
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
      useCache: true,
    });
    setLastFrameResult(res);
  }, [activeComp, currentTime, project, resolutionDivisor, channelView, isPlaying, preferences.adaptiveScrubResolution]);

  // 60fps requestAnimationFrame playback loop bounded to Work Area
  useEffect(() => {
    if (!isPlaying || !activeComp) return;
    let rafId = 0;
    let prevTs = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - prevTs) / 1000);
      prevTs = now;
      setCurrentTime((t) => {
        const next = t + dt;
        const start = activeComp.workAreaStart;
        const end = Math.max(start + 0.1, activeComp.workAreaEnd || activeComp.duration);
        return next > end ? start : next;
      });
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, activeComp]);

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
      // Copy-on-write clone: preserve large TypedArray asset buffers across slider/timeline edits
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

  const updateShortcuts = useCallback((next: ShortcutBinding[]) => setShortcuts(next), []);

  const takeSnapshot = useCallback(() => {
    if (lastFrameResult) {
      setSnapshotBuffer(new Uint8ClampedArray(lastFrameResult.pixels));
      setWipeSplit01((prev) => (prev < 0.05 ? 0.5 : prev));
      notify('Viewport Snapshot captured — drag A/B split slider to compare');
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

  const createNewComposition = useCallback((name: string, width: number, height: number, fps: number, duration: number) => {
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
        backgroundColor: '#0B0F19',
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

  const addLayerOfType = useCallback((type: LayerType) => {
    if (!activeComp) return;
    const newId = createId('lyr');
    commitProjectChange(`Add ${type.toUpperCase()} Layer`, (draft) => {
      const comp = draft.compositions.find((c) => c.id === draft.activeCompId);
      if (!comp) return;
      comp.layers.unshift(buildDefaultLayerForComp(type, comp, newId));
    });
    setSelectedLayerIds([newId]);
    notify(`Created ${type} layer`);
  }, [activeComp, commitProjectChange, notify]);

  const deleteSelectedLayers = useCallback(() => {
    if (selectedLayerIds.length === 0) return;
    commitProjectChange('Delete Selected Layer(s)', (draft) => {
      const comp = draft.compositions.find((c) => c.id === draft.activeCompId);
      if (!comp) return;
      comp.layers = comp.layers.filter((l) => !selectedLayerIds.includes(l.id) || l.locked);
    });
    setSelectedLayerIds([]);
  }, [selectedLayerIds, commitProjectChange]);

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
        labelColor: '#4C8BF5',
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
  }, [selectedLayerIds, activeComp, commitProjectChange, notify]);

  const applyEffectToSelectedLayer = useCallback((effectId: string) => {
    if (!selectedLayer) {
      notify('Select a layer first to apply an effect');
      return;
    }
    const inst: EffectInstance = createEffectInstance(effectId);
    commitProjectChange(`Apply Effect "${inst.name}"`, (draft) => {
      const comp = draft.compositions.find((c) => c.id === draft.activeCompId);
      const lyr = comp?.layers.find((l) => l.id === selectedLayer.id);
      if (lyr) lyr.effects.push(inst);
    });
    setRightTab('inspector');
    notify(`Applied "${inst.name}" to ${selectedLayer.name}`);
  }, [selectedLayer, commitProjectChange, notify]);

  const applySmartPresetToSelectedLayer = useCallback((presetId: string) => {
    const preset = SMART_ADAPTIVE_PRESETS.find((p) => p.id === presetId);
    if (!preset || !selectedLayer || !activeComp) return;
    commitProjectChange(`Apply Smart Preset "${preset.name}"`, (draft) => {
      const comp = draft.compositions.find((c) => c.id === draft.activeCompId);
      const lyr = comp?.layers.find((l) => l.id === selectedLayer.id);
      if (!lyr || !comp) return;
      lyr.effects.push(...preset.applyToCompScale(comp.width, comp.height));
    });
    notify(`Applied Smart Adaptive Preset "${preset.name}" (scaled to ${activeComp.width}x${activeComp.height})`);
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

    commitProjectChange(`Import Asset "${fileName}"`, (draft) => {
      draft.assets.push({
        id: createId('ast'),
        name: fileName,
        folder: '01_Imported',
        kind: lower.endsWith('.obj') ? 'mesh3d' : lower.endsWith('.wav') || lower.endsWith('.mp3') ? 'audio' : lower.endsWith('.csv') ? 'data' : 'image',
        path: fileName,
      });
    });
    notify(`Imported local asset "${fileName}" into Project Bin`);
  }, [commitProjectChange, notify]);

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
    notify('Generated Null control rig from Bezier Mask vertices');
  }, [selectedLayer, activeComp, commitProjectChange, notify]);

  const exportCollectFilesManifest = useCallback(() => {
    const pkg = collectProjectPackage(project);
    const blob = new Blob([pkg.reportTxt], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name.replace(/\.prex$/i, '')}_Collect_Report.txt`;
    a.click();
    URL.revokeObjectURL(url);
    notify('Downloaded Collect Files package report');
  }, [project, notify]);

  // Global keyboard shortcuts handler
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setActiveModal((m) => (m === 'command-palette' ? 'none' : 'command-palette'));
        return;
      }
      if (e.key === 'Escape' && activeModal !== 'none') {
        setActiveModal('none');
        return;
      }
      if (inInput) return;

      const hit = matchShortcutEvent(e, shortcuts);
      if (!hit) return;
      e.preventDefault();
      switch (hit.id) {
        case 'playPause': setIsPlaying((p) => !p); break;
        case 'undo': undo(); break;
        case 'redo': redo(); break;
        case 'saveProject': void saveProjectFileLocal(); break;
        case 'newComp': setActiveModal('new-comp'); break;
        case 'toolSelect': setActiveTool('selection'); break;
        case 'toolHand': setActiveTool('hand'); break;
        case 'toolZoom': setActiveTool('zoom'); break;
        case 'toolRotate': setActiveTool('rotate'); break;
        case 'toolCamera': setActiveTool('camera'); break;
        case 'toolAnchor': setActiveTool('anchor'); break;
        case 'toolShape': setActiveTool('shape-rect'); break;
        case 'toolPen': setActiveTool('pen'); break;
        case 'splitLayer': splitSelectedLayersAtPlayhead(); break;
        case 'duplicateLayer': duplicateSelectedLayers(false); break;
        case 'smartDuplicate': duplicateSelectedLayers(true); break;
        case 'precompose': precomposeSelectedLayers(); break;
        case 'easyEase': applyKeyframeAssistant('easy-ease'); break;
        case 'toggleNodeView': setBottomMode((m) => (m === 'nodes' ? 'timeline' : 'nodes')); break;
        case 'addRenderQueue': addCurrentCompToRenderQueue(); break;
        case 'whatsThis': setWhatsThisMode((w) => !w); break;
        case 'takeSnapshot': takeSnapshot(); break;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    shortcuts, activeModal, undo, redo, saveProjectFileLocal,
    splitSelectedLayersAtPlayhead, duplicateSelectedLayers, precomposeSelectedLayers,
    applyKeyframeAssistant, addCurrentCompToRenderQueue, takeSnapshot,
  ]);

  const undoEntries = useMemo(() => {
    void historyVersion;
    const { entries, currentIndex } = historyRef.current.getEntries();
    return entries.slice(0, currentIndex + 1);
  }, [historyVersion]);

  const redoCount = useMemo(() => {
    void historyVersion;
    const { entries, currentIndex } = historyRef.current.getEntries();
    return Math.max(0, entries.length - 1 - currentIndex);
  }, [historyVersion]);

  // Suppress unused import warning on helper kept available
  void makeProp;

  const value: StudioContextValue = {
    project,
    activeComp,
    selectedLayerIds,
    selectedLayer,
    currentTime,
    isPlaying,
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
    zoomPct,
    showSafeZones,
    showGrid,
    checkerboard,
    snapshotBuffer,
    wipeSplit01,
    lastFrameResult,
    statusMessage,
    undoEntries,
    redoCount,
    whatsThisMode,
    activeHelpId,
    tourStep,
    hasRecoverableAutosave,
    setWhatsThisMode,
    setActiveHelpId,
    setTourStep,
    restoreRecoverableAutosave,
    dismissRecoverableAutosave,
    createNullsFromSelectedMask,
    exportCollectFilesManifest,
    setCurrentTime,
    setIsPlaying,
    setActiveTool,
    setActiveWorkspace,
    setBottomMode,
    setLeftTab,
    setRightTab,
    setActiveModal,
    setSelectedLayerIds,
    setResolutionDivisor,
    setChannelView,
    setZoomPct,
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
    commitGitSnapshot,
    purgeRamCache,
  };

  return <StudioContext.Provider value={value}>{children}</StudioContext.Provider>;
};

export function useStudio(): StudioContextValue {
  const ctx = useContext(StudioContext);
  if (!ctx) throw new Error('useStudio must be used within StudioProvider');
  return ctx;
}
