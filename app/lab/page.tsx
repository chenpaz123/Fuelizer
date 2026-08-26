import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ReceiptScanner } from "@/components/lab/receipt-scanner";
import { DEFAULT_HAS_PAZOMAT } from "@/lib/settings";

export default async function LabPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: latest }, { data: settings }] = await Promise.all([
    supabase
      .from("fuel_cycles")
      .select("total_odometer_km")
      .order("entry_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("user_settings").select("has_pazomat").eq("user_id", user.id).maybeSingle(),
  ]);

  const hasPazomat = settings?.has_pazomat ?? DEFAULT_HAS_PAZOMAT;

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">סריקת קבלה</h1>
      <ReceiptScanner
        userId={user.id}
        lastOdometerKm={latest?.total_odometer_km ?? null}
        hasPazomat={hasPazomat}
      />
    </div>
  );
}
