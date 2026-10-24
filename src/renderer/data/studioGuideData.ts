import { BottomViewMode, LeftTabId, RightTabId } from '../state/StudioContext';

export type GuideTryActionId =
  | 'open-command-palette'
  | 'create-new-comp'
  | 'add-shape-layer'
  | 'add-text-layer'
  | 'apply-glow-effect'
  | 'keyframe-and-ease'
  | 'open-graph-editor'
  | 'apply-wiggle-expression'
  | 'add-trim-paths-operator'
  | 'create-mask-and-stroke'
  | 'open-node-dag'
  | 'enable-3d-camera-rig'
  | 'open-scopes'
  | 'open-tracker'
  | 'take-ab-snapshot'
  | 'queue-gif-render';

export interface GuideChapterSection {
  heading: string;
  body: string;
  shortcuts?: Array<{ keys: string; meaning: string }>;
  formulaOrSnippet?: string;
}

export interface StudioGuideChapter {
  id: string;
  number: string;
  title: string;
  subtitle: string;
  category: 'Foundations' | 'Animation' | 'Compositing & VFX' | 'Pipeline';
  tryActionLabel: string;
  tryActionId: GuideTryActionId;
  sections: GuideChapterSection[];
}

export interface InteractiveTutorialStep {
  stepIndex: number;
  moduleId: string;
  category: 'Foundations' | 'Animation & Rigging' | 'VFX & 3D' | 'Pipeline & Export';
  durationEst: string;
  title: string;
  badge: string;
  summary: string;
  handsOnChallenge: string;
  handsOnTip: string;
  shortcutHint: string;
  spotlightRegion: 'chrome' | 'left-dock' | 'viewport' | 'right-dock' | 'bottom-dock';
  autoFocusLeft?: LeftTabId;
  autoFocusRight?: RightTabId;
  autoFocusBottom?: BottomViewMode;
  tryActionLabel: string;
  tryActionId: GuideTryActionId;
}

