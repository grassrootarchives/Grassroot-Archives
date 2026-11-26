-- Move helper functions out of the public API schema.
create schema if not exists private;
grant usage on schema private to anon, authenticated;
alter function public.is_admin() set schema private;
grant execute on function private.is_admin() to anon, authenticated;
alter function public.set_updated_at() set schema private;
