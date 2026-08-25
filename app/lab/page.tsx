import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ReceiptScanner } from "@/components/lab/receipt-scanner";

export default async function LabPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: latest } = await supabase
    .from("fuel_cycles")
    .select("total_odometer_km")
    .order("entry_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">סריקת קבלה</h1>
      <ReceiptScanner userId={user.id} lastOdometerKm={latest?.total_odometer_km ?? null} />
    </div>
  );
}
