"use client";

import { useRef } from "react";
import { Button } from "@/components/atoms";

export function AcademyGameFrame({ gameKey }: { gameKey: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  return (
    <div className="flex flex-1 flex-col gap-2">
      <div className="flex justify-end">
        <Button variant="gray" onClick={() => iframeRef.current?.requestFullscreen()}>
          Toàn màn hình
        </Button>
      </div>
      <iframe
        ref={iframeRef}
        src={`/academy-games/${gameKey}.html`}
        className="h-[75vh] w-full rounded-[18px] border border-border bg-panel shadow-[var(--shadow-soft)]"
        title={gameKey}
      />
    </div>
  );
}
