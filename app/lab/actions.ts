"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { round2 } from "@/lib/billing";
import { DEFAULT_PAZOMAT_DISCOUNT_PER_LITER, DEFAULT_TANK_CAPACITY_LITERS } from "@/lib/settings";
import type { FuelCycleInsert } from "@/lib/types";

export async function createFuelCycle(input: FuelCycleInsert) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: settings } = await supabase
    .from("user_settings")
    .select("pazomat_discount_per_liter, tank_capacity_liters")
    .eq("user_id", user.id)
    .maybeSingle();

  const pazomatDiscountPerLiter =
    settings?.pazomat_discount_per_liter ?? DEFAULT_PAZOMAT_DISCOUNT_PER_LITER;
  const tankCapacityLiters = settings?.tank_capacity_liters ?? DEFAULT_TANK_CAPACITY_LITERS;

  // Net Cost: the discount only ever applies to Pazomat fill-ups — Credit
  // Card is charged in full. (A literal `full_price_paid - liters *
  // discount` with no branch on payment method would incorrectly discount
  // Credit Card transactions too; this mirrors lib/billing.ts's
  // calculateNetCost and the original generated-column formula on purpose.)
  const netCostIls = round2(
    input.payment_method === "Pazomat"
      ? input.full_price_paid - pazomatDiscountPerLiter * input.pumped_liters
      : input.full_price_paid
  );
  const trueReserveLiters = round2(tankCapacityLiters - input.pumped_liters);

  const { error } = await supabase.from("fuel_cycles").insert({
    ...input,
    user_id: user.id,
    net_cost_ils: netCostIls,
    true_reserve_liters: trueReserveLiters,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard");
  revalidatePath("/lab");
  revalidatePath("/history");
}
