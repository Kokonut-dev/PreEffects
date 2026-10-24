import { AnimatableProperty, Composition, Layer, Project } from './types';
import { evaluateKeyframesAtTime } from './animation';
import { clamp, degToRad, fbm2D, mulberry32, radToDeg } from '../utils/math';
import { hslToRgb, rgbToHsl } from '../utils/color';
import { createId } from './factory';

export interface ExpressionSnippet {
  id: string;
  label: string;
  description: string;
  code: string;
}

export const EXPRESSION_SNIPPETS: ExpressionSnippet[] = [
  { id: 'wiggle', label: '+ Wiggle(3, 24)', description: 'Organic smooth random motion', code: 'wiggle(3, 24)' },
  { id: 'loopCycle', label: '+ LoopOut("cycle")', description: 'Repeat keyframe segment infinitely', code: 'loopOut("cycle")' },
  { id: 'loopPingPong', label: '+ LoopOut("pingpong")', description: 'Alternate forward & backward', code: 'loopOut("pingpong")' },
  { id: 'timeSpin', label: '+ Time * 90', description: 'Continuous 90 deg/sec rotation', code: 'value + time * 90' },
  {
    id: 'inertialBounce',
    label: '+ Inertial Bounce',
    description: 'Damped spring overshoot after keyframe',
    code: 'const amp = 0.06, freq = 3.0, decay = 5.0; value + Math.sin(time * freq * Math.PI * 2) * 18 * Math.exp(-decay * (time % 2));',
  },
  { id: 'posterize12', label: '+ Posterize 12fps', description: 'Stop-motion anime 12fps step', code: 'posterizeTime(12); wiggle(4, 20);' },
];

const compiledExpressionCache = new Map<string, Function>();

function guardLoops(source: string): string {
  return source
    .replace(/\bdo\s*\{/g, 'do { if (++__peLoop > 15000) throw new Error("Infinite loop stopped by sandbox"); ')
    .replace(/\bwhile\s*\(([^)]*)\)\s*\{/g, 'while ($1) { if (++__peLoop > 15000) throw new Error("Infinite loop stopped by sandbox"); ')
    .replace(/\bfor\s*\(([^)]*)\)\s*\{/g, 'for ($1) { if (++__peLoop > 15000) throw new Error("Infinite loop stopped by sandbox"); ')
    .replace(/(?<!\}\s*)\bwhile\s*\(([^)]*)\)\s*(?!\{)([^;\n]+);/g, 'while ($1) { if (++__peLoop > 15000) throw new Error("Infinite loop stopped by sandbox"); $2; }')
    .replace(/\bfor\s*\(([^)]*)\)\s*(?!\{)([^;\n]+);/g, 'for ($1) { if (++__peLoop > 15000) throw new Error("Infinite loop stopped by sandbox"); $2; }');
}

function findLastTopLevelDelimiter(src: string): number {
  let brace = 0;
  let paren = 0;
  let bracket = 0;
  let inQuote: string | null = null;
  let lastIdx = -1;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuote) {
      if (ch === '\\') { i++; continue; }
      if (ch === inQuote) inQuote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { inQuote = ch; continue; }
    if (ch === '{') brace++;
    else if (ch === '}') {
      brace = Math.max(0, brace - 1);
      if (brace === 0 && paren === 0 && bracket === 0) lastIdx = i;
    } else if (ch === '(') paren++;
    else if (ch === ')') paren = Math.max(0, paren - 1);
    else if (ch === '[') bracket++;
    else if (ch === ']') bracket = Math.max(0, bracket - 1);
    else if (ch === ';' && brace === 0 && paren === 0 && bracket === 0) {
      lastIdx = i;
    }
  }
  return lastIdx;
}

