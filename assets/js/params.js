// The six transect parameters: definition, example and a technical diagram for each.
// Also Transects, Households and The archive as a second set ('How we read a valley').
// Used by the Tags (chips) and Cards blocks: any item whose title matches opens a popup.
import { esc, md, videoEmbed } from './ui.js';
import { siteUrl } from './config.js';

const T = (x, y, s, cls = 'tx', extra = '') => `<text x="${x}" y="${y}" class="${cls}" ${extra}>${s}</text>`;
const ARROW = `<defs>
<marker id="pa" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" class="mk"/></marker>
<marker id="pb" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" class="mk-w"/></marker>
<marker id="pc" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" class="mk-a"/></marker>
<marker id="tick" viewBox="0 0 2 10" refX="1" refY="5" markerWidth="2" markerHeight="10" orient="auto"><path d="M1 0V10" class="ln"/></marker>
<pattern id="ph" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0V7" class="hatch"/></pattern>
</defs>`;
const svg = (body, label) => `<svg viewBox="0 0 520 260" role="img" aria-label="${esc(label)}" class="pfig__svg">${ARROW}${body}</svg>`;
const MONTHS = 'JFMAMJJASOND'.split('');

// ---- 01 River flows: channel cross-section + annual hydrograph
const fig1 = (() => {
  const ground = 'M10 70 L60 72 L95 110 L120 170 L160 190 L210 192 L250 170 L275 120 L300 80 L330 78';
  const q = [185, 187, 188, 189, 189, 175, 110, 70, 95, 150, 175, 182];
  const hx = i => 362 + i * 12.4;
  return svg(`
<path d="${ground} L330 240 L10 240 Z" fill="url(#ph)" class="gd"/>
<path d="${ground}" class="ln" fill="none"/>
<path d="M86 100 L95 110 L120 170 L160 190 L210 192 L250 170 L275 120 L287 100 Z" class="w1"/>
<path d="M136 178 L160 190 L210 192 L235 178 Z" class="w2"/>
<path d="M60 100 H312" class="ln dash"/>${T(196, 94, '▽ MONSOON HFL')}
<path d="M120 178 H250" class="ln"/>${T(232, 214, '▽ SUMMER LOW FLOW')}
<path d="M86 52 H287" class="ln" marker-start="url(#tick)" marker-end="url(#tick)"/>${T(150, 46, 'W BANKFULL')}
<path d="M186 104 V188" class="ln" marker-start="url(#pa)" marker-end="url(#pa)"/>${T(192, 150, 'd')}
<circle cx="170" cy="186" r="1.6" class="dot"/><circle cx="178" cy="188" r="1.6" class="dot"/><circle cx="196" cy="189" r="1.6" class="dot"/><circle cx="204" cy="188" r="1.6" class="dot"/>
<path d="M190 190 L150 224" class="ln thin"/>${T(98, 234, 'SAND / SEDIMENT')}
${T(10, 254, 'SECTION A–A′ · NOT TO SCALE')}
<path d="M356 40 V196 H512" class="ln" fill="none"/>
${MONTHS.map((m, i) => `<path d="M${hx(i)} 196 V200" class="ln thin"/>${T(hx(i) - 3, 212, m)}`).join('')}
<path d="M${q.map((y, i) => `${hx(i)} ${y}`).join(' L')}" class="lq" fill="none"/>
<path d="M${hx(0)} 196 L${q.map((y, i) => `${hx(i)} ${y}`).join(' L')} L${hx(11)} 196 Z" class="w1"/>
${T(440, 64, 'PEAK · AUG')}${T(362, 168, 'LEAN SEASON')}
${T(356, 30, 'Q (m³/s) · INDICATIVE')}${T(400, 230, 'MONTH')}`, 'River cross-section with monsoon and summer water levels, and an annual discharge curve peaking in August');
})();

// ---- 02 Water infrastructure: schematic from dam to tap
const house = (x, y) => `<path d="M${x} ${y} l10 -9 l10 9 v10 h-20 z" class="ln fill-s"/>`;
const fig2 = svg(`
<path d="M10 205 C80 195 140 215 210 205 S360 195 510 205" class="lr" fill="none"/>${T(300, 226, 'RIVER')}
<path d="M40 205 L52 160 H74 L86 205 Z" class="ln fill-p"/>${T(54, 152, 'DAM')}
<path d="M10 175 H48" class="w1s"/>${T(10, 192, 'RESERVOIR')}
<path d="M80 168 H300" class="lw" marker-end="url(#pb)"/>${T(140, 160, 'CANAL · GRAVITY')}
<path d="M200 192 V214 M207 192 V214 M214 192 V214 M221 192 V214" class="ln"/><path d="M196 192 H225" class="ln"/>${T(186, 238, 'KT WEIR')}
<circle cx="330" cy="110" r="16" class="ln fill-p"/><path d="M322 126 L316 168 M338 126 L344 168" class="ln"/>${T(306, 86, 'ESR / TANK')}
<path d="M352 196 C352 150 340 140 330 128" class="ln dash" marker-end="url(#pa)"/>${T(356, 180, 'PUMPED')}
<path d="M346 110 H418" class="ln dash" marker-end="url(#pa)"/>${T(356, 104, 'PIPELINE')}
${house(424, 114)}${house(450, 114)}${house(476, 114)}${T(430, 140, 'TAPS')}
<path d="M486 125 V250" class="ln"/><path d="M482 250 H490" class="ln"/>${T(492, 246, 'BW')}
<path d="M420 250 H510" class="ln dash thin"/>${T(400, 258, 'AQUIFER')}
<rect x="418" y="40" width="34" height="16" class="ln fill-s"/><rect x="452" y="46" width="12" height="10" class="ln fill-s"/><circle cx="426" cy="58" r="3" class="ln fill-s"/><circle cx="456" cy="58" r="3" class="ln fill-s"/>
<path d="M440 64 V100" class="ln dot2" marker-end="url(#pa)"/>${T(380, 34, 'TANKER · SUMMER')}
<path d="M14 30 H40" class="lw"/>${T(46, 34, 'GRAVITY')}<path d="M110 30 H136" class="ln dash"/>${T(142, 34, 'PUMPED / PIPED')}<path d="M246 30 H272" class="ln dot2"/>${T(278, 34, 'SEASONAL')}
${T(10, 254, 'SCHEMATIC · NOT TO SCALE')}`, 'Schematic of water moving from a dam and canal, through a weir and village tank, to household taps, with a borewell and a summer tanker');

