import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarClock, ChevronLeft, ChevronRight, ListChecks, Loader2, Lock, MessageSquare, Pencil, Plus, Trash2 } from "lucide-react";
import {
  getGetWorkspaceQueryKey,
  useCreatePersonalColumn,
  useDeletePersonalColumn,
  useUpdatePersonalColumn,
  useUpdateTask,
  type PersonalColumn,
  type Task,
  type Workspace,
} from "@workspace/api-client-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { PriorityTag } from "@/components/bits";
import { dueState, errMsg, fmtDate, STATUS, STATUS_ORDER, useInvalidateAll, useTaskUi } from "@/lib/app";
import { cn } from "@/lib/utils";
import { QuickTask } from "@/components/quick-task";

type Status = Task["status"];

export function sortedPersonalColumns(ws?: Workspace): PersonalColumn[] {
  return [...(ws?.personalColumns ?? [])].sort((a, b) => a.position - b.position || a.id - b.id);
}

/** Resolves a task's personal column, falling back to the first column matching its status. */
export function personalColumnOf(t: Task, cols: PersonalColumn[]): PersonalColumn | undefined {
  return cols.find((c) => c.id === t.personalColumnId) ?? cols.find((c) => c.status === t.status) ?? cols[0];
}

export function PersonalBoard({ ws, tasks, visible }: { ws: Workspace; tasks: Task[]; visible: (t: Task) => boolean }) {
  const qc = useQueryClient();
  const update = useUpdateTask();
  const invalidate = useInvalidateAll();
  const { toast } = useToast();
  const { openTask } = useTaskUi();
  const dragId = useRef<number | null>(null);
  const [drop, setDrop] = useState<{ c: number; index: number } | null>(null);
  const [adding, setAdding] = useState(false);
  const cols = sortedPersonalColumns(ws);
  const moving = update.isPending;

  const inCol = (cid: number) =>
    tasks.filter((t) => personalColumnOf(t, cols)?.id === cid).sort((a, b) => a.position - b.position || a.id - b.id);

  useEffect(() => {
    const end = () => setDrop(null);
    window.addEventListener("dragend", end);
    return () => window.removeEventListener("dragend", end);
  }, []);

  const commitMove = (taskId: number, colId: number, index: number) => {
    if (moving) return;
    const t = tasks.find((x) => x.id === taskId);
    const target = cols.find((c) => c.id === colId);
    if (!t || !target) return;
    const fromCol = personalColumnOf(t, cols)?.id;
    const same = fromCol === colId;
    const list = inCol(colId).filter((x) => x.id !== taskId);
    const from = inCol(colId).findIndex((x) => x.id === taskId);
    let idx = index;
    if (same && from > -1 && from < index) idx = index - 1;
    if (same && from === idx) return;
    idx = Math.max(0, Math.min(idx, list.length));
    list.splice(idx, 0, t);
    qc.setQueryData<Workspace>(getGetWorkspaceQueryKey(), (old) => {
      if (!old) return old;
      const pos = new Map(list.map((x, i) => [x.id, i]));
      return {
        ...old,
        tasks: old.tasks.map((x) =>
          x.id === taskId ? { ...x, personalColumnId: colId, status: target.status, position: idx } : pos.has(x.id) ? { ...x, position: pos.get(x.id)! } : x,
        ),
      };
    });
    update.mutate(
      { id: taskId, data: { personalColumnId: colId, position: idx } },
      { onSettled: () => invalidate(), onError: (e) => toast({ title: "Görev taşınamadı", description: errMsg(e), variant: "destructive" }) },
    );
  };

  return (
    <>
      {tasks.length === 0 && (
        <p className="mb-3 flex items-center gap-1.5 px-1 text-[13px] text-muted-foreground"><Lock className="h-3.5 w-3.5" />Panonuz boş. İlk görevinizi herhangi bir sütuna yazarak başlayın.</p>
      )}
      <div className="scroll-x -mx-4 flex items-start gap-3 overflow-x-auto px-4 pb-4 md:mx-0 md:px-0" data-testid="board-personal" aria-busy={moving}>
        {cols.map((col, ci) => {
          const all = inCol(col.id);
          const list = all.filter(visible);
          return (
            <section
              key={col.id}
              aria-label={col.name}
              className={cn("flex w-[284px] shrink-0 flex-col rounded-3xl bg-muted/70 transition-colors md:min-w-[240px] md:flex-1", drop?.c === col.id && "bg-[hsl(222_40%_93%)]")}
              onDragOver={(e) => {
                if (dragId.current === null || moving) return;
                e.preventDefault();
                if ((e.target as HTMLElement).closest("[data-card]")) return;
                setDrop({ c: col.id, index: all.length });
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragId.current !== null && drop) commitMove(dragId.current, drop.c, drop.index);
                dragId.current = null;
                setDrop(null);
              }}
              data-testid={`column-personal-${col.id}`}
            >
              <ColumnHeader col={col} index={ci} total={cols.length} count={all.length} shown={list.length} />
              <div className="flex-1 space-y-2 px-2.5 pb-2.5">
                {list.map((t) => {
                  const idx = all.findIndex((x) => x.id === t.id);
                  return (
                    <div key={t.id}>
                      {drop?.c === col.id && drop.index === idx && <div className="mb-2 h-1 rounded-full bg-primary" />}
                      <PersonalCard
                        task={t}
                        columns={cols}
                        columnId={col.id}
                        disabled={moving}
                        onOpen={() => openTask(t.id)}
                        onDragStart={() => (dragId.current = t.id)}
                        onDragOver={(e) => {
                          if (dragId.current === null || moving) return;
                          e.preventDefault();
                          const r = e.currentTarget.getBoundingClientRect();
                          setDrop({ c: col.id, index: e.clientY < r.top + r.height / 2 ? idx : idx + 1 });
                        }}
                        onMove={(cid) => commitMove(t.id, cid, inCol(cid).length)}
                      />
                    </div>
                  );
                })}
                {drop?.c === col.id && drop.index >= all.length && <div className="h-1 rounded-full bg-primary" />}
                {list.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-border px-3 py-6 text-center text-[12.5px] text-muted-foreground">
                    {all.length ? "Filtreye uyan görev yok" : "Görevleri buraya sürükleyin"}
                  </div>
                )}
                <QuickTask status={col.status} personalColumnId={col.id} />
              </div>
            </section>
          );
        })}
        <div className="w-[260px] shrink-0">
          {adding ? (
            <AddColumnForm onDone={() => setAdding(false)} />
          ) : (
            <button className="flex w-full items-center justify-center gap-1.5 rounded-3xl border border-dashed border-border px-4 py-5 text-[13px] font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground" onClick={() => setAdding(true)} data-testid="button-add-personal-column">
              <Plus className="h-4 w-4" />Sütun ekle
            </button>
          )}
        </div>
      </div>
    </>
  );
}

