import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  parseCssColor,
  srgbChannelToLinear,
  relativeLuminance,
  wcagContrastRatio,
  apcaContrastLc,
  pickAccessibleOnAccent,
  fittsIndexOfDifficulty,
  hickDecisionBits,
  STUDIO_THEME_PALETTES,
  auditThemeContrast,
} from '../../src/utils/contrastMath';
import { DEFAULT_SHORTCUTS, detectShortcutConflicts, matchShortcutEvent } from '../../src/utils/shortcuts';
import { STUDIO_GUIDE_CHAPTERS, INTERACTIVE_TUTORIAL_STEPS } from '../../src/renderer/data/studioGuideData';
import { createShowcaseProject } from '../../src/engine/templates';
import { buildDefaultLayerForComp } from '../../src/engine/factory';
import { renderCompositionFrame, studioRamCache } from '../../src/engine/compositor';
import { synthesizeContentAwareFill } from '../../src/engine/trackingAndPaint';

describe('Colorimetric Contrast Math & Minimalist Theme Verification (SC-UX-01 .. SC-UX-08)', () => {
  it('computes exact IEC 61966-2-1 relative luminance and 21:1 black/white contrast', () => {
    expect(srgbChannelToLinear(0)).toBe(0);
    expect(srgbChannelToLinear(255)).toBeCloseTo(1, 6);
    expect(relativeLuminance('#000000')).toBe(0);
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 5);
    expect(wcagContrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 2);
  });

  it('passes all 19 WCAG 2.1 AA/AAA + APCA-W3 checks across all 4 studio themes', () => {
    for (const [themeId, palette] of Object.entries(STUDIO_THEME_PALETTES)) {
      const report = auditThemeContrast(palette);
      expect(report.allPassed, `${themeId} failed checks: ${JSON.stringify(report.checks.filter((c) => !c.passed))}`).toBe(true);
      expect(report.minTextContrast).toBeGreaterThanOrEqual(4.9);
      expect(report.minUiContrast).toBeGreaterThanOrEqual(3.0);

      const primaryOnPanel = report.checks.find((c) => c.id === 'primary-on-panel')!;
      const secondaryOnPanel = report.checks.find((c) => c.id === 'secondary-on-panel')!;
      expect(primaryOnPanel.wcagRatio).toBeGreaterThanOrEqual(13.0);
      expect(secondaryOnPanel.wcagRatio).toBeGreaterThanOrEqual(8.0);
      expect(Math.abs(apcaContrastLc(palette.textPrimary, palette.bgPanel))).toBeGreaterThanOrEqual(90);
    }
  });

  it('maintains neutral D65 color-grading surround (low RGB channel spread) in Dark & Graphite themes', () => {
    for (const key of ['dark', 'graphite'] as const) {
      const p = STUDIO_THEME_PALETTES[key];
      for (const hex of [p.bgCanvas, p.bgPanel, p.bgElevated]) {
        const c = parseCssColor(hex);
        const spread = Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b);
        expect(spread).toBeLessThanOrEqual(12);
      }
    }
  });

  it('keeps tokens.css theme hex definitions synchronized with STUDIO_THEME_PALETTES', () => {
    const css = fs.readFileSync(path.resolve(__dirname, '../../src/renderer/styles/tokens.css'), 'utf8').toLowerCase();
    for (const pal of Object.values(STUDIO_THEME_PALETTES)) {
      expect(css).toContain(pal.bgCanvas.toLowerCase());
      expect(css).toContain(pal.bgPanel.toLowerCase());
      expect(css).toContain(pal.textPrimary.toLowerCase());
      expect(css).toContain(pal.textMuted.toLowerCase());
      expect(css).toContain(pal.accentPrimary.toLowerCase());
    }
  });

  it('guarantees accessible on-accent button text across arbitrary custom sRGB colors (BUG-P2-06)', () => {
    const sampleHexes = [
      '#000000', '#ffffff', '#f5a524', '#0284c7', '#ef4444', '#10b981',
      '#fde047', '#3b82f6', '#8b5cf6', '#ec4899', '#64748b', '#7c2d12',
      '#bbf7d0', '#1e293b', '#ff6600', '#00ffcc',
    ];
    for (const hex of sampleHexes) {
      const fg = pickAccessibleOnAccent(hex);
      const ratio = wcagContrastRatio(fg, hex);
      expect(ratio).toBeGreaterThanOrEqual(4.4);
    }
  });
});

