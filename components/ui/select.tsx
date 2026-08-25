import * as React from "react";
import { cn } from "@/lib/utils";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        "flex h-12 w-full rounded-2xl border border-border/60 bg-muted/40 px-4 text-base outline-none ring-primary/40 focus-visible:ring-2",
        className
      )}
      {...props}
    />
  )
);
Select.displayName = "Select";
