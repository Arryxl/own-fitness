"use client";

import { ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Chat } from "@/components/coach/Chat";
import { Memories, PendingMemories } from "@/components/coach/Memories";
import { Proposals } from "@/components/coach/Proposals";
import { Reports } from "@/components/coach/Reports";
import { PageHeader, Segmented } from "@/components/ui";
import { useAiEnabled } from "@/lib/hooks/useAi";

type Tab = "chat" | "reports" | "memory";

export default function CoachPage() {
  const [tab, setTab] = useState<Tab>("chat");
  const ai = useAiEnabled();
  return (
    <div className="animate-rise space-y-4">
      <PageHeader title="Coach IA" subtitle="Analiza tus datos reales; tú apruebas cualquier cambio" />
      {!ai.enabled && (
        <p className="flex items-start gap-2 rounded-2xl bg-amber-soft px-4 py-3 text-sm text-amber">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" /> El coach está desactivado.{" "}
          <Link href="/ajustes#ia" className="font-semibold underline">
            Actívalo en Ajustes
          </Link>{" "}
          si aceptas que tus métricas se envíen a Gemini.
        </p>
      )}
      <Proposals />
      {tab !== "memory" && <PendingMemories />}
      <Segmented
        label="Sección del coach"
        value={tab}
        onChange={setTab}
        options={[
          { value: "chat", label: "Chat" },
          { value: "reports", label: "Informes" },
          { value: "memory", label: "Memoria" },
        ]}
      />
      <div className="mx-auto max-w-3xl">
        {tab === "chat" && <Chat onProposal={() => {}} />}
        {tab === "reports" && <Reports />}
        {tab === "memory" && <Memories />}
      </div>
      <p className="text-center text-xs text-muted">
        Usa la capa gratuita de Gemini: Google puede usar el contenido para mejorar sus productos. Solo se envían métricas, nunca tu nombre ni tu email. No es consejo médico.
      </p>
    </div>
  );
}
