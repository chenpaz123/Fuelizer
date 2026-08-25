"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { GoogleIcon } from "@/components/icons/google-icon";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    searchParams.get("error") ? "ההתחברות נכשלה. נסו שוב." : null
  );

  async function handleGoogleSignIn() {
    setIsLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
        queryParams: { prompt: "select_account" },
      },
    });

    if (error) {
      setError(error.message);
      setIsLoading(false);
    }
    // בהצלחה, Supabase כבר מעביר את הדפדפן ל-Google — אין צורך בפעולה נוספת כאן.
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col items-center gap-6 py-16 text-center">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">ברוכים הבאים ל-Fuelizer</h1>
        <p className="text-sm text-muted-foreground">
          מעקב תדלוקים, טלמטריה וחיוב עבור הקיה פיקנטו שלכם
        </p>
      </div>

      <Button
        type="button"
        variant="outline"
        size="lg"
        className="w-full"
        onClick={handleGoogleSignIn}
        disabled={isLoading}
      >
        <GoogleIcon className="h-4 w-4" />
        {isLoading ? "מעביר אתכם ל-Google…" : "התחברות עם Google"}
      </Button>

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
