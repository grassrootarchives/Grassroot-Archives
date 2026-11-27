// Map styles: colours, filters and symbol drawings for contour, watercolour and miniature.

const MONO = "'IBM Plex Mono', ui-monospace, Menlo, monospace";
const SERIF = "'Newsreader', Georgia, serif";
const INK = '#1E2A33', BR = '#2A1A10';

const ALIASES = {
  'kt weir': 'kt_weir', 'kt-weir': 'kt_weir', 'kolhapur weir': 'kt_weir', 'barrage': 'weir',
  'check dam': 'check_dam', 'check-dam': 'check_dam', 'bandhara': 'check_dam',
  'bore well': 'borewell', 'bore-well': 'borewell', 'tube well': 'borewell', 'tubewell': 'borewell', 'handpump': 'borewell',
  'jack well': 'jack_well', 'jackwell': 'jack_well', 'intake': 'jack_well', 'intake well': 'jack_well',
  'pump house': 'pump_house', 'pumphouse': 'pump_house', 'pump': 'pump_house', 'lift pump': 'pump_house', 'lift irrigation': 'pump_house',
  'pond': 'tank', 'lake': 'reservoir', 'hamlet': 'village', 'wadi': 'village', 'city': 'city', 'town': 'town', 'village': 'village'
};
export function normaliseType(t) {
  if (!t) return '';
  const s = String(t).trim().toLowerCase().replace(/_/g, ' ');
  return ALIASES[s] || s.replace(/\s+/g, '_');
}
export const SETTLEMENT_TYPES = ['village', 'town', 'city'];
export const INFRA_TYPES = ['dam', 'weir', 'kt_weir', 'check_dam', 'well', 'borewell', 'jack_well', 'pump_house', 'tank', 'reservoir', 'canal', 'pipeline'];
const TYPE_LABEL = { dam: 'Dam', weir: 'Weir', kt_weir: 'KT weir', check_dam: 'Check dam', well: 'Well', borewell: 'Borewell', jack_well: 'Jack well', pump_house: 'Pump house', tank: 'Tank', reservoir: 'Reservoir', canal: 'Canal', pipeline: 'Pipeline' };

const WC_FILTERS = `
<filter id="wc" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="3" seed="4" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="14" xChannelSelector="R" yChannelSelector="G" result="d"/><feGaussianBlur in="d" stdDeviation="1.2"/></filter>
<filter id="wcedge" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="2" seed="9" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="12" xChannelSelector="R" yChannelSelector="G" result="d"/><feGaussianBlur in="d" stdDeviation="0.7"/></filter>
<filter id="wcbleed" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="2" seed="5" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="10" xChannelSelector="R" yChannelSelector="G" result="d"/><feGaussianBlur in="d" stdDeviation="4"/></filter>
<filter id="wcsoft" x="-30%" y="-30%" width="160%" height="160%"><feTurbulence type="fractalNoise" baseFrequency="0.08" numOctaves="2" seed="3" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="3" xChannelSelector="R" yChannelSelector="G" result="d"/><feGaussianBlur in="d" stdDeviation="0.5"/></filter>
<filter id="wcblur"><feGaussianBlur stdDeviation="5"/></filter>`;
const MN_DEFS = `
<pattern id="mnripple" width="22" height="10" patternUnits="userSpaceOnUse"><path d="M0 6 q5.5 -5 11 0 t11 0" fill="none" stroke="#E8EEF8" stroke-width="1.1"/></pattern>
<pattern id="mndots" width="9" height="9" patternUnits="userSpaceOnUse"><circle cx="4.5" cy="4.5" r="0.9" fill="#3B2A1A" fill-opacity="0.25"/></pattern>`;

const mnTree = (x, y, s, cypress) => cypress
  ? `<g transform="translate(${x.toFixed(0)} ${y.toFixed(0)}) scale(${s.toFixed(2)})"><path d="M0 8 V0" stroke="#3B2A1A" stroke-width="1.4"/><path d="M0 -12 C5 -6 5 2 0 4 C-5 2 -5 -6 0 -12Z" fill="#2F5A2E" stroke="#1C2E1A" stroke-width="0.8"/></g>`
  : `<g transform="translate(${x.toFixed(0)} ${y.toFixed(0)}) scale(${s.toFixed(2)})"><path d="M0 8 V1" stroke="#3B2A1A" stroke-width="1.4"/><circle cx="0" cy="-4" r="6.5" fill="#3C6B34" stroke="#1C2E1A" stroke-width="0.8"/><circle cx="-2" cy="-6" r="1.2" fill="#E3D27A"/><circle cx="2.5" cy="-3" r="1" fill="#E3D27A"/></g>`;

