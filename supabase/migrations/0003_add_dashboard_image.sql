-- The Lab route's scanner captures two photos per fill-up (receipt +
-- dashboard/trip-computer), but only receipt_image_path existed to record
-- where either of them landed in the "receipts" Storage bucket — the
-- dashboard photo was uploaded but orphaned, with no row referencing it.
-- This adds its sibling column.
alter table public.fuel_cycles
  add column if not exists dashboard_image_path text;

comment on column public.fuel_cycles.dashboard_image_path is
  'Path into the "receipts" Storage bucket for the dashboard/trip-computer photo, e.g. "<user_id>/dashboard-<timestamp>-<uuid>.jpg". Sibling to receipt_image_path.';
