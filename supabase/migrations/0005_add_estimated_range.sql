-- Estimated full-tank driving range in km, entered on the Lab review card.
-- The scanner auto-calculates an initial value from the car computer's
-- average consumption (round(tank_capacity_liters * computer_avg_consumption_kml))
-- when that figure was extracted, and the user can freely override it — so
-- this is a plain user-editable column, not DB-generated.
alter table public.fuel_cycles
  add column if not exists estimated_range integer check (estimated_range >= 0);

comment on column public.fuel_cycles.estimated_range is
  'Estimated full-tank driving range in km. Defaults to round(35 * computer_avg_consumption_kml) in the Lab scanner UI when available, freely editable before saving.';
