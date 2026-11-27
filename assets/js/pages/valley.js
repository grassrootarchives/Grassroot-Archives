// Valley map page: map, filters, telemetry, layers, legend, profile and the story drawer.
import { boot, shell, setMeta, drawThumbs } from './common.js';
import { getValley, getStories, getPageBy, loadValleyData, dataUrl, storyCounts } from '../db.js';
import { renderBlocks } from '../blocks.js';
import { esc, md, errorBox } from '../ui.js';
import { siteUrl } from '../config.js';
import { createMap } from '../map/map.js';
import { STYLES } from '../map/symbols.js';
import { mountLegend } from '../map/legend.js';
import { levelOf, strategiesOf, hasResilience } from '../resilience.js';
import { HAZARDS, linkLabel } from '../hazards.js';
import { chainWheel, levelKey } from '../chainwheel.js';
import { createRealMap } from '../map/realmap.js';
import { formatDMS, zoneFor } from '../geo/geom.js';

const THEMES = ['Water Governance', 'Agrarian Change', 'Oral History', 'Ecology'];
const app = document.getElementById('app');
const pad = n => n == null ? '' : String(n).padStart(2, '0');
const fmtKm = v => v == null ? '—' : Number(v).toFixed(1);
const fmtM = v => v == null ? '—' : Math.round(v) + 'm';

