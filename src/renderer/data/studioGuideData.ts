import { BottomViewMode, LeftTabId, RightTabId } from '../state/StudioContext';

export type GuideTryActionId =
  | 'open-command-palette'
  | 'create-new-comp'
  | 'add-shape-layer'
  | 'add-text-layer'
  | 'apply-glow-effect'
  | 'keyframe-and-ease'
  | 'open-graph-editor'
  | 'open-node-dag'
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
  title: string;
  badge: string;
  summary: string;
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
    title: 'Minimalist Workspace & Instant Navigation',
    subtitle: 'Four-zone studio architecture, progressive disclosure, themes & offline guarantees.',
    category: 'Foundations',
    tryActionLabel: 'Launch Command Palette (Ctrl+K)',
    tryActionId: 'open-command-palette',
    sections: [
      {
        heading: 'Four Quiet, Resizable Studio Zones',
        body: 'PreEffects organizes every workflow into four predictable regions: Top Chrome (menus, tools, workspaces), Left Dock (Project Bin, 186 Effects, Templates), Center Stage (WebGL2 Viewport & A/B compare), Right Dock (Inspector, Scopes, Tracker, Scripting), and Bottom Dock (Timeline, Graph Editor, Node DAG, Render Queue). Drag any hairline divider to resize panels or press ` (backtick) for Minimal Focus mode.',
        shortcuts: [
          { keys: 'Ctrl/Cmd + K', meaning: 'Search all 186 effects, commands & layers' },
          { keys: 'F1 or ?', meaning: 'Open this Interactive Studio Guide anytime' },
          { keys: 'Shift + F1', meaning: "Toggle What's This? click-to-inspect mode" },
          { keys: '`', meaning: 'Toggle Minimal distraction-free viewport' },
        ],
      },
      {
        heading: '100% Offline Privacy & WCAG AAA Contrast',
        body: 'Every project saves locally as a human-diffable .prex JSON bundle with zero cloud accounts, zero license checks, and zero telemetry. All four studio themes (Linear Obsidian, Nordic Daylight, OLED Pure Contrast, Warm Graphite) are mathematically calibrated so primary text exceeds 13:1 WCAG AAA contrast and even muted hints exceed 4.9:1 AA.',
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
          { keys: '← / →', meaning: 'Step 1 frame backward / forward (Shift = 10f)' },
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
        body: 'Select the Pen Tool (G) and click on the Viewport to create or extend closed Bezier masks with adjustable mode (Add, Subtract, Intersect, Difference), Feather, and Inversion. In the Inspector, click "Auto-Trace Alpha" to generate a vector mask from layer transparency, or "Nulls from Path" to rig mask vertices to Null controllers.',
      },
      {
        heading: '100% Local AI Roto, Motion Tracker, Clean Plates & Paint',
        body: 'Activate AI Roto Brush (Alt+W) and click foreground regions (Alt+Click background) for offline edge-aware matting. Open Right Dock -> Track & Roto to solve 2D NCC feature motion onto a Null layer, apply Warp Stabilizer, or synthesize a Content-Aware Fill clean plate layer. Use Brush (Ctrl+B), Clone (Alt+B), Eraser (Alt+E), and Puppet Pin (Ctrl+P) directly on stage.',
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
        heading: '3D Layers, Cameras, Lights & .OBJ Models',
        body: 'Toggle the 3D cube switch on any layer (in Timeline or Inspector) to unlock Z-space Position, 3-axis Rotation, perspective projection, and dynamic lighting. Add a 3D Camera (focal length + Depth-of-Field blur) and 3D Lights (Point, Spot, Parallel, Ambient), and drag with the Camera Orbit Tool (C) on the Viewport.',
      },
      {
        heading: 'Live Layer <-> Node Graph Synchronization',
        body: 'Press Shift+N (or select Bottom Dock -> Node Graph) to view your entire composition as a Nuke/Fusion-style Directed Acyclic Graph (DAG). Clicking any Source or Effect node toggles bypass instantaneously on the corresponding Timeline layer or Inspector effect—giving you both timeline speed and node clarity.',
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
        body: 'Press Ctrl/Cmd+M (or click Export) to queue your active composition. Choose Animated GIF89a, Uncompressed AVI video, Lossless 16-bit PCM WAV audio, 32-bit RGBA TGA, Radiance HDR/EXR float, or PPM frames—plus Beauty and Z-Depth AOV passes—and click "Render All Queued Jobs" to download rendered binaries locally.',
        shortcuts: [
          { keys: 'Ctrl/Cmd + M', meaning: 'Add active composition to Render Queue' },
          { keys: 'B / N', meaning: 'Set Work Area In / Out at current playhead' },
        ],
      },
      {
        heading: 'Audio-to-Keyframes, Multi-Language Scripting & Git Commits',
        body: 'Open Right Dock -> Script & Git to monitor stereo RMS/Peak dB meters, convert audio amplitude envelopes into keyframes, run sandboxed JavaScript / Python / Lua automation scripts, load custom Plugin SDK bundles, and commit Git-style milestones directly inside your .prex project (restorable anytime via Edit -> Undo History & Version Drawer).',
      },
    ],
  },
];