export const STYLES = {
  contour: {
    name: 'Contour survey', ground: '#F5F8F6',
    lines: { minor: { color: '#B7D5C0', width: 0.7 }, major: { color: '#7FB08F', width: 1.2 } },
    boundary: { color: '#D97F78', width: 1, dash: '6 5', opacity: 0.8 },
    river: d => `<path d="${d}" fill="none" stroke="#5E95BE" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`,
    canal: d => `<path d="${d}" fill="none" stroke="#5E95BE" stroke-width="1.6"/><path d="${d}" fill="none" stroke="#5E95BE" stroke-width="6" stroke-dasharray="1 9"/>`,
    pipeline: d => `<path d="${d}" fill="none" stroke="#C0504A" stroke-width="1.2" stroke-dasharray="4 3"/>`,
    reservoir: d => `<path d="${d}" fill="#9CC3E0" fill-opacity="0.6" stroke="#5E95BE"/>`,
    typeLabel: t => (TYPE_LABEL[t] || t).toUpperCase(),
    labelWidth: t => t.length * 6.4 + 6,
    label: (x, y, t) => `<text x="${x.toFixed(0)}" y="${y.toFixed(0)}" text-anchor="middle" font-family="${MONO}" font-size="10" letter-spacing="0.8" fill="#33424B" paint-order="stroke" stroke="#F5F8F6" stroke-width="3">${t.toUpperCase()}</text>`
  },
  watercolor: {
    name: 'Watercolour', ground: '#F7F3EA', defs: WC_FILTERS,
    bands: ['#BFDCE6', '#C8E2CF', '#D6E8C4', '#E3EBC2', '#EDE6C0', '#F0DCC2', '#EBCFC8', '#DCC6D6', '#CFC3DE'],
    bandOpacity: 0.85, bandFilter: 'wc', bandEdge: { filter: 'wcedge', color: '#8E8A7A', opacity: 0.22, width: 1.6 },
    lines: { step: 40, minor: { color: '#7C7A6E', width: 0.5, opacity: 0.18 }, major: { color: '#7C7A6E', width: 0.6, opacity: 0.22 } },
    boundary: null,
    river: d => `<path d="${d}" fill="none" stroke="#7FB3D5" stroke-opacity="0.55" stroke-width="20" stroke-linecap="round" filter="url(#wcbleed)"/><path d="${d}" fill="none" stroke="#4F8DBA" stroke-opacity="0.85" stroke-width="3" stroke-linecap="round" filter="url(#wcedge)"/>`,
    canal: d => `<path d="${d}" fill="none" stroke="#6FA8CF" stroke-opacity="0.7" stroke-width="3" filter="url(#wcsoft)"/>`,
    pipeline: d => `<path d="${d}" fill="none" stroke="#B9806E" stroke-width="1.4" stroke-dasharray="3 4" stroke-opacity="0.8"/>`,
    reservoir: d => `<path d="${d}" fill="#7FB3D5" fill-opacity="0.55" filter="url(#wcblur)"/><path d="${d}" fill="#9CC6E2" fill-opacity="0.5" filter="url(#wcsoft)"/>`,
    typeLabel: t => TYPE_LABEL[t] || t,
    labelWidth: t => t.length * 6.2 + 6,
    label: (x, y, t) => `<text x="${x.toFixed(0)}" y="${y.toFixed(0)}" text-anchor="middle" font-family="${SERIF}" font-style="italic" font-size="12.5" fill="#5A4A44" paint-order="stroke" stroke="#F7F3EA" stroke-width="2.5">${t}</text>`
  },
  miniature: {
    name: 'Miniature painting', ground: '#EFDFB4', defs: MN_DEFS,
    bands: ['#B9C97A', '#A3BE6A', '#8DB05C', '#76A052', '#C7A86A', '#B98F5E', '#A97C66', '#9C7A8C', '#8C7AA0'],
    bandStroke: '#3B2A1A', bandStrokeWidth: 0.9, upperPattern: 'mndots',
    lines: null, boundary: null,
    decor: { fields: ['#D9C46A', '#C9D27A', '#E3CF85', '#B5C66B'], tree: mnTree },
    river: d => `<path d="${d}" fill="none" stroke="${BR}" stroke-width="15" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="#2E5EA8" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="#E8EEF8" stroke-width="1.2" stroke-dasharray="5 7" transform="translate(0,-3)"/><path d="${d}" fill="none" stroke="#E8EEF8" stroke-width="1.2" stroke-dasharray="4 9" stroke-dashoffset="6" transform="translate(0,3)"/>`,
    canal: d => `<path d="${d}" fill="none" stroke="${BR}" stroke-width="6"/><path d="${d}" fill="none" stroke="#3D74C2" stroke-width="4"/>`,
    pipeline: d => `<path d="${d}" fill="none" stroke="#7A4A2A" stroke-width="2" stroke-dasharray="2 3"/>`,
    reservoir: d => `<path d="${d}" fill="#2E5EA8" stroke="${BR}" stroke-width="1.2"/><path d="${d}" fill="url(#mnripple)"/>`,
    typeLabel: t => TYPE_LABEL[t] || t,
    labelWidth: t => t.length * 7 + 14,
    label: (x, y, t, w) => `<rect x="${(x - w / 2).toFixed(0)}" y="${(y - 12).toFixed(0)}" width="${w.toFixed(0)}" height="17" rx="2" fill="#F3E6C4" stroke="#9E2A2B" stroke-width="1"/><text x="${x.toFixed(0)}" y="${(y + 1).toFixed(0)}" text-anchor="middle" font-family="${SERIF}" font-size="11.5" fill="#5A1E1A">${t}</text>`
  }
};

