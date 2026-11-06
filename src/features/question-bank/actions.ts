"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Question } from "@/lib/supabase/types";

export type QuestionInput = Pick<Question, "subject" | "topic" | "type" | "content" | "answer">;

export async function listQuestions(): Promise<Question[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("questions")
    .select("*")
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function addQuestion(input: QuestionInput) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Chưa đăng nhập.");

  const { error } = await supabase.from("questions").insert({
    ...input,
    user_id: user.id,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/question-bank");
}

export async function deleteQuestion(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("questions").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/question-bank");
}

// Mirrors the legacy import behaviour: the uploaded JSON must be a top-level
// array, and importing REPLACES the current user's whole question bank.
export async function importQuestions(items: QuestionInput[]) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Chưa đăng nhập.");

  const { error: deleteError } = await supabase
    .from("questions")
    .delete()
    .eq("user_id", user.id);
  if (deleteError) throw new Error(deleteError.message);

  if (items.length > 0) {
    const { error: insertError } = await supabase.from("questions").insert(
      items.map((item) => ({ ...item, user_id: user.id })),
    );
    if (insertError) throw new Error(insertError.message);
  }

  revalidatePath("/question-bank");
}
