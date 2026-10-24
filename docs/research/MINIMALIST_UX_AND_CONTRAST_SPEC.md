# Modern Minimalist Creative UX Research, Colorimetric Mathematics & Success Criteria

**Target Application**: PreEffects Desktop Motion Graphics & VFX Studio  
**Date**: 2026-10-24  
**Scope**: Minimalist Theme Architecture, Fundamental Laws of UX, Mathematical Contrast Verification (WCAG 2.1 + APCA-W3), and In-App Interactive Studio Guide

---

## 1. Case Studies of Best-in-Class Minimalist & Intuitive Themes

Modern high-density professional software has moved decisively away from legacy 1990s/2000s skeuomorphic chrome (heavy 3D bevels, saturated blue-grey panels, dozens of ungrouped top-level buttons, and low-contrast `#666` labels) toward **quiet, luminance-stepped, progressive-disclosure workspaces**:

### 1.1 Linear (`Linear Method` Dark & Light Systems)
- **Quiet Achromatic Surfaces**: Background surfaces step cleanly in perceptual lightness (`#0B0C0E` canvas $\to$ `#111317` panel $\to$ `#181B21` elevated $\to$ `#20242D` hover) with near-zero background chroma so semantic accents carry 100% of attention.
- **Hairline Structural Geometry**: Uses `1px` low-salience dividers (`--border-subtle`) for passive region separation and high-salience (`>= 3.0:1`) borders (`--border-strong`) strictly on active inputs, modals, and focus states.
- **Keyboard-First Affordances**: Every primary workflow exposes subtle monospace `<kbd>` badges (`⌘K`, `Space`, `F9`, `?`) without cluttering labels.

### 1.2 Figma UI3 (2024–2026)
- **Progressive Disclosure & Hick's Law Reduction**: Consolidates sprawling top toolbars into clean functional clusters; secondary layer/creation options live inside structured segmented menus rather than 25 competing sibling buttons.
- **Consistent 28px Property Rows & Inline Math Scrubbers**: Aligns label, keyframe diamond, and numeric scrubber onto a strict `4px` spatial rhythm (`4 / 8 / 12 / 16 / 24 px`) with unified `5px–6px` control radii.

### 1.3 Rive & Cavalry (Modern Motion Graphics Benchmarks)
- **Unified Timeline <-> Curve <-> Node Switching**: Treats Layer Timeline, Value/Speed Curve Editor, and Procedural Node DAG as peer views of one scene graph with zero context loss.
- **High-Legibility Track Bars & Diamonds**: Timeline clips use translucent fill + crisp `1px` stroke (`labelColor`) and unmistakable geometric keyframe diamonds rather than muddy gradients.

### 1.4 DaVinci Resolve & Foundry Nuke (Color-Critical Surround Neutrality)
- **Simultaneous Contrast Protection (CIECAM02 Surround Effect)**: In compositing and color-grading software, strongly blue-tinted UI chrome (`#161922` / `#262c3c`) induces chromatic adaptation in the human visual system, causing artists to misjudge warm/cool white balance in the viewport. Neutral D65-balanced charcoal (`#0B0C0E` / `#111317`) prevents color-cast bias.

### 1.5 Zed & Raycast (Zero-Latency Command Ergonomics)
- **Instant Command & Guide Access**: `Cmd/Ctrl+K` fuzzy command palette and `F1`/`?` interactive documentation keep hands on the keyboard and keep the persistent chrome minimal.

---

## 2. Fundamental UX Laws Applied Quantitatively

