import type {
  DesktopBridge,
  DesktopAppInfo,
  DesktopOpenFileResult,
  UpdateCheckResult,
  UpdateProgressEvent,
  RecentVaultMenuItem,
} from '../main/preload';

export type {
  DesktopBridge,
  DesktopAppInfo,
  DesktopOpenFileResult,
  UpdateCheckResult,
  UpdateProgressEvent,
  RecentVaultMenuItem,
};

declare global {
  interface Window {
    preEffectsDesktop?: DesktopBridge;
  }
}

export {};
