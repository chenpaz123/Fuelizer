"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { FuelCycle } from "@/lib/types";

export function ConsumptionChart({ cycles }: { cycles: FuelCycle[] }) {
  const data = cycles.map((c) => ({
    date: new Date(c.entry_date).toLocaleDateString("he-IL", { day: "2-digit", month: "short" }),
    computer: c.computer_avg_consumption_kml,
    pumpTruth: c.pump_truth_kml,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>צריכה: מחשב הרכב מול אמת המשאבה</CardTitle>
      </CardHeader>
      <CardContent className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              dataKey="date"
              fontSize={12}
              tickLine={false}
              tick={{ fill: "hsl(var(--muted-foreground))" }}
            />
            <YAxis
              fontSize={12}
              tickLine={false}
              width={32}
              orientation="right"
              tick={{ fill: "hsl(var(--muted-foreground))" }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                borderColor: "hsl(var(--border))",
                borderRadius: "0.75rem",
                color: "hsl(var(--card-foreground))",
              }}
              labelStyle={{ color: "hsl(var(--card-foreground))" }}
            />
            <Legend wrapperStyle={{ color: "hsl(var(--foreground))" }} />
            <Line type="monotone" dataKey="computer" name="מחשב הרכב" stroke="#94a3b8" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="pumpTruth" name="אמת המשאבה" stroke="hsl(217 91% 60%)" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
