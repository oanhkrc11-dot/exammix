import { ExamRoomPanel } from "@/components/organisms/ExamRoomPanel";
import { listRooms } from "@/features/exam-room/actions";

export default async function ExamRoomPage() {
  const rooms = await listRooms();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold text-text">Phòng thi trực tuyến</h1>
        <p className="mt-1 text-sm text-muted">
          Tạo phòng thi, chia sẻ mã/QR cho học sinh, theo dõi và chấm điểm theo thời gian thực.
        </p>
      </div>
      <ExamRoomPanel initialRooms={rooms} />
    </div>
  );
}
