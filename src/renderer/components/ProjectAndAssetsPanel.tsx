import React, { useMemo, useRef, useState } from 'react';
import { useStudio } from '../state/StudioContext';
import { EFFECT_CATEGORIES, EFFECTS_CATALOG, searchEffects, SMART_ADAPTIVE_PRESETS } from '../../effects/registry';
import { EXPRESSION_SNIPPETS } from '../../engine/expressions';
import { createDefaultTransform, createId } from '../../engine/factory';
import { studioRamCache } from '../../engine/compositor';
import { t } from '../../utils/i18n';
import { IconPlus, IconSearch, IconStar } from './Icons';

export const ProjectAndAssetsPanel: React.FC<{ widthPx?: number }> = ({ widthPx = 282 }) => {
  const studio = useStudio();
  const loc = studio.preferences.locale;
  const [fxSearch, setFxSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState<string>('All');
  const [onlyGpu, setOnlyGpu] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const favSet = useMemo(() => new Set(studio.project.favoriteEffectIds), [studio.project.favoriteEffectIds]);

  const filteredEffects = useMemo(() => {
    let list = fxSearch.trim() ? searchEffects(fxSearch) : EFFECTS_CATALOG;
    if (selectedCat === 'Favorites') {
      list = list.filter((e) => favSet.has(e.id));
    } else if (selectedCat !== 'All') {
      list = list.filter((e) => e.category === selectedCat);
    }
    if (onlyGpu) list = list.filter((e) => e.gpuAccelerated);
    return list;
  }, [fxSearch, selectedCat, onlyGpu, favSet]);

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
        labelColor: kind === 'mesh3d' ? '#4CC3FF' : '#3DD68C',
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
  };

  return (
    <aside
      style={{
        width: widthPx,
        height: '100%',
        background: 'var(--bg-panel)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      <div className="panel-header">
        <div className="panel-tabs">
          <button
            className={`panel-tab ${studio.leftTab === 'project' ? 'active' : ''}`}
            onClick={() => studio.setLeftTab('project')}
          >
            {t('panel.project', loc)}
          </button>
          <button
            className={`panel-tab ${studio.leftTab === 'effects' ? 'active' : ''}`}
            onClick={() => studio.setLeftTab('effects')}
          >
            Effects ({EFFECTS_CATALOG.length})
          </button>
          <button
            className={`panel-tab ${studio.leftTab === 'library' ? 'active' : ''}`}
            onClick={() => studio.setLeftTab('library')}
          >
            Library
          </button>
        </div>
      </div>

      {/* TAB 1: PROJECT COMPOSITIONS, FOOTAGE & TEMPLATES */}
      {studio.leftTab === 'project' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="studio-btn" style={{ flex: 1 }} onClick={() => studio.setActiveModal('new-comp')}>
              <IconPlus size={12} /> Comp
            </button>
            <button className="studio-btn" style={{ flex: 1 }} onClick={() => fileRef.current?.click()}>
              <IconPlus size={12} /> Import
            </button>
            <input
              ref={fileRef}
              type="file"
              style={{ display: 'none' }}
              accept=".prex,.json,.png,.jpg,.jpeg,.webp,.gif,.bmp,.svg,.obj,.csv,.tsv,.cube,.wav"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) await studio.importLocalFile(f);
                e.target.value = '';
              }}
            />
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span className="section-eyebrow">Compositions ({studio.project.compositions.length})</span>
              <span className="badge mono">{studioRamCache.getEntryCount()} RAM</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {studio.project.compositions.map((comp) => {
                const active = comp.id === studio.activeComp?.id;
                return (
                  <div
                    key={comp.id}
                    onClick={() => studio.openActiveComp(comp.id)}
                    style={{
                      padding: '7px 9px',
                      borderRadius: 6,
                      cursor: 'pointer',
                      background: active ? 'var(--bg-selected)' : 'var(--bg-elevated)',
                      border: `1px solid ${active ? 'var(--accent-amber)' : 'var(--border-subtle)'}`,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {comp.name}
                      </div>
                      <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
                        {comp.width}×{comp.height} · {comp.fps}fps · {comp.duration}s
                      </div>
                    </div>
                    <span className="badge mono">{comp.layers.length}L</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <div className="section-eyebrow" style={{ marginBottom: 6 }}>
              Footage, 3D & Data ({studio.project.assets.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {studio.project.assets.map((asset) => (
                <div
                  key={asset.id}
                  style={{
                    padding: '6px 8px',
                    borderRadius: 6,
                    background: 'var(--bg-elevated)',
                    border: `1px solid ${asset.missing ? 'var(--status-err)' : 'var(--border-subtle)'}`,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <div
                    style={{ overflow: 'hidden', cursor: 'pointer', flex: 1 }}
                    onClick={() => addAssetToActiveComp(asset.id, asset.name, asset.kind)}
                    title="Click to place asset in Active Composition"
                  >
                    <div style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-primary)' }}>
                      {asset.name}
                    </div>
                    <div className="mono" style={{ fontSize: 10, color: asset.missing ? 'var(--status-err)' : 'var(--text-muted)' }}>
                      {asset.kind.toUpperCase()} {asset.width ? `· ${asset.width}×${asset.height}` : ''} · {asset.missing ? 'OFFLINE' : asset.folder}
                    </div>
                  </div>
                  <button
                    className="studio-btn"
                    style={{ minHeight: 22, fontSize: 10, padding: '1px 6px' }}
                    title="Toggle Relink / Offline State"
                    onClick={() =>
                      studio.commitProjectChange(`Toggle Relink: ${asset.name}`, (draft) => {
                        const a = draft.assets.find((x) => x.id === asset.id);
                        if (a) a.missing = !a.missing;
                      })
                    }
                  >
                    {asset.missing ? 'Relink' : 'Online'}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* All 4 Built-in Offline Studio Templates Exposed Cleanly (BUG-P1-08 Fixed) */}
          <div style={{ marginTop: 'auto', paddingTop: 10, borderTop: '1px solid var(--border-subtle)' }}>
            <div className="section-eyebrow" style={{ marginBottom: 6 }}>
              Offline Studio Templates
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <button className="studio-btn" style={{ justifyContent: 'flex-start' }} onClick={() => studio.loadTemplateProject('orbital-hero')}>
                Orbital Telemetry 3D Hero
              </button>
              <button className="studio-btn" style={{ justifyContent: 'flex-start' }} onClick={() => studio.loadTemplateProject('kinetic-lower-third')}>
                Broadcast Kinetic Lower Third
              </button>
              <button className="studio-btn" style={{ justifyContent: 'flex-start' }} onClick={() => studio.loadTemplateProject('vfx-keying')}>
                VFX Chroma Key & Tracking Rig
              </button>
              <button className="studio-btn" style={{ justifyContent: 'flex-start' }} onClick={() => studio.loadTemplateProject('blank')}>
                Clean Blank 1080p60 Comp
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: 186 BUILT-IN EFFECTS BROWSER */}
      {studio.leftTab === 'effects' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 9, gap: 7 }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <span style={{ position: 'absolute', left: 8, color: 'var(--text-muted)', display: 'inline-flex' }}>
              <IconSearch size={12} />
            </span>
            <input
              className="studio-input"
              placeholder="Filter 186 effects (glow, keylight, lut)…"
              style={{ width: '100%', paddingLeft: 26 }}
              value={fxSearch}
              onChange={(e) => setFxSearch(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <select
              className="studio-select"
              style={{ flex: 1 }}
              value={selectedCat}
              onChange={(e) => setSelectedCat(e.target.value)}
            >
              <option value="All">All Categories ({EFFECT_CATEGORIES.length})</option>
              <option value="Favorites">Starred Favorites</option>
              {EFFECT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <button
              className={`studio-btn ${onlyGpu ? 'subtle-active' : ''}`}
              title="Filter GPU Accelerated Effects"
              onClick={() => setOnlyGpu(!onlyGpu)}
            >
              GPU
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {filteredEffects.map((fx) => {
              const starred = favSet.has(fx.id);
              return (
                <div
                  key={fx.id}
                  style={{
                    padding: '6px 8px',
                    borderRadius: 6,
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 6,
                  }}
                >
                  <div
                    style={{ flex: 1, cursor: 'pointer', overflow: 'hidden' }}
                    onClick={() => studio.applyEffectToSelectedLayer(fx.id)}
                    title={`${fx.description} — Click to apply`}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{fx.name}</span>
                      {fx.gpuAccelerated && (
                        <span className="badge cyan" style={{ fontSize: 9, padding: '0 5px', minHeight: 15 }}>
                          GPU
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 10.5, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {fx.category} · {fx.description}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 3 }}>
                    <button
                      className="studio-btn ghost"
                      style={{ width: 24, height: 24, minHeight: 24, padding: 0, color: starred ? 'var(--accent-amber)' : 'var(--text-muted)' }}
                      onClick={() => toggleFavoriteEffect(fx.id)}
                      title="Toggle Favorite Effect"
                    >
                      <IconStar size={12} filled={starred} />
                    </button>
                    <button
                      className="studio-btn"
                      style={{ minHeight: 24, padding: '0 7px' }}
                      onClick={() => studio.applyEffectToSelectedLayer(fx.id)}
                    >
                      Apply
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: SMART ADAPTIVE PRESETS & EXPRESSION LIBRARY */}
      {studio.leftTab === 'library' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <div className="section-eyebrow" style={{ marginBottom: 4 }}>
              Resolution-Adaptive Smart Presets
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8 }}>
              Auto-scales pixel radii to active comp ({studio.activeComp?.width}×{studio.activeComp?.height})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {SMART_ADAPTIVE_PRESETS.map((preset) => (
                <div key={preset.id} className="inspector-card" style={{ gap: 5 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600 }}>{preset.name}</span>
                    <span className="badge purple">{preset.category}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{preset.description}</div>
                  <button className="studio-btn primary" onClick={() => studio.applySmartPresetToSelectedLayer(preset.id)}>
                    Apply Adaptive Stack
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="section-eyebrow" style={{ marginBottom: 6 }}>
              1-Click Expression Snippets
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {EXPRESSION_SNIPPETS.map((snip) => (
                <button
                  key={snip.id}
                  className="studio-btn"
                  style={{ flexDirection: 'column', alignItems: 'flex-start', padding: '7px 9px', gap: 3, height: 'auto' }}
                  onClick={() =>
                    studio.commitProjectChange(`Apply Expression: ${snip.label}`, (draft) => {
                      const comp = draft.compositions.find((c) => c.id === draft.activeCompId);
                      const l = comp?.layers.find((x) => studio.selectedLayerIds.includes(x.id)) ?? comp?.layers[0];
                      if (!l) return;
                      if (snip.code.includes('[')) {
                        l.transform.position.expression = snip.code;
                        l.transform.position.expressionEnabled = true;
                      } else {
                        l.transform.rotationZ.expression = snip.code;
                        l.transform.rotationZ.expressionEnabled = true;
                      }
                    })
                  }
                >
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{snip.label}</span>
                  <span className="mono" style={{ fontSize: 10, color: 'var(--accent-cyan)', whiteSpace: 'normal', textAlign: 'left' }}>
                    {snip.code}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
