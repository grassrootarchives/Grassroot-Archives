import { requireAdmin, layout, toast, param } from './common.js';
import { loadValleyData } from '../db.js';
import { esc } from '../ui.js';
import { siteUrl } from '../config.js';
import { createMap } from '../map/map.js';
import { STYLES } from '../map/symbols.js';

const app = document.getElementById('app');
const { sb, user } = await requireAdmin('basins');
const [{ data: valleys, error }, { data: stories }] = await Promise.all([
  sb.from('valleys').select('*').order('menu_order').order('name'),
  sb.from('stories').select('valley_id,status')
]);
const count = id => (stories || []).filter(s => s.valley_id === id).length;
const main = layout(app, 'basins', user, `
  <div class="admin__head"><div><span class="eyebrow">River basins</span><h1>Your river valleys</h1>
    <p class="muted" style="margin:8px 0 0;max-width:640px">Add any river valley: each starts from one georeferenced contour map or elevation model. Publishing a valley creates its map page and adds it to the site's valley menu.</p></div>
    <a class="btn btn--primary" href="${esc(siteUrl('admin/basin.html'))}">+ New river basin</a></div>
  ${error ? `<div class="notice is-error">${esc(error.message)}</div>` : ''}
  <div class="valley-cards">${(valleys || []).map(v => `
    <article class="valley-card" style="text-decoration:none">
      <div class="thumb" data-thumb="${esc(v.id)}" style="position:relative">${v.data?.grid ? '' : '<div class="empty" style="height:100%;display:grid;place-items:center">No map yet</div>'}</div>
      <div style="padding:16px 18px;display:flex;flex-direction:column;gap:10px">
        <div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><strong class="serif" style="font-size:22px;font-weight:400">${esc(v.name)}</strong><span class="status status--${esc(v.status)}">${esc(v.status)}</span></div>
        <dl class="facts" style="grid-template-columns:110px 1fr;font-size:12px">
          <dt>PAGE</dt><dd>valley.html?v=${esc(v.slug)}</dd><dt>MAP STYLE</dt><dd>${esc(STYLES[v.map_style]?.name || v.map_style)}</dd>
          <dt>SOURCE</dt><dd>${esc(v.source_credit || '—')}</dd><dt>STORIES</dt><dd>${count(v.id)}</dd><dt>IN MENU</dt><dd>${v.show_in_menu ? 'Yes' : 'No'}</dd></dl>
        <div class="row"><a class="btn btn--small" href="${esc(siteUrl('admin/story.html?valley=' + v.id))}">+ Add story</a>
          <a class="btn btn--small btn--quiet" href="${esc(siteUrl('admin/basin.html?id=' + v.id))}">Edit map &amp; details</a>
          ${v.status === 'published' ? `<a class="btn btn--small btn--quiet" target="_blank" rel="noopener" href="${esc(siteUrl('valley.html?v=' + encodeURIComponent(v.slug)))}">View page ↗</a>` : ''}</div>
      </div></article>`).join('') || '<div class="empty">No river basins yet. Start with “New river basin”.</div>'}</div>`);
if (param('deleted')) toast('River basin deleted.');
for (const v of valleys || []) {
  if (!v.data?.grid) continue;
  const el = main.querySelector(`[data-thumb="${v.id}"]`);
  loadValleyData(v).then(d => { createMap(el, { ...d, style: v.map_style, interval: (v.contour_interval || 20) * 2, layers: { settlements: false, infra: false, pins: false } }); el.querySelector('.gmap__frame').style.pointerEvents = 'none'; }).catch(() => {});
}