describe('UX Laws, Complete Shortcut Registry & Interactive Studio Guide (SC-UX-09 .. SC-UX-14)', () => {
  it('validates Hick-Hyman entropy reduction and Fitts index of difficulty improvements', () => {
    expect(hickDecisionBits(25)).toBeGreaterThan(4.6);
    expect(hickDecisionBits(7)).toBeLessThanOrEqual(3.0);
    expect(fittsIndexOfDifficulty(240, 28)).toBeLessThan(fittsIndexOfDifficulty(240, 16));
  });

  it('has zero keyboard shortcut conflicts across all 38 bindings and matches newly wired keys (BUG-P1-01)', () => {
    expect(DEFAULT_SHORTCUTS.length).toBeGreaterThanOrEqual(38);
    expect(detectShortcutConflicts(DEFAULT_SHORTCUTS)).toEqual([]);

    const f1Hit = matchShortcutEvent({ key: 'F1', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false }, DEFAULT_SHORTCUTS);
    expect(f1Hit?.id).toBe('openGuide');

    const eraserHit = matchShortcutEvent({ key: 'e', ctrlKey: false, metaKey: false, shiftKey: false, altKey: true }, DEFAULT_SHORTCUTS);
    expect(eraserHit?.id).toBe('toolEraser');

    const stepHit = matchShortcutEvent({ key: 'ArrowRight', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false }, DEFAULT_SHORTCUTS);
    expect(stepHit?.id).toBe('stepNext');
  });

  it('provides 8 complete Studio Guide chapters and 8 interactive spotlight walkthrough steps (BUG-P3-04)', () => {
    expect(STUDIO_GUIDE_CHAPTERS).toHaveLength(8);
    for (const ch of STUDIO_GUIDE_CHAPTERS) {
      expect(ch.title.length).toBeGreaterThan(5);
      expect(ch.sections.length).toBeGreaterThanOrEqual(2);
      expect(ch.tryActionId.length).toBeGreaterThan(3);
    }

    expect(INTERACTIVE_TUTORIAL_STEPS).toHaveLength(8);
    INTERACTIVE_TUTORIAL_STEPS.forEach((step, idx) => {
      expect(step.stepIndex).toBe(idx);
      expect(step.summary.length).toBeGreaterThan(20);
      expect(step.tryActionId.length).toBeGreaterThan(3);
    });
  });
});

describe('Compositor Cache Invalidation & Engine Bug Regressions (BUG-P0-01, BUG-P1-03)', () => {
  it('invalidates studioRamCache immediately when paint strokes, shape operators, or keyframes change on the same frame', () => {
    studioRamCache.purgeAll();
    const proj = createShowcaseProject('blank');
    const comp = proj.compositions[0];
    comp.width = 160;
    comp.height = 90;

    const solid = buildDefaultLayerForComp('solid', comp, 'lyr_solid_test');
    solid.solidColor = '#102030';
    comp.layers = [solid];

    const before = renderCompositionFrame(comp, 0, proj, { resolutionDivisor: 1, useCache: true });
    const centerIdx = (45 * 160 + 80) * 4;
    const beforeR = before.pixels[centerIdx];

    // Add bright red paint stroke right across the center on the SAME frame (t = 0)
    comp.layers[0].paintStrokes.push({
      id: 'stk_1',
      tool: 'brush',
      color: '#ff2200',
      radius: 16,
      hardness: 100,
      opacity: 100,
      startTime: 0,
      durationMode: 'constant',
      duration: 5,
      points: [[20, 45]],
    });

    const midStroke = renderCompositionFrame(comp, 0, proj, { resolutionDivisor: 1, useCache: true });
    expect(midStroke.fromCache).toBe(false);

    // Extending the same stroke in-place (live pointermove) must also invalidate cache immediately
    comp.layers[0].paintStrokes[0].points.push([70, 45], [90, 45]);

    const after = renderCompositionFrame(comp, 0, proj, { resolutionDivisor: 1, useCache: true });
    expect(after.fromCache).toBe(false);
    expect(after.pixels[centerIdx]).toBeGreaterThan(beforeR + 120);
  });

  it('synthesizes non-empty RGBA clean-plate pixels for Content-Aware Fill layer creation (BUG-P1-03)', () => {
    const w = 64;
    const h = 64;
    const src = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      src[i * 4] = 40;
      src[i * 4 + 1] = 120;
      src[i * 4 + 2] = 200;
      src[i * 4 + 3] = 255;
    }
    const clean = synthesizeContentAwareFill(src, w, h, { x: 20, y: 20, width: 16, height: 16 });
    expect(clean.length).toBe(w * h * 4);
    const mid = (28 * w + 28) * 4;
    expect(clean[mid + 3]).toBe(255);
    expect(clean[mid + 2]).toBeGreaterThan(150);
  });
});
