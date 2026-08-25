"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createFuelCycle(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const engineTimeRaw = formData.get("engine_time") as string;
  const computerAvgRaw = formData.get("computer_avg_consumption_kml") as string;

  const { error } = await supabase.from("fuel_cycles").insert({
    user_id: user.id,
    entry_date: formData.get("entry_date") as string,
    total_odometer_km: Number(formData.get("total_odometer_km")),
    trip_distance_km: Number(formData.get("trip_distance_km")),
    engine_time: engineTimeRaw || null,
    computer_avg_consumption_kml: computerAvgRaw ? Number(computerAvgRaw) : null,
    pumped_liters: Number(formData.get("pumped_liters")),
    full_price_paid: Number(formData.get("full_price_paid")),
    payment_method: formData.get("payment_method") as "Pazomat" | "Credit Card",
  });

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard");
  revalidatePath("/lab");
}
