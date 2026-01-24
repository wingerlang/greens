import React, { useMemo, useState } from "react";
import { ExerciseEntry } from "../../models/types.ts";
import { formatActivityDuration } from "../../utils/formatters.ts";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  Clock,
  MapPin,
  Minus,
  TrendingUp,
  Trophy,
} from "lucide-react";

interface RaceSeriesDetailModalProps {
  seriesName: string;
  races: ExerciseEntry[];
  onClose: () => void;
  onSelectRace: (race: ExerciseEntry) => void;
}

export function RaceSeriesDetailModal(
  { seriesName, races, onClose, onSelectRace }: RaceSeriesDetailModalProps,
) {
  const [sortConfig, setSortConfig] = useState<
    { key: string; direction: "asc" | "desc" }
  >({ key: "date", direction: "desc" });

  // Distance Grouping
  const distanceGroups = useMemo(() => {
    const groups: Record<string, number> = {};
    races.forEach((r) => {
      if (!r.distance) return;
      const key = Math.round(r.distance).toString(); // Group by nearest km
      groups[key] = (groups[key] || 0) + 1;
    });

    // Convert to array and sort by count DESC
    return Object.entries(groups)
      .map(([dist, count]) => ({ distance: Number(dist), count }))
      .sort((a, b) => b.count - a.count);
  }, [races]);

  // Default to the most common distance, or 'all' if only one or none
  const [selectedDistance, setSelectedDistance] = useState<number | "all">(
    () => {
      // If we have distinct groups with significant counts, default to the top one.
      // If everything is same-ish, "all" might be fine but the user asked to distinguish.
      // If we have multiple groups, pick the largest.
      if (distanceGroups.length > 1) return distanceGroups[0].distance;
      return "all";
    },
  );

  // Filter races
  const filteredRacesByDistance = useMemo(() => {
    if (selectedDistance === "all") return races;
    return races.filter((r) =>
      r.distance && Math.round(r.distance) === selectedDistance
    );
  }, [races, selectedDistance]);

  const sortedRaces = useMemo(() => {
    let items = [...filteredRacesByDistance];
    return items.sort((a, b) => {
      let valA: any = a[sortConfig.key as keyof ExerciseEntry];
      let valB: any = b[sortConfig.key as keyof ExerciseEntry];

      // Handle nested or specific keys
      if (sortConfig.key === "time") {
        valA = a.durationMinutes;
        valB = b.durationMinutes;
      }

      if (valA === undefined) valA = 0;
      if (valB === undefined) valB = 0;

      if (valA < valB) return sortConfig.direction === "asc" ? -1 : 1;
      if (valA > valB) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredRacesByDistance, sortConfig]);

  const handleSort = (key: string) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "desc" ? "asc" : "desc",
    }));
  };

  const SortIcon = ({ colKey }: { colKey: string }) => {
    if (sortConfig.key !== colKey) {
      return <span className="opacity-20 ml-1">⇅</span>;
    }
    return (
      <span className="text-emerald-400 ml-1">
        {sortConfig.direction === "asc" ? "↑" : "↓"}
      </span>
    );
  };

  const stats = useMemo(() => {
    if (sortedRaces.length === 0) return null;

    const bestRace = sortedRaces.reduce((prev, curr) =>
      curr.durationMinutes < prev.durationMinutes ? curr : prev
    );
    const worstRace = sortedRaces.reduce((prev, curr) =>
      curr.durationMinutes > prev.durationMinutes ? curr : prev
    );

    const avgDuration = sortedRaces.reduce((sum, r) =>
      sum + r.durationMinutes, 0) / sortedRaces.length;

    // Trend Analysis
    let trend: "improving" | "declining" | "stable" = "stable";
    if (sortedRaces.length >= 2) {
      const mid = Math.floor(sortedRaces.length / 2);
      const firstHalf = sortedRaces.slice(0, mid);
      const secondHalf = sortedRaces.slice(mid);

      const avgFirst = firstHalf.reduce((sum, r) =>
        sum + r.durationMinutes, 0) / firstHalf.length;
      const avgSecond = secondHalf.reduce((sum, r) =>
        sum + r.durationMinutes, 0) / secondHalf.length;

      if (avgSecond < avgFirst * 0.98) {
        trend = "improving";
      } else if (avgSecond > avgFirst * 1.02) {
        trend = "declining";
      }
    }

    const yearsActive = sortedRaces.map((r) =>
      r.date.substring(0, 4)
    );
    const firstYear = yearsActive[0];
    const lastYear = yearsActive[yearsActive.length - 1];

    return {
      pb: bestRace,
      pw: worstRace,
      avg: avgDuration,
      count: sortedRaces.length,
      totalDistance: sortedRaces.reduce((sum, r) => sum + (r.distance || 0), 0),
      trend,
      span: `${firstYear} - ${lastYear}`,
      // We don't really need standardDistance anymore since we filter by distance, but can keep for "all" view
      standardDistance: selectedDistance === "all" ? 0 : selectedDistance,
    };
  }, [sortedRaces, selectedDistance]);

  const chartData = useMemo(() => {
    return [...filteredRacesByDistance]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map((r) => ({
        year: r.date.substring(0, 4),
        date: r.date,
        time: r.durationMinutes,
        formattedTime: formatActivityDuration(r.durationMinutes),
        isPb: stats?.pb.id === r.id,
      }));
  }, [filteredRacesByDistance, stats]);

  if (!stats) return null;

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-white/10 rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-8 pb-4 border-b border-white/5 flex justify-between items-start bg-slate-900 sticky top-0 z-20">
          <div>
            <div className="text-amber-500 font-bold text-xs uppercase tracking-widest mb-1 flex items-center gap-2">
              <Trophy size={14} /> Tävlingsserie
            </div>
            <h2 className="text-3xl font-black text-white">{seriesName}</h2>

            {/* Distance Selectors */}
            {distanceGroups.length > 1 && (
              <div className="flex gap-2 mt-4">
                {distanceGroups.map((g) => (
                  <button
                    key={g.distance}
                    onClick={() => setSelectedDistance(g.distance)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold uppercase transition-all ${
                      selectedDistance === g.distance
                        ? "bg-amber-500 text-slate-950"
                        : "bg-slate-800 text-slate-400 hover:text-white"
                    }`}
                  >
                    {g.distance} km ({g.count})
                  </button>
                ))}
                <button
                  onClick={() => setSelectedDistance("all")}
                  className={`px-3 py-1 rounded-lg text-xs font-bold uppercase transition-all ${
                    selectedDistance === "all"
                      ? "bg-slate-700 text-white"
                      : "bg-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  Alla ({races.length})
                </button>
              </div>
            )}

            <div className="text-slate-400 mt-2 flex gap-2 text-sm">
              <span>{stats.count} lopp</span>
              <span>•</span>
              <span>{stats.span}</span>
              <span>•</span>
              <span>{stats.totalDistance.toFixed(0)} km totalt</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-white transition-colors p-2 bg-slate-800/50 rounded-full hover:bg-slate-800"
          >
            ✕
          </button>
        </div>

        <div className="p-8 space-y-8 overflow-y-auto">
          {/* Key Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-950/50 p-4 rounded-2xl border border-white/5 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Trophy size={48} className="text-amber-500" />
              </div>
              <div className="text-xs text-slate-500 uppercase font-bold mb-1">
                Personbästa{" "}
                {selectedDistance !== "all" ? `(${selectedDistance}km)` : ""}
              </div>
              <div className="text-2xl font-black text-white font-mono">
                {formatActivityDuration(stats.pb.durationMinutes)}
              </div>
              <div className="text-xs text-amber-500 font-bold mt-1 flex items-center gap-1">
                {stats.pb.date.substring(0, 4)}
              </div>
            </div>

            <div className="bg-slate-950/50 p-4 rounded-2xl border border-white/5">
              <div className="text-xs text-slate-500 uppercase font-bold mb-1">
                Medeltid
              </div>
              <div className="text-2xl font-bold text-slate-200 font-mono">
                {formatActivityDuration(stats.avg)}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Över {stats.count} lopp
              </div>
            </div>

            <div className="bg-slate-950/50 p-4 rounded-2xl border border-white/5">
              <div className="text-xs text-slate-500 uppercase font-bold mb-1">
                Utveckling
              </div>
              <div className="flex items-center gap-2">
                <div
                  className={`text-2xl font-black ${
                    stats.trend === "improving"
                      ? "text-emerald-400"
                      : stats.trend === "declining"
                      ? "text-rose-400"
                      : "text-slate-400"
                  }`}
                >
                  {stats.trend === "improving"
                    ? "Förbättring"
                    : stats.trend === "declining"
                    ? "Tapp"
                    : "Stabil"}
                </div>
              </div>
              <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                {stats.trend === "improving"
                  ? <ArrowDownRight size={14} className="text-emerald-500" />
                  : stats.trend === "declining"
                  ? <ArrowUpRight size={14} className="text-rose-500" />
                  : <Minus size={14} />}
                {stats.trend === "improving"
                  ? "Snabbare snitt"
                  : stats.trend === "declining"
                  ? "Långsammare snitt"
                  : "Jämn nivå"}
              </div>
            </div>

            <div className="bg-slate-950/50 p-4 rounded-2xl border border-white/5">
              <div className="text-xs text-slate-500 uppercase font-bold mb-1">
                Långsammaste
              </div>
              <div className="text-2xl font-bold text-slate-400 font-mono">
                {formatActivityDuration(stats.pw.durationMinutes)}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {stats.pw.date.substring(0, 4)}
              </div>
            </div>
          </div>

          {/* Chart Section */}
          <div className="bg-slate-950/30 p-6 rounded-3xl border border-white/5">
            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
              <TrendingUp size={20} className="text-emerald-500" />{" "}
              Tidsutveckling
            </h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartData}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(255,255,255,0.05)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="year"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#64748b", fontSize: 12, fontWeight: "bold" }}
                    dy={10}
                  />
                  <YAxis
                    hide={true}
                    domain={["dataMin - 5", "dataMax + 5"]}
                    reversed={true} // Lower time is higher up
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0f172a",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "12px",
                      boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
                    }}
                    labelStyle={{
                      color: "#94a3b8",
                      fontSize: "12px",
                      fontWeight: "bold",
                      marginBottom: "4px",
                    }}
                    formatter={(
                      value: any,
                    ) => [
                      <span className="text-amber-400 font-mono font-bold text-lg">
                        {formatActivityDuration(Number(value))}
                      </span>,
                      <span className="text-white text-xs">Tid</span>,
                    ]}
                  />
                  <Line
                    type="monotone"
                    dataKey="time"
                    stroke="#10b981"
                    strokeWidth={3}
                    dot={{
                      fill: "#0f172a",
                      stroke: "#10b981",
                      strokeWidth: 2,
                      r: 4,
                    }}
                    activeDot={{ r: 6, fill: "#10b981" }}
                  />
                  {/* PB Line */}
                  <ReferenceLine
                    y={stats.pb.durationMinutes}
                    stroke="#fbbf24"
                    strokeDasharray="3 3"
                    opacity={0.5}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Race List Table */}
          <div className="bg-slate-950/30 rounded-3xl border border-white/5 overflow-hidden">
            <div className="p-4 border-b border-white/5 flex items-center gap-2">
              <Clock size={16} className="text-slate-400" />
              <h4 className="font-bold text-white">Alla lopp i serien</h4>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-slate-900/50 text-xs uppercase font-bold text-slate-500">
                <tr>
                  <th
                    className="px-6 py-4 text-left cursor-pointer hover:text-white"
                    onClick={() => handleSort("date")}
                  >
                    År / Datum <SortIcon colKey="date" />
                  </th>
                  <th
                    className="px-6 py-4 text-left cursor-pointer hover:text-white"
                    onClick={() => handleSort("location")}
                  >
                    Plats <SortIcon colKey="location" />
                  </th>
                  <th
                    className="px-6 py-4 text-right cursor-pointer hover:text-white"
                    onClick={() => handleSort("time")}
                  >
                    Tid <SortIcon colKey="time" />
                  </th>
                  <th className="px-6 py-4 text-right">Tempo</th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {sortedRaces.map((race) => {
                  const isPb = race.id === stats.pb.id;
                  const dist = race.distance || 0;
                  // Highlight deviation if we are in a specific distance mode
                  const isDeviant = selectedDistance !== "all" &&
                    Math.abs(dist - selectedDistance) > 1;

                  return (
                    <tr
                      key={race.id}
                      className={`hover:bg-white/5 transition-colors cursor-pointer group ${
                        isPb ? "bg-amber-500/5" : ""
                      }`}
                      onClick={() => onSelectRace(race)}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="font-mono text-slate-300">
                            {race.date}
                          </div>
                          {isPb && (
                            <span className="bg-amber-500/20 text-amber-500 text-[10px] px-2 py-0.5 rounded font-bold uppercase">
                              PB
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-400">
                        {race.location
                          ? (
                            <div className="flex items-center gap-1">
                              <MapPin size={12} /> {race.location}
                            </div>
                          )
                          : "-"}
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-white font-bold group-hover:text-amber-400 transition-colors">
                        {formatActivityDuration(race.durationMinutes)}
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-slate-500">
                        {/* Simple pace calculation if missing */}
                        {(race.distance && race.durationMinutes)
                          ? (
                            <div className="flex flex-col items-end">
                              <span>
                                {`${
                                  Math.floor(
                                    race.durationMinutes / race.distance,
                                  )
                                }:${
                                  Math.round(
                                    ((race.durationMinutes / race.distance) %
                                      1) * 60,
                                  ).toString().padStart(2, "0")
                                }/km`}
                              </span>
                              {isDeviant && (
                                <span
                                  className="text-[10px] text-rose-400 font-bold bg-rose-500/10 px-1 rounded mt-1"
                                  title={`Avviker från standard (${selectedDistance}km)`}
                                >
                                  {race.distance?.toFixed(1)}km
                                </span>
                              )}
                            </div>
                          )
                          : "-"}
                      </td>
                      <td className="px-6 py-4 text-right text-slate-600 group-hover:text-white transition-colors">
                        →
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
