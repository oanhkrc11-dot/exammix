"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { gradeQuick } from "@/lib/logic/scoring";

export interface GradeAndSaveInput {
  studentName: string;
  className: string;
  examCode: string;
  answerKey: string;
  studentAnswers: string;
  scale: number;
}

export async function gradeAndSave(input: GradeAndSaveInput) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Chưa đăng nhập.");

  const result = gradeQuick(input.answerKey, input.studentAnswers, input.scale);

  const { error } = await supabase.from("exam_results").insert({
    user_id: user.id,
    student_name: input.studentName,
    class_name: input.className,
    exam_code: input.examCode,
    correct: result.correct,
    total: result.total,
    score: result.score,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/stats");
  return result;
}
