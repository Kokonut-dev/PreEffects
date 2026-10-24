import fs from 'node:fs';
import path from 'node:path';
import { Resvg } from '@resvg/resvg-js';

const OUT_DIR = path.resolve('docs/mockups/v2');
fs.mkdirSync(OUT_DIR, { recursive: true });

const FONT_FILES = [
  '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
  '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
  '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf',
  '/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf',
].filter((f) => fs.existsSync(f));

const SANS = 'DejaVu Sans, sans-serif';
const MONO = 'DejaVu Sans Mono, monospace';

function renderV2(name, svg, width = 1600) {
  fs.writeFileSync(path.join(OUT_DIR, `${name}.svg`), svg, 'utf8');
  const resvg = new Resvg(svg, {
    font: { fontFiles: FONT_FILES, loadSystemFonts: true, defaultFontFamily: 'DejaVu Sans' },
    fitTo: { mode: 'width', value: width },
  });
  const png = resvg.render().asPng();
  const out = path.join(OUT_DIR, `${name}.png`);
  fs.writeFileSync(out, png);
  console.log(`Generated ${out} (${Math.round(png.length / 1024)} KB)`);
}

// v2_01: Revised Flagship Workspace with Breadcrumbs, A/B Wipe, Snippet Chips & 3-Tier Profiler Meters
const v2_1 = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="960" viewBox="0 0 1600 960">
  <rect width="1600" height="960" fill="#0B0D11"/>
  <!-- Top Menu with What's This [?] and Theme Toggle -->
  <rect width="1600" height="28" fill="#13161C"/>
  <rect x="10" y="5" width="18" height="18" rx="4" fill="#E89B3C"/>
  <text x="15" y="18" font-family="${SANS}" font-size="11" font-weight="bold" fill="#0B0D11">P</text>
  <text x="36" y="18" font-family="${SANS}" font-size="12" font-weight="bold" fill="#ECF0F7">PreEffects v2</text>
  ${[['File',136],['Edit',178],['Composition',222],['Layer',316],['Effect',370],['Animation',426],['View',506],['Window',554],['Help',620]].map(([m,x]) => `<text x="${x}" y="18" font-family="${SANS}" font-size="11.5" fill="#C9D1E0">${m}</text>`).join('')}
  <rect x="1060" y="4" width="290" height="20" rx="3" fill="#222834" stroke="#38BDF8"/>
  <text x="1072" y="17" font-family="${SANS}" font-size="10.5" fill="#ECF0F7">/ Search All Commands, Effects &amp; Docs (Ctrl+K)</text>
  <rect x="1360" y="4" width="84" height="20" rx="3" fill="#222834" stroke="#353E50"/>
  <text x="1402" y="17" text-anchor="middle" font-family="${SANS}" font-size="10" fill="#E89B3C">? What's This</text>
  <text x="1460" y="18" font-family="${MONO}" font-size="10.5" fill="#22C55E">OFFLINE ● LOCAL</text>

  <!-- Revised Breadcrumb Bar + Tools -->
  <rect y="29" width="1600" height="36" fill="#1B2029"/>
  ${['V','H','Z','W','C','Y','Shape','Pen','Text','Paint','Roto AI'].map((t,i) => `
    <rect x="${10 + i * 48}" y="35" width="43" height="24" rx="3" fill="${i===0?'#E89B3C':'#222834'}" stroke="${i===0?'#F3AC54':'#353E50'}"/>
    <text x="${31.5 + i * 48}" y="51" text-anchor="middle" font-family="${SANS}" font-size="9.5" font-weight="${i===0?'bold':'normal'}" fill="${i===0?'#0B0D11':'#DCE2EE'}">${t}</text>
  `).join('')}
  <!-- UX-04 Inline Pre-Comp Breadcrumb Trail -->
  <rect x="556" y="35" width="430" height="24" rx="3" fill="#13161C" stroke="#353E50"/>
  <text x="568" y="51" font-family="${MONO}" font-size="10.5" fill="#9BA5B7">Breadcrumb:</text>
  <text x="646" y="51" font-family="${SANS}" font-size="10.5" fill="#38BDF8">SHOT_040_MASTER</text>
  <text x="760" y="51" font-family="${SANS}" font-size="10.5" fill="#667085">&gt;</text>
  <text x="774" y="51" font-family="${SANS}" font-size="10.5" font-weight="bold" fill="#E89B3C">Precomp_Orbital_HUD</text>
  <text x="908" y="51" font-family="${SANS}" font-size="10.5" fill="#667085">&gt; Ring_Rig</text>

  <!-- Center Stage with Interactive Split Wipe Handle (UX-08) -->
  <rect x="0" y="67" width="290" height="500" fill="#13161C"/>
  <rect x="0" y="67" width="290" height="26" fill="#1B2029"/>
  <text x="12" y="84" font-family="${SANS}" font-size="11" font-weight="bold" fill="#ECF0F7">Project &amp; Local Git Snapshots</text>
  ${[
    ['#E89B3C', 'Commit v4: Tuned 32-bpc Glow (+2 diffs)'],
    ['#38BDF8', 'Commit v3: Added AI Roto Foreground'],
    ['#22C55E', 'Commit v2: Solved 35mm Camera Track'],
    ['#A855F7', 'Commit v1: Initial Kinetic Title Rig'],
  ].map(([c, txt], i) => `
    <rect x="10" y="${104 + i * 38}" width="270" height="30" rx="3" fill="#1B2029" stroke="#2B3343"/>
    <circle cx="22" cy="${119 + i * 38}" r="4" fill="${c}"/>
    <text x="34" y="${123 + i * 38}" font-family="${SANS}" font-size="10.5" fill="#ECF0F7">${txt}</text>
  `).join('')}
  <text x="12" y="276" font-family="${SANS}" font-size="10.5" font-weight="bold" fill="#9BA5B7">OKABE-ITO ACCESSIBLE ASSET LABELS</text>
  ${[
    ['#E69F00', '[Comp] SHOT_040_MASTER'],
    ['#56B4E9', '[Pre]  Precomp_Orbital_HUD'],
    ['#009E73', '[Data] telemetry_metrics.csv'],
    ['#F0E442', '[3D]   orbital_dish.obj'],
    ['#CC79A7', '[LUT]  Kodak_2383_ACES.cube'],
  ].map(([c, t], i) => `
    <rect x="12" y="${290 + i * 28}" width="10" height="14" rx="2" fill="${c}"/>
    <text x="30" y="${301 + i * 28}" font-family="${MONO}" font-size="10.5" fill="#ECF0F7">${t}</text>
  `).join('')}

  <!-- Center Viewer -->
  <rect x="292" y="67" width="936" height="500" fill="#08090C"/>
  <rect x="336" y="96" width="848" height="430" fill="#10192B" stroke="#2D3648"/>
  <circle cx="760" cy="311" r="115" fill="none" stroke="#38BDF8" stroke-width="2" stroke-dasharray="16 6"/>
  <circle cx="760" cy="311" r="82" fill="none" stroke="#E89B3C" stroke-width="2.5"/>
  <text x="760" y="308" text-anchor="middle" font-family="${SANS}" font-size="32" font-weight="bold" letter-spacing="5" fill="#FFFFFF">PREEFFECTS</text>
  <text x="760" y="336" text-anchor="middle" font-family="${MONO}" font-size="11.5" fill="#38BDF8">REVISED STUDIO UI v2 // A-B SNAPSHOT WIPE</text>
  <!-- Draggable Wipe Divider -->
  <line x1="690" y1="96" x2="690" y2="526" stroke="#E89B3C" stroke-width="2"/>
  <circle cx="690" cy="311" r="13" fill="#E89B3C"/>
  <text x="690" y="315" text-anchor="middle" font-family="${MONO}" font-size="10" font-weight="bold" fill="#0B0D11">&lt;|&gt;</text>

  <!-- Right Dock: 3-Tier Micro-Meter Effect Controls + Scopes -->
  <rect x="1230" y="67" width="370" height="500" fill="#13161C"/>
  <rect x="1230" y="67" width="370" height="26" fill="#1B2029"/>
  <text x="1242" y="84" font-family="${SANS}" font-size="11" font-weight="bold" fill="#ECF0F7">Effect Controls (Inline GPU Cost Meter)</text>
  ${[
    ['Optical Glow 32-bpc', '1.2 ms', '#22C55E', 54],
    ['Camera Lens Bokeh DoF', '4.1 ms', '#F59E0B', 118],
    ['AI Temporal Denoise', '6.8 ms', '#EF4444', 165],
  ].map(([name, ms, col, w], i) => `
    <rect x="1240" y="${104 + i * 78}" width="350" height="68" rx="4" fill="#1B2029" stroke="#2D3648"/>
    <text x="1252" y="${126 + i * 78}" font-family="${SANS}" font-size="11.5" font-weight="bold" fill="#ECF0F7">${name}</text>
    <rect x="1420" y="${116 + i * 78}" width="${w * 0.6}" height="8" rx="2" fill="${col}"/>
    <text x="1534" y="${125 + i * 78}" font-family="${MONO}" font-size="10" fill="${col}">${ms}</text>
    <text x="1252" y="${152 + i * 78}" font-family="${MONO}" font-size="10" fill="#9BA5B7">[Solo Cost]   Mix: 100.0%   Quality: High</text>
  `).join('')}

  <!-- Bottom Timeline + Expression Snippet Chips (UX-05 & UX-09) -->
  <rect y="569" width="1600" height="367" fill="#13161C"/>
  <rect y="569" width="1600" height="30" fill="#1B2029"/>
  <text x="14" y="588" font-family="${MONO}" font-size="13" font-weight="bold" fill="#E89B3C">00:00:03:42</text>
  <text x="140" y="588" font-family="${SANS}" font-size="11" font-weight="bold" fill="#38BDF8">Expression Editor + 1-Click Snippet Chips:</text>
  ${['+ Wiggle(3,20)', '+ LoopOut("cycle")', '+ Inertial Bounce', '+ Audio React', '+ Smart Relink'].map((chip, idx) => `
    <rect x="${425 + idx * 144}" y="574" width="136" height="20" rx="10" fill="#222834" stroke="#38BDF8"/>
    <text x="${493 + idx * 144}" y="588" text-anchor="middle" font-family="${MONO}" font-size="9.5" fill="#ECF0F7">${chip}</text>
  `).join('')}
  <rect x="14" y="610" width="1572" height="72" rx="4" fill="#0D1016" stroke="#2D3648"/>
  <text x="28" y="634" font-family="${MONO}" font-size="11.5" fill="#38BDF8">const amp = effect("Master Rig")("Slider");</text>
  <text x="28" y="654" font-family="${MONO}" font-size="11.5" fill="#ECF0F7">value + wiggle(2.5, amp) + [Math.sin(time * 4) * 18, 0];</text>
  <rect x="28" y="662" width="540" height="16" rx="2" fill="#193324"/>
  <text x="36" y="674" font-family="${MONO}" font-size="9.5" fill="#22C55E">✓ Compiled in 0.007ms • Result @ f222: [974.2, 536.8] • Loop Guard Active</text>

  <!-- Multi-track preview -->
  ${[0, 1, 2, 3].map((r) => `
    <rect x="14" y="${696 + r * 54}" width="460" height="46" rx="3" fill="#181D26"/>
    <text x="28" y="${724 + r * 54}" font-family="${SANS}" font-size="11" fill="#ECF0F7">${r + 1}  ${['[Txt] HERO_TITLE (Smart Rigged)', '[Shp] Orbital_HUD_Repeater', '[Matte] AI_Roto_Subject', '[Aud] sub_pulse_124bpm.wav'][r]}</text>
    <rect x="484" y="${696 + r * 54}" width="1102" height="46" rx="3" fill="#10141B"/>
    <rect x="${520 + r * 35}" y="${706 + r * 54}" width="${960 - r * 40}" height="26" rx="3" fill="#253952" stroke="#38BDF8"/>
  `).join('')}
