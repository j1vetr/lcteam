import { useMemo } from "react";
import { CalendarDays, CalendarOff, ChevronLeft, ChevronRight, MessageSquare } from "lucide-react";
import type { Task, Workspace } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import { STATUS, PRIORITY, PRIORITY_ORDER, isTaskDone, useTaskUi } from "@/lib/app";
import { AvatarStack, PriorityTag } from "@/components/bits";
import { istanbulToday, calendarDays, shiftMonth, calendarMonthLabel, calendarDayLabel } from "@/lib/task-calendar";

const WEEKDAYS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

function sortTasks(a: Task, b: Task) {
  const p = PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority);
  return p !== 0 ? p : a.title.localeCompare(b.title, "tr");
}

function boardName(t: Task, ws: Workspace) {
  if (t.boardId == null) return "Kişisel";
  return ws.boards.find((b) => b.id === t.boardId)?.name ?? "Pano";
}

function columnName(t: Task, ws: Workspace) {
  if (t.columnId != null) {
    const c = ws.columns.find((c) => c.id === t.columnId);
    if (c) return c.name;
  }
  return STATUS[t.status];
}

function CalendarCard({ task, ws, compact, overdue }: { task: Task; ws: Workspace; compact?: boolean; overdue?: boolean }) {
  const { openTask } = useTaskUi();
  const done = isTaskDone(task, ws);
  const users = ws.users.filter((u) => task.assigneeIds.includes(u.id));
  const pr = PRIORITY[task.priority];
  return (
    <button
      type="button"
      onClick={() => openTask(task.id)}
      data-testid={`card-calendar-task-${task.id}`}
      aria-label={`${task.title}, ${PRIORITY[task.priority].label} öncelik, ${columnName(task, ws)}, ${boardName(task, ws)}`}
      className={cn(
        "group w-full min-w-0 rounded-lg border border-border bg-card text-left transition-[transform,box-shadow,border-color] duration-150",
        "hover:-translate-y-px hover:border-primary/30 hover:shadow-[0_4px_12px_-6px_rgba(15,23,42,0.25)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1",
        compact ? "px-2 py-1.5" : "px-3 py-2.5",
        done && "opacity-60",
      )}
    >
      <span className="flex min-w-0 items-start gap-1.5">
        <span className={cn("mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full", pr.dot)} aria-hidden />
        <span
          className={cn(
            "min-w-0 flex-1 font-medium leading-snug text-foreground",
            compact ? "line-clamp-2 text-[12px]" : "text-[14px]",
            done && "line-through decoration-foreground/30",
          )}
        >
          {task.title}
        </span>
      </span>
      {compact ? (
        <span className="mt-0.5 block truncate pl-3 text-[10.5px] text-muted-foreground">
          {boardName(task, ws)}
          {overdue && <span className="font-semibold text-destructive"> · Gecikmiş</span>}
        </span>
      ) : (
        <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 pl-3">
          <PriorityTag p={task.priority} />
          <span className="text-[11.5px] text-muted-foreground">{columnName(task, ws)}</span>
          <span className="truncate text-[11.5px] text-muted-foreground">{boardName(task, ws)}</span>
          {overdue && <span className="text-[11.5px] font-semibold text-destructive">Gecikmiş</span>}
          {task.commentCount > 0 && (
            <span className="inline-flex items-center gap-1 text-[11.5px] text-muted-foreground">
              <MessageSquare className="h-3 w-3" />
              {task.commentCount}
            </span>
          )}
          {users.length > 0 && <span className="ml-auto"><AvatarStack users={users} size={20} /></span>}
        </span>
      )}
    </button>
  );
}

