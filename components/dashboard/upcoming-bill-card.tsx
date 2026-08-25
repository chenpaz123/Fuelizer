import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { UpcomingBillResult } from "@/lib/billing";

export function UpcomingBillCard({ bill }: { bill: UpcomingBillResult }) {
  const countLabel =
    bill.transactionCount === 1 ? "תדלוק אחד" : `${bill.transactionCount} תדלוקים`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>החיוב הקרוב · {bill.billingMonth.label}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-3xl font-bold tabular-nums">₪{bill.totalNetCost.toFixed(2)}</p>
          <p className="text-sm text-muted-foreground">
            {countLabel} בפזומט מ־{bill.sourceMonth.label} · {bill.totalLiters.toFixed(2)} ליטר
          </p>
        </div>

        {bill.transactions.length > 0 && (
          <ul className="divide-y divide-border rounded-2xl border border-border/60">
            {bill.transactions.map((t) => (
              <li key={t.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <span className="text-muted-foreground">
                  {new Date(t.entryDate).toLocaleDateString("he-IL")} · {t.pumpedLiters.toFixed(2)} ליטר
                </span>
                <span className="tabular-nums">
                  ₪{t.netCost.toFixed(2)}{" "}
                  <span className="text-xs text-muted-foreground">
                    (הנחה ₪{t.discountApplied.toFixed(2)})
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
