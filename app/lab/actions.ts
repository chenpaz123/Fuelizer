"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { calculateNetCost, round2 } from "@/lib/billing";
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

  // Reuses lib/billing.ts's calculateNetCost so the discount-only-applies-
  // to-Pazomat rule lives in exactly one place, shared with the Dashboard's
  // Upcoming Bill widget.
  const netCostIls = calculateNetCost(
    {
      paymentMethod: input.payment_method,
      pumpedLiters: input.pumped_liters,
      fullPricePaid: input.full_price_paid,
    },
    pazomatDiscountPerLiter
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
