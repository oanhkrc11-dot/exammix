"use client";

import { Select } from "@/components/atoms";
import { FormField } from "@/components/molecules";
import type { ExportSelection } from "@/lib/logic/docx/generate";

export const DEFAULT_OUTPUT_SELECTION: ExportSelection = {
  outDocx: true,
  outAnswerDoc: true,
  outExcel: true,
  outMergedDocx: false,
  outMergedPrintDocx: false,
  outTNMakerQR: false,
  outPrintManifest: false,
  outEssayAnswerDoc: true,
  printOrder: "asc",
};

const CHECKBOX_FIELDS: { key: keyof ExportSelection; label: string }[] = [
  { key: "outDocx", label: "Đề Word" },
  { key: "outMergedDocx", label: "Đề ghép Word" },
  { key: "outMergedPrintDocx", label: "File ghép ĐỂ IN" },
  { key: "outAnswerDoc", label: "Đáp án Word" },
  { key: "outExcel", label: "Đáp án Excel" },
  { key: "outTNMakerQR", label: "QR đáp án TNMaker" },
  { key: "outPrintManifest", label: "Danh sách thứ tự in" },
  { key: "outEssayAnswerDoc", label: "Đáp án tự luận" },
];

// Mirrors legacy's Step card 4 "XUẤT ĐỀ" output-format checkbox strip
// (Exam_mix_6_nov.html:3447-3471). All selected outputs are bundled into
// one ZIP by generate.ts's buildExportZip.
export function ExamMixerOutputSelect({
  value,
  onChange,
}: {
  value: ExportSelection;
  onChange: (next: ExportSelection) => void;
}) {
  return (
    <div className="rounded-[14px] border border-border bg-panel-2 p-4">
      <h3 className="mb-3 text-sm font-bold text-text">Chọn định dạng xuất</h3>
      <div className="flex flex-wrap gap-4 text-sm text-text">
        {CHECKBOX_FIELDS.map(({ key, label }) => (
          <label key={key} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={!!value[key]}
              onChange={(e) => onChange({ ...value, [key]: e.target.checked })}
            />
            {label}
          </label>
        ))}
      </div>
      <FormField label="Thứ tự in" className="mt-3 max-w-[220px]">
        <Select
          value={value.printOrder ?? "asc"}
          onChange={(e) => onChange({ ...value, printOrder: e.target.value as ExportSelection["printOrder"] })}
        >
          <option value="asc">Tăng dần</option>
          <option value="desc">Giảm dần</option>
        </Select>
      </FormField>
    </div>
  );
}
