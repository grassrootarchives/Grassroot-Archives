// Valley map page: map, filters, telemetry, layers, legend, profile and the story drawer.
import { boot, shell, setMeta } from './common.js';
import { getValley, getStories, getPageBy, loadValleyData, dataUrl } from '../db.js';
import { renderBlocks } from '../blocks.js';
import { esc, md, errorBox } from '../ui.js';
import { siteUrl } from '../config.js';
import { createMap } from '../map/map.js';
import { STYLES } from '../map/symbols.js';
import { mountLegend } from '../map/legend.js';
import { formatDMS, zoneFor } from '../geo/geom.js';

const THEMES = ['Water Governance', 'Agrarian Change', 'Oral History', 'Ecology'];
const app = document.getElementById('app');
const pad = n => n == null ? '' : String(n).padStart(2, '0');
const fmtKm = v => v == null ? '—' : Number(v).toFixed(1);
const fmtM = v => v == null ? '—' : Math.round(v) + 'm';

try {
  const site = await boot();
  const published = site.valleys.filter(v => v.status === 'published');
  const slug = new URLSearchParams(location.search).get('v') || published[0]?.slug;
  const valley = slug ? await getValley(slug) : null;
  if (!valley) {
    shell(app, site, { current: 'valley_template', main: `<div class="wrap" style="padding:96px 32px"><h1 class="display" style="font-size:44px">No valley to show yet</h1><p class="muted">Valleys appear here once they are published from the admin.</p></div>` });
  } else {
    const [template, stories, data] = await Promise.all([getPageBy('kind', 'valley_template'), getStories(valley.id), loadValleyData(valley)]);
    stories.forEach((s, i) => { if (s.number == null) s.number = i + 1; });
    render(site, valley, template, stories, data);
  }
} catch (err) { app.innerHTML = errorBox(err); }

