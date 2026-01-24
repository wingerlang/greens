import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../context/AuthContext.tsx";
import {
  PersonalBest,
  StrengthStats,
  StrengthWorkout,
} from "../../models/strengthTypes.ts";
import { WeeklyVolumeChart } from "../../components/training/WeeklyVolumeChart.tsx";
import { TrainingTimeStats } from "../../components/training/TrainingTimeStats.tsx";

interface StyrkaViewProps {
  days: number;
}

export function StyrkaView({ days }: StyrkaViewProps) {
  const { token } = useAuth();
  const [workouts, setWorkouts] = useState<StrengthWorkout[]>([]);
  const [stats, setStats] = useState<StrengthStats | null>(null);
  const [pbs, setPbs] = useState<PersonalBest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    const API_BASE = "";

    const fetchData = async () => {
      try {
        const [workoutsRes, statsRes, pbsRes] = await Promise.all([
          fetch(`${API_BASE}/api/strength/workouts`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${API_BASE}/api/strength/stats`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${API_BASE}/api/strength/pbs`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        if (workoutsRes.ok) {
          const data = await workoutsRes.json();
          // Response is { workouts: [...] }
          setWorkouts(data.workouts || []);
        }
        if (statsRes.ok) {
          const data = await statsRes.json();
          setStats(data.stats || null);
        }
        if (pbsRes.ok) {
          const data = await pbsRes.json();
          // Response is { personalBests: [...] }
          setPbs(data.personalBests || []);
        }
      } catch (e) {
        console.error("Failed to fetch strength data", e);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [token]);

  // Filter by days
  const filteredWorkouts = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return workouts.filter((w) => new Date(w.date) >= cutoff);
  }, [workouts, days]);

  const filteredPbs = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return pbs.filter((pb) => new Date(pb.date) >= cutoff);
  }, [pbs, days]);

  const totalVolume = filteredWorkouts.reduce(
    (s, w) => s + (w.totalVolume || 0),
    0,
  );
  const totalSets = filteredWorkouts.reduce((s, w) => s + w.totalSets, 0);

  if (loading) {
    return (
      <div className="text-center text-slate-400 py-12">
        Laddar styrkedata...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-5 text-center">
          <p className="text-3xl font-black text-purple-400">
            {filteredWorkouts.length}
          </p>
          <p className="text-xs text-slate-500 uppercase mt-1">Pass</p>
        </div>
        <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-5 text-center">
          <p className="text-3xl font-black text-white">{totalSets}</p>
          <p className="text-xs text-slate-500 uppercase mt-1">Totalt set</p>
        </div>
        <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-5 text-center">
          <p className="text-3xl font-black text-emerald-400">
            {Math.round(totalVolume / 1000)}t
          </p>
          <p className="text-xs text-slate-500 uppercase mt-1">Ton lyft</p>
        </div>
        <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-5 text-center">
          <p className="text-3xl font-black text-amber-400">
            {filteredPbs.length}
          </p>
          <p className="text-xs text-slate-500 uppercase mt-1">
            Personliga rekord
          </p>
        </div>
      </div>

      {/* Training Time */}
      {filteredWorkouts.length > 0 && (
        <div className="mb-6">
          <TrainingTimeStats workouts={filteredWorkouts} days={days} />
        </div>
      )}

      {/* Weekly Volume Chart */}
      {filteredWorkouts.length > 0 && (
        <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-5 mb-6">
          <h3 className="text-xl font-bold text-white mb-4">
            📈 Volym per vecka
          </h3>
          <WeeklyVolumeChart workouts={filteredWorkouts} />
        </div>
      )}

      {/* Recent PBs */}
      {filteredPbs.length > 0 && (
        <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-5">
          <h3 className="text-sm font-bold text-slate-400 uppercase mb-4">
            🏆 Senaste rekord
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {filteredPbs.slice(0, 4).map((pb) => (
              <div
                key={pb.id}
                className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3"
              >
                <p className="text-xs text-amber-400 uppercase font-bold truncate">
                  {pb.exerciseName}
                </p>
                <p className="text-xl font-black text-white">{pb.value} kg</p>
                <p className="text-[10px] text-slate-500">
                  {pb.reps} reps @ {pb.weight} kg
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {filteredWorkouts.length === 0 && (
        <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-12 text-center">
          <p className="text-4xl mb-4">💪</p>
          <p className="text-slate-400">Ingen styrkedata för vald period.</p>
          <p className="text-sm text-slate-600 mt-2">
            Gå till /styrka för att importera dina pass.
          </p>
        </div>
      )}
    </div>
  );
}
