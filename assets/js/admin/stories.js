import { requireAdmin, layout, toast, param } from './common.js';
import { esc } from '../ui.js';
import { siteUrl } from '../config.js';

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
    <a class="btn btn--primary" href="${esc(siteUrl('admin/story.html' + (filter !== 'all' ? '?valley=' + filter : '')))}" data-new>+ Add a story</a></div>
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
if (param('deleted')) toast('Story deleted.');
