# Comprehensive Feature Verification & Prioritized Bug Audit

**Date**: 2026-10-24  
**Branch**: `arena/a62c2349-preeffects`  
**Audit Coverage**: Compositing Engine, RAM Cache, 14 Viewport Tools, 38 Blend Modes, Timeline & Graph Editor, Bidirectional Node Graph, 186 Effects, Inspector Controls, Asset Import/Export, Keyboard Shortcuts, Theme Contrast Math, and Cross-Platform Desktop Packaging.

---

## Executive Summary

A full line-by-line code, mathematical contrast, and end-to-end workflow audit of PreEffects uncovered **24 bugs, unwired controls, contrast violations, and UX mistakes**:

| Priority Tier | Definition | Discovered | Fixed |
|---|---|---:|---:|
| **P0 — Critical** | Broken core rendering/cache invalidation, broken viewport tools, WCAG contrast failures (<4.5:1 text), binary file corruption, OS launch blocker | **5** | **5** |
| **P1 — High** | Unwired keyboard shortcuts, discarded tool outputs, missing toolbar tools/workspaces, modal state bugs, desynchronized Graph Editor assistants | **8** | **8** |
| **P2 — Medium** | Hardcoded dark colors breaking Light theme, desynchronized timeline scrolling, missing layer-specific inspector controls, custom accent contrast | **7** | **7** |
| **P3 — Low / UX Polish** | Hick's Law toolbar crowding, raw OS emojis instead of vector icons, initial Undo counter off-by-one, shallow 5-step onboarding modal | **4** | **4** |
| **Total** | | **24** | **24** |

---

## Detailed Categorized Bug Inventory & Resolutions

### P0 — Critical Bugs

1. **`BUG-P0-01` — Incomplete `studioRamCache` Signature Returning Stale Frames (`src/engine/compositor.ts`)**
   - **Symptom**: Drawing Brush/Clone/Eraser strokes, placing Puppet Deform Pins, clicking AI Roto seeds, adding Text Animators or Shape Operators, toggling 3D/Collapse/Motion-Blur switches, changing `parentId`, trimming `inPoint`/`outPoint`, editing `anchorPoint`/`rotationX`/`rotationY`, or editing keyframe values on the current frame returned the cached pre-edit frame until scrubbing elsewhere.
   - **Root Cause**: The FNV-1a cache signature `sig` in `renderCompositionFrame` only serialized 2D `position`/`scale`/`rotationZ`/`opacity` base values, masks count, and effects.
   - **Resolution**: Expanded `sig` to hash `inPoint`, `outPoint`, `startTime`, `stretchPct`, `threeD`, `motionBlur`, `parentId`, full `anchorPoint`/`rotationX`/`rotationY` + keyframe counts/values, `paintStrokes`, `puppetPins`, `rotoMatteEnabled` + seeds, `textData` (`tracking`, `leading`, `align`, `animators`), `shapeContent` (`operators`), `cameraSettings`, `lightSettings`, and `assetId`/`missing`.

2. **`BUG-P0-02` — 7 of 14 Viewport Tools Falling Through to Layer Move (`src/renderer/components/ViewportPanel.tsx`)**
   - **Symptom**: Selecting `Hand` (`H`), `Zoom` (`Z`), `Rotate` (`W`), `Camera` (`C`), `Anchor / Pan Behind` (`Y`), `Vector Shape` (`Q`), or `Type` (`T`) and clicking/dragging on the Viewport either moved the selected layer's XY position or did nothing at all when no layer was selected.
   - **Root Cause**: `onPointerDown` returned early when `!selLayer` and only branched on `paint`, `roto-brush`, `puppet-pin`, and `pen`.
   - **Resolution**: Implemented dedicated handlers for all 14 tools: `hand` pans viewport stage offset `[panX, panY]` (even with no layer selected); `zoom` clicks/Alt-clicks to zoom in/out; `shape-rect` & `text` create and position new Shape or Text layers directly at the clicked canvas coordinates; `rotate` computes angular delta around the layer anchor to update `rotationZ`; `anchor` updates `anchorPoint` while compensating `position` (true Pan-Behind); `camera` orbits the active 3D Camera (auto-creating one if needed).

3. **`BUG-P0-03` — Five Mathematically Verified WCAG AA Contrast Violations (`src/renderer/styles/tokens.css`)**
   - **Symptom**: Muted labels, shortcuts, numeric scrubbers, and status indicators fell below the `4.5:1` WCAG AA legibility floor (`3.14:1` dark muted on hover; `3.39:1` light `.scrub-number`; `3.66:1` light muted on hover; `3.55:1` light `--status-ok`; `3.17:1` light `--status-warn`).
   - **Resolution**: Built `src/utils/contrastMath.ts` and recalibrated all four themes (`Linear Obsidian`, `Nordic Daylight`, `OLED Pure Contrast`, `Warm Studio Graphite`) so every text pair achieves `>= 4.94:1` (`14.3:1–21.0:1` primary AAA) and every structural border achieves `>= 3.12:1`.

