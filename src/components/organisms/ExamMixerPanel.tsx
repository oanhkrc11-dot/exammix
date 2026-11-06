"use client";

import { useState, useTransition } from "react";
import { Badge, Button, Input } from "@/components/atoms";
import { FileDropzone, FormField } from "@/components/molecules";
import { saveExamMixConfig } from "@/features/exam-mixer/actions";
import {
  analyzeSource,
  buildExportZip,
  generateExamVariants,
  previewFirstVariant,
  type ExamHeaderInfo,
  type GenerateExamVariantsOptions,
  type GeneratedExamVariant,
  type SourceAnalysis,
} from "@/lib/logic/docx/generate";
import { buildAnswerSheetHtml } from "@/lib/logic/answerSheet";
import { extractPickableQuestions, type PickableQuestion } from "@/lib/logic/docx/questionPicker";
import {
  appendLogEntry,
  buildInspectReport,
  formatHistoryLog,
  restoreMixerSession,
  runIntegrityTests,
  saveMixerSession,
  RECOMMENDED_MIX_SETTINGS,
  type MixLogEntry,
  type MixerSessionSettings,
  type SelfTestResult,
} from "@/lib/logic/docx/mixerSession";
import { ExamMixerHeaderFields } from "./ExamMixerHeaderFields";
import { ExamMixerQuestionPicker } from "./ExamMixerQuestionPicker";
import {
  ExamMixerCodeAndRules,
  DEFAULT_CODE_SETTINGS,
  DEFAULT_MIX_RULES,
  DEFAULT_FIXED_ITEMS,
  resolveCodes,
  type CodeSettings,
  type MixRules,
  type FixedItems,
} from "./ExamMixerCodeAndRules";
import { ExamMixerOutputSelect, DEFAULT_OUTPUT_SELECTION } from "./ExamMixerOutputSelect";
import { ExamMixerGuide } from "./ExamMixerGuide";
import { ExamMixerVerificationPanel } from "./ExamMixerVerificationPanel";
import type { ExportSelection } from "@/lib/logic/docx/generate";

