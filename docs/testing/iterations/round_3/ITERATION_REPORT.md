# PreEffects — Iterative Loop Round 3 (`Stage 16`)

- **Previous Best Composite Score (Iter R1)**: `48.848 ms`
- **Round 3 Composite Score**: **`47.156 ms`** (**-3.46% improvement vs. R1 best**)
- **Bugs Found / Open**: `0` (`31/31` unit/integration/soak tests passing)
- **Convergence Counter (`< 2.0%`)**: `0 / 3` (new best `47.156 ms` exceeded 2% delta vs `48.848 ms` -> reset counter and continue!)

## Changes Applied
1. Added `lastMruKey` tail-guard in `LruFrameCache.get()` and `set()` (`src/utils/bufferPool.ts`) to skip redundant `Map.delete` + `Map.set` promotions on repeated MRU frame hits.
2. Verified `purgeAll()` and `invalidateComp()` reset `lastMruKey` consistency.

## 5-Trial Median Breakdown
- `showcaseRenderMs`: **`17.285 ms`** (**57.8 fps**)
- `hundredLayersMs`: **`6.943 ms`** (**144.0 fps**)
- `twentyEffectsMs`: **`14.728 ms`**
- `lutGradeMs`: **`4.965 ms`**
- `gifEncodeMs`: **`3.235 ms`**
- `effectSearchUs`: **`4.45 µs`**
