# PreEffects — Stage 10: Bug Fixes Round 1 Audit & Regression Report

- **Document ID**: `PRE-BUGFIX-R1`
- **Stage**: 10 (Bug Fixes Round 1)
- **Regression Suite**: `tests/unit/bugfixes_r1.test.ts` (4 multi-assertion tests covering `BUG-R1-01` .. `BUG-R1-06`)

---

## Summary of Discovered & Resolved Defects

| Bug ID | Subsystem | Root Cause | Resolution | Verification |
|---|---|---|---|---|
| **BUG-R1-01** | `src/engine/compositor.ts` | RAM Preview cache signature omitted `fx.params` values, `solidColor`, `scale`, `rotationZ`, `shapeContent`, and expression state, returning stale cached frames when editing sliders at a stationary playhead. | Expanded FNV-1a frame signature to hash transform channels, `solidColor`, `textData`, `shapeContent`, mask parameters, and all effect parameter values & expressions. | `tests/unit/bugfixes_r1.test.ts` (`BUG-R1-01`) |
| **BUG-R1-02** | `src/engine/expressions.ts` | Multi-statement After Effects expressions without an explicit `return` keyword (e.g., `posterizeTime(12); wiggle(4, 20);` and `inertialBounce`) evaluated to `undefined` and silently fell back to `baseValue`. | Implemented `injectImplicitFinalReturn()` in `compileExpression` so the final expression statement is automatically returned, matching AE's JS expression engine. | `tests/unit/bugfixes_r1.test.ts` (`BUG-R1-02`) |
| **BUG-R1-03** | `src/engine/expressions.ts` | `guardLoops` instrumented braced `while`/`for` blocks only, allowing `do { ... } while (true)` and braceless `while (true) k++;` loops to bypass the 15,000-iteration watchdog. | Extended `guardLoops` to instrument `do {` blocks and single-statement braceless `while(...)` / `for(...)` loops. | `tests/unit/bugfixes_r1.test.ts` (`BUG-R1-03`) |
| **BUG-R1-04** | `src/engine/serializer.ts` | `.prex` serialization sliced `rgbaBuffer` to `4,096` bytes while keeping original `width × height`, leaving deserialized plates partially zeroed; `parseObjMesh` discarded negative relative Wavefront `.OBJ` face indices (`f -4 -3 -2 -1`). | Preserved intact embedded RGBA buffers up to 256 KB (validating byte length on load) and resolved negative `.OBJ` indices relative to `vertices.length`. | `tests/unit/bugfixes_r1.test.ts` (`BUG-R1-04`) |
| **BUG-R1-05** | `src/engine/compositor.ts` | Degenerate `comp.fps = 0` produced `Infinity`/`NaN` motion-blur sub-times; cyclic precomp pairs (`CompA <-> CompB`) expanded exponentially to `nestDepth=6`; self-referencing `trackMatteLayerId === layer.id` re-evaluated the layer as its own matte. | Added `safeFps` clamp, `visitedComps: Set<string>` cycle breaker, and `layer.trackMatteLayerId !== layer.id` guard. | `tests/unit/bugfixes_r1.test.ts` (`BUG-R1-05`) |
| **BUG-R1-06** | `src/engine/serializer.ts` | `parseDelimitedData` split CSV lines naively on `,`, corrupting quoted strings containing commas or escaped `""` quotes (e.g., `"Amsterdam, NL"`). | Implemented RFC-4180 quote-aware `splitDelimitedLine()`. | `tests/unit/bugfixes_r1.test.ts` (`BUG-R1-06`) |
