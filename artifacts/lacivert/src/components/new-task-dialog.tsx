import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { useCreateTask, type Task } from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { ChipPicker, Field, Segmented, UserAvatar } from "@/components/bits";
import { errMsg, PRIORITY, PRIORITY_ORDER, STATUS, STATUS_ORDER, useInvalidateAll, useMe, useWorkspace, useTaskUi, type NewTaskDefaults } from "@/lib/app";

export function NewTaskDialog({ open, onOpenChange, defaults }: { open: boolean; onOpenChange: (v: boolean) => void; defaults: NewTaskDefaults }) {
  const me = useMe();
  const isAdmin = me.role === "admin";
  const { data: ws } = useWorkspace();
  const create = useCreateTask();
  const invalidate = useInvalidateAll();
  const { toast } = useToast();
  const { openTask } = useTaskUi();

  const [mode, setMode] = useState<"board" | "private">("private");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [boardId, setBoardId] = useState<number | null>(null);
  const [columnId, setColumnId] = useState<number | null>(null);
  const [status, setStatus] = useState<Task["status"]>("todo");
  const [priority, setPriority] = useState<Task["priority"]>("medium");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [assigneeIds, setAssigneeIds] = useState<number[]>([]);
  const [teamIds, setTeamIds] = useState<number[]>([]);
  const [labels, setLabels] = useState("");
  const [error, setError] = useState<string | null>(null);

  const boards = ws?.boards ?? [];
  useEffect(() => {
    if (!open) return;
    const b = isAdmin ? defaults.boardId ?? null : null;
    setMode(b ? "board" : "private");
    setBoardId(b ?? (isAdmin ? boards[0]?.id ?? null : null));
    setColumnId(defaults.columnId ?? null);
    setTitle("");
    setDescription("");
    setStatus("todo");
    setPriority("medium");
    setStartDate("");
    setDueDate("");
    setAssigneeIds([me.id]);
    setTeamIds([]);
    setLabels("");
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const columns = useMemo(
    () => (ws?.columns ?? []).filter((c) => c.boardId === boardId).sort((a, b) => a.position - b.position),
    [ws, boardId],
  );
  useEffect(() => {
    if (columns.length && !columns.some((c) => c.id === columnId)) setColumnId(columns[0].id);
  }, [columns, columnId]);

  const activeUsers = (ws?.users ?? []).filter((u) => u.active);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!title.trim()) return setError("Görev başlığı gerekli.");
    const isBoard = mode === "board";
    if (isBoard && (!boardId || !columnId)) return setError("Pano ve sütun seçin.");
    if (isBoard && teamIds.length && !assigneeIds.length) return setError("Ekibe atanan görevler için en az bir sorumlu kişi seçin.");
    create.mutate(
      {
        data: {
          title: title.trim(),
          description,
          boardId: isBoard ? boardId : null,
          columnId: isBoard ? columnId : null,
          status: isBoard ? undefined : status,
          priority,
          assigneeIds: isBoard ? assigneeIds : [me.id],
          teamIds: isBoard ? teamIds : [],
          startDate: startDate || null,
          dueDate: dueDate || null,
          labels: labels.split(",").map((l) => l.trim()).filter(Boolean).slice(0, 20),
          checklist: [],
        },
      },
      {
        onSuccess: (t) => {
          invalidate();
          toast({ title: "Görev oluşturuldu", description: t.title });
          onOpenChange(false);
          openTask(t.id);
        },
        onError: (err) => setError(errMsg(err)),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto rounded-3xl border-border p-0 sm:max-w-[560px]">
        <form onSubmit={submit}>
          <DialogHeader className="border-b border-border px-6 pb-4 pt-6">
            <DialogTitle className="heading text-xl">Yeni görev.</DialogTitle>
            <DialogDescription>{isAdmin ? "Bir panoya ekleyin ya da yalnızca size ait kişisel görev oluşturun." : "Kişisel görevler yalnızca size görünür."}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 px-6 py-5">
            {isAdmin && (
              <Segmented
                value={mode}
                onChange={setMode}
                options={[
                  { value: "board", label: "Pano görevi" },
                  { value: "private", label: "Kişisel görev" },
                ]}
              />
            )}
            <Field label="Başlık">
              <input autoFocus className="field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Örneğin teklif dosyasını hazırla" maxLength={200} data-testid="input-task-title" />
            </Field>
            {mode === "board" ? (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Pano">
                  <select className="field" value={boardId ?? ""} onChange={(e) => setBoardId(Number(e.target.value) || null)} data-testid="select-task-board">
                    {boards.length === 0 && <option value="">Pano yok</option>}
                    {boards.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Sütun">
                  <select className="field" value={columnId ?? ""} onChange={(e) => setColumnId(Number(e.target.value) || null)} data-testid="select-task-column">
                    {columns.length === 0 && <option value="">Sütun yok</option>}
                    {columns.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </Field>
              </div>
            ) : (
              <Field label="Durum">
                <select className="field" value={status} onChange={(e) => setStatus(e.target.value as Task["status"])} data-testid="select-task-status">
                  {STATUS_ORDER.map((s) => (
                    <option key={s} value={s}>{STATUS[s]}</option>
                  ))}
                </select>
              </Field>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Öncelik">
                <select className="field" value={priority} onChange={(e) => setPriority(e.target.value as Task["priority"])} data-testid="select-task-priority">
                  {PRIORITY_ORDER.map((p) => (
                    <option key={p} value={p}>{PRIORITY[p].label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Bitiş">
                <input type="date" className="field" value={dueDate} onChange={(e) => setDueDate(e.target.value)} data-testid="input-task-due" />
              </Field>
            </div>
            {mode === "board" && (
              <>
                <Field label="Sorumlular">
                  <ChipPicker testid="chip-assignee" items={activeUsers} value={assigneeIds} onChange={setAssigneeIds} render={(u) => (<><UserAvatar user={u} size={20} />{u.id === me.id ? "Ben" : u.name}</>)} />
                </Field>
              </>
            )}
            <details key={String(open)} className="rounded-2xl border border-border px-4 py-3">
              <summary className="cursor-pointer text-[13px] font-semibold">Diğer ayrıntılar</summary>
              <div className="mt-4 space-y-4">
                <Field label="Açıklama">
                  <textarea className="field min-h-[72px] resize-y" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Bağlam, beklenen çıktı, notlar" data-testid="input-task-description" />
                </Field>
                <Field label="Başlangıç">
                  <input type="date" className="field" value={startDate} onChange={(e) => setStartDate(e.target.value)} data-testid="input-task-start" />
                </Field>
                {mode === "board" && <Field label="Ekipler" hint="Ekip atamasında en az bir sorumlu kişi gerekir.">
                  <ChipPicker testid="chip-team" items={ws?.teams ?? []} value={teamIds} onChange={setTeamIds} empty="Henüz ekip yok" render={(t) => <span className="pl-1.5">{t.name}</span>} />
                </Field>}
                <Field label="Etiketler" hint="Virgülle ayırın">
                  <input className="field" value={labels} onChange={(e) => setLabels(e.target.value)} placeholder="tasarım, müşteri" data-testid="input-task-labels" />
                </Field>
              </div>
            </details>
            {error && <p className="rounded-xl bg-destructive/8 px-3 py-2 text-[13px] text-destructive" data-testid="text-task-error">{error}</p>}
          </div>
          <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
            <button type="button" className="pill pill-outline" onClick={() => onOpenChange(false)}>Vazgeç</button>
            <button type="submit" className="pill pill-primary" disabled={create.isPending} data-testid="button-create-task">
              {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />}Görevi oluştur
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
