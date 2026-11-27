// The hazard chain drawn as a ring: one arrow-shaped segment per link, running clockwise from the top,
// with numbered strategy badges (coloured by level) sitting outside the link they respond to.
import { HAZARDS } from './hazards.js';
import { levelOf } from './resilience.js';
import { esc } from './ui.js';

const C = 170, R = 112, r = 66, M = (R + r) / 2, GAP = 3, TIP = 5;
const P = (rad, deg) => { const a = deg * Math.PI / 180; return [C + rad * Math.sin(a), C - rad * Math.cos(a)].map(v => v.toFixed(1)).join(' '); };
const hex = h => h.match(/\w\w/g).map(x => parseInt(x, 16));
const mix = (a, b, t) => '#' + hex(a).map((v, i) => Math.round(v + (hex(b)[i] - v) * t).toString(16).padStart(2, '0')).join('');
const dark = h => { const [R2, G, B] = hex(h); return (0.299 * R2 + 0.587 * G + 0.114 * B) < 150; };

// strategies: [{ n, level, hazard, link }]
export function chainWheel(hazardKey, strategies = [], { selected = null, interactive = false, label = '' } = {}) {
  const h = HAZARDS[hazardKey]; if (!h) return '';
  const n = h.links.length, span = 360 / n;
  const segs = h.links.map((l, i) => {
    const a0 = i * span + GAP / 2, a1 = (i + 1) * span - GAP / 2, mid = (a0 + a1) / 2 + TIP / 2;
    const fill = mix(h.colors[0], h.colors[1], n > 1 ? i / (n - 1) : 0);
    const d = `M${P(R, a0)} A${R} ${R} 0 0 1 ${P(R, a1)} L${P(M, a1 + TIP)} L${P(r, a1)} A${r} ${r} 0 0 0 ${P(r, a0)} L${P(M, a0 + TIP)} Z`;
    const sel = selected === l.key;
    const mine = strategies.filter(s => s.hazard === hazardKey && s.link === l.key);
    // badges: one ring if they fit in the segment, two if not
    const room = a1 - a0 - 6, step = 12.5, perRing = Math.max(1, Math.floor(room / step) + 1);
    const badges = mine.map((s, j) => {
      const ring = j < perRing ? 0 : 1, inRing = ring ? mine.length - perRing : Math.min(mine.length, perRing), k = ring ? j - perRing : j;
      const ang = mid + (k - (inRing - 1) / 2) * step, [x, y] = P(R + 20 + ring * 22, ang).split(' ');
      return `<g class="cw__badge"><circle cx="${x}" cy="${y}" r="10" fill="${levelOf(s.level).color}" stroke="#fff" stroke-width="2"></circle><text x="${x}" y="${y}" dy="3.8" text-anchor="middle">${s.n}</text></g>`;
    }).join('');
    const [tx, ty] = P(M, mid).split(' ');
    const attrs = interactive ? ` data-link="${l.key}" tabindex="0" role="button" aria-pressed="${sel}" aria-label="${esc(`Step ${i + 1}: ${l.short}. ${mine.length} strategies linked.`)}"` : '';
    return `<g class="cw__seg${sel ? ' is-sel' : ''}"${attrs}><title>${esc(`${i + 1} · ${l.short}: ${l.text}`)}</title><path d="${d}" fill="${fill}"></path>
      <text x="${tx}" y="${ty}" dy="5" text-anchor="middle" class="cw__num" fill="${dark(fill) ? '#fff' : '#1E2A33'}">${i + 1}</text></g>${badges}`;
  }).join('');
  return `<svg class="cw" viewBox="0 0 340 340" role="img" aria-label="${esc(label || `${h.name} chain of events, ${n} steps`)}">
    ${segs}
    <text x="${C}" y="${C - 4}" text-anchor="middle" class="cw__hz">${esc(h.name)}</text>
    <text x="${C}" y="${C + 16}" text-anchor="middle" class="cw__sub">chain of events ↻</text>
  </svg>`;
}

export function levelKey() {
  return `<div class="levelkey">${['home', 'neighbourhood', 'region'].map(k => { const l = levelOf(k); return `<span><i style="background:${l.color}"></i>${esc(l.name)}</span>`; }).join('')}</div>`;
}
