"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  CheckCircle2,
  Gauge,
  Loader2,
  RotateCcw,
  ScanLine,
  TriangleAlert,
  X,
  type LucideIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { resizeImageToJpeg } from "@/lib/image";
import { extractReceiptData, type ReceiptExtraction } from "@/actions/ocr";
import { createFuelCycle } from "@/app/lab/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { PaymentMethod } from "@/lib/types";

type Status = "idle" | "capturing" | "extracting" | "review" | "saving" | "done";

type SlotKey = "receipt" | "dashboard";

type CapturedImage = {
  blob: Blob;
  base64: string;
  previewUrl: string;
};

const SLOT_ORDER: SlotKey[] = ["receipt", "dashboard"];

const SLOT_META: Record<SlotKey, { label: string; icon: LucideIcon }> = {
  receipt: { label: "קבלה", icon: Camera },
  dashboard: { label: "לוח מחוונים", icon: Gauge },
};

type DraftFields = {
  entry_date: string;
  total_odometer_km: string;
  trip_distance_km: string;
  engine_time: string;
  computer_avg_consumption_kml: string;
  pumped_liters: string;
  full_price_paid: string;
  payment_method: PaymentMethod;
};

const REQUIRED_FIELD_LABELS: Partial<Record<keyof DraftFields, string>> = {
  total_odometer_km: "קילומטראז' כולל",
  trip_distance_km: "מרחק נסיעה",
  pumped_liters: "ליטרים שנשאבו",
  full_price_paid: "סכום ששולם",
};

