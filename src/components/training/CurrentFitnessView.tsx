import React, { useMemo, useState } from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    ScatterChart,
    Scatter,
    ZAxis
} from 'recharts';
import { ExerciseEntry, UniversalActivity } from '../../models/types.ts';
import { mapUniversalToLegacyEntry } from '../../utils/mappers.ts';
import { differenceInDays, subDays } from 'date-fns';

interface CurrentFitnessViewProps {
    exerciseEntries: ExerciseEntry[];
    universalActivities: UniversalActivity[];
    filterStartDate?: string | null;
    filterEndDate?: string | null;
}

interface FitnessDatapoint {
    date: string;
    capacity5k: number | null;
    capacity10k: number | null;
    capacity21k: number | null;
    capacity42k: number | null;
    activitiesProcessed: number;
}

interface PaceEfficiencyDatapoint {
    date: string;
    paceLabel: string;
    avgHr: number;
    activityId: string;
}

// Riegel's Formula: T2 = T1 * (D2/D1)^1.06
// Returns time in minutes
function predictTime(distanceKm: number, timeMin: number, targetDistanceKm: number): number {
    return timeMin * Math.pow(targetDistanceKm / distanceKm, 1.06);
}

function timeToPaceStr(timeMin: number, distKm: number): string {
    const minPerKm = timeMin / distKm;
    const mins = Math.floor(minPerKm);
    const secs = Math.floor((minPerKm - mins) * 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function timeToStr(timeMin: number): string {
    const hrs = Math.floor(timeMin / 60);
    const mins = Math.floor(timeMin % 60);
    const secs = Math.floor((timeMin * 60) % 60);
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

function CustomTooltipEfficiency({ active, payload }: any) {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="bg-slate-900 border border-white/10 p-3 rounded shadow-xl">
                <p className="font-bold text-slate-200">{data.date}</p>
                <p className="text-sm text-slate-400 mt-1">Tempo: <span className="text-white font-mono">{data.paceLabel} min/km</span></p>
                <p className="text-sm text-slate-400">Puls: <span className="text-rose-400 font-bold">{Math.round(data.avgHr)} bpm</span></p>
            </div>
        );
    }
    return null;
}

export function CurrentFitnessView({
    exerciseEntries,
    universalActivities,
    filterStartDate,
    filterEndDate
}: CurrentFitnessViewProps) {
    const [calculationWindowDays, setCalculationWindowDays] = useState<number>(60);
    const [selectedPaceRange, setSelectedPaceRange] = useState<string>('5:00-5:15');

    const allRuns = useMemo(() => {
        const legacy = exerciseEntries || [];
        const universal = universalActivities || [];
        const combined = [
            ...legacy.filter(e => e.type === 'Löpning'),
            ...universal
                .filter(u => u.performance?.activityType === 'Löpning')
                .map(mapUniversalToLegacyEntry)
                .filter(e => e !== null) as ExerciseEntry[]
        ];

        // Deduplicate
        const unique = Array.from(new Map(combined.map(item => [item.id, item])).values());

        return unique.filter(run => {
            if (!run.distance || run.distance < 1) return false;
            if (!run.durationMinutes || run.durationMinutes < 1) return false;
            if (filterStartDate && run.date < filterStartDate) return false;
            if (filterEndDate && run.date > filterEndDate) return false;
            return true;
        }).sort((a, b) => a.date.localeCompare(b.date));
    }, [exerciseEntries, universalActivities, filterStartDate, filterEndDate]);

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
                let best10kEstimate = Infinity;
                let bestRun = null;

                for (const run of runsInWindow) {
                    // Only trust runs > 3km for estimates
                    if (run.distance! >= 3) {
                        const estimate = predictTime(run.distance!, run.durationMinutes, 10);
                        if (estimate < best10kEstimate) {
                            best10kEstimate = estimate;
                            bestRun = run;
                        }
                    }
                }

                if (bestRun && best10kEstimate < 200) { // arbitrary sanity check (sub 20h 10k)
                    dataPoints.push({
                        date: dateStr,
                        capacity5k: predictTime(10, best10kEstimate, 5),
                        capacity10k: best10kEstimate,
                        capacity21k: predictTime(10, best10kEstimate, 21.1),
                        capacity42k: predictTime(10, best10kEstimate, 42.2),
                        activitiesProcessed: runsInWindow.length
                    });
                }
            }

            currentDate = new Date(currentDate.getTime() + stepDays * 24 * 60 * 60 * 1000);
        }

        return dataPoints;
    }, [allRuns, calculationWindowDays]);

    // Calculate Efficiency (HR per Pace Bucket)
    const { paceBuckets, efficiencyData } = useMemo(() => {
        const buckets = new Set<string>();
        let rawPaceData: PaceEfficiencyDatapoint[] = [];

        for (const run of allRuns) {
            if (!run.heartRateAvg || run.heartRateAvg < 80) continue;

            const minPerKm = run.durationMinutes / run.distance!;

            // Bucket by 15 second intervals
            const totalSeconds = minPerKm * 60;
            const bucketLowerSecs = Math.floor(totalSeconds / 15) * 15;
            const bucketUpperSecs = bucketLowerSecs + 15;

            const formatPace = (secs: number) => `${Math.floor(secs/60)}:${(secs%60).toString().padStart(2, '0')}`;
            const paceLabel = `${formatPace(bucketLowerSecs)}-${formatPace(bucketUpperSecs)}`;

            buckets.add(paceLabel);
            rawPaceData.push({
                date: run.date,
                paceLabel: paceLabel,
                avgHr: run.heartRateAvg,
                activityId: run.id
            });
        }

        // Remove outliers for each bucket (top 10% and bottom 10% of HR for that bucket)
        const cleanedData: PaceEfficiencyDatapoint[] = [];
        const bucketGroups: Record<string, PaceEfficiencyDatapoint[]> = {};

        for (const dp of rawPaceData) {
            if (!bucketGroups[dp.paceLabel]) bucketGroups[dp.paceLabel] = [];
            bucketGroups[dp.paceLabel].push(dp);
        }

        for (const [label, points] of Object.entries(bucketGroups)) {
            if (points.length < 3) {
                cleanedData.push(...points);
                continue;
            }

            points.sort((a, b) => a.avgHr - b.avgHr);
            const removeCount = Math.floor(points.length * 0.1); // 10%
            const validPoints = points.slice(removeCount, points.length - removeCount);
            cleanedData.push(...validPoints);
        }

        // Sort for nice dropdown
        const sortedBuckets = Array.from(buckets).sort((a, b) => {
            const getSecs = (lbl: string) => {
                const [min, sec] = lbl.split('-')[0].split(':').map(Number);
                return min * 60 + sec;
            };
            return getSecs(a) - getSecs(b);
        });

        return {
            paceBuckets: sortedBuckets,
            efficiencyData: cleanedData.sort((a, b) => a.date.localeCompare(b.date))
        };
    }, [allRuns]);

    const filteredEfficiencyData = useMemo(() => {
        return efficiencyData.filter(d => d.paceLabel === selectedPaceRange);
    }, [efficiencyData, selectedPaceRange]);

    // Ensure we have a default selected range if it's invalid
    if (!paceBuckets.includes(selectedPaceRange) && paceBuckets.length > 0) {
        setSelectedPaceRange(paceBuckets[Math.floor(paceBuckets.length / 2)]);
    }

    return (
        <div className="space-y-6">
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

            <div className="bg-slate-900 border border-white/5 rounded-xl p-4 md:p-6 shadow-xl">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            ❤️ Pulsprestanda per Tempo
                        </h2>
                        <p className="text-sm text-slate-400 mt-1">
                            Din genomsnittliga puls för olika tempon över tid. Visar om du blivit effektivare.
                            <br/><span className="text-xs opacity-75">(De 10% extremaste pulsvärdena åt båda hållen är bortfiltrerade för att rensa bort t.ex. rena backpass).</span>
                        </p>
                    </div>
                    {paceBuckets.length > 0 && (
                        <div>
                            <select
                                className="bg-slate-800 border border-white/10 text-white rounded px-3 py-1.5 text-sm"
                                value={selectedPaceRange}
                                onChange={(e) => setSelectedPaceRange(e.target.value)}
                            >
                                {paceBuckets.map(bucket => (
                                    <option key={bucket} value={bucket}>{bucket} min/km</option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>

                {filteredEfficiencyData.length > 0 ? (
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <ScatterChart margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                                <XAxis
                                    dataKey="date"
                                    type="category"
                                    allowDuplicatedCategory={false}
                                    stroke="#ffffff50"
                                    tick={{ fill: '#ffffff50', fontSize: 12 }}
                                    tickFormatter={(val) => {
                                        const d = new Date(val);
                                        return `${d.getDate()}/${d.getMonth()+1}`;
                                    }}
                                />
                                <YAxis
                                    dataKey="avgHr"
                                    type="number"
                                    name="Puls"
                                    domain={['dataMin - 5', 'dataMax + 5']}
                                    stroke="#ffffff50"
                                    tick={{ fill: '#ffffff50', fontSize: 12 }}
                                    tickFormatter={(val) => `${Math.round(val)} bpm`}
                                />
                                <ZAxis dataKey="avgHr" range={[50, 50]} />
                                <Tooltip cursor={{strokeDasharray: '3 3'}} content={<CustomTooltipEfficiency />} />
                                <Scatter name="Puls per pass" data={filteredEfficiencyData} fill="#f43f5e" shape="circle" />
                            </ScatterChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <div className="h-[200px] flex items-center justify-center text-slate-500 italic bg-slate-800/50 rounded-lg border border-white/5">
                        {paceBuckets.length === 0 ? 'Ingen pulsdata hittades för dina löppass.' : 'Ingen data för detta tempo.'}
                    </div>
                )}
            </div>
        </div>
    );
}
