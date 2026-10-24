# PreEffects — Studio UI Design System (v1.0)

**Document ID:** `PRE-DESIGN-001`  
**Stage:** Stage 2 — Initial Mock-Up  

---

## 1. Visual Identity & Post-Production Philosophy

Professional compositing and grading artists spend 8–12 hours daily in front of scopes and viewports. PreEffects explicitly rejects trendy consumer SaaS patterns (no oversized border radii, no glowing purple-to-pink gradients, no low-density whitespace cards). Instead, it uses **neutral perceptual charcoal surfaces** (zero chromatic bias so viewer colour perception stays accurate) paired with **Tungsten Amber (`#E89B3C`)** for active tools/playheads and **Signal Cyan (`#38BDF8`)** for selection/keyframe telemetry.

---

## 2. Colour Palette

### 2.1 Obsidian Studio Dark (Default Theme)

| Token | Hex | Usage |
|---|---|---|
| `--bg-app-frame` | `#0C0E12` | Outer window frame, panel gutters (`2px` splitters), titlebar chrome |
| `--bg-panel` | `#14171D` | Primary panel background (Project, Effect Controls, Timeline tracks) |
| `--bg-panel-header` | `#1B1F27` | Docked tab strip & section headers |
| `--bg-surface-elevated` | `#222732` | Inputs, buttons, dropdowns, floating toolbars, modals |
| `--bg-surface-hover` | `#2B3240` | Hover state on interactive rows, menu items, and buttons |
| `--bg-viewer-canvas` | `#090A0D` | Composition viewer letterbox surround (neutral Rec.709 surround) |
| `--border-subtle` | `#262B36` | Hairline `1px` panel internal dividers & table gridlines |
| `--border-strong` | `#363E4D` | Input borders, modal frames, active splitter lines |
| `--text-primary` | `#E6EAF2` | Primary labels, layer names, active values (`13.8:1` contrast) |
| `--text-secondary` | `#9AA3B5` | Property names, inactive tabs, column headers (`6.4:1` contrast) |
| `--text-muted` | `#646E82` | Disabled items, ruler sub-ticks, subtle hints |
| `--accent-primary` | `#E89B3C` | Active tool, Playhead CTI needle, Scrubby-slider numeric values, Render button |
| `--accent-secondary` | `#38BDF8` | Selected keyframes, active panel focus top-bar (`2px`), Pick Whip line |
| `--status-cached` | `#22C55E` | RAM Preview cached frame bar in timeline ruler |
| `--status-warning` | `#F59E0B` | Missing font / heavy effect (>8ms) profiler badge |
| `--status-danger` | `#EF4444` | Recording indicator, expression syntax error, Solo/Record states |

### 2.2 Precision Daylight Light (Light Theme Variant)

| Token | Hex | Usage |
|---|---|---|
| `--bg-app-frame` | `#CFD5DF` | Outer window frame & `2px` panel splitters |
| `--bg-panel` | `#F3F5F8` | Primary panel background |
| `--bg-panel-header` | `#E6E9EF` | Tab headers & toolbars |
| `--bg-surface-elevated` | `#FFFFFF` | Inputs, buttons, dropdowns, dialogs |
| `--bg-surface-hover` | `#DCE2EC` | Hover highlight |
| `--bg-viewer-canvas` | `#1E222A` | Viewer canvas stays neutral dark by default (toggleable) for accurate alpha/bloom |
| `--border-subtle` | `#D5DCE6` | Hairline dividers |
| `--text-primary` | `#141821` | Primary labels (`15.2:1` contrast) |
| `--text-secondary` | `#4A5468` | Secondary labels (`7.1:1` contrast) |
| `--accent-primary` | `#C47412` | High-contrast amber for scrubby numbers & active tools |
| `--accent-secondary` | `#0284C7` | High-contrast azure for selections & active panel indicator |

