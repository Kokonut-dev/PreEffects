# PreEffects — Stage 13: Bug Fixes Round 2 & High-Load Soak Verification

- **Document ID**: `PRE-BUGFIX-R2`
- **Stage**: 13 (Bug Fixes Round 2)
- **Regression & Soak Suite**: `tests/unit/stress_r2.test.ts` (`BUG-R2-01` .. `BUG-R2-05`)

---

## Resolved Round 2 Defects & Hardening

1. **`BUG-R2-01` (`src/engine/audio.ts`) — Degenerate Audio Duration, Sample Rate, and BPM Guards**:
   - Clamped `durationSec >= 0`, `sampleRate >= 1000`, and `bpm >= 1` in `generateSynthAudioBuffer`, preventing `RangeError: Invalid typed array length` on negative durations and `NaN` beat phases on `bpm = 0`.
2. **`BUG-R2-02` (`src/engine/masksAndRoto.ts`) — Exact Ray-Casting Divisor & Pooled Feathered Mask Buffers**:
   - Removed the artificial `+ 1e-9` denominator offset in `pointInPolygon` (which could cancel `yj - yi = -1e-9` to `0`) since `(yi > py) !== (yj > py)` mathematically guarantees `yj !== yi`, and migrated `maskRgba`/`blurred`/`scratch` buffers onto `globalBufferPool`.
3. **`BUG-R2-03` (`src/engine/nodeGraph.ts`) — Kahn's Algorithm DAG Cycle Validator (`validateAndSortNodeGraph`)**:
   - Added topological sorting and cycle detection for custom parallel `branch-effect` node wires so cyclic node connections are detected deterministically.
4. **`BUG-R2-04` (`src/plugins/sdk.ts`) — Multi-Language Automation Script Loop Watchdog**:
   - Injected a 25,000-iteration watchdog (`__scriptOps`) into `executeStudioScript` across JavaScript, Lua-subset, and Python-subset scripts so user scripts with accidental infinite loops return `{ ok: false, error: 'Script loop limit exceeded' }` instead of hanging the Studio UI.
5. **`BUG-R2-05` (`tests/unit/stress_r2.test.ts`) — 150-Layer Mixed-Type + 500-Asset Soak Test**:
   - Verified 150 simultaneous mixed `solid`/`shape`/`text` layers + 500 project bin assets (including missing-asset SMPTE bars) composite cleanly with `0` expression errors and bounded buffer reuse.
