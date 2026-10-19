"use client";

import { Dumbbell, LineChart, Loader2, ShieldCheck, Sparkles, WifiOff } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { Button, Field, Input, Segmented } from "@/components/ui";

type Mode = "signin" | "signup" | "reset";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="size-5" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

export default function LoginPage() {
  const auth = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [alias, setAlias] = useState("");
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    if (auth.status === "signed_in" || auth.status === "unverified") router.replace("/");
  }, [auth.status, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setInfo(null);
    if (mode === "signin") await auth.signInWithEmail(email, password);
    else if (mode === "signup") await auth.signUpWithEmail(email, password, alias);
    else if (await auth.resetPassword(email)) setInfo("Si existe una cuenta con ese correo, te enviamos un enlace para crear una contraseña nueva. Revisa también spam.");
    setBusy(false);
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-5xl flex-col justify-center gap-10 px-5 py-10 lg:flex-row lg:items-center">
      <section className="animate-rise flex-1">
        <span className="mb-6 inline-flex size-14 items-center justify-center rounded-3xl bg-primary text-on-primary shadow-lg">
          <Dumbbell className="size-7 -rotate-30" />
        </span>
        <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
          Entrena con <span className="text-primary">datos</span>,
          <br />
          no con suposiciones
        </h1>
        <p className="mt-4 max-w-md text-base text-muted">
          Rutinas reconocidas adaptadas a tu gimnasio, registro de series en lb o kg sin señal, y un coach de IA que revisa tus números reales.
        </p>
        <div className="mt-8 hidden gap-3 sm:grid sm:grid-cols-2 lg:max-w-md">
          {[
            { icon: WifiOff, title: "Funciona sin señal", text: "Registra en el gimnasio y se sincroniza después." },
            { icon: LineChart, title: "Progreso real", text: "e1RM, volumen por músculo, peso y cintura." },
            { icon: Sparkles, title: "Coach de IA", text: "Propone ajustes que tú apruebas." },
            { icon: ShieldCheck, title: "Tus datos son tuyos", text: "Exporta o borra todo cuando quieras." },
          ].map(({ icon: Icon, title, text }) => (
            <div key={title} className="glass flex items-start gap-3 rounded-3xl p-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-strong">
                <Icon className="size-5" />
              </span>
              <div>
                <p className="font-semibold">{title}</p>
                <p className="text-sm text-muted">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="glass w-full rounded-[2rem] p-6 sm:p-8 lg:max-w-md">
        {auth.status === "unconfigured" ? (
          <p className="text-sm">
            Falta configurar Firebase: copia <code>.env.example</code> a <code>.env.local</code> y completa las variables. Revisa el README.
          </p>
        ) : (
          <>
            {mode !== "reset" && (
              <Segmented
                label="Acceso"
                value={mode}
                onChange={(m) => {
                  setMode(m);
                  auth.clearError();
                  setInfo(null);
                }}
                options={[
                  { value: "signin", label: "Entrar" },
                  { value: "signup", label: "Crear cuenta" },
                ]}
              />
            )}
            {mode === "reset" && <h2 className="text-xl font-bold">Recuperar contraseña</h2>}

            {mode !== "reset" && (
              <>
                <Button variant="outline" size="lg" className="mt-5 w-full" onClick={auth.signInWithGoogle} disabled={auth.status === "loading"}>
                  <GoogleIcon /> Continuar con Google
                </Button>
                <div className="my-5 flex items-center gap-3 text-xs text-muted">
                  <span className="h-px flex-1 bg-line" /> o con tu correo <span className="h-px flex-1 bg-line" />
                </div>
              </>
            )}

            <form onSubmit={submit} className="space-y-3">
              {mode === "signup" && (
                <Field label="Nombre o alias">{(id) => <Input id={id} autoComplete="nickname" value={alias} onChange={(e) => setAlias(e.target.value)} maxLength={40} />}</Field>
              )}
              <Field label="Correo">
                {(id) => <Input id={id} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />}
              </Field>
              {mode !== "reset" && (
                <Field label="Contraseña" hint={mode === "signup" ? "Mínimo 8 caracteres." : undefined}>
                  {(id) => (
                    <Input
                      id={id}
                      type="password"
                      autoComplete={mode === "signup" ? "new-password" : "current-password"}
                      required
                      minLength={mode === "signup" ? 8 : undefined}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  )}
                </Field>
              )}
              {auth.error && (
                <p role="alert" className="rounded-2xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger">
                  {auth.error}
                </p>
              )}
              {info && (
                <p role="status" className="rounded-2xl bg-primary-soft px-4 py-3 text-sm font-medium text-primary-strong">
                  {info}
                </p>
              )}
              <Button type="submit" size="lg" className="w-full" disabled={busy}>
                {busy && <Loader2 className="size-4 animate-spin" />}
                {mode === "signin" ? "Entrar" : mode === "signup" ? "Crear cuenta" : "Enviar enlace"}
              </Button>
            </form>

            <div className="mt-4 flex flex-wrap justify-between gap-2 text-sm">
              {mode === "reset" ? (
                <button type="button" className="font-semibold text-primary" onClick={() => setMode("signin")}>
                  Volver a entrar
                </button>
              ) : (
                <button type="button" className="font-semibold text-primary" onClick={() => setMode("reset")}>
                  ¿Olvidaste tu contraseña?
                </button>
              )}
              <Link href="/privacidad" className="text-muted underline">
                Privacidad
              </Link>
            </div>
            {mode === "signup" && <p className="mt-3 text-xs text-muted">Solo para mayores de 18 años. Antes de empezar te pediremos aceptar la política de privacidad y el aviso de salud.</p>}
          </>
        )}
      </section>
    </main>
  );
}
