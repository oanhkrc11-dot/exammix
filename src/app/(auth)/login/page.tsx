import { LoginForm } from "@/components/organisms/LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string; registered?: string }>;
}) {
  const { redirectTo, registered } = await searchParams;

  return (
    <div>
      {registered ? (
        <p className="mb-4 rounded-[10px] bg-success/10 px-3 py-2 text-sm text-success">
          Đăng ký thành công! Hãy kiểm tra email để xác nhận tài khoản trước khi đăng nhập.
        </p>
      ) : null}
      <LoginForm redirectTo={redirectTo} />
    </div>
  );
}
