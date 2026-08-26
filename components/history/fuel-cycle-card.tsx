"use client";

import { useState } from "react";
import Image from "next/image";
import { CheckCircle2, Loader2, Trash2 } from "lucide-react";
import { deleteFuelCycle } from "@/app/history/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { FuelCycle } from "@/lib/types";

export type ImageInfo = { label: string; signedUrl: string };

export function FuelCycleCard({
  cycle,
  receiptImage,
  dashboardImage,
}: {
  cycle: FuelCycle;
  receiptImage: ImageInfo | null;
  dashboardImage: ImageInfo | null;
}) {
  const [previewImage, setPreviewImage] = useState<ImageInfo | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isRemoved, setIsRemoved] = useState(false);

  if (isRemoved) return null;

  async function handleDelete() {
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await deleteFuelCycle(cycle.id);
      setIsRemoved(true);
    } catch (err) {
      console.error("Deleting fuel cycle failed:", err);
      setDeleteError("מחיקת התדלוק נכשלה. נסו שוב.");
      setIsDeleting(false);
    }
  }

  const dateLabel = new Date(cycle.entry_date).toLocaleDateString("he-IL", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const paymentLabel = cycle.payment_method === "Pazomat" ? "פזומט" : "אשראי";

  return (
    <>
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center justify-between">
            <p className="font-semibold">{dateLabel}</p>
            <span
              className={cn(
                "rounded-full px-2.5 py-1 text-xs font-medium",
                cycle.payment_method === "Pazomat"
                  ? "bg-primary/10 text-primary"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {paymentLabel}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <Stat label="מרחק נסיעה" value={`${cycle.trip_distance_km.toLocaleString("he-IL")} ק"מ`} />
            <Stat
              label="קילומטראז' כולל"
              value={`${cycle.total_odometer_km.toLocaleString("he-IL")} ק"מ`}
            />
            <Stat
              label="אמת המשאבה"
              value={cycle.pump_truth_kml != null ? `${cycle.pump_truth_kml.toFixed(2)} ק"מ/ליטר` : "—"}
            />
            <Stat
              label="מחשב הרכב"
              value={
                cycle.computer_avg_consumption_kml != null
                  ? `${cycle.computer_avg_consumption_kml.toFixed(2)} ק"מ/ליטר`
                  : "—"
              }
            />
          </div>

          <div className="flex items-center justify-between border-t border-border pt-3">
            <p className="text-lg font-bold tabular-nums">
              {cycle.net_cost_ils != null ? `₪${cycle.net_cost_ils.toFixed(2)}` : "—"}
            </p>

            <div className="flex items-center gap-2">
              {receiptImage && <Thumbnail image={receiptImage} onClick={() => setPreviewImage(receiptImage)} />}
              {dashboardImage && (
                <Thumbnail image={dashboardImage} onClick={() => setPreviewImage(dashboardImage)} />
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setConfirmingDelete(true)}
                aria-label="מחק תדלוק"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={previewImage !== null} onClose={() => setPreviewImage(null)}>
        {previewImage && (
          <div className="space-y-3">
            <p className="text-center text-sm font-medium text-muted-foreground">{previewImage.label}</p>
            <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-muted">
              <Image
                src={previewImage.signedUrl}
                alt={previewImage.label}
                fill
                sizes="384px"
                className="object-contain"
                unoptimized
              />
            </div>
          </div>
        )}
      </Dialog>

      <Dialog open={confirmingDelete} onClose={() => setConfirmingDelete(false)}>
        <div className="space-y-4 text-center">
          <p className="font-semibold">למחוק את התדלוק?</p>
          <p className="text-sm text-muted-foreground">
            הפעולה תמחק גם את התמונות המשויכות אליו ולא ניתנת לביטול.
          </p>
          {deleteError && <p className="text-sm text-destructive">{deleteError}</p>}
          <div className="flex gap-3">
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={() => setConfirmingDelete(false)}
              disabled={isDeleting}
            >
              ביטול
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="flex-1"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              מחק
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium tabular-nums">{value}</p>
    </div>
  );
}

function Thumbnail({ image, onClick }: { image: ImageInfo; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`הצג את ה${image.label}`}
      className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted"
    >
      <Image src={image.signedUrl} alt={image.label} fill sizes="40px" className="object-cover" unoptimized />
    </button>
  );
}
