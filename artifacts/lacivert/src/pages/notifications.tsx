import { Bell, CheckCheck } from "lucide-react";
import { useGetNotifications, getGetNotificationsQueryKey, useReadNotifications } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { EmptyState, ErrorState, PageHeader } from "@/components/bits";
import { errMsg, fmtDateLong, relTime, useInvalidateAll, useTaskUi } from "@/lib/app";
import { cn } from "@/lib/utils";

export default function NotificationsPage() {
  const { data, isLoading, isError, refetch } = useGetNotifications({ query: { queryKey: getGetNotificationsQueryKey(), refetchInterval: 30000 } });
  const read = useReadNotifications();
  const invalidate = useInvalidateAll();
  const { toast } = useToast();
  const { openTask } = useTaskUi();
  const unread = (data ?? []).filter((n) => !n.read).length;

  return (
    <div className="mx-auto max-w-[820px] px-4 py-6 md:px-8 md:py-8">
      <PageHeader
        title="Bildirimler."
        sub={unread ? `${unread} okunmamış bildirim` : "Hepsini okudunuz."}
        actions={
          <button
            className="pill pill-outline"
            disabled={!unread || read.isPending}
            onClick={() => read.mutate(undefined, { onSuccess: () => invalidate(), onError: (e) => toast({ title: "İşaretlenemedi", description: errMsg(e), variant: "destructive" }) })}
            data-testid="button-read-all"
          >
            <CheckCheck className="h-4 w-4" />Tümünü okundu işaretle
          </button>
        }
      />
      {isLoading ? (
        <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}</div>
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : !data?.length ? (
        <EmptyState icon={<Bell className="h-5 w-5" />} title="Bildirim yok." text="Size görev atandığında, yorum yapıldığında ya da görevleriniz değiştiğinde burada görürsünüz." />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-3xl border border-border bg-card">
          {data.map((n) => (
            <li key={n.id}>
              <button className={cn("flex w-full items-start gap-3 px-5 py-3.5 text-left hover:bg-muted/50", !n.read && "bg-[hsl(222_50%_97%)]")} onClick={() => openTask(n.taskId)} data-testid={`row-notification-${n.id}`}>
                <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-primary")} />
                <span className={cn("flex-1 text-[14px]", !n.read && "font-semibold")}>{n.message}</span>
                <span className="shrink-0 text-[12px] text-muted-foreground" title={fmtDateLong(n.createdAt)}>{relTime(n.createdAt)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
