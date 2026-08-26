import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { calculateUpcomingBill, type FuelTransaction } from "@/lib/billing";
import {
  DEFAULT_HAS_PAZOMAT,
  DEFAULT_PAZOMAT_BILLING_DELAY_MONTHS,
  DEFAULT_PAZOMAT_DISCOUNT_PER_LITER,
} from "@/lib/settings";
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

  const [{ data, error }, { data: settings }] = await Promise.all([
    supabase.from("fuel_cycles").select("*").order("entry_date", { ascending: true }),
    // tank_capacity_liters isn't selected here: nothing on this page
    // recomputes True Reserve — it's already snapshotted per-row in
    // fuel_cycles.true_reserve_liters at insert time (app/lab/actions.ts),
    // so the Dashboard just displays that stored value directly.
    supabase
      .from("user_settings")
      .select("pazomat_discount_per_liter, pazomat_billing_delay_months, has_pazomat")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  if (error) {
    return <p className="text-sm text-destructive">טעינת נתוני התדלוקים נכשלה: {error.message}</p>;
  }

  const pazomatDiscountPerLiter =
    settings?.pazomat_discount_per_liter ?? DEFAULT_PAZOMAT_DISCOUNT_PER_LITER;
  const pazomatBillingDelayMonths =
    settings?.pazomat_billing_delay_months ?? DEFAULT_PAZOMAT_BILLING_DELAY_MONTHS;
  const hasPazomat = settings?.has_pazomat ?? DEFAULT_HAS_PAZOMAT;

  const cycles = (data ?? []) as FuelCycle[];
  const latest = cycles.at(-1);

  const transactions: FuelTransaction[] = cycles.map((c) => ({
    id: c.id,
    entryDate: c.entry_date,
    pumpedLiters: c.pumped_liters,
    fullPricePaid: c.full_price_paid,
    paymentMethod: c.payment_method,
  }));

  const upcomingBill = calculateUpcomingBill(
    transactions,
    pazomatDiscountPerLiter,
    pazomatBillingDelayMonths,
    hasPazomat
  );

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">דשבורד</h1>
      <UpcomingBillCard bill={upcomingBill} hasPazomat={hasPazomat} />
      <CycleStatusCard latest={latest} />
      <ConsumptionChart cycles={cycles} />
    </div>
  );
}
