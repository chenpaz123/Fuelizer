import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { FuelCycle } from "@/lib/types";

export function CycleStatusCard({ latest }: { latest: FuelCycle | undefined }) {
  if (!latest) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>מצב המחזור הנוכחי</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">עדיין לא נרשמו תדלוקים.</p>
        </CardContent>
      </Card>
    );
  }

  const estimatedRangeKm =
    latest.pump_truth_kml != null && latest.true_reserve_liters != null
      ? latest.true_reserve_liters * latest.pump_truth_kml
      : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>מצב המחזור הנוכחי</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-4">
        <Stat label="קילומטראז'" value={`${latest.total_odometer_km.toLocaleString("he-IL")} ק"מ`} />
        <Stat
          label="רזרבה אמיתית"
          value={latest.true_reserve_liters != null ? `${latest.true_reserve_liters.toFixed(1)} ליטר` : "—"}
        />
        <Stat
          label="אמת המשאבה"
          value={latest.pump_truth_kml != null ? `${latest.pump_truth_kml.toFixed(2)} ק"מ/ליטר` : "—"}
        />
        <Stat
          label="טווח משוער נותר"
          value={estimatedRangeKm != null ? `${estimatedRangeKm.toFixed(0)} ק"מ` : "—"}
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
