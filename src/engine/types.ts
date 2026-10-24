import { WorkingColorSpace } from '../utils/color';

export type LayerType =
  | 'solid'
  | 'shape'
  | 'text'
  | 'null'
  | 'camera'
  | 'light'
  | 'audio'
  | 'footage'
  | 'precomp'
  | 'adjustment'
  | 'guide';

export type BlendMode =
  | 'normal' | 'dissolve'
  | 'darken' | 'multiply' | 'color-burn' | 'linear-burn' | 'darker-color'
  | 'add' | 'lighten' | 'screen' | 'color-dodge' | 'linear-dodge' | 'lighter-color'
  | 'overlay' | 'soft-light' | 'hard-light' | 'linear-light' | 'vivid-light' | 'pin-light' | 'hard-mix'
  | 'difference' | 'exclusion' | 'subtract' | 'divide'
  | 'hue' | 'saturation' | 'color' | 'luminosity'
  | 'stencil-alpha' | 'stencil-luma' | 'silhouette-alpha' | 'silhouette-luma'
  | 'alpha-add' | 'luminescent-premul';

export const ALL_BLEND_MODES: BlendMode[] = [
  'normal', 'dissolve',
  'darken', 'multiply', 'color-burn', 'linear-burn', 'darker-color',
  'add', 'lighten', 'screen', 'color-dodge', 'linear-dodge', 'lighter-color',
  'overlay', 'soft-light', 'hard-light', 'linear-light', 'vivid-light', 'pin-light', 'hard-mix',
  'difference', 'exclusion', 'subtract', 'divide',
  'hue', 'saturation', 'color', 'luminosity',
  'stencil-alpha', 'stencil-luma', 'silhouette-alpha', 'silhouette-luma',
  'alpha-add', 'luminescent-premul',
];

export type TrackMatteMode = 'none' | 'alpha' | 'alpha-inverted' | 'luma' | 'luma-inverted';

export type ToolId =
  | 'selection'
  | 'hand'
  | 'zoom'
  | 'rotate'
  | 'camera'
  | 'anchor'
  | 'shape-rect'
  | 'pen'
  | 'text'
  | 'brush'
  | 'clone'
  | 'eraser'
  | 'roto-brush'
  | 'puppet-pin';

export type WorkspaceId =
  | 'standard'
  | 'animation'
  | 'effects'
  | 'color'
  | '3d'
  | 'tracking'
  | 'paint'
  | 'text'
  | 'minimal';

export type OutputFormatId =
  | 'gif'
  | 'avi'
  | 'wav'
  | 'ppm-seq'
  | 'tga-seq'
  | 'exr-seq'
  | 'png-frame'
  | 'webm'
  | 'mp4-ffmpeg'
  | 'prores-ffmpeg';

export type KeyframeInterpolation = 'linear' | 'bezier' | 'auto-bezier' | 'continuous-bezier' | 'hold';

export interface Keyframe<T = number> {
  id: string;
  time: number; // seconds
  value: T;
  interpolation: KeyframeInterpolation;
  outInfluence?: number; // 0.01..1
  outSlope?: number;
  inInfluence?: number; // 0.01..1
  inSlope?: number;
  spatialTangentIn?: [number, number, number];
  spatialTangentOut?: [number, number, number];
  roving?: boolean;
}

export interface AnimatableProperty<T = number> {
  value: T;
  animated: boolean;
  keyframes: Keyframe<T>[];
  expression?: string;
  expressionEnabled?: boolean;
}

export interface LayerTransform {
  anchorPoint: AnimatableProperty<[number, number, number]>;
  position: AnimatableProperty<[number, number, number]>;
  scale: AnimatableProperty<[number, number, number]>; // percentages 100,100,100
  rotationX: AnimatableProperty<number>;
  rotationY: AnimatableProperty<number>;
  rotationZ: AnimatableProperty<number>;
  orientation: [number, number, number];
  opacity: AnimatableProperty<number>; // 0..100
}

export type MaskMode = 'none' | 'add' | 'subtract' | 'intersect' | 'lighten' | 'darken' | 'difference';

export interface MaskVertex {
  x: number;
  y: number;
  inX: number;
  inY: number;
  outX: number;
  outY: number;
  featherRadius?: number; // variable per-point feathering!
}

export interface MaskItem {
  id: string;
  name: string;
  mode: MaskMode;
  inverted: boolean;
  locked: boolean;
  rotoBezier: boolean;
  closed: boolean;
  vertices: MaskVertex[];
  feather: number;
  expansion: number;
  opacity: number; // 0..100
}

export type ShapeOperatorType =
  | 'trim-paths'
  | 'repeater'
  | 'offset-paths'
  | 'round-corners'
  | 'pucker-bloat'
  | 'wiggle-paths'
  | 'wiggle-transform'
  | 'zig-zag'
  | 'merge-paths';

