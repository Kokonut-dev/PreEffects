# Technical Architecture Overview — PreEffects (v1)

**Document ID:** `PRE-PLAN-003`  
**Stage:** Stage 1 — Planning  

---

## 1. Architectural Philosophy & Stack Justification

Designing a cross-platform motion graphics and visual effects workstation requires balancing **pixel-throughput performance**, **complex high-density UI ergonomics** (26 dockable panels, curve editors, node graphs, scopes), **rich codec/file I/O**, and **identical behaviour across macOS, Windows, and Linux**.

### Candidate Architecture Evaluation

| Option | Pros | Cons | Verdict |
|---|---|---|---|
| **Option A: Pure C++ / Qt or Dear ImGui** | Maximum raw native CPU control | Slow UI iteration for 26 rich studio panels/typography/accessibility; complex cross-OS font & theme styling; higher memory-safety risk | Rejected for v1 UI shell |
| **Option B: Rust + Tauri (OS WebView)** | Small binary size | OS WebViews differ across platforms (`WKWebView` on macOS vs `WebView2` on Win vs `WebKitGTK` on Linux), causing subtle WebGL2/WebCodecs/font rendering divergences | Rejected due to cross-platform rendering variance |
| **Option C: Electron (Chromium + Node.js Main) + Strict TypeScript + WebGL2/SIMD-TypedArray Hybrid Compositor + Native FFmpeg Bridge** | Identical Chromium Blink + V8 + Angle GPU WebGL2/WebCodecs/WebAudio stack across macOS, Windows, and Linux; sub-millisecond V8 JIT for expressions; native Node filesystem & child-process FFmpeg integration; full WCAG/ARIA accessibility; also runs identically in browser preview for headless/live testing | Larger base installer (~95 MB compressed), mitigated via `asar` compression and tree-shaking | **Selected Architecture** |

### Why Hybrid WebGL2 + Float32/Uint8 TypedArray Compositing?
1. **Primary GPU Path (WebGL2 Ping-Pong Framebuffer Pipeline)**: Full-screen quad GLSL fragment shaders execute blurs, colour grading, keying, distortions, procedural noise, and 38 Porter-Duff/separable blend modes directly on the GPU at 60fps.
2. **Deterministic CPU Pipeline (Float32 / Uint8Clamped Buffer Engine)**: Guarantees 100% deterministic pixel-exact rendering in headless CI environments (Linux/macOS/Windows runners without physical GPUs), handles complex arbitrary procedural effects (L-Systems, Shatter shards, Roto matting, Tracking NCC, Scopes calculation), and ensures the app **never fails if a GPU driver is missing or blacklisted**.

---

## 2. High-Level System Architecture Diagram

