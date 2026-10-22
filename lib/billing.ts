import type { PaymentMethod } from "@/lib/types";

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

export interface BillBreakdown {
  /** Calendar month these transactions were pumped in. */
  sourceMonth: { year: number; month: number; label: string };
  /** This breakdown's transactions, oldest first. */
  transactions: BilledTransaction[];
  totalNetCost: number;
  totalLiters: number;
  transactionCount: number;
}

export interface UpcomingBillResult {
  /**
   * The month label shown as the widget's headline. With `hasPazomat`,
   * this is the next month a Pazomat bill will actually post in (the
   * next 1st-of-month on or after `referenceDate`); without it, there's
   * no invoice date to anchor to, so it's just `referenceDate`'s own
   * calendar month, same as `creditCard.sourceMonth`.
   */
  billingMonth: { year: number; month: number; label: string };
  /** Pazomat transactions, pumped `pazomatBillingDelayMonths` before billingMonth. */
  pazomat: BillBreakdown;
  /** Credit Card transactions, pumped in billingMonth itself -- no lag. */
  creditCard: BillBreakdown;
  /** pazomat.transactions + creditCard.transactions combined, oldest first. */
  transactions: BilledTransaction[];
  totalNetCost: number;
  totalLiters: number;
  transactionCount: number;
}

/**
 * Net cost after the Pazomat discount. Credit Card transactions are charged in full.
 *
 * `pazomatDiscountPerLiter` is that user's actual rate from `user_settings`
 * (fall back to `DEFAULT_PAZOMAT_DISCOUNT_PER_LITER` from lib/settings.ts at
 * the call site if they haven't saved one) — never hardcode it here, so a
 * user's own discount always drives their own numbers.
 */
export function calculateNetCost(
  transaction: Pick<FuelTransaction, "paymentMethod" | "pumpedLiters" | "fullPricePaid">,
  pazomatDiscountPerLiter: number
): number {
  if (transaction.paymentMethod === "Pazomat") {
    return round2(transaction.fullPricePaid - pazomatDiscountPerLiter * transaction.pumpedLiters);
  }
  return round2(transaction.fullPricePaid);
}

/**
 * Calculates the "Upcoming Bill" / "Regular Mode" "This Month's Expenses"
 * widget, combining two different billing cycles per payment method:
 *
 * - **Pazomat** is only ever billed on the 1st of a month, and lags
 *   `pazomatBillingDelayMonths` months behind that billing date: with a
 *   2-month delay, the bill that posts on November 1st covers Pazomat fuel
 *   pumped in September. The "upcoming" bill is whichever one hasn't
 *   posted yet -- if `referenceDate` is the 1st, that's this month's; any
 *   other day, this month's already posted and the next one is next
 *   month's. That's why a mid-month `referenceDate` (e.g. October 22nd)
 *   shows next month's (November's) Pazomat source month, not this
 *   month's. `pazomatBillingDelayMonths` is that user's own
 *   `user_settings.pazomat_billing_delay_months` (fall back to
 *   `DEFAULT_PAZOMAT_BILLING_DELAY_MONTHS` from lib/settings.ts at the
 *   call site if they haven't saved one) — never hardcode it here, same
 *   reasoning as `pazomatDiscountPerLiter` below.
 * - **Credit Card** has no lag and isn't tied to a specific invoice date:
 *   it's a running tally of `referenceDate`'s own calendar month, growing
 *   as that month progresses. This one isn't user-configurable — it's how
 *   the payment method itself settles, not a preference.
 *
 * `hasPazomat` is `user_settings.has_pazomat` ("Regular Mode" toggle, fall
 * back to `DEFAULT_HAS_PAZOMAT` at the call site). When false, Pazomat
 * rows are treated exactly like Credit Card's -- counted from
 * `referenceDate`'s own calendar month with 0 lag, not anchored to any
 * future billing date -- since a user without a Pazomat card has no real
 * Pazomat billing cycle to anchor against. The widget still ends up
 * correct even with no Pazomat rows at all: `pazomat` comes back an empty
 * breakdown and the combined total is just Credit Card's.
 *
 * The combined total is Pazomat's subtotal + Credit Card's current-month
 * subtotal — see `pazomat`/`creditCard` on the result for the breakdown,
 * and `transactions`/`totalNetCost`/`totalLiters`/`transactionCount` for
 * the two combined.
 *
 * `pazomatDiscountPerLiter` — see calculateNetCost's doc comment.
 */
