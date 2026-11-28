// Create or edit a river basin (valley): map data → details → style → layers → save/publish.
import { DEFAULT_ZONES } from '../geo/zones.js';
import { requireAdmin, layout, toast, errMsg, uploadJSON, slugify, param } from './common.js';
import { loadValleyData } from '../db.js';
import { esc } from '../ui.js';
import { siteUrl } from '../config.js';
import { createMap } from '../map/map.js';
import { STYLES } from '../map/symbols.js';
import { readGeoTIFF, readVectorFile, elevationFields, guessElevationField, gridFromContours } from '../geo/dem.js';
import { traceRiver } from '../geo/hydro.js';
import { gridRange } from '../geo/contour.js';
import { cumulativeKm, riverProfile } from '../geo/geom.js';
import { cleanLayer, summarise, osmSettlements, osmInfra, CSV_TEMPLATE, slimLayer, jsonMB } from '../geo/layers.js';

const app = document.getElementById('app');
const { sb, user } = await requireAdmin('basins');
const id = param('id');
let valley = null;
if (id) {
  const { data, error } = await sb.from('valleys').select('*').eq('id', id).maybeSingle();
  if (error || !data) { layout(app, 'basins', user, `<div class="empty">That river basin was not found.</div>`); throw error || new Error('not found'); }
  valley = data;
}
const S = {
  grid: null, river: null, boundary: null, settlements: null, infra: null, info: null,
  dirty: new Set(), style: valley?.map_style || 'contour'
};
if (valley?.data?.grid) {
  try { Object.assign(S, await loadValleyData(valley)); S.info = { source: 'Saved map', crs: valley.crs || 'EPSG:4326', cellSize: '—', original: '' }; }
  catch (e) { toast('Could not load the saved map files: ' + errMsg(e), true); }
}
const v = valley || { name: '', slug: '', region: '', intro: '', source_credit: '', layers_credit: '', contour_interval: 20, zones: structuredClone(DEFAULT_ZONES), show_in_menu: true, menu_order: 100, status: 'draft' };
let zones = (v.zones || []).map(z => ({ ...z }));

