# PreEffects

**Professional, Offline-First Motion Graphics & Visual Effects Workstation for macOS, Windows, and Linux**

[![License: MIT](https://img.shields.io/badge/License-MIT-E89B3C.svg)](./LICENSE)
[![CI Build & Test](https://github.com/Kokonut-dev/PreEffects/actions/workflows/ci.yml/badge.svg)](./.github/workflows/ci.yml)
[![Cross-Platform Release](https://github.com/Kokonut-dev/PreEffects/actions/workflows/release.yml/badge.svg)](./.github/workflows/release.yml)

**PreEffects** is an open-source, studio-grade desktop compositing, motion design, animation, and visual effects application engineered to match and exceed Adobe After Effects. It runs **100% offline**, requires **zero sign-in or accounts**, transmits **zero telemetry**, and stores every project, preset, cache, and version history snapshot **exclusively on your local machine**.

---

## Feature Summary

### Complete Studio Motion Graphics & VFX Pipeline
- **Timeline & Nested Compositions**: Unlimited nested pre-compositions, multi-tab timelines, inline pre-comp breadcrumbs, shy/solo/lock/guide/adjustment switches, parenting & pick-whips, track mattes (Alpha/Luma + Inverted), all 38 blending modes, time remapping, time stretch, frame blending, multi-sample shutter motion blur, and composition/layer markers.
- **All 11 Layer Types**: Solid, Shape (hierarchical groups, paths, fills, gradients, trim paths, repeater, offset, round corners, pucker & bloat, wiggle, zig zag, boolean merge), Text (point/paragraph, full typography, path text, per-character 3D, range/wiggly/expression animators), Null, Camera (1-node & 2-node with real-world focal lengths and Depth of Field), Light (Point, Spot, Parallel, Ambient with shadow casting), Audio, Footage (video/image/PSD/3D/sequences), Pre-Comp, Adjustment, and Guide layers.
- **186 GPU/CPU Built-In Effects Across 19 Categories**: Blur & Sharpen, Colour Correction (Curves, Levels, Lumetri-grade Wheels, Hue/Sat, LUTs, ACES/Linear), Distort, Generate, Keying (Chroma/Keylight, Spill Suppressor, Luma Key), Matte, Noise & Grain (Fractal & Turbulent Noise), Perspective, Simulation (Particles, Shatter, Caustics, Wave World), Stylize (Glow, Motion Tile, Halftone, Emboss, Cartoon), Text, Time, Transition, Utility, Audio DSP, Immersive VR, 3D Channel, Expression Controls, and Local AI/Procedural effects.
- **Precision Keyframing & Unified Graph Editor**: Linear, Bezier, Auto-Bezier, Continuous Bezier, Hold, and Roving Spatial keyframes; interactive Value & Speed graphs with cubic Bezier tangent handles; spatial motion paths in viewport; Easy Ease presets; Smoother, Wiggler, Motion Sketch, and Audio-to-Keyframes.
- **Sandboxed Expression & Multi-Language Scripting Engine**: Full AE-compatible JavaScript expression engine (`wiggle`, `linear`, `ease`, `loopOut`, `posterizeTime`, `seedRandom`, `thisComp.layer()`, vector math, expression controls, pick-whip) plus automation scripting in **JavaScript, Python syntax, and Lua syntax**.
- **Masking, Local AI Rotoscoping, Tracking & Paint**: Multi-mode Bezier masks with variable per-point feathering, local edge-aware AI Roto Brush & Refine Edge, 1/2/4-Point Tracker, Planar Homography Tracker, 3D Camera Tracker, Warp Stabilizer, Face Tracker, Content-Aware Fill, and timeline-recorded Brush/Clone/Eraser paint strokes.
- **3D Compositing & Extrusion**: 3D layer transforms, multi-light PBR/Phong shading, shadow mapping, depth of field, OBJ/glTF 3D mesh import, and 3D text/shape extrusion.
- **Render Queue & Broadcast Scopes**: Multi-module Render Queue (MP4/H.264, WebM/VP9, MOV/ProRes via FFmpeg, GIF, WAV, PNG/TGA/PPM/EXR frame sequences, multi-pass Depth/Normal/ID buffers), real-time Histogram, RGB Parade, Waveform Monitor, and Vectorscope.

### Beyond Adobe After Effects
1. **Bidirectional Layer <-> Node Graph Compositor**: Switch seamlessly between classic timeline layers and a Nuke/Fusion-style DAG node editor with live synchronization.
2. **100% Local AI Suite**: Edge-aware Roto Matting, Super-Resolution Upscaling, Optical-Flow Frame Interpolation, and Spatio-Temporal Denoising — zero cloud dependencies.
3. **Real-Time Per-Effect Performance Profiler**: Millisecond flame breakdown per layer and per effect directly in the workspace.
4. **Snapshot A/B Split-Wipe Viewer**: Compare look-dev iterations interactively with an on-canvas wipe divider.
5. **Deterministic `.prex` Project Format + Local Version Control**: Human-diffable JSON manifest + binary asset pack with built-in snapshot commit/diff/restore history.
6. **Procedural Generation Studio**: L-Systems, Reaction-Diffusion, Worley/Fractal textures, and custom emitter rigs.
7. **Built-In Screen Recorder, Smart Adaptive Presets, Local Asset Library, Command Palette (`Ctrl/Cmd+K`), and Full Keyboard/Screen-Reader Accessibility**.

---

## Installation

PreEffects requires **no account, no license key, and no internet connection**.

### macOS (Apple Silicon & Intel — macOS 12 Monterey or newer)
1. Download `PreEffects-<version>-universal.dmg` from [GitHub Releases](https://github.com/Kokonut-dev/PreEffects/releases).
2. Open the `.dmg` archive and drag **PreEffects.app** to `/Applications`.
3. Launch **PreEffects** — all preferences and caches are created locally under `~/Library/Application Support/PreEffects`.

### Windows (x64 & ARM64 — Windows 10 / 11)
1. Download `PreEffects-Setup-<version>.exe` (NSIS installer) or `PreEffects-<version>.msi` from [GitHub Releases](https://github.com/Kokonut-dev/PreEffects/releases).
2. Run the installer and launch **PreEffects** from the Start Menu or Desktop shortcut.
3. Portable mode is also supported: place a `portable.flag` file beside `PreEffects.exe` to store all user data in `./user-data/`.

### Linux (x64 & ARM64 — Ubuntu 22.04+, Fedora 39+, Arch, Debian 12+)
- **AppImage (Universal)**:
  ```bash
  chmod +x PreEffects-<version>-x86_64.AppImage
  ./PreEffects-<version>-x86_64.AppImage
  ```
- **Debian / Ubuntu (`.deb`)**:
  ```bash
  sudo apt install ./preeffects_<version>_amd64.deb
  ```
- **Fedora / RHEL (`.rpm`)**:
  ```bash
  sudo dnf install ./preeffects-<version>.x86_64.rpm
  ```
- **Flatpak**:
  ```bash
  flatpak-builder --user --install --force-clean build-dir build/linux/dev.preeffects.PreEffects.yml
  ```

---

## Building from Source

### Prerequisites
- **Node.js** `>= 20.0.0` (LTS v22 recommended) and **npm** `>= 10.0.0`
- *(Optional)* System `ffmpeg` in `PATH` for hardware-accelerated ProRes / DNxHR / H.265 container muxing (built-in codecs work out of the box without external tools)

### Quick Start
```bash
# 1. Clone the repository
git clone https://github.com/Kokonut-dev/PreEffects.git
cd PreEffects

# 2. Install dependencies
npm install

# 3. Run the interactive studio in development mode (Renderer + Engine)
npm run dev

# 4. Launch full desktop Electron shell in development mode
npm run dev:electron

# 5. Run unit, integration, and performance test suites
npm test
npm run test:perf

# 6. Build production bundles and package native desktop installers
npm run build
npm run package:mac     # Produces .dmg and .zip in release/
npm run package:win     # Produces .exe (NSIS) and .msi in release/
npm run package:linux   # Produces .AppImage, .deb, and .rpm in release/
```

---

## Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Desktop Shell** | Electron + Preload Context Isolation | Native cross-platform windowing, OS menus, local file system, crash recovery, FFmpeg bridge |
| **UI & Studio Shell** | React 18 + TypeScript 5 (Strict) + Custom CSS Design Tokens | Dockable high-density studio panels, custom vector iconography, zero-latency scrubbing |
| **Compositing Engine** | WebGL2 Shader Pipeline + Deterministic Float32/Uint8 CPU Fallback | Multi-layer alpha/track-matte compositing, 38 blend modes, 3D camera projection, 140+ effects |
| **Animation & Expressions** | Custom Cubic Bezier Solver + Sandboxed JS/Python/Lua Expression Runtime | Temporal/spatial interpolation, unified Value/Speed graphs, safe sub-millisecond expressions |
| **Audio & Media Pipeline** | WebAudio DSP Graph + WebCodecs / MediaRecorder + Native WAV/Sequence/FFmpeg | Real-time waveform scrubbing, parametric audio effects, multi-format local rendering |
| **Storage & Persistence** | `.prex` Local Project Format + IndexedDB / Local FS Auto-Save + LRU Cache | 100% offline local storage, version snapshots, crash recovery |
| **Quality Assurance** | Vitest + Benchmark Suite + TypeScript Strict Compiler + ESLint | Automated unit, integration, regression, and 60fps performance verification |

---

## Repository Structure

```text
PreEffects/
├── docs/
│   ├── planning/          # PRD, Feature Inventory, Architecture, Roadmap, Risks
│   ├── research/          # Competitive Analysis, Technical Research, Dependencies, UX Research
│   ├── mockups/           # Design Systems (v1 & v2), Wireframes, Hi-Fi Mockups, Clickable Prototype
│   ├── architecture/      # Finalized Architecture v2 & Plugin SDK v1.0 specs
│   ├── testing/           # Feature Audit, Test Plan, Code Review, Profiling & Iteration Rounds
│   └── CONTRIBUTING.md    # Developer & contributor handbook
├── src/
│   ├── main/              # Electron main process, native menus, IPC, disk cache, FFmpeg & FS handlers
│   ├── renderer/          # Studio UI panels, workspaces, dialogs, graph/node editors, scopes
│   ├── engine/            # Compositing, animation, expressions, masks, text, shapes, 3D, tracking, paint, audio
│   ├── plugins/           # Sandboxed Plugin SDK & multi-language scripting engines
│   ├── effects/           # 140+ built-in GPU/CPU effects & adaptive presets
│   ├── poc/               # Stage 5 technical proof-of-concept validations
│   ├── utils/             # Math, color science, bezier curves, undo/redo history, shortcuts, serialization
│   └── assets/            # Original vector icon pack, app branding, templates, LUTs
├── tests/
│   ├── unit/              # Engine, effects, expressions, masks, shapes, serialization tests
│   ├── integration/       # End-to-end project lifecycle, node-layer sync, render queue tests
│   └── performance/       # 100-layer scrubbing, 4K effect stack, 500-asset search benchmarks
├── build/                 # macOS, Windows, and Linux packaging configurations & manifests
├── scripts/               # Build, packaging, benchmark, icon rendering, and board scripts
└── .github/workflows/     # Multi-OS CI/CD testing and release packaging pipelines
```

---

## Privacy & Offline Guarantee

- **Zero Accounts**: Never prompts for login, registration, email, or cloud sync.
- **Zero Telemetry**: Strict Content-Security-Policy (`connect-src 'none'` in production builds) blocks all outbound network requests.
- **100% Local**: Projects (`.prex`), auto-saves, caches, plugins, and custom themes live solely in user-controlled directories.

---

## Contributing

Contributions are welcome! Please read [docs/CONTRIBUTING.md](./docs/CONTRIBUTING.md) for architecture conventions, coding standards, effect authoring guides, and test requirements before opening a Pull Request.

---

## License

Distributed under the **MIT License**. See [`LICENSE`](./LICENSE) for full text.
