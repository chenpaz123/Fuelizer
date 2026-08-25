import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createFuelCycle } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

export default async function LabPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <form action={createFuelCycle} className="max-w-lg space-y-4">
      <h1 className="text-xl font-semibold">Log a fill-up</h1>

      <Field label="Date" name="entry_date" type="date" required defaultValue={today()} />
      <Field label="Total Odometer (km)" name="total_odometer_km" type="number" step="0.1" required />
      <Field label="Trip Distance (km)" name="trip_distance_km" type="number" step="0.01" required />
      <Field label="Engine Time (hh:mm:ss)" name="engine_time" type="text" placeholder="01:23:00" />
      <Field
        label="Car Computer Avg Consumption (km/L)"
        name="computer_avg_consumption_kml"
        type="number"
        step="0.01"
      />
      <Field label="Pumped Liters" name="pumped_liters" type="number" step="0.001" required />
      <Field label="Full Price Paid (₪)" name="full_price_paid" type="number" step="0.01" required />

      <div className="space-y-2">
        <Label htmlFor="payment_method">Payment Method</Label>
        <Select id="payment_method" name="payment_method" required defaultValue="">
          <option value="" disabled>
            Select…
          </option>
          <option value="Pazomat">Pazomat</option>
          <option value="Credit Card">Credit Card</option>
        </Select>
      </div>

      <Button type="submit" className="w-full">
        Save fill-up
      </Button>
    </form>
  );
}

function Field({
  label,
  name,
  ...props
}: { label: string; name: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} {...props} />
    </div>
  );
}

function today() {
  return new Date().toISOString().slice(0, 10);
}
