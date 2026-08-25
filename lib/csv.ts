import type { FuelCycle } from "@/lib/types";

const CSV_HEADERS = [
  "תאריך",
  "קילומטראז' כולל",
  "מרחק נסיעה",
  "ליטרים",
  "מחיר מלא",
  "עלות נטו",
  "צריכה ממוצעת",
  "אופן תשלום",
  "טווח משוער",
] as const;

const PAYMENT_METHOD_LABELS: Record<FuelCycle["payment_method"], string> = {
  Pazomat: "פזומט",
  "Credit Card": "כרטיס אשראי",
};

// UTF-8 BOM so Excel (Windows in particular) detects the encoding instead of
// mangling the Hebrew headers and labels into mojibake.
const UTF8_BOM = "﻿";

/**
 * Builds an Excel-friendly CSV of a user's fuel_cycles (oldest first is the
 * caller's choice — this just formats whatever order it's given). CRLF row
 * endings and a UTF-8 BOM per RFC 4180 / Excel convention.
 */
export function fuelCyclesToCsv(cycles: FuelCycle[]): string {
  const rows = cycles.map((c) => [
    c.entry_date,
    formatNumber(c.total_odometer_km),
    formatNumber(c.trip_distance_km),
    formatNumber(c.pumped_liters),
    formatNumber(c.full_price_paid),
    formatNumber(c.net_cost_ils),
    formatNumber(c.computer_avg_consumption_kml),
    PAYMENT_METHOD_LABELS[c.payment_method],
    formatNumber(c.estimated_range),
  ]);

  const lines = [CSV_HEADERS as unknown as string[], ...rows].map((row) =>
    row.map(escapeCsvField).join(",")
  );

  return UTF8_BOM + lines.join("\r\n") + "\r\n";
}

function formatNumber(value: number | null): string {
  return value != null ? String(value) : "";
}

/** Quotes a field and doubles embedded quotes if it contains a comma, quote, or newline. */
function escapeCsvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
