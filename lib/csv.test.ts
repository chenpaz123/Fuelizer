import { describe, expect, it } from "vitest";
import { fuelCyclesToCsv } from "@/lib/csv";
import type { FuelCycle } from "@/lib/types";

function makeCycle(overrides: Partial<FuelCycle> = {}): FuelCycle {
  return {
    id: "1",
    user_id: "u1",
    entry_date: "2026-06-05",
    total_odometer_km: 12345,
    trip_distance_km: 350,
    engine_time: "05:30",
    computer_avg_consumption_kml: 18.5,
    pumped_liters: 20,
    full_price_paid: 140,
    payment_method: "Pazomat",
    receipt_image_path: null,
    dashboard_image_path: null,
    estimated_range: 648,
    pump_truth_kml: 17.5,
    true_reserve_liters: 15,
    net_cost_ils: 128.4,
    created_at: "2026-06-05T00:00:00Z",
    updated_at: "2026-06-05T00:00:00Z",
    ...overrides,
  };
}

describe("fuelCyclesToCsv", () => {
  it("starts with a UTF-8 BOM so Excel detects the Hebrew encoding", () => {
    const csv = fuelCyclesToCsv([]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  it("emits the exact Hebrew header row, in order", () => {
    const csv = fuelCyclesToCsv([]);
    const headerLine = csv.slice(1).split("\r\n")[0];
    expect(headerLine).toBe(
      [
        "תאריך",
        "קילומטראז' כולל",
        "מרחק נסיעה",
        "ליטרים",
        "מחיר מלא",
        "עלות נטו",
        "צריכה ממוצעת",
        "אופן תשלום",
        "טווח משוער",
      ].join(",")
    );
  });

  it("formats a Pazomat row with the Hebrew payment-method label", () => {
    const csv = fuelCyclesToCsv([makeCycle()]);
    const dataLine = csv.slice(1).split("\r\n")[1];
    expect(dataLine).toBe("2026-06-05,12345,350,20,140,128.4,18.5,פזומט,648");
  });

  it("labels Credit Card rows in Hebrew too", () => {
    const csv = fuelCyclesToCsv([makeCycle({ payment_method: "Credit Card" })]);
    const dataLine = csv.slice(1).split("\r\n")[1];
    expect(dataLine).toContain("כרטיס אשראי");
  });

  it("renders nullable fields as empty CSV fields, not the string 'null'", () => {
    const csv = fuelCyclesToCsv([
      makeCycle({ computer_avg_consumption_kml: null, estimated_range: null, net_cost_ils: null }),
    ]);
    const dataLine = csv.slice(1).split("\r\n")[1];
    expect(dataLine).toBe("2026-06-05,12345,350,20,140,,,פזומט,");
  });

  it("returns just a header row (plus BOM) for an empty history", () => {
    const csv = fuelCyclesToCsv([]);
    const lines = csv.slice(1).split("\r\n");
    expect(lines).toHaveLength(2); // header + trailing empty string from the final \r\n
    expect(lines[1]).toBe("");
  });
});