</svg>`;

// v2_02: Nuke/Fusion-Grade Typed Multi-Port Node Graph with Live Thumbnails & Minimap
const v2_2 = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="960" viewBox="0 0 1600 960">
  <rect width="1600" height="960" fill="#0D1016"/>
  <rect width="1600" height="36" fill="#1B2029"/>
  <text x="20" y="23" font-family="${SANS}" font-size="12.5" font-weight="bold" fill="#ECF0F7">PreEffects v2 — Nuke/Fusion-Grade Typed Multi-Port Node Graph (B=Bg, A=Fg, M=Matte + Live Node Thumbnails)</text>
  <!-- Minimap Top Right -->
  <rect x="1370" y="52" width="214" height="126" rx="4" fill="#141821" stroke="#38BDF8"/>
  <text x="1380" y="68" font-family="${MONO}" font-size="9.5" fill="#9BA5B7">DAG MINIMAP (7 NODES)</text>
  <rect x="1390" y="82" width="32" height="14" fill="#38BDF8"/><rect x="1450" y="76" width="32" height="14" fill="#E89B3C"/><rect x="1515" y="96" width="36" height="16" fill="#22C55E"/>

  <!-- Typed Noodles -->
  <path d="M 310 260 C 410 260, 410 210, 500 210" fill="none" stroke="#38BDF8" stroke-width="2.5"/>
  <path d="M 310 260 C 410 260, 410 380, 500 380" fill="none" stroke="#E89B3C" stroke-width="2.5"/>
  <path d="M 310 560 C 560 560, 620 340, 840 340" fill="none" stroke="#A855F7" stroke-width="2.5" stroke-dasharray="6 4"/>
  <path d="M 710 210 C 775 210, 775 295, 840 295" fill="none" stroke="#38BDF8" stroke-width="2.5"/>
  <path d="M 710 380 C 775 380, 775 318, 840 318" fill="none" stroke="#E89B3C" stroke-width="2.5"/>
  <path d="M 1060 315 L 1190 315" fill="none" stroke="#22C55E" stroke-width="3"/>

  ${[
    [100, 210, '#38BDF8', 'Read: FG_Actor_4K', 'RGBA 16f • Keylight'],
    [100, 510, '#A855F7', 'AI Roto + Feather', 'Alpha Matte M-Port'],
    [500, 160, '#38BDF8', 'Despill + Curves', '0.8 ms • Linear'],
    [500, 330, '#E89B3C', 'Optical Bloom Branch', '1.4 ms • Threshold 68%'],
    [840, 265, '#38BDF8', 'Merge2 (B + A + Matte)', 'Screen + Matte Mask'],
    [1190, 265, '#22C55E', 'Write / Viewer Out', 'ACEScg -> Rec.709'],
  ].map(([x, y, c, title, meta]) => `
    <rect x="${x}" y="${y}" width="210" height="98" rx="6" fill="#181D27" stroke="${c}" stroke-width="1.8"/>
    <rect x="${x}" y="${y}" width="210" height="22" rx="5" fill="${c}" fill-opacity="0.25"/>
    <text x="${x + 10}" y="${y + 15}" font-family="${SANS}" font-size="11" font-weight="bold" fill="#FFFFFF">${title}</text>
    <!-- Embedded 56x34 Thumbnail -->
    <rect x="${x + 10}" y="${y + 30}" width="64" height="40" rx="3" fill="#0B1322" stroke="#334155"/>
    <circle cx="${x + 42}" cy="${y + 50}" r="11" fill="none" stroke="${c}" stroke-width="1.5"/>
    <text x="${x + 84}" y="${y + 48}" font-family="${MONO}" font-size="9.5" fill="#DCE2EE">${meta}</text>
    <text x="${x + 84}" y="${y + 66}" font-family="${MONO}" font-size="9" fill="#9BA5B7">Ports: B | A | M</text>
    <circle cx="${x}" cy="${y + 48}" r="5.5" fill="#38BDF8"/>
    <circle cx="${x + 210}" cy="${y + 48}" r="5.5" fill="${c}"/>
  `).join('')}
</svg>`;

