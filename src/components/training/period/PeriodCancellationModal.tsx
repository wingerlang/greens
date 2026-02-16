import React, { useState } from 'react';
import { useScrollLock } from '../../../hooks/useScrollLock';
import type { PerformanceGoal } from '../../../models/types';

interface PeriodCancellationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (reason: string, goalIdsToCancel: string[]) => void;
    periodName: string;
    goals: PerformanceGoal[];
}

export function PeriodCancellationModal({
    isOpen,
    onClose,
    onConfirm,
    periodName,
    goals
}: PeriodCancellationModalProps) {
    const [reason, setReason] = useState('');
    // Default to selecting all goals for cancellation
    const [selectedGoalIds, setSelectedGoalIds] = useState<Set<string>>(new Set(goals.map(g => g.id)));

    useScrollLock(isOpen);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onConfirm(reason, Array.from(selectedGoalIds));
        setReason('');
    };

    const toggleGoal = (id: string) => {
        const newSet = new Set(selectedGoalIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedGoalIds(newSet);
    };

    return (
        <div
            className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div
                className="bg-slate-900 border border-red-500/30 rounded-2xl p-6 max-w-md w-full mx-4 space-y-4 animate-in zoom-in-95 duration-200 shadow-2xl shadow-red-900/20 max-h-[90vh] overflow-y-auto"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                    <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center text-xl shrink-0">
                        🏚️
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-white">Avbryt Period</h3>
                        <p className="text-xs text-slate-400 font-medium">
                            {periodName}
                        </p>
                    </div>
                </div>

                <p className="text-sm text-slate-300 leading-relaxed">
                    Är du säker på att du vill avbryta denna period? Den kommer att markeras som avbruten och flyttas till historiken.
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <label htmlFor="reason" className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                            Anledning (valfritt)
                        </label>
                        <textarea
                            id="reason"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="Varför avbryter du? (T.ex. sjukdom, ändrade mål...)"
                            className="w-full h-24 bg-black/30 border border-white/10 rounded-xl p-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/50 resize-none transition-all"
                            autoFocus
                        />
                    </div>

                    {goals.length > 0 && (
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                                Hantera kopplade mål
                            </label>
                            <div className="bg-black/20 rounded-xl border border-white/5 overflow-hidden">
                                {goals.map(goal => (
                                    <label
                                        key={goal.id}
                                        className="flex items-center gap-3 p-3 hover:bg-white/5 cursor-pointer border-b border-white/5 last:border-0 transition-colors"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedGoalIds.has(goal.id)}
                                            onChange={() => toggleGoal(goal.id)}
                                            className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-red-500 focus:ring-red-500/50"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-medium text-white truncate">{goal.name}</div>
                                            <div className="text-[10px] text-slate-500">
                                                {selectedGoalIds.has(goal.id) ? 'Kommer att avbrytas' : 'Ligger kvar som aktivt mål'}
                                            </div>
                                        </div>
                                    </label>
                                ))}
                            </div>
                            <p className="text-[10px] text-slate-500 italic px-1">
                                Mål du väljer att inte avbryta kommer att ligga kvar som fristående aktiva mål.
                            </p>
                        </div>
                    )}

                    <div className="flex gap-3 pt-4 border-t border-white/5">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-3 rounded-xl bg-slate-800 text-slate-300 font-bold hover:bg-slate-700 transition-colors text-sm"
                        >
                            Ångra
                        </button>
                        <button
                            type="submit"
                            className="flex-1 px-4 py-3 rounded-xl bg-red-600 text-white font-bold hover:bg-red-500 transition-colors text-sm shadow-lg shadow-red-900/20"
                        >
                            Avbryt Period
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