// ---- 03 Road infrastructure: plan view with flood detour
const fig3 = svg(`
<path d="M250 10 C230 70 290 120 262 170 S240 230 256 260" class="rv" fill="none"/>${T(270, 250, 'RIVER')}
<path d="M10 130 H510" class="ln dash thin"/>${T(12, 124, 'A')}${T(492, 124, 'A′')}
<path d="M10 40 C140 46 330 30 510 44" class="rd1" fill="none"/><path d="M10 40 C140 46 330 30 510 44" class="rd1i" fill="none"/>${T(14, 30, 'STATE HIGHWAY')}
<path d="M90 42 C100 110 110 160 120 220" class="rd2" fill="none"/>${T(124, 216, 'DISTRICT ROAD')}
<path d="M120 150 C180 150 220 156 258 154 C300 152 340 160 400 170" class="rd3" fill="none"/>
<rect x="246" y="146" width="22" height="16" class="hz"/>${T(222, 186, '⚠ CAUSEWAY')}${T(214, 198, 'SUBMERGES IN FLOOD')}
<rect x="250" y="36" width="16" height="14" class="ln fill-s"/>${T(274, 62, 'BRIDGE')}
<circle cx="120" cy="150" r="7" class="ln fill-p"/>${T(60, 168, 'VILLAGE')}
<circle cx="400" cy="170" r="5" class="ln fill-s"/>${T(410, 174, 'HAMLET')}
<rect x="96" y="76" width="14" height="14" class="ln fill-a"/>${T(114, 88, 'PHC')}
<rect x="440" y="48" width="14" height="14" class="ln fill-p"/>${T(424, 78, 'MARKET')}
<path d="M392 164 C330 150 280 156 130 152" class="la" fill="none" marker-end="url(#pc)"/>${T(300, 120, 'DRY: 4 km')}
<path d="M404 162 C420 110 410 60 300 50 C200 44 140 50 116 80" class="la dash" fill="none" marker-end="url(#pc)"/>${T(326, 92, 'FLOOD: 19 km')}
<path d="M14 236 H40" class="rd1"/>${T(46, 240, 'SH')}<path d="M70 236 H96" class="rd2"/>${T(102, 240, 'DR')}<path d="M126 236 H152" class="rd3"/>${T(158, 240, 'VILLAGE ROAD')}
${T(10, 256, 'PLAN · DISTANCES INDICATIVE')}<path d="M480 228 V208" class="ln" marker-end="url(#pa)"/>${T(476, 246, 'N')}`, 'Plan of roads around a river crossing, showing a short dry-season route over a causeway and a long detour by bridge when it floods');

// ---- 04 Settlements & farms: elevation profile with land use
const fig4 = svg(`
<path d="M40 60 V210 H510" class="ln" fill="none"/>
${[0, 1, 2, 3, 4].map(k => `<path d="M${60 + k * 110} 210 V214" class="ln thin"/>${T(56 + k * 110, 226, k + ' km')}`).join('')}
${T(4, 56, 'm asl')}${[80, 120, 160, 200].map((y, i) => `<path d="M36 ${y} H40" class="ln thin"/>${T(10, y + 3, String(560 - i * 20))}`).join('')}
<path d="M44 182 L60 196 L80 196 L94 180 L200 172 L300 140 L380 104 L510 96 L510 210 L44 210 Z" fill="url(#ph)" class="gd"/>
<path d="M44 182 L60 196 L80 196 L94 180 L200 172 L300 140 L380 104 L510 96" class="ln" fill="none"/>
<path d="M60 190 H80 L80 196 L60 196 Z" class="w2"/>${T(52, 176, 'RIVER')}
<circle cx="140" cy="168" r="3" class="ln fill-w"/>${T(124, 160, 'CANAL')}
${[110, 122, 134, 152, 164, 176].map(x => `<path d="M${x} ${176 - (x - 94) * 0.07} v-14" class="lg"/>`).join('')}
${house(222, 160)}${house(244, 156)}${house(266, 150)}${T(214, 136, 'VILLAGE CORE')}
${[310, 322, 334, 346].map(x => `<path d="M${x} ${142 - (x - 300) * 0.45} v-6" class="lg"/>`).join('')}
${house(430, 92)}${T(418, 76, 'SHEPHERD HAMLET')}
<rect x="94" y="234" width="110" height="10" class="lu1"/><rect x="204" y="234" width="176" height="10" class="lu2"/><rect x="380" y="234" width="130" height="10" class="lu3"/>
${T(96, 256, 'IRRIGATED')}${T(206, 256, 'RAIN-FED · JOWAR, PULSES')}${T(382, 256, 'GRAZING · SCRUB')}
${T(250, 30, 'PROFILE ALONG TRANSECT · V. EXAG. ×20')}`, 'Elevation profile from the river up the slope, with irrigated cane near the river, the village and rain-fed crops mid-slope, and grazing on the uplands');