function StatusSelect({ value, onChange, testid, disabled }: { value: Status; onChange: (s: Status) => void; testid: string; disabled?: boolean }) {
  return (
    <select aria-label="Sütun durumu" className="field h-9 bg-card text-[12.5px]" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value as Status)} data-testid={testid}>
      {STATUS_ORDER.map((s) => <option key={s} value={s}>{STATUS[s]}</option>)}
    </select>
  );
}

function AddColumnForm({ onDone }: { onDone: () => void }) {
  const create = useCreatePersonalColumn();
  const invalidate = useInvalidateAll();
  const [name, setName] = useState("");
  const [status, setStatus] = useState<Status>("todo");
  const [error, setError] = useState("");
  return (
    <form
      className="space-y-2 rounded-3xl bg-muted/70 p-3"
      aria-label="Yeni sütun"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim() || create.isPending) return;
        setError("");
        create.mutate({ data: { name: name.trim(), status } }, { onSuccess: () => { invalidate(); onDone(); }, onError: (err) => setError(errMsg(err)) });
      }}
    >
      <input autoFocus className="field h-9 bg-card text-[13px]" placeholder="Sütun adı" aria-label="Sütun adı" maxLength={100} value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Escape" && onDone()} data-testid="input-new-personal-column" />
      <StatusSelect value={status} onChange={setStatus} testid="select-new-personal-column-status" />
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      <div className="flex justify-end gap-1.5">
        <button type="button" className="pill pill-sm pill-soft" onClick={onDone} data-testid="button-cancel-personal-column">Vazgeç</button>
        <button type="submit" className="pill pill-sm pill-primary" disabled={!name.trim() || create.isPending} data-testid="button-save-new-personal-column">
          {create.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}Ekle
        </button>
      </div>
    </form>
  );
}

