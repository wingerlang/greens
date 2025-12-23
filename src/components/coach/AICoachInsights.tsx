import React, { useState } from 'react';
import { AICoachTip, generateId } from '../../models/types.ts';

interface AICoachInsightsProps {
    tips?: AICoachTip[];
    weeklyVolumeKm?: number;
    currentTsb?: number;
    completionRate?: number;
    currentStreak?: number;
    onDismissTip?: (tipId: string) => void;
    onAskCoach?: (question: string) => void;
}

// Smart tip generator based on stats
function generateSmartTips(
    weeklyVolume: number,
    tsb: number,
    completionRate: number,
    streak: number
): AICoachTip[] {
    const tips: AICoachTip[] = [];
    const now = new Date().toISOString();

    // TSB-based tips
    if (tsb < -15) {
        tips.push({
            id: generateId(),
            type: 'warning',
            category: 'recovery',
            title: 'Hög träningsbelastning',
            message: `Din TSB är ${tsb}, vilket indikerar hög trötthet. Överväg en lättare dag eller två för att undvika överträning.`,
            priority: 1,
            createdAt: now
        });
    } else if (tsb > 10) {
        tips.push({
            id: generateId(),
            type: 'suggestion',
            category: 'intensity',
            title: 'Redo för mer',
            message: `Din form är utmärkt (TSB: +${tsb}). Nu är ett bra tillfälle för ett kvalitetspass eller att testa nya tempon.`,
            actionable: { label: 'Planera intervaller', action: 'add_intervals' },
            priority: 3,
            createdAt: now
        });
    }

    // Volume-based tips
    if (weeklyVolume > 70) {
        tips.push({
            id: generateId(),
            type: 'insight',
            category: 'volume',
            title: 'Imponerande vecka!',
            message: `Du har loggat ${weeklyVolume} km denna vecka. Det är högvolymträning — se till att återhämtningen matchar.`,
            priority: 2,
            createdAt: now
        });
    }

    // Streak celebration
    if (streak >= 7) {
        tips.push({
            id: generateId(),
            type: 'celebration',
            category: 'motivation',
            title: `${streak} dagars streak! 🔥`,
            message: `Du har tränat ${streak} dagar i rad. Fantastiskt engagemang — men kom ihåg att vila är också träning.`,
            priority: 4,
            createdAt: now
        });
    }

    // Completion rate
    if (completionRate < 70) {
        tips.push({
            id: generateId(),
            type: 'suggestion',
            category: 'form',
            title: 'Justerar planen?',
            message: `Du har genomfört ${completionRate}% av dina planerade pass. Kan planen vara för ambitiös? Finjustera för bättre träffsäkerhet.`,
            actionable: { label: 'Öppna finjustering', action: 'open_tuning' },
            priority: 2,
            createdAt: now
        });
    }

    return tips;
}

