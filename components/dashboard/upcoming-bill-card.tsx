import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { BillBreakdown, UpcomingBillResult } from "@/lib/billing";

const PAYMENT_METHOD_LABELS = {
  Pazomat: "פזומט",
  "Credit Card": "אשראי",
} as const;

export function UpcomingBillCard({ bill }: { bill: UpcomingBillResult }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>החיוב הקרוב · {bill.billingMonth.label}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <p className="text-3xl font-bold tabular-nums">₪{bill.totalNetCost.toFixed(2)}</p>
          {/* Pazomat lags 2 months behind Credit Card's current-month cycle
              (see lib/billing.ts), so each breakdown line needs its own
              source-month label -- a single combined subtitle would imply
              both groups came from the same month. */}
          <BreakdownLine label={PAYMENT_METHOD_LABELS.Pazomat} breakdown={bill.pazomat} />
          <BreakdownLine label={PAYMENT_METHOD_LABELS["Credit Card"]} breakdown={bill.creditCard} />
        </div>

        {bill.transactions.length > 0 && (
          <ul className="divide-y divide-border rounded-2xl border border-border/60">
            {bill.transactions.map((t) => (
              <li key={t.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <span className="text-muted-foreground">
                  {PAYMENT_METHOD_LABELS[t.paymentMethod]} · {new Date(t.entryDate).toLocaleDateString("he-IL")}{" "}
                  · {t.pumpedLiters.toFixed(2)} ליטר
                </span>
                <span className="tabular-nums">
                  ₪{t.netCost.toFixed(2)}{" "}
                  {t.discountApplied > 0 && (
                    <span className="text-xs text-muted-foreground">
                      (הנחה ₪{t.discountApplied.toFixed(2)})
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function BreakdownLine({ label, breakdown }: { label: string; breakdown: BillBreakdown }) {
  if (breakdown.transactionCount === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {label} מ־{breakdown.sourceMonth.label}: אין תדלוקים
      </p>
    );
  }

  const countLabel = breakdown.transactionCount === 1 ? "תדלוק אחד" : `${breakdown.transactionCount} תדלוקים`;

  return (
    <p className="text-sm text-muted-foreground">
      {label} מ־{breakdown.sourceMonth.label}: {countLabel} · {breakdown.totalLiters.toFixed(2)} ליטר · ₪
      {breakdown.totalNetCost.toFixed(2)}
    </p>
  );
}