export const STUDIO_GUIDE_CHAPTERS: StudioGuideChapter[] = [
  {
    id: 'workspace-foundations',
    number: '01',
    title: 'Minimalist Workspace, Home Hub & Navigation',
    subtitle: 'Home Hub project vault, four-zone studio architecture, themes & offline guarantees.',
    category: 'Foundations',
    tryActionLabel: 'Launch Command Palette (Ctrl+K)',
    tryActionId: 'open-command-palette',
    sections: [
      {
        heading: 'Home Hub + Four Quiet, Resizable Studio Zones',
        body: 'Click Home (Alt+H) anytime to jump to the PreEffects Homepage—manage your Local Project Vault, launch any of the 10 Interactive Tutorial modules, or start from curated templates. Inside the studio, workflows organize into four regions: Top Chrome (menus, tools, workspaces), Left Dock (Project Bin, 186 Effects, Library), Center Stage (WebGL2 Viewport & A/B compare), Right Dock (Inspector, Scopes, Tracker, Scripting), and Bottom Dock (Timeline, Graph Editor, Node DAG, Render Queue).',
        shortcuts: [
          { keys: 'Alt + H', meaning: 'Switch between Home Hub and Active Studio' },
          { keys: 'Ctrl/Cmd + K', meaning: 'Search all 186 effects, commands & layers' },
          { keys: 'F1 or ?', meaning: 'Open this Interactive Studio Guide anytime' },
          { keys: 'F2', meaning: 'Start or resume the 10-Module Interactive Tutorial' },
        ],
      },
      {
        heading: '100% Offline Privacy & WCAG AAA Contrast',
        body: 'Every project saves locally as a human-diffable .prex JSON bundle (plus your Local Project Vault) with zero cloud accounts, zero license checks, and zero telemetry. All four studio themes (Linear Obsidian, Nordic Daylight, OLED Pure Contrast, Warm Graphite) are mathematically calibrated so primary text exceeds 13:1 WCAG AAA contrast and muted hints exceed 4.9:1 AA.',
      },
    ],
  },
  {
    id: 'compositions-and-assets',
    number: '02',
    title: 'Compositions, Footage & Local Asset Pipeline',
    subtitle: 'Creating multi-resolution timelines, importing 2D/3D/CSV/Audio assets & relinking.',
    category: 'Foundations',
    tryActionLabel: 'Open New Composition Dialog',
    tryActionId: 'create-new-comp',
    sections: [
      {
        heading: 'Compositions & Nested Pre-Compositions',
        body: 'A Composition is an independent timeline with its own resolution (1080p, 4K, 9:16 social, or custom), frame rate (1–240 fps), work area, and shutter-angle motion blur. Select multiple layers and press Ctrl+Shift+C to group them into a nested Pre-Composition; double-click any Pre-Comp layer to dive inside.',
        shortcuts: [
          { keys: 'Ctrl/Cmd + N', meaning: 'Create a new Composition' },
          { keys: 'Ctrl/Cmd + I', meaning: 'Import local image, .obj, .csv, .cube, .wav or .prex' },
          { keys: 'Ctrl/Cmd + S', meaning: 'Save .prex project locally' },
          { keys: 'Ctrl/Cmd + Shift + C', meaning: 'Pre-compose selected layers' },
        ],
      },
      {
        heading: 'Smart Asset Decoding & Relinking',
        body: 'Importing PNG/JPEG/WebP/SVG images rasterizes full RGBA pixel buffers locally; Wavefront .OBJ files load interactive 3D meshes; .CSV tables drive data-driven graphics; and .CUBE files load color LUTs. If footage moves on disk, use Relink in the Project Bin or File -> Collect Files Package Report.',
      },
    ],
  },
  {
    id: 'layers-and-blending',
    number: '03',
    title: '11 Layer Types, Parenting & 38 Blend Modes',
    subtitle: 'Vector shapes, per-character typography, adjustment layers & alpha/luma track mattes.',
    category: 'Foundations',
    tryActionLabel: 'Create a Vector Shape Layer',
    tryActionId: 'add-shape-layer',
    sections: [
      {
        heading: 'Purpose-Built Studio Layer Types',
        body: 'Use "+ Layer" in the top bar (or click directly on the Viewport with Text T or Shape Q) to create Text (with per-character Wiggly/Range animators), Vector Shapes (with Trim Paths, Repeater, Pucker & Bloat, Zig Zag, Round Corners), Solids, Null Rigs, Adjustment Layers (apply effects to every layer beneath), 3D Cameras, 3D Lights, Audio, Footage, Pre-Comps, and non-rendering Guide Layers.',
        shortcuts: [
          { keys: 'V / H / Z / W', meaning: 'Selection, Hand Pan, Zoom, Rotate tools' },
          { keys: 'Y / Q / G / T', meaning: 'Pan-Behind Anchor, Shape, Pen Mask, Type tools' },
          { keys: 'Ctrl/Cmd + D', meaning: 'Duplicate selected layer(s)' },
          { keys: 'Ctrl/Cmd + Shift + D', meaning: 'Split layer at playhead' },
        ],
      },
      {
        heading: '38 Blend Modes, Parenting & Track Mattes',
        body: 'In the Inspector, choose any of 38 compositing blend modes (Add, Screen, Multiply, Overlay, Soft Light, Linear Dodge, Stencil Alpha, Silhouette Luma, etc.) and Alpha or Luma Track Mattes referencing any arbitrary layer—no need to duplicate matte layers above every consumer.',
      },
    ],
  },
  {
    id: 'keyframes-curves-expressions',
    number: '04',
    title: 'Keyframes, Value/Speed Curves & Expressions',
    subtitle: 'Cubic Bezier timing, inline arithmetic scrubbers, Easy Ease & JS expressions.',
    category: 'Animation',
    tryActionLabel: 'Keyframe & Open Graph Editor',
    tryActionId: 'open-graph-editor',
    sections: [
      {
        heading: 'Stopwatch Keyframing & Inline Math Scrubbers',
        body: 'Click the diamond icon beside Position, Scale, Anchor, Rotation, or Opacity to toggle keyframing at the playhead. Drag any cyan number horizontally to scrub (hold Shift for 10x speed, Alt for 0.1x precision), or click it to type arithmetic expressions directly—such as 1920/2, +120, or *1.5.',
        shortcuts: [
          { keys: 'Space / J K L', meaning: 'Play/Pause or shuttle reverse / pause / forward' },
          { keys: '← / →', meaning: 'Step 1 frame backward / forward' },
          { keys: 'P / S / R / Alt+T', meaning: 'Toggle keyframe on Pos, Scale, Rot, Opacity' },
          { keys: 'F9 / U', meaning: 'Apply Easy Ease / Open Graph Editor' },
        ],
      },
      {
        heading: 'Unified Value & Speed Graph + Sandboxed Expressions',
        body: 'Switch the Bottom Dock to Graph Editor to inspect either Value curves or velocity Speed curves, and apply Easy Ease, Wiggler, or Smoother to the selected channel. Twirl open any layer row in the Timeline (or click an Expression Snippet in the Library tab) to write AE-compatible expressions with non-modal error recovery:',
        formulaOrSnippet: 'wiggle(2.5, 18)   // Organic motion\nvalue + [0, Math.sin(time * 3) * 24, 0]   // Harmonic float\nloopOut("pingpong")   // Seamless cycle',
      },
    ],
  },
  {
    id: 'effects-color-scopes',
    number: '05',
    title: '186 Effects, Smart Presets & Broadcast Scopes',
    subtitle: 'GPU/CPU VFX pipeline, per-effect profiler, Lumetri grading & A/B split-wipe.',
    category: 'Compositing & VFX',
    tryActionLabel: 'Apply Optical Glow & Open Scopes',
    tryActionId: 'open-scopes',
    sections: [
      {
        heading: '186 Built-In Effects & Resolution-Adaptive Presets',
        body: 'Open Left Dock -> Effects to filter 19 categories (Blur & Sharpen, Colour Correction, Keying, Distort, Stylize, Simulation, Procedural Generation, Local AI). Smart Adaptive Presets automatically scale pixel radii and choke amounts to match 720p, 1080p, or 4K compositions. Every applied effect shows its live millisecond render cost in the Inspector.',
      },
      {
        heading: 'Broadcast Scopes & Snapshot A/B Split-Wipe',
        body: 'Open Right Dock -> Scopes to monitor live RGB Histograms, 0–100 IRE Luma Waveforms, and Chroma Vectorscopes with the broadcast skin-tone I-line. Press F5 (or click Snapshot in the viewport bar) before tweaking a grade, then drag the A/B slider to wipe live pixels against your reference frame.',
        shortcuts: [
          { keys: 'F5', meaning: 'Capture Viewport reference snapshot' },
          { keys: 'Shift + F5', meaning: 'Toggle 50/50 A/B split-wipe comparison' },
        ],
      },
    ],
  },
  {
    id: 'masks-roto-tracking-paint',
    number: '06',
    title: 'Bezier Masks, Local AI Roto, Tracking & Paint',
    subtitle: 'Pen splines, Auto-Trace Alpha, NCC feature tracking, Content-Aware Fill & Puppet Pins.',
    category: 'Compositing & VFX',
    tryActionLabel: 'Open Motion Tracker & Roto Dock',
    tryActionId: 'open-tracker',
    sections: [
      {
        heading: 'Bezier Masks, Auto-Trace & Nulls from Paths',
        body: 'Select the Pen Tool (G) and click on the Viewport to create or extend closed Bezier masks with adjustable mode (Add, Subtract, Intersect, Difference), Feather, and Inversion. In the Inspector, click "Auto-Trace" to generate a vector mask from isolated layer transparency, or "Nulls from Path" to rig mask vertices to Null controllers.',
      },
      {
        heading: '100% Local AI Roto, Motion Tracker, Clean Plates & Paint',
        body: 'Activate AI Roto Brush (Alt+W) and click foreground regions (Alt+Click background) for offline edge-aware matting. Open Right Dock -> Track & Roto to solve 2D NCC feature motion onto a Null layer, apply Warp Stabilizer VFX, or synthesize a Content-Aware Fill clean plate layer. Use Brush (Ctrl+B), Clone (Alt+B), Eraser (Alt+E), and Puppet Pin (Ctrl+P) directly on stage.',
      },
    ],
  },
  {
    id: '3d-stage-and-node-dag',
    number: '07',
    title: '3D Camera Stage & Bidirectional Node Graph',
    subtitle: '3D XYZ transforms, Depth-of-Field cameras, lights & live Layer <-> DAG sync.',
    category: 'Compositing & VFX',
    tryActionLabel: 'Switch to Bidirectional Node DAG',
    tryActionId: 'open-node-dag',
    sections: [
      {
        heading: '3D Layers, Cameras, Lights & AOV Passes',
        body: 'Toggle the 3D cube switch on any layer (in Timeline or Inspector) to unlock Z-space Position, 3-axis Rotation, perspective projection, and dynamic lighting. Add a 3D Camera (focal length + Depth-of-Field blur) and 3D Lights (Point, Spot, Parallel, Ambient), drag with the Camera Orbit Tool (C), and inspect Z-Depth, Normals, or Object-ID AOV passes.',
      },
      {
        heading: 'Live Layer <-> Node Graph Synchronization',
        body: 'Press Shift+N (or select Bottom Dock -> Node Graph) to view your entire composition as a Nuke/Fusion-style Directed Acyclic Graph (DAG). Clicking any Source or Effect node toggles bypass instantaneously on the corresponding Timeline layer or Inspector effect.',
        shortcuts: [
          { keys: 'Shift + N', meaning: 'Toggle Timeline Layer Stack <-> Node DAG' },
          { keys: 'C', meaning: 'Activate 3D Camera Orbit Tool' },
        ],
      },
    ],
  },
  {
    id: 'export-scripting-versioning',
    number: '08',
    title: 'Render Queue, Scripting, Plugins & Git Snapshots',
    subtitle: 'Multi-format local binary rendering, JS/Python/Lua automation & version commits.',
    category: 'Pipeline',
    tryActionLabel: 'Queue Active Comp for Render',
    tryActionId: 'queue-gif-render',
    sections: [
      {
        heading: 'Multi-Module Local Render Queue & AOVs',
        body: 'Press Ctrl/Cmd+M (or click Export) to queue your active composition. Choose Animated GIF89a, Uncompressed AVI video, Lossless 16-bit PCM WAV audio, 32-bit RGBA TGA, Radiance HDR/EXR float, or PPM frames—plus Beauty and Z-Depth AOV passes—and click "Render All Queued Jobs" to save rendered binaries locally.',
        shortcuts: [
          { keys: 'Ctrl/Cmd + M', meaning: 'Add active composition to Render Queue' },
          { keys: 'B / N', meaning: 'Set Work Area In / Out at current playhead' },
        ],
      },
      {
        heading: 'Audio-to-Keyframes, Multi-Language Scripting & Git Commits',
        body: 'Open Right Dock -> Script & Git to monitor stereo RMS/Peak dB meters, convert audio amplitude envelopes into keyframes, run sandboxed JavaScript / Python / Lua automation scripts, load custom Plugin SDK bundles, and commit Git-style milestones directly inside your .prex project.',
      },
    ],
  },
];