```text
+---------------------------------------------------------------------------------------------------+
|                                   PreEffects Desktop Workstation                                  |
+---------------------------------------------------------------------------------------------------+
|                                                                                                   |
|  +---------------------------------------------------------------------------------------------+  |
|  |                         RENDERER PROCESS (React 18 + TypeScript)                            |  |
|  |                                                                                             |  |
|  |  +-------------------+  +----------------------+  +------------------+  +----------------+  |  |
|  |  |  Menu Bar, Tool   |  |  Composition Viewer  |  |  Dockable Studio |  | Broadcast      |  |  |
|  |  |  Palette & Cmd    |  |  (WebGL2/2D Canvas,  |  |  Panels (26):    |  | Scopes &       |  |  |
|  |  |  Palette (Ctrl+K) |  |   Gizmos, ROI, Wipe) |  |  Project, Effect |  | Perf Profiler  |  |  |
|  |  +---------+---------+  +----------+-----------+  +--------+---------+  +-------+--------+  |  |
|  |            |                       |                       |                    |           |  |
|  |  +---------v-----------------------v-----------------------v--------------------v--------+  |  |
|  |  |                    Timeline, Unified Graph Editor & Bidirectional Node Graph          |  |  |
|  |  +-------------------------------------------+-------------------------------------------+  |  |
|  |                                              |                                              |  |
|  |  +-------------------------------------------v-------------------------------------------+  |  |
|  |  |                     STUDIO STATE & COMMAND HISTORY ENGINE                             |  |  |
|  |  |   Project Store  |  Undo/Redo Journal  |  Workspace/Theme Mgr  |  Shortcut Dispatcher |  |  |
|  |  +-------------------------------------------+-------------------------------------------+  |  |
|  |                                              |                                              |  |
|  |  +-------------------------------------------v-------------------------------------------+  |  |
|  |  |                          CORE COMPOSITING & VFX ENGINE                                |  |  |
|  |  |  +----------------+ +---------------+ +---------------+ +-------------+ +----------+  |  |  |
|  |  |  | Keyframe &     | | Sandboxed JS  | | 11-Type Layer | | 145-Effect  | | 3D Cam,  |  |  |  |
|  |  |  | Bezier Solver  | | Expr & Py/Lua | | Evaluators    | | Shader+CPU  | | Lights & |  |  |  |
|  |  |  | (Value/Speed)  | | Script Engine | | (Shape/Text)  | | Pipeline    | | Shadows  |  |  |  |
|  |  |  +----------------+ +---------------+ +---------------+ +-------------+ +----------+  |  |  |
|  |  |  +----------------+ +---------------+ +---------------+ +-------------+ +----------+  |  |  |
|  |  |  | Masks + Local  | | Point/Planar/ | | Non-Destruct  | | WebAudio    | | LRU RAM  |  |  |  |
|  |  |  | AI Roto/Refine | | 3D/Face Track | | Paint/Clone   | | DSP Graph   | | Preview  |  |  |  |
|  |  |  +----------------+ +---------------+ +---------------+ +-------------+ +----------+  |  |  |
|  |  +-------------------------------------------+-------------------------------------------+  |  |
|  +----------------------------------------------|----------------------------------------------+  |
|                                                 | Context-Isolated IPC Bridge                     |
|                                                 | (Fallback: Local IndexedDB / File System API)   |
|  +----------------------------------------------v----------------------------------------------+  |
|  |                             MAIN PROCESS (Electron / Node.js)                               |  |
|  |   Native OS Menus  |  Local .prex File I/O  |  LRU Disk Cache  |  Auto-Save & Crash Journal |  |
|  |   Optional Native FFmpeg Encoder/Decoder Bridge  |  Multi-Monitor Window Manager            |  |
|  +---------------------------------------------------------------------------------------------+  |
+---------------------------------------------------------------------------------------------------+
```

---

## 3. Frame Evaluation Data Flow

```text
Playhead Time (t) + Comp Settings
       │
       ▼
[1. RAM Preview Cache Lookup (Hash of Comp State + Frame Index + Resolution)]
       │  ├─ HIT ──► Blit Cached Framebuffer to Viewer & Scopes (< 0.4 ms)
       │  └─ MISS
       ▼
[2. Node Graph / Layer Stack Topological Plan]
       │
       ▼
[3. Per-Layer Property Evaluation @ t]
       ├── Evaluate Keyframes (Hold / Linear / Cubic Bezier / Roving Spatial)
       └── Execute Active Expression (`value`, `time`, `wiggle`, Cross-Comp refs)
       │
       ▼
[4. Layer Source Rasterisation (Sub-frame loop if Motion Blur enabled)]
       ├── Solid / Footage / Proxy / PSD / 3D Mesh (OBJ/glTF) / Nested Pre-Comp
       ├── Shape Tree (Generators -> Trim/Offset/Repeater/Wiggle/Merge -> Fill/Stroke)
       ├── Text Engine (Layout -> Range/Wiggly/Expr Selectors -> Per-Char 2D/3D Glyphs)
       └── Non-Destructive Paint / Clone / Eraser Strokes active @ t
       │
       ▼
[5. Layer Masks & Local AI Roto Matte]
       └── Combine Bezier Masks (Add/Sub/Intersect/Diff + Variable Feather + Expansion)
       │
       ▼
[6. Effect Stack Execution (GPU WebGL2 Ping-Pong or Float32/Uint8 CPU Kernel)]
       └── Record Per-Effect Execution Time (ms) -> Profiler Telemetry
       │
       ▼
[7. 2D / 3D Transform, Camera Projection, Multi-Light Shading & Depth of Field]
       │
       ▼
[8. Track Matte Evaluation & 38-Mode Composite Blend into Comp Accumulator]
       │
       ▼
[9. Colour Space View Transform / Output LUT -> Store in RAM/Disk Cache -> Update Scopes]
```

