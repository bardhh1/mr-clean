import * as React from "react";
import { Slot } from "@/components/ui/slot";
import { cn } from "@/lib/utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "secondary" | "outline" | "ghost" | "destructive";
  size?: "default" | "sm" | "lg" | "icon";
  asChild?: boolean;
};

const variants = {
  default: "bg-primary text-primary-foreground shadow-sm hover:bg-[#185f7d] active:bg-[#124b64]",
  secondary: "bg-secondary text-secondary-foreground hover:bg-[#d5edf5] active:bg-[#c4e4ee]",
  outline: "border border-input bg-card hover:border-foreground/40 hover:bg-muted/60",
  ghost: "hover:bg-muted active:bg-muted/80",
  destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90"
};

const sizes = {
  default: "h-11 px-4 py-2",
  sm: "h-10 px-3 text-sm",
  lg: "h-12 px-5 text-base",
  icon: "h-11 w-11"
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-md text-sm font-semibold transition-colors duration-200 disabled:pointer-events-none disabled:opacity-50",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          variants[variant],
          sizes[size],
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
