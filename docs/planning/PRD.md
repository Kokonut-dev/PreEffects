# Product Requirements Document (PRD) — PreEffects v1.0

**Document ID:** `PRE-PLAN-001`  
**Stage:** Stage 1 — Planning  
**Status:** Approved Baseline  
**Target Platforms:** macOS (Universal: Apple Silicon & Intel), Windows (x64 & ARM64), Linux (x64 & ARM64)

---

## 1. Product Vision Statement

**PreEffects** is a professional-grade, 100% local, zero-account desktop motion graphics, kinetic typography, 2D/3D compositing, and visual effects workstation that matches the complete functional breadth of Adobe After Effects while surpassing it with a live bidirectional Layer-to-Node compositor, 100% offline local AI matting/upscaling/interpolation tools, real-time per-effect GPU/CPU profiling, deterministic Git-friendly project storage, and multi-language scripting.

Creative professionals and studios deserve tools they truly own: software that launches in under five seconds, never gates local files behind subscriptions or sign-in walls, never phones home, and delivers 60fps interactive scrubbing on complex multi-layer compositions across macOS, Windows, and Linux.

---

## 2. Target Users & User Personas

### Persona 1 — Maya Lin (Senior Broadcast & Brand Motion Designer)
- **Profile:** 9 years in agency motion graphics; builds kinetic typography systems, brand toolkits, shape-layer morphs, and 60fps broadcast packages.
- **Daily Workflow:** Heavy Graph Editor (speed + value curves), Trim Paths + Repeaters, Text Animators, Pre-comps, Expression rigs (`wiggle`, `linear`, `loopOut`, Slider Controls), custom keyboard shortcuts.
- **Pain Points Solved by PreEffects:** Eliminates AE's modal expression lag, opaque render slowdowns (via per-effect ms profiler), and clumsy Value/Speed graph switching (via unified curve tangents).

### Persona 2 — Henrik Lindqvist (Senior VFX Compositor, Linux/macOS Pipeline)
- **Profile:** 12 years in episodic and feature VFX using Nuke, Natron, and After Effects; works on Linux workstations unavailable in Creative Cloud.
- **Daily Workflow:** Chroma keying + spill suppression, planar/3D camera tracking, variable-feather rotoscoping, linear-light/ACES color management, multi-pass EXR/PNG sequence exports, node-based compositing trees.
- **Pain Points Solved by PreEffects:** Native Linux support (`.AppImage`/`.deb`/`.rpm`/Flatpak), instant toggle between Timeline Layer stack and DAG Node Graph, built-in real-time broadcast scopes (Waveform, Parade, Vectorscope, Histogram), and zero cloud traffic for studio air-gapped security.

### Persona 3 — Devon Brooks (Video Editor & Content Creator)
- **Profile:** Solo filmmaker and YouTube educator producing explainers, HUD callouts, lower thirds, and screen-recorded tutorials.
- **Daily Workflow:** Fast template customization, audio-reactive waveforms, Warp Stabilizer, quick H.264/WebM export, built-in screen capture.
- **Pain Points Solved by PreEffects:** Welcome screen with adaptive presets, built-in screen recorder directly into Project Assets, one-click Quick Export, and no recurring login interruptions when editing on flights.

### Persona 4 — Aisha Patel ( Procedural Artist & Hobbyist Animator)
- **Profile:** Indie game artist and creative coder exploring vector animation, procedural textures, and particle VFX on Windows and Linux.
- **Daily Workflow:** Shape booleans, L-systems, reaction-diffusion shaders, JavaScript/Python/Lua automation scripts, GIF/WebM/PNG sprite-sheet export.
- **Pain Points Solved by PreEffects:** Multi-language scripting console, procedural generation generators, local version snapshots, and approachable contextual "What's This?" help.

### Persona 5 — Studio Pipeline Lead (Enterprise / Academic Lab Administrator)
- **Profile:** Manages 80 offline lab seats across Windows, macOS, and Ubuntu.
- **Pain Points Solved by PreEffects:** Deterministic silent installers, zero license servers, human-diffable `.prex` project manifests for Git, sandboxed plugin API, and portable user-data directories.

---

## 3. Core Design Principles

