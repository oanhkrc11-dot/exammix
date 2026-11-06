import { QuestionBankTable } from "@/components/organisms/QuestionBankTable";
import { listQuestions } from "@/features/question-bank/actions";

export default async function QuestionBankPage() {
  const questions = await listQuestions();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold text-text">Ngân hàng câu hỏi</h1>
        <p className="mt-1 text-sm text-muted">
          Thêm, tìm kiếm, xuất/nhập câu hỏi dưới dạng JSON.
        </p>
      </div>
      <QuestionBankTable initialQuestions={questions} />
    </div>
  );
}