4. **`BUG-P0-04` — Binary Asset Import Corruption via `file.text()` (`TopChrome.tsx`, `ProjectAndAssetsPanel.tsx`, `StudioContext.tsx`)**
   - **Symptom**: Importing `.png`, `.jpg`, `.webp`, `.gif`, or `.wav` files called `file.text()`, corrupting binary bytes into UTF-8 replacement characters and leaving `ProjectAsset.rgbaBuffer`, `mesh3D`, `structuredData`, and `cubeLutText` unpopulated.
   - **Resolution**: Added unified `importLocalFile(file: File)` decoding images via browser `Image` + offscreen `<canvas>` into `rgbaBuffer` (`width`, `height`), parsing `.obj` meshes via `parseWavefrontObj`, parsing `.csv` tables via `parseCsvRecords`, storing `.cube` LUTs in `cubeLutText`, decoding 16-bit PCM `.wav` headers into `audioSamples`, and optionally placing imported assets directly into the active composition.

5. **`BUG-P0-05` — Unsigned Apple Silicon (`arm64`) `.app` Bundle Signature Invalidation (`packaging/`)**
   - **Symptom**: `"identity": null` skipped `codesign` after `electron-builder` modified `Electron.app` into `PreEffects.app`, causing Apple Silicon Gatekeeper to report quarantined `.dmg` installs as *"damaged and can't be opened"*.
   - **Resolution**: Added `packaging/afterPack.cjs` hook in `packaging/electron-builder.json` to execute `codesign --force --deep --sign -` on `darwin` builds when no Developer ID certificate is present, sealing the Mach-O bundle automatically in CI, and documented first-launch `xattr -cr` Gatekeeper clearance in `README.md` and the In-App Guide.

---

### P1 — High-Priority Bugs

6. **`BUG-P1-01` — 19 Keyboard Shortcuts Defined in `DEFAULT_SHORTCUTS` Not Wired in `StudioContext.tsx`**
   - **Resolution**: Wired all shortcuts including `Delete`/`Backspace` (delete layers), `Mod+I` (import file dialog), `Mod+Y` (new Solid), `Mod+Alt+Y` (new Adjustment), `ArrowLeft`/`ArrowRight` (1-frame step, `Shift` = 10 frames), `Home`/`End`, `B`/`N` (Work Area start/end), `J`/`K`/`L` (shuttle reverse/pause/forward), `Shift+F5` (toggle A/B wipe), `T`/`B`/`E` tool keys, and `F1`/`?` (open Interactive Studio Guide), plus excluded `<select>` focus from intercepting single-key shortcuts.
7. **`BUG-P1-02` — Missing `Eraser` Tool & `Minimal` Focus Workspace Toggle in `TopChrome.tsx`**
   - **Resolution**: Added crisp vector `IconEraser` tool button to the tool strip and added `Minimal` focus workspace option so users can cleanly enter and exit distraction-free canvas mode.
8. **`BUG-P1-03` — Content-Aware Fill Discarded Synthesized Clean Plate (`InspectorAndToolsPanel.tsx`)**
   - **Resolution**: Captured the returned `Uint8ClampedArray` from `synthesizeContentAwareFill`, registered it as a `ProjectAsset` (`CleanPlate_<Comp>`), and inserted a ready-to-composite `footage` layer onto the active composition.
9. **`BUG-P1-04` — Screen Capture Plate Discarded Video Frame (`ViewportPanel.tsx`)**
   - **Resolution**: Mounted the `MediaStream` onto an offscreen `<video>`, waited for `loadeddata`, rasterized the live frame onto an offscreen `<canvas>` to capture real `rgbaBuffer` pixels into a `ProjectAsset`, and placed the captured layer into the active composition before stopping tracks.
10. **`BUG-P1-05` — Composition Settings Modal Initialized With Hardcoded Values (`ModalsAndOverlays.tsx`)**
    - **Resolution**: Synced `compName`, `compW`, `compH`, `compFps`, `compDur`, and `compBg` from `studio.activeComp` whenever `activeModal === 'comp-settings'` opens.
11. **`BUG-P1-06` — Timeline Ruler Lacked Pointer-Drag Scrubbing & Clip Bars Lacked Time-Slide Dragging (`BottomWorkspacePanel.tsx`)**
    - **Resolution**: Added smooth pointer-capture drag scrubbing across the Timeline Ruler and horizontal drag-sliding (`inPoint`/`outPoint`/`startTime`) + In/Out edge trimming on unlocked Timeline clip bars.
