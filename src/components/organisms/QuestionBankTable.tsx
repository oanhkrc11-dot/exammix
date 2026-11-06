"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { Badge, Button, Input, Select, Textarea } from "@/components/atoms";
import { ConfirmDialog, FormField } from "@/components/molecules";
import { addQuestion, deleteQuestion, importQuestions, type QuestionInput } from "@/features/question-bank/actions";
import type { Question } from "@/lib/supabase/types";

const QUESTION_TYPES = [
  "Trắc nghiệm 4 lựa chọn",
  "Đúng/Sai",
  "Trả lời ngắn",
  "Tự luận",
];

const EMPTY_FORM: QuestionInput = {
  subject: "",
  topic: "",
  type: QUESTION_TYPES[0],
  content: "",
  answer: "",
};

export function QuestionBankTable({ initialQuestions }: { initialQuestions: Question[] }) {
  const [questions, setQuestions] = useState(initialQuestions);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<QuestionInput>(EMPTY_FORM);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Same UX as the legacy renderQuestions(): case-insensitive substring
  // match over the whole stringified record.
  const filtered = useMemo(() => {
    if (!search.trim()) return questions;
    const needle = search.toLowerCase();
    return questions.filter((q) => JSON.stringify(q).toLowerCase().includes(needle));
  }, [questions, search]);

  function handleAdd() {
    if (!form.content.trim()) return;
    startTransition(async () => {
      await addQuestion(form);
      setQuestions((prev) => [
        { ...form, id: crypto.randomUUID(), user_id: "", created_at: new Date().toISOString() },
        ...prev,
      ]);
      setForm(EMPTY_FORM);
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      await deleteQuestion(id);
      setQuestions((prev) => prev.filter((q) => q.id !== id));
      setPendingDeleteId(null);
    });
  }

  function handleExport() {
    const blob = new Blob([JSON.stringify(questions, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ngan-hang-cau-hoi.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImportFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!Array.isArray(parsed)) {
          alert("File JSON không hợp lệ");
          return;
        }
        const items: QuestionInput[] = parsed.map((q) => ({
          subject: q.subject ?? "",
          topic: q.topic ?? "",
          type: q.type ?? QUESTION_TYPES[0],
          content: q.content ?? "",
          answer: q.answer ?? "",
        }));
        startTransition(async () => {
          await importQuestions(items);
          setQuestions(
            items.map((item) => ({
              ...item,
              id: crypto.randomUUID(),
              user_id: "",
              created_at: new Date().toISOString(),
            })),
          );
        });
      } catch {
        alert("File JSON không hợp lệ");
      }
    };
    reader.readAsText(file);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-[18px] border border-border bg-panel p-5 shadow-[var(--shadow-soft)]">
        <h2 className="mb-4 text-base font-semibold text-text">Thêm câu hỏi</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Môn học">
            <Input
              value={form.subject}
              onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
            />
          </FormField>
          <FormField label="Chủ đề">
            <Input
              value={form.topic}
              onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value }))}
            />
          </FormField>
          <FormField label="Loại câu hỏi" className="sm:col-span-2">
            <Select
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
            >
              {QUESTION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Nội dung câu hỏi" className="sm:col-span-2">
            <Textarea
              rows={3}
              value={form.content}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
            />
          </FormField>
          <FormField label="Đáp án" className="sm:col-span-2">
            <Textarea
              rows={2}
              value={form.answer}
              onChange={(e) => setForm((f) => ({ ...f, answer: e.target.value }))}
            />
          </FormField>
        </div>
        <Button className="mt-4" onClick={handleAdd} disabled={isPending}>
          Thêm câu hỏi
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Input
          type="search"
          placeholder="Tìm kiếm..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <div className="flex gap-2">
          <Button variant="gray" onClick={handleExport}>
            Xuất JSON
          </Button>
          <Button variant="gray" onClick={() => fileInputRef.current?.click()}>
            Nhập JSON
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImportFile(file);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-[18px] border border-border bg-panel shadow-[var(--shadow-soft)]">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-muted">
            <tr>
              <th className="px-4 py-3">Môn / Chủ đề</th>
              <th className="px-4 py-3">Loại</th>
              <th className="px-4 py-3">Nội dung</th>
              <th className="px-4 py-3">Đáp án</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((q) => (
              <tr key={q.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 text-muted">
                  {q.subject} {q.topic ? `· ${q.topic}` : ""}
                </td>
                <td className="px-4 py-3">
                  <Badge tone="blue">{q.type}</Badge>
                </td>
                <td className="max-w-xs truncate px-4 py-3">{q.content}</td>
                <td className="max-w-xs truncate px-4 py-3">{q.answer}</td>
                <td className="px-4 py-3 text-right">
                  <Button variant="red" onClick={() => setPendingDeleteId(q.id)}>
                    Xóa
                  </Button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted">
                  Chưa có câu hỏi nào.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={pendingDeleteId !== null}
        title="Xóa câu hỏi này?"
        description="Hành động này không thể hoàn tác."
        danger
        onCancel={() => setPendingDeleteId(null)}
        onConfirm={() => pendingDeleteId && handleDelete(pendingDeleteId)}
      />
    </div>
  );
}
