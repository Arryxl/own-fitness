import "server-only";
import type { z } from "zod";
import { AI_DEADLINE_MS, AiError, ai, deadlineSignal, withModelFallback } from "./client";
import { AI_FAKE, fakeStructured } from "./fake";
import { recordTokens } from "./rate-limit";
import { jsonSchema, parseStructured } from "./schemas";

/** One-shot JSON generation validated with Zod; retries once if the output doesn't validate. */
export async function generateStructured<T>(args: {
  uid: string;
  system: string;
  input: string;
  schema: z.ZodType<T>;
  deadline?: number;
  temperature?: number;
}): Promise<{ data: T; model: string }> {
  if (AI_FAKE) return { data: args.schema.parse(fakeStructured(args.schema)), model: "fake" };
  const deadline = args.deadline ?? Date.now() + AI_DEADLINE_MS;
  for (let attempt = 0; attempt < 2; attempt++) {
    const { result, model } = await withModelFallback(
      (m) =>
        ai().interactions.create(
          {
            model: m,
            system_instruction: args.system,
            input: args.input,
            store: false,
            response_format: { type: "text", mime_type: "application/json", schema: jsonSchema(args.schema) },
            generation_config: { thinking_level: "low", temperature: args.temperature ?? 0.4 },
          },
          { signal: deadlineSignal(deadline) },
        ),
      { deadline },
    );
    await recordTokens(args.uid, (result as { usage?: { total_tokens?: number } }).usage?.total_tokens);
    const data = parseStructured(args.schema, result.output_text);
    if (data) return { data, model };
    if (Date.now() > deadline - 8000) break;
  }
  throw new AiError("bad_output", "La IA devolvió una respuesta con formato inválido. Intenta de nuevo.");
}
