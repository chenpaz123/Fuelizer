import { WifiOff } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

// Served by public/sw.js when a page navigation fails and isn't already
// cached. No data fetching here on purpose — it has to render with zero
// network access.
export default function OfflinePage() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <Card className="w-full">
        <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <WifiOff className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="font-semibold">אין חיבור לאינטרנט</p>
          <p className="text-sm text-muted-foreground">
            הדף הזה עדיין לא נשמר לצפייה לא מקוונת. בדקו את החיבור ונסו שוב.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
