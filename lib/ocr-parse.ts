export type ReceiptExtraction = {
  totalOdometer: number | null;
  tripDistance: number | null;
  engineTime: string | null;
  computerAvgConsumption: number | null;
  pumpedLiters: number | null;
  fullPricePaid: number | null;
};

/**
 * Parses a vision model's raw text response into a {@link ReceiptExtraction}.
 * Defensive by design: the model is instructed to return raw JSON only, but
 * real-world vision models sometimes wrap it in markdown fences or add a
 * sentence of commentary anyway, so this tolerates both.
 */
export function parseExtraction(rawContent: string): ReceiptExtraction {
  const jsonText = extractJsonObject(rawContent);

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (err) {
    console.error("Failed to parse vision model output as JSON:", rawContent, err);
    throw new Error("Vision API returned invalid JSON");
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("Vision API returned a non-object JSON value");
  }

  const record = parsed as Record<string, unknown>;

  return {
    totalOdometer: toFiniteNumberOrNull(record.totalOdometer),
    tripDistance: toFiniteNumberOrNull(record.tripDistance),
    engineTime: toTrimmedStringOrNull(record.engineTime),
    computerAvgConsumption: toFiniteNumberOrNull(record.computerAvgConsumption),
    pumpedLiters: toFiniteNumberOrNull(record.pumpedLiters),
    fullPricePaid: toFiniteNumberOrNull(record.fullPricePaid),
  };
}

/**
 * Strips optional ```json fences and grabs the first {...} block — vision
 * models sometimes wrap their output in markdown despite being told not to.
 */
function extractJsonObject(text: string): string {
  const withoutFences = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");

  const match = withoutFences.match(/\{[\s\S]*\}/);
  return match ? match[0] : withoutFences;
}

function toFiniteNumberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value.replace(/,/g, ""));
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function toTrimmedStringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}
