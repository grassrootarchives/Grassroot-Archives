// Marching-squares isolines for an elevation grid.
// grid: { w, h, z: Float32Array|number[] (row-major, row 0 = north), nodata }
// Returns rings as arrays of [col, row] points in grid coordinates (cell centres at integer positions).
// The grid is padded with a very low value so every isoline closes into a ring; that makes the
// region "z >= t" fillable with fill-rule evenodd, and the border runs outside the data area.

const LOW = -1e9;

function padded(grid) {
  const W = grid.w + 2, H = grid.h + 2, out = new Float64Array(W * H).fill(LOW);
  for (let r = 0; r < grid.h; r++) {
    for (let c = 0; c < grid.w; c++) {
      const v = grid.z[r * grid.w + c];
      out[(r + 1) * W + c + 1] = (v === grid.nodata || v == null || Number.isNaN(v)) ? LOW : v;
    }
  }
  return { W, H, v: out };
}

// Edge ids: for cell (x,y) top edge = horizontal edge at row y between x..x+1, etc.
// We key interpolated points by edge so segments can be stitched.
export function isolines(grid, threshold) {
  const { W, H, v } = padded(grid);
  const segs = new Map(); // startKey -> {endKey, a, b}
  const pts = new Map();
  const hKey = (x, y) => 'h' + x + ',' + y; // edge from (x,y) to (x+1,y)
  const vKey = (x, y) => 'v' + x + ',' + y; // edge from (x,y) to (x,y+1)
  const lerp = (a, b) => (threshold - a) / (b - a);
  const point = (key, x, y, horiz) => {
    let p = pts.get(key);
    if (!p) {
      if (horiz) { const a = v[y * W + x], b = v[y * W + x + 1]; p = [x + lerp(a, b), y]; }
      else { const a = v[y * W + x], b = v[(y + 1) * W + x]; p = [x, y + lerp(a, b)]; }
      pts.set(key, p);
    }
    return p;
  };
  const add = (k1, k2) => { segs.set(k1, k2); };
  for (let y = 0; y < H - 1; y++) {
    for (let x = 0; x < W - 1; x++) {
      const tl = v[y * W + x] >= threshold, tr = v[y * W + x + 1] >= threshold;
      const br = v[(y + 1) * W + x + 1] >= threshold, bl = v[(y + 1) * W + x] >= threshold;
      const code = (tl ? 8 : 0) | (tr ? 4 : 0) | (br ? 2 : 0) | (bl ? 1 : 0);
      if (code === 0 || code === 15) continue;
      const T = hKey(x, y), B = hKey(x, y + 1), L = vKey(x, y), R = vKey(x + 1, y);
      point(T, x, y, true); point(B, x, y + 1, true); point(L, x, y, false); point(R, x + 1, y, false);
      // Orientation: high ground kept on the left as we walk the segment.
      switch (code) {
        case 1: add(L, B); break;
        case 2: add(B, R); break;
        case 3: add(L, R); break;
        case 4: add(R, T); break;
        case 5: {
          const c = (v[y * W + x] + v[y * W + x + 1] + v[(y + 1) * W + x + 1] + v[(y + 1) * W + x]) / 4;
          if (c >= threshold) { add(L, T); add(R, B); } else { add(L, B); add(R, T); }
          break;
        }
        case 6: add(B, T); break;
        case 7: add(L, T); break;
        case 8: add(T, L); break;
        case 9: add(T, B); break;
        case 10: {
          const c = (v[y * W + x] + v[y * W + x + 1] + v[(y + 1) * W + x + 1] + v[(y + 1) * W + x]) / 4;
          if (c >= threshold) { add(T, R); add(B, L); } else { add(T, L); add(B, R); }
          break;
        }
        case 11: add(T, R); break;
        case 12: add(R, L); break;
        case 13: add(R, B); break;
        case 14: add(B, L); break;
      }
    }
  }
  // Stitch segments into rings.
  const rings = [];
  const used = new Set();
  for (const start of segs.keys()) {
    if (used.has(start)) continue;
    const ring = [];
    let k = start, guard = 0;
    while (k && !used.has(k) && guard++ < 1e7) {
      used.add(k);
      const p = pts.get(k);
      ring.push([p[0] - 1, p[1] - 1]); // undo padding offset
      k = segs.get(k);
    }
    if (ring.length > 2) rings.push(ring);
  }
  return rings;
}

// Douglas–Peucker simplification (tolerance in grid cells).
export function simplify(ring, tol = 0.35) {
  if (ring.length < 5) return ring;
  const keep = new Uint8Array(ring.length); keep[0] = keep[ring.length - 1] = 1;
  const stack = [[0, ring.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let max = 0, idx = -1;
    const [x1, y1] = ring[a], [x2, y2] = ring[b];
    const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1e-9;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs(dy * ring[i][0] - dx * ring[i][1] + x2 * y1 - y2 * x1) / len;
      if (d > max) { max = d; idx = i; }
    }
    if (max > tol && idx > 0) { keep[idx] = 1; stack.push([a, idx], [idx, b]); }
  }
  return ring.filter((_, i) => keep[i]);
}

export function thresholds(min, max, step) {
  const out = [];
  for (let t = Math.ceil(min / step) * step; t <= max; t += step) out.push(t);
  return out;
}

export function gridRange(grid) {
  let lo = Infinity, hi = -Infinity;
  for (const val of grid.z) {
    if (val === grid.nodata || val == null || Number.isNaN(val)) continue;
    if (val < lo) lo = val;
    if (val > hi) hi = val;
  }
  return [lo, hi];
}