// ---- 05 Industries & businesses: water draw/return and season of operation
const units = [['PROCESSING UNIT', 'in', 'out', [10, 11, 0, 1, 2, 3]], ['BRICK KILNS', 'in', null, [11, 0, 1, 2, 3, 4]], ['SAND MINING', null, 'bed', [9, 10, 11, 0, 1, 2, 3, 4]], ['DAIRY UNIT', 'in', 'out', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]]];
const fig5 = svg(`
${units.map(([n, a, b], i) => { const x = 20 + i * 124; return `<rect x="${x}" y="20" width="104" height="34" class="ln fill-p"/>${T(x + 6, 41, n)}
${a ? `<path d="M${x + 18} 104 V58" class="lw" marker-end="url(#pb)"/>${T(x + 22, 72, 'DRAW')}` : ''}
${b === 'out' ? `<path d="M${x + 88} 58 V104" class="la" marker-end="url(#pc)"/>${T(x + 34, 96, 'EFFLUENT')}` : ''}
${b === 'bed' ? `<path d="M${x + 30} 112 l12 12 h30 l12 -12" class="la" fill="none"/>${T(x + 22, 140, 'BED LOWERED')}` : ''}`; }).join('')}
<path d="M10 108 H510" class="lr"/>${T(470, 124, 'RIVER')}
${MONTHS.map((m, j) => T(150 + j * 30, 164, m)).join('')}
${units.map(([n, , , months], i) => `${T(10, 186 + i * 18, n)}${months.map(j => `<rect x="${146 + j * 30}" y="${177 + i * 18}" width="26" height="11" class="fill-a2"/>`).join('')}`).join('')}
${T(10, 256, 'OPERATING SEASON · INDICATIVE')}`, 'Four businesses drawing water from or returning effluent to the river, with a chart of the months each operates');

// ---- 06 Households: the household matrix of settings, and litres per person per day by season
const CELLS = [['FIELD', 'crops'], ['MARKET', 'buys water'], ['STORAGE', '600 L'], ['FETCHING', '2 h a day'], null, ['COOKING', '15 L'], ['WASHING', '40 L'], ['BATHING', '45 L'], ['LIVESTOCK', '60 L']];
const seasons = [['MONSOON', [['tap', 35], ['bw', 25]]], ['WINTER', [['tap', 22], ['bw', 20]]], ['SUMMER', [['bw', 8], ['tk', 12], ['wk', 6]]]];
const SC = { tap: 'b-tap', bw: 'b-bw', tk: 'b-tk', wk: 'b-wk' };
const matrix = (x0, y0, cw, ch) => CELLS.map((c, i) => {
  const x = x0 + (i % 3) * cw, y = y0 + Math.floor(i / 3) * ch;
  if (!c) return `<rect x="${x}" y="${y}" width="${cw}" height="${ch}" class="w1"/><rect x="${x}" y="${y}" width="${cw}" height="${ch}" class="ln"/><text x="${x + cw / 2}" y="${y + ch / 2 - 4}" text-anchor="middle" class="tb">HOUSEHOLD</text><text x="${x + cw / 2}" y="${y + ch / 2 + 10}" text-anchor="middle" class="tx" style="fill:var(--ink)">WATER</text>`;
  return `<rect x="${x}" y="${y}" width="${cw}" height="${ch}" class="ln fill-s"/>${T(x + 6, y + 15, c[0])}<text x="${x + 6}" y="${y + ch - 8}" class="tx" style="fill:var(--ink)">${c[1]}</text>`;
}).join('');
const fig6 = svg(`
${T(12, 22, 'MATRIX OF SETTINGS · ONE HOUSEHOLD')}
${matrix(12, 30, 70, 64)}
<path d="M250 30 V220 H510" class="ln" fill="none"/>
${[0, 20, 40, 60].map(v => `<path d="M246 ${220 - v * 2.6} H250" class="ln thin"/>${T(231, 224 - v * 2.6, String(v))}`).join('')}
${T(256, 24, 'LITRES / PERSON / DAY')}
<path d="M250 ${220 - 55 * 2.6} H510" class="la dash"/>${T(428, 210 - 55 * 2.6, '55 L NORM')}
${seasons.map(([n, parts], i) => { let y = 220; const x = 290 + i * 74; return parts.map(([k, v]) => { y -= v * 2.6; return `<rect x="${x}" y="${y}" width="42" height="${v * 2.6}" class="${SC[k]}"/>`; }).join('') + T(x - 4, 236, n) + T(x + 8, y - 6, String(parts.reduce((s, p) => s + p[1], 0)), 'tb'); }).join('')}
<rect x="256" y="244" width="10" height="10" class="b-tap"/>${T(270, 253, 'TAP')}<rect x="306" y="244" width="10" height="10" class="b-bw"/>${T(320, 253, 'BOREWELL')}<rect x="386" y="244" width="10" height="10" class="b-tk"/>${T(400, 253, 'TANKER')}<rect x="456" y="244" width="10" height="10" class="b-wk"/>${T(470, 253, 'WALK')}`, 'A household drawn as a matrix of settings around water (field, market, storage, fetching, cooking, washing, bathing, livestock), and a chart of litres per person per day falling below the norm in summer');

