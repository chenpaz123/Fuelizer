-- Per-user preferences: Pazomat discount rate and tank capacity, editable
-- from /settings. One row per user, upserted on save.
create table if not exists public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  pazomat_discount_per_liter numeric(5, 2) not null default 0.58,
  tank_capacity_liters numeric(5, 2) not null default 35.0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.user_settings is
  'Per-user Pazomat discount and tank capacity preferences, editable from /settings.';
comment on column public.user_settings.pazomat_discount_per_liter is
  'Mirrors the default in lib/billing.ts (PAZOMAT_DISCOUNT_PER_LITER_ILS). Not yet read by that calculation - see README follow-up.';
comment on column public.user_settings.tank_capacity_liters is
  'Mirrors the 35L hardcoded into fuel_cycles.true_reserve_liters. Not yet read by that generated column - see README follow-up.';

-- Reuse the same updated_at trigger function fuel_cycles uses (defined in
-- 0001, hardened with a pinned search_path in 0002).
drop trigger if exists user_settings_set_updated_at on public.user_settings;
create trigger user_settings_set_updated_at
  before update on public.user_settings
  for each row execute function public.set_updated_at();

alter table public.user_settings enable row level security;

create policy "Users can view their own settings"
  on public.user_settings for select
  using (auth.uid() = user_id);

create policy "Users can insert their own settings"
  on public.user_settings for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own settings"
  on public.user_settings for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
