import { EffectInstance } from '../engine/types';
import { createId, makeProp } from '../engine/factory';
import { EffectExecContext, EvaluatedParams, runEffectFamilyKernel } from './kernels';

export type { EvaluatedParams };

export interface EffectParamSchema {
  key: string;
  label: string;
  type: 'number' | 'color' | 'select' | 'boolean';
  defaultValue: number | string | boolean;
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
  unit?: string;
}

export interface EffectDefinition {
  id: string;
  name: string;
  category: string;
  family:
    | 'blur'
    | 'color'
    | 'distort'
    | 'generate'
    | 'keying'
    | 'matte'
    | 'noise'
    | 'perspective'
    | 'simulation'
    | 'stylize'
    | 'text-fx'
    | 'time'
    | 'transition'
    | 'utility'
    | 'audio'
    | 'vr'
    | '3d-channel'
    | 'expression-control'
    | 'ai-procedural';
  description: string;
  exceedsAe?: boolean;
  gpuAccelerated?: boolean;
  params: EffectParamSchema[];
}

function pNum(key: string, label: string, def: number, min = 0, max = 100, step = 1, unit = ''): EffectParamSchema {
  return { key, label, type: 'number', defaultValue: def, min, max, step, unit };
}
function pCol(key: string, label: string, def = '#E89B3C'): EffectParamSchema {
  return { key, label, type: 'color', defaultValue: def };
}
function pSel(key: string, label: string, options: string[], def?: string): EffectParamSchema {
  return { key, label, type: 'select', defaultValue: def ?? options[0], options };
}
function pBool(key: string, label: string, def = false): EffectParamSchema {
  return { key, label, type: 'boolean', defaultValue: def };
}

