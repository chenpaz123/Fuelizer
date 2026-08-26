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
    const result = calculateUpcomingBill(transactions, 0.58, referenceDate);

    expect(result.pazomat.sourceMonth).toMatchObject({ year: 2026, month: 6 });
    expect(result.pazomat.transactionCount).toBe(2);
    expect(result.pazomat.transactions.map((t) => t.id)).toEqual(["1", "2"]);
    expect(result.pazomat.totalLiters).toBeCloseTo(35, 2);
    expect(result.pazomat.totalNetCost).toBeCloseTo(140 - 0.58 * 20 + (105 - 0.58 * 15), 2);
  });

  it("bills Credit Card transactions from the billing month itself, with no lag", () => {
    const result = calculateUpcomingBill(transactions, 0.58, referenceDate);

    expect(result.creditCard.sourceMonth).toMatchObject({ year: 2026, month: 8 });
    expect(result.creditCard.transactionCount).toBe(2);
    expect(result.creditCard.transactions.map((t) => t.id)).toEqual(["5", "6"]);
    expect(result.creditCard.totalLiters).toBeCloseTo(40, 2);
    // Never discounted -- net cost equals the full price paid.
    expect(result.creditCard.totalNetCost).toBeCloseTo(210 + 70, 2);
  });

  it("excludes Pazomat still waiting its lag and Credit Card outside its own cycle", () => {
    const result = calculateUpcomingBill(transactions, 0.58, referenceDate);
    const includedIds = result.transactions.map((t) => t.id);

    expect(includedIds).not.toContain("3"); // Pazomat pumped this month, not two months ago
    expect(includedIds).not.toContain("7"); // Credit Card pumped two months ago, not this month
    expect(includedIds).not.toContain("4"); // Pazomat pumped in neither qualifying month
  });

  it("combines both cycles into one total, oldest first", () => {
    const result = calculateUpcomingBill(transactions, 0.58, referenceDate);

    expect(result.billingMonth).toMatchObject({ year: 2026, month: 8 });
    expect(result.transactionCount).toBe(4); // 2 Pazomat + 2 Credit Card
    expect(result.totalLiters).toBeCloseTo(75, 2); // 35 + 40
    expect(result.totalNetCost).toBeCloseTo(140 - 0.58 * 20 + (105 - 0.58 * 15) + (210 + 70), 2);
    expect(result.transactions.map((t) => t.id)).toEqual(["1", "2", "5", "6"]);
  });

  it("applies the discount rate to Pazomat only -- Credit Card is unaffected", () => {
    const result = calculateUpcomingBill(transactions, 0.75, referenceDate);

    expect(result.pazomat.totalNetCost).toBeCloseTo(140 - 0.75 * 20 + (105 - 0.75 * 15), 2);
    expect(result.creditCard.totalNetCost).toBeCloseTo(210 + 70, 2);
  });

  it("rolls Pazomat's lag over the year boundary correctly (Jan bill -> prior Nov)", () => {
    const janTransactions: FuelTransaction[] = [
      { id: "8", entryDate: "2025-11-15", pumpedLiters: 25, fullPricePaid: 175, paymentMethod: "Pazomat" },
    ];
    const result = calculateUpcomingBill(janTransactions, 0.58, new Date(Date.UTC(2026, 0, 10))); // January 2026

    expect(result.pazomat.sourceMonth).toMatchObject({ year: 2025, month: 11 });
    expect(result.pazomat.transactionCount).toBe(1);
  });

  it("returns an empty, zeroed result (both breakdowns included) when nothing matches", () => {
    const result = calculateUpcomingBill([], 0.58, referenceDate);

    expect(result.transactionCount).toBe(0);
    expect(result.totalNetCost).toBe(0);
    expect(result.totalLiters).toBe(0);
    expect(result.pazomat.transactionCount).toBe(0);
    expect(result.creditCard.transactionCount).toBe(0);
  });
});
