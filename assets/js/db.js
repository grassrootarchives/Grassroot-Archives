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
  return check(await sb.from('valleys').select('*').eq('slug', slug).maybeSingle());
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