function buildCategoryEffects(
  category: string,
  family: EffectDefinition['family'],
  items: Array<[string, string, string, EffectParamSchema[]?]>,
  exceedsAe = false,
): EffectDefinition[] {
  const defaultParamsByFamily: Record<EffectDefinition['family'], EffectParamSchema[]> = {
    blur: [pNum('radius', 'Blurriness / Radius', 12, 0, 120, 0.5, 'px'), pNum('amount', 'Strength', 50, 0, 200, 1, '%'), pNum('angle', 'Direction Angle', 0, -180, 180, 1, 'deg')],
    color: [pNum('amount', 'Intensity', 35, -100, 100, 1, '%'), pNum('exposure', 'Exposure EV', 0, -4, 4, 0.05, 'EV'), pNum('contrast', 'Contrast', 12, -100, 100, 1), pNum('brightness', 'Brightness', 0, -100, 100, 1), pNum('hue', 'Hue Shift', 0, -180, 180, 1, 'deg'), pNum('saturation', 'Saturation', 0, -100, 100, 1, '%'), pNum('gamma', 'Gamma', 1, 0.2, 3, 0.02), pCol('color', 'Tint / Balance Colour', '#E89B3C')],
    distort: [pNum('amount', 'Distortion Amount', 24, -150, 150, 1), pNum('radius', 'Radius / Scale', 40, 1, 300, 1, 'px'), pNum('angle', 'Angle / Twist', 35, -360, 360, 1, 'deg')],
    generate: [pCol('color', 'Primary Colour', '#E89B3C'), pCol('secondaryColor', 'Secondary Colour', '#38BDF8'), pNum('radius', 'Size / Thickness', 16, 1, 200, 1, 'px'), pNum('amount', 'Blend / Intensity', 80, 0, 100, 1, '%')],
    keying: [pCol('keyColor', 'Screen Key Colour', '#00B140'), pNum('tolerance', 'Colour Tolerance', 65, 1, 200, 1), pNum('amount', 'Edge Softness / Despill', 35, 0, 100, 1, '%')],
    matte: [pNum('amount', 'Choke / Matte Expand', 15, -100, 100, 1, '%'), pNum('radius', 'Geometric Softness', 4, 0, 50, 0.5, 'px')],
    noise: [pNum('amount', 'Noise / Grain Amount', 28, 0, 100, 1, '%'), pNum('scale', 'Noise Scale', 32, 2, 200, 1, 'px')],
    perspective: [pNum('distance', 'Shadow / Bevel Distance', 10, 0, 100, 1, 'px'), pNum('angle', 'Light Angle', 135, 0, 360, 1, 'deg'), pCol('color', 'Shadow / Highlight Colour', '#000000')],
    simulation: [pNum('amount', 'Birth Rate / Density', 40, 1, 100, 1), pNum('radius', 'Particle Size', 6, 1, 40, 1, 'px'), pCol('color', 'Particle Colour', '#38BDF8')],
    stylize: [pNum('radius', 'Radius / Block Size', 14, 1, 100, 1, 'px'), pNum('amount', 'Amount / Shift', 30, 0, 100, 1, '%'), pNum('threshold', 'Threshold', 145, 0, 255, 1), pNum('intensity', 'Glow Intensity', 1.25, 0, 4, 0.05)],
    'text-fx': [pCol('color', 'Readout Colour', '#38BDF8'), pNum('radius', 'Glyph Scale', 18, 6, 72, 1, 'px')],
    time: [pNum('amount', 'Echo / Time Offset', 24, 1, 100, 1), pNum('fpsTarget', 'Posterize FPS', 12, 1, 60, 1, 'fps')],
    transition: [pNum('completion', 'Transition Completion', 35, 0, 100, 1, '%'), pNum('angle', 'Wipe Angle', 90, 0, 360, 1, 'deg')],
    utility: [pSel('lutPreset', '3D LUT Grade', ['teal-amber', 'kodak-2383', 'bleach-bypass', 'noir-silver', 'cyber-neon']), pNum('amount', 'Mix', 100, 0, 100, 1, '%')],
    audio: [pNum('gainDb', 'Gain / Wet Mix', 0, -24, 24, 0.5, 'dB'), pNum('frequency', 'Cutoff / Center Hz', 880, 20, 16000, 10, 'Hz'), pNum('feedback', 'Decay / Feedback', 35, 0, 95, 1, '%')],
    vr: [pNum('amount', 'FOV / Glitch', 20, -100, 100, 1), pNum('angle', 'Sphere Pan Tilt', 0, -180, 180, 1, 'deg')],
    '3d-channel': [pNum('distance', 'Z-Plane Depth', 18, 0, 100, 1), pCol('color', 'Fog / Matte Tint', '#1E293B')],
    'expression-control': [pNum('slider', 'Value', 50, -1000, 1000, 0.5)],
    'ai-procedural': [pNum('amount', 'Model Strength / Complexity', 65, 0, 100, 1, '%'), pCol('color', 'Procedural Accent', '#38BDF8'), pNum('radius', 'Detail Scale', 12, 1, 64, 1)],
  };

  return items.map(([id, name, description, customParams]) => ({
    id,
    name,
    category,
    family,
    description,
    exceedsAe,
    params: customParams ?? defaultParamsByFamily[family],
  }));
}

