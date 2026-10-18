"use client";

import { ArrowRight, Dumbbell, LineChart, ShieldCheck, Sparkles, WifiOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { Button } from "@/components/ui";

export default function LoginPage() {
  const { status, signIn, error } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "signed_in") router.replace("/");
  }, [status, router]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-5xl flex-col justify-center gap-10 px-5 py-10 lg:flex-row lg:items-center">
      <section className="animate-rise flex-1">
        <span className="mb-6 inline-flex size-14 items-center justify-center rounded-3xl bg-primary text-on-primary shadow-lg">
          <Dumbbell className="size-7 -rotate-30" />
        </span>
        <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
          Tu <span className="text-primary">recomposición</span>
          <br />
          empieza aquí
        </h1>
        <p className="mt-4 max-w-md text-base text-muted">
          Registra cada serie (en lb o kg), sigue tu peso y cintura, y deja que un coach de IA revise tus números reales cada semana.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:max-w-sm">
          {status === "unconfigured" ? (
            <div className="glass rounded-3xl p-4 text-sm">
              <p className="font-semibold">Falta configurar Firebase</p>
              <p className="mt-1 text-muted">
                Copia <code>.env.example</code> a <code>.env.local</code> y completa las variables <code>NEXT_PUBLIC_FIREBASE_*</code>. Revisa el README.
              </p>
            </div>
          ) : (
            <Button size="lg" onClick={signIn} disabled={status === "loading"} className="justify-between pr-2">
              <span className="pl-1">Entrar con Google</span>
              <span className="flex size-10 items-center justify-center rounded-full bg-white/20">
                <ArrowRight className="size-5" />
              </span>
            </Button>
          )}
          {status === "denied" && (
            <p role="alert" className="rounded-2xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger">
              Esta cuenta no tiene acceso. IronLog es una app personal.
            </p>
          )}
          {error && (
            <p role="alert" className="rounded-2xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger">
              {error}
            </p>
          )}
        </div>
      </section>

      <section className="grid flex-1 gap-3 sm:grid-cols-2 lg:max-w-md lg:grid-cols-1">
        {[
          { icon: WifiOff, title: "Funciona sin señal", text: "Registra en el gimnasio y se sincroniza al volver la conexión." },
          { icon: LineChart, title: "Progreso real", text: "e1RM, volumen por músculo, promedio de peso de 7 días y cintura." },
          { icon: Sparkles, title: "Coach de IA", text: "Analiza tus datos y propone ajustes que tú apruebas." },
          { icon: ShieldCheck, title: "Solo tú", text: "Acceso restringido a tu cuenta de Google." },
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
      </section>
    </main>
  );
}
