// New helper logic backing the "☑ Chọn câu trước khi trộn" (em217) panel.
// Legacy's em217* functions are pure UI-state glue over analyzeSourceXml's
// already-ported output (issueRecords) — reimplemented directly in TS here
// rather than ported, same reasoning as mixerSession.ts.

export type QuestionKind = "mcq" | "tf" | "short" | "essay" | "other";

export interface PickableQuestion {
  /** originalIndex — the id buildVariant's opts.em217SelectedIds expects. */
  id: number;
  num: number;
  type: QuestionKind;
  preview: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extractPickableQuestions(analysis: any): PickableQuestion[] {
  return ((analysis?.issueRecords as unknown[]) || []).map((r) => {
    const rec = r as { originalIndex: number; number: number; type: QuestionKind; preview?: string };
    return { id: rec.originalIndex, num: rec.number, type: rec.type, preview: rec.preview || "" };
  });
}

function shuffleIds<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function selectAllIds(items: PickableQuestion[]): Set<number> {
  return new Set(items.map((q) => q.id));
}

export function selectRandomN(items: PickableQuestion[], n: number): Set<number> {
  const clamped = Math.max(0, Math.min(n, items.length));
  return new Set(shuffleIds(items.map((q) => q.id)).slice(0, clamped));
}

export type SectionCounts = Partial<Record<"mcq" | "tf" | "short" | "essay", number>>;

export function selectRandomByType(items: PickableQuestion[], counts: SectionCounts): Set<number> {
  const selected = new Set<number>();
  (Object.keys(counts) as (keyof SectionCounts)[]).forEach((type) => {
    const want = counts[type] || 0;
    if (want <= 0) return;
    const pool = items.filter((q) => q.type === type).map((q) => q.id);
    shuffleIds(pool)
      .slice(0, Math.min(want, pool.length))
      .forEach((id) => selected.add(id));
  });
  return selected;
}

export function countByType(items: PickableQuestion[], type: QuestionKind): number {
  return items.filter((q) => q.type === type).length;
}

export function filterQuestions(
  items: PickableQuestion[],
  { query, type }: { query?: string; type?: QuestionKind | "" },
): PickableQuestion[] {
  const q = (query || "").toLocaleLowerCase();
  return items.filter(
    (item) =>
      (!type || item.type === type) &&
      (!q || String(item.num).includes(q) || item.preview.toLocaleLowerCase().includes(q)),
  );
}

export const QUESTION_TYPE_LABEL: Record<QuestionKind, string> = {
  mcq: "Phần I — Trắc nghiệm",
  tf: "Phần II — Đúng/Sai",
  short: "Phần III — Trả lời ngắn",
  essay: "Phần IV — Tự luận",
  other: "Khác",
};
