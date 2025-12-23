// PR Manager Section with detection and manual entry
import React, { useState } from 'react';
import { usePRs, PR_CATEGORIES } from '../hooks/usePRs.ts';

export function PRManagerSection() {
    const { prs, detectedPRs, loading, savePR, deletePR, approvePR } = usePRs();
    const [manualCategory, setManualCategory] = useState(PR_CATEGORIES[0]);
    const [manualTime, setManualTime] = useState('');
    const [manualDate, setManualDate] = useState('');

    const handleSaveManual = async () => {
        if (!manualTime) return;
        await savePR({
            category: manualCategory,
            time: manualTime,
            date: manualDate || new Date().toISOString().split('T')[0],
            isManual: true
        });
        setManualTime('');
        setManualDate('');
    };

    if (loading) return <div className="text-slate-500 text-center py-4">Laddar personliga rekord...</div>;

    return (
        <div className="space-y-6">
            {/* Current PRs */}
            <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase mb-3">Dina Rekord</h4>
                {prs.length === 0 ? (
                    <p className="text-slate-500 text-sm">Inga rekord registrerade ännu.</p>
                ) : (
                    <div className="grid gap-2">
                        {prs.map(pr => (
                            <div key={pr.category} className="flex items-center justify-between bg-slate-800/50 rounded-xl p-3">
                                <div className="flex items-center gap-3">
                                    <span className="text-2xl">🏅</span>
                                    <div>
                                        <div className="text-white font-bold">{pr.category}</div>
                                        <div className="text-slate-500 text-xs">
                                            {pr.date ? new Date(pr.date).toLocaleDateString('sv-SE') : 'Okänt datum'}
                                            {pr.isManual && <span className="ml-2 text-slate-600">(manuellt)</span>}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-emerald-400 font-mono text-lg font-bold">{pr.time}</span>
                                    <button
                                        onClick={() => deletePR(pr.category)}
                                        className="text-red-400 text-xs hover:text-red-300"
                                    >✕</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Detected PRs */}
            {detectedPRs.length > 0 && (
                <div>
                    <h4 className="text-xs font-bold text-emerald-500 uppercase mb-3">🎯 Detekterade Rekord</h4>
                    <div className="space-y-2">
                        {detectedPRs.map(pr => (
                            <div key={pr.category} className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">
                                <div>
                                    <div className="text-white font-bold">{pr.category}</div>
                                    <div className="text-slate-500 text-xs">
                                        {pr.activityName} • {new Date(pr.date).toLocaleDateString('sv-SE')}
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-emerald-400 font-mono font-bold">{pr.time}</span>
                                    <button
                                        onClick={() => approvePR(pr)}
                                        className="px-3 py-1 bg-emerald-500 text-white rounded-lg text-xs font-bold hover:bg-emerald-600"
                                    >✓ Godkänn</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Manual Entry */}
            <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase mb-3">Lägg till manuellt</h4>
                <div className="flex gap-2 flex-wrap">
                    <select
                        value={manualCategory}
                        onChange={e => setManualCategory(e.target.value)}
                        className="bg-slate-800 rounded-lg p-2 text-white border border-white/10 text-sm"
                    >
                        {PR_CATEGORIES.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                        ))}
                    </select>
                    <input
                        type="text"
                        placeholder="Tid (HH:MM:SS)"
                        value={manualTime}
                        onChange={e => setManualTime(e.target.value)}
                        className="bg-slate-800 rounded-lg p-2 text-white border border-white/10 text-sm w-32"
                    />
                    <input
                        type="date"
                        value={manualDate}
                        onChange={e => setManualDate(e.target.value)}
                        className="bg-slate-800 rounded-lg p-2 text-white border border-white/10 text-sm"
                    />
                    <button
                        onClick={handleSaveManual}
                        className="px-4 py-2 bg-slate-700 text-white rounded-lg text-sm font-bold hover:bg-slate-600"
                    >+ Lägg till</button>
                </div>
            </div>
        </div>
    );
}
