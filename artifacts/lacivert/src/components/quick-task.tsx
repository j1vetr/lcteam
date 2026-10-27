import { useRef, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { useCreateTask } from "@workspace/api-client-react";
import { errMsg, useInvalidateAll, useMe } from "@/lib/app";
import { useToast } from "@/hooks/use-toast";

export function QuickTask({ boardId = null, columnId = null }: { boardId?: number | null; columnId?: number | null }) {
  const me = useMe();
  const create = useCreateTask();
  const invalidate = useInvalidateAll();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);

  return (
    <form className="rounded-2xl border border-border bg-card p-2" aria-label={boardId ? "Sütuna hızlı görev ekle" : "Hızlı kişisel görev ekle"} onSubmit={(e) => {
      e.preventDefault();
      if (!title.trim() || create.isPending) return;
      setError("");
      create.mutate({ data: {
        title: title.trim(), boardId, columnId, assigneeIds: [me.id],
        teamIds: [], priority: "medium", status: "todo", labels: [], checklist: [],
      } }, {
        onSuccess: () => {
          invalidate();
          setTitle("");
          toast({ title: "Görev eklendi" });
          requestAnimationFrame(() => input.current?.focus());
        },
        onError: (err) => setError(errMsg(err)),
      });
    }}>
      <div className="flex items-center gap-1">
        <input ref={input} className="field min-w-0 flex-1 border-0 bg-transparent text-[13px] shadow-none" aria-label="Hızlı görev başlığı" placeholder={boardId ? "Görev yazın, Enter’a basın" : "Kişisel görev yazın, Enter’a basın"} value={title} maxLength={200} disabled={create.isPending} onChange={(e) => setTitle(e.target.value)} data-testid={`input-quick-task-${columnId ?? "personal"}`} />
        <button className="pill pill-primary shrink-0 px-2.5" type="submit" aria-label="Görevi ekle" disabled={!title.trim() || create.isPending} data-testid={`button-quick-task-${columnId ?? "personal"}`}>
          {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        </button>
      </div>
      {error && <p role="alert" className="px-2 pb-1 text-xs text-destructive">{error}</p>}
    </form>
  );
}
