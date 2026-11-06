"use client";

import { useEffect, useState } from "react";
import { Button, Input } from "@/components/atoms";
import { beep } from "@/lib/logic/beep";

export interface Team {
  name: string;
  score: number;
}

const DELTAS = [10, 5, -5, -10];
const HOTKEYS = ["Q", "W", "E", "R"];

export function ScoreboardBuzzerPanel({
  teams,
  onTeamsChange,
}: {
  teams: Team[];
  onTeamsChange: (teams: Team[]) => void;
}) {
  const [winnerIndex, setWinnerIndex] = useState<number | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const idx = HOTKEYS.indexOf(e.key.toUpperCase());
      if (idx === -1) return;
      setWinnerIndex((prev) => (prev === null ? idx : prev));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function updateTeam(index: number, patch: Partial<Team>) {
    onTeamsChange(teams.map((t, i) => (i === index ? { ...t, ...patch } : t)));
  }

  function addScore(index: number, delta: number) {
    updateTeam(index, { score: teams[index].score + delta });
  }

  function handleBuzz(index: number) {
    if (winnerIndex !== null) return;
    setWinnerIndex(index);
    beep(index % 2 === 0 ? 660 : 880, 180);
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {teams.map((team, i) => (
        <div
          key={i}
          className={`rounded-[18px] border p-4 shadow-[var(--shadow-soft)] transition ${
            winnerIndex === i ? "border-brand-orange bg-brand-orange/10" : "border-border bg-panel"
          }`}
        >
          <Input
            value={team.name}
            onChange={(e) => updateTeam(i, { name: e.target.value })}
            className="mb-2 font-semibold"
          />
          <div className="mb-3 text-center text-3xl font-bold text-text">{team.score}</div>
          <div className="mb-3 flex justify-center gap-1">
            {DELTAS.map((d) => (
              <Button key={d} variant={d > 0 ? "green" : "red"} onClick={() => addScore(i, d)}>
                {d > 0 ? `+${d}` : d}
              </Button>
            ))}
          </div>
          <Button variant="blue" className="w-full" onClick={() => handleBuzz(i)} disabled={winnerIndex !== null}>
            Bấm chuông ({HOTKEYS[i]})
          </Button>
        </div>
      ))}
      <div className="flex justify-center sm:col-span-2">
        <Button variant="gray" onClick={() => setWinnerIndex(null)}>
          Mở lại chuông
        </Button>
      </div>
    </div>
  );
}
