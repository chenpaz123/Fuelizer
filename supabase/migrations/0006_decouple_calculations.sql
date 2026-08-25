-- net_cost_ils and true_reserve_liters were Postgres GENERATED columns
-- hardcoded to one discount rate (0.58 ILS/L) and one tank capacity (35L)
-- for every user, regardless of their user_settings row. Both become
-- plain, nullable columns here; app/lab/actions.ts now computes and
-- snapshots them at insert time from that user's actual settings as of the
-- fill-up, so later edits to user_settings never retroactively change a
-- historical row.
--
-- Dropping a generated column discards its stored values, so every
-- existing row is back-filled first using the exact formula it was
-- originally generated with. Every row logged so far predates
-- user_settings existing at all, so 0.58/35L is the historically correct
-- value for them, not a guess standing in for the real one.
--
-- v_billing_cycles (0001_init_schema.sql) selects fc.* from fuel_cycles, so
-- it depends on every column including these two -- drop and recreate it
-- around the change, re-applying the security_invoker hardening from
-- 0002_harden_security.sql in the same statement so there's no window
-- where the recreated view is left un-hardened.
drop view if exists public.v_billing_cycles;

alter table public.fuel_cycles
  drop column net_cost_ils,
  drop column true_reserve_liters;

alter table public.fuel_cycles
  add column net_cost_ils numeric(10, 2),
  add column true_reserve_liters numeric(10, 2);

update public.fuel_cycles
set
  net_cost_ils = case
    when payment_method = 'Pazomat' then round(full_price_paid - (0.58 * pumped_liters), 2)
    else full_price_paid
  end,
  true_reserve_liters = round(35 - pumped_liters, 2);

comment on column public.fuel_cycles.net_cost_ils is
  'Amount actually billed, computed and snapshotted at insert time in app/lab/actions.ts from user_settings.pazomat_discount_per_liter. No longer DB-generated -- editing user_settings later does not retroactively change past rows.';
comment on column public.fuel_cycles.true_reserve_liters is
  'Estimated liters remaining in the tank after this fill-up, computed and snapshotted at insert time in app/lab/actions.ts from user_settings.tank_capacity_liters. No longer DB-generated.';

create view public.v_billing_cycles
  with (security_invoker = true)
as
select
  fc.*,
  (date_trunc('month', fc.entry_date) + interval '2 months')::date as bill_month
from public.fuel_cycles fc;
