# Wireframes — Application Layout, Menu Bar, Tool States & Context Menus

**Document ID:** `PRE-DESIGN-002A`  
**Stage:** Stage 2 — Initial Mock-Up  

---

## 1. Main Application Layout (Default Studio Workspace)

```text
+----------------------------------------------------------------------------------------------------------------------+
| [PreEffects Icon]  File  Edit  Composition  Layer  Effect  Animation  View  Window  Help        [Search / Cmd+K] [_□X]|
+----------------------------------------------------------------------------------------------------------------------+
| [V][H][Z] | [R][C][Y] | [□][✒][T] | [🖌][☍][⌫][✂] | [📌] || [Snap] [Grid] [3D] || Workspace: [Standard ▾][Node][Anim]|
+------------------------+-----------------------------------------------------------+---------------------------------+
| [Project*] [Assets]    |  [Comp: SHOT_040_HERO_TITLE ×] [Precomp_BG ×] [Layer]     | [Effect Controls*] [Effects]    |
|------------------------|-----------------------------------------------------------| [Character] [Scopes] [Profiler] |
| [🔍 Filter 500 items.] |  +-----------------------------------------------------+  |---------------------------------|
| [📁][🎬][🗋][🗑]  8bpc |  |   SAFE ZONE ┌───────────────────────────────────┐   |  | fx Gaussian Blur       [1.2ms]  |
| ▾ 📁 01_Compositions   |  |             │                                   │   |  |   ▸ Blurriness          18.0    |
|    🎬 SHOT_040_HERO    |  |             │       P R E E F F E C T S         │   |  |   ▸ Blur Dimensions  Horiz&Vert |
|    🎬 Precomp_Grid     |  |             │     MOTION STUDIO // 60 FPS       │   |  | fx Glow                [1.8ms]  |
| ▾ 📁 02_Footage        |  |             │          [ ⊕ Anchor ]             │   |  |   ▸ Glow Threshold      62.0%   |
|    🎞 aerial_plate.mp4 |  |             └───────────────────────────────────┘   |  |   ▸ Glow Radius         44.0    |
|    🖼 hud_atlas.psd    |  +-----------------------------------------------------+  |   ▸ Glow Intensity       1.4    |
|    🔊 pulse_bass.wav   |  [50% ▾] [Full ▾] [RGB ▾] [ROI] [Snap A/B] [Active Cam ▾] |---------------------------------|
|                        |                                                           | [Preview] ⏮ ⏪ ▶ ⏩ ⏭ [Loop] 60fps|
+------------------------+-----------------------------------------------------------+---------------------------------+
| [00:00:03:18]  f:0218  | [Layers] [Node Graph] [Graph Editor] | [Shy][Frm][Blur][3D] | [🔍 Search timeline...] [+Layer]|
|---------------------------------------------------------------|------------------------------------------------------|
| 👁 🔊 ● 🔒  #  Layer Name          Mode     TrkMat  Parent    | 00s       01s       02s       03s▼      04s       05s|
|---------------------------------------------------------------|----------------------------------▼-------------------|
| 👁    ·     1  [T] HERO_TITLE      Normal   None    3.Null    | █████████████████████████████████▼██████████████████ |
|      ▸ Transform: Position  [960.0, 540.0]  ⏱ [Expression]   |      ◆──────────⧗────────────────▼──────⧗            |
| 👁    ·     2  [★] Trim_Accent     Add      None    3.Null    |    ██████████████████████████████▼██████████████████ |
| 👁    ·     3  [⌖] Master_Null     —        —       None      | ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░▼░░░░░░░░░░░░░░░░░░ |
| 👁    ·     4  [◐] Grade_LUT_Adj   Normal   None    None      | █████████████████████████████████▼██████████████████ |
| 👁 🔊 ·     5  [🔊] pulse_bass.wav —        —       None      | ∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿▼∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿ |
+----------------------------------------------------------------------------------------------------------------------+
| Ready — Hover any control or press [?] for help  |  X: 960 Y: 540  RGBA: 0.92, 0.61, 0.24, 1.00  |  RAM: 184MB  GPU ●|
+----------------------------------------------------------------------------------------------------------------------+
```

---

## 2. Complete Menu Bar Structure

