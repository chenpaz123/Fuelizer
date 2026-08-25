import type { PaymentMethod } from "@/lib/types";

/** Company discount applied per pumped liter when paying via "Pazomat". */
export const PAZOMAT_DISCOUNT_PER_LITER_ILS = 0.58;

/** Fuel is billed exactly this many months after it was pumped. */
export const BILLING_DELAY_MONTHS = 2;

export interface FuelTransaction {
  id: string;
  /** ISO date ("YYYY-MM-DD") or a Date. Treated as a calendar day, not an instant. */
  entryDate: string | Date;
  pumpedLiters: number;
  fullPricePaid: number;
  paymentMethod: PaymentMethod;
}

export interface BilledTransaction extends FuelTransaction {
  /** Amount actually owed after any payment-method discount. */
  netCost: number;
  /** fullPricePaid - netCost. Zero for Credit Card. */
  discountApplied: number;
}

export interface UpcomingBillResult {
  /** Calendar month the bill is issued in (billingMonth = sourceMonth + 2 months). */
  billingMonth: { year: number; month: number; label: string };
  /** Calendar month the fuel was actually pumped in. */
  sourceMonth: { year: number; month: number; label: string };
  /** Pazomat transactions from the source month, oldest first. */
  transactions: BilledTransaction[];
  totalNetCost: number;
  totalLiters: number;
  transactionCount: number;
}

/**
 * Net cost after the Pazomat discount. Credit Card transactions are charged in full.
 */
export function calculateNetCost(
  transaction: Pick<FuelTransaction, "paymentMethod" | "pumpedLiters" | "fullPricePaid">
): number {
  if (transaction.paymentMethod === "Pazomat") {
    return round2(
      transaction.fullPricePaid - PAZOMAT_DISCOUNT_PER_LITER_ILS * transaction.pumpedLiters
    );
  }
  return round2(transaction.fullPricePaid);
}

/**
 * Calculates the "Upcoming Bill" widget: the total Net Cost of every Pazomat
 * transaction pumped exactly `BILLING_DELAY_MONTHS` months before `referenceDate`'s
 * month (e.g. a bill issued in August covers Pazomat fuel pumped in June).
 *
 * Credit Card transactions never appear here — they're settled at the pump, not
 * billed later — but are left in the caller's data untouched.
 */
export function calculateUpcomingBill(
  transactions: FuelTransaction[],
  referenceDate: Date = new Date()
): UpcomingBillResult {
  const billingMonthStart = startOfMonthUTC(referenceDate);
  const sourceMonthStart = addMonthsUTC(billingMonthStart, -BILLING_DELAY_MONTHS);
  const sourceMonthEnd = addMonthsUTC(sourceMonthStart, 1); // exclusive upper bound

  const billed = transactions
    .filter((t) => t.paymentMethod === "Pazomat")
    .filter((t) => {
      const d = parseCalendarDate(t.entryDate);
      return d >= sourceMonthStart && d < sourceMonthEnd;
    })
    .sort(
      (a, b) => parseCalendarDate(a.entryDate).getTime() - parseCalendarDate(b.entryDate).getTime()
    )
    .map((t) => {
      const netCost = calculateNetCost(t);
      return {
        ...t,
        netCost,
        discountApplied: round2(t.fullPricePaid - netCost),
      };
    });

  const totalNetCost = round2(billed.reduce((sum, t) => sum + t.netCost, 0));
  const totalLiters = round2(billed.reduce((sum, t) => sum + t.pumpedLiters, 0));

  return {
    billingMonth: {
      year: billingMonthStart.getUTCFullYear(),
      month: billingMonthStart.getUTCMonth() + 1,
      label: monthLabel(billingMonthStart),
    },
    sourceMonth: {
      year: sourceMonthStart.getUTCFullYear(),
      month: sourceMonthStart.getUTCMonth() + 1,
      label: monthLabel(sourceMonthStart),
    },
    transactions: billed,
    totalNetCost,
    totalLiters,
    transactionCount: billed.length,
  };
}

// --- date helpers -----------------------------------------------------------
// All month math is done in UTC so a "YYYY-MM-DD" entry_date from Postgres
// (parsed as UTC midnight) lines up with the reference date's calendar month
// regardless of the server/browser's local timezone.

function parseCalendarDate(value: string | Date): Date {
  if (value instanceof Date) {
    return new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()));
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (match) {
    const [, y, m, d] = match;
    return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  }
  const fallback = new Date(value);
  return new Date(Date.UTC(fallback.getFullYear(), fallback.getMonth(), fallback.getDate()));
}

function startOfMonthUTC(date: Date): Date {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), 1));
}

function addMonthsUTC(date: Date, delta: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + delta, 1));
}

function monthLabel(date: Date): string {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    date
  );
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