export function ReceiptScanner({
  userId,
  lastOdometerKm,
}: {
  userId: string;
  lastOdometerKm: number | null;
}) {
  const router = useRouter();

  const [status, setStatus] = useState<Status>("idle");
  const [images, setImages] = useState<Record<SlotKey, CapturedImage | null>>({
    receipt: null,
    dashboard: null,
  });
  const [processingSlot, setProcessingSlot] = useState<SlotKey | null>(null);
  const [storagePaths, setStoragePaths] = useState<Partial<Record<SlotKey, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [extractionFailed, setExtractionFailed] = useState(false);
  const [draft, setDraft] = useState<DraftFields | null>(null);

  const hasAnyImage = images.receipt !== null || images.dashboard !== null;

  async function handleCapture(slot: SlotKey, file: File) {
    setError(null);
    setProcessingSlot(slot);

    try {
      const { blob, base64 } = await resizeImageToJpeg(file);
      const previewUrl = URL.createObjectURL(blob);
      setImages((prev) => {
        if (prev[slot]) URL.revokeObjectURL(prev[slot]!.previewUrl); // retake
        return { ...prev, [slot]: { blob, base64, previewUrl } };
      });
      setStatus((prev) => (prev === "idle" ? "capturing" : prev));
    } catch (err) {
      console.error("Resizing the photo failed:", err);
      setError("עיבוד התמונה נכשל. נסו שוב.");
    } finally {
      setProcessingSlot(null);
    }
  }

  function handleRemoveImage(slot: SlotKey) {
    setImages((prev) => {
      if (prev[slot]) URL.revokeObjectURL(prev[slot]!.previewUrl);
      return { ...prev, [slot]: null };
    });
  }

  async function handleExtract() {
    const presentSlots = SLOT_ORDER.filter((slot) => images[slot] !== null);
    if (presentSlots.length === 0) return;

    setError(null);
    setExtractionFailed(false);
    setStatus("extracting");

    const uploadedPaths: Partial<Record<SlotKey, string>> = {};
    try {
      const supabase = createClient();
      await Promise.all(
        presentSlots.map(async (slot) => {
          const image = images[slot]!;
          const path = `${userId}/${slot}-${Date.now()}-${crypto.randomUUID()}.jpg`;
          const { error: uploadError } = await supabase.storage
            .from("receipts")
            .upload(path, image.blob, { contentType: "image/jpeg" });
          if (uploadError) throw uploadError;
          uploadedPaths[slot] = path;
        })
      );
    } catch (err) {
      console.error("Photo upload failed:", err);
      setError("העלאת התמונות נכשלה. בדקו את החיבור לאינטרנט ונסו שוב.");
      setStatus("capturing");
      return;
    }

    setStoragePaths(uploadedPaths);

    try {
      const orderedBase64 = presentSlots.map((slot) => images[slot]!.base64);
      const extraction = await extractReceiptData(orderedBase64);
      setDraft(draftFromExtraction(extraction, lastOdometerKm));
    } catch (err) {
      // The photos are already safely uploaded — don't throw them away just
      // because auto-fill failed. Drop into review with a blank, fully
      // editable form instead.
      console.error("Receipt extraction failed:", err);
      setExtractionFailed(true);
      setDraft(emptyDraft());
    }
    setStatus("review");
  }

  async function handleCancel() {
    const uploadedPaths = Object.values(storagePaths).filter((p): p is string => Boolean(p));
    if (uploadedPaths.length > 0) {
      const supabase = createClient();
      await supabase.storage.from("receipts").remove(uploadedPaths);
    }
    SLOT_ORDER.forEach((slot) => {
      if (images[slot]) URL.revokeObjectURL(images[slot]!.previewUrl);
    });

    setStatus("idle");
    setImages({ receipt: null, dashboard: null });
    setStoragePaths({});
    setDraft(null);
    setError(null);
    setExtractionFailed(false);
  }

  async function handleSave() {
    if (!draft) return;

    const validationError = validateDraft(draft);
    if (validationError) {
      setError(validationError);
      return;
    }

    setStatus("saving");
    setError(null);

    try {
      await createFuelCycle({
        entry_date: draft.entry_date,
        total_odometer_km: Number(draft.total_odometer_km),
        trip_distance_km: Number(draft.trip_distance_km),
        engine_time: draft.engine_time.trim() || null,
        computer_avg_consumption_kml: draft.computer_avg_consumption_kml.trim()
          ? Number(draft.computer_avg_consumption_kml)
          : null,
        pumped_liters: Number(draft.pumped_liters),
        full_price_paid: Number(draft.full_price_paid),
        payment_method: draft.payment_method,
        receipt_image_path: storagePaths.receipt ?? null,
      });
      setStatus("done");
      setTimeout(() => router.push("/dashboard"), 1200);
    } catch (err) {
      console.error("Saving fuel cycle failed:", err);
      setError("שמירת התדלוק נכשלה. נסו שוב.");
      setStatus("review");
    }
  }

  function updateDraft<K extends keyof DraftFields>(key: K, value: DraftFields[K]) {
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  if (status === "idle" || status === "capturing") {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="space-y-4 p-5">
            <div className="space-y-1 text-center">
              <p className="font-semibold">צלמו את קבלת התדלוק ולוח המחוונים</p>
              <p className="text-sm text-muted-foreground">
                נזהה אוטומטית את הליטרים, המחיר והנתונים משתי התמונות
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {SLOT_ORDER.map((slot) => (
                <CaptureSlot
                  key={slot}
                  slot={slot}
                  image={images[slot]}
                  isProcessing={processingSlot === slot}
                  onCapture={(file) => handleCapture(slot, file)}
                  onRemove={() => handleRemoveImage(slot)}
                />
              ))}
            </div>

            <Button size="lg" className="w-full" onClick={handleExtract} disabled={!hasAnyImage}>
              <ScanLine className="h-5 w-5" />
              פענח נתונים
            </Button>
          </CardContent>
        </Card>
        {error && <p className="text-center text-sm text-destructive">{error}</p>}
      </div>
    );
  }

  if (status === "extracting") {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
          <div className="flex gap-3">
            {SLOT_ORDER.filter((slot) => images[slot]).map((slot) => (
              <ReceiptThumbnail
                key={slot}
                src={images[slot]!.previewUrl}
                className="h-20 w-20 rounded-xl object-cover shadow-md"
              />
            ))}
          </div>
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="font-medium">מפענח נתונים…</p>
        </CardContent>
      </Card>
    );
  }

  if ((status === "review" || status === "saving") && draft) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="space-y-4 p-5">
            <div className="flex justify-center gap-3">
              {SLOT_ORDER.filter((slot) => images[slot]).map((slot) => (
                <ReceiptThumbnail
                  key={slot}
                  src={images[slot]!.previewUrl}
                  className="h-24 w-24 rounded-2xl object-cover shadow-md"
                />
              ))}
            </div>

            {extractionFailed ? (
              <p className="flex items-center justify-center gap-2 text-center text-sm text-amber-600">
                <TriangleAlert className="h-4 w-4 shrink-0" />
                לא הצלחנו לזהות את הנתונים אוטומטית — מלאו את הפרטים ידנית
              </p>
            ) : (
              <p className="text-center text-sm text-muted-foreground">
                בדקו שהנתונים נכונים ותקנו במידת הצורך
              </p>
            )}

            <Field
              id="entry_date"
              label="תאריך"
              type="date"
              value={draft.entry_date}
              onChange={(v) => updateDraft("entry_date", v)}
            />
            <Field
              id="total_odometer_km"
              label="קילומטראז' כולל"
              type="number"
              inputMode="decimal"
              value={draft.total_odometer_km}
              onChange={(v) => updateDraft("total_odometer_km", v)}
            />
            <Field
              id="trip_distance_km"
              label="מרחק נסיעה"
              type="number"
              inputMode="decimal"
              value={draft.trip_distance_km}
              onChange={(v) => updateDraft("trip_distance_km", v)}
            />
            <Field
              id="engine_time"
              label="זמן פעולת מנוע"
              type="text"
              placeholder="01:23"
              maxLength={5}
              value={draft.engine_time}
              onChange={(v) => updateDraft("engine_time", v)}
            />
            <Field
              id="computer_avg_consumption_kml"
              label="צריכה ממוצעת (מחשב הרכב)"
              type="number"
              inputMode="decimal"
              value={draft.computer_avg_consumption_kml}
              onChange={(v) => updateDraft("computer_avg_consumption_kml", v)}
            />
            <Field
              id="pumped_liters"
              label="ליטרים שנשאבו"
              type="number"
              inputMode="decimal"
              value={draft.pumped_liters}
              onChange={(v) => updateDraft("pumped_liters", v)}
            />
            <Field
              id="full_price_paid"
              label="סכום ששולם (₪)"
              type="number"
              inputMode="decimal"
              value={draft.full_price_paid}
              onChange={(v) => updateDraft("full_price_paid", v)}
            />

            <div className="space-y-2">
              <Label htmlFor="payment_method">אמצעי תשלום</Label>
              <Select
                id="payment_method"
                value={draft.payment_method}
                onChange={(e) => updateDraft("payment_method", e.target.value as PaymentMethod)}
              >
                <option value="Pazomat">פזומט</option>
                <option value="Credit Card">כרטיס אשראי</option>
              </Select>
            </div>
          </CardContent>
        </Card>

        {error && <p className="text-center text-sm text-destructive">{error}</p>}

        <div className="flex gap-3">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={handleCancel}
            disabled={status === "saving"}
          >
            <RotateCcw className="h-4 w-4" />
            ביטול
          </Button>
          <Button className="flex-1" onClick={handleSave} disabled={status === "saving"}>
            {status === "saving" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            שמור תדלוק
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
        <CheckCircle2 className="h-10 w-10 text-primary" />
        <p className="font-semibold">התדלוק נשמר בהצלחה!</p>
      </CardContent>
    </Card>
  );
}

