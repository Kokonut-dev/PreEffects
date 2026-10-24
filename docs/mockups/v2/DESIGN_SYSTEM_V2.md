# PreEffects — Revised Studio Design System (v2.0)

**Document ID:** `PRE-DESIGN-004`  
**Stage:** Stage 4 — Revised Mock-Up  
**Supersedes:** `docs/mockups/DESIGN_SYSTEM.md` (v1.0)

---

## 1. Summary of Revisions from v1.0 (Driven by Stage 3 Research)

| Area | v1.0 Design | v2.0 Revision | Research Rationale |
|---|---|---|---|
| **Pre-Comp Navigation** | Tab-only switching | **Inline Comp Breadcrumb Trail** (`Master_Comp ▸ HUD_Precomp ▸ Ring_Rig`) integrated into Viewer & Timeline headers | Solves `UX-04` (Pre-Comp tab clutter in AE) |
| **Node Graph Ports & Cards** | Simple left-to-right 1-port boxes | **Nuke/Fusion-Grade Typed Multi-Port Nodes**: `B` (Background blue), `A` (Foreground amber), `M` (Matte purple) ports + optional **48×27 Live Thumbnail** inside each node + minimap | Learned from Nuke & Resolve Fusion in `COMPETITIVE_ANALYSIS.md` |
| **Graph Editor** | Separate Value or Speed view | **Dual Value + Speed Overlay Mode** with colour-coded X (`#F87171`), Y (`#4ADE80`), Z (`#60A5FA`), and Speed (`#FBBF24` dashed) curves + quick Easy Ease / Overshoot / Bounce pills | Solves `UX-02` |
| **Expression Editor** | Plain code box | **1-Click Snippet Chips** (`+ Wiggle`, `+ LoopOut`, `+ Inertial Bounce`, `+ Time*Speed`, `+ Audio React`) + non-blocking amber/red inline line-pointer banner | Solves `UX-05` & `UX-09` |
| **Per-Effect Telemetry** | Static `ms` label | **3-Tier Colour Micro-Meter** (`<=2.0ms` `#22C55E`, `2.1..6.0ms` `#F59E0B`, `>6.0ms` `#EF4444`) + one-click `[Solo Cost]` button | Solves `UX-01` |
| **Snapshot Comparison** | Toolbar button only | **On-Canvas Draggable Split-Wipe Handle** (`◄|►`) with `A / B` badges and angle/position readout | Solves `UX-08` (Nuke Viewer wipe ergonomics) |
| **Accessibility & Colour-Blind Safety** | 16 hue labels | Added **Okabe-Ito High-Distinction Palette** + mandatory `[Txt]`, `[Shp]`, `[Adj]`, `[Cam]`, `[Lgt]`, `[Nul]`, `[3D]`, `[Aud]`, `[Pre]` glyph/text badges + `High-Contrast Accessible` theme (`#000000` bg, `#FFFFFF` text, `2px` `#FFD400` focus ring) | Informed by `UX_RESEARCH.md` §3 |
| **Responsive Breakpoints** | Fixed `1600×960` desktop assumption | **3 Responsive Studio Breakpoints**: `Compact Laptop (1280×720)`, `Standard HD (1600×900 / 1920×1080)`, `Ultrawide / Dual-Monitor (2560×1440+)` | Ensures zero crowding on 13" laptops and Arena split-screen previews |

---

## 2. Finalised v2 CSS Custom Property Tokens

```css
:root, [data-theme="dark"] {
  --bg-app: #0B0D11;
  --bg-panel: #13161C;
  --bg-panel-alt: #171B23;
  --bg-header: #1B2029;
  --bg-elevated: #222834;
  --bg-hover: #2B3343;
  --bg-selected: #21324A;
  --bg-viewer: #08090C;
  --border-subtle: #242A36;
  --border-strong: #353E50;
  --text-primary: #ECF0F7;
  --text-secondary: #9BA5B7;
  --text-muted: #667085;
  --accent-amber: #E89B3C;
  --accent-amber-hover: #F3AC54;
  --accent-cyan: #38BDF8;
  --accent-purple: #A855F7;
  --status-ok: #22C55E;
  --status-warn: #F59E0B;
  --status-err: #EF4444;
  --focus-ring: 0 0 0 1.5px #38BDF8;
}

[data-theme="light"] {
  --bg-app: #CBD2DE;
  --bg-panel: #F4F6F9;
  --bg-panel-alt: #EAEFF5;
  --bg-header: #E1E6EF;
  --bg-elevated: #FFFFFF;
  --bg-hover: #D8E0EC;
  --bg-selected: #CFE4FA;
  --bg-viewer: #181C24;
  --border-subtle: #D1D8E4;
  --border-strong: #AEBACD;
  --text-primary: #12161F;
  --text-secondary: #485366;
  --text-muted: #6E7A90;
  --accent-amber: #BE6E0E;
  --accent-amber-hover: #9E5908;
  --accent-cyan: #0284C7;
  --accent-purple: #7E22CE;
  --status-ok: #15803D;
  --status-warn: #B45309;
  --status-err: #DC2626;
  --focus-ring: 0 0 0 2px #0284C7;
}

[data-theme="high-contrast"] {
  --bg-app: #000000;
  --bg-panel: #07090D;
  --bg-panel-alt: #0E1117;
  --bg-header: #12161F;
  --bg-elevated: #171C26;
  --bg-hover: #252E3F;
  --bg-selected: #0F3A66;
  --bg-viewer: #000000;
  --border-subtle: #4A5568;
  --border-strong: #CBD5E1;
  --text-primary: #FFFFFF;
  --text-secondary: #E2E8F0;
  --text-muted: #A0AEC0;
  --accent-amber: #FFB703;
  --accent-cyan: #00E5FF;
  --focus-ring: 0 0 0 2px #FFD400;
}
```

---

## 3. Responsive Density Rules

- **Ultrawide (`>= 1920px`)**: Left Dock `320px`, Center Viewer flex `1fr`, Right Dock `380px` (dual-stacked Effect Controls + Scopes), Timeline `360px` height with all switch/mode/matte/parent/profiler columns visible.
- **Standard / Laptop (`1280px`–`1919px`)**: Left Dock `260px`, Center Viewer flex `1fr`, Right Dock `330px` (tabbed Effect Controls / Character / Scopes / Profiler / Assets), Timeline `290px` height with collapsible `[Switches | Modes | Parent]` column groups.
- **Compact Split-Preview (`< 1280px`)**: Icon-compact toolbar labels, collapsible side docks (`[◄]` / `[►]` drawer buttons), maximizing Composition Viewer + Timeline real estate.
