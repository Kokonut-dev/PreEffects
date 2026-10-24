# PreEffects — Exhaustive Feature Inventory

**Document ID:** `PRE-PLAN-002`  
**Stage:** Stage 1 — Planning  
**Coverage:** 100% Adobe After Effects Feature Parity + 18 Capabilities Exceeding After Effects

Every feature below carries a canonical feature group ID traced directly into Stage 2 Mockups, Stage 5 `FEATURE_AUDIT.md`, Stage 5 `TEST_PLAN.md`, and Stage 6 Implementation modules.

---

## 1. Timeline & Composition (`COMP`)

- `COMP-01` **Unlimited Nested Compositions**: Arbitrary nesting depth with automatic cycle prevention and Collapse Transformations pass-through.
- `COMP-02` **Multi-Composition Projects**: Manage dozens of compositions per project with instant tab switching and breadcrumb hierarchy navigation.
- `COMP-03` **Pre-Composing (`Ctrl/Cmd+Shift+C`)**: "Leave all attributes" or "Move all attributes into the new composition", trim to selected layer bounds, and open new pre-comp option.
- `COMP-04` **Composition Settings (`Ctrl/Cmd+K`)**: Custom & preset resolutions (720p, 1080p, 2K, UHD 4K, DCI 4K, 8K, Vertical 9:16, Square 1:1), frame rate (`1`–`240` fps including `23.976`, `29.97`, `59.94`), start timecode, duration, background colour, pixel aspect ratio, shutter angle (`0°`–`720°`), shutter phase (`-360°`–`360°`), samples per frame, and working colour space.
- `COMP-05` **Simultaneous Multi-Timeline Tabs**: Docked or stacked timeline tabs with drag-between-comp layer copy/paste.
- `COMP-06` **Timeline Zoom & Scroll**: Frame-accurate zoom from multi-minute overview down to single-frame sub-ticks, playhead-centered zoom (`+`/`-`), minimap navigator scrollbar, and middle-mouse / Space-drag pan.
- `COMP-07` **Shy, Solo, Lock, Video & Audio Switches**: Per-layer visibility eye, audio mute, solo isolation, lock guard, shy hide-in-timeline + master Shy toggle.
- `COMP-08` **Layer Parenting & Null Objects**: Arbitrary transform parenting chains with Cycle Guard, parent dropdown, interactive spiral Pick Whip, and Preserve World Transform when parenting/unparenting.
- `COMP-09` **Guide Layers**: Viewport-visible alignment/reference layers automatically omitted from Render Queue outputs unless explicitly enabled.
- `COMP-10` **Adjustment Layers**: Composite-wide effect & mask layers affecting the flattened stack below them using standard opacity and blend modes.
- `COMP-11` **Frame Blending**: Off, Frame Mix (cross-dissolve subframes), and Pixel Motion (optical-flow interpolated subframes) per layer + master comp switch.
- `COMP-12` **Motion Blur**: Per-layer toggle + master comp Motion Blur enable, using configurable shutter angle, shutter phase, and adaptive multi-subframe accumulation.
- `COMP-13` **Time Remapping (`Ctrl/Cmd+Alt+T`)**: Keyframeable source-time property allowing freeze-frames, variable speed ramps, reverse playback, and ping-pong retiming.
- `COMP-14` **Time Stretching**: Percentage stretch factor (`-1000%` to `+1000%`) anchored at Layer In-point, Current Frame, or Layer Out-point.
- `COMP-15` **Frame Rate Conversion & Pulldown**: Posterize/conform footage FPS to comp FPS with nearest, blend, or optical-flow cadence conversion.
- `COMP-16` **Composition & Layer Markers**: Named markers with comments, colour labels, duration spans, chapter/web links, and expression-accessible `marker.key(n)` parameters.
- `COMP-17` **Work Area Specification (`B` / `N`)**: Draggable work area in/out brackets governing loop preview, RAM cache range, Trim Comp to Work Area, and Render Queue range.

---

## 2. Layer Types (`LYR`)

- `LYR-01` **Solid Layers (`Ctrl/Cmd+Y`)**: Configurable width, height, pixel aspect, colour picker, "Make Comp Size", and live Solid Settings editing.
- `LYR-02` **Shape Layers**: Full hierarchical vector tree supporting:
  - Content **Groups** with independent Group Transform (Anchor, Position, Scale, Skew, Skew Axis, Rotation, Opacity)
  - Parametric Generators: **Rectangle**, **Ellipse**, **Polystar** (Star & Polygon with inner/outer radius & roundness), and **Bezier Path**
  - Styles: **Solid Fill**, **Linear Gradient Fill**, **Radial Gradient Fill**, **Solid Stroke**, **Gradient Stroke** (butt/round/projecting caps, miter/round/bevel joins, dash/gap/offset arrays)
  - Path Operators: **Merge Paths** (Add/Subtract/Intersect/Exclude Intersections), **Offset Paths**, **Trim Paths** (Start, End, Offset, Trim Multiple Shapes Simultaneously/Individually), **Pucker & Bloat**, **Repeater** (Copies, Offset, Composite Above/Below, Transform per copy), **Round Corners**, **Wiggle Paths**, **Wiggle Transform**, **Zig Zag**
