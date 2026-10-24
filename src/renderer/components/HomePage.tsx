import React, { useMemo, useState } from 'react';
import { useStudio } from '../state/StudioContext';
import { INTERACTIVE_TUTORIAL_STEPS } from '../data/studioGuideData';
import { EFFECTS_CATALOG } from '../../effects/registry';
import { auditThemeContrast, STUDIO_THEME_PALETTES } from '../../utils/contrastMath';
import {
  IconArrowRight,
  IconBookGuide,
  IconCheck,
  IconCopy,
  IconCube3D,
  IconFolder,
  IconLayers,
  IconMoon,
  IconPlay,
  IconPlus,
  IconSearch,
  IconShieldCheck,
  IconSparkles,
  IconSun,
  IconTrash,
} from './Icons';

type HomeSectionTab = 'overview' | 'tutorial' | 'system';

const STARTER_TEMPLATES = [
  {
    id: 'orbital-hero' as const,
    tag: '3D + Expressions + Glow',
    title: 'Orbital Telemetry 3D Hero',
    desc: 'Multi-layer HUD telemetry rig with keyframed typography, vector trim paths, optical glow, and live expressions.',
    spec: '1920×1080 · 30 fps · 4 Layers',
    accent: 'var(--accent-amber)',
  },
  {
    id: 'kinetic-lower-third' as const,
    tag: 'Broadcast Motion Design',
    title: 'Broadcast Kinetic Lower Third',
    desc: 'Per-character typography range cascade paired with clean geometric vector shape plates and cubic Bezier eases.',
    spec: '1920×1080 · 60 fps · Broadcast Safe',
    accent: 'var(--accent-cyan)',
  },
  {
    id: 'vfx-keying' as const,
    tag: 'Keying + Roto + Tracking',
    title: 'VFX Chroma Key & Tracking Rig',
    desc: 'Green-screen Keylight despill chain, matte choke, Local AI Roto segmentation, and 2D motion tracker Null rig.',
    spec: '1920×1080 · 24 fps · VFX Pipeline',
    accent: 'var(--accent-purple)',
  },
  {
    id: 'blank' as const,
    tag: 'Clean Slate',
    title: 'Blank 1080p60 Composition',
    desc: 'Empty 1920×1080 60fps composition with Rec.709 linear working space—ready for custom layers or footage.',
    spec: '1920×1080 · 60 fps · Empty Stage',
    accent: 'var(--status-ok)',
  },
];

