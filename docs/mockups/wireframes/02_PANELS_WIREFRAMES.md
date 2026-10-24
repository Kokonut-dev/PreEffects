# Wireframes — All 27 Dockable Studio Panels

**Document ID:** `PRE-DESIGN-002B`  
**Stage:** Stage 2 — Initial Mock-Up  

Every panel below shares the standard `28px` dockable header (`[Tab Title] [Panel Options ≡]`), supports drag-to-dock into any workspace zone, maximize-on-tilde (`` ` ``), and full keyboard navigation.

---

## 1. Project Panel
- **Top Preview Strip (`72px`)**: Selected asset thumbnail (`96x54`), asset name, dimensions (`1920×1080`), frame rate (`60.00 fps`), codec/bit-depth (`RGBA 32-bpc`), usage count (`Used 3 times ▾`).
- **Search & Filter Bar**: Search input + quick filter pills (`All`, `Comps`, `Footage`, `Audio`, `Solids`, `Missing`).
- **Tree Table**: Columns `[Label] [Name] [Type] [Duration] [FPS] [Dimensions]`.
- **Footer Actions**: `[New Folder]` `[New Composition]` `[Import File]` `[Interpret Footage]` `[Bit Depth: 8/16/32 bpc]` `[Trash]`.

## 2. Composition Viewer Panel
- **Top Comp Tab Bar**: Open compositions + Breadcrumb trail (`Master_Sequence ▸ Precomp_HUD`).
- **Viewport Stage**: Hardware WebGL2 / 2D composited canvas with optional Transparency Checkerboard, Rulers, Safe Zones, Grid, 2D/3D Gizmo handles, Spatial Motion Path dots, Mask/Shape Bezier vertices, ROI frame, and Snapshot A/B Split Wipe line.
- **Bottom Viewer Bar**: `[Zoom % ▾]` `[Toggle Transparency Grid]` `[Mask/Shape Path Visibility]` `[ROI]` `[Channel: RGB/R/G/B/A ▾]` `[Resolution: Full/Half/Quarter/Auto ▾]` `[3D View: Active Camera ▾]` `[Take Snapshot]` `[Compare Snapshot]`.

## 3. Layer Controls / Layer Viewer Panel
- Dedicated pre-transform layer space viewer used for **Roto Brush**, **Paint/Clone Stamp**, and **Point/Planar Tracking** feature box placement, with Roto propagation span bar at bottom.

## 4. Timeline Panel
- **Left Header**: Current Timecode (`00:00:03:18` scrubbable), Frame (`00218`), Master Switches (`[Shy]` `[Frame Blend]` `[Motion Blur]` `[Graph Editor]`), Search properties (`🔍`), Column Toggles (`[Switches]` `[Modes & Mattes]` `[Parent]`).
- **Left Track List**: `[Eye] [Audio] [Solo] [Lock] [Label] [#] [▸] [Layer Name] [FX] [3D] [Blur] [Adj] | [Blend Mode ▾] [Track Matte ▾] [Parent ▾ + PickWhip]`. Expandable property tree: `Masks`, `Effects`, `Transform` (`Anchor`, `Position`, `Scale`, `Rotation`, `Opacity` + 3D `Z`, `Orientation`, `Material Options`), `Text` (`Source Text`, `Path Options`, `Animators`), `Contents` (Shape hierarchy), `Audio` (`Audio Levels`, `Waveform`).
- **Right Time Dope Sheet**: Work Area bar (`B`..`N`), Green RAM-Preview cached ticks, Comp Markers, Layer In/Out bars with draggable trim handles, Keyframe icons (`◆`, `⧗`, `●`, `◧`), and Tungsten Amber Playhead CTI needle.

## 5. Effect Controls Panel
- Lists effects stacked on the selected layer in execution order (`Top -> Bottom`).
- Each effect card displays: `[fx Toggle] [▸ Expand] [Effect Name] [★ Fav] [ms Cost Badge] [Reset]`.
- Auto-generated parameter widgets: ScrubInputs, Angle dials, 2D Point crosshairs (`⊕`), Colour swatches + Eyedropper, Curves splines, Layer dropdowns, LUT selectors, and stopwatch (`⏱`) to keyframe any parameter.

## 6. Effects & Presets Browser Panel
- Live instant search (`179+ effects & smart presets`), `[★ Favourites Only]` toggle, and collapsible 19-category tree with drag-to-layer or double-click-to-apply.

## 7. Character Panel
- Font Family searchable selector, Font Weight/Style, Size (`px`), Leading (`px`/Auto), Kerning, Tracking, Fill & Stroke swatch swapper, Stroke Width, Stroke Placement, Faux Bold/Italic, All Caps, Small Caps, Superscript/Subscript, Baseline Shift, Horizontal/Vertical Scale.

## 8. Paragraph Panel
- 7 Alignment buttons (`Left`, `Center`, `Right`, `Justify Left/Center/Right/All`), Left Margin, Right Margin, First-Line Indent, Space Before, Space After.

## 9. Align & Distribute Panel
- Align Layers to `Selection` or `Composition`: `[Left] [H-Center] [Right] [Top] [V-Center] [Bottom]` + Distribute `[Top] [V-Center] [Bottom] [Left] [H-Center] [Right]` + Even Spacing.

## 10. Preview (Transport) Panel
- `[First Frame |<]` `[Prev Frame <]` `[Play / Stop ▶]` `[Next Frame >]` `[Last Frame >|]`, Loop Mode (`Loop`, `Ping-Pong`, `Play Once`), Audio Mute, Play Range (`Work Area` / `Entire Comp`), Frame Rate target, Skip Frames (`0`–`5`), Caching indicator (`184 / 240 frames cached — 60.0 fps`).

## 11. Info Panel
- Real-time cursor coordinates `(X, Y)` + sampled pixel values (`R`, `G`, `B`, `A` in `8-bit 0..255` or `32-bpc float` + `HSL` + `#HEX`) + selected layer in/out duration readout.

## 12. Audio Panel
- Dual-channel Left/Right peak + RMS VU meter (`-60 dB` to `0 dB` with peak clip LEDs) + Master/Layer dB fader (`-48 dB` to `+12 dB`) and Stereo Pan knob.

## 13. Paint & 14. Brushes Panels
- **Paint**: Opacity, Flow, Mode, Channels (`RGBA`/`RGB`/`Alpha`), Duration (`Constant`, `Write On`, `Single Frame`, `Custom`), Clone Source 1–5 presets + Source Layer/Offset/Time Shift.
- **Brushes**: Visual stroke stamp preview strip, Preset diameters (`3px`, `9px`, `25px`, `45px`, `100px` soft/hard), Diameter, Angle, Roundness, Hardness, Spacing sliders.

## 15. Tracker & Content-Aware Fill Panel
- Track Source selector, `[Track Camera]`, `[Warp Stabilizer]`, `[Track Motion]` (`Position`, `Rotation`, `Scale`, `Perspective Corner Pin`, `Planar`), `[Track Face]`, Analyze `[|<] [<] [▶] [>]`, Motion Target layer picker, `[Apply X & Y]`, and **Content-Aware Fill** (`Object / Surface / Edge Blend` -> `[Generate Fill Layer]`).

## 16. Render Queue Panel
- Multi-job table: `[✓] [#] [Composition] [Status] [Render Settings ▾] [Log]`, expandable **Output Modules** (`1..N` per job: Format `MP4 / WebM / MOV ProRes / GIF / PNG Seq / EXR / WAV`, Channels `RGB / RGB+Alpha`, AOV Passes, Output To path), live progress bar, elapsed/ETA timer, `[Queue in Background]` and `[Render]` primary button.

## 17. Unified Graph Editor Panel
- Replaces or splits with the Timeline dope sheet. Mode switcher: `[Value Graph]` / `[Speed Graph]` / `[Both Overlay]`, Auto-Zoom Height, Snap, Show Reference Graph, Easy Ease / Ease In / Ease Out / Hold toolbar buttons, and multi-coloured property splines (Red = X, Green = Y, Blue = Z, Amber = Scalar/Speed) with draggable yellow cubic Bezier velocity/influence tangent handles.

## 18. Motion Sketch, 19. Smoother & 20. Wiggler Utility Panels
- **Motion Sketch**: Capture Speed (`100%`), Smoothing, Wireframe/Background checkboxes, `[Start Capture]` records live mouse path directly into Position keyframes!
- **Smoother**: Apply To (`Spatial Path` / `Temporal Graph`), Tolerance slider, `[Apply]` simplifies dense keyframe curves.
- **Wiggler**: Apply To (`Spatial` / `Temporal`), Noise Type (`Smooth` / `Jagged`), Dimensions (`All Independently` / `All Same`), Frequency (`/sec`), Magnitude, `[Apply]`.

## 21. Expression Editor & 22. Multi-Language Script Console
- **Expression Editor**: Inline expandable panel + dedicated docked editor with line numbers, token syntax highlighting, Pick Whip button, Function Reference menu (`Interpolation`, `Random`, `Vector Math`, `Comp/Layer`, `Loop`), and live preview value readout.
- **Script Editor**: Language tabs `[JavaScript]` `[Python]` `[Lua]`, built-in sample automation scripts (e.g. *Grid Stagger Generator*, *Batch Rename & Colour*, *Procedural Kinetic Rig*), `[▶ Run Script]` button, and structured output/error console.

## 23. Preferences Inspector Panel / Modal
- 9 organized categories: General, Previews, Display, Import, Output, Grids & Guides, Labels, Media & Disk Cache, Appearance & Accessibility.

## 24. Bidirectional Node Graph Panel (`EXCEED-01`)
- Zoomable/pannable dotted grid canvas showing live DAG nodes (`[Footage/Solid/Shape/Text]` -> `[Transform]` -> `[Effect Chain / Parallel Branches]` -> `[Mask/Roto]` -> `[Merge (Blend Mode)]` -> `[Comp Output]`). Includes minimap, `[Auto-Layout]`, `[+ Add Node]`, per-node preview thumbnail toggle, and bidirectional selection sync with Timeline.

## 25. Integrated Local Asset Library Panel (`EXCEED-09`)
- Offline studio pack browser: **Lower Thirds**, **Kinetic Titles**, **Sci-Fi HUD Elements**, **Particle Presets**, **Transitions**, **Procedural Textures**, and **Cinematic `.cube` LUTs** with one-click insert into active composition.

## 26. Real-Time Performance Profiler Panel (`EXCEED-15`)
- Frame budget header (`6.4 ms / 16.67 ms — 156 fps headroom`), RAM Cache & Disk Cache gauges, and horizontal flame-bar breakdown per layer and per effect sorted by render cost with one-click solo/bypass to diagnose heavy effects.

## 27. Broadcast Colour Scopes Panel (`UI-06`)
- Live 4-up or single-scope view computed from active comp framebuffer: **RGB Histogram**, **Luma/RGB Waveform**, **RGB Parade**, and **Chroma Vectorscope** (with 75% targets & skin-tone `I`-line).