### 2.3 Layer Track Colour Labels (16 Studio Labels)
`Red #E05252`, `Yellow #E5B93C`, `Aqua #38C6BD`, `Pink #E079B5`, `Lavender #9B87F5`, `Peach #F29B76`, `Seafoam #7CC69B`, `Blue #4C8BF5`, `Green #4BB543`, `Purple #A855F7`, `Orange #F97316`, `Brown #9C6B49`, `Fuchsia #D946EF`, `Cyan #06B6D4`, `Sandstone #C2A887`, `Dark Green #2D7A53`.

---

## 3. Typography Scale

- **UI Sans Family (`--font-ui`)**: `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Ubuntu, sans-serif` — crisp geometric legibility at compact studio sizes (`11px`–`13px`) with `font-feature-settings: "cv02", "cv03", "cv04"`.
- **Technical Monospace (`--font-mono`)**: `'JetBrains Mono', 'SF Mono', 'Cascadia Mono', 'Fira Code', monospace` with `font-variant-numeric: tabular-nums` — mandatory for Timecode (`00:00:04:12`), X/Y/Z coordinates, RGBA channels, frame counters, and Expression/Script code so digits never jitter during 60fps playback.

| Style Token | Font | Size | Weight | Line Height | Usage |
|---|---|---|---|---|---|
| `type-dialog-title` | UI Sans | `15px` | `600` | `20px` | Modal & Welcome titles |
| `type-panel-tab` | UI Sans | `11.5px` | `600` | `16px` | Docked panel tabs & active workspace chips |
| `type-section-hdr` | UI Sans | `10.5px` | `600` | `14px` | Uppercase (`0.05em` tracking) inspector group headers |
| `type-body` | UI Sans | `12px` | `400` | `16px` | Layer names, menu items, project tree rows |
| `type-label` | UI Sans | `11px` | `500` | `15px` | Property names, effect parameters, toolbar chips |
| `type-timecode-lg` | Mono | `16px` | `600` | `20px` | Master Timecode display (`00:00:03:18`) |
| `type-scrub-num` | Mono | `11px` | `500` | `15px` | Scrubbable numeric parameters, FPS, ms profiler |
| `type-code` | Mono | `12px` | `400` | `18px` | Expression Editor & Multi-Language Script Console |

---

## 4. Spacing & Density Grid

- Base micro-unit: **`2px`**; standard grid unit: **`4px`**.
- **Panel Splitter Gutter**: `2px` visual (`6px` invisible hit target with `col-resize` / `row-resize` cursor).
- **Timeline Layer Row Height**: `24px` compact (default), `28px` comfortable; property sub-rows `21px`.
- **Top Menu + Tool Header Height**: `28px` Menu Bar + `36px` Tool & Workspace Bar (`64px` combined).
- **Panel Header Tab Strip**: `28px` height, `0 10px` tab padding, `2px` top active accent bar.
- **Border Radius**: `3px` on buttons/inputs, `4px` on dropdowns/context menus, `6px` on modal dialogs, `0px` on docked panels.

---

## 5. Icon Style Guide

All icons in PreEffects (`src/renderer/icons/StudioIcons.tsx` & `src/assets/icons/`) are original, purpose-drawn vector SVGs:
- **Grid**: `16x16` viewBox for timeline switches/inspector actions; `18x18` viewBox for primary toolbar tools.
- **Stroke**: `1.5px` uniform stroke, `stroke-linecap="round"`, `stroke-linejoin="round"`, pixel-snapped horizontal/vertical stems on `.5` coordinates for razor-sharp rendering at `100%` and `200%` DPI.
- **Keyframe Glyph Language**:
  - Linear: Rotated diamond (`◆`)
  - Bezier / Easy Ease: Hourglass (`⧗`)
  - Auto / Continuous Bezier: Circle (`●`)
  - Hold: Left diamond + right square step (`◧`)
  - Roving: Compact micro-diamond (`❖`)

---

## 6. Component Library Specification

