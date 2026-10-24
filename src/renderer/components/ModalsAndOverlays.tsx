import React, { useMemo, useState } from 'react';
import { useStudio } from '../state/StudioContext';
import { searchEffects } from '../../effects/registry';
import { detectShortcutConflicts, DEFAULT_SHORTCUTS, formatShortcut } from '../../utils/shortcuts';
import { deserializePrexProject } from '../../engine/serializer';
import { LocaleCode } from '../../utils/i18n';
import { diffObjectsSummary } from '../../utils/history';
import { GUIDED_TOUR_STEPS, WHATS_THIS_HELP_DB } from '../../utils/qolHelpers';

export const ModalsAndOverlays: React.FC = () => {
  const studio = useStudio();
  const [cmdQuery, setCmdQuery] = useState('');
  const [compName, setCompName] = useState('SHOT_050_VFX');
  const [compW, setCompW] = useState(1920);
  const [compH, setCompH] = useState(1080);
  const [compFps, setCompFps] = useState(60);
  const [compDur, setCompDur] = useState(10);
  const [rebindingId, setRebindingId] = useState<string | null>(null);

  const paletteItems = useMemo(() => {
    const q = cmdQuery.toLowerCase().trim();
    const commands = [
      { id: 'cmd_new_comp', title: 'New Composition…', badge: 'Comp', run: () => studio.setActiveModal('new-comp') },
      { id: 'cmd_add_text', title: 'New Text Layer', badge: 'Layer', run: () => studio.addLayerOfType('text') },
      { id: 'cmd_add_shape', title: 'New Vector Shape Layer', badge: 'Layer', run: () => studio.addLayerOfType('shape') },
      { id: 'cmd_add_cam', title: 'New 3D Camera (35mm)', badge: '3D', run: () => studio.addLayerOfType('camera') },
      { id: 'cmd_nodes', title: 'Switch to Bidirectional Node Graph', badge: 'View', run: () => studio.setBottomMode('nodes') },
      { id: 'cmd_graph', title: 'Open Speed / Value Graph Editor', badge: 'Anim', run: () => studio.setBottomMode('graph') },
      { id: 'cmd_ease', title: 'Easy Ease Selected Keyframes (F9)', badge: 'Anim', run: () => studio.applyKeyframeAssistant('easy-ease') },
      { id: 'cmd_smart_dup', title: 'Smart Duplicate Hierarchy (Ctrl+Alt+D)', badge: 'Edit', run: () => studio.duplicateSelectedLayers(true) },
      { id: 'cmd_render', title: 'Queue & Open Render Queue', badge: 'Export', run: () => studio.addCurrentCompToRenderQueue() },
      { id: 'cmd_theme', title: 'Toggle Dark / Precision Daylight Theme', badge: 'Theme', run: () => studio.updatePreferences({ theme: studio.preferences.theme === 'light' ? 'dark' : 'light' }) },
    ].filter((c) => !q || c.title.toLowerCase().includes(q));

    const fxMatches = searchEffects(q || 'blur').slice(0, 14).map((fx) => ({
      id: `fx_${fx.id}`,
      title: `Apply Effect: ${fx.name} (${fx.category})`,
      badge: 'Effect',
      run: () => studio.applyEffectToSelectedLayer(fx.id),
    }));

    return [...commands, ...fxMatches];
  }, [cmdQuery, studio]);

  if (studio.activeModal === 'none' && studio.tourStep === null && !studio.activeHelpId) return null;

  const close = () => {
    studio.setActiveModal('none');
    studio.setActiveHelpId(null);
  };

  // Interactive 5-Step Guided Onboarding Tour Overlay
  if (studio.tourStep !== null) {
    const step = GUIDED_TOUR_STEPS[studio.tourStep] ?? GUIDED_TOUR_STEPS[0];
    return (
      <div className="modal-backdrop" onClick={() => studio.setTourStep(null)}>
        <div className="modal-card" style={{ width: 500, padding: 20, gap: 12 }} onClick={(e) => e.stopPropagation()}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="badge amber">{step.targetArea}</span>
            <button className="studio-btn ghost" onClick={() => studio.setTourStep(null)}>Skip Tour</button>
          </div>
          <h3 style={{ fontSize: 16, fontWeight: 800 }}>{step.title}</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: 12.5, lineHeight: 1.55 }}>{step.body}</p>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
            <button
              className="studio-btn"
              disabled={studio.tourStep === 0}
              onClick={() => studio.setTourStep(Math.max(0, (studio.tourStep ?? 0) - 1))}
            >
              ← Back
            </button>
            <button
              className="studio-btn primary"
              onClick={() => {
                if ((studio.tourStep ?? 0) + 1 >= GUIDED_TOUR_STEPS.length) studio.setTourStep(null);
                else studio.setTourStep((studio.tourStep ?? 0) + 1);
              }}
            >
              {(studio.tourStep ?? 0) + 1 >= GUIDED_TOUR_STEPS.length ? 'Finish Tour' : 'Next Step →'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // What's This? Contextual Help Card (Shift+F1)
  if (studio.activeHelpId) {
    const topic = WHATS_THIS_HELP_DB[studio.activeHelpId] ?? WHATS_THIS_HELP_DB['panel.viewport'];
    return (
      <div className="modal-backdrop" onClick={() => studio.setActiveHelpId(null)}>
        <div className="modal-card" style={{ width: 480, padding: 18, gap: 10 }} onClick={(e) => e.stopPropagation()}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="badge cyan">What&apos;s This? Studio Reference</span>
            {topic.shortcut && <span className="mono badge amber">{topic.shortcut}</span>}
          </div>
          <h3 style={{ fontSize: 15, fontWeight: 700 }}>{topic.title}</h3>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>{topic.summary}</p>
          <div style={{ padding: 10, borderRadius: 6, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', fontSize: 11.5 }}>
            <strong style={{ color: 'var(--accent-amber)' }}>Studio Pro Tip:</strong> {topic.proTip}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
            <button className="studio-btn" onClick={() => { studio.setActiveHelpId(null); studio.setWhatsThisMode(false); }}>
              Exit Help Mode
            </button>
            <button className="studio-btn primary" onClick={() => studio.setActiveHelpId(null)}>
              Got It
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-backdrop" onClick={close}>
      {/* 1. COMMAND PALETTE (CTRL/CMD+K) */}
      {studio.activeModal === 'command-palette' && (
        <div className="modal-card" style={{ width: 560 }} onClick={(e) => e.stopPropagation()}>
          <div style={{ padding: 10, borderBottom: '1px solid var(--border-subtle)' }}>
            <input
              autoFocus
              className="studio-input"
              style={{ width: '100%', padding: '8px 10px', fontSize: 13 }}
              placeholder="Type a command, layer action, or any of the 186 effects…"
              value={cmdQuery}
              onChange={(e) => setCmdQuery(e.target.value)}
            />
          </div>
          <div style={{ maxHeight: 360, overflowY: 'auto', padding: 6, display: 'flex', flexDirection: 'column', gap: 3 }}>
            {paletteItems.map((item) => (
              <button
                key={item.id}
                className="studio-btn ghost"
                style={{ justifyContent: 'space-between', padding: '7px 10px' }}
                onClick={() => {
                  close();
                  item.run();
                }}
              >
                <span>{item.title}</span>
                <span className="badge amber">{item.badge}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 2. WELCOME & OFFLINE STUDIO LAUNCHER */}
      {studio.activeModal === 'welcome' && (
        <div className="modal-card" style={{ width: 640, padding: 20, gap: 14 }} onClick={(e) => e.stopPropagation()}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 800 }}>PreEffects — Motion Graphics &amp; VFX Studio</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                100% Local &amp; Offline · Zero Sign-In · Zero Telemetry · 186 Effects · Hybrid Layer + Node Compositor
              </p>
            </div>
            <button className="studio-btn" onClick={close}>Close</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              { id: 'orbital-hero' as const, name: 'Orbital Telemetry 3D Hero', meta: '1920×1080 · 60fps · Nested Precomp + 3D + LUT' },
              { id: 'kinetic-lower-third' as const, name: 'Broadcast Kinetic Typography', meta: '1920×1080 · 60fps · Per-Char 3D Range Selector' },
              { id: 'blank' as const, name: 'Clean Blank Composition', meta: 'Start fresh with empty 1080p60 timeline' },
            ].map((tpl) => (
              <div
                key={tpl.id}
                style={{
                  padding: 12,
                  borderRadius: 6,
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 13 }}>{tpl.name}</div>
                <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{tpl.meta}</div>
                <button
                  className="studio-btn primary"
                  onClick={() => {
                    studio.loadTemplateProject(tpl.id);
                    close();
                  }}
                >
                  Open Studio Project
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. NEW COMPOSITION / COMP SETTINGS MODAL */}
      {(studio.activeModal === 'new-comp' || studio.activeModal === 'comp-settings') && (
        <div className="modal-card" style={{ width: 460, padding: 18, gap: 12 }} onClick={(e) => e.stopPropagation()}>
          <h3 style={{ fontSize: 15, fontWeight: 700 }}>
            {studio.activeModal === 'new-comp' ? 'New Composition' : `Composition Settings — ${studio.activeComp?.name}`}
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 8, alignItems: 'center' }}>
            <span>Composition Name</span>
            <input className="studio-input" value={compName} onChange={(e) => setCompName(e.target.value)} />
            <span>Preset Resolution</span>
            <select
              className="studio-select"
              onChange={(e) => {
                const [w, h] = e.target.value.split('x').map(Number);
                setCompW(w); setCompH(h);
              }}
            >
              <option value="1920x1080">HD 1080p (1920 × 1080)</option>
              <option value="3840x2160">UHD 4K (3840 × 2160)</option>
              <option value="1080x1920">Vertical Social 9:16 (1080 × 1920)</option>
              <option value="1280x720">HD 720p (1280 × 720)</option>
            </select>
            <span>Width / Height (px)</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <input type="number" className="studio-input mono" style={{ flex: 1 }} value={compW} onChange={(e) => setCompW(Number(e.target.value))} />
              <input type="number" className="studio-input mono" style={{ flex: 1 }} value={compH} onChange={(e) => setCompH(Number(e.target.value))} />
            </div>
            <span>Frame Rate (fps)</span>
            <input type="number" className="studio-input mono" value={compFps} onChange={(e) => setCompFps(Number(e.target.value))} />
            <span>Duration (seconds)</span>
            <input type="number" className="studio-input mono" value={compDur} onChange={(e) => setCompDur(Number(e.target.value))} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button className="studio-btn" onClick={close}>Cancel</button>
            <button
              className="studio-btn primary"
              onClick={() => {
                if (studio.activeModal === 'new-comp') {
                  studio.createNewComposition(compName, compW, compH, compFps, compDur);
                } else {
                  studio.commitProjectChange('Update Composition Settings', (draft) => {
                    const c = draft.compositions.find((x) => x.id === draft.activeCompId);
                    if (c) {
                      c.name = compName;
                      c.width = compW;
                      c.height = compH;
                      c.fps = compFps;
                      c.duration = compDur;
                      c.workAreaEnd = Math.min(c.workAreaEnd, compDur);
                    }
                  });
                }
                close();
              }}
            >
              Apply
            </button>
          </div>
        </div>
      )}

      {/* 4. PREFERENCES, THEME, ACCESSIBILITY & KEYBOARD SHORTCUT EDITOR */}
      {studio.activeModal === 'preferences' && (
        <div className="modal-card" style={{ width: 620, padding: 18, gap: 12 }} onClick={(e) => e.stopPropagation()}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: 15, fontWeight: 700 }}>Studio Preferences, Color Management &amp; Shortcuts</h3>
            <button className="studio-btn" onClick={close}>Done</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span>Studio Theme</span>
              <select
                className="studio-select"
                value={studio.preferences.theme}
                onChange={(e) => studio.updatePreferences({ theme: e.target.value as 'dark' | 'light' | 'high-contrast' | 'custom' })}
              >
                <option value="dark">Precision Obsidian (Dark)</option>
                <option value="light">Precision Daylight (Light)</option>
                <option value="high-contrast">High Contrast Accessibility</option>
                <option value="custom">Custom Studio Accent Tokens</option>
              </select>
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span>UI Language (i18n)</span>
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

            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span>UI Density / Scale ({studio.preferences.uiScalePct}%)</span>
              <input
                type="range"
                min={85}
                max={125}
                step={5}
                value={studio.preferences.uiScalePct}
                onChange={(e) => studio.updatePreferences({ uiScalePct: Number(e.target.value) })}
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span>RAM Preview Cache Limit ({studio.preferences.maxRamCacheMb} MB)</span>
              <input
                type="range"
                min={128}
                max={2048}
                step={128}
                value={studio.preferences.maxRamCacheMb}
                onChange={(e) => studio.updatePreferences({ maxRamCacheMb: Number(e.target.value) })}
              />
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="checkbox"
                checked={studio.preferences.colorBlindSafeLabels}
                onChange={(e) => studio.updatePreferences({ colorBlindSafeLabels: e.target.checked })}
              />
              <span>Color-Blind Safe Layer Swatches (Okabe-Ito)</span>
            </label>

            {studio.preferences.theme === 'custom' && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>Custom Accent Color:</span>
                <input
                  type="color"
                  value={studio.preferences.customThemeTokens?.['--accent-amber'] ?? '#E89B3C'}
                  onChange={(e) =>
                    studio.updatePreferences({
                      customThemeTokens: {
                        ...(studio.preferences.customThemeTokens ?? {}),
                        '--accent-amber': e.target.value,
                      },
                    })
                  }
                />
              </label>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700 }}>
              Keyboard Shortcuts ({studio.shortcuts.length} bindings · {detectShortcutConflicts(studio.shortcuts).length} conflicts)
            </span>
            <button className="studio-btn" style={{ fontSize: 10.5 }} onClick={() => studio.updateShortcuts(DEFAULT_SHORTCUTS)}>
              Reset Defaults
            </button>
          </div>
          <div style={{ maxHeight: 190, overflowY: 'auto', border: '1px solid var(--border-subtle)', borderRadius: 5, padding: 6 }}>
            {studio.shortcuts.map((s) => (
              <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 6px', borderBottom: '1px solid var(--border-subtle)' }}>
                <span>{s.command} <span style={{ color: 'var(--text-muted)' }}>({s.category})</span></span>
                <button
                  className={`studio-btn ${rebindingId === s.id ? 'primary' : ''}`}
                  style={{ padding: '1px 7px', fontSize: 10.5 }}
                  onClick={() => setRebindingId(rebindingId === s.id ? null : s.id)}
                  onKeyDown={(e) => {
                    if (rebindingId !== s.id) return;
                    e.preventDefault();
                    e.stopPropagation();
                    if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;
                    const parts: string[] = [];
                    if (e.ctrlKey || e.metaKey) parts.push('Mod');
                    if (e.shiftKey) parts.push('Shift');
                    if (e.altKey) parts.push('Alt');
                    parts.push(e.key === ' ' ? 'Space' : e.key.length === 1 ? e.key.toUpperCase() : e.key);
                    const nextCombo = parts.join('+');
                    studio.updateShortcuts(studio.shortcuts.map((b) => (b.id === s.id ? { ...b, combo: nextCombo } : b)));
                    setRebindingId(null);
                  }}
                >
                  <span className="mono">{rebindingId === s.id ? 'Press key…' : formatShortcut(s)}</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. UNDO HISTORY & GIT SNAPSHOT RESTORE DRAWER */}
      {studio.activeModal === 'history' && (
        <div className="modal-card" style={{ width: 520, padding: 18, gap: 12 }} onClick={(e) => e.stopPropagation()}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: 15, fontWeight: 700 }}>Undo Stack &amp; Git Project Version Commits</h3>
            <button className="studio-btn" onClick={close}>Close</button>
          </div>

          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-amber)' }}>
            Undo History ({studio.undoEntries.length} steps)
          </div>
          <div style={{ maxHeight: 170, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
            {studio.undoEntries.length === 0 && <div style={{ color: 'var(--text-muted)' }}>Initial project state</div>}
            {studio.undoEntries.map((entry, idx) => (
              <button
                key={entry.id}
                className="studio-btn ghost"
                style={{ justifyContent: 'space-between' }}
                onClick={() => studio.jumpToHistoryIndex(idx)}
              >
                <span>{idx + 1}. {entry.label}</span>
                <span className="mono" style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                  {new Date(entry.timestamp).toLocaleTimeString()}
                </span>
              </button>
            ))}
          </div>

          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-purple)' }}>
            Saved In-Project Git Commits ({studio.project.versionCommits.length})
          </div>
          <div style={{ maxHeight: 140, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {studio.project.versionCommits.map((vc) => {
              const curSummary = (studio.activeComp?.layers ?? []).map((l) => ({
                id: l.id,
                name: l.name,
                effectsCount: l.effects.length,
                blendMode: l.blendMode,
              }));
              const diffs = diffObjectsSummary(vc.compSummary ?? [], curSummary);
              return (
                <div key={vc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 6, background: 'var(--bg-elevated)', borderRadius: 4 }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{vc.message}</div>
                    <div className="mono" style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                      {new Date(vc.timestamp).toLocaleString()} · {diffs.length} diff(s) vs live comp
                    </div>
                  </div>
                  <button
                    className="studio-btn"
                    onClick={() => {
                      const restored = deserializePrexProject(vc.serializedProject);
                      studio.commitProjectChange(`Restore Commit "${vc.message}"`, (draft) => {
                        const keepCommits = draft.versionCommits;
                        Object.assign(draft, restored);
                        draft.versionCommits = keepCommits;
                      });
                      close();
                    }}
                  >
                    Restore
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
