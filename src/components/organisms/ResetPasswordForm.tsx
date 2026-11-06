"use client";

import { useActionState } from "react";
import { Button, Input } from "@/components/atoms";
import { FormField } from "@/components/molecules";
import { updatePassword, type AuthActionState } from "@/features/auth/actions";

const initialState: AuthActionState = { error: null };

export function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState(updatePassword, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormField label="Mật khẩu mới" htmlFor="password">
        <Input id="password" name="password" type="password" required autoComplete="new-password" minLength={6} />
      </FormField>
      <FormField label="Xác nhận mật khẩu mới" htmlFor="confirmPassword">
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          autoComplete="new-password"
          minLength={6}
        />
      </FormField>
      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Đang lưu..." : "Đặt lại mật khẩu"}
      </Button>
    </form>
  );
}