// ---- Transects: swaths cut across the river in each zone, linked through their households, and the parameter matrix
const SW = [[120, 'T1', 'HEADWATER ZONE'], [265, 'T2', 'MID SECTION'], [410, 'T3', 'TAIL-WATER ZONE']];
const RIVER = 'M10 40 C70 30 100 95 150 85 S240 45 280 85 S370 135 420 112 S490 95 510 118';
const swath = (x, tag) => `<g transform="rotate(-14 ${x} 80)"><rect x="${x - 26}" y="14" width="52" height="132" class="sw"/><rect x="${x - 26}" y="14" width="52" height="132" class="ln thin" fill="none"/><text x="${x}" y="28" text-anchor="middle" class="tb">${tag}</text></g>`;
const HH = [[112, 60], [128, 122], [262, 104], [252, 40], [404, 76], [420, 140]];
const PROWS = [['RIVER FLOWS', 'w2'], ['WATER INFRA', 'w2'], ['ROADS', 'w2'], ['SETTLEMENTS', 'b-bw'], ['INDUSTRIES', 'b-bw'], ['HOUSEHOLDS', 'b-tk']];
const fig7 = svg(`
<path d="M190 4 V150 M340 4 V150" class="ln dash thin"/>
<path d="${RIVER}" class="lr" fill="none"/>
${SW.map(([x, t]) => swath(x, t)).join('')}
<path d="M${HH.map(p => p.join(' ')).join(' L')}" class="lred" fill="none"/>
${HH.map(([x, y]) => `<rect x="${x - 4}" y="${y - 4}" width="8" height="8" class="hh"/>`).join('')}
<path d="M478 100 L506 116" class="lw" marker-end="url(#pb)"/>
${SW.map(([x, , z]) => `<text x="${x}" y="166" class="tx" text-anchor="middle">${z}</text>`).join('')}
<path d="M10 171 H510" class="ln thin"/>
${PROWS.map(([n, c], r) => `${T(10, 184 + r * 13, n)}${SW.map(([x]) => `<rect x="${x - 4}" y="${176 + r * 13}" width="8" height="8" class="${c}"/>`).join('')}`).join('')}`, 'Plan of a river with three transects cut across it as wide swaths, one in each of the headwater zone, mid section and tail-water zone, with households in each linked by a red line, and a grid of the six parameters recorded in every transect');

// ---- The archive: from field recording to a structured record to its outputs (Basin to Patterns)
const FIELDS = [['id', 'GA-RVA-0042'], ['valley', 'River A'], ['lat, long', 'from GPS'], ['zone', 'Mid section · T2'], ['narrator', 'Farmer, 54'], ['media', 'audio · photo · text'], ['hazard', 'Drought · step 3'], ['strategy', '#2 Neighbourhood'], ['consent', 'recorded ✓']];
const OUTS = [['VALLEY MAP', 'fill-p'], ['THE ARCHIVE', 'fill-p'], ['CSV · ANNEXURES', 'fill-p'], ['BOOKLETS · EXHIBITS', 'fill-a']];
const fig8 = svg(`
${T(10, 22, 'FIELD · PHASE II')}
${['AUDIO', 'PHOTO', 'TEXT'].map((n, i) => `<rect x="10" y="${40 + i * 50}" width="86" height="30" class="ln fill-p"/>${T(20, 59 + i * 50, n)}<path d="M96 ${55 + i * 50} C120 ${55 + i * 50} 130 117 150 117" class="ln" marker-end="url(#pa)" fill="none"/>`).join('')}
<rect x="152" y="30" width="208" height="${20 + FIELDS.length * 18}" class="ln fill-s"/>
<rect x="152" y="30" width="208" height="20" class="fill-a2"/><text x="160" y="44" class="tb" style="fill:#fff">STORY RECORD</text>
${FIELDS.map(([k, v], i) => `${T(160, 63 + i * 18, k)}<text x="226" y="${63 + i * 18}" class="tx" style="fill:var(--ink)">${v}</text>${i ? `<path d="M152 ${50 + i * 18} H360" class="ln thin" opacity=".35"/>` : ''}<path d="M220 50 V${50 + FIELDS.length * 18}" class="ln thin" opacity=".35"/>`).join('')}
${T(396, 22, 'BASIN TO PATTERNS · IV')}
${OUTS.map(([n, c], i) => `<path d="M360 117 C376 117 376 ${55 + i * 44} 394 ${55 + i * 44}" class="ln" marker-end="url(#pa)" fill="none"/><rect x="396" y="${40 + i * 44}" width="114" height="30" class="ln ${c}"/>${T(402, 59 + i * 44, n)}`).join('')}
${T(396, 228, 'ONLINE ↑ · OFFLINE ↓')}
${T(10, 254, 'ONE SCHEMA FOR EVERY VALLEY · SAMPLE RECORD')}`, 'Diagram of field recordings becoming one structured story record, which feeds the valley map, The Archive, a CSV and annexures, and printed booklets and exhibitions');

