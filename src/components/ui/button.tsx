import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  // Base gráfica: serif, uppercase, bordas retas (rounded-sm)
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sm border border-transparent font-serif text-[16px] uppercase tracking-[0.15em] cursor-pointer transition-all duration-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-forest focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:size-[16px] [&_svg]:shrink-0 [&_svg]:stroke-[1.5]",
  {
    variants: {
      variant: {
        default: "bg-forest text-white shadow-dossier hover:bg-forest-mid active:scale-[0.98]",
        destructive:
          "bg-clinical-critical text-white shadow-dossier hover:opacity-90 active:scale-[0.98]",
        outline:
          "border border-[#D4C3A3] bg-transparent text-primary shadow-sm hover:bg-[#FAF8F5] active:scale-[0.98]",
        secondary: "bg-[#EFE9E0] text-forest hover:bg-[#D4C3A3] active:scale-[0.98]",
        ghost: "hover:bg-[#FAF8F5] text-primary active:scale-[0.98]",
        link: "text-primary hover:text-gold p-0 h-auto normal-case tracking-normal font-serif italic text-[16px]",
        gold: "bg-gold text-forest shadow-dossier hover:bg-gold-soft active:scale-[0.98]",
        forest: "bg-forest text-white shadow-dossier hover:bg-forest-mid active:scale-[0.98]",
        hero: "bg-[#1B241C] text-white border border-white/20 shadow-dossier hover:bg-black active:scale-[0.97] text-[14px] tracking-[0.2em]",
      },
      size: {
        default: "h-[52px] px-7 py-3",
        sm: "h-10 px-4 text-[16px]",
        lg: "h-[58px] px-10 text-[14px]",
        xl: "h-16 px-14 text-[15px]",
        icon: "h-[52px] w-[52px]",
        "icon-sm": "h-10 w-10 rounded-md",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
