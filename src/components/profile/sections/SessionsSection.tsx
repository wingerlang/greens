// Sessions Management Section
import React from 'react';
import { useSessions } from '../hooks/useSessions.ts';

export function SessionsSection() {
    const { sessions, loading, currentSession, otherSessions, revokeSession, revokeAllOther } = useSessions();

    const handleRevoke = async (token: string) => {
        if (confirm('Logga ut från denna session?')) {
            await revokeSession(token);
        }
    };

    const handleRevokeAll = async () => {
        if (confirm('Logga ut från alla andra sessioner?')) {
            await revokeAllOther();
        }
    };

    if (loading) return <div className="text-slate-500 text-center py-4">Laddar...</div>;

    return (
        <div className="space-y-4">
            {sessions.length === 0 ? (
                <p className="text-slate-500 text-sm">Inga aktiva sessioner hittades.</p>
            ) : (
                <div className="space-y-2">
                    {sessions.map((s, i) => (
                        <div key={i} className={`flex items-center justify-between p-3 rounded-xl ${s.isCurrent ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-slate-800/30'}`}>
                            <div className="flex items-center gap-3">
                                <span className="text-2xl">{s.isCurrent ? '📱' : '💻'}</span>
                                <div>
                                    <div className="text-white text-sm font-medium">
                                        {s.isCurrent && <span className="text-emerald-400 mr-2">(Denna enhet)</span>}
                                        {s.token}
                                    </div>
                                    <div className="text-slate-500 text-xs">
                                        Skapad: {s.createdAt ? new Date(s.createdAt).toLocaleString('sv-SE') : 'Okänd'}
                                    </div>
                                </div>
                            </div>
                            {!s.isCurrent && (
                                <button
                                    onClick={() => handleRevoke(s.token)}
                                    className="px-3 py-1.5 bg-red-500/20 text-red-400 rounded-lg text-xs font-bold hover:bg-red-500/30"
                                >
                                    Logga ut
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {otherSessions.length > 0 && (
                <button
                    onClick={handleRevokeAll}
                    className="w-full py-2 bg-red-500/10 text-red-400 rounded-lg text-sm font-bold hover:bg-red-500/20"
                >
                    🚪 Logga ut från alla andra sessioner
                </button>
            )}

            <div className="text-slate-500 text-xs text-center">
                {sessions.length} aktiv{sessions.length !== 1 ? 'a' : ''} session{sessions.length !== 1 ? 'er' : ''}
            </div>
        </div>
    );
}
