"use client";

import clsx from "clsx";
import { CheckCircle2, CircleAlert, Info } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type Kind = "success" | "error" | "info";
interface ToastItem {
  id: number;
  text: string;
  kind: Kind;
}

const Ctx = createContext<(text: string, kind?: Kind) => void>(() => {});

// Lets non-React modules (write helpers) raise toasts.
const TOAST_EVENT = "ironlog:toast";
export function emitToast(text: string, kind: Kind = "info") {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: { text, kind } }));
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((text: string, kind: Kind = "info") => {
    const id = Date.now() + Math.random();
    setItems((xs) => [...xs.slice(-2), { id, text, kind }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), kind === "error" ? 6000 : 3200);
  }, []);

  useEffect(() => {
    const h = (e: Event) => {
      const { text, kind } = (e as CustomEvent<{ text: string; kind: Kind }>).detail;
      push(text, kind);
    };
    window.addEventListener(TOAST_EVENT, h);
    return () => window.removeEventListener(TOAST_EVENT, h);
  }, [push]);

  const value = useMemo(() => push, [push]);
  return (
    <Ctx.Provider value={value}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-4">
        {items.map((t) => (
          <div
            key={t.id}
            className={clsx(
              "animate-rise pointer-events-auto flex max-w-md items-center gap-2 rounded-2xl border border-line bg-surface-strong px-4 py-3 text-sm font-medium shadow-lg",
            )}
          >
            {t.kind === "success" && <CheckCircle2 className="size-5 shrink-0 text-primary" />}
            {t.kind === "error" && <CircleAlert className="size-5 shrink-0 text-danger" />}
            {t.kind === "info" && <Info className="size-5 shrink-0 text-violet" />}
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  return useContext(Ctx);
}
