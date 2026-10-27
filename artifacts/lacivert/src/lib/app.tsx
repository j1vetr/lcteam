import { createContext, useContext } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow, parseISO, differenceInCalendarDays } from "date-fns";
import { tr } from "date-fns/locale";
import {
  useGetSession,
  useGetWorkspace,
  getGetWorkspaceQueryKey,
  getGetDashboardQueryKey,
  getGetActivityQueryKey,
  getGetNotificationsQueryKey,
  type Task,
  type User,
  type Workspace,
} from "@workspace/api-client-react";

export const PRIORITY: Record<Task["priority"], { label: string; dot: string; text: string }> = {
  low: { label: "Düşük", dot: "bg-slate-300", text: "text-slate-500" },
  medium: { label: "Orta", dot: "bg-[hsl(214_70%_55%)]", text: "text-[hsl(214_60%_40%)]" },
  high: { label: "Yüksek", dot: "bg-amber-500", text: "text-amber-700" },
  urgent: { label: "Acil", dot: "bg-[hsl(2_68%_50%)]", text: "text-[hsl(2_68%_42%)]" },
};
export const PRIORITY_ORDER: Task["priority"][] = ["urgent", "high", "medium", "low"];

export const STATUS: Record<Task["status"], string> = {
  todo: "Yapılacak",
  doing: "Devam ediyor",
  review: "İncelemede",
  done: "Tamamlandı",
};
export const STATUS_ORDER: Task["status"][] = ["todo", "doing", "review", "done"];

export const trUpper = (s: string) => s.toLocaleUpperCase("tr-TR");

export function initials(name: string) {
  return trUpper(
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0])
      .join(""),
  );
}

export function errMsg(e: unknown): string {
  const anyE = e as { data?: { error?: string; message?: string } | null; message?: string };
  return anyE?.data?.error || anyE?.data?.message || anyE?.message || "Beklenmeyen bir hata oluştu";
}

const toDate = (d: string) => (d.length <= 10 ? parseISO(d) : new Date(d));
export const fmtDate = (d: string | null) => (d ? format(toDate(d), "d MMM", { locale: tr }) : "");
export const fmtDateLong = (d: string) => new Intl.DateTimeFormat("tr-TR", {
  timeZone: "Europe/Istanbul", dateStyle: "long", timeStyle: "short",
}).format(new Date(d));
export const relTime = (d: string) => formatDistanceToNow(new Date(d), { addSuffix: true, locale: tr });
export const dateInput = (d: string | null) => (d ? d.slice(0, 10) : "");

export function dueState(t: Task): "overdue" | "soon" | "none" | "ok" {
  if (!t.dueDate || t.status === "done") return "none";
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const diff = differenceInCalendarDays(toDate(t.dueDate), parseISO(today));
  if (diff < 0) return "overdue";
  if (diff <= 3) return "soon";
  return "ok";
}

export function useMe(): User {
  const { data } = useGetSession();
  return data!.user!;
}

export function useWorkspace() {
  return useGetWorkspace({ query: { queryKey: getGetWorkspaceQueryKey(), refetchInterval: 30000 } });
}

export function useInvalidateAll() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: getGetWorkspaceQueryKey() });
    qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
    qc.invalidateQueries({ queryKey: getGetActivityQueryKey() });
    qc.invalidateQueries({ queryKey: getGetNotificationsQueryKey() });
    qc.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith("/api/tasks/") });
  };
}

export function isTaskDone(t: Task, ws?: Workspace) {
  if (t.status === "done") return true;
  if (t.columnId && ws) return !!ws.columns.find((c) => c.id === t.columnId)?.isDone;
  return false;
}

export function isAssignedToMe(t: Task, me: User, ws?: Workspace) {
  return t.assigneeIds.includes(me.id) ||
    !!ws?.teams.some(team => t.teamIds.includes(team.id) && team.memberIds.includes(me.id));
}

export type NewTaskDefaults = { boardId?: number | null; columnId?: number | null };
type Ctx = { openTask: (id: number) => void; newTask: (d?: NewTaskDefaults) => void };
export const TaskUiContext = createContext<Ctx>({ openTask: () => {}, newTask: () => {} });
export const useTaskUi = () => useContext(TaskUiContext);
