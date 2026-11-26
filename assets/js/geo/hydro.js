// Trace the main river and its watershed from an elevation grid.
// Steps: fill depressions (priority flood), D8 flow directions, flow accumulation,
// outlet = edge cell with the largest accumulation, main stem traced upstream along
// the largest contributing neighbour, watershed = every cell that drains to the outlet.
import { isolines, simplify } from './contour.js';
import { cellToLonLat } from './geom.js';

const DX = [1, 1, 0, -1, -1, -1, 0, 1], DY = [0, 1, 1, 1, 0, -1, -1, -1];
const DIST = [1, Math.SQRT2, 1, Math.SQRT2, 1, Math.SQRT2, 1, Math.SQRT2];

class Heap {
  constructor() { this.k = []; this.v = []; }
  push(key, val) {
    const k = this.k, v = this.v; let i = k.length; k.push(key); v.push(val);
    while (i > 0) { const p = (i - 1) >> 1; if (k[p] <= key) break; k[i] = k[p]; v[i] = v[p]; i = p; }
    k[i] = key; v[i] = val;
  }
  pop() {
    const k = this.k, v = this.v, topV = v[0], lastK = k.pop(), lastV = v.pop(), n = k.length;
    if (n) {
      let i = 0;
      while (true) {
        let c = 2 * i + 1; if (c >= n) break;
        if (c + 1 < n && k[c + 1] < k[c]) c++;
        if (k[c] >= lastK) break;
        k[i] = k[c]; v[i] = v[c]; i = c;
      }
      k[i] = lastK; v[i] = lastV;
    }
    return topV;
  }
  get size() { return this.k.length; }
}

function isNo(grid, v) { return v === grid.nodata || v == null || Number.isNaN(v); }

export function fillDepressions(grid) {
  const { w, h } = grid, n = w * h, z = new Float64Array(n), done = new Uint8Array(n), heap = new Heap();
  for (let i = 0; i < n; i++) z[i] = isNo(grid, grid.z[i]) ? -Infinity : grid.z[i];
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
    const i = r * w + c;
    if (r === 0 || c === 0 || r === h - 1 || c === w - 1 || z[i] === -Infinity) { done[i] = 1; heap.push(z[i], i); }
  }
  while (heap.size) {
    const i = heap.pop(), r = Math.floor(i / w), c = i % w;
    for (let d = 0; d < 8; d++) {
      const rr = r + DY[d], cc = c + DX[d];
      if (rr < 0 || cc < 0 || rr >= h || cc >= w) continue;
      const j = rr * w + cc;
      if (done[j]) continue;
      done[j] = 1;
      if (z[j] <= z[i]) z[j] = z[i] + 1e-3; // tiny gradient keeps flats draining
      heap.push(z[j], j);
    }
  }
  return z;
}

export function flowDirections(w, h, z) {
  const dir = new Int8Array(w * h).fill(-1);
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
    const i = r * w + c; if (z[i] === -Infinity) continue;
    let best = 0, bd = -1;
    for (let d = 0; d < 8; d++) {
      const rr = r + DY[d], cc = c + DX[d];
      if (rr < 0 || cc < 0 || rr >= h || cc >= w) continue;
      const j = rr * w + cc; if (z[j] === -Infinity) continue;
      const s = (z[i] - z[j]) / DIST[d];
      if (s > best) { best = s; bd = d; }
    }
    dir[i] = bd;
  }
  return dir;
}

export function accumulation(w, h, z, dir) {
  const n = w * h, acc = new Float64Array(n).fill(1), order = new Uint32Array(n);
  for (let i = 0; i < n; i++) order[i] = i;
  order.sort((a, b) => z[b] - z[a]);
  for (const i of order) {
    const d = dir[i]; if (d < 0) continue;
    const r = Math.floor(i / w) + DY[d], c = (i % w) + DX[d];
    acc[r * w + c] += acc[i];
  }
  return acc;
}

// Main river from source to outlet, as [lon, lat] coordinates, plus the watershed polygon.
export function traceRiver(grid, { minShare = 0.004 } = {}) {
  const { w, h } = grid;
  const z = fillDepressions(grid), dir = flowDirections(w, h, z), acc = accumulation(w, h, z, dir);
  // Outlet: the cell with the largest accumulation whose flow leaves the grid (or has no lower neighbour).
  let outlet = -1, best = -1;
  for (let i = 0; i < w * h; i++) {
    if (z[i] === -Infinity) continue;
    const r = Math.floor(i / w), c = i % w, d = dir[i];
    const leaves = d < 0 || r + DY[d] < 0 || c + DX[d] < 0 || r + DY[d] >= h || c + DX[d] >= w || z[(r + DY[d]) * w + c + DX[d]] === -Infinity;
    const edge = r === 0 || c === 0 || r === h - 1 || c === w - 1;
    if ((leaves || edge) && acc[i] > best) { best = acc[i]; outlet = i; }
  }
  // Upstream inflow lists.
  const inflow = new Map();
  for (let i = 0; i < w * h; i++) {
    const d = dir[i]; if (d < 0) continue;
    const j = (Math.floor(i / w) + DY[d]) * w + (i % w) + DX[d];
    if (!inflow.has(j)) inflow.set(j, []);
    inflow.get(j).push(i);
  }
  // Main stem.
  const stem = [outlet];
  let cur = outlet;
  const stop = Math.max(3, best * minShare);
  while (true) {
    const ups = inflow.get(cur) || [];
    let nxt = -1, a = -1;
    for (const u of ups) if (acc[u] > a) { a = acc[u]; nxt = u; }
    if (nxt < 0 || a < stop) break;
    stem.push(nxt); cur = nxt;
  }
  stem.reverse();
  const coords = stem.map(i => cellToLonLat(grid, i % w, Math.floor(i / w)));
  // Light smoothing of the staircase D8 path.
  const smooth = coords.map((p, i) => {
    if (i === 0 || i === coords.length - 1) return p;
    const a = coords[i - 1], b = coords[i + 1];
    return [(a[0] + 2 * p[0] + b[0]) / 4, (a[1] + 2 * p[1] + b[1]) / 4];
  });
  // Watershed mask.
  const mask = new Float32Array(w * h);
  const queue = [outlet]; mask[outlet] = 1;
  while (queue.length) {
    const i = queue.pop();
    for (const u of inflow.get(i) || []) if (!mask[u]) { mask[u] = 1; queue.push(u); }
  }
  const rings = isolines({ w, h, z: mask, nodata: -9999 }, 0.5).map(r => simplify(r, 0.6));
  rings.sort((a, b) => b.length - a.length);
  const boundary = rings.length ? rings[0].map(([c, r]) => cellToLonLat(grid, c, r)) : null;
  if (boundary) boundary.push(boundary[0]);
  return {
    river: { type: 'Feature', properties: { name: 'Main river' }, geometry: { type: 'LineString', coordinates: smooth } },
    boundary: boundary ? { type: 'Feature', properties: { name: 'Watershed' }, geometry: { type: 'Polygon', coordinates: [boundary] } } : null,
    areaCells: mask.reduce((s, v) => s + v, 0)
  };
}
