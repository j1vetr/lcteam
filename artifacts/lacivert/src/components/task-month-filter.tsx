import type { Task } from "@workspace/api-client-react";

export function matchesTaskMonth(task: Task, month: string) {
  if (!month) return true;
  if (month === "undated") return !task.dueDate;
  return task.dueDate?.slice(0, 7) === month;
}

export function TaskMonthFilter({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select aria-label="Bitiş tarihine göre filtrele" className="field h-9 w-auto rounded-full py-0 text-[13px]" value={value === "undated" ? "undated" : value ? "month" : ""} onChange={(e) => {
        const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit" }).formatToParts(new Date());
        const today = `${parts.find((p) => p.type === "year")!.value}-${parts.find((p) => p.type === "month")!.value}`;
        onChange(e.target.value === "month" ? today : e.target.value);
      }} data-testid="select-task-month-mode">
        <option value="">Tüm tarihler</option>
        <option value="month">Ay seç</option>
        <option value="undated">Tarihsiz</option>
      </select>
      {value && value !== "undated" && <input type="month" aria-label="Bitiş ayı" className="field h-9 w-auto rounded-full py-0 text-[13px]" value={value} onChange={(e) => onChange(e.target.value)} data-testid="input-task-month" />}
    </div>
  );
}
