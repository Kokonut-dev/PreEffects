import type { DesktopBridge } from '../main/preload';

declare global {
  interface Window {
    preEffectsDesktop?: DesktopBridge;
  }
}

export {};
