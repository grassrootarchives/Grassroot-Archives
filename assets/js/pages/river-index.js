// The Archive (river-index.html): every story of a valley as a plain table (no map loads).
import { boot, shell, setMeta } from './common.js';
import { getValley, getStories, getPageBy } from '../db.js';
import { renderBlocks } from '../blocks.js';
import { esc, errorBox } from '../ui.js';
import { siteUrl } from '../config.js';

const app = document.getElementById('app');
try {
  const site = await boot();
  const published = site.valleys.filter(v => v.status === 'published');
  const slug = new URLSearchParams(location.search).get('v') || published[0]?.slug;
  const valley = slug ? await getValley(slug) : null;
  if (!valley) {
    shell(app, site, { current: 'index_template', main: `<div class="wrap" style="padding:96px 32px"><h1 class="display" style="font-size:44px">No valley to list yet</h1></div>` });
  } else {
    const [template, stories] = await Promise.all([getPageBy('kind', 'index_template'), getStories(valley.id)]);
    stories.forEach((s, i) => { if (s.number == null) s.number = i + 1; });
    let down = true;
    const mediaTypes = s => [...new Set((s.media || []).map(m => ({ photo: 'Photo', audio: 'Audio', video: 'Video', document: 'Text' })[m.type] || 'Text'))].concat(s.transcript ? ['Text'] : []).filter((v, i, a) => a.indexOf(v) === i).join(', ') || '—';
    const table = () => `
      <div class="wrap" style="display:flex;flex-direction:column;gap:20px">
        <div role="group" aria-label="Sort order" style="display:flex;gap:6px;flex-wrap:wrap">
          <button type="button" class="chip" aria-pressed="${down}" data-sort="down">Upstream → downstream</button>
          <button type="button" class="chip" aria-pressed="${!down}" data-sort="up">Downstream → upstream</button>
        </div>
        <div class="table-wrap"><table class="index">
          <caption class="sr-only">Stories in ${esc(valley.name)}</caption>
          <thead><tr><th scope="col">ID</th><th scope="col">Name / interviewee</th><th scope="col">Zone</th><th scope="col" style="text-align:right">Elev</th><th scope="col" style="text-align:right">Km</th><th scope="col">Media</th><th scope="col"><span class="sr-only">Open</span></th></tr></thead>
          <tbody>${(down ? stories : [...stories].reverse()).map(s => `<tr>
            <td><strong>${String(s.number).padStart(2, '0')}</strong></td>
            <td class="name">${esc(s.interviewee ? `${s.interviewee} — ${s.place}` : s.place)}</td>
            <td>${esc(s.zone || '—')}</td><td class="num">${s.elevation != null ? Math.round(s.elevation) + 'm' : '—'}</td>
            <td class="num">${s.river_km != null ? Number(s.river_km).toFixed(1) : '—'}</td><td class="muted">${esc(mediaTypes(s))}</td>
            <td style="text-align:right"><a class="btn btn--small btn--quiet" href="${esc(siteUrl('valley.html?v=' + encodeURIComponent(valley.slug) + '#story-' + s.id))}">Open →</a></td></tr>`).join('') || `<tr><td colspan="7" class="muted">No stories published yet.</td></tr>`}
          </tbody></table></div>
        <p class="muted" style="margin:0;font-size:12px">Elevation in metres above mean sea level. Km measured along the river from its source.${valley.source_credit ? ' Elevations from ' + esc(valley.source_credit) + '.' : ''}</p>
      </div>`;
    const tpl = template?.blocks?.length ? template.blocks : [{ id: 'h', type: 'heading', size: 'page', eyebrow: '{valley.name} · Index', title: 'The river, read upstream to downstream' }, { id: 's', type: 'stories' }];
    const draw = () => {
      shell(app, site, { current: 'index_template', valley, main: `<div class="blocks" style="gap:32px">${renderBlocks(tpl, { valley, slots: { stories: table() } })}</div>` });
      app.querySelectorAll('[data-sort]').forEach(b => b.addEventListener('click', () => { down = b.dataset.sort === 'down'; draw(); app.querySelector(`[data-sort="${b.dataset.sort}"]`).focus(); }));
    };
    draw();
    setMeta(`The Archive · ${valley.name} · ${site.settings.site_name}`);
  }
} catch (err) { app.innerHTML = errorBox(err); }
