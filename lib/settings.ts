// Fallback values used before a user has ever saved a /settings row — both
// on the settings form itself and in app/lab/actions.ts's server-side
// net_cost_ils / true_reserve_liters snapshot calculation. Mirror the DB
// column defaults in supabase/migrations/0004_user_settings.sql (which
// themselves mirror the constants these fields replaced: lib/billing.ts's
// PAZOMAT_DISCOUNT_PER_LITER_ILS and fuel_cycles' old generated columns,
// see supabase/migrations/0006_decouple_calculations.sql).
export const DEFAULT_PAZOMAT_DISCOUNT_PER_LITER = 0.58;
export const DEFAULT_TANK_CAPACITY_LITERS = 35;
