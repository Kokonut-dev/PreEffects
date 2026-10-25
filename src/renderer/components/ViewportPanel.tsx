import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useStudio } from '../state/StudioContext';
import { ViewportPresenter } from '../../engine/webglBackend';
import { evaluateProperty } from '../../engine/expressions';
import { computeLayerWorldMatrix } from '../../engine/threeD';
import { buildDefaultLayerForComp, createId } from '../../engine/factory';
import { Mat4 } from '../../utils/math';
import { IconCameraSnap, IconRecordCapture } from './Icons';

const TOOL_HINTS: Record<string, string> = {
  selection: 'Drag layer, 8 scale handles (Shift = uniform), rotation stem, or mask vertices · Wheel zooms to cursor',
  hand: 'Drag anywhere to pan viewport stage · Alt+0 resets to Fit',
  zoom: 'Click to zoom in · Alt+Click to zoom out · Mouse wheel zooms around cursor',
  rotate: 'Drag around layer pivot to rotate Z angle',
  camera: 'Drag to orbit 3D Camera rig across stage',
  anchor: 'Drag to reposition Anchor Pivot in world space without shifting pixels (Pan-Behind)',
  'shape-rect': 'Click on stage to place a new Vector Shape layer',
  pen: 'Click to add Bezier Mask vertices · Drag existing vertex to sculpt mask',
  text: 'Click on stage to place a new Typography layer',
  brush: 'Drag on stage to paint non-destructive strokes',
  clone: 'Drag on stage to clone-stamp pixels (+40px offset)',
  eraser: 'Drag on stage to erase alpha non-destructively',
  'roto-brush': 'Click foreground subject · Alt+Click background to refine AI matte',
  'puppet-pin': 'Click to place Puppet Pin · Drag existing pin to deform mesh',
};

type ScaleHandleId = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

