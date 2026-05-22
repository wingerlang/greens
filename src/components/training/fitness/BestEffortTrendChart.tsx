import React, { useMemo, useState } from 'react';
import {
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ComposedChart,
    Line,
    ReferenceLine,
    Scatter,
    ZAxis,
    Cell
} from 'recharts';
import { UniversalActivity, BestEffort } from '../../../models/types.ts';
import { getBestEffortsForActivity, PERFORMANCE_TARGETS } from '../../../utils/performanceEngine.ts';
import { Trophy, TrendingUp, Filter } from 'lucide-react';
import { format, startOfWeek } from 'date-fns';

interface BestEffortTrendChartProps {
    activities: UniversalActivity[];
    filterStartDate?: string | null;
    filterEndDate?: string | null;
    onOpenActivity?: (id: string) => void;
}

const formatTime = (seconds: number) => {
    if (!seconds) return "0:00";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m}:${s.toString().padStart(2, '0')}`;
};

const formatPace = (secs: number, distanceM: number) => {
    if (!secs || !distanceM) return "0:00";
    const paceSeconds = (secs / distanceM) * 1000;
    const m = Math.floor(paceSeconds / 60);
    const s = Math.floor(paceSeconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
};

function CustomTooltipBestEffort({ active, payload }: any) {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="bg-slate-900 border border-white/5 p-3 rounded-xl shadow-2xl space-y-1 backdrop-blur-md">
                <p className="font-black text-slate-200 text-xs">{data.date}</p>
                <p className="text-[10px] text-slate-500 font-bold mb-1 truncate max-w-[200px]">{data.activityTitle}</p>
                
                <div className="border-t border-white/5 pt-1 mt-1">
                    <div className="flex justify-between gap-4 text-xs mt-1">
                        <span className="text-slate-400">Tid:</span>
                        <span className="text-white font-mono font-black">
                            {formatTime(data.movingTime)}
                        </span>
                    </div>
                    <div className="flex justify-between gap-4 text-xs mt-0.5">
                        <span className="text-slate-400">Tempo:</span>
                        <span className="text-indigo-400 font-mono font-black">
                            {formatPace(data.movingTime, data.originalDistance || data.distance)}/km
                        </span>
                    </div>
                    {data.hr > 0 && (
                        <div className="flex justify-between gap-4 text-xs mt-0.5">
                            <span className="text-slate-400">Puls:</span>
                            <span className="text-rose-400 font-mono font-black">
                                {data.hr} bpm
                            </span>
                        </div>
                    )}
                </div>
                {data.source && (
                    <div className="mt-2 text-right">
                        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest ${
                            data.source === 'laps' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/20' : 
                            data.source === 'strava' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/20' : 
                            'bg-slate-800 text-slate-500 border border-white/5'
                        }`}>
                            {data.source === 'laps' ? 'Laps / Intervaller' : data.source === 'strava' ? 'Strava Best Effort' : 'Splits (Utdrag)'}
                        </span>
                    </div>
                )}
                {data.isPB && (
                    <div className="mt-2 text-right">
                        <span className="text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-widest bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-end gap-1 w-fit ml-auto">
                            <Trophy size={10} /> Personbästa
                        </span>
                    </div>
                )}
            </div>
        );
    }
    return null;
}

