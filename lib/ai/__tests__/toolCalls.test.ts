import { describe, expect, it } from "vitest";
import { callArgs } from "../toolCalls";

describe("streamed function-call arguments", () => {
  it("uses the streamed JSON even when step.start sent an empty object", () => {
    expect(callArgs({ id: "1", name: "find_exercises", start: {}, delta: '{"muscle":"abs",' + '"place":"home"}' })).toEqual({ muscle: "abs", place: "home" });
  });
  it("falls back to the arguments sent at start", () => {
    expect(callArgs({ id: "1", name: "get_exercise_progress", start: { exercise: "plank" }, delta: "" })).toEqual({ exercise: "plank" });
  });
  it("never throws on broken JSON", () => {
    expect(callArgs({ id: "1", name: "x", delta: '{"a":' })).toEqual({});
  });
});
