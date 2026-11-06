import { GameCenterLoader } from "@/components/organisms/GameCenterLoader";
import { listQuestions } from "@/features/question-bank/actions";

export default async function GameCenterPage() {
  const questions = await listQuestions();

  return (
    <div className="flex h-full flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold text-text">Game Center</h1>
        <p className="mt-1 text-sm text-muted">
          13 mini-game lớp học, dùng chung một ngân hàng câu hỏi.
        </p>
      </div>
      <GameCenterLoader questions={questions} />
    </div>
  );
}