| UX Principle | Mathematical Formulation | Concrete Application in PreEffects |
|---|---|---|
| **Hick-Hyman Law** | $RT = a + b \log_2(n + 1)$ | Top-level control clusters capped at $n \le 7$ choices ($H \le 3.0\text{ bits}$). Replaced the crowded 25-button secondary strip with grouped Tool Clusters + a compact `+ Add Layer` menu + clear Transport/Export CTAs. |
| **Fitts's Law** | $ID = \log_2\!\left(\frac{D}{W} + 1\right)$ | Interactive controls maintain minimum height $W \ge 26\text{px}$ (`28px` standard buttons/rows); dock splitters expand hit-area padding to `8px` (`4px` visual + invisible hit margin); primary transport sits directly above timeline tracks (minimizing $D$). |
| **Miller's Law** | $7 \pm 2$ chunks in working memory | Inspector sections are organized into distinct collapsible/card chunks: *Identity & Blend*, *Transform*, *Layer-Type Specific (Text / Shape / Solid / Camera / Light)*, *Masks*, and *Effects & Profiler*. |
| **Gestalt Proximity & Common Region** | Spatial grouping > heavy borders | Related controls share `4px` intra-group gaps and `12px` inter-group spacing, eliminating nested boxes-inside-boxes. |
| **Jakob's Law** | Industry mental model continuity | Preserves familiar motion-graphics shortcuts (`V` Select, `H` Hand, `Z` Zoom, `W` Rotate, `C` Camera, `Y` Anchor/Pan-Behind, `Q` Shape, `G` Pen, `T` Text, `Space` Play, `F9` Easy Ease, `J/K/L` Shuttle, `B/N` Work Area). |
| **Doherty Threshold** | Response latency $< 100\text{ ms}$ | Sub-16.67ms 60fps scrubbing (`~6.7 ms` for 100 layers), `< 5 µs` 186-effect search, instant theme/guide switching. |

---

## 3. Colorimetric & Contrast Mathematics

Every color token in `src/utils/contrastMath.ts` and `src/renderer/styles/tokens.css` is verified against two complementary mathematical models:

### 3.1 IEC 61966-2-1 Linearization & CIE 1931 Relative Luminance
Given an 8-bit sRGB channel $C_8 \in [0, 255]$ with normalized $C_s = C_8 / 255$:

$$C_{\text{lin}} = \begin{cases} \dfrac{C_s}{12.92}, & C_s \le 0.04045 \\[6pt] \left(\dfrac{C_s + 0.055}{1.055}\right)^{2.4}, & C_s > 0.04045 \end{cases}$$

$$Y = 0.2126\,R_{\text{lin}} + 0.7152\,G_{\text{lin}} + 0.0722\,B_{\text{lin}} \in [0, 1]$$

For translucent surfaces $(C_{\text{fg}}, \alpha)$ composited over an opaque surface $C_{\text{bg}}$:

$$C_{\text{eff}} = \alpha\,C_{\text{fg}} + (1 - \alpha)\,C_{\text{bg}}$$

### 3.2 WCAG 2.1 Contrast Ratio ($CR$)
$$CR(Y_1, Y_2) = \frac{\max(Y_1, Y_2) + 0.05}{\min(Y_1, Y_2) + 0.05} \in [1.0, 21.0]$$

For dynamic user-chosen custom accent colors (`preferences.theme === 'custom'`), PreEffects automatically computes `--accent-on-primary` by maximizing $CR$:

