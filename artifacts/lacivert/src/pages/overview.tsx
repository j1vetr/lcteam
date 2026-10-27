import { Activity as ActivityIcon, Plus } from "lucide-react";
import { useGetDashboard, getGetDashboardQueryKey, useGetActivity, getGetActivityQueryKey } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState, PageHeader, PriorityTag, UserAvatar } from "@/components/bits";
import { dueState, fmtDate, relTime, useMe, useTaskUi, useWorkspace, isTaskDone } from "@/lib/app";
import { cn } from "@/lib/utils";

export default function OverviewPage() {
  const me = useMe();
  const dash = useGetDashboard({ query: { queryKey: getGetDashboardQueryKey() } });
  const act = useGetActivity({ query: { queryKey: getGetActivityQueryKey() } });
  const { data: ws } = useWorkspace();
  const { openTask, newTask } = useTaskUi();
  const d = dash.data;

  const urgent = (ws?.tasks ?? [])
    .filter((t) => t.assigneeIds.includes(me.id) && !isTaskDone(t, ws) && (dueState(t) === "overdue" || dueState(t) === "soon" || t.priority === "urgent"))
    .slice(0, 6);

  const stats = d
    ? [
        { k: "Açık", v: d.open, s: `${d.total} görevden` },
        { k: "Tamamlanan", v: d.completed, s: d.total ? `%${Math.round((d.completed / d.total) * 100)} oran` : "Henüz görev yok" },
        { k: "Geciken", v: d.overdue, s: "Bitiş tarihi geçti", warn: d.overdue > 0 },
        { k: "Yaklaşan", v: d.dueSoon, s: "Önümüzdeki günlerde" },
        { k: "Bana atanan", v: d.mine, s: "Açık görevlerim" },
      ]
    : [];

  return (
    <div className="mx-auto max-w-[1180px] px-4 py-6 md:px-8 md:py-8">
      <PageHeader title="Genel Bakış" sub="Görev durumu ve ekip özeti." actions={<button className="pill pill-primary" onClick={() => newTask()} data-testid="button-overview-new"><Plus className="h-4 w-4" />Yeni Görev</button>} />

      {dash.isError ? (
        <ErrorState onRetry={() => dash.refetch()} />
      ) : (
        <div className="grid grid-cols-2 overflow-hidden rounded-3xl border border-border bg-card sm:grid-cols-3 lg:grid-cols-5">
          {dash.isLoading
            ? [0, 1, 2, 3, 4].map((i) => <div key={i} className="border-border p-5 [&:not(:last-child)]:border-r"><Skeleton className="h-4 w-20 rounded-full" /><Skeleton className="mt-3 h-9 w-14 rounded-xl" /></div>)
            : stats.map((s) => (
                <div key={s.k} className="border-b border-r border-border p-5 lg:border-b-0 lg:last:border-r-0" data-testid={`stat-${s.k}`}>
                  <p className="text-[12.5px] font-medium text-muted-foreground">{s.k}</p>
                  <p className={cn("heading mt-2 font-mono text-[34px]", s.warn && "text-destructive")}>{s.v}</p>
                  <p className="mt-1 text-[12px] text-muted-foreground">{s.s}</p>
                </div>
              ))}
        </div>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-6">
          <section className="rounded-3xl border border-border bg-card">
            <header className="flex items-center justify-between border-b border-border px-5 py-3.5">
              <h2 className="text-[14px] font-semibold">Dikkat isteyenler</h2>
              <span className="eyebrow">{urgent.length}</span>
            </header>
            {urgent.length === 0 ? (
              <p className="px-5 py-8 text-center text-[13.5px] text-muted-foreground">Geciken ya da acil göreviniz yok. Güzel gidiyor.</p>
            ) : (
              <ul className="divide-y divide-border">
                {urgent.map((t) => (
                  <li key={t.id}>
                    <button className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-muted/50" onClick={() => openTask(t.id)} data-testid={`row-urgent-${t.id}`}>
                      <span className="min-w-0 flex-1 truncate text-[14px] font-medium">{t.title}</span>
                      <PriorityTag p={t.priority} />
                      {t.dueDate && <span className={cn("w-14 text-right font-mono text-[12px]", dueState(t) === "overdue" ? "text-destructive" : "text-muted-foreground")}>{fmtDate(t.dueDate)}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-3xl border border-border bg-card">
            <header className="border-b border-border px-5 py-3.5"><h2 className="text-[14px] font-semibold">Ekipler</h2></header>
            {dash.isLoading ? (
              <div className="space-y-2 p-5">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-8 rounded-xl" />)}</div>
            ) : !d || d.teams.length === 0 ? (
              <p className="px-5 py-8 text-center text-[13.5px] text-muted-foreground">Henüz ekip görevi yok.</p>
            ) : (
              <table className="w-full text-[13.5px]">
                <thead>
                  <tr className="text-left text-[11.5px] text-muted-foreground">
                    <th className="px-5 py-2 font-medium">Ekip</th>
                    <th className="px-2 py-2 text-right font-medium">Toplam</th>
                    <th className="px-2 py-2 text-right font-medium">Biten</th>
                    <th className="px-5 py-2 text-right font-medium">Geciken</th>
                  </tr>
                </thead>
                <tbody>
                  {d.teams.map((t) => {
                    const team = ws?.teams.find((x) => x.id === t.teamId);
                    const pct = t.total ? t.completed / t.total : 0;
                    return (
                      <tr key={t.teamId} className="border-t border-border" data-testid={`row-team-${t.teamId}`}>
                        <td className="px-5 py-2.5">
                          <p className="font-medium">{team?.name ?? "Ekip"}</p>
                          <div className="mt-1.5 h-1 w-full max-w-[160px] overflow-hidden rounded-full bg-muted"><div className="h-full origin-left bg-primary" style={{ transform: `scaleX(${pct})` }} /></div>
                        </td>
                        <td className="px-2 text-right font-mono">{t.total}</td>
                        <td className="px-2 text-right font-mono">{t.completed}</td>
                        <td className={cn("px-5 text-right font-mono", t.overdue > 0 && "text-destructive")}>{t.overdue}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </section>
        </div>

        <section className="rounded-3xl border border-border bg-card">
          <header className="border-b border-border px-5 py-3.5"><h2 className="text-[14px] font-semibold">Son hareketler</h2></header>
          {act.isLoading ? (
            <div className="space-y-3 p-5">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-10 rounded-xl" />)}</div>
          ) : act.isError ? (
            <div className="p-4"><ErrorState onRetry={() => act.refetch()} /></div>
          ) : !act.data?.length ? (
            <div className="p-4"><EmptyState icon={<ActivityIcon className="h-5 w-5" />} title="Henüz İşlem Yok" text="Görev değişiklikleri burada listelenir." /></div>
          ) : (
            <ul className="divide-y divide-border">
              {act.data.slice(0, 30).map((a) => {
                const u = ws?.users.find((x) => x.id === a.userId);
                const t = ws?.tasks.find((x) => x.id === a.taskId);
                return (
                  <li key={a.id}>
                    <button className="flex w-full gap-3 px-5 py-3 text-left hover:bg-muted/50" onClick={() => openTask(a.taskId)} data-testid={`row-activity-${a.id}`}>
                      <UserAvatar user={u} size={26} />
                      <span className="min-w-0 flex-1 text-[13px]">
                        <span className="font-semibold">{u?.name ?? "Sistem"}</span> {a.message}
                        {t && <span className="block truncate text-[12px] text-muted-foreground">{t.title}</span>}
                      </span>
                      <span className="shrink-0 text-[11.5px] text-muted-foreground">{relTime(a.createdAt)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
