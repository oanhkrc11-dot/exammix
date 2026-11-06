"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";

export function FileDropzone({
  accept,
  onFile,
  label,
  className,
}: {
  accept?: string;
  onFile: (file: File) => void;
  label: string;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[18px] border-2 border-dashed border-border bg-panel-2 p-6 text-center text-sm text-muted transition hover:border-brand-blue",
        className,
      )}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const file = e.dataTransfer.files?.[0];
        if (file) onFile(file);
      }}
    >
      <span>{label}</span>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
        }}
      />
    </div>
  );
}
