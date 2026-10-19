"use client";

import clsx from "clsx";
import { ArrowUp, Loader2, Sparkles, Wrench } from "lucide-react";
import { collection, limitToLast, onSnapshot, orderBy, query } from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import { authedFetch, useAuth } from "@/components/providers/AuthProvider";
import { useData } from "@/components/providers/DataProvider";
import { useOnline } from "@/components/AppShell";
import { todayISO } from "@/lib/analytics/dates";
import { useAiEnabled } from "@/lib/hooks/useAi";
import { getDb } from "@/lib/firebase/client";
import type { ChatMessage } from "@/lib/types";
import { RichText } from "./RichText";

const SUGGESTIONS = [
  "¿Voy bien esta semana?",
  "¿Estoy progresando en mis ejercicios de pecho y espalda?",
  "¿Qué ajusto en mi plan?",
  "Dame ideas de comida barata con mucha proteína",
  "¿Cuánta proteína debería comer?",
];

function useMessages(uid: string, chatId: string) {
  const [msgs, setMsgs] = useState<ChatMessage[]>([]);
  useEffect(() => {
    const q = query(collection(getDb(), "users", uid, "aiChats", chatId, "messages"), orderBy("ts", "asc"), limitToLast(60));
    return onSnapshot(q, (s) => setMsgs(s.docs.map((d) => ({ ...(d.data() as ChatMessage), id: d.id }))));
  }, [uid, chatId]);
  return msgs;
}

export function Chat({ onProposal }: { onProposal: () => void }) {
  const { user } = useAuth();
  const data = useData();
  const online = useOnline();
  const messages = useMessages(data.uid, "main");
  const [input, setInput] = useState("");
  const [pending, setPending] = useState<{ question: string; text: string; tools: string[]; error?: string; done?: boolean; lastId: string | null } | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, pending?.text]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || !user || (pending && !pending.done && !pending.error)) return;
    setInput("");
    setPending({ question: q, text: "", tools: [], lastId: messages.at(-1)?.id ?? null });
    try {
      const res = await authedFetch(user, "/api/ai/chat", { method: "POST", body: JSON.stringify({ message: q, chatId: "main", today: todayISO() }) });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "No se pudo contactar al coach.");
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const ev = JSON.parse(line) as { type: string; text?: string; label?: string; message?: string };
          if (ev.type === "text") setPending((p) => p && { ...p, text: p.text + (ev.text ?? "") });
          else if (ev.type === "tool") setPending((p) => p && { ...p, tools: [...p.tools, ev.label ?? ""] });
          else if (ev.type === "proposal") onProposal();
          else if (ev.type === "error") setPending((p) => p && { ...p, error: ev.message });
        }
      }
      // The server saved both messages; keep the bubble until the listener shows them.
      setPending((p) => p && { ...p, done: true });
    } catch (e) {
      setPending((p) => p && { ...p, error: (e as Error).message });
    }
  }

  // Hide the streaming bubble once the saved messages arrive through the listener.
  const visiblePending = pending && !(pending.done && !pending.error && messages.at(-1)?.role === "model" && messages.at(-1)?.id !== pending.lastId) ? pending : null;
  const ai = useAiEnabled();
  const disabled = !ai.enabled || !online;

  return (
    <div className="flex min-h-[60dvh] flex-col">
      <div className="flex-1 space-y-3" aria-live="polite">
        {messages.length === 0 && !visiblePending && (
          <div className="glass rounded-[var(--radius-card)] p-5 text-center">
            <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary-soft text-primary">
              <Sparkles className="size-6" />
            </span>
            <p className="mt-3 font-bold">Pregúntale a tu coach</p>
            <p className="mt-1 text-sm text-muted">Consulta tus datos reales (asistencia, cargas, peso, proteína) antes de responder. No da consejo médico.</p>
          </div>
        )}
        {messages.map((m) => (
          <Bubble key={m.id} role={m.role} text={m.text} tools={m.toolCalls} />
        ))}
        {visiblePending && (
          <>
            <Bubble role="user" text={visiblePending.question} />
            <div className="glass max-w-[92%] rounded-3xl rounded-bl-lg p-4 text-sm">
              {visiblePending.tools.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {visiblePending.tools.map((t, i) => (
                    <span key={i} className="inline-flex items-center gap-1 rounded-full bg-violet-soft px-2.5 py-1 text-xs font-semibold text-violet">
                      <Wrench className="size-3" /> {t}
                    </span>
                  ))}
                </div>
              )}
              {visiblePending.text ? (
                <RichText text={visiblePending.text} />
              ) : (
                !visiblePending.error && (
                  <span className="inline-flex items-center gap-2 text-muted">
                    <Loader2 className="size-4 animate-spin" /> Pensando…
                  </span>
                )
              )}
              {visiblePending.error && (
                <p className="mt-2 rounded-2xl bg-danger-soft px-3 py-2 text-danger" role="alert">
                  {visiblePending.error}{" "}
                  <button type="button" className="font-semibold underline" onClick={() => setPending(null)}>
                    Cerrar
                  </button>
                </p>
              )}
            </div>
          </>
        )}
        <div ref={endRef} />
      </div>

      <div className="sticky bottom-[calc(5.5rem+env(safe-area-inset-bottom))] mt-4 lg:bottom-4">
        {messages.length === 0 && !visiblePending && (
          <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
            {SUGGESTIONS.map((s) => (
              <button key={s} type="button" disabled={disabled} onClick={() => send(s)} className="glass min-h-10 shrink-0 rounded-full px-4 text-sm font-semibold disabled:opacity-50">
                {s}
              </button>
            ))}
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="glass flex items-end gap-2 rounded-[1.75rem] p-2"
        >
          <label htmlFor="coach-input" className="sr-only">
            Mensaje para el coach
          </label>
          <textarea
            id="coach-input"
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            placeholder={!ai.enabled ? "Coach desactivado" : online ? "Escribe tu pregunta…" : "Sin conexión"}
            disabled={disabled}
            maxLength={2000}
            className="max-h-40 min-h-12 flex-1 resize-none bg-transparent px-3 py-3 text-base outline-none placeholder:text-muted"
          />
          <button
            type="submit"
            aria-label="Enviar"
            disabled={disabled || !input.trim() || (!!pending && !pending.done && !pending.error)}
            className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary transition disabled:opacity-40"
          >
            {pending && !pending.done && !pending.error ? <Loader2 className="size-5 animate-spin" /> : <ArrowUp className="size-5" />}
          </button>
        </form>
      </div>
    </div>
  );
}

function Bubble({ role, text, tools }: { role: "user" | "model"; text: string; tools?: string[] }) {
  const mine = role === "user";
  return (
    <div className={clsx("flex", mine && "justify-end")}>
      <div
        className={clsx(
          "max-w-[92%] rounded-3xl p-4 text-sm",
          mine ? "rounded-br-lg bg-primary text-on-primary" : "glass rounded-bl-lg",
        )}
      >
        {mine ? <p className="whitespace-pre-wrap">{text}</p> : <RichText text={text} />}
        {!mine && tools && tools.length > 0 && <p className="mt-2 text-[0.7rem] text-muted">Datos consultados: {tools.length} herramienta(s)</p>}
      </div>
    </div>
  );
}
