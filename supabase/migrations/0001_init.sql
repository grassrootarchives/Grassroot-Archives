-- Grassroot Archives: core schema
-- Valleys (river basins), stories, pages (block-based), site settings, admins.

create extension if not exists pgcrypto;

-- ---------- admins ----------
create table if not exists public.admins (
  email text primary key check (email = lower(email)),
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admins a
    where a.email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

create or replace function public.set_updated_at()
returns trigger language plpgsql
set search_path = public
as $$ begin new.updated_at = now(); return new; end $$;

-- ---------- valleys ----------
create table if not exists public.valleys (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null,
  region text,
  intro text,
  status text not null default 'draft' check (status in ('draft', 'published')),
  map_style text not null default 'contour' check (map_style in ('contour', 'watercolor', 'miniature')),
  contour_interval integer not null default 20 check (contour_interval > 0),
  source_credit text,
  layers_credit text,
  crs text,
  bounds jsonb,               -- [west, south, east, north] in WGS 84 degrees
  data jsonb not null default '{}'::jsonb,   -- URLs: contours, bands, river, boundary, settlements, infra, grid
  profile jsonb,              -- [[km, elevation_m], ...] along the river
  river_length_km numeric,
  zones jsonb not null default '[{"name":"Headwaters","from":0,"to":0.19},{"name":"Mid-Valley","from":0.19,"to":0.62},{"name":"Floodplain","from":0.62,"to":0.88},{"name":"Command Area","from":0.88,"to":1}]'::jsonb,
  show_in_menu boolean not null default true,
  menu_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger valleys_updated before update on public.valleys for each row execute function public.set_updated_at();

-- ---------- stories ----------
create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  valley_id uuid not null references public.valleys(id) on delete cascade,
  number integer,
  place text not null,
  interviewee text,
  age integer check (age is null or age between 0 and 130),
  role text,
  quote text,
  transcript text,
  theme text check (theme is null or theme in ('Water Governance', 'Agrarian Change', 'Oral History', 'Ecology')),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  elevation numeric,
  river_km numeric,
  zone text,
  sub_basin text,
  media jsonb not null default '[]'::jsonb,   -- [{type: video|audio|photo|document, url, caption}]
  consent boolean not null default false,
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint publish_needs_consent check (status <> 'published' or consent)
);
create index if not exists stories_valley_idx on public.stories (valley_id, river_km);
create trigger stories_updated before update on public.stories for each row execute function public.set_updated_at();

-- ---------- pages ----------
create table if not exists public.pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null,
  kind text not null default 'custom' check (kind in ('home', 'about', 'valley_template', 'index_template', 'custom')),
  blocks jsonb not null default '[]'::jsonb,
  draft_blocks jsonb,
  show_in_menu boolean not null default true,
  menu_order integer not null default 100,
  status text not null default 'published' check (status in ('draft', 'published')),
  updated_at timestamptz not null default now()
);
create trigger pages_updated before update on public.pages for each row execute function public.set_updated_at();

-- ---------- site settings ----------
create table if not exists public.site_settings (
  id integer primary key default 1 check (id = 1),
  site_name text not null default 'Grassroot Archives',
  palette text not null default 'pastel' check (palette in ('pastel', 'vellum', 'slate')),
  font text not null default 'plex' check (font in ('plex', 'inter', 'grotesk')),
  draft jsonb,
  contact_email text,
  photo_credit text,
  updated_at timestamptz not null default now()
);
create trigger settings_updated before update on public.site_settings for each row execute function public.set_updated_at();

-- ---------- row-level security ----------
alter table public.admins enable row level security;
alter table public.valleys enable row level security;
alter table public.stories enable row level security;
alter table public.pages enable row level security;
alter table public.site_settings enable row level security;

create policy admins_read on public.admins for select to authenticated using (public.is_admin());
create policy admins_write on public.admins for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy valleys_read on public.valleys for select using (status = 'published' or public.is_admin());
create policy valleys_insert on public.valleys for insert to authenticated with check (public.is_admin());
create policy valleys_update on public.valleys for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy valleys_delete on public.valleys for delete to authenticated using (public.is_admin());

create policy stories_read on public.stories for select using (
  public.is_admin() or (
    status = 'published' and exists (select 1 from public.valleys v where v.id = valley_id and v.status = 'published')
  )
);
create policy stories_insert on public.stories for insert to authenticated with check (public.is_admin());
create policy stories_update on public.stories for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy stories_delete on public.stories for delete to authenticated using (public.is_admin());

create policy pages_read on public.pages for select using (status = 'published' or public.is_admin());
create policy pages_insert on public.pages for insert to authenticated with check (public.is_admin() and kind = 'custom');
create policy pages_update on public.pages for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy pages_delete on public.pages for delete to authenticated using (public.is_admin() and kind = 'custom');

create policy settings_read on public.site_settings for select using (true);
create policy settings_update on public.site_settings for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- storage ----------
insert into storage.buckets (id, name, public) values ('maps', 'maps', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('media', 'media', true) on conflict (id) do nothing;

create policy storage_admin_insert on storage.objects for insert to authenticated
  with check (bucket_id in ('maps', 'media') and public.is_admin());
create policy storage_admin_update on storage.objects for update to authenticated
  using (bucket_id in ('maps', 'media') and public.is_admin());
create policy storage_admin_delete on storage.objects for delete to authenticated
  using (bucket_id in ('maps', 'media') and public.is_admin());

-- ---------- seed ----------
insert into public.admins (email) values ('grassrootarchives@gmail.com') on conflict do nothing;
insert into public.site_settings (id) values (1) on conflict do nothing;
