// Sandboxed Plugin SDK v1.0 + Multi-Language Scripting Engine (JavaScript + Python + Lua)

import { Project } from '../engine/types';
import { createDefaultTransform, createId } from '../engine/factory';
import { createEffectInstance } from '../effects/registry';

export interface RegisteredCustomPlugin {
  id: string;
  name: string;
  version: string;
  author: string;
  enabled: boolean;
  kind: 'effect' | 'panel' | 'format' | 'macro';
  description: string;
}

export class PluginRegistry {
  private plugins: RegisteredCustomPlugin[] = [
    {
      id: 'plg-halftone-pro',
      name: 'Newsprint CMYK Halftone',
      version: '1.0.0',
      author: 'PreEffects Core SDK',
      enabled: true,
      kind: 'effect',
      description: 'Sandboxed sample CMYK dot-screen halftone plugin',
    },
    {
      id: 'plg-beat-marker',
      name: 'BPM Beat Marker Generator',
      version: '1.0.0',
      author: 'PreEffects Core SDK',
      enabled: true,
      kind: 'macro',
      description: 'Generates composition markers on tempo grid',
    },
  ];

  list(): RegisteredCustomPlugin[] {
    return [...this.plugins];
  }

  toggle(id: string): void {
    this.plugins = this.plugins.map((p) => (p.id === id ? { ...p, enabled: !p.enabled } : p));
  }

  installSandboxedBundle(sourceCode: string): { ok: boolean; plugin?: RegisteredCustomPlugin; error?: string } {
    let created: RegisteredCustomPlugin | undefined;
    const sandboxApi = Object.freeze({
      apiVersion: '1.0.0',
      registerPlugin(manifest: Omit<RegisteredCustomPlugin, 'enabled'>) {
        if (!manifest?.id || !manifest?.name) throw new Error('Plugin manifest requires id and name');
        created = { ...manifest, enabled: true };
      },
    });
    try {
      const fn = new Function(
        'sdk',
        `"use strict";
        const window = undefined, document = undefined, fetch = undefined, XMLHttpRequest = undefined, process = undefined, require = undefined, globalThis = undefined;
        ${sourceCode}`,
      );
      fn(sandboxApi);
      if (!created) return { ok: false, error: 'Plugin did not call sdk.registerPlugin(...)' };
      this.plugins.push(created);
      return { ok: true, plugin: created };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }
}

export const studioPluginRegistry = new PluginRegistry();

export type ScriptLanguage = 'javascript' | 'python' | 'lua';

// Transpile Studio Python subset into safe JavaScript automation statements
export function transpilePythonSubsetToJs(pyCode: string): string {
  const lines = pyCode.split(/\r?\n/);
  const out: string[] = [];
  const indentStack = [0];

  for (const raw of lines) {
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const indent = raw.search(/\S/);
    while (indent < indentStack[indentStack.length - 1]) {
      indentStack.pop();
      out.push('}');
    }
    let stmt = trimmed
      .replace(/\bTrue\b/g, 'true')
      .replace(/\bFalse\b/g, 'false')
      .replace(/\bNone\b/g, 'null')
      .replace(/\bprint\s*\(/g, 'log(');

    const forRange = stmt.match(/^for\s+([a-zA-Z_]\w*)\s+in\s+range\(([^)]+)\)\s*:$/);
    if (forRange) {
      const v = forRange[1];
      const args = forRange[2].split(',').map((s) => s.trim());
      const [start, end] = args.length === 1 ? ['0', args[0]] : [args[0], args[1]];
      out.push(`for (let ${v} = ${start}; ${v} < ${end}; ${v}++) {`);
      indentStack.push(indent + 2);
      continue;
    }
    const defFn = stmt.match(/^def\s+([a-zA-Z_]\w*)\(([^)]*)\)\s*:$/);
    if (defFn) {
      out.push(`function ${defFn[1]}(${defFn[2]}) {`);
      indentStack.push(indent + 2);
      continue;
    }
    if (stmt.endsWith(':')) {
      const cond = stmt.replace(/^if\s+/, 'if (').replace(/:$/, ') {');
      out.push(cond);
      indentStack.push(indent + 2);
      continue;
    }
    if (/^[a-zA-Z_]\w*\s*=[^=]/.test(stmt)) {
      stmt = `var ${stmt}`;
    }
    out.push(`${stmt};`);
  }
  while (indentStack.length > 1) {
    indentStack.pop();
    out.push('}');
  }
  return out.join('\n');
}

