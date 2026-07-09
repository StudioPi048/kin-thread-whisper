import React from "react";
import { cn } from "@/lib/utils";

interface ArchiveCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "glass" | "solid" | "paper";
  elevation?: "none" | "sm" | "md" | "lg";
}

export function ArchiveCard({
  className,
  variant = "paper",
  elevation = "md",
  children,
  ...props
}: ArchiveCardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl transition-all duration-300",
        {
          "bg-archive-doc border border-border texture-paper": variant === "paper",
          "glass-card": variant === "glass",
          "bg-card border border-border": variant === "solid",
          "shadow-none": elevation === "none",
          "shadow-sm": elevation === "sm",
          "shadow-dossier": elevation === "md",
          "shadow-lifted": elevation === "lg",
        },
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function ArchiveCardHeader({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("px-6 py-5 border-b border-border/50 flex flex-col space-y-1.5", className)} {...props}>
      {children}
    </div>
  );
}

export function ArchiveCardTitle({ className, children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn("text-2xl font-serif font-bold text-primary leading-tight tracking-tight", className)} {...props}>
      {children}
    </h3>
  );
}

export function ArchiveCardDescription({ className, children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("text-[15px] text-muted-foreground font-serif italic", className)} {...props}>
      {children}
    </p>
  );
}

export function ArchiveCardContent({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("p-6", className)} {...props}>
      {children}
    </div>
  );
}
