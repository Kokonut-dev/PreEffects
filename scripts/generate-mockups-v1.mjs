import fs from 'node:fs';
import path from 'node:path';
import { Resvg } from '@resvg/resvg-js';

const OUT_DIR = path.resolve('docs/mockups/hifi');
fs.mkdirSync(OUT_DIR, { recursive: true });

const FONT_FILES = [
  '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
  '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
  '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf',
  '/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf',
].filter((f) => fs.existsSync(f));

const SANS = 'DejaVu Sans, sans-serif';
const MONO = 'DejaVu Sans Mono, monospace';

function renderSvgAndPng(name, svg) {
  const svgPath = path.join(OUT_DIR, `${name}.svg`);
  const pngPath = path.join(OUT_DIR, `${name}.png`);
  fs.writeFileSync(svgPath, svg, 'utf8');
  const resvg = new Resvg(svg, {
    font: {
      fontFiles: FONT_FILES,
      loadSystemFonts: true,
      defaultFontFamily: 'DejaVu Sans',
    },
    fitTo: { mode: 'width', value: 1600 },
  });
  const pngData = resvg.render().asPng();
  fs.writeFileSync(pngPath, pngData);
  console.log(`Generated ${pngPath} (${Math.round(pngData.length / 1024)} KB)`);
}

function topChrome(activeWorkspace = 'Animation') {
  const menuPositions = [
    ['File', 118],
    ['Edit', 162],
    ['Composition', 208],
    ['Layer', 304],
    ['Effect', 358],
    ['Animation', 414],
    ['View', 494],
    ['Window', 544],
    ['Help', 612],
  ];
  const workspaces = ['Default', 'Animation', 'Compositing', 'Node Graph', 'Typography', 'Minimal'];
  const tools = ['V', 'H', 'Z', 'W', 'C', 'Y', 'Rect', 'Pen', 'Text', 'Brush', 'Clone', 'Roto'];
  return `
  <!-- App Frame Background -->
  <rect x="0" y="0" width="1600" height="960" fill="#0C0E12"/>
  <!-- Menu Bar -->
  <rect x="0" y="0" width="1600" height="28" fill="#14171D"/>
  <rect x="10" y="5" width="18" height="18" rx="4" fill="#E89B3C"/>
  <text x="15" y="18" font-family="${SANS}" font-size="11" font-weight="bold" fill="#0C0E12">P</text>
  <text x="36" y="18" font-family="${SANS}" font-size="12" font-weight="bold" fill="#E6EAF2">PreEffects</text>
  ${menuPositions.map(([m, mx]) => `<text x="${mx}" y="18" font-family="${SANS}" font-size="11.5" fill="#C4CBD9">${m}</text>`).join('')}
  <!-- Command Palette Search Pill -->
  <rect x="1150" y="4" width="290" height="20" rx="3" fill="#202530" stroke="#323A4A" stroke-width="1"/>
  <text x="1162" y="17" font-family="${SANS}" font-size="10.5" fill="#8C96AA">Search effects, commands, assets... (Ctrl+K)</text>
  <text x="1460" y="18" font-family="${MONO}" font-size="10.5" fill="#22C55E">OFFLINE ● LOCAL</text>
  <line x1="0" y1="28.5" x2="1600" y2="28.5" stroke="#262B36"/>

  <!-- Tool & Workspace Bar -->
  <rect x="0" y="29" width="1600" height="36" fill="#181C24"/>
  ${tools.map((t, i) => {
    const active = i === 0;
    const x = 10 + i * 44;
    return `
      <rect x="${x}" y="35" width="38" height="24" rx="3" fill="${active ? '#E89B3C' : '#222733'}" stroke="${active ? '#F5B562' : '#303746'}"/>
      <text x="${x + 19}" y="51" text-anchor="middle" font-family="${SANS}" font-size="10" font-weight="${active ? 'bold' : 'normal'}" fill="${active ? '#0C0E12' : '#D0D6E2'}">${t}</text>
    `;
  }).join('')}
  <line x1="548" y1="35" x2="548" y2="59" stroke="#2D3443"/>
  <rect x="560" y="35" width="58" height="24" rx="3" fill="#222733" stroke="#38BDF8"/>
  <text x="589" y="51" text-anchor="middle" font-family="${SANS}" font-size="10" fill="#38BDF8">Snap ON</text>
  <rect x="624" y="35" width="64" height="24" rx="3" fill="#222733" stroke="#303746"/>
  <text x="656" y="51" text-anchor="middle" font-family="${SANS}" font-size="10" fill="#AAB3C4">3D Gizmo</text>

  <!-- Workspaces Right -->
  ${workspaces.map((w, i) => {
    const isAct = w === activeWorkspace;
    const x = 1040 + i * 90;
    return `
      <rect x="${x}" y="35" width="84" height="24" rx="3" fill="${isAct ? '#253142' : '#1E232D'}" stroke="${isAct ? '#38BDF8' : '#2C3342'}"/>
      <text x="${x + 42}" y="51" text-anchor="middle" font-family="${SANS}" font-size="10.5" font-weight="${isAct ? 'bold' : 'normal'}" fill="${isAct ? '#E6EAF2' : '#8E98AC'}">${w}</text>
    `;
  }).join('')}
  <line x1="0" y1="65.5" x2="1600" y2="65.5" stroke="#0C0E12"/>
  `;
}

function statusBar() {
  return `
  <rect x="0" y="936" width="1600" height="24" fill="#12151B"/>
  <line x1="0" y1="936.5" x2="1600" y2="936.5" stroke="#262B36"/>
  <text x="12" y="952" font-family="${SANS}" font-size="10.5" fill="#9AA3B5">Selection Tool (V) — Drag handles to transform layer; Shift constrains proportions</text>
  <text x="760" y="952" font-family="${MONO}" font-size="10.5" fill="#D0D6E2">X: 0960  Y: 0540   RGBA(32f): 0.94, 0.61, 0.24, 1.00</text>
  <text x="1190" y="952" font-family="${MONO}" font-size="10.5" fill="#22C55E">Frame Time: 4.8ms (60.0 fps)</text>
  <text x="1400" y="952" font-family="${MONO}" font-size="10.5" fill="#38BDF8">RAM Cache: 412/1024 MB  WebGL2</text>
  `;
}

