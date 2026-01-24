import React, { useMemo } from "react";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ExerciseEntry, WeightEntry } from "../../models/types.ts";
import { calculateTrainingLoad } from "../../utils/performanceEngine.ts";

interface TrainingLoadCorrelationProps {
  exercises: ExerciseEntry[];
  weightEntries: WeightEntry[];
}

export function TrainingLoadCorrelation(
  { exercises, weightEntries }: TrainingLoadCorrelationProps,
) {
  const chartData = useMemo(() => {
    // Group by week aggregate for clarity
    const sortedExercises = [...exercises].sort((a, b) =>
      a.date.localeCompare(b.date)
    );
    const sortedWeights = [...weightEntries].sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    if (sortedExercises.length === 0) return [];

    // Determine range: last 12 weeks
    const lastDate = new Date();
    const firstDate = new Date();
    firstDate.setDate(lastDate.getDate() - (12 * 7));

    // Align to Monday
    firstDate.setDate(
      firstDate.getDate() -
        (firstDate.getDay() === 0 ? 6 : firstDate.getDay() - 1),
    );

    const weeks: any[] = [];
    let current = new Date(firstDate);

    while (current <= lastDate) {
      const weekStart = new Date(current);
      const weekEnd = new Date(current);
      weekEnd.setDate(weekEnd.getDate() + 7);

      const weekExercises = exercises.filter((e) => {
        const ed = new Date(e.date);
        return ed >= weekStart && ed < weekEnd;
      });

      // For weight, find the average weight of the week or the latest
      const weekWeightEntries = weightEntries.filter((w) => {
        const wd = new Date(w.date);
        return wd >= weekStart && wd < weekEnd;
      });
      const weekWeight = weekWeightEntries.length > 0
        ? weekWeightEntries.reduce((sum, w) => sum + w.weight, 0) /
          weekWeightEntries.length
        : null;

      const totalLoad = weekExercises.reduce(
        (sum, ex) => sum + calculateTrainingLoad(ex),
        0,
      );

      weeks.push({
        date: weekStart.toISOString().split("T")[0],
        label: `V.${getWeekNumber(weekStart)}`,
        load: totalLoad,
        weight: weekWeight ? Math.round(weekWeight * 10) / 10 : null,
      });

      current = weekEnd;
    }

    return weeks;
  }, [exercises, weightEntries]);

  function getWeekNumber(d: Date) {
    const date = new Date(d.getTime());
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
    const week1 = new Date(date.getFullYear(), 0, 4);
    return 1 +
      Math.round(
        ((date.getTime() - week1.getTime()) / 86400000 - 3 +
          (week1.getDay() + 6) % 7) / 7,
      );
  }

  return (
    <div className="correlation-dashboard mt-6 bg-slate-900/30 rounded-3xl p-6 border border-white/5">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
            <span>📈</span> Träningsbelastning vs Vikt
          </h3>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">
            Korrelation mellan intensitet och fysik
          </p>
        </div>
        <div className="flex gap-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-violet-500" />
            <span className="text-[10px] font-bold text-slate-400 uppercase">
              Load
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-[10px] font-bold text-slate-400 uppercase">
              Vikt
            </span>
          </div>
        </div>
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 10, right: 0, left: -25, bottom: 0 }}
          >
            <defs>
              <linearGradient id="colorLoad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#818cf8" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#818cf8" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="rgba(255,255,255,0.05)"
            />
            <XAxis
              dataKey="label"
              tick={{ fill: "#64748b", fontSize: 9, fontWeight: 700 }}
              axisLine={false}
              tickLine={false}
              dy={10}
            />
            <YAxis
              yAxisId="left"
              tick={{ fill: "#64748b", fontSize: 9, fontWeight: 700 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              domain={["dataMin - 1", "dataMax + 1"]}
              tick={{ fill: "#10b981", fontSize: 9, fontWeight: 700 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "rgba(15, 23, 42, 0.9)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "16px",
                backdropFilter: "blur(10px)",
                boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5)",
              }}
              itemStyle={{ fontSize: "11px", fontWeight: "bold" }}
              labelStyle={{
                fontSize: "10px",
                color: "#64748b",
                marginBottom: "4px",
                textTransform: "uppercase",
              }}
            />
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="load"
              name="Load"
              fill="url(#colorLoad)"
              stroke="#818cf8"
              strokeWidth={3}
              animationDuration={1500}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="weight"
              name="Vikt"
              stroke="#10b981"
              strokeWidth={4}
              dot={{ r: 4, fill: "#10b981", strokeWidth: 0 }}
              activeDot={{ r: 6, stroke: "#fff", strokeWidth: 2 }}
              connectNulls
              animationDuration={2000}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-6 flex flex-col sm:flex-row gap-4">
        <div className="flex-1 bg-white/5 rounded-2xl p-3 border border-white/5">
          <span className="text-[9px] font-black text-indigo-400 uppercase block mb-1">
            Load Analys
          </span>
          <p className="text-[11px] text-slate-300 leading-relaxed">
            Dina senaste 4 veckor visar en {chartData.length >= 4 &&
                chartData[chartData.length - 1].load >
                  chartData[chartData.length - 4].load
              ? "ökande"
              : "stabil"}{" "}
            trend i träningsstress. Perfekt för att bygga långsiktig tålighet.
          </p>
        </div>
        <div className="flex-1 bg-white/5 rounded-2xl p-3 border border-white/5">
          <span className="text-[9px] font-black text-emerald-400 uppercase block mb-1">
            Fysisk Respons
          </span>
          <p className="text-[11px] text-slate-300 leading-relaxed">
            Sikta på en jämn viktkurva (-0.2kg/vecka) vid hög load för att
            optimera kroppssammansättningen (fettförlust vs muskelmassa).
          </p>
        </div>
      </div>
    </div>
  );
}
