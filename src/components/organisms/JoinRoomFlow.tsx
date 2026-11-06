"use client";

import { useEffect, useRef, useState } from "react";
import { Badge, Button, Input, Textarea } from "@/components/atoms";
import { FormField } from "@/components/molecules";
import { joinRoom, submitRoomAnswers, type JoinRoomResult } from "@/features/exam-room/public-actions";

type Step = "form" | "exam" | "result";

interface StoredSession extends JoinRoomResult {
  studentAnswers?: string;
}

function storageKey(code: string) {
  return `exammix_room_${code}`;
}

export function JoinRoomFlow({ code }: { code: string }) {
  const [step, setStep] = useState<Step>("form");
  const [displayName, setDisplayName] = useState("");
  const [className, setClassName] = useState("");
  const [variantCode, setVariantCode] = useState("");
  const [session, setSession] = useState<StoredSession | null>(null);
  const [studentAnswers, setStudentAnswers] = useState("");
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ correct: number; total: number; score: number; showScore: boolean } | null>(
    null,
  );
  const [submitting, setSubmitting] = useState(false);
  const autoSubmittedRef = useRef(false);

  useEffect(() => {
    const raw = localStorage.getItem(storageKey(code));
    if (!raw) return;
    try {
      const stored: StoredSession = JSON.parse(raw);
      // Restoring a session from localStorage is only possible once the
      // client has mounted, so this must run in an effect, not a lazy
      // useState initializer (which would mismatch the SSR pass).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSession(stored);
      setStudentAnswers(stored.studentAnswers ?? "");
      setStep("exam");
    } catch {
      localStorage.removeItem(storageKey(code));
    }
  }, [code]);

  useEffect(() => {
    if (step !== "exam" || !session?.endsAt) return;
    const tick = () => {
      const left = Math.max(0, Math.floor((new Date(session.endsAt!).getTime() - Date.now()) / 1000));
      setRemainingSeconds(left);
      if (left === 0 && session.autoSubmit && !autoSubmittedRef.current) {
        autoSubmittedRef.current = true;
        handleSubmit();
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, session?.endsAt]);

  async function handleJoin() {
    setError(null);
    try {
      const res = await joinRoom(code, displayName, className, variantCode);
      const stored: StoredSession = res;
      localStorage.setItem(storageKey(code), JSON.stringify(stored));
      setSession(stored);
      setStep("exam");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể vào phòng thi.");
    }
  }

  function handleSubmit() {
    if (!session || submitting) return;
    setSubmitting(true);
    submitRoomAnswers(session.participantId, session.clientToken, studentAnswers)
      .then((res) => {
        setResult(res);
        setStep("result");
        localStorage.removeItem(storageKey(code));
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Không thể nộp bài."))
      .finally(() => setSubmitting(false));
  }

  if (step === "form") {
    return (
      <div className="flex flex-col gap-4">
        <FormField label="Họ và tên">
          <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </FormField>
        <FormField label="Lớp">
          <Input value={className} onChange={(e) => setClassName(e.target.value)} />
        </FormField>
        <FormField label="Mã đề (giáo viên cung cấp)">
          <Input value={variantCode} onChange={(e) => setVariantCode(e.target.value)} />
        </FormField>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <Button onClick={handleJoin}>Vào phòng thi</Button>
      </div>
    );
  }

  if (step === "exam" && session) {
    const minutes = remainingSeconds !== null ? Math.floor(remainingSeconds / 60) : null;
    const seconds = remainingSeconds !== null ? remainingSeconds % 60 : null;
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <Badge tone="blue">Mã đề {session.variantCode}</Badge>
          {remainingSeconds !== null ? (
            <Badge tone={remainingSeconds < 60 ? "red" : "orange"}>
              Còn lại {minutes}:{String(seconds).padStart(2, "0")}
            </Badge>
          ) : null}
        </div>
        <p className="text-sm text-muted">
          Đề có {session.totalQuestions} câu trắc nghiệm. Nhập đáp án theo thứ tự (ví dụ: ABCDABCD...).
        </p>
        <FormField label="Đáp án của bạn">
          <Textarea
            rows={4}
            value={studentAnswers}
            onChange={(e) => {
              setStudentAnswers(e.target.value);
              localStorage.setItem(
                storageKey(code),
                JSON.stringify({ ...session, studentAnswers: e.target.value }),
              );
            }}
            disabled={remainingSeconds === 0 && session.autoSubmit}
          />
        </FormField>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <Button onClick={handleSubmit} disabled={submitting}>
          {submitting ? "Đang nộp..." : "Nộp bài"}
        </Button>
      </div>
    );
  }

  if (step === "result" && result) {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <p className="text-lg font-semibold text-text">Đã nộp bài thành công!</p>
        {result.showScore ? (
          <>
            <p className="text-muted">
              Đúng {result.correct}/{result.total} câu
            </p>
            <p className="text-3xl font-bold text-brand-blue">{result.score} điểm</p>
          </>
        ) : (
          <p className="text-muted">Giáo viên sẽ công bố điểm sau.</p>
        )}
      </div>
    );
  }

  return null;
}