export function TaskCalendar({ tasks, ws, month, onMonthChange }: { tasks: Task[]; ws: Workspace; month: string; onMonthChange: (month: string) => void }) {
  const today = istanbulToday();
  const todayMonth = today.slice(0, 7);
  const days = useMemo(() => calendarDays(month), [month]);

  const { byDay, undated } = useMemo(() => {
    const byDay = new Map<string, Task[]>();
    const undated: Task[] = [];
    for (const t of tasks) {
      if (!t.dueDate) {
        undated.push(t);
        continue;
      }
      const k = t.dueDate.slice(0, 10);
      const arr = byDay.get(k);
      if (arr) arr.push(t);
      else byDay.set(k, [t]);
    }
    byDay.forEach((arr) => arr.sort(sortTasks));
    undated.sort(sortTasks);
    return { byDay, undated };
  }, [tasks]);

  const monthDays = days.filter((d): d is string => d !== null);
  const monthCount = monthDays.reduce((n, d) => n + (byDay.get(d)?.length ?? 0), 0);
  const activeDays = monthDays.filter((d) => byDay.has(d));
  const isOverdue = (t: Task, d: string) => d < today && !isTaskDone(t, ws);

  return (
    <div className="min-w-0 space-y-5" data-testid="task-calendar">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow">Aylık takvim</p>
          <h2 className="heading mt-1 text-[22px]" aria-live="polite" data-testid="text-calendar-month">{calendarMonthLabel(month)}</h2>
          <p className="mt-1 text-[13px] text-muted-foreground" data-testid="text-calendar-count">
            Bu ay {monthCount} görev, {activeDays.length} günde
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Görevler bitiş gününe göre gösterilir. Bugün, İstanbul saatine göredir.</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            className="pill pill-outline pill-sm w-8 justify-center px-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            onClick={() => onMonthChange(shiftMonth(month, -1))}
            aria-label="Önceki ay"
            data-testid="button-calendar-prev"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            className={cn("pill pill-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary", month === todayMonth ? "pill-primary" : "pill-outline")}
            onClick={() => onMonthChange(todayMonth)}
            data-testid="button-calendar-today"
          >
            Bugün
          </button>
          <button
            type="button"
            className="pill pill-outline pill-sm w-8 justify-center px-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            onClick={() => onMonthChange(shiftMonth(month, 1))}
            aria-label="Sonraki ay"
            data-testid="button-calendar-next"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Desktop grid */}
      <div className="hidden overflow-hidden rounded-2xl border border-border bg-card md:block">
        <div className="grid grid-cols-7 border-b border-border bg-muted/60">
          {WEEKDAYS.map((w, i) => (
            <div key={w} className={cn("px-2.5 py-2 text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground", i >= 5 && "text-muted-foreground/70")}>
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((d, i) => {
            const list = d ? byDay.get(d) ?? [] : [];
            const isToday = d === today;
            return (
              <div
                key={d ?? `pad-${i}`}
                className={cn(
                  "min-h-[124px] min-w-0 border-b border-r border-border p-1.5",
                  i % 7 === 6 && "border-r-0",
                  !d && "bg-muted/40",
                  i % 7 >= 5 && d && "bg-muted/20",
                  isToday && "bg-[hsl(222_62%_20%/0.04)]",
                )}
                data-testid={d ? `cell-calendar-${d}` : undefined}
              >
                {d && (
                  <>
                    <div className="mb-1 flex items-center justify-between px-1">
                      <span
                        className={cn(
                          "inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[12.5px] font-semibold tabular-nums",
                          isToday ? "bg-primary text-primary-foreground" : "text-foreground/80",
                        )}
                        aria-label={isToday ? `${calendarDayLabel(d)}, bugün` : calendarDayLabel(d)}
                      >
                        {Number(d.slice(8, 10))}
                      </span>
                      {list.length > 0 && <span className="font-mono text-[10.5px] text-muted-foreground">{list.length}</span>}
                    </div>
                    <div className="max-h-[188px] space-y-1 overflow-y-auto pr-0.5">
                      {list.map((t) => (
                        <CalendarCard key={t.id} task={t} ws={ws} compact overdue={isOverdue(t, d)} />
                      ))}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Mobile agenda */}
      <div className="space-y-4 md:hidden">
        {activeDays.map((d) => {
          const list = byDay.get(d)!;
          const isToday = d === today;
          return (
            <section key={d} data-testid={`agenda-calendar-${d}`}>
              <div className="mb-2 flex items-center gap-2">
                <span className={cn("text-[13.5px] font-semibold", isToday ? "text-primary" : "text-foreground")}>{calendarDayLabel(d)}</span>
                {isToday && <span className="rounded-full bg-primary px-2 py-0.5 text-[10.5px] font-semibold text-primary-foreground">Bugün</span>}
                <span className="ml-auto font-mono text-[11px] text-muted-foreground">{list.length} görev</span>
              </div>
              <div className="space-y-2">
                {list.map((t) => (
                  <CalendarCard key={t.id} task={t} ws={ws} overdue={isOverdue(t, d)} />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {monthCount === 0 && (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-card px-6 py-8 text-center" data-testid="empty-calendar-month">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-[30%] bg-muted text-primary">
            <CalendarDays className="h-5 w-5" />
          </div>
          <h3 className="heading text-[16px]">{calendarMonthLabel(month)} için teslim tarihi yok</h3>
          <p className="mt-1 max-w-sm text-[13.5px] text-muted-foreground">
            Bu ayda bitiş tarihi olan görev bulunmuyor. Diğer aylara geçebilir ya da bir göreve tarih ekleyebilirsiniz.
          </p>
        </div>
      )}

      <section className="rounded-2xl border border-border bg-card p-4" data-testid="section-calendar-undated">
        <div className="mb-3 flex items-center gap-2">
          <CalendarOff className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-[14px] font-semibold">Tarihsiz görevler</h3>
          <span className="ml-auto font-mono text-[11px] text-muted-foreground" data-testid="text-undated-count">{undated.length} görev</span>
        </div>
        {undated.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">Tüm görevlerin bir bitiş tarihi var.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {undated.map((t) => (
              <CalendarCard key={t.id} task={t} ws={ws} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
