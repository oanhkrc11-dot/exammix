import { OmrGraderPanel } from "@/components/organisms/OmrGraderPanel";

export default function OmrPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold text-text">Chấm điểm nhanh</h1>
        <p className="mt-1 text-sm text-muted">
          So đáp án trắc nghiệm (A-D) và in phiếu trả lời.
        </p>
      </div>
      <OmrGraderPanel />
    </div>
  );
}
