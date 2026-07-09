import React from "react";
import { cn } from "@/lib/utils";

interface ClinicalPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  accent?: "mahogany" | "forest" | "gold" | "none";
}

export function ClinicalPanel({
  className,
  accent = "none",
  children,
  ...props
}: ClinicalPanelProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border bg-card/60 backdrop-blur-sm shadow-sm overflow-hidden flex flex-col",
        {
          "border-border": accent === "none",
          "border-mahogany/30": accent === "mahogany",
          "border-forest/30": accent === "forest",
          "border-gold/30": accent === "gold",
        },
        className
      )}
      {...props}
    >
      {/* Faixa superior decorativa se tiver acento */}
      {accent !== "none" && (
        <div
          className={cn("h-1 w-full shrink-0", {
            "bg-mahogany": accent === "mahogany",
            "bg-forest": accent === "forest",
            "bg-gold": accent === "gold",
          })}
        />
      )}
      {children}
    </div>
  );
}

export function ClinicalPanelHeader({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("px-5 py-4 border-b border-border/40 flex items-center justify-between gap-4 bg-muted/20", className)} {...props}>
      {children}
    </div>
  );
}

export function ClinicalPanelTitle({ className, children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h4 className={cn("text-lg font-sans font-bold uppercase tracking-wider text-primary", className)} {...props}>
      {children}
    </h4>
  );
}

export function ClinicalPanelContent({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("p-5 flex-1 flex flex-col min-h-0", className)} {...props}>
      {children}
    </div>
  );
}
