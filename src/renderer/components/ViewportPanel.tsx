import React, { useEffect, useRef, useState } from 'react';
import { useStudio } from '../state/StudioContext';
import { ViewportPresenter } from '../../engine/webglBackend';
import { evaluateProperty } from '../../engine/expressions';
import { buildDefaultLayerForComp, createId } from '../../engine/factory';
import { IconCameraSnap, IconRecordCapture } from './Icons';

const TOOL_HINTS: Record<string, string> = {
  selection: 'Drag to move selected layer · Shift constrains axis',
  hand: 'Drag anywhere to pan viewport stage',
  zoom: 'Click to zoom in · Alt+Click to zoom out',
  rotate: 'Drag around layer pivot to rotate Z angle',
  camera: 'Drag to orbit 3D Camera rig across stage',
  anchor: 'Drag to reposition Anchor Pivot (Pan-Behind)',
  'shape-rect': 'Click on stage to place a new Vector Shape layer',
  pen: 'Click on stage to add Bezier Mask vertices',
  text: 'Click on stage to place a new Typography layer',
  brush: 'Drag on stage to paint non-destructive strokes',
  clone: 'Drag on stage to clone-stamp pixels (+40px offset)',
  eraser: 'Drag on stage to erase alpha non-destructively',
  'roto-brush': 'Click foreground subject · Alt+Click background to refine AI matte',
  'puppet-pin': 'Click to place Puppet Pin · Drag existing pin to deform mesh',
};

