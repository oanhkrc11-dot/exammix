"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button, Input } from "@/components/atoms";
import { FormField } from "@/components/molecules";
import { requestPasswordReset, type AuthActionState } from "@/features/auth/actions";

const initialState: AuthActionState = { error: null };

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(requestPasswordReset, initialState);

  return (
    <div className="flex flex-col gap-5">
      <form action={formAction} className="flex flex-col gap-4">
        <FormField label="Email" htmlFor="email">
          <Input id="email" name="email" type="email" required autoComplete="email" />
        </FormField>
        {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Đang gửi..." : "Gửi liên kết đặt lại mật khẩu"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted">
        <Link href="/login" className="text-brand-blue hover:underline">
          Quay lại đăng nhập
        </Link>
      </p>
    </div>
  );
}
