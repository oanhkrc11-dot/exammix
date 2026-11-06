import { notFound } from "next/navigation";
import { ACADEMY_GAMES } from "@/lib/academy-games";
import { AcademyGameFrame } from "@/components/organisms/AcademyGameFrame";

export default async function AcademyGamePage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const game = ACADEMY_GAMES.find((g) => g.key === key);
  if (!game) notFound();

  return (
    <div className="flex h-full flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold text-text">
          {game.icon} {game.name}
        </h1>
        <p className="mt-1 text-sm text-muted">{game.desc}</p>
      </div>
      <AcademyGameFrame gameKey={game.key} />
    </div>
  );
}
