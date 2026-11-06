export default function JoinLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4 py-10">
      <div className="w-full max-w-md rounded-[18px] border border-border bg-panel p-8 shadow-[var(--shadow-soft)]">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-bold text-text">ExamMix Pro</h1>
          <p className="mt-1 text-sm text-muted">Phòng thi trực tuyến</p>
        </div>
        {children}
      </div>
    </div>
  );
}
