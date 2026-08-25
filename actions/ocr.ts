"use server";

import { parseExtraction, type ReceiptExtraction } from "@/lib/ocr-parse";

export type { ReceiptExtraction };

const TOGETHER_API_URL = "https://api.together.xyz/v1/chat/completions";
// Together AI periodically moves models between its pay-per-token
// "serverless" pool and paid dedicated-endpoint-only tiers (Qwen2.5-VL-72B
// was serverless, then wasn't — see the 400 "model_not_available" error if
// this one stops working too). Overridable without a redeploy: change
// TOGETHER_VISION_MODEL in Vercel's project env vars to whatever your
// account's Together dashboard (Models -> filter: Vision, Serverless)
// currently shows as serverless, then redeploy/restart.
const VISION_MODEL = process.env.TOGETHER_VISION_MODEL || "google/gemma-4-31B-it";
const REQUEST_TIMEOUT_MS = 30_000;

const SYSTEM_PROMPT = `You are a strict OCR/data-extraction engine for a car fuel-tracking app. You will be shown a photo that is EITHER a gas station receipt (often printed in Hebrew), OR a photo of a car's dashboard/trip computer, OR both in one frame.

Return ONLY a single raw JSON object — no markdown code fences, no backticks, no explanation, no text before or after it — with exactly these six keys:

{
  "totalOdometer": number | null,
  "tripDistance": number | null,
  "engineTime": string | null,
  "computerAvgConsumption": number | null,
  "pumpedLiters": number | null,
  "fullPricePaid": number | null
}

Field definitions:
- totalOdometer: the car's total lifetime odometer reading, in kilometers (plain number, e.g. 52340). Comes from the dashboard/trip computer, not the receipt.
- tripDistance: the distance driven since the trip computer was last reset, in kilometers. Comes from the dashboard/trip computer.
- engineTime: the trip computer's engine-running time, formatted as "HH:MM:SS" (or "HH:MM" if seconds aren't shown). Comes from the dashboard/trip computer.
- computerAvgConsumption: the trip computer's own average fuel consumption reading, in kilometers per liter (km/L). Comes from the dashboard/trip computer.
- pumpedLiters: the quantity of fuel pumped, in liters. Comes from the gas station receipt.
- fullPricePaid: the total amount paid, in New Israeli Shekels (₪). Comes from the gas station receipt.

Rules:
- Only extract a value if it is actually visible in the image. If a field is missing, illegible, or you are not reasonably confident, set it to null — never guess or fabricate a number.
- All numeric fields must be plain JSON numbers: no thousands separators, no units ("km", "L", "₪"), and "." as the decimal separator.
- Hebrew receipts use standard Arabic numerals (0-9) for digits — read them normally.
- Output nothing but the JSON object itself.`;

/**
 * Sends a receipt/dashboard photo to a vision-language model and returns the
 * telemetry fields it can read off it. Any field the model can't find (or
 * isn't confident about) comes back as `null` — the caller decides what to
 * do with missing values (e.g. leave the form field blank for the user).
 */
export async function extractReceiptData(imageBase64: string): Promise<ReceiptExtraction> {
  const apiKey = process.env.TOGETHER_API_KEY;
  if (!apiKey) {
    throw new Error("TOGETHER_API_KEY is not configured");
  }

  let response: Response;
  try {
    response = await fetch(TOGETHER_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: VISION_MODEL,
        temperature: 0,
        max_tokens: 512,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Extract the fuel/telemetry data from this image and return the JSON object described in the system prompt.",
              },
              { type: "image_url", image_url: { url: imageBase64 } },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    console.error("Together AI request failed:", err);
    throw new Error("Vision API request failed");
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error("Together AI returned an error:", response.status, body);
    throw new Error(`Vision API request failed (${response.status})`);
  }

  const payload = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const rawContent = payload.choices?.[0]?.message?.content;
  if (!rawContent) {
    throw new Error("Vision API returned no content");
  }

  return parseExtraction(rawContent);
}