export const ViewportPanel: React.FC = () => {
  const studio = useStudio();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const presenterRef = useRef<ViewportPresenter | null>(null);
  const [backendLabel, setBackendLabel] = useState<string>('WebGL2 GPU');
  const [paintColor, setPaintColor] = useState('#4cc3ff');
  const [paintRadius, setPaintRadius] = useState(16);

  const dragRef = useRef<{
    mode: 'move' | 'pan' | 'rotate' | 'camera' | 'anchor' | 'paint' | 'puppet-drag';
    layerId?: string;
    pinId?: string;
    strokeId?: string;
    startClientX: number;
    startClientY: number;
    origA: number;
    origB: number;
    origC?: number;
    origD?: number;
    points: Array<[number, number]>;
  } | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    presenterRef.current = new ViewportPresenter(canvasRef.current, studio.preferences.gpuAcceleration);
    setBackendLabel(presenterRef.current.backendName);
  }, [studio.preferences.gpuAcceleration]);

  useEffect(() => {
    const res = studio.lastFrameResult;
    if (!res || !presenterRef.current) return;
    presenterRef.current.present(
      res.pixels,
      res.width,
      res.height,
      studio.checkerboard,
      studio.snapshotFrame,
      studio.wipeSplit01,
    );
  }, [studio.lastFrameResult, studio.checkerboard, studio.snapshotFrame, studio.wipeSplit01]);

  const comp = studio.activeComp;
  const selLayer = studio.selectedLayer ?? comp?.layers[0];
  if (!comp) return null;

  const zoomScale = (studio.zoomPct / 100) * 0.56;
  const displayW = Math.max(120, Math.round(comp.width * zoomScale));
  const displayH = Math.max(80, Math.round(comp.height * zoomScale));

  const clientToCompCoords = (clientX: number, clientY: number): [number, number] => {
    if (!canvasRef.current) return [comp.width / 2, comp.height / 2];
    const rect = canvasRef.current.getBoundingClientRect();
    const nx = (clientX - rect.left) / Math.max(1, rect.width);
    const ny = (clientY - rect.top) / Math.max(1, rect.height);
    return [nx * comp.width, ny * comp.height];
  };

  // BUG-P0-02 Fix: All 14 tools handled cleanly (even when no layer is selected!)
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button === 1 || studio.activeTool === 'hand') {
      e.currentTarget.setPointerCapture(e.pointerId);
      dragRef.current = {
        mode: 'pan',
        startClientX: e.clientX,
        startClientY: e.clientY,
        origA: studio.viewportPan[0],
        origB: studio.viewportPan[1],
        points: [],
      };
      return;
    }

    const [cx, cy] = clientToCompCoords(e.clientX, e.clientY);

    if (studio.activeTool === 'zoom') {
      const factor = e.altKey ? 0.8 : 1.25;
      studio.setZoomPct(Math.max(25, Math.min(400, Math.round(studio.zoomPct * factor))));
      return;
    }

    if (studio.activeTool === 'shape-rect') {
      studio.addLayerOfType('shape', [cx, cy]);
      studio.setActiveTool('selection');
      return;
    }

    if (studio.activeTool === 'text') {
      studio.addLayerOfType('text', [cx, cy]);
      studio.setActiveTool('selection');
      studio.setRightTab('inspector');
      return;
    }

    if (studio.activeTool === 'camera') {
      let camLayer = comp.layers.find((l) => l.type === 'camera');
      const camId = camLayer ? camLayer.id : studio.addLayerOfType('camera');
      const origX = camLayer ? camLayer.transform.position.value[0] : comp.width / 2;
      const origY = camLayer ? camLayer.transform.position.value[1] : comp.height / 2;
      e.currentTarget.setPointerCapture(e.pointerId);
      dragRef.current = {
        mode: 'camera',
        layerId: camId,
        startClientX: e.clientX,
        startClientY: e.clientY,
        origA: origX,
        origB: origY,
        points: [],
      };
      return;
    }

    if (!selLayer || selLayer.locked) {
      if (studio.activeTool === 'pen' && !selLayer) {
        studio.addLayerOfType('shape', [cx, cy]);
      }
      return;
    }

    if (!studio.selectedLayerIds.includes(selLayer.id)) {
      studio.setSelectedLayerIds([selLayer.id]);
    }

    e.currentTarget.setPointerCapture(e.pointerId);

    if (studio.activeTool === 'brush' || studio.activeTool === 'clone' || studio.activeTool === 'eraser') {
      const strokeId = createId('stroke');
      const toolKind: 'brush' | 'clone' | 'eraser' =
        studio.activeTool === 'clone' ? 'clone' : studio.activeTool === 'eraser' ? 'eraser' : 'brush';
      const initPts: Array<[number, number]> = [[cx, cy]];
      dragRef.current = {
        mode: 'paint',
        layerId: selLayer.id,
        strokeId,
        startClientX: e.clientX,
        startClientY: e.clientY,
        origA: 0,
        origB: 0,
        points: initPts,
      };
      studio.commitProjectChange(
        `Paint ${toolKind} stroke`,
        (draft) => {
          const c = draft.compositions.find((x) => x.id === draft.activeCompId);
          const l = c?.layers.find((x) => x.id === selLayer.id);
          if (l) {
            l.paintStrokes.push({
              id: strokeId,
              tool: toolKind,
              color: paintColor,
              radius: paintRadius,
              hardness: 85,
              opacity: 100,
              startTime: 0,
              durationMode: 'constant',
              duration: comp.duration,
              cloneOffset: [40, 0],
              points: [[cx, cy]],
            });
          }
        },
        `stroke_${strokeId}`,
      );
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
      studio.notify(isBg ? 'Added AI Roto Background exclusion stroke' : 'Added AI Roto Foreground seed (Alt+Click for Background)');
      return;
    }

    if (studio.activeTool === 'puppet-pin') {
      const nearPin = selLayer.puppetPins.find((p) => Math.hypot(p.currentX - cx, p.currentY - cy) <= 28);
      if (nearPin) {
        dragRef.current = {
          mode: 'puppet-drag',
          layerId: selLayer.id,
          pinId: nearPin.id,
          startClientX: e.clientX,
          startClientY: e.clientY,
          origA: nearPin.currentX,
          origB: nearPin.currentY,
          points: [],
        };
      } else {
        studio.commitProjectChange('Place Puppet Deform Pin', (draft) => {
          const c = draft.compositions.find((x) => x.id === draft.activeCompId);
          const l = c?.layers.find((x) => x.id === selLayer.id);
          if (l) {
            l.puppetPins.push({
              id: createId('pin'),
              kind: 'position',
              restX: cx,
              restY: cy,
              currentX: cx,
              currentY: cy,
              stiffness: 50,
            });
          }
        });
        studio.notify('Placed Puppet Deform Pin — drag pin to deform mesh');
      }
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
            feather: 8,
            expansion: 0,
            opacity: 100,
            vertices: [
              { x: cx - 120, y: cy - 80, inX: 0, inY: 0, outX: 0, outY: 0 },
              { x: cx + 120, y: cy - 80, inX: 0, inY: 0, outX: 0, outY: 0 },
              { x: cx + 120, y: cy + 80, inX: 0, inY: 0, outX: 0, outY: 0 },
              { x: cx - 120, y: cy + 80, inX: 0, inY: 0, outX: 0, outY: 0 },
            ],
          });
        } else {
          l.masks[0].vertices.push({ x: cx, y: cy, inX: 0, inY: 0, outX: 0, outY: 0 });
        }
      });
      studio.notify('Updated Bezier Mask on selected layer');
      return;
    }

    const pos = evaluateProperty(selLayer.transform.position, studio.currentTime, selLayer, comp, studio.project).value;
    const evalRotZ = evaluateProperty(selLayer.transform.rotationZ, studio.currentTime, selLayer, comp, studio.project).value;
    if (studio.activeTool === 'rotate') {
      const startAngle = Math.atan2(cy - pos[1], cx - pos[0]);
      dragRef.current = {
        mode: 'rotate',
        layerId: selLayer.id,
        startClientX: e.clientX,
        startClientY: e.clientY,
        origA: evalRotZ,
        origB: startAngle,
        points: [],
      };
      return;
    }

    if (studio.activeTool === 'anchor') {
      dragRef.current = {
        mode: 'anchor',
        layerId: selLayer.id,
        startClientX: e.clientX,
        startClientY: e.clientY,
        origA: selLayer.transform.anchorPoint.value[0],
        origB: selLayer.transform.anchorPoint.value[1],
        origC: pos[0],
        origD: pos[1],
        points: [],
      };
      return;
    }

    dragRef.current = {
      mode: 'move',
      layerId: selLayer.id,
      startClientX: e.clientX,
      startClientY: e.clientY,
      origA: pos[0],
      origB: pos[1],
      points: [],
    };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const dr = dragRef.current;
    if (!dr) return;

    if (dr.mode === 'pan') {
      studio.setViewportPan([
        Math.round(dr.origA + (e.clientX - dr.startClientX)),
        Math.round(dr.origB + (e.clientY - dr.startClientY)),
      ]);
      return;
    }

    if (dr.mode === 'paint' && dr.layerId && dr.strokeId) {
      const pt = clientToCompCoords(e.clientX, e.clientY);
      const last = dr.points[dr.points.length - 1];
      if (!last || Math.hypot(pt[0] - last[0], pt[1] - last[1]) >= 1.5) {
        dr.points.push(pt);
        const ptsSnapshot = dr.points.slice();
        studio.commitProjectChange(
          'Paint Stroke',
          (draft) => {
            const c = draft.compositions.find((x) => x.id === draft.activeCompId);
            const l = c?.layers.find((x) => x.id === dr.layerId);
            const stk = l?.paintStrokes.find((s) => s.id === dr.strokeId);
            if (stk) stk.points = ptsSnapshot;
          },
          `stroke_${dr.strokeId}`,
        );
      }
      return;
    }

    const dx = (e.clientX - dr.startClientX) / Math.max(0.05, zoomScale);
    const dy = (e.clientY - dr.startClientY) / Math.max(0.05, zoomScale);

    if (dr.mode === 'move' && dr.layerId) {
      const cdx = e.shiftKey && Math.abs(dy) > Math.abs(dx) ? 0 : dx;
      const cdy = e.shiftKey && Math.abs(dx) >= Math.abs(dy) ? 0 : dy;
      const curT = Number(studio.currentTime.toFixed(3));
      studio.commitProjectChange(
        'Move Layer on Stage',
        (draft) => {
          const c = draft.compositions.find((x) => x.id === draft.activeCompId);
          const l = c?.layers.find((x) => x.id === dr.layerId);
          if (!l || l.locked) return;
          const nextPos: [number, number, number] = [
            Math.round(dr.origA + cdx),
            Math.round(dr.origB + cdy),
            l.transform.position.value[2],
          ];
          l.transform.position.value = nextPos;
          if (l.transform.position.animated && l.transform.position.keyframes.length > 0) {
            const nearKf = l.transform.position.keyframes.find((k) => Math.abs(k.time - curT) < 0.04);
            if (nearKf) {
              nearKf.value = [...nextPos];
            } else {
              l.transform.position.keyframes.push({
                id: createId('kf'),
                time: curT,
                value: [...nextPos],
                interpolation: 'bezier',
                inInfluence: 0.5,
                outInfluence: 0.5,
              });
              l.transform.position.keyframes.sort((a, b) => a.time - b.time);
            }
          }
        },
        `move_${dr.layerId}`,
      );
    } else if (dr.mode === 'rotate' && dr.layerId) {
      const [cx, cy] = clientToCompCoords(e.clientX, e.clientY);
      const curT = Number(studio.currentTime.toFixed(3));
      studio.commitProjectChange(
        'Rotate Layer on Stage',
        (draft) => {
          const c = draft.compositions.find((x) => x.id === draft.activeCompId);
          const l = c?.layers.find((x) => x.id === dr.layerId);
          if (!l || l.locked || !c) return;
          const evalP = evaluateProperty(l.transform.position, curT, l, c, draft).value;
          const curAngle = Math.atan2(cy - evalP[1], cx - evalP[0]);
          const degDelta = ((curAngle - dr.origB) * 180) / Math.PI;
          const nextRot = Number((dr.origA + degDelta).toFixed(1));
          l.transform.rotationZ.value = nextRot;
          if (l.transform.rotationZ.animated && l.transform.rotationZ.keyframes.length > 0) {
            const nearKf = l.transform.rotationZ.keyframes.find((k) => Math.abs(k.time - curT) < 0.04);
            if (nearKf) {
              nearKf.value = nextRot;
            } else {
              l.transform.rotationZ.keyframes.push({
                id: createId('kf'),
                time: curT,
                value: nextRot,
                interpolation: 'bezier',
                inInfluence: 0.5,
                outInfluence: 0.5,
              });
              l.transform.rotationZ.keyframes.sort((a, b) => a.time - b.time);
            }
          }
        },
        `rot_${dr.layerId}`,
      );
    } else if (dr.mode === 'anchor' && dr.layerId) {
      studio.commitProjectChange(
        'Pan-Behind Anchor Point',
        (draft) => {
          const c = draft.compositions.find((x) => x.id === draft.activeCompId);
          const l = c?.layers.find((x) => x.id === dr.layerId);
          if (!l || l.locked) return;
          l.transform.anchorPoint.value = [Math.round(dr.origA + dx), Math.round(dr.origB + dy), l.transform.anchorPoint.value[2]];
          l.transform.position.value = [Math.round((dr.origC ?? 0) + dx), Math.round((dr.origD ?? 0) + dy), l.transform.position.value[2]];
        },
        `anc_${dr.layerId}`,
      );
    } else if (dr.mode === 'camera' && dr.layerId) {
      studio.commitProjectChange(
        'Orbit 3D Camera',
        (draft) => {
          const c = draft.compositions.find((x) => x.id === draft.activeCompId);
          const l = c?.layers.find((x) => x.id === dr.layerId);
          if (!l) return;
          l.transform.position.value = [Math.round(dr.origA - dx * 1.2), Math.round(dr.origB - dy * 1.2), l.transform.position.value[2]];
        },
        `cam_${dr.layerId}`,
      );
    } else if (dr.mode === 'puppet-drag' && dr.layerId && dr.pinId) {
      studio.commitProjectChange(
        'Deform Puppet Pin',
        (draft) => {
          const c = draft.compositions.find((x) => x.id === draft.activeCompId);
          const l = c?.layers.find((x) => x.id === dr.layerId);
          const pin = l?.puppetPins.find((p) => p.id === dr.pinId);
          if (!pin) return;
          pin.currentX = Math.round(dr.origA + dx);
          pin.currentY = Math.round(dr.origB + dy);
        },
        `pin_${dr.pinId}`,
      );
    }
  };

  const onPointerUp = () => {
    dragRef.current = null;
  };

  // BUG-P1-04 Fix: Real frame rasterization from DisplayMedia stream into ProjectAsset.rgbaBuffer
  const captureDisplayFrameAsLayer = async () => {
    try {
      if (!navigator.mediaDevices?.getDisplayMedia) {
        studio.addLayerOfType('solid');
        return;
      }
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const video = document.createElement('video');
      video.srcObject = stream;
      video.muted = true;
      await video.play();
      const vw = Math.max(1, Math.min(3840, video.videoWidth || comp.width));
      const vh = Math.max(1, Math.min(2160, video.videoHeight || comp.height));
      const cnv = document.createElement('canvas');
      cnv.width = vw;
      cnv.height = vh;
      const ctx = cnv.getContext('2d');
      const rgba = ctx
        ? (() => {
            ctx.drawImage(video, 0, 0, vw, vh);
            return new Uint8ClampedArray(ctx.getImageData(0, 0, vw, vh).data);
          })()
        : undefined;
      stream.getTracks().forEach((tr) => tr.stop());

      const assetId = createId('ast');
      const layerId = createId('lyr');
      studio.commitProjectChange(`Screen Capture Plate (${vw}×${vh})`, (draft) => {
        draft.assets.push({
          id: assetId,
          name: `ScreenCapture_${vw}x${vh}.png`,
          folder: '03_Captures',
          kind: 'image',
          path: 'ScreenCapture.png',
          width: vw,
          height: vh,
          rgbaBuffer: rgba,
        });
        const c = draft.compositions.find((x) => x.id === draft.activeCompId);
        if (c) {
          const lyr = buildDefaultLayerForComp('footage', c, layerId);
          lyr.name = 'Screen Capture Plate';
          lyr.assetId = assetId;
          c.layers.unshift(lyr);
        }
      });
      studio.setSelectedLayerIds([layerId]);
      studio.notify(`Captured screen plate (${vw}×${vh}) into active composition`);
    } catch {
      studio.notify('Screen capture cancelled');
    }
  };

  const selPos = selLayer
    ? evaluateProperty(selLayer.transform.position, studio.currentTime, selLayer, comp, studio.project).value
    : [comp.width / 2, comp.height / 2, 0];

  const isPaintTool = studio.activeTool === 'brush' || studio.activeTool === 'clone' || studio.activeTool === 'eraser';
  const stageCursor =
    studio.activeTool === 'hand'
      ? 'grab'
      : studio.activeTool === 'zoom'
      ? 'zoom-in'
      : studio.activeTool === 'text'
      ? 'text'
      : 'crosshair';

  return (
    <section
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-canvas)',
        overflow: 'hidden',
        minWidth: 0,
      }}
    >
      {/* Top Viewport Control Strip */}
      <div className="panel-header" style={{ gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span style={{ fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {comp.name}
          </span>
          <span className="badge cyan mono">{backendLabel}</span>
          <span className="mono" style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
            {comp.width}×{comp.height}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <select
            className="studio-select"
            aria-label="Viewport Zoom"
            value={studio.zoomPct}
            onChange={(e) => studio.setZoomPct(Number(e.target.value))}
          >
            <option value={50}>50%</option>
            <option value={75}>75%</option>
            <option value={100}>Fit (100%)</option>
            <option value={150}>150%</option>
            <option value={200}>200%</option>
          </select>

          <select
            className="studio-select"
            aria-label="Preview Resolution"
            value={studio.resolutionDivisor}
            onChange={(e) => studio.setResolutionDivisor(Number(e.target.value) as 1 | 2 | 3 | 4)}
            title="Adaptive Preview Resolution"
          >
            <option value={1}>Full</option>
            <option value={2}>Half</option>
            <option value={4}>Quarter</option>
          </select>

          <select
            className="studio-select"
            aria-label="Channel View"
            value={studio.channelView}
            onChange={(e) => studio.setChannelView(e.target.value as typeof studio.channelView)}
          >
            <option value="rgb">RGB</option>
            <option value="red">Red</option>
            <option value="green">Green</option>
            <option value="blue">Blue</option>
            <option value="alpha">Alpha</option>
            <option value="alpha-boundary">Alpha Boundary</option>
          </select>

          <select
            className="studio-select"
            aria-label="AOV Pass"
            value={studio.aovView}
            onChange={(e) => studio.setAovView(e.target.value as typeof studio.aovView)}
          >
            <option value="beauty">Beauty</option>
            <option value="z-depth">Z-Depth</option>
            <option value="normals">Normals</option>
            <option value="object-id">Object ID</option>
            <option value="motion-vectors">Motion Vec</option>
          </select>

          <button
            className={`studio-btn ${studio.showSafeZones ? 'subtle-active' : ''}`}
            onClick={() => studio.setShowSafeZones(!studio.showSafeZones)}
            title="Toggle Action & Title Safe Guides"
          >
            Safe
          </button>
          <button
            className={`studio-btn ${studio.showGrid ? 'subtle-active' : ''}`}
            onClick={() => studio.setShowGrid(!studio.showGrid)}
            title="Toggle Proportional Grid"
          >
            Grid
          </button>
          <button
            className={`studio-btn ${studio.checkerboard ? 'subtle-active' : ''}`}
            onClick={() => studio.setCheckerboard(!studio.checkerboard)}
            title="Toggle Transparency Checkerboard"
          >
            Alpha
          </button>
          <button className="studio-btn" onClick={studio.takeSnapshot} title="Capture Snapshot for A/B Split-Wipe (F5)">
            <IconCameraSnap size={12} /> Snapshot
          </button>
          <button className="studio-btn" onClick={captureDisplayFrameAsLayer} title="Capture Live Screen Frame as Layer">
            <IconRecordCapture size={12} /> Capture
          </button>
        </div>
      </div>

      {/* Main Interactive Canvas Stage */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          position: 'relative',
          padding: 16,
        }}
      >
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          style={{
            position: 'relative',
            width: displayW,
            height: displayH,
            transform: `translate(${studio.viewportPan[0]}px, ${studio.viewportPan[1]}px)`,
            boxShadow: '0 14px 42px rgba(0,0,0,0.48), 0 0 0 1px var(--border-strong)',
            cursor: stageCursor,
            flexShrink: 0,
          }}
        >
          <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block', borderRadius: 2 }} />

          <svg
            width={displayW}
            height={displayH}
            viewBox={`0 0 ${comp.width} ${comp.height}`}
            style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
          >
            {studio.showGrid &&
              Array.from({ length: 11 }, (_, i) => (
                <React.Fragment key={i}>
                  <line
                    x1={(comp.width / 12) * (i + 1)}
                    y1={0}
                    x2={(comp.width / 12) * (i + 1)}
                    y2={comp.height}
                    stroke="rgba(255,255,255,0.14)"
                    strokeWidth={1.5}
                  />
                  <line
                    x1={0}
                    y1={(comp.height / 12) * (i + 1)}
                    x2={comp.width}
                    y2={(comp.height / 12) * (i + 1)}
                    stroke="rgba(255,255,255,0.14)"
                    strokeWidth={1.5}
                  />
                </React.Fragment>
              ))}

            {studio.showSafeZones && (
              <>
                <rect
                  x={comp.width * 0.05}
                  y={comp.height * 0.05}
                  width={comp.width * 0.9}
                  height={comp.height * 0.9}
                  fill="none"
                  stroke="rgba(76, 195, 255, 0.45)"
                  strokeWidth={2}
                  strokeDasharray="10 6"
                />
                <rect
                  x={comp.width * 0.1}
                  y={comp.height * 0.1}
                  width={comp.width * 0.8}
                  height={comp.height * 0.8}
                  fill="none"
                  stroke="rgba(245, 165, 36, 0.35)"
                  strokeWidth={2}
                  strokeDasharray="6 6"
                />
              </>
            )}

            {selLayer && selLayer.visible && (
              <g>
                <circle cx={selPos[0]} cy={selPos[1]} r={10} fill="none" stroke="#f5a524" strokeWidth={2.5} />
                <line x1={selPos[0] - 16} y1={selPos[1]} x2={selPos[0] + 16} y2={selPos[1]} stroke="#f5a524" strokeWidth={2} />
                <line x1={selPos[0]} y1={selPos[1] - 16} x2={selPos[0]} y2={selPos[1] + 16} stroke="#f5a524" strokeWidth={2} />
                {selLayer.masks.map((m) =>
                  m.vertices.length >= 2 ? (
                    <polygon
                      key={m.id}
                      points={m.vertices.map((v) => `${v.x},${v.y}`).join(' ')}
                      fill="none"
                      stroke="#3dd68c"
                      strokeWidth={3}
                    />
                  ) : null,
                )}
                {selLayer.puppetPins.map((pin, idx) => (
                  <g key={pin.id}>
                    <circle cx={pin.currentX} cy={pin.currentY} r={11} fill="#ffcc00" stroke="#090b0f" strokeWidth={3} />
                    <text x={pin.currentX + 14} y={pin.currentY + 5} fill="#ffcc00" fontSize={20} fontWeight={700}>
                      P{idx + 1}
                    </text>
                  </g>
                ))}
              </g>
            )}

            {studio.snapshotFrame && studio.wipeSplit01 > 0.005 && (
              <g>
                <line
                  x1={comp.width * studio.wipeSplit01}
                  y1={0}
                  x2={comp.width * studio.wipeSplit01}
                  y2={comp.height}
                  stroke="#f5a524"
                  strokeWidth={4}
                />
                <rect x={comp.width * studio.wipeSplit01 - 46} y={18} width={92} height={28} rx={6} fill="#0b0c0e" stroke="#f5a524" strokeWidth={2} />
                <text x={comp.width * studio.wipeSplit01} y={37} textAnchor="middle" fill="#f4f6fa" fontSize={18} fontWeight={700}>
                  SNAP | LIVE
                </text>
              </g>
            )}
          </svg>
        </div>
      </div>

      {/* Bottom Viewport Context Bar */}
      <div
        style={{
          height: 30,
          background: 'var(--bg-panel)',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 12px',
          gap: 12,
          fontSize: 11,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <span className="badge amber" style={{ textTransform: 'uppercase' }}>
            {studio.activeTool}
          </span>
          <span style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {TOOL_HINTS[studio.activeTool] ?? ''}
          </span>

          {isPaintTool && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginLeft: 6 }}>
              <span style={{ color: 'var(--text-muted)' }}>Size:</span>
              <input
                type="range"
                min={2}
                max={90}
                value={paintRadius}
                onChange={(e) => setPaintRadius(Number(e.target.value))}
                style={{ width: 68 }}
              />
              <span className="mono">{paintRadius}px</span>
              {studio.activeTool === 'brush' && (
                <input
                  type="color"
                  value={paintColor}
                  onChange={(e) => setPaintColor(e.target.value)}
                  style={{ width: 22, height: 18, border: 'none', background: 'transparent', cursor: 'pointer' }}
                />
              )}
            </div>
          )}

          {(studio.viewportPan[0] !== 0 || studio.viewportPan[1] !== 0) && (
            <button
              className="studio-btn ghost"
              style={{ minHeight: 20, padding: '0 6px', fontSize: 10.5 }}
              onClick={() => studio.setViewportPan([0, 0])}
            >
              Center Stage
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{ color: 'var(--text-muted)' }}>A/B Wipe:</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={studio.wipeSplit01}
            disabled={!studio.snapshotFrame}
            onChange={(e) => studio.setWipeSplit01(Number(e.target.value))}
            style={{ width: 96 }}
          />
          <span className="mono" style={{ color: 'var(--text-secondary)', minWidth: 32 }}>
            {studio.snapshotFrame ? `${Math.round(studio.wipeSplit01 * 100)}%` : 'Off'}
          </span>
        </div>
      </div>
    </section>
  );
};
