"use client";

import { Button, Card } from "@/components/atoms";

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Xác nhận",
  cancelLabel = "Hủy",
  onConfirm,
  onCancel,
  danger,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/40 p-4">
      <Card className="w-full max-w-sm">
        <h3 className="text-base font-semibold text-text">{title}</h3>
        {description ? (
          <p className="mt-1 text-sm text-muted">{description}</p>
        ) : null}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="gray" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant={danger ? "red" : "blue"} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </Card>
    </div>
  );
}
