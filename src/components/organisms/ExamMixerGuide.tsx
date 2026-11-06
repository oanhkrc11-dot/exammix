"use client";

// Static author guide, copied verbatim from legacy's #exammixAuthorGuide
// block (Exam_mix_6_nov.html:3230-3283) — no logic, just reference copy for
// how to format a source .docx so the mixer reads it reliably.
const SECTIONS: { title: string; items: string[] }[] = [
  {
    title: "9) Chọn một số câu từ đề Word trước khi trộn",
    items: [
      "Soạn đề Word có tiêu đề PHẦN I, PHẦN II, PHẦN III, PHẦN IV thành các dòng riêng. Mỗi câu bắt đầu bằng Câu 1., Câu 2.…; bấm Chọn đề rồi Kiểm tra.",
      "Mở Chọn câu trước khi trộn, xem tổng số câu và số câu theo từng phần. Nếu tổng theo phần không khớp Word, cần kiểm tra lại tiêu đề phần trước khi trộn.",
      "Chọn thủ công: tích hoặc bỏ dấu chọn ở từng câu. Dùng ô tìm kiếm để tìm số câu hoặc nội dung.",
      "Chọn ngẫu nhiên toàn đề: nhập tổng số lượng, bấm 🎲 Chọn ngẫu nhiên — chương trình chọn ngẫu nhiên từ tất cả câu đã nhận diện.",
      "Chọn ngẫu nhiên theo phần: nhập riêng số câu cần lấy ở Phần I, II, III, IV rồi bấm 🎯 Chọn theo phần.",
      "Chọn tất cả / Bỏ tất cả: dùng hai nút tương ứng; phải có ít nhất một câu được chọn.",
      "Với câu dùng chung dữ liệu, đoạn đọc hiểu, hình vẽ, nên chọn nguyên nhóm câu.",
    ],
  },
  {
    title: "1) Mẫu đề gốc nên soạn như thế nào?",
    items: [
      "Mỗi câu nên là một khối rõ ràng: bắt đầu bằng \"Câu 1.\", \"Câu 2.\"...",
      "Không nên trộn nhiều câu trong một đoạn quá dài; hạn chế tab thủ công không cần thiết.",
      "Nên dùng font phổ biến như Times New Roman, Arial, Calibri.",
      "Nếu có công thức Equation/MathType hoặc hình ảnh, cứ giữ nguyên; phần mềm sẽ cảnh báo để kiểm tra thêm sau khi trộn.",
    ],
  },
  {
    title: "2) Phần I – Trắc nghiệm nhiều lựa chọn",
    items: [
      "Mỗi câu nên có đủ 4 phương án A, B, C, D.",
      "Dạng ổn định nhất: A. ...  B. ...  C. ...  D. ...",
      "Chỉ nên đánh dấu 1 đáp án đúng — gạch chân chữ cái nhãn đúng, hoặc gạch chân rõ ràng một phương án đúng duy nhất.",
      "Tránh các dạng dễ lỗi: \"A .\", \"A...\", hai đáp án cùng gạch chân, thiếu nhãn C/D, hoặc đáp án bị tách rời khỏi câu hỏi.",
    ],
  },
  {
    title: "3) Phần II – Đúng/Sai",
    items: [
      "Mỗi câu nên có 4 ý a), b), c), d) hoặc a., b., c., d. rõ ràng.",
      "Nếu đáp án trong Word khó nhận, có thể nhập khóa tay phần II sau khi nạp đề.",
      "Nên giữ 4 ý của cùng một câu trong cùng một khối để tránh tách nhầm khi trộn.",
      "Nếu muốn giữ nguyên thứ tự các ý Đ/S, dùng chức năng cố định ý thay vì chỉnh tay trong Word.",
    ],
  },
  {
    title: "4) Phần III – Trả lời ngắn",
    items: [
      "Mỗi câu chỉ nên có một yêu cầu hỏi chính, không dùng nhãn A–D.",
      "Nếu phần mềm không nhận chắc chắn, có thể nhập đáp án tay ở ô dành cho Phần III.",
      "Với số thập phân, đơn vị, kí hiệu, nên gõ nhất quán để dễ đối chiếu sau trộn.",
    ],
  },
  {
    title: "5) Phần IV – Tự luận",
    items: [
      "Mỗi câu tự luận nên là một block riêng, bắt đầu bằng \"Câu ...\" và có nội dung/hình vẽ/dữ kiện đi liền nhau.",
      "Nếu không muốn xáo trộn tự luận, hãy giữ tùy chọn trộn tự luận phù hợp hoặc dùng cố định câu.",
      "Lời giải/hướng dẫn chấm nếu có nên đặt rõ ràng để tránh nhầm với nội dung đề học sinh.",
    ],
  },
  {
    title: "6) Cách dùng cố định câu, cố định ý",
    items: [
      "Cố định câu: dùng khi muốn câu nào đó không đổi vị trí giữa các mã đề. Nhập theo danh sách như: 1, 5, 9.",
      "Cố định ý Đ/S: dùng khi một số ý a/b/c/d cần giữ nguyên. Ví dụ kiểu nhập thường dùng: II:5:a, 12:b.",
      "Nên cố định với: câu có hình lớn, câu đọc hiểu dùng chung dữ liệu, câu thực hành hoặc câu cần cả lớp đối chiếu giống nhau.",
    ],
  },
  {
    title: "7) Trộn đề tiếng Anh",
    items: [
      "Với đoạn văn chung/reading passage, hãy giữ đoạn văn và nhóm câu liên quan trong cùng một block.",
      "Nên giữ bật English block mode để tránh tách nhầm câu khỏi đoạn văn.",
      "Tránh để các phương án A–D của câu tiếng Anh bị xuống dòng rời rạc quá nhiều đoạn.",
    ],
  },
  {
    title: "8) Danh sách kiểm tra nhanh trước khi bấm Trộn",
    items: [
      "Đã chọn đúng file .docx.",
      "Phần I đủ A–D; Phần II đủ 4 ý; Phần III không lẫn A–D; Phần IV tách block rõ.",
      "Không có 2 đáp án đúng trong cùng một câu.",
      "Đã chạy Kiểm tra và xem phần chi tiết lỗi cần sửa.",
    ],
  },
];

export function ExamMixerGuide() {
  return (
    <details className="rounded-[14px] border border-border bg-panel-2 p-4">
      <summary className="cursor-pointer text-sm font-bold text-text">📘 Hướng dẫn soạn đề gốc để trộn ổn định</summary>
      <p className="mt-2 text-xs text-muted">
        Khuyến nghị thực hành an toàn. Chỉ hướng dẫn hiển thị; không sửa file Word gốc.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {SECTIONS.map((section) => (
          <details key={section.title} className="rounded-[12px] border border-border bg-panel p-3">
            <summary className="cursor-pointer text-sm font-semibold text-text">{section.title}</summary>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-xs text-muted">
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </details>
        ))}
      </div>
    </details>
  );
}
