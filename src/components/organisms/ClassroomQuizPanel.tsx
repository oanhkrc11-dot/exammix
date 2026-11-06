"use client";

import { useState } from "react";
import { Badge, Button } from "@/components/atoms";
import type { Question } from "@/lib/supabase/types";
import type { Team } from "./ScoreboardBuzzerPanel";

export function ClassroomQuizPanel({
  questions,
  teams,
  onTeamsChange,
}: {
  questions: Question[];
  teams: Team[];
  onTeamsChange: (teams: Team[]) => void;
}) {
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [points, setPoints] = useState(10);

  const current = questions[index];

  function award(teamIndex: number) {
    onTeamsChange(teams.map((t, i) => (i === teamIndex ? { ...t, score: t.score + points } : t)));
  }

  function next() {
    setRevealed(false);
    setIndex((i) => Math.min(i + 1, questions.length - 1));
  }

  if (questions.length === 0) {
    return (
      <div className="rounded-[18px] border border-border bg-panel p-8 text-center text-muted shadow-[var(--shadow-soft)]">
        Chưa có câu hỏi trong ngân hàng câu hỏi. Hãy thêm câu hỏi ở trang &quot;Ngân hàng câu hỏi&quot; trước.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Badge tone="blue">
          Câu {index + 1}/{questions.length}
        </Badge>
        <div className="flex items-center gap-2 text-sm text-text">
          Điểm mỗi câu:
          <input
            type="number"
            min={1}
            value={points}
            onChange={(e) => setPoints(Number(e.target.value) || 1)}
            className="w-16 rounded-[7px] border border-border bg-panel px-2 py-1"
          />
        </div>
      </div>

      <div className="rounded-[18px] border border-border bg-panel p-6 shadow-[var(--shadow-soft)]">
        <p className="text-base text-text">{current.content}</p>
        {revealed ? (
          <p className="mt-4 rounded-[10px] bg-success/10 p-3 text-sm text-success">Đáp án: {current.answer}</p>
        ) : (
          <Button className="mt-4" variant="gray" onClick={() => setRevealed(true)}>
            Hiện đáp án
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {teams.map((t, i) => (
            <Button key={i} variant="green" onClick={() => award(i)}>
              +{points} cho {t.name}
            </Button>
          ))}
        </div>
        <Button onClick={next} disabled={index >= questions.length - 1}>
          Câu tiếp theo
        </Button>
      </div>
    </div>
  );
}