function compStageArtwork(x, y, w, h, title = 'SHOT_040_HERO_TITLE', subtitle = 'ORBITAL TELEMETRY // 60 FPS') {
  const cx = x + w / 2;
  const cy = y + h / 2;
  return `
  <defs>
    <linearGradient id="stageGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0B1320"/>
      <stop offset="55%" stop-color="#131E32"/>
      <stop offset="100%" stop-color="#1E162B"/>
    </linearGradient>
    <radialGradient id="amberGlow" cx="50%" cy="50%" r="48%">
      <stop offset="0%" stop-color="#E89B3C" stop-opacity="0.34"/>
      <stop offset="65%" stop-color="#38BDF8" stop-opacity="0.10"/>
      <stop offset="100%" stop-color="#0B1320" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <!-- Viewer Dark Surround -->
  <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#090A0D"/>
  <!-- 16:9 Active Frame -->
  <rect x="${x + 46}" y="${y + 24}" width="${w - 92}" height="${h - 68}" fill="url(#stageGrad)" stroke="#2E3646"/>
  <rect x="${x + 46}" y="${y + 24}" width="${w - 92}" height="${h - 68}" fill="url(#amberGlow)"/>
  <!-- Perspective Grid Lines -->
  ${[-3, -2, -1, 0, 1, 2, 3].map((k) => `<line x1="${cx + k * 90}" y1="${y + 24}" x2="${cx + k * 145}" y2="${y + h - 44}" stroke="#38BDF8" stroke-opacity="0.11"/>`).join('')}
  <!-- Safe Zone Guides -->
  <rect x="${x + 82}" y="${y + 48}" width="${w - 164}" height="${h - 116}" fill="none" stroke="#38BDF8" stroke-opacity="0.24" stroke-dasharray="4 4"/>
  <!-- Animated HUD Rings -->
  <circle cx="${cx}" cy="${cy - 10}" r="118" fill="none" stroke="#38BDF8" stroke-opacity="0.45" stroke-width="1.5" stroke-dasharray="18 8"/>
  <circle cx="${cx}" cy="${cy - 10}" r="88" fill="none" stroke="#E89B3C" stroke-opacity="0.7" stroke-width="2"/>
  <!-- Motion Path Spatial Bezier Curve -->
  <path d="M ${cx - 210} ${cy + 58} C ${cx - 110} ${cy - 95}, ${cx + 95} ${cy + 95}, ${cx + 215} ${cy - 38}" fill="none" stroke="#38BDF8" stroke-width="1.5" stroke-dasharray="3 4"/>
  <rect x="${cx - 214}" y="${cy + 54}" width="8" height="8" transform="rotate(45 ${cx - 210} ${cy + 58})" fill="#38BDF8"/>
  <rect x="${cx + 211}" y="${cy - 42}" width="8" height="8" transform="rotate(45 ${cx + 215} ${cy - 38})" fill="#38BDF8"/>
  <!-- Hero Kinetic Typography -->
  <rect x="${cx - 205}" y="${cy - 52}" width="410" height="84" fill="none" stroke="#E89B3C" stroke-width="1.2"/>
  ${[[-205, -52], [205, -52], [-205, 32], [205, 32]].map(([dx, dy]) => `<rect x="${cx + dx - 3}" y="${cy + dy - 3}" width="6" height="6" fill="#E89B3C"/>`).join('')}
  <text x="${cx}" y="${cy - 12}" text-anchor="middle" font-family="${SANS}" font-size="30" font-weight="bold" letter-spacing="5" fill="#F8FAFC">PREEFFECTS</text>
  <text x="${cx}" y="${cy + 16}" text-anchor="middle" font-family="${MONO}" font-size="11.5" fill="#38BDF8">${subtitle}</text>
  <!-- Anchor Crosshair -->
  <circle cx="${cx}" cy="${cy - 10}" r="6" fill="none" stroke="#E89B3C" stroke-width="1.5"/>
  <line x1="${cx - 10}" y1="${cy - 10}" x2="${cx + 10}" y2="${cy - 10}" stroke="#E89B3C"/>
  <line x1="${cx}" y1="${cy - 20}" x2="${cx}" y2="${cy}" stroke="#E89B3C"/>
  <!-- Viewer Footer Bar -->
  <rect x="${x}" y="${y + h - 28}" width="${w}" height="28" fill="#161A22"/>
  <text x="${x + 12}" y="${y + h - 10}" font-family="${MONO}" font-size="10.5" fill="#E6EAF2">75% ▾   Full ▾   RGB ▾   Active Camera (35mm) ▾   ROI   Snapshot A/B   32-bpc Linear</text>
  <text x="${x + w - 155}" y="${y + h - 10}" font-family="${MONO}" font-size="10.5" fill="#E89B3C">${title}</text>
  `;
}

