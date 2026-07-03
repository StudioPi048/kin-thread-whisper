import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  // Base — tamanho mínimo 52px de altura, texto 15px, espaçados para 40+
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-[15px] font-semibold cursor-pointer transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-[18px] [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-md hover:bg-primary/90 active:scale-[0.98]",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90 active:scale-[0.98]",
        outline:
          "border-2 border-primary bg-transparent text-primary shadow-sm hover:bg-primary hover:text-primary-foreground active:scale-[0.98]",
        secondary:
          "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80 active:scale-[0.98]",
        ghost:
          "hover:bg-accent hover:text-accent-foreground active:scale-[0.98]",
        link:
          "text-primary underline-offset-4 hover:underline p-0 h-auto",
        gold:
          "bg-gold text-[oklch(0.15_0.02_240)] shadow-md hover:bg-gold/90 active:scale-[0.98] tracking-wide",
        hero:
          "bg-primary text-primary-foreground shadow-lg hover:bg-navy-mid active:scale-[0.98] font-serif text-lg tracking-wide",
        forest:
          "bg-forest text-white shadow-sm hover:bg-forest/90 active:scale-[0.98]",
      },
      size: {
        default: "h-[52px] px-6 py-3",
        sm:      "h-10 rounded-md px-4 text-[13px]",
        lg:      "h-[56px] rounded-xl px-10 text-base",
        xl:      "h-16 rounded-xl px-12 text-lg",
        icon:    "h-[52px] w-[52px]",
        "icon-sm": "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
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
