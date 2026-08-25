import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { calculateUpcomingBill, type FuelTransaction } from "@/lib/billing";
import { UpcomingBillCard } from "@/components/dashboard/upcoming-bill-card";
import { CycleStatusCard } from "@/components/dashboard/cycle-status-card";
import { ConsumptionChart } from "@/components/dashboard/consumption-chart";
import type { FuelCycle } from "@/lib/types";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data, error } = await supabase
    .from("fuel_cycles")
    .select("*")
    .order("entry_date", { ascending: true });

  if (error) {
    return <p className="text-sm text-destructive">טעינת נתוני התדלוקים נכשלה: {error.message}</p>;
  }

  const cycles = (data ?? []) as FuelCycle[];
  const latest = cycles.at(-1);

  const transactions: FuelTransaction[] = cycles.map((c) => ({
    id: c.id,
    entryDate: c.entry_date,
    pumpedLiters: c.pumped_liters,
    fullPricePaid: c.full_price_paid,
    paymentMethod: c.payment_method,
  }));

  const upcomingBill = calculateUpcomingBill(transactions);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">דשבורד</h1>
      <UpcomingBillCard bill={upcomingBill} />
      <CycleStatusCard latest={latest} />
      <ConsumptionChart cycles={cycles} />
    </div>
  );
}