1. **Buttons**: Primary (`--accent-primary` fill, `#0C0E12` bold text), Secondary (`--bg-surface-elevated` fill, `1px` `--border-strong`), Ghost Icon (`24x24px` square, `3px` radius, active tinted amber/cyan).
2. **Scrubby Numeric Value (`ScrubInput`)**: Dotted underline under `--accent-primary` monospace value (`ew-resize` cursor). Dragging horizontally scrubs continuously (`Shift` = `10x`, `Alt/Opt` = `0.1x`); single-clicking enters inline text input supporting math expressions (e.g. `1920/2`, `50+25`).
3. **Sliders**: `4px` track with filled progress segment and `10px` precision thumb; paired with `ScrubInput`.
4. **Dropdowns / Selects**: `24px` height, compact chevron, keyboard type-ahead search, checkmark on selected option.
5. **Text & Search Inputs**: `24px` height, `1px` `--border-strong`, `focus-visible` `1px` `--accent-secondary` ring + clear (`×`) button.
6. **Toggles & Layer Switches**: Compact `16x16` icon cells in Timeline columns (Eye, Speaker, Solo dot, Lock padlock, Shy figure, 3D cube, Motion Blur triple-circle, Adjustment half-moon, FX badge).
7. **Tabs**: Flush panel tabs with `2px` top `--accent-secondary` indicator on the focused panel, middle-click or `×` to close secondary comp tabs.
8. **Scrollbars**: Custom `8px` slim studio scrollbars (`#2D3443` thumb, `#3E485C` hover) + zoomed range handles on the Timeline horizontal navigator.
9. **Colour Picker**: Eyedropper + HSV saturation/value square + Hue bar + Alpha bar + Hex/RGB/HSL/32-bit Float EV fields + recent swatches.
10. **Curves & Spline Editor**: `256x256` interactive grid with RGB histogram backdrop, Master/R/G/B/A channel selector, click-to-add control points, cubic spline interpolation.
11. **Tree Views**: Indented `14px` per depth level with rotating disclosure caret (`▸`/`▾`), multi-select, inline `Enter`-to-rename, and colour label swatch.
12. **Context Menus**: `4px` radius, `1px` `--border-strong`, shadow `0 10px 28px rgba(0,0,0,0.65)`, left icon gutter, label, right-aligned shortcut hint, `1px` group separators, nested submenu arrows.
13. **Tooltips**: `350ms` hover delay, displays control name + 1-sentence description + `[Shortcut]` pill.
14. **Modals & Dialogs**: Centered backdrop (`rgba(5,7,10,0.68)`), draggable header, `Esc` to cancel, `Enter` to commit, tabbed left sidebar for multi-page dialogs (Preferences, Comp Settings).
15. **Toast Notifications & Status Bar**: Non-blocking bottom-right toast stack (`Render Complete`, `Auto-Saved`, `Snapshot Stored`) + persistent `24px` bottom Status Bar.
16. **Progress Bars**: Determinate striped/solid amber bar with frame counter (`Frame 142 / 300 — 47% — ETA 00:04`) in Render Queue.
17. **Splitters / Dividers**: Draggable horizontal and vertical flex splitters highlighting `--accent-secondary` after `120ms` hover, double-click to reset proportion.

---

## 7. Motion & Elevation System

- **UI Transitions**: Snappy `90ms–140ms cubic-bezier(0.2, 0, 0, 1)` for hover/dropdowns/modals; `0ms` during splitter drag, timeline scrub, and canvas pan for zero perceived latency. Automatically disabled when **Reduced Motion** preference is active.
- **Elevation Layers**:
  - `z-0`: Docked panels & canvas
  - `z-10`: Sticky timeline headers & viewer HUD overlays
  - `z-20`: Floating tool sub-palettes & Snapshot wipe handle
  - `z-30`: Context menus & dropdown popovers
  - `z-40`: Modal dialogs & Command Palette (`Ctrl/Cmd+K`)
  - `z-50`: Drag ghosts, Pick Whip live Bezier cord, and "What's This?" inspector overlay
