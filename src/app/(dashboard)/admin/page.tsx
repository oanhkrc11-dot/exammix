import { StatTile } from "@/components/molecules";
import { AdminUserTable } from "@/components/organisms/AdminUserTable";
import { getAdminStats, listUsers } from "@/features/admin/actions";

export default async function AdminPage() {
  const [stats, users] = await Promise.all([getAdminStats(), listUsers()]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-text">Quản trị hệ thống</h1>
        <p className="mt-1 text-sm text-muted">Quản lý người dùng và theo dõi số liệu tổng quan.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Người dùng" value={stats.userCount} />
        <StatTile label="Câu hỏi toàn hệ thống" value={stats.questionCount} />
        <StatTile label="Lượt chấm điểm" value={stats.examResultCount} />
      </div>

      <AdminUserTable initialUsers={users} />
    </div>
  );
}
