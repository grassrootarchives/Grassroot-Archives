// Home, About and custom pages: all drawn from blocks stored in the database.
import { boot, shell, drawThumbs, setMeta } from './common.js';
import { getPageBy } from '../db.js';
import { renderBlocks } from '../blocks.js';
import { wireParams } from '../params.js';
import { header, wireHeader, errorBox, esc } from '../ui.js';

const app = document.getElementById('app');
const kind = document.body.dataset.kind; // home | about | custom
try {
  const site = await boot();
  const slug = new URLSearchParams(location.search).get('p');
  const page = kind === 'custom' ? await getPageBy('slug', slug || '') : await getPageBy('kind', kind);
  if (!page) {
    shell(app, site, { current: kind, main: `<div class="wrap" style="padding:96px 32px"><h1 class="display" style="font-size:44px">Page not found</h1><p class="muted">This page does not exist or is not published.</p></div>` });
  } else {
    const blocks = page.blocks || [];
    const heroFirst = blocks[0]?.type === 'hero';
    const current = page.kind === 'custom' ? page.slug : page.kind;
    const headerHtml = heroFirst ? header({ pages: site.pages, valleys: site.valleys, current, settings: site.settings, over: true }) : '';
    shell(app, site, { current, over: heroFirst, main: `<div class="blocks">${renderBlocks(blocks, { valleys: site.valleys, headerHtml })}</div>` });
    drawThumbs(app, site.valleys);
    wireParams(app);
    setMeta(page.kind === 'home' ? site.settings.site_name : `${page.title} · ${site.settings.site_name}`);
  }
} catch (err) { app.innerHTML = errorBox(err); }