export function BestEffortTrendChart({ activities, filterStartDate, filterEndDate, onOpenActivity }: BestEffortTrendChartProps) {
    const defaultTarget = PERFORMANCE_TARGETS.find(t => t.name === '5k') || PERFORMANCE_TARGETS[5];
    const [selectedDistance, setSelectedDistance] = useState<string>(defaultTarget.name);
    const [filterMode, setFilterMode] = useState<'all' | 'best_per_week' | 'smart'>('smart');
    const [showStrava, setShowStrava] = useState(true);
    const [showLaps, setShowLaps] = useState(true);
    const [showSplits, setShowSplits] = useState(true);
    const [showFilters, setShowFilters] = useState(false);

    const chartData = useMemo(() => {
        const target = PERFORMANCE_TARGETS.find(t => t.name === selectedDistance);
        if (!target) return [];

        const runningActivities = activities.filter(a => {
            if (a.performance?.excludeFromStats) return false;
            if (filterStartDate && a.date < filterStartDate) return false;
            if (filterEndDate && a.date > filterEndDate) return false;
            
            const type = (a.performance?.activityType || a.plan?.activityType || '').toLowerCase();
            return ['running', 'run', 'trail', 'löpning'].some(t => type.includes(t));
        });

        const allowedSources: ('strava' | 'laps' | 'splits')[] = [];
        if (showStrava) allowedSources.push('strava');
        if (showLaps) allowedSources.push('laps');
        if (showSplits) allowedSources.push('splits');

        const points = [];

        for (const activity of runningActivities) {
            const bestEfforts = getBestEffortsForActivity(activity, allowedSources);
            
            // Find effort matching the selected distance target
            const match = bestEfforts.find(be => 
                be.name === target.name || 
                be.name === target.stravaName ||
                (be.distance >= (target.km * 0.98 * 1000) && be.distance <= (target.km * 1.02 * 1000))
            );

            if (match) {
                points.push({
                    id: activity.id,
                    date: activity.date.split('T')[0],
                    timestamp: new Date(activity.date).getTime(),
                    movingTime: match.movingTime,
                    distance: match.distance,
                    hr: match.avgHeartRate || activity.performance?.avgHeartRate || 0,
                    source: match.source,
                    activityTitle: activity.plan?.title || activity.performance?.notes || activity.performance?.activityType || 'Aktivitet',
                });
            }
        }

        let sortedPoints = points.sort((a, b) => a.timestamp - b.timestamp);
        let pbTime = Infinity;

        if (filterMode === 'smart') {
            // Prune efforts that are significantly slower than a nearby effort
            const SMART_WINDOW_MS = 14 * 24 * 60 * 60 * 1000; // 14 dagar i båda riktningarna
            sortedPoints = sortedPoints.filter((p) => {
                const isDominated = sortedPoints.some(other => {
                    if (other.id === p.id) return false;
                    const isWithinWindow = Math.abs(other.timestamp - p.timestamp) <= SMART_WINDOW_MS;
                    // Dölj p om vi har ett annat pass inom 14 dagar som är mer än 2.5% snabbare
                    // Det gör att små variationer (någon sekund) behålls om man slår PB dag för dag,
                    // men det utesluter "långsamma utdrag" när man nyss har sprungit ett snabbt lopp.
                    const isSignificantlyFaster = p.movingTime > other.movingTime * 1.025;
                    return isWithinWindow && isSignificantlyFaster;
                });
                return !isDominated;
            });
        } else if (filterMode === 'best_per_week') {
            const groups = new Map<string, typeof points[0]>();
            for (const p of sortedPoints) {
                const weekStart = startOfWeek(new Date(p.timestamp), { weekStartsOn: 1 }).getTime().toString();
                const existing = groups.get(weekStart);
                if (!existing || p.movingTime < existing.movingTime) {
                    groups.set(weekStart, p);
                }
            }
            sortedPoints = Array.from(groups.values()).sort((a, b) => a.timestamp - b.timestamp);
        }

        // Find PB across ALL filtered points (the user might have filtered out Strava, etc.)
        for (const p of sortedPoints) {
            if (p.movingTime < pbTime) {
                pbTime = p.movingTime;
            }
        }

        // Calculate moving average and mark PB
        const windowSize = 3;
        for (let i = 0; i < sortedPoints.length; i++) {
            let sum = 0;
            let count = 0;
            for (let j = Math.max(0, i - windowSize + 1); j <= i; j++) {
                sum += sortedPoints[j].movingTime;
                count++;
            }
            sortedPoints[i].trendTime = sum / count;
            sortedPoints[i].isPB = sortedPoints[i].movingTime === pbTime;
            sortedPoints[i].pointSize = sortedPoints[i].isPB ? 140 : 50;
            sortedPoints[i].originalDistance = target.km * 1000;
        }

        return { points: sortedPoints, pbTime: pbTime === Infinity ? null : pbTime };
    }, [activities, selectedDistance, filterStartDate, filterEndDate, filterMode, showStrava, showLaps, showSplits]);

    // Format Y Axis ticks
    const yAxisFormatter = (val: number) => {
        return formatTime(val);
    };

    return (
        <div className="bg-slate-900 border border-white/5 rounded-2xl p-4 md:p-6 shadow-2xl space-y-4">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div>
                    <h2 className="text-xl font-black text-white flex items-center gap-2">
                        <TrendingUp className="text-indigo-400" size={20} />
                        Utveckling över distans
                    </h2>
                    <p className="text-xs text-slate-400 mt-1 mb-3">
                        Följ dina snabbaste tider på en specifik distans över tid, oavsett om det var under ett lopp, intervaller eller ett utdrag ur ett långpass.
                    </p>
                </div>
                
                <div className="flex items-center gap-2 mt-2 md:mt-0 flex-wrap justify-end">
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`p-1.5 rounded-lg flex items-center gap-1.5 text-xs font-bold transition-all border ${showFilters ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' : 'bg-slate-800 text-slate-400 border-white/5 hover:text-white'}`}
                        title="Filter"
                    >
                        <Filter size={14} />
                    </button>
                    <select
                        className="bg-slate-800 border border-white/5 text-white rounded-xl px-3 py-1.5 text-xs font-bold outline-none cursor-pointer focus:border-white/10"
                        value={selectedDistance}
                        onChange={(e) => setSelectedDistance(e.target.value)}
                    >
                        {PERFORMANCE_TARGETS.filter(t => t.km >= 0.4 && t.km <= 42.2).map(target => (
                            <option key={target.name} value={target.name}>{target.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {showFilters && (
                <div className="bg-slate-950/50 p-3 rounded-xl border border-white/5 flex flex-wrap gap-4 items-center text-xs animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center gap-2 border-r border-white/10 pr-4">
                        <span className="text-slate-500 font-bold uppercase text-[10px] tracking-wider">Aggregering</span>
                        <select
                            className="bg-transparent text-white outline-none cursor-pointer font-bold"
                            value={filterMode}
                            onChange={(e) => setFilterMode(e.target.value as any)}
                        >
                            <option value="smart" className="bg-slate-900">Endast relevanta (Smart rensning)</option>
                            <option value="all" className="bg-slate-900">Visa alla pass</option>
                            <option value="best_per_week" className="bg-slate-900">Bästa tiden per kalendervecka</option>
                        </select>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-slate-500 font-bold uppercase text-[10px] tracking-wider">Datakällor</span>
                        <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-white transition-colors">
                            <input type="checkbox" checked={showStrava} onChange={(e) => setShowStrava(e.target.checked)} className="accent-orange-500" />
                            Strava
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-white transition-colors">
                            <input type="checkbox" checked={showLaps} onChange={(e) => setShowLaps(e.target.checked)} className="accent-violet-500" />
                            Intervaller (Laps)
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-white transition-colors">
                            <input type="checkbox" checked={showSplits} onChange={(e) => setShowSplits(e.target.checked)} className="accent-blue-500" />
                            Utdrag (Splits)
                        </label>
                    </div>
                </div>
            )}

            {chartData.points.length > 0 ? (
                <div className="h-[320px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={chartData.points} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                            <XAxis
                                dataKey="timestamp"
                                type="number"
                                domain={['auto', 'auto']}
                                stroke="#ffffff30"
                                tick={{ fill: '#ffffff50', fontSize: 10 }}
                                tickFormatter={(val: number) => {
                                    const d = new Date(val);
                                    return `${d.getDate()}/${d.getMonth()+1} ${d.getFullYear().toString().substring(2)}`;
                                }}
                            />
                            <YAxis
                                dataKey="movingTime"
                                type="number"
                                name="Tid"
                                domain={['auto', 'auto']}
                                stroke="#ffffff30"
                                tick={{ fill: '#ffffff50', fontSize: 10 }}
                                tickFormatter={yAxisFormatter}
                            />
                            <ZAxis dataKey="pointSize" type="number" range={[40, 140]} />
                            <Tooltip cursor={{strokeDasharray: '3 3'}} content={<CustomTooltipBestEffort />} />
                            
                            {chartData.pbTime && (
                                <ReferenceLine 
                                    y={chartData.pbTime} 
                                    stroke="#fbbf24" 
                                    strokeDasharray="3 3" 
                                    strokeOpacity={0.3} 
                                    label={{ 
                                        position: 'insideBottomLeft', 
                                        fill: '#fbbf24', 
                                        fontSize: 10, 
                                        value: `PB: ${formatTime(chartData.pbTime)}`,
                                        opacity: 0.8
                                    }} 
                                />
                            )}

                            <Line 
                                type="monotone" 
                                dataKey="trendTime" 
                                stroke="#ffffff" 
                                strokeOpacity={0.2} 
                                strokeWidth={2} 
                                dot={false} 
                                activeDot={false} 
                                isAnimationActive={false}
                                name="Trend (Glidande medel)"
                            />

                            <Scatter 
                                name="Tid" 
                                dataKey="movingTime"
                                onClick={(data) => {
                                    if (data && data.payload && onOpenActivity) {
                                        onOpenActivity(data.payload.id);
                                    }
                                }}
                            >
                                {chartData.points.map((entry, index) => {
                                    // Use different colors based on source
                                    let color = '#3b82f6'; // Blue for splits
                                    if (entry.source === 'strava') color = '#f97316'; // Orange for strava best efforts
                                    else if (entry.source === 'laps') color = '#8b5cf6'; // Violet for laps
                                    
                                    if (entry.isPB) color = '#fbbf24'; // Gold for PB
                                    
                                    return (
                                        <Cell 
                                            key={`cell-${index}`} 
                                            fill={color} 
                                            fillOpacity={entry.isPB ? 1 : 0.8}
                                            className="cursor-pointer hover:opacity-100 transition-opacity"
                                        />
                                    );
                                })}
                            </Scatter>
                        </ComposedChart>
                    </ResponsiveContainer>
                    <div className="flex justify-between items-center text-[10px] text-slate-500 mt-2 px-2">
                        <div className="flex gap-4">
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#f97316]" /> Strava</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#8b5cf6]" /> Intervaller/Laps</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#3b82f6]" /> Splits/Utdrag</span>
                        </div>
                        <div className="flex gap-4">
                            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-[#fbbf24]" /> Personbästa i urvalet</span>
                            <span className="flex items-center gap-1 text-white/40 font-black">— Trendlinje</span>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="h-[200px] flex flex-col items-center justify-center text-slate-500 italic bg-slate-800/50 rounded-lg border border-white/5 space-y-2">
                    <Trophy className="text-slate-600 mb-2" size={32} />
                    <span>Ingen data hittades för distansen {selectedDistance}.</span>
                    <span className="text-[10px]">Träna mer eller välj en annan distans!</span>
                </div>
            )}
        </div>
    );
}
