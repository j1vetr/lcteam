import { useState } from "react";
import { CalendarClock, CheckSquare, Plus } from "lucide-react";
import { useUpdateTask, type Task, type Workspace } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { EmptyState, ErrorState, PageHeader, PriorityTag, Segmented } from "@/components/bits";
import { dueState, errMsg, fmtDate, isAssignedToMe, STATUS, STATUS_ORDER, useInvalidateAll, useMe, useTaskUi, useWorkspace } from "@/lib/app";
import { cn } from "@/lib/utils";
import { PersonalBoard } from "@/components/personal-board";
import { matchesTaskMonth, TaskMonthFilter } from "@/components/task-month-filter";
import { TaskCalendar } from "@/components/task-calendar";
import { istanbulToday } from "@/lib/task-calendar";

type Tab = "personal" | "assigned";

export default function MyTasksPage() {
  const me = useMe();
  const { data: ws, isLoading, isError, refetch } = useWorkspace();
  const { newTask } = useTaskUi();
  const [tab, setTab] = useState<Tab>("personal");
  const [hideDone, setHideDone] = useState(false);
  const [month, setMonth] = useState("");
  const [view, setView] = useState<"board" | "calendar">("board");
  const [calendarMonth, setCalendarMonth] = useState(() => istanbulToday().slice(0, 7));

  const all = ws?.tasks ?? [];
  const personal = all.filter((t) => t.boardId === null && t.creatorId === me.id);
  const assigned = all.filter((t) => t.boardId !== null && isAssignedToMe(t, me, ws));
  const base = tab === "personal" ? personal : assigned;
  const filtered = base.filter((t) => !hideDone || t.status !== "done");
  const shown = filtered.filter((t) => matchesTaskMonth(t, month));

  return (
    <div className={cn("mx-auto px-4 py-6 md:px-8 md:py-8", tab === "personal" && view === "board" ? "max-w-[1280px]" : "max-w-[1100px]")}>
      <PageHeader
        title="Kişisel Pano"
        sub={tab === "personal" ? "Yalnızca sizin gördüğünüz özel görevler." : "Şirket panolarında size atanan görevler."}
        actions={<button className="pill pill-primary" onClick={() => newTask()} data-testid="button-new-personal"><Plus className="h-4 w-4" />Kişisel görev</button>}
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Segmented value={tab} onChange={setTab} options={[{ value: "personal", label: `Kişisel Pano ${personal.length}` }, { value: "assigned", label: `Atanan Görevler ${assigned.length}` }]} />
        <Segmented value={view} onChange={(next) => {
          if (next === "calendar" && month && month !== "undated") setCalendarMonth(month);
          setView(next);
        }} options={[{ value: "board", label: tab === "personal" ? "Pano" : "Liste" }, { value: "calendar", label: "Takvim" }]} />
        {view === "board" && <TaskMonthFilter value={month} onChange={setMonth} />}
        <button className={cn("pill pill-sm ml-auto", hideDone ? "pill-primary" : "pill-soft")} onClick={() => setHideDone(!hideDone)} aria-pressed={hideDone} data-testid="button-hide-done">Tamamlananları gizle</button>
      </div>
      {view === "board" && month && <p className="mb-4 px-1 text-xs text-muted-foreground">Ay filtresi bitiş tarihini esas alır. Tarihsiz yeni görevler için “Tüm tarihler” veya “Tarihsiz” seçin.</p>}

      {isLoading ? (
        <div className="flex gap-3 overflow-hidden">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[360px] w-[280px] shrink-0 rounded-3xl" />)}</div>
      ) : isError || !ws ? (
        <ErrorState onRetry={() => refetch()} />
      ) : view === "calendar" ? (
        <TaskCalendar tasks={filtered} ws={ws} month={calendarMonth} onMonthChange={setCalendarMonth} />
      ) : tab === "personal" ? (
        <PersonalBoard ws={ws} tasks={personal} visible={(t) => shown.includes(t)} />
      ) : (
        <AssignedList ws={ws} tasks={shown} hasAny={assigned.length > 0} />
      )}
    </div>
  );
}

function AssignedList({ ws, tasks, hasAny }: { ws: Workspace; tasks: Task[]; hasAny: boolean }) {
  const update = useUpdateTask();
  const invalidate = useInvalidateAll();
  const { toast } = useToast();
  const { openTask } = useTaskUi();
  const setColumn = (t: Task, columnId: number) =>
    update.mutate({ id: t.id, data: { columnId, position: 0 } }, { onSuccess: () => invalidate(), onError: (e) => toast({ title: "Sütun değiştirilemedi", description: errMsg(e), variant: "destructive" }) });

  if (tasks.length === 0)
    return <EmptyState icon={<CheckSquare className="h-5 w-5" />} title={hasAny ? "Bu filtrede görev yok." : "Size atanmış görev yok."} text="Şirket panolarında size bir görev atandığında burada görünür." />;

  return (
    <div className="space-y-6">
      {STATUS_ORDER.map((s) => {
        const group = tasks.filter((t) => t.status === s).sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"));
        if (!group.length) return null;
        return (
          <section key={s}>
            <h2 className="mb-2 flex items-center gap-2 px-1 text-[13px] font-semibold">{STATUS[s]}<span className="eyebrow">{group.length}</span></h2>
            <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
              {group.map((t) => {
                const board = ws.boards.find((b) => b.id === t.boardId);
                const cols = ws.columns.filter((c) => c.boardId === t.boardId).sort((a, b) => a.position - b.position);
                const due = dueState(t);
                return (
                  <li key={t.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2.5 hover:bg-muted/40" data-testid={`row-task-${t.id}`}>
                    <button className="min-w-0 flex-1 text-left" onClick={() => openTask(t.id)} data-testid={`button-open-task-${t.id}`}>
                      <span className={cn("block truncate text-[14px] font-medium", t.status === "done" && "text-muted-foreground line-through")}>{t.title}</span>
                      <span className="text-[12px] text-muted-foreground">{board?.name}{t.labels.length > 0 && <> · {t.labels.slice(0, 2).join(", ")}</>}</span>
                    </button>
                    <PriorityTag p={t.priority} />
                    <span className={cn("inline-flex w-16 items-center gap-1 font-mono text-[12px]", due === "overdue" ? "text-destructive" : due === "soon" ? "text-amber-700" : "text-muted-foreground")}>
                      {t.dueDate && <><CalendarClock className="h-3 w-3" />{fmtDate(t.dueDate)}</>}
                    </span>
                    <select aria-label="Sütun" className="field h-8 w-[136px] rounded-full py-0 text-[12.5px]" value={t.columnId ?? ""} onChange={(e) => setColumn(t, Number(e.target.value))} data-testid={`select-column-${t.id}`}>
                      {cols.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
