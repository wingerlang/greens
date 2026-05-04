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
    ReferenceLine,
    Cell
} from 'recharts';
import { ExerciseEntry } from '../../../models/types.ts';
import { LayoutGrid, Info, Activity, Zap, Footprints, Timer, Trophy, TrendingUp, Medal } from 'lucide-react';
import { useData } from '../../../context/DataContext.tsx';
import { isQualitySession } from '../../../utils/activityUtils.ts';

interface RunningQuadrantChartProps {
    allRuns: ExerciseEntry[];
    onOpenActivity?: (id: string) => void;
    hoveredDate?: string | null;
    onHoverDate?: (date: string | null) => void;
}

const formatPace = (secs: number) => {
    if (!secs) return "0:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
};

const clusterData = (points: any[], xAxisKey: string, yAxisKey: string, resolution = 40) => {
    if (points.length < 300) return points.map(p => ({ ...p, clusterCount: 1 }));

    const minX = Math.min(...points.map(p => p[xAxisKey]));
    const maxX = Math.max(...points.map(p => p[xAxisKey]));
    const minY = Math.min(...points.map(p => p[yAxisKey]));
    const maxY = Math.max(...points.map(p => p[yAxisKey]));

    const rangeX = maxX - minX || 1;
    const rangeY = maxY - minY || 1;

    const clusters: Record<string, any> = {};

    points.forEach(p => {
        // Keep races separate
        if (p.isRace) {
            clusters[`race_${p.activityId}`] = { ...p, clusterCount: 1 };
            return;
        }

        let gx, gy;
        if (xAxisKey === 'timestamp') {
            // Aggressive date bucketing: cluster points within roughly 4 days
            gx = Math.floor(p[xAxisKey] / (1000 * 60 * 60 * 24 * 4));
        } else {
            gx = Math.floor(((p[xAxisKey] - minX) / rangeX) * resolution);
        }

        if (yAxisKey === 'timestamp') {
            gy = Math.floor(p[yAxisKey] / (1000 * 60 * 60 * 24 * 4));
        } else {
            gy = Math.floor(((p[yAxisKey] - minY) / rangeY) * resolution);
        }

        const key = `${gx}_${gy}`;

        if (!clusters[key]) {
            clusters[key] = {
                ...p,
                clusterCount: 1,
                sumX: p[xAxisKey],
                sumY: p[yAxisKey],
                sumPace: p.paceSecs,
                sumHr: p.hr,
                sumElevation: p.elevationGain,
                sumDist: p.distance,
                sumDur: p.duration
            };
        } else {
            const c = clusters[key];
            c.clusterCount++;
            c.sumX += p[xAxisKey];
            c.sumY += p[yAxisKey];
            c.sumPace += p.paceSecs;
            c.sumHr += p.hr;
            c.sumElevation += p.elevationGain;
            c.sumDist += p.distance;
            c.sumDur += p.duration;
        }
    });

    return Object.values(clusters).map(c => {
        if (c.clusterCount === 1) return c;
        return {
            ...c,
            [xAxisKey]: c.sumX / c.clusterCount,
            [yAxisKey]: c.sumY / c.clusterCount,
            paceSecs: c.sumPace / c.clusterCount,
            hr: c.sumHr / c.clusterCount,
            elevationGain: c.sumElevation / c.clusterCount,
            distance: c.sumDist / c.clusterCount,
            duration: c.sumDur / c.clusterCount,
            title: `${c.clusterCount} pass`,
            isCluster: true,
            // For date axes, we want to keep a representative date string
            date: c.clusterCount > 5 ? 'Flera datum' : c.date
        };
    });
};

