"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ExamResult } from "@/lib/supabase/types";

export async function listResults(): Promise<ExamResult[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("exam_results")
    .select("*")
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function clearResults() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Chưa đăng nhập.");

  const { error } = await supabase.from("exam_results").delete().eq("user_id", user.id);
  if (error) throw new Error(error.message);

  revalidatePath("/stats");
}