const main = layout(app, 'basins', user, `
  <a href="${esc(siteUrl('admin/index.html'))}" class="muted">← River basins</a>
  <div class="admin__head"><div><span class="eyebrow">${valley ? 'Edit river basin' : 'New river basin'}</span><h1>${esc(valley?.name || 'New river basin')}</h1></div>
    <div class="row">${valley ? `<span class="status status--${esc(v.status)}">${esc(v.status)}</span><a class="btn btn--quiet" href="${esc(siteUrl('admin/history.html?table=valleys&key=' + valley.id))}">History</a><a class="btn btn--quiet" target="_blank" rel="noopener" href="${esc(siteUrl('valley.html?v=' + encodeURIComponent(v.slug)))}">View page ↗</a>` : ''}</div></div>

  <section class="panel" aria-labelledby="h-map">
    <h2 id="h-map">01 · Map data</h2>
    <div class="cols">
      <div style="display:flex;flex-direction:column;gap:14px">
        <div class="drop" data-drop>
          <strong>Upload a georeferenced map of the river basin</strong>
          <span class="muted">Elevation model: GeoTIFF (.tif). Contour lines: GeoJSON, zipped Shapefile (.zip) or KML. The coordinate system is read from the file.</span>
          <input type="file" accept=".tif,.tiff,.geojson,.json,.zip,.kml" data-file aria-label="Map file">
          <label class="field" data-field-wrap hidden><span>Which attribute holds the elevation?</span><select data-field></select></label>
        </div>
        <label class="check"><input type="checkbox" checked data-trace> Trace the river and watershed from the terrain</label>
        <details><summary>Or upload your own river line and watershed boundary</summary>
          <div class="row" style="margin-top:10px">
            <label class="field"><span>River line (GeoJSON/KML/zip)</span><input type="file" accept=".geojson,.json,.kml,.zip" data-riverfile></label>
            <label class="field"><span>Watershed boundary</span><input type="file" accept=".geojson,.json,.kml,.zip" data-boundaryfile></label>
          </div></details>
        <div class="row"><button type="button" class="btn btn--primary" data-process disabled>Process map</button></div>
        <ul class="progress" data-progress aria-live="polite"></ul>
        <dl class="facts" data-facts></dl>
      </div>
      <div><div class="minimap" data-preview><div class="empty">The map preview appears after processing.</div></div></div>
    </div>
  </section>

  <section class="panel" aria-labelledby="h-details">
    <h2 id="h-details">02 · Valley details</h2>
    <div class="row">
      <label class="field"><span>Valley name</span><input data-name value="${esc(v.name)}" required></label>
      <label class="field"><span>Page address</span><input data-slug value="${esc(v.slug)}" pattern="[a-z0-9-]+" ${valley ? '' : 'data-auto="1"'}><span class="hint">valley.html?v=<b data-slugshow>${esc(v.slug)}</b></span></label>
      <label class="field"><span>Region</span><input data-region value="${esc(v.region || '')}" placeholder="e.g. Maharashtra"></label>
    </div>
    <label class="field"><span>Introduction (shown above the map)</span><textarea class="serif" data-intro rows="3">${esc(v.intro || '')}</textarea></label>
    <div class="row">
      <label class="field"><span>Map data source (credited on the map) — required</span><input data-source value="${esc(v.source_credit || '')}" placeholder="e.g. SRTM 1 Arc-Second Global DEM, 30 m · NASA / USGS"></label>
      <label class="field"><span>Layer sources</span><input data-lcredit value="${esc(v.layers_credit || '')}" placeholder="e.g. Field survey 2026 · © OpenStreetMap contributors"></label>
    </div>
    <div class="row">
      <label class="field"><span>Contour interval</span><select data-interval>${[10, 20, 25, 50, 100].map(n => `<option ${n === v.contour_interval ? 'selected' : ''} value="${n}">${n} m</option>`).join('')}</select></label>
      <label class="field"><span>Menu order</span><input type="number" data-order value="${esc(v.menu_order)}"></label>
      <label class="check" style="min-height:42px"><input type="checkbox" data-menu ${v.show_in_menu ? 'checked' : ''}> Show in the valley menu</label>
    </div>
    <h3>Zones along the river</h3>
    <span class="muted">Each zone shows on the map as its own area: every place takes the zone of its nearest stretch of river. The study method uses three: headwater zone, mid section and tail-water zone.</span>
    <div data-zones style="display:flex;flex-direction:column;gap:8px"></div>
    <div><button type="button" class="btn btn--small btn--quiet" data-addzone>+ Add zone</button></div>
  </section>

  <section class="panel" aria-labelledby="h-style">
    <h2 id="h-style">03 · Map style <span class="muted" style="text-transform:none;letter-spacing:0;font-weight:400">(can be changed any time)</span></h2>
    <div class="style-pick" data-styles>${Object.entries(STYLES).map(([k, s]) => `<button type="button" data-pick-style="${k}" aria-pressed="${k === S.style}"><div class="thumb" data-thumb="${k}"></div><strong>${esc(s.name)}</strong></button>`).join('')}</div>
  </section>

  <section class="panel" aria-labelledby="h-layers">
    <h2 id="h-layers">04 · Map layers</h2>
    <div class="cols">
      <div class="drop"><strong>Settlements</strong><span class="muted">GeoJSON, zipped Shapefile, KML or CSV with name, type (village / town / city) and lat, lng.</span>
        <input type="file" accept=".geojson,.json,.zip,.kml,.csv" data-setfile aria-label="Settlements file">
        <div class="row"><button type="button" class="btn btn--small btn--quiet" data-osm="settlements">Import from OpenStreetMap</button><button type="button" class="btn btn--small btn--quiet" data-clear="settlements">Clear</button></div>
        <span data-sum="settlements" class="muted"></span></div>
      <div class="drop"><strong>Water infrastructure</strong><span class="muted">GeoJSON, Shapefile, KML or CSV with a type: dam, weir, kt_weir, check_dam, well, borewell, jack_well, pump_house, tank, reservoir, canal, pipeline. Canals and pipelines need line geometry.</span>
        <input type="file" accept=".geojson,.json,.zip,.kml,.csv" data-infrafile aria-label="Water infrastructure file">
        <div class="row"><button type="button" class="btn btn--small btn--quiet" data-osm="infra">Import from OpenStreetMap</button><button type="button" class="btn btn--small btn--quiet" data-clear="infra">Clear</button><a class="btn btn--small btn--quiet" download="water-infrastructure-template.csv" href="data:text/csv;charset=utf-8,${encodeURIComponent(CSV_TEMPLATE)}">CSV template</a></div>
        <span data-sum="infra" class="muted"></span></div>
    </div>
    <div data-slim></div>
  </section>

  <section class="panel" aria-labelledby="h-save">
    <h2 id="h-save">05 · Save &amp; publish</h2>
    <p class="muted" style="margin:0">Saving uploads the processed map files and updates the valley. Publishing makes its page public and adds it to the site's valley menu.</p>
    <div class="row">
      <button type="button" class="btn" data-save="draft">Save draft</button>
      <button type="button" class="btn btn--publish" data-save="published">${v.status === 'published' ? 'Save & keep published' : 'Publish valley page'}</button>
      ${v.status === 'published' ? `<button type="button" class="btn btn--quiet" data-save="unpublish">Unpublish</button>` : ''}
    </div>
    <ul class="progress" data-saveprogress aria-live="polite"></ul>
    ${valley ? `<details style="margin-top:12px"><summary class="warn">Delete this river basin</summary><p class="muted">This deletes the valley and all its stories from the site. You can bring them back from History; the map files are kept. Type the valley name to confirm.</p>
      <div class="row"><label class="field"><span>Valley name</span><input data-delname></label><button type="button" class="btn btn--danger" data-delete>Delete permanently</button></div></details>` : ''}
  </section>`);