function injectImplicitFinalReturn(statementSource: string): string {
  // In After Effects JS expressions, the final top-level expression statement is implicitly returned
  const stripped = statementSource.replace(/;\s*$/, '').trim();
  const splitAt = findLastTopLevelDelimiter(stripped);
  if (splitAt === -1) {
    if (/^(return|const|let|var|if|for|while|do|switch|try|throw)\b/.test(stripped)) {
      return statementSource;
    }
    return `return (${stripped});`;
  }
  const head = stripped.slice(0, splitAt + 1);
  const tail = stripped.slice(splitAt + 1).trim();
  if (!tail || /^(return|const|let|var|if|for|while|do|switch|try|throw)\b/.test(tail) || tail.endsWith('}')) {
    return statementSource;
  }
  return `${head}\nreturn (${tail});`;
}

function compileExpression(code: string): Function {
  let fn = compiledExpressionCache.get(code);
  if (fn) return fn;
  const trimmed = guardLoops(code.trim());
  const hasStatements =
    trimmed.includes(';') ||
    /\b(return|const|let|var|if|for|while|do)\b/.test(trimmed);
  const body = hasStatements
    ? `let __peLoop = 0;\n${injectImplicitFinalReturn(trimmed)}`
    : `let __peLoop = 0;\nreturn (${trimmed});`;
  fn = new Function(
    'ctx',
    `"use strict";
    const {
      time, value, index, fps, inPoint, outPoint, width, height,
      thisComp, thisLayer, comp, footage, effect,
      wiggle, linear, ease, easeIn, easeOut, clamp,
      loopIn, loopOut, posterizeTime, seedRandom, random, gaussRandom, noise,
      timeToFrames, framesToTime, degreesToRadians, radiansToDegrees,
      add, sub, mul, div, length, normalize, dot, cross, lookAt,
      rgbToHsl, hslToRgb, valueAtTime, velocityAtTime, speedAtTime, Math
    } = ctx;
    const window = undefined, document = undefined, globalThis = undefined, fetch = undefined, XMLHttpRequest = undefined, process = undefined;
    ${body}`,
  );
  compiledExpressionCache.set(code, fn);
  return fn;
}

export interface ExpressionEvalResult<T> {
  value: T;
  error?: string;
}

