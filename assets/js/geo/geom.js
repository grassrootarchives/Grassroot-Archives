// Geometry helpers shared by the public map and the admin.
// A "grid" is { w, h, bounds: [west, south, east, north], z, nodata } with row 0 at the north edge.

const R = 6371.0088; // km

export function haversineKm(a, b) {
  const toRad = Math.PI / 180;
  const dLat = (b[1] - a[1]) * toRad, dLon = (b[0] - a[0]) * toRad;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * toRad) * Math.cos(b[1] * toRad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

export function cellToLonLat(grid, col, row) {
  const [W, S, E, N] = grid.bounds;
  return [W + (col + 0.5) * (E - W) / grid.w, N - (row + 0.5) * (N - S) / grid.h];
}

export function lonLatToCell(grid, lon, lat) {
  const [W, S, E, N] = grid.bounds;
  return [(lon - W) / (E - W) * grid.w - 0.5, (N - lat) / (N - S) * grid.h - 0.5];
}

export function inBounds(bounds, lon, lat) {
  const [W, S, E, N] = bounds;
  return lon >= W && lon <= E && lat >= S && lat <= N;
}

// Bilinear elevation at a lon/lat; null outside the grid or on nodata.
export function sampleElevation(grid, lon, lat) {
  if (!grid || !inBounds(grid.bounds, lon, lat)) return null;
  const [cx, cy] = lonLatToCell(grid, lon, lat);
  const x0 = Math.max(0, Math.min(grid.w - 1, Math.floor(cx))), y0 = Math.max(0, Math.min(grid.h - 1, Math.floor(cy)));
  const x1 = Math.min(grid.w - 1, x0 + 1), y1 = Math.min(grid.h - 1, y0 + 1);
  const fx = Math.max(0, Math.min(1, cx - x0)), fy = Math.max(0, Math.min(1, cy - y0));
  const g = (x, y) => grid.z[y * grid.w + x];
  const vals = [g(x0, y0), g(x1, y0), g(x0, y1), g(x1, y1)];
  if (vals.some(v => v === grid.nodata || v == null || Number.isNaN(v))) {
    const ok = vals.filter(v => !(v === grid.nodata || v == null || Number.isNaN(v)));
    return ok.length ? ok.reduce((a, b) => a + b, 0) / ok.length : null;
  }
  const top = vals[0] * (1 - fx) + vals[1] * fx, bot = vals[2] * (1 - fx) + vals[3] * fx;
  return top * (1 - fy) + bot * fy;
}

// Cumulative distance (km) along a line of [lon, lat] points.
export function cumulativeKm(coords) {
  const out = [0];
  for (let i = 1; i < coords.length; i++) out.push(out[i - 1] + haversineKm(coords[i - 1], coords[i]));
  return out;
}

// Nearest point on a line: returns { km, distanceKm, point }.
export function snapToLine(coords, lon, lat) {
  if (!coords || coords.length < 2) return null;
  const cum = cumulativeKm(coords);
  const kx = Math.cos(lat * Math.PI / 180);
  let best = null;
  for (let i = 0; i < coords.length - 1; i++) {
    const [ax, ay] = coords[i], [bx, by] = coords[i + 1];
    const dx = (bx - ax) * kx, dy = by - ay, px = (lon - ax) * kx, py = lat - ay;
    const len2 = dx * dx + dy * dy || 1e-18;
    const t = Math.max(0, Math.min(1, (px * dx + py * dy) / len2));
    const q = [ax + (bx - ax) * t, ay + (by - ay) * t];
    const d = haversineKm(q, [lon, lat]);
    if (!best || d < best.distanceKm) best = { km: cum[i] + (cum[i + 1] - cum[i]) * t, distanceKm: d, point: q };
  }
  return best;
}

export function zoneFor(zones, fraction) {
  if (!zones || fraction == null) return null;
  const z = zones.find(z => fraction >= z.from && fraction <= z.to) || zones[zones.length - 1];
  return z ? z.name : null;
}

// Elevation profile along the river: [[km, elevation], ...] with at most n points.
export function riverProfile(grid, coords, n = 80) {
  const cum = cumulativeKm(coords);
  const total = cum[cum.length - 1];
  const out = [];
  let j = 0;
  for (let i = 0; i < n; i++) {
    const km = total * i / (n - 1);
    while (j < cum.length - 2 && cum[j + 1] < km) j++;
    const seg = cum[j + 1] - cum[j] || 1e-9, t = (km - cum[j]) / seg;
    const lon = coords[j][0] + (coords[j + 1][0] - coords[j][0]) * t;
    const lat = coords[j][1] + (coords[j + 1][1] - coords[j][1]) * t;
    const e = sampleElevation(grid, lon, lat);
    if (e != null) out.push([+km.toFixed(2), Math.round(e)]);
  }
  // A river never runs uphill: smooth out DEM noise with a running minimum.
  for (let i = 1; i < out.length; i++) out[i][1] = Math.min(out[i][1], out[i - 1][1]);
  return out;
}

export function formatDMS(lat, lon) {
  const f = (v, pos, neg) => {
    const a = Math.abs(v), d = Math.floor(a), m = Math.floor((a - d) * 60), s = Math.round(((a - d) * 60 - m) * 60);
    return `${d}°${String(m).padStart(2, '0')}'${String(s).padStart(2, '0')}"${v >= 0 ? pos : neg}`;
  };
  return `${f(lat, 'N', 'S')} ${f(lon, 'E', 'W')}`;
}