1. **Professional Studio Density, Zero Clutter:** High-contrast dark workspace (`#111317`–`#20242C`) tuned for 10-hour grading/compositing sessions, tabular monospace readouts, crisp 1.5px vector iconography, and zero decorative chrome.
2. **Intuitive & Familiar, Yet Faster:** Respects muscle memory of veteran After Effects artists (`U`, `UU`, `P`, `S`, `R`, `T`, `A`, `E`, `M`, `F`, `J/K/L`, `Space`, `[` / `]`, `Ctrl/Cmd+K`) while removing legacy modal friction.
3. **60fps Interactive Performance:** Hybrid WebGL2 GPU shader pipeline with deterministic Float32/Uint8 CPU fallback, LRU RAM preview ring buffer, persistent disk frame cache, and automatic dynamic resolution scaling during scrubbing.
4. **Extensible & Open:** Versioned sandboxed Plugin SDK for custom effects, custom panels, importers/exporters, and automation scripts in JavaScript, Python-syntax, and Lua-syntax.
5. **100% Offline, Private & Local-First:** Zero sign-in, zero telemetry, zero external network dependencies, self-contained `.prex` packages, and local crash-recovery journals.

---

## 4. Functional Requirements Summary (By Category)

*(See [`docs/planning/FEATURES.md`](./FEATURES.md) for the exhaustive 100% item-by-item inventory.)*

1. **Timeline & Composition (`COMP-*`)**: Unlimited nested compositions, multi-tab timelines, pre-composing, comp settings (up to 8K, 1–240fps), shy/solo/lock/guide/adjustment switches, parenting, null objects, frame blending, shutter-angle motion blur, time remapping/stretching, markers, work area.
2. **Layer System (`LYR-*`)**: Solid, Shape (full hierarchy & 11 path operators), Text (point/paragraph, path text, per-char 3D, range/wiggly/expression animators), Null, Camera (1/2-node + DoF), Light (Point, Spot, Parallel, Ambient + shadows), Audio, Footage, Pre-comp, Adjustment, 3D layers.
3. **Effects & Filters (`FX-*`)**: 140+ built-in GPU/CPU effects spanning all 18 AE categories (Blur & Sharpen, Colour Correction, Distort, Generate, Keying, Matte, Noise & Grain, Perspective, Simulation, Stylize, Text, Time, Transition, Utility, Audio, Immersive VR, 3D Channel, Expression Controls) + Local AI & Procedural category.
4. **Animation & Keyframing (`ANIM-*`)**: Linear, Bezier, Auto-Bezier, Continuous Bezier, Hold, and Roving Spatial keyframes; Value & Speed Graph Editor; spatial motion paths; Easy Ease presets; Sequence Layers, Reverse, Audio-to-Keyframes, Smoother, Wiggler, Motion Sketch.
5. **Expressions (`EXPR-*`)**: Sandboxed JS expression engine with full AE standard library, cross-comp references, Expression Controls, Pick Whip, syntax-highlighted editor, autocomplete, and inline error diagnostics.
6. **Masking & Rotoscoping (`MASK-*`)**: Multi-mode Bezier masks, uniform & variable per-vertex feathering, expansion, opacity, RotoBezier, local AI Roto Brush, and Refine Edge.
7. **Motion Tracking (`TRK-*`)**: 1/2/4-Point Tracker, Planar Homography Tracker, 3D Camera Tracker, Warp Stabilizer VFX, Face Mesh/Region Tracker, Content-Aware Video Fill, and Alpha/Luma Track Mattes.
8. **Paint & Clone (`PNT-*`)**: Non-destructive Brush, Clone Stamp, and Eraser tools with pressure/dynamics and timeline stroke duration bars.
9. **3D Compositing (`3D-*`)**: 3D layer transforms, multi-light Phong/PBR shading, shadow casting, material options, Classic/Extruded/Ray-style renderers, environment maps, OBJ/FBX-ascii/glTF import.
10. **Rendering & Export (`RND-*`)**: Multi-output Render Queue, MP4/H.264, H.265, ProRes, DNxHR, WebM, MOV, AVI, MKV, GIF, WAV, PNG/JPEG/TIFF/TGA/PPM/EXR sequences, multi-pass AOVs (Depth, Normal, Object ID, Motion Vectors), proxies, ACES/LUT color management, 8/16/32-bpc HDR pipeline.
11. **Project, Asset & Import Pipeline (`PRJ-*`, `IMP-*`)**: Folders, search/filter, footage interpretation, missing-footage relinker, Collect Files packager, templates, auto-save, local version history, unlimited undo/redo History panel, video/image/PSD/AI/audio/3D/XML/EDL/JSON/CSV import.
12. **Studio UI, Scopes & Plugins (`UI-*`, `PLG-*`)**: Dockable/resizable workspaces, Obsidian Dark + Precision Light + Custom Theme Editor, DPI scaling, multi-monitor Tear-Off windows, custom shortcuts, Command Palette, Viewport Grids/Guides/Safe Zones/ROI/Channels, Scopes (Histogram, Waveform, Parade, Vectorscope), Sandboxed Plugin API.
13. **Capabilities Exceeding After Effects (`EXCEED-*`)**: 18 major differentiators including Bidirectional Node Graph Compositor, Local AI Suite (Roto/Upscale/Optical-Flow/Denoise), Multi-Language Scripting (JS/Python/Lua), Per-Effect Performance Profiler, Snapshot A/B Wipe, Git Version Control History, Procedural Generators, Screen Recorder, Smart Adaptive Presets, and Interactive "What's This?" Help.

