"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { applyTheme, readStoredTheme, subscribeThemeChange, type Theme } from "@/lib/theme";

const OPTIONS: { value: Theme; label: string; icon: LucideIcon }[] = [
  { value: "light", label: "בהיר", icon: Sun },
  { value: "dark", label: "כהה", icon: Moon },
  { value: "system", label: "מערכת", icon: Monitor },
];

function getServerTheme(): Theme {
  return "system";
}

export function ThemeToggle() {
  // useSyncExternalStore (not useState+useEffect): getServerSnapshot below
  // gives a deterministic value for the server-rendered/pre-hydration pass,
  // then React itself swaps in the real client value right after hydrating
  // — no manual "mounted" flag or setState-in-effect needed.
  const theme = useSyncExternalStore(subscribeThemeChange, readStoredTheme, getServerTheme);

  // Keeps the page in sync live if the OS theme changes while "system" is
  // selected and the tab stays open — not just on next visit.
  useEffect(() => {
    if (theme !== "system") return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => document.documentElement.classList.toggle("dark", mql.matches);
    mql.addEventListener("change", handleChange);
    return () => mql.removeEventListener("change", handleChange);
  }, [theme]);

  return (
    <div
      className="grid grid-cols-3 gap-1 rounded-2xl border border-border/60 bg-muted/40 p-1"
      role="radiogroup"
      aria-label="ערכת נושא"
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const isActive = theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => applyTheme(value)}
            className={cn(
              "flex flex-col items-center gap-1.5 rounded-xl px-2 py-2.5 text-xs font-medium transition-colors",
              isActive
                ? "bg-card text-primary shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
