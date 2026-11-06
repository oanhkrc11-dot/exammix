"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@/components/atoms";
import { FormField } from "@/components/molecules";

export default function JoinEntryPage() {
  const [code, setCode] = useState("");
  const router = useRouter();

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (code.trim()) router.push(`/join/${code.trim().toUpperCase()}`);
      }}
    >
      <FormField label="Mã phòng thi">
        <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="VD: AB12CD" />
      </FormField>
      <Button type="submit">Tiếp tục</Button>
    </form>
  );
}
