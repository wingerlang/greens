import React, { useMemo } from 'react';

interface StreaksProps {
    dates: string[];
}

export function ConditioningStreaks({ dates }: StreaksProps) {
    const { current, longest } = useMemo(() => {
        if (dates.length === 0) return { current: 0, longest: 0 };

        // Sort and dedupe dates
        const sorted = Array.from(new Set(dates)).sort((a, b) => a.localeCompare(b));

        let maxStreak = 0;
        let curStreak = 0;
        let lastDate: Date | null = null;

        // Calculate all streaks
        sorted.forEach(dStr => {
            const d = new Date(dStr);
            d.setHours(0, 0, 0, 0);

            if (!lastDate) {
                curStreak = 1;
            } else {
                const diffTime = Math.abs(d.getTime() - lastDate.getTime());
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                if (diffDays === 1) {
                    curStreak++;
                } else if (diffDays > 1) {
                    if (curStreak > maxStreak) maxStreak = curStreak;
                    curStreak = 1;
                }
            }
            lastDate = d;
        });

        if (curStreak > maxStreak) maxStreak = curStreak;

        // Calculate CURRENT streak specifically from "today" backwards
        // (Simplified: check if last date is recently)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const lastEntry = new Date(sorted[sorted.length - 1]);
        lastEntry.setHours(0, 0, 0, 0);

        const diffToLast = Math.ceil((today.getTime() - lastEntry.getTime()) / (1000 * 60 * 60 * 24));
        const isActive = diffToLast <= 2; // Allow 1 day rest to still count as "active streak" contextually, or strictly 0/1

        const activeStreak = isActive ? curStreak : 0;

        return { current: activeStreak, longest: maxStreak };

    }, [dates]);

    return (
        <div className="grid grid-cols-2 gap-4">
            <div className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border border-orange-500/20 rounded-2xl p-4 relative overflow-hidden group">
                <div className="relative z-10">
                    <div className="flex justify-between items-start mb-1">
                        <span className="text-[10px] uppercase font-bold text-orange-400 tracking-wider">Nuvarande (dagar)</span>
                        <span className="text-xl">🔥</span>
                    </div>
                    <div className="text-3xl font-black text-white">{current}</div>
                    <div className="text-[10px] text-orange-500/60 font-bold mt-1">Dagar i rad</div>
                </div>
                <div className="absolute -bottom-4 -right-4 text-8xl opacity-5 pointer-events-none group-hover:scale-110 transition-transform">🔥</div>
            </div>

            <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/20 rounded-2xl p-4 relative overflow-hidden group">
                <div className="relative z-10">
                    <div className="flex justify-between items-start mb-1">
                        <span className="text-[10px] uppercase font-bold text-blue-400 tracking-wider">Längsta (dagar)</span>
                        <span className="text-xl">🏔️</span>
                    </div>
                    <div className="text-3xl font-black text-white">{longest}</div>
                    <div className="text-[10px] text-blue-500/60 font-bold mt-1">Dagar rekord</div>
                </div>
                <div className="absolute -bottom-4 -right-4 text-8xl opacity-5 pointer-events-none group-hover:scale-110 transition-transform">⚡</div>
            </div>
        </div>
    );
}