const $ = s => main.querySelector(s);
const prog = $('[data-progress]');
const step = (msg, cls = '') => { prog.insertAdjacentHTML('beforeend', `<li class="${cls}">${cls === 'warn' ? '!' : '✓'} ${esc(msg)}</li>`); };

// ---------- 01 map data ----------
let mapFile = null, vectorFC = null;
$('[data-file]').addEventListener('change', async e => {
  mapFile = e.target.files[0] || null; vectorFC = null; prog.innerHTML = '';
  $('[data-field-wrap]').hidden = true; $('[data-process]').disabled = !mapFile;
  if (mapFile && !/\.tiff?$/i.test(mapFile.name)) {
    try {
      vectorFC = await readVectorFile(mapFile);
      const fields = elevationFields(vectorFC);
      if (!fields.length) throw new Error('No numeric attribute found to use as elevation.');
      $('[data-field]').innerHTML = fields.map(f => `<option ${f === guessElevationField(fields) ? 'selected' : ''}>${esc(f)}</option>`).join('');
      $('[data-field-wrap]').hidden = false;
      step(`${vectorFC.features.length} features read from ${mapFile.name}`);
    } catch (err) { step(errMsg(err), 'warn'); $('[data-process]').disabled = true; }
  }
});

$('[data-process]').addEventListener('click', async () => {
  const btn = $('[data-process]'); btn.disabled = true; prog.innerHTML = '';
  try {
    let res;
    if (/\.tiff?$/i.test(mapFile.name)) res = await readGeoTIFF(mapFile, m => step(m));
    else res = gridFromContours(vectorFC, $('[data-field]').value, m => step(m));
    S.grid = res.grid; S.info = res.info;
    const [lo, hi] = gridRange(S.grid);
    if (!Number.isFinite(lo)) throw new Error('The file has no usable elevation values.');
    step(`Elevation ${Math.round(lo)}–${Math.round(hi)} m on a ${S.grid.w}×${S.grid.h} grid`);
    const rf = $('[data-riverfile]').files[0], bf = $('[data-boundaryfile]').files[0];
    if (rf) { const fc = await readVectorFile(rf); const line = fc.features.find(f => /LineString/.test(f.geometry?.type)); if (!line) throw new Error('No line found in the river file.'); S.river = { type: 'Feature', properties: {}, geometry: line.geometry.type === 'LineString' ? line.geometry : { type: 'LineString', coordinates: line.geometry.coordinates.flat() } }; step('River line loaded from your file'); }
    if (bf) { const fc = await readVectorFile(bf); const poly = fc.features.find(f => /Polygon/.test(f.geometry?.type)); if (poly) { S.boundary = poly; step('Watershed boundary loaded from your file'); } }
    if ($('[data-trace]').checked && (!rf || !bf)) {
      step('Tracing the river and watershed (this can take a few seconds)');
      await new Promise(r => setTimeout(r, 30));
      const t = traceRiver(S.grid);
      if (!rf) S.river = t.river; if (!bf) S.boundary = t.boundary;
      step('River and watershed traced');
    }
    if (!S.river) step('No river line yet: tick "Trace the river" or upload one.', 'warn');
    ['grid', 'river', 'boundary'].forEach(k => S.dirty.add(k));
    facts(); preview(); thumbs(); zonesUI();
  } catch (err) { step(errMsg(err), 'warn'); toast(errMsg(err), true); }
  btn.disabled = false;
});

