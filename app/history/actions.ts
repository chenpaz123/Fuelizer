"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Deletes a fuel cycle and any receipt/dashboard photos it references.
 * Ownership isn't checked explicitly here — the `delete` RLS policy on
 * fuel_cycles already scopes this to rows where `auth.uid() = user_id`, so
 * an id belonging to another user simply matches zero rows.
 */
export async function deleteFuelCycle(id: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("fuel_cycles")
    .delete()
    .eq("id", id)
    .select("receipt_image_path, dashboard_image_path")
    .maybeSingle();

  if (error) throw new Error(error.message);

  const imagePaths = [data?.receipt_image_path, data?.dashboard_image_path].filter(
    (path): path is string => Boolean(path)
  );

  if (imagePaths.length > 0) {
    const { error: storageError } = await supabase.storage.from("receipts").remove(imagePaths);
    if (storageError) {
      // The row is already gone — a leftover Storage object is a cleanup
      // nit, not a reason to fail the delete the user asked for.
      console.error("Failed to remove Storage objects for deleted fuel cycle:", storageError);
    }
  }

  revalidatePath("/history");
  revalidatePath("/dashboard");
}
