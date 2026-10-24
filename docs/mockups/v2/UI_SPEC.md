# PreEffects — Definitive UI Implementation Specification (v2.0)

**Document ID:** `PRE-DESIGN-005`  
**Stage:** Stage 4 — Revised Mock-Up  

This specification locks every pixel dimension, interaction state, empty state, loading state, and error state for Stage 6 engineering.

---

## 1. Exact Shell Geometry

1. **Menu Bar (`height: 28px`)**:
   - Left: Brand mark (`18×18px` rounded-`4px` `#E89B3C` prism badge) + `PreEffects` bold title + 9 top-level dropdown menus (`File`, `Edit`, `Composition`, `Layer`, `Effect`, `Animation`, `View`, `Window`, `Help`).
   - Right: Global Command Palette trigger button (`Ctrl/Cmd+K`, `min-width: 220px`), `"What's This?" [?]` toggle button, Theme quick-cycle (`Dark / Light / HC`), and Offline Local Badge (`OFFLINE ● LOCAL`).
2. **Primary Toolbar & Workspace Bar (`height: 36px`)**:
   - Left Tool Group (`gap: 3px`): `Selection (V)`, `Hand (H)`, `Zoom (Z)`, `Rotate (W)`, `Camera (C)`, `Anchor/Pan-Behind (Y)`, `Shape (Q — Rect/Ellipse/Star/Polygon)`, `Pen/Mask (G)`, `Text (T)`, `Brush (B)`, `Clone`, `Eraser`, `Roto Brush`.
   - Center Context Group: Active tool options (`Snap`, `Grid`, `Safe Zones`, `3D Gizmo`, or Brush Diameter/Hardness when Paint/Roto tool is active).
   - Right Workspace Switcher: `Standard`, `Animation`, `Compositing`, `Node Graph`, `Typography`, `Scopes`, `Minimal` + `[Save Layout]`.
3. **Main Middle Split Area (`flex: 1 1 auto`, `min-height: 240px`)**:
   - **Left Dock (`width: 270px` resizable `180px..520px`)**: Tabbed `Project`, `Effects & Presets`, `Asset Library`, `Version History`.
   - **Center Viewport (`flex: 1`)**: Breadcrumb & Comp Tabs (`28px`) + Hardware/2D Stage Canvas + Viewer Controls Footer (`28px`).
   - **Right Dock (`width: 340px` resizable `220px..560px`)**: Tabbed `Effect Controls`, `Character & Paragraph`, `Scopes`, `Tracker & Roto`, `Paint & Brushes`, `Audio`, `Script & Expressions`, `Profiler`.
4. **Bottom Workspace Area (`height: 310px` resizable `150px..620px`)**:
   - Mode Tabs (`28px`): `Layer Timeline`, `Unified Graph Editor`, `Bidirectional Node Graph`, `Render Queue`.
5. **Status Bar (`height: 24px`)**:
   - Left: Active tool hint / What's This? summary / Last Undo action.
   - Center: Cursor `(X, Y)` & sampled `RGBA` values.
   - Right: Active Render / Auto-Save status, Frame Evaluation `ms` & `fps`, RAM Cache usage (`MB`), and `WebGL2 / CPU` engine badge.

---

## 2. Empty States Specification (Zero Blank Panels)

Every panel MUST render an intentional, actionable studio empty state when no item is loaded or selected:

| Panel | Empty State Condition | Visual & Actionable Controls |
|---|---|---|
| **Composition Viewer** | No composition open in project | PreEffects vector emblem + `"No Active Composition"` + `[+ New Composition (Ctrl+N)]` primary button + `[Load Studio Showcase Template]` + `[Import Footage (Ctrl+I)]`. |
| **Timeline Panel** | Composition has `0` layers | `"Composition is empty — add layers or drop footage here"` + quick-create pill row: `[+ Text]` `[+ Shape]` `[+ Solid]` `[+ Camera]` `[+ Light]` `[+ Adjustment]` `[+ Procedural]`. |
| **Effect Controls** | No layer selected, or layer has `0` effects | If no layer: `"Select a layer in the Timeline or Viewer to inspect effects"`. If `0` effects: `"No effects applied to <Layer Name>"` + `[Browse 180+ Effects]` + 4 quick-apply chips (`Gaussian Blur`, `Optical Glow`, `Curves`, `Drop Shadow`). |
| **Graph Editor** | No animated/keyframed property selected | Dotted baseline grid + `"Click a stopwatch (◆) on any property or select a layer track to edit Value & Speed curves"` + `[Auto-Select Animated Properties (U)]`. |
| **Render Queue** | `0` queued render jobs | `"Render Queue is empty"` + `[+ Add Active Composition to Render Queue (Ctrl+M)]` + `[Quick Export MP4/WebM/GIF]`. |
| **Search / Filter** | `0` items match query | `"No matches for '<query>'"` + `[Clear Filter]` button. |

---

## 3. Loading & Progress States

- **Startup Splash Overlay**: Crisp instant branding card (`< 400 ms` non-blocking fade) with version `v1.0.0`, engine initialization status, and optional Welcome Template picker.
- **RAM Preview Caching**: Live green `3px` progress segments paint directly across the Timeline ruler above cached frames while `Preview` displays `Caching 142 / 300 (60.0 fps)`.
- **Render Queue Job**: Determinate Tungsten Amber progress bar with live frame thumbnail update, `Frame N / Total`, `Elapsed`, `Remaining ETA`, `[Pause]`, and `[Cancel]`.
- **AI Roto / Tracker / Content-Aware Fill**: Non-freezing frame-by-frame progress pill with `[Stop Solve]` button.

---

## 4. Error & Validation States (Friendly, Non-Crashing, Actionable)

- **Expression Syntax / Reference Error**: Never opens a blocking alert box. Displays a compact inline banner below the property (`Expression Warning on Line 1: Unknown layer "Ctrl_2" — holding last valid value`) with `[Jump to Line]` and `[Disable Expression]`.
- **Missing Footage Asset**: Renders SMPTE colour-bars diagnostic frame stamped with the missing filename so compositions still play and export cleanly, alongside a `[Relink File...]` button in the Project Panel.
- **Corrupt / Unsupported Import or `.prex` Schema**: Styled Studio Error Modal showing plain-English explanation, file path, schema diagnostic reason, and `[Try Recovery Backup]` / `[Import as Raw Bytes]` options — never raw stack traces.
- **Numeric Input Validation**: Invalid math input in `ScrubInput` flashes a subtle `1px #EF4444` border for `250ms` and gracefully reverts to the previous valid number on `Blur` or `Esc`.
