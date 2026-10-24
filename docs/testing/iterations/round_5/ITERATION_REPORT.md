# PreEffects — Iterative Loop Round 5 (`Stage 18`)

- **Best Prior Composite Score (Iter R3)**: `47.156 ms`
- **Round 5 Composite Score**: **`53.010 ms`** (`0.0% / < 2.0%` composite delta; `gifEncodeMs` = `2.832 ms`, `effectSearchUs` = `3.81 µs`, integration suite = `494 ms`)
- **Bugs Found / Open**: `0` (`31/31` unit/integration/soak tests passing)
- **Convergence Counter (`< 2.0%`)**: **`2 / 3`**

## Changes Applied
1. Unrolled 3-tuple `[x, y, z]` interpolation in `interpolateValues()` (`src/engine/animation.ts`) to avoid `.map()` closure creation on animated 3D `position`/`scale`/`anchorPoint` keyframes.
