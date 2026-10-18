"use client";

import { Brain, Check, Loader2, Trash2, X } from "lucide-react";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { useEffect, useState } from "react";
import { useData } from "@/components/providers/DataProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { Badge, Button, Card, CardHeader, EmptyState, IconButton, Select, TextArea } from "@/components/ui";
import { removeDoc } from "@/lib/db/write";
import { isDemo } from "@/lib/demo";
import { getDb } from "@/lib/firebase/client";
import { useAiPost } from "@/lib/hooks/useAi";
import type { Memory, MemoryKind } from "@/lib/types";

export const KIND_LABEL: Record<MemoryKind, string> = {
  insight: "Conclusión",
  preference: "Preferencia",
  injury: "Lesión / molestia",
  goal: "Objetivo",
  note: "Nota",
};

function useSavedMemories(uid: string) {
  const [list, setList] = useState<Memory[]>([]);
  useEffect(() => {
    if (isDemo) return;
    const q = query(collection(getDb(), "users", uid, "memories"), orderBy("createdAt", "desc"), limit(100));
    return onSnapshot(q, (s) =>
      setList(
        s.docs
          .map((d) => {
            const { embedding: _e, ...rest } = d.data();
            void _e;
            return { ...(rest as Memory), id: d.id };
          })
          .filter((m) => m.status === "saved"),
      ),
    );
  }, [uid]);
  return list;
}

/** Coach suggestions waiting for confirmation (spec: memories need on-screen approval). */
export function PendingMemories() {
  const data = useData();
  const post = useAiPost();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  if (data.pendingMemories.length === 0) return null;
  return (
    <Card className="border-violet/30">
      <CardHeader title="El coach sugiere recordar" subtitle="Se usará como contexto en próximas respuestas" />
      <ul className="space-y-2">
        {data.pendingMemories.map((m) => (
          <li key={m.id} className="flex items-start gap-2 rounded-2xl bg-violet-soft p-3 text-sm">
            <Brain className="mt-0.5 size-4 shrink-0 text-violet" />
            <span className="min-w-0 flex-1">
              <Badge tone="violet">{KIND_LABEL[m.kind]}</Badge>
              <span className="mt-1 block">{m.text}</span>
            </span>
            <IconButton
              label="Guardar"
              className="size-10 text-primary"
              disabled={!!busy}
              onClick={async () => {
                setBusy(m.id);
                try {
                  await post("/api/ai/memory", { id: m.id });
                  toast("Guardado en la memoria del coach", "success");
                } catch (e) {
                  toast((e as Error).message, "error");
                } finally {
                  setBusy(null);
                }
              }}
            >
              {busy === m.id ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-5" />}
            </IconButton>
            <IconButton label="Descartar" className="size-10 text-muted" onClick={() => removeDoc(data.uid, "memories", m.id)}>
              <X className="size-5" />
            </IconButton>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function Memories() {
  const data = useData();
  const post = useAiPost();
  const toast = useToast();
  const list = useSavedMemories(data.uid);
  const [text, setText] = useState("");
  const [kind, setKind] = useState<MemoryKind>("injury");
  const [saving, setSaving] = useState(false);

  return (
    <div className="space-y-4">
      <PendingMemories />
      <Card>
        <CardHeader title="Añadir a la memoria" subtitle="Lesiones, preferencias u objetivos que el coach debe tener en cuenta" />
        <div className="space-y-3">
          <Select aria-label="Tipo" value={kind} onChange={(e) => setKind(e.target.value as MemoryKind)}>
            {Object.entries(KIND_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
          <TextArea aria-label="Texto" placeholder="Ej.: me molesta el hombro derecho en press por encima de la cabeza" value={text} onChange={(e) => setText(e.target.value)} maxLength={500} />
          <Button
            disabled={text.trim().length < 3 || saving}
            onClick={async () => {
              setSaving(true);
              try {
                await post("/api/ai/memory", { text, kind });
                setText("");
                toast("Guardado", "success");
              } catch (e) {
                toast((e as Error).message, "error");
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving && <Loader2 className="size-4 animate-spin" />} Guardar
          </Button>
        </div>
      </Card>
      <Card>
        <CardHeader title="Lo que el coach recuerda" />
        {list.length === 0 ? (
          <EmptyState icon={<Brain className="size-6" />} title="Memoria vacía" />
        ) : (
          <ul className="divide-y divide-line">
            {list.map((m) => (
              <li key={m.id} className="flex min-h-14 items-start gap-2 py-2 text-sm">
                <span className="min-w-0 flex-1">
                  <Badge>{KIND_LABEL[m.kind]}</Badge>
                  <span className="mt-1 block">{m.text}</span>
                </span>
                <IconButton label="Borrar" className="size-10 text-muted" onClick={() => removeDoc(data.uid, "memories", m.id)}>
                  <Trash2 className="size-4" />
                </IconButton>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