function riverKm() { return S.river ? cumulativeKm(S.river.geometry.coordinates).at(-1) : (valley?.river_length_km || null); }
function facts() {
  if (!S.grid) return;
  const [lo, hi] = gridRange(S.grid), b = S.grid.bounds, km = riverKm();
  $('[data-facts]').innerHTML = `<span style="grid-column:1/-1" class="ok">✓ Georeference read</span>
    <dt>Source</dt><dd>${esc(S.info?.source || '')}</dd><dt>Coordinate system</dt><dd>${esc(S.info?.crs || '')} → shown in WGS 84</dd>
    <dt>Bounds (N/S)</dt><dd>${b[3].toFixed(4)}° / ${b[1].toFixed(4)}°</dd><dt>Bounds (W/E)</dt><dd>${b[0].toFixed(4)}° / ${b[2].toFixed(4)}°</dd>
    <dt>Elevation</dt><dd>${Math.round(lo)} – ${Math.round(hi)} m</dd>${S.info?.cellSize && S.info.cellSize !== '—' ? `<dt>Cell size</dt><dd>${esc(S.info.cellSize)}</dd>` : ''}
    ${km ? `<dt>River length</dt><dd>${km.toFixed(1)} km</dd>` : ''}`;
}
let previewMap = null;
function preview() {
  if (!S.grid) return;
  previewMap?.destroy?.();
  previewMap = createMap($('[data-preview]'), { grid: S.grid, river: S.river, boundary: S.boundary, zones, settlements: S.settlements, infra: S.infra, style: S.style, interval: Number($('[data-interval]').value), label: 'Preview of the river basin map' });
}
function thumbs() {
  if (!S.grid) return;
  main.querySelectorAll('[data-thumb]').forEach(el => createMap(el, { grid: S.grid, river: S.river, boundary: S.boundary, style: el.dataset.thumb, interval: Number($('[data-interval]').value) * 2, layers: { settlements: false, infra: false, pins: false } }));
}