export const ViewportPanel: React.FC = () => {
  const studio = useStudio();
  const stageOuterRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const presenterRef = useRef<ViewportPresenter | null>(null);
  const didInitialFitRef = useRef<boolean>(false);
  const [backendLabel, setBackendLabel] = useState<string>('WebGL2 GPU');
  const [paintColor, setPaintColor] = useState('#4cc3ff');
  const [paintRadius, setPaintRadius] = useState(16);

  const dragRef = useRef<{
    mode:
      | 'move'
      | 'pan'
      | 'rotate'
      | 'scale-handle'
      | 'mask-vertex'
      | 'camera'
      | 'anchor'
      | 'paint'
      | 'puppet-drag';
    layerId?: string;
    pinId?: string;
    strokeId?: string;
    maskId?: string;
    vertexIdx?: number;
    handleId?: ScaleHandleId;
    startClientX: number;
    startClientY: number;
    origA: number;
    origB: number;
    origC?: number;
    origD?: number;
    origRotDeg?: number;
    origScaleX?: number;
    origScaleY?: number;
    halfW?: number;
    halfH?: number;
    points: Array<[number, number]>;
  } | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    presenterRef.current = new ViewportPresenter(canvasRef.current, studio.preferences.gpuAcceleration);
    setBackendLabel(presenterRef.current.backendName);
  }, [studio.preferences.gpuAcceleration]);

  // QOL-R4-06: Track actual viewport stage dimensions via ResizeObserver for exact mathematical Fit zoom
  useEffect(() => {
    const el = stageOuterRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const obs = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect || rect.width < 40 || rect.height < 40) return;
      const w = Math.round(rect.width);
      const h = Math.round(rect.height);
      studio.setViewportStageSize([w, h]);
      if (!didInitialFitRef.current && studio.activeComp) {
        didInitialFitRef.current = true;
        const scale = Math.min((w - 52) / Math.max(1, studio.activeComp.width), (h - 52) / Math.max(1, studio.activeComp.height));
        studio.setZoomPct(Math.max(15, Math.min(200, Math.floor(scale * 100))));
      }
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [studio]);

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

  const zoomScale = studio.zoomPct / 100;
  const displayW = comp ? Math.max(80, Math.round(comp.width * zoomScale)) : 640;
  const displayH = comp ? Math.max(60, Math.round(comp.height * zoomScale)) : 360;

  // Compute selected layer world-space gizmo geometry (8 scale handles, rotation lollipop, anchor reticle)
  const gizmo = useMemo(() => {
    if (!comp || !selLayer || !selLayer.visible || selLayer.type === 'audio' || selLayer.type === 'camera') {
      return null;
    }
    const worldMat = computeLayerWorldMatrix(selLayer, comp, studio.currentTime, studio.project);
    const anchor = evaluateProperty(selLayer.transform.anchorPoint, studio.currentTime, selLayer, comp, studio.project).value;
    let lx0 = 0;
    let ly0 = 0;
    let lx1 = comp.width;
    let ly1 = comp.height;
    if (selLayer.type === 'shape' && selLayer.shapeContent) {
      const sw = Math.max(40, selLayer.shapeContent.width);
      const sh = Math.max(40, selLayer.shapeContent.height);
      lx0 = comp.width * 0.5 - sw * 0.5;
      ly0 = comp.height * 0.5 - sh * 0.5;
      lx1 = comp.width * 0.5 + sw * 0.5;
      ly1 = comp.height * 0.5 + sh * 0.5;
    } else if (selLayer.type === 'text' && selLayer.textData) {
      const approxW = Math.max(120, Math.min(comp.width * 0.9, selLayer.textData.text.length * selLayer.textData.fontSize * 0.62));
      const approxH = Math.max(48, selLayer.textData.fontSize * 1.45);
      lx0 = comp.width * 0.5 - approxW * 0.5;
      ly0 = comp.height * 0.5 - approxH * 0.5;
      lx1 = comp.width * 0.5 + approxW * 0.5;
      ly1 = comp.height * 0.5 + approxH * 0.5;
    } else if (selLayer.type === 'null') {
      lx0 = comp.width * 0.5 - 50;
      ly0 = comp.height * 0.5 - 50;
      lx1 = comp.width * 0.5 + 50;
      ly1 = comp.height * 0.5 + 50;
    }

    const lcx = (lx0 + lx1) * 0.5;
    const lcy = (ly0 + ly1) * 0.5;
    const pt = (x: number, y: number): [number, number] => {
      const [wx, wy] = Mat4.transformPoint(worldMat, x, y, 0);
      return [wx, wy];
    };
    const nw = pt(lx0, ly0);
    const n = pt(lcx, ly0);
    const ne = pt(lx1, ly0);
    const e = pt(lx1, lcy);
    const se = pt(lx1, ly1);
    const s = pt(lcx, ly1);
    const sw = pt(lx0, ly1);
    const w = pt(lx0, lcy);
    const pivot = pt(anchor[0], anchor[1]);

    // Outward normal above 'n' for rotation lollipop stem
    const upDx = n[0] - s[0];
    const upDy = n[1] - s[1];
    const upLen = Math.max(1e-4, Math.hypot(upDx, upDy));
    const stemDist = 28 / Math.max(0.2, zoomScale);
    const rotHandle: [number, number] = [n[0] + (upDx / upLen) * stemDist, n[1] + (upDy / upLen) * stemDist];

    const handles: Array<{ id: ScaleHandleId; pos: [number, number] }> = [
      { id: 'nw', pos: nw },
      { id: 'n', pos: n },
      { id: 'ne', pos: ne },
      { id: 'e', pos: e },
      { id: 'se', pos: se },
      { id: 's', pos: s },
      { id: 'sw', pos: sw },
      { id: 'w', pos: w },
    ];

    return {
      corners: [nw, ne, se, sw],
      handles,
      topMid: n,
      rotHandle,
      pivot,
      halfW: Math.max(20, (lx1 - lx0) * 0.5),
      halfH: Math.max(20, (ly1 - ly0) * 0.5),
    };
  }, [comp, selLayer, studio.currentTime, studio.project, zoomScale]);

  if (!comp) return null;

  const clientToCompCoords = (clientX: number, clientY: number): [number, number] => {
    if (!canvasRef.current) return [comp.width / 2, comp.height / 2];
    const rect = canvasRef.current.getBoundingClientRect();
    const nx = (clientX - rect.left) / Math.max(1, rect.width);
    const ny = (clientY - rect.top) / Math.max(1, rect.height);
    return [nx * comp.width, ny * comp.height];
  };

  // QOL-R4-06: Smooth mouse-wheel zoom anchored around cursor position
  const onStageWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const outer = stageOuterRef.current;
    if (!outer) return;
    const rect = outer.getBoundingClientRect();
    const cursorOffX = e.clientX - (rect.left + rect.width * 0.5);
    const cursorOffY = e.clientY - (rect.top + rect.height * 0.5);
    const curZoom = studio.zoomPct;
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    const nextZoom = Math.max(12, Math.min(400, Math.round(curZoom * factor)));
    if (nextZoom === curZoom) return;
    const ratio = nextZoom / curZoom;
    const nextPanX = Math.round(cursorOffX - (cursorOffX - studio.viewportPan[0]) * ratio);
    const nextPanY = Math.round(cursorOffY - (cursorOffY - studio.viewportPan[1]) * ratio);
    studio.setZoomPct(nextZoom);
    studio.setViewportPan([nextPanX, nextPanY]);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button === 1 || studio.activeTool === 'hand' || (e.altKey && studio.activeTool === 'selection')) {
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
      studio.setZoomPct(Math.max(12, Math.min(400, Math.round(studio.zoomPct * factor))));
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
      const camLayer = comp.layers.find((l) => l.type === 'camera');
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

    const hitRadiusComp = 13 / Math.max(0.15, zoomScale);

    // QOL-R4-01: Hit-test Bezier Mask vertices first when in Selection or Pen tool
    if (studio.activeTool === 'selection' || studio.activeTool === 'pen') {
      for (const mask of selLayer.masks) {
        if (mask.locked) continue;
        const vIdx = mask.vertices.findIndex((v) => Math.hypot(v.x - cx, v.y - cy) <= hitRadiusComp);
        if (vIdx >= 0) {
          dragRef.current = {
            mode: 'mask-vertex',
            layerId: selLayer.id,
            maskId: mask.id,
            vertexIdx: vIdx,
            startClientX: e.clientX,
            startClientY: e.clientY,
            origA: mask.vertices[vIdx].x,
            origB: mask.vertices[vIdx].y,
            points: [],
          };
          return;
        }
      }
    }

    const pos = evaluateProperty(selLayer.transform.position, studio.currentTime, selLayer, comp, studio.project).value;
    const evalScale = evaluateProperty(selLayer.transform.scale, studio.currentTime, selLayer, comp, studio.project).value;
    const evalRotZ = evaluateProperty(selLayer.transform.rotationZ, studio.currentTime, selLayer, comp, studio.project).value;
    const evalAnchor = evaluateProperty(selLayer.transform.anchorPoint, studio.currentTime, selLayer, comp, studio.project).value;

    // QOL-R4-01: Hit-test Rotation Lollipop & 8 Scale Handles when in Selection tool
    if (studio.activeTool === 'selection' && gizmo) {
      if (Math.hypot(gizmo.rotHandle[0] - cx, gizmo.rotHandle[1] - cy) <= hitRadiusComp * 1.15) {
        const startAngle = Math.atan2(cy - gizmo.pivot[1], cx - gizmo.pivot[0]);
        dragRef.current = {
          mode: 'rotate',
          layerId: selLayer.id,
          startClientX: e.clientX,
          startClientY: e.clientY,
          origA: evalRotZ,
          origB: startAngle,
          origC: gizmo.pivot[0],
          origD: gizmo.pivot[1],
          points: [],
        };
        return;
      }

      const hitHandle = gizmo.handles.find((h) => Math.hypot(h.pos[0] - cx, h.pos[1] - cy) <= hitRadiusComp);
      if (hitHandle) {
        dragRef.current = {
          mode: 'scale-handle',
          layerId: selLayer.id,
          handleId: hitHandle.id,
          startClientX: e.clientX,
          startClientY: e.clientY,
          origA: evalScale[0],
          origB: evalScale[1],
          origRotDeg: evalRotZ,
          halfW: gizmo.halfW,
          halfH: gizmo.halfH,
          points: [],
        };
        return;
      }
    }

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
      studio.notify('Added Bezier Mask vertex — drag any emerald handle to sculpt');
      return;
    }

    if (studio.activeTool === 'rotate') {
      const pivX = gizmo ? gizmo.pivot[0] : pos[0];
      const pivY = gizmo ? gizmo.pivot[1] : pos[1];
      const startAngle = Math.atan2(cy - pivY, cx - pivX);
      dragRef.current = {
        mode: 'rotate',
        layerId: selLayer.id,
        startClientX: e.clientX,
        startClientY: e.clientY,
        origA: evalRotZ,
        origB: startAngle,
        origC: pivX,
        origD: pivY,
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
        origA: evalAnchor[0],
        origB: evalAnchor[1],
        origC: pos[0],
        origD: pos[1],
        origRotDeg: evalRotZ,
        origScaleX: evalScale[0],
        origScaleY: evalScale[1],
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
    const curT = Number(studio.currentTime.toFixed(3));

    if (dr.mode === 'mask-vertex' && dr.layerId && dr.maskId !== undefined && dr.vertexIdx !== undefined) {
      studio.commitProjectChange(
        'Move Mask Vertex',
        (draft) => {
          const c = draft.compositions.find((x) => x.id === draft.activeCompId);
          const l = c?.layers.find((x) => x.id === dr.layerId);
          const m = l?.masks.find((mk) => mk.id === dr.maskId);
          const v = m?.vertices[dr.vertexIdx!];
          if (!v) return;
          v.x = Math.round(dr.origA + dx);
          v.y = Math.round(dr.origB + dy);
        },
        `maskv_${dr.maskId}_${dr.vertexIdx}`,
      );
      return;
    }

    if (dr.mode === 'scale-handle' && dr.layerId && dr.handleId) {
      const rotRad = (-(dr.origRotDeg ?? 0) * Math.PI) / 180;
      const localDx = dx * Math.cos(rotRad) - dy * Math.sin(rotRad);
      const localDy = dx * Math.sin(rotRad) + dy * Math.cos(rotRad);
      const hw = Math.max(20, dr.halfW ?? 200);
      const hh = Math.max(20, dr.halfH ?? 120);
      const signX = dr.handleId.includes('e') ? 1 : dr.handleId.includes('w') ? -1 : 0;
      const signY = dr.handleId.includes('s') ? 1 : dr.handleId.includes('n') ? -1 : 0;
      let nextSx = dr.origA + (signX * localDx / hw) * 100;
      let nextSy = dr.origB + (signY * localDy / hh) * 100;
      if (e.shiftKey || (signX !== 0 && signY !== 0 && e.metaKey)) {
        const dominant = Math.abs(signX * localDx) >= Math.abs(signY * localDy)
          ? nextSx / Math.max(1, dr.origA)
          : nextSy / Math.max(1, dr.origB);
        nextSx = dr.origA * dominant;
        nextSy = dr.origB * dominant;
      }
      nextSx = Number(Math.max(2, Math.min(800, nextSx)).toFixed(1));
      nextSy = Number(Math.max(2, Math.min(800, nextSy)).toFixed(1));

      studio.commitProjectChange(
        'Scale Layer on Stage',
        (draft) => {
          const c = draft.compositions.find((x) => x.id === draft.activeCompId);
          const l = c?.layers.find((x) => x.id === dr.layerId);
          if (!l || l.locked) return;
          const nextScale: [number, number, number] = [nextSx, nextSy, l.transform.scale.value[2]];
          l.transform.scale.value = nextScale;
          if (l.transform.scale.animated && l.transform.scale.keyframes.length > 0) {
            const nearKf = l.transform.scale.keyframes.find((k) => Math.abs(k.time - curT) < 0.04);
            if (nearKf) nearKf.value = [...nextScale];
            else {
              l.transform.scale.keyframes.push({
                id: createId('kf'),
                time: curT,
                value: [...nextScale],
                interpolation: 'bezier',
                inInfluence: 0.5,
                outInfluence: 0.5,
              });
              l.transform.scale.keyframes.sort((a, b) => a.time - b.time);
            }
          }
        },
        `scale_${dr.layerId}`,
      );
      return;
    }

    if (dr.mode === 'move' && dr.layerId) {
      const cdx = e.shiftKey && Math.abs(dy) > Math.abs(dx) ? 0 : dx;
      const cdy = e.shiftKey && Math.abs(dx) >= Math.abs(dy) ? 0 : dy;
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
      studio.commitProjectChange(
        'Rotate Layer on Stage',
        (draft) => {
          const c = draft.compositions.find((x) => x.id === draft.activeCompId);
          const l = c?.layers.find((x) => x.id === dr.layerId);
          if (!l || l.locked || !c) return;
          const pivX = dr.origC ?? evaluateProperty(l.transform.position, curT, l, c, draft).value[0];
          const pivY = dr.origD ?? evaluateProperty(l.transform.position, curT, l, c, draft).value[1];
          const curAngle = Math.atan2(cy - pivY, cx - pivX);
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
      // BUG-R4-05 Fixed: Transform world [dx, dy] by inverse local rotation & scale, and write keyframes when animated!
      const rotRad = (-(dr.origRotDeg ?? 0) * Math.PI) / 180;
      const sx = Math.max(0.02, (dr.origScaleX ?? 100) / 100);
      const sy = Math.max(0.02, (dr.origScaleY ?? 100) / 100);
      const localAnchorDx = (dx * Math.cos(rotRad) - dy * Math.sin(rotRad)) / sx;
      const localAnchorDy = (dx * Math.sin(rotRad) + dy * Math.cos(rotRad)) / sy;

      studio.commitProjectChange(
        'Pan-Behind Anchor Point',
        (draft) => {
          const c = draft.compositions.find((x) => x.id === draft.activeCompId);
          const l = c?.layers.find((x) => x.id === dr.layerId);
          if (!l || l.locked) return;
          const nextAnchor: [number, number, number] = [
            Number((dr.origA + localAnchorDx).toFixed(1)),
            Number((dr.origB + localAnchorDy).toFixed(1)),
            l.transform.anchorPoint.value[2],
          ];
          const nextPos: [number, number, number] = [
            Number(((dr.origC ?? 0) + dx).toFixed(1)),
            Number(((dr.origD ?? 0) + dy).toFixed(1)),
            l.transform.position.value[2],
          ];
          l.transform.anchorPoint.value = nextAnchor;
          l.transform.position.value = nextPos;

          if (l.transform.anchorPoint.animated && l.transform.anchorPoint.keyframes.length > 0) {
            const near = l.transform.anchorPoint.keyframes.find((k) => Math.abs(k.time - curT) < 0.04);
            if (near) near.value = [...nextAnchor];
            else {
              l.transform.anchorPoint.keyframes.push({
                id: createId('kf'),
                time: curT,
                value: [...nextAnchor],
                interpolation: 'bezier',
                inInfluence: 0.5,
                outInfluence: 0.5,
              });
              l.transform.anchorPoint.keyframes.sort((a, b) => a.time - b.time);
            }
          }
          if (l.transform.position.animated && l.transform.position.keyframes.length > 0) {
            const near = l.transform.position.keyframes.find((k) => Math.abs(k.time - curT) < 0.04);
            if (near) near.value = [...nextPos];
            else {
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

  const isPaintTool = studio.activeTool === 'brush' || studio.activeTool === 'clone' || studio.activeTool === 'eraser';
  const stageCursor =
    studio.activeTool === 'hand'
      ? 'grab'
      : studio.activeTool === 'zoom'
      ? 'zoom-in'
      : studio.activeTool === 'text'
      ? 'text'
      : studio.activeTool === 'selection'
      ? 'default'
      : 'crosshair';

  const invScaleStroke = 1 / Math.max(0.2, zoomScale);
  const handleHalf = 5 * invScaleStroke;

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
          <button
            className="studio-btn"
            onClick={studio.fitViewportToStage}
            title="Zoom Composition to Fit Stage (Alt+0)"
          >
            Fit
          </button>

          <select
            className="studio-select"
            aria-label="Viewport Zoom"
            value={[25, 50, 75, 100, 150, 200, 300].includes(studio.zoomPct) ? studio.zoomPct : 'custom'}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (!Number.isNaN(v) && v > 0) studio.setZoomPct(v);
            }}
          >
            {![25, 50, 75, 100, 150, 200, 300].includes(studio.zoomPct) && (
              <option value="custom">{studio.zoomPct}%</option>
            )}
            <option value={25}>25%</option>
            <option value={50}>50%</option>
            <option value={75}>75%</option>
            <option value={100}>100%</option>
            <option value={150}>150%</option>
            <option value={200}>200%</option>
            <option value={300}>300%</option>
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
        ref={stageOuterRef}
        onWheel={onStageWheel}
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
            style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible' }}
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
                    strokeWidth={1.5 * invScaleStroke}
                  />
                  <line
                    x1={0}
                    y1={(comp.height / 12) * (i + 1)}
                    x2={comp.width}
                    y2={(comp.height / 12) * (i + 1)}
                    stroke="rgba(255,255,255,0.14)"
                    strokeWidth={1.5 * invScaleStroke}
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
                  strokeWidth={1.5 * invScaleStroke}
                  strokeDasharray={`${8 * invScaleStroke} ${5 * invScaleStroke}`}
                />
                <rect
                  x={comp.width * 0.1}
                  y={comp.height * 0.1}
                  width={comp.width * 0.8}
                  height={comp.height * 0.8}
                  fill="none"
                  stroke="rgba(245, 165, 36, 0.35)"
                  strokeWidth={1.5 * invScaleStroke}
                  strokeDasharray={`${5 * invScaleStroke} ${5 * invScaleStroke}`}
                />
              </>
            )}

            {/* QOL-R4-01: Full On-Stage Bounding Box, 8 Scale Handles, Rotation Stem, Anchor Reticle & Mask Vertices */}
            {selLayer && selLayer.visible && (
              <g>
                {gizmo && (
                  <>
                    <polygon
                      points={gizmo.corners.map((p) => `${p[0]},${p[1]}`).join(' ')}
                      fill="none"
                      stroke="#4cc3ff"
                      strokeWidth={1.6 * invScaleStroke}
                    />
                    <line
                      x1={gizmo.topMid[0]}
                      y1={gizmo.topMid[1]}
                      x2={gizmo.rotHandle[0]}
                      y2={gizmo.rotHandle[1]}
                      stroke="#4cc3ff"
                      strokeWidth={1.6 * invScaleStroke}
                    />
                    <circle
                      cx={gizmo.rotHandle[0]}
                      cy={gizmo.rotHandle[1]}
                      r={6 * invScaleStroke}
                      fill="#f5a524"
                      stroke="#090b0f"
                      strokeWidth={1.8 * invScaleStroke}
                    />
                    {gizmo.handles.map((h) => (
                      <rect
                        key={h.id}
                        x={h.pos[0] - handleHalf}
                        y={h.pos[1] - handleHalf}
                        width={handleHalf * 2}
                        height={handleHalf * 2}
                        fill="#f4f6fa"
                        stroke="#0c1017"
                        strokeWidth={1.5 * invScaleStroke}
                      />
                    ))}
                    <circle
                      cx={gizmo.pivot[0]}
                      cy={gizmo.pivot[1]}
                      r={8 * invScaleStroke}
                      fill="none"
                      stroke="#f5a524"
                      strokeWidth={2 * invScaleStroke}
                    />
                    <line
                      x1={gizmo.pivot[0] - 13 * invScaleStroke}
                      y1={gizmo.pivot[1]}
                      x2={gizmo.pivot[0] + 13 * invScaleStroke}
                      y2={gizmo.pivot[1]}
                      stroke="#f5a524"
                      strokeWidth={1.8 * invScaleStroke}
                    />
                    <line
                      x1={gizmo.pivot[0]}
                      y1={gizmo.pivot[1] - 13 * invScaleStroke}
                      x2={gizmo.pivot[0]}
                      y2={gizmo.pivot[1] + 13 * invScaleStroke}
                      stroke="#f5a524"
                      strokeWidth={1.8 * invScaleStroke}
                    />
                  </>
                )}

                {selLayer.masks.map((m) =>
                  m.vertices.length >= 2 ? (
                    <g key={m.id}>
                      <polygon
                        points={m.vertices.map((v) => `${v.x},${v.y}`).join(' ')}
                        fill="none"
                        stroke="#3dd68c"
                        strokeWidth={2 * invScaleStroke}
                      />
                      {m.vertices.map((v, vIdx) => (
                        <rect
                          key={vIdx}
                          x={v.x - handleHalf}
                          y={v.y - handleHalf}
                          width={handleHalf * 2}
                          height={handleHalf * 2}
                          fill="#3dd68c"
                          stroke="#090b0f"
                          strokeWidth={1.5 * invScaleStroke}
                        />
                      ))}
                    </g>
                  ) : null,
                )}
                {selLayer.puppetPins.map((pin, idx) => (
                  <g key={pin.id}>
                    <circle
                      cx={pin.currentX}
                      cy={pin.currentY}
                      r={8 * invScaleStroke}
                      fill="#ffcc00"
                      stroke="#090b0f"
                      strokeWidth={2 * invScaleStroke}
                    />
                    <text
                      x={pin.currentX + 11 * invScaleStroke}
                      y={pin.currentY + 4 * invScaleStroke}
                      fill="#ffcc00"
                      fontSize={14 * invScaleStroke}
                      fontWeight={700}
                    >
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
                  strokeWidth={2.5 * invScaleStroke}
                />
                <rect
                  x={comp.width * studio.wipeSplit01 - 46 * invScaleStroke}
                  y={16 * invScaleStroke}
                  width={92 * invScaleStroke}
                  height={24 * invScaleStroke}
                  rx={5 * invScaleStroke}
                  fill="#0b0c0e"
                  stroke="#f5a524"
                  strokeWidth={1.5 * invScaleStroke}
                />
                <text
                  x={comp.width * studio.wipeSplit01}
                  y={32 * invScaleStroke}
                  textAnchor="middle"
                  fill="#f4f6fa"
                  fontSize={13 * invScaleStroke}
                  fontWeight={700}
                >
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
              onClick={studio.fitViewportToStage}
            >
              Reset View
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