function render(site, valley, template, stories, data) {
  const zones = (valley.zones || []).map(z => z.name);
  const totalKm = valley.river_length_km || (valley.profile?.length ? valley.profile.at(-1)[0] : null);
  const style = STYLES[valley.map_style] ? valley.map_style : 'contour';
  const slot = `
  <div class="mapapp">
    <aside class="mapapp__side" aria-label="Filters and map layers">
      <h2>Filter &amp; telemetry</h2>
      <fieldset><legend class="label">Zone</legend><div class="chips" data-filter="zone">
        ${['All', ...zones].map((z, i) => `<button type="button" class="chip" aria-pressed="${i === 0}" data-value="${esc(z)}">${esc(z)}</button>`).join('')}</div></fieldset>
      <fieldset><legend class="label">Theme</legend><div class="chips" data-filter="theme">
        ${['All', ...THEMES].map((t, i) => `<button type="button" class="chip" aria-pressed="${i === 0}" data-value="${esc(t)}">${esc(t)}</button>`).join('')}</div></fieldset>
      <div class="telemetry" aria-live="polite" data-telemetry></div>
      <p class="muted" style="margin:0;font-size:12px">Switch map features on and off in the legend. Drag to move the map; pinch, Ctrl-scroll or use + and − to zoom.</p>
    </aside>
    <div class="mapapp__main">
      <div class="mapbox">
        <span class="mapbox__tag">${esc(STYLES[style].name.toUpperCase())}${style === 'contour' ? ` · ${valley.contour_interval} m INTERVAL` : ''}</span>
        <div class="mapbox__corner">
          <div class="row"><span class="mapbox__north" aria-label="North is up">N ↑</span>
          <button type="button" class="mapbox__legendbtn" aria-expanded="true" data-legend-toggle>LEGEND ▾</button></div>
          <div class="mapbox__legend" data-legend></div>
        </div>
        <div data-map></div>
        ${(valley.source_credit || valley.layers_credit) ? `<div class="mapbox__credit">MAP DATA: ${esc(valley.source_credit || '')}${valley.layers_credit ? ' · ' + esc(valley.layers_credit) : ''}</div>` : ''}
        <div class="mapbox__zoom"><button type="button" aria-label="Zoom in" data-zoom="in">+</button><button type="button" aria-label="Zoom out" data-zoom="out">−</button><button type="button" aria-label="Reset view" data-zoom="reset" style="font-size:14px">⟲</button></div>
      </div>
      ${valley.profile?.length ? `<section class="profile" aria-label="Longitudinal profile">
        <div class="profile__head"><strong>LONGITUDINAL PROFILE</strong><span class="muted">SOURCE ${fmtM(valley.profile[0][1])} · km 0 → MOUTH ${fmtM(valley.profile.at(-1)[1])} · km ${fmtKm(totalKm)}</span></div>
        <div class="profile__plot" data-profile></div></section>` : ''}
    </div>
  </div>`;
  const tpl = template?.blocks?.length ? template.blocks : [{ id: 'h', type: 'heading', size: 'page', title: '{valley.name}' }, { id: 'm', type: 'map' }];
  shell(app, site, {
    current: 'valley_template', valley,
    main: `<div class="blocks" style="gap:24px;padding-bottom:0">${renderBlocks(tpl, { valley, valleys: site.valleys, slots: { map: slot } })}</div><div data-drawer></div>`
  });
  setMeta(`${valley.name} · ${site.settings.site_name}`, valley.intro);

  const state = { zone: 'All', theme: 'All', open: null, hover: null };
  const tele = app.querySelector('[data-telemetry]');
  const matches = s => (state.zone === 'All' || s.zone === state.zone) && (state.theme === 'All' || s.theme === state.theme);

  const map = createMap(app.querySelector('[data-map]'), {
    ...data, style, interval: valley.contour_interval || 20, stories, label: `Map of ${valley.name}`,
    onPinClick: s => openStory(s.id), onPinHover: s => { state.hover = s; telemetry(); },
    onCursor: c => { state.cursor = c; if (!state.hover) telemetry(); }
  });

  function telemetry() {
    const s = state.hover;
    if (s) {
      tele.innerHTML = `<span class="eyebrow">Active node · ${pad(s.number)}</span><span>${esc(s.place.toUpperCase())}</span><span>ELEV: ${fmtM(s.elevation)} ASL · KM ${fmtKm(s.river_km)}</span><span>ZONE: ${esc((s.zone || '—').toUpperCase())}</span>`;
    } else if (state.cursor) {
      const c = state.cursor, snap = map.snap(c.lon, c.lat);
      tele.innerHTML = `<span class="eyebrow">Active cursor</span><span>${formatDMS(c.lat, c.lon)}</span><span>ELEV: ${fmtM(c.elevation)} ASL</span><span>NEAREST RIVER KM: ${snap ? fmtKm(snap.km) : '—'}</span>`;
    } else {
      tele.innerHTML = `<span class="eyebrow">${esc(valley.name)}</span><span>${stories.length} ${stories.length === 1 ? 'story' : 'stories'} on the map</span>${totalKm ? `<span>RIVER: ${fmtKm(totalKm)} km</span>` : ''}${valley.region ? `<span>${esc(valley.region)}</span>` : ''}`;
    }
  }
  telemetry();
  app.querySelector('.mapbox').addEventListener('mouseleave', () => { state.cursor = null; telemetry(); });

  // Filters.
  app.querySelectorAll('[data-filter]').forEach(group => group.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    state[group.dataset.filter] = b.dataset.value;
    group.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b));
    const dim = stories.filter(s => !matches(s)).map(s => s.id);
    map.setDim(dim); drawProfile();
  }));
  // Legend with on/off switches.
  mountLegend(app.querySelector('[data-legend]'), { map, style, data, interval: valley.contour_interval || 20 });
  // Legend & zoom.
  const lt = app.querySelector('[data-legend-toggle]'), lg = app.querySelector('[data-legend]');
  lt.addEventListener('click', () => { lg.hidden = !lg.hidden; lt.setAttribute('aria-expanded', !lg.hidden); lt.textContent = lg.hidden ? 'LEGEND ▸' : 'LEGEND ▾'; });
  if (window.matchMedia('(max-width: 720px)').matches) lt.click();
  app.querySelectorAll('[data-zoom]').forEach(b => b.addEventListener('click', () => ({ in: map.zoomIn, out: map.zoomOut, reset: map.reset })[b.dataset.zoom]()));

  // Profile.
  function drawProfile() {
    const el = app.querySelector('[data-profile]'); if (!el) return;
    const p = valley.profile, maxKm = p.at(-1)[0] || 1, hi = p[0][1], lo = Math.min(...p.map(x => x[1]));
    const y = e => 6 + (hi - e) / ((hi - lo) || 1) * 60;
    const pts = p.map(([k, e]) => `${(k / maxKm * 1000).toFixed(1)},${y(e).toFixed(1)}`).join(' ');
    el.innerHTML = `<svg viewBox="0 0 1000 72" preserveAspectRatio="none" aria-hidden="true"><polygon points="0,72 ${pts} 1000,72" fill="var(--green)"/><polyline points="${pts}" fill="none" stroke="var(--river)" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>` +
      stories.filter(s => s.river_km != null).map(s => {
        const e = s.elevation ?? p.reduce((a, b) => Math.abs(b[0] - s.river_km) < Math.abs(a[0] - s.river_km) ? b : a)[1];
        return `<button type="button" class="${state.open === s.id ? 'is-active' : ''} ${matches(s) ? '' : 'is-dim'}" style="left:${(s.river_km / maxKm * 100).toFixed(2)}%;top:${y(e).toFixed(1)}px" aria-label="Story ${pad(s.number)} on the profile: ${esc(s.place)}" data-id="${esc(s.id)}"><span></span></button>`;
      }).join('');
    el.querySelectorAll('button').forEach(b => {
      const s = stories.find(x => String(x.id) === b.dataset.id);
      b.addEventListener('click', () => openStory(s.id));
      b.addEventListener('mouseenter', () => { state.hover = s; telemetry(); });
      b.addEventListener('mouseleave', () => { state.hover = null; telemetry(); });
    });
  }
  drawProfile();

  // Drawer.
  const drawerRoot = app.querySelector('[data-drawer]');
  let lastFocus = null;
  function media(s) {
    return (s.media || []).map(m => {
      const u = esc(dataUrl(m.url)), cap = m.caption ? `<figcaption>${esc(m.caption)}</figcaption>` : '';
      if (m.type === 'photo') return `<figure><img src="${u}" alt="${esc(m.caption || 'Photograph from the interview')}" loading="lazy">${cap}</figure>`;
      if (m.type === 'audio') return `<figure><audio controls preload="none" src="${u}"></audio>${cap}</figure>`;
      if (m.type === 'video') return `<figure><video controls preload="metadata" src="${u}"></video>${cap}</figure>`;
      return `<p><a href="${u}" target="_blank" rel="noopener">${esc(m.caption || 'Open document')}</a></p>`;
    }).join('');
  }
  function openStory(id) {
    const list = stories.filter(matches).length ? stories.filter(matches) : stories;
    const s = stories.find(x => x.id === id); if (!s) return;
    if (!drawerRoot.innerHTML) lastFocus = document.activeElement;
    state.open = id; map.setActive(id); drawProfile();
    history.replaceState(null, '', '#story-' + id);
    const i = list.indexOf(s);
    drawerRoot.innerHTML = `<div class="drawer-scrim" data-close></div>
    <article class="drawer" role="dialog" aria-modal="true" aria-labelledby="story-title">
      <div class="drawer__bar"><button type="button" class="btn btn--small" data-close>✕ Close</button>
        <div style="display:flex;gap:8px"><button type="button" class="btn btn--small btn--quiet" data-step="-1" ${i <= 0 ? 'disabled' : ''}>← Prev</button><button type="button" class="btn btn--small btn--quiet" data-step="1" ${i < 0 || i >= list.length - 1 ? 'disabled' : ''}>Next →</button></div></div>
      <div class="drawer__body">
        <dl class="catalogue">
          <dt>ARCHIVE ID</dt><dd><strong>${esc(valley.slug.toUpperCase().slice(0, 6))}-${pad(s.number)}</strong></dd>
          <dt>LOCATION</dt><dd id="story-title">${esc(s.place)}${s.river_km != null ? ` (km ${fmtKm(s.river_km)})` : ''}</dd>
          <dt>ELEVATION</dt><dd>${fmtM(s.elevation)} ASL${s.sub_basin ? ` | Sub-basin ${esc(s.sub_basin)}` : ''}</dd>
          <dt>ZONE</dt><dd>${esc(s.zone || '—')}${s.theme ? ` · ${esc(s.theme)}` : ''}</dd>
          <dt>POSITION</dt><dd>${formatDMS(s.lat, s.lng)}</dd>
        </dl>
        ${s.quote ? `<blockquote>“${esc(s.quote)}”</blockquote>` : ''}
        ${s.interviewee ? `<div class="attrib">— ${esc(s.interviewee)}${s.age ? ', ' + esc(s.age) : ''}${s.role ? ' | ' + esc(s.role) : ''}</div>` : ''}
        ${media(s)}
        ${s.transcript ? `<div><span class="label" style="display:block;padding-bottom:8px;border-bottom:1px solid var(--line);margin-bottom:12px">Narrative &amp; transcript</span><div class="prose">${md(s.transcript)}</div></div>` : ''}
      </div>
    </article>`;
    drawerRoot.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', closeStory));
    drawerRoot.querySelectorAll('[data-step]').forEach(b => b.addEventListener('click', () => { const n = list[i + Number(b.dataset.step)]; if (n) openStory(n.id); }));
    drawerRoot.querySelector('.drawer__bar button').focus();
  }
  function closeStory() {
    drawerRoot.innerHTML = ''; state.open = null; map.setActive(null); drawProfile();
    history.replaceState(null, '', location.pathname + location.search);
    lastFocus?.focus?.();
  }
  document.addEventListener('keydown', e => {
    if (!drawerRoot.innerHTML) return;
    if (e.key === 'Escape') closeStory();
    if (e.key === 'Tab') { // keep focus inside the drawer
      const f = [...drawerRoot.querySelectorAll('button:not([disabled]),a[href],audio,video')];
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f.at(-1).focus(); }
      else if (!e.shiftKey && document.activeElement === f.at(-1)) { e.preventDefault(); f[0].focus(); }
    }
  });
  const m = location.hash.match(/^#story-(.+)$/);
  if (m) openStory(decodeURIComponent(m[1]));
}
