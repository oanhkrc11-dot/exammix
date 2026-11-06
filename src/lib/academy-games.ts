// Ported from legacy/index.html's "Học viện tri thức" game portal:
// a giant base64-encoded registry page (HVTT_EMBED_B64) containing a
// SUBJECTS array + DATA map of per-subject base64 HTML games. Each game
// was decoded and extracted verbatim to public/academy-games/<key>.html
// (self-contained offline HTML/CSS/JS quiz games, no changes made to their
// content). This file is just the menu metadata, pulled from the real
// SUBJECTS array, not invented.
export interface AcademyGame {
  key: string;
  icon: string;
  name: string;
  desc: string;
  accent: string;
}

export const ACADEMY_GAMES: AcademyGame[] = [
  { key: "math", icon: "➗", name: "Toán học", desc: "Số học • đại số • hình học • hàm số • xác suất • tư duy", accent: "#7dd3fc" },
  { key: "physics", icon: "⚛️", name: "Vật lí", desc: "Cơ học • nhiệt học • điện • sóng • quang • suy luận vật lí", accent: "#60a5fa" },
  { key: "chemistry", icon: "🧪", name: "Hóa học", desc: "Nguyên tử • phản ứng • mol • dung dịch • hữu cơ • oxi hóa–khử", accent: "#34d399" },
  { key: "english", icon: "🇬🇧", name: "Tiếng Anh", desc: "Từ vựng • ngữ pháp • cấu trúc câu • phát âm • Boss tiếng Anh", accent: "#f59e0b" },
  { key: "literature", icon: "📖", name: "Văn học", desc: "Tác giả–tác phẩm • nhân vật • đọc hiểu • cảm thụ • nghị luận", accent: "#f0abfc" },
  { key: "vietnamese", icon: "🇻🇳", name: "Tiếng Việt", desc: "Chính tả • từ loại • câu • tu từ • liên kết • đọc hiểu", accent: "#fb7185" },
  { key: "chinese", icon: "🀄", name: "Tiếng Trung Quốc", desc: "Pinyin • thanh điệu • chữ Hán • lượng từ • ngữ pháp • giao tiếp", accent: "#fb923c" },
  { key: "french", icon: "🇫🇷", name: "Tiếng Pháp", desc: "Từ vựng • mạo từ • động từ • hòa hợp • câu hỏi • giao tiếp", accent: "#818cf8" },
  { key: "sports", icon: "🏆", name: "Thể thao", desc: "Luật chơi • bóng đá • bóng rổ • bóng chuyền • thể lực • chiến thuật", accent: "#4ade80" },
  { key: "geography", icon: "🌍", name: "Địa lí", desc: "Bản đồ • Việt Nam • thế giới • khí hậu • dân số • biểu đồ", accent: "#22d3ee" },
  { key: "biology", icon: "🧬", name: "Sinh học", desc: "Tế bào • cơ thể • di truyền • tiến hóa • sinh thái • phân tử", accent: "#84cc16" },
  { key: "history", icon: "🏺", name: "Lịch sử", desc: "10 level lịch sử • 100 câu • trợ giúp • đồng hồ • Boss lịch sử", accent: "#fbbf24" },
  { key: "all", icon: "🎓", name: "Tổng hợp các môn", desc: "Thử thách liên môn: Toán • khoa học • xã hội • ngôn ngữ • thể thao", accent: "#c084fc" },
  { key: "informatics", icon: "💻", name: "Tin học & AI", desc: "Máy tính • Internet • an toàn số • dữ liệu • lập trình • AI có trách nhiệm", accent: "#38bdf8" },
  { key: "stem", icon: "⚙️", name: "Công nghệ & STEM", desc: "Thiết kế kĩ thuật • điện • cơ khí • cảm biến • robot • năng lượng", accent: "#f97316" },
  { key: "finance", icon: "💰", name: "Kinh tế – Pháp luật – Tài chính", desc: "Ngân sách • lãi suất • thị trường • hợp đồng • đầu tư • pháp luật số", accent: "#facc15" },
  { key: "environment", icon: "🌱", name: "Môi trường & Phát triển bền vững", desc: "Khí hậu • năng lượng • nước • rác thải • đa dạng sinh học • carbon", accent: "#4ade80" },
  { key: "arts", icon: "🎨", name: "Nghệ thuật & Văn hóa", desc: "Mỹ thuật • âm nhạc • kiến trúc • di sản • điện ảnh • thiết kế truyền thông", accent: "#fb7185" },
];
