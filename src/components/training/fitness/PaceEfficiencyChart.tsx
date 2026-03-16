import React, { useMemo } from 'react';
import {
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ScatterChart,
    Scatter,
    ZAxis
} from 'recharts';
import { ExerciseEntry } from '../../../models/types.ts';

export interface PaceEfficiencyDatapoint {
    date: string;
    paceLabel: string;
    avgHr: number;
    activityId: string;
}

interface PaceEfficiencyChartProps {
    allRuns: ExerciseEntry[];
    selectedPaceRange: string;
    setSelectedPaceRange: (range: string) => void;
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

export function PaceEfficiencyChart({ allRuns, selectedPaceRange, setSelectedPaceRange }: PaceEfficiencyChartProps) {
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
    );
}
