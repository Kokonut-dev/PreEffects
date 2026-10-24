# Wireframes — Modal Dialogs & Configuration Windows

**Document ID:** `PRE-DESIGN-002C`  
**Stage:** Stage 2 — Initial Mock-Up  

All 13 major studio dialogs use keyboard-first focus (`Tab`, `Esc` = Cancel, `Enter` = OK), live validation, and non-destructive preview where applicable.

---

## 1. New Composition / 2. Composition Settings Dialog (`Ctrl/Cmd+N` / `Ctrl/Cmd+K`)
- **Tabs**: `[Basic]` `[Advanced]` `[3D Renderer]` `[Colour]`
- **Basic**: Composition Name, Preset dropdown (`HD 1080p 60fps`, `HD 1080p 24fps`, `UHD 4K 3840×2160 60fps`, `DCI 4K 4096×2160 24fps`, `Social Vertical 1080×1920 60fps`, `Square 1080×1080`, `8K UHD`), Width (`px`), Height (`px`), Lock Aspect Ratio (`16:9`), Pixel Aspect Ratio (`Square Pixels`), Frame Rate (`60`), Resolution (`Full`), Start Timecode (`00:00:00:00`), Duration (`00:00:10:00`), Background Colour swatch.
- **Advanced**: Anchor 9-point grid, Preserve Frame Rate When Nested, Preserve Resolution When Nested, Motion Blur Shutter Angle (`180°`), Shutter Phase (`-90°`), Samples Per Frame (`16`), Adaptive Sample Limit (`64`).
- **3D Renderer**: Renderer (`Classic 3D`, `Cinema Extruded 3D`, `Advanced PBR/Ray 3D`), Shadow Map Resolution (`512`–`4096`), Anti-Aliasing quality.

## 3. Project Settings Dialog (`Ctrl/Cmd+Alt+Shift+K`)
- **Time Display Style**: Timecode (`00:00:00:00`) vs Frames (`00000`), Feet + Frames (`16mm`/`35mm`).
- **Colour**: Depth (`8 bits per channel`, `16 bits per channel`, `32 bits per channel (float)`), Working Space (`sRGB IEC61966-2.1`, `Rec.709`, `Linear sRGB`, `Display P3`, `ACEScg`), Linearize Working Space checkbox, Compensate for Scene-Referred Profiles.
- **Audio**: Sample Rate (`44.1 kHz`, `48.0 kHz`, `96.0 kHz`).
- **Expressions**: Engine (`PreEffects Fast ES2024 Sandboxed`).

## 4. Preferences Dialog (`Ctrl/Cmd+Alt+;` — 9 Tabs)
1. **General**: Undo Levels (`100` / Unlimited), Default Spatial Interpolation to Linear, Center Anchor Point in New Shape Layers, Create Split Layers Above Original, Show Welcome Screen on Startup.
2. **Previews**: Adaptive Resolution Limit (`1/2`, `1/4`, `1/8`), Audio Preview Duration, Mute Audio When Preview Not Real-Time, GPU Acceleration (`WebGL2 Hardware` / `CPU Deterministic`).
3. **Display**: Motion Path keyframes (`All` / `15s` / `Selected`), Hardware Accelerate Composition/Layer/Footage Panels, Show Both Thumbnails and Stats in Project.
4. **Import**: Still Footage Default Duration (`Composition Length` or `N` seconds), Sequence Footage Default FPS (`30` / `60`), Interpret Unlabelled Alpha As (`Straight` / `Premultiplied`).
5. **Output**: Segment Video Files At, Default Export Folder, Audio Block Duration.
6. **Grids & Guides**: Gridline Every (`64 px`), Subdivisions (`4`), Grid Colour, Guide Colour, Proportional Grid (`4×4`, `Rule of Thirds`), Safe Margins (`Action 90%`, `Title 80%`).
7. **Labels**: Customise all 16 Track Label Names & Swatches + Default Label per Asset Type (Comp, Video, Audio, Solid, Shape, Text, Camera, Light, Null, Adjustment).
8. **Media & Disk Cache**: Enable Disk Cache, Maximum Disk Cache Size (`10 GB`), Choose Folder..., `[Empty Disk Cache]`, `[Clean Database & Cache]`, Maximum RAM Cache (`1024 MB`).
9. **Appearance & Accessibility**: Theme (`Obsidian Dark`, `Precision Light`, `High Contrast`), Brightness/Contrast slider, UI Font Scale (`90%`–`140%`), Reduced Motion UI, Colour-Blind Safe Palette (`Okabe-Ito`), Screen Reader Verbose Announcements.

