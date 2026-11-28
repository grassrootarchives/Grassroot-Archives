// River zones as areas of the valley: every place belongs to the zone of its nearest point on the river.
// A zone is { name, from, to } as fractions of river length from the source (0) to the mouth (1).
import { cumulativeKm } from './geom.js';

// Default zones for a new valley: the three used in the study method.
export const DEFAULT_ZONES = [
  { name: 'Headwater zone', from: 0, to: 0.33 },
  { name: 'Mid section', from: 0.33, to: 0.67 },
  { name: 'Tail-water zone', from: 0.67, to: 1 }
];
// Soft, distinct tints (upstream to downstream): forest, sand, river blue, then extras for more zones.
export const ZONE_COLORS = ['#4E8F63', '#C79A3C', '#3F78A8', '#8A62A8', '#B0574F'];

export const zoneIndex = (zones, f) => {
  if (!zones?.length || f == null) return -1;
  const i = zones.findIndex(z => f >= z.from && f <= z.to);
  return i >= 0 ? i : (f < zones[0].from ? 0 : zones.length - 1);
};

// Even samples along the river with their fraction of total length.
function riverSamples(coords, n = 400) {
  const cum = cumulativeKm(coords), total = cum[cum.length - 1] || 1, out = [];
  let j = 0;
  for (let i = 0; i < n; i++) {
    const km = total * i / (n - 1);
    while (j < cum.length - 2 && cum[j + 1] < km) j++;
    const seg = cum[j + 1] - cum[j] || 1e-9, t = Math.min(1, Math.max(0, (km - cum[j]) / seg));
    out.push([coords[j][0] + (coords[j + 1][0] - coords[j][0]) * t, coords[j][1] + (coords[j + 1][1] - coords[j][1]) * t, km / total]);
  }
  return { pts: out, total };
}

function pointInRings(rings, x, y) {
  let inside = false;
  for (const ring of rings) for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
// Outer rings of a Polygon / MultiPolygon feature, or a bare array of rings.
export function boundaryRings(boundary) {
  const g = boundary?.geometry || boundary?.features?.[0]?.geometry;
  if (g?.type === 'Polygon') return g.coordinates;
  if (g?.type === 'MultiPolygon') return g.coordinates.flat();
  return Array.isArray(boundary) ? boundary : null;
}

// A grid over `bounds` holding each cell's zone index (z), plus a mask of cells inside the watershed.
// The zone field is not masked, so its isolines are clean dividing lines that can be clipped to the watershed.
export function zoneField({ bounds, river, zones, boundary, cols = 220 }) {
  const coords = river?.geometry?.coordinates || river;
  if (!coords || coords.length < 2 || !zones?.length) return null;
  const [W, S, E, N] = bounds, kx = Math.cos((S + N) / 2 * Math.PI / 180);
  const w = cols, h = Math.max(20, Math.round(cols * (N - S) / ((E - W) * kx)));
  const { pts, total } = riverSamples(coords);
  const rings = boundaryRings(boundary);
  const z = new Float32Array(w * h), inside = new Uint8Array(w * h);
  const sums = zones.map(() => [0, 0, 0]);
  for (let r = 0; r < h; r++) {
    const lat = N - (r + 0.5) * (N - S) / h;
    for (let c = 0; c < w; c++) {
      const lon = W + (c + 0.5) * (E - W) / w;
      let best = 0, bd = Infinity;
      for (let i = 0; i < pts.length; i++) { const dx = (pts[i][0] - lon) * kx, dy = pts[i][1] - lat, d = dx * dx + dy * dy; if (d < bd) { bd = d; best = i; } }
      const zi = zoneIndex(zones, pts[best][2]);
      z[r * w + c] = zi;
      const inn = rings ? pointInRings(rings, lon, lat) : 1;
      inside[r * w + c] = inn ? 1 : 0;
      if (inn && zi >= 0) { sums[zi][0] += lon; sums[zi][1] += lat; sums[zi][2]++; }
    }
  }
  // Each zone's label sits at the centre of its area; its river stretch in km goes with it.
  const labels = zones.map((zn, i) => sums[i][2] ? { i, name: zn.name, lon: sums[i][0] / sums[i][2], lat: sums[i][1] / sums[i][2], kmFrom: zn.from * total, kmTo: zn.to * total } : null).filter(Boolean);
  return { w, h, bounds, z, inside, nodata: null, labels, total };
}

// A transparent PNG data URL of the zones inside the watershed, for the real-world map.
export function zoneImage(field, alpha = 0.28, focus = -1) {
  const cv = document.createElement('canvas'); cv.width = field.w; cv.height = field.h;
  const ctx = cv.getContext('2d'), img = ctx.createImageData(field.w, field.h);
  const rgb = ZONE_COLORS.map(hx => [1, 3, 5].map(o => parseInt(hx.slice(o, o + 2), 16)));
  for (let i = 0; i < field.w * field.h; i++) {
    if (!field.inside[i] || field.z[i] < 0) continue;
    const [r, g, b] = rgb[field.z[i] % rgb.length];
    const a = focus < 0 ? alpha : field.z[i] === focus ? alpha * 1.6 : alpha * 0.25;
    img.data.set([r, g, b, Math.round(Math.min(1, a) * 255)], i * 4);
  }
  ctx.putImageData(img, 0, 0);
  return cv.toDataURL('image/png');
}
