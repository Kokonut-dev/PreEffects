import React, { useEffect, useRef, useState } from 'react';
import { useStudio } from '../state/StudioContext';
import { ToolId, WorkspaceId } from '../../engine/types';
import { t } from '../../utils/i18n';
import { formatTimecode } from '../../utils/math';
import {
  IconAnchor,
  IconBookGuide,
  IconBrush,
  IconCamera,
  IconChevronDown,
  IconClone,
  IconCursor,
  IconDownload,
  IconEraser,
  IconHand,
  IconMoon,
  IconPause,
  IconPen,
  IconPin,
  IconPlay,
  IconPlus,
  IconRotate,
  IconRoto,
  IconSearch,
  IconShapeRect,
  IconSkipStart,
  IconStepBack,
  IconStepFwd,
  IconSun,
  IconText,
  IconZoom,
} from './Icons';

interface ToolSpec {
  id: ToolId;
  label: string;
  keyHint: string;
  group: 'nav' | 'vector' | 'vfx';
  icon: React.ReactNode;
}

const TOOLS: ToolSpec[] = [
  { id: 'selection', label: 'Selection Tool', keyHint: 'V', group: 'nav', icon: <IconCursor /> },
  { id: 'hand', label: 'Hand Pan Tool', keyHint: 'H', group: 'nav', icon: <IconHand /> },
  { id: 'zoom', label: 'Zoom Stage Tool (Alt = Out)', keyHint: 'Z', group: 'nav', icon: <IconZoom /> },
  { id: 'rotate', label: 'Rotation Tool', keyHint: 'W', group: 'nav', icon: <IconRotate /> },
  { id: 'camera', label: '3D Camera Orbit Tool', keyHint: 'C', group: 'nav', icon: <IconCamera /> },
  { id: 'anchor', label: 'Pan Behind (Anchor Point)', keyHint: 'Y', group: 'nav', icon: <IconAnchor /> },
  { id: 'shape-rect', label: 'Vector Shape Tool', keyHint: 'Q', group: 'vector', icon: <IconShapeRect /> },
  { id: 'pen', label: 'Bezier Pen / Mask Tool', keyHint: 'G', group: 'vector', icon: <IconPen /> },
  { id: 'text', label: 'Typography Tool', keyHint: 'T', group: 'vector', icon: <IconText /> },
  { id: 'brush', label: 'Paint Brush Tool', keyHint: 'Ctrl+B', group: 'vfx', icon: <IconBrush /> },
  { id: 'clone', label: 'Clone Stamp Tool', keyHint: 'Alt+B', group: 'vfx', icon: <IconClone /> },
  { id: 'eraser', label: 'Non-Destructive Eraser Tool', keyHint: 'Alt+E', group: 'vfx', icon: <IconEraser /> },
  { id: 'roto-brush', label: 'Local AI Roto Brush', keyHint: 'Alt+W', group: 'vfx', icon: <IconRoto /> },
  { id: 'puppet-pin', label: 'Puppet Deform Pin Tool', keyHint: 'Ctrl+P', group: 'vfx', icon: <IconPin /> },
];

const WORKSPACES: Array<{ id: WorkspaceId; label: string }> = [
  { id: 'standard', label: 'Standard' },
  { id: 'animation', label: 'Curves' },
  { id: 'effects', label: 'Nodes' },
  { id: 'color', label: 'Color' },
  { id: 'tracking', label: 'Track' },
  { id: 'minimal', label: 'Minimal' },
];

const THEME_CYCLE: Array<'dark' | 'light' | 'high-contrast' | 'graphite'> = [
  'dark',
  'light',
  'high-contrast',
  'graphite',
];

const THEME_LABELS: Record<string, string> = {
  dark: 'Obsidian',
  light: 'Daylight',
  'high-contrast': 'OLED AAA+',
  graphite: 'Graphite',
  custom: 'Custom',
};

