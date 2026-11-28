-- The site menu, edited in Pages & design. Each item: { label, page (page slug) | href (link), show }.
-- Null means "build the menu from the pages' Show in site menu setting", as before.
alter table public.site_settings add column if not exists menu jsonb;
