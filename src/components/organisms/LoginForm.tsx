"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button, Input } from "@/components/atoms";
import { FormField } from "@/components/molecules";
import { loginWithPassword, signInWithGoogle, type AuthActionState } from "@/features/auth/actions";

const initialState: AuthActionState = { error: null };

export function LoginForm({ redirectTo }: { redirectTo?: string }) {
  const [state, formAction, pending] = useActionState(loginWithPassword, initialState);

  return (
    <div className="flex flex-col gap-5">
      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="redirectTo" value={redirectTo ?? "/dashboard"} />
        <FormField label="Email" htmlFor="email">
          <Input id="email" name="email" type="email" required autoComplete="email" />
        </FormField>
        <FormField label="Mật khẩu" htmlFor="password">
          <Input id="password" name="password" type="password" required autoComplete="current-password" />
        </FormField>
        {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
        <div className="flex justify-end">
          <Link href="/forgot-password" className="text-sm text-brand-blue hover:underline">
            Quên mật khẩu?
          </Link>
        </div>
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Đang đăng nhập..." : "Đăng nhập"}
        </Button>
      </form>

      <div className="flex items-center gap-3 text-xs text-muted">
        <div className="h-px flex-1 bg-border" />
        hoặc
        <div className="h-px flex-1 bg-border" />
      </div>

      <form action={signInWithGoogle}>
        <Button type="submit" variant="gray" className="w-full">
          Đăng nhập với Google
        </Button>
      </form>

      <p className="text-center text-sm text-muted">
        Chưa có tài khoản?{" "}
        <Link href="/register" className="text-brand-blue hover:underline">
          Đăng ký
        </Link>
      </p>
    </div>
  );
}
