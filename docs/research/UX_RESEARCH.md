# UX Research — Motion Designer Workflows, AE Pain Points & Accessibility

**Document ID:** `PRE-RES-004`  
**Stage:** Stage 3 — Research  

---

## 1. Core Motion Designer & VFX Artist Workflows Studied

1. **Kinetic Typography & Brand Systems**: Create Comp -> Type headline -> Add Range Animator (Opacity + Y-Offset + Tracking) -> Apply Easy Ease (`F9`) -> Tweak velocity handle in Graph Editor -> Duplicate & stagger layers (`Sequence Layers`).
2. **Shape Morphing & HUD Design**: Draw parametric shape -> Add Trim Paths + Repeater -> Link stroke width and offset to Master Null Slider Controls via Pick Whip -> Add Optical Glow Adjustment Layer.
3. **Live-Action VFX Keying & Integration**: Import green-screen plate + background plate -> Apply Keylight + Spill Suppressor -> Paint Roto exclusion stroke -> Track background planar motion -> Apply motion to foreground + match grain & LUT on Broadcast Scopes.
4. **Look-Dev Iteration & Client Delivery**: Save Frame Snapshot A -> Adjust Curves/Glow -> Drag A/B Split Wipe across viewer -> Queue H.264 Review + ProRes 4444 Master simultaneously in Render Queue.

---

## 2. Fourteen Specific UX Pain Points in Adobe After Effects Solved by PreEffects

| # | Pain Point in Adobe After Effects | How PreEffects Solves It |
|---|---|---|
| **UX-01** | **Opaque Render Bottlenecks**: Artists must hunt through hidden columns to figure out which single effect tanked FPS from 60 to 6. | **Inline Millisecond Badges + Dedicated Profiler Panel** on every Effect Card and Timeline row (`0.9 ms` green / `4.2 ms` amber / `12.8 ms` red). |
| **UX-02** | **Disconnected Value vs Speed Graphs**: Switching between Value and Speed graphs loses handle context; Position requires manual "Separate Dimensions" first. | **Unified Graph Editor** supports Value, Speed, and **Dual Overlay** modes with one-click X/Y/Z curve toggles and direct cubic Bezier handles. |
| **UX-03** | **"Pre-Comp Hell" for Effect Branching**: Routing one layer into both a sharp edge pass and a blurred glow pass requires duplicating comps or layers. | **Bidirectional Layer <-> Node Graph (`Shift+N`)** allows non-destructive parallel branches while staying synced with the timeline. |
| **UX-04** | **Clumsy Pre-Comp Diving**: Opening nested pre-comps floods the tab bar and loses parent timeline context. | **Interactive Comp Breadcrumb Bar** (`Master_Shot ▸ HUD_Cluster ▸ Ring_Rig`) in both Viewer and Timeline headers for 1-click ascent/descent. |
| **UX-05** | **Modal Expression Friction & Cryptic Errors**: A single missing parenthesis pops modal warning dialogs or silently disables expressions with tiny banners. | **Non-Blocking Inline Diagnostic Banner** with exact line/column highlight, autocomplete snippets, and safe fallback to keyframed value. |
| **UX-06** | **Broken Expression Links on Layer Duplicate**: Duplicating a rigged layer + controller still points expressions at the *old* controller (`layer("Ctrl 1")`). | **Smart Duplicate (`Ctrl/Cmd+Alt+D`)** automatically rewrites internal/sibling expression references across the duplicated group! |
| **UX-07** | **Scattered Search Across 4 Separate Boxes**: Separate search bars for Project, Effects, Timeline, and Help Menus. | **Unified Command Palette (`Ctrl/Cmd+K`)** searches Effects, Presets, Menu Actions, Project Assets, Layers, Shortcuts, and Help Docs in `< 3 ms`. |
| **UX-08** | **Awkward Snapshot Comparison**: AE's F5 snapshot flashes full-frame only while holding a tiny button — impossible to inspect subtle colour grades side-by-side. | **Interactive Draggable A/B Split-Wipe Line** directly inside the Composition Viewer with movable split position. |
| **UX-09** | **Verbose Wiggle / Loop Boilerplate**: Beginners must memorize `loopOut("pingpong")` or `wiggle(3, 20)` syntax every time. | **1-Click Expression Snippet Chips** right above the Expression Editor insert parameterized `Wiggle`, `Loop Cycle`, `Loop PingPong`, `Inertial Bounce`, `Overshoot`, and `Time Spin` expressions immediately. |
| **UX-10** | **No Built-In Project Diff / Version Rollback**: Comparing `shot_v14.aep` vs `shot_v15.aep` is impossible because `.aep` is an opaque binary blob. | **Built-In Version History & Visual Diff Panel** over deterministic `.prex` manifests shows exact added/changed layers & parameters. |
| **UX-11** | **Aspect-Ratio Re-Versioning Tedium**: Resizing a `16:9` broadcast graphic to `9:16` vertical breaks every hardcoded pixel coordinate. | **Smart Adaptive Presets & Comp Auto-Reframe** normalize positions relative to safe bounds (`0..1 UV`comp percentages). |
| **UX-12** | **Hidden Broadcast Scopes**: Opening Lumetri Scopes requires loading heavy colour workspace plugins. | **Zero-Overhead Native Scopes Panel** (Histogram, RGB Parade, Waveform, Vectorscope) available in every workspace with 1 click. |
| **UX-13** | **Slider Undo Spam**: Micro-adjusting scrubbable numbers can create dozens of fragmented history states or lose intermediate look-dev steps. | **Transaction-Coalesced Scrubbing + Clickable Undo History Panel** groups continuous pointer drags into single semantic undo steps. |
| **UX-14** | **Steep Onboarding for Dense Switches**: New users don't know what `Shy`, `Collapse Transformations`, or `Stencil Alpha` do. | **"What's This?" Inspector Mode (`Shift+F1`)** lets users click any button, column switch, or blend mode to read a concise studio explanation + shortcut. |

---

## 3. Keyboard-Heavy Ergonomics & Accessibility Findings

- **Single-Key Reveal Muscle Memory**: Motion designers press `U`, `P`, `S`, `R`, `T`, `A`, `E`, `M` hundreds of times per hour. All single-letter shortcuts are guarded so they execute immediately when focus is on Timeline/Viewer/Panels, while automatically yielding when an `<input>`, `<textarea>`, or Expression Editor is focused.
- **Colour-Blind Safe Track Labels**: Default 16 label swatches include distinct luminance steps + optional **Okabe-Ito** palette mode in Preferences, paired with explicit `[Txt]`, `[Shp]`, `[Adj]`, `[Nul]`, `[Cam]`, `[Lgt]`, `[Pre]`, `[Aud]`, `[3D]` badge prefixes so layer type is never communicated by colour alone.
- **Keyboard & Screen-Reader Navigation**: Every dockable panel carries `role="region"` + `aria-label`; custom scrub inputs support `ArrowUp`/`ArrowDown` (`+Shift` `10x`, `+Alt` `0.1x`); High-Contrast theme boosts border contrast to `>= 7:1`.
