"use client";

import { useMemo, useState } from "react";
import { FuelCycleCard, type ImageInfo } from "@/components/history/fuel-cycle-card";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { FuelCycle } from "@/lib/types";

export function MonthlyHistoryView({
  cycles,
  signedUrlByPath,
}: {
  cycles: FuelCycle[];
  // Plain object, not a Map: this is a Server Component -> Client Component
  // prop, and a plain object serializes unambiguously across that boundary.
  signedUrlByPath: Record<string, string>;
}) {
  // cycles arrives already sorted newest-first (see app/history/page.tsx's
  // query), so grouping preserves that order: monthGroups' keys, and
  // therefore the month tabs below, are newest-first too.
  const monthGroups = useMemo(() => groupByMonth(cycles), [cycles]);
  const monthKeys = useMemo(() => Array.from(monthGroups.keys()), [monthGroups]);

  const [selectedMonth, setSelectedMonth] = useState(() => defaultMonth(monthKeys));

  if (cycles.length === 0) {
    return <p className="text-center text-sm text-muted-foreground">עדיין לא נרשמו תדלוקים.</p>;
  }

  // The selected month can fall out of monthKeys if its last fill-up gets
  // deleted while it's active -- fall back to the most recent month with
  // data instead of rendering a dead selection.
  const activeMonth = monthKeys.includes(selectedMonth) ? selectedMonth : (monthKeys[0] as string);
  const monthCycles = monthGroups.get(activeMonth) ?? [];
  // Nulls (pre-user_settings historical rows) don't contribute to the sum
  // rather than blanking the whole total -- matches how the Dashboard's
  // Upcoming Bill widget already treats net_cost_ils.
  const totalNetCost = monthCycles.reduce((sum, c) => sum + (c.net_cost_ils ?? 0), 0);
  const totalLiters = monthCycles.reduce((sum, c) => sum + c.pumped_liters, 0);
  const countLabel = monthCycles.length === 1 ? "תדלוק אחד" : `${monthCycles.length} תדלוקים`;

  return (
    <div className="space-y-5">
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="tablist" aria-label="בחר חודש">
        {monthKeys.map((key) => {
          const isActive = key === activeMonth;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setSelectedMonth(key)}
              className={cn(
                "shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                  : "bg-muted/40 text-muted-foreground hover:bg-muted"
              )}
            >
              {formatMonthShort(key)}
            </button>
          );
        })}
      </div>

      <Card>
        <CardContent className="space-y-1 p-6 text-center">
          <p className="text-sm text-muted-foreground">סה״כ בחודש {formatMonthLong(activeMonth)}</p>
          <p className="text-4xl font-bold tabular-nums">₪{totalNetCost.toFixed(2)}</p>
          <p className="text-xs text-muted-foreground">
            {countLabel} · {totalLiters.toFixed(2)} ליטר
          </p>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {monthCycles.map((cycle) => (
          <FuelCycleCard
            key={cycle.id}
            cycle={cycle}
            receiptImage={imageInfoFor(cycle.receipt_image_path, "קבלה", signedUrlByPath)}
            dashboardImage={imageInfoFor(cycle.dashboard_image_path, "לוח מחוונים", signedUrlByPath)}
          />
        ))}
      </div>
    </div>
  );
}

function imageInfoFor(
  path: string | null,
  label: string,
  signedUrlByPath: Record<string, string>
): ImageInfo | null {
  const signedUrl = path ? signedUrlByPath[path] : undefined;
  return signedUrl ? { label, signedUrl } : null;
}

function groupByMonth(cycles: FuelCycle[]): Map<string, FuelCycle[]> {
  const groups = new Map<string, FuelCycle[]>();
  for (const cycle of cycles) {
    const key = cycle.entry_date.slice(0, 7); // "YYYY-MM"
    const existing = groups.get(key);
    if (existing) existing.push(cycle);
    else groups.set(key, [cycle]);
  }
  return groups;
}

/**
 * The current calendar month if it has any fill-ups, otherwise the most
 * recent month that does (monthKeys is newest-first -- see groupByMonth's
 * caller). Falls back to the current month's key if there's no data at all,
 * though that path is unreachable in practice since the caller returns its
 * own empty state before this value is ever used.
 */
function defaultMonth(monthKeys: string[]): string {
  const currentMonthKey = new Date().toISOString().slice(0, 7);
  if (monthKeys.includes(currentMonthKey)) return currentMonthKey;
  return monthKeys[0] ?? currentMonthKey;
}

function parseMonthKey(monthKey: string): Date {
  const [year = 1970, month = 1] = monthKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1));
}

function formatMonthShort(monthKey: string): string {
  const date = parseMonthKey(monthKey);
  const month = new Intl.DateTimeFormat("he-IL", { month: "short", timeZone: "UTC" }).format(date);
  const year = date.getUTCFullYear().toString().slice(2);
  return `${month} ${year}`;
}

function formatMonthLong(monthKey: string): string {
  const date = parseMonthKey(monthKey);
  return new Intl.DateTimeFormat("he-IL", { month: "long", year: "numeric", timeZone: "UTC" }).format(date);
}
