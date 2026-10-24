import React, { useRef, useState } from 'react';
import { useStudio } from '../state/StudioContext';
import { formatTimecode } from '../../utils/math';
import { sampleGraphCurve, applySmootherToProperty, applyWigglerToProperty } from '../../engine/animation';
import { buildPickWhipExpression } from '../../engine/expressions';
import { studioRamCache } from '../../engine/compositor';
import { createId } from '../../engine/factory';
import { OutputModuleConfig } from '../../engine/types';
import { mapColorBlindSafeSwatch } from '../../utils/qolHelpers';
import {
  IconCube3D,
  IconDiamond,
  IconDownload,
  IconEye,
  IconPause,
  IconPlay,
  IconSkipStart,
  IconStepBack,
  IconStepFwd,
} from './Icons';

type GraphChannelId = 'posX' | 'posY' | 'scaleX' | 'rotZ' | 'opacity';

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

export const BottomWorkspacePanel: React.FC<{ heightPx?: number }> = ({ heightPx = 292 }) => {
  const studio = useStudio();
  const [expandedLayerId, setExpandedLayerId] = useState<string | null>(null);
  const [graphMode, setGraphMode] = useState<'value' | 'speed'>('value');
  const [graphChannel, setGraphChannel] = useState<GraphChannelId>('posY');
  const [timelineSearch, setTimelineSearch] = useState('');

  const leftScrollRef = useRef<HTMLDivElement>(null);
  const rightScrollRef = useRef<HTMLDivElement>(null);
  const syncingScrollRef = useRef(false);
  const rulerRef = useRef<HTMLDivElement>(null);

  const comp = studio.activeComp;
  if (!comp) return null;

  const visibleLayers = comp.layers.filter((l) => {
    if (comp.hideShyLayers && l.shy) return false;
    if (timelineSearch && !l.name.toLowerCase().includes(timelineSearch.toLowerCase())) return false;
    return true;
  });

  // BUG-P2-02 Fix: Synchronized vertical scroll between Left Layer List and Right Clip Lanes
  const onLeftScroll = () => {
    if (syncingScrollRef.current) return;
    syncingScrollRef.current = true;
    if (leftScrollRef.current && rightScrollRef.current) {
      rightScrollRef.current.scrollTop = leftScrollRef.current.scrollTop;
    }
    requestAnimationFrame(() => {
      syncingScrollRef.current = false;
    });
  };

  const onRightScroll = () => {
    if (syncingScrollRef.current) return;
    syncingScrollRef.current = true;
    if (leftScrollRef.current && rightScrollRef.current) {
      leftScrollRef.current.scrollTop = rightScrollRef.current.scrollTop;
    }
    requestAnimationFrame(() => {
      syncingScrollRef.current = false;
    });
  };

  // BUG-P1-06 Fix: Smooth pointer-capture playhead scrubbing across the Time Ruler
  const startRulerScrub = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const applyClientX = (clientX: number) => {
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0) return;
      const u = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      studio.setCurrentTime(u * comp.duration);
    };
    applyClientX(e.clientX);
    const onMove = (ev: PointerEvent) => applyClientX(ev.clientX);
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  // BUG-P1-06 Fix: Horizontal clip-bar slip/retime dragging
  const startClipSlide = (
    e: React.PointerEvent<HTMLDivElement>,
    layerId: string,
    origIn: number,
    origOut: number,
    origStart: number,
    locked: boolean,
  ) => {
    e.stopPropagation();
    studio.setSelectedLayerIds([layerId]);
    if (locked) return;
    const rect = rulerRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return;
    const startX = e.clientX;
    const clipLen = Math.max(0.05, origOut - origIn);
    let moved = false;

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      if (!moved && Math.abs(dx) < 3) return;
      moved = true;
      const dt = (dx / rect.width) * comp.duration;
      const nextIn = Math.max(0, Math.min(comp.duration - clipLen, Number((origIn + dt).toFixed(3))));
      const nextOut = Number((nextIn + clipLen).toFixed(3));
      const actualDelta = nextIn - origIn;
      studio.commitProjectChange(
        'Slide Layer Timing',
        (draft) => {
          const target = draft.compositions
            .find((c) => c.id === draft.activeCompId)
            ?.layers.find((x) => x.id === layerId);
          if (!target) return;
          target.inPoint = nextIn;
          target.outPoint = nextOut;
          target.startTime = Number((origStart + actualDelta).toFixed(3));
        },
        `slide_${layerId}`,
      );
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

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
        overflow: 'hidden',
      }}
    >
      {/* Top Timeline / Graph / Node / Render Queue Mode Bar */}
      <div className="panel-header">
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

          <div style={{ width: 1, height: 16, background: 'var(--border-subtle)' }} />

          <button
            className="studio-btn ghost"
            style={{ width: 24, height: 22, minHeight: 22, padding: 0 }}
            onClick={() => studio.setCurrentTime(0)}
            title="Jump to Start (Home)"
          >
            <IconSkipStart size={11} />
          </button>
          <button
            className="studio-btn ghost"
            style={{ width: 24, height: 22, minHeight: 22, padding: 0 }}
            onClick={() => studio.setCurrentTime((tc) => Math.max(0, tc - 1 / comp.fps))}
            title="Step Back 1 Frame (ArrowLeft)"
          >
            <IconStepBack size={11} />
          </button>
          <button
            aria-label={studio.isPlaying ? 'Pause Playback' : 'Play RAM Preview'}
            className={`studio-btn ${studio.isPlaying ? 'primary' : ''}`}
            style={{ minHeight: 22, padding: '2px 9px' }}
            onClick={() => studio.setIsPlaying((p) => !p)}
            title="RAM Preview Play / Pause (Space)"
          >
            {studio.isPlaying ? <IconPause size={11} /> : <IconPlay size={11} />}
            <span>{studio.isPlaying ? 'Pause' : 'Play'}</span>
          </button>
          <button
            className="studio-btn ghost"
            style={{ width: 24, height: 22, minHeight: 22, padding: 0 }}
            onClick={() => studio.setCurrentTime((tc) => Math.min(comp.duration, tc + 1 / comp.fps))}
            title="Step Forward 1 Frame (ArrowRight)"
          >
            <IconStepFwd size={11} />
          </button>

          <span
            className="mono"
            style={{
              padding: '2px 8px',
              borderRadius: 4,
              background: 'var(--bg-inset)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--accent-amber)',
              fontWeight: 600,
              fontSize: 11.5,
              cursor: 'pointer',
            }}
            onClick={() => studio.updatePreferences({ showTimecodeAsFrames: !studio.preferences.showTimecodeAsFrames })}
            title="Click to toggle SMPTE Timecode / Absolute Frames"
          >
            {studio.preferences.showTimecodeAsFrames
              ? `${String(Math.round(studio.currentTime * comp.fps)).padStart(5, '0')} f`
              : formatTimecode(studio.currentTime, comp.fps)}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <input
            className="studio-input"
            style={{ width: 132, minHeight: 23, padding: '2px 7px', fontSize: 11 }}
            placeholder="Filter layers…"
            value={timelineSearch}
            onChange={(e) => setTimelineSearch(e.target.value)}
          />
          <button
            className={`studio-btn ${comp.hideShyLayers ? 'subtle-active' : ''}`}
            style={{ minHeight: 23, padding: '2px 7px', fontSize: 10.5 }}
            onClick={() =>
              studio.commitProjectChange('Toggle Hide Shy Layers', (draft) => {
                const c = draft.compositions.find((x) => x.id === draft.activeCompId);
                if (c) c.hideShyLayers = !c.hideShyLayers;
              })
            }
          >
            Shy
          </button>
          <button
            className={`studio-btn ${comp.motionBlurEnabled ? 'subtle-active' : ''}`}
            style={{ minHeight: 23, padding: '2px 7px', fontSize: 10.5 }}
            onClick={() => {
              studio.commitProjectChange('Toggle Comp Motion Blur', (draft) => {
                const c = draft.compositions.find((x) => x.id === draft.activeCompId);
                if (c) c.motionBlurEnabled = !c.motionBlurEnabled;
              });
            }}
          >
            Motion Blur
          </button>
          <button className="studio-btn" style={{ minHeight: 23, padding: '2px 7px', fontSize: 10.5 }} onClick={studio.splitSelectedLayersAtPlayhead} title="Split Layer (Ctrl+Shift+D)">
            Split
          </button>
          <button className="studio-btn" style={{ minHeight: 23, padding: '2px 7px', fontSize: 10.5 }} onClick={() => studio.duplicateSelectedLayers(true)} title="Smart Duplicate Hierarchy (Ctrl+Alt+D)">
            Smart Dup
          </button>
          <button className="studio-btn" style={{ minHeight: 23, padding: '2px 7px', fontSize: 10.5 }} onClick={() => studio.precomposeSelectedLayers()} title="Pre-compose (Ctrl+Shift+C)">
            Pre-comp
          </button>
          <button className="studio-btn" style={{ minHeight: 23, padding: '2px 7px', fontSize: 10.5 }} onClick={() => studio.applyKeyframeAssistant('easy-ease')} title="Easy Ease (F9)">
            Easy Ease
          </button>
        </div>
      </div>

      {/* MODE 1: MULTI-TRACK LAYER STACK & KEYFRAME TIMELINE */}
      {studio.bottomMode === 'timeline' && (
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
          {/* Left Columns */}
          <div style={{ width: 425, flexShrink: 0, borderRight: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div
              style={{
                height: 24,
                padding: '0 8px',
                background: 'var(--bg-inset)',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'grid',
                gridTemplateColumns: '64px 1fr 90px 44px',
                alignItems: 'center',
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                color: 'var(--text-muted)',
              }}
            >
              <span>V · S · L</span>
              <span>Layer</span>
              <span>Parent</span>
              <span>3D · M</span>
            </div>

            <div ref={leftScrollRef} onScroll={onLeftScroll} style={{ flex: 1, overflowY: 'auto' }}>
              {visibleLayers.map((lyr, idx) => {
                const isSel = studio.selectedLayerIds.includes(lyr.id);
                const isExpanded = expandedLayerId === lyr.id;
                return (
                  <React.Fragment key={lyr.id}>
                    <div
                      onClick={(e) => {
                        if (e.metaKey || e.ctrlKey || e.shiftKey) {
                          studio.setSelectedLayerIds(
                            isSel ? studio.selectedLayerIds.filter((x) => x !== lyr.id) : [...studio.selectedLayerIds, lyr.id],
                          );
                        } else {
                          studio.setSelectedLayerIds([lyr.id]);
                        }
                      }}
                      onDoubleClick={() => {
                        if (lyr.type === 'precomp' && lyr.precompId) {
                          studio.openActiveComp(lyr.precompId);
                        }
                      }}
                      style={{
                        height: 28,
                        padding: '0 8px',
                        display: 'grid',
                        gridTemplateColumns: '64px 1fr 90px 44px',
                        alignItems: 'center',
                        borderBottom: '1px solid var(--border-subtle)',
                        background: isSel ? 'var(--bg-selected)' : idx % 2 === 0 ? 'transparent' : 'rgba(128,128,128,0.03)',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 3 }} onClick={(e) => e.stopPropagation()}>
                        <button
                          style={{ padding: 2, opacity: lyr.visible ? 1 : 0.3, color: 'var(--text-primary)' }}
                          title="Toggle Visibility"
                          onClick={() => {
                            studio.commitProjectChange('Toggle Visibility', (draft) => {
                              const target = draft.compositions.find((c) => c.id === draft.activeCompId)?.layers.find((x) => x.id === lyr.id);
                              if (target) target.visible = !target.visible;
                            });
                          }}
                        >
                          <IconEye size={12} />
                        </button>
                        <button
                          className="mono"
                          style={{
                            width: 16,
                            height: 16,
                            fontSize: 9.5,
                            fontWeight: 700,
                            borderRadius: 3,
                            background: lyr.solo ? 'var(--accent-amber)' : 'var(--bg-elevated)',
                            border: '1px solid var(--border-subtle)',
                            color: lyr.solo ? 'var(--accent-on-primary)' : 'var(--text-muted)',
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
                          className="mono"
                          style={{
                            width: 16,
                            height: 16,
                            fontSize: 9.5,
                            fontWeight: 700,
                            borderRadius: 3,
                            background: lyr.locked ? 'var(--status-err)' : 'var(--bg-elevated)',
                            border: '1px solid var(--border-subtle)',
                            color: lyr.locked ? '#ffffff' : 'var(--text-muted)',
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

                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, overflow: 'hidden', paddingRight: 6 }}>
                        <button
                          style={{ fontSize: 9.5, color: 'var(--text-muted)', padding: '0 2px' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedLayerId(isExpanded ? null : lyr.id);
                          }}
                        >
                          {isExpanded ? '▾' : '▸'}
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
                        <span style={{ fontWeight: isSel ? 600 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-primary)' }}>
                          {lyr.name}
                        </span>
                      </div>

                      <select
                        className="studio-select"
                        style={{ minHeight: 20, padding: '1px 3px', fontSize: 10, width: 84 }}
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
                            <option key={o.id} value={o.id}>
                              {o.name}
                            </option>
                          ))}
                      </select>

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
                          <IconCube3D size={12} />
                        </button>
                        <button
                          className="mono"
                          style={{
                            fontSize: 9.5,
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

                    {isExpanded && (
                      <div
                        style={{
                          padding: '6px 10px',
                          background: 'var(--bg-inset)',
                          borderBottom: '1px solid var(--border-subtle)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          height: 36,
                        }}
                      >
                        <span className="mono" style={{ fontSize: 10, color: 'var(--accent-cyan)' }}>pos.expr =</span>
                        <input
                          className="studio-input mono"
                          style={{ flex: 1, minHeight: 22, fontSize: 10.5, padding: '2px 6px' }}
                          placeholder="e.g. wiggle(2, 20) or value + [0, Math.sin(time*3)*15, 0]"
                          value={lyr.transform.position.expression ?? ''}
                          onChange={(e) => {
                            const expr = e.target.value;
                            studio.commitProjectChange(
                              'Edit Position Expression',
                              (draft) => {
                                const target = draft.compositions.find((c) => c.id === draft.activeCompId)?.layers.find((x) => x.id === lyr.id);
                                if (target) {
                                  target.transform.position.expression = expr;
                                  target.transform.position.expressionEnabled = expr.trim().length > 0;
                                }
                              },
                              `expr_${lyr.id}`,
                            );
                          }}
                        />
                        <select
                          className="studio-select"
                          style={{ minHeight: 22, fontSize: 10, width: 92 }}
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
                          <option value="">Pick Whip</option>
                          {comp.layers
                            .filter((o) => o.id !== lyr.id)
                            .map((o) => (
                              <option key={o.id} value={o.name}>
                                {o.name}
                              </option>
                            ))}
                        </select>
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          {/* Right Time Ruler, Work Area, Draggable Clip Bars & Keyframe Diamonds */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
            <div
              ref={rulerRef}
              onPointerDown={startRulerScrub}
              style={{
                height: 24,
                background: 'var(--bg-inset)',
                borderBottom: '1px solid var(--border-subtle)',
                position: 'relative',
                cursor: 'ew-resize',
                flexShrink: 0,
              }}
              title="Click or drag horizontally to scrub playhead"
            >
              {/* Work Area Bar */}
              <div
                style={{
                  position: 'absolute',
                  left: `${(comp.workAreaStart / comp.duration) * 100}%`,
                  width: `${((comp.workAreaEnd - comp.workAreaStart) / comp.duration) * 100}%`,
                  top: 0,
                  bottom: 0,
                  background: 'rgba(76, 195, 255, 0.12)',
                  borderLeft: '2px solid var(--accent-cyan)',
                  borderRight: '2px solid var(--accent-cyan)',
                  pointerEvents: 'none',
                }}
              />
              {Array.from({ length: Math.ceil(comp.duration) + 1 }, (_, sec) => (
                <div
                  key={sec}
                  className="mono"
                  style={{
                    position: 'absolute',
                    left: `${(sec / comp.duration) * 100}%`,
                    top: 3,
                    fontSize: 9.5,
                    color: 'var(--text-muted)',
                    paddingLeft: 3,
                    pointerEvents: 'none',
                  }}
                >
                  {sec}s
                </div>
              ))}

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
                    color: '#090b0f',
                    fontSize: 9,
                    fontWeight: 700,
                    borderRadius: '0 0 3px 3px',
                    pointerEvents: 'none',
                  }}
                >
                  {m.comment}
                </div>
              ))}

              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: 3,
                  background: studioRamCache.getEntryCount() > 0 ? 'var(--status-ok)' : 'transparent',
                  opacity: 0.65,
                }}
              />
            </div>

            <div
              ref={rightScrollRef}
              onScroll={onRightScroll}
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
                const isSel = studio.selectedLayerIds.includes(lyr.id);
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
                        background: isSel ? 'var(--bg-selected)' : idx % 2 === 0 ? 'var(--bg-panel)' : 'var(--bg-canvas)',
                      }}
                    >
                      <div
                        onPointerDown={(e) =>
                          startClipSlide(e, lyr.id, lyr.inPoint, lyr.outPoint, lyr.startTime, lyr.locked)
                        }
                        title={`${lyr.name} (${lyr.inPoint.toFixed(2)}s – ${lyr.outPoint.toFixed(2)}s) · Drag horizontally to retime`}
                        style={{
                          position: 'absolute',
                          left: `${leftPct}%`,
                          width: `${widthPct}%`,
                          top: 4,
                          bottom: 4,
                          borderRadius: 4,
                          background: `${lyr.labelColor}38`,
                          border: `1px solid ${lyr.labelColor}`,
                          cursor: lyr.locked ? 'not-allowed' : 'grab',
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
                            pointerEvents: 'none',
                          }}
                        >
                          <IconDiamond active size={11} />
                        </div>
                      ))}
                    </div>
                    {expandedLayerId === lyr.id && (
                      <div style={{ height: 36, borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-inset)' }} />
                    )}
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
                  background: 'var(--accent-amber)',
                  pointerEvents: 'none',
                  zIndex: 20,
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* MODE 2: SPEED & VALUE GRAPH EDITOR (BUG-P1-07 & BUG-P2-01 Fixed) */}
      {studio.bottomMode === 'graph' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 10, gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div className="segmented-control">
                <button className={`segmented-item ${graphMode === 'value' ? 'active' : ''}`} onClick={() => setGraphMode('value')}>
                  Value Curve
                </button>
                <button className={`segmented-item ${graphMode === 'speed' ? 'active' : ''}`} onClick={() => setGraphMode('speed')}>
                  Speed Curve
                </button>
              </div>

              <select
                className="studio-select"
                aria-label="Graph Channel"
                value={graphChannel}
                onChange={(e) => setGraphChannel(e.target.value as GraphChannelId)}
              >
                <option value="posX">Position X</option>
                <option value="posY">Position Y</option>
                <option value="scaleX">Scale %</option>
                <option value="rotZ">Rotation Z</option>
                <option value="opacity">Opacity %</option>
              </select>

              <span style={{ color: 'var(--text-secondary)', fontSize: 11 }}>
                Layer: <strong>{studio.selectedLayer?.name ?? 'None'}</strong>
              </span>
            </div>

            <div style={{ display: 'flex', gap: 6 }}>
              <button className="studio-btn" onClick={() => studio.applyKeyframeAssistant('easy-ease')}>
                Easy Ease (F9)
              </button>
              <button
                className="studio-btn"
                onClick={() => {
                  if (!studio.selectedLayer) return;
                  studio.commitProjectChange(`Apply Wiggler (${graphChannel})`, (draft) => {
                    const c = draft.compositions.find((x) => x.id === draft.activeCompId);
                    const l = c?.layers.find((x) => x.id === studio.selectedLayer!.id);
                    if (!c || !l) return;
                    if (graphChannel === 'rotZ' || graphChannel === 'opacity') {
                      const prop = graphChannel === 'rotZ' ? l.transform.rotationZ : l.transform.opacity;
                      if (prop.keyframes.length < 2) {
                        prop.animated = true;
                        prop.keyframes = [
                          { id: createId('kf'), time: 0, value: prop.value, interpolation: 'bezier' },
                          { id: createId('kf'), time: c.duration, value: prop.value, interpolation: 'bezier' },
                        ];
                      }
                      const wiggled = applyWigglerToProperty(prop, 4, 15);
                      if (graphChannel === 'rotZ') l.transform.rotationZ = wiggled;
                      else l.transform.opacity = wiggled;
                    } else {
                      const axis = graphChannel === 'posX' ? 0 : 1;
                      const prop = graphChannel === 'scaleX' ? l.transform.scale : l.transform.position;
                      prop.animated = true;
                      const base = prop.value.slice() as [number, number, number];
                      prop.keyframes = Array.from({ length: 9 }, (_, i) => {
                        const v = base.slice() as [number, number, number];
                        const delta = Math.round(Math.sin(i * 1.9) * (graphChannel === 'scaleX' ? 14 : 38));
                        v[axis] += delta;
                        if (graphChannel === 'scaleX') v[1] += delta;
                        return {
                          id: createId('kf'),
                          time: Number(((i / 8) * c.duration).toFixed(3)),
                          value: v,
                          interpolation: 'bezier' as const,
                        };
                      });
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
                  studio.commitProjectChange(`Apply Smoother (${graphChannel})`, (draft) => {
                    const l = draft.compositions.find((c) => c.id === draft.activeCompId)?.layers.find((x) => x.id === studio.selectedLayer!.id);
                    if (!l) return;
                    if (graphChannel === 'rotZ' && l.transform.rotationZ.keyframes.length >= 3) {
                      l.transform.rotationZ = applySmootherToProperty(l.transform.rotationZ, 2);
                    } else if (graphChannel === 'opacity' && l.transform.opacity.keyframes.length >= 3) {
                      l.transform.opacity = applySmootherToProperty(l.transform.opacity, 2);
                    } else {
                      const kfs = (graphChannel === 'scaleX' ? l.transform.scale : l.transform.position).keyframes;
                      for (let i = 1; i < kfs.length - 1; i++) {
                        kfs[i].value = [
                          Math.round((kfs[i - 1].value[0] + kfs[i].value[0] * 2 + kfs[i + 1].value[0]) / 4),
                          Math.round((kfs[i - 1].value[1] + kfs[i].value[1] * 2 + kfs[i + 1].value[1]) / 4),
                          kfs[i].value[2],
                        ];
                      }
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
            style={{ flex: 1, width: '100%', background: 'var(--bg-inset)', borderRadius: 6, border: '1px solid var(--border-subtle)' }}
          >
            <line x1="0" y1="45" x2="1000" y2="45" stroke="var(--grid-line)" strokeDasharray="4 4" />
            <line x1="0" y1="90" x2="1000" y2="90" stroke="var(--grid-line)" />
            <line x1="0" y1="135" x2="1000" y2="135" stroke="var(--grid-line)" strokeDasharray="4 4" />
            {studio.selectedLayer &&
              (() => {
                const tr = studio.selectedLayer.transform;
                const samples =
                  graphChannel === 'posX'
                    ? sampleGraphCurve(tr.position, 0, comp.duration, 120, 0)
                    : graphChannel === 'posY'
                    ? sampleGraphCurve(tr.position, 0, comp.duration, 120, 1)
                    : graphChannel === 'scaleX'
                    ? sampleGraphCurve(tr.scale, 0, comp.duration, 120, 0)
                    : graphChannel === 'rotZ'
                    ? sampleGraphCurve(tr.rotationZ, 0, comp.duration, 120, 0)
                    : sampleGraphCurve(tr.opacity, 0, comp.duration, 120, 0);

                const vals = samples.map((s) => (graphMode === 'value' ? s.value : s.speed));
                const minV = Math.min(...vals);
                const maxV = Math.max(...vals, minV + 1);
                const pts = samples
                  .map((s, idx) => {
                    const x = (idx / (samples.length - 1)) * 1000;
                    const v = graphMode === 'value' ? s.value : s.speed;
                    const y = 165 - ((v - minV) / Math.max(1, maxV - minV)) * 150;
                    return `${x.toFixed(1)},${y.toFixed(1)}`;
                  })
                  .join(' ');

                const rawKfs =
                  graphChannel === 'posX'
                    ? tr.position.keyframes.map((k) => ({ id: k.id, time: k.time, val: k.value[0] }))
                    : graphChannel === 'posY'
                    ? tr.position.keyframes.map((k) => ({ id: k.id, time: k.time, val: k.value[1] }))
                    : graphChannel === 'scaleX'
                    ? tr.scale.keyframes.map((k) => ({ id: k.id, time: k.time, val: k.value[0] }))
                    : graphChannel === 'rotZ'
                    ? tr.rotationZ.keyframes.map((k) => ({ id: k.id, time: k.time, val: k.value }))
                    : tr.opacity.keyframes.map((k) => ({ id: k.id, time: k.time, val: k.value }));

                return (
                  <>
                    <polyline
                      fill="none"
                      stroke={graphMode === 'value' ? 'var(--accent-cyan)' : 'var(--accent-amber)'}
                      strokeWidth="2.4"
                      points={pts}
                    />
                    {graphMode === 'value' &&
                      rawKfs.map((kf) => {
                        const x = (kf.time / comp.duration) * 1000;
                        const y = 165 - ((kf.val - minV) / Math.max(1, maxV - minV)) * 150;
                        return <circle key={kf.id} cx={x} cy={y} r="5" fill="var(--accent-amber)" stroke="var(--bg-inset)" strokeWidth="1.5" />;
                      })}
                  </>
                );
              })()}
            <line
              x1={(studio.currentTime / comp.duration) * 1000}
              y1="0"
              x2={(studio.currentTime / comp.duration) * 1000}
              y2="180"
              stroke="var(--accent-amber)"
              strokeDasharray="4 3"
            />
          </svg>
        </div>
      )}

      {/* MODE 3: BIDIRECTIONAL NODE COMPOSITING GRAPH (Theme-adaptive via CSS variables!) */}
      {studio.bottomMode === 'nodes' && (
        <div
          style={{
            flex: 1,
            position: 'relative',
            background: 'var(--bg-inset)',
            backgroundImage: 'radial-gradient(var(--grid-line) 1px, transparent 1px)',
            backgroundSize: '20px 20px',
            overflow: 'auto',
          }}
        >
          <div style={{ position: 'sticky', top: 8, left: 10, zIndex: 10, display: 'inline-flex', gap: 8, padding: 4 }}>
            <span className="badge purple">Bidirectional Layer ⇄ DAG Sync</span>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)', alignSelf: 'center' }}>
              Click any Source or Effect node to toggle bypass — syncs live with Timeline &amp; Inspector.
            </span>
          </div>
          {(() => {
            const nodes = comp.nodeGraph?.nodes ?? [];
            const nodeMap = new Map(nodes.map((n) => [n.id, n]));
            return (
              <svg width={1220} height={Math.max(240, nodes.length * 46)} style={{ display: 'block' }}>
                {nodes.flatMap((n) =>
                  n.inputs.map((inId) => {
                    const src = nodeMap.get(inId);
                    if (!src) return null;
                    const x1 = src.x + 155;
                    const y1 = src.y + 18;
                    const x2 = n.x;
                    const y2 = n.y + 18;
                    const cx = (x1 + x2) / 2;
                    return (
                      <path
                        key={`${inId}->${n.id}`}
                        d={`M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`}
                        fill="none"
                        stroke={n.bypassed || src.bypassed ? 'var(--border-strong)' : 'var(--accent-cyan)'}
                        strokeWidth="1.8"
                      />
                    );
                  }),
                )}

                {nodes.map((n) => {
                  const accent =
                    n.kind === 'output'
                      ? 'var(--accent-amber)'
                      : n.kind === 'merge'
                      ? 'var(--accent-purple)'
                      : n.kind === 'effect'
                      ? 'var(--accent-cyan)'
                      : 'var(--status-ok)';
                  return (
                    <g
                      key={n.id}
                      transform={`translate(${n.x}, ${n.y})`}
                      style={{ cursor: 'pointer', opacity: n.bypassed ? 0.42 : 1 }}
                      onClick={() => studio.toggleNodeBypass(n.id)}
                    >
                      <rect width={155} height={36} rx={6} fill="var(--node-card-bg)" stroke={accent} strokeWidth="1.5" />
                      <rect width={5} height={36} rx={2} fill={accent} />
                      <text x={12} y={15} fill="var(--text-primary)" fontSize="10" fontWeight="700">
                        {n.label.slice(0, 21)}
                      </text>
                      <text x={12} y={28} fill="var(--text-muted)" fontSize="9">
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
            <span style={{ fontWeight: 600 }}>
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

          {studio.project.renderQueue.length === 0 && (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>
              Queue is empty — click <strong>Export</strong> in the top bar or press <span className="kbd-chip">Ctrl+M</span>.
            </div>
          )}

          {studio.project.renderQueue.map((job) => {
            const jobComp = studio.project.compositions.find((c) => c.id === job.compId);
            return (
              <div
                key={job.id}
                className="inspector-card"
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}
              >
                <div>
                  <div style={{ fontWeight: 600 }}>
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
                        const fmt = e.target.value as OutputModuleConfig['format'];
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
                      <IconDownload size={12} /> {art.name} ({(art.byteLength / 1024).toFixed(1)} KB)
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
