"use client";

import { useState } from "react";
import { Button } from "@/components/atoms";
import { RosterWheelPanel } from "./RosterWheelPanel";
import { ScoreboardBuzzerPanel, type Team } from "./ScoreboardBuzzerPanel";
import { CountdownTimerPanel } from "./CountdownTimerPanel";
import { ClassroomQuizPanel } from "./ClassroomQuizPanel";
import type { ClassRoom, Question } from "@/lib/supabase/types";

const DEFAULT_TEAMS: Team[] = [
  { name: "Tổ 1", score: 0 },
  { name: "Tổ 2", score: 0 },
  { name: "Tổ 3", score: 0 },
  { name: "Tổ 4", score: 0 },
];

const TABS = [
  { key: "roster", label: "Lớp học & Quay số" },
  { key: "scoreboard", label: "Bảng điểm & Buzzer" },
  { key: "timer", label: "Đồng hồ đếm giờ" },
  { key: "quiz", label: "Bốc câu hỏi nhanh" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function ClassroomToolsPanel({
  initialClasses,
  initialQuestions,
}: {
  initialClasses: ClassRoom[];
  initialQuestions: Question[];
}) {
  const [tab, setTab] = useState<TabKey>("roster");
  const [teams, setTeams] = useState<Team[]>(DEFAULT_TEAMS);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Button key={t.key} variant={tab === t.key ? "blue" : "gray"} onClick={() => setTab(t.key)}>
            {t.label}
          </Button>
        ))}
      </div>

      {tab === "roster" ? <RosterWheelPanel initialClasses={initialClasses} /> : null}
      {tab === "scoreboard" ? <ScoreboardBuzzerPanel teams={teams} onTeamsChange={setTeams} /> : null}
      {tab === "timer" ? <CountdownTimerPanel /> : null}
      {tab === "quiz" ? (
        <ClassroomQuizPanel questions={initialQuestions} teams={teams} onTeamsChange={setTeams} />
      ) : null}
    </div>
  );
}
