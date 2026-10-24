# Library & Dependency Evaluation Matrix

**Document ID:** `PRE-RES-003`  
**Stage:** Stage 3 — Research  

---

## 1. Dependency Selection Philosophy

Every dependency in PreEffects must satisfy four strict gates:
1. **Permissive Open-Source License** compatible with MIT distribution (`MIT`, `ISC`, `BSD-2/3`, `Apache-2.0`, `OFL-1.1` for fonts — zero copyleft contamination unless optional external OS binary).
2. **100% Offline Operation** — zero runtime CDN calls, zero analytics SDKs, zero cloud APIs.
3. **Zero Native `node-gyp` Compilation Fragility** — builds cleanly across macOS (`arm64`/`x64`), Windows (`x64`/`arm64`), and Linux (`x64`/`arm64`).
4. **Minimal Bundle Footprint** — custom high-performance TypeScript engines preferred over bloated generic wrapper libraries.

---

## 2. Evaluated & Selected Dependencies

| Domain | Selected Package / Approach | Version | License | Alternatives Considered | Justification & Benchmark Notes |
|---|---|---|---|---|---|
| **Desktop Shell** | `electron` | `^33.3.1` | MIT | Tauri, Qt/C++ | Guarantees identical Chromium WebGL2, WebAudio, WebCodecs, and V8 JIT behaviour across macOS, Windows, and Linux. |
| **Desktop Packager** | `electron-builder` | `^25.1.8` | MIT | Electron Forge | Mature single-config support for `.dmg`, `.zip`, NSIS `.exe`, `.msi`, `.AppImage`, `.deb`, and `.rpm`. |
| **UI Component Tree** | `react` + `react-dom` | `^18.3.1` | MIT | Vue, Svelte, Custom DOM | Concurrent rendering transitions keep dockable studio panels responsive while `<canvas>` viewports run imperative 60fps loops outside React reconciliation. |
| **Language & Type Safety** | `typescript` | `^5.7.2` | Apache-2.0 | JSDoc JS | Strict null checks and discriminated unions across 11 layer types, 179+ effects, and `.prex` schema prevent runtime class errors. |
| **Bundler & Dev Server** | `vite` + `esbuild` | `^6.0.7` / `^0.24.2` | MIT | Webpack, Rollup | `< 350 ms` cold bundle build; instant HMR; tree-shaken production assets. |
| **Offline Studio Typography** | `@fontsource/inter` + `@fontsource/jetbrains-mono` | `^5.x` | OFL-1.1 | Google Fonts CDN (Rejected: violates offline rule) | Bundles WOFF2 fonts directly inside local application `asar` archive with zero network requests. |
| **Compositing, Shaders, Bezier, Color, Codecs, Tracking** | **Custom First-Party Engine (`src/engine/`, `src/effects/`)** | `1.0.0` | MIT | PixiJS, Three.js, Anime.js | Custom TypedArray + WebGL2 engine eliminates ~1.4 MB of unused game-engine overhead and gives exact AE-compatible blend modes, track mattes, shutter motion blur, and deterministic headless testing. |
| **Test & Benchmark Runner** | `vitest` | `^2.1.8` | MIT | Jest, Mocha | Native TypeScript ESM support, fast parallel worker execution, and built-in precision timing for Stage 9/12/14 benchmarks. |
| **Build-Time SVG/Icon Rasterizer** | `@resvg/resvg-js` (dev-only) | `^2.6.2` | MPL-2.0 (dev tool only, not shipped in app binary) | ImageMagick, Inkscape | Generates crisp multi-resolution `.png` desktop icons (`16px`..`1024px`) and high-fidelity documentation mockups during build. |

---

## 3. License Audit Summary

- **Runtime Shipped Dependencies**: `react` (MIT), `react-dom` (MIT), `electron` (MIT), `@fontsource/inter` (OFL-1.1), `@fontsource/jetbrains-mono` (OFL-1.1).
- **Result**: **100% permissive & MIT-compatible**, zero proprietary SDKs, zero network/telemetry modules.

---

## 4. Fallback Matrix

| Subsystem | Primary Path | Automatic Fallback Path |
|---|---|---|
| **Viewport & Effect Rendering** | WebGL2 Hardware Shader Compositor | Pooled `Float32Array` / `Uint8ClampedArray` Software Compositor |
| **Video Container Encoding** | System `ffmpeg` (Electron Main) / Chromium `MediaRecorder` & `WebCodecs` | Built-in Pure-TS `AVI`, `Animated GIF`, `PNG/TGA/PPM/EXR Sequence`, and `WAV` Encoders |
| **Local Project & Cache Storage** | Native Node `fs/promises` (`~/.config/PreEffects` / `.prex` files) | Browser `IndexedDB` + File System Access / Blob `.prex` Download & Upload |
| **Audio Engine** | `AudioContext` / `OfflineAudioContext` Real-Time DSP | Deterministic PCM `Float32Array` Biquad/Delay/Reverb Software Mixer |
