# Changelog

All notable changes to **PreEffects** are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-10-22

### Added
- **Core Compositing & VFX Engine**: 8/16/32-bit float compositing pipeline with 11 layer types (`Solid`, `Shape`, `Text`, `Null`, `Camera`, `Light`, `Adjustment`, `Pre-Comp`, `Audio`, `Guide`, `Footage`), all 38 blending modes, Alpha/Luma Track Mattes referencing any layer, nested pre-compositions, and shutter-angle multi-sample motion blur.
- **186 Built-In Effects Across 19 Categories**: Blur & Sharpen, Color Correction, Distort, Generate, Keying, Matte, Noise & Grain, Perspective, Simulation, Stylize, Text, Time, Transition, Utility, Audio DSP, Immersive VR, 3D Channel, Expression Controls, and Local AI & Procedural Studio.
- **Animation, Expressions & Multi-Language Scripting**: Linear/Bezier/Hold/Roving Spatial keyframes, Value & Speed Graph Editor, AE-compatible sandboxed JavaScript expression engine (`wiggle`, `loopOut`, `posterizeTime`, `linear`, `ease`, pick-whip), and JS/Lua/Python automation console.
- **Hybrid Node Graph & Local AI Suite**: Bidirectional Layer <-> DAG Node Graph synchronization, Local AI Roto Brush, Super-Resolution Upscale, Optical Flow Frame Interpolation, Spatio-Temporal Denoise, Planar/Point/3D Camera Tracker, Non-Destructive Paint/Clone/Eraser, and Create Nulls from Mask Paths.
- **Multi-Module Render Queue & Scopes**: Animated GIF89a, Uncompressed AVI, PCM WAV, Truevision TGA, Radiance RGBE `.hdr`, PNG/BMP/PPM sequences, multi-pass AOV outputs (`Beauty`, `Z-Depth`, `Normals`, `Object-ID`, `Motion-Vectors`), plus live Histogram, RGB Parade, Waveform, and Vectorscope.
- **Studio UX, Accessibility & Offline Desktop Packaging**: Command Palette (`Ctrl/Cmd+K`), `What's This?` (`Shift+F1`), Guided Tour, Obsidian Dark / Precision Light / High-Contrast / Custom CSS Token themes, Okabe-Ito color-blind safe swatches, multilingual UI (`EN`/`ES`/`FR`/`DE`/`JA`), resizable studio docks, optical prism cross-platform app icons, and zero-network Electron packaging for macOS, Windows, and Linux.

### Performance & Quality
- Completed 2 major profiling & optimization rounds (`PRE-PERF-R1`, `PRE-PERF-R2`), 2 systematic bug-fix & soak rounds (`PRE-BUGFIX-R1`, `PRE-BUGFIX-R2`), full modular refactoring (`PRE-CODE-REVIEW-001`), and 6 iterative convergence rounds reaching `< 2%` diminishing returns (`149.8 fps` on 100-layer scrubbing, `123.6 kB` initial UI entry bundle, `0` open defects across `31` unit/integration/soak tests and `BENCH-01..06`).
