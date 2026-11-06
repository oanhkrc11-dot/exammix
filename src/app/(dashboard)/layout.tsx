import { Sidebar } from "@/components/organisms/Sidebar";
import { Topbar } from "@/components/organisms/Topbar";
import { getCurrentUserAndProfile } from "@/features/auth/queries";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile } = await getCurrentUserAndProfile();
  const isAdmin = profile?.role === "admin";

  return (
    <div className="min-h-screen bg-bg">
      <Sidebar
        isAdmin={isAdmin}
        displayName={profile?.display_name ?? null}
        email={user?.email ?? null}
        role={profile?.role ?? "teacher"}
      />
      <div className="flex min-h-screen flex-col md:ml-[var(--sidebar-width)]">
        <Topbar />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
