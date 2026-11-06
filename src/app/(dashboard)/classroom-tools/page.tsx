import { ClassroomToolsPanel } from "@/components/organisms/ClassroomToolsPanel";
import { listClasses } from "@/features/classroom/actions";
import { listQuestions } from "@/features/question-bank/actions";

export default async function ClassroomToolsPage() {
  const [classes, questions] = await Promise.all([listClasses(), listQuestions()]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold text-text">Lớp học LIVE</h1>
        <p className="mt-1 text-sm text-muted">
          Bộ công cụ cho lớp học: quản lý danh sách, quay số gọi tên, bảng điểm, buzzer, đồng hồ đếm giờ và bốc câu hỏi.
        </p>
      </div>
      <ClassroomToolsPanel initialClasses={classes} initialQuestions={questions} />
    </div>
  );
}