// ---------- 02 details ----------
const nameI = $('[data-name]'), slugI = $('[data-slug]');
nameI.addEventListener('input', () => { if (slugI.dataset.auto) { slugI.value = slugify(nameI.value); $('[data-slugshow]').textContent = slugI.value; } });
// A pasted link (".../valley.html?v=mahadei") keeps only the address after v=.
const fromLink = s => { const m = String(s).match(/[?&]v=([^&#\s]+)/); return m ? decodeURIComponent(m[1]) : s; };
slugI.addEventListener('input', () => { delete slugI.dataset.auto; slugI.value = slugify(fromLink(slugI.value)); $('[data-slugshow]').textContent = slugI.value; });
$('[data-interval]').addEventListener('change', () => { preview(); });
function zonesUI() {
  const km = riverKm();
  const unit = km ? 'km' : '% of river';
  const conv = f => km ? +(f * km).toFixed(1) : Math.round(f * 100);
  $('[data-zones]').innerHTML = zones.map((z, i) => `<div class="row" data-zone="${i}">
      <label class="field"><span class="sr-only">Zone name</span><input value="${esc(z.name)}" data-zn aria-label="Zone ${i + 1} name"></label>
      <label class="field" style="flex:0 1 140px"><span class="sr-only">From</span><input type="number" step="0.1" value="${conv(z.from)}" data-zf aria-label="Zone ${i + 1} starts at (${unit})"></label>
      <label class="field" style="flex:0 1 140px"><span class="sr-only">To</span><input type="number" step="0.1" value="${conv(z.to)}" data-zt aria-label="Zone ${i + 1} ends at (${unit})"></label>
      <span class="muted">${unit}</span><button type="button" class="btn btn--small btn--quiet" data-zdel aria-label="Remove zone ${i + 1}">✕</button></div>`).join('');
  $('[data-zones]').querySelectorAll('[data-zone]').forEach(row => {
    const i = Number(row.dataset.zone), back = x => km ? Number(x) / km : Number(x) / 100;
    row.querySelector('[data-zn]').addEventListener('input', e => zones[i].name = e.target.value);
    row.querySelector('[data-zf]').addEventListener('input', e => zones[i].from = Math.max(0, Math.min(1, back(e.target.value))));
    row.querySelector('[data-zt]').addEventListener('input', e => zones[i].to = Math.max(0, Math.min(1, back(e.target.value))));
    row.querySelector('[data-zdel]').addEventListener('click', () => { zones.splice(i, 1); zonesUI(); if (S.grid) preview(); });
    row.querySelectorAll('input').forEach(x => x.addEventListener('change', () => { if (S.grid) preview(); }));
  });
}
$('[data-addzone]').addEventListener('click', () => { zones.push({ name: 'New zone', from: zones.at(-1)?.to ?? 0, to: 1 }); zonesUI(); if (S.grid) preview(); });
zonesUI();

// ---------- 03 style ----------
$('[data-styles]').addEventListener('click', e => {
  const b = e.target.closest('[data-pick-style]'); if (!b) return;
  S.style = b.dataset.pickStyle;
  main.querySelectorAll('[data-pick-style]').forEach(x => x.setAttribute('aria-pressed', x === b));
  previewMap ? previewMap.setStyle(S.style) : preview();
});

// ---------- 04 layers ----------
function sums() { $('[data-sum="settlements"]').textContent = 'Now: ' + summarise(S.settlements); $('[data-sum="infra"]').textContent = 'Now: ' + summarise(S.infra); slimCheck(); }

// Large layer files load slowly on phones: offer to shrink any over 2 MB (saved files only; new imports are already slimmed).
const LAYER_NAME = { settlements: 'settlements', infra: 'water infrastructure' };
function slimCheck() {
  const box = $('[data-slim]'); if (!box) return;
  const big = ['settlements', 'infra'].filter(k => S[k]?.features?.length && jsonMB(S[k]) > 2 && !S.slimmed?.has(k));
  box.innerHTML = big.length ? `<div class="notice is-warn" role="status" style="margin-top:12px;display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between">
    <span>${big.map(k => `The ${LAYER_NAME[k]} file is ${jsonMB(S[k]).toFixed(1)} MB`).join('; ')}. Large files make the map slow to open on phones.</span>
    <button type="button" class="btn btn--primary btn--small" data-shrink>Shrink and save</button></div>` : '';
  box.querySelector('[data-shrink]')?.addEventListener('click', async e => {
    e.currentTarget.disabled = true;
    const report = big.map(k => { const before = jsonMB(S[k]), n0 = S[k].features.length; S[k] = slimLayer(S[k]); S.dirty.add(k); (S.slimmed ||= new Set()).add(k); return `${LAYER_NAME[k]}: ${before.toFixed(1)} MB → ${jsonMB(S[k]).toFixed(2)} MB (${S[k].features.length} of ${n0} features kept)`; });
    preview(); sums();
    await save();
    toast('Shrunk ' + report.join('; '));
    sp.insertAdjacentHTML('afterbegin', report.map(r => `<li class="ok">✓ ${esc(r)}</li>`).join(''));
  });
}
sums();
async function setLayer(kind, fc, note) {
  const { fc: clean, skipped } = cleanLayer(fc, kind, S.grid?.bounds);
  S[kind] = clean; S.dirty.add(kind); sums(); preview();
  toast(`${clean.features.length} ${kind === 'infra' ? 'water features' : 'settlements'} loaded${skipped.outside ? `, ${skipped.outside} outside the map left out` : ''}${skipped.type ? `, ${skipped.type} with an unknown type left out` : ''}.${note ? ' ' + note : ''}`);
}
for (const [sel, kind] of [['[data-setfile]', 'settlements'], ['[data-infrafile]', 'infra']]) {
  $(sel).addEventListener('change', async e => { const f = e.target.files[0]; if (!f) return; try { await setLayer(kind, await readVectorFile(f)); } catch (err) { toast(errMsg(err), true); } e.target.value = ''; });
}
main.querySelectorAll('[data-osm]').forEach(b => b.addEventListener('click', async () => {
  if (!S.grid) { toast('Process the map first, so the import knows the area.', true); return; }
  b.disabled = true; const old = b.textContent; b.textContent = 'Importing…';
  try {
    const fc = b.dataset.osm === 'settlements' ? await osmSettlements(S.grid.bounds) : await osmInfra(S.grid.bounds);
    await setLayer(b.dataset.osm, fc);
    const lc = $('[data-lcredit]'); if (!/OpenStreetMap/i.test(lc.value)) lc.value = (lc.value ? lc.value + ' · ' : '') + '© OpenStreetMap contributors';
  } catch (err) { toast(errMsg(err), true); }
  b.disabled = false; b.textContent = old;
}));
main.querySelectorAll('[data-clear]').forEach(b => b.addEventListener('click', () => { S[b.dataset.clear] = { type: 'FeatureCollection', features: [] }; S.dirty.add(b.dataset.clear); sums(); preview(); }));

// ---------- 05 save ----------
const sp = $('[data-saveprogress]');
main.querySelectorAll('[data-save]').forEach(b => b.addEventListener('click', () => save(b.dataset.save)));
async function save(mode) {
  sp.innerHTML = '';
  const note = (m, cls = '') => sp.insertAdjacentHTML('beforeend', `<li class="${cls}">${cls === 'warn' ? '!' : '✓'} ${esc(m)}</li>`);
  const name = nameI.value.trim(), slug = slugI.value.trim();
  if (!name || !slug) { note('Give the valley a name and a page address.', 'warn'); nameI.focus(); return; }
  const status = mode === 'unpublish' ? 'draft' : mode === 'published' ? 'published' : (valley?.status === 'published' ? 'published' : 'draft');
  if (status === 'published') {
    if (!S.grid || !S.river) { note('Process a map with a river before publishing.', 'warn'); return; }
    if (!$('[data-source]').value.trim()) { note('Add the map data source before publishing: it is credited on the map.', 'warn'); $('[data-source]').focus(); return; }
  }
  main.querySelectorAll('[data-save]').forEach(x => x.disabled = true);
  try {
    const row = {
      name, slug, region: $('[data-region]').value.trim() || null, intro: $('[data-intro]').value.trim() || null,
      source_credit: $('[data-source]').value.trim() || null, layers_credit: $('[data-lcredit]').value.trim() || null,
      contour_interval: Number($('[data-interval]').value), map_style: S.style, zones: zones.filter(z => z.name).sort((a, b) => a.from - b.from),
      show_in_menu: $('[data-menu]').checked, menu_order: Number($('[data-order]').value) || 100, status
    };
    let vid = valley?.id;
    if (!vid) {
      const { data, error } = await sb.from('valleys').insert({ ...row, status: 'draft' }).select().single();
      if (error) throw error; vid = data.id; valley = data; note('Valley created');
    }
    const files = { ...(valley.data || {}) };
    for (const k of ['grid', 'river', 'boundary', 'settlements', 'infra']) {
      if (!S.dirty.has(k) || !S[k]) continue;
      if (k === 'settlements' || k === 'infra') S[k] = slimLayer(S[k]);
      files[k] = await uploadJSON('maps', `${vid}/${k}-${Date.now().toString(36)}.json`, S[k]); note(`Uploaded ${k === 'infra' ? 'water infrastructure' : k}`);
    }
    if (S.grid) { row.bounds = S.grid.bounds; row.crs = S.info?.crs || valley.crs; }
    if (S.grid && S.river && (S.dirty.has('grid') || S.dirty.has('river') || !valley.profile)) {
      row.profile = riverProfile(S.grid, S.river.geometry.coordinates); row.river_length_km = +riverKm().toFixed(2); note('Elevation profile computed');
    }
    row.data = files;
    const { data, error } = await sb.from('valleys').update(row).eq('id', vid).select().single();
    if (error) throw error;
    valley = data; S.dirty.clear();
    note(status === 'published' ? 'Published: the valley page is live and in the menu' : 'Saved as draft', 'ok');
    toast(status === 'published' ? 'Valley published.' : 'Saved.');
    if (!id) history.replaceState(null, '', '?id=' + vid);
    if (mode === 'unpublish' || (mode === 'published' && !id)) location.reload();
  } catch (err) { note(errMsg(err).includes('valleys_slug_key') ? 'That page address is already used by another valley.' : errMsg(err), 'warn'); }
  main.querySelectorAll('[data-save]').forEach(x => x.disabled = false);
}

$('[data-delete]')?.addEventListener('click', async () => {
  if ($('[data-delname]').value.trim() !== valley.name) { toast('Type the valley name exactly to confirm.', true); return; }
  const { error } = await sb.from('valleys').delete().eq('id', valley.id);
  if (error) { toast(errMsg(error), true); return; }
  location.replace(siteUrl('admin/index.html?deleted=1'));
});

if (S.grid) { facts(); preview(); thumbs(); zonesUI(); }
