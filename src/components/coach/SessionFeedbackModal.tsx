import React, { useState } from 'react';
import { FeedbackEntry, RPE, generateId } from '../../models/types.ts';

interface SessionFeedbackModalProps {
    isOpen: boolean;
    onClose: () => void;
    activityId: string;
    activityTitle: string;
    date: string;
    onSubmit: (feedback: FeedbackEntry) => void;
}

const RPE_LABELS: Record<RPE, { label: string; color: string; emoji: string }> = {
    1: { label: 'Vila', color: 'bg-slate-500', emoji: '😴' },
    2: { label: 'Väldigt lätt', color: 'bg-emerald-600', emoji: '😌' },
    3: { label: 'Lätt', color: 'bg-emerald-500', emoji: '🙂' },
    4: { label: 'Något ansträngt', color: 'bg-emerald-400', emoji: '😊' },
    5: { label: 'Ansträngt', color: 'bg-amber-400', emoji: '😤' },
    6: { label: 'Måttligt tungt', color: 'bg-amber-500', emoji: '😓' },
    7: { label: 'Tungt', color: 'bg-orange-500', emoji: '😰' },
    8: { label: 'Väldigt tungt', color: 'bg-orange-600', emoji: '😣' },
    9: { label: 'Extremt tungt', color: 'bg-rose-500', emoji: '🥵' },
    10: { label: 'Maximalt', color: 'bg-rose-600', emoji: '💀' }
};

const MOOD_OPTIONS = [
    { value: 'great', emoji: '🤩', label: 'Toppen' },
    { value: 'good', emoji: '😊', label: 'Bra' },
    { value: 'neutral', emoji: '😐', label: 'Okej' },
    { value: 'low', emoji: '😔', label: 'Nere' },
    { value: 'terrible', emoji: '😢', label: 'Dåligt' }
] as const;

const SORENESS_OPTIONS = [
    { value: 'none', label: 'Ingen', color: 'bg-emerald-500' },
    { value: 'mild', label: 'Lätt', color: 'bg-amber-400' },
    { value: 'moderate', label: 'Måttlig', color: 'bg-orange-500' },
    { value: 'severe', label: 'Svår', color: 'bg-rose-500' }
] as const;

