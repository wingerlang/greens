import React, { useState } from 'react';
import { useScrollLock } from '../../hooks/useScrollLock';

interface CancellationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (reason: string) => void;
    title: string;
    message: string;
    entityName: string;
}

export function CancellationModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    entityName
}: CancellationModalProps) {
    const [reason, setReason] = useState('');
    useScrollLock(isOpen);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onConfirm(reason);
        setReason(''); // Reset for next time
    };

    return (
        <div
            className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div
                className="bg-slate-900 border border-red-500/30 rounded-2xl p-6 max-w-md w-full mx-4 space-y-4 animate-in zoom-in-95 duration-200 shadow-2xl shadow-red-900/20"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                    <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center text-xl shrink-0">
                        🗑️
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-white">{title}</h3>
                        <p className="text-xs text-slate-400 font-medium">
                            {entityName}
                        </p>
                    </div>
                </div>

                <p className="text-sm text-slate-300 leading-relaxed">
                    {message}
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
                            placeholder="Varför avbryter du? (T.ex. skada, sjukdom, tappat intresse...)"
                            className="w-full h-24 bg-black/30 border border-white/10 rounded-xl p-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/50 resize-none transition-all"
                            autoFocus
                        />
                    </div>

                    <div className="flex gap-3 pt-2">
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
                            Bekräfta Avbrott
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
