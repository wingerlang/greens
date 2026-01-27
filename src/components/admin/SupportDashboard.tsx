import React, { useEffect } from 'react';
import { useMessages } from '../../context/MessageContext.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { useData } from '../../context/DataContext.tsx';
import { ShieldCheck, UserPlus, MessageSquare, Clock, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatDateRelative } from '../../utils/formatters.ts';

export function SupportDashboard() {
    const { supportQueue, conversations, getSupportQueue, assignSupport, setActiveConversationId } = useMessages();
    const { user } = useAuth();
    const { users } = useData();
    const navigate = useNavigate();

    useEffect(() => {
        getSupportQueue();
        const interval = setInterval(getSupportQueue, 10000); // Poll every 10s
        return () => clearInterval(interval);
    }, []);

    // Filter my active support tickets from regular conversations
    const myTickets = conversations.filter(c => c.type === 'support' && c.assignedTo === user?.id && c.supportStatus !== 'resolved');

    // Filter unassigned tickets from queue
    const unassignedTickets = supportQueue.filter(c => c.supportStatus === 'open' || !c.assignedTo);

    // Filter other assigned tickets (visible in queue for oversight)
    const otherTickets = supportQueue.filter(c => c.assignedTo && c.assignedTo !== user?.id && c.supportStatus !== 'resolved');

    const handleOpenChat = (id: string) => {
        setActiveConversationId(id);
        navigate('/meddelanden');
    };

    const handleAssign = (id: string) => {
        assignSupport(id);
        // Optimistically move? Wait for WS update.
    };

    return (
        <div className="space-y-8 p-6 max-w-7xl mx-auto">
            <header className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                        <ShieldCheck className="text-amber-500" size={32} />
                        Support Dashboard
                    </h2>
                    <p className="text-slate-400 mt-1">Hantera inkommande supportärenden och tilldela resurser.</p>
                </div>
                <button
                    onClick={() => getSupportQueue()}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm font-bold transition-colors"
                >
                    Uppdatera Kö
                </button>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Unassigned Queue */}
                <section className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 shadow-xl">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <Clock className="text-rose-500" />
                        Obemannad Kö ({unassignedTickets.length})
                    </h3>

                    {unassignedTickets.length === 0 ? (
                        <div className="p-8 text-center bg-slate-800/30 rounded-2xl border border-dashed border-slate-700">
                            <CheckCircle className="mx-auto text-emerald-500 mb-2 opacity-50" size={32} />
                            <p className="text-slate-500">Kön är tom! Bra jobbat.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {unassignedTickets.map(ticket => {
                                const creatorId = ticket.participants[0]; // Assuming creator is first? Or use logic
                                // Creator is usually the non-admin participant if only 1?
                                // Or we assume the first participant is the creator for support.
                                const creator = users.find(u => u.id === creatorId);

                                return (
                                    <div key={ticket.id} className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex items-center justify-between group hover:border-slate-600 transition-colors">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-bold text-white">{creator?.username || 'Okänd Användare'}</span>
                                                <span className="text-[10px] bg-rose-500/20 text-rose-400 px-1.5 py-0.5 rounded uppercase font-bold">Ny</span>
                                            </div>
                                            <p className="text-sm text-slate-400 line-clamp-1">{ticket.lastMessage?.content || 'Inget meddelande'}</p>
                                            <p className="text-[10px] text-slate-500 mt-1">Skapad {formatDateRelative(ticket.createdAt)}</p>
                                        </div>
                                        <button
                                            onClick={() => handleAssign(ticket.id)}
                                            className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1 shadow-lg shadow-emerald-500/20"
                                        >
                                            <UserPlus size={14} />
                                            Assign to Me
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>

                {/* My Active Tickets */}
                <section className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 shadow-xl">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <MessageSquare className="text-emerald-500" />
                        Mina Ärenden ({myTickets.length})
                    </h3>

                    {myTickets.length === 0 ? (
                        <div className="p-8 text-center bg-slate-800/30 rounded-2xl border border-dashed border-slate-700">
                            <p className="text-slate-500">Du har inga aktiva ärenden.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                             {myTickets.map(ticket => {
                                const otherIds = ticket.participants.filter(id => id !== user?.id);
                                // The other person is likely the creator
                                const otherUser = users.find(u => u.id === otherIds[0]);

                                return (
                                    <div key={ticket.id} className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex items-center justify-between group hover:border-slate-600 transition-colors">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-bold text-white">{otherUser?.username || 'Användare'}</span>
                                                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded uppercase font-bold">Aktiv</span>
                                            </div>
                                            <p className="text-sm text-slate-400 line-clamp-1">{ticket.lastMessage?.content || '...'}</p>
                                            <p className="text-[10px] text-slate-500 mt-1">Uppdaterad {formatDateRelative(ticket.updatedAt)}</p>
                                        </div>
                                        <button
                                            onClick={() => handleOpenChat(ticket.id)}
                                            className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1"
                                        >
                                            Öppna Chatt
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>
            </div>

            {/* Other Active Tickets (Overview) */}
             <section className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 shadow-xl opacity-75">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <ShieldCheck className="text-slate-500" />
                    Andra Pågående Ärenden ({otherTickets.length})
                </h3>
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {otherTickets.map(ticket => {
                           const assignee = users.find(u => u.id === ticket.assignedTo);
                           return (
                               <div key={ticket.id} className="bg-slate-800/50 p-3 rounded-xl border border-slate-700 flex items-center justify-between">
                                   <div className="text-sm">
                                       <span className="text-slate-400">Hanteras av: </span>
                                       <span className="font-bold text-white">{assignee?.username || 'Okänd'}</span>
                                   </div>
                                   {/* Admin can override/steal? Maybe later */}
                                   <button
                                        onClick={() => handleAssign(ticket.id)}
                                        className="text-[10px] text-slate-500 hover:text-white underline"
                                   >
                                       Överta
                                   </button>
                               </div>
                           )
                      })}
                 </div>
            </section>
        </div>
    );
}