// 1. Default Animation Workspace
const svg1 = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="960" viewBox="0 0 1600 960">
  ${topChrome('Animation')}
  <!-- Left Panel: Project (x=0..308, y=67..556) -->
  <rect x="0" y="67" width="308" height="489" fill="#14171D"/>
  <rect x="0" y="67" width="308" height="26" fill="#1B1F27"/>
  <rect x="0" y="67" width="92" height="2" fill="#38BDF8"/>
  <text x="14" y="84" font-family="${SANS}" font-size="11" font-weight="bold" fill="#E6EAF2">Project</text>
  <text x="108" y="84" font-family="${SANS}" font-size="11" fill="#8C96AA">Asset Library</text>
  <text x="205" y="84" font-family="${SANS}" font-size="11" fill="#8C96AA">History</text>
  <!-- Asset Preview Header -->
  <rect x="10" y="101" width="76" height="46" rx="3" fill="#0E1726" stroke="#2D3646"/>
  <circle cx="48" cy="124" r="14" fill="none" stroke="#E89B3C" stroke-width="1.5"/>
  <text x="96" y="114" font-family="${SANS}" font-size="11.5" font-weight="bold" fill="#E6EAF2">SHOT_040_HERO_TITLE</text>
  <text x="96" y="129" font-family="${MONO}" font-size="10" fill="#9AA3B5">1920×1080 | 60.00 fps | 10:00</text>
  <text x="96" y="143" font-family="${MONO}" font-size="10" fill="#38BDF8">32-bpc Float • ACEScg</text>
  <!-- Search -->
  <rect x="10" y="155" width="288" height="22" rx="3" fill="#1E232D" stroke="#2E3646"/>
  <text x="20" y="170" font-family="${SANS}" font-size="10.5" fill="#7D879B">Filter project items...</text>
  <!-- Project Tree -->
  ${[
    ['#38BDF8', '▾ 01_Compositions', 'Folder', ''],
    ['#E89B3C', '    SHOT_040_HERO_TITLE', 'Comp', '00:10:00'],
    ['#38C6BD', '    Precomp_Orbital_HUD', 'Comp', '00:10:00'],
    ['#38BDF8', '▾ 02_Footage_Plates', 'Folder', ''],
    ['#4C8BF5', '    atmos_nebula_4k.mov', 'ProRes', '00:14:12'],
    ['#9B87F5', '    hud_glyph_sheet.psd', 'PSD', 'Layered'],
    ['#7CC69B', '    telemetry_data.json', 'JSON', 'Data'],
    ['#4BB543', '    sub_pulse_124bpm.wav', 'WAV', '48 kHz'],
    ['#38BDF8', '▾ 03_Solids_and_3D', 'Folder', ''],
    ['#F29B76', '    satellite_mesh.glb', 'glTF 3D', '42k tris'],
    ['#E05252', '    Optical_Vignette_Solid', 'Solid', '1920×1080'],
  ].map(([col, name, kind, meta], idx) => {
    const ry = 192 + idx * 26;
    const sel = idx === 1;
    return `
      ${sel ? `<rect x="4" y="${ry - 14}" width="300" height="22" rx="2" fill="#233044"/>` : ''}
      <rect x="12" y="${ry - 9}" width="8" height="8" rx="1.5" fill="${col}"/>
      <text x="26" y="${ry}" font-family="${SANS}" font-size="11" fill="${sel ? '#FFFFFF' : '#D0D6E2'}">${name}</text>
      <text x="242" y="${ry}" font-family="${MONO}" font-size="9.5" fill="#8C96AA">${meta || kind}</text>
    `;
  }).join('')}

  <!-- Center Composition Viewer (x=310..1218, y=67..556) -->
  <rect x="310" y="67" width="908" height="26" fill="#1B1F27"/>
  <rect x="310" y="67" width="215" height="2" fill="#E89B3C"/>
  <text x="322" y="84" font-family="${SANS}" font-size="11" font-weight="bold" fill="#E6EAF2">Comp: SHOT_040_HERO_TITLE ×</text>
  <text x="540" y="84" font-family="${SANS}" font-size="11" fill="#8C96AA">Precomp_Orbital_HUD ×</text>
  ${compStageArtwork(310, 93, 908, 463)}

  <!-- Right Inspector: Effect Controls & Transport (x=1220..1600, y=67..556) -->
  <rect x="1220" y="67" width="380" height="489" fill="#14171D"/>
  <rect x="1220" y="67" width="380" height="26" fill="#1B1F27"/>
  <rect x="1220" y="67" width="118" height="2" fill="#38BDF8"/>
  <text x="1232" y="84" font-family="${SANS}" font-size="11" font-weight="bold" fill="#E6EAF2">Effect Controls</text>
  <text x="1348" y="84" font-family="${SANS}" font-size="11" fill="#8C96AA">Character</text>
  <text x="1425" y="84" font-family="${SANS}" font-size="11" fill="#8C96AA">Scopes</text>
  <text x="1488" y="84" font-family="${SANS}" font-size="11" fill="#8C96AA">Profiler</text>

  <!-- Effect Card 1 -->
  <rect x="1228" y="101" width="364" height="92" rx="3" fill="#1B1F28" stroke="#2B3242"/>
  <rect x="1236" y="109" width="18" height="14" rx="2" fill="#E89B3C"/>
  <text x="1240" y="119" font-family="${MONO}" font-size="9.5" font-weight="bold" fill="#0C0E12">fx</text>
  <text x="1262" y="120" font-family="${SANS}" font-size="11.5" font-weight="bold" fill="#E6EAF2">Gaussian Blur</text>
  <text x="1528" y="119" font-family="${MONO}" font-size="10" fill="#22C55E">0.9 ms</text>
  <text x="1242" y="144" font-family="${SANS}" font-size="10.5" fill="#9AA3B5">◆ Blurriness</text>
  <text x="1518" y="144" font-family="${MONO}" font-size="10.5" fill="#E89B3C">14.5 px</text>
  <rect x="1345" y="137" width="160" height="5" rx="2" fill="#2B3242"/>
  <rect x="1345" y="137" width="68" height="5" rx="2" fill="#E89B3C"/>
  <text x="1242" y="168" font-family="${SANS}" font-size="10.5" fill="#9AA3B5">   Blur Dimensions</text>
  <text x="1438" y="168" font-family="${MONO}" font-size="10" fill="#D0D6E2">Horiz &amp; Vert ▾</text>

  <!-- Effect Card 2 -->
  <rect x="1228" y="201" width="364" height="106" rx="3" fill="#1B1F28" stroke="#2B3242"/>
  <rect x="1236" y="209" width="18" height="14" rx="2" fill="#E89B3C"/>
  <text x="1240" y="219" font-family="${MONO}" font-size="9.5" font-weight="bold" fill="#0C0E12">fx</text>
  <text x="1262" y="220" font-family="${SANS}" font-size="11.5" font-weight="bold" fill="#E6EAF2">Optical Glow (32-bpc)</text>
  <text x="1528" y="219" font-family="${MONO}" font-size="10" fill="#22C55E">1.4 ms</text>
  <text x="1242" y="244" font-family="${SANS}" font-size="10.5" fill="#9AA3B5">◆ Glow Threshold</text>
  <text x="1524" y="244" font-family="${MONO}" font-size="10.5" fill="#E89B3C">64.0%</text>
  <text x="1242" y="266" font-family="${SANS}" font-size="10.5" fill="#9AA3B5">◆ Glow Radius</text>
  <text x="1518" y="266" font-family="${MONO}" font-size="10.5" fill="#E89B3C">48.0 px</text>
  <text x="1242" y="288" font-family="${SANS}" font-size="10.5" fill="#9AA3B5">◆ Glow Intensity</text>
  <text x="1534" y="288" font-family="${MONO}" font-size="10.5" fill="#E89B3C">1.65</text>

  <!-- Effect Card 3: Curves Spline -->
  <rect x="1228" y="315" width="364" height="162" rx="3" fill="#1B1F28" stroke="#2B3242"/>
  <text x="1240" y="334" font-family="${SANS}" font-size="11.5" font-weight="bold" fill="#E6EAF2">Curves — Master RGB</text>
  <text x="1528" y="334" font-family="${MONO}" font-size="10" fill="#22C55E">0.6 ms</text>
  <rect x="1242" y="344" width="140" height="122" fill="#11141B" stroke="#2F3747"/>
  <line x1="1242" y1="466" x2="1382" y2="344" stroke="#2D3545" stroke-dasharray="3 3"/>
  <path d="M 1242 466 C 1280 462, 1325 362, 1382 344" fill="none" stroke="#E6EAF2" stroke-width="2"/>
  <path d="M 1242 466 C 1288 452, 1335 370, 1382 348" fill="none" stroke="#38BDF8" stroke-width="1.2"/>
  <!-- Preview Transport Box -->
  <rect x="1228" y="485" width="364" height="64" rx="3" fill="#181C24" stroke="#2B3242"/>
  <text x="1240" y="504" font-family="${SANS}" font-size="10.5" font-weight="bold" fill="#9AA3B5">PREVIEW TRANSPORT</text>
  <text x="1450" y="504" font-family="${MONO}" font-size="10" fill="#22C55E">60.0 fps ● REALTIME</text>
  ${['|&lt;', '&lt;', 'PLAY', '&gt;', '&gt;|', 'Loop'].map((b, i) => `
    <rect x="${1240 + i * 56}" y="514" width="48" height="26" rx="3" fill="${b === 'PLAY' ? '#E89B3C' : '#232936'}" stroke="#343D4F"/>
    <text x="${1264 + i * 56}" y="531" text-anchor="middle" font-family="${MONO}" font-size="10" font-weight="bold" fill="${b === 'PLAY' ? '#0C0E12' : '#E6EAF2'}">${b}</text>
  `).join('')}

  <!-- Bottom Timeline Panel (x=0..1600, y=558..935) -->
  <rect x="0" y="558" width="1600" height="377" fill="#14171D"/>
  <rect x="0" y="558" width="1600" height="32" fill="#1B1F27"/>
  <!-- Timecode Readout -->
  <rect x="10" y="563" width="128" height="22" rx="3" fill="#0F1217" stroke="#2E3646"/>
  <text x="20" y="578" font-family="${MONO}" font-size="13" font-weight="bold" fill="#E89B3C">00:00:03:42</text>
  <text x="148" y="578" font-family="${MONO}" font-size="10.5" fill="#8C96AA">f:0222</text>
  <!-- Timeline View Switchers -->
  <rect x="215" y="563" width="82" height="22" rx="3" fill="#253142" stroke="#38BDF8"/>
  <text x="256" y="578" text-anchor="middle" font-family="${SANS}" font-size="10.5" font-weight="bold" fill="#E6EAF2">Layer Stack</text>
  <rect x="303" y="563" width="88" height="22" rx="3" fill="#202530" stroke="#303746"/>
  <text x="347" y="578" text-anchor="middle" font-family="${SANS}" font-size="10.5" fill="#9AA3B5">Node Graph</text>
  <rect x="397" y="563" width="92" height="22" rx="3" fill="#202530" stroke="#303746"/>
  <text x="443" y="578" text-anchor="middle" font-family="${SANS}" font-size="10.5" fill="#9AA3B5">Graph Editor</text>

  <!-- Column Headers -->
  <rect x="0" y="590" width="620" height="24" fill="#171B22"/>
  <text x="12" y="606" font-family="${MONO}" font-size="10" fill="#8C96AA">V  A  S  L   #   Layer Name                  Mode       Matte      Parent     Cost</text>
  <!-- Time Ruler -->
  <rect x="622" y="590" width="978" height="24" fill="#151920"/>
  <!-- Green RAM Cache Bar -->
  <rect x="622" y="611" width="680" height="3" fill="#22C55E"/>
  ${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((s) => `
    <line x1="${640 + s * 94}" y1="590" x2="${640 + s * 94}" y2="611" stroke="#343D4E"/>
    <text x="${645 + s * 94}" y="604" font-family="${MONO}" font-size="9.5" fill="#8C96AA">00:0${s}:00</text>
  `).join('')}

  <!-- Timeline Tracks -->
  ${[
    ['#E89B3C', '1', '[Txt] PREEFFECTS_HERO_TITLE', 'Normal', 'None', '4.Master_Null', '1.4ms', 640, 880, true],
    ['#38BDF8', '  ', '  ▸ Transform.Position  [960.0, 530.0]  expr: wiggle(2,12)', '', '', '', '', 640, 880, false],
    ['#38C6BD', '2', '[Shp] HUD_Orbital_Rings (Trim+Repeater)', 'Add', 'None', '4.Master_Null', '1.1ms', 670, 850, false],
    ['#E079B5', '3', '[Adj] Grade_ACES_FilmGlow_Adj', 'Normal', 'None', 'None', '0.9ms', 640, 910, false],
    ['#9B87F5', '4', '[Nul] Master_Rig_Null_3D', '—', '—', 'None', '0.1ms', 640, 910, false],
    ['#F29B76', '5', '[Cam] Camera_35mm_Anamorphic (DoF)', '—', '—', '4.Master_Null', '0.4ms', 640, 910, false],
    ['#4C8BF5', '6', '[Pre] Precomp_Orbital_HUD', 'Screen', 'Alpha 7', 'None', '0.6ms', 690, 840, false],
    ['#7CC69B', '7', '[Mov] atmos_nebula_4k.mov', 'Normal', 'None', 'None', '0.3ms', 640, 910, false],
    ['#4BB543', '8', '[Aud] sub_pulse_124bpm.wav', '—', '—', 'None', '0.1ms', 640, 910, false],
  ].map(([col, num, name, mode, matte, parent, cost, barX, barW, sel], i) => {
    const ry = 616 + i * 33;
    return `
      <rect x="0" y="${ry}" width="620" height="32" fill="${sel ? '#212B3B' : i % 2 === 0 ? '#151920' : '#13161C'}"/>
      <rect x="622" y="${ry}" width="978" height="32" fill="${sel ? '#1C2533' : i % 2 === 0 ? '#14181F' : '#11151B'}"/>
      <rect x="78" y="${ry + 9}" width="10" height="14" rx="2" fill="${col}"/>
      <text x="12" y="${ry + 20}" font-family="${MONO}" font-size="10" fill="#9AA3B5">◉  ·  ·  ·</text>
      <text x="95" y="${ry + 20}" font-family="${MONO}" font-size="10.5" fill="#8C96AA">${num}</text>
      <text x="116" y="${ry + 20}" font-family="${SANS}" font-size="11" font-weight="${sel ? 'bold' : 'normal'}" fill="${sel ? '#FFFFFF' : '#DCE2EE'}">${name}</text>
      <text x="366" y="${ry + 20}" font-family="${MONO}" font-size="10" fill="#9AA3B5">${mode}</text>
      <text x="434" y="${ry + 20}" font-family="${MONO}" font-size="10" fill="#9AA3B5">${matte}</text>
      <text x="498" y="${ry + 20}" font-family="${MONO}" font-size="10" fill="#38BDF8">${parent}</text>
      <text x="580" y="${ry + 20}" font-family="${MONO}" font-size="9.5" fill="#22C55E">${cost}</text>
      ${i === 1 ? `
        <line x1="685" y1="${ry + 16}" x2="1180" y2="${ry + 16}" stroke="#38BDF8" stroke-opacity="0.5"/>
        ${[685, 835, 995, 1180].map((kx, ki) => `<rect x="${kx - 5}" y="${ry + 11}" width="10" height="10" transform="rotate(45 ${kx} ${ry + 16})" fill="${ki === 2 ? '#E89B3C' : '#38BDF8'}"/>`).join('')}
      ` : i === 8 ? `
        <rect x="${barX}" y="${ry + 5}" width="${barW}" height="22" rx="3" fill="#1D3829" stroke="#2F6846"/>
        <path d="M 650 ${ry + 16} ${Array.from({ length: 58 }, (_, k) => `L ${655 + k * 15} ${ry + 16 + ((k % 2 === 0 ? 1 : -1) * (3 + ((k * 7) % 8)))}`).join(' ')}" fill="none" stroke="#4ADE80" stroke-width="1.2"/>
      ` : `
        <rect x="${barX}" y="${ry + 6}" width="${barW}" height="20" rx="3" fill="${col}" fill-opacity="0.28" stroke="${col}" stroke-opacity="0.8"/>
      `}
    `;
  }).join('')}

  <!-- Playhead CTI Needle -->
  <polygon points="982,590 996,590 989,603" fill="#E89B3C"/>
  <line x1="989" y1="602" x2="989" y2="935" stroke="#E89B3C" stroke-width="1.6"/>
  ${statusBar()}
