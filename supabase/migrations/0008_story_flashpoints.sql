-- Flashpoints: free text describing events that have happened, or could happen, in the context of a story.
alter table public.stories add column if not exists flashpoints text;
comment on column public.stories.flashpoints is 'Flashpoints that have happened or could happen in the context of this story (free text, bullets allowed).';
