import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, Dumbbell, Timer, Activity, Flame, Weight, TrendingUp, Bike } from 'lucide-react';
import {
    RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
    ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Cell, Tooltip
} from 'recharts';
import { BeastStats } from './utils/beastDataService.ts';
import { getBeastTier } from './utils/beastCalculators.ts';

interface BeastProfileProps {
    stats: BeastStats;
    user: {
        name: string;
        weight: number;
        age?: number;
        avatarUrl?: string;
    };
}

export function BeastProfile({ stats, user }: BeastProfileProps) {
    const navigate = useNavigate();
    const tier = getBeastTier(stats.totalScore);

    // Data for Radar Chart
    const radarData = useMemo(() => [
        { subject: 'Cooper', A: stats.cooper.score, fullMark: 100 },
        { subject: 'Strength', A: stats.strength.score, fullMark: 100 },
        { subject: 'Oly', A: stats.weightlifting.score, fullMark: 100 },
        { subject: 'Hyrox', A: stats.hyrox.score, fullMark: 100 },
        { subject: 'Cycling', A: stats.cycling.score, fullMark: 100 },
    ], [stats]);

    // Data for Bar Chart
    const barData = useMemo(() => [
        { name: 'Cooper', score: stats.cooper.score, color: '#10b981' }, // Emerald
        { name: 'Strength', score: stats.strength.score, color: '#f59e0b' }, // Amber
        { name: 'Oly', score: stats.weightlifting.score, color: '#ef4444' }, // Red
        { name: 'Hyrox', score: stats.hyrox.score, color: '#8b5cf6' }, // Violet
        { name: 'Cycling', score: stats.cycling.score, color: '#3b82f6' }, // Blue
    ], [stats]);

    const formatTime = (seconds: number) => {
        if (!seconds) return '--:--';
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const handleNavigate = (type: 'activity' | 'workout', id?: string) => {
        if (!id) return;
        if (type === 'activity') navigate(`/activity/${id}`);
        else navigate(`/styrka?workoutId=${id}`);
    };

    return (
        <div className="w-full max-w-[1400px] mx-auto space-y-8 animate-in fade-in duration-500">

            {/* HERO HEADER */}
            <div className="relative overflow-hidden rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl p-8 md:p-12">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Trophy size={400} />
                </div>

                <div className="relative z-10 flex flex-col md:flex-row items-center gap-8 md:gap-16">
                    {/* Score Circle */}
                    <div className="relative group">
                        <div className="w-48 h-48 rounded-full border-8 border-indigo-500/30 flex items-center justify-center bg-slate-950 shadow-[0_0_40px_-10px_rgba(99,102,241,0.5)]">
                            <div className="text-center">
                                <span className="block text-6xl font-black text-white tracking-tighter">
                                    {stats.totalScore}
                                </span>
                                <span className="text-xs uppercase tracking-widest text-indigo-400 font-semibold mt-1">
                                    Beast Score
                                </span>
                            </div>
                        </div>
                        {/* Glow effect */}
                        <div className="absolute inset-0 rounded-full bg-indigo-500/20 blur-xl -z-10 group-hover:bg-indigo-500/30 transition-all duration-700"></div>
                    </div>

                    {/* Text Info */}
                    <div className="text-center md:text-left space-y-4">
                        <div className="space-y-2">
                            <h1 className="text-4xl md:text-6xl font-black text-white tracking-tight uppercase leading-none">
                                The Sum of a <span className="text-indigo-500">Beast</span>
                            </h1>
                            <p className="text-xl text-slate-400 font-light flex items-center justify-center md:justify-start gap-3">
                                <span className="font-semibold text-white">{user.name}</span>
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-600"></span>
                                <span>{user.weight}kg</span>
                                {user.age && (
                                    <>
                                        <span className="w-1.5 h-1.5 rounded-full bg-slate-600"></span>
                                        <span>{user.age} år</span>
                                    </>
                                )}
                            </p>
                        </div>

                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-500/10 border border-indigo-500/30 rounded-full">
                            <Trophy size={16} className="text-indigo-400" />
                            <span className="text-indigo-300 font-bold tracking-wide uppercase text-sm">
                                Rank: {tier}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* MAIN CONTENT GRID */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

                {/* 1. SPIDER CHART */}
                <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 min-h-[400px] flex flex-col">
                    <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                        <Activity className="text-indigo-400" size={20} />
                        Performance Profile
                    </h3>
                    <div className="flex-1 w-full h-[300px] md:h-full relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                                <PolarGrid stroke="#334155" />
                                <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 600 }} />
                                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                                <Radar
                                    name={user.name}
                                    dataKey="A"
                                    stroke="#6366f1"
                                    strokeWidth={3}
                                    fill="#6366f1"
                                    fillOpacity={0.4}
                                />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px', border: '1px solid #334155' }}
                                    itemStyle={{ color: '#818cf8', fontWeight: 'bold' }}
                                    labelStyle={{ color: '#94a3b8', marginBottom: '4px' }}
                                />
                            </RadarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 2. STATS GRID */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                    {/* Strength Card */}
                    <StatCard
                        title="Powerlifting"
                        score={stats.strength.score}
                        icon={<Dumbbell size={20} className="text-amber-400" />}
                        borderColor="border-amber-500/20"
                        bgGradient="from-amber-500/5 to-transparent"
                    >
                        <div className="space-y-2 mt-4">
                            <StatRow label="Total" value={`${stats.strength.total}kg`} bold />
                            <StatRow label="Wilks" value={stats.strength.wilks.toFixed(1)} unit="pts" />
                            <div className="h-px bg-slate-800 my-2"></div>
                            <StatRow
                                label="Squat"
                                value={`${stats.strength.squat}kg`}
                                subValue={`${(stats.strength.squat / user.weight).toFixed(2)}xBW`}
                                onClick={() => handleNavigate('workout', stats.strength.squatWorkoutId)}
                            />
                            <StatRow
                                label="Bench"
                                value={`${stats.strength.bench}kg`}
                                subValue={`${(stats.strength.bench / user.weight).toFixed(2)}xBW`}
                                onClick={() => handleNavigate('workout', stats.strength.benchWorkoutId)}
                            />
                            <StatRow
                                label="Deadlift"
                                value={`${stats.strength.deadlift}kg`}
                                subValue={`${(stats.strength.deadlift / user.weight).toFixed(2)}xBW`}
                                onClick={() => handleNavigate('workout', stats.strength.deadliftWorkoutId)}
                            />
                        </div>
                    </StatCard>

                    {/* Weightlifting Card */}
                    <StatCard
                        title="Weightlifting"
                        score={stats.weightlifting.score}
                        icon={<Weight size={20} className="text-red-400" />}
                        borderColor="border-red-500/20"
                        bgGradient="from-red-500/5 to-transparent"
                    >
                        <div className="space-y-2 mt-4">
                            <StatRow label="Total" value={`${stats.weightlifting.total}kg`} bold />
                            <StatRow label="Sinclair" value={stats.weightlifting.sinclair.toFixed(1)} unit="pts" />
                            <div className="h-px bg-slate-800 my-2"></div>
                            <StatRow
                                label="Snatch"
                                value={`${stats.weightlifting.snatch}kg`}
                                subValue={`${(stats.weightlifting.snatch / user.weight).toFixed(2)}xBW`}
                                onClick={() => handleNavigate('workout', stats.weightlifting.snatchWorkoutId)}
                            />
                            <StatRow
                                label="Clean & Jerk"
                                value={`${stats.weightlifting.cleanJerk}kg`}
                                subValue={`${(stats.weightlifting.cleanJerk / user.weight).toFixed(2)}xBW`}
                                onClick={() => handleNavigate('workout', stats.weightlifting.cleanJerkWorkoutId)}
                            />
                        </div>
                    </StatCard>

                    {/* Cycling Card */}
                    <StatCard
                        title="Cycling / FTP"
                        score={stats.cycling.score}
                        icon={<Bike size={20} className="text-blue-400" />}
                        borderColor="border-blue-500/20"
                        bgGradient="from-blue-500/5 to-transparent"
                    >
                        <div className="space-y-3 mt-4">
                            <StatRow
                                label="FTP"
                                value={`${Math.round(stats.cycling.ftp)}W`}
                                bold
                                onClick={() => handleNavigate('activity', stats.cycling.sourceActivityId)}
                            />
                            <StatRow label="Relative" value={`${stats.cycling.relativeFtp.toFixed(2)} W/kg`} fontMono />
                            {stats.cycling.date && (
                                <div
                                    className="text-[10px] text-slate-500 pt-2 text-right cursor-pointer hover:text-blue-400 transition-colors"
                                    onClick={() => handleNavigate('activity', stats.cycling.sourceActivityId)}
                                >
                                    {stats.cycling.date}
                                </div>
                            )}
                        </div>
                    </StatCard>

                    {/* Cooper Card */}
                    <StatCard
                        title="Cooper Test"
                        score={stats.cooper.score}
                        icon={<Flame size={20} className="text-emerald-400" />}
                        borderColor="border-emerald-500/20"
                        bgGradient="from-emerald-500/5 to-transparent"
                    >
                        <div className="space-y-3 mt-4">
                            <StatRow
                                label="Distance"
                                value={`${Math.round(stats.cooper.distance)}m`}
                                unit="(12 min est)"
                                bold
                                onClick={() => handleNavigate('activity', stats.cooper.sourceActivityId)}
                            />
                            <StatRow label="Avg Pace" value={`${(12 / (stats.cooper.distance / 1000)).toFixed(2)} min/km`} fontMono />
                            {stats.cooper.date && (
                                <div
                                    className="text-[10px] text-slate-500 pt-2 text-right cursor-pointer hover:text-emerald-400 transition-colors"
                                    onClick={() => handleNavigate('activity', stats.cooper.sourceActivityId)}
                                >
                                    {stats.cooper.date}
                                </div>
                            )}
                        </div>
                    </StatCard>

                    {/* Hyrox Card */}
                    <StatCard
                        title="Hyrox / Endurance"
                        score={stats.hyrox.score}
                        icon={<Timer size={20} className="text-violet-400" />}
                        borderColor="border-violet-500/20"
                        bgGradient="from-violet-500/5 to-transparent"
                    >
                        <div className="space-y-3 mt-4">
                            <StatRow
                                label="Best Time"
                                value={formatTime(stats.hyrox.timeSeconds)}
                                bold
                                onClick={() => handleNavigate('activity', stats.hyrox.sourceActivityId)}
                            />
                            {stats.hyrox.date && (
                                <div
                                    className="text-[10px] text-slate-500 pt-2 text-right cursor-pointer hover:text-violet-400 transition-colors"
                                    onClick={() => handleNavigate('activity', stats.hyrox.sourceActivityId)}
                                >
                                    {stats.hyrox.date}
                                </div>
                            )}
                        </div>
                    </StatCard>

                </div>

            </div>

            {/* 3. BREAKDOWN CHART */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8">
                <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                    <TrendingUp className="text-indigo-400" size={20} />
                    Score Breakdown
                </h3>
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={barData} layout="vertical" margin={{ left: 40, right: 40 }}>
                            <XAxis type="number" domain={[0, 100]} hide />
                            <YAxis type="category" dataKey="name" stroke="#94a3b8" fontSize={12} width={100} tickLine={false} axisLine={false} />
                            <Tooltip
                                cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px', border: '1px solid #334155' }}
                                itemStyle={{ fontWeight: 'bold' }}
                                labelStyle={{ color: '#94a3b8', marginBottom: '4px' }}
                            />
                            <Bar dataKey="score" radius={[0, 6, 6, 0]} barSize={32}>
                                {barData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

        </div>
    );
}

function StatCard({ title, score, icon, children, borderColor, bgGradient }: any) {
    return (
        <div className={`relative overflow-hidden rounded-2xl bg-slate-900 border ${borderColor} p-6 flex flex-col h-full group transition-all hover:border-opacity-50 shadow-lg hover:shadow-indigo-500/10`}>
            {/* Background Gradient */}
            <div className={`absolute inset-0 bg-gradient-to-br ${bgGradient} opacity-50 group-hover:opacity-70 transition-opacity`}></div>

            <div className="relative z-10 h-full flex flex-col">
                <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-slate-950 rounded-lg border border-slate-800 group-hover:scale-110 transition-transform duration-300">
                            {icon}
                        </div>
                        <h4 className="font-bold text-slate-200 group-hover:text-white transition-colors">{title}</h4>
                    </div>
                    <div className="flex flex-col items-end">
                        <span className="text-3xl font-black text-white tracking-tighter group-hover:scale-105 transition-transform">{score}</span>
                        <span className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">pts</span>
                    </div>
                </div>

                <div className="flex-1 flex flex-col justify-end">
                    {children}
                </div>
            </div>
        </div>
    );
}

function StatRow({ label, value, subValue, unit, bold, fontMono, onClick }: any) {
    return (
        <div
            className={`flex justify-between items-center text-sm py-1 transition-colors group/row ${onClick ? 'cursor-pointer hover:bg-white/5 px-1 -mx-1 rounded' : ''}`}
            onClick={onClick}
        >
            <div className="flex flex-col">
                <span className="text-slate-400 group-hover/row:text-slate-300 transition-colors">{label}</span>
                {subValue && <span className="text-[10px] text-slate-600 font-semibold">{subValue}</span>}
            </div>
            <div className="flex items-baseline gap-1">
                <span className={`text-slate-200 group-hover/row:text-white transition-colors ${bold ? 'font-bold text-base' : fontMono ? 'font-mono text-xs' : 'font-medium'}`}>{value}</span>
                {unit && <span className="text-xs text-slate-500">{unit}</span>}
            </div>
        </div>
    );
}
