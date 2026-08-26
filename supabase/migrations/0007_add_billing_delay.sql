-- Lets a user configure their own Pazomat billing lag (lib/billing.ts's
-- BILLING_DELAY_MONTHS was a hardcoded constant shared by everyone) instead
-- of assuming every Pazomat account bills exactly 2 months later. Credit
-- Card stays hardcoded at 0 lag -- it's an intrinsic property of how that
-- payment method settles, not a per-user preference like Pazomat's actual
-- billing-cycle length is.
alter table public.user_settings
  add column if not exists pazomat_billing_delay_months integer
    not null default 2
    check (pazomat_billing_delay_months >= 0);

comment on column public.user_settings.pazomat_billing_delay_months is
  'How many months after a Pazomat fill-up it appears on the "Upcoming Bill" widget (lib/billing.ts''s calculateUpcomingBill). Defaults to 2. Credit Card has no equivalent column -- it is always billed with 0 lag.';
