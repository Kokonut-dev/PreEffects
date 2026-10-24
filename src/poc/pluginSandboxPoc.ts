// POC 6: Sandboxed Plugin Loader & Capability Isolation
export interface PocPluginEffect {
  id: string;
  name: string;
  apply: (v: number) => number;
}

export function loadSandboxedPluginPoc(pluginCode: string): {
  effects: PocPluginEffect[];
  logs: string[];
  error?: string;
} {
  const effects: PocPluginEffect[] = [];
  const logs: string[] = [];
  const api = Object.freeze({
    apiVersion: '1.0.0',
    registerEffect(def: PocPluginEffect) {
      if (!def?.id || typeof def.apply !== 'function') {
        throw new Error('Invalid effect registration');
      }
      effects.push(def);
    },
    log(msg: string) {
      logs.push(String(msg));
    },
  });

  try {
    const runner = new Function(
      'preeffects',
      `"use strict";
      const window = undefined, fetch = undefined, process = undefined, require = undefined, globalThis = undefined;
      ${pluginCode}`,
    );
    runner(api);
    return { effects, logs };
  } catch (e) {
    return { effects, logs, error: e instanceof Error ? e.message : String(e) };
  }
}
