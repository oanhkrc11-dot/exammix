import { cn } from "@/lib/utils";

export function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-[18px] border border-border bg-panel p-5 shadow-[var(--shadow-soft)]",
        className,
      )}
    >
      {children}
    </div>
  );
}
