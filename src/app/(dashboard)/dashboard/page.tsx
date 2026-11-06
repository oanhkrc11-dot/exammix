import Link from "next/link";

export default async function DashboardPage() {
  return (
    <div className="flex flex-col gap-8">
      <section
        className="relative flex min-h-[238px] items-center justify-between gap-7 overflow-hidden rounded-[24px] p-[34px] pb-[30px]"
        style={{
          backgroundImage: "linear-gradient(115deg, #0a1d35 0%, #102c50 58%, #123665 100%)",
          border: "1px solid rgba(86,157,255,.2)",
          boxShadow: "0 24px 55px rgba(0,0,0,.24)",
        }}
      >
        <div
          className="pointer-events-none absolute -right-[120px] -top-[170px] h-[380px] w-[380px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(25,194,215,.28), transparent 66%)" }}
        />
        <div className="relative z-[2] max-w-[760px]">
          <div className="mb-3 inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[1.5px] text-[#8edff0]">
            <i className="h-0.5 w-6 rounded bg-[#3cd8e8]" /> Teacher Classroom Studio
          </div>
          <h1 className="m-0 text-[38px] leading-[1.08] tracking-tight text-white">
            Một màn hình để{" "}
            <span className="bg-[linear-gradient(90deg,#74b4ff,#5ee7e7)] bg-clip-text text-transparent">
              điều khiển cả tiết học
            </span>
          </h1>
          <p className="my-3.5 max-w-[690px] text-[15px] leading-[1.65] text-[#bcd0e7]">
            Trộn đề, gọi học sinh, trình chiếu Quiz Word, thi đua, mô phỏng và quản lí lớp trong một
            không gian thống nhất. Giao diện ưu tiên thao tác nhanh khi đang đứng lớp.
          </p>
          <div className="flex flex-wrap gap-2.5">
            <Link
              href="/classroom-tools"
              className="rounded-xl px-[17px] py-3 text-sm font-extrabold text-white shadow-[0_10px_24px_rgba(47,125,246,.26)]"
              style={{ backgroundImage: "linear-gradient(135deg, #2f7df6, #1ba8e7)" }}
            >
              ⚡ BẮT ĐẦU TIẾT HỌC
            </Link>
            <Link
              href="/exam-mixer"
              className="rounded-xl border border-white/[0.14] bg-white/[0.08] px-[17px] py-3 text-sm font-extrabold text-[#d9e9fb]"
            >
              🎯 Trộn đề thi
            </Link>
            <Link
              href="/virtual-lab"
              className="rounded-xl border border-white/[0.14] bg-white/[0.08] px-[17px] py-3 text-sm font-extrabold text-[#d9e9fb]"
            >
              🧪 Mở mô phỏng
            </Link>
          </div>
        </div>
        <div className="relative z-[2] hidden h-[185px] w-[185px] min-w-[185px] place-items-center rounded-full border border-white/[0.15] md:grid">
          <div
            className="grid h-[75px] w-[75px] rotate-[8deg] place-items-center rounded-[22px] text-[31px]"
            style={{
              backgroundImage: "linear-gradient(135deg, #2f7df6, #7357ff)",
              boxShadow: "0 18px 45px rgba(47,125,246,.38)",
            }}
          >
            ⚡
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <HeroChip icon="⚡" title="LIVE" desc="Điều khiển hoạt động trên lớp" />
        <HeroChip icon="📄" title="Word" desc="Đọc đề và trình chiếu Quiz" />
        <HeroChip icon="🧪" title="Lab" desc="Mô phỏng trực quan tích hợp" />
        <HeroChip icon="☁️" title="Cloud" desc="Dữ liệu đồng bộ trên Supabase" />
      </div>

      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-text">Công cụ dạy học</h2>
            <p className="text-sm text-muted">Chọn tác vụ và đi thẳng vào màn hình cần dùng.</p>
          </div>
          <span className="text-xs text-muted">Thiết kế cho máy chiếu · màn hình cảm ứng</span>
        </div>
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          <ToolCard href="/classroom-tools" icon="❓" title="Quiz LIVE từ Word" desc="Chọn DOCX, trình chiếu từng câu, đồng hồ, âm thanh và chấm điểm đội." />
          <ToolCard href="/classroom-tools" icon="🎡" title="Gọi học sinh" desc="Vòng quay ngẫu nhiên, tránh gọi lặp và quản lí danh sách theo từng lớp." />
          <ToolCard href="/academy" icon="🎓" title="Học viện tri thức" desc="Không gian game học tập nhiều môn đã được tích hợp trong ExamMix." />
          <ToolCard href="/virtual-lab" icon="🧪" title="Phòng thí nghiệm ảo" desc="Mở nhanh mô phỏng Vật lí và hoạt động trực quan để trình chiếu trên lớp." />
        </div>
      </section>

      <section>
        <div className="mb-3">
          <h2 className="text-lg font-bold text-text">Tiến trình tiết học nhanh</h2>
          <p className="text-sm text-muted">Mỗi pha mở đúng công cụ thường dùng, giảm thao tác chuyển màn hình.</p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <FlowStep href="/classroom-tools" num="01" title="Khởi động" desc="Vòng quay / câu hỏi nhanh" />
          <FlowStep href="/virtual-lab" num="02" title="Khám phá" desc="Mô phỏng / thí nghiệm ảo" />
          <FlowStep href="/exam-mixer" num="03" title="Luyện tập" desc="Quiz Word có đồng hồ" />
          <FlowStep href="/classroom-tools" num="04" title="Vận dụng" desc="Thi đua / Buzzer" />
          <FlowStep href="/classroom-tools" num="05" title="Kết thúc" desc="Chốt bài / điểm đội" />
        </div>
      </section>
    </div>
  );
}

