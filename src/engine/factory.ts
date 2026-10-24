import { AnimatableProperty, Composition, Layer, LayerTransform, LayerType } from './types';

export function makeProp<T>(value: T): AnimatableProperty<T> {
  return {
    value,
    animated: false,
    keyframes: [],
    expression: '',
    expressionEnabled: false,
  };
}

export function createDefaultTransform(cx = 960, cy = 540, ax = 960, ay = 540): LayerTransform {
  return {
    anchorPoint: makeProp<[number, number, number]>([ax, ay, 0]),
    position: makeProp<[number, number, number]>([cx, cy, 0]),
    scale: makeProp<[number, number, number]>([100, 100, 100]),
    rotationX: makeProp(0),
    rotationY: makeProp(0),
    rotationZ: makeProp(0),
    orientation: [0, 0, 0],
    opacity: makeProp(100),
  };
}

let uidCounter = 1000;
export function createId(prefix: string): string {
  uidCounter++;
  return `${prefix}_${uidCounter.toString(36)}`;
}

export function buildDefaultLayerForComp(
  type: LayerType,
  comp: Pick<Composition, 'width' | 'height' | 'duration' | 'layers'>,
  customId?: string,
): Layer {
  const base: Layer = {
    id: customId ?? createId('lyr'),
    name: `${type.charAt(0).toUpperCase() + type.slice(1)} ${comp.layers.length + 1}`,
    type,
    labelColor: type === 'text' ? '#E89B3C' : type === 'shape' ? '#38BDF8' : type === 'adjustment' ? '#E079B5' : '#7CC69B',
    visible: true,
    audioEnabled: type === 'audio',
    solo: false,
    locked: false,
    shy: false,
    collapseTransformations: false,
    frameBlending: 'off',
    motionBlur: false,
    threeD: type === 'camera' || type === 'light',
    inPoint: 0,
    outPoint: comp.duration,
    startTime: 0,
    stretchPct: 100,
    blendMode: 'normal',
    trackMatteMode: 'none',
    transform: createDefaultTransform(comp.width / 2, comp.height / 2, comp.width / 2, comp.height / 2),
    masks: [],
    effects: [],
    paintStrokes: [],
    puppetPins: [],
    markers: [],
  };
  if (type === 'solid') base.solidColor = '#253352';
  if (type === 'shape') {
    base.shapeContent = {
      kind: 'rect',
      width: 420,
      height: 240,
      fillType: 'linear-gradient',
      fillColor: '#E89B3C',
      fillColorEnd: '#38BDF8',
      fillOpacity: 85,
      strokeColor: '#F8FAFC',
      strokeWidth: 4,
      operators: [],
    };
  }
  if (type === 'text') {
    base.textData = {
      text: 'NEW STUDIO LAYER',
      boxMode: 'point',
      boxWidth: 900,
      boxHeight: 200,
      fontFamily: 'Inter',
      fontWeight: '700',
      fontStyle: 'normal',
      fontSize: 72,
      leading: 86,
      tracking: 30,
      fillColor: '#FFFFFF',
      strokeColor: '#E89B3C',
      strokeWidth: 0,
      align: 'center',
      allCaps: false,
      smallCaps: false,
      perCharacter3D: false,
      animators: [],
    };
  }
  if (type === 'camera') {
    base.cameraSettings = {
      cameraType: 'two-node',
      focalLengthMm: 50,
      pointOfInterest: [comp.width / 2, comp.height / 2, 0],
      depthOfField: true,
      focusDistance: 1200,
      aperture: 24,
      blurLevel: 80,
    };
  }
  if (type === 'light') {
    base.lightSettings = {
      lightType: 'spot',
      color: '#FFF1D0',
      intensity: 120,
      coneAngle: 90,
      coneFeather: 50,
      castsShadows: true,
      shadowDarkness: 75,
      shadowDiffusion: 15,
    };
  }
  return base;
}
