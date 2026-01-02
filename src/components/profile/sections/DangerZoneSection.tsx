
import React, { useState } from 'react';
import { useAuth } from '../../../context/AuthContext.tsx';
import { useData } from '../../../context/DataContext.tsx';
import { profileService } from '../../../services/profileService.ts';

export function DangerZoneSection() {
    const { logout } = useAuth();
    const { refreshData } = useData();
    const [confirmInput, setConfirmInput] = useState('');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isResetting, setIsResetting] = useState(false);

    // Track which granular reset is being confirmed
    const [pendingReset, setPendingReset] = useState<'meals' | 'exercises' | 'weight' | 'sleep' | 'water' | 'caffeine' | 'food' | null>(null);
    const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

    const labels: Record<string, string> = {
        meals: 'måltidshistorik',
        exercises: 'träningspass',
        weight: 'vikthistorik',
        sleep: 'sömnloggar',
        water: 'vattenloggar',
        caffeine: 'koffeinloggar',
        food: 'matloggar'
    };

    const icons: Record<string, string> = {
        meals: '🍽️',
        exercises: '🏋️',
        weight: '⚖️',
        sleep: '😴',
        water: '💧',
        caffeine: '☕',
        food: '🥗'
    };

    const handleReset = async () => {
        if (!pendingReset) return;

        setIsResetting(true);
        try {
            const success = await profileService.resetData(pendingReset);
            if (success) {
                // CRITICAL: Clear localStorage cache FIRST to prevent data resurrection
                const { storageService } = await import('../../../services/storage.ts');
                storageService.clearLocalCache(pendingReset);

                // Then refresh from server (which now has empty data)
                await refreshData();
                setFeedbackMessage(`✅ ${labels[pendingReset]} har rensats.`);
                setPendingReset(null);
                setTimeout(() => setFeedbackMessage(null), 3000);
            } else {
                setFeedbackMessage('❌ Fel vid rensning.');
            }
        } catch (e) {
            console.error(e);
            setFeedbackMessage('❌ Kunde inte nå servern.');
        } finally {
            setIsResetting(false);
        }
    };

    const handleDeleteAccount = async () => {
        if (confirmInput !== 'DELETE') return;

        setIsResetting(true);
        try {
            const success = await profileService.resetData('all');
            if (success) {
                logout(); // Logout redirects to login usually
            } else {
                setFeedbackMessage('❌ Fel vid borttagning av konto.');
            }
        } catch (e) {
            console.error(e);
            setFeedbackMessage('❌ Kunde inte nå servern.');
        } finally {
            setIsResetting(false);
        }
    };

    return (
        <div className="mt-12 border-t border-red-900/30 pt-8" id="danger-zone">
            <h3 className="text-xl font-black text-red-500 mb-6 flex items-center gap-2">
                ☢️ Danger Zone
            </h3>

            {feedbackMessage && (
                <div className="mb-6 p-4 bg-red-950/50 border border-red-500/30 rounded-xl text-red-200 animate-in fade-in slide-in-from-top-2">
                    {feedbackMessage}
                </div>
            )}

            <div className="grid md:grid-cols-3 gap-4 mb-8">
                {(['meals', 'exercises', 'weight', 'sleep', 'water', 'caffeine', 'food'] as const).map(type => (
                    <div key={type} className="relative">
                        {pendingReset === type ? (
                            <div className="w-full h-full bg-red-950 border border-red-500 rounded-xl p-4 flex flex-col justify-center items-center gap-3 z-10 animate-in zoom-in-95">
                                <p className="text-sm text-red-200 font-bold">Rensa {labels[type]}?</p>
                                <div className="flex gap-2 w-full">
                                    <button
                                        onClick={handleReset}
                                        disabled={isResetting}
                                        className="flex-1 bg-red-600 hover:bg-red-700 text-white text-xs font-bold py-2 rounded transition-colors"
                                    >
                                        JA, RENSA
                                    </button>
                                    <button
                                        onClick={() => setPendingReset(null)}
                                        disabled={isResetting}
                                        className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold py-2 rounded transition-colors"
                                    >
                                        AVBRYT
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <button
                                disabled={isResetting || !!pendingReset}
                                onClick={() => setPendingReset(type)}
                                className="w-full h-full p-4 bg-red-950/30 border border-red-900/30 rounded-xl text-red-400 hover:bg-red-900/20 text-left transition-all disabled:opacity-50"
                            >
                                <div className="font-bold mb-1 flex items-center gap-2">
                                    <span>{icons[type]}</span> Rensa {labels[type]}
                                </div>
                                <div className="text-xs opacity-70">
                                    Tar bort all {labels[type]}
                                </div>
                            </button>
                        )}
                    </div>
                ))}
            </div>

            <div className="bg-red-950/20 border border-red-500/20 rounded-xl p-6">
                <h4 className="font-bold text-red-400 mb-2">Ta bort konto</h4>
                <p className="text-sm text-red-300/70 mb-4">
                    Detta tar bort all din data, profil och inställningar permanent. Går ej att ångra.
                </p>

                {!showDeleteConfirm ? (
                    <button
                        disabled={isResetting || !!pendingReset}
                        onClick={() => setShowDeleteConfirm(true)}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg text-sm transition-colors disabled:opacity-50"
                    >
                        Ta bort mitt konto
                    </button>
                ) : (
                    <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                        <p className="text-xs text-red-400 font-bold uppercase">Skriv "DELETE" för att bekräfta:</p>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={confirmInput}
                                onChange={e => setConfirmInput(e.target.value)}
                                className="bg-red-950/50 border border-red-500/30 rounded px-3 py-2 text-white outline-none focus:border-red-500"
                                placeholder="DELETE"
                            />
                            <button
                                disabled={confirmInput !== 'DELETE' || isResetting}
                                onClick={handleDeleteAccount}
                                className="px-4 py-2 bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-red-700 text-white font-bold rounded-lg text-sm transition-colors"
                            >
                                Bekräfta
                            </button>
                            <button
                                onClick={() => { setShowDeleteConfirm(false); setConfirmInput(''); }}
                                className="px-4 py-2 bg-transparent text-slate-400 hover:text-white font-bold rounded-lg text-sm"
                            >
                                Avbryt
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
