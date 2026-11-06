import Image from "next/image";
import { NavItem } from "@/components/molecules";
import { NAV_ITEMS } from "@/lib/nav-items";
import { ThemeToggle } from "./ThemeToggle";

export function Sidebar({
  isAdmin,
  displayName,
  email,
  role,
}: {
  isAdmin: boolean;
  displayName: string | null;
  email: string | null;
  role: "teacher" | "admin";
}) {
  return (
    <aside
      className="fixed inset-y-0 left-0 hidden w-[var(--sidebar-width)] flex-col overflow-y-auto px-[13px] py-[18px] md:flex"
      style={{
        backgroundImage: "linear-gradient(180deg, #08192f 0%, #071422 100%)",
        borderRight: "1px solid rgba(111,165,221,.16)",
        boxShadow: "14px 0 38px rgba(0,0,0,.18)",
      }}
    >
      <div
        className="mb-5 flex items-center gap-2.5 rounded-xl p-2"
        style={{ borderBottom: "1px solid rgba(34,211,238,.2)" }}
      >
        <div
          className="grid h-[58px] w-[58px] shrink-0 place-items-center overflow-hidden rounded-2xl"
          style={{
            backgroundImage: "linear-gradient(145deg, #10243a, #0b1420)",
            boxShadow: "0 0 0 1px rgba(34,211,238,.18), 0 10px 28px rgba(0,0,0,.28)",
          }}
        >
          <Image src="/logo.png" alt="ExamMix Pro" width={58} height={58} className="object-contain" />
        </div>
        <div className="min-w-0">
          <div className="whitespace-nowrap text-[22px] font-black leading-none tracking-tight text-white">
            ExamMix <span className="text-brand-orange">Pro</span>
          </div>
          <div className="mt-1.5 whitespace-nowrap text-[11px] uppercase tracking-wider text-muted opacity-80">
            Trộn đề thông minh
          </div>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {NAV_ITEMS.map((item) => (
          <NavItem key={item.href} {...item} />
        ))}
        {isAdmin ? <NavItem href="/admin" glyph="🛠️" label="Quản trị" accent={["239,68,68", "249,115,22"]} /> : null}
      </nav>

      <div
        className="mt-3 rounded-xl p-3 text-xs"
        style={{
          backgroundImage: "linear-gradient(145deg, rgba(57,214,111,.08), rgba(57,214,111,.024))",
          border: "1px solid rgba(57,214,111,.3)",
        }}
      >
        <div className="mb-2 flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wide text-muted">
          <span className="grid h-[19px] w-[19px] place-items-center rounded-full bg-success/15 text-success">
            ✓
          </span>
          Trạng thái tài khoản
        </div>
        <dl className="grid gap-1.5">
          <Row k="Người dùng" v={displayName || email || "—"} />
          <Row k="Vai trò" v={role === "admin" ? "Quản trị" : "Giáo viên"} />
          <Row k="Lưu trữ" v="Supabase Cloud" />
        </dl>
      </div>

      <div className="mt-2">
        <ThemeToggle />
      </div>
    </aside>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-muted">
      <span>{k}</span>
      <b className="truncate text-right text-text">{v}</b>
    </div>
  );
}
