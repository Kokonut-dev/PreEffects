import React, { useMemo, useState } from 'react';
import { useStudio } from '../state/StudioContext';
import { ALL_BLEND_MODES, Layer, ShapeOperator } from '../../engine/types';
import { evaluateProperty } from '../../engine/expressions';
import { computeVideoScopes } from '../../utils/color';
import { autoTraceAlphaToMask } from '../../engine/masksAndRoto';
import { synthesizeContentAwareFill, trackFeaturePatchNcc } from '../../engine/trackingAndPaint';
import { renderCompositionFrame } from '../../engine/compositor';
import { convertAudioSamplesToKeyframes } from '../../engine/animation';
import { generateSynthAudioBuffer, measureAudioVuDb } from '../../engine/audio';
import {
  executeStudioScript,
  SAMPLE_AUTOMATION_SCRIPTS,
  ScriptLanguage,
  studioPluginRegistry,
} from '../../plugins/sdk';
import { createDefaultTransform, createId } from '../../engine/factory';
import { IconDiamond } from './Icons';
import { ScrubNumberInput } from './ScrubNumberInput';

export const InspectorAndToolsPanel: React.FC<{ widthPx?: number }> = ({ widthPx = 332 }) => {
  const studio = useStudio();
  const [scriptLang, setScriptLang] = useState<ScriptLanguage>('javascript');
  const [scriptCode, setScriptCode] = useState<string>(SAMPLE_AUTOMATION_SCRIPTS.javascript);
  const [scriptLogs, setScriptLogs] = useState<string[]>([]);
  const [customPluginCode, setCustomPluginCode] = useState<string>(
    `sdk.registerPlugin({ id: "plg-custom-1", name: "Chromatic Film Grain", version: "1.0.0", author: "Local Artist", kind: "effect", description: "Custom sandboxed plugin" });`,
  );
  const [gitCommitMsg, setGitCommitMsg] = useState<string>('Hero Title Polish v2');

  const comp = studio.activeComp;
  const layer = studio.selectedLayer;

  const scopes = useMemo(() => {
    if (studio.rightTab !== 'scopes' || !studio.lastFrameResult) return null;
    return computeVideoScopes(studio.lastFrameResult.pixels, studio.lastFrameResult.width, studio.lastFrameResult.height, 4);
  }, [studio.rightTab, studio.lastFrameResult]);

  const audioVu = useMemo(() => {
    const synth = generateSynthAudioBuffer(2, 8000, 124);
    return measureAudioVuDb(synth, studio.currentTime % 2, 8000);
  }, [studio.currentTime]);

  const updateTransformScalar = (
    propKey: 'rotationX' | 'rotationY' | 'rotationZ' | 'opacity',
    nextVal: number,
  ) => {
    if (!layer) return;
    studio.commitProjectChange(
      `Adjust ${propKey}`,
      (draft) => {
        const c = draft.compositions.find((x) => x.id === draft.activeCompId);
        const l = c?.layers.find((x) => x.id === layer.id);
        if (!l) return;
        const prop = l.transform[propKey];
        if (prop.animated) {
          const kf = prop.keyframes.find((k) => Math.abs(k.time - studio.currentTime) < 0.03);
          if (kf) kf.value = nextVal;
          else prop.keyframes.push({ id: createId('kf'), time: Number(studio.currentTime.toFixed(3)), value: nextVal, interpolation: 'bezier' });
          prop.keyframes.sort((a, b) => a.time - b.time);
        } else {
          prop.value = nextVal;
        }
      },
      `xform_${layer.id}_${propKey}`,
    );
  };

  const updateTransformVec = (propKey: 'position' | 'scale' | 'anchorPoint', axisIdx: 0 | 1 | 2, nextVal: number) => {
    if (!layer || !comp) return;
    const cur = [...evaluateProperty(layer.transform[propKey], studio.currentTime, layer, comp, studio.project).value] as [number, number, number];
    cur[axisIdx] = nextVal;
    studio.commitProjectChange(
      `Adjust ${propKey}`,
      (draft) => {
        const c = draft.compositions.find((x) => x.id === draft.activeCompId);
        const l = c?.layers.find((x) => x.id === layer.id);
        if (!l) return;
        const prop = l.transform[propKey];
        if (prop.animated) {
          const kf = prop.keyframes.find((k) => Math.abs(k.time - studio.currentTime) < 0.03);
          if (kf) kf.value = cur;
          else prop.keyframes.push({ id: createId('kf'), time: Number(studio.currentTime.toFixed(3)), value: cur, interpolation: 'bezier' });
          prop.keyframes.sort((a, b) => a.time - b.time);
        } else {
          prop.value = cur;
        }
      },
      `xform_${layer.id}_${propKey}`,
    );
  };

  const runMotionTrackerOnComp = () => {
    if (!comp || !layer) return;
    const f0 = renderCompositionFrame(comp, 0, studio.project, { resolutionDivisor: 4, useCache: false });
    const f1 = renderCompositionFrame(comp, 0.5, studio.project, { resolutionDivisor: 4, useCache: false });
    const tracked = trackFeaturePatchNcc(f0.pixels, f1.pixels, f0.width, f0.height, Math.round(f0.width / 2), Math.round(f0.height / 2));

    studio.commitProjectChange('Solve 2D Feature Motion Track to Null', (draft) => {
      const c = draft.compositions.find((x) => x.id === draft.activeCompId);
      if (!c) return;
      c.layers.unshift({
        id: createId('lyr'),
        name: `Track_Data_Null (${Math.round(tracked.confidence * 100)}%)`,
        type: 'null',
        labelColor: '#34D399',
        visible: true,
        audioEnabled: false,
        solo: false,
        locked: false,
        shy: false,
        collapseTransformations: false,
        frameBlending: 'off',
        motionBlur: false,
        threeD: false,
        inPoint: 0,
        outPoint: c.duration,
        startTime: 0,
        stretchPct: 100,
        blendMode: 'normal',
        trackMatteMode: 'none',
        transform: {
          ...createDefaultTransform(tracked.x * 4, tracked.y * 4, 0, 0),
          position: {
            value: [tracked.x * 4, tracked.y * 4, 0],
            animated: true,
            keyframes: [
              { id: createId('kf'), time: 0, value: [c.width / 2, c.height / 2, 0], interpolation: 'linear' },
              { id: createId('kf'), time: 0.5, value: [tracked.x * 4, tracked.y * 4, 0], interpolation: 'linear' },
            ],
          },
        },
        masks: [],
        effects: [],
        paintStrokes: [],
        puppetPins: [],
        markers: [],
      });
    });
    studio.notify(`Motion Tracker solved feature path (${(tracked.confidence * 100).toFixed(1)}% NCC confidence) -> Track_Data_Null`);
  };

  return (
    <aside
      style={{
        width: widthPx,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-panel)',
        borderLeft: '1px solid var(--border-subtle)',
        overflow: 'hidden',
      }}
    >
      <div className="panel-header">
        <div className="panel-tabs">
          <button className={`panel-tab ${studio.rightTab === 'inspector' ? 'active' : ''}`} onClick={() => studio.setRightTab('inspector')}>
            Inspector
          </button>
          <button className={`panel-tab ${studio.rightTab === 'scopes' ? 'active' : ''}`} onClick={() => studio.setRightTab('scopes')}>
            Scopes
          </button>
          <button className={`panel-tab ${studio.rightTab === 'tracker' ? 'active' : ''}`} onClick={() => studio.setRightTab('tracker')}>
            Track &amp; Roto
          </button>
          <button className={`panel-tab ${studio.rightTab === 'scripting' ? 'active' : ''}`} onClick={() => studio.setRightTab('scripting')}>
            Script &amp; Git
          </button>
        </div>
      </div>

      {/* TAB 1: LAYER INSPECTOR, TEXT/SHAPE/MASK/3D & EFFECT CONTROLS + PROFILER */}
      {studio.rightTab === 'inspector' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {!layer || !comp ? (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>
              Select a layer in the Timeline or Viewport to inspect Transform, Effects, Masks, Text &amp; 3D Material properties.
            </div>
          ) : (
            <>
              {/* Selected Layer Header */}
              <div
                style={{
                  padding: 8,
                  borderRadius: 5,
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                  <input
                    aria-label="Selected Layer Name"
                    className="studio-input"
                    style={{ fontWeight: 700, flex: 1 }}
                    value={layer.name}
                    onChange={(e) => {
                      const val = e.target.value;
                      studio.commitProjectChange('Rename Layer', (draft) => {
                        const c = draft.compositions.find((x) => x.id === draft.activeCompId);
                        const l = c?.layers.find((x) => x.id === layer.id);
                        if (l) l.name = val;
                      }, `rename_${layer.id}`);
                    }}
                  />
                  <span className="badge amber">{layer.type.toUpperCase()}</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>Blend Mode (38)</div>
                    <select
                      className="studio-select"
                      style={{ width: '100%' }}
                      value={layer.blendMode}
                      onChange={(e) => {
                        const bm = e.target.value as Layer['blendMode'];
                        studio.commitProjectChange('Change Blend Mode', (draft) => {
                          const c = draft.compositions.find((x) => x.id === draft.activeCompId);
                          const l = c?.layers.find((x) => x.id === layer.id);
                          if (l) l.blendMode = bm;
                        });
                      }}
                    >
                      {ALL_BLEND_MODES.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>Track Matte</div>
                    <select
                      className="studio-select"
                      style={{ width: '100%' }}
                      value={layer.trackMatteMode}
                      onChange={(e) => {
                        const tm = e.target.value as Layer['trackMatteMode'];
                        studio.commitProjectChange('Change Track Matte Mode', (draft) => {
                          const c = draft.compositions.find((x) => x.id === draft.activeCompId);
                          const l = c?.layers.find((x) => x.id === layer.id);
                          if (l && c) {
                            l.trackMatteMode = tm;
                            if (tm !== 'none' && !l.trackMatteLayerId) {
                              const other = c.layers.find((o) => o.id !== l.id);
                              l.trackMatteLayerId = other?.id;
                            }
                          }
                        });
                      }}
                    >
                      <option value="none">No Matte</option>
                      <option value="alpha">Alpha Matte</option>
                      <option value="alpha-inverted">Alpha Inverted</option>
                      <option value="luma">Luma Matte</option>
                      <option value="luma-inverted">Luma Inverted</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Transform 2D / 3D Controls */}
              <div style={{ padding: 8, borderRadius: 5, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                    Transform {layer.threeD ? '(3D XYZ)' : '(2D)'}
                  </span>
                  <button
                    className={`studio-btn ${layer.threeD ? 'primary' : ''}`}
                    style={{ padding: '1px 6px', fontSize: 10 }}
                    onClick={() => {
                      studio.commitProjectChange('Toggle 3D Layer Switch', (draft) => {
                        const c = draft.compositions.find((x) => x.id === draft.activeCompId);
                        const l = c?.layers.find((x) => x.id === layer.id);
                        if (l) l.threeD = !l.threeD;
                      });
                    }}
                  >
                    3D Layer
                  </button>
                </div>

                {(['position', 'scale', 'anchorPoint'] as const).map((vecKey) => {
                  const val = evaluateProperty(layer.transform[vecKey], studio.currentTime, layer, comp, studio.project).value;
                  return (
                    <div key={vecKey} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5, gap: 4 }}>
                      <button
                        className="studio-btn ghost"
                        style={{ padding: 2 }}
                        title={`Toggle Keyframe on ${vecKey}`}
                        onClick={() => studio.toggleKeyframeOnTransform(vecKey)}
                      >
                        <IconDiamond active={layer.transform[vecKey].animated} />
                      </button>
                      <span style={{ width: 68, fontSize: 11, color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                        {vecKey === 'anchorPoint' ? 'Anchor' : vecKey}
                      </span>
                      <div style={{ display: 'flex', gap: 3, flex: 1 }}>
                        {[0, 1, ...(layer.threeD ? [2] : [])].map((axis) => (
                          <ScrubNumberInput
                            key={axis}
                            ariaLabel={`${vecKey} axis ${axis}`}
                            value={val[axis]}
                            suffix={vecKey === 'scale' ? '%' : ''}
                            onChange={(nv) => updateTransformVec(vecKey, axis as 0 | 1 | 2, nv)}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}

                {(['rotationZ', 'opacity'] as const).map((scKey) => {
                  const val = evaluateProperty(layer.transform[scKey], studio.currentTime, layer, comp, studio.project).value;
                  return (
                    <div key={scKey} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, gap: 4 }}>
                      <button
                        className="studio-btn ghost"
                        style={{ padding: 2 }}
                        onClick={() => studio.toggleKeyframeOnTransform(scKey)}
                      >
                        <IconDiamond active={layer.transform[scKey].animated} />
                      </button>
                      <span style={{ width: 68, fontSize: 11, color: 'var(--text-secondary)' }}>
                        {scKey === 'rotationZ' ? 'Rotation °' : 'Opacity %'}
                      </span>
                      <input
                        type="range"
                        min={scKey === 'opacity' ? 0 : -180}
                        max={scKey === 'opacity' ? 100 : 180}
                        value={Math.round(val)}
                        onChange={(e) => updateTransformScalar(scKey, Number(e.target.value))}
                        style={{ flex: 1 }}
                      />
                      <span className="mono" style={{ width: 38, textAlign: 'right', fontSize: 11 }}>
                        {Math.round(val)}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Typography & Per-Character Text Animator Section */}
              {layer.type === 'text' && layer.textData && (
                <div style={{ padding: 8, borderRadius: 5, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', color: 'var(--accent-amber)' }}>
                    Character, Paragraph &amp; Text Animators
                  </div>
                  <textarea
                    rows={2}
                    className="studio-input"
                    value={layer.textData.text}
                    onChange={(e) => {
                      const txt = e.target.value;
                      studio.commitProjectChange('Edit Text Content', (draft) => {
                        const l = draft.compositions.find((c) => c.id === draft.activeCompId)?.layers.find((x) => x.id === layer.id);
                        if (l?.textData) l.textData.text = txt;
                      }, `txt_${layer.id}`);
                    }}
                  />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 5 }}>
                    <div>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Size px</span>
                      <input
                        type="number"
                        className="studio-input mono"
                        style={{ width: '100%' }}
                        value={layer.textData.fontSize}
                        onChange={(e) => {
                          const sz = Number(e.target.value);
                          studio.commitProjectChange('Font Size', (draft) => {
                            const l = draft.compositions.find((c) => c.id === draft.activeCompId)?.layers.find((x) => x.id === layer.id);
                            if (l?.textData) l.textData.fontSize = sz;
                          });
                        }}
                      />
                    </div>
                    <div>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Tracking</span>
                      <input
                        type="number"
                        className="studio-input mono"
                        style={{ width: '100%' }}
                        value={layer.textData.tracking}
                        onChange={(e) => {
                          const tr = Number(e.target.value);
                          studio.commitProjectChange('Text Tracking', (draft) => {
                            const l = draft.compositions.find((c) => c.id === draft.activeCompId)?.layers.find((x) => x.id === layer.id);
                            if (l?.textData) l.textData.tracking = tr;
                          });
                        }}
                      />
                    </div>
                    <div>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Fill Color</span>
                      <input
                        type="color"
                        style={{ width: '100%', height: 24, border: 'none', background: 'none' }}
                        value={layer.textData.fillColor}
                        onChange={(e) => {
                          const col = e.target.value;
                          studio.commitProjectChange('Text Color', (draft) => {
                            const l = draft.compositions.find((c) => c.id === draft.activeCompId)?.layers.find((x) => x.id === layer.id);
                            if (l?.textData) l.textData.fillColor = col;
                          });
                        }}
                      />
                    </div>
                  </div>
                  <button
                    className="studio-btn"
                    onClick={() => {
                      studio.commitProjectChange('Add Wiggly Text Animator', (draft) => {
                        const l = draft.compositions.find((c) => c.id === draft.activeCompId)?.layers.find((x) => x.id === layer.id);
                        l?.textData?.animators.push({
                          id: createId('tanim'),
                          name: 'Wiggly Cascade',
                          selectorType: 'wiggly',
                          start: 0,
                          end: 100,
                          offset: 0,
                          shape: 'smooth',
                          positionOffset: [0, -18, 0],
                          scaleOffset: [108, 108],
                          rotationOffset: 4,
                          opacityOffset: 0,
                          trackingOffset: 4,
                          wigglesPerSecond: 3,
                        });
                      });
                    }}
                  >
                    + Add Per-Char Wiggly Animator
                  </button>
                </div>
              )}

              {/* Vector Shape Layer & 9 Non-Destructive Operators */}
              {layer.type === 'shape' && layer.shapeContent && (
                <div style={{ padding: 8, borderRadius: 5, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', color: 'var(--accent-cyan)' }}>
                    Vector Shape &amp; Operators ({layer.shapeContent.operators.length})
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
                    <select
                      className="studio-select"
                      value={layer.shapeContent.kind}
                      onChange={(e) => {
                        const k = e.target.value as NonNullable<Layer['shapeContent']>['kind'];
                        studio.commitProjectChange('Change Shape Geometry', (draft) => {
                          const l = draft.compositions.find((c) => c.id === draft.activeCompId)?.layers.find((x) => x.id === layer.id);
                          if (l?.shapeContent) l.shapeContent.kind = k;
                        });
                      }}
                    >
                      <option value="rect">Rectangle</option>
                      <option value="ellipse">Ellipse</option>
                      <option value="polystar">Polygon / Star</option>
                    </select>
                    <select
                      className="studio-select"
                      defaultValue=""
                      onChange={(e) => {
                        const opType = e.target.value as ShapeOperator['type'];
                        if (!opType) return;
                        studio.commitProjectChange(`Add Shape Operator: ${opType}`, (draft) => {
                          const l = draft.compositions.find((c) => c.id === draft.activeCompId)?.layers.find((x) => x.id === layer.id);
                          l?.shapeContent?.operators.push({
                            id: createId('sop'),
                            type: opType,
                            enabled: true,
                            params: opType === 'trim-paths' ? { start: 0, end: 75, offset: 0 } : opType === 'repeater' ? { copies: 5, rotation: 28 } : { amount: 16, size: 10 },
                          });
                        });
                        e.target.value = '';
                      }}
                    >
                      <option value="">+ Add Operator…</option>
                      <option value="trim-paths">Trim Paths</option>
                      <option value="repeater">Repeater</option>
                      <option value="offset-paths">Offset Paths</option>
                      <option value="pucker-bloat">Pucker &amp; Bloat</option>
                      <option value="wiggle-paths">Wiggle Paths</option>
                      <option value="zig-zag">Zig Zag</option>
                      <option value="round-corners">Round Corners</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Masks & Auto-Trace Alpha */}
              <div style={{ padding: 8, borderRadius: 5, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 5 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                    Masks ({layer.masks.length})
                  </span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      className="studio-btn"
                      style={{ padding: '1px 6px', fontSize: 10 }}
                      onClick={() => {
                        if (!studio.lastFrameResult) return;
                        const mask = autoTraceAlphaToMask(studio.lastFrameResult.pixels, studio.lastFrameResult.width, studio.lastFrameResult.height);
                        studio.commitProjectChange('Auto-Trace Alpha to Bezier Mask', (draft) => {
                          const l = draft.compositions.find((c) => c.id === draft.activeCompId)?.layers.find((x) => x.id === layer.id);
                          l?.masks.push(mask);
                        });
                        studio.notify('Auto-Traced layer alpha into editable Bezier Mask');
                      }}
                    >
                      Auto-Trace Alpha
                    </button>
                    {layer.masks.length > 0 && (
                      <button
                        className="studio-btn"
                        style={{ padding: '1px 6px', fontSize: 10 }}
                        onClick={studio.createNullsFromSelectedMask}
                        title="Create Null control layers pinned to mask vertices (COMP-19)"
                      >
                        Nulls from Path
                      </button>
                    )}
                  </div>
                </div>
                {layer.masks.map((m) => (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11 }}>
                    <span>{m.name} ({m.vertices.length} pts)</span>
                    <span className="mono" style={{ color: 'var(--accent-amber)' }}>Feather {m.feather}px</span>
                  </div>
                ))}
              </div>

              {/* Effect Controls Stack + Per-Effect Performance Profiler */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                    Effect Controls &amp; Profiler ({layer.effects.length})
                  </span>
                  <button className="studio-btn" style={{ padding: '1px 6px', fontSize: 10 }} onClick={() => studio.setLeftTab('effects')}>
                    + Browse 186
                  </button>
                </div>

                {layer.effects.map((fx) => {
                  const timing = studio.lastFrameResult?.effectTimings.find((t) => t.effectInstanceId === fx.id);
                  return (
                    <div
                      key={fx.id}
                      style={{
                        padding: 8,
                        borderRadius: 5,
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--border-subtle)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                          <input
                            type="checkbox"
                            checked={fx.enabled}
                            onChange={() => {
                              studio.commitProjectChange(`Toggle ${fx.name}`, (draft) => {
                                const l = draft.compositions.find((c) => c.id === draft.activeCompId)?.layers.find((x) => x.id === layer.id);
                                const target = l?.effects.find((x) => x.id === fx.id);
                                if (target) target.enabled = !target.enabled;
                              });
                            }}
                          />
                          <span>{fx.name}</span>
                        </label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          {timing && (
                            <span className="badge ok mono" title="Per-Effect Render Cost (EXCEED-12)">
                              {timing.durationMs.toFixed(2)}ms
                            </span>
                          )}
                          <button
                            className="studio-btn ghost"
                            style={{ padding: '0 4px', color: 'var(--status-err)' }}
                            title="Remove Effect"
                            onClick={() => {
                              studio.commitProjectChange(`Delete Effect ${fx.name}`, (draft) => {
                                const l = draft.compositions.find((c) => c.id === draft.activeCompId)?.layers.find((x) => x.id === layer.id);
                                if (l) l.effects = l.effects.filter((x) => x.id !== fx.id);
                              });
                            }}
                          >
                            ×
                          </button>
                        </div>
                      </div>

                      {Object.entries(fx.params).map(([paramKey, prop]) => {
                        const v = prop.value;
                        if (typeof v === 'number') {
                          return (
                            <div key={paramKey} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                              <span style={{ fontSize: 10.5, color: 'var(--text-secondary)', textTransform: 'capitalize', width: 92 }}>
                                {paramKey}
                              </span>
                              <input
                                type="range"
                                min={-100}
                                max={200}
                                value={Math.round(v)}
                                style={{ flex: 1 }}
                                onChange={(e) => {
                                  const nv = Number(e.target.value);
                                  studio.commitProjectChange(
                                    `${fx.name}: ${paramKey}`,
                                    (draft) => {
                                      const l = draft.compositions.find((c) => c.id === draft.activeCompId)?.layers.find((x) => x.id === layer.id);
                                      const f = l?.effects.find((x) => x.id === fx.id);
                                      if (f && f.params[paramKey]) f.params[paramKey].value = nv;
                                    },
                                    `fx_${fx.id}_${paramKey}`,
                                  );
                                }}
                              />
                              <span className="mono" style={{ width: 34, textAlign: 'right', fontSize: 10.5 }}>
                                {Math.round(v)}
                              </span>
                            </div>
                          );
                        }
                        if (typeof v === 'string' && v.startsWith('#')) {
                          return (
                            <div key={paramKey} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <span style={{ fontSize: 10.5, color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{paramKey}</span>
                              <input
                                type="color"
                                value={v}
                                style={{ width: 42, height: 20, border: 'none', background: 'none' }}
                                onChange={(e) => {
                                  const col = e.target.value;
                                  studio.commitProjectChange(`${fx.name}: ${paramKey}`, (draft) => {
                                    const l = draft.compositions.find((c) => c.id === draft.activeCompId)?.layers.find((x) => x.id === fx.id ? false : x.id === layer.id);
                                    const f = l?.effects.find((x) => x.id === fx.id);
                                    if (f && f.params[paramKey]) f.params[paramKey].value = col;
                                  });
                                }}
                              />
                            </div>
                          );
                        }
                        return null;
                      })}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB 2: REAL-TIME LUMETRI VIDEO SCOPES (HISTOGRAM, LUMA WAVEFORM, VECTORSCOPE) */}
      {studio.rightTab === 'scopes' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', color: 'var(--accent-amber)' }}>
            Real-Time RGB Histogram &amp; Luma Waveform
          </div>
          {scopes && (
            <>
              {/* RGB Histogram SVG */}
              <svg
                viewBox="0 0 256 90"
                style={{ width: '100%', height: 95, background: '#090B10', borderRadius: 5, border: '1px solid var(--border-subtle)' }}
              >
                {(() => {
                  const maxVal = Math.max(1, ...scopes.histogramR, ...scopes.histogramG, ...scopes.histogramB);
                  const poly = (arr: Uint32Array) =>
                    Array.from(arr)
                      .map((v, i) => `${i},${88 - (v / maxVal) * 82}`)
                      .join(' ');
                  return (
                    <>
                      <polyline fill="none" stroke="#F87171" strokeWidth="1.2" points={poly(scopes.histogramR)} opacity={0.85} />
                      <polyline fill="none" stroke="#34D399" strokeWidth="1.2" points={poly(scopes.histogramG)} opacity={0.85} />
                      <polyline fill="none" stroke="#38BDF8" strokeWidth="1.2" points={poly(scopes.histogramB)} opacity={0.85} />
                    </>
                  );
                })()}
              </svg>

              {/* Luma IRE Waveform */}
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>IRE Luma &amp; RGB Parade Waveform (0 – 100 IRE)</div>
              <svg
                viewBox="0 0 64 64"
                preserveAspectRatio="none"
                style={{ width: '100%', height: 105, background: '#090B10', borderRadius: 5, border: '1px solid var(--border-subtle)' }}
              >
                <polyline
                  fill="none"
                  stroke="#38BDF8"
                  strokeWidth="1.2"
                  points={Array.from(scopes.waveformLuma)
                    .map((v, idx) => `${idx},${62 - v * 58}`)
                    .join(' ')}
                />
              </svg>

              {/* Broadcast Vectorscope with Skin-Tone I-Line */}
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Chroma Vectorscope (Cb / Cr + Skin-Tone Line)</div>
              <svg
                viewBox="0 0 64 64"
                style={{ width: 170, height: 170, alignSelf: 'center', background: '#090B10', borderRadius: '50%', border: '1px solid var(--border-strong)' }}
              >
                <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="0.4" />
                <line x1="32" y1="32" x2="18" y2="10" stroke="rgba(232,155,60,0.55)" strokeWidth="0.5" />
                {scopes.vectorscopePoints.map(([cb, cr, hex], idx) => (
                  <circle
                    key={idx}
                    cx={32 + cb * 26}
                    cy={32 - cr * 26}
                    r={0.85}
                    fill={hex}
                    opacity={0.75}
                  />
                ))}
              </svg>
            </>
          )}
        </div>
      )}

      {/* TAB 3: MOTION TRACKER, WARP STABILIZER, CONTENT-AWARE FILL & LOCAL AI ROTO */}
      {studio.rightTab === 'tracker' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ padding: 9, borderRadius: 5, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontWeight: 700, color: 'var(--accent-amber)' }}>1/2/4-Point NCC Motion Tracker</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              Tracks sub-pixel feature patches across frames and exports solved keyframes to a Null rig.
            </div>
            <button className="studio-btn primary" onClick={runMotionTrackerOnComp}>
              ▶ Analyze Forward &amp; Apply to Null
            </button>
          </div>

          <div style={{ padding: 9, borderRadius: 5, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontWeight: 700, color: 'var(--accent-cyan)' }}>Warp Stabilizer &amp; 3D Camera Solver</div>
            <div style={{ display: 'flex', gap: 5 }}>
              <button className="studio-btn" style={{ flex: 1 }} onClick={() => studio.applyEffectToSelectedLayer('warp-stabilizer')}>
                Stabilize Shot
              </button>
              <button className="studio-btn" style={{ flex: 1 }} onClick={() => studio.addLayerOfType('camera')}>
                Solve 3D Camera
              </button>
            </div>
          </div>

          <div style={{ padding: 9, borderRadius: 5, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontWeight: 700, color: 'var(--status-ok)' }}>Local AI Roto Brush &amp; Content-Aware Fill</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              100% offline subject segmentation &amp; spatial boundary clean-plate object removal.
            </div>
            <div style={{ display: 'flex', gap: 5 }}>
              <button className="studio-btn" style={{ flex: 1 }} onClick={() => studio.setActiveTool('roto-brush')}>
                Activate AI Roto
              </button>
              <button
                className="studio-btn"
                style={{ flex: 1 }}
                onClick={() => {
                  if (!studio.lastFrameResult) return;
                  synthesizeContentAwareFill(studio.lastFrameResult.pixels, studio.lastFrameResult.width, studio.lastFrameResult.height, {
                    x: studio.lastFrameResult.width * 0.4,
                    y: studio.lastFrameResult.height * 0.4,
                    width: 40,
                    height: 30,
                  });
                  studio.notify('Generated Content-Aware Fill clean plate');
                }}
              >
                Generate Fill Plate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: MULTI-LANGUAGE SCRIPTING (JS / PYTHON / LUA), PLUGIN SDK & GIT VERSIONING */}
      {studio.rightTab === 'scripting' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Audio Mixer VU Meter + Audio-to-Keyframes */}
          <div style={{ padding: 8, borderRadius: 5, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: 11 }}>Audio Stereo Bus VU</span>
              <span className="mono" style={{ fontSize: 10.5, color: 'var(--status-ok)' }}>
                RMS {audioVu.rmsDb.toFixed(1)} dB / Peak {audioVu.peakDb.toFixed(1)} dB
              </span>
            </div>
            <div style={{ height: 7, background: '#090B10', borderRadius: 4, overflow: 'hidden' }}>
              <div
                style={{
                  width: `${Math.max(5, Math.min(100, ((audioVu.peakDb + 60) / 66) * 100))}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #34D399, #FBBF24, #F87171)',
                }}
              />
            </div>
            <button
              className="studio-btn"
              onClick={() => {
                if (!comp) return;
                const synth = generateSynthAudioBuffer(comp.duration, 8000, 124);
                const ampProp = convertAudioSamplesToKeyframes(synth, 8000, 12, comp.duration);
                studio.commitProjectChange('Convert Audio Amplitude to Keyframes', (draft) => {
                  const c = draft.compositions.find((x) => x.id === draft.activeCompId);
                  if (!c) return;
                  c.layers.unshift({
                    id: createId('lyr'),
                    name: 'Audio Amplitude [Keyframes]',
                    type: 'null',
                    labelColor: '#4BB543',
                    visible: true,
                    audioEnabled: false,
                    solo: false,
                    locked: false,
                    shy: false,
                    collapseTransformations: false,
                    frameBlending: 'off',
                    motionBlur: false,
                    threeD: false,
                    inPoint: 0,
                    outPoint: c.duration,
                    startTime: 0,
                    stretchPct: 100,
                    blendMode: 'normal',
                    trackMatteMode: 'none',
                    transform: {
                      ...createDefaultTransform(0, 0, 0, 0),
                      opacity: { value: 100, animated: true, keyframes: ampProp.keyframes.slice(0, 48) },
                    },
                    masks: [],
                    effects: [],
                    paintStrokes: [],
                    puppetPins: [],
                    markers: [],
                  });
                });
                studio.notify('Created "Audio Amplitude [Keyframes]" layer from audio envelope');
              }}
            >
              Convert Audio to Keyframes
            </button>
          </div>

          {/* Multi-Language Automation Console */}
          <div style={{ padding: 8, borderRadius: 5, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: 11, color: 'var(--accent-amber)' }}>Studio Scripting (EXCEED-04)</span>
              <select
                className="studio-select"
                value={scriptLang}
                onChange={(e) => {
                  const l = e.target.value as ScriptLanguage;
                  setScriptLang(l);
                  setScriptCode(SAMPLE_AUTOMATION_SCRIPTS[l]);
                }}
              >
                <option value="javascript">JavaScript (ES2023)</option>
                <option value="python">Python Automation</option>
                <option value="lua">Lua Automation</option>
              </select>
            </div>
            <textarea
              rows={5}
              className="studio-input mono"
              style={{ fontSize: 10.5, lineHeight: 1.45 }}
              value={scriptCode}
              onChange={(e) => setScriptCode(e.target.value)}
            />
            <button
              className="studio-btn primary"
              onClick={() => {
                const res = executeStudioScript(scriptLang, scriptCode, studio.project);
                if (res.ok) {
                  studio.commitProjectChange(`Run ${scriptLang.toUpperCase()} Script`, (draft) => {
                    Object.assign(draft, res.nextProject);
                  });
                  setScriptLogs(res.logs.length ? res.logs : ['Script completed cleanly.']);
                } else {
                  setScriptLogs([`Error: ${res.error}`]);
                }
              }}
            >
              ▶ Execute {scriptLang.toUpperCase()} Script
            </button>
            {scriptLogs.length > 0 && (
              <div className="mono" style={{ padding: 6, background: '#090B10', borderRadius: 4, fontSize: 10, color: 'var(--accent-cyan)' }}>
                {scriptLogs.map((l, i) => <div key={i}>&gt; {l}</div>)}
              </div>
            )}
          </div>

          {/* Sandboxed Plugin SDK v1.0 */}
          <div style={{ padding: 8, borderRadius: 5, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontWeight: 700, fontSize: 11 }}>Sandboxed Plugin SDK v1.0 ({studioPluginRegistry.list().length})</span>
            {studioPluginRegistry.list().map((plg) => (
              <div key={plg.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5 }}>
                <span>{plg.name} <span className="mono" style={{ color: 'var(--text-muted)' }}>v{plg.version}</span></span>
                <span className="badge ok">Sandboxed</span>
              </div>
            ))}
            <textarea
              rows={2}
              className="studio-input mono"
              style={{ fontSize: 10 }}
              value={customPluginCode}
              onChange={(e) => setCustomPluginCode(e.target.value)}
            />
            <button
              className="studio-btn"
              onClick={() => {
                const r = studioPluginRegistry.installSandboxedBundle(customPluginCode);
                studio.notify(r.ok ? `Installed plugin "${r.plugin?.name}"` : `Plugin error: ${r.error}`);
              }}
            >
              + Load Sandboxed Plugin Bundle
            </button>
          </div>

          {/* Git-Style Project Version Commits (EXCEED-05) */}
          <div style={{ padding: 8, borderRadius: 5, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontWeight: 700, fontSize: 11, color: 'var(--accent-purple)' }}>
              Git Project Commits ({studio.project.versionCommits.length})
            </span>
            <div style={{ display: 'flex', gap: 4 }}>
              <input
                className="studio-input"
                style={{ flex: 1 }}
                value={gitCommitMsg}
                onChange={(e) => setGitCommitMsg(e.target.value)}
                placeholder="Commit message…"
              />
              <button className="studio-btn" onClick={() => studio.commitGitSnapshot(gitCommitMsg)}>
                Commit
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
