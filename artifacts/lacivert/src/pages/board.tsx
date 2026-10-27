import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, CalendarClock, Kanban, ListChecks, Loader2, MessageSquare, MoreHorizontal, Pencil, Plus, Search, Trash2 } from "lucide-react";
import {
  useCreateBoard,
  useUpdateBoard,
  useDeleteBoard,
  useCreateColumn,
  useUpdateColumn,
  useDeleteColumn,
  useUpdateTask,
  getGetWorkspaceQueryKey,
  type Board,
  type Column,
  type Task,
  type Workspace,
} from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { AvatarStack, ChipPicker, EmptyState, ErrorState, Field, PriorityTag, Segmented, UserAvatar } from "@/components/bits";
import { dueState, errMsg, fmtDate, isAssignedToMe, useInvalidateAll, useMe, useTaskUi, useWorkspace } from "@/lib/app";
import { cn } from "@/lib/utils";
import { QuickTask } from "@/components/quick-task";
import { matchesTaskMonth, TaskMonthFilter } from "@/components/task-month-filter";
import { TaskCalendar } from "@/components/task-calendar";
import { istanbulToday } from "@/lib/task-calendar";

export default function BoardPage() {
  const params = useParams<{ id?: string }>();
  const [, navigate] = useLocation();
  const me = useMe();
  const isAdmin = me.role === "admin";
  const { data: ws, isLoading, isError, refetch } = useWorkspace();
  const { newTask } = useTaskUi();
  const [query, setQuery] = useState("");
  const [mineOnly, setMineOnly] = useState(false);
  const [month, setMonth] = useState("");
  const [view, setView] = useState<"board" | "calendar">("board");
  const [calendarMonth, setCalendarMonth] = useState(() => istanbulToday().slice(0, 7));
  const [boardDialog, setBoardDialog] = useState<{ open: boolean; board: Board | null }>({ open: false, board: null });
  const [columnDialog, setColumnDialog] = useState<{ open: boolean; column: Column | null }>({ open: false, column: null });
  const [confirmBoard, setConfirmBoard] = useState(false);
  const delBoard = useDeleteBoard();
  const invalidate = useInvalidateAll();
  const { toast } = useToast();

  const board = useMemo(() => {
    if (!ws) return undefined;
    if (params.id) return ws.boards.find((b) => b.id === Number(params.id));
    return ws.boards[0];
  }, [ws, params.id]);

  if (isLoading)
    return (
      <div className="p-6">
        <Skeleton className="mb-6 h-8 w-64 rounded-full" />
        <div className="flex gap-3">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[420px] w-[280px] shrink-0 rounded-3xl" />)}
        </div>
      </div>
    );
  if (isError || !ws) return <div className="p-6"><ErrorState onRetry={() => refetch()} /></div>;

  const boardTasks = board ? ws.tasks.filter((t) => t.boardId === board.id) : [];
  const q = query.trim().toLocaleLowerCase("tr-TR");
  const calendarTasks = boardTasks.filter((t) =>
    (!q || t.title.toLocaleLowerCase("tr-TR").includes(q) || t.labels.some((l) => l.toLocaleLowerCase("tr-TR").includes(q))) &&
    (!mineOnly || isAssignedToMe(t, me, ws)),
  );

  return (
    <div className="flex min-h-[calc(100dvh-56px)] flex-col md:min-h-[100dvh]">
      <div className="border-b border-border bg-card px-4 pb-3 pt-5 md:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="eyebrow mb-1">Pano</p>
            <h1 className="heading truncate text-[24px]" data-testid="text-board-name">{board?.name ?? "Panolar"}</h1>
            {board?.description && <p className="mt-1 max-w-2xl text-[13.5px] text-muted-foreground">{board.description}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {board && <AvatarStack users={ws.users.filter((u) => board.memberIds.includes(u.id) || ws.teams.some((t) => board.teamIds.includes(t.id) && t.memberIds.includes(u.id)))} max={5} size={26} />}
            {isAdmin && (
              <button className="pill pill-outline" onClick={() => setBoardDialog({ open: true, board: null })} data-testid="button-new-board">
                <Plus className="h-4 w-4" />Pano
              </button>
            )}
            {board && isAdmin && (
              <DropdownMenu>
                <DropdownMenuTrigger className="pill pill-outline px-2.5" aria-label="Pano seçenekleri" data-testid="button-board-menu">
                  <MoreHorizontal className="h-4 w-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="rounded-2xl">
                  <DropdownMenuItem onClick={() => setBoardDialog({ open: true, board })}><Pencil className="mr-2 h-4 w-4" />Panoyu düzenle</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setColumnDialog({ open: true, column: null })}><Plus className="mr-2 h-4 w-4" />Sütun ekle</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive" onClick={() => setConfirmBoard(true)}><Trash2 className="mr-2 h-4 w-4" />Panoyu sil</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {board && (isAdmin) && (
              <button className="pill pill-primary hidden md:inline-flex" onClick={() => newTask({ boardId: board.id })} data-testid="button-new-task">
                <Plus className="h-4 w-4" />Yeni görev
              </button>
            )}
            {!isAdmin && (
              <button className="pill pill-primary hidden md:inline-flex" onClick={() => newTask()} data-testid="button-new-task">
                <Plus className="h-4 w-4" />Kişisel görev
              </button>
            )}
          </div>
        </div>
        {ws.boards.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <div className="scroll-x flex max-w-full gap-1 overflow-x-auto rounded-full bg-muted p-1">
              {ws.boards.map((b) => (
                <Link
                  key={b.id}
                  href={`/boards/${b.id}`}
                  className={cn("h-7 shrink-0 rounded-full px-3 text-[12.5px] font-semibold leading-7 transition-colors", b.id === board?.id ? "bg-card text-foreground shadow-[0_1px_2px_rgba(15,23,42,0.08)]" : "text-muted-foreground hover:text-foreground")}
                  data-testid={`tab-board-${b.id}`}
                >
                  {b.name}
                </Link>
              ))}
            </div>
            <div className="relative ml-auto">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <input className="field h-9 w-48 rounded-full py-0 pl-8 text-[13px]" placeholder="Görev ara" value={query} onChange={(e) => setQuery(e.target.value)} data-testid="input-board-search" />
            </div>
            <button className={cn("pill pill-sm h-9", mineOnly ? "pill-primary" : "pill-soft")} onClick={() => setMineOnly(!mineOnly)} aria-pressed={mineOnly} data-testid="button-filter-mine">
              Bana atananlar
            </button>
            <Segmented value={view} onChange={(next) => {
              if (next === "calendar" && month && month !== "undated") setCalendarMonth(month);
              setView(next);
            }} options={[{ value: "board", label: "Pano" }, { value: "calendar", label: "Takvim" }]} />
            {view === "board" && <TaskMonthFilter value={month} onChange={setMonth} />}
          </div>
        )}
        {view === "board" && month && <p className="mt-2 text-xs text-muted-foreground">Filtre bitiş tarihine göredir. Tarihsiz yeni görevleri görmek için “Tüm tarihler” veya “Tarihsiz” seçin.</p>}
      </div>

      {!board ? (
        <div className="p-6">
          {params.id ? (
            <EmptyState icon={<Kanban className="h-5 w-5" />} title="Pano bulunamadı." text="Silinmiş olabilir ya da bu panoya erişiminiz yok." action={<button className="pill pill-outline" onClick={() => navigate("/")}>Panolara dön</button>} />
          ) : isAdmin ? (
            <EmptyState icon={<Kanban className="h-5 w-5" />} title="Henüz pano yok." text="İlk panoyu oluşturun, ekipleri ve kişileri ekleyin, sütunları kendi akışınıza göre düzenleyin." action={<button className="pill pill-primary" onClick={() => setBoardDialog({ open: true, board: null })}><Plus className="h-4 w-4" />Pano oluştur</button>} />
          ) : (
            <EmptyState icon={<Kanban className="h-5 w-5" />} title="Henüz bir panoya eklenmediniz." text="Yöneticiniz sizi bir panoya eklediğinde burada görünecek. Bu arada kişisel görevlerinizi takip edebilirsiniz." action={<button className="pill pill-primary" onClick={() => newTask()}><Plus className="h-4 w-4" />Kişisel görev ekle</button>} />
          )}
        </div>
      ) : view === "calendar" ? (
        <div className="min-w-0 p-4 md:p-6">
          <TaskCalendar tasks={calendarTasks} ws={ws} month={calendarMonth} onMonthChange={setCalendarMonth} />
        </div>
      ) : (
        <KanbanBoard key={board.id} ws={ws} board={board} tasks={boardTasks} query={query} mineOnly={mineOnly} month={month} onEditColumn={(c) => setColumnDialog({ open: true, column: c })} onAddColumn={() => setColumnDialog({ open: true, column: null })} />
      )}

      <BoardDialog open={boardDialog.open} board={boardDialog.board} ws={ws} onOpenChange={(v) => setBoardDialog((s) => ({ ...s, open: v }))} onCreated={(b) => navigate(`/boards/${b.id}`)} />
      {board && <ColumnDialog open={columnDialog.open} column={columnDialog.column} board={board} ws={ws} onOpenChange={(v) => setColumnDialog((s) => ({ ...s, open: v }))} />}

      <AlertDialog open={confirmBoard} onOpenChange={setConfirmBoard}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="heading">Pano silinsin mi?</AlertDialogTitle>
            <AlertDialogDescription>
              {boardTasks.length > 0 ? `Bu panoda ${boardTasks.length} görev var. Yalnızca boş panolar silinebilir. Önce görevleri taşıyın ya da silin.` : `"${board?.name}" ve sütunları kalıcı olarak silinecek.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Vazgeç</AlertDialogCancel>
            <AlertDialogAction
              disabled={boardTasks.length > 0 || delBoard.isPending}
              className="rounded-full bg-destructive hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                if (!board) return;
                delBoard.mutate({ id: board.id }, {
                  onSuccess: () => { invalidate(); setConfirmBoard(false); toast({ title: "Pano silindi" }); navigate("/"); },
                  onError: (err) => toast({ title: "Pano silinemedi", description: errMsg(err), variant: "destructive" }),
                });
              }}
              data-testid="button-confirm-delete-board"
            >
              Panoyu sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function KanbanBoard({ ws, board, tasks, query, mineOnly, month, onEditColumn, onAddColumn }: { ws: Workspace; board: Board; tasks: Task[]; query: string; mineOnly: boolean; month: string; onEditColumn: (c: Column) => void; onAddColumn: () => void }) {
  const me = useMe();
  const isAdmin = me.role === "admin";
  const qc = useQueryClient();
  const update = useUpdateTask();
  const delColumn = useDeleteColumn();
  const invalidate = useInvalidateAll();
  const { toast } = useToast();
  const { openTask, newTask } = useTaskUi();
  const dragId = useRef<number | null>(null);
  const [drop, setDrop] = useState<{ col: number; index: number } | null>(null);
  const [confirmCol, setConfirmCol] = useState<Column | null>(null);

  const columns = ws.columns.filter((c) => c.boardId === board.id).sort((a, b) => a.position - b.position);
  const q = query.trim().toLocaleLowerCase("tr-TR");
  const visible = (t: Task) =>
    (!q || t.title.toLocaleLowerCase("tr-TR").includes(q) || t.labels.some((l) => l.toLocaleLowerCase("tr-TR").includes(q))) && (!mineOnly || isAssignedToMe(t, me, ws)) && matchesTaskMonth(t, month);
  const byCol = (cid: number) => tasks.filter((t) => t.columnId === cid).sort((a, b) => a.position - b.position);
  const canMove = (t: Task) => isAdmin || isAssignedToMe(t, me, ws);

  const commitMove = (taskId: number, colId: number, index: number) => {
    const t = tasks.find((x) => x.id === taskId);
    if (!t) return;
    const list = byCol(colId).filter((x) => x.id !== taskId);
    const from = byCol(t.columnId ?? -1).findIndex((x) => x.id === taskId);
    let idx = index;
    if (t.columnId === colId && from > -1 && from < index) idx = index - 1;
    if (t.columnId === colId && from === idx) return;
    list.splice(idx, 0, t);
    qc.setQueryData<Workspace>(getGetWorkspaceQueryKey(), (old) => {
      if (!old) return old;
      const pos = new Map(list.map((x, i) => [x.id, i]));
      return { ...old, tasks: old.tasks.map((x) => (x.id === taskId ? { ...x, columnId: colId, position: idx } : pos.has(x.id) ? { ...x, position: pos.get(x.id)! } : x)) };
    });
    update.mutate(
      { id: taskId, data: { columnId: colId, position: idx } },
      {
        onSettled: () => invalidate(),
        onError: (e) => toast({ title: "Görev taşınamadı", description: errMsg(e), variant: "destructive" }),
      },
    );
  };

  useEffect(() => {
    const end = () => setDrop(null);
    window.addEventListener("dragend", end);
    return () => window.removeEventListener("dragend", end);
  }, []);

  if (columns.length === 0)
    return (
      <div className="p-6">
        <EmptyState icon={<ListChecks className="h-5 w-5" />} title="Bu panoda sütun yok." text={isAdmin ? "Akışınızı tanımlamak için sütun ekleyin. Örneğin Yapılacak, Devam ediyor, Tamamlandı." : "Yönetici sütunları ekleyince görevler burada görünecek."} action={isAdmin ? <button className="pill pill-primary" onClick={onAddColumn}><Plus className="h-4 w-4" />Sütun ekle</button> : undefined} />
      </div>
    );

  return (
    <div className="scroll-x flex flex-1 items-start gap-3 overflow-x-auto px-4 py-4 md:px-6">
      {columns.map((col) => {
        const all = byCol(col.id);
        const list = all.filter(visible);
        return (
          <section
            key={col.id}
            className={cn("flex max-h-[calc(100dvh-200px)] w-[284px] shrink-0 flex-col rounded-3xl bg-muted/70 transition-colors", drop?.col === col.id && "bg-[hsl(222_40%_93%)]")}
            onDragOver={(e) => {
              if (dragId.current === null) return;
              e.preventDefault();
              if ((e.target as HTMLElement).closest("[data-card]")) return;
              setDrop({ col: col.id, index: all.length });
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (dragId.current !== null && drop) commitMove(dragId.current, drop.col, drop.index);
              dragId.current = null;
              setDrop(null);
            }}
            data-testid={`column-${col.id}`}
          >
            <header className="flex items-center gap-2 px-4 pb-2 pt-3.5">
              {col.isDone && <CheckCircle2 className="h-3.5 w-3.5 text-primary" aria-label="Tamamlanma sütunu" />}
              <h2 className="flex-1 truncate text-[13.5px] font-semibold">{col.name}</h2>
              <span className="eyebrow">{list.length === all.length ? all.length : `${list.length}/${all.length}`}</span>
              {(isAdmin) && (
                <button className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-card" onClick={() => newTask({ boardId: board.id, columnId: col.id })} aria-label={`${col.name} sütununa görev ekle`} data-testid={`button-add-task-${col.id}`}>
                  <Plus className="h-3.5 w-3.5" />
                </button>
              )}
              {isAdmin && (
                <DropdownMenu>
                  <DropdownMenuTrigger className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-card" aria-label="Sütun seçenekleri" data-testid={`button-column-menu-${col.id}`}>
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="rounded-2xl">
                    <DropdownMenuItem onClick={() => onEditColumn(col)}><Pencil className="mr-2 h-4 w-4" />Sütunu düzenle</DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive" onClick={() => setConfirmCol(col)}><Trash2 className="mr-2 h-4 w-4" />Sütunu sil</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </header>
            <div className="flex-1 space-y-2 overflow-y-auto px-2.5 pb-2.5">
              {list.map((t) => {
                const idx = all.findIndex((x) => x.id === t.id);
                return (
                  <div key={t.id}>
                    {drop?.col === col.id && drop.index === idx && <div className="mb-2 h-1 rounded-full bg-primary" />}
                    <TaskCard
                      task={t}
                      ws={ws}
                      draggable={canMove(t)}
                      onOpen={() => openTask(t.id)}
                      onDragStart={() => (dragId.current = t.id)}
                      onDragOver={(e) => {
                        if (dragId.current === null) return;
                        e.preventDefault();
                        const r = e.currentTarget.getBoundingClientRect();
                        setDrop({ col: col.id, index: e.clientY < r.top + r.height / 2 ? idx : idx + 1 });
                      }}
                    />
                  </div>
                );
              })}
              {drop?.col === col.id && drop.index >= all.length && <div className="h-1 rounded-full bg-primary" />}
              {list.length === 0 && (
                <div className="rounded-2xl border border-dashed border-border px-3 py-6 text-center text-[12.5px] text-muted-foreground">
                  {all.length ? "Filtreye uyan görev yok" : "Görevleri buraya sürükleyin"}
                </div>
              )}
              {isAdmin && <QuickTask boardId={board.id} columnId={col.id} />}
            </div>
          </section>
        );
      })}
      {isAdmin && (
        <button onClick={onAddColumn} className="flex h-12 w-[240px] shrink-0 items-center justify-center gap-2 rounded-3xl border border-dashed border-border text-[13px] font-semibold text-muted-foreground hover:bg-card hover:text-foreground" data-testid="button-add-column">
          <Plus className="h-4 w-4" />Sütun ekle
        </button>
      )}

      <AlertDialog open={!!confirmCol} onOpenChange={(v) => !v && setConfirmCol(null)}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="heading">Sütun silinsin mi?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmCol && byCol(confirmCol.id).length > 0 ? "Bu sütunda görevler var. Önce görevleri başka bir sütuna taşıyın." : `"${confirmCol?.name}" sütunu kalıcı olarak silinecek.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Vazgeç</AlertDialogCancel>
            <AlertDialogAction
              disabled={!!confirmCol && byCol(confirmCol.id).length > 0}
              className="rounded-full bg-destructive hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                if (!confirmCol) return;
                delColumn.mutate({ id: confirmCol.id }, {
                  onSuccess: () => { invalidate(); setConfirmCol(null); toast({ title: "Sütun silindi" }); },
                  onError: (err) => toast({ title: "Sütun silinemedi", description: errMsg(err), variant: "destructive" }),
                });
              }}
              data-testid="button-confirm-delete-column"
            >
              Sütunu sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function TaskCard({ task, ws, draggable, onOpen, onDragStart, onDragOver }: { task: Task; ws: Workspace; draggable: boolean; onOpen: () => void; onDragStart: () => void; onDragOver: (e: React.DragEvent<HTMLDivElement>) => void }) {
  const assignees = ws.users.filter((u) => task.assigneeIds.includes(u.id));
  const teams = ws.teams.filter((t) => task.teamIds.includes(t.id));
  const due = dueState(task);
  const checked = task.checklist.filter((c) => c.checked).length;
  return (
    <div
      data-card
      role="button"
      tabIndex={0}
      draggable={draggable}
      onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; onDragStart(); }}
      onDragOver={onDragOver}
      onClick={onOpen}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onOpen())}
      className={cn("group rounded-2xl border border-[hsl(var(--card-border))] bg-card p-3 text-left outline-none transition-colors hover:border-[hsl(220_13%_82%)] focus-visible:ring-2 focus-visible:ring-primary", draggable && "cursor-grab active:cursor-grabbing")}
      data-testid={`card-task-${task.id}`}
    >
      {task.labels.length > 0 && (
        <div className="mb-1.5 flex flex-wrap gap-1">
          {task.labels.slice(0, 3).map((l) => <span key={l} className="rounded-full bg-muted px-2 py-0.5 text-[10.5px] font-semibold text-foreground/70">{l}</span>)}
        </div>
      )}
      <p className={cn("text-[13.5px] font-semibold leading-snug", task.status === "done" && "text-muted-foreground line-through")}>{task.title}</p>
      <div className="mt-2.5 flex items-center gap-2.5 text-[11.5px] text-muted-foreground">
        <PriorityTag p={task.priority} />
        {task.dueDate && (
          <span className={cn("inline-flex items-center gap-1", due === "overdue" && "font-semibold text-destructive", due === "soon" && "font-semibold text-amber-700")}>
            <CalendarClock className="h-3 w-3" />{fmtDate(task.dueDate)}
          </span>
        )}
        {task.checklist.length > 0 && <span className="inline-flex items-center gap-1"><ListChecks className="h-3 w-3" />{checked}/{task.checklist.length}</span>}
        {task.commentCount > 0 && <span className="inline-flex items-center gap-1"><MessageSquare className="h-3 w-3" />{task.commentCount}</span>}
        <span className="ml-auto"><AvatarStack users={assignees} size={20} /></span>
      </div>
      {teams.length > 0 && <p className="mt-2 truncate border-t border-border pt-2 text-[11px] text-muted-foreground">{teams.map((t) => t.name).join(", ")}</p>}
    </div>
  );
}

