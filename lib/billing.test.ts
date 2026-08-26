import { describe, expect, it } from "vitest";
import { calculateNetCost, calculateUpcomingBill, type FuelTransaction } from "@/lib/billing";

describe("calculateNetCost", () => {
  it("applies the given Pazomat discount per pumped liter", () => {
    expect(
      calculateNetCost({ paymentMethod: "Pazomat", pumpedLiters: 20, fullPricePaid: 140 }, 0.58)
    ).toBeCloseTo(140 - 0.58 * 20, 2);
  });

  it("charges Credit Card transactions in full regardless of the discount rate", () => {
    expect(
      calculateNetCost({ paymentMethod: "Credit Card", pumpedLiters: 20, fullPricePaid: 140 }, 0.58)
    ).toBe(140);
  });

  it("uses a different user's own discount rate, not a hardcoded one", () => {
    expect(
      calculateNetCost({ paymentMethod: "Pazomat", pumpedLiters: 20, fullPricePaid: 140 }, 0.75)
    ).toBeCloseTo(140 - 0.75 * 20, 2);
  });
});

describe("calculateUpcomingBill", () => {
  const referenceDate = new Date(Date.UTC(2026, 7, 25)); // August 2026

  const transactions: FuelTransaction[] = [
    // Pazomat, pumped two months prior (June) -- billed now, per its lag.
    { id: "1", entryDate: "2026-06-05", pumpedLiters: 20, fullPricePaid: 140, paymentMethod: "Pazomat" },
    { id: "2", entryDate: "2026-06-20", pumpedLiters: 15, fullPricePaid: 105, paymentMethod: "Pazomat" },
    // Pazomat, pumped in the billing month itself (August) -- not billed yet;
    // still waiting out its own two-month lag.
    { id: "3", entryDate: "2026-08-12", pumpedLiters: 22, fullPricePaid: 154, paymentMethod: "Pazomat" },
    // Pazomat, neither June nor August -- excluded either way.
    { id: "4", entryDate: "2026-07-01", pumpedLiters: 18, fullPricePaid: 126, paymentMethod: "Pazomat" },
    // Credit Card, pumped in the billing month itself (August) -- billed
    // now, with no lag.
    { id: "5", entryDate: "2026-08-03", pumpedLiters: 30, fullPricePaid: 210, paymentMethod: "Credit Card" },
    { id: "6", entryDate: "2026-08-18", pumpedLiters: 10, fullPricePaid: 70, paymentMethod: "Credit Card" },
    // Credit Card, pumped in Pazomat's lag month (June) -- not Credit
    // Card's own billing cycle, so excluded.
    { id: "7", entryDate: "2026-06-10", pumpedLiters: 30, fullPricePaid: 210, paymentMethod: "Credit Card" },
  ];

  it("bills Pazomat transactions from two months prior", () => {
    const result = calculateUpcomingBill(transactions, 0.58, 2, true, referenceDate);

    expect(result.pazomat.sourceMonth).toMatchObject({ year: 2026, month: 6 });
    expect(result.pazomat.transactionCount).toBe(2);
    expect(result.pazomat.transactions.map((t) => t.id)).toEqual(["1", "2"]);
    expect(result.pazomat.totalLiters).toBeCloseTo(35, 2);
    expect(result.pazomat.totalNetCost).toBeCloseTo(140 - 0.58 * 20 + (105 - 0.58 * 15), 2);
  });

  it("bills Credit Card transactions from the billing month itself, with no lag", () => {
    const result = calculateUpcomingBill(transactions, 0.58, 2, true, referenceDate);

    expect(result.creditCard.sourceMonth).toMatchObject({ year: 2026, month: 8 });
    expect(result.creditCard.transactionCount).toBe(2);
    expect(result.creditCard.transactions.map((t) => t.id)).toEqual(["5", "6"]);
    expect(result.creditCard.totalLiters).toBeCloseTo(40, 2);
    // Never discounted -- net cost equals the full price paid.
    expect(result.creditCard.totalNetCost).toBeCloseTo(210 + 70, 2);
  });

  it("excludes Pazomat still waiting its lag and Credit Card outside its own cycle", () => {
    const result = calculateUpcomingBill(transactions, 0.58, 2, true, referenceDate);
    const includedIds = result.transactions.map((t) => t.id);

    expect(includedIds).not.toContain("3"); // Pazomat pumped this month, not two months ago
    expect(includedIds).not.toContain("7"); // Credit Card pumped two months ago, not this month
    expect(includedIds).not.toContain("4"); // Pazomat pumped in neither qualifying month
  });

  it("combines both cycles into one total, oldest first", () => {
    const result = calculateUpcomingBill(transactions, 0.58, 2, true, referenceDate);

    expect(result.billingMonth).toMatchObject({ year: 2026, month: 8 });
    expect(result.transactionCount).toBe(4); // 2 Pazomat + 2 Credit Card
    expect(result.totalLiters).toBeCloseTo(75, 2); // 35 + 40
    expect(result.totalNetCost).toBeCloseTo(140 - 0.58 * 20 + (105 - 0.58 * 15) + (210 + 70), 2);
    expect(result.transactions.map((t) => t.id)).toEqual(["1", "2", "5", "6"]);
  });

  it("applies the discount rate to Pazomat only -- Credit Card is unaffected", () => {
    const result = calculateUpcomingBill(transactions, 0.75, 2, true, referenceDate);

    expect(result.pazomat.totalNetCost).toBeCloseTo(140 - 0.75 * 20 + (105 - 0.75 * 15), 2);
    expect(result.creditCard.totalNetCost).toBeCloseTo(210 + 70, 2);
  });

  it("rolls Pazomat's lag over the year boundary correctly (Jan bill -> prior Nov)", () => {
    const janTransactions: FuelTransaction[] = [
      { id: "8", entryDate: "2025-11-15", pumpedLiters: 25, fullPricePaid: 175, paymentMethod: "Pazomat" },
    ];
    const result = calculateUpcomingBill(janTransactions, 0.58, 2, true, new Date(Date.UTC(2026, 0, 10))); // January 2026

    expect(result.pazomat.sourceMonth).toMatchObject({ year: 2025, month: 11 });
    expect(result.pazomat.transactionCount).toBe(1);
  });

  it("returns an empty, zeroed result (both breakdowns included) when nothing matches", () => {
    const result = calculateUpcomingBill([], 0.58, 2, true, referenceDate);

    expect(result.transactionCount).toBe(0);
    expect(result.totalNetCost).toBe(0);
    expect(result.totalLiters).toBe(0);
    expect(result.pazomat.transactionCount).toBe(0);
    expect(result.creditCard.transactionCount).toBe(0);
  });

  describe("configurable pazomatBillingDelayMonths", () => {
    // A fresh dataset, one Pazomat transaction per month, so each delay
    // value has an unambiguous single row to find (or not).
    const monthlyTransactions: FuelTransaction[] = [
      { id: "may", entryDate: "2026-05-10", pumpedLiters: 20, fullPricePaid: 140, paymentMethod: "Pazomat" },
      { id: "jun", entryDate: "2026-06-10", pumpedLiters: 20, fullPricePaid: 140, paymentMethod: "Pazomat" },
      { id: "jul", entryDate: "2026-07-10", pumpedLiters: 20, fullPricePaid: 140, paymentMethod: "Pazomat" },
      { id: "aug", entryDate: "2026-08-10", pumpedLiters: 20, fullPricePaid: 140, paymentMethod: "Pazomat" },
    ];

    it("a 1-month delay bills last month's Pazomat fuel", () => {
      const result = calculateUpcomingBill(monthlyTransactions, 0.58, 1, true, referenceDate);

      expect(result.pazomat.sourceMonth).toMatchObject({ year: 2026, month: 7 });
      expect(result.pazomat.transactions.map((t) => t.id)).toEqual(["jul"]);
    });

    it("a 2-month delay (the old hardcoded default) bills two months back", () => {
      const result = calculateUpcomingBill(monthlyTransactions, 0.58, 2, true, referenceDate);

      expect(result.pazomat.sourceMonth).toMatchObject({ year: 2026, month: 6 });
      expect(result.pazomat.transactions.map((t) => t.id)).toEqual(["jun"]);
    });

    it("a 3-month delay bills three months back", () => {
      const result = calculateUpcomingBill(monthlyTransactions, 0.58, 3, true, referenceDate);

      expect(result.pazomat.sourceMonth).toMatchObject({ year: 2026, month: 5 });
      expect(result.pazomat.transactions.map((t) => t.id)).toEqual(["may"]);
    });

    it("a 0-month delay bills Pazomat the same month as Credit Card, with no lag", () => {
      const result = calculateUpcomingBill(monthlyTransactions, 0.58, 0, true, referenceDate);

      expect(result.pazomat.sourceMonth).toMatchObject({ year: 2026, month: 8 });
      expect(result.pazomat.transactions.map((t) => t.id)).toEqual(["aug"]);
    });
  });

  describe("hasPazomat = false (Regular Mode)", () => {
    it("ignores pazomatBillingDelayMonths and bills everything from the current month", () => {
      // Same dataset as the main suite above, but now interpreted with no
      // Pazomat card: transaction "3" (Pazomat, pumped in August) should
      // now count -- there's no 2-month lag left to make it wait.
      const result = calculateUpcomingBill(transactions, 0.58, 2, false, referenceDate);

      expect(result.pazomat.sourceMonth).toMatchObject({ year: 2026, month: 8 });
      expect(result.pazomat.transactions.map((t) => t.id)).toEqual(["3"]);
      // Credit Card's own cycle never had a lag to begin with -- unchanged.
      expect(result.creditCard.transactions.map((t) => t.id)).toEqual(["5", "6"]);
    });

    it("still excludes transactions from other months -- 'current month only', not 'everything'", () => {
      const result = calculateUpcomingBill(transactions, 0.58, 2, false, referenceDate);
      const includedIds = result.transactions.map((t) => t.id);

      expect(includedIds).not.toContain("1"); // Pazomat, June -- not the current month
      expect(includedIds).not.toContain("2"); // Pazomat, June -- not the current month
      expect(includedIds).not.toContain("4"); // Pazomat, July -- not the current month
      expect(includedIds).not.toContain("7"); // Credit Card, June -- not the current month
    });

    it("sums a mixed-payment-method month into one total, discount still applied per row", () => {
      const result = calculateUpcomingBill(transactions, 0.58, 2, false, referenceDate);

      expect(result.transactionCount).toBe(3); // "3" (Pazomat) + "5", "6" (Credit Card)
      expect(result.totalNetCost).toBeCloseTo(154 - 0.58 * 22 + 210 + 70, 2);
    });

    it("with no Pazomat rows at all, matches a plain sum of the current month's Credit Card fuel", () => {
      const creditCardOnly = transactions.filter((t) => t.paymentMethod === "Credit Card");
      const result = calculateUpcomingBill(creditCardOnly, 0.58, 2, false, referenceDate);

      expect(result.pazomat.transactionCount).toBe(0);
      expect(result.transactionCount).toBe(2);
      expect(result.totalNetCost).toBeCloseTo(210 + 70, 2);
    });
  });
});
