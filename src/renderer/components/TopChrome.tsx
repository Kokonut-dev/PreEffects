import React, { useRef, useState } from 'react';
import { useStudio } from '../state/StudioContext';
import { ToolId, WorkspaceId } from '../../engine/types';
import { t } from '../../utils/i18n';
import {
  IconAnchor,
  IconBrush,
  IconCamera,
  IconClone,
  IconCursor,
  IconHand,
  IconMoon,
  IconPen,
  IconPin,
  IconRotate,
  IconRoto,
  IconShapeRect,
  IconSun,
  IconText,
  IconZoom,
} from './Icons';

const TOOLS: Array<{ id: ToolId; label: string; keyHint: string; icon: React.ReactNode }> = [
  { id: 'selection', label: 'Selection Tool', keyHint: 'V', icon: <IconCursor /> },
  { id: 'hand', label: 'Hand Pan Tool', keyHint: 'H', icon: <IconHand /> },
  { id: 'zoom', label: 'Zoom Tool', keyHint: 'Z', icon: <IconZoom /> },
  { id: 'rotate', label: 'Rotation Tool', keyHint: 'W', icon: <IconRotate /> },
  { id: 'camera', label: '3D Camera Orbit Tool', keyHint: 'C', icon: <IconCamera /> },
  { id: 'anchor', label: 'Pan Behind (Anchor Point)', keyHint: 'Y', icon: <IconAnchor /> },
  { id: 'shape-rect', label: 'Vector Shape Tool', keyHint: 'Q', icon: <IconShapeRect /> },
  { id: 'pen', label: 'Bezier Pen / Mask Vertex Tool', keyHint: 'G', icon: <IconPen /> },
  { id: 'text', label: 'Horizontal / Box Type Tool', keyHint: 'T', icon: <IconText /> },
  { id: 'brush', label: 'Paint Brush Tool', keyHint: 'Ctrl+B', icon: <IconBrush /> },
  { id: 'clone', label: 'Clone Stamp Tool', keyHint: 'Alt+B', icon: <IconClone /> },
  { id: 'roto-brush', label: 'Local AI Roto Brush', keyHint: 'Alt+W', icon: <IconRoto /> },
  { id: 'puppet-pin', label: 'Puppet Deform Pin Tool', keyHint: 'Ctrl+P', icon: <IconPin /> },
];

const WORKSPACES: Array<{ id: WorkspaceId; label: string }> = [
  { id: 'standard', label: 'Standard' },
  { id: 'animation', label: 'Animation' },
  { id: 'effects', label: 'Node & Effects' },
  { id: 'color', label: 'Color & Scopes' },
  { id: '3d', label: '3D Stage' },
  { id: 'tracking', label: 'Track & Roto' },
  { id: 'paint', label: 'Paint' },
  { id: 'text', label: 'Typography' },
];

