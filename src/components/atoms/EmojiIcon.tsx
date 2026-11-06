import { cn } from "@/lib/utils";

// The legacy app has no icon library — nav/section icons are plain Unicode
// emoji glyphs in a <span>. Kept as-is for visual parity.
export function EmojiIcon({
  glyph,
  className,
}: {
  glyph: string;
  className?: string;
}) {
  return (
    <span className={cn("inline-block w-5 text-center", className)} aria-hidden="true">
      {glyph}
    </span>
  );
}
