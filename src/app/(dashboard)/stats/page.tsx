import { StatsPanel } from "@/components/organisms/StatsPanel";
import { listResults } from "@/features/stats/actions";

export default async function StatsPage() {
  const results = await listResults();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold text-text">Thống kê</h1>
        <p className="mt-1 text-sm text-muted">
          Kết quả chấm điểm nhanh và xuất báo cáo Excel.
        </p>
      </div>
      <StatsPanel initialResults={results} />
    </div>
  );
}