- `LYR-03` **Text Layers (`Ctrl/Cmd+Alt+Shift+T`)**:
  - Point Text and bounded Paragraph Text boxes
  - Full Character formatting: Font Family, Font Style/Weight, Size, Leading, Kerning (Metrics/Optical), Tracking, Fill Colour, Stroke Colour, Stroke Width, Fill-Over-Stroke order, Faux Bold/Italic, All Caps, Small Caps, Superscript/Subscript, Baseline Shift, Horizontal/Vertical Scale
  - Full Paragraph formatting: Left, Center, Right, Justify Last Left/Center/Right/Full, First-Line Indent, Left/Right Margin, Space Before/After
  - **Text Animators**: Unlimited Animator groups with **Range Selector** (Start, End, Offset, Units %/Index, Based On Characters/Words/Lines, Mode Add/Subtract/Intersect, Shape Square/Ramp Up/Ramp Down/Triangle/Round/Smooth, Ease High/Low, Randomize Order), **Wiggly Selector**, and **Expression Selector** driving per-character Position, Scale, Rotation, Opacity, Skew, Tracking, Fill/Stroke Colour, and Blur
  - **Per-Character 3D** switch (X/Y/Z per glyph)
  - **Text on a Path** (bind text baseline to any layer Bezier mask with First/Last Margin, Reverse Path, Perpendicular to Path, Force Alignment)
  - Local Font Management & custom font file loading (`.ttf`, `.otf`, `.woff2`)
- `LYR-04` **Null Object Layers (`Ctrl/Cmd+Alt+Shift+Y`)**: Non-rendering 2D/3D transform rig controllers with viewport crosshair/cube gizmos.
- `LYR-05` **Camera Layers (`Ctrl/Cmd+Alt+Shift+C`)**: One-Node and Two-Node (Point of Interest) 3D cameras; real-world presets (`15mm`, `20mm`, `24mm`, `28mm`, `35mm`, `50mm`, `80mm`, `135mm`, `200mm`); Zoom, Angle of View, Film Size, Focal Length, Depth of Field toggle, Focus Distance, Aperture, F-Stop, Blur Level, Iris Shape (Fast Rectangle through Decagon), Highlight Gain/Threshold.
- `LYR-06` **Light Layers (`Ctrl/Cmd+Alt+Shift+L`)**: **Parallel**, **Spot**, **Point**, and **Ambient** lights; Colour, Intensity (`%`), Cone Angle, Cone Feather, Falloff (None, Smooth, Inverse Square Clamped), Casts Shadows, Shadow Darkness, Shadow Diffusion.
- `LYR-07` **Audio Layers**: Stereo/mono PCM & encoded audio tracks, high-resolution waveform timeline display (`LL`), dB Gain keyframes (`L`), stereo pan, real-time WebAudio scrubbing/playback, and Audio DSP effects.
- `LYR-08` **Image / Video / Footage Layers**: Video clips, still images, multi-layer PSD/AI compositions, image sequences, animated GIF/WebP, procedural plates, and proxy-swappable sources.
- `LYR-09` **Pre-Comp Layers**: Embedded compositions with independent or collapsed 3D/vector transforms (`Collapse Transformations`) and independent Time Remapping.
- `LYR-10` **Adjustment Layers (`Ctrl/Cmd+Alt+Y`)**: Non-destructive effect/grade layers operating on underlying composite pixels.
- `LYR-11` **3D Layers & Renderer Selection**: Per-layer 3D switch unlocking Z-Position, Orientation (`X,Y,Z`), X/Y/Z Rotation, Geometry Options (Curvature, Segments, Extrusion Depth, Bevel Depth/Style for Classic 3D / Extruded 3D / Ray-Traced Studio modes), and Material Options.
- `LYR-12` **All 38 Blending Modes & Track Mattes**:
  - Normal, Dissolve | Darken, Multiply, Color Burn, Linear Burn, Darker Color | Add, Lighten, Screen, Color Dodge, Linear Dodge, Lighter Color | Overlay, Soft Light, Hard Light, Linear Light, Vivid Light, Pin Light, Hard Mix | Difference, Exclusion, Subtract, Divide | Hue, Saturation, Color, Luminosity | Stencil Alpha, Stencil Luma, Silhouette Alpha, Silhouette Luma, Alpha Add, Luminescent Premul
  - Track Mattes referencing *any* arbitrary layer in the comp (AE 2023+ arbitrary layer pick-whip mattes: Alpha Matte, Alpha Inverted, Luma Matte, Luma Inverted).

---

## 3. Built-In Effects & Filters Library (`FX` — 145 Effects Across 19 Categories)

### 3.1 Blur & Sharpen (`FX-BLUR`)
1. Gaussian Blur  
2. Directional Blur  
3. Radial Blur (Spin & Zoom)  
4. Camera Lens Blur (Bokeh iris blades & highlight gain)  
5. Compound Blur (Blur map layer)  
6. Fast Box Blur  
7. Sharpen  
8. Unsharp Mask (Amount, Radius, Threshold)  
9. Smart Blur (Edge-preserving)  
10. Bilateral Blur  
11. Channel Blur (Independent R, G, B, A blur radii)

### 3.2 Colour Correction (`FX-COLOR`)
12. Curves (Master RGB + R, G, B, Alpha splines)  
13. Levels (Input Black/White, Gamma, Output Black/White + Individual Controls)  
14. Hue/Saturation (Master & 6 colour ranges + Colorize)  
15. Colour Balance (Shadows, Midtones, Highlights + Preserve Luminosity)  
16. Brightness & Contrast  
17. Exposure (Exposure EV, Offset, Gamma)  
18. Vibrance (Vibrance + Skin-tone-safe Saturation)  
19. Tint (Map Black To, Map White To, Amount)  
20. Tritone (Highlights, Midtones, Shadows)  
21. Black & White (6-channel monochrome mixer + Tint)  
22. Colorama (Input Phase intensity/alpha -> Output Colour Wheel/Preset cycle)  
23. Change to Colour (Hue/Lightness/Saturation tolerances)  
24. Change Colour  
25. Channel Mixer  
26. Leave Colour (Isolate target hue, desaturate remainder)  
27. Photo Filter (Warming 85/81, Cooling 80/82, Custom + Preserve Luminosity)  
28. Selective Colour (9 colour bands CMYK/RGB relative/absolute)  
29. Shadow/Highlight (Auto/manual tonal recovery)  
30. Lumetri-Grade Three-Way Colour Wheels (Lift, Gamma, Gain, Offset, Temp/Tint)

