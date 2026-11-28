// Media library: every photo, video, sound clip and document uploaded to the site,
// what uses it, how big it is; shrink large photos and delete files nothing uses.
import { requireAdmin, layout, toast, errMsg, shrinkPhoto, isShrinkablePhoto, PHOTO_SHRINK_ABOVE, mb } from './common.js';
import { esc } from '../ui.js';
import { siteUrl } from '../config.js';

const BUCKET = 'media';
const FREE_STORAGE = 1024 * 1048576;          // Supabase free plan: 1 GB of file storage
const BIG = { photo: PHOTO_SHRINK_ABOVE, video: 20 * 1048576, audio: 15 * 1048576, document: 10 * 1048576 };
const KINDS = [['all', 'All'], ['photo', 'Photos'], ['video', 'Videos'], ['audio', 'Sound'], ['document', 'Documents'], ['unused', 'Not used'], ['large', 'Large']];

const app = document.getElementById('app');
const { sb, user } = await requireAdmin('media');
const main = layout(app, 'media', user, `
  <div class="admin__head"><div><span class="eyebrow">Media</span><h1>Media library</h1></div>
    <div class="row" style="gap:8px"><button type="button" class="btn" data-shrinkall hidden></button><button type="button" class="btn btn--danger" data-delunused hidden></button></div></div>
  <div class="panel" data-storage><p class="muted">Reading the files…</p></div>
  <p class="muted" style="margin:0;max-width:72ch">Photos over 1 MB are shrunk to about 0.5 MB when they are uploaded, which looks the same on screen. Videos and sound are kept as uploaded: for a video longer than a minute or two, put it on YouTube or Vimeo and paste the link into the story instead, which plays in the story drawer and uses none of the site's storage.</p>
  <div class="tabs" role="group" aria-label="Show" data-kinds>${KINDS.map(([k, l]) => `<button type="button" class="chip" data-k="${k}" aria-pressed="${k === 'all'}">${l} <span class="muted" data-count="${k}"></span></button>`).join('')}</div>
  <div class="table-wrap"><table class="index media-table" style="min-width:820px"><caption class="sr-only">Uploaded files</caption>
    <thead><tr><th scope="col"><span class="sr-only">Preview</span></th><th scope="col">File</th><th scope="col" style="text-align:right">Size</th><th scope="col">Used in</th><th scope="col">Uploaded</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead>
    <tbody data-rows><tr><td colspan="6" class="muted">Loading…</td></tr></tbody></table></div>`);
const $ = s => main.querySelector(s);

let files = [], mapBytes = 0, kind = 'all';
const kindOf = (mime, name) => /^image\//.test(mime) ? 'photo' : /^video\//.test(mime) ? 'video' : /^audio\//.test(mime) ? 'audio'
  : /\.(jpe?g|png|webp|gif|heic)$/i.test(name) ? 'photo' : /\.(mp4|mov|webm|m4v)$/i.test(name) ? 'video' : /\.(mp3|wav|m4a|ogg|aac)$/i.test(name) ? 'audio' : 'document';
const publicUrl = path => sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
const isBig = f => f.size > BIG[f.kind];
const canShrink = f => f.kind === 'photo' && f.size > PHOTO_SHRINK_ABOVE && isShrinkablePhoto(f.mime, f.name);

async function listAll(bucket, prefix = '', depth = 0) {
  const { data, error } = await sb.storage.from(bucket).list(prefix, { limit: 1000, sortBy: { column: 'name', order: 'asc' } });
  if (error) throw error;
  const out = [];
  for (const e of data || []) {
    const path = prefix ? `${prefix}/${e.name}` : e.name;
    if (e.id === null || !e.metadata) { if (depth < 3) out.push(...await listAll(bucket, path, depth + 1)); }
    else if (e.name !== '.emptyFolderPlaceholder') out.push({ path, name: e.name, size: e.metadata.size || 0, mime: e.metadata.mimetype || '', at: e.created_at || e.updated_at });
  }
  return out;
}

