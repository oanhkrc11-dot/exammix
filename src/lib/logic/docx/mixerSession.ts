// New, non-ported helper logic for the "🛡 Kiểm định nâng cao" (em215) and
// question-selector (em217) panels. These legacy functions are pure UI/state
// glue over the already-ported analyzeSourceXml/buildVariant pipeline (they
// read `document.getElementById(...)` and write to localStorage) — not OOXML
// mutation like legacy-mixer.ts — so they're reimplemented directly in TS/
// React state here instead of mechanically ported.

export const MIXER_SESSION_KEY = "em215_session";

export interface MixerSessionSettings {
  variantCount: number;
  firstCode: string;
  codeStep: number;
  fourDigits: boolean;
  customCodes: string;
  groupSizes: string;
  shuffleChoices: boolean;
  dontShuffleTF: boolean;
  renumber: boolean;
  outputStyle: "standard" | "keep";
  englishBlockMode: boolean;
  autoDetectAnswers: boolean;
  removeSolutions: boolean;
  injectHeader: boolean;
  removeOldHeader: boolean;
  candidateInfo: boolean;
  agency: string;
  examName: string;
  school: string;
  subject: string;
  dept: string;
  duration: string;
  examType: string;
}

export function saveMixerSession(settings: MixerSessionSettings) {
  try {
    localStorage.setItem(MIXER_SESSION_KEY, JSON.stringify({ version: 1, settings }));
    return true;
  } catch {
    return false;
  }
}

export function restoreMixerSession(): MixerSessionSettings | null {
  try {
    const raw = JSON.parse(localStorage.getItem(MIXER_SESSION_KEY) || "null");
    if (!raw || raw.version !== 1) return null;
    return raw.settings as MixerSessionSettings;
  } catch {
    return null;
  }
}

export const RECOMMENDED_MIX_SETTINGS = {
  shuffleChoices: true,
  dontShuffleTF: false,
  renumber: true,
  removeSolutions: true,
  autoDetectAnswers: true,
  englishBlockMode: true,
  outputStyle: "standard" as const,
  outDocx: true,
  outAnswerDoc: true,
};

export interface MixLogEntry {
  at: string;
  event: string;
  info: string;
}

export function appendLogEntry(log: MixLogEntry[], event: string, info: string): MixLogEntry[] {
  const entry: MixLogEntry = { at: new Date().toLocaleTimeString("vi-VN"), event, info };
  return [...log, entry];
}

export function formatHistoryLog(log: MixLogEntry[]): string {
  return log.length
    ? log.map((x) => `[${x.at}] ${x.event}: ${x.info}`).join("\n")
    : "Chưa có nhật ký.";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildInspectReport(analysis: any, fileName: string): string {
  const spaces = (analysis.warnings || []).filter((w: string) => / {2,}/.test(w)).length;
  const lines = [
    `ĐỀ: ${fileName}`,
    `Câu: ${analysis.total}; đáp án nhận diện: ${analysis.found}; lỗi chặn: ${(analysis.fatalErrors || []).length}; cảnh báo: ${(analysis.warnings || []).length}`,
    analysis.englishDetected ? `Đề Tiếng Anh theo khối: ${(analysis.englishBlocks || []).length} khối.` : "",
    "",
    "LỖI VÀ CẢNH BÁO:",
    ...(analysis.fatalErrors || []).map((x: string) => "⛔ " + x),
    ...(analysis.warnings || []).map((x: string) => "⚠ " + x),
    ...(analysis.infos || []).map((x: string) => "ℹ " + x),
    "",
    "Tệp gốc KHÔNG được chỉnh sửa. Đối tượng Equation/MathType có thể không biểu diễn đầy đủ trong xem trước.",
  ].filter(Boolean);
  void spaces;
  return lines.join("\n");
}

function normalizeForCompare(t: string): string {
  return String(t || "")
    .normalize("NFC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.,;:!?]/g, "")
    .trim();
}

function textSimilarity(a: string, b: string): number {
  const A = new Set(normalizeForCompare(a).split(" ").filter(Boolean));
  const B = new Set(normalizeForCompare(b).split(" ").filter(Boolean));
  if (!A.size || !B.size) return 0;
  let n = 0;
  for (const x of A) if (B.has(x)) n++;
  return n / (A.size + B.size - n);
}

export interface SelfTestResult {
  name: string;
  pass: boolean;
  message?: string;
}

/** Mirrors legacy em215Tests: pure unit tests of the normalize/similarity helpers. */
export function runIntegrityTests(): SelfTestResult[] {
  const tests: [string, () => boolean][] = [
    ["Không nhầm đơn vị 0 K và 0 °F", () => normalizeForCompare("0 K") !== normalizeForCompare("0 °F")],
    [
      "Nhận trùng do khoảng trắng",
      () => normalizeForCompare("Câu  1.  Đáp án") === normalizeForCompare("Câu 1. Đáp án"),
    ],
    ["Không nhầm công thức có dấu khác", () => normalizeForCompare("T = t + 273") !== normalizeForCompare("T = t - 273")],
    [
      "Tương đồng câu nguyên văn",
      () => textSimilarity("một vật chuyển động thẳng", "một vật chuyển động thẳng") === 1,
    ],
  ];
  return tests.map(([name, fn]) => {
    try {
      const pass = fn();
      return { name, pass, message: pass ? undefined : "Sai kết quả" };
    } catch (e) {
      return { name, pass: false, message: e instanceof Error ? e.message : String(e) };
    }
  });
}

export { textSimilarity };
