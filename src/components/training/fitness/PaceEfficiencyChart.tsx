import React, { useMemo } from 'react';
import {
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ScatterChart,
    Scatter,
    ZAxis,
    LineChart,
    Line,
    Bar,
    BarChart,
    Legend,
    Cell
} from 'recharts';
import { ExerciseEntry } from '../../../models/types.ts';
import { LayoutGrid, TrendingUp, Info, Activity, CalendarDays } from 'lucide-react';
import { startOfWeek, format } from 'date-fns';
import { sv } from 'date-fns/locale';

export interface PaceEfficiencyDatapoint {
    date: string;
    timestamp: number;
    bucketLabel: string;
    primaryMetric: number;
    actualHr: number;
    actualPaceSecs: number;
    activityId: string;
    distance?: number;
    durationMinutes?: number;
    title?: string;
    isNormalized?: boolean;
    originalMetric?: number;
    originalBucketLabel?: string;
}

export interface TimelineGroup {
    weekLabel: string;
    timestamp: number;
    avgMetric: number;
    totalDistance: number;
    totalDuration: number;
    runs: PaceEfficiencyDatapoint[];
}

interface PaceEfficiencyChartProps {
    allRuns: ExerciseEntry[];
}

const formatPace = (secs: number) => {
    if (!secs) return "0:00";
    return `${Math.floor(secs/60)}:${(Math.floor(secs)%60).toString().padStart(2, '0')}`;
};

function CustomTooltipEfficiency({ active, payload }: any) {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="bg-slate-900 border border-white/5 p-3 rounded-xl shadow-2xl space-y-1 backdrop-blur-md">
                <p className="font-black text-slate-200 text-xs">{data.date}</p>
                {data.distance && (
                    <p className="text-[10px] text-slate-500 font-bold">{data.distance.toFixed(1)} km</p>
                )}
                <div className="border-t border-white/5 my-1 pt-1">
                    <p className="text-xs text-slate-400 mt-1">{data.basis === 'pace' ? 'Tempo:' : 'Puls:'} <span className="text-white font-mono font-black">{data.bucketLabel}</span></p>
                    <p className="text-xs text-slate-400">{data.basis === 'pace' ? 'Puls:' : 'Tempo:'} <span className="text-rose-400 font-black">
                        {data.basis === 'pace' ? `${Math.round(data.primaryMetric)} bpm` : formatPace(data.primaryMetric)}
                    </span></p>
                    {data.isNormalized && (
                        <p className="text-[10px] text-amber-500/80 mt-1 border-t border-white/5 pt-1">
                            Normaliserat från {data.originalBucketLabel} (Var {data.basis === 'pace' ? `${Math.round(data.originalMetric)} bpm` : formatPace(data.originalMetric)})
                        </p>
                    )}
                </div>
            </div>
        );
    }
    return null;
}