// Where each file is used: stories (media list), pages (images in blocks), valleys and site settings.
async function usage() {
  const [st, pg, va, se] = await Promise.all([
    sb.from('stories').select('id,place,valley_id,status,media'),
    sb.from('pages').select('*'), sb.from('valleys').select('*'), sb.from('site_settings').select('*')
  ]);
  for (const r of [st, pg, va, se]) if (r.error) throw r.error;
  const vName = Object.fromEntries((va.data || []).map(v => [v.id, v.name]));
  return [
    ...(st.data || []).map(s => ({ text: JSON.stringify(s.media || []), label: `${s.place || 'Untitled story'} · ${vName[s.valley_id] || 'no valley'}`, href: 'admin/story.html?id=' + s.id })),
    ...(pg.data || []).map(p => ({ text: JSON.stringify(p), label: `Page: ${p.title || p.slug || 'untitled'}`, href: 'admin/pages.html' })),
    ...(va.data || []).map(v => ({ text: JSON.stringify(v), label: `Valley: ${v.name}`, href: 'admin/basin.html?id=' + v.id })),
    ...(se.data || []).length ? [{ text: JSON.stringify(se.data), label: 'Site settings', href: 'admin/settings.html' }] : []
  ];
}

async function load() {
  try {
    const [list, maps, users] = await Promise.all([listAll(BUCKET), listAll('maps').catch(() => []), usage()]);
    mapBytes = maps.reduce((s, f) => s + f.size, 0);
    files = list.map(f => ({ ...f, kind: kindOf(f.mime, f.name), used: users.filter(u => u.text.includes(`/${BUCKET}/${f.path}`)) }));
    render();
  } catch (e) {
    $('[data-storage]').innerHTML = `<div class="notice is-error">Couldn't read the media files: ${esc(errMsg(e))}</div>`;
    $('[data-rows]').innerHTML = '';
  }
}

function render() {
  const total = files.reduce((s, f) => s + f.size, 0), all = total + mapBytes, pct = Math.min(100, all / FREE_STORAGE * 100);
  const unused = files.filter(f => !f.used.length), shrinkable = files.filter(canShrink);
  const byKind = k => files.filter(f => f.kind === k);
  $('[data-storage]').innerHTML = `
    <div class="row" style="justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:8px"><h2>Storage</h2><span><strong>${mb(all)}</strong> <span class="muted">of 1 GB on the free plan</span></span></div>
    <div class="meter" role="img" aria-label="${pct.toFixed(0)}% of storage used"><span style="width:${pct.toFixed(1)}%" class="${pct > 80 ? 'is-high' : ''}"></span></div>
    <div class="row muted" style="flex-wrap:wrap;gap:6px 20px;font-size:12px">
      ${[['photo', 'Photos'], ['video', 'Videos'], ['audio', 'Sound'], ['document', 'Documents']].map(([k, l]) => `<span>${l}: ${byKind(k).length} · ${mb(byKind(k).reduce((s, f) => s + f.size, 0))}</span>`).join('')}
      <span>Map files: ${mb(mapBytes)}</span>${unused.length ? `<span class="warn">Not used: ${unused.length} · ${mb(unused.reduce((s, f) => s + f.size, 0))}</span>` : ''}</div>`;
  const sa = $('[data-shrinkall]'), du = $('[data-delunused]');
  sa.hidden = !shrinkable.length; sa.textContent = `Shrink large photos (${shrinkable.length})`;
  du.hidden = !unused.length; du.textContent = `Delete unused files (${unused.length} · ${mb(unused.reduce((s, f) => s + f.size, 0))})`;
  const counts = { all: files.length, unused: unused.length, large: files.filter(isBig).length };
  for (const [k] of KINDS) main.querySelector(`[data-count="${k}"]`).textContent = counts[k] ?? byKind(k).length;
  rows();
}

function rows() {
  const show = files.filter(f => kind === 'all' || (kind === 'unused' ? !f.used.length : kind === 'large' ? isBig(f) : f.kind === kind))
    .sort((a, b) => b.size - a.size);
  $('[data-rows]').innerHTML = show.map(f => {
    const i = files.indexOf(f), url = publicUrl(f.path);
    const preview = f.kind === 'photo' && f.size <= 1.5 * 1048576 ? `<img src="${esc(url)}" alt="" loading="lazy">`
      : `<span class="media-kind media-kind--${f.kind}" aria-hidden="true">${{ photo: 'IMG', video: '▶', audio: '♪', document: 'DOC' }[f.kind]}</span>`;
    return `<tr data-i="${i}">
      <td class="media-prev">${preview}</td>
      <td class="name"><div class="media-name" title="${esc(f.path)}">${esc(f.name.replace(/^[a-z0-9]{6,10}-/, ''))}</div><div class="muted" style="font-family:var(--font-ui);font-size:11px;text-transform:uppercase;letter-spacing:.08em">${{ photo: 'Photo', video: 'Video', audio: 'Sound', document: 'Document' }[f.kind]}${f.mime ? ' · ' + esc(f.mime.split('/')[1] || f.mime) : ''}</div></td>
      <td class="num">${mb(f.size)}${isBig(f) ? '<div class="warn" style="font-size:11px">Large</div>' : ''}</td>
      <td>${f.used.length ? f.used.map(u => `<a href="${esc(siteUrl(u.href))}">${esc(u.label)}</a>`).join('<br>') : '<span class="warn">Not used</span>'}</td>
      <td class="muted">${f.at ? new Date(f.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</td>
      <td style="text-align:right;white-space:nowrap">
        <a class="btn btn--small btn--quiet" href="${esc(url)}" target="_blank" rel="noopener">View<span class="sr-only"> ${esc(f.name)}</span> ↗</a>
        ${canShrink(f) ? `<button type="button" class="btn btn--small" data-shrink>Shrink</button>` : ''}
        <button type="button" class="btn btn--small btn--quiet" data-del ${f.used.length ? `disabled title="Used by ${esc(f.used.map(u => u.label).join(', '))}: remove it there first"` : ''}>Delete</button></td></tr>`;
  }).join('') || `<tr><td colspan="6" class="muted">${files.length ? 'Nothing here.' : 'No files uploaded yet.'}</td></tr>`;
}

