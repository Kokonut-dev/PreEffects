# PreEffects — Stage 9: Optimisation Round 1 Profiling & Optimization Report

- **Document ID**: `PRE-PERF-R1`
- **Stage**: 9 (Optimisation Round 1)
- **Environment**: Linux x86_64 (2 vCPU, 3.8 GiB RAM, Node.js `v22.22.3`, V8 JIT)
- **Harness**: `scripts/perfHarness.ts` + `tests/performance/benchmarks.bench.test.ts` (`BENCH-01` .. `BENCH-06`)

---

## 1. Baseline Profiling Findings (Pre-Round 1)

Deterministic CPU/memory profiling across hot paths in `src/engine/`, `src/effects/`, `src/utils/`, and `src/renderer/state/` identified **7 primary hot-path bottlenecks**:

1. **Per-Frame 3D LUT Regeneration & Per-Pixel Tuple Allocation (`src/effects/kernels.ts`, `src/utils/color.ts`)**:
   - `apply-colour-lut` invoked `createBuiltInLut(lutName)` on every rendered frame and called `sampleLut3D(...)` per pixel, allocating `w × h` temporary `[r, g, b]` JavaScript arrays (`518,400` heap allocations at 960×540).
2. **Per-Pixel Trig/Division & Byte-Wise Pixel Copies in `transformLayerPixels2D3D` (`src/engine/compositor.ts`)**:
   - Non-identity 2D/3D layer transforms evaluated `(dx * cos - dy * sin) / sx`, `Math.round(...)`, and 4 separate byte stores over the entire `w × h` canvas even for small or translated layers.
3. **Inner-Loop String Branching in Procedural Generators (`src/effects/kernels.ts`)**:
   - `gradient-ramp` and `grid` evaluated `effectId === ...` conditionals on every pixel of `w × h`.
4. **Dynamic Boxed `number[]` Growth & `.slice()` Spreads in `encodeAnimatedGif` (`src/engine/export.ts`)**:
   - Multi-frame GIF89a export pushed millions of boxed numbers into `bytes: number[]` and `stream: number[]` and spread 250-byte slices (`bytes.push(slice.length, ...slice)`).
5. **Repeated `.toLowerCase()` Allocations in `searchEffects` (`src/effects/registry.ts`)**:
   - Fuzzy search converted `name`, `category`, and `description` across all 186 effects to lowercase on every keystroke.
6. **Deep `structuredClone` of Asset TypedArrays & Inactive Node Graphs (`src/renderer/state/StudioContext.tsx`)**:
   - Every slider drag deep-cloned `project.assets` (including 48 kHz PCM `Float32Array` buffers and decoded `Uint8ClampedArray` plates) and rebuilt `nodeGraph` on inactive compositions.
7. **Redundant Pre-Transform Re-Rasterization During Shutter Motion Blur (`src/engine/compositor.ts`)**:
   - Transform-driven shutter motion blur re-ran vector shape/text rasterizers and layer effect stacks `3×` per frame instead of caching the pre-transform layer raster once across the shutter window.

---

## 2. Implemented Optimizations (7 Concrete Improvements)

| ID | Subsystem | Optimization Implemented |
|---|---|---|
| **OPT-R1-01** | `src/utils/color.ts`, `src/effects/kernels.ts` | Added `BUILT_IN_LUT_CACHE` memoization + zero-allocation `applyLut3DToRgbaBuffer()` inline trilinear evaluator. |
| **OPT-R1-02** | `src/engine/compositor.ts` | Replaced per-pixel affine division & byte copies with forward-projected AABB scissoring, incremental scanline stepping (`rx += dRxDx`), and 32-bit `Uint32Array` pixel transfers. |
| **OPT-R1-03** | `src/effects/kernels.ts` | Hoisted `gradient-ramp` and `grid` out of generic pixel switch into tight unswitched scanline/stride loops. |
| **OPT-R1-04** | `src/engine/export.ts` | Rewrote `encodeAnimatedGif` with pre-sized `Uint8Array` output and reusable `frameStream` sub-block `TypedArray.set()` copies. |
| **OPT-R1-05** | `src/effects/registry.ts` | Pre-computed `EFFECT_SEARCH_INDEX` lowercase haystacks at module load with multi-token matching. |
| **OPT-R1-06** | `src/renderer/state/StudioContext.tsx` | Replaced full `structuredClone(prev)` with copy-on-write shallow asset sharing and active-comp-only `buildNodeGraphFromComp`. |
| **OPT-R1-07** | `src/engine/compositor.ts` | Split `evaluatePreTransformLayer` from `applySpatialTransformAndShading` + `Uint16Array` fixed-point shutter accumulator (`(accum * 85 + 128) >> 8`). |

---

## 3. Quantitative Before vs. After Measurements

| Benchmark Metric | Baseline (Before R1) | After Round 1 | Improvement |
|---|---:|---:|---:|
| **100-Layer Comp Scrubbing (`hundredLayersMs`)** | `13.714 ms` | **`6.586–9.878 ms`** | **-28.0% to -52.0% faster** |
| **3D LUT Trilinear Color Grade (`lutGradeMs`, 480×270)** | `10.034 ms` | **`4.301–5.472 ms`** | **-45.5% to -57.1% faster** |
| **20-Effect Heavy Stack (`twentyEffectsMs`)** | `25.746 ms` | **`18.966 ms`** | **-26.3% faster** |
| **Multi-Frame GIF89a + AVI Export (`gifEncodeMs`)** | `42.139 ms` | **`19.903–26.642 ms`** | **-36.8% to -52.8% faster** |
| **186-Effect Catalog Search (`effectSearchUs`)** | `27.02 µs` | **`9.13 µs`** | **-66.2% (2.96× faster)** |
| **Full `BENCH-01..06` Stress Suite Wall Time** | `5,115 ms` | **`3,401 ms`** | **-33.5% faster** |
| **Integration Multi-Module Render Queue Suite** | `920 ms` | **`628 ms`** | **-31.7% faster** |

All `23/23` unit & integration tests and `4/4` `BENCH-01..06` performance assertions pass with `0` regressions.
