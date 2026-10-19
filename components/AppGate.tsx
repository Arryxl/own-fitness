"use client";

import { Dumbbell, Loader2, LogOut, MailCheck } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { AppShell } from "@/components/AppShell";
import { AutoWeeklyReport } from "@/components/coach/AutoWeeklyReport";
import { useAuth } from "@/components/providers/AuthProvider";
import { DataProvider, useData } from "@/components/providers/DataProvider";
import { Button } from "@/components/ui";

export function Splash({ text = "Cargando…" }: { text?: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4" role="status" aria-live="polite">
      <span className="flex size-16 animate-pulse items-center justify-center rounded-3xl bg-primary text-on-primary shadow-lg">
        <Dumbbell className="size-8 -rotate-30" />
      </span>
      <p className="text-sm font-medium text-muted">{text}</p>
    </div>
  );
}

function VerifyEmail() {
  const { user, resendVerification, refreshUser, signOut, error } = useAuth();
  const [sent, setSent] = useState(false);
  const [checking, setChecking] = useState(false);
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5">
      <div className="glass animate-rise rounded-[2rem] p-6 text-center">
        <span className="mx-auto flex size-14 items-center justify-center rounded-3xl bg-primary-soft text-primary">
          <MailCheck className="size-7" />
        </span>
        <h1 className="mt-4 text-2xl font-extrabold">Verifica tu correo</h1>
        <p className="mt-2 text-sm text-muted">
          Te enviamos un enlace a <b className="text-ink">{user?.email}</b>. Ábrelo y vuelve aquí. Revisa también la carpeta de spam.
        </p>
        {error && <p className="mt-3 rounded-2xl bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
        <div className="mt-5 space-y-2">
          <Button
            className="w-full"
            disabled={checking}
            onClick={async () => {
              setChecking(true);
              await refreshUser();
              setChecking(false);
            }}
          >
            {checking && <Loader2 className="size-4 animate-spin" />} Ya lo verifiqué
          </Button>
          <Button
            variant="soft"
            className="w-full"
            disabled={sent}
            onClick={async () => {
              if (await resendVerification()) setSent(true);
            }}
          >
            {sent ? "Enlace reenviado" : "Reenviar enlace"}
          </Button>
          <Button variant="ghost" className="w-full" onClick={signOut}>
            <LogOut className="size-4" /> Usar otra cuenta
          </Button>
        </div>
      </div>
    </main>
  );
}

const ONBOARDING_FREE = ["/bienvenida", "/privacidad"];

function OnboardingGate({ children }: { children: ReactNode }) {
  const data = useData();
  const router = useRouter();
  const pathname = usePathname();
  const needsOnboarding = data.profileState === "missing" || (data.profileState === "ready" && !data.profile?.onboardingCompletedAt);
  const free = ONBOARDING_FREE.includes(pathname);

  useEffect(() => {
    if (needsOnboarding && !free) router.replace("/bienvenida");
  }, [needsOnboarding, free, router]);

  if (pathname === "/bienvenida") return <>{children}</>;
  if (data.profileState === "loading" || (needsOnboarding && !free)) return <Splash text="Preparando tus datos…" />;
  return (
    <AppShell>
      {children}
      <AutoWeeklyReport />
    </AppShell>
  );
}

export function AppGate({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "signed_out" || status === "unconfigured") router.replace("/login");
  }, [status, router]);

  if (status === "unverified") return <VerifyEmail />;
  if (status !== "signed_in") return <Splash />;
  return (
    <DataProvider>
      <OnboardingGate>{children}</OnboardingGate>
    </DataProvider>
  );
}
