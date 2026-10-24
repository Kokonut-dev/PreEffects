# PreEffects — Development Roadmap & Milestones

**Document ID:** `PRE-PLAN-004`  
**Stage:** Stage 1 — Planning  

---

## 1. Sequential Stage Plan

PreEffects follows a strict gated lifecycle. Every stage produces verifiable repository artefacts and must meet 100% of its completion criteria before advancing.

| Stage | Milestone | Key Deliverables | Estimated Scope | Gate Criteria |
|---|---|---|---|---|
| **Setup** | M0: Repository Foundation | Folder hierarchy, `LICENSE`, `README.md`, `CHANGELOG.md`, GitHub Actions CI & Release workflows, packaging manifests | Foundation | Clean install + green structure |
| **Stage 1** | M1: Planning | `PRD.md`, `FEATURES.md` (100% AE + 18 exceeding), `ARCHITECTURE.md`, `ROADMAP.md`, `RISKS.md` | 5 core specs | Zero missing AE features; justified stack |
| **Stage 2** | M2: Initial Mock-Up (v1) | `DESIGN_SYSTEM.md`, Wireframes (26 panels, 13 dialogs, menus, context menus), 5 Hi-Fi SVG/PNG mockups, `INTERACTIONS.md` | Full UI/UX v1 | Every feature mapped to UI; non-generic studio aesthetic |
| **Stage 3** | M3: Peer & Tech Research | `COMPETITIVE_ANALYSIS.md` (9 apps), `TECHNICAL_RESEARCH.md`, `DEPENDENCIES.md`, `UX_RESEARCH.md` (14 AE UX fixes) | 4 deep studies | All algorithms & MIT-compatible deps verified |
| **Stage 4** | M4: Revised Mock-Up (v2) | `DESIGN_SYSTEM_V2.md`, 4 Revised Hi-Fi Mockups, Clickable HTML Prototype (`prototype/index.html`), `UI_SPEC.md` | Full UI/UX v2 | Research findings applied; pixel-level spec locked |
| **Stage 5** | M5: Spec Verification & POCs | `FEATURE_AUDIT.md`, `TEST_PLAN.md`, 7 executable POCs in `src/poc/`, `ARCHITECTURE_V2.md` | Audit + 7 POCs | 0 missing items; all 7 POC tests pass |
| **Stage 6** | M6: Core Creation (6.1–6.17) | Complete PreEffects Engine, 11 Layer Types, 145 Effects, Expressions, Masks/Roto, 3D, Tracking, Paint, Audio, Render Queue, Node Graph, Electron Main/Preload | ~15k+ LOC + tests | All features working end-to-end; all unit/integration tests pass |
| **Stage 7** | M7: Quality of Life | Command Palette, Welcome Screen, What's This?, Theme Editor, Snapshots A/B, Auto-Recovery, Cache UI, Full Accessibility | Studio workflow polish | Smooth zero-friction daily workflows |
| **Stage 8** | M8: Aesthetics | Original crisp vector icon pack, App Icon & Splash, Obsidian Dark + Precision Light polish, microinteractions, empty/error states | Visual perfection | Indistinguishable from commercial flagship creative software |
| **Stage 9** | M9: Optimisation Round 1 | CPU/GPU/Memory/Startup/IO profiling (`round1/`), virtualized timeline/project list, LRU frame caching, fast typed-array kernels | >= 5 major speedups | Measurable before/after benchmark gains |
| **Stage 10** | M10: Bug Fixes Round 1 | Full Test Plan sweep, edge-case hardening, shortcut/path cross-platform parity, `BUG_TRACKER.md` | Zero open bugs | All tests green on Linux/macOS/Windows configs |
| **Stage 11** | M11: Reimplementation | `CODE_REVIEW.md`, modular decomposition, strict types, zero technical debt, `CONTRIBUTING.md` | Codebase audit | Clean architecture, updated docs, green tests |
| **Stage 12** | M12: Optimisation Round 2 | Post-refactor profiling (`round2/`), startup < 5s, binary/bundle size optimization, shader/buffer pooling | Peak efficiency | Equal or faster than Round 1 across all benchmarks |
| **Stage 13** | M13: Bug Fixes Round 2 | Full regression + stress soak testing (100+ layers, 500+ assets, rapid undo/scrub) | Rock-solid stability | Zero regressions, zero memory leaks |
| **Stage 14+** | M14: Iterative Convergence | Cycles 1, 2, 3 (`iterations/round_N/`) until <2% diminishing-returns convergence & 100% checklist sign-off | Final ship state | All Final Validation gates checked |

---

## 2. Feature Dependency Graph (Stage 6 Build Order)

```text
[6.1 Foundation: Project Model, .prex Serializer, Undo/Redo, Preferences, Shortcuts, Panel Shell]
        │
        ▼
[6.2 Core Compositing Engine: Comp Model, Transforms, 38 Blend Modes, Track Mattes, RAM/Disk Cache]
        │
        ├───────────────────────────────┬───────────────────────────────┐
        ▼                               ▼                               ▼
[6.3 Core Panels: Project,      [6.4 Animation: Keyframes,      [6.5 Effects Engine: 145 GPU/CPU
 Viewer, Timeline, Tools]        Bezier Solver, Graph Editor]    Effects, Presets, Profiler]
        │                               │                               │
        ├───────────────┬───────────────┼───────────────┬───────────────┤
        ▼               ▼               ▼               ▼               ▼
  [6.6 Masks &     [6.7 Text &     [6.8 Shape      [6.9 3D Cam,    [6.12 Expressions &
   AI Roto]         Animators]      Hierarchy]      Lights, OBJ]    Pick Whip]
        │               │               │               │               │
        └───────────────┴───────┬───────┴───────────────┴───────────────┘
                                ▼
       [6.10 Tracking] + [6.11 Paint/Clone] + [6.13 Audio DSP]
                                │
                                ▼
       [6.14 Render Queue & Multi-Format Codecs] + [6.16 Importers (PSD/SVG/CSV/EDL)]
                                │
                                ▼
       [6.15 Exceeding-AE Suite: Bidirectional Node Graph, Local AI, Py/Lua Scripts, Git Diff, Procedural]
                                │
                                ▼
       [6.17 Studio Polish: Workspaces, Search Everything, Collect Files, Missing Footage, Auto-Save]
```