try {
  const site = await boot();
  const published = site.valleys.filter(v => v.status === 'published');
  const slug = new URLSearchParams(location.search).get('v');
  const valley = slug ? await getValley(slug) : null;
  if (!slug) await renderValleyList(site, published);
  else if (!valley) {
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
      <div class="viewswitch" role="group" aria-label="Map view">
        <button type="button" data-view="art" aria-pressed="true">Illustrated map</button>
        <button type="button" data-view="real" aria-pressed="false">Real-world map</button>
      </div>
      <div class="mapbox">
        <span class="mapbox__tag" data-tag>${esc(STYLES[style].name.toUpperCase())}${style === 'contour' ? ` · ${valley.contour_interval} m INTERVAL` : ''}</span>
        <div class="mapbox__corner">
          <div class="row"><span class="mapbox__north" aria-label="North is up">N ↑</span>
          <button type="button" class="mapbox__legendbtn" aria-expanded="true" data-legend-toggle>LEGEND ▾</button></div>
          <div class="basebar" data-basebar hidden>
            <div class="basebar__row" role="group" aria-label="Background">${[['satellite', 'Satellite'], ['streets', 'Streets'], ['plain', 'Plain']].map(([k, l], i) => `<button type="button" data-base="${k}" aria-pressed="${i === 0}">${l}</button>`).join('')}</div>
            <label class="check"><input type="checkbox" data-relief checked> Relief shading</label>
            <label class="check"><input type="checkbox" data-3d> 3D terrain</label>
          </div>
          <div class="mapbox__legend" data-legend></div>
        </div>
        <div data-map></div>
        <div class="realbox" data-real hidden></div>
        ${(valley.source_credit || valley.layers_credit) ? `<div class="mapbox__credit" data-credit>MAP DATA: ${esc(valley.source_credit || '')}${valley.layers_credit ? ' · ' + esc(valley.layers_credit) : ''}</div>` : ''}
        <div class="mapbox__zoom" data-zoombar><button type="button" aria-label="Zoom in" data-zoom="in">+</button><button type="button" aria-label="Zoom out" data-zoom="out">−</button><button type="button" aria-label="Reset view" data-zoom="reset" style="font-size:14px">⟲</button></div>
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
      const c = state.cursor, snap = view.snap(c.lon, c.lat);
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
    [map, real].forEach(m => m?.setDim(dim)); drawProfile();
  }));
  // Legend with on/off switches.
  let view = map, real = null;
  const legendEl = app.querySelector('[data-legend]');
  mountLegend(legendEl, { map, style, data, interval: valley.contour_interval || 20 });
  // Illustrated ↔ real-world switch.
  const artEl = app.querySelector('[data-map]'), realEl = app.querySelector('[data-real]'), tagEl = app.querySelector('[data-tag]');
  const artTag = tagEl.textContent;
  const baseLabel = { satellite: 'SATELLITE', streets: 'STREETS', plain: 'PLAIN' };
  async function setView(v) {
    app.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-pressed', b.dataset.view === v));
    const url = new URL(location.href); v === 'real' ? url.searchParams.set('view', 'real') : url.searchParams.delete('view'); history.replaceState(null, '', url);
    if (v === 'real') {
      realEl.style.height = Math.max(420, artEl.offsetHeight || 0) + 'px';
      artEl.hidden = true; realEl.hidden = false;
      app.querySelector('[data-basebar]').hidden = false;
      app.querySelector('[data-zoombar]').hidden = true;
      const cr = app.querySelector('[data-credit]'); if (cr) cr.hidden = true;
      if (!real) {
        realEl.innerHTML = '<div class="empty" style="height:100%;display:grid;place-items:center">Loading the real-world map…</div>';
        try {
          real = await createRealMap(realEl, { ...data, interval: valley.contour_interval || 20, stories, credit: [valley.source_credit, valley.layers_credit].filter(Boolean).join(' · '),
            onPinClick: s => openStory(s.id), onPinHover: s => { state.hover = s; telemetry(); }, onCursor: c => { state.cursor = c; if (!state.hover) telemetry(); } });
          real.setDim(stories.filter(s => !matches(s)).map(s => s.id)); real.setActive(state.open);
        } catch (err) { realEl.innerHTML = `<div class="empty" style="height:100%;display:grid;place-items:center">${esc(err.message)}</div>`; return; }
      } else real.resize();
      view = real;
      tagEl.textContent = 'REAL-WORLD MAP · ' + baseLabel[real.state.base];
      mountLegend(legendEl, { map: real, style: 'contour', data, interval: valley.contour_interval || 20 });
    } else {
      realEl.hidden = true; artEl.hidden = false;
      app.querySelector('[data-basebar]').hidden = true;
      app.querySelector('[data-zoombar]').hidden = false;
      const cr = app.querySelector('[data-credit]'); if (cr) cr.hidden = false;
      view = map; tagEl.textContent = artTag;
      mountLegend(legendEl, { map, style, data, interval: valley.contour_interval || 20 });
    }
  }
  app.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));
  app.querySelectorAll('[data-base]').forEach(b => b.addEventListener('click', () => {
    if (!real) return; real.setBase(b.dataset.base);
    app.querySelectorAll('[data-base]').forEach(x => x.setAttribute('aria-pressed', x === b));
    tagEl.textContent = 'REAL-WORLD MAP · ' + baseLabel[b.dataset.base];
  }));
  app.querySelector('[data-relief]').addEventListener('change', e => real?.setRelief(e.target.checked));
  app.querySelector('[data-3d]').addEventListener('change', e => real?.set3D(e.target.checked));
  if (new URLSearchParams(location.search).get('view') === 'real') setView('real');
  // Legend & zoom.
  const lt = app.querySelector('[data-legend-toggle]'), lg = app.querySelector('[data-legend]');
  lt.addEventListener('click', () => { lg.hidden = !lg.hidden; lt.setAttribute('aria-expanded', !lg.hidden); lt.textContent = lg.hidden ? 'LEGEND ▸' : 'LEGEND ▾'; });
  if (window.matchMedia('(max-width: 720px)').matches) lt.click();
  app.querySelectorAll('[data-zoom]').forEach(b => b.addEventListener('click', () => ({ in: () => map.zoomIn(), out: () => map.zoomOut(), reset: () => map.reset() })[b.dataset.zoom]()));

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
    state.open = id; map.setActive(id); real?.setActive(id); drawProfile();
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
        ${hasResilience(s.resilience) ? resilienceHTML(s.resilience) : ''}
      </div>
    </article>`;
    drawerRoot.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', closeStory));
    drawerRoot.querySelectorAll('[data-step]').forEach(b => b.addEventListener('click', () => { const n = list[i + Number(b.dataset.step)]; if (n) openStory(n.id); }));
    drawerRoot.querySelector('.drawer__bar button').focus();
  }
  function closeStory() {
    drawerRoot.innerHTML = ''; state.open = null; map.setActive(null); real?.setActive(null); drawProfile();
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

// Resilience strategies in the story drawer: a chain wheel per hazard that strategies respond to, then the numbered list.
function resilienceHTML(r) {
  const st = strategiesOf(r).filter(x => x.text?.trim() || x.when?.trim()).map((x, i) => ({ ...x, n: i + 1 }));
  const hz = Object.keys(HAZARDS).filter(k => st.some(x => x.hazard === k));
  return `<section class="resil" aria-label="Resilience strategies"><span class="label" style="display:block;padding-bottom:8px;border-bottom:1px solid var(--line);margin-bottom:4px">Resilience strategies</span>
    ${hz.length ? `<div class="resil__wheels">${hz.map(k => `<figure class="resil__wheel">${chainWheel(k, st)}<figcaption>${esc(HAZARDS[k].name)}: which step of the chain each strategy responds to</figcaption></figure>`).join('')}</div>` : ''}
    ${levelKey()}
    <ol class="resil__list">${st.map(x => { const L = levelOf(x.level); return `<li class="resil__item" style="--lvl:${L.color}">
      <div class="resil__head"><span class="sbadge" style="background:${L.color}">${x.n}</span><strong>${esc(L.name)}</strong>${x.when ? `<span class="resil__when">${esc(x.when)}</span>` : ''}</div>
      ${x.hazard && x.link ? `<div class="resil__link">Responds to: ${esc(linkLabel(x.hazard, x.link))}</div>` : ''}
      ${x.text ? `<div class="prose">${md(x.text)}</div>` : ''}</li>`; }).join('')}</ol></section>`;
}

// River valleys: the page reached from the menu and the home page, listing every published valley.
async function renderValleyList(site, valleys) {
  const counts = await storyCounts().catch(() => ({}));
  const STYLE_NAME = { contour: 'Contour survey', watercolor: 'Watercolour', miniature: 'Miniature painting' };
  setMeta(`River valleys · ${site.settings?.site_name || 'Grassroot Archives'}`, 'Every river valley in the archive: open its map, or browse its stories.');
  shell(app, site, { current: 'valley_template', main: `
    <div class="wrap valleys-page">
      <div class="valleys-page__head">
        <span class="eyebrow">River valleys</span>
        <h1 class="display">Choose a river valley</h1>
        <p class="lede">Each valley has its own map, built from its contour map, with its stories pinned along the river. ${valleys.length === 1 ? 'One valley is published so far; more join as their fieldwork begins.' : valleys.length ? `${valleys.length} valleys are published so far.` : ''}</p>
      </div>
      ${valleys.length ? `<div class="valley-list">${valleys.map(v => { const n = counts[v.id] || 0; const map = siteUrl('valley.html?v=' + encodeURIComponent(v.slug)); return `
        <article class="valley-item">
          <a class="valley-item__thumb" href="${esc(map)}" tabindex="-1" aria-hidden="true"><div class="thumb" data-thumb="${esc(v.slug)}"></div></a>
          <div class="valley-item__body">
            <h2 class="display"><a href="${esc(map)}">${esc(v.name)}</a></h2>
            ${v.region ? `<span class="muted">${esc(v.region)}</span>` : ''}
            ${v.intro ? `<p>${esc(v.intro.length > 220 ? v.intro.slice(0, 217).replace(/\s+\S*$/, '') + '…' : v.intro)}</p>` : ''}
            <dl class="valley-item__facts"><div><dt>Stories</dt><dd>${n}</dd></div><div><dt>Map style</dt><dd>${esc(STYLE_NAME[v.map_style] || 'Contour survey')}</dd></div></dl>
            <div class="row" style="gap:10px;flex-wrap:wrap">
              <a class="btn btn--primary" href="${esc(map)}">Open the map →</a>
              <a class="btn" href="${esc(siteUrl('river-index.html?v=' + encodeURIComponent(v.slug)))}">Its stories in The Archive</a>
            </div>
          </div>
        </article>`; }).join('')}</div>` : '<div class="empty">No valleys are published yet. They appear here once they are published from the admin.</div>'}
    </div>` });
  drawThumbs(app, valleys);
}