</svg>`;

// 2. Compositing & Scopes Workspace
const svg2 = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="960" viewBox="0 0 1600 960">
  ${topChrome('Compositing')}
  <!-- Left: Broadcast Scopes (RGB Parade, Vectorscope, Waveform, Histogram) -->
  <rect x="0" y="67" width="380" height="520" fill="#14171D"/>
  <rect x="0" y="67" width="380" height="26" fill="#1B1F27"/>
  <rect x="0" y="67" width="124" height="2" fill="#38BDF8"/>
  <text x="14" y="84" font-family="${SANS}" font-size="11" font-weight="bold" fill="#E6EAF2">Broadcast Scopes</text>
  <text x="148" y="84" font-family="${SANS}" font-size="11" fill="#8C96AA">Project</text>
  <!-- RGB Parade -->
  <rect x="12" y="102" width="356" height="198" rx="3" fill="#0B0D12" stroke="#283040"/>
  <text x="22" y="118" font-family="${MONO}" font-size="10" fill="#9AA3B5">RGB PARADE (IRE 0..100 • 32-bpc)</text>
  <path d="M 28 265 Q 70 160, 122 210" fill="none" stroke="#EF4444" stroke-width="2" stroke-opacity="0.8"/>
  <path d="M 142 270 Q 190 148, 244 195" fill="none" stroke="#22C55E" stroke-width="2" stroke-opacity="0.8"/>
  <path d="M 258 258 Q 305 135, 354 185" fill="none" stroke="#3B82F6" stroke-width="2" stroke-opacity="0.8"/>
  <!-- Vectorscope + Histogram -->
  <rect x="12" y="310" width="174" height="174" rx="3" fill="#0B0D12" stroke="#283040"/>
  <text x="20" y="326" font-family="${MONO}" font-size="9.5" fill="#9AA3B5">VECTORSCOPE</text>
  <circle cx="99" cy="404" r="62" fill="none" stroke="#283244"/>
  <line x1="99" y1="404" x2="62" y2="356" stroke="#E89B3C" stroke-opacity="0.6"/>
  <ellipse cx="94" cy="396" rx="22" ry="12" transform="rotate(-32 94 396)" fill="#38BDF8" fill-opacity="0.45"/>
  <rect x="194" y="310" width="174" height="174" rx="3" fill="#0B0D12" stroke="#283040"/>
  <text x="202" y="326" font-family="${MONO}" font-size="9.5" fill="#9AA3B5">LUMA HISTOGRAM</text>
  <polygon points="204,472 222,448 242,402 266,368 292,390 318,354 342,418 358,472" fill="#38BDF8" fill-opacity="0.38" stroke="#38BDF8"/>

  <!-- Center VFX Viewer with Snapshot A/B Wipe & Roto Matte -->
  <rect x="382" y="67" width="836" height="26" fill="#1B1F27"/>
  <rect x="382" y="67" width="220" height="2" fill="#E89B3C"/>
  <text x="394" y="84" font-family="${SANS}" font-size="11" font-weight="bold" fill="#E6EAF2">VFX_SHOT_112_CHROMA_COMP ×</text>
  ${compStageArtwork(382, 93, 836, 494, 'VFX_SHOT_112', 'AI ROTO MATTE + KEYLIGHT SPILL SUPPRESS')}
  <!-- A/B Wipe Line -->
  <line x1="780" y1="117" x2="780" y2="543" stroke="#E89B3C" stroke-width="2"/>
  <rect x="730" y="126" width="44" height="18" rx="2" fill="#0C0E12" stroke="#E89B3C"/>
  <text x="752" y="139" text-anchor="middle" font-family="${MONO}" font-size="9.5" fill="#E89B3C">A: RAW</text>
  <rect x="786" y="126" width="52" height="18" rx="2" fill="#0C0E12" stroke="#38BDF8"/>
  <text x="812" y="139" text-anchor="middle" font-family="${MONO}" font-size="9.5" fill="#38BDF8">B: COMP</text>

  <!-- Right: Keying + Tracker + Profiler -->
  <rect x="1220" y="67" width="380" height="520" fill="#14171D"/>
  <rect x="1220" y="67" width="380" height="26" fill="#1B1F27"/>
  <text x="1232" y="84" font-family="${SANS}" font-size="11" font-weight="bold" fill="#E6EAF2">Keying &amp; Planar Tracker</text>
  <rect x="1230" y="102" width="360" height="145" rx="3" fill="#1B1F28" stroke="#2B3242"/>
  <text x="1242" y="122" font-family="${SANS}" font-size="11.5" font-weight="bold" fill="#E6EAF2">Keylight + Spill Suppressor</text>
  <text x="1242" y="146" font-family="${SANS}" font-size="10.5" fill="#9AA3B5">Screen Colour</text>
  <rect x="1518" y="134" width="28" height="16" rx="2" fill="#18A94B" stroke="#E6EAF2"/>
  <text x="1242" y="168" font-family="${SANS}" font-size="10.5" fill="#9AA3B5">Clip Black / Clip White</text>
  <text x="1495" y="168" font-family="${MONO}" font-size="10.5" fill="#E89B3C">12% / 88%</text>
  <text x="1242" y="190" font-family="${SANS}" font-size="10.5" fill="#9AA3B5">Screen Shrink / Softness</text>
  <text x="1488" y="190" font-family="${MONO}" font-size="10.5" fill="#E89B3C">-1.2px / 2.4px</text>
  <text x="1242" y="212" font-family="${SANS}" font-size="10.5" fill="#9AA3B5">AI Refine Edge Feather</text>
  <text x="1508" y="212" font-family="${MONO}" font-size="10.5" fill="#38BDF8">Active ●</text>

  <rect x="1230" y="258" width="360" height="142" rx="3" fill="#1B1F28" stroke="#2B3242"/>
  <text x="1242" y="278" font-family="${SANS}" font-size="11.5" font-weight="bold" fill="#E6EAF2">3D Camera &amp; Planar Tracker</text>
  <text x="1242" y="302" font-family="${MONO}" font-size="10" fill="#22C55E">Avg Solve Error: 0.31 px (148 Track Points)</text>
  <rect x="1242" y="316" width="160" height="26" rx="3" fill="#253142" stroke="#38BDF8"/>
  <text x="1322" y="333" text-anchor="middle" font-family="${SANS}" font-size="10.5" fill="#E6EAF2">Track Forward ▶</text>
  <rect x="1412" y="316" width="164" height="26" rx="3" fill="#E89B3C"/>
  <text x="1494" y="333" text-anchor="middle" font-family="${SANS}" font-size="10.5" font-weight="bold" fill="#0C0E12">Create 3D Camera</text>
  <rect x="1242" y="352" width="334" height="34" rx="3" fill="#202530" stroke="#323A4A"/>
  <text x="1409" y="373" text-anchor="middle" font-family="${SANS}" font-size="10.5" fill="#D0D6E2">Content-Aware Fill: Generate Clean Plate</text>

  <!-- Profiler -->
  <rect x="1230" y="410" width="360" height="165" rx="3" fill="#1B1F28" stroke="#2B3242"/>
  <text x="1242" y="430" font-family="${SANS}" font-size="11.5" font-weight="bold" fill="#E6EAF2">Per-Effect GPU/CPU Profiler</text>
  ${[
    ['AI Roto Matte', 2.4, 150, '#38BDF8'],
    ['Keylight + Spill', 1.3, 92, '#22C55E'],
    ['Camera Lens Blur', 1.9, 122, '#E89B3C'],
    ['ACES Output LUT', 0.4, 34, '#22C55E'],
  ].map(([lbl, ms, bw, c], i) => `
    <text x="1242" y="${456 + i * 28}" font-family="${SANS}" font-size="10.5" fill="#D0D6E2">${lbl}</text>
    <rect x="1370" y="${446 + i * 28}" width="${bw}" height="10" rx="2" fill="${c}"/>
    <text x="1534" y="${456 + i * 28}" font-family="${MONO}" font-size="10" fill="#9AA3B5">${ms} ms</text>
  `).join('')}

  <!-- Compact Timeline Footer -->
  <rect x="0" y="589" width="1600" height="346" fill="#14171D"/>
  <rect x="0" y="589" width="1600" height="28" fill="#1B1F27"/>
  <text x="16" y="607" font-family="${MONO}" font-size="12" font-weight="bold" fill="#E89B3C">00:00:04:19  |  VFX COMPOSITE STACK (6 LAYERS • 2 TRACK MATTES • 3D CAMERA SOLVED)</text>
  ${[
    ['#E079B5', '1  [Adj] ACEScg_FilmOut_LUT.cube', 80, 1420],
    ['#38C6BD', '2  [Matte] AI_Roto_Foreground_Plate.mov (Keylight)', 120, 1340],
    ['#E89B3C', '3  [3D] Tracked_HUD_Callout_Null', 180, 1180],
    ['#9B87F5', '4  [Cam] Solved_3D_Camera_35mm', 80, 1420],
    ['#4C8BF5', '5  [Clean] ContentAware_Fill_Plate', 240, 960],
    ['#7CC69B', '6  [BG] Matte_Painting_Skyline_4K.exr', 80, 1420],
  ].map(([c, label, bx, bw], idx) => `
    <rect x="0" y="${622 + idx * 48}" width="460" height="44" fill="${idx % 2 === 0 ? '#161A22' : '#13171E'}"/>
    <text x="18" y="${648 + idx * 48}" font-family="${SANS}" font-size="11.5" fill="#E6EAF2">${label}</text>
    <rect x="462" y="${622 + idx * 48}" width="1138" height="44" fill="#11141B"/>
    <rect x="${462 + bx}" y="${631 + idx * 48}" width="${bw - 420}" height="26" rx="3" fill="${c}" fill-opacity="0.32" stroke="${c}"/>
  `).join('')}
  ${statusBar()}
</svg>`;

