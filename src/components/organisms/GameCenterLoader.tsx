"use client";

import { useState } from "react";
import { Button } from "@/components/atoms";
import { GAME_CENTER_STORAGE_KEY, buildGameCenterBank } from "@/lib/logic/gameCenterBank";
import type { Question } from "@/lib/supabase/types";

export function GameCenterLoader({ questions }: { questions: Question[] }) {
  const [frameKey, setFrameKey] = useState(0);
  const [loadedCount, setLoadedCount] = useState<number | null>(null);

  function handleLoadBank() {
    const bank = buildGameCenterBank(questions);
    localStorage.setItem(GAME_CENTER_STORAGE_KEY, JSON.stringify(bank));
    setLoadedCount(bank.length);
    // Remount the iframe so Game Center's init() re-reads localStorage.
    setFrameKey((k) => k + 1);
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3 rounded-[18px] border border-border bg-panel p-4 shadow-[var(--shadow-soft)]">
        <Button onClick={handleLoadBank} disabled={questions.length === 0}>
          Nạp câu hỏi từ Ngân hàng câu hỏi ({questions.length} câu)
        </Button>
        {loadedCount !== null ? (
          <span className="text-sm text-success">Đã nạp {loadedCount} câu vào Game Center.</span>
        ) : null}
        {questions.length === 0 ? (
          <span className="text-sm text-muted">
            Chưa có câu hỏi. Hãy thêm câu hỏi ở trang &quot;Ngân hàng câu hỏi&quot; trước.
          </span>
        ) : null}
      </div>
      <p className="text-xs text-muted">
        Lưu ý: nút &quot;Tải file Word lên&quot; trong Game Center chưa hoạt động trong bản này — hãy dùng nút phía
        trên để nạp câu hỏi thay thế.
      </p>
      <iframe
        key={frameKey}
        src="/game-center/index.html"
        className="flex-1 rounded-[18px] border border-border bg-panel shadow-[var(--shadow-soft)]"
        title="Game Center"
      />
    </div>
  );
}
