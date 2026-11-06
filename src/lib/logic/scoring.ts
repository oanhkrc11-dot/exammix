// Ported verbatim from the legacy gradeQuick() (index.html:8945): both
// strings are uppercased and stripped to [ABCD] only, then compared
// char-by-char up to the answer key's length. The student string is not
// separately length-validated — a shorter student string just means the
// missing positions compare as wrong (undefined !== letter).
export interface GradeQuickResult {
  key: string;
  student: string;
  correct: number;
  total: number;
  score: number;
}

export function gradeQuick(rawKey: string, rawStudent: string, scale = 10): GradeQuickResult {
  const key = rawKey.toUpperCase().replace(/[^ABCD]/g, "");
  const student = rawStudent.toUpperCase().replace(/[^ABCD]/g, "");

  let correct = 0;
  for (let i = 0; i < key.length; i++) {
    if (student[i] === key[i]) correct++;
  }

  const total = key.length;
  const score = total === 0 ? 0 : Math.round((correct / total) * scale * 100) / 100;

  return { key, student, correct, total, score };
}
