// Pages & design: edit every page as a stack of blocks, add pages, set the site theme.
import { requireAdmin, layout, toast, errMsg, upload, slugify, safeName, param, shrinkPhoto, isShrinkablePhoto, PHOTO_SHRINK_ABOVE } from './common.js';
import { esc } from '../ui.js';
import { siteUrl } from '../config.js';
import { renderBlock, BLOCK_TYPES, FIELD_LABELS } from '../blocks.js';
import { hrefFor } from '../ui.js';

const app = document.getElementById('app');
const { sb, user } = await requireAdmin('pages');
const [{ data: pagesData }, { data: settings }, { data: valleys }] = await Promise.all([
  sb.from('pages').select('*').order('menu_order'), sb.from('site_settings').select('*').eq('id', 1).single(), sb.from('valleys').select('*').order('menu_order')
]);
let pages = pagesData || [];
let current = pages.find(p => p.slug === param('p')) || pages[0];
let blocks = [], sel = 0, dirty = false;
let theme = { palette: settings?.palette || 'pastel', font: settings?.font || 'plex' };
const PALETTES = { pastel: ['Pastel river', '#F5F8F6', '#BFD9EA', '#E3F1E7', '#FBE3E0'], vellum: ['Vellum survey', '#F7F6F2', '#1F2420', '#E4E8DD', '#F1E3D8'], slate: ['Slate blueprint', '#14181C', '#8FB8D8', '#1F3027', '#3A2626'] };
const FONTS = { plex: ['Newsreader', 'with IBM Plex Mono', "'Newsreader', Georgia, serif", "'IBM Plex Mono', monospace"], inter: ['Lora', 'with Inter', "'Lora', Georgia, serif", "'Inter', sans-serif"], grotesk: ['Source Serif', 'with Space Grotesk', "'Source Serif 4', Georgia, serif", "'Space Grotesk', sans-serif"] };
const KIND_LABEL = { home: 'Home', about: 'About', valley_template: 'Valley map page (all valleys)', index_template: 'The Archive (all valleys)' };
const REQUIRED = { valley_template: 'map', index_template: 'stories' };
const uid = () => 'b' + Math.random().toString(36).slice(2, 9);
const NEW = { hero: { title: 'New heading', body: 'Short introduction.', image: 'assets/img/hero.jpg' }, heading: { title: 'New section heading' }, text: { body: 'New paragraph. Edit it on the right.' }, section: { label: 'Section label', body: 'Text for this section.' }, cards: { title: '', items: ['Card one | | Short text.', 'Card two | | Short text.', 'Card three | | Short text.'] }, phases: { title: 'Phases', items: ['Step one | Phase I | What happens.', 'Step two | Phase II | What happens.'] }, chips: { title: 'Tags', items: ['Tag one', 'Tag two'] }, quote: { body: 'A quote from an interview.', title: 'Speaker', bg: 'green' }, image: { image: '', body: 'Caption' }, button: { title: 'Button label →', href: 'valley.html' }, valleys: { title: 'Explore a valley', body: '' }, contact: { eyebrow: 'Contact', body: 'Get in touch.', email: '', title: 'Write to us' } };

const main = layout(app, 'pages', user, `
  <div class="admin__head"><div><span class="eyebrow">Pages &amp; design</span><h1>Pages &amp; design</h1></div>
    <div class="row"><a class="btn btn--quiet" data-history>History</a><span class="muted" data-status></span><button type="button" class="btn btn--quiet" data-discard>Discard changes</button><button type="button" class="btn" data-draft>Save draft</button><button type="button" class="btn btn--publish" data-publish>Publish</button></div></div>
  <div class="tabs" role="tablist" aria-label="Pages" data-tabs></div>
  <div class="panel" data-newpage hidden></div>
  <div class="editor">
    <aside class="editor__lib" aria-label="Add a block"><strong style="letter-spacing:.12em">ADD A BLOCK</strong><span class="muted" style="font-size:12px">Adds below the selected block.</span><div data-lib style="display:flex;flex-direction:column;gap:6px"></div>
      <strong style="letter-spacing:.12em;margin-top:14px">ORDER</strong><span class="muted" style="font-size:12px">Drag to reorder.</span><ol class="outline" data-outline></ol></aside>
    <section class="editor__preview" aria-label="Preview"><div class="row" style="justify-content:space-between;margin-bottom:8px"><span class="muted">PREVIEW · click a block to edit it</span><a class="muted" data-viewlive target="_blank" rel="noopener">View live page ↗</a></div>
      <div class="preview-frame" data-preview></div></section>
    <aside class="editor__side">
      <div class="panel" data-pageset></div>
      <div class="panel" data-blockset></div>
      <div class="panel" data-theme></div>
    </aside>
  </div>`);