---

## 4. Module Dependency Graph

```text
src/utils/          (Zero internal dependencies: math, color, bezier, ids, lru, i18n)
    ▲
    ├── src/effects/        (Depends only on utils & engine/types)
    ├── src/plugins/        (Sandboxed plugin & JS/Python/Lua scripting host)
    └── src/engine/         (Model, Animation, Expressions, Masks, Shapes, Text, 3D, Tracking, Paint, Audio, Compositor, RenderQueue)
            ▲
            ├── src/renderer/   (React studio UI, panels, dialogs, scopes, workspaces; zero Node imports)
            └── src/main/       (Electron shell, preload IPC, local disk cache, native menus, FFmpeg muxer)
```

Strict rule: `src/engine/`, `src/effects/`, `src/plugins/`, and `src/utils/` contain **zero DOM-framework or Electron dependencies**, enabling fast execution in Node unit/perf tests, Web Workers, and renderer threads alike.

---

## 5. `.prex` Project File Format Design

PreEffects introduces the open **`.prex`** project format designed for speed, forward/backward schema compatibility, offline portability, and clean Git version control:

1. **JSON Manifest Mode (`.prex` UTF-8 JSON)**:
   - Deterministic key ordering and stable entity UUIDs (`comp_*`, `lyr_*`, `fx_*`, `asset_*`).
   - Explicit `schemaVersion: "1.0.0"` with migration hooks (`migrateProject(raw)`).
   - Embedded small assets (procedural plates, LUTs, vector shapes, audio snippets) via compact Data-URI or relative path `./assets/<filename>` so projects remain 100% git-diffable and human-inspectable.
2. **Packaged Bundle Mode (Collect Files)**:
   - Self-contained directory or archive containing `project.prex`, `assets/`, `fonts/`, `luts/`, and `ProjectReport.txt`.

---

## 6. Platform-Specific Considerations

| Platform | GPU Backend | Shortcuts & Menus | Packaging & Distribution | Local User Data Path |
|---|---|---|---|---|
| **macOS** (`arm64` + `x64`) | ANGLE over Apple Metal | Native top macOS Menu Bar; `Cmd` (`⌘`) + `Option` (`⌥`) modifiers | Universal `.dmg` + `.zip` with Hardened Runtime entitlements (`entitlements.mac.plist`) | `~/Library/Application Support/PreEffects` |
| **Windows** (`x64` + `arm64`) | ANGLE over Direct3D 11 | Custom studio menu bar; `Ctrl` + `Alt` modifiers; `.prex` Explorer association | NSIS `.exe` installer + `.msi` + Portable mode (`portable.flag`) | `%APPDATA%\PreEffects` |
| **Linux** (`x64` + `arm64`) | ANGLE over Vulkan / OpenGL | Custom studio menu bar; X11 & Wayland ozone flags; `.desktop` MIME registration | `.AppImage`, `.deb`, `.rpm`, and Flatpak (`dev.preeffects.PreEffects.yml`) | `~/.config/PreEffects` & `~/.cache/PreEffects` |
