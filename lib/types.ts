export type PaymentMethod = "Pazomat" | "Credit Card";

/**
 * Row shape of `public.fuel_cycles`. Mirrors supabase/migrations/ (0001 plus
 * the 0002-0006 follow-ups).
 *
 * `pump_truth_kml` is still a DB-generated column — never write to it
 * directly. `true_reserve_liters` and `net_cost_ils` are NOT (since
 * 0006_decouple_calculations.sql): they're plain nullable columns that
 * app/lab/actions.ts computes and snapshots at insert time from that
 * user's user_settings as of the fill-up, so nothing else should set them.
 */
// NOTE: these are `type` aliases rather than `interface`s on purpose — the
// Database type below is threaded through @supabase/supabase-js's generics,
// and interfaces (unlike type literals) don't reliably satisfy its
// conditional-type constraints, silently degrading `.insert()`/`.update()`
// argument types to `never`.
export type FuelCycle = {
  id: string;
  user_id: string;
  entry_date: string; // date, "YYYY-MM-DD"
  total_odometer_km: number;
  trip_distance_km: number;
  engine_time: string | null; // Postgres interval, e.g. "01:23" (HH:MM)
  computer_avg_consumption_kml: number | null;
  pumped_liters: number;
  full_price_paid: number;
  payment_method: PaymentMethod;
  receipt_image_path: string | null;
  dashboard_image_path: string | null;
  estimated_range: number | null; // km; user-editable estimate, not DB-generated
  pump_truth_kml: number | null;
  true_reserve_liters: number | null;
  net_cost_ils: number | null;
  created_at: string;
  updated_at: string;
};

export type FuelCycleInsert = Pick<
  FuelCycle,
  | "entry_date"
  | "total_odometer_km"
  | "trip_distance_km"
  | "pumped_liters"
  | "full_price_paid"
  | "payment_method"
> &
  Partial<
    Pick<
      FuelCycle,
      // user_id defaults to auth.uid() in the DB — only pass it explicitly
      // if you need to (e.g. an admin/service-role insert on someone's behalf).
      | "user_id"
      | "engine_time"
      | "computer_avg_consumption_kml"
      | "receipt_image_path"
      | "dashboard_image_path"
      | "estimated_range"
      // Set only by app/lab/actions.ts, computed server-side from
      // user_settings — never trust these if they ever came from a client.
      | "true_reserve_liters"
      | "net_cost_ils"
    >
  >;

/**
 * Row shape of `public.user_settings`. Mirrors
 * supabase/migrations/0004_user_settings.sql. One row per user, upserted
 * from /settings — see lib/settings.ts for the fallback defaults used
 * before a user has ever saved one.
 */
export type UserSettings = {
  user_id: string;
  pazomat_discount_per_liter: number;
  tank_capacity_liters: number;
  created_at: string;
  updated_at: string;
};

// The settings form always submits both fields together (there's no partial
// save), and user_id is filled in server-side from the session — so this is
// exactly what app/settings/actions.ts's upsert needs, no Partial<> needed.
export type UserSettingsInsert = Pick<
  UserSettings,
  "user_id" | "pazomat_discount_per_liter" | "tank_capacity_liters"
>;

export type UserSettingsInput = Pick<
  UserSettings,
  "pazomat_discount_per_liter" | "tank_capacity_liters"
>;

// Minimal Database type for @supabase/ssr generics.
// Regenerate with `supabase gen types typescript` once the project is linked.
export type Database = {
  public: {
    Tables: {
      fuel_cycles: {
        Row: FuelCycle;
        Insert: FuelCycleInsert;
        Update: Partial<FuelCycleInsert>;
        Relationships: [];
      };
      user_settings: {
        Row: UserSettings;
        Insert: UserSettingsInsert;
        Update: Partial<UserSettingsInsert>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