---

## 5. Non-Functional Requirements

| Category | Target Requirement | Verification Metric |
|---|---|---|
| **Startup Time** | Cold application launch to interactive studio shell **< 5.0 seconds** on reference dual-core/quad-core hardware (target **< 1.5s** renderer boot). | Automated startup timer in `tests/performance/` |
| **Timeline Scrubbing** | **>= 60 fps** (`<= 16.67 ms` per frame evaluation + UI update) on a 100-layer composition with keyframes and transforms. | `timelineScrub` benchmark suite |
| **Effect Stack Throughput** | Real-time interactive preview on HD/4K comps (with adaptive half/quarter scrubbing when >20 heavy effects active) and multi-frame cached playback at target FPS. | `compositorPerf` benchmark suite |
| **Large Project Scaling** | **< 5 ms** search/filter latency and 60fps virtualized scrolling in Project Panel with **500+ assets**. | `projectScaling` benchmark suite |
| **Memory Stability** | Bounded LRU RAM Preview cache (configurable budget, default 1024 MB) with zero unbounded heap growth across 1,000+ scrub/undo cycles. | Heap retention soak test |
| **Crash Resilience** | Zero unhandled exceptions in UI or expression/plugin sandboxes; automatic rolling journal recovery every 60s (configurable). | Fault-injection integration tests |
| **Accessibility** | WCAG 2.1 AA contrast ratios in High-Contrast mode, 100% keyboard navigability, ARIA landmarks/labels on all panels & controls, `prefers-reduced-motion` support, Okabe-Ito color-blind-safe layer labels. | Accessibility audit & keyboard navigation tests |
| **Localisation Readiness** | Centralised i18n string dictionary (`src/utils/i18n.ts`) with UTF-8/RTL-safe typography and locale-aware numeric formatting. | Locale switch unit test |
| **Cross-Platform Parity** | Identical `.prex` file compatibility, rendering determinism, and feature parity across macOS, Windows, and Linux, respecting OS modifier conventions (`Cmd` vs `Ctrl`). | Multi-OS GitHub Actions matrix (`ubuntu`, `macos`, `windows`) |

---

## 6. Hard Constraints

1. **Zero Network Dependency:** Every feature — including AI rotoscoping, upscaling, optical-flow interpolation, documentation search, presets, and export — executes locally without internet access.
2. **Zero Sign-In / Zero Licensing Gates:** No login screens, trials, watermarks, account prompts, or license servers.
3. **Zero Telemetry:** Strict Content-Security-Policy (`default-src 'self' blob: data:; connect-src 'none'` in packaged builds) guarantees zero analytics or background pings.
4. **Exclusive Local Storage:** All settings, caches, auto-saves, templates, and projects reside in local filesystem / local IndexedDB storage under explicit user control.
