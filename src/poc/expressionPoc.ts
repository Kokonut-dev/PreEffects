// POC 2: Sandboxed Expression Compiler & Evaluator with Loop Guard
export interface PocExpressionEnv {
  time: number;
  value: number | number[];
  fps: number;
  index: number;
  layers?: Record<string, Record<string, number | number[]>>;
}

const compiledCache = new Map<string, Function>();

function injectLoopGuard(code: string): string {
  return code
    .replace(/\bwhile\s*\(/g, 'while ((++__guard < 10000) && (')
    .replace(/\bfor\s*\(([^;]*);([^;]*);([^)]*)\)/g, 'for ($1; (++__guard < 10000) && ($2); $3)');
}

function fixWhileParens(src: string): string {
  if (!/\bwhile\s*\(/.test(src)) return injectLoopGuard(src);
  // Safe guard check via pre-step counter statement inside loop blocks
  return src
    .replace(/\bwhile\s*\(([^)]*)\)\s*\{/g, 'while ($1) { if (++__guard > 10000) throw new Error("Expression loop limit exceeded"); ')
    .replace(/\bfor\s*\(([^)]*)\)\s*\{/g, 'for ($1) { if (++__guard > 10000) throw new Error("Expression loop limit exceeded"); ');
}

export function evaluatePocExpression(expr: string, env: PocExpressionEnv): { ok: boolean; value: number | number[]; error?: string } {
  try {
    let fn = compiledCache.get(expr);
    if (!fn) {
      const guarded = fixWhileParens(expr.trim());
      const isMultiStmt = guarded.includes(';') || guarded.includes('return ') || guarded.includes('const ') || guarded.includes('let ');
      const body = isMultiStmt
        ? `let __guard = 0;\n${guarded}`
        : `let __guard = 0;\nreturn (${guarded});`;
      fn = new Function(
        'scope',
        `"use strict";
        const { time, value, fps, index, wiggle, linear, ease, clamp, thisComp, Math } = scope;
        const window = undefined, document = undefined, globalThis = undefined, fetch = undefined, process = undefined;
        ${body}`,
      );
      compiledCache.set(expr, fn);
    }

    const wiggle = (freq: number, amp: number): number | number[] => {
      const n = Math.sin(env.time * freq * Math.PI * 2 + env.index * 1.7) * 0.65 +
                Math.cos(env.time * freq * 3.1 + 0.9) * 0.35;
      if (Array.isArray(env.value)) {
        return env.value.map((v, idx) => v + Math.sin(env.time * freq * 6.283 + idx * 2.1) * amp);
      }
      return env.value + n * amp;
    };

    const linear = (t: number, tMin: number, tMax: number, v1: number, v2: number): number => {
      const u = Math.max(0, Math.min(1, (t - tMin) / (tMax - tMin || 1)));
      return v1 + (v2 - v1) * u;
    };

    const ease = (t: number, tMin: number, tMax: number, v1: number, v2: number): number => {
      const u = Math.max(0, Math.min(1, (t - tMin) / (tMax - tMin || 1)));
      const s = u * u * (3 - 2 * u);
      return v1 + (v2 - v1) * s;
    };

    const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
    const thisComp = {
      layer: (name: string) => env.layers?.[name] ?? {},
    };

    const out = fn({ time: env.time, value: env.value, fps: env.fps, index: env.index, wiggle, linear, ease, clamp, thisComp, Math });
    return { ok: true, value: out ?? env.value };
  } catch (err) {
    return { ok: false, value: env.value, error: err instanceof Error ? err.message : String(err) };
  }
}
