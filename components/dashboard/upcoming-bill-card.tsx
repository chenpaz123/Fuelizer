import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { UpcomingBillResult } from "@/lib/billing";

export function UpcomingBillCard({ bill }: { bill: UpcomingBillResult }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Upcoming Bill · {bill.billingMonth.label}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-3xl font-semibold tabular-nums">₪{bill.totalNetCost.toFixed(2)}</p>
          <p className="text-sm text-muted-foreground">
            {bill.transactionCount} Pazomat fill-up{bill.transactionCount === 1 ? "" : "s"} from{" "}
            {bill.sourceMonth.label} · {bill.totalLiters.toFixed(2)} L
          </p>
        </div>

        {bill.transactions.length > 0 && (
          <ul className="divide-y divide-border rounded-md border border-border">
            {bill.transactions.map((t) => (
              <li key={t.id} className="flex items-center justify-between px-3 py-2 text-sm">
                <span className="text-muted-foreground">
                  {new Date(t.entryDate).toLocaleDateString()} · {t.pumpedLiters.toFixed(2)} L
                </span>
                <span className="tabular-nums">
                  ₪{t.netCost.toFixed(2)}{" "}
                  <span className="text-xs text-muted-foreground">
                    (−₪{t.discountApplied.toFixed(2)})
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