export function AICoachInsights({
    tips,
    weeklyVolumeKm = 35,
    currentTsb = -5,
    completionRate = 85,
    currentStreak = 4,
    onDismissTip,
    onAskCoach
}: AICoachInsightsProps) {
    const [question, setQuestion] = useState('');
    const [isAsking, setIsAsking] = useState(false);

    const smartTips = tips || generateSmartTips(weeklyVolumeKm, currentTsb, completionRate, currentStreak);
    const activeTips = smartTips.filter(t => !t.dismissed).sort((a, b) => a.priority - b.priority);

    const handleAsk = () => {
        if (!question.trim()) return;
        setIsAsking(true);
        onAskCoach?.(question);
        setTimeout(() => {
            setIsAsking(false);
            setQuestion('');
        }, 1500);
    };

    const getTipStyles = (tip: AICoachTip) => {
        switch (tip.type) {
            case 'warning': return { bg: 'bg-amber-500/10', border: 'border-amber-500/20', icon: '⚠️', text: 'text-amber-400' };
            case 'celebration': return { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', icon: '🎉', text: 'text-emerald-400' };
            case 'insight': return { bg: 'bg-blue-500/10', border: 'border-blue-500/20', icon: '💡', text: 'text-blue-400' };
            default: return { bg: 'bg-indigo-500/10', border: 'border-indigo-500/20', icon: '💬', text: 'text-indigo-400' };
        }
    };

    return (
        <div className="ai-coach-insights text-white space-y-4">
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-2xl shadow-xl shadow-indigo-500/20">
                    🤖
                </div>
                <div>
                    <h3 className="text-lg font-black uppercase italic tracking-tighter">AI Coach</h3>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Personliga insikter & tips</p>
                </div>
            </div>

            {/* Current Stats Summary */}
            <div className="p-4 bg-slate-900/60 rounded-2xl border border-white/5">
                <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-3">Din status just nu</div>
                <div className="grid grid-cols-4 gap-3">
                    <div className="text-center">
                        <div className="text-xl font-black text-emerald-400">{weeklyVolumeKm}</div>
                        <div className="text-[8px] text-slate-500 uppercase">km/vecka</div>
                    </div>
                    <div className="text-center">
                        <div className={`text-xl font-black ${currentTsb > 0 ? 'text-emerald-400' : currentTsb > -10 ? 'text-amber-400' : 'text-rose-400'}`}>
                            {currentTsb > 0 ? '+' : ''}{currentTsb}
                        </div>
                        <div className="text-[8px] text-slate-500 uppercase">TSB</div>
                    </div>
                    <div className="text-center">
                        <div className="text-xl font-black text-indigo-400">{completionRate}%</div>
                        <div className="text-[8px] text-slate-500 uppercase">Genomfört</div>
                    </div>
                    <div className="text-center">
                        <div className="text-xl font-black text-amber-400">{currentStreak}</div>
                        <div className="text-[8px] text-slate-500 uppercase">Streak</div>
                    </div>
                </div>
            </div>

            {/* AI Tips */}
            <div className="space-y-2">
                {activeTips.length === 0 ? (
                    <div className="p-4 bg-slate-900/40 rounded-xl text-center">
                        <p className="text-slate-500 text-sm">Inga tips just nu. Fortsätt träna! 💪</p>
                    </div>
                ) : (
                    activeTips.map(tip => {
                        const styles = getTipStyles(tip);
                        return (
                            <div key={tip.id} className={`p-4 rounded-xl border ${styles.bg} ${styles.border}`}>
                                <div className="flex items-start gap-3">
                                    <span className="text-xl">{styles.icon}</span>
                                    <div className="flex-1">
                                        <div className={`text-[10px] font-black uppercase tracking-widest ${styles.text}`}>{tip.title}</div>
                                        <p className="text-xs text-slate-300 mt-1 leading-relaxed">{tip.message}</p>
                                        {tip.actionable && (
                                            <button className="mt-2 px-3 py-1.5 bg-white/5 text-white/80 rounded-lg text-[9px] font-bold uppercase hover:bg-white/10 transition-all">
                                                {tip.actionable.label}
                                            </button>
                                        )}
                                    </div>
                                    {onDismissTip && (
                                        <button onClick={() => onDismissTip(tip.id)} className="text-slate-600 hover:text-white text-xs">✕</button>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Ask Coach */}
            {onAskCoach && (
                <div className="p-4 bg-gradient-to-r from-indigo-500/10 to-violet-500/10 rounded-2xl border border-indigo-500/20">
                    <div className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-3">🗣️ Fråga Coachen</div>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={question}
                            onChange={e => setQuestion(e.target.value)}
                            placeholder="Hur ska jag anpassa min plan för..."
                            className="flex-1 bg-slate-950 border border-white/5 rounded-xl px-4 py-3 text-sm text-white focus:border-indigo-500/50 outline-none"
                            onKeyDown={e => e.key === 'Enter' && handleAsk()}
                        />
                        <button
                            onClick={handleAsk}
                            disabled={isAsking || !question.trim()}
                            className="px-5 py-3 bg-indigo-500 text-white font-black rounded-xl text-[9px] uppercase tracking-widest hover:bg-indigo-400 disabled:opacity-40 transition-all"
                        >
                            {isAsking ? '...' : 'Fråga'}
                        </button>
                    </div>
                    <p className="text-[9px] text-slate-600 mt-2 italic">AI-coachen analyserar dina data och ger personliga svar.</p>
                </div>
            )}
        </div>
    );
}
