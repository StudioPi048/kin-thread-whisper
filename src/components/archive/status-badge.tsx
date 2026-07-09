import React from "react";
import { cn } from "@/lib/utils";

interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: "positive" | "warning" | "critical" | "neutral" | "info";
  variant?: "solid" | "outline" | "soft";
}

export function StatusBadge({
  className,
  status,
  variant = "soft",
  children,
  ...props
}: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-sans font-bold uppercase tracking-wider",
        {
          // Soft Variants
          "bg-clinical-positive/10 text-clinical-positive": status === "positive" && variant === "soft",
          "bg-clinical-warning/10 text-clinical-warning": status === "warning" && variant === "soft",
          "bg-clinical-critical/10 text-clinical-critical": status === "critical" && variant === "soft",
          "bg-muted text-muted-foreground": status === "neutral" && variant === "soft",
          "bg-blue-500/10 text-blue-700 dark:text-blue-400": status === "info" && variant === "soft",
          
          // Solid Variants
          "bg-clinical-positive text-white": status === "positive" && variant === "solid",
          "bg-clinical-warning text-white": status === "warning" && variant === "solid",
          "bg-clinical-critical text-white": status === "critical" && variant === "solid",
          "bg-foreground text-background": status === "neutral" && variant === "solid",
          "bg-blue-600 text-white": status === "info" && variant === "solid",
          
          // Outline Variants
          "border border-clinical-positive text-clinical-positive": status === "positive" && variant === "outline",
          "border border-clinical-warning text-clinical-warning": status === "warning" && variant === "outline",
          "border border-clinical-critical text-clinical-critical": status === "critical" && variant === "outline",
          "border border-border text-muted-foreground": status === "neutral" && variant === "outline",
          "border border-blue-500 text-blue-700 dark:text-blue-400": status === "info" && variant === "outline",
        },
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
