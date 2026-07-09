import React from "react";
import { cn } from "@/lib/utils";

interface SectionTitleProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  action?: React.ReactNode;
}

export function SectionTitle({
  className,
  title,
  subtitle,
  eyebrow,
  action,
  ...props
}: SectionTitleProps) {
  return (
    <div className={cn("flex flex-col md:flex-row md:items-end justify-between gap-4 section-spacing", className)} {...props}>
      <div className="flex flex-col gap-2">
        {eyebrow && (
          <span className="font-sans text-sm font-bold uppercase tracking-widest text-gold">
            {eyebrow}
          </span>
        )}
        <h2 className="text-4xl md:text-5xl font-serif font-bold text-primary tracking-tight leading-none">
          {title}
        </h2>
        {subtitle && (
          <p className="text-lg md:text-xl font-serif text-muted-foreground mt-2 max-w-2xl leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>
      {action && (
        <div className="shrink-0 flex items-center gap-3">
          {action}
        </div>
      )}
    </div>
  );
}