async function shrinkOne(f) {
  const res = await fetch(publicUrl(f.path) + '?t=' + Date.now(), { cache: 'no-store' });
  if (!res.ok) throw new Error(`couldn't download it (${res.status})`);
  const small = await shrinkPhoto(await res.blob());
  if (!small) return false;
  const { error } = await sb.storage.from(BUCKET).update(f.path, small, { contentType: 'image/jpeg', cacheControl: '300', upsert: true });
  if (error) throw error;
  f.size = small.size; f.mime = 'image/jpeg';
  return true;
}
async function remove(list) {
  const { error } = await sb.storage.from(BUCKET).remove(list.map(f => f.path));
  if (error) throw error;
  files = files.filter(f => !list.includes(f));
}

main.addEventListener('click', async e => {
  const k = e.target.closest('[data-k]');
  if (k) { kind = k.dataset.k; main.querySelectorAll('[data-k]').forEach(x => x.setAttribute('aria-pressed', x === k)); rows(); return; }
  const tr = e.target.closest('tr[data-i]'), f = tr && files[+tr.dataset.i];
  if (f && e.target.closest('[data-shrink]')) {
    const b = e.target.closest('[data-shrink]'), before = f.size; b.disabled = true; b.textContent = 'Shrinking…';
    try { const ok = await shrinkOne(f); toast(ok ? `${f.name}: ${mb(before)} → ${mb(f.size)}` : `${f.name} is already as small as it will go.`); render(); }
    catch (err) { toast(`Couldn't shrink ${f.name}: ${errMsg(err)}`, true); b.disabled = false; b.textContent = 'Shrink'; }
    return;
  }
  if (f && e.target.closest('[data-del]')) {
    if (f.used.length) return;
    if (!confirm(`Delete ${f.name} (${mb(f.size)})?\n\nNo story or page uses it. Deleted files can't be brought back from History.`)) return;
    try { await remove([f]); toast(`Deleted ${f.name}.`); render(); } catch (err) { toast(`Couldn't delete: ${errMsg(err)}`, true); }
    return;
  }
  if (e.target.closest('[data-shrinkall]')) {
    const b = e.target.closest('[data-shrinkall]'), list = files.filter(canShrink), before = list.reduce((s, x) => s + x.size, 0);
    b.disabled = true; let n = 0, failed = 0;
    for (const x of list) {
      b.textContent = `Shrinking ${++n} of ${list.length}…`;
      try { await shrinkOne(x); } catch { failed++; }
    }
    const after = list.reduce((s, x) => s + x.size, 0);
    toast(`Photos: ${mb(before)} → ${mb(after)}${failed ? ` · ${failed} couldn't be shrunk` : ''}`, !!failed);
    b.disabled = false; render();
    return;
  }
  if (e.target.closest('[data-delunused]')) {
    const list = files.filter(x => !x.used.length), size = list.reduce((s, x) => s + x.size, 0);
    if (!confirm(`Delete ${list.length} file${list.length === 1 ? '' : 's'} (${mb(size)}) that no story or page uses?\n\n${list.slice(0, 8).map(x => '· ' + x.name).join('\n')}${list.length > 8 ? '\n…' : ''}\n\nDeleted files can't be brought back from History.`)) return;
    try { await remove(list); toast(`Deleted ${list.length} unused file${list.length === 1 ? '' : 's'}.`); render(); } catch (err) { toast(`Couldn't delete: ${errMsg(err)}`, true); }
  }
});

load();
