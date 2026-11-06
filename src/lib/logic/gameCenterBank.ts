import type { Question } from "@/lib/supabase/types";

// Game Center (public/game-center/index.html, embedded verbatim from the
// legacy app) reads its shared question bank from
// localStorage['gc_bank_v96_sample_standard'] as a plain JSON array — see
// gcMapClassroomItem() in that file for the exact item shapes below. Its own
// .docx importer is non-functional in this port (missing WMF/EMF image
// decoder closure), so this bridges the app's own Supabase-backed Ngân hàng
// câu hỏi into that same localStorage key instead, since both the iframe and
// this app's pages share one browser origin.
export const GAME_CENTER_STORAGE_KEY = "gc_bank_v96_sample_standard";

interface GcBankItemBase {
  id: string;
  number: number;
  question: string;
  questionHtml: string;
  rich: 0;
  issues: string[];
  answerMethod: string;
}

type GcBankItem =
  | (GcBankItemBase & { type: "mcq"; options: string[]; optionHtml: string[]; answer: string })
  | (GcBankItemBase & { type: "short"; answer: string });

const OPTION_LINE = /^[ \t]*([A-D])[.)][ \t]*(.+)$/;

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Best-effort split of a freeform "Câu hỏi... A. ... B. ... C. ... D. ..."
// content string into a stem + 4 options — the question bank never stored
// these as separate fields (neither did the legacy app's), so this is a
// heuristic, not a guaranteed-correct parse.
function trySplitMcq(content: string): { stem: string; options: string[] } | null {
  const lines = content.split(/\r?\n/);
  const matches: { label: string; text: string; index: number }[] = [];
  lines.forEach((line, index) => {
    const m = line.match(OPTION_LINE);
    if (m) matches.push({ label: m[1], text: m[2].trim(), index });
  });
  if (matches.length !== 4 || matches.map((m) => m.label).join("") !== "ABCD") return null;

  const stem = lines.slice(0, matches[0].index).join("\n").trim();
  if (!stem) return null;
  return { stem, options: matches.map((m) => m.text) };
}

export function buildGameCenterBank(questions: Question[]): GcBankItem[] {
  return questions.map((q, i) => {
    const number = i + 1;
    const id = `q${number}`;
    const answerLetter = q.answer.trim().toUpperCase();
    const split = /^[A-D]$/.test(answerLetter) ? trySplitMcq(q.content) : null;

    if (split) {
      return {
        id,
        number,
        question: split.stem,
        questionHtml: escapeHtml(split.stem),
        rich: 0,
        issues: [],
        answerMethod: "Từ ngân hàng câu hỏi",
        type: "mcq",
        options: split.options,
        optionHtml: split.options.map(escapeHtml),
        answer: answerLetter,
      };
    }

    return {
      id,
      number,
      question: q.content,
      questionHtml: escapeHtml(q.content),
      rich: 0,
      issues: [],
      answerMethod: "Từ ngân hàng câu hỏi",
      type: "short",
      answer: q.answer.trim(),
    };
  });
}
