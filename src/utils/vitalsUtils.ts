import { type DailyVitals } from "../models/types.ts";

export interface VitalsDay {
  date: string;
  vitals: DailyVitals;
}

/**
 * Gets the last N days of vitals including today.
 */
export function getRecentVitals(
  dailyVitals: Record<string, DailyVitals>,
  days: number = 7,
): VitalsDay[] {
  const result: VitalsDay[] = [];
  const today = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];

    result.push({
      date: dateStr,
      vitals: dailyVitals[dateStr] || { water: 0, sleep: 0, updatedAt: "" },
    });
  }

  return result;
}

/**
 * Returns analysis text and color for sleep
 */
export function analyzeSleep(
  hours: number,
): { color: string; status: string; description: string } {
  if (hours < 5) {
    return {
      color: "rose",
      status: "Bristfällig",
      description:
        "För lite sömn kan sänka din förbränning och öka hungerhormoner.",
    };
  }
  if (hours < 8) {
    return {
      color: "amber",
      status: "Rimlig",
      description: "Bra, men sök 8h för optimal återhämtning.",
    };
  }
  return {
    color: "emerald",
    status: "Optimal",
    description: "Utmärkt sömn! Din kropp har de bästa förutsättningarna.",
  };
}
