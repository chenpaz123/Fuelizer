import { redirect } from "next/navigation";
import { Download } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { MonthlyHistoryView } from "@/components/history/monthly-history-view";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { FuelCycle } from "@/lib/types";

// Long enough for a single browsing session; regenerated fresh on every
// page load, so there's no need for these to live longer than that.
const SIGNED_URL_TTL_SECONDS = 60 * 60;

export default async function HistoryPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data, error } = await supabase
    .from("fuel_cycles")
    .select("*")
    .order("entry_date", { ascending: false });

  if (error) {
    return <p className="text-sm text-destructive">טעינת ההיסטוריה נכשלה: {error.message}</p>;
  }

  const cycles = (data ?? []) as FuelCycle[];
  const signedUrlByPath = await signImagePaths(supabase, cycles);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">היסטוריית תדלוקים</h1>
        {cycles.length > 0 && (
          // Plain <a>, not next/link: this navigates to a file download
          // (app/history/export/route.ts), not another page in the app.
          <a href="/history/export" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            <Download className="h-4 w-4" />
            ייצא לאקסל (CSV)
          </a>
        )}
      </div>

      <MonthlyHistoryView cycles={cycles} signedUrlByPath={Object.fromEntries(signedUrlByPath)} />
    </div>
  );
}

/** Batch-signs every distinct receipt/dashboard image path across `rows` in one call. */
async function signImagePaths(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rows: FuelCycle[]
): Promise<Map<string, string>> {
  const paths = Array.from(
    new Set(
      rows.flatMap((c) => [c.receipt_image_path, c.dashboard_image_path]).filter((p): p is string => Boolean(p))
    )
  );

  const signedUrlByPath = new Map<string, string>();
  if (paths.length === 0) return signedUrlByPath;

  const { data: signed, error: signError } = await supabase.storage
    .from("receipts")
    .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);

  if (signError) {
    console.error("Failed to sign history image URLs:", signError);
    return signedUrlByPath;
  }

  for (const entry of signed) {
    if (entry.path && entry.signedUrl && !entry.error) {
      signedUrlByPath.set(entry.path, entry.signedUrl);
    }
  }
  return signedUrlByPath;
}