### `File`
- New -> New Project (`Ctrl/Cmd+Alt+N`), New Folder, New Template Project...
- Open Project... (`Ctrl/Cmd+O`)
- Open Recent -> *(10 local recent `.prex` paths + Clear Recent)*
- Browse Template Projects...
- Close Project (`Ctrl/Cmd+W`)
- Save (`Ctrl/Cmd+S`), Save As... (`Ctrl/Cmd+Shift+S`), Save a Copy..., Increment and Save (`Ctrl/Cmd+Alt+Shift+S`)
- Save Snapshot Commit... *(Local Version History)*
- Revert to Saved
- Import -> File... (`Ctrl/Cmd+I`), Multiple Files... (`Ctrl/Cmd+Alt+I`), Layered PSD/SVG as Composition..., JSON/CSV Data Asset..., 3D Model (`.obj`/`.gltf`)..., Final Cut XML / EDL...
- Export -> Add to Render Queue (`Ctrl/Cmd+M`), Quick Export (Last Settings) (`Ctrl/Cmd+Shift+E`), Export Frame as PNG..., Export Project Interchange (XML / EDL / JSON)...
- Dependencies -> Collect Files (Package Project)..., Find Missing Footage, Remove Unused Footage, Consolidate All Footage
- Project Settings... (`Ctrl/Cmd+Alt+Shift+K`)
- Exit / Quit PreEffects (`Ctrl/Cmd+Q`)

### `Edit`
- Undo `<Action>` (`Ctrl/Cmd+Z`), Redo `<Action>` (`Ctrl/Cmd+Shift+Z`), Undo History...
- Cut (`Ctrl/Cmd+X`), Copy (`Ctrl/Cmd+C`), Copy with Property Links (`Ctrl/Cmd+Alt+C`), Paste (`Ctrl/Cmd+V`), Clear (`Delete`)
- Duplicate (`Ctrl/Cmd+D`), Smart Duplicate with Expression Relink (`Ctrl/Cmd+Alt+D`)
- Split Layer at Playhead (`Ctrl/Cmd+Shift+D`)
- Lift Work Area, Extract Work Area
- Select All (`Ctrl/Cmd+A`), Deselect All (`F2` / `Ctrl/Cmd+Shift+A`), Select Layers by Label Group
- Purge -> All Memory & Disk Cache..., Image Cache Memory, Undo History, Snapshot Buffers
- Templates -> Render Settings..., Output Modules...
- Keyboard Shortcuts... (`Ctrl/Cmd+Alt+'`)
- Preferences -> General..., Previews & Performance..., Display & Appearance..., Import & Output..., Grids & Guides..., Memory & Disk Cache..., Audio Hardware..., Auto-Save & Recovery..., Accessibility...

### `Composition`
- New Composition... (`Ctrl/Cmd+N`)
- Composition Settings... (`Ctrl/Cmd+K`)
- Set Poster Time
- Trim Comp to Work Area (`Ctrl/Cmd+Shift+X`)
- Crop Comp to Region of Interest
- Add to Render Queue (`Ctrl/Cmd+M`)
- Add Output Module
- Save Frame As -> PNG File..., Layered PSD Preview...
- Take Frame Snapshot (`F5`), Toggle Snapshot A/B Wipe (`Shift+F5`)
- Pre-render...
- Composition Flowchart / Open in Node Graph (`Shift+N`)

### `Layer`
- New -> Text (`Ctrl/Cmd+Alt+Shift+T`), Solid... (`Ctrl/Cmd+Y`), Light... (`Ctrl/Cmd+Alt+Shift+L`), Camera... (`Ctrl/Cmd+Alt+Shift+C`), Null Object (`Ctrl/Cmd+Alt+Shift+Y`), Shape Layer, Adjustment Layer (`Ctrl/Cmd+Alt+Y`), 3D Model Layer..., Guide Layer
- Layer Settings... (`Ctrl/Cmd+Shift+Y`)
- Open Layer / Pre-Comp
- Masks -> New Mask (`Ctrl/Cmd+Shift+N`), Mask Shape..., Mask Feather..., Invert (`Ctrl/Cmd+Shift+I`), Reset Mask, Mode (None/Add/Subtract/Intersect/Lighten/Darken/Difference)
- Quality and Sampling -> Best, Draft, Wireframe | Bilinear, Bicubic
- Switches -> Hide Other Video, Show All Video, Unlock All Layers, Shy, Solo, Collapse Transformations, Guide Layer, Adjustment Layer
- Transform -> Anchor Point, Position, Scale, Rotation, Opacity | Flip Horizontal, Flip Vertical, Center in View (`Ctrl/Cmd+Home`), Center Anchor Point in Layer Content (`Ctrl/Cmd+Alt+Home`), Fit to Comp (`Ctrl/Cmd+Alt+F`), Fit to Comp Width, Fit to Comp Height, Auto-Orient...
- Time -> Enable Time Remapping (`Ctrl/Cmd+Alt+T`), Time-Reverse Layer (`Ctrl/Cmd+Alt+R`), Time Stretch..., Freeze Frame, Freeze on Last Frame
- Frame Blending -> Off, Frame Mix, Pixel Motion
- 3D Layer, Geometry Options, Material Options
- Blending Mode -> *(All 38 modes grouped)*
- Track Matte -> No Track Matte, Alpha Matte, Alpha Inverted, Luma Matte, Luma Inverted
- Arrange -> Bring Layer to Front, Bring Forward (`Ctrl/Cmd+]`), Send Backward (`Ctrl/Cmd+[`), Send to Back
- Create -> Create Shapes from Vector/Text, Convert Audio to Keyframes, Convert Expression to Keyframes
- Pre-compose... (`Ctrl/Cmd+Shift+C`)

