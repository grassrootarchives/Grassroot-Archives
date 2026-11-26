// Page blocks: the building pieces of every page. Used by the public site and the page editor preview.
import { esc, md, inline } from './ui.js';
import { siteUrl } from './config.js';

export const BLOCK_TYPES = {
  hero: { name: 'Hero photo', fields: ['eyebrow', 'title', 'body', 'image', 'primary_label', 'primary_href', 'secondary_label', 'secondary_href', 'strip', 'credit'] },
  heading: { name: 'Heading', fields: ['eyebrow', 'title', 'size'] },
  text: { name: 'Text', fields: ['body', 'bg'] },
  section: { name: 'Labelled section', fields: ['label', 'sublabel', 'body', 'bg'] },
  cards: { name: 'Cards', fields: ['title', 'items'] },
  phases: { name: 'Phases', fields: ['title', 'items'] },
  chips: { name: 'Tags', fields: ['title', 'items'] },
  quote: { name: 'Quote', fields: ['body', 'title', 'bg'] },
  image: { name: 'Photograph', fields: ['image', 'body'] },
  button: { name: 'Button', fields: ['title', 'href'] },
  valleys: { name: 'Valley cards', fields: ['title', 'body'] },
  contact: { name: 'Contact panel', fields: ['eyebrow', 'body', 'email', 'title'] },
  map: { name: 'Valley map', fields: [], template: 'valley_template' },
  stories: { name: 'Story table', fields: [], template: 'index_template' }
};

export const FIELD_LABELS = {
  eyebrow: 'Small label above', title: 'Heading', body: 'Text', image: 'Image (upload or URL)', primary_label: 'Main button label',
  primary_href: 'Main button link', secondary_label: 'Second button label', secondary_href: 'Second button link', strip: 'Bottom strip text',
  credit: 'Photo credit', size: 'Size', bg: 'Background', label: 'Section label', sublabel: 'Section sub-label', items: 'Items, one per line',
  href: 'Link', email: 'Email address'
};

// Fill {valley.name}-style placeholders in template pages.
export function fill(text, ctx) {
  return String(text ?? '').replace(/\{valley\.(name|region|intro)\}/g, (m, k) => ctx?.valley?.[k] ?? '');
}

const BG = { blue: 'bg-blue', green: 'bg-green', red: 'bg-red' };
const link = h => esc(/^https?:|^mailto:/i.test(h || '') ? h : siteUrl(h || 'index.html'));
const img = u => /^https?:|^data:image\//i.test(u || '') ? u : siteUrl(u || '');

// items are stored as strings; cards/phases use "Title | meta | text".
export function splitItem(s) { const [title, b, c] = String(s).split('|').map(x => x.trim()); return c != null ? { title, meta: b, body: c } : { title, body: b }; }

