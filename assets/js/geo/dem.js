// Read an uploaded elevation source into a lon/lat grid (WGS 84), in the browser.
// Supports GeoTIFF elevation models (any coordinate system proj4 knows) and contour-line files
// (GeoJSON, zipped Shapefile, KML) with an elevation attribute.
import { CDN } from '../config.js';

const MAX_COLS = 360;

let proj4P = null;
const loadProj4 = () => (proj4P ||= import(CDN.proj4).then(m => m.default || m));

async function projDef(epsg) {
  if (epsg === 4326 || (epsg >= 4000 && epsg < 5000)) return null; // geographic degrees
  if (epsg >= 32601 && epsg <= 32660) return `+proj=utm +zone=${epsg - 32600} +datum=WGS84 +units=m +no_defs`;
  if (epsg >= 32701 && epsg <= 32760) return `+proj=utm +zone=${epsg - 32700} +south +datum=WGS84 +units=m +no_defs`;
  if (epsg === 3857 || epsg === 900913) return '+proj=merc +a=6378137 +b=6378137 +lat_ts=0 +lon_0=0 +x_0=0 +y_0=0 +k=1 +units=m +nadgrids=@null +no_defs';
  if (epsg >= 24342 && epsg <= 24347) return `+proj=utm +zone=${epsg - 24300} +a=6377301.243 +b=6356100.230165384 +towgs84=283,682,231,0,0,0,0 +units=m +no_defs`; // Kalianpur 1975 UTM
  const r = await fetch(`https://epsg.io/${epsg}.proj4`).catch(() => null);
  if (r?.ok) { const t = (await r.text()).trim(); if (t.startsWith('+proj')) return t; }
  throw new Error(`Unknown coordinate system EPSG:${epsg}. Re-save the file in WGS 84 (EPSG:4326) or a UTM zone and upload again.`);
}

function targetShape(bounds, maxCols = MAX_COLS) {
  const [W, S, E, N] = bounds, k = Math.cos((S + N) / 2 * Math.PI / 180);
  const aspect = (N - S) / ((E - W) * k);
  const cols = maxCols, rows = Math.max(16, Math.round(cols * aspect));
  return [cols, Math.min(rows, maxCols * 2)];
}

export async function readGeoTIFF(file, onStep = () => {}) {
  onStep('Reading the GeoTIFF');
  const { fromArrayBuffer } = await import(CDN.geotiff);
  const tiff = await fromArrayBuffer(await file.arrayBuffer());
  const img = await tiff.getImage();
  const keys = img.getGeoKeys() || {};
  const epsg = keys.ProjectedCSTypeGeoKey || keys.GeographicTypeGeoKey || 4326;
  const nodataRaw = img.getGDALNoData();
  const [x0, y0, x1, y1] = img.getBoundingBox();
  const def = await projDef(epsg);
  const W0 = img.getWidth(), H0 = img.getHeight();
  const cellSize = Math.abs((x1 - x0) / W0);
  let grid;
  if (!def) {
    const bounds = [x0, y0, x1, y1];
    const [cols, rows] = targetShape(bounds);
    onStep(`Resampling ${W0}×${H0} to ${cols}×${rows}`);
    const r = await img.readRasters({ width: cols, height: rows, resampleMethod: 'bilinear', samples: [0], interleave: true });
    grid = { w: cols, h: rows, bounds, z: Array.from(r, v => (nodataRaw != null && Math.abs(v - nodataRaw) < 1e-6) || v < -1000 ? -9999 : Math.round(v)), nodata: -9999 };
  } else {
    const proj4 = await loadProj4();
    const tr = proj4(def, 'EPSG:4326');
    const sw = Math.min(W0, 1400), sh = Math.round(sw * H0 / W0);
    onStep(`Reprojecting from EPSG:${epsg} to latitude/longitude`);
    const src = await img.readRasters({ width: sw, height: sh, resampleMethod: 'bilinear', samples: [0], interleave: true });
    // Bounds in lon/lat from the edges of the source box.
    const pts = [];
    for (let i = 0; i <= 20; i++) { const t = i / 20; pts.push([x0 + (x1 - x0) * t, y0], [x0 + (x1 - x0) * t, y1], [x0, y0 + (y1 - y0) * t], [x1, y0 + (y1 - y0) * t]); }
    const ll = pts.map(p => tr.forward(p));
    const bounds = [Math.min(...ll.map(p => p[0])), Math.min(...ll.map(p => p[1])), Math.max(...ll.map(p => p[0])), Math.max(...ll.map(p => p[1]))];
    const [cols, rows] = targetShape(bounds);
    const inv = proj4('EPSG:4326', def);
    const z = new Array(cols * rows);
    const sv = (cx, cy) => { const v = src[cy * sw + cx]; return (nodataRaw != null && Math.abs(v - nodataRaw) < 1e-6) || v < -1000 ? null : v; };
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const lon = bounds[0] + (c + 0.5) * (bounds[2] - bounds[0]) / cols, lat = bounds[3] - (r + 0.5) * (bounds[3] - bounds[1]) / rows;
      const [x, y] = inv.forward([lon, lat]);
      const fx = (x - x0) / (x1 - x0) * sw - 0.5, fy = (y1 - y) / (y1 - y0) * sh - 0.5;
      if (fx < 0 || fy < 0 || fx > sw - 1 || fy > sh - 1) { z[r * cols + c] = -9999; continue; }
      const ix = Math.floor(fx), iy = Math.floor(fy), dx = fx - ix, dy = fy - iy;
      const a = sv(ix, iy), b = sv(Math.min(sw - 1, ix + 1), iy), c2 = sv(ix, Math.min(sh - 1, iy + 1)), d = sv(Math.min(sw - 1, ix + 1), Math.min(sh - 1, iy + 1));
      if ([a, b, c2, d].some(v => v == null)) { const ok = [a, b, c2, d].filter(v => v != null); z[r * cols + c] = ok.length ? Math.round(ok.reduce((s, v) => s + v, 0) / ok.length) : -9999; continue; }
      z[r * cols + c] = Math.round((a * (1 - dx) + b * dx) * (1 - dy) + (c2 * (1 - dx) + d * dx) * dy);
    }
    grid = { w: cols, h: rows, bounds, z, nodata: -9999 };
  }
  return { grid, info: { source: 'Elevation model (GeoTIFF)', crs: `EPSG:${epsg}`, cellSize: def ? `${Math.round(cellSize)} m` : `${(cellSize * 3600).toFixed(1)} arc-seconds`, original: `${W0} × ${H0} cells` } };
}