### `Effect`
- Effect Controls (`F3`)
- Apply Last Effect (`Ctrl/Cmd+Alt+Shift+E`)
- Remove All (`Ctrl/Cmd+Shift+E`)
- Manage Effects & Plugins...
- *(All 19 Effect Category Submenus listing all built-in effects alphabetically)*

### `Animation`
- Save Animation Preset..., Apply Animation Preset..., Browse Smart Adaptive Presets...
- Add Keyframe (`Alt+Shift+P/S/R/T`)
- Toggle Hold Keyframe (`Ctrl/Cmd+Alt+H`)
- Keyframe Interpolation..., Keyframe Velocity...
- Keyframe Assistant -> Easy Ease (`F9`), Easy Ease In (`Shift+F9`), Easy Ease Out (`Ctrl/Cmd+Shift+F9`), Sequence Layers..., Time-Reverse Keyframes, Convert Audio to Keyframes, Convert Expression to Keyframes, Exponential Scale
- Animate Text -> Position, Scale, Skew, Rotation, Opacity, Tracking, Fill Color, Stroke Color, Blur, Enable Per-Character 3D
- Add Expression (`Alt+Click Stopwatch`)
- Separate Dimensions
- Track Camera, Track Motion, Warp Stabilizer VFX, Track Mask, Track Face, Content-Aware Fill
- Reveal Properties with Keyframes (`U`), Reveal All Modified Properties (`UU`)

### `View`
- Zoom In (`=`), Zoom Out (`-`), Fit (`Shift+/`)
- Resolution -> Full (`Ctrl/Cmd+J`), Half (`Ctrl/Cmd+Shift+J`), Third, Quarter (`Ctrl/Cmd+Alt+Shift+J`), Custom...
- Show Rulers (`Ctrl/Cmd+R`), Show Guides (`Ctrl/Cmd+;`), Snap to Guides (`Ctrl/Cmd+Shift+;`), Lock Guides, Clear Guides
- Show Grid (`Ctrl/Cmd+'`), Snap to Grid (`Ctrl/Cmd+Shift+'`), Show Action/Title Safe Zones (`'`)
- Show Layer Controls (`Ctrl/Cmd+Shift+H`)
- Switch 3D View -> Active Camera, Front, Left, Top, Back, Right, Bottom, Custom View 1/2/3
- Channels -> RGB, Red, Green, Blue, Alpha, Alpha Boundary
- Enable Display Colour Management / View LUT

### `Window`
- Workspace -> Default (Standard), Animation, Compositing & VFX, Node Graph, Text & Typography, Colour & Scopes, Minimal | Save Changes to This Workspace, New Workspace..., Reset Workspace, Detach Secondary Viewer Window
- Theme -> Obsidian Studio Dark, Precision Daylight Light, High-Contrast Accessible, Theme Editor...
- Toggle Panels -> Project, Composition, Timeline, Node Graph, Graph Editor, Effect Controls, Effects & Presets, Character, Paragraph, Align, Preview, Info, Audio, Colour Scopes, Paint & Brushes, Tracker, Smoother & Wiggler, Motion Sketch, Expression & Script Console, Asset Library, Version History, Performance Profiler, Render Queue

