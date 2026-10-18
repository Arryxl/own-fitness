"use client";

import { Dumbbell } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/components/providers/AuthProvider";
import { DataProvider, useData } from "@/components/providers/DataProvider";
import { AutoWeeklyReport } from "@/components/coach/AutoWeeklyReport";

function Splash({ text = "Cargando…" }: { text?: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4" role="status" aria-live="polite">
      <span className="flex size-16 animate-pulse items-center justify-center rounded-3xl bg-primary text-on-primary shadow-lg">
        <Dumbbell className="size-8 -rotate-30" />
      </span>
      <p className="text-sm font-medium text-muted">{text}</p>
    </div>
  );
}

function OnboardingGate({ children }: { children: ReactNode }) {
  const data = useData();
  const router = useRouter();
  const pathname = usePathname();
  const needsOnboarding = data.profileState === "missing";

  useEffect(() => {
    if (needsOnboarding && pathname !== "/bienvenida") router.replace("/bienvenida");
  }, [needsOnboarding, pathname, router]);

  if (pathname === "/bienvenida") return <>{children}</>;
  if (data.profileState === "loading" || needsOnboarding) return <Splash text="Preparando tus datos…" />;
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
    if (status === "signed_out" || status === "denied" || status === "unconfigured") router.replace("/login");
  }, [status, router]);

  if (status !== "signed_in") return <Splash />;
  return (
    <DataProvider>
      <OnboardingGate>{children}</OnboardingGate>
    </DataProvider>
  );
}
