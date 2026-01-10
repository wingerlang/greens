import React, { useRef, useState } from 'react';
import { SummaryStats } from '../../hooks/useTrainingSummary.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import { PieChart, Pie, Cell, Tooltip } from 'recharts';
import { formatSwedishDate } from '../../utils/dateUtils.ts';

interface SummaryCardProps {
    stats: SummaryStats;
    startDate: string;
    endDate: string;
    id?: string;
}

const COLORS = {
    running: '#10b981', // emerald-500
    cycling: '#06b6d4', // cyan-500
    strength: '#8b5cf6', // violet-500
    walking: '#f59e0b', // amber-500
    other: '#64748b'    // slate-500
};

export const SummaryCard: React.FC<SummaryCardProps> = ({ stats, startDate, endDate, id }) => {
    const { user } = useAuth();

    const formattedStartDate = new Date(startDate).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' });
    const formattedEndDate = new Date(endDate).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' });

    // Calculate running-specific stats
    const runningStats = stats.types.find(t => t.name.toLowerCase() === 'running');
    const runningDist = runningStats?.dist || stats.totalDist;
    const runningTime = runningStats?.time || 0;
    const runningCount = runningStats?.count || 0;

    // Calculate strength-specific stats  
    const strengthStats = stats.types.find(t => t.name.toLowerCase() === 'strength' || t.name.toLowerCase() === 'weighttraining');
    const strengthCount = strengthStats?.count || stats.topVolumeSessions.length;

    return (
        <div
            id={id}
            className="relative bg-slate-950 text-white overflow-hidden flex flex-col justify-between p-8 border border-white/5 shadow-2xl w-[600px] min-h-[750px]"
        >
            {/* Background Gradients */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-violet-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

            {/* Header */}
            <div className="relative z-10 flex justify-between items-start mb-6">
                <div>
                    <h2 className="text-3xl font-black bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                        Sammanfattning
                    </h2>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">
                        {formattedStartDate} - {formattedEndDate}
                    </p>
                </div>
                <div className="text-right">
                    <p className="font-bold text-white">{user?.name || 'User'}</p>
                    <p className="text-[10px] text-slate-500 uppercase font-bold">GREENS</p>
                </div>
            </div>

            {/* Main Stats - 3 Column Grouped Layout */}
            <div className="relative z-10 grid grid-cols-3 gap-4 mb-6">
                {/* Löpning Column */}
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="text-lg">🏃</span>
                        <p className="text-emerald-400 text-xs font-bold uppercase">Löpning</p>
                    </div>
                    <div className="space-y-3">
                        <div>
                            <p className="text-slate-500 text-[9px] font-bold uppercase">Distans</p>
                            <p className="text-xl font-black text-white">
                                {Math.round(runningDist).toLocaleString()} <span className="text-xs text-emerald-400">km</span>
                            </p>
                        </div>
                        <div>
                            <p className="text-slate-500 text-[9px] font-bold uppercase">Tid</p>
                            <p className="text-xl font-black text-white">
                                {Math.round(runningTime / 60)} <span className="text-xs text-emerald-400">tim</span>
                            </p>
                        </div>
                        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-emerald-500/20">
                            <div>
                                <p className="text-slate-500 text-[8px] font-bold uppercase">Pass</p>
                                <p className="text-sm font-bold text-white">{runningCount}</p>
                            </div>
                            <div>
                                <p className="text-slate-500 text-[8px] font-bold uppercase">PRs</p>
                                <p className="text-sm font-bold text-white">{stats.runningPRs}</p>
                            </div>
                            <div>
                                <p className="text-slate-500 text-[8px] font-bold uppercase">Tävlingar</p>
                                <p className="text-sm font-bold text-white">{stats.raceCount}</p>
                            </div>
                        </div>
                        {stats.fastestRuns[0] && (
                            <div className="pt-2 border-t border-emerald-500/20">
                                <p className="text-slate-500 text-[8px] font-bold uppercase">Snabbaste Tempo</p>
                                <p className="text-lg font-black text-emerald-300">
                                    {((stats.fastestRuns[0].performance?.durationMinutes || 0) / (stats.fastestRuns[0].performance?.distanceKm || 1)).toFixed(2)} <span className="text-xs">min/km</span>
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Styrka Column */}
                <div className="bg-purple-500/10 border border-purple-500/30 rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="text-lg">💪</span>
                        <p className="text-purple-400 text-xs font-bold uppercase">Styrka</p>
                    </div>
                    <div className="space-y-3">
                        <div>
                            <p className="text-slate-500 text-[9px] font-bold uppercase">Total Volym</p>
                            <p className="text-xl font-black text-white">
                                {Math.round(stats.totalTonnage / 1000).toLocaleString()} <span className="text-xs text-purple-400">ton</span>
                            </p>
                        </div>
                        <div>
                            <p className="text-slate-500 text-[9px] font-bold uppercase">Tyngsta Lyft</p>
                            <p className="text-xl font-black text-white">
                                {stats.topLifts[0]?.weight || 0} <span className="text-xs text-purple-400">kg</span>
                            </p>
                        </div>
                        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-purple-500/20">
                            <div>
                                <p className="text-slate-500 text-[8px] font-bold uppercase">Pass</p>
                                <p className="text-sm font-bold text-white">{strengthCount}</p>
                            </div>
                            <div>
                                <p className="text-slate-500 text-[8px] font-bold uppercase">Övningar</p>
                                <p className="text-sm font-bold text-white">{stats.uniqueExercises}</p>
                            </div>
                            <div>
                                <p className="text-slate-500 text-[8px] font-bold uppercase">PRs</p>
                                <p className="text-sm font-bold text-white">{stats.strengthPRs}</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-purple-500/20">
                            <div>
                                <p className="text-slate-500 text-[8px] font-bold uppercase">Set</p>
                                <p className="text-sm font-bold text-white">{stats.totalSets.toLocaleString()}</p>
                            </div>
                            <div>
                                <p className="text-slate-500 text-[8px] font-bold uppercase">Reps</p>
                                <p className="text-sm font-bold text-white">{stats.totalReps.toLocaleString()}</p>
                            </div>
                        </div>
                        {stats.mostTrainedExercise && (
                            <div className="pt-2 border-t border-purple-500/20">
                                <p className="text-slate-500 text-[8px] font-bold uppercase">Mest Tränade</p>
                                <p className="text-sm font-bold text-purple-300 truncate">{stats.mostTrainedExercise}</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Konsistens Column */}
                <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="text-lg">📅</span>
                        <p className="text-cyan-400 text-xs font-bold uppercase">Konsistens</p>
                    </div>
                    <div className="space-y-3">
                        <div>
                            <p className="text-slate-500 text-[9px] font-bold uppercase">Aktiva Dagar</p>
                            <p className="text-xl font-black text-white">
                                {stats.activeDays} <span className="text-xs text-cyan-400">dagar</span>
                            </p>
                        </div>
                        <div>
                            <p className="text-slate-500 text-[9px] font-bold uppercase">Totalt Pass</p>
                            <p className="text-xl font-black text-white">
                                {stats.totalSessions} <span className="text-xs text-cyan-400">st</span>
                            </p>
                        </div>
                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-cyan-500/20">
                            <div>
                                <p className="text-slate-500 text-[8px] font-bold uppercase">Tot PRs</p>
                                <p className="text-sm font-bold text-white">{stats.totalPRs}</p>
                            </div>
                            <div>
                                <p className="text-slate-500 text-[8px] font-bold uppercase">Längsta Gap</p>
                                <p className="text-sm font-bold text-white">{stats.longestGap}d</p>
                            </div>
                        </div>
                        <div className="pt-2 border-t border-cyan-500/20">
                            <p className="text-slate-500 text-[8px] font-bold uppercase">Kalorier</p>
                            <p className="text-lg font-black text-cyan-300">
                                {Math.round(stats.totalCals).toLocaleString()} <span className="text-xs">kcal</span>
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Highlights Row */}
            <div className="relative z-10 flex gap-4 mb-6">
                {/* Best Activities */}
                <div className="flex-1 space-y-2">
                    {stats.longestRuns[0] && (
                        <div className="bg-slate-900/30 p-3 rounded-xl border border-emerald-500/20 flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-sm">🏆</div>
                            <div className="flex-1 min-w-0">
                                <p className="text-emerald-400 text-[9px] font-bold uppercase">Längsta Löpning</p>
                                <p className="text-lg font-black">{stats.longestRuns[0].performance?.distanceKm?.toFixed(1)} km</p>
                            </div>
                            <p className="text-[10px] text-slate-500">{formatSwedishDate(stats.longestRuns[0].date)}</p>
                        </div>
                    )}
                    {stats.topLifts[0] && (
                        <div className="bg-slate-900/30 p-3 rounded-xl border border-purple-500/20 flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center text-sm">🏋️</div>
                            <div className="flex-1 min-w-0">
                                <p className="text-purple-400 text-[9px] font-bold uppercase truncate">{stats.topLifts[0].exercise}</p>
                                <p className="text-lg font-black">{stats.topLifts[0].weight} kg</p>
                            </div>
                            <p className="text-[10px] text-slate-500">{formatSwedishDate(stats.topLifts[0].date)}</p>
                        </div>
                    )}
                </div>

                {/* Chart */}
                <div className="w-40 bg-slate-900/30 rounded-xl border border-white/5 flex flex-col items-center justify-center p-3">
                    <PieChart width={100} height={100}>
                        <Pie
                            data={stats.types}
                            dataKey="count"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={25}
                            outerRadius={45}
                            paddingAngle={2}
                        >
                            {stats.types.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={(COLORS as any)[entry.name.toLowerCase()] || COLORS.other} />
                            ))}
                        </Pie>
                    </PieChart>
                    <div className="mt-2 space-y-0.5 w-full">
                        {stats.types.sort((a, b) => b.count - a.count).slice(0, 3).map(t => (
                            <div key={t.name} className="flex justify-between text-[8px]">
                                <span className="capitalize text-slate-400">{t.name}</span>
                                <span className="font-bold">{t.count}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="relative z-10 pt-4 border-t border-white/10 flex justify-between items-center">
                <div className="flex gap-3">
                    <span className="text-xs font-bold text-white bg-emerald-500/20 border border-emerald-500/30 px-3 py-1.5 rounded-lg">
                        🔥 {stats.totalPRs} PRs totalt
                    </span>
                    <span className="text-xs font-bold text-white bg-slate-800 px-3 py-1.5 rounded-lg">
                        ⏱️ {Math.round(stats.totalTime / 60)}h träning
                    </span>
                </div>
                <div className="text-[10px] text-slate-500 uppercase font-bold">
                    Greens 2025
                </div>
            </div>
        </div>
    );
};
