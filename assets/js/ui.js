// Shared UI: escaping, a small Markdown subset, theme, header and footer.
import { siteUrl } from './config.js';

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function safeHref(u) {
  const s = String(u || '').trim();
  if (/^(https?:|mailto:|tel:|#|\/|\.{0,2}\/?[a-z0-9_-]+(\.html)?([?#].*)?$)/i.test(s) && !/^javascript:/i.test(s)) return s;
  return '#';
}

// Inline formatting: **bold**, *italic*, [text](url). Text is escaped first.
export function inline(text) {
  return esc(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*(?!\s)(.+?)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, t, u) => `<a href="${esc(safeHref(u.replace(/&amp;/g, '&')))}">${t}</a>`);
}
// Paragraphs separated by blank lines; single newlines become <br>.
// Paragraphs split on blank lines; lines starting with "- ", "* " or "• " become bullet points.
export function md(text) {
  const bullet = /^\s*[-*•]\s+/;
  return String(text ?? '').trim().split(/\n\s*\n/).filter(Boolean).map(block => {
    const out = []; let para = [], list = [];
    const flushP = () => { if (para.length) out.push(`<p>${para.map(inline).join('<br>')}</p>`); para = []; };
    const flushL = () => { if (list.length) out.push(`<ul>${list.map(l => `<li>${inline(l)}</li>`).join('')}</ul>`); list = []; };
    for (const line of block.split('\n')) {
      if (bullet.test(line)) { flushP(); list.push(line.replace(bullet, '')); }
      else if (list.length && /^\s{2,}\S/.test(line)) list[list.length - 1] += ' ' + line.trim();
      else { flushL(); para.push(line); }
    }
    flushP(); flushL(); return out.join('');
  }).join('');
}

export function applyTheme(settings) {
  const root = document.documentElement;
  root.dataset.palette = settings?.palette || 'pastel';
  root.dataset.font = settings?.font || 'plex';
}

export function hrefFor(page, firstValley) {
  switch (page.kind) {
    case 'home': return siteUrl('index.html');
    case 'about': return siteUrl('about.html');
    case 'valley_template': return siteUrl('valley.html' + (firstValley ? '?v=' + encodeURIComponent(firstValley.slug) : ''));
    case 'index_template': return siteUrl('river-index.html' + (firstValley ? '?v=' + encodeURIComponent(firstValley.slug) : ''));
    default: return siteUrl('page.html?p=' + encodeURIComponent(page.slug));
  }
}

export function header({ pages, valleys, current, over = false, valley = null, settings }) {
  const published = (valleys || []).filter(v => v.status === 'published');
  const first = valley || published[0] || null;
  const items = (pages || []).filter(p => p.show_in_menu && p.status === 'published');
  const nav = items.map(p => {
    const label = p.kind === 'valley_template' ? 'Valley map' : p.kind === 'index_template' ? 'River index' : p.title;
    return `<a href="${esc(hrefFor(p, first))}"${p.kind === current || p.slug === current ? ' aria-current="page"' : ''}>${esc(label)}</a>`;
  }).join('');
  const switcher = valley ? `
    <div class="valley-switch">
      <button type="button" aria-expanded="false" aria-haspopup="true" data-valley-toggle><span class="muted">Valley</span><strong>${esc(valley.name)}</strong>
        <svg width="10" height="6" viewBox="0 0 10 6" aria-hidden="true"><path d="M1 1l4 4 4-4" stroke="currentColor" stroke-width="1.4" fill="none"/></svg></button>
      <div class="valley-menu" hidden>
        <span class="label">River valleys · ${published.length} published</span>
        ${published.filter(v => v.show_in_menu).map(v => `<a href="${esc(siteUrl((current === 'index_template' ? 'river-index.html' : 'valley.html') + '?v=' + encodeURIComponent(v.slug)))}"><span${v.slug === valley.slug ? ' style="font-weight:600"' : ''}>${esc(v.name)}</span><span class="muted">${esc(v.region || '')}</span></a>`).join('')}
      </div>
    </div>` : '';
  return `<a class="skip" href="#main">Skip to content</a>
  <header class="site-header${over ? ' site-header--over' : ''}">
    <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">
      <a class="wordmark" href="${esc(siteUrl('index.html'))}">${esc(settings?.site_name || 'Grassroot Archives')}</a>${switcher}
    </div>
    <button class="nav-toggle" type="button" aria-label="Menu" aria-expanded="false" data-nav-toggle>
      <svg width="20" height="14" viewBox="0 0 20 14" aria-hidden="true"><path d="M0 1h20M0 7h20M0 13h20" stroke="currentColor" stroke-width="1.5"/></svg></button>
    <nav class="site-nav" aria-label="Main">${nav}</nav>
  </header>`;
}

export function footer(settings, pages) {
  const custom = (pages || []).filter(p => p.kind === 'custom' && p.status === 'published' && !p.show_in_menu);
  return `<footer class="site-footer">
    <span style="font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:var(--ink)">${esc(settings?.site_name || 'Grassroot Archives')}</span>
    <nav aria-label="Footer">
      <a href="${esc(siteUrl('about.html'))}">About</a>
      ${custom.map(p => `<a href="${esc(siteUrl('page.html?p=' + encodeURIComponent(p.slug)))}">${esc(p.title)}</a>`).join('')}
      ${settings?.contact_email ? `<a href="mailto:${esc(settings.contact_email)}">Contact</a>` : ''}
      <a href="${esc(siteUrl('admin/login.html'))}">Admin</a>
    </nav>
  </footer>`;
}

export function wireHeader(root = document) {
  const t = root.querySelector('[data-nav-toggle]'), nav = root.querySelector('.site-nav');
  t?.addEventListener('click', () => { const open = nav.classList.toggle('is-open'); t.setAttribute('aria-expanded', open); });
  const vt = root.querySelector('[data-valley-toggle]'), vm = root.querySelector('.valley-menu');
  vt?.addEventListener('click', e => { e.stopPropagation(); vm.hidden = !vm.hidden; vt.setAttribute('aria-expanded', !vm.hidden); });
  document.addEventListener('click', e => { if (vm && !vm.hidden && !vm.contains(e.target)) { vm.hidden = true; vt.setAttribute('aria-expanded', 'false'); } });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && vm && !vm.hidden) { vm.hidden = true; vt.focus(); } });
}

export function errorBox(err) {
  console.error(err);
  return `<div class="wrap" style="padding:64px 32px"><div class="empty">Something went wrong loading this page. ${esc(err?.message || '')}</div></div>`;
}
