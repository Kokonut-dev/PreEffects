# PreEffects — UI Interaction Specifications & Default Keymap

**Document ID:** `PRE-DESIGN-003`  
**Stage:** Stage 2 — Initial Mock-Up  

---

## 1. Panel Docking, Splitting & Multi-Monitor Behaviour

- **Tab Reordering & Grouping**: Drag any panel tab horizontally within its header to reorder, or onto another panel's header to merge into a tabbed group.
- **Edge Split Docking**: Dragging a tab onto the top/bottom/left/right `25%` drop zone of any panel displays a translucent Signal Cyan (`rgba(56, 189, 248, 0.16)`) preview rectangle and splits the container `50/50`.
- **Proportional Resizing**: Dragging any `2px` panel divider resizes adjacent panels smoothly at `60fps` while enforcing minimum usable dimensions (`200px` width, `120px` height); double-clicking a splitter resets to workspace default ratio.
- **Panel Maximize (Tilde `` ` ``)**: Pressing `` ` `` instantly maximizes the panel currently under the pointer (or focused panel) to `100%` of the window; pressing `` ` `` again restores the multi-panel layout.
- **Secondary Viewer Tear-Off**: `Window > Workspace > Detach Secondary Viewer Window` opens a synchronized frameless/windowed Composition Viewer for dual-monitor studio setups.

---

## 2. Drag-and-Drop Matrix

| Drag Source | Drop Target | Resulting Action |
|---|---|---|
| OS File Manager (`mp4/png/wav/psd/obj/prex`) | Project Panel | Imports assets (or opens `.prex` project) locally |
| OS File Manager / Project Asset | Composition Viewer | Creates new Layer centered at drop coordinates `(x, y)` |
| Project Asset (Multiple Selected) | Timeline Track List | Inserts layers at exact hierarchy row index starting at `00:00:00:00` (or Playhead if `Alt` held) |
| Project Asset | `[New Composition]` footer icon | Creates new Composition automatically matched to asset's exact resolution, FPS, and duration (or opens Sequence Layers dialog if multiple assets dropped) |
| Project Asset (`Alt` held) | Selected Timeline Layer | Replaces layer source while preserving all keyframes, masks, effects, and expressions! |
| Effect / Smart Preset | Composition Layer or Timeline Row or Effect Controls | Applies effect/preset to target layer(s) and reveals parameters |
| Layer Parent Spiral (`Pick Whip`) | Target Timeline Layer | Sets parent while keeping current world transform visually unchanged |
| Track Matte Spiral (`Pick Whip`) | Any Layer in Timeline | Assigns arbitrary layer as Alpha Matte (`Alt` toggles Luma Matte) |
| Property Expression Spiral (`Pick Whip`) | Any Layer / Property / Effect Slider / Comp | Inserts valid expression path string into active Expression Editor |

---

## 3. Scrubbing & Playback Ergonomics

- **Playhead Scrubbing**: Dragging in the Timeline ruler moves the playhead immediately; holding `Shift` snaps to nearby keyframes, layer In/Out points, markers, and work-area brackets.
- **Audio Scrub**: Holding `Ctrl/Cmd` while dragging the playhead plays short `40ms` audio grains at the playhead frame for frame-accurate beat syncing.
- **J / K / L Shuttle Transport**:
  - `L`: Play forward (`1x` -> `2x` -> `4x` on repeated presses)
  - `K`: Pause immediately
  - `J`: Play reverse (`-1x` -> `-2x` -> `-4x` on repeated presses)
  - `K + L` / `K + J`: Step 1 frame forward / backward
- **Spacebar / `0` (Numpad)**: Toggle RAM Preview playback over Work Area (`B`..`N`), green-barring cached frames in real time.

---

## 4. Keyframe & Curve Manipulation Gestures

- **Stopwatch Click (`⏱`)**: Click when off -> creates first keyframe at current time. Click when on -> removes all keyframes on property (undoable) while retaining value at current frame. `Alt + Click Stopwatch` -> toggles Expression on property.
- **Timeline Keyframe Gestures**:
  - Click / Shift-Click / Marquee-drag: Select one or multiple keyframes across multiple layers.
  - Drag horizontally: Retime selected keyframes (`Shift` snaps to playhead/other keyframes).
  - `Alt + Drag` outermost selected keyframe: Proportionally accordion-scales all selected keyframe intervals!
  - `Ctrl/Cmd + Click` keyframe: Cycles Linear (`◆`) -> Auto-Bezier (`●`) -> Linear; `Ctrl/Cmd + Alt + Click` toggles Hold (`◧`).
- **Graph Editor Gestures**:
  - Drag keyframe node vertically (Value/Speed) or horizontally (Time; `Shift` locks axis).
  - Drag yellow Bezier handle: Adjusts velocity slope and influence `%` (`Alt` breaks continuous handle symmetry into split incoming/outgoing tangents).

---

## 5. Zoom, Pan & Selection Across Zoomable Canvases

| Canvas | Pan | Zoom | Frame / Fit | Selection |
|---|---|---|---|---|
| **Composition Viewer** | Middle-Mouse drag or `Space + Drag` | Scroll wheel (cursor-centered) or `,` / `.` | `Shift + /` (Fit), `100%` button | Click layer, `Shift+Click` multi, Marquee box, vertex lasso in Mask/Shape edit |
| **Timeline / Dope Sheet** | Middle-Mouse drag or Scrollbar | `Alt + Scroll` or `=` / `-` (playhead-centered) | `;` (Zoom full comp <-> frame level) | Click row, `Shift+Click` range, `Ctrl/Cmd+Click` toggle, Marquee keyframes |
| **Graph Editor** | Middle-Mouse drag or `Space + Drag` | `Alt + Scroll` (time) / `Shift + Scroll` (value) | `F` (Auto-fit selected curves) | Box-select nodes, click curve legend |
| **Node Graph (`EXCEED-01`)** | Middle-Mouse drag or `Space + Drag` | Scroll wheel (cursor-centered) | `F` (Frame selected / all nodes), `L` (Auto-layout) | Click node, Box-select nodes, drag port-to-port noodles (`Alt+Drag` cuts noodle) |

---

## 6. Default Keyboard Shortcut Map (AE-Compatible, Fully Customisable)

| Shortcut | Action |
|---|---|
| `Ctrl/Cmd + K` (or `Ctrl/Cmd + Shift + P`) | Open Search Everything / Command Palette (Comp Settings on `Ctrl/Cmd + Shift + K` or Comp menu) |
| `Ctrl/Cmd + N` | New Composition |
| `Ctrl/Cmd + Y` / `Ctrl/Cmd + Alt + Y` | New Solid / New Adjustment Layer |
| `Ctrl/Cmd + Alt + Shift + T / Y / C / L` | New Text / Null / Camera / Light Layer |
| `Space` | Play / Pause RAM Preview |
| `J` / `K` / `L` | Reverse / Stop / Forward Shuttle |
| `Home` / `End` | Go to Start / End of Composition |
| `Shift + Home` / `Shift + End` | Go to Start / End of Work Area |
| `PageUp` / `PageDown` (or `Left` / `Right`) | Step 1 Frame Backward / Forward (`+Shift` = 10 frames) |
| `B` / `N` | Set Work Area Start / End to Playhead |
| `[` / `]` | Align Selected Layer In / Out Point to Playhead |
| `Alt + [` / `Alt + ]` | Trim Selected Layer In / Out Point to Playhead |
| `P` / `S` / `R` / `T` / `A` | Reveal Position / Scale / Rotation / Opacity / Anchor Point (`+Shift` adds property) |
| `M` / `MM` / `F` | Reveal Mask Path / All Mask Properties / Mask Feather |
| `E` / `EE` | Reveal Effects / Expressions |
| `U` / `UU` | Reveal Keyframed Properties / All Modified Properties |
| `L` / `LL` | Reveal Audio Levels / Audio Waveform |
| `F9` / `Shift + F9` / `Ctrl/Cmd + Shift + F9` | Easy Ease / Easy Ease In / Easy Ease Out |
| `Ctrl/Cmd + D` / `Ctrl/Cmd + Shift + D` | Duplicate Layer / Split Layer at Playhead |
| `Ctrl/Cmd + Shift + C` | Pre-compose Selected Layers |
| `V` / `H` / `Z` / `W` / `C` / `Y` / `Q` / `G` | Selection / Hand / Zoom / Rotate / Camera / Pan-Behind / Shape / Pen Tools |
| `` ` `` (Backtick) | Maximize / Restore Panel Under Pointer |
| `Shift + N` | Toggle Layer Stack <-> Bidirectional Node Graph View |
| `F5` / `Shift + F5` | Take Viewer Snapshot / Toggle Snapshot A/B Split Wipe |
| `Shift + F1` | Toggle "What's This?" Contextual Help Inspector |
| `Ctrl/Cmd + Z` / `Ctrl/Cmd + Shift + Z` | Undo / Redo |
| `Ctrl/Cmd + S` / `Ctrl/Cmd + M` | Save Project / Add Active Comp to Render Queue |
