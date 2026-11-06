import { ForgotPasswordForm } from "@/components/organisms/ForgotPasswordForm";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string }>;
}) {
  const { sent } = await searchParams;

  return (
    <div>
      {sent ? (
        <p className="mb-4 rounded-[10px] bg-success/10 px-3 py-2 text-sm text-success">
          Nếu email tồn tại, một liên kết đặt lại mật khẩu đã được gửi tới hộp thư của bạn.
        </p>
      ) : null}
      <ForgotPasswordForm />
    </div>
  );
}
