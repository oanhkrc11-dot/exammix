import { InputHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "w-full rounded-[7px] border border-border bg-panel px-3 py-2 text-sm text-text placeholder:text-muted focus:outline-2 focus:outline-brand-blue",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";
