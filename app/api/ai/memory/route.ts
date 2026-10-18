import { z } from "zod";
import { storeMemory } from "@/lib/ai/memory";
import { adminDb } from "@/lib/firebase/admin";
import { prepareAiRoute, toErrorResponse } from "@/lib/server/aiRoute";
import type { MemoryKind } from "@/lib/types";

export const maxDuration = 30;

// Confirms a pending memory suggested by the coach ({ id }), or adds a new one
// written by the user ({ text, kind }). Both get embedded for RAG.
const Body = z.union([
  z.object({ id: z.string().regex(/^[A-Za-z0-9_-]{1,40}$/) }),
  z.object({ text: z.string().trim().min(3).max(500), kind: z.enum(["insight", "preference", "injury", "goal", "note"]) }),
]);

export async function POST(req: Request) {
  try {
    const ctx = await prepareAiRoute(req, "memory");
    const parsed = Body.safeParse(ctx.body);
    if (!parsed.success) return Response.json({ error: "Solicitud inválida" }, { status: 400 });
    if ("id" in parsed.data) {
      const snap = await adminDb().doc(`users/${ctx.user.uid}/memories/${parsed.data.id}`).get();
      if (!snap.exists) return Response.json({ error: "No existe" }, { status: 404 });
      const m = snap.data() as { text: string; kind: MemoryKind; sourceRef?: string };
      const id = await storeMemory(ctx.user.uid, { id: snap.id, text: m.text, kind: m.kind, sourceRef: m.sourceRef ?? "coach" });
      return Response.json({ id });
    }
    const id = await storeMemory(ctx.user.uid, { text: parsed.data.text, kind: parsed.data.kind, sourceRef: "user" });
    return Response.json({ id });
  } catch (e) {
    return toErrorResponse(e);
  }
}
