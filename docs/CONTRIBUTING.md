# Contributing to PreEffects

Thank you for contributing to **PreEffects** — the 100% offline, open-source (MIT) cross-platform desktop motion graphics and VFX compositing studio for **macOS**, **Windows**, and **Linux**.

---

## Core Architectural Principles (Non-Negotiable)

1. **100% Offline-First & Zero Telemetry**:
   - Never add sign-in prompts, cloud dependencies, analytics beacons, remote fonts, or license checks.
   - All features (including Local AI Roto, Upscale, Optical Flow Interpolation, and Procedural Generators) must run deterministically on the user's local machine.
2. **Engine / UI Separation**:
   - `src/engine/`, `src/effects/`, `src/plugins/`, and `src/utils/` are **pure headless TypeScript** with zero React or DOM globals required, allowing instant execution in Node.js Vitest suites and Worker threads.
   - `src/renderer/` consumes engine APIs via `StudioContext.tsx`.
3. **Zero-Allocation Hot Paths**:
   - Always acquire temporary pixel buffers via `globalBufferPool.acquire(byteLength, zeroFill)` and return them via `globalBufferPool.release(buf)` before returning.

---

## Repository Map

```text
src/
├── main/           # Electron Main process (main.ts) & ContextBridge preload (preload.ts)
├── engine/         # Compositor, Blend Modes (38), Animation/Bezier, Expressions, 3D Stage,
│                   # Vector Shapes & Text, Masks & AI Roto, Tracking & Paint, Audio, DAG, Export
├── effects/        # 186 Built-in Effects Registry (registry.ts) & Pixel Kernels (kernels.ts)
├── plugins/        # Sandboxed Plugin SDK & Multi-Language Scripting (JS / Lua-subset / Python-subset)
├── utils/          # Mat4/Bezier/Noise math, 3D LUT & Color science, BufferPool/LRU, Undo History, i18n
└── renderer/       # React 18 Studio UI, Design Tokens (Dark/Light/High-Contrast), Docks & Scopes
```

---

## Development Commands

```bash
# Install dependencies (skips external Electron binary fetch in restricted CI sandboxes if needed)
npm install

# Start interactive Studio UI preview server (binds 0.0.0.0:5173)
npm run dev

# Run unit & end-to-end integration test suites
npm test

# Run quantitative performance benchmark suite (BENCH-01 .. BENCH-06)
npm run test:perf

# Run strict TypeScript compiler verification
npm run typecheck

# Build production renderer + Electron main/preload bundles
npm run build

# Package native OS installers (.dmg / .exe / .AppImage / .deb / .rpm)
npm run dist:mac
npm run dist:win
npm run dist:linux
```

---

## Adding a Built-In Effect

1. Register parameter schema and category metadata in `src/effects/registry.ts` (`BUILT_IN_EFFECTS`).
2. Implement or map the pixel kernel in `src/effects/kernels.ts` (avoid per-pixel heap allocations; use `Int32Array`/`Uint8Array` LUTs where possible).
3. Add a unit test verifying non-destructive pixel output and cache invalidation in `tests/unit/`.
4. Run `npm test && npm run test:perf && npm run typecheck` before opening a Pull Request.
