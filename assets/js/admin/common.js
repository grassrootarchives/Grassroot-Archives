// Admin shell: auth guard, sidebar, toasts, storage uploads.
import { supabase, getSettings } from '../db.js';
import { applyTheme, esc } from '../ui.js';
import { siteUrl, SITE_VERSION, COPYRIGHT_HOLDER } from '../config.js';

export const NAV = [
  ['basins', 'River basins', 'admin/index.html'],
  ['stories', 'Stories', 'admin/stories.html'],
  ['media', 'Media library', 'admin/media.html'],
  ['pages', 'Pages & design', 'admin/pages.html'],
  ['history', 'History', 'admin/history.html'],
  ['settings', 'Settings', 'admin/settings.html']
];

export async function isAdminUser(sb, email) {
  const { data, error } = await sb.from('admins').select('email').eq('email', String(email || '').toLowerCase()).maybeSingle();
  return !error && !!data;
}

// Ensures a logged-in admin; otherwise sends the visitor to the login page.
export async function requireAdmin(current) {
  const sb = await supabase();
  const { data: { session } } = await sb.auth.getSession();
  const back = encodeURIComponent(location.pathname.split('/').pop() + location.search);
  if (!session) { location.replace(siteUrl('admin/login.html?next=' + back)); return new Promise(() => {}); }
  if (!(await isAdminUser(sb, session.user.email))) {
    await sb.auth.signOut();
    location.replace(siteUrl('admin/login.html?denied=1')); return new Promise(() => {});
  }
  sb.auth.onAuthStateChange(ev => { if (ev === 'SIGNED_OUT') location.replace(siteUrl('admin/login.html?out=1')); });
  getSettings().then(applyTheme).catch(() => {});
  return { sb, user: session.user };
}

export function layout(app, current, user, main) {
  app.innerHTML = `<a class="skip" href="#main">Skip to content</a><div class="admin">
    <nav class="admin__nav" aria-label="Admin">
      <a class="brand" href="${esc(siteUrl('index.html'))}" title="Go to the public home page">Grassroot Archives</a><span class="sub">ADMIN · CMS</span>
      ${NAV.map(([k, l, h]) => `<a href="${esc(siteUrl(h))}"${k === current ? ' aria-current="page"' : ''}>${esc(l)}</a>`).join('')}
      <a href="${esc(siteUrl('index.html'))}" target="_blank" rel="noopener">↗ View site</a>
      <div class="me"><span class="label">LOGGED IN AS</span><span style="overflow-wrap:anywhere">${esc(user.email)}</span>
        <button type="button" class="btn btn--small" data-logout>Log out</button>
        <span class="muted" style="font-size:11px;padding-top:6px">© ${new Date().getFullYear()} ${esc(COPYRIGHT_HOLDER)} · v${esc(SITE_VERSION)}</span></div>
    </nav>
    <main class="admin__main" id="main">${main}</main></div>`;
  app.querySelector('[data-logout]').addEventListener('click', async () => { const sb = await supabase(); await sb.auth.signOut(); location.replace(siteUrl('admin/login.html?out=1')); });
  return app.querySelector('main');
}

let toastTimer = null;
export function toast(msg, isError = false) {
  let t = document.querySelector('.toast');
  if (!t) { t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); document.body.append(t); }
  t.textContent = msg; t.classList.toggle('is-error', isError); t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, isError ? 8000 : 3500);
}

export function errMsg(e) { return e?.message || e?.error_description || String(e); }

// Upload a Blob/File to a public bucket; returns its public URL (with a version stamp to beat caches).
export async function upload(bucket, path, body, contentType) {
  const sb = await supabase();
  const { error } = await sb.storage.from(bucket).upload(path, body, { upsert: true, contentType: contentType || body.type || 'application/octet-stream', cacheControl: '300' });
  if (error) throw error;
  const { data } = sb.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl + '?v=' + Date.now().toString(36);
}
export const uploadJSON = (bucket, path, obj) => upload(bucket, path, new Blob([JSON.stringify(obj)], { type: 'application/json' }), 'application/json');

export function slugify(s) { return String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60); }
export function safeName(name) { const m = String(name).match(/^(.*?)(\.[a-z0-9]{1,6})?$/i); return (slugify(m[1]) || 'file') + (m[2] || '').toLowerCase(); }

export function param(k) { return new URLSearchParams(location.search).get(k); }

// ---------- photo shrinking ----------
// Photos straight from a phone are 4–12 MB. On screen they never need more than about 2000 px,
// which as a JPEG at quality 0.82 is usually 0.3–0.8 MB. Location data is dropped from the copy;
// the story keeps its own latitude and longitude.
export const PHOTO_MAX_PX = 2000, PHOTO_QUALITY = 0.82, PHOTO_SHRINK_ABOVE = 1024 * 1024;
export const isShrinkablePhoto = (type, name = '') => /^image\/(jpeg|png|webp)$/i.test(type || '') || /\.(jpe?g|png|webp)$/i.test(name);
// Returns a smaller JPEG Blob, or null if the photo can't be read here or wouldn't get smaller.
export async function shrinkPhoto(blob) {
  let bmp;
  try { bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' }); } catch { return null; }
  const k = Math.min(1, PHOTO_MAX_PX / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * k)), h = Math.max(1, Math.round(bmp.height * k));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); ctx.drawImage(bmp, 0, 0, w, h); bmp.close?.();
  const out = await new Promise(r => c.toBlob(r, 'image/jpeg', PHOTO_QUALITY));
  return out && out.size < blob.size * 0.9 ? out : null;
}
export const mb = n => (n / 1048576).toFixed(n < 10 * 1048576 ? 1 : 0) + ' MB';