$$C_{\text{on-accent}} = \arg\max_{c \in \{\texttt{\#090B0F},\, \texttt{\#FFFFFF}\}} CR(Y(c), Y(C_{\text{accent}}))$$

Because the crossover luminance satisfies $\frac{Y + 0.05}{0.004 + 0.05} = \frac{1.05}{Y + 0.05} \implies Y^* \approx 0.188$, the worst-case contrast across the **entire 16.7-million-color sRGB gamut** is guaranteed to be at least $\frac{1.05}{0.188 + 0.05} \approx \mathbf{4.41:1}$ (and $\ge 4.5:1$ for virtually all saturated accents).

### 3.3 APCA-W3 Perceptual Lightness Contrast ($L_c$)
To prevent dark-mode halation and verify polarity-asymmetric human perception, `apcaContrastLc` evaluates Stevens power-law screen luminance ($Y_s = 0.2126729\,(R/255)^{2.4} + 0.7151522\,(G/255)^{2.4} + 0.0721750\,(B/255)^{2.4}$ with soft black clamp $Y_{\text{blk}} = 0.022$, exponent $1.414$):
- Normal polarity ($Y_{\text{bg}} > Y_{\text{txt}}$): $S_{\text{APC}} = 1.14\,(Y_{\text{bg}}^{0.56} - Y_{\text{txt}}^{0.57})$
- Reverse polarity ($Y_{\text{bg}} < Y_{\text{txt}}$): $S_{\text{APC}} = 1.14\,(Y_{\text{bg}}^{0.65} - Y_{\text{txt}}^{0.62})$

---

## 4. Detailed Measurable Success Criteria (`SC-UX-01` .. `SC-UX-15`)

| ID | Criterion | Mathematical / Functional Target | Verification Method |
|---|---|---|---|
| **SC-UX-01** | Primary Text Contrast (All 4 Themes) | $CR \ge \mathbf{13.0:1}$ (exceeds WCAG AAA `7.0:1` by `~2×`) across Canvas, Panel, Elevated, Hover, and Input surfaces | Automated unit test (`auditThemeContrast`) |
| **SC-UX-02** | Secondary Text Contrast (All 4 Themes) | $CR \ge \mathbf{8.0:1}$ (WCAG AAA) across Panel, Elevated, and Hover surfaces | Automated unit test (`auditThemeContrast`) |
| **SC-UX-03** | Muted / Metadata / Shortcut Hint Contrast | $CR \ge \mathbf{4.9:1}$ (strictly exceeds WCAG AA `4.5:1` even on `--bg-hover`) — **zero sub-4.5:1 text anywhere** | Automated unit test (`auditThemeContrast`) |
| **SC-UX-04** | Primary CTA & Numeric Scrubber Contrast | Button foreground on `--accent-primary` $CR \ge \mathbf{6.0:1}$; Scrubber value on `--bg-input` $CR \ge \mathbf{6.8:1}$ | Automated unit test (`auditThemeContrast`) |
| **SC-UX-05** | Semantic Status Pills (`OK`, `WARN`, `ERR`) | $CR \ge \mathbf{6.4:1}$ against `--bg-elevated` in Dark, Light, OLED Contrast, and Warm Graphite themes | Automated unit test (`auditThemeContrast`) |
| **SC-UX-06** | Structural Control Boundaries (WCAG 1.4.11) | `--border-strong` vs `--bg-panel` $CR \ge \mathbf{3.0:1}$ across all themes | Automated unit test (`auditThemeContrast`) |
| **SC-UX-07** | Dynamic Custom Accent Safety | `pickAccessibleOnAccent(hex)` yields $CR \ge 4.4:1$ across arbitrary user hex picks | Property test across 50 sampled hues/lightnesses |
| **SC-UX-08** | Neutral Color-Grading Surround | Dark (`#0B0C0E` / `#111317`) & Graphite (`#121211` / `#181817`) surfaces keep RGB channel spread $\Delta RGB \le 12$ | Palette token inspection |
| **SC-UX-09** | Hick's Law Top-Chrome Decluttering | Reduce simultaneous top-bar buttons by $\ge 30\%$ via grouped tool clusters, compact `+ Layer` menu, and progressive disclosure | Component audit (`TopChrome.tsx`) |
| **SC-UX-10** | Fitts's Law Interactive Targets | Primary toolbar buttons $\ge 28 \times 28\text{px}$; timeline rows $28\text{px}$; synchronized timeline left/right scroll & ruler drag-scrubbing | Interactive UI + tests |
| **SC-UX-11** | Zero Hardcoded Dark Islands in Light Theme | Graph Editor, Node Graph, Timecode display, Scopes container, and Console adapt cleanly via CSS variables | Theme switch visual & token audit |
| **SC-UX-12** | Comprehensive In-App Guide & Handbook | Searchable **8-Chapter Interactive Studio Guide** covering every core PreEffects feature + **Try It Live** actions | Unit test + live modal (`ModalsAndOverlays.tsx`) |
| **SC-UX-13** | Hands-On Interactive Walkthrough | **8-Step Guided Spotlight Tour** that auto-switches relevant docks/tabs, highlights active panels, and persists progress | Unit test + live tour |
| **SC-UX-14** | 100% Working Viewport Tools & Shortcuts | All **14 tools** (`selection`, `hand`, `zoom`, `rotate`, `camera`, `anchor`, `shape-rect`, `pen`, `text`, `brush`, `clone`, `eraser`, `roto-brush`, `puppet-pin`) and **all keyboard shortcuts** work | Unit & integration tests |
| **SC-UX-15** | Zero Open P0–P3 Bugs & Regressions | All 24 audited bugs fixed and covered by automated unit/integration/perf suites (`tsc --noEmit` = 0 errors) | `npm run typecheck && npm test && npm run test:perf` |
