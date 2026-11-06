"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/atoms";
import { ConfirmDialog, StatTile } from "@/components/molecules";
import { clearResults } from "@/features/stats/actions";
import { buildXlsxBlob } from "@/lib/logic/xlsx";
import type { ExamResult } from "@/lib/supabase/types";

export function StatsPanel({ initialResults }: { initialResults: ExamResult[] }) {
  const [results, setResults] = useState(initialResults);
  const [confirmClear, setConfirmClear] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Mirrors the legacy renderStats() KPI tiles: count/avg/max/min over score.
  const kpis = useMemo(() => {
    if (results.length === 0) return { count: 0, avg: 0, max: 0, min: 0 };
    const scores = results.map((r) => r.score);
    return {
      count: results.length,
      avg: Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2)),
      max: Math.max(...scores),
      min: Math.min(...scores),
    };
  }, [results]);

  async function handleExport() {
    const header = ["Thời gian", "Họ tên", "Lớp", "Mã đề", "Đúng", "Tổng", "Điểm"];
    const rows = results.map((r) => [
      new Date(r.created_at).toLocaleString("vi-VN"),
      r.student_name,
      r.class_name,
      r.exam_code,
      r.correct,
      r.total,
      r.score,
    ]);
    const blob = await buildXlsxBlob("Kết quả", header, rows);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ket-qua.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleClear() {
    startTransition(async () => {
      await clearResults();
      setResults([]);
      setConfirmClear(false);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-4">
        <StatTile label="Số lượt" value={kpis.count} />
        <StatTile label="Điểm TB" value={kpis.avg} />
        <StatTile label="Điểm cao nhất" value={kpis.max} />
        <StatTile label="Điểm thấp nhất" value={kpis.min} />
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="gray" onClick={handleExport} disabled={results.length === 0}>
          Xuất Excel
        </Button>
        <Button variant="red" onClick={() => setConfirmClear(true)} disabled={results.length === 0 || isPending}>
          Xóa tất cả
        </Button>
      </div>

      <div className="overflow-x-auto rounded-[18px] border border-border bg-panel shadow-[var(--shadow-soft)]">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-muted">
            <tr>
              <th className="px-4 py-3">Thời gian</th>
              <th className="px-4 py-3">Họ tên</th>
              <th className="px-4 py-3">Lớp</th>
              <th className="px-4 py-3">Mã đề</th>
              <th className="px-4 py-3">Đúng/Tổng</th>
              <th className="px-4 py-3">Điểm</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => (
              <tr key={r.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 text-muted">{new Date(r.created_at).toLocaleString("vi-VN")}</td>
                <td className="px-4 py-3">{r.student_name}</td>
                <td className="px-4 py-3">{r.class_name}</td>
                <td className="px-4 py-3">{r.exam_code}</td>
                <td className="px-4 py-3">{r.correct}/{r.total}</td>
                <td className="px-4 py-3 font-semibold">{r.score}</td>
              </tr>
            ))}
            {results.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted">
                  Chưa có dữ liệu.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={confirmClear}
        title="Xóa toàn bộ kết quả?"
        description="Hành động này không thể hoàn tác."
        danger
        onCancel={() => setConfirmClear(false)}
        onConfirm={handleClear}
      />
    </div>
  );
}
