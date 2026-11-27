// The six transect parameters: definition, example and a technical diagram for each.
// Also Transects, Households and The archive as a second set ('How we read a valley').
// Used by the Tags (chips) and Cards blocks: any item whose title matches opens a popup.
import { esc } from './ui.js';

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
const units = [['SUGAR FACTORY', 'in', 'out', [10, 11, 0, 1, 2, 3]], ['BRICK KILNS', 'in', null, [11, 0, 1, 2, 3, 4]], ['SAND MINING', null, 'bed', [9, 10, 11, 0, 1, 2, 3, 4]], ['DAIRY UNIT', 'in', 'out', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]]];
const fig5 = svg(`
${units.map(([n, a, b], i) => { const x = 20 + i * 124; return `<rect x="${x}" y="20" width="104" height="34" class="ln fill-p"/>${T(x + 6, 41, n)}
${a ? `<path d="M${x + 18} 104 V58" class="lw" marker-end="url(#pb)"/>${T(x + 22, 72, 'DRAW')}` : ''}
${b === 'out' ? `<path d="M${x + 88} 58 V104" class="la" marker-end="url(#pc)"/>${T(x + 34, 96, 'EFFLUENT')}` : ''}
${b === 'bed' ? `<path d="M${x + 30} 112 l12 12 h30 l12 -12" class="la" fill="none"/>${T(x + 22, 140, 'BED LOWERED')}` : ''}`; }).join('')}
<path d="M10 108 H510" class="lr"/>${T(470, 124, 'RIVER')}
${MONTHS.map((m, j) => T(150 + j * 30, 164, m)).join('')}
${units.map(([n, , , months], i) => `${T(10, 186 + i * 18, n)}${months.map(j => `<rect x="${146 + j * 30}" y="${177 + i * 18}" width="26" height="11" class="fill-a2"/>`).join('')}`).join('')}
${T(10, 256, 'OPERATING SEASON · INDICATIVE')}`, 'Four businesses drawing water from or returning effluent to the river, with a chart of the months each operates');

// ---- 06 Households: sources and litres per person per day by season
const seasons = [['MONSOON', [['tap', 35], ['bw', 25]]], ['WINTER', [['tap', 22], ['bw', 20]]], ['SUMMER', [['bw', 8], ['tk', 12], ['wk', 6]]]];
const SC = { tap: 'b-tap', bw: 'b-bw', tk: 'b-tk', wk: 'b-wk' };
const fig6 = svg(`
<path d="M40 130 L95 90 L150 130 V200 H40 Z" class="ln fill-s"/><rect x="84" y="160" width="22" height="40" class="ln"/>${T(56, 220, 'HOUSEHOLD · 5')}
<path d="M10 70 H60 L82 110" class="ln" marker-end="url(#pa)" fill="none"/>${T(10, 62, 'TAP · ALT. DAYS')}
<path d="M196 70 H140 L118 108" class="ln dot2" marker-end="url(#pa)" fill="none"/>${T(150, 62, 'TANKER')}
<path d="M10 160 H38" class="ln" marker-end="url(#pa)"/>${T(6, 152, 'BW')}
<path d="M196 180 H152" class="ln dash" marker-end="url(#pa)"/>${T(160, 172, 'WALK')}${T(150, 196, '1.5 km · 2 h')}
<path d="M250 30 V220 H510" class="ln" fill="none"/>
${[0, 20, 40, 60].map(v => `<path d="M246 ${220 - v * 2.6} H250" class="ln thin"/>${T(226, 224 - v * 2.6, String(v))}`).join('')}
${T(256, 24, 'LITRES / PERSON / DAY')}
<path d="M250 ${220 - 55 * 2.6} H510" class="la dash"/>${T(428, 210 - 55 * 2.6, '55 lpcd NORM')}
${seasons.map(([n, parts], i) => { let y = 220; const x = 290 + i * 74; return parts.map(([k, v]) => { y -= v * 2.6; return `<rect x="${x}" y="${y}" width="42" height="${v * 2.6}" class="${SC[k]}"/>`; }).join('') + T(x - 4, 236, n) + T(x + 8, y - 6, String(parts.reduce((s, p) => s + p[1], 0)), 'tb'); }).join('')}
<rect x="256" y="244" width="10" height="10" class="b-tap"/>${T(270, 253, 'TAP')}<rect x="306" y="244" width="10" height="10" class="b-bw"/>${T(320, 253, 'BOREWELL')}<rect x="386" y="244" width="10" height="10" class="b-tk"/>${T(400, 253, 'TANKER')}<rect x="456" y="244" width="10" height="10" class="b-wk"/>${T(470, 253, 'WALK')}`, 'A household drawing water from a tap, borewell, tanker and a long walk, with a chart showing litres per person per day falling below the 55 litre norm in summer');