## 5. Render Settings Dialog
- Quality (`Best` / `Draft` / `Wireframe`), Resolution (`Full` / `Half` / `Third` / `Quarter`), Proxy Use (`Use No Proxies` / `Use All Proxies` / `Current Settings`), Effects (`Current Settings` / `All On` / `All Off`), Frame Blending, Motion Blur, Time Span (`Work Area Only` / `Length of Comp` / `Custom Start..End`), Frame Rate override, Skip Existing Files (multi-machine render).

## 6. Output Module Dialog
- Format (`MP4 H.264`, `WebM VP9`, `MOV ProRes 4444`, `Animated GIF`, `PNG Sequence`, `EXR HDR Sequence`, `WAV Audio`), Video Output Channels (`RGB`, `Alpha`, `RGB + Alpha`), Depth (`Millions of Colours`, `Trillions`, `Floating Point`), Colour (`Premultiplied` / `Straight`), Multi-Pass AOV checkboxes (`Z-Depth`, `Normals`, `Object ID`, `Motion Vectors`), Resize & Crop options, Audio Output (`Auto` / `On` / `Off`, `48 kHz`, `16/24/32-bit Stereo`), Output LUT `.cube`.

## 7. Interpret Footage Dialog
- Alpha (`Ignore`, `Straight - Unmatted`, `Premultiplied - Matted With Colour`), Frame Rate (`Use Frame Rate from File` vs `Conform to FPS`), Fields & Pulldown, Pixel Aspect Ratio, Loop (`1..999` times), Colour Space Override.

## 8. Solid / Adjustment Layer Settings Dialog (`Ctrl/Cmd+Y`)
- Name, Width, Height, `[Make Comp Size]`, Units (`Pixels` / `% of Comp`), Pixel Aspect, Colour Picker + Eyedropper.

## 9. Text Properties / Animator Preset Dialog
- Quick configure Animator Group (`Typewriter`, `Fade Up Characters`, `3D Flip Cascade`, `Tracking Expand`, `Glitch Randomize`, `Path Crawl`) with live preview before committing to layer.

## 10. 3D Camera & Light Settings Dialogs
- **Camera**: Type (`One-Node` / `Two-Node`), Preset (`15mm`..`200mm`), Focal Length, Angle of View, Zoom, Enable Depth of Field, Focus Distance, Aperture, Blur Level.
- **Light**: Name, Light Type (`Parallel`, `Spot`, `Point`, `Ambient`), Colour, Intensity, Cone Angle, Cone Feather, Falloff, Casts Shadows, Shadow Darkness, Shadow Diffusion.

## 11. Keyboard Shortcuts Visual Editor (`Ctrl/Cmd+Alt+'`)
- Interactive visual ANSI/ISO virtual keyboard showing colour-coded bound keys (Application-wide vs Panel-specific), Modifier toggles (`Ctrl/Cmd`, `Shift`, `Alt`), live command search, conflict detector, and Import/Export `.prexkeys` profile.

## 12. Workspace Manager & Custom Theme Editor Dialog
- Reorder workspace bar buttons, save current panel layout as new workspace, delete custom workspaces, and customize theme surface/accent tokens with live preview + JSON export.

## 13. Plugin & Extension Manager Dialog
- View installed Built-In & User Sandboxed Plugins (`Effects`, `Panels`, `Importers/Exporters`, `Scripts`), inspect permissions (`Sandboxed — No Network / No FS`), toggle enable/disable, and `[Install Local .prexplugin File...]`.