function ColumnHeader({ col, index, total, count, shown }: { col: PersonalColumn; index: number; total: number; count: number; shown: number }) {
  const update = useUpdatePersonalColumn();
  const del = useDeletePersonalColumn();
  const invalidate = useInvalidateAll();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(col.name);
  const [status, setStatus] = useState<Status>(col.status);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState(false);
  const busy = update.isPending || del.isPending;

  const move = (dir: -1 | 1) =>
    update.mutate({ id: col.id, data: { position: index + dir } }, {
      onSettled: () => invalidate(),
      onError: (e) => toast({ title: "Sütun taşınamadı", description: errMsg(e), variant: "destructive" }),
    });

  if (editing)
    return (
      <form
        className="space-y-2 px-3 pb-2 pt-3"
        aria-label={`${col.name} sütununu düzenle`}
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim() || busy) return;
          setError("");
          update.mutate({ id: col.id, data: { name: name.trim(), status } }, {
            onSuccess: () => { invalidate(); setEditing(false); },
            onError: (err) => setError(errMsg(err)),
          });
        }}
      >
        <input autoFocus className="field h-9 bg-card text-[13px]" aria-label="Sütun adı" maxLength={100} value={name} onChange={(e) => setName(e.target.value)} data-testid={`input-personal-column-name-${col.id}`} />
        <StatusSelect value={status} onChange={setStatus} testid={`select-personal-column-status-${col.id}`} />
        {status !== col.status && count > 0 && <p className="text-[11.5px] text-muted-foreground">Bu sütundaki {count} görevin durumu da güncellenir.</p>}
        {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
        <div className="flex justify-end gap-1.5">
          <button type="button" className="pill pill-sm pill-soft" onClick={() => { setEditing(false); setName(col.name); setStatus(col.status); setError(""); }} data-testid={`button-cancel-personal-column-${col.id}`}>Vazgeç</button>
          <button type="submit" className="pill pill-sm pill-primary" disabled={!name.trim() || busy} data-testid={`button-save-personal-column-${col.id}`}>
            {update.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}Kaydet
          </button>
        </div>
      </form>
    );

  const iconBtn = "flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-card hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent";
  return (
    <header className="px-4 pb-2 pt-3.5">
      <div className="flex items-center gap-1">
        <h2 className="min-w-0 flex-1 truncate text-[13.5px] font-semibold" data-testid={`text-personal-column-name-${col.id}`}>{col.name}</h2>
        <span className="eyebrow mr-1" data-testid={`text-count-personal-${col.id}`}>{shown === count ? count : `${shown}/${count}`}</span>
        <button className={iconBtn} disabled={busy || index === 0} onClick={() => move(-1)} aria-label={`${col.name} sütununu sola taşı`} data-testid={`button-personal-column-left-${col.id}`}><ChevronLeft className="h-3.5 w-3.5" /></button>
        <button className={iconBtn} disabled={busy || index === total - 1} onClick={() => move(1)} aria-label={`${col.name} sütununu sağa taşı`} data-testid={`button-personal-column-right-${col.id}`}><ChevronRight className="h-3.5 w-3.5" /></button>
        <button className={iconBtn} disabled={busy} onClick={() => { setName(col.name); setStatus(col.status); setEditing(true); }} aria-label={`${col.name} sütununu düzenle`} data-testid={`button-edit-personal-column-${col.id}`}><Pencil className="h-3.5 w-3.5" /></button>
        <button
          className={iconBtn}
          disabled={busy || count > 0 || total <= 1}
          title={count > 0 ? "Silmek için önce görevleri taşıyın" : total <= 1 ? "Son sütun silinemez" : undefined}
          onClick={() => setConfirm(true)}
          aria-label={`${col.name} sütununu sil`}
          data-testid={`button-delete-personal-column-${col.id}`}
        ><Trash2 className="h-3.5 w-3.5" /></button>
      </div>
      <span className="mt-0.5 block text-[11px] text-muted-foreground" data-testid={`text-personal-column-status-${col.id}`}>{STATUS[col.status]}</span>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="heading">Sütun Silinsin mi?</AlertDialogTitle>
            <AlertDialogDescription>"{col.name}" sütunu boş ve panonuzdan kaldırılacak.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Vazgeç</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-full bg-destructive hover:bg-destructive/90"
              disabled={del.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (del.isPending) return;
                del.mutate({ id: col.id }, {
                  onSuccess: () => { invalidate(); setConfirm(false); toast({ title: "Sütun silindi" }); },
                  onError: (err) => { setConfirm(false); toast({ title: "Sütun silinemedi", description: errMsg(err), variant: "destructive" }); },
                });
              }}
              data-testid={`button-confirm-delete-personal-column-${col.id}`}
            >
              {del.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Sütunu sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </header>
  );
}

