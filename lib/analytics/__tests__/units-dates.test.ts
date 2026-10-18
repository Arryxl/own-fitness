import { describe, expect, it } from "vitest";
import { addDays, isoWeekKey, isoWeekday, lastWeekStarts, weekStart } from "../dates";
import { formatWeight, fromKg, kgToLb, lbToKg, roundToStep, toKg } from "../units";

describe("units", () => {
  it("converts lb ↔ kg with the exact factor", () => {
    expect(lbToKg(1)).toBe(0.45359237);
    expect(lbToKg(30)).toBeCloseTo(13.6078, 4);
    expect(kgToLb(lbToKg(40))).toBeCloseTo(40, 10);
    expect(toKg(10, "kg")).toBe(10);
    expect(fromKg(lbToKg(25), "lb")).toBeCloseTo(25, 10);
  });

  it("rounds to plate/dumbbell steps", () => {
    expect(roundToStep(23.4, 2.5)).toBe(22.5);
    expect(roundToStep(23.8, 2.5)).toBe(25);
    expect(roundToStep(7, 0)).toBe(7);
  });

  it("formats in the exercise's unit", () => {
    expect(formatWeight(lbToKg(30), "lb")).toBe("30 lb");
    expect(formatWeight(10, "kg")).toBe("10 kg");
    expect(formatWeight(null, "kg")).toBe("—");
  });
});

describe("dates", () => {
  it("computes ISO weekdays and week starts", () => {
    expect(isoWeekday("2026-10-19")).toBe(1); // Monday
    expect(isoWeekday("2026-10-18")).toBe(7); // Sunday
    expect(weekStart("2026-10-18")).toBe("2026-10-12");
    expect(weekStart("2026-10-19")).toBe("2026-10-19");
  });

  it("computes ISO week keys across year boundaries", () => {
    expect(isoWeekKey("2026-10-18")).toBe("2026-W42");
    expect(isoWeekKey("2027-01-01")).toBe("2026-W53");
    expect(isoWeekKey("2024-12-30")).toBe("2025-W01");
  });

  it("adds days across months and lists week starts", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(lastWeekStarts("2026-10-18", 3)).toEqual(["2026-09-28", "2026-10-05", "2026-10-12"]);
  });
});
