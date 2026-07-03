import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          // Altura mínima 52px, texto 16px — nunca abaixo disso para 40+
          "flex h-[52px] w-full rounded-xl border-2 border-input bg-card px-4 py-3 text-[16px] font-medium text-foreground shadow-sm transition-all duration-150",
          "placeholder:text-muted-foreground/60 placeholder:font-normal",
          "focus-visible:outline-none focus-visible:border-gold focus-visible:ring-2 focus-visible:ring-gold/20",
          "hover:border-primary/40",
          "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-muted",
          "file:border-0 file:bg-transparent file:text-[15px] file:font-semibold file:text-foreground",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
