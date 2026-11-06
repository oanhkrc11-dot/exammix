"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Image from "next/image";
import QRCode from "qrcode";
import { Badge, Button } from "@/components/atoms";
import { StatTile } from "@/components/molecules";
import { closeRoom, openRoom, type RoomDetail } from "@/features/exam-room/actions";
import { createClient } from "@/lib/supabase/client";
import type { ExamRoomParticipant } from "@/lib/supabase/types";

export function ExamRoomDetail({ initial }: { initial: RoomDetail }) {
  const [room, setRoom] = useState(initial.room);
  const [participants, setParticipants] = useState(initial.participants);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const joinUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/join/${room.join_code}`;
  }, [room.join_code]);

  useEffect(() => {
    if (!joinUrl) return;
    QRCode.toDataURL(joinUrl, { width: 220 }).then(setQrDataUrl).catch(() => setQrDataUrl(null));
  }, [joinUrl]);

  // Live roster: the teacher is authenticated, so this subscription is
  // governed by the normal exam_room_participants SELECT RLS policy
  // (owner/admin only) — no service-role access happens on the client.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`exam-room-${room.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "exam_room_participants", filter: `room_id=eq.${room.id}` },
        (payload) => {
          setParticipants((prev) => {
            if (payload.eventType === "INSERT") {
              const row = payload.new as ExamRoomParticipant;
              return prev.some((p) => p.id === row.id) ? prev : [row, ...prev];
            }
            if (payload.eventType === "UPDATE") {
              const row = payload.new as ExamRoomParticipant;
              return prev.map((p) => (p.id === row.id ? row : p));
            }
            if (payload.eventType === "DELETE") {
              const oldRow = payload.old as Partial<ExamRoomParticipant>;
              return prev.filter((p) => p.id !== oldRow.id);
            }
            return prev;
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [room.id]);

  const submitted = participants.filter((p) => p.status === "submitted");
  const avgScore =
    submitted.length > 0
      ? Number((submitted.reduce((sum, p) => sum + (p.score ?? 0), 0) / submitted.length).toFixed(2))
      : 0;

  function handleOpen() {
    startTransition(async () => {
      await openRoom(room.id);
      setRoom((r) => ({ ...r, status: "open" }));
    });
  }

  function handleClose() {
    startTransition(async () => {
      await closeRoom(room.id);
      setRoom((r) => ({ ...r, status: "closed" }));
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <div className="flex flex-col items-center gap-3 rounded-[18px] border border-border bg-panel p-5 text-center shadow-[var(--shadow-soft)]">
          <Badge tone={room.status === "open" ? "green" : room.status === "closed" ? "red" : "gray"}>
            {room.status === "open" ? "Đang mở" : room.status === "closed" ? "Đã đóng" : "Chưa mở"}
          </Badge>
          <div className="text-3xl font-bold tracking-widest text-text">{room.join_code}</div>
          {qrDataUrl ? (
            <Image src={qrDataUrl} alt="Mã QR vào phòng thi" width={176} height={176} unoptimized className="h-44 w-44" />
          ) : null}
          <p className="break-all text-xs text-muted">{joinUrl}</p>
          <div className="flex gap-2">
            {room.status !== "open" ? (
              <Button onClick={handleOpen} disabled={isPending}>
                Mở phòng
              </Button>
            ) : (
              <Button variant="red" onClick={handleClose} disabled={isPending}>
                Đóng phòng
              </Button>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <StatTile label="Đã vào phòng" value={participants.length} />
          <StatTile label="Đã nộp bài" value={submitted.length} />
          <StatTile label="Điểm TB" value={avgScore} />
        </div>
      </div>

      <div className="overflow-x-auto rounded-[18px] border border-border bg-panel shadow-[var(--shadow-soft)]">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-muted">
            <tr>
              <th className="px-4 py-3">Học sinh</th>
              <th className="px-4 py-3">Lớp</th>
              <th className="px-4 py-3">Mã đề</th>
              <th className="px-4 py-3">Trạng thái</th>
              <th className="px-4 py-3">Đúng/Tổng</th>
              <th className="px-4 py-3">Điểm</th>
            </tr>
          </thead>
          <tbody>
            {participants.map((p) => (
              <tr key={p.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3">{p.display_name}</td>
                <td className="px-4 py-3">{p.class_name}</td>
                <td className="px-4 py-3">{p.variant_code}</td>
                <td className="px-4 py-3">
                  <Badge tone={p.status === "submitted" ? "green" : "orange"}>
                    {p.status === "submitted" ? "Đã nộp" : "Đang làm"}
                  </Badge>
                </td>
                <td className="px-4 py-3">{p.status === "submitted" ? `${p.correct}/${p.total}` : "—"}</td>
                <td className="px-4 py-3 font-semibold">{p.status === "submitted" ? p.score : "—"}</td>
              </tr>
            ))}
            {participants.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted">
                  Chưa có học sinh nào vào phòng.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
