import { getSettings, getMenuPages, listValleys, loadValleyData } from '../db.js';
import { applyTheme, header, footer, wireHeader, esc } from '../ui.js';
import { createMap } from '../map/map.js';

export async function boot() {
  const [settings, pages, valleys] = await Promise.all([getSettings(), getMenuPages(), listValleys()]);
  applyTheme(settings);
  return { settings, pages, valleys };
}

export function shell(app, site, { current, valley = null, over = false, main = '' }) {
  const head = header({ pages: site.pages, valleys: site.valleys, current, valley, settings: site.settings, over });
  app.innerHTML = `${over ? '' : head}<main id="main">${main}</main>${footer(site.settings, site.pages)}`;
  wireHeader(app);
  return head;
}

// Small static maps on valley cards, drawn in each valley's own style.
export function drawThumbs(root, valleys) {
  const io = 'IntersectionObserver' in window ? new IntersectionObserver(entries => entries.forEach(e => { if (e.isIntersecting) { io.unobserve(e.target); draw(e.target); } }), { rootMargin: '200px' }) : null;
  async function draw(el) {
    const v = valleys.find(x => x.slug === el.dataset.thumb); if (!v?.data?.grid) return;
    try {
      const d = await loadValleyData(v);
      const m = createMap(el, { ...d, style: v.map_style, interval: (v.contour_interval || 20) * 2, layers: { settlements: false, infra: false, pins: false }, label: `Map of ${v.name}` });
      el.querySelector('.gmap__frame').style.pointerEvents = 'none';
      return m;
    } catch (err) { el.innerHTML = `<span class="sr-only">${esc(v.name)}</span>`; }
  }
  root.querySelectorAll('[data-thumb]').forEach(el => io ? io.observe(el) : draw(el));
}

export function setMeta(title, description) {
  document.title = title;
  if (description) { let m = document.querySelector('meta[name="description"]'); if (m) m.content = description; }
}
