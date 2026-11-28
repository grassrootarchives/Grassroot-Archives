// Data access for the public site and the admin.
import { SUPABASE_URL, SUPABASE_ANON_KEY, CDN, siteUrl } from './config.js';

let clientPromise = null;
export function supabase() {
  if (!clientPromise) {
    clientPromise = import(CDN.supabase).then(({ createClient }) =>
      createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }));
  }
  return clientPromise;
}

function check({ data, error }) { if (error) throw error; return data; }

export async function getSettings() {
  const sb = await supabase();
  return check(await sb.from('site_settings').select('*').eq('id', 1).maybeSingle()) || { palette: 'pastel', font: 'plex', site_name: 'Grassroot Archives' };
}

export async function getMenuPages() {
  const sb = await supabase();
  return check(await sb.from('pages').select('slug,title,kind,show_in_menu,menu_order,status').order('menu_order'));
}

export async function getPageBy(field, value) {
  const sb = await supabase();
  return check(await sb.from('pages').select('*').eq(field, value).maybeSingle());
}

export async function listValleys() {
  const sb = await supabase();
  return check(await sb.from('valleys').select('id,slug,name,region,intro,status,map_style,show_in_menu,menu_order,bounds,data,contour_interval').order('menu_order').order('name'));
}

export async function getValley(slug) {
  const sb = await supabase();
  const v = check(await sb.from('valleys').select('*').eq('slug', slug).maybeSingle());
  // An address made from a pasted link ("grassrootarchives-org-valley-html-v-mahadei") still finds "mahadei",
  // and the address bar is tidied to the short form.
  const short = !v && /-v-([a-z0-9-]+)$/.exec(slug || '')?.[1];
  if (!short) return v;
  const w = check(await sb.from('valleys').select('*').eq('slug', short).maybeSingle());
  if (w) { const u = new URL(location.href); u.searchParams.set('v', w.slug); history.replaceState(null, '', u); }
  return w;
}

export async function getStories(valleyId) {
  const sb = await supabase();
  return check(await sb.from('stories').select('*').eq('valley_id', valleyId).order('river_km', { ascending: true, nullsFirst: false }).order('number'));
}

// Data files may be absolute URLs (Supabase Storage) or paths inside this site (the demo valley).
export function dataUrl(u) { return /^https?:/i.test(u) ? u : siteUrl(u); }

const jsonCache = new Map();
export function fetchJSON(u) {
  if (!u) return Promise.resolve(null);
  const url = dataUrl(u);
  if (!jsonCache.has(url)) jsonCache.set(url, fetch(url).then(r => { if (!r.ok) throw new Error(`Could not load ${url} (${r.status})`); return r.json(); }));
  return jsonCache.get(url);
}

// Everything the map needs for one valley.
export async function loadValleyData(valley) {
  const d = valley.data || {};
  const [grid, river, boundary, settlements, infra] = await Promise.all([
    fetchJSON(d.grid), fetchJSON(d.river), fetchJSON(d.boundary).catch(() => null),
    fetchJSON(d.settlements).catch(() => null), fetchJSON(d.infra).catch(() => null)
  ]);
  return { grid, river, boundary, settlements, infra };
}

// Published stories per valley: { valley_id: count }
export async function storyCounts() {
  const sb = await supabase();
  const rows = check(await sb.from('stories').select('valley_id').eq('status', 'published'));
  return (rows || []).reduce((m, r) => (m[r.valley_id] = (m[r.valley_id] || 0) + 1, m), {});
}