// ---- Phase I: the six parameters mapped as stacked GIS layers for one transect
const LAYERS = ['RIVER FLOWS', 'WATER INFRASTRUCTURE', 'ROAD INFRASTRUCTURE', 'SETTLEMENTS', 'INDUSTRIES', 'HOUSEHOLDS'];
const layer = (i) => { const y = 22 + i * 36, x = 40; return `<path d="M${x} ${y + 24} L${x + 60} ${y} H${x + 300} L${x + 240} ${y + 24} Z" class="ln ${i === 0 ? 'w1' : i === 5 ? 'fill-a' : 'fill-s'}" opacity="${i === 0 ? 1 : 0.95}"/>
${i === 0 ? `<path d="M${x + 40} ${y + 20} C${x + 110} ${y + 4} ${x + 160} ${y + 22} ${x + 270} ${y + 4}" class="lw" fill="none"/>` : ''}
${i === 1 ? `<path d="M${x + 90} ${y + 14} H${x + 230}" class="lw" fill="none"/><path d="M${x + 150} ${y + 8} v12" class="ln"/>` : ''}
${i === 2 ? `<path d="M${x + 60} ${y + 18} L${x + 280} ${y + 6}" class="rd2" fill="none"/>` : ''}
${i === 3 ? [0, 1, 2, 3].map(k => `<rect x="${x + 110 + k * 30}" y="${y + 8 + (k % 2) * 4}" width="10" height="8" class="ln fill-p"/>`).join('') : ''}
${i === 4 ? `<rect x="${x + 180}" y="${y + 6}" width="22" height="12" class="ln fill-p"/><path d="M${x + 196} ${y + 6} v-6" class="ln"/>` : ''}
${i === 5 ? `<rect x="${x + 150}" y="${y + 8}" width="10" height="10" class="hh"/>` : ''}
<path d="M${x + 300} ${y} H392" class="ln thin dash"/>${T(396, y + 4, LAYERS[i])}`; };
const figP1 = svg(`${LAYERS.map((_, i) => layer(i)).join('')}
<path d="M196 30 V216" class="lred dash"/>${T(40, 254, 'ONE TRANSECT · SIX PARAMETERS MAPPED AS GIS LAYERS · REPORT I')}`, 'Six parameter layers of one transect stacked above each other, from river flows at the top to households at the bottom, as mapped in GIS');

// ---- Phase II: fieldwork across the seasons, April to September, and the household matrix
const RAIN = [5, 3, 4, 10, 25, 120, 260, 230, 140, 60, 15, 6];
const figP2 = svg(`
${T(10, 20, 'RAINFALL · INDICATIVE')}
<rect x="${40 + 3 * 36}" y="26" width="${6 * 36}" height="134" class="sw"/>${T(40 + 3 * 36 + 6, 40, 'PHASE II · 6 MONTHS · FIELDWORK')}
${RAIN.map((r, i) => `<rect x="${44 + i * 36}" y="${150 - r * 0.42}" width="26" height="${r * 0.42}" class="w2"/>${T(51 + i * 36, 172, MONTHS[i])}`).join('')}
<path d="M40 150 H476" class="ln"/>
${[3, 5, 7, 8].map(i => `<path d="M${57 + i * 36} 152 v8" class="lred"/><circle cx="${57 + i * 36}" cy="164" r="0" />`).join('')}
${T(40, 194, 'DRY MONTHS ← → RAINS')}
${T(40, 210, 'RED TICKS: HOUSEHOLD VISITS')}
${matrix(400, 186, 36, 22).replace(/<text[^>]*>[^<]*<\/text>/g, '')}
${T(40, 250, 'ONE MATRIX FOR EVERY HOUSEHOLD →')}`, 'Monthly rainfall bars with the six fieldwork months, April to September, highlighted and household visits marked, and a small household matrix');

// ---- Phase III: effects traced top-down from river to household; coping traced bottom-up
const figP3 = svg(`
${LAYERS.map((n, i) => `<rect x="120" y="${16 + i * 36}" width="280" height="26" class="ln ${i === 5 ? 'fill-a' : 'fill-s'}"/>${T(132, 33 + i * 36, n)}`).join('')}
<path d="M90 24 V${16 + 5 * 36 + 13}" class="lred" marker-end="url(#pc)"/>${T(10, 120, 'EFFECTS')}${T(10, 132, 'TOP → DOWN')}
<path d="M430 ${16 + 5 * 36 + 13} V24" class="lw" marker-end="url(#pb)"/>${T(440, 120, 'COPING')}${T(440, 132, 'BOTTOM → UP')}
${[0, 1, 3, 5].map((i, k, a) => k ? `<path d="M${330 - (k - 1) * 40} ${29 + a[k - 1] * 36} L${330 - k * 40} ${29 + i * 36}" class="lred thin"/>` : '').join('')}
${[0, 1, 3, 5].map((i, k) => `<circle cx="${330 - k * 40}" cy="${29 + i * 36}" r="4" class="dotred"/>`).join('')}
${T(120, 254, 'HOUSEHOLD AS DATUM · INTRA- AND INTER-TRANSECT COMPARISON')}`, 'Six parameter layers from river flows down to the household, with effects of distress traced downward in red and coping mechanisms traced upward in blue');

