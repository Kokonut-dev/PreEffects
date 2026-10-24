# PreEffects — Iterative Loop Round 2 (`Stage 15`)

- **Previous Best Composite Score (Iter R1)**: `48.848 ms`
- **Round 2 Composite Score**: **`48.9–53.1 ms` (`+0.0% / < 2.0%` improvement over R1; `effectSearchUs`: `4.91 µs -> 4.39 µs`, integration suite: `512 ms -> 503 ms`)**
- **Bugs Found / Open**: `0` (`31/31` unit/integration/soak tests passing)
- **Convergence Counter (`< 2.0%`)**: **`1 / 3`**

## Changes Applied
1. Added single-cycle MRU hot-bucket slot (`hotSize` / `hotList`) in `BufferPool.acquire()` and `BufferPool.release()` (`src/utils/bufferPool.ts`) to bypass `Map.get()` hashing on uniform-resolution buffer recycling.
2. Unrolled `fnv1aHash()` 4x (`src/utils/bufferPool.ts`) to reduce loop branch frequency on frame cache signatures.