export const HomePage: React.FC = () => {
  const studio = useStudio();
  const [homeTab, setHomeTab] = useState<HomeSectionTab>('overview');
  const [tutorialCategory, setTutorialCategory] = useState<'All' | 'Foundations' | 'Animation & Rigging' | 'VFX & 3D' | 'Pipeline & Export'>('All');
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  const comp = studio.activeComp;
  const totalLayers = useMemo(
    () => studio.project.compositions.reduce((s, c) => s + c.layers.length, 0),
    [studio.project.compositions],
  );
  const completedCount = studio.completedTutorialModules.length;
  const totalModules = INTERACTIVE_TUTORIAL_STEPS.length;
  const progressPct = Math.round((completedCount / Math.max(1, totalModules)) * 100);

  const filteredModules = useMemo(
    () =>
      INTERACTIVE_TUTORIAL_STEPS.filter(
        (m) => tutorialCategory === 'All' || m.category === tutorialCategory,
      ),
    [tutorialCategory],
  );

  const activeThemeAudit = useMemo(() => {
    const palKey = studio.preferences.theme === 'custom' ? 'dark' : studio.preferences.theme;
    const pal = STUDIO_THEME_PALETTES[palKey] ?? STUDIO_THEME_PALETTES.dark;
    return auditThemeContrast(pal);
  }, [studio.preferences.theme]);

  const isLightTheme = studio.preferences.theme === 'light';

  return (
    <div
      data-testid="preeffects-homepage"
      onDragOver={(e) => {
        e.preventDefault();
        setIsDraggingFile(true);
      }}
      onDragLeave={() => setIsDraggingFile(false)}
      onDrop={async (e) => {
        e.preventDefault();
        setIsDraggingFile(false);
        const file = e.dataTransfer.files?.[0];
        if (file) await studio.importLocalFile(file);
      }}
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-canvas)',
        color: 'var(--text-primary)',
        overflow: 'hidden',
        outline: isDraggingFile ? '2px dashed var(--accent-cyan)' : 'none',
        outlineOffset: -8,
      }}
    >
      {/* Top Minimalist Homepage Header */}
      <header
        style={{
          height: 52,
          padding: '0 24px',
          background: 'var(--bg-panel)',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 7,
              background: 'var(--accent-amber)',
              color: 'var(--accent-on-primary)',
              fontWeight: 800,
              fontSize: 12.5,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              letterSpacing: '-0.03em',
            }}
          >
            Pr
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontWeight: 700, fontSize: 14.5, letterSpacing: '-0.01em' }}>PreEffects</span>
              <span className="badge mono">v{studio.desktopAppInfo.version}</span>
              <span className="badge ok">100% Offline</span>
            </div>
          </div>

          <div style={{ width: 1, height: 20, background: 'var(--border-subtle)', margin: '0 6px' }} />

          <nav aria-label="Home Sections" className="segmented-control">
            <button
              className={`segmented-item ${homeTab === 'overview' ? 'active' : ''}`}
              onClick={() => setHomeTab('overview')}
            >
              Projects &amp; Templates
            </button>
            <button
              className={`segmented-item ${homeTab === 'tutorial' ? 'active' : ''}`}
              onClick={() => setHomeTab('tutorial')}
            >
              Interactive Tutorial ({completedCount}/{totalModules})
            </button>
            <button
              className={`segmented-item ${homeTab === 'system' ? 'active' : ''}`}
              onClick={() => setHomeTab('system')}
            >
              Themes &amp; System
            </button>
          </nav>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            className="studio-btn ghost icon-only"
            aria-label="Toggle Light and Dark Theme"
            title={isLightTheme ? 'Switch to Linear Obsidian (Dark AAA)' : 'Switch to Nordic Daylight (Light AAA)'}
            onClick={() => studio.updatePreferences({ theme: isLightTheme ? 'dark' : 'light' })}
          >
            {isLightTheme ? <IconMoon size={14} /> : <IconSun size={14} />}
          </button>

          <button
            className="studio-btn"
            onClick={() => studio.setActiveModal('command-palette')}
            title="Search all 186 effects, commands & shortcuts (Ctrl/Cmd + K)"
          >
            <IconSearch size={13} />
            <span>Search</span>
            <span className="kbd-chip">⌘K</span>
          </button>

          <button
            className="studio-btn"
            onClick={() => studio.setActiveModal('guide')}
            title="Open 8-Chapter Reference Handbook (F1)"
          >
            <IconBookGuide size={13} color="var(--accent-amber)" />
            <span>Handbook</span>
          </button>

          <button
            className="studio-btn primary"
            onClick={() => studio.setActiveView('studio')}
            title="Return to active composition workspace (Alt+H)"
          >
            <span>Enter Studio</span>
            <IconArrowRight size={13} />
          </button>
        </div>
      </header>

      {/* Optional Crash-Safe Autosave Recovery Strip */}
      {studio.hasRecoverableAutosave && (
        <div
          style={{
            padding: '8px 24px',
            background: 'var(--bg-elevated)',
            borderBottom: '1px solid var(--accent-amber)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="badge amber">Autosave Found</span>
            <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>
              A local crash-safe autosave snapshot is available on this device. Would you like to restore it into the studio?
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="studio-btn primary" onClick={studio.restoreRecoverableAutosave}>
              Restore Autosave
            </button>
            <button className="studio-btn ghost" onClick={studio.dismissRecoverableAutosave}>
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Main Scrollable Homepage Workspace */}
      <main
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '28px 32px 36px',
        }}
      >
        <div style={{ maxWidth: 1180, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* TAB 1: OVERVIEW, ACTIVE SESSION, QUICK LAUNCHERS, LOCAL VAULT & STARTER TEMPLATES */}
          {homeTab === 'overview' && (
            <>
              {/* Hero Two-Column Strip: Active Studio Session + Interactive Tutorial Banner */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.35fr 1fr', gap: 16 }}>
                {/* Active Session Card */}
                <section
                  style={{
                    background: 'var(--bg-panel)',
                    border: '1px solid var(--border-strong)',
                    borderRadius: 10,
                    padding: 22,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: 16,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                    <div>
                      <div className="section-eyebrow" style={{ marginBottom: 4 }}>
                        Active Studio Session
                      </div>
                      <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.015em', color: 'var(--text-primary)' }}>
                        {studio.project.name}
                      </h1>
                      <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 4 }}>
                        Active Comp: <strong style={{ color: 'var(--text-primary)' }}>{comp?.name ?? 'Main Comp'}</strong>{' '}
                        · {comp ? `${comp.width}×${comp.height} @ ${comp.fps} fps` : '1920×1080'} · {totalLayers} layers ·{' '}
                        {studio.project.workingColorSpace} ({studio.project.bitDepth}-bpc)
                      </p>
                    </div>
                    <span className="kbd-chip" title="Toggle Home Hub anytime with Alt+H">
                      Alt + H
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    <button
                      className="studio-btn primary"
                      style={{ padding: '8px 16px', fontSize: 12.5 }}
                      onClick={() => studio.setActiveView('studio')}
                    >
                      <IconPlay size={12} />
                      <span>Resume in Studio</span>
                    </button>

                    <button
                      className="studio-btn"
                      style={{ padding: '8px 13px' }}
                      onClick={() => {
                        studio.setActiveView('studio');
                        studio.setActiveModal('new-comp');
                      }}
                    >
                      <IconPlus size={13} />
                      <span>New Composition…</span>
                    </button>

                    <button
                      className="studio-btn"
                      style={{ padding: '8px 13px' }}
                      onClick={() => void studio.openProjectFileLocal()}
                    >
                      <IconFolder size={13} />
                      <span>Open .prex / Media…</span>
                    </button>

                    <button
                      className="studio-btn"
                      style={{ padding: '8px 13px' }}
                      onClick={() => {
                        studio.saveCurrentToVault();
                        studio.notify(`Pinned "${studio.project.name}" to Local Project Vault`);
                      }}
                      title="Save a snapshot of the active project in your local browser/desktop vault"
                    >
                      <IconCopy size={13} />
                      <span>Pin to Local Vault</span>
                    </button>
                  </div>
                </section>

                {/* Interactive Masterclass Launch Card */}
                <section
                  style={{
                    background: 'var(--bg-panel)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 10,
                    padding: 22,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: 14,
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span className="badge amber">
                        <IconSparkles size={11} /> 10-Module Interactive Tutorial
                      </span>
                      <span className="mono" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                        {completedCount}/{totalModules} Mastered ({progressPct}%)
                      </span>
                    </div>
                    <h2 style={{ fontSize: 16.5, fontWeight: 700, color: 'var(--text-primary)' }}>
                      Learn Every Core Feature Hands-On
                    </h2>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.55 }}>
                      Guided spotlight walkthrough with live challenge detection &amp; 1-click demos across Keyframes, Expressions, 186 Effects, Masks, Tracking, AI Roto, Node DAG, 3D &amp; Export.
                    </p>
                  </div>

                  {/* Progress Track */}
                  <div>
                    <div
                      style={{
                        height: 6,
                        borderRadius: 999,
                        background: 'var(--bg-inset)',
                        border: '1px solid var(--border-subtle)',
                        overflow: 'hidden',
                        marginBottom: 10,
                      }}
                    >
                      <div
                        style={{
                          width: `${Math.max(4, progressPct)}%`,
                          height: '100%',
                          background: completedCount === totalModules ? 'var(--status-ok)' : 'var(--accent-amber)',
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        className="studio-btn primary"
                        style={{ flex: 1, justifyContent: 'center', padding: '7px 12px' }}
                        onClick={() => {
                          const nextIncomplete = INTERACTIVE_TUTORIAL_STEPS.findIndex(
                            (s) => !studio.completedTutorialModules.includes(s.moduleId),
                          );
                          studio.startInteractiveTutorialModule(nextIncomplete >= 0 ? nextIncomplete : 0);
                        }}
                      >
                        ▶ {completedCount > 0 && completedCount < totalModules ? 'Continue Tutorial' : 'Start Full Tutorial'}
                      </button>
                      <button
                        className="studio-btn"
                        style={{ padding: '7px 12px' }}
                        onClick={() => setHomeTab('tutorial')}
                      >
                        Browse All 10 Modules
                      </button>
                    </div>
                  </div>
                </section>
              </div>

              {/* Instant Composition Format Presets Strip */}
              <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="section-eyebrow">1-Click New Composition Presets</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    Or drag &amp; drop any <span className="mono">.prex</span>, <span className="mono">.png/.jpg</span>, <span className="mono">.obj</span>, <span className="mono">.wav</span>, <span className="mono">.csv</span>, or <span className="mono">.cube</span> file anywhere on this screen
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                  {[
                    { name: 'Broadcast HD 1080p60', w: 1920, h: 1080, fps: 60, dur: 10, tag: '16:9 · 60 fps' },
                    { name: 'Cinema 4K UHD 24p', w: 3840, h: 2160, fps: 24, dur: 12, tag: '3840×2160 · 24 fps' },
                    { name: 'Social Vertical 9:16', w: 1080, h: 1920, fps: 60, dur: 15, tag: '1080×1920 · Reels/Shorts' },
                    { name: 'Motion Square 1:1', w: 1080, h: 1080, fps: 30, dur: 8, tag: '1080×1080 · Loop' },
                  ].map((preset) => (
                    <button
                      key={preset.name}
                      className="studio-btn"
                      style={{
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        padding: '12px 14px',
                        height: 'auto',
                        gap: 4,
                        background: 'var(--bg-panel)',
                      }}
                      onClick={() =>
                        studio.createNewComposition(preset.name, preset.w, preset.h, preset.fps, preset.dur)
                      }
                    >
                      <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong style={{ fontSize: 12.5, color: 'var(--text-primary)' }}>{preset.name}</strong>
                        <IconPlus size={12} color="var(--accent-cyan)" />
                      </div>
                      <span className="mono" style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
                        {preset.tag} · {preset.dur}s
                      </span>
                    </button>
                  ))}
                </div>
              </section>

              {/* Starter Project Templates Grid */}
              <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="section-eyebrow">Production Starter Templates (Offline Built-In)</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {EFFECTS_CATALOG.length} GPU/CPU Effects · 38 Blend Modes · Bidirectional Layer ⇄ Node DAG
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                  {STARTER_TEMPLATES.map((tpl) => (
                    <div
                      key={tpl.id}
                      style={{
                        background: 'var(--bg-panel)',
                        border: '1px solid var(--border-subtle)',
                        borderLeft: `3px solid ${tpl.accent}`,
                        borderRadius: 8,
                        padding: '15px 16px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: 12,
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <span className="badge">{tpl.tag}</span>
                          <span className="mono" style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
                            {tpl.spec}
                          </span>
                        </div>
                        <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                          {tpl.title}
                        </h3>
                        <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{tpl.desc}</p>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                          className="studio-btn"
                          onClick={() => studio.loadTemplateProject(tpl.id)}
                        >
                          <span>Open Template</span>
                          <IconArrowRight size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Local Project Vault (Saved Recent Projects) */}
              <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="section-eyebrow">
                    Local Project Vault ({studio.recentProjects.length})
                  </span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className="studio-btn"
                      style={{ minHeight: 24, padding: '2px 10px', fontSize: 11 }}
                      onClick={() => void studio.saveProjectFileLocal()}
                    >
                      Export Current .prex to Disk
                    </button>
                  </div>
                </div>

                {studio.recentProjects.length === 0 ? (
                  <div
                    style={{
                      background: 'var(--bg-panel)',
                      border: '1px dashed var(--border-strong)',
                      borderRadius: 8,
                      padding: '18px 20px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 12.5, color: 'var(--text-primary)' }}>
                        Your Local Project Vault is empty
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 2 }}>
                        Save projects with <span className="kbd-chip">⌘/Ctrl + S</span> or click &ldquo;Pin to Local Vault&rdquo; above for instant 1-click reopening—stored 100% locally on your device.
                      </div>
                    </div>
                    <button
                      className="studio-btn"
                      onClick={() => {
                        studio.saveCurrentToVault();
                        studio.notify(`Pinned "${studio.project.name}" to Local Project Vault`);
                      }}
                    >
                      + Pin Active Project Now
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                    {studio.recentProjects.map((entry) => (
                      <div
                        key={entry.id}
                        style={{
                          background: 'var(--bg-panel)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 8,
                          padding: '12px 14px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 10,
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {entry.name}
                          </div>
                          <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 2 }}>
                            {entry.resolutionLabel} @ {entry.fps}fps · {entry.compCount} comp(s) · {entry.layerCount} layers ·{' '}
                            {new Date(entry.updatedAt).toLocaleString()}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                          <button
                            className="studio-btn primary"
                            onClick={() => studio.openVaultProject(entry.id)}
                          >
                            Open
                          </button>
                          <button
                            className="studio-btn ghost icon-only"
                            aria-label={`Remove ${entry.name} from vault`}
                            title="Remove from Local Vault"
                            onClick={() => studio.deleteVaultProject(entry.id)}
                          >
                            <IconTrash size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}

          {/* TAB 2: 10-MODULE INTERACTIVE FEATURE TUTORIAL MASTERCLASS */}
          {homeTab === 'tutorial' && (
            <section style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div
                style={{
                  background: 'var(--bg-panel)',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 10,
                  padding: 22,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 20,
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ maxWidth: 680 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span className="badge amber">Interactive Masterclass</span>
                    <span className="badge cyan">Launch Anytime · Non-Modal Spotlight</span>
                  </div>
                  <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>
                    Explore Every Main Feature of PreEffects
                  </h1>
                  <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.55 }}>
                    Launch the complete 10-module sequence or jump straight into any individual feature below. Each module highlights the real studio dock, gives you a live hands-on challenge (automatically verified as you work!), and includes a 1-click live demonstration.
                  </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                  <div className="mono" style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 700 }}>
                    {completedCount} of {totalModules} Modules Completed ({progressPct}%)
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {completedCount > 0 && (
                      <button className="studio-btn ghost" onClick={studio.resetTutorialProgress}>
                        Reset Progress
                      </button>
                    )}
                    <button
                      className="studio-btn primary"
                      style={{ padding: '8px 16px' }}
                      onClick={() => studio.startInteractiveTutorialModule(0)}
                    >
                      ▶ Start Complete 10-Module Tour
                    </button>
                  </div>
                </div>
              </div>

              {/* Category Filter Bar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                <div className="segmented-control">
                  {(['All', 'Foundations', 'Animation & Rigging', 'VFX & 3D', 'Pipeline & Export'] as const).map((cat) => (
                    <button
                      key={cat}
                      className={`segmented-item ${tutorialCategory === cat ? 'active' : ''}`}
                      onClick={() => setTutorialCategory(cat)}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
                <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                  Shortcut inside Studio: press <span className="kbd-chip">F2</span> for Interactive Tutorial · <span className="kbd-chip">F1</span> for Written Handbook
                </span>
              </div>

              {/* 10 Module Cards Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                {filteredModules.map((mod) => {
                  const isDone = studio.completedTutorialModules.includes(mod.moduleId);
                  return (
                    <div
                      key={mod.moduleId}
                      style={{
                        background: 'var(--bg-panel)',
                        border: `1px solid ${isDone ? 'var(--status-ok)' : 'var(--border-subtle)'}`,
                        borderRadius: 9,
                        padding: 16,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: 12,
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span className={`badge ${isDone ? 'ok' : 'amber'}`}>
                              {isDone ? '✓ Mastered' : `Module ${String(mod.stepIndex + 1).padStart(2, '0')}`}
                            </span>
                            <span className="badge">{mod.category}</span>
                          </div>
                          <span className="mono" style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
                            {mod.durationEst} · {mod.shortcutHint}
                          </span>
                        </div>

                        <h3 style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text-primary)' }}>
                          {mod.title}
                        </h3>
                        <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                          {mod.summary}
                        </p>

                        <div
                          style={{
                            marginTop: 2,
                            padding: '7px 10px',
                            borderRadius: 6,
                            background: 'var(--bg-inset)',
                            border: '1px solid var(--border-subtle)',
                            fontSize: 11,
                            color: 'var(--text-primary)',
                          }}
                        >
                          <strong style={{ color: 'var(--accent-cyan)' }}>Hands-On Goal:</strong> {mod.handsOnChallenge}
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, paddingTop: 4 }}>
                        <button
                          className="studio-btn"
                          style={{ fontSize: 11.5 }}
                          onClick={() => {
                            studio.startInteractiveTutorialModule(mod.stepIndex);
                            studio.runGuideTryAction(mod.tryActionId);
                          }}
                        >
                          ⚡ Launch &amp; Run Live Demo
                        </button>
                        <button
                          className="studio-btn primary"
                          style={{ fontSize: 11.5 }}
                          onClick={() => studio.startInteractiveTutorialModule(mod.stepIndex)}
                        >
                          <span>Open Module</span>
                          <IconArrowRight size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* TAB 3: THEMES, CONTRAST MATH, SYSTEM DIAGNOSTICS & OFFLINE PRIVACY */}
          {homeTab === 'system' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {/* 4 Mathematically Verified Studio Themes */}
              <section
                style={{
                  background: 'var(--bg-panel)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 10,
                  padding: 20,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 14,
                }}
              >
                <div>
                  <div className="section-eyebrow">Visual Ergonomics &amp; Contrast Math</div>
                  <h2 style={{ fontSize: 16, fontWeight: 700, marginTop: 2 }}>
                    WCAG 2.1 AAA &amp; APCA-W3 Calibrated Themes
                  </h2>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                    Every surface, border, and text token is verified in linearized CIE relative luminance so timeline labels, scrubbers, and timecode remain effortlessly legible.
                  </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {[
                    { id: 'dark' as const, label: 'Linear Obsidian', sub: 'Default Dark Studio · 14.5:1 AAA' },
                    { id: 'light' as const, label: 'Nordic Daylight', sub: 'Daylight Mastering · 14.1:1 AAA' },
                    { id: 'high-contrast' as const, label: 'OLED Pure Contrast', sub: 'Max Contrast · 21.0:1 AAA+' },
                    { id: 'graphite' as const, label: 'Warm Studio Graphite', sub: 'Low-Fatigue Grading · 13.1:1 AAA' },
                  ].map((th) => {
                    const active = studio.preferences.theme === th.id;
                    return (
                      <button
                        key={th.id}
                        className={`studio-btn ${active ? 'subtle-active' : ''}`}
                        style={{
                          flexDirection: 'column',
                          alignItems: 'flex-start',
                          height: 'auto',
                          padding: '10px 12px',
                          gap: 3,
                        }}
                        onClick={() => studio.updatePreferences({ theme: th.id })}
                      >
                        <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
                          <strong style={{ fontSize: 12.5, color: 'var(--text-primary)' }}>{th.label}</strong>
                          {active && <IconCheck size={13} color="var(--accent-amber)" />}
                        </div>
                        <span className="mono" style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
                          {th.sub}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div
                  style={{
                    padding: 12,
                    borderRadius: 7,
                    background: 'var(--bg-inset)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                    Active Theme Verification ({activeThemeAudit.checks.length} token pairs):
                  </span>
                  <span className="badge ok">
                    {activeThemeAudit.checks.filter((c) => c.passed).length}/{activeThemeAudit.checks.length} Passed WCAG + APCA
                  </span>
                </div>
              </section>

              {/* Runtime Build, Memory Pool & 100% Offline Privacy Architecture */}
              <section
                style={{
                  background: 'var(--bg-panel)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 10,
                  padding: 20,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: 14,
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div>
                    <div className="section-eyebrow">Runtime &amp; Privacy Guarantees</div>
                    <h2 style={{ fontSize: 16, fontWeight: 700, marginTop: 2 }}>
                      Offline-First Architecture &amp; Local Engine
                    </h2>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div className="inspector-card" style={{ gap: 3 }}>
                      <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>Application Build</span>
                      <strong className="mono" style={{ fontSize: 12.5 }}>
                        PreEffects v{studio.desktopAppInfo.version} ({studio.desktopAppInfo.platform}/{studio.desktopAppInfo.arch})
                      </strong>
                    </div>
                    <div className="inspector-card" style={{ gap: 3 }}>
                      <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>Network &amp; Telemetry</span>
                      <strong style={{ fontSize: 12.5, color: 'var(--status-ok)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        <IconShieldCheck size={14} /> Zero Outbound Calls
                      </strong>
                    </div>
                    <div className="inspector-card" style={{ gap: 3 }}>
                      <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>Built-In VFX &amp; Blending</span>
                      <strong className="mono" style={{ fontSize: 12.5 }}>
                        <IconLayers size={12} /> {EFFECTS_CATALOG.length} Effects · 38 Blend Modes
                      </strong>
                    </div>
                    <div className="inspector-card" style={{ gap: 3 }}>
                      <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>3D &amp; Node Pipeline</span>
                      <strong className="mono" style={{ fontSize: 12.5 }}>
                        <IconCube3D size={12} /> Classic 3D + Live DAG
                      </strong>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button className="studio-btn" onClick={() => studio.setActiveModal('preferences')}>
                    Open Full Preferences…
                  </button>
                  <button className="studio-btn" onClick={() => studio.setActiveModal('shortcuts')}>
                    Keyboard Shortcuts…
                  </button>
                  <button className="studio-btn" onClick={studio.purgeRamCache}>
                    Purge RAM Cache
                  </button>
                </div>
              </section>
            </div>
          )}
        </div>
      </main>

      {/* Quiet Footer Bar */}
      <footer
        style={{
          height: 30,
          padding: '0 24px',
          background: 'var(--bg-panel)',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 11,
          color: 'var(--text-muted)',
          flexShrink: 0,
        }}
      >
        <span>{studio.statusMessage}</span>
        <span className="mono">
          Local Storage Only · No Account · No Telemetry · Toggle Home/Studio: Alt+H
        </span>
      </footer>
    </div>
  );
};
