// Version history: every saved change to pages, valleys, stories and site settings, with restore.
import { requireAdmin, layout, toast, errMsg, param } from './common.js';
import { esc } from '../ui.js';
import { siteUrl } from '../config.js';

const app = document.getElementById('app');
const { sb, user } = await requireAdmin('history');
const TYPES = { pages: 'Page', valleys: 'River basin', stories: 'Story', site_settings: 'Site settings' };
const SKIP = new Set(['id', 'created_at', 'updated_at']);
const LABEL = { blocks: 'Published content', draft_blocks: 'Draft content', show_in_menu: 'Shown in menu', menu_order: 'Menu order', map_style: 'Map style', contour_interval: 'Contour interval', source_credit: 'Map data source', layers_credit: 'Layer sources', river_length_km: 'River length (km)', valley_id: 'Valley', river_km: 'River km', sub_basin: 'Sub-basin', site_name: 'Site name', contact_email: 'Contact email', data: 'Map files' };
let filter = { table: param('table') || '', key: param('key') || '' };
let rows = [], done = false, selected = null;

const main = layout(app, 'history', user, `
  <div class="admin__head"><div><span class="eyebrow">History</span><h1>Version history</h1>
    <p class="muted" style="margin:8px 0 0;max-width:680px">Every saved change to pages, river basins, stories and site settings is kept: the latest 100 versions of each item. Select a change to see what it changed, and restore any earlier version.</p></div></div>
  <div class="tabs" role="group" aria-label="Filter" data-filter>
    ${[['', 'Everything'], ...Object.entries(TYPES)].map(([k, l]) => `<button type="button" class="chip" data-t="${k}" aria-pressed="${filter.table === k && !filter.key}">${l}</button>`).join('')}
    <span data-keynote class="muted" style="align-self:center"></span></div>
  <div class="cols" style="align-items:flex-start">
    <div><div class="list" data-list></div><div style="padding-top:12px"><button type="button" class="btn btn--small btn--quiet" data-more>Load older changes</button></div></div>
    <div class="panel" data-detail style="position:sticky;top:20px"><span class="muted">Select a change to see its details.</span></div>
  </div>`);
const $ = q => main.querySelector(q);

const titleOf = r => r.table_name === 'site_settings' ? 'Site settings' : (r.data?.title || r.data?.name || r.data?.place || r.row_key.slice(0, 8));
const when = t => new Date(t).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
function short(k, v) {
  if (v == null || v === '') return '<span class="muted">—</span>';
  if (k === 'blocks' || k === 'draft_blocks') return esc(`${v.length} blocks: ${v.map(b => b.type).join(', ')}`);
  if (k === 'data') return esc(Object.keys(v).join(', ') || 'none');
  if (k === 'media') return esc(`${v.length} item${v.length === 1 ? '' : 's'}${v.length ? ': ' + v.map(m => m.type).join(', ') : ''}`);
  if (k === 'profile') return esc(`${v.length} points`);
  if (k === 'zones') return esc(v.map(z => z.name).join(', '));
  if (k === 'bounds') return esc(v.map(n => Number(n).toFixed(3)).join(', '));
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
  return esc(s.length > 220 ? s.slice(0, 220) + '…' : s);
}
function changed(a, b) {
  if (!a) return Object.keys(b || {}).filter(k => !SKIP.has(k) && b[k] != null && b[k] !== '');
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].filter(k => !SKIP.has(k) && JSON.stringify(a[k]) !== JSON.stringify(b[k]));
}

async function load(more = false) {
  let q = sb.from('revisions').select('*').order('id', { ascending: false }).limit(50);
  if (filter.table) q = q.eq('table_name', filter.table);
  if (filter.key) q = q.eq('row_key', filter.key);
  if (more && rows.length) q = q.lt('id', rows.at(-1).id);
  const { data, error } = await q;
  if (error) { toast(errMsg(error), true); return; }
  rows = more ? rows.concat(data) : data; done = data.length < 50;
  draw();
}
function prevOf(r) { return rows.find(x => x.table_name === r.table_name && x.row_key === r.row_key && x.id < r.id); }
function draw() {
  $('[data-keynote]').textContent = filter.key && rows[0] ? `Showing: ${titleOf(rows[0])}` : '';
  $('[data-more]').hidden = done;
  $('[data-list]').innerHTML = rows.map(r => {
    const p = prevOf(r), keys = r.action === 'update' && p ? changed(p.data, r.data) : null;
    return `<div><button type="button" style="all:unset;cursor:pointer;display:flex;flex-direction:column;gap:4px;flex:1;min-width:0" data-rev="${r.id}">
      <span><span class="status ${r.action === 'delete' ? 'status--draft warn' : r.action === 'insert' ? 'status--published' : 'status--draft'}">${r.action === 'insert' ? 'created' : r.action === 'delete' ? 'deleted' : 'edited'}</span>
        <strong style="margin-left:8px">${esc(TYPES[r.table_name])} · ${esc(titleOf(r))}</strong></span>
      <span class="muted" style="font-size:12px">${esc(when(r.changed_at))} · ${esc(r.changed_by || '—')}${keys ? ' · changed ' + esc(keys.map(k => LABEL[k] || k.replace(/_/g, ' ')).join(', ') || 'nothing visible') : ''}</span></button></div>`;
  }).join('') || '<div class="muted">No changes recorded yet.</div>';
  main.querySelectorAll('[data-rev]').forEach(b => b.addEventListener('click', () => detail(rows.find(r => String(r.id) === b.dataset.rev))));
}

