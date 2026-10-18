import "server-only";
import type { z } from "zod";
import { AI_DEADLINE_MS, AiError, ai, deadlineSignal, withModelFallback } from "./client";
import { jsonSchema, parseStructured } from "./schemas";

/** One-shot JSON generation validated with Zod; retries once if the output doesn't validate. */
export async function generateStructured<T>(args: {
  system: string;
  input: string;
  schema: z.ZodType<T>;
  deadline?: number;
  temperature?: number;
}): Promise<{ data: T; model: string }> {
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
    const data = parseStructured(args.schema, result.output_text);
    if (data) return { data, model };
    if (Date.now() > deadline - 8000) break;
  }
  throw new AiError("bad_output", "La IA devolvió una respuesta con formato inválido. Intenta de nuevo.");
}
