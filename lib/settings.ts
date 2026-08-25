// Fallback values shown on /settings before a user has ever saved a row —
// mirror the DB column defaults in supabase/migrations/0004_user_settings.sql
// (which themselves mirror the pre-existing hardcoded constants in
// lib/billing.ts and the fuel_cycles.true_reserve_liters generated column).
export const DEFAULT_PAZOMAT_DISCOUNT_PER_LITER = 0.58;
export const DEFAULT_TANK_CAPACITY_LITERS = 35;