// ---- Phase IV: patterns across transects and parameters, and the outputs
const PAT = [[2, 1, 0], [1, 2, 2], [0, 1, 2], [1, 1, 0], [0, 2, 1], [2, 2, 2]];
const figP4 = svg(`
${T(10, 20, 'PATTERN · DISTRESS BY PARAMETER AND TRANSECT')}
${['T1', 'T2', 'T3'].map((t, j) => `<text x="${150 + j * 46}" y="38" text-anchor="middle" class="tb">${t}</text>`).join('')}
${LAYERS.map((n, i) => `${T(10, 56 + i * 26, n.replace(' INFRASTRUCTURE', ' INFRA'))}${PAT[i].map((v, j) => `<rect x="${130 + j * 46}" y="${44 + i * 26}" width="40" height="20" class="pat${v}"/>`).join('')}`).join('')}
<path d="M280 120 H320" class="ln" marker-end="url(#pa)"/>
${[['ONLINE OVERVIEW', 'website · basin to home', 'fill-p'], ['OFFLINE OVERVIEW', 'booklets · exhibitions', 'fill-a'], ['ANNEXURES', 'matrix · monitoring', 'fill-s']].map(([a, b, c], i) => `<rect x="326" y="${44 + i * 54}" width="184" height="42" class="ln ${c}"/>${T(334, 62 + i * 54, a, 'tb')}<text x="334" y="${78 + i * 54}" class="tx">${b}</text>`).join('')}
<rect x="130" y="216" width="12" height="10" class="pat0"/>${T(146, 225, 'LOW')}<rect x="186" y="216" width="12" height="10" class="pat1"/>${T(202, 225, 'MEDIUM')}<rect x="258" y="216" width="12" height="10" class="pat2"/>${T(274, 225, 'HIGH')}
${T(10, 254, 'REPORT II · FROM UNDEFINED PROBLEMS TO ACTIONABLE STRATEGIES')}`, 'A grid of distress levels for six parameters across three transects, feeding an online overview, an offline overview and annexures');

const IN_STUDY = 'In the study';
export const PARAMS = [
  { key: 'river flows', title: 'River flows', fig: fig1, cap: 'Channel cross-section and annual discharge',
    def: 'How much water the river carries, when and how fast, across the seasons, and the sediment and landforms that flow shapes: channels, banks, sand bars and floodplains. It is the first layer of every transect.',
    ex: 'In one stretch the river can shrink to a chain of pools before the monsoon and spill over its banks after a storm or a dam release. The transect records both levels, the width and depth of the channel, and where sand collects or banks are cutting back.',
    study: 'Phase I. Hydrological and geomorphological data (flows, sediments and landforms) mapped in GIS across each transect, from published records and field visits.' },
  { key: 'water infrastructure', title: 'Water infrastructure', fig: fig2, cap: 'From dam to tap: storage, conveyance, delivery',
    def: 'The built systems that store, move, lift and deliver water, and who runs them: dams and reservoirs, canals, weirs and check dams, wells and borewells, village tanks, pipelines, taps and tankers.',
    ex: 'A village may irrigate its fields from a canal, hold water behind a small weir after the monsoon, fill an overhead tank for its taps from a pumped scheme, rely on private borewells, and still need a tanker in the dry months.',
    study: 'Phase I. Irrigation and water-supply projects, their records and history, mapped in GIS. Phase II then checks how each scheme actually reaches households.' },
  { key: 'road infrastructure', title: 'Road infrastructure', fig: fig3, cap: 'Plan view: routes, crossings and flood detours',
    def: 'Roads, tracks, bridges and causeways that decide how people, goods, tankers and services reach a place, and whether a place is cut off when the river rises.',
    ex: 'A low causeway puts a hamlet a short walk from the health centre for most of the year. When it floods, the only route is a long detour by the highway bridge, so a few kilometres become nearly twenty.',
    study: 'Phase I. Road and planning data mapped in GIS: which routes reach each settlement, in which seasons.' },
  { key: 'settlements and farms', title: 'Settlements & farms', fig: fig4, cap: 'Profile across the transect with land use',
    def: 'Where people live and what they grow, relative to the river, the slope and services: village cores, outlying hamlets, irrigated and rain-fed fields, orchards and grazing land.',
    ex: 'Along one transect: irrigated cash crops close to the river and the canal, the village core on the lower slope, rain-fed food crops higher up, and a herders\' hamlet on the uplands that no canal or pipeline reaches.',
    study: 'Phase I. Historic and current settlement data, land use, and planning policy, guidelines and bylaws, mapped in GIS.' },
  { key: 'industries and businesses', title: 'Industries & businesses', fig: fig5, cap: 'Water drawn and returned, and season of operation',
    def: 'Commercial and industrial activity that uses water or changes it: factories and processing units, sand mining, brick kilns, dairies, hotels and shops, and the work they offer local people.',
    ex: 'A processing factory draws water and discharges effluent in its working season; brick kilns on the banks run through the dry months; sand mining lowers the riverbed. Many of the same households earn wages there.',
    study: 'Phase I. Economic data of public and private organisations and manufacturing, and where each one draws and returns water.' },
  { key: 'households', title: 'Households', fig: fig6, cap: 'The household matrix, and daily water per person by season',
    def: 'The smallest unit of the study and its datum: every other parameter is read from here. Each household is documented as a matrix of its activities, routines, members, systems and settings, showing the part water plays in each, where distress shows and how the family copes.',
    ex: 'In the monsoon a family of five meets its needs from a tap and a borewell. By May the tap is dry and the borewell yields little; a tanker and a long walk make up the rest, well below a norm of 55 litres per person per day, and fetching water takes two hours a day.',
    study: 'Phase II. Households chosen in each transect by the type of water distress they face; ethnography, a photographic pilot, and documentation of every household with the matrix across the seasons.' }
];

