import { Composition, Layer } from '../engine/types';
import { createDefaultTransform, createId } from '../engine/factory';

// Safe inline arithmetic evaluator for numeric studio inputs (e.g. "1920/2", "540 + 120", "(1080-120)/2")
export function evaluateNumericMathInput(raw: string, currentValue: number): number {
  const trimmed = raw.trim();
  if (!trimmed) return currentValue;

  // Support relative operators like "+=50", "*2", "/2"
  let expr = trimmed;
  if (/^[+\-*/]/.test(expr) && !/^-[0-9.]/.test(expr)) {
    expr = `${currentValue}${expr.replace(/^([+\-*/])=/, '$1')}`;
  }

  // Strictly allow only digits, decimal points, whitespace, parentheses, and + - * / %
  if (!/^[0-9.+\-*/%()\s]+$/.test(expr)) {
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : currentValue;
  }

  try {
    // Recursive descent arithmetic parser (zero dynamic code execution)
    let pos = 0;
    const s = expr.replace(/\s+/g, '');

    const parseExpr = (): number => {
      let val = parseTerm();
      while (pos < s.length && (s[pos] === '+' || s[pos] === '-')) {
        const op = s[pos++];
        const rhs = parseTerm();
        val = op === '+' ? val + rhs : val - rhs;
      }
      return val;
    };

    const parseTerm = (): number => {
      let val = parseFactor();
      while (pos < s.length && (s[pos] === '*' || s[pos] === '/' || s[pos] === '%')) {
        const op = s[pos++];
        const rhs = parseFactor();
        if (op === '*') val *= rhs;
        else if (op === '/') val = rhs === 0 ? currentValue : val / rhs;
        else val = rhs === 0 ? 0 : val % rhs;
      }
      return val;
    };

    const parseFactor = (): number => {
      if (s[pos] === '+') { pos++; return parseFactor(); }
      if (s[pos] === '-') { pos++; return -parseFactor(); }
      if (s[pos] === '(') {
        pos++;
        const v = parseExpr();
        if (s[pos] === ')') pos++;
        return v;
      }
      const start = pos;
      while (pos < s.length && /[0-9.]/.test(s[pos])) pos++;
      const num = Number(s.slice(start, pos));
      return Number.isFinite(num) ? num : NaN;
    };

    const out = parseExpr();
    return pos === s.length && Number.isFinite(out) ? out : currentValue;
  } catch {
    return currentValue;
  }
}

// Okabe-Ito Color-Vision-Deficiency Safe Swatches
export const OKABE_ITO_SWATCHES = [
  '#E69F00', // Orange
  '#56B4E9', // Sky Blue
  '#009E73', // Bluish Green
  '#F0E442', // Yellow
  '#0072B2', // Blue
  '#D55E00', // Vermilion
  '#CC79A7', // Reddish Purple
];

export function mapColorBlindSafeSwatch(hex: string, index = 0): string {
  if (!hex) return OKABE_ITO_SWATCHES[index % OKABE_ITO_SWATCHES.length];
  let hash = 0;
  for (let i = 0; i < hex.length; i++) hash = (hash * 31 + hex.charCodeAt(i)) >>> 0;
  return OKABE_ITO_SWATCHES[hash % OKABE_ITO_SWATCHES.length];
}

// COMP-19: Create Nulls From Paths — generates Null control layers pinned to every Bezier mask vertex
export function createNullsFromMaskVertices(comp: Composition, layerId: string, maskId?: string): Layer[] {
  const target = comp.layers.find((l) => l.id === layerId);
  if (!target) return [];
  const mask = maskId ? target.masks.find((m) => m.id === maskId) : target.masks[0];
  if (!mask || mask.vertices.length === 0) return [];

  return mask.vertices.map((v, idx) => ({
    id: createId('lyr'),
    name: `${target.name} : ${mask.name} [${idx + 1}]`,
    type: 'null',
    labelColor: '#9B87F5',
    visible: true,
    audioEnabled: false,
    solo: false,
    locked: false,
    shy: false,
    collapseTransformations: false,
    frameBlending: 'off',
    motionBlur: false,
    threeD: false,
    inPoint: target.inPoint,
    outPoint: target.outPoint,
    startTime: target.startTime,
    stretchPct: 100,
    blendMode: 'normal',
    trackMatteMode: 'none',
    parentId: target.id,
    transform: createDefaultTransform(Math.round(v.x), Math.round(v.y), 0, 0),
    masks: [],
    effects: [],
    paintStrokes: [],
    puppetPins: [],
    markers: [],
  }));
}