// ---------- settlements ----------
const hut = (x, y, s, roof) => `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${s})"><rect x="-6" y="-2" width="12" height="9" fill="#F3E6C4" stroke="${BR}" stroke-width="0.9"/><path d="M-8 -1 L0 -9 L8 -1Z" fill="${roof}" stroke="${BR}" stroke-width="0.9"/><rect x="-1.5" y="2" width="3" height="5" fill="${BR}"/></g>`;
const temple = (x, y) => `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><rect x="-9" y="-2" width="18" height="12" fill="#F6EED6" stroke="${BR}"/><path d="M-6 -2 C-6 -12 -2 -16 0 -20 C2 -16 6 -12 6 -2Z" fill="#F6EED6" stroke="${BR}"/><path d="M0 -20 V-27" stroke="${BR}"/><path d="M0 -27 L7 -24.5 L0 -22Z" fill="#D9452F" stroke="${BR}" stroke-width="0.6"/><path d="M-3 10 V3 A3 3 0 0 1 3 3 V10" fill="${BR}"/></g>`;
function hash(str) { let h = 2166136261; for (const c of String(str)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }

export function settlementSymbol(style, type, x, y, name) {
  const big = type === 'town' || type === 'city';
  if (style === 'contour') {
    return big
      ? `<rect x="${x - 7}" y="${y - 7}" width="14" height="14" fill="#fff" stroke="${INK}" stroke-width="1.4"/><rect x="${x - 3.5}" y="${y - 3.5}" width="7" height="7" fill="${INK}"/>`
      : `<rect x="${x - 4.5}" y="${y - 4.5}" width="9" height="9" fill="#fff" stroke="${INK}" stroke-width="1.3"/>`;
  }
  if (style === 'watercolor') {
    let s = hash(name || `${x},${y}`); const r = () => ((s = Math.imul(s ^ s >>> 15, 2246822519) >>> 0) / 4294967296);
    const rad = big ? 20 : 12, n = big ? 14 : 7, cols = ['#C9705A', '#B8654F', '#A9A39A', '#D08A6E'];
    let g = `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${rad + 8}" fill="#E7B8A3" fill-opacity="0.35" filter="url(#wcblur)"/><g filter="url(#wcsoft)">`;
    for (let i = 0; i < n; i++) {
      const hx = x + (r() - 0.5) * rad * 1.1, hy = y + (r() - 0.5) * rad, w = 5 + r() * 4, h = 4 + r() * 3;
      g += `<rect x="${hx.toFixed(1)}" y="${hy.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" fill="${cols[i % 4]}" fill-opacity="0.8" transform="rotate(${(r() * 40 - 20).toFixed(0)} ${hx.toFixed(0)} ${hy.toFixed(0)})"/>`;
    }
    return g + '</g>';
  }
  // miniature
  const roofs = ['#B3262C', '#C46A2B', '#8C3B5C'];
  if (big) return temple(x, y) + [[-20, 6], [19, 5], [-11, 18], [12, 19]].map(([dx, dy], i) => hut(x + dx, y + dy, 0.9, roofs[i % 2])).join('');
  return [[-8, 0], [8, 2], [0, 12]].map(([dx, dy], i) => hut(x + dx, y + dy, 0.8, roofs[(hash(name) + i) % 3])).join('');
}

// ---------- water infrastructure ----------
// Dams and weirs are drawn smaller on the map so they don't crowd the river; legends pass k = 1.
export const INFRA_SCALE = { dam: 0.6, weir: 0.65, kt_weir: 0.65, check_dam: 0.75 };
export function infraSymbol(style, type, x, y, angle = 0, k = INFRA_SCALE[type] || 1) {
  const sc = k === 1 ? '' : ` scale(${k})`;
  const at = inner => `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})${sc}">${inner}</g>`;
  const rot = inner => `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${angle.toFixed(0)})${sc}">${inner}</g>`;
  if (style === 'contour') {
    switch (type) {
      case 'dam': return rot(`<path d="M-16 0 h32" stroke="${INK}" stroke-width="7"/>`);
      case 'weir': case 'kt_weir': return rot(`<path d="M-10 -2.5 h20 M-10 2.5 h20" stroke="${INK}" stroke-width="2"/>`);
      case 'check_dam': return at(`<path d="M-7 0 h14" stroke="${INK}" stroke-width="3"/><path d="M-7 -4 v8 M7 -4 v8" stroke="${INK}"/>`);
      case 'well': case 'borewell': return at(`<circle r="3.2" fill="#fff" stroke="#5E95BE" stroke-width="1.3"/><circle r="1" fill="#5E95BE"/>`);
      case 'jack_well': return at(`<circle r="6" fill="#fff" stroke="${INK}" stroke-width="1.3"/><path d="M-4 0 h8 M0 -4 v8" stroke="${INK}" stroke-width="1.2"/>`);
      case 'pump_house': return at(`<path d="M0 -7 l7 12 h-14z" fill="#fff" stroke="${INK}" stroke-width="1.3"/>`);
      case 'tank': case 'reservoir': return at(`<ellipse rx="8" ry="5" fill="#9CC3E0" stroke="#5E95BE"/>`);
      default: return at(`<circle r="3.5" fill="${INK}"/>`);
    }
  }
  if (style === 'watercolor') {
    switch (type) {
      case 'dam': return rot(`<rect x="-16" y="-4" width="32" height="8" fill="#8A8378" filter="url(#wcsoft)"/>`);
      case 'weir': case 'kt_weir': return rot(`<rect x="-11" y="-2" width="22" height="4" fill="#9A9184" filter="url(#wcsoft)"/>`);
      case 'check_dam': return at(`<rect x="-7" y="-1.5" width="14" height="3" fill="#9A9184" filter="url(#wcsoft)"/>`);
      case 'well': case 'borewell': return at(`<circle r="3.5" fill="#6FA8CF" fill-opacity="0.7" stroke="#7A7268" stroke-width="0.8" filter="url(#wcsoft)"/>`);
      case 'jack_well': return at(`<circle r="6.5" fill="#CFC6B8" stroke="#7A7268" stroke-width="1.2" filter="url(#wcsoft)"/>`);
      case 'pump_house': return at(`<rect x="-7" y="-5" width="14" height="10" fill="#C9A28E" stroke="#7A6258" filter="url(#wcsoft)"/>`);
      case 'tank': case 'reservoir': return at(`<ellipse rx="9" ry="5" fill="#9CC6E2" fill-opacity="0.7" filter="url(#wcsoft)"/>`);
      default: return at(`<circle r="3.5" fill="#7A7268" filter="url(#wcsoft)"/>`);
    }
  }
  switch (type) {
    case 'dam': return rot(`<rect x="-20" y="-6" width="40" height="12" fill="#D9CBA6" stroke="${BR}" stroke-width="1"/>${[0, 1, 2, 3].map(i => `<path d="M${-16 + i * 8},5 v-3 a3 3 0 0 1 6 0 v3" fill="${BR}"/>`).join('')}<path d="M-20,-6 h40" stroke="#9E2A2B" stroke-width="2"/>`);
    case 'weir': case 'kt_weir': return rot(`<rect x="-11" y="-3" width="22" height="6" fill="#D9CBA6" stroke="${BR}" stroke-width="0.9"/><path d="M-7,-3 v6 M-2,-3 v6 M3,-3 v6 M8,-3 v6" stroke="${BR}" stroke-width="0.7"/>`);
    case 'check_dam': return at(`<rect x="-8" y="-3" width="16" height="6" fill="#D9CBA6" stroke="${BR}" stroke-width="0.9"/>`);
    case 'well': case 'borewell': return at(`<circle r="4.5" fill="#D9CBA6" stroke="${BR}" stroke-width="0.9"/><circle r="2.3" fill="#2E5EA8"/>`);
    case 'jack_well': return at(`<rect x="-5" y="-12" width="10" height="16" fill="#F3E6C4" stroke="${BR}" stroke-width="0.9"/><path d="M-6,-12 h12 l-6,-6z" fill="#B3262C" stroke="${BR}" stroke-width="0.8"/>`);
    case 'pump_house': return at(`<rect x="-8" y="-6" width="16" height="11" fill="#F3E6C4" stroke="${BR}" stroke-width="0.9"/><path d="M-9,-6 h18 l-3,-5 h-12z" fill="#C46A2B" stroke="${BR}" stroke-width="0.8"/><circle cx="0" cy="0" r="2.5" fill="#2E5EA8"/>`);
    case 'tank': case 'reservoir': return at(`<ellipse rx="10" ry="6" fill="#2E5EA8" stroke="${BR}"/><ellipse rx="10" ry="6" fill="url(#mnripple)"/>`);
    default: return at(`<circle r="4" fill="#D9CBA6" stroke="${BR}"/>`);
  }
}