### 3.3 Distort (`FX-DIST`)
31. Bezier Warp (12-tangent boundary patch)  
32. Bulge (Horizontal/Vertical radius, Bulge Center, Height, Taper)  
33. Corner Pin (Upper/Lower Left/Right homography)  
34. Displacement Map (H/V channel drive & max displacement)  
35. Liquify (Push, Twirl, Bloat, Pucker, Reconstruct warp field)  
36. Magnify (Center, Magnification, Link, Feather)  
37. Mesh Warp (Rows x Columns Bezier lattice)  
38. Mirror (Reflection Center & Reflection Angle)  
39. Offset (Shift Center To with wrap-around)  
40. Optics Compensation (FOV barrel/pincushion lens distortion & reverse)  
41. Polar Coordinates (Rect to Polar <-> Polar to Rect)  
42. Reshape  
43. Ripple (Concentric wave Center, Radius, Wave Speed, Width, Height)  
44. Rolling Shutter Repair  
45. Smear  
46. Spherize  
47. Transform (Independent effect-level Anchor, Pos, Scale, Skew, Rotation, Opacity, Shutter Blur)  
48. Turbulent Displace (Amount, Size, Complexity, Evolution)  
49. Twirl (Angle, Twirl Radius, Twirl Center)  
50. Warp (Arc, Arc Lower/Upper, Arch, Bulge, Shell, Flag, Wave, Fish, Rise, Fisheye, Inflate, Squeeze, Twist)  
51. Warp Stabilizer VFX (Subspace/Position-Scale-Rotation stabilization, Smoothness, Crop/Synthesize Edges)  
52. Wave Warp (Sine, Square, Triangle, Sawtooth, Circle, Noise; Height, Width, Direction, Speed, Pinning)

### 3.4 Generate (`FX-GEN`)
53. 4-Color Gradient (4 points, colours, jitter, blend, opacity)  
54. Advanced Lightning (Origin, Direction, Conductivity, Core/Glow settings, Forking)  
55. Audio Spectrum (Frequency bands, height, thickness, inside/outside colour, Side A/B)  
56. Audio Waveform (Displayed samples, amplitude, thickness, colours)  
57. Beam (Start/End Point, Length, Time, Start/End Thickness, Softness, Inside/Outside Colour, 3D Perspective)  
58. Cell Pattern (Bubbles, Crystals, Plates, Pillow, Tubular; Disperse, Size, Evolution)  
59. Checkerboard  
60. Circle  
61. Ellipse  
62. Eyedropper Fill  
63. Fill (Solid colour overlay on alpha)  
64. Fractal (Mandelbrot & Julia sets with zoom/pan/palette)  
65. Gradient Ramp (Linear & Radial Ramp with Ramp Scatter)  
66. Grid (Anchor/Width-Slider/Corner modes, Border, Blending)  
67. Lens Flare (50–300mm Zoom, 35mm Prime, 105mm Prime anamorphic ghosts & halo)  
68. Paint Bucket  
69. Radio Waves (Expanding polygon/mask wave rings with fade-in/out)  
70. Scribble  
71. Stroke (Animate Start/End/Spacing along layer masks)  
72. Vegas (Contour/mask glowing segments chasing around edges)  
73. Write-On (Animated brush path reveal)

### 3.5 Keying (`FX-KEY`)
74. Keylight (Screen Colour, Screen Gain/Balance, Clip Black/White, Screen Shrink/Grow, Softness, Despill Bias)  
75. Linear Colour Key  
76. Colour Difference Key  
77. Colour Range  
78. Luma Key (Key Out Brighter/Darker/Similar/Dissimilar, Threshold, Tolerance, Edge Feather)  
79. Extract (Luminance band alpha extraction with softness)  
80. Inner/Outer Key  
81. Key Cleaner (Edge chatter & alpha refinement)  
82. Advanced Spill Suppressor (Standard & Ultra green/blue spill neutralization)

### 3.6 Matte (`FX-MATTE`)
83. Simple Choker (Positive/negative sub-pixel alpha choke/expand)  
84. Matte Choker (Geometric softness & gray-level two-pass choke)  
85. Minimax (Minimum, Maximum, Min then Max, Max then Min on Alpha/Color)  
86. Channel Combiner  
87. Compound Arithmetic  
88. Invert (RGB, R, G, B, Alpha, HLS, YIQ)  
89. Remove Colour Matting (Unmult black/white/custom background fringe)  
90. Set Channels  
91. Set Matte (Take matte from any layer channel)  
92. Shift Channels (Swizzle R/G/B/A from Full On, Full Off, Luminance, Hue, Lightness, Saturation)

### 3.7 Noise & Grain (`FX-NOISE`)
93. Add Grain (Film stock presets, intensity, size, softness, aspect, colour/monochrome, response curve)  
94. Dust & Scratches  
95. Fractal Noise (Basic/Turbulent Smooth/Sharp/Dynamic/Threads/Swirl; Linear/Soft Linear/Spline/Block; Contrast, Brightness, Transform, Complexity, Sub Scaling, Evolution, Cycle Evolution)  
96. Match Grain  
97. Median  
98. Remove Grain  
99. Turbulent Noise

### 3.8 Perspective (`FX-PERSP`)
100. 3D Camera Tracker (Feature detection, solve error, ground plane, create Camera & Solid/Text/Null)  
101. 3D Glasses (Red/Cyan, Green/Magenta anaglyph convergence)  
102. Bevel Alpha (Edge Thickness, Light Angle, Light Colour, Light Intensity)  
103. Bevel Edges  
104. Drop Shadow (Shadow Colour, Opacity, Direction, Distance, Softness, Shadow Only)  
105. Radial Shadow (Point light source 2D projection shadow)

