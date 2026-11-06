"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { gradeQuick } from "@/lib/logic/scoring";

// Students never sign in — these actions run with the service-role client
// (bypasses RLS by design) and enforce every rule themselves: the join code
// is the only "secret" gating access, and `client_token` (handed back on
// join, stored in the browser) is the only proof needed to submit as that
// same participant later. See supabase/schema.sql for why
// exam_room_participants intentionally has no anon insert/update policies.

export interface JoinRoomResult {
  participantId: string;
  clientToken: string;
  roomId: string;
  roomName: string;
  variantCode: string;
  totalQuestions: number;
  endsAt: string | null;
  autoSubmit: boolean;
  showScoreAfterSubmit: boolean;
}

export async function joinRoom(
  joinCode: string,
  displayName: string,
  className: string,
  variantCode: string,
): Promise<JoinRoomResult> {
  if (!displayName.trim()) throw new Error("Vui lòng nhập họ tên.");

  const admin = createAdminClient();
  const { data: room } = await admin
    .from("exam_rooms")
    .select("*")
    .eq("join_code", joinCode.trim().toUpperCase())
    .single();

  if (!room) throw new Error("Mã phòng không đúng.");
  if (room.status !== "open") throw new Error("Phòng thi chưa mở hoặc đã đóng.");

  const { data: variant } = await admin
    .from("exam_room_variants")
    .select("*")
    .eq("room_id", room.id)
    .eq("code", variantCode)
    .single();
  if (!variant) throw new Error("Mã đề không hợp lệ cho phòng này.");

  const { data: participant, error } = await admin
    .from("exam_room_participants")
    .insert({
      room_id: room.id,
      display_name: displayName.trim(),
      class_name: className.trim(),
      variant_code: variantCode,
    })
    .select("*")
    .single();
  if (error || !participant) throw new Error(error?.message ?? "Không thể vào phòng thi.");

  return {
    participantId: participant.id,
    clientToken: participant.client_token,
    roomId: room.id,
    roomName: room.name,
    variantCode,
    totalQuestions: variant.answer_key.length,
    endsAt: room.ends_at,
    autoSubmit: room.auto_submit,
    showScoreAfterSubmit: room.show_score_after_submit,
  };
}

export interface SubmitRoomAnswersResult {
  correct: number;
  total: number;
  score: number;
  showScore: boolean;
}

export async function submitRoomAnswers(
  participantId: string,
  clientToken: string,
  studentAnswers: string,
): Promise<SubmitRoomAnswersResult> {
  const admin = createAdminClient();

  const { data: participant } = await admin
    .from("exam_room_participants")
    .select("*")
    .eq("id", participantId)
    .single();
  if (!participant || participant.client_token !== clientToken) {
    throw new Error("Không xác thực được bài làm. Hãy vào lại phòng thi.");
  }
  if (participant.status === "submitted") {
    return {
      correct: participant.correct ?? 0,
      total: participant.total ?? 0,
      score: participant.score ?? 0,
      showScore: true,
    };
  }

  const { data: room } = await admin
    .from("exam_rooms")
    .select("*")
    .eq("id", participant.room_id)
    .single();
  const { data: variant } = await admin
    .from("exam_room_variants")
    .select("*")
    .eq("room_id", participant.room_id)
    .eq("code", participant.variant_code)
    .single();
  if (!room || !variant) throw new Error("Không tìm thấy phòng thi hoặc mã đề.");

  const result = gradeQuick(variant.answer_key, studentAnswers, room.scale);

  const { error } = await admin
    .from("exam_room_participants")
    .update({
      status: "submitted",
      student_answers: studentAnswers,
      correct: result.correct,
      total: result.total,
      score: result.score,
      submitted_at: new Date().toISOString(),
    })
    .eq("id", participantId);
  if (error) throw new Error(error.message);

  // Mirror into exam_results so the room's grades also show up in the
  // teacher's existing Thống kê page, same as a manual OMR entry would.
  await admin.from("exam_results").insert({
    user_id: room.user_id,
    student_name: participant.display_name,
    class_name: participant.class_name,
    exam_code: participant.variant_code,
    correct: result.correct,
    total: result.total,
    score: result.score,
  });

  return { correct: result.correct, total: result.total, score: result.score, showScore: room.show_score_after_submit };
}