function BoardDialog({ open, board, ws, onOpenChange, onCreated }: { open: boolean; board: Board | null; ws: Workspace; onOpenChange: (v: boolean) => void; onCreated: (b: Board) => void }) {
  const create = useCreateBoard();
  const update = useUpdateBoard();
  const invalidate = useInvalidateAll();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [teamIds, setTeamIds] = useState<number[]>([]);
  const [memberIds, setMemberIds] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    setName(board?.name ?? "");
    setDescription(board?.description ?? "");
    setTeamIds(board?.teamIds ?? []);
    setMemberIds(board?.memberIds ?? []);
    setError(null);
  }, [open, board]);
  const pending = create.isPending || update.isPending;
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) return setError("Pano adı en az 2 karakter olmalı.");
    const data = { name: name.trim(), description, teamIds, memberIds };
    const opts = {
      onSuccess: (b: Board) => { invalidate(); toast({ title: board ? "Pano güncellendi" : "Pano oluşturuldu" }); onOpenChange(false); if (!board) onCreated(b); },
      onError: (err: unknown) => setError(errMsg(err)),
    };
    if (board) update.mutate({ id: board.id, data }, opts);
    else create.mutate({ data }, opts);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto rounded-3xl sm:max-w-[520px]">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle className="heading text-xl">{board ? "Panoyu düzenle." : "Yeni pano."}</DialogTitle>
            <DialogDescription>Panoyu yalnızca seçtiğiniz ekipler ve kişiler görür.</DialogDescription>
          </DialogHeader>
          <Field label="Pano adı"><input className="field" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} placeholder="Örneğin Satış operasyonları" data-testid="input-board-name" /></Field>
          <Field label="Açıklama"><textarea className="field min-h-[64px]" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} data-testid="input-board-description" /></Field>
          <Field label="Ekipler"><ChipPicker testid="chip-board-team" items={ws.teams} value={teamIds} onChange={setTeamIds} empty="Henüz ekip yok. Ekipler sayfasından oluşturabilirsiniz." render={(t) => <span className="pl-1.5">{t.name}</span>} /></Field>
          <Field label="Ek kişiler"><ChipPicker testid="chip-board-member" items={ws.users.filter((u) => u.active)} value={memberIds} onChange={setMemberIds} render={(u) => (<><UserAvatar user={u} size={20} />{u.name}</>)} /></Field>
          {error && <p className="rounded-xl bg-destructive/8 px-3 py-2 text-[13px] text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="pill pill-outline" onClick={() => onOpenChange(false)}>Vazgeç</button>
            <button className="pill pill-primary" disabled={pending} data-testid="button-save-board">{pending && <Loader2 className="h-4 w-4 animate-spin" />}{board ? "Kaydet" : "Panoyu oluştur"}</button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ColumnDialog({ open, column, board, ws, onOpenChange }: { open: boolean; column: Column | null; board: Board; ws: Workspace; onOpenChange: (v: boolean) => void }) {
  const create = useCreateColumn();
  const update = useUpdateColumn();
  const invalidate = useInvalidateAll();
  const { toast } = useToast();
  const count = ws.columns.filter((c) => c.boardId === board.id).length;
  const [name, setName] = useState("");
  const [position, setPosition] = useState("0");
  const [isDone, setIsDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    setName(column?.name ?? "");
    setPosition(String(column?.position ?? count));
    setIsDone(column?.isDone ?? false);
    setError(null);
  }, [open, column, count]);
  const pending = create.isPending || update.isPending;
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError("Sütun adı gerekli.");
    const data = { name: name.trim(), position: Math.max(0, Number(position) || 0), isDone };
    const opts = {
      onSuccess: () => { invalidate(); toast({ title: column ? "Sütun güncellendi" : "Sütun eklendi" }); onOpenChange(false); },
      onError: (err: unknown) => setError(errMsg(err)),
    };
    if (column) update.mutate({ id: column.id, data }, opts);
    else create.mutate({ id: board.id, data }, opts);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl sm:max-w-[420px]">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle className="heading text-xl">{column ? "Sütunu düzenle." : "Yeni sütun."}</DialogTitle>
            <DialogDescription>{board.name}</DialogDescription>
          </DialogHeader>
          <Field label="Sütun adı"><input className="field" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} data-testid="input-column-name" /></Field>
          <Field label="Sıra" hint="0 en soldaki sütundur."><input type="number" min={0} className="field" value={position} onChange={(e) => setPosition(e.target.value)} data-testid="input-column-position" /></Field>
          <label className="flex items-center justify-between gap-4 rounded-2xl bg-muted/70 px-4 py-3">
            <span>
              <span className="block text-[13.5px] font-semibold">Tamamlanma sütunu</span>
              <span className="block text-[12px] text-muted-foreground">Buraya taşınan görevler tamamlandı sayılır.</span>
            </span>
            <Switch checked={isDone} onCheckedChange={setIsDone} data-testid="switch-column-done" />
          </label>
          {error && <p className="rounded-xl bg-destructive/8 px-3 py-2 text-[13px] text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" className="pill pill-outline" onClick={() => onOpenChange(false)}>Vazgeç</button>
            <button className="pill pill-primary" disabled={pending} data-testid="button-save-column">{pending && <Loader2 className="h-4 w-4 animate-spin" />}Kaydet</button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
