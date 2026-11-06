"use client";

import { Button, Textarea } from "@/components/atoms";
import type { SelfTestResult } from "@/lib/logic/docx/mixerSession";

// Mirrors legacy's "🛡 KIỂM ĐỊNH NÂNG CAO · V21.5" (em215) panel
// (Exam_mix_6_nov.html:3447-3471 action row). All data here comes from the
// already-ported analyzeSourceXml output — the report/self-test/session
// logic itself is new TS in mixerSession.ts, not an OOXML port.
export function ExamMixerVerificationPanel({
  reportText,
  selfTestResults,
  historyText,
  statusText,
  onInspect,
  onRunSelfTest,
  onSaveSession,
  onRestoreSession,
  onDownloadReport,
  onDownloadHistory,
  onPrintSheet,
  disabled,
}: {
  reportText: string;
  selfTestResults: SelfTestResult[];
  historyText: string;
  statusText: string | null;
  onInspect: () => void;
  onRunSelfTest: () => void;
  onSaveSession: () => void;
  onRestoreSession: () => void;
  onDownloadReport: () => void;
  onDownloadHistory: () => void;
  onPrintSheet: () => void;
  disabled?: boolean;
}) {
  return (
    <details className="rounded-[14px] border border-border bg-panel-2 p-4">
      <summary className="cursor-pointer text-sm font-bold text-text">🛡 Kiểm định nâng cao</summary>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="gray" onClick={onInspect} disabled={disabled}>
          🔍 Kiểm định nguồn
        </Button>
        <Button variant="gray" onClick={onRunSelfTest}>
          🧪 Tự kiểm thử
        </Button>
        <Button variant="gray" onClick={onSaveSession}>
          💾 Lưu thiết lập
        </Button>
        <Button variant="gray" onClick={onRestoreSession}>
          ↩ Khôi phục thiết lập
        </Button>
        <Button variant="gray" onClick={onPrintSheet}>
          ▦ Phiếu trả lời
        </Button>
        <Button variant="gray" onClick={onDownloadReport} disabled={!reportText}>
          Tải báo cáo
        </Button>
        <Button variant="gray" onClick={onDownloadHistory}>
          📜 Tải nhật ký
        </Button>
      </div>

      {statusText ? <p className="mt-2 text-xs text-muted">{statusText}</p> : null}

      {selfTestResults.length > 0 ? (
        <ul className="mt-3 space-y-1 text-xs">
          {selfTestResults.map((t) => (
            <li key={t.name} className={t.pass ? "text-success" : "text-danger"}>
              {t.pass ? "✓" : "✗"} {t.name}
              {t.message ? `: ${t.message}` : ""}
            </li>
          ))}
        </ul>
      ) : null}

      {reportText ? (
        <Textarea readOnly value={reportText} rows={10} className="mt-3 font-mono text-xs" />
      ) : null}

      {historyText ? (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs text-muted">Nhật ký</summary>
          <Textarea readOnly value={historyText} rows={6} className="mt-2 font-mono text-xs" />
        </details>
      ) : null}
    </details>
  );
}
