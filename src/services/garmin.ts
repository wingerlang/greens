import {
  ActivitySource,
  SleepSession,
  UniversalActivity,
} from "../models/types.ts";

// Mock implementation for Garmin Service since we don't have a real API key yet
// This service will be responsible for syncing data from Garmin Connect (simulated or real)

const MOCK_GARMIN_SLEEP: SleepSession[] = [
  {
    id: "garmin_sleep_1",
    date: "2025-12-24",
    startTime: "2025-12-23T23:00:00Z",
    endTime: "2025-12-24T07:15:00Z",
    durationSeconds: 29700, // 8h 15m
    score: 88,
    source: "garmin",
    stages: {
      deepSeconds: 5400, // 1.5h
      lightSeconds: 18000, // 5h
      remSeconds: 4500, // 1.25h
      awakeSeconds: 1800, // 30m
    },
    efficiency: 94,
  },
];

export const garminService = {
  async syncSleepData(
    startDate: string,
    endDate: string,
  ): Promise<SleepSession[]> {
    console.log(`[Garmin] Syncing sleep from ${startDate} to ${endDate}...`);
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 800));
    return MOCK_GARMIN_SLEEP.filter((s) =>
      s.date >= startDate && s.date <= endDate
    );
  },

  async syncActivities(
    startDate: string,
    endDate: string,
  ): Promise<UniversalActivity[]> {
    console.log(
      `[Garmin] Syncing activities from ${startDate} to ${endDate}...`,
    );
    return [];
  },
};
