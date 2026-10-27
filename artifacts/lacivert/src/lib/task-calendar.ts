// Due dates are calendar dates, not instants. Use UTC for date arithmetic so
// the browser's time zone and daylight-saving changes cannot move a task.
export function istanbulToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export type DueDateShortcut = "today" | "tomorrow" | "weekEnd" | "monthEnd";

export function shortcutDueDate(shortcut: DueDateShortcut, today: string): string {
  const date = new Date(`${today}T00:00:00Z`);
  if (shortcut === "tomorrow") date.setUTCDate(date.getUTCDate() + 1);
  if (shortcut === "weekEnd") {
    // Friday itself remains today. Saturday and Sunday target next Friday.
    date.setUTCDate(date.getUTCDate() + (5 - date.getUTCDay() + 7) % 7);
  }
  if (shortcut === "monthEnd") date.setUTCMonth(date.getUTCMonth() + 1, 0);
  return date.toISOString().slice(0, 10);
}

export function shiftMonth(month: string, delta: number): string {
  const date = new Date(`${month}-01T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + delta);
  return date.toISOString().slice(0, 7);
}

export function calendarDays(month: string): (string | null)[] {
  const first = new Date(`${month}-01T00:00:00Z`);
  const offset = (first.getUTCDay() + 6) % 7;
  const next = new Date(`${shiftMonth(month, 1)}-01T00:00:00Z`);
  next.setUTCDate(0);
  const count = next.getUTCDate();
  const length = Math.ceil((offset + count) / 7) * 7;
  return Array.from({ length }, (_, i) => {
    const day = i - offset + 1;
    return day < 1 || day > count ? null : `${month}-${String(day).padStart(2, "0")}`;
  });
}

export function calendarMonthLabel(month: string): string {
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: "UTC", month: "long", year: "numeric",
  }).format(new Date(`${month}-01T00:00:00Z`));
}

export function calendarDayLabel(day: string): string {
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: "UTC", day: "numeric", month: "long", weekday: "long",
  }).format(new Date(`${day}T00:00:00Z`));
}