export const BUILT_IN_EFFECTS: EffectDefinition[] = [
  // 1. Blur & Sharpen (11)
  ...buildCategoryEffects('Blur & Sharpen', 'blur', [
    ['gaussian-blur', 'Gaussian Blur', 'Smooth multi-pass separable Gaussian convolution blur'],
    ['directional-blur', 'Directional Blur', 'Linear motion-vector directional streak blur'],
    ['radial-blur', 'Radial Blur', 'Spin and zoom radial blur around focal point'],
    ['camera-lens-blur', 'Camera Lens Blur', 'Optical iris bokeh depth-of-field blur'],
    ['compound-blur', 'Compound Blur', 'Luminance-mapped variable radius blur'],
    ['fast-box-blur', 'Fast Box Blur', 'Constant-time O(1) sliding-window box blur'],
    ['sharpen', 'Sharpen', 'High-frequency micro-contrast edge sharpener'],
    ['unsharp-mask', 'Unsharp Mask', 'Thresholded radius unsharp masking'],
    ['smart-blur', 'Smart Blur', 'Edge-preserving threshold blur'],
    ['bilateral-blur', 'Bilateral Blur', 'Surface-preserving chroma/luma bilateral filter'],
    ['channel-blur', 'Channel Blur', 'Independent RGBA per-channel blur radii'],
  ]),
  // 2. Colour Correction (19)
  ...buildCategoryEffects('Colour Correction', 'color', [
    ['curves', 'Curves', 'Master RGB and per-channel tonal spline curves'],
    ['levels', 'Levels', 'Histogram input/output black, white, and gamma points'],
    ['hue-saturation', 'Hue/Saturation', 'Master hue wheel rotation, saturation, and lightness'],
    ['colour-balance', 'Colour Balance', 'Shadow, midtone, and highlight RGB balance'],
    ['brightness-contrast', 'Brightness & Contrast', 'Linear/perceptual brightness and contrast control'],
    ['exposure', 'Exposure', 'Scene-referred photographic EV stops, offset, and gamma'],
    ['vibrance', 'Vibrance', 'Skin-tone-protected saturation boost'],
    ['tint', 'Tint', 'Two-colour luminance remap'],
    ['tritone', 'Tritone', 'Shadow, midtone, and highlight tri-colour grade'],
    ['black-and-white', 'Black & White', 'Spectral 6-band monochrome conversion'],
    ['colorama', 'Colorama', 'Phase-mapped cyclic false-colour ramp'],
    ['change-to-colour', 'Change to Colour', 'Targeted hue/lightness colour replacement'],
    ['change-colour', 'Change Colour', 'Hue transform with tolerance softness'],
    ['channel-mixer', 'Channel Mixer', 'Matrix RGB cross-channel linear combination'],
    ['leave-colour', 'Leave Colour', 'Isolate primary hue while desaturating remainder'],
    ['photo-filter', 'Photo Filter', 'Optical warming/cooling Wratten lens filter'],
    ['selective-colour', 'Selective Colour', '9-band relative/absolute colour trim'],
    ['shadow-highlight', 'Shadow/Highlight', 'Dynamic range shadow lift and highlight recovery'],
    ['lumetri-wheels', 'Three-Way Colour Wheels', 'Broadcast Lift, Gamma, Gain, and Offset grading'],
  ]),
  // 3. Distort (22)
  ...buildCategoryEffects('Distort', 'distort', [
    ['bezier-warp', 'Bezier Warp', '12-point boundary Bezier patch distortion'],
    ['bulge', 'Bulge', 'Elliptical convex/concave spatial lens bulge'],
    ['corner-pin', 'Corner Pin', 'Four-corner projective homography pin'],
    ['displacement-map', 'Displacement Map', 'Channel-driven horizontal/vertical pixel displacement'],
    ['liquify', 'Liquify', 'Interactive push, twirl, bloat, and pucker warp field'],
    ['magnify', 'Magnify', 'Localized optical loupe magnification'],
    ['mesh-warp', 'Mesh Warp', 'Rows x Columns elastic Bezier lattice'],
    ['mirror', 'Mirror', 'Planar reflection across arbitrary axis'],
    ['offset', 'Offset', 'Seamless toroidal UV tile pan'],
    ['optics-compensation', 'Optics Compensation', 'Camera lens barrel/pincushion FOV correction'],
    ['polar-coordinates', 'Polar Coordinates', 'Rectangular <-> Polar coordinate space remap'],
    ['reshape', 'Reshape', 'Mask-to-mask elastic correspondence morph'],
    ['ripple', 'Ripple', 'Animated concentric water wave distortion'],
    ['rolling-shutter-repair', 'Rolling Shutter Repair', 'CMOS skew & wobble scanline compensation'],
    ['smear', 'Smear', 'Boundary-masked directional smear'],
    ['spherize', 'Spherize', '3D spherical refraction warp'],
    ['transform-fx', 'Transform', 'Independent effect-stack 2D transform with shutter blur'],
    ['turbulent-displace', 'Turbulent Displace', 'Multi-octave fractal noise UV distortion'],
    ['twirl', 'Twirl', 'Vortex angular twist around center'],
    ['warp', 'Warp', 'Parametric arc, arch, flag, fish, squeeze, and twist warps'],
    ['warp-stabilizer-vfx', 'Warp Stabilizer VFX', 'Subspace/homography camera shake stabilization'],
    ['wave-warp', 'Wave Warp', 'Sine, triangle, square, and sawtooth wave displacement'],
  ]),
  // 4. Generate (21)
  ...buildCategoryEffects('Generate', 'generate', [
    ['4-color-gradient', '4-Color Gradient', 'Four-point smooth bilinear colour field'],
    ['advanced-lightning', 'Advanced Lightning', 'Forking electrical plasma discharge'],
    ['audio-spectrum', 'Audio Spectrum', 'FFT frequency spectrum analyzer bars'],
    ['audio-waveform', 'Audio Waveform', 'Oscilloscope PCM waveform generator'],
    ['beam', 'Beam', '3D laser/energy beam between start and end coordinates'],
    ['cell-pattern', 'Cell Pattern', 'Voronoi cellular crystal, bubble, and plate patterns'],
    ['checkerboard', 'Checkerboard', 'Precision calibration & pattern checkerboard'],
    ['circle', 'Circle', 'Anti-aliased solid/feathered ring & disc'],
    ['ellipse-gen', 'Ellipse', 'Parametric inside/outside coloured ellipse'],
    ['eyedropper-fill', 'Eyedropper Fill', 'Sampled pixel solid colour fill'],
    ['fill', 'Fill', 'Alpha-preserving solid colour fill'],
    ['fractal', 'Fractal', 'Mandelbrot and Julia complex-plane explorer'],
    ['gradient-ramp', 'Gradient Ramp', 'Linear and radial dithered 2-colour ramp'],
    ['grid', 'Grid', 'Technical HUD wireframe coordinate grid'],
    ['lens-flare', 'Lens Flare', 'Anamorphic and prime multi-element optical flare'],
    ['paint-bucket', 'Paint Bucket', 'Contiguous tolerance flood fill'],
    ['radio-waves', 'Radio Waves', 'Expanding shockwave pulse rings'],
    ['scribble', 'Scribble', 'Hand-drawn hatching fill along masks'],
    ['stroke-fx', 'Stroke', 'Animated reveal stroke along Bezier masks'],
    ['vegas', 'Vegas', 'Chasing neon contour segments'],
    ['write-on', 'Write-On', 'Animated brush path ink reveal'],
  ]),
  // 5. Keying (9)
  ...buildCategoryEffects('Keying', 'keying', [
    ['keylight', 'Keylight (Studio Chroma)', 'Screen-colour chroma keyer with despill and edge matte'],
    ['linear-colour-key', 'Linear Colour Key', 'RGB/HSL linear distance chroma key'],
    ['colour-difference-key', 'Colour Difference Key', 'Matte A / Matte B dual-pass blue/green keyer'],
    ['colour-range', 'Colour Range', 'Lab/YUV box range keyer'],
    ['luma-key', 'Luma Key', 'Key out brighter or darker luminance bands'],
    ['extract', 'Extract', 'Soft-rolloff luminance range alpha extractor'],
    ['inner-outer-key', 'Inner/Outer Key', 'Trimap foreground/background trim keyer'],
    ['key-cleaner', 'Key Cleaner', 'Alpha edge chatter recovery filter'],
    ['advanced-spill-suppressor', 'Advanced Spill Suppressor', 'Neutralizes green/blue bounce spill on skin and hair'],
  ]),
  // 6. Matte (10)
  ...buildCategoryEffects('Matte', 'matte', [
    ['simple-choker', 'Simple Choker', 'Sub-pixel alpha erode or dilate'],
    ['matte-choker', 'Matte Choker', 'Dual-iteration geometric softness matte choke'],
    ['minimax', 'Minimax', 'Morphological min/max erode-dilate operator'],
    ['channel-combiner', 'Channel Combiner', 'Cross-channel math & lightness transfer'],
    ['compound-arithmetic', 'Compound Arithmetic', 'Layer-to-layer ARGB boolean arithmetic'],
    ['invert', 'Invert', 'Invert RGB, Alpha, HLS, or YIQ channels'],
    ['remove-colour-matting', 'Remove Colour Matting', 'Unmultiply black/white background fringe'],
    ['set-channels', 'Set Channels', 'Copy R/G/B/A channels from source layers'],
    ['set-matte', 'Set Matte', 'Composite alpha/luma matte from arbitrary layer'],
    ['shift-channels', 'Shift Channels', 'Swizzle RGBA channels'],
  ]),
  // 7. Noise & Grain (7)
  ...buildCategoryEffects('Noise & Grain', 'noise', [
    ['add-grain', 'Add Grain', 'Photochemical 35mm/16mm film grain synthesis'],
    ['dust-and-scratches', 'Dust & Scratches', 'Thresholded impulse defect healer'],
    ['fractal-noise', 'Fractal Noise', 'Multi-octave Perlin/Simplex procedural atmospheric noise'],
    ['match-grain', 'Match Grain', 'Sample and match plate noise profile'],
    ['median', 'Median', 'Non-linear rank-order despeckle filter'],
    ['remove-grain', 'Remove Grain', 'Multi-band luma/chroma noise suppressor'],
    ['turbulent-noise', 'Turbulent Noise', 'Fast dynamic evolution turbulence generator'],
  ]),
  // 8. Perspective (6)
  ...buildCategoryEffects('Perspective', 'perspective', [
    ['3d-camera-tracker', '3D Camera Tracker', 'Solve 3D camera motion & ground plane from footage'],
    ['3d-glasses', '3D Glasses', 'Stereo Red/Cyan anaglyph convergence'],
    ['bevel-alpha', 'Bevel Alpha', 'Chiseled lit bevel along layer alpha boundaries'],
    ['bevel-edges', 'Bevel Edges', '3D rectangular border bevel'],
    ['drop-shadow', 'Drop Shadow', 'Directional soft alpha drop shadow'],
    ['radial-shadow', 'Radial Shadow', 'Point-source projected shadow'],
  ]),
  // 9. Simulation (10)
  ...buildCategoryEffects('Simulation', 'simulation', [
    ['card-dance', 'Card Dance', '3D matrix tile flip driven by wave/gradient'],
    ['caustics', 'Caustics', 'Refracted underwater light caustics'],
    ['foam', 'Foam', 'Buoyant clustering bubble dynamics'],
    ['particle-playground', 'Particle Playground', 'Cannon & grid physics emitter'],
    ['shatter', 'Shatter', 'Voronoi/brick/glass 3D shard explosion'],
    ['wave-world', 'Wave World', '2D shallow-water heightfield simulator'],
    ['particle-systems-ii', 'Particle Systems II', 'Vortex, explosive, fire, and star particle engine'],
    ['rainfall', 'Rainfall', 'Atmospheric angled rain streaks'],
    ['snowfall', 'Snowfall', 'Turbulent depth-layered snow'],
    ['star-burst', 'Star Burst', 'Parallax starfield warp'],
  ]),
  // 10. Stylize (15)
  ...buildCategoryEffects('Stylize', 'stylize', [
    ['brush-strokes', 'Brush Strokes', 'Directional painterly stroke stylizer'],
    ['cartoon', 'Cartoon', 'Cel-shaded posterization + ink contours'],
    ['colour-emboss', 'Colour Emboss', 'Chromatic relief emboss'],
    ['emboss', 'Emboss', 'Neutral gray directional relief'],
    ['find-edges', 'Find Edges', 'Sobel gradient edge extractor'],
    ['glow', 'Optical Glow', '32-bpc thresholded multi-radius optical bloom'],
    ['mosaic', 'Mosaic', 'Pixelated rectangular cell mosaic'],
    ['motion-tile', 'Motion Tile', 'Mirrored edge expansion for seamless camera shakes'],
    ['posterize', 'Posterize', 'Quantize RGB tonal steps'],
    ['roughen-edges', 'Roughen Edges', 'Organic fractal distressed alpha edges'],
    ['scatter', 'Scatter', 'Random sub-pixel stipple scatter'],
    ['strobe-light', 'Strobe Light', 'Rhythmic flash/invert strobe'],
    ['texturize', 'Texturize', 'Bump-map surface relief'],
    ['threshold', 'Threshold', 'High-contrast 1-bit binary luma split'],
    ['chromatic-aberration', 'Chromatic Aberration & Vignette', 'Lateral RGB lens dispersion + optical falloff'],
  ]),
  // 11. Text (2)
  ...buildCategoryEffects('Text', 'text-fx', [
    ['numbers', 'Numbers', 'Animated numeric counter, hex, percentage, and date generator'],
    ['timecode', 'Timecode', 'SMPTE frame-accurate burn-in overlay'],
  ]),
  // 12. Time (5)
  ...buildCategoryEffects('Time', 'time', [
    ['echo', 'Echo', 'Multi-frame motion trail compositor'],
    ['posterize-time', 'Posterize Time', 'Quantize layer frame cadence'],
    ['time-difference', 'Time Difference', 'Frame-to-frame motion delta matte'],
    ['time-displacement', 'Time Displacement', 'Luminance-mapped temporal pixel warp'],
    ['timewarp', 'Timewarp', 'Optical-flow slow-motion & shutter retiming'],
  ]),
  // 13. Transition (7)
  ...buildCategoryEffects('Transition', 'transition', [
    ['block-dissolve', 'Block Dissolve', 'Randomized cellular block transition'],
    ['card-wipe', 'Card Wipe', 'Flipping 3D card grid transition'],
    ['gradient-wipe', 'Gradient Wipe', 'Luma-driven organic reveal'],
    ['iris-wipe', 'Iris Wipe', 'Polygonal aperture iris reveal'],
    ['linear-wipe', 'Linear Wipe', 'Angled feathered directional wipe'],
    ['radial-wipe', 'Radial Wipe', 'Clock-sweep radial transition'],
    ['venetian-blinds', 'Venetian Blinds', 'Parallel slat wipe'],
  ]),
  // 14. Utility (5)
  ...buildCategoryEffects('Utility', 'utility', [
    ['apply-colour-lut', 'Apply Colour LUT', 'Trilinear 3D .cube LUT colour grade'],
    ['cineon-converter', 'Cineon Converter', '10-bit film log <-> linear converter'],
    ['colour-profile-converter', 'Colour Profile Converter', 'Working colour space matrix & transfer converter'],
    ['hdr-compander', 'HDR Compander', 'Dynamic range compressor/expander'],
    ['hdr-highlight-compression', 'HDR Highlight Compression', 'Soft-knee superwhite highlight roll-off'],
  ]),
  // 15. Audio (10)
  ...buildCategoryEffects('Audio', 'audio', [
    ['audio-backwards', 'Backwards', 'Reverse PCM audio buffer'],
    ['audio-bass-treble', 'Bass & Treble', 'Low-shelf and high-shelf biquad EQ'],
    ['audio-delay', 'Delay', 'Feedback slapback/echo delay line'],
    ['audio-flange-chorus', 'Flange & Chorus', 'Modulated stereo comb chorus'],
    ['audio-high-low-pass', 'High-Low Pass', 'Resonant lowpass & highpass filter'],
    ['audio-modulator', 'Modulator', 'Ring and vibrato AM/FM modulation'],
    ['audio-parametric-eq', 'Parametric EQ', 'Peaking Q-adjustable frequency band'],
    ['audio-reverb', 'Reverb', 'Algorithmic studio room & hall reverb'],
    ['audio-stereo-mixer', 'Stereo Mixer', 'Left/Right balance and phase matrix'],
    ['audio-tone', 'Tone', 'Multi-harmonic sine/saw/square test oscillator'],
  ]),
  // 16. Immersive Video / VR (9)
  ...buildCategoryEffects('Immersive Video / VR', 'vr', [
    ['vr-chromatic-aberrations', 'VR Chromatic Aberrations', 'Pole-compensated 360 dispersion'],
    ['vr-colour-gradients', 'VR Colour Gradients', 'Equirectangular horizon-seamless gradient'],
    ['vr-converter', 'VR Converter', 'Equirectangular <-> Cubemap/Fisheye projection'],
    ['vr-de-noise', 'VR De-Noise', 'Seam-aware spherical noise reduction'],
    ['vr-digital-glitch', 'VR Digital Glitch', '360 scanline & datamosh glitch'],
    ['vr-fractal-noise', 'VR Fractal Noise', 'Pole-pinch-free 3D spherical fractal noise'],
    ['vr-glow', 'VR Glow', 'Spherical solid-angle optical bloom'],
    ['vr-plane-to-sphere', 'VR Plane to Sphere', 'Project 2D graphic onto 360 equirectangular sphere'],
    ['vr-rotate-sphere', 'VR Rotate Sphere', 'Tilt, pan, and roll 360 footage'],
  ]),
  // 17. 3D Channel (4)
  ...buildCategoryEffects('3D Channel', '3d-channel', [
    ['3d-channel-extract', '3D Channel Extract', 'Visualize Z-Depth, Normals, ID, or Motion Vectors'],
    ['depth-matte', 'Depth Matte', 'Z-buffer slice matte'],
    ['depth-of-field-fx', 'Depth of Field', 'Post-process Z-depth bokeh'],
    ['fog-3d', 'Fog 3D', 'Exponential atmospheric depth fog'],
  ]),
  // 18. Expression Controls (7)
  ...buildCategoryEffects('Expression Controls', 'expression-control', [
    ['slider-control', 'Slider Control', 'Rigging scalar slider parameter', [pNum('Slider', 'Slider', 50, -1000, 1000, 0.5)]],
    ['checkbox-control', 'Checkbox Control', 'Rigging boolean switch', [pBool('Checkbox', 'Checkbox', true)]],
    ['colour-control', 'Colour Control', 'Rigging RGBA swatch', [pCol('Colour', 'Colour', '#38BDF8')]],
    ['point-control', 'Point Control', 'Rigging 2D coordinate controller', [pNum('PointX', 'Point X', 960, -4000, 4000, 1), pNum('PointY', 'Point Y', 540, -4000, 4000, 1)]],
    ['layer-control', 'Layer Control', 'Rigging target layer selector', [pNum('LayerIndex', 'Layer Index', 1, 1, 99, 1)]],
    ['angle-control', 'Angle Control', 'Rigging degrees dial', [pNum('Angle', 'Angle', 0, -3600, 3600, 1, 'deg')]],
    ['dropdown-menu-control', 'Dropdown Menu Control', 'Rigging state selector', [pSel('Menu', 'Menu', ['Option 1', 'Option 2', 'Option 3'])]],
  ]),
  // 19. PreEffects Local AI & Procedural Studio — Exceeding AE (7)
  ...buildCategoryEffects(
    'PreEffects AI & Procedural',
    'ai-procedural',
    [
      ['ai-roto-matting', 'AI Roto Matting (Local)', 'Offline guided bilateral foreground alpha segmentation'],
      ['ai-super-scale', 'AI Super-Scale 2x/4x', 'Offline edge-directed gradient super-resolution detail enhancer'],
      ['ai-optical-flow-tween', 'AI Optical-Flow Frame Tween', 'Offline motion-compensated slow-motion frame synthesis'],
      ['ai-temporal-denoise', 'AI Spatio-Temporal Denoise', 'Offline edge-preserving temporal luma/chroma denoiser'],
      ['procedural-reaction-diffusion', 'Procedural Reaction-Diffusion', 'Turing Gray-Scott organic morphogenesis generator'],
      ['procedural-l-system', 'Procedural L-System Botanicals', 'Recursive animated fractal branching structures'],
      ['procedural-voronoi-crystals', 'Procedural Voronoi Crystals', 'Animated cellular geodesic crystal field'],
    ],
    true,
  ),
];

