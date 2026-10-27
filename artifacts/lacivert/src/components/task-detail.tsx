import { useEffect, useRef, useState } from "react";
import { Calendar, Loader2, Lock, Plus, Trash2, X, MessageSquare, History, LayoutGrid } from "lucide-react";
import {
  useGetTask,
  getGetTaskQueryKey,
  useUpdateTask,
  useDeleteTask,
  useAddComment,
  type Task,
  type TaskUpdate,
  type ChecklistItem,
} from "@workspace/api-client-react";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { ChipPicker, Field, UserAvatar } from "@/components/bits";
import { dateInput, errMsg, fmtDateLong, isAssignedToMe, PRIORITY, PRIORITY_ORDER, relTime, STATUS, STATUS_ORDER, useInvalidateAll, useMe, useWorkspace } from "@/lib/app";
import { cn } from "@/lib/utils";

export function TaskDetailSheet({ taskId, onClose }: { taskId: number | null; onClose: () => void }) {
  return (
    <Sheet open={taskId !== null} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto border-l border-border p-0 sm:max-w-[640px]">
        <SheetTitle className="sr-only">Görev ayrıntısı</SheetTitle>
        <SheetDescription className="sr-only">Görevi düzenleyin, yorum ekleyin ve geçmişi inceleyin</SheetDescription>
        {taskId !== null && <TaskDetailBody key={taskId} id={taskId} onClose={onClose} />}
      </SheetContent>
    </Sheet>
  );
}

