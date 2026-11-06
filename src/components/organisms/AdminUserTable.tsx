"use client";

import { useState, useTransition } from "react";
import { Badge, Button, Select } from "@/components/atoms";
import { setUserBanned, setUserRole, type AdminUserRow } from "@/features/admin/actions";
import type { Role } from "@/lib/supabase/types";

export function AdminUserTable({ initialUsers }: { initialUsers: AdminUserRow[] }) {
  const [users, setUsers] = useState(initialUsers);
  const [isPending, startTransition] = useTransition();

  function handleRoleChange(id: string, role: Role) {
    startTransition(async () => {
      await setUserRole(id, role);
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, role } : u)));
    });
  }

  function handleToggleBanned(id: string, banned: boolean) {
    startTransition(async () => {
      await setUserBanned(id, banned);
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, banned } : u)));
    });
  }

  return (
    <div className="overflow-x-auto rounded-[18px] border border-border bg-panel shadow-[var(--shadow-soft)]">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-border text-muted">
          <tr>
            <th className="px-4 py-3">Người dùng</th>
            <th className="px-4 py-3">Ngày tạo</th>
            <th className="px-4 py-3">Vai trò</th>
            <th className="px-4 py-3">Trạng thái</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-b border-border last:border-0">
              <td className="px-4 py-3">
                <div className="font-medium text-text">{u.displayName || "(chưa đặt tên)"}</div>
                <div className="text-xs text-muted">{u.email}</div>
              </td>
              <td className="px-4 py-3 text-muted">{new Date(u.createdAt).toLocaleDateString("vi-VN")}</td>
              <td className="px-4 py-3">
                <Select
                  value={u.role}
                  disabled={isPending}
                  onChange={(e) => handleRoleChange(u.id, e.target.value as Role)}
                  className="w-auto"
                >
                  <option value="teacher">Giáo viên</option>
                  <option value="admin">Quản trị</option>
                </Select>
              </td>
              <td className="px-4 py-3">
                {u.banned ? <Badge tone="red">Đã khóa</Badge> : <Badge tone="green">Hoạt động</Badge>}
              </td>
              <td className="px-4 py-3 text-right">
                <Button
                  variant={u.banned ? "green" : "red"}
                  disabled={isPending}
                  onClick={() => handleToggleBanned(u.id, !u.banned)}
                >
                  {u.banned ? "Mở khóa" : "Khóa"}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
