"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { FuelCycle } from "@/lib/types";

export function ConsumptionChart({ cycles }: { cycles: FuelCycle[] }) {
  const data = cycles.map((c) => ({
    date: new Date(c.entry_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
    computer: c.computer_avg_consumption_kml,
    pumpTruth: c.pump_truth_kml,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Computer vs. Pump Truth (km/L)</CardTitle>
      </CardHeader>
      <CardContent className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="date" fontSize={12} tickLine={false} />
            <YAxis fontSize={12} tickLine={false} width={32} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="computer" name="Car Computer" stroke="#94a3b8" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="pumpTruth" name="Pump Truth" stroke="hsl(217 91% 60%)" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