function CustomTooltip({ active, payload, onOpenActivity }: any) {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div 
                className="bg-slate-900 border border-white/10 p-4 rounded-2xl shadow-2xl space-y-2 backdrop-blur-xl pointer-events-none"
            >
                <div className="flex justify-between items-start gap-4">
                    <div>
                        <p className="font-black text-white text-sm leading-tight">{data.title || 'Löprunda'}</p>
                        {data.isCluster && <p className="text-[9px] text-indigo-400 font-black uppercase mt-0.5">Aggregerat kluster</p>}
                    </div>
                    <p className="text-[10px] text-slate-500 font-bold whitespace-nowrap">{data.isCluster ? 'Snittvärden' : data.date}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/5">
                    <div>
                        <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Distans</p>
                        <p className="text-xs text-white font-mono font-black">{data.distance.toFixed(2)} km</p>
                    </div>
                    <div>
                        <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Tempo</p>
                        <p className="text-xs text-emerald-400 font-mono font-black">
                            {formatPace(data.paceSecs)}
                            {data.elapsedTimeSeconds && Math.abs(data.elapsedTimeSeconds - (data.duration * 60)) > 0.1 && (
                                <span className="text-[9px] text-slate-500 ml-1 block"> {formatPace(data.elapsedTimeSeconds / (data.distance || 1))} (T)</span>
                            )}
                        </p>
                    </div>
                    <div>
                        <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Puls</p>
                        <p className="text-xs text-rose-400 font-mono font-black">
                            {data.excludeHeartRate ? <span className="text-slate-500 italic">Dold</span> : `${Math.round(data.hr) || '-'} bpm`}
                        </p>
                    </div>
                    <div>
                        <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Tid</p>
                        <p className="text-xs text-sky-400 font-mono font-black">
                            {Math.floor(data.duration)} min
                            {data.elapsedTimeSeconds && Math.abs(data.elapsedTimeSeconds - (data.duration * 60)) > 0.1 && (
                                <span className="text-[9px] text-slate-500 ml-1"> (Tot: {Math.round(data.elapsedTimeSeconds / 60)}m)</span>
                            )}
                        </p>
                    </div>
                    <div className="col-span-2 border-t border-white/5 pt-2 mt-1">
                        <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Höjdmeter</p>
                        <p className="text-xs text-amber-400 font-mono font-black">{data.elevationGain || 0} m</p>
                    </div>
                </div>
            </div>
        );
    }
    return null;
}