### 3.9 Simulation (`FX-SIM`)
106. Card Dance (Rows/Columns 3D tile flip driven by gradient layer/procedural wave)  
107. Caustics (Water surface refraction specular patterns)  
108. Foam (Bubble physics, viscosity, pop rate)  
109. Particle Playground (Cannon, Grid, Layer Exploder, Gravity, Repel/Wall)  
110. Shatter (Brick, Glass, Honeycomb, Puzzle Voronoi 3D shard explosion with Force 1/2 & Gravity)  
111. Wave World (2D heightfield wave propagation simulation)  
112. Particle Systems II (Birth Rate, Longevity, Producer, Physics: Explosive/Vortex/Fire/Twirl/Jet, Line/Star/Shaded Sphere/Faded Sphere particles)  
113. Rainfall (Drops, Size, Scene Depth, Speed, Wind, Opacity)  
114. Snowfall (Flakes, Size, Scene Depth, Speed, Wind, Wiggle)  
115. Star Burst (Scatter, Speed, Phase, Grid Spacing, Size)

### 3.10 Stylize (`FX-STYLE`)
116. Brush Strokes  
117. Cartoon (Posterized shading + Sobel ink outlines)  
118. Colour Emboss  
119. Emboss  
120. Find Edges (Sobel gradient edge detector + Invert)  
121. Glow (Glow Based On Color/Alpha, Threshold, Radius, Intensity, Composite Original, A/B Colours)  
122. Mosaic (Horizontal/Vertical blocks + Sharp Colours)  
123. Motion Tile (Tile Center, Tile Width/Height, Output Width/Height, Mirror Edges, Phase)  
124. Posterize (Quantize tonal levels `2`–`255`)  
125. Roughen Edges (Roughen/Roughen Colour/Cut/Photocopy/Rusty; Border, Edge Sharpness, Fractal Influence)  
126. Scatter (Amount, Grain Direction, Randomize Every Frame)  
127. Strobe Light  
128. Texturize  
129. Threshold  
130. Chromatic Aberration & Vignette (Cinematic optical fringing + lens falloff)

### 3.11 Text Effects (`FX-TEXT`)
131. Numbers (Formatted decimal, timecode, hex, currency, date counter generator)  
132. Timecode (SMPTE `HH:MM:SS:FF` / frame number burn-in box)

### 3.12 Time (`FX-TIME`)
133. Echo (Echo Time, Number of Echoes, Starting Intensity, Decay, Echo Operator: Add/Max/Min/Screen/Composite Back/Front)  
134. Posterize Time (Quantize layer temporal evaluation to target FPS)  
135. Time Difference  
136. Time Displacement  
137. Timewarp (Speed %, Pixel Motion / Frame Mix retiming + Motion Blur)

### 3.13 Transition (`FX-TRANS`)
138. Block Dissolve  
139. Card Wipe  
140. Gradient Wipe  
141. Iris Wipe (Polygon star/iris aperture)  
142. Linear Wipe (Transition Completion, Wipe Angle, Feather)  
143. Radial Wipe (Clockwise/Counter-Clockwise/Both)  
144. Venetian Blinds (Direction, Width, Completion, Feather)

### 3.14 Utility (`FX-UTIL`)
145. Apply Colour LUT (`.cube` 1D/3D LUT parser + built-in cinematic film LUTs)  
146. Cineon Converter (10-bit Log <-> Linear conversion)  
147. Colour Profile Converter (sRGB, Rec.709, Linear sRGB, ACEScg, Display P3)  
148. HDR Compander (Compress/Expand dynamic range above 1.0)  
149. HDR Highlight Compression

### 3.15 Audio Effects (`FX-AUDIO`)
150. Backwards (Reverse PCM buffer)  
151. Bass & Treble (Low/High shelf biquad filters)  
152. Delay (Delay Time, Feedback, Wet/Dry Mix)  
153. Flange & Chorus (LFO modulated comb delay)  
154. High-Low Pass (Resonant Lowpass/Highpass cutoff)  
155. Modulator (AM/FM ring/vibrato modulation)  
156. Parametric EQ (3-band frequency, Q, gain dB)  
157. Reverb (Algorithmic Schroeder/Freeverb room decay, damping, mix)  
158. Stereo Mixer (Left/Right level & pan matrix)  
159. Tone (Sine, Square, Triangle, Sawtooth multi-frequency test/sound-design generator)

### 3.16 Immersive Video / VR (`FX-VR`)
160. VR Chromatic Aberrations  
161. VR Colour Gradients  
162. VR Converter (Equirectangular <-> Cubemap / Fisheye)  
163. VR De-Noise  
164. VR Digital Glitch  
165. VR Fractal Noise  
166. VR Glow  
167. VR Plane to Sphere  
168. VR Rotate Sphere (Tilt X, Pan Y, Roll Z seam-free 360° rotation)

### 3.17 3D Channel & Extrusion (`FX-3DCH`)
169. 3D Channel Extract (Z-Depth, Normals, Object ID, Velocity)  
170. Depth Matte (Slice scene by Z-depth plane + feather)  
171. Depth of Field (Post-process Z-buffer bokeh)  
172. Fog 3D (Exponential depth fog start/end/colour)

### 3.18 Expression Controls (`FX-EXPR`)
173. Slider Control  
174. Checkbox Control  
175. Colour Control  
176. Point Control  
177. Layer Control  
178. Angle Control  
179. Dropdown Menu Control

---

## 4. Animation & Keyframing (`ANIM`)