export function PersonalCard({ task, columns, columnId, disabled, onOpen, onDragStart, onDragOver, onMove }: {
  task: Task; columns: PersonalColumn[]; columnId: number; disabled: boolean; onOpen: () => void; onDragStart: () => void;
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void; onMove: (columnId: number) => void;
}) {
  const due = dueState(task);
  const checked = task.checklist.filter((c) => c.checked).length;
  return (
    <div
      data-card
      draggable={!disabled}
      onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; onDragStart(); }}
      onDragOver={onDragOver}
      className={cn("group cursor-grab rounded-2xl border border-[hsl(var(--card-border))] bg-card p-3 transition-colors hover:border-[hsl(220_13%_82%)] active:cursor-grabbing", disabled && "cursor-wait")}
      data-testid={`card-task-${task.id}`}
    >
      <button type="button" className="block w-full rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-primary" onClick={onOpen} data-testid={`button-open-task-${task.id}`}>
        {task.labels.length > 0 && (
          <span className="mb-1.5 flex flex-wrap gap-1">
            {task.labels.slice(0, 3).map((l) => <span key={l} className="rounded-full bg-muted px-2 py-0.5 text-[10.5px] font-semibold text-foreground/70">{l}</span>)}
          </span>
        )}
        <span className={cn("block text-[13.5px] font-semibold leading-snug", task.status === "done" && "text-muted-foreground line-through")}>{task.title}</span>
      </button>
      <div className="mt-2.5 flex flex-wrap items-center gap-2.5 text-[11.5px] text-muted-foreground">
        <PriorityTag p={task.priority} />
        {task.dueDate && (
          <span className={cn("inline-flex items-center gap-1", due === "overdue" && "font-semibold text-destructive", due === "soon" && "font-semibold text-amber-700")}>
            <CalendarClock className="h-3 w-3" />{fmtDate(task.dueDate)}
          </span>
        )}
        {task.checklist.length > 0 && <span className="inline-flex items-center gap-1"><ListChecks className="h-3 w-3" />{checked}/{task.checklist.length}</span>}
        {task.commentCount > 0 && <span className="inline-flex items-center gap-1"><MessageSquare className="h-3 w-3" />{task.commentCount}</span>}
        <select
          aria-label={`${task.title} sütunu`}
          className="field ml-auto h-7 w-[118px] rounded-full py-0 text-[11.5px]"
          value={columnId}
          disabled={disabled}
          onChange={(e) => onMove(Number(e.target.value))}
          data-testid={`select-personal-column-${task.id}`}
        >
          {columns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
    </div>
  );
}