12. **`BUG-P1-07` — Graph Editor Property Hardcoded to `Position Y` While `Wiggler`/`Smoother` Targeted `Opacity` (`BottomWorkspacePanel.tsx`)**
    - **Resolution**: Added an explicit Graph Property selector (`Position X`, `Position Y`, `Scale`, `Rotation Z`, `Opacity`) and wired `Easy Ease`, `Wiggler`, and `Smoother` to operate directly on the active property (auto-creating start/end keyframes if fewer than 2–3 keyframes exist so the assistants always work predictably).
13. **`BUG-P1-08` — `'vfx-keying'` Studio Template Hidden from Welcome & Library UI**
    - **Resolution**: Exposed all 4 built-in studio templates (`Orbital Telemetry 3D Hero`, `Broadcast Kinetic Lower Third`, `VFX Chroma Key & Tracking Rig`, and `Clean Blank 1080p60 Comp`) in both the Welcome launcher and Library dock.

---

### P2 — Medium-Priority Bugs

14. **`BUG-P2-01` — Hardcoded Dark Hex Surfaces (`#090B10`, `#0C0F16`, `#090C13`, `#161B26`) Breaking Light Theme**
    - **Resolution**: Replaced all hardcoded dark surface/text hexes in `BottomWorkspacePanel.tsx` and `InspectorAndToolsPanel.tsx` with semantic theme variables (`--bg-inset`, `--bg-elevated`, `--bg-panel`, `--text-primary`, `--text-muted`, `--grid-line`).
15. **`BUG-P2-02` — Desynchronized Vertical Scroll Between Timeline Layer List & Track Lanes**
    - **Resolution**: Linked left and right timeline scroll containers via `onScroll` ref synchronization so layer rows and clip bars stay pixel-aligned at any scroll depth.
16. **`BUG-P2-03` — Missing Inspector Editors for `Solid` Color, `Camera` Lens/DoF, `Light` Rig, and `Mask` Properties**
    - **Resolution**: Added contextual Inspector cards for `Solid` (`solidColor`), `Camera` (`focalLengthMm`, `depthOfField`, `focusDistance`, `aperture`), `Light` (`lightType`, `color`, `intensity`), and interactive `Mask` controls (`mode`, `feather`, `inverted`, delete).
17. **`BUG-P2-04` — Effect Parameter Controls Clamped to `[-100, 200]` & Missing Boolean Toggles**
    - **Resolution**: Paired adaptive sliders with `ScrubNumberInput` (supporting arbitrary ranges & inline math) and rendered `boolean` effect parameters as clean toggle switches.
18. **`BUG-P2-05` — Sandboxed Plugin List Not Re-Rendering After Bundle Install**
    - **Resolution**: Added `pluginVersion` state bump on `installSandboxedBundle` so newly registered plugins appear immediately.
19. **`BUG-P2-06` — Custom Theme Accent Missing Dynamic Accessible Foreground Computation**
    - **Resolution**: Computed `--accent-on-primary` automatically via `pickAccessibleOnAccent` in `StudioContext.tsx` whenever a custom accent is chosen.
20. **`BUG-P2-07` — Snapshot A/B Wipe Desync Across Resolution Divisors**
    - **Resolution**: Stored `{ pixels, width, height }` for snapshots and resampled/matched dimensions cleanly in `ViewportPresenter` so A/B split-wipe works even after changing Preview Resolution (`Full` <-> `Half` <-> `Quarter`).

---

### P3 — Low-Priority / UX & Visual Polish

21. **`BUG-P3-01` — Hick's Law Overload in Top Chrome (47 Simultaneous Controls)**
    - **Resolution**: Redesigned `TopChrome.tsx` into a calm, Linear/Figma-UI3 minimalist 2-tier studio header with grouped tool clusters, a compact `+ Add Layer` popover menu, segmented workspace pills, and prominent **Guide** & **Export** actions.
22. **`BUG-P3-02` — Raw Emoji Characters (`📷`, `⏺`, `★`, `⬇`, `⚠`) Across Studio Controls**
    - **Resolution**: Replaced all emoji glyphs with crisp 1.5px-stroke geometric vector icons in `Icons.tsx`.
23. **`BUG-P3-03` — Initial `Undo (1)` Off-By-One Before Any User Edit**
    - **Resolution**: Fixed `undoEntries` in `StudioContext.tsx` to exclude index `0` (baseline state) so `undoEntries.length` equals exact undoable step count (`0` on fresh project load).
24. **`BUG-P3-04` — Minimal 5-Card Tour Replaced by Full Interactive Studio Guide & Hands-On Tutorial**
    - **Resolution**: Built `src/renderer/data/studioGuideData.ts` + dual-mode **Interactive Studio Guide Handbook** (8 searchable chapters, keyboard cheatsheet, expression cookbook, *"Try It Live"* buttons) and **8-Step Spotlight Walkthrough** highlighting live UI panels with persistent completion tracking.
