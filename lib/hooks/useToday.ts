"use client";

import { useEffect, useState } from "react";
import { isoWeekKey, todayISO } from "@/lib/analytics/dates";

/** Today's local date, refreshed when the app regains focus (e.g. left open overnight). */
export function useToday(): { today: string; weekKey: string } {
  const [today, setToday] = useState(() => todayISO());
  useEffect(() => {
    const refresh = () => setToday(todayISO());
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    const t = setInterval(refresh, 60_000);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
      clearInterval(t);
    };
  }, []);
  return { today, weekKey: isoWeekKey(today) };
}
