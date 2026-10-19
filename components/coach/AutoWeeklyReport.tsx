"use client";

// Generates last week's AI report automatically when the app opens and a
// closed week with data has no report yet (spec 6: no cron on Hobby).
import { useEffect, useRef } from "react";
import { authedFetch, useAuth } from "@/components/providers/AuthProvider";
import { useData } from "@/components/providers/DataProvider";
import { addDays, todayISO, weekStart } from "@/lib/analytics/dates";
import { useAiEnabled } from "@/lib/hooks/useAi";

const KEY = "ironlog:auto-report:";

export function AutoWeeklyReport() {
  const { user } = useAuth();
  const data = useData();
  const tried = useRef(false);
  const ai = useAiEnabled();

  useEffect(() => {
    if (!ai.enabled || tried.current || !user || !data.ready || !navigator.onLine) return;
    const lastMonday = addDays(weekStart(todayISO()), -7);
    const lastSunday = addDays(lastMonday, 6);
    const hasData = data.workouts.some((w) => w.status === "completed" && w.date >= lastMonday && w.date <= lastSunday);
    const hasReport = data.reports.some((r) => r.type === "weekly" && r.periodStart === lastMonday);
    if (!hasData || hasReport) return;
    try {
      if (localStorage.getItem(KEY + lastMonday)) return;
      localStorage.setItem(KEY + lastMonday, String(Date.now()));
    } catch {
      /* storage unavailable */
    }
    tried.current = true;
    authedFetch(user, "/api/ai/report", { method: "POST", body: JSON.stringify({ periodStart: lastMonday, auto: true }) }).catch(() => {});
  }, [user, data.ready, data.workouts, data.reports, ai.enabled]);

  return null;
}
