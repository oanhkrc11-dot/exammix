import { ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "blue" | "green" | "orange" | "red" | "gray";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  blue: "bg-brand-blue hover:bg-brand-blue-deep text-white",
  green: "bg-success hover:brightness-95 text-white",
  orange: "bg-brand-orange hover:brightness-95 text-white",
  red: "bg-danger hover:bg-danger-strong text-white",
  gray: "bg-panel-2 hover:brightness-95 text-text border border-border",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

// Mirrors the legacy .btn / .btn-{blue|green|orange|red|gray} flat-fill
// buttons: bold text, 7px radius, soft shadow.
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "blue", className, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-[7px] px-4 py-2 text-sm font-semibold shadow-[var(--shadow-soft)] transition disabled:cursor-not-allowed disabled:opacity-60",
        VARIANT_CLASSES[variant],
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = "Button";
