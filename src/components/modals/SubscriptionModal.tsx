import React, { useState } from 'react';
import { safeFetch } from '../../utils/http.ts';
import { useData } from '../../context/DataContext.tsx';

interface SubscriptionModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const SubscriptionModal: React.FC<SubscriptionModalProps> = ({ isOpen, onClose }) => {
    const { currentUser, updateCurrentUser } = useData();
    const [step, setStep] = useState<'info' | 'processing' | 'success'>('info');
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleUpgrade = async () => {
        setStep('processing');
        setError(null);

        // Artificial delay for "Mock Payment"
        await new Promise(r => setTimeout(r, 2000));

        try {
            const res = await safeFetch<any>('/api/user/subscription', {
                method: 'POST',
                body: JSON.stringify({ tier: 'evergreen' })
            });

            if (res && res.subscription) {
                // Update local state
                updateCurrentUser({ subscription: res.subscription });
                setStep('success');
            } else {
                setError('Kunde inte genomföra köpet.');
                setStep('info');
            }
        } catch (e) {
            setError('Ett fel uppstod.');
            setStep('info');
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-emerald-500/30 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden relative">
                {/* Decorational Gradient */}
                <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-emerald-500/20 to-transparent pointer-events-none" />

                <div className="p-8 relative">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors"
                    >
                        ✕
                    </button>

                    {step === 'info' && (
                        <div className="space-y-6 text-center">
                            <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto text-3xl shadow-[0_0_30px_rgba(16,185,129,0.3)]">
                                🌲
                            </div>

                            <div>
                                <h2 className="text-2xl font-black text-white mb-2">Bli Evergreen Medlem</h2>
                                <p className="text-slate-400 text-sm">Lås upp hela potentialen i din träning och kost.</p>
                            </div>

                            <div className="bg-slate-800/50 rounded-xl p-4 text-left space-y-3 border border-white/5">
                                {[
                                    'Obegränsat antal mål',
                                    'Detaljerad kalorivy (Mikronutrienter)',
                                    'Obegränsad träningshistorik',
                                    'Skapa obegränsat antal recept',
                                    'Prioriterad support'
                                ].map((benefit, i) => (
                                    <div key={i} className="flex items-center gap-3 text-sm text-slate-200">
                                        <span className="text-emerald-400">✓</span> {benefit}
                                    </div>
                                ))}
                            </div>

                            <div className="pt-4">
                                <div className="text-3xl font-black text-white mb-1">99 kr <span className="text-sm text-slate-500 font-medium">/ mån</span></div>
                                <div className="text-xs text-slate-500">Ingen bindningstid. Avsluta när du vill.</div>
                            </div>

                            {error && (
                                <div className="text-rose-400 text-sm font-bold bg-rose-500/10 p-2 rounded-lg">
                                    {error}
                                </div>
                            )}

                            <button
                                onClick={handleUpgrade}
                                className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-white font-black rounded-xl shadow-lg hover:shadow-emerald-500/25 hover:scale-[1.02] active:scale-[0.98] transition-all"
                            >
                                Uppgradera Nu
                            </button>

                            <p className="text-[10px] text-slate-600">
                                Genom att klicka på "Uppgradera Nu" godkänner du våra villkor.
                                (Detta är en mockad betalning, inga pengar dras).
                            </p>
                        </div>
                    )}

                    {step === 'processing' && (
                        <div className="py-12 text-center space-y-6">
                            <div className="w-16 h-16 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mx-auto" />
                            <h3 className="text-lg font-bold text-white">Behandlar betalning...</h3>
                        </div>
                    )}

                    {step === 'success' && (
                        <div className="py-8 text-center space-y-6">
                            <div className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center mx-auto animate-in zoom-in duration-300">
                                <span className="text-4xl">🎉</span>
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-white mb-2">Välkommen till Evergreen!</h2>
                                <p className="text-slate-400">Ditt konto har uppgraderats. Alla funktioner är nu upplåsta.</p>
                            </div>
                            <button
                                onClick={onClose}
                                className="px-8 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-all"
                            >
                                Toppen!
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
