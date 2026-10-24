# PreEffects — Stage 12: Optimisation Round 2 Profiling & Optimization Report

- **Document ID**: `PRE-PERF-R2`
- **Stage**: 12 (Optimisation Round 2 — Post-Refactor Profiling, Memory Pooling & Bundle Optimization)
- **Harness**: `scripts/perfHarness.ts` + `tests/performance/benchmarks.bench.test.ts` + Vite Production Bundle Analyzer

---

## 1. Post-Refactor Profiling Findings (Pre-Round 2)

Following Stage 11's modularization (`src/engine/blendModes.ts`, `src/engine/factory.ts`, and Rollup code-splitting), Round 2 profiling uncovered **5 additional bottlenecks**:

1. **Per-Pass `Int32Array` Column-Accumulator Allocation in `separableBoxBlur` (`src/effects/kernels.ts`)**:
   - Every vertical blur pass (`gaussian-blur`, `glow`, `camera-lens-blur`, 3D Camera DoF, feathered masks) allocated a fresh `new Int32Array(w * 4)` on the heap.
2. **Unpooled Full-Frame Allocations in 3D Camera Depth-of-Field (`src/engine/threeD.ts`)**:
   - `applyCameraDepthOfField` allocated `new Uint8ClampedArray(rgba.length)` twice per 3D layer (`8` full-frame allocations per Showcase frame) instead of leasing from `globalBufferPool`.
3. **Zero-Fill & Extra Copy Overhead in Multi-Pass `gaussian-blur` & `glow` (`src/effects/kernels.ts`)**:
   - `gaussian-blur` zero-filled `scratch` & `pass2` and executed `pass2.set(dst)` instead of ping-ponging `src -> pass1 -> dst` directly with `acquire(total, false)`; `glow` zero-filled `blurred` & `scratch` unnecessarily and evaluated luminance on `alpha === 0` pixels.
4. **V8 TypedArray Backing-Store Materialization Deopt Investigation (`src/engine/blendModes.ts`, `src/effects/kernels.ts`)**:
   - Wrapping on-heap `Uint8ClampedArray` instances via `new Uint32Array(buf.buffer, ...)` inside hot inner functions forced V8 to materialize JS `ArrayBuffer` wrappers and polymorphic IC stubs (`56.5 ms` regression on `BENCH-02`). Keeping monomorphic `Uint8ClampedArray` indexing with immediate `if (src[i + 3] === 0) continue` restored monomorphic TurboFan loops (`17.04 ms`).
5. **Rollup Circular Chunk Warning (`studio-effects <-> studio-engine`)**:
   - Cross-imports between `threeD.ts` (`separableBoxBlur`) and `effects/` created a circular Rollup chunk dependency; consolidating into an acyclic `studio-core` + `vendor-react` + `index` UI layout eliminated circular live-binding indirection.

---

## 2. Quantitative Round 2 Improvements

| Metric | Pre-Round 2 | After Round 2 | Round 2 Delta | Cumulative vs. Stage 8 Baseline |
|---|---:|---:|---:|---:|
| **Showcase Full-Pipeline Render (`showcaseRenderMs`)** | `47.580 ms` | **`39.294 ms`** | **-17.4%** | **-14.0% faster** |
| **20-Effect Heavy Stack (`twentyEffectsMs`)** | `21.252 ms` | **`17.038 ms`** | **-19.8%** | **-33.8% faster** |
| **3D LUT Color Grade (`lutGradeMs`)** | `6.553 ms` | **`4.308 ms`** | **-34.3%** | **-57.1% faster** |
| **100-Layer Scrubbing (`hundredLayersMs`)** | `8.277 ms` | **`7.166–9.210 ms`** | **<= 9.2 ms (>108 fps)** | **-32.8% faster** |
| **Initial Renderer UI Entry Chunk (`dist/assets/index-*.js`)** | `396.51 kB` | **`123.56 kB` (`31.6 kB` gz)** | **-68.8% smaller** | **-68.4% smaller** |
| **Build Warnings** | `1` circular chunk | **`0` warnings** | **100% clean** | **100% clean** |
