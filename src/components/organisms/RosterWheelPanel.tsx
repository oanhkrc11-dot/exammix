"use client";

import { useMemo, useState, useTransition } from "react";
import { Button, Input, Textarea } from "@/components/atoms";
import { FormField } from "@/components/molecules";
import {
  createClass,
  deleteClass,
  renameClass,
  updateClassStudents,
} from "@/features/classroom/actions";
import type { ClassRoom } from "@/lib/supabase/types";

export function RosterWheelPanel({ initialClasses }: { initialClasses: ClassRoom[] }) {
  const [classes, setClasses] = useState(initialClasses);
  const [activeId, setActiveId] = useState<string | null>(initialClasses[0]?.id ?? null);
  const [newClassName, setNewClassName] = useState("");
  const [bulkNames, setBulkNames] = useState("");
  const [noRepeat, setNoRepeat] = useState(true);
  const [usedNames, setUsedNames] = useState<Set<string>>(new Set());
  const [picked, setPicked] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const activeClass = classes.find((c) => c.id === activeId) ?? null;

  const pool = useMemo(() => {
    if (!activeClass) return [];
    return noRepeat ? activeClass.students.filter((s) => !usedNames.has(s)) : activeClass.students;
  }, [activeClass, noRepeat, usedNames]);

  function handleCreateClass() {
    startTransition(async () => {
      const created = await createClass(newClassName);
      setClasses((prev) => [...prev, created]);
      setActiveId(created.id);
      setNewClassName("");
    });
  }

  function handleDeleteClass(id: string) {
    startTransition(async () => {
      await deleteClass(id);
      setClasses((prev) => prev.filter((c) => c.id !== id));
      if (activeId === id) setActiveId(null);
    });
  }

  function handleAddBulkNames() {
    if (!activeClass || !bulkNames.trim()) return;
    const names = bulkNames
      .split(/[\n,]/)
      .map((n) => n.trim())
      .filter(Boolean);
    const merged = Array.from(new Set([...activeClass.students, ...names]));
    startTransition(async () => {
      await updateClassStudents(activeClass.id, merged);
      setClasses((prev) => prev.map((c) => (c.id === activeClass.id ? { ...c, students: merged } : c)));
      setBulkNames("");
    });
  }

  function handleRemoveStudent(name: string) {
    if (!activeClass) return;
    const next = activeClass.students.filter((s) => s !== name);
    startTransition(async () => {
      await updateClassStudents(activeClass.id, next);
      setClasses((prev) => prev.map((c) => (c.id === activeClass.id ? { ...c, students: next } : c)));
    });
  }

  function handleSpin() {
    if (pool.length === 0) {
      setPicked(null);
      return;
    }
    const name = pool[Math.floor(Math.random() * pool.length)];
    setPicked(name);
    if (noRepeat) setUsedNames((prev) => new Set(prev).add(name));
  }

  function resetUsed() {
    setUsedNames(new Set());
    setPicked(null);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <div className="rounded-[18px] border border-border bg-panel p-4 shadow-[var(--shadow-soft)]">
        <h3 className="mb-3 text-sm font-semibold text-text">Danh sách lớp</h3>
        <div className="flex flex-col gap-1">
          {classes.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveId(c.id)}
              className={`flex items-center justify-between rounded-[7px] px-3 py-2 text-left text-sm ${
                c.id === activeId ? "bg-brand-blue text-white" : "hover:bg-panel-2 text-text"
              }`}
            >
              <span>{c.name}</span>
              <span className="text-xs opacity-70">{c.students.length}</span>
            </button>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <Input
            placeholder="Tên lớp mới"
            value={newClassName}
            onChange={(e) => setNewClassName(e.target.value)}
          />
          <Button variant="gray" onClick={handleCreateClass} disabled={isPending}>
            + Thêm
          </Button>
        </div>
        {activeClass ? (
          <Button
            variant="red"
            className="mt-3 w-full"
            onClick={() => handleDeleteClass(activeClass.id)}
            disabled={isPending}
          >
            Xóa lớp này
          </Button>
        ) : null}
      </div>

      {activeClass ? (
        <div className="flex flex-col gap-4">
          <div className="rounded-[18px] border border-border bg-panel p-5 shadow-[var(--shadow-soft)]">
            <div className="mb-3 flex items-center gap-2">
              <h3 className="text-sm font-semibold text-text">Học sinh — </h3>
              <Input
                value={activeClass.name}
                onChange={(e) => {
                  const name = e.target.value;
                  setClasses((prev) => prev.map((c) => (c.id === activeClass.id ? { ...c, name } : c)));
                }}
                onBlur={(e) => startTransition(() => renameClass(activeClass.id, e.target.value))}
                className="max-w-xs"
              />
            </div>
            <FormField label="Dán danh sách tên (mỗi tên 1 dòng hoặc ngăn bởi dấu phẩy)">
              <Textarea rows={3} value={bulkNames} onChange={(e) => setBulkNames(e.target.value)} />
            </FormField>
            <Button className="mt-2" variant="gray" onClick={handleAddBulkNames} disabled={isPending}>
              Thêm vào lớp
            </Button>
            <div className="mt-3 flex flex-wrap gap-2">
              {activeClass.students.map((s) => (
                <span
                  key={s}
                  className="inline-flex items-center gap-1 rounded-[999px] bg-panel-2 px-3 py-1 text-xs text-text"
                >
                  {s}
                  <button onClick={() => handleRemoveStudent(s)} className="text-danger" aria-label={`Xóa ${s}`}>
                    ×
                  </button>
                </span>
              ))}
              {activeClass.students.length === 0 ? (
                <span className="text-sm text-muted">Chưa có học sinh.</span>
              ) : null}
            </div>
          </div>

          <div className="rounded-[18px] border border-border bg-panel p-5 text-center shadow-[var(--shadow-soft)]">
            <h3 className="mb-3 text-sm font-semibold text-text">Vòng quay gọi tên</h3>
            <div className="mb-4 text-3xl font-bold text-brand-blue">{picked ?? "—"}</div>
            <div className="flex items-center justify-center gap-4">
              <Button onClick={handleSpin}>Quay</Button>
              <label className="flex items-center gap-2 text-sm text-text">
                <input type="checkbox" checked={noRepeat} onChange={(e) => setNoRepeat(e.target.checked)} />
                Không lặp lại
              </label>
              <Button variant="gray" onClick={resetUsed}>
                Làm mới
              </Button>
            </div>
            <p className="mt-3 text-xs text-muted">
              Còn {pool.length}/{activeClass.students.length} học sinh chưa được gọi.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center rounded-[18px] border border-border bg-panel p-10 text-muted shadow-[var(--shadow-soft)]">
          Chọn hoặc tạo một lớp để bắt đầu.
        </div>
      )}
    </div>
  );
}
