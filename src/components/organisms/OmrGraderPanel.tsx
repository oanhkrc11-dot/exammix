"use client";

import { useState, useTransition } from "react";
import { Badge, Button, Input, Textarea } from "@/components/atoms";
import { FormField } from "@/components/molecules";
import { gradeAndSave } from "@/features/omr/actions";
import { gradeQuick, type GradeQuickResult } from "@/lib/logic/scoring";
import { buildAnswerSheetHtml } from "@/lib/logic/answerSheet";

export function OmrGraderPanel() {
  const [studentName, setStudentName] = useState("");
  const [className, setClassName] = useState("");
  const [examCode, setExamCode] = useState("");
  const [answerKey, setAnswerKey] = useState("");
  const [studentAnswers, setStudentAnswers] = useState("");
  const [scale, setScale] = useState(10);
  const [result, setResult] = useState<GradeQuickResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const preview = answerKey || studentAnswers ? gradeQuick(answerKey, studentAnswers, scale) : null;

  function handleGrade() {
    startTransition(async () => {
      const graded = await gradeAndSave({
        studentName,
        className,
        examCode,
        answerKey,
        studentAnswers,
        scale,
      });
      setResult(graded);
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-[18px] border border-border bg-panel p-5 shadow-[var(--shadow-soft)]">
        <h2 className="mb-4 text-base font-semibold text-text">Chấm điểm nhanh</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Họ tên học sinh">
            <Input value={studentName} onChange={(e) => setStudentName(e.target.value)} />
          </FormField>
          <FormField label="Lớp">
            <Input value={className} onChange={(e) => setClassName(e.target.value)} />
          </FormField>
          <FormField label="Mã đề">
            <Input value={examCode} onChange={(e) => setExamCode(e.target.value)} />
          </FormField>
          <FormField label="Thang điểm">
            <Input
              type="number"
              min={1}
              value={scale}
              onChange={(e) => setScale(Number(e.target.value) || 10)}
            />
          </FormField>
          <FormField label="Đáp án đúng (ví dụ: ABCD...)" className="sm:col-span-2">
            <Textarea rows={3} value={answerKey} onChange={(e) => setAnswerKey(e.target.value)} />
          </FormField>
          <FormField label="Đáp án học sinh" className="sm:col-span-2">
            <Textarea rows={3} value={studentAnswers} onChange={(e) => setStudentAnswers(e.target.value)} />
          </FormField>
        </div>

        {preview ? (
          <div className="mt-4 flex items-center gap-3 text-sm text-muted">
            <span>
              Đúng {preview.correct}/{preview.total}
            </span>
            <Badge tone="green">Điểm: {preview.score}</Badge>
          </div>
        ) : null}

        <Button className="mt-4" onClick={handleGrade} disabled={isPending || !answerKey.trim()}>
          Chấm và lưu kết quả
        </Button>

        {result ? (
          <p className="mt-3 text-sm text-success">
            Đã lưu kết quả: {result.correct}/{result.total} — điểm {result.score}.
          </p>
        ) : null}
      </div>

      <AnswerSheetPrinterPanel />
    </div>
  );
}

function AnswerSheetPrinterPanel() {
  const [mcqCount, setMcqCount] = useState(18);
  const [tfCount, setTfCount] = useState(4);
  const [shortCount, setShortCount] = useState(6);

  function handlePrint() {
    const html = buildAnswerSheetHtml({ mcqCount, tfCount, shortCount });
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  }

  return (
    <div className="rounded-[18px] border border-border bg-panel p-5 shadow-[var(--shadow-soft)]">
      <h2 className="mb-4 text-base font-semibold text-text">In phiếu trả lời</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <FormField label="Số câu trắc nghiệm">
          <Input type="number" min={0} value={mcqCount} onChange={(e) => setMcqCount(Number(e.target.value) || 0)} />
        </FormField>
        <FormField label="Số câu Đúng/Sai">
          <Input type="number" min={0} value={tfCount} onChange={(e) => setTfCount(Number(e.target.value) || 0)} />
        </FormField>
        <FormField label="Số câu trả lời ngắn">
          <Input type="number" min={0} value={shortCount} onChange={(e) => setShortCount(Number(e.target.value) || 0)} />
        </FormField>
      </div>
      <Button className="mt-4" variant="gray" onClick={handlePrint}>
        In phiếu trả lời
      </Button>
    </div>
  );
}
