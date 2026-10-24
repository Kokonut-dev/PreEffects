// EXCEED-01 & EXCEED-06: Bidirectional Layer <-> DAG Node Graph Compiler & Synchronizer

import { Composition, GraphNodeItem, NodeGraphState } from './types';
import { createEffectInstance } from '../effects/registry';

export function buildNodeGraphFromComp(comp: Composition): NodeGraphState {
  const existingCoords = new Map<string, { x: number; y: number }>();
  for (const n of comp.nodeGraph?.nodes ?? []) {
    existingCoords.set(n.id, { x: n.x, y: n.y });
  }

  const nodes: GraphNodeItem[] = [];
  let prevMergeId: string | undefined;

  // Iterate bottom-to-top so composite merges naturally flow into final Output
  const ordered = [...comp.layers].reverse();
  ordered.forEach((layer, rowIdx) => {
    const baseY = 90 + rowIdx * 115;
    const srcId = `node_src_${layer.id}`;
    const cSrc = existingCoords.get(srcId) ?? { x: 60, y: baseY };
    nodes.push({
      id: srcId,
      kind: 'layer-source',
      label: `[${layer.type.toUpperCase()}] ${layer.name}`,
      layerId: layer.id,
      x: cSrc.x,
      y: cSrc.y,
      bypassed: !layer.visible,
      inputs: [],
    });

    let tailId = srcId;
    layer.effects.forEach((fx, fxIdx) => {
      const fxNodeId = `node_fx_${fx.id}`;
      const cFx = existingCoords.get(fxNodeId) ?? { x: 290 + fxIdx * 200, y: baseY };
      nodes.push({
        id: fxNodeId,
        kind: 'effect',
        label: fx.name,
        layerId: layer.id,
        effectInstanceId: fx.id,
        effectId: fx.effectId,
        x: cFx.x,
        y: cFx.y,
        bypassed: !fx.enabled,
        inputs: [tailId],
      });
      tailId = fxNodeId;
    });

    const mergeId = `node_mrg_${layer.id}`;
    const cMrg = existingCoords.get(mergeId) ?? { x: 720, y: baseY };
    const mergeInputs = prevMergeId ? [prevMergeId, tailId] : [tailId];
    if (layer.trackMatteLayerId) {
      mergeInputs.push(`node_src_${layer.trackMatteLayerId}`);
    }
    nodes.push({
      id: mergeId,
      kind: 'merge',
      label: `Merge (${layer.blendMode})`,
      layerId: layer.id,
      x: cMrg.x,
      y: cMrg.y,
      inputs: mergeInputs,
    });
    prevMergeId = mergeId;
  });

  // Preserve any custom parallel branch effect nodes (EXCEED-06)
  for (const existing of comp.nodeGraph?.nodes ?? []) {
    if (existing.kind === 'branch-effect' && !nodes.some((n) => n.id === existing.id)) {
      nodes.push(existing);
    }
  }

  const outId = `node_out_${comp.id}`;
  const cOut = existingCoords.get(outId) ?? { x: 980, y: Math.max(120, ordered.length * 55) };
  nodes.push({
    id: outId,
    kind: 'output',
    label: `Comp Output (${comp.width}x${comp.height})`,
    x: cOut.x,
    y: cOut.y,
    inputs: prevMergeId ? [prevMergeId] : [],
  });

  return {
    nodes,
    zoom: comp.nodeGraph?.zoom ?? 1,
    panX: comp.nodeGraph?.panX ?? 0,
    panY: comp.nodeGraph?.panY ?? 0,
    showThumbnails: comp.nodeGraph?.showThumbnails ?? true,
  };
}

// Synchronize edits made in the Node Graph directly back into the Timeline Layer Stack
export function toggleNodeBypassInComp(comp: Composition, nodeId: string): Composition {
  const graph = comp.nodeGraph ?? buildNodeGraphFromComp(comp);
  const target = graph.nodes.find((n) => n.id === nodeId);
  if (!target) return comp;

  const nextLayers = comp.layers.map((layer) => {
    if (layer.id !== target.layerId) return layer;
    if (target.kind === 'layer-source') {
      return { ...layer, visible: Boolean(target.bypassed) };
    }
    if (target.kind === 'effect' && target.effectInstanceId) {
      return {
        ...layer,
        effects: layer.effects.map((fx) =>
          fx.id === target.effectInstanceId ? { ...fx, enabled: Boolean(target.bypassed) } : fx,
        ),
      };
    }
    return layer;
  });

  const updated: Composition = { ...comp, layers: nextLayers };
  updated.nodeGraph = buildNodeGraphFromComp(updated);
  return updated;
}

export function addEffectNodeToLayerInGraph(comp: Composition, layerId: string, effectId: string): Composition {
  const fx = createEffectInstance(effectId);
  const nextLayers = comp.layers.map((l) => (l.id === layerId ? { ...l, effects: [...l.effects, fx] } : l));
  const updated: Composition = { ...comp, layers: nextLayers };
  updated.nodeGraph = buildNodeGraphFromComp(updated);
  return updated;
}

export function autoLayoutNodeGraph(comp: Composition): Composition {
  const stripped: Composition = { ...comp, nodeGraph: undefined };
  return { ...comp, nodeGraph: buildNodeGraphFromComp(stripped) };
}

// Kahn's algorithm DAG cycle detector & topological sorter for custom node wires
export function validateAndSortNodeGraph(nodes: GraphNodeItem[]): { acyclic: boolean; ordered: GraphNodeItem[] } {
  const byId = new Map<string, GraphNodeItem>(nodes.map((n) => [n.id, n]));
  const inDegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();

  for (const n of nodes) {
    let validInputs = 0;
    for (const inp of n.inputs) {
      if (byId.has(inp)) {
        validInputs++;
        const list = dependents.get(inp) ?? [];
        list.push(n.id);
        dependents.set(inp, list);
      }
    }
    inDegree.set(n.id, validInputs);
  }

  const queue: GraphNodeItem[] = [];
  for (const n of nodes) {
    if ((inDegree.get(n.id) ?? 0) === 0) queue.push(n);
  }

  const ordered: GraphNodeItem[] = [];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    ordered.push(cur);
    for (const depId of dependents.get(cur.id) ?? []) {
      const nextDeg = (inDegree.get(depId) ?? 1) - 1;
      inDegree.set(depId, nextDeg);
      if (nextDeg === 0) {
        const depNode = byId.get(depId);
        if (depNode) queue.push(depNode);
      }
    }
  }

  return { acyclic: ordered.length === nodes.length, ordered };
}
