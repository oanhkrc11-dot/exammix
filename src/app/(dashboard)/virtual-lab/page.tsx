import { VirtualLabPanel } from "@/components/organisms/VirtualLabPanel";
import { listCustomLabs } from "@/features/virtual-lab/actions";

export default async function VirtualLabPage() {
  const customLabs = await listCustomLabs();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold text-text">Phòng thí nghiệm ảo</h1>
        <p className="mt-1 text-sm text-muted">
          Hơn 300 mô phỏng Vật lí có sẵn, cộng thêm thí nghiệm riêng của bạn (tải file .html hoặc đường dẫn).
        </p>
      </div>
      <VirtualLabPanel initialCustomLabs={customLabs} />
    </div>
  );
}
