import { ExamRoomDetail } from "@/components/organisms/ExamRoomDetail";
import { getRoomDetail } from "@/features/exam-room/actions";

export default async function ExamRoomDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getRoomDetail(id);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold text-text">{detail.room.name}</h1>
        <p className="mt-1 text-sm text-muted">{detail.room.duration_minutes} phút làm bài</p>
      </div>
      <ExamRoomDetail initial={detail} />
    </div>
  );
}
