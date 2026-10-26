// Customisable Cross-Platform Keyboard Shortcut Registry (macOS Cmd vs Windows/Linux Ctrl)

export interface ShortcutBinding {
  id: string;
  command: string;
  category: 'File' | 'Edit' | 'Composition' | 'Layer' | 'Animation' | 'View' | 'Tools' | 'Playback';
  combo: string; // Uses 'Mod' for Cmd on macOS / Ctrl on Win+Linux, e.g. 'Mod+K', 'Shift+F9', 'V'
}

export const DEFAULT_SHORTCUTS: ShortcutBinding[] = [
  { id: 'goHome', command: 'Toggle PreEffects Home Hub', category: 'View', combo: 'Alt+H' },
  { id: 'cmdPalette', command: 'Search Everything / Command Palette', category: 'View', combo: 'Mod+K' },
  { id: 'openGuide', command: 'Open Interactive Studio Guide & Handbook', category: 'View', combo: 'F1' },
  { id: 'openTutorial', command: 'Launch Interactive Feature Tutorial', category: 'View', combo: 'F2' },
  { id: 'newComp', command: 'New Composition', category: 'Composition', combo: 'Mod+N' },
  { id: 'saveProject', command: 'Save Project (.prex)', category: 'File', combo: 'Mod+S' },
  { id: 'importAsset', command: 'Import Footage / Asset', category: 'File', combo: 'Mod+I' },
  { id: 'addRenderQueue', command: 'Add to Render Queue', category: 'Composition', combo: 'Mod+M' },
  { id: 'undo', command: 'Undo', category: 'Edit', combo: 'Mod+Z' },
  { id: 'redo', command: 'Redo', category: 'Edit', combo: 'Mod+Shift+Z' },
  { id: 'copyItem', command: 'Copy Selected Layer / Effect / Keyframe', category: 'Edit', combo: 'Mod+C' },
  { id: 'pasteItem', command: 'Paste Layer / Effect / Keyframe at Playhead', category: 'Edit', combo: 'Mod+V' },
  { id: 'deleteLayer', command: 'Delete Selected Layer(s)', category: 'Edit', combo: 'Backspace' },
  { id: 'duplicateLayer', command: 'Duplicate Selected Layer', category: 'Edit', combo: 'Mod+D' },
  { id: 'smartDuplicate', command: 'Smart Duplicate (Relink Expressions)', category: 'Edit', combo: 'Mod+Alt+D' },
  { id: 'splitLayer', command: 'Split Layer at Playhead', category: 'Edit', combo: 'Mod+Shift+D' },
  { id: 'precompose', command: 'Pre-compose Selected Layers', category: 'Layer', combo: 'Mod+Shift+C' },
  { id: 'moveLayerUp', command: 'Bring Layer Forward in Stack', category: 'Layer', combo: 'Mod+]' },
  { id: 'moveLayerDown', command: 'Send Layer Backward in Stack', category: 'Layer', combo: 'Mod+[' },
  { id: 'nudgeLayerIn', command: 'Move Layer In-Point to Playhead', category: 'Layer', combo: '[' },
  { id: 'nudgeLayerOut', command: 'Move Layer Out-Point to Playhead', category: 'Layer', combo: ']' },
  { id: 'trimLayerIn', command: 'Trim Layer In-Point at Playhead', category: 'Layer', combo: 'Alt+[' },
  { id: 'trimLayerOut', command: 'Trim Layer Out-Point at Playhead', category: 'Layer', combo: 'Alt+]' },
  { id: 'newSolid', command: 'New Solid Layer', category: 'Layer', combo: 'Mod+Y' },
  { id: 'newAdjustment', command: 'New Adjustment Layer', category: 'Layer', combo: 'Mod+Alt+Y' },
  { id: 'playPause', command: 'Toggle RAM Preview Play/Pause', category: 'Playback', combo: 'Space' },
  { id: 'muteAudio', command: 'Toggle Transport Audio Mute', category: 'Playback', combo: 'Alt+M' },
  { id: 'shuttleRev', command: 'Shuttle Reverse', category: 'Playback', combo: 'J' },
  { id: 'shuttleStop', command: 'Shuttle Pause', category: 'Playback', combo: 'K' },
  { id: 'shuttleFwd', command: 'Shuttle Forward', category: 'Playback', combo: 'L' },
  { id: 'stepPrev', command: 'Step 1 Frame Backward', category: 'Playback', combo: 'ArrowLeft' },
  { id: 'stepNext', command: 'Step 1 Frame Forward', category: 'Playback', combo: 'ArrowRight' },
  { id: 'goStart', command: 'Go to Composition Start', category: 'Playback', combo: 'Home' },
  { id: 'goEnd', command: 'Go to Composition End', category: 'Playback', combo: 'End' },
  { id: 'setWorkIn', command: 'Set Work Area Start', category: 'Playback', combo: 'B' },
  { id: 'setWorkOut', command: 'Set Work Area End', category: 'Playback', combo: 'N' },
  { id: 'easyEase', command: 'Keyframe Easy Ease', category: 'Animation', combo: 'F9' },
  { id: 'revealKeyframes', command: 'Open Value / Speed Graph Editor', category: 'Animation', combo: 'U' },
  { id: 'revealPos', command: 'Toggle Keyframe on Position', category: 'Animation', combo: 'P' },
  { id: 'revealScale', command: 'Toggle Keyframe on Scale', category: 'Animation', combo: 'S' },
  { id: 'revealRot', command: 'Toggle Keyframe on Rotation', category: 'Animation', combo: 'R' },
  { id: 'revealOpacity', command: 'Toggle Keyframe on Opacity', category: 'Animation', combo: 'Alt+T' },
  { id: 'toggleNodeView', command: 'Switch Layer Stack <-> Node Graph', category: 'View', combo: 'Shift+N' },
  { id: 'takeSnapshot', command: 'Take Viewer Snapshot', category: 'View', combo: 'F5' },
  { id: 'toggleWipe', command: 'Toggle Snapshot A/B Split Wipe', category: 'View', combo: 'Shift+F5' },
  { id: 'whatsThis', command: "Toggle What's This? Help Mode", category: 'View', combo: 'Shift+F1' },
  { id: 'fitViewport', command: 'Zoom Viewport to Fit Stage', category: 'View', combo: 'Alt+0' },
  { id: 'maximizePanel', command: 'Toggle Minimal Focus Workspace', category: 'View', combo: '`' },
  { id: 'toolSelect', command: 'Selection Tool', category: 'Tools', combo: 'V' },
  { id: 'toolHand', command: 'Hand Pan Tool', category: 'Tools', combo: 'H' },
  { id: 'toolZoom', command: 'Zoom Tool', category: 'Tools', combo: 'Z' },
  { id: 'toolRotate', command: 'Rotation Tool', category: 'Tools', combo: 'W' },
  { id: 'toolCamera', command: '3D Camera Orbit Tool', category: 'Tools', combo: 'C' },
  { id: 'toolAnchor', command: 'Pan Behind (Anchor Point) Tool', category: 'Tools', combo: 'Y' },
  { id: 'toolShape', command: 'Shape Tool', category: 'Tools', combo: 'Q' },
  { id: 'toolPen', command: 'Pen / Mask Bezier Tool', category: 'Tools', combo: 'G' },
  { id: 'toolText', command: 'Type / Text Tool', category: 'Tools', combo: 'T' },
  { id: 'toolBrush', command: 'Paint Brush Tool', category: 'Tools', combo: 'Mod+B' },
  { id: 'toolClone', command: 'Clone Stamp Tool', category: 'Tools', combo: 'Alt+B' },
  { id: 'toolEraser', command: 'Paint Eraser Tool', category: 'Tools', combo: 'Alt+E' },
  { id: 'toolRoto', command: 'Local AI Roto Brush Tool', category: 'Tools', combo: 'Alt+W' },
  { id: 'toolPuppet', command: 'Puppet Deform Pin Tool', category: 'Tools', combo: 'Mod+P' },
];

