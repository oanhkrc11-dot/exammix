"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button, Input } from "@/components/atoms";
import { FormField } from "@/components/molecules";
import { registerWithPassword, signInWithGoogle, type AuthActionState } from "@/features/auth/actions";

const initialState: AuthActionState = { error: null };

export function RegisterForm() {
  const [state, formAction, pending] = useActionState(registerWithPassword, initialState);

  return (
    <div className="flex flex-col gap-5">
      <form action={formAction} className="flex flex-col gap-4">
        <FormField label="Họ và tên" htmlFor="displayName">
          <Input id="displayName" name="displayName" type="text" required autoComplete="name" />
        </FormField>
        <FormField label="Email" htmlFor="email">
          <Input id="email" name="email" type="email" required autoComplete="email" />
        </FormField>
        <FormField label="Mật khẩu" htmlFor="password">
          <Input id="password" name="password" type="password" required autoComplete="new-password" minLength={6} />
        </FormField>
        <FormField label="Xác nhận mật khẩu" htmlFor="confirmPassword">
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
          {pending ? "Đang tạo tài khoản..." : "Đăng ký"}
        </Button>
      </form>

      <div className="flex items-center gap-3 text-xs text-muted">
        <div className="h-px flex-1 bg-border" />
        hoặc
        <div className="h-px flex-1 bg-border" />
      </div>

      <form action={signInWithGoogle}>
        <Button type="submit" variant="gray" className="w-full">
          Đăng ký với Google
        </Button>
      </form>

      <p className="text-center text-sm text-muted">
        Đã có tài khoản?{" "}
        <Link href="/login" className="text-brand-blue hover:underline">
          Đăng nhập
        </Link>
      </p>
    </div>
  );
}
