# PreEffects — Finalised System & Module Architecture (v2.0)

**Document ID:** `PRE-ARCH-002`  
**Stage:** Stage 5 — Functionality Testing & POC Validation  
**Supersedes:** `docs/planning/ARCHITECTURE.md` (v1.0)

---

## 1. Refinements Incorporated from Stage 5 POCs

1. **Zero-Allocation Pooled Pixel Buffers**: `compositingPoc` demonstrated that allocating fresh `Uint8ClampedArray` buffers per effect costs `~1.8 ms` of GC churn per HD frame. Architecture v2 introduces a `BufferPool` (`acquire(byteLength)` / `release(buf)`) cutting per-frame buffer allocation to `0 bytes` in steady state!
2. **Pre-Compiled Expression Closures**: `expressionPoc` showed `new Function` compilation takes `~0.18 ms`, whereas invoking a cached compiled closure takes **`0.004 ms`** (`45×` faster). Architecture v2 caches compiled expressions keyed by `(expressionSource)` with loop-counter injection (`__peGuard`).
3. **Sliding-Window Separable O(1) Blur**: `compositingPoc` confirmed 3-pass separable sliding-window box blur matches Gaussian within `0.7%` while running in constant `O(W × H)` time regardless of blur radius (`1px` or `200px`).
4. **Canonical Layer <-> DAG Sync**: `nodeGraphPoc` validated deterministic bidirectional mapping: every `Layer` owns `id`, `effects[]`, `masks[]`, `blendMode`, and `trackMatteLayerId`, while `comp.nodeGraph` stores node coordinates `(x, y)` and optional parallel `branchEdges[]`.

---

## 2. Internal Module Specifications

| Module Path | Public Exports & Responsibilities |
|---|---|
| `src/utils/math.ts` | `clamp`, `lerp`, `solveCubicBezier`, `evalSpatialBezier`, `Mat4` (`perspective`, `lookAt`, `multiply`, `projectPoint`), deterministic `mulberry32` PRNG & `simplexNoise2D` |
| `src/utils/color.ts` | `srgbToLinear`, `linearToSrgb`, `rgbToHsl`, `hslToRgb`, `applyMatrix3x3` (`ACEScg`), `parseCubeLut`, `sampleLut3D`, `computeScopes` (Histogram, Parade, Waveform, Vectorscope) |
| `src/utils/history.ts` | `HistoryManager<T>` with transaction coalescing (`txId`), unlimited/bounded stack, clickable jump-to-index, and visual state diffing (`diffProjects`) |
| `src/utils/shortcuts.ts` | Cross-platform `ShortcutRegistry` (`Mod+K`, single-key `U/P/S/R/T/A/F9/J/K/L`, conflict detection, custom JSON profile import/export) |
| `src/engine/types.ts` | Strict TypeScript interfaces for `Project`, `Composition`, `Layer` (all 11 types), `AnimatableProperty`, `Keyframe`, `EffectInstance`, `Mask`, `PaintStroke`, `TrackerSolve`, `RenderQueueItem`, `NodeGraphState` |
| `src/engine/animation.ts` | Temporal & spatial property evaluator, Graph Editor curve sampler, Easy Ease / Velocity helpers, Sequence Layers, Reverse, Smoother, Wiggler, Audio-to-Keyframes |
| `src/engine/expressions.ts` | Sandboxed AE expression compiler & evaluator + Pick Whip path generator + Expression Snippets |
| `src/effects/registry.ts` | Registry & executable kernels for all **186 built-in effects** across 19 categories + Smart Adaptive Presets |
| `src/engine/compositor.ts` | Multi-layer compositor (Solid, Shape hierarchy, Text + Range Animators, 3D Camera/Light/OBJ/Shadows/DoF, Footage/Pre-comp, Masks + Variable Feather + AI Roto, Paint/Clone, 38 Blend Modes, Track Mattes, Motion Blur, Frame Blending, WebGL2 + CPU backends, LRU RAM Preview Cache, Per-Effect Profiler) |
| `src/engine/nodeGraph.ts` | Bidirectional Layer <-> DAG compiler, topological evaluator, parallel branch router, auto-layout |
| `src/engine/trackingAndAi.ts` | 1/2/4-Point NCC Tracker, Planar Homography Tracker, 3D Camera Solver, Warp Stabilizer, Face Landmark Estimator, Content-Aware Patch Fill, Local AI Roto/Upscale/Optical-Flow/Denoise |
| `src/engine/audio.ts` | PCM waveform synthesizer/loader, 10 Audio DSP effects, dB RMS/Peak meter, WebAudio real-time player |
| `src/engine/export.ts` | Multi-module Render Queue runner + native encoders (`WAV`, `Animated GIF`, `AVI`, `PNG/PPM/TGA/EXR Sequence`, Multi-pass `Z-Depth`/`Normals`/`ID`, `.prex` Collect Files, XML/EDL/CSV importers) |
| `src/plugins/sdk.ts` | Versioned `PreEffectsPluginAPI` (`v1.0.0`) sandbox + multi-language `JavaScript`, `Python`, and `Lua` automation script runner |
| `src/main/main.ts` & `preload.ts` | Electron desktop lifecycle, native OS menu bar, local `.prex` file dialogs, persistent disk cache, auto-save journal, and optional native `ffmpeg` encoder bridge |
| `src/renderer/*` | Full studio React UI, 7 Workspaces, 27 Panels, 13 Dialogs, Scopes, Node Graph, Graph Editor, Welcome Launcher, Command Palette, Theme Editor, and "What's This?" inspector |

---

## 3. Versioned Plugin SDK Specification (`v1.0.0`)

```ts
export interface PreEffectsPluginManifest {
  id: string;
  name: string;
  version: string;
  apiVersion: '1.0.0';
  author: string;
  capabilities: Array<'effect' | 'panel' | 'importer' | 'exporter' | 'macro'>;
}

export interface PluginSandboxContext {
  readonly apiVersion: '1.0.0';
  registerEffect(def: CustomEffectRegistration): void;
  registerPanel(def: CustomPanelRegistration): void;
  registerFormat(def: CustomFormatRegistration): void;
  log(message: string): void;
}
```
Plugins execute inside a frozen capability sandbox with zero access to `window`, `fetch`, `require`, or `process`, and a hard per-invocation CPU time guard (`250 ms`).