// ---------- vector files ----------
export async function readVectorFile(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith('.zip')) {
    const shp = (await import(CDN.shpjs)).default;
    const out = await shp(await file.arrayBuffer());
    return Array.isArray(out) ? { type: 'FeatureCollection', features: out.flatMap(f => f.features) } : out;
  }
  if (name.endsWith('.kml')) {
    const { kml } = await import(CDN.togeojson);
    return kml(new DOMParser().parseFromString(await file.text(), 'text/xml'));
  }
  if (name.endsWith('.csv')) return csvToGeoJSON(await file.text());
  const gj = JSON.parse(await file.text());
  return reprojectIfNeeded(gj.type === 'FeatureCollection' ? gj : gj.type === 'Feature' ? { type: 'FeatureCollection', features: [gj] } : { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: gj }] }, gj.crs);
}

async function reprojectIfNeeded(fc, crs) {
  const name = crs?.properties?.name || '';
  const m = name.match(/EPSG:{1,2}(\d+)/i);
  const first = fc.features.find(f => f.geometry)?.geometry;
  const c = first && JSON.stringify(first.coordinates).match(/-?\d+(\.\d+)?/g)?.slice(0, 2).map(Number);
  const looksProjected = c && (Math.abs(c[0]) > 180 || Math.abs(c[1]) > 90);
  if (!m && !looksProjected) return fc;
  if (!m) throw new Error('These coordinates are not in latitude/longitude and the file does not say which system they use. Re-save it as GeoJSON in EPSG:4326.');
  const def = await projDef(Number(m[1])); if (!def) return fc;
  const proj4 = await loadProj4(); const tr = proj4(def, 'EPSG:4326');
  const walk = co => typeof co[0] === 'number' ? tr.forward(co) : co.map(walk);
  fc.features.forEach(f => { if (f.geometry) f.geometry.coordinates = walk(f.geometry.coordinates); });
  return fc;
}

export function csvToGeoJSON(text) {
  const rows = parseCSV(text); if (!rows.length) return { type: 'FeatureCollection', features: [] };
  const head = rows[0].map(h => h.trim().toLowerCase());
  const col = names => head.findIndex(h => names.includes(h));
  const iLat = col(['lat', 'latitude', 'y']), iLon = col(['lng', 'lon', 'long', 'longitude', 'x']);
  if (iLat < 0 || iLon < 0) throw new Error('The CSV needs latitude and longitude columns (for example "lat" and "lng").');
  const features = rows.slice(1).filter(r => r.length > 1).map(r => {
    const props = {}; head.forEach((h, i) => { if (i !== iLat && i !== iLon) props[h] = r[i]; });
    return { type: 'Feature', properties: props, geometry: { type: 'Point', coordinates: [Number(r[iLon]), Number(r[iLat])] } };
  }).filter(f => Number.isFinite(f.geometry.coordinates[0]) && Number.isFinite(f.geometry.coordinates[1]));
  return { type: 'FeatureCollection', features };
}
function parseCSV(text) {
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"' && text[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
    else if (ch === '"') q = true; else if (ch === ',') { row.push(cur); cur = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; }
    else cur += ch;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows.filter(r => r.some(c => c.trim() !== ''));
}

