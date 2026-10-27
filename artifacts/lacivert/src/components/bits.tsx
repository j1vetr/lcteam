import type { ReactNode } from "react";
import { Check } from "lucide-react";
import type { User } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import { initials, PRIORITY } from "@/lib/app";
import type { Task } from "@workspace/api-client-react";

export function UserAvatar({ user, size = 24, ring }: { user?: User; size?: number; ring?: boolean }) {
  if (!user) return null;
  return (
    <span
      title={user.name}
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white", ring && "ring-2 ring-card")}
      style={{ width: size, height: size, fontSize: Math.max(9, size * 0.4), background: user.color || "hsl(222 62% 20%)" }}
    >
      {initials(user.name)}
    </span>
  );
}

export function AvatarStack({ users, max = 3, size = 22 }: { users: User[]; max?: number; size?: number }) {
  const shown = users.slice(0, max);
  return (
    <span className="flex -space-x-1.5">
      {shown.map((u) => (
        <UserAvatar key={u.id} user={u} size={size} ring />
      ))}
      {users.length > max && (
        <span className="inline-flex items-center justify-center rounded-full bg-muted text-[10px] font-semibold ring-2 ring-card" style={{ width: size, height: size }}>
          +{users.length - max}
        </span>
      )}
    </span>
  );
}

export function PriorityTag({ p }: { p: Task["priority"] }) {
  const s = PRIORITY[p];
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[11.5px] font-semibold", s.text)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />
      {s.label}
    </span>
  );
}

export function ChipPicker<T extends { id: number }>({
  items,
  value,
  onChange,
  render,
  empty,
  disabled,
  testid,
}: {
  items: T[];
  value: number[];
  onChange: (v: number[]) => void;
  render: (i: T) => ReactNode;
  empty?: string;
  disabled?: boolean;
  testid?: string;
}) {
  if (!items.length) return <p className="text-[13px] text-muted-foreground">{empty ?? "Seçenek yok"}</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((i) => {
        const on = value.includes(i.id);
        return (
          <button
            type="button"
            key={i.id}
            disabled={disabled}
            data-testid={`${testid ?? "chip"}-${i.id}`}
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((v) => v !== i.id) : [...value, i.id])}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-full border pl-1.5 pr-3 text-[13px] font-medium transition-colors disabled:opacity-60",
              on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-muted",
            )}
          >
            {on ? <Check className="ml-1 h-3.5 w-3.5" /> : null}
            {render(i)}
          </button>
        );
      })}
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[12.5px] font-semibold text-foreground/80">{label}</span>
      {children}
      {hint && <span className="block text-[12px] text-muted-foreground">{hint}</span>}
    </label>
  );
}

export function EmptyState({ icon, title, text, action }: { icon: ReactNode; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-card px-6 py-14 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-[30%] bg-muted text-primary">{icon}</div>
      <h3 className="heading text-lg">{title}</h3>
      <p className="mt-1.5 max-w-sm text-[14px] text-muted-foreground">{text}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ onRetry, text }: { onRetry: () => void; text?: string }) {
  return (
    <div className="rounded-3xl border border-border bg-card px-6 py-10 text-center">
      <h3 className="heading text-lg">Veriler yüklenemedi.</h3>
      <p className="mt-1 text-[14px] text-muted-foreground">{text ?? "Bağlantınızı kontrol edip tekrar deneyin."}</p>
      <button className="pill pill-outline mt-4" onClick={onRetry} data-testid="button-retry">
        Tekrar dene
      </button>
    </div>
  );
}

export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: NoInfer<T>) => void; options: { value: NoInfer<T>; label: string }[] }) {
  return (
    <div className="inline-flex rounded-full bg-muted p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          data-testid={`segment-${o.value}`}
          onClick={() => onChange(o.value)}
          className={cn(
            "h-7 rounded-full px-3 text-[12.5px] font-semibold transition-colors",
            value === o.value ? "bg-card text-foreground shadow-[0_1px_2px_rgba(15,23,42,0.08)]" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function PageHeader({ title, sub, actions }: { title: string; sub?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="heading text-[26px] md:text-[30px]">{title}</h1>
        {sub && <p className="mt-1.5 text-[14.5px] font-light text-muted-foreground">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
