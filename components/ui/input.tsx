import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        // text-base (16px), not text-sm, so iOS Safari doesn't zoom in on focus.
        "flex h-12 w-full rounded-2xl border border-border/60 bg-muted/40 px-4 text-base outline-none ring-primary/40 focus-visible:ring-2",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";