const EFFECT_MAP = new Map<string, EffectDefinition>(BUILT_IN_EFFECTS.map((e) => [e.id, e]));
const EFFECT_SEARCH_INDEX: Array<{ def: EffectDefinition; haystack: string }> = BUILT_IN_EFFECTS.map((def) => ({
  def,
  haystack: `${def.name} ${def.category} ${def.description}`.toLowerCase(),
}));

export const EFFECTS_CATALOG: EffectDefinition[] = BUILT_IN_EFFECTS;
export const EFFECT_CATEGORIES: string[] = Array.from(new Set(BUILT_IN_EFFECTS.map((e) => e.category)));

export function searchEffects(query: string): EffectDefinition[] {
  const q = query.trim().toLowerCase();
  if (!q) return BUILT_IN_EFFECTS;
  if (!q.includes(' ')) {
    const out: EffectDefinition[] = [];
    for (let i = 0; i < EFFECT_SEARCH_INDEX.length; i++) {
      if (EFFECT_SEARCH_INDEX[i].haystack.includes(q)) out.push(EFFECT_SEARCH_INDEX[i].def);
    }
    return out;
  }
  const tokens = q.split(/\s+/);
  const out: EffectDefinition[] = [];
  for (let i = 0; i < EFFECT_SEARCH_INDEX.length; i++) {
    const h = EFFECT_SEARCH_INDEX[i].haystack;
    let match = true;
    for (let t = 0; t < tokens.length; t++) {
      if (!h.includes(tokens[t])) { match = false; break; }
    }
    if (match) out.push(EFFECT_SEARCH_INDEX[i].def);
  }
  return out;
}

