import React, { useMemo, useRef, useState } from 'react';
import { useStudio } from '../state/StudioContext';
import { EFFECT_CATEGORIES, EFFECTS_CATALOG, searchEffects, SMART_ADAPTIVE_PRESETS } from '../../effects/registry';
import { createDefaultTransform, createId } from '../../engine/factory';

export const ProjectAndAssetsPanel: React.FC<{ widthPx?: number }> = ({ widthPx = 288 }) => {
  const studio = useStudio();
  const [binSearch, setBinSearch] = useState('');
  const [fxSearch, setFxSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState<string>('All');
  const fileRef = useRef<HTMLInputElement>(null);

  const filteredEffects = useMemo(() => {
    const list = fxSearch.trim() ? searchEffects(fxSearch) : EFFECTS_CATALOG;
    if (selectedCat === 'Favorites') {
      return list.filter((e) => studio.project.favoriteEffectIds.includes(e.id));
    }
    if (selectedCat !== 'All') {
      return list.filter((e) => e.category === selectedCat);
    }
    return list;
  }, [fxSearch, selectedCat, studio.project.favoriteEffectIds]);

  const toggleFavoriteEffect = (effectId: string) => {
    studio.commitProjectChange('Toggle Favorite Effect', (draft) => {
      const idx = draft.favoriteEffectIds.indexOf(effectId);
      if (idx >= 0) draft.favoriteEffectIds.splice(idx, 1);
      else draft.favoriteEffectIds.push(effectId);
    });
  };

  const addAssetToActiveComp = (assetId: string, name: string, kind: string) => {
    studio.commitProjectChange(`Place "${name}" in Comp`, (draft) => {
      const comp = draft.compositions.find((c) => c.id === draft.activeCompId);
      if (!comp) return;
      comp.layers.unshift({
        id: createId('lyr'),
        name,
        type: kind === 'audio' ? 'audio' : 'footage',
        assetId,
        labelColor: kind === 'mesh3d' ? '#38BDF8' : '#7CC69B',
        visible: true,
        audioEnabled: kind === 'audio',
        solo: false,
        locked: false,
        shy: false,
        collapseTransformations: false,
        frameBlending: 'off',
        motionBlur: false,
        threeD: kind === 'mesh3d',
        inPoint: 0,
        outPoint: comp.duration,
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
      });
    });
    studio.notify(`Added "${name}" to ${studio.activeComp?.name}`);
  };

  const toggleMissingDemo = (assetId: string) => {
    studio.commitProjectChange('Toggle Relink / Missing Footage State', (draft) => {
      const a = draft.assets.find((x) => x.id === assetId);
      if (a) a.missing = !a.missing;
    });
  };

  return (
    <aside
      style={{
        width: widthPx,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-panel)',
        borderRight: '1px solid var(--border-subtle)',
        overflow: 'hidden',
      }}
    >
      <input
        ref={fileRef}
        type="file"
        style={{ display: 'none' }}
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          studio.importLocalFileContent(f.name, await f.text());
          e.target.value = '';
        }}
      />

      <div className="panel-header">
        <div className="panel-tabs">
          <button className={`panel-tab ${studio.leftTab === 'project' ? 'active' : ''}`} onClick={() => studio.setLeftTab('project')}>
            Project
          </button>
          <button className={`panel-tab ${studio.leftTab === 'effects' ? 'active' : ''}`} onClick={() => studio.setLeftTab('effects')}>
            Effects ({EFFECTS_CATALOG.length})
          </button>
          <button className={`panel-tab ${studio.leftTab === 'library' ? 'active' : ''}`} onClick={() => studio.setLeftTab('library')}>
            Library
          </button>
        </div>
      </div>

      {/* TAB 1: PROJECT BIN */}
      {studio.leftTab === 'project' && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', padding: 8, gap: 8 }}>
          <div style={{ display: 'flex', gap: 4 }}>
            <input
              className="studio-input"
              style={{ flex: 1 }}
              placeholder="Search comps & footage…"
              value={binSearch}
              onChange={(e) => setBinSearch(e.target.value)}
            />
            <button className="studio-btn" onClick={() => fileRef.current?.click()} title="Import local footage, .obj, .csv, .edl, or .prex">
              + Import
            </button>
            <button className="studio-btn" onClick={() => studio.setActiveModal('new-comp')} title="New Composition">
              + Comp
            </button>
          </div>

          <div
            style={{
              padding: '6px 8px',
              borderRadius: 5,
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
              fontSize: 11,
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <span style={{ fontWeight: 600 }}>{studio.project.name}</span>
            <span className="mono" style={{ color: 'var(--accent-amber)' }}>
              {studio.project.bitDepth}bpc · {studio.project.workingColorSpace.toUpperCase()}
            </span>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Compositions ({studio.project.compositions.length})
            </div>
            {studio.project.compositions
              .filter((c) => c.name.toLowerCase().includes(binSearch.toLowerCase()))
              .map((c) => {
                const isActive = c.id === studio.project.activeCompId;
                return (
                  <div
                    key={c.id}
                    onClick={() => studio.openActiveComp(c.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 8px',
                      borderRadius: 4,
                      cursor: 'pointer',
                      background: isActive ? 'var(--bg-selected)' : 'var(--bg-elevated)',
                      border: `1px solid ${isActive ? 'var(--accent-amber)' : 'var(--border-subtle)'}`,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, color: isActive ? 'var(--accent-amber)' : 'var(--text-primary)' }}>
                        {c.name}
                      </div>
                      <div className="mono" style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                        {c.width}×{c.height} · {c.fps}fps · {c.duration}s
                      </div>
                    </div>
                    <span className="badge">{c.layers.length}L</span>
                  </div>
                );
              })}

            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 6 }}>
              Footage, 3D Models &amp; Data ({studio.project.assets.length})
            </div>
            {studio.project.assets
              .filter((a) => a.name.toLowerCase().includes(binSearch.toLowerCase()))
              .map((asset) => (
                <div
                  key={asset.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '5px 8px',
                    borderRadius: 4,
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div style={{ overflow: 'hidden' }}>
                    <div style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {asset.missing ? '⚠ ' : ''}{asset.name}
                    </div>
                    <div className="mono" style={{ fontSize: 10, color: asset.missing ? 'var(--status-err)' : 'var(--text-muted)' }}>
                      {asset.folder} · {asset.kind.toUpperCase()} {asset.missing ? '(MISSING)' : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 3 }}>
                    <button
                      className="studio-btn"
                      style={{ padding: '2px 6px', fontSize: 10 }}
                      onClick={() => toggleMissingDemo(asset.id)}
                      title="Simulate Missing / Relinked Footage"
                    >
                      {asset.missing ? 'Relink' : 'Unlink'}
                    </button>
                    <button
                      className="studio-btn primary"
                      style={{ padding: '2px 6px', fontSize: 10 }}
                      onClick={() => addAssetToActiveComp(asset.id, asset.name, asset.kind)}
                      title="Insert into Active Composition"
                    >
                      + Place
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* TAB 2: ALL 186 BUILT-IN EFFECTS + SMART ADAPTIVE PRESETS */}
      {studio.leftTab === 'effects' && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', padding: 8, gap: 6 }}>
          <input
            className="studio-input"
            placeholder="Search 186 effects (Blur, Keylight, Glow, AI)…"
            value={fxSearch}
            onChange={(e) => setFxSearch(e.target.value)}
          />
          <select
            className="studio-select"
            value={selectedCat}
            onChange={(e) => setSelectedCat(e.target.value)}
          >
            <option value="All">All 19 Categories ({EFFECTS_CATALOG.length})</option>
            <option value="Favorites">★ Favorites ({studio.project.favoriteEffectIds.length})</option>
            {EFFECT_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {/* Smart Adaptive Presets Section */}
            {selectedCat === 'All' && !fxSearch && (
              <div style={{ marginBottom: 6 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent-amber)', textTransform: 'uppercase', marginBottom: 4 }}>
                  Smart Resolution-Adaptive Presets
                </div>
                {SMART_ADAPTIVE_PRESETS.map((preset) => (
                  <div
                    key={preset.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '5px 7px',
                      marginBottom: 3,
                      borderRadius: 4,
                      background: 'var(--bg-elevated)',
                      border: '1px solid rgba(232, 155, 60, 0.3)',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 11 }}>{preset.name}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{preset.description}</div>
                    </div>
                    <button
                      className="studio-btn primary"
                      style={{ padding: '2px 7px', fontSize: 10 }}
                      onClick={() => studio.applySmartPresetToSelectedLayer(preset.id)}
                    >
                      Apply
                    </button>
                  </div>
                ))}
              </div>
            )}

            {filteredEffects.map((fx) => {
              const isFav = studio.project.favoriteEffectIds.includes(fx.id);
              return (
                <div
                  key={fx.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '5px 7px',
                    borderRadius: 4,
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div style={{ overflow: 'hidden', paddingRight: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ fontWeight: 600, fontSize: 11 }}>{fx.name}</span>
                      {fx.gpuAccelerated && <span className="badge cyan" style={{ fontSize: 9, padding: '0 4px' }}>GPU</span>}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {fx.category} — {fx.description}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                    <button
                      className="studio-btn ghost"
                      style={{ padding: '2px 5px', color: isFav ? 'var(--accent-amber)' : 'var(--text-muted)' }}
                      onClick={() => toggleFavoriteEffect(fx.id)}
                      title="Pin to Favorite Effects"
                    >
                      ★
                    </button>
                    <button
                      className="studio-btn"
                      style={{ padding: '2px 7px', fontSize: 10.5 }}
                      onClick={() => studio.applyEffectToSelectedLayer(fx.id)}
                    >
                      + Add
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: OFFLINE LOCAL ASSET & EXPRESSION LIBRARY */}
      {studio.leftTab === 'library' && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto', padding: 8, gap: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Starter Studio Templates (100% Local)
          </div>
          {[
            { id: 'orbital-hero' as const, title: 'Orbital Telemetry 3D Hero', desc: 'Nested HUD precomp, 3D Camera/Light, ACES LUT' },
            { id: 'kinetic-lower-third' as const, title: 'Broadcast Kinetic Lower Third', desc: 'Per-char 3D range animator & reticle frame' },
            { id: 'blank' as const, title: 'Clean Blank 1080p60 Comp', desc: 'Empty composition ready from scratch' },
          ].map((tpl) => (
            <div
              key={tpl.id}
              style={{
                padding: 8,
                borderRadius: 5,
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                gap: 5,
              }}
            >
              <div style={{ fontWeight: 600 }}>{tpl.title}</div>
              <div style={{ fontSize: 10.5, color: 'var(--text-secondary)' }}>{tpl.desc}</div>
              <button className="studio-btn" onClick={() => studio.loadTemplateProject(tpl.id)}>
                Load Studio Project
              </button>
            </div>
          ))}

          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: 4 }}>
            1-Click Expression Snippets (Apply to Selected Layer Position)
          </div>
          {[
            { name: 'Organic Handheld Wiggle', expr: 'wiggle(2.5, 18)' },
            { name: 'Harmonic Sine Float', expr: 'value + [0, Math.sin(time * 3) * 20, 0]' },
            { name: 'Ping-Pong Loop Cycle', expr: 'loopOut("pingpong")' },
            { name: 'Circular Orbit Motion', expr: 'value + [Math.cos(time * 2) * 90, Math.sin(time * 2) * 90, 0]' },
          ].map((snip) => (
            <button
              key={snip.name}
              className="studio-btn"
              style={{ justifyContent: 'space-between', padding: '6px 8px' }}
              onClick={() => {
                if (!studio.selectedLayer) return;
                studio.commitProjectChange(`Apply Expression "${snip.name}"`, (draft) => {
                  const c = draft.compositions.find((x) => x.id === draft.activeCompId);
                  const l = c?.layers.find((x) => x.id === studio.selectedLayer!.id);
                  if (l) {
                    l.transform.position.expression = snip.expr;
                    l.transform.position.expressionEnabled = true;
                  }
                });
                studio.notify(`Applied expression: ${snip.expr}`);
              }}
            >
              <span>{snip.name}</span>
              <span className="mono" style={{ fontSize: 10, color: 'var(--accent-cyan)' }}>fx</span>
            </button>
          ))}
        </div>
      )}
    </aside>
  );
};
