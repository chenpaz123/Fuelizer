import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { FuelCycle } from "@/lib/types";

export function CycleStatusCard({ latest }: { latest: FuelCycle | undefined }) {
  if (!latest) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Current Cycle Status</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No fill-ups logged yet.</p>
        </CardContent>
      </Card>
    );
  }

  const estimatedRangeKm =
    latest.pump_truth_kml != null ? latest.true_reserve_liters * latest.pump_truth_kml : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Current Cycle Status</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-4">
        <Stat label="Odometer" value={`${latest.total_odometer_km.toLocaleString()} km`} />
        <Stat label="True Reserve" value={`${latest.true_reserve_liters.toFixed(1)} L`} />
        <Stat
          label="Pump Truth"
          value={latest.pump_truth_kml != null ? `${latest.pump_truth_kml.toFixed(2)} km/L` : "—"}
        />
        <Stat
          label="Est. Range Remaining"
          value={estimatedRangeKm != null ? `${estimatedRangeKm.toFixed(0)} km` : "—"}
        />
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}