export function getEffectDefinition(effectId: string): EffectDefinition | undefined {
  return EFFECT_MAP.get(effectId);
}

export function getEffectCategories(): string[] {
  return Array.from(new Set(BUILT_IN_EFFECTS.map((e) => e.category)));
}

const EFFECT_ID_ALIASES: Record<string, string> = {
  lumetri: 'lumetri-wheels',
  'lumetri-color': 'lumetri-wheels',
  'warp-stabilizer': 'warp-stabilizer-vfx',
  keylight: 'keylight-12',
};

function resolveEffectDef(effectId: string) {
  const direct = EFFECT_MAP.get(effectId);
  if (direct) return direct;
  const stripped = effectId.startsWith('fx-') ? effectId.slice(3) : effectId;
  const byStripped = EFFECT_MAP.get(stripped);
  if (byStripped) return byStripped;
  const aliased = EFFECT_ID_ALIASES[stripped];
  if (aliased && EFFECT_MAP.get(aliased)) return EFFECT_MAP.get(aliased);
  return EFFECTS_CATALOG.find((fx) => fx.id.includes(stripped));
}

export function createEffectInstance(effectId: string): EffectInstance {
  const def = resolveEffectDef(effectId);
  if (!def) {
    throw new Error(`Unknown effect ID: ${effectId}`);
  }
  const params: EffectInstance['params'] = {};
  for (const p of def.params) {
    params[p.key] = makeProp(p.defaultValue);
  }
  return {
    id: createId('fx'),
    effectId: def.id,
    name: def.name,
    category: def.category,
    enabled: true,
    params,
  };
}

