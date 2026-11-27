-- Resilience strategies at three spatial levels, each with its own time period.
-- Shape: {"home": {"when": "...", "text": "..."}, "neighbourhood": {...}, "region": {...}}
alter table public.stories add column if not exists resilience jsonb not null default '{}'::jsonb;