const IDEAS = [
  { key: 'transects', title: 'Transects', fig: fig7, cap: 'Transects cut across a river in each of its zones',
    def: 'A transect is a visual technique that draws a swath through a landscape for analysis: a sectional sample of land. We cut transects across the river valley, abstract the systems that shape life along each one into six parameters, and overlay them to see how they relate. Transects are case studies chosen to cover the range of the valley, not a statistical sample.',
    ex: 'One transect might cross the rain-fed hills of the headwater zone, another a town and its irrigated fields in the mid section, and a third the drought-prone tail-water zone near the river\'s end. Each records the same six parameters, and the households in each are linked so their stories can be read together.',
    study: 'Phase I: the river basin is studied, transects are chosen by hydrological and geomorphological criteria, and each parameter is mapped in GIS. The method follows the transect drawings in Anthony Acciavatti\'s The Ganges Water Machine.' },
  PARAMS[5],
  { key: 'the archive', title: 'The archive', fig: fig8, cap: 'From the field to the record, and on to Basin to Patterns',
    def: 'The public record the project builds, and the "Basin to Patterns" overview it leads to. Every story is located by latitude and longitude, tied to its valley and transect, and linked to the hazard it responds to, the step in the chain of events, and the level (home, neighbourhood, wider region) at which people acted. Each valley uses the same structure, so valleys can be compared.',
    ex: 'A farmer describes how the village shares one borewell on a rota every summer. That interview becomes one record: a pin on the valley map, a row in The Archive, strategy 2 at neighbourhood level linked to Drought · step 3 "Drinking water runs short", a line in the CSV, and a page in the printed booklet in the regional language.',
    study: 'Phase IV: online, this website, from the whole basin down to single households; offline, booklets, mobile exhibitions, pamphlets and maps; and annexures that agencies and funders can use to monitor relief at household level. The aim is to move from undefined problems to actionable strategies, and from vulnerability to resilience.' }
];

const PHASES = [
  { key: 'transects', title: 'Phase I · Transects', fig: figP1, cap: 'Each transect\'s parameters mapped as layers', labels: ['Aim', 'What happens', 'Time and output'],
    def: 'Establish the transects as the context of the study, and understand the role of the river basin and of the settlements along it.',
    ex: 'A literature study of the river basin: its evolution, its place in culture, its policies and history of management and water distress. Transects are chosen by hydrological and geomorphological criteria, and flows, sediments and landforms are mapped in GIS. The six parameters are studied and mapped in each transect, ending in Report I, a context synopsis reviewed by mentors and peers.',
    study: 'About 2 months, ideally January to March, so fieldwork can begin before the dry season. Output: every transect mapped and described in detail.' },
  { key: 'household unit', title: 'Phase II · Household unit', fig: figP2, cap: 'Fieldwork through the dry season and the rains', labels: ['Aim', 'What happens', 'Time and output'],
    def: 'Understand the tangibility and nuances of water distress at its smallest unit, the household.',
    ex: 'A literature study of the communities and their history of water distress. Households are chosen in each transect by location and type of distress. Ethnography and hydrology record typical activities, routines, systems and settings; a photographic pilot follows water through daily life as a series of photographs. A documentation matrix is designed, and every household is documented with it.',
    study: 'About 6 months, April to September, to see the full range of distress from the dry months to the rains. Output: every household documented in the matrix and located in its mapped transect.' },
  { key: 'causal relationships', title: 'Phase III · Causal relationships', fig: figP3, cap: 'Effects traced down, coping traced up', labels: ['Aim', 'What happens', 'Time and output'],
    def: 'Trace cause and effect between the parameters, with the household as the datum, so distress can be explained rather than blamed on large, undefined causes.',
    ex: 'Within each transect the parameters are stacked in GIS to see their hierarchy. Coping in each household is measured as time, tools, materials and supply chains. The effects of distress are traced from the top down, from river flows to the household, and coping mechanisms from the bottom up. Transects are then compared parameter by parameter and household by household.',
    study: 'About 2 months after fieldwork, with peer review and feedback from participating households. Output: annotated maps and diagrams of causal relationships.' },
  { key: 'patterns', title: 'Phase IV · Patterns', fig: figP4, cap: 'Patterns across transects, and how they are shared', labels: ['Aim', 'What happens', 'Time and output'],
    def: 'Present every transect together as a pattern: a unified overview that makes causes visible, addresses the lack of transparency, and shows where relief can be targeted.',
    ex: 'Patterns are drawn across parameters and transects, with the household as datum, and written up in Report II. "Basin to Patterns" is shared online, on this website, from the whole basin to single households, and offline as booklets, mobile exhibitions, pamphlets and maps. Annexures of the matrix and comparisons let agencies and funders monitor relief.',
    study: 'Up to 4 months, with subject experts and creative professionals. Output: a shift from undefined problems to actionable strategies, and from capacity building to capacity realised.' }
];

const GROUPS = { param: { label: 'Transect parameter', items: PARAMS }, idea: { label: 'How we read a valley', items: IDEAS }, phase: { label: 'Four phases', items: PHASES } };

const norm = s => String(s || '').toLowerCase().replace(/&/g, 'and').replace(/^phase [ivx]+\s*·\s*/, '').replace(/\s+/g, ' ').trim();
// Reference to a popup as "group:index", or '' if the title is not a known idea.
// Looks in the preferred group first, then the other, unless strict.
export function paramRef(title, prefer = 'param', strict = false) {
  const t = norm(title), order = strict ? [prefer] : [prefer, ...Object.keys(GROUPS).filter(g => g !== prefer && g !== 'phase')];
  for (const g of order) { const i = GROUPS[g].items.findIndex(p => p.key === t); if (i >= 0) return `${g}:${i}`; }
  return '';
}
export const paramIndex = title => PARAMS.findIndex(p => p.key === norm(title));

// Popups written in Pages & design ("Popup" blocks) are registered per page and opened as "custom:<block id>".
const CUSTOM = new Map();
export function registerPopups(blocks) { CUSTOM.clear(); for (const b of blocks || []) if (b.type === 'popup') CUSTOM.set(b.id, b); }
// The custom popup a card, tag or phase item opens, matched by the "Opens from" names (or the popup's heading).
export function customRef(title) {
  const t = norm(title); if (!t) return '';
  for (const [id, b] of CUSTOM) { const names = String(b.opens_from || b.title || '').split(/[,\n]/).map(norm).filter(Boolean); if (names.includes(t)) return 'custom:' + id; }
  return '';
}

