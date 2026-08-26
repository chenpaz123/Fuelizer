-- "Regular Mode": lets a user without a Pazomat/fleet card hide all
-- Pazomat-specific UI and billing logic instead of it being assumed
-- universal. Defaults to true so every existing user's current behavior
-- (Pazomat discount, billing-delay field, the "Pazomat" payment option,
-- the 2-cycle Upcoming Bill split) is completely unaffected until they
-- explicitly opt out from /settings.
alter table public.user_settings
  add column if not exists has_pazomat boolean not null default true;

comment on column public.user_settings.has_pazomat is
  'Master toggle for "Regular Mode": when false, the app hides Pazomat-specific fields/options (components/settings/settings-form.tsx, components/lab/receipt-scanner.tsx) and lib/billing.ts''s calculateUpcomingBill treats every transaction as immediate (no 2-month Pazomat lag), matching a user who only pays by Credit Card/cash.';
