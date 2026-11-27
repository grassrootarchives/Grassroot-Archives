-- Performance advisor: evaluate auth.jwt() once per query, not once per row.
drop policy if exists admins_delete on public.admins;
create policy admins_delete on public.admins for delete to authenticated
  using (private.is_admin() and email <> lower(coalesce((select auth.jwt()) ->> 'email', '')));