function TaskDetailBody({ id, onClose }: { id: number; onClose: () => void }) {
  const me = useMe();
  const { data: ws } = useWorkspace();
  const { data, isLoading, isError, refetch } = useGetTask(id, { query: { enabled: !!id, queryKey: getGetTaskQueryKey(id) } });
  const update = useUpdateTask();
  const del = useDeleteTask();
  const addComment = useAddComment();
  const invalidate = useInvalidateAll();
  const { toast } = useToast();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Task["priority"]>("medium");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [labels, setLabels] = useState<string[]>([]);
  const [labelDraft, setLabelDraft] = useState("");
  const [assigneeIds, setAssigneeIds] = useState<number[]>([]);
  const [teamIds, setTeamIds] = useState<number[]>([]);
  const [checkDraft, setCheckDraft] = useState("");
  const [comment, setComment] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const initFor = useRef<number | null>(null);

  const task = data?.task;
  useEffect(() => {
    if (task && initFor.current !== task.id) {
      initFor.current = task.id;
      setTitle(task.title);
      setDescription(task.description);
      setPriority(task.priority);
      setStartDate(dateInput(task.startDate));
      setDueDate(dateInput(task.dueDate));
      setLabels(task.labels);
      setAssigneeIds(task.assigneeIds);
      setTeamIds(task.teamIds);
    }
  }, [task]);

  if (isLoading)
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-5 w-32 rounded-full" />
        <Skeleton className="h-9 w-3/4 rounded-xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  if (isError || !data || !task)
    return (
      <div className="p-8 text-center">
        <h3 className="heading text-lg">Görev Açılamadı</h3>
        <p className="mt-1 text-sm text-muted-foreground">Silinmiş olabilir ya da erişiminiz yok.</p>
        <button className="pill pill-outline mt-4" onClick={() => refetch()}>Tekrar dene</button>
      </div>
    );

  const isPersonal = task.boardId === null;
  const canEdit = isPersonal ? task.creatorId === me.id : me.role === "admin";
  const canDelete = isPersonal ? task.creatorId === me.id : me.role === "admin";
  const canProgress = canEdit || isAssignedToMe(task, me, ws);
  const board = ws?.boards.find((b) => b.id === task.boardId);
  const columns = (ws?.columns ?? []).filter((c) => c.boardId === task.boardId).sort((a, b) => a.position - b.position);
  const userById = (uid: number) => ws?.users.find((u) => u.id === uid);
  const done = task.checklist.filter((c) => c.checked).length;

  const patch = (d: TaskUpdate, msg?: string, after?: () => void) =>
    update.mutate(
      { id: task.id, data: d },
      {
        onSuccess: () => {
          invalidate();
          if (msg) toast({ title: msg });
          after?.();
        },
        onError: (e) => toast({ title: "Güncellenemedi", description: errMsg(e), variant: "destructive" }),
      },
    );

  const saveDetails = () => {
    setFormError(null);
    if (!title.trim()) return setFormError("Başlık boş olamaz.");
    if (!isPersonal && teamIds.length && !assigneeIds.length) return setFormError("Ekip atamasında en az bir sorumlu kişi seçin.");
    patch(
      {
        title: title.trim(),
        description,
        priority,
        startDate: startDate || null,
        dueDate: dueDate || null,
        labels,
        ...(isPersonal ? {} : { assigneeIds, teamIds }),
      },
      "Değişiklikler kaydedildi",
    );
  };

  const setChecklist = (list: ChecklistItem[]) => patch({ checklist: list });
  const addCheck = () => {
    const t = checkDraft.trim();
    if (!t) return;
    setChecklist([...task.checklist, { id: Math.random().toString(36).slice(2, 10), title: t, checked: false }]);
    setCheckDraft("");
  };

  const dirty =
    canEdit &&
    (title !== task.title ||
      description !== task.description ||
      priority !== task.priority ||
      startDate !== dateInput(task.startDate) ||
      dueDate !== dateInput(task.dueDate) ||
      labels.join("|") !== task.labels.join("|") ||
      assigneeIds.join(",") !== task.assigneeIds.join(",") ||
      teamIds.join(",") !== task.teamIds.join(","));

  return (
    <div className="flex min-h-full flex-col">
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border bg-card/95 px-6 py-3 backdrop-blur">
        <span className="flex items-center gap-2 truncate text-[12.5px] font-medium text-muted-foreground">
          {isPersonal ? <Lock className="h-3.5 w-3.5" /> : <LayoutGrid className="h-3.5 w-3.5" />}
          {isPersonal ? "Kişisel görev" : board?.name ?? "Pano"}
          <span className="eyebrow">#{task.id}</span>
        </span>
        <div className="flex items-center gap-1.5">
          {canDelete && (
            <button className="pill pill-sm pill-soft text-destructive" onClick={() => setConfirmDelete(true)} data-testid="button-delete-task">
              <Trash2 className="h-3.5 w-3.5" />Sil
            </button>
          )}
          <button className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted" onClick={onClose} aria-label="Kapat" data-testid="button-close-task">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="space-y-6 px-6 py-5">
        {!isPersonal && me.role !== "admin" && (
          <p className="rounded-xl bg-muted px-3 py-2 text-[12px] text-muted-foreground" data-testid="text-task-delete-restriction">
            Pano görevlerini yalnızca yönetici silebilir.
          </p>
        )}
        {canEdit ? (
          <textarea
            className="heading w-full resize-none rounded-xl bg-transparent text-[22px] outline-none focus:bg-muted/60 focus:px-2"
            rows={Math.min(3, Math.ceil(title.length / 40) || 1)}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            data-testid="input-detail-title"
          />
        ) : (
          <h2 className="heading text-[22px]" data-testid="text-detail-title">{task.title}</h2>
        )}

        <div className="grid grid-cols-2 gap-3 rounded-2xl bg-muted/60 p-4 sm:grid-cols-3">
          <Field label={isPersonal ? "Durum" : "Sütun"}>
            {isPersonal ? (
              <select className="field bg-card" disabled={!canProgress} value={task.status} onChange={(e) => patch({ status: e.target.value as Task["status"] }, "Durum güncellendi")} data-testid="select-detail-status">
                {STATUS_ORDER.map((s) => <option key={s} value={s}>{STATUS[s]}</option>)}
              </select>
            ) : (
              <select className="field bg-card" disabled={!canProgress} value={task.columnId ?? ""} onChange={(e) => patch({ columnId: Number(e.target.value), position: 0 }, "Sütun güncellendi")} data-testid="select-detail-column">
                {columns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
          </Field>
          {!isPersonal && (
            <Field label="Durum">
              <select className="field bg-card" disabled={!canProgress} value={task.status} onChange={(e) => patch({ status: e.target.value as Task["status"] }, "Durum güncellendi")} data-testid="select-detail-status">
                {STATUS_ORDER.map((s) => <option key={s} value={s}>{STATUS[s]}</option>)}
              </select>
            </Field>
          )}
          <Field label="Öncelik">
            <select className="field bg-card" disabled={!canEdit} value={priority} onChange={(e) => setPriority(e.target.value as Task["priority"])} data-testid="select-detail-priority">
              {PRIORITY_ORDER.map((p) => <option key={p} value={p}>{PRIORITY[p].label}</option>)}
            </select>
          </Field>
          <Field label="Başlangıç">
            <input type="date" className="field bg-card" disabled={!canEdit} value={startDate} onChange={(e) => setStartDate(e.target.value)} data-testid="input-detail-start" />
          </Field>
          <Field label="Bitiş">
            <input type="date" className="field bg-card" disabled={!canEdit} value={dueDate} onChange={(e) => setDueDate(e.target.value)} data-testid="input-detail-due" />
          </Field>
        </div>

        <section>
          <h3 className="mb-2 text-[13px] font-semibold">Açıklama</h3>
          {canEdit ? (
            <textarea className="field min-h-[96px] resize-y" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ayrıntı ekleyin" data-testid="input-detail-description" />
          ) : (
            <p className="whitespace-pre-wrap text-[14px] text-foreground/85">{task.description || <span className="text-muted-foreground">Açıklama yok.</span>}</p>
          )}
        </section>

        {!isPersonal && (
          <section className="space-y-3">
            <h3 className="text-[13px] font-semibold">Sorumlular</h3>
            {canEdit ? (
              <ChipPicker testid="chip-detail-assignee" items={(ws?.users ?? []).filter((u) => u.active || assigneeIds.includes(u.id))} value={assigneeIds} onChange={setAssigneeIds} render={(u) => (<><UserAvatar user={u} size={20} />{u.name}</>)} />
            ) : (
              <div className="flex flex-wrap gap-2">
                {task.assigneeIds.map((uid) => (
                  <span key={uid} className="inline-flex h-8 items-center gap-1.5 rounded-full bg-muted pl-1.5 pr-3 text-[13px]"><UserAvatar user={userById(uid)} size={20} />{userById(uid)?.name ?? "Kullanıcı"}</span>
                ))}
              </div>
            )}
            <h3 className="pt-1 text-[13px] font-semibold">Ekipler</h3>
            {canEdit ? (
              <ChipPicker testid="chip-detail-team" items={ws?.teams ?? []} value={teamIds} onChange={setTeamIds} empty="Henüz ekip yok" render={(t) => <span className="pl-1.5">{t.name}</span>} />
            ) : (
              <p className="text-[13px] text-muted-foreground">{task.teamIds.map((tid) => ws?.teams.find((t) => t.id === tid)?.name).filter(Boolean).join(", ") || "Ekip atanmamış"}</p>
            )}
          </section>
        )}

        <section>
          <h3 className="mb-2 text-[13px] font-semibold">Etiketler</h3>
          <div className="flex flex-wrap items-center gap-1.5">
            {labels.map((l) => (
              <span key={l} className="inline-flex h-7 items-center gap-1 rounded-full bg-muted px-3 text-[12.5px] font-medium">
                {l}
                {canEdit && <button onClick={() => setLabels(labels.filter((x) => x !== l))} aria-label={`${l} etiketini kaldır`}><X className="h-3 w-3" /></button>}
              </span>
            ))}
            {canEdit && (
              <input
                className="h-7 w-36 rounded-full bg-transparent px-3 text-[12.5px] outline-none ring-1 ring-border focus:ring-primary"
                placeholder="Etiket ekle"
                value={labelDraft}
                maxLength={40}
                onChange={(e) => setLabelDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && labelDraft.trim()) {
                    e.preventDefault();
                    if (!labels.includes(labelDraft.trim())) setLabels([...labels, labelDraft.trim()]);
                    setLabelDraft("");
                  }
                }}
                data-testid="input-detail-label"
              />
            )}
            {!canEdit && labels.length === 0 && <span className="text-[13px] text-muted-foreground">Etiket yok.</span>}
          </div>
        </section>

        {canEdit && (
          <div className="flex items-center justify-end gap-2">
            {formError && <span className="mr-auto text-[13px] text-destructive">{formError}</span>}
            <button className="pill pill-primary" disabled={!dirty || update.isPending} onClick={saveDetails} data-testid="button-save-task">
              {update.isPending && <Loader2 className="h-4 w-4 animate-spin" />}Değişiklikleri kaydet
            </button>
          </div>
        )}

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-[13px] font-semibold">Kontrol listesi</h3>
            <span className="eyebrow">{done}/{task.checklist.length}</span>
          </div>
          {task.checklist.length > 0 && (
            <div className="mb-2 h-1 overflow-hidden rounded-full bg-muted">
              <div className="h-full origin-left bg-primary transition-transform" style={{ transform: `scaleX(${done / task.checklist.length})` }} />
            </div>
          )}
          <ul className="divide-y divide-border rounded-2xl border border-border">
            {task.checklist.map((c) => (
              <li key={c.id} className="group flex items-center gap-3 px-3 py-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[hsl(222_62%_20%)]"
                  checked={c.checked}
                  disabled={!canProgress}
                  onChange={() => setChecklist(task.checklist.map((x) => (x.id === c.id ? { ...x, checked: !x.checked } : x)))}
                  data-testid={`checkbox-check-${c.id}`}
                />
                <span className={cn("flex-1 text-[14px]", c.checked && "text-muted-foreground line-through")}>{c.title}</span>
                {canProgress && (
                  <button className="opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100" onClick={() => setChecklist(task.checklist.filter((x) => x.id !== c.id))} aria-label="Maddeyi sil">
                    <X className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                )}
              </li>
            ))}
            {canProgress && (
              <li className="flex items-center gap-2 px-3 py-2">
                <Plus className="h-4 w-4 text-muted-foreground" />
                <input
                  className="flex-1 bg-transparent text-[14px] outline-none"
                  placeholder="Madde ekle ve Enter'a basın"
                  value={checkDraft}
                  maxLength={500}
                  onChange={(e) => setCheckDraft(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCheck())}
                  data-testid="input-check-new"
                />
              </li>
            )}
            {!canProgress && task.checklist.length === 0 && <li className="px-3 py-3 text-[13px] text-muted-foreground">Kontrol listesi boş.</li>}
          </ul>
        </section>

        <section>
          <h3 className="mb-3 flex items-center gap-2 text-[13px] font-semibold"><MessageSquare className="h-4 w-4" />Yorumlar <span className="eyebrow">{data.comments.length}</span></h3>
          <div className="space-y-3">
            {data.comments.map((c) => {
              const u = userById(c.userId);
              return (
                <div key={c.id} className="flex gap-3" data-testid={`comment-${c.id}`}>
                  <UserAvatar user={u} size={28} />
                  <div className="flex-1 rounded-2xl bg-muted/70 px-3.5 py-2.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[13px] font-semibold">{u?.name ?? "Kullanıcı"}</span>
                      <span className="text-[11.5px] text-muted-foreground" title={fmtDateLong(c.createdAt)}>{relTime(c.createdAt)}</span>
                    </div>
                    <p className="mt-0.5 whitespace-pre-wrap text-[14px]">{c.text}</p>
                  </div>
                </div>
              );
            })}
            <form
              className="flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!comment.trim()) return;
                addComment.mutate(
                  { id: task.id, data: { text: comment.trim() } },
                  { onSuccess: () => { setComment(""); invalidate(); }, onError: (err) => toast({ title: "Yorum eklenemedi", description: errMsg(err), variant: "destructive" }) },
                );
              }}
            >
              <textarea className="field min-h-[42px] resize-none" rows={1} placeholder="Yorum yazın" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={5000} data-testid="input-comment" />
              <button className="pill pill-primary h-[42px]" disabled={!comment.trim() || addComment.isPending} data-testid="button-add-comment">
                {addComment.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Gönder"}
              </button>
            </form>
          </div>
        </section>

        <section className="pb-6">
          <h3 className="mb-3 flex items-center gap-2 text-[13px] font-semibold"><History className="h-4 w-4" />Geçmiş</h3>
          <ol className="relative space-y-3 border-l border-border pl-4">
            {data.activity.map((a) => (
              <li key={a.id} className="text-[13px]">
                <span className="absolute -left-[3.5px] mt-1.5 h-1.5 w-1.5 rounded-full bg-border" />
                <span className="font-semibold">{userById(a.userId)?.name ?? "Sistem"}</span> <span className="text-foreground/80">{a.message}</span>
                <span className="ml-1.5 text-[11.5px] text-muted-foreground">{relTime(a.createdAt)}</span>
              </li>
            ))}
            {data.activity.length === 0 && <li className="text-[13px] text-muted-foreground">Henüz hareket yok.</li>}
          </ol>
          <p className="mt-4 flex items-center gap-1.5 text-[12px] text-muted-foreground"><Calendar className="h-3.5 w-3.5" />Oluşturan {userById(task.creatorId)?.name ?? "Kullanıcı"} · {fmtDateLong(task.createdAt)}</p>
        </section>
      </div>

      <AlertDialog open={confirmDelete && canDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="heading">Görev silinsin mi?</AlertDialogTitle>
            <AlertDialogDescription>"{task.title}" yorumları ve geçmişiyle birlikte kalıcı olarak silinecek.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Vazgeç</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-full bg-destructive hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                if (!canDelete || del.isPending) return;
                del.mutate(
                  { id: task.id },
                  {
                    onSuccess: () => { invalidate(); toast({ title: "Görev silindi" }); setConfirmDelete(false); onClose(); },
                    onError: (err) => toast({ title: "Silinemedi", description: errMsg(err), variant: "destructive" }),
                  },
                );
              }}
              data-testid="button-confirm-delete-task"
            >
              {del.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Kalıcı olarak sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