// v2_03: Unified Dual Value + Speed Graph Editor
const v2_3 = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="960" viewBox="0 0 1600 960">
  <rect width="1600" height="960" fill="#0E1117"/>
  <rect width="1600" height="42" fill="#1B2029"/>
  <text x="20" y="26" font-family="${SANS}" font-size="13" font-weight="bold" fill="#ECF0F7">Unified Value + Speed Graph Editor (v2) — Simultaneous X/Y/Z Splines + Tangential Velocity Overlay</text>
  ${['Easy Ease (F9)', 'Ease In', 'Ease Out', 'Hold Step', 'Rove Across Time', 'Overshoot Bounce', 'Auto-Fit (F)'].map((b, i) => `
    <rect x="${20 + i * 162}" y="58" width="150" height="28" rx="4" fill="#222834" stroke="#38BDF8"/>
    <text x="${95 + i * 162}" y="76" text-anchor="middle" font-family="${SANS}" font-size="11" fill="#ECF0F7">${b}</text>
  `).join('')}
  <rect x="20" y="102" width="1560" height="820" rx="6" fill="#0A0D12" stroke="#283142"/>
  ${[0,1,2,3,4,5,6].map((g) => `<line x1="80" y1="${160 + g * 115}" x2="1540" y2="${160 + g * 115}" stroke="#1E2533"/>`).join('')}
  <!-- Position X (Red), Position Y (Green), Speed Magnitude (Amber Dashed) -->
  <path d="M 110 760 C 390 755, 520 220, 820 220 C 1120 220, 1260 490, 1500 310" fill="none" stroke="#F87171" stroke-width="3"/>
  <path d="M 110 680 C 360 520, 560 610, 820 430 C 1080 250, 1290 360, 1500 250" fill="none" stroke="#4ADE80" stroke-width="2.5"/>
  <path d="M 110 830 C 360 820, 500 340, 820 790 C 1090 830, 1250 510, 1500 810" fill="none" stroke="#FBBF24" stroke-width="2.2" stroke-dasharray="8 5"/>
  <!-- Bezier Handles -->
  <line x1="620" y1="220" x2="1020" y2="220" stroke="#FACC15" stroke-width="2"/>
  <circle cx="620" cy="220" r="7" fill="#FACC15"/><circle cx="1020" cy="220" r="7" fill="#FACC15"/>
  <rect x="812" y="212" width="16" height="16" transform="rotate(45 820 220)" fill="#E89B3C"/>
  <text x="842" y="206" font-family="${MONO}" font-size="11" fill="#FACC15">f:0120 • Pos.X = 960.0 px • Out Influence: 72% (0.0 px/s)</text>