// ---- Transects: plan of a valley with transect lines, and the parameter matrix beneath
const TX = [130, 210, 290, 370, 450], top = x => 16 + (x - 10) * 0.06, bot = x => 106 + (x - 10) * 0.08;
const ZONES = ['GHATS', 'URBAN', 'MID', 'COMMAND', 'SEMI-ARID'];
const ROWS = [['FLOW', 'w2'], ['WATER INFRA', 'w2'], ['ROADS', 'w2'], ['SETTLEMENT', 'b-bw'], ['INDUSTRY', 'b-bw'], ['HOUSEHOLDS', 'b-tk']];
const fig7 = svg(`
<path d="M10 16 L510 46 M10 106 L510 146" class="la dash" fill="none"/>${T(330, 146, 'WATERSHED BOUNDARY')}
<path d="M10 50 C70 40 100 90 150 80 S230 50 270 85 S360 130 420 110 S480 100 506 120" class="lr" fill="none"/>
<path d="M470 104 L500 116" class="lw" marker-end="url(#pb)"/>${T(462, 96, 'FLOW')}
${TX.map((x, i) => `<path d="M${x} ${top(x)} V${bot(x)}" class="ln" marker-start="url(#tick)" marker-end="url(#tick)"/><text x="${x}" y="${top(x) - 6}" class="tb" text-anchor="middle">T${i + 1}</text>`).join('')}
${T(20, 140, 'PLAN · NOT TO SCALE')}
${ZONES.map((z, i) => `<text x="${TX[i]}" y="166" class="tx" text-anchor="middle">${z}</text>`).join('')}
<path d="M10 171 H510" class="ln thin"/>
${ROWS.map(([n, c], r) => `${T(10, 182 + r * 12, n)}${TX.map(x => `<rect x="${x - 4}" y="${175 + r * 12}" width="8" height="8" class="${c}"/>`).join('')}<path d="M10 ${185 + r * 12} H510" class="ln thin" opacity=".25"/>`).join('')}
${T(10, 256, 'SAME SIX PARAMETERS RECORDED AT EVERY TRANSECT')}`, 'Plan of a river valley with five transect lines cut across it from one watershed edge to the other, and a grid showing the same six parameters recorded at each');

// ---- The archive: from field recording to a structured record to its outputs
const FIELDS = [['id', 'GA-BHM-0042'], ['valley', 'Bhima'], ['lat, long', '18.52 N, 73.86 E'], ['zone', 'Mid-valley · T3'], ['narrator', 'Farmer, 54'], ['media', 'audio · photo · text'], ['hazard', 'Drought · step 3'], ['strategy', '#2 Neighbourhood'], ['consent', 'recorded ✓']];
const OUTS = ['VALLEY MAP PIN', 'ARCHIVE TABLE', 'CSV EXPORT', 'PRINTED KIT'];
const fig8 = svg(`
${T(10, 22, 'FIELD')}
${['AUDIO', 'PHOTO', 'TEXT'].map((n, i) => `<rect x="10" y="${40 + i * 50}" width="86" height="30" class="ln fill-p"/>${T(20, 59 + i * 50, n)}<path d="M96 ${55 + i * 50} C120 ${55 + i * 50} 130 117 150 117" class="ln" marker-end="url(#pa)" fill="none"/>`).join('')}
<rect x="152" y="30" width="208" height="${20 + FIELDS.length * 18}" class="ln fill-s"/>
<rect x="152" y="30" width="208" height="20" class="fill-a2"/><text x="160" y="44" class="tb" style="fill:#fff">STORY RECORD</text>
${FIELDS.map(([k, v], i) => `${T(160, 63 + i * 18, k)}<text x="226" y="${63 + i * 18}" class="tx" style="fill:var(--ink)">${v}</text>${i ? `<path d="M152 ${50 + i * 18} H360" class="ln thin" opacity=".35"/>` : ''}<path d="M220 50 V${50 + FIELDS.length * 18}" class="ln thin" opacity=".35"/>`).join('')}
${T(400, 22, 'OUTPUTS')}
${OUTS.map((n, i) => `<path d="M360 117 C376 117 376 ${55 + i * 44} 394 ${55 + i * 44}" class="ln" marker-end="url(#pa)" fill="none"/><rect x="396" y="${40 + i * 44}" width="114" height="30" class="ln ${i === 3 ? 'fill-a' : 'fill-p'}"/>${T(404, 59 + i * 44, n)}`).join('')}
${T(396, 228, 'REGIONAL LANGUAGES')}
${T(10, 254, 'ONE SCHEMA FOR EVERY VALLEY · SAMPLE RECORD')}`, 'Diagram of field recordings becoming one structured story record, which feeds a map pin, a row in The Archive, a CSV export and a printed kit');

