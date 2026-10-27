import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { useLogin, useSetupAdmin, getGetSessionQueryKey } from "@workspace/api-client-react";
import { errMsg } from "@/lib/app";

export default function LoginPage({ needsSetup }: { needsSetup: boolean }) {
  const qc = useQueryClient();
  const login = useLogin();
  const setup = useSetupAdmin();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = login.isPending || setup.isPending;

  const done = () => {
    qc.removeQueries({ predicate: (q) => q.queryKey[0] !== getGetSessionQueryKey()[0] });
    qc.invalidateQueries({ queryKey: getGetSessionQueryKey() });
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!/^[a-zA-Z0-9._-]{3,50}$/.test(username)) return setError("Kullanıcı adı en az 3 karakter olmalı ve yalnızca harf, rakam, nokta, tire içermeli.");
    if (needsSetup) {
      if (name.trim().length < 2) return setError("Adınızı girin.");
      if (password.length < 10) return setError("Parola en az 10 karakter olmalı.");
      if (password !== password2) return setError("Parolalar eşleşmiyor.");
      setup.mutate({ data: { name: name.trim(), username, password } }, { onSuccess: done, onError: (e) => setError(errMsg(e)) });
    } else {
      if (!password) return setError("Parolanızı girin.");
      login.mutate({ data: { username, password } }, { onSuccess: done, onError: (e) => setError(errMsg(e)) });
    }
  };

  const strength = Math.min(4, Math.floor(password.length / 4) + (/[A-Z]/.test(password) && /\d/.test(password) ? 1 : 0));

  return (
    <div className="grid min-h-[100dvh] bg-card lg:grid-cols-[1fr_1.05fr]">
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <img src={`${import.meta.env.BASE_URL}logo-navy.png`} alt="Lacivert Teknoloji" className="h-7 w-auto self-start" />
        <div className="mx-auto flex w-full max-w-[380px] flex-1 flex-col justify-center py-10">
          {needsSetup && (
            <span className="mb-5 inline-flex w-fit items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-[12px] font-semibold text-primary">
              <ShieldCheck className="h-3.5 w-3.5" />İlk kurulum
            </span>
          )}
          <h1 className="heading text-[34px] leading-[1.05]">{needsSetup ? "Çalışma alanınızı kurun." : "Tekrar hoş geldiniz."}</h1>
          <p className="mt-3 text-[16px] font-light text-muted-foreground">
            {needsSetup ? "Yönetici hesabını oluşturun. Ekipleri, panoları ve diğer hesapları buradan yöneteceksiniz." : "Kullanıcı adınız ve parolanızla giriş yapın."}
          </p>
          <form onSubmit={submit} className="mt-8 space-y-3">
            {needsSetup && (
              <input className="field h-12 rounded-2xl" placeholder="Ad soyad" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" data-testid="input-name" />
            )}
            <input className="field h-12 rounded-2xl" placeholder="Kullanıcı adı" value={username} onChange={(e) => setUsername(e.target.value.trim())} autoComplete="username" autoCapitalize="none" data-testid="input-username" />
            <div className="relative">
              <input
                className="field h-12 rounded-2xl pr-12"
                type={show ? "text" : "password"}
                placeholder={needsSetup ? "Parola (en az 10 karakter)" : "Parola"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={needsSetup ? "new-password" : "current-password"}
                data-testid="input-password"
              />
              <button type="button" aria-label={show ? "Parolayı gizle" : "Parolayı göster"} onClick={() => setShow(!show)} className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-card">
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {needsSetup && (
              <>
                <div className="flex gap-1 px-1" aria-hidden>
                  {[0, 1, 2, 3].map((i) => (
                    <span key={i} className={`h-1 flex-1 rounded-full ${i < strength ? "bg-primary" : "bg-muted"}`} />
                  ))}
                </div>
                <input className="field h-12 rounded-2xl" type={show ? "text" : "password"} placeholder="Parolayı tekrar girin" value={password2} onChange={(e) => setPassword2(e.target.value)} autoComplete="new-password" data-testid="input-password-confirm" />
              </>
            )}
            {error && <p className="rounded-2xl bg-destructive/8 px-4 py-2.5 text-[13.5px] text-destructive" data-testid="text-auth-error">{error}</p>}
            <button type="submit" className="pill pill-primary mt-2 h-12 w-full justify-center text-[15px]" disabled={pending} data-testid="button-submit-auth">
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {needsSetup ? "Yönetici hesabını oluştur" : "Giriş yap"}
              {!pending && <ArrowRight className="h-4 w-4" />}
            </button>
          </form>
          <p className="mt-6 text-[12.5px] text-muted-foreground">
            {needsSetup ? "Kurulumdan sonra ilk panonuz ve başlangıç görevleri hazır olacak." : "Hesabınız yok mu? Yöneticinizden hesap açmasını isteyin."}
          </p>
        </div>
        <p className="text-[12px] text-muted-foreground">© {new Date().getFullYear()} Lacivert Teknoloji</p>
      </div>

      <div className="relative m-3 hidden overflow-hidden rounded-[28px] bg-primary lg:block">
        <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)", backgroundSize: "44px 44px" }} />
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <img src={`${import.meta.env.BASE_URL}logo-white.png`} alt="" className="h-6 w-auto self-start opacity-90" />
          <div className="mx-auto w-full max-w-[460px] -rotate-2 space-y-3">
            {[
              { c: "Yapılacak", t: "Müşteri sunumunu hazırla", p: "Yüksek", d: "14 Kas" },
              { c: "Devam ediyor", t: "Satın alma sürecini netleştir", p: "Orta", d: "18 Kas" },
              { c: "İncelemede", t: "Yeni ekip üyeleri için hesap aç", p: "Acil", d: "Bugün" },
            ].map((x, i) => (
              <div key={i} className="rounded-2xl bg-white/[0.08] p-4 ring-1 ring-white/15 backdrop-blur" style={{ transform: `translateX(${i * 28}px)` }}>
                <div className="flex items-center justify-between text-[11.5px] text-white/60">
                  <span>{x.c}</span>
                  <span className="font-mono">{x.d}</span>
                </div>
                <p className="mt-1.5 text-[15px] font-semibold">{x.t}</p>
                <span className="mt-3 inline-flex rounded-full bg-white/12 px-2.5 py-0.5 text-[11px] font-semibold">{x.p}</span>
              </div>
            ))}
          </div>
          <div>
            <h2 className="heading text-[40px] leading-[1.02]">Ekip ne yapıyor, kim sorumlu, ne zaman bitiyor.</h2>
            <p className="mt-4 max-w-md text-[16px] font-light text-white/70">Şirket panoları ve kişisel işler tek yerde. Herkes kendi işini görür, yönetici bütün resmi.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
