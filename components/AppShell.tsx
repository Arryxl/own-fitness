"use client";

import clsx from "clsx";
import {
  Apple,
  BookOpen,
  UserCog,
  BarChart3,
  CalendarDays,
  CloudOff,
  Dumbbell,
  Footprints,
  History,
  House,
  LayoutGrid,
  ListChecks,
  RefreshCw,
  Ruler,
  Settings,
  Sparkles,
  Trophy,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore, type ReactNode } from "react";
import { useOptionalData } from "@/components/providers/DataProvider";
import { useAuth } from "@/components/providers/AuthProvider";

const PRIMARY = [
  { href: "/", label: "Hoy", icon: House },
  { href: "/entrenar", label: "Entrenar", icon: Dumbbell },
  { href: "/progreso", label: "Progreso", icon: BarChart3 },
  { href: "/coach", label: "Coach", icon: Sparkles },
];

export const SECONDARY = [
  { href: "/rutinas", label: "Rutinas", icon: BookOpen, desc: "Biblioteca de programas reconocidos" },
  { href: "/medidas", label: "Peso y medidas", icon: Ruler, desc: "Peso, cintura, pecho, brazo" },
  { href: "/actividad", label: "Pasos y caminata", icon: Footprints, desc: "Cardio ligero diario" },
  { href: "/nutricion", label: "Nutrición", icon: Apple, desc: "Proteína, comidas, presupuesto" },
  { href: "/historial", label: "Historial", icon: History, desc: "Sesiones y asistencia" },
  { href: "/planes", label: "Planes", icon: CalendarDays, desc: "Plantillas 3 y 4 días" },
  { href: "/ejercicios", label: "Ejercicios", icon: ListChecks, desc: "Catálogo y alternativas" },
  { href: "/marcas", label: "Mis marcas", icon: Trophy, desc: "Cargas iniciales y récords" },
  { href: "/ajustes", label: "Ajustes", icon: Settings, desc: "Perfil, respaldo, privacidad" },
];

function subscribeOnline(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
}

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
}

function SyncPill() {
  const online = useOnline();
  const data = useOptionalData();
  if (!online)
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-soft px-3 py-1 text-xs font-semibold text-amber" role="status">
        <CloudOff className="size-3.5" /> Sin conexión · se guarda en el teléfono
      </span>
    );
  if (data?.hasPendingWrites)
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary-strong" role="status">
        <RefreshCw className="size-3.5 animate-spin" /> Sincronizando…
      </span>
    );
  return null;
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { isAdmin } = useAuth();
  const moreActive = SECONDARY.some((s) => isActive(pathname, s.href)) || pathname === "/mas";

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[17rem_1fr]">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-xl focus:bg-surface-strong focus:p-3">
        Saltar al contenido
      </a>

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh flex-col gap-1 overflow-y-auto border-r border-line bg-surface p-4 backdrop-blur-xl lg:flex">
        <Link href="/" className="mb-4 flex items-center gap-2.5 px-2 py-1">
          <span className="flex size-10 items-center justify-center rounded-2xl bg-primary text-on-primary shadow-sm">
            <Dumbbell className="size-5 -rotate-30" />
          </span>
          <span className="text-lg font-extrabold tracking-tight">IronLog</span>
        </Link>
        {PRIMARY.map((n) => (
          <SideLink key={n.href} {...n} active={isActive(pathname, n.href)} />
        ))}
        <div className="mx-2 my-3 h-px bg-line" />
        {SECONDARY.map((n) => (
          <SideLink key={n.href} {...n} active={isActive(pathname, n.href)} />
        ))}
        {isAdmin && <SideLink href="/admin" label="Administración" icon={UserCog} active={isActive(pathname, "/admin")} />}
        <div className="mt-auto px-2 pt-4">
          <SyncPill />
        </div>
      </aside>

      <div className="min-w-0">
        <div className="sticky top-0 z-30 flex justify-center px-4 pt-[max(0.5rem,env(safe-area-inset-top))] empty:hidden lg:hidden">
          <SyncPill />
        </div>
        <main id="main" className="pb-nav mx-auto w-full max-w-6xl px-4 pt-4 sm:px-6 lg:px-8 lg:pt-8">
          {children}
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <nav aria-label="Principal" className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden">
        <div className="glass mx-auto flex max-w-md items-stretch justify-between rounded-[1.75rem] px-1.5 py-1.5">
          {[...PRIMARY, { href: "/mas", label: "Más", icon: LayoutGrid }].map((n) => {
            const active = n.href === "/mas" ? moreActive : isActive(pathname, n.href);
            const Icon = n.icon;
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={clsx(
                  "flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl text-[0.7rem] font-semibold transition",
                  active ? "bg-primary-soft text-primary-strong" : "text-muted hover:text-ink",
                )}
              >
                <Icon className="size-[1.35rem]" strokeWidth={active ? 2.4 : 2} />
                {n.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function SideLink({ href, label, icon: Icon, active }: { href: string; label: string; icon: typeof House; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={clsx(
        "flex min-h-11 items-center gap-3 rounded-2xl px-3 text-sm font-semibold transition",
        active ? "bg-primary text-on-primary shadow-sm" : "text-muted hover:bg-sunken hover:text-ink",
      )}
    >
      <Icon className="size-5" />
      {label}
    </Link>
  );
}

