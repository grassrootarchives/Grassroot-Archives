import { requireAdmin, layout, toast, param } from './common.js';
import { esc } from '../ui.js';
import { siteUrl } from '../config.js';
import { levelOf, strategiesOf } from '../resilience.js';
import { linkLabel } from '../hazards.js';

const app = document.getElementById('app');
const { sb, user } = await requireAdmin('stories');
const [{ data: valleys }, { data: stories, error }] = await Promise.all([
  sb.from('valleys').select('id,name,slug,status').order('menu_order').order('name'),
  sb.from('stories').select('id,valley_id,number,place,interviewee,theme,status,consent,river_km,media,updated_at').order('river_km', { ascending: true })
]);
let filter = param('valley') || 'all';
const vName = id => valleys?.find(v => v.id === id)?.name || '—';
const main = layout(app, 'stories', user, `
  <div class="admin__head"><div><span class="eyebrow">Stories</span><h1>Stories</h1></div>
    <div class="row" style="gap:8px"><button type="button" class="btn" data-csv>Download CSV</button>
    <a class="btn btn--primary" href="${esc(siteUrl('admin/story.html' + (filter !== 'all' ? '?valley=' + filter : '')))}" data-new>+ Add a story</a></div></div>
  ${error ? `<div class="notice is-error">${esc(error.message)}</div>` : ''}
  <div class="tabs" role="group" aria-label="Filter by valley">
    <button type="button" class="chip" data-f="all" aria-pressed="${filter === 'all'}">All valleys</button>
    ${(valleys || []).map(v => `<button type="button" class="chip" data-f="${esc(v.id)}" aria-pressed="${filter === v.id}">${esc(v.name)}</button>`).join('')}</div>
  <div class="table-wrap"><table class="index" style="min-width:760px"><caption class="sr-only">Stories</caption>
    <thead><tr><th scope="col">No.</th><th scope="col">Place / interviewee</th><th scope="col">Valley</th><th scope="col">Theme</th><th scope="col" style="text-align:right">Km</th><th scope="col">Media</th><th scope="col">Status</th><th scope="col"><span class="sr-only">Edit</span></th></tr></thead>
    <tbody data-rows></tbody></table></div>`);
function rows() {
  const list = (stories || []).filter(s => filter === 'all' || s.valley_id === filter);
  main.querySelector('[data-rows]').innerHTML = list.map(s => `<tr>
    <td><strong>${String(s.number ?? '').padStart(2, '0')}</strong></td>
    <td class="name">${esc(s.place)}${s.interviewee ? `<div class="muted" style="font-family:var(--font-ui);font-size:12px">${esc(s.interviewee)}</div>` : ''}</td>
    <td>${esc(vName(s.valley_id))}</td><td>${esc(s.theme || '—')}</td><td class="num">${s.river_km != null ? Number(s.river_km).toFixed(1) : '—'}</td>
    <td class="muted">${esc([...new Set((s.media || []).map(m => m.type))].join(', ') || '—')}</td>
    <td><span class="status status--${esc(s.status)}">${esc(s.status)}</span>${!s.consent ? '<div class="warn" style="font-size:11px">No consent</div>' : ''}</td>
    <td style="text-align:right"><a class="btn btn--small btn--quiet" href="${esc(siteUrl('admin/story.html?id=' + s.id))}">Edit</a></td></tr>`).join('') || `<tr><td colspan="8" class="muted">No stories yet.</td></tr>`;
}
main.querySelector('.tabs').addEventListener('click', e => {
  const b = e.target.closest('[data-f]'); if (!b) return; filter = b.dataset.f;
  main.querySelectorAll('[data-f]').forEach(x => x.setAttribute('aria-pressed', x === b));
  main.querySelector('[data-new]').href = siteUrl('admin/story.html' + (filter !== 'all' ? '?valley=' + filter : ''));
  rows();
});
rows();

// ---------- CSV export of the stories shown (all valleys, or the selected one) ----------
const cell = v => { if (v == null) return ''; const t = String(v); return /[",\n\r]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
main.querySelector('[data-csv]').addEventListener('click', async e => {
  const btn = e.currentTarget; btn.disabled = true; btn.textContent = 'Preparing…';
  try {
    let q = sb.from('stories').select('*').order('river_km', { ascending: true });
    if (filter !== 'all') q = q.eq('valley_id', filter);
    const { data, error } = await q; if (error) throw error;
    const byId = Object.fromEntries((valleys || []).map(v => [v.id, v]));
    const cols = [
      ['Valley', s => byId[s.valley_id]?.name], ['Story no.', s => s.number], ['Place', s => s.place],
      ['Interviewee', s => s.interviewee], ['Age', s => s.age], ['Role', s => s.role], ['Theme', s => s.theme],
      ['Latitude', s => s.lat], ['Longitude', s => s.lng], ['Elevation (m)', s => s.elevation], ['River km', s => s.river_km],
      ['Zone', s => s.zone], ['Sub-basin', s => s.sub_basin], ['Pull-quote', s => s.quote], ['Narrative & transcript', s => s.transcript],
      ['Resilience strategies', s => strategiesOf(s.resilience).map((x, i) => `${i + 1}. [${levelOf(x.level).name}]${x.hazard && x.link ? ' (responds to ' + linkLabel(x.hazard, x.link) + ')' : ''}${x.when ? ' ' + x.when + ':' : ''} ${x.text || ''}`.trim()).join('\n\n')],
      ['Flashpoints', s => s.flashpoints],
      ['Strategy count', s => strategiesOf(s.resilience).length],
      ['Hazard chain steps', s => [...new Set(strategiesOf(s.resilience).filter(x => x.hazard && x.link).map(x => linkLabel(x.hazard, x.link)))].join(' | ')],
      ['Media types', s => [...new Set((s.media || []).map(m => m.type))].join(', ')],
      ['Media files', s => (s.media || []).map(m => m.url).join(' | ')],
      ['Status', s => s.status], ['Consent recorded', s => (s.consent ? 'Yes' : 'No')],
      ['Page link', s => byId[s.valley_id] ? siteUrl('valley.html?v=' + encodeURIComponent(byId[s.valley_id].slug) + '#story-' + s.id) : ''],
      ['Created', s => s.created_at], ['Last updated', s => s.updated_at], ['Story ID', s => s.id]
    ];
    const csv = '﻿' + [cols.map(c => cell(c[0])).join(','), ...(data || []).map(s => cols.map(c => cell(c[1](s))).join(','))].join('\r\n');
    const slug = filter === 'all' ? 'all-valleys' : (byId[filter]?.slug || 'valley');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `grassroot-archives-stories-${slug}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast(`Downloaded ${data.length} ${data.length === 1 ? 'story' : 'stories'}.`);
  } catch (err) { toast('Could not prepare the CSV: ' + (err.message || err), true); }
  btn.disabled = false; btn.textContent = 'Download CSV';
});
if (param('deleted')) toast('Story deleted.');
