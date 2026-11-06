import { cn } from "@/lib/utils";

type BadgeTone = "blue" | "green" | "orange" | "red" | "gray";

const TONE_CLASSES: Record<BadgeTone, string> = {
  blue: "bg-brand-blue/10 text-brand-blue-deep",
  green: "bg-success/10 text-success",
  orange: "bg-brand-orange/10 text-brand-orange",
  red: "bg-danger/10 text-danger",
  gray: "bg-panel-2 text-muted",
};

export function Badge({
  tone = "gray",
  children,
  className,
}: {
  tone?: BadgeTone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[999px] px-2.5 py-0.5 text-xs font-semibold",
        TONE_CLASSES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
