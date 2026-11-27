// Public Supabase settings. The anon key is designed to be public: row-level security
// in the database decides what anyone can read or write.
export const SUPABASE_URL = 'https://cyjqdomgzkdabmjrzeio.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN5anFkb21nemtkYWJtanJ6ZWlvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQzOTU2MzYsImV4cCI6MjEwOTk3MTYzNn0.kgYwIFkcTfVYndPS9PvGNAR4ibaxtym9YSaWeTGUY6E';

// Root of the site (works on a custom domain and on username.github.io/repo/).
// Site release shown in every footer. Bump when a new version goes live.
export const SITE_VERSION = '1.0';
export const SITE_RELEASED = '27 Nov 2026';
export const COPYRIGHT_HOLDER = 'Rutuja Kulkarni';
export const CONTACT_EMAIL = 'grassrootarchives@gmail.com';

export const SITE_ROOT = new URL('../../', import.meta.url);
export const siteUrl = path => new URL(path, SITE_ROOT).href;

// Third-party libraries, loaded from a CDN only where they are needed.
export const CDN = {
  // globalThis.__GA_SUPABASE__ lets local tests swap in a stand-in module; it is never set on the live site.
  supabase: globalThis.__GA_SUPABASE__ || 'https://esm.sh/@supabase/supabase-js@2.49.4',
  geotiff: 'https://esm.sh/geotiff@2.1.3',
  proj4: 'https://esm.sh/proj4@2.15.0',
  shpjs: 'https://esm.sh/shpjs@6.1.0',
  togeojson: 'https://esm.sh/@tmcw/togeojson@5.8.1'
};
