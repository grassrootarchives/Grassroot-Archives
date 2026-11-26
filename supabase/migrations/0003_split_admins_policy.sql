-- One policy per action on admins; admins cannot remove themselves.
drop policy if exists admins_write on public.admins;
create policy admins_insert on public.admins for insert to authenticated with check (private.is_admin());
create policy admins_update on public.admins for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy admins_delete on public.admins for delete to authenticated using (private.is_admin() and email <> lower(coalesce(auth.jwt() ->> 'email', '')));
