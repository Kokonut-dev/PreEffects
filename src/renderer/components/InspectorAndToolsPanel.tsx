import React, { useMemo, useState } from 'react';
import { useStudio } from '../state/StudioContext';
import { ALL_BLEND_MODES, Layer, MaskMode, ShapeOperator } from '../../engine/types';
import { evaluateProperty } from '../../engine/expressions';
import { computeVideoScopes } from '../../utils/color';
import { autoTraceAlphaToMask } from '../../engine/masksAndRoto';
import { synthesizeContentAwareFill, trackFeaturePatchNcc } from '../../engine/trackingAndPaint';
import { renderCompositionFrame, renderIsolatedLayerFrame } from '../../engine/compositor';
import { convertAudioSamplesToKeyframes } from '../../engine/animation';
import { measureAudioVuDb } from '../../engine/audio';
import { mixCompositionAudioSamples } from '../../engine/export';
import { EFFECTS_CATALOG } from '../../effects/registry';
import {
  executeStudioScript,
  SAMPLE_AUTOMATION_SCRIPTS,
  ScriptLanguage,
  studioPluginRegistry,
} from '../../plugins/sdk';
import { buildDefaultLayerForComp, createDefaultTransform, createId } from '../../engine/factory';
import { OKABE_ITO_SWATCHES } from '../../utils/qolHelpers';
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
  const [pluginRev, setPluginRev] = useState<number>(0);
  const [gitCommitMsg, setGitCommitMsg] = useState<string>('Hero Title Polish v2');
  const [dragFxIndex, setDragFxIndex] = useState<number | null>(null);

  const comp = studio.activeComp;
  const layer = studio.selectedLayer;

  const scopes = useMemo(() => {
    if (studio.rightTab !== 'scopes' || !studio.lastFrameResult) return null;
    return computeVideoScopes(studio.lastFrameResult.pixels, studio.lastFrameResult.width, studio.lastFrameResult.height, 4);
  }, [studio.rightTab, studio.lastFrameResult]);

  // BUG-R4-08 Fixed: Gate VU meter on visible scripting tab & measure real active audio layers + gain!
  const audioVu = useMemo(() => {
    if (studio.rightTab !== 'scripting' || !comp) {
      return { rmsDb: -60, peakDb: -60 };
    }
    const activeAudioLayers = comp.layers.filter(
      (l) => l.audioEnabled && studio.currentTime >= l.inPoint && studio.currentTime <= l.outPoint && (l.type === 'audio' || Boolean(l.assetId)),
    );
    if (activeAudioLayers.length === 0) {
      return { rmsDb: -60, peakDb: -60 };
    }
    const windowSec = 0.2;
    const startSec = Math.max(0, studio.currentTime - windowSec * 0.5);
    const mixed = mixCompositionAudioSamples(studio.project, comp, startSec, windowSec, 8000);
    return measureAudioVuDb(mixed, windowSec * 0.5, 8000);
  }, [studio.rightTab, comp, studio.project, studio.currentTime]);

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
    if (!comp) return;
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
        labelColor: '#3DD68C',
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

      {/* TAB 1: LAYER INSPECTOR, TEXT/SHAPE/SOLID/CAMERA/LIGHT/MASK & EFFECT CONTROLS */}
      {studio.rightTab === 'inspector' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {!layer || !comp ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
              Select a layer in the Timeline or click <strong>+ Add Layer</strong> in the toolbar to inspect properties.
            </div>
          ) : (
            <>
              {/* Identity, Okabe-Ito Label Swatches, Blend Mode & Track Matte */}
              <div className="inspector-card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                  <span className="layer-kind-pill">{layer.type.toUpperCase()}</span>
                  <input
                    aria-label="Selected Layer Name"
                    className="studio-input"
                    style={{ fontWeight: 600, flex: 1 }}
                    value={layer.name}
                    onChange={(e) => {
                      const val = e.target.value;
                      studio.commitProjectChange(
                        'Rename Layer',
                        (draft) => {
                          const c = draft.compositions.find((x) => x.id === draft.activeCompId);
                          const l = c?.layers.find((x) => x.id === layer.id);
                          if (l) l.name = val;
                        },
                        `rename_${layer.id}`,
                      );
                    }}
                  />
                </div>

                <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                  <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>Label:</span>
                  {OKABE_ITO_SWATCHES.map((hex) => (
                    <button
                      key={hex}
                      title={`Set Label ${hex}`}
                      onClick={() =>
                        studio.commitProjectChange('Set Label Color', (draft) => {
                          const l = draft.compositions
                            .find((c) => c.id === draft.activeCompId)
                            ?.layers.find((x) => x.id === layer.id);
                          if (l) l.labelColor = hex;
                        })
                      }
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: '50%',
                        background: hex,
                        border: layer.labelColor === hex ? '2px solid var(--text-primary)' : '1px solid rgba(0,0,0,0.25)',
                      }}
                    />
                  ))}
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
                        <option key={m} value={m}>
                          {m}
                        </option>
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
              <div className="inspector-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="section-eyebrow">Transform {layer.threeD ? '(3D XYZ)' : '(2D)'}</span>
                  <button
                    className={`studio-btn ${layer.threeD ? 'subtle-active' : ''}`}
                    style={{ minHeight: 22, padding: '1px 7px', fontSize: 10.5 }}
                    onClick={() => {
                      studio.commitProjectChange('Toggle 3D Layer Switch', (draft) => {
                        const c = draft.compositions.find((x) => x.id === draft.activeCompId);
                        const l = c?.layers.find((x) => x.id === layer.id);
                        if (l) l.threeD = !l.threeD;
                      });
                    }}
                  >
                    3D Space
                  </button>
                </div>

                {(['position', 'scale', 'anchorPoint'] as const).map((vecKey) => {
                  const val = evaluateProperty(layer.transform[vecKey], studio.currentTime, layer, comp, studio.project).value;
                  return (
                    <div key={vecKey} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                      <button
                        className="studio-btn ghost"
                        style={{ minHeight: 22, padding: '2px 4px' }}
                        title={`Toggle Keyframe on ${vecKey}`}
                        onClick={() => studio.toggleKeyframeOnTransform(vecKey)}
                      >
                        <IconDiamond active={layer.transform[vecKey].animated} />
                        <span style={{ textTransform: 'capitalize' }}>
                          {vecKey === 'anchorPoint' ? 'Anchor' : vecKey}
                        </span>
                      </button>
                      <div style={{ display: 'flex', gap: 4 }}>
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

                {layer.threeD && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)', paddingLeft: 6 }}>Rot X / Y</span>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <ScrubNumberInput
                        suffix="°"
                        value={evaluateProperty(layer.transform.rotationX, studio.currentTime, layer, comp, studio.project).value}
                        onChange={(nv) => updateTransformScalar('rotationX', nv)}
                      />
                      <ScrubNumberInput
                        suffix="°"
                        value={evaluateProperty(layer.transform.rotationY, studio.currentTime, layer, comp, studio.project).value}
                        onChange={(nv) => updateTransformScalar('rotationY', nv)}
                      />
                    </div>
                  </div>
                )}

                {(['rotationZ', 'opacity'] as const).map((scKey) => {
                  const val = evaluateProperty(layer.transform[scKey], studio.currentTime, layer, comp, studio.project).value;
                  return (
                    <div key={scKey} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                      <button
                        className="studio-btn ghost"
                        style={{ minHeight: 22, padding: '2px 4px' }}
                        onClick={() => studio.toggleKeyframeOnTransform(scKey)}
                      >
                        <IconDiamond active={layer.transform[scKey].animated} />
                        <span>{scKey === 'rotationZ' ? 'Rotation Z' : 'Opacity'}</span>
                      </button>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <input
                          type="range"
                          min={scKey === 'opacity' ? 0 : -180}
                          max={scKey === 'opacity' ? 100 : 180}
                          value={Math.round(val)}
                          onChange={(e) => updateTransformScalar(scKey, Number(e.target.value))}
                          style={{ width: 78 }}
                        />
                        <ScrubNumberInput
                          min={scKey === 'opacity' ? 0 : undefined}
                          max={scKey === 'opacity' ? 100 : undefined}
                          suffix={scKey === 'opacity' ? '%' : '°'}
                          value={val}
                          onChange={(nv) => updateTransformScalar(scKey, nv)}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* BUG-P2-03 Fix: Contextual Solid Matte Color Editor */}
              {(layer.type === 'solid' || layer.type === 'guide') && (
                <div className="inspector-card">
                  <span className="section-eyebrow">Solid Fill Color</span>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Matte Swatch</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className="mono" style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
                        {layer.solidColor ?? '#263042'}
                      </span>
                      <input
                        type="color"
                        value={layer.solidColor ?? '#263042'}
                        onChange={(e) => {
                          const col = e.target.value;
                          studio.commitProjectChange('Change Solid Color', (draft) => {
                            const l = draft.compositions.find((c) => c.id === draft.activeCompId)?.layers.find((x) => x.id === layer.id);
                            if (l) l.solidColor = col;
                          });
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* BUG-P2-03 Fix: Contextual 3D Camera Optics & DoF Editor */}
              {layer.type === 'camera' && layer.cameraSettings && (
                <div className="inspector-card">
                  <span className="section-eyebrow">3D Camera Optics &amp; Depth of Field</span>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Focal Length</span>
                    <ScrubNumberInput
                      min={12}
                      max={200}
                      suffix="mm"
                      value={layer.cameraSettings.focalLengthMm}
                      onChange={(v) =>
                        studio.commitProjectChange('Set Camera Focal Length', (draft) => {
                          const l = draft.compositions.find((c) => c.id === draft.activeCompId)?.layers.find((x) => x.id === layer.id);
                          if (l?.cameraSettings) l.cameraSettings.focalLengthMm = v;
                        })
                      }
                    />
                  </div>
                  <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Depth of Field Blur</span>
                    <input
                      type="checkbox"
                      checked={layer.cameraSettings.depthOfField}
                      onChange={(e) =>
                        studio.commitProjectChange('Toggle Camera DoF', (draft) => {
                          const l = draft.compositions.find((c) => c.id === draft.activeCompId)?.layers.find((x) => x.id === layer.id);
                          if (l?.cameraSettings) l.cameraSettings.depthOfField = e.target.checked;
                        })
                      }
                    />
                  </label>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Focus Distance</span>
                    <ScrubNumberInput
                      min={50}
                      max={5000}
                      suffix="px"
                      value={layer.cameraSettings.focusDistance}
                      onChange={(v) =>
                        studio.commitProjectChange('Set Camera Focus Distance', (draft) => {
                          const l = draft.compositions.find((c) => c.id === draft.activeCompId)?.layers.find((x) => x.id === layer.id);
                          if (l?.cameraSettings) l.cameraSettings.focusDistance = v;
                        })
                      }
                    />
                  </div>
                </div>
              )}

              {/* BUG-P2-03 Fix: Contextual 3D Light Editor */}
              {layer.type === 'light' && layer.lightSettings && (
                <div className="inspector-card">
                  <span className="section-eyebrow">3D Light Rig</span>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Light Type</span>
                    <select
                      className="studio-select"
                      value={layer.lightSettings.lightType}
                      onChange={(e) =>
                        studio.commitProjectChange('Set Light Type', (draft) => {
                          const l = draft.compositions.find((c) => c.id === draft.activeCompId)?.layers.find((x) => x.id === layer.id);
                          if (l?.lightSettings) l.lightSettings.lightType = e.target.value as typeof l.lightSettings.lightType;
                        })
                      }
                    >
                      <option value="point">Point Light</option>
                      <option value="spot">Spot Light</option>
                      <option value="parallel">Parallel Directional</option>
                      <option value="ambient">Ambient Fill</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Intensity</span>
                    <ScrubNumberInput
                      min={0}
                      max={400}
                      suffix="%"
                      value={layer.lightSettings.intensity}
                      onChange={(v) =>
                        studio.commitProjectChange('Set Light Intensity', (draft) => {
                          const l = draft.compositions.find((c) => c.id === draft.activeCompId)?.layers.find((x) => x.id === layer.id);
                          if (l?.lightSettings) l.lightSettings.intensity = v;
                        })
                      }
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Tint Color</span>
                    <input
                      type="color"
                      value={layer.lightSettings.color}
                      onChange={(e) =>
                        studio.commitProjectChange('Set Light Color', (draft) => {
                          const l = draft.compositions.find((c) => c.id === draft.activeCompId)?.layers.find((x) => x.id === layer.id);
                          if (l?.lightSettings) l.lightSettings.color = e.target.value;
                        })
                      }
                    />
                  </div>
                </div>
              )}

              {/* Typography & Per-Character Text Animator Section */}
              {layer.type === 'text' && layer.textData && (
                <div className="inspector-card">
                  <span className="section-eyebrow">Typography &amp; Text Animators</span>
                  <textarea
                    rows={2}
                    className="studio-input"
                    value={layer.textData.text}
                    onChange={(e) => {
                      const txt = e.target.value;
                      studio.commitProjectChange(
                        'Edit Text Content',
                        (draft) => {
                          const l = draft.compositions.find((c) => c.id === draft.activeCompId)?.layers.find((x) => x.id === layer.id);
                          if (l?.textData) l.textData.text = txt;
                        },
                        `txt_${layer.id}`,
                      );
                    }}
                  />
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'space-between' }}>
                    <ScrubNumberInput
                      min={8}
                      max={400}
                      suffix="px"
                      value={layer.textData.fontSize}
                      onChange={(sz) =>
                        studio.commitProjectChange('Font Size', (draft) => {
                          const l = draft.compositions.find((c) => c.id === draft.activeCompId)?.layers.find((x) => x.id === layer.id);
                          if (l?.textData) l.textData.fontSize = sz;
                        })
                      }
                    />
                    <ScrubNumberInput
                      min={-50}
                      max={200}
                      suffix="trk"
                      value={layer.textData.tracking}
                      onChange={(tr) =>
                        studio.commitProjectChange('Text Tracking', (draft) => {
                          const l = draft.compositions.find((c) => c.id === draft.activeCompId)?.layers.find((x) => x.id === layer.id);
                          if (l?.textData) l.textData.tracking = tr;
                        })
                      }
                    />
                    <input
                      type="color"
                      value={layer.textData.fillColor}
                      onChange={(e) => {
                        const col = e.target.value;
                        studio.commitProjectChange('Text Fill Color', (draft) => {
                          const l = draft.compositions.find((c) => c.id === draft.activeCompId)?.layers.find((x) => x.id === layer.id);
                          if (l?.textData) l.textData.fillColor = col;
                        });
                      }}
                    />
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
                          scaleOffset: [0, 0],
                          rotationOffset: 6,
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

              {/* Vector Shape Layer & Non-Destructive Operators */}
              {layer.type === 'shape' && layer.shapeContent && (
                <div className="inspector-card">
                  <span className="section-eyebrow">
                    Vector Shape &amp; Operators ({layer.shapeContent.operators.length})
                  </span>
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
                            params:
                              opType === 'trim-paths'
                                ? { start: 0, end: 75, offset: 0 }
                                : opType === 'repeater'
                                ? { copies: 5, rotation: 28 }
                                : { amount: 16, size: 10 },
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

              {/* Interactive Masks, Auto-Trace Alpha & Nulls from Path (BUG-P2-03 Fixed) */}
              <div className="inspector-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="section-eyebrow">Masks ({layer.masks.length})</span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      className="studio-btn"
                      style={{ minHeight: 22, padding: '1px 6px', fontSize: 10.5 }}
                      onClick={() => {
                        if (!comp) return;
                        const isolated = renderIsolatedLayerFrame(
                          comp,
                          layer.id,
                          studio.currentTime,
                          studio.project,
                          studio.resolutionDivisor,
                        );
                        const mask = autoTraceAlphaToMask(
                          isolated.pixels,
                          isolated.width,
                          isolated.height,
                          32,
                          studio.resolutionDivisor,
                        );
                        studio.commitProjectChange('Auto-Trace Alpha to Bezier Mask', (draft) => {
                          const l = draft.compositions.find((c) => c.id === draft.activeCompId)?.layers.find((x) => x.id === layer.id);
                          l?.masks.push(mask);
                        });
                        studio.notify('Auto-Traced isolated layer alpha into editable Bezier Mask');
                      }}
                    >
                      Auto-Trace
                    </button>
                    {layer.masks.length > 0 && (
                      <button
                        className="studio-btn"
                        style={{ minHeight: 22, padding: '1px 6px', fontSize: 10.5 }}
                        onClick={studio.createNullsFromSelectedMask}
                      >
                        Nulls from Path
                      </button>
                    )}
                  </div>
                </div>
                {layer.masks.map((m) => (
                  <div
                    key={m.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 5,
                      padding: '4px 6px',
                      borderRadius: 5,
                      background: 'var(--bg-inset)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <select
                      className="studio-select"
                      style={{ minHeight: 22, fontSize: 10.5 }}
                      value={m.mode}
                      onChange={(e) =>
                        studio.commitProjectChange('Set Mask Mode', (draft) => {
                          const mask = draft.compositions
                            .find((c) => c.id === draft.activeCompId)
                            ?.layers.find((x) => x.id === layer.id)
                            ?.masks.find((x) => x.id === m.id);
                          if (mask) mask.mode = e.target.value as MaskMode;
                        })
                      }
                    >
                      <option value="add">Add</option>
                      <option value="subtract">Subtract</option>
                      <option value="intersect">Intersect</option>
                      <option value="difference">Difference</option>
                    </select>
                    <ScrubNumberInput
                      min={0}
                      max={200}
                      suffix="px"
                      value={m.feather}
                      onChange={(fv) =>
                        studio.commitProjectChange('Set Mask Feather', (draft) => {
                          const mask = draft.compositions
                            .find((c) => c.id === draft.activeCompId)
                            ?.layers.find((x) => x.id === layer.id)
                            ?.masks.find((x) => x.id === m.id);
                          if (mask) mask.feather = fv;
                        })
                      }
                    />
                    <label style={{ fontSize: 10, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                      <input
                        type="checkbox"
                        checked={m.inverted}
                        onChange={(e) =>
                          studio.commitProjectChange('Invert Mask', (draft) => {
                            const mask = draft.compositions
                              .find((c) => c.id === draft.activeCompId)
                              ?.layers.find((x) => x.id === layer.id)
                              ?.masks.find((x) => x.id === m.id);
                            if (mask) mask.inverted = e.target.checked;
                          })
                        }
                      />
                      Inv
                    </label>
                    <button
                      className="studio-btn ghost"
                      style={{ minHeight: 20, padding: '0 5px', color: 'var(--status-err)' }}
                      onClick={() =>
                        studio.commitProjectChange('Delete Mask', (draft) => {
                          const l = draft.compositions.find((c) => c.id === draft.activeCompId)?.layers.find((x) => x.id === layer.id);
                          if (l) l.masks = l.masks.filter((x) => x.id !== m.id);
                        })
                      }
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>

              {/* Effect Controls Stack + Per-Effect Performance Profiler (BUG-P2-04 Fixed) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="section-eyebrow">Effect Controls &amp; Profiler ({layer.effects.length})</span>
                  <button className="studio-btn" style={{ minHeight: 22, padding: '1px 7px', fontSize: 10.5 }} onClick={() => studio.setLeftTab('effects')}>
                    + Browse 186
                  </button>
                </div>

                {layer.effects.map((fx, fxIdx) => {
                  const timing = studio.lastFrameResult?.effectTimings.find((tm) => tm.effectInstanceId === fx.id);
                  const def = EFFECTS_CATALOG.find((d) => d.id === fx.effectId);
                  const isSelFx = studio.selectedEffectId === fx.id;
                  return (
                    <div
                      key={fx.id}
                      draggable
                      onClick={() => studio.setSelectedEffectId(fx.id)}
                      onDragStart={(e) => {
                        setDragFxIndex(fxIdx);
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (dragFxIndex !== null && dragFxIndex !== fxIdx) {
                          studio.reorderEffectOnLayer(layer.id, dragFxIndex, fxIdx);
                        }
                        setDragFxIndex(null);
                      }}
                      onDragEnd={() => setDragFxIndex(null)}
                      className="inspector-card"
                      style={{
                        gap: 6,
                        borderColor: isSelFx ? 'var(--accent-amber)' : undefined,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, cursor: 'grab' }}>
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                          {timing && (
                            <span className="badge ok mono">
                              {timing.durationMs.toFixed(2)}ms
                            </span>
                          )}
                          <button
                            className="studio-btn ghost"
                            style={{ minHeight: 20, padding: '0 4px', fontSize: 10 }}
                            disabled={fxIdx === 0}
                            title="Move Effect Up in Stack"
                            onClick={(e) => {
                              e.stopPropagation();
                              studio.reorderEffectOnLayer(layer.id, fxIdx, fxIdx - 1);
                            }}
                          >
                            ↑
                          </button>
                          <button
                            className="studio-btn ghost"
                            style={{ minHeight: 20, padding: '0 4px', fontSize: 10 }}
                            disabled={fxIdx === layer.effects.length - 1}
                            title="Move Effect Down in Stack"
                            onClick={(e) => {
                              e.stopPropagation();
                              studio.reorderEffectOnLayer(layer.id, fxIdx, fxIdx + 1);
                            }}
                          >
                            ↓
                          </button>
                          <button
                            className="studio-btn ghost"
                            style={{ minHeight: 20, padding: '0 5px', color: 'var(--status-err)' }}
                            title="Remove Effect"
                            onClick={(e) => {
                              e.stopPropagation();
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
                        const pMeta = def?.params.find((pm) => pm.key === paramKey);
                        const minB = pMeta?.min ?? -200;
                        const maxB = pMeta?.max ?? 300;
                        const stepB = pMeta?.step ?? 0.5;
                        if (typeof v === 'number') {
                          return (
                            <div key={paramKey} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                              <span style={{ fontSize: 10.5, color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                                {pMeta?.label ?? paramKey}
                              </span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                <input
                                  type="range"
                                  min={minB}
                                  max={maxB}
                                  step={stepB}
                                  value={Math.max(minB, Math.min(maxB, v))}
                                  style={{ width: 72 }}
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
                                <ScrubNumberInput
                                  value={v}
                                  step={stepB}
                                  onChange={(nv) =>
                                    studio.commitProjectChange(
                                      `${fx.name}: ${paramKey}`,
                                      (draft) => {
                                        const l = draft.compositions.find((c) => c.id === draft.activeCompId)?.layers.find((x) => x.id === layer.id);
                                        const f = l?.effects.find((x) => x.id === fx.id);
                                        if (f && f.params[paramKey]) f.params[paramKey].value = nv;
                                      },
                                      `fx_${fx.id}_${paramKey}`,
                                    )
                                  }
                                />
                              </div>
                            </div>
                          );
                        }
                        if (typeof v === 'boolean') {
                          return (
                            <label key={paramKey} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 10.5, color: 'var(--text-secondary)' }}>
                              <span style={{ textTransform: 'capitalize' }}>{pMeta?.label ?? paramKey}</span>
                              <input
                                type="checkbox"
                                checked={v}
                                onChange={(e) => {
                                  const bv = e.target.checked;
                                  studio.commitProjectChange(`${fx.name}: ${paramKey}`, (draft) => {
                                    const l = draft.compositions.find((c) => c.id === draft.activeCompId)?.layers.find((x) => x.id === layer.id);
                                    const f = l?.effects.find((x) => x.id === fx.id);
                                    if (f && f.params[paramKey]) f.params[paramKey].value = bv;
                                  });
                                }}
                              />
                            </label>
                          );
                        }
                        if (typeof v === 'string' && v.startsWith('#')) {
                          return (
                            <div key={paramKey} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <span style={{ fontSize: 10.5, color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                                {pMeta?.label ?? paramKey}
                              </span>
                              <input
                                type="color"
                                value={v}
                                style={{ width: 42, height: 20, border: 'none', background: 'none' }}
                                onChange={(e) => {
                                  const col = e.target.value;
                                  studio.commitProjectChange(`${fx.name}: ${paramKey}`, (draft) => {
                                    const l = draft.compositions.find((c) => c.id === draft.activeCompId)?.layers.find((x) => x.id === layer.id);
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

      {/* TAB 2: REAL-TIME LUMETRI VIDEO SCOPES (Theme-adaptive via --bg-inset!) */}
      {studio.rightTab === 'scopes' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {scopes && (
            <>
              <div className="inspector-card">
                <span className="section-eyebrow">RGB Parade Histogram (0–255)</span>
                <svg
                  viewBox="0 0 256 90"
                  style={{ width: '100%', height: 90, background: 'var(--bg-inset)', borderRadius: 5, border: '1px solid var(--border-subtle)' }}
                >
                  {(() => {
                    const maxVal = Math.max(1, ...scopes.histogramR, ...scopes.histogramG, ...scopes.histogramB);
                    const poly = (arr: Uint32Array) =>
                      Array.from(arr)
                        .map((v, i) => `${i},${88 - (v / maxVal) * 82}`)
                        .join(' ');
                    return (
                      <>
                        <polyline fill="none" stroke="#F87171" strokeWidth="1.3" points={poly(scopes.histogramR)} opacity={0.9} />
                        <polyline fill="none" stroke="#34D399" strokeWidth="1.3" points={poly(scopes.histogramG)} opacity={0.9} />
                        <polyline fill="none" stroke="#38BDF8" strokeWidth="1.3" points={poly(scopes.histogramB)} opacity={0.9} />
                      </>
                    );
                  })()}
                </svg>
              </div>

              <div className="inspector-card">
                <span className="section-eyebrow">IRE Luma Waveform (0–100 IRE)</span>
                <svg
                  viewBox="0 0 64 64"
                  preserveAspectRatio="none"
                  style={{ width: '100%', height: 96, background: 'var(--bg-inset)', borderRadius: 5, border: '1px solid var(--border-subtle)' }}
                >
                  <polyline
                    fill="none"
                    stroke="var(--accent-cyan)"
                    strokeWidth="1.3"
                    points={Array.from(scopes.waveformLuma)
                      .map((v, idx) => `${idx},${62 - v * 58}`)
                      .join(' ')}
                  />
                </svg>
              </div>

              <div className="inspector-card" style={{ alignItems: 'center' }}>
                <span className="section-eyebrow" style={{ alignSelf: 'flex-start' }}>
                  Chroma Vectorscope (Skin-Tone I-Line)
                </span>
                <svg
                  viewBox="0 0 64 64"
                  style={{ width: 168, height: 168, background: 'var(--bg-inset)', borderRadius: '50%', border: '1px solid var(--border-strong)' }}
                >
                  <circle cx="32" cy="32" r="28" fill="none" stroke="var(--grid-line)" strokeWidth="0.5" />
                  <line x1="32" y1="32" x2="18" y2="10" stroke="var(--accent-amber)" strokeWidth="0.6" opacity={0.75} />
                  {scopes.vectorscopePoints.map(([cb, cr, hex], idx) => (
                    <circle key={idx} cx={32 + cb * 26} cy={32 - cr * 26} r={0.85} fill={hex} opacity={0.8} />
                  ))}
                </svg>
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB 3: MOTION TRACKING, WARP STABILIZER, LOCAL AI ROTO & CONTENT-AWARE FILL */}
      {studio.rightTab === 'tracker' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="inspector-card">
            <span className="section-eyebrow">2D Feature Motion Tracker (NCC)</span>
            <p style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              Sub-pixel Normalized Cross-Correlation feature tracker solved locally to a Null rig layer.
            </p>
            <button className="studio-btn primary" onClick={runMotionTrackerOnComp}>
              Track Motion &amp; Bake Null Rig
            </button>
          </div>

          <div className="inspector-card">
            <span className="section-eyebrow">Warp Stabilizer VFX</span>
            <p style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              Applies inverse camera-shake smoothing to the selected layer.
            </p>
            <button
              className="studio-btn"
              onClick={() => studio.applyEffectToSelectedLayer('warp-stabilizer-vfx')}
            >
              Stabilize Selected Layer
            </button>
          </div>

          <div className="inspector-card">
            <span className="section-eyebrow">Local AI Roto &amp; Content-Aware Fill</span>
            <p style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              100% local foreground matting and Poisson boundary clean-plate generation — zero cloud uploads.
            </p>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="studio-btn" style={{ flex: 1 }} onClick={() => studio.setActiveTool('roto-brush')}>
                AI Roto Tool
              </button>
              <button
                className="studio-btn primary"
                style={{ flex: 1 }}
                onClick={() => {
                  if (!studio.lastFrameResult || !comp) return;
                  const r = studio.lastFrameResult;
                  const cleanPlate = synthesizeContentAwareFill(r.pixels, r.width, r.height, {
                    x: Math.round(r.width * 0.35),
                    y: Math.round(r.height * 0.35),
                    width: Math.max(8, Math.round(r.width * 0.3)),
                    height: Math.max(8, Math.round(r.height * 0.3)),
                  });
                  // BUG-P1-03 Fix: Persist synthesized cleanPlate as ProjectAsset + Footage Layer!
                  const assetId = createId('ast');
                  const layerId = createId('lyr');
                  studio.commitProjectChange('Generate Content-Aware Fill Clean Plate', (draft) => {
                    draft.assets.push({
                      id: assetId,
                      name: `CleanPlate_${comp.name}.png`,
                      folder: '04_CleanPlates',
                      kind: 'image',
                      path: `CleanPlate_${comp.name}.png`,
                      width: r.width,
                      height: r.height,
                      rgbaBuffer: cleanPlate,
                    });
                    const c = draft.compositions.find((x) => x.id === draft.activeCompId);
                    if (c) {
                      const lyr = buildDefaultLayerForComp('footage', c, layerId);
                      lyr.name = `Clean Plate (${comp.name})`;
                      lyr.assetId = assetId;
                      c.layers.unshift(lyr);
                    }
                  });
                  studio.setSelectedLayerIds([layerId]);
                  studio.notify(`Generated Clean Plate layer (${r.width}×${r.height}) locally`);
                }}
              >
                Generate Fill Plate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: AUDIO VU, MULTI-LANGUAGE SCRIPTING, PLUGIN SDK & GIT VERSIONING */}
      {studio.rightTab === 'scripting' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="inspector-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="section-eyebrow">Audio Stereo Bus VU</span>
              <span className="mono" style={{ fontSize: 10.5, color: 'var(--status-ok)' }}>
                RMS {audioVu.rmsDb.toFixed(1)} dB · Peak {audioVu.peakDb.toFixed(1)} dB
              </span>
            </div>
            <div style={{ height: 7, background: 'var(--bg-inset)', border: '1px solid var(--border-subtle)', borderRadius: 4, overflow: 'hidden' }}>
              <div
                style={{
                  width: `${Math.max(5, Math.min(100, ((audioVu.peakDb + 60) / 66) * 100))}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, var(--status-ok), var(--accent-amber), var(--status-err))',
                }}
              />
            </div>
            <button
              className="studio-btn"
              onClick={() => {
                if (!comp) return;
                const mixed = mixCompositionAudioSamples(studio.project, comp, 0, comp.duration, 8000);
                const ampProp = convertAudioSamplesToKeyframes(mixed, 8000, 12, comp.duration);
                studio.commitProjectChange('Convert Audio Amplitude to Keyframes', (draft) => {
                  const c = draft.compositions.find((x) => x.id === draft.activeCompId);
                  if (!c) return;
                  c.layers.unshift({
                    id: createId('lyr'),
                    name: 'Audio Amplitude [Keyframes]',
                    type: 'null',
                    labelColor: '#3DD68C',
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

          <div className="inspector-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="section-eyebrow">Automation Console</span>
              <select
                className="studio-select"
                value={scriptLang}
                onChange={(e) => {
                  const lang = e.target.value as ScriptLanguage;
                  setScriptLang(lang);
                  setScriptCode(SAMPLE_AUTOMATION_SCRIPTS[lang]);
                }}
              >
                <option value="javascript">JavaScript (ES2023)</option>
                <option value="python">Python Dialect</option>
                <option value="lua">Lua Dialect</option>
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
              <div className="mono" style={{ padding: 6, background: 'var(--bg-inset)', border: '1px solid var(--border-subtle)', borderRadius: 4, fontSize: 10, color: 'var(--accent-cyan)' }}>
                {scriptLogs.map((l, i) => (
                  <div key={i}>&gt; {l}</div>
                ))}
              </div>
            )}
          </div>

          {/* BUG-P2-05 Fix: pluginRev triggers live re-render when installing bundles */}
          <div className="inspector-card" data-plugin-rev={pluginRev}>
            <span className="section-eyebrow">Sandboxed Plugin SDK v1.0 ({studioPluginRegistry.list().length})</span>
            {studioPluginRegistry.list().map((plg) => (
              <div key={plg.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5 }}>
                <span>
                  {plg.name} <span className="mono" style={{ color: 'var(--text-muted)' }}>v{plg.version}</span>
                </span>
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
                setPluginRev((v) => v + 1);
                studio.notify(r.ok ? `Installed plugin "${r.plugin?.name}"` : `Plugin error: ${r.error}`);
              }}
            >
              + Load Sandboxed Plugin Bundle
            </button>
          </div>

          <div className="inspector-card">
            <span className="section-eyebrow">Git Project Commits ({studio.project.versionCommits.length})</span>
            <div style={{ display: 'flex', gap: 5 }}>
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