function HeroChip({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div
      className="flex items-center gap-2.5 rounded-[15px] p-4"
      style={{ background: "#0d1b2c", border: "1px solid #203b59" }}
    >
      <div className="text-xl">{icon}</div>
      <div>
        <strong className="block text-[21px] leading-none text-text">{title}</strong>
        <span className="mt-0.5 block text-[11px] text-muted">{desc}</span>
      </div>
    </div>
  );
}

function ToolCard({ href, icon, title, desc }: { href: string; icon: string; title: string; desc: string }) {
  return (
    <Link
      href={href}
      className="group relative min-h-[142px] overflow-hidden rounded-[17px] p-[18px] text-left transition-transform duration-200 hover:-translate-y-[3px]"
      style={{
        border: "1px solid var(--color-border)",
        backgroundImage: "linear-gradient(155deg, rgba(255,255,255,.043), rgba(255,255,255,.02))",
      }}
    >
      <span
        className="mb-3.5 grid h-[42px] w-[42px] place-items-center rounded-[13px] text-xl"
        style={{
          backgroundImage: "linear-gradient(135deg, rgba(47,125,246,.24), rgba(25,194,215,.16))",
          border: "1px solid rgba(89,153,220,.18)",
        }}
      >
        {icon}
      </span>
      <b className="block text-[15px] text-text">{title}</b>
      <small className="block pr-4 leading-[1.48] text-muted">{desc}</small>
      <span className="absolute bottom-[13px] right-4 text-[#5c82a8] transition-all group-hover:right-3 group-hover:text-[#83b8ec]">
        →
      </span>
    </Link>
  );
}

function FlowStep({ href, num, title, desc }: { href: string; num: string; title: string; desc: string }) {
  return (
    <Link
      href={href}
      className="rounded-[14px] px-3 py-3.5 text-left"
      style={{ background: "#0d1b2c", border: "1px solid #203b59" }}
    >
      <span className="block text-[11px] font-black text-muted">{num}</span>
      <b className="mt-1 block text-sm text-text">{title}</b>
      <span className="block text-xs text-muted">{desc}</span>
    </Link>
  );
}
