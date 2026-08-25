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
  const transactions: FuelTransaction[] = [
    { id: "1", entryDate: "2026-06-05", pumpedLiters: 20, fullPricePaid: 140, paymentMethod: "Pazomat" },
    { id: "2", entryDate: "2026-06-20", pumpedLiters: 15, fullPricePaid: 105, paymentMethod: "Pazomat" },
    // Different month, must be excluded.
    { id: "3", entryDate: "2026-07-01", pumpedLiters: 18, fullPricePaid: 126, paymentMethod: "Pazomat" },
    // Same month but Credit Card, settled at the pump, must be excluded.
    { id: "4", entryDate: "2026-06-10", pumpedLiters: 30, fullPricePaid: 210, paymentMethod: "Credit Card" },
  ];

  it("bills exactly the Pazomat transactions from two months prior", () => {
    const result = calculateUpcomingBill(transactions, 0.58, new Date(Date.UTC(2026, 7, 25))); // August 2026

    expect(result.sourceMonth).toMatchObject({ year: 2026, month: 6 });
    expect(result.billingMonth).toMatchObject({ year: 2026, month: 8 });
    expect(result.transactionCount).toBe(2);
    expect(result.transactions.map((t) => t.id)).toEqual(["1", "2"]);
    expect(result.totalLiters).toBeCloseTo(35, 2);
    expect(result.totalNetCost).toBeCloseTo(140 - 0.58 * 20 + (105 - 0.58 * 15), 2);
  });

  it("uses the given discount rate rather than a hardcoded one", () => {
    const result = calculateUpcomingBill(transactions, 0.75, new Date(Date.UTC(2026, 7, 25)));

    expect(result.totalNetCost).toBeCloseTo(140 - 0.75 * 20 + (105 - 0.75 * 15), 2);
  });

  it("rolls over the year boundary correctly (Jan bill -> prior Nov)", () => {
    const janTransactions: FuelTransaction[] = [
      { id: "5", entryDate: "2025-11-15", pumpedLiters: 25, fullPricePaid: 175, paymentMethod: "Pazomat" },
    ];
    const result = calculateUpcomingBill(janTransactions, 0.58, new Date(Date.UTC(2026, 0, 10))); // January 2026

    expect(result.sourceMonth).toMatchObject({ year: 2025, month: 11 });
    expect(result.transactionCount).toBe(1);
  });

  it("returns an empty, zeroed result when nothing matches", () => {
    const result = calculateUpcomingBill([], 0.58, new Date(Date.UTC(2026, 7, 25)));

    expect(result.transactionCount).toBe(0);
    expect(result.totalNetCost).toBe(0);
    expect(result.totalLiters).toBe(0);
  });
});