// Transpile Studio Lua subset into safe JavaScript automation statements
export function transpileLuaSubsetToJs(luaCode: string): string {
  const lines = luaCode.split(/\r?\n/);
  const out: string[] = [];
  for (const raw of lines) {
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith('--')) continue;
    if (trimmed === 'end') {
      out.push('}');
      continue;
    }
    const forNum = trimmed.match(/^for\s+([a-zA-Z_]\w*)\s*=\s*([^,]+),\s*([^\s]+)\s+do$/);
    if (forNum) {
      out.push(`for (let ${forNum[1]} = ${forNum[2]}; ${forNum[1]} <= ${forNum[3]}; ${forNum[1]}++) {`);
      continue;
    }
    const fnMatch = trimmed.match(/^function\s+([a-zA-Z_]\w*)\(([^)]*)\)$/);
    if (fnMatch) {
      out.push(`function ${fnMatch[1]}(${fnMatch[2]}) {`);
      continue;
    }
    const ifMatch = trimmed.match(/^if\s+(.+)\s+then$/);
    if (ifMatch) {
      out.push(`if (${ifMatch[1].replace(/~=/g, '!==')}) {`);
      continue;
    }
    const stmt = trimmed
      .replace(/^local\s+/, 'let ')
      .replace(/\.\./g, ' + ')
      .replace(/\bprint\s*\(/g, 'log(');
    out.push(`${stmt};`);
  }
  return out.join('\n');
}

export function executeStudioScript(
  lang: ScriptLanguage,
  code: string,
  project: Project,
): { ok: boolean; logs: string[]; nextProject: Project; error?: string } {
  const logs: string[] = [];
  const draft = structuredClone(project);
  const activeComp = draft.compositions.find((c) => c.id === draft.activeCompId) ?? draft.compositions[0];

  const studioApp = {
    compName: activeComp?.name ?? '',
    layerCount: () => activeComp?.layers.length ?? 0,
    addSolid: (name = 'Script Solid', color = '#38BDF8') => {
      if (!activeComp) return;
      activeComp.layers.unshift({
        id: createId('lyr'),
        name,
        type: 'solid',
        labelColor: color,
        visible: true,
        audioEnabled: false,
        solo: false,
        locked: false,
        shy: false,
        collapseTransformations: false,
        frameBlending: 'off',
        motionBlur: false,
        threeD: false,
        inPoint: 0,
        outPoint: activeComp.duration,
        startTime: 0,
        stretchPct: 100,
        blendMode: 'normal',
        trackMatteMode: 'none',
        transform: createDefaultTransform(activeComp.width / 2, activeComp.height / 2, activeComp.width / 2, activeComp.height / 2),
        masks: [],
        effects: [],
        paintStrokes: [],
        puppetPins: [],
        markers: [],
        solidColor: color,
      });
    },
    addEffectToTopLayer: (effectId: string) => {
      if (!activeComp || activeComp.layers.length === 0) return;
      activeComp.layers[0].effects.push(createEffectInstance(effectId));
    },
    addMarker: (timeSec: number, comment: string) => {
      if (!activeComp) return;
      activeComp.markers.push({ id: createId('mrk'), time: timeSec, duration: 0, comment, color: '#E89B3C' });
    },
  };

  try {
    const rawBody =
      lang === 'python'
        ? transpilePythonSubsetToJs(code)
        : lang === 'lua'
          ? transpileLuaSubsetToJs(code)
          : code;

    const guardedBody = rawBody
      .replace(/\bwhile\s*\(([^)]*)\)\s*\{/g, 'while ($1) { if (++__scriptOps > 25000) throw new Error("Script loop limit exceeded"); ')
      .replace(/\bfor\s*\(([^)]*)\)\s*\{/g, 'for ($1) { if (++__scriptOps > 25000) throw new Error("Script loop limit exceeded"); ');

    const fn = new Function(
      'app',
      'log',
      `"use strict";
      let __scriptOps = 0;
      const window = undefined, document = undefined, fetch = undefined, process = undefined, globalThis = undefined;
      ${guardedBody}`,
    );
    fn(studioApp, (...args: unknown[]) => logs.push(args.map(String).join(' ')));
    return { ok: true, logs, nextProject: draft };
  } catch (e) {
    return {
      ok: false,
      logs,
      nextProject: project,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export const SAMPLE_AUTOMATION_SCRIPTS: Record<ScriptLanguage, string> = {
  javascript: `// Add 4 beat markers & apply Optical Glow to top layer
for (let i = 1; i <= 4; i++) {
  app.addMarker(i * 1.5, "Beat_" + i);
}
app.addEffectToTopLayer("glow");
log("Added 4 markers and Optical Glow to", app.compName);`,
  python: `# Python Studio Automation — Generate Beat Markers
for i in range(1, 5):
  app.addMarker(i * 1.25, "PyBeat")
print("Python automation complete on", app.compName)`,
  lua: `-- Lua Studio Automation — Add Solid & Log Layer Count
for i = 1, 2 do
  app.addMarker(i * 2.0, "LuaCue_" .. i)
end
print("Lua finished! Layers: " .. app.layerCount())`,
};
