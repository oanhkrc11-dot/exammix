"use client";

import { useMemo, useState } from "react";
import { Button, Input, Select } from "@/components/atoms";
import { SearchInput } from "@/components/molecules";
import {
  QUESTION_TYPE_LABEL,
  countByType,
  filterQuestions,
  selectAllIds,
  selectRandomByType,
  selectRandomN,
  type PickableQuestion,
  type QuestionKind,
} from "@/lib/logic/docx/questionPicker";

// Mirrors legacy's "☑ Chọn câu trước khi trộn" (em217) panel
// (Exam_mix_6_nov.html:3199-3222): select all/none, random-N, random per
// Phần I–IV, search, and a per-question checklist. `selectedIds === null`
// means "không lọc" (mix the whole source), same as em217 before the
// teacher opts into filtering.
export function ExamMixerQuestionPicker({
  items,
  selectedIds,
  onChange,
  disabled,
}: {
  items: PickableQuestion[];
  selectedIds: Set<number> | null;
  onChange: (ids: Set<number> | null) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<QuestionKind | "">("");
  const [randomN, setRandomN] = useState(items.length);
  const [perType, setPerType] = useState<Record<"mcq" | "tf" | "short" | "essay", number>>({
    mcq: 0,
    tf: 0,
    short: 0,
    essay: 0,
  });

  const effective = useMemo(() => selectedIds ?? selectAllIds(items), [selectedIds, items]);
  const visible = useMemo(() => filterQuestions(items, { query, type: typeFilter }), [items, query, typeFilter]);

  function toggle(id: number) {
    const next = new Set(effective);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  }

  if (!items.length) {
    return (
      <div className="rounded-[14px] border border-border bg-panel-2 p-4 text-sm text-muted">
        ☑ Chọn câu trước khi trộn — chọn đề Word và bấm &quot;Kiểm tra&quot; để hiện danh sách.
      </div>
    );
  }

  return (
    <div className={`rounded-[14px] border border-border bg-panel-2 p-4 ${disabled ? "opacity-60" : ""}`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-text">☑ Chọn câu trước khi trộn</h3>
        <span className="text-xs text-muted">
          Đã chọn {effective.size}/{items.length} câu ·{" "}
          {(["mcq", "tf", "short", "essay"] as const)
            .map((t) => `${QUESTION_TYPE_LABEL[t].split("—")[0].trim()}: ${countByType(items, t)}`)
            .join(" · ")}
        </span>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        <Button variant="gray" onClick={() => onChange(selectAllIds(items))} disabled={disabled}>
          Chọn tất cả
        </Button>
        <Button variant="gray" onClick={() => onChange(new Set())} disabled={disabled}>
          Bỏ tất cả
        </Button>
        <Input
          type="number"
          min={1}
          max={items.length}
          value={randomN}
          onChange={(e) => setRandomN(Number(e.target.value) || 0)}
          className="w-24"
        />
        <Button variant="gray" onClick={() => onChange(selectRandomN(items, randomN))} disabled={disabled}>
          🎲 Chọn ngẫu nhiên
        </Button>
      </div>

      <div className="mb-3 flex flex-wrap items-end gap-2">
        {(["mcq", "tf", "short", "essay"] as const).map((t) => (
          <label key={t} className="flex flex-col gap-1 text-xs text-muted">
            {QUESTION_TYPE_LABEL[t]}
            <Input
              type="number"
              min={0}
              max={countByType(items, t)}
              value={perType[t]}
              onChange={(e) => setPerType({ ...perType, [t]: Number(e.target.value) || 0 })}
              className="w-20"
            />
          </label>
        ))}
        <Button variant="gray" onClick={() => onChange(selectRandomByType(items, perType))} disabled={disabled}>
          🎯 Chọn theo phần
        </Button>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        <SearchInput value={query} onChange={setQuery} placeholder="Tìm số câu hoặc nội dung..." />
        <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as QuestionKind | "")} className="max-w-[220px]">
          <option value="">Tất cả loại câu</option>
          {(["mcq", "tf", "short", "essay"] as const).map((t) => (
            <option key={t} value={t}>
              {QUESTION_TYPE_LABEL[t]}
            </option>
          ))}
        </Select>
      </div>

      <div className="max-h-64 overflow-y-auto rounded-[10px] border border-border">
        {visible.map((q) => (
          <label
            key={q.id}
            className="flex cursor-pointer items-start gap-2.5 border-b border-border p-2.5 text-xs last:border-0 hover:bg-panel"
          >
            <input type="checkbox" className="mt-0.5" checked={effective.has(q.id)} onChange={() => toggle(q.id)} />
            <span>
              <b>
                {QUESTION_TYPE_LABEL[q.type]} › Câu {q.num}:{" "}
              </b>
              {q.preview || "(Không đọc được phần chữ; kiểm tra Word gốc)"}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
