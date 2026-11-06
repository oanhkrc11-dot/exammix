"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { CustomLab } from "@/lib/supabase/types";

export async function listCustomLabs(): Promise<CustomLab[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("custom_labs")
    .select("*")
    .order("created_at", { ascending: false });
  return data ?? [];
}

export interface AddCustomLabInput {
  kind: "lab" | "game";
  subject: string;
  grade: string;
  title: string;
  description: string;
  contentHtml?: string;
  contentUrl?: string;
}

export async function addCustomLab(input: AddCustomLabInput): Promise<CustomLab> {
  if (!input.contentHtml && !input.contentUrl) {
    throw new Error("Cần tải lên file .html hoặc nhập đường dẫn.");
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Chưa đăng nhập.");

  const { data, error } = await supabase
    .from("custom_labs")
    .insert({
      user_id: user.id,
      kind: input.kind,
      subject: input.subject,
      grade: input.grade,
      title: input.title || "Thí nghiệm tùy chỉnh",
      description: input.description,
      content_html: input.contentHtml ?? null,
      content_url: input.contentUrl ?? null,
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Không thể thêm thí nghiệm.");

  revalidatePath("/virtual-lab");
  return data;
}

export async function deleteCustomLab(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("custom_labs").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/virtual-lab");
}
