import { z } from "zod";
import { AI_DEADLINE_MS, MODELS, ai, classify, deadlineSignal, withModelFallback } from "@/lib/ai/client";
import { AI_FAKE, FAKE_CHAT_REPLY } from "@/lib/ai/fake";
import { COACH_PROMPT_VERSION } from "@/lib/ai/prompts/coach.v2";
import { coachPromptFor } from "@/lib/ai/prompts/summary";
import { recordTokens } from "@/lib/ai/rate-limit";
import { TOOL_LABELS, runTool, toolDeclarations } from "@/lib/ai/tools";
import { adminDb } from "@/lib/firebase/admin";
import { prepareAiRoute, toErrorResponse } from "@/lib/server/aiRoute";

export const maxDuration = 60;

const MAX_TOOL_ROUNDS = 6;
const HISTORY_MESSAGES = 12;

const Body = z.object({
  chatId: z.string().regex(/^[A-Za-z0-9_-]{1,40}$/).default("main"),
  message: z.string().trim().min(1).max(2000),
});

type Step = { type: string; [k: string]: unknown };

/** The subset of Interactions SSE events we consume (see the streaming docs). */
interface StreamEvent {
  event_type: string;
  index: number;
  interaction?: { id?: string; usage?: { total_tokens?: number } };
  step?: { type: string; id: string; name: string; arguments?: Record<string, unknown> };
  delta?: { type: string; text?: string; arguments?: string };
  error?: { message?: string; code?: number };
}

