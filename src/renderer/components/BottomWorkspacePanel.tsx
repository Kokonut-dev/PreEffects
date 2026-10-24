import React, { useState } from 'react';
import { useStudio } from '../state/StudioContext';
import { formatTimecode } from '../../utils/math';
import { sampleGraphCurve, applySmootherToProperty, applyWigglerToProperty } from '../../engine/animation';
import { buildPickWhipExpression } from '../../engine/expressions';
import { studioRamCache } from '../../engine/compositor';
import { OutputFormatId } from '../../engine/types';
import { mapColorBlindSafeSwatch } from '../../utils/qolHelpers';
import { IconCube3D, IconDiamond, IconEye, IconPause, IconPlay } from './Icons';

const LAYER_TYPE_TAG: Record<string, string> = {
  text: 'TXT',
  shape: 'SHP',
  solid: 'SLD',
  null: 'NUL',
  camera: 'CAM',
  light: 'LGT',
  adjustment: 'ADJ',
  precomp: 'PRE',
  audio: 'AUD',
  guide: 'GDE',
  footage: 'FTG',
};

export const BottomWorkspacePanel: React.FC<{ heightPx?: number }> = ({ heightPx = 295 }) => {
  const studio = useStudio();
  const [expandedLayerId, setExpandedLayerId] = useState<string | null>('lyr_hero_title');
  const [graphMode, setGraphMode] = useState<'value' | 'speed'>('value');
  const [timelineSearch, setTimelineSearch] = useState('');

  const comp = studio.activeComp;
  if (!comp) return null;

  const visibleLayers = comp.layers.filter((l) => {
    if (comp.hideShyLayers && l.shy) return false;
    if (timelineSearch && !l.name.toLowerCase().includes(timelineSearch.toLowerCase())) return false;
    return true;
  });

  const downloadRenderedArtifact = (name: string, mimeType: string, bytes?: Uint8Array) => {
    if (!bytes) return;
    const blob = new Blob([bytes as unknown as BlobPart], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
    studio.notify(`Saved exported file "${name}" (${(bytes.byteLength / 1024).toFixed(1)} KB)`);
  };

  return (
    <section
      style={{
        height: heightPx,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-panel)',
        borderTop: '1px solid var(--border-strong)',
        overflow: 'hidden',
      }}
    >
      {/* Top Timeline / Graph / Node / Render Queue Mode Bar + Transport */}
      <div className="panel-header" style={{ height: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="panel-tabs">
            <button className={`panel-tab ${studio.bottomMode === 'timeline' ? 'active' : ''}`} onClick={() => studio.setBottomMode('timeline')}>
              Timeline ({comp.layers.length})
            </button>
            <button className={`panel-tab ${studio.bottomMode === 'graph' ? 'active' : ''}`} onClick={() => studio.setBottomMode('graph')}>
              Graph Editor
            </button>
            <button className={`panel-tab ${studio.bottomMode === 'nodes' ? 'active' : ''}`} onClick={() => studio.setBottomMode('nodes')}>
              Node Graph (DAG)
            </button>
            <button className={`panel-tab ${studio.bottomMode === 'render-queue' ? 'active' : ''}`} onClick={() => studio.setBottomMode('render-queue')}>
              Render Queue ({studio.project.renderQueue.length})
            </button>
          </div>

          <div style={{ width: 1, height: 18, background: 'var(--border-subtle)' }} />

          {/* Transport Controls */}
          <button
            className="studio-btn"
            style={{ padding: '2px 7px' }}
            onClick={() => studio.setCurrentTime(0)}
            title="Jump to Start (Home)"
          >
            |◀
          </button>
          <button
            className="studio-btn"
            style={{ padding: '2px 7px' }}
            onClick={() => studio.setCurrentTime((t) => Math.max(0, t - 1 / comp.fps))}
            title="Step Back 1 Frame (PageUp)"
          >
            ◀
          </button>
          <button
            aria-label={studio.isPlaying ? 'Pause Playback' : 'Play RAM Preview'}
            className={`studio-btn ${studio.isPlaying ? 'primary' : ''}`}
            style={{ padding: '3px 10px' }}
            onClick={() => studio.setIsPlaying((p) => !p)}
            title="RAM Preview Play / Pause (Space)"
          >
            {studio.isPlaying ? <IconPause /> : <IconPlay />}
            <span>{studio.isPlaying ? 'Pause' : 'Play'}</span>
          </button>
          <button
            className="studio-btn"
            style={{ padding: '2px 7px' }}
            onClick={() => studio.setCurrentTime((t) => Math.min(comp.duration, t + 1 / comp.fps))}
            title="Step Forward 1 Frame (PageDown)"
          >
            ▶
          </button>

          <span
            className="mono"
            style={{
              padding: '2px 8px',
              borderRadius: 4,
              background: '#090B10',
              border: '1px solid var(--border-subtle)',
              color: 'var(--accent-amber)',
              fontWeight: 700,
              fontSize: 12,
              cursor: 'pointer',
            }}
            onClick={() => studio.updatePreferences({ showTimecodeAsFrames: !studio.preferences.showTimecodeAsFrames })}
            title="Click to toggle SMPTE Timecode / Absolute Frames"
          >
            {studio.preferences.showTimecodeAsFrames
              ? `${String(Math.round(studio.currentTime * comp.fps)).padStart(5, '0')} f`
              : formatTimecode(studio.currentTime, comp.fps)}
          </span>
          <span className="mono" style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
            {comp.fps} fps
          </span>
        </div>

        {/* Timeline Quick Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <input
            className="studio-input"
            style={{ width: 130, padding: '2px 6px', fontSize: 11 }}
            placeholder="Filter layers…"
            value={timelineSearch}
            onChange={(e) => setTimelineSearch(e.target.value)}
          />
          <button
            className={`studio-btn ${comp.motionBlurEnabled ? 'primary' : ''}`}
            style={{ padding: '2px 7px', fontSize: 10.5 }}
            onClick={() => {
              studio.commitProjectChange('Toggle Comp Motion Blur', (draft) => {
                const c = draft.compositions.find((x) => x.id === draft.activeCompId);
                if (c) c.motionBlurEnabled = !c.motionBlurEnabled;
              });
            }}
            title="Enable Shutter-Angle Subframe Motion Blur"
          >
            Motion Blur
          </button>
          <button className="studio-btn" style={{ padding: '2px 7px', fontSize: 10.5 }} onClick={() => studio.splitSelectedLayersAtPlayhead()} title="Split Layer (Ctrl+Shift+D)">
            Split
          </button>
          <button className="studio-btn" style={{ padding: '2px 7px', fontSize: 10.5 }} onClick={() => studio.duplicateSelectedLayers(true)} title="Smart Duplicate Hierarchy (Ctrl+Alt+D)">
            Smart Dup
          </button>
          <button className="studio-btn" style={{ padding: '2px 7px', fontSize: 10.5 }} onClick={() => studio.precomposeSelectedLayers()} title="Pre-compose (Ctrl+Shift+C)">
            Pre-comp
          </button>
          <button className="studio-btn" style={{ padding: '2px 7px', fontSize: 10.5 }} onClick={() => studio.applyKeyframeAssistant('easy-ease')} title="Easy Ease (F9)">
            Easy Ease
          </button>
        </div>
      </div>

      {/* MODE 1: MULTI-TRACK LAYER STACK & KEYFRAME TIMELINE */}
      {studio.bottomMode === 'timeline' && (
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Left Columns: Switches, Layer Name, Parent & Track Matte */}
          <div style={{ width: 430, flexShrink: 0, borderRight: '1px solid var(--border-strong)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div
              style={{
                height: 24,
                padding: '0 8px',
                background: 'var(--bg-elevated)',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'grid',
                gridTemplateColumns: '64px 1fr 92px 46px',
                alignItems: 'center',
                fontSize: 10,
                fontWeight: 700,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
              }}
            >
              <span>V · S · L</span>
              <span>Layer Name</span>
              <span>Parent / Whip</span>
              <span>3D/MB</span>
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
              {visibleLayers.map((lyr, idx) => {
                const isSel = studio.selectedLayerIds.includes(lyr.id);
                const isExpanded = expandedLayerId === lyr.id;
                return (
                  <React.Fragment key={lyr.id}>
                    <div
                      onClick={(e) => {
                        if (e.shiftKey) {
                          studio.setSelectedLayerIds(
                            isSel ? studio.selectedLayerIds.filter((x) => x !== lyr.id) : [...studio.selectedLayerIds, lyr.id],
                          );
                        } else {
                          studio.setSelectedLayerIds([lyr.id]);
                        }
                      }}
                      onDoubleClick={() => {
                        if (lyr.type === 'precomp' && lyr.precompId) studio.openActiveComp(lyr.precompId);
                        else setExpandedLayerId(isExpanded ? null : lyr.id);
                      }}
                      style={{
                        height: 28,
                        padding: '0 8px',
                        display: 'grid',
                        gridTemplateColumns: '64px 1fr 92px 46px',
                        alignItems: 'center',
                        background: isSel ? 'var(--bg-selected)' : idx % 2 === 0 ? 'var(--bg-panel)' : 'var(--bg-canvas)',
                        borderBottom: '1px solid var(--border-subtle)',
                        cursor: 'pointer',
                      }}
                    >
                      {/* Visibility, Solo, Lock */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }} onClick={(e) => e.stopPropagation()}>
                        <button
                          aria-label={`Toggle Visibility ${lyr.name}`}
                          style={{ opacity: lyr.visible ? 1 : 0.28, padding: 1 }}
                          onClick={() => {
                            studio.commitProjectChange('Toggle Layer Visibility', (draft) => {
                              const target = draft.compositions.find((c) => c.id === draft.activeCompId)?.layers.find((x) => x.id === lyr.id);
                              if (target) target.visible = !target.visible;
                            });
                          }}
                        >
                          <IconEye />
                        </button>
                        <button
                          style={{
                            width: 15,
                            height: 15,
                            fontSize: 9,
                            fontWeight: 700,
                            background: lyr.solo ? 'var(--accent-amber)' : 'var(--bg-elevated)',
                            color: lyr.solo ? '#0E1015' : 'var(--text-muted)',
                          }}
                          title="Solo Layer"
                          onClick={() => {
                            studio.commitProjectChange('Toggle Solo', (draft) => {
                              const target = draft.compositions.find((c) => c.id === draft.activeCompId)?.layers.find((x) => x.id === lyr.id);
                              if (target) target.solo = !target.solo;
                            });
                          }}
                        >
                          S
                        </button>
                        <button
                          style={{
                            width: 15,
                            height: 15,
                            fontSize: 9,
                            background: lyr.locked ? 'var(--status-err)' : 'var(--bg-elevated)',
                            color: lyr.locked ? '#fff' : 'var(--text-muted)',
                          }}
                          title="Lock Layer"
                          onClick={() => {
                            studio.commitProjectChange('Toggle Lock', (draft) => {
                              const target = draft.compositions.find((c) => c.id === draft.activeCompId)?.layers.find((x) => x.id === lyr.id);
                              if (target) target.locked = !target.locked;
                            });
                          }}
                        >
                          L
                        </button>
                      </div>

                      {/* Expand Twirl + Label Swatch + Name */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, overflow: 'hidden', paddingRight: 6 }}>
                        <button
                          style={{ fontSize: 9, color: 'var(--text-muted)', padding: '0 2px' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedLayerId(isExpanded ? null : lyr.id);
                          }}
                        >
                          {isExpanded ? '▼' : '▶'}
                        </button>
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: 2,
                            background: studio.preferences.colorBlindSafeLabels
                              ? mapColorBlindSafeSwatch(lyr.labelColor, idx)
                              : lyr.labelColor,
                            flexShrink: 0,
                          }}
                        />
                        <span className="layer-kind-pill">{LAYER_TYPE_TAG[lyr.type] ?? 'LYR'}</span>
                        <span style={{ fontWeight: isSel ? 600 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {lyr.name}
                        </span>
                      </div>

                      {/* Parent Link Selector */}
                      <select
                        className="studio-select"
                        style={{ padding: '1px 3px', fontSize: 10, width: 86 }}
                        value={lyr.parentId ?? ''}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          const pid = e.target.value || undefined;
                          studio.commitProjectChange('Set Parent Layer', (draft) => {
                            const target = draft.compositions.find((c) => c.id === draft.activeCompId)?.layers.find((x) => x.id === lyr.id);
                            if (target) target.parentId = pid;
                          });
                        }}
                      >
                        <option value="">None</option>
                        {comp.layers
                          .filter((o) => o.id !== lyr.id)
                          .map((o) => (
                            <option key={o.id} value={o.id}>{o.name}</option>
                          ))}
                      </select>

                      {/* 3D & Motion Blur Switches */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }} onClick={(e) => e.stopPropagation()}>
                        <button
                          style={{ color: lyr.threeD ? 'var(--accent-cyan)' : 'var(--text-muted)', padding: 1 }}
                          title="3D Layer"
                          onClick={() => {
                            studio.commitProjectChange('Toggle 3D', (draft) => {
                              const target = draft.compositions.find((c) => c.id === draft.activeCompId)?.layers.find((x) => x.id === lyr.id);
                              if (target) target.threeD = !target.threeD;
                            });
                          }}
                        >
                          <IconCube3D />
                        </button>
                        <button
                          style={{
                            fontSize: 9,
                            fontWeight: 700,
                            color: lyr.motionBlur ? 'var(--accent-amber)' : 'var(--text-muted)',
                          }}
                          title="Layer Motion Blur"
                          onClick={() => {
                            studio.commitProjectChange('Toggle Layer Motion Blur', (draft) => {
                              const target = draft.compositions.find((c) => c.id === draft.activeCompId)?.layers.find((x) => x.id === lyr.id);
                              if (target) target.motionBlur = !target.motionBlur;
                            });
                          }}
                        >
                          M
                        </button>
                      </div>
                    </div>

                    {/* Expanded Inline Expression & Pick Whip Row */}
                    {isExpanded && (
                      <div
                        style={{
                          padding: '6px 10px',
                          background: '#0C0F16',
                          borderBottom: '1px solid var(--border-subtle)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <span className="mono" style={{ fontSize: 10, color: 'var(--accent-cyan)' }}>pos.expr =</span>
                        <input
                          className="studio-input mono"
                          style={{ flex: 1, fontSize: 10.5, padding: '2px 6px' }}
                          placeholder="e.g. wiggle(2, 20) or value + [0, Math.sin(time*3)*15, 0]"
                          value={lyr.transform.position.expression ?? ''}
                          onChange={(e) => {
                            const expr = e.target.value;
                            studio.commitProjectChange('Edit Position Expression', (draft) => {
                              const target = draft.compositions.find((c) => c.id === draft.activeCompId)?.layers.find((x) => x.id === lyr.id);
                              if (target) {
                                target.transform.position.expression = expr;
                                target.transform.position.expressionEnabled = expr.trim().length > 0;
                              }
                            }, `expr_${lyr.id}`);
                          }}
                        />
                        <select
                          className="studio-select"
                          style={{ fontSize: 10, width: 88 }}
                          defaultValue=""
                          title="Pick Whip to another layer's Position"
                          onChange={(e) => {
                            const targetName = e.target.value;
                            if (!targetName) return;
                            const whipExpr = buildPickWhipExpression(targetName, 'position');
                            studio.commitProjectChange('Pick Whip Expression', (draft) => {
                              const target = draft.compositions.find((c) => c.id === draft.activeCompId)?.layers.find((x) => x.id === lyr.id);
                              if (target) {
                                target.transform.position.expression = whipExpr;
                                target.transform.position.expressionEnabled = true;
                              }
                            });
                            e.target.value = '';
                          }}
                        >
                          <option value="">◎ Pick Whip</option>
                          {comp.layers.filter((o) => o.id !== lyr.id).map((o) => (
                            <option key={o.id} value={o.name}>{o.name}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          {/* Right Timeline Time Ruler, RAM Cache Indicator, Clip Bars & Keyframe Diamonds */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
            {/* Time Ruler & Scrub Track */}
            <div
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const u = Math.max(0, Math.min(1, (e.clientX - rect.left) / Math.max(1, rect.width)));
                studio.setCurrentTime(u * comp.duration);
              }}
              style={{
                height: 24,
                background: 'var(--bg-elevated)',
                borderBottom: '1px solid var(--border-subtle)',
                position: 'relative',
                cursor: 'ew-resize',
              }}
            >
              {Array.from({ length: Math.ceil(comp.duration) + 1 }).map((_, sec) => (
                <div
                  key={sec}
                  className="mono"
                  style={{
                    position: 'absolute',
                    left: `${(sec / comp.duration) * 100}%`,
                    top: 3,
                    fontSize: 9.5,
                    color: 'var(--text-muted)',
                    transform: 'translateX(-50%)',
                    pointerEvents: 'none',
                  }}
                >
                  {sec}s
                </div>
              ))}

              {/* Composition Markers */}
              {comp.markers.map((m) => (
                <div
                  key={m.id}
                  title={m.comment}
                  style={{
                    position: 'absolute',
                    left: `${(m.time / comp.duration) * 100}%`,
                    top: 0,
                    padding: '0 4px',
                    background: m.color,
                    color: '#0E1015',
                    fontSize: 9,
                    fontWeight: 700,
                    borderRadius: '0 0 3px 3px',
                  }}
                >
                  {m.comment}
                </div>
              ))}

              {/* Green RAM Preview Cached Frames Bar */}
              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: 3,
                  background: studioRamCache.getEntryCount() > 0 ? 'rgba(52, 211, 153, 0.7)' : 'transparent',
                }}
              />
            </div>

            {/* Layer Clip Bars + Keyframe Diamonds */}
            <div
              style={{ flex: 1, overflowY: 'auto', position: 'relative' }}
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const u = Math.max(0, Math.min(1, (e.clientX - rect.left) / Math.max(1, rect.width)));
                studio.setCurrentTime(u * comp.duration);
              }}
            >
              {visibleLayers.map((lyr, idx) => {
                const leftPct = (lyr.inPoint / comp.duration) * 100;
                const widthPct = Math.max(1, ((lyr.outPoint - lyr.inPoint) / comp.duration) * 100);
                const allKfs = [
                  ...lyr.transform.position.keyframes,
                  ...lyr.transform.scale.keyframes,
                  ...lyr.transform.rotationZ.keyframes,
                  ...lyr.transform.opacity.keyframes,
                ];
                return (
                  <React.Fragment key={lyr.id}>
                    <div
                      style={{
                        height: 28,
                        position: 'relative',
                        borderBottom: '1px solid var(--border-subtle)',
                        background: idx % 2 === 0 ? 'var(--bg-panel)' : 'var(--bg-canvas)',
                      }}
                    >
                      <div
                        style={{
                          position: 'absolute',
                          left: `${leftPct}%`,
                          width: `${widthPct}%`,
                          top: 4,
                          bottom: 4,
                          borderRadius: 3,
                          background: `${lyr.labelColor}38`,
                          border: `1px solid ${lyr.labelColor}`,
                        }}
                      />
                      {allKfs.map((kf) => (
                        <div
                          key={kf.id}
                          title={`Keyframe @ ${kf.time.toFixed(2)}s (${kf.interpolation})`}
                          style={{
                            position: 'absolute',
                            left: `${(kf.time / comp.duration) * 100}%`,
                            top: '50%',
                            transform: 'translate(-50%, -50%)',
                          }}
                        >
                          <IconDiamond active size={11} />
                        </div>
                      ))}
                    </div>
                    {expandedLayerId === lyr.id && <div style={{ height: 34, borderBottom: '1px solid var(--border-subtle)', background: '#0C0F16' }} />}
                  </React.Fragment>
                );
              })}

              {/* Vertical Playhead Scrubber Line */}
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: `${(studio.currentTime / comp.duration) * 100}%`,
                  width: 2,
                  background: '#E89B3C',
                  pointerEvents: 'none',
                  zIndex: 20,
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* MODE 2: SPEED & VALUE GRAPH EDITOR */}
      {studio.bottomMode === 'graph' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 10, gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 5 }}>
              <button className={`studio-btn ${graphMode === 'value' ? 'primary' : ''}`} onClick={() => setGraphMode('value')}>
                Value Graph
              </button>
              <button className={`studio-btn ${graphMode === 'speed' ? 'primary' : ''}`} onClick={() => setGraphMode('speed')}>
                Speed Graph
              </button>
              <span style={{ alignSelf: 'center', marginLeft: 8, color: 'var(--text-secondary)', fontSize: 11 }}>
                Editing: <strong>{studio.selectedLayer?.name ?? 'None'}</strong> — Position Y / Scale
              </span>
            </div>
            <div style={{ display: 'flex', gap: 5 }}>
              <button className="studio-btn" onClick={() => studio.applyKeyframeAssistant('easy-ease')}>Easy Ease (F9)</button>
              <button
                className="studio-btn"
                onClick={() => {
                  if (!studio.selectedLayer) return;
                  studio.commitProjectChange('Apply Wiggler Assistant', (draft) => {
                    const l = draft.compositions.find((c) => c.id === draft.activeCompId)?.layers.find((x) => x.id === studio.selectedLayer!.id);
                    if (l && l.transform.opacity.keyframes.length >= 2) {
                      l.transform.opacity = applyWigglerToProperty(l.transform.opacity, 4, 15);
                    }
                  });
                }}
              >
                Wiggler
              </button>
              <button
                className="studio-btn"
                onClick={() => {
                  if (!studio.selectedLayer) return;
                  studio.commitProjectChange('Apply Smoother Assistant', (draft) => {
                    const l = draft.compositions.find((c) => c.id === draft.activeCompId)?.layers.find((x) => x.id === studio.selectedLayer!.id);
                    if (l && l.transform.opacity.keyframes.length >= 3) {
                      l.transform.opacity = applySmootherToProperty(l.transform.opacity, 2);
                    }
                  });
                }}
              >
                Smoother
              </button>
            </div>
          </div>

          <svg
            viewBox="0 0 1000 180"
            preserveAspectRatio="none"
            style={{ flex: 1, width: '100%', background: '#090B10', borderRadius: 6, border: '1px solid var(--border-subtle)' }}
          >
            <line x1="0" y1="90" x2="1000" y2="90" stroke="rgba(255,255,255,0.08)" />
            {studio.selectedLayer && (() => {
              const samples = sampleGraphCurve(studio.selectedLayer.transform.position, 0, comp.duration, 120, 1);
              const vals = samples.map((s) => (graphMode === 'value' ? s.value : s.speed));
              const minV = Math.min(...vals, 0);
              const maxV = Math.max(...vals, minV + 10);
              const pts = samples
                .map((s, idx) => {
                  const x = (idx / (samples.length - 1)) * 1000;
                  const v = graphMode === 'value' ? s.value : s.speed;
                  const y = 165 - ((v - minV) / Math.max(1, maxV - minV)) * 150;
                  return `${x.toFixed(1)},${y.toFixed(1)}`;
                })
                .join(' ');
              return (
                <>
                  <polyline fill="none" stroke={graphMode === 'value' ? '#38BDF8' : '#E89B3C'} strokeWidth="2.4" points={pts} />
                  {studio.selectedLayer.transform.position.keyframes.map((kf) => {
                    const x = (kf.time / comp.duration) * 1000;
                    const y = 165 - ((kf.value[1] - minV) / Math.max(1, maxV - minV)) * 150;
                    return <circle key={kf.id} cx={x} cy={y} r="5" fill="#E89B3C" stroke="#090B10" strokeWidth="1.5" />;
                  })}
                </>
              );
            })()}
            <line
              x1={(studio.currentTime / comp.duration) * 1000}
              y1="0"
              x2={(studio.currentTime / comp.duration) * 1000}
              y2="180"
              stroke="#E89B3C"
              strokeDasharray="4 3"
            />
          </svg>
        </div>
      )}

      {/* MODE 3: BIDIRECTIONAL NODE COMPOSITING GRAPH (EXCEED-01 & EXCEED-06) */}
      {studio.bottomMode === 'nodes' && (
        <div style={{ flex: 1, position: 'relative', background: '#090C13', overflow: 'auto' }}>
          <div style={{ position: 'sticky', top: 8, left: 10, zIndex: 10, display: 'inline-flex', gap: 6, padding: 4 }}>
            <span className="badge amber">Bidirectional Layer ↔ DAG Sync</span>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)', alignSelf: 'center' }}>
              Click any Source or Effect node to toggle bypass (syncs live with Timeline!)
            </span>
          </div>
          {(() => {
            const nodes = comp.nodeGraph?.nodes ?? [];
            const nodeMap = new Map(nodes.map((n) => [n.id, n]));
            return (
              <svg width={1220} height={Math.max(240, nodes.length * 46)} style={{ display: 'block' }}>
                {/* Cubic Bezier Node Wires */}
                {nodes.flatMap((n) =>
                  n.inputs.map((inId) => {
                    const src = nodeMap.get(inId);
                    if (!src) return null;
                    const x1 = src.x + 155, y1 = src.y + 18;
                    const x2 = n.x, y2 = n.y + 18;
                    const cx = (x1 + x2) / 2;
                    return (
                      <path
                        key={`${inId}->${n.id}`}
                        d={`M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`}
                        fill="none"
                        stroke={n.bypassed || src.bypassed ? '#475569' : '#38BDF8'}
                        strokeWidth="2"
                      />
                    );
                  }),
                )}

                {/* Interactive DAG Nodes */}
                {nodes.map((n) => {
                  const accent =
                    n.kind === 'output'
                      ? '#E89B3C'
                      : n.kind === 'merge'
                        ? '#9B87F5'
                        : n.kind === 'effect'
                          ? '#38BDF8'
                          : '#34D399';
                  return (
                    <g
                      key={n.id}
                      transform={`translate(${n.x}, ${n.y})`}
                      style={{ cursor: 'pointer', opacity: n.bypassed ? 0.42 : 1 }}
                      onClick={() => studio.toggleNodeBypass(n.id)}
                    >
                      <rect width={155} height={36} rx={6} fill="#161B26" stroke={accent} strokeWidth="1.5" />
                      <rect width={5} height={36} rx={2} fill={accent} />
                      <text x={12} y={15} fill="#F1F3F8" fontSize="10" fontWeight="700">
                        {n.label.slice(0, 21)}
                      </text>
                      <text x={12} y={28} fill="#94A3B8" fontSize="9">
                        {n.kind.toUpperCase()} {n.bypassed ? '(BYPASSED)' : ''}
                      </text>
                    </g>
                  );
                })}
              </svg>
            );
          })()}
        </div>
      )}

      {/* MODE 4: MULTI-MODULE RENDER QUEUE & LOCAL BINARY EXPORTER */}
      {studio.bottomMode === 'render-queue' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700 }}>
              Local Multi-Module Render Queue — GIF89a, AVI Video, Lossless WAV, 32-bit TGA, OpenEXR/HDR &amp; AOV Passes
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="studio-btn" onClick={studio.addCurrentCompToRenderQueue}>
                + Add Active Comp
              </button>
              <button className="studio-btn primary" onClick={studio.runAllQueuedRenders}>
                ▶ Render All Queued Jobs
              </button>
            </div>
          </div>

          {studio.project.renderQueue.map((job) => {
            const jobComp = studio.project.compositions.find((c) => c.id === job.compId);
            return (
              <div
                key={job.id}
                style={{
                  padding: 8,
                  borderRadius: 6,
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                }}
              >
                <div>
                  <div style={{ fontWeight: 700 }}>
                    {jobComp?.name ?? job.compId}{' '}
                    <span className={`badge ${job.status === 'completed' ? 'ok' : 'amber'}`}>
                      {job.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
                    Frames {job.startFrame}–{job.endFrame} · Div 1:{job.resolutionDivisor} ·{' '}
                    {job.elapsedMs > 0 ? `Rendered in ${job.elapsedMs.toFixed(0)} ms` : 'Ready'}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  {job.outputModules.map((om) => (
                    <select
                      key={om.id}
                      className="studio-select"
                      value={om.format}
                      onChange={(e) => {
                        const fmt = e.target.value as OutputFormatId;
                        studio.commitProjectChange('Change Output Module Format', (draft) => {
                          const j = draft.renderQueue.find((x) => x.id === job.id);
                          const m = j?.outputModules.find((x) => x.id === om.id);
                          if (m && j) {
                            m.format = fmt;
                            j.status = 'queued';
                          }
                        });
                      }}
                    >
                      <option value="gif">Animated GIF89a</option>
                      <option value="avi">Uncompressed AVI Video</option>
                      <option value="wav">Lossless WAV 16-bit PCM</option>
                      <option value="tga-seq">TGA 32-bit RGBA + Alpha</option>
                      <option value="exr-seq">Radiance HDR / EXR Float</option>
                      <option value="ppm-seq">PPM Frame</option>
                    </select>
                  ))}

                  {job.renderedArtifacts?.map((art) => (
                    <button
                      key={art.name}
                      className="studio-btn primary"
                      onClick={() => downloadRenderedArtifact(art.name, art.mimeType, art.data)}
                    >
                      ⬇ {art.name} ({(art.byteLength / 1024).toFixed(1)} KB)
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
