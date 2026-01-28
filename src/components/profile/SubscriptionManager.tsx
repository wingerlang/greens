import React, { useState } from 'react';
import { usePermissions } from '../../hooks/usePermissions.ts';
import { useData } from '../../context/DataContext.tsx';
import { SubscriptionModal } from '../modals/SubscriptionModal.tsx';
import { SubscriptionEvent } from '../../models/types.ts';

export const SubscriptionManager: React.FC = () => {
    const { tier, isEvergreen } = usePermissions();
    const { currentUser } = useData();
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Get history from current user subscription
    const history = currentUser?.subscription?.history || [];

    const formatDate = (iso: string) => {
        return new Date(iso).toLocaleDateString('sv-SE', {
            year: 'numeric', month: 'long', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    };

    return (
        <section className="bg-slate-900/50 border border-white/5 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <span>💳</span> Medlemskap
                </h3>
                <div className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border ${
                    isEvergreen
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                        : 'bg-slate-700 text-slate-400 border-slate-600'
                }`}>
                    {tier}
                </div>
            </div>

            <div className="p-6 bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl border border-white/5 mb-6 relative overflow-hidden group">
                <div className={`absolute top-0 right-0 p-32 bg-emerald-500/10 rounded-full blur-3xl -mr-16 -mt-16 transition-opacity ${isEvergreen ? 'opacity-100' : 'opacity-0'}`} />

                <div className="relative z-10">
                    <div className="text-sm text-slate-400 font-bold uppercase tracking-widest mb-1">Nuvarande Plan</div>
                    <div className="text-3xl font-black text-white mb-4 flex items-center gap-3">
                        {isEvergreen ? '🌲 Evergreen' : '🌱 Free Plan'}
                    </div>

                    {isEvergreen ? (
                        <div className="space-y-4">
                            <p className="text-slate-300 text-sm">
                                Du har tillgång till alla premiumfunktioner. Tack för att du stöttar oss!
                            </p>
                            <div className="flex gap-3">
                                <button
                                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-bold transition-colors"
                                    onClick={() => alert('Hantering av prenumeration kommer snart!')}
                                >
                                    Hantera
                                </button>
                                <button className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded-lg text-sm font-bold transition-colors border border-emerald-500/20">
                                    Visa Kvitto
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <p className="text-slate-300 text-sm">
                                Uppgradera till Evergreen för obegränsad tillgång till statistik, mål och fler funktioner.
                            </p>
                            <button
                                onClick={() => setIsModalOpen(true)}
                                className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-xl shadow-lg hover:shadow-emerald-500/25 transition-all"
                            >
                                Uppgradera för 99kr/mån
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* History */}
            {history.length > 0 && (
                <div className="space-y-4">
                    <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Historik</h4>
                    <div className="space-y-2">
                        {history.map((event: SubscriptionEvent) => (
                            <div key={event.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg text-sm">
                                <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-lg ${
                                        event.type === 'upgrade' ? 'bg-emerald-500/20' :
                                        event.type === 'downgrade' ? 'bg-amber-500/20' : 'bg-slate-700'
                                    }`}>
                                        {event.type === 'upgrade' ? '⬆️' : event.type === 'downgrade' ? '⬇️' : '📝'}
                                    </div>
                                    <div>
                                        <div className="font-bold text-white capitalize">
                                            {event.type === 'upgrade' ? 'Uppgradering' : event.type}
                                        </div>
                                        <div className="text-xs text-slate-500">{formatDate(event.date)}</div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="font-mono text-emerald-400 font-bold">
                                        {event.tier}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <SubscriptionModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
            />
        </section>
    );
};