async function detail(r) {
  selected = r;
  let p = prevOf(r);
  if (!p && r.action !== 'insert') {
    const { data } = await sb.from('revisions').select('*').eq('table_name', r.table_name).eq('row_key', r.row_key).lt('id', r.id).order('id', { ascending: false }).limit(1);
    p = data?.[0];
  }
  const before = r.action === 'delete' ? r.data : p?.data, after = r.action === 'delete' ? null : r.data;
  const keys = r.action === 'delete' ? [] : changed(r.action === 'insert' ? null : before, after);
  const editor = { pages: `admin/pages.html?p=${encodeURIComponent(r.data.slug || '')}`, valleys: `admin/basin.html?id=${r.row_key}`, stories: `admin/story.html?id=${r.row_key}`, site_settings: 'admin/settings.html' }[r.table_name];
  $('[data-detail]').innerHTML = `<h2>${esc(TYPES[r.table_name])} · ${esc(titleOf(r))}</h2>
    <span class="muted">${r.action === 'insert' ? 'Created' : r.action === 'delete' ? 'Deleted' : 'Edited'} ${esc(when(r.changed_at))} by ${esc(r.changed_by || '—')}</span>
    ${r.action === 'delete' ? '<p style="margin:0">This item was deleted. Restoring brings it back as it was just before deletion.</p>' : keys.length ? `<div class="table-wrap" style="border-top:1px solid var(--line)"><table class="index" style="min-width:0"><thead><tr><th>Field</th>${r.action === 'update' ? '<th>Before</th>' : ''}<th>${r.action === 'update' ? 'After' : 'Value'}</th></tr></thead><tbody>
      ${keys.map(k => `<tr><td>${esc(LABEL[k] || k.replace(/_/g, ' '))}</td>${r.action === 'update' ? `<td>${short(k, before?.[k])}</td>` : ''}<td>${short(k, after?.[k])}</td></tr>`).join('')}</tbody></table></div>` : '<span class="muted">No visible fields changed.</span>'}
    <div class="row">
      <button type="button" class="btn btn--publish" data-restore>${r.action === 'delete' ? 'Restore deleted item' : 'Restore this version'}</button>
      ${r.action !== 'delete' ? `<a class="btn btn--quiet" href="${esc(siteUrl(editor))}">Open in editor</a>` : ''}
      <button type="button" class="btn btn--quiet" data-only>All versions of this item</button></div>
    <span class="muted" style="font-size:12px">Restoring saves the chosen version as a new change, so it can itself be undone here.</span>`;
  $('[data-only]').addEventListener('click', () => { filter = { table: r.table_name, key: r.row_key }; main.querySelectorAll('[data-t]').forEach(x => x.setAttribute('aria-pressed', 'false')); load(); });
  $('[data-restore]').addEventListener('click', () => restore(r));
}

async function restore(r) {
  if (!confirm(`Restore “${titleOf(r)}” to the version from ${when(r.changed_at)}?`)) return;
  const clean = Object.fromEntries(Object.entries(r.data).filter(([k]) => !['created_at', 'updated_at'].includes(k)));
  const keyCol = 'id', keyVal = r.table_name === 'site_settings' ? Number(r.row_key) : r.row_key;
  const { data: exists } = await sb.from(r.table_name).select('id').eq(keyCol, keyVal).maybeSingle();
  let res;
  if (exists) { const { id, ...rest } = clean; res = await sb.from(r.table_name).update(rest).eq(keyCol, keyVal); }
  else res = await sb.from(r.table_name).insert(clean);
  if (res.error) { toast(res.error.message.includes('_key') ? 'Could not restore: another item now uses the same address or name.' : errMsg(res.error), true); return; }
  toast('Restored. The restore is now the latest version.');
  await load();
}

main.querySelector('[data-filter]').addEventListener('click', e => {
  const b = e.target.closest('[data-t]'); if (!b) return;
  filter = { table: b.dataset.t, key: '' };
  main.querySelectorAll('[data-t]').forEach(x => x.setAttribute('aria-pressed', x === b));
  load();
});
$('[data-more]').addEventListener('click', () => load(true));
await load();
if (param('key') && rows[0]) detail(rows[0]);
