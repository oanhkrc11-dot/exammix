"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ExamMixConfig } from "@/lib/supabase/types";

export async function listExamMixConfigs(): Promise<ExamMixConfig[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("exam_mix_configs")
    .select("*")
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function saveExamMixConfig(name: string, config: Record<string, unknown>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Chưa đăng nhập.");

  const { error } = await supabase.from("exam_mix_configs").insert({
    user_id: user.id,
    name,
    config,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/exam-mixer");
}

export async function deleteExamMixConfig(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("exam_mix_configs").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/exam-mixer");
}
