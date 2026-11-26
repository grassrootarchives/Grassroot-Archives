-- Version history: every insert, update and delete on content tables is stored as a revision.
create table if not exists public.revisions (
  id bigint generated always as identity primary key,
  table_name text not null check (table_name in ('pages', 'valleys', 'stories', 'site_settings')),
  row_key text not null,                 -- the row's id as text
  action text not null check (action in ('insert', 'update', 'delete')),
  data jsonb not null,                   -- the full row after the change (before it, for deletes)
  changed_by text,
  changed_at timestamptz not null default now()
);
create index if not exists revisions_row_idx on public.revisions (table_name, row_key, id desc);
create index if not exists revisions_time_idx on public.revisions (id desc);

alter table public.revisions enable row level security;
create policy revisions_read on public.revisions for select to authenticated using (private.is_admin());
-- No insert/update/delete policies: only the trigger below writes here.

create or replace function private.log_revision()
returns trigger language plpgsql security definer
set search_path = public
as $$
declare
  rec jsonb;
  key text;
begin
  if tg_op = 'DELETE' then rec := to_jsonb(old); else rec := to_jsonb(new); end if;
  -- Skip updates that change nothing but the timestamp.
  if tg_op = 'UPDATE' and (to_jsonb(new) - 'updated_at') = (to_jsonb(old) - 'updated_at') then return null; end if;
  key := rec ->> 'id';
  insert into public.revisions (table_name, row_key, action, data, changed_by)
  values (tg_table_name, key, lower(tg_op), rec, coalesce(auth.jwt() ->> 'email', 'system'));
  -- Keep the latest 100 versions of each row.
  delete from public.revisions r
  where r.table_name = tg_table_name and r.row_key = key
    and r.id < (select min(id) from (select id from public.revisions where table_name = tg_table_name and row_key = key order by id desc limit 100) t);
  return null;
end $$;
revoke all on function private.log_revision() from public, anon, authenticated;

create trigger pages_history after insert or update or delete on public.pages for each row execute function private.log_revision();
create trigger valleys_history after insert or update or delete on public.valleys for each row execute function private.log_revision();
create trigger stories_history after insert or update or delete on public.stories for each row execute function private.log_revision();
create trigger settings_history after insert or update or delete on public.site_settings for each row execute function private.log_revision();

-- Starting point: the current state of everything is version 1.
insert into public.revisions (table_name, row_key, action, data, changed_by)
select 'pages', id::text, 'insert', to_jsonb(p), 'initial' from public.pages p
union all select 'valleys', id::text, 'insert', to_jsonb(v), 'initial' from public.valleys v
union all select 'stories', id::text, 'insert', to_jsonb(s), 'initial' from public.stories s
union all select 'site_settings', id::text, 'insert', to_jsonb(x), 'initial' from public.site_settings x;
