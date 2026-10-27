import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, Loader2 } from "lucide-react";
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
    <main className="flex min-h-[100dvh] items-center justify-center bg-card px-6 py-12">
        <div className="w-full max-w-[380px]">
          <img src={`${import.meta.env.BASE_URL}logo-navy.png`} alt="Lacivert Teknoloji" className="mx-auto mb-12 h-auto w-[360px] max-w-full object-contain" />
          <h1 className={needsSetup ? "heading mb-6 text-center text-2xl" : "sr-only"}>{needsSetup ? "Yönetici Hesabı Oluştur" : "Giriş Yap"}</h1>
          <form onSubmit={submit} className="space-y-3">
            {needsSetup && (
              <input className="field h-12 rounded-2xl" aria-label="Ad Soyad" placeholder="Ad Soyad" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" data-testid="input-name" />
            )}
            <input className="field h-12 rounded-2xl" aria-label="Kullanıcı Adı" placeholder="Kullanıcı Adı" value={username} onChange={(e) => setUsername(e.target.value.trim())} autoComplete="username" autoCapitalize="none" data-testid="input-username" />
            <div className="relative">
              <input
                className="field h-12 rounded-2xl pr-12"
                type={show ? "text" : "password"}
                aria-label="Parola"
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
                <input className="field h-12 rounded-2xl" type={show ? "text" : "password"} aria-label="Parola Tekrarı" placeholder="Parola Tekrarı" value={password2} onChange={(e) => setPassword2(e.target.value)} autoComplete="new-password" data-testid="input-password-confirm" />
              </>
            )}
            {error && <p role="alert" className="rounded-2xl bg-destructive/8 px-4 py-2.5 text-[13.5px] text-destructive" data-testid="text-auth-error">{error}</p>}
            <button type="submit" className="pill pill-primary mt-2 h-12 w-full justify-center text-[15px]" disabled={pending} data-testid="button-submit-auth">
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {needsSetup ? "Yönetici Hesabı Oluştur" : "Giriş Yap"}
            </button>
          </form>
        </div>
    </main>
  );
}
