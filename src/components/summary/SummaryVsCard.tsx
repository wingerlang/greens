import React from 'react';
import { SummaryStats } from '../../hooks/useTrainingSummary.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import { formatSwedishDate, formatDuration } from '../../utils/dateUtils.ts';
import {
    Activity,
    Calendar,
    Clock,
    Zap,
    TrendingUp,
    Dumbbell,
    Layers,
    ArrowUpRight,
    ArrowDownRight
} from 'lucide-react';

interface SummaryVsCardProps {
    stats: SummaryStats;
    prevStats: SummaryStats;
    startDate: string;
    endDate: string;
    prevStartDate: string;
    prevEndDate: string;
    id?: string;
}

export const SummaryVsCard: React.FC<SummaryVsCardProps> = ({
    stats,
    prevStats,
    startDate,
    endDate,
    prevStartDate,
    prevEndDate,
    id
}) => {
    const { user } = useAuth();

    const formatTimeValue = (mins: number) => {
        const h = Math.floor(mins / 60);
        const m = Math.round(mins % 60);
        if (h === 0) return `${m}m`;
        if (m === 0) return `${h}h`;
        return `${h}h ${m}m`;
    };

    const getDiff = (current: number, previous: number) => {
        if (previous === 0) return current > 0 ? 100 : 0;
        return ((current - previous) / previous) * 100;
    };

    // Get year from date string
    const getYear = (d: string) => new Date(d).getFullYear();
    const currentYearRange = `${getYear(startDate)}-${getYear(endDate)}`;
    const prevYearRange = `${getYear(prevStartDate)}-${getYear(prevEndDate)}`;

    const ComparisonRow = ({
        label,
        current,
        previous,
        unit,
        icon: Icon,
        colorClass = "emerald",
        isTime = false
    }: {
        label: string,
        current: number,
        previous: number,
        unit?: string,
        icon: any,
        colorClass?: string,
        isTime?: boolean
    }) => {
        const diff = getDiff(current, previous);
        const currentDisplay = isTime ? formatTimeValue(current) : current.toLocaleString();
        const previousDisplay = isTime ? formatTimeValue(previous) : previous.toLocaleString();
        const currentWins = current > previous;
        const previousWins = previous > current;
        const tie = current === previous;

        return (
            <div className="grid grid-cols-3 items-center py-1.5 border-b border-white/5 last:border-0">
                {/* Current (LEFT) */}
                <div className="text-right pr-4">
                    <span className={`text-lg font-black transition-colors ${currentWins ? `text-${colorClass}-400` : previousWins ? 'text-slate-500' : `text-${colorClass}-400`}`}>
                        {currentDisplay}
                        {unit && !isTime && <span className={`text-[9px] ml-1 text-${colorClass}-500/60`}>{unit}</span>}
                    </span>
                </div>
                {/* Label + Diff (CENTER) */}
                <div className="flex items-center justify-center gap-1.5 px-1">
                    <div className={`p-1 bg-${colorClass}-500/10 rounded-md`}>
                        <Icon className={`w-3 h-3 text-${colorClass}-400`} />
                    </div>
                    <span className="text-[10px] font-black text-slate-300 uppercase tracking-wide">{label}</span>
                    {!tie && (
                        <span className={`flex items-center gap-0.5 text-[9px] font-black ${currentWins ? 'text-emerald-400' : 'text-red-400'}`}>
                            {currentWins ? <ArrowUpRight className="w-2 h-2" /> : <ArrowDownRight className="w-2 h-2" />}
                            {Math.abs(diff).toFixed(0)}%
                        </span>
                    )}
                </div>
                {/* Previous (RIGHT) */}
                <div className="text-left pl-4">
                    <span className={`text-base font-bold transition-colors ${previousWins ? 'text-slate-400' : currentWins ? 'text-slate-600' : 'text-slate-500'}`}>
                        {previousDisplay}
                        {unit && !isTime && <span className="text-[8px] ml-1 opacity-40">{unit}</span>}
                    </span>
                </div>
            </div>
        );
    };

    const runningStats = stats.types.find(t => t.name === 'running') || { dist: 0, time: 0, count: 0 };
    const prevRunningStats = prevStats.types.find(t => t.name === 'running') || { dist: 0, time: 0, count: 0 };
    const strengthStats = stats.types.find(t => t.name === 'strength') || { dist: 0, time: 0, count: 0 };
    const prevStrengthStats = prevStats.types.find(t => t.name === 'strength') || { dist: 0, time: 0, count: 0 };

    // Get short date format (18 dec - 18 jan)
    const formatShortDate = (d: string) => {
        const date = new Date(d);
        return `${date.getDate()} ${date.toLocaleDateString('sv-SE', { month: 'short' }).replace('.', '')}`;
    };

    return (
        <div
            id={id}
            className="relative bg-slate-950 text-white overflow-hidden flex flex-col p-4 border border-white/5 shadow-2xl w-[750px] font-sans rounded-2xl"
        >
            {/* Ambient Background */}
            <div className="absolute top-0 left-0 w-[400px] h-[400px] bg-emerald-500/10 rounded-full blur-[100px] -translate-y-1/2 -translate-x-1/2 pointer-events-none" />
            <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-indigo-500/10 rounded-full blur-[100px] translate-y-1/2 translate-x-1/2 pointer-events-none" />

            {/* Header */}
            <div className="relative z-10 flex flex-col items-center mb-2 pb-1.5 border-b border-white/10">
                <div className="text-lg font-black text-white uppercase tracking-tight">
                    {formatShortDate(startDate).toUpperCase()} — {formatShortDate(endDate).toUpperCase()} <span className="text-slate-500 text-sm">({Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24))} dagar)</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                    <div className="p-1 bg-gradient-to-br from-emerald-500 to-indigo-500 rounded-md">
                        <Layers className="w-3 h-3 text-white" />
                    </div>
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Jämförelse</span>
                </div>
            </div>


            {/* Legend with Year Ranges */}
            <div className="relative z-10 grid grid-cols-3 items-center mb-1 px-1">
                <div className="text-right pr-4">
                    <span className="text-xs font-black text-emerald-400 uppercase tracking-wide">{currentYearRange}</span>
                </div>
                <div className="text-center">
                    <span className="text-[10px] font-black text-slate-600 uppercase">vs</span>
                </div>
                <div className="text-left pl-4">
                    <span className="text-xs font-black text-slate-500 uppercase tracking-wide">{prevYearRange}</span>
                </div>
            </div>

            {/* Content */}
            <div className="relative z-10 flex-1 space-y-1">
                {/* Overall */}
                <div className="pt-2">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-500/10 to-slate-500/20" />
                        <div className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2 px-2 whitespace-nowrap">
                            📊 TOTALT
                        </div>
                        <div className="h-px flex-1 bg-gradient-to-l from-transparent via-slate-500/10 to-slate-500/20" />
                    </div>
                    <ComparisonRow label="Tid" current={Math.round(stats.totalTime)} previous={Math.round(prevStats.totalTime)} isTime icon={Clock} colorClass="emerald" />
                    <ComparisonRow label="Pass" current={stats.totalSessions} previous={prevStats.totalSessions} unit="st" icon={Zap} colorClass="amber" />
                    <ComparisonRow
                        label="Pass/dag"
                        current={Number((stats.totalSessions / Math.max(1, Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)))).toFixed(2))}
                        previous={Number((prevStats.totalSessions / Math.max(1, Math.ceil((new Date(prevEndDate).getTime() - new Date(prevStartDate).getTime()) / (1000 * 60 * 60 * 24)))).toFixed(2))}
                        icon={Calendar}
                        colorClass="amber"
                    />
                </div>

                {/* Running */}
                <div className="pt-2">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-emerald-500/10 to-emerald-500/20" />
                        <div className="text-[9px] font-black text-emerald-400 uppercase tracking-[0.2em] flex items-center gap-2 px-2 whitespace-nowrap">
                            🏃 LÖPNING
                        </div>
                        <div className="h-px flex-1 bg-gradient-to-l from-transparent via-emerald-500/10 to-emerald-500/20" />
                    </div>
                    <ComparisonRow label="km" current={Math.round(runningStats.dist)} previous={Math.round(prevRunningStats.dist)} unit="km" icon={Activity} colorClass="emerald" />
                    <ComparisonRow label="Tid" current={Math.round(runningStats.time)} previous={Math.round(prevRunningStats.time)} isTime icon={Clock} colorClass="emerald" />
                    <ComparisonRow label="Pass" current={runningStats.count} previous={prevRunningStats.count} unit="st" icon={TrendingUp} colorClass="emerald" />
                </div>

                {/* Strength */}
                <div className="pt-2">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-indigo-500/10 to-indigo-500/20" />
                        <div className="text-[9px] font-black text-indigo-400 uppercase tracking-[0.2em] flex items-center gap-2 px-2 whitespace-nowrap">
                            💪 STYRKA
                        </div>
                        <div className="h-px flex-1 bg-gradient-to-l from-transparent via-indigo-500/10 to-indigo-500/20" />
                    </div>
                    <ComparisonRow label="Tonnage" current={Number((stats.totalTonnage / 1000).toFixed(1))} previous={Number((prevStats.totalTonnage / 1000).toFixed(1))} unit="t" icon={Layers} colorClass="indigo" />
                    <ComparisonRow label="Tid" current={Math.round(strengthStats.time)} previous={Math.round(prevStrengthStats.time)} isTime icon={Clock} colorClass="indigo" />
                    <ComparisonRow label="Pass" current={strengthStats.count} previous={prevStrengthStats.count} unit="st" icon={Dumbbell} colorClass="indigo" />
                </div>
            </div>

            {/* Footer */}
            <div className="relative z-10 pt-1.5 mt-2 border-t border-white/10 flex justify-between items-center text-slate-600">
                <span className="text-[8px] font-bold uppercase tracking-wider">Greens</span>
                <span className="text-[8px] font-bold">{new Date().toLocaleDateString('sv-SE')}</span>
            </div>
        </div>
    );
};