export function evaluateProperty<T>(
  prop: AnimatableProperty<T>,
  time: number,
  layer: Layer,
  compObj: Composition,
  project?: Project,
  depth = 0,
): ExpressionEvalResult<T> {
  const baseValue = evaluateKeyframesAtTime(prop, time);
  if (!prop.expressionEnabled || !prop.expression?.trim() || depth > 5) {
    return { value: baseValue };
  }

  try {
    let evalTime = time;
    let rngSeed = (layer.id.charCodeAt(layer.id.length - 1) || 7) * 997;

    const posterizeTime = (targetFps: number) => {
      if (targetFps > 0) evalTime = Math.floor(time * targetFps) / targetFps;
    };

    const seedRandom = (seed: number) => {
      rngSeed = Math.floor(seed * 10000);
    };

    const random = (minOrMax = 1, maybeMax?: number) => {
      const r = mulberry32(rngSeed + Math.floor(evalTime * 1000))();
      rngSeed += 17;
      if (maybeMax === undefined) return r * minOrMax;
      return minOrMax + r * (maybeMax - minOrMax);
    };

    const gaussRandom = (min = 0, max = 1) => {
      const u1 = Math.max(1e-6, random(0, 1));
      const u2 = random(0, 1);
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      const mid = (min + max) / 2;
      const span = (max - min) / 6;
      return mid + z * span;
    };

    const wiggle = (freq = 2, amp = 10, octaves = 2, ampMult = 0.5, t?: number): T => {
      const wt = t ?? evalTime;
      const sample = (seedOffset: number) => {
        const v = fbm2D(wt * freq, seedOffset * 3.17, clamp(Math.round(octaves), 1, 6), 2, ampMult, 701 + seedOffset);
        return (v - 0.5) * 2 * amp;
      };
      const cur = evaluateKeyframesAtTime(prop, wt);
      if (typeof cur === 'number') return (cur + sample(1)) as unknown as T;
      if (Array.isArray(cur)) {
        return cur.map((item, idx) => (typeof item === 'number' ? item + sample(idx + 1) : item)) as unknown as T;
      }
      return cur;
    };

    const interpMap = (mode: 'linear' | 'ease' | 'in' | 'out', t: number, tMin: number, tMax: number, v1: unknown, v2: unknown) => {
      const u = clamp((t - tMin) / (tMax - tMin || 1), 0, 1);
      let s = u;
      if (mode === 'ease') s = u * u * (3 - 2 * u);
      else if (mode === 'in') s = u * u;
      else if (mode === 'out') s = 1 - (1 - u) * (1 - u);
      if (typeof v1 === 'number' && typeof v2 === 'number') return v1 + (v2 - v1) * s;
      if (Array.isArray(v1) && Array.isArray(v2)) return v1.map((a, i) => a + ((v2[i] ?? a) - a) * s);
      return v1;
    };

    const loopOut = (type: 'cycle' | 'pingpong' | 'offset' | 'continue' = 'cycle'): T => {
      const kfs = prop.keyframes;
      if (kfs.length < 2) return evaluateKeyframesAtTime(prop, evalTime);
      const t0 = kfs[0].time;
      const t1 = kfs[kfs.length - 1].time;
      const span = Math.max(1e-5, t1 - t0);
      if (evalTime <= t1) return evaluateKeyframesAtTime(prop, evalTime);
      const elapsed = evalTime - t0;
      const cycles = Math.floor(elapsed / span);
      const rem = elapsed - cycles * span;
      if (type === 'pingpong') {
        const mapped = cycles % 2 === 0 ? t0 + rem : t1 - rem;
        return evaluateKeyframesAtTime(prop, mapped);
      }
      if (type === 'offset') {
        const base = evaluateKeyframesAtTime(prop, t0 + rem);
        const vStart = kfs[0].value;
        const vEnd = kfs[kfs.length - 1].value;
        if (typeof base === 'number' && typeof vStart === 'number' && typeof vEnd === 'number') {
          return (base + (vEnd - vStart) * cycles) as unknown as T;
        }
      }
      return evaluateKeyframesAtTime(prop, t0 + rem);
    };

    const loopIn = (type: 'cycle' | 'pingpong' = 'cycle'): T => {
      const kfs = prop.keyframes;
      if (kfs.length < 2) return evaluateKeyframesAtTime(prop, evalTime);
      const t0 = kfs[0].time;
      const t1 = kfs[kfs.length - 1].time;
      const span = Math.max(1e-5, t1 - t0);
      if (evalTime >= t0) return evaluateKeyframesAtTime(prop, evalTime);
      const behind = t0 - evalTime;
      const cycles = Math.floor(behind / span);
      const rem = behind - cycles * span;
      const mapped = type === 'pingpong' && cycles % 2 === 0 ? t0 + rem : t1 - rem;
      return evaluateKeyframesAtTime(prop, mapped);
    };

    const resolveLayerAccessor = (targetComp: Composition, nameOrIndex: string | number) => {
      const found =
        typeof nameOrIndex === 'number'
          ? targetComp.layers[nameOrIndex - 1]
          : targetComp.layers.find((l) => l.name === nameOrIndex || l.id === nameOrIndex);
      if (!found) throw new Error(`Unknown layer "${nameOrIndex}"`);
      return {
        name: found.name,
        index: targetComp.layers.indexOf(found) + 1,
        transform: {
          get position() { return evaluateProperty(found.transform.position, evalTime, found, targetComp, project, depth + 1).value; },
          get scale() { return evaluateProperty(found.transform.scale, evalTime, found, targetComp, project, depth + 1).value; },
          get rotation() { return evaluateProperty(found.transform.rotationZ, evalTime, found, targetComp, project, depth + 1).value; },
          get opacity() { return evaluateProperty(found.transform.opacity, evalTime, found, targetComp, project, depth + 1).value; },
          get anchorPoint() { return evaluateProperty(found.transform.anchorPoint, evalTime, found, targetComp, project, depth + 1).value; },
        },
        effect: (fxName: string) => {
          const fx = found.effects.find((e) => e.name === fxName || e.effectId === fxName);
          return (paramName: string) => {
            const p = fx?.params[paramName] ?? Object.values(fx?.params ?? {})[0];
            return p ? evaluateProperty(p, evalTime, found, targetComp, project, depth + 1).value : 0;
          };
        },
      };
    };

    const vecAdd = (a: number[], b: number[]) => a.map((v, i) => v + (b[i] ?? 0));
    const vecSub = (a: number[], b: number[]) => a.map((v, i) => v - (b[i] ?? 0));
    const vecMul = (a: number[], s: number) => a.map((v) => v * s);
    const vecDiv = (a: number[], s: number) => a.map((v) => v / (s || 1));
    const vecLen = (a: number[], b?: number[]) => {
      const d = b ? vecSub(a, b) : a;
      return Math.hypot(...d);
    };
    const vecNorm = (a: number[]) => {
      const l = vecLen(a) || 1;
      return a.map((v) => v / l);
    };
    const vecDot = (a: number[], b: number[]) => a.reduce((acc, v, i) => acc + v * (b[i] ?? 0), 0);
    const vecCross = (a: number[], b: number[]) => [
      (a[1] ?? 0) * (b[2] ?? 0) - (a[2] ?? 0) * (b[1] ?? 0),
      (a[2] ?? 0) * (b[0] ?? 0) - (a[0] ?? 0) * (b[2] ?? 0),
      (a[0] ?? 0) * (b[1] ?? 0) - (a[1] ?? 0) * (b[0] ?? 0),
    ];
    const lookAt = (fromPt: number[], atPt: number[]) => {
      const dx = (atPt[0] ?? 0) - (fromPt[0] ?? 0);
      const dy = (atPt[1] ?? 0) - (fromPt[1] ?? 0);
      const dz = (atPt[2] ?? 0) - (fromPt[2] ?? 0);
      const yaw = radToDeg(Math.atan2(dx, dz || 1));
      const pitch = -radToDeg(Math.atan2(dy, Math.hypot(dx, dz) || 1));
      return [pitch, yaw, 0];
    };

    const valueAtTime = (t: number) => evaluateKeyframesAtTime(prop, t);
    const velocityAtTime = (t: number) => {
      const dt = 0.005;
      const v0 = evaluateKeyframesAtTime(prop, t - dt);
      const v1 = evaluateKeyframesAtTime(prop, t + dt);
      if (typeof v0 === 'number' && typeof v1 === 'number') return (v1 - v0) / (2 * dt);
      if (Array.isArray(v0) && Array.isArray(v1)) return v0.map((x, i) => ((v1[i] ?? x) - x) / (2 * dt));
      return 0;
    };
    const speedAtTime = (t: number) => {
      const vel = velocityAtTime(t);
      return Array.isArray(vel) ? Math.hypot(...vel) : Math.abs(Number(vel) || 0);
    };

    const fn = compileExpression(prop.expression);
    const currentVal = evaluateKeyframesAtTime(prop, evalTime);
    const layerIdx = compObj.layers.indexOf(layer) + 1;

    const rawResult = fn({
      time: evalTime,
      value: currentVal,
      index: layerIdx,
      fps: compObj.fps,
      inPoint: layer.inPoint,
      outPoint: layer.outPoint,
      width: compObj.width,
      height: compObj.height,
      thisComp: {
        width: compObj.width,
        height: compObj.height,
        duration: compObj.duration,
        frameDuration: 1 / compObj.fps,
        layer: (q: string | number) => resolveLayerAccessor(compObj, q),
      },
      thisLayer: resolveLayerAccessor(compObj, layer.id),
      comp: (compName: string) => {
        const target = project?.compositions.find((c) => c.name === compName || c.id === compName) ?? compObj;
        return {
          width: target.width,
          height: target.height,
          duration: target.duration,
          layer: (q: string | number) => resolveLayerAccessor(target, q),
        };
      },
      footage: (assetName: string) => {
        const asset = project?.assets.find((a) => a.name === assetName || a.id === assetName);
        return {
          sourceData: asset?.structuredData ?? {},
          dataValue: (coords: [number, number] | string) => {
            const sd = asset?.structuredData;
            if (Array.isArray(sd) && Array.isArray(coords)) {
              const row = sd[coords[1]] ?? {};
              const keys = Object.keys(row);
              return row[keys[coords[0]]] ?? 0;
            }
            if (sd && !Array.isArray(sd) && typeof coords === 'string') return sd[coords] ?? 0;
            return 0;
          },
        };
      },
      effect: (fxName: string) => resolveLayerAccessor(compObj, layer.id).effect(fxName),
      wiggle,
      linear: (t: number, tMin: number, tMax: number, v1: unknown, v2: unknown) => interpMap('linear', t, tMin, tMax, v1, v2),
      ease: (t: number, tMin: number, tMax: number, v1: unknown, v2: unknown) => interpMap('ease', t, tMin, tMax, v1, v2),
      easeIn: (t: number, tMin: number, tMax: number, v1: unknown, v2: unknown) => interpMap('in', t, tMin, tMax, v1, v2),
      easeOut: (t: number, tMin: number, tMax: number, v1: unknown, v2: unknown) => interpMap('out', t, tMin, tMax, v1, v2),
      clamp,
      loopIn,
      loopOut,
      posterizeTime,
      seedRandom,
      random,
      gaussRandom,
      noise: (x: number, y = 0) => (fbm2D(x, y, 3) - 0.5) * 2,
      timeToFrames: (t = evalTime, fps = compObj.fps) => Math.round(t * fps),
      framesToTime: (f: number, fps = compObj.fps) => f / fps,
      degreesToRadians: degToRad,
      radiansToDegrees: radToDeg,
      add: vecAdd,
      sub: vecSub,
      mul: vecMul,
      div: vecDiv,
      length: vecLen,
      normalize: vecNorm,
      dot: vecDot,
      cross: vecCross,
      lookAt,
      rgbToHsl,
      hslToRgb,
      valueAtTime,
      velocityAtTime,
      speedAtTime,
      Math,
    });

    if (rawResult === undefined || rawResult === null) return { value: baseValue };
    return { value: rawResult as T };
  } catch (err) {
    return {
      value: baseValue,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export function buildPickWhipExpression(
  targetLayerName: string,
  targetPropPath: 'position' | 'scale' | 'rotation' | 'opacity' | 'anchorPoint' | { effectName: string; paramName: string },
): string {
  if (typeof targetPropPath === 'string') {
    return `thisComp.layer("${targetLayerName}").transform.${targetPropPath}`;
  }
  return `thisComp.layer("${targetLayerName}").effect("${targetPropPath.effectName}")("${targetPropPath.paramName}")`;
}

// EXCEED-18: Smart Duplicate with automatic internal/sibling expression relinking
export function smartDuplicateLayers(selectedLayers: Layer[]): Layer[] {
  const renameMap = new Map<string, string>();
  const idMap = new Map<string, string>();

  const clones = selectedLayers.map((orig) => {
    const cloned = structuredClone(orig);
    const nextId = createId('lyr');
    const nextName = `${orig.name}_Copy`;
    idMap.set(orig.id, nextId);
    renameMap.set(orig.name, nextName);
    cloned.id = nextId;
    cloned.name = nextName;
    return cloned;
  });

  const relinkExpr = (expr?: string): string | undefined => {
    if (!expr) return expr;
    let out = expr;
    for (const [oldName, newName] of renameMap) {
      out = out.split(`"${oldName}"`).join(`"${newName}"`).split(`'${oldName}'`).join(`'${newName}'`);
    }
    return out;
  };

  for (const c of clones) {
    if (c.parentId && idMap.has(c.parentId)) {
      c.parentId = idMap.get(c.parentId);
    }
    for (const prop of Object.values(c.transform)) {
      if (prop && typeof prop === 'object' && 'expression' in prop) {
        prop.expression = relinkExpr(prop.expression);
      }
    }
    for (const fx of c.effects) {
      for (const param of Object.values(fx.params)) {
        param.expression = relinkExpr(param.expression);
      }
    }
  }
  return clones;
}
