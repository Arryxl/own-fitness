import { describe, expect, it } from "vitest";
import type { BodyMetric, Meal } from "@/lib/types";
import { dailyMeans, measurementChange, movingAverage7d, weightTrend } from "../bodyweight";
import { copPer25gProtein, nutritionSummary, proteinRange, proteinTarget, sortByProteinCost } from "../nutrition";

const at = (date: string, hour: number) => new Date(`${date}T${String(hour).padStart(2, "0")}:00:00`).getTime();
const bm = (date: string, weightKg: number, hour = 7): BodyMetric => ({ id: date + hour, ts: at(date, hour), weightKg, notes: "" });

describe("body weight", () => {
  it("averages several weigh-ins in the same day", () => {
    const d = dailyMeans([bm("2026-10-01", 74, 7), bm("2026-10-01", 75, 20), bm("2026-10-02", 73.5)], "weightKg");
    expect(d).toEqual([
      { date: "2026-10-01", value: 74.5 },
      { date: "2026-10-02", value: 73.5 },
    ]);
  });

  it("computes a 7-day moving average", () => {
    const days = Array.from({ length: 10 }, (_, i) => ({ date: `2026-10-${String(i + 1).padStart(2, "0")}`, value: 70 + i }));
    const ma = movingAverage7d(days);
    expect(ma[0].value).toBe(70);
    expect(ma[9].value).toBe(76); // mean of 73..79
  });

  it("estimates weekly rate and % of body weight", () => {
    const days = Array.from({ length: 15 }, (_, i) => ({ date: `2026-10-${String(i + 1).padStart(2, "0")}`, value: 74 + i * 0.05 }));
    const t = weightTrend(days);
    expect(t.ratePerWeek).toBeCloseTo(0.35, 2);
    expect(t.pctPerWeek).toBeGreaterThan(0.4);
    expect(t.pctPerWeek).toBeLessThan(0.5);
  });

  it("refuses a rate with less than a week of data", () => {
    expect(weightTrend([{ date: "2026-10-01", value: 74 }, { date: "2026-10-03", value: 74.4 }]).ratePerWeek).toBeNull();
    expect(weightTrend([]).latest).toBeNull();
  });

  it("reports measurement change", () => {
    expect(measurementChange([{ date: "a", value: 90 }, { date: "b", value: 88.6 }]).change).toBe(-1.4);
  });
});

describe("nutrition", () => {
  it("derives the 1.6-2.2 g/kg range", () => {
    expect(proteinRange(74)).toEqual({ min: 118, max: 163 });
    expect(proteinRange(null)).toBeNull();
    expect(proteinTarget(null, 74)).toBe(118);
    expect(proteinTarget(130, 74)).toBe(130);
  });

  it("summarizes days hitting the target", () => {
    const meal = (date: string, proteinG: number): Meal => ({ id: date + proteinG, ts: 0, date, text: "", items: [], proteinG, source: "manual" });
    const s = nutritionSummary([meal("d1", 60), meal("d1", 70), meal("d2", 90)], 120);
    expect(s.daysLogged).toBe(2);
    expect(s.daysHitTarget).toBe(1);
    expect(s.hitRatePct).toBe(50);
    expect(s.avgProteinG).toBe(110);
  });

  it("computes COP per 25 g protein and sorts cheapest first", () => {
    expect(copPer25gProtein({ priceCop: 18000, priceQty: 30, proteinG: 6 })).toBe(2500);
    expect(copPer25gProtein({ priceCop: null, priceQty: 1, proteinG: 6 })).toBeNull();
    const sorted = sortByProteinCost([
      { name: "B", priceCop: 10000, priceQty: 1, proteinG: 25 },
      { name: "Sin precio", priceCop: null, priceQty: null, proteinG: 10 },
      { name: "A", priceCop: 5000, priceQty: 1, proteinG: 25 },
    ]);
    expect(sorted.map((f) => f.name)).toEqual(["A", "B", "Sin precio"]);
  });
});
