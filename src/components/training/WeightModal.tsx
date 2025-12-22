import React from 'react';

export function WeightModal({
    isOpen,
    onClose,
    weightInput,
    setWeightInput,
    selectedDate,
    setSelectedDate,
    onSave
}: {
    isOpen: boolean;
    onClose: () => void;
    weightInput: string;
    setWeightInput: (val: string) => void;
    selectedDate: string;
    setSelectedDate: (val: string) => void;
    onSave: (e: React.FormEvent) => void;
}) {
    if (!isOpen) return null;

    return (
        <div className="modal-overlay backdrop-blur-md bg-slate-950/80" onClick={onClose}>
            <div
                className="modal-content max-w-lg w-full bg-slate-900 border border-white/10 shadow-2xl rounded-3xl p-0 overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                <div className="bg-gradient-to-br from-emerald-500/20 to-slate-900 p-6 text-center border-b border-white/5">
                    <h2 className="text-xl font-black text-white italic tracking-tighter">NY VIKTNOTERING</h2>
                    <p className="text-xs text-slate-400 font-medium">Uppdatera din kroppsdata</p>
                </div>

                <form onSubmit={onSave} className="p-8 space-y-6">
                    <div className="space-y-4">
                        <div className="relative group">
                            <input
                                type="number"
                                step="0.1"
                                value={weightInput}
                                autoFocus
                                onChange={e => setWeightInput(e.target.value)}
                                className="w-full bg-slate-950 border border-white/10 rounded-2xl p-8 text-5xl font-black text-center text-emerald-400 focus:border-emerald-500/50 transition-all outline-none placeholder-slate-800"
                                placeholder="0.0"
                                style={{
                                    MozAppearance: 'textfield',
                                    WebkitAppearance: 'none',
                                    appearance: 'textfield'
                                }}
                            />
                            <span className="absolute right-8 top-1/2 -translate-y-1/2 text-slate-700 font-black text-xl pointer-events-none">KG</span>
                        </div>

                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-center text-slate-400 text-sm focus:text-white transition-all outline-none"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <button type="button" className="py-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 font-bold text-xs uppercase tracking-wider transition-all" onClick={onClose}>
                            Avbryt
                        </button>
                        <button type="submit" className="py-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/20 transition-all">
                            Spara Vikt
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
