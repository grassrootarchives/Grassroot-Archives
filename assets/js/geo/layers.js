// Settlement and water-infrastructure layers: clean uploaded files, or import from OpenStreetMap.
import { normaliseType, SETTLEMENT_TYPES, INFRA_TYPES } from '../map/symbols.js';
import { inBounds } from './geom.js';
import { simplify } from './contour.js';

const NAME_KEYS = ['name', 'name_en', 'name:en', 'title', 'label', 'village', 'place'];
const TYPE_KEYS = ['type', 'kind', 'category', 'class', 'place', 'feature'];

function pick(props, keys) { for (const k of keys) { const hit = Object.keys(props || {}).find(p => p.toLowerCase() === k); if (hit && props[hit] != null && props[hit] !== '') return String(props[hit]); } return ''; }

export function cleanLayer(fc, kind, bounds) {
  const allowed = kind === 'settlements' ? SETTLEMENT_TYPES : INFRA_TYPES;
  const out = [], skipped = { outside: 0, type: 0 };
  for (const f of fc.features || []) {
    if (!f.geometry) continue;
    let type = normaliseType(pick(f.properties, TYPE_KEYS));
    if (kind === 'settlements' && !allowed.includes(type)) type = 'village';
    if (kind === 'infra' && !allowed.includes(type)) {
      if (f.geometry.type.includes('Line')) type = 'canal'; else if (f.geometry.type.includes('Polygon')) type = 'reservoir'; else { skipped.type++; continue; }
    }
    const pt = f.geometry.type === 'Point' ? f.geometry.coordinates : null;
    if (pt && bounds && !inBounds(bounds, pt[0], pt[1])) { skipped.outside++; continue; }
    out.push({ type: 'Feature', properties: { name: pick(f.properties, NAME_KEYS).slice(0, 80), type }, geometry: f.geometry });
  }
  return { fc: slimLayer({ type: 'FeatureCollection', features: out }), skipped };
}

export function summarise(fc) {
  const by = {};
  for (const f of fc?.features || []) { const t = f.properties?.type || '?'; by[t] = (by[t] || 0) + 1; }
  return Object.entries(by).sort((a, b) => b[1] - a[1]).map(([t, n]) => `${n} ${t.replace(/_/g, ' ')}`).join(' · ') || 'none';
}

async function overpass(query) {
  const r = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: 'data=' + encodeURIComponent(query), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
  if (!r.ok) throw new Error(`OpenStreetMap did not answer (${r.status}). Try again in a minute.`);
  return r.json();
}
const bbox = b => `${b[1]},${b[0]},${b[3]},${b[2]}`;
const nm = t => t?.['name:en'] || t?.name || '';

export async function osmSettlements(bounds) {
  const j = await overpass(`[out:json][timeout:60];node["place"~"^(village|town|city|hamlet)$"](${bbox(bounds)});out;`);
  return { type: 'FeatureCollection', features: j.elements.filter(e => e.type === 'node').map(e => ({ type: 'Feature', properties: { name: nm(e.tags), type: e.tags.place === 'hamlet' ? 'village' : e.tags.place }, geometry: { type: 'Point', coordinates: [e.lon, e.lat] } })) };
}

