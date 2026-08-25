"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { FuelCycleInsert } from "@/lib/types";

export async function createFuelCycle(input: FuelCycleInsert) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase.from("fuel_cycles").insert({
    ...input,
    user_id: user.id,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard");
  revalidatePath("/lab");
}
