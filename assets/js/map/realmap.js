// Real-world map: the valley on MapLibre GL JS with satellite / street / plain backgrounds,
// relief shading, optional 3D terrain, and the archive's own layers on top.
import { isolines, simplify, thresholds, gridRange } from '../geo/contour.js';
import { cellToLonLat, sampleElevation, snapToLine } from '../geo/geom.js';
import { STYLES, settlementSymbol, infraSymbol, normaliseType } from './symbols.js';
import { legendKey } from './legend.js';

export const MAPLIBRE = { js: 'https://unpkg.com/maplibre-gl@5.23.0/dist/maplibre-gl.js', css: 'https://unpkg.com/maplibre-gl@5.23.0/dist/maplibre-gl.css' };
const STREETS = 'https://tiles.openfreemap.org/styles/liberty';
const SAT = { tiles: ['https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/{z}/{y}/{x}.jpg'], tileSize: 256, maxzoom: 15, attribution: '<a href="https://s2maps.eu" target="_blank" rel="noopener">Sentinel-2 cloudless - https://s2maps.eu</a> by <a href="https://eox.at" target="_blank" rel="noopener">EOX IT Services GmbH</a> (Contains modified Copernicus Sentinel data 2016 &amp; 2017)' };
const DEM = { tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'], tileSize: 256, maxzoom: 13, encoding: 'terrarium', attribution: 'Terrain: <a href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md" target="_blank" rel="noopener">Mapzen Joerd / AWS Terrain Tiles</a>' };
const INFRA_POINT = ['dam', 'weir', 'check_dam', 'well', 'jack_well', 'pump_house', 'reservoir'];

let libPromise = null;
export function loadMapLibre() {
  if (window.maplibregl) return Promise.resolve(window.maplibregl);
  if (!libPromise) libPromise = new Promise((res, rej) => {
    const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = MAPLIBRE.css; document.head.append(css);
    const s = document.createElement('script'); s.src = MAPLIBRE.js; s.async = true;
    s.onload = () => res(window.maplibregl); s.onerror = () => rej(new Error('The map library could not be loaded. Check your connection and try again.'));
    document.head.append(s);
  });
  return libPromise;
}

// Contour lines from the valley grid as GeoJSON in lon/lat, split where they leave the data area.
function contourGeoJSON(grid, interval) {
  const [lo, hi] = gridRange(grid), feats = [];
  for (const t of thresholds(lo, hi, interval)) {
    const major = Math.round(t) % (interval * 5) === 0;
    for (const ring of isolines(grid, t)) {
      let seg = [];
      const flush = () => { if (seg.length > 2) feats.push({ type: 'Feature', properties: { elev: Math.round(t), major }, geometry: { type: 'LineString', coordinates: simplify(seg, 0.3).map(([c, r]) => cellToLonLat(grid, c, r).map(v => +v.toFixed(5))) } }); seg = []; };
      for (const p of ring) { if (p[0] < 0 || p[1] < 0 || p[0] > grid.w - 1 || p[1] > grid.h - 1) flush(); else seg.push(p); }
      flush();
    }
  }
  return { type: 'FeatureCollection', features: feats };
}

const tag = fc => ({ type: 'FeatureCollection', features: (fc?.features || []).filter(f => f.geometry).map(f => ({ ...f, properties: { ...(f.properties || {}), lk: legendKey(f.properties?.type), name: f.properties?.name || '' } })) });

function svgImage(svg, w, h) {
  return new Promise(res => {
    const img = new Image(w, h);
    img.onload = () => res(img); img.onerror = () => res(null);
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
}
async function addIcons(map) {
  const make = (inner, s = 1) => `<svg xmlns="http://www.w3.org/2000/svg" width="${40 * s}" height="${40 * s}" viewBox="-20 -20 40 40">${inner}</svg>`;
  const jobs = [
    ...['village', 'town'].map(k => ['set-' + k, make(`<g transform="scale(${k === 'town' ? 1.1 : 1.2})">${settlementSymbol('contour', k, 0, 0, '')}</g>`, 2)]),
    ...INFRA_POINT.map(k => ['inf-' + k, make(`<g transform="scale(1.1)">${infraSymbol('contour', k, 0, 0, 0)}</g>`, 2)])
  ];
  await Promise.all(jobs.map(async ([id, svg]) => { if (map.hasImage(id)) return; const img = await svgImage(svg, 80, 80); if (img && !map.hasImage(id)) map.addImage(id, img, { pixelRatio: 2 }); }));
}

import { zoneField, zoneImage, ZONE_COLORS } from '../geo/zones.js';

export async function createRealMap(container, opts) {
  const maplibregl = await loadMapLibre();
  const { grid, river, boundary } = opts;
  const settlements = tag(opts.settlements), infra = tag(opts.infra);
  const contours = contourGeoJSON(grid, opts.interval || 20);
  const zones = opts.zones?.length && river ? opts.zones : null;
  const zf = zones ? zoneField({ bounds: grid.bounds, river, zones, boundary, cols: 260 }) : null;
  const zoneLabels = { type: 'FeatureCollection', features: (zf?.labels || []).map(l => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [l.lon, l.lat] }, properties: { name: l.name.toUpperCase(), km: `KM ${Math.round(l.kmFrom)}–${Math.round(l.kmTo)}`, color: ZONE_COLORS[l.i % ZONE_COLORS.length], zone: l.name } })) };
  let z0 = null;
  const state = { base: 'satellite', relief: true, terrain3d: false, hidden: new Set(), dim: new Set(), active: null, zone: null };
  const zoneFocus = () => zones && state.zone ? zones.findIndex(z => z.name === state.zone) : -1;
  const [W, S, E, N] = grid.bounds;

  container.innerHTML = '';
  container.classList.add('realmap');
  const map = new maplibregl.Map({
    container, style: STREETS, bounds: [[W, S], [E, N]], fitBoundsOptions: { padding: 30 },
    attributionControl: { compact: true, customAttribution: opts.credit ? `Valley data: ${opts.credit}` : undefined },
    maxPitch: 70, cooperativeGestures: false
  });
  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right');
  map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');

  let baseLayerIds = [];
  function addOurs() {
    if (!map.getSource('ga-sat')) map.addSource('ga-sat', { type: 'raster', ...SAT });
    if (!map.getSource('ga-dem')) map.addSource('ga-dem', { type: 'raster-dem', ...DEM });
    // Symbols scale with the map: full size at the valley's opening zoom, doubling per zoom level in, halving per level out (within limits).
    if (z0 == null) z0 = map.getZoom();
    const grow = (k = 1) => ['interpolate', ['exponential', 2], ['zoom'], z0 - 3, 0.2 * k, z0, k, z0 + 2.5, 5.6 * k];
    const below = em => ['interpolate', ['exponential', 2], ['zoom'], z0 - 3, ['literal', [0, 0.5]], z0, ['literal', [0, em]], z0 + 2.5, ['literal', [0, em * 5.2]]];  // keeps names just under their growing icons
    const firstSymbol = map.getStyle().layers.find(l => l.type === 'symbol')?.id;
    baseLayerIds = map.getStyle().layers.filter(l => !l.id.startsWith('ga-')).map(l => ({ id: l.id, type: l.type }));
    map.addLayer({ id: 'ga-sat', type: 'raster', source: 'ga-sat', paint: { 'raster-saturation': -0.1 } }, firstSymbol);
    map.addLayer({ id: 'ga-relief', type: 'hillshade', source: 'ga-dem', paint: { 'hillshade-shadow-color': '#33424B', 'hillshade-exaggeration': 0.45 } }, firstSymbol);
    if (zf) {
      const [zW, zS, zE, zN] = zf.bounds;
      map.addSource('ga-zones', { type: 'image', url: zoneImage(zf, 0.3, zoneFocus()), coordinates: [[zW, zN], [zE, zN], [zE, zS], [zW, zS]] });
      map.addLayer({ id: 'ga-zones', type: 'raster', source: 'ga-zones', paint: { 'raster-resampling': 'linear', 'raster-fade-duration': 0 } }, firstSymbol);
      map.addSource('ga-zone-labels', { type: 'geojson', data: zoneLabels });
    }
    map.addSource('ga-contours', { type: 'geojson', data: contours });
    map.addSource('ga-river', { type: 'geojson', data: river || { type: 'FeatureCollection', features: [] } });
    map.addSource('ga-boundary', { type: 'geojson', data: boundary || { type: 'FeatureCollection', features: [] } });
    map.addSource('ga-set', { type: 'geojson', data: settlements });
    map.addSource('ga-infra', { type: 'geojson', data: infra });
    const light = () => state.base === 'satellite';
    map.addLayer({ id: 'ga-contours', type: 'line', source: 'ga-contours', paint: { 'line-color': light() ? '#E9F2EC' : '#6E9E7E', 'line-opacity': ['case', ['get', 'major'], 0.9, 0.55], 'line-width': ['case', ['get', 'major'], 1.3, 0.6] } });
    map.addLayer({ id: 'ga-contour-labels', type: 'symbol', source: 'ga-contours', filter: ['get', 'major'], layout: { 'symbol-placement': 'line', 'text-field': ['concat', ['to-string', ['get', 'elev']], ' m'], 'text-font': ['Noto Sans Regular'], 'text-size': 10 }, paint: { 'text-color': '#2F6B4A', 'text-halo-color': '#F5F8F6', 'text-halo-width': 1.5 } });
    map.addLayer({ id: 'ga-boundary', type: 'line', source: 'ga-boundary', paint: { 'line-color': '#E8857C', 'line-width': 3.2, 'line-dasharray': [3, 2] } });
    map.addLayer({ id: 'ga-reservoir', type: 'fill', source: 'ga-infra', filter: ['==', ['geometry-type'], 'Polygon'], paint: { 'fill-color': '#9CC3E0', 'fill-opacity': 0.75, 'fill-outline-color': '#5E95BE' } });
    map.addLayer({ id: 'ga-canal', type: 'line', source: 'ga-infra', filter: ['all', ['==', ['geometry-type'], 'LineString'], ['==', ['get', 'lk'], 'canal']], paint: { 'line-color': '#5E95BE', 'line-width': 2 } });
    map.addLayer({ id: 'ga-pipeline', type: 'line', source: 'ga-infra', filter: ['all', ['==', ['geometry-type'], 'LineString'], ['==', ['get', 'lk'], 'pipeline']], paint: { 'line-color': '#C0504A', 'line-width': 1.4, 'line-dasharray': [3, 2] } });
    map.addLayer({ id: 'ga-river-casing', type: 'line', source: 'ga-river', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#FFFFFF', 'line-width': 6, 'line-opacity': 0.8 } });
    map.addLayer({ id: 'ga-river', type: 'line', source: 'ga-river', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#3F7FB5', 'line-width': 3 } });
    map.addLayer({ id: 'ga-infra-pts', type: 'symbol', source: 'ga-infra', filter: ['==', ['geometry-type'], 'Point'], layout: { 'icon-image': ['concat', 'inf-', ['get', 'lk']], 'icon-size': grow(0.7), 'icon-allow-overlap': true, 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Regular'], 'text-size': 10, 'text-offset': below(1.0), 'text-anchor': 'top', 'text-optional': true }, paint: { 'text-color': '#1E2A33', 'text-halo-color': '#FFFFFF', 'text-halo-width': 1.5 } });
    map.addLayer({ id: 'ga-set', type: 'symbol', source: 'ga-set', filter: ['==', ['geometry-type'], 'Point'], layout: { 'icon-image': ['concat', 'set-', ['get', 'lk']], 'icon-size': grow(0.7), 'icon-allow-overlap': true, 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Regular'], 'text-size': 11, 'text-offset': below(0.95), 'text-anchor': 'top', 'text-optional': true }, paint: { 'text-color': '#1E2A33', 'text-halo-color': '#FFFFFF', 'text-halo-width': 1.6 } });
    if (zf) map.addLayer({ id: 'ga-zone-labels', type: 'symbol', source: 'ga-zone-labels', layout: { 'text-field': ['format', ['get', 'name'], { 'font-scale': 1 }, '\n', {}, ['get', 'km'], { 'font-scale': 0.75 }], 'text-font': ['Noto Sans Regular'], 'text-size': 13, 'text-letter-spacing': 0.18, 'text-allow-overlap': false }, paint: { 'text-color': ['get', 'color'], 'text-halo-color': 'rgba(255,255,255,.9)', 'text-halo-width': 1.8 } });
    addIcons(map);
    applyBase(); applyHidden();
  }
  function applyBase() {
    const sat = state.base === 'satellite', plain = state.base === 'plain';
    for (const l of baseLayerIds) {
      const keep = l.type === 'background' || (l.type === 'symbol' && !plain);
      const vis = state.base === 'streets' ? true : keep;
      if (map.getLayer(l.id)) map.setLayoutProperty(l.id, 'visibility', vis ? 'visible' : 'none');
    }
    if (map.getLayer('ga-sat')) map.setLayoutProperty('ga-sat', 'visibility', sat ? 'visible' : 'none');
    if (map.getLayer('ga-relief')) map.setLayoutProperty('ga-relief', 'visibility', state.relief ? 'visible' : 'none');
    if (map.getLayer('ga-contours')) {
      map.setPaintProperty('ga-contours', 'line-color', sat ? '#E9F2EC' : '#6E9E7E');
      map.setPaintProperty('ga-contour-labels', 'text-color', sat ? '#FFFFFF' : '#2F6B4A');
      map.setPaintProperty('ga-contour-labels', 'text-halo-color', sat ? 'rgba(30,42,51,.8)' : '#F5F8F6');
    }
    map.setTerrain(state.terrain3d ? { source: 'ga-dem', exaggeration: 1.4 } : null);
    if (state.terrain3d && map.getPitch() < 20) map.easeTo({ pitch: 55, duration: 800 });
    if (!state.terrain3d && map.getPitch() > 0) map.easeTo({ pitch: 0, bearing: 0, duration: 600 });
  }
  function applyHidden() {
    const h = [...state.hidden], not = ['!', ['in', ['get', 'lk'], ['literal', h]]];
    const vis = (id, on) => map.getLayer(id) && map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');
    vis('ga-contours', !state.hidden.has('contours')); vis('ga-contour-labels', !state.hidden.has('contours'));
    vis('ga-river', !state.hidden.has('river')); vis('ga-river-casing', !state.hidden.has('river'));
    vis('ga-boundary', !state.hidden.has('boundary'));
    vis('ga-zones', !state.hidden.has('zones')); vis('ga-zone-labels', !state.hidden.has('zones'));
    vis('ga-reservoir', !state.hidden.has('reservoir')); vis('ga-canal', !state.hidden.has('canal')); vis('ga-pipeline', !state.hidden.has('pipeline'));
    if (map.getLayer('ga-infra-pts')) map.setFilter('ga-infra-pts', ['all', ['==', ['geometry-type'], 'Point'], not]);
    if (map.getLayer('ga-set')) map.setFilter('ga-set', ['all', ['==', ['geometry-type'], 'Point'], not]);
    markers.forEach(m => { m.getElement().style.display = state.hidden.has('pins') ? 'none' : ''; });
  }

  // Story pins as HTML markers, styled like the illustrated map's pins.
  const markers = (opts.stories || []).map(s => {
    const el = document.createElement('div');
    el.innerHTML = `<button type="button" class="pin pin--ml" aria-label="Open story ${s.number ?? ''}: ${String(s.place).replace(/"/g, '&quot;')}"><span class="pin__dot"></span><span class="pin__label">${s.number != null ? String(s.number).padStart(2, '0') + '. ' : ''}${String(s.place).replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]))}</span></button>`;
    const b = el.firstElementChild;
    b.addEventListener('click', e => { e.stopPropagation(); opts.onPinClick?.(s); });
    b.addEventListener('mouseenter', () => opts.onPinHover?.(s)); b.addEventListener('mouseleave', () => opts.onPinHover?.(null));
    b.addEventListener('focus', () => opts.onPinHover?.(s));
    const m = new maplibregl.Marker({ element: el, anchor: 'left', offset: [-11, 0] }).setLngLat([s.lng, s.lat]).addTo(map);
    m._story = s; return m;
  });
  const refreshPins = () => markers.forEach(m => { const b = m.getElement().firstElementChild; b.classList.toggle('is-dim', state.dim.has(m._story.id)); b.classList.toggle('is-active', state.active === m._story.id); });

  map.on('style.load', addOurs);
  map.on('styleimagemissing', () => addIcons(map));
  map.on('mousemove', e => {
    const { lng, lat } = e.lngLat;
    opts.onCursor?.({ lon: lng, lat, elevation: sampleElevation(grid, lng, lat) });
  });
  map.getCanvas().addEventListener('mouseleave', () => opts.onCursor?.(null));
  map.on('error', e => { if (opts.onError && /openfreemap|eox|elevation-tiles/.test(String(e?.error?.url || e?.error?.message || ''))) opts.onError(e.error); });

  return {
    setBase(b) { state.base = b; applyBase(); },
    setRelief(on) { state.relief = on; applyBase(); },
    set3D(on) { state.terrain3d = on; applyBase(); },
    get state() { return { ...state, hidden: new Set(state.hidden) }; },
    setHidden(keys) { state.hidden = new Set(keys); applyHidden(); },
    setDim(ids) { state.dim = new Set(ids); refreshPins(); },
    setZone(name) {
      state.zone = name && name !== 'All' ? name : null;
      if (zf && map.getSource('ga-zones')) map.getSource('ga-zones').updateImage({ url: zoneImage(zf, 0.3, zoneFocus()) });
      if (map.getLayer('ga-zone-labels')) map.setPaintProperty('ga-zone-labels', 'text-opacity', ['case', ['any', ['==', state.zone ? 1 : 0, 0], ['==', ['get', 'zone'], state.zone || '']], 1, 0.35]);
    },
    setActive(id) { state.active = id; refreshPins(); },
    zoomIn() { map.zoomIn(); }, zoomOut() { map.zoomOut(); },
    reset() { map.fitBounds([[W, S], [E, N]], { padding: 30, pitch: state.terrain3d ? 55 : 0, bearing: 0 }); },
    focus(lon, lat) { map.easeTo({ center: [lon, lat], zoom: Math.max(map.getZoom(), 12) }); },
    snap(lon, lat) { const c = river?.geometry?.coordinates; return c ? snapToLine(c, lon, lat) : null; },
    resize() { map.resize(); },
    destroy() { map.remove(); }
  };
}
