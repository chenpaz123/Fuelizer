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
    // The model's response can get cut off mid-object if it runs out of its
    // max_tokens budget (actions/ocr.ts) before finishing -- e.g. every
    // field present and correct except the closing `}` never arrived. Try
    // to recover whatever fields DID come through rather than discarding
    // the whole extraction and sending the user a blank form.
    const repaired = repairTruncatedJson(jsonText);
    if (repaired === undefined) {
      console.error("Failed to parse vision model output as JSON:", rawContent, err);
      throw new Error("Vision API returned invalid JSON");
    }
    console.warn(
      "Vision model output was truncated; recovered the fields that arrived before the cutoff:",
      rawContent
    );
    parsed = repaired;
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

/**
 * Recovers a usable object from JSON text that got cut off mid-generation.
 * The schema is always a flat, single-level object (see ReceiptExtraction),
 * so this only has two truncation shapes to handle -- no general-purpose
 * JSON repair needed:
 *
 * 1. Everything is complete except the final `}` never arrived -- just
 *    close it.
 * 2. The last field itself got cut off mid-value -- drop back to the last
 *    complete "key": value pair (the last top-level comma, ignoring commas
 *    inside string values) and close the object there. Any fields lost
 *    this way come back as null from toFiniteNumberOrNull/
 *    toTrimmedStringOrNull, same as if the model had never found them.
 *
 * Returns undefined (not null -- a valid parsed value in this schema, e.g.
 * `{"engineTime": null}`) if neither recovery attempt produces valid JSON.
 */
function repairTruncatedJson(text: string): unknown {
  try {
    return JSON.parse(text + "}");
  } catch {
    // fall through to the more aggressive recovery below
  }

  const lastComma = lastTopLevelComma(text);
  if (lastComma === -1) return undefined;

  try {
    return JSON.parse(text.slice(0, lastComma) + "}");
  } catch {
    return undefined;
  }
}

/** Index of the last top-level `,` in a flat JSON object's body, ignoring commas inside string values. -1 if none. */
function lastTopLevelComma(text: string): number {
  let inString = false;
  let lastComma = -1;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"' && text[i - 1] !== "\\") inString = !inString;
    else if (ch === "," && !inString) lastComma = i;
  }
  return lastComma;
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