function CustomTooltipProfile({ active, payload, label }: any) {
    if (active && payload && payload.length) {
        return (
            <div className="bg-slate-900 border border-white/5 p-3 rounded-xl shadow-2xl space-y-1 backdrop-blur-md">
                <p className="font-black text-slate-200 text-xs">{label} min/km</p>
                <div className="space-y-1 border-t border-white/5 pt-1 mt-1">
                    {payload.map((entry: any, index: number) => (
                        <div key={index} className="flex justify-between gap-4 text-xs">
                            <span className="text-slate-400">{entry.name}:</span>
                            <span className="font-black font-mono" style={{ color: entry.color }}>
                                {entry.value ? (entry.payload.basis === 'pace' ? `${Math.round(entry.value)} bpm` : formatPace(entry.value)) : 'Ingen data'}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        );
    }
    return null;
}

export function PaceEfficiencyChart({ allRuns }: PaceEfficiencyChartProps) {
    const [viewMode, setViewMode] = React.useState<'profile' | 'trend' | 'timeline'>('timeline');
    const [basis, setBasis] = React.useState<'pace' | 'hr'>('pace');
    const [selectedBucketRange, setSelectedBucketRange] = React.useState<string>("");
    const [selectedTimelineWeek, setSelectedTimelineWeek] = React.useState<TimelineGroup | null>(null);
    const [normalizeLevels, setNormalizeLevels] = React.useState(0);

    // Filter runs and build common dataset structure
    const { buckets, efficiencyData, profileData } = useMemo(() => {
        const bucketSet = new Set<string>();
        let rawData: (PaceEfficiencyDatapoint & { basis: string })[] = [];

        for (const run of allRuns) {
            if (!run.heartRateAvg || run.heartRateAvg < 80) continue;

            const minPerKm = run.durationMinutes / run.distance!;
            if (minPerKm > 9) continue;

            let bucketLabel = "";
            let primaryMetric = 0;

            const runPaceSecs = minPerKm * 60;

            if (basis === 'pace') {
                const totalSeconds = runPaceSecs;
                const bucketLowerSecs = Math.floor(totalSeconds / 15) * 15;
                const bucketUpperSecs = bucketLowerSecs + 15;
                bucketLabel = `${formatPace(bucketLowerSecs)}-${formatPace(bucketUpperSecs)}`;
                primaryMetric = run.heartRateAvg;
            } else {
                const hrLower = Math.floor(run.heartRateAvg / 5) * 5;
                const hrUpper = hrLower + 4;
                bucketLabel = `${hrLower}-${hrUpper}`;
                primaryMetric = runPaceSecs;
            }

            bucketSet.add(bucketLabel);
            rawData.push({
                basis,
                date: run.date,
                timestamp: new Date(run.date).getTime(),
                bucketLabel: bucketLabel,
                primaryMetric: primaryMetric,
                actualHr: run.heartRateAvg,
                actualPaceSecs: runPaceSecs,
                activityId: run.id,
                distance: run.distance,
                durationMinutes: run.durationMinutes,
                title: run.title || run.notes?.substring(0, 30)
            });
        }

        const cleanedData: (PaceEfficiencyDatapoint & { basis: string })[] = [];
        const bucketGroups: Record<string, typeof rawData> = {};

        for (const dp of rawData) {
            if (!bucketGroups[dp.bucketLabel]) bucketGroups[dp.bucketLabel] = [];
            bucketGroups[dp.bucketLabel].push(dp);
        }

        for (const [label, points] of Object.entries(bucketGroups)) {
            if (points.length < 3) {
                cleanedData.push(...points);
                continue;
            }
            points.sort((a, b) => a.primaryMetric - b.primaryMetric);
            const removeCount = Math.floor(points.length * 0.1);
            const validPoints = points.slice(removeCount, points.length - removeCount);
            cleanedData.push(...validPoints);
        }

        const sortedBuckets = Array.from(bucketSet).sort((a, b) => {
            if (basis === 'pace') {
                const getSecs = (lbl: string) => {
                    const [min, sec] = lbl.split('-')[0].split(':').map(Number);
                    return min * 60 + sec;
                };
                return getSecs(a) - getSecs(b);
            } else {
                const getHr = (lbl: string) => Number(lbl.split('-')[0]);
                return getHr(a) - getHr(b);
            }
        });

        const now = new Date().getTime();
        const sixtyDaysAgo = now - 60 * 24 * 60 * 60 * 1000;

        const profileData = sortedBuckets.map(bucket => {
            const points = cleanedData.filter(d => d.bucketLabel === bucket);
            const recent = points.filter(p => p.timestamp >= sixtyDaysAgo);
            const older = points.filter(p => p.timestamp < sixtyDaysAgo);

            const avgRecent = recent.length > 0 ? recent.reduce((sum, p) => sum + p.primaryMetric, 0) / recent.length : null;
            const avgOlder = older.length > 0 ? older.reduce((sum, p) => sum + p.primaryMetric, 0) / older.length : null;

            return {
                basis,
                bucketLabel: bucket,
                avgRecent: avgRecent ? (basis === 'pace' ? Math.round(avgRecent) : avgRecent) : null,
                avgOlder: avgOlder ? (basis === 'pace' ? Math.round(avgOlder) : avgOlder) : null,
                countRecent: recent.length,
                countOlder: older.length
            };
        });

        return {
            buckets: sortedBuckets,
            efficiencyData: cleanedData.sort((a, b) => a.timestamp - b.timestamp),
            profileData
        };
    }, [allRuns, basis]);

    const filteredEfficiencyData = useMemo(() => {
        if (normalizeLevels === 0) {
            return efficiencyData.filter(d => d.bucketLabel === selectedBucketRange);
        }

        const targetIdx = buckets.indexOf(selectedBucketRange);
        if (targetIdx === -1) return [];

        const result: PaceEfficiencyDatapoint[] = [];
        result.push(...efficiencyData.filter(d => d.bucketLabel === selectedBucketRange));

        const addNormalized = (offset: number) => {
            const idx = targetIdx + offset;
            if (idx >= 0 && idx < buckets.length) {
                const targetBucketRuns = efficiencyData.filter(d => d.bucketLabel === buckets[idx]);

                let metricAdjustment = 0;
                if (basis === 'pace') {
                    // basis='pace': we normalize HR.
                    // offset > 0 (slower pace), we ran easier. So we ADD 5 bpm to simulate faster pace effort.
                    metricAdjustment = offset * 5;
                } else {
                    // basis='hr': we normalize Pace.
                    // offset > 0 (higher HR index), we ran harder. The pace was relatively fast.
                    // To simulate pulling this pass down to a lower HR bucket, we must slow down the pace.
                    // Slower pace = more seconds. So we ADD 15s.
                    metricAdjustment = offset * 15;
                }

                for (const r of targetBucketRuns) {
                    result.push({
                        ...r,
                        primaryMetric: r.primaryMetric + metricAdjustment,
                        isNormalized: true,
                        originalMetric: r.primaryMetric,
                        originalBucketLabel: r.bucketLabel
                    });
                }
            }
        };

        for (let i = 1; i <= normalizeLevels; i++) {
            addNormalized(i);
            addNormalized(-i);
        }

        return result.sort((a,b) => a.timestamp - b.timestamp);
    }, [efficiencyData, selectedBucketRange, normalizeLevels, buckets, basis]);

    const timelineData: TimelineGroup[] = useMemo(() => {
        const groups: Record<string, TimelineGroup> = {};
        for (const dp of filteredEfficiencyData) {
            const d = new Date(dp.timestamp);
            const start = startOfWeek(d, { weekStartsOn: 1 });
            const weekLabel = `v.${format(start, "w, yyyy", { locale: sv })}`;

            if (!groups[weekLabel]) {
                groups[weekLabel] = {
                    weekLabel,
                    timestamp: start.getTime(),
                    avgMetric: 0,
                    totalDistance: 0,
                    totalDuration: 0,
                    runs: []
                };
            }
            groups[weekLabel].runs.push(dp);
            groups[weekLabel].totalDistance += (dp.distance || 0);
            groups[weekLabel].totalDuration += (dp.durationMinutes || 0);
        }

        const result = Object.values(groups).sort((a, b) => a.timestamp - b.timestamp);
        for (const g of result) {
            let totalVal = 0;
            let weightSum = 0;
            for (const r of g.runs) {
                const weight = r.durationMinutes || 1;
                totalVal += r.primaryMetric * weight;
                weightSum += weight;
            }
            g.avgMetric = weightSum > 0 ? totalVal / weightSum : 0;
        }
        return result;
    }, [filteredEfficiencyData]);

    React.useEffect(() => {
        setSelectedTimelineWeek(null);
    }, [selectedBucketRange, basis]);

    React.useEffect(() => {
        if (!buckets.includes(selectedBucketRange) && buckets.length > 0) {
            setSelectedBucketRange(buckets[Math.floor(buckets.length / 2)]);
        }
    }, [buckets, selectedBucketRange]);

    return (
        <div className="bg-slate-900 border border-white/5 rounded-2xl p-4 md:p-6 shadow-2xl space-y-4">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div>
                    <h2 className="text-xl font-black text-white flex items-center gap-2">
                        {basis === 'pace' ? '❤️ Pulsprestanda per Tempo' : '⏱️ Tempo per Pulsnivå'}
                    </h2>
                    <p className="text-xs text-slate-400 mt-1 mb-3">
                        {basis === 'pace' ? 'Genomsnittlig puls för olika tempon. Lägre kurva = högre effektivitet.' : 'Genomsnittligt tempo för olika pulsnivåer. Lägre är snabbare/bättre.'}
                    </p>
                    <button
                        onClick={() => {
                            setBasis(basis === 'pace' ? 'hr' : 'pace');
                            setSelectedBucketRange('');
                        }}
                        className="text-[10px] font-bold uppercase bg-slate-800 hover:bg-white/10 border border-white/5 px-2.5 py-1.5 rounded-lg text-slate-400 transition-colors flex items-center gap-1.5"
                    >
                        ⇄ {basis === 'pace' ? 'Invertera till Pulsnivåer' : 'Invertera till Temponivåer'}
                    </button>
                </div>

                <div className="flex items-center gap-2 mt-2 md:mt-0">
                    <div className="bg-slate-800 border border-white/5 p-1 rounded-xl flex gap-1">
                        <button
                            onClick={() => setViewMode('profile')}
                            className={`p-1.5 rounded-lg flex items-center gap-1.5 text-xs font-bold transition-all ${viewMode === 'profile' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-white'}`}
                            title="Tempospektrum"
                        >
                            <LayoutGrid size={14} /> Tempospektrum
                        </button>
                        <button
                            onClick={() => setViewMode('trend')}
                            className={`p-1.5 rounded-lg flex items-center gap-1.5 text-xs font-bold transition-all ${viewMode === 'trend' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-white'}`}
                            title="Alla pass spridda (Scatter)"
                        >
                            <LayoutGrid size={14} /> Pass
                        </button>
                        <button
                            onClick={() => setViewMode('timeline')}
                            className={`p-1.5 rounded-lg flex items-center gap-1.5 text-xs font-bold transition-all ${viewMode === 'timeline' ? 'bg-indigo-500/20 text-indigo-300' : 'text-slate-500 hover:text-white'}`}
                            title="Kontinuerlig veckotrend"
                        >
                            <TrendingUp size={14} /> Kontinuerlig
                        </button>
                    </div>

                    {(viewMode === 'trend' || viewMode === 'timeline') && buckets.length > 0 && (
                        <div className="flex items-center gap-2">
                            <select
                                className={`border rounded-xl px-2 py-1.5 text-[10px] font-black uppercase outline-none cursor-pointer transition-colors ${
                                    normalizeLevels > 0
                                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-500 focus:border-amber-400'
                                    : 'bg-slate-800 border-white/5 text-slate-500 focus:border-white/10 hover:text-white'
                                }`}
                                value={normalizeLevels}
                                onChange={(e) => setNormalizeLevels(Number(e.target.value))}
                                title={basis === 'pace' ? "Inkludera pass från snabbare/långsammare tempon normaliserade med ±5 bpm per 15s-nivå." : "Inkludera pass från högre/lägre puls normaliserade med ±15s per 5 bpm-nivå."}
                            >
                                <option value={0}>Normalisering: Av (0)</option>
                                <option value={1}>±1 nivå ({basis === 'pace' ? '15s' : '5 bpm'})</option>
                                <option value={2}>±2 nivåer ({basis === 'pace' ? '30s' : '10 bpm'})</option>
                                <option value={3}>±3 nivåer ({basis === 'pace' ? '45s' : '15 bpm'})</option>
                                <option value={4}>±4 nivåer ({basis === 'pace' ? '60s' : '20 bpm'})</option>
                            </select>
                            <select
                                className="bg-slate-800 border border-white/5 text-white rounded-xl px-3 py-1.5 text-xs font-bold outline-none cursor-pointer focus:border-white/10"
                                value={selectedBucketRange}
                                onChange={(e) => setSelectedBucketRange(e.target.value)}
                            >
                                {buckets.map(bucket => (
                                    <option key={bucket} value={bucket}>{bucket} {basis === 'pace' ? 'min/km' : 'bpm'}</option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>
            </div>

            {viewMode === 'profile' && (
                <div className="bg-white/5 border border-white/[0.03] p-3 rounded-xl flex gap-3 text-xs text-slate-400 items-center">
                    <Info size={16} className="text-blue-400 shrink-0" />
                    <p>Kurvan jämför genomsnittlig puls den senaste 60 dagarna med tidigare perioder. Om den gröna kurvan (`Senaste 60 dagarna`) befinner sig **under** den gråa kurvan jobbar ditt hjärta lättare i det tempot!</p>
                </div>
            )}

            {(viewMode === 'trend' || viewMode === 'timeline') && normalizeLevels > 0 && (
                <div className="bg-amber-500/5 border border-amber-500/20 p-3 rounded-xl flex gap-3 text-xs text-amber-500/80 items-start">
                    <Info size={16} className="text-amber-500 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                        <p className="font-bold text-amber-500">Normalisering aktiv (±{normalizeLevels} nivå{normalizeLevels > 1 ? 'er' : ''})</p>
                        <p className="leading-relaxed">För att ge ett tätare dataunderlag inkluderas här även pass som är upp till <b>{normalizeLevels * (basis === 'pace' ? 15 : 5)} {basis === 'pace' ? 'sekunder snabbare eller långsammare per kilometer' : 'pulsslag (bpm) ansträngande'}</b> än <span className="font-mono text-amber-400 font-bold">{selectedBucketRange}</span>.</p>
                        <p className="leading-relaxed">Deras utfall kompenseras matematiskt framåt/bakåt med <b>±{basis === 'pace' ? 5 : 15} {basis === 'pace' ? 'beräknade snittslag per 15s-nivå' : 'sekunder per 5-bpm-nivå'}</b> för att efterlikna ansträngningen/farten i ditt valda intervall. Utstickande pass särskiljs i grafer och listor.</p>
                    </div>
                </div>
            )}

            {viewMode === 'profile' && profileData.length > 0 && (
                <div className="h-[320px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={profileData} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                            <XAxis dataKey="bucketLabel" stroke="#ffffff30" tick={{ fill: '#ffffff50', fontSize: 10 }} />
                            <YAxis domain={basis === 'pace' ? ['dataMin - 10', 'dataMax + 5'] : ['auto', 'auto']} stroke="#ffffff30" tick={{ fill: '#ffffff50', fontSize: 10 }} tickFormatter={(val) => basis === 'pace' ? `${val} bpm` : formatPace(val)} />
                            <Tooltip content={<CustomTooltipProfile />} cursor={{ fill: 'rgba(255, 255, 255, 0.03)' }} />
                            <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                            <Bar dataKey="avgOlder" name="Tidigare perioder" fill="#94a3b8" radius={[4, 4, 0, 0]} opacity={0.4} />
                            <Bar dataKey="avgRecent" name="Senaste 60 dagarna" fill="#10b981" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            )}

            {viewMode === 'trend' && filteredEfficiencyData.length > 0 && (
                <div className="h-[320px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <ScatterChart margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                            <XAxis
                                dataKey="timestamp"
                                type="number"
                                domain={['auto', 'auto']}
                                stroke="#ffffff30"
                                tick={{ fill: '#ffffff50', fontSize: 10 }}
                                tickFormatter={(val: number) => {
                                    const d = new Date(val);
                                    return `${d.getDate()}/${d.getMonth()+1}`;
                                }}
                            />
                            <YAxis
                                dataKey="primaryMetric"
                                type="number"
                                name={basis === 'pace' ? "Puls" : "Tempo"}
                                domain={basis === 'pace' ? ['dataMin - 5', 'dataMax + 5'] : ['auto', 'auto']}
                                stroke="#ffffff30"
                                tick={{ fill: '#ffffff50', fontSize: 10 }}
                                tickFormatter={(val: number) => basis === 'pace' ? `${Math.round(val)} bpm` : formatPace(val)}
                            />
                            <ZAxis dataKey="distance" type="number" range={[20, 150]} />
                            <Tooltip cursor={{strokeDasharray: '3 3'}} content={<CustomTooltipEfficiency />} />
                            <Scatter name={basis === 'pace' ? "Puls per pass" : "Tempo per pass"} data={filteredEfficiencyData} shape="circle">
                                {filteredEfficiencyData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.isNormalized ? '#fbbf24' : '#f43f5e'} fillOpacity={entry.isNormalized ? 0.4 : 0.6} />
                                ))}
                            </Scatter>
                        </ScatterChart>
                    </ResponsiveContainer>
                    <div className="flex justify-center gap-4 text-[10px] text-slate-500 mt-2">
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500/60" /> Storlek representerar distans (viktad länk)</span>
                    </div>
                </div>
            )}

            {viewMode === 'trend' && filteredEfficiencyData.length === 0 && (
                <div className="h-[200px] flex items-center justify-center text-slate-500 italic bg-slate-800/50 rounded-lg border border-white/5">
                    {buckets.length === 0 ? 'Ingen pulsdata hittades för dina löppass.' : 'Ingen data för detta intervall.'}
                </div>
            )}

            {viewMode === 'timeline' && timelineData.length > 0 && (
                <div className="flex flex-col gap-4">
                    <div className="h-[280px] w-full mt-2">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart
                                data={timelineData}
                                margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
                                onClick={(data) => {
                                    if (data && data.activePayload) {
                                        const weekData = data.activePayload[0].payload as TimelineGroup;
                                        setSelectedTimelineWeek(selectedTimelineWeek?.weekLabel === weekData.weekLabel ? null : weekData);
                                    }
                                }}
                            >
                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                                <XAxis
                                    dataKey="weekLabel"
                                    stroke="#ffffff30"
                                    tick={{ fill: '#ffffff50', fontSize: 10 }}
                                />
                                <YAxis
                                    dataKey="avgMetric"
                                    type="number"
                                    name={basis === 'pace' ? "Snittpuls" : "Snitt-tempo"}
                                    domain={basis === 'pace' ? ['dataMin - 5', 'dataMax + 5'] : ['auto', 'auto']}
                                    stroke="#ffffff30"
                                    tick={{ fill: '#ffffff50', fontSize: 10 }}
                                    tickFormatter={(val: number) => basis === 'pace' ? `${Math.round(val)}` : formatPace(val)}
                                />
                                <Tooltip
                                    content={({ active, payload }) => {
                                        if (active && payload && payload.length) {
                                            const data = payload[0].payload as TimelineGroup;
                                            return (
                                                <div className="bg-slate-900 border border-indigo-500/20 p-3 rounded-xl shadow-2xl backdrop-blur-md">
                                                    <p className="font-black text-slate-200 text-xs">{data.weekLabel}</p>
                                                    <div className="border-t border-white/5 my-1 pt-1 opacity-80">
                                                        <p className="text-[10px] text-slate-400">{basis === 'pace' ? 'Snittpuls:' : 'Snitt-tempo:'} <span className="text-rose-400 font-black">{basis === 'pace' ? `${Math.round(data.avgMetric)} bpm` : formatPace(data.avgMetric)}</span></p>
                                                        <p className="text-[10px] text-slate-400">Pass: <span className="text-white font-bold">{data.runs.length} st</span></p>
                                                        <p className="text-[10px] text-slate-400">Distans: <span className="text-white font-bold">{data.totalDistance.toFixed(1)} km</span></p>
                                                    </div>
                                                    <p className="text-[8px] text-slate-500 mt-2 font-black uppercase text-center">Klicka för detaljer</p>
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                    cursor={{ stroke: '#6366f1', strokeWidth: 1, strokeDasharray: '3 3', fill: 'transparent' }}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="avgMetric"
                                    stroke="#818cf8"
                                    strokeWidth={3}
                                    dot={{ r: 4, fill: '#312e81', stroke: '#818cf8', strokeWidth: 2 }}
                                    activeDot={{ r: 6, fill: '#6366f1', stroke: '#fff' }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>

                    {selectedTimelineWeek && (
                        <div className="bg-slate-800/80 border border-indigo-500/20 rounded-xl p-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
                            <div className="flex justify-between items-center mb-3">
                                <div>
                                    <h4 className="text-indigo-400 font-bold text-sm flex items-center gap-1.5"><CalendarDays size={14} /> Inkluderade pass i {selectedTimelineWeek.weekLabel}</h4>
                                    <p className="text-[10px] text-slate-400 mt-0.5">Visar enbart data för sekvenser i vald vy ({selectedBucketRange} {basis === 'pace' ? 'min/km' : 'bpm'}).</p>
                                </div>
                                <div className="text-right">
                                    <span className="text-xs font-black text-rose-400 text-right block">{basis === 'pace' ? `${Math.round(selectedTimelineWeek.avgMetric)} bpm snitt` : `${formatPace(selectedTimelineWeek.avgMetric)} snitt`}</span>
                                </div>
                            </div>
                            <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                                {selectedTimelineWeek.runs.map((r, i) => (
                                    <div key={i} className="flex justify-between items-center p-2 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
                                        <div>
                                            <p className="text-[11px] font-bold text-slate-200">
                                                {r.date} <span className="text-slate-500 font-normal ml-1">{r.title || 'Okänt pass'}</span>
                                            </p>
                                            {r.isNormalized && (
                                                <p className="text-[9px] text-amber-500/80 mt-0.5">
                                                    Normaliserat från {r.originalBucketLabel} (Uppmätt snitt: {basis === 'pace' ? `${Math.round(r.originalMetric ?? 0)} bpm` : formatPace(r.originalMetric || 0)})
                                                </p>
                                            )}
                                        </div>
                                        <div className="flex gap-4 text-[10px]">
                                            <span className="text-slate-400">{r.distance?.toFixed(1) || '?'} km</span>
                                            <span className={`font-bold ${r.isNormalized ? 'text-amber-400' : 'text-rose-400'}`}>{basis === 'pace' ? `${Math.round(r.primaryMetric)} bpm` : formatPace(r.primaryMetric)}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {viewMode === 'timeline' && timelineData.length === 0 && (
                <div className="h-[200px] flex items-center justify-center text-slate-500 italic bg-slate-800/50 rounded-lg border border-white/5">
                    {buckets.length === 0 ? 'Ingen data hittades.' : 'Ingen data för valt intervall.'}
                </div>
            )}
        </div>
    );
}