- `ANIM-01` **Keyframe Types**: Linear, Bezier, Auto-Bezier, Continuous Bezier, and Hold (Toggle Hold Keyframe), each rendered with standard distinct timeline icons (Diamond, Hourglass, Circle, Square/Step).
- `ANIM-02` **Temporal & Spatial Interpolation**: Independent control of time-curve easing and 2D/3D spatial Bezier path tangents.
- `ANIM-03` **Graph Editor**: Value Graph and Speed Graph with multi-property overlay, auto-zoom height, snap-to-grid, box-select keyframes, and interactive cubic Bezier influence/velocity handles.
- `ANIM-04` **Easing Presets & Custom Curves**: Easy Ease (`F9`), Ease In (`Shift+F9`), Ease Out (`Ctrl/Cmd+Shift+F9`), plus preset library (Expo, Circ, Back/Overshoot, Elastic, Bounce) and custom cubic-bezier input.
- `ANIM-05` **Keyframe Assistants**: Sequence Layers (with optional overlap cross-dissolve), Time-Reverse Keyframes, Convert Audio to Keyframes (Left, Right, Both Channels amplitude), Convert Expression to Keyframes, Exponential Scale.
- `ANIM-06` **Viewport Motion Paths**: On-canvas dotted spatial path showing per-frame speed spacing ticks, keyframe diamonds, and interactive spatial Bezier tangent handles.
- `ANIM-07` **Roving Keyframes**: Rove Across Time on intermediate spatial keyframes for uniform constant-speed traversal along curved paths.
- `ANIM-08` **Expression-Driven Animation**: Combine keyframed base `value` with procedural expression offsets (`value + wiggle(3, 25)`).
- `ANIM-09` **Keyframe Velocity Dialog**: Exact numerical Incoming/Outgoing Velocity and Influence (`0.1%`–`100%`) entry with continuous lock.
- `ANIM-10` **Smoother & Wiggler Panels**: Smoother (Ramer-Douglas-Peucker / Gaussian tolerance keyframe reduction) and Wiggler (Noise Type Smooth/Jagged, Dimensions Independent/All, Frequency, Magnitude injected between selected keyframes).
- `ANIM-11` **Cross-Layer & Cross-Property Keyframe Clipboard**: Copy/paste keyframes across properties, layers, and compositions anchored at the current playhead time.

---

## 5. Expressions (`EXPR`)

- `EXPR-01` **AE-Compatible JavaScript Expression Engine**: Fast compiled & sandboxed evaluation per property per frame with deterministic `seedRandom`.
- `EXPR-02` **Expression Controls**: Dedicated rig controls (Slider, Checkbox, Colour, Point, Layer, Angle, Dropdown) addressable via `effect("Ctrl")("Slider")`.
- `EXPR-03` **Expression Pick Whip**: Drag from any property directly onto another layer, property, comp, or effect parameter to auto-insert valid expression syntax.
- `EXPR-04` **Built-In Expression Function Library**: `wiggle`, `linear`, `ease`, `easeIn`, `easeOut`, `clamp`, `loopIn`, `loopOut`, `loopInDuration`, `loopOutDuration`, `posterizeTime`, `timeToFrames`, `framesToTime`, `seedRandom`, `random`, `gaussRandom`, `noise`, `add`, `sub`, `mul`, `div`, `length`, `normalize`, `dot`, `cross`, `lookAt`, `degreesToRadians`, `radiansToDegrees`, `rgbToHsl`, `hslToRgb`, `sourceRectAtTime`.
- `EXPR-05` **Time-Based & Velocity Expressions**: `time`, `valueAtTime(t)`, `velocity`, `velocityAtTime(t)`, `speed`, `speedAtTime(t)`, `index`, `inPoint`, `outPoint`.
- `EXPR-06` **Cross-Composition References**: `comp("Other Comp").layer("Control").transform.position` evaluation across compositions.
- `EXPR-07` **Helpful Non-Blocking Error Diagnostics**: Expression error banner displaying exact line/column, offending expression snippet, and one-click jump without halting composition playback.
- `EXPR-08` **Rich Expression Editor**: Syntax highlighting, bracket matching, live autocomplete dropdown, snippet menu, and inline function signature documentation.

---

## 6. Masking & Rotoscoping (`MASK`)

- `MASK-01` **Bezier Masks**: Multiple ordered masks per layer supporting **None, Add, Subtract, Intersect, Lighten, Darken, and Difference** boolean combine modes plus **Inverted** toggle and **Lock**.
- `MASK-02` **Uniform & Variable Per-Vertex Feathering**: Independent X/Y uniform feather radius plus per-vertex variable feather width falloff handles.
- `MASK-03` **Mask Expansion & Mask Opacity**: Animatable signed pixel expansion (`-500px` to `+500px`) and mask alpha multiplier (`0%`–`100%`).
- `MASK-04` **RotoBezier Masks**: Automatic smooth tension-controlled Catmull-Rom/Bezier curvature without manual tangent handles.
- `MASK-05` **Local AI Roto Brush**: Foreground/background stroke-guided local matting model (joint bilateral color-cluster GMM + temporal propagation) running 100% offline.
- `MASK-06` **Refine Edge Tool**: Guided image filter alpha matte refinement for hair, motion-blurred edges, and semi-transparent Regions + Decontaminate Edge Colours.
- `MASK-07` **Mask Tracker**: Propagate mask vertices across frames via Position, Position+Scale+Rotation, or Perspective/Warp tracking.

---

## 7. Motion Tracking (`TRK`)

