import { useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Bell, CheckSquare, Kanban, LayoutDashboard, LogOut, Menu, Plus, Settings, Users } from "lucide-react";
import { useGetNotifications, getGetNotificationsQueryKey, useLogout, getGetSessionQueryKey } from "@workspace/api-client-react";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { UserAvatar } from "@/components/bits";
import { NewTaskDialog } from "@/components/new-task-dialog";
import { TaskDetailSheet } from "@/components/task-detail";
import { TaskUiContext, useMe, useWorkspace, type NewTaskDefaults } from "@/lib/app";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Panolar", icon: Kanban },
  { href: "/overview", label: "Genel bakış", icon: LayoutDashboard },
  { href: "/my-tasks", label: "Görevlerim", icon: CheckSquare },
  { href: "/teams", label: "Ekipler", icon: Users },
  { href: "/notifications", label: "Bildirimler", icon: Bell },
  { href: "/settings", label: "Ayarlar", icon: Settings },
];

function useUnread() {
  const { data } = useGetNotifications({ query: { queryKey: getGetNotificationsQueryKey(), refetchInterval: 30000 } });
  return (data ?? []).filter((n) => !n.read).length;
}

function NavBody({ onNavigate }: { onNavigate?: () => void }) {
  const [loc] = useLocation();
  const me = useMe();
  const unread = useUnread();
  const { data: ws } = useWorkspace();
  const qc = useQueryClient();
  const logout = useLogout();
  const isActive = (href: string) => (href === "/" ? loc === "/" || loc.startsWith("/boards") : loc.startsWith(href));

  return (
    <div className="flex h-full flex-col">
      <div className="px-5 pb-5 pt-6">
        <img src={`${import.meta.env.BASE_URL}logo-navy.png`} alt="Lacivert Teknoloji" className="h-7 w-auto" />
      </div>
      <nav className="space-y-0.5 px-3">
        {NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            onClick={onNavigate}
            data-testid={`link-nav-${n.href.replace("/", "") || "boards"}`}
            className={cn(
              "flex h-9 items-center gap-2.5 rounded-full px-3 text-[14px] font-medium transition-colors",
              isActive(n.href) ? "bg-primary text-primary-foreground" : "text-foreground/75 hover:bg-muted hover:text-foreground",
            )}
          >
            <n.icon className="h-4 w-4" />
            <span className="flex-1">{n.label}</span>
            {n.href === "/notifications" && unread > 0 && (
              <span className={cn("min-w-5 rounded-full px-1.5 text-center text-[11px] font-semibold", isActive(n.href) ? "bg-white/20" : "bg-primary text-primary-foreground")} data-testid="text-unread-count">
                {unread}
              </span>
            )}
          </Link>
        ))}
      </nav>
      <div className="mt-6 px-6">
        <p className="eyebrow mb-2">Panolar</p>
        <div className="space-y-0.5">
          {(ws?.boards ?? []).map((b) => (
            <Link key={b.id} href={`/boards/${b.id}`} onClick={onNavigate} className={cn("block truncate rounded-lg py-1 text-[13px] hover:text-foreground", loc === `/boards/${b.id}` ? "font-semibold text-foreground" : "text-muted-foreground")} data-testid={`link-board-${b.id}`}>
              {b.name}
            </Link>
          ))}
          {ws && ws.boards.length === 0 && <p className="text-[12.5px] text-muted-foreground">Henüz pano yok</p>}
        </div>
      </div>
      <div className="mt-auto border-t border-border p-3">
        <div className="flex items-center gap-2.5 rounded-2xl p-2">
          <UserAvatar user={me} size={32} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13.5px] font-semibold" data-testid="text-current-user">{me.name}</p>
            <p className="truncate text-[12px] text-muted-foreground">{me.role === "admin" ? "Yönetici" : "Üye"} · @{me.username}</p>
          </div>
          <button
            aria-label="Çıkış yap"
            title="Çıkış yap"
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted"
            disabled={logout.isPending}
            onClick={() =>
              logout.mutate(undefined, {
                onSettled: () => {
                  qc.removeQueries({ predicate: (q) => q.queryKey[0] !== getGetSessionQueryKey()[0] });
                  qc.setQueryData(getGetSessionQueryKey(), { user: null, needsSetup: false });
                },
              })
            }
            data-testid="button-logout"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [taskId, setTaskId] = useState<number | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [defaults, setDefaults] = useState<NewTaskDefaults>({});
  const unread = useUnread();

  const ctx = {
    openTask: (id: number) => setTaskId(id),
    newTask: (d?: NewTaskDefaults) => {
      setDefaults(d ?? {});
      setNewOpen(true);
    },
  };

  return (
    <TaskUiContext.Provider value={ctx}>
      <div className="min-h-[100dvh] bg-background">
        <aside className="fixed inset-y-0 left-0 hidden w-[236px] border-r border-border bg-sidebar md:block">
          <NavBody />
        </aside>
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-card/95 px-4 backdrop-blur md:hidden">
          <button aria-label="Menüyü aç" className="flex h-9 w-9 items-center justify-center rounded-full bg-muted" onClick={() => setMobileOpen(true)} data-testid="button-mobile-menu">
            <Menu className="h-4 w-4" />
          </button>
          <img src={`${import.meta.env.BASE_URL}logo-navy.png`} alt="Lacivert Teknoloji" className="h-5 w-auto" />
          <Link href="/notifications" className="relative flex h-9 w-9 items-center justify-center rounded-full bg-muted" aria-label="Bildirimler">
            <Bell className="h-4 w-4" />
            {unread > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary" />}
          </Link>
        </header>
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="w-[270px] p-0">
            <SheetTitle className="sr-only">Gezinme</SheetTitle>
            <SheetDescription className="sr-only">Uygulama bölümleri</SheetDescription>
            <NavBody onNavigate={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>
        <main className="md:pl-[236px]">{children}</main>
        <button
          className="pill pill-primary fixed bottom-5 right-5 z-20 h-12 px-5 md:hidden"
          onClick={() => ctx.newTask()}
          data-testid="button-fab-new-task"
        >
          <Plus className="h-4 w-4" />Görev
        </button>
      </div>
      <NewTaskDialog open={newOpen} onOpenChange={setNewOpen} defaults={defaults} />
      <TaskDetailSheet taskId={taskId} onClose={() => setTaskId(null)} />
    </TaskUiContext.Provider>
  );
}
