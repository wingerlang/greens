import React, { useState } from 'react';
import { LeaderboardEntry } from '../../models/types.ts';

interface LeaderboardWidgetProps {
    entries: LeaderboardEntry[];
    currentUserId?: string;
    compact?: boolean;
}

// Mock data
const SAMPLE_ENTRIES: LeaderboardEntry[] = [
    { userId: '1', userName: 'Anna Snabb', rank: 1, weeklyVolumeKm: 87, monthlyVolumeKm: 312, currentStreak: 23, prCount: 5, completionRate: 98, badges: [{ type: 'volume_king', name: 'Marsmaskin', icon: '👑' }], lastActiveDate: '2024-03-23' },
    { userId: '2', userName: 'Erik Uthållig', rank: 2, weeklyVolumeKm: 72, monthlyVolumeKm: 285, currentStreak: 45, prCount: 3, completionRate: 100, badges: [{ type: 'streak_master', name: 'Strävare', icon: '🔥' }], lastActiveDate: '2024-03-23' },
    { userId: '3', userName: 'Lisa Tempo', rank: 3, weeklyVolumeKm: 65, monthlyVolumeKm: 248, currentStreak: 12, prCount: 8, completionRate: 94, badges: [{ type: 'speed_demon', name: 'Fartfantom', icon: '⚡' }], lastActiveDate: '2024-03-22' },
    { userId: '4', userName: 'Magnus Marathon', rank: 4, weeklyVolumeKm: 58, monthlyVolumeKm: 220, currentStreak: 8, prCount: 2, completionRate: 89, badges: [], lastActiveDate: '2024-03-21' },
    { userId: '5', userName: 'Sofia Sprint', rank: 5, weeklyVolumeKm: 45, monthlyVolumeKm: 178, currentStreak: 5, prCount: 4, completionRate: 92, badges: [], lastActiveDate: '2024-03-23' }
];

export function LeaderboardWidget({ entries = SAMPLE_ENTRIES, currentUserId, compact = false }: LeaderboardWidgetProps) {
    const [view, setView] = useState<'weekly' | 'monthly' | 'streak'>('weekly');

    const sortedEntries = [...entries].sort((a, b) => {
        if (view === 'weekly') return b.weeklyVolumeKm - a.weeklyVolumeKm;
        if (view === 'monthly') return b.monthlyVolumeKm - a.monthlyVolumeKm;
        return b.currentStreak - a.currentStreak;
    }).map((e, i) => ({ ...e, rank: i + 1 }));

    const getRankStyle = (rank: number) => {
        if (rank === 1) return 'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950';
        if (rank === 2) return 'bg-gradient-to-r from-slate-400 to-slate-300 text-slate-950';
        if (rank === 3) return 'bg-gradient-to-r from-amber-700 to-amber-600 text-white';
        return 'bg-slate-800 text-slate-400';
    };

    if (compact) {
        return (
            <div className="leaderboard-widget-compact p-4 bg-slate-900/40 rounded-2xl border border-white/5">
                <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">🏆 Topplistan</span>
                    <span className="text-[9px] text-slate-600">Denna vecka</span>
                </div>
                <div className="space-y-2">
                    {sortedEntries.slice(0, 3).map(entry => (
                        <div key={entry.userId} className="flex items-center gap-3">
                            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black ${getRankStyle(entry.rank)}`}>
                                {entry.rank}
                            </span>
                            <span className="text-xs font-bold text-white flex-1 truncate">{entry.userName}</span>
                            <span className="text-xs font-black text-emerald-400">{entry.weeklyVolumeKm} km</span>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="leaderboard-widget text-white">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-black uppercase italic tracking-tighter">🏆 Topplistan</h3>
                <div className="flex gap-1 bg-slate-900 rounded-xl p-1">
                    {(['weekly', 'monthly', 'streak'] as const).map(v => (
                        <button
                            key={v}
                            onClick={() => setView(v)}
                            className={`px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase transition-all ${view === v ? 'bg-indigo-500 text-white' : 'text-slate-500 hover:text-white'}`}
                        >
                            {v === 'weekly' ? 'Vecka' : v === 'monthly' ? 'Månad' : 'Streak'}
                        </button>
                    ))}
                </div>
            </div>

            <div className="space-y-2">
                {sortedEntries.map(entry => {
                    const isMe = entry.userId === currentUserId;
                    const value = view === 'weekly' ? entry.weeklyVolumeKm : view === 'monthly' ? entry.monthlyVolumeKm : entry.currentStreak;
                    const unit = view === 'streak' ? 'dagar' : 'km';

                    return (
                        <div
                            key={entry.userId}
                            className={`p-3 rounded-xl border transition-all ${isMe ? 'bg-indigo-500/10 border-indigo-500/30 ring-2 ring-indigo-500/20' : 'bg-slate-900/40 border-white/5'}`}
                        >
                            <div className="flex items-center gap-4">
                                <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-black ${getRankStyle(entry.rank)}`}>
                                    {entry.rank === 1 ? '👑' : entry.rank}
                                </span>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-bold text-white">{entry.userName}</span>
                                        {isMe && <span className="text-[8px] bg-indigo-500 text-white px-1.5 py-0.5 rounded-full font-bold uppercase">Du</span>}
                                        {entry.badges.slice(0, 2).map((b, i) => (
                                            <span key={i} title={b.name} className="text-sm">{b.icon}</span>
                                        ))}
                                    </div>
                                    <div className="flex gap-4 mt-1 text-[9px] text-slate-500">
                                        <span>🔥 {entry.currentStreak} dagar</span>
                                        <span>✓ {entry.completionRate}%</span>
                                        <span>🏅 {entry.prCount} PR</span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-xl font-black text-emerald-400">{value}</div>
                                    <div className="text-[9px] text-slate-500 uppercase">{unit}</div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Your stats footer */}
            {currentUserId && (
                <div className="mt-4 p-4 bg-indigo-500/5 border border-indigo-500/10 rounded-xl">
                    <div className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest mb-2">Din vecka</div>
                    <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Behåll din streak 💪</span>
                        <span className="text-white font-bold">Fortsätt köra!</span>
                    </div>
                </div>
            )}
        </div>
    );
}
