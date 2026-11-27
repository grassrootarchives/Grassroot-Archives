// Add or edit a story: place it by latitude/longitude (or a click), attach media, publish.
import { requireAdmin, layout, toast, errMsg, upload, safeName, param } from './common.js';
import { LEVELS } from '../resilience.js';
import { loadValleyData, dataUrl } from '../db.js';
import { esc } from '../ui.js';
import { siteUrl } from '../config.js';
import { createMap } from '../map/map.js';
import { sampleElevation, snapToLine, zoneFor, inBounds } from '../geo/geom.js';

const THEMES = ['Water Governance', 'Agrarian Change', 'Oral History', 'Ecology'];
const MAX_UPLOAD_MB = 50;
const MEDIA = { video: ['Video', 'MP4 or WebM up to 50 MB, or paste a link for longer videos', 'video/*'], audio: ['Sound clip', 'MP3, WAV or M4A, up to 50 MB', 'audio/*'], photo: ['Photograph', 'JPG, PNG or WebP · location is read from the photo if it has one', 'image/*'], document: ['Text file', 'PDF, DOCX or TXT to download; or type the transcript below', '.pdf,.doc,.docx,.txt,.odt'] };
const ICON = { video: 'M3 6h12v12H3zM15 10l6-3v10l-6-3', audio: 'M4 10v4M8 7v10M12 4v16M16 8v8M20 11v2', photo: 'M3 7h4l2-3h6l2 3h4v13H3zM12 17a4 4 0 100-8 4 4 0 000 8', document: 'M6 3h9l4 4v14H6zM9 12h7M9 16h7' };

const app = document.getElementById('app');
const { sb, user } = await requireAdmin('stories');
const id = param('id');
const { data: valleys } = await sb.from('valleys').select('*').order('menu_order').order('name');
let story = null;
if (id) { const { data } = await sb.from('stories').select('*').eq('id', id).maybeSingle(); story = data; }
const s = story || { valley_id: param('valley') || valleys?.find(v => v.data?.grid)?.id || valleys?.[0]?.id, place: '', interviewee: '', age: null, role: '', quote: '', transcript: '', theme: 'Oral History', lat: null, lng: null, sub_basin: '', media: [], resilience: {}, consent: false, status: 'draft' };
let media = (s.media || []).map(m => ({ ...m }));
let shown = new Set([...media.map(m => m.type), ...(s.transcript ? ['document'] : [])]);
if (!shown.size) { shown.add('audio'); shown.add('photo'); }

