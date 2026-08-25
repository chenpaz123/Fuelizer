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
    return <p className="text-sm text-destructive">Failed to load fuel cycles: {error.message}</p>;
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
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        <UpcomingBillCard bill={upcomingBill} />
        <CycleStatusCard latest={latest} />
      </div>
      <ConsumptionChart cycles={cycles} />
    </div>
  );
}