export const INTERACTIVE_TUTORIAL_STEPS: InteractiveTutorialStep[] = [
  {
    stepIndex: 0,
    title: 'Welcome to the Minimalist Studio',
    badge: 'Step 1 of 8 · Orientation',
    summary: 'Notice the calm, neutral chrome: Top Bar holds tools & workspaces, Left Dock manages assets & 186 effects, Center Stage renders in real time, Right Dock inspects properties, and Bottom Dock houses your Timeline & Node Graph.',
    handsOnTip: 'Press Ctrl/Cmd + K anytime to jump to any tool, command, or effect in milliseconds.',
    shortcutHint: 'Ctrl/Cmd + K',
    spotlightRegion: 'chrome',
    tryActionLabel: 'Try Adding a Text Layer',
    tryActionId: 'add-text-layer',
  },
  {
    stepIndex: 1,
    title: 'Project Bin, Templates & Local Assets',
    badge: 'Step 2 of 8 · Project Dock',
    summary: 'The Left Dock stores your Compositions, imported images, 3D .OBJ meshes, .CSV data tables, and offline starter templates—all saved locally inside portable .prex files.',
    handsOnTip: 'Click any composition card to switch timelines, or click "+ Import" to load local media.',
    shortcutHint: 'Ctrl/Cmd + I',
    spotlightRegion: 'left-dock',
    autoFocusLeft: 'project',
    tryActionLabel: 'Add a Vector Shape Layer',
    tryActionId: 'add-shape-layer',
  },
  {
    stepIndex: 2,
    title: 'Interactive Stage & All 14 Canvas Tools',
    badge: 'Step 3 of 8 · Viewport',
    summary: 'Drag layers directly with Selection (V), pan with Hand (H), rotate with (W), adjust Pivot/Anchor with (Y), draw Bezier Masks with Pen (G), paint strokes with Brush (Ctrl+B), or segment subjects with Local AI Roto (Alt+W).',
    handsOnTip: 'Capture a reference frame with Snapshot (F5) and drag the A/B slider to compare look-dev changes side-by-side.',
    shortcutHint: 'F5 / Shift+F5',
    spotlightRegion: 'viewport',
    tryActionLabel: 'Capture A/B Viewport Snapshot',
    tryActionId: 'take-ab-snapshot',
  },
  {
    stepIndex: 3,
    title: '186 Built-In Effects & Smart Adaptive Presets',
    badge: 'Step 4 of 8 · VFX Library',
    summary: 'Browse 19 VFX categories or apply Smart Adaptive Presets that automatically scale blur/glow radii to your composition resolution.',
    handsOnTip: 'Star (★) your favorite effects to pin them to the Favorites filter for instant reuse.',
    shortcutHint: 'Left Dock -> Effects',
    spotlightRegion: 'left-dock',
    autoFocusLeft: 'effects',
    tryActionLabel: 'Apply Optical Glow to Layer',
    tryActionId: 'apply-glow-effect',
  },
  {
    stepIndex: 4,
    title: 'Precision Inspector, Math Scrubbers & Scopes',
    badge: 'Step 5 of 8 · Inspector & Scopes',
    summary: 'Every numeric value supports horizontal drag-scrubbing AND inline math (click any cyan number and type 1920/2 or +45). Active effects display live millisecond timings.',
    handsOnTip: 'Switch to the Scopes tab to inspect real-time RGB Histograms, IRE Waveforms, and Chroma Vectorscopes.',
    shortcutHint: 'Shift-Drag = 10×',
    spotlightRegion: 'right-dock',
    autoFocusRight: 'inspector',
    tryActionLabel: 'Inspect Live Video Scopes',
    tryActionId: 'open-scopes',
  },
  {
    stepIndex: 5,
    title: 'Multi-Track Timeline, Keyframes & Expressions',
    badge: 'Step 6 of 8 · Timeline',
    summary: 'Drag across the ruler to scrub at 60fps, drag clip bars horizontally to retime layers, click diamond icons to set keyframes, and twirl open any layer to write live JS expressions or Pick-Whip links.',
    handsOnTip: 'Press Space to preview, ArrowLeft/ArrowRight to step frame-by-frame, and F9 for instant Easy Ease.',
    shortcutHint: 'Space / F9',
    spotlightRegion: 'bottom-dock',
    autoFocusBottom: 'timeline',
    tryActionLabel: 'Insert Keyframes & Easy Ease',
    tryActionId: 'keyframe-and-ease',
  },
  {
    stepIndex: 6,
    title: 'Graph Curves & Bidirectional Node DAG',
    badge: 'Step 7 of 8 · Curves & Nodes',
    summary: 'Toggle seamlessly between the Value/Speed Graph Editor (for velocity curve sculpting) and the Bidirectional Node Graph (where clicking any node toggles bypass live on your timeline).',
    handsOnTip: 'Press Shift + N anytime to flip between Timeline Layers and the Compositing Node DAG.',
    shortcutHint: 'Shift + N',
    spotlightRegion: 'bottom-dock',
    autoFocusBottom: 'nodes',
    tryActionLabel: 'Switch to Speed/Value Graph',
    tryActionId: 'open-graph-editor',
  },
  {
    stepIndex: 7,
    title: 'Local Render Queue, Scripting & Git History',
    badge: 'Step 8 of 8 · Export & Automation',
    summary: 'Queue compositions for local GIF89a, uncompressed AVI, lossless WAV, 32-bit TGA, or HDR/EXR export—and save Git-style project snapshots inside your .prex file.',
    handsOnTip: 'You can reopen the full 8-chapter searchable Guide anytime via the "Guide" button in the top bar or by pressing F1.',
    shortcutHint: 'Ctrl/Cmd + M / F1',
    spotlightRegion: 'bottom-dock',
    autoFocusRight: 'scripting',
    autoFocusBottom: 'render-queue',
    tryActionLabel: 'Queue Active Comp for Export',
    tryActionId: 'queue-gif-render',
  },
];