export async function osmInfra(bounds) {
  const b = bbox(bounds);
  const j = await overpass(`[out:json][timeout:90];(
    node["waterway"~"^(dam|weir)$"](${b}); way["waterway"~"^(dam|weir)$"](${b});
    node["man_made"="water_well"](${b}); node["man_made"="pumping_station"](${b}); node["man_made"="water_works"](${b});
    way["waterway"="canal"](${b}); way["natural"="water"]["water"="reservoir"](${b}); way["landuse"="reservoir"](${b});
  );out geom;`);
  const feats = [];
  for (const e of j.elements) {
    const t = e.tags || {}; let type = null;
    if (t.waterway === 'dam') type = 'dam'; else if (t.waterway === 'weir') type = 'weir'; else if (t.man_made === 'water_well') type = 'well';
    else if (t.man_made === 'pumping_station' || t.man_made === 'water_works') type = 'pump_house'; else if (t.waterway === 'canal') type = 'canal';
    else if (t.water === 'reservoir' || t.landuse === 'reservoir') type = 'reservoir';
    if (!type) continue;
    if (e.type === 'node') feats.push({ type: 'Feature', properties: { name: nm(t), type }, geometry: { type: 'Point', coordinates: [e.lon, e.lat] } });
    else if (e.geometry) {
      const co = e.geometry.map(p => [p.lon, p.lat]);
      if (type === 'reservoir') feats.push({ type: 'Feature', properties: { name: nm(t), type }, geometry: { type: 'Polygon', coordinates: [co] } });
      else if (type === 'canal') feats.push({ type: 'Feature', properties: { name: nm(t), type }, geometry: { type: 'LineString', coordinates: co } });
      else { const m = co[Math.floor(co.length / 2)]; feats.push({ type: 'Feature', properties: { name: nm(t), type }, geometry: { type: 'Point', coordinates: m } }); }
    }
  }
  return { type: 'FeatureCollection', features: feats };
}

export const CSV_TEMPLATE = 'name,type,lat,lng\nExample dam,dam,18.5600,73.7900\nExample KT weir,kt_weir,18.5200,73.8600\nExample well,well,18.5100,73.8500\n';

// Make a layer small enough to load quickly on phones without visible change on the map:
// coordinates rounded to 4 decimals (about 11 m, finer than one pixel even zoomed in on a basin map),
// lines and outlines simplified to about 10 m, repeated points and empty names dropped.
const TOL = 0.0001, R = 1e4;
const rnd = c => [Math.round(c[0] * R) / R, Math.round(c[1] * R) / R];
function line(co, closed) {
  let pts = co.map(rnd).filter((p, i, a) => !i || p[0] !== a[i - 1][0] || p[1] !== a[i - 1][1]);
  if (closed) {
    // a ring starts and ends on the same point, so simplify its two halves separately
    if (pts.length > 1 && pts[0][0] === pts.at(-1)[0] && pts[0][1] === pts.at(-1)[1]) pts.pop();
    if (pts.length > 8) { const m = Math.floor(pts.length / 2); pts = [...simplify(pts.slice(0, m + 1), TOL).slice(0, -1), ...simplify(pts.slice(m), TOL)]; }
  } else if (pts.length > 4) pts = simplify(pts, TOL);
  if (closed) { if (pts.length < 3) return null; const [a, b] = [pts[0], pts.at(-1)]; if (a[0] !== b[0] || a[1] !== b[1]) pts.push(a); if (pts.length < 4) return null; }
  else if (pts.length < 2) return null;
  return pts;
}
function geom(g) {
  switch (g?.type) {
    case 'Point': return { type: 'Point', coordinates: rnd(g.coordinates) };
    case 'MultiPoint': return { type: 'MultiPoint', coordinates: g.coordinates.map(rnd) };
    case 'LineString': { const c = line(g.coordinates); return c && { type: 'LineString', coordinates: c }; }
    case 'MultiLineString': { const c = g.coordinates.map(l => line(l)).filter(Boolean); return c.length ? { type: 'MultiLineString', coordinates: c } : null; }
    case 'Polygon': { const c = g.coordinates.map(r => line(r, true)).filter(Boolean); return c.length ? { type: 'Polygon', coordinates: c } : null; }
    case 'MultiPolygon': { const c = g.coordinates.map(p => p.map(r => line(r, true)).filter(Boolean)).filter(p => p.length); return c.length ? { type: 'MultiPolygon', coordinates: c } : null; }
    default: return null;
  }
}
export function slimLayer(fc) {
  const features = [];
  for (const f of fc?.features || []) {
    const g = geom(f.geometry); if (!g) continue;
    const p = { type: f.properties?.type || '' }; if (f.properties?.name) p.name = f.properties.name;
    features.push({ type: 'Feature', properties: p, geometry: g });
  }
  return { type: 'FeatureCollection', features };
}
export const jsonMB = o => new Blob([JSON.stringify(o)]).size / 1048576;