// 3. Minimal Workspace
const svg3 = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="960" viewBox="0 0 1600 960">
  ${topChrome('Minimal')}
  ${compStageArtwork(0, 67, 1600, 770, 'CLIENT_REVIEW_MASTER_4K', 'FULL-VIEWPORT PLAYBACK // ZERO DISTRACTION')}
  <rect x="0" y="838" width="1600" height="98" fill="#14171D"/>
  <line x1="0" y1="838" x2="1600" y2="838" stroke="#2C3444"/>
  <text x="24" y="872" font-family="${MONO}" font-size="18" font-weight="bold" fill="#E89B3C">00:00:05:00</text>
  <text x="175" y="872" font-family="${MONO}" font-size="12" fill="#22C55E">● RAM PREVIEW CACHED 600/600 FRAMES (60.0 FPS)</text>
  <rect x="24" y="892" width="1552" height="12" rx="4" fill="#1E2430"/>
  <rect x="24" y="892" width="1552" height="4" rx="2" fill="#22C55E"/>
  <rect x="24" y="892" width="776" height="12" rx="4" fill="#E89B3C" fill-opacity="0.45"/>
  <circle cx="800" cy="898" r="8" fill="#E89B3C"/>
  ${statusBar()}
</svg>`;

// 4. Bidirectional Node Graph & Effects Browser
const svg4 = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="960" viewBox="0 0 1600 960">
  ${topChrome('Node Graph')}
  <!-- Left: Effects & Presets Browser (19 Categories) -->
  <rect x="0" y="67" width="320" height="868" fill="#14171D"/>
  <rect x="0" y="67" width="320" height="26" fill="#1B1F27"/>
  <rect x="0" y="67" width="150" height="2" fill="#E89B3C"/>
  <text x="12" y="84" font-family="${SANS}" font-size="11" font-weight="bold" fill="#E6EAF2">Effects &amp; Smart Presets</text>
  <rect x="10" y="101" width="300" height="24" rx="3" fill="#1F2430" stroke="#38BDF8"/>
  <text x="20" y="117" font-family="${SANS}" font-size="10.5" fill="#E6EAF2">/ Search 186 Effects &amp; AI Tools...</text>
  ${[
    '★ Smart Adaptive Presets (14)',
    '▾ PreEffects Local AI &amp; Procedural (7)',
    '    AI Roto Matting (Offline)',
    '    AI Super-Scale 2x/4x',
    '    AI Optical-Flow Frame Tween',
    '    Procedural Reaction-Diffusion',
    '▸ Blur &amp; Sharpen (11)',
    '▸ Colour Correction (19)',
    '▸ Distort &amp; Warp Stabilizer (22)',
    '▸ Generate &amp; Audio Reactive (21)',
    '▸ Keying &amp; Spill Suppressor (9)',
    '▸ Matte &amp; Channel Ops (10)',
    '▸ Noise &amp; Fractal Grain (7)',
    '▸ Perspective &amp; 3D Tracker (6)',
    '▸ Simulation &amp; Particles (10)',
    '▸ Stylize &amp; Optical Glow (15)',
    '▸ Time, Transition &amp; Utility (17)',
    '▸ Audio DSP &amp; Immersive VR (19)',
  ].map((item, idx) => `
    <text x="16" y="${150 + idx * 36}" font-family="${SANS}" font-size="11" fill="${item.startsWith('    ') ? '#38BDF8' : '#DCE2EE'}">${item}</text>
  `).join('')}

  <!-- Top Right Mini Viewer -->
  ${compStageArtwork(322, 67, 1278, 360, 'NODE_DAG_SYNCED', 'BIDIRECTIONAL LAYER TO NODE COMPOSITOR')}

  <!-- Bottom Right Node Graph Canvas -->
  <rect x="322" y="429" width="1278" height="506" fill="#0F1218"/>
  <rect x="322" y="429" width="1278" height="28" fill="#1B1F27"/>
  <text x="336" y="447" font-family="${SANS}" font-size="11" font-weight="bold" fill="#38BDF8">Bidirectional Node Graph — Live Synced with Timeline Stack (6 Nodes, 1 Parallel Bloom Branch)</text>
  <!-- Grid Dots -->
  ${Array.from({ length: 18 }, (_, gx) => Array.from({ length: 9 }, (_, gy) => `<circle cx="${360 + gx * 70}" cy="${480 + gy * 50}" r="1" fill="#283040"/>`).join('')).join('')}
  <!-- Bezier Noodles -->
  <path d="M 530 620 C 590 620, 590 555, 650 555" fill="none" stroke="#38BDF8" stroke-width="2.2"/>
  <path d="M 530 620 C 590 620, 590 695, 650 695" fill="none" stroke="#E89B3C" stroke-width="2.2"/>
  <path d="M 830 555 C 900 555, 900 625, 960 625" fill="none" stroke="#38BDF8" stroke-width="2.2"/>
  <path d="M 830 695 C 900 695, 900 640, 960 640" fill="none" stroke="#E89B3C" stroke-width="2.2"/>
  <path d="M 530 795 C 740 795, 760 655, 960 655" fill="none" stroke="#4ADE80" stroke-width="2.2"/>
  <path d="M 1140 635 C 1210 635, 1210 635, 1280 635" fill="none" stroke="#F8FAFC" stroke-width="2.5"/>

  <!-- Nodes -->
  ${[
    [360, 590, '#38BDF8', 'Read: HERO_TITLE', 'Text + Animator Rig'],
    [360, 765, '#4ADE80', 'Read: Nebula_4K.mov', 'ProRes 4444 • 60fps'],
    [650, 525, '#38BDF8', 'Unsharp + Transform', 'Amount 85% • 0.5ms'],
    [650, 665, '#E89B3C', 'Optical Glow Branch', '32-bpc Superwhite • 1.4ms'],
    [960, 600, '#A855F7', 'Merge (Screen + Over)', '3 Inputs • Alpha Premul'],
    [1280, 600, '#22C55E', 'Comp Output (ACEScg)', '1920×1080 • 60fps'],
  ].map(([nx, ny, col, title, sub]) => `
    <rect x="${nx}" y="${ny}" width="172" height="62" rx="5" fill="#1B202B" stroke="${col}" stroke-width="1.6"/>
    <rect x="${nx}" y="${ny}" width="172" height="18" rx="4" fill="${col}" fill-opacity="0.24"/>
    <text x="${nx + 10}" y="${ny + 13}" font-family="${SANS}" font-size="10.5" font-weight="bold" fill="#F8FAFC">${title}</text>
    <text x="${nx + 10}" y="${ny + 38}" font-family="${MONO}" font-size="9.5" fill="#9AA3B5">${sub}</text>
    <circle cx="${nx}" cy="${ny + 31}" r="5" fill="${col}"/>
    <circle cx="${nx + 172}" cy="${ny + 31}" r="5" fill="${col}"/>
  `).join('')}
  ${statusBar()}
</svg>`;