export function formatComboForPlatform(combo: string, isMac = false): string {
  return isMac
    ? combo.replace(/\bMod\+/g, '⌘').replace(/\bAlt\+/g, '⌥').replace(/\bShift\+/g, '⇧')
    : combo.replace(/\bMod\+/g, 'Ctrl+');
}

export function formatShortcut(binding: ShortcutBinding, isMac = false): string {
  return formatComboForPlatform(binding.combo, isMac);
}

export function matchShortcutEvent(
  ev: { key: string; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; altKey: boolean },
  bindings: ShortcutBinding[],
  isMac = false,
): ShortcutBinding | undefined {
  return bindings.find((b) => matchesKeyboardEvent(ev, b.combo, isMac));
}

export function matchesKeyboardEvent(
  ev: { key: string; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; altKey: boolean },
  combo: string,
  isMac = false,
): boolean {
  const parts = combo.split('+');
  const mainKey = parts[parts.length - 1];
  const needMod = parts.includes('Mod');
  const needShift = parts.includes('Shift');
  const needAlt = parts.includes('Alt');
  const modPressed = isMac ? ev.metaKey : ev.ctrlKey || ev.metaKey;
  if (needMod !== modPressed) return false;
  if (needShift !== ev.shiftKey) return false;
  if (needAlt !== ev.altKey) return false;
  const normalizedEventKey = ev.key === ' ' ? 'Space' : ev.key.length === 1 ? ev.key.toUpperCase() : ev.key;
  const normalizedTarget = mainKey.length === 1 ? mainKey.toUpperCase() : mainKey;
  return normalizedEventKey === normalizedTarget;
}

export function detectShortcutConflicts(bindings: ShortcutBinding[]): Array<[string, string, string]> {
  const byCombo = new Map<string, ShortcutBinding>();
  const conflicts: Array<[string, string, string]> = [];
  for (const b of bindings) {
    const norm = b.combo.toUpperCase();
    const prev = byCombo.get(norm);
    if (prev) conflicts.push([b.combo, prev.id, b.id]);
    else byCombo.set(norm, b);
  }
  return conflicts;
}
