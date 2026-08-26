import * as React from "react";
import { cn } from "@/lib/utils";

// Hand-rolled (no Radix, matching the rest of components/ui/) rather than
// a native <input type="checkbox">, since a checkbox can't be styled as a
// pill+thumb toggle across browsers. Physical `translate-x` (not a
// logical/RTL-aware utility) is intentional: this app's <html> is always
// dir="rtl" (see app/layout.tsx), so the thumb always needs to slide left
// when checked -- there's no ltr rendering path to also support.
export function Switch({
  id,
  checked,
  onCheckedChange,
  className,
}: {
  id?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  className?: string;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        checked ? "bg-primary" : "bg-muted",
        className
      )}
    >
      <span
        className={cn(
          "absolute start-1 block h-5 w-5 rounded-full bg-card shadow-md transition-transform",
          checked && "translate-x-[-1.25rem]"
        )}
      />
    </button>
  );
}
