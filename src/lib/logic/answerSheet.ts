// Ported from the legacy printAnswerSheet() (index.html:8146): a printable
// A4 answer sheet with 3 configurable sections — MCQ bubbles (A-D),
// True/False (4 sub-items a-d per question), and short-answer blank lines.
export interface AnswerSheetOptions {
  mcqCount: number;
  tfCount: number;
  shortCount: number;
}

function mcqRows(count: number) {
  return Array.from({ length: count }, (_, i) => {
    const n = i + 1;
    return `<div class="row"><span class="qn">${n}</span>${["A", "B", "C", "D"]
      .map((l) => `<span class="bubble">${l}</span>`)
      .join("")}</div>`;
  }).join("");
}

function tfRows(count: number) {
  return Array.from({ length: count }, (_, i) => {
    const n = i + 1;
    return `<div class="row"><span class="qn">${n}</span>${["a", "b", "c", "d"]
      .map((l) => `<span class="tf"><span>${l})</span><span class="bubble sm">Đ</span><span class="bubble sm">S</span></span>`)
      .join("")}</div>`;
  }).join("");
}

function shortRows(count: number) {
  return Array.from({ length: count }, (_, i) => {
    const n = i + 1;
    return `<div class="row"><span class="qn">${n}</span><span class="line"></span></div>`;
  }).join("");
}

export function buildAnswerSheetHtml({ mcqCount, tfCount, shortCount }: AnswerSheetOptions): string {
  return `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<title>Phiếu trả lời</title>
<style>
  body{font-family:"Segoe UI",Arial,sans-serif;padding:24px;color:#172b4d}
  h1{font-size:18px;text-align:center;margin-bottom:16px}
  .section{margin-bottom:20px}
  .section h2{font-size:14px;margin-bottom:8px}
  .row{display:flex;align-items:center;gap:10px;margin-bottom:6px;font-size:13px}
  .qn{width:24px;font-weight:600}
  .bubble{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border:1px solid #172b4d;border-radius:999px}
  .bubble.sm{width:18px;height:18px;font-size:11px}
  .tf{display:flex;align-items:center;gap:6px;margin-right:10px}
  .line{flex:1;border-bottom:1px solid #172b4d;height:1px}
  @media print { body{padding:0} }
</style>
</head>
<body>
<h1>Phiếu trả lời</h1>
${mcqCount > 0 ? `<div class="section"><h2>Phần I — Trắc nghiệm (${mcqCount} câu)</h2>${mcqRows(mcqCount)}</div>` : ""}
${tfCount > 0 ? `<div class="section"><h2>Phần II — Đúng/Sai (${tfCount} câu)</h2>${tfRows(tfCount)}</div>` : ""}
${shortCount > 0 ? `<div class="section"><h2>Phần III — Trả lời ngắn (${shortCount} câu)</h2>${shortRows(shortCount)}</div>` : ""}
</body>
</html>`;
}