### `Help`
- Search Everything / Command Palette... (`Ctrl/Cmd+K`)
- Interactive PreEffects Manual & Tutorials (`F1`)
- Enter "What's This?" Inspector Mode (`Shift+F1`)
- Keyboard Shortcut Cheat Sheet...
- Welcome & Template Launcher...
- System & GPU Diagnostics...
- About PreEffects...

---

## 3. Tool States & Cursor Matrix

| Tool | Shortcut | Default Cursor | Active Drag / Modifier Cursor |
|---|---|---|---|
| Selection Tool | `V` | Precision dark arrow | Move arrow (`+Shift` axis constrain; over corner handle = bidirectional resize) |
| Hand Tool | `H` / Hold `Space` | Open hand | Closed grabbing hand (pans Viewer, Timeline, Graph, or Node Graph) |
| Zoom Tool | `Z` | Magnifier `+` | `+Alt` switches to Magnifier `-`; drag draws marquee zoom box |
| Rotation Tool | `W` | Circular rotation arc | Live angle delta HUD (`+Shift` snaps `45°` increments) |
| Camera Orbit / Track XY / Track Z | `C` | 3D camera rig icon | Cycles Unified Orbit -> Track XY -> Dolly Z on repeated `C` |
| Pan Behind (Anchor Point) | `Y` | Target crosshair | Moves layer Anchor Point while counter-compensating Position so visual stays pinned |
| Shape Tools (Rect / RoundRect / Ellipse / Polygon / Star) | `Q` | Crosshair + shape badge | Creates new Shape Layer (or Mask if footage layer selected & Mask mode toggled) |
| Pen Tool (Add / Delete / Convert Vertex) | `G` | Fountain pen nib | `+` near segment, `-` over vertex, `∧` (`Alt`) to break/drag Bezier tangent handles |
| Text Tool (Horizontal / Vertical) | `Ctrl/Cmd+T` | I-beam with frame | Click = Point Text; Drag = Paragraph Text box |
| Brush / Clone Stamp / Eraser Tools | `Ctrl/Cmd+B` | Circle sized to brush diameter (`[` / `]` resize) | `+Alt` on Clone sets source crosshair (`⊕`); `Ctrl+Drag` adjusts diameter/hardness |
| Roto Brush & Refine Edge Tool | `Alt+W` | Green `+` circle (FG) | Hold `Alt` = Red `-` circle (BG exclusion stroke) |
| Puppet / Pin Deform Tool | `Ctrl/Cmd+P` | Push-pin icon | Places mesh deform pin on layer |

---

## 4. Contextual Right-Click Menus

1. **Timeline Layer Row Context Menu**: Rename, Label Colour (16 swatches), Open Layer/Pre-Comp, Pre-compose..., Duplicate, Smart Duplicate, Split Layer, Enable Time Remapping, Time Stretch..., Blending Mode ▸, Track Matte ▸, Masks ▸, Effect ▸, Transform ▸ (Reset, Center in View, Fit to Comp, Auto-Orient), Quality, Switches ▸ (3D, Motion Blur, Guide, Adjustment), Reveal in Project, Delete.
2. **Composition Viewer Context Menu**: New (Text, Solid, Shape, Null, Camera, Light, Adjustment), Fit to View, Resolution ▸, Guides & Safe Zones ▸, Take Snapshot, Switch 3D View ▸, Mask & Shape Path Operations ▸.
3. **Project Panel Item Context Menu**: Open Composition / Footage, New Comp from Selection, Interpret Footage -> Main..., Replace Footage..., Reload Footage, Create Proxy..., Reveal Metadata, Duplicate, Colour Label ▸, Delete.
4. **Effect Header Context Menu (in Effect Controls)**: Toggle Active (`fx`), Reset Effect, Duplicate Effect, Save as Effect Preset..., Add to Favourites (`★`), Copy with Property Links, Open in Node Graph, Delete Effect.
5. **Keyframe Context Menu**: Keyframe Interpolation... (Linear / Bezier / Auto-Bezier / Continuous / Hold), Keyframe Velocity..., Easy Ease (`F9`), Easy Ease In, Easy Ease Out, Toggle Hold Keyframe, Rove Across Time, Time-Reverse Keyframes, Copy, Delete.
6. **Node Graph Canvas Context Menu**: Add Node ▸ (Read, Solid, Shape, Text, Transform, Merge, Blur, Grade, Keylight, Roto, Camera3D, Write), Auto-Layout Graph (`L`), Group into Pre-Comp, Bypass Selected (`D`), Frame Selected (`F`), Sync Selection to Timeline.
