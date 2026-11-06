"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Role } from "@/lib/supabase/types";

export interface AdminUserRow {
  id: string;
  email: string | null;
  displayName: string | null;
  role: Role;
  createdAt: string;
  banned: boolean;
}

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Chưa đăng nhập.");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") throw new Error("Không có quyền truy cập.");
  return user;
}

export async function listUsers(): Promise<AdminUserRow[]> {
  await requireAdmin();

  const supabase = await createClient();
  const { data: profiles } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  const admin = createAdminClient();
  const rows: AdminUserRow[] = [];

  for (const profile of profiles ?? []) {
    const { data: authUser } = await admin.auth.admin.getUserById(profile.id);
    rows.push({
      id: profile.id,
      email: authUser?.user?.email ?? null,
      displayName: profile.display_name,
      role: profile.role,
      createdAt: profile.created_at,
      banned: Boolean(
        authUser?.user?.banned_until && new Date(authUser.user.banned_until) > new Date(),
      ),
    });
  }

  return rows;
}

export async function setUserRole(userId: string, role: Role) {
  const current = await requireAdmin();
  if (current.id === userId && role !== "admin") {
    throw new Error("Không thể tự hạ quyền của chính mình.");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ role }).eq("id", userId);
  if (error) throw new Error(error.message);

  revalidatePath("/admin");
}

export async function setUserBanned(userId: string, banned: boolean) {
  const current = await requireAdmin();
  if (current.id === userId) throw new Error("Không thể tự khóa chính mình.");

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: banned ? "876000h" : "none",
  });
  if (error) throw new Error(error.message);

  revalidatePath("/admin");
}

export interface AdminStats {
  userCount: number;
  questionCount: number;
  examResultCount: number;
}

export async function getAdminStats(): Promise<AdminStats> {
  await requireAdmin();
  const supabase = await createClient();

  const [{ count: userCount }, { count: questionCount }, { count: examResultCount }] =
    await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("questions").select("id", { count: "exact", head: true }),
      supabase.from("exam_results").select("id", { count: "exact", head: true }),
    ]);

  return {
    userCount: userCount ?? 0,
    questionCount: questionCount ?? 0,
    examResultCount: examResultCount ?? 0,
  };
}