</svg>`;

// v2_04: Precision Daylight Light Theme + Compact 1280px Responsive Layout
const v2_4 = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="760" viewBox="0 0 1280 760">
  <rect width="1280" height="760" fill="#CBD2DE"/>
  <rect width="1280" height="28" fill="#E1E6EF"/>
  <rect x="10" y="5" width="18" height="18" rx="4" fill="#BE6E0E"/>
  <text x="15" y="18" font-family="${SANS}" font-size="11" font-weight="bold" fill="#FFFFFF">P</text>
  <text x="36" y="18" font-family="${SANS}" font-size="12" font-weight="bold" fill="#12161F">PreEffects — Precision Daylight Light Theme (1280×760 Responsive Laptop Mode)</text>
  <rect y="29" width="1280" height="34" fill="#EAEFF5"/>
  ${['V Move','H Hand','Z Zoom','Q Shape','G Pen','T Text','Roto AI'].map((t, i) => `
    <rect x="${10 + i * 68}" y="35" width="62" height="22" rx="3" fill="${i===0?'#BE6E0E':'#FFFFFF'}" stroke="#AEBACD"/>
    <text x="${41 + i * 68}" y="50" text-anchor="middle" font-family="${SANS}" font-size="10" font-weight="bold" fill="${i===0?'#FFFFFF':'#12161F'}">${t}</text>
  `).join('')}
  <!-- Left Panel -->
  <rect x="0" y="65" width="240" height="430" fill="#F4F6F9"/>
  <text x="12" y="86" font-family="${SANS}" font-size="11" font-weight="bold" fill="#12161F">Project Assets (Light Theme)</text>
  ${['SHOT_040_HERO_TITLE', 'Precomp_LowerThird', 'brand_logo_vector.svg', 'voiceover_clean.wav'].map((it, i) => `
    <rect x="8" y="${98 + i * 30}" width="224" height="24" rx="3" fill="${i===0?'#CFE4FA':'#FFFFFF'}" stroke="#D1D8E4"/>
    <text x="18" y="${114 + i * 30}" font-family="${SANS}" font-size="10.5" fill="#12161F">${it}</text>
  `).join('')}
  <!-- Viewer Remains Neutral Dark Surround for Colour Accuracy -->
  <rect x="242" y="65" width="736" height="430" fill="#181C24"/>
  <rect x="282" y="92" width="656" height="368" fill="#0F172A" stroke="#475569"/>
  <text x="610" y="274" text-anchor="middle" font-family="${SANS}" font-size="28" font-weight="bold" letter-spacing="4" fill="#FFFFFF">PRECISION DAYLIGHT</text>
  <text x="610" y="302" text-anchor="middle" font-family="${MONO}" font-size="11" fill="#38BDF8">15.2:1 UI CONTRAST + NEUTRAL REC.709 VIEWPORT</text>
  <!-- Right Inspector -->
  <rect x="980" y="65" width="300" height="430" fill="#F4F6F9"/>
  <text x="992" y="86" font-family="${SANS}" font-size="11" font-weight="bold" fill="#12161F">Effect Controls</text>
  <rect x="990" y="98" width="280" height="84" rx="4" fill="#FFFFFF" stroke="#C5CFDE"/>
  <text x="1002" y="118" font-family="${SANS}" font-size="11" font-weight="bold" fill="#12161F">Drop Shadow + Glow</text>
  <text x="1002" y="142" font-family="${MONO}" font-size="10.5" fill="#BE6E0E">Opacity: 85%   Softness: 24.0 px</text>
  <text x="1002" y="164" font-family="${MONO}" font-size="10" fill="#15803D">GPU Cost: 0.7 ms ● Optimal</text>
  <!-- Bottom Timeline -->
  <rect x="0" y="497" width="1280" height="239" fill="#F4F6F9"/>
  <rect x="0" y="497" width="1280" height="26" fill="#E1E6EF"/>
  <text x="14" y="514" font-family="${MONO}" font-size="12" font-weight="bold" fill="#BE6E0E">00:00:02:18  |  COMPACT RESPONSIVE TIMELINE</text>
  ${[0, 1, 2].map((r) => `
    <rect x="10" y="${532 + r * 62}" width="320" height="52" rx="3" fill="#FFFFFF" stroke="#D1D8E4"/>
    <text x="22" y="${562 + r * 62}" font-family="${SANS}" font-size="11" fill="#12161F">${r + 1}  ${['[Txt] PRECISION DAYLIGHT', '[Shp] LowerThird_Plate', '[Aud] voiceover_clean.wav'][r]}</text>
    <rect x="340" y="${532 + r * 62}" width="928" height="52" rx="3" fill="#EAEFF5" stroke="#D1D8E4"/>
    <rect x="${365 + r * 30}" y="${545 + r * 62}" width="${780 - r * 50}" height="26" rx="3" fill="#CFE4FA" stroke="#0284C7"/>
  `).join('')}
  <rect y="736" width="1280" height="24" fill="#E1E6EF"/>
  <text x="12" y="752" font-family="${MONO}" font-size="10.5" fill="#12161F">Ready • Light Theme Verified • WCAG AAA Label Contrast (15.2:1)</text>
</svg>`;

renderV2('v2_01_flagship_workspace_with_breadcrumbs_and_profiler', v2_1, 1600);
renderV2('v2_02_nuke_fusion_grade_node_graph_with_thumbnails', v2_2, 1600);
renderV2('v2_03_unified_dual_value_speed_graph_and_expressions', v2_3, 1600);
renderV2('v2_04_precision_daylight_light_theme_and_responsive_1280', v2_4, 1280);
