import React, { useMemo, useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useData } from '../../context/DataContext.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { calculatePerformanceScore } from '../../utils/performanceEngine.ts';
import { formatDuration, formatSwedishDate, formatPace, getRelativeTime } from '../../utils/dateUtils.ts';
import { mapUniversalToLegacyEntry } from '../../utils/mappers.ts';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area, CartesianGrid, Legend } from 'recharts';
import { Dumbbell, Loader2, TrendingUp, History, Zap, Trophy, Medal, Target, BarChart3, Info, Clock, ArrowRight, MapPin } from 'lucide-react';
import { WeeklyVolumeChart } from './WeeklyVolumeChart.tsx';
import { WeeklyDistanceChart } from './WeeklyDistanceChart.tsx';
import { TrainingHeatmap } from './TrainingHeatmap.tsx';
import { CumulativeProgressChart } from './CumulativeProgressChart.tsx';
import { PerformanceRadar } from './PerformanceRadar.tsx';
import { MonthlyVolumeBarChart } from './MonthlyVolumeBarChart.tsx';
import { TrainingInsights } from './TrainingInsights.tsx';
import { PersonalBest } from '../../models/strengthTypes.ts';
import { calculateGoalProgress } from '../../utils/goalCalculations.ts';
import { ActivityDetailModal } from '../activities/ActivityDetailModal.tsx';
import type { UniversalActivity } from '../../models/types.ts';

function formatYearRange(years: number[]) {
    if (years.length === 0) return '';
    if (years.length === 1) return years[0].toString();

    const sorted = [...years].sort((a, b) => a - b);

    // Group consecutive years into ranges
    const ranges: { start: number; end: number }[] = [];
    let currentRange = { start: sorted[0], end: sorted[0] };

    for (let i = 1; i < sorted.length; i++) {
        if (sorted[i] === currentRange.end + 1) {
            // Consecutive year, extend current range
            currentRange.end = sorted[i];
        } else {
            // Gap found, save current range and start new one
            ranges.push(currentRange);
            currentRange = { start: sorted[i], end: sorted[i] };
        }
    }
    ranges.push(currentRange); // Don't forget the last range

    // Format each range
    return ranges.map(r =>
        r.start === r.end
            ? r.start.toString()
            : `${r.start}-${r.end}`
    ).join(', ');
}

function parseYearRange(yearsStr: string): number[] {
    const years = new Set<number>();
    const parts = yearsStr.split(/[_,]/);

    for (const part of parts) {
        if (part.includes('-')) {
            const [startStr, endStr] = part.split('-');
            const start = parseInt(startStr, 10);
            const end = parseInt(endStr, 10);
            if (!isNaN(start) && !isNaN(end) && start <= end) {
                for (let y = start; y <= end; y++) {
                    years.add(y);
                }
            }
        } else {
            const y = parseInt(part, 10);
            if (!isNaN(y)) {
                years.add(y);
            }
        }
    }

    return Array.from(years).sort((a, b) => a - b);
}

