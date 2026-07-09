import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          // Estilo de formulário impresso antigo: apenas borda inferior
          "flex h-[42px] w-full rounded-none border-0 border-b-2 border-border/60 bg-transparent px-2 text-[16px] font-medium text-ink transition-all duration-300",
          "placeholder:text-ink/30 placeholder:font-serif placeholder:italic",
          "focus-visible:outline-none focus-visible:border-forest focus-visible:bg-[#EFE9E0]/50",
          "hover:border-forest/50",
          "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-transparent disabled:border-dashed",
          "file:border-0 file:bg-transparent file:text-[14px] file:font-semibold file:text-ink",
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
