"use client";

import { useState, useTransition } from "react";
import { Badge, Button, Input, Select } from "@/components/atoms";
import { FileDropzone, FormField } from "@/components/molecules";
import { saveExamMixConfig } from "@/features/exam-mixer/actions";
import {
  generateExamVariants,
  type GeneratedExamVariant,
} from "@/lib/logic/docx/generate";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ExamMixerPanel() {
  const [file, setFile] = useState<File | null>(null);
  const [examName, setExamName] = useState("");
  const [variantCount, setVariantCount] = useState(4);
  const [shuffleChoices, setShuffleChoices] = useState(true);
  const [dontShuffleTF, setDontShuffleTF] = useState(false);
  const [renumber, setRenumber] = useState(true);
  const [outputStyle, setOutputStyle] = useState<"keep" | "standard">("keep");
  const [results, setResults] = useState<GeneratedExamVariant[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleGenerate() {
    if (!file) return;
    setError(null);
    startTransition(async () => {
      try {
        const variants = await generateExamVariants(file, {
          variantCount,
          shuffleChoices,
          dontShuffleTF,
          renumber,
          outputStyle,
          examName,
        });
        setResults(variants);
        await saveExamMixConfig(examName || file.name, {
          fileName: file.name,
          variantCount,
          shuffleChoices,
          dontShuffleTF,
          renumber,
          outputStyle,
          codes: variants.map((v) => v.code),
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Không thể trộn đề. Kiểm tra lại file Word.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-[18px] border border-border bg-panel p-5 shadow-[var(--shadow-soft)]">
        <h2 className="mb-4 text-base font-semibold text-text">Chọn đề gốc (.docx)</h2>
        <FileDropzone
          accept=".docx"
          label={file ? `Đã chọn: ${file.name}` : "Kéo thả hoặc bấm để chọn file .docx"}
          onFile={setFile}
        />

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <FormField label="Tên đề thi">
            <Input value={examName} onChange={(e) => setExamName(e.target.value)} />
          </FormField>
          <FormField label="Số mã đề">
            <Input
              type="number"
              min={1}
              max={20}
              value={variantCount}
              onChange={(e) => setVariantCount(Number(e.target.value) || 1)}
            />
          </FormField>
          <FormField label="Định dạng đầu ra">
            <Select value={outputStyle} onChange={(e) => setOutputStyle(e.target.value as "keep" | "standard")}>
              <option value="keep">Giữ nguyên định dạng đề gốc</option>
              <option value="standard">Định dạng chuẩn ExamMix</option>
            </Select>
          </FormField>
        </div>

        <div className="mt-4 flex flex-wrap gap-4 text-sm text-text">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={shuffleChoices} onChange={(e) => setShuffleChoices(e.target.checked)} />
            Trộn đáp án trắc nghiệm (A-D)
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={!dontShuffleTF} onChange={(e) => setDontShuffleTF(!e.target.checked)} />
            Trộn ý Đúng/Sai
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={renumber} onChange={(e) => setRenumber(e.target.checked)} />
            Đánh lại số thứ tự câu
          </label>
        </div>

        {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}

        <Button className="mt-5" onClick={handleGenerate} disabled={!file || isPending}>
          {isPending ? "Đang trộn đề..." : "Tạo đề"}
        </Button>
      </div>

      {results.length > 0 ? (
        <div className="overflow-x-auto rounded-[18px] border border-border bg-panel shadow-[var(--shadow-soft)]">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-muted">
              <tr>
                <th className="px-4 py-3">Mã đề</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.code} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <Badge tone="blue">Mã {r.code}</Badge>
                  </td>
                  <td className="flex flex-wrap gap-2 px-4 py-3">
                    <Button
                      variant="gray"
                      onClick={() => downloadBlob(r.blob, `De_${r.code}.docx`)}
                    >
                      Tải đề thi
                    </Button>
                    <Button
                      variant="gray"
                      onClick={() => downloadBlob(r.printBlob, `De_${r.code}_BanIn.docx`)}
                    >
                      Tải bản in
                    </Button>
                    <Button
                      variant="gray"
                      onClick={() => downloadBlob(r.essayAnswerBlob, `De_${r.code}_DapAnTuLuan.docx`)}
                    >
                      Tải đáp án tự luận
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
