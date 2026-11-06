"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Badge, Button, Input } from "@/components/atoms";
import { ConfirmDialog, FormField } from "@/components/molecules";
import { createRoom, deleteRoom, type CreateRoomInput } from "@/features/exam-room/actions";
import type { ExamRoom } from "@/lib/supabase/types";

const STATUS_LABEL: Record<ExamRoom["status"], { label: string; tone: "gray" | "green" | "red" }> = {
  draft: { label: "Chưa mở", tone: "gray" },
  open: { label: "Đang mở", tone: "green" },
  closed: { label: "Đã đóng", tone: "red" },
};

export function ExamRoomPanel({ initialRooms }: { initialRooms: ExamRoom[] }) {
  const [rooms, setRooms] = useState(initialRooms);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDelete(id: string) {
    startTransition(async () => {
      await deleteRoom(id);
      setRooms((prev) => prev.filter((r) => r.id !== id));
      setPendingDeleteId(null);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <CreateRoomForm onCreated={(room) => setRooms((prev) => [room, ...prev])} />

      <div className="overflow-x-auto rounded-[18px] border border-border bg-panel shadow-[var(--shadow-soft)]">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-muted">
            <tr>
              <th className="px-4 py-3">Phòng thi</th>
              <th className="px-4 py-3">Mã phòng</th>
              <th className="px-4 py-3">Trạng thái</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rooms.map((r) => (
              <tr key={r.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3">
                  <Link href={`/exam-room/${r.id}`} className="font-medium text-brand-blue hover:underline">
                    {r.name}
                  </Link>
                  <div className="text-xs text-muted">{r.duration_minutes} phút</div>
                </td>
                <td className="px-4 py-3 font-mono tracking-widest">{r.join_code}</td>
                <td className="px-4 py-3">
                  <Badge tone={STATUS_LABEL[r.status].tone}>{STATUS_LABEL[r.status].label}</Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  <Button variant="red" disabled={isPending} onClick={() => setPendingDeleteId(r.id)}>
                    Xóa
                  </Button>
                </td>
              </tr>
            ))}
            {rooms.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted">
                  Chưa có phòng thi nào.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={pendingDeleteId !== null}
        title="Xóa phòng thi này?"
        description="Toàn bộ danh sách học sinh đã vào phòng cũng sẽ bị xóa."
        danger
        onCancel={() => setPendingDeleteId(null)}
        onConfirm={() => pendingDeleteId && handleDelete(pendingDeleteId)}
      />
    </div>
  );
}

type VariantRow = { code: string; answerKey: string };

function CreateRoomForm({ onCreated }: { onCreated: (room: ExamRoom) => void }) {
  const [name, setName] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(45);
  const [scale, setScale] = useState(10);
  const [autoSubmit, setAutoSubmit] = useState(true);
  const [showScoreAfterSubmit, setShowScoreAfterSubmit] = useState(true);
  const [variants, setVariants] = useState<VariantRow[]>([{ code: "101", answerKey: "" }]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function updateVariant(index: number, patch: Partial<VariantRow>) {
    setVariants((prev) => prev.map((v, i) => (i === index ? { ...v, ...patch } : v)));
  }

  function handleCreate() {
    setError(null);
    const cleaned = variants
      .map((v) => ({ code: v.code.trim(), answerKey: v.answerKey.toUpperCase().replace(/[^ABCD]/g, "") }))
      .filter((v) => v.code && v.answerKey);
    if (cleaned.length === 0) {
      setError("Cần ít nhất một mã đề kèm đáp án (A, B, C, D).");
      return;
    }

    const input: CreateRoomInput = { name, durationMinutes, scale, autoSubmit, showScoreAfterSubmit, variants: cleaned };
    startTransition(async () => {
      try {
        const room = await createRoom(input);
        onCreated(room);
        setName("");
        setVariants([{ code: "101", answerKey: "" }]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Không thể tạo phòng thi.");
      }
    });
  }

  return (
    <div className="rounded-[18px] border border-border bg-panel p-5 shadow-[var(--shadow-soft)]">
      <h2 className="mb-4 text-base font-semibold text-text">Tạo phòng thi mới</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <FormField label="Tên phòng thi" className="sm:col-span-3">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Kiểm tra giữa kỳ - Lớp 10A1" />
        </FormField>
        <FormField label="Thời gian làm bài (phút)">
          <Input
            type="number"
            min={1}
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(Number(e.target.value) || 1)}
          />
        </FormField>
        <FormField label="Thang điểm">
          <Input type="number" min={1} value={scale} onChange={(e) => setScale(Number(e.target.value) || 10)} />
        </FormField>
      </div>

      <div className="mt-4 flex flex-wrap gap-4 text-sm text-text">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={autoSubmit} onChange={(e) => setAutoSubmit(e.target.checked)} />
          Tự động nộp bài khi hết giờ
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={showScoreAfterSubmit}
            onChange={(e) => setShowScoreAfterSubmit(e.target.checked)}
          />
          Hiện điểm ngay sau khi nộp
        </label>
      </div>

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium text-text">Mã đề và đáp án đúng</span>
          <Button variant="gray" onClick={() => setVariants((prev) => [...prev, { code: "", answerKey: "" }])}>
            + Thêm mã đề
          </Button>
        </div>
        <div className="flex flex-col gap-2">
          {variants.map((v, i) => (
            <div key={i} className="flex gap-2">
              <Input
                placeholder="Mã đề (101)"
                value={v.code}
                onChange={(e) => updateVariant(i, { code: e.target.value })}
                className="max-w-[140px]"
              />
              <Input
                placeholder="Đáp án đúng (ABCD...)"
                value={v.answerKey}
                onChange={(e) => updateVariant(i, { answerKey: e.target.value })}
              />
              {variants.length > 1 ? (
                <Button variant="red" onClick={() => setVariants((prev) => prev.filter((_, j) => j !== i))}>
                  Xóa
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}

      <Button className="mt-5" onClick={handleCreate} disabled={isPending}>
        {isPending ? "Đang tạo..." : "Tạo phòng thi"}
      </Button>
    </div>
  );
}
