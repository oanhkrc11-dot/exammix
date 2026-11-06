"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Default model id — Google renames/retires Gemini model ids periodically;
// bump this constant if generateWithGemini starts returning 404s.
const GEMINI_MODEL = "gemini-2.5-flash";

export async function saveGeminiKey(apiKey: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Chưa đăng nhập.");

  const { error } = await supabase
    .from("profiles")
    .update({ gemini_api_key: apiKey.trim() || null })
    .eq("id", user.id);
  if (error) throw new Error(error.message);

  revalidatePath("/gemini-ai");
}

export async function hasGeminiKey(): Promise<boolean> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data } = await supabase.from("profiles").select("gemini_api_key").eq("id", user.id).single();
  return Boolean(data?.gemini_api_key);
}

export async function generateWithGemini(prompt: string): Promise<string> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Chưa đăng nhập.");

  const { data: profile } = await supabase
    .from("profiles")
    .select("gemini_api_key")
    .eq("id", user.id)
    .single();
  const apiKey = profile?.gemini_api_key;
  if (!apiKey) throw new Error("Chưa cấu hình Gemini API key. Hãy nhập key ở trên.");

  // Server-side call only — the key never reaches the browser, unlike the
  // legacy app's direct client-side fetch to this same endpoint.
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    },
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Gemini API lỗi (${res.status}): ${body.slice(0, 300) || res.statusText}`);
  }

  const json = await res.json();
  const text = json?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
  if (!text) throw new Error("Gemini không trả về nội dung. Hãy thử lại với yêu cầu khác.");
  return text;
}
