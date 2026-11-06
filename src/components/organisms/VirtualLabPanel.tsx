"use client";

import { useMemo, useState, useTransition } from "react";
import { Badge, Button, Input, Select } from "@/components/atoms";
import { FileDropzone, FormField } from "@/components/molecules";
import { LAB_LIBRARY } from "@/lib/lab-library";
import { addCustomLab, deleteCustomLab } from "@/features/virtual-lab/actions";
import type { CustomLab } from "@/lib/supabase/types";

type Selected =
  | { type: "builtin"; id: string; title: string }
  | { type: "custom"; id: string; title: string; contentHtml: string | null; contentUrl: string | null };

export function VirtualLabPanel({ initialCustomLabs }: { initialCustomLabs: CustomLab[] }) {
  const [customLabs, setCustomLabs] = useState(initialCustomLabs);
  const [subject, setSubject] = useState("all");
  const [grade, setGrade] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Selected | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  const subjects = useMemo(() => Array.from(new Set(LAB_LIBRARY.map((l) => l.subject))).sort(), []);
  const grades = useMemo(
    () => Array.from(new Set(LAB_LIBRARY.map((l) => String(l.grade)))).sort((a, b) => Number(a) - Number(b)),
    [],
  );

  const builtinFiltered = useMemo(() => {
    return LAB_LIBRARY.filter((l) => {
      if (!l.hasContent) return false;
      if (subject !== "all" && l.subject !== subject) return false;
      if (grade !== "all" && String(l.grade) !== grade) return false;
      if (search && !`${l.title} ${l.description}`.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [subject, grade, search]);

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <div className="flex flex-col gap-3">
        <div className="flex gap-2">
          <Select value={subject} onChange={(e) => setSubject(e.target.value)}>
            <option value="all">Tất cả môn học</option>
            {subjects.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
          <Select value={grade} onChange={(e) => setGrade(e.target.value)}>
            <option value="all">Tất cả lớp</option>
            {grades.map((g) => (
              <option key={g} value={g}>
                Lớp {g}
              </option>
            ))}
          </Select>
        </div>
        <Input type="search" placeholder="Tìm kiếm..." value={search} onChange={(e) => setSearch(e.target.value)} />

        <Button variant="gray" onClick={() => setShowAddForm((v) => !v)}>
          {showAddForm ? "Đóng" : "+ Thêm thí nghiệm của tôi"}
        </Button>
        {showAddForm ? (
          <AddCustomLabForm
            onAdded={(lab) => {
              setCustomLabs((prev) => [lab, ...prev]);
              setShowAddForm(false);
            }}
          />
        ) : null}

        {customLabs.length > 0 ? (
          <div className="rounded-[18px] border border-border bg-panel p-3 shadow-[var(--shadow-soft)]">
            <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted">Của tôi</h3>
            <div className="flex max-h-48 flex-col gap-1 overflow-y-auto">
              {customLabs.map((lab) => (
                <div key={lab.id} className="flex items-center gap-1">
                  <button
                    onClick={() =>
                      setSelected({
                        type: "custom",
                        id: lab.id,
                        title: lab.title,
                        contentHtml: lab.content_html,
                        contentUrl: lab.content_url,
                      })
                    }
                    className="flex-1 truncate rounded-[7px] px-2 py-1.5 text-left text-sm hover:bg-panel-2"
                  >
                    {lab.title}
                  </button>
                  <button
                    onClick={async () => {
                      await deleteCustomLab(lab.id);
                      setCustomLabs((prev) => prev.filter((l) => l.id !== lab.id));
                      if (selected?.type === "custom" && selected.id === lab.id) setSelected(null);
                    }}
                    className="px-2 text-danger"
                    aria-label={`Xóa ${lab.title}`}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="flex-1 overflow-y-auto rounded-[18px] border border-border bg-panel p-2 shadow-[var(--shadow-soft)]">
          {builtinFiltered.map((lab) => (
            <button
              key={lab.id}
              onClick={() => setSelected({ type: "builtin", id: lab.id, title: lab.title })}
              className="flex w-full flex-col gap-0.5 rounded-[10px] px-3 py-2 text-left hover:bg-panel-2"
            >
              <span className="flex items-center gap-2 text-sm font-medium text-text">
                {lab.title}
                {lab.kind === "game" ? <Badge tone="orange">Game</Badge> : null}
              </span>
              <span className="text-xs text-muted">
                {lab.subject} · Lớp {lab.grade}
              </span>
            </button>
          ))}
          {builtinFiltered.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted">Không tìm thấy thí nghiệm phù hợp.</p>
          ) : null}
        </div>
      </div>

      <div className="flex min-h-[70vh] flex-col gap-2">
        {selected ? (
          <>
            <h2 className="text-sm font-semibold text-text">{selected.title}</h2>
            <iframe
              src={selected.type === "builtin" ? `/lab-library/${selected.id}.html` : selected.contentUrl ?? undefined}
              srcDoc={selected.type === "custom" ? selected.contentHtml ?? undefined : undefined}
              className="flex-1 rounded-[18px] border border-border bg-panel shadow-[var(--shadow-soft)]"
              title={selected.title}
            />
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center rounded-[18px] border border-border bg-panel text-muted shadow-[var(--shadow-soft)]">
            Chọn một thí nghiệm ở danh sách bên trái.
          </div>
        )}
      </div>
    </div>
  );
}

function AddCustomLabForm({ onAdded }: { onAdded: (lab: CustomLab) => void }) {
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [grade, setGrade] = useState("");
  const [description, setDescription] = useState("");
  const [mode, setMode] = useState<"upload" | "link">("upload");
  const [htmlContent, setHtmlContent] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => setHtmlContent(String(reader.result));
    reader.readAsText(file);
    setFileName(file.name);
  }

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      try {
        const lab = await addCustomLab({
          kind: "lab",
          subject,
          grade,
          title,
          description,
          contentHtml: mode === "upload" ? htmlContent ?? undefined : undefined,
          contentUrl: mode === "link" ? url : undefined,
        });
        onAdded(lab);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Không thể thêm thí nghiệm.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-[18px] border border-border bg-panel p-4 shadow-[var(--shadow-soft)]">
      <FormField label="Tên thí nghiệm">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} />
      </FormField>
      <div className="flex gap-2">
        <FormField label="Môn học" className="flex-1">
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
        </FormField>
        <FormField label="Lớp" className="w-24">
          <Input value={grade} onChange={(e) => setGrade(e.target.value)} />
        </FormField>
      </div>
      <FormField label="Mô tả ngắn">
        <Input value={description} onChange={(e) => setDescription(e.target.value)} />
      </FormField>

      <div className="flex gap-2">
        <Button variant={mode === "upload" ? "blue" : "gray"} onClick={() => setMode("upload")}>
          Tải file .html
        </Button>
        <Button variant={mode === "link" ? "blue" : "gray"} onClick={() => setMode("link")}>
          Dùng đường dẫn
        </Button>
      </div>

      {mode === "upload" ? (
        <FileDropzone accept=".html" label={fileName ?? "Chọn file .html"} onFile={handleFile} />
      ) : (
        <Input placeholder="https://..." value={url} onChange={(e) => setUrl(e.target.value)} />
      )}

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <Button onClick={handleSubmit} disabled={isPending || !title.trim()}>
        {isPending ? "Đang lưu..." : "Lưu thí nghiệm"}
      </Button>
    </div>
  );
}