export async function POST(req: Request) {
  let ctx;
  try {
    ctx = await prepareAiRoute(req, "chat");
  } catch (e) {
    return toErrorResponse(e);
  }
  const parsed = Body.safeParse(ctx.body);
  if (!parsed.success) return Response.json({ error: "Mensaje inválido" }, { status: 400 });
  const { chatId, message } = parsed.data;
  const { user, data, today } = ctx;
  const deadline = Date.now() + AI_DEADLINE_MS;

  const chatRef = adminDb().doc(`users/${user.uid}/aiChats/${chatId}`);
  const [historySnap, system] = await Promise.all([chatRef.collection("messages").orderBy("ts", "desc").limit(HISTORY_MESSAGES).get(), coachPromptFor(data)]);
  void today;

  // Our own chat history (Firestore) is replayed as plain text turns; Gemini's
  // stored interactions are only used to chain tool calls within this request.
  const history: Step[] = historySnap.docs
    .reverse()
    .map((d) => d.data())
    .filter((m) => typeof m.text === "string" && m.text)
    .map((m) => (m.role === "user" ? { type: "user_input", content: [{ type: "text", text: m.text }] } : { type: "model_output", content: [{ type: "text", text: m.text }] }));
  const tools = toolDeclarations();

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (o: unknown) => controller.enqueue(encoder.encode(JSON.stringify(o) + "\n"));
      let text = "";
      const toolsUsed: string[] = [];
      let model = MODELS.primary;
      let tokens = 0;
      try {
        if (AI_FAKE) {
          text = FAKE_CHAT_REPLY;
          model = "fake";
          send({ type: "text", text });
        }
        let input: Step[] = [...history, { type: "user_input", content: [{ type: "text", text: message }] }];
        let previous: string | undefined;
        for (let round = 0; round < (AI_FAKE ? 0 : MAX_TOOL_ROUNDS); round++) {
          const params = {
            system_instruction: system,
            input,
            tools,
            stream: true as const,
            previous_interaction_id: previous,
            generation_config: { tool_choice: "auto", thinking_level: "low" as const },
          };
          // First call may fall back to the backup model; later rounds stay on the same model.
          const events =
            round === 0
              ? await withModelFallback((m) => ai().interactions.create({ ...params, model: m } as never, { signal: deadlineSignal(deadline) }), { deadline }).then((r) => {
                  model = r.model;
                  return r.result;
                })
              : await ai().interactions.create({ ...params, model } as never, { signal: deadlineSignal(deadline) });

          const calls = new Map<number, { id: string; name: string; args: string }>();
          let interactionId: string | undefined;
          let roundText = "";
          for await (const ev of events as unknown as AsyncIterable<StreamEvent>) {
            switch (ev.event_type) {
              case "interaction.created":
                interactionId = ev.interaction?.id;
                break;
              case "step.start":
                if (ev.step?.type === "function_call") {
                  calls.set(ev.index, { id: ev.step.id, name: ev.step.name, args: ev.step.arguments ? JSON.stringify(ev.step.arguments) : "" });
                }
                break;
              case "step.delta":
                if (ev.delta?.type === "text" && ev.delta.text) {
                  if (!roundText && text) {
                    text += "\n\n";
                    send({ type: "text", text: "\n\n" });
                  }
                  roundText += ev.delta.text;
                  text += ev.delta.text;
                  send({ type: "text", text: ev.delta.text });
                } else if (ev.delta?.type === "arguments_delta") {
                  const c = calls.get(ev.index);
                  if (c && typeof ev.delta.arguments === "string") c.args += ev.delta.arguments;
                }
                break;
              case "interaction.completed":
                interactionId ??= ev.interaction?.id;
                tokens += ev.interaction?.usage?.total_tokens ?? 0;
                break;
              case "error":
                throw Object.assign(new Error(ev.error?.message ?? "error"), { status: ev.error?.code });
              default:
                break; // new event types may appear: ignore
            }
          }

          if (calls.size === 0 || !interactionId) break;
          const results = await Promise.all(
            [...calls.values()].map(async (c) => {
              toolsUsed.push(c.name);
              send({ type: "tool", name: c.name, label: TOOL_LABELS[c.name] ?? c.name });
              let args: unknown = {};
              try {
                args = c.args ? JSON.parse(c.args) : {};
              } catch {
                args = {};
              }
              const out = await runTool(c.name, args, { data });
              if (c.name === "propose_plan_change" && (out as { ok?: boolean }).ok) send({ type: "proposal" });
              if (c.name === "save_memory" && (out as { ok?: boolean }).ok) send({ type: "memory" });
              return { type: "function_result", name: c.name, call_id: c.id, result: [{ type: "text", text: JSON.stringify(out) }] };
            }),
          );
          input = results;
          previous = interactionId;
          if (round === MAX_TOOL_ROUNDS - 1) {
            const note = "\n\n_(Alcancé el máximo de consultas para esta respuesta; pregúntame de nuevo para profundizar.)_";
            text += note;
            send({ type: "text", text: note });
          }
        }

        if (!text.trim()) {
          text = "No pude generar una respuesta. Intenta reformular la pregunta.";
          send({ type: "text", text });
        }
        const now = Date.now();
        const batch = adminDb().batch();
        batch.set(chatRef, { updatedAt: now, title: message.slice(0, 60) }, { merge: true });
        batch.set(chatRef.collection("messages").doc(), { role: "user", text: message, ts: now - 1, toolCalls: [] });
        batch.set(chatRef.collection("messages").doc(), { role: "model", text, ts: now, toolCalls: [...new Set(toolsUsed)], model, prompt: COACH_PROMPT_VERSION });
        await batch.commit();
        await recordTokens(user.uid, tokens);
        send({ type: "done" });
      } catch (e) {
        const err = classify(e);
        console.error("chat error:", err.kind);
        await recordTokens(user.uid, tokens);
        send({ type: "error", message: err.message, partial: text.length > 0 });
        if (text.trim()) {
          // Keep what was already said so nothing is lost.
          const now = Date.now();
          await Promise.all([
            chatRef.collection("messages").add({ role: "user", text: message, ts: now - 1, toolCalls: [] }),
            chatRef.collection("messages").add({ role: "model", text: `${text}\n\n_(respuesta interrumpida)_`, ts: now, toolCalls: toolsUsed }),
          ]).catch(() => {});
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" },
  });
}
