"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Input } from "@/components/atoms";
import { beep } from "@/lib/logic/beep";

const PRESETS = [15, 30, 60, 120, 300, 600];

export function CountdownTimerPanel() {
  const [totalSeconds, setTotalSeconds] = useState(60);
  const [remaining, setRemaining] = useState(60);
  const [running, setRunning] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!running) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          setRunning(false);
          if (soundOn) beep(440, 500);
          return 0;
        }
        if (soundOn && prev <= 4) beep(880, 100);
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running, soundOn]);

  function setPreset(seconds: number) {
    setTotalSeconds(seconds);
    setRemaining(seconds);
    setRunning(false);
  }

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;

  return (
    <div className="flex flex-col items-center gap-5 rounded-[18px] border border-border bg-panel p-8 text-center shadow-[var(--shadow-soft)]">
      <div className="text-6xl font-bold tabular-nums text-text">
        {minutes}:{String(seconds).padStart(2, "0")}
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        {PRESETS.map((p) => (
          <Button key={p} variant="gray" onClick={() => setPreset(p)}>
            {p < 60 ? `${p}s` : `${p / 60}p`}
          </Button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Input
          type="number"
          min={1}
          value={totalSeconds}
          onChange={(e) => setPreset(Number(e.target.value) || 1)}
          className="w-28"
        />
        <span className="text-sm text-muted">giây (tùy chỉnh)</span>
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={() => setRunning((r) => !r)} disabled={remaining === 0}>
          {running ? "Tạm dừng" : "Bắt đầu"}
        </Button>
        <Button variant="gray" onClick={() => setPreset(totalSeconds)}>
          Đặt lại
        </Button>
        <label className="flex items-center gap-2 text-sm text-text">
          <input type="checkbox" checked={soundOn} onChange={(e) => setSoundOn(e.target.checked)} />
          Âm thanh
        </label>
      </div>
    </div>
  );
}