export function renderBlock(b, ctx = {}) {
  const f = k => fill(b[k], ctx);
  switch (b.type) {
    case 'hero': return `<section class="b-hero" data-block="${esc(b.id)}">
        ${b.image ? `<img class="bg" src="${esc(img(b.image))}" alt="${esc(b.alt || '')}">` : ''}<div class="scrim"></div>
        ${ctx.headerHtml || ''}
        <div class="inner">${b.eyebrow ? `<span class="eyebrow">${esc(f('eyebrow'))}</span>` : ''}
          <h1 class="display">${inline(f('title')).replace(/\n/g, '<br>')}</h1>${b.body ? `<p>${inline(f('body'))}</p>` : ''}
          <div class="actions">${b.primary_label ? `<a class="btn btn--primary" href="${link(b.primary_href)}">${esc(b.primary_label)}</a>` : ''}${b.secondary_label ? `<a class="btn btn--outline" href="${link(b.secondary_href)}">${esc(b.secondary_label)}</a>` : ''}</div>
        </div>
        ${(b.strip || b.credit) ? `<div class="strip"><span>${esc(f('strip'))}</span><span>${esc(b.credit || '')}</span></div>` : ''}
      </section>`;
    case 'heading': {
      const page = b.size === 'page';
      return `<div class="wrap b-heading${page ? ' b-heading--page' : ''}" data-block="${esc(b.id)}">${b.eyebrow ? `<span class="eyebrow">${esc(f('eyebrow'))}</span>` : ''}${page ? `<h1>${inline(f('title'))}</h1>` : `<h2>${inline(f('title'))}</h2>`}</div>`;
    }
    case 'text': return `<div class="wrap" data-block="${esc(b.id)}"><div class="b-text prose ${BG[b.bg] ? 'has-bg ' + BG[b.bg] : ''}">${md(f('body'))}</div></div>`;
    case 'section': return `<div class="wrap" data-block="${esc(b.id)}"><div class="b-section ${BG[b.bg] ? BG[b.bg] : ''}" ${BG[b.bg] ? 'style="padding:40px"' : ''}><div class="head"><strong>${esc(f('label'))}</strong>${b.sublabel ? `<span class="muted">${esc(f('sublabel'))}</span>` : ''}</div><div class="body prose">${md(f('body'))}</div></div></div>`;
    case 'cards': return `<div class="wrap" data-block="${esc(b.id)}">${b.title ? `<h2 class="display" style="font-size:32px;margin-bottom:20px">${inline(f('title'))}</h2>` : ''}<div class="cards">${(b.items || []).map(splitItem).map(it => `<article class="card"><h3>${esc(it.title)}</h3>${it.meta ? `<span class="meta">${esc(it.meta)}</span>` : ''}${it.body ? `<p>${inline(it.body)}</p>` : ''}</article>`).join('')}</div></div>`;
    case 'phases': return `<div class="wrap" data-block="${esc(b.id)}">${b.title ? `<h2 class="display" style="font-size:32px;margin-bottom:20px">${inline(f('title'))}</h2>` : ''}<ol class="phases">${(b.items || []).map(splitItem).map(it => `<li><span class="muted">${esc(it.meta || '')}</span><strong>${esc(it.title)}</strong><span class="muted">${inline(it.body || '')}</span></li>`).join('')}</ol></div>`;
    case 'chips': return `<div class="wrap" data-block="${esc(b.id)}" style="display:flex;flex-direction:column;gap:14px">${b.title ? `<span class="label">${esc(f('title'))}</span>` : ''}<div class="chips">${(b.items || []).map((t, i) => `<span class="tag" style="background:${i < 3 ? 'var(--panel)' : i < 5 ? 'var(--green-2)' : 'var(--red-2)'}">${esc(t)}</span>`).join('')}</div></div>`;
    case 'quote': return `<div class="wrap b-quote" data-block="${esc(b.id)}"><blockquote class="${BG[b.bg] || 'bg-blue'}">“${inline(f('body'))}”${b.title ? `<cite>— ${esc(f('title'))}</cite>` : ''}</blockquote></div>`;
    case 'image': return b.image ? `<div class="wrap b-image" data-block="${esc(b.id)}"><figure><img src="${esc(img(b.image))}" alt="${esc(b.alt || b.body || '')}" loading="lazy">${b.body ? `<figcaption>${inline(f('body'))}</figcaption>` : ''}</figure></div>` : '';
    case 'button': return `<div class="wrap" data-block="${esc(b.id)}"><a class="btn btn--primary" href="${link(b.href)}">${esc(f('title'))}</a></div>`;
    case 'valleys': return `<div class="wrap" data-block="${esc(b.id)}" style="display:flex;flex-direction:column;gap:16px">
        <div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:baseline;gap:12px">${b.title ? `<h2 class="display" style="font-size:32px">${inline(f('title'))}</h2>` : ''}${b.body ? `<span class="muted">${inline(f('body'))}</span>` : ''}</div>
        <div class="valley-cards" data-valley-cards>${(ctx.valleys || []).filter(v => v.status === 'published').map(v => `
          <a class="valley-card" href="${esc(siteUrl('valley.html?v=' + encodeURIComponent(v.slug)))}"><div class="thumb" data-thumb="${esc(v.slug)}"></div><span class="name">${esc(v.name)}</span><span class="meta">${esc(v.region || '')}${v.region ? ' · ' : ''}Open the map →</span></a>`).join('') || '<div class="empty">No valleys are published yet.</div>'}</div></div>`;
    case 'contact': return `<div class="wrap" data-block="${esc(b.id)}" id="contact"><div class="b-contact">${b.eyebrow ? `<span class="eyebrow">${esc(f('eyebrow'))}</span>` : ''}${b.body ? `<p>${inline(f('body'))}</p>` : ''}${b.email ? `<a class="btn btn--primary" style="align-self:flex-start" href="mailto:${esc(b.email)}">${esc(b.title || 'Write to us')}</a>` : ''}</div></div>`;
    case 'map': case 'stories': return ctx.slots?.[b.type] || '';
    default: return '';
  }
}

export function renderBlocks(blocks, ctx = {}) {
  return (blocks || []).map(b => renderBlock(b, ctx)).join('\n');
}
