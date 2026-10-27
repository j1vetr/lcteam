import { useState } from "react";
import { CalendarClock, CheckSquare, Lock, Plus } from "lucide-react";
import { useUpdateTask, type Task } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { EmptyState, ErrorState, PageHeader, PriorityTag, Segmented } from "@/components/bits";
import { dueState, errMsg, fmtDate, isAssignedToMe, STATUS, STATUS_ORDER, useInvalidateAll, useMe, useTaskUi, useWorkspace } from "@/lib/app";
import { cn } from "@/lib/utils";
import { QuickTask } from "@/components/quick-task";
import { matchesTaskMonth, TaskMonthFilter } from "@/components/task-month-filter";
import { TaskCalendar } from "@/components/task-calendar";
import { istanbulToday } from "@/lib/task-calendar";

type Filter = "all" | "personal" | "assigned";

export default function MyTasksPage() {
  const me = useMe();
  const { data: ws, isLoading, isError, refetch } = useWorkspace();
  const { openTask, newTask } = useTaskUi();
  const update = useUpdateTask();
  const invalidate = useInvalidateAll();
  const { toast } = useToast();
  const [filter, setFilter] = useState<Filter>("all");
  const [hideDone, setHideDone] = useState(false);
  const [month, setMonth] = useState("");
  const [view, setView] = useState<"list" | "calendar">("list");
  const [calendarMonth, setCalendarMonth] = useState(() => istanbulToday().slice(0, 7));

  const mine = (ws?.tasks ?? []).filter((t) => (t.boardId === null && t.creatorId === me.id) || isAssignedToMe(t, me, ws));
  const filtered = mine
    .filter((t) => (filter === "personal" ? t.boardId === null : filter === "assigned" ? t.boardId !== null : true))
    .filter((t) => !hideDone || t.status !== "done");
  const shown = filtered.filter((t) => matchesTaskMonth(t, month));

  const setStatus = (t: Task, status: Task["status"]) =>
    update.mutate({ id: t.id, data: { status } }, { onSuccess: () => invalidate(), onError: (e) => toast({ title: "Durum değiştirilemedi", description: errMsg(e), variant: "destructive" }) });
  const setColumn = (t: Task, columnId: number) =>
    update.mutate({ id: t.id, data: { columnId, position: 0 } }, { onSuccess: () => invalidate(), onError: (e) => toast({ title: "Sütun değiştirilemedi", description: errMsg(e), variant: "destructive" }) });

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-6 md:px-8 md:py-8">
      <PageHeader title="Görevlerim." sub="Kişisel işleriniz ve size atanan şirket görevleri." actions={<button className="pill pill-primary" onClick={() => newTask()} data-testid="button-new-personal"><Plus className="h-4 w-4" />Kişisel görev</button>} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Segmented value={filter} onChange={setFilter} options={[{ value: "all", label: `Tümü ${mine.length}` }, { value: "personal", label: "Kişisel" }, { value: "assigned", label: "Atanan" }]} />
        <Segmented value={view} onChange={(next) => {
          if (next === "calendar" && month && month !== "undated") setCalendarMonth(month);
          setView(next);
        }} options={[{ value: "list", label: "Liste" }, { value: "calendar", label: "Takvim" }]} />
        {view === "list" && <TaskMonthFilter value={month} onChange={setMonth} />}
        <button className={cn("pill pill-sm ml-auto", hideDone ? "pill-primary" : "pill-soft")} onClick={() => setHideDone(!hideDone)} aria-pressed={hideDone} data-testid="button-hide-done">Tamamlananları gizle</button>
      </div>
      <div className="mb-5">
        <QuickTask />
        {view === "list" && month && <p className="mt-2 px-1 text-xs text-muted-foreground">Ay filtresi bitiş tarihini esas alır. Tarihsiz yeni görevler için “Tüm tarihler” veya “Tarihsiz” seçin.</p>}
      </div>

      {isLoading ? (
        <div className="space-y-2">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-14 rounded-2xl" />)}</div>
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : view === "calendar" && ws ? (
        <TaskCalendar tasks={filtered} ws={ws} month={calendarMonth} onMonthChange={setCalendarMonth} />
      ) : shown.length === 0 ? (
        <EmptyState icon={<CheckSquare className="h-5 w-5" />} title={mine.length ? "Bu filtrede görev yok." : "Listeniz boş."} text="Kendinize kişisel bir görev ekleyin. Yalnızca siz görürsünüz." action={<button className="pill pill-primary" onClick={() => newTask()}><Plus className="h-4 w-4" />Kişisel görev</button>} />
      ) : (
        <div className="space-y-6">
          {STATUS_ORDER.map((s) => {
            const group = shown.filter((t) => t.status === s).sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"));
            if (!group.length) return null;
            return (
              <section key={s}>
                <h2 className="mb-2 flex items-center gap-2 px-1 text-[13px] font-semibold">{STATUS[s]}<span className="eyebrow">{group.length}</span></h2>
                <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
                  {group.map((t) => {
                    const board = ws?.boards.find((b) => b.id === t.boardId);
                    const cols = (ws?.columns ?? []).filter((c) => c.boardId === t.boardId).sort((a, b) => a.position - b.position);
                    const due = dueState(t);
                    return (
                      <li key={t.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2.5 hover:bg-muted/40" data-testid={`row-task-${t.id}`}>
                        <button
                          aria-label={t.status === "done" ? "Tamamlanmadı olarak işaretle" : "Tamamlandı olarak işaretle"}
                          onClick={() => setStatus(t, t.status === "done" ? "todo" : "done")}
                          className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors", t.status === "done" ? "border-primary bg-primary" : "border-border hover:border-primary")}
                          data-testid={`button-toggle-done-${t.id}`}
                        >
                          {t.status === "done" && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                        </button>
                        <button className="min-w-0 flex-1 text-left" onClick={() => openTask(t.id)}>
                          <span className={cn("block truncate text-[14px] font-medium", t.status === "done" && "text-muted-foreground line-through")}>{t.title}</span>
                          <span className="flex items-center gap-1 text-[12px] text-muted-foreground">
                            {board ? board.name : (<><Lock className="h-3 w-3" />Kişisel</>)}
                            {t.labels.length > 0 && <> · {t.labels.slice(0, 2).join(", ")}</>}
                          </span>
                        </button>
                        <PriorityTag p={t.priority} />
                        <span className={cn("inline-flex w-16 items-center gap-1 font-mono text-[12px]", due === "overdue" ? "text-destructive" : due === "soon" ? "text-amber-700" : "text-muted-foreground")}>
                          {t.dueDate && <><CalendarClock className="h-3 w-3" />{fmtDate(t.dueDate)}</>}
                        </span>
                        {t.boardId === null ? (
                          <select aria-label="Durum" className="field h-8 w-[136px] rounded-full py-0 text-[12.5px]" value={t.status} onChange={(e) => setStatus(t, e.target.value as Task["status"])} data-testid={`select-status-${t.id}`}>
                            {STATUS_ORDER.map((x) => <option key={x} value={x}>{STATUS[x]}</option>)}
                          </select>
                        ) : (
                          <select aria-label="Sütun" className="field h-8 w-[136px] rounded-full py-0 text-[12.5px]" value={t.columnId ?? ""} onChange={(e) => setColumn(t, Number(e.target.value))} data-testid={`select-column-${t.id}`}>
                            {cols.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