export const TopChrome: React.FC = () => {
  const studio = useStudio();
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [addLayerOpen, setAddLayerOpen] = useState(false);
  const headerRef = useRef<HTMLDivElement>(null);
  const loc = studio.preferences.locale;

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
        setAddLayerOpen(false);
      }
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, []);

  const menus: Array<{ id: string; label: string; items: Array<{ label: string; shortcut?: string; action: () => void }> }> = [
    {
      id: 'file',
      label: t('menu.file', loc),
      items: [
        { label: 'Welcome & Studio Templates…', action: () => studio.setActiveModal('welcome') },
        { label: 'New Blank Project', action: () => studio.loadTemplateProject('blank') },
        { label: 'Import Media / 3D / CSV / LUT…', shortcut: 'Ctrl+I', action: () => studio.triggerImportDialog() },
        { label: 'Save Project (.prex)…', shortcut: 'Ctrl+S', action: () => void studio.saveProjectFileLocal() },
        { label: 'Collect Files Package Report…', action: () => studio.exportCollectFilesManifest() },
        { label: 'Commit Git Project Snapshot…', action: () => studio.commitGitSnapshot('Manual Menu Milestone') },
        { label: 'Add Active Comp to Render Queue', shortcut: 'Ctrl+M', action: () => studio.addCurrentCompToRenderQueue() },
      ],
    },
    {
      id: 'edit',
      label: t('menu.edit', loc),
      items: [
        { label: `Undo (${studio.undoCount})`, shortcut: 'Ctrl+Z', action: () => studio.undo() },
        { label: `Redo (${studio.redoCount})`, shortcut: 'Ctrl+Shift+Z', action: () => studio.redo() },
        { label: 'Undo History & Version Drawer…', action: () => studio.setActiveModal('history') },
        { label: 'Duplicate Layer', shortcut: 'Ctrl+D', action: () => studio.duplicateSelectedLayers(false) },
        { label: 'Smart Duplicate (Relink Expressions)', shortcut: 'Ctrl+Alt+D', action: () => studio.duplicateSelectedLayers(true) },
        { label: 'Split Layer at Playhead', shortcut: 'Ctrl+Shift+D', action: () => studio.splitSelectedLayersAtPlayhead() },
        { label: 'Delete Selected Layer(s)', shortcut: 'Backspace', action: () => studio.deleteSelectedLayers() },
        { label: 'Keyboard Shortcuts…', action: () => studio.setActiveModal('shortcuts') },
        { label: 'Purge RAM Frame Cache', action: () => studio.purgeRamCache() },
        { label: 'Preferences & Theme Contrast…', action: () => studio.setActiveModal('preferences') },
      ],
    },
    {
      id: 'comp',
      label: t('menu.comp', loc),
      items: [
        { label: 'New Composition…', shortcut: 'Ctrl+N', action: () => studio.setActiveModal('new-comp') },
        { label: 'Composition Settings…', action: () => studio.setActiveModal('comp-settings') },
        { label: 'Pre-compose Selected Layers', shortcut: 'Ctrl+Shift+C', action: () => studio.precomposeSelectedLayers() },
        { label: 'Capture Viewer Snapshot', shortcut: 'F5', action: () => studio.takeSnapshot() },
        { label: 'Queue Active Composition Render', shortcut: 'Ctrl+M', action: () => studio.addCurrentCompToRenderQueue() },
      ],
    },
    {
      id: 'layer',
      label: t('menu.layer', loc),
      items: [
        { label: 'New Typography Layer', shortcut: 'T', action: () => studio.addLayerOfType('text') },
        { label: 'New Vector Shape Layer', shortcut: 'Q', action: () => studio.addLayerOfType('shape') },
        { label: 'New Solid Layer', shortcut: 'Ctrl+Y', action: () => studio.addLayerOfType('solid') },
        { label: 'New Null Rig Controller', action: () => studio.addLayerOfType('null') },
        { label: 'New Adjustment Layer', shortcut: 'Ctrl+Alt+Y', action: () => studio.addLayerOfType('adjustment') },
        { label: 'New 3D Camera (35mm DoF)', action: () => studio.addLayerOfType('camera') },
        { label: 'New 3D Point Light', action: () => studio.addLayerOfType('light') },
        { label: 'New Guide Layer', action: () => studio.addLayerOfType('guide') },
      ],
    },
    {
      id: 'effect',
      label: t('menu.effect', loc),
      items: [
        { label: 'Search All 186 Effects…', shortcut: 'Ctrl+K', action: () => studio.setActiveModal('command-palette') },
        { label: 'Gaussian Blur', action: () => studio.applyEffectToSelectedLayer('fx-gaussian-blur') },
        { label: 'Lumetri Color Suite', action: () => studio.applyEffectToSelectedLayer('fx-lumetri') },
        { label: 'Optical Glow', action: () => studio.applyEffectToSelectedLayer('fx-glow') },
        { label: 'Keylight 1.2 Chroma Keyer', action: () => studio.applyEffectToSelectedLayer('fx-keylight') },
        { label: 'Fractal Noise', action: () => studio.applyEffectToSelectedLayer('fx-fractal-noise') },
      ],
    },
    {
      id: 'view',
      label: t('menu.view', loc),
      items: [
        { label: 'Toggle Timeline ⇄ Node Graph (DAG)', shortcut: 'Shift+N', action: () => studio.setBottomMode(studio.bottomMode === 'nodes' ? 'timeline' : 'nodes') },
        { label: 'Open Speed / Value Graph Editor', shortcut: 'U', action: () => studio.setBottomMode('graph') },
        { label: 'Toggle Minimal Focus Workspace', shortcut: '`', action: () => studio.setActiveWorkspace(studio.activeWorkspace === 'minimal' ? 'standard' : 'minimal') },
        { label: 'Reset Viewport Pan & Zoom', action: () => { studio.setViewportPan([0, 0]); studio.setZoomPct(100); } },
        { label: 'Toggle Safe Zone Guides', action: () => studio.setShowSafeZones(!studio.showSafeZones) },
        { label: 'Toggle Proportional Grid', action: () => studio.setShowGrid(!studio.showGrid) },
        { label: 'Toggle Alpha Checkerboard', action: () => studio.setCheckerboard(!studio.checkerboard) },
      ],
    },
    {
      id: 'help',
      label: t('menu.help', loc),
      items: [
        { label: 'Interactive Studio Guide & Handbook…', shortcut: 'F1', action: () => studio.setActiveModal('guide') },
        { label: 'Start 8-Step Spotlight Walkthrough', action: () => studio.startInteractiveTour() },
        { label: "What's This? Click-to-Inspect Mode", shortcut: 'Shift+F1', action: () => studio.setWhatsThisMode(!studio.whatsThisMode) },
        { label: 'Keyboard Shortcuts Reference…', action: () => studio.setActiveModal('shortcuts') },
      ],
    },
  ];

  const cycleTheme = () => {
    const idx = THEME_CYCLE.indexOf(studio.preferences.theme as (typeof THEME_CYCLE)[number]);
    const next = THEME_CYCLE[(idx + 1) % THEME_CYCLE.length];
    studio.updatePreferences({ theme: next });
  };

  const renderToolCluster = (group: ToolSpec['group']) =>
    TOOLS.filter((tl) => tl.group === group).map((tool) => {
      const isActive = studio.activeTool === tool.id;
      return (
        <button
          key={tool.id}
          title={`${tool.label} (${tool.keyHint})`}
          aria-label={tool.label}
          className={`studio-btn ${isActive ? 'active' : 'ghost'}`}
          style={{ width: 28, height: 28, minHeight: 28, padding: 0 }}
          onClick={() => studio.setActiveTool(tool.id)}
        >
          {tool.icon}
        </button>
      );
    });

  const fps = studio.activeComp?.fps ?? 60;
  const currentFrame = Math.round(studio.currentTime * fps);
  const renderMs = studio.lastFrameResult?.totalTimeMs ?? 0;

  return (
    <header
      ref={headerRef}
      style={{
        flexShrink: 0,
        background: 'var(--bg-panel)',
        borderBottom: '1px solid var(--border-subtle)',
      }}
    >
      {/* Tier 1: Calm Minimalist Studio Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 34,
          padding: '0 10px',
          borderBottom: '1px solid var(--border-subtle)',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              fontWeight: 700,
              letterSpacing: '-0.02em',
              color: 'var(--text-primary)',
              marginRight: 4,
              cursor: 'pointer',
            }}
            onClick={() => studio.setActiveModal('welcome')}
            title="PreEffects Studio — Click for Starter Templates"
          >
            <span
              style={{
                width: 20,
                height: 20,
                borderRadius: 5,
                background: 'var(--accent-amber)',
                color: 'var(--accent-on-primary)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 10,
                fontWeight: 800,
              }}
            >
              PE
            </span>
            <span style={{ fontSize: 12.5 }}>PreEffects</span>
          </div>

          <nav style={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {menus.map((m) => (
              <div key={m.id} style={{ position: 'relative' }}>
                <button
                  className={`studio-btn ghost ${openMenu === m.id ? 'subtle-active' : ''}`}
                  style={{ minHeight: 24, padding: '2px 7px', fontSize: 11.5 }}
                  onClick={() => {
                    setAddLayerOpen(false);
                    setOpenMenu(openMenu === m.id ? null : m.id);
                  }}
                >
                  {m.label}
                </button>
                {openMenu === m.id && (
                  <div className="popover-menu">
                    {m.items.map((item) => (
                      <button
                        key={item.label}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 16,
                          width: '100%',
                          textAlign: 'left',
                          padding: '6px 9px',
                          borderRadius: 5,
                          color: 'var(--text-primary)',
                          fontSize: 11.5,
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        onClick={() => {
                          setOpenMenu(null);
                          item.action();
                        }}
                      >
                        <span>{item.label}</span>
                        {item.shortcut && <span className="kbd-chip">{item.shortcut}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </nav>

          <div style={{ width: 1, height: 14, background: 'var(--border-subtle)', margin: '0 2px' }} />

          <button
            className="studio-btn ghost"
            style={{ minHeight: 24, padding: '2px 7px' }}
            disabled={studio.undoCount === 0}
            title="Undo (Ctrl/Cmd+Z)"
            onClick={studio.undo}
          >
            Undo {studio.undoCount > 0 ? `(${studio.undoCount})` : ''}
          </button>
          <button
            className="studio-btn ghost"
            style={{ minHeight: 24, padding: '2px 7px' }}
            disabled={studio.redoCount === 0}
            title="Redo (Ctrl/Cmd+Shift+Z)"
            onClick={studio.redo}
          >
            Redo
          </button>
        </div>

        {/* Center Command Search Bar */}
        <button
          className="studio-btn"
          style={{
            minHeight: 25,
            minWidth: 220,
            maxWidth: 320,
            flex: 1,
            justifyContent: 'space-between',
            background: 'var(--bg-input)',
            color: 'var(--text-muted)',
            padding: '2px 8px',
          }}
          onClick={() => studio.setActiveModal('command-palette')}
          title="Search All 186 Effects, Commands, Tools & Themes (Ctrl/Cmd+K)"
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <IconSearch size={12} />
            <span>Search effects, tools, actions…</span>
          </span>
          <span className="kbd-chip">Ctrl+K</span>
        </button>

        {/* Right: Segmented Workspaces + Theme + Interactive Guide + Export */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div className="segmented-control" role="tablist" aria-label="Workspace Layout">
            {WORKSPACES.map((ws) => (
              <button
                key={ws.id}
                role="tab"
                aria-selected={studio.activeWorkspace === ws.id}
                className={`segmented-item ${studio.activeWorkspace === ws.id ? 'active' : ''}`}
                onClick={() => studio.setActiveWorkspace(ws.id)}
              >
                {ws.label}
              </button>
            ))}
          </div>

          <button
            className="studio-btn"
            style={{ minHeight: 25, padding: '2px 8px' }}
            title="Cycle Mathematically Verified Themes (Obsidian / Daylight / OLED AAA+ / Graphite)"
            onClick={cycleTheme}
          >
            {studio.preferences.theme === 'light' ? <IconSun size={13} /> : <IconMoon size={13} />}
            <span>{THEME_LABELS[studio.preferences.theme] ?? 'Theme'}</span>
          </button>

          <button
            className={`studio-btn ${studio.activeModal === 'guide' || studio.tourStep !== null ? 'subtle-active' : ''}`}
            style={{ minHeight: 25, padding: '2px 9px' }}
            title="Open Interactive Studio Guide & Hands-On Tutorial (F1)"
            onClick={() => studio.setActiveModal('guide')}
          >
            <IconBookGuide size={13} />
            <span>Guide</span>
          </button>

          <button
            className="studio-btn primary"
            style={{ minHeight: 25, padding: '2px 10px' }}
            onClick={studio.addCurrentCompToRenderQueue}
            title="Queue Active Composition for Local Export (Ctrl/Cmd+M)"
          >
            <IconDownload size={13} />
            <span>{t('toolbar.export', loc)}</span>
          </button>
        </div>
      </div>

      {/* Tier 2: Grouped Tool Strip + Compact "+ Add Layer" Popover + Precision Transport */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 38,
          padding: '0 10px',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 2,
              padding: 2,
              borderRadius: 6,
              background: 'var(--bg-inset)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            {renderToolCluster('nav')}
            <div style={{ width: 1, height: 16, background: 'var(--border-subtle)', margin: '0 3px' }} />
            {renderToolCluster('vector')}
            <div style={{ width: 1, height: 16, background: 'var(--border-subtle)', margin: '0 3px' }} />
            {renderToolCluster('vfx')}
          </div>

          <div style={{ position: 'relative' }}>
            <button
              className={`studio-btn ${addLayerOpen ? 'subtle-active' : ''}`}
              style={{ minHeight: 28, padding: '0 9px' }}
              onClick={() => {
                setOpenMenu(null);
                setAddLayerOpen((v) => !v);
              }}
              title="Add Layer to Active Composition"
            >
              <IconPlus size={12} />
              <span>Add Layer</span>
              <IconChevronDown size={11} />
            </button>
            {addLayerOpen && (
              <div className="popover-menu" style={{ minWidth: 230 }}>
                {[
                  { label: 'Typography Layer', hint: 'T', run: () => studio.addLayerOfType('text') },
                  { label: 'Vector Shape Layer', hint: 'Q', run: () => studio.addLayerOfType('shape') },
                  { label: 'Solid Color Matte', hint: 'Ctrl+Y', run: () => studio.addLayerOfType('solid') },
                  { label: 'Null Controller Rig', hint: 'Rig', run: () => studio.addLayerOfType('null') },
                  { label: 'Adjustment Layer', hint: 'Ctrl+Alt+Y', run: () => studio.addLayerOfType('adjustment') },
                  { label: '3D Camera (35mm DoF)', hint: '3D', run: () => studio.addLayerOfType('camera') },
                  { label: '3D Point Light', hint: '3D', run: () => studio.addLayerOfType('light') },
                  { label: 'Non-Rendering Guide', hint: 'Guide', run: () => studio.addLayerOfType('guide') },
                  { label: 'Pre-compose Selected', hint: 'Ctrl+Shift+C', run: () => studio.precomposeSelectedLayers() },
                ].map((entry) => (
                  <button
                    key={entry.label}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                      padding: '6px 9px',
                      borderRadius: 5,
                      color: 'var(--text-primary)',
                      fontSize: 11.5,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    onClick={() => {
                      setAddLayerOpen(false);
                      entry.run();
                    }}
                  >
                    <span>{entry.label}</span>
                    <span className="kbd-chip">{entry.hint}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            className={`studio-btn ${studio.whatsThisMode ? 'active' : 'ghost'}`}
            style={{ minHeight: 28, padding: '0 8px' }}
            title="What's This? Click any panel to inspect documentation (Shift+F1)"
            onClick={() => studio.setWhatsThisMode(!studio.whatsThisMode)}
          >
            ? Inspect
          </button>
        </div>

        {/* Precision Playback Transport + Timecode + Live Render Budget */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 2,
              padding: 2,
              borderRadius: 6,
              background: 'var(--bg-inset)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <button
              className="studio-btn ghost"
              style={{ width: 26, height: 24, minHeight: 24, padding: 0 }}
              title="Go to Start (Home)"
              onClick={() => studio.setCurrentTime(0)}
            >
              <IconSkipStart size={12} />
            </button>
            <button
              className="studio-btn ghost"
              style={{ width: 26, height: 24, minHeight: 24, padding: 0 }}
              title="Step 1 Frame Back (ArrowLeft)"
              onClick={() => studio.setCurrentTime((tc) => Math.max(0, tc - 1 / fps))}
            >
              <IconStepBack size={12} />
            </button>
            <button
              className={`studio-btn ${studio.isPlaying ? 'active' : ''}`}
              style={{ minHeight: 24, padding: '0 10px' }}
              title="RAM Preview Play / Pause (Space)"
              onClick={() => studio.setIsPlaying((p) => !p)}
            >
              {studio.isPlaying ? <IconPause size={12} /> : <IconPlay size={12} />}
              <span>{studio.isPlaying ? t('toolbar.stop', loc) : t('toolbar.play', loc)}</span>
            </button>
            <button
              className="studio-btn ghost"
              style={{ width: 26, height: 24, minHeight: 24, padding: 0 }}
              title="Step 1 Frame Forward (ArrowRight)"
              onClick={() => studio.setCurrentTime((tc) => Math.min(studio.activeComp?.duration ?? 10, tc + 1 / fps))}
            >
              <IconStepFwd size={12} />
            </button>
            <button
              className={`studio-btn ${studio.loopPlayback ? 'subtle-active' : 'ghost'}`}
              style={{ minHeight: 24, padding: '0 7px', fontSize: 10.5 }}
              onClick={() => studio.setLoopPlayback(!studio.loopPlayback)}
              title="Loop Work Area Playback"
            >
              Loop
            </button>
          </div>

          <div
            className="mono"
            style={{
              padding: '3px 9px',
              background: 'var(--bg-inset)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 5,
              color: 'var(--accent-amber)',
              fontWeight: 600,
              fontSize: 11.5,
            }}
            title="Current Timecode & Frame Index"
          >
            {formatTimecode(studio.currentTime, fps)}{' '}
            <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>({currentFrame}f)</span>
          </div>

          <span className="badge ok mono" title="Live Compositor Frame Time">
            {fps}fps · {renderMs.toFixed(1)}ms
          </span>
        </div>
      </div>
    </header>
  );
};