export function YearInReviewView() {
    const { universalActivities = [], strengthSessions = [], performanceGoals = [], unifiedActivities = [], isLoading, weightEntries = [], mealEntries = [], foodItems = [], recipes = [] } = useData();
    const { token } = useAuth();

    const navigate = useNavigate();
    const [strengthPBs, setStrengthPBs] = useState<PersonalBest[]>([]);
    const [paceInterval, setPaceInterval] = useState<'1d' | '1w' | '2w' | '1m' | '3m'>('2w');
    const [durationInterval, setDurationInterval] = useState<'1d' | '1w' | '2w' | '1m' | '3m'>('2w');

    const [searchParams, setSearchParams] = useSearchParams();
    const [selectedActivity, setSelectedActivity] = useState<UniversalActivity | null>(null);
    const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
    const [showSessionsList, setShowSessionsList] = useState(false);
    const [sortConfigRuns, setSortConfigRuns] = useState<{ key: 'date' | 'dist' | 'pace' | 'hr', direction: 'asc' | 'desc' }>({ key: 'dist', direction: 'desc' });


    const availableYears = useMemo(() => {
        const years = new Set<number>();
        unifiedActivities.forEach(a => {
            const y = new Date(a.date).getFullYear();
            if (!isNaN(y)) years.add(y);
        });
        strengthSessions.forEach(s => {
            const y = new Date(s.date).getFullYear();
            if (!isNaN(y)) years.add(y);
        });
        years.add(new Date().getFullYear());
        return Array.from(years).sort((a, b) => b - a);
    }, [unifiedActivities, strengthSessions]);

    const [selectedYears, setSelectedYears] = useState<number[]>(() => {
        const yearsParam = searchParams.get('years');
        if (yearsParam) return parseYearRange(yearsParam);
        const saved = localStorage.getItem('yir_years');
        if (saved) {
            try { return JSON.parse(saved); } catch (e) { /* ignore */ }
        }
        return [new Date().getFullYear()];
    });

    const plannedRaces = useMemo(() => {
        const today = new Date();
        return unifiedActivities.filter(a => {
            if (!a.date) return false;
            const actDate = new Date(a.date);
            if (actDate <= today) return false;
            if (!selectedYears.includes(actDate.getFullYear())) return false;
            
            return a.isRace || a.performance?.subType === 'race' || a.plan?.title?.toLowerCase().includes('tävling') || a.performance?.activityType === 'race';
        }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [unifiedActivities, selectedYears]);

    useEffect(() => {
        if (selectedYears.length > 0) {
            const urlParam = formatYearRange(selectedYears).replace(/,\s*/g, '_');
            const newParams = new URLSearchParams(searchParams);
            newParams.set('years', urlParam);
            setSearchParams(newParams, { replace: true });
            localStorage.setItem('yir_years', JSON.stringify(selectedYears));
        }
    }, [selectedYears, searchParams, setSearchParams]);

    const toggleYear = (year: number) => {
        setSelectedYears(prev => {
            let next;
            if (prev.includes(year)) {
                if (prev.length === 1) return prev;
                next = prev.filter(y => y !== year);
            } else {
                next = [...prev, year];
            }
            return next.sort((a, b) => a - b);
        });
    };

    useEffect(() => {
        if (!token) return;
        fetch('/api/strength/pbs', { headers: { 'Authorization': `Bearer ${token}` } })
            .then(res => res.json())
            .then(data => { if (data.pbs && Array.isArray(data.pbs)) setStrengthPBs(data.pbs); })
            .catch(err => console.error('Failed to load strength PBs', err));
    }, [token]);

    const yearlyActivities = useMemo(() => {
        const hiddenIds = new Set<string>();
        universalActivities.forEach((u: UniversalActivity) => {
            if (u.mergedIntoId) hiddenIds.add(u.id);
            if (u.mergeInfo?.isMerged && u.mergeInfo.originalActivityIds) {
                u.mergeInfo.originalActivityIds.forEach(id => hiddenIds.add(id));
            }
        });
        return universalActivities
            .filter((a: UniversalActivity) => !hiddenIds.has(a.id))
            .filter((a: UniversalActivity) => selectedYears.includes(new Date(a.date).getFullYear()))
            .sort((a: UniversalActivity, b: UniversalActivity) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [universalActivities, selectedYears]);

    const yearlyStrengthSessions = useMemo(() => {
        return strengthSessions.filter(s => selectedYears.includes(new Date(s.date).getFullYear()))
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [strengthSessions, selectedYears]);

    const yearlyGoals = useMemo(() => {
        if (selectedYears.length === 0) return [];
        const startOfYear = new Date(Math.min(...selectedYears), 0, 1).toISOString();
        const endOfYear = new Date(Math.max(...selectedYears), 11, 31, 23, 59, 59, 999).toISOString();
        return performanceGoals.filter(goal => (goal.startDate <= endOfYear && (goal.endDate || new Date().toISOString()) >= startOfYear));
    }, [performanceGoals, selectedYears]);

    const legacyActivities = useMemo(() => {
        return unifiedActivities.map(u => ({ ...mapUniversalToLegacyEntry(u as any), source: u.source }))
            .filter((a): a is any => a !== null);
    }, [unifiedActivities]);

    const stats = useMemo(() => {
        let totalDist = 0; let totalTime = 0; let totalCals = 0; let totalSessions = yearlyActivities.length;
        let totalScore = 0; let scoreCount = 0; let runningPRs = 0; let totalTonnage = 0;
        let activeDays = new Set<string>();
        const typeMap = new Map<string, { count: number, time: number, dist: number }>();
        let lastDate: Date | null = null; let longestGap = 0;

        yearlyActivities.forEach((a: UniversalActivity) => {
            const dist = a.performance?.distanceKm || 0;
            const time = a.performance?.durationMinutes || 0;
            totalDist += dist; totalTime += time; totalCals += (a.performance?.calories || 0);
            if (a.performance?.activityType === 'running') runningPRs += (a.performance?.prCount || 0);
            activeDays.add(a.date.split('T')[0]);
            const type = a.performance?.activityType || 'other';
            const curr = typeMap.get(type) || { count: 0, time: 0, dist: 0 };
            typeMap.set(type, { count: curr.count + 1, time: curr.time + time, dist: curr.dist + dist });
            const currentDate = new Date(a.date);
            if (lastDate) {
                const diffDays = Math.ceil(Math.abs(currentDate.getTime() - lastDate.getTime()) / 86400000);
                if (diffDays > longestGap) longestGap = diffDays;
            }
            lastDate = currentDate;
        });

        const strengthPRs = strengthPBs.filter(pb => selectedYears.includes(new Date(pb.date).getFullYear())).length;
        let bestLift = { weight: 0, exercise: '', activity: null as any };
        yearlyStrengthSessions.forEach(s => {
            totalTonnage += (s.totalVolume || 0);
            s.exercises.forEach(e => e.sets.forEach(set => {
                if ((set.weight || 0) > bestLift.weight) bestLift = { weight: set.weight || 0, exercise: e.exerciseName, activity: { id: s.id, date: s.date, source: 'strength', performance: { activityType: 'strength' } } };
            }));
        });

        const runningTypes = ['running', 'trail', 'trailrunning', 'trail running', 'trail_running', 'hiking', 'virtualrun', 'run'];
        const allRuns = [...yearlyActivities].filter(a => runningTypes.some(rt => (a.performance?.activityType || '').toLowerCase().includes(rt)))
            .sort((a, b) => (b.performance?.distanceKm || 0) - (a.performance?.distanceKm || 0));

        const dayTotals = new Map<string, any>();
        yearlyActivities.forEach(a => {
            if (a.performance?.subType === 'race' || ['walking', 'walk'].includes((a.performance?.activityType || '').toLowerCase())) return;
            const date = a.date.split('T')[0];
            const existing = dayTotals.get(date) || { date, totalMinutes: 0, activities: [] };
            existing.totalMinutes += (a.performance?.durationMinutes || 0);
            existing.activities.push(a);
            dayTotals.set(date, existing);
        });

        const today = new Date();
        const currentYear = today.getFullYear();
        let totalDaysToCount = 0;
        selectedYears.forEach(y => {
            if (y < currentYear) {
                const isLeap = (y % 4 === 0 && y % 100 !== 0) || (y % 400 === 0);
                totalDaysToCount += isLeap ? 366 : 365;
            } else if (y === currentYear) {
                const startOfYear = new Date(y, 0, 1);
                const diffTime = Math.abs(today.getTime() - startOfYear.getTime());
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                totalDaysToCount += diffDays;
            }
        });

        return {
            totalDist, totalTime, totalCals, totalSessions, runningPRs, strengthPRs, totalTonnage,
            activeDays: activeDays.size, types: Array.from(typeMap.entries()).map(([k, v]) => ({ name: k, ...v })),
            longestRaces: allRuns.filter(a => a.performance?.subType === 'race' || a.performance?.activityType === 'race').slice(0, 10),
            longestTrainingRuns: allRuns.filter(a => a.performance?.subType !== 'race' && a.performance?.activityType !== 'race').slice(0, 10),
            biggestTrainingDays: Array.from(dayTotals.values()).sort((a, b) => b.totalMinutes - a.totalMinutes).slice(0, 14),
            activePercentage: totalDaysToCount > 0 ? (activeDays.size / totalDaysToCount) * 100 : 0,
            topPerformances: yearlyActivities
                .filter(a => {
                    const t = (a.performance?.activityType || '').toLowerCase();
                    const dist = a.performance?.distanceKm || 0;
                    return (t.includes('run') || t.includes('löp')) && dist >= 1.0;
                })
                .map(a => ({ ...a, score: calculatePerformanceScore(a, yearlyActivities) }))
                .sort((a, b) => b.score - a.score)
                .slice(0, 5)
        };
    }, [yearlyActivities, strengthPBs, selectedYears, yearlyStrengthSessions]);

    if (isLoading && universalActivities.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-20 text-slate-400 gap-4">
                <Loader2 className="w-10 h-10 animate-spin text-emerald-500" />
                <p className="animate-pulse">Hämtar din träningshistorik...</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-700 pb-12">
            {/* Header */}
            <header className="flex flex-col md:flex-row justify-between items-end gap-6 border-b border-white/5 pb-6 relative">
                <div className="absolute top-0 left-0 w-64 h-64 bg-emerald-500/10 blur-[100px] -z-10 rounded-full"></div>
                <div>
                    <h1 className="text-4xl md:text-5xl font-black bg-gradient-to-br from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                        {formatYearRange(selectedYears)}
                    </h1>
                    <p className="text-emerald-400 uppercase tracking-widest font-bold mt-2 text-xs flex items-center gap-2">
                        <TrendingUp size={14} /> Annual Performance Review
                    </p>
                </div>

                <div className="flex gap-2 bg-slate-900/80 backdrop-blur-sm border border-white/10 rounded-xl p-1.5 overflow-x-auto max-w-full">
                    {availableYears.map(y => (
                        <button
                            key={y}
                            onClick={() => toggleYear(y)}
                            className={`px-4 py-2 rounded-lg font-bold text-xs transition-all whitespace-nowrap ${selectedYears.includes(y)
                                ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                                : 'text-slate-400 hover:text-white hover:bg-white/5'
                                }`}
                        >
                            {selectedYears.includes(y) && <span className="mr-1.5 opacity-80">✓</span>}
                            {y}
                        </button>
                    ))}
                </div>
            </header>

            {/* HERO STATS */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 relative">
                {/* Background glow for hero stats */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-1/2 bg-gradient-to-r from-emerald-500/5 via-purple-500/5 to-cyan-500/5 blur-3xl -z-10"></div>
                
                <div className="bg-slate-900/40 backdrop-blur-md p-5 rounded-xl border border-white/5 relative overflow-hidden group hover:border-emerald-500/40 hover:bg-slate-900/60 transition-all hover:-translate-y-0.5">
                    <div className="absolute -top-6 -right-6 opacity-[0.03] group-hover:opacity-10 transition-all duration-500 group-hover:rotate-12 text-emerald-400">
                        <MapPin size={100} strokeWidth={1} />
                    </div>
                    <div className="absolute top-4 right-4 opacity-20 text-emerald-400 group-hover:opacity-100 transition-opacity">
                        <MapPin size={24} />
                    </div>
                    <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-1">Total Distans</p>
                    <p className="text-3xl font-black text-white group-hover:text-emerald-50 transition-colors">
                        {Math.round(stats.totalDist).toLocaleString()} <span className="text-base text-emerald-400">km</span>
                    </p>
                </div>
                
                <div className="bg-slate-900/40 backdrop-blur-md p-5 rounded-xl border border-white/5 relative overflow-hidden group hover:border-cyan-500/40 hover:bg-slate-900/60 transition-all hover:-translate-y-0.5">
                    <div className="absolute -top-6 -right-6 opacity-[0.03] group-hover:opacity-10 transition-all duration-500 group-hover:-rotate-12 text-cyan-400">
                        <Clock size={100} strokeWidth={1} />
                    </div>
                    <div className="absolute top-4 right-4 opacity-20 text-cyan-400 group-hover:opacity-100 transition-opacity">
                        <Clock size={24} />
                    </div>
                    <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-1">Total Tid</p>
                    <p className="text-3xl font-black text-white group-hover:text-cyan-50 transition-colors">
                        {Math.round(stats.totalTime / 60).toLocaleString()} <span className="text-base text-cyan-400">h</span>
                    </p>
                </div>
                <div className="bg-slate-900/40 backdrop-blur-md p-5 rounded-xl border border-white/5 relative overflow-hidden group hover:border-purple-500/40 hover:bg-slate-900/60 transition-all hover:-translate-y-0.5">
                    <div className="absolute -top-6 -right-6 opacity-[0.03] group-hover:opacity-10 transition-all duration-500 group-hover:rotate-12 text-purple-400">
                        <Dumbbell size={100} strokeWidth={1} />
                    </div>
                    <div className="absolute top-4 right-4 opacity-20 text-purple-400 group-hover:opacity-100 transition-opacity">
                        <Dumbbell size={24} />
                    </div>
                    <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-1">Muskelvolym</p>
                    <p className="text-3xl font-black text-white group-hover:text-purple-50 transition-colors">
                        {Math.round(stats.totalTonnage / 1000).toLocaleString()} <span className="text-base text-purple-400">ton</span>
                    </p>
                </div>

                <div className="bg-slate-900/40 backdrop-blur-md p-5 rounded-xl border border-white/5 relative overflow-hidden group hover:border-amber-500/40 hover:bg-slate-900/60 transition-all hover:-translate-y-0.5">
                    <div className="absolute -top-6 -right-6 opacity-[0.03] group-hover:opacity-10 transition-all duration-500 group-hover:-rotate-12 text-amber-400">
                        <Trophy size={100} strokeWidth={1} />
                    </div>
                    <div className="absolute top-4 right-4 opacity-20 text-amber-400 group-hover:opacity-100 transition-opacity">
                        <Trophy size={24} />
                    </div>
                    <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-1">Satta PRs</p>
                    <div className="flex gap-4">
                        <div>
                            <p className="text-2xl font-black text-white group-hover:text-amber-50 transition-colors">{stats.runningPRs}</p>
                            <p className="text-[10px] text-emerald-400 font-bold uppercase">Löpning</p>
                        </div>
                        <div className="w-[1px] bg-white/10"></div>
                        <div>
                            <p className="text-2xl font-black text-white group-hover:text-amber-50 transition-colors">{stats.strengthPRs}</p>
                            <p className="text-[10px] text-purple-400 font-bold uppercase">Styrka</p>
                        </div>
                    </div>
                </div>

                <button
                    onClick={() => setShowSessionsList(!showSessionsList)}
                    className={`bg-slate-900/40 backdrop-blur-md p-5 rounded-xl border relative overflow-hidden group transition-all text-left hover:-translate-y-0.5 ${showSessionsList ? 'border-indigo-500 bg-indigo-500/10 shadow-[0_0_15px_rgba(99,102,241,0.2)]' : 'border-white/5 hover:border-indigo-500/40 hover:bg-slate-900/60'}`}
                >
                    <div className="absolute -top-6 -right-6 opacity-[0.03] group-hover:opacity-10 transition-all duration-500 group-hover:rotate-12 text-indigo-400">
                        <History size={100} strokeWidth={1} />
                    </div>
                    <div className="absolute top-4 right-4 opacity-20 text-indigo-400 group-hover:opacity-100 transition-opacity">
                        <History size={24} />
                    </div>
                    <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-1">Antal Pass</p>
                    <div className="flex items-end justify-between">
                        <p className="text-3xl font-black text-white group-hover:text-indigo-50 transition-colors">
                            {stats.totalSessions} <span className="text-base text-indigo-400">st</span>
                        </p>
                        <div className={`p-1.5 rounded-lg bg-white/5 group-hover:bg-indigo-500/20 transition-all relative z-10 ${showSessionsList ? 'bg-indigo-500/20 text-indigo-400 rotate-180' : 'text-slate-400'}`}>
                            <ArrowRight size={16} />
                        </div>
                    </div>
                </button>
            </div>

            {/* EXPANDABLE SESSIONS LIST */}
            {showSessionsList && (
                <div className="animate-in slide-in-from-top-4 fade-in duration-500">
                    <div className="bg-slate-900/40 backdrop-blur-xl border border-indigo-500/30 shadow-[0_0_30px_rgba(99,102,241,0.1)] rounded-xl p-6 overflow-hidden relative">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 blur-[80px] -z-10 rounded-full"></div>
                        <div className="flex justify-between items-center mb-6 relative z-10">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <History size={20} className="text-indigo-400" /> Detaljerad Passlista
                            </h3>
                            <button
                                onClick={() => setShowSessionsList(false)}
                                className="text-xs font-bold text-slate-500 hover:text-white uppercase tracking-widest transition-colors"
                            >
                                Stäng
                            </button>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 relative z-10">
                            {stats.types.sort((a, b) => b.count - a.count).map((type, i) => (
                                <div key={i} className="bg-slate-800/40 backdrop-blur-sm p-4 rounded-xl border border-white/5 flex flex-col items-center text-center group hover:border-indigo-500/40 hover:bg-slate-800/60 transition-all hover:-translate-y-0.5 shadow-sm">
                                    <div className="mb-2 text-slate-400 group-hover:text-indigo-400 transition-colors">
                                        {type.name.toLowerCase().includes('run') ? <Zap size={24} /> :
                                            type.name.toLowerCase().includes('strength') ? <Dumbbell size={24} /> :
                                                type.name.toLowerCase().includes('walk') ? <MapPin size={24} /> :
                                                    type.name.toLowerCase().includes('cycle') ? <Zap size={24} /> : <Target size={24} />}
                                    </div>
                                    <p className="text-xl font-black text-white">{type.count}</p>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase truncate w-full">{type.name}</p>
                                    <p className="text-[10px] text-indigo-400 font-bold mt-1">{Math.round(type.time / 60)}h</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* AI INSIGHTS */}
            <TrainingInsights activities={yearlyActivities} />

            {/* GOALS SECTION */}
            {yearlyGoals.length > 0 && (
                <div className="space-y-6">
                    <h3 className="text-xl font-bold flex items-center gap-2">
                        <Target size={20} className="text-blue-500" /> Måluppfyllelse
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {yearlyGoals.map(goal => {
                            const progress = calculateGoalProgress(goal, legacyActivities, mealEntries, foodItems, recipes, weightEntries);
                            const percent = Math.min(100, Math.round(progress.percentage));
                            const isCompleted = progress.isComplete;
                            return (
                                <div key={goal.id} className={`p-4 rounded-xl border backdrop-blur-sm transition-all hover:-translate-y-0.5 ${isCompleted ? 'bg-emerald-900/20 border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.1)]' : 'bg-slate-900/40 border-white/5 hover:border-blue-500/30'}`}>
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="text-blue-400"><Target size={24} /></div>
                                        {isCompleted && <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 text-xs font-bold rounded-full">KLARAT</span>}
                                    </div>
                                    <h4 className="font-bold text-white mb-1 truncate">{goal.title}</h4>
                                    <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                        <div className={`h-full ${isCompleted ? 'bg-emerald-500' : 'bg-blue-500'} transition-all`} style={{ width: `${percent}%` }} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ACTIVITY HEATMAP (The "GitHub-aktivitetsgrafer") */}
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
                <TrainingHeatmap
                    activities={yearlyActivities}
                    years={selectedYears}
                />
            </div>

            {/* CUMULATIVE PROGRESS & ANALYTICS */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div className="bg-slate-900/50 p-6 rounded-xl border border-white/5 space-y-6">
                    <div className="flex justify-between items-center">
                        <h3 className="text-lg font-bold flex items-center gap-2">
                            <TrendingUp size={20} className="text-emerald-500" /> Ackumulerad Distans
                        </h3>
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">År över år</div>
                    </div>
                    <div className="h-80">
                        <CumulativeProgressChart
                            activities={yearlyActivities}
                            years={selectedYears}
                        />
                    </div>
                </div>

                <div className="bg-slate-900/50 p-6 rounded-xl border border-white/5 space-y-6">
                    <div className="flex justify-between items-center">
                        <h3 className="text-lg font-bold flex items-center gap-2">
                            <Target size={20} className="text-blue-500" /> Prestationsprofil
                        </h3>
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Balans</div>
                    </div>
                    <div className="h-80">
                        <PerformanceRadar
                            stats={stats}
                            years={selectedYears}
                        />
                    </div>
                </div>
            </div>

            {/* MAIN ANALYTICS GRID */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {/* Activity Distribution */}
                <div className="bg-slate-900/50 p-6 rounded-xl border border-white/5 space-y-6">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                        <BarChart3 size={20} className="text-purple-500" /> Aktivitetsfördelning
                    </h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={stats.types}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="count"
                                >
                                    {stats.types.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={[
                                            '#10b981', '#06b6d4', '#8b5cf6', '#f59e0b', '#6366f1', '#ec4899'
                                        ][index % 6]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                                    itemStyle={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                                />
                                <Legend verticalAlign="bottom" height={36} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Training Consistency / Active Days */}
                <div className="bg-slate-900/50 p-6 rounded-xl border border-white/5 space-y-6">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                        <Zap size={20} className="text-amber-500" /> Kontinuitet
                    </h3>
                    <div className="flex flex-col items-center justify-center h-64 gap-2">
                        <div className="relative w-40 h-40">
                            <svg className="w-full h-full transform -rotate-90">
                                <circle
                                    cx="80"
                                    cy="80"
                                    r="70"
                                    fill="transparent"
                                    stroke="currentColor"
                                    strokeWidth="12"
                                    className="text-slate-800"
                                />
                                <circle
                                    cx="80"
                                    cy="80"
                                    r="70"
                                    fill="transparent"
                                    stroke="currentColor"
                                    strokeWidth="12"
                                    strokeDasharray={440}
                                    strokeDashoffset={440 - (440 * stats.activePercentage) / 100}
                                    strokeLinecap="round"
                                    className="text-emerald-500 transition-all duration-1000"
                                />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-4xl font-black text-white">{Math.round(stats.activePercentage)}%</span>
                                <span className="text-[10px] font-bold text-slate-500 uppercase">Aktiva dagar</span>
                            </div>
                        </div>
                        <p className="text-slate-400 text-sm font-medium text-center max-w-xs">
                            Du har tränat <span className="text-white font-bold">{stats.activeDays}</span> dagar under perioden.
                        </p>
                    </div>
                </div>
            </div>

            {/* TRENDS & VOLUME */}
            <div className="space-y-6">
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    <div className="bg-slate-900/50 p-6 rounded-xl border border-white/5">
                        <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                            <TrendingUp size={20} className="text-emerald-500" /> Månadsvis Distans (Löpning)
                        </h3>
                        <div className="h-64">
                            <MonthlyVolumeBarChart
                                activities={yearlyActivities}
                                year={new Date().getFullYear()}
                            />
                        </div>
                    </div>
                    <div className="bg-slate-900/50 p-6 rounded-xl border border-white/5">
                        <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                            <TrendingUp size={20} className="text-emerald-500" /> Veckovis Distans (Löpning)
                        </h3>
                        <div className="h-64">
                            <WeeklyDistanceChart
                                activities={yearlyActivities}
                                fixedYear={selectedYears.length === 1 ? selectedYears[0] : undefined}
                            />
                        </div>
                    </div>
                </div>

                <div className="bg-slate-900/50 p-6 rounded-xl border border-white/5">
                    <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                        <Dumbbell size={20} className="text-purple-500" /> Veckovis Träningsvolym (Tid)
                    </h3>
                    <div className="h-64">
                        <WeeklyVolumeChart
                            workouts={yearlyStrengthSessions}
                            fixedYear={selectedYears.length === 1 ? selectedYears[0] : undefined}
                        />
                    </div>
                </div>
            </div>

            {/* PERFORMANCE LISTS - COMPACT & SHARP */}
            <div className="space-y-8">
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                    {/* Tävlingar & Resultat */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between pb-2 border-b border-white/10">
                            <h3 className="text-xl font-bold flex items-center gap-2">
                                <Trophy size={18} className="text-amber-500" />
                                Tävlingar & Resultat
                            </h3>
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Främsta lopp</span>
                        </div>
                        
                        <div className="bg-slate-900/50 rounded-xl border border-white/5 overflow-hidden">
                            {(() => {
                                const combinedRaces = [...stats.longestRaces, ...plannedRaces].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                                return combinedRaces.length > 0 ? (
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-white/5 text-[10px] uppercase tracking-widest text-slate-500">
                                            <tr>
                                                <th className="py-2 px-4 font-bold">Lopp / Datum</th>
                                                <th className="py-2 px-4 font-bold text-right">Distans</th>
                                                <th className="py-2 px-4 font-bold text-right hidden sm:table-cell">Tid</th>
                                                <th className="py-2 px-4 font-bold text-right">Tempo</th>
                                                <th className="py-2 px-4 font-bold text-right">Puls</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {combinedRaces.map((a) => {
                                                const isFuture = new Date(a.date) > new Date();
                                                const paceSec = ((a.performance?.durationMinutes || 0) * 60) / (a.performance?.distanceKm || 1);
                                                return (
                                                    <tr key={a.id} onClick={() => setSelectedActivity(a)} className={`hover:bg-white/5 cursor-pointer transition-colors group ${isFuture ? 'opacity-50 hover:opacity-80 border-l-2 border-l-amber-500/50' : ''}`}>
                                                        <td className="py-3 px-4">
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-bold text-white group-hover:text-amber-400 transition-colors">{a.plan?.title || a.performance?.notes || 'Tävling'}</span>
                                                                {a.source === 'strava' && <span className="text-[8px] bg-orange-500/20 text-orange-400 px-1 py-0.5 rounded font-bold uppercase tracking-widest flex items-center gap-1">STRAVA</span>}
                                                                {isFuture && <span className="text-[8px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded font-bold uppercase tracking-widest">Planerad</span>}
                                                            </div>
                                                            <div className="text-[10px] text-slate-500">{formatSwedishDate(a.date)}</div>
                                                        </td>
                                                        <td className="py-3 px-4 text-right font-bold text-white">{(a.performance?.distanceKm || 0).toFixed(1)} <span className="text-[10px] text-slate-500 font-normal">km</span></td>
                                                        <td className="py-3 px-4 text-right text-slate-300 hidden sm:table-cell">{isFuture ? '—' : formatDuration((a.performance?.durationMinutes || 0) * 60)}</td>
                                                        <td className="py-3 px-4 text-right font-bold text-amber-400">{isFuture ? '—' : formatPace(paceSec)}</td>
                                                        <td className="py-3 px-4 text-right font-bold text-rose-400">
                                                            {a.performance?.avgHeartRate && !a.excludeHeartRate ? Math.round(a.performance.avgHeartRate) : '—'}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                ) : (
                                    <div className="p-8 text-center text-slate-500 italic text-sm">Inga tävlingar registrerade.</div>
                                );
                            })()}
                        </div>
                    </div>

                    {/* Longest Training Runs */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between pb-2 border-b border-white/10">
                            <h3 className="text-xl font-bold flex items-center gap-2">
                                <MapPin size={18} className="text-emerald-500" />
                                Längsta Träningspass
                            </h3>
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Uthållighet</span>
                        </div>
                        
                        <div className="bg-slate-900/50 rounded-xl border border-white/5 overflow-hidden">
                            {(() => {
                                const handleSortRuns = (key: 'date' | 'dist' | 'pace' | 'hr') => {
                                    setSortConfigRuns(prev => ({
                                        key,
                                        direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
                                    }));
                                };

                                const sortedRuns = [...stats.longestTrainingRuns].sort((a, b) => {
                                    const aDist = a.performance?.distanceKm || 0;
                                    const bDist = b.performance?.distanceKm || 0;
                                    const aPace = ((a.performance?.durationMinutes || 0) * 60) / (aDist || 1);
                                    const bPace = ((b.performance?.durationMinutes || 0) * 60) / (bDist || 1);
                                    const aHr = a.performance?.avgHeartRate || 0;
                                    const bHr = b.performance?.avgHeartRate || 0;
                                    const aDate = new Date(a.date).getTime();
                                    const bDate = new Date(b.date).getTime();

                                    const modifier = sortConfigRuns.direction === 'asc' ? 1 : -1;

                                    if (sortConfigRuns.key === 'dist') return (aDist - bDist) * modifier;
                                    if (sortConfigRuns.key === 'pace') return (aPace - bPace) * modifier;
                                    if (sortConfigRuns.key === 'hr') return (aHr - bHr) * modifier;
                                    return (aDate - bDate) * modifier;
                                });

                                return sortedRuns.length > 0 ? (
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-white/5 text-[10px] uppercase tracking-widest text-slate-500">
                                            <tr>
                                                <th className="py-2 px-4 font-bold w-8 text-center">#</th>
                                                <th className="py-2 px-4 font-bold cursor-pointer hover:text-white" onClick={() => handleSortRuns('date')}>Pass / Datum {sortConfigRuns.key === 'date' && (sortConfigRuns.direction === 'asc' ? '↑' : '↓')}</th>
                                                <th className="py-2 px-4 font-bold text-right cursor-pointer hover:text-white" onClick={() => handleSortRuns('dist')}>Distans {sortConfigRuns.key === 'dist' && (sortConfigRuns.direction === 'asc' ? '↑' : '↓')}</th>
                                                <th className="py-2 px-4 font-bold text-right hidden sm:table-cell cursor-pointer hover:text-white" onClick={() => handleSortRuns('pace')}>Tempo {sortConfigRuns.key === 'pace' && (sortConfigRuns.direction === 'asc' ? '↑' : '↓')}</th>
                                                <th className="py-2 px-4 font-bold text-right cursor-pointer hover:text-white" onClick={() => handleSortRuns('hr')}>Puls {sortConfigRuns.key === 'hr' && (sortConfigRuns.direction === 'asc' ? '↑' : '↓')}</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {sortedRuns.map((a, i) => {
                                                const paceSec = ((a.performance?.durationMinutes || 0) * 60) / (a.performance?.distanceKm || 1);
                                                return (
                                                    <tr key={a.id} onClick={() => setSelectedActivity(a)} className="hover:bg-white/5 cursor-pointer transition-colors group">
                                                        <td className="py-3 px-4 text-center text-xs font-bold text-slate-600">{i + 1}</td>
                                                        <td className="py-3 px-4">
                                                            <span className="font-bold text-white group-hover:text-emerald-400 transition-colors mr-2">{a.plan?.title || a.performance?.notes || 'Löpning'}</span>
                                                            <span className="text-[10px] text-slate-500">{formatSwedishDate(a.date)}</span>
                                                        </td>
                                                        <td className="py-3 px-4 text-right font-bold text-white">{(a.performance?.distanceKm || 0).toFixed(1)} <span className="text-[10px] text-slate-500 font-normal">km</span></td>
                                                        <td className="py-3 px-4 text-right text-slate-300 hidden sm:table-cell">{formatPace(paceSec)}</td>
                                                        <td className="py-3 px-4 text-right font-bold text-rose-400">
                                                            {a.performance?.avgHeartRate && !a.excludeHeartRate ? Math.round(a.performance.avgHeartRate) : (a.excludeHeartRate ? <span className="text-slate-600 italic font-normal">Dold 🖤</span> : '—')}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                ) : (
                                    <div className="p-8 text-center text-slate-500 italic text-sm">Inga långpass registrerade.</div>
                                );
                            })()}
                        </div>
                    </div>
                </div>

                {/* Största Träningsdagarna - Compact */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-white/10">
                        <h3 className="text-xl font-bold flex items-center gap-2">
                            <Clock size={18} className="text-indigo-500" />
                            Största Träningsdagarna
                        </h3>
                        <div className="flex items-center gap-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                            <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>Löpning</span>
                            <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>Övrigt</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {stats.biggestTrainingDays.length > 0 ? stats.biggestTrainingDays.map((day, i) => (
                            <div key={day.date} className="bg-slate-900/50 rounded-xl border border-white/5 p-4 flex flex-col gap-4 relative hover:border-indigo-500/30 transition-colors">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest flex items-center gap-1.5">
                                            <span className="text-slate-600">#{i+1}</span>
                                            {formatSwedishDate(day.date)}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-lg font-black text-white leading-none">{formatDuration(day.totalMinutes * 60)}</div>
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    {day.activities.map((act: UniversalActivity, idx: number) => {
                                        const isRunning = (act.performance?.activityType || '').toLowerCase().includes('run');
                                        return (
                                            <button
                                                key={idx}
                                                onClick={() => act.id && setSelectedActivity(act)}
                                                className={`w-full flex items-center justify-between py-1.5 px-3 rounded-md text-xs font-medium transition-colors ${
                                                    isRunning 
                                                        ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20' 
                                                        : 'bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20'
                                                }`}
                                            >
                                                <span className="truncate pr-2">{act.plan?.title || act.performance?.notes || act.performance?.activityType}</span>
                                                <span className="opacity-70 shrink-0">{Math.round(act.performance?.durationMinutes || 0)}m</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )) : (
                            <div className="col-span-full bg-slate-900/20 rounded-xl border border-dashed border-white/5 p-8 text-center text-slate-500 text-sm">
                                Ingen data tillgänglig.
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* GOALS SECTION */}
            {yearlyGoals.length > 0 && (
                <div className="space-y-6 pt-4">
                    <h3 className="text-xl font-bold flex items-center gap-2">
                        <Target size={20} className="text-blue-500" /> Måluppfyllelse
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {yearlyGoals.map(goal => {
                            const progress = calculateGoalProgress(goal, legacyActivities, mealEntries, foodItems, recipes, weightEntries);
                            const percent = Math.min(100, Math.round(progress.percentage));
                            const isCompleted = progress.isComplete;
                            return (
                                <div key={goal.id} className={`p-4 rounded-xl border backdrop-blur-sm transition-all hover:-translate-y-0.5 ${isCompleted ? 'bg-emerald-900/20 border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.1)]' : 'bg-slate-900/40 border-white/5 hover:border-blue-500/30'}`}>
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="text-blue-400"><Target size={24} /></div>
                                        {isCompleted && <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 text-xs font-bold rounded-full">KLARAT</span>}
                                    </div>
                                    <h4 className="font-bold text-white mb-1 truncate">{goal.title}</h4>
                                    <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                        <div className={`h-full ${isCompleted ? 'bg-emerald-500' : 'bg-blue-500'} transition-all`} style={{ width: `${percent}%` }} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            <div className="bg-slate-900/40 backdrop-blur-xl border border-indigo-500/20 rounded-xl p-6 flex flex-col md:flex-row items-center gap-6 mt-8 relative overflow-hidden group hover:border-indigo-500/40 transition-colors">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-gradient-to-r from-indigo-500/5 to-purple-500/5 blur-3xl -z-10"></div>
                
                <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/20 shrink-0 group-hover:scale-110 transition-transform">
                    <TrendingUp size={24} />
                </div>
                <div className="space-y-1 relative z-10">
                    <h4 className="text-white font-bold uppercase text-xs tracking-widest">Analys Sammanfattning</h4>
                    <p className="text-slate-400 text-sm leading-relaxed max-w-2xl">
                        Dina data för <span className="text-indigo-300 font-medium">{formatYearRange(selectedYears)}</span> har analyserats. Du har genomfört totalt <span className="text-white font-bold">{stats.totalSessions} pass</span> och avverkat <span className="text-white font-bold">{Math.round(stats.totalDist)} km</span>. Din träningsvolym har genererat en total lyftmängd på <span className="text-white font-bold">{Math.round(stats.totalTonnage / 1000)} ton</span>.
                    </p>
                </div>
            </div>

            {/* TOP PERFORMANCES SECTION */}
            {stats.topPerformances.length > 0 && (
                <div className="space-y-6 pt-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xl font-bold flex items-center gap-2">
                            <Zap size={20} className="text-amber-500" /> Mest Imponerande Prestationer
                        </h3>
                        <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest bg-white/5 px-2 py-1 rounded">Baserat på Greens Index (Pace + HR + Dist + Elevation)</div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        {stats.topPerformances.map((act, i) => (
                            <button
                                key={act.id}
                                onClick={() => setSelectedActivity(act)}
                                className="bg-slate-950/40 border border-white/5 rounded-2xl p-5 flex flex-col items-center gap-3 hover:border-amber-500/30 transition-all group relative overflow-hidden text-center"
                            >
                                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 to-orange-500 opacity-20"></div>
                                <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest">#{i + 1} • {formatSwedishDate(act.date)}</div>
                                <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500 font-black text-2xl border border-amber-500/20 group-hover:scale-110 transition-transform">
                                    {Math.round(act.score)}
                                </div>
                                <div className="space-y-1">
                                    <div className="text-sm font-bold text-white truncate max-w-[140px]">{act.plan?.title || act.performance?.notes || 'Löpning'}</div>
                                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                                        {(act.performance?.distanceKm || 0).toFixed(1)} km • {formatPace(act.performance?.durationMinutes * 60 / (act.performance?.distanceKm || 1))}
                                    </div>
                                    {act.performance?.elevationGain > 0 && (
                                        <div className="text-[10px] text-sky-400 font-bold flex items-center justify-center gap-1">
                                            <TrendingUp size={10} /> {Math.round(act.performance.elevationGain)}m+
                                        </div>
                                    )}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {selectedActivity && (
                <ActivityDetailModal
                    activity={mapUniversalToLegacyEntry(selectedActivity)! as any}
                    universalActivity={selectedActivity}
                    onClose={() => setSelectedActivity(null)}
                />
            )}
        </div>
    );
}