export interface ShapeOperator {
  id: string;
  type: ShapeOperatorType;
  enabled: boolean;
  params: Record<string, number | string>;
}

export interface ShapeContent {
  kind: 'rect' | 'ellipse' | 'polystar' | 'path';
  width: number;
  height: number;
  points?: number; // polystar
  innerRadius?: number;
  outerRadius?: number;
  cornerRadius?: number;
  vertices?: MaskVertex[];
  fillType: 'none' | 'solid' | 'linear-gradient' | 'radial-gradient';
  fillColor: string;
  fillColorEnd?: string;
  fillOpacity: number;
  strokeColor: string;
  strokeWidth: number;
  strokeDash?: number;
  operators: ShapeOperator[];
}

export interface TextAnimatorSelector {
  id: string;
  name: string;
  selectorType: 'range' | 'wiggly' | 'expression';
  start: number; // 0..100
  end: number;   // 0..100
  offset: number; // -100..100
  shape: 'square' | 'ramp-up' | 'ramp-down' | 'triangle' | 'round' | 'smooth';
  positionOffset: [number, number, number];
  scaleOffset: [number, number];
  rotationOffset: number;
  opacityOffset: number; // -100..100
  trackingOffset: number;
  fillHueShift?: number;
  blurAmount?: number;
  wigglesPerSecond?: number;
  expressionSelector?: string;
}

export interface TextLayerData {
  text: string;
  boxMode: 'point' | 'paragraph';
  boxWidth: number;
  boxHeight: number;
  fontFamily: string;
  fontWeight: '400' | '500' | '600' | '700' | '800';
  fontStyle: 'normal' | 'italic';
  fontSize: number;
  leading: number;
  tracking: number;
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
  align: 'left' | 'center' | 'right' | 'justify';
  allCaps: boolean;
  smallCaps: boolean;
  perCharacter3D: boolean;
  pathMaskId?: string;
  pathMargin?: number;
  animators: TextAnimatorSelector[];
}

export interface CameraSettings {
  cameraType: 'one-node' | 'two-node';
  focalLengthMm: number; // e.g. 15, 24, 35, 50, 80, 135
  pointOfInterest: [number, number, number];
  depthOfField: boolean;
  focusDistance: number;
  aperture: number;
  blurLevel: number;
}

export interface LightSettings {
  lightType: 'parallel' | 'spot' | 'point' | 'ambient';
  color: string;
  intensity: number; // 0..300%
  coneAngle: number;
  coneFeather: number;
  castsShadows: boolean;
  shadowDarkness: number;
  shadowDiffusion: number;
}

export interface Material3DOptions {
  castsShadows: boolean;
  acceptsShadows: boolean;
  acceptsLights: boolean;
  ambient: number;
  diffuse: number;
  specular: number;
  shininess: number;
  metal: number;
  extrusionDepth: number;
}

export interface PaintStroke {
  id: string;
  tool: 'brush' | 'clone' | 'eraser';
  color: string;
  radius: number;
  hardness: number;
  opacity: number;
  startTime: number;
  durationMode: 'constant' | 'single-frame' | 'write-on' | 'custom';
  duration: number;
  cloneOffset?: [number, number];
  points: Array<[number, number]>;
}

export interface PuppetPin {
  id: string;
  kind: 'position' | 'starch' | 'overlap';
  restX: number;
  restY: number;
  currentX: number;
  currentY: number;
  stiffness: number;
}

export interface EffectInstance {
  id: string;
  effectId: string;
  name: string;
  category: string;
  enabled: boolean;
  favorite?: boolean;
  params: Record<string, AnimatableProperty<number | string | boolean | [number, number]>>;
}

export interface LayerMarker {
  id: string;
  time: number;
  duration: number;
  comment: string;
  color: string;
}

export interface Layer {
  id: string;
  name: string;
  type: LayerType;
  labelColor: string;
  visible: boolean;
  audioEnabled: boolean;
  solo: boolean;
  locked: boolean;
  shy: boolean;
  collapseTransformations: boolean;
  frameBlending: 'off' | 'frame-mix' | 'pixel-motion';
  motionBlur: boolean;
  threeD: boolean;
  inPoint: number;
  outPoint: number;
  startTime: number;
  stretchPct: number;
  timeRemap?: AnimatableProperty<number>;
  blendMode: BlendMode;
  trackMatteMode: TrackMatteMode;
  trackMatteLayerId?: string;
  parentId?: string;
  transform: LayerTransform;
  masks: MaskItem[];
  rotoMatteEnabled?: boolean;
  rotoForegroundSeeds?: Array<[number, number]>;
  rotoBackgroundSeeds?: Array<[number, number]>;
  effects: EffectInstance[];
  paintStrokes: PaintStroke[];
  puppetPins: PuppetPin[];
  markers: LayerMarker[];
  solidColor?: string;
  shapeContent?: ShapeContent;
  textData?: TextLayerData;
  cameraSettings?: CameraSettings;
  lightSettings?: LightSettings;
  material3D?: Material3DOptions;
  assetId?: string;
  precompId?: string;
  masterOverrides?: Record<string, number | string>;
  audioGainDb?: number;
}