export function RunningQuadrantChart({ allRuns, onOpenActivity, hoveredDate, onHoverDate }: RunningQuadrantChartProps) {
    const { userSettings } = useData();
    const longRunThreshold = userSettings?.longRunThreshold || 20;

    const [xAxisMode, setXAxisMode] = React.useState<'distance' | 'hr' | 'elevation' | 'date' | 'pace'>('distance');
    const [yAxisMode, setYAxisMode] = React.useState<'pace' | 'hr' | 'elevation' | 'date' | 'distance'>('distance');
    const [activeFilters, setActiveFilters] = React.useState<Set<string>>(new Set(['all']));
    const [distRange, setDistRange] = React.useState<[number, number]>([0, 1000]);
    const [intensityFilter, setIntensityFilter] = React.useState<'all' | 'high' | 'moderate' | 'low'>('all');
    const [showTrendline, setShowTrendline] = React.useState(false);

    const toggleFilter = (id: string) => {
        const next = new Set(activeFilters);
        if (id === 'all') {
            next.clear();
            next.add('all');
        } else {
            next.delete('all');
            if (next.has(id)) {
                next.delete(id);
                if (next.size === 0) next.add('all');
            } else {
                next.add(id);
            }
        }
        setActiveFilters(next);
    };

    const data = useMemo(() => {
        return allRuns.map(run => ({
            activityId: run.id,
            date: run.date.split('T')[0],
            distance: run.distance || 0,
            duration: run.durationMinutes || 0,
            elapsedTimeSeconds: run.performance?.elapsedTimeSeconds || (run.durationMinutes * 60),
            paceSecs: (run.durationMinutes * 60) / (run.distance || 1),
            hr: run.excludeHeartRate ? 0 : (run.heartRateAvg || 0),
            excludeHeartRate: run.excludeHeartRate || false,
            elevationGain: run.elevationGain || run.performance?.elevationGain || 0,
            intensity: run.intensity,
            title: run.title || run.notes?.substring(0, 40),
            isRace: run.isRace === true || 
                    run.subType === 'race' || 
                    run.subType === 'competition' ||
                    run.performance?.subType === 'race' || 
                    run.performance?.subType === 'competition' ||
                    run.category === 'RACE' ||
                    run.performance?.activityType === 'race',
            isLongRun: (run.distance || 0) >= longRunThreshold && (run.distance || 0) < 44,
            isUltra: (run.distance || 0) >= 44,
            isInterval: isQualitySession(run),
            timestamp: new Date(run.date).getTime()
        })).filter(d => d.distance > 0 && d.paceSecs < 600);
    }, [allRuns]);

    const filteredData = useMemo(() => {
        return data.filter(d => {
            // Category Filters (OR logic between selected categories)
            if (!activeFilters.has('all')) {
                let match = false;
                if (activeFilters.has('race') && d.isRace) match = true;
                if (activeFilters.has('long') && d.isLongRun) match = true;
                if (activeFilters.has('ultra') && d.isUltra) match = true;
                if (activeFilters.has('interval') && d.isInterval) match = true;
                if (!match) return false;
            }

            // Distance Range Filter
            if (d.distance < distRange[0] || d.distance > distRange[1]) return false;

            // Intensity Filter
            if (intensityFilter !== 'all' && d.intensity !== intensityFilter) return false;
            return true;
        });
    }, [data, activeFilters, intensityFilter, distRange]);

    const { distBuckets, totalRuns, medians, thresholds, chartData, trendData: regressionPoints } = useMemo(() => {
        let thresholdsList: number[] = [];
        let labelsList: string[] = [];
        if (xAxisMode === 'distance') {
            thresholdsList = [0, 5, 10, 15, 21.1, 42.2, 50, 80.5];
            labelsList = ['0-5k', '5-10k', '10-15k', '15-21.1k', '21.1-42.2k', 'Maraton-50k', '50k-50m', 'Ultra+'];
        } else if (xAxisMode === 'hr') {
            thresholdsList = [0, 120, 140, 150, 160, 170, 180, 200];
            labelsList = ['<120', '120-140', '140-150', '150-160', '160-170', '170-180', '180-200', '200+'];
        } else if (xAxisMode === 'elevation') {
            thresholdsList = [0, 50, 100, 200, 400, 800, 1500, 3000];
            labelsList = ['0-50m', '50-100m', '100-200m', '200-400m', '400-800m', '800-1500m', '1500-3000m', '3000m+'];
        } else if (xAxisMode === 'pace') {
            thresholdsList = [0, 240, 270, 300, 330, 360, 420, 540];
            labelsList = ['<4:00', '4:00-4:30', '4:30-5:00', '5:00-5:30', '5:30-6:00', '6:00-7:00', '7:00-9:00', '9:00+'];
        } else if (xAxisMode === 'date') {
            const minTs = Math.min(...filteredData.map(d => d.timestamp));
            const maxTs = Math.max(...filteredData.map(d => d.timestamp));
            const step = (maxTs - minTs) / 6;
            thresholdsList = Array.from({ length: 7 }, (_, i) => minTs + i * step);
            labelsList = thresholdsList.map(t => new Date(t).toLocaleDateString('sv-SE', { month: 'short', year: '2-digit' }));
        }
        
        const buckets = labelsList.map((label, i) => {
            const min = thresholdsList[i];
            const max = thresholdsList[i+1] || (xAxisMode === 'date' ? Infinity : Infinity);
            const runs = filteredData.filter(d => {
                const val = xAxisMode === 'distance' ? d.distance : xAxisMode === 'hr' ? d.hr : xAxisMode === 'elevation' ? d.elevationGain : xAxisMode === 'pace' ? d.paceSecs : d.timestamp;
                return val >= min && val < max && (xAxisMode !== 'hr' || (d.hr > 50 && !d.excludeHeartRate));
            });
            const avgPace = runs.length > 0 ? runs.reduce((sum, r) => sum + r.paceSecs, 0) / runs.length : 0;
            return { label, min, max, count: runs.length, avgPace };
        });

        const validData = (xAxisMode === 'hr' || yAxisMode === 'hr') ? filteredData.filter(d => d.hr > 50 && !d.excludeHeartRate) : filteredData;

        const sortedX = [...validData].sort((a, b) => {
            const valA = xAxisMode === 'distance' ? a.distance : xAxisMode === 'hr' ? a.hr : xAxisMode === 'elevation' ? a.elevationGain : xAxisMode === 'pace' ? a.paceSecs : a.timestamp;
            const valB = xAxisMode === 'distance' ? b.distance : xAxisMode === 'hr' ? b.hr : xAxisMode === 'elevation' ? b.elevationGain : xAxisMode === 'pace' ? b.paceSecs : b.timestamp;
            return valA - valB;
        });
        
        const sortedY = [...validData].sort((a, b) => {
            const valA = yAxisMode === 'pace' ? a.paceSecs : yAxisMode === 'hr' ? a.hr : yAxisMode === 'elevation' ? a.elevationGain : yAxisMode === 'distance' ? a.distance : a.timestamp;
            const valB = yAxisMode === 'pace' ? b.paceSecs : yAxisMode === 'hr' ? b.hr : yAxisMode === 'elevation' ? b.elevationGain : yAxisMode === 'distance' ? b.distance : b.timestamp;
            return valA - valB;
        });
        
        const getMedian = (arr: any[], mode: 'distance'|'hr'|'elevation'|'pace'|'date') => {
            if (arr.length === 0) return 0;
            const mid = arr[Math.floor(arr.length / 2)];
            if (mode === 'distance') return mid.distance;
            if (mode === 'hr') return mid.hr;
            if (mode === 'elevation') return mid.elevationGain;
            if (mode === 'date') return mid.timestamp;
            return mid.paceSecs;
        };

        const calculatedMedians = {
            x: getMedian(sortedX, xAxisMode),
            y: getMedian(sortedY, yAxisMode)
        };

        const xKey = xAxisMode === 'distance' ? 'distance' : xAxisMode === 'hr' ? 'hr' : xAxisMode === 'elevation' ? 'elevationGain' : xAxisMode === 'pace' ? 'paceSecs' : 'timestamp';
        const yKey = yAxisMode === 'pace' ? 'paceSecs' : yAxisMode === 'hr' ? 'hr' : yAxisMode === 'elevation' ? 'elevationGain' : yAxisMode === 'distance' ? 'distance' : 'timestamp';
        
        const clustered = clusterData(validData, xKey, yKey, 75);

        // Simple Linear Regression for Trendline
        let trendData: any[] = [];
        if (showTrendline && validData.length > 2) {
            const xData = validData.map(d => d[xKey]);
            const yData = validData.map(d => d[yKey]);
            const n = xData.length;
            const sumX = xData.reduce((a, b) => a + b, 0);
            const sumY = yData.reduce((a, b) => a + b, 0);
            const sumXY = xData.reduce((sum, x, i) => sum + x * yData[i], 0);
            const sumXX = xData.reduce((sum, x) => sum + x * x, 0);
            const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
            const intercept = (sumY - slope * sumX) / n;
            
            const minXVal = Math.min(...xData);
            const maxXVal = Math.max(...xData);
            trendData = [
                { [xKey]: minXVal, [yKey]: slope * minXVal + intercept, isTrend: true },
                { [xKey]: maxXVal, [yKey]: slope * maxXVal + intercept, isTrend: true }
            ];
        }

        return { 
            distBuckets: buckets, 
            totalRuns: validData.length, 
            medians: calculatedMedians, 
            thresholds: thresholdsList,
            chartData: clustered,
            trendData
        };
    }, [filteredData, xAxisMode, yAxisMode, showTrendline]);

    if (data.length === 0) return null;

    return (
        <div className="bg-slate-900 border border-white/5 rounded-2xl p-4 md:p-6 shadow-2xl space-y-6 overflow-hidden relative">
            {/* Background Gradients for Quadrants */}
            <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 opacity-[0.03] pointer-events-none">
                <div className="bg-amber-500" /> {/* Top Left: Speed */}
                <div className="bg-emerald-500" /> {/* Top Right: Quality */}
                <div className="bg-sky-500" />    {/* Bottom Left: Recovery */}
                <div className="bg-indigo-500" /> {/* Bottom Right: Base */}
            </div>

            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 relative z-10">
                <div>
                    <h2 className="text-xl font-black text-white flex items-center gap-2">
                        <LayoutGrid size={20} className="text-indigo-400" /> Träningsprofil & Passfördelning
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">
                        Visualisering av alla löppass baserat på X-axel och tempo. Kvadranterna utgår från dina personliga medianvärden.
                    </p>
                </div>
                <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-slate-500 uppercase w-12">X-Axel:</span>
                        <div className="flex bg-slate-800 border border-white/5 p-0.5 rounded-lg">
                            {[
                                { id: 'distance', label: 'Distans' },
                                { id: 'pace', label: 'Tempo' },
                                { id: 'hr', label: 'Puls' },
                                { id: 'elevation', label: 'Höjd' },
                                { id: 'date', label: 'Datum' }
                            ].map(d => (
                                <button 
                                    key={d.id}
                                    onClick={() => setXAxisMode(d.id as any)}
                                    className={`px-3 py-1 text-[9px] font-black uppercase rounded transition-all ${xAxisMode === d.id ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
                                >
                                    {d.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-slate-500 uppercase w-12 text-right pr-2">Y:</span>
                        <div className="flex bg-slate-800 border border-white/5 p-0.5 rounded-lg">
                            {[
                                { id: 'pace', label: 'Tempo' },
                                { id: 'distance', label: 'Distans' },
                                { id: 'hr', label: 'Puls' },
                                { id: 'elevation', label: 'Höjd' },
                                { id: 'date', label: 'Datum' }
                            ].map(d => (
                                <button 
                                    key={d.id}
                                    onClick={() => setYAxisMode(d.id as any)}
                                    className={`px-3 py-1 text-[9px] font-black uppercase rounded transition-all ${yAxisMode === d.id ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
                                >
                                    {d.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 bg-white/[0.02] border border-white/5 p-3 rounded-xl relative z-10">
                <div className="flex flex-wrap items-center gap-2 border-r border-white/5 pr-4 mr-2">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mr-2">Typ:</span>
                    {[
                        { id: 'all', label: 'Alla', icon: Activity },
                        { id: 'race', label: 'Tävling', icon: Trophy, color: 'text-amber-400' },
                        { id: 'interval', label: 'Intervaller', icon: Zap, color: 'text-rose-400' },
                        { id: 'long', label: 'Långpass', icon: Footprints, color: 'text-sky-400' },
                        { id: 'ultra', label: 'Ultra', icon: Medal, color: 'text-indigo-400' }
                    ].map(f => (
                        <button 
                            key={f.id}
                            onClick={() => toggleFilter(f.id)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all whitespace-nowrap ${activeFilters.has(f.id) ? 'bg-slate-800 border-white/10 text-white shadow-lg' : 'bg-transparent border-white/5 text-slate-600 hover:text-slate-400'}`}
                        >
                            <f.icon size={14} className={activeFilters.has(f.id) ? (f.color || 'text-indigo-400') : 'text-slate-700'} />
                            <span className="text-[10px] font-black uppercase tracking-widest">{f.label}</span>
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-2 border-r border-white/5 pr-4 mr-2">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mr-2">Distans:</span>
                    <div className="flex bg-slate-800 border border-white/5 p-0.5 rounded-lg">
                        {[
                            { label: 'Alla', range: [0, 1000] },
                            { label: '5-10k', range: [5, 10] },
                            { label: '10-21k', range: [10, 21.1] },
                            { label: '21-42k', range: [21.1, 42.2] },
                            { label: 'Ultra', range: [42.2, 1000] }
                        ].map((p, i) => (
                            <button 
                                key={i}
                                onClick={() => setDistRange(p.range as [number, number])}
                                className={`px-2.5 py-1 text-[9px] font-black uppercase rounded transition-all ${distRange[0] === p.range[0] && distRange[1] === p.range[1] ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-white'}`}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex items-center gap-2 border-r border-white/5 pr-4 mr-2">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Intensitet:</span>
                    <div className="flex bg-slate-800 border border-white/5 p-0.5 rounded-lg">
                        {[
                            { id: 'all', label: 'Alla' },
                            { id: 'high', label: 'Hög' },
                            { id: 'moderate', label: 'Medel' },
                            { id: 'low', label: 'Låg' }
                        ].map(f => (
                            <button 
                                key={f.id}
                                onClick={() => setIntensityFilter(f.id as any)}
                                className={`px-2.5 py-1 text-[9px] font-black uppercase rounded transition-all ${intensityFilter === f.id ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-white'}`}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                </div>

                <button 
                    onClick={() => setShowTrendline(!showTrendline)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all ${showTrendline ? 'bg-indigo-600/20 border-indigo-500/30 text-indigo-400' : 'bg-transparent border-white/5 text-slate-600'}`}
                >
                    <TrendingUp size={14} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Trendlinje</span>
                </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 relative z-10">
                <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                    <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1">⚡️ Speed / Sprints</p>
                    <p className="text-[9px] text-slate-500 leading-tight">Korta och snabba pass. Intervaller och fartlek.</p>
                </div>
                <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                    <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1">🏁 Quality / Race</p>
                    <p className="text-[9px] text-slate-500 leading-tight">Längre pass med högt tempo. Tröskel och tävling.</p>
                </div>
                <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                    <p className="text-[10px] font-black text-sky-500 uppercase tracking-widest mb-1">🍃 Recovery / Easy</p>
                    <p className="text-[9px] text-slate-500 leading-tight">Korta återhämtningspass i lugnt tempo.</p>
                </div>
                <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                    <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-1">🏔️ Base / Long</p>
                    <p className="text-[9px] text-slate-500 leading-tight">Långpass och mängdträning i lugnt tempo.</p>
                </div>
            </div>

            <div className="h-[450px] w-full relative z-10 group">
                <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 20, right: 40, left: 0, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={true} />
                        
                        <XAxis 
                            type="number" 
                            dataKey={xAxisMode === 'distance' ? 'distance' : xAxisMode === 'hr' ? 'hr' : xAxisMode === 'elevation' ? 'elevationGain' : xAxisMode === 'pace' ? 'paceSecs' : 'timestamp'}
                            name={xAxisMode === 'distance' ? 'Distans' : xAxisMode === 'hr' ? 'Puls' : xAxisMode === 'elevation' ? 'Höjdmeter' : xAxisMode === 'pace' ? 'Tempo' : 'Datum'}
                            unit={xAxisMode === 'distance' ? ' km' : xAxisMode === 'hr' ? ' bpm' : xAxisMode === 'elevation' ? ' m' : xAxisMode === 'pace' ? '' : ''}
                            stroke="#ffffff30"
                            tick={{ fill: '#ffffff50', fontSize: 10, fontWeight: 'bold' }}
                            reversed={xAxisMode === 'pace'}
                            tickFormatter={xAxisMode === 'date' ? (val) => new Date(val).toLocaleDateString('sv-SE', { day: '2-digit', month: 'short' }) : xAxisMode === 'pace' ? formatPace : undefined}
                            label={{ 
                                value: xAxisMode === 'distance' ? 'Distans (km)' : xAxisMode === 'hr' ? 'Puls (bpm)' : xAxisMode === 'elevation' ? 'Höjdmeter (m)' : xAxisMode === 'pace' ? 'Tempo (min/km)' : 'Datum', 
                                position: 'bottom', 
                                fill: '#ffffff30', 
                                fontSize: 10, 
                                fontWeight: 'black', 
                                offset: 0 
                            }}
                            domain={xAxisMode === 'hr' ? [100, 200] : xAxisMode === 'date' ? ['dataMin', 'dataMax'] : xAxisMode === 'pace' ? ['dataMin - 10', 'dataMax + 10'] : [0, 'dataMax + 2']}
                        />

                        {/* Y-Axis */}
                        <YAxis 
                            type="number" 
                            dataKey={yAxisMode === 'pace' ? 'paceSecs' : yAxisMode === 'hr' ? 'hr' : yAxisMode === 'elevation' ? 'elevationGain' : yAxisMode === 'distance' ? 'distance' : 'timestamp'}
                            name={yAxisMode === 'pace' ? 'Tempo' : yAxisMode === 'hr' ? 'Puls' : yAxisMode === 'elevation' ? 'Höjdmeter' : yAxisMode === 'distance' ? 'Distans' : 'Datum'}
                            reversed={yAxisMode === 'pace'} 
                            stroke="#ffffff30"
                            tick={{ fill: '#ffffff50', fontSize: 10, fontWeight: 'bold' }}
                            tickFormatter={yAxisMode === 'pace' ? formatPace : yAxisMode === 'date' ? (val) => new Date(val).toLocaleDateString('sv-SE', { month: 'short' }) : (val) => val.toString()}
                            label={{ 
                                value: yAxisMode === 'pace' ? 'Tempo (min/km)' : yAxisMode === 'hr' ? 'Puls (bpm)' : yAxisMode === 'elevation' ? 'Höjdmeter (m)' : yAxisMode === 'distance' ? 'Distans (km)' : 'Datum', 
                                angle: -90, 
                                position: 'insideLeft', 
                                fill: '#ffffff30', 
                                fontSize: 10, 
                                fontWeight: 'black' 
                            }}
                            domain={yAxisMode === 'hr' ? [100, 200] : yAxisMode === 'date' ? ['dataMin', 'dataMax'] : ['dataMin - 5', 'dataMax + 5']}
                        />

                        <ZAxis type="number" dataKey="clusterCount" range={[40, 600]} />

                        <Tooltip 
                            content={<CustomTooltip onOpenActivity={onOpenActivity} />} 
                            cursor={{ strokeDasharray: '3 3', stroke: '#ffffff20' }} 
                            onMouseMove={(data: any) => {
                                if (data && data.activePayload && onHoverDate) {
                                    onHoverDate(data.activePayload[0].payload.date);
                                }
                            }}
                        />

                        {/* Quadrant Dividers */}
                        <ReferenceLine x={medians.x} stroke="#ffffff10" strokeDasharray="5 5" />
                        <ReferenceLine y={medians.y} stroke="#ffffff10" strokeDasharray="5 5" />

                        {/* X-Axis Reference Lines */}
                        {thresholds.filter(t => t > 0 && t !== Infinity).map((dist, i) => {
                            if (i === thresholds.length - 1 && xAxisMode === 'distance') return null; // Skip 80.5 label overlapping
                            return (
                                <ReferenceLine 
                                    key={dist} 
                                    x={dist} 
                                    stroke="#ffffff15" 
                                    label={{ 
                                        position: 'insideBottomRight', 
                                        value: xAxisMode === 'distance' ? (dist === 80.5 ? '50m' : `${dist}k`) : xAxisMode === 'hr' ? `${dist}bpm` : xAxisMode === 'elevation' ? `${dist}m` : xAxisMode === 'pace' ? formatPace(dist) : new Date(dist).toLocaleDateString('sv-SE', { month: 'short' }), 
                                        fill: '#ffffff20', 
                                        fontSize: 9,
                                        fontWeight: 'black',
                                        offset: 10
                                    }} 
                                />
                            );
                        })}

                        <Scatter 
                            name="Löppass" 
                            data={chartData}
                            isAnimationActive={false}
                            onMouseMove={(data) => {
                                if (data && data.date && onHoverDate) {
                                    onHoverDate(data.date);
                                }
                            }}
                            onMouseLeave={() => onHoverDate?.(null)}
                        >
                            {chartData.map((entry: any, index: number) => {
                                // Determine color based on quadrant
                                const valX = xAxisMode === 'distance' ? entry.distance : xAxisMode === 'hr' ? entry.hr : xAxisMode === 'elevation' ? entry.elevationGain : xAxisMode === 'pace' ? entry.paceSecs : entry.timestamp;
                                const valY = yAxisMode === 'pace' ? entry.paceSecs : yAxisMode === 'hr' ? entry.hr : yAxisMode === 'elevation' ? entry.elevationGain : yAxisMode === 'distance' ? entry.distance : entry.timestamp;
                                
                                const isXHigh = valX > medians.x;
                                const isYHigh = yAxisMode === 'pace' ? (valY < medians.y) : (valY > medians.y); // Pace: Lower is higher performance
                                
                                let color = "#94a3b8"; // Default
                                if (isYHigh && !isXHigh) color = "#fbbe24"; // Top Left: Amber
                                if (isYHigh && isXHigh) color = "#10b981";  // Top Right: Emerald
                                if (!isYHigh && !isXHigh) color = "#0ea5e9"; // Bottom Left: Sky
                                if (!isYHigh && isXHigh) color = "#6366f1";  // Bottom Right: Indigo

                                const isHovered = hoveredDate === entry.date;
                                const opacity = entry.intensity === 'high' ? 0.9 : entry.intensity === 'moderate' ? 0.6 : 0.4;
                                
                                return (
                                    <Cell 
                                        key={`cell-${index}`} 
                                        fill={isHovered ? '#3b82f6' : color} 
                                        fillOpacity={isHovered ? 1.0 : (entry.isCluster ? 0.3 : opacity)}
                                        stroke={isHovered ? '#fff' : (entry.isRace ? '#fbbf24' : color)}
                                        strokeWidth={isHovered ? 3 : (entry.isRace ? 1 : entry.isCluster ? 0.5 : 1)}
                                        className="transition-all duration-300 cursor-pointer"
                                        onClick={() => !entry.isCluster && onOpenActivity?.(entry.activityId)}
                                    />
                                );
                            })}
                        </Scatter>

                        {showTrendline && (
                            <Scatter 
                                name="Trendlinje" 
                                data={regressionPoints} 
                                line={{ stroke: '#6366f1', strokeWidth: 2, strokeDasharray: '5 5' }} 
                                shape={() => null} 
                                isAnimationActive={false}
                            />
                        )}
                    </ScatterChart>
                </ResponsiveContainer>

                {/* Quadrant Labels inside the chart area */}
                <div className="absolute top-8 left-16 pointer-events-none opacity-20">
                    <p className="text-[10px] font-black text-amber-500 uppercase tracking-[0.2em]">Speed</p>
                </div>
                <div className="absolute top-8 right-8 pointer-events-none opacity-20 text-right">
                    <p className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em]">Quality</p>
                </div>
                <div className="absolute bottom-12 left-16 pointer-events-none opacity-20">
                    <p className="text-[10px] font-black text-sky-500 uppercase tracking-[0.2em]">Recovery</p>
                </div>
                <div className="absolute bottom-12 right-8 pointer-events-none opacity-20 text-right">
                    <p className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em]">Base</p>
                </div>
            </div>

            <div className="pt-4 border-t border-white/5 space-y-4 relative z-10">
                <div className="flex flex-wrap justify-center gap-x-6 gap-y-2">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-amber-500" />
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Fart / Intervaller</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Kvalitet / Tävling</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-sky-500" />
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Återhämtning</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-indigo-500" />
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Långpass / Bas</span>
                    </div>
                    {chartData.length < totalRuns && (
                        <div className="flex items-center gap-2 border-l border-white/10 pl-6 ml-2">
                            <Info size={12} className="text-indigo-400" />
                            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">
                                Prestandaläge: {totalRuns} pass aggregerade till {chartData.length} kluster
                            </span>
                        </div>
                    )}
                </div>

                <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <Footprints size={12} /> Fördelning per {xAxisMode === 'distance' ? 'distans' : xAxisMode === 'hr' ? 'puls' : xAxisMode === 'elevation' ? 'höjd' : xAxisMode === 'pace' ? 'tempo' : 'period'}-intervall
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
                        {distBuckets.map((b, i) => (
                            <div key={i} className="space-y-1 group/bucket">
                                <div className="flex justify-between items-end">
                                    <p className="text-[10px] font-bold text-slate-400 group-hover/bucket:text-white transition-colors">{b.label}</p>
                                    <p className="text-[9px] font-black text-indigo-400">{((b.count / totalRuns) * 100).toFixed(0)}%</p>
                                </div>
                                <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                                    <div 
                                        className="h-full bg-indigo-500 transition-all duration-500" 
                                        style={{ width: `${(b.count / totalRuns) * 100}%` }}
                                    />
                                </div>
                                <div className="flex justify-between items-center text-[9px]">
                                    <span className="text-slate-500 font-bold">{b.count} st</span>
                                    <span className="text-slate-600 font-mono italic">{b.count > 0 ? formatPace(b.avgPace) : '-'}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
