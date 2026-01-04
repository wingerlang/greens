import { useState } from 'react';
import { useCoachAthlete } from '../../context/CoachAthleteContext.tsx';
import { CoachAthleteRelation } from '../../models/types.ts';

export function AthleteListPage() {
    const { mode, getMyAthletes, getMyCoach, inviteAthlete, removeAthlete, acceptInvitation, declineInvitation, relations } = useCoachAthlete();

    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteName, setInviteName] = useState('');
    const [isInviting, setIsInviting] = useState(false);

    const myAthletes = getMyAthletes();
    const myCoach = getMyCoach();
    const pendingInvitations = relations.filter(r => r.athleteId === 'me' && r.status === 'pending');

    const handleInvite = async () => {
        if (!inviteEmail || !inviteName) return;
        setIsInviting(true);
        try {
            await inviteAthlete(inviteEmail, inviteName);
            setInviteEmail('');
            setInviteName('');
        } finally {
            setIsInviting(false);
        }
    };

    const RelationCard = ({ relation, isCoach }: { relation: CoachAthleteRelation; isCoach: boolean }) => (
        <div className={`p-4 rounded-xl border ${relation.status === 'active' ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-slate-900/50 border-white/5'} flex items-center justify-between`}>
            <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${isCoach ? 'bg-amber-500/20' : 'bg-indigo-500/20'}`}>
                    {isCoach ? '👨‍🏫' : '🏃'}
                </div>
                <div>
                    <div className="text-sm font-black text-white">{isCoach ? relation.coachName : relation.athleteName}</div>
                    <div className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">
                        {relation.status === 'pending' ? '⏳ Väntar på svar' :
                            relation.status === 'active' ? '✓ Aktiv' :
                                relation.status === 'declined' ? '✗ Nekad' : '🗑️ Borttagen'}
                    </div>
                </div>
            </div>
            <div className="flex gap-2">
                {relation.status === 'pending' && !isCoach && (
                    <>
                        <button onClick={() => acceptInvitation(relation.id)} className="px-3 py-1.5 bg-emerald-500 text-white text-[9px] font-black uppercase rounded-lg hover:bg-emerald-400">
                            Acceptera
                        </button>
                        <button onClick={() => declineInvitation(relation.id)} className="px-3 py-1.5 bg-slate-700 text-slate-400 text-[9px] font-black uppercase rounded-lg hover:bg-slate-600">
                            Neka
                        </button>
                    </>
                )}
                {relation.status === 'active' && isCoach && (
                    <button onClick={() => removeAthlete(relation.id)} className="px-3 py-1.5 bg-rose-500/10 text-rose-400 text-[9px] font-black uppercase rounded-lg hover:bg-rose-500/20">
                        Ta bort
                    </button>
                )}
            </div>
        </div>
    );

    return (
        <div className="athlete-list-page max-w-3xl mx-auto p-6 space-y-8 text-white">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black uppercase italic tracking-tighter">
                        {mode === 'coach' ? 'Mina Atleter' : 'Min Coach'}
                    </h1>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                        Coach-Athlete Mode
                    </p>
                </div>
                <div className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase ${mode === 'coach' ? 'bg-amber-500/20 text-amber-400' : 'bg-indigo-500/20 text-indigo-400'}`}>
                    {mode === 'coach' ? '👨‍🏫 Coach' : '🏃 Atlet'}
                </div>
            </div>

            {/* Coach View: Invite Athletes */}
            {mode === 'coach' && (
                <section className="glass-card p-5 bg-gradient-to-br from-amber-500/5 to-transparent border-amber-500/10">
                    <h3 className="text-sm font-black uppercase tracking-tight mb-4">➕ Bjud in atlet</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                        <input
                            type="text"
                            value={inviteName}
                            onChange={e => setInviteName(e.target.value)}
                            placeholder="Namn"
                            className="bg-slate-900/50 border border-white/5 rounded-xl p-3 text-white font-bold text-sm focus:border-amber-500/50 outline-none"
                        />
                        <input
                            type="email"
                            value={inviteEmail}
                            onChange={e => setInviteEmail(e.target.value)}
                            placeholder="E-post"
                            className="bg-slate-900/50 border border-white/5 rounded-xl p-3 text-white font-bold text-sm focus:border-amber-500/50 outline-none"
                        />
                    </div>
                    <button
                        onClick={handleInvite}
                        disabled={isInviting || !inviteEmail || !inviteName}
                        className="px-5 py-2.5 bg-amber-500 text-slate-950 font-black rounded-xl text-[10px] uppercase tracking-widest hover:bg-amber-400 disabled:opacity-40 transition-all"
                    >
                        {isInviting ? 'Skickar...' : 'Skicka Inbjudan'}
                    </button>
                </section>
            )}

            {/* Athlete View: My Coach */}
            {mode === 'athlete' && myCoach && (
                <section className="glass-card p-5 bg-gradient-to-br from-indigo-500/5 to-transparent border-indigo-500/10">
                    <h3 className="text-sm font-black uppercase tracking-tight mb-4">👨‍🏫 Din Coach</h3>
                    <RelationCard relation={myCoach} isCoach={true} />
                </section>
            )}

            {/* Athlete View: Pending Invitations */}
            {mode === 'athlete' && pendingInvitations.length > 0 && (
                <section className="glass-card p-5 bg-gradient-to-br from-rose-500/5 to-transparent border-rose-500/10">
                    <h3 className="text-sm font-black uppercase tracking-tight mb-4">📨 Väntande Inbjudningar</h3>
                    <div className="space-y-3">
                        {pendingInvitations.map(r => <RelationCard key={r.id} relation={r} isCoach={true} />)}
                    </div>
                </section>
            )}

            {/* Coach View: My Athletes List */}
            {mode === 'coach' && (
                <section className="glass-card p-5">
                    <h3 className="text-sm font-black uppercase tracking-tight mb-4">
                        🏃 Atleter ({myAthletes.length})
                    </h3>
                    {myAthletes.length === 0 ? (
                        <div className="text-center py-10 text-slate-500">
                            <p className="text-3xl mb-2">🏃‍♂️</p>
                            <p className="text-sm font-bold">Inga atleter ännu</p>
                            <p className="text-[10px]">Bjud in din första atlet ovan</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {myAthletes.map(r => <RelationCard key={r.id} relation={r} isCoach={false} />)}
                        </div>
                    )}
                </section>
            )}

            {/* Stats Summary */}
            {mode === 'coach' && myAthletes.length > 0 && (
                <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 bg-slate-900/40 rounded-xl text-center">
                        <div className="text-2xl font-black text-emerald-400">{myAthletes.length}</div>
                        <div className="text-[9px] text-slate-500 uppercase font-bold">Aktiva Atleter</div>
                    </div>
                    <div className="p-4 bg-slate-900/40 rounded-xl text-center">
                        <div className="text-2xl font-black text-amber-400">{relations.filter(r => r.status === 'pending').length}</div>
                        <div className="text-[9px] text-slate-500 uppercase font-bold">Väntande</div>
                    </div>
                    <div className="p-4 bg-slate-900/40 rounded-xl text-center">
                        <div className="text-2xl font-black text-indigo-400">0</div>
                        <div className="text-[9px] text-slate-500 uppercase font-bold">Delade Planer</div>
                    </div>
                </div>
            )}
        </div>
    );
}