export function elevationFields(fc) {
  const f = fc.features.find(x => x.properties) || {};
  return Object.keys(f.properties || {}).filter(k => fc.features.slice(0, 50).some(x => Number.isFinite(Number(x.properties?.[k]))));
}
export function guessElevationField(fields) {
  return fields.find(k => /^(elev|elevation|contour|height|hgt|alt|altitude|z|level|value)$/i.test(k)) || fields.find(k => /elev|contour|height/i.test(k)) || fields[0];
}

// Build an elevation grid from contour lines: burn line elevations into cells, then fill the gaps
// with a smooth (Laplace) interpolation.
export function gridFromContours(fc, field, onStep = () => {}) {
  const lines = [];
  const add = (co, z) => lines.push({ co, z });
  for (const f of fc.features) {
    const z = Number(f.properties?.[field]); if (!f.geometry || !Number.isFinite(z)) continue;
    const g = f.geometry;
    if (g.type === 'LineString') add(g.coordinates, z);
    else if (g.type === 'MultiLineString' || g.type === 'Polygon') g.coordinates.forEach(c => add(c, z));
    else if (g.type === 'MultiPolygon') g.coordinates.forEach(p => p.forEach(c => add(c, z)));
  }
  if (!lines.length) throw new Error(`No contour lines with a numeric "${field}" value were found.`);
  let W = Infinity, S = Infinity, E = -Infinity, N = -Infinity;
  lines.forEach(l => l.co.forEach(([x, y]) => { W = Math.min(W, x); E = Math.max(E, x); S = Math.min(S, y); N = Math.max(N, y); }));
  const bounds = [W, S, E, N];
  const [cols, rows] = targetShape(bounds, 300);
  const sum = new Float64Array(cols * rows), cnt = new Uint16Array(cols * rows);
  const cell = (x, y) => [Math.floor((x - W) / (E - W) * cols), Math.floor((N - y) / (N - S) * rows)];
  onStep(`Burning ${lines.length} contour lines into a ${cols}×${rows} grid`);
  for (const { co, z } of lines) for (let i = 1; i < co.length; i++) {
    const [ax, ay] = co[i - 1], [bx, by] = co[i];
    const [c1, r1] = cell(ax, ay), [c2, r2] = cell(bx, by);
    const steps = Math.max(1, Math.abs(c2 - c1), Math.abs(r2 - r1)) * 2;
    for (let s = 0; s <= steps; s++) {
      const [c, r] = cell(ax + (bx - ax) * s / steps, ay + (by - ay) * s / steps);
      if (c < 0 || r < 0 || c >= cols || r >= rows) continue;
      sum[r * cols + c] += z; cnt[r * cols + c]++;
    }
  }
  const z = new Float64Array(cols * rows), known = new Uint8Array(cols * rows);
  const queue = [];
  for (let i = 0; i < z.length; i++) if (cnt[i]) { z[i] = sum[i] / cnt[i]; known[i] = 1; queue.push(i); }
  // Seed unknown cells from their nearest known neighbour (breadth first), then relax.
  const seen = known.slice();
  for (let qi = 0; qi < queue.length; qi++) {
    const i = queue[qi], r = Math.floor(i / cols), c = i % cols;
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const rr = r + dr, cc = c + dc; if (rr < 0 || cc < 0 || rr >= rows || cc >= cols) continue;
      const j = rr * cols + cc; if (seen[j]) continue; seen[j] = 1; z[j] = z[i]; queue.push(j);
    }
  }
  onStep('Interpolating between contours');
  for (let it = 0; it < 400; it++) for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const i = r * cols + c; if (known[i]) continue;
    let s = 0, n = 0;
    if (r > 0) { s += z[i - cols]; n++; } if (r < rows - 1) { s += z[i + cols]; n++; }
    if (c > 0) { s += z[i - 1]; n++; } if (c < cols - 1) { s += z[i + 1]; n++; }
    z[i] = s / n;
  }
  return { grid: { w: cols, h: rows, bounds, z: Array.from(z, v => Math.round(v)), nodata: -9999 }, info: { source: `Contour lines (${lines.length} lines, field "${field}")`, crs: 'EPSG:4326', cellSize: '—', original: `${fc.features.length} features` } };
}
