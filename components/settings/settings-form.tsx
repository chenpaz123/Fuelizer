"use client";

import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { upsertUserSettings } from "@/app/settings/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Status = "idle" | "saving" | "saved" | "error";

export function SettingsForm({
  initialPazomatDiscount,
  initialTankCapacity,
}: {
  initialPazomatDiscount: number;
  initialTankCapacity: number;
}) {
  const [pazomatDiscount, setPazomatDiscount] = useState(String(initialPazomatDiscount));
  const [tankCapacity, setTankCapacity] = useState(String(initialTankCapacity));
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    const discount = Number(pazomatDiscount);
    const capacity = Number(tankCapacity);

    if (!Number.isFinite(discount) || discount < 0) {
      setStatus("error");
      setError("הזינו הנחת פזומט תקינה (0 ומעלה)");
      return;
    }
    if (!Number.isFinite(capacity) || capacity <= 0) {
      setStatus("error");
      setError("הזינו נפח מיכל תקין (גדול מ-0)");
      return;
    }

    setStatus("saving");
    setError(null);

    try {
      await upsertUserSettings({
        pazomat_discount_per_liter: discount,
        tank_capacity_liters: capacity,
      });
      setStatus("saved");
      setTimeout(() => setStatus((prev) => (prev === "saved" ? "idle" : prev)), 2000);
    } catch (err) {
      console.error("Saving settings failed:", err);
      setStatus("error");
      setError("שמירת ההגדרות נכשלה. נסו שוב.");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>הגדרות תדלוק</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="pazomat_discount">הנחת פזומט לליטר (₪ לליטר)</Label>
          <Input
            id="pazomat_discount"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={pazomatDiscount}
            onChange={(e) => setPazomatDiscount(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="tank_capacity">נפח מיכל דלק (ליטר)</Label>
          <Input
            id="tank_capacity"
            type="number"
            inputMode="decimal"
            step="0.1"
            min="0"
            value={tankCapacity}
            onChange={(e) => setTankCapacity(e.target.value)}
          />
        </div>

        <Button className="w-full" onClick={handleSave} disabled={status === "saving"}>
          {status === "saving" && <Loader2 className="h-4 w-4 animate-spin" />}
          {status === "saved" && <CheckCircle2 className="h-4 w-4" />}
          {status === "saved" ? "נשמר!" : "שמור הגדרות"}
        </Button>

        {error && <p className="text-center text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
