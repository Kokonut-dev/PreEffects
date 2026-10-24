# PreEffects — Master Verification & Performance Test Plan

**Document ID:** `PRE-TEST-002`  
**Stage:** Stage 5 — Functionality Testing  

---

## 1. Unit Test Suite (`tests/unit/`)

| Test Module | Target Subsystem | Verification Scope |
|---|---|---|
| `poc.test.ts` | `src/poc/*` | Validates all 7 Stage 5 architectural Proof-of-Concept pipelines |
| `animation.test.ts` | `src/engine/animation/*` | Linear, Hold, Auto-Bezier, Continuous, Cubic Bezier Newton-Raphson accuracy, Roving arc-length, Smoother, Wiggler, Sequence Layers, Audio-to-Keyframes |
| `expressions.test.ts` | `src/engine/expressions/*` | `wiggle`, `linear`, `ease`, `loopOut`, `posterizeTime`, vector math, cross-layer/cross-comp refs, Expression Controls, infinite-loop guard, syntax error quarantine |
| `effects.test.ts` | `src/effects/*` | Verifies **all 186 registered effects** across all 19 categories execute deterministically without NaN/bounds errors and produce measurable pixel/audio output |
| `layersAndCompositor.test.ts` | `src/engine/*` | All 11 Layer Types (Solid, Shape operators, Text + Range Animators, Null, 3D Camera + Light + OBJ, Audio, Footage, Pre-comp, Adjustment, Guide), all 38 Blend Modes, Track Mattes, Masks + Variable Feather + AI Roto, Paint/Clone, Tracking |
| `serializationAndHistory.test.ts` | `src/utils/*`, `src/plugins/*` | `.prex` save/load round-trip determinism, schema migration, Version History visual diff, coalesced Undo/Redo journal, Python & Lua scripting transpilers, Plugin sandbox security |

---

## 2. Integration Test Suite (`tests/integration/`)

1. **End-to-End Studio Production Workflow**: Create multi-comp project -> Import layered SVG/PSD + CSV data + OBJ mesh + WAV audio -> Rig Text Animator + Shape Repeater + Null Slider Expression -> Pre-compose -> Toggle & edit Bidirectional Node Graph -> Verify Layer/Node state parity -> Render multi-output job (`GIF`, `WAV`, `AVI`, `PNG/PPM/EXR Sequence`, Multi-pass `Z-Depth` & `Normals`).
2. **Fault Resilience & Recovery**: Trigger missing footage fallback (verify diagnostic colour bars), malformed expression recovery, corrupt `.prex` graceful error handling, and crash-journal auto-save restoration.
3. **Colour Management & HDR Pipeline**: Verify `8-bpc`, `16-bpc`, and `32-bpc` Linear/ACEScg pipeline + `.cube` 3D LUT trilinear grading + Broadcast Scopes (`Histogram`, `Parade`, `Waveform`, `Vectorscope`) numerical accuracy.

---

## 3. Quantitative Performance Benchmark Suite (`tests/performance/`)

| Benchmark ID | Scenario | Pass Threshold (Reference Hardware: 2-vCPU Sandbox) | Stretch Goal |
|---|---|---|---|
| `BENCH-01` | **100-Layer Composition Scrubbing** (100 animated layers with keyframes, parenting, blend modes @ preview res) | **`<= 16.67 ms / frame`** (`>= 60.0 fps`) | `< 6.0 ms / frame` |
| `BENCH-02` | **Heavy 20-Effect Stack Frame Render** (Gaussian Blur + Glow + Curves + Levels + Hue/Sat + Keylight + Vignette + LUT + Fractal Noise + Sharpen...) | **`<= 45 ms`** @ HD proxy / **`<= 400 ms`** @ 4K CPU fallback (`< 16 ms` WebGL2 GPU) | `< 25 ms` HD |
| `BENCH-03` | **500-Asset Project Search, Filter & Virtualized Sort** | **`<= 5.0 ms`** per query across 500 metadata-rich assets | `< 1.0 ms` |
| `BENCH-04` | **Cold Engine & Studio Boot Time** (Registry + Default Project + Theme + Shortcuts + First Frame) | **`< 5,000 ms`** (`5.0 seconds`) | `< 500 ms` |
| `BENCH-05` | **RAM Preview Cache Hit Throughput** (LRU Framebuffer lookup & scope update) | **`<= 1.0 ms / frame`** (`>= 1,000 fps` cache replay) | `< 0.2 ms` |
| `BENCH-06` | **Memory Ceiling & Leak Soak Test** (500 consecutive frame renders + 200 Undo/Redo mutations under 128 MB LRU cap) | Bounded cache size `<= budget`; heap delta `< 32 MB` after GC | `< 8 MB` delta |

---

## 4. UI, Accessibility & Cross-Platform Test Matrix

- **UI Coverage**: Every top-bar menu action, all 13 toolbar tools, all 7 workspaces, all 27 panels, all 13 modal dialogs, Command Palette (`Ctrl/Cmd+K`), `"What's This?"` mode, Dark/Light/High-Contrast themes.
- **Cross-Platform Matrix**: Verified via `.github/workflows/ci.yml` across `ubuntu-latest`, `macos-latest`, and `windows-latest`, plus unit tests specifically validating POSIX/Windows path normalization and `Cmd` (Darwin) vs `Ctrl` (Win32/Linux) shortcut dispatch.

---

## 5. Regression Test Template (Stages 10, 13, 14+)

For every defect logged in `docs/testing/BUG_TRACKER.md`:
1. Record Issue ID, Severity, Platform, Repro Steps, Root Cause.
2. Add a permanent automated regression assertion in `tests/unit/` or `tests/integration/` that fails prior to the fix and passes after.
3. Re-run `npm run test:all && npm run typecheck && npm run build`.
