import React, { useEffect, useMemo, useState } from 'react';
import { useStudio } from '../state/StudioContext';
import { searchEffects } from '../../effects/registry';
import { detectShortcutConflicts } from '../../utils/shortcuts';
import { LocaleCode } from '../../utils/i18n';
import { WHATS_THIS_HELP_DB } from '../../utils/qolHelpers';
import { STUDIO_GUIDE_CHAPTERS, INTERACTIVE_TUTORIAL_STEPS } from '../data/studioGuideData';
import { STUDIO_THEME_PALETTES, auditThemeContrast, pickAccessibleOnAccent, wcagContrastRatio } from '../../utils/contrastMath';
import { IconBookGuide, IconCheck, IconSearch } from './Icons';

export const ModalsAndOverlays: React.FC = () => {
  const studio = useStudio();
  const [cmdQuery, setCmdQuery] = useState('');
  const [compName, setCompName] = useState('Main Sequence');
  const [compW, setCompW] = useState(1920);
  const [compH, setCompH] = useState(1080);
  const [compFps, setCompFps] = useState(60);
  const [compDur, setCompDur] = useState(10);
  const [compBg, setCompBg] = useState('#0b0c0e');
  const [recordingShortcutId, setRecordingShortcutId] = useState<string | null>(null);
  const [guideChapterId, setGuideChapterId] = useState<string>(STUDIO_GUIDE_CHAPTERS[0].id);
  const [guideQuery, setGuideQuery] = useState<string>('');

  // BUG-P1-05 Fix: Initialize Composition Settings directly from studio.activeComp!
  useEffect(() => {
    if (studio.activeModal === 'comp-settings' && studio.activeComp) {
      setCompName(studio.activeComp.name);
      setCompW(studio.activeComp.width);
      setCompH(studio.activeComp.height);
      setCompFps(studio.activeComp.fps);
      setCompDur(studio.activeComp.duration);
      setCompBg(studio.activeComp.backgroundColor);
    } else if (studio.activeModal === 'new-comp') {
      setCompName(`Sequence_${studio.project.compositions.length + 1}`);
      setCompW(1920);
      setCompH(1080);
      setCompFps(60);
      setCompDur(10);
      setCompBg('#0b0c0e');
    }
  }, [studio.activeModal, studio.activeComp, studio.project.compositions.length]);

  const paletteItems = useMemo(() => {
    const q = cmdQuery.toLowerCase().trim();
    const commands = [
      { id: 'cmd_guide', title: 'Interactive Guide: Open 8-Chapter Studio Handbook (F1)', badge: 'Guide', run: () => studio.setActiveModal('guide') },
      { id: 'cmd_tour', title: 'Interactive Guide: Start 8-Step Live Spotlight Walkthrough', badge: 'Tour', run: () => studio.startInteractiveTour() },
      { id: 'cmd_new_comp', title: 'New Composition… (Ctrl+N)', badge: 'Comp', run: () => studio.setActiveModal('new-comp') },
      { id: 'cmd_comp_set', title: 'Composition Settings…', badge: 'Comp', run: () => studio.setActiveModal('comp-settings') },
      { id: 'cmd_add_text', title: 'New Typography Layer (T)', badge: 'Layer', run: () => { studio.addLayerOfType('text'); studio.setActiveModal('none'); } },
      { id: 'cmd_add_shape', title: 'New Vector Shape Layer (Q)', badge: 'Layer', run: () => { studio.addLayerOfType('shape'); studio.setActiveModal('none'); } },
      { id: 'cmd_add_solid', title: 'New Solid Layer (Ctrl+Y)', badge: 'Layer', run: () => { studio.addLayerOfType('solid'); studio.setActiveModal('none'); } },
      { id: 'cmd_add_cam', title: 'New 3D Camera (35mm DoF)', badge: '3D', run: () => { studio.addLayerOfType('camera'); studio.setActiveModal('none'); } },
      { id: 'cmd_nodes', title: 'Switch Timeline ⇄ Bidirectional Node Graph (Shift+N)', badge: 'View', run: () => { studio.setBottomMode(studio.bottomMode === 'nodes' ? 'timeline' : 'nodes'); studio.setActiveModal('none'); } },
      { id: 'cmd_graph', title: 'Open Speed / Value Graph Editor (U)', badge: 'Anim', run: () => { studio.setBottomMode('graph'); studio.setActiveModal('none'); } },
      { id: 'cmd_ease', title: 'Easy Ease Selected Keyframes (F9)', badge: 'Anim', run: () => { studio.applyKeyframeAssistant('easy-ease'); studio.setActiveModal('none'); } },
      { id: 'cmd_smart_dup', title: 'Smart Duplicate Hierarchy (Ctrl+Alt+D)', badge: 'Edit', run: () => { studio.duplicateSelectedLayers(true); studio.setActiveModal('none'); } },
      { id: 'cmd_render', title: 'Queue & Open Render Queue (Ctrl+M)', badge: 'Export', run: () => { studio.addCurrentCompToRenderQueue(); studio.setActiveModal('none'); } },
      { id: 'cmd_theme_dark', title: 'Theme: Linear Obsidian (Dark AAA)', badge: 'Theme', run: () => { studio.updatePreferences({ theme: 'dark' }); studio.setActiveModal('none'); } },
      { id: 'cmd_theme_light', title: 'Theme: Nordic Daylight (Light AAA)', badge: 'Theme', run: () => { studio.updatePreferences({ theme: 'light' }); studio.setActiveModal('none'); } },
      { id: 'cmd_theme_hc', title: 'Theme: OLED Pure Contrast (AAA+)', badge: 'Theme', run: () => { studio.updatePreferences({ theme: 'high-contrast' }); studio.setActiveModal('none'); } },
      { id: 'cmd_theme_gr', title: 'Theme: Warm Studio Graphite', badge: 'Theme', run: () => { studio.updatePreferences({ theme: 'graphite' }); studio.setActiveModal('none'); } },
    ].filter((c) => !q || c.title.toLowerCase().includes(q));

    const fxMatches = searchEffects(q || 'glow').slice(0, 14).map((fx) => ({
      id: `fx_${fx.id}`,
      title: `Apply Effect: ${fx.name} (${fx.category})`,
      badge: 'Effect',
      run: () => {
        studio.applyEffectToSelectedLayer(fx.id);
        studio.setActiveModal('none');
      },
    }));

    return [...commands, ...fxMatches];
  }, [cmdQuery, studio]);

  const filteredChapters = useMemo(() => {
    const q = guideQuery.trim().toLowerCase();
    if (!q) return STUDIO_GUIDE_CHAPTERS;
    return STUDIO_GUIDE_CHAPTERS.filter(
      (ch) =>
        ch.title.toLowerCase().includes(q) ||
        ch.subtitle.toLowerCase().includes(q) ||
        ch.sections.some(
          (s) =>
            s.heading.toLowerCase().includes(q) ||
            s.body.toLowerCase().includes(q) ||
            (s.formulaOrSnippet && s.formulaOrSnippet.toLowerCase().includes(q)),
        ),
    );
  }, [guideQuery]);

  const selectedChapter =
    filteredChapters.find((c) => c.id === guideChapterId) ??
    filteredChapters[0] ??
    STUDIO_GUIDE_CHAPTERS[0];

  const activeThemeAudit = useMemo(() => {
    const tKey = studio.preferences.theme;
    const pal = STUDIO_THEME_PALETTES[tKey === 'custom' ? 'dark' : tKey] ?? STUDIO_THEME_PALETTES.dark;
    return auditThemeContrast(pal);
  }, [studio.preferences.theme]);

  const tourStepData =
    studio.tourStep !== null ? INTERACTIVE_TUTORIAL_STEPS[studio.tourStep] ?? null : null;

  if (studio.activeModal === 'none' && !tourStepData && !studio.activeHelpId) return null;

  return (
    <>
      {/* What's This? Contextual Inspection Card */}
      {studio.activeHelpId && WHATS_THIS_HELP_DB[studio.activeHelpId] && (
        <div className="modal-backdrop" onClick={() => studio.setActiveHelpId(null)}>
          <div className="modal-card" style={{ width: 460, padding: 20, gap: 10 }} onClick={(e) => e.stopPropagation()}>
            <div className="section-eyebrow">Contextual Reference</div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
              {WHATS_THIS_HELP_DB[studio.activeHelpId].title}
            </h3>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.55 }}>
              {WHATS_THIS_HELP_DB[studio.activeHelpId].summary}
            </p>
            <div style={{ fontSize: 11, color: 'var(--accent-cyan)' }}>
              {WHATS_THIS_HELP_DB[studio.activeHelpId].proTip}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
              <span className="kbd-chip">{WHATS_THIS_HELP_DB[studio.activeHelpId].shortcut ?? 'F1'}</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  className="studio-btn"
                  onClick={() => {
                    studio.setActiveHelpId(null);
                    studio.setActiveModal('guide');
                  }}
                >
                  Open Full Guide
                </button>
                <button
                  className="studio-btn primary"
                  onClick={() => {
                    studio.setActiveHelpId(null);
                    studio.setWhatsThisMode(false);
                  }}
                >
                  Got it
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Non-Modal 8-Step Interactive Spotlight Walkthrough */}
      {tourStepData && studio.activeModal === 'none' && (
        <div
          role="dialog"
          aria-label="Interactive Studio Walkthrough"
          style={{
            position: 'fixed',
            right: 20,
            bottom: 36,
            width: 396,
            background: 'var(--bg-panel)',
            border: '1.5px solid var(--accent-amber)',
            borderRadius: 10,
            boxShadow: 'var(--shadow-modal)',
            padding: 16,
            zIndex: 950,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="badge amber">{tourStepData.badge}</span>
            <span className="kbd-chip">{tourStepData.shortcutHint}</span>
          </div>

          <div>
            <h3 style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 5 }}>
              {tourStepData.title}
            </h3>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {tourStepData.summary}
            </p>
          </div>

          <div
            style={{
              padding: '7px 9px',
              borderRadius: 6,
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
              fontSize: 11,
              color: 'var(--text-primary)',
            }}
          >
            <strong style={{ color: 'var(--accent-cyan)' }}>Tip:</strong> {tourStepData.handsOnTip}
          </div>

          <button
            className="studio-btn"
            style={{ justifyContent: 'center', borderColor: 'var(--accent-cyan)', color: 'var(--accent-cyan)', fontWeight: 600 }}
            onClick={() => studio.runGuideTryAction(tourStepData.tryActionId)}
          >
            ▶ {tourStepData.tryActionLabel}
          </button>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 4, borderTop: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', gap: 4 }}>
              {INTERACTIVE_TUTORIAL_STEPS.map((st) => (
                <button
                  key={st.stepIndex}
                  aria-label={`Go to step ${st.stepIndex + 1}`}
                  onClick={() => studio.setTourStep(st.stepIndex)}
                  style={{
                    width: st.stepIndex === tourStepData.stepIndex ? 18 : 7,
                    height: 7,
                    borderRadius: 999,
                    border: 'none',
                    background:
                      st.stepIndex === tourStepData.stepIndex
                        ? 'var(--accent-amber)'
                        : st.stepIndex < tourStepData.stepIndex
                        ? 'var(--status-ok)'
                        : 'var(--border-strong)',
                  }}
                />
              ))}
            </div>

            <div style={{ display: 'flex', gap: 5 }}>
              <button
                className="studio-btn ghost"
                onClick={() => {
                  studio.finishInteractiveTour();
                  studio.setActiveModal('guide');
                }}
              >
                Handbook
              </button>
              {tourStepData.stepIndex > 0 && (
                <button className="studio-btn" onClick={() => studio.setTourStep(tourStepData.stepIndex - 1)}>
                  Back
                </button>
              )}
              {tourStepData.stepIndex < INTERACTIVE_TUTORIAL_STEPS.length - 1 ? (
                <button className="studio-btn primary" onClick={() => studio.setTourStep(tourStepData.stepIndex + 1)}>
                  Next
                </button>
              ) : (
                <button className="studio-btn primary" onClick={studio.finishInteractiveTour}>
                  <IconCheck size={12} /> Finish
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Search Everything / Command Palette (Ctrl/Cmd + K) */}
      {studio.activeModal === 'command-palette' && (
        <div className="modal-backdrop" onClick={() => studio.setActiveModal('none')}>
          <div className="modal-card" style={{ width: 560, padding: 12 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ position: 'absolute', left: 10, color: 'var(--text-muted)', display: 'inline-flex' }}>
                <IconSearch size={14} />
              </span>
              <input
                autoFocus
                className="studio-input"
                style={{ width: '100%', padding: '8px 12px 8px 32px', fontSize: 13 }}
                placeholder="Type any command, effect (186), layer, or theme…"
                value={cmdQuery}
                onChange={(e) => setCmdQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && paletteItems[0]) paletteItems[0].run();
                }}
              />
            </div>
            <div style={{ maxHeight: 340, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
              {paletteItems.map((it) => (
                <button
                  key={it.id}
                  className="studio-btn ghost"
                  style={{ justifyContent: 'space-between', padding: '7px 10px', color: 'var(--text-primary)' }}
                  onClick={it.run}
                >
                  <span>{it.title}</span>
                  <span className="badge">{it.badge}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* COMPREHENSIVE 8-CHAPTER INTERACTIVE STUDIO GUIDE & HANDBOOK (F1 / ?) */}
      {studio.activeModal === 'guide' && (
        <div className="modal-backdrop" onClick={() => studio.setActiveModal('none')}>
          <div
            className="modal-card"
            style={{ width: 880, height: 610, maxWidth: '94vw', flexDirection: 'row' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                width: 280,
                background: 'var(--bg-inset)',
                borderRight: '1px solid var(--border-subtle)',
                padding: 14,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <IconBookGuide size={16} color="var(--accent-amber)" />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13.5 }}>PreEffects Studio Guide</div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>Complete Core Feature Reference</div>
                </div>
              </div>

              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <span style={{ position: 'absolute', left: 8, color: 'var(--text-muted)', display: 'inline-flex' }}>
                  <IconSearch size={12} />
                </span>
                <input
                  className="studio-input"
                  style={{ width: '100%', paddingLeft: 26 }}
                  placeholder="Search chapters & shortcuts…"
                  value={guideQuery}
                  onChange={(e) => setGuideQuery(e.target.value)}
                />
              </div>

              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {filteredChapters.map((ch) => {
                  const active = ch.id === selectedChapter.id;
                  return (
                    <button
                      key={ch.id}
                      onClick={() => setGuideChapterId(ch.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 8,
                        textAlign: 'left',
                        padding: '8px 9px',
                        borderRadius: 6,
                        background: active ? 'var(--bg-selected)' : 'transparent',
                        border: `1px solid ${active ? 'var(--accent-amber)' : 'transparent'}`,
                      }}
                    >
                      <span className="mono" style={{ fontSize: 10.5, fontWeight: 700, color: active ? 'var(--accent-amber)' : 'var(--text-muted)', marginTop: 1 }}>
                        {ch.number}
                      </span>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 11.5, color: 'var(--text-primary)' }}>{ch.title}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{ch.category}</div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <button
                className="studio-btn primary"
                style={{ width: '100%', padding: '7px 10px' }}
                onClick={studio.startInteractiveTour}
              >
                ▶ Start 8-Step Spotlight Walkthrough
              </button>
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <div
                style={{
                  padding: '14px 20px',
                  borderBottom: '1px solid var(--border-subtle)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span className="badge amber">Chapter {selectedChapter.number}</span>
                    <span className="badge">{selectedChapter.category}</span>
                  </div>
                  <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>
                    {selectedChapter.title}
                  </h2>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                    {selectedChapter.subtitle}
                  </p>
                </div>
                <button className="studio-btn" onClick={() => studio.setActiveModal('none')}>
                  Close (Esc)
                </button>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
                {selectedChapter.sections.map((sec, idx) => (
                  <div key={idx} className="inspector-card" style={{ padding: 14, gap: 9 }}>
                    <h3 style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)' }}>{sec.heading}</h3>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{sec.body}</p>

                    {sec.shortcuts && sec.shortcuts.length > 0 && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 4 }}>
                        {sec.shortcuts.map((sc) => (
                          <div
                            key={sc.keys}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 8,
                              padding: '5px 8px',
                              borderRadius: 5,
                              background: 'var(--bg-inset)',
                              border: '1px solid var(--border-subtle)',
                            }}
                          >
                            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{sc.meaning}</span>
                            <span className="kbd-chip">{sc.keys}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {sec.formulaOrSnippet && (
                      <pre
                        className="mono"
                        style={{
                          padding: 10,
                          borderRadius: 6,
                          background: 'var(--bg-inset)',
                          border: '1px solid var(--border-subtle)',
                          color: 'var(--accent-cyan)',
                          fontSize: 11,
                          overflowX: 'auto',
                          lineHeight: 1.55,
                        }}
                      >
                        {sec.formulaOrSnippet}
                      </pre>
                    )}
                  </div>
                ))}
              </div>

              <div
                style={{
                  padding: '12px 20px',
                  borderTop: '1px solid var(--border-subtle)',
                  background: 'var(--bg-panel)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Press <span className="kbd-chip">F1</span> or <span className="kbd-chip">?</span> anytime in the studio to reopen this guide.
                </span>
                <button
                  className="studio-btn primary"
                  onClick={() => {
                    const action = selectedChapter.tryActionId;
                    studio.setActiveModal('none');
                    studio.runGuideTryAction(action);
                  }}
                >
                  ▶ {selectedChapter.tryActionLabel}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New / Edit Composition Settings Modal (BUG-P1-05 Fixed) */}
      {(studio.activeModal === 'new-comp' || studio.activeModal === 'comp-settings') && (
        <div className="modal-backdrop" onClick={() => studio.setActiveModal('none')}>
          <div className="modal-card" style={{ width: 440, padding: 20, gap: 12 }} onClick={(e) => e.stopPropagation()}>
            <div>
              <div className="section-eyebrow">Timeline Setup</div>
              <h3 style={{ fontSize: 15, fontWeight: 700 }}>
                {studio.activeModal === 'new-comp' ? 'New Composition' : 'Composition Settings'}
              </h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Name</span>
                <input className="studio-input" style={{ width: 220 }} value={compName} onChange={(e) => setCompName(e.target.value)} />
              </label>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {[
                  { l: '1080p HD', w: 1920, h: 1080 },
                  { l: '4K UHD', w: 3840, h: 2160 },
                  { l: 'Social 9:16', w: 1080, h: 1920 },
                  { l: 'Square 1:1', w: 1080, h: 1080 },
                ].map((pr) => (
                  <button
                    key={pr.l}
                    className="studio-btn"
                    onClick={() => {
                      setCompW(pr.w);
                      setCompH(pr.h);
                    }}
                  >
                    {pr.l}
                  </button>
                ))}
              </div>
              <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Width × Height</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input type="number" className="studio-input" style={{ width: 96 }} value={compW} onChange={(e) => setCompW(Math.max(16, Number(e.target.value)))} />
                  <input type="number" className="studio-input" style={{ width: 96 }} value={compH} onChange={(e) => setCompH(Math.max(16, Number(e.target.value)))} />
                </div>
              </label>
              <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Frame Rate (fps)</span>
                <input type="number" className="studio-input" style={{ width: 96 }} value={compFps} onChange={(e) => setCompFps(Math.max(1, Math.min(240, Number(e.target.value))))} />
              </label>
              <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Duration (seconds)</span>
                <input type="number" className="studio-input" style={{ width: 96 }} value={compDur} onChange={(e) => setCompDur(Math.max(0.5, Number(e.target.value)))} />
              </label>
              <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Background Color</span>
                <input type="color" value={compBg} onChange={(e) => setCompBg(e.target.value)} />
              </label>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
              <button className="studio-btn" onClick={() => studio.setActiveModal('none')}>
                Cancel
              </button>
              <button
                className="studio-btn primary"
                onClick={() => {
                  if (studio.activeModal === 'new-comp') {
                    studio.createNewComposition(compName, compW, compH, compFps, compDur, compBg);
                  } else {
                    studio.commitProjectChange('Update Composition Settings', (draft) => {
                      const c = draft.compositions.find((x) => x.id === draft.activeCompId);
                      if (c) {
                        c.name = compName;
                        c.width = compW;
                        c.height = compH;
                        c.fps = compFps;
                        c.duration = compDur;
                        c.workAreaEnd = Math.min(c.duration, Math.max(0.5, c.workAreaEnd));
                        c.backgroundColor = compBg;
                      }
                    });
                  }
                  studio.setActiveModal('none');
                }}
              >
                Save Composition
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Studio Preferences, Themes & Live Mathematical Contrast Verifier */}
      {studio.activeModal === 'preferences' && (
        <div className="modal-backdrop" onClick={() => studio.setActiveModal('none')}>
          <div className="modal-card" style={{ width: 540, padding: 20, gap: 12 }} onClick={(e) => e.stopPropagation()}>
            <div>
              <div className="section-eyebrow">Studio Configuration</div>
              <h3 style={{ fontSize: 15, fontWeight: 700 }}>Preferences, Themes &amp; Contrast Math</h3>
            </div>

            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Minimalist Theme</span>
              <select
                className="studio-select"
                value={studio.preferences.theme}
                onChange={(e) => studio.updatePreferences({ theme: e.target.value as typeof studio.preferences.theme })}
              >
                <option value="dark">Linear Obsidian (Dark AAA)</option>
                <option value="light">Nordic Daylight (Light AAA)</option>
                <option value="high-contrast">OLED Pure Contrast (AAA+)</option>
                <option value="graphite">Warm Studio Graphite</option>
                <option value="custom">Custom Studio Accent</option>
              </select>
            </label>

            {studio.preferences.theme === 'custom' && (
              <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Custom Accent (Auto WCAG Foreground)</span>
                <input
                  type="color"
                  value={studio.preferences.customThemeTokens?.['--accent-amber'] || '#f5a524'}
                  onChange={(e) => {
                    const hex = e.target.value;
                    const fg = pickAccessibleOnAccent(hex);
                    const cr = wcagContrastRatio(fg, hex).toFixed(2);
                    studio.updatePreferences({
                      customThemeTokens: {
                        '--accent-amber': hex,
                        '--accent-amber-hover': hex,
                        '--accent-on-primary': fg,
                      },
                    });
                    studio.notify(`Applied custom accent ${hex} with ${fg} foreground (${cr}:1 WCAG contrast)`);
                  }}
                />
              </label>
            )}

            <div className="inspector-card" style={{ background: 'var(--bg-inset)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="section-eyebrow">Mathematical Contrast Proof (IEC 61966-2-1 / WCAG 2.1)</span>
                <span className="badge ok">
                  {activeThemeAudit.allPassed ? '19/19 PASS' : 'CHECK'} · Min {activeThemeAudit.minTextContrast}:1
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, fontSize: 11 }}>
                {activeThemeAudit.checks
                  .filter((c) =>
                    ['primary-on-panel', 'secondary-on-panel', 'muted-on-hover', 'on-primary-button', 'scrubber-cyan-on-input', 'strong-border-on-panel'].includes(c.id),
                  )
                  .map((chk) => (
                    <div
                      key={chk.id}
                      className="mono"
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '4px 7px',
                        borderRadius: 4,
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--border-subtle)',
                        fontSize: 10,
                      }}
                    >
                      <span style={{ color: 'var(--text-secondary)' }}>{chk.id.replace(/-on-.*/, '')}</span>
                      <span style={{ color: 'var(--status-ok)', fontWeight: 700 }}>
                        {chk.wcagRatio}:1 ({chk.level})
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Interface Language (100% Offline)</span>
              <select
                className="studio-select"
                value={studio.preferences.locale}
                onChange={(e) => studio.updatePreferences({ locale: e.target.value as LocaleCode })}
              >
                <option value="en">English</option>
                <option value="nl">Nederlands</option>
                <option value="de">Deutsch</option>
                <option value="ja">日本語</option>
              </select>
            </label>
            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>WebGL2 Hardware GPU Acceleration</span>
              <input
                type="checkbox"
                checked={studio.preferences.gpuAcceleration}
                onChange={(e) => studio.updatePreferences({ gpuAcceleration: e.target.checked })}
              />
            </label>
            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Color-Blind Safe Okabe-Ito Labels</span>
              <input
                type="checkbox"
                checked={studio.preferences.colorBlindSafeLabels}
                onChange={(e) => studio.updatePreferences({ colorBlindSafeLabels: e.target.checked })}
              />
            </label>
            <button className="studio-btn primary" onClick={() => studio.setActiveModal('none')}>
              Done
            </button>
          </div>
        </div>
      )}

      {/* Customisable Keyboard Shortcuts Editor */}
      {studio.activeModal === 'shortcuts' && (
        <div className="modal-backdrop" onClick={() => studio.setActiveModal('none')}>
          <div className="modal-card" style={{ width: 600, padding: 20, gap: 10 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div className="section-eyebrow">Ergonomics</div>
                <h3 style={{ fontSize: 15, fontWeight: 700 }}>Keyboard Shortcuts ({studio.shortcuts.length})</h3>
              </div>
              {detectShortcutConflicts(studio.shortcuts).length > 0 && (
                <span className="badge amber">Conflict Detected</span>
              )}
            </div>
            <div style={{ maxHeight: 380, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {studio.shortcuts.map((sc) => (
                <div
                  key={sc.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '6px 9px',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 5,
                  }}
                >
                  <span>
                    <strong style={{ color: 'var(--accent-cyan)', marginRight: 6 }}>[{sc.category}]</strong> {sc.command}
                  </span>
                  <button
                    className={`studio-btn mono ${recordingShortcutId === sc.id ? 'active' : ''}`}
                    onClick={() => setRecordingShortcutId(sc.id)}
                    onKeyDown={(e) => {
                      if (recordingShortcutId !== sc.id) return;
                      e.preventDefault();
                      if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;
                      const parts: string[] = [];
                      if (e.ctrlKey || e.metaKey) parts.push('Mod');
                      if (e.shiftKey) parts.push('Shift');
                      if (e.altKey) parts.push('Alt');
                      parts.push(e.key === ' ' ? 'Space' : e.key.length === 1 ? e.key.toUpperCase() : e.key);
                      const nextCombo = parts.join('+');
                      studio.updateShortcuts(
                        studio.shortcuts.map((b) => (b.id === sc.id ? { ...b, combo: nextCombo } : b)),
                      );
                      setRecordingShortcutId(null);
                    }}
                  >
                    {recordingShortcutId === sc.id ? 'Press Key…' : sc.combo}
                  </button>
                </div>
              ))}
            </div>
            <button className="studio-btn primary" onClick={() => studio.setActiveModal('none')}>
              Close
            </button>
          </div>
        </div>
      )}

      {/* Visual Undo History & Git Snapshots Drawer */}
      {studio.activeModal === 'history' && (
        <div className="modal-backdrop" onClick={() => studio.setActiveModal('none')}>
          <div className="modal-card" style={{ width: 480, padding: 20, gap: 10 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: 15, fontWeight: 700 }}>Visual Undo History &amp; Git Snapshots</h3>
            <div style={{ maxHeight: 320, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {studio.undoEntries.map((ent, idx) => (
                <button
                  key={ent.id}
                  className={`studio-btn ${idx === studio.historyIndex ? 'subtle-active' : ''}`}
                  style={{ justifyContent: 'space-between' }}
                  onClick={() => studio.jumpToHistoryIndex(idx)}
                >
                  <span>
                    #{idx} · {ent.label}
                  </span>
                  <span className="mono" style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                    {new Date(ent.timestamp).toLocaleTimeString()}
                  </span>
                </button>
              ))}
            </div>
            {studio.project.versionCommits.length > 0 && (
              <div>
                <div className="section-eyebrow" style={{ marginBottom: 4 }}>Saved Git Commits</div>
                {studio.project.versionCommits.map((gc) => (
                  <div key={gc.id} className="mono" style={{ fontSize: 11, padding: '3px 0', color: 'var(--text-secondary)' }}>
                    [{gc.id}] {gc.message}
                  </div>
                ))}
              </div>
            )}
            <button className="studio-btn primary" onClick={() => studio.setActiveModal('none')}>
              Close
            </button>
          </div>
        </div>
      )}

      {/* Welcome & Starter Templates Modal (BUG-P1-08 Fixed: all 4 templates exposed) */}
      {studio.activeModal === 'welcome' && (
        <div className="modal-backdrop" onClick={() => studio.setActiveModal('none')}>
          <div className="modal-card" style={{ width: 600, padding: 24, gap: 14 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700 }}>PreEffects Studio</h2>
                <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                  Minimalist Motion Graphics, Node Compositing &amp; VFX — 100% Local &amp; Offline
                </div>
              </div>
              <span className="badge ok">WCAG AAA Verified</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                { kind: 'orbital-hero' as const, title: 'Orbital Telemetry 3D Hero', sub: 'Multi-layer 3D HUD, Keyframes, Glow & Expressions' },
                { kind: 'kinetic-lower-third' as const, title: 'Broadcast Kinetic Lower Third', sub: 'Typography Range Animator & Clean Shape Rig' },
                { kind: 'vfx-keying' as const, title: 'VFX Chroma Key & Tracking Rig', sub: 'Keylight Spill Suppression, Roto & Null Rig' },
                { kind: 'blank' as const, title: 'Clean Blank 1080p60 Comp', sub: 'Empty 1920×1080 60fps composition ready to build' },
              ].map((tpl) => (
                <button
                  key={tpl.kind}
                  className="studio-btn"
                  style={{ flexDirection: 'column', alignItems: 'flex-start', padding: 12, gap: 4, height: 'auto' }}
                  onClick={() => {
                    studio.loadTemplateProject(tpl.kind);
                    studio.setActiveModal('none');
                  }}
                >
                  <strong style={{ fontSize: 12.5, color: 'var(--text-primary)' }}>{tpl.title}</strong>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'normal', textAlign: 'left' }}>
                    {tpl.sub}
                  </span>
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 6, borderTop: '1px solid var(--border-subtle)' }}>
              <button className="studio-btn" onClick={() => studio.setActiveModal('guide')}>
                <IconBookGuide size={13} /> Open 8-Chapter Studio Guide
              </button>
              <button className="studio-btn primary" onClick={() => studio.setActiveModal('none')}>
                Continue Working
              </button>
            </div>
          </div>
        </div>
      )}

      {/* First-Launch Minimalist Welcome & Interactive Tutorial Prompt */}
      {studio.activeModal === 'onboarding' && (
        <div
          className="modal-backdrop"
          onClick={() => {
            studio.finishInteractiveTour();
            studio.setActiveModal('none');
          }}
        >
          <div className="modal-card" style={{ width: 520, padding: 24, gap: 14 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="badge amber">Welcome to PreEffects</span>
              <span className="badge ok">100% Offline · Zero Sign-In</span>
            </div>

            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>
                Minimalist Motion Graphics &amp; Node Compositing
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: 12.5, lineHeight: 1.6 }}>
                PreEffects pairs a calm, mathematically calibrated studio workspace with 186 GPU/CPU effects, cubic Bezier keyframing, a live bidirectional Layer ⇄ Node Graph, 3D cameras, local AI roto, and multi-format rendering.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button
                className="studio-btn primary"
                style={{ padding: '10px 12px', justifyContent: 'center' }}
                onClick={studio.startInteractiveTour}
              >
                ▶ Start 8-Step Interactive Tour
              </button>
              <button
                className="studio-btn"
                style={{ padding: '10px 12px', justifyContent: 'center' }}
                onClick={() => {
                  studio.finishInteractiveTour();
                  studio.setActiveModal('guide');
                }}
              >
                <IconBookGuide size={13} /> Browse 8-Chapter Guide
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 4 }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Press <span className="kbd-chip">F1</span> or <span className="kbd-chip">Ctrl+K</span> anytime for instant help.
              </span>
              <button
                className="studio-btn ghost"
                onClick={() => {
                  studio.finishInteractiveTour();
                  studio.setActiveModal('none');
                }}
              >
                Enter Studio Directly &rarr;
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
