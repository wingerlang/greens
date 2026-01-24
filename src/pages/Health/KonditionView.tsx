import React, { useMemo, useState } from "react";
import { ExerciseEntry, UniversalActivity } from "../../models/types.ts";
import { mapUniversalToLegacyEntry } from "../../utils/mappers.ts";
import {
  WeeklyDistanceChart,
  WeeklyDistanceData,
} from "../../components/cardio/WeeklyDistanceChart.tsx";
import { ActivityBreakdown } from "../../components/cardio/ActivityBreakdown.tsx";
import { ConditioningStreaks } from "../../components/cardio/ConditioningStreaks.tsx";

interface KonditionViewProps {
  filterStartDate?: string | null;
  filterEndDate?: string | null;
  exerciseEntries: ExerciseEntry[];
  universalActivities: UniversalActivity[];
}

export function KonditionView(
  { filterStartDate, filterEndDate, exerciseEntries, universalActivities }:
    KonditionViewProps,
) {
  // Filter cardio-related exercises
  const cardioTypes = [
    "running",
    "cycling",
    "swimming",
    "walking",
    "hiking",
    "cardio",
    "löpning",
    "cykling",
    "simning",
    "promenad",
    "run",
    "ride",
    "swim",
    "walk",
    "hike",
  ];

  // Combine exerciseEntries (manual) with universalActivities (Strava)
  const allEntries = useMemo(() => {
    // Map universal activities to exercise entries
    const stravaEntries = universalActivities
      .map(mapUniversalToLegacyEntry)
      .filter((e): e is ExerciseEntry => e !== null);

    // Combine and dedupe by date+type
    const combined = [...exerciseEntries, ...stravaEntries];
    const seen = new Set<string>();
    return combined.filter((e) => {
      const key = `${e.date}-${e.type}-${e.distance}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [exerciseEntries, universalActivities]);

  const filteredEntries = useMemo(() => {
    return allEntries
      .filter((e) => {
        const isCardio = cardioTypes.some((t) =>
          e.type.toLowerCase().includes(t)
        );
        if (!isCardio) return false;

        if (filterStartDate && e.date < filterStartDate) return false;
        if (filterEndDate && e.date > filterEndDate) return false;

        return true;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [allEntries, filterStartDate, filterEndDate, cardioTypes]);

  // Format data for WeeklyDistanceChart
  const weeklyData = useMemo(() => {
    const weeks: Record<string, WeeklyDistanceData> = {};

    filteredEntries.forEach((e) => {
      const date = new Date(e.date);
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay()); // Sunday start
      weekStart.setHours(0, 0, 0, 0);

      const key = weekStart.toISOString().split("T")[0];

      if (!weeks[key]) {
        weeks[key] = {
          week: key,
          distance: 0,
          duration: 0,
          calories: 0,
          count: 0,
        };
      }

      weeks[key].distance += e.distance || 0;
      weeks[key].duration += e.durationMinutes || 0;
      weeks[key].calories += e.caloriesBurned || 0;
      weeks[key].count++;
    });

    return Object.values(weeks).sort((a, b) => a.week.localeCompare(b.week));
  }, [filteredEntries]);

  // Format data for ActivityBreakdown
  const activityData = useMemo(() => {
    return filteredEntries.map((e) => ({
      type: e.type,
      distance: e.distance || 0,
      duration: e.durationMinutes || 0,
    }));
  }, [filteredEntries]);

  // Get dates for Streaks
  const dates = useMemo(() => filteredEntries.map((e) => e.date), [
    filteredEntries,
  ]);

  // Summary stats
  const totalDistance = filteredEntries.reduce(
    (s, e) => s + (e.distance || 0),
    0,
  );
  const totalDuration = filteredEntries.reduce(
    (s, e) => s + (e.durationMinutes || 0),
    0,
  );
  const totalCalories = filteredEntries.reduce(
    (s, e) => s + (e.caloriesBurned || 0),
    0,
  );
  const avgPace = totalDistance > 0 ? totalDuration / totalDistance : 0;

  return (
    <div className="space-y-6">
      {/* Header / Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-5 text-center">
          <p className="text-3xl font-black text-sky-400">
            {filteredEntries.length}
          </p>
          <p className="text-xs text-slate-500 uppercase mt-1">Pass</p>
        </div>
        <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-5 text-center">
          <p className="text-3xl font-black text-emerald-400">
            {totalDistance.toFixed(1)}
          </p>
          <p className="text-xs text-slate-500 uppercase mt-1">Km totalt</p>
        </div>
        <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-5 text-center">
          <p className="text-3xl font-black text-white">
            {Math.round(totalDuration / 60)}h
          </p>
          <p className="text-xs text-slate-500 uppercase mt-1">Tid totalt</p>
        </div>
        <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-5 text-center">
          <p className="text-3xl font-black text-rose-400">
            {Math.round(totalCalories / 1000)}k
          </p>
          <p className="text-xs text-slate-500 uppercase mt-1">Kalorier</p>
        </div>
      </div>

      {/* Main Chart */}
      <div className="bg-slate-900/50 border border-blue-500/10 rounded-3xl p-6 relative overflow-visible">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-xl font-black text-white italic">
              WEEKLY DISTANCE
            </h2>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1">
              Löpning & Cardio volym
            </p>
          </div>
        </div>

        <WeeklyDistanceChart data={weeklyData} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-6">
          {/* Streaks */}
          <ConditioningStreaks dates={dates} />

          {/* Pace Card (if running) */}
          {avgPace > 0 && (
            <div className="bg-sky-950/30 border border-sky-500/20 rounded-2xl p-5 flex items-center gap-6">
              <div className="text-4xl">🏃</div>
              <div>
                <p className="text-xs text-sky-400 uppercase font-bold">
                  Snitt tempo
                </p>
                <p className="text-3xl font-black text-white">
                  {Math.floor(avgPace)}:{String(Math.round((avgPace % 1) * 60))
                    .padStart(2, "0")}
                  <span className="text-sm text-slate-400 ml-1">min/km</span>
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Breakdown */}
        <ActivityBreakdown activities={activityData} />
      </div>

      {filteredEntries.length === 0 && (
        <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-12 text-center">
          <p className="text-4xl mb-4">🏃</p>
          <p className="text-slate-400">
            Ingen konditionsdata för vald period.
          </p>
          <p className="text-sm text-slate-600 mt-2">
            Synka med Strava eller logga konditionspass manuellt.
          </p>
        </div>
      )}
    </div>
  );
}