export function SessionFeedbackModal({ isOpen, onClose, activityId, activityTitle, date, onSubmit }: SessionFeedbackModalProps) {
    const [rpe, setRpe] = useState<RPE>(5);
    const [difficulty, setDifficulty] = useState<'EASY' | 'PERFECT' | 'HARD' | 'TOO_HARD'>('PERFECT');
    const [sleepQuality, setSleepQuality] = useState<1 | 2 | 3 | 4 | 5>(3);
    const [stressLevel, setStressLevel] = useState<1 | 2 | 3 | 4 | 5>(3);
    const [soreness, setSoreness] = useState<'none' | 'mild' | 'moderate' | 'severe'>('none');
    const [mood, setMood] = useState<'great' | 'good' | 'neutral' | 'low' | 'terrible'>('good');
    const [hasInjury, setHasInjury] = useState(false);
    const [injuryLocation, setInjuryLocation] = useState('');
    const [notes, setNotes] = useState('');

    if (!isOpen) return null;

    const handleSubmit = () => {
        const feedback: FeedbackEntry = {
            id: generateId(),
            activityId,
            date,
            rpe,
            perceivedDifficulty: difficulty,
            sleepQuality,
            stressLevel,
            musclesSoreness: soreness,
            injuryFlag: hasInjury,
            injuryLocation: hasInjury ? injuryLocation : undefined,
            mood,
            notes: notes || undefined,
            createdAt: new Date().toISOString()
        };
        onSubmit(feedback);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-slate-900 border border-white/10 rounded-2xl p-5 max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl animate-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h3 className="text-lg font-black text-white">📝 Feedback</h3>
                        <p className="text-[10px] text-slate-500 font-bold">{activityTitle} • {date}</p>
                    </div>
                    <button onClick={onClose} className="text-slate-500 hover:text-white">✕</button>
                </div>

                {/* RPE Slider */}
                <div className="mb-5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3">Ansträngningsnivå (RPE)</label>
                    <div className="flex items-center gap-4">
                        <div className={`w-14 h-14 rounded-xl ${RPE_LABELS[rpe].color} flex flex-col items-center justify-center`}>
                            <span className="text-2xl">{RPE_LABELS[rpe].emoji}</span>
                        </div>
                        <div className="flex-1">
                            <input
                                type="range" min="1" max="10" value={rpe}
                                onChange={e => setRpe(parseInt(e.target.value) as RPE)}
                                className="w-full accent-emerald-500"
                            />
                            <div className="flex justify-between text-[8px] text-slate-600 font-bold mt-1">
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => <span key={n}>{n}</span>)}
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-2xl font-black text-white">{rpe}</div>
                            <div className="text-[9px] text-slate-500">{RPE_LABELS[rpe].label}</div>
                        </div>
                    </div>
                </div>

                {/* Difficulty */}
                <div className="mb-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Hur kändes passet?</label>
                    <div className="grid grid-cols-4 gap-2">
                        {(['EASY', 'PERFECT', 'HARD', 'TOO_HARD'] as const).map(d => (
                            <button
                                key={d}
                                onClick={() => setDifficulty(d)}
                                className={`py-2 rounded-lg text-[9px] font-black uppercase transition-all ${difficulty === d
                                        ? d === 'EASY' ? 'bg-emerald-500 text-white' :
                                            d === 'PERFECT' ? 'bg-blue-500 text-white' :
                                                d === 'HARD' ? 'bg-amber-500 text-slate-950' :
                                                    'bg-rose-500 text-white'
                                        : 'bg-slate-800 text-slate-500 hover:text-white'
                                    }`}
                            >
                                {d === 'EASY' ? 'Lätt' : d === 'PERFECT' ? 'Perfekt' : d === 'HARD' ? 'Tungt' : 'För tungt'}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Sleep & Stress */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Sömn (1-5)</label>
                        <div className="flex gap-1">
                            {([1, 2, 3, 4, 5] as const).map(n => (
                                <button
                                    key={n}
                                    onClick={() => setSleepQuality(n)}
                                    className={`flex-1 py-2 rounded-lg text-xs font-black transition-all ${sleepQuality === n ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-500'
                                        }`}
                                >
                                    {n}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Stress (1-5)</label>
                        <div className="flex gap-1">
                            {([1, 2, 3, 4, 5] as const).map(n => (
                                <button
                                    key={n}
                                    onClick={() => setStressLevel(n)}
                                    className={`flex-1 py-2 rounded-lg text-xs font-black transition-all ${stressLevel === n ? 'bg-rose-500 text-white' : 'bg-slate-800 text-slate-500'
                                        }`}
                                >
                                    {n}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Mood */}
                <div className="mb-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Humör</label>
                    <div className="flex gap-2">
                        {MOOD_OPTIONS.map(m => (
                            <button
                                key={m.value}
                                onClick={() => setMood(m.value)}
                                className={`flex-1 py-2 rounded-lg text-center transition-all ${mood === m.value ? 'bg-amber-500/20 ring-2 ring-amber-500' : 'bg-slate-800'
                                    }`}
                            >
                                <div className="text-lg">{m.emoji}</div>
                                <div className="text-[8px] text-slate-500">{m.label}</div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Soreness */}
                <div className="mb-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Muskelömhet</label>
                    <div className="flex gap-2">
                        {SORENESS_OPTIONS.map(s => (
                            <button
                                key={s.value}
                                onClick={() => setSoreness(s.value)}
                                className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${soreness === s.value ? `${s.color} text-white` : 'bg-slate-800 text-slate-500'
                                    }`}
                            >
                                {s.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Injury */}
                <div className="mb-4 p-3 bg-slate-800/50 rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Skada/smärta?</label>
                        <button
                            onClick={() => setHasInjury(!hasInjury)}
                            className={`w-10 h-5 rounded-full transition-all ${hasInjury ? 'bg-rose-500' : 'bg-slate-700'}`}
                        >
                            <div className={`w-4 h-4 bg-white rounded-full shadow-md transition-all ${hasInjury ? 'translate-x-5' : 'translate-x-0.5'}`} />
                        </button>
                    </div>
                    {hasInjury && (
                        <input
                            type="text"
                            value={injuryLocation}
                            onChange={e => setInjuryLocation(e.target.value)}
                            placeholder="Var? (t.ex. vänster knä, höft)"
                            className="w-full bg-slate-900/50 border border-white/5 rounded-lg p-2 text-sm text-white focus:border-rose-500/50 outline-none"
                        />
                    )}
                </div>

                {/* Notes */}
                <div className="mb-5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Anteckningar</label>
                    <textarea
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        placeholder="Hur gick det? Något speciellt att notera?"
                        rows={2}
                        className="w-full bg-slate-800 border border-white/5 rounded-xl p-3 text-sm text-white focus:border-indigo-500/50 outline-none resize-none"
                    />
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                    <button onClick={onClose} className="flex-1 py-2.5 text-slate-500 text-[10px] font-bold uppercase hover:text-white transition-all">
                        Avbryt
                    </button>
                    <button
                        onClick={handleSubmit}
                        className="flex-1 py-2.5 bg-emerald-500 text-slate-950 font-black rounded-xl text-[10px] uppercase tracking-widest hover:bg-emerald-400 transition-all active:scale-95"
                    >
                        Spara Feedback
                    </button>
                </div>
            </div>
        </div>
    );
}
