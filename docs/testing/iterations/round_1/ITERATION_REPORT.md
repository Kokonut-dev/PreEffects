# PreEffects — Iterative Loop Round 1 (`Stage 14`)

- **Previous Composite Score**: `57.042 ms`
- **Round 1 Composite Score**: **`48.848 ms`** (**-14.36% improvement**)
- **Bugs Found / Open**: `0` (`31/31` unit/integration/soak tests passing)
- **Convergence Counter (`< 2.0%`)**: `0 / 3` (exceeded 2% threshold -> continue loop)

## Changes Applied
1. Memoized `parseHexColor()` in `HEX_COLOR_CACHE` (`src/utils/color.ts`), eliminating per-layer/per-effect `parseInt(..., 16)` string slicing across 100+ layers.
2. Reused static `sharedLut1D = new Uint8Array(256)` in `curves`/`levels`/`exposure` color transfer kernels (`src/effects/kernels.ts`).
3. Added direct 2D unparented `Mat4` affine matrix construction in `computeLayerWorldMatrix()` (`src/engine/threeD.ts`), eliminating 7 intermediate `Float32Array(16)` heap allocations per 2D layer (`700` fewer typed-array allocations per 100-layer frame).

## 5-Trial Median Breakdown
- `showcaseRenderMs`: `21.711 ms` -> **`18.101 ms`**
- `hundredLayersMs`: `8.094 ms` -> **`6.657 ms`** (**150.2 fps**)
- `twentyEffectsMs`: `17.985 ms` -> **`15.850 ms`**
- `lutGradeMs`: `5.369 ms` -> **`5.009 ms`**
- `gifEncodeMs`: `3.883 ms` -> **`3.231 ms`**
- `effectSearchUs`: `5.76 µs` -> **`4.91 µs`**