export interface WhatsThisHelpTopic {
  id: string;
  title: string;
  shortcut?: string;
  summary: string;
  proTip: string;
}

export const WHATS_THIS_HELP_DB: Record<string, WhatsThisHelpTopic> = {
  'panel.project': {
    id: 'panel.project',
    title: 'Project Bin & Asset Manager',
    shortcut: 'Ctrl+I (Import) / Ctrl+N (New Comp)',
    summary: 'Organises all Compositions, Footage plates, 3D Wavefront .OBJ models, CSV data tables, and Audio tracks locally.',
    proTip: 'Use Collect Files to generate a portable manifest, or click Relink to batch-reconnect missing studio plates.',
  },
  'panel.effects': {
    id: 'panel.effects',
    title: '186 Built-In Effects & Smart Adaptive Presets',
    shortcut: 'Ctrl+K (Quick Search)',
    summary: 'Browse all 19 VFX categories including Blur, Lumetri Color, Keylight 1.2, Distort, Procedural Generators, and 100% Local AI Roto/Denoise.',
    proTip: 'Smart Adaptive Presets automatically scale blur radii and choke distances to match 1080p, 4K, or 9:16 comps.',
  },
  'panel.viewport': {
    id: 'panel.viewport',
    title: 'WebGL2 Hardware Composition Viewport',
    shortcut: 'Space (Play) / F5 (Snapshot)',
    summary: 'Real-time color-managed stage with interactive 2D/3D gizmos, Bezier mask pen, Paint/Clone brush, AI Roto seeds, and A/B snapshot split wipe.',
    proTip: 'Switch Preview Resolution to Half or Quarter for 60fps scrubbing on heavy 100-layer compositions.',
  },
  'panel.inspector': {
    id: 'panel.inspector',
    title: 'Effect Controls, Scopes, Tracker & Scripting',
    shortcut: 'F3',
    summary: 'Fine-tune Transform math inputs (supports 1920/2 inline arithmetic!), 38 Blend Modes, Text Animators, Shape Operators, Video Scopes, and JS/Python/Lua automation.',
    proTip: 'Every active effect displays a live millisecond render-cost pill from the Per-Effect Performance Profiler.',
  },
  'panel.timeline': {
    id: 'panel.timeline',
    title: 'Hybrid Timeline, Graph Editor, Node DAG & Render Queue',
    shortcut: 'Shift+N (Toggle Node DAG)',
    summary: 'Seamlessly switch between AE-style Multi-Track Layer Stack, Speed/Value Curve Editor, Bidirectional Node Graph, and Multi-Module Local Exporter.',
    proTip: 'Bypassing any node in the Node Graph immediately updates the corresponding Layer or Effect switch in the Timeline.',
  },
};

export const GUIDED_TOUR_STEPS: Array<{ title: string; body: string; targetArea: string }> = [
  {
    title: '1 / 5 · Welcome to PreEffects (100% Offline Studio)',
    body: 'PreEffects runs entirely on your machine with zero sign-in, zero cloud lock-in, and zero telemetry. Your projects save cleanly as human-readable .prex JSON bundles.',
    targetArea: 'Top Studio Bar',
  },
  {
    title: '2 / 5 · 186 Built-In Effects & Smart Adaptive Presets',
    body: 'Use the left dock or press Ctrl/Cmd+K anywhere to fuzzy-search 186 effects across 19 categories, including Keylight keying, 3D LUTs, and Local AI Roto.',
    targetArea: 'Left Project & Effects Dock',
  },
  {
    title: '3 / 5 · WebGL2 Viewport, Snapshots & On-Canvas Tools',
    body: 'Drag layers directly on canvas, paint non-destructive Brush/Clone strokes, place Puppet Deform Pins, and capture A/B Split-Wipe Snapshots.',
    targetArea: 'Center Composition Stage',
  },
  {
    title: '4 / 5 · Hybrid Layer Stack ↔ Bidirectional Node Graph',
    body: 'Press Shift+N or click "Node Graph (DAG)" in the bottom dock to view and edit your composition as a live node tree synced instantaneously with your layers.',
    targetArea: 'Bottom Workspace Dock',
  },
  {
    title: '5 / 5 · Multi-Module Local Render Queue & Git Snapshots',
    body: 'Export Animated GIF89a, Uncompressed AVI, Lossless 16-bit WAV, 32-bit RGBA TGA, Radiance HDR/EXR, and Z-Depth AOVs — and commit Git-style milestones right inside your project!',
    targetArea: 'Render Queue & History',
  },
];
