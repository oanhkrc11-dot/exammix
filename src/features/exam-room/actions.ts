"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ExamRoom, ExamRoomParticipant, ExamRoomVariant } from "@/lib/supabase/types";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I to avoid confusion

function randomJoinCode(length = 6): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

export interface CreateRoomInput {
  name: string;
  durationMinutes: number;
  scale: number;
  autoSubmit: boolean;
  showScoreAfterSubmit: boolean;
  variants: { code: string; answerKey: string }[];
}

export async function createRoom(input: CreateRoomInput): Promise<ExamRoom> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Chưa đăng nhập.");
  if (input.variants.length === 0) throw new Error("Cần ít nhất một mã đề với đáp án.");

  let room: ExamRoom | null = null;
  for (let attempt = 0; attempt < 5 && !room; attempt++) {
    const { data, error } = await supabase
      .from("exam_rooms")
      .insert({
        user_id: user.id,
        name: input.name || "Phòng thi",
        join_code: randomJoinCode(),
        duration_minutes: input.durationMinutes,
        scale: input.scale,
        auto_submit: input.autoSubmit,
        show_score_after_submit: input.showScoreAfterSubmit,
      })
      .select("*")
      .single();

    if (!error) room = data;
    else if (!error.message.includes("duplicate key")) throw new Error(error.message);
  }
  if (!room) throw new Error("Không thể tạo mã phòng, hãy thử lại.");

  const { error: variantsError } = await supabase.from("exam_room_variants").insert(
    input.variants.map((v) => ({ room_id: room!.id, code: v.code, answer_key: v.answerKey })),
  );
  if (variantsError) throw new Error(variantsError.message);

  revalidatePath("/exam-room");
  return room;
}

export async function listRooms(): Promise<ExamRoom[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("exam_rooms")
    .select("*")
    .order("created_at", { ascending: false });
  return data ?? [];
}

export interface RoomDetail {
  room: ExamRoom;
  variants: ExamRoomVariant[];
  participants: ExamRoomParticipant[];
}

export async function getRoomDetail(roomId: string): Promise<RoomDetail> {
  const supabase = await createClient();
  const [{ data: room }, { data: variants }, { data: participants }] = await Promise.all([
    supabase.from("exam_rooms").select("*").eq("id", roomId).single(),
    supabase.from("exam_room_variants").select("*").eq("room_id", roomId),
    supabase
      .from("exam_room_participants")
      .select("*")
      .eq("room_id", roomId)
      .order("joined_at", { ascending: false }),
  ]);
  if (!room) throw new Error("Không tìm thấy phòng thi.");
  return { room, variants: variants ?? [], participants: participants ?? [] };
}

export async function openRoom(roomId: string) {
  const supabase = await createClient();
  const { data: room } = await supabase.from("exam_rooms").select("duration_minutes").eq("id", roomId).single();
  if (!room) throw new Error("Không tìm thấy phòng thi.");

  const startedAt = new Date();
  const endsAt = new Date(startedAt.getTime() + room.duration_minutes * 60_000);

  const { error } = await supabase
    .from("exam_rooms")
    .update({ status: "open", started_at: startedAt.toISOString(), ends_at: endsAt.toISOString() })
    .eq("id", roomId);
  if (error) throw new Error(error.message);

  revalidatePath(`/exam-room/${roomId}`);
}

export async function closeRoom(roomId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("exam_rooms").update({ status: "closed" }).eq("id", roomId);
  if (error) throw new Error(error.message);

  revalidatePath(`/exam-room/${roomId}`);
}

export async function deleteRoom(roomId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("exam_rooms").delete().eq("id", roomId);
  if (error) throw new Error(error.message);

  revalidatePath("/exam-room");
}