- `TRK-01` **Point Tracker (1-Point, 2-Point, 4-Point)**: Sub-pixel Normalized Cross-Correlation (NCC) feature window + search region tracker driving Position, Scale, Rotation, or 4-Point Corner Pin targets.
- `TRK-02` **3D Camera Tracker**: Multi-frame Harris/FAST corner extraction + bundle-adjusted 3D camera pose estimation, ground-plane selection, and 1-click "Create Camera and Solid/Null/Text".
- `TRK-03` **Warp Stabilizer VFX**: Automatic track + smoothed camera trajectory solver (Smooth Motion vs No Motion; Position, Scale/Rotation, Perspective, Subspace Warp).
- `TRK-04` **Face Tracking**: Automatic face bounding + 68-landmark proportion mesh estimation (eyes, brows, nose, mouth, jawline) exportable to keyframes.
- `TRK-05` **Content-Aware Fill for Video**: Remove unwanted objects inside subtracted masks via spatial-temporal PatchMatch + optical-flow background synthesis, generating clean fill plates locally.
- `TRK-06` **Planar Tracking (Mocha-Class)**: Track coplanar surfaces via iterative homography alignment immune to partial foreground occlusion, exporting Corner Pin or Transform data.
- `TRK-07` **Track Matte Support**: Alpha Matte, Alpha Inverted Matte, Luma Matte, and Luma Inverted Matte targeting any layer in the composition.

---

## 8. Paint & Clone (`PNT`)

- `PNT-01` **Paint Tools**: Non-destructive **Brush**, **Clone Stamp**, and **Eraser** operating in Layer View or Composition View.
- `PNT-02` **Stroke Duration Modes**: **Constant**, **Single Frame**, **Write On** (auto-animates End `0%`->`100%`), and **Custom** (`N` frames).
- `PNT-03` **Brush Dynamics**: Diameter, Angle, Roundness, Hardness (`0%`–`100%`), Opacity, Flow, Spacing, plus tablet/velocity pressure modulation.
- `PNT-04` **Clone Stamp Source Controls**: 5 rapid Clone Source presets with Source Layer selection, Offset `(dx, dy)`, Source Time Shift, Scale, and Rotation.
- `PNT-05` **Timeline Paint Stroke Editing**: Every stroke is recorded as an editable, animatable timeline sub-item (Path, Start/End trim, Colour, Blend Mode, Transform).

---

## 9. 3D Compositing (`3D`)

- `3D-01` **3D Layer Transforms**: 3D Position `(X, Y, Z)`, Separate Dimensions (`X`, `Y`, `Z` independent curves), Anchor Point `(X, Y, Z)`, Scale `(X, Y, Z)`, Orientation `(X, Y, Z)`, and Euler Rotation X / Y / Z.
- `3D-02` **3D Camera with Depth of Field**: Perspective projection matrix, active camera vs Orthographic views (Front, Left, Top, Back, Right, Bottom, Custom View 1–3), and bokeh DoF circle-of-confusion blur.
- `3D-03` **3D Lights & Shadow Casting**: Multi-light illumination summing Ambient, Parallel, Point, and Spot lights with soft shadow map projection between Casts-Shadows and Accepts-Shadows layers.
- `3D-04` **Material Options**: Casts Shadows (Off/On/Only), Light Transmission (`0%`–`100%` stained-glass coloured shadows), Accepts Shadows, Accepts Lights, Ambient, Diffuse, Specular Intensity, Specular Shininess, Metal.
- `3D-05` **3D Renderer Engines**: **Classic 3D** (fast 2.5D intersecting planes), **Cinema/Extruded 3D** (extruded 3D text & vector shapes with bevel profiles), and **Advanced Ray/PBR 3D** (reflections, environment lighting, bent layers).
- `3D-06` **Environment Layers**: 360° equirectangular HDR/image layers casting IBL reflections and ambient illumination onto 3D metallic/glossy surfaces.
- `3D-07` **External 3D Model Import**: Native parser & 3D renderer for **OBJ** (`.obj` + `.mtl`), **glTF 2.0** (`.gltf` / `.glb`), ASCII **FBX** geometry, and procedural 3D primitives (Cube, Sphere, Torus, Cylinder) composited directly in the shared 3D space.

---

## 10. Rendering & Export (`RND`)

- `RND-01` **Render Queue with Multiple Output Modules**: Queue multiple compositions, duplicate queue items, attach `1..N` simultaneous Output Modules per item (e.g., ProRes Master + H.264 Review + PNG Sequence simultaneously).
- `RND-02` **Comprehensive Output Formats**:
  - Video containers/codecs: **MP4 (H.264 / H.265 HEVC)**, **WebM (VP9 / VP8)**, **MOV (ProRes 422 / ProRes 4444 with Alpha, DNxHR)**, **AVI**, **MKV** (via native WebCodecs/MediaRecorder + automatic system FFmpeg pipeline when available, plus pure-JS uncompressed AVI/GIF/WAV encoders that work anywhere with zero external binaries)
  - Animated & Still Sequences: **Animated GIF** (optimized NeuQuant/median-cut palette + dithering), **PNG Sequence** (RGBA 8/16-bit), **JPEG Sequence**, **TIFF Sequence**, **TGA Sequence**, **BMP/PPM**, **OpenEXR (`.exr` half/float HDR)**, **Layered PSD**, **SVG/AI Vector Frame**
  - Audio-only: **WAV (16/24/32-bit float PCM)**
