"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/lib/nav-items";
import { signOut } from "@/features/auth/actions";

function useClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    // Clock requires the client; SSR renders a placeholder to avoid a
    // hydration-time mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000 * 30);
    return () => clearInterval(id);
  }, []);
  return now;
}

export function Topbar() {
  const pathname = usePathname();
  const now = useClock();
  const current = NAV_ITEMS.find((n) => pathname === n.href || pathname.startsWith(`${n.href}/`));

  return (
    <header
      className="flex items-center justify-between px-4 py-3 md:px-6"
      style={{ backgroundImage: "linear-gradient(#07111f 72%, transparent)" }}
    >
      <div className="flex items-center gap-2.5">
        <span className="h-2 w-2 rounded-full bg-success shadow-[0_0_0_3px_rgba(34,197,94,.18)]" />
        <div>
          <div className="text-[13px] font-extrabold uppercase tracking-wide text-text">
            ExamMix Pro · Teaching Studio
          </div>
          <div className="text-xs text-muted">{current?.label ?? "Sẵn sàng cho tiết dạy"}</div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="hidden rounded-[999px] border border-border bg-panel px-3 py-1.5 text-xs text-muted sm:inline-block">
          {now
            ? now.toLocaleDateString("vi-VN", { weekday: "short", day: "2-digit", month: "2-digit" }) +
              " · " +
              now.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
            : "--:--"}
        </span>
        <span className="rounded-[999px] border border-border bg-panel px-3 py-1.5 text-xs text-muted">
          ● ONLINE
        </span>
        <button
          type="button"
          onClick={() => document.documentElement.requestFullscreen?.()}
          title="Toàn màn hình"
          className="grid h-9 w-9 place-items-center rounded-[999px] border border-border bg-panel text-text hover:bg-panel-2"
        >
          ⛶
        </button>
        <form action={signOut}>
          <button
            type="submit"
            className="rounded-[999px] border border-border bg-panel px-3 py-1.5 text-xs font-semibold text-text hover:bg-panel-2"
          >
            Đăng xuất
          </button>
        </form>
      </div>
    </header>
  );
}
