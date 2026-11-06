import { GeminiAssistantPanel } from "@/components/organisms/GeminiAssistantPanel";
import { hasGeminiKey } from "@/features/gemini/actions";

export default async function GeminiAiPage() {
  const keyConfigured = await hasGeminiKey();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold text-text">Gemini AI</h1>
        <p className="mt-1 text-sm text-muted">
          Dùng API key Gemini của riêng bạn để soạn câu hỏi, lời giải hoặc gợi ý nội dung.
        </p>
      </div>
      <GeminiAssistantPanel hasKeyConfigured={keyConfigured} />
    </div>
  );
}
