import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  // Base gráfica: uppercase, tracking largo, sem excesso de border-radius
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-[13px] font-bold uppercase tracking-[0.1em] cursor-pointer transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:size-[17px] [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-md hover:bg-mahogany-mid active:scale-[0.98]",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90 active:scale-[0.98]",
        outline:
          "border-2 border-primary bg-transparent text-primary shadow-sm hover:bg-primary hover:text-primary-foreground active:scale-[0.98]",
        secondary: "bg-forest-soft text-mahogany hover:bg-forest/20 active:scale-[0.98]",
        ghost: "hover:bg-secondary hover:text-secondary-foreground active:scale-[0.98]",
        link: "text-primary underline-offset-4 hover:underline p-0 h-auto normal-case tracking-normal font-semibold text-[15px]",
        gold: "bg-gold text-[oklch(0.10_0.04_295)] shadow-md hover:bg-gold/90 active:scale-[0.98]",
        forest: "bg-forest text-white shadow-sm hover:bg-forest-mid active:scale-[0.98]",
        hero: "bg-gold text-[oklch(0.10_0.04_295)] shadow-xl hover:bg-gold/90 active:scale-[0.97] text-[15px] tracking-[0.12em]",
      },
      size: {
        default: "h-[52px] px-7 py-3",
        sm: "h-10 px-4 text-[12px]",
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
