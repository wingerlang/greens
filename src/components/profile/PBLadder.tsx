import React, { useMemo } from 'react';
import { Trophy, Share2, Medal, Route, Zap } from 'lucide-react';
import { useData } from '../../context/DataContext.tsx';
import { formatTime, isCompetition } from '../../utils/activityUtils.ts';

const PB_BUCKETS = [
    { key: '5k', label: '5 KM', min: 4.8, max: 5.5, color: 'sky' },
    { key: '10k', label: '10 KM', min: 9.8, max: 10.5, color: 'blue' },
    { key: 'hm', label: 'Halvmara', min: 20.8, max: 21.5, color: 'indigo' },
    { key: 'marathon', label: 'Marathon', min: 41.5, max: 42.8, color: 'violet' }
];

const formatPace = (paceSec: number) => {
    const pM = Math.floor(paceSec / 60);
    const pS = Math.floor(paceSec % 60);
    return `${pM}:${pS.toString().padStart(2, '0')}/km`;
};

export function PBLadder({ className = '' }: { className?: string }) {
    const { exerciseEntries } = useData();

    const pbs = useMemo(() => {
        const runningTypes = ['running', 'run', 'löpning'];
        const runs = exerciseEntries.filter(e =>
            !e.excludeFromStats &&
            runningTypes.some(t => e.type.toLowerCase().includes(t)) &&
            e.distance && e.distance > 0 &&
            e.durationMinutes > 0
        ).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        const bestTimes = PB_BUCKETS.map(b => ({ ...b, bestDurationSec: Infinity, activity: null as any }));

        runs.forEach(run => {
            const dist = run.distance || 0;
            const durationSec = run.durationMinutes * 60;

            PB_BUCKETS.forEach((bucket, idx) => {
                if (dist >= bucket.min && dist <= bucket.max) {
                    if (durationSec < bestTimes[idx].bestDurationSec) {
                        bestTimes[idx].bestDurationSec = durationSec;
                        bestTimes[idx].activity = run;
                    }
                }
            });
        });

        return bestTimes;
    }, [exerciseEntries]);

    // Handle sharing
    const handleShare = () => {
        const text = pbs.map(pb => {
            if (!pb.activity) return `${pb.label}: -`;
            return `${pb.label}: ${formatTime(pb.bestDurationSec)} (-${formatPace(pb.bestDurationSec / (pb.activity.distance || 1))})`;
        }).join('\n');

        const shareText = `Mina Personbästan 🏃‍♂️💨\n\n${text}\n\nSpårat med Greens`;

        if (navigator.share) {
            navigator.share({
                title: 'Mina Personbästan',
                text: shareText
            }).catch(console.error);
        } else {
            navigator.clipboard.writeText(shareText);
            alert('PB-stege kopierad till urklipp!');
        }
    };

    return (
        <div className={`bg-gradient-to-b from-slate-900 to-slate-950 border border-white/10 rounded-3xl overflow-hidden shadow-2xl relative group ${className}`}>
            {/* Background Effects */}
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-sky-500 via-indigo-500 to-violet-500 opacity-50"></div>
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl"></div>
            <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-sky-500/10 rounded-full blur-3xl"></div>

            <div className="p-5 relative z-10">
                {/* Header */}
                <div className="flex justify-between items-start mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                            <Trophy size={20} />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-white uppercase tracking-wider">PB-Stege</h3>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Personbästan</p>
                        </div>
                    </div>
                    <button
                        onClick={handleShare}
                        className="p-2 rounded-lg bg-white/5 hover:bg-indigo-500/20 text-slate-400 hover:text-indigo-400 border border-transparent hover:border-indigo-500/30 transition-all"
                        title="Dela"
                    >
                        <Share2 size={16} />
                    </button>
                </div>

                {/* Ladder Items */}
                <div className="space-y-2">
                    {pbs.map((pb, idx) => {
                        const hasPB = pb.activity !== null;

                        return (
                            <div key={pb.key} className="flex items-stretch group/item">
                                {/* Connecting Line & Dot */}
                                <div className="flex flex-col items-center pl-1 pr-3">
                                    <div className={`w-3 h-3 rounded-full mt-2.5 z-10 border-2 ${hasPB ? "border-" + pb.color + "-500 bg-slate-900 shadow-[0_0_10px_rgba(255,255,255,0.1)] group-hover/item:bg-" + pb.color + "-500" : "border-slate-700 bg-slate-800"} transition-all`} />
                                    {idx < pbs.length - 1 && (
                                        <div className={`w-0.5 grow mt-1 rounded-full ${hasPB && pbs[idx + 1].activity ? "bg-gradient-to-b from-" + pb.color + "-500/50 to-" + pbs[idx + 1].color + "-500/50" : "bg-white/5"}`} />
                                    )}
                                </div>

                                {/* Content Box */}
                                <div className={`flex-1 p-3 rounded-xl border flex items-center justify-between transition-all ${hasPB ? "bg-white/[0.02] border-white/5 hover:border-" + pb.color + "-500/30 hover:bg-white/[0.04]" : "bg-transparent border-transparent opacity-50"}`}>
                                    <div className="flex items-center gap-3">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className={`text-sm font-black uppercase tracking-wider ${hasPB ? "text-white" : "text-slate-500"}`}>
                                                    {pb.label}
                                                </span>
                                                {hasPB && isCompetition(pb.activity) && (
                                                    <Medal size={12} className="text-amber-500" />
                                                )}
                                            </div>
                                            {hasPB && (
                                                <div className="text-[10px] text-slate-500 font-medium truncate max-w-[120px]" title={pb.activity.title || pb.activity.notes}>
                                                    {pb.activity.date.split('T')[0]} • {pb.activity.title && pb.activity.title !== '-' ? pb.activity.title : 'Löprunda'}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="text-right">
                                        <div className={`text-xl font-black font-mono leading-none ${hasPB ? "text-" + pb.color + "-400" : "text-slate-700"}`}>
                                            {hasPB ? formatTime(pb.bestDurationSec) : '--:--:--'}
                                        </div>
                                        {hasPB && (
                                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                                {formatPace(pb.bestDurationSec / (pb.activity.distance || 1))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
