import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fuelCyclesToCsv } from "@/lib/csv";
import type { FuelCycle } from "@/lib/types";

/**
 * Streams the signed-in user's fuel_cycles as a CSV download. A plain Route
 * Handler rather than a Server Action, since a Server Action can't hand back
 * a file with Content-Disposition — the browser needs an actual navigable
 * URL to download from (see the "ייצא לאקסל" link in app/history/page.tsx).
 */
export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("fuel_cycles")
    .select("*")
    .order("entry_date", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const csv = fuelCyclesToCsv((data ?? []) as FuelCycle[]);
  const filename = `fuelizer-history-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