function CaptureSlot({
  slot,
  image,
  isProcessing,
  onCapture,
  onRemove,
}: {
  slot: SlotKey;
  image: CapturedImage | null;
  isProcessing: boolean;
  onCapture: (file: File) => void;
  onRemove: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { label, icon: Icon } = SLOT_META[slot];

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = ""; // allow re-selecting the same file again later
          if (file) onCapture(file);
        }}
      />

      {image ? (
        <div className="relative">
          <ReceiptThumbnail
            src={image.previewUrl}
            className="aspect-square w-full rounded-2xl object-cover shadow-md"
          />
          <button
            type="button"
            onClick={onRemove}
            aria-label={`הסר את תמונת ה${label}`}
            className="absolute -top-2 -end-2 flex h-7 w-7 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-md"
          >
            <X className="h-4 w-4" />
          </button>
          <p className="mt-2 text-center text-xs font-medium text-muted-foreground">{label}</p>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isProcessing}
          className={cn(
            "flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-muted/30 px-2 text-center transition-colors",
            "hover:bg-muted/50 disabled:opacity-50"
          )}
        >
          {isProcessing ? (
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          ) : (
            <Icon className="h-7 w-7 text-primary" />
          )}
          <span className="text-sm font-medium">צלם {label}</span>
        </button>
      )}
    </div>
  );
}

function draftFromExtraction(extraction: ReceiptExtraction, lastOdometerKm: number | null): DraftFields {
  return {
    entry_date: new Date().toISOString().slice(0, 10),
    total_odometer_km: numberOrFallback(extraction.totalOdometer, lastOdometerKm),
    trip_distance_km: numberOrEmpty(extraction.tripDistance),
    engine_time: extraction.engineTime ?? "",
    computer_avg_consumption_kml: numberOrEmpty(extraction.computerAvgConsumption),
    pumped_liters: numberOrEmpty(extraction.pumpedLiters),
    full_price_paid: numberOrEmpty(extraction.fullPricePaid),
    payment_method: "Credit Card",
  };
}

function emptyDraft(): DraftFields {
  return {
    entry_date: new Date().toISOString().slice(0, 10),
    total_odometer_km: "",
    trip_distance_km: "",
    engine_time: "",
    computer_avg_consumption_kml: "",
    pumped_liters: "",
    full_price_paid: "",
    payment_method: "Credit Card",
  };
}

function numberOrEmpty(value: number | null): string {
  return value != null ? String(value) : "";
}

/** Falls back to the last logged odometer reading if the model didn't find one. */
function numberOrFallback(value: number | null, fallback: number | null): string {
  if (value != null) return String(value);
  return fallback != null ? String(fallback) : "";
}

function validateDraft(draft: DraftFields): string | null {
  for (const [key, label] of Object.entries(REQUIRED_FIELD_LABELS) as [
    keyof DraftFields,
    string,
  ][]) {
    const raw = draft[key];
    if (typeof raw !== "string" || raw.trim() === "" || !Number.isFinite(Number(raw))) {
      return `השדה "${label}" חסר או לא תקין`;
    }
  }
  return null;
}

function ReceiptThumbnail({ src, className }: { src: string; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- local blob: preview URL, not an optimizable remote/static asset
  return <img src={src} alt="תמונה שצולמה" className={className} />;
}

function Field({
  id,
  label,
  value,
  onChange,
  ...props
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "id">) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} {...props} />
    </div>
  );
}
