import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { signOutAction } from "./actions";
import { SettingsForm } from "@/components/settings/settings-form";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DEFAULT_PAZOMAT_DISCOUNT_PER_LITER, DEFAULT_TANK_CAPACITY_LITERS } from "@/lib/settings";

export default async function SettingsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: settings } = await supabase
    .from("user_settings")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">הגדרות</h1>

      <SettingsForm
        initialPazomatDiscount={settings?.pazomat_discount_per_liter ?? DEFAULT_PAZOMAT_DISCOUNT_PER_LITER}
        initialTankCapacity={settings?.tank_capacity_liters ?? DEFAULT_TANK_CAPACITY_LITERS}
      />

      <Card>
        <CardHeader>
          <CardTitle>ערכת נושא</CardTitle>
        </CardHeader>
        <CardContent>
          <ThemeToggle />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>חשבון</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">מחוברים עם</p>
            <p className="font-medium">{user.email}</p>
          </div>

          <form action={signOutAction}>
            <Button type="submit" variant="destructive" className="w-full">
              <LogOut className="h-4 w-4" />
              התנתק
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