- `RND-03` **Multi-Pass / AOV Rendering**: Export Beauty RGB+Alpha alongside **Z-Depth**, **Surface Normals**, **Object/Layer ID**, and **2D Motion Vectors** passes.
- `RND-04` **Render Settings & Output Module Presets**: Best Settings, Draft Settings, Half-Res Preview, Lossless with Alpha, H.264 Match Source High Bitrate, ProRes 4444, Social Vertical 1080x1920, GIF Loop, WAV 48kHz.
- `RND-05` **Background & Non-Blocking Rendering**: Asynchronous worker/frame-sliced rendering with pause, resume, cancel, real-time frame preview, elapsed time, and remaining ETA.
- `RND-06` **Network / Watch-Folder Render Readiness**: Export self-contained render manifest + multi-machine frame-chunk range (`startFrame`..`endFrame` CLI/scriptable segment rendering for render farms).
- `RND-07` **Proxy Workflow**: Attach low-res proxy files or auto-generate half/quarter proxies per footage/comp item; toggle proxies in viewer vs Render Queue ("Use No Proxies" / "Use All Proxies" / "Current Settings").
- `RND-08` **Render Notifications**: System/desktop notification and optional completion chime + render log export.
- `RND-09` **Colour Management & ACES Pipeline**: Project working spaces (**sRGB IEC61966-2.1**, **Linear sRGB**, **Rec.709**, **Display P3**, **ACEScg**), Linearize Working Space toggle, `.cube` Output LUT, and View Transform LUT toggle.
- `RND-10` **HDR 8 / 16 / 32-bpc Support**: Switchable project bit depth (`8 bpc`, `16 bpc`, `32 bpc Float`) preserving super-whites (`> 1.0`) for realistic optical Glows, Exposure, and Camera Lens Blur bokeh.
- `RND-11` **Variable Frame Rate (VFR) Handling**: Timestamp-accurate frame sampling & automatic CFR conforming on VFR footage import.

---

## 11. Project, Asset Management & Import (`PRJ` & `IMP`)

- `PRJ-01` **Project Panel**: Hierarchical folders, colour labels, thumbnail + metadata header preview, search bar, type filter chips (Comps, Video, Images, Audio, Solids, 3D), and column sorting (Name, Type, Size, Duration, Dimensions, FPS, Usage Count).
- `PRJ-02` **Interpret Footage Dialog**: Conform Frame Rate, Loop `N` times, Alpha Interpretation (Ignore, Straight Unmatted, Premultiplied with Colour), Field Separation (Off, Upper/Lower First), Pixel Aspect Ratio, Colour Space override.
- `PRJ-03` **Missing Footage Management**: Automatic detection, diagnostic Missing Colour Bars placeholder so comps never crash, Filter "Missing Footage", and one-click Relink / Auto-Relink Sibling Files in Folder.
- `PRJ-04` **Collect Files / Package Project**: Bundle `.prex` project + all referenced footage, fonts, and LUTs + generated Project Report `.txt` into a portable archive/folder.
- `PRJ-05` **Project Templates**: Built-in and user-savable `.prext` templates (Broadcast Package, Kinetic Typography, 3D Sci-Fi HUD, VFX Green Screen Shot, Social 9:16 Reel, Clean Slate).
- `PRJ-06` **Configurable Auto-Save & Crash Recovery**: Rolling local auto-save every `1`–`30` minutes (max `N` versions) plus transactional recovery snapshot.
- `PRJ-07` **Local Version History**: Named save checkpoints with side-by-side layer/property diff and instant non-destructive rollback.
- `PRJ-08` **Unlimited Undo/Redo with History Panel**: Command-journal + structural-sharing undo stack (`100+` configurable to unlimited steps) with clickable History list to jump to any prior state.
- `IMP-01` **Broad Media & Interchange Import**:
  - Video: `MP4`, `MOV`, `WebM`, `MKV`, `AVI`, `ProRes`, `DNxHD/HR`, `MXF`, `MPEG`
  - Image & Layered: `PNG`, `JPEG`, `TIFF`, `PSD` (with multi-layer comp builder!), `AI/SVG` (vector layer conversion!), `EXR`, `HDR` (`.hdr` RGBE), `BMP`, `GIF` (animated frames!), `WebP`, `TGA`, `ICO`, `PPM`, RAW preview parser
  - Audio: `WAV`, `MP3`, `AAC/M4A`, `FLAC`, `OGG`, `AIFF`
  - 3D: `OBJ`, `glTF`/`GLB`, `FBX` (ASCII), `ABC` metadata
  - Interchange & Data-Driven: Final Cut XML (`.xml`), **EDL (`.edl`)**, **AAF JSON/manifest**, **JSON / CSV / TSV** data-driven footage items accessible directly in expressions (`footage("data.csv").dataValue([col, row])`!)
  - Fonts: `.ttf`, `.otf`, `.woff`, `.woff2`

---

## 12. Studio UI/UX, Plugin System, Performance & Accessibility (`UI`, `PLG`, `PERF`, `ACC`)

