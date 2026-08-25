export type PaymentMethod = "Pazomat" | "Credit Card";

/**
 * Row shape of `public.fuel_cycles`. Mirrors supabase/migrations/0001_init_schema.sql.
 * `pump_truth_kml`, `true_reserve_liters`, and `net_cost_ils` are DB-generated
 * columns — never write to them directly.
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
  engine_time: string | null; // Postgres interval, e.g. "01:23:00"
  computer_avg_consumption_kml: number | null;
  pumped_liters: number;
  full_price_paid: number;
  payment_method: PaymentMethod;
  receipt_image_path: string | null;
  pump_truth_kml: number | null;
  true_reserve_liters: number;
  net_cost_ils: number;
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
      "user_id" | "engine_time" | "computer_avg_consumption_kml" | "receipt_image_path"
    >
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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
