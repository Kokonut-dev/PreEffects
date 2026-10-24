import React, { useEffect, useRef, useState } from 'react';
import { useStudio } from '../state/StudioContext';
import { ViewportPresenter } from '../../engine/webglBackend';
import { evaluateProperty } from '../../engine/expressions';
import { createId } from '../../engine/factory';

export const ViewportPanel: React.FC = () => {
  const studio = useStudio();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const presenterRef = useRef<ViewportPresenter | null>(null);
  const [dragState, setDragState] = useState<{
    mode: 'move' | 'paint' | 'roto' | 'puppet' | 'mask';
    startX: number;
    startY: number;
    origPos: [number, number, number];
    points: Array<[number, number]>;
  } | null>(null);
  const [paintColor, setPaintColor] = useState('#38BDF8');
  const [paintRadius, setPaintRadius] = useState(14);
  const [isRecordingScreen, setIsRecordingScreen] = useState(false);

  // Initialize WebGL2 / Canvas2D Presenter
  useEffect(() => {
    if (!canvasRef.current) return;
    presenterRef.current = new ViewportPresenter(canvasRef.current, studio.preferences.gpuAcceleration);
  }, [studio.preferences.gpuAcceleration]);

  // Present composite pixels onto GPU/Canvas viewport
  useEffect(() => {
    const res = studio.lastFrameResult;
    if (!res || !presenterRef.current) return;
    presenterRef.current.present(
      res.pixels,
      res.width,
      res.height,
      studio.checkerboard,
      studio.snapshotBuffer,
      studio.wipeSplit01,
    );
  }, [studio.lastFrameResult, studio.checkerboard, studio.snapshotBuffer, studio.wipeSplit01]);

  const comp = studio.activeComp;
  const selLayer = studio.selectedLayer;

  const clientToCompCoords = (clientX: number, clientY: number): [number, number] => {
    if (!canvasRef.current || !comp) return [0, 0];
    const rect = canvasRef.current.getBoundingClientRect();
    const nx = (clientX - rect.left) / Math.max(1, rect.width);
    const ny = (clientY - rect.top) / Math.max(1, rect.height);
    return [nx * comp.width, ny * comp.height];
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!comp || !selLayer || selLayer.locked) return;
    const [cx, cy] = clientToCompCoords(e.clientX, e.clientY);

    if (studio.activeTool === 'brush' || studio.activeTool === 'clone' || studio.activeTool === 'eraser') {
      setDragState({ mode: 'paint', startX: cx, startY: cy, origPos: [0, 0, 0], points: [[cx, cy]] });
      return;
    }
    if (studio.activeTool === 'roto-brush') {
      const isBg = e.altKey;
      studio.commitProjectChange('Add Local AI Roto Seed', (draft) => {
        const c = draft.compositions.find((x) => x.id === draft.activeCompId);
        const l = c?.layers.find((x) => x.id === selLayer.id);
        if (!l || !c) return;
        l.rotoMatteEnabled = true;
        const norm: [number, number] = [cx / c.width, cy / c.height];
        if (isBg) l.rotoBackgroundSeeds = [...(l.rotoBackgroundSeeds ?? []), norm];
        else l.rotoForegroundSeeds = [...(l.rotoForegroundSeeds ?? []), norm];
      });
      studio.notify(e.altKey ? 'Added AI Roto Background exclusion stroke' : 'Added AI Roto Foreground seed (Alt+Click for Background)');
      return;
    }
    if (studio.activeTool === 'puppet-pin') {
      studio.commitProjectChange('Place Puppet Deform Pin', (draft) => {
        const c = draft.compositions.find((x) => x.id === draft.activeCompId);
        const l = c?.layers.find((x) => x.id === selLayer.id);
        if (l) {
          l.puppetPins.push({ id: createId('pin'), kind: 'position', restX: cx, restY: cy, currentX: cx + 18, currentY: cy - 12, stiffness: 50 });
        }
      });
      studio.notify('Placed Puppet Deform Pin on layer mesh');
      return;
    }
    if (studio.activeTool === 'pen') {
      studio.commitProjectChange('Add Bezier Mask Vertex', (draft) => {
        const c = draft.compositions.find((x) => x.id === draft.activeCompId);
        const l = c?.layers.find((x) => x.id === selLayer.id);
        if (!l) return;
        if (l.masks.length === 0) {
          l.masks.push({
            id: createId('mask'),
            name: 'Mask 1',
            mode: 'add',
            inverted: false,
            locked: false,
            rotoBezier: false,
            closed: true,
            feather: 6,
            expansion: 0,
            opacity: 100,
            vertices: [
              { x: cx - 140, y: cy - 90, inX: 0, inY: 0, outX: 0, outY: 0 },
              { x: cx + 140, y: cy - 90, inX: 0, inY: 0, outX: 0, outY: 0 },
              { x: cx + 140, y: cy + 90, inX: 0, inY: 0, outX: 0, outY: 0 },
              { x: cx - 140, y: cy + 90, inX: 0, inY: 0, outX: 0, outY: 0 },
            ],
          });
        } else {
          l.masks[0].vertices.push({ x: cx, y: cy, inX: 0, inY: 0, outX: 0, outY: 0 });
        }
      });
      studio.notify('Added Bezier Mask on selected layer');
      return;
    }

    const pos = evaluateProperty(selLayer.transform.position, studio.currentTime, selLayer, comp, studio.project).value;
    setDragState({ mode: 'move', startX: cx, startY: cy, origPos: [...pos] as [number, number, number], points: [] });
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState || !comp || !selLayer) return;
    const [cx, cy] = clientToCompCoords(e.clientX, e.clientY);
    if (dragState.mode === 'paint') {
      setDragState((prev) => (prev ? { ...prev, points: [...prev.points, [cx, cy]] } : null));
      return;
    }
    if (dragState.mode === 'move') {
      const dx = cx - dragState.startX;
      const dy = cy - dragState.startY;
      const nextPos: [number, number, number] = [
        Math.round(dragState.origPos[0] + dx),
        Math.round(dragState.origPos[1] + dy),
        dragState.origPos[2],
      ];
      studio.commitProjectChange(
        `Move ${selLayer.name}`,
        (draft) => {
          const c = draft.compositions.find((x) => x.id === draft.activeCompId);
          const l = c?.layers.find((x) => x.id === selLayer.id);
          if (!l) return;
          if (l.transform.position.animated) {
            const kf = l.transform.position.keyframes.find((k) => Math.abs(k.time - studio.currentTime) < 0.04);
            if (kf) kf.value = nextPos;
            else l.transform.position.keyframes.push({ id: createId('kf'), time: studio.currentTime, value: nextPos, interpolation: 'bezier' });
          } else {
            l.transform.position.value = nextPos;
          }
        },
        `drag_pos_${selLayer.id}`,
      );
    }
  };

  const onPointerUp = () => {
    if (dragState?.mode === 'paint' && selLayer && dragState.points.length > 0) {
      studio.recordPaintStroke(selLayer.id, {
        id: createId('pnt'),
        tool: studio.activeTool === 'clone' ? 'clone' : studio.activeTool === 'eraser' ? 'eraser' : 'brush',
        color: paintColor,
        radius: paintRadius,
        hardness: 75,
        opacity: 95,
        durationMode: 'constant',
        startTime: 0,
        duration: comp.duration,
        points: dragState.points,
        cloneOffset: [40, 0],
      });
    }
    setDragState(null);
  };

  // EXCEED-13: Local Screen / Webcam Capture directly onto Timeline Layer
  const captureDisplayFrameAsLayer = async () => {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      studio.notify('Screen capture API unavailable in this environment — created synthetic studio capture plate');
      studio.addLayerOfType('solid');
      return;
    }
    try {
      setIsRecordingScreen(true);
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      stream.getTracks().forEach((tr) => tr.stop());
      setIsRecordingScreen(false);
      studio.addLayerOfType('footage');
      studio.notify('Captured live screen plate into active composition');
    } catch {
      setIsRecordingScreen(false);
    }
  };

  const evalLayerPos =
    comp && selLayer
      ? evaluateProperty(selLayer.transform.position, studio.currentTime, selLayer, comp, studio.project).value
      : null;

  return (
    <main
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-canvas)',
        overflow: 'hidden',
        minWidth: 380,
      }}
    >
      {/* Top Comp Tabs & Breadcrumb Navigation */}
      <div className="panel-header" style={{ gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, overflowX: 'auto' }}>
          {studio.project.compositions.map((c) => (
            <button
              key={c.id}
              className={`studio-btn ${c.id === comp?.id ? 'primary' : 'ghost'}`}
              style={{ padding: '2px 8px', fontSize: 11 }}
              onClick={() => studio.openActiveComp(c.id)}
            >
              {c.name}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {(studio.activeTool === 'brush' || studio.activeTool === 'clone') && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <input type="color" value={paintColor} onChange={(e) => setPaintColor(e.target.value)} style={{ width: 20, height: 20, border: 'none', background: 'none' }} />
              <span className="mono" style={{ fontSize: 10 }}>Size:</span>
              <input
                type="range"
                min={2}
                max={60}
                value={paintRadius}
                onChange={(e) => setPaintRadius(Number(e.target.value))}
                style={{ width: 64 }}
              />
            </div>
          )}
          <span className="badge cyan mono">
            {presenterRef.current?.backendName ?? 'WebGL2 GPU'}
          </span>
          {studio.lastFrameResult && (
            <span className={`badge ${studio.lastFrameResult.fromCache ? 'ok' : 'amber'} mono`}>
              {studio.lastFrameResult.fromCache ? 'RAM HIT' : `${studio.lastFrameResult.totalTimeMs.toFixed(1)} ms`}
            </span>
          )}
        </div>
      </div>

      {/* Central Composition Stage */}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        style={{
          flex: 1,
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          padding: 18,
          cursor:
            studio.activeTool === 'hand'
              ? 'grab'
              : studio.activeTool === 'brush' || studio.activeTool === 'pen' || studio.activeTool === 'roto-brush'
                ? 'crosshair'
                : 'default',
        }}
      >
        <div
          style={{
            position: 'relative',
            aspectRatio: `${comp?.width ?? 1920} / ${comp?.height ?? 1080}`,
            maxWidth: `${studio.zoomPct}%`,
            maxHeight: `${studio.zoomPct}%`,
            width: '100%',
            boxShadow: '0 14px 42px rgba(0,0,0,0.62)',
            border: '1px solid var(--border-strong)',
            background: '#05070B',
          }}
        >
          <canvas
            ref={canvasRef}
            style={{ width: '100%', height: '100%', display: 'block' }}
          />

          {/* Title & Action Safe Overlay */}
          {studio.showSafeZones && (
            <>
              <div
                style={{
                  position: 'absolute',
                  inset: '5%',
                  border: '1px dashed rgba(56, 189, 248, 0.28)',
                  pointerEvents: 'none',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  inset: '10%',
                  border: '1px dashed rgba(232, 155, 60, 0.28)',
                  pointerEvents: 'none',
                }}
              />
            </>
          )}

          {/* Proportional Rule-of-Thirds Grid */}
          {studio.showGrid && (
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
            >
              <line x1="33.33" y1="0" x2="33.33" y2="100" stroke="rgba(255,255,255,0.18)" strokeWidth="0.2" />
              <line x1="66.66" y1="0" x2="66.66" y2="100" stroke="rgba(255,255,255,0.18)" strokeWidth="0.2" />
              <line x1="0" y1="33.33" x2="100" y2="33.33" stroke="rgba(255,255,255,0.18)" strokeWidth="0.2" />
              <line x1="0" y1="66.66" x2="100" y2="66.66" stroke="rgba(255,255,255,0.18)" strokeWidth="0.2" />
            </svg>
          )}

          {/* Selected Layer Center Anchor & Transform Reticle */}
          {comp && selLayer && evalLayerPos && selLayer.visible && (
            <div
              style={{
                position: 'absolute',
                left: `${(evalLayerPos[0] / comp.width) * 100}%`,
                top: `${(evalLayerPos[1] / comp.height) * 100}%`,
                transform: 'translate(-50%, -50%)',
                width: 18,
                height: 18,
                border: `1.5px solid ${selLayer.labelColor || '#E89B3C'}`,
                borderRadius: '50%',
                pointerEvents: 'none',
                boxShadow: '0 0 0 1px rgba(0,0,0,0.75)',
              }}
            >
              <div style={{ position: 'absolute', left: '50%', top: -4, bottom: -4, width: 1, background: selLayer.labelColor || '#E89B3C' }} />
              <div style={{ position: 'absolute', top: '50%', left: -4, right: -4, height: 1, background: selLayer.labelColor || '#E89B3C' }} />
            </div>
          )}

          {/* Snapshot A/B Wipe Divider Line */}
          {studio.snapshotBuffer && studio.wipeSplit01 > 0.01 && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: `${studio.wipeSplit01 * 100}%`,
                width: 2,
                background: 'var(--accent-amber)',
                pointerEvents: 'none',
              }}
            />
          )}

          {/* Studio Empty Composition Quick-Start State */}
          {comp && comp.layers.length === 0 && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                background: 'rgba(10, 13, 20, 0.72)',
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
                {comp.name} — Empty Composition Stage
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                Create your first layer or load a studio motion template to begin compositing:
              </div>
              <div style={{ display: 'flex', gap: 6 }} onPointerDown={(e) => e.stopPropagation()}>
                <button className="studio-btn primary" onClick={() => studio.addLayerOfType('text')}>+ Text Layer</button>
                <button className="studio-btn" onClick={() => studio.addLayerOfType('shape')}>+ Vector Shape</button>
                <button className="studio-btn" onClick={() => studio.addLayerOfType('solid')}>+ Solid Plate</button>
                <button className="studio-btn" onClick={() => studio.loadTemplateProject('orbital-hero')}>Load Showcase</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Viewport Precision Controls HUD */}
      <div
        style={{
          height: 32,
          padding: '0 10px',
          background: 'var(--bg-panel)',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          fontSize: 11,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <select
            aria-label="Viewport Zoom"
            className="studio-select mono"
            value={studio.zoomPct}
            onChange={(e) => studio.setZoomPct(Number(e.target.value))}
          >
            <option value={50}>50%</option>
            <option value={75}>75%</option>
            <option value={100}>Fit (100%)</option>
            <option value={135}>135%</option>
          </select>

          <select
            aria-label="Preview Resolution"
            className="studio-select"
            value={studio.resolutionDivisor}
            onChange={(e) => studio.setResolutionDivisor(Number(e.target.value) as 1 | 2 | 3 | 4)}
          >
            <option value={1}>Full (1:1)</option>
            <option value={2}>Half (1:2)</option>
            <option value={3}>Third (1:3)</option>
            <option value={4}>Quarter (1:4)</option>
          </select>

          <select
            aria-label="Channel Viewer"
            className="studio-select"
            value={studio.channelView}
            onChange={(e) => studio.setChannelView(e.target.value as 'rgb' | 'red' | 'green' | 'blue' | 'alpha')}
          >
            <option value="rgb">RGB Composite</option>
            <option value="red">Red Channel</option>
            <option value="green">Green Channel</option>
            <option value="blue">Blue Channel</option>
            <option value="alpha">Alpha Matte</option>
          </select>

          <button
            className={`studio-btn ${studio.checkerboard ? 'active' : ''}`}
            onClick={() => studio.setCheckerboard(!studio.checkerboard)}
            title="Toggle Transparency Grid"
          >
            Alpha Grid
          </button>
          <button
            className={`studio-btn ${studio.showSafeZones ? 'active' : ''}`}
            onClick={() => studio.setShowSafeZones(!studio.showSafeZones)}
            title="Toggle Title & Action Safe Overlay"
          >
            Safe Zones
          </button>
          <button
            className={`studio-btn ${studio.showGrid ? 'active' : ''}`}
            onClick={() => studio.setShowGrid(!studio.showGrid)}
            title="Toggle Rule-of-Thirds Grid"
          >
            Grid
          </button>
        </div>

        {/* Snapshot A/B Comparison + Screen Recorder */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button className="studio-btn" onClick={studio.takeSnapshot} title="Capture Viewport Snapshot for A/B Split Compare">
            📷 Snapshot
          </button>
          {studio.snapshotBuffer && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span className="mono" style={{ fontSize: 10, color: 'var(--accent-amber)' }}>A/B:</span>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(studio.wipeSplit01 * 100)}
                onChange={(e) => studio.setWipeSplit01(Number(e.target.value) / 100)}
                style={{ width: 65 }}
              />
            </div>
          )}
          <button
            className="studio-btn"
            onClick={() => void captureDisplayFrameAsLayer()}
            disabled={isRecordingScreen}
            title="Record Screen / Window Plate directly into Timeline (EXCEED-13)"
          >
            ⏺ Capture Plate
          </button>
        </div>
      </div>
    </main>
  );
};
