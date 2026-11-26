// Interactive legend: symbols drawn in the active map style, each with an on/off switch.
import { STYLES, settlementSymbol, infraSymbol, normaliseType } from './symbols.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Several data types share one legend entry.
export function legendKey(t) {
  t = normaliseType(t);
  return ({ kt_weir: 'weir', borewell: 'well', tank: 'reservoir', city: 'town' })[t] || t || 'village';
}
const LABELS = { contours: 'Contour lines', decor: 'Trees & fields', river: 'River', boundary: 'Watershed boundary', reservoir: 'Reservoir / tank', village: 'Village', town: 'Town', dam: 'Dam', weir: 'Weir / KT weir', check_dam: 'Check dam', well: 'Well / borewell', jack_well: 'Jack well', pump_house: 'Pump house', canal: 'Canal', pipeline: 'Pipeline', pins: 'Story pins' };
const ORDER = ['dam', 'weir', 'check_dam', 'well', 'jack_well', 'pump_house', 'reservoir', 'canal', 'pipeline'];
const LINE = 'M-14,3 q7,-7 14,-3 t14,-3';

function icon(style, key, interval) {
  const st = STYLES[style];
  let g = '';
  switch (key) {
    case 'contours':
      g = style === 'contour'
        ? `<path d="M-15,-3 q7,-5 15,0 t15,0" fill="none" stroke="${st.lines.minor.color}" stroke-width="0.9"/><path d="M-15,4 q7,-5 15,0 t15,0" fill="none" stroke="${st.lines.major.color}" stroke-width="1.5"/>`
        : `<g opacity="0.9">${st.bands.slice(0, 5).map((c, i) => `<rect x="${-15 + i * 6}" y="-6" width="6" height="12" fill="${c}"/>`).join('')}</g><path d="M-15,0 q7,-4 15,0 t15,0" fill="none" stroke="#7C7A6E" stroke-opacity="0.5"/>`;
      break;
    case 'decor': g = `<g transform="scale(0.7)">${st.decor.tree(-10, 2, 1, false)}${st.decor.tree(8, 2, 1, true)}</g>`; break;
    case 'river': g = `<g transform="scale(${style === 'miniature' ? 0.55 : 0.9})">${st.river(LINE).replace(/vector-effect="non-scaling-stroke"/g, '').replace(/stroke-width="20"/, 'stroke-width="9"')}</g>`; break;
    case 'boundary': g = `<path d="M-15,0 h30" stroke="${st.boundary?.color || '#D97F78'}" stroke-dasharray="5 4"/>`; break;
    case 'reservoir': g = st.reservoir('M-12,-5 h24 l-4,10 h-16z'); break;
    case 'canal': g = st.canal(style === 'watercolor' ? 'M-14,1 q7,-3 14,-1 t14,-1' : 'M-14,0 h28'); break;
    case 'pipeline': g = st.pipeline('M-14,0 h28'); break;
    case 'village': g = `<g transform="scale(${style === 'miniature' ? 0.75 : 0.8})">${settlementSymbol(style, 'village', 0, style === 'miniature' ? -3 : 0, 'Village')}</g>`; break;
    case 'town': g = `<g transform="scale(${style === 'miniature' ? 0.42 : 0.75})">${settlementSymbol(style, 'town', 0, style === 'miniature' ? 0 : 0, 'Town')}</g>`; break;
    case 'pins': g = '<circle r="6" fill="#fff" stroke="#C0504A" stroke-width="2"/>'; break;
    default: g = `<g transform="scale(${key === 'dam' && style !== 'contour' ? 0.55 : 0.8})">${infraSymbol(style, key, 0, 0, 0)}</g>`;
  }
  return `<svg class="lg__icon" viewBox="-20 -13 40 26" width="40" height="26" aria-hidden="true" overflow="visible">${g}</svg>`;
}

// present: { settlements: Set<key>, infra: Set<key>, boundary: bool }
export function legendHTML(style, present, hidden, interval) {
  const st = STYLES[style];
  const row = (key, label) => `<label class="lg__row"><input type="checkbox" data-key="${key}" ${hidden.has(key) ? '' : 'checked'}>${icon(style, key, interval)}<span>${esc(label)}</span></label>`;
  const section = (id, title, keys) => keys.length ? `<fieldset class="lg__sec"><legend><label class="lg__head"><input type="checkbox" data-sec="${id}" ${keys.every(k => hidden.has(k)) ? '' : 'checked'}><span>${esc(title)}</span></label></legend>${keys.map(k => row(k, k === 'contours' && style === 'contour' ? `Contours, ${interval} m (bold every ${interval * 5} m)` : LABELS[k])).join('')}</fieldset>` : '';
  const terrain = [st.lines ? 'contours' : null, st.decor ? 'decor' : null, 'river', present.boundary && st.boundary ? 'boundary' : null].filter(Boolean);
  const set = ['village', 'town'].filter(k => present.settlements.has(k));
  const inf = ORDER.filter(k => present.infra.has(k));
  return `<div class="lg lg--${style}" role="group" aria-label="Legend: switch map features on and off">
    <span class="lg__title">${style === 'contour' ? 'LEGEND' : 'Legend'}</span>
    ${section('terrain', style === 'contour' ? 'TERRAIN' : 'Land', terrain)}
    ${section('settlements', style === 'contour' ? 'SETTLEMENTS' : 'Settlements', set)}
    ${section('infra', style === 'contour' ? 'WATER INFRASTRUCTURE' : 'Water works', inf)}
    ${section('archive', style === 'contour' ? 'ARCHIVE' : 'Archive', ['pins'])}
  </div>`;
}

export function presentKeys(settlements, infra, boundary) {
  return {
    settlements: new Set((settlements?.features || []).map(f => legendKey(f.properties?.type || 'village'))),
    infra: new Set((infra?.features || []).map(f => legendKey(f.properties?.type))),
    boundary: !!boundary
  };
}

// Wires a legend container to a map; returns a function that redraws it (after a style change).
export function mountLegend(el, { map, style, data, interval }) {
  const hidden = new Set();
  const present = presentKeys(data.settlements, data.infra, data.boundary);
  const draw = s => {
    style = s || style;
    el.innerHTML = legendHTML(style, present, hidden, interval);
    el.querySelectorAll('[data-key]').forEach(cb => cb.addEventListener('change', () => { cb.checked ? hidden.delete(cb.dataset.key) : hidden.add(cb.dataset.key); map.setHidden([...hidden]); sync(); }));
    el.querySelectorAll('[data-sec]').forEach(cb => cb.addEventListener('change', () => {
      cb.closest('fieldset').querySelectorAll('[data-key]').forEach(k => { k.checked = cb.checked; cb.checked ? hidden.delete(k.dataset.key) : hidden.add(k.dataset.key); });
      map.setHidden([...hidden]); sync();
    }));
    sync();
  };
  const sync = () => el.querySelectorAll('fieldset').forEach(fs => {
    const keys = [...fs.querySelectorAll('[data-key]')], on = keys.filter(k => k.checked).length, head = fs.querySelector('[data-sec]');
    head.checked = on > 0; head.indeterminate = on > 0 && on < keys.length;
  });
  draw();
  return draw;
}