const $ = q => main.querySelector(q);
const status = (t, warn) => { $('[data-status]').innerHTML = warn ? `<span class="warn">${esc(t)}</span>` : esc(t); };
const markDirty = () => { dirty = true; status('Unsaved changes', true); };
window.addEventListener('beforeunload', e => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

function load(page) {
  current = page; blocks = structuredClone(page.draft_blocks || page.blocks || []); sel = Math.min(sel, Math.max(0, blocks.length - 1)); dirty = false;
  status(page.draft_blocks ? 'Draft not yet published' : page.status === 'draft' ? 'Page is a draft' : 'All changes published', !!page.draft_blocks);
  history.replaceState(null, '', '?p=' + page.slug); draw();
}
function draw() { tabs(); lib(); outline(); preview(); pageSettings(); blockSettings(); themePanel(); $('[data-viewlive]').href = hrefFor(current, valleys?.find(v => v.status === 'published')); $('[data-history]').href = siteUrl('admin/history.html?table=pages&key=' + current.id); }

function tabs() {
  $('[data-tabs]').innerHTML = pages.map(p => `<button type="button" role="tab" class="chip" aria-selected="${p.id === current.id}" aria-pressed="${p.id === current.id}" data-tab="${esc(p.id)}">${esc(KIND_LABEL[p.kind] || p.title)}${p.status === 'draft' ? ' · draft' : ''}</button>`).join('') + `<button type="button" class="chip" style="border-style:dashed;font-weight:600" data-newbtn>+ New page</button>`;
  main.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => { if (dirty && !confirm('Leave this page without saving your changes?')) return; load(pages.find(p => p.id === b.dataset.tab)); }));
  $('[data-newbtn]').addEventListener('click', newPageForm);
}
function lib() {
  const types = Object.entries(BLOCK_TYPES).filter(([k, t]) => !t.template);
  $('[data-lib]').innerHTML = types.map(([k, t]) => `<button type="button" data-add="${k}"><span style="color:var(--river);font-weight:600">+</span>${esc(t.name)}</button>`).join('');
  main.querySelectorAll('[data-add]').forEach(b => b.addEventListener('click', () => { const at = blocks.length ? sel + 1 : 0; blocks.splice(at, 0, { id: uid(), type: b.dataset.add, ...structuredClone(NEW[b.dataset.add] || {}) }); sel = at; markDirty(); draw(); }));
}
function outline() {
  const ol = $('[data-outline]');
  ol.innerHTML = blocks.map((b, i) => `<li draggable="true" data-i="${i}" class="${i === sel ? 'is-selected' : ''}"><span aria-hidden="true">⋮⋮</span><button type="button" style="all:unset;cursor:pointer;flex:1" data-pick="${i}">${esc(BLOCK_TYPES[b.type]?.name || b.type)}</button></li>`).join('');
  let from = null;
  ol.querySelectorAll('li').forEach(li => {
    li.addEventListener('dragstart', e => { from = Number(li.dataset.i); e.dataTransfer.effectAllowed = 'move'; });
    li.addEventListener('dragover', e => { e.preventDefault(); li.classList.add('drag-over'); });
    li.addEventListener('dragleave', () => li.classList.remove('drag-over'));
    li.addEventListener('drop', e => { e.preventDefault(); const to = Number(li.dataset.i); if (from == null || from === to) return; const [b] = blocks.splice(from, 1); blocks.splice(to, 0, b); sel = to; markDirty(); draw(); });
  });
  ol.querySelectorAll('[data-pick]').forEach(b => b.addEventListener('click', () => { sel = Number(b.dataset.pick); draw(); }));
}
function preview() {
  const fr = $('[data-preview]');
  fr.dataset.palette = theme.palette; fr.dataset.font = theme.font;
  const ctx = { valleys, valley: { name: '[Valley name]', region: '[Region]', intro: '[Valley introduction, written when the basin is created.]' }, slots: { map: '<div class="slot">Valley map, filters, legend and profile<br><span style="font-size:12px">Filled with each valley\'s own map</span></div>', stories: '<div class="slot">Story table for the valley</div>' } };
  fr.innerHTML = `<div class="blocks">${blocks.map((b, i) => `<div class="pblock${i === sel ? ' is-selected' : ''}" data-i="${i}"><span class="pblock__tag">⋮⋮ ${esc(BLOCK_TYPES[b.type]?.name || b.type)}</span>${renderBlock(b, ctx) || `<div class="slot">${esc(BLOCK_TYPES[b.type]?.name)}: empty</div>`}</div>`).join('') || '<div class="slot">This page is empty. Add a block from the left.</div>'}</div>`;
  fr.querySelectorAll('a').forEach(a => a.addEventListener('click', e => e.preventDefault()));
  fr.querySelectorAll('.pblock').forEach(el => el.addEventListener('click', () => { sel = Number(el.dataset.i); outline(); blockSettings(); fr.querySelectorAll('.pblock').forEach(x => x.classList.toggle('is-selected', x === el)); }));
}
function pageSettings() {
  const p = current, custom = p.kind === 'custom';
  const order = pages.slice().sort((a, b) => a.menu_order - b.menu_order), idx = order.findIndex(x => x.id === p.id);
  $('[data-pageset]').innerHTML = `<h2>Page settings</h2>
    ${custom ? `<label class="field"><span>Page name</span><input data-ptitle value="${esc(p.title)}"></label>
      <label class="field"><span>Address</span><input data-pslug value="${esc(p.slug)}"><span class="hint">page.html?p=${esc(p.slug)}</span></label>` : `<div class="facts"><dt>Address</dt><dd>${esc(hrefFor(p).replace(siteUrl(''), '/'))}</dd></div>`}
    <label class="check"><input type="checkbox" data-pmenu ${p.show_in_menu ? 'checked' : ''}> Show in site menu</label>
    <div class="row"><button type="button" class="btn btn--small btn--quiet" data-morder="-1" ${idx <= 0 ? 'disabled' : ''}>← Earlier in menu</button><button type="button" class="btn btn--small btn--quiet" data-morder="1" ${idx >= order.length - 1 ? 'disabled' : ''}>Later in menu →</button></div>
    ${custom ? `<button type="button" class="btn btn--small btn--danger" data-pdel>Delete this page</button>` : `<span class="muted" style="font-size:12px">Built-in pages can be edited and hidden from the menu, but not deleted.${REQUIRED[p.kind] ? ' The template applies to every valley.' : ''}</span>`}`;
  const save = async (patch, msg) => { const { data, error } = await sb.from('pages').update(patch).eq('id', p.id).select().single(); if (error) return toast(errMsg(error), true); Object.assign(p, data); tabs(); toast(msg); };
  $('[data-pmenu]').addEventListener('change', e => save({ show_in_menu: e.target.checked }, e.target.checked ? 'Shown in the menu.' : 'Hidden from the menu.'));
  $('[data-ptitle]')?.addEventListener('change', e => save({ title: e.target.value.trim() || p.title }, 'Page renamed.'));
  $('[data-pslug]')?.addEventListener('change', e => { const s = slugify(e.target.value); if (s) save({ slug: s }, 'Address changed.'); });
  main.querySelectorAll('[data-morder]').forEach(b => b.addEventListener('click', async () => {
    const other = order[idx + Number(b.dataset.morder)]; if (!other) return;
    const a = p.menu_order, c = other.menu_order === a ? a + Number(b.dataset.morder) : other.menu_order;
    const r1 = await sb.from('pages').update({ menu_order: c }).eq('id', p.id), r2 = await sb.from('pages').update({ menu_order: a }).eq('id', other.id);
    if (r1.error || r2.error) return toast(errMsg(r1.error || r2.error), true);
    p.menu_order = c; other.menu_order = a; pages.sort((x, y) => x.menu_order - y.menu_order); draw(); toast('Menu order changed.');
  }));
  $('[data-pdel]')?.addEventListener('click', async () => {
    if (!confirm(`Delete the page “${p.title}”? You can bring it back from History if needed.`)) return;
    const { error } = await sb.from('pages').delete().eq('id', p.id); if (error) return toast(errMsg(error), true);
    pages = pages.filter(x => x.id !== p.id); dirty = false; load(pages[0]); toast('Page deleted.');
  });
}
function blockSettings() {
  const el = $('[data-blockset]'), b = blocks[sel];
  if (!b) { el.innerHTML = '<h2>Selected block</h2><span class="muted">No block selected.</span>'; return; }
  const t = BLOCK_TYPES[b.type] || { fields: [] }, required = REQUIRED[current.kind] === b.type;
  const field = f => {
    const v = b[f];
    if (f === 'bg') return `<label class="field"><span>${FIELD_LABELS[f]}</span><select data-f="bg">${[['', 'None'], ['blue', 'Pale blue'], ['green', 'Pale green'], ['red', 'Pale red']].map(([k, l]) => `<option value="${k}" ${(v || '') === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>`;
    if (f === 'size') return `<label class="field"><span>${FIELD_LABELS[f]}</span><select data-f="size"><option value="">Section heading</option><option value="page" ${v === 'page' ? 'selected' : ''}>Page title</option></select></label>`;
    if (f === 'items') return `<label class="field"><span>${FIELD_LABELS[f]}</span><textarea data-f="items" rows="6">${esc((v || []).join('\n'))}</textarea>${['cards', 'phases'].includes(b.type) ? '<span class="hint">Write “Title | small label | text” on each line.</span>' : ''}</label>`;
    if (f === 'image') return `<label class="field"><span>${FIELD_LABELS[f]}</span><input data-f="image" value="${esc(v || '')}"></label><label class="btn btn--small btn--quiet" style="position:relative;align-self:flex-start">Upload image<input type="file" accept="image/*" data-img style="position:absolute;inset:0;opacity:0;cursor:pointer"></label>
      <label class="field"><span>Image description (for screen readers)</span><input data-f="alt" value="${esc(b.alt || '')}"></label>`;
    const long = ['body'].includes(f) || (f === 'title' && b.type === 'hero');
    return `<label class="field"><span>${FIELD_LABELS[f] || f}</span>${long ? `<textarea data-f="${f}" rows="${f === 'body' ? 5 : 2}">${esc(v || '')}</textarea>` : `<input data-f="${f}" value="${esc(v || '')}">`}</label>`;
  };
  el.innerHTML = `<h2>Selected · ${esc(t.name || b.type)}</h2>
    <div class="row" style="flex-wrap:nowrap"><button type="button" class="btn btn--small btn--quiet" data-mv="-1" aria-label="Move block up" ${sel === 0 ? 'disabled' : ''}>↑</button><button type="button" class="btn btn--small btn--quiet" data-mv="1" aria-label="Move block down" ${sel === blocks.length - 1 ? 'disabled' : ''}>↓</button>
      <button type="button" class="btn btn--small btn--quiet" data-dup aria-label="Duplicate block" ${required ? 'disabled' : ''}>⧉</button><button type="button" class="btn btn--small btn--danger" data-rm aria-label="Delete block" ${required ? 'disabled' : ''}>✕</button></div>
    ${required ? '<span class="muted" style="font-size:12px">This block holds the page’s working part and cannot be removed.</span>' : ''}
    ${t.fields.map(field).join('')}${['heading', 'text', 'section', 'hero'].includes(b.type) && REQUIRED[current.kind] ? '<span class="hint">Use {valley.name}, {valley.region} or {valley.intro} to show each valley’s own details.</span>' : ''}`;
  el.querySelectorAll('[data-f]').forEach(inp => inp.addEventListener('input', () => {
    const k = inp.dataset.f; b[k] = k === 'items' ? inp.value.split('\n').map(x => x.trim()).filter(Boolean) : inp.value; markDirty(); preview();
  }));
  el.querySelector('[data-img]')?.addEventListener('change', async e => {
    const f = e.target.files[0]; if (!f) return;
    if (f.size > 50 * 1024 * 1024) { toast(`${f.name} is larger than the 50 MB upload limit. Export a smaller JPG.`, true); e.target.value = ''; return; }
    try { toast('Uploading image…'); let up = f; if (f.size > PHOTO_SHRINK_ABOVE && isShrinkablePhoto(f.type, f.name)) { const small = await shrinkPhoto(f); if (small) up = new File([small], f.name.replace(/\.[a-z0-9]+$/i, '') + '.jpg', { type: 'image/jpeg' }); } b.image = await upload('media', `pages/${Date.now().toString(36)}-${safeName(up.name)}`, up); markDirty(); blockSettings(); preview(); toast('Image uploaded.'); } catch (err) { toast(errMsg(err), true); }
  });
  el.querySelectorAll('[data-mv]').forEach(x => x.addEventListener('click', () => { const to = sel + Number(x.dataset.mv); [blocks[sel], blocks[to]] = [blocks[to], blocks[sel]]; sel = to; markDirty(); draw(); }));
  el.querySelector('[data-dup]').addEventListener('click', () => { blocks.splice(sel + 1, 0, { ...structuredClone(b), id: uid() }); sel++; markDirty(); draw(); });
  el.querySelector('[data-rm]').addEventListener('click', () => { blocks.splice(sel, 1); sel = Math.max(0, sel - 1); markDirty(); draw(); });
}
function themePanel() {
  $('[data-theme]').innerHTML = `<h2>Site theme · all pages</h2><span>Colours</span>
    ${Object.entries(PALETTES).map(([k, [l, ...c]]) => `<button type="button" class="choice" data-pal="${k}" aria-pressed="${theme.palette === k}"><span class="swatch">${c.map(x => `<span style="background:${x}"></span>`).join('')}</span>${l}</button>`).join('')}
    <span>Fonts</span>
    ${Object.entries(FONTS).map(([k, [l, sub, disp, ui]]) => `<button type="button" class="choice" data-font="${k}" aria-pressed="${theme.font === k}" style="flex-direction:column;align-items:flex-start;min-height:52px;justify-content:center"><span style="font-family:${disp};font-size:17px">${l}</span><span style="font-family:${ui};font-size:11px" class="muted">${sub}</span></button>`).join('')}
    <button type="button" class="btn btn--primary" data-savetheme ${theme.palette === settings.palette && theme.font === settings.font ? 'disabled' : ''}>Apply theme to the site</button>`;
  main.querySelectorAll('[data-pal]').forEach(b => b.addEventListener('click', () => { theme.palette = b.dataset.pal; themePanel(); preview(); }));
  main.querySelectorAll('[data-font]').forEach(b => b.addEventListener('click', () => { theme.font = b.dataset.font; themePanel(); preview(); }));
  $('[data-savetheme]').addEventListener('click', async () => {
    const { error } = await sb.from('site_settings').update(theme).eq('id', 1);
    if (error) return toast(errMsg(error), true);
    Object.assign(settings, theme); themePanel(); toast('Theme applied to the whole site.');
  });
}
function newPageForm() {
  const box = $('[data-newpage]'); box.hidden = false;
  box.innerHTML = `<h2>New page</h2><div class="row"><label class="field"><span>Page name</span><input data-nname placeholder="e.g. Field notes"></label>
    <div class="field"><span>Address</span><span class="input" data-nslug style="display:flex;align-items:center;color:var(--muted)">page.html?p=…</span></div></div>
    <div class="field"><span>Start from</span><div class="tabs">${[['blank', 'Blank page'], ['text', 'Text & photos'], ['home', 'Copy of Home'], ['about', 'Copy of About']].map(([k, l], i) => `<button type="button" class="chip" data-start="${k}" aria-pressed="${i === 0}">${l}</button>`).join('')}</div></div>
    <label class="check"><input type="checkbox" checked data-nmenu> Add this page to the site menu</label>
    <div class="row"><button type="button" class="btn btn--primary" data-create>Create page</button><button type="button" class="btn btn--quiet" data-cancel>Cancel</button></div>`;
  let start = 'blank';
  box.querySelector('[data-nname]').addEventListener('input', e => box.querySelector('[data-nslug]').textContent = 'page.html?p=' + (slugify(e.target.value) || '…'));
  box.querySelectorAll('[data-start]').forEach(b => b.addEventListener('click', () => { start = b.dataset.start; box.querySelectorAll('[data-start]').forEach(x => x.setAttribute('aria-pressed', x === b)); }));
  box.querySelector('[data-cancel]').addEventListener('click', () => { box.hidden = true; });
  box.querySelector('[data-create]').addEventListener('click', async () => {
    const title = box.querySelector('[data-nname]').value.trim(), slug = slugify(title);
    if (!title || !slug) return toast('Give the page a name.', true);
    const src = pages.find(p => p.kind === start);
    const startBlocks = start === 'blank' ? [{ id: uid(), type: 'heading', size: 'page', title }] : start === 'text' ? [{ id: uid(), type: 'heading', size: 'page', title }, { id: uid(), type: 'text', body: 'Write the introduction here.' }, { id: uid(), type: 'image', image: '', body: 'Caption' }, { id: uid(), type: 'text', body: 'More text.' }] : structuredClone(src?.blocks || []).map(b => ({ ...b, id: uid() }));
    const { data, error } = await sb.from('pages').insert({ title, slug, kind: 'custom', blocks: startBlocks, show_in_menu: box.querySelector('[data-nmenu]').checked, menu_order: Math.max(0, ...pages.map(p => p.menu_order)) + 1, status: 'draft' }).select().single();
    if (error) return toast(error.message.includes('pages_slug_key') ? 'A page with that address already exists.' : errMsg(error), true);
    pages.push(data); box.hidden = true; sel = 0; load(data); toast('Page created as a draft. Publish it when it is ready.');
  });
  box.querySelector('[data-nname]').focus();
}

$('[data-discard]').addEventListener('click', async () => {
  if (!confirm('Discard all unpublished changes to this page?')) return;
  const { data, error } = await sb.from('pages').update({ draft_blocks: null }).eq('id', current.id).select().single();
  if (error) return toast(errMsg(error), true);
  Object.assign(current, data); load(current); toast('Changes discarded.');
});
$('[data-draft]').addEventListener('click', async () => {
  const { data, error } = await sb.from('pages').update({ draft_blocks: blocks }).eq('id', current.id).select().single();
  if (error) return toast(errMsg(error), true);
  Object.assign(current, data); dirty = false; status('Draft saved, not yet published', true); toast('Draft saved.');
});
$('[data-publish]').addEventListener('click', async () => {
  if (REQUIRED[current.kind] && !blocks.some(b => b.type === REQUIRED[current.kind])) return toast('This template needs its map/table block.', true);
  const { data, error } = await sb.from('pages').update({ blocks, draft_blocks: null, status: 'published' }).eq('id', current.id).select().single();
  if (error) return toast(errMsg(error), true);
  Object.assign(current, data); dirty = false; status('All changes published'); tabs(); toast('Published.');
});

load(current);
