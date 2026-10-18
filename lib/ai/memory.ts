import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import type { MemoryKind } from "@/lib/types";
import { MODELS, ai } from "./client";

// RAG over the user's memories (section 7.4). gemini-embedding-2 takes no
// task_type: the purpose goes in the text prefix. 768-dim vectors come back
// normalized, so cosine similarity is a plain dot product.
export const EMBED_DIMS = 768;
const MAX_SCAN = 500;

const KIND_TITLE: Record<MemoryKind, string> = {
  insight: "Conclusión del coach",
  preference: "Preferencia",
  injury: "Lesión o molestia",
  goal: "Objetivo",
  note: "Nota",
};

export async function embed(text: string, mode: "query" | "document", title?: string): Promise<number[]> {
  const contents = mode === "query" ? `task: search result | query: ${text}` : `title: ${title ?? "nota"} | text: ${text}`;
  const res = await ai().models.embedContent({
    model: MODELS.embedding,
    contents,
    config: { outputDimensionality: EMBED_DIMS },
  });
  const v = res.embeddings?.[0]?.values;
  if (!v || v.length !== EMBED_DIMS) throw new Error("Embedding vacío");
  return v;
}

function dot(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

function norm(a: number[]): number {
  return Math.sqrt(dot(a, a)) || 1;
}

/** Embeds and stores a memory as confirmed. If `id` exists (a pending suggestion) it is confirmed in place. */
export async function storeMemory(uid: string, input: { id?: string; text: string; kind: MemoryKind; sourceRef: string }): Promise<string> {
  const vector = await embed(input.text, "document", KIND_TITLE[input.kind]);
  const col = adminDb().collection(`users/${uid}/memories`);
  const ref = input.id ? col.doc(input.id) : col.doc();
  await ref.set(
    {
      text: input.text,
      kind: input.kind,
      sourceRef: input.sourceRef,
      createdAt: Date.now(),
      status: "saved",
      embedding: FieldValue.vector(vector),
    },
    { merge: true },
  );
  return ref.id;
}

export async function searchMemories(uid: string, query: string, k: number) {
  const snap = await adminDb()
    .collection(`users/${uid}/memories`)
    .orderBy("createdAt", "desc")
    .limit(MAX_SCAN)
    .get();
  const docs = snap.docs.filter((d) => d.get("status") === "saved");
  if (docs.length === 0) return [];
  const q = await embed(query, "query");
  const qn = norm(q);
  return docs
    .map((d) => {
      const v = (d.get("embedding") as { toArray(): number[] } | undefined)?.toArray();
      if (!v || v.length !== q.length) return null;
      return { id: d.id, text: d.get("text") as string, kind: d.get("kind") as string, createdAt: d.get("createdAt") as number, score: dot(q, v) / (qn * norm(v)) };
    })
    .filter((x): x is NonNullable<typeof x> => !!x)
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((m) => ({ ...m, score: Math.round(m.score * 1000) / 1000, date: new Date(m.createdAt).toISOString().slice(0, 10) }));
}