- `UI-01` **Customisable Dockable Workspaces**: 7 built-in task workspaces (**Default / Standard**, **Animation**, **Compositing & VFX**, **Node Graph**, **Text & Typography**, **Colour & Scopes**, **Minimal**) + Save, Load, Delete, and Reset Workspace.
- `UI-02` **Dockable, Resizable, Collapsible & Detachable Panels**: Split-pane dividers, tabbed panel groups, maximize panel under cursor (`` ` `` tilde key!), and multi-monitor secondary viewer window.
- `UI-03` **Themes**: **Obsidian Studio Dark** (default), **Precision Daylight Light**, **High-Contrast Accessible**, plus full **Custom Theme Editor** with JSON import/export.
- `UI-04` **UI DPI Scaling (`85%`–`150%`)**, customisable **Keyboard Shortcuts Editor** (with conflict warnings & search), **Search Everything Command Palette (`Ctrl/Cmd+K`)**, rich **Right-Click Context Menus** in every panel, **Tooltips**, and **Live Status Bar** (hovered control hint, cursor X/Y + RGBA readout, RAM/Cache meter, GPU status, FPS).
- `UI-05` **Composition Viewer Controls**: Zoom (`6.25%`–`3200%` + Fit up to 100%), Resolution (`Full`, `Half`, `Third`, `Quarter`, `Custom`), **Region of Interest (ROI)** crop box, **Transparency Checkerboard**, **Pixel Aspect Ratio Correction**, **Channel Viewer** (`RGB`, `Red`, `Green`, `Blue`, `Alpha`, `Alpha Boundary`), **Viewport Overlays** (Proportional Grid, Custom Pixel Grid, Rulers, Draggable Guides, Action & Title Safe Zones, 3D Ground Plane), and **Snapping** (Grid, Guides, Layer Bounds, Timeline Playhead/Keyframes).
- `UI-06` **Broadcast Video Scopes**: Real-time **Histogram**, **RGB Parade**, **Luma/Chroma Waveform Monitor**, and **Vectorscope** (with I/Q & skin-tone indicator line).
- `PLG-01` **Sandboxed Plugin & Extension Architecture**: Register custom Effects, custom UI Panels, custom Importers/Exporters, and Macro Scripts from local `.prexplugin.js` / `.json` bundles executed inside a capability-restricted sandbox with execution timeouts.
- `PERF-01` **GPU + Multi-Threaded + Cache Engine**: WebGL2 hardware shader compositor, multi-worker evaluation readiness, green-bar **RAM Preview frame cache** in timeline ruler, persistent **LRU Disk Cache** with configurable size/purge controls, **Dynamic Resolution** during scrub, and **Background Idle Pre-Rendering**.
- `ACC-01` **Full Accessibility**: ARIA roles/labels for screen readers, High-Contrast theme, 100% keyboard navigation + visible focus rings, configurable UI font scale, `prefers-reduced-motion` toggle, and color-blind-safe Okabe-Ito track labels.

---

## 13. Features EXCEEDING Adobe After Effects (`EXCEED-01` to `EXCEED-18`)

| ID | Feature Exceeding AE | How It Surpasses Adobe After Effects |
|---|---|---|
| `EXCEED-01` | **Bidirectional Layer <-> Node Graph View** | Switch seamlessly between classic AE layer stacks and a Nuke/Fusion-style node DAG (`Read -> Transform -> Effects -> Mask -> Merge -> Output`); edits in either view update the other live. |
| `EXCEED-02` | **100% Offline Local AI Roto Matting** | Guided foreground/background affinity matting + edge refinement with zero cloud uploads or Creative Cloud sign-in. |
| `EXCEED-03` | **Built-In Local AI Super-Scale (2x / 4x)** | Edge-directed gradient-guided detail upscaling effect & footage enhancer running 100% locally. |
| `EXCEED-04` | **Built-In Local AI Optical-Flow Frame Interpolation** | Dense multi-scale Lucas-Kanade motion-compensated intermediate frame synthesis for smooth slow-motion without cloud credits. |
| `EXCEED-05` | **Built-In Local AI Spatio-Temporal Denoiser** | Edge-preserving chroma/luma temporal noise reduction across adjacent frames without paid third-party plugins. |
| `EXCEED-06` | **Non-Destructive Node Effect Branching** | Route a single layer into parallel effect branches (e.g., separate high-frequency sharpen + thresholded bloom) and recombine without duplicating pre-comps! |
| `EXCEED-07` | **CRDT-Ready Deterministic Project Schema** | UUID-addressed entities and deterministic sorted `.prex` JSON manifests enable clean Git 3-way merges and future real-time collaborative editing. |
| `EXCEED-08` | **Built-In Studio Screen & Viewport Recorder** | Capture application tutorials or viewport playblasts with optional microphone audio directly into the Project Panel in one click. |
| `EXCEED-09` | **Integrated Offline Asset & Element Library** | Searchable local browser with live animated thumbnails for lower thirds, HUD widgets, particle rigs, transitions, textures, and cinematic LUTs. |
| `EXCEED-10` | **Smart Resolution-Adaptive Presets** | Presets normalize positions, stroke widths, and typography against comp aspect/resolution (`16:9` <-> `9:16` <-> `1:1`) automatically. |
| `EXCEED-11` | **Multi-Language Automation Scripting (JS + Python + Lua)** | Write batch studio scripts in JavaScript, Python syntax, or Lua syntax directly inside the built-in Script Editor with live output log. |
| `EXCEED-12` | **Integrated Git & Local Snapshot Diff Panel** | Create named project commits, inspect added/modified/deleted layers & property values in a visual diff tree, and restore any revision instantly. |
| `EXCEED-13` | **Procedural Generation Studio** | Built-in **L-System Botanical/Geometric Generator**, **Gray-Scott Reaction-Diffusion**, **Worley/Voronoi Cellular Fields**, and **Curl-Noise Particle Fields**. |
| `EXCEED-14` | **Illustrator-Grade Vector Path Workbench** | Direct on-canvas anchor/bezier pen editing + live constructive solid 2D path booleans, variable-width strokes, and path-to-mask conversion without round-tripping to Illustrator. |
| `EXCEED-15` | **Real-Time Per-Effect & Per-Layer Performance Profiler** | Live millisecond telemetry bar next to every layer and effect showing exact CPU/GPU cost, cache hit rate, and bottleneck warnings. |
| `EXCEED-16` | **Interactive Help Center & "What's This?" Inspector** | Searchable built-in offline manual + interactive `?` cursor mode that explains any clicked panel, switch, blend mode, or effect with keyboard shortcuts and workflow tips. |
| `EXCEED-17` | **Interactive Snapshot A/B Split-Wipe Comparator** | Store multiple look-dev framebuffer snapshots and drag a live vertical/angled wipe bar directly across the Composition Viewer. |
| `EXCEED-18` | **Smart Duplicate with Expression Relinking** | Duplicate rigged layers or pre-comp hierarchies while automatically remapping internal self/sibling expression references. |