export function calculateUpcomingBill(
  transactions: FuelTransaction[],
  pazomatDiscountPerLiter: number,
  pazomatBillingDelayMonths: number,
  hasPazomat: boolean,
  referenceDate: Date = new Date()
): UpcomingBillResult {
  const currentMonthStart = startOfMonthUTC(referenceDate);
  const nextBillingMonthStart =
    referenceDate.getDate() === 1 ? currentMonthStart : addMonthsUTC(currentMonthStart, 1);

  const pazomatAnchorMonth = hasPazomat ? nextBillingMonthStart : currentMonthStart;
  const effectiveDelayMonths = hasPazomat ? pazomatBillingDelayMonths : 0;
  const pazomatSourceMonthStart = addMonthsUTC(pazomatAnchorMonth, -effectiveDelayMonths);

  const billingMonthStart = hasPazomat ? nextBillingMonthStart : currentMonthStart;

  const pazomat = buildBreakdown(transactions, "Pazomat", pazomatSourceMonthStart, pazomatDiscountPerLiter);
  const creditCard = buildBreakdown(transactions, "Credit Card", currentMonthStart, pazomatDiscountPerLiter);

  const combined = [...pazomat.transactions, ...creditCard.transactions].sort(
    (a, b) => parseCalendarDate(a.entryDate).getTime() - parseCalendarDate(b.entryDate).getTime()
  );

  return {
    billingMonth: {
      year: billingMonthStart.getUTCFullYear(),
      month: billingMonthStart.getUTCMonth() + 1,
      label: monthLabel(billingMonthStart),
    },
    pazomat,
    creditCard,
    transactions: combined,
    totalNetCost: round2(pazomat.totalNetCost + creditCard.totalNetCost),
    totalLiters: round2(pazomat.totalLiters + creditCard.totalLiters),
    transactionCount: pazomat.transactionCount + creditCard.transactionCount,
  };
}

/** Filters `transactions` to one payment method within one calendar month and totals them up. */
function buildBreakdown(
  transactions: FuelTransaction[],
  paymentMethod: PaymentMethod,
  monthStart: Date,
  pazomatDiscountPerLiter: number
): BillBreakdown {
  const monthEnd = addMonthsUTC(monthStart, 1); // exclusive upper bound

  const billed = transactions
    .filter((t) => t.paymentMethod === paymentMethod)
    .filter((t) => {
      const d = parseCalendarDate(t.entryDate);
      return d >= monthStart && d < monthEnd;
    })
    .sort(
      (a, b) => parseCalendarDate(a.entryDate).getTime() - parseCalendarDate(b.entryDate).getTime()
    )
    .map((t) => {
      const netCost = calculateNetCost(t, pazomatDiscountPerLiter);
      return {
        ...t,
        netCost,
        discountApplied: round2(t.fullPricePaid - netCost),
      };
    });

  return {
    sourceMonth: {
      year: monthStart.getUTCFullYear(),
      month: monthStart.getUTCMonth() + 1,
      label: monthLabel(monthStart),
    },
    transactions: billed,
    totalNetCost: round2(billed.reduce((sum, t) => sum + t.netCost, 0)),
    totalLiters: round2(billed.reduce((sum, t) => sum + t.pumpedLiters, 0)),
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
  return new Intl.DateTimeFormat("he-IL", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    date
  );
}

/** Rounds to 2 decimal places (ILS amounts). Also used by app/lab/actions.ts. */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