export const PARAMS = [
  { key: 'river flows', title: 'River flows', fig: fig1, cap: 'Channel cross-section and annual discharge',
    def: 'How much water the river carries, when, and how fast, across the seasons: the lean summer flow and the monsoon flood. It also covers the sediment the river moves and the landforms it builds and erodes: sand bars, banks and floodplains.',
    ex: 'Below a large dam, the same stretch of river can shrink to a chain of pools in May and spill over its banks after heavy rain or a dam release in August. The transect records both levels, the width and depth of the channel, and where sand collects or banks are cutting back.' },
  { key: 'water infrastructure', title: 'Water infrastructure', fig: fig2, cap: 'From dam to tap: storage, conveyance, delivery',
    def: 'The built systems that store, move, lift and deliver water, and who runs them: dams and reservoirs, canals, weirs and check dams, wells and borewells, village tanks, pipelines, taps and tankers.',
    ex: 'A village may irrigate its fields from a canal, hold water behind a Kolhapur-type (KT) weir after the monsoon, fill an overhead tank from a pumped scheme for its taps, rely on private borewells, and still need a tanker in summer.' },
  { key: 'road infrastructure', title: 'Road infrastructure', fig: fig3, cap: 'Plan view: routes, crossings and flood detours',
    def: 'Roads, tracks, bridges and causeways that decide how people, goods, tankers and services reach a place, and whether a place is cut off when the river rises.',
    ex: 'A low causeway puts a hamlet a short walk from the health centre for most of the year. When it floods, the only route is a long detour by the highway bridge, so a few kilometres become nearly twenty.' },
  { key: 'settlements and farms', title: 'Settlements & farms', fig: fig4, cap: 'Profile across the transect with land use',
    def: 'Where people live and what they grow, relative to the river, the slope and services: village cores, outlying hamlets, irrigated and rain-fed fields, orchards and grazing land.',
    ex: 'Along one transect: irrigated sugarcane close to the river and the canal, the village core on the lower slope, rain-fed jowar and pulses higher up, and a shepherd hamlet on the uplands that no canal or pipeline reaches.' },
  { key: 'industries and businesses', title: 'Industries & businesses', fig: fig5, cap: 'Water drawn and returned, and season of operation',
    def: 'Commercial and industrial activity that uses water or changes it: factories and processing units, sand mining, brick kilns, dairies, hotels and shops, and the work they offer local people.',
    ex: 'A cooperative sugar factory draws water and discharges effluent during the crushing season; brick kilns on the banks run through the dry months; sand mining lowers the riverbed. Many of the same households earn wages there.' },
  { key: 'households', title: 'Households', fig: fig6, cap: 'Sources and daily water per person by season',
    def: 'The family home: the unit of analysis. For each household we record where its water comes from, how much it gets, what it costs in money and time, who fetches it, and how the family copes when supply fails.',
    ex: 'In the monsoon a family of five meets its needs from a tap and a borewell. By May the tap is dry, the borewell yields little, and a tanker and a long walk make up the rest, well below the Jal Jeevan Mission norm of 55 litres per person per day.' }
];

