import { ExamMixerPanel } from "@/components/organisms/ExamMixerPanel";

export default function ExamMixerPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold text-text">Trộn đề thi</h1>
        <p className="mt-1 text-sm text-muted">
          Tải lên đề Word (.docx), tạo nhiều mã đề với thứ tự câu/đáp án được trộn ngẫu nhiên.
        </p>
      </div>
      <ExamMixerPanel />
    </div>
  );
}
