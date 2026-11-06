import Link from "next/link";
import { ACADEMY_GAMES } from "@/lib/academy-games";

export default function AcademyPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold text-text">Học viện tri thức</h1>
        <p className="mt-1 text-sm text-muted">
          18 trò chơi trắc nghiệm theo môn học — học sinh chơi ngay trên trình duyệt, không cần cài đặt.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ACADEMY_GAMES.map((game) => (
          <Link key={game.key} href={`/academy/${game.key}`}>
            <div
              className="h-full rounded-[18px] border border-border bg-panel p-5 shadow-[var(--shadow-soft)] transition hover:-translate-y-0.5"
              style={{ borderTopColor: game.accent, borderTopWidth: 3 }}
            >
              <span className="text-3xl">{game.icon}</span>
              <h3 className="mt-2 text-sm font-semibold text-text">{game.name}</h3>
              <p className="mt-1 text-xs text-muted">{game.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
