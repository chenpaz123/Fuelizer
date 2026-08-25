import * as React from "react";
import { cn } from "@/lib/utils";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        "flex h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none ring-primary/40 focus-visible:ring-2",
        className
      )}
      {...props}
    />
  )
);
Select.displayName = "Select";