export const INTERACTIVE_TUTORIAL_STEPS: InteractiveTutorialStep[] = [
  {
    stepIndex: 0,
    moduleId: 'mod-viewport-stage',
    category: 'Foundations',
    durationEst: '1 min',
    title: 'Stage, Viewport Navigation & A/B Split-Wipe',
    badge: 'Module 01 / 10 · Stage & View',
    summary: 'The Center Stage renders your composition on WebGL2 with neutral D65 color surround. Move layers directly with Selection (V), pan with Hand (H), zoom with (Z), inspect R/G/B/Alpha/Alpha-Boundary channels, or capture a reference frame with Snapshot (F5) for live A/B split-wipe comparison.',
    handsOnChallenge: 'Capture a reference Snapshot (F5 or click Snapshot in the viewport bar) or toggle Grid / Alpha Checkerboard.',
    handsOnTip: 'After capturing a Snapshot, drag the "A/B Wipe" slider at the bottom-right of the viewport to compare before vs. after pixels.',
    shortcutHint: 'V · H · Z · F5',
    spotlightRegion: 'viewport',
    tryActionLabel: 'Demonstrate: Capture A/B Snapshot',
    tryActionId: 'take-ab-snapshot',
  },
  {
    stepIndex: 1,
    moduleId: 'mod-layers-blending',
    category: 'Foundations',
    durationEst: '1 min',
    title: '11 Layer Types, Parenting & 38 Blend Modes',
    badge: 'Module 02 / 10 · Layers & Mattes',
    summary: 'PreEffects supports Typography, Vector Shapes, Solids, Null Rigs, Adjustment Layers, 3D Cameras, 3D Lights, Audio, Footage, Pre-Comps, and Guide Layers—each with 38 compositing blend modes, parent hierarchies, and arbitrary Alpha/Luma Track Mattes.',
    handsOnChallenge: 'Add a new layer (click "+ Layer" in the top bar or press T / Q) or change any layer Blend Mode in the Inspector.',
    handsOnTip: 'Select multiple layers and press Ctrl/Cmd + Shift + C anytime to group them into a reusable nested Pre-Composition.',
    shortcutHint: 'T · Q · Ctrl+Y',
    spotlightRegion: 'chrome',
    autoFocusLeft: 'project',
    autoFocusRight: 'inspector',
    autoFocusBottom: 'timeline',
    tryActionLabel: 'Demonstrate: Create Typography Layer',
    tryActionId: 'add-text-layer',
  },
  {
    stepIndex: 2,
    moduleId: 'mod-keyframes-curves',
    category: 'Animation & Rigging',
    durationEst: '2 min',
    title: 'Keyframes, Value/Speed Graph Editor & Easy Ease',
    badge: 'Module 03 / 10 · Keyframe Curves',
    summary: 'Click any diamond stopwatch in the Inspector (or press P / S / R) to keyframe properties across time. Switch the Bottom Dock to Graph Editor to sculpt cubic Bezier Value or Speed velocity curves and apply Easy Ease (F9), Wiggler, or Smoother.',
    handsOnChallenge: 'Open the Graph Editor in the Bottom Dock (press U) or toggle a keyframe on the selected layer.',
    handsOnTip: 'Drag horizontally anywhere across the Timeline Time Ruler to scrub at 60fps, or drag clip bars horizontally to slip timing.',
    shortcutHint: 'P · F9 · U · Space',
    spotlightRegion: 'bottom-dock',
    autoFocusRight: 'inspector',
    autoFocusBottom: 'graph',
    tryActionLabel: 'Demonstrate: Keyframe & Open Graph',
    tryActionId: 'keyframe-and-ease',
  },
  {
    stepIndex: 3,
    moduleId: 'mod-expressions-rigging',
    category: 'Animation & Rigging',
    durationEst: '1.5 min',
    title: 'JavaScript Expressions, Math Scrubbers & Pick Whip',
    badge: 'Module 04 / 10 · Expressions',
    summary: 'Every cyan number supports drag-scrubbing and inline arithmetic (click and type 1920/2 or *1.25). Expand any layer in the Timeline (▸) or open Left Dock -> Library to attach sandboxed JS expressions like wiggle(3, 24), loopOut("pingpong"), or Pick-Whip links.',
    handsOnChallenge: 'Apply an Expression Snippet from the Library tab or write an expression on any layer.',
    handsOnTip: 'Expression errors never freeze playback—PreEffects falls back to the last valid value and displays a non-modal status banner.',
    shortcutHint: 'Timeline ▸ · Library',
    spotlightRegion: 'left-dock',
    autoFocusLeft: 'library',
    autoFocusBottom: 'timeline',
    tryActionLabel: 'Demonstrate: Apply Wiggle Expression',
    tryActionId: 'apply-wiggle-expression',
  },
  {
    stepIndex: 4,
    moduleId: 'mod-effects-scopes',
    category: 'VFX & 3D',
    durationEst: '1.5 min',
    title: '186 GPU/CPU Effects, Smart Presets & Lumetri Scopes',
    badge: 'Module 05 / 10 · VFX & Scopes',
    summary: 'Search 186 built-in effects across 19 categories in Left Dock -> Effects, apply resolution-adaptive Look-Dev presets, monitor live per-effect millisecond timings in the Inspector, and grade accurately with RGB Parade, IRE Waveform, and Vectorscope.',
    handsOnChallenge: 'Apply any effect from the Effects catalog or open Right Dock -> Scopes to inspect broadcast video scopes.',
    handsOnTip: 'Click the star icon next to any effect in the catalog to pin it to your Favorites filter.',
    shortcutHint: 'Ctrl+K · Scopes',
    spotlightRegion: 'right-dock',
    autoFocusLeft: 'effects',
    autoFocusRight: 'scopes',
    tryActionLabel: 'Demonstrate: Apply Optical Glow & Scopes',
    tryActionId: 'open-scopes',
  },
  {
    stepIndex: 5,
    moduleId: 'mod-shapes-typography',
    category: 'Animation & Rigging',
    durationEst: '1.5 min',
    title: 'Vector Shape Operators & Text Range Animators',
    badge: 'Module 06 / 10 · Motion Design',
    summary: 'Vector Shape layers feature procedural geometry (Rectangle, Ellipse, Polystar) plus non-destructive operators: Trim Paths, Repeater, Offset Paths, Pucker & Bloat, Wiggle Paths, Zig Zag, and Round Corners. Text layers include Per-Character Wiggly cascades.',
    handsOnChallenge: 'Create a Vector Shape layer and add a Shape Operator (such as Trim Paths or Repeater) in the Inspector.',
    handsOnTip: 'Combine Repeater + Trim Paths on a Polystar shape to build intricate HUD radial graphics in seconds.',
    shortcutHint: 'Q · Inspector',
    spotlightRegion: 'right-dock',
    autoFocusRight: 'inspector',
    tryActionLabel: 'Demonstrate: Shape + Trim Paths Rig',
    tryActionId: 'add-trim-paths-operator',
  },
  {
    stepIndex: 6,
    moduleId: 'mod-masks-paint-puppet',
    category: 'VFX & 3D',
    durationEst: '2 min',
    title: 'Bezier Masks, Auto-Trace Alpha, Live Paint & Puppet Pins',
    badge: 'Module 07 / 10 · Masks & Paint',
    summary: 'Click on stage with Pen (G) to build feathered Bezier masks (Add, Subtract, Intersect, Difference), trace layer transparency via Auto-Trace, paint live strokes with Brush (Ctrl+B) / Clone (Alt+B) / Eraser (Alt+E), or warp meshes with Puppet Pins (Ctrl+P).',
    handsOnChallenge: 'Draw a Brush stroke on stage, add a Bezier Mask (G), click Auto-Trace in the Inspector, or place a Puppet Pin.',
    handsOnTip: 'Click "Nulls from Path" in the Masks card to pin mask vertices to animated Null rig controllers.',
    shortcutHint: 'G · Ctrl+B · Ctrl+P',
    spotlightRegion: 'viewport',
    autoFocusRight: 'inspector',
    tryActionLabel: 'Demonstrate: Add Feathered Mask & Stroke',
    tryActionId: 'create-mask-and-stroke',
  },
  {
    stepIndex: 7,
    moduleId: 'mod-tracking-roto-fill',
    category: 'VFX & 3D',
    durationEst: '1.5 min',
    title: '2D Motion Tracking, Warp Stabilizer, AI Roto & Clean Plates',
    badge: 'Module 08 / 10 · Track & Roto',
    summary: 'Open Right Dock -> Track & Roto to solve sub-pixel Normalized Cross-Correlation (NCC) motion tracks to a Null rig, smooth shake with Warp Stabilizer VFX, segment subjects offline with Local AI Roto (Alt+W), or generate a Content-Aware Fill clean plate.',
    handsOnChallenge: 'Open Track & Roto and run Motion Tracker, Stabilize Layer, or Generate Fill Plate.',
    handsOnTip: 'Every AI Roto and Content-Aware Fill pass executes 100% locally in pooled CPU memory—zero frames ever leave your machine.',
    shortcutHint: 'Alt+W · Track & Roto',
    spotlightRegion: 'right-dock',
    autoFocusRight: 'tracker',
    tryActionLabel: 'Demonstrate: Open Track & Roto Suite',
    tryActionId: 'open-tracker',
  },
  {
    stepIndex: 8,
    moduleId: 'mod-nodes-3d-stage',
    category: 'VFX & 3D',
    durationEst: '1.5 min',
    title: 'Bidirectional Layer ⇄ Node DAG & 3D Camera Space',
    badge: 'Module 09 / 10 · Nodes & 3D',
    summary: 'Press Shift+N to view your composition as a live Directed Acyclic Graph (DAG)—clicking any node toggles bypass in sync with your Timeline. Enable 3D Space on layers, add a 35mm Depth-of-Field Camera + 3D Lights, and preview Z-Depth or Object-ID AOV passes.',
    handsOnChallenge: 'Switch the Bottom Dock to Node Graph (Shift+N) or add a 3D Camera / toggle 3D Space on a layer.',
    handsOnTip: 'Select the Camera Orbit Tool (C) and drag across the Viewport to orbit your 3D Camera through Z-space.',
    shortcutHint: 'Shift+N · C',
    spotlightRegion: 'bottom-dock',
    autoFocusBottom: 'nodes',
    tryActionLabel: 'Demonstrate: 3D Camera Rig & Node DAG',
    tryActionId: 'enable-3d-camera-rig',
  },
  {
    stepIndex: 9,
    moduleId: 'mod-audio-script-render',
    category: 'Pipeline & Export',
    durationEst: '1.5 min',
    title: 'Audio Keyframes, Multi-Lang Scripting, Git & Render Queue',
    badge: 'Module 10 / 10 · Export & Pipeline',
    summary: 'Open Right Dock -> Script & Git to convert Audio Amplitude to Keyframes, run JavaScript / Python / Lua automation scripts, install sandboxed plugins, or commit Git snapshots. Press Ctrl/Cmd+M to render GIF89a, AVI, WAV, 32-bit TGA, or HDR/EXR files locally.',
    handsOnChallenge: 'Queue the active composition in the Render Queue (Ctrl/Cmd+M) or commit a Git Project Snapshot.',
    handsOnTip: 'Click "Render All Queued Jobs" in the Render Queue to encode downloadable local binary deliverables with AOV sidecars.',
    shortcutHint: 'Ctrl+M · Script & Git',
    spotlightRegion: 'bottom-dock',
    autoFocusRight: 'scripting',
    autoFocusBottom: 'render-queue',
    tryActionLabel: 'Demonstrate: Queue Local Render Job',
    tryActionId: 'queue-gif-render',
  },
];
