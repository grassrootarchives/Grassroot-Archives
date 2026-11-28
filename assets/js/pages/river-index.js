// The Archive (river-index.html): every published story as a plain table (no map loads).
// Opens on all valleys; ?v=<slug> opens on one valley. The valley selector sits just above the sort order.
import { wireParams } from '../params.js';
import { boot, shell, setMeta } from './common.js';
import { getValley, getPublishedStories, getPageBy } from '../db.js';
import { renderBlocks } from '../blocks.js';
import { esc, errorBox } from '../ui.js';
import { siteUrl } from '../config.js';

const app = document.getElementById('app');
try {
  const site = await boot();
  const published = site.valleys.filter(v => v.status === 'published');
  if (!published.length) {
    shell(app, site, { current: 'index_template', main: `<div class="wrap" style="padding:96px 32px"><h1 class="display" style="font-size:44px">No valley to list yet</h1></div>` });
  } else {
    // A ?v= link opens that valley (old long addresses included); anything else opens all valleys.
    const asked = new URLSearchParams(location.search).get('v');
    let pick = asked ? (published.find(v => v.slug === asked) || await getValley(asked).catch(() => null)) : null;
    if (pick && !published.some(v => v.id === pick.id)) pick = null;
    let current = pick?.slug || 'all';
    const [template, all] = await Promise.all([getPageBy('kind', 'index_template'), getPublishedStories(published.map(v => v.id))]);
    const byId = Object.fromEntries(published.map(v => [v.id, v]));
    const order = Object.fromEntries(published.map((v, i) => [v.id, i]));
    // Numbers run per valley, upstream to downstream.
    for (const v of published) all.filter(s => s.valley_id === v.id).forEach((s, i) => { if (s.number == null) s.number = i + 1; });
    let down = true;
    const mediaTypes = s => [...new Set((s.media || []).map(m => ({ photo: 'Photo', audio: 'Audio', video: 'Video', document: 'Text' })[m.type] || 'Text'))].concat(s.transcript ? ['Text'] : []).filter((v, i, a) => a.indexOf(v) === i).join(', ') || '—';
    const count = id => all.filter(s => s.valley_id === id).length;
    const selected = () => current === 'all' ? null : published.find(v => v.slug === current);
    const rows = () => {
      const v = selected();
      const list = (v ? all.filter(s => s.valley_id === v.id) : all.slice())
        .sort((a, b) => (order[a.valley_id] - order[b.valley_id]) || ((a.river_km ?? 1e9) - (b.river_km ?? 1e9)) || ((a.number ?? 0) - (b.number ?? 0)));
      if (!down) list.reverse();
      return list;
    };
    const table = () => {
      const v = selected(), list = rows(), many = !v;
      return `
      <div class="wrap" style="display:flex;flex-direction:column;gap:16px">
        <div role="group" aria-label="River valley" class="archive-valleys">
          <span class="label">River valley</span>
          <div class="chips"><button type="button" class="chip" aria-pressed="${!v}" data-valley="all">All valleys <span class="muted">${all.length}</span></button>
          ${published.map(x => `<button type="button" class="chip" aria-pressed="${v?.id === x.id}" data-valley="${esc(x.slug)}">${esc(x.name)} <span class="muted">${count(x.id)}</span></button>`).join('')}</div>
        </div>
        <div role="group" aria-label="Sort order" style="display:flex;gap:6px;flex-wrap:wrap">
          <button type="button" class="chip" aria-pressed="${down}" data-sort="down">Upstream → downstream</button>
          <button type="button" class="chip" aria-pressed="${!down}" data-sort="up">Downstream → upstream</button>
        </div>
        <div class="table-wrap"><table class="index">
          <caption class="sr-only">Stories in ${esc(v ? v.name : 'all valleys')}</caption>
          <thead><tr><th scope="col">ID</th><th scope="col">Name / interviewee</th>${many ? '<th scope="col">Valley</th>' : ''}<th scope="col">Zone</th><th scope="col" style="text-align:right">Elev</th><th scope="col" style="text-align:right">Km</th><th scope="col">Media</th><th scope="col"><span class="sr-only">Open</span></th></tr></thead>
          <tbody>${list.map(s => { const sv = byId[s.valley_id]; return `<tr>
            <td><strong>${String(s.number).padStart(2, '0')}</strong></td>
            <td class="name">${esc(s.interviewee ? `${s.interviewee} — ${s.place}` : s.place)}</td>
            ${many ? `<td>${esc(sv?.name || '—')}</td>` : ''}
            <td>${esc(s.zone || '—')}</td><td class="num">${s.elevation != null ? Math.round(s.elevation) + 'm' : '—'}</td>
            <td class="num">${s.river_km != null ? Number(s.river_km).toFixed(1) : '—'}</td><td class="muted">${esc(mediaTypes(s))}</td>
            <td style="text-align:right"><a class="btn btn--small btn--quiet" href="${esc(siteUrl('valley.html?v=' + encodeURIComponent(sv?.slug || '') + '#story-' + s.id))}">Open →</a></td></tr>`; }).join('') || `<tr><td colspan="${many ? 8 : 7}" class="muted">No stories published yet.</td></tr>`}
          </tbody></table></div>
        <p class="muted" style="margin:0;font-size:12px">Elevation in metres above mean sea level. Km measured along each river from its source.${v?.source_credit ? ' Elevations from ' + esc(v.source_credit) + '.' : ''}${many ? ' With all valleys shown, stories are grouped by valley, then ordered along the river.' : ''}</p>
      </div>`;
    };
    const tpl = template?.blocks?.length ? template.blocks : [{ id: 'h', type: 'heading', size: 'page', eyebrow: '{valley.name} · The Archive', title: 'The river, read upstream to downstream' }, { id: 's', type: 'stories' }];
    const draw = focusSel => {
      const v = selected(), ctxValley = v || { name: 'All valleys', region: '', intro: '' };
      shell(app, site, { current: 'index_template', main: `<div class="blocks" style="gap:32px">${renderBlocks(tpl, { valley: ctxValley, slots: { stories: table() } })}</div>` });
      wireParams(app);
      app.querySelectorAll('[data-sort]').forEach(b => b.addEventListener('click', () => { down = b.dataset.sort === 'down'; draw(`[data-sort="${b.dataset.sort}"]`); }));
      app.querySelectorAll('[data-valley]').forEach(b => b.addEventListener('click', () => {
        current = b.dataset.valley;
        const url = new URL(location.href); current === 'all' ? url.searchParams.delete('v') : url.searchParams.set('v', current); history.replaceState(null, '', url);
        draw(`[data-valley="${CSS.escape(current)}"]`);
      }));
      if (focusSel) app.querySelector(focusSel)?.focus();
      setMeta(`The Archive · ${v ? v.name + ' · ' : ''}${site.settings.site_name}`);
    };
    draw();
  }
} catch (err) { app.innerHTML = errorBox(err); }