export function executeEffectBuffer(
  effectId: string,
  src: Uint8ClampedArray,
  dst: Uint8ClampedArray,
  params: EvaluatedParams,
  ctx: EffectExecContext,
): void {
  const def = resolveEffectDef(effectId);
  if (!def) {
    dst.set(src);
    return;
  }
  runEffectFamilyKernel(def.family, def.id, src, dst, params, ctx);
}

// EXCEED-10: Smart Resolution-Adaptive Presets
export interface SmartAdaptivePreset {
  id: string;
  name: string;
  category: string;
  description: string;
  applyToCompScale: (compWidth: number, compHeight: number) => EffectInstance[];
}

export const SMART_ADAPTIVE_PRESETS: SmartAdaptivePreset[] = [
  {
    id: 'preset-cinema-bloom',
    name: 'Anamorphic 32-bpc Cinema Bloom',
    category: 'Look-Dev',
    description: 'Scales optical glow radius & Kodak 2383 LUT automatically to 1080p/4K/Vertical comps',
    applyToCompScale: (w, h) => {
      const scale = Math.hypot(w, h) / Math.hypot(1920, 1080);
      const glow = createEffectInstance('glow');
      glow.params.radius.value = Math.round(22 * scale);
      glow.params.intensity.value = 1.35;
      const lut = createEffectInstance('apply-colour-lut');
      lut.params.lutPreset.value = 'kodak-2383';
      return [glow, lut];
    },
  },
  {
    id: 'preset-greenscreen-clean',
    name: 'Broadcast Green-Screen Key + Despill + Edge Clean',
    category: 'VFX Keying',
    description: 'Applies Keylight + Advanced Spill Suppressor + Simple Choker tuned to comp resolution',
    applyToCompScale: (w) => {
      const key = createEffectInstance('keylight');
      const spill = createEffectInstance('advanced-spill-suppressor');
      const choke = createEffectInstance('simple-choker');
      choke.params.amount.value = Math.round(4 * (w / 1920));
      return [key, spill, choke];
    },
  },
  {
    id: 'preset-cyber-hud-glitch',
    name: 'Sci-Fi Telemetry HUD Glow + Scanline Aberration',
    category: 'Motion Design',
    description: 'Resolution-adaptive chromatic fringe + optical neon glow',
    applyToCompScale: (w) => {
      const ca = createEffectInstance('chromatic-aberration');
      ca.params.amount.value = Math.round(18 * (w / 1920));
      const glow = createEffectInstance('glow');
      glow.params.radius.value = Math.round(16 * (w / 1920));
      return [ca, glow];
    },
  },
  {
    id: 'preset-ai-restore',
    name: 'Offline AI Denoise + Super-Scale Polish',
    category: 'Local AI',
    description: 'Pairs Spatio-Temporal AI Denoise with Edge-Directed AI Super-Scale',
    applyToCompScale: () => [
      createEffectInstance('ai-temporal-denoise'),
      createEffectInstance('ai-super-scale'),
    ],
  },
];
