import { forwardRef, ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface RotatingBorderButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  size?: "sm" | "lg";
}

export const RotatingBorderButton = forwardRef<HTMLButtonElement, RotatingBorderButtonProps>(
  ({ className, children, size = "lg", ...props }, ref) => {
    const sizes = size === "sm" ? "h-9 px-4 text-sm" : "h-12 px-7 text-base";
    return (
      <button
        ref={ref}
        {...props}
        className={cn(
          "rotating-border group relative inline-flex items-center justify-center rounded-full p-[1.5px] font-semibold tracking-tight transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50",
          className,
        )}
      >
        <span
          className={cn(
            "relative z-10 inline-flex items-center justify-center gap-2 rounded-full bg-black text-white",
            sizes,
          )}
        >
          {children}
        </span>
      </button>
    );
  },
);
RotatingBorderButton.displayName = "RotatingBorderButton";