const IDEAS = [
  { key: 'transects', title: 'Transects', fig: fig7, cap: 'Transect lines across a valley and what each records',
    def: 'A transect is a line cut across the valley at a chosen point along the river, from one edge of the watershed to the other. At every transect we record the same six parameters, so places upstream and downstream can be compared side by side. Transects are case studies picked to cover the range of the valley, not a statistical sample.',
    ex: 'In the Bhima valley, one transect might cross the rain-fed Ghats near the source, another the urban stretch near Pune, another the irrigated command area below a dam, and another the drought-prone semi-arid stretch near Solapur. Each one records river flows, water and roads, settlements and farms, industries, and households.' },
  PARAMS[5],
  { key: 'the archive', title: 'The archive', fig: fig8, cap: 'From the field to the record to its outputs',
    def: 'The public record the project builds. Every story is located by latitude and longitude, tied to its valley and transect, and linked to the hazard it responds to, the step in the chain of events, and the level (home, neighbourhood, wider region) at which people acted. Each valley uses the same structure, so the archive can be repeated and compared.',
    ex: 'A farmer describes how the village shares one borewell on a rota every summer. That interview becomes one record: a pin on the valley map, a row in The Archive, strategy 2 at neighbourhood level linked to Drought · step 3 "Drinking water runs short", a line in the CSV, and a page in the printed kit in the regional language.' }
];
const GROUPS = { param: { label: 'Transect parameter', items: PARAMS }, idea: { label: 'How we read a valley', items: IDEAS } };

const norm = s => String(s || '').toLowerCase().replace(/&/g, 'and').replace(/\s+/g, ' ').trim();
// Reference to a popup as "group:index", or '' if the title is not a known idea.
// Looks in the preferred group first, then the other, unless strict.
export function paramRef(title, prefer = 'param', strict = false) {
  const t = norm(title), order = strict ? [prefer] : [prefer, ...Object.keys(GROUPS).filter(g => g !== prefer)];
  for (const g of order) { const i = GROUPS[g].items.findIndex(p => p.key === t); if (i >= 0) return `${g}:${i}`; }
  return '';
}
export const paramIndex = title => PARAMS.findIndex(p => p.key === norm(title));

let dlg;
function open(ref) {
  if (!dlg) {
    dlg = document.createElement('dialog');
    dlg.className = 'pmodal';
    dlg.setAttribute('aria-labelledby', 'pmodal-title');
    document.body.appendChild(dlg);
    dlg.addEventListener('click', e => {
      if (e.target === dlg || e.target.closest('[data-pclose]')) dlg.close();
      const go = e.target.closest('[data-pgo]');
      if (go) render(go.dataset.pgo);
    });
  }
  render(ref);
  if (!dlg.open) dlg.showModal();
}
function render(ref) {
  const [g, raw] = String(ref).split(':'), G = GROUPS[g] || GROUPS.param, items = G.items, n = items.length;
  const k = ((+raw % n) + n) % n, p = items[k], num = String(k + 1).padStart(2, '0'), prev = (k - 1 + n) % n, next = (k + 1) % n;
  const gk = GROUPS[g] ? g : 'param';
  dlg.innerHTML = `<div class="pmodal__inner">
<header class="pmodal__head"><div><span class="eyebrow">${esc(G.label)} ${num} of ${String(n).padStart(2, '0')}</span><h2 class="display" id="pmodal-title">${esc(p.title)}</h2></div>
<button class="pmodal__x" data-pclose aria-label="Close">×</button></header>
<div class="pmodal__body">
<div class="pmodal__text"><span class="label">Definition</span><p>${esc(p.def)}</p><span class="label">Example</span><p>${esc(p.ex)}</p></div>
<figure class="pfig"><div class="pfig__frame">${p.fig}</div><figcaption><span>FIG. ${num}</span> ${esc(p.cap)} · illustrative, not to scale</figcaption></figure>
</div>
<footer class="pmodal__foot"><button class="btn btn--quiet btn--small" data-pgo="${gk}:${prev}">← ${esc(items[prev].title)}</button><button class="btn btn--quiet btn--small" data-pgo="${gk}:${next}">${esc(items[next].title)} →</button></footer>
</div>`;
  dlg.querySelector('.pmodal__x').focus();
}

export function wireParams(root = document) {
  root.addEventListener('click', e => {
    const b = e.target.closest('[data-param]');
    if (b) { e.preventDefault(); open(b.dataset.param); }
  });
}