export const TopChrome: React.FC = () => {
  const studio = useStudio();
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const loc = studio.preferences.locale;

  const triggerOpenFile = () => {
    setOpenMenu(null);
    fileInputRef.current?.click();
  };

  const onFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    studio.importLocalFileContent(file.name, text);
    e.target.value = '';
  };

  const menus: Array<{ id: string; label: string; items: Array<{ label: string; shortcut?: string; action: () => void }> }> = [
    {
      id: 'file',
      label: t('menu.file', loc),
      items: [
        { label: 'Welcome & Studio Templates…', action: () => studio.setActiveModal('welcome') },
        { label: 'New Blank Project', shortcut: 'Ctrl+Alt+N', action: () => studio.loadTemplateProject('blank') },
        { label: 'Open Project / Import Asset…', shortcut: 'Ctrl+O', action: triggerOpenFile },
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
        { label: `Undo (${studio.undoEntries.length})`, shortcut: 'Ctrl+Z', action: () => studio.undo() },
        { label: `Redo (${studio.redoCount})`, shortcut: 'Ctrl+Shift+Z', action: () => studio.redo() },
        { label: 'Undo History & Version Drawer…', action: () => studio.setActiveModal('history') },
        { label: 'Duplicate Layer', shortcut: 'Ctrl+D', action: () => studio.duplicateSelectedLayers(false) },
        { label: 'Smart Duplicate Hierarchy', shortcut: 'Ctrl+Alt+D', action: () => studio.duplicateSelectedLayers(true) },
        { label: 'Split Layer at Playhead', shortcut: 'Ctrl+Shift+D', action: () => studio.splitSelectedLayersAtPlayhead() },
        { label: 'Purge All RAM Preview Cache', action: () => studio.purgeRamCache() },
        { label: 'Preferences & Shortcuts…', action: () => studio.setActiveModal('preferences') },
      ],
    },
    {
      id: 'comp',
      label: t('menu.composition', loc),
      items: [
        { label: 'New Composition…', shortcut: 'Ctrl+N', action: () => studio.setActiveModal('new-comp') },
        { label: 'Composition Settings…', shortcut: 'Ctrl+K*', action: () => studio.setActiveModal('comp-settings') },
        { label: 'Pre-compose Selected Layers', shortcut: 'Ctrl+Shift+C', action: () => studio.precomposeSelectedLayers() },
        { label: 'Take Viewport Snapshot', action: () => studio.takeSnapshot() },
      ],
    },
    {
      id: 'layer',
      label: t('menu.layer', loc),
      items: [
        { label: 'New Text Layer', action: () => studio.addLayerOfType('text') },
        { label: 'New Solid Layer', action: () => studio.addLayerOfType('solid') },
        { label: 'New Vector Shape Layer', action: () => studio.addLayerOfType('shape') },
        { label: 'New Null Object', action: () => studio.addLayerOfType('null') },
        { label: 'New Adjustment Layer', action: () => studio.addLayerOfType('adjustment') },
        { label: 'New 3D Camera', action: () => studio.addLayerOfType('camera') },
        { label: 'New 3D Light', action: () => studio.addLayerOfType('light') },
        { label: 'New Guide Layer', action: () => studio.addLayerOfType('guide') },
        { label: 'Delete Selected Layer(s)', shortcut: 'Del', action: () => studio.deleteSelectedLayers() },
      ],
    },
    {
      id: 'effect',
      label: t('menu.effect', loc),
      items: [
        { label: 'Gaussian Blur', action: () => studio.applyEffectToSelectedLayer('gaussian-blur') },
        { label: 'Optical Glow', action: () => studio.applyEffectToSelectedLayer('glow') },
        { label: 'Curves (RGB + Alpha)', action: () => studio.applyEffectToSelectedLayer('curves') },
        { label: 'Lumetri Color Grade', action: () => studio.applyEffectToSelectedLayer('lumetri-color') },
        { label: 'Keylight 1.2 Chroma Keyer', action: () => studio.applyEffectToSelectedLayer('keylight') },
        { label: 'AI Roto Matting (Local)', action: () => studio.applyEffectToSelectedLayer('ai-roto-matting') },
        { label: 'Procedural Reaction-Diffusion', action: () => studio.applyEffectToSelectedLayer('procedural-reaction-diffusion') },
        { label: 'Browse All 186 Effects…', action: () => studio.setLeftTab('effects') },
      ],
    },
    {
      id: 'anim',
      label: t('menu.animation', loc),
      items: [
        { label: 'Easy Ease Selected Keyframes', shortcut: 'F9', action: () => studio.applyKeyframeAssistant('easy-ease') },
        { label: 'Easy Ease In', action: () => studio.applyKeyframeAssistant('easy-ease-in') },
        { label: 'Easy Ease Out', action: () => studio.applyKeyframeAssistant('easy-ease-out') },
        { label: 'Time-Reverse Keyframes', action: () => studio.applyKeyframeAssistant('reverse') },
        { label: 'Sequence Selected Layers', action: () => studio.applyKeyframeAssistant('sequence') },
        { label: 'Open Speed / Value Graph Editor', action: () => studio.setBottomMode('graph') },
      ],
    },
    {
      id: 'view',
      label: t('menu.view', loc),
      items: [
        { label: 'Toggle Title/Action Safe Zones', action: () => studio.setShowSafeZones(!studio.showSafeZones) },
        { label: 'Toggle Proportional Grid', action: () => studio.setShowGrid(!studio.showGrid) },
        { label: 'Toggle Alpha Checkerboard', action: () => studio.setCheckerboard(!studio.checkerboard) },
        { label: 'Switch to Node Compositing Graph', shortcut: 'Shift+N', action: () => studio.setBottomMode('nodes') },
        { label: 'Switch to Timeline Layer Stack', action: () => studio.setBottomMode('timeline') },
      ],
    },
    {
      id: 'help',
      label: 'Help',
      items: [
        { label: 'Start Interactive 5-Step Guided Tour…', action: () => studio.setTourStep(0) },
        { label: "Toggle What's This? Help Mode", shortcut: 'Shift+F1', action: () => studio.setWhatsThisMode(!studio.whatsThisMode) },
        { label: 'Keyboard Shortcuts & Theme Editor…', action: () => studio.setActiveModal('preferences') },
      ],
    },
  ];

  return (
    <header style={{ flexShrink: 0, borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-panel)' }}>
      <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={onFileSelected} />

      {/* Row 1: Brand + Native Menu Bar + Workspace Switcher + Command Palette */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 30,
          padding: '0 10px',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--bg-elevated)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, position: 'relative' }}>
          <button
            className="studio-btn ghost"
            onClick={() => studio.setActiveModal('welcome')}
            title="PreEffects Studio Home & Templates"
            style={{ padding: '2px 7px', fontWeight: 700, color: 'var(--text-primary)', gap: 6 }}
          >
            <svg width="19" height="19" viewBox="0 0 64 64" aria-hidden="true">
              <rect x="3" y="3" width="58" height="58" rx="14" fill="#131722" stroke="#384157" strokeWidth="2.5" />
              <circle cx="32" cy="32" r="19" fill="none" stroke="#38BDF8" strokeWidth="2" strokeDasharray="6 3" opacity="0.8" />
              <polygon points="32,11 53,32 32,53 11,32" fill="none" stroke="#E89B3C" strokeWidth="3.2" strokeLinejoin="round" />
              <polygon points="27,23 41,32 27,41" fill="#E89B3C" />
            </svg>
            <span>PreEffects</span>
          </button>

          {menus.map((m) => (
            <div key={m.id} style={{ position: 'relative' }}>
              <button
                className={`studio-btn ghost ${openMenu === m.id ? 'active' : ''}`}
                style={{ padding: '3px 7px', fontSize: 11.5 }}
                onClick={() => setOpenMenu(openMenu === m.id ? null : m.id)}
              >
                {m.label}
              </button>
              {openMenu === m.id && (
                <div
                  onMouseLeave={() => setOpenMenu(null)}
                  style={{
                    position: 'absolute',
                    top: 26,
                    left: 0,
                    minWidth: 235,
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-strong)',
                    borderRadius: 6,
                    boxShadow: 'var(--shadow-modal)',
                    padding: 4,
                    zIndex: 500,
                  }}
                >
                  {m.items.map((item, idx) => (
                    <button
                      key={idx}
                      className="studio-btn ghost"
                      style={{
                        width: '100%',
                        justifyContent: 'space-between',
                        padding: '5px 9px',
                        fontSize: 11.5,
                      }}
                      onClick={() => {
                        setOpenMenu(null);
                        item.action();
                      }}
                    >
                      <span>{item.label}</span>
                      {item.shortcut && <span className="mono" style={{ color: 'var(--text-muted)', fontSize: 10 }}>{item.shortcut}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Workspace Switcher Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          {WORKSPACES.map((ws) => (
            <button
              key={ws.id}
              className={`studio-btn ${studio.activeWorkspace === ws.id ? 'primary' : 'ghost'}`}
              style={{ padding: '2px 8px', fontSize: 11 }}
              onClick={() => studio.setActiveWorkspace(ws.id)}
            >
              {ws.label}
            </button>
          ))}
        </div>

        {/* Command Palette + Offline Shield + Theme Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            className="studio-btn"
            onClick={() => studio.setActiveModal('command-palette')}
            style={{ padding: '2px 9px', fontSize: 11, color: 'var(--text-secondary)' }}
            title="Search all 186 effects, commands & shortcuts (Ctrl/Cmd+K)"
          >
            <span>Command Palette…</span>
            <span className="mono" style={{ fontSize: 10, color: 'var(--accent-amber)' }}>Ctrl+K</span>
          </button>

          <span className="badge ok" title="Zero telemetry, zero cloud, zero sign-in — 100% local offline execution">
            LOCAL OFFLINE
          </span>

          <button
            className={`studio-btn ${studio.whatsThisMode ? 'primary' : 'ghost'}`}
            title="What's This? Contextual Help Mode (Shift+F1) — Click any panel to inspect documentation"
            onClick={() => studio.setWhatsThisMode(!studio.whatsThisMode)}
            style={{ padding: '2px 7px', fontWeight: 700 }}
          >
            ? Help
          </button>

          <button
            className="studio-btn ghost"
            aria-label="Toggle Dark or Light Studio Theme"
            title="Switch Dark / Precision Daylight Theme"
            onClick={() => studio.updatePreferences({ theme: studio.preferences.theme === 'light' ? 'dark' : 'light' })}
          >
            {studio.preferences.theme === 'light' ? <IconMoon /> : <IconSun />}
          </button>
        </div>
      </div>

      {/* Row 2: Precision Tool Strip + Quick Layer Creators + Undo/Redo + Render CTA */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 36,
          padding: '0 10px',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          {TOOLS.map((tool) => (
            <button
              key={tool.id}
              aria-label={tool.label}
              title={`${tool.label} (${tool.keyHint})`}
              className={`studio-btn ${studio.activeTool === tool.id ? 'primary' : ''}`}
              style={{ width: 28, height: 26, padding: 0 }}
              onClick={() => studio.setActiveTool(tool.id)}
            >
              {tool.icon}
            </button>
          ))}

          <div style={{ width: 1, height: 18, background: 'var(--border-subtle)', margin: '0 6px' }} />

          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginRight: 2 }}>+ Layer:</span>
          {(['text', 'shape', 'solid', 'null', 'adjustment', 'camera', 'light'] as const).map((lt) => (
            <button
              key={lt}
              className="studio-btn"
              style={{ padding: '2px 7px', fontSize: 10.5 }}
              onClick={() => studio.addLayerOfType(lt)}
              title={`Create new ${lt} layer in active composition`}
            >
              {lt.charAt(0).toUpperCase() + lt.slice(1)}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <button
            className="studio-btn"
            onClick={studio.undo}
            disabled={studio.undoEntries.length === 0}
            title="Undo (Ctrl+Z)"
            style={{ opacity: studio.undoEntries.length === 0 ? 0.45 : 1, fontSize: 11 }}
          >
            Undo
          </button>
          <button
            className="studio-btn"
            onClick={studio.redo}
            disabled={studio.redoCount === 0}
            title="Redo (Ctrl+Shift+Z)"
            style={{ opacity: studio.redoCount === 0 ? 0.45 : 1, fontSize: 11 }}
          >
            Redo
          </button>
          <button
            className="studio-btn"
            onClick={() => studio.setActiveModal('history')}
            title="Open Undo Stack & In-Project Git Commits"
            style={{ fontSize: 11 }}
          >
            History ({studio.undoEntries.length})
          </button>
          <button
            className="studio-btn"
            onClick={() => void studio.saveProjectFileLocal()}
            title="Save .prex project locally (Ctrl+S)"
            style={{ fontSize: 11 }}
          >
            Save .prex
          </button>
          <button
            className="studio-btn primary"
            onClick={() => studio.addCurrentCompToRenderQueue()}
            title="Queue active composition for local GIF/AVI/WAV/EXR/TGA export (Ctrl+M)"
            style={{ fontSize: 11 }}
          >
            Export / Render Queue
          </button>
        </div>
      </div>
    </header>
  );
};
