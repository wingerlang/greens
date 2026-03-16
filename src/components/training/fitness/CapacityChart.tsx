import React, { useMemo } from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer
} from 'recharts';
import { ExerciseEntry } from '../../../models/types.ts';
import { subDays } from 'date-fns';
import { calculateRiegelTime, formatSmartTime } from '../../../utils/runningCalculator.ts';

export interface FitnessDatapoint {
    date: string;
    capacity5k: number | null;
    capacity10k: number | null;
    capacity21k: number | null;
    capacity42k: number | null;
    activitiesProcessed: number;
}

interface CapacityChartProps {
    allRuns: ExerciseEntry[];
    calculationWindowDays: number;
    setCalculationWindowDays: (days: number) => void;
}

function timeToStr(timeMin: number): string {
    const totalSecs = timeMin * 60;
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = Math.floor(totalSecs % 60);
    if (hrs > 0) return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function CustomTooltipCapacity({ active, payload, label }: any) {
    if (active && payload && payload.length) {
        return (
            <div className="bg-slate-900 border border-white/10 p-3 rounded shadow-xl">
                <p className="font-bold text-slate-200 mb-2">{label}</p>
                {payload.map((entry: any, index: number) => (
                    <div key={index} className="flex justify-between gap-4 text-sm">
                        <span style={{ color: entry.color }}>{entry.name}:</span>
                        <span className="font-mono">{timeToStr(entry.value)}</span>
                    </div>
                ))}
            </div>
        );
    }
    return null;
}

export function CapacityChart({ allRuns, calculationWindowDays, setCalculationWindowDays }: CapacityChartProps) {
    // Calculate Capacity over time
    const capacityData = useMemo(() => {
        if (allRuns.length === 0) return [];

        const dataPoints: FitnessDatapoint[] = [];
        const firstDate = new Date(allRuns[0].date);
        const lastDate = new Date(allRuns[allRuns.length - 1].date);

        // Ensure we don't calculate too many points, one per week or bi-weekly is enough
        const stepDays = 7;
        let currentDate = firstDate;

        while (currentDate <= lastDate) {
            const dateStr = currentDate.toISOString().split('T')[0];
            const windowStart = subDays(currentDate, calculationWindowDays).toISOString().split('T')[0];

            const runsInWindow = allRuns.filter(r => r.date <= dateStr && r.date >= windowStart);

            if (runsInWindow.length > 0) {
                // Find best equivalent performance in window using Riegel's for a normalized distance (e.g. 10k)
                let best10kEstimateSecs = Infinity;
                let bestRun = null;

                for (const run of runsInWindow) {
                    // Only trust runs > 3km for estimates
                    if (run.distance! >= 3) {
                        const estimateSecs = calculateRiegelTime(run.durationMinutes * 60, run.distance!, 10);
                        if (estimateSecs < best10kEstimateSecs) {
                            best10kEstimateSecs = estimateSecs;
                            bestRun = run;
                        }
                    }
                }

                if (bestRun && best10kEstimateSecs < (200 * 60)) { // arbitrary sanity check (sub 20h 10k)
                    const estimate5kSecs = calculateRiegelTime(best10kEstimateSecs, 10, 5);
                    const estimate21kSecs = calculateRiegelTime(best10kEstimateSecs, 10, 21.1);
                    const estimate42kSecs = calculateRiegelTime(best10kEstimateSecs, 10, 42.2);

                    dataPoints.push({
                        date: dateStr,
                        capacity5k: estimate5kSecs / 60,
                        capacity10k: best10kEstimateSecs / 60,
                        capacity21k: estimate21kSecs / 60,
                        capacity42k: estimate42kSecs / 60,
                        activitiesProcessed: runsInWindow.length
                    });
                }
            }

            currentDate = new Date(currentDate.getTime() + stepDays * 24 * 60 * 60 * 1000);
        }

        return dataPoints;
    }, [allRuns, calculationWindowDays]);

    return (
        <div className="bg-slate-900 border border-white/5 rounded-xl p-4 md:p-6 shadow-xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        📈 Beräknad Löpkapacitet
                    </h2>
                    <p className="text-sm text-slate-400 mt-1">
                        Estimerade max-tider baserat på dina prestationer de senaste {calculationWindowDays} dagarna (Riegels formel).
                    </p>
                </div>
                <div>
                    <select
                        className="bg-slate-800 border border-white/10 text-white rounded px-3 py-1.5 text-sm"
                        value={calculationWindowDays}
                        onChange={(e) => setCalculationWindowDays(Number(e.target.value))}
                    >
                        <option value={30}>Senaste 30 dagarna</option>
                        <option value={60}>Senaste 60 dagarna</option>
                        <option value={90}>Senaste 90 dagarna</option>
                        <option value={180}>Senaste halvåret</option>
                    </select>
                </div>
            </div>

            {capacityData.length > 0 ? (
                <div className="h-[400px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={capacityData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                            <XAxis
                                dataKey="date"
                                stroke="#ffffff50"
                                tick={{ fill: '#ffffff50', fontSize: 12 }}
                                tickFormatter={(val) => {
                                    const d = new Date(val);
                                    return `${d.getDate()}/${d.getMonth()+1}`;
                                }}
                            />
                            <YAxis
                                stroke="#ffffff50"
                                tick={{ fill: '#ffffff50', fontSize: 12 }}
                                tickFormatter={(val) => timeToStr(val)}
                                domain={['auto', 'auto']}
                                reversed={true} // Faster times (lower minutes) at the top!
                            />
                            <Tooltip content={<CustomTooltipCapacity />} />
                            <Legend wrapperStyle={{ paddingTop: '20px' }} />
                            <Line type="monotone" dataKey="capacity5k" name="5 KM" stroke="#10b981" strokeWidth={3} dot={false} />
                            <Line type="monotone" dataKey="capacity10k" name="10 KM" stroke="#3b82f6" strokeWidth={3} dot={false} />
                            <Line type="monotone" dataKey="capacity21k" name="Halvmaraton" stroke="#6366f1" strokeWidth={3} dot={false} />
                            <Line type="monotone" dataKey="capacity42k" name="Maraton" stroke="#a855f7" strokeWidth={3} dot={false} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            ) : (
                <div className="h-[200px] flex items-center justify-center text-slate-500 italic bg-slate-800/50 rounded-lg border border-white/5">
                    För lite data för att beräkna kapacitet i denna period.
                </div>
            )}
        </div>
    );
}