// 5. Graph Editor, Active Render Queue & Preferences Dialog
const svg5 = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="960" viewBox="0 0 1600 960">
  ${topChrome('Animation')}
  <!-- Top Half: Unified Value + Speed Graph Editor + Expression Editor -->
  <rect x="0" y="67" width="1020" height="445" fill="#12151C"/>
  <rect x="0" y="67" width="1020" height="28" fill="#1B1F27"/>
  <text x="14" y="85" font-family="${SANS}" font-size="11.5" font-weight="bold" fill="#E89B3C">Unified Graph Editor — Value + Speed Curves (Transform.Position X/Y &amp; Scale)</text>
  <!-- Graph Grid -->
  ${[0, 1, 2, 3, 4, 5].map((g) => `<line x1="60" y1="${125 + g * 68}" x2="990" y2="${125 + g * 68}" stroke="#222836"/>`).join('')}
  <!-- X Position Curve (Red) & Speed Curve (Amber) -->
  <path d="M 90 430 C 260 425, 360 155, 540 155 C 720 155, 810 310, 960 220" fill="none" stroke="#EF4444" stroke-width="2.4"/>
  <path d="M 90 455 C 250 455, 340 210, 540 380 C 700 455, 820 265, 960 440" fill="none" stroke="#38BDF8" stroke-width="1.8" stroke-dasharray="5 3"/>
  <!-- Bezier Tangent Handles -->
  <line x1="430" y1="155" x2="650" y2="155" stroke="#FACC15" stroke-width="1.6"/>
  <circle cx="430" cy="155" r="5" fill="#FACC15"/>
  <circle cx="650" cy="155" r="5" fill="#FACC15"/>
  <rect x="534" y="149" width="12" height="12" transform="rotate(45 540 155)" fill="#E89B3C"/>

  <!-- Top Right: Preferences Dialog Preview -->
  <rect x="1022" y="67" width="578" height="445" fill="#181C25" stroke="#343E52"/>
  <rect x="1022" y="67" width="578" height="30" fill="#212734"/>
  <text x="1038" y="86" font-family="${SANS}" font-size="12" font-weight="bold" fill="#E6EAF2">Preferences — Media, GPU &amp; Offline Privacy</text>
  ${['General', 'Previews &amp; GPU', 'Display', 'Import &amp; Output', 'Grids &amp; Guides', 'Media &amp; Cache', 'Appearance', 'Accessibility'].map((tab, i) => `
    <rect x="1030" y="${108 + i * 38}" width="142" height="30" rx="3" fill="${i === 5 ? '#263449' : '#1D222D'}"/>
    <text x="1042" y="${127 + i * 38}" font-family="${SANS}" font-size="10.5" fill="${i === 5 ? '#38BDF8' : '#9AA3B5'}">${tab}</text>
  `).join('')}
  <text x="1192" y="128" font-family="${SANS}" font-size="12" font-weight="bold" fill="#E6EAF2">Local Disk &amp; RAM Preview Cache</text>
  <text x="1192" y="158" font-family="${SANS}" font-size="10.5" fill="#9AA3B5">Maximum RAM Preview Budget:  1024 MB (LRU Eviction)</text>
  <text x="1192" y="186" font-family="${SANS}" font-size="10.5" fill="#9AA3B5">Persistent Disk Cache Limit: 20.0 GB (~/.cache/PreEffects)</text>
  <text x="1192" y="214" font-family="${SANS}" font-size="10.5" fill="#9AA3B5">Hardware GPU Pipeline:       WebGL2 + Float32 CPU Fallback</text>
  <text x="1192" y="242" font-family="${SANS}" font-size="10.5" fill="#22C55E">Network / Telemetry Policy:  STRICT OFFLINE (0 Outbound Sockets)</text>
  <rect x="1192" y="268" width="168" height="28" rx="3" fill="#242B39" stroke="#38BDF8"/>
  <text x="1276" y="286" text-anchor="middle" font-family="${SANS}" font-size="10.5" fill="#38BDF8">Purge All Caches</text>

  <!-- Bottom Half: Active Render Queue -->
  <rect x="0" y="514" width="1600" height="421" fill="#14171D"/>
  <rect x="0" y="514" width="1600" height="30" fill="#1B1F27"/>
  <text x="16" y="534" font-family="${SANS}" font-size="12" font-weight="bold" fill="#E6EAF2">Render Queue — 3 Jobs (Active Multi-Module Background Render)</text>
  <rect x="1430" y="518" width="152" height="22" rx="3" fill="#E89B3C"/>
  <text x="1506" y="533" text-anchor="middle" font-family="${SANS}" font-size="11" font-weight="bold" fill="#0C0E12">Rendering... 68%</text>

  <!-- Progress Bar -->
  <rect x="16" y="556" width="1568" height="18" rx="3" fill="#202634"/>
  <rect x="16" y="556" width="1066" height="18" rx="3" fill="#E89B3C"/>
  <text x="26" y="569" font-family="${MONO}" font-size="10.5" font-weight="bold" fill="#0C0E12">SHOT_040_HERO_TITLE — Frame 408 / 600 (68.0%) — Elapsed 00:08 — Remaining ETA 00:03</text>

  <!-- Render Items -->
  ${[
    ['#22C55E', '1  SHOT_010_INTRO_LOGO', 'Completed (00:04)', 'Best Settings • Full • 60fps', 'ProRes 4444 RGBA (.mov) + H.264 (.mp4)'],
    ['#E89B3C', '2  SHOT_040_HERO_TITLE', 'Rendering (68%)', 'Best • 32-bpc Linear • Motion Blur ON', 'Module 1: ProRes 4444 + Depth/Normal AOVs  |  Module 2: WebM VP9'],
    ['#38BDF8', '3  VFX_SHOT_112_CHROMA', 'Queued', 'Best Settings • Full • No Proxies', 'OpenEXR 16-bit Half Sequence (shot_112_[####].exr) + WAV 48kHz'],
  ].map(([col, comp, st, rset, omod], i) => `
    <rect x="16" y="${590 + i * 102}" width="1568" height="90" rx="4" fill="#1A1E27" stroke="#2B3344"/>
    <rect x="16" y="${590 + i * 102}" width="6" height="90" fill="${col}"/>
    <text x="36" y="${616 + i * 102}" font-family="${SANS}" font-size="12" font-weight="bold" fill="#F8FAFC">${comp}</text>
    <text x="360" y="${616 + i * 102}" font-family="${MONO}" font-size="11" fill="${col}">${st}</text>
    <text x="36" y="${642 + i * 102}" font-family="${SANS}" font-size="10.5" fill="#9AA3B5">Render Settings: ${rset}</text>
    <text x="36" y="${664 + i * 102}" font-family="${MONO}" font-size="10.5" fill="#38BDF8">Output Modules: ${omod}</text>
  `).join('')}
  ${statusBar()}
</svg>`;

renderSvgAndPng('01_default_animation_workspace', svg1);
renderSvgAndPng('02_compositing_and_scopes_workspace', svg2);
renderSvgAndPng('03_minimal_workspace', svg3);
renderSvgAndPng('04_node_graph_and_effects_browser', svg4);
renderSvgAndPng('05_graph_editor_render_queue_and_preferences', svg5);
