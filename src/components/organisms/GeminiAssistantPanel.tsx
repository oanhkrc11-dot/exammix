"use client";

import { useState, useTransition } from "react";
import { Badge, Button, Input, Textarea } from "@/components/atoms";
import { FormField } from "@/components/molecules";
import { generateWithGemini, saveGeminiKey } from "@/features/gemini/actions";
import { addQuestion } from "@/features/question-bank/actions";

const PROMPT_SUGGESTIONS = [
  "Tạo 5 câu hỏi trắc nghiệm 4 đáp án về quang hợp ở thực vật, lớp 11.",
  "Viết lời giải chi tiết cho bài toán: Giải phương trình x^2 - 5x + 6 = 0.",
  "Gợi ý 3 câu hỏi tự luận kiểm tra hiểu bài về Cách mạng tháng Tám 1945.",
];

export function GeminiAssistantPanel({ hasKeyConfigured }: { hasKeyConfigured: boolean }) {
  const [apiKey, setApiKey] = useState("");
  const [keySaved, setKeySaved] = useState(hasKeyConfigured);
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [savedToBank, setSavedToBank] = useState(false);
  const [isSavingKey, startSavingKey] = useTransition();
  const [isGenerating, startGenerating] = useTransition();
  const [isSavingQuestion, startSavingQuestion] = useTransition();

  function handleSaveKey() {
    startSavingKey(async () => {
      await saveGeminiKey(apiKey);
      setKeySaved(true);
      setApiKey("");
    });
  }

  function handleGenerate() {
    if (!prompt.trim()) return;
    setError(null);
    setResult("");
    setSavedToBank(false);
    startGenerating(async () => {
      try {
        const text = await generateWithGemini(prompt);
        setResult(text);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Không thể tạo nội dung.");
      }
    });
  }

  function handleSaveToBank() {
    startSavingQuestion(async () => {
      await addQuestion({ subject: "", topic: "", type: "Tự luận", content: prompt, answer: result });
      setSavedToBank(true);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-[18px] border border-border bg-panel p-5 shadow-[var(--shadow-soft)]">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-base font-semibold text-text">Gemini API key</h2>
          {keySaved ? <Badge tone="green">Đã cấu hình</Badge> : <Badge tone="gray">Chưa cấu hình</Badge>}
        </div>
        <p className="mb-3 text-sm text-muted">
          Lấy API key tại{" "}
          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noreferrer"
            className="text-brand-blue hover:underline"
          >
            Google AI Studio
          </a>
          . Key được lưu riêng cho tài khoản của bạn và chỉ dùng ở server, không gửi ra trình duyệt.
        </p>
        <div className="flex gap-2">
          <Input
            type="password"
            placeholder={keySaved ? "•••••••••••••••• (đã lưu)" : "Nhập Gemini API key"}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
          <Button onClick={handleSaveKey} disabled={isSavingKey || !apiKey.trim()}>
            {isSavingKey ? "Đang lưu..." : "Lưu key"}
          </Button>
        </div>
      </div>

      <div className="rounded-[18px] border border-border bg-panel p-5 shadow-[var(--shadow-soft)]">
        <h2 className="mb-3 text-base font-semibold text-text">Trợ lý AI</h2>
        <div className="mb-3 flex flex-wrap gap-2">
          {PROMPT_SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setPrompt(s)}
              className="rounded-[999px] border border-border bg-panel-2 px-3 py-1 text-xs text-muted hover:border-brand-blue"
            >
              {s.length > 40 ? `${s.slice(0, 40)}…` : s}
            </button>
          ))}
        </div>
        <FormField label="Yêu cầu của bạn">
          <Textarea
            rows={4}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ví dụ: Tạo 5 câu hỏi trắc nghiệm về..."
          />
        </FormField>
        {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
        <Button className="mt-4" onClick={handleGenerate} disabled={isGenerating || !keySaved}>
          {isGenerating ? "Đang tạo nội dung..." : "Tạo nội dung"}
        </Button>
        {!keySaved ? <p className="mt-2 text-xs text-muted">Hãy lưu API key ở trên trước.</p> : null}
      </div>

      {result ? (
        <div className="rounded-[18px] border border-border bg-panel p-5 shadow-[var(--shadow-soft)]">
          <h2 className="mb-3 text-base font-semibold text-text">Kết quả</h2>
          <Textarea rows={10} value={result} readOnly />
          <div className="mt-4 flex gap-2">
            <Button variant="gray" onClick={() => navigator.clipboard.writeText(result)}>
              Sao chép
            </Button>
            <Button variant="gray" onClick={handleSaveToBank} disabled={isSavingQuestion || savedToBank}>
              {savedToBank ? "Đã lưu vào ngân hàng" : "Lưu vào ngân hàng câu hỏi"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
