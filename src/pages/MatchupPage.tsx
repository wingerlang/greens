import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext.tsx';
import {
    Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer,
    BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
    LineChart, Line, CartesianGrid
} from 'recharts';
import { Search, Trophy, TrendingUp, Users, Target, Zap, ArrowRight, ChevronDown, ChevronRight, Scale, Sparkles, LayoutPanelLeft } from 'lucide-react';
import { calculateWilks, calculateIPFPoints, estimate1RM } from '../utils/strengthCalculators.ts';
import './MatchupPage.css';

const MAIN_EXERCISES = [
    { id: 'squat', name: 'Knäböj', patterns: ['knäböj', 'squat', 'böj'] },
    { id: 'bench', name: 'Bänkpress', patterns: ['bänkpress', 'bench', 'bänk'] },
    { id: 'deadlift', name: 'Marklyft', patterns: ['marklyft', 'deadlift', 'mark'] },
    { id: 'overhead', name: 'Militärpress', patterns: ['militärpress', 'overhead', 'axlar'] },
    { id: 'pullups', name: 'Chins', patterns: ['chins', 'pullups', 'pull-ups'] },
];

export function MatchupPage() {
    const { users, currentUser, strengthSessions, weightEntries } = useData();
    const [opponentId, setOpponentId] = useState<string>(users.find(u => u.id !== currentUser?.id)?.id || '');
    const [viewMode, setViewMode] = useState<'raw' | 'fair'>('raw');
    const [searchQuery, setSearchQuery] = useState('');

    const opponent = useMemo(() => users.find(u => u.id === opponentId), [users, opponentId]);

    // Helper to find 1RM for a user and exercise category
    const get1RM = (userId: string, patterns: string[]) => {
        // In this local demo, sessions don't have userId, so we might need to simulate or use global
        // For the sake of the Matchup view, we'll assume current user owns some sessions and we simulate for opponent

        if (userId === currentUser?.id) {
            let max1RM = 0;
            strengthSessions.forEach(session => {
                session.exercises.forEach(ex => {
                    if (patterns.some(p => ex.name.toLowerCase().includes(p))) {
                        const estimated = estimate1RM(ex.weight || 0, ex.reps || 0);
                        if (estimated > max1RM) max1RM = estimated;
                    }
                });
            });
            return Math.round(max1RM);
        } else {
            // Simulated data for demo based on opponent ID to keep it stable
            const hash = (opponentId || '').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) || 123;
            const base = (hash % 50) + 60; // 60-110
            if (patterns.includes('squat')) return base + 60;
            if (patterns.includes('bench')) return base + 30;
            if (patterns.includes('deadlift')) return base + 80;
            if (patterns.includes('overhead')) return base + 5;
            if (patterns.includes('pullups')) return Math.round(base / 4);
            return base;
        }
    };

    const stats = useMemo(() => {
        const weightA = weightEntries[0]?.weight || 80;
        const weightB = 85; // Simulated opponent weight

        const totalA = get1RM(currentUser?.id || '', ['squat']) +
            get1RM(currentUser?.id || '', ['bench']) +
            get1RM(currentUser?.id || '', ['deadlift']);

        const totalB = get1RM(opponentId, ['squat']) +
            get1RM(opponentId, ['bench']) +
            get1RM(opponentId, ['deadlift']);

        const genderA = (currentUser?.settings?.gender === 'female' ? 'female' : 'male') as 'male' | 'female';
        const genderB = (opponent?.settings?.gender === 'female' ? 'female' : 'male') as 'male' | 'female';

        const pointsA = viewMode === 'raw' ? totalA : calculateIPFPoints(weightA, totalA, genderA);
        const pointsB = viewMode === 'raw' ? totalB : calculateIPFPoints(weightB, totalB, genderB);

        return {
            totalA, totalB,
            pointsA: Math.round(pointsA * 10) / 10,
            pointsB: Math.round(pointsB * 10) / 10,
            weightA, weightB
        };
    }, [currentUser, opponent, opponentId, strengthSessions, viewMode, weightEntries]);

    const radarData = useMemo(() => {
        return MAIN_EXERCISES.map(ex => {
            const valA = get1RM(currentUser?.id || '', ex.patterns);
            const valB = get1RM(opponentId, ex.patterns);

            // Normalize for radar (0-100% of the stronger one)
            const max = Math.max(valA, valB, 1);

            return {
                subject: ex.name,
                A: Math.round((valA / max) * 100),
                B: Math.round((valB / max) * 100),
                fullMark: 100,
                rawA: valA,
                rawB: valB
            };
        });
    }, [currentUser, opponentId, strengthSessions]);

    // Trend Simulation for Crystal Ball
    const trendData = useMemo(() => {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun'];
        return months.map((m, i) => {
            const baseA = 350 + (i * 12);
            const baseB = 380 + (i * 8);
            return { name: m, A: baseA, B: baseB };
        });
    }, []);

    return (
        <div className="matchup-page animate-in fade-in duration-500">
            {/* 1. TALE OF THE TAPE (Sticky Header) */}
            <header className="matchup-header glass sticky top-16 z-50 p-4 mb-8">
                <div className="flex items-center justify-between max-w-5xl mx-auto">
                    {/* Person A */}
                    <div className="flex items-center gap-4 text-right flex-1">
                        <div>
                            <h2 className="text-xl font-bold text-white">{currentUser?.name}</h2>
                            <p className="text-xs text-slate-500">@{currentUser?.username}</p>
                        </div>
                        <div className="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center text-xl font-bold text-white shadow-lg shadow-emerald-500/20">
                            {currentUser?.name[0]}
                        </div>
                    </div>

                    {/* VS */}
                    <div className="flex flex-col items-center px-8">
                        <div className="w-10 h-10 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center text-xs font-black text-slate-400">
                            VS
                        </div>
                    </div>

                    {/* Person B (Selector) */}
                    <div className="flex items-center gap-4 flex-1">
                        <div className="w-12 h-12 rounded-full bg-indigo-500 flex items-center justify-center text-xl font-bold text-white shadow-lg shadow-indigo-500/20">
                            {opponent?.name[0] || '?'}
                        </div>
                        <div className="relative group">
                            <select
                                value={opponentId}
                                onChange={(e) => setOpponentId(e.target.value)}
                                className="bg-transparent text-xl font-bold text-white outline-none cursor-pointer hover:text-emerald-400 transition-colors appearance-none pr-6"
                            >
                                {users.filter(u => u.id !== currentUser?.id).map(u => (
                                    <option key={u.id} value={u.id} className="bg-slate-900 text-white">{u.name}</option>
                                ))}
                            </select>
                            <ChevronDown size={14} className="absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500" />
                        </div>
                    </div>
                </div>
            </header>

            <div className="max-w-6xl mx-auto space-y-8">
                {/* 2. POWER CARD (Hero Section) */}
                <section className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                    <div className="glass p-8 rounded-3xl h-[400px]">
                        <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                            <Zap size={18} className="text-amber-400" />
                            Styrkeöversikt
                        </h3>
                        <ResponsiveContainer width="100%" height="100%">
                            <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                                <PolarGrid stroke="#334155" />
                                <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                                <Radar
                                    name={currentUser?.name}
                                    dataKey="A"
                                    stroke="#10b981"
                                    fill="#10b981"
                                    fillOpacity={0.3}
                                />
                                <Radar
                                    name={opponent?.name}
                                    dataKey="B"
                                    stroke="#6366f1"
                                    fill="#6366f1"
                                    fillOpacity={0.3}
                                />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc' }}
                                    itemStyle={{ fontSize: '10px' }}
                                />
                            </RadarChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="space-y-6">
                        <div className="flex justify-between items-end">
                            <div>
                                <h1 className="text-4xl font-black text-white">The Power Card</h1>
                                <p className="text-slate-500 mt-2">Vem är starkast totalt sett?</p>
                            </div>
                            <div className="flex p-1 bg-slate-800/50 rounded-xl border border-white/5">
                                <button
                                    onClick={() => setViewMode('raw')}
                                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'raw' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                                >
                                    Raw Styrka
                                </button>
                                <button
                                    onClick={() => setViewMode('fair')}
                                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'fair' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                                >
                                    Poäng (Wilks)
                                </button>
                            </div>
                        </div>

                        {/* KPI Cards */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="glass p-6 rounded-2xl relative overflow-hidden group hover:scale-[1.02] transition-all">
                                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                    <Trophy size={48} />
                                </div>
                                <span className="text-[10px] uppercase font-black text-slate-500 tracking-widest">Big 3 Total</span>
                                <div className="mt-2 flex items-baseline gap-2">
                                    <span className="text-3xl font-black text-white">{stats.totalA}kg</span>
                                    <span className={`text-xs font-bold ${stats.totalA >= stats.totalB ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {stats.totalA >= stats.totalB ? '+' : ''}{stats.totalA - stats.totalB}kg vs B
                                    </span>
                                </div>
                            </div>
                            <div className="glass p-6 rounded-2xl relative overflow-hidden group hover:scale-[1.02] transition-all">
                                <Scale className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity" size={48} />
                                <span className="text-[10px] uppercase font-black text-slate-500 tracking-widest">{viewMode === 'raw' ? 'SBD Ratio' : 'IPF GL Points'}</span>
                                <div className="mt-2 flex items-baseline gap-2">
                                    <span className="text-3xl font-black text-white">{stats.pointsA}</span>
                                    <span className={`text-xs font-bold ${stats.pointsA >= stats.pointsB ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {stats.pointsA >= stats.pointsB ? '+' : ''}{Math.round((stats.pointsA - stats.pointsB) * 10) / 10} vs B
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* 3. THE CRYSTAL BALL (Future & Trends) */}
                <section className="glass p-8 rounded-3xl overflow-hidden relative">
                    <div className="absolute top-0 right-0 p-8 opacity-5">
                        <Zap size={160} />
                    </div>
                    <div className="relative z-10 flex flex-col lg:flex-row gap-12">
                        <div className="flex-1">
                            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                                <TrendingUp size={18} className="text-emerald-400" />
                                The Crystal Ball – Framtid & Trender
                            </h3>
                            <p className="text-slate-500 mb-8 max-w-md">Baserat på din nuvarande volym och utvecklingstakt projicerar vi när du "kör om" din motståndare.</p>

                            <div className="space-y-6">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20">
                                        <TrendingUp size={24} />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-white text-sm">Intercept Point</h4>
                                        <p className="text-slate-500 text-xs">Beräknat till <strong>14:e September 2026</strong></p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/20">
                                        <Target size={24} />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-white text-sm">Styrkeglappet</h4>
                                        <p className="text-slate-500 text-xs">Minskar med ca <strong>{Math.abs(stats.totalA - stats.totalB) > 0 ? (Math.abs(stats.totalA - stats.totalB) / 12).toFixed(1) : '0.5'}kg</strong> per vecka</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex-[1.5] h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={trendData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                                    <XAxis dataKey="name" stroke="#64748b" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                                    <YAxis hide domain={['dataMin - 20', 'dataMax + 20']} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                                        labelStyle={{ color: '#94a3b8' }}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="A"
                                        stroke="#10b981"
                                        strokeWidth={4}
                                        dot={false}
                                        name={currentUser?.name}
                                        animationDuration={2000}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="B"
                                        stroke="#6366f1"
                                        strokeWidth={4}
                                        strokeDasharray="8 8"
                                        dot={false}
                                        name={opponent?.name}
                                        animationDuration={3000}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </section>

                {/* 4. THE GRIND (Volume & Dedication) */}
                <section className="glass p-8 rounded-3xl">
                    <h3 className="text-lg font-bold text-white mb-8 flex items-center gap-2">
                        <TrendingUp size={18} className="text-emerald-400" />
                        The Grind – Volym & Dedikation
                    </h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="text-[10px] uppercase font-black text-slate-500 tracking-widest border-b border-white/5">
                                    <th className="pb-4 pt-0">Metrik</th>
                                    <th className="pb-4 pt-0">{currentUser?.name}</th>
                                    <th className="pb-4 pt-0">{opponent?.name}</th>
                                    <th className="pb-4 pt-0">Skillnad</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {[
                                    { label: 'Pass i år', a: 142, b: 98, suffix: '' },
                                    { label: 'Total tid', a: 180, b: 110, suffix: 'h' },
                                    { label: 'Ton lyfta', a: 450, b: 510, suffix: 't' },
                                    { label: 'Snitt-RPE', a: 8.5, b: 7.0, suffix: '' },
                                ].map((row, i) => {
                                    const diff = row.a - row.b;
                                    const isPos = diff > 0;
                                    return (
                                        <tr key={i} className="group hover:bg-white/[0.02]">
                                            <td className="py-4 font-bold text-slate-300">{row.label}</td>
                                            <td className="py-4 text-white font-mono">{row.a}{row.suffix}</td>
                                            <td className="py-4 text-white font-mono">{row.b}{row.suffix}</td>
                                            <td className={`py-4 font-mono font-bold ${isPos ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                {isPos ? '+' : ''}{diff.toFixed(row.label.includes('RPE') ? 1 : 0)}{row.suffix}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </section>

                {/* 6. THE SCOREBOARD (Summary) */}
                <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="glass p-8 rounded-3xl lg:col-span-2">
                        <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                            <Trophy size={18} className="text-amber-400" />
                            The Scoreboard
                        </h3>
                        <div className="flex items-center gap-8 mb-8">
                            <div className="flex-1">
                                <div className="flex justify-between text-xs font-bold text-slate-500 mb-2">
                                    <span>VINSTER</span>
                                    <span>{Math.round((radarData.filter(d => d.A > d.B).length / radarData.length) * 100)}%</span>
                                </div>
                                <div className="h-4 bg-slate-800 rounded-full overflow-hidden flex">
                                    <div
                                        className="h-full bg-emerald-500 transition-all duration-1000"
                                        style={{ width: `${(radarData.filter(d => d.A > d.B).length / radarData.length) * 100}%` }}
                                    />
                                    <div
                                        className="h-full bg-indigo-500 transition-all duration-1000"
                                        style={{ width: `${(radarData.filter(d => d.B >= d.A).length / radarData.length) * 100}%` }}
                                    />
                                </div>
                            </div>
                            <div className="text-center grayscale opacity-50">
                                <span className="text-4xl font-black text-white">{radarData.filter(d => d.A > d.B).length} - {radarData.filter(d => d.B >= d.A).length}</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/10">
                                <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-2">Dina Styrkor</h4>
                                <ul className="space-y-1 text-sm text-slate-300">
                                    {radarData.filter(d => d.A > d.B).slice(0, 3).map((d, i) => (
                                        <li key={i} className="flex justify-between">
                                            <span>{d.subject}</span>
                                            <span className="font-bold">+{Math.round(((d.rawA / d.rawB) - 1) * 100)}%</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <div className="p-4 rounded-2xl bg-rose-500/5 border border-rose-500/10">
                                <h4 className="text-xs font-bold text-rose-400 uppercase tracking-widest mb-2">Att Jobba På</h4>
                                <ul className="space-y-1 text-sm text-slate-300">
                                    {radarData.filter(d => d.B > d.A).slice(0, 3).map((d, i) => (
                                        <li key={i} className="flex justify-between">
                                            <span>{d.subject}</span>
                                            <span className="font-bold">-{Math.round((1 - (d.rawA / d.rawB)) * 100)}%</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>

                    <div className="glass p-8 rounded-3xl flex flex-col justify-center items-center text-center">
                        <div className="w-20 h-20 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-400 mb-4 border border-amber-500/20 shadow-2xl shadow-amber-500/20">
                            <Trophy size={40} />
                        </div>
                        <h4 className="text-xl font-bold text-white mb-2">Sammanfattning</h4>
                        <p className="text-sm text-slate-500 mb-6">
                            {(radarData.filter(d => d.A > d.B).length > radarData.filter(d => d.B > d.A).length)
                                ? `Du dominerar marknaden just nu med fler grenvinster än ${opponent?.name}.`
                                : `Det är en jämn kamp, men ${opponent?.name} har ett litet övertag i basövningarna.`}
                        </p>
                        <button className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-2xl transition-all flex items-center justify-center gap-2 group">
                            Exportera Match-Poster
                            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                        </button>
                    </div>
                </section>

                {/* 4. HEAD-TO-HEAD (Exercise Details) */}
                <section>
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-xl font-black text-white">Head-to-Head</h3>
                        <div className="flex gap-4">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                                <input
                                    type="text"
                                    placeholder="Sök övning..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="bg-white/5 border border-white/10 rounded-xl py-2 pl-9 pr-4 text-xs text-white outline-none focus:border-emerald-500/50 transition-all w-64"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="grid gap-4">
                        {[
                            {
                                group: 'Bröst',
                                exercises: [
                                    { name: 'Bänkpress', a: 100, b: 90, sub: 'Power' },
                                    { name: 'Hantelpress', a: 32, b: 35, sub: 'Hypertrofi' },
                                    { name: 'Dips', a: 25, b: 15, sub: 'Kroppsvikt' },
                                ]
                            },
                            {
                                group: 'Ben',
                                exercises: [
                                    { name: 'Knäböj', a: 140, b: 120, sub: 'Power' },
                                    { name: 'Marklyft', a: 180, b: 200, sub: 'Power' },
                                    { name: 'Leg Press', a: 300, b: 250, sub: 'Accessory' },
                                ]
                            },
                            {
                                group: 'Rygg',
                                exercises: [
                                    { name: 'Chins', a: 15, b: 25, sub: 'Repetitioner' },
                                    { name: 'Skivstångsrodd', a: 90, b: 85, sub: 'Compound' },
                                    { name: 'Latsdrag', a: 80, b: 75, sub: 'Isolering' },
                                ]
                            },
                        ].filter(cat =>
                            cat.group.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            cat.exercises.some(ex => ex.name.toLowerCase().includes(searchQuery.toLowerCase()))
                        ).map((category, i) => (
                            <div key={i} className="glass rounded-2xl overflow-hidden">
                                <details className="group" open={i < 2}>
                                    <summary className="bg-white/5 px-6 py-4 flex justify-between items-center cursor-pointer list-none select-none hover:bg-white/[0.08] transition-all">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20">
                                                <ChevronRight size={16} className="group-open:rotate-90 transition-transform" />
                                            </div>
                                            <span className="text-sm font-black text-white uppercase tracking-widest">{category.group}</span>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="flex -space-x-2">
                                                {[0, 1].map(idx => (
                                                    <div key={idx} className="w-6 h-6 rounded-full border-2 border-slate-900 bg-slate-800 flex items-center justify-center text-[8px] font-bold text-slate-400">
                                                        {idx === 0 ? currentUser?.name[0] : opponent?.name?.[0]}
                                                    </div>
                                                ))}
                                            </div>
                                            <span className="text-[10px] text-slate-500 font-bold">{category.exercises.length} ÖVNINGAR</span>
                                        </div>
                                    </summary>
                                    <div className="divide-y divide-white/5 animate-in slide-in-from-top-2 duration-300">
                                        {category.exercises.filter(ex =>
                                            ex.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                            category.group.toLowerCase().includes(searchQuery.toLowerCase())
                                        ).map((ex, j) => {
                                            const total = ex.a + ex.b;
                                            const ratio = (ex.a / total) * 100;
                                            const isBestA = ex.a > ex.b;
                                            return (
                                                <div key={j} className="p-6 hover:bg-white/[0.02] transition-all">
                                                    <div className="flex justify-between items-center mb-6">
                                                        <div className="flex-1 text-right pr-8">
                                                            <div className={`text-2xl font-black transition-all ${isBestA ? 'text-emerald-400 scale-110' : 'text-slate-500'}`}>
                                                                {ex.a}
                                                                <span className="text-xs ml-1 opacity-50">kg</span>
                                                            </div>
                                                        </div>
                                                        <div className="w-48 text-center px-4">
                                                            <h4 className="font-bold text-slate-100 mb-1">{ex.name}</h4>
                                                            <span className="text-[10px] uppercase font-black text-slate-500 tracking-tighter">{ex.sub}</span>
                                                        </div>
                                                        <div className="flex-1 pl-8 text-left">
                                                            <div className={`text-2xl font-black transition-all ${!isBestA ? 'text-indigo-400 scale-110' : 'text-slate-500'}`}>
                                                                {ex.b}
                                                                <span className="text-xs ml-1 opacity-50">kg</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Dynamic Progress Bar */}
                                                    <div className="relative group/bar">
                                                        <div className="h-2 bg-slate-900 rounded-full overflow-hidden flex shadow-inner">
                                                            <div
                                                                className={`h-full transition-all duration-700 bg-gradient-to-r ${isBestA ? 'from-emerald-600 to-emerald-400' : 'from-emerald-800 to-emerald-700 opacity-40'}`}
                                                                style={{ width: `${ratio}%` }}
                                                            />
                                                            <div
                                                                className={`h-full transition-all duration-700 bg-gradient-to-l ${!isBestA ? 'from-indigo-600 to-indigo-400' : 'from-indigo-800 to-indigo-700 opacity-40'}`}
                                                                style={{ width: `${100 - ratio}%` }}
                                                            />
                                                        </div>
                                                        <div className="absolute left-1/2 top-0 bottom-0 w-1 bg-slate-950 -translate-x-1/2 shadow-lg" />

                                                        {/* Tooltip-like hints */}
                                                        <div className="absolute -top-8 left-0 opacity-0 group-hover/bar:opacity-100 transition-opacity text-[9px] font-black text-emerald-400 uppercase tracking-widest">
                                                            {ratio.toFixed(1)}% Dominans
                                                        </div>
                                                        <div className="absolute -top-8 right-0 opacity-0 group-hover/bar:opacity-100 transition-opacity text-[9px] font-black text-indigo-400 uppercase tracking-widest">
                                                            {(100 - ratio).toFixed(1)}% Dominans
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </details>
                            </div>
                        ))}
                    </div>
                </section>
            </div>
        </div>
    );
}
