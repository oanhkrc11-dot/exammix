"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { EmojiIcon } from "@/components/atoms";
import { cn } from "@/lib/utils";

/** [r,g,b] accent pair, re-extracted per-page from legacy nav icon badges
 * (`--m1`/`--m2` custom properties on `.nav button[data-page="..."]`). */
export type NavAccent = [string, string];

export function NavItem({
  href,
  glyph,
  label,
  accent = ["34,211,238", "32,164,255"],
}: {
  href: string;
  glyph: string;
  label: string;
  accent?: NavAccent;
}) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);
  const [a, b] = accent;

  return (
    <Link
      href={href}
      className={cn(
        "group flex items-center gap-3 rounded-[12px] px-3 py-2.5 text-[15px] font-semibold transition-[background,transform,box-shadow] duration-200",
        active
          ? "text-white shadow-[0_11px_26px_rgba(32,164,255,.32),inset_0_1px_0_rgba(255,255,255,.3)]"
          : "text-muted hover:translate-x-0.5 hover:bg-white/[0.06] hover:text-white",
      )}
      style={
        active
          ? {
              backgroundImage: "linear-gradient(90deg, rgba(47,125,246,.22), rgba(25,194,215,.09))",
              borderColor: "rgba(86,157,255,.26)",
            }
          : undefined
      }
    >
      <span
        className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-[8px] text-sm"
        style={{
          background: active
            ? "rgba(255,255,255,.16)"
            : `linear-gradient(145deg, rgba(${a},.36), rgba(${b},.18))`,
          boxShadow: active ? undefined : `0 5px 14px rgba(${a},.18)`,
        }}
      >
        <EmojiIcon glyph={glyph} />
      </span>
      <span className="flex-1">{label}</span>
      {active ? <span className="h-2 w-2 shrink-0 rounded-full bg-white/90" /> : null}
    </Link>
  );
}
