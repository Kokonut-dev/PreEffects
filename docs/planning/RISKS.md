# PreEffects — Risk Assessment & Mitigation Matrix

**Document ID:** `PRE-PLAN-005`  
**Stage:** Stage 1 — Planning  

---

## 1. Technical & Architectural Risks

| ID | Risk | Likelihood | Impact | Mitigation Strategy |
|---|---|---|---|---|
| **R-01** | **GPU Driver / Headless Environment Unavailable**: Users on virtual machines, older Linux drivers, or CI runners may lack WebGL2 acceleration. | Medium | High | Implement a dual-backend architecture: WebGL2 hardware acceleration for real-time interactive rendering PLUS a complete, deterministic `Float32Array` / `Uint8ClampedArray` software rasterizer supporting all 145 effects and 38 blend modes. Automatic runtime fallback ensures zero crashes. |
| **R-02** | **Infinite Loops or Malicious Code in User Expressions / Plugins**: A `while(true)` expression or rogue plugin could freeze the UI thread. | High | Critical | Compile expressions with loop-iteration guards, strict scope isolation (blocking `window`, `document`, `fetch`, `process`, `eval`), deterministic timeouts, and per-property error quarantine that falls back to the keyframed `value` with a clear diagnostic banner. |
| **R-03** | **Video Codec Licensing & Missing System Binaries**: Patent-encumbered codecs or missing `ffmpeg` on clean consumer machines could block rendering. | Medium | High | Layer the export pipeline: (1) Native browser/Chromium `WebCodecs` & `MediaRecorder` (`MP4`/`WebM`), (2) Built-in zero-dependency encoders for `WAV`, `Animated GIF`, `PNG/TGA/PPM/EXR` frame sequences, and uncompressed `AVI`, plus (3) Seamless Electron child-process bridge to system `ffmpeg` when present for `ProRes 4444`, `DNxHR`, and `H.265`. |
| **R-04** | **Bidirectional Layer <-> Node Graph Divergence**: Editing a node graph topology could create structures hard to represent in a linear layer stack. | Medium | Medium | Model the composition graph with canonical Layer Nodes + Auxiliary Branch Effect Nodes (`EXCEED-06`). Linear effect chains map 1:1 to timeline layer effect stacks; parallel branches collapse cleanly as grouped sub-nodes inside Effect Controls while remaining fully editable in Node View. |
| **R-05** | **Cross-Platform Path & Shortcut Discrepancies**: Backslashes on Windows vs POSIX paths in `.prex` files; `Cmd` on macOS vs `Ctrl` on Windows/Linux. | Medium | Medium | Normalize all internal `.prex` asset paths to forward-slash relative POSIX paths at serialization time; resolve OS paths only in the Electron main boundary; abstract shortcuts with a `Mod` token (`Meta` on macOS, `Ctrl` on Win/Linux). |

---

## 2. Performance & Memory Risks

| ID | Risk | Likelihood | Impact | Mitigation Strategy |
|---|---|---|---|---|
| **R-06** | **Timeline Lag with 100+ Layers & Thousands of Keyframes**: DOM thrashing if every off-screen track and keyframe diamond renders simultaneously. | High | High | Viewport-virtualize timeline rows (`scrollTop` windowing) and render dense keyframe tracks / audio waveforms / graph curves onto high-DPI `<canvas>` layers with spatial index hit-testing (`O(log N)`). |
| **R-07** | **Unbounded RAM Consumption During Preview Caching**: Caching uncompressed 4K RGBA frames (`33 MB/frame`) quickly exhausts system RAM. | High | Critical | Enforce a strict byte-budgeted **LRU Frame Cache** (configurable in Preferences, default 512–1024 MB) with reusable pooled `Uint8ClampedArray` buffers, selective cache invalidation on dirty layer hash changes, and instant Purge Cache action. |
| **R-08** | **Slow Heavy Multi-Pass Effects During Scrubbing**: Stacking Camera Lens Blur + Shatter + AI Denoise + Motion Blur at 4K could drop below 60fps during rapid mouse scrubbing. | High | Medium | Implement **Adaptive Scrub Resolution** (automatically steps down to Half/Quarter resolution while pointer is actively dragging playhead, then refines to Full resolution within 120ms of scrub release) plus per-effect cost badges in the Performance Profiler. |
| **R-09** | **Startup Time Exceeding 5 Seconds**: Eagerly initializing all 145 effect presets, sample assets, and secondary dialogs at boot. | Low | Medium | Keep core boot synchronous only for shell + active workspace; lazy-initialize secondary modal editors, LUT tables, and disk cache indices asynchronously after first paint (`< 1.0s` target). |

---

## 3. Scope & Quality Risks

| ID | Risk | Likelihood | Impact | Mitigation Strategy |
|---|---|---|---|---|
| **R-10** | **Stubbed or Superficial Effects**: With 140+ effects, a naive build might leave effects as UI-only placeholders. | Medium | Critical | Enforce parameterized kernel architecture in `src/effects/`: every registered effect MUST provide an executable pixel/audio/channel processor verified by automated unit tests in `tests/unit/effects.test.ts` proving distinct non-noop pixel output. |
| **R-11** | **"AI-Generated Prototype" Aesthetic**: Generic rounded cards, purple-blue gradients, inconsistent icons, or blank panels. | Medium | High | Establish strict `DESIGN_SYSTEM.md` in Stage 2 & Stage 4 using authentic dark post-production neutral grays (`#111317`–`#242933`), warm Tungsten Amber (`#E89B3C`) & Cyan (`#38BDF8`) functional highlights, tabular monospace readouts, custom 1.5px crisp vector icons, and visually inspect rendered PNG mockups & UI views. |