export interface GraphNodeItem {
  id: string;
  kind: 'layer-source' | 'effect' | 'branch-effect' | 'merge' | 'output';
  label: string;
  layerId?: string;
  effectInstanceId?: string;
  effectId?: string;
  x: number;
  y: number;
  bypassed?: boolean;
  inputs: string[];
}

export interface NodeGraphState {
  nodes: GraphNodeItem[];
  zoom: number;
  panX: number;
  panY: number;
  showThumbnails: boolean;
}

export interface Composition {
  id: string;
  name: string;
  width: number;
  height: number;
  pixelAspect: number;
  fps: number;
  duration: number;
  backgroundColor: string;
  workAreaStart: number;
  workAreaEnd: number;
  hideShyLayers: boolean;
  motionBlurEnabled: boolean;
  shutterAngle: number;
  shutterPhase: number;
  frameBlendingEnabled: boolean;
  renderer3D: 'classic-3d' | 'extruded-3d' | 'pbr-ray-3d';
  markers: LayerMarker[];
  layers: Layer[];
  nodeGraph?: NodeGraphState;
}

export interface ObjMeshData {
  vertices: Array<[number, number, number]>;
  faces: Array<number[]>;
}

export interface ProjectAsset {
  id: string;
  name: string;
  folder: string;
  kind: 'video' | 'image' | 'audio' | 'solid' | 'mesh3d' | 'data' | 'lut' | 'psd' | 'vector';
  path: string;
  missing?: boolean;
  proxyEnabled?: boolean;
  proxyScale?: number;
  width?: number;
  height?: number;
  fps?: number;
  duration?: number;
  alphaMode?: 'straight' | 'premultiplied' | 'ignore';
  loopCount?: number;
  rgbaBuffer?: Uint8ClampedArray;
  audioSamples?: Float32Array;
  audioSampleRate?: number;
  mesh3D?: ObjMeshData;
  structuredData?: Record<string, unknown> | Array<Record<string, string | number>>;
  cubeLutText?: string;
}

export interface OutputModuleConfig {
  id: string;
  format: 'gif' | 'avi' | 'wav' | 'ppm-seq' | 'tga-seq' | 'exr-seq' | 'png-frame' | 'webm' | 'mp4-ffmpeg' | 'prores-ffmpeg';
  channels: 'rgb' | 'rgba' | 'alpha';
  includeAudio: boolean;
  aovPasses: Array<'beauty' | 'z-depth' | 'normals' | 'object-id' | 'motion-vectors'>;
  outputName: string;
  lutPreset?: string;
}

export interface RenderQueueItem {
  id: string;
  compId: string;
  status: 'queued' | 'rendering' | 'paused' | 'completed' | 'failed';
  quality: 'best' | 'draft';
  resolutionDivisor: 1 | 2 | 4;
  useProxies: boolean;
  startFrame: number;
  endFrame: number;
  progressPct: number;
  elapsedMs: number;
  outputModules: OutputModuleConfig[];
  renderedArtifacts?: Array<{ name: string; mimeType: string; byteLength: number; data?: Uint8Array }>;
}

export interface SnapshotCommit {
  id: string;
  message: string;
  timestamp: number;
  compSummary: Array<{ id: string; name: string; effectsCount: number; blendMode: string }>;
  serializedProject: string;
}

export interface StudioPreferences {
  theme: 'dark' | 'light' | 'high-contrast' | 'graphite' | 'custom';
  customThemeTokens?: Record<string, string>;
  locale: 'en' | 'nl' | 'de' | 'ja';
  uiScalePct: number;
  reducedMotion: boolean;
  colorBlindSafeLabels: boolean;
  showTimecodeAsFrames: boolean;
  autoSaveEnabled: boolean;
  autoSaveIntervalSec: number;
  maxRamCacheMb: number;
  maxDiskCacheGb: number;
  adaptiveScrubResolution: boolean;
  gpuAcceleration: boolean;
  undoLevels: number;
}

export interface Project {
  schemaVersion: '1.0.0';
  id: string;
  name: string;
  bitDepth: 8 | 16 | 32;
  workingColorSpace: WorkingColorSpace;
  linearizeWorkingSpace: boolean;
  audioSampleRate: 44100 | 48000 | 96000;
  notes: string;
  activeCompId: string;
  openCompIds: string[];
  compositions: Composition[];
  assets: ProjectAsset[];
  renderQueue: RenderQueueItem[];
  versionCommits: SnapshotCommit[];
  favoriteEffectIds: string[];
}
