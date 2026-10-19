// Function calls arrive in pieces over the Interactions stream: `step.start`
// may carry the arguments (often just `{}`) and `arguments_delta` events carry
// the JSON text. Joining both as strings ("{}{...}") breaks JSON.parse.

export interface ToolCall {
  id: string;
  name: string;
  start?: Record<string, unknown>;
  delta: string;
}

/** The streamed JSON wins when present; otherwise the arguments sent at start. */
export function callArgs(c: ToolCall): Record<string, unknown> {
  if (c.delta.trim()) {
    try {
      return JSON.parse(c.delta) as Record<string, unknown>;
    } catch {
      console.warn("tool", c.name, "unparseable arguments");
    }
  }
  return c.start ?? {};
}
