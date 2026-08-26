// Fallback values used wherever a user might not have saved a /settings row
// yet: the settings form itself, app/lab/actions.ts's server-side
// net_cost_ils / true_reserve_liters snapshot calculation, and
// app/dashboard/page.tsx's Upcoming Bill calculation. This is now the one
// place these numbers are hardcoded — lib/billing.ts and fuel_cycles' old
// generated columns used to each hardcode their own copy; both now take the
// live (or, via this fallback, default) value as a parameter instead. See
// supabase/migrations/0006_decouple_calculations.sql.
export const DEFAULT_PAZOMAT_DISCOUNT_PER_LITER = 0.58;
export const DEFAULT_TANK_CAPACITY_LITERS = 35;
// Mirrors user_settings.pazomat_billing_delay_months' column default in
// supabase/migrations/0007_add_billing_delay.sql.
export const DEFAULT_PAZOMAT_BILLING_DELAY_MONTHS = 2;
