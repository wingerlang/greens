
import React, { useState } from 'react';
import { useAuth } from '../../../context/AuthContext.tsx';
import { profileService } from '../../../services/profileService.ts';

export function DangerZoneSection() {
    const { logout } = useAuth();
    const [confirmInput, setConfirmInput] = useState('');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isResetting, setIsResetting] = useState(false);

    const handleReset = async (type: 'meals' | 'exercises' | 'weight') => {
        const labels = {
            meals: 'måltidshistorik',
            exercises: 'träningspass',
            weight: 'vikthistorik'
        };

        if (!confirm(`Är du säker på att du vill rensa all ${labels[type]}? Detta går inte att ångra.`)) return;

        setIsResetting(true);
        try {
            const success = await profileService.resetData(type);
            if (success) {
                alert(`✅ ${labels[type]} har rensats.`);
                window.location.reload(); // Quick refresh to clear state
            } else {
                alert('Fel vid rensning.');
            }
        } catch (e) {
            console.error(e);
            alert('Kunde inte nå servern.');
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
                alert('Ditt konto har tagits bort. Hejdå! 👋');
                logout();
            } else {
                alert('Fel vid borttagning av konto.');
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsResetting(false);
        }
    };

    return (
        <div className="mt-12 border-t border-red-900/30 pt-8" id="danger-zone">
            <h3 className="text-xl font-black text-red-500 mb-6 flex items-center gap-2">
                ☢️ Danger Zone
            </h3>

            <div className="grid md:grid-cols-2 gap-4 mb-8">
                <button
                    disabled={isResetting}
                    onClick={() => handleReset('meals')}
                    className="p-4 bg-red-950/30 border border-red-900/30 rounded-xl text-red-400 hover:bg-red-900/20 text-left transition-all"
                >
                    <div className="font-bold mb-1">🧹 Rensa Måltider</div>
                    <div className="text-xs opacity-70">Tar bort alla loggade måltider</div>
                </button>

                <button
                    disabled={isResetting}
                    onClick={() => handleReset('exercises')}
                    className="p-4 bg-red-950/30 border border-red-900/30 rounded-xl text-red-400 hover:bg-red-900/20 text-left transition-all"
                >
                    <div className="font-bold mb-1">🏋️ Rensa Träningspass</div>
                    <div className="text-xs opacity-70">Tar bort all träningshistorik</div>
                </button>

                <button
                    disabled={isResetting}
                    onClick={() => handleReset('weight')}
                    className="p-4 bg-red-950/30 border border-red-900/30 rounded-xl text-red-400 hover:bg-red-900/20 text-left transition-all"
                >
                    <div className="font-bold mb-1">⚖️ Rensa Vikt</div>
                    <div className="text-xs opacity-70">Nollställer din viktresa</div>
                </button>
            </div>

            <div className="bg-red-950/20 border border-red-500/20 rounded-xl p-6">
                <h4 className="font-bold text-red-400 mb-2">Ta bort konto</h4>
                <p className="text-sm text-red-300/70 mb-4">
                    Detta tar bort all din data, profil och inställningar permanent. Går ej att ångra.
                </p>

                {!showDeleteConfirm ? (
                    <button
                        onClick={() => setShowDeleteConfirm(true)}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg text-sm transition-colors"
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
