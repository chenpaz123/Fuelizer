import { describe, expect, it } from "vitest";
import { parseExtraction } from "@/lib/ocr-parse";

describe("parseExtraction", () => {
  it("parses a clean JSON object", () => {
    const result = parseExtraction(
      `{"totalOdometer": 52340, "tripDistance": 373, "engineTime": "05:12", "computerAvgConsumption": 17.1, "pumpedLiters": 31.5, "fullPricePaid": 220.96}`
    );

    expect(result).toEqual({
      totalOdometer: 52340,
      tripDistance: 373,
      engineTime: "05:12",
      computerAvgConsumption: 17.1,
      pumpedLiters: 31.5,
      fullPricePaid: 220.96,
    });
  });

  it("strips ```json markdown fences the model added despite instructions", () => {
    const result = parseExtraction(
      '```json\n{"totalOdometer": 100, "tripDistance": null, "engineTime": null, "computerAvgConsumption": null, "pumpedLiters": 30, "fullPricePaid": 210}\n```'
    );

    expect(result.totalOdometer).toBe(100);
    expect(result.pumpedLiters).toBe(30);
  });

  it("extracts the JSON object even with leading/trailing commentary", () => {
    const result = parseExtraction(
      'Here is the extracted data:\n{"totalOdometer": null, "tripDistance": null, "engineTime": null, "computerAvgConsumption": null, "pumpedLiters": 28.4, "fullPricePaid": 199.5}\nLet me know if you need anything else!'
    );

    expect(result.pumpedLiters).toBe(28.4);
    expect(result.fullPricePaid).toBe(199.5);
  });

  it("maps missing or unrecognized fields to null instead of throwing", () => {
    const result = parseExtraction(`{"pumpedLiters": 30}`);

    expect(result).toEqual({
      totalOdometer: null,
      tripDistance: null,
      engineTime: null,
      computerAvgConsumption: null,
      pumpedLiters: 30,
      fullPricePaid: null,
    });
  });

  it("coerces numeric strings (including thousands separators) to numbers", () => {
    const result = parseExtraction(
      `{"totalOdometer": "52,340", "tripDistance": "373.5", "pumpedLiters": null, "fullPricePaid": null}`
    );

    expect(result.totalOdometer).toBe(52340);
    expect(result.tripDistance).toBe(373.5);
  });

  it("treats an empty engineTime string as null", () => {
    const result = parseExtraction(`{"engineTime": "  "}`);
    expect(result.engineTime).toBeNull();
  });

  it("throws on unparseable content", () => {
    expect(() => parseExtraction("not json at all")).toThrow();
  });

  it("throws when the JSON top level is null", () => {
    expect(() => parseExtraction("null")).toThrow();
  });

  it("treats a JSON array as an object with no matching keys, returning all nulls", () => {
    // typeof [] === "object", so this doesn't hit the non-object guard — it
    // just finds none of the expected keys and falls through to nulls.
    expect(parseExtraction("[1, 2, 3]")).toEqual({
      totalOdometer: null,
      tripDistance: null,
      engineTime: null,
      computerAvgConsumption: null,
      pumpedLiters: null,
      fullPricePaid: null,
    });
  });
});
