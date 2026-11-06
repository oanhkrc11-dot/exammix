"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ClassRoom } from "@/lib/supabase/types";

export async function listClasses(): Promise<ClassRoom[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("classes")
    .select("*")
    .order("created_at", { ascending: true });
  return data ?? [];
}

export async function createClass(name: string): Promise<ClassRoom> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Chưa đăng nhập.");

  const { data, error } = await supabase
    .from("classes")
    .insert({ user_id: user.id, name: name || "Lớp học", students: [] })
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Không thể tạo lớp.");
  return data;
}

export async function renameClass(id: string, name: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("classes").update({ name }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/classroom-tools");
}

export async function updateClassStudents(id: string, students: string[]) {
  const supabase = await createClient();
  const { error } = await supabase.from("classes").update({ students }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/classroom-tools");
}

export async function deleteClass(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("classes").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/classroom-tools");
}
