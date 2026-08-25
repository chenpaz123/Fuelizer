"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { UserSettingsInput } from "@/lib/types";

export async function upsertUserSettings(input: UserSettingsInput) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("user_settings")
    .upsert({ user_id: user.id, ...input }, { onConflict: "user_id" });

  if (error) throw new Error(error.message);

  revalidatePath("/settings");
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