const main = layout(app, 'stories', user, `
  <a href="${esc(siteUrl('admin/stories.html'))}" class="muted">← Stories</a>
  <div class="admin__head"><div><span class="eyebrow">Stories</span><h1>${story ? 'Edit story' : 'Add a story'}</h1></div>
    <label class="field" style="min-width:260px"><span>River valley</span><select data-valley>${(valleys || []).map(v => `<option value="${esc(v.id)}" ${v.id === s.valley_id ? 'selected' : ''}>${esc(v.name)}${v.status === 'draft' ? ' (draft)' : ''}</option>`).join('')}</select></label></div>
  <div class="cols">
    <section class="panel" aria-labelledby="h-loc"><h2 id="h-loc">01 · Location</h2>
      <div class="row"><label class="field"><span>Latitude (°N)</span><input data-lat inputmode="decimal" value="${s.lat ?? ''}" placeholder="18.5206"></label>
        <label class="field"><span>Longitude (°E)</span><input data-lng inputmode="decimal" value="${s.lng ?? ''}" placeholder="73.8561"></label></div>
      <span class="muted">Type decimal degrees, paste from a GPS or phone, click the map, or read them from a photo's location data.</span>
      <div class="minimap" data-map><div class="empty">This valley has no map yet. Add one under River basins.</div></div>
      <div data-oob class="notice is-error" hidden>This point is outside the valley's map. Check the coordinates.</div>
      <div class="derived"><div><span>ELEVATION</span><strong data-d="elev">—</strong></div><div><span>RIVER KM</span><strong data-d="km">—</strong></div><div><span>ZONE</span><strong data-d="zone">—</strong></div>
        <label class="field" style="border:1px solid var(--line);background:var(--panel);padding:10px;gap:2px"><span style="color:var(--muted);font-size:11px;font-weight:400">SUB-BASIN</span><input data-sub value="${esc(s.sub_basin || '')}" style="min-height:28px;padding:2px 6px" aria-label="Sub-basin"></label></div>
      <span class="muted">Elevation is read from the valley's map at the point; river km by snapping to the river line.</span>
    </section>
    <section class="panel" aria-labelledby="h-media"><h2 id="h-media">02 · What are you uploading?</h2>
      <div class="tiles" role="group" aria-label="Media types">${Object.entries(MEDIA).map(([k, [l]]) => `<button type="button" class="tile" data-type="${k}" aria-pressed="${shown.has(k)}"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="${ICON[k]}"/></svg>${l}</button>`).join('')}</div>
      <span class="muted">Pick one or more. A story can carry a sound clip, photographs and a transcript together.</span>
      <div data-uploads style="display:flex;flex-direction:column;gap:10px"></div>
      <div data-items style="display:flex;flex-direction:column;gap:8px"></div>
      <label class="field"><span>Narrative &amp; transcript</span><textarea class="serif" data-transcript rows="7">${esc(s.transcript || '')}</textarea><span class="hint">Blank lines start new paragraphs. **bold**, *italic* and [links](https://…) work.</span></label>
      <h2 style="margin-top:8px">03 · About the story</h2>
      <label class="field"><span>Place name</span><input data-place value="${esc(s.place)}" required></label>
      <div class="row"><label class="field" style="flex:2 1 200px"><span>Interviewee</span><input data-who value="${esc(s.interviewee || '')}"></label>
        <label class="field" style="flex:0 1 90px"><span>Age</span><input data-age type="number" min="0" max="130" value="${s.age ?? ''}"></label>
        <label class="field"><span>Role</span><input data-role value="${esc(s.role || '')}"></label></div>
      <label class="field"><span>Pull-quote</span><textarea class="serif" data-quote rows="2" style="font-style:italic">${esc(s.quote || '')}</textarea></label>
      <div class="row"><label class="field"><span>Theme</span><select data-theme>${THEMES.map(t => `<option ${t === s.theme ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        <label class="field" style="flex:0 1 120px"><span>Number</span><input data-num type="number" min="1" value="${s.number ?? ''}" placeholder="auto"></label></div>
      <h2 style="margin-top:8px" id="h-res">04 · Resilience strategies</h2>
      <p class="muted" style="margin:0">How people cope and adapt, at three levels: from the home outwards. The place is already set by the latitude and longitude; add when each strategy was used. Leave a level empty if the story doesn't speak to it.</p>
      <div class="levels" role="group" aria-labelledby="h-res">${LEVELS.map(l => { const r = (s.resilience || {})[l.key] || {}; return `
        <fieldset class="level" data-level="${l.key}">
          <legend><span class="level__n">${l.n}</span> ${esc(l.name)}</legend>
          <span class="hint">${esc(l.hint)}</span>
          <label class="field"><span>When</span><input data-when value="${esc(r.when || '')}" placeholder="e.g. Since the 2015 drought · Every summer · 1972–1975"></label>
          <label class="field"><span>Strategies</span><textarea data-text rows="5" placeholder="Describe the strategies. Start a line with - for a bullet point:&#10;- Storing water in drums&#10;- Shifting to millets">${esc(r.text || '')}</textarea><span class="hint">Start a line with <code>-</code> for a bullet point. Blank lines start new paragraphs.</span></label>
        </fieldset>`; }).join('')}</div>
      <label class="check"><input type="checkbox" data-consent ${s.consent ? 'checked' : ''}> Consent to publish is recorded for this interview</label>
      <div class="row" style="padding-top:8px;border-top:1px solid var(--line)">
        <button type="button" class="btn" data-save="draft">Save draft</button>
        <button type="button" class="btn btn--publish" data-save="published">Publish to valley page</button>
        ${story ? `<a class="btn btn--quiet" href="${esc(siteUrl('admin/history.html?table=stories&key=' + story.id))}">History</a><button type="button" class="btn btn--danger" data-del>Delete story</button>` : ''}</div>
      <div data-result></div>
    </section>
  </div>`);
const $ = q => main.querySelector(q);

// ---------- map & derived values ----------
let valley = null, data = null, map = null;
async function loadValley() {
  valley = valleys.find(v => v.id === $('[data-valley]').value);
  data = null; map = null;
  const el = $('[data-map]');
  if (!valley?.data?.grid) { el.innerHTML = '<div class="empty">This valley has no map yet. Add one under River basins.</div>'; derive(); return; }
  el.innerHTML = '<div class="empty">Loading map…</div>';
  data = await loadValleyData(valley);
  const { data: others } = await sb.from('stories').select('id,number,place,lat,lng').eq('valley_id', valley.id);
  map = createMap(el, { ...data, style: valley.map_style, interval: valley.contour_interval, stories: (others || []).filter(o => o.id !== story?.id), layers: { settlements: true, infra: true, pins: true },
    onMapClick: ({ lon, lat }) => { $('[data-lat]').value = lat.toFixed(5); $('[data-lng]').value = lon.toFixed(5); derive(); } });
  derive();
}
let derived = {};
function derive() {
  const lat = parseFloat($('[data-lat]').value), lng = parseFloat($('[data-lng]').value);
  const ok = Number.isFinite(lat) && Number.isFinite(lng);
  derived = {};
  if (ok && data?.grid) {
    const inside = inBounds(data.grid.bounds, lng, lat);
    $('[data-oob]').hidden = inside;
    if (inside) {
      derived.elevation = sampleElevation(data.grid, lng, lat);
      const snap = data.river ? snapToLine(data.river.geometry.coordinates, lng, lat) : null;
      const total = valley.river_length_km || (snap ? null : null);
      if (snap) { derived.river_km = snap.km; derived.zone = zoneFor(valley.zones, total ? snap.km / total : null); }
    }
    map?.setMarker(lng, lat);
  } else { $('[data-oob]').hidden = true; map?.setMarker(null); }
  $('[data-d="elev"]').textContent = derived.elevation != null ? '~' + Math.round(derived.elevation) + ' m' : '—';
  $('[data-d="km"]').textContent = derived.river_km != null ? derived.river_km.toFixed(1) : '—';
  $('[data-d="zone"]').textContent = derived.zone || '—';
}
$('[data-valley]').addEventListener('change', loadValley);
$('[data-lat]').addEventListener('input', derive); $('[data-lng]').addEventListener('input', derive);
// Paste "18.5206, 73.8561" into either box.
for (const q of ['[data-lat]', '[data-lng]']) $(q).addEventListener('paste', e => {
  const t = (e.clipboardData || window.clipboardData).getData('text'); const m = t.match(/(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)/);
  if (m) { e.preventDefault(); $('[data-lat]').value = m[1]; $('[data-lng]').value = m[2]; derive(); }
});

// ---------- media ----------
function uploadsUI() {
  $('[data-uploads]').innerHTML = [...shown].filter(k => MEDIA[k]).map(k => `<div class="drop" style="flex-direction:row;flex-wrap:wrap;align-items:center;justify-content:space-between">
    <div style="display:flex;flex-direction:column;gap:2px"><strong>${MEDIA[k][0]}</strong><span class="muted">${MEDIA[k][1]}</span></div>
    <label class="btn btn--small" style="position:relative">Upload<input type="file" accept="${MEDIA[k][2]}" data-up="${k}" ${k === 'photo' ? 'multiple' : ''} style="position:absolute;inset:0;opacity:0;cursor:pointer"></label>
    ${k === 'video' ? `<div class="row" style="width:100%"><label class="field"><span class="sr-only">Video link</span><input data-vurl placeholder="…or paste a link to a video file (https://…)"></label><button type="button" class="btn btn--small btn--quiet" data-vadd>Add link</button></div>` : ''}</div>`).join('');
  main.querySelectorAll('[data-up]').forEach(inp => inp.addEventListener('change', async () => {
    for (const f of inp.files) await addFile(inp.dataset.up, f);
    inp.value = '';
  }));
  $('[data-vadd]')?.addEventListener('click', () => { const u = $('[data-vurl]').value.trim(); if (!/^https:\/\//.test(u)) { toast('Paste a full https:// link.', true); return; } media.push({ type: 'video', url: u, caption: '' }); $('[data-vurl]').value = ''; itemsUI(); });
}
async function addFile(type, f) {
  // Supabase's free plan accepts files up to 50 MB.
  if (f.size > MAX_UPLOAD_MB * 1024 * 1024) { toast(`${f.name} is ${(f.size / 1048576).toFixed(0)} MB; the limit is ${MAX_UPLOAD_MB} MB per file.${type === 'video' ? ' Upload the video to YouTube or Vimeo and paste its link instead, or export a smaller version.' : type === 'audio' ? ' Export it as MP3 to make it smaller.' : ''}`, true); return; }
  const item = { type, url: '', caption: '', name: f.name, uploading: true }; media.push(item); itemsUI();
  try {
    if (type === 'photo') { const gps = await readGps(f); if (gps && !$('[data-lat]').value) { $('[data-lat]').value = gps[0].toFixed(5); $('[data-lng]').value = gps[1].toFixed(5); derive(); toast('Location read from the photo.'); } }
    item.url = await upload('media', `${$('[data-valley]').value}/${Date.now().toString(36)}-${safeName(f.name)}`, f);
  } catch (e) { media.splice(media.indexOf(item), 1); toast(`Upload failed: ${errMsg(e)}`, true); }
  delete item.uploading; itemsUI();
}
function itemsUI() {
  $('[data-items]').innerHTML = media.map((m, i) => `<div class="media-item">
    ${m.type === 'photo' && m.url ? `<img src="${esc(dataUrl(m.url))}" alt="">` : `<span class="label" style="width:64px">${esc(MEDIA[m.type]?.[0] || m.type)}</span>`}
    <div class="grow"><div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(m.name || m.url.split('/').pop().split('?')[0])}${m.uploading ? ' · uploading…' : ''}</div>
      <label class="field"><span class="sr-only">Caption</span><input data-cap="${i}" value="${esc(m.caption || '')}" placeholder="Caption" style="min-height:32px;padding:4px 8px"></label></div>
    <button type="button" class="btn btn--small btn--quiet" data-up1="${i}" aria-label="Move up" ${i === 0 ? 'disabled' : ''}>↑</button>
    <button type="button" class="btn btn--small btn--quiet" data-rm="${i}" aria-label="Remove">✕</button></div>`).join('');
  main.querySelectorAll('[data-cap]').forEach(x => x.addEventListener('input', () => media[x.dataset.cap].caption = x.value));
  main.querySelectorAll('[data-rm]').forEach(x => x.addEventListener('click', () => { media.splice(Number(x.dataset.rm), 1); itemsUI(); }));
  main.querySelectorAll('[data-up1]').forEach(x => x.addEventListener('click', () => { const i = Number(x.dataset.up1); [media[i - 1], media[i]] = [media[i], media[i - 1]]; itemsUI(); }));
}
main.querySelector('.tiles').addEventListener('click', e => {
  const b = e.target.closest('[data-type]'); if (!b) return;
  const k = b.dataset.type; shown.has(k) ? shown.delete(k) : shown.add(k); b.setAttribute('aria-pressed', shown.has(k)); uploadsUI();
});

// Minimal EXIF GPS reader for JPEG photos.
async function readGps(file) {
  if (!/jpe?g$/i.test(file.type) && !/\.jpe?g$/i.test(file.name)) return null;
  const v = new DataView(await file.slice(0, 256 * 1024).arrayBuffer());
  if (v.getUint16(0) !== 0xFFD8) return null;
  let o = 2;
  while (o < v.byteLength - 4) {
    const marker = v.getUint16(o), len = v.getUint16(o + 2);
    if (marker === 0xFFE1 && v.getUint32(o + 4) === 0x45786966) {
      const t = o + 10, le = v.getUint16(t) === 0x4949;
      const u16 = p => v.getUint16(t + p, le), u32 = p => v.getUint32(t + p, le);
      const ifd0 = u32(4), n0 = u16(ifd0); let gps = 0;
      for (let i = 0; i < n0; i++) { const e = ifd0 + 2 + i * 12; if (u16(e) === 0x8825) gps = u32(e + 8); }
      if (!gps) return null;
      const n = u16(gps), tags = {};
      for (let i = 0; i < n; i++) { const e = gps + 2 + i * 12; tags[u16(e)] = { off: u32(e + 8), val: e + 8 }; }
      const rat3 = tag => { if (!tags[tag]) return null; const p = tags[tag].off; return [0, 1, 2].map(k => u32(p + k * 8) / (u32(p + k * 8 + 4) || 1)); };
      const ref = tag => tags[tag] ? String.fromCharCode(v.getUint8(t + tags[tag].val)) : '';
      const la = rat3(2), lo = rat3(4); if (!la || !lo) return null;
      const dec = d => d[0] + d[1] / 60 + d[2] / 3600;
      return [dec(la) * (ref(1) === 'S' ? -1 : 1), dec(lo) * (ref(3) === 'W' ? -1 : 1)];
    }
    if ((marker & 0xFF00) !== 0xFF00) break;
    o += 2 + len;
  }
  return null;
}

// ---------- save ----------
main.querySelectorAll('[data-save]').forEach(b => b.addEventListener('click', () => save(b.dataset.save)));
async function save(status) {
  const res = $('[data-result]');
  const lat = parseFloat($('[data-lat]').value), lng = parseFloat($('[data-lng]').value);
  const place = $('[data-place]').value.trim();
  const fail = m => { res.innerHTML = `<div class="notice is-error" role="alert">${esc(m)}</div>`; };
  if (!place) return fail('Give the story a place name.');
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return fail('Add the latitude and longitude, or click the map.');
  if (media.some(m => m.uploading)) return fail('Wait for the uploads to finish.');
  if (status === 'published' && !$('[data-consent]').checked) return fail('A story can only be published once consent is recorded.');
  const row = {
    valley_id: $('[data-valley]').value, place, interviewee: $('[data-who]').value.trim() || null, age: $('[data-age]').value ? Number($('[data-age]').value) : null,
    role: $('[data-role]').value.trim() || null, quote: $('[data-quote]').value.trim() || null, transcript: $('[data-transcript]').value.trim() || null,
    theme: $('[data-theme]').value, lat, lng, sub_basin: $('[data-sub]').value.trim() || null, consent: $('[data-consent]').checked, status,
    media: media.map(({ type, url, caption }) => ({ type, url, caption })),
    resilience: Object.fromEntries(LEVELS.map(l => { const f = $(`[data-level="${l.key}"]`); const when = f.querySelector('[data-when]').value.trim(), text = f.querySelector('[data-text]').value.trim(); return [l.key, when || text ? { when, text } : null]; }).filter(([, v]) => v)),
    elevation: derived.elevation != null ? Math.round(derived.elevation) : null, river_km: derived.river_km != null ? +derived.river_km.toFixed(2) : null, zone: derived.zone || null
  };
  const num = $('[data-num]').value;
  if (num) row.number = Number(num);
  else if (!story?.number) { const { data: rows } = await sb.from('stories').select('number').eq('valley_id', row.valley_id); row.number = Math.max(0, ...(rows || []).map(r => r.number || 0)) + 1; }
  try {
    const q = story ? sb.from('stories').update(row).eq('id', story.id).select().single() : sb.from('stories').insert(row).select().single();
    const { data, error } = await q; if (error) throw error;
    story = data;
    if (!id) history.replaceState(null, '', '?id=' + data.id);
    const v = valleys.find(x => x.id === row.valley_id);
    res.innerHTML = `<div class="notice" role="status">${status === 'published' ? `✓ Published. The pin is on ${esc(v.name)}'s map, river index and profile.${v.status !== 'published' ? ' (The valley itself is still a draft.)' : ''}` : '✓ Saved as draft.'} ${v.status === 'published' ? `<a href="${esc(siteUrl('valley.html?v=' + encodeURIComponent(v.slug) + '#story-' + data.id))}" target="_blank" rel="noopener">See it on the valley page ↗</a>` : ''}</div>`;
  } catch (e) { fail(errMsg(e)); }
}
$('[data-del]')?.addEventListener('click', async () => {
  if (!confirm('Delete this story? This cannot be undone.')) return;
  const { error } = await sb.from('stories').delete().eq('id', story.id);
  if (error) { toast(errMsg(error), true); return; }
  location.replace(siteUrl('admin/stories.html?deleted=1'));
});

uploadsUI(); itemsUI(); await loadValley();