let dlg;
const mediaUrl = u => /^(https?:|data:)/i.test(u || '') ? u : siteUrl(u || '');
function mediaItem(m) {
  const u = esc(mediaUrl(m.url)), cap = m.caption ? `<figcaption>${esc(m.caption)}</figcaption>` : '';
  if (m.type === 'photo') return `<figure><img src="${u}" alt="${esc(m.caption || '')}" loading="lazy">${cap}</figure>`;
  if (m.type === 'audio') return `<figure><audio controls preload="none" src="${u}"></audio>${cap}</figure>`;
  const emb = videoEmbed(m.url);
  if (emb) return `<figure><iframe class="video-embed" src="${esc(emb)}" title="${esc(m.caption || 'Video')}" loading="lazy" allow="fullscreen; picture-in-picture; encrypted-media" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>${cap}</figure>`;
  return `<figure><video controls preload="metadata" src="${u}"></video>${cap}</figure>`;
}
function ensureDialog() {
  if (dlg) return;
  dlg = document.createElement('dialog');
  dlg.className = 'pmodal';
  dlg.setAttribute('aria-labelledby', 'pmodal-title');
  document.body.appendChild(dlg);
  dlg.addEventListener('click', e => {
    if (e.target === dlg || e.target.closest('[data-pclose]')) dlg.close();
    const go = e.target.closest('[data-pgo]');
    if (go) render(go.dataset.pgo);
    const act = e.target.closest('[data-paction]');
    if (act && infoAction) infoAction(act.dataset.paction);
  });
  dlg.addEventListener('close', () => dlg.querySelectorAll('video, audio').forEach(m => m.pause()));
}
// A popup built by a page itself (e.g. a river zone on the valley map). Buttons with data-paction call onAction(value).
let infoAction = null;
export function openInfo({ eyebrow = '', title = '', body = '', foot = '', onAction = null }) {
  ensureDialog(); infoAction = onAction;
  dlg.innerHTML = `<div class="pmodal__inner">${head(esc(eyebrow), esc(title))}<div class="pmodal__body">${body}</div>${foot ? `<footer class="pmodal__foot">${foot}</footer>` : ''}</div>`;
  if (!dlg.open) dlg.showModal();
  dlg.querySelector('.pmodal__x').focus();
}
export function openPopup(ref) { ensureDialog(); render(ref); if (!dlg.open) dlg.showModal(); }
const head = (eyebrow, title) => `<header class="pmodal__head"><div>${eyebrow ? `<span class="eyebrow">${eyebrow}</span>` : ''}<h2 class="display" id="pmodal-title">${title}</h2></div>
<button class="pmodal__x" data-pclose aria-label="Close">×</button></header>`;
function render(ref) {
  const [g, raw] = String(ref).split(':');
  if (g === 'custom') {
    const b = CUSTOM.get(raw); if (!b) return;
    const media = (b.media || []).filter(m => m.url);
    dlg.innerHTML = `<div class="pmodal__inner">${head(esc(b.eyebrow || ''), esc(b.title || ''))}
<div class="pmodal__body${media.length ? '' : ' pmodal__body--text'}"><div class="pmodal__text prose">${md(b.body || '')}</div>
${media.length ? `<div class="pmodal__media">${media.map(mediaItem).join('')}</div>` : ''}</div></div>`;
    dlg.querySelector('.pmodal__x').focus();
    return;
  }
  const G = GROUPS[g] || GROUPS.param, gk = GROUPS[g] ? g : 'param', items = G.items, n = items.length;
  const k = ((+raw % n) + n) % n, p = items[k], num = String(k + 1).padStart(2, '0'), prev = (k - 1 + n) % n, next = (k + 1) % n;
  const L = p.labels || ['Definition', 'Example', IN_STUDY];
  dlg.innerHTML = `<div class="pmodal__inner">${head(`${esc(G.label)} ${num} of ${String(n).padStart(2, '0')}`, esc(p.title))}
<div class="pmodal__body">
<div class="pmodal__text"><span class="label">${L[0]}</span><p>${esc(p.def)}</p><span class="label">${L[1]}</span><p>${esc(p.ex)}</p>${p.study ? `<span class="label">${L[2]}</span><p class="pmodal__study">${esc(p.study)}</p>` : ''}</div>
<figure class="pfig"><div class="pfig__frame">${p.fig}</div><figcaption><span>FIG. ${num}</span> ${esc(p.cap)} · illustrative, not to scale</figcaption></figure>
</div>
<footer class="pmodal__foot"><button class="btn btn--quiet btn--small" data-pgo="${gk}:${prev}">← ${esc(items[prev].title)}</button><button class="btn btn--quiet btn--small" data-pgo="${gk}:${next}">${esc(items[next].title)} →</button></footer>
</div>`;
  dlg.querySelector('.pmodal__x').focus();
}

export function wireParams(root = document) {
  root.addEventListener('click', e => {
    const b = e.target.closest('[data-param]');
    if (b) { e.preventDefault(); openPopup(b.dataset.param); return; }
    const a = e.target.closest('a[href^="#popup-"]');
    if (a) { const id = a.getAttribute('href').slice(7); if (CUSTOM.has(id)) { e.preventDefault(); openPopup('custom:' + id); } }
  });
}
