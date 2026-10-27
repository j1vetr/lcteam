import { useEffect, useState } from "react";
import { Loader2, Pencil, Plus, Trash2, UserPlus, Users } from "lucide-react";
import { useCreateTeam, useUpdateTeam, useDeleteTeam, useCreateUser, useUpdateUser, type Team, type User, type Workspace } from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { AvatarStack, ChipPicker, EmptyState, ErrorState, Field, PageHeader, Segmented, UserAvatar } from "@/components/bits";
import { errMsg, useInvalidateAll, useMe, useWorkspace } from "@/lib/app";
import { cn } from "@/lib/utils";

export default function TeamsPage() {
  const me = useMe();
  const isAdmin = me.role === "admin";
  const { data: ws, isLoading, isError, refetch } = useWorkspace();
  const [tab, setTab] = useState<"teams" | "people">("teams");
  const [teamDlg, setTeamDlg] = useState<{ open: boolean; team: Team | null }>({ open: false, team: null });
  const [userDlg, setUserDlg] = useState<{ open: boolean; user: User | null }>({ open: false, user: null });
  const [confirmTeam, setConfirmTeam] = useState<Team | null>(null);
  const del = useDeleteTeam();
  const invalidate = useInvalidateAll();
  const { toast } = useToast();

  const openTasks = (filter: (t: Workspace["tasks"][number]) => boolean) => (ws?.tasks ?? []).filter((t) => t.status !== "done" && filter(t)).length;

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-6 md:px-8 md:py-8">
      <PageHeader
        title="Ekipler ve kişiler."
        sub={isAdmin ? "Ekipleri, üyelikleri ve hesapları yönetin." : "Şirketteki ekipler ve çalışma arkadaşlarınız."}
        actions={
          isAdmin && (tab === "teams" ? (
            <button className="pill pill-primary" onClick={() => setTeamDlg({ open: true, team: null })} data-testid="button-new-team"><Plus className="h-4 w-4" />Ekip</button>
          ) : (
            <button className="pill pill-primary" onClick={() => setUserDlg({ open: true, user: null })} data-testid="button-new-user"><UserPlus className="h-4 w-4" />Kişi ekle</button>
          ))
        }
      />
      <div className="mb-5">
        <Segmented value={tab} onChange={setTab} options={[{ value: "teams", label: `Ekipler ${ws?.teams.length ?? ""}` }, { value: "people", label: `Kişiler ${ws?.users.length ?? ""}` }]} />
      </div>

      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-32 rounded-3xl" />)}</div>
      ) : isError || !ws ? (
        <ErrorState onRetry={() => refetch()} />
      ) : tab === "teams" ? (
        ws.teams.length === 0 ? (
          <EmptyState icon={<Users className="h-5 w-5" />} title="Henüz ekip yok." text={isAdmin ? "Satış, operasyon, yazılım gibi ekipler oluşturun ve kişileri ekleyin. Panolara ekip bazında erişim verebilirsiniz." : "Yönetici ekip oluşturduğunda burada görünecek."} action={isAdmin ? <button className="pill pill-primary" onClick={() => setTeamDlg({ open: true, team: null })}><Plus className="h-4 w-4" />İlk ekibi oluştur</button> : undefined} />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {ws.teams.map((t) => {
              const members = ws.users.filter((u) => t.memberIds.includes(u.id));
              return (
                <article key={t.id} className="rounded-3xl border border-border bg-card p-5" data-testid={`card-team-${t.id}`}>
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[30%] bg-primary text-[14px] font-semibold text-primary-foreground">{t.name.slice(0, 1).toLocaleUpperCase("tr-TR")}</div>
                    <div className="min-w-0 flex-1">
                      <h3 className="heading truncate text-[17px]">{t.name}</h3>
                      <p className="line-clamp-2 text-[13px] text-muted-foreground">{t.description || "Açıklama yok."}</p>
                    </div>
                    {isAdmin && (
                      <div className="flex gap-1">
                        <button className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted" onClick={() => setTeamDlg({ open: true, team: t })} aria-label="Ekibi düzenle" data-testid={`button-edit-team-${t.id}`}><Pencil className="h-3.5 w-3.5" /></button>
                        <button className="flex h-8 w-8 items-center justify-center rounded-full text-destructive hover:bg-muted" onClick={() => setConfirmTeam(t)} aria-label="Ekibi sil" data-testid={`button-delete-team-${t.id}`}><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    )}
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-[12.5px] text-muted-foreground">
                    <span className="flex items-center gap-2"><AvatarStack users={members} max={6} size={24} />{members.length} üye</span>
                    <span className="font-mono">{openTasks((x) => x.teamIds.includes(t.id))} açık görev</span>
                  </div>
                </article>
              );
            })}
          </div>
        )
      ) : (
        <div className="overflow-hidden rounded-3xl border border-border bg-card">
          <table className="w-full text-[13.5px]">
            <thead>
              <tr className="border-b border-border text-left text-[11.5px] text-muted-foreground">
                <th className="px-5 py-2.5 font-medium">Kişi</th>
                <th className="hidden px-3 py-2.5 font-medium md:table-cell">Ekipler</th>
                <th className="px-3 py-2.5 font-medium">Rol</th>
                <th className="hidden px-3 py-2.5 text-right font-medium sm:table-cell">Açık görev</th>
                {isAdmin && <th className="px-5 py-2.5" />}
              </tr>
            </thead>
            <tbody>
              {ws.users.map((u) => (
                <tr key={u.id} className={cn("border-b border-border last:border-0", !u.active && "opacity-55")} data-testid={`row-user-${u.id}`}>
                  <td className="px-5 py-2.5">
                    <span className="flex items-center gap-2.5">
                      <UserAvatar user={u} size={30} />
                      <span className="min-w-0">
                        <span className="block truncate font-semibold">{u.name}{u.id === me.id && <span className="ml-1.5 text-[11.5px] font-normal text-muted-foreground">siz</span>}</span>
                        <span className="block text-[12px] text-muted-foreground">@{u.username}{!u.active && " · pasif"}</span>
                      </span>
                    </span>
                  </td>
                  <td className="hidden px-3 text-[12.5px] text-muted-foreground md:table-cell">{ws.teams.filter((t) => t.memberIds.includes(u.id)).map((t) => t.name).join(", ") || "Ekip yok"}</td>
                  <td className="px-3"><span className={cn("rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold", u.role === "admin" ? "bg-primary text-primary-foreground" : "bg-muted")}>{u.role === "admin" ? "Yönetici" : "Üye"}</span></td>
                  <td className="hidden px-3 text-right font-mono sm:table-cell">{openTasks((x) => x.assigneeIds.includes(u.id))}</td>
                  {isAdmin && (
                    <td className="px-5 text-right">
                      <button className="pill pill-sm pill-soft" onClick={() => setUserDlg({ open: true, user: u })} data-testid={`button-edit-user-${u.id}`}>Düzenle</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {ws && isAdmin && <TeamDialog open={teamDlg.open} team={teamDlg.team} ws={ws} onOpenChange={(v) => setTeamDlg((s) => ({ ...s, open: v }))} />}
      {isAdmin && <UserDialog open={userDlg.open} user={userDlg.user} meId={me.id} onOpenChange={(v) => setUserDlg((s) => ({ ...s, open: v }))} />}

      <AlertDialog open={!!confirmTeam} onOpenChange={(v) => !v && setConfirmTeam(null)}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="heading">Ekip silinsin mi?</AlertDialogTitle>
            <AlertDialogDescription>"{confirmTeam?.name}" silinir. Üyelerin hesapları ve görevleri etkilenmez, ekip atamaları kaldırılır.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Vazgeç</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-full bg-destructive hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                if (!confirmTeam) return;
                del.mutate({ id: confirmTeam.id }, {
                  onSuccess: () => { invalidate(); setConfirmTeam(null); toast({ title: "Ekip silindi" }); },
                  onError: (err) => toast({ title: "Ekip silinemedi", description: errMsg(err), variant: "destructive" }),
                });
              }}
              data-testid="button-confirm-delete-team"
            >
              {del.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Ekibi sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function TeamDialog({ open, team, ws, onOpenChange }: { open: boolean; team: Team | null; ws: Workspace; onOpenChange: (v: boolean) => void }) {
  const create = useCreateTeam();
  const update = useUpdateTeam();
  const invalidate = useInvalidateAll();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [memberIds, setMemberIds] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    setName(team?.name ?? "");
    setDescription(team?.description ?? "");
    setMemberIds(team?.memberIds ?? []);
    setError(null);
  }, [open, team]);
  const pending = create.isPending || update.isPending;
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) return setError("Ekip adı en az 2 karakter olmalı.");
    const data = { name: name.trim(), description, memberIds };
    const opts = { onSuccess: () => { invalidate(); toast({ title: team ? "Ekip güncellendi" : "Ekip oluşturuldu" }); onOpenChange(false); }, onError: (err: unknown) => setError(errMsg(err)) };
    if (team) update.mutate({ id: team.id, data }, opts);
    else create.mutate({ data }, opts);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto rounded-3xl sm:max-w-[500px]">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle className="heading text-xl">{team ? "Ekibi düzenle." : "Yeni ekip."}</DialogTitle>
            <DialogDescription>Üyeler, ekibin erişebildiği panoları görür.</DialogDescription>
          </DialogHeader>
          <Field label="Ekip adı"><input className="field" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} placeholder="Örneğin Saha operasyonları" data-testid="input-team-name" /></Field>
          <Field label="Açıklama"><textarea className="field min-h-[64px]" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} data-testid="input-team-description" /></Field>
          <Field label="Üyeler"><ChipPicker testid="chip-team-member" items={ws.users.filter((u) => u.active || memberIds.includes(u.id))} value={memberIds} onChange={setMemberIds} render={(u) => (<><UserAvatar user={u} size={20} />{u.name}</>)} /></Field>
          {error && <p className="rounded-xl bg-destructive/8 px-3 py-2 text-[13px] text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" className="pill pill-outline" onClick={() => onOpenChange(false)}>Vazgeç</button>
            <button className="pill pill-primary" disabled={pending} data-testid="button-save-team">{pending && <Loader2 className="h-4 w-4 animate-spin" />}Kaydet</button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function UserDialog({ open, user, meId, onOpenChange }: { open: boolean; user: User | null; meId: number; onOpenChange: (v: boolean) => void }) {
  const create = useCreateUser();
  const update = useUpdateUser();
  const invalidate = useInvalidateAll();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<User["role"]>("member");
  const [active, setActive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    setName(user?.name ?? "");
    setUsername(user?.username ?? "");
    setPassword("");
    setRole(user?.role ?? "member");
    setActive(user?.active ?? true);
    setError(null);
  }, [open, user]);
  const pending = create.isPending || update.isPending;
  const self = user?.id === meId;
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (name.trim().length < 2) return setError("Ad en az 2 karakter olmalı.");
    const opts = { onSuccess: () => { invalidate(); toast({ title: user ? "Hesap güncellendi" : "Hesap oluşturuldu" }); onOpenChange(false); }, onError: (err: unknown) => setError(errMsg(err)) };
    if (user) update.mutate({ id: user.id, data: { name: name.trim(), role, active } }, opts);
    else {
      if (!/^[a-zA-Z0-9._-]{3,50}$/.test(username)) return setError("Kullanıcı adı en az 3 karakter, yalnızca harf, rakam, nokta, tire.");
      if (password.length < 10) return setError("Geçici parola en az 10 karakter olmalı.");
      create.mutate({ data: { name: name.trim(), username, password, role } }, opts);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl sm:max-w-[460px]">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle className="heading text-xl">{user ? "Hesabı düzenle." : "Yeni hesap."}</DialogTitle>
            <DialogDescription>{user ? `@${user.username}` : "Kişiye kullanıcı adı ve geçici parolayı siz iletin."}</DialogDescription>
          </DialogHeader>
          <Field label="Ad soyad"><input className="field" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} data-testid="input-user-name" /></Field>
          {!user && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Kullanıcı adı"><input className="field" value={username} onChange={(e) => setUsername(e.target.value.trim())} autoCapitalize="none" data-testid="input-user-username" /></Field>
              <Field label="Geçici parola" hint="En az 10 karakter"><input className="field" type="text" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" data-testid="input-user-password" /></Field>
            </div>
          )}
          <Field label="Rol">
            <Segmented value={role} onChange={(v) => !self && setRole(v)} options={[{ value: "member", label: "Üye" }, { value: "admin", label: "Yönetici" }]} />
          </Field>
          {user && (
            <label className="flex items-center justify-between gap-4 rounded-2xl bg-muted/70 px-4 py-3">
              <span>
                <span className="block text-[13.5px] font-semibold">Hesap aktif</span>
                <span className="block text-[12px] text-muted-foreground">{self ? "Kendi hesabınızı pasifleştiremezsiniz." : "Pasif hesaplar giriş yapamaz."}</span>
              </span>
              <Switch checked={active} disabled={self} onCheckedChange={setActive} data-testid="switch-user-active" />
            </label>
          )}
          {error && <p className="rounded-xl bg-destructive/8 px-3 py-2 text-[13px] text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" className="pill pill-outline" onClick={() => onOpenChange(false)}>Vazgeç</button>
            <button className="pill pill-primary" disabled={pending} data-testid="button-save-user">{pending && <Loader2 className="h-4 w-4 animate-spin" />}{user ? "Kaydet" : "Hesabı oluştur"}</button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
