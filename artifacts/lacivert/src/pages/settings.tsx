import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, LogOut } from "lucide-react";
import { useChangePassword, useLogout, getGetSessionQueryKey } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Field, PageHeader, UserAvatar } from "@/components/bits";
import { errMsg, useMe } from "@/lib/app";

export default function SettingsPage() {
  const me = useMe();
  const qc = useQueryClient();
  const change = useChangePassword();
  const logout = useLogout();
  const { toast } = useToast();
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [next2, setNext2] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!cur) return setError("Mevcut parolanızı girin.");
    if (next.length < 10) return setError("Yeni parola en az 10 karakter olmalı.");
    if (next !== next2) return setError("Yeni parolalar eşleşmiyor.");
    change.mutate(
      { data: { currentPassword: cur, newPassword: next } },
      {
        onSuccess: () => { setCur(""); setNext(""); setNext2(""); toast({ title: "Parolanız değiştirildi" }); },
        onError: (err) => setError(errMsg(err)),
      },
    );
  };

  return (
    <div className="mx-auto max-w-[720px] px-4 py-6 md:px-8 md:py-8">
      <PageHeader title="Ayarlar." sub="Profiliniz ve hesap güvenliği." />
      <section className="flex items-center gap-4 rounded-3xl bg-muted/70 p-5">
        <UserAvatar user={me} size={56} />
        <div className="min-w-0 flex-1">
          <p className="heading text-[20px]" data-testid="text-profile-name">{me.name}</p>
          <p className="text-[13.5px] text-muted-foreground">@{me.username} · {me.role === "admin" ? "Yönetici" : "Üye"}</p>
        </div>
      </section>
      <p className="mt-2 px-1 text-[12.5px] text-muted-foreground">Ad ve rol değişiklikleri için yöneticinize başvurun.</p>

      <form onSubmit={submit} className="mt-8 space-y-4 rounded-3xl border border-border bg-card p-6">
        <h2 className="heading text-[18px]">Parola Değiştir</h2>
        <Field label="Mevcut parola"><input type="password" className="field" value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" data-testid="input-current-password" /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Yeni parola" hint="En az 10 karakter"><input type="password" className="field" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" data-testid="input-new-password" /></Field>
          <Field label="Yeni parola tekrar"><input type="password" className="field" value={next2} onChange={(e) => setNext2(e.target.value)} autoComplete="new-password" data-testid="input-new-password-confirm" /></Field>
        </div>
        {error && <p className="rounded-xl bg-destructive/8 px-3 py-2 text-[13px] text-destructive" data-testid="text-password-error">{error}</p>}
        <div className="flex justify-end">
          <button className="pill pill-primary" disabled={change.isPending} data-testid="button-change-password">{change.isPending && <Loader2 className="h-4 w-4 animate-spin" />}Parolayı güncelle</button>
        </div>
      </form>

      <div className="mt-8 flex items-center justify-between rounded-3xl border border-border bg-card p-5">
        <div>
          <p className="text-[14px] font-semibold">Oturumu kapat</p>
          <p className="text-[12.5px] text-muted-foreground">Bu cihazdaki oturumunuz sonlanır.</p>
        </div>
        <button
          className="pill pill-outline"
          disabled={logout.isPending}
          onClick={() => logout.mutate(undefined, { onSettled: () => { qc.removeQueries({ predicate: (q) => q.queryKey[0] !== getGetSessionQueryKey()[0] }); qc.setQueryData(getGetSessionQueryKey(), { user: null, needsSetup: false }); } })}
          data-testid="button-settings-logout"
        >
          <LogOut className="h-4 w-4" />Çıkış yap
        </button>
      </div>
    </div>
  );
}