const DEFAULT_HEADER: ExamHeaderInfo = {
  agency: "",
  examName: "",
  school: "",
  subject: "",
  dept: "",
  duration: "",
  examType: "",
  injectHeader: false,
  removeOldHeader: false,
  candidateInfo: true,
};

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ExamMixerPanel() {
  const [mode, setMode] = useState<"easy" | "advanced">("easy");
  const [file, setFile] = useState<File | null>(null);
  const [header, setHeader] = useState<ExamHeaderInfo>(DEFAULT_HEADER);
  const [code, setCode] = useState<CodeSettings>(DEFAULT_CODE_SETTINGS);
  const [rules, setRules] = useState<MixRules>(DEFAULT_MIX_RULES);
  const [fixed, setFixed] = useState<FixedItems>(DEFAULT_FIXED_ITEMS);
  const [outputSelection, setOutputSelection] = useState<ExportSelection>(DEFAULT_OUTPUT_SELECTION);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<Set<number> | null>(null);

  const [sourceAnalysis, setSourceAnalysis] = useState<SourceAnalysis | null>(null);
  const [pickableQuestions, setPickableQuestions] = useState<PickableQuestion[]>([]);
  const [results, setResults] = useState<GeneratedExamVariant[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<MixLogEntry[]>([]);
  const [reportText, setReportText] = useState("");
  const [selfTestResults, setSelfTestResults] = useState<SelfTestResult[]>([]);
  const [statusText, setStatusText] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function buildOptions(): GenerateExamVariantsOptions {
    const codes = resolveCodes(code);
    return {
      ...header,
      variantCount: codes.length,
      codes,
      shuffleChoices: rules.shuffleChoices,
      dontShuffleTF: rules.dontShuffleTF,
      renumber: rules.renumber,
      outputStyle: rules.outputStyle,
      englishBlockMode: rules.englishBlockMode,
      removeSolutions: rules.removeSolutions,
      groupSizes: rules.groupSizes,
      fixedAllTFItems: fixed.fixedAllTFItems,
      fixedQuestionNums: fixed.fixedQuestionNums,
      fixedSpecificTFItems: fixed.fixedSpecificTFItems,
      fixedTFItems: fixed.fixedTFItems,
      selectedQuestionIds: selectedQuestionIds ? Array.from(selectedQuestionIds) : undefined,
    };
  }

  function handleAnalyze() {
    if (!file) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await analyzeSource(file, {
          autoDetect: rules.autoDetectAnswers,
          englishBlockMode: rules.englishBlockMode,
        });
        setSourceAnalysis(result);
        setPickableQuestions(extractPickableQuestions(result.analysis));
        setSelectedQuestionIds(null);
        setResults([]);
        setLog((l) =>
          appendLogEntry(
            l,
            "Kiểm tra đề gốc",
            `${result.analysis.total} câu, ${result.analysis.found} đáp án nhận diện.`,
          ),
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "Không thể đọc file Word.");
      }
    });
  }

  function handleApplyRecommended() {
    setRules((r) => ({
      ...r,
      shuffleChoices: RECOMMENDED_MIX_SETTINGS.shuffleChoices,
      dontShuffleTF: RECOMMENDED_MIX_SETTINGS.dontShuffleTF,
      renumber: RECOMMENDED_MIX_SETTINGS.renumber,
      removeSolutions: RECOMMENDED_MIX_SETTINGS.removeSolutions,
      autoDetectAnswers: RECOMMENDED_MIX_SETTINGS.autoDetectAnswers,
      englishBlockMode: RECOMMENDED_MIX_SETTINGS.englishBlockMode,
      outputStyle: RECOMMENDED_MIX_SETTINGS.outputStyle,
    }));
    setOutputSelection((o) => ({
      ...o,
      outDocx: RECOMMENDED_MIX_SETTINGS.outDocx,
      outAnswerDoc: RECOMMENDED_MIX_SETTINGS.outAnswerDoc,
    }));
  }

  function handleMixAndExport() {
    if (!sourceAnalysis) {
      setError("Hãy chọn đề Word và bấm Kiểm tra trước.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const options = buildOptions();
        const variants = await generateExamVariants(sourceAnalysis, options);
        setResults(variants);

        const zipBlob = await buildExportZip(variants, sourceAnalysis.zip, outputSelection, header);
        const baseName = (header.examName || sourceAnalysis.fileName.replace(/\.docx$/i, "")).trim() || "DeThi";
        downloadBlob(zipBlob, `${baseName}_DaTron.zip`);

        await saveExamMixConfig(baseName, {
          ...header,
          ...code,
          ...rules,
          ...fixed,
          outputSelection,
          codes: variants.map((v) => v.code),
        });

        setLog((l) => appendLogEntry(l, "Hoàn tất", `Đã trộn và xuất ${variants.length} mã đề.`));
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Không thể trộn đề. Kiểm tra lại file Word.";
        setError(msg);
        setLog((l) => appendLogEntry(l, "Lỗi", msg));
      }
    });
  }

  function handlePreviewFirst() {
    if (!sourceAnalysis) return;
    setError(null);
    startTransition(async () => {
      try {
        const variant = await previewFirstVariant(sourceAnalysis, buildOptions());
        downloadBlob(variant.blob, `Xem_thu_${variant.code}.docx`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Không thể xem thử mã đầu.");
      }
    });
  }

  function handleDownloadOriginal() {
    if (!file) return;
    downloadBlob(file, file.name);
  }

  function handleReset() {
    setFile(null);
    setSourceAnalysis(null);
    setPickableQuestions([]);
    setSelectedQuestionIds(null);
    setResults([]);
    setError(null);
    setReportText("");
    setSelfTestResults([]);
    setStatusText(null);
    setLog([]);
  }

  function sessionSettings(): MixerSessionSettings {
    return {
      variantCount: code.variantCount,
      firstCode: code.firstCode,
      codeStep: code.codeStep,
      fourDigits: code.fourDigits,
      customCodes: code.customCodes,
      groupSizes: rules.groupSizes,
      shuffleChoices: rules.shuffleChoices,
      dontShuffleTF: rules.dontShuffleTF,
      renumber: rules.renumber,
      outputStyle: rules.outputStyle,
      englishBlockMode: rules.englishBlockMode,
      autoDetectAnswers: rules.autoDetectAnswers,
      removeSolutions: rules.removeSolutions,
      injectHeader: !!header.injectHeader,
      removeOldHeader: !!header.removeOldHeader,
      candidateInfo: !!header.candidateInfo,
      agency: header.agency ?? "",
      examName: header.examName ?? "",
      school: header.school ?? "",
      subject: header.subject ?? "",
      dept: header.dept ?? "",
      duration: header.duration ?? "",
      examType: header.examType ?? "",
    };
  }

  function handleInspect() {
    if (!sourceAnalysis) return;
    setReportText(buildInspectReport(sourceAnalysis.analysis, sourceAnalysis.fileName));
    setStatusText("Đã phân tích nguồn — báo cáo tại màn hình.");
    setLog((l) => appendLogEntry(l, "Kiểm định nguồn", `${sourceAnalysis.analysis.total} câu`));
  }

  function handleRunSelfTest() {
    const test = runIntegrityTests();
    setSelfTestResults(test);
    setStatusText(`Tự kiểm thử: ${test.filter((t) => t.pass).length}/${test.length} đạt.`);
  }

  function handleSaveSession() {
    saveMixerSession(sessionSettings());
    setStatusText("Đã lưu thiết lập trộn. Không lưu tệp Word hay API key.");
  }

  function handleRestoreSession() {
    const restored = restoreMixerSession();
    if (!restored) {
      setStatusText("Chưa có thiết lập đã lưu.");
      return;
    }
    setCode({
      mode: "auto",
      variantCount: restored.variantCount,
      firstCode: restored.firstCode,
      codeStep: restored.codeStep,
      fourDigits: restored.fourDigits,
      customCodes: restored.customCodes,
    });
    setRules({
      shuffleChoices: restored.shuffleChoices,
      dontShuffleTF: restored.dontShuffleTF,
      renumber: restored.renumber,
      outputStyle: restored.outputStyle,
      englishBlockMode: restored.englishBlockMode,
      autoDetectAnswers: restored.autoDetectAnswers,
      removeSolutions: restored.removeSolutions,
      groupSizes: restored.groupSizes,
    });
    setHeader({
      agency: restored.agency,
      examName: restored.examName,
      school: restored.school,
      subject: restored.subject,
      dept: restored.dept,
      duration: restored.duration,
      examType: restored.examType,
      injectHeader: restored.injectHeader,
      removeOldHeader: restored.removeOldHeader,
      candidateInfo: restored.candidateInfo,
    });
    setStatusText("Đã khôi phục thiết lập, hãy chọn lại đề Word gốc. Không tự khôi phục dữ liệu đề vì lý do an toàn.");
  }

  function handleDownloadReport() {
    downloadBlob(
      new Blob([reportText || "Chưa kiểm định"], { type: "text/plain;charset=utf-8" }),
      "EXAMMIX_KIEM_DINH.txt",
    );
  }

  function handleDownloadHistory() {
    downloadBlob(new Blob([formatHistoryLog(log)], { type: "text/plain;charset=utf-8" }), "EXAMMIX_NHAT_KY.txt");
  }

  function handlePrintSheet() {
    const counts = sourceAnalysis?.analysis.counts ?? { mcq: 0, tf: 0, short: 0 };
    const html = buildAnswerSheetHtml({ mcqCount: counts.mcq || 0, tfCount: counts.tf || 0, shortCount: counts.short || 0 });
    downloadBlob(new Blob([html], { type: "text/html;charset=utf-8" }), "Phieu_tra_loi.html");
  }

  const counts = sourceAnalysis?.analysis.counts;
  const codesPreview = resolveCodes(code);

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-[18px] border border-border bg-panel p-5 shadow-[var(--shadow-soft)]">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-text">Chọn đề gốc (.docx)</h2>
          <div className="flex gap-2">
            <Button variant={mode === "easy" ? "blue" : "gray"} onClick={() => setMode("easy")}>
              Trộn nhanh
            </Button>
            <Button variant={mode === "advanced" ? "blue" : "gray"} onClick={() => setMode("advanced")}>
              Nâng cao
            </Button>
          </div>
        </div>

        <FileDropzone
          accept=".docx"
          label={file ? `Đã chọn: ${file.name}` : "Kéo thả hoặc bấm để chọn file .docx"}
          onFile={(f) => {
            setFile(f);
            setSourceAnalysis(null);
            setResults([]);
          }}
        />

        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="gray" onClick={handleAnalyze} disabled={!file || isPending}>
            🔍 Kiểm tra
          </Button>
          {sourceAnalysis ? (
            <span className="self-center text-xs text-muted">
              Tổng <b>{sourceAnalysis.analysis.total}</b> · Phần I <b>{counts?.mcq ?? 0}</b> · Phần II{" "}
              <b>{counts?.tf ?? 0}</b> · Phần III <b>{counts?.short ?? 0}</b> · Phần IV <b>{counts?.essay ?? 0}</b> ·
              Đáp án <b>{sourceAnalysis.analysis.found}</b>
            </span>
          ) : null}
        </div>

        <p className="mt-2 text-xs text-brand-orange">🔒 Đề gốc luôn được giữ nguyên; mọi thao tác chỉ tạo bản sao.</p>

        {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
      </div>

      {mode === "easy" ? (
        <div className="rounded-[18px] border border-border bg-panel p-5 shadow-[var(--shadow-soft)]">
          <h2 className="mb-4 text-base font-semibold text-text">Trộn đề nhanh — 3 bước</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Số mã đề">
              <Input
                type="number"
                min={1}
                max={50}
                value={code.variantCount}
                onChange={(e) => setCode({ ...code, variantCount: Number(e.target.value) || 1 })}
              />
            </FormField>
            <FormField label="Tên đề thi">
              <Input value={header.examName ?? ""} onChange={(e) => setHeader({ ...header, examName: e.target.value })} />
            </FormField>
          </div>
          <p className="mt-2 text-xs text-muted">Mã đề: {codesPreview.join(", ")}</p>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="gray" onClick={handleApplyRecommended}>
              ⭐ Cấu hình khuyên dùng
            </Button>
            <Button onClick={handleMixAndExport} disabled={!sourceAnalysis || isPending}>
              {isPending ? "Đang trộn đề..." : "🚀 TRỘN & XUẤT"}
            </Button>
            <Button variant="gray" onClick={handlePreviewFirst} disabled={!sourceAnalysis || isPending}>
              👁 Xem thử mã đầu
            </Button>
            <Button variant="gray" onClick={handleReset}>
              ↻ Làm lại
            </Button>
          </div>

          {results.length > 0 ? (
            <div className="mt-4 rounded-[12px] border border-success/40 bg-success/10 p-3 text-sm text-success">
              ✅ ĐÃ TRỘN THÀNH CÔNG — {results.length} mã đề: {results.map((r) => r.code).join(", ")}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <ExamMixerHeaderFields value={header} onChange={setHeader} />
          <ExamMixerQuestionPicker
            items={pickableQuestions}
            selectedIds={selectedQuestionIds}
            onChange={setSelectedQuestionIds}
            disabled={!sourceAnalysis}
          />
          <ExamMixerGuide />
          <ExamMixerCodeAndRules
            code={code}
            onCodeChange={setCode}
            rules={rules}
            onRulesChange={setRules}
            fixed={fixed}
            onFixedChange={setFixed}
          />
          <ExamMixerOutputSelect value={outputSelection} onChange={setOutputSelection} />
          <ExamMixerVerificationPanel
            reportText={reportText}
            selfTestResults={selfTestResults}
            historyText={formatHistoryLog(log)}
            statusText={statusText}
            onInspect={handleInspect}
            onRunSelfTest={handleRunSelfTest}
            onSaveSession={handleSaveSession}
            onRestoreSession={handleRestoreSession}
            onDownloadReport={handleDownloadReport}
            onDownloadHistory={handleDownloadHistory}
            onPrintSheet={handlePrintSheet}
            disabled={!sourceAnalysis}
          />

          <div className="rounded-[18px] border border-border bg-panel p-5 shadow-[var(--shadow-soft)]">
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleMixAndExport} disabled={!sourceAnalysis || isPending}>
                {isPending ? "Đang trộn đề..." : "🚀 TRỘN & XUẤT ĐỀ"}
              </Button>
              <Button variant="gray" onClick={handleDownloadOriginal} disabled={!file}>
                Đề gốc
              </Button>
              <Button variant="gray" onClick={handleReset}>
                Làm mới
              </Button>
            </div>

            {results.length > 0 ? (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Badge tone="green">✅ Đã trộn {results.length} mã đề</Badge>
                {results.map((r) => (
                  <Badge key={r.code} tone="blue">
                    Mã {r.code}
                  </Badge>
                ))}
              </div>
            ) : null}

            {log.length > 0 ? (
              <div className="mt-4 max-h-40 overflow-y-auto rounded-[10px] border border-border bg-panel-2 p-3 font-mono text-xs text-muted">
                {log.map((entry, i) => (
                  <div key={i}>
                    [{entry.at}] {entry.event}: {entry.info}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
