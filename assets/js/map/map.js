// Grassroot Archives map renderer: draws a valley in one of three styles as SVG,
// with settlements, water infrastructure and story pins, pan/zoom and a cursor readout.
import { isolines, simplify, thresholds, gridRange } from '../geo/contour.js';
import { sampleElevation, snapToLine } from '../geo/geom.js';
import { STYLES, settlementSymbol, infraSymbol, normaliseType } from './symbols.js';

// Map symbols (settlements, water infrastructure) are drawn at this share of their full size; legends stay full size.
export const ICON_SCALE = 0.7;
const shrink = (svg, x, y, k = ICON_SCALE) => `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${k}) translate(${(-x).toFixed(1)} ${(-y).toFixed(1)})">${svg}</g>`;
import { legendKey } from './legend.js';

const NS = 'http://www.w3.org/2000/svg';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function rng(seed) { // mulberry32
  let a = seed >>> 0;
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

export function createMap(container, opts) {
  const state = {
    style: opts.style || 'contour',
    layers: Object.assign({ settlements: true, infra: true, pins: true }, opts.layers || {}),
    stories: opts.stories || [],
    dim: new Set(),
    active: null,
    interval: opts.interval || 20,
    hidden: new Set(opts.hidden || [])
  };
  const off = k => state.hidden.has(k);
  const grid = opts.grid;
  const bounds = opts.bounds || grid.bounds;
  const [W, S, E, N] = bounds;
  const k = Math.cos((S + N) / 2 * Math.PI / 180);
  const VW = 1000, VH = Math.round(VW * (N - S) / ((E - W) * k));
  const px = (lon, lat) => [(lon - W) / (E - W) * VW, (N - lat) / (N - S) * VH];
  const toLonLat = (x, y) => [W + x / VW * (E - W), N - y / VH * (N - S)];
  const cellPx = (c, r) => [(c + 0.5) / grid.w * VW, (r + 0.5) / grid.h * VH];
  const riverCoords = opts.river?.geometry?.coordinates || opts.river || null;

  container.classList.add('gmap');
  container.innerHTML = '';
  const frame = document.createElement('div'); frame.className = 'gmap__frame';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', opts.label || 'Map of the river valley');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  const overlay = document.createElement('div'); overlay.className = 'gmap__pins';
  frame.append(svg, overlay); container.append(frame);
  frame.style.aspectRatio = `${VW} / ${VH}`;

  let view = { x: 0, y: 0, w: VW, h: VH };

  // ---------- geometry caches ----------
  const [zlo, zhi] = gridRange(grid);
  const ringPath = rings => rings.map(r => 'M' + simplify(r).map(([c, rr]) => cellPx(c, rr).map(v => v.toFixed(1)).join(',')).join('L') + 'Z').join('');
  const cache = new Map();
  const ringsAt = t => { if (!cache.has(t)) cache.set(t, ringPath(isolines(grid, t))); return cache.get(t); };
  const linePath = coords => coords.map((p, i) => (i ? 'L' : 'M') + px(p[0], p[1]).map(v => v.toFixed(1)).join(',')).join('');
  const polyPath = rings => rings.map(r => linePath(r) + 'Z').join('');

  function features(fc) { return (fc?.features || []).filter(f => f && f.geometry); }

  // ---------- drawing ----------
  function draw() {
    const st = STYLES[state.style];
    const parts = [];
    const clipId = 'gclip' + Math.random().toString(36).slice(2, 7);
    parts.push(`<defs>${st.defs || ''}<clipPath id="${clipId}"><rect width="${VW}" height="${VH}"/></clipPath></defs>`);
    parts.push(`<rect width="${VW}" height="${VH}" fill="${st.ground}"/>`);
    parts.push(`<g clip-path="url(#${clipId})">`);
    // Terrain.
    if (st.bands) {
      const n = st.bands.length;
      const ts = Array.from({ length: n - 1 }, (_, i) => zlo + (zhi - zlo) * (i + 1) / n);
      parts.push(`<rect width="${VW}" height="${VH}" fill="${st.bands[0]}"/>`);
      parts.push(`<g ${st.bandFilter ? `filter="url(#${st.bandFilter})"` : ''}>`);
      ts.forEach((t, i) => parts.push(`<path d="${ringsAt(t)}" fill="${st.bands[i + 1]}" fill-rule="evenodd" ${st.bandOpacity ? `fill-opacity="${st.bandOpacity}"` : ''} ${st.bandStroke ? `stroke="${st.bandStroke}" stroke-width="${st.bandStrokeWidth}" vector-effect="non-scaling-stroke"` : ''}/>`));
      parts.push('</g>');
      if (st.bandEdge) {
        parts.push(`<g fill="none" filter="url(#${st.bandEdge.filter})">`);
        ts.forEach(t => parts.push(`<path d="${ringsAt(t)}" stroke="${st.bandEdge.color}" stroke-opacity="${st.bandEdge.opacity}" stroke-width="${st.bandEdge.width}"/>`));
        parts.push('</g>');
      }
      if (st.upperPattern) ts.slice(Math.floor(ts.length * 0.55)).forEach(t => parts.push(`<path d="${ringsAt(t)}" fill="url(#${st.upperPattern})" fill-rule="evenodd"/>`));
    }
    if (st.lines && !off('contours')) {
      const step = st.lines.step ? Math.max(state.interval, st.lines.step) : state.interval;
      for (const t of thresholds(zlo, zhi, step)) {
        const major = Math.round(t) % (step * 5) === 0;
        if (st.lines.majorOnly && !major) continue;
        const c = major ? st.lines.major : st.lines.minor;
        parts.push(`<path d="${ringsAt(t)}" fill="none" stroke="${c.color}" stroke-width="${c.width}" ${c.opacity ? `stroke-opacity="${c.opacity}"` : ''} vector-effect="non-scaling-stroke" stroke-linejoin="round"/>`);
      }
    }
    // Miniature extras: fields and trees.
    if (st.decor && riverCoords && !off('decor')) parts.push(decor(st));
    // Watershed.
    if (opts.boundary && st.boundary && !off('boundary')) {
      const rings = opts.boundary.geometry ? opts.boundary.geometry.coordinates : opts.boundary;
      parts.push(`<path d="${polyPath(rings)}" fill="none" stroke="${st.boundary.color}" stroke-width="${st.boundary.width}" stroke-dasharray="${st.boundary.dash}"${st.boundary.cap ? ` stroke-linecap="${st.boundary.cap}"` : ''} opacity="${st.boundary.opacity || 1}" vector-effect="non-scaling-stroke"/>`);
    }
    // Infrastructure polygons and lines under the river.
    if (state.layers.infra) {
      for (const f of features(opts.infra)) {
        const t = normaliseType(f.properties?.type);
        const g = f.geometry;
        if (off(legendKey(t)) || (g.type.includes('Polygon') && off('reservoir'))) continue;
        if (g.type === 'Polygon' || g.type === 'MultiPolygon') {
          const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
          polys.forEach(p => parts.push(st.reservoir(polyPath(p))));
        } else if (g.type === 'LineString' || g.type === 'MultiLineString') {
          const lines = g.type === 'LineString' ? [g.coordinates] : g.coordinates;
          lines.forEach(l => parts.push(t === 'pipeline' ? st.pipeline(linePath(l)) : st.canal(linePath(l))));
        }
      }
    }
    // River.
    if (riverCoords && !off('river')) parts.push(st.river(linePath(riverCoords)));
    parts.push('</g>');
    // Point symbols and labels.
    const placed = [];
    const labels = [];
    const tangentAt = (lon, lat) => {
      if (!riverCoords) return [1, 0];
      let best = 0, bd = Infinity;
      riverCoords.forEach((p, i) => { const d = (p[0] - lon) ** 2 + (p[1] - lat) ** 2; if (d < bd) { bd = d; best = i; } });
      const a = riverCoords[Math.max(0, best - 1)], b = riverCoords[Math.min(riverCoords.length - 1, best + 1)];
      const [ax, ay] = px(a[0], a[1]), [bx, by] = px(b[0], b[1]);
      const L = Math.hypot(bx - ax, by - ay) || 1; return [(bx - ax) / L, (by - ay) / L];
    };
    const sym = [];
    if (state.layers.infra) {
      for (const f of features(opts.infra)) {
        if (f.geometry.type !== 'Point') continue;
        const [x, y] = px(...f.geometry.coordinates);
        const t = normaliseType(f.properties?.type);
        if (off(legendKey(t))) continue;
        const ang = Math.atan2(...tangentAt(...f.geometry.coordinates).reverse()) * 180 / Math.PI + 90;
        sym.push(shrink(infraSymbol(state.style, t, x, y, ang), x, y));
        placed.push([x - 7, y - 7, x + 7, y + 7]);
        const name = f.properties?.name || (['dam', 'weir', 'kt_weir', 'jack_well', 'pump_house'].includes(t) ? STYLES[state.style].typeLabel(t) : '');
        if (name) labels.push({ x, y, text: name, r: 9 });
      }
    }
    if (state.layers.settlements) {
      for (const f of features(opts.settlements)) {
        if (f.geometry.type !== 'Point') continue;
        const [x, y] = px(...f.geometry.coordinates);
        const t = normaliseType(f.properties?.type) || 'village';
        if (off(legendKey(t))) continue;
        sym.push(shrink(settlementSymbol(state.style, t, x, y, f.properties?.name || ''), x, y));
        const big = t === 'town' || t === 'city', k = ICON_SCALE;
        placed.push([x - (big ? 22 : 14) * k, y - (big ? 26 : 14) * k, x + (big ? 22 : 14) * k, y + (big ? 20 : 14) * k]);
        if (f.properties?.name) labels.push({ x, y, text: f.properties.name, r: (big ? 24 : 16) * k });
      }
    }
    // Pins occupy space too.
    if (state.layers.pins && !off('pins')) for (const s of state.stories) { const [x, y] = px(s.lng, s.lat); placed.push([x - 8, y - 8, x + 8 + 8 * String(s.place || '').length, y + 8]); }
    parts.push(`<g class="gmap__symbols">${sym.join('')}</g>`);
    parts.push(`<g class="gmap__labels">${placeLabels(labels, placed, state.style)}</g>`);
    svg.innerHTML = parts.join('');
    applyView();
    drawPins();
  }

  function decor(st) {
    const r = rng(11);
    const out = [];
    const rc = riverCoords.map(p => px(p[0], p[1]));
    const distRiver = (x, y) => { let d = Infinity; for (let i = 0; i < rc.length; i += 2) d = Math.min(d, Math.hypot(rc[i][0] - x, rc[i][1] - y)); return d; };
    // Fields along the lower river.
    const start = Math.floor(rc.length * 0.45);
    for (let n = 0; n < 220; n++) {
      const i = start + Math.floor(r() * (rc.length - start)); const [ox, oy] = rc[Math.min(i, rc.length - 1)];
      const a = r() * Math.PI * 2, d = 18 + r() * 52, fx = ox + Math.cos(a) * d, fy = oy + Math.sin(a) * d;
      if (fx < 25 || fy < 25 || fx > VW - 25 || fy > VH - 25 || distRiver(fx, fy) < 12) continue;
      const w = 10 + r() * 10, h = 7 + r() * 6, col = st.decor.fields[Math.floor(r() * st.decor.fields.length)];
      out.push(`<rect x="${fx.toFixed(0)}" y="${fy.toFixed(0)}" width="${w.toFixed(0)}" height="${h.toFixed(0)}" fill="${col}" stroke="#5A4426" stroke-width="0.6" transform="rotate(${(a * 57) % 30 - 15 | 0} ${fx | 0} ${fy | 0})"/>`);
    }
    // Trees on the middle slopes.
    let trees = 0;
    for (let n = 0; n < 1400 && trees < 170; n++) {
      const x = 30 + r() * (VW - 60), y = 30 + r() * (VH - 60);
      const [lon, lat] = toLonLat(x, y); const e = sampleElevation(grid, lon, lat);
      if (e == null) continue;
      const f = (e - zlo) / (zhi - zlo || 1);
      if (f < 0.22 || f > 0.75 || distRiver(x, y) < 40 || r() > 0.55) continue;
      out.push(st.decor.tree(x, y, 0.8 + r() * 0.45, r() < 0.3)); trees++;
    }
    return out.join('');
  }

  function placeLabels(labels, placed, style) {
    const st = STYLES[style];
    const out = [];
    for (const L of labels) {
      const w = st.labelWidth(L.text), h = 17;
      const cands = [[0, L.r + 10], [0, -L.r - 6], [L.r + w / 2 + 4, 4], [-L.r - w / 2 - 4, 4], [0, L.r + 26], [0, -L.r - 22], [L.r + w / 2 + 10, 22], [-L.r - w / 2 - 10, 22], [L.r + w / 2 + 10, -16], [-L.r - w / 2 - 10, -16]];
      let pos = null;
      for (const [dx, dy] of cands) {
        const cx = L.x + dx, cy = L.y + dy, box = [cx - w / 2 - 2, cy - h + 3, cx + w / 2 + 2, cy + 5];
        if (box[0] < 4 || box[1] < 4 || box[2] > VW - 4 || box[3] > VH - 4) continue;
        if (placed.every(b => box[2] < b[0] || box[0] > b[2] || box[3] < b[1] || box[1] > b[3])) { pos = [cx, cy]; placed.push(box); break; }
      }
      if (!pos) continue; // drop a label rather than overlap
      out.push(st.label(pos[0], pos[1], esc(L.text), w));
    }
    return out.join('');
  }

  // ---------- pins (HTML buttons over the SVG) ----------
  function drawPins() {
    overlay.innerHTML = '';
    if (!state.layers.pins || off('pins')) return;
    for (const s of state.stories) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'pin' + (state.active === s.id ? ' is-active' : '') + (state.dim.has(s.id) ? ' is-dim' : '');
      b.dataset.id = s.id;
      b.setAttribute('aria-label', `Open story ${s.number ?? ''}: ${s.place}`);
      b.innerHTML = `<span class="pin__dot"></span><span class="pin__label">${s.number != null ? String(s.number).padStart(2, '0') + '. ' : ''}${esc(s.place)}</span>`;
      b.addEventListener('click', e => { e.stopPropagation(); opts.onPinClick && opts.onPinClick(s); });
      b.addEventListener('mouseenter', () => opts.onPinHover && opts.onPinHover(s));
      b.addEventListener('mouseleave', () => opts.onPinHover && opts.onPinHover(null));
      b.addEventListener('focus', () => opts.onPinHover && opts.onPinHover(s));
      overlay.append(b);
    }
    positionPins();
  }
  function positionPins() {
    const rect = frame.getBoundingClientRect();
    const scale = Math.min(rect.width / view.w, rect.height / view.h) || 1;
    const offX = (rect.width - view.w * scale) / 2, offY = (rect.height - view.h * scale) / 2;
    for (const b of overlay.children) {
      const s = state.stories.find(x => String(x.id) === b.dataset.id); if (!s) continue;
      const [x, y] = px(s.lng, s.lat);
      const sx = offX + (x - view.x) * scale, sy = offY + (y - view.y) * scale;
      const visible = sx >= -10 && sy >= -10 && sx <= rect.width + 10 && sy <= rect.height + 10;
      b.style.display = visible ? '' : 'none';
      b.style.left = sx + 'px'; b.style.top = sy + 'px';
      b.classList.toggle('is-flipped', sx > rect.width * 0.72);
    }
  }

  // ---------- pan & zoom ----------
  function clampView() {
    view.w = Math.min(VW, Math.max(VW / 8, view.w)); view.h = view.w * VH / VW;
    view.x = Math.max(0, Math.min(VW - view.w, view.x)); view.y = Math.max(0, Math.min(VH - view.h, view.y));
  }
  function applyView() { clampView(); svg.setAttribute('viewBox', `${view.x} ${view.y} ${view.w} ${view.h}`); positionPins(); }
  function clientToSvg(cx, cy) {
    const rect = frame.getBoundingClientRect();
    const scale = Math.min(rect.width / view.w, rect.height / view.h);
    return [view.x + (cx - rect.left - (rect.width - view.w * scale) / 2) / scale, view.y + (cy - rect.top - (rect.height - view.h * scale) / 2) / scale];
  }
  function zoomAt(f, cx, cy) {
    const [sx, sy] = cx == null ? [view.x + view.w / 2, view.y + view.h / 2] : clientToSvg(cx, cy);
    const nw = Math.min(VW, Math.max(VW / 8, view.w / f)); const ratio = nw / view.w;
    view.x = sx - (sx - view.x) * ratio; view.y = sy - (sy - view.y) * ratio; view.w = nw; applyView();
  }
  frame.addEventListener('wheel', e => { if (!e.ctrlKey && !e.metaKey && view.w === VW && e.deltaY > 0) return; e.preventDefault(); zoomAt(e.deltaY < 0 ? 1.25 : 0.8, e.clientX, e.clientY); }, { passive: false });
  const pointers = new Map(); let pinchStart = null;
  frame.addEventListener('pointerdown', e => {
    if (e.target.closest('.pin')) return;
    frame.setPointerCapture(e.pointerId); pointers.set(e.pointerId, [e.clientX, e.clientY]);
    downAt = [e.clientX, e.clientY];
    if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinchStart = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), w: view.w }; }
  });
  frame.addEventListener('pointermove', e => {
    if (opts.onCursor && !pointers.size) {
      const [x, y] = clientToSvg(e.clientX, e.clientY);
      if (x >= 0 && y >= 0 && x <= VW && y <= VH) { const [lon, lat] = toLonLat(x, y); opts.onCursor({ lon, lat, elevation: sampleElevation(grid, lon, lat) }); }
    }
    if (!pointers.has(e.pointerId)) return;
    const prev = pointers.get(e.pointerId); pointers.set(e.pointerId, [e.clientX, e.clientY]);
    if (pointers.size === 2 && pinchStart) {
      const [a, b] = [...pointers.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      const target = pinchStart.w * pinchStart.d / d; zoomAt(view.w / target, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); return;
    }
    const rect = frame.getBoundingClientRect(); const scale = Math.min(rect.width / view.w, rect.height / view.h);
    view.x -= (e.clientX - prev[0]) / scale; view.y -= (e.clientY - prev[1]) / scale; applyView();
  });
  let downAt = null;
  const end = e => {
    if (downAt && opts.onMapClick && pointers.size === 1 && Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) < 5) {
      const [x, y] = clientToSvg(e.clientX, e.clientY);
      if (x >= 0 && y >= 0 && x <= VW && y <= VH) { const [lon, lat] = toLonLat(x, y); opts.onMapClick({ lon, lat }); }
    }
    downAt = null; pointers.delete(e.pointerId); if (pointers.size < 2) pinchStart = null;
  };
  frame.addEventListener('pointerup', end); frame.addEventListener('pointercancel', end);
  frame.addEventListener('pointerleave', () => opts.onCursor && opts.onCursor(null));
  const ro = new ResizeObserver(() => positionPins()); ro.observe(frame);

  container.dataset.style = state.style;
  draw();

  return {
    setStyle(s) { if (!STYLES[s]) return; state.style = s; container.dataset.style = s; draw(); },
    setLayers(l) { Object.assign(state.layers, l); draw(); },
    setHidden(keys) { state.hidden = new Set(keys); draw(); },
    setStories(list) { state.stories = list; draw(); },
    setDim(ids) { state.dim = new Set(ids); drawPins(); },
    setActive(id) { state.active = id; drawPins(); },
    setMarker(lon, lat) {
      svg.querySelector('[data-marker]')?.remove();
      if (lon == null) return;
      const [x, y] = px(lon, lat);
      svg.insertAdjacentHTML('beforeend', `<g data-marker><circle cx="${x}" cy="${y}" r="9" fill="#C0504A" stroke="#fff" stroke-width="3" vector-effect="non-scaling-stroke"/><circle cx="${x}" cy="${y}" r="16" fill="none" stroke="#C0504A" stroke-width="1.5" vector-effect="non-scaling-stroke"/></g>`);
    },
    zoomIn() { zoomAt(1.4); }, zoomOut() { zoomAt(1 / 1.4); }, reset() { view = { x: 0, y: 0, w: VW, h: VH }; applyView(); },
    focus(lon, lat) { const [x, y] = px(lon, lat); view.w = Math.min(view.w, VW / 2); view.h = view.w * VH / VW; view.x = x - view.w / 2; view.y = y - view.h / 2; applyView(); },
    project: px, size: [VW, VH],
    snap(lon, lat) { return riverCoords ? snapToLine(riverCoords, lon, lat) : null; },
    destroy() { ro.disconnect(); container.innerHTML = ''; }
  };
}
