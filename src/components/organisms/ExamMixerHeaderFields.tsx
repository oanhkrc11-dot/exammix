"use client";

import { FormField } from "@/components/molecules";
import { Input } from "@/components/atoms";
import type { ExamHeaderInfo } from "@/lib/logic/docx/generate";

// Mirrors legacy's "⚙ TIÊU ĐỀ" <details> block (Exam_mix_6_nov.html:3104-3140):
// exam metadata used to build the header table injected by buildExamHeaderNodes.
export function ExamMixerHeaderFields({
  value,
  onChange,
}: {
  value: ExamHeaderInfo;
  onChange: (next: ExamHeaderInfo) => void;
}) {
  function set<K extends keyof ExamHeaderInfo>(key: K, v: ExamHeaderInfo[K]) {
    onChange({ ...value, [key]: v });
  }

  return (
    <details open className="rounded-[14px] border border-border bg-panel-2 p-4">
      <summary className="cursor-pointer text-sm font-bold text-text">⚙ TIÊU ĐỀ</summary>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <FormField label="Cơ quan/Sở">
          <Input value={value.agency ?? ""} onChange={(e) => set("agency", e.target.value)} />
        </FormField>
        <FormField label="Kỳ thi">
          <Input value={value.examName ?? ""} onChange={(e) => set("examName", e.target.value)} />
        </FormField>
        <FormField label="Trường">
          <Input value={value.school ?? ""} onChange={(e) => set("school", e.target.value)} />
        </FormField>
        <FormField label="Môn học">
          <Input value={value.subject ?? ""} onChange={(e) => set("subject", e.target.value)} />
        </FormField>
        <FormField label="Tổ/Bộ môn">
          <Input value={value.dept ?? ""} onChange={(e) => set("dept", e.target.value)} />
        </FormField>
        <FormField label="Thời gian">
          <Input value={value.duration ?? ""} onChange={(e) => set("duration", e.target.value)} />
        </FormField>
        <FormField label="Loại đề">
          <Input value={value.examType ?? ""} onChange={(e) => set("examType", e.target.value)} />
        </FormField>
      </div>
      <div className="mt-4 flex flex-wrap gap-4 text-sm text-text">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={!!value.injectHeader}
            onChange={(e) => set("injectHeader", e.target.checked)}
          />
          Chèn tiêu đề chuẩn
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={!!value.removeOldHeader}
            onChange={(e) => set("removeOldHeader", e.target.checked)}
          />
          Thay tiêu đề gốc nếu đề đã có tiêu đề
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={!!value.candidateInfo}
            onChange={(e) => set("candidateInfo", e.target.checked)}
          />
          Họ tên – SBD
        </label>
      </div>
    </details>
  );
}
