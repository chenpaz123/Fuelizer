-- Fuelizer: Kia Picanto fuel tracking, telemetry, and billing schema
-- Core table: fuel_cycles — one row per fill-up ("cycle").

create extension if not exists "pgcrypto";

create table if not exists public.fuel_cycles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,

  -- Raw, user-entered telemetry ------------------------------------------------
  entry_date date not null,
  total_odometer_km numeric(10, 1) not null check (total_odometer_km >= 0),
  trip_distance_km numeric(8, 2) not null check (trip_distance_km >= 0),
  engine_time interval,
  computer_avg_consumption_kml numeric(6, 2) check (computer_avg_consumption_kml >= 0),
  pumped_liters numeric(6, 3) not null check (pumped_liters > 0),
  full_price_paid numeric(8, 2) not null check (full_price_paid >= 0),
  payment_method text not null check (payment_method in ('Pazomat', 'Credit Card')),

  -- Path into the "receipts" Storage bucket, e.g. "<user_id>/2026-06-05.jpg".
  receipt_image_path text,

  -- Derived telemetry (DB-generated, never written to directly) ---------------
  -- Pump Truth: actual km/l for this cycle.
  pump_truth_kml numeric(6, 2) generated always as (
    round(trip_distance_km / nullif(pumped_liters, 0), 2)
  ) stored,

  -- True Reserve: liters left in the tank right after this fill-up.
  -- 35 = Kia Picanto max tank capacity (liters). Keep this in sync with
  -- MAX_TANK_LITERS in the app if the vehicle ever changes.
  true_reserve_liters numeric(6, 3) generated always as (
    35 - pumped_liters
  ) stored,

  -- Net Cost: what's actually owed after the Pazomat discount.
  -- 0.58 = PAZOMAT_DISCOUNT_PER_LITER_ILS in lib/billing.ts — keep in sync.
  net_cost_ils numeric(8, 2) generated always as (
    case
      when payment_method = 'Pazomat' then round(full_price_paid - (0.58 * pumped_liters), 2)
      else full_price_paid
    end
  ) stored,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint fuel_cycles_trip_lte_odometer check (trip_distance_km <= total_odometer_km)
);

comment on table public.fuel_cycles is
  'One row per fill-up: manual telemetry entry plus derived pump/billing figures.';
comment on column public.fuel_cycles.pump_truth_kml is
  'Actual km/l for this cycle = trip_distance_km / pumped_liters.';
comment on column public.fuel_cycles.true_reserve_liters is
  'Estimated liters remaining in the tank right after this fill-up (35L tank - pumped_liters).';
comment on column public.fuel_cycles.net_cost_ils is
  'Amount actually billed: full_price_paid minus the 0.58 ILS/L Pazomat discount, or full_price_paid for Credit Card.';

create index if not exists fuel_cycles_user_id_entry_date_idx
  on public.fuel_cycles (user_id, entry_date desc);
create index if not exists fuel_cycles_payment_method_idx
  on public.fuel_cycles (payment_method);

-- Keep updated_at fresh on every UPDATE.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists fuel_cycles_set_updated_at on public.fuel_cycles;
create trigger fuel_cycles_set_updated_at
  before update on public.fuel_cycles
  for each row execute function public.set_updated_at();

-- Row Level Security: every user only ever sees their own fill-ups. ----------
alter table public.fuel_cycles enable row level security;

create policy "Users can view their own fuel cycles"
  on public.fuel_cycles for select
  using (auth.uid() = user_id);

create policy "Users can insert their own fuel cycles"
  on public.fuel_cycles for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own fuel cycles"
  on public.fuel_cycles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own fuel cycles"
  on public.fuel_cycles for delete
  using (auth.uid() = user_id);

-- Storage: private bucket for dashboard/receipt photos, one folder per user. -
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

create policy "Users can read their own receipts"
  on storage.objects for select
  using (bucket_id = 'receipts' and (storage.foldername(name)) [1] = auth.uid()::text);

create policy "Users can upload their own receipts"
  on storage.objects for insert
  with check (bucket_id = 'receipts' and (storage.foldername(name)) [1] = auth.uid()::text);

create policy "Users can delete their own receipts"
  on storage.objects for delete
  using (bucket_id = 'receipts' and (storage.foldername(name)) [1] = auth.uid()::text);

-- Reporting helper: which billing month each cycle's Pazomat fuel lands in.
-- (The live "Upcoming Bill" widget uses lib/billing.ts on the client/server;
-- this view is for ad-hoc SQL analysis and historical breakdowns.)
create or replace view public.v_billing_cycles as
select
  fc.*,
  (date_trunc('month', fc.entry_date) + interval '2 months')::date as bill_month
from public.fuel_cycles fc;
